// ホーム画面に追加できるアプリ版（GitHub Pages）を作る：index.html・manifest.webmanifest・sw.js
//   node src/build-app.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildBody, ROOT } = require('./build.js');

const NAME = 'ヤオヨロ合戦';
const BG = '#120a08', THEME = '#1d1210';
const body = buildBody();
const VERSION = crypto.createHash('sha1').update(body).digest('hex').slice(0, 10);

const head = '<!doctype html><html lang="ja"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<meta name="theme-color" content="' + THEME + '">' +
  '<meta name="description" content="式神と札で競う、五行の合戦。和風の対戦カードゲーム">' +
  '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">' +
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">' +
  '<meta name="apple-mobile-web-app-title" content="' + NAME + '">' +
  '<link rel="manifest" href="manifest.webmanifest">' +
  '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">' +
  '<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">' +
  /* アーティファクトのときに外側が用意する枠（安全領域のすき間）と同じものをここで作る */
  '<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}' +
  'html{scroll-padding-top:env(safe-area-inset-top,0px);background:' + BG + '}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:' + BG + ';color:#ede3cf}' +
  'img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style>' +
  '<script>window.APP_MODE=true;</script>' +
  '</head><body>';
const tail = '<script>if("serviceWorker" in navigator){addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){});});}</script></body></html>';
fs.writeFileSync(path.join(ROOT, 'index.html'), head + body + tail);

const manifest = {
  name: NAME, short_name: NAME, lang: 'ja',
  description: '式神と札で競う、五行の合戦。和風の対戦カードゲーム',
  start_url: './', scope: './', display: 'standalone', orientation: 'any',
  background_color: BG, theme_color: THEME,
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
fs.writeFileSync(path.join(ROOT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');

const sw = fs.readFileSync(path.join(__dirname, 'sw.template.js'), 'utf8').replace('__VERSION__', VERSION);
fs.writeFileSync(path.join(ROOT, 'sw.js'), sw);
if (!fs.existsSync(path.join(ROOT, '.nojekyll'))) fs.writeFileSync(path.join(ROOT, '.nojekyll'), '');
console.log('index.html', (head + body + tail).length, 'bytes / sw', VERSION);
