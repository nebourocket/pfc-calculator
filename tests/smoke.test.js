// PFCかんたん計算ツール — スモークテスト
// 簡易DOMスタブの上で foods.js / app.js を実行し、主要フローを検証する。
// 実行: node tests/smoke.test.js
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const foodsCode = fs.readFileSync(path.join(ROOT, "foods.js"), "utf8");
const offFoodsCode = fs.readFileSync(path.join(ROOT, "off-foods.js"), "utf8");
const offMoreCode = fs.readFileSync(path.join(ROOT, "off-foods-more.js"), "utf8");
const appCode = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const i18nCode = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");

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
  get parentNode() { return this.parent; }
  appendChild(ch) { this.children.push(ch); ch.parent = this; return ch; }
  setAttribute(k, v) { (this.attrs = this.attrs || {})[k] = String(v); }
  removeChild(ch) {
    this.children = this.children.filter((c) => c !== ch);
    if (ch.parent === this) ch.parent = null;
    return ch;
  }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  dispatch(type) {
    const e = { target: this, preventDefault() {} };
    (this._listeners[type] || []).slice().forEach((fn) => fn(e));
  }
  click() { this.dispatch("click"); }
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
  "auto-sex": "select", "auto-activity": "select", "auto-goal": "select",
  "add-form": "form", "custom-form": "form", "target-form": "form", "pro-form": "form",
  "entry-list": "ul", "custom-list": "ul", "history-list": "ul",
  "reset-button": "button", "today-csv-button": "button",
  "history-csv-button": "button", "auto-calc-button": "button",
  "pro-disable-button": "button",
  "weight-form": "form", "workout-form": "form", "plan-form": "form",
  "plan-clear-button": "button", "backup-export-button": "button", "set-save-form": "form",
};

function makeDocument() {
  const registry = {};
  return {
    registry,
    body: new El("body"),
    head: new El("head"),
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

// ダウンロードされた Blob を捕まえるためのフェイク。
const downloads = [];
class FakeBlob {
  constructor(parts, opts) {
    this.parts = parts;
    this.type = (opts && opts.type) || "";
  }
}
const FakeURL = {
  createObjectURL(blob) {
    downloads.push(blob);
    return "blob:fake-" + downloads.length;
  },
  revokeObjectURL() {},
};
function lastDownloadText() {
  if (!downloads.length) return "";
  return downloads[downloads.length - 1].parts.join("");
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
// opts: config（window.PFC_CONFIG）・search（URL の ?以降）・fetch（フェイク）
function launch(storage, opts) {
  opts = opts || {};
  const documentStub = makeDocument();
  const replaced = [];
  const windowStub = {
    confirm: () => true,
    PFC_CONFIG: opts.config,
    location: { search: opts.search || "", pathname: "/pfc-calculator/", hash: "" },
    history: { replaceState: (a, b, url) => replaced.push(url) },
  };
  const sandbox = {
    window: windowStub,
    document: documentStub,
    localStorage: storage,
    console,
    Blob: FakeBlob,
    URL: FakeURL,
    setTimeout, clearTimeout,
    crypto: globalThis.crypto,
    TextEncoder, TextDecoder, atob, URLSearchParams,
    fetch: opts.fetch,
  };
  vm.createContext(sandbox);
  vm.runInContext(foodsCode, sandbox);
  vm.runInContext(offFoodsCode, sandbox);
  if (opts.i18n) vm.runInContext(i18nCode, sandbox);
  vm.runInContext(appCode, sandbox);
  return { document: documentStub, storage, replaced, sandbox };
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
  const commonCount = (() => { const w = {}; new Function("window", foodsCode)(w); return w.FOODS.filter((f) => f.common).length; })();
  check("セレクトに自由枠が増える（よく使う食品＋1件）", opts.length === commonCount + 1);
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

  // Pro：未解錠では Pro 用 UI が隠れている
  check("未解錠ではPro有効表示が隠れている", byId(env, "pro-active").classList.contains("hidden"));
  check("未解錠ではグラフのロック表示が見える", !byId(env, "chart-locked").classList.contains("hidden"));
  check("未解錠ではCSVボタンが隠れている", byId(env, "today-csv-button").classList.contains("hidden"));
  check("未解錠では自動計算フォームが隠れている", byId(env, "auto-calc-area").classList.contains("hidden"));

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

// ============ Pro（解錠・自動計算・グラフ・CSV） ============
function flush() { return new Promise((r) => setTimeout(r, 20)); }
function addOptions(env, id, values) {
  const sel = byId(env, id);
  values.forEach((v) => {
    const o = env.document.createElement("option");
    o.value = v;
    sel.appendChild(o);
  });
}
function readProCode() {
  try {
    const raw = fs.readFileSync(path.join(ROOT, "..", "pfc-pro-code.txt"), "utf8");
    const m = raw.match(/コード:\s*(\S+)/);
    return m ? m[1] : null;
  } catch (e) {
    return null;
  }
}

(async () => {
  console.log("[Pro機能]");
  const code = readProCode();
  check("平文コードファイル（リポジトリ外）を読める", !!code);

  // --- 誤コードは拒否される ---
  const storage = makeLocalStorage();
  const env = launch(storage);
  setVal(env, "pro-code", "PFC-XXXXXX-XXXXXX");
  submit(env, "pro-form");
  await flush();
  check("誤ったコードは拒否される", text(env, "pro-message").includes("正しくありません"));
  check("誤ったコードでは解錠されない", byId(env, "pro-active").classList.contains("hidden"));

  // --- 空コードでは何も起きない ---
  setVal(env, "pro-code", "   ");
  submit(env, "pro-form");
  await flush();
  check("空コードでは解錠されない", byId(env, "pro-active").classList.contains("hidden"));

  if (code) {
    // --- 正しいコード（小文字・前後空白あり）で解錠される ---
    setVal(env, "pro-code", "  " + code.toLowerCase() + " ");
    submit(env, "pro-form");
    await flush();
    check("正しいコードでProが有効になる", !byId(env, "pro-active").classList.contains("hidden"));
    check("解錠するとコード入力側が隠れる", byId(env, "pro-locked").classList.contains("hidden"));
    check("解錠するとグラフのロック表示が消える", byId(env, "chart-locked").classList.contains("hidden"));
    check("解錠するとグラフエリアが見える", !byId(env, "chart-area").classList.contains("hidden"));
    check("解錠するとCSVボタンが見える", !byId(env, "today-csv-button").classList.contains("hidden"));
    check("解錠すると自動計算フォームが見える", !byId(env, "auto-calc-area").classList.contains("hidden"));

    // --- 解錠状態の永続化 ---
    const env2 = launch(storage);
    check("再起動後もProが有効なまま", !byId(env2, "pro-active").classList.contains("hidden"));

    // --- 自由枠の上限差分：Proでは6件目も登録できる ---
    for (let i = 1; i <= 6; i += 1) {
      setVal(env2, "custom-name", "Pro食品" + i);
      setVal(env2, "custom-kcal", "100");
      setVal(env2, "custom-p", "5");
      setVal(env2, "custom-f", "2");
      setVal(env2, "custom-c", "10");
      submit(env2, "custom-form");
    }
    check("Proでは自由枠を6件登録できる（無料上限5超）", byId(env2, "custom-list").children.length === 6);
    check("Proでは上限メッセージが出ない", byId(env2, "custom-limit-message").classList.contains("hidden"));

    // --- 目標の自動計算（代表値） ---
    addOptions(env2, "auto-sex", ["male", "female"]);
    addOptions(env2, "auto-activity", ["1.2", "1.375", "1.55", "1.725"]);
    addOptions(env2, "auto-goal", ["cut", "maintain", "bulk"]);
    setVal(env2, "auto-sex", "male");
    setVal(env2, "auto-age", "30");
    setVal(env2, "auto-height", "170");
    setVal(env2, "auto-weight", "65");
    setVal(env2, "auto-activity", "1.55");
    setVal(env2, "auto-goal", "maintain");
    byId(env2, "auto-calc-button").dispatch("click");
    // 男性30歳・170cm・65kg：BMR 1567.5 → TDEE 2429.6 → 目標 2430kcal
    check("自動計算（維持）の目標kcalは2,430", num(env2, "target-kcal-label") === 2430);
    check("自動計算のたんぱく質は130g（体重×2）", num(env2, "target-p-label") === 130);
    check("自動計算の脂質は68g（25%）", num(env2, "target-f-label") === 68);
    check("自動計算の炭水化物は325g（残り）", num(env2, "target-c-label") === 325);
    check("自動計算の結果に基礎代謝が表示される", text(env2, "auto-calc-result").includes("基礎代謝"));

    // 減量：TDEE×0.8 = 1944（基礎代謝1568を下回らない）
    setVal(env2, "auto-goal", "cut");
    byId(env2, "auto-calc-button").dispatch("click");
    check("自動計算（減量）の目標kcalは1,944", num(env2, "target-kcal-label") === 1944);

    // 増量：TDEE×1.1 = 2673
    setVal(env2, "auto-goal", "bulk");
    byId(env2, "auto-calc-button").dispatch("click");
    check("自動計算（増量）の目標kcalは2,673", num(env2, "target-kcal-label") === 2673);

    // プロフィールが保存され、再起動で入力が復元される
    const env3 = launch(storage);
    check("再起動で自動計算の入力（体重）が復元される", String(byId(env3, "auto-weight").value) === "65");

    // --- Proをやめる ---
    byId(env3, "pro-disable-button").dispatch("click");
    check("Proをやめると無料版に戻る", !byId(env3, "pro-locked").classList.contains("hidden"));
    const env4 = launch(storage);
    check("解除状態も保存される", !byId(env4, "pro-locked").classList.contains("hidden"));
  }

  // --- グラフとCSV（履歴を仕込んだ状態） ---
  console.log("[Pro：グラフとCSV]");
  const storage2 = makeLocalStorage();
  const pad = (n) => String(n).padStart(2, "0");
  const dayStr = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const d3 = new Date(); d3.setDate(d3.getDate() - 3);
  const d1 = new Date(); d1.setDate(d1.getDate() - 1);
  storage2.setItem(STORAGE_KEY, JSON.stringify({
    entries: [],
    customFoods: [],
    targets: { kcal: 2000, p: 100, f: 60, c: 250 },
    history: {
      [dayStr(d3)]: { kcal: 1000, p: 50, f: 30, c: 120 },
      [dayStr(d1)]: { kcal: 500, p: 25, f: 15, c: 60 },
    },
    day: dayStr(new Date()),
    pro: false,
  }));
  const genv = launch(storage2);
  check("未解錠ではグラフにデータ列が出ない", byId(genv, "chart-plot").children.length === 0);
  if (code) {
    setVal(genv, "pro-code", code);
    submit(genv, "pro-form");
    await flush();
    const cols = byId(genv, "chart-plot").children.filter((c) => c.className === "chart-col");
    check("グラフは30日分の列を表示する", cols.length === 30);
    check("グラフの日付ラベルの場所は30個", byId(genv, "chart-labels").children.length === 30);
    const heights = cols.map((c) => c.children[0].style.height);
    check("1000kcalの日は目標2000比で50%の高さ", heights.includes("50%"));
    check("500kcalの日は25%の高さ", heights.includes("25%"));
    const line = byId(genv, "chart-plot").children.find((c) => c.className === "chart-target-line");
    check("目標ラインが表示される", !!line);
    check("目標ラインは100%の位置", !!line && line.style.bottom === "100%");
    check("データがあるので空メッセージは隠れる", byId(genv, "chart-empty").classList.contains("hidden"));

    // 今日の記録を入れてCSV出力
    setVal(genv, "grams-input", "150");
    submit(genv, "add-form");
    const beforeCount = downloads.length;
    byId(genv, "today-csv-button").dispatch("click");
    check("今日のCSVがダウンロードされる", downloads.length === beforeCount + 1);
    const todayCsv = lastDownloadText();
    check("今日のCSVはBOM付き", todayCsv.charCodeAt(0) === 0xfeff);
    check("今日のCSVに見出し行がある", todayCsv.includes("食品名,量(g),カロリー(kcal)"));
    check("今日のCSVにごはん150gの行がある", todayCsv.includes("ごはん（精白米・炊いたもの）,150,234"));
    check("今日のCSVに合計行がある", todayCsv.includes("合計,,234"));

    byId(genv, "history-csv-button").dispatch("click");
    const histCsv = lastDownloadText();
    check("履歴CSVに見出し行がある", histCsv.includes("日付,カロリー(kcal)"));
    check("履歴CSVに3日前の行がある", histCsv.includes(dayStr(d3) + ",1000,50,30,120"));
    check("履歴CSVに今日の行がある", histCsv.includes(dayStr(new Date()) + ",234"));
  }


  // ============ 買い切り Pro（Stripe 決済 → ライセンスキー） ============
  console.log("[買い切り Pro]");
  {
    const flush = () => new Promise((r) => setTimeout(r, 30));
    const { issueLicense } = await import(path.join(ROOT, "worker", "src", "index.js"));
    const pair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const privText = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey));
    const pubJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    const config = {
      paymentLinkUrl: "https://buy.stripe.com/test_abc",
      licenseApiUrl: "https://pfc-license.example.workers.dev/license",
      licensePublicJwk: pubJwk,
    };
    const SID = "cs_test_a1B2c3D4e5F6g7H8i9J0";
    const license = await issueLicense(SID, privText);

    // 設定が空なら、購入ボタンは出さず「準備中」
    {
      const env = launch(makeLocalStorage());
      check("設定が空なら購入ボタンは隠れる", byId(env, "buy-area").classList.contains("hidden"));
      check("設定が空なら準備中と表示", !byId(env, "buy-pending").classList.contains("hidden"));
    }
    // Stripe 以外の決済 URL は受け付けない
    {
      const env = launch(makeLocalStorage(), { config: { ...config, paymentLinkUrl: "https://evil.example/pay" } });
      check("Stripe 以外の URL では購入ボタンを出さない", byId(env, "buy-area").classList.contains("hidden"));
    }
    // 設定があれば購入ボタンが Payment Link を指す
    {
      const env = launch(makeLocalStorage(), { config });
      check("設定があれば購入ボタンが見える", !byId(env, "buy-area").classList.contains("hidden"));
      check("購入ボタンは Payment Link を指す", byId(env, "buy-link").href === config.paymentLinkUrl);
    }

    // Stripe から戻ってくる → Worker からキーを受け取る → Pro が有効
    const storage = makeLocalStorage();
    const calls = [];
    const okFetch = async (url) => {
      calls.push(url);
      return { status: 200, json: async () => ({ license }) };
    };
    const env = launch(storage, { config, search: "?session_id=" + SID, fetch: okFetch });
    await flush();
    check("戻ってきたら URL から session_id を消す", env.replaced.length === 1 && !env.replaced[0].includes("session_id"));
    check("Worker に session_id を問い合わせる", calls.length === 1 && calls[0] === config.licenseApiUrl + "?session_id=" + SID);
    check("支払い確認で Pro が有効になる", !byId(env, "pro-active").classList.contains("hidden"));
    check("ライセンスキーが表示される", byId(env, "license-key").value === license);
    check("キーの表示欄が見える", !byId(env, "license-area").classList.contains("hidden"));
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    check("キーが保存され、保留中の session は消える", saved.license === license && saved.pendingSession === null);

    // 再読み込みしても Pro のまま・二重に問い合わせない
    const env2 = launch(storage, { config, fetch: okFetch });
    await flush();
    check("再起動後も Pro のまま", !byId(env2, "pro-active").classList.contains("hidden"));
    check("キーがあれば再問い合わせしない", calls.length === 1);

    // 別の端末でキーを入力
    {
      const other = launch(makeLocalStorage(), { config });
      setVal(other, "pro-code", "  " + license + "  ");
      submit(other, "pro-form");
      await flush();
      check("別の端末でキーを入れると Pro になる", !byId(other, "pro-active").classList.contains("hidden"));
    }
    // 改ざんしたキー・別の鍵で署名したキーは拒否
    {
      const other = launch(makeLocalStorage(), { config });
      const parts = license.split(".");
      const forgedPayload = Buffer.from(JSON.stringify({ v: 1, sid: "x", iat: 1 })).toString("base64url");
      setVal(other, "pro-code", parts[0] + "." + forgedPayload + "." + parts[2]);
      submit(other, "pro-form");
      await flush();
      check("改ざんしたキーは拒否される", byId(other, "pro-active").classList.contains("hidden"));
      check("改ざんしたキーにはエラーを出す", text(other, "pro-message").includes("正しくありません"));

      const pair2 = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const fake = await issueLicense(SID, JSON.stringify(await crypto.subtle.exportKey("jwk", pair2.privateKey)));
      setVal(other, "pro-code", fake);
      submit(other, "pro-form");
      await flush();
      check("別の秘密鍵で作ったキーは拒否される", byId(other, "pro-active").classList.contains("hidden"));
    }
    // 未払い (402) なら Pro にせず、保留も捨てる
    {
      const st = makeLocalStorage();
      const e = launch(st, { config, search: "?session_id=" + SID,
        fetch: async () => ({ status: 402, json: async () => ({ error: "not_paid" }) }) });
      await flush();
      check("未払いなら Pro にならない", byId(e, "pro-active").classList.contains("hidden"));
      check("未払いならメッセージを出す", text(e, "pro-message").includes("まだ確認できていません"));
      check("未払い (反映待ち) の session は保留して再確認する", JSON.parse(st.getItem(STORAGE_KEY)).pendingSession === SID);
      const e2 = launch(st, { config, fetch: okFetch });
      await flush();
      check("支払いが反映されたら次の起動で Pro になる", !byId(e2, "pro-active").classList.contains("hidden"));
    }
    // 形式の壊れた session_id (Worker が bad_session_id) は捨てる
    {
      const st = makeLocalStorage();
      launch(st, { config, search: "?session_id=" + SID,
        fetch: async () => ({ status: 400, json: async () => ({ error: "bad_session_id" }) }) });
      await flush();
      check("bad_session_id なら保留を捨てる", JSON.parse(st.getItem(STORAGE_KEY)).pendingSession === null);
    }
    // 通信エラーなら保留して、次の起動でもう一度確認する
    {
      const st = makeLocalStorage();
      const e = launch(st, { config, search: "?session_id=" + SID,
        fetch: async () => { throw new Error("offline"); } });
      await flush();
      check("通信エラーでは Pro にならない", byId(e, "pro-active").classList.contains("hidden"));
      check("通信エラーでは session を保留する", JSON.parse(st.getItem(STORAGE_KEY)).pendingSession === SID);
      const e2 = launch(st, { config, fetch: okFetch });
      await flush();
      check("次の起動で再確認して Pro になる", !byId(e2, "pro-active").classList.contains("hidden"));
    }
    // Worker が返したキーが偽物なら Pro にしない
    {
      const e = launch(makeLocalStorage(), { config, search: "?session_id=" + SID,
        fetch: async () => ({ status: 200, json: async () => ({ license: license.slice(0, -4) + "AAAA" }) }) });
      await flush();
      check("署名が合わない応答では Pro にならない", byId(e, "pro-active").classList.contains("hidden"));
    }
    // Pro をやめるとキーも消える
    {
      byId(env2, "pro-disable-button").dispatch("click");
      check("Proをやめるとキーも消える", JSON.parse(storage.getItem(STORAGE_KEY)).license === null);
    }
  }

  // ============ 今日のお皿（円の図） ============
  console.log("[今日の皿]");
  {
    const st = makeLocalStorage();
    st.setItem(STORAGE_KEY, JSON.stringify({ targets: { kcal: 2000, p: 100, f: 60, c: 250 }, entries: [{ id: "a", foodId: "chicken-breast", grams: 200 }] }));
    const env = launch(st);
    const arc = (id) => parseFloat(byId(env, id).attrs["stroke-dasharray"]);
    // 鶏むね 200g：P 46.6g×4＝186.4、F 3.8g×9＝34.2、C 0.2g×4＝0.8 → 合計 221.4kcal のうちの割合
    check("たんぱく質の割合は 186.4/221.4", text(env, "share-p") === String(Math.round(186.4 / 221.4 * 100)));
    check("脂質の割合は 34.2/221.4", text(env, "share-f") === String(Math.round(34.2 / 221.4 * 100)));
    check("P の弧は割合からすき間を引いた長さ", Math.abs(arc("plate-p") - (186.4 / 221.4 * 100 - 1)) < 0.01);
    check("F の弧は P のあとから始まる", Math.abs(parseFloat(byId(env, "plate-f").attrs["stroke-dashoffset"]) + 186.4 / 221.4 * 100) < 0.01);
    check("外周は目標までの割合", Math.abs(arc("plate-rim") - byId(env, "nf-kcal").textContent.replace(/,/g, "") / 2000 * 100) < 0.01);
    check("目標未満なら朱の輪は無し", arc("plate-over") === 0);
    check("残りのカロリーを表示", text(env, "remaining-kcal") === "あと 1,790 kcal");
    setVal(env, "food-select", "rice"); setVal(env, "grams-input", "1300");
    submit(env, "add-form");
    check("目標を超えるとオーバーと表示", text(env, "remaining-kcal").includes("オーバー") && byId(env, "remaining-kcal").classList.contains("is-over"));
    check("超えたら外周は1周、超えた分を朱の輪で描く", arc("plate-rim") === 100 && arc("plate-over") > 0);
  }

  // ============ 最近食べたもの・前日と同じもの（無料） ============
  console.log("[最近食べたもの]");
  {
    const pad2 = (n) => String(n).padStart(2, "0");
    const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); };
    const st = makeLocalStorage();
    const env = launch(st);
    const saved = () => JSON.parse(st.getItem(STORAGE_KEY));
    check("最初は最近食べたものを出さない", byId(env, "recent-area").classList.contains("hidden"));
    setVal(env, "food-select", "rice"); setVal(env, "grams-input", "180"); submit(env, "add-form");
    setVal(env, "food-select", "egg"); setVal(env, "grams-input", "50"); submit(env, "add-form");
    setVal(env, "food-select", "rice"); setVal(env, "grams-input", "200"); submit(env, "add-form");
    const chips = byId(env, "recent-list").children;
    check("同じ食品は1つにまとめ、新しい順", chips.length === 2 && chips[0].textContent.includes("ごはん") && chips[0].textContent.includes("200g"));
    chips[1].click();
    check("ワンタップで今日の記録に追加", saved().entries.length === 4 && saved().entries[3].foodId === "egg" && saved().entries[3].grams === 50);

    // 日付が変わると前日の食べたものを残し、1つのボタンで追加できる
    const st2 = makeLocalStorage();
    st2.setItem(STORAGE_KEY, JSON.stringify({ day: ago(1), entries: [{ id: "a", foodId: "rice", grams: 150 }, { id: "b", foodId: "natto", grams: 45 }] }));
    const env2 = launch(st2);
    const s2 = () => JSON.parse(st2.getItem(STORAGE_KEY));
    check("前日の食べたものが残る", s2().lastDay && s2().lastDay.date === ago(1) && s2().lastDay.entries.length === 2);
    check("「昨日と同じもの」ボタンが出る", !byId(env2, "copy-last-button").classList.contains("hidden") && text(env2, "copy-last-button").includes("昨日と同じものを追加する（2品）"));
    byId(env2, "copy-last-button").click();
    check("押すと昨日の食べたものが今日に入る", s2().entries.length === 2 && text(env2, "total-kcal") !== "0");
    const st3 = makeLocalStorage();
    st3.setItem(STORAGE_KEY, JSON.stringify({ day: ago(0), lastDay: { date: ago(3), entries: [{ id: "a", foodId: "rice", grams: 150 }] } }));
    const env3 = launch(st3);
    check("昨日でなければ日付を書く", text(env3, "copy-last-button").includes("日（") && !text(env3, "copy-last-button").startsWith("昨日"));
  }

  // ============ 食品の検索・セット ============
  console.log("[食品の検索・セット]");
  {
    const optionValues = (env) => { const out = []; const walk = (el) => el.children.forEach((c) => { if (c.tagName === "OPTION") out.push(c._value); walk(c); }); walk(byId(env, "food-select")); return out; };
    const env = launch(makeLocalStorage());
    // 検索すると読みにいく追加データは、すぐ読み込めたことにする。
    const search = (q) => {
      const el = byId(env, "food-search"); el.value = q; el.dispatch("input");
      const sc = env.document.head.children[0];
      if (sc && !sc._done) { sc._done = true; vm.runInContext(offMoreCode, env.sandbox); sc.onload(); }
    };
    check("何も探していないときは、よく使う食品だけ並ぶ", optionValues(env).length < 120 && optionValues(env).includes("rice"));
    check("何も探していないときは、ほかの食品を探せると案内", text(env, "food-search-count").includes("上の欄で探せます"));
    search("ヨーグルト");
    check("カタカナで探せる（よく使う食品が先）", optionValues(env)[0].startsWith("yogurt") && optionValues(env).length >= 3);
    search("よーぐると");
    check("ひらがなでもカタカナの食品が見つかる", optionValues(env).includes("yogurt"));
    search("とり むね");
    check("空白で区切ったことばで絞り込める（成分表の名前も対象）", optionValues(env).includes("chicken-breast") && !optionValues(env).includes("rice"));
    check("見つかった件数を表示", text(env, "food-search-count").includes("件見つかりました"));
    check("見つかった先頭の食品が選ばれる", byId(env, "food-select").value === optionValues(env)[0]);
    search("ぜったいにないたべもの");
    check("見つからなければ案内を出す", text(env, "food-search-count").includes("見つかりませんでした"));
    search("ぶり 焼き");
    check("成分表の全食品からも探せる", optionValues(env).includes("m10242"));
    search("ごはん");
    check("「ごはん」で成分表の「めし」も見つかる", optionValues(env).includes("m01154"));
    search("生");
    check("当たりが多すぎるときは100件まで", optionValues(env).length === 100 && text(env, "food-search-count").includes("先頭の100件"));
    {
      const w = {}; new Function("window", offFoodsCode)(w);
      const sample = w.OFF_FOODS[0];
      search(sample.name.split("（")[0]);
      check("市販品も探せる（" + sample.name + "）", optionValues(env).includes(sample.id));
      const ids = new Set(w.OFF_FOODS.map((f) => f.id));
      check("市販品の id は重ならない", ids.size === w.OFF_FOODS.length);
      const more = []; { const m = {}; new Function("window", offMoreCode)(m); more.push(...m.OFF_FOODS_MORE); }
      check("追加データの id は既存の市販品とも重ならない", more.every((r) => !ids.has("off:" + r[0])) &&
        new Set(more.map((r) => r[0])).size === more.length);
      check("追加データも kcal と PFC が整合している", more.every((r) => Math.abs(r[2] - (r[3] * 4 + r[4] * 9 + r[5] * 4)) <= Math.max(25.5, r[2] * 0.25 + 0.5)));
      search("");
      const shown = parseInt((text(env, "food-search-count").match(/全(\d+)品/) || [])[1], 10);
      check("読み込み後は全品の件数を案内（成分表＋市販品＋追加データ）", shown > w.OFF_FOODS.length + more.length);
      check("市販品は kcal と PFC が整合している", w.OFF_FOODS.every((f) => Math.abs(f.kcal - (f.p * 4 + f.f * 9 + f.c * 4)) <= Math.max(25.5, f.kcal * 0.25 + 0.5)));
    }
    search("");
    check("空にすると、よく使う食品に戻る", optionValues(env).length < 120);
  }
  {
    const st = makeLocalStorage();
    st.setItem(STORAGE_KEY, JSON.stringify({ pro: true, entries: [{ id: "a", foodId: "rice", grams: 150 }, { id: "b", foodId: "egg", grams: 50 }] }));
    const env = launch(st);
    const saved = () => JSON.parse(st.getItem(STORAGE_KEY));
    setVal(env, "set-name", "");
    submit(env, "set-save-form");
    check("名前の無いセットは登録しない", saved().mealSets.length === 0);
    setVal(env, "set-name", "いつもの朝ごはん");
    submit(env, "set-save-form");
    check("今日の記録をセットとして登録できる", saved().mealSets.length === 1 && saved().mealSets[0].items.length === 2);
    const li = byId(env, "set-list").children[0];
    check("セットのカロリーを表示（234＋71）", li.textContent.includes("305kcal"));
    byId(env, "reset-button").click();
    li.children[1].click();
    check("追加ボタンでセットの食品が今日の記録に入る", saved().entries.length === 2);
    check("合計にも反映される", text(env, "total-kcal") === "305");
    byId(env, "set-list").children[0].children[2].click();
    check("セットを消せる", saved().mealSets.length === 0);
    {
      const st3 = makeLocalStorage();
      st3.setItem(STORAGE_KEY, JSON.stringify({ pro: true, mealSets: [{ id: "s1", name: "消えた食品", items: [{ foodId: "custom:gone", grams: 100 }] }] }));
      const env3 = launch(st3);
      byId(env3, "set-list").children[0].children[1].click();
      check("食品がすべて消えたセットは、追加できなかったと伝える", text(env3, "set-message").includes("追加できませんでした"));
    }
    const free = launch(makeLocalStorage());
    check("無料版ではセットが隠れている", byId(free, "sets-area").classList.contains("hidden"));
  }

  // ============ からだの記録・計画・スコア・バックアップ ============
  console.log("[からだの記録]");
  {
    const flush = () => new Promise((r) => setTimeout(r, 30));
    const pad2 = (n) => String(n).padStart(2, "0");
    const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); };
    const later = (n) => ago(-n);
    const today = ago(0);
    const profile = { sex: "male", age: 30, height: 170, weight: 70, activity: 1.55, goal: "maintain" };
    const saved = (st) => JSON.parse(st.getItem(STORAGE_KEY));
    const preset = (obj) => { const st = makeLocalStorage(); st.setItem(STORAGE_KEY, JSON.stringify(Object.assign({ day: today, pro: true }, obj))); return st; };
    const bmr = (w) => 10 * w + 6.25 * 170 - 5 * 30 + 5;

    // 無料版では隠れている
    {
      const env = launch(makeLocalStorage());
      check("無料版でもからだの記録（体重・筋トレ）は使える", !byId(env, "body-area").classList.contains("hidden"));
      check("無料版では計画・部位のセット数が隠れている", byId(env, "body-pro-area").classList.contains("hidden"));
      check("無料版では Pro の案内が見える", !byId(env, "body-locked").classList.contains("hidden"));
      const fst = makeLocalStorage();
      const fenv = launch(fst);
      setVal(fenv, "weight-input", "60.5");
      submit(fenv, "weight-form");
      setVal(fenv, "workout-name", "スクワット"); setVal(fenv, "workout-kg", "40"); setVal(fenv, "workout-reps", "10"); setVal(fenv, "workout-sets", "3");
      submit(fenv, "workout-form");
      const fs2 = JSON.parse(fst.getItem(STORAGE_KEY));
      check("無料版でも体重を記録できる", fs2.weights[today] === 60.5);
      check("無料版でも筋トレを記録できる", fs2.workouts[today].length === 1);
      check("無料版では部位のセット数を描かない", byId(fenv, "volume-list").children.length === 0);
      check("無料版ではスコアが隠れている", byId(env, "score-area").classList.contains("hidden"));
    }

    // 体重の記録
    {
      const st = preset({});
      const env = launch(st);
      setVal(env, "weight-input", "65.43");
      submit(env, "weight-form");
      check("体重が今日の日付で保存される（0.1kg単位）", saved(st).weights[today] === 65.4);
      check("体重の平均が表示される", text(env, "weight-trend").includes("65.4kg"));
      check("体重の一覧に出る", byId(env, "weight-list").children.length === 1);
      setVal(env, "weight-input", "500");
      submit(env, "weight-form");
      check("範囲外の体重は保存しない", saved(st).weights[today] === 65.4);
      byId(env, "weight-list").children[0].children[1].click();
      check("体重を削除できる", saved(st).weights[today] === undefined);
    }

    // 実績から逆算：14日間 2000kcal、体重は 1日 −0.05kg で減っている
    {
      const history = {}, weights = {};
      for (let i = 1; i <= 14; i++) history[ago(i)] = { kcal: 2000, p: 100, f: 60, c: 250 };
      for (let i = 0; i < 14; i++) weights[ago(i)] = Math.round((70 - 0.05 * (13 - i)) * 100) / 100;
      const goalDate = later(100);
      const st = preset({ profile, history, weights, plan: { goalWeight: 65, goalDate } });
      const env = launch(st);
      const last7 = [0, 1, 2, 3, 4, 5, 6].map((i) => weights[ago(i)]);
      const avg7 = last7.reduce((a, b) => a + b, 0) / 7;
      const tdee = 2000 + 0.05 * 7700;
      const rate = (65 - avg7) / 100;
      const expectKcal = Math.round(tdee + rate * 7700);
      const t = saved(st).targets;
      check("実績から逆算した目標が自動で入る（" + expectKcal + "kcal）", Math.abs(t.kcal - expectKcal) <= 1);
      check("たんぱく質は体重×2g", t.p === Math.round(avg7 * 2));
      check("逆算であることが表示される", text(env, "plan-result").includes("実績から逆算"));
      check("TDEE 約2,385kcal と表示される", text(env, "plan-result").includes("2,385kcal"));
      check("期限までの日数が出る", text(env, "plan-result").includes("あと100日"));
      check("週あたりの傾きが表示される", text(env, "weight-trend").includes("−0.35kg"));
      check("目標欄にも反映される", byId(env, "target-kcal").value === t.kcal);
    }

    // データが足りない間は式で推定
    {
      const st = preset({ profile, history: { [ago(1)]: { kcal: 1800, p: 90, f: 50, c: 200 } }, weights: { [today]: 70 },
        plan: { goalWeight: 70, goalDate: later(30) } });
      const env = launch(st);
      check("データ不足なら式による推定と表示", text(env, "plan-result").includes("式による推定"));
      check("推定は 基礎代謝×活動レベル", saved(st).targets.kcal === Math.round(bmr(70) * 1.55));
    }

    // 急な減量は上限で抑え、基礎代謝は下回らない
    {
      const st = preset({ profile, weights: { [today]: 70 }, plan: { goalWeight: 50, goalDate: later(10) } });
      const env = launch(st);
      const k = saved(st).targets.kcal;
      check("急すぎる計画は抑えたと表示", text(env, "plan-result").includes("無理のない速さ"));
      check("週1%の減量の上限で計算", k === Math.max(Math.round(bmr(70) * 1.55 - 70 * 0.01 / 7 * 7700), Math.round(bmr(70))));
      check("目標は基礎代謝を下回らない", k >= Math.round(bmr(70)));
    }

    // プロフィールが無ければ案内を出す
    {
      const env = launch(preset({ weights: { [today]: 70 } }));
      check("プロフィールが無ければ入力を案内する", text(env, "plan-result").includes("性別・年齢・身長"));
    }

    // 計画が無いときのチェックは、ほかの操作で消えない
    {
      const st = preset({ profile });
      const env = launch(st);
      byId(env, "plan-cycle").checked = true;
      setVal(env, "weight-input", "70");
      submit(env, "weight-form");
      check("計画が無いときのチェックは体重の記録で消えない", byId(env, "plan-cycle").checked === true);
      setVal(env, "plan-goal", "66"); setVal(env, "plan-date", later(60));
      submit(env, "plan-form");
      check("チェックしたまま計画を作ると切り替えがオン", saved(st).plan.cycle === true);
    }

    // 計画の設定と解除
    {
      const st = preset({ profile, weights: { [today]: 70 } });
      const env = launch(st);
      setVal(env, "plan-goal", "65"); setVal(env, "plan-date", ago(1));
      submit(env, "plan-form");
      check("過去の期限は受け付けない", saved(st).plan === null && text(env, "plan-message").includes("明日以降"));
      setVal(env, "plan-date", later(60));
      submit(env, "plan-form");
      check("計画が保存される", saved(st).plan && saved(st).plan.goalWeight === 65);
      byId(env, "plan-clear-button").click();
      check("計画をやめられる", saved(st).plan === null);
    }

    // 筋トレ：前回との比較と自己ベスト
    {
      const st = preset({ workouts: { [ago(3)]: [{ id: "a", name: "ベンチプレス", kg: 55, reps: 10, sets: 3 }] } });
      const env = launch(st);
      setVal(env, "workout-name", " ベンチプレス "); setVal(env, "workout-kg", "60");
      setVal(env, "workout-reps", "10"); setVal(env, "workout-sets", "3");
      submit(env, "workout-form");
      const items = saved(st).workouts[today];
      check("筋トレが保存される（種目名の前後の空白は消す）", items.length === 1 && items[0].name === "ベンチプレス");
      check("自己ベスト更新のお知らせが出る", text(env, "workout-message").includes("自己ベスト"));
      const li = byId(env, "workout-list").children[0];
      check("一覧に自己ベストの印が付く", li.textContent.includes("★"));
      check("前回の記録が表示される", li.textContent.includes("前回") && li.textContent.includes("55"));
      check("推定1RMが表示される（60×(1+10/30)=80）", li.textContent.includes("推定1RM 80.0kg"));
      setVal(env, "workout-kg", "50");
      submit(env, "workout-form");
      check("前より軽ければ自己ベストにならない", !text(env, "workout-message").includes("自己ベスト"));
      setVal(env, "workout-reps", "0");
      submit(env, "workout-form");
      check("回数0は記録しない", saved(st).workouts[today].length === 2);
      check("種目の候補に出る", byId(env, "exercise-names").children.length === 1);
      byId(env, "workout-list").children[1].children[1].click();
      check("筋トレを削除できる", saved(st).workouts[today].length === 1);
    }
    {
      const st = preset({});
      const env = launch(st);
      setVal(env, "workout-name", "スクワット"); setVal(env, "workout-kg", "80");
      setVal(env, "workout-reps", "5"); setVal(env, "workout-sets", "5");
      submit(env, "workout-form");
      check("初めての種目は自己ベスト扱いにしない", !text(env, "workout-message").includes("自己ベスト"));
    }

    // 部位：自動判定と直近7日のセット数
    {
      const st = preset({ workouts: {
        [ago(2)]: [{ id: "a", name: "ベンチプレス", kg: 60, reps: 10, sets: 4 }, { id: "b", name: "レッグレイズ", kg: 0, reps: 15, sets: 3 }],
        [ago(9)]: [{ id: "c", name: "スクワット", kg: 80, reps: 5, sets: 5 }] } });
      const env = launch(st);
      check("保存済みの記録にも部位を推測して付ける", saved(st).workouts[ago(2)][0].muscle === "胸");
      check("レッグレイズは脚ではなく腹", saved(st).workouts[ago(2)][1].muscle === "腹");
      setVal(env, "workout-name", "ブルガリアンスクワット"); setVal(env, "workout-kg", "20");
      setVal(env, "workout-reps", "10"); setVal(env, "workout-sets", "3"); setVal(env, "workout-muscle", "");
      submit(env, "workout-form");
      check("種目名から自動で脚", saved(st).workouts[today][0].muscle === "脚");
      setVal(env, "workout-name", "オリジナル種目"); setVal(env, "workout-muscle", "肩");
      submit(env, "workout-form");
      check("部位を選べばそれを使う", saved(st).workouts[today][1].muscle === "肩");
      const rows = byId(env, "volume-list").children.map((r) => r.textContent);
      check("直近7日の胸は4セット", rows.includes("胸4セット"));
      check("8日以上前は数えない（脚は今日の3セットだけ）", rows.includes("脚3セット"));
    }

    // 部位の推測の例外
    {
      const st = preset({ workouts: { [ago(1)]: [
        { id: "a", name: "トライセプスディップ", kg: 0, reps: 10, sets: 3 }, { id: "b", name: "リバースフライ", kg: 5, reps: 15, sets: 3 },
        { id: "c", name: "ヒップアブダクション", kg: 30, reps: 15, sets: 3 }, { id: "d", name: "レッグカール", kg: 30, reps: 12, sets: 3 },
        { id: "e", name: "Bench Press", kg: 60, reps: 8, sets: 3 }, { id: "f", name: "ハンマーカール", kg: 12, reps: 10, sets: 3 }] } });
      launch(st);
      const m = saved(st).workouts[ago(1)].map((x) => x.muscle).join(",");
      check("部位の推測：腕・肩・脚・脚・胸・腕（" + m + "）", m === "腕,肩,脚,脚,胸,腕");
    }

    // 体重のグラフ
    {
      const env = launch(preset({ weights: { [ago(0)]: 70, [ago(3)]: 71, [ago(40)]: 80 }, plan: { goalWeight: 65, goalDate: later(60) }, profile }));
      const svg = byId(env, "weight-chart").children[0];
      check("体重が2日以上あればグラフを描く", !!svg && svg.tagName === "SVG");
      check("30日より前の体重は点にしない", svg.children.filter((c) => c.tagName === "CIRCLE").length === 2);
      check("目標体重の点線を引く", svg.children.some((c) => c.tagName === "LINE" && c.attrs["stroke-dasharray"]));
      check("縦軸の下限は目標体重より下", svg.children.filter((c) => c.tagName === "TEXT").some((t) => t.textContent === "64.0"));
      const env2 = launch(preset({ weights: { [today]: 70 } }));
      check("1日分だけならグラフは描かない", byId(env2, "weight-chart").children.length === 0);
    }

    // トレ日と休養日
    {
      const workouts = {};
      [1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26].forEach((i) => { workouts[ago(i)] = [{ id: "x" + i, name: "スクワット", kg: 80, reps: 5, sets: 5 }]; });
      const base = preset({ profile, weights: { [today]: 70 }, workouts, plan: { goalWeight: 70, goalDate: later(30), cycle: false } });
      launch(base);
      const baseKcal = saved(base).targets.kcal;
      const rest = preset({ profile, weights: { [today]: 70 }, workouts, plan: { goalWeight: 70, goalDate: later(30), cycle: true } });
      const envR = launch(rest);
      const restKcal = saved(rest).targets.kcal;
      check("週3日トレの休養日は平均より少なめ", Math.abs(restKcal - Math.round(baseKcal - baseKcal * 0.1 * 3 / 4)) <= 1);
      check("休養日と表示", text(envR, "plan-result").includes("休養日"));
      setVal(envR, "workout-name", "スクワット"); setVal(envR, "workout-kg", "80"); setVal(envR, "workout-reps", "5"); setVal(envR, "workout-sets", "5");
      submit(envR, "workout-form");
      const trainKcal = saved(rest).targets.kcal;
      check("筋トレを記録するとトレ日の多めのカロリーになる", Math.abs(trainKcal - Math.round(baseKcal * 1.1)) <= 1);
      check("週の平均は変わらない（トレ3日＋休養4日）", Math.abs((trainKcal * 3 + restKcal * 4) / 7 - baseKcal) <= 2);
      check("たんぱく質と脂質は変えず、炭水化物で調整", saved(rest).targets.p === saved(base).targets.p && saved(rest).targets.f === saved(base).targets.f);
      // 週5日トレ：そのままだと休養日が基礎代謝を下回るので、幅を小さくして週の平均を守る
      const w5 = {};
      for (let i = 1; i <= 28; i++) if (i % 7 !== 0 && i % 7 !== 3) w5[ago(i)] = [{ id: "y" + i, name: "スクワット", kg: 80, reps: 5, sets: 5 }];
      const st5 = preset({ profile, weights: { [today]: 70 }, workouts: w5, plan: { goalWeight: 66, goalDate: later(60), cycle: false } });
      launch(st5);
      const base5 = saved(st5).targets.kcal;
      const r5 = preset({ profile, weights: { [today]: 70 }, workouts: w5, plan: { goalWeight: 66, goalDate: later(60), cycle: true } });
      const env5 = launch(r5);
      const rest5 = saved(r5).targets.kcal;
      check("週5日トレでも休養日は基礎代謝を下回らない", rest5 >= Math.round(bmr(70)) - 1);
      setVal(env5, "workout-name", "スクワット"); setVal(env5, "workout-kg", "80"); setVal(env5, "workout-reps", "5"); setVal(env5, "workout-sets", "5");
      submit(env5, "workout-form");
      const train5 = saved(r5).targets.kcal;
      check("週5日トレでも週の平均は計画どおり", Math.abs((train5 * 5 + rest5 * 2) / 7 - base5) <= 2);
      const few = preset({ profile, weights: { [today]: 70 }, plan: { goalWeight: 70, goalDate: later(30), cycle: true } });
      const envF = launch(few);
      check("トレの記録が無いあいだは切り替えない", saved(few).targets.kcal === baseKcal && text(envF, "plan-result").includes("たまると始まります"));
    }

    // スコアと連続記録
    {
      const st = preset({
        targets: { kcal: 2000, p: 100, f: 60, c: 250 },
        weights: { [today]: 70 },
        workouts: { [today]: [{ id: "a", name: "懸垂", kg: 0, reps: 8, sets: 3 }] },
        scores: { [ago(1)]: 80, [ago(2)]: 60, [ago(3)]: 55, [ago(5)]: 90, [ago(6)]: 90, [ago(7)]: 90, [ago(8)]: 90 },
      });
      const env = launch(st);
      check("体重と筋トレで30点", text(env, "score-total") === "30");
      check("内訳が5項目出る", byId(env, "score-items").children.length === 5);
      check("今日が50点未満でも昨日までの連続3日", text(env, "score-streak") === "3");
      check("自己ベストの連続は4日", text(env, "score-best") === "4");
      check("累計は過去＋今日", text(env, "score-sum") === String(80 + 60 + 55 + 360 + 30));
      setVal(env, "grams-input", "800");
      submit(env, "add-form");
      check("食事を足すとスコアが上がる", Number(text(env, "score-total")) >= 50);
      check("50点を超えると今日も連続に入る", text(env, "score-streak") === "4");
    }

    // 日付が変わると前日のスコアが確定する
    {
      const st = makeLocalStorage();
      st.setItem(STORAGE_KEY, JSON.stringify({ day: ago(1), pro: true, entries: [{ id: "e", foodId: "rice", grams: 100 }],
        targets: { kcal: 2000, p: 100, f: 60, c: 250 }, weights: { [ago(1)]: 70 } }));
      launch(st);
      check("前日のスコアが保存される（食事20＋体重15）", saved(st).scores[ago(1)] === 35);
    }

    // バックアップの書き出しと読み込み
    {
      const st = preset({ weights: { [today]: 70 }, pendingSession: "cs_test_a1B2c3D4e5F6g7H8i9J0" });
      const env = launch(st);
      byId(env, "backup-export-button").click();
      const backup = JSON.parse(lastDownloadText());
      check("バックアップに体重が入る", backup.app === "pfc-calculator" && backup.data.weights[today] === 70);
      check("バックアップに決済の保留番号は入らない", backup.data.pendingSession === undefined);

      const st2 = makeLocalStorage();
      const env2 = launch(st2);
      const input = byId(env2, "backup-import");
      input.files = [{ size: 100, text: async () => JSON.stringify(backup) }];
      input.dispatch("change");
      await flush();
      check("読み込むと記録が戻る", saved(st2).weights[today] === 70);
      check("読み込みのお知らせが出る", text(env2, "backup-message").includes("読み込みました"));

      input.files = [{ size: 10, text: async () => "{broken" }];
      input.dispatch("change");
      await flush();
      check("壊れたファイルは読み込まない", text(env2, "backup-message").includes("読み込めませんでした"));
      check("壊れたファイルでも記録は消えない", saved(st2).weights[today] === 70);

      input.files = [{ size: 100, text: async () => JSON.stringify({ app: "other", data: {} }) }];
      input.dispatch("change");
      await flush();
      check("ほかのアプリのファイルは読み込まない", text(env2, "backup-message").includes("読み込めませんでした"));
    }

    // 読み込みで Pro・確認待ちを壊さない／改ざんしたバックアップで Pro にならない
    {
      const SID = "cs_test_a1B2c3D4e5F6g7H8i9J0";
      const st = preset({ pendingSession: SID });
      const env = launch(st);
      const input = byId(env, "backup-import");
      input.files = [{ size: 100, text: async () => JSON.stringify({ app: "pfc-calculator", version: 1,
        data: { pro: false, license: null, weights: { [today]: 71 } } }) }];
      input.dispatch("change");
      await flush();
      check("キーの無い古いバックアップでも今の Pro は消えない", saved(st).pro === true && saved(st).weights[today] === 71);
      check("読み込んでも支払いの確認待ちは残る", saved(st).pendingSession === SID);

      const st2 = makeLocalStorage();
      const env2 = launch(st2);
      const input2 = byId(env2, "backup-import");
      input2.files = [{ size: 100, text: async () => JSON.stringify({ app: "pfc-calculator", version: 1,
        data: { pro: true, day: later(5), entries: [{ id: "e", foodId: "rice", grams: 100 }] } }) }];
      input2.dispatch("change");
      await flush();
      check("pro:true と書いただけのバックアップでは Pro にならない", saved(st2).pro === false);
      check("未来の日付は今日に直す", saved(st2).day === today);
      check("未来の日付の履歴を作らない", Object.keys(saved(st2).history).every((d) => d <= today));
    }

    // 計画があるあいだは目標を手で変えられない
    {
      const env = launch(preset({ profile, weights: { [today]: 70 }, plan: { goalWeight: 65, goalDate: later(60) } }));
      check("計画中は目標の入力欄が使えない", byId(env, "target-kcal").disabled === true);
      check("計画中はその理由を表示", !byId(env, "target-plan-note").classList.contains("hidden"));
      const env2 = launch(preset({ profile }));
      check("計画が無ければ目標を手で変えられる", byId(env2, "target-kcal").disabled === false);
    }

    // CSV に体重だけの日も出る
    {
      const env = launch(preset({ weights: { [ago(2)]: 70.5 } }));
      byId(env, "history-csv-button").dispatch("click");
      check("体重だけの日も履歴CSVに出る", lastDownloadText().includes(ago(2) + ",,,,,70.5"));
    }

    // 付け忘れの少ない日は逆算から除く
    {
      const history = {}, weights = {};
      for (let i = 1; i <= 14; i++) history[ago(i)] = { kcal: i <= 3 ? 300 : 2000, p: 100, f: 60, c: 250 };
      for (let i = 0; i < 14; i++) weights[ago(i)] = 70;
      const env = launch(preset({ profile, history, weights, plan: { goalWeight: 70, goalDate: later(30) } }));
      check("基礎代謝の半分に満たない日は除く（11日分で平均2,000kcal）",
        text(env, "plan-result").includes("直近11日の平均摂取 2,000kcal"));
    }

    // 重なった id は付け直す
    {
      const st = preset({ workouts: { [today]: [
        { id: "dup", name: "懸垂", kg: 0, reps: 8, sets: 3 }, { id: "dup", name: "懸垂", kg: 0, reps: 6, sets: 3 }] } });
      const env = launch(st);
      byId(env, "workout-list").children[0].children[1].click();
      check("同じ id の記録があっても1件だけ消える", saved(st).workouts[today].length === 1);
    }

    // 筋トレ種目サーチから ?exercise=&muscle= 付きで開かれたとき
    {
      const env = launch(makeLocalStorage(), { search: "?exercise=" + encodeURIComponent("Dumbbell Bench Press") + "&muscle=" + encodeURIComponent("胸") });
      check("種目サーチの種目名がフォームに入る", byId(env, "workout-name").value === "Dumbbell Bench Press");
      check("種目サーチの部位がフォームに入る", byId(env, "workout-muscle").value === "胸");
      check("URL から exercise と muscle を消す", env.replaced.length === 1 && !/exercise|muscle/.test(env.replaced[0]));
      const bad = launch(makeLocalStorage(), { search: "?exercise=" + "x".repeat(60) + "&muscle=evil" });
      check("長すぎる種目名は40文字に切る", byId(bad, "workout-name").value.length === 40);
      check("知らない部位は「種目名から自動」にする", byId(bad, "workout-muscle").value === "");
      const none = launch(makeLocalStorage());
      check("パラメータが無ければ URL を触らない", none.replaced.length === 0);
    }
  }
;

  // ============ 市販品の残り（検索したときだけ読み込む） ============
  console.log("[市販品の追加データ]");
  {
    const st = makeLocalStorage();
    const env = launch(st);
    const head = env.document.head;
    check("起動しただけでは追加データを読み込まない", head.children.length === 0);
    const row = env.sandbox.window.OFF_FOODS_MORE;
    check("起動時には OFF_FOODS_MORE が無い", row === undefined);
    // 追加データの先頭の商品をバーコードで探す
    const firstRow = JSON.parse(offMoreCode.split("\n").find((l) => l.startsWith("[\"")).replace(/,$/, ""));
    const code = firstRow[0];
    change(env, "food-search", code);
    byId(env, "food-search").dispatch("input");
    check("検索すると off-foods-more.js を読み込みにいく", head.children.length === 1 && head.children[0].src === "off-foods-more.js");
    check("読み込み中と表示する", /読み込んでいます/.test(text(env, "food-search-count")));
    byId(env, "food-search").dispatch("input");
    check("読み込み中に何度検索しても1回だけ読む", head.children.length === 1);
    vm.runInContext(offMoreCode, env.sandbox);
    head.children[0].onload();
    check("読み込み後に追加データの商品が見つかる", byId(env, "food-select").value === "off:" + code);
    check("読み込み後は件数を出す", /1件見つかりました/.test(text(env, "food-search-count")));
    setVal(env, "grams-input", "100");
    submit(env, "add-form");
    check("追加データの商品を記録できる", approx(num(env, "total-kcal"), firstRow[2], 0.6));
    const data = JSON.parse(st.getItem(STORAGE_KEY));
    check("記録した商品の数値を savedFoods に写す", data.savedFoods.length === 1 && data.savedFoods[0].id === "off:" + code);
    // 読み込む前の再起動でも記録が残る
    const again = launch(st);
    check("再起動後（追加データ未読み込み）も記録が残る", byId(again, "entry-list").children.length === 1 &&
      approx(num(again, "total-kcal"), firstRow[2], 0.6));
    // 壊れた savedFoods は捨てる
    const bad = makeLocalStorage();
    bad.setItem(STORAGE_KEY, JSON.stringify({ savedFoods: [
      { id: "custom:x", name: "a", kcal: 1, p: 1, f: 1, c: 1 },
      { id: "off:123456", name: "", kcal: 1, p: 1, f: 1, c: 1 },
      { id: "off:1234567", name: "ok", kcal: 9999, p: 1, f: 1, c: 1 },
      { id: "off:12345678", name: "good", kcal: 100, p: 1, f: 2, c: 3 },
      { id: "off:87654321", name: "unused", kcal: 100, p: 1, f: 2, c: 3 }],
      entries: ["custom:x", "off:123456", "off:1234567", "off:12345678"].map((id, i) => ({ id: "e" + i, foodId: id, grams: 100 })) }));
    launch(bad);
    const kept = JSON.parse(bad.getItem(STORAGE_KEY)).savedFoods;
    check("savedFoods は正しい形で、使っているものだけ残す", kept.length === 1 && kept[0].id === "off:12345678");

    // セットに入れた追加データの食品も、読み込む前の再起動で消えない
    {
      const st3 = makeLocalStorage();
      st3.setItem(STORAGE_KEY, JSON.stringify({ pro: true,
        savedFoods: [{ id: "off:" + code, name: firstRow[1], kcal: firstRow[2], p: firstRow[3], f: firstRow[4], c: firstRow[5] }],
        mealSets: [{ id: "s1", name: "朝", items: [{ foodId: "off:" + code, grams: 50 }] }] }));
      launch(st3);
      const d3 = JSON.parse(st3.getItem(STORAGE_KEY));
      check("セットだけで使っている食品の写しも残る", d3.savedFoods.length === 1 && d3.mealSets[0].items.length === 1);
    }

    // 別の端末でバックアップを読み込んでも、追加データの食品の記録が残る（追加データは未読み込み）
    {
      byId(again, "backup-export-button").click();
      const backup = JSON.parse(lastDownloadText());
      const st4 = makeLocalStorage();
      const env4 = launch(st4);
      const input = byId(env4, "backup-import");
      input.files = [{ size: 100, text: async () => JSON.stringify(backup) }];
      input.dispatch("change");
      await flush();
      check("バックアップの読み込みで追加データの食品の記録が残る",
        JSON.parse(st4.getItem(STORAGE_KEY)).entries.length === 1 && approx(num(env4, "total-kcal"), firstRow[2], 0.6));
    }

    // 中身が配列でない（オフラインで別のページが返った等）ときは失敗として扱う
    {
      const env5 = launch(makeLocalStorage());
      change(env5, "food-search", "zzz");
      byId(env5, "food-search").dispatch("input");
      env5.document.head.children[0].onload();
      check("中身が読めなければ失敗の案内を出す", /読み込めませんでした/.test(text(env5, "food-search-count")) &&
        env5.document.head.children.length === 0);
    }
    // 読み込みに失敗したら、次の検索でもう一度試す
    const env2 = launch(makeLocalStorage());
    change(env2, "food-search", "zzz");
    byId(env2, "food-search").dispatch("input");
    const s1 = env2.document.head.children[0];
    s1.onerror();
    check("失敗したら script を外し、その場で読み直さない", env2.document.head.children.length === 0);
    byId(env2, "food-search").dispatch("input");
    check("次の検索でもう一度読みにいく", env2.document.head.children.length === 1);
  }

  // ============ また開きたくなる仕掛け（無料） ============
  console.log("[今日のチェック・連続記録・お祝い・週のふり返り]");
  {
    const pad2 = (n) => String(n).padStart(2, "0");
    const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); };
    const today = ago(0);
    const preset = (obj) => { const st = makeLocalStorage(); st.setItem(STORAGE_KEY, JSON.stringify(Object.assign({ day: today }, obj))); return st; };
    const w = {}; new Function("window", foodsCode)(w);
    const rice = w.FOODS.find((f) => f.id === "rice");
    const chicken = w.FOODS.find((f) => f.id === "chicken-breast");
    const doneCount = (env) => byId(env, "check-list").children.filter((li) => li.className.includes("done")).length;

    // はじめて開いたとき
    {
      const env = launch(makeLocalStorage());
      check("今日のチェックは5項目", byId(env, "check-list").children.length === 5 && doneCount(env) === 0);
      check("最初は記録をすすめる", text(env, "check-next").includes("まずは"));
      check("連続0日なら「始めよう」", text(env, "streak-text").includes("始めよう"));
      check("起動しただけではお知らせを出さない", byId(env, "toast").classList.contains("hidden"));
    }

    // 昨日・おとといを記録済み → 今日の記録で3日連続（自己ベスト更新）
    {
      const hist = { [ago(1)]: { kcal: 1800, p: 80, f: 50, c: 200 }, [ago(2)]: { kcal: 1900, p: 90, f: 55, c: 210 } };
      const st = preset({ history: hist });
      const env = launch(st);
      check("今日まだなら昨日までの連続を出す", text(env, "streak-text").includes("2日連続で記録中"));
      setVal(env, "grams-input", "100");
      submit(env, "add-form");
      check("今日の記録で3日連続になる", text(env, "streak-text").startsWith("3日連続で記録"));
      check("自己ベスト更新を知らせる", !byId(env, "toast").classList.contains("hidden") && text(env, "toast").includes("自己ベスト更新：3日"));
      check("食事の記録にチェックが付く", doneCount(env) >= 1);
      // 前にもっと長い連続があれば「更新」とは言わない
      const hist2 = Object.assign({}, hist);
      for (let i = 4; i <= 8; i++) hist2[ago(i)] = { kcal: 1500, p: 70, f: 40, c: 180 };
      const env2 = launch(preset({ history: hist2 }));
      setVal(env2, "grams-input", "100");
      submit(env2, "add-form");
      check("自己ベストに届かなければ連続日数だけ知らせる", text(env2, "toast") === "3日連続で記録しています");
      // 消して記録し直しても、同じ日にもう一度は知らせない
      byId(env2, "toast").classList.add("hidden");
      byId(env2, "reset-button").click();
      submit(env2, "add-form");
      check("連続のお知らせは1日1回", byId(env2, "toast").classList.contains("hidden"));
    }

    // 目標を満たした瞬間だけ、1日1回お祝い
    {
      const targets = { kcal: rice.kcal * 1.5, p: rice.p * 1.5, f: 50, c: 200 };
      const st = preset({ targets });
      const env = launch(st);
      check("目標前はお祝いを出さない", byId(env, "celebrate").classList.contains("hidden"));
      setVal(env, "grams-input", "150");
      submit(env, "add-form");
      check("目標を満たすとお祝いを出す", !byId(env, "celebrate").classList.contains("hidden"));
      check("お祝いした日を覚える", JSON.parse(st.getItem(STORAGE_KEY)).celebrated === today);
      const again = launch(st);
      check("開き直しただけではお祝いを出さない", byId(again, "celebrate").classList.contains("hidden"));
      check("達成したら体重の記録を案内し、からだへのボタンを出す", text(again, "check-next").includes("体重") &&
        !byId(again, "check-go").classList.contains("hidden"));
      // 目標を外れてまた満たしても、同じ日は2回目を出さない
      byId(again, "reset-button").click();
      setVal(again, "grams-input", "150");
      submit(again, "add-form");
      check("同じ日のお祝いは1回だけ", byId(again, "celebrate").classList.contains("hidden"));
    }

    // 目標の値を変えただけで満たしても、お祝いは出さない（その日の1回も使わない）
    {
      const st = preset({ targets: { kcal: 2000, p: rice.p * 1.5, f: 50, c: 200 } });
      const env = launch(st);
      setVal(env, "grams-input", "150");
      submit(env, "add-form");
      check("カロリーが足りない間はお祝いなし", byId(env, "celebrate").classList.contains("hidden"));
      change(env, "target-kcal", String(rice.kcal * 1.5));
      check("目標を下げて満たしてもお祝いは出ない", byId(env, "celebrate").classList.contains("hidden") &&
        JSON.parse(st.getItem(STORAGE_KEY)).celebrated == null);
    }

    // たんぱく質が足りないときは、鶏むね肉で何gかを案内
    {
      const env = launch(preset({ targets: { kcal: 2000, p: 100, f: 60, c: 250 } }));
      setVal(env, "grams-input", "100");
      submit(env, "add-form");
      const need = 100 * 0.9 - rice.p;
      const g = Math.ceil(need / chicken.p * 100 / 10) * 10;
      check("たんぱく質の不足と鶏むね肉の量を出す（" + g + "g）", text(env, "check-next").includes("たんぱく質があと " + Math.ceil(need) + "g") &&
        text(env, "check-next").includes("鶏むね肉なら約" + g + "g"));
    }

    // 週のふり返り
    {
      const targets = { kcal: 2000, p: 100, f: 60, c: 250 };
      const hist = {
        [ago(1)]: { kcal: 2000, p: 100, f: 60, c: 250 },   // 目標内
        [ago(2)]: { kcal: 2600, p: 100, f: 80, c: 300 },   // 記録のみ
        [ago(9)]: { kcal: 1500, p: 60, f: 40, c: 200 },    // 前の週
      };
      const env = launch(preset({ targets, history: hist }));
      const days = byId(env, "week-days").children;
      check("日ごとの印は7日分", days.length === 7);
      check("目標内の日は◎、記録した日は○", days[5].className.includes("hit") && days[4].className.includes("logged") && !days[4].className.includes("hit"));
      check("今日の印に「今日」", days[6].className.includes("today") && days[6].textContent.includes("今日"));
      const stats = byId(env, "week-stats").children.map((c) => c.textContent);
      check("記録した日は2/7、前の週より+1日", stats[0].includes("2/ 7日") && stats[0].includes("前の週 +1日"));
      check("目標内の日は1日", stats[1].startsWith("目標内の日1日"));
      check("平均カロリーは記録した日だけで2,300kcal、前の週より+800", stats[2].includes("2,300kcal") && stats[2].includes("+800kcal"));
      const empty = launch(makeLocalStorage());
      check("記録が無ければ平均は「—」", byId(empty, "week-stats").children[2].textContent.includes("—"));
    }
  }


  // ============ 1か月のグラフ（Pro。利用コードのファイルが無くても確かめる） ============
  console.log("[1か月のグラフ]");
  {
    const pad2 = (n) => String(n).padStart(2, "0");
    const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); };
    const st = makeLocalStorage();
    st.setItem(STORAGE_KEY, JSON.stringify({ day: ago(0), pro: true, targets: { kcal: 2000, p: 100, f: 60, c: 250 },
      history: { [ago(29)]: { kcal: 1000, p: 50, f: 30, c: 130 }, [ago(30)]: { kcal: 1500, p: 50, f: 30, c: 130 } } }));
    const env = launch(st);
    const cols = byId(env, "chart-plot").children.filter((c) => c.className === "chart-col");
    check("グラフは30日分の列", cols.length === 30);
    check("29日前の記録が左端に入る（30日前は入らない）", cols[0].children[0].style.height === "50%" &&
      cols.every((c, i) => i === 0 || c.children[0].style.height === "0%"));
    const labels = byId(env, "chart-labels").children.map((c) => c.textContent);
    check("日付は今日から5日おきに6個", labels.filter(Boolean).length === 6 && labels[29] === "今日" && labels[24] !== "" && labels[28] === "");
  }


  // ============ 記録を残す期間（Pro は期限なし） ============
  console.log("[記録を残す期間]");
  {
    const pad2 = (n) => String(n).padStart(2, "0");
    const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); };
    const old = (pro) => {
      const history = {};
      for (let i = 2; i <= 120; i++) history[ago(i)] = { kcal: 1000, p: 50, f: 30, c: 130 };
      return JSON.stringify({ day: ago(1), pro, targets: { kcal: 2000, p: 100, f: 60, c: 250 }, history,
        weights: { [ago(400)]: 70, [ago(10)]: 69 } });
    };
    // 前の日のまま開く＝日付が変わったときの片付けが走る
    const free = makeLocalStorage(); free.setItem(STORAGE_KEY, old(false)); launch(free);
    const fs1 = JSON.parse(free.getItem(STORAGE_KEY));
    check("無料版は食事の記録を90日分だけ残す", Object.keys(fs1.history).length === 90);
    check("無料版は1年より前の体重を消す", fs1.weights[ago(400)] === undefined && fs1.weights[ago(10)] === 69);
    const pro = makeLocalStorage(); pro.setItem(STORAGE_KEY, old(true)); launch(pro);
    const ps = JSON.parse(pro.getItem(STORAGE_KEY));
    check("Pro は食事の記録を消さない", Object.keys(ps.history).length === 119 && ps.history[ago(120)].kcal === 1000);
    check("Pro は1年より前の体重も消さない", ps.weights[ago(400)] === 70);

    // 保存できる量がいっぱいのときは、バックアップを促す
    const full = makeLocalStorage();
    const env = launch(full);
    full.setItem = () => { throw new Error("QuotaExceededError"); };
    setVal(env, "grams-input", "100");
    submit(env, "add-form");
    check("保存に失敗したらお知らせを出す", !byId(env, "toast").classList.contains("hidden") &&
      text(env, "toast").indexOf("データのバックアップ") !== -1);
  }

  // ============ 使い方ガイド（4つの手順） ============
  console.log("[使い方ガイド]");
  {
    const st = makeLocalStorage();
    const env = launch(st);
    const cls = (k) => byId(env, "guide-step-" + k).classList;
    check("はじめては使い方ガイドを出す", !byId(env, "guide").classList.contains("hidden"));
    check("最初の「次」は目標を決める", cls("goal").contains("is-next") && !cls("eat").contains("is-next") &&
      text(env, "guide-next").indexOf("目標を決める") !== -1);
    setVal(env, "grams-input", "150");
    submit(env, "add-form");
    check("食べたものを入れたら2番に印", cls("eat").contains("done") && cls("goal").contains("is-next"));
    change(env, "target-kcal", "1800");
    check("目標を変えたら1番に印、次はお皿", cls("goal").contains("done") && cls("check").contains("is-next"));
    const st2 = makeLocalStorage();
    const env2 = launch(st2);
    byId(env2, "guide-go-goal").click();
    check("目標はそのままでも、設定を開いたら1番に印", byId(env2, "guide-step-goal").classList.contains("done"));
    const st3 = makeLocalStorage();
    const env3 = launch(st3);
    st3.setItem = () => { throw new Error("QuotaExceededError"); };
    byId(env3, "guide-close").click();
    check("保存できなくても「しまう」で閉じる", byId(env3, "guide").classList.contains("hidden"));
    byId(env, "guide-go-check").click();
    check("お皿を押したら3番に印、次は記録", cls("check").contains("done") && cls("log").contains("is-next"));
    byId(env, "guide-close").click();
    check("「しまう」で閉じる", byId(env, "guide").classList.contains("hidden"));
    const again = launch(st);
    check("しまったら次からは出さない", byId(again, "guide").classList.contains("hidden"));
    check("押した手順は覚えている", byId(again, "guide-step-check").classList.contains("done"));
    byId(again, "guide-open").click();
    check("ヘッダーの「使い方」でもう一度出す", !byId(again, "guide").classList.contains("hidden"));
  }

  // ============ はじめに（注意書き） ============
  console.log("[はじめに]");
  {
    const st = makeLocalStorage();
    const env = launch(st);
    check("はじめては注意書きを出す", !byId(env, "welcome").classList.contains("hidden"));
    byId(env, "welcome-close").click();
    check("「わかりました」で閉じる", byId(env, "welcome").classList.contains("hidden"));
    const again = launch(st);
    check("閉じたら次からは出さない", byId(again, "welcome").classList.contains("hidden"));
  }

  // ============ 表示言語（English・中文） ============
  console.log("[表示言語]");
  {
    // i18n.js だけを最小のスタブで読み、辞書を取り出す。
    function loadI18n(lang) {
      const store = makeLocalStorage();
      if (lang) store.setItem("pfc-calculator-lang", lang);
      const win = {};
      const sb = { window: win, document: {}, localStorage: store };
      vm.createContext(sb);
      vm.runInContext(i18nCode, sb);
      return win.PFC_I18N;
    }
    const JP = /[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef]/;
    const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

    // (a) 辞書がそろっているか：index.html の日本語の断片と属性、app.js の t("…") の文
    const body = html.slice(html.indexOf("<body"))
      .replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<div[^>]*translate="no"[\s\S]*?<\/div>/g, "");
    const wanted = new Set();
    body.split(/<[^>]*>/).forEach((frag) => { const k = frag.trim(); if (k && JP.test(k)) wanted.add(k); });
    const attrRe = /\s(placeholder|aria-label|title|label)="([^"]*)"/g;
    let am;
    while ((am = attrRe.exec(body))) { if (JP.test(am[2])) wanted.add(am[2].trim()); }
    const tRe = /\bt\(\s*"((?:[^"\\]|\\.)*)"/g;
    let tm;
    while ((tm = tRe.exec(appCode))) wanted.add(JSON.parse('"' + tm[1] + '"'));
    // <head> の文言、内部の値を表示するときに t() に通す文言（カテゴリ・スコアの項目名）
    wanted.add(/<title>([^<]*)<\/title>/.exec(html)[1]);
    wanted.add(/<meta name="description" content="([^"]*)"/.exec(html)[1]);
    const lit = /\b(?:label|short|category): "([^"]+)"/g;
    let lm;
    while ((lm = lit.exec(appCode))) wanted.add(lm[1]);
    const foodsAll = fs.readFileSync(path.join(ROOT, "foods.js"), "utf8");
    const catRe = /"category": "([^"]+)"/g;
    let cm;
    while ((cm = catRe.exec(foodsAll))) wanted.add(cm[1]);
    wanted.add("市販品");
    const dict = loadI18n()._dict;
    const missing = [];
    ["en", "zh"].forEach((l) => wanted.forEach((k) => { if (!Object.prototype.hasOwnProperty.call(dict[l], k)) missing.push(l + ": " + k); }));
    if (missing.length) console.log(missing.join("\n"));
    check("辞書に英語・中国語の訳がそろっている（" + wanted.size + "文、不足" + missing.length + "）", missing.length === 0);

    // (b) t() の動き
    const en = loadI18n("en");
    check("英語: 穴埋め入りの文が訳される", en.t("あと {n} kcal", { n: "1,790" }) === "1,790 kcal left");
    check("辞書に無い文は日本語のまま", en.t("辞書に無い文 {n}", { n: 3 }) === "辞書に無い文 3");
    check("日本語に設定すると元の文のまま", loadI18n("ja").t("あと {n} kcal", { n: "1,790" }) === "あと 1,790 kcal");
    check("中国語に切り替えられ、保存される", (() => { const z = loadI18n("zh"); return z.t("今日") === "今天" && z.lang === "zh"; })());

    // (c) よく使う食品には英語・中国語の名前がある
    const common = vm.runInNewContext(foodsAll + "; window.FOODS", { window: {} }).filter((f) => f.common);
    const names = en._foodNames;
    check("よく使う食品 " + common.length + " 品すべてに英語・中国語の名前がある",
      common.length === 106 && common.every((f) => names[f.id] && names[f.id][0] && names[f.id][1]));

    // (d) アプリを英語で起動する
    const st = makeLocalStorage();
    st.setItem("pfc-calculator-lang", "en");
    const envEn = launch(st, { i18n: true });
    check("英語: 残りカロリーが英語", text(envEn, "remaining-kcal") === "2,000 kcal left");
    check("英語: 次の一歩が英語", text(envEn, "check-next") === "Start by logging one thing you ate today.");
    check("英語: 食品名が英語", byId(envEn, "food-select").children[0].children[0].textContent === "Rice (white, cooked)");
    st.setItem("pfc-calculator-lang", "zh");
    const envZh = launch(st, { i18n: true });
    check("中国語: 残りカロリーが中国語", text(envZh, "remaining-kcal") === "还剩 2,000 kcal");
    // 切り替えたら描き直される
    envZh.sandbox.window.PFC_I18N.setLang("ja");
    check("切り替えで日本語に描き直される", text(envZh, "remaining-kcal") === "あと 2,000 kcal");
    envZh.sandbox.window.PFC_I18N.setLang("en");
    check("切り替えで英語に描き直される", text(envZh, "remaining-kcal") === "2,000 kcal left");
    // 英語・中国語の名前でも探せる
    setVal(envEn, "food-search", "chicken breast");
    byId(envEn, "food-search").dispatch("input");
    const hitIds = byId(envEn, "food-select")._options().map((o) => o._value);
    check("英語の名前で検索できる", hitIds.indexOf("chicken-breast") !== -1);
    setVal(envZh, "food-search", "鸡胸");
    byId(envZh, "food-search").dispatch("input");
    check("中国語の名前で検索できる", byId(envZh, "food-select")._options().some((o) => o._value === "chicken-breast"));
  }

  console.log("");
  console.log("結果: " + passed + " passed, " + failed + " failed");
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
