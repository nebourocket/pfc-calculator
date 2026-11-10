// 食品データ（100gあたり）
// 出典：日本食品標準成分表（八訂）をもとにした概算値。調理方法・銘柄により前後します。
// プロテインは製品により大きく異なるため、代表的なホエイプロテインの目安値です。
window.FOODS = [
  // 主食
  { id: "rice",        name: "ごはん（精白米・炊いたもの）", category: "主食", kcal: 168, p: 2.5,  f: 0.3,  c: 37.1 },
  { id: "brown-rice",  name: "玄米ごはん",                   category: "主食", kcal: 165, p: 2.8,  f: 1.0,  c: 34.2 },
  { id: "bread",       name: "食パン",                       category: "主食", kcal: 248, p: 9.3,  f: 4.4,  c: 42.2 },
  { id: "oatmeal",     name: "オートミール（乾燥）",         category: "主食", kcal: 379, p: 13.7, f: 5.7,  c: 69.3 },
  { id: "udon",        name: "うどん（ゆで）",               category: "主食", kcal: 105, p: 2.6,  f: 0.4,  c: 21.6 },
  { id: "soba",        name: "そば（ゆで）",                 category: "主食", kcal: 114, p: 4.8,  f: 0.7,  c: 22.4 },
  { id: "pasta",       name: "パスタ（ゆで）",               category: "主食", kcal: 149, p: 5.6,  f: 0.9,  c: 28.5 },
  { id: "potato",      name: "じゃがいも（生）",             category: "主食", kcal: 76,  p: 1.6,  f: 0.1,  c: 17.6 },
  { id: "sweet-potato",name: "さつまいも（生）",             category: "主食", kcal: 127, p: 1.2,  f: 0.2,  c: 30.3 },
  // 肉
  { id: "chicken-breast", name: "鶏むね肉（皮なし・生）",    category: "肉",   kcal: 108, p: 22.3, f: 1.5,  c: 0 },
  { id: "chicken-sasami", name: "ささみ（生）",              category: "肉",   kcal: 105, p: 23.0, f: 0.8,  c: 0 },
  { id: "chicken-thigh",  name: "鶏もも肉（皮なし・生）",    category: "肉",   kcal: 127, p: 18.8, f: 5.0,  c: 0 },
  { id: "pork-fillet",    name: "豚ヒレ肉（生）",            category: "肉",   kcal: 115, p: 22.5, f: 1.9,  c: 0.1 },
  { id: "pork-loin",      name: "豚ロース肉（生）",          category: "肉",   kcal: 263, p: 19.3, f: 19.2, c: 0.1 },
  { id: "beef-round",     name: "牛もも肉（生）",            category: "肉",   kcal: 182, p: 20.7, f: 10.2, c: 0.2 },
  // 魚
  { id: "salmon",      name: "鮭（生）",                     category: "魚",   kcal: 133, p: 22.3, f: 5.1,  c: 0.1 },
  { id: "mackerel",    name: "さば（生）",                   category: "魚",   kcal: 247, p: 20.7, f: 17.8, c: 0.3 },
  { id: "tuna",        name: "まぐろ（赤身・生）",           category: "魚",   kcal: 125, p: 26.4, f: 1.4,  c: 0.2 },
  { id: "tuna-can",    name: "ツナ缶（水煮）",               category: "魚",   kcal: 71,  p: 16.0, f: 0.7,  c: 0.1 },
  // 卵・大豆
  { id: "egg",         name: "卵（鶏卵・全卵・生）",         category: "卵・大豆", kcal: 151, p: 12.3, f: 10.3, c: 0.3 },
  { id: "natto",       name: "納豆",                         category: "卵・大豆", kcal: 200, p: 16.5, f: 10.0, c: 12.1 },
  { id: "tofu",        name: "木綿豆腐",                     category: "卵・大豆", kcal: 72,  p: 6.6,  f: 4.2,  c: 1.6 },
  // 乳製品
  { id: "milk",        name: "牛乳（普通）",                 category: "乳製品", kcal: 67,  p: 3.3,  f: 3.8,  c: 4.8 },
  { id: "yogurt",      name: "ヨーグルト（無糖）",           category: "乳製品", kcal: 62,  p: 3.6,  f: 3.0,  c: 4.9 },
  // 果物・野菜
  { id: "banana",      name: "バナナ",                       category: "果物・野菜", kcal: 86,  p: 1.1,  f: 0.2,  c: 22.5 },
  { id: "apple",       name: "りんご",                       category: "果物・野菜", kcal: 54,  p: 0.2,  f: 0.1,  c: 14.6 },
  { id: "broccoli",    name: "ブロッコリー（生）",           category: "果物・野菜", kcal: 33,  p: 4.3,  f: 0.5,  c: 5.2 },
  { id: "avocado",     name: "アボカド",                     category: "果物・野菜", kcal: 187, p: 2.5,  f: 18.7, c: 6.1 },
  // その他
  { id: "almond",      name: "アーモンド（いり）",           category: "その他", kcal: 598, p: 19.9, f: 51.8, c: 19.7 },
  { id: "protein",     name: "プロテイン（ホエイ・粉末・目安）", category: "その他", kcal: 390, p: 78.0, f: 4.0,  c: 6.0 }
];
