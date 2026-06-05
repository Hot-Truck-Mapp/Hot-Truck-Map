/**
 * Hot Truck Map — App Store Screenshots
 * Generates realistic app-UI screenshots for all required device sizes.
 *
 * Required sizes (Apple App Store Connect 2026):
 *   iPhone 6.9" (16 Pro Max) : 1320 × 2868
 *   iPhone 6.7" (15 Plus)    : 1290 × 2796
 *   iPhone 6.5" (11 Pro Max) : 1242 × 2688
 *   iPad 13"   (Pro M4)      : 2064 × 2752
 *   iPad 11"   (Pro M4)      : 1668 × 2388
 *
 * Run: node generate-all-screenshots.js
 * Output: screenshots/
 */
const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const OUT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

/* ── Brand colours (matches src/constants/colors.ts) ─────────────────────── */
const C = {
  primary:   '#E8481C',
  bg:        '#FFFFFF',
  card:      '#F5F5F5',
  dark:      '#171717',
  darkCard:  '#262626',
  text:      '#171717',
  textSec:   '#737373',
  textMuted: '#A3A3A3',
  border:    '#E5E5E5',
  borderDk:  '#404040',
  success:   '#22C55E',
  mapBg:     '#EAE6DE',
  mapBlock:  '#DDD9D1',
  mapRoad:   '#FFFFFF',
};

/* ── SVG primitives ────────────────────────────────────────────────────────── */
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
const FF = '-apple-system, Helvetica Neue, Arial, sans-serif';

function T(text, x, y, { sz=32, fill=C.text, fw='400', anchor='start', op=1 }={}) {
  return `<text x="${x}" y="${y}" font-family="${FF}" font-size="${sz}" font-weight="${fw}" fill="${fill}" text-anchor="${anchor}" opacity="${op}">${esc(text)}</text>`;
}
function R(x, y, w, h, { rx=8, fill=C.card, stroke='none', sw=1, op=1 }={}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op}"/>`;
}
function C2(cx, cy, r, fill, op=1) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${op}"/>`;
}
function L(x1, y1, x2, y2, stroke=C.border, sw=1, op=1) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" opacity="${op}"/>`;
}

/* ── Device configs ────────────────────────────────────────────────────────── */
const DEVICES = [
  { key: 'iphone-69', W: 1320, H: 2868, tabH: 84, statH: 54, iPad: false },
  { key: 'iphone-67', W: 1290, H: 2796, tabH: 84, statH: 54, iPad: false },
  { key: 'iphone-65', W: 1242, H: 2688, tabH: 83, statH: 44, iPad: false },
  { key: 'ipad-13',   W: 2064, H: 2752, tabH: 72, statH: 24, iPad: true  },
  { key: 'ipad-11',   W: 1668, H: 2388, tabH: 62, statH: 24, iPad: true  },
];

/* ── Shared: status bar ────────────────────────────────────────────────────── */
function statusBar(W, statH) {
  const sz = Math.round(statH * 0.52);
  return `
${R(0, 0, W, statH, { rx: 0, fill: C.bg })}
${T('9:41', Math.round(W*0.05), Math.round(statH*0.74), { sz, fw:'600', fill: C.text })}
${T('●●●  WiFi  100%', W - Math.round(W*0.04), Math.round(statH*0.74), { sz: Math.round(sz*0.85), fill: C.text, anchor:'end' })}`;
}

/* ── Shared: tab bar (5 tabs) ─────────────────────────────────────────────── */
function tabBar(W, H, tabH, active) {
  const tabs = [
    { label:'Map',     letter:'M' },
    { label:'Trucks',  letter:'T' },
    { label:'Orders',  letter:'O' },
    { label:'Account', letter:'A' },
    { label:'Go Live', letter:'📡'},
  ];
  const tabY  = H - tabH;
  const tabW  = W / tabs.length;
  const iconSz = Math.round(tabH * 0.28);
  const lblSz  = Math.round(tabH * 0.155);
  let svg = `
${R(0, tabY, W, tabH, { rx:0, fill: C.dark })}
${L(0, tabY, W, tabY, C.borderDk, 1)}`;

  tabs.forEach((tab, i) => {
    const cx   = Math.round(tabW * i + tabW / 2);
    const iconY = tabY + Math.round(tabH * 0.30);
    const lblY  = tabY + Math.round(tabH * 0.74);
    const col   = i === active ? C.primary : '#6B7280';
    if (i === active) {
      svg += R(cx - iconSz, iconY - Math.round(iconSz*0.35), iconSz*2, Math.round(iconSz*1.5),
        { rx: Math.round(iconSz*0.3), fill:'rgba(232,72,28,0.15)' });
    }
    svg += T(tab.letter, cx, iconY + Math.round(iconSz*0.42),
      { sz: iconSz, fw:'700', fill: col, anchor:'middle' });
    svg += T(tab.label, cx, lblY,
      { sz: lblSz, fw: i===active ? '700':'400', fill: col, anchor:'middle' });
  });
  return svg;
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCREEN 1 — Map
───────────────────────────────────────────────────────────────────────────── */
function mapScreen(W, H, tabH, statH) {
  const top = statH, bot = H - tabH;
  const contentH = bot - top;
  let svg = R(0, top, W, contentH, { rx:0, fill: C.mapBg });

  /* street grid */
  const gs = Math.round(W * 0.115);
  for (let x = 0; x < W; x += gs)
    svg += L(x, top, x, bot, C.mapRoad, Math.round(W*0.016));
  for (let y = top; y < bot; y += gs)
    svg += L(0, y, W, y, C.mapRoad, Math.round(W*0.016));
  /* main roads */
  const mrW = Math.round(W * 0.03);
  svg += L(0, top + Math.round(contentH*0.4), W, top + Math.round(contentH*0.4), C.mapRoad, mrW);
  svg += L(Math.round(W*0.44), top, Math.round(W*0.44), bot, C.mapRoad, mrW);
  /* block shading */
  svg += R(Math.round(W*0.015), top + Math.round(contentH*0.02), gs - Math.round(W*0.03), Math.round(contentH*0.12), { rx:0, fill: C.mapBlock, op:0.6 });
  svg += R(Math.round(W*0.015)+gs, top + Math.round(contentH*0.02), gs - Math.round(W*0.03), Math.round(contentH*0.12), { rx:0, fill: C.mapBlock, op:0.4 });
  svg += R(Math.round(W*0.015), top + Math.round(contentH*0.43), gs - Math.round(W*0.03), Math.round(contentH*0.12), { rx:0, fill: C.mapBlock, op:0.5 });
  svg += R(Math.round(W*0.015)+gs*2, top + Math.round(contentH*0.18), gs*2 - Math.round(W*0.03), Math.round(contentH*0.2), { rx:0, fill: C.mapBlock, op:0.4 });

  /* truck markers */
  const MR  = Math.round(W * 0.052);
  const LSZ = Math.round(MR * 0.56);
  const trucks = [
    { x: Math.round(W*0.52), y: top + Math.round(contentH*0.22), name:'Hot Dog King', live:true  },
    { x: Math.round(W*0.20), y: top + Math.round(contentH*0.46), name:'Taco Loco',    live:true  },
    { x: Math.round(W*0.72), y: top + Math.round(contentH*0.61), name:'Seoul Kitchen',live:true  },
    { x: Math.round(W*0.35), y: top + Math.round(contentH*0.73), name:'Smokin BBQ',   live:false },
  ];
  trucks.forEach(t => {
    /* shadow */
    svg += C2(t.x+3, t.y+5, MR+3, '#00000018');
    svg += C2(t.x, t.y, MR+3, '#FFFFFF');
    svg += C2(t.x, t.y, MR, t.live ? C.primary : '#9CA3AF');
    svg += T('🚚', t.x, t.y + Math.round(MR*0.38), { sz: Math.round(MR*1.0), anchor:'middle' });
    /* name label above marker */
    const lblW = t.name.length * Math.round(LSZ * 0.6) + 20;
    svg += R(t.x - Math.round(lblW/2), t.y - MR*3.5, lblW, Math.round(MR*1.5), { rx:5, fill:'#FFFFFF', op:0.95 });
    svg += T(t.name, t.x, t.y - MR*2.25,
      { sz: LSZ, fw:'600', anchor:'middle', fill: C.text });
  });

  /* "3 live trucks" pill */
  const pillW = Math.round(W * 0.56);
  const pillH = Math.round(contentH * 0.05);
  const pillX = Math.round((W - pillW)/2);
  const pillY = top + Math.round(contentH * 0.038);
  svg += R(pillX, pillY, pillW, pillH, { rx: pillH/2, fill:'#FFFFFF' });
  svg += C2(pillX + Math.round(pillW*0.1), pillY + pillH/2, Math.round(pillH*0.2), C.success);
  svg += T('3 food trucks live nearby', pillX + Math.round(pillW*0.2), pillY + Math.round(pillH*0.66),
    { sz: Math.round(pillH*0.45), fw:'600', fill: C.text });

  /* selected truck card */
  const crdH = Math.round(contentH * 0.16);
  const crdY = bot - crdH - Math.round(contentH*0.022);
  const crdW = Math.round(W * 0.88);
  const crdX = Math.round((W-crdW)/2);
  svg += R(crdX, crdY, crdW, crdH, { rx:16, fill:'#FFFFFF' });
  /* LIVE badge */
  const bdgW = Math.round(crdW*0.18), bdgH = Math.round(crdH*0.25);
  svg += R(crdX + Math.round(crdW*0.04), crdY + Math.round(crdH*0.12), bdgW, bdgH,
    { rx: bdgH/2, fill:'rgba(34,197,94,0.12)' });
  svg += C2(crdX + Math.round(crdW*0.065), crdY + Math.round(crdH*0.245), Math.round(bdgH*0.28), C.success);
  svg += T('LIVE', crdX + Math.round(crdW*0.105), crdY + Math.round(crdH*0.33),
    { sz: Math.round(bdgH*0.55), fw:'800', fill: C.success });
  /* truck info */
  svg += T('Hot Dog King', crdX + Math.round(crdW*0.04), crdY + Math.round(crdH*0.56),
    { sz: Math.round(crdH*0.26), fw:'700', fill: C.text });
  svg += T('0.3 mi · Main St & 1st Ave, Hackensack', crdX + Math.round(crdW*0.04), crdY + Math.round(crdH*0.78),
    { sz: Math.round(crdH*0.17), fill: C.textSec });
  /* view button */
  const vBtnW = Math.round(crdW*0.24), vBtnH = Math.round(crdH*0.32);
  const vBtnX = crdX + crdW - vBtnW - Math.round(crdW*0.04);
  const vBtnY = crdY + Math.round(crdH*0.34);
  svg += R(vBtnX, vBtnY, vBtnW, vBtnH, { rx: vBtnH/2, fill: C.primary });
  svg += T('View', vBtnX + vBtnW/2, vBtnY + Math.round(vBtnH*0.66),
    { sz: Math.round(vBtnH*0.52), fw:'700', fill:'#FFFFFF', anchor:'middle' });

  return svg;
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCREEN 2 — Truck list
───────────────────────────────────────────────────────────────────────────── */
function trucksScreen(W, H, tabH, statH) {
  const top = statH, bot = H - tabH;
  let svg = R(0, top, W, bot - top, { rx:0, fill: C.bg });

  /* header */
  const hdrH = Math.round(H * 0.075);
  svg += T('Trucks Near You', Math.round(W*0.05), top + Math.round(hdrH*0.66),
    { sz: Math.round(hdrH*0.46), fw:'700', fill: C.text });

  /* search bar */
  const srchH = Math.round(H * 0.05);
  const srchY = top + hdrH;
  const srchX = Math.round(W*0.04);
  const srchW = W - srchX*2;
  svg += R(srchX, srchY, srchW, srchH, { rx: srchH/2, fill: C.card });
  svg += T('🔍  Search trucks, cuisine…', srchX + Math.round(srchW*0.05), srchY + Math.round(srchH*0.64),
    { sz: Math.round(srchH*0.44), fill: C.textMuted });

  /* divider */
  svg += L(0, srchY + srchH + Math.round(H*0.014), W, srchY + srchH + Math.round(H*0.014), C.border, 1);

  /* cards */
  const data = [
    { name:'Hot Dog King',  cuisine:'American · Hot Dogs', dist:'0.3 mi', live:true,  emoji:'🌭' },
    { name:'Taco Loco',     cuisine:'Mexican · Tacos',     dist:'0.5 mi', live:true,  emoji:'🌮' },
    { name:'Seoul Kitchen', cuisine:'Korean · Noodles',    dist:'0.8 mi', live:true,  emoji:'🍜' },
    { name:'Smokin BBQ',    cuisine:'BBQ · Ribs & Brisket',dist:'1.2 mi', live:false, emoji:'🥩' },
    { name:'Fresh Garden',  cuisine:'Healthy · Salads',    dist:'1.5 mi', live:false, emoji:'🥗' },
    { name:'Burger Bros',   cuisine:'American · Burgers',  dist:'1.8 mi', live:false, emoji:'🍔' },
  ];
  const padX = Math.round(W*0.04);
  const crdW = W - padX*2;
  const crdH = Math.round(H * 0.098);
  const gap  = Math.round(H * 0.006);
  let   crdY = srchY + srchH + Math.round(H*0.022);

  data.forEach(d => {
    if (crdY + crdH > bot - Math.round(H*0.01)) return;

    svg += R(padX, crdY, crdW, crdH, { rx:12, fill:'#FFFFFF' });
    svg += L(padX, crdY, padX+crdW, crdY, C.border, 1);

    /* avatar */
    const avSz = Math.round(crdH * 0.60);
    const avX  = padX + Math.round(crdW*0.028);
    const avCY = crdY + crdH/2;
    svg += R(avX, avCY - avSz/2, avSz, avSz, { rx: Math.round(avSz*0.22), fill: C.card });
    svg += T(d.emoji, avX + avSz/2, avCY + Math.round(avSz*0.3),
      { sz: Math.round(avSz*0.56), anchor:'middle' });

    /* text */
    const infoX = avX + avSz + Math.round(crdW*0.038);
    svg += T(d.name, infoX, crdY + Math.round(crdH*0.40),
      { sz: Math.round(crdH*0.264), fw:'700', fill: C.text });
    svg += T(`${d.cuisine} · ${d.dist}`, infoX, crdY + Math.round(crdH*0.65),
      { sz: Math.round(crdH*0.198), fill: C.textSec });

    /* status badge */
    const bdgW2 = Math.round(crdW*0.155), bdgH2 = Math.round(crdH*0.27);
    const bdgX  = padX + crdW - bdgW2 - Math.round(crdW*0.03);
    const bdgY  = crdY + Math.round(crdH*0.365);
    svg += R(bdgX, bdgY, bdgW2, bdgH2,
      { rx: bdgH2/2, fill: d.live ? 'rgba(34,197,94,0.12)' : 'rgba(163,163,163,0.12)' });
    if (d.live) svg += C2(bdgX + Math.round(bdgW2*0.2), bdgY + bdgH2/2, Math.round(bdgH2*0.24), C.success);
    svg += T(d.live ? 'LIVE' : 'Closed',
      bdgX + (d.live ? bdgW2*0.44 : bdgW2/2), bdgY + Math.round(bdgH2*0.68),
      { sz: Math.round(bdgH2*0.5), fw:'700',
        fill: d.live ? C.success : C.textMuted,
        anchor: d.live ? 'start' : 'middle' });

    /* chevron */
    svg += T('›', padX + crdW - Math.round(crdW*0.018), crdY + crdH/2 + Math.round(crdH*0.10),
      { sz: Math.round(crdH*0.38), fill: C.textMuted, anchor:'end' });

    crdY += crdH + gap;
  });

  return svg;
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCREEN 3 — Truck detail
───────────────────────────────────────────────────────────────────────────── */
function detailScreen(W, H, tabH, statH) {
  const top = statH, bot = H - tabH;
  let svg = R(0, top, W, bot - top, { rx:0, fill: C.bg });

  /* nav bar */
  const navH = Math.round(H * 0.062);
  svg += R(0, top, W, navH, { rx:0, fill: C.bg });
  svg += T('‹  Back', Math.round(W*0.038), top + Math.round(navH*0.66),
    { sz: Math.round(navH*0.44), fill: C.primary });
  svg += T('Hot Dog King', W/2, top + Math.round(navH*0.66),
    { sz: Math.round(navH*0.40), fw:'600', fill: C.text, anchor:'middle' });

  /* hero */
  const heroY = top + navH;
  const heroH = Math.round(H * 0.20);
  svg += R(0, heroY, W, heroH, { rx:0, fill: C.primary });
  /* gradient fade */
  svg += `<defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#E8481C"/><stop offset="100%" stop-color="#C93D14"/></linearGradient></defs>`;
  svg += R(0, heroY, W, heroH, { rx:0, fill:'url(#hg)' });
  svg += T('🌭', W/2, heroY + Math.round(heroH*0.56),
    { sz: Math.round(heroH*0.42), anchor:'middle' });
  svg += T('Hot Dog King', W/2, heroY + Math.round(heroH*0.82),
    { sz: Math.round(heroH*0.14), fw:'700', fill:'#FFFFFF', anchor:'middle', op:0.9 });

  /* content */
  const padX = Math.round(W*0.05);
  const cW   = W - padX*2;
  let   cY   = heroY + heroH + Math.round(H*0.022);

  /* name + live badge */
  svg += T('Hot Dog King', padX, cY + Math.round(H*0.036),
    { sz: Math.round(H*0.036), fw:'700', fill: C.text });
  const lbW = Math.round(cW*0.15), lbH = Math.round(H*0.028);
  const lbX = W - padX - lbW;
  svg += R(lbX, cY + Math.round(H*0.008), lbW, lbH, { rx: lbH/2, fill:'rgba(34,197,94,0.12)' });
  svg += C2(lbX + Math.round(lbW*0.2), cY + Math.round(H*0.008) + lbH/2, Math.round(lbH*0.27), C.success);
  svg += T('LIVE', lbX + Math.round(lbW*0.38), cY + Math.round(H*0.008) + Math.round(lbH*0.68),
    { sz: Math.round(lbH*0.54), fw:'800', fill: C.success });

  cY += Math.round(H*0.054);
  svg += T('American · Hot Dogs & Sausages', padX, cY,
    { sz: Math.round(H*0.022), fill: C.textSec });
  cY += Math.round(H*0.03);
  svg += T('📍  Main St & 1st Ave, Hackensack NJ  ·  0.3 mi', padX, cY,
    { sz: Math.round(H*0.020), fill: C.textSec });
  cY += Math.round(H*0.026);
  svg += T('⏰  Open now · Closes at 8:00 PM', padX, cY,
    { sz: Math.round(H*0.020), fill: C.textSec });

  cY += Math.round(H*0.036);
  svg += L(0, cY, W, cY, C.border, 1);
  cY += Math.round(H*0.026);

  /* action buttons */
  const btnW2 = Math.round(cW*0.46), btnH2 = Math.round(H*0.054);
  svg += R(padX, cY, btnW2, btnH2, { rx: btnH2/2, fill: C.primary });
  svg += T('Order Pickup', padX + btnW2/2, cY + Math.round(btnH2*0.64),
    { sz: Math.round(btnH2*0.41), fw:'700', fill:'#FFFFFF', anchor:'middle' });
  const b2X = padX + btnW2 + Math.round(cW*0.08);
  svg += R(b2X, cY, btnW2, btnH2, { rx: btnH2/2, fill: C.bg, stroke: C.border, sw:2 });
  svg += T('♡  Follow', b2X + btnW2/2, cY + Math.round(btnH2*0.64),
    { sz: Math.round(btnH2*0.41), fw:'700', fill: C.text, anchor:'middle' });

  cY += btnH2 + Math.round(H*0.036);
  svg += L(0, cY, W, cY, C.border, 1);
  cY += Math.round(H*0.026);

  /* menu section */
  svg += T('Menu', padX, cY, { sz: Math.round(H*0.030), fw:'700', fill: C.text });
  cY += Math.round(H*0.040);

  const menu = [
    { name:'Classic Hot Dog',  price:'$4.99', desc:'All-beef frank, bun, mustard & relish' },
    { name:'Chili Cheese Dog', price:'$6.49', desc:'Hot dog topped with homemade chili & cheddar' },
    { name:'Veggie Sausage',   price:'$5.99', desc:'Plant-based sausage with grilled peppers' },
    { name:'Loaded Fries',     price:'$3.99', desc:'Crispy fries, chili, sour cream & scallions' },
    { name:'Fountain Drink',   price:'$1.99', desc:'Pepsi, Sprite, Lemonade (32 oz)' },
  ];
  const itmH = Math.round(H * 0.082);
  menu.forEach(m => {
    if (cY + itmH > bot - Math.round(H*0.02)) return;
    svg += L(padX, cY - Math.round(H*0.004), padX+cW, cY - Math.round(H*0.004), C.border, 1);
    svg += T(m.name, padX, cY + Math.round(itmH*0.34),
      { sz: Math.round(itmH*0.26), fw:'600', fill: C.text });
    svg += T(m.price, padX + cW, cY + Math.round(itmH*0.34),
      { sz: Math.round(itmH*0.26), fw:'700', fill: C.primary, anchor:'end' });
    svg += T(m.desc, padX, cY + Math.round(itmH*0.62),
      { sz: Math.round(itmH*0.20), fill: C.textSec });
    cY += itmH;
  });

  return svg;
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCREEN 4 — Operator / Go Live
───────────────────────────────────────────────────────────────────────────── */
function operatorScreen(W, H, tabH, statH) {
  const top = statH, bot = H - tabH;
  let svg = R(0, top, W, bot - top, { rx:0, fill: C.bg });

  /* header */
  const hdrH = Math.round(H * 0.075);
  svg += T('Operator', Math.round(W*0.05), top + Math.round(hdrH*0.66),
    { sz: Math.round(hdrH*0.46), fw:'700', fill: C.text });
  svg += L(0, top + hdrH, W, top + hdrH, C.border, 1);

  const cx    = W / 2;
  const midY  = top + hdrH + Math.round((bot - top - hdrH) * 0.38);

  /* truck name */
  svg += T('Hot Dog King', cx, midY - Math.round(H*0.135),
    { sz: Math.round(H*0.032), fw:'800', fill: C.text, anchor:'middle' });

  /* go live button */
  const btnSz  = Math.round(W * 0.78);
  const btnBH  = Math.round(btnSz * 0.38);
  const btnBX  = Math.round((W - btnSz)/2);
  const btnBY  = midY - Math.round(btnBH * 0.44);
  /* outer glow */
  svg += R(btnBX - 8, btnBY - 8, btnSz + 16, btnBH + 16,
    { rx: Math.round(btnBH*0.26), fill:'rgba(232,72,28,0.18)' });
  svg += R(btnBX, btnBY, btnSz, btnBH,
    { rx: Math.round(btnBH*0.22), fill: C.primary });
  svg += T('📍  Go Live', cx, btnBY + Math.round(btnBH*0.44),
    { sz: Math.round(btnBH*0.36), fw:'900', fill:'#FFFFFF', anchor:'middle' });
  svg += T('Tap to broadcast your GPS location', cx, btnBY + Math.round(btnBH*0.72),
    { sz: Math.round(btnBH*0.20), fill:'rgba(255,255,255,0.78)', anchor:'middle' });

  /* manual toggle */
  svg += T('GPS not working? Enter address manually', cx, btnBY + btnBH + Math.round(H*0.04),
    { sz: Math.round(H*0.019), fill: C.textSec, anchor:'middle' });

  /* info hint */
  svg += T('Going live notifies your followers and puts your truck on the map instantly.',
    cx, bot - Math.round(H*0.065),
    { sz: Math.round(H*0.018), fill: C.textMuted, anchor:'middle' });

  return svg;
}

/* ── Build + save one screenshot ──────────────────────────────────────────── */
async function save(svgStr, filePath) {
  await sharp(Buffer.from(svgStr)).png().toFile(filePath);
}

function buildSVG(W, H, tabH, statH, screenFn, activeTab) {
  const content = screenFn(W, H, tabH, statH);
  const tabs    = tabBar(W, H, tabH, activeTab);
  const stat    = statusBar(W, statH);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<rect width="${W}" height="${H}" fill="${C.bg}"/>
${content}
${tabs}
${stat}
</svg>`;
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
async function main() {
  const screens = [
    { fn: mapScreen,      tab: 0, label: '1-map'      },
    { fn: trucksScreen,   tab: 1, label: '2-trucks'   },
    { fn: detailScreen,   tab: 1, label: '3-detail'   },
    { fn: operatorScreen, tab: 4, label: '4-golive'   },
  ];

  let total = 0;
  for (const dev of DEVICES) {
    console.log(`\n📱 ${dev.key} (${dev.W}×${dev.H})`);
    for (const scr of screens) {
      const file = path.join(OUT_DIR, `${dev.key}-${scr.label}.png`);
      const svg  = buildSVG(dev.W, dev.H, dev.tabH, dev.statH, scr.fn, scr.tab);
      await save(svg, file);
      const m = await sharp(file).metadata();
      console.log(`  ✓  ${path.basename(file)}  ${m.width}×${m.height}`);
      total++;
    }
  }
  console.log(`\n✅  ${total} screenshots saved to: ${OUT_DIR}`);
}

main().catch(e => { console.error(e); process.exit(1); });
