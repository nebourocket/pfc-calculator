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
  var BODY_MAX_DAYS = 365;           // 体重・筋トレ・スコアの保存日数
  var KCAL_PER_KG = 7700;            // 体脂肪 1kg あたりのエネルギー（一般的な目安）
  var TDEE_WINDOW_DAYS = 14;         // 実績から TDEE を逆算するときに見る日数
  var MIN_INTAKE_DAYS = 7;           // 逆算に必要な、食事を記録した日数
  var MIN_WEIGH_INS = 4;             // 逆算に必要な、体重を記録した回数
  var MAX_WORKOUT_ITEMS = 50;        // 1日に記録できる筋トレの件数
  var STREAK_MIN_SCORE = 50;         // 連続記録に数える1日のスコアの下限
  var WEIGHT_CHART_DAYS = 30;        // 体重のグラフに出す日数
  var CYCLE_SHIFT = 0.1;             // トレ日に上乗せする割合（目標カロリーの10%）
  var MUSCLES = ["胸", "背中", "脚", "肩", "腕", "腹", "その他"];
  var MAX_SEARCH_RESULTS = 100;      // 食品の検索で一度に出す件数
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

  // 保存データ（またはバックアップ）を、使える形に検証して返す。
  function sanitizeState(parsed) {
    return {
      entries: sanitizeEntries(parsed.entries),
      customFoods: sanitizeCustomFoods(parsed.customFoods),
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
      mealSets: sanitizeMealSets(parsed.mealSets)
    };
  }

  function loadState() {
    var fallback = {
      entries: [], customFoods: [], targets: sanitizeTargets(null),
      pro: false, day: todayString(), history: {}, profile: null,
      license: null, pendingSession: null,
      weights: {}, workouts: {}, plan: null, scores: {}, mealSets: []
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
      { label: "食事を記録した", pts: 20, got: t.kcal > 0 },
      { label: "カロリーが目標の±10%以内", pts: 30,
        got: t.kcal > 0 && targets.kcal > 0 && Math.abs(t.kcal - targets.kcal) <= targets.kcal * 0.1 },
      { label: "たんぱく質が目標の90%以上", pts: 20,
        got: targets.p > 0 && t.p >= targets.p * 0.9 },
      { label: "体重を記録した", pts: 15, got: hasWeight },
      { label: "筋トレを記録した", pts: 15, got: hasWorkout }
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
    var lines = ["日付,カロリー(kcal),たんぱく質(g),脂質(g),炭水化物(g),体重(kg)"];
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
    var t = totals();
    lines.push([today, Math.round(t.kcal), round1(t.p), round1(t.f), round1(t.c), weightCell(today)].join(","));
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
  // 前日のスコアも、その日の記録と目標で確定して残す。
  function rollOverIfNeeded() {
    var today = todayString();
    if (state.day === today) { saveState(); return; }
    var t = totals();
    if (state.entries.length > 0) {
      state.history[state.day] = t;
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
   "plate", "plate-p", "plate-f", "plate-c", "plate-target", "remaining-kcal", "today-label", "chart-tip"
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
    // スコアは合計と目標で決まるので、合計を描き直すたびに一緒に描き直す。
    renderScore();
  }

  // 今日の皿：P×4・F×9・C×4 の kcal を左から積み上げ、目標の位置に点線を引く。
  function renderPlate(t, targets) {
    if (!els["plate-p"]) return;
    var pk = t.p * 4, fk = t.f * 9, ck = t.c * 4;
    var scale = Math.max(targets.kcal, pk + fk + ck, t.kcal, 1);
    els["plate-p"].style.width = (pk / scale * 100).toFixed(2) + "%";
    els["plate-f"].style.width = (fk / scale * 100).toFixed(2) + "%";
    els["plate-c"].style.width = (ck / scale * 100).toFixed(2) + "%";
    var target = els["plate-target"];
    if (targets.kcal > 0) {
      target.style.display = "block";
      target.style.left = (targets.kcal / scale * 100).toFixed(2) + "%";
    } else {
      target.style.display = "none";
    }
    els["plate"].setAttribute("aria-label", "今日のカロリーの内訳：たんぱく質 " + fmt(pk, 0) + "kcal、脂質 " +
      fmt(fk, 0) + "kcal、炭水化物 " + fmt(ck, 0) + "kcal" +
      (targets.kcal > 0 ? "（目標 " + fmt(targets.kcal, 0) + "kcal）" : ""));
    var rem = els["remaining-kcal"];
    if (targets.kcal > 0) {
      var diff = targets.kcal - t.kcal;
      rem.textContent = diff >= 0 ? "あと " + fmt(diff, 0) + " kcal" : fmt(-diff, 0) + " kcal オーバー";
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
      haystackCache[key] = normalizeForSearch(food.name + " " + (food.source || "") + " " + food.category);
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
        ? "よく使う食品を表示しています。ほかの食品（成分表と市販品の全" + FOODS.length + "品）は、上の欄で探せます。"
        : !foods.length
          ? "見つかりませんでした。別のことばで探すか、「自分の食品を登録する」から登録できます。"
          : total > MAX_SEARCH_RESULTS
            ? total + "件見つかりました（先頭の" + MAX_SEARCH_RESULTS + "件を表示。ことばを足すと絞り込めます）"
            : total + "件見つかりました";
    }
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
      els["chart-tip"].textContent = formatDateLabel(d.date) + (d.isToday ? "（今日）" : "") + "　" +
        fmt(d.kcal, 0) + "kcal ・ P " + fmt(d.p, 0) + "g ・ F " + fmt(d.f, 0) + "g ・ C " + fmt(d.c, 0) + "g";
    }
    data.forEach(function (d) {
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
      del.textContent = "削除";
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

  function renderBody() {
    if (!els["body-locked"]) return;
    els["body-locked"].classList.toggle("hidden", state.pro);
    els["body-area"].classList.toggle("hidden", !state.pro);
    if (!state.pro) return;
    var today = todayString();

    // 体重
    var trend = weightTrend(today);
    setFieldUnlessFocused(els["weight-input"], state.weights[today]);
    var lines = [];
    if (trend.avg7 !== null) lines.push("直近7日の平均 " + fmt(trend.avg7, 1) + "kg");
    if (trend.weeklyChange !== null && trend.span >= 7) {
      lines.push("週あたり " + signed(trend.weeklyChange, 2) + "kg（直近14日の傾き）");
    }
    els["weight-trend"].textContent = lines.length ? lines.join(" ・ ") : "体重を記録すると、平均と増減の傾きが出ます。";
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
      var detail = item.muscle + " ・ " + fmt(item.kg, 1) + "kg × " + item.reps + "回 × " + item.sets + "セット ・ 推定1RM " +
        fmt(estimated1RM(item), 1) + "kg";
      var prev = previousSession(item.name, today);
      if (prev) {
        detail += " ・ 前回（" + shortDate(prev.date) + "）" + fmt(prev.item.kg, 1) + "kg × " +
          prev.item.reps + "回 × " + prev.item.sets + "セット";
      }
      var best = previousBest(item.name, today, i);
      var title = item.name + (best !== null && estimated1RM(item) > best ? "　★ 自己ベスト更新" : "");
      list.appendChild(listItem(title, detail, function () {
        state.workouts[today] = (state.workouts[today] || []).filter(function (x) { return x.id !== item.id; });
        if (!state.workouts[today].length) delete state.workouts[today];
        applyPlanTargets();
        saveState();
        renderAll();
      }));
    });

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
      label.textContent = m;
      var track = document.createElement("span");
      track.className = "volume-track";
      var bar = document.createElement("span");
      bar.className = "volume-bar" + (vol[m] >= 10 ? " enough" : "");
      bar.style.width = (maxSets ? Math.round(vol[m] / Math.max(maxSets, 10) * 100) : 0) + "%";
      track.appendChild(bar);
      var num = document.createElement("span");
      num.className = "volume-num";
      num.textContent = vol[m] + "セット";
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
      out.textContent = "先に「1日の目標を設定する」の「目標の自動計算」で、性別・年齢・身長・活動レベルを入れてください。";
      return;
    }
    var rows = [
      "体重 " + fmt(r.weight, 1) + "kg ・ 基礎代謝 約" + fmt(r.bmr, 0) + "kcal",
      r.source === "actual"
        ? "1日の消費（実績から逆算） 約" + fmt(r.tdee, 0) + "kcal ・ 直近" + r.intakeDays + "日の平均摂取 " +
          fmt(r.avgIntake, 0) + "kcal"
        : "1日の消費（式による推定） 約" + fmt(r.tdee, 0) + "kcal ・ 食事" + MIN_INTAKE_DAYS + "日分と体重" +
          MIN_WEIGH_INS + "回分（1週間以上）がたまると、実績から計算します（今は食事" + r.intakeDays +
          "日・体重" + r.trend.weighIns + "回）"
    ];
    if (state.plan) {
      rows.push(r.daysLeft > 0
        ? "目標 " + fmt(state.plan.goalWeight, 1) + "kg まで あと" + r.daysLeft + "日 ・ 計画 週" +
          signed(r.plannedWeekly, 2) + "kg" + (r.limited ? "（体に無理のない速さに抑えています）" : "")
        : "期限を過ぎたので、今の体重を保つカロリーにしています。");
      if (state.plan.cycle) {
        rows.push(r.dayType === null
          ? (r.cycleDays >= 7
            ? "トレ日と休養日の切り替え：毎日筋トレしているので、切り替えずに平均のカロリーにしています。"
            : r.cycleDays > 0
              ? "トレ日と休養日の切り替え：目標が基礎代謝に近く、休養日を減らす余裕がないので切り替えていません。"
              : "トレ日と休養日の切り替え：直近4週間の筋トレの記録（週1〜6日）がたまると始まります（今は週0日）。")
          : (r.dayType === "training"
            ? "今日はトレ日なので、平均より多めにしています（平均 " + fmt(r.baseKcal, 0) + "kcal、週" + r.cycleDays + "日トレ）。"
            : "今日は休養日なので、平均より少なめにしています（平均 " + fmt(r.baseKcal, 0) + "kcal、週" + r.cycleDays +
              "日トレ）。筋トレを記録すると、トレ日のカロリーに変わります。"));
      }
      rows.push("今日の目標 " + fmt(r.kcal, 0) + "kcal ・ P " + fmt(r.p, 0) + "g ・ F " + fmt(r.f, 0) +
        "g ・ C " + fmt(r.c, 0) + "g" + (r.floored ? "（基礎代謝を下回らないようにしています）" : ""));
      rows.push("目標は計画から毎日自動で決まります。手で決めたいときは「計画をやめる」を押してください。");
    } else {
      rows.push("目標体重と期限を入れると、毎日の目標カロリーとPFCを自動で決めます。");
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
      "aria-label": "直近" + data.days + "日の体重のグラフ", "class": "weight-svg" });
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
      var detail = set.items.length + "品 ・ " + fmt(kcal, 0) + "kcal" +
        (missing ? "（消した食品" + missing + "品は追加されません）" : "");
      var add = document.createElement("button");
      add.type = "button";
      add.className = "entry-add";
      add.textContent = "追加";
      add.addEventListener("click", function () {
        var added = 0;
        set.items.forEach(function (it) {
          if (findFood(it.foodId)) { state.entries.push({ id: nextId("e"), foodId: it.foodId, grams: it.grams }); added += 1; }
        });
        saveState();
        renderAll();
        els["set-message"].textContent = added
          ? "「" + set.name + "」を今日の記録に追加しました（" + added + "品）。"
          : "「" + set.name + "」の食品はすべて消されているため、追加できませんでした。";
      });
      list.appendChild(listItem(set.name, detail, function () {
        if (!window.confirm("セット「" + set.name + "」を消しますか？")) return;
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
      li.textContent = (x.got ? "✓ " : "・ ") + x.label + "（" + x.pts + "点）";
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
    if (state.plan && state.pro) {
      applyPlanTargets();
      saveState();
      renderAll();
      els["auto-calc-result"].textContent =
        "プロフィールを保存しました。計画があるので、今日の目標は「からだの記録」の計画から決めています。";
      return;
    }
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
    if (!name) { els["set-message"].textContent = "セットの名前を入れてください（例：朝ごはん）。"; return; }
    if (!state.entries.length) { els["set-message"].textContent = "今日の記録が空です。先に食品を追加してください。"; return; }
    if (state.mealSets.length >= MAX_MEAL_SETS) {
      els["set-message"].textContent = "セットは" + MAX_MEAL_SETS + "個まで登録できます。";
      return;
    }
    state.mealSets.push({
      id: nextId("s"), name: name,
      items: state.entries.slice(0, MAX_SET_ITEMS).map(function (x) { return { foodId: x.foodId, grams: x.grams }; })
    });
    els["set-name"].value = "";
    els["set-message"].textContent = "「" + name + "」を登録しました。次からはワンタップで追加できます。" +
      (state.entries.length > MAX_SET_ITEMS ? "（1つのセットには先頭の" + MAX_SET_ITEMS + "品までが入ります）" : "");
    saveState();
    renderSets();
  });

  // ---------- からだの記録（Pro） ----------
  document.getElementById("weight-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!state.pro) return;
    var kg = parseFloat(els["weight-input"].value);
    if (!isFinite(kg) || kg < 20 || kg > 300) return;
    state.weights[todayString()] = Math.round(kg * 10) / 10;
    applyPlanTargets();
    saveState();
    renderAll();
  });

  document.getElementById("workout-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!state.pro) return;
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
      els["workout-message"].textContent = "種目名・重量（0〜1000kg）・回数・セット数（整数）を確かめてください。";
      return;
    }
    var items = state.workouts[today] || [];
    if (items.length >= MAX_WORKOUT_ITEMS) {
      els["workout-message"].textContent = "1日に記録できるのは" + MAX_WORKOUT_ITEMS + "件までです。";
      return;
    }
    var best = previousBest(item.name, today, items.length);
    items.push(item);
    state.workouts[today] = items;
    applyPlanTargets();
    els["workout-message"].textContent = best !== null && estimated1RM(item) > best
      ? "★ " + item.name + "の自己ベスト（推定1RM " + fmt(estimated1RM(item), 1) + "kg）を更新しました！" : "";
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
      els["plan-message"].textContent = "目標体重（20〜300kg）と、明日以降の期限を入れてください。";
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
    if (!window.confirm("計画をやめますか？（今の目標値はそのまま残り、手で変えられるようになります）")) return;
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
      els["backup-message"].textContent = "ファイルが大きすぎます（5MBまで）。";
      return;
    }
    file.text().then(function (text) {
      var parsed = JSON.parse(text);
      if (!parsed || parsed.app !== "pfc-calculator" || !parsed.data || typeof parsed.data !== "object") {
        throw new Error("format");
      }
      if (!window.confirm("バックアップを読み込みますか？ この端末の今の記録は、バックアップの内容で置き換わります。")) return;
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
        next.entries = next.entries.filter(function (x) { return !!findFood(x.foodId); });
        state = next;
        rollOverIfNeeded();
        applyPlanTargets();
        saveState();
        renderAll();
        els["backup-message"].textContent = "バックアップを読み込みました。";
      });
    }).catch(function () {
      els["backup-message"].textContent = "このファイルは読み込めませんでした。このアプリで書き出したバックアップを選んでください。";
    });
    e.target.value = "";
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

  // ---------- タブ ----------
  // どのタブを開いていたかは、その端末のブラウザにだけ覚えておく（使えなくても動く）。
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
    var saved = null;
    try { saved = localStorage.getItem("pfc-calculator-tab"); } catch (e) { saved = null; }
    show(saved || "today", false);
  })();

  if (els["today-label"]) els["today-label"].textContent = formatDateLabel(todayString());

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
          "この端末ではすでに購入済みのライセンスキーで Pro が有効です。";
      } else {
        state.pendingSession = sessionId;
        saveState();
      }
    }
    if (state.pendingSession && !state.license) claimLicense(state.pendingSession);
  })();
})();
