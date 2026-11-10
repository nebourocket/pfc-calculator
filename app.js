// PFCかんたん計算ツール — 土台（火曜：リポジトリ作成と土台）
// 入力データは localStorage にのみ保存する（サーバーなし）。
(function () {
  "use strict";

  var STORAGE_KEY = "pfc-calculator-v1";
  var FREE_CUSTOM_LIMIT = 5;
  // Pro 利用コード一覧。金曜の Pro 枠組みで、配布するコードをここに入れる。
  // 現時点ではまだ配布コードがないため、空のままにしておく。
  var PRO_CODES = [];

  var DEFAULT_TARGETS = { kcal: 2000, p: 100, f: 60, c: 250 };

  var state = loadState();

  // ---------- 状態の読み書き ----------
  function loadState() {
    var fallback = { entries: [], customFoods: [], targets: DEFAULT_TARGETS, pro: false };
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return {
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
        customFoods: Array.isArray(parsed.customFoods) ? parsed.customFoods : [],
        targets: Object.assign({}, DEFAULT_TARGETS, parsed.targets || {}),
        pro: parsed.pro === true
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

  // ---------- 食品の検索 ----------
  function findFood(id) {
    if (id.indexOf("custom:") === 0) {
      var customId = id.slice("custom:".length);
      for (var i = 0; i < state.customFoods.length; i++) {
        if (state.customFoods[i].id === customId) return state.customFoods[i];
      }
      return null;
    }
    for (var j = 0; j < window.FOODS.length; j++) {
      if (window.FOODS[j].id === id) return window.FOODS[j];
    }
    return null;
  }

  function allFoodsForSelect() {
    var list = window.FOODS.slice();
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

  function fmt(n, decimals) {
    return n.toLocaleString("ja-JP", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  // ---------- 描画 ----------
  var els = {};
  ["total-kcal", "total-p", "total-f", "total-c",
   "bar-kcal", "bar-p", "bar-f", "bar-c",
   "target-kcal-label", "target-p-label", "target-f-label", "target-c-label",
   "pct-kcal", "pct-p", "pct-f", "pct-c",
   "food-select", "grams-input", "entry-list", "empty-message",
   "custom-list", "custom-limit-message", "pro-message"
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
    var pct = target > 0 ? Math.round((value / target) * 100) : 0;
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
    var categories = [];
    allFoodsForSelect().forEach(function (food) {
      if (categories.indexOf(food.category) === -1) categories.push(food.category);
    });
    categories.forEach(function (category) {
      var group = document.createElement("optgroup");
      group.label = category;
      allFoodsForSelect().forEach(function (food) {
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
    els["empty-message"].classList.toggle("hidden", state.entries.length > 0);
    state.entries.forEach(function (entry) {
      var food = findFood(entry.foodId);
      var v = entryValues(entry);
      if (!food || !v) return;
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
    renderPro();
  }

  // ---------- イベント ----------
  document.getElementById("add-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var foodId = els["food-select"].value;
    var grams = parseFloat(els["grams-input"].value);
    if (!foodId || !(grams > 0)) return;
    state.entries.push({
      id: "e" + Date.now() + Math.floor(Math.random() * 1000),
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
    if (!name || [kcal, p, f, c].some(function (v) { return isNaN(v) || v < 0; })) return;
    state.customFoods.push({
      id: "c" + Date.now() + Math.floor(Math.random() * 1000),
      name: name, kcal: kcal, p: p, f: f, c: c
    });
    saveState();
    renderAll();
    e.target.reset();
  });

  ["kcal", "p", "f", "c"].forEach(function (key) {
    document.getElementById("target-" + key).addEventListener("change", function (e) {
      var v = parseFloat(e.target.value);
      if (isNaN(v) || v < 0) {
        e.target.value = state.targets[key];
        return;
      }
      state.targets[key] = v;
      saveState();
      renderSummary();
    });
  });

  document.getElementById("pro-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var code = document.getElementById("pro-code").value.trim();
    if (!code) return;
    if (PRO_CODES.indexOf(code) !== -1) {
      state.pro = true;
      saveState();
      renderPro();
      renderCustomFoods();
      els["pro-message"].textContent = "Proが有効になりました。ありがとうございます。";
    } else if (PRO_CODES.length === 0) {
      els["pro-message"].textContent = "利用コードの配布はまだ始まっていません。noteメンバーシップの会員の方へ、準備ができしだいお知らせします。";
    } else {
      els["pro-message"].textContent = "コードが正しくありません。もう一度お確かめください。";
    }
  });

  renderAll();
})();
