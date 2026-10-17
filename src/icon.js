// アイコンを描いてPNGに書き出す（icons/ に入る）。漆の地に金の輪、五行の玉、まん中に「合」
//   node src/icon.js   （Playwright と Noto Serif CJK JP が必要）
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');

/* s=1 でふつう、maskable は中身を80%に縮めて、まわりは地の色で埋める */
function svg(scale) {
  const E = [['#5d8c63', -90], ['#c4513a', -18], ['#b8893c', 54], ['#aca596', 126], ['#4d70a9', 198]];
  const dots = E.map(([c, a]) => {
    const r = a * Math.PI / 180, x = 256 + Math.cos(r) * 196, y = 256 + Math.sin(r) * 196;
    return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="27" fill="#1a0f0c"/><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="20" fill="' + c + '" stroke="#e8d199" stroke-width="3"/>';
  }).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">' +
    '<defs><radialGradient id="bg" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#5a3022"/><stop offset=".55" stop-color="#2a1915"/><stop offset="1" stop-color="#120a08"/></radialGradient>' +
    '<linearGradient id="kin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e6b4"/><stop offset=".5" stop-color="#d9b56a"/><stop offset="1" stop-color="#9a7430"/></linearGradient></defs>' +
    '<rect width="512" height="512" fill="url(#bg)"/>' +
    '<g transform="translate(256 256) scale(' + scale + ') translate(-256 -256)">' +
    '<circle cx="256" cy="256" r="196" fill="none" stroke="url(#kin)" stroke-width="12"/>' +
    '<circle cx="256" cy="256" r="174" fill="none" stroke="#e8d199" stroke-opacity=".45" stroke-width="3"/>' +
    dots +
    '<text x="256" y="262" text-anchor="middle" dominant-baseline="central" font-family="Noto Serif CJK JP" font-weight="700" font-size="250" fill="#000" fill-opacity=".45" transform="translate(5 7)">合</text>' +
    '<text x="256" y="262" text-anchor="middle" dominant-baseline="central" font-family="Noto Serif CJK JP" font-weight="700" font-size="250" fill="url(#kin)">合</text>' +
    '</g></svg>';
}

(async () => {
  const out = path.join(ROOT, 'icons');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'icon.svg'), svg(1));
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 512, height: 512 } });
  const shot = async (scale, size, file) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent('<html><body style="margin:0;background:#120a08">' + svg(scale).replace('width="512" height="512"', 'width="' + size + '" height="' + size + '"') + '</body></html>');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(out, file), clip: { x: 0, y: 0, width: size, height: size } });
  };
  await shot(1, 512, 'icon-512.png');
  await shot(1, 192, 'icon-192.png');
  await shot(1, 180, 'apple-touch-icon.png');
  await shot(0.8, 512, 'maskable-512.png');
  await b.close();
  console.log('icons done');
})();
