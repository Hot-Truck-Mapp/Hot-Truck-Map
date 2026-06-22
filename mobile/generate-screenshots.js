/**
 * Generates App Store screenshots at 1320x2868 (iPhone 6.9")
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const W = 1320;
const H = 2868;
const ORANGE = '#FF6B35';
const WHITE = '#FFFFFF';

const OUT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const ICON_PATH = path.join(__dirname, 'assets', 'icon.png');
const SPLASH_PATH = path.join(__dirname, 'assets', 'splash.png');

// Escape text for SVG
function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Resize icon to given size, return Buffer
async function resizeIcon(size) {
  return sharp(ICON_PATH)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 107, b: 53, alpha: 0 } })
    .png()
    .toBuffer();
}

// Single text line SVG element
function txt(content, x, y, opts = {}) {
  const {
    fill = WHITE,
    fontSize = 72,
    fontWeight = 'bold',
    opacity = 1,
    anchor = 'middle',
  } = opts;
  return `<text x="${x}" y="${y}" font-family="Helvetica Neue, Arial, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}">${esc(content)}</text>`;
}

// Rounded rectangle
function rect(x, y, w, h, r, fill) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
}

// ── Screenshot 1: Hero / Splash ───────────────────────────────────────────────
async function makeScreenshot1() {
  console.log('Generating screenshot 1...');

  const splashH = Math.round(H * 0.62);
  const splashW = Math.round(splashH * (1284 / 2778));
  const splashBuf = await sharp(SPLASH_PATH)
    .resize(splashW, splashH, { fit: 'contain', background: { r: 255, g: 107, b: 53, alpha: 0 } })
    .png()
    .toBuffer();

  const splashLeft = Math.round((W - splashW) / 2);
  const splashTop = Math.round(H * 0.04);
  const captionY = splashTop + splashH + 90;

  const svgOverlay = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  ${txt('Find Food Trucks', W / 2, captionY, { fontSize: 92 })}
  ${txt('Near You - Instantly', W / 2, captionY + 115, { fontSize: 92 })}
  ${txt('Live map. Real-time locations.', W / 2, captionY + 255, { fontSize: 54, fontWeight: 'normal', opacity: 0.88 })}
  ${txt('No more guessing where your', W / 2, captionY + 335, { fontSize: 50, fontWeight: 'normal', opacity: 0.75 })}
  ${txt('favorite truck parked today.', W / 2, captionY + 405, { fontSize: 50, fontWeight: 'normal', opacity: 0.75 })}
</svg>`);

  await sharp({ create: { width: W, height: H, channels: 4, background: ORANGE } })
    .png()
    .composite([
      { input: splashBuf, top: splashTop, left: splashLeft },
      { input: svgOverlay, top: 0, left: 0 },
    ])
    .toFile(path.join(OUT_DIR, 'screenshot-1.png'));
  console.log('  Done: screenshot-1.png');
}

// ── Screenshot 2: Browse Menus ───────────────────────────────────────────────
async function makeScreenshot2() {
  console.log('Generating screenshot 2...');
  const iconSize = 260;
  const iconBuf = await resizeIcon(iconSize);
  const cx = W / 2;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${ORANGE}"/>
  ${txt('HOT TRUCK MAP', cx, 140, { fontSize: 44, opacity: 0.7 })}
  <circle cx="${cx}" cy="360" r="160" fill="rgba(255,255,255,0.15)"/>
  ${txt('Explore Menus', cx, 640, { fontSize: 98 })}
  ${txt('and Details', cx, 758, { fontSize: 98 })}
  ${txt('Browse full menus, hours,', cx, 878, { fontSize: 52, fontWeight: 'normal', opacity: 0.85 })}
  ${txt('contact info and photos.', cx, 950, { fontSize: 52, fontWeight: 'normal', opacity: 0.85 })}

  ${rect(80, 1020, W - 160, 170, 24, 'rgba(255,255,255,0.18)')}
  ${txt('Taco Loco', 140, 1100, { fontSize: 54, anchor: 'start' })}
  ${txt('Mexican  -  Open until 8 PM  -  0.3 mi', 140, 1162, { fontSize: 40, fontWeight: 'normal', opacity: 0.8, anchor: 'start' })}

  ${rect(80, 1220, W - 160, 170, 24, 'rgba(255,255,255,0.18)')}
  ${txt('Smokin BBQ', 140, 1300, { fontSize: 54, anchor: 'start' })}
  ${txt('BBQ  -  Open until 9 PM  -  0.5 mi', 140, 1362, { fontSize: 40, fontWeight: 'normal', opacity: 0.8, anchor: 'start' })}

  ${rect(80, 1420, W - 160, 170, 24, 'rgba(255,255,255,0.18)')}
  ${txt('Fresh Garden', 140, 1500, { fontSize: 54, anchor: 'start' })}
  ${txt('Healthy  -  Open until 6 PM  -  0.7 mi', 140, 1562, { fontSize: 40, fontWeight: 'normal', opacity: 0.8, anchor: 'start' })}

  ${rect(80, 1620, W - 160, 170, 24, 'rgba(255,255,255,0.18)')}
  ${txt('Burger Bros', 140, 1700, { fontSize: 54, anchor: 'start' })}
  ${txt('Burgers  -  Open until 10 PM  -  1.1 mi', 140, 1762, { fontSize: 40, fontWeight: 'normal', opacity: 0.8, anchor: 'start' })}

  ${rect(80, 1820, W - 160, 170, 24, 'rgba(255,255,255,0.18)')}
  ${txt('Seoul Kitchen', 140, 1900, { fontSize: 54, anchor: 'start' })}
  ${txt('Korean  -  Open until 9 PM  -  1.4 mi', 140, 1962, { fontSize: 40, fontWeight: 'normal', opacity: 0.8, anchor: 'start' })}

  ${rect(200, 2060, W - 400, 140, 70, 'rgba(255,255,255,0.25)')}
  ${txt('Order Pickup', cx, 2152, { fontSize: 60 })}

  ${txt('Download Free Today', cx, 2720, { fontSize: 50, opacity: 0.7, fontWeight: 'normal' })}
</svg>`;

  await sharp(Buffer.from(svg))
    .composite([
      { input: iconBuf, top: 200, left: Math.round((W - iconSize) / 2) },
    ])
    .toFile(path.join(OUT_DIR, 'screenshot-2.png'));
  console.log('  Done: screenshot-2.png');
}

// ── Screenshot 3: Alerts and Map ─────────────────────────────────────────────
async function makeScreenshot3() {
  console.log('Generating screenshot 3...');
  const iconSize = 260;
  const iconBuf = await resizeIcon(iconSize);
  const cx = W / 2;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${ORANGE}"/>
  ${txt('HOT TRUCK MAP', cx, 140, { fontSize: 44, opacity: 0.7 })}
  <circle cx="${cx}" cy="360" r="160" fill="rgba(255,255,255,0.15)"/>

  ${txt('Never Miss Your', cx, 630, { fontSize: 94 })}
  ${txt('Favorite Truck', cx, 744, { fontSize: 94 })}
  ${txt('Set alerts. Get notified the moment', cx, 864, { fontSize: 50, fontWeight: 'normal', opacity: 0.85 })}
  ${txt('they set up near you.', cx, 934, { fontSize: 50, fontWeight: 'normal', opacity: 0.85 })}

  ${rect(60, 1050, W - 120, 210, 28, 'rgba(255,255,255,0.22)')}
  ${txt('ALERT - Hot Truck Map', 120, 1122, { fontSize: 38, opacity: 0.75, anchor: 'start' })}
  ${txt('Taco Loco is 0.4 mi away!', 120, 1188, { fontSize: 52, anchor: 'start' })}
  ${txt('Open now until 8 PM  -  Tap to view', 120, 1240, { fontSize: 40, fontWeight: 'normal', opacity: 0.8, anchor: 'start' })}

  ${rect(60, 1295, W - 120, 840, 28, 'rgba(255,255,255,0.12)')}
  <line x1="60" y1="1505" x2="${W - 60}" y2="1505" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
  <line x1="60" y1="1715" x2="${W - 60}" y2="1715" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
  <line x1="60" y1="1925" x2="${W - 60}" y2="1925" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
  <line x1="340" y1="1295" x2="340" y2="2135" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
  <line x1="660" y1="1295" x2="660" y2="2135" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
  <line x1="980" y1="1295" x2="980" y2="2135" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
  ${txt('Live Map', cx, 1730, { fontSize: 56, fill: 'rgba(255,255,255,0.35)' })}
  <circle cx="420" cy="1610" r="30" fill="${WHITE}"/>
  ${txt('T', 420, 1622, { fontSize: 28, fill: ORANGE })}
  <circle cx="750" cy="1830" r="30" fill="${WHITE}"/>
  ${txt('B', 750, 1842, { fontSize: 28, fill: ORANGE })}
  <circle cx="900" cy="1520" r="30" fill="${WHITE}"/>
  ${txt('G', 900, 1532, { fontSize: 28, fill: ORANGE })}

  ${txt('Save your favorite trucks', cx, 2230, { fontSize: 48, fontWeight: 'normal', opacity: 0.9 })}
  ${txt('Book catering for your events', cx, 2300, { fontSize: 48, fontWeight: 'normal', opacity: 0.9 })}
  ${txt('Order pickup ahead of time', cx, 2370, { fontSize: 48, fontWeight: 'normal', opacity: 0.9 })}

  ${rect(200, 2490, W - 400, 140, 70, 'rgba(255,255,255,0.25)')}
  ${txt('Get Started Free', cx, 2582, { fontSize: 60 })}
  ${txt('Download Free Today', cx, 2730, { fontSize: 50, opacity: 0.7, fontWeight: 'normal' })}
</svg>`;

  await sharp(Buffer.from(svg))
    .composite([
      { input: iconBuf, top: 200, left: Math.round((W - iconSize) / 2) },
    ])
    .toFile(path.join(OUT_DIR, 'screenshot-3.png'));
  console.log('  Done: screenshot-3.png');
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Generating ${W}x${H} App Store screenshots...`);
  await makeScreenshot1();
  await makeScreenshot2();
  await makeScreenshot3();
  console.log('\nAll screenshots saved to:', OUT_DIR);
  for (const f of ['screenshot-1.png', 'screenshot-2.png', 'screenshot-3.png']) {
    const meta = await sharp(path.join(OUT_DIR, f)).metadata();
    console.log(` ${f}: ${meta.width}x${meta.height}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
