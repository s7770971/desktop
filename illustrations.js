/* 原創 SVG 插圖。日期列小圖：40×30 viewBox、墨灰 #3E3A39、線寬 1.7、圓端。
   pickIllustration(items) 依當天行程挑一張，行程改了圖就跟著換。 */
(function () {
  const S = 'stroke="#3E3A39" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  const wrap = (title, body) =>
    `<svg viewBox="0 0 40 30" role="img" aria-label="${title}" xmlns="http://www.w3.org/2000/svg"><title>${title}</title><g ${S} fill="none">${body}</g></svg>`;

  const ART = {
    plane: { title: "飛機", svg: `
      <path d="M3 9h5M2 14h4M4 19h4" stroke="#A8D3E6"/>
      <path d="M10 16c0-3 3-5 8-5h10c5 0 8 2 8 4s-3 4-8 4H16c-3 0-6-1-6-3z" fill="#FFFFFF"/>
      <path d="M12 16h22" stroke="#F2A497"/>
      <path d="M20 11l-4-6h4l6 6M20 19l-3 6h4l5-6" fill="#FFFFFF"/>
      <path d="M11 13l-3-5h3l3 4" fill="#F2A497"/>
      <circle cx="31" cy="14" r=".6" fill="#3E3A39"/><path d="M24 13.5h3" stroke-width="1.2"/>` },
    castle: { title: "城堡", svg: `
      <path d="M6 27h28l-2-6H8z" fill="#E9E4DA"/>
      <path d="M10 21h20v-5H10z" fill="#FFFFFF"/>
      <path d="M7 16h26l-4-4H11z" fill="#B9DAA5"/>
      <path d="M13 12h14V8H13z" fill="#FFFFFF"/>
      <path d="M10 8h20l-4-4H14z" fill="#B9DAA5"/>
      <path d="M12 4.5l-2-2M28 4.5l2-2" stroke="#F6D27A"/>
      <rect x="18.5" y="16.5" width="3" height="4.5" fill="#3E3A39" stroke="none"/>
      <path d="M15 10h2M23 10h2" stroke-width="1.3"/>` },
    racing: { title: "賽車與摩天輪", svg: `
      <circle cx="29" cy="11" r="8" fill="#FFFFFF"/>
      <path d="M29 3v16M21 11h16M23.4 5.4l11.2 11.2M34.6 5.4L23.4 16.6" stroke-width="1"/>
      <circle cx="29" cy="3" r="1.6" fill="#F2A497"/><circle cx="37" cy="11" r="1.6" fill="#F6D27A"/>
      <circle cx="29" cy="19" r="1.6" fill="#A8D3E6"/><circle cx="21" cy="11" r="1.6" fill="#B9DAA5"/>
      <path d="M26 27l3-16 3 16" stroke-width="1.3"/>
      <path d="M2 24c0-2 2-3 4-3l3-3h7l3 3c3 0 5 1 5 3v1H2z" fill="#F2A497"/>
      <path d="M10 18.5h5l1.5 2.5h-8z" fill="#FFFFFF" stroke-width="1.2"/>
      <circle cx="7" cy="25" r="2.6" fill="#3E3A39"/><circle cx="19" cy="25" r="2.6" fill="#3E3A39"/>
      <circle cx="7" cy="25" r=".8" fill="#FFFFFF" stroke="none"/><circle cx="19" cy="25" r=".8" fill="#FFFFFF" stroke="none"/>` },
    railway: { title: "鐵道博物館", svg: `
      <path d="M3 13l17-9 17 9v3H3z" fill="#B58B6B"/>
      <rect x="5" y="16" width="30" height="10" fill="#E9E4DA"/>
      <path d="M8 26v-5c0-2 2-3 5-3h7v8z" fill="#FFFFFF"/>
      <path d="M9 22h10" stroke="#A8D3E6"/>
      <rect x="22" y="19" width="11" height="7" rx="1.5" fill="#B9DAA5"/>
      <rect x="24" y="20.5" width="3" height="2.5" fill="#FFFFFF" stroke-width="1"/><rect x="28.5" y="20.5" width="3" height="2.5" fill="#FFFFFF" stroke-width="1"/>
      <path d="M3 27.5h34"/>` },
    lego: { title: "積木", svg: `
      <rect x="5" y="16" width="14" height="10" fill="#E0685A"/><rect x="21" y="16" width="14" height="10" fill="#F6D27A"/>
      <rect x="12" y="6" width="14" height="10" fill="#7FB3D8"/><rect x="26" y="9" width="9" height="7" fill="#B9DAA5"/>
      <rect x="7" y="13.5" width="3.5" height="2.5" fill="#E0685A"/><rect x="13.5" y="13.5" width="3.5" height="2.5" fill="#E0685A" stroke="none"/>
      <rect x="14.5" y="3.5" width="3.5" height="2.5" fill="#7FB3D8"/><rect x="20.5" y="3.5" width="3.5" height="2.5" fill="#7FB3D8"/>
      <rect x="28.5" y="6.5" width="3.5" height="2.5" fill="#B9DAA5"/>
      <rect x="23.5" y="13.5" width="2" height="2.5" fill="#F6D27A" stroke="none"/>
      <path d="M7 19h3" stroke="#FFFFFF" stroke-width="1.2"/><path d="M14 9h3" stroke="#FFFFFF" stroke-width="1.2"/>` },
    shrine: { title: "神社鳥居", svg: `
      <path d="M4 7c8 2 24 2 32 0" stroke="#E0685A" stroke-width="2.6"/>
      <path d="M7 12h26" stroke="#E0685A" stroke-width="2.2"/>
      <path d="M11 8v19M29 8v19" stroke="#E0685A" stroke-width="2.6"/>
      <path d="M20 8v4" stroke="#E0685A" stroke-width="2"/>
      <path d="M3 27h34"/>
      <circle cx="20" cy="22" r="3" fill="#B9DAA5"/><path d="M20 25v2"/>` },
    food: { title: "美食", svg: `
      <path d="M6 15h28c0 7-6 11-14 11S6 22 6 15z" fill="#FFFFFF"/>
      <path d="M8 15c2-5 7-8 12-8s10 3 12 8z" fill="#F6D27A"/>
      <path d="M14 12c2-1 4-1 6 0M22 11c2-.5 4 0 5 1.5" stroke="#FFFFFF" stroke-width="1.3"/>
      <path d="M27 3l-9 11M31 4l-9 10" stroke="#B58B6B"/>
      <path d="M11 4c-1 1.5 1 2 0 4M15 2.5c-1 1.5 1 2 0 4" stroke="#A8D3E6" stroke-width="1.3"/>` },
    stay: { title: "住宿", svg: `
      <path d="M5 27V14l15-9 15 9v13z" fill="#FFFFFF"/>
      <path d="M3 15L20 4l17 11" stroke="#3E3A39"/>
      <path d="M5 14l15-9 15 9" fill="#A8D3E6"/>
      <rect x="17" y="19" width="6" height="8" fill="#F6D27A"/>
      <rect x="9" y="17" width="5" height="4" fill="#A8D3E6" stroke-width="1.2"/><rect x="26" y="17" width="5" height="4" fill="#A8D3E6" stroke-width="1.2"/>
      <circle cx="21.5" cy="23.5" r=".5" fill="#3E3A39"/>` },
    walk: { title: "散步", svg: `
      <path d="M3 26c6-3 9-9 15-9s8 5 19 3" stroke="#B9DAA5" stroke-width="3"/>
      <circle cx="12" cy="8" r="4" fill="#B9DAA5"/><path d="M12 12v7"/>
      <circle cx="28" cy="7" r="3" fill="#F2A497"/><path d="M28 10v6"/>
      <circle cx="21" cy="21.5" r="1.4" fill="#F6D27A"/><circle cx="33" cy="24" r="1.2" fill="#F6D27A"/>` },
    train: { title: "列車", svg: `
      <path d="M5 21v-8c0-4 4-6 9-6h17c3 0 4 2 4 4v10z" fill="#FFFFFF"/>
      <path d="M5 17h30" stroke="#B9DAA5" stroke-width="2.4"/>
      <path d="M9 13c0-2 2-3 4-3h3v4H9z" fill="#A8D3E6" stroke-width="1.2"/>
      <rect x="19" y="10" width="4.5" height="4" fill="#A8D3E6" stroke-width="1.2"/><rect x="26.5" y="10" width="4.5" height="4" fill="#A8D3E6" stroke-width="1.2"/>
      <circle cx="12" cy="23" r="2.2" fill="#3E3A39"/><circle cx="28" cy="23" r="2.2" fill="#3E3A39"/>
      <path d="M2 27h36"/>` },
    sight: { title: "景點", svg: `
      <path d="M3 26l9-13 6 8 5-6 14 11z" fill="#B9DAA5"/>
      <path d="M12 13l-2.5 3.6 2.5-1 2 1.4z" fill="#FFFFFF" stroke-width="1.1"/>
      <circle cx="30" cy="8" r="4" fill="#F6D27A"/>
      <path d="M3 26h34"/>` }
  };

  const RULES = [
    ["racing", /賽車|F1|鈴鹿|摩天輪|卡丁車/i],
    ["lego", /樂高|LEGO|積木/i],
    ["railway", /鐵道|磁浮|電車博物|火車博物/],
    ["castle", /城(?!市)|天守|本丸/],
    ["shrine", /神宮|神社|鳥居|寺|廟|宮(?!崎)/],
    ["plane", /機場|航班|→|✈/],
    ["train", /新幹線|列車|鐵路|車站/]
  ];

  /* 依當天行程選圖：先看景點名稱裡最有辨識度的題材，再看航班，最後看類別 */
  window.pickIllustration = function (items) {
    const sights = items.filter((i) => i.category === "sight");
    for (const [key, re] of RULES) {
      if (key === "plane" || key === "train") continue;
      if (sights.some((i) => re.test(i.name))) return key;
    }
    if (items.some((i) => i.category === "flight")) {
      const real = sights.filter((i) => i.duration >= 120);
      if (!real.length) return "plane";
    }
    for (const [key, re] of RULES) if (items.some((i) => re.test(i.name))) return key;
    if (sights.length) return "sight";
    if (items.some((i) => i.category === "food")) return "food";
    if (items.some((i) => i.category === "stay")) return "stay";
    return "walk";
  };
  window.dayArt = (key) => { const a = ART[key] || ART.walk; return { title: a.title, svg: wrap(a.title, a.svg) }; };

  /* 品牌插圖：251×66、墨灰 3px 描線。列車群組 .brand-train 可單獨動 */
  window.BRAND_SVG = `
<svg class="brand-art" viewBox="0 0 251 66" role="img" aria-label="城郭、列車、賽車與摩天輪" xmlns="http://www.w3.org/2000/svg">
  <title>城郭、列車、賽車與摩天輪</title>
  <g stroke="#3E3A39" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M4 60h243"/>
    <g>
      <path d="M12 60l4-12h44l4 12z" fill="#E9E4DA"/>
      <rect x="20" y="36" width="36" height="12" fill="#FFFFFF"/>
      <path d="M14 36h48l-8-9H22z" fill="#B9DAA5"/>
      <rect x="26" y="18" width="24" height="9" fill="#FFFFFF"/>
      <path d="M20 18h36l-8-9H28z" fill="#B9DAA5"/>
      <path d="M25 10l-4-4M51 10l4-4" stroke="#F6D27A"/>
      <rect x="35" y="38" width="6" height="10" fill="#3E3A39" stroke="none"/>
    </g>
    <g class="brand-train">
      <path d="M78 54V40c0-7 6-11 15-11h44c6 0 9 3 9 8v17z" fill="#FFFFFF"/>
      <path d="M78 46h68" stroke="#B9DAA5" stroke-width="5"/>
      <path d="M85 39c0-4 3-6 7-6h6v8H85z" fill="#A8D3E6" stroke-width="2.2"/>
      <rect x="105" y="33" width="9" height="8" fill="#A8D3E6" stroke-width="2.2"/><rect x="120" y="33" width="9" height="8" fill="#A8D3E6" stroke-width="2.2"/>
      <circle cx="92" cy="56" r="4" fill="#3E3A39"/><circle cx="132" cy="56" r="4" fill="#3E3A39"/>
      <path d="M96 31h10" stroke="#FFFFFF" stroke-width="2"/>
    </g>
    <g>
      <path d="M158 56c0-4 4-6 8-6l6-6h14l6 6c6 0 10 2 10 6v2h-44z" fill="#F2A497"/>
      <path d="M174 45h10l3 5h-16z" fill="#FFFFFF" stroke-width="2.2"/>
      <circle cx="168" cy="58" r="5" fill="#3E3A39"/><circle cx="192" cy="58" r="5" fill="#3E3A39"/>
      <circle cx="168" cy="58" r="1.5" fill="#FFFFFF" stroke="none"/><circle cx="192" cy="58" r="1.5" fill="#FFFFFF" stroke="none"/>
    </g>
    <g>
      <circle cx="226" cy="28" r="20" fill="#FFFFFF"/>
      <path d="M226 8v40M206 28h40M212 14l28 28M240 14l-28 28" stroke-width="1.8"/>
      <circle cx="226" cy="8" r="4" fill="#F2A497"/><circle cx="246" cy="28" r="4" fill="#F6D27A"/>
      <circle cx="226" cy="48" r="4" fill="#A8D3E6"/><circle cx="206" cy="28" r="4" fill="#B9DAA5"/>
      <path d="M218 60l8-32 8 32" stroke-width="2.4"/>
    </g>
  </g>
</svg>`;
})();
