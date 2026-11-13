(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const KEY = "trip-planner-draft-v1";
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CAT = {
    sight: { label: "景點", color: "#F6D27A" },
    food: { label: "餐飲", color: "#F2A497" },
    stay: { label: "住宿", color: "#A8D3E6" },
    transit: { label: "交通", color: "#B9DAA5" },
    flight: { label: "航班", color: "#B9DAA5" }
  };
  const MODE = {
    train: { label: "火車", color: "#4678C5", icon: "train" },
    subway: { label: "地鐵", color: "#9266C2", icon: "subway" },
    shinkansen: { label: "新幹線", color: "#D8902C", icon: "shinkansen" },
    bus: { label: "公車", color: "#3A9B80", icon: "bus" },
    walk: { label: "步行", color: "#84909E", icon: "walk" },
    taxi: { label: "計程車", color: "#D77968", icon: "taxi" }
  };
  const PER = { person: "每人", car: "每車", group: "全團" };
  const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  const HOUR_H = 52;

  const icon = (name, cls = "") => {
    const i = window.FA[name];
    return i ? `<svg class="fa ${cls}" viewBox="${i.vb}" aria-hidden="true" focusable="false"><path fill="currentColor" d="${i.d}"/></svg>` : "";
  };

  /* ---------- 時間與日期 ---------- */
  const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
  const toHHMM = (n) => { n = Math.max(0, Math.min(1439, Math.round(n))); return String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0"); };
  const endLabel = (n) => (n >= 1440 ? "24:00" : toHHMM(n));
  const fmtDur = (n) => { n = Math.round(n); if (n < 60) return `${n} 分鐘`; const h = Math.floor(n / 60), m = n % 60; return m ? `${h} 小時 ${m} 分鐘` : `${h} 小時`; };
  const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const isoDate = (d) => d.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = parseDate(s); d.setUTCDate(d.getUTCDate() + n); return isoDate(d); };
  const tripDays = () => { const out = []; let d = trip.startDate; let guard = 0; while (d <= trip.endDate && guard++ < 60) { out.push(d); d = addDays(d, 1); } return out.length ? out : [trip.startDate]; };
  const dayLabel = (s) => { const d = parseDate(s); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WEEK[d.getUTCDay()]}）`; };
  const zoneParts = (date, tz) => {
    const p = {};
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date).forEach((x) => (p[x.type] = x.value));
    return p;
  };
  const safeTz = () => { try { new Intl.DateTimeFormat("en-GB", { timeZone: trip.timezone }); return trip.timezone; } catch (e) { return "UTC"; } };
  /* 旅程當地時間 → UTC 時刻 */
  const zonedToUtc = (dateStr, min) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const guess = Date.UTC(y, m - 1, d, Math.floor(min / 60), min % 60);
    const p = zoneParts(new Date(guess), safeTz());
    const asTz = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return new Date(guess - (asTz - guess));
  };
  const nowInTrip = () => { const p = zoneParts(new Date(), safeTz()); return { min: +p.hour * 60 + +p.minute, label: `${p.hour}:${p.minute}` }; };

  /* ---------- 狀態 ---------- */
  const load = () => {
    try { const raw = localStorage.getItem(KEY); if (raw) { const t = JSON.parse(raw); if (t && Array.isArray(t.items) && t.startDate) return normalize(t); } } catch (e) {}
    return normalize(clone(window.DEFAULT_TRIP));
  };
  function normalize(t) {
    t.legs = t.legs || {}; Object.keys(t.legs).forEach((k) => { if (!t.legs[k]) delete t.legs[k]; });
    t.packing = t.packing || []; t.items = t.items || [];
    t.travelers = Object.assign({ adults: 1, children: 0 }, t.travelers);
    t.currency = Object.assign({ local: "JPY", settle: "TWD", rate: 1 }, t.currency);
    t.timezone = t.timezone || "Asia/Taipei";
    if (!t.endDate || t.endDate < t.startDate) t.endDate = t.startDate;
    t.items.forEach((i) => { i.duration = Math.max(5, +i.duration || 60); i.category = CAT[i.category] ? i.category : "sight"; });
    return t;
  }
  let trip = load();
  const ui = { page: "plan", view: "week", day: null, routePreview: true, showTotal: false, packSearch: "", packFilter: "all", bounce: false, prevDayIdx: null };
  ui.day = tripDays()[0];
  const undoStack = [];
  const uid = (p) => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(trip)); } catch (e) { toast("本機草稿存不進去（瀏覽器儲存空間不可用）"); } };
  function commit(fn, msg) {
    undoStack.push(JSON.stringify(trip)); if (undoStack.length > 50) undoStack.shift();
    fn(); normalize(trip); save(); renderAll(); if (msg) toast(msg);
  }
  function undo() {
    if (!undoStack.length) return toast("沒有可以復原的動作");
    trip = JSON.parse(undoStack.pop()); save(); fixDay(); renderAll(); toast("已復原");
  }
  const fixDay = () => { const d = tripDays(); if (!d.includes(ui.day)) ui.day = d[0]; };

  /* ---------- 行程、交通、衝突 ---------- */
  const itemsOf = (date) => trip.items.filter((i) => i.date === date).sort((a, b) => toMin(a.start) - toMin(b.start) || a.id.localeCompare(b.id));
  const itemEnd = (i) => toMin(i.start) + i.duration;
  const hasGeo = (i) => Number.isFinite(i.lat) && Number.isFinite(i.lng);
  const haversine = (a, b) => {
    const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const legKey = (a, b) => a.id + ">" + b.id;
  /* 手動確認過的交通優先；沒有就依直線距離估算（標示為估算，費用留空） */
  function getLeg(a, b) {
    const key = legKey(a, b), saved = trip.legs[key];
    if (saved) return Object.assign({ key, from: a, to: b, manual: true }, saved, { segments: saved.segments && saved.segments.length ? saved.segments : [{ mode: saved.mode, minutes: saved.minutes, label: "" }] });
    if (!hasGeo(a) || !hasGeo(b)) return { key, from: a, to: b, mode: "walk", minutes: 0, cost: null, estimated: true, manual: false, unknown: true, segments: [] };
    const km = haversine(a, b);
    let mode, minutes;
    if (km < 1.2) { mode = "walk"; minutes = Math.max(2, Math.ceil((km * 1.3) / 4.5 * 60)); }
    else if (km < 12) { mode = "subway"; minutes = Math.round((km * 1.3) / 30 * 60 + 8); }
    else { mode = "train"; minutes = Math.round((km * 1.2) / 55 * 60 + 12); }
    minutes = Math.ceil(minutes / 5) * 5;
    return { key, from: a, to: b, mode, minutes, cost: null, estimated: true, manual: false, km, segments: [{ mode, minutes, label: "" }] };
  }
  function dayLegs(date) {
    const list = itemsOf(date), out = [];
    for (let i = 0; i < list.length - 1; i++) {
      const leg = getLeg(list[i], list[i + 1]);
      const gap = toMin(list[i + 1].start) - itemEnd(list[i]);
      leg.gap = gap;
      leg.status = gap < 0 ? "overlap" : gap < leg.minutes ? "late" : "ok";
      leg.walkOnly = leg.segments.length > 0 && leg.segments.every((s) => s.mode === "walk");
      out.push(leg);
    }
    return out;
  }
  const allProblems = () => tripDays().flatMap((d) => dayLegs(d).filter((l) => l.status !== "ok").map((l) => ({ date: d, leg: l })));

  /* ---------- 費用 ---------- */
  const heads = () => (+trip.travelers.adults || 0) + (+trip.travelers.children || 0);
  const mult = (per) => (per === "person" ? Math.max(1, heads()) : 1);
  const money = (n, cur) => `${cur} ${Math.round(n).toLocaleString("en-US")}`;
  const EXP = [
    { key: "transport", label: "交通與機票", color: "#B9DAA5", cats: ["transit", "flight"] },
    { key: "sight", label: "景點門票", color: "#F6D27A", cats: ["sight"] },
    { key: "stay", label: "住宿", color: "#A8D3E6", cats: ["stay"] },
    { key: "food", label: "餐飲", color: "#F2A497", cats: ["food"] }
  ];
  function expenseData() {
    const { local, settle, rate } = trip.currency;
    const rows = [];
    const push = (group, name, date, cost, kind) => {
      const r = { group, name, date, kind, missing: !cost || cost.amount === null || cost.amount === undefined || cost.amount === "", estimated: !!(cost && cost.estimated) };
      if (!r.missing) {
        r.currency = cost.currency || local; r.per = cost.per || "group"; r.unit = +cost.amount; r.total = r.unit * mult(r.per);
        r.known = r.currency === local || r.currency === settle;
        r.settle = r.currency === settle ? r.total : r.currency === local ? r.total * (+rate || 0) : 0;
      }
      rows.push(r);
    };
    trip.items.forEach((i) => push(EXP.find((e) => e.cats.includes(i.category)).key, i.name, i.date, i.cost, "item"));
    tripDays().forEach((d) => dayLegs(d).forEach((l) => { if (!l.unknown && !(l.walkOnly && !l.cost)) push("transport", `${l.from.name} → ${l.to.name}`, d, l.cost, "leg"); }));
    const sum = (f) => rows.filter((r) => !r.missing).reduce((a, r) => a + f(r), 0);
    return {
      rows,
      localSum: sum((r) => (r.currency === local ? r.total : 0)),
      settleSum: sum((r) => (r.currency === settle ? r.total : 0)),
      total: sum((r) => r.settle),
      byGroup: EXP.map((e) => ({ ...e, value: rows.filter((r) => r.group === e.key && !r.missing).reduce((a, r) => a + r.settle, 0) })),
      missing: rows.filter((r) => r.missing).length,
      estimated: rows.filter((r) => !r.missing && r.estimated).length,
      unknownCur: rows.filter((r) => !r.missing && !r.known).length
    };
  }

  /* ---------- 提示訊息 ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 4000);
  }

  /* ---------- 頁首 ---------- */
  function renderHeader() {
    $("#brand").innerHTML = window.BRAND_SVG;
    $("#tripname").textContent = trip.name || "未命名旅程";
    const places = trip.items.filter((i) => i.category !== "flight" && i.category !== "transit").length;
    $("#tripmeta").textContent = `${trip.destination || "目的地未填"}・${tripDays().length} 天・${places} 個地點`;
    const e = expenseData();
    $("#totalvalue").textContent = ui.showTotal ? money(e.total, trip.currency.settle) + (e.missing ? "＋" : "") : "＊＊＊＊";
    const b = $("#eyebutton"); b.innerHTML = icon(ui.showTotal ? "eye" : "eyeSlash");
    b.setAttribute("aria-pressed", ui.showTotal); b.setAttribute("aria-label", ui.showTotal ? "隱藏總花費" : "顯示總花費");
    document.title = (trip.name || "旅行規劃") + "｜旅行規劃";
  }

  /* ---------- 日期列（站點＋插圖），週檢視與單日檢視共用 ---------- */
  function dateStrip() {
    const days = tripDays(), n = days.length, idx = Math.max(0, days.indexOf(ui.day));
    const art = window.dayArt(window.pickIllustration(itemsOf(ui.day)));
    return `<div class="datestrip" style="--n:${n}" data-idx="${idx}">
      <div class="arttrack"><div class="dayart" style="left:${((idx + 0.5) / n) * 100}%" title="${esc(art.title)}">${art.svg}</div></div>
      <div class="stationline">${days.map((d) => `<span class="station${d === ui.day ? " selected" : ""}"></span>`).join("")}</div>
      <div class="datebuttons">${days.map((d) => { const dt = parseDate(d); const a = window.dayArt(window.pickIllustration(itemsOf(d)));
        return `<button type="button" class="datebutton${d === ui.day ? " selected" : ""}" data-date="${d}" aria-pressed="${d === ui.day}" aria-label="${dayLabel(d)}，${esc(a.title)}"><span class="weekday">${WEEK[dt.getUTCDay()]}</span><span class="daynum">${dt.getUTCDate()}</span></button>`; }).join("")}</div>
    </div>`;
  }
  /* 插圖從上一個站點滑到新站點 */
  function animateStrip(root) {
    const strip = $(".datestrip", root); if (!strip) return;
    const n = tripDays().length, idx = +strip.dataset.idx, art = $(".dayart", strip);
    if (ui.prevDayIdx !== null && ui.prevDayIdx !== idx && !reduced()) {
      art.style.transition = "none"; art.style.left = ((ui.prevDayIdx + 0.5) / n) * 100 + "%";
      void art.offsetWidth; art.style.transition = ""; art.classList.add("depart");
      art.style.left = ((idx + 0.5) / n) * 100 + "%";
      art.addEventListener("animationend", () => art.classList.remove("depart"), { once: true });
    }
    if (ui.bounce) { const num = $(".datebutton.selected .daynum", strip); if (num) { num.classList.add("bounce"); num.addEventListener("animationend", () => num.classList.remove("bounce"), { once: true }); } }
    ui.prevDayIdx = idx; ui.bounce = false;
  }
  function selectDay(d) {
    if (d === ui.day) return;
    ui.day = d; ui.bounce = true; renderCalendar(); renderMap(); renderRoutes();
  }

  /* ---------- 週行事曆 ---------- */
  function weekRange() {
    let lo = 7 * 60, hi = 22 * 60;
    trip.items.forEach((i) => { lo = Math.min(lo, toMin(i.start)); hi = Math.max(hi, itemEnd(i)); });
    return { start: Math.floor(lo / 60), end: Math.min(24, Math.ceil(hi / 60) + 1) };
  }
  function layoutDay(list) {
    const cols = []; const placed = [];
    let cluster = [], clusterEnd = -1;
    const flush = () => { const w = Math.max(1, ...cluster.map((c) => c.col + 1)); cluster.forEach((c) => (c.cols = w)); cluster = []; };
    list.forEach((it) => {
      const s = toMin(it.start), e = itemEnd(it);
      if (s >= clusterEnd && cluster.length) { flush(); cols.length = 0; }
      let c = cols.findIndex((end) => end <= s); if (c < 0) { c = cols.length; cols.push(e); } else cols[c] = e;
      const p = { it, col: c, cols: 1 }; cluster.push(p); placed.push(p); clusterEnd = Math.max(clusterEnd, e);
    });
    if (cluster.length) flush();
    return placed;
  }
  function weekHTML() {
    const days = tripDays(), r = weekRange(), hours = [];
    for (let h = r.start; h < r.end; h++) hours.push(h);
    const y = (min) => ((min - r.start * 60) / 60) * HOUR_H;
    const col = (d) => {
      const list = itemsOf(d), legs = dayLegs(d);
      const ev = layoutDay(list).map(({ it, col, cols }) => {
        const h = Math.max(24, (it.duration / 60) * HOUR_H - 2);
        return `<div class="event cat-${it.category}${it.locked ? " locked" : ""}${h < 40 ? " compact" : ""}" data-id="${it.id}" tabindex="0" role="button" aria-label="${esc(it.name)}，${it.start}，${fmtDur(it.duration)}${it.locked ? "，已鎖定" : ""}"
          style="top:${y(toMin(it.start))}px;height:${h}px;left:calc(${(col / cols) * 100}% + 2px);width:calc(${100 / cols}% - 4px)">
          <span class="evtime">${it.start}${it.locked ? icon("lock", "lockicon") : ""}</span><span class="evname">${esc(it.name)}</span>
          ${it.locked ? "" : '<span class="resizehandle" aria-hidden="true"></span>'}</div>`;
      }).join("");
      const lg = legs.map((l) => {
        if (l.status === "overlap") return "";
        if (l.unknown || l.gap < 10) return l.status !== "ok" ? `<div class="legchip bad" data-leg="${l.key}" style="top:${y(itemEnd(l.from)) - 9}px;height:18px" title="時間不夠：需要 ${l.minutes} 分鐘">${icon(MODE[l.mode].icon)}<span>趕</span></div>` : "";
        const hh = Math.max(16, Math.min(l.gap, l.minutes) / 60 * HOUR_H);
        return `<div class="legchip${l.status !== "ok" ? " bad" : ""}" data-leg="${l.key}" tabindex="0" role="button" aria-label="交通：${esc(l.from.name)}到${esc(l.to.name)}，${l.minutes} 分鐘" style="top:${y(itemEnd(l.from))}px;height:${hh}px">${icon(MODE[l.mode].icon)}<span>${l.minutes} 分</span></div>`;
      }).join("");
      return `<div class="daycol${d === ui.day ? " selected" : ""}" data-date="${d}" style="height:${hours.length * HOUR_H}px">${lg}${ev}</div>`;
    };
    return `<div class="weekscroll"><div class="weekinner" style="--n:${days.length}">
      <div class="weekhead"><div class="gutterpad"></div>${dateStrip()}</div>
      <div class="weekbody" data-start="${r.start}">
        <div class="timegutter">${hours.map((h) => `<div class="hour" style="height:${HOUR_H}px"><span>${String(h).padStart(2, "0")}:00</span></div>`).join("")}</div>
        <div class="daycols" style="background-size:100% ${HOUR_H}px">${days.map(col).join("")}</div>
      </div></div></div>`;
  }

  /* ---------- 單日時間軸 ---------- */
  const costText = (c) => (!c || c.amount === null || c.amount === undefined || c.amount === "" ? "費用未填" : `${money(+c.amount, c.currency)}／${PER[c.per] || "全團"}${c.estimated ? "（估算）" : ""}`);
  const segIcons = (l) => l.segments.map((s) => `<span class="seg" style="--mode:${MODE[s.mode].color}">${icon(MODE[s.mode].icon)}<b>${MODE[s.mode].label}</b> ${s.minutes} 分${s.label ? "・" + esc(s.label) : ""}</span>`).join('<span class="segsep">›</span>');
  function dayHTML() {
    const list = itemsOf(ui.day), legs = dayLegs(ui.day);
    if (!list.length) return `<div class="timeline-dates">${dateStrip()}</div><div class="timeline-intro"><strong>${dayLabel(ui.day)}</strong><span>這天還沒有行程，按「新增地點」開始排。</span></div><div class="timeline-list empty"></div>`;
    const s = toMin(list[0].start), e = Math.max(...list.map(itemEnd)), span = Math.max(1, e - s);
    const bad = legs.filter((l) => l.status !== "ok").length;
    const rows = [];
    list.forEach((it, i) => {
      rows.push(`<div class="timeline-time-row" data-id="${it.id}" data-min="${toMin(it.start)}">
        <div class="timeline-card cat-${it.category}" tabindex="0" role="button" aria-label="${esc(it.name)}，${it.start}">
          <div class="cardtop"><span class="cardtime">${it.start}–${endLabel(itemEnd(it))}</span><span class="tag cat-${it.category}">${CAT[it.category].label}</span>${it.locked ? `<span class="tag locktag">${icon("lock")}已鎖定</span>` : ""}${it.verify ? '<span class="tag verify">待確認</span>' : ""}</div>
          <h3>${esc(it.name)}</h3>
          <p class="cardmeta">${fmtDur(it.duration)}${it.address ? "・" + esc(it.address) : ""}</p>
          <p class="cardcost">${costText(it.cost)}</p>
          ${it.note ? `<p class="cardnote">${esc(it.note)}</p>` : ""}
          ${it.source ? `<p class="cardnote"><a href="${esc(it.source)}" target="_blank" rel="noopener">官方來源</a></p>` : ""}
        </div></div>`);
      const l = legs[i];
      if (l) rows.push(`<div class="timeline-time-row legrow" data-leg="${l.key}" data-min="${itemEnd(it)}">
        <div class="timeline-card transitcard${l.walkOnly ? " walkonly" : ""}${l.status !== "ok" ? " bad" : ""}" tabindex="0" role="button" aria-label="交通：${esc(l.from.name)}到${esc(l.to.name)}">
          <div class="cardtop"><span class="cardtime">${l.unknown ? "交通待填" : l.walkOnly ? `步行 ${fmtDur(l.minutes)}` : fmtDur(l.minutes)}</span>${l.manual ? "" : '<span class="tag verify">估算</span>'}${l.status === "late" ? `<span class="tag warn">可能遲到 ${l.minutes - l.gap} 分</span>` : l.status === "overlap" ? '<span class="tag warn">時間重疊</span>' : ""}</div>
          <p class="legends">${esc(l.from.name)} → ${esc(l.to.name)}</p>
          ${l.unknown ? '<p class="cardmeta">缺少座標，請手動填交通方式與時間</p>' : l.walkOnly ? `<p class="segs"><span class="seg" style="--mode:${MODE.walk.color}">${icon("walk")}<b>步行</b></span></p>` : `<p class="segs">${segIcons(l)}</p>`}
          <p class="cardcost">${l.walkOnly && !l.cost ? "免費" : costText(l.cost)}</p>
        </div></div>`);
    });
    return `<div class="timeline-dates">${dateStrip()}</div>
      <div class="timeline-intro"><strong>${dayLabel(ui.day)}</strong><span>${list.length} 個行程・${toHHMM(s)}–${endLabel(e)}</span>${bad ? `<span class="tag warn">${bad} 段交通要注意</span>` : ""}</div>
      <div class="timeline-list">
        <div class="day-time-scale" data-start="${s}" data-end="${e}" aria-hidden="true">
          <span class="scale-label">${toHHMM(s)}</span>
          <div class="scale-line">${list.map((it) => `<i class="scale-tick" style="top:${((toMin(it.start) - s) / span) * 100}%;height:${Math.max(2, (it.duration / span) * 100)}%;background:${CAT[it.category].color}"></i>`).join("")}
            <span class="scale-now" hidden><b></b></span><span class="scale-tracker"></span></div>
          <span class="scale-label">${endLabel(e)}</span>
        </div>
        <div class="timeline-cards" tabindex="0" aria-label="${dayLabel(ui.day)}行程">${rows.join("")}</div>
      </div>`;
  }
  /* 焦點卡、追蹤圓點、上下卡片的淡白與模糊 */
  function updateTimelineFocus() {
    const box = $(".timeline-cards"); if (!box) return;
    const rows = $$(".timeline-time-row", box); if (!rows.length) return;
    const br = box.getBoundingClientRect(), center = br.top + br.height / 2;
    const max = box.scrollHeight - box.clientHeight;
    let cur;
    if (max <= 1 || box.scrollTop <= 1) cur = rows[0];
    else if (box.scrollTop >= max - 1) cur = rows[rows.length - 1];
    else cur = rows.reduce((best, r) => { const rr = r.getBoundingClientRect(), d = Math.abs(rr.top + rr.height / 2 - center); return !best || d < best.d ? { r, d } : best; }, null).r;
    const cr = cur.getBoundingClientRect(), cc = cr.top + cr.height / 2, unit = Math.max(1, br.height * 0.55);
    rows.forEach((r) => {
      const rr = r.getBoundingClientRect(), dist = rr.top + rr.height / 2 - cc;
      r.classList.toggle("timeline-current", r === cur);
      r.classList.toggle("is-above", dist < 0); r.classList.toggle("is-below", dist > 0);
      r.style.setProperty("--blur", r === cur ? 0 : Math.min(1, Math.abs(dist) / unit).toFixed(3));
    });
    const scale = $(".day-time-scale"), s = +scale.dataset.start, e = +scale.dataset.end;
    $(".scale-tracker", scale).style.top = Math.max(0, Math.min(100, ((+cur.dataset.min - s) / Math.max(1, e - s)) * 100)) + "%";
  }
  function updateNow() {
    const now = nowInTrip();
    const scale = $(".day-time-scale");
    if (scale) {
      const s = +scale.dataset.start, e = +scale.dataset.end, el = $(".scale-now", scale), show = now.min >= s && now.min <= e;
      el.hidden = !show; if (show) { el.style.top = ((now.min - s) / Math.max(1, e - s)) * 100 + "%"; $("b", el).textContent = now.label; }
    }
    $$(".weeknow").forEach((x) => x.remove());
    const body = $(".weekbody"), col = $(".daycol.selected");
    if (body && col) {
      const start = +body.dataset.start * 60, top = ((now.min - start) / 60) * HOUR_H;
      if (top >= 0 && top <= col.offsetHeight) col.insertAdjacentHTML("beforeend", `<div class="weeknow" style="top:${top}px"><b>${now.label}</b></div>`);
    }
  }

  function renderCalendar() {
    const panel = $("#calendarpanel"), cal = $("#calendar");
    panel.classList.toggle("timelinepreview", ui.view === "day");
    $$(".calendar-viewtoggle button").forEach((b) => { const on = b.dataset.view === ui.view; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on); });
    const d = parseDate(ui.day); $("#calendarmonth").textContent = `${d.getUTCFullYear()} 年 ${d.getUTCMonth() + 1} 月`;
    cal.innerHTML = ui.view === "week" ? weekHTML() : dayHTML();
    animateStrip(cal);
    if (ui.view === "day") {
      const box = $(".timeline-cards");
      if (box) {
        let raf; box.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(updateTimelineFocus); }, { passive: true });
        /* 滑鼠滾輪每次最多 32px，到頂或到底就交還給頁面 */
        box.addEventListener("wheel", (ev) => {
          if (ev.ctrlKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;
          const dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaMode === 2 ? ev.deltaY * box.clientHeight : ev.deltaY;
          const max = box.scrollHeight - box.clientHeight;
          if ((dy < 0 && box.scrollTop <= 0) || (dy > 0 && box.scrollTop >= max - 1)) return;
          ev.preventDefault(); box.scrollTop += Math.max(-32, Math.min(32, dy));
        }, { passive: false });
        updateTimelineFocus();
      }
    }
    updateNow();
    $("#undobutton").disabled = !undoStack.length;
  }

  /* ---------- 行事曆互動 ---------- */
  let clickTimer = null, suppressClick = false;
  const findItem = (id) => trip.items.find((i) => i.id === id);
  function findLegByKey(key) { for (const d of tripDays()) { const l = dayLegs(d).find((x) => x.key === key); if (l) return l; } return null; }

  $("#calendar").addEventListener("click", (ev) => {
    const db = ev.target.closest(".datebutton"); if (db) return selectDay(db.dataset.date);
    if (suppressClick) { suppressClick = false; return; }
    const evEl = ev.target.closest(".event"), card = ev.target.closest(".timeline-time-row"), chip = ev.target.closest(".legchip");
    if (ev.target.closest("a")) return;
    const target = evEl || chip || card; if (!target) return;
    clearTimeout(clickTimer);
    const x = ev.clientX, y = ev.clientY;
    clickTimer = setTimeout(() => {
      if (target.dataset.id) showPreview(target.dataset.id, x, y);
      else if (target.dataset.leg) showLegPreview(target.dataset.leg, x, y);
    }, 240);
  });
  $("#calendar").addEventListener("dblclick", (ev) => {
    const t = ev.target.closest(".event, .legchip, .timeline-time-row"); if (!t) return;
    clearTimeout(clickTimer); hidePreview();
    if (t.dataset.id) openItemDialog(t.dataset.id); else if (t.dataset.leg) openLegDialog(t.dataset.leg);
  });
  $("#calendar").addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const t = ev.target.closest(".event, .legchip, .timeline-card"); if (!t || ev.target.closest("a")) return;
    const row = t.closest(".timeline-time-row") || t; ev.preventDefault();
    if (row.dataset.id) openItemDialog(row.dataset.id); else if (row.dataset.leg) openLegDialog(row.dataset.leg);
  });

  /* 按住 3 秒才拖移；時長用底部把手調整 */
  let drag = null;
  $("#calendar").addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0 || ev.pointerType === "touch") return;
    const el = ev.target.closest(".event"); if (!el) return;
    const it = findItem(el.dataset.id); if (!it) return;
    const body = $(".weekbody");
    if (ev.target.closest(".resizehandle")) {
      ev.preventDefault(); hidePreview();
      drag = { kind: "resize", el, it, y0: ev.clientY, h0: el.offsetHeight, dur: it.duration };
      el.classList.add("resizing"); el.setPointerCapture(ev.pointerId); return;
    }
    const rect = el.getBoundingClientRect();
    drag = { kind: "hold", el, it, x0: ev.clientX, y0: ev.clientY, grab: ev.clientY - rect.top, start: +body.dataset.start * 60, pid: ev.pointerId };
    if (it.locked) return;
    el.classList.add("holding");
    drag.timer = setTimeout(() => {
      if (!drag || drag.kind !== "hold") return;
      drag.kind = "move"; el.classList.remove("holding"); el.classList.add("dragging"); hidePreview(); clearTimeout(clickTimer);
      try { el.setPointerCapture(drag.pid); } catch (e) {}
      el.style.left = "2px"; el.style.width = "calc(100% - 4px)";
    }, 3000);
  });
  window.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    if (drag.kind === "hold") {
      if (Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) > 6) { clearTimeout(drag.timer); drag.el.classList.remove("holding"); drag = null; }
      return;
    }
    if (drag.kind === "resize") {
      const mins = Math.max(15, Math.round(((drag.h0 + ev.clientY - drag.y0) / HOUR_H) * 60 / 15) * 15);
      drag.dur = Math.min(mins, 1440 - toMin(drag.it.start)); drag.el.style.height = (drag.dur / 60) * HOUR_H - 2 + "px";
      $(".evtime", drag.el).firstChild.textContent = `${drag.it.start}・${fmtDur(drag.dur)}`; return;
    }
    const cols = $$(".daycol"); let col = cols.find((c) => { const r = c.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX < r.right; });
    if (!col) col = drag.el.parentElement;
    if (col !== drag.el.parentElement) col.appendChild(drag.el);
    const r = col.getBoundingClientRect();
    let min = drag.start + ((ev.clientY - r.top - drag.grab) / HOUR_H) * 60;
    min = Math.max(0, Math.min(1440 - drag.it.duration, Math.round(min / 15) * 15));
    drag.newMin = min; drag.newDate = col.dataset.date;
    drag.el.style.top = ((min - drag.start) / 60) * HOUR_H + "px";
    $(".evtime", drag.el).firstChild.textContent = toHHMM(min);
  });
  const endDrag = () => {
    if (!drag) return; const d = drag; drag = null; clearTimeout(d.timer);
    d.el.classList.remove("holding", "dragging", "resizing");
    if (d.kind === "resize") { suppressClick = true; setTimeout(() => (suppressClick = false), 50); if (d.dur !== d.it.duration) commit(() => (findItem(d.it.id).duration = d.dur), `時長改為 ${fmtDur(d.dur)}`); else renderCalendar(); }
    else if (d.kind === "move") {
      suppressClick = true; setTimeout(() => (suppressClick = false), 50);
      if (d.newDate && (d.newDate !== d.it.date || d.newMin !== toMin(d.it.start))) {
        commit(() => { const it = findItem(d.it.id); it.date = d.newDate; it.start = toHHMM(d.newMin); }, null);
        afterMoveNotice(d.it.id);
      } else renderCalendar();
    } else if (d.it.locked && d.kind === "hold") { /* 鎖定的行程維持一般點擊 */ }
  };
  window.addEventListener("pointerup", endDrag); window.addEventListener("pointercancel", endDrag);
  function afterMoveNotice(id) {
    const it = findItem(id); if (!it) return;
    const bad = dayLegs(it.date).filter((l) => (l.from.id === id || l.to.id === id) && l.status !== "ok");
    toast(bad.length ? `已移動，前後交通已重算；有 ${bad.length} 段時間不夠，請看交通明細` : "已移動，前後交通已重算");
  }

  /* ---------- 預覽小卡 ---------- */
  function placePreview(x, y) {
    const p = $("#preview"); p.hidden = false;
    if (innerWidth <= 600) { p.style.left = p.style.top = ""; p.classList.add("sheet"); return; }
    p.classList.remove("sheet");
    const w = p.offsetWidth, h = p.offsetHeight;
    p.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 12)) + "px";
    p.style.top = Math.max(8, Math.min(innerHeight - h - 8, y + 12)) + "px";
  }
  function showPreview(id, x, y) {
    const it = findItem(id); if (!it) return;
    $("#preview").innerHTML = `<div class="previewhead cat-${it.category}"><span class="tag cat-${it.category}">${CAT[it.category].label}</span><button type="button" class="iconbutton" data-act="close" aria-label="關閉">${icon("xmark")}</button></div>
      <h3>${esc(it.name)}</h3><p>${dayLabel(it.date)} ${it.start}–${endLabel(itemEnd(it))}（${fmtDur(it.duration)}）</p>
      ${it.address ? `<p>${icon("pin")} ${esc(it.address)}</p>` : ""}<p>${costText(it.cost)}</p>
      ${it.note ? `<p class="cardnote">${esc(it.note)}</p>` : ""}
      <p class="tags">${it.locked ? `<span class="tag locktag">${icon("lock")}已鎖定</span>` : ""}${it.verify ? '<span class="tag verify">待確認</span>' : ""}</p>
      <div class="previewactions"><button type="button" class="primary" data-act="edit" data-id="${it.id}">${icon("pen")}編輯</button>${hasGeo(it) ? `<button type="button" data-act="locate" data-id="${it.id}">${icon("map")}在地圖看</button>` : ""}</div>`;
    placePreview(x, y);
  }
  function showLegPreview(key, x, y) {
    const l = findLegByKey(key); if (!l) return;
    $("#preview").innerHTML = `<div class="previewhead cat-transit"><span class="tag cat-transit">交通</span><button type="button" class="iconbutton" data-act="close" aria-label="關閉">${icon("xmark")}</button></div>
      <h3>${esc(l.from.name)} → ${esc(l.to.name)}</h3>
      <p>${l.unknown ? "交通待填" : fmtDur(l.minutes)}${l.manual ? "" : "（估算）"}・空檔 ${l.gap} 分鐘</p>
      ${l.unknown ? "" : `<p class="segs">${segIcons(l)}</p>`}<p>${l.walkOnly && !l.cost ? "免費" : costText(l.cost)}</p>
      ${l.status !== "ok" ? `<p class="tags"><span class="tag warn">${l.status === "late" ? "可能遲到" : "時間重疊"}</span></p>` : ""}
      <div class="previewactions"><button type="button" class="primary" data-act="editleg" data-leg="${esc(key)}">${icon("pen")}編輯交通</button></div>`;
    placePreview(x, y);
  }
  const hidePreview = () => ($("#preview").hidden = true);
  $("#preview").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-act]"); if (!b) return; hidePreview();
    if (b.dataset.act === "edit") openItemDialog(b.dataset.id);
    if (b.dataset.act === "editleg") openLegDialog(b.dataset.leg);
    if (b.dataset.act === "locate") locate(b.dataset.id);
  });
  document.addEventListener("pointerdown", (ev) => { if (!$("#preview").hidden && !ev.target.closest("#preview, .event, .legchip, .timeline-time-row, .leaflet-marker-icon")) hidePreview(); });

  /* ---------- 表單：行程 ---------- */
  const curOptions = (sel) => [...new Set([trip.currency.local, trip.currency.settle])].map((c) => `<option${c === sel ? " selected" : ""}>${esc(c)}</option>`).join("");
  function openItemDialog(id) {
    const it = id ? findItem(id) : null;
    const v = it || { date: ui.day, start: "10:00", duration: 60, category: "sight", name: "", address: "", cost: null, note: "", locked: false, verify: false };
    const c = v.cost || {};
    const dlg = $("#itemdialog");
    dlg.innerHTML = `<form method="dialog" id="itemform">
      <h2>${it ? "編輯行程" : "新增地點"}</h2>
      <label>名稱<input name="name" required value="${esc(v.name)}" autocomplete="off"></label>
      <div class="formrow">
        <label>類別<select name="category">${Object.keys(CAT).map((k) => `<option value="${k}"${k === v.category ? " selected" : ""}>${CAT[k].label}</option>`).join("")}</select></label>
        <label>日期<select name="date">${tripDays().map((d) => `<option value="${d}"${d === v.date ? " selected" : ""}>${dayLabel(d)}</option>`).join("")}</select></label>
      </div>
      <div class="formrow">
        <label>開始時間<input type="time" name="start" required value="${esc(v.start)}"></label>
        <label>時長（分鐘）<input type="number" name="duration" min="5" max="1440" step="5" required value="${v.duration}"></label>
      </div>
      <p class="formhint" id="lockhint"${v.locked ? "" : " hidden"}>這個時段已鎖定；要改日期或時間，先取消下面的「鎖定時段」。</p>
      <label>地址<input name="address" value="${esc(v.address)}" autocomplete="off"></label>
      <div class="formrow">
        <label>緯度<input type="number" name="lat" step="any" value="${Number.isFinite(v.lat) ? v.lat : ""}" placeholder="例：35.1709"></label>
        <label>經度<input type="number" name="lng" step="any" value="${Number.isFinite(v.lng) ? v.lng : ""}" placeholder="例：136.8815"></label>
      </div>
      <div class="formrow three">
        <label>費用<input type="number" name="amount" min="0" step="any" value="${c.amount ?? ""}" placeholder="未填"></label>
        <label>幣別<select name="currency">${curOptions(c.currency || trip.currency.local)}</select></label>
        <label>計算方式<select name="per">${Object.keys(PER).map((k) => `<option value="${k}"${k === (c.per || "person") ? " selected" : ""}>${PER[k]}</option>`).join("")}</select></label>
      </div>
      <div class="checks">
        <label><input type="checkbox" name="estimated"${c.estimated ? " checked" : ""}>費用是估算</label>
        <label><input type="checkbox" name="verify"${v.verify ? " checked" : ""}>營業時間／票價待確認</label>
        <label><input type="checkbox" name="locked"${v.locked ? " checked" : ""}>鎖定時段（已預約）</label>
      </div>
      <label>官方來源網址<input type="url" name="source" value="${esc(v.source || "")}" placeholder="https://"></label>
      <label>備註<textarea name="note" rows="2">${esc(v.note)}</textarea></label>
      <div class="dialogactions">
        ${it ? '<button type="button" class="danger" data-act="delete">刪除</button>' : ""}<span class="spacer"></span>
        <button type="button" data-act="cancel">取消</button><button type="submit" class="primary">儲存</button>
      </div></form>`;
    const f = $("#itemform"), wasLocked = !!v.locked;
    const syncLock = () => { const lock = f.locked.checked && wasLocked; ["date", "start", "duration"].forEach((n) => (f[n].disabled = lock)); $("#lockhint").hidden = !lock; };
    f.locked.addEventListener("change", syncLock); syncLock();
    f.addEventListener("click", (ev) => {
      const a = ev.target.dataset.act; if (!a) return;
      if (a === "cancel") dlg.close();
      if (a === "delete") { dlg.close(); commit(() => (trip.items = trip.items.filter((x) => x.id !== it.id)), `已刪除「${it.name}」，可按復原`); }
    });
    f.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const num = (n) => (f[n].value === "" ? null : +f[n].value);
      const data = {
        name: f.name.value.trim(), category: f.category.value, date: f.date.value, start: f.start.value, duration: Math.max(5, +f.duration.value || 60),
        address: f.address.value.trim(), lat: num("lat") ?? undefined, lng: num("lng") ?? undefined,
        cost: num("amount") === null ? null : { amount: num("amount"), currency: f.currency.value, per: f.per.value, estimated: f.estimated.checked },
        note: f.note.value.trim(), locked: f.locked.checked, verify: f.verify.checked, source: f.source.value.trim()
      };
      if (!data.name) return;
      dlg.close();
      const newId = it ? it.id : uid("item");
      commit(() => { if (it) Object.assign(findItem(it.id), data); else trip.items.push(Object.assign({ id: newId }, data)); }, null);
      ui.day = data.date; renderAll(); afterSaveNotice(newId, !!it);
    });
    dlg.showModal();
  }
  function afterSaveNotice(id, edited) {
    const it = findItem(id); const bad = dayLegs(it.date).filter((l) => (l.from.id === id || l.to.id === id) && l.status !== "ok");
    toast((edited ? "已更新" : "已新增") + (bad.length ? `；前後有 ${bad.length} 段交通時間不夠，請看交通明細` : "，前後交通已重算"));
  }

  /* ---------- 表單：交通 ---------- */
  function openLegDialog(key) {
    const l = findLegByKey(key); if (!l) return;
    const dlg = $("#legdialog"); const c = l.cost || {};
    const segRow = (s) => `<div class="segrow"><select name="segmode">${Object.keys(MODE).map((k) => `<option value="${k}"${k === s.mode ? " selected" : ""}>${MODE[k].label}</option>`).join("")}</select>
      <input type="number" name="segmin" min="1" step="1" value="${s.minutes}" aria-label="分鐘"><input name="seglabel" value="${esc(s.label || "")}" placeholder="路線或備註" aria-label="路線或備註">
      <button type="button" class="iconbutton" data-act="delseg" aria-label="移除這段">${icon("trash")}</button></div>`;
    const segs = l.segments.length ? l.segments : [{ mode: "walk", minutes: 10, label: "" }];
    dlg.innerHTML = `<form method="dialog" id="legform">
      <h2>編輯交通</h2><p class="formhint">${esc(l.from.name)} → ${esc(l.to.name)}（空檔 ${l.gap} 分鐘）${l.manual ? "" : "。目前是依直線距離估算。"}</p>
      <div id="segrows">${segs.map(segRow).join("")}</div>
      <button type="button" data-act="addseg">${icon("plus")}加一段</button>
      <div class="formrow three">
        <label>費用<input type="number" name="amount" min="0" step="any" value="${c.amount ?? ""}" placeholder="未填"></label>
        <label>幣別<select name="currency">${curOptions(c.currency || trip.currency.local)}</select></label>
        <label>計算方式<select name="per">${Object.keys(PER).map((k) => `<option value="${k}"${k === (c.per || "person") ? " selected" : ""}>${PER[k]}</option>`).join("")}</select></label>
      </div>
      <div class="checks"><label><input type="checkbox" name="estimated"${l.manual && !l.estimated ? "" : " checked"}>時間或費用是估算</label></div>
      <div class="dialogactions">${l.manual ? '<button type="button" class="danger" data-act="auto">恢復自動估算</button>' : ""}<span class="spacer"></span>
        <button type="button" data-act="cancel">取消</button><button type="submit" class="primary">儲存</button></div></form>`;
    const f = $("#legform");
    f.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-act]"); if (!b) return; const a = b.dataset.act;
      if (a === "cancel") dlg.close();
      if (a === "addseg") $("#segrows").insertAdjacentHTML("beforeend", segRow({ mode: "walk", minutes: 5, label: "" }));
      if (a === "delseg" && $$(".segrow", f).length > 1) b.closest(".segrow").remove();
      if (a === "auto") { dlg.close(); commit(() => delete trip.legs[key], "已恢復自動估算"); }
    });
    f.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const segments = $$(".segrow", f).map((r) => ({ mode: $("[name=segmode]", r).value, minutes: Math.max(1, +$("[name=segmin]", r).value || 1), label: $("[name=seglabel]", r).value.trim() }));
      const minutes = segments.reduce((a, s) => a + s.minutes, 0);
      const main = segments.slice().sort((a, b) => (b.mode !== "walk") - (a.mode !== "walk") || b.minutes - a.minutes)[0].mode;
      const amount = f.amount.value === "" ? null : +f.amount.value;
      dlg.close();
      commit(() => (trip.legs[key] = { mode: main, minutes, segments, manual: true, estimated: f.estimated.checked, cost: amount === null ? null : { amount, currency: f.currency.value, per: f.per.value, estimated: f.estimated.checked } }), "交通已更新");
    });
    dlg.showModal();
  }

  /* ---------- 表單：旅程設定 ---------- */
  function openSettings() {
    const dlg = $("#settingsdialog"), t = trip;
    dlg.innerHTML = `<form method="dialog" id="settingsform"><h2>旅程設定</h2>
      <label>旅程名稱<input name="name" required value="${esc(t.name)}"></label>
      <label>目的地<input name="destination" value="${esc(t.destination)}"></label>
      <div class="formrow"><label>開始日期<input type="date" name="startDate" required value="${t.startDate}"></label><label>結束日期<input type="date" name="endDate" required value="${t.endDate}"></label></div>
      <label>當地時區<input name="timezone" list="tzlist" required value="${esc(t.timezone)}"><datalist id="tzlist">${["Asia/Taipei", "Asia/Tokyo", "Asia/Seoul", "Asia/Bangkok", "Asia/Hong_Kong", "Asia/Singapore", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Australia/Sydney"].map((z) => `<option value="${z}">`).join("")}</datalist></label>
      <div class="formrow"><label>成人<input type="number" name="adults" min="1" value="${t.travelers.adults}"></label><label>兒童<input type="number" name="children" min="0" value="${t.travelers.children}"></label></div>
      <label>兒童年齡<input name="childAges" value="${esc(t.travelers.childAges || "")}" placeholder="例：6 歲、9 歲"></label>
      <div class="formrow three"><label>當地幣別<input name="local" required maxlength="3" value="${esc(t.currency.local)}"></label><label>結算幣別<input name="settle" required maxlength="3" value="${esc(t.currency.settle)}"></label><label>匯率<input type="number" name="rate" min="0" step="any" required value="${t.currency.rate}"></label></div>
      <p class="formhint">匯率是「1 當地幣別 = 多少結算幣別」，請依實際換匯填寫。</p>
      <div class="dialogactions"><span class="spacer"></span><button type="button" data-act="cancel">取消</button><button type="submit" class="primary">儲存</button></div></form>`;
    const f = $("#settingsform");
    f.addEventListener("click", (ev) => { if (ev.target.dataset.act === "cancel") dlg.close(); });
    f.addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (f.endDate.value < f.startDate.value) return toast("結束日期不能早於開始日期");
      try { new Intl.DateTimeFormat("en-GB", { timeZone: f.timezone.value.trim() }); } catch (e) { return toast("時區名稱看不懂，請用 Asia/Tokyo 這種寫法"); }
      dlg.close();
      commit(() => {
        Object.assign(trip, { name: f.name.value.trim(), destination: f.destination.value.trim(), startDate: f.startDate.value, endDate: f.endDate.value, timezone: f.timezone.value.trim(), sample: false });
        trip.travelers = { adults: Math.max(1, +f.adults.value || 1), children: Math.max(0, +f.children.value || 0), childAges: f.childAges.value.trim() };
        const oldLocal = trip.currency.local, oldSettle = trip.currency.settle;
        trip.currency = { local: f.local.value.trim().toUpperCase(), settle: f.settle.value.trim().toUpperCase(), rate: +f.rate.value || 0 };
        const swap = (c) => { if (c && c.currency === oldLocal) c.currency = trip.currency.local; else if (c && c.currency === oldSettle) c.currency = trip.currency.settle; };
        trip.items.forEach((i) => swap(i.cost)); Object.values(trip.legs).forEach((l) => swap(l.cost));
      }, "旅程設定已更新");
      fixDay(); ui.prevDayIdx = null; renderAll();
    });
    dlg.showModal();
  }

  /* ---------- 地圖 ---------- */
  let map, layer, tileOk = false, tileErr = 0;
  function initMap() {
    if (map || !window.L) return;
    map = L.map("map", { zoomControl: true, attributionControl: true }).setView([25.03, 121.56], 11);
    const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap 貢獻者", className: "graytiles" });
    tiles.on("tileload", () => { tileOk = true; $("#mapfallback").hidden = true; });
    tiles.on("tileerror", () => { if (!tileOk && ++tileErr >= 3) $("#mapfallback").hidden = false; });
    tiles.addTo(map); layer = L.layerGroup().addTo(map);
  }
  const dayPoints = () => itemsOf(ui.day).filter(hasGeo);
  function renderMap(fit = true) {
    initMap(); if (!map) return;
    layer.clearLayers();
    const pts = dayPoints();
    if (ui.routePreview) dayLegs(ui.day).forEach((l) => {
      if (l.unknown || !hasGeo(l.from) || !hasGeo(l.to)) return;
      const m = MODE[l.mode];
      L.polyline([[l.from.lat, l.from.lng], [l.to.lat, l.to.lng]], { color: m.color, weight: 5, opacity: 0.9, dashArray: l.mode === "walk" ? "2 9" : null, lineCap: "round" })
        .bindTooltip(`${m.label} ${l.minutes} 分${l.manual ? "" : "（估算）"}`).on("click", () => openLegDialog(l.key)).addTo(layer);
    });
    pts.forEach((it, i) => {
      L.marker([it.lat, it.lng], { icon: L.divIcon({ className: "", html: `<span class="mappin cat-${it.category}">${i + 1}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }), title: it.name, keyboard: true })
        .on("click", (ev) => showPreview(it.id, ev.originalEvent.clientX, ev.originalEvent.clientY)).addTo(layer);
    });
    $("#previewroute").classList.toggle("active", ui.routePreview); $("#previewroute").setAttribute("aria-pressed", ui.routePreview);
    if (fit) fitDay();
  }
  function fitDay() {
    if (!map) return; map.invalidateSize();
    const pts = dayPoints(); if (!pts.length) return;
    if (pts.length === 1) map.setView([pts[0].lat, pts[0].lng], 14, { animate: !reduced() });
    else map.fitBounds(pts.map((p) => [p.lat, p.lng]), { padding: [36, 36], animate: !reduced() });
  }
  function locate(id) { const it = findItem(id); if (!it || !map) return; if (it.date !== ui.day) selectDay(it.date); map.setView([it.lat, it.lng], 15, { animate: !reduced() }); $("#mappanel").scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "nearest" }); }
  $("#previewroute").addEventListener("click", () => { ui.routePreview = !ui.routePreview; renderMap(false); });
  $("#fit").addEventListener("click", () => { fitDay(); const b = $("#fit"); b.classList.add("active"); setTimeout(() => b.classList.remove("active"), 600); });

  /* ---------- 交通明細 ---------- */
  function renderRoutes() {
    const legs = dayLegs(ui.day), pts = dayPoints();
    let link = "";
    if (pts.length >= 2) {
      const q = (p) => `${p.lat},${p.lng}`;
      const mid = pts.slice(1, -1).slice(0, 8).map(q).join("|");
      link = `<a class="extmap" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&origin=${q(pts[0])}&destination=${q(pts[pts.length - 1])}${mid ? "&waypoints=" + encodeURIComponent(mid) : ""}">${icon("route")}在 Google 地圖開啟這天的路線</a>`;
    }
    $("#routepanel > summary").textContent = `交通明細・${dayLabel(ui.day)}`;
    $("#routelist").innerHTML = (legs.length ? legs.map((l) => `<div class="routerow${l.status !== "ok" ? " bad" : ""}">
        <div class="routemain"><strong>${esc(l.from.name)} → ${esc(l.to.name)}</strong>
          <span class="routesegs">${l.unknown ? "缺少座標，請手動填寫" : l.walkOnly ? `<span class="seg" style="--mode:${MODE.walk.color}">${icon("walk")}<b>步行</b> ${l.minutes} 分</span>` : segIcons(l)}</span>
          <span class="routemeta">${l.unknown ? "" : `共 ${fmtDur(l.minutes)}・`}空檔 ${l.gap} 分鐘・${l.walkOnly && !l.cost ? "免費" : costText(l.cost)}
            ${l.manual ? "" : '<span class="tag verify">估算</span>'}${l.status === "late" ? `<span class="tag warn">可能遲到 ${l.minutes - l.gap} 分</span>` : l.status === "overlap" ? '<span class="tag warn">時間重疊</span>' : ""}</span></div>
        <button type="button" class="iconbutton" data-leg="${esc(l.key)}" aria-label="編輯這段交通">${icon("pen")}</button></div>`).join("") : '<p class="empty">這天不到兩個行程，還沒有交通路段。</p>') + link +
      '<p class="formhint">標示「估算」的時間是依兩點直線距離推算，線條也是直線示意；實際班次、車程與票價請以官方資訊為準，可手動修改。</p>';
  }
  $("#routelist").addEventListener("click", (ev) => { const b = ev.target.closest("button[data-leg]"); if (b) openLegDialog(b.dataset.leg); });

  /* ---------- 提醒列 ---------- */
  function renderNotices() {
    const out = [];
    if (trip.sample) out.push('<p class="notice sample">目前顯示的是<strong>範例行程</strong>，地點、時間與金額都是示意。可以直接修改，或用底部工具「清空成空白旅程」「匯入 JSON」換成自己的行程。</p>');
    const days = tripDays(), stray = trip.items.filter((i) => !days.includes(i.date)).length;
    if (stray) out.push(`<p class="notice warn">有 ${stray} 個行程的日期不在旅程起訖日內，請到「旅程設定」調整日期。</p>`);
    const bad = allProblems();
    if (bad.length) out.push(`<p class="notice warn">有 ${bad.length} 段交通時間不夠或行程重疊：${[...new Set(bad.map((b) => dayLabel(b.date)))].join("、")}。</p>`);
    $("#notices").innerHTML = out.join("");
  }

  /* ---------- 費用總覽 ---------- */
  function pieSVG(groups) {
    const total = groups.reduce((a, g) => a + g.value, 0);
    if (total <= 0) return '<svg viewBox="0 0 120 120" class="pie" role="img" aria-label="尚無費用"><circle cx="60" cy="60" r="52" fill="#FFFCF6" stroke="#3E3A39" stroke-width="3"/></svg>';
    let a = -Math.PI / 2; const parts = [];
    groups.filter((g) => g.value > 0).forEach((g) => {
      const f = g.value / total, b = a + f * Math.PI * 2;
      if (f >= 0.999) parts.push(`<circle cx="60" cy="60" r="52" fill="${g.color}"/>`);
      else parts.push(`<path d="M60 60L${60 + 52 * Math.cos(a)} ${60 + 52 * Math.sin(a)}A52 52 0 ${f > 0.5 ? 1 : 0} 1 ${60 + 52 * Math.cos(b)} ${60 + 52 * Math.sin(b)}Z" fill="${g.color}" stroke="#3E3A39" stroke-width="1.5" stroke-linejoin="round"/>`);
      a = b;
    });
    return `<svg viewBox="0 0 120 120" class="pie" role="img" aria-label="支出組成圓餅圖">${parts.join("")}<circle cx="60" cy="60" r="52" fill="none" stroke="#3E3A39" stroke-width="3"/></svg>`;
  }
  function renderExpenses() {
    const e = expenseData(), { local, settle, rate } = trip.currency, total = e.total;
    const table = (g) => {
      const rows = e.rows.filter((r) => r.group === g.key); if (!rows.length) return "";
      return `<section class="expgroup"><h3 style="background:${g.color}">${g.label}<span>${money(g.value, settle)}</span></h3><div class="tablewrap"><table><thead><tr><th>項目</th><th>日期</th><th class="num">金額</th><th class="num">換算 ${esc(settle)}</th><th>狀態</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${r.kind === "leg" ? icon("route") + " " : ""}${esc(r.name)}</td><td>${dayLabel(r.date)}</td>
          <td class="num">${r.missing ? "—" : `${money(r.unit, r.currency)}${r.per === "person" ? ` × ${mult("person")} 人` : `／${PER[r.per]}`}`}</td>
          <td class="num">${r.missing ? "—" : r.known ? money(r.settle, settle) : "幣別未設定"}</td>
          <td>${r.missing ? '<span class="tag warn">未填</span>' : r.estimated ? '<span class="tag verify">估算</span>' : '<span class="tag ok">已確認</span>'}</td></tr>`).join("")}
        </tbody></table></div></section>`;
    };
    $("#expensespage").innerHTML = `<div class="expgrid">
      <section class="totalcard"><h2>合計</h2>
        <dl><div><dt>${esc(local)} 合計</dt><dd>${money(e.localSum, local)}</dd></div>
        <div><dt>${esc(settle)} 合計</dt><dd>${money(e.settleSum, settle)}</dd></div>
        <div class="grand"><dt>換算總額</dt><dd>${money(total, settle)}</dd></div></dl>
        <p class="formhint">匯率 1 ${esc(local)} = ${rate} ${esc(settle)}；旅客 ${heads()} 人（成人 ${trip.travelers.adults}、兒童 ${trip.travelers.children}）。先逐筆換算、加總後才取整數。</p>
        <button type="button" id="expsettings">${icon("gear")}調整匯率與人數</button></section>
      <section class="piecard"><h2>支出組成</h2><div class="piewrap">${pieSVG(e.byGroup)}
        <ul class="legend">${e.byGroup.map((g) => `<li><i style="background:${g.color}"></i><span>${g.label}</span><b>${money(g.value, settle)}</b><em>${total > 0 ? Math.round((g.value / total) * 100) : 0}%</em></li>`).join("")}</ul></div></section>
      </div>
      ${e.missing || e.estimated || e.unknownCur ? `<p class="notice warn budgetnote">${[e.missing ? `${e.missing} 筆金額未填（不計入合計）` : "", e.estimated ? `${e.estimated} 筆是估算` : "", e.unknownCur ? `${e.unknownCur} 筆幣別不在設定內` : ""].filter(Boolean).join("、")}。實際總額會不同。</p>` : ""}
      ${EXP.map((g) => table(e.byGroup.find((x) => x.key === g.key))).join("")}`;
    $("#expsettings").addEventListener("click", openSettings);
  }

  /* ---------- 攜帶用品 ---------- */
  const PACK_COLORS = ["#F6D27A", "#A8D3E6", "#F2A497", "#B9DAA5", "#DED2ED", "#F4C7AA"];
  function renderPacking() {
    const all = trip.packing.flatMap((g) => g.items), done = all.filter((i) => i.done).length;
    $("#packingpage").innerHTML = `<section class="packhead">
        <div class="packprogress"><strong>已完成 ${done}／${all.length}</strong><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${all.length}" aria-valuenow="${done}"><i style="width:${all.length ? (done / all.length) * 100 : 0}%"></i></div></div>
        <label class="packsearch">${icon("search")}<input type="search" id="packsearch" placeholder="搜尋用品" value="${esc(ui.packSearch)}" aria-label="搜尋用品"></label>
        <div class="packfilter" role="group" aria-label="篩選">${[["all", "全部"], ["todo", "未完成"], ["done", "已完成"]].map(([k, l]) => `<button type="button" data-filter="${k}" class="${ui.packFilter === k ? "active" : ""}" aria-pressed="${ui.packFilter === k}">${l}</button>`).join("")}</div>
      </section><div id="packgroups"></div>`;
    renderPackGroups();
  }
  function renderPackGroups() {
    const q = ui.packSearch.trim().toLowerCase();
    $("#packgroups").innerHTML = trip.packing.map((g, gi) => {
      const items = g.items.filter((i) => (!q || (i.name + " " + (i.note || "")).toLowerCase().includes(q)) && (ui.packFilter === "all" || (ui.packFilter === "done") === !!i.done));
      const d = g.items.filter((i) => i.done).length;
      return `<section class="packgroup" data-group="${g.id}"><h3 style="background:${PACK_COLORS[gi % PACK_COLORS.length]}">${esc(g.name)}<span>${d}／${g.items.length}</span></h3>
        <ul>${items.map((i) => `<li class="${i.done ? "done" : ""}" data-item="${i.id}">
          <label class="packcheck"><input type="checkbox" ${i.done ? "checked" : ""} data-f="done"><span>${esc(i.name)}</span></label>
          <input type="number" min="1" value="${i.qty}" data-f="qty" aria-label="${esc(i.name)} 數量">
          <input type="text" value="${esc(i.note || "")}" data-f="note" placeholder="備註" aria-label="${esc(i.name)} 備註">
          <button type="button" class="iconbutton" data-act="delpack" aria-label="刪除 ${esc(i.name)}">${icon("trash")}</button></li>`).join("") || '<li class="empty">沒有符合的用品</li>'}</ul>
        <form class="packadd"><input name="name" placeholder="新增用品" aria-label="在${esc(g.name)}新增用品" autocomplete="off"><button type="submit" aria-label="新增">${icon("plus")}</button></form></section>`;
    }).join("");
  }
  const packItem = (el) => { const g = trip.packing.find((x) => x.id === el.closest(".packgroup").dataset.group); return { g, i: g.items.find((x) => x.id === el.closest("li").dataset.item) }; };
  $("#packingpage").addEventListener("input", (ev) => { if (ev.target.id === "packsearch") { ui.packSearch = ev.target.value; renderPackGroups(); } });
  $("#packingpage").addEventListener("change", (ev) => {
    const f = ev.target.dataset.f; if (!f) return; const { i } = packItem(ev.target);
    const val = f === "done" ? ev.target.checked : f === "qty" ? Math.max(1, +ev.target.value || 1) : ev.target.value.trim();
    commit(() => { trip.packing.forEach((g) => g.items.forEach((x) => { if (x.id === i.id) x[f] = val; })); }, null);
  });
  $("#packingpage").addEventListener("click", (ev) => {
    const fb = ev.target.closest("[data-filter]"); if (fb) { ui.packFilter = fb.dataset.filter; return renderPacking(); }
    const del = ev.target.closest("[data-act=delpack]"); if (del) { const { g, i } = packItem(del); commit(() => { const gg = trip.packing.find((x) => x.id === g.id); gg.items = gg.items.filter((x) => x.id !== i.id); }, `已刪除「${i.name}」，可按復原`); }
  });
  $("#packingpage").addEventListener("submit", (ev) => {
    ev.preventDefault(); const f = ev.target.closest(".packadd"); if (!f) return; const name = f.name.value.trim(); if (!name) return;
    const gid = f.closest(".packgroup").dataset.group;
    commit(() => trip.packing.find((x) => x.id === gid).items.push({ id: uid("p"), name, qty: 1, note: "", done: false }), null);
  });

  /* ---------- 匯入匯出 ---------- */
  function download(name, text, type) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const slug = () => (trip.name || "trip").replace(/[\\/:*?"<>|\s]+/g, "_");
  function buildICS() {
    const z = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const t = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//trip-planner//zh-TW", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${t(trip.name)}`, `X-WR-TIMEZONE:${safeTz()}`];
    trip.items.slice().sort((a, b) => a.date.localeCompare(b.date) || toMin(a.start) - toMin(b.start)).forEach((i) => {
      const s = zonedToUtc(i.date, toMin(i.start)), e = new Date(s.getTime() + i.duration * 60000);
      lines.push("BEGIN:VEVENT", `UID:${i.id}@trip-planner`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(s)}`, `DTEND:${z(e)}`, `SUMMARY:${t(i.name)}`,
        `CATEGORIES:${CAT[i.category].label}`, ...(i.address ? [`LOCATION:${t(i.address)}`] : []), `DESCRIPTION:${t([costText(i.cost), i.note, i.verify ? "待確認" : ""].filter(Boolean).join("\n"))}`, "END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
  }
  window.__tripPlanner = { buildICS, get trip() { return trip; }, expenseData, dayLegs };
  function blankTrip() {
    const p = zoneParts(new Date(), "Asia/Taipei"), today = `${p.year}-${p.month}-${p.day}`;
    return { version: 1, sample: false, name: "我的旅程", destination: "", timezone: "Asia/Taipei", startDate: today, endDate: addDays(today, 2), travelers: { adults: 2, children: 0 }, currency: { local: "JPY", settle: "TWD", rate: 0.21 }, items: [], legs: {}, packing: clone(window.DEFAULT_TRIP.packing) };
  }
  function replaceTrip(next, msg) { commit(() => (trip = normalize(next)), null); ui.day = tripDays()[0]; ui.prevDayIdx = null; renderAll(); toast(msg); }
  $("#importfile").addEventListener("change", async (ev) => {
    const file = ev.target.files[0]; ev.target.value = ""; if (!file) return;
    try {
      const t = JSON.parse(await file.text());
      if (!t || !Array.isArray(t.items) || !/^\d{4}-\d{2}-\d{2}$/.test(t.startDate || "")) throw new Error("format");
      t.items.forEach((i) => { if (!i.id) i.id = uid("item"); if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date || "") || !/^\d{1,2}:\d{2}$/.test(i.start || "")) throw new Error("item"); });
      replaceTrip(t, "已匯入，可按復原回到匯入前");
    } catch (e) { toast("這個檔案不是可用的旅程 JSON（需要 startDate 與 items，每個行程要有 date 和 start）"); }
  });

  /* ---------- 底部工具 ---------- */
  const toolBtn = $("#toolbutton"), toolMenu = $("#toolmenu");
  toolBtn.innerHTML = icon("bars");
  const setMenu = (open) => { toolMenu.hidden = !open; toolBtn.setAttribute("aria-expanded", open); toolBtn.classList.toggle("open", open); if (open) $("button", toolMenu).focus(); };
  toolBtn.addEventListener("click", () => setMenu(toolMenu.hidden));
  document.addEventListener("click", (ev) => { if (!toolMenu.hidden && !ev.target.closest("#toolwrap")) setMenu(false); });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { if (!toolMenu.hidden) { setMenu(false); toolBtn.focus(); } hidePreview(); }
    if (!toolMenu.hidden && (ev.key === "ArrowDown" || ev.key === "ArrowUp")) {
      const bs = $$("button", toolMenu), i = bs.indexOf(document.activeElement); ev.preventDefault();
      bs[(i + (ev.key === "ArrowDown" ? 1 : -1) + bs.length) % bs.length].focus();
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z" && !ev.target.closest("input, textarea, select, dialog")) { ev.preventDefault(); undo(); }
  });
  toolMenu.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-tool]"); if (!t) return; setMenu(false);
    const k = t.dataset.tool;
    if (k === "settings") openSettings();
    if (k === "export") { download(slug() + ".json", JSON.stringify(trip, null, 2), "application/json"); toast("已匯出 JSON 備份"); }
    if (k === "import") $("#importfile").click();
    if (k === "ics") { download(slug() + ".ics", buildICS(), "text/calendar"); toast("已匯出 ICS，可匯入自己的行事曆"); }
    if (k === "blank") replaceTrip(blankTrip(), "已清空成空白旅程，可按復原");
    if (k === "reset") replaceTrip(clone(window.DEFAULT_TRIP), "已還原成範例行程，可按復原");
  });

  /* ---------- 導覽與整體 ---------- */
  function showPage(p) {
    ui.page = p; hidePreview();
    $$("#pagenav button").forEach((b) => { const on = b.dataset.page === p; b.classList.toggle("active", on); b.setAttribute("aria-current", on ? "page" : "false"); });
    $("#planpage").hidden = p !== "plan"; $("#expensespage").hidden = p !== "expenses"; $("#packingpage").hidden = p !== "packing";
    renderPage(); scrollTo({ top: 0 });
  }
  function renderPage() {
    if (ui.page === "plan") { renderNotices(); renderCalendar(); renderMap(); renderRoutes(); }
    if (ui.page === "expenses") renderExpenses();
    if (ui.page === "packing") renderPacking();
  }
  function renderAll() { fixDay(); renderHeader(); renderPage(); }

  $("#pagenav").addEventListener("click", (ev) => { const b = ev.target.closest("button[data-page]"); if (b) showPage(b.dataset.page); });
  $("#eyebutton").addEventListener("click", () => { ui.showTotal = !ui.showTotal; renderHeader(); });
  $(".calendar-viewtoggle").addEventListener("click", (ev) => { const b = ev.target.closest("button[data-view]"); if (!b || b.dataset.view === ui.view) return; ui.view = b.dataset.view; hidePreview(); renderCalendar(); });
  $("#undobutton").innerHTML = icon("undo"); $("#undobutton").addEventListener("click", undo);
  $(".addicon").innerHTML = icon("plus"); $("#addbutton").addEventListener("click", () => openItemDialog(null));
  window.addEventListener("resize", () => { if (map) map.invalidateSize(); if (ui.view === "day") updateTimelineFocus(); });
  setInterval(updateNow, 15000);

  if (innerWidth <= 850) $("#routepanel").open = false;
  renderAll();
})();
