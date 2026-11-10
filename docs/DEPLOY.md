# 公開・運用の手順

PFCかんたん計算ツールを、サーバー代ゼロで公開・運用するための手順です。
決済を有効にするまでの作業は、上から順に一度だけやれば終わります。

## 費用の考え方

- **GitHub Pages**（アプリ本体）— 公開リポジトリなら無料。
- **Cloudflare Workers**（ライセンス発行）— 無料プランで足ります（1日あたりのリクエスト上限は、購入1回につき1〜2回しか使わない今回の用途では、まず届きません）。
- **Stripe**（決済）— 月額・初期費用はなく、売れたときに決済手数料が引かれるだけ。手数料率は Stripe の料金ページで最新の値を確認してください。

固定費はゼロで、売れた分から手数料が引かれるだけです。独自ドメインを使いたくなったときだけ、ドメイン代がかかります。

## 1. Stripe の準備

1. [Stripe](https://dashboard.stripe.com/register) でアカウントを作り、本人確認と入金口座の登録をすませる。
2. 「設定 → ビジネス → 公開情報」で、表示名を「寝坊ロケット」などにする（カード明細に出る名前です）。特定商取引法に基づく表記の URL として `https://nebourocket.github.io/pfc-calculator/legal.html` を登録する。
3. **商品を作る**：「商品カタログ → 商品を追加」で、名前「PFCかんたん計算ツール Pro（買い切り）」、価格 500円、**1回限り**（継続ではない）。
4. **Payment Link を作る**：その商品から「支払いリンクを作成」。
   - 支払い方法：**カードのみ**（コンビニ・銀行振込など後払いの方法は、戻ってきた時点で未払いのため外す）
   - 数量の変更：**許可しない**
   - プロモーションコード：**許可しない**（金額が500円でないとキーは発行されません）
   - 支払い後の動作：「確認ページを表示しない → 顧客をウェブサイトにリダイレクト」にして、次の URL を入れる
     `https://nebourocket.github.io/pfc-calculator/?session_id={CHECKOUT_SESSION_ID}`
     （`{CHECKOUT_SESSION_ID}` はこのまま書きます。Stripe が本物の番号に置き換えます）
5. できた Payment Link の URL（`https://buy.stripe.com/...`）と ID（`plink_...`）を控える。
6. **制限付きキーを作る**：「開発者 → API キー → 制限付きのキーを作成」。権限は **Checkout Sessions を「読み取り」だけ**、ほかはすべて「なし」。できたキー（`rk_live_...`）は、この後すぐ Cloudflare に登録し、ほかの場所には保存しない。

最初は「テストモード」で同じ手順を踏み、テスト用カード（`4242 4242 4242 4242`）で一通り動くか確かめてから、本番モードで作り直すのがおすすめです。テストと本番では、キー・Payment Link の URL と ID がすべて別物になります。切り替えるときは、下の「テストから本番への切り替え」を必ず全部やってください。

## 2. ライセンス署名の鍵を作る

```bash
node worker/scripts/gen-keys.mjs
```

- 「秘密鍵」の1行 → 次の手順で Cloudflare に登録する。**ファイルにもチャットにも残さない。**
- 「公開鍵」の1行 → `config.js` の `licensePublicJwk` に貼る（公開して問題ありません）。

## 3. Cloudflare Workers に公開する

1. [Cloudflare](https://dash.cloudflare.com/sign-up) で無料アカウントを作る。
2. ログインして、シークレットを登録してから公開する。

```bash
cd worker
npx wrangler@3 login
npx wrangler@3 secret put STRIPE_SECRET_KEY     # rk_live_... を貼る
npx wrangler@3 secret put LICENSE_PRIVATE_JWK   # 手順2の秘密鍵を貼る
npx wrangler@3 deploy
```

3. `wrangler.toml` の `PAYMENT_LINK_ID` に `plink_...` を入れて、もう一度 `npx wrangler@3 deploy`。空のあいだは、安全のためキーを発行しません。
4. 表示された URL（`https://pfc-license.<サブドメイン>.workers.dev`）を控える。

## 4. アプリの設定を入れて公開する

`config.js` の3つを埋めます。

```js
window.PFC_CONFIG = {
  paymentLinkUrl: "https://buy.stripe.com/...",
  licenseApiUrl: "https://pfc-license.<サブドメイン>.workers.dev/license",
  licensePublicJwk: { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." }
};
```

`index.html` の `<meta http-equiv="Content-Security-Policy" …>` にある `connect-src https://*.workers.dev` を、手順3の URL そのもの（例：`connect-src https://pfc-license.<サブドメイン>.workers.dev`）に書き換えます。通信先をこの Worker だけにしぼるためです。Worker の URL を変えたときは、ここも一緒に変えてください。

`legal.html` の「お問い合わせ」に、問い合わせ用のメールアドレスを書きます（本名の入らないアドレスがおすすめ）。

main に入ると GitHub Pages に自動で反映され、「500円で Pro を購入する」ボタンが現れます。

## 5. 動作確認

1. アプリを開き、購入ボタンが Stripe の画面に飛ぶこと。
2. テストモードなら `4242 4242 4242 4242` で支払い、アプリに戻って Pro が有効になり、ライセンスキーが出ること。
3. 別のブラウザ（シークレットウィンドウなど）でキーを貼り付けて、Pro になること。
4. アドレスバーに `session_id` が残っていないこと。

## テストから本番への切り替え

1. Stripe を本番モードにして、手順1の 3〜6（商品・Payment Link・制限付きキー）を作り直す。
2. **署名用の鍵も作り直す**（手順2）。`npx wrangler@3 secret put LICENSE_PRIVATE_JWK` で新しい秘密鍵に入れ替え、`config.js` の `licensePublicJwk` を新しい公開鍵にする。テスト中はテスト用カードで誰でもキーを作れたので、鍵を替えてそれらを使えなくするためです。
3. `npx wrangler@3 secret put STRIPE_SECRET_KEY` で本番のキー（`rk_live_...`）に入れ替える。
4. `wrangler.toml` の `PAYMENT_LINK_ID` を本番の `plink_...` にして `npx wrangler@3 deploy`。
5. `config.js` の `paymentLinkUrl` を本番の URL にして main に入れる。
6. 自分で一度だけ本番で購入して、Pro が有効になることを確かめる（その後 Stripe から自分に返金できます）。

## 運用でやること

- **返金**：Stripe のダッシュボードの「支払い」から返金できます。発行済みのキーは端末の中で動くので、返金後も止められません（500円の買い切りなので、その割り切りにしています）。
- **キーをなくした方への再発行**：Stripe の「支払い」から該当の決済の Checkout Session ID（`cs_live_...`）を確かめ、`https://pfc-license.<サブドメイン>.workers.dev/license?session_id=cs_live_...` を開くと、同じ方のキーを作り直せます。
- **鍵を変えたいとき**（秘密鍵が漏れたかもしれないときなど）：手順2からやり直します。ただし、古い公開鍵を `config.js` から外すと、それまでに発行したキーは新しい端末では使えなくなります。

## もっと固くしたくなったら

GitHub Pages は HTTP ヘッダーを自由に設定できないため、CSP は `<meta>` タグで入れています（他のサイトに枠で埋め込まれるのを防ぐ `frame-ancestors` は meta では効きません）。そこまで必要になったら、Cloudflare Pages（無料）に移して `_headers` ファイルでヘッダーを設定できます。
