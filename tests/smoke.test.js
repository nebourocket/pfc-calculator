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
  "plan-clear-button": "button", "backup-export-button": "button",
};

function makeDocument() {
  const registry = {};
  return {
    registry,
    body: new El("body"),
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
    setTimeout,
    crypto: globalThis.crypto,
    TextEncoder, TextDecoder, atob, URLSearchParams,
    fetch: opts.fetch,
  };
  vm.createContext(sandbox);
  vm.runInContext(foodsCode, sandbox);
  vm.runInContext(appCode, sandbox);
  return { document: documentStub, storage, replaced };
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
    check("グラフは14日分の列を表示する", cols.length === 14);
    check("グラフの日付ラベルは14個", byId(genv, "chart-labels").children.length === 14);
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
      check("無料版ではからだの記録が隠れている", byId(env, "body-area").classList.contains("hidden"));
      check("無料版ではロックの説明が見える", !byId(env, "body-locked").classList.contains("hidden"));
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
  }
  console.log("");
  console.log("結果: " + passed + " passed, " + failed + " failed");
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
