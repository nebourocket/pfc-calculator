// PFCかんたん計算ツール
// 入力データは localStorage にのみ保存する（記録は外部に送らない）。
// 外部と通信するのは、Pro を購入した直後にライセンスキーを受け取るときだけ。
// 日付が変わると、前日までの記録は「過去の記録」に移り、今日の記録は空になる。
(function () {
  "use strict";

  // 画面に出す文言は i18n.js（日本語・English・中文）を通す。i18n.js が無い環境では日本語のまま出す。
  // 文言は「文ごと」のひな形で渡し、数字などは {名前} の穴に入れる。
  var I18N = window.PFC_I18N || null;
  function t(s, v) {
    if (I18N) return I18N.t(s, v);
    return String(s).replace(/\{(\w+)\}/g, function (m, k) {
      return v && Object.prototype.hasOwnProperty.call(v, k) ? String(v[k]) : m;
    });
  }
  // 食品名の表示用。自分の食品は、登録した名前のまま出す。
  function foodLabel(food) { return I18N ? I18N.foodName(food) : food.name; }

  var STORAGE_KEY = "pfc-calculator-v1";
  var WELCOME_KEY = "pfc-calculator-welcome"; // 「はじめに」を閉じたかどうか（記録とは別に覚える）
  var FREE_CUSTOM_LIMIT = 5;         // 無料版の自由枠の登録上限
  var PRO_CUSTOM_LIMIT = 200;        // Pro の自由枠の登録上限（安全上限）
  var MAX_GRAMS = 5000;              // 1回の追加で受け付ける量の上限（g）
  var MAX_TARGET = 100000;           // 目標値の上限
  var HISTORY_DAYS_TO_SHOW = 7;      // 過去の記録の表示日数
  var HISTORY_MAX_DAYS = 90;         // 過去の記録の保存日数（Pro は期限なし）
  var CHART_DAYS = 30;               // カロリーのグラフに表示する日数（1か月）
  var CHART_LABEL_EVERY = 5;         // グラフの日付は、今日から数えて何日おきに出すか
  var BODY_MAX_DAYS = 365;           // 体重・筋トレ・スコアの保存日数（Pro は期限なし）
  var STORAGE_WARN_CHARS = 4000000;  // 保存する文字数がこれを超えたら、バックアップを促す（ブラウザの上限はおよそ500万文字）
  var KCAL_PER_KG = 7700;            // 体脂肪 1kg あたりのエネルギー（一般的な目安）
  var TDEE_WINDOW_DAYS = 14;         // 実績から TDEE を逆算するときに見る日数
  var MIN_INTAKE_DAYS = 7;           // 逆算に必要な、食事を記録した日数
  var MIN_WEIGH_INS = 4;             // 逆算に必要な、体重を記録した回数
  var MAX_WORKOUT_ITEMS = 50;        // 1日に記録できる筋トレの件数
  var STREAK_MIN_SCORE = 50;         // 連続記録に数える1日のスコアの下限
  var WEIGHT_CHART_DAYS = 30;        // 体重のグラフに出す日数
  var WEEK_DAYS = 7;                 // 週のふり返りで見る日数
  var TOAST_MS = 4000;               // お知らせを出しておく時間（ミリ秒）
  var CYCLE_SHIFT = 0.1;             // トレ日に上乗せする割合（目標カロリーの10%）
  var MUSCLES = ["胸", "背中", "脚", "肩", "腕", "腹", "その他"];
  var MAX_SEARCH_RESULTS = 100;      // 食品の検索で一度に出す件数
  var MAX_RECENT = 12;               // 「最近食べたもの」に出す数
  var MAX_SAVED_FOODS = 2000;        // 検索時に読む市販品のうち、記録・セットで使っている食品の写しの上限
  var MAX_MEAL_SETS = 30;            // 登録できるセットの数
  var MAX_SET_ITEMS = 30;            // 1つのセットに入れられる食品の数

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
  // 成分表（foods.js）と市販品（off-foods.js、Open Food Facts・ODbL）をまとめて使う。
  var FOODS = (Array.isArray(window.FOODS) ? window.FOODS : [])
    .concat(Array.isArray(window.OFF_FOODS) ? window.OFF_FOODS : []);
  // 市販品の残り（off-foods-more.js、約2.4万品）は、検索したときだけ読み込んでここに足す。
  // 起動を遅くしないため。読み込みの状態は idle → loading → done（失敗したら idle に戻す）。
  var MORE_FOODS = [];
  var moreFoodsState = "idle";

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

  // 日付の文字列（YYYY-MM-DD）を UTC の日付として扱い、時差やサマータイムの影響を受けないようにする。
  function dateToUtc(dateStr) {
    var parts = dateStr.split("-");
    return Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function addDays(dateStr, n) {
    var d = new Date(dateToUtc(dateStr) + n * 86400000);
    return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
  }

  function daysBetween(fromStr, toStr) {
    return Math.round((dateToUtc(toStr) - dateToUtc(fromStr)) / 86400000);
  }

  function shortDate(dateStr) {
    var parts = dateStr.split("-");
    return Number(parts[1]) + "/" + Number(parts[2]);
  }

  function formatDateLabel(dateStr) {
    var parts = dateStr.split("-");
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var lang = I18N ? I18N.lang : "ja";
    if (lang === "en") {
      return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] + ", " +
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()] +
        " " + Number(parts[2]);
    }
    var week = (lang === "zh"
      ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
      : ["日", "月", "火", "水", "木", "金", "土"])[d.getDay()];
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

  // 検索時に読む市販品から記録した食品の写し。読み込む前に起動しても記録が消えないようにする。
  function sanitizeSavedFoods(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    var seen = {};
    list.forEach(function (f) {
      if (!f || typeof f !== "object") return;
      if (typeof f.id !== "string" || !/^off:\d{6,14}$/.test(f.id) || seen[f.id]) return;
      if (typeof f.name !== "string" || !f.name.trim()) return;
      var kcal = finiteNumber(f.kcal);
      var p = finiteNumber(f.p);
      var fat = finiteNumber(f.f);
      var c = finiteNumber(f.c);
      if (kcal === null || p === null || fat === null || c === null) return;
      if (kcal < 0 || kcal > 900 || p < 0 || p > 100 || fat < 0 || fat > 100 || c < 0 || c > 100) return;
      seen[f.id] = true;
      out.push({
        id: f.id, name: f.name.slice(0, 130), category: "市販品",
        kcal: kcal, p: p, f: fat, c: c, source: "Open Food Facts " + f.id.slice(4)
      });
    });
    return out.slice(-MAX_SAVED_FOODS);
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

  // 体重の記録：{ "YYYY-MM-DD": kg }
  function sanitizeWeights(w) {
    var out = {};
    if (!w || typeof w !== "object") return out;
    Object.keys(w).forEach(function (date) {
      var kg = finiteNumber(w[date]);
      if (isDateString(date) && kg !== null && kg >= 20 && kg <= 300) out[date] = kg;
    });
    return out;
  }

  // 種目名から部位を推測する。上から順に見て、最初に当たった部位にする（「レッグレイズ」は腹、など）。
  // 英語の種目名は小文字にして照合する。
  var MUSCLE_KEYWORDS = [
    ["脚", ["レッグカール", "レッグエクステンション", "アブダクション", "アダクション", "leg curl"]],
    ["肩", ["リバースフライ", "リアデルト", "reverse fly", "rear delt"]],
    ["腹", ["クランチ", "腹筋", "プランク", "レッグレイズ", "シットアップ", "アブ", "crunch", "plank", "sit-up", "ab "]],
    ["腕", ["トライセプス", "カール", "フレンチ", "キックバック", "プレスダウン", "スカルクラッシャー", "tricep", "curl"]],
    ["胸", ["ベンチ", "チェスト", "腕立て", "プッシュアップ", "ディップ", "フライ", "ペック", "bench", "chest", "push-up", "pushup", "dip", "fly"]],
    ["背中", ["デッド", "ロウ", "ローイング", "懸垂", "チンニング", "ラット", "プルダウン", "プルアップ", "背筋", "シュラッグ",
      "deadlift", "row", "pull", "chin", "lat ", "shrug"]],
    ["脚", ["スクワット", "レッグ", "ランジ", "カーフ", "ヒップ", "ブルガリアン", "グルート", "squat", "lunge", "leg", "calf", "hip", "glute"]],
    ["肩", ["ショルダー", "レイズ", "オーバーヘッド", "アップライト", "ミリタリー", "フェイスプル", "shoulder", "lateral", "raise", "overhead", "military"]]
  ];
  function guessMuscle(name) {
    var n = String(name).toLowerCase() + " ";
    for (var i = 0; i < MUSCLE_KEYWORDS.length; i++) {
      for (var j = 0; j < MUSCLE_KEYWORDS[i][1].length; j++) {
        if (n.indexOf(MUSCLE_KEYWORDS[i][1][j]) !== -1) return MUSCLE_KEYWORDS[i][0];
      }
    }
    return "その他";
  }

  // 筋トレの記録：{ "YYYY-MM-DD": [{ id, name, kg, reps, sets, muscle }] }
  function sanitizeWorkoutItem(x) {
    if (!x || typeof x !== "object") return null;
    var name = typeof x.name === "string" ? x.name.trim().slice(0, 40) : "";
    var kg = finiteNumber(x.kg);
    var reps = finiteNumber(x.reps);
    var sets = finiteNumber(x.sets);
    if (!name) return null;
    if (kg === null || kg < 0 || kg > 1000) return null;
    if (reps === null || reps < 1 || reps > 1000 || Math.floor(reps) !== reps) return null;
    if (sets === null || sets < 1 || sets > 100 || Math.floor(sets) !== sets) return null;
    return {
      id: typeof x.id === "string" ? x.id.slice(0, 64) : nextId("w"),
      name: name, kg: kg, reps: reps, sets: sets,
      muscle: MUSCLES.indexOf(x.muscle) !== -1 ? x.muscle : guessMuscle(name)
    };
  }

  function sanitizeWorkouts(w) {
    var out = {};
    if (!w || typeof w !== "object") return out;
    Object.keys(w).forEach(function (date) {
      if (!isDateString(date) || !Array.isArray(w[date])) return;
      var seen = {};
      var items = w[date].map(sanitizeWorkoutItem).filter(Boolean).slice(0, MAX_WORKOUT_ITEMS);
      // id が重なっていると、削除で複数件が消えてしまうので付け直す。
      items.forEach(function (item) {
        if (seen[item.id]) item.id = nextId("w");
        seen[item.id] = true;
      });
      if (items.length) out[date] = items;
    });
    return out;
  }

  // 減量・増量の計画：{ goalWeight, goalDate }
  function sanitizePlan(p) {
    if (!p || typeof p !== "object") return null;
    var goal = finiteNumber(p.goalWeight);
    if (goal === null || goal < 20 || goal > 300 || !isDateString(p.goalDate)) return null;
    return { goalWeight: goal, goalDate: p.goalDate, cycle: p.cycle === true };
  }

  // 1日のスコア：{ "YYYY-MM-DD": 0〜100 }
  function sanitizeScores(sc) {
    var out = {};
    if (!sc || typeof sc !== "object") return out;
    Object.keys(sc).forEach(function (date) {
      var v = finiteNumber(sc[date]);
      if (isDateString(date) && v !== null && v >= 0 && v <= 100) out[date] = v;
    });
    return out;
  }

  // よく食べる組み合わせ（セット）：[{ id, name, items: [{ foodId, grams }] }]
  function sanitizeMealSets(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (x) {
      if (!x || typeof x !== "object" || out.length >= MAX_MEAL_SETS) return;
      var name = typeof x.name === "string" ? x.name.trim().slice(0, 30) : "";
      if (!name || !Array.isArray(x.items)) return;
      var items = [];
      x.items.forEach(function (it) {
        if (!it || typeof it.foodId !== "string" || items.length >= MAX_SET_ITEMS) return;
        var g = finiteNumber(it.grams);
        if (g === null || g <= 0 || g > MAX_GRAMS) return;
        items.push({ foodId: it.foodId.slice(0, 80), grams: g });
      });
      if (!items.length) return;
      out.push({ id: typeof x.id === "string" ? x.id.slice(0, 64) : nextId("s"), name: name, items: items });
    });
    return out;
  }

  // 最近食べたもの：[{ foodId, grams }]（新しい順、同じ食品は1つ）
  function sanitizeRecent(list) {
    if (!Array.isArray(list)) return [];
    var out = [], seen = {};
    list.forEach(function (x) {
      if (!x || typeof x.foodId !== "string" || seen[x.foodId] || out.length >= MAX_RECENT) return;
      var g = finiteNumber(x.grams);
      if (g === null || g <= 0 || g > MAX_GRAMS) return;
      seen[x.foodId] = true;
      out.push({ foodId: x.foodId.slice(0, 80), grams: g });
    });
    return out;
  }

  // 前に記録した日の食べたもの：{ date, entries }（日付が変わるときに残す）
  function sanitizeLastDay(x) {
    if (!x || typeof x !== "object" || !isDateString(x.date)) return null;
    var entries = sanitizeEntries(x.entries);
    return entries.length ? { date: x.date, entries: entries } : null;
  }

  function rememberRecent(foodId, grams) {
    state.recentFoods = [{ foodId: foodId, grams: grams }]
      .concat(state.recentFoods.filter(function (x) { return x.foodId !== foodId; }))
      .slice(0, MAX_RECENT);
  }

  // 保存データ（またはバックアップ）を、使える形に検証して返す。
  function sanitizeState(parsed) {
    return {
      entries: sanitizeEntries(parsed.entries),
      customFoods: sanitizeCustomFoods(parsed.customFoods),
      savedFoods: sanitizeSavedFoods(parsed.savedFoods),
      targets: sanitizeTargets(parsed.targets),
      pro: parsed.pro === true,
      day: isDateString(parsed.day) ? parsed.day : todayString(),
      history: sanitizeHistory(parsed.history),
      profile: sanitizeProfile(parsed.profile),
      license: LICENSE_RE.test(String(parsed.license)) ? parsed.license : null,
      pendingSession: SESSION_ID_RE.test(String(parsed.pendingSession)) ? parsed.pendingSession : null,
      weights: sanitizeWeights(parsed.weights),
      workouts: sanitizeWorkouts(parsed.workouts),
      plan: sanitizePlan(parsed.plan),
      scores: sanitizeScores(parsed.scores),
      mealSets: sanitizeMealSets(parsed.mealSets),
      recentFoods: sanitizeRecent(parsed.recentFoods),
      lastDay: sanitizeLastDay(parsed.lastDay),
      celebrated: isDateString(parsed.celebrated) ? parsed.celebrated : null,
      streakNoticed: isDateString(parsed.streakNoticed) ? parsed.streakNoticed : null
    };
  }

  function loadState() {
    var fallback = {
      entries: [], customFoods: [], savedFoods: [], targets: sanitizeTargets(null),
      pro: false, day: todayString(), history: {}, profile: null,
      license: null, pendingSession: null,
      weights: {}, workouts: {}, plan: null, scores: {}, mealSets: [],
      recentFoods: [], lastDay: null, celebrated: null, streakNoticed: null
    };
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return fallback;
      return sanitizeState(parsed);
    } catch (e) {
      return fallback;
    }
  }

  var storageWarned = false; // 保存の量のお知らせは、開いている間に1回だけ出す
  function saveState() {
    syncSavedFoods();
    var json = JSON.stringify(state);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch (e) {
      // 保存に失敗しても、画面の表示は続ける。保存できる量がいっぱいのときは、バックアップを促す。
      if (!storageWarned) {
        storageWarned = true;
        showToast(t("この端末に保存できる量がいっぱいで、記録を保存できませんでした。「設定」の「データのバックアップ」で書き出してください。"));
      }
      return;
    }
    if (json.length > STORAGE_WARN_CHARS && !storageWarned) {
      storageWarned = true;
      showToast(t("この端末に保存できる量の上限が近づいています。「設定」の「データのバックアップ」で書き出しておいてください。"));
    }
  }

  function trimHistory() {
    // Pro は記録を期限なしで残す。
    if (state.pro) return;
    var dates = Object.keys(state.history).sort();
    while (dates.length > HISTORY_MAX_DAYS) {
      delete state.history[dates.shift()];
    }
    // 体重・筋トレ・スコアは、1年より古いものを消す。
    var oldest = addDays(todayString(), -BODY_MAX_DAYS);
    ["weights", "workouts", "scores"].forEach(function (key) {
      Object.keys(state[key]).forEach(function (date) {
        if (date < oldest) delete state[key][date];
      });
    });
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
    for (var k = 0; k < MORE_FOODS.length; k++) {
      if (MORE_FOODS[k].id === id) return MORE_FOODS[k];
    }
    for (var m = 0; m < state.savedFoods.length; m++) {
      if (state.savedFoods[m].id === id) return state.savedFoods[m];
    }
    return null;
  }

  // 検索時に読む市販品のうち、今日の記録・最近食べたもの・セット・前日の記録で使っているものだけ、
  // 数値を写して覚えておく（保存のたびに作り直すので、使わなくなったものは消える）。
  var BASE_FOOD_IDS = null;
  function syncSavedFoods() {
    var ids = {};
    var mark = function (x) { if (x && typeof x.foodId === "string") ids[x.foodId] = true; };
    state.entries.forEach(mark);
    state.recentFoods.forEach(mark);
    state.mealSets.forEach(function (set) { set.items.forEach(mark); });
    if (state.lastDay) state.lastDay.entries.forEach(mark);
    if (!BASE_FOOD_IDS) {
      BASE_FOOD_IDS = {};
      FOODS.forEach(function (f) { BASE_FOOD_IDS[f.id] = true; });
    }
    var out = [];
    Object.keys(ids).forEach(function (id) {
      if (id.indexOf("off:") !== 0 || BASE_FOOD_IDS[id]) return;
      var food = findFood(id);
      if (food) out.push(food);
    });
    state.savedFoods = sanitizeSavedFoods(out);
  }

  // 市販品の残りを読み込む。script-src 'self' の範囲なので CSP は変えない。
  // 一度読めば Service Worker が保存するので、次からはオフラインでも探せる。
  function loadMoreFoods() {
    if (moreFoodsState !== "idle" || !document.head) return;
    moreFoodsState = "loading";
    var script = document.createElement("script");
    script.src = "off-foods-more.js";
    script.onload = function () {
      var rows = window.OFF_FOODS_MORE;
      // 中身が読めなかった（オフラインで別のページが返った等）ときは、失敗として扱う。
      if (!Array.isArray(rows)) { script.onerror(); return; }
      MORE_FOODS = rows.filter(function (r) { return Array.isArray(r) && r.length === 6; })
        .map(function (r) {
          return {
            id: "off:" + r[0], name: r[1], category: "市販品",
            kcal: r[2], p: r[3], f: r[4], c: r[5], source: "Open Food Facts " + r[0]
          };
        });
      window.OFF_FOODS_MORE = null;
      moreFoodsState = "done";
      renderSelect();
    };
    script.onerror = function () {
      // 通信できなかったときは、次に検索したときにもう一度試す
      // （この場で描き直すときに読み直さないよう、描き終えてから idle に戻す）。
      if (script.parentNode) script.parentNode.removeChild(script);
      moreFoodsState = "failed";
      renderSelect();
      moreFoodsState = "idle";
    };
    document.head.appendChild(script);
  }

  function allFoodsForSelect() {
    var list = FOODS.concat(MORE_FOODS);
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

  // ---------- Pro：体重の推移と、実績からの必要カロリー ----------
  function bmrFor(profile, weight) {
    return profile.sex === "female"
      ? 10 * weight + 6.25 * profile.height - 5 * profile.age - 161
      : 10 * weight + 6.25 * profile.height - 5 * profile.age + 5;
  }

  // 最小二乗法の傾き（y の x あたりの変化）。点が2つ未満なら null。
  function regressionSlope(points) {
    if (points.length < 2) return null;
    var n = points.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    points.forEach(function (pt) { sx += pt.x; sy += pt.y; sxx += pt.x * pt.x; sxy += pt.x * pt.y; });
    var den = n * sxx - sx * sx;
    return den === 0 ? null : (n * sxy - sx * sy) / den;
  }

  // 体重の推移。avg7＝直近7日（今日を含む）の平均、weeklyChange＝直近14日の傾き（kg/週）。
  function weightTrend(today) {
    var last7 = [], points = [], latest = null;
    Object.keys(state.weights).sort().forEach(function (date) {
      var age = daysBetween(date, today);
      if (age < 0) return;
      latest = { date: date, kg: state.weights[date] };
      if (age < 7) last7.push(state.weights[date]);
      if (age < TDEE_WINDOW_DAYS) points.push({ x: -age, y: state.weights[date], date: date });
    });
    var avg7 = last7.length
      ? last7.reduce(function (a, b) { return a + b; }, 0) / last7.length : null;
    var span = points.length ? daysBetween(points[0].date, points[points.length - 1].date) : 0;
    var slope = regressionSlope(points);
    return {
      latest: latest, avg7: avg7, weighIns: points.length, span: span,
      slopePerDay: slope, weeklyChange: slope === null ? null : slope * 7
    };
  }

  // 目標体重と期限から、今日の目標カロリーと PFC を決める。
  // TDEE は「直近14日の平均摂取量 − 体重の変化×7700kcal」で逆算する。
  // データが足りない間は、Mifflin-St Jeor 式 × 活動レベルで代わりに出す。
  // 減量の速さは体重の1%/週、増量は0.5%/週を上限にし、目標カロリーは基礎代謝を下回らない。
  function computeBodyPlan(today) {
    var profile = state.profile;
    if (!profile) return { ready: false, reason: "profile" };
    var trend = weightTrend(today);
    var weight = trend.avg7 !== null ? trend.avg7 : (trend.latest ? trend.latest.kg : profile.weight);
    var bmr = bmrFor(profile, weight);

    // 基礎代謝の半分に満たない日は、記録の付け忘れとみなして除く（消費を低く見積もらないため）。
    var intake = [];
    for (var i = 1; i <= TDEE_WINDOW_DAYS; i++) {
      var h = state.history[addDays(today, -i)];
      if (h && h.kcal >= bmr * 0.5) intake.push(h.kcal);
    }
    var avgIntake = intake.length
      ? intake.reduce(function (a, b) { return a + b; }, 0) / intake.length : null;

    var tdee, source;
    if (intake.length >= MIN_INTAKE_DAYS && trend.weighIns >= MIN_WEIGH_INS &&
        trend.span >= 7 && trend.slopePerDay !== null) {
      tdee = avgIntake - trend.slopePerDay * KCAL_PER_KG;
      // 記録の抜けなどで極端な値になったときは、ありうる範囲に収める。
      tdee = Math.min(Math.max(tdee, bmr * 1.1), bmr * 2.5);
      source = "actual";
    } else {
      tdee = bmr * profile.activity;
      source = "estimate";
    }

    var result = {
      ready: true, weight: weight, bmr: bmr, tdee: tdee, source: source,
      intakeDays: intake.length, avgIntake: avgIntake, trend: trend,
      plannedWeekly: 0, daysLeft: null, limited: false, floored: false
    };
    var rate = 0;
    if (state.plan) {
      var daysLeft = daysBetween(today, state.plan.goalDate);
      result.daysLeft = daysLeft;
      var diff = state.plan.goalWeight - weight;
      if (daysLeft > 0 && Math.abs(diff) >= 0.2) {
        rate = diff / daysLeft;
        var maxLoss = -weight * 0.01 / 7, maxGain = weight * 0.005 / 7;
        if (rate < maxLoss) { rate = maxLoss; result.limited = true; }
        if (rate > maxGain) { rate = maxGain; result.limited = true; }
      }
    }
    result.plannedWeekly = rate * 7;
    var kcal = tdee + rate * KCAL_PER_KG;
    if (kcal < bmr) { kcal = bmr; result.floored = true; }
    result.baseKcal = Math.round(kcal);
    result.p = Math.round(weight * 2);
    result.f = Math.round(result.baseKcal * 0.25 / 9);

    // トレ日と休養日でカロリーを変える。トレ日は +10%、休養日はその分を割り振って減らし、
    // 1週間の平均は計画どおりにする（運動の消費は TDEE に入っているので、二重には数えない）。
    // 増減はすべて炭水化物で行う。
    result.dayType = null;
    result.cycleDays = null;
    var dayKcal = result.baseKcal;
    if (state.plan && state.plan.cycle) {
      var n = trainingDaysPerWeek(today);
      result.cycleDays = n;
      // 休養日が基礎代謝を下回らない範囲に、増減の幅を小さくする（週の平均を崩さないため）。
      var shift = n > 0 && n < 7
        ? Math.min(result.baseKcal * CYCLE_SHIFT, (result.baseKcal - bmr) * (7 - n) / n) : 0;
      result.cycleShift = shift;
      if (shift >= 1) {
        var trained = !!(state.workouts[today] && state.workouts[today].length);
        result.dayType = trained ? "training" : "rest";
        dayKcal = trained ? result.baseKcal + shift : result.baseKcal - shift * n / (7 - n);
      }
    }
    result.kcal = Math.round(dayKcal);
    result.c = Math.max(0, Math.round((result.kcal - result.p * 4 - result.f * 9) / 4));
    return result;
  }

  // 直近4週間（今日を除く）に筋トレを記録した日数から、週あたりのトレ日数を出す。
  function trainingDaysPerWeek(today) {
    var days = 0;
    for (var i = 1; i <= 28; i++) {
      var w = state.workouts[addDays(today, -i)];
      if (w && w.length) days += 1;
    }
    return Math.round(days / 4);
  }

  // 直近7日（今日を含む）の、部位ごとのセット数。
  function weeklyVolume(today) {
    var out = {};
    MUSCLES.forEach(function (m) { out[m] = 0; });
    for (var i = 0; i < 7; i++) {
      (state.workouts[addDays(today, -i)] || []).forEach(function (item) { out[item.muscle] += item.sets; });
    }
    return out;
  }

  // 体重のグラフ用。直近 days 日の体重と7日平均、表示する縦軸の範囲。
  function buildWeightChart(today, days) {
    var points = [], avg = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = addDays(today, -i);
      var x = days - 1 - i;
      if (state.weights[d] !== undefined) points.push({ x: x, y: state.weights[d], date: d });
      var win = [];
      for (var k = 0; k < 7; k++) {
        var v = state.weights[addDays(d, -k)];
        if (v !== undefined) win.push(v);
      }
      if (win.length && state.weights[d] !== undefined) {
        avg.push({ x: x, y: win.reduce(function (a, b) { return a + b; }, 0) / win.length });
      }
    }
    var ys = points.map(function (p) { return p.y; });
    var goal = state.plan ? state.plan.goalWeight : null;
    if (goal !== null && ys.length) ys.push(goal);
    var yMin = ys.length ? Math.floor(Math.min.apply(null, ys) - 0.5) : 0;
    var yMax = ys.length ? Math.ceil(Math.max.apply(null, ys) + 0.5) : 1;
    return { days: days, points: points, avg: avg, goal: goal, yMin: yMin, yMax: yMax };
  }

  // 計画があれば、今日の目標を計画から自動で決める。
  function applyPlanTargets() {
    if (!state.pro || !state.plan) return;
    var r = computeBodyPlan(todayString());
    if (!r.ready) return;
    state.targets = { kcal: r.kcal, p: r.p, f: r.f, c: r.c };
  }

  // ---------- Pro：筋トレ ----------
  function exerciseKey(name) { return String(name).trim().toLowerCase(); }

  // 推定1RM（Epley 式）。1回なら重量そのもの。
  function estimated1RM(item) {
    return item.reps === 1 ? item.kg : item.kg * (1 + item.reps / 30);
  }

  // date より前（同じ日なら index より前）の、その種目の推定1RMの最高値。記録が無ければ null。
  function previousBest(name, date, index) {
    var key = exerciseKey(name), best = null;
    Object.keys(state.workouts).forEach(function (d) {
      if (d > date) return;
      state.workouts[d].forEach(function (item, i) {
        if (d === date && i >= index) return;
        if (exerciseKey(item.name) !== key) return;
        var v = estimated1RM(item);
        if (best === null || v > best) best = v;
      });
    });
    return best;
  }

  // date より前で、最後にその種目をやった日と、その日のいちばん重いセット。
  function previousSession(name, date) {
    var key = exerciseKey(name);
    var dates = Object.keys(state.workouts).filter(function (d) { return d < date; }).sort().reverse();
    for (var i = 0; i < dates.length; i++) {
      var items = state.workouts[dates[i]].filter(function (x) { return exerciseKey(x.name) === key; });
      if (items.length) {
        items.sort(function (a, b) { return b.kg - a.kg || b.reps - a.reps; });
        return { date: dates[i], item: items[0] };
      }
    }
    return null;
  }

  function exerciseNames() {
    var seen = {}, names = [];
    Object.keys(state.workouts).sort().reverse().forEach(function (d) {
      state.workouts[d].forEach(function (item) {
        var key = exerciseKey(item.name);
        if (!seen[key]) { seen[key] = true; names.push(item.name); }
      });
    });
    return names;
  }

  // ---------- Pro：スコアと連続記録 ----------
  // 1日100点満点。食事の記録20・カロリーが目標の±10%以内30・たんぱく質が目標の90%以上20・
  // 体重の記録15・筋トレの記録15。
  function dayScore(t, targets, hasWeight, hasWorkout) {
    var items = [
      { label: "食事を記録した", short: "食事", pts: 20, got: t.kcal > 0 },
      { label: "カロリーが目標の±10%以内", short: "カロリー±10%", pts: 30,
        got: t.kcal > 0 && targets.kcal > 0 && Math.abs(t.kcal - targets.kcal) <= targets.kcal * 0.1 },
      { label: "たんぱく質が目標の90%以上", short: "たんぱく質90%", pts: 20,
        got: targets.p > 0 && t.p >= targets.p * 0.9 },
      { label: "体重を記録した", short: "体重", pts: 15, got: hasWeight },
      { label: "筋トレを記録した", short: "筋トレ", pts: 15, got: hasWorkout }
    ];
    var total = 0;
    items.forEach(function (x) { if (x.got) total += x.pts; });
    return { total: total, items: items };
  }

  function todayScore() {
    var today = todayString();
    return dayScore(totals(), state.targets, state.weights[today] !== undefined,
      !!(state.workouts[today] && state.workouts[today].length));
  }

  // 連続記録：スコアが50点以上の日が何日続いているか。今日がまだ50点未満なら、昨日までで数える。
  function streakInfo(today, todayTotal) {
    var scores = {};
    Object.keys(state.scores).forEach(function (d) { scores[d] = state.scores[d]; });
    scores[today] = todayTotal;
    var current = 0;
    var d = todayTotal >= STREAK_MIN_SCORE ? today : addDays(today, -1);
    while ((scores[d] || 0) >= STREAK_MIN_SCORE) { current += 1; d = addDays(d, -1); }
    var best = 0, run = 0, prev = null, sum = 0;
    Object.keys(scores).sort().forEach(function (date) {
      sum += scores[date];
      if (scores[date] >= STREAK_MIN_SCORE) {
        run = (prev !== null && daysBetween(prev, date) === 1) ? run + 1 : 1;
        prev = date;
        if (run > best) best = run;
      } else {
        run = 0; prev = null;
      }
    });
    return { current: current, best: best, total: sum };
  }

  // ---------- また開きたくなる仕掛け（無料）：記録の連続・今日のチェック・週のふり返り ----------
  // 食事を記録した日（過去の記録に残った日と、今日すでに食べたものがあれば今日）。
  function loggedDateSet() {
    var out = {};
    Object.keys(state.history).forEach(function (d) { if (state.history[d].kcal > 0) out[d] = true; });
    if (totals().kcal > 0) out[todayString()] = true;
    return out;
  }

  // 記録の連続：今日（まだなら昨日）からさかのぼって、食事を記録した日が何日続いているか。
  // best は今日を除いた、これまでの最長（今日で更新したかを知るため）。
  function logStreak() {
    var days = loggedDateSet();
    var today = todayString();
    var current = 0;
    var d = days[today] ? today : addDays(today, -1);
    while (days[d]) { current += 1; d = addDays(d, -1); }
    var bestBefore = 0, run = 0, prev = null;
    Object.keys(days).sort().forEach(function (date) {
      if (date === today) return;
      run = (prev !== null && daysBetween(prev, date) === 1) ? run + 1 : 1;
      prev = date;
      if (run > bestBefore) bestBefore = run;
    });
    return { current: current, bestBefore: bestBefore, today: !!days[today] };
  }

  function goalMet(t, targets) {
    return t.kcal > 0 && targets.kcal > 0 && Math.abs(t.kcal - targets.kcal) <= targets.kcal * 0.1 &&
      targets.p > 0 && t.p >= targets.p * 0.9;
  }

  // 次にやることを1つだけ案内する（たんぱく質は、鶏むね肉なら何gかを成分表の値から計算する）。
  function nextStep(tot, targets, items) {
    var today = todayString();
    if (!items[0].got) return { text: t("まずは今日食べたものを1つ記録してみましょう。") };
    if (targets.p > 0 && tot.p < targets.p * 0.9) {
      var need = targets.p * 0.9 - tot.p;
      var chicken = findFood("chicken-breast");
      var vars = { n: fmt(Math.ceil(need), 0) };
      if (chicken && chicken.p > 0) {
        vars.g = Math.ceil(need / chicken.p * 100 / 10) * 10;
        return { text: t("たんぱく質があと {n}g で達成です（鶏むね肉なら約{g}g）。", vars) };
      }
      return { text: t("たんぱく質があと {n}g で達成です。", vars) };
    }
    // カロリーの判定は、チェックの項目（dayScore）と同じものを使う。
    if (!items[1].got && targets.kcal > 0 && tot.kcal < targets.kcal) {
      return { text: t("目標カロリーの±10%まで、あと {n}kcal です。",
        { n: fmt(Math.max(1, Math.ceil(targets.kcal * 0.9 - tot.kcal)), 0) }) };
    }
    if (!items[1].got && targets.kcal > 0) {
      return { text: t("今日は目標を {n}kcal 超えました。明日また整えれば大丈夫です。",
        { n: fmt(Math.round(tot.kcal - targets.kcal), 0) }) };
    }
    if (state.weights[today] === undefined) return { text: t("体重も記録すると、変化が見えてきます。"), goto: true };
    if (!(state.workouts[today] && state.workouts[today].length)) {
      return { text: t("筋トレをした日は、からだタブに記録しておきましょう。"), goto: true };
    }
    return { text: t("今日のチェックはすべて達成です。また明日。") };
  }

  var toastTimer = null;
  function showToast(message) {
    var el = els && els["toast"];
    if (!el) return;
    el.textContent = message;
    el.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.add("hidden"); }, TOAST_MS);
  }

  // 前回描いたときの様子。起動直後の描画ではお祝い・お知らせを出さず、操作で変わった瞬間だけ出す。
  var lastCheckin = null;

  function renderCheckin() {
    if (!els["check-list"]) return;
    var tot = totals();
    var targets = state.targets;
    var items = todayScore().items;
    var ul = els["check-list"];
    ul.innerHTML = "";
    items.forEach(function (x) {
      var li = document.createElement("li");
      li.className = "check" + (x.got ? " done" : "");
      var tick = document.createElement("span");
      tick.className = "check-tick";
      tick.setAttribute("aria-hidden", "true");
      var label = document.createElement("span");
      label.textContent = t(x.short);
      li.setAttribute("aria-label", x.got
        ? t("{label}：達成", { label: t(x.label) }) : t("{label}：まだ", { label: t(x.label) }));
      li.appendChild(tick);
      li.appendChild(label);
      ul.appendChild(li);
    });

    var step = nextStep(tot, targets, items);
    els["check-next"].textContent = step.text;
    els["check-go"].classList.toggle("hidden", !step.goto);

    var st = logStreak();
    els["streak-badge"].classList.toggle("is-on", st.current > 0);
    els["streak-text"].textContent = "";
    if (st.current > 0) {
      var strong = document.createElement("strong");
      strong.textContent = st.current;
      els["streak-text"].appendChild(strong);
      var rest = document.createElement("span");
      rest.textContent = st.today ? t("日連続で記録") : t("日連続で記録中（今日の記録で更新）");
      els["streak-text"].appendChild(rest);
    } else {
      els["streak-text"].textContent = t("今日から記録を始めよう");
    }

    var met = goalMet(tot, targets);
    var today = todayString();
    if (!lastCheckin) {
      // 起動直後はお祝いもお知らせも出さない。
      els["celebrate"].classList.add("hidden");
      els["toast"].classList.add("hidden");
    } else {
      // 今日はじめて食事を記録した瞬間：連続日数を知らせる（自己ベストなら、そう伝える）。1日1回だけ。
      if (!lastCheckin.loggedToday && st.today && st.current >= 2 && state.streakNoticed !== today) {
        state.streakNoticed = today;
        saveState();
        showToast(st.current > st.bestBefore
          ? t("記録の連続が自己ベスト更新：{n}日", { n: st.current })
          : t("{n}日連続で記録しています", { n: st.current }));
      }
      // 食べたものを変えて目標を満たした瞬間：その日1回だけお祝いを出す
      // （目標の値を変えただけで満たしたときは出さない）。
      var intakeChanged = tot.kcal !== lastCheckin.kcal || tot.p !== lastCheckin.p;
      if (!lastCheckin.met && met && intakeChanged && state.celebrated !== today) {
        state.celebrated = today;
        saveState();
        els["celebrate"].classList.remove("hidden");
      }
    }
    // 目標から外れたら、お祝いの表示は閉じる。
    if (!met) els["celebrate"].classList.add("hidden");
    lastCheckin = { met: met, loggedToday: st.today, kcal: tot.kcal, p: tot.p };
  }

  // 週のふり返り：昨日までの7日と、その前の7日を比べる（今日は途中なので数に入れない）。
  function weekSummary(endDate) {
    var days = [];
    for (var i = WEEK_DAYS - 1; i >= 0; i--) days.push(addDays(endDate, -i));
    var logged = days.filter(function (d) { return state.history[d] && state.history[d].kcal > 0; });
    var sum = { kcal: 0, p: 0 };
    logged.forEach(function (d) { sum.kcal += state.history[d].kcal; sum.p += state.history[d].p; });
    var hits = logged.filter(function (d) { return goalMet(state.history[d], state.targets); }).length;
    return {
      days: days, logged: logged.length, hits: hits,
      kcal: logged.length ? sum.kcal / logged.length : null,
      p: logged.length ? sum.p / logged.length : null
    };
  }

  function renderWeek() {
    if (!els["week-days"]) return;
    var today = todayString();
    var yesterday = addDays(today, -1);
    var cur = weekSummary(yesterday);
    var prev = weekSummary(addDays(yesterday, -WEEK_DAYS));
    els["week-range"].textContent = t("下の数字は {from}〜{to}（昨日までの7日間）",
      { from: shortDate(cur.days[0]), to: shortDate(yesterday) });

    // 日ごとの印は、今日を含む直近7日（今日の分も途中経過として見せる）。
    var ol = els["week-days"];
    ol.innerHTML = "";
    var tot = totals();
    for (var i = WEEK_DAYS - 1; i >= 0; i--) {
      var d = addDays(today, -i);
      var v = d === today ? tot : state.history[d];
      var logged = !!(v && v.kcal > 0);
      var hit = logged && goalMet(v, state.targets);
      var li = document.createElement("li");
      li.className = "week-day" + (hit ? " hit" : logged ? " logged" : "") + (d === today ? " today" : "");
      var dot = document.createElement("span");
      dot.className = "week-dot";
      var label = document.createElement("span");
      label.className = "week-label";
      label.textContent = d === today ? t("今日") : shortDate(d);
      li.setAttribute("aria-label", hit ? t("{date}：目標内", { date: formatDateLabel(d) })
        : logged ? t("{date}：記録あり", { date: formatDateLabel(d) }) : t("{date}：記録なし", { date: formatDateLabel(d) }));
      li.appendChild(dot);
      li.appendChild(label);
      ol.appendChild(li);
    }

    var box = els["week-stats"];
    box.innerHTML = "";
    var delta = function (a, b, unit, digits) {
      if (a === null || b === null) return t("前の週：記録なし");
      var diff = a - b;
      var r = digits ? Math.round(diff * 10) / 10 : Math.round(diff);
      var val = (r > 0 ? "+" : r < 0 ? "−" : "±") + fmt(Math.abs(r), digits);
      return unit === "日" ? t("前の週 {v}日", { v: val }) : t("前の週 {v}{unit}", { v: val, unit: unit });
    };
    [
      { label: t("記録した日"), value: cur.logged, unit: t("/ 7日"), sub: [delta(cur.logged, prev.logged, "日", 0)] },
      { label: t("目標内の日"), value: cur.hits, unit: t("日"), sub: [t("カロリー±10%"), t("P 90%以上")] },
      { label: t("平均カロリー"), value: cur.kcal === null ? "—" : fmt(cur.kcal, 0), unit: "kcal",
        sub: [t("目標 {n}kcal", { n: fmt(state.targets.kcal, 0) }), delta(cur.kcal, prev.kcal, "kcal", 0)] },
      { label: t("平均たんぱく質"), value: cur.p === null ? "—" : fmt(cur.p, 1), unit: "g",
        sub: [t("目標 {n}g", { n: fmt(state.targets.p, 0) }), delta(cur.p, prev.p, "g", 1)] }
    ].forEach(function (x) {
      var div = document.createElement("div");
      div.className = "stat";
      var l = document.createElement("p");
      l.className = "stat-label";
      l.textContent = x.label;
      var v = document.createElement("p");
      v.className = "stat-value";
      var n = document.createElement("span");
      n.textContent = x.value;
      v.appendChild(n);
      var u = document.createElement("small");
      u.textContent = x.unit;
      v.appendChild(u);
      div.appendChild(l);
      div.appendChild(v);
      x.sub.forEach(function (line) {
        var sub = document.createElement("p");
        sub.className = "stat-delta";
        sub.textContent = line;
        div.appendChild(sub);
      });
      box.appendChild(div);
    });
    els["week-note"].textContent = cur.logged
      ? t("◎は目標内の日、○は記録した日です。平均は記録した日だけで出しています。")
      : t("記録した日がたまると、ここに1週間のまとめが出ます。◎は目標内の日、○は記録した日です。");
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
    var lines = [t("食品名,量(g),カロリー(kcal),たんぱく質(g),脂質(g),炭水化物(g)")];
    state.entries.forEach(function (entry) {
      var food = findFood(entry.foodId);
      var v = entryValues(entry);
      if (!food || !v) return;
      lines.push([
        csvEscape(foodLabel(food)), entry.grams,
        Math.round(v.kcal), round1(v.p), round1(v.f), round1(v.c)
      ].join(","));
    });
    var tot = totals();
    lines.push([t("合計"), "", Math.round(tot.kcal), round1(tot.p), round1(tot.f), round1(tot.c)].join(","));
    return lines.join("\r\n");
  }

  function buildHistoryCsv() {
    var lines = [t("日付,カロリー(kcal),たんぱく質(g),脂質(g),炭水化物(g),体重(kg)")];
    function weightCell(date) { return state.weights[date] !== undefined ? state.weights[date] : ""; }
    var today = todayString();
    // 食事の記録が無く、体重だけ記録した日も行にする。
    var seen = {};
    Object.keys(state.history).concat(Object.keys(state.weights)).forEach(function (d) {
      if (d !== today) seen[d] = true;
    });
    Object.keys(seen).sort().forEach(function (date) {
      var v = state.history[date];
      lines.push(v
        ? [date, Math.round(v.kcal), round1(v.p), round1(v.f), round1(v.c), weightCell(date)].join(",")
        : [date, "", "", "", "", weightCell(date)].join(","));
    });
    var tot = totals();
    lines.push([today, Math.round(tot.kcal), round1(tot.p), round1(tot.f), round1(tot.c), weightCell(today)].join(","));
    return lines.join("\r\n");
  }

  // CSV をダウンロードさせる。文字化け対策に BOM 付き UTF-8 で出す。
  // このアプリは決済情報などを扱わないため、ここで扱うのは記録データのみ。
  function downloadCsv(filename, csvText) {
    downloadFile(filename, "\uFEFF" + csvText, "text/csv;charset=utf-8");
  }

  function downloadFile(filename, text, type) {
    try {
      var blob = new Blob([text], { type: type });
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
    els["pro-message"].textContent = t("ご購入を確認しています…");
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
            t("お支払いを確認できませんでした。決済が完了しているのにこの表示が出る場合は、お問い合わせください。");
          return;
        }
        if (r.status === 402 || r.status === 404) {
          // 支払いの反映待ちや設定の誤りもあり得るので、session_id は捨てずに次の起動で再確認する。
          els["pro-message"].textContent =
            t("お支払いをまだ確認できていません。決済が完了していれば、しばらくしてページを再読み込みすると有効になります。続く場合はお問い合わせください。");
          return;
        }
        throw new Error("retry");
      })
      .catch(function () {
        els["pro-message"].textContent =
          t("ご購入の確認に失敗しました（通信エラー）。ページを再読み込みすると、もう一度確認します。");
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
  // 前日のスコアも、その日の記録と目標で確定して残す。
  function rollOverIfNeeded() {
    var today = todayString();
    if (state.day === today) { saveState(); return; }
    var t = totals();
    if (state.entries.length > 0) {
      state.history[state.day] = t;
      state.lastDay = {
        date: state.day,
        entries: state.entries.map(function (e) { return { id: e.id, foodId: e.foodId, grams: e.grams }; })
      };
    }
    var past = dayScore(t, state.targets, state.weights[state.day] !== undefined,
      !!(state.workouts[state.day] && state.workouts[state.day].length));
    if (past.total > 0) state.scores[state.day] = past.total;
    state.entries = [];
    state.day = today;
    trimHistory();
    saveState();
  }
  rollOverIfNeeded();
  applyPlanTargets();
  saveState();

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
   "buy-area", "buy-link", "buy-pending", "license-area", "license-key",
   "body-locked", "body-area", "weight-input", "weight-trend", "weight-list",
   "workout-list", "workout-empty", "exercise-names", "workout-message",
   "plan-goal", "plan-date", "plan-result", "plan-clear-button", "plan-message",
   "score-locked", "score-area", "score-total", "score-items", "score-streak",
   "score-best", "score-sum", "backup-message",
   "food-search", "food-search-count", "sets-locked", "sets-area", "set-name",
   "set-list", "set-empty", "set-message",
   "weight-chart", "weight-chart-note", "plan-cycle", "workout-muscle", "volume-list",
   "plate", "plate-p", "plate-f", "plate-c", "plate-rim", "plate-over",
   "share-p", "share-f", "share-c", "nf-kcal", "remaining-kcal", "today-label", "chart-tip",
   "body-pro-area", "recent-area", "recent-list", "copy-last-button",
   "check-list", "check-next", "check-go", "streak-badge", "streak-text", "celebrate", "toast",
   "week-range", "week-days", "week-stats", "week-note"
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
    renderPlate(t, targets);
    // スコア・今日のチェック・週のふり返りは合計と目標で決まるので、合計を描き直すたびに一緒に描き直す。
    renderScore();
    renderCheckin();
    renderWeek();
  }

  // 今日のお皿：外周は目標までのカロリー、内側は P×4・F×9・C×4 のエネルギー比。
  function renderPlate(tot, targets) {
    if (!els["plate-p"]) return;
    var pk = tot.p * 4, fk = tot.f * 9, ck = tot.c * 4;
    var sum = pk + fk + ck;
    // 外周：目標までのカロリー（1周＝目標）。超えた分は内側の朱の輪で、もう1周まで描く。
    var ratio = targets.kcal > 0 ? tot.kcal / targets.kcal : 0;
    // 長さ0の弧は、丸い線端だけが点になって見えるので隠す。
    var arc = function (el, len, rest) {
      el.setAttribute("stroke-dasharray", len.toFixed(2) + " " + rest.toFixed(2));
      el.setAttribute("visibility", len > 0.05 ? "visible" : "hidden");
    };
    arc(els["plate-rim"], Math.min(1, ratio) * 100, 100);
    arc(els["plate-over"], Math.min(1, Math.max(0, ratio - 1)) * 100, 100);
    // 内側：P・F・C のエネルギー比。12時から時計回りに P → F → C の順で、すき間を少しあける。
    var start = 0;
    [["p", pk], ["f", fk], ["c", ck]].forEach(function (x) {
      var share = sum > 0 ? x[1] / sum * 100 : 0;
      var len = share > 2 ? share - 1 : share;
      arc(els["plate-" + x[0]], len, 100 - len);
      els["plate-" + x[0]].setAttribute("stroke-dashoffset", (-start).toFixed(2));
      els["share-" + x[0]].textContent = Math.round(share);
      start += share;
    });
    els["nf-kcal"].textContent = fmt(tot.kcal, 0);
    var split = { p: fmt(pk, 0), f: fmt(fk, 0), c: fmt(ck, 0) };
    els["plate"].setAttribute("aria-label", targets.kcal > 0
      ? t("今日のお皿：{kcal}kcal（目標 {target}kcal の {pct}%）。エネルギーの内訳はたんぱく質 {p}kcal、脂質 {f}kcal、炭水化物 {c}kcal",
        { kcal: fmt(tot.kcal, 0), target: fmt(targets.kcal, 0), pct: Math.round(ratio * 100), p: split.p, f: split.f, c: split.c })
      : t("今日のお皿：{kcal}kcal。エネルギーの内訳はたんぱく質 {p}kcal、脂質 {f}kcal、炭水化物 {c}kcal",
        { kcal: fmt(tot.kcal, 0), p: split.p, f: split.f, c: split.c }));
    var rem = els["remaining-kcal"];
    if (targets.kcal > 0) {
      var diff = targets.kcal - tot.kcal;
      rem.textContent = diff >= 0 ? t("あと {n} kcal", { n: fmt(diff, 0) }) : t("{n} kcal オーバー", { n: fmt(-diff, 0) });
      rem.classList.toggle("is-over", diff < 0);
    } else {
      rem.textContent = "";
    }
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

  // ひらがな・カタカナ・大文字小文字・空白の違いを気にせず探せるようにそろえる。
  function normalizeForSearch(text) {
    return String(text).toLowerCase().replace(/[\s\u3000]/g, "")
      .replace(/[\u30a1-\u30f6]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0x60); });
  }

  // ふだんの言い方と、成分表の正式名の言い方の対応（「ごはん」で「めし」も探す、など）。
  var SEARCH_ALIASES = {
    "ごはん": ["めし"], "ご飯": ["めし"], "白米": ["精白米"], "ライス": ["めし"],
    "とり": ["にわとり", "鶏"], "鶏肉": ["にわとり"], "とりにく": ["にわとり"], "鶏": ["にわとり"],
    "ぶたにく": ["ぶた"], "豚肉": ["ぶた"], "豚": ["ぶた"],
    "ぎゅうにく": ["うし"], "牛肉": ["うし"], "牛": ["うし"],
    "たまご": ["鶏卵"], "卵": ["鶏卵"], "玉子": ["鶏卵"],
    "鮭": ["さけ"], "サーモン": ["さけ", "サーモン"], "ラーメン": ["中華めん"], "スパゲッティ": ["スパゲッティ"],
    "パスタ": ["スパゲッティ", "マカロニ"], "みかん": ["うんしゅうみかん"], "じゃがいも": ["じゃがいも"],
    "牛乳": ["普通牛乳"], "ぎゅうにゅう": ["普通牛乳"], "ミルク": ["普通牛乳"]
  };
  var NORMALIZED_ALIASES = {};
  Object.keys(SEARCH_ALIASES).forEach(function (k) {
    NORMALIZED_ALIASES[normalizeForSearch(k)] = SEARCH_ALIASES[k].map(normalizeForSearch);
  });

  // 検索用の文字列は、食品ごとに一度だけ作って使い回す（2,500品あるため）。
  var haystackCache = {};
  function haystack(food) {
    var key = food.id + "|" + food.name;
    if (!haystackCache[key]) {
      // 英語・中国語の名前があれば、それでも探せるようにする。
      var names = I18N ? I18N.foodNames(food) : [];
      haystackCache[key] = normalizeForSearch(food.name + " " + names.join(" ") + " " + (food.source || "") + " " + food.category);
    }
    return haystackCache[key];
  }

  // 空白で区切ったことばが、すべて含まれていれば当たりとする（例：「とり むね」）。
  // ことばごとに、言い換え（SEARCH_ALIASES）のどれかが含まれていてもよい。
  function foodMatches(food, words) {
    if (!words.length) return true;
    var hay = haystack(food);
    return words.every(function (w) {
      if (hay.indexOf(w) !== -1) return true;
      return (NORMALIZED_ALIASES[w] || []).some(function (a) { return hay.indexOf(a) !== -1; });
    });
  }

  function renderSelect() {
    var select = els["food-select"];
    var previous = select.value;
    select.innerHTML = "";
    var words = els["food-search"]
      ? String(els["food-search"].value || "").split(/[\s\u3000]+/).map(normalizeForSearch).filter(Boolean) : [];
    if (words.length) loadMoreFoods();
    // 何も探していないときは「よく使う食品」と自分の食品だけ。探したときは成分表の全食品から、
    // よく使う食品・自分の食品を先にして最大 MAX_SEARCH_RESULTS 件を出す。
    var all = allFoodsForSelect();
    var foods;
    if (!words.length) {
      foods = all.filter(function (food) { return food.common || food.category === "自分の食品"; });
    } else {
      var hits = all.filter(function (food) { return foodMatches(food, words); });
      var first = hits.filter(function (f) { return f.common || f.category === "自分の食品"; });
      var rest = hits.filter(function (f) { return !(f.common || f.category === "自分の食品"); });
      foods = first.concat(rest).slice(0, MAX_SEARCH_RESULTS);
      var total = hits.length;
    }
    if (els["food-search-count"]) {
      els["food-search-count"].textContent = !words.length
        ? (moreFoodsState === "done"
          ? t("よく使う食品を表示しています。ほかの食品（成分表と市販品の全{n}品）は、上の欄で探せます。",
            { n: FOODS.length + MORE_FOODS.length })
          : t("よく使う食品を表示しています。ほかの食品（成分表と市販品）は、上の欄で探せます。"))
        : moreFoodsState === "loading"
          ? (foods.length ? t("{n}件見つかりました。市販品のデータを読み込んでいます…", { n: total })
            : t("市販品のデータを読み込んでいます…"))
        : moreFoodsState === "failed"
          ? (foods.length
            ? t("{n}件見つかりました。市販品の一部を読み込めませんでした（通信を確かめて、もう一度探してください）。", { n: total })
            : t("市販品の一部を読み込めませんでした（通信を確かめて、もう一度探してください）。"))
        : !foods.length
          ? t("見つかりませんでした。別のことばで探すか、「自分の食品を登録する」から登録できます。")
          : total > MAX_SEARCH_RESULTS
            ? t("{n}件見つかりました（先頭の{max}件を表示。ことばを足すと絞り込めます）",
              { n: total, max: MAX_SEARCH_RESULTS })
            : t("{n}件見つかりました", { n: total });
    }
    var categories = [];
    foods.forEach(function (food) {
      if (categories.indexOf(food.category) === -1) categories.push(food.category);
    });
    categories.forEach(function (category) {
      var group = document.createElement("optgroup");
      group.label = t(category);
      foods.forEach(function (food) {
        if (food.category !== category) return;
        var option = document.createElement("option");
        option.value = food.id;
        option.textContent = foodLabel(food);
        group.appendChild(option);
      });
      select.appendChild(group);
    });
    var stillThere = foods.some(function (f) { return f.id === previous; });
    if (previous && stillThere) select.value = previous;
    else if (foods.length) select.value = foods[0].id;
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
      name.textContent = foodLabel(food);
      var detail = document.createElement("div");
      detail.className = "entry-detail";
      detail.textContent = entry.grams + "g ・ " + fmt(v.kcal, 0) + "kcal ・ P " +
        fmt(v.p, 1) + "g ・ F " + fmt(v.f, 1) + "g ・ C " + fmt(v.c, 1) + "g";
      info.appendChild(name);
      info.appendChild(detail);
      var del = document.createElement("button");
      del.type = "button";
      del.className = "entry-delete";
      del.textContent = t("削除");
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
      detail.textContent = t("100gあたり {kcal}kcal ・ P {p}g ・ F {f}g ・ C {c}g",
        { kcal: fmt(food.kcal, 0), p: fmt(food.p, 1), f: fmt(food.f, 1), c: fmt(food.c, 1) });
      info.appendChild(name);
      info.appendChild(detail);
      var del = document.createElement("button");
      del.type = "button";
      del.className = "entry-delete";
      del.textContent = t("削除");
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
      ? t("登録上限（{n}件）に達しました。", { n: PRO_CUSTOM_LIMIT })
      : t("無料版の登録上限（{n}件）に達しました。Proでは{max}件まで登録できます。",
        { n: FREE_CUSTOM_LIMIT, max: PRO_CUSTOM_LIMIT });
    els["custom-limit-message"].classList.toggle("hidden", !atLimit);
  }

  function renderTargets() {
    // 計画があるあいだは目標が自動で決まるので、手では変えられないようにする。
    var byPlan = !!(state.plan && state.pro);
    ["kcal", "p", "f", "c"].forEach(function (key) {
      var input = document.getElementById("target-" + key);
      input.value = state.targets[key];
      input.disabled = byPlan;
    });
    var note = document.getElementById("target-plan-note");
    if (note) note.classList.toggle("hidden", !byPlan);
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
    function showTip(d) {
      els["chart-tip"].textContent = formatDateLabel(d.date) + (d.isToday ? t("（今日）") : "") + "　" +
        fmt(d.kcal, 0) + "kcal ・ P " + fmt(d.p, 0) + "g ・ F " + fmt(d.f, 0) + "g ・ C " + fmt(d.c, 0) + "g";
    }
    data.forEach(function (d, i) {
      var col = document.createElement("div");
      col.className = "chart-col";
      col.tabIndex = 0;
      col.setAttribute("aria-label", formatDateLabel(d.date) + " " + fmt(d.kcal, 0) + "kcal");
      var bar = document.createElement("div");
      bar.className = "chart-bar" + (d.isToday ? " today" : "");
      bar.style.height = Math.round((d.kcal / max) * 100) + "%";
      // たんぱく質・脂質・炭水化物の kcal の割合で、棒の中を積み上げる。
      [["p", d.p * 4, "var(--p)"], ["f", d.f * 9, "var(--f)"], ["c", d.c * 4, "var(--c)"]].forEach(function (x) {
        if (x[1] <= 0) return;
        var seg = document.createElement("span");
        seg.style.flex = x[1].toFixed(1) + " 1 0px";
        seg.style.background = x[2];
        bar.appendChild(seg);
      });
      ["mouseenter", "focus", "click"].forEach(function (type) {
        col.addEventListener(type, function () {
          Array.prototype.forEach.call(plot.children, function (c) { if (c.classList) c.classList.remove("is-active"); });
          col.classList.add("is-active");
          showTip(d);
        });
      });
      col.appendChild(bar);
      plot.appendChild(col);
      // 30本並ぶと日付が重なるので、今日から CHART_LABEL_EVERY 日おきにだけ出す（場所は空けておく）。
      var label = document.createElement("span");
      label.textContent = d.isToday ? t("今日") : (data.length - 1 - i) % CHART_LABEL_EVERY === 0 ? d.label : "";
      labels.appendChild(label);
    });
    if (state.targets.kcal > 0) {
      var line = document.createElement("div");
      line.className = "chart-target-line";
      line.style.bottom = Math.round((state.targets.kcal / max) * 100) + "%";
      plot.appendChild(line);
    }
  }

  // extra を渡すと、削除ボタンの前にそのボタンを置く。
  function listItem(title, detail, onDelete, extra) {
    var li = document.createElement("li");
    var info = document.createElement("div");
    var name = document.createElement("div");
    name.className = "entry-name";
    name.textContent = title;
    var sub = document.createElement("div");
    sub.className = "entry-detail";
    sub.textContent = detail;
    info.appendChild(name);
    info.appendChild(sub);
    li.appendChild(info);
    if (extra) li.appendChild(extra);
    if (onDelete) {
      var del = document.createElement("button");
      del.type = "button";
      del.className = "entry-delete";
      del.textContent = t("削除");
      del.addEventListener("click", onDelete);
      li.appendChild(del);
    }
    return li;
  }

  // 入力中の欄は書き換えない。値が無ければ空にする。
  function setFieldUnlessFocused(el, value) {
    if (typeof document !== "undefined" && document.activeElement === el) return;
    el.value = value === undefined || value === null ? "" : value;
  }

  function signed(n, decimals) { return (n > 0 ? "+" : n < 0 ? "−" : "±") + fmt(Math.abs(n), decimals); }

  // 体重・筋トレの記録は無料。部位ごとのセット数と計画（自動計算）は Pro。
  function renderBody() {
    // 体重・筋トレは今日のチェックにも出るので、一緒に描き直す。
    renderCheckin();
    if (!els["body-locked"]) return;
    els["body-locked"].classList.toggle("hidden", state.pro);
    els["body-pro-area"].classList.toggle("hidden", !state.pro);
    var today = todayString();

    // 体重
    var trend = weightTrend(today);
    setFieldUnlessFocused(els["weight-input"], state.weights[today]);
    var lines = [];
    if (trend.avg7 !== null) lines.push(t("直近7日の平均 {n}kg", { n: fmt(trend.avg7, 1) }));
    if (trend.weeklyChange !== null && trend.span >= 7) {
      lines.push(t("週あたり {n}kg（直近14日の傾き）", { n: signed(trend.weeklyChange, 2) }));
    }
    els["weight-trend"].textContent = lines.length ? lines.join(" ・ ") : t("体重を記録すると、平均と増減の傾きが出ます。");
    var wl = els["weight-list"];
    wl.innerHTML = "";
    Object.keys(state.weights).sort().reverse().slice(0, 7).forEach(function (date) {
      wl.appendChild(listItem(formatDateLabel(date), fmt(state.weights[date], 1) + "kg", function () {
        delete state.weights[date];
        saveState();
        applyPlanTargets();
        saveState();
        renderAll();
      }));
    });

    renderWeightChart(today);

    // 筋トレ
    var dl = els["exercise-names"];
    dl.innerHTML = "";
    exerciseNames().forEach(function (n) {
      var opt = document.createElement("option");
      opt.value = n;
      dl.appendChild(opt);
    });
    var items = state.workouts[today] || [];
    var list = els["workout-list"];
    list.innerHTML = "";
    els["workout-empty"].classList.toggle("hidden", items.length > 0);
    items.forEach(function (item, i) {
      var detail = t("{muscle} ・ {kg}kg × {reps}回 × {sets}セット ・ 推定1RM {rm}kg",
        { muscle: t(item.muscle), kg: fmt(item.kg, 1), reps: item.reps, sets: item.sets, rm: fmt(estimated1RM(item), 1) });
      var prev = previousSession(item.name, today);
      if (prev) {
        detail += " ・ " + t("前回（{date}）{kg}kg × {reps}回 × {sets}セット",
          { date: shortDate(prev.date), kg: fmt(prev.item.kg, 1), reps: prev.item.reps, sets: prev.item.sets });
      }
      var best = previousBest(item.name, today, i);
      var title = item.name + (best !== null && estimated1RM(item) > best ? "　" + t("★ 自己ベスト更新") : "");
      list.appendChild(listItem(title, detail, function () {
        state.workouts[today] = (state.workouts[today] || []).filter(function (x) { return x.id !== item.id; });
        if (!state.workouts[today].length) delete state.workouts[today];
        applyPlanTargets();
        saveState();
        renderAll();
      }));
    });

    if (!state.pro) return;

    // 部位ごとのセット数（直近7日）
    var vol = weeklyVolume(today);
    var maxSets = 0;
    MUSCLES.forEach(function (m) { if (vol[m] > maxSets) maxSets = vol[m]; });
    var vl = els["volume-list"];
    vl.innerHTML = "";
    MUSCLES.forEach(function (m) {
      if (m === "その他" && !vol[m]) return;
      var row = document.createElement("div");
      row.className = "volume-row";
      var label = document.createElement("span");
      label.className = "volume-label";
      label.textContent = t(m);
      var track = document.createElement("span");
      track.className = "volume-track";
      var bar = document.createElement("span");
      bar.className = "volume-bar" + (vol[m] >= 10 ? " enough" : "");
      bar.style.width = (maxSets ? Math.round(vol[m] / Math.max(maxSets, 10) * 100) : 0) + "%";
      track.appendChild(bar);
      var num = document.createElement("span");
      num.className = "volume-num";
      num.textContent = t("{n}セット", { n: vol[m] });
      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(num);
      vl.appendChild(row);
    });

    // 計画
    // 計画がまだ無いときは、入れかけのチェックを消さない。
    if (state.plan && (typeof document === "undefined" || document.activeElement !== els["plan-cycle"])) {
      els["plan-cycle"].checked = !!state.plan.cycle;
    }
    setFieldUnlessFocused(els["plan-goal"], state.plan ? state.plan.goalWeight : undefined);
    setFieldUnlessFocused(els["plan-date"], state.plan ? state.plan.goalDate : undefined);
    els["plan-clear-button"].classList.toggle("hidden", !state.plan);
    var r = computeBodyPlan(today);
    var out = els["plan-result"];
    out.innerHTML = "";
    if (!r.ready) {
      out.textContent = t("先に「1日の目標を設定する」の「目標の自動計算」で、性別・年齢・身長・活動レベルを入れてください。");
      return;
    }
    var rows = [
      t("体重 {w}kg ・ 基礎代謝 約{bmr}kcal", { w: fmt(r.weight, 1), bmr: fmt(r.bmr, 0) }),
      r.source === "actual"
        ? t("1日の消費（実績から逆算） 約{tdee}kcal ・ 直近{d}日の平均摂取 {avg}kcal",
          { tdee: fmt(r.tdee, 0), d: r.intakeDays, avg: fmt(r.avgIntake, 0) })
        : t("1日の消費（式による推定） 約{tdee}kcal ・ 食事{md}日分と体重{mw}回分（1週間以上）がたまると、実績から計算します（今は食事{d}日・体重{w}回）",
          { tdee: fmt(r.tdee, 0), md: MIN_INTAKE_DAYS, mw: MIN_WEIGH_INS, d: r.intakeDays, w: r.trend.weighIns })
    ];
    if (state.plan) {
      var planVars = { w: fmt(state.plan.goalWeight, 1), d: r.daysLeft, n: signed(r.plannedWeekly, 2) };
      rows.push(r.daysLeft > 0
        ? (r.limited
          ? t("目標 {w}kg まで あと{d}日 ・ 計画 週{n}kg（体に無理のない速さに抑えています）", planVars)
          : t("目標 {w}kg まで あと{d}日 ・ 計画 週{n}kg", planVars))
        : t("期限を過ぎたので、今の体重を保つカロリーにしています。"));
      if (state.plan.cycle) {
        rows.push(r.dayType === null
          ? (r.cycleDays >= 7
            ? t("トレ日と休養日の切り替え：毎日筋トレしているので、切り替えずに平均のカロリーにしています。")
            : r.cycleDays > 0
              ? t("トレ日と休養日の切り替え：目標が基礎代謝に近く、休養日を減らす余裕がないので切り替えていません。")
              : t("トレ日と休養日の切り替え：直近4週間の筋トレの記録（週1〜6日）がたまると始まります（今は週0日）。"))
          : (r.dayType === "training"
            ? t("今日はトレ日なので、平均より多めにしています（平均 {k}kcal、週{n}日トレ）。",
              { k: fmt(r.baseKcal, 0), n: r.cycleDays })
            : t("今日は休養日なので、平均より少なめにしています（平均 {k}kcal、週{n}日トレ）。筋トレを記録すると、トレ日のカロリーに変わります。",
              { k: fmt(r.baseKcal, 0), n: r.cycleDays })));
      }
      var goalVars = { kcal: fmt(r.kcal, 0), p: fmt(r.p, 0), f: fmt(r.f, 0), c: fmt(r.c, 0) };
      rows.push(r.floored
        ? t("今日の目標 {kcal}kcal ・ P {p}g ・ F {f}g ・ C {c}g（基礎代謝を下回らないようにしています）", goalVars)
        : t("今日の目標 {kcal}kcal ・ P {p}g ・ F {f}g ・ C {c}g", goalVars));
      rows.push(t("目標は計画から毎日自動で決まります。手で決めたいときは「計画をやめる」を押してください。"));
    } else {
      rows.push(t("目標体重と期限を入れると、毎日の目標カロリーとPFCを自動で決めます。"));
    }
    rows.forEach(function (text) {
      var p = document.createElement("p");
      p.className = "plan-row";
      p.textContent = text;
      out.appendChild(p);
    });
  }

  var SVG_NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    var el = document.createElementNS ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, String(attrs[k])); });
    return el;
  }

  // 体重のグラフ（SVG）。点＝その日の体重、線＝7日平均、点線＝目標体重。
  function renderWeightChart(today) {
    var box = els["weight-chart"];
    if (!box) return;
    box.innerHTML = "";
    var data = buildWeightChart(today, WEIGHT_CHART_DAYS);
    els["weight-chart-note"].classList.toggle("hidden", data.points.length >= 2);
    if (data.points.length < 2) return;
    var W = 320, H = 160, L = 34, R = 8, T = 8, B = 20;
    function px(x) { return L + (W - L - R) * x / (data.days - 1); }
    function py(y) { return T + (H - T - B) * (data.yMax - y) / (data.yMax - data.yMin); }
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": t("直近{n}日の体重のグラフ", { n: data.days }), "class": "weight-svg" });
    [data.yMin, (data.yMin + data.yMax) / 2, data.yMax].forEach(function (y) {
      svg.appendChild(svgEl("line", { x1: L, x2: W - R, y1: py(y), y2: py(y), stroke: "#e8e0d5", "stroke-width": 1 }));
      var t = svgEl("text", { x: L - 4, y: py(y) + 4, "text-anchor": "end", "font-size": 10, fill: "#6b6259" });
      t.textContent = fmt(y, 1);
      svg.appendChild(t);
    });
    [0, data.days - 1].forEach(function (x) {
      var t = svgEl("text", { x: px(x), y: H - 4, "text-anchor": x ? "end" : "start", "font-size": 10, fill: "#6b6259" });
      t.textContent = shortDate(addDays(today, -(data.days - 1 - x)));
      svg.appendChild(t);
    });
    if (data.goal !== null) {
      svg.appendChild(svgEl("line", { x1: L, x2: W - R, y1: py(data.goal), y2: py(data.goal),
        stroke: "#c2703d", "stroke-width": 1.5, "stroke-dasharray": "4 3" }));
    }
    data.points.forEach(function (p) {
      svg.appendChild(svgEl("circle", { cx: px(p.x), cy: py(p.y), r: 2.5, fill: "#a9c48d" }));
    });
    svg.appendChild(svgEl("polyline", { fill: "none", stroke: "#4a6b3a", "stroke-width": 2,
      points: data.avg.map(function (p) { return px(p.x).toFixed(1) + "," + py(p.y).toFixed(1); }).join(" ") }));
    box.appendChild(svg);
  }

  function renderRecent() {
    if (!els["recent-area"]) return;
    var items = state.recentFoods.filter(function (x) { return !!findFood(x.foodId); });
    els["recent-area"].classList.toggle("hidden", items.length === 0);
    var box = els["recent-list"];
    box.innerHTML = "";
    items.forEach(function (x) {
      var food = findFood(x.foodId);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.setAttribute("aria-label", t("{food} {n}g を追加", { food: foodLabel(food), n: fmt(x.grams, 0) }));
      var name = document.createElement("span");
      name.className = "chip-name";
      name.textContent = foodLabel(food);
      var g = document.createElement("span");
      g.className = "chip-grams";
      g.textContent = fmt(x.grams, 0) + "g";
      btn.appendChild(name);
      btn.appendChild(g);
      btn.addEventListener("click", function () {
        state.entries.push({ id: nextId("e"), foodId: x.foodId, grams: x.grams });
        rememberRecent(x.foodId, x.grams);
        saveState();
        renderAll();
      });
      box.appendChild(btn);
    });

    var copy = els["copy-last-button"];
    var last = state.lastDay;
    var usable = last ? last.entries.filter(function (e) { return !!findFood(e.foodId); }) : [];
    copy.classList.toggle("hidden", !usable.length);
    if (usable.length) {
      var yesterday = addDays(todayString(), -1);
      copy.textContent = last.date === yesterday
        ? t("昨日と同じものを追加する（{n}品）", { n: usable.length })
        : t("{date}と同じものを追加する（{n}品）", { date: formatDateLabel(last.date), n: usable.length });
    }
  }

  function renderSets() {
    if (!els["sets-locked"]) return;
    els["sets-locked"].classList.toggle("hidden", state.pro);
    els["sets-area"].classList.toggle("hidden", !state.pro);
    if (!state.pro) return;
    var list = els["set-list"];
    list.innerHTML = "";
    els["set-empty"].classList.toggle("hidden", state.mealSets.length > 0);
    state.mealSets.forEach(function (set) {
      var kcal = 0, missing = 0;
      set.items.forEach(function (it) {
        var v = entryValues(it);
        if (v) kcal += v.kcal; else missing += 1;
      });
      var detail = missing
        ? t("{n}品 ・ {kcal}kcal（消した食品{m}品は追加されません）", { n: set.items.length, kcal: fmt(kcal, 0), m: missing })
        : t("{n}品 ・ {kcal}kcal", { n: set.items.length, kcal: fmt(kcal, 0) });
      var add = document.createElement("button");
      add.type = "button";
      add.className = "entry-add";
      add.textContent = t("追加");
      add.addEventListener("click", function () {
        var added = 0;
        set.items.forEach(function (it) {
          if (findFood(it.foodId)) { state.entries.push({ id: nextId("e"), foodId: it.foodId, grams: it.grams }); added += 1; }
        });
        saveState();
        renderAll();
        els["set-message"].textContent = added
          ? t("「{name}」を今日の記録に追加しました（{n}品）。", { name: set.name, n: added })
          : t("「{name}」の食品はすべて消されているため、追加できませんでした。", { name: set.name });
      });
      list.appendChild(listItem(set.name, detail, function () {
        if (!window.confirm(t("セット「{name}」を消しますか？", { name: set.name }))) return;
        state.mealSets = state.mealSets.filter(function (x) { return x.id !== set.id; });
        saveState();
        renderSets();
      }, add));
    });
  }

  function renderScore() {
    if (!els["score-locked"]) return;
    els["score-locked"].classList.toggle("hidden", state.pro);
    els["score-area"].classList.toggle("hidden", !state.pro);
    if (!state.pro) return;
    var sc = todayScore();
    var st = streakInfo(todayString(), sc.total);
    els["score-total"].textContent = sc.total;
    els["score-streak"].textContent = st.current;
    els["score-best"].textContent = st.best;
    els["score-sum"].textContent = fmt(st.total, 0);
    var ul = els["score-items"];
    ul.innerHTML = "";
    sc.items.forEach(function (x) {
      var li = document.createElement("li");
      li.className = x.got ? "got" : "";
      li.textContent = (x.got ? "✓ " : "・ ") + t("{label}（{n}点）", { label: t(x.label), n: x.pts });
      ul.appendChild(li);
    });
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
    renderBody();
    renderSets();
    renderRecent();
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
    rememberRecent(foodId, grams);
    saveState();
    renderSummary();
    renderEntries();
    renderRecent();
    els["grams-input"].value = "100";
  });

  document.getElementById("reset-button").addEventListener("click", function () {
    if (state.entries.length === 0) return;
    if (!window.confirm(t("今日の記録をすべて消しますか？"))) return;
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
          els["pro-message"].textContent = t("ライセンスキーが正しくありません。コピーしたキー全体を貼り付けてください。");
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
        els["pro-message"].textContent = t("コードが正しくありません。もう一度お確かめください。");
      }
    });
  });

  document.getElementById("pro-disable-button").addEventListener("click", function () {
    var msg = state.license
      ? t("Proをやめて、無料版に戻しますか？（記録は消えませんが、日付が変わると、90日より前の食事の記録と1年より前の体重・筋トレ・スコアは消えます）\nライセンスキーも消えるので、再び使うときのためにキーを控えておいてください。")
      : t("Proをやめて、無料版に戻しますか？（記録は消えませんが、日付が変わると、90日より前の食事の記録と1年より前の体重・筋トレ・スコアは消えます）");
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
        t("入力を確認してください（年齢10〜100、身長100〜250cm、体重20〜300kg）。");
      return;
    }
    var r = computeAutoTargets(profile);
    state.profile = profile;
    state.targets = { kcal: r.kcal, p: r.p, f: r.f, c: r.c };
    saveState();
    if (state.plan && state.pro) {
      applyPlanTargets();
      saveState();
      renderAll();
      els["auto-calc-result"].textContent =
        t("プロフィールを保存しました。計画があるので、今日の目標は「からだの記録」の計画から決めています。");
      return;
    }
    renderSummary();
    renderTargets();
    renderChart();
    els["auto-calc-result"].textContent =
      t("基礎代謝 約{bmr}kcal ・ 1日の消費目安 約{tdee}kcal → 目標 {kcal}kcal（P {p}g ・ F {f}g ・ C {c}g）を設定しました。",
        { bmr: fmt(r.bmr, 0), tdee: fmt(r.tdee, 0), kcal: fmt(r.kcal, 0), p: fmt(r.p, 0), f: fmt(r.f, 0), c: fmt(r.c, 0) });
  });

  document.getElementById("today-csv-button").addEventListener("click", function () {
    if (!state.pro) return;
    downloadCsv("pfc-" + todayString() + ".csv", buildTodayCsv());
  });

  document.getElementById("history-csv-button").addEventListener("click", function () {
    if (!state.pro) return;
    downloadCsv("pfc-history.csv", buildHistoryCsv());
  });

  els["copy-last-button"].addEventListener("click", function () {
    var last = state.lastDay;
    if (!last) return;
    last.entries.forEach(function (e) {
      if (findFood(e.foodId)) state.entries.push({ id: nextId("e"), foodId: e.foodId, grams: e.grams });
    });
    saveState();
    renderAll();
  });

  // ---------- 食品の検索・セット ----------
  if (els["food-search"]) {
    els["food-search"].addEventListener("input", function () { renderSelect(); });
    // 検索欄で Enter を押しても、食品が勝手に追加されないようにする（変換の確定は邪魔しない）。
    els["food-search"].addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) e.preventDefault();
    });
  }

  document.getElementById("set-save-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!state.pro) return;
    var name = String(els["set-name"].value || "").trim().slice(0, 30);
    if (!name) { els["set-message"].textContent = t("セットの名前を入れてください（例：朝ごはん）。"); return; }
    if (!state.entries.length) { els["set-message"].textContent = t("今日の記録が空です。先に食品を追加してください。"); return; }
    if (state.mealSets.length >= MAX_MEAL_SETS) {
      els["set-message"].textContent = t("セットは{n}個まで登録できます。", { n: MAX_MEAL_SETS });
      return;
    }
    state.mealSets.push({
      id: nextId("s"), name: name,
      items: state.entries.slice(0, MAX_SET_ITEMS).map(function (x) { return { foodId: x.foodId, grams: x.grams }; })
    });
    els["set-name"].value = "";
    els["set-message"].textContent = state.entries.length > MAX_SET_ITEMS
      ? t("「{name}」を登録しました。次からはワンタップで追加できます。（1つのセットには先頭の{n}品までが入ります）",
        { name: name, n: MAX_SET_ITEMS })
      : t("「{name}」を登録しました。次からはワンタップで追加できます。", { name: name });
    saveState();
    renderSets();
  });

  // ---------- からだの記録（Pro） ----------
  document.getElementById("weight-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var kg = parseFloat(els["weight-input"].value);
    if (!isFinite(kg) || kg < 20 || kg > 300) return;
    state.weights[todayString()] = Math.round(kg * 10) / 10;
    applyPlanTargets();
    saveState();
    renderAll();
  });

  document.getElementById("workout-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var today = todayString();
    var item = sanitizeWorkoutItem({
      id: nextId("w"),
      name: document.getElementById("workout-name").value,
      kg: parseFloat(document.getElementById("workout-kg").value),
      reps: parseFloat(document.getElementById("workout-reps").value),
      sets: parseFloat(document.getElementById("workout-sets").value),
      muscle: els["workout-muscle"].value
    });
    if (!item) {
      els["workout-message"].textContent = t("種目名・重量（0〜1000kg）・回数・セット数（整数）を確かめてください。");
      return;
    }
    var items = state.workouts[today] || [];
    if (items.length >= MAX_WORKOUT_ITEMS) {
      els["workout-message"].textContent = t("1日に記録できるのは{n}件までです。", { n: MAX_WORKOUT_ITEMS });
      return;
    }
    var best = previousBest(item.name, today, items.length);
    items.push(item);
    state.workouts[today] = items;
    applyPlanTargets();
    els["workout-message"].textContent = best !== null && estimated1RM(item) > best
      ? t("★ {name}の自己ベスト（推定1RM {rm}kg）を更新しました！", { name: item.name, rm: fmt(estimated1RM(item), 1) }) : "";
    saveState();
    renderAll();
  });

  document.getElementById("plan-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!state.pro) return;
    var plan = sanitizePlan({
      goalWeight: parseFloat(els["plan-goal"].value),
      goalDate: els["plan-date"].value,
      cycle: !!els["plan-cycle"].checked
    });
    if (!plan || plan.goalDate <= todayString()) {
      els["plan-message"].textContent = t("目標体重（20〜300kg）と、明日以降の期限を入れてください。");
      return;
    }
    els["plan-message"].textContent = "";
    state.plan = plan;
    applyPlanTargets();
    saveState();
    renderAll();
  });

  els["plan-cycle"].addEventListener("change", function () {
    if (!state.pro || !state.plan) return;
    state.plan.cycle = !!els["plan-cycle"].checked;
    applyPlanTargets();
    saveState();
    renderAll();
  });

  els["plan-clear-button"].addEventListener("click", function () {
    if (!window.confirm(t("計画をやめますか？（今の目標値はそのまま残り、手で変えられるようになります）"))) return;
    state.plan = null;
    saveState();
    renderAll();
  });

  // ---------- バックアップ（無料） ----------
  document.getElementById("backup-export-button").addEventListener("click", function () {
    var data = {};
    Object.keys(state).forEach(function (k) { if (k !== "pendingSession") data[k] = state[k]; });
    downloadFile("pfc-backup-" + todayString() + ".json",
      JSON.stringify({ app: "pfc-calculator", version: 1, data: data }), "application/json");
  });

  document.getElementById("backup-import").addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file || typeof file.text !== "function") return;
    if (file.size > 5 * 1024 * 1024) {
      els["backup-message"].textContent = t("ファイルが大きすぎます（5MBまで）。");
      return;
    }
    file.text().then(function (text) {
      var parsed = JSON.parse(text);
      if (!parsed || parsed.app !== "pfc-calculator" || !parsed.data || typeof parsed.data !== "object") {
        throw new Error("format");
      }
      if (!window.confirm(t("バックアップを読み込みますか？ この端末の今の記録は、バックアップの内容で置き換わります。"))) return;
      var next = sanitizeState(parsed.data);
      // Pro かどうかはバックアップの言い分ではなく、ライセンスキーの署名で決める。
      // 署名が確かめられなければ、この端末の今の Pro・キー・支払いの確認待ちをそのまま残す。
      return verifyLicense(next.license).then(function (ok) {
        if (!ok) {
          next.pro = state.pro;
          next.license = state.license;
        } else {
          next.pro = true;
        }
        next.pendingSession = state.pendingSession;
        // 未来の日付の「今日」は受け付けない（端末の時計がずれていた場合など）。
        if (next.day > todayString()) { next.day = todayString(); }
        // 食品の参照は、読み込んだバックアップの savedFoods で確かめる（先に state を差し替える）。
        state = next;
        state.entries = state.entries.filter(function (x) { return !!findFood(x.foodId); });
        lastCheckin = null; // 読み込んだ記録で、お祝い・お知らせを出さない
        rollOverIfNeeded();
        applyPlanTargets();
        saveState();
        renderAll();
        els["backup-message"].textContent = t("バックアップを読み込みました。");
      });
    }).catch(function () {
      els["backup-message"].textContent = t("このファイルは読み込めませんでした。このアプリで書き出したバックアップを選んでください。");
    });
    e.target.value = "";
  });

  var copyButton = document.getElementById("license-copy-button");
  if (copyButton) {
    copyButton.addEventListener("click", function () {
      if (!state.license) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(state.license).then(function () {
          copyButton.textContent = t("コピーしました");
        }, function () {
          els["license-key"].select();
        });
      } else {
        els["license-key"].select();
      }
    });
  }

  renderAll();

  // ---------- タブ ----------
  // どのタブを開いていたかは、その端末のブラウザにだけ覚えておく（使えなくても動く）。
  // はじめての人向けの注意書き。「わかりました」を押したら、この端末では出さない。
  (function setupWelcome() {
    var box = document.getElementById("welcome");
    var close = document.getElementById("welcome-close");
    if (!box || !close) return;
    var seen = false;
    try { seen = localStorage.getItem(WELCOME_KEY) === "1"; } catch (e) { seen = false; }
    box.classList.toggle("hidden", seen);
    close.addEventListener("click", function () {
      box.classList.add("hidden");
      try { localStorage.setItem(WELCOME_KEY, "1"); } catch (e) { /* 覚えられなくても閉じる */ }
    });
  })();

  (function setupTabs() {
    if (!document.querySelectorAll) return;
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
    var panels = Array.prototype.slice.call(document.querySelectorAll(".panel"));
    function show(name, focusTop) {
      if (!panels.some(function (p) { return p.getAttribute("data-panel") === name; })) name = "today";
      panels.forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== name; });
      tabs.forEach(function (t) {
        if (t.getAttribute("data-tab") === name) t.setAttribute("aria-current", "page");
        else t.removeAttribute("aria-current");
      });
      try { localStorage.setItem("pfc-calculator-tab", name); } catch (e) { /* 覚えられなくても続ける */ }
      if (focusTop && window.scrollTo) window.scrollTo(0, 0);
    }
    tabs.forEach(function (t) {
      t.addEventListener("click", function () { show(t.getAttribute("data-tab"), true); });
    });
    // 今日のチェックの「からだへ」など、data-goto を持つボタンからもタブを切り替える。
    Array.prototype.slice.call(document.querySelectorAll("[data-goto]")).forEach(function (b) {
      b.addEventListener("click", function () { show(b.getAttribute("data-goto"), true); });
    });
    var saved = null;
    try { saved = localStorage.getItem("pfc-calculator-tab"); } catch (e) { saved = null; }
    show(saved || "today", false);
  })();

  // 筋トレ種目サーチ (exercise-search) から ?exercise=…&muscle=… 付きで開かれたら、
  // 「からだ」タブを開いて筋トレのフォームに種目名と部位を入れる。URL からは消しておく。
  (function handleExerciseLink() {
    var name = null, muscle = null;
    try {
      var params = new URLSearchParams(window.location.search);
      name = params.get("exercise");
      muscle = params.get("muscle");
      if (name !== null || muscle !== null) {
        params.delete("exercise");
        params.delete("muscle");
        if (window.history && window.history.replaceState) {
          var rest = params.toString();
          window.history.replaceState(null, "",
            window.location.pathname + (rest ? "?" + rest : "") + window.location.hash);
        }
      }
    } catch (e) {
      name = null;
    }
    name = typeof name === "string" ? name.trim().slice(0, 40) : "";
    if (!name) return;
    var tab = document.querySelector && document.querySelector('.tab[data-tab="body"]');
    if (tab) tab.click();
    document.getElementById("workout-name").value = name;
    els["workout-muscle"].value = MUSCLES.indexOf(muscle) !== -1 ? muscle : "";
    els["workout-message"].textContent = t("「{name}」を入れました。重量・回数・セットを入れて追加してください。", { name: name });
    var kg = document.getElementById("workout-kg");
    if (kg.focus) kg.focus();
  })();

  if (els["today-label"]) els["today-label"].textContent = formatDateLabel(todayString());

  // 言語を切り替えたら、画面を描き直す（起動時に一度だけ入れている日付などもここで入れ直す）。
  if (I18N) {
    I18N.onChange(function () {
      renderAll();
      if (els["today-label"]) els["today-label"].textContent = formatDateLabel(todayString());
    });
  }

  // ホーム画面に追加したときにオフラインでも開けるよう、Service Worker を登録する（https のときだけ）。
  if (typeof navigator !== "undefined" && navigator.serviceWorker &&
      window.location && window.location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

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
          t("この端末ではすでに購入済みのライセンスキーで Pro が有効です。");
      } else {
        state.pendingSession = sessionId;
        saveState();
      }
    }
    if (state.pendingSession && !state.license) claimLicense(state.pendingSession);
  })();
})();
