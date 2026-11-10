// PFCかんたん計算ツール — スモークテスト
// 簡易DOMスタブの上で foods.js / app.js を実行し、主要フローを検証する。
// 実行: node tests/smoke.test.js
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const foodsCode = fs.readFileSync(path.join(ROOT, "foods.js"), "utf8");
const appCode = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

// ---------- 簡易DOMスタブ ----------
class El {
  constructor(tag) {
    this.tagName = String(tag || "div").toUpperCase();
    this.children = [];
    this.parent = null;
    this._text = "";
    this._listeners = {};
    this.style = {};
    this._classes = new Set();
    this._value = undefined;
    this.className = "";
    const classes = this._classes;
    this.classList = {
      add: (...cs) => cs.forEach((c) => classes.add(c)),
      remove: (...cs) => cs.forEach((c) => classes.delete(c)),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : !!force;
        if (on) classes.add(c); else classes.delete(c);
        return on;
      },
      contains: (c) => classes.has(c),
    };
  }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() {
    if (this.children.length) return this.children.map((c) => c.textContent).join("");
    return this._text;
  }
  set innerHTML(v) { if (v === "" || v == null) { this.children = []; this._text = ""; } else { this._text = String(v); } }
  get innerHTML() { return this._text; }
  appendChild(ch) { this.children.push(ch); ch.parent = this; return ch; }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  dispatch(type) {
    const e = { target: this, preventDefault() {} };
    (this._listeners[type] || []).slice().forEach((fn) => fn(e));
  }
  reset() {}
  _options() {
    const out = [];
    const walk = (el) => el.children.forEach((c) => { if (c.tagName === "OPTION") out.push(c); walk(c); });
    walk(this);
    return out;
  }
  get value() {
    if (this.tagName === "SELECT") {
      const opts = this._options();
      if (this._value !== undefined && opts.some((o) => o._value === this._value)) return this._value;
      return opts.length ? opts[0]._value : "";
    }
    return this._value !== undefined ? this._value : "";
  }
  set value(v) { this._value = v; }
}

const TAG_BY_ID = {
  "food-select": "select",
  "add-form": "form", "custom-form": "form", "target-form": "form", "pro-form": "form",
  "entry-list": "ul", "custom-list": "ul", "history-list": "ul",
  "reset-button": "button",
};

function makeDocument() {
  const registry = {};
  return {
    registry,
    getElementById(id) {
      if (!registry[id]) {
        const el = new El(TAG_BY_ID[id] || "div");
        el.id = id;
        registry[id] = el;
      }
      return registry[id];
    },
    createElement(tag) { return new El(tag); },
  };
}

function makeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

// アプリを新しいDOMで起動する（localStorageは渡したものを共有＝リロード再現）。
function launch(storage) {
  const documentStub = makeDocument();
  const windowStub = { confirm: () => true };
  const sandbox = {
    window: windowStub,
    document: documentStub,
    localStorage: storage,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(foodsCode, sandbox);
  vm.runInContext(appCode, sandbox);
  return { document: documentStub, storage };
}

// ---------- テストユーティリティ ----------
let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { passed += 1; console.log("  ok - " + name); }
  else { failed += 1; console.log("  NG - " + name); }
}
function byId(env, id) { return env.document.getElementById(id); }
function text(env, id) { return byId(env, id).textContent; }
function num(env, id) { return parseFloat(String(text(env, id)).replace(/,/g, "")); }
function approx(a, b, tol) { return Math.abs(a - b) <= (tol || 0.11); }
function submit(env, formId) { byId(env, formId).dispatch("submit"); }
function setVal(env, id, v) { byId(env, id).value = v; }
function change(env, id, v) { const el = byId(env, id); el.value = v; el.dispatch("change"); }

const STORAGE_KEY = "pfc-calculator-v1";

// ============ メインフロー ============
console.log("[メインフロー]");
{
  const storage = makeLocalStorage();
  const env = launch(storage);

  check("初期表示は合計0kcal", text(env, "total-kcal") === "0");
  check("初期表示は空メッセージが見える", !byId(env, "empty-message").classList.contains("hidden"));
  check("初期表示は過去の記録が空", !byId(env, "history-empty").classList.contains("hidden"));

  // ごはん150gを追加（セレクトの初期値は先頭のごはん）
  setVal(env, "grams-input", "150");
  submit(env, "add-form");
  check("ごはん150gで234kcal", approx(num(env, "total-kcal"), 234, 0.6));
  check("記録が1件になる", byId(env, "entry-list").children.length === 1);
  check("空メッセージが隠れる", byId(env, "empty-message").classList.contains("hidden"));
  check("達成率は12%（234/2000）", text(env, "pct-kcal") === "12");

  // 鶏むね肉200gを追加
  setVal(env, "food-select", "chicken-breast");
  setVal(env, "grams-input", "200");
  submit(env, "add-form");
  check("鶏むね200g追加で合計444kcal", approx(num(env, "total-kcal"), 444, 0.6));
  check("たんぱく質は約50.4g", approx(num(env, "total-p"), 50.4, 0.11));

  // 目標2000kcalに対して22%
  check("達成率22%", text(env, "pct-kcal") === "22");

  // 1件目（ごはん）を削除
  const firstDeleteBtn = byId(env, "entry-list").children[0].children[1];
  firstDeleteBtn.dispatch("click");
  check("削除後は210kcal", approx(num(env, "total-kcal"), 210, 0.6));
  check("削除後は記録1件", byId(env, "entry-list").children.length === 1);

  // 異常な量は受け付けない
  const before = byId(env, "entry-list").children.length;
  ["", "-5", "abc", "99999", "0"].forEach((g) => {
    setVal(env, "grams-input", g);
    submit(env, "add-form");
  });
  check("空・負数・NaN・上限超え・0は追加されない", byId(env, "entry-list").children.length === before);

  // 目標0 → 割り算せず0%
  change(env, "target-kcal", "0");
  check("目標0で達成率は0%", text(env, "pct-kcal") === "0");
  check("目標0でバーは0%", byId(env, "bar-kcal").style.width === "0%");

  // 目標100 → 210%表示・バーは100%上限・overクラス
  change(env, "target-kcal", "100");
  check("達成率210%と表示される", text(env, "pct-kcal") === "210");
  check("バー幅は100%で頭打ち", byId(env, "bar-kcal").style.width === "100%");
  check("バーにoverクラスが付く", byId(env, "bar-kcal").classList.contains("over"));

  // 負の目標は元に戻る
  change(env, "target-kcal", "-50");
  check("負の目標は100のまま", text(env, "target-kcal-label") === "100");

  // 全削除
  byId(env, "reset-button").dispatch("click");
  check("全削除で合計0", text(env, "total-kcal") === "0");
  check("全削除で空メッセージ復帰", !byId(env, "empty-message").classList.contains("hidden"));

  // 自由枠を登録して使う
  setVal(env, "custom-name", "テスト食品");
  setVal(env, "custom-kcal", "200");
  setVal(env, "custom-p", "10");
  setVal(env, "custom-f", "5");
  setVal(env, "custom-c", "20");
  submit(env, "custom-form");
  check("自由枠が1件登録される", byId(env, "custom-list").children.length === 1);
  const opts = byId(env, "food-select")._options();
  check("セレクトに自由枠が増える（31件）", opts.length === 31);
  const customOpt = opts[opts.length - 1];
  setVal(env, "food-select", customOpt.value);
  setVal(env, "grams-input", "50");
  submit(env, "add-form");
  check("自由枠50gで100kcal", approx(num(env, "total-kcal"), 100, 0.6));

  // 自由枠を消すと、それを使った記録も消える
  const customDeleteBtn = byId(env, "custom-list").children[0].children[1];
  customDeleteBtn.dispatch("click");
  check("自由枠削除で登録0件", byId(env, "custom-list").children.length === 0);
  check("自由枠削除で連動して記録も0件", byId(env, "entry-list").children.length === 0);
  check("自由枠削除で合計0", text(env, "total-kcal") === "0");

  // 上限：5件まで登録でき、6件目は拒否される
  for (let i = 1; i <= 5; i += 1) {
    setVal(env, "custom-name", "食品" + i);
    setVal(env, "custom-kcal", "100");
    setVal(env, "custom-p", "5");
    setVal(env, "custom-f", "2");
    setVal(env, "custom-c", "10");
    submit(env, "custom-form");
  }
  check("自由枠5件まで登録できる", byId(env, "custom-list").children.length === 5);
  check("上限メッセージが表示される", !byId(env, "custom-limit-message").classList.contains("hidden"));
  setVal(env, "custom-name", "食品6");
  setVal(env, "custom-kcal", "100");
  setVal(env, "custom-p", "5");
  setVal(env, "custom-f", "2");
  setVal(env, "custom-c", "10");
  submit(env, "custom-form");
  check("6件目は登録されない", byId(env, "custom-list").children.length === 5);

  // 範囲外の自由枠（kcal 2000）は拒否される（別ストレージで確認するため件数は変わらない前提で
  // 上限到達中なので、ここでは値検証は壊れたデータ側のテストで担保する）

  // Pro：配布前はどのコードでも有効にならない
  setVal(env, "pro-code", "DUMMY-CODE-1234");
  submit(env, "pro-form");
  check("Pro配布前の案内が表示される", text(env, "pro-message").includes("配布予定"));
  check("Pro配布前の案内に「まだ配布は始まっていません」", text(env, "pro-message").includes("まだ配布は始まっていません"));

  // 保存と復元：同じlocalStorageで再起動
  const env2 = launch(storage);
  check("再起動後も自由枠5件が復元される", byId(env2, "custom-list").children.length === 5);
  check("再起動後も目標100が復元される", text(env2, "target-kcal-label") === "100");
}

// ============ 壊れた保存データ ============
console.log("[壊れた保存データ]");
{
  const storage = makeLocalStorage();
  storage.setItem(STORAGE_KEY, "{broken json");
  const env = launch(storage);
  check("JSONが壊れていても初期表示できる", text(env, "total-kcal") === "0");

  const storage2 = makeLocalStorage();
  const nowD = new Date();
  const todayStr = nowD.getFullYear() + "-" + String(nowD.getMonth() + 1).padStart(2, "0") + "-" + String(nowD.getDate()).padStart(2, "0");
  storage2.setItem(STORAGE_KEY, JSON.stringify({
    entries: [
      { id: "x", foodId: "rice", grams: "abc" },
      { id: "y", foodId: "rice", grams: 100 },
      { id: "z", foodId: "custom:gone", grams: 100 },
      { id: "w", foodId: "unknown-food", grams: 100 },
    ],
    customFoods: [{ id: "bad", name: "", kcal: -1, p: 0, f: 0, c: 0 }],
    targets: { kcal: "xyz", p: -5 },
    history: { "bad-date": { kcal: 1, p: 1, f: 1, c: 1 }, "2026-11-09": { kcal: "NaN", p: 1, f: 1, c: 1 } },
    day: todayStr,
    pro: "yes",
  }));
  const env2 = launch(storage2);
  check("不正なgramsの記録は捨てられ、正常な1件だけ数える", approx(num(env2, "total-kcal"), 156, 0.6));
  check("不正な目標kcalは初期値2000に戻る", text(env2, "target-kcal-label") === "2,000");
  check("負の目標pは0に丸める", text(env2, "target-p-label") === "0");
  check("達成率にNaNが混ざらない",
    !text(env2, "pct-kcal").includes("NaN") && !text(env2, "pct-p").includes("NaN"));
  check("不正な履歴は表示されない", byId(env2, "history-list").children.length === 0);
  check("不正な自由枠は登録されない", byId(env2, "custom-list").children.length === 0);
}

// ============ 日付の繰り越し ============
console.log("[日付の繰り越し]");
{
  const storage = makeLocalStorage();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const pad = (n) => String(n).padStart(2, "0");
  const yStr = yesterday.getFullYear() + "-" + pad(yesterday.getMonth() + 1) + "-" + pad(yesterday.getDate());
  storage.setItem(STORAGE_KEY, JSON.stringify({
    entries: [{ id: "e1", foodId: "rice", grams: 100 }],
    customFoods: [],
    targets: { kcal: 2000, p: 100, f: 60, c: 250 },
    history: {},
    day: yStr,
    pro: false,
  }));
  const env = launch(storage);
  check("日付が変わると今日の記録は空になる", byId(env, "entry-list").children.length === 0);
  check("今日の合計は0から始まる", text(env, "total-kcal") === "0");
  check("前日分が過去の記録に1件残る", byId(env, "history-list").children.length === 1);
  const detail = byId(env, "history-list").children[0].children[0].children[1].textContent;
  check("過去の記録に前日の156kcalが入る", detail.includes("156kcal"));
  check("過去の記録の空メッセージが隠れる", byId(env, "history-empty").classList.contains("hidden"));
}

console.log("");
console.log("結果: " + passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
