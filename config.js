// PFCかんたん計算ツール — 公開設定
// ここに入れるのは公開して問題ない値だけです (秘密鍵・Stripe のシークレットキーは絶対に入れない)。
// 3 つとも入ると「500円で購入する」ボタンが表示されます。空のあいだは「準備中」と表示します。
window.PFC_CONFIG = {
  // Stripe の Payment Link の URL (https://buy.stripe.com/...)
  paymentLinkUrl: "",
  // ライセンス発行 Worker の URL (https://pfc-license.<あなたのサブドメイン>.workers.dev/license)
  licenseApiUrl: "",
  // ライセンス署名の公開鍵 (worker/scripts/gen-keys.mjs が出力する public の JSON)
  licensePublicJwk: null
};
