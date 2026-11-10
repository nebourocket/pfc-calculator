// PFCかんたん計算ツール — 公開設定
// ここに入れるのは公開して問題ない値だけです (秘密鍵・Stripe のシークレットキーは絶対に入れない)。
// 3 つとも入ると「500円で購入する」ボタンが表示されます。空のあいだは「準備中」と表示します。
window.PFC_CONFIG = {
  // Stripe の Payment Link の URL (https://buy.stripe.com/...)
  paymentLinkUrl: "https://buy.stripe.com/bJebIU1uw4RN0OA9jOaR200",
  // ライセンス発行 Worker の URL (https://pfc-license.<あなたのサブドメイン>.workers.dev/license)
  licenseApiUrl: "https://pfc-license.nebourocket.workers.dev/license",
  // ライセンス署名の公開鍵 (worker/scripts/gen-keys.mjs が出力する public の JSON)
  licensePublicJwk: {"kty":"EC","crv":"P-256","x":"vUdO--lHYmHT-EdpqiZjfEHPkbzgtLONtvotquGGHLw","y":"pd0BzdH5SQN1NBvxT0Ia8XSPzf19VCQdNqBKxtp47Tc"},
};
