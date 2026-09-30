/**
* 果果快選所 — Google Sheet 版後端
* 資料庫：Google Sheet（Products / Settings / Orders 三個分頁）
* 前端：Index.html（Apps Script HtmlService 網頁應用程式）
*
* 部署後，這個 Web App 的網址就是你要分享給顧客的賣場連結。
*/
var SHEET_ID = '16JHVoqK2a-7TGSr6ItQposLfMGVRc8L6kkA23DNoqcs';
var PRODUCTS_SHEET = 'Products';
var SETTINGS_SHEET = 'Settings';
var ORDERS_SHEET = 'Orders';
var PRODUCT_COLS = ['id', 'cat', 'name', 'spec', 'cost', 'retail', 'price', 'stock', 'active'];
var ORDER_COLS = ['id', 'ts', 'itemsJson', 'deliveryMethod', 'name', 'phone', 'ig', 'note',
 'subtotal', 'shipFee', 'total', 'status', 'chain', 'store', 'address', 'itemsSummary'];
var DEFAULT_SETTINGS = [
 ['shopName', '果果快選所'],
 ['igHandle', '@your_ig_handle'],
 ['bank_bankName', '(尚未設定銀行)'],
 ['bank_account', '(尚未設定帳號)'],
 ['bank_holder', '(尚未設定戶名)'],
 ['transferDeadlineHours', '24'],
 ['shipping_home_fee', '100'],
 ['shipping_home_freeThreshold', '1000'],
 ['shipping_store_fee', '60'],
 ['shipping_store_freeThreshold', '1000'],
 ['shipping_store_chains', '7-11,全家'],
 ['adminPin', '1234'],
 ['heroTitle', '今天想一起團什麼？'],
 ['heroIntro', '來自 GOpower 果果能量部分商品，下單前請先閱讀以下事項，我對文盲反感！由於第一波為封測使用購買平台機會，公益性質沒有賺錢，所以不要當文盲！請大家乖乖地：'],
 ['heroNotice', [
   '封測階段，開放以下商品選擇，售價都為各位比價過了，比官網還要便宜一些些～',
   '本波收單日為 9/5，請下單後就直接匯款，並主動私訊我訂單跟匯款後五碼。',
   '經銷訂貨端需 5-10 個工作天才會到我這，由我轉寄到各位手上，會需要我收到貨後 Day+3 天內，可以接受再下訂喔～',
   '萬一這波商品沒有你想要，但你又很想要某個東西，麻煩私訊我，我查價評估後或許可以幫忙一起訂。',
   '如果對操作上有任何疑問或發現 bug，拜託跟我說（萬分感謝）。',
   '選完商品後，點選右上角「購物車」即可進入結帳。'
 ].join('\n')]
];
/* ---------------- setup（第一次使用請先在編輯器手動執行一次這個函式） ---------------- */
function setup() {
 var ss = SpreadsheetApp.openById(SHEET_ID);
 // 1) 確保商品分頁叫做 Products（CSV 匯入時預設分頁名稱不一定是 Products）
 var productsSheet = ss.getSheetByName(PRODUCTS_SHEET);
 if (!productsSheet) {
   var first = ss.getSheets()[0];
   var headerRow = first.getRange(1, 1, 1, first.getLastColumn()).getValues()[0];
   if (headerRow[0] === 'id') {
     first.setName(PRODUCTS_SHEET);
     productsSheet = first;
   } else {
     throw new Error('找不到商品資料分頁，請確認 Sheet 內含有 id/cat/name/... 欄位的分頁。');
   }
 }
 // 2) 建立 Settings 分頁（若不存在）
 var settingsSheet = ss.getSheetByName(SETTINGS_SHEET);
 if (!settingsSheet) {
   settingsSheet = ss.insertSheet(SETTINGS_SHEET);
   settingsSheet.appendRow(['key', 'value']);
   DEFAULT_SETTINGS.forEach(function (row) { settingsSheet.appendRow(row); });
 }
 // 3) 建立 Orders 分頁（若不存在）
 var ordersSheet = ss.getSheetByName(ORDERS_SHEET);
 if (!ordersSheet) {
   ordersSheet = ss.insertSheet(ORDERS_SHEET);
   ordersSheet.appendRow(ORDER_COLS);
 }
 return '初始化完成：Products / Settings / Orders 分頁都已就緒。';
}
/* ---------------- JSON API（給 Cloudflare 前端用 fetch() 呼叫） ---------------- */
var API_FUNCTIONS = {
 getShopData: getShopData,
 verifyAdminPin: verifyAdminPin,
 submitOrder: submitOrder,
 saveProducts: saveProducts,
 saveSettings: saveSettings,
 updateOrderStatus: updateOrderStatus
};
function _jsonOut_(obj) {
 return ContentService.createTextOutput(JSON.stringify(obj))
   .setMimeType(ContentService.MimeType.JSON);
}
function _callApi_(fn, args) {
 if (!API_FUNCTIONS[fn]) {
   return { ok: false, error: 'unknown_function: ' + fn };
 }
 try {
   var result = API_FUNCTIONS[fn].apply(null, args || []);
   return { ok: true, result: result };
 } catch (err) {
   return { ok: false, error: String(err && err.message || err) };
 }
}
/* GET：只給讀取用（getShopData / verifyAdminPin），?fn=getShopData&args=["1234"] */
function doGet(e) {
 var fn = e.parameter.fn;
 var args = [];
 try { args = e.parameter.args ? JSON.parse(e.parameter.args) : []; } catch (err) { args = []; }
 if (!fn) {
   return _jsonOut_({ ok: false, error: '這是果果快選所的資料 API，請用前端網頁存取，不要直接打開這個網址。' });
 }
 return _jsonOut_(_callApi_(fn, args));
}
/* POST：給會寫入資料的動作用，body 格式 {"fn":"submitOrder","args":[...]} */
function doPost(e) {
 var body = {};
 try { body = JSON.parse(e.postData.contents || '{}'); } catch (err) { body = {}; }
 return _jsonOut_(_callApi_(body.fn, body.args));
}
/* ---------------- 內部：讀 Settings 分頁 → map ---------------- */
function _readSettingsMap_(ss) {
 var settingsSheet = ss.getSheetByName(SETTINGS_SHEET);
 var sVals = settingsSheet.getDataRange().getValues();
 var map = {};
 for (var j = 1; j < sVals.length; j++) {
   if (sVals[j][0] === '') continue;
   map[sVals[j][0]] = sVals[j][1];
 }
 return map;
}
/* ---------------- 內部：驗證後台 PIN（一律在後端比對，前端拿不到正確答案） ---------------- */
function _checkPin_(pin) {
 var ss = SpreadsheetApp.openById(SHEET_ID);
 var map = _readSettingsMap_(ss);
 var real = String(map.adminPin || '1234');
 return pin !== undefined && pin !== null && String(pin) === real;
}
function verifyAdminPin(pin) {
 return { ok: _checkPin_(pin) };
}
/* ---------------- 讀取：getShopData ----------------
* pin 不帶或錯誤 → 只回傳公開資料（商品不含 cost，settings 不含 adminPin，orders 空陣列）
* pin 正確 → 回傳完整資料（含 cost、全部 orders），settings.isAdmin 設為 true；adminPin 本身永遠不回傳給前端
*/
function getShopData(pin) {
 var ss = SpreadsheetApp.openById(SHEET_ID);
 var productsSheet = ss.getSheetByName(PRODUCTS_SHEET);
 var settingsSheet = ss.getSheetByName(SETTINGS_SHEET);
 var ordersSheet = ss.getSheetByName(ORDERS_SHEET);
 if (!productsSheet || !settingsSheet || !ordersSheet) {
   throw new Error('資料庫尚未初始化，請先在 Apps Script 編輯器執行一次 setup()。');
 }
 var isAdmin = _checkPin_(pin);
 var pVals = productsSheet.getDataRange().getValues();
 var products = [];
 for (var i = 1; i < pVals.length; i++) {
   var r = pVals[i];
   if (r[0] === '' || r[0] === null) continue;
   products.push({
     id: Number(r[0]),
     cat: String(r[1]),
     name: String(r[2]),
     spec: String(r[3]),
     cost: isAdmin ? (r[4] === '' ? null : Number(r[4])) : null,
     retail: r[5] === '' ? null : Number(r[5]),
     price: r[6] === '' ? null : Number(r[6]),
     stock: r[7] === true || r[7] === 'TRUE',
     active: r[8] === true || r[8] === 'TRUE',
     desc: r[9] ? String(r[9]) : ''
   });
 }
 var map = _readSettingsMap_(ss);
 var settings = {
   shopName: map.shopName || '果果快選所',
   igHandle: map.igHandle || '@your_ig_handle',
   heroTitle: map.heroTitle || '今天想一起團什麼？',
   heroIntro: map.heroIntro || '',
   heroNotice: String(map.heroNotice || '').split('\n').filter(Boolean),
   bank: {
     bankName: map.bank_bankName || '',
     account: map.bank_account || '',
     holder: map.bank_holder || ''
   },
   transferDeadlineHours: Number(map.transferDeadlineHours || 24),
   closeDate: map.closeDate instanceof Date
     ? (map.closeDate.getMonth() + 1) + '/' + map.closeDate.getDate()
     : String(map.closeDate || ''),
   shipping: {
     home: {
       fee: Number(map.shipping_home_fee || 0),
       freeThreshold: Number(map.shipping_home_freeThreshold || 0)
     },
     store: {
       fee: Number(map.shipping_store_fee || 0),
       freeThreshold: Number(map.shipping_store_freeThreshold || 0),
       chains: String(map.shipping_store_chains || '7-11,全家').split(',').map(function (x) { return x.trim(); }).filter(Boolean)
     }
   }
 };
 settings.placeholders = settings.bank.bankName.indexOf('尚未設定') !== -1 || settings.igHandle === '@your_ig_handle';
 settings.isAdmin = isAdmin;
 var orders = [];
 if (isAdmin) {
   var oVals = ordersSheet.getDataRange().getValues();
   for (var k = 1; k < oVals.length; k++) {
     var orow = oVals[k];
     if (orow[0] === '') continue;
     var items = [];
     try { items = JSON.parse(orow[2] || '[]'); } catch (err) { items = []; }
     orders.push({
       id: String(orow[0]),
       ts: orow[1] instanceof Date ? orow[1].toISOString() : String(orow[1]),
       items: items,
       deliveryMethod: orow[3],
       name: orow[4],
       phone: orow[5],
       ig: orow[6],
       note: orow[7],
       subtotal: Number(orow[8]),
       shipFee: Number(orow[9]),
       total: Number(orow[10]),
       status: orow[11],
       chain: orow[12],
       store: orow[13],
       address: orow[14]
     });
   }
 }
 return { products: products, settings: settings, orders: orders };
}
/* ---------------- 內部：用 Sheet 上的真實售價／運費規則重算訂單，不信任前端送來的金額 ---------------- */
function _recomputeOrder_(ss, order) {
 var productsSheet = ss.getSheetByName(PRODUCTS_SHEET);
 var pVals = productsSheet.getDataRange().getValues();
 var byId = {};
 for (var i = 1; i < pVals.length; i++) {
   var r = pVals[i];
   if (r[0] === '' || r[0] === null) continue;
   byId[Number(r[0])] = {
     name: String(r[2]), spec: String(r[3]),
     price: r[6] === '' ? null : Number(r[6]),
     stock: r[7] === true || r[7] === 'TRUE',
     active: r[8] === true || r[8] === 'TRUE'
   };
 }
 var raw = order.items || [];
 if (!raw.length) throw new Error('購物車是空的');
 var items = raw.map(function (it) {
   var p = byId[Number(it.id)];
   var qty = Number(it.qty);
   if (!p) throw new Error('找不到商品（編號 ' + it.id + '），請重新整理頁面再下單');
   if (!p.active || !p.stock || p.price === null || isNaN(p.price)) {
     throw new Error('「' + p.name + '」目前無法訂購（可能已缺貨或下架），請重新整理頁面');
   }
   if (!(qty >= 1 && qty <= 50 && Math.floor(qty) === qty)) {
     throw new Error('「' + p.name + '」數量需為 1 到 50 的整數');
   }
   // 品名、規格、單價都用試算表上的資料，不相信網頁送來的內容
   return { id: Number(it.id), name: p.name, spec: p.spec, qty: qty, price: p.price };
 });
 var subtotal = items.reduce(function (sum, it) { return sum + it.price * it.qty; }, 0);
 var map = _readSettingsMap_(ss);
 var method = order.deliveryMethod;
 var shipFee = 0;
 if (method === 'store') {
   var storeFee = Number(map.shipping_store_fee || 0);
   var storeFree = Number(map.shipping_store_freeThreshold || 0);
   shipFee = subtotal >= storeFree ? 0 : storeFee;
 } else if (method === 'home') {
   var homeFee = Number(map.shipping_home_fee || 0);
   var homeFree = Number(map.shipping_home_freeThreshold || 0);
   shipFee = subtotal >= homeFree ? 0 : homeFee;
 } else if (method !== 'pickup') {
   throw new Error('取貨方式不正確，請重新選擇');
 }
 // pickup（自取）固定免運，shipFee 維持 0
 return { items: items, subtotal: subtotal, shipFee: shipFee, total: subtotal + shipFee };
}
/* ---------------- 寫入：submitOrder ---------------- */
function submitOrder(order) {
 var lock = LockService.getScriptLock();
 lock.waitLock(20000);
 try {
   var ss = SpreadsheetApp.openById(SHEET_ID);
   var ordersSheet = ss.getSheetByName(ORDERS_SHEET);
   var recomputed = _recomputeOrder_(ss, order);
   // 電話欄（第 6 欄）設成純文字，避免開頭的 0 被當成數字吃掉
   ordersSheet.getRange(1, 6, ordersSheet.getMaxRows(), 1).setNumberFormat('@');
   var items = recomputed.items;
   var summary = items.map(function (it) {
     return it.name + '(' + it.spec + ')×' + it.qty;
   }).join('、');
   ordersSheet.appendRow([
     order.id, new Date(), JSON.stringify(items), order.deliveryMethod || '',
     order.name || '', String(order.phone || ''), order.ig || '', order.note || '',
     recomputed.subtotal, recomputed.shipFee, recomputed.total, order.status || '待確認',
     order.chain || '', order.store || '', order.address || '', summary
   ]);
   return {
     ok: true, id: order.id,
     subtotal: recomputed.subtotal, shipFee: recomputed.shipFee, total: recomputed.total,
     priceAdjusted: recomputed.total !== (order.total || 0)
   };
 } finally {
   lock.releaseLock();
 }
}
/* ---------------- 寫入：saveProducts（管理後台，批次更新 上架/售價/庫存） ---------------- */
function saveProducts(pin, products) {
 if (!_checkPin_(pin)) return { ok: false, error: 'unauthorized' };
 var lock = LockService.getScriptLock();
 lock.waitLock(20000);
 try {
   var ss = SpreadsheetApp.openById(SHEET_ID);
   var sheet = ss.getSheetByName(PRODUCTS_SHEET);
   var lastRow = sheet.getLastRow();
   var idCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
   var rowById = {};
   for (var i = 0; i < idCol.length; i++) {
     rowById[Number(idCol[i][0])] = i + 2; // sheet row number
   }
   products.forEach(function (p) {
     var row = rowById[Number(p.id)];
     if (!row) return;
     sheet.getRange(row, 7, 1, 3).setValues([[
       p.price === null || p.price === undefined || p.price === '' ? '' : Number(p.price),
       p.stock ? true : false,
       p.active ? true : false
     ]]);
   });
   return { ok: true, count: products.length };
 } finally {
   lock.releaseLock();
 }
}
/* ---------------- 寫入：saveSettings（管理後台） ---------------- */
function saveSettings(pin, settings) {
 if (!_checkPin_(pin)) return { ok: false, error: 'unauthorized' };
 var lock = LockService.getScriptLock();
 lock.waitLock(20000);
 try {
   var ss = SpreadsheetApp.openById(SHEET_ID);
   var sheet = ss.getSheetByName(SETTINGS_SHEET);
   var flat = {
     shopName: settings.shopName,
     igHandle: settings.igHandle,
     bank_bankName: settings.bank.bankName,
     bank_account: settings.bank.account,
     bank_holder: settings.bank.holder,
     transferDeadlineHours: settings.transferDeadlineHours,
     shipping_home_fee: settings.shipping.home.fee,
     shipping_home_freeThreshold: settings.shipping.home.freeThreshold,
     shipping_store_fee: settings.shipping.store.fee,
     shipping_store_freeThreshold: settings.shipping.store.freeThreshold,
     shipping_store_chains: settings.shipping.store.chains.join(',')
   };
   if (settings.closeDate !== undefined) { flat.closeDate = String(settings.closeDate); }
   // adminPin 只有在管理者真的有輸入新密碼時才更新（前端沒帶就不覆蓋）
   if (settings.newAdminPin) { flat.adminPin = String(settings.newAdminPin); }
   var vals = sheet.getDataRange().getValues();
   var rowByKey = {};
   for (var i = 1; i < vals.length; i++) rowByKey[vals[i][0]] = i + 1;
   Object.keys(flat).forEach(function (key) {
     var row = rowByKey[key];
     if (row) {
       sheet.getRange(row, 2).setValue(flat[key]);
     } else {
       sheet.appendRow([key, flat[key]]);
     }
   });
   return { ok: true };
 } finally {
   lock.releaseLock();
 }
}
/* ---------------- 寫入：updateOrderStatus（管理後台，訂單狀態下拉選單） ---------------- */
function updateOrderStatus(pin, orderId, status) {
 if (!_checkPin_(pin)) return { ok: false, error: 'unauthorized' };
 var lock = LockService.getScriptLock();
 lock.waitLock(20000);
 try {
   var ss = SpreadsheetApp.openById(SHEET_ID);
   var sheet = ss.getSheetByName(ORDERS_SHEET);
   var vals = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues();
   for (var i = 0; i < vals.length; i++) {
     if (String(vals[i][0]) === String(orderId)) {
       sheet.getRange(i + 2, 12).setValue(status); // 第12欄 = status
       return { ok: true };
     }
   }
   return { ok: false, error: 'order_not_found' };
 } finally {
   lock.releaseLock();
 }
}

/* ---------------- 一次性工具：補回舊訂單電話開頭的 0 ----------------
* 在 Apps Script 編輯器上方選「fixPhoneZeros」按執行一次即可。
* 只處理「9 碼、開頭是 9」的號碼（台灣手機 09 開頭被吃掉 0 的情況），其他不動。 */
function fixPhoneZeros() {
 var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(ORDERS_SHEET);
 var n = Math.max(sheet.getLastRow() - 1, 0);
 if (!n) return '沒有訂單';
 var range = sheet.getRange(2, 6, n, 1);
 range.setNumberFormat('@');
 var vals = range.getValues(), fixed = 0;
 for (var i = 0; i < vals.length; i++) {
   var v = String(vals[i][0]).trim();
   if (/^9\d{8}$/.test(v)) { vals[i][0] = '0' + v; fixed++; } else { vals[i][0] = v; }
 }
 range.setValues(vals);
 return '補回 ' + fixed + ' 筆電話開頭的 0';
}
