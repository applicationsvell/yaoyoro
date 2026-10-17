// 部品をまとめて1つのHTMLにする（Claudeのアーティファクト版：dist/yaoyorozu.html）
// アプリ版（ホーム画面に追加できる版）は build-app.js が、このしくみを使ってルートの index.html を作る
const fs = require('fs');
const path = require('path');
const SRC = __dirname, ROOT = path.join(__dirname, '..');
const PARTS = ['part-engine.js', 'part-net.js', 'part-fx.js', 'part-art.js', 'part-beast.js', 'part-ui.js', 'part-game.js'];
const S = f => fs.readFileSync(path.join(SRC, f), 'utf8');

function buildBody() {
  const cards = JSON.stringify(JSON.parse(S('cards.json')));
  const js = "(() => {\n'use strict';\n" + PARTS.map(S).join('\n') + "\nboot();\n})();";
  let html = S('template.html');
  html = html.replace('/*__CARDS__*/', () => cards.replace(/</g, '\\u003c'));
  html = html.replace('/*__SCRIPT__*/', () => js);
  return html;
}
module.exports = { buildBody, PARTS, ROOT };

if (require.main === module) {
  const html = buildBody();
  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'dist', 'yaoyorozu.html'), html);
  console.log('dist/yaoyorozu.html', html.length, 'bytes');
}
