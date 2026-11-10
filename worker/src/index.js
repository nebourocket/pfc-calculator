// PFCかんたん計算ツール — ライセンス発行 Worker (Cloudflare Workers)
//
// やることは 1 つだけです。
//   GET /license?session_id=cs_... を受け取り、Stripe にその Checkout Session が
//   「500 円の支払い済み」かを問い合わせ、そうであれば署名付きライセンスキーを返します。
//
// カード番号などの決済情報は、この Worker にもアプリにも一切届きません
// (入力されるのは Stripe のページだけです)。
// ここで扱うのは Checkout Session の ID と、支払い状態・金額だけです。
//
// 必要な設定 (wrangler.toml と wrangler secret):
//   STRIPE_SECRET_KEY   … 制限付きキー (Checkout Sessions の読み取りのみ) を推奨
//   LICENSE_PRIVATE_JWK … ライセンス署名用の秘密鍵 (scripts/gen-keys.mjs で作成)
//   ALLOWED_ORIGIN      … アプリの公開元 (例: https://nebourocket.github.io)
//   PRICE_JPY           … 価格 (円)。支払額がこれと一致したときだけ発行します
//   PAYMENT_LINK_ID     … plink_... 。この Payment Link 経由の支払いだけを認めます (空なら発行しません)

const SESSION_ID_RE = /^cs_(live|test)_[A-Za-z0-9]{10,250}$/;
const LICENSE_PREFIX = "PFC1";

function base64url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 鍵の読み込みは重いので、同じ isolate の中では使い回します。
let cachedKey = null;
let cachedJwk = null;
async function signingKey(jwkText) {
  if (cachedKey && cachedJwk === jwkText) return cachedKey;
  const jwk = JSON.parse(jwkText);
  cachedKey = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  cachedJwk = jwkText;
  return cachedKey;
}

// ライセンスキー = "PFC1.<payload>.<署名>" (どちらも base64url)。
// payload には個人情報 (メールアドレス等) を入れず、Session ID のハッシュと発行時刻だけを入れます。
export async function issueLicense(sessionId, jwkText, now) {
  const payload = {
    v: 1,
    sid: (await sha256Hex(sessionId)).slice(0, 32),
    iat: Math.floor((now || Date.now()) / 1000),
  };
  const body = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signed = LICENSE_PREFIX + "." + body;
  const key = await signingKey(jwkText);
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signed));
  return signed + "." + base64url(new Uint8Array(sig));
}

function corsHeaders(env, request) {
  const origin = request.headers.get("Origin");
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Vary": "Origin",
  };
  if (origin && origin === env.ALLOWED_ORIGIN) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return headers;
}

function reply(env, request, status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: corsHeaders(env, request) });
}

// Stripe の Checkout Session が、この商品の支払い済みかを確かめます。
export function isPaidSession(session, env) {
  if (!session || typeof session !== "object") return false;
  if (session.object !== "checkout.session") return false;
  if (session.mode !== "payment") return false;
  if (session.status !== "complete") return false;
  if (session.payment_status !== "paid") return false;
  if (session.currency !== "jpy") return false;
  if (session.amount_total !== Number(env.PRICE_JPY)) return false;
  if (!env.PAYMENT_LINK_ID || session.payment_link !== env.PAYMENT_LINK_ID) return false;
  return true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env, request) });
    }
    if (url.pathname !== "/license") {
      return reply(env, request, 404, { error: "not_found" });
    }
    if (request.method !== "GET") {
      return reply(env, request, 405, { error: "method_not_allowed" });
    }

    const sessionId = url.searchParams.get("session_id") || "";
    if (!SESSION_ID_RE.test(sessionId)) {
      return reply(env, request, 400, { error: "bad_session_id" });
    }
    if (!env.STRIPE_SECRET_KEY || !env.LICENSE_PRIVATE_JWK || !env.PRICE_JPY || !env.PAYMENT_LINK_ID) {
      return reply(env, request, 500, { error: "not_configured" });
    }

    let res;
    try {
      res = await fetch(
        "https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(sessionId),
        { headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY } });
    } catch (e) {
      return reply(env, request, 502, { error: "stripe_unreachable" });
    }
    // Stripe からのエラー内容はそのまま返さず、種類だけを伝えます。
    if (res.status === 404) return reply(env, request, 404, { error: "session_not_found" });
    if (!res.ok) return reply(env, request, 502, { error: "stripe_error" });

    let session;
    try {
      session = await res.json();
    } catch (e) {
      return reply(env, request, 502, { error: "stripe_error" });
    }
    if (!isPaidSession(session, env)) {
      return reply(env, request, 402, { error: "not_paid" });
    }

    let license;
    try {
      license = await issueLicense(sessionId, env.LICENSE_PRIVATE_JWK);
    } catch (e) {
      return reply(env, request, 500, { error: "not_configured" });
    }
    return reply(env, request, 200, { license });
  },
};
