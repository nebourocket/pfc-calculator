// PFCかんたん計算ツール
// 入力データは localStorage にのみ保存する（記録は外部に送らない）。
// 外部と通信するのは、Pro を購入した直後にライセンスキーを受け取るときだけ。
// 日付が変わると、前日までの記録は「過去の記録」に移り、今日の記録は空になる。
(function () {
  "use strict";

  var STORAGE_KEY = "pfc-calculator-v1";
  var FREE_CUSTOM_LIMIT = 5;         // 無料版の自由枠の登録上限
  var PRO_CUSTOM_LIMIT = 200;        // Pro の自由枠の登録上限（安全上限）
  var MAX_GRAMS = 5000;              // 1回の追加で受け付ける量の上限（g）
  var MAX_TARGET = 100000;           // 目標値の上限
  var HISTORY_DAYS_TO_SHOW = 7;      // 過去の記録の表示日数
  var HISTORY_MAX_DAYS = 90;         // 過去の記録の保存日数
  var CHART_DAYS = 14;               // グラフに表示する日数

  // Pro の利用コードは、平文をソースに置かず SHA-256 ハッシュで照合する。
  // ここに登録するのは配布コードのハッシュだけ。平文コードは台帳側
  // （リポジトリ外）でのみ管理する。
  var PRO_CODE_HASHES = [
    "1bdb86e43c7f3cb0e00e04c68d037f6506c397c6899c4926d63ba1922cf25a49"
  ];

  // 買い切り Pro の設定 (config.js)。秘密の値は入っていない公開設定です。
  var CONFIG = (window.PFC_CONFIG && typeof window.PFC_CONFIG === "object") ? window.PFC_CONFIG : {};
  var PAYMENT_LINK_URL = /^https:\/\/(buy|checkout)\.stripe\.com\//.test(String(CONFIG.paymentLinkUrl || ""))
    ? String(CONFIG.paymentLinkUrl) : "";
  var LICENSE_API_URL = /^https:\/\//.test(String(CONFIG.licenseApiUrl || ""))
    ? String(CONFIG.licenseApiUrl) : "";
  var LICENSE_PUBLIC_JWK = (CONFIG.licensePublicJwk && typeof CONFIG.licensePublicJwk === "object")
    ? CONFIG.licensePublicJwk : null;
  var PURCHASE_READY = !!(PAYMENT_LINK_URL && LICENSE_API_URL && LICENSE_PUBLIC_JWK);
  var LICENSE_RE = /^PFC1\.[A-Za-z0-9_-]{10,400}\.[A-Za-z0-9_-]{80,100}$/;
  var SESSION_ID_RE = /^cs_(live|test)_[A-Za-z0-9]{10,250}$/;

  var DEFAULT_TARGETS = { kcal: 2000, p: 100, f: 60, c: 250 };
  var FOODS = Array.isArray(window.FOODS) ? window.FOODS : [];

  // ---------- 小物 ----------
  var idCounter = 0;
  function nextId(prefix) {
    idCounter += 1;
    return prefix + Date.now().toString(36) + "-" + idCounter + "-" +
      Math.floor(Math.random() * 100000);
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function todayString() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function isDateString(s) {
    return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  function formatDateLabel(dateStr) {
    var parts = dateStr.split("-");
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var week = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
    return Number(parts[1]) + "月" + Number(parts[2]) + "日（" + week + "）";
  }

  // 数値として読めなければ null を返す（NaN や文字列の混入対策）。
  // 注意：Number(null) は 0 になってしまうため、null 等は先に弾く。
  function finiteNumber(v) {
    if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function clampedNumber(v, min, max, fallback) {
    var n = finiteNumber(v);
    if (n === null) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function fmt(n, decimals) {
    if (!isFinite(n)) n = 0;
    return n.toLocaleString("ja-JP", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  // ---------- 状態の読み書き ----------
  // 保存データが壊れていても落ちないよう、読み込み時に必ず検証する。
  function sanitizeEntries(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (e) {
      if (!e || typeof e !== "object") return;
      if (typeof e.foodId !== "string" || !e.foodId) return;
      var grams = finiteNumber(e.grams);
      if (grams === null || grams <= 0 || grams > 50000) return;
      out.push({
        id: typeof e.id === "string" && e.id ? e.id : nextId("e"),
        foodId: e.foodId,
        grams: grams
      });
    });
    return out;
  }

  function sanitizeCustomFoods(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    var seen = {};
    list.forEach(function (f) {
      if (!f || typeof f !== "object") return;
      if (typeof f.id !== "string" || !f.id || seen[f.id]) return;
      if (typeof f.name !== "string" || !f.name.trim()) return;
      var kcal = finiteNumber(f.kcal);
      var p = finiteNumber(f.p);
      var fat = finiteNumber(f.f);
      var c = finiteNumber(f.c);
      if (kcal === null || p === null || fat === null || c === null) return;
      if (kcal < 0 || kcal > 5000 || p < 0 || p > 500 ||
          fat < 0 || fat > 500 || c < 0 || c > 500) return;
      seen[f.id] = true;
      out.push({ id: f.id, name: f.name, kcal: kcal, p: p, f: fat, c: c });
    });
    return out;
  }

  function sanitizeTargets(t) {
    var out = {};
    ["kcal", "p", "f", "c"].forEach(function (key) {
      out[key] = clampedNumber(t && t[key], 0, MAX_TARGET, DEFAULT_TARGETS[key]);
    });
    return out;
  }

  function sanitizeHistory(h) {
    var out = {};
    if (!h || typeof h !== "object") return out;
    Object.keys(h).forEach(function (date) {
      if (!isDateString(date)) return;
      var v = h[date];
      if (!v || typeof v !== "object") return;
      var item = {};
      var ok = true;
      ["kcal", "p", "f", "c"].forEach(function (key) {
        var n = finiteNumber(v[key]);
        if (n === null || n < 0 || n > 10000000) { ok = false; return; }
        item[key] = n;
      });
      if (ok) out[date] = item;
    });
    return out;
  }

  var ACTIVITY_OPTIONS = [1.2, 1.375, 1.55, 1.725];

  // 目標の自動計算用プロフィール。未入力なら null。
  function sanitizeProfile(p) {
    if (!p || typeof p !== "object") return null;
    var age = finiteNumber(p.age);
    var height = finiteNumber(p.height);
    var weight = finiteNumber(p.weight);
    var activity = finiteNumber(p.activity);
    if (age === null || age < 10 || age > 100) return null;
    if (height === null || height < 100 || height > 250) return null;
    if (weight === null || weight < 20 || weight > 300) return null;
    if (activity === null || ACTIVITY_OPTIONS.indexOf(activity) === -1) return null;
    return {
      sex: p.sex === "female" ? "female" : "male",
      age: age, height: height, weight: weight, activity: activity,
      goal: (p.goal === "cut" || p.goal === "bulk") ? p.goal : "maintain"
    };
  }

  function loadState() {
    var fallback = {
      entries: [], customFoods: [], targets: sanitizeTargets(null),
      pro: false, day: todayString(), history: {}, profile: null,
      license: null, pendingSession: null
    };
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return fallback;
      return {
        entries: sanitizeEntries(parsed.entries),
        customFoods: sanitizeCustomFoods(parsed.customFoods),
        targets: sanitizeTargets(parsed.targets),
        pro: parsed.pro === true,
        day: isDateString(parsed.day) ? parsed.day : todayString(),
        history: sanitizeHistory(parsed.history),
        profile: sanitizeProfile(parsed.profile),
        license: LICENSE_RE.test(String(parsed.license)) ? parsed.license : null,
        pendingSession: SESSION_ID_RE.test(String(parsed.pendingSession)) ? parsed.pendingSession : null
      };
    } catch (e) {
      return fallback;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // 保存に失敗しても、画面の表示は続ける。
    }
  }

  function trimHistory() {
    var dates = Object.keys(state.history).sort();
    while (dates.length > HISTORY_MAX_DAYS) {
      delete state.history[dates.shift()];
    }
  }

  // ---------- 食品の検索 ----------
  function findFood(id) {
    if (typeof id !== "string") return null;
    if (id.indexOf("custom:") === 0) {
      var customId = id.slice("custom:".length);
      for (var i = 0; i < state.customFoods.length; i++) {
        if (state.customFoods[i].id === customId) return state.customFoods[i];
      }
      return null;
    }
    for (var j = 0; j < FOODS.length; j++) {
      if (FOODS[j].id === id) return FOODS[j];
    }
    return null;
  }

  function allFoodsForSelect() {
    var list = FOODS.slice();
    state.customFoods.forEach(function (food) {
      list.push({
        id: "custom:" + food.id,
        name: food.name,
        category: "自分の食品",
        kcal: food.kcal, p: food.p, f: food.f, c: food.c
      });
    });
    return list;
  }

  // ---------- 計算 ----------
  function entryValues(entry) {
    var food = findFood(entry.foodId);
    if (!food) return null;
    var ratio = entry.grams / 100;
    return {
      kcal: food.kcal * ratio,
      p: food.p * ratio,
      f: food.f * ratio,
      c: food.c * ratio
    };
  }

  function totals() {
    var t = { kcal: 0, p: 0, f: 0, c: 0 };
    state.entries.forEach(function (entry) {
      var v = entryValues(entry);
      if (!v) return;
      t.kcal += v.kcal; t.p += v.p; t.f += v.f; t.c += v.c;
    });
    return t;
  }

  // ---------- Pro：目標の自動計算 ----------
  // Mifflin-St Jeor 式で基礎代謝（BMR）を出し、活動レベルを掛けて TDEE、
  // 目的（減量 −20% ／ 維持 ／ 増量 +10%）で目標 kcal を決める。
  // PFC の目安：P＝体重×2g、F＝目標 kcal の25%、C＝残り。
  // あくまで一般的な目安であり、医療・栄養指導ではない。
  function computeAutoTargets(profile) {
    var w = profile.weight;
    var bmrRaw = profile.sex === "female"
      ? 10 * w + 6.25 * profile.height - 5 * profile.age - 161
      : 10 * w + 6.25 * profile.height - 5 * profile.age + 5;
    var tdeeRaw = bmrRaw * profile.activity;
    var factor = profile.goal === "cut" ? 0.8 : profile.goal === "bulk" ? 1.1 : 1.0;
    var kcal = Math.round(tdeeRaw * factor);
    // 減量でも基礎代謝は下回らないようにする。
    if (profile.goal === "cut") kcal = Math.max(kcal, Math.round(bmrRaw));
    var p = Math.round(w * 2);
    var f = Math.round(kcal * 0.25 / 9);
    var c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
    return {
      bmr: Math.round(bmrRaw), tdee: Math.round(tdeeRaw),
      kcal: kcal, p: p, f: f, c: c
    };
  }

  // ---------- Pro：グラフ用データ ----------
  // 直近 days 日（今日を含む）の日別合計を、古い順に並べて返す。
  // 記録のない日は 0 として含める。
  function buildChartData(days) {
    var result = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var key = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
      var v = i === 0 ? totals() : (state.history[key] || { kcal: 0, p: 0, f: 0, c: 0 });
      result.push({
        date: key,
        label: (d.getMonth() + 1) + "/" + d.getDate(),
        kcal: v.kcal, p: v.p, f: v.f, c: v.c,
        isToday: i === 0
      });
    }
    return result;
  }

  // ---------- Pro：CSV ----------
  function round1(v) { return Math.round(v * 10) / 10; }

  function csvEscape(s) {
    s = String(s);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function buildTodayCsv() {
    var lines = ["食品名,量(g),カロリー(kcal),たんぱく質(g),脂質(g),炭水化物(g)"];
    state.entries.forEach(function (entry) {
      var food = findFood(entry.foodId);
      var v = entryValues(entry);
      if (!food || !v) return;
      lines.push([
        csvEscape(food.name), entry.grams,
        Math.round(v.kcal), round1(v.p), round1(v.f), round1(v.c)
      ].join(","));
    });
    var t = totals();
    lines.push(["合計", "", Math.round(t.kcal), round1(t.p), round1(t.f), round1(t.c)].join(","));
    return lines.join("\r\n");
  }

  function buildHistoryCsv() {
    var lines = ["日付,カロリー(kcal),たんぱく質(g),脂質(g),炭水化物(g)"];
    var dates = Object.keys(state.history).sort();
    dates.forEach(function (date) {
      var v = state.history[date];
      lines.push([date, Math.round(v.kcal), round1(v.p), round1(v.f), round1(v.c)].join(","));
    });
    var t = totals();
    lines.push([todayString(), Math.round(t.kcal), round1(t.p), round1(t.f), round1(t.c)].join(","));
    return lines.join("\r\n");
  }

  // CSV をダウンロードさせる。文字化け対策に BOM 付き UTF-8 で出す。
  // このアプリは決済情報などを扱わないため、ここで扱うのは記録データのみ。
  function downloadCsv(filename, csvText) {
    try {
      var blob = new Blob(["\uFEFF" + csvText], { type: "text/csv;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      if (document.body) document.body.appendChild(a);
      a.click();
      if (document.body) document.body.removeChild(a);
      if (typeof setTimeout !== "undefined") {
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }
    } catch (e) {
      // ダウンロードできない環境では何もしない。
    }
  }

  // ---------- SHA-256 ----------
  // コード照合用。Web Crypto（SubtleCrypto）が使える環境ではそれを優先し、
  // 使えない環境では下の純JS実装で同じダイジェストを計算する。
  function utf8Bytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) {
        bytes.push(c);
      } else if (c < 0x800) {
        bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var cp = 0x10000 + ((c - 0xd800) << 10) + (str.charCodeAt(i + 1) - 0xdc00);
        i += 1;
        bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      } else {
        bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return bytes;
  }

  var SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function sha256HexPure(str) {
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    var msg = utf8Bytes(str);
    var bitLen = msg.length * 8;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    // メッセージ長は 2^32 bit 未満の前提で下位32bitだけ書き込む（コード照合には十分）。
    msg.push(0, 0, 0, 0,
      (bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
             0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Array(64);
    for (var block = 0; block < msg.length; block += 64) {
      var i;
      for (i = 0; i < 16; i++) {
        w[i] = (msg[block + i * 4] << 24) | (msg[block + i * 4 + 1] << 16) |
               (msg[block + i * 4 + 2] << 8) | msg[block + i * 4 + 3];
      }
      for (i = 16; i < 64; i++) {
        var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + SHA256_K[i] + w[i]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0;
      h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0;
      h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    return h.map(function (x) {
      return ("00000000" + (x >>> 0).toString(16)).slice(-8);
    }).join("");
  }

  // SHA-256 の hex ダイジェストを返す（Promise）。
  function sha256Hex(text) {
    try {
      if (typeof crypto !== "undefined" && crypto.subtle &&
          typeof crypto.subtle.digest === "function" &&
          typeof TextEncoder !== "undefined") {
        return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
          .then(function (buf) {
            return Array.prototype.map.call(new Uint8Array(buf), function (b) {
              return ("0" + b.toString(16)).slice(-2);
            }).join("");
          })
          .catch(function () { return sha256HexPure(text); });
      }
    } catch (e) {
      // フォールバックへ
    }
    return Promise.resolve(sha256HexPure(text));
  }

  // ---------- Pro ----------
  function normalizeCode(code) {
    return String(code == null ? "" : code).trim().toUpperCase();
  }

  // 利用コードの判定（非同期）。結果は "ok" / "wrong" / "empty" のいずれか。
  // コードの平文は保持せず、SHA-256 ハッシュ同士で照合する。
  function checkProCode(code) {
    var normalized = normalizeCode(code);
    if (!normalized) return Promise.resolve("empty");
    return sha256Hex(normalized).then(function (hash) {
      return PRO_CODE_HASHES.indexOf(hash) !== -1 ? "ok" : "wrong";
    });
  }

  // ---------- 買い切り Pro：ライセンスキー ----------
  // キーは "PFC1.<payload>.<署名>"。署名 (ECDSA P-256) を config.js の公開鍵で確かめる。
  // 秘密鍵はライセンス発行 Worker の中にだけあるので、キーを偽造することはできない。
  function base64urlToBytes(text) {
    var b64 = text.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // 結果は true / false の Promise。署名を確かめられない環境では false。
  function verifyLicense(license) {
    var text = String(license == null ? "" : license).trim();
    if (!LICENSE_RE.test(text) || !LICENSE_PUBLIC_JWK) return Promise.resolve(false);
    if (typeof crypto === "undefined" || !crypto.subtle || typeof TextEncoder === "undefined") {
      return Promise.resolve(false);
    }
    var parts = text.split(".");
    var payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(parts[1])));
    } catch (e) {
      return Promise.resolve(false);
    }
    if (!payload || payload.v !== 1) return Promise.resolve(false);
    return crypto.subtle.importKey("jwk", LICENSE_PUBLIC_JWK,
      { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"])
      .then(function (key) {
        return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key,
          base64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
      })
      .catch(function () { return false; });
  }

  function activateLicense(license) {
    state.pro = true;
    state.license = license;
    state.pendingSession = null;
    saveState();
    renderAll();
  }

  // 決済後に Stripe から戻ってきたときの処理。
  // session_id を Worker に渡して、支払い済みならライセンスキーを受け取る。
  function claimLicense(sessionId) {
    if (!LICENSE_API_URL || typeof fetch !== "function") return Promise.resolve();
    els["pro-message"].textContent = "ご購入を確認しています…";
    return fetch(LICENSE_API_URL + "?session_id=" + encodeURIComponent(sessionId),
      { method: "GET", credentials: "omit", cache: "no-store" })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { status: res.status, body: body };
        });
      })
      .then(function (r) {
        var license = r.body && r.body.license;
        if (r.status === 200 && typeof license === "string") {
          return verifyLicense(license).then(function (ok) {
            if (!ok) throw new Error("invalid");
            activateLicense(license);
            els["pro-message"].textContent = "";
          });
        }
        if (r.status === 400 && r.body && r.body.error === "bad_session_id") {
          // 形式が壊れた session_id は、何度問い合わせても通らないので捨てる。
          state.pendingSession = null;
          saveState();
          els["pro-message"].textContent =
            "お支払いを確認できませんでした。決済が完了しているのにこの表示が出る場合は、お問い合わせください。";
          return;
        }
        if (r.status === 402 || r.status === 404) {
          // 支払いの反映待ちや設定の誤りもあり得るので、session_id は捨てずに次の起動で再確認する。
          els["pro-message"].textContent =
            "お支払いをまだ確認できていません。決済が完了していれば、しばらくしてページを再読み込みすると有効になります。続く場合はお問い合わせください。";
          return;
        }
        throw new Error("retry");
      })
      .catch(function () {
        els["pro-message"].textContent =
          "ご購入の確認に失敗しました（通信エラー）。ページを再読み込みすると、もう一度確認します。";
      });
  }

  // 自由枠の現在の登録上限（無料版 / Pro）。
  function customLimit() {
    return state.pro ? PRO_CUSTOM_LIMIT : FREE_CUSTOM_LIMIT;
  }

  // ---------- 状態の初期化 ----------
  var state = loadState();

  // 参照先の食品がもう無い記録（自由枠を消した等）は取り除く。
  state.entries = state.entries.filter(function (e) { return !!findFood(e.foodId); });

  // 日付が変わっていたら、前日分を過去の記録へ移して今日を空にする。
  (function rollOverIfNeeded() {
    var today = todayString();
    if (state.day === today) { saveState(); return; }
    if (state.entries.length > 0) {
      state.history[state.day] = totals();
    }
    state.entries = [];
    state.day = today;
    trimHistory();
    saveState();
  })();

  // ---------- 描画 ----------
  var els = {};
  ["total-kcal", "total-p", "total-f", "total-c",
   "bar-kcal", "bar-p", "bar-f", "bar-c",
   "target-kcal-label", "target-p-label", "target-f-label", "target-c-label",
   "pct-kcal", "pct-p", "pct-f", "pct-c",
   "food-select", "grams-input", "entry-list", "empty-message",
   "custom-list", "custom-limit-message", "pro-message",
   "history-list", "history-empty",
   "pro-locked", "pro-active", "chart-locked", "chart-area",
   "chart-plot", "chart-labels", "chart-empty",
   "today-csv-button", "auto-calc-locked", "auto-calc-area", "auto-calc-result",
   "buy-area", "buy-link", "buy-pending", "license-area", "license-key"
  ].forEach(function (id) { els[id] = document.getElementById(id); });

  function renderSummary() {
    var t = totals();
    var targets = state.targets;
    els["total-kcal"].textContent = fmt(t.kcal, 0);
    els["total-p"].textContent = fmt(t.p, 1);
    els["total-f"].textContent = fmt(t.f, 1);
    els["total-c"].textContent = fmt(t.c, 1);
    renderBar("kcal", t.kcal, targets.kcal);
    renderBar("p", t.p, targets.p);
    renderBar("f", t.f, targets.f);
    renderBar("c", t.c, targets.c);
  }

  function renderBar(key, value, target) {
    // 目標が0のときは割り算せず、達成率は0%として表示する。
    var pct = target > 0 ? Math.round((value / target) * 100) : 0;
    if (!isFinite(pct) || pct < 0) pct = 0;
    els["target-" + key + "-label"].textContent = fmt(target, 0);
    els["pct-" + key].textContent = pct;
    var bar = els["bar-" + key];
    bar.style.width = Math.min(100, pct) + "%";
    bar.classList.toggle("over", pct > 100);
  }

  function renderSelect() {
    var select = els["food-select"];
    var previous = select.value;
    select.innerHTML = "";
    var foods = allFoodsForSelect();
    var categories = [];
    foods.forEach(function (food) {
      if (categories.indexOf(food.category) === -1) categories.push(food.category);
    });
    categories.forEach(function (category) {
      var group = document.createElement("optgroup");
      group.label = category;
      foods.forEach(function (food) {
        if (food.category !== category) return;
        var option = document.createElement("option");
        option.value = food.id;
        option.textContent = food.name;
        group.appendChild(option);
      });
      select.appendChild(group);
    });
    if (previous) select.value = previous;
  }

  function renderEntries() {
    var list = els["entry-list"];
    list.innerHTML = "";
    var visible = 0;
    state.entries.forEach(function (entry) {
      var food = findFood(entry.foodId);
      var v = entryValues(entry);
      if (!food || !v) return;
      visible += 1;
      var li = document.createElement("li");
      var info = document.createElement("div");
      var name = document.createElement("div");
      name.className = "entry-name";
      name.textContent = food.name;
      var detail = document.createElement("div");
      detail.className = "entry-detail";
      detail.textContent = entry.grams + "g ・ " + fmt(v.kcal, 0) + "kcal ・ P " +
        fmt(v.p, 1) + "g ・ F " + fmt(v.f, 1) + "g ・ C " + fmt(v.c, 1) + "g";
      info.appendChild(name);
      info.appendChild(detail);
      var del = document.createElement("button");
      del.type = "button";
      del.className = "entry-delete";
      del.textContent = "削除";
      del.addEventListener("click", function () {
        state.entries = state.entries.filter(function (e) { return e.id !== entry.id; });
        saveState();
        renderAll();
      });
      li.appendChild(info);
      li.appendChild(del);
      list.appendChild(li);
    });
    // 表示できる記録が無いときだけ「まだ何も追加されていません」を出す。
    els["empty-message"].classList.toggle("hidden", visible > 0);
  }

  function renderCustomFoods() {
    var list = els["custom-list"];
    list.innerHTML = "";
    state.customFoods.forEach(function (food) {
      var li = document.createElement("li");
      var info = document.createElement("div");
      var name = document.createElement("div");
      name.className = "entry-name";
      name.textContent = food.name;
      var detail = document.createElement("div");
      detail.className = "entry-detail";
      detail.textContent = "100gあたり " + fmt(food.kcal, 0) + "kcal ・ P " +
        fmt(food.p, 1) + "g ・ F " + fmt(food.f, 1) + "g ・ C " + fmt(food.c, 1) + "g";
      info.appendChild(name);
      info.appendChild(detail);
      var del = document.createElement("button");
      del.type = "button";
      del.className = "entry-delete";
      del.textContent = "削除";
      del.addEventListener("click", function () {
        state.customFoods = state.customFoods.filter(function (f) { return f.id !== food.id; });
        // この食品を使っていた今日の記録も一緒に取り除く（合計が合わなくなるため）。
        state.entries = state.entries.filter(function (e) {
          return e.foodId !== "custom:" + food.id;
        });
        saveState();
        renderAll();
      });
      li.appendChild(info);
      li.appendChild(del);
      list.appendChild(li);
    });
    var atLimit = state.customFoods.length >= customLimit();
    els["custom-limit-message"].textContent = state.pro
      ? "登録上限（" + PRO_CUSTOM_LIMIT + "件）に達しました。"
      : "無料版の登録上限（" + FREE_CUSTOM_LIMIT + "件）に達しました。Proでは" +
        PRO_CUSTOM_LIMIT + "件まで登録できます。";
    els["custom-limit-message"].classList.toggle("hidden", !atLimit);
  }

  function renderTargets() {
    document.getElementById("target-kcal").value = state.targets.kcal;
    document.getElementById("target-p").value = state.targets.p;
    document.getElementById("target-f").value = state.targets.f;
    document.getElementById("target-c").value = state.targets.c;
  }

  function renderHistory() {
    var list = els["history-list"];
    if (!list) return;
    list.innerHTML = "";
    var dates = Object.keys(state.history).sort().reverse()
      .slice(0, HISTORY_DAYS_TO_SHOW);
    if (els["history-empty"]) {
      els["history-empty"].classList.toggle("hidden", dates.length > 0);
    }
    dates.forEach(function (date) {
      var v = state.history[date];
      var li = document.createElement("li");
      var info = document.createElement("div");
      var name = document.createElement("div");
      name.className = "entry-name";
      name.textContent = formatDateLabel(date);
      var detail = document.createElement("div");
      detail.className = "entry-detail";
      detail.textContent = fmt(v.kcal, 0) + "kcal ・ P " + fmt(v.p, 1) +
        "g ・ F " + fmt(v.f, 1) + "g ・ C " + fmt(v.c, 1) + "g";
      info.appendChild(name);
      info.appendChild(detail);
      li.appendChild(info);
      list.appendChild(li);
    });
  }

  function renderChart() {
    var locked = els["chart-locked"];
    var area = els["chart-area"];
    if (!locked || !area) return;
    locked.classList.toggle("hidden", state.pro);
    area.classList.toggle("hidden", !state.pro);
    if (!state.pro) return;
    var data = buildChartData(CHART_DAYS);
    var hasData = data.some(function (d) { return d.kcal > 0 || d.p > 0 || d.f > 0 || d.c > 0; });
    var plot = els["chart-plot"];
    var labels = els["chart-labels"];
    plot.innerHTML = "";
    labels.innerHTML = "";
    els["chart-empty"].classList.toggle("hidden", hasData);
    plot.classList.toggle("hidden", !hasData);
    labels.classList.toggle("hidden", !hasData);
    if (!hasData) return;
    var max = state.targets.kcal > 0 ? state.targets.kcal : 0;
    data.forEach(function (d) { if (d.kcal > max) max = d.kcal; });
    if (max <= 0) max = 1;
    data.forEach(function (d) {
      var col = document.createElement("div");
      col.className = "chart-col";
      var bar = document.createElement("div");
      bar.className = "chart-bar" + (d.isToday ? " today" : "");
      bar.style.height = Math.round((d.kcal / max) * 100) + "%";
      bar.title = d.label + "：" + fmt(d.kcal, 0) + "kcal";
      col.appendChild(bar);
      plot.appendChild(col);
      var label = document.createElement("span");
      label.textContent = d.label;
      labels.appendChild(label);
    });
    if (state.targets.kcal > 0) {
      var line = document.createElement("div");
      line.className = "chart-target-line";
      line.style.bottom = Math.round((state.targets.kcal / max) * 100) + "%";
      plot.appendChild(line);
    }
  }

  function renderPro() {
    if (els["pro-locked"]) els["pro-locked"].classList.toggle("hidden", state.pro);
    if (els["pro-active"]) els["pro-active"].classList.toggle("hidden", !state.pro);
    if (els["today-csv-button"]) {
      els["today-csv-button"].classList.toggle("hidden", !state.pro);
    }
    if (els["auto-calc-locked"]) {
      els["auto-calc-locked"].classList.toggle("hidden", state.pro);
    }
    if (els["auto-calc-area"]) {
      els["auto-calc-area"].classList.toggle("hidden", !state.pro);
    }
    if (els["buy-area"]) els["buy-area"].classList.toggle("hidden", !PURCHASE_READY);
    if (els["buy-pending"]) els["buy-pending"].classList.toggle("hidden", PURCHASE_READY);
    if (els["buy-link"] && PURCHASE_READY) els["buy-link"].href = PAYMENT_LINK_URL;
    if (els["license-area"]) els["license-area"].classList.toggle("hidden", !state.license);
    if (els["license-key"]) els["license-key"].value = state.license || "";
  }

  // 自動計算フォームに、保存済みプロフィールを反映する。
  function renderProfile() {
    if (!state.profile) return;
    var p = state.profile;
    document.getElementById("auto-sex").value = p.sex;
    document.getElementById("auto-age").value = p.age;
    document.getElementById("auto-height").value = p.height;
    document.getElementById("auto-weight").value = p.weight;
    document.getElementById("auto-activity").value = String(p.activity);
    document.getElementById("auto-goal").value = p.goal;
  }

  function renderAll() {
    renderSummary();
    renderSelect();
    renderEntries();
    renderCustomFoods();
    renderTargets();
    renderHistory();
    renderChart();
    renderPro();
    renderProfile();
  }

  // ---------- イベント ----------
  document.getElementById("add-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var foodId = els["food-select"].value;
    var grams = parseFloat(els["grams-input"].value);
    // 空・NaN・0以下・上限超えの量は受け付けない。
    if (!foodId || !findFood(foodId)) return;
    if (!isFinite(grams) || grams <= 0 || grams > MAX_GRAMS) return;
    state.entries.push({
      id: nextId("e"),
      foodId: foodId,
      grams: grams
    });
    saveState();
    renderSummary();
    renderEntries();
    els["grams-input"].value = "100";
  });

  document.getElementById("reset-button").addEventListener("click", function () {
    if (state.entries.length === 0) return;
    if (!window.confirm("今日の記録をすべて消しますか？")) return;
    state.entries = [];
    saveState();
    renderSummary();
    renderEntries();
  });

  document.getElementById("custom-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (state.customFoods.length >= customLimit()) {
      renderCustomFoods();
      els["custom-limit-message"].classList.remove("hidden");
      return;
    }
    var name = document.getElementById("custom-name").value.trim();
    var kcal = parseFloat(document.getElementById("custom-kcal").value);
    var p = parseFloat(document.getElementById("custom-p").value);
    var f = parseFloat(document.getElementById("custom-f").value);
    var c = parseFloat(document.getElementById("custom-c").value);
    function inRange(v, max) { return isFinite(v) && v >= 0 && v <= max; }
    // フォームの入力範囲（kcal〜1000、PFC〜100）に収まらない値は受け付けない。
    if (!name || !inRange(kcal, 1000) || !inRange(p, 100) ||
        !inRange(f, 100) || !inRange(c, 100)) return;
    state.customFoods.push({
      id: nextId("c"),
      name: name, kcal: kcal, p: p, f: f, c: c
    });
    saveState();
    renderAll();
    e.target.reset();
  });

  ["kcal", "p", "f", "c"].forEach(function (key) {
    document.getElementById("target-" + key).addEventListener("change", function (e) {
      var v = parseFloat(e.target.value);
      if (!isFinite(v) || v < 0) {
        e.target.value = state.targets[key];
        return;
      }
      state.targets[key] = Math.min(v, MAX_TARGET);
      saveState();
      renderSummary();
    });
  });

  document.getElementById("pro-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var code = document.getElementById("pro-code").value;
    // "PFC1." で始まるものは、購入で受け取ったライセンスキーとして確かめる。
    if (/^PFC1\./.test(String(code).trim())) {
      var license = String(code).trim();
      verifyLicense(license).then(function (ok) {
        if (ok) {
          els["pro-message"].textContent = "";
          activateLicense(license);
        } else {
          els["pro-message"].textContent = "ライセンスキーが正しくありません。コピーしたキー全体を貼り付けてください。";
        }
      });
      return;
    }
    checkProCode(code).then(function (result) {
      if (result === "empty") return;
      if (result === "ok") {
        state.pro = true;
        saveState();
        renderAll();
      } else {
        els["pro-message"].textContent = "コードが正しくありません。もう一度お確かめください。";
      }
    });
  });

  document.getElementById("pro-disable-button").addEventListener("click", function () {
    var msg = state.license
      ? "Proをやめて、無料版に戻しますか？（記録データは消えません）\nライセンスキーも消えるので、再び使うときのためにキーを控えておいてください。"
      : "Proをやめて、無料版に戻しますか？（記録データは消えません）";
    if (!window.confirm(msg)) return;
    state.pro = false;
    state.license = null;
    saveState();
    renderAll();
  });

  document.getElementById("auto-calc-button").addEventListener("click", function () {
    var profile = sanitizeProfile({
      sex: document.getElementById("auto-sex").value,
      age: parseFloat(document.getElementById("auto-age").value),
      height: parseFloat(document.getElementById("auto-height").value),
      weight: parseFloat(document.getElementById("auto-weight").value),
      activity: parseFloat(document.getElementById("auto-activity").value),
      goal: document.getElementById("auto-goal").value
    });
    if (!profile) {
      els["auto-calc-result"].textContent =
        "入力を確認してください（年齢10〜100、身長100〜250cm、体重20〜300kg）。";
      return;
    }
    var r = computeAutoTargets(profile);
    state.profile = profile;
    state.targets = { kcal: r.kcal, p: r.p, f: r.f, c: r.c };
    saveState();
    renderSummary();
    renderTargets();
    renderChart();
    els["auto-calc-result"].textContent =
      "基礎代謝 約" + fmt(r.bmr, 0) + "kcal ・ 1日の消費目安 約" + fmt(r.tdee, 0) +
      "kcal → 目標 " + fmt(r.kcal, 0) + "kcal（P " + fmt(r.p, 0) + "g ・ F " +
      fmt(r.f, 0) + "g ・ C " + fmt(r.c, 0) + "g）を設定しました。";
  });

  document.getElementById("today-csv-button").addEventListener("click", function () {
    if (!state.pro) return;
    downloadCsv("pfc-" + todayString() + ".csv", buildTodayCsv());
  });

  document.getElementById("history-csv-button").addEventListener("click", function () {
    if (!state.pro) return;
    downloadCsv("pfc-history.csv", buildHistoryCsv());
  });

  var copyButton = document.getElementById("license-copy-button");
  if (copyButton) {
    copyButton.addEventListener("click", function () {
      if (!state.license) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(state.license).then(function () {
          copyButton.textContent = "コピーしました";
        }, function () {
          els["license-key"].select();
        });
      } else {
        els["license-key"].select();
      }
    });
  }

  renderAll();

  // Stripe から ?session_id=cs_... 付きで戻ってきたら、URL から消してから確認する
  // (ブラウザ履歴やリンク先への Referer に残さないため)。
  (function handleReturnFromCheckout() {
    var sessionId = null;
    try {
      var params = new URLSearchParams(window.location.search);
      sessionId = params.get("session_id");
      if (sessionId !== null && window.history && window.history.replaceState) {
        params.delete("session_id");
        var rest = params.toString();
        window.history.replaceState(null, "",
          window.location.pathname + (rest ? "?" + rest : "") + window.location.hash);
      }
    } catch (e) {
      sessionId = null;
    }
    if (sessionId && SESSION_ID_RE.test(sessionId)) {
      if (state.license) {
        els["pro-message"].textContent =
          "この端末ではすでに購入済みのライセンスキーで Pro が有効です。";
      } else {
        state.pendingSession = sessionId;
        saveState();
      }
    }
    if (state.pendingSession && !state.license) claimLicense(state.pendingSession);
  })();
})();
