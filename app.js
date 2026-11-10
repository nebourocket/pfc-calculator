// PFCかんたん計算ツール
// 入力データは localStorage にのみ保存する（サーバーなし）。
// 日付が変わると、前日までの記録は「過去の記録」に移り、今日の記録は空になる。
(function () {
  "use strict";

  var STORAGE_KEY = "pfc-calculator-v1";
  var FREE_CUSTOM_LIMIT = 5;
  var MAX_GRAMS = 5000;              // 1回の追加で受け付ける量の上限（g）
  var MAX_TARGET = 100000;           // 目標値の上限
  var HISTORY_DAYS_TO_SHOW = 7;      // 過去の記録の表示日数
  var HISTORY_MAX_DAYS = 90;         // 過去の記録の保存日数

  // Pro の利用コード一覧。配布するコードが決まったら、ここに追加する。
  // 現時点では配布コードは未設定（空）。空の間は、どのコードを入れても
  // 「配布はまだ始まっていません」と正直に表示される。
  var PRO_CODES = [];

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

  function loadState() {
    var fallback = {
      entries: [], customFoods: [], targets: sanitizeTargets(null),
      pro: false, day: todayString(), history: {}
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
        history: sanitizeHistory(parsed.history)
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

  // ---------- Pro ----------
  // 利用コードの判定。結果は "ok" / "wrong" / "not-started"（配布前）のいずれか。
  function checkProCode(code) {
    var normalized = String(code == null ? "" : code).trim();
    if (!normalized) return "empty";
    if (PRO_CODES.length === 0) return "not-started";
    return PRO_CODES.indexOf(normalized) !== -1 ? "ok" : "wrong";
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
   "history-list", "history-empty"
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
    var atLimit = !state.pro && state.customFoods.length >= FREE_CUSTOM_LIMIT;
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

  function renderPro() {
    if (state.pro) {
      els["pro-message"].textContent = "Proが有効になっています。ありがとうございます。";
    }
  }

  function renderAll() {
    renderSummary();
    renderSelect();
    renderEntries();
    renderCustomFoods();
    renderTargets();
    renderHistory();
    renderPro();
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
    if (!state.pro && state.customFoods.length >= FREE_CUSTOM_LIMIT) {
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
    var result = checkProCode(document.getElementById("pro-code").value);
    if (result === "empty") return;
    if (result === "ok") {
      state.pro = true;
      saveState();
      renderPro();
      renderCustomFoods();
      els["pro-message"].textContent = "Proが有効になりました。ありがとうございます。";
    } else if (result === "not-started") {
      els["pro-message"].textContent = "利用コードは note メンバーシップ「寝坊ロケットの創作室」で配布予定です。まだ配布は始まっていません。";
    } else {
      els["pro-message"].textContent = "コードが正しくありません。もう一度お確かめください。";
    }
  });

  renderAll();
})();
