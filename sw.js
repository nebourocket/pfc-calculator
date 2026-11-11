// PFCかんたん計算ツール — Service Worker（オフラインでも開けるようにする）
// 方針：いつもネットワークから最新を取り、つながらないときだけ保存した版を使う。
// こうすると、アプリや config.js を更新したときに古い版が残り続けることがない。
// 同じサイトのファイルだけを扱い、ライセンス発行 Worker など外部への通信には触れない。
var CACHE = "pfc-calculator-v6";
var SHELL = [
  "./", "index.html", "styles.css", "app.js", "i18n.js", "foods.js", "off-foods.js", "config.js", "legal.html",
  "manifest.webmanifest", "fonts/KleeOne-SemiBold-subset.woff2", "icons/icon-192.png", "icons/icon-512.png",
  "icons/apple-touch-icon.png", "icons/favicon-32.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).then(function (res) {
      // ?session_id=... などクエリ付きの URL は保存しない（決済番号をキャッシュに残さないため）。
      if (res.ok && !url.search) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match("index.html");
      });
    })
  );
});
