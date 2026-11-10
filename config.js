// PFCかんたん計算ツール — 公開設定
// ここに入れるのは公開して問題ない値だけです (秘密鍵・Stripe のシークレットキーは絶対に入れない)。
// 3 つとも入ると「500円で購入する」ボタンが表示されます。空のあいだは「準備中」と表示します。
window.PFC_CONFIG = {
  // Stripe の Payment Link の URL (https://buy.stripe.com/...)
  paymentLinkUrl: "https://buy.stripe.com/test_28EcMY3vg4T49bh5MfejK00",
  // ライセンス発行 Worker の URL (https://pfc-license.<あなたのサブドメイン>.workers.dev/license)
  licenseApiUrl: "https://pfc-license.nebourocket.workers.dev/license",
  // ライセンス署名の公開鍵 (worker/scripts/gen-keys.mjs が出力する public の JSON)
  licensePublicJwk: {
    kty: "EC",
    x: "-7yzHcfLjpk_QL-4pwqCy6tmUvI2WMVWnhMI_VHK4sQ",
    y: "YH-mAqYS5KYhhQtuY2d3tv7b4wYajpquEAq228SEJ14",
    crv: "P-256",
  },
};
