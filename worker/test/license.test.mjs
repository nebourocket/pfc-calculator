// ライセンス発行 Worker のテスト (Stripe への通信はフェイクに差し替えます)
// 実行: node worker/test/license.test.mjs
import worker, { isPaidSession } from "../src/index.js";

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { passed += 1; console.log("  ok - " + name); }
  else { failed += 1; console.log("  NG - " + name); }
}

const pair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const privJwk = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey));

const ORIGIN = "https://nebourocket.github.io";
const env = {
  STRIPE_SECRET_KEY: "rk_test_dummy",
  LICENSE_PRIVATE_JWK: privJwk,
  ALLOWED_ORIGIN: ORIGIN,
  PRICE_JPY: "500",
  PAYMENT_LINK_ID: "plink_123",
};
const SID = "cs_test_a1B2c3D4e5F6g7H8i9J0";
const paid = {
  object: "checkout.session", mode: "payment", status: "complete",
  payment_status: "paid", currency: "jpy", amount_total: 500, payment_link: "plink_123",
  customer_details: { email: "someone@example.com" },
};

// Stripe へのリクエストを記録し、決めた応答を返すフェイク。
let stripeCalls = [];
let stripeReply = () => new Response(JSON.stringify(paid), { status: 200 });
globalThis.fetch = async (url, init) => {
  stripeCalls.push({ url: String(url), init });
  return stripeReply();
};

function get(path, origin) {
  const headers = origin ? { Origin: origin } : {};
  return worker.fetch(new Request("https://pfc-license.example.workers.dev" + path, { headers }), env);
}

console.log("[支払い済みの判定]");
check("500円・支払い済みは true", isPaidSession(paid, env));
check("金額が違えば false", !isPaidSession({ ...paid, amount_total: 50 }, env));
check("通貨が違えば false", !isPaidSession({ ...paid, currency: "usd" }, env));
check("未払いは false", !isPaidSession({ ...paid, payment_status: "unpaid" }, env));
check("未完了は false", !isPaidSession({ ...paid, status: "open" }, env));
check("サブスクは false", !isPaidSession({ ...paid, mode: "subscription" }, env));
check("別の Payment Link は false", !isPaidSession({ ...paid, payment_link: "plink_other" }, env));
check("PAYMENT_LINK_ID が空なら発行しない",
  !isPaidSession({ ...paid, payment_link: null }, { ...env, PAYMENT_LINK_ID: "" }));
check("null は false", !isPaidSession(null, env));

console.log("[発行]");
{
  stripeCalls = [];
  const res = await get("/license?session_id=" + SID, ORIGIN);
  const body = await res.json();
  check("支払い済みなら 200", res.status === 200);
  check("ライセンスキーが PFC1. で始まる", typeof body.license === "string" && body.license.startsWith("PFC1."));
  check("Stripe に 1 回だけ問い合わせる", stripeCalls.length === 1);
  check("問い合わせ先は Checkout Session の取得 API",
    stripeCalls[0].url === "https://api.stripe.com/v1/checkout/sessions/" + SID);
  check("シークレットキーは Authorization ヘッダーで送る",
    stripeCalls[0].init.headers.Authorization === "Bearer rk_test_dummy");
  check("許可した Origin には CORS ヘッダーを返す",
    res.headers.get("Access-Control-Allow-Origin") === ORIGIN);
  check("キャッシュさせない", res.headers.get("Cache-Control") === "no-store");

  const [prefix, payloadB64, sigB64] = body.license.split(".");
  const toBytes = (t) => Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((t.length + 3) % 4)), (c) => c.charCodeAt(0));
  const payloadText = new TextDecoder().decode(toBytes(payloadB64));
  check("キーにメールアドレスなどの個人情報が入らない", !payloadText.includes("@") && !payloadText.includes(SID));
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey,
    toBytes(sigB64), new TextEncoder().encode(prefix + "." + payloadB64));
  check("公開鍵で署名を確かめられる", ok);
}

console.log("[拒否]");
{
  const res = await get("/license?session_id=" + SID, "https://evil.example");
  check("許可していない Origin には CORS ヘッダーを付けない",
    res.headers.get("Access-Control-Allow-Origin") === null);

  stripeCalls = [];
  const bad = await get("/license?session_id=" + encodeURIComponent("cs_test_x/../../v1/customers"), ORIGIN);
  check("形式が違う session_id は 400", bad.status === 400);
  check("形式が違えば Stripe に問い合わせない", stripeCalls.length === 0);
  check("session_id 無しは 400", (await get("/license", ORIGIN)).status === 400);

  stripeReply = () => new Response(JSON.stringify({ ...paid, payment_status: "unpaid" }), { status: 200 });
  check("未払いは 402", (await get("/license?session_id=" + SID, ORIGIN)).status === 402);

  stripeReply = () => new Response(JSON.stringify({ error: { message: "No such checkout.session: secret detail" } }), { status: 404 });
  const nf = await get("/license?session_id=" + SID, ORIGIN);
  const nfText = await nf.text();
  check("存在しない Session は 404", nf.status === 404);
  check("Stripe のエラー文をそのまま返さない", !nfText.includes("secret detail"));

  stripeReply = () => new Response("oops", { status: 500 });
  check("Stripe の障害は 502", (await get("/license?session_id=" + SID, ORIGIN)).status === 502);

  stripeReply = () => { throw new Error("network"); };
  check("Stripe に届かなければ 502", (await get("/license?session_id=" + SID, ORIGIN)).status === 502);

  const post = await worker.fetch(new Request("https://x.workers.dev/license?session_id=" + SID, { method: "POST" }), env);
  check("POST は 405", post.status === 405);
  check("ほかのパスは 404", (await get("/", ORIGIN)).status === 404);

  stripeReply = () => new Response(JSON.stringify(paid), { status: 200 });
  const noKey = await worker.fetch(new Request("https://x.workers.dev/license?session_id=" + SID),
    { ...env, STRIPE_SECRET_KEY: "" });
  check("設定が無ければ 500 (発行しない)", noKey.status === 500);
  const noLink = await worker.fetch(new Request("https://x.workers.dev/license?session_id=" + SID),
    { ...env, PAYMENT_LINK_ID: "" });
  check("PAYMENT_LINK_ID が空なら 500 (発行しない)", noLink.status === 500);

  stripeReply = () => new Response("<html>not json</html>", { status: 200 });
  check("Stripe の応答が JSON でなければ 502", (await get("/license?session_id=" + SID, ORIGIN)).status === 502);

  stripeReply = () => new Response(JSON.stringify(paid), { status: 200 });
  const badJwk = await get("/license?session_id=" + SID, ORIGIN).then(() =>
    worker.fetch(new Request("https://x.workers.dev/license?session_id=" + SID), { ...env, LICENSE_PRIVATE_JWK: "{broken" }));
  check("秘密鍵が壊れていても例外で落ちず 500", badJwk.status === 500);
}

console.log("");
console.log("結果: " + passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
