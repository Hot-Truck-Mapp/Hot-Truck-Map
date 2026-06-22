/**
 * Generates iPad and Apple Watch App Store screenshots
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ORANGE = '#FF6B35';
const WHITE = '#FFFFFF';
const ICON_PATH = path.join(__dirname, 'assets', 'icon.png');
const SPLASH_PATH = path.join(__dirname, 'assets', 'splash.png');
const OUT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function txt(content, x, y, opts = {}) {
  const { fill = WHITE, fontSize = 72, fontWeight = 'bold', opacity = 1, anchor = 'middle' } = opts;
  return `<text x="${x}" y="${y}" font-family="Helvetica Neue, Arial, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}">${esc(content)}</text>`;
}
function rect(x, y, w, h, r, fill) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
}
async function resizeIcon(size) {
  return sharp(ICON_PATH).resize(size, size, { fit: 'contain', background: { r: 255, g: 107, b: 53, alpha: 0 } }).png().toBuffer();
}

// ── iPad screenshot generator ────────────────────────────────────────────────
async function makeIPadScreenshot(W, H, suffix, title1, title2, body, cards) {
  const cx = W / 2;
  const iconSize = Math.round(W * 0.18);
  const iconBuf = await resizeIcon(iconSize);

  // Place splash image in upper portion
  const splashH = Math.round(H * 0.40);
  const splashW = Math.round(splashH * (1284 / 2778));
  const splashBuf = await sharp(SPLASH_PATH)
    .resize(splashW, splashH, { fit: 'contain', background: { r: 255, g: 107, b: 53, alpha: 0 } })
    .png().toBuffer();
  const splashLeft = Math.round((W - splashW) / 2);
  const splashTop = Math.round(H * 0.03);

  const captionY = splashTop + splashH + Math.round(H * 0.04);
  const fs1 = Math.round(W * 0.058);
  const fs2 = Math.round(W * 0.038);
  const fs3 = Math.round(W * 0.032);
  const lh = Math.round(fs1 * 1.2);
  const cardH = Math.round(H * 0.075);
  const cardGap = Math.round(H * 0.012);
  const cardRx = Math.round(cardH * 0.15);
  const cardFontSize = Math.round(W * 0.033);
  const cardSubFontSize = Math.round(W * 0.025);
  const cardPad = Math.round(W * 0.06);

  let cardsSVG = '';
  let cardY = captionY + lh * 2 + Math.round(H * 0.10);
  for (const card of cards) {
    cardsSVG += `${rect(Math.round(W * 0.04), cardY, Math.round(W * 0.92), cardH, cardRx, 'rgba(255,255,255,0.18)')}`;
    cardsSVG += txt(card.name, Math.round(W * 0.04) + cardPad, cardY + Math.round(cardH * 0.48), { fontSize: cardFontSize, anchor: 'start' });
    cardsSVG += txt(card.sub, Math.round(W * 0.04) + cardPad, cardY + Math.round(cardH * 0.78), { fontSize: cardSubFontSize, fontWeight: 'normal', opacity: 0.8, anchor: 'start' });
    cardY += cardH + cardGap;
  }

  const btnW = Math.round(W * 0.35);
  const btnH = Math.round(H * 0.06);
  const btnY = Math.round(H * 0.88);
  const btnFontSize = Math.round(W * 0.030);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${ORANGE}"/>
  ${txt('HOT TRUCK MAP', cx, Math.round(H * 0.025) + Math.round(fs1 * 0.5), { fontSize: Math.round(W * 0.030), opacity: 0.7 })}
  ${txt(title1, cx, captionY, { fontSize: fs1 })}
  ${txt(title2, cx, captionY + lh, { fontSize: fs1 })}
  ${txt(body, cx, captionY + lh + Math.round(H * 0.055), { fontSize: fs2, fontWeight: 'normal', opacity: 0.85 })}
  ${cardsSVG}
  ${rect(cx - btnW / 2, btnY, btnW, btnH, btnH / 2, 'rgba(255,255,255,0.25)')}
  ${txt('Download Free Today', cx, btnY + Math.round(btnH * 0.63), { fontSize: btnFontSize })}
</svg>`;

  await sharp(Buffer.from(svg))
    .composite([
      { input: splashBuf, top: splashTop, left: splashLeft },
    ])
    .toFile(path.join(OUT_DIR, `ipad-${suffix}.png`));
}

// ── Apple Watch screenshot generator ─────────────────────────────────────────
async function makeWatchScreenshot(W, H, suffix) {
  const cx = W / 2;
  const iconSize = Math.round(W * 0.55);
  const iconBuf = await resizeIcon(iconSize);
  const fs1 = Math.round(W * 0.13);
  const fs2 = Math.round(W * 0.085);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" rx="${Math.round(W * 0.12)}" fill="${ORANGE}"/>
  ${txt('HOT', cx, Math.round(H * 0.30), { fontSize: fs1 })}
  ${txt('TRUCK', cx, Math.round(H * 0.30) + Math.round(fs1 * 1.2), { fontSize: fs1 })}
  ${txt('MAP', cx, Math.round(H * 0.30) + Math.round(fs1 * 2.4), { fontSize: fs1 })}
  ${txt('Food Trucks', cx, Math.round(H * 0.82), { fontSize: fs2, fontWeight: 'normal', opacity: 0.8 })}
  ${txt('Near You', cx, Math.round(H * 0.82) + Math.round(fs2 * 1.3), { fontSize: fs2, fontWeight: 'normal', opacity: 0.8 })}
</svg>`;

  await sharp(Buffer.from(svg))
    .toFile(path.join(OUT_DIR, `watch-${suffix}.png`));
}

const IPAD_CONFIGS = [
  { key: 'APP_IPAD_PRO_3GEN_129', W: 2048, H: 2732, suffix: 'pro129' },
  { key: 'APP_IPAD_PRO_3GEN_11',  W: 1668, H: 2388, suffix: 'pro11'  },
];

const WATCH_CONFIGS = [
  { key: 'APP_WATCH_SERIES_4',  W: 368, H: 448, suffix: 'series4'  },
  { key: 'APP_WATCH_SERIES_7',  W: 396, H: 484, suffix: 'series7'  },
  { key: 'APP_WATCH_SERIES_10', W: 410, H: 502, suffix: 'series10' },
  { key: 'APP_WATCH_ULTRA',     W: 410, H: 502, suffix: 'ultra'    },
];

const CARDS = [
  { name: 'Taco Loco',    sub: 'Mexican  -  Open until 8 PM  -  0.3 mi' },
  { name: 'Smokin BBQ',   sub: 'BBQ  -  Open until 9 PM  -  0.5 mi' },
  { name: 'Fresh Garden', sub: 'Healthy  -  Open until 6 PM  -  0.7 mi' },
  { name: 'Burger Bros',  sub: 'Burgers  -  Open until 10 PM  -  1.1 mi' },
  { name: 'Seoul Kitchen',sub: 'Korean  -  Open until 9 PM  -  1.4 mi' },
];

async function main() {
  console.log('Generating iPad screenshots...');
  for (const c of IPAD_CONFIGS) {
    console.log(` ${c.key} (${c.W}x${c.H})...`);
    await makeIPadScreenshot(c.W, c.H, c.suffix,
      'Find Food Trucks', 'Near You',
      'Live map. Real-time locations.',
      CARDS);
    const meta = await sharp(path.join(OUT_DIR, `ipad-${c.suffix}.png`)).metadata();
    console.log(`   Done: ipad-${c.suffix}.png ${meta.width}x${meta.height}`);
  }

  console.log('\nGenerating Apple Watch screenshots...');
  for (const c of WATCH_CONFIGS) {
    console.log(` ${c.key} (${c.W}x${c.H})...`);
    await makeWatchScreenshot(c.W, c.H, c.suffix);
    const meta = await sharp(path.join(OUT_DIR, `watch-${c.suffix}.png`)).metadata();
    console.log(`   Done: watch-${c.suffix}.png ${meta.width}x${meta.height}`);
  }

  console.log('\nAll done. Files in:', OUT_DIR);
}

main().catch(err => { console.error(err); process.exit(1); });
