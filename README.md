# ヤオヨロ合戦

式神と札で競う、五行の合戦。和風の対戦カードゲームです（ゴッドフィールドのような遊び方）。

## 遊ぶ

**https://applicationsvell.github.io/yaoyoro/**

- いまのアプリ版は「ひとりで練習」（CPUと対戦、2〜8人）が遊べます。オンライン対戦は準備中です。
- スマホの縦向き・横向き、パソコンのどれでも遊べます。

### ホーム画面に追加する（iPhone）

1. Safariで上のURLを開く
2. 下の「共有」ボタン →「ホーム画面に追加」
3. ホーム画面のアイコンから開くと、全画面のアプリとして動きます。一度開けば、電波がなくても練習できます

Androidは、Chromeで開いて右上のメニュー →「ホーム画面に追加」です。

## 遊び方（かんたんに）

- 番が来たら、手札の武器で相手を攻める・道具や術を使う・よろず屋で買う・おみくじを引く、のどれかをします
- 攻められたら守札で守ります。属性（木・火・土・金・水）の相性で、ダメージが1.2倍や半分になります
- 体力が0になると成仏。最後まで残った人（チーム）の勝ちです
- くわしくは、ゲームの中の「遊び方」に全部書いてあります

## 開発メモ

| ファイル | 中身 |
| --- | --- |
| `src/part-*.js` | ゲームの部品（ルール・通信・演出・札の絵・霊獣の絵・画面） |
| `src/template.html` | 画面の骨組みとCSS |
| `src/gen_cards.py` → `src/cards.json` | 札・式神・天候・霊獣のデータ（`cd src && python3 gen_cards.py` で作りなおす） |
| `src/build.js` | アーティファクト版を `dist/yaoyorozu.html` に作る（テストはこれを使う） |
| `src/build-app.js` | アプリ版の `index.html`・`manifest.webmanifest`・`sw.js` を作る |
| `src/icon.js` | アイコン（`icons/`）を描いて書き出す（Playwright と Noto Serif CJK JP を使う） |
| `test/` | `node test/sim.js`（CPUどうしの自動対戦）と、Playwrightの画面テスト（`python3 test/run_test.py` など） |

作りなおすとき：

```sh
node src/build.js && node src/build-app.js
```

アプリ版は `window.APP_MODE = true` で動き、オンライン対戦のボタンは押せない状態になります。
