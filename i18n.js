// PFCかんたん計算ツール — 表示言語の切り替え（日本語・English・中文）
// 文言は「日本語の文そのもの」をキーにした辞書で引く。辞書に無い文は日本語のまま出す。
// 画面にもとからある文字（index.html）は translateStatic() で書き換え、日本語に戻すときは元の文字を戻す。
(function () {
  "use strict";

  var LANG_KEY = "pfc-calculator-lang";
  var LANGS = ["ja", "en", "zh"];
  var HTML_LANG = { ja: "ja", en: "en", zh: "zh-Hans" };

  // 日本語の文 → 訳。{name} は数字などを入れる穴。
  var DICT = {
  en: {
    "PFCかんたん計算": "PFC Easy Calculator",
    "今日": "Today",
    "記録": "Log",
    "からだ": "Body",
    "設定": "Settings",
    "はじめに読んでください": "Please read first",
    "記録はこの端末のブラウザの中にだけ保存されます。": "Your records are saved only in this device's browser.",
    "サーバーには送らないので、機種を変えたりブラウザのデータを消したりすると、記録も消えます。ときどき「設定」の「データのバックアップ」で書き出しておいてください。": "Nothing is sent to a server, so if you change devices or clear your browser data, your records are gone too. Please export a backup now and then from “Data backup” in “Settings”.",
    "Pro を買ったら、表示されるライセンスキーを控えてください。": "If you buy Pro, keep a note of the license key that is shown.",
    "別のスマホやパソコンで Pro を使うときに入力します。": "You enter it when you use Pro on another phone or computer.",
    "チェーン店のメニューは、まだ入っていません。": "Chain-restaurant menus are not included yet.",
    "各社に掲載の許可をお願いしているところです。見つからない食品は「設定」の「自分の食品を登録する」で、パッケージの栄養成分表示から登録できます。": "We are asking each company for permission to list them. For foods you cannot find, you can add them from the Nutrition Facts on the package via “Add your own food” in “Settings”.",
    "わかりました": "Got it",
    "設定を開く": "Open Settings",
    "今日のお皿": "Today's plate",
    "目標": "Target",
    "kcal の": "kcal ・",
    "栄養成分表示": "Nutrition Facts",
    "今日の合計": "Today's total",
    "エネルギー": "Energy",
    "たんぱく質": "Protein",
    "g ・": "g ・",
    "脂質": "Fat",
    "炭水化物": "Carbs",
    "今日のスタンプ": "Today's stamps",
    "記録を始めよう": "Start logging",
    "からだへ": "Go to Body",
    "よくでき": "Great",
    "ました": "job!",
    "今日の目標クリア": "Today's goal cleared",
    "カロリーは目標の±10%以内、たんぱく質も足りています。": "Calories are within ±10% of your target, and protein is on track.",
    "食品を追加": "Add food",
    "食品を探す": "Search foods",
    "食品": "Food",
    "量（g）": "Amount (g)",
    "追加する": "Add",
    "最近食べたもの": "Recently eaten",
    "食品データの出典：「": "Food data source: “",
    "日本食品標準成分表（八訂）増補2023年": "Standard Tables of Food Composition in Japan (8th revised), 2023 supplement",
    "」（文部科学省）を加工して作成（全2,500品以上。プロテインのみ製品の目安値）。調理方法や銘柄により前後します。": "” (MEXT), adapted. (2,500+ items. Protein powder is a rough value for a typical product.) Values vary by cooking method and brand.",
    "市販品のデータは": "Packaged-food data comes from",
    "のものです（": "(",
    "）。誰でも編集できるデータのため、誤りが含まれることがあります。気になるときは、商品のパッケージの栄養成分表示を確かめてください。": "). Anyone can edit this data, so it may contain errors. If in doubt, check the Nutrition Facts on the product's package.",
    "チェーン店のメニューは、各社から掲載の許可をいただけたものから追加していきます。": "Chain-restaurant menus will be added as each company gives us permission to list them.",
    "今日食べたもの": "Eaten today",
    "まだ何も追加されていません。上のフォームから食品を選んでみてください。": "Nothing added yet. Pick a food in the form above.",
    "今日の記録をすべて消す": "Clear all of today's records",
    "今日の記録をCSVで書き出す（Pro）": "Export today's records as CSV (Pro)",
    "よく食べる組み合わせ": "Favorite combinations",
    "いつもの朝ごはんなど、よく食べる組み合わせをセットとして登録し、ワンタップで追加できるのは、Proの機能です。": "Saving foods you often eat together, such as your usual breakfast, as a set and adding them in one tap is a Pro feature.",
    "セットの名前": "Set name",
    "今日の記録を登録": "Save today's records",
    "まだセットはありません。今日の記録を登録すると、ここに並びます。": "No sets yet. Save today's records and they will be listed here.",
    "今日のスコア": "Today's score",
    "食事・目標の達成・体重・筋トレの記録でポイントがたまり、連続記録が伸びていくのは、Proの機能です。": "Earning points for logging meals, hitting targets, weight and workouts, and growing your streak is a Pro feature.",
    "/ 100点": "/ 100 pts",
    "連続": "Streak",
    "日": "days",
    "自己ベスト": "Best",
    "累計": "Total",
    "点": "pts",
    "50点以上の日が続くと「連続」が伸びます。スコアは日付が変わったときに、その日の記録と目標で確定します。": "Your streak grows while you keep scoring 50 or more. The score is finalized from that day's records and targets when the date changes.",
    "週のふり返り": "Weekly review",
    "記録のグラフ": "Log chart",
    "過去1か月（30日間）のカロリーの推移をグラフでふり返れるのは、Proの機能です。": "Reviewing your calorie trend over the past month (30 days) in a chart is a Pro feature.",
    "まだデータがありません。記録がたまると、ここにグラフが表示されます。": "No data yet. A chart will appear here as records build up.",
    "棒にふれると、その日の内訳が出ます。": "Tap a bar to see that day's breakdown.",
    "直近30日間のカロリーを、たんぱく質（×4kcal）・脂質（×9kcal）・炭水化物（×4kcal）に分けて積み上げています。点線は1日の目標カロリーです。": "Calories for the last 30 days, stacked by protein (×4 kcal), fat (×9 kcal) and carbs (×4 kcal). The dotted line is your daily calorie target.",
    "履歴をCSVで書き出す": "Export history as CSV",
    "過去の記録": "Past records",
    "過去の記録はまだありません。日付が変わると、前日までの合計がここに残ります。": "No past records yet. When the date changes, the previous day's total stays here.",
    "直近7日分を表示しています。": "Showing the last 7 days.",
    "からだの記録": "Body log",
    "今日の体重": "Today's weight",
    "今日の体重（kg）": "Today's weight (kg)",
    "記録する": "Log",
    "体重を2日以上記録すると、グラフが出ます（点＝その日の体重、線＝7日平均、点線＝目標体重）。": "Log your weight on 2 or more days and a chart appears (dots = daily weight, line = 7-day average, dotted line = target weight).",
    "今日の筋トレ": "Today's workout",
    "種目": "Exercise",
    "種目を探す ↗": "Find exercises ↗",
    "重量（kg）": "Weight (kg)",
    "回数": "Reps",
    "セット": "Sets",
    "部位": "Muscle group",
    "種目名から自動": "Auto from exercise name",
    "胸": "Chest",
    "背中": "Back",
    "脚": "Legs",
    "肩": "Shoulders",
    "腕": "Arms",
    "腹": "Abs",
    "その他": "Other",
    "筋トレを追加する": "Add workout",
    "今日の筋トレはまだありません。": "No workouts yet today.",
    "推定1RM（1回だけ持ち上げられる重さの目安）は Epley 式（重量×(1＋回数÷30)）で計算しています。": "Estimated 1RM (a guide to the heaviest weight you could lift once) is calculated with the Epley formula (weight × (1 + reps ÷ 30)).",
    "部位ごとのセット数と、目標体重と期限から必要なカロリーを毎日自動で計算するのは、Proの機能です（「設定」のタブから購入できます）。": "Sets per muscle group, and automatic daily calories calculated from your target weight and deadline, are Pro features (you can buy it from the “Settings” tab).",
    "部位ごとのセット数（直近7日）": "Sets per muscle group (last 7 days)",
    "筋肉を大きくするには、1部位あたり週10セット以上がひとつの目安とされています（Schoenfeld ほか, 2017）。10セットに届いた部位は濃い色になります。": "About 10 or more sets per muscle group per week is a common guideline for building muscle (Schoenfeld et al., 2017). Groups that reach 10 sets are shown in a darker color.",
    "目標体重と期限": "Target weight and deadline",
    "目標体重（kg）": "Target weight (kg)",
    "期限": "Deadline",
    "トレ日は多め・休養日は少なめにする（週の平均は同じ）": "More on training days, less on rest days (weekly average stays the same)",
    "この計画で目標を決める": "Set my target from this plan",
    "計画をやめる": "Cancel the plan",
    "計算の前提：1日の消費（TDEE）は、直近14日の平均摂取カロリーから、体重の増減の傾き×7,700kcal/kg を引いて逆算します。基礎代謝の半分に満たない日は、記録の付け忘れとみなして除きます。記録が足りない間は、基礎代謝（Mifflin-St Jeor 式）×活動レベルを使います。減量は体重の1%/週、増量は0.5%/週を上限にし、目標カロリーは基礎代謝を下回らないようにしています。PFC は、たんぱく質＝体重×2g、脂質＝目標カロリーの25%、炭水化物＝残りです。あくまで一般的な目安で、医療・栄養指導ではありません。": "How it is calculated: daily expenditure (TDEE) is worked back from your average calorie intake over the last 14 days, minus the slope of your weight change × 7,700 kcal/kg. Days under half of your basal metabolism are treated as forgotten logging and left out. While there is not enough data, basal metabolism (Mifflin-St Jeor formula) × activity level is used. Weight loss is capped at 1% of body weight per week and gain at 0.5% per week, and the target calories never go below your basal metabolism. For PFC, protein = body weight × 2 g, fat = 25% of target calories, carbs = the rest. This is only a general guide, not medical or nutrition advice.",
    "1日の目標を設定する": "Set your daily targets",
    "カロリー（kcal）": "Calories (kcal)",
    "たんぱく質（g）": "Protein (g)",
    "脂質（g）": "Fat (g)",
    "炭水化物（g）": "Carbs (g)",
    "入力すると自動で保存されます。": "Changes are saved automatically.",
    "いまは「からだの記録」の計画から、目標が毎日自動で決まっています。手で決めたいときは、計画をやめてください。": "Your daily targets are currently set automatically from the plan in “Body log”. To set them by hand, cancel the plan.",
    "目標の自動計算": "Auto-calculate targets",
    "性別・年齢・身長・体重・活動レベル・目的（減量／維持／増量）から、目標カロリーとPFCの目安を自動で計算できるのは、Proの機能です。": "Automatically calculating target calories and a PFC guide from sex, age, height, weight, activity level and goal (lose / maintain / gain) is a Pro feature.",
    "性別": "Sex",
    "男性": "Male",
    "女性": "Female",
    "年齢": "Age",
    "身長（cm）": "Height (cm)",
    "体重（kg）": "Weight (kg)",
    "活動レベル": "Activity level",
    "ほぼ座り仕事（運動はほとんどなし）": "Mostly desk work (little exercise)",
    "軽い運動（週1〜3回）": "Light exercise (1–3 days a week)",
    "中くらいの運動（週3〜5回）": "Moderate exercise (3–5 days a week)",
    "活発な運動（週6〜7回）": "Very active (6–7 days a week)",
    "目的": "Goal",
    "減量": "Lose weight",
    "維持": "Maintain",
    "増量": "Gain weight",
    "計算して目標に反映する": "Calculate and apply to my targets",
    "計算の前提：基礎代謝は Mifflin-St Jeor 式、1日の消費目安は基礎代謝×活動レベル。目標カロリーは、減量＝消費目安の−20%（ただし基礎代謝は下回らない）、維持＝そのまま、増量＝+10%。PFC の目安は、たんぱく質＝体重×2g、脂質＝目標カロリーの25%、炭水化物＝残りです。あくまで一般的な目安で、医療・栄養指導ではありません。体調に不安がある方は専門家にご相談ください。入力した数値は、この端末の中にだけ保存されます。": "How it is calculated: basal metabolism uses the Mifflin-St Jeor formula, and daily expenditure is basal metabolism × activity level. Target calories are: lose = expenditure −20% (but never below basal metabolism), maintain = as is, gain = +10%. For the PFC guide, protein = body weight × 2 g, fat = 25% of target calories, carbs = the rest. This is only a general guide, not medical or nutrition advice. If you have health concerns, please consult a specialist. The values you enter are saved only on this device.",
    "自分の食品を登録する": "Add your own food",
    "自由枠": "Custom",
    "一覧にない食品は、100gあたりの値を入れて登録できます。無料版は5件まで、Proでは200件まで登録できます。": "If a food is not in the list, you can add it by entering its values per 100 g. You can add up to 5 on the free version and up to 200 with Pro.",
    "食品名": "Food name",
    "カロリー（kcal / 100g）": "Calories (kcal / 100g)",
    "たんぱく質（g / 100g）": "Protein (g / 100g)",
    "脂質（g / 100g）": "Fat (g / 100g)",
    "炭水化物（g / 100g）": "Carbs (g / 100g)",
    "登録する": "Register",
    "無料版の登録上限（5件）に達しました。Proでは200件まで登録できます。": "You have reached the free-version limit (5 items). Pro lets you add up to 200.",
    "データのバックアップ": "Data backup",
    "記録はこの端末のブラウザの中にだけあります。機種変更やブラウザのデータ削除に備えて、ときどきバックアップを書き出しておくと安心です。": "Your records exist only in this device's browser. It is a good idea to export a backup now and then, in case you change devices or clear your browser data.",
    "バックアップを書き出す": "Export backup",
    "バックアップを読み込む": "Import backup",
    "PFC計算ツール Pro": "PFC Calculator Pro",
    "もっと便利に使いたい方へ。Proでは次の機能が使えます。": "Want to use it even more conveniently? Pro gives you the following features.",
    "過去1か月（30日間）の記録をグラフでふり返る": "Review the last month (30 days) of records in a chart",
    "体重や目的から目標カロリー・PFCを自動計算": "Auto-calculate target calories and PFC from your weight and goal",
    "自分の食品を200件まで登録できる": "Add up to 200 of your own foods",
    "目標体重と期限から、食べた量と体重の推移で必要カロリーを毎日自動で計算": "Daily required calories calculated automatically from your target weight and deadline, using what you ate and your weight trend",
    "トレ日と休養日でカロリーを変える・部位ごとの週のセット数": "Different calories for training and rest days, and weekly sets per muscle group",
    "今日のスコアと連続記録、筋トレの自己ベスト更新": "Today's score and streak, and new personal bests in your workouts",
    "記録を期限なしで残す（無料版は食事の記録が90日、体重・筋トレが1年まで）": "Keep your records with no time limit (the free version keeps meal records for 90 days, weight and workouts for 1 year)",
    "この端末に保存できる量がいっぱいで、記録を保存できませんでした。「設定」の「データのバックアップ」で書き出してください。": "This device's storage is full, so your records could not be saved. Export them under Settings > Data backup.",
    "この端末に保存できる量の上限が近づいています。「設定」の「データのバックアップ」で書き出しておいてください。": "This device's storage is almost full. Export your records under Settings > Data backup.",
    "使い方": "How to use",
    "使い方は4ステップ": "Four steps to get started",
    "しまう": "Hide",
    "目標を決める": "Set your goal",
    "食事を入れる": "Log what you ate",
    "お皿を見る": "Check the plate",
    "ふり返る": "Look back",
    "「設定」で1日のカロリーとPFCの目標を決めます。わからなければ、そのまま（2000kcal）でも始められます。": "Set your daily calorie and PFC goals in Settings. Not sure? You can start with the default (2,000 kcal).",
    "食品を探して量（g）を入れ、「追加する」を押します。よく食べるものは次から「最近食べたもの」で1回で入ります。": "Search for a food, enter the amount (g) and press Add. Next time, foods you eat often are one tap away under Recently eaten.",
    "お皿の外側の輪が目標までのカロリー、内側の色がPFCの割合です。目標に届くと、はんこが押されます。": "The outer ring of the plate shows calories toward your goal, and the inner colors show your PFC balance. Hit your goal and you get a stamp.",
    "「記録」タブで、週のスタンプと過去の記録を見られます。毎日つけると連続記録が伸びます。": "The Log tab shows this week's stamps and your past records. Log every day to grow your streak.",
    "次は「{name}」：{desc}": "Next: {name}. {desc}",
    "4つともできました。あとは毎日つけるだけです。この案内は「しまう」で閉じられます。": "All four steps done. Now just keep logging every day. Press Hide to close this guide.",
    "記録をCSVで書き出す": "Export records as CSV",
    "買い切り": "One-time",
    "500円": "¥500",
    "（税込）": "(tax incl.)",
    "月額なし・一度の購入でずっと使えます": "No subscription. Buy once and use it forever.",
    "500円で Pro を購入する": "Buy Pro for ¥500",
    "お支払いは決済サービス Stripe の画面で行います。カード番号はこのアプリにも作者にも届きません。購入が終わるとこのページに戻り、自動で Pro が有効になります。": "Payment is made on the Stripe payment screen. Your card number never reaches this app or its author. After the purchase you return to this page and Pro turns on automatically.",
    "Pro の購入（買い切り500円）は準備中です。": "Pro purchase (one-time ¥500) is being prepared.",
    "ライセンスキー・利用コードをお持ちの方はこちら": "Have a license key or access code? Enter it here",
    "Proを有効にする": "Activate Pro",
    "別の端末で使うときは、購入後に表示されるライセンスキーを入力してください。noteメンバーシップ「寝坊ロケットの創作室」の会員特典の利用コードも、引き続きお使いいただけます。": "To use Pro on another device, enter the license key shown after purchase. Access codes from the note membership “寝坊ロケットの創作室” member perks still work as well.",
    "Proが有効になっています。グラフ・自動計算・CSV書き出し・食品登録200件まで、すべて使えます。記録は期限なしで残ります。ありがとうございます。": "Pro is active. Charts, auto-calculation, CSV export and up to 200 registered foods are all available. Your records are kept with no time limit. Thank you.",
    "あなたのライセンスキー（別の端末やブラウザで Pro を使うときに入力します。他の人には教えないでください）": "Your license key (enter it when using Pro on another device or browser; do not share it with anyone)",
    "キーをコピーする": "Copy key",
    "Proをやめる（解錠を解除する）": "Turn off Pro (remove the unlock)",
    "記録はあなたの端末の中（このブラウザの localStorage）だけに保存されます。アカウント登録は不要で、データが外部に送られることはありません。": "Your records are saved only on your device (this browser's localStorage). No account is needed, and your data is never sent anywhere.",
    "note（寝坊ロケット）": "note (Nebou Rocket)",
    "noteメンバーシップ「寝坊ロケットの創作室」": "note membership “寝坊ロケットの創作室”",
    "特定商取引法に基づく表記": "Legal notice (Japanese)",
    "ソースコード（GitHub）": "Source code (GitHub)",
    "Kindle『大学院進学を迷っている大学4年生へ』を執筆中です。できあがったら、こちらでもお知らせします。": "I am writing a Kindle book, “大学院進学を迷っている大学4年生へ” (for fourth-year undergrads unsure about grad school). I will announce it here when it is ready.",
    "つくった人：寝坊ロケット（nebourocket）": "Made by Nebou Rocket (nebourocket)",
    "画面の切り替え": "Switch screens",
    "はじめに": "Getting started",
    "今日のカロリーの内訳": "Today's calorie breakdown",
    "栄養成分表示（今日の合計）": "Nutrition Facts (today's total)",
    "例：むね、とり むね、ヨーグルト、さば": "e.g. chicken breast, yogurt, mackerel",
    "例：いつもの朝ごはん": "e.g. my usual breakfast",
    "直近7日の記録": "Records for the last 7 days",
    "例：65.4": "e.g. 65.4",
    "例：ベンチプレス": "e.g. Bench press",
    "例：60": "e.g. 60",
    "例：10": "e.g. 10",
    "目標設定": "Target settings",
    "例：30": "e.g. 30",
    "例：170": "e.g. 170",
    "例：65": "e.g. 65",
    "自分の食品を登録": "Add your own food",
    "例：自家製カレー": "e.g. homemade curry",
    "Proについて": "About Pro",
    "PFC1.… または 利用コード": "PFC1.… or access code",
    "まずは今日食べたものを1つ記録してみましょう。": "Start by logging one thing you ate today.",
    "たんぱく質があと {n}g で達成です（鶏むね肉なら約{g}g）。": "Just {n}g more protein to hit your goal (about {g}g of chicken breast).",
    "たんぱく質があと {n}g で達成です。": "Just {n}g more protein to hit your goal.",
    "目標カロリーの±10%まで、あと {n}kcal です。": "{n} kcal more to get within ±10% of your calorie target.",
    "今日は目標を {n}kcal 超えました。明日また整えれば大丈夫です。": "You went {n} kcal over your target today. Just reset tomorrow; it's fine.",
    "体重も記録すると、変化が見えてきます。": "Log your weight too, and you'll start to see changes.",
    "筋トレをした日は、からだタブに記録しておきましょう。": "On days you work out, log it in the Body tab.",
    "今日のチェックはすべて達成です。また明日。": "All of today's checks are done. See you tomorrow.",
    "{label}：達成": "{label}: done",
    "{label}：まだ": "{label}: not yet",
    "日連続で記録": "-day logging streak",
    "日連続で記録中（今日の記録で更新）": "-day logging streak (log today to update)",
    "今日から記録を始めよう": "Start logging from today",
    "記録の連続が自己ベスト更新：{n}日": "New personal best logging streak: {n} days",
    "{n}日連続で記録しています": "Logged {n} days in a row",
    "下の数字は {from}〜{to}（昨日までの7日間）": "The numbers below cover {from}–{to} (the 7 days up to yesterday)",
    "{date}：目標内": "{date}: on target",
    "{date}：記録あり": "{date}: logged",
    "{date}：記録なし": "{date}: no record",
    "前の週：記録なし": "Previous week: no records",
    "前の週 {v}日": "Previous week {v} d",
    "前の週 {v}{unit}": "Previous week {v}{unit}",
    "記録した日": "Days logged",
    "/ 7日": "/ 7 days",
    "目標内の日": "Days on target",
    "カロリー±10%": "Calories ±10%",
    "P 90%以上": "P 90%+",
    "平均カロリー": "Avg. calories",
    "目標 {n}kcal": "Target {n}kcal",
    "平均たんぱく質": "Avg. protein",
    "目標 {n}g": "Target {n}g",
    "◎は目標内の日、○は記録した日です。平均は記録した日だけで出しています。": "◎ = on target, ○ = logged. Averages use only the days you logged.",
    "記録した日がたまると、ここに1週間のまとめが出ます。◎は目標内の日、○は記録した日です。": "Once you have logged some days, a weekly summary appears here. ◎ = on target, ○ = logged.",
    "食品名,量(g),カロリー(kcal),たんぱく質(g),脂質(g),炭水化物(g)": "Food,Amount (g),Calories (kcal),Protein (g),Fat (g),Carbs (g)",
    "合計": "Total",
    "日付,カロリー(kcal),たんぱく質(g),脂質(g),炭水化物(g),体重(kg)": "Date,Calories (kcal),Protein (g),Fat (g),Carbs (g),Weight (kg)",
    "ご購入を確認しています…": "Confirming your purchase…",
    "お支払いを確認できませんでした。決済が完了しているのにこの表示が出る場合は、お問い合わせください。": "We could not confirm your payment. If you see this even though the payment is complete, please contact us.",
    "お支払いをまだ確認できていません。決済が完了していれば、しばらくしてページを再読み込みすると有効になります。続く場合はお問い合わせください。": "Your payment is not confirmed yet. If it has completed, reload the page after a while and Pro will turn on. If this continues, please contact us.",
    "ご購入の確認に失敗しました（通信エラー）。ページを再読み込みすると、もう一度確認します。": "Could not confirm your purchase (network error). Reload the page to try again.",
    "今日のお皿：{kcal}kcal（目標 {target}kcal の {pct}%）。エネルギーの内訳はたんぱく質 {p}kcal、脂質 {f}kcal、炭水化物 {c}kcal": "Today's plate: {kcal} kcal ({pct}% of your {target} kcal target). Energy breakdown: protein {p} kcal, fat {f} kcal, carbs {c} kcal",
    "今日のお皿：{kcal}kcal。エネルギーの内訳はたんぱく質 {p}kcal、脂質 {f}kcal、炭水化物 {c}kcal": "Today's plate: {kcal} kcal. Energy breakdown: protein {p} kcal, fat {f} kcal, carbs {c} kcal",
    "あと {n} kcal": "{n} kcal left",
    "{n} kcal オーバー": "{n} kcal over",
    "よく使う食品を表示しています。ほかの食品（成分表と市販品の全{n}品）は、上の欄で探せます。": "Showing common foods. Search above for other foods (all {n} items from the food tables and packaged products).",
    "よく使う食品を表示しています。ほかの食品（成分表と市販品）は、上の欄で探せます。": "Showing common foods. Search above for other foods (food tables and packaged products).",
    "{n}件見つかりました。市販品のデータを読み込んでいます…": "{n} found. Loading packaged-food data…",
    "市販品のデータを読み込んでいます…": "Loading packaged-food data…",
    "{n}件見つかりました。市販品の一部を読み込めませんでした（通信を確かめて、もう一度探してください）。": "{n} found. Some packaged-food data could not be loaded (check your connection and search again).",
    "市販品の一部を読み込めませんでした（通信を確かめて、もう一度探してください）。": "Some packaged-food data could not be loaded (check your connection and search again).",
    "見つかりませんでした。別のことばで探すか、「自分の食品を登録する」から登録できます。": "Nothing found. Try other words, or add it from “Add your own food”.",
    "{n}件見つかりました（先頭の{max}件を表示。ことばを足すと絞り込めます）": "{n} found (showing the first {max}. Add more words to narrow it down)",
    "{n}件見つかりました": "{n} found",
    "削除": "Delete",
    "100gあたり {kcal}kcal ・ P {p}g ・ F {f}g ・ C {c}g": "Per 100g: {kcal}kcal ・ P {p}g ・ F {f}g ・ C {c}g",
    "登録上限（{n}件）に達しました。": "You have reached the limit ({n} items).",
    "無料版の登録上限（{n}件）に達しました。Proでは{max}件まで登録できます。": "You have reached the free-version limit ({n} items). Pro lets you add up to {max}.",
    "（今日）": "(today)",
    "直近7日の平均 {n}kg": "7-day average {n}kg",
    "週あたり {n}kg（直近14日の傾き）": "{n}kg per week (trend over the last 14 days)",
    "体重を記録すると、平均と増減の傾きが出ます。": "Log your weight to see your average and trend.",
    "{muscle} ・ {kg}kg × {reps}回 × {sets}セット ・ 推定1RM {rm}kg": "{muscle} ・ {kg}kg × {reps} reps × {sets} sets ・ est. 1RM {rm}kg",
    "前回（{date}）{kg}kg × {reps}回 × {sets}セット": "Last time ({date}) {kg}kg × {reps} reps × {sets} sets",
    "★ 自己ベスト更新": "★ New personal best",
    "{n}セット": "{n} sets",
    "先に「1日の目標を設定する」の「目標の自動計算」で、性別・年齢・身長・活動レベルを入れてください。": "First enter your sex, age, height and activity level under “Auto-calculate targets” in “Set your daily targets”.",
    "体重 {w}kg ・ 基礎代謝 約{bmr}kcal": "Weight {w}kg ・ basal metabolism about {bmr}kcal",
    "1日の消費（実績から逆算） 約{tdee}kcal ・ 直近{d}日の平均摂取 {avg}kcal": "Daily expenditure (worked back from actual data) about {tdee}kcal ・ average intake over the last {d} days {avg}kcal",
    "1日の消費（式による推定） 約{tdee}kcal ・ 食事{md}日分と体重{mw}回分（1週間以上）がたまると、実績から計算します（今は食事{d}日・体重{w}回）": "Daily expenditure (estimated by formula) about {tdee}kcal ・ once you have {md} days of meals and {mw} weigh-ins (spanning a week or more), it will be calculated from actual data (so far: {d} days of meals, {w} weigh-ins)",
    "目標 {w}kg まで あと{d}日 ・ 計画 週{n}kg（体に無理のない速さに抑えています）": "Target {w}kg in {d} days ・ plan {n}kg per week (kept to a pace that is gentle on your body)",
    "目標 {w}kg まで あと{d}日 ・ 計画 週{n}kg": "Target {w}kg in {d} days ・ plan {n}kg per week",
    "期限を過ぎたので、今の体重を保つカロリーにしています。": "The deadline has passed, so calories are set to maintain your current weight.",
    "トレ日と休養日の切り替え：毎日筋トレしているので、切り替えずに平均のカロリーにしています。": "Training/rest day switching: you train every day, so the average calories are used without switching.",
    "トレ日と休養日の切り替え：目標が基礎代謝に近く、休養日を減らす余裕がないので切り替えていません。": "Training/rest day switching: your target is close to your basal metabolism, so there is no room to lower rest-day calories; not switching.",
    "トレ日と休養日の切り替え：直近4週間の筋トレの記録（週1〜6日）がたまると始まります（今は週0日）。": "Training/rest day switching: starts once you have logged workouts on 1–6 days a week over the last 4 weeks (currently 0 days a week).",
    "今日はトレ日なので、平均より多めにしています（平均 {k}kcal、週{n}日トレ）。": "Today is a training day, so calories are higher than average (average {k}kcal, {n} training days a week).",
    "今日は休養日なので、平均より少なめにしています（平均 {k}kcal、週{n}日トレ）。筋トレを記録すると、トレ日のカロリーに変わります。": "Today is a rest day, so calories are lower than average (average {k}kcal, {n} training days a week). Log a workout and it switches to the training-day calories.",
    "今日の目標 {kcal}kcal ・ P {p}g ・ F {f}g ・ C {c}g（基礎代謝を下回らないようにしています）": "Today's target {kcal}kcal ・ P {p}g ・ F {f}g ・ C {c}g (kept from going below your basal metabolism)",
    "今日の目標 {kcal}kcal ・ P {p}g ・ F {f}g ・ C {c}g": "Today's target {kcal}kcal ・ P {p}g ・ F {f}g ・ C {c}g",
    "目標は計画から毎日自動で決まります。手で決めたいときは「計画をやめる」を押してください。": "Your targets are set automatically every day from the plan. To set them by hand, press “Cancel the plan”.",
    "目標体重と期限を入れると、毎日の目標カロリーとPFCを自動で決めます。": "Enter a target weight and deadline and your daily target calories and PFC are set automatically.",
    "直近{n}日の体重のグラフ": "Weight chart for the last {n} days",
    "{food} {n}g を追加": "Add {food} {n}g",
    "昨日と同じものを追加する（{n}品）": "Add the same as yesterday ({n} items)",
    "{date}と同じものを追加する（{n}品）": "Add the same as {date} ({n} items)",
    "{n}品 ・ {kcal}kcal（消した食品{m}品は追加されません）": "{n} items ・ {kcal}kcal ({m} deleted foods will not be added)",
    "{n}品 ・ {kcal}kcal": "{n} items ・ {kcal}kcal",
    "追加": "Add",
    "「{name}」を今日の記録に追加しました（{n}品）。": "Added “{name}” to today's records ({n} items).",
    "「{name}」の食品はすべて消されているため、追加できませんでした。": "“{name}” could not be added because all of its foods have been deleted.",
    "セット「{name}」を消しますか？": "Delete the set “{name}”?",
    "{label}（{n}点）": "{label} ({n} pts)",
    "今日の記録をすべて消しますか？": "Clear all of today's records?",
    "ライセンスキーが正しくありません。コピーしたキー全体を貼り付けてください。": "The license key is not valid. Paste the whole key you copied.",
    "コードが正しくありません。もう一度お確かめください。": "The code is not valid. Please check it and try again.",
    "Proをやめて、無料版に戻しますか？（記録は消えませんが、日付が変わると、90日より前の食事の記録と1年より前の体重・筋トレ・スコアは消えます）\nライセンスキーも消えるので、再び使うときのためにキーを控えておいてください。": "Turn off Pro and go back to the free version? (Your records stay, but when the date changes, meal records older than 90 days and weight, workout and score records older than 1 year will be deleted)\nYour license key will also be removed, so make a note of it in case you use Pro again.",
    "Proをやめて、無料版に戻しますか？（記録は消えませんが、日付が変わると、90日より前の食事の記録と1年より前の体重・筋トレ・スコアは消えます）": "Turn off Pro and go back to the free version? (Your records stay, but when the date changes, meal records older than 90 days and weight, workout and score records older than 1 year will be deleted)",
    "入力を確認してください（年齢10〜100、身長100〜250cm、体重20〜300kg）。": "Please check your input (age 10–100, height 100–250cm, weight 20–300kg).",
    "プロフィールを保存しました。計画があるので、今日の目標は「からだの記録」の計画から決めています。": "Profile saved. Because you have a plan, today's targets are set from the plan in “Body log”.",
    "基礎代謝 約{bmr}kcal ・ 1日の消費目安 約{tdee}kcal → 目標 {kcal}kcal（P {p}g ・ F {f}g ・ C {c}g）を設定しました。": "Basal metabolism about {bmr}kcal ・ estimated daily expenditure about {tdee}kcal → target {kcal}kcal (P {p}g ・ F {f}g ・ C {c}g) has been applied.",
    "セットの名前を入れてください（例：朝ごはん）。": "Enter a name for the set (e.g. Breakfast).",
    "今日の記録が空です。先に食品を追加してください。": "Today's records are empty. Add a food first.",
    "セットは{n}個まで登録できます。": "You can save up to {n} sets.",
    "「{name}」を登録しました。次からはワンタップで追加できます。（1つのセットには先頭の{n}品までが入ります）": "Saved “{name}”. From now on you can add it in one tap. (A set holds only the first {n} items)",
    "「{name}」を登録しました。次からはワンタップで追加できます。": "Saved “{name}”. From now on you can add it in one tap.",
    "種目名・重量（0〜1000kg）・回数・セット数（整数）を確かめてください。": "Please check the exercise name, weight (0–1000kg), reps and sets (whole numbers).",
    "1日に記録できるのは{n}件までです。": "You can log up to {n} items per day.",
    "★ {name}の自己ベスト（推定1RM {rm}kg）を更新しました！": "★ New personal best for {name} (estimated 1RM {rm}kg)!",
    "目標体重（20〜300kg）と、明日以降の期限を入れてください。": "Enter a target weight (20–300kg) and a deadline from tomorrow onward.",
    "計画をやめますか？（今の目標値はそのまま残り、手で変えられるようになります）": "Cancel the plan? (Your current target values stay as they are, and you can change them by hand.)",
    "ファイルが大きすぎます（5MBまで）。": "The file is too large (up to 5MB).",
    "バックアップを読み込みますか？ この端末の今の記録は、バックアップの内容で置き換わります。": "Import the backup? Your current records on this device will be replaced with the backup's contents.",
    "バックアップを読み込みました。": "Backup imported.",
    "このファイルは読み込めませんでした。このアプリで書き出したバックアップを選んでください。": "This file could not be read. Please choose a backup exported from this app.",
    "コピーしました": "Copied",
    "「{name}」を入れました。重量・回数・セットを入れて追加してください。": "Entered “{name}”. Fill in the weight, reps and sets, then add it.",
    "この端末ではすでに購入済みのライセンスキーで Pro が有効です。": "Pro is already active on this device with a purchased license key.",
    "PFCかんたん計算ツール": "PFC Easy Calculator",
    "食品を選んでグラム数を入れるだけ。カロリーとPFC（たんぱく質・脂質・炭水化物）をかんたんに合計できる、無料の計算ツールです。": "Pick a food, enter the grams, and get your total calories and PFC (protein, fat, carbs). A free calculator.",
    "自分の食品": "Your own foods",
    "市販品": "Packaged products",
    "主食": "Staples",
    "肉": "Meat",
    "魚": "Fish",
    "卵・大豆": "Eggs & soy",
    "乳製品": "Dairy",
    "野菜": "Vegetables",
    "果物": "Fruit",
    "穀類": "Grains",
    "いも及びでん粉類": "Potatoes & starches",
    "砂糖及び甘味類": "Sugars & sweeteners",
    "豆類": "Legumes",
    "種実類": "Nuts & seeds",
    "野菜類": "Vegetables (food table)",
    "果実類": "Fruits (food table)",
    "きのこ類": "Mushrooms",
    "藻類": "Seaweed",
    "魚介類": "Fish & shellfish (food table)",
    "肉類": "Meats (food table)",
    "卵類": "Eggs (food table)",
    "乳類": "Milk & dairy (food table)",
    "油脂類": "Fats & oils",
    "菓子類": "Confectioneries",
    "し好飲料類": "Beverages",
    "調味料及び香辛料類": "Seasonings & spices",
    "調理済み流通食品類": "Prepared foods",
    "食事を記録した": "Logged a meal",
    "食事": "Meals",
    "カロリーが目標の±10%以内": "Calories within ±10% of target",
    "たんぱく質が目標の90%以上": "Protein at 90% or more of target",
    "たんぱく質90%": "Protein 90%",
    "体重を記録した": "Logged weight",
    "体重": "Weight",
    "筋トレを記録した": "Logged a workout",
    "筋トレ": "Workout"
  },
  zh: {
    "PFCかんたん計算": "PFC简易计算器",
    "今日": "今天",
    "記録": "记录",
    "からだ": "身体",
    "設定": "设置",
    "はじめに読んでください": "请先阅读",
    "記録はこの端末のブラウザの中にだけ保存されます。": "记录只保存在这台设备的浏览器中。",
    "サーバーには送らないので、機種を変えたりブラウザのデータを消したりすると、記録も消えます。ときどき「設定」の「データのバックアップ」で書き出しておいてください。": "记录不会发送到服务器，所以更换设备或清除浏览器数据后，记录也会消失。请定期在“设置”的“数据备份”中导出备份。",
    "Pro を買ったら、表示されるライセンスキーを控えてください。": "购买 Pro 后，请记下显示的许可证密钥。",
    "別のスマホやパソコンで Pro を使うときに入力します。": "在其他手机或电脑上使用 Pro 时需要输入。",
    "チェーン店のメニューは、まだ入っていません。": "尚未收录连锁餐厅的菜单。",
    "各社に掲載の許可をお願いしているところです。見つからない食品は「設定」の「自分の食品を登録する」で、パッケージの栄養成分表示から登録できます。": "我们正在请各家公司允许收录。找不到的食品，可以在“设置”的“登记自己的食品”中，按包装上的营养成分表登记。",
    "わかりました": "知道了",
    "設定を開く": "打开设置",
    "今日のお皿": "今日餐盘",
    "目標": "目标",
    "kcal の": "kcal 的",
    "栄養成分表示": "营养成分表",
    "今日の合計": "今日合计",
    "エネルギー": "能量",
    "たんぱく質": "蛋白质",
    "g ・": "g ・",
    "脂質": "脂肪",
    "炭水化物": "碳水化合物",
    "今日のスタンプ": "今日印章",
    "記録を始めよう": "开始记录吧",
    "からだへ": "去“身体”",
    "よくでき": "做得",
    "ました": "很棒",
    "今日の目標クリア": "完成今日目标",
    "カロリーは目標の±10%以内、たんぱく質も足りています。": "热量在目标的±10%以内，蛋白质也足够。",
    "食品を追加": "添加食品",
    "食品を探す": "搜索食品",
    "食品": "食品",
    "量（g）": "分量（g）",
    "追加する": "添加",
    "最近食べたもの": "最近吃过的",
    "食品データの出典：「": "食品数据来源：“",
    "日本食品標準成分表（八訂）増補2023年": "日本食品标准成分表（八订）2023年增补版",
    "」（文部科学省）を加工して作成（全2,500品以上。プロテインのみ製品の目安値）。調理方法や銘柄により前後します。": "”（日本文部科学省），经加工整理（共2,500多种。蛋白粉为产品的参考值）。实际数值因烹饪方法和品牌而异。",
    "市販品のデータは": "市售商品的数据来自",
    "のものです（": "（",
    "）。誰でも編集できるデータのため、誤りが含まれることがあります。気になるときは、商品のパッケージの栄養成分表示を確かめてください。": "）。这些数据人人可编辑，可能含有错误。如有疑问，请核对商品包装上的营养成分表。",
    "チェーン店のメニューは、各社から掲載の許可をいただけたものから追加していきます。": "连锁餐厅的菜单，将从获得各家公司收录许可的开始陆续添加。",
    "今日食べたもの": "今日吃的",
    "まだ何も追加されていません。上のフォームから食品を選んでみてください。": "还没有添加任何内容。请在上面的表单中选择食品。",
    "今日の記録をすべて消す": "清除今日全部记录",
    "今日の記録をCSVで書き出す（Pro）": "将今日记录导出为CSV（Pro）",
    "よく食べる組み合わせ": "常吃的组合",
    "いつもの朝ごはんなど、よく食べる組み合わせをセットとして登録し、ワンタップで追加できるのは、Proの機能です。": "把常吃的组合（比如固定的早餐）登记为套餐，一键添加，这是 Pro 功能。",
    "セットの名前": "套餐名称",
    "今日の記録を登録": "登记今日记录",
    "まだセットはありません。今日の記録を登録すると、ここに並びます。": "还没有套餐。登记今日记录后，会显示在这里。",
    "今日のスコア": "今日得分",
    "食事・目標の達成・体重・筋トレの記録でポイントがたまり、連続記録が伸びていくのは、Proの機能です。": "通过记录饮食、达成目标、体重和训练来积累积分、延长连续记录，这是 Pro 功能。",
    "/ 100点": "/ 100分",
    "連続": "连续",
    "日": "天",
    "自己ベスト": "最佳纪录",
    "累計": "累计",
    "点": "分",
    "50点以上の日が続くと「連続」が伸びます。スコアは日付が変わったときに、その日の記録と目標で確定します。": "连续得分50分以上时，“连续”天数会增加。得分在日期变更时，根据当天的记录和目标确定。",
    "週のふり返り": "每周回顾",
    "記録のグラフ": "记录图表",
    "過去1か月（30日間）のカロリーの推移をグラフでふり返れるのは、Proの機能です。": "用图表回顾过去一个月（30天）的热量变化，这是 Pro 功能。",
    "まだデータがありません。記録がたまると、ここにグラフが表示されます。": "还没有数据。记录积累后，这里会显示图表。",
    "棒にふれると、その日の内訳が出ます。": "点按柱子可查看当天的明细。",
    "直近30日間のカロリーを、たんぱく質（×4kcal）・脂質（×9kcal）・炭水化物（×4kcal）に分けて積み上げています。点線は1日の目標カロリーです。": "将最近30天的热量按蛋白质（×4kcal）、脂肪（×9kcal）、碳水化合物（×4kcal）堆叠显示。虚线是每日目标热量。",
    "履歴をCSVで書き出す": "将历史导出为CSV",
    "過去の記録": "过去的记录",
    "過去の記録はまだありません。日付が変わると、前日までの合計がここに残ります。": "还没有过去的记录。日期变更后，前一天的合计会保留在这里。",
    "直近7日分を表示しています。": "显示最近7天。",
    "からだの記録": "身体记录",
    "今日の体重": "今日体重",
    "今日の体重（kg）": "今日体重（kg）",
    "記録する": "记录",
    "体重を2日以上記録すると、グラフが出ます（点＝その日の体重、線＝7日平均、点線＝目標体重）。": "记录体重满2天后会显示图表（圆点＝当天体重，实线＝7天平均，虚线＝目标体重）。",
    "今日の筋トレ": "今日训练",
    "種目": "项目",
    "種目を探す ↗": "查找项目 ↗",
    "重量（kg）": "重量（kg）",
    "回数": "次数",
    "セット": "组数",
    "部位": "部位",
    "種目名から自動": "按项目名称自动判断",
    "胸": "胸",
    "背中": "背",
    "脚": "腿",
    "肩": "肩",
    "腕": "手臂",
    "腹": "腹",
    "その他": "其他",
    "筋トレを追加する": "添加训练",
    "今日の筋トレはまだありません。": "今日还没有训练记录。",
    "推定1RM（1回だけ持ち上げられる重さの目安）は Epley 式（重量×(1＋回数÷30)）で計算しています。": "预估1RM（只能举起一次的重量的参考值）按 Epley 公式（重量×(1＋次数÷30)）计算。",
    "部位ごとのセット数と、目標体重と期限から必要なカロリーを毎日自動で計算するのは、Proの機能です（「設定」のタブから購入できます）。": "各部位的组数，以及根据目标体重和期限每天自动计算所需热量，是 Pro 功能（可在“设置”标签中购买）。",
    "部位ごとのセット数（直近7日）": "各部位组数（最近7天）",
    "筋肉を大きくするには、1部位あたり週10セット以上がひとつの目安とされています（Schoenfeld ほか, 2017）。10セットに届いた部位は濃い色になります。": "要增肌，每个部位每周10组以上被视为一个参考标准（Schoenfeld 等，2017）。达到10组的部位会显示为深色。",
    "目標体重と期限": "目标体重和期限",
    "目標体重（kg）": "目标体重（kg）",
    "期限": "期限",
    "トレ日は多め・休養日は少なめにする（週の平均は同じ）": "训练日多吃、休息日少吃（一周平均不变）",
    "この計画で目標を決める": "按此计划设定目标",
    "計画をやめる": "取消计划",
    "計算の前提：1日の消費（TDEE）は、直近14日の平均摂取カロリーから、体重の増減の傾き×7,700kcal/kg を引いて逆算します。基礎代謝の半分に満たない日は、記録の付け忘れとみなして除きます。記録が足りない間は、基礎代謝（Mifflin-St Jeor 式）×活動レベルを使います。減量は体重の1%/週、増量は0.5%/週を上限にし、目標カロリーは基礎代謝を下回らないようにしています。PFC は、たんぱく質＝体重×2g、脂質＝目標カロリーの25%、炭水化物＝残りです。あくまで一般的な目安で、医療・栄養指導ではありません。": "计算前提：每日消耗（TDEE）由最近14天的平均摄入热量，减去体重变化的斜率×7,700kcal/kg 反推得出。不足基础代谢一半的日子，视为漏记，不计入。数据不够时，使用基础代谢（Mifflin-St Jeor 公式）×活动水平。减重每周不超过体重的1%，增重每周不超过0.5%，目标热量不会低于基础代谢。PFC 为：蛋白质＝体重×2g，脂肪＝目标热量的25%，碳水化合物＝其余部分。这只是一般性的参考，不是医疗或营养指导。",
    "1日の目標を設定する": "设定每日目标",
    "カロリー（kcal）": "热量（kcal）",
    "たんぱく質（g）": "蛋白质（g）",
    "脂質（g）": "脂肪（g）",
    "炭水化物（g）": "碳水化合物（g）",
    "入力すると自動で保存されます。": "输入后自动保存。",
    "いまは「からだの記録」の計画から、目標が毎日自動で決まっています。手で決めたいときは、計画をやめてください。": "目前每日目标由“身体记录”中的计划自动设定。想手动设定时，请取消计划。",
    "目標の自動計算": "自动计算目标",
    "性別・年齢・身長・体重・活動レベル・目的（減量／維持／増量）から、目標カロリーとPFCの目安を自動で計算できるのは、Proの機能です。": "根据性别、年龄、身高、体重、活动水平和目的（减重／维持／增重）自动计算目标热量和PFC参考值，是 Pro 功能。",
    "性別": "性别",
    "男性": "男性",
    "女性": "女性",
    "年齢": "年龄",
    "身長（cm）": "身高（cm）",
    "体重（kg）": "体重（kg）",
    "活動レベル": "活动水平",
    "ほぼ座り仕事（運動はほとんどなし）": "基本久坐办公（几乎不运动）",
    "軽い運動（週1〜3回）": "轻度运动（每周1–3次）",
    "中くらいの運動（週3〜5回）": "中度运动（每周3–5次）",
    "活発な運動（週6〜7回）": "高强度运动（每周6–7次）",
    "目的": "目的",
    "減量": "减重",
    "維持": "维持",
    "増量": "增重",
    "計算して目標に反映する": "计算并应用到目标",
    "計算の前提：基礎代謝は Mifflin-St Jeor 式、1日の消費目安は基礎代謝×活動レベル。目標カロリーは、減量＝消費目安の−20%（ただし基礎代謝は下回らない）、維持＝そのまま、増量＝+10%。PFC の目安は、たんぱく質＝体重×2g、脂質＝目標カロリーの25%、炭水化物＝残りです。あくまで一般的な目安で、医療・栄養指導ではありません。体調に不安がある方は専門家にご相談ください。入力した数値は、この端末の中にだけ保存されます。": "计算前提：基础代谢使用 Mifflin-St Jeor 公式，每日消耗参考值为基础代谢×活动水平。目标热量为：减重＝消耗参考值的−20%（但不低于基础代谢），维持＝保持不变，增重＝+10%。PFC 的参考值为：蛋白质＝体重×2g，脂肪＝目标热量的25%，碳水化合物＝其余部分。这只是一般性的参考，不是医疗或营养指导。如有健康方面的担忧，请咨询专业人士。输入的数值只保存在这台设备中。",
    "自分の食品を登録する": "登记自己的食品",
    "自由枠": "自定义",
    "一覧にない食品は、100gあたりの値を入れて登録できます。無料版は5件まで、Proでは200件まで登録できます。": "列表中没有的食品，可以填入每100g的数值进行登记。免费版最多5件，Pro 最多200件。",
    "食品名": "食品名称",
    "カロリー（kcal / 100g）": "热量（kcal / 100g）",
    "たんぱく質（g / 100g）": "蛋白质（g / 100g）",
    "脂質（g / 100g）": "脂肪（g / 100g）",
    "炭水化物（g / 100g）": "碳水化合物（g / 100g）",
    "登録する": "登记",
    "無料版の登録上限（5件）に達しました。Proでは200件まで登録できます。": "已达到免费版的登记上限（5件）。Pro 最多可登记200件。",
    "データのバックアップ": "数据备份",
    "記録はこの端末のブラウザの中にだけあります。機種変更やブラウザのデータ削除に備えて、ときどきバックアップを書き出しておくと安心です。": "记录只存在于这台设备的浏览器中。为防止更换设备或清除浏览器数据，建议定期导出备份。",
    "バックアップを書き出す": "导出备份",
    "バックアップを読み込む": "导入备份",
    "PFC計算ツール Pro": "PFC计算工具 Pro",
    "もっと便利に使いたい方へ。Proでは次の機能が使えます。": "想用得更方便吗？Pro 提供以下功能。",
    "過去1か月（30日間）の記録をグラフでふり返る": "用图表回顾过去一个月（30天）的记录",
    "体重や目的から目標カロリー・PFCを自動計算": "根据体重和目的自动计算目标热量和PFC",
    "自分の食品を200件まで登録できる": "最多可登记200种自己的食品",
    "目標体重と期限から、食べた量と体重の推移で必要カロリーを毎日自動で計算": "根据目标体重和期限，结合饮食量和体重变化，每天自动计算所需热量",
    "トレ日と休養日でカロリーを変える・部位ごとの週のセット数": "训练日与休息日的热量区分，以及各部位的每周组数",
    "今日のスコアと連続記録、筋トレの自己ベスト更新": "今日得分与连续记录，训练个人最佳纪录的更新",
    "記録を期限なしで残す（無料版は食事の記録が90日、体重・筋トレが1年まで）": "记录无限期保存（免费版的饮食记录保存90天，体重和训练保存1年）",
    "この端末に保存できる量がいっぱいで、記録を保存できませんでした。「設定」の「データのバックアップ」で書き出してください。": "此设备的存储空间已满，记录未能保存。请在“设置”的“数据备份”中导出。",
    "この端末に保存できる量の上限が近づいています。「設定」の「データのバックアップ」で書き出しておいてください。": "此设备的存储空间即将用满。请在“设置”的“数据备份”中导出记录。",
    "使い方": "使用方法",
    "使い方は4ステップ": "只需4步",
    "しまう": "收起",
    "目標を決める": "设定目标",
    "食事を入れる": "记录饮食",
    "お皿を見る": "看餐盘",
    "ふり返る": "回顾记录",
    "「設定」で1日のカロリーとPFCの目標を決めます。わからなければ、そのまま（2000kcal）でも始められます。": "在“设置”中设定每天的热量和PFC目标。不确定的话，也可以直接用默认值（2000kcal）开始。",
    "食品を探して量（g）を入れ、「追加する」を押します。よく食べるものは次から「最近食べたもの」で1回で入ります。": "搜索食品，输入分量（g），然后点“添加”。常吃的食品下次可以在“最近吃过的”里一键添加。",
    "お皿の外側の輪が目標までのカロリー、内側の色がPFCの割合です。目標に届くと、はんこが押されます。": "餐盘外圈表示距离目标的热量，内圈颜色表示PFC比例。达到目标就会盖上印章。",
    "「記録」タブで、週のスタンプと過去の記録を見られます。毎日つけると連続記録が伸びます。": "在“记录”页可以查看本周的印章和过去的记录。每天记录，连续天数就会增加。",
    "次は「{name}」：{desc}": "下一步：{name}。{desc}",
    "4つともできました。あとは毎日つけるだけです。この案内は「しまう」で閉じられます。": "4步全部完成。之后每天记录就好。点“收起”可以关闭这个指南。",
    "記録をCSVで書き出す": "将记录导出为CSV",
    "買い切り": "一次性买断",
    "500円": "500日元",
    "（税込）": "（含税）",
    "月額なし・一度の購入でずっと使えます": "无月费。一次购买，永久使用。",
    "500円で Pro を購入する": "以500日元购买 Pro",
    "お支払いは決済サービス Stripe の画面で行います。カード番号はこのアプリにも作者にも届きません。購入が終わるとこのページに戻り、自動で Pro が有効になります。": "支付在支付服务 Stripe 的页面完成。卡号不会传给本应用，也不会传给作者。购买完成后会回到本页面，Pro 自动启用。",
    "Pro の購入（買い切り500円）は準備中です。": "Pro 的购买（一次性买断 500日元）正在准备中。",
    "ライセンスキー・利用コードをお持ちの方はこちら": "已有许可证密钥或使用码的用户请在此输入",
    "Proを有効にする": "启用 Pro",
    "別の端末で使うときは、購入後に表示されるライセンスキーを入力してください。noteメンバーシップ「寝坊ロケットの創作室」の会員特典の利用コードも、引き続きお使いいただけます。": "在其他设备上使用时，请输入购买后显示的许可证密钥。note 会员“寝坊ロケットの創作室”的会员福利使用码，也可继续使用。",
    "Proが有効になっています。グラフ・自動計算・CSV書き出し・食品登録200件まで、すべて使えます。記録は期限なしで残ります。ありがとうございます。": "Pro 已启用。图表、自动计算、CSV导出、最多200种食品登记，全部可用。记录将无限期保存。谢谢您。",
    "あなたのライセンスキー（別の端末やブラウザで Pro を使うときに入力します。他の人には教えないでください）": "您的许可证密钥（在其他设备或浏览器使用 Pro 时输入。请勿告诉他人）",
    "キーをコピーする": "复制密钥",
    "Proをやめる（解錠を解除する）": "停用 Pro（解除解锁）",
    "記録はあなたの端末の中（このブラウザの localStorage）だけに保存されます。アカウント登録は不要で、データが外部に送られることはありません。": "记录仅保存在您的设备中（此浏览器的 localStorage）。无需注册账号，数据也不会发送到外部。",
    "note（寝坊ロケット）": "note（Nebou Rocket）",
    "noteメンバーシップ「寝坊ロケットの創作室」": "note 会员“寝坊ロケットの創作室”",
    "特定商取引法に基づく表記": "特定商业交易法标示（日文）",
    "ソースコード（GitHub）": "源代码（GitHub）",
    "Kindle『大学院進学を迷っている大学4年生へ』を執筆中です。できあがったら、こちらでもお知らせします。": "我正在撰写 Kindle 图书《大学院進学を迷っている大学4年生へ》（写给犹豫是否读研的大四学生）。完成后会在这里通知大家。",
    "つくった人：寝坊ロケット（nebourocket）": "作者：Nebou Rocket（nebourocket）",
    "画面の切り替え": "切换画面",
    "はじめに": "开始之前",
    "今日のカロリーの内訳": "今日热量构成",
    "栄養成分表示（今日の合計）": "营养成分表（今日合计）",
    "例：むね、とり むね、ヨーグルト、さば": "例如：鸡胸、酸奶、青花鱼",
    "例：いつもの朝ごはん": "例如：固定的早餐",
    "直近7日の記録": "最近7天的记录",
    "例：65.4": "例如：65.4",
    "例：ベンチプレス": "例如：卧推",
    "例：60": "例如：60",
    "例：10": "例如：10",
    "目標設定": "目标设置",
    "例：30": "例如：30",
    "例：170": "例如：170",
    "例：65": "例如：65",
    "自分の食品を登録": "登记自己的食品",
    "例：自家製カレー": "例如：自制咖喱",
    "Proについて": "关于 Pro",
    "PFC1.… または 利用コード": "PFC1.… 或使用码",
    "まずは今日食べたものを1つ記録してみましょう。": "先记录一样今天吃的东西吧。",
    "たんぱく質があと {n}g で達成です（鶏むね肉なら約{g}g）。": "蛋白质再摄入 {n}g 就达标了（约{g}g鸡胸肉）。",
    "たんぱく質があと {n}g で達成です。": "蛋白质再摄入 {n}g 就达标了。",
    "目標カロリーの±10%まで、あと {n}kcal です。": "再摄入 {n}kcal，热量就进入目标的±10%以内。",
    "今日は目標を {n}kcal 超えました。明日また整えれば大丈夫です。": "今天比目标超出了 {n}kcal。明天再调整就没问题。",
    "体重も記録すると、変化が見えてきます。": "也记录一下体重，就能看到变化了。",
    "筋トレをした日は、からだタブに記録しておきましょう。": "训练的日子，请记录在“身体”标签中。",
    "今日のチェックはすべて達成です。また明日。": "今天的检查项全部完成。明天见。",
    "{label}：達成": "{label}：已达成",
    "{label}：まだ": "{label}：尚未达成",
    "日連続で記録": "天连续记录",
    "日連続で記録中（今日の記録で更新）": "天连续记录中（记录今天即可更新）",
    "今日から記録を始めよう": "从今天开始记录吧",
    "記録の連続が自己ベスト更新：{n}日": "连续记录刷新个人最佳：{n}天",
    "{n}日連続で記録しています": "已连续记录 {n} 天",
    "下の数字は {from}〜{to}（昨日までの7日間）": "下面的数字为 {from}〜{to}（截至昨天的7天）",
    "{date}：目標内": "{date}：目标内",
    "{date}：記録あり": "{date}：有记录",
    "{date}：記録なし": "{date}：无记录",
    "前の週：記録なし": "上一周：无记录",
    "前の週 {v}日": "上一周 {v}天",
    "前の週 {v}{unit}": "上一周 {v}{unit}",
    "記録した日": "记录的天数",
    "/ 7日": "/ 7天",
    "目標内の日": "达标的天数",
    "カロリー±10%": "热量±10%",
    "P 90%以上": "P 90%以上",
    "平均カロリー": "平均热量",
    "目標 {n}kcal": "目标 {n}kcal",
    "平均たんぱく質": "平均蛋白质",
    "目標 {n}g": "目标 {n}g",
    "◎は目標内の日、○は記録した日です。平均は記録した日だけで出しています。": "◎为达标日，○为有记录的日子。平均值只按有记录的日子计算。",
    "記録した日がたまると、ここに1週間のまとめが出ます。◎は目標内の日、○は記録した日です。": "记录了一些日子后，这里会显示一周的汇总。◎为达标日，○为有记录的日子。",
    "食品名,量(g),カロリー(kcal),たんぱく質(g),脂質(g),炭水化物(g)": "食品名,分量(g),热量(kcal),蛋白质(g),脂肪(g),碳水化合物(g)",
    "合計": "合计",
    "日付,カロリー(kcal),たんぱく質(g),脂質(g),炭水化物(g),体重(kg)": "日期,热量(kcal),蛋白质(g),脂肪(g),碳水化合物(g),体重(kg)",
    "ご購入を確認しています…": "正在确认您的购买…",
    "お支払いを確認できませんでした。決済が完了しているのにこの表示が出る場合は、お問い合わせください。": "无法确认您的支付。如果支付已完成却仍显示此提示，请联系我们。",
    "お支払いをまだ確認できていません。決済が完了していれば、しばらくしてページを再読み込みすると有効になります。続く場合はお問い合わせください。": "尚未确认到您的支付。如果支付已完成，请稍后重新加载页面，Pro 就会启用。如果一直如此，请联系我们。",
    "ご購入の確認に失敗しました（通信エラー）。ページを再読み込みすると、もう一度確認します。": "购买确认失败（通信错误）。重新加载页面后会再次确认。",
    "今日のお皿：{kcal}kcal（目標 {target}kcal の {pct}%）。エネルギーの内訳はたんぱく質 {p}kcal、脂質 {f}kcal、炭水化物 {c}kcal": "今日餐盘：{kcal}kcal（目标 {target}kcal 的 {pct}%）。能量构成：蛋白质 {p}kcal，脂肪 {f}kcal，碳水化合物 {c}kcal",
    "今日のお皿：{kcal}kcal。エネルギーの内訳はたんぱく質 {p}kcal、脂質 {f}kcal、炭水化物 {c}kcal": "今日餐盘：{kcal}kcal。能量构成：蛋白质 {p}kcal，脂肪 {f}kcal，碳水化合物 {c}kcal",
    "あと {n} kcal": "还剩 {n} kcal",
    "{n} kcal オーバー": "超出 {n} kcal",
    "よく使う食品を表示しています。ほかの食品（成分表と市販品の全{n}品）は、上の欄で探せます。": "正在显示常用食品。其他食品（成分表和市售商品，共{n}种）请在上面的栏中搜索。",
    "よく使う食品を表示しています。ほかの食品（成分表と市販品）は、上の欄で探せます。": "正在显示常用食品。其他食品（成分表和市售商品）请在上面的栏中搜索。",
    "{n}件見つかりました。市販品のデータを読み込んでいます…": "找到 {n} 件。正在加载市售商品数据…",
    "市販品のデータを読み込んでいます…": "正在加载市售商品数据…",
    "{n}件見つかりました。市販品の一部を読み込めませんでした（通信を確かめて、もう一度探してください）。": "找到 {n} 件。部分市售商品数据未能加载（请检查网络后再搜索一次）。",
    "市販品の一部を読み込めませんでした（通信を確かめて、もう一度探してください）。": "部分市售商品数据未能加载（请检查网络后再搜索一次）。",
    "見つかりませんでした。別のことばで探すか、「自分の食品を登録する」から登録できます。": "没有找到。请换个词搜索，或在“登记自己的食品”中登记。",
    "{n}件見つかりました（先頭の{max}件を表示。ことばを足すと絞り込めます）": "找到 {n} 件（显示前 {max} 件。增加关键词可缩小范围）",
    "{n}件見つかりました": "找到 {n} 件",
    "削除": "删除",
    "100gあたり {kcal}kcal ・ P {p}g ・ F {f}g ・ C {c}g": "每100g：{kcal}kcal ・ P {p}g ・ F {f}g ・ C {c}g",
    "登録上限（{n}件）に達しました。": "已达到登记上限（{n}件）。",
    "無料版の登録上限（{n}件）に達しました。Proでは{max}件まで登録できます。": "已达到免费版的登记上限（{n}件）。Pro 最多可登记{max}件。",
    "（今日）": "（今天）",
    "直近7日の平均 {n}kg": "最近7天平均 {n}kg",
    "週あたり {n}kg（直近14日の傾き）": "每周 {n}kg（最近14天的趋势）",
    "体重を記録すると、平均と増減の傾きが出ます。": "记录体重后，会显示平均值和增减趋势。",
    "{muscle} ・ {kg}kg × {reps}回 × {sets}セット ・ 推定1RM {rm}kg": "{muscle} ・ {kg}kg × {reps}次 × {sets}组 ・ 预估1RM {rm}kg",
    "前回（{date}）{kg}kg × {reps}回 × {sets}セット": "上次（{date}）{kg}kg × {reps}次 × {sets}组",
    "★ 自己ベスト更新": "★ 刷新个人最佳",
    "{n}セット": "{n}组",
    "先に「1日の目標を設定する」の「目標の自動計算」で、性別・年齢・身長・活動レベルを入れてください。": "请先在“设定每日目标”的“自动计算目标”中，填入性别、年龄、身高和活动水平。",
    "体重 {w}kg ・ 基礎代謝 約{bmr}kcal": "体重 {w}kg ・ 基础代谢 约{bmr}kcal",
    "1日の消費（実績から逆算） 約{tdee}kcal ・ 直近{d}日の平均摂取 {avg}kcal": "每日消耗（根据实际数据反推）约{tdee}kcal ・ 最近{d}天的平均摄入 {avg}kcal",
    "1日の消費（式による推定） 約{tdee}kcal ・ 食事{md}日分と体重{mw}回分（1週間以上）がたまると、実績から計算します（今は食事{d}日・体重{w}回）": "每日消耗（按公式估算）约{tdee}kcal ・ 积累{md}天的饮食和{mw}次体重记录（跨度一周以上）后，将根据实际数据计算（目前：饮食{d}天，体重{w}次）",
    "目標 {w}kg まで あと{d}日 ・ 計画 週{n}kg（体に無理のない速さに抑えています）": "目标 {w}kg，还有{d}天 ・ 计划每周{n}kg（已控制在不勉强身体的速度）",
    "目標 {w}kg まで あと{d}日 ・ 計画 週{n}kg": "目标 {w}kg，还有{d}天 ・ 计划每周{n}kg",
    "期限を過ぎたので、今の体重を保つカロリーにしています。": "期限已过，所以热量设为维持当前体重的水平。",
    "トレ日と休養日の切り替え：毎日筋トレしているので、切り替えずに平均のカロリーにしています。": "训练日与休息日的切换：因为每天都训练，所以不切换，使用平均热量。",
    "トレ日と休養日の切り替え：目標が基礎代謝に近く、休養日を減らす余裕がないので切り替えていません。": "训练日与休息日的切换：目标接近基础代谢，没有降低休息日热量的余地，所以不切换。",
    "トレ日と休養日の切り替え：直近4週間の筋トレの記録（週1〜6日）がたまると始まります（今は週0日）。": "训练日与休息日的切换：最近4周内每周有1–6天的训练记录后开始（目前每周0天）。",
    "今日はトレ日なので、平均より多めにしています（平均 {k}kcal、週{n}日トレ）。": "今天是训练日，所以热量比平均多（平均 {k}kcal，每周训练{n}天）。",
    "今日は休養日なので、平均より少なめにしています（平均 {k}kcal、週{n}日トレ）。筋トレを記録すると、トレ日のカロリーに変わります。": "今天是休息日，所以热量比平均少（平均 {k}kcal，每周训练{n}天）。记录训练后，会变成训练日的热量。",
    "今日の目標 {kcal}kcal ・ P {p}g ・ F {f}g ・ C {c}g（基礎代謝を下回らないようにしています）": "今日目标 {kcal}kcal ・ P {p}g ・ F {f}g ・ C {c}g（已避免低于基础代谢）",
    "今日の目標 {kcal}kcal ・ P {p}g ・ F {f}g ・ C {c}g": "今日目标 {kcal}kcal ・ P {p}g ・ F {f}g ・ C {c}g",
    "目標は計画から毎日自動で決まります。手で決めたいときは「計画をやめる」を押してください。": "目标由计划每天自动设定。想手动设定时，请按“取消计划”。",
    "目標体重と期限を入れると、毎日の目標カロリーとPFCを自動で決めます。": "填入目标体重和期限后，每天的目标热量和PFC会自动设定。",
    "直近{n}日の体重のグラフ": "最近{n}天的体重图表",
    "{food} {n}g を追加": "添加 {food} {n}g",
    "昨日と同じものを追加する（{n}品）": "添加和昨天相同的食品（{n}种）",
    "{date}と同じものを追加する（{n}品）": "添加和{date}相同的食品（{n}种）",
    "{n}品 ・ {kcal}kcal（消した食品{m}品は追加されません）": "{n}种 ・ {kcal}kcal（已删除的{m}种食品不会被添加）",
    "{n}品 ・ {kcal}kcal": "{n}种 ・ {kcal}kcal",
    "追加": "添加",
    "「{name}」を今日の記録に追加しました（{n}品）。": "已将“{name}”添加到今日记录（{n}种）。",
    "「{name}」の食品はすべて消されているため、追加できませんでした。": "“{name}”中的食品已全部被删除，无法添加。",
    "セット「{name}」を消しますか？": "要删除套餐“{name}”吗？",
    "{label}（{n}点）": "{label}（{n}分）",
    "今日の記録をすべて消しますか？": "要清除今日的全部记录吗？",
    "ライセンスキーが正しくありません。コピーしたキー全体を貼り付けてください。": "许可证密钥不正确。请粘贴复制的完整密钥。",
    "コードが正しくありません。もう一度お確かめください。": "使用码不正确。请确认后再试一次。",
    "Proをやめて、無料版に戻しますか？（記録は消えませんが、日付が変わると、90日より前の食事の記録と1年より前の体重・筋トレ・スコアは消えます）\nライセンスキーも消えるので、再び使うときのためにキーを控えておいてください。": "要停用 Pro 并恢复为免费版吗？（记录会保留，但日期变更后，90天以前的饮食记录和1年以前的体重、训练、评分记录将被删除）\n许可证密钥也会被删除，请先记下密钥，以备再次使用。",
    "Proをやめて、無料版に戻しますか？（記録は消えませんが、日付が変わると、90日より前の食事の記録と1年より前の体重・筋トレ・スコアは消えます）": "要停用 Pro 并恢复为免费版吗？（记录会保留，但日期变更后，90天以前的饮食记录和1年以前的体重、训练、评分记录将被删除）",
    "入力を確認してください（年齢10〜100、身長100〜250cm、体重20〜300kg）。": "请检查输入内容（年龄10〜100，身高100〜250cm，体重20〜300kg）。",
    "プロフィールを保存しました。計画があるので、今日の目標は「からだの記録」の計画から決めています。": "已保存个人资料。因为有计划，所以今日目标由“身体记录”中的计划设定。",
    "基礎代謝 約{bmr}kcal ・ 1日の消費目安 約{tdee}kcal → 目標 {kcal}kcal（P {p}g ・ F {f}g ・ C {c}g）を設定しました。": "基础代谢 约{bmr}kcal ・ 每日消耗参考值 约{tdee}kcal → 已设定目标 {kcal}kcal（P {p}g ・ F {f}g ・ C {c}g）。",
    "セットの名前を入れてください（例：朝ごはん）。": "请输入套餐名称（例如：早餐）。",
    "今日の記録が空です。先に食品を追加してください。": "今日记录为空。请先添加食品。",
    "セットは{n}個まで登録できます。": "套餐最多可登记{n}个。",
    "「{name}」を登録しました。次からはワンタップで追加できます。（1つのセットには先頭の{n}品までが入ります）": "已登记“{name}”。以后可以一键添加。（一个套餐只包含前{n}种食品）",
    "「{name}」を登録しました。次からはワンタップで追加できます。": "已登记“{name}”。以后可以一键添加。",
    "種目名・重量（0〜1000kg）・回数・セット数（整数）を確かめてください。": "请检查项目名称、重量（0〜1000kg）、次数和组数（整数）。",
    "1日に記録できるのは{n}件までです。": "每天最多可记录{n}条。",
    "★ {name}の自己ベスト（推定1RM {rm}kg）を更新しました！": "★ {name}刷新了个人最佳（预估1RM {rm}kg）！",
    "目標体重（20〜300kg）と、明日以降の期限を入れてください。": "请输入目标体重（20〜300kg）和明天以后的期限。",
    "計画をやめますか？（今の目標値はそのまま残り、手で変えられるようになります）": "要取消计划吗？（现在的目标值会保留，并且可以手动修改。）",
    "ファイルが大きすぎます（5MBまで）。": "文件太大（最大5MB）。",
    "バックアップを読み込みますか？ この端末の今の記録は、バックアップの内容で置き換わります。": "要导入备份吗？这台设备上现有的记录将被备份的内容替换。",
    "バックアップを読み込みました。": "已导入备份。",
    "このファイルは読み込めませんでした。このアプリで書き出したバックアップを選んでください。": "无法读取此文件。请选择由本应用导出的备份。",
    "コピーしました": "已复制",
    "「{name}」を入れました。重量・回数・セットを入れて追加してください。": "已填入“{name}”。请填写重量、次数和组数后添加。",
    "この端末ではすでに購入済みのライセンスキーで Pro が有効です。": "这台设备已通过购买的许可证密钥启用了 Pro。",
    "PFCかんたん計算ツール": "PFC简易计算工具",
    "食品を選んでグラム数を入れるだけ。カロリーとPFC（たんぱく質・脂質・炭水化物）をかんたんに合計できる、無料の計算ツールです。": "选择食品、输入克数，就能轻松合计热量和PFC（蛋白质·脂肪·碳水化合物）。免费的计算工具。",
    "自分の食品": "自己的食品",
    "市販品": "市售商品",
    "主食": "主食",
    "肉": "肉类",
    "魚": "鱼类",
    "卵・大豆": "蛋·大豆",
    "乳製品": "乳制品",
    "野菜": "蔬菜",
    "果物": "水果",
    "穀類": "谷类",
    "いも及びでん粉類": "薯类及淀粉类",
    "砂糖及び甘味類": "糖类及甜味料",
    "豆類": "豆类",
    "種実類": "坚果种子类",
    "野菜類": "蔬菜（成分表）",
    "果実類": "水果（成分表）",
    "きのこ類": "菌菇类",
    "藻類": "藻类",
    "魚介類": "鱼贝类（成分表）",
    "肉類": "肉类（成分表）",
    "卵類": "蛋类（成分表）",
    "乳類": "乳类（成分表）",
    "油脂類": "油脂类",
    "菓子類": "点心类",
    "し好飲料類": "嗜好饮料类",
    "調味料及び香辛料類": "调味料及香辛料类",
    "調理済み流通食品類": "成品加工食品类",
    "食事を記録した": "记录了饮食",
    "食事": "饮食",
    "カロリーが目標の±10%以内": "热量在目标的±10%以内",
    "たんぱく質が目標の90%以上": "蛋白质达到目标的90%以上",
    "たんぱく質90%": "蛋白质90%",
    "体重を記録した": "记录了体重",
    "体重": "体重",
    "筋トレを記録した": "记录了训练",
    "筋トレ": "训练"
  }
  };

  // よく使う食品（id）の名前：[English, 中文]。ほかの食品は日本語の名前のまま。
  var FOOD_NAMES = {
    "rice": [
      "Rice (white, cooked)",
      "米饭（白米·煮熟）"
    ],
    "brown-rice": [
      "Brown rice (cooked)",
      "糙米饭"
    ],
    "mochi": [
      "Mochi (rice cake)",
      "年糕"
    ],
    "bread": [
      "White bread (sliced)",
      "吐司面包"
    ],
    "roll": [
      "Bread roll",
      "小餐包"
    ],
    "bagel": [
      "Bagel",
      "贝果"
    ],
    "oatmeal": [
      "Oatmeal (dry)",
      "燕麦片（干）"
    ],
    "cornflakes": [
      "Cornflakes",
      "玉米片"
    ],
    "udon": [
      "Udon noodles (boiled)",
      "乌冬面（煮）"
    ],
    "soba": [
      "Soba noodles (boiled)",
      "荞麦面（煮）"
    ],
    "somen": [
      "Somen / hiyamugi noodles (boiled)",
      "素面·冷面（煮）"
    ],
    "ramen-noodle": [
      "Ramen noodles (boiled)",
      "拉面（煮）"
    ],
    "pasta": [
      "Pasta (boiled)",
      "意大利面（煮）"
    ],
    "potato": [
      "Potato (peeled, raw)",
      "土豆（去皮·生）"
    ],
    "sweet-potato": [
      "Sweet potato (peeled, raw)",
      "红薯（去皮·生）"
    ],
    "chicken-breast": [
      "Chicken breast (skinless, raw)",
      "鸡胸肉（去皮·生）"
    ],
    "chicken-breast-skin": [
      "Chicken breast (with skin, raw)",
      "鸡胸肉（带皮·生）"
    ],
    "chicken-sasami": [
      "Chicken tenderloin (raw)",
      "鸡里脊（生）"
    ],
    "chicken-thigh": [
      "Chicken thigh (skinless, raw)",
      "鸡腿肉（去皮·生）"
    ],
    "chicken-thigh-skin": [
      "Chicken thigh (with skin, raw)",
      "鸡腿肉（带皮·生）"
    ],
    "chicken-wing": [
      "Chicken wing drumette (with skin, raw)",
      "鸡翅根（带皮·生）"
    ],
    "chicken-minced": [
      "Ground chicken (raw)",
      "鸡肉末（生）"
    ],
    "chicken-liver": [
      "Chicken liver (raw)",
      "鸡肝（生）"
    ],
    "pork-fillet": [
      "Pork tenderloin (lean, raw)",
      "猪里脊（瘦肉·生）"
    ],
    "pork-loin": [
      "Pork loin (with fat, raw)",
      "猪大排（带肥肉·生）"
    ],
    "pork-round": [
      "Pork leg (no subcutaneous fat, raw)",
      "猪后腿肉（去皮下脂肪·生）"
    ],
    "pork-belly": [
      "Pork belly (raw)",
      "五花肉（生）"
    ],
    "pork-minced": [
      "Ground pork (raw)",
      "猪肉末（生）"
    ],
    "beef-round": [
      "Beef round (Japanese beef, no subcutaneous fat, raw)",
      "牛后腿肉（日本产牛·去皮下脂肪·生）"
    ],
    "beef-round-import": [
      "Beef round (imported beef, no subcutaneous fat, raw)",
      "牛后腿肉（进口牛·去皮下脂肪·生）"
    ],
    "beef-belly": [
      "Beef short plate (Japanese beef, raw)",
      "牛腩（日本产牛·生）"
    ],
    "beef-minced": [
      "Ground beef (raw)",
      "牛肉末（生）"
    ],
    "ham": [
      "Loin ham",
      "里脊火腿"
    ],
    "bacon": [
      "Bacon (belly)",
      "培根（五花）"
    ],
    "sausage": [
      "Wiener sausage",
      "维也纳香肠"
    ],
    "salmon": [
      "Salmon (chum salmon, raw)",
      "三文鱼（大马哈鱼·生）"
    ],
    "mackerel": [
      "Mackerel (chub mackerel, raw)",
      "青花鱼（鲭鱼·生）"
    ],
    "tuna": [
      "Tuna (bluefin, wild, lean, raw)",
      "金枪鱼（黑鲔·野生·红肉·生）"
    ],
    "tuna-can": [
      "Canned tuna (in water, light)",
      "金枪鱼罐头（水浸·淡肉）"
    ],
    "tuna-can-oil": [
      "Canned tuna (in oil, light)",
      "金枪鱼罐头（油浸·淡肉）"
    ],
    "aji": [
      "Horse mackerel (with skin, raw)",
      "竹荚鱼（带皮·生）"
    ],
    "sardine": [
      "Sardine (Japanese pilchard, raw)",
      "沙丁鱼（日本鳀·生）"
    ],
    "sanma": [
      "Pacific saury (with skin, raw)",
      "秋刀鱼（带皮·生）"
    ],
    "buri": [
      "Yellowtail (adult, raw)",
      "鰤鱼（成鱼·生）"
    ],
    "cod": [
      "Cod (Pacific cod, raw)",
      "鳕鱼（太平洋鳕·生）"
    ],
    "shrimp": [
      "Shrimp (black tiger, raw)",
      "虾（斑节对虾·生）"
    ],
    "squid": [
      "Squid (Japanese flying squid, raw)",
      "鱿鱼（日本鱿鱼·生）"
    ],
    "octopus": [
      "Octopus (common octopus, boiled)",
      "章鱼（真蛸·煮）"
    ],
    "asari": [
      "Clams (Manila clam, raw)",
      "蛤蜊（花蛤·生）"
    ],
    "scallop": [
      "Scallop adductor (raw)",
      "扇贝柱（生）"
    ],
    "egg": [
      "Egg (chicken, whole, raw)",
      "鸡蛋（全蛋·生）"
    ],
    "egg-boiled": [
      "Boiled egg (whole)",
      "水煮蛋（全蛋）"
    ],
    "egg-white": [
      "Egg white (raw)",
      "蛋白（生）"
    ],
    "natto": [
      "Natto (fermented soybeans)",
      "纳豆"
    ],
    "tofu": [
      "Firm tofu (momen)",
      "老豆腐"
    ],
    "tofu-silken": [
      "Silken tofu",
      "嫩豆腐"
    ],
    "atsuage": [
      "Thick fried tofu (atsuage)",
      "厚油豆腐"
    ],
    "aburaage": [
      "Thin fried tofu (aburaage, raw)",
      "油豆腐皮（生）"
    ],
    "soy-milk": [
      "Soy milk (unadjusted)",
      "豆浆（原味）"
    ],
    "soy-milk-adjusted": [
      "Soy milk (adjusted)",
      "调制豆乳"
    ],
    "edamame": [
      "Edamame (boiled)",
      "毛豆（煮）"
    ],
    "milk": [
      "Milk (regular)",
      "牛奶（全脂）"
    ],
    "milk-lowfat": [
      "Low-fat milk",
      "低脂牛奶"
    ],
    "yogurt": [
      "Yogurt (whole milk, unsweetened)",
      "酸奶（全脂无糖）"
    ],
    "yogurt-nonfat": [
      "Yogurt (nonfat, unsweetened)",
      "酸奶（无脂无糖）"
    ],
    "yogurt-sweet": [
      "Yogurt (skim, sweetened)",
      "酸奶（脱脂加糖）"
    ],
    "cottage-cheese": [
      "Cottage cheese",
      "茅屋奶酪"
    ],
    "process-cheese": [
      "Processed cheese",
      "再制奶酪"
    ],
    "mozzarella": [
      "Mozzarella cheese",
      "马苏里拉奶酪"
    ],
    "broccoli": [
      "Broccoli (raw)",
      "西兰花（生）"
    ],
    "broccoli-boiled": [
      "Broccoli (boiled)",
      "西兰花（煮）"
    ],
    "spinach": [
      "Spinach (raw)",
      "菠菜（生）"
    ],
    "cabbage": [
      "Cabbage (raw)",
      "卷心菜（生）"
    ],
    "tomato": [
      "Tomato (raw)",
      "番茄（生）"
    ],
    "mini-tomato": [
      "Cherry tomato (raw)",
      "圣女果（生）"
    ],
    "carrot": [
      "Carrot (peeled, raw)",
      "胡萝卜（去皮·生）"
    ],
    "onion": [
      "Onion (raw)",
      "洋葱（生）"
    ],
    "lettuce": [
      "Lettuce (raw)",
      "生菜（生）"
    ],
    "cucumber": [
      "Cucumber (raw)",
      "黄瓜（生）"
    ],
    "moyashi": [
      "Mung bean sprouts (raw)",
      "绿豆芽（生）"
    ],
    "green-pepper": [
      "Green bell pepper (raw)",
      "青椒（生）"
    ],
    "eggplant": [
      "Eggplant (raw)",
      "茄子（生）"
    ],
    "pumpkin": [
      "Kabocha squash (Western, raw)",
      "南瓜（西洋南瓜·生）"
    ],
    "shimeji": [
      "Shimeji mushrooms (bunashimeji, raw)",
      "蟹味菇（生）"
    ],
    "enoki": [
      "Enoki mushrooms (raw)",
      "金针菇（生）"
    ],
    "maitake": [
      "Maitake mushrooms (raw)",
      "舞茸（生）"
    ],
    "wakame": [
      "Wakame seaweed (dried, rehydrated)",
      "裙带菜（干·泡发）"
    ],
    "banana": [
      "Banana",
      "香蕉"
    ],
    "apple": [
      "Apple (peeled)",
      "苹果（去皮）"
    ],
    "mikan": [
      "Mandarin orange (satsuma)",
      "橘子（温州蜜柑）"
    ],
    "kiwi": [
      "Kiwifruit (green flesh)",
      "猕猴桃（绿肉）"
    ],
    "strawberry": [
      "Strawberry",
      "草莓"
    ],
    "grape": [
      "Grapes (peeled)",
      "葡萄（去皮）"
    ],
    "grapefruit": [
      "Grapefruit (white flesh)",
      "葡萄柚（白肉）"
    ],
    "blueberry": [
      "Blueberries",
      "蓝莓"
    ],
    "avocado": [
      "Avocado",
      "牛油果"
    ],
    "almond": [
      "Almonds (roasted, unsalted)",
      "杏仁（烤·无盐）"
    ],
    "walnut": [
      "Walnuts (roasted)",
      "核桃（烤）"
    ],
    "peanut": [
      "Peanuts (roasted)",
      "花生（烤）"
    ],
    "olive-oil": [
      "Olive oil",
      "橄榄油"
    ],
    "butter": [
      "Butter (salted)",
      "黄油（含盐）"
    ],
    "mayonnaise": [
      "Mayonnaise (whole-egg type)",
      "蛋黄酱（全蛋型）"
    ],
    "honey": [
      "Honey",
      "蜂蜜"
    ],
    "sugar": [
      "Sugar (white granulated)",
      "白砂糖"
    ],
    "chocolate": [
      "Milk chocolate",
      "牛奶巧克力"
    ],
    "protein": [
      "Protein powder (whey, approx.)",
      "蛋白粉（乳清·参考值）"
    ]
  };

  function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

  function detectLang() {
    try {
      var saved = localStorage.getItem(LANG_KEY);
      if (LANGS.indexOf(saved) !== -1) return saved;
    } catch (e) { /* 読めなくても続ける */ }
    var list = (typeof navigator !== "undefined" && (navigator.languages || [navigator.language])) || [];
    for (var i = 0; i < list.length; i++) {
      var l = String(list[i] || "").toLowerCase();
      if (l.indexOf("ja") === 0) return "ja";
      if (l.indexOf("en") === 0) return "en";
      if (l.indexOf("zh") === 0) return "zh";
    }
    return "ja";
  }

  var api = { lang: detectLang(), _dict: DICT, _foodNames: FOOD_NAMES };
  var listeners = [];

  function fill(s, vars) {
    return String(s).replace(/\{(\w+)\}/g, function (m, k) {
      return vars && has(vars, k) ? String(vars[k]) : m;
    });
  }

  api.t = function (ja, vars) {
    var s = ja;
    if (api.lang !== "ja" && has(DICT[api.lang], ja)) s = DICT[api.lang][ja];
    return fill(s, vars);
  };

  // 食品名の表示用。訳が無い食品（成分表・市販品・自分の食品）は元の名前のまま。
  api.foodName = function (food) {
    if (api.lang !== "ja" && has(FOOD_NAMES, food.id)) return FOOD_NAMES[food.id][api.lang === "en" ? 0 : 1];
    return food.name;
  };

  // 検索用：English と中文の名前（無ければ空）。
  api.foodNames = function (food) {
    return has(FOOD_NAMES, food.id) ? FOOD_NAMES[food.id] : [];
  };

  api.onChange = function (fn) { listeners.push(fn); };

  // ---------- 画面にもとからある文字の書き換え ----------
  var textRec = typeof WeakMap !== "undefined" ? new WeakMap() : null; // テキスト → { orig, applied }
  var attrRec = typeof WeakMap !== "undefined" ? new WeakMap() : null; // 要素 → { 属性名: { orig, applied } }
  var ATTRS = ["placeholder", "aria-label", "title", "label"];

  // 前後の空白は残して、中身だけ訳す。戻す日本語が必要なので、元の文字は覚えておく。
  function convert(orig) {
    var key = orig.trim();
    if (!key || api.lang === "ja" || !has(DICT[api.lang], key)) return null;
    return orig.match(/^\s*/)[0] + DICT[api.lang][key] + orig.match(/\s*$/)[0];
  }

  function translateText(node) {
    var rec = textRec.get(node);
    var cur = node.nodeValue;
    if (rec && cur !== rec.applied) { textRec.delete(node); rec = null; } // アプリが書き換えた
    if (api.lang === "ja") {
      if (rec) { node.nodeValue = rec.orig; textRec.delete(node); }
      return;
    }
    var orig = rec ? rec.orig : cur;
    var next = convert(orig);
    if (next === null) return;
    node.nodeValue = next;
    textRec.set(node, { orig: orig, applied: next });
  }

  function translateAttrs(el) {
    var recs = attrRec.get(el) || {};
    ATTRS.forEach(function (name) {
      var cur = el.getAttribute(name);
      if (cur === null) return;
      var rec = recs[name];
      if (rec && cur !== rec.applied) { delete recs[name]; rec = null; }
      if (api.lang === "ja") {
        if (rec) { el.setAttribute(name, rec.orig); delete recs[name]; }
        return;
      }
      var orig = rec ? rec.orig : cur;
      var next = convert(orig);
      if (next === null) return;
      el.setAttribute(name, next);
      recs[name] = { orig: orig, applied: next };
    });
    attrRec.set(el, recs);
  }

  function walk(node) {
    var kids = node.childNodes;
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      if (c.nodeType === 3) {
        translateText(c);
      } else if (c.nodeType === 1) {
        if (c.tagName === "SCRIPT" || c.tagName === "STYLE") continue;
        if (c.getAttribute("translate") === "no") continue; // 言語の切り替えボタンなど
        translateAttrs(c);
        walk(c);
      }
    }
  }

  api.translateStatic = function () {
    if (!textRec || typeof document === "undefined" || !document.body || !document.body.childNodes) return;
    walk(document.body);
  };

  // <title> と meta description も訳す（日本語の元の文字は最初に覚えておく）。
  var headOrig = { title: null, desc: null };
  function translateHead() {
    if (typeof document === "undefined") return;
    if (typeof document.title === "string") {
      if (headOrig.title === null) headOrig.title = document.title;
      document.title = api.t(headOrig.title);
    }
    var meta = document.querySelector && document.querySelector('meta[name="description"]');
    if (meta) {
      if (headOrig.desc === null) headOrig.desc = meta.getAttribute("content");
      meta.setAttribute("content", api.t(headOrig.desc));
    }
  }

  // ---------- 切り替えボタン ----------
  function updateButtons() {
    if (typeof document === "undefined" || !document.querySelectorAll) return;
    Array.prototype.forEach.call(document.querySelectorAll(".lang-switch [data-lang]"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-lang") === api.lang ? "true" : "false");
    });
  }

  function applyDocument() {
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.lang = HTML_LANG[api.lang];
    }
    translateHead();
    api.translateStatic();
    updateButtons();
  }

  api.setLang = function (code) {
    if (LANGS.indexOf(code) === -1) return;
    api.lang = code;
    try { localStorage.setItem(LANG_KEY, code); } catch (e) { /* 覚えられなくても切り替える */ }
    applyDocument();
    listeners.forEach(function (fn) { fn(code); });
  };

  window.PFC_I18N = api;

  if (typeof document !== "undefined" && document.querySelectorAll) {
    Array.prototype.forEach.call(document.querySelectorAll(".lang-switch [data-lang]"), function (b) {
      b.addEventListener("click", function () { api.setLang(b.getAttribute("data-lang")); });
    });
  }
  applyDocument();
})();
