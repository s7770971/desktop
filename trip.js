/* 旅程資料（與元件分開）。改行程只要改這個檔，或在網站上編輯後匯出 JSON。
   category: sight 景點｜food 餐飲｜stay 住宿｜transit 交通｜flight 航班
   cost.per: person 每人｜car 每車｜group 全團；cost 為 null 代表未填
   estimated: true 代表估算；verify: true 代表營業時間／票價／班次待確認 */
window.DEFAULT_TRIP = {
  version: 1,
  sample: true,
  name: "範例行程｜名古屋親子 5 日",
  destination: "日本・名古屋",
  timezone: "Asia/Tokyo",
  startDate: "2027-03-20",
  endDate: "2027-03-24",
  travelers: { adults: 2, children: 1, childAges: "6 歲" },
  currency: { local: "JPY", settle: "TWD", rate: 0.21 },
  items: [
    { id: "d1-flight", date: "2027-03-20", start: "09:30", duration: 180, category: "flight", name: "桃園 TPE → 名古屋 NGO", address: "中部國際機場", lat: 34.8584, lng: 136.8054, cost: { amount: 42000, currency: "TWD", per: "group", estimated: true }, note: "範例航班，班次與票價待確認", locked: true, verify: true },
    { id: "d1-hotel", date: "2027-03-20", start: "14:30", duration: 45, category: "stay", name: "名古屋站前飯店 入住", address: "名古屋市中村區名駅", lat: 35.1709, lng: 136.8815, cost: { amount: 72000, currency: "JPY", per: "group", estimated: true }, note: "4 晚合計，估算", locked: false, verify: true },
    { id: "d1-oasis", date: "2027-03-20", start: "16:00", duration: 90, category: "sight", name: "綠洲 21 與榮商圈散步", address: "名古屋市東區東櫻 1-11-1", lat: 35.1709, lng: 136.9095, cost: { amount: 0, currency: "JPY", per: "person", estimated: false }, note: "", locked: false, verify: false },
    { id: "d1-dinner", date: "2027-03-20", start: "18:00", duration: 75, category: "food", name: "晚餐：味噌豬排", address: "榮商圈", lat: 35.1689, lng: 136.9082, cost: { amount: 1800, currency: "JPY", per: "person", estimated: true }, note: "", locked: false, verify: true },

    { id: "d2-castle", date: "2027-03-21", start: "09:30", duration: 150, category: "sight", name: "名古屋城", address: "名古屋市中區本丸 1-1", lat: 35.1856, lng: 136.8997, cost: { amount: 500, currency: "JPY", per: "person", estimated: true }, note: "開放時間與票價待確認", locked: false, verify: true },
    { id: "d2-lunch", date: "2027-03-21", start: "12:30", duration: 60, category: "food", name: "午餐：金鯱橫丁", address: "名古屋城正門旁", lat: 35.1838, lng: 136.8975, cost: { amount: 1500, currency: "JPY", per: "person", estimated: true }, note: "", locked: false, verify: true },
    { id: "d2-osu", date: "2027-03-21", start: "14:30", duration: 150, category: "sight", name: "大須商店街", address: "名古屋市中區大須", lat: 35.1597, lng: 136.9020, cost: null, note: "零用金未填", locked: false, verify: false },
    { id: "d2-dinner", date: "2027-03-21", start: "18:00", duration: 75, category: "food", name: "晚餐：鰻魚飯三吃", address: "名古屋站周邊", lat: 35.1700, lng: 136.8840, cost: { amount: 4200, currency: "JPY", per: "person", estimated: true }, note: "已訂位（範例），鎖定", locked: true, verify: true },

    { id: "d3-rail", date: "2027-03-22", start: "10:00", duration: 150, category: "sight", name: "磁浮・鐵道館", address: "名古屋市港區金城埠頭 3-2-2", lat: 35.0487, lng: 136.8503, cost: { amount: 1200, currency: "JPY", per: "person", estimated: true }, note: "兒童票價不同，待確認", locked: false, verify: true },
    { id: "d3-lunch", date: "2027-03-22", start: "12:45", duration: 45, category: "food", name: "午餐：鐵道便當", address: "磁浮・鐵道館內", lat: 35.0489, lng: 136.8506, cost: { amount: 1300, currency: "JPY", per: "person", estimated: true }, note: "", locked: false, verify: false },
    { id: "d3-lego", date: "2027-03-22", start: "13:45", duration: 210, category: "sight", name: "樂高樂園", address: "名古屋市港區金城埠頭 2-2-1", lat: 35.0506, lng: 136.8436, cost: { amount: 5800, currency: "JPY", per: "person", estimated: true }, note: "票價依日期浮動，待確認", locked: false, verify: true },
    { id: "d3-dinner", date: "2027-03-22", start: "18:30", duration: 60, category: "food", name: "晚餐：名古屋站地下街", address: "名古屋站", lat: 35.1706, lng: 136.8822, cost: { amount: 1500, currency: "JPY", per: "person", estimated: true }, note: "", locked: false, verify: false },

    { id: "d4-suzuka", date: "2027-03-23", start: "10:30", duration: 120, category: "sight", name: "鈴鹿賽車場樂園：賽車體驗", address: "三重縣鈴鹿市稻生町 7992", lat: 34.8431, lng: 136.5407, cost: { amount: 4800, currency: "JPY", per: "person", estimated: true }, note: "護照票估算，營業日待確認", locked: false, verify: true },
    { id: "d4-lunch", date: "2027-03-23", start: "12:35", duration: 45, category: "food", name: "午餐：園區餐廳", address: "鈴鹿賽車場內", lat: 34.8436, lng: 136.5398, cost: { amount: 1400, currency: "JPY", per: "person", estimated: true }, note: "", locked: false, verify: false },
    { id: "d4-wheel", date: "2027-03-23", start: "13:30", duration: 150, category: "sight", name: "鈴鹿賽車場樂園：摩天輪與遊樂設施", address: "三重縣鈴鹿市稻生町 7992", lat: 34.8440, lng: 136.5412, cost: { amount: 0, currency: "JPY", per: "person", estimated: false }, note: "已含於護照票", locked: false, verify: false },
    { id: "d4-dinner", date: "2027-03-23", start: "18:30", duration: 75, category: "food", name: "晚餐：手羽先", address: "名古屋站周邊", lat: 35.1716, lng: 136.8845, cost: { amount: 2200, currency: "JPY", per: "person", estimated: true }, note: "", locked: false, verify: false },

    { id: "d5-atsuta", date: "2027-03-24", start: "09:00", duration: 90, category: "sight", name: "熱田神宮", address: "名古屋市熱田區神宮 1-1-1", lat: 35.1274, lng: 136.9087, cost: { amount: 0, currency: "JPY", per: "person", estimated: false }, note: "", locked: false, verify: false },
    { id: "d5-lunch", date: "2027-03-24", start: "11:00", duration: 60, category: "food", name: "午餐：碁子麵", address: "熱田神宮境內", lat: 35.1262, lng: 136.9080, cost: { amount: 1000, currency: "JPY", per: "person", estimated: true }, note: "", locked: false, verify: false },
    { id: "d5-flight", date: "2027-03-24", start: "15:30", duration: 195, category: "flight", name: "名古屋 NGO → 桃園 TPE", address: "中部國際機場", lat: 34.8584, lng: 136.8054, cost: { amount: 0, currency: "TWD", per: "group", estimated: false }, note: "來回票已含於去程金額", locked: true, verify: true }
  ],
  /* 手動確認過的交通寫在這裡，key 為「前一站 id>後一站 id」；沒寫的由網站依距離估算 */
  legs: {
    "d1-flight>d1-hotel": { mode: "train", minutes: 40, cost: { amount: 980, currency: "JPY", per: "person", estimated: true }, manual: true, segments: [{ mode: "train", minutes: 30, label: "名鐵機場線" }, { mode: "walk", minutes: 10, label: "步行到飯店" }] }
  },
  packing: [
    { id: "g1", name: "證件與金錢", items: [
      { id: "p1", name: "護照", qty: 3, note: "效期 6 個月以上", done: false },
      { id: "p2", name: "日圓現金", qty: 1, note: "", done: false },
      { id: "p3", name: "信用卡", qty: 2, note: "", done: false } ] },
    { id: "g2", name: "電子用品", items: [
      { id: "p4", name: "手機與充電線", qty: 2, note: "", done: false },
      { id: "p5", name: "行動電源", qty: 1, note: "隨身行李", done: false },
      { id: "p6", name: "網卡或 eSIM", qty: 2, note: "", done: false } ] },
    { id: "g3", name: "衣物", items: [
      { id: "p7", name: "換洗衣物", qty: 5, note: "每人", done: false },
      { id: "p8", name: "薄外套", qty: 3, note: "", done: false } ] },
    { id: "g4", name: "盥洗與保養", items: [
      { id: "p9", name: "牙刷牙膏", qty: 3, note: "", done: false },
      { id: "p10", name: "防曬乳", qty: 1, note: "", done: false } ] },
    { id: "g5", name: "藥品與健康", items: [
      { id: "p11", name: "常備藥", qty: 1, note: "退燒、腸胃、暈車", done: false },
      { id: "p12", name: "OK 繃", qty: 1, note: "", done: false } ] },
    { id: "g6", name: "親子與其他", items: [
      { id: "p13", name: "兒童水壺", qty: 1, note: "", done: false },
      { id: "p14", name: "摺疊雨傘", qty: 2, note: "", done: false } ] }
  ]
};
