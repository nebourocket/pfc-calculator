English | [日本語](README.ja.md)

<div align="center">

# PFC Calculator

**Pick a food, enter the grams. That's it.**<br>
See today's calories and PFC (protein, fat, carbs) at a glance.

[**▶ Use it now (free, no sign-up)**](https://nebourocket.github.io/pfc-calculator/)

https://nebourocket.github.io/pfc-calculator/

![Free](https://img.shields.io/badge/core%20features-free-5a7d4a)
![No sign-up](https://img.shields.io/badge/account-not%20needed-5a7d4a)
![On-device](https://img.shields.io/badge/records-stay%20on%20your%20device-2b2620)
![Pro](https://img.shields.io/badge/Pro-one--time%20JPY%20500-c9a227)
![No dependencies](https://img.shields.io/badge/dependencies-zero-2b2620)

</div>

---

PFC Calculator is a free web app for tracking calories and PFC. There is nothing to install and no account to create, and it keeps working offline. Your records stay in your browser and are never sent anywhere. The interface is available in Japanese, English and Chinese. The food database comes from Japan's MEXT Standard Tables of Food Composition (2,500+ foods) and Open Food Facts.

Whether you are cutting, maintaining or bulking, just open the page and use it.

## ✨ Features

- **Ready in 30 seconds** — pick a food, enter an amount and press "Add". Today's total appears right away.
- **See the gap to your goal at a glance** — set a daily target and progress bars fill up for calories and each of P, F and C.
- **29,283 packaged products** — convenience-store and supermarket items from Open Food Facts open data. The 5,000 most popular load at startup and the rest load when you search, so startup stays light.
- **The full official food composition table** — all **2,500+ foods** from MEXT's "Standard Tables of Food Composition in Japan (8th revision), 2023 Supplement". You can search in hiragana or katakana, or with everyday words such as "gohan" (rice) or "tori-mune" (chicken breast).
- **Records never leave your device** — they are stored only in the browser's localStorage. The app has no way to send records to a server.
- **Light and fast** — just HTML, CSS and JavaScript. No external libraries, ads or analytics tags.
- **Easy to read** — it looks like a meal notebook written in navy ink on graph paper. Today's total is drawn as a "plate": the outer ring shows calories toward your target, and the inner part shows the energy ratio of protein (red), fat (blue) and carbs (yellow). Next to it is a "Nutrition Facts" panel shaped like the one on food packaging. A 1-month (30-day) chart uses the same colors for the breakdown. On phones there are tabs at the bottom, on desktops a two-column layout, and dark mode is supported.
- **Weight and workouts, free** — log daily weight (7-day average, weekly change, 30-day chart) and workouts (exercise, weight, reps, sets, with a comparison to last time and a notice when you set a new estimated 1RM personal best).
- **Find an exercise and log it in one tap** — "Find an exercise" in the workout section opens [Exercise Search](https://nebourocket.github.io/exercise-search/) (870+ exercises, searchable in Japanese too). Press "Log in PFC Calculator" on an exercise and you return to this app with the exercise name and muscle group filled in (`?exercise=…&muscle=…`; the values are removed from the URL immediately).
- **Makes you want to keep going** — "Today's stamps" on the Today screen puts a red circle on what you have done (meals, calories within ±10%, protein at 90%, weight, workout) and shows the next step in one line (for example, "19 g more protein (about 80 g of chicken breast)"). The first time you hit your goal each day, a "well done" stamp is pressed, and the app also announces your meal-logging streak and new personal bests. The "Weekly review" on the Records tab shows the last 7 days as a stamp card (◎ = within target, ○ = logged) and compares days logged, days within target, and average calories and protein with the week before.
- **Fast input** — add "recently eaten" foods in one tap. If you ate the same things as the day before, one button adds them all.
- **日本語 / English / 中文** — switch with the button at the top right (it starts with your browser's language). 106 common foods can also be searched by their English and Chinese names.
- **Works like an app** — use "Add to Home Screen" in your phone's browser to open it like an app. It works without a connection.

## 🚀 How to use

The Today tab shows a four-step guide (set your goal → log what you ate → check the plate → look back). Finished steps get a red circle, the next step is highlighted, and tapping a step takes you to the right place. Hide it with "Hide" and bring it back with the "How to use" button at the top.

1. Pick a food, enter the amount (g) and press "Add".
2. Today's total is shown for calories, protein, fat and carbs.
3. Enter your daily targets to compare with progress bars.
4. For foods not on the list, use "Register your own food" and enter the values per 100 g (the free version allows 5).

When the date changes, the previous day's totals move to "Past records" (the last 7 days are shown) and today starts empty. The free version keeps meal records for the last 90 days and weight, workout and score records for the last year. Pro keeps records with no time limit.

## 💎 Pro (one-time JPY 500)

The basic calculation, comparison with your goals and the simple history are free forever. Pro adds extra conveniences.

- 📈 **30-day chart** — look back at your calorie trend with a target line
- 🧮 **Automatic targets** — set target calories and PFC from your sex, age, height, weight, activity level and goal
- 🍱 **Up to 200 of your own foods** — up from 5 in the free version
- 🍙 **Favorite combinations** — save your usual breakfast as a set and add it in one tap
- 📄 **CSV export** — save today's records and history (with weight) in a format Excel opens directly (UTF-8 with BOM)
- 💪 **Weekly sets per muscle group** — the number of sets in the last 7 days for chest, back, legs and so on
- 🎯 **Your personal calorie needs** — enter a target weight and deadline, and the app works backward from **what you actually ate and how your weight changed** to estimate your energy expenditure, then sets your daily calorie and PFC targets automatically
- 🔥 **Daily score and streak** — earn points for meals, hitting goals, weight and workouts, and watch your streak and personal best grow
- 🗂️ **Records kept with no time limit** — meals, weight, workouts and scores are never deleted for being old (the free version keeps 90 days of meals and 1 year of everything else)

**Buy once, use forever.** There is no monthly fee.

### How to buy

1. Press "Buy Pro for JPY 500" near the bottom of the app.
2. Pay with your card on a screen run by the payment service **Stripe**.
3. You are returned to the app automatically and Pro turns on right away. Your **license key** (a string starting with `PFC1.`) is shown on screen.

To use Pro on another phone or computer, paste the license key into the "License key / access code" field. Keep the key somewhere safe (if you clear the browser's data, the key disappears from that device too).

Access codes from the note membership "[寝坊ロケットの創作室](https://note.com/nebourocket/membership)" benefits still work as before.

## 🎯 Your personal calorie needs (Pro)

Ordinary calculators estimate the calories of an "average person" from height, weight and age. But metabolism and daily activity differ a lot between people, even with the same build.

This app works backward from **your own records**.

- If your average intake over the last 14 days is 2,000 kcal and your weight is dropping 0.35 kg per week, your expenditure is 2,000 + 0.35 ÷ 7 × 7,700 ≈ **2,385 kcal/day**.
- From there it decides how many kg per week you need to lose (or gain) to reach your target weight by your deadline, and calculates your daily target calories.
- Days below half of your basal metabolic rate are treated as forgotten logging and left out of the calculation.
- Until you have 7 days of meals and 4 weigh-ins (over at least a week), it uses basal metabolic rate (Mifflin-St Jeor equation) × activity level instead.
- To keep things safe for your body, weight loss is capped at 1% of body weight per week and gain at 0.5% per week, and target calories never go below your basal metabolic rate.

The more you log, the better the numbers fit you.

You can also **vary targets between training days and rest days**. When it is on, days with a logged workout get up to 10% more than average and rest days get correspondingly less, so the weekly average stays on plan (training days per week are counted from the last 4 weeks of records). If a rest day would fall below your basal metabolic rate, the difference is made smaller. Calories burned in exercise are already included in the expenditure worked out from your records, so they are not counted twice. All the adjustment is made with carbs; protein and fat stay the same.

## 🔥 Score and streak (Pro)

A 100-point daily score makes your day-to-day effort visible.

- Logged meals (20 points)
- Calories within ±10% of target (30 points)
- Protein at 90% of target or more (20 points)
- Logged weight (15 points)
- Logged a workout (15 points)

Your streak grows while you keep scoring 50 or more. Your best streak and your total points so far are shown too. You are only competing with yesterday's you, so everything stays on your device.

## 💾 Backup (free)

Your records exist only in your browser, so use "Export backup" to save them as a JSON file. When you change phones, choose "Import backup" on the new device and your records, goals and license key all come back together. Pro turns on only when the license key's signature checks out, and importing an old backup that has no key will not remove Pro on the current device (if you had Pro through a note membership access code, enter the code again on the new device).

## 🔒 Security and privacy

Since money is involved, here is exactly what is handled where.

**Card details never reach this app or its author.**

- Card numbers are entered only on the payment page run by Stripe (`buy.stripe.com`). There is no card field in this app.
- Stripe is certified at the strictest level of the payment card industry standard (PCI DSS Level 1).
- To confirm a payment, only Stripe's checkout number (Checkout Session ID), whether it was paid and the amount are used. Names, email addresses and card numbers are neither received nor stored.

**Your records never leave your device.**

- Meal, weight and workout records, goals and your profile are stored only in the browser's localStorage.
- The app communicates with the outside only once, right after you buy Pro, to receive the license key.

**Protection against tampering and impersonation**

- License keys carry a digital signature (ECDSA P-256). The private signing key exists only inside the license server, so keys cannot be forged.
- The license server issues a key only after checking with Stripe that the payment is complete, in Japanese yen, JPY 500, and made through this product's payment link.
- The site sets a Content Security Policy so that no scripts other than this site's own files can load. No external libraries or analytics tags are used.
- The Stripe secret key is a "restricted key" limited to read-only permissions, stored only as an encrypted Cloudflare secret. It is not in this repository.

Because the app runs on your device, anyone can bring up the Pro screens by editing the code in the browser's developer tools. What is being protected here is "customers' money and card details", which is not affected by this. If you like the app, please support it by buying Pro.

If you find a vulnerability, please report it privately through the [GitHub Security tab](https://github.com/nebourocket/pfc-calculator/security) rather than a public Issue.

## 🏗️ How it works

To run without server costs, everything uses free tiers.

- **App** — GitHub Pages (static site). Just HTML, CSS and JavaScript, with no build step.
- **Payments** — Stripe Payment Link. Stripe provides the payment page, and card details are handled only there.
- **License issuing** — Cloudflare Workers ([`worker/`](worker/)). A single small function, with no database.
- **Key verification** — the app checks the signature with a public key. Once Pro is on, it works offline.

The purchase flow is as follows.

1. The app's buy button takes you to Stripe's payment page.
2. After payment, Stripe sends you back to the app with `?session_id=cs_...` added.
3. The app removes that number from the URL, then passes it to the license Worker.
4. The Worker asks Stripe for the payment status and, if paid, returns a signed key.
5. The app verifies the signature and turns on Pro.

Details of publishing and operation are in [`docs/DEPLOY.md`](docs/DEPLOY.md).

## 🥗 About the food data

Source: Created by processing the "[Standard Tables of Food Composition in Japan (8th revision), 2023 Supplement](https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html)" (Ministry of Education, Culture, Sports, Science and Technology, Japan; MEXT)

The data is generated automatically from the tables' Excel file (with the errata of March 27, Reiwa 8 applied) by `tools/build_foods.py`. Nothing is typed in by hand, so there are no copying mistakes. All foods that have calories, protein, fat and carbohydrate (2,537 foods) are included, and each keeps its food number and official name from the tables. 106 commonly used foods are given easy-to-read names and listed first. Use of the tables follows the [MEXT website terms of use](https://www.mext.go.jp/b_menu/1351168.htm) (commercial use allowed; credit the source and state that the data was processed).

- Fields used: energy (kcal), protein, fat and carbohydrate (per 100 g)

### Packaged products (Open Food Facts)

The **29,283 packaged products** sold in convenience stores and supermarkets come from [Open Food Facts](https://world.openfoodfacts.org/).

Contains data from Open Food Facts, available under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Individual contents are under the [Database Contents License (DbCL) 1.0](https://opendatacommons.org/licenses/dbcl/1-0/).

- The data is extracted from the official data file with `tools/build_off_foods.py` (the API is not called in bulk).
- Extraction conditions: sold in Japan, has a Japanese product name, has all four per-100 g values, and calories are within 25% of P×4 + F×9 + C×4. The 29,283 products left after removing duplicates are sorted by scan count. The top 5,000 go into `off-foods.js` (loaded at startup) and the remaining 24,283 into `off-foods-more.js` (loaded only when you search).
- The extracted `off-foods.js` and `off-foods-more.js` are published under the ODbL (you may use them freely, but if you do, you must publish them under the same ODbL). They are separate files from the food composition data (`foods.js`) and the app's code, and the ODbL applies only to these two files.
- Because anyone can edit this data, it may contain errors (for example, a per-package value entered as a per-100 g value). If in doubt, check the nutrition label on the package.
- Values vary with cooking method and brand.
- Protein powder is not in the tables and varies a lot by product, so it is a typical whey protein estimate.

## 🧮 Assumptions for automatic calculation (Pro)

- Basal metabolic rate (BMR) uses the Mifflin-St Jeor equation: men = 10 × weight (kg) + 6.25 × height (cm) − 5 × age + 5; women = the same formula − 161.
- Daily energy expenditure (TDEE) = BMR × activity level (1.2 / 1.375 / 1.55 / 1.725).
- Target calories: cutting = TDEE −20% (but never below BMR), maintaining = TDEE, bulking = TDEE +10%.
- PFC guideline: protein = body weight × 2 g, fat = 25% of target calories, carbs = the rest.

These are general guidelines only, not medical or nutrition advice. If you have health concerns, please consult a professional.

## 🛠️ Development

There are no dependencies. You can run the tests with Node.js 20 or later.

```bash
node tests/smoke.test.js          # アプリ本体（簡易DOMで主要フロー・Pro・購入の流れを検証）
node worker/test/license.test.mjs # ライセンス発行 Worker（Stripe への通信はフェイク）
```

What each file does:

- `index.html` / `styles.css` / `app.js` / `foods.js` — the app itself
- `i18n.js` — the display-language dictionary (Japanese, English, Chinese) and switching
- `manifest.webmanifest` / `sw.js` / `icons/` — settings for adding to the home screen, offline support and icons (the icons were drawn with Python)
- `tools/build_foods.py` — script that builds `foods.js` from the food composition tables' Excel file (`python3 -I tools/build_foods.py <Excel> foods.js`)
- `tools/build_off_foods.py` / `off-foods.js` / `off-foods-more.js` — the script that extracts packaged products from the Open Food Facts data file, and its output (ODbL)
- `fonts/` / `tools/build_font_subset.py` — the handwriting-style font [Klee One](https://github.com/fontworks-fonts/Klee) (Fontworks, SIL Open Font License 1.1, `fonts/KleeOne-OFL.txt`) used for headings, large numbers and stamps, reduced to only the characters used (about 40 KB). Rebuild it when you change the characters in headings and similar text
- `config.js` — settings that are safe to publish (Payment Link URL, Worker URL, public key)
- `legal.html` — disclosure based on Japan's Specified Commercial Transactions Act
- `worker/` — the license-issuing Worker (Cloudflare Workers)
- `docs/DEPLOY.md` — publishing and operation steps

## 📮 About the author

**Nebou Rocket** (寝坊ロケット, nebourocket) — I write behind-the-scenes development stories and usage tips on [note](https://note.com/nebourocket).

- Disclosure under Japan's Specified Commercial Transactions Act: [legal.html](https://nebourocket.github.io/pfc-calculator/legal.html)
