/* =====================================================================
   ART — 札の絵（和モダン）。図形で1枚ずつ描き、<symbol> として1回だけ置いて <use> で使い回す
   絵の大きさは 100×124。左上には種類の印、右側（x>72）には名前の短冊が重なるので、主役は左〜まん中に描く
   ===================================================================== */
const INK = '#1c1714';
const SW = 1.15; /* 墨の線の太さ */
/* ---- 色の組み合わせ（背景） ---- */
const THEME = {
  none: { top: '#33466d', bot: '#141c33', disc: '#d9b45e', dop: .34, pat: 'kumo', pop: .1 },
  armor: { top: '#4d5d6b', bot: '#1c242c', disc: '#efe6cf', dop: .17, pat: 'kikko', pop: .13 },
  plus: { top: '#9a6720', bot: '#3a2109', disc: '#f6d57c', dop: .4, pat: 'ray', pop: .16 },
  spell: { top: '#523d77', bot: '#19122c', disc: '#f1e5c2', dop: .3, pat: 'hoshi', pop: .55 },
  item: { top: '#f1e5c6', bot: '#c9a46a', disc: '#c8452e', dop: .2, pat: 'kumo', pop: .3, light: true },
  summon: { top: '#8e3c5f', bot: '#2a1020', disc: '#f2c47c', dop: .32, pat: 'kumo', pop: .14 },
  '火': { top: '#c9553a', bot: '#521409', disc: '#f7c45e', dop: .4, pat: 'hono', pop: .17 },
  '水': { top: '#3f66a8', bot: '#111f44', disc: '#eef3f8', dop: .2, pat: 'seigaiha', pop: .22 },
  '木': { top: '#558a5c', bot: '#1a3621', disc: '#f0e2a8', dop: .3, pat: 'asanoha', pop: .16 },
  '土': { top: '#c29243', bot: '#4f3410', disc: '#fbe9b2', dop: .36, pat: 'kikko', pop: .17 },
  '金': { top: '#9ca3af', bot: '#30343e', disc: '#ffffff', dop: .3, pat: 'shippo', pop: .2 },
};
/* ---- 材質の色（グラデーションのid） ---- */
const MAT = {
  steel: ['#ffffff', '#c9d0d8', '#8a939e'], gold: ['#fff0b8', '#e2bd62', '#9c7426'], wood: ['#d39b5d', '#a8713b', '#6a4220'],
  dwood: ['#8d5a33', '#5e3a1f', '#3a2312'], red: ['#e0644a', '#b5352a', '#6e1a12'], iron: ['#7c8590', '#4a515b', '#262a31'],
  copper: ['#f6c6a0', '#c87a4c', '#7c3f20'], silver: ['#ffffff', '#dfe3e8', '#9aa1aa'], navy: ['#4b5a86', '#2b3456', '#151a30'],
  straw: ['#f1d98e', '#d1ac5a', '#8e6d2c'], paper: ['#fffdf6', '#f1e7d0', '#cdbd99'], jade: ['#9be0b8', '#3f9a6a', '#1b5038'],
  rose: ['#ffd6dc', '#ef8fa3', '#b24a63'], stone: ['#c9c2b4', '#958c7d', '#5c5548'], sky: ['#e8f4ff', '#9cc6ef', '#4a7fbf'],
  fire: ['#fff3b0', '#f6a33a', '#d0381c'], ice: ['#ffffff', '#cfeaf7', '#8fc2de'], leaf: ['#b6dc8a', '#5e9b4a', '#2a5a2a'],
  purple: ['#c7a6e6', '#7b52a8', '#3c2462'], clay: ['#d7a072', '#a5643c', '#5c321a'], bamboo: ['#cfe39a', '#8fb556', '#4b6e2a'],
  blue: ['#bcd4f5', '#5a83c8', '#24407a'], white: ['#ffffff', '#f3efe6', '#cfc6b4'], black: ['#4a4450', '#2a2530', '#121014'],
};
const gid = m => 'url(#mt-' + m + ')';
/* ---- 小さな道具 ---- */
const f1 = n => (Math.round(n * 10) / 10);
const at = (x, y, r, s, inner) => '<g transform="translate(' + f1(x) + ' ' + f1(y) + ')' + (r ? ' rotate(' + r + ')' : '') + (s && s !== 1 ? ' scale(' + s + ')' : '') + '">' + inner + '</g>';
const P = (d, fill, ex) => '<path d="' + d + '" fill="' + (fill || 'none') + '" stroke="' + INK + '" stroke-width="' + SW + '" stroke-linejoin="round" stroke-linecap="round"' + (ex || '') + '/>';
const Pn = (d, fill, ex) => '<path d="' + d + '" fill="' + fill + '"' + (ex || '') + '/>';
const L = (d, col, w, ex) => '<path d="' + d + '" fill="none" stroke="' + (col || INK) + '" stroke-width="' + (w || SW) + '" stroke-linecap="round" stroke-linejoin="round"' + (ex || '') + '/>';
const C = (x, y, r, fill, ex) => '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(r) + '" fill="' + (fill || 'none') + '" stroke="' + INK + '" stroke-width="' + SW + '"' + (ex || '') + '/>';
const Cn = (x, y, r, fill, ex) => '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(r) + '" fill="' + fill + '"' + (ex || '') + '/>';
const E = (x, y, rx, ry, fill, ex) => '<ellipse cx="' + f1(x) + '" cy="' + f1(y) + '" rx="' + f1(rx) + '" ry="' + f1(ry) + '" fill="' + (fill || 'none') + '" stroke="' + INK + '" stroke-width="' + SW + '"' + (ex || '') + '/>';
const En = (x, y, rx, ry, fill, ex) => '<ellipse cx="' + f1(x) + '" cy="' + f1(y) + '" rx="' + f1(rx) + '" ry="' + f1(ry) + '" fill="' + fill + '"' + (ex || '') + '/>';
const R = (x, y, w, h, rx, fill, ex) => '<rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) + '" rx="' + f1(rx || 0) + '" fill="' + (fill || 'none') + '" stroke="' + INK + '" stroke-width="' + SW + '"' + (ex || '') + '/>';
const Rn = (x, y, w, h, rx, fill, ex) => '<rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) + '" rx="' + f1(rx || 0) + '" fill="' + fill + '"' + (ex || '') + '/>';
const op = o => ' opacity="' + o + '"';
const T = (x, y, s, txt, fill, ex) => '<text x="' + f1(x) + '" y="' + f1(y) + '" font-size="' + s + '" text-anchor="middle" font-family="Shippori Mincho B1, Hiragino Mincho ProN, Yu Mincho, serif" font-weight="800" fill="' + (fill || INK) + '"' + (ex || '') + '>' + txt + '</text>';
const rng = seed => { let t = seed >>> 0; return () => { t = (t + 0x6D2B79F5) | 0; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
const shadow = (x, y, rx, o) => En(x, y, rx, rx * 0.22, '#000', op(o == null ? .28 : o));

/* ---- 背景：グラデーション・大きな円（日輪・月）・模様・金の霞 ---- */
function artBg(th, o) {
  o = o || {};
  const t = THEME[th] || THEME.none;
  const dx = o.dx == null ? 40 : o.dx, dy = o.dy == null ? 46 : o.dy, dr = o.dr || 31;
  let s = Rn(0, 0, 100, 124, 0, 'url(#bg-' + th + ')');
  if (t.pat === 'ray') s += '<g' + op(t.pop) + '>' + Array.from({ length: 18 }, (_, i) => { const a = i * Math.PI / 9; return Pn('M' + dx + ' ' + dy + 'L' + f1(dx + Math.cos(a) * 140) + ' ' + f1(dy + Math.sin(a) * 140) + 'L' + f1(dx + Math.cos(a + .09) * 140) + ' ' + f1(dy + Math.sin(a + .09) * 140) + 'Z', '#fff4cc'); }).join('') + '</g>';
  else if (t.pat !== 'kumo') s += Rn(0, 0, 100, 124, 0, 'url(#pt-' + t.pat + ')', op(t.pop));
  if (!o.nodisc) s += Cn(dx, dy, dr, 'url(#disc-' + th + ')', op(t.dop * 2.2 > 1 ? 1 : t.dop * 2.2));
  if (!o.nomist) s += mist(o.my || 96, t.light ? '#b88a3e' : '#d8b45e', t.light ? .35 : .42) + mist(o.my2 || 20, t.light ? '#b88a3e' : '#d8b45e', t.light ? .22 : .26, true);
  return s;
}
/* 金の霞（すやり霞） */
function mist(y, col, o, flip) {
  const a = flip ? 'M58 ' + y + 'h30a5 5 0 0 1 0 10h-44a4 4 0 0 1 0-8h14a4 4 0 0 1 0-2z' : 'M-4 ' + y + 'h46a5 5 0 0 1 0 10h-12a4 4 0 0 1 0 8h-40z';
  return Pn(a, col, op(o));
}

/* ---- 部品 ---- */
/* 刀：tip を上にした向き。L 刃の長さ、W 幅、c 反り、H 柄の長さ */
function katana(o) {
  const Lb = o.L || 70, W = o.W || 6.4, c = o.c == null ? 5 : o.c, H = o.H || 22;
  const blade = o.blade || 'steel', ito = o.ito || '#2b2846', tsuba = o.tsuba || 'iron', hab = o.hab || 'gold';
  let s = '';
  if (o.glow) s += Pn('M' + (-W * 1.8) + ' 2C' + (-W * 2.6) + ' ' + (-Lb * .5) + ' ' + (c - W) + ' ' + (-Lb - 8) + ' ' + c + ' ' + (-Lb - 10) + 'C' + (c + W * 1.6) + ' ' + (-Lb * .6) + ' ' + (W * 2.6) + ' ' + (-Lb * .3) + ' ' + (W * 1.8) + ' 2Z', o.glow, op(.45));
  const tipX = c * 1.05;
  const bl = 'M' + (-W / 2) + ' 0C' + f1(-W / 2 + c * .15) + ' ' + f1(-Lb * .45) + ' ' + f1(c * .55 - W * .5) + ' ' + f1(-Lb * .82) + ' ' + f1(tipX - W * .3) + ' ' + f1(-Lb) +
    'L' + f1(tipX + W * .25) + ' ' + f1(-Lb + W * 1.3) + 'C' + f1(c * .7 + W * .5) + ' ' + f1(-Lb * .78) + ' ' + f1(W / 2 + c * .2) + ' ' + f1(-Lb * .42) + ' ' + (W / 2) + ' 0Z';
  s += P(bl, gid(blade));
  /* 刃文（はもん） */
  const n = Math.max(4, Math.round(Lb / 9));
  let hm = 'M' + f1(-W / 2 + 1.3) + ' -3';
  for (let i = 1; i <= n; i++) { const tt = i / n, y = -3 - (Lb - 8) * tt, x = -W / 2 + 1.3 + c * .55 * Math.pow(tt, 1.6) + (i % 2 ? 1.1 : 0); hm += 'L' + f1(x) + ' ' + f1(y); }
  s += L(hm, '#ffffff', .8, op(.85));
  s += L('M' + f1(W * .12) + ' -2C' + f1(W * .15 + c * .2) + ' ' + f1(-Lb * .45) + ' ' + f1(c * .6) + ' ' + f1(-Lb * .8) + ' ' + f1(tipX - W * .05) + ' ' + f1(-Lb + W * 1.1), INK, .45, op(.5));
  /* はばき・鍔・柄 */
  s += R(-W / 2 - .3, -4.2, W + .6, 4.4, .6, gid(hab));
  if (o.tsubaShape === 'flower') s += P(flowerPath(0, 1.6, W * 1.6 + 2.4, 5), gid(tsuba)) + C(0, 1.6, 1.4, INK);
  else s += E(0, 1.6, W * 1.45 + 2, 2.9, gid(tsuba));
  s += R(-W * .48, 4.4, W * .96, H, W * .3, ito);
  for (let y = 7; y < H + 1; y += 4.2) s += Pn('M0 ' + f1(y + 4.4 - 2.1) + 'l' + f1(W * .33) + ' 2.1l' + f1(-W * .33) + ' 2.1l' + f1(-W * .33) + ' -2.1z', o.itoHi || '#e8dcc0', op(.92));
  s += R(-W * .55, 4.4 + H - 1, W * 1.1, 3.4, 1.2, gid(o.kashira || hab));
  if (o.tassel) s += L('M0 ' + f1(H + 7.8) + 'q2 6 -1 12', o.tassel, 1.8) + L('M0 ' + f1(H + 7.8) + 'q-3 5 0 10', o.tassel, 1.4);
  return s;
}
function flowerPath(cx, cy, r, k) {
  let d = '';
  for (let i = 0; i < k; i++) {
    const a0 = (i / k) * Math.PI * 2 - Math.PI / 2, a1 = ((i + .5) / k) * Math.PI * 2 - Math.PI / 2, a2 = ((i + 1) / k) * Math.PI * 2 - Math.PI / 2;
    const p0 = [cx + Math.cos(a0) * r * .62, cy + Math.sin(a0) * r * .62], p1 = [cx + Math.cos(a1) * r * 1.15, cy + Math.sin(a1) * r * 1.15], p2 = [cx + Math.cos(a2) * r * .62, cy + Math.sin(a2) * r * .62];
    d += (i ? 'L' : 'M') + f1(p0[0]) + ' ' + f1(p0[1]) + 'Q' + f1(p1[0]) + ' ' + f1(p1[1]) + ' ' + f1(p2[0]) + ' ' + f1(p2[1]);
  }
  return d + 'Z';
}
/* 槍・薙刀などの長柄。head は穂先の形。上向き、原点は穂先の根元 */
function pole(o) {
  const len = o.len || 80, w = o.w || 3.4, mat = o.mat || 'red';
  let s = R(-w / 2, 0, w, len, w / 2, gid(mat));
  if (o.bands) for (let y = 8; y < len - 4; y += o.bands) s += Rn(-w / 2, y, w, 1.2, 0, INK, op(.55));
  s += R(-w / 2 - .6, len - 4, w + 1.2, 5, 1, gid('gold'));
  return s;
}
function spearHead(o) {
  const h = o.h || 22, w = o.w || 6, mat = o.mat || 'steel';
  let s = P('M0 ' + (-h) + 'C' + (w * .9) + ' ' + (-h * .55) + ' ' + (w * .6) + ' ' + (-h * .15) + ' ' + (w * .3) + ' 0L' + (-w * .3) + ' 0C' + (-w * .6) + ' ' + (-h * .15) + ' ' + (-w * .9) + ' ' + (-h * .55) + ' 0 ' + (-h) + 'Z', gid(mat));
  s += L('M0 ' + (-h + 2) + 'L0 -1', INK, .5, op(.6));
  s += R(-2.6, -.5, 5.2, 4.5, 1, gid('gold'));
  return s;
}
/* 矢：上向き、原点は矢じり */
function arrow(o) {
  o = o || {};
  const len = o.len || 56;
  let s = L('M0 4L0 ' + len, o.shaft || '#c99a55', 2.4) + L('M0 4L0 ' + len, INK, .5, op(.5));
  s += P('M0 -3L3 5L0 3.6L-3 5Z', gid(o.head || 'steel'));
  s += P('M0 ' + (len - 13) + 'l-4 3v9l4 -3z', o.fl || '#f3ead6') + P('M0 ' + (len - 13) + 'l4 3v9l-4 -3z', o.fl2 || '#c8452e');
  return s;
}
/* 炎（上向き）。x,y は根元、h 高さ */
function flame(x, y, h, o) {
  o = o || {};
  const w = h * (o.wr || .5);
  const outer = 'M' + x + ' ' + y + 'C' + f1(x - w) + ' ' + f1(y - h * .1) + ' ' + f1(x - w * 1.05) + ' ' + f1(y - h * .55) + ' ' + f1(x - w * .35) + ' ' + f1(y - h * .78) +
    'C' + f1(x - w * .35) + ' ' + f1(y - h * .58) + ' ' + f1(x - w * .1) + ' ' + f1(y - h * .52) + ' ' + f1(x + w * .05) + ' ' + f1(y - h * .62) +
    'C' + f1(x - w * .05) + ' ' + f1(y - h * .8) + ' ' + f1(x + w * .15) + ' ' + f1(y - h * .92) + ' ' + f1(x + w * .2) + ' ' + f1(y - h) +
    'C' + f1(x + w * .55) + ' ' + f1(y - h * .78) + ' ' + f1(x + w * 1.1) + ' ' + f1(y - h * .45) + ' ' + f1(x + w * .85) + ' ' + f1(y - h * .15) +
    'C' + f1(x + w * .7) + ' ' + f1(y) + ' ' + f1(x + w * .2) + ' ' + y + ' ' + x + ' ' + y + 'Z';
  let s = P(outer, o.fill || gid('fire'), o.noink ? ' stroke="none"' : '');
  if (!o.noCore) s += Pn('M' + x + ' ' + f1(y - 1) + 'C' + f1(x - w * .45) + ' ' + f1(y - h * .1) + ' ' + f1(x - w * .4) + ' ' + f1(y - h * .38) + ' ' + f1(x - w * .05) + ' ' + f1(y - h * .5) + 'C' + f1(x + w * .05) + ' ' + f1(y - h * .32) + ' ' + f1(x + w * .45) + ' ' + f1(y - h * .28) + ' ' + f1(x + w * .35) + ' ' + f1(y - h * .1) + 'C' + f1(x + w * .25) + ' ' + y + ' ' + x + ' ' + y + ' ' + x + ' ' + f1(y - 1) + 'Z', o.core || '#fff6c8', op(.9));
  return s;
}
/* 波頭（北斎ふう）。x,y は左下、s は大きさ */
function waveCrest(x, y, s, o) {
  o = o || {};
  let d = 'M' + x + ' ' + y + 'C' + f1(x + s * .1) + ' ' + f1(y - s * .55) + ' ' + f1(x + s * .5) + ' ' + f1(y - s * 1.05) + ' ' + f1(x + s * .95) + ' ' + f1(y - s * .9) +
    'C' + f1(x + s * 1.2) + ' ' + f1(y - s * .82) + ' ' + f1(x + s * 1.2) + ' ' + f1(y - s * .55) + ' ' + f1(x + s * 1.02) + ' ' + f1(y - s * .5) +
    'C' + f1(x + s * .9) + ' ' + f1(y - s * .62) + ' ' + f1(x + s * .7) + ' ' + f1(y - s * .6) + ' ' + f1(x + s * .62) + ' ' + f1(y - s * .45) +
    'C' + f1(x + s * .55) + ' ' + f1(y - s * .25) + ' ' + f1(x + s * .75) + ' ' + f1(y - s * .05) + ' ' + f1(x + s * 1.1) + ' ' + y + 'Z';
  let out = P(d, o.fill || gid('blue'));
  /* しぶきの爪 */
  for (let i = 0; i < 5; i++) { const px = x + s * (.98 + i * .02), py = y - s * (.86 - i * .08); out += Cn(px + s * .06, py, s * .045, '#fff'); }
  out += L('M' + f1(x + s * .2) + ' ' + f1(y - s * .35) + 'C' + f1(x + s * .35) + ' ' + f1(y - s * .7) + ' ' + f1(x + s * .6) + ' ' + f1(y - s * .85) + ' ' + f1(x + s * .85) + ' ' + f1(y - s * .82), '#fff', .9, op(.8));
  return out;
}
/* お札：縦長の紙に朱の印と墨の字 */
function ofuda(x, y, w, h, o) {
  o = o || {};
  let s = shadow(x + w / 2, y + h + 2, w * .7);
  s += R(x, y, w, h, 1, gid('paper'));
  s += Rn(x + 1.6, y + 1.6, w - 3.2, h - 3.2, .6, 'none', ' stroke="' + (o.line || '#b5352a') + '" stroke-width=".8"');
  if (o.char) s += T(x + w / 2, y + h * .36, w * .55, o.char, INK);
  const lines = o.lines == null ? 3 : o.lines;
  for (let i = 0; i < lines; i++) s += L('M' + f1(x + w * .5) + ' ' + f1(y + h * (o.char ? .48 : .2) + i * h * .1) + 'q' + f1(w * .12) + ' ' + f1(h * .03) + ' 0 ' + f1(h * .07), INK, 1.1, op(.85));
  s += R(x + w * .27, y + h * .74, w * .46, w * .46, .8, '#c8452e') + T(x + w / 2, y + h * .74 + w * .36, w * .3, o.stamp || '封', '#fff4e6');
  return s;
}
/* 小判 */
function koban(x, y, s, r) { return at(x, y, r || 0, s, E(0, 0, 6, 9, gid('gold')) + L('M-3 -5h6M-3 -2.5h6M-3 2.5h6M-3 5h6', '#9c7426', .6) + En(0, 0, 2.2, 2.6, '#c9a24f') ); }
/* 穴あき銭 */
function zeni(x, y, r) { return C(x, y, r, gid('copper')) + R(x - r * .3, y - r * .3, r * .6, r * .6, 0, '#5a2e16'); }
/* 雲（瑞雲） */
function cloud(x, y, s, col, o) {
  const d = 'M' + x + ' ' + y + 'c' + f1(-6 * s) + ' 0 ' + f1(-8 * s) + ' ' + f1(-7 * s) + ' ' + f1(-2 * s) + ' ' + f1(-8 * s) + 'c' + f1(1 * s) + ' ' + f1(-6 * s) + ' ' + f1(9 * s) + ' ' + f1(-7 * s) + ' ' + f1(11 * s) + ' ' + f1(-2 * s) +
    'c' + f1(4 * s) + ' ' + f1(-4 * s) + ' ' + f1(11 * s) + ' ' + f1(-1 * s) + ' ' + f1(10 * s) + ' ' + f1(4 * s) + 'c' + f1(5 * s) + ' ' + f1(0) + ' ' + f1(6 * s) + ' ' + f1(6 * s) + ' ' + f1(1 * s) + ' ' + f1(6 * s) + 'z';
  let out = P(d, col || '#f3ead6', o || '');
  out += L('M' + f1(x + 1 * s) + ' ' + f1(y - 3 * s) + 'c' + f1(2 * s) + ' ' + f1(-2.5 * s) + ' ' + f1(5 * s) + ' ' + f1(-2.5 * s) + ' ' + f1(6 * s) + ' ' + f1(-.5 * s), INK, .6, op(.5));
  return out;
}
/* 光の線（後光） */
function rays(x, y, r1, r2, n, col, o, w) {
  let s = '';
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; s += L('M' + f1(x + Math.cos(a) * r1) + ' ' + f1(y + Math.sin(a) * r1) + 'L' + f1(x + Math.cos(a) * r2) + ' ' + f1(y + Math.sin(a) * r2), col, w || 1.4, op(o)); }
  return s;
}
/* 火の粉・光のつぶ */
function sparks(seed, n, x0, y0, w, h, col, rmax) {
  const r = rng(seed); let s = '';
  for (let i = 0; i < n; i++) { const x = x0 + r() * w, y = y0 + r() * h, rr = .6 + r() * (rmax || 1.6); s += Pn('M' + f1(x) + ' ' + f1(y - rr * 2) + 'L' + f1(x + rr * .6) + ' ' + f1(y) + 'L' + f1(x) + ' ' + f1(y + rr * 2) + 'L' + f1(x - rr * .6) + ' ' + f1(y) + 'Z', col, op(.6 + r() * .4)); }
  return s;
}
/* 風の渦線 */
function wind(x, y, s, col, w) { return L('M' + x + ' ' + y + 'c' + f1(10 * s) + ' ' + f1(-1 * s) + ' ' + f1(22 * s) + ' ' + f1(-2 * s) + ' ' + f1(26 * s) + ' ' + f1(-8 * s) + 'c' + f1(2 * s) + ' ' + f1(-4 * s) + ' ' + f1(-3 * s) + ' ' + f1(-8 * s) + ' ' + f1(-6 * s) + ' ' + f1(-4 * s) + 'c' + f1(-2 * s) + ' ' + f1(2 * s) + ' ' + f1(0) + ' ' + f1(5 * s) + ' ' + f1(3 * s) + ' ' + f1(4 * s), col || '#f3ead6', w || 1.6); }
/* 家紋ふうの丸紋（盾などに） */
function mon(x, y, r, col) { return C(x, y, r, col || '#f3ead6') + P(flowerPath(x, y, r * .62, 5), '#c8452e', ' stroke-width=".7"') + Cn(x, y, r * .18, '#f3d27a'); }
/* 縄（しめ縄） */
function rope(x1, y1, x2, y2, th) {
  let s = L('M' + x1 + ' ' + y1 + 'Q' + f1((x1 + x2) / 2) + ' ' + f1(Math.max(y1, y2) + 8) + ' ' + x2 + ' ' + y2, '#e7c97a', th || 5) + L('M' + x1 + ' ' + y1 + 'Q' + f1((x1 + x2) / 2) + ' ' + f1(Math.max(y1, y2) + 8) + ' ' + x2 + ' ' + y2, INK, .6, ' stroke-dasharray="2 2.4"');
  return s;
}
/* 紙垂（しで） */
function shide(x, y, s) { return P('M' + x + ' ' + y + 'h' + 4 * s + 'v' + 4 * s + 'h' + -2.4 * s + 'v' + 4 * s + 'h' + 2.4 * s + 'v' + 4 * s + 'h' + -2.4 * s + 'v' + 4 * s, '#fffdf6'); }
/* 桜の花びら */
function petal(x, y, s, r, col) { return at(x, y, r || 0, s, Pn('M0 0C-3 -2 -3 -6 0 -8C3 -6 3 -2 0 0Z', col || '#f6c3cf') + Pn('M0 -8l-.8 -1.2.8.5.8-.5z', col || '#f6c3cf')); }
function sakura(x, y, s, col) { let p = ''; for (let i = 0; i < 5; i++) p += at(0, 0, i * 72, 1, Pn('M0 0C-3.2 -2.4 -3.4 -6.8 -1 -8.6L0 -7.6L1 -8.6C3.4 -6.8 3.2 -2.4 0 0Z', col || '#f7cbd5', ' stroke="' + INK + '" stroke-width=".5"')); return at(x, y, 0, s, p + Cn(0, 0, 1.4, '#e8a33c')); }
/* 麻の葉の星（小さな飾り） */
function star4(x, y, r, col) { return Pn('M' + x + ' ' + (y - r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x - r) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y - r) + 'Z', col || '#fff'); }

/* ---- 共通の飾り：定義（グラデーション・模様） ---- */
function artDefs() {
  let d = '';
  Object.entries(THEME).forEach(([k, t]) => {
    const id = /[^\x00-\x7f]/.test(k) ? { '火': 'ka', '水': 'sui', '木': 'moku', '土': 'do', '金': 'kin' }[k] : k;
    d += '<linearGradient id="bg-' + k + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + t.top + '"/><stop offset="1" stop-color="' + t.bot + '"/></linearGradient>';
    d += '<radialGradient id="disc-' + k + '" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="' + t.disc + '"/><stop offset=".75" stop-color="' + t.disc + '" stop-opacity=".55"/><stop offset="1" stop-color="' + t.disc + '" stop-opacity="0"/></radialGradient>';
    void id;
  });
  Object.entries(MAT).forEach(([k, c]) => {
    d += '<linearGradient id="mt-' + k + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset=".5" stop-color="' + c[1] + '"/><stop offset="1" stop-color="' + c[2] + '"/></linearGradient>';
  });
  /* 模様 */
  d += '<pattern id="pt-seigaiha" width="16" height="8" patternUnits="userSpaceOnUse">' + [0, 8, 16].map(x => [7, 5, 3].map(r => '<path d="M' + (x - r) + ' 8a' + r + ' ' + r + ' 0 0 1 ' + (2 * r) + ' 0" fill="none" stroke="#fff" stroke-width=".7"/>').join('')).join('') + [4, 12].map(x => [7, 5, 3].map(r => '<path d="M' + (x - r) + ' 4a' + r + ' ' + r + ' 0 0 1 ' + (2 * r) + ' 0" fill="none" stroke="#fff" stroke-width=".7"/>').join('')).join('') + '</pattern>';
  d += '<pattern id="pt-seigaiha-dk" width="12" height="6" patternUnits="userSpaceOnUse">' + [0, 6, 12].map(x => [5, 3.5, 2].map(r => '<path d="M' + (x - r) + ' 6a' + r + ' ' + r + ' 0 0 1 ' + (2 * r) + ' 0" fill="none" stroke="#2b3f6b" stroke-width=".6"/>').join('')).join('') + [3, 9].map(x => [5, 3.5, 2].map(r => '<path d="M' + (x - r) + ' 3a' + r + ' ' + r + ' 0 0 1 ' + (2 * r) + ' 0" fill="none" stroke="#2b3f6b" stroke-width=".6"/>').join('')).join('') + '</pattern>';
  d += '<pattern id="pt-asanoha" width="12" height="20.78" patternUnits="userSpaceOnUse"><path d="M6 0V20.78M0 3.46L12 17.32M12 3.46L0 17.32M0 0L6 3.46 12 0M0 20.78L6 17.32 12 20.78M0 10.39H12" fill="none" stroke="#fff" stroke-width=".55"/></pattern>';
  d += '<pattern id="pt-kikko" width="12" height="20.78" patternUnits="userSpaceOnUse"><path d="M3 0L9 0L12 5.2L9 10.39L3 10.39L0 5.2ZM9 10.39L12 15.59M3 10.39L0 15.59M0 15.59L3 20.78M12 15.59L9 20.78" fill="none" stroke="#fff" stroke-width=".7"/></pattern>';
  d += '<pattern id="pt-shippo" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="6" fill="none" stroke="#fff" stroke-width=".6"/><circle cx="12" cy="0" r="6" fill="none" stroke="#fff" stroke-width=".6"/><circle cx="0" cy="12" r="6" fill="none" stroke="#fff" stroke-width=".6"/><circle cx="12" cy="12" r="6" fill="none" stroke="#fff" stroke-width=".6"/><circle cx="6" cy="6" r="6" fill="none" stroke="#fff" stroke-width=".6"/></pattern>';
  d += '<pattern id="pt-hono" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M2 14C1 10 5 9 4 5C7 8 6 10 8 12M9 7C8 4 11 3 10 0" fill="none" stroke="#ffe0a0" stroke-width=".7"/></pattern>';
  d += '<pattern id="pt-hoshi" width="23" height="19" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r=".6" fill="#fff"/><circle cx="15" cy="9" r=".45" fill="#fff"/><circle cx="9" cy="15" r=".7" fill="#ffe9b0"/><circle cx="20" cy="17" r=".4" fill="#fff"/></pattern>';
  d += '<pattern id="pt-chain" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.7" fill="none" stroke="#e7ecf2" stroke-width=".6"/></pattern>';
  d += '<pattern id="pt-asa" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6L6 0" stroke="#000" stroke-width=".5" opacity=".25"/></pattern>';
  return d;
}

/* 季節のあしらい（刀などの背景に）：紅葉・桜・梅・竹・波・雲・雪・すすき */
function accent(kind) {
  switch (kind) {
    case 'momiji': return [[14, 82, 20, 1], [24, 100, -30, .8], [62, 94, 60, .9], [10, 58, 10, .7]].map(([x, y, r, k]) => at(x, y, r, k, momiji())).join('');
    case 'sakura': return sakura(14, 84, 1.3) + sakura(60, 98, 1) + [[24, 66, 30], [52, 80, -20], [12, 104, 60], [66, 70, 10]].map(([x, y, r]) => petal(x, y, 1.1, r)).join('');
    case 'ume': return L('M0 96C10 92 16 84 22 76M14 88C20 90 26 88 30 84', '#3a2312', 2.2) + [[22, 76], [30, 84], [10, 92]].map(([x, y]) => sakura(x, y, .9, '#fbe4ea').replace(/#e8a33c/, '#c8452e')).join('');
    case 'take': return at(8, 108, -8, 1, L('M0 0V-70', '#4b6e2a', 3) + L('M-1.5 -24h3M-1.5 -50h3', INK, .8)) + [[8, 60, -40], [8, 64, -70], [8, 38, -30], [8, 42, -60]].map(([x, y, r]) => at(x, y, r, 1, P('M0 0C4 -2 12 -2 18 0C12 2 4 2 0 0Z', gid('bamboo')))).join('');
    case 'nami': return Pn('M0 110C10 104 18 104 26 110C34 104 42 104 50 110C58 104 66 104 74 110C82 104 90 104 100 110V124H0Z', '#2b4a86') + L('M0 110C10 104 18 104 26 110C34 104 42 104 50 110C58 104 66 104 74 110C82 104 90 104 100 110', '#cfe4ff', 1) + L('M6 116C14 112 20 112 26 116M34 116C42 112 48 112 54 116M62 116C70 112 76 112 82 116', '#cfe4ff', .7, op(.7));
    case 'kumo': return cloud(6, 70, .9, '#efe6cf') + cloud(50, 98, .8, '#efe6cf');
    case 'yuki': return sparks(61, 26, 4, 8, 70, 104, '#ffffff', 1.4) + Cn(14, 90, 2, '#fff') + Cn(60, 72, 1.6, '#fff') + Cn(22, 50, 1.4, '#fff');
    case 'susuki': return [[10, 112, -14], [16, 112, -4], [22, 112, 8]].map(([x, y, r]) => at(x, y, r, 1, L('M0 0C0 -20 2 -36 6 -46', '#c9a24f', 1.2) + P('M6 -46C10 -40 10 -32 8 -26C6 -32 5 -38 6 -46Z', '#efe0b0'))).join('');
  }
  return '';
}
function momiji() { let d = ''; for (let i = 0; i < 7; i++) { const a = (-90 + (i - 3) * 30) * Math.PI / 180, r = i === 3 ? 7 : i === 0 || i === 6 ? 4.4 : 6; d += 'L' + f1(Math.cos(a) * r) + ' ' + f1(Math.sin(a) * r) + 'L' + f1(Math.cos(a + .26) * r * .4) + ' ' + f1(Math.sin(a + .26) * r * .4); } return P('M0 0' + d + 'Z', '#d9502f', ' stroke-width=".6"') + L('M0 0l0 5', '#7a2a14', .8); }

/* =====================================================================
   1枚ずつの絵
   ===================================================================== */
const ART = {};
/* ---- 武器（属性なし）。背景は藍の夜に金の月 ---- */
const swordScene = (th, o, extra) => artBg(th, { dx: 44, dy: 40 }) + (extra && extra.back || '') + shadow(42, 116, 16) + at(o.x || 44, o.y || 92, o.r == null ? 8 : o.r, o.s || 1, katana(o)) + (extra && extra.front || '');
ART.shuto = () => artBg('none', { dx: 40, dy: 46 }) + shadow(40, 114, 18) +
  L('M10 30C24 26 40 30 52 40', '#f3ead6', 1.6, op(.8)) + L('M6 42C22 38 38 42 50 50', '#d8b45e', 1.2, op(.7)) + L('M8 54C20 52 30 54 42 60', '#f3ead6', 1, op(.6)) +
  at(46, 78, -38, 1.15, P('M-8 30L-9 2C-9 -6 -6 -10 -2 -12L-2 -30C-2 -34 3 -34 3 -30L3 -14L5 -32C5 -36 10 -36 10 -32L9 -13L11 -28C11 -32 16 -31 16 -27L14 -10L16 -20C17 -24 21 -23 21 -19L18 0C17 10 12 18 8 30Z', '#f2c9a0') +
    L('M3 -14L3 -4M9 -13L9 -4M14 -10L13 -3', INK, .6, op(.5)) + Pn('M-7 28L-8 2C-8 -4 -6 -8 -3 -10L-2 0C-4 4 -5 16 -4 28Z', '#fff', op(.3)) + R(-10, 28, 20, 8, 2, '#f3ead6') + L('M-10 32h20', '#c8452e', 1.4)) +
  P('M56 40l8 -6l-2 8z', '#ffe28a') + P('M62 52l10 -2l-6 7z', '#ffe28a');
ART.bokken = () => swordScene('none', { L: 70, W: 7.2, c: 4, blade: 'wood', ito: '#6a4220', itoHi: '#c99a55', tsuba: 'dwood', hab: 'dwood', kashira: 'dwood', x: 46, y: 94, r: 12 }, { back: accent('take') });
ART.dounokatana = () => swordScene('none', { L: 72, W: 7.2, c: 5, blade: 'copper', hab: 'copper', tsuba: 'copper', ito: '#4a2516', x: 46, y: 94, r: 10 }, { back: accent('momiji') });
ART.ginnokatana = () => swordScene('none', { L: 72, W: 7.2, c: 5, blade: 'silver', hab: 'silver', tsuba: 'silver', ito: '#2f3a5c', tsubaShape: 'flower', x: 46, y: 94, r: 10, glow: '#dfe8ff' }, { back: accent('yuki') });
ART.kinnokatana = () => swordScene('none', { L: 72, W: 7.4, c: 5, blade: 'gold', hab: 'gold', tsuba: 'gold', ito: '#7a1f1a', itoHi: '#f3d27a', tsubaShape: 'flower', x: 46, y: 94, r: 10, glow: '#ffe28a', tassel: '#c8452e' }, { back: sparks(31, 16, 10, 10, 60, 70, '#fff3c0', 2) + accent('kumo') });
ART.wakizashi = () => swordScene('none', { L: 52, W: 7, c: 3.5, x: 44, y: 86, r: 8 }, { back: accent('ume') });
ART.kodachi = () => swordScene('none', { L: 58, W: 7, c: 2, x: 44, y: 90, r: -6, tsubaShape: 'flower' }, { back: accent('sakura') });
ART.katana = () => swordScene('none', { L: 74, W: 7.2, c: 6, x: 46, y: 96, r: 10, tassel: '#c8452e' }, { back: accent('momiji') });
ART.uchigatana = () => swordScene('none', { L: 72, W: 7.2, c: 4, x: 46, y: 96, r: -8, ito: '#5a1e1e' }, { back: accent('take') });
ART.nodachi = () => swordScene('none', { L: 86, W: 7.6, c: 7, H: 26, x: 42, y: 106, r: 13, s: .92 }, { back: accent('nami') });
ART.odachi = () => swordScene('none', { L: 92, W: 8, c: 8, H: 28, x: 40, y: 108, r: 15, s: .9, tassel: '#d8b45e' }, { back: accent('kumo') });
ART.zanbato = () => swordScene('none', { L: 86, W: 14, c: 3, H: 30, x: 42, y: 106, r: 10, s: .9 }, { back: L('M8 40L30 30M6 56L28 50M10 70L26 66', '#f3ead6', 1.3, op(.6)) });
ART.yakumo = () => artBg('none', { dx: 44, dy: 38 }) + cloud(14, 44, .9, '#f3ead6') + cloud(52, 30, .8, '#f3ead6') + cloud(20, 74, .7, '#efe0b0') + cloud(54, 66, .75, '#efe0b0') + shadow(42, 116, 16) +
  at(44, 96, 4, 1, katana({ L: 78, W: 6.6, c: 0, blade: 'steel', tsuba: 'gold', tsubaShape: 'flower', ito: '#2b2846', glow: '#fff3c0' })) + cloud(8, 96, .8, '#f3ead6') + cloud(56, 102, .7, '#f3ead6');
ART.onikiri = () => artBg('none', { dx: 44, dy: 40 }) + Pn('M10 60C6 40 16 22 30 18C26 30 30 40 40 44C44 28 56 18 70 20C62 30 62 44 70 56C60 52 50 56 44 64C36 58 22 58 10 60Z', '#c8452e', op(.4)) +
  at(30, 28, -16, 1, P('M-4 6C-8 -6 -6 -16 0 -22C1 -12 4 -4 6 4Z', '#efe6cf')) + at(58, 28, 16, 1, P('M4 6C8 -6 6 -16 0 -22C-1 -12 -4 -4 -6 4Z', '#efe6cf')) + shadow(42, 116, 16) +
  at(44, 98, 6, 1, katana({ L: 78, c: 7, glow: '#ff6b4a', ito: '#5a1414', tsuba: 'red', tsubaShape: 'flower' })) + sparks(66, 10, 10, 30, 60, 50, '#ffb08a', 1.6);
ART.habakiri = () => artBg('none', { dx: 44, dy: 40 }) + rays(44, 40, 16, 40, 16, '#fff3c0', .35) +
  at(30, 54, -30, 1, feather(0, 0, 22, '#f3ead6')) + at(58, 54, 30, 1, feather(0, 0, 22, '#f3ead6')) + at(26, 70, -50, .8, feather(0, 0, 20, '#efe0b0')) + at(62, 70, 50, .8, feather(0, 0, 20, '#efe0b0')) +
  shadow(44, 116, 16) + at(44, 98, 0, 1, katana({ L: 80, W: 6.6, c: 0, tsuba: 'gold', tsubaShape: 'flower', glow: '#ffffff', ito: '#f3ead6', itoHi: '#c9a24f' }));
ART.murakumo = () => artBg('none', { dx: 44, dy: 36, dr: 34 }) + rays(44, 36, 20, 46, 24, '#ffe28a', .5, 1.2) +
  cloud(6, 40, 1.1, '#3a4467') + cloud(50, 26, 1, '#3a4467') + L('M60 46L54 58L62 58L52 76', '#ffe28a', 2.2) + L('M14 54L20 64L13 66L20 80', '#ffe28a', 1.8) +
  shadow(44, 116, 18) + at(44, 100, 0, 1.02, katana({ L: 82, W: 7.4, c: 0, blade: 'steel', tsuba: 'gold', tsubaShape: 'flower', hab: 'gold', glow: '#ffe28a', ito: '#7a1f1a', itoHi: '#f3d27a', tassel: '#d8b45e' })) +
  cloud(4, 100, 1, '#2c3557') + cloud(52, 108, .9, '#2c3557');
function feather(x, y, h, col) { return at(x, y, 0, 1, P('M0 0C' + (-h * .28) + ' ' + (-h * .3) + ' ' + (-h * .22) + ' ' + (-h * .8) + ' 0 ' + (-h) + 'C' + (h * .22) + ' ' + (-h * .8) + ' ' + (h * .28) + ' ' + (-h * .3) + ' 0 0Z', col) + L('M0 0L0 ' + (-h * .95), INK, .6) + L('M0 ' + (-h * .3) + 'l-' + (h * .18) + ' -' + (h * .12) + 'M0 ' + (-h * .5) + 'l' + (h * .18) + ' -' + (h * .12) + 'M0 ' + (-h * .7) + 'l-' + (h * .14) + ' -' + (h * .1), INK, .45, op(.6))); }
/* 槍のなかま */
const poleScene = (th, head, o) => artBg(th, { dx: 44, dy: 36 }) + (o.back || '') + shadow(40, 117, 14) + at(o.x || 42, o.y || 28, o.r || 4, 1, pole({ len: o.len || 92, mat: o.mat || 'red', bands: o.bands, w: o.w }) + head + (o.tassel ? L('M-1 4q-6 4 -4 12M1 4q6 4 4 12M0 4v12', o.tassel, 1.5) : '')) + (o.front || '');
ART.takeyari = () => artBg('none', { dx: 44, dy: 38 }) + shadow(40, 117, 12) + at(42, 18, 5, 1,
  P('M-2.8 0L2.8 -10L2.8 98L-2.8 98Z', gid('bamboo')) + [16, 38, 60, 82].map(y => L('M-2.8 ' + y + 'H2.8', INK, 1) + L('M-2.8 ' + (y + 1.2) + 'H2.8', '#4b6e2a', .5)).join('') + Pn('M-1.6 0L1.8 -7.6L1.8 -4Z', '#fff', op(.5))) +
  at(56, 92, 30, 1, Pn('M0 0c4 -6 10 -8 14 -6c-6 1 -10 4 -14 6z', '#8fb556') + L('M0 0c4 -6 10 -8 14 -6', INK, .6));
ART.nagayari = () => poleScene('none', spearHead({ h: 26, w: 6.6 }), { tassel: '#c8452e', len: 94 });
ART.jumonji = () => poleScene('none', spearHead({ h: 26, w: 6.4 }) + at(0, -6, 0, 1, P('M-2 0C-8 -1 -14 -4 -18 -9C-12 -6 -6 -5 -2 -4Z', gid('steel')) + P('M2 0C8 -1 14 -4 18 -9C12 -6 6 -5 2 -4Z', gid('steel'))), { tassel: '#d8b45e' });
ART.naginata = () => poleScene('none', at(0, 0, 0, 1, P('M-3 0C-3 -14 -1 -26 6 -34C4 -24 4 -12 3 0Z', gid('steel')) + L('M-1.4 -2C-1.3 -12 0 -22 4 -30', '#fff', .7, op(.8)) + E(0, 1, 5, 1.8, gid('iron'))), { mat: 'dwood', bands: 9, len: 92 });
ART.shakujo = () => artBg('none', { dx: 44, dy: 32 }) + shadow(40, 117, 12) + at(42, 30, 3, 1, pole({ len: 88, mat: 'dwood', w: 3 }) +
  P('M0 -2C-8 -4 -11 -14 -8 -22C-5 -29 5 -29 8 -22C11 -14 8 -4 0 -2Z', 'none', ' stroke="' + INK + '" stroke-width="3.6"') + P('M0 -2C-8 -4 -11 -14 -8 -22C-5 -29 5 -29 8 -22C11 -14 8 -4 0 -2Z', 'none', ' stroke="#e2bd62" stroke-width="2"') +
  [-9, -5, 5, 9].map((x, i) => C(x, -6 - (i % 2) * 6, 2.6, gid('gold'))).join('') + P('M0 -30l2.4 4h-4.8z', gid('gold')) + L('M0 -26V-2', '#c9a24f', 1.2)) + cloud(52, 92, .8, '#efe0b0');
ART.kama = () => artBg('none', { dx: 44, dy: 40 }) + accent('susuki') + shadow(40, 114, 16) + at(36, 50, 20, 1.25, R(-2.6, 0, 5.2, 50, 2, gid('wood')) + R(-3, 0, 6, 6, 1, gid('iron')) +
  P('M-1 2C4 -8 18 -14 32 -10C22 -10 12 -4 4 6Z', gid('steel')) + L('M2 2C8 -6 18 -10 28 -10', '#fff', .7, op(.8)));
ART.hocho = () => artBg('none', { dx: 44, dy: 40 }) + shadow(40, 114, 26) + at(40, 100, -6, 1, R(-30, -8, 60, 14, 2, gid('wood')) + L('M-26 -2h52', '#8a5a2e', .6, op(.6))) +
  at(44, 62, -40, 1.25, P('M0 -6L40 -9C44 -7 44 -1 40 3L0 4Z', gid('steel')) + L('M4 2L38 -.5', '#fff', .7, op(.8)) + R(-22, -4.4, 22, 8, 3, gid('dwood')) + Cn(-16, 0, 1, '#e2bd62') + Cn(-8, 0, 1, '#e2bd62') + R(-1.6, -5.5, 3.2, 10, .8, gid('gold'))) +
  Cn(24, 92, 3.4, '#e86a4e', ' stroke="' + INK + '" stroke-width=".7"') + Cn(32, 91, 3, '#f3ead6', ' stroke="' + INK + '" stroke-width=".7"') + Cn(56, 92, 3, '#8fbf6a', ' stroke="' + INK + '" stroke-width=".7"');
ART.kunai = () => artBg('none', { dx: 44, dy: 42 }) + shadow(42, 114, 14) + at(40, 66, 15, 1.4, P('M0 -38C6 -26 7 -14 3 -4L-3 -4C-7 -14 -6 -26 0 -38Z', gid('steel')) + L('M0 -34V-6', INK, .5, op(.6)) + R(-2.2, -4, 4.4, 26, 1.2, '#2b2846') +
  [0, 5, 10, 15].map(y => L('M-2.2 ' + (y + 0) + 'L2.2 ' + (y + 4), '#c9b98e', 1)).join('') + C(0, 26, 4.6, 'none', ' stroke-width="2.2"') + C(0, 26, 4.6, 'none', ' stroke="#8a939e" stroke-width="1"')) + L('M10 36l12 8M8 50l12 4', '#f3ead6', 1.2, op(.6));
ART.konbo = () => artBg('none', { dx: 44, dy: 40 }) + shadow(42, 116, 16) + at(44, 98, 14, 1, P('M-3 0L-6 -60C-6 -70 6 -70 6 -60L3 0Z', gid('wood')) + L('M-2 -10L-4 -56M2 -30l1.5 -10', '#6a4220', .8) + E(-1, -40, 1.6, 2.6, '#6a4220') + R(-3.4, 0, 6.8, 18, 2, gid('dwood')) + L('M-3.4 4h6.8M-3.4 8h6.8M-3.4 12h6.8', '#e8dcc0', 1));
ART.jitte = () => artBg('none', { dx: 44, dy: 38 }) + shadow(42, 114, 14) + at(42, 92, 8, 1.05, R(-2.2, -66, 4.4, 66, 2, gid('steel')) + P('M2 -36L8 -36L8 -46', gid('steel'), ' stroke-width="1.6"') + L('M2 -36L8 -36L8 -46', '#eef2f6', 1.2) +
  R(-3, 0, 6, 22, 2, '#5a1e1e') + [3, 8, 13].map(y => L('M-3 ' + y + 'h6', '#e8dcc0', 1)).join('') + C(0, 24, 2.8, gid('gold')) + L('M0 27q-4 6 -2 14M0 27q4 6 2 14M0 27v14', '#c8452e', 1.6));
ART.kusarigama = () => artBg('none', { dx: 44, dy: 40 }) + shadow(40, 116, 16) + at(26, 30, 14, 1.3, R(-2.4, 0, 4.8, 40, 2, gid('wood')) + R(-2.8, 0, 5.6, 5, 1, gid('iron')) + L('M-2.4 12h4.8M-2.4 20h4.8M-2.4 28h4.8', '#3a2312', .7) +
  P('M-1 2C4 -6 16 -10 26 -6C18 -6 10 -2 4 6Z', gid('steel')) + L('M2 2C8 -4 16 -7 23 -6', '#fff', .6, op(.8))) +
  chain('M24 84C30 100 52 106 60 92C66 80 56 70 48 78') + C(48, 80, 6.4, gid('iron')) + Cn(46, 78, 2, '#fff', op(.35));
function chain(d) { return L(d, '#2a2e36', 3.4) + L(d, '#c9d0d8', 2.2, ' stroke-dasharray="2.4 1.2"'); }
ART.kanabo = () => artBg('none', { dx: 44, dy: 40 }) + shadow(42, 117, 16) + at(44, 102, 10, 1, P('M-3 0L-7 -64C-7 -76 7 -76 7 -64L3 0Z', gid('iron')) +
  Array.from({ length: 18 }, (_, i) => { const y = -66 + (i % 6) * 10, x = (Math.floor(i / 6) - 1) * 4.2; return Cn(x, y + (i % 2) * 3, 1.3, '#e2bd62', ' stroke="' + INK + '" stroke-width=".5"'); }).join('') + R(-3.2, 0, 6.4, 16, 2, '#5a1414') + L('M-3.2 4h6.4M-3.2 8h6.4M-3.2 12h6.4', '#e8dcc0', 1)) +
  P('M12 26L8 10L18 22Z', '#efe6cf') + P('M30 22L32 6L38 20Z', '#efe6cf');
ART.masakari = () => artBg('none', { dx: 44, dy: 40 }) + shadow(42, 117, 16) + at(42, 104, 6, 1, R(-2.6, -86, 5.2, 86, 2, gid('wood')) +
  P('M2 -84C20 -86 30 -74 28 -56C26 -46 14 -44 2 -52Z', gid('steel')) + L('M24 -80C28 -72 28 -60 24 -52', '#fff', .9, op(.8)) + P('M-2 -78C-10 -78 -12 -70 -10 -64L-2 -64Z', gid('iron')) + R(-3.2, -88, 6.4, 6, 1, gid('gold')));
ART.yabusuma = () => artBg('none', { dx: 40, dy: 34 }) + [[16, 28], [34, 16], [52, 30], [22, 58], [42, 50], [60, 62], [12, 86], [32, 82], [52, 92]].map(([x, y], i) => at(x, y, 200 - (i % 3) * 6, .78, arrow({ len: 46, fl2: i % 2 ? '#c8452e' : '#2b3456' }))).join('') + Pn('M0 112C30 106 70 106 100 112V124H0Z', '#141c33');
ART.horoku = () => artBg('none', { dx: 44, dy: 44 }) + shadow(40, 112, 18) + C(40, 78, 24, gid('black')) + L('M22 72q18 8 36 0M20 82q20 8 40 0', '#6a6370', 1.2) + En(32, 68, 6, 4, '#fff', op(.2)) +
  R(36, 50, 8, 6, 1, gid('dwood')) + L('M40 50C42 40 52 36 56 30', '#c9a46a', 1.6) + flame(57, 30, 12, { wr: .55 }) + sparks(5, 10, 48, 10, 26, 24, '#ffe28a', 1.6);
ART.ozutsu = () => artBg('none', { dx: 40, dy: 40 }) + shadow(44, 114, 26) + at(40, 80, -18, 1, R(-30, -9, 56, 18, 8, gid('iron')) + R(-32, -11, 8, 22, 3, gid('dwood')) + R(18, -11, 10, 22, 3, gid('gold')) + L('M-14 -9v18M2 -9v18', '#c9a24f', 1.2) + E(28, 0, 2.6, 7, '#111')) +
  C(28, 98, 12, gid('wood')) + L('M28 86v24M16 98h24M20 90l16 16M36 90l-16 16', '#6a4220', 1) + C(28, 98, 3, gid('gold')) + cloud(62, 54, .9, '#d9d0c0') + cloud(70, 44, .7, '#d9d0c0');

/* ---- 武器（属性つき） ---- */
ART.hinoko = () => artBg('火', { dx: 40, dy: 50 }) + sparks(11, 26, 8, 16, 62, 70, '#fff1a8', 2.4) + flame(30, 104, 26, { wr: .6 }) + flame(48, 106, 34) + flame(64, 104, 20, { wr: .7 }) + shadow(46, 110, 24, .3);
ART.hiya = () => artBg('火', { dx: 40, dy: 44 }) + L('M14 104C26 84 40 64 58 40', '#ffe28a', 7, op(.18)) + shadow(40, 114, 14) +
  at(60, 34, 40, 1.15, arrow({ len: 74, head: 'iron' }) + at(0, 9, 180, 1, flame(0, 0, 30, { wr: .55 }))) + sparks(7, 16, 14, 30, 50, 70, '#ffe28a', 2);
ART.homura = () => artBg('火', { dx: 44, dy: 40 }) + flame(30, 90, 70, { wr: .5, fill: '#f6a33a' }) + flame(56, 92, 60, { wr: .5, fill: '#e2502e' }) + shadow(42, 116, 16) +
  at(44, 98, 6, 1, katana({ L: 76, c: 6, blade: 'fire', ito: '#5a1414', tsuba: 'gold', tsubaShape: 'flower', glow: '#ffd36b' })) + sparks(13, 16, 10, 8, 60, 70, '#fff3c0', 1.6);
ART.kaensha = () => artBg('火', { dx: 42, dy: 60, dr: 36 }) + [0, 45, 90, 135, 180, 225, 270, 315].map(a => at(42, 66, a, 1, flame(0, -20, 18, { wr: .55 }))).join('') + shadow(42, 112, 22) + C(42, 66, 22, gid('dwood')) + C(42, 66, 16, 'none', ' stroke="#e2bd62" stroke-width="2.4"') +
  Array.from({ length: 8 }, (_, i) => L('M42 66L' + f1(42 + Math.cos(i * Math.PI / 4) * 18) + ' ' + f1(66 + Math.sin(i * Math.PI / 4) * 18), '#3a2312', 2.2)).join('') + C(42, 66, 5, gid('gold'));
ART.mizutsubute = () => artBg('水', { dx: 40, dy: 46 }) + [[20, 38, 7], [44, 30, 9], [30, 62, 10], [56, 56, 7], [16, 84, 6], [46, 88, 11], [64, 80, 6]].map(([x, y, r]) => drop(x, y, r)).join('') + L('M6 30l10 4M8 52l12 3M10 74l10 2', '#cfe4ff', 1.2, op(.7));
function drop(x, y, r, col) { return P('M' + x + ' ' + f1(y - r * 1.6) + 'C' + f1(x + r * .9) + ' ' + f1(y - r * .5) + ' ' + f1(x + r) + ' ' + f1(y + r * .1) + ' ' + f1(x + r * .9) + ' ' + f1(y + r * .4) + 'A' + f1(r) + ' ' + f1(r) + ' 0 1 1 ' + f1(x - r * .9) + ' ' + f1(y + r * .4) + 'C' + f1(x - r) + ' ' + f1(y + r * .1) + ' ' + f1(x - r * .9) + ' ' + f1(y - r * .5) + ' ' + x + ' ' + f1(y - r * 1.6) + 'Z', col || gid('sky')) + En(x - r * .35, y, r * .22, r * .38, '#fff', op(.8)); }
ART.suijin = () => artBg('水', { dx: 44, dy: 44 }) + shadow(42, 112, 18) + at(40, 66, -20, 1, P('M-18 30C-30 6 -20 -26 10 -38C-6 -22 -10 4 2 26C-4 26 -12 28 -18 30Z', gid('sky')) + L('M-14 24C-22 4 -14 -20 4 -32', '#fff', 1, op(.8)) + L('M-8 26C-12 10 -8 -8 2 -20', '#fff', .6, op(.6))) + waveCrest(36, 112, 34);
ART.tsurara = () => artBg('水', { dx: 44, dy: 60 }) + Pn('M0 0H100V14C80 18 60 12 40 16C20 20 10 14 0 16Z', '#e8f0f8') + [[12, 16, 50], [26, 16, 72], [40, 16, 44], [52, 15, 86], [66, 15, 58]].map(([x, y, h]) => P('M' + (x - 4.5) + ' ' + y + 'L' + x + ' ' + (y + h) + 'L' + (x + 4.5) + ' ' + y + 'Z', gid('ice')) + L('M' + (x - 1) + ' ' + (y + 2) + 'L' + x + ' ' + (y + h * .8), '#fff', .7)).join('') + drop(60, 108, 3.4, gid('ice'));
ART.mizuchi = () => artBg('水', { dx: 44, dy: 36 }) + shadow(40, 117, 14) + at(42, 30, 4, 1, pole({ len: 90, mat: 'blue', w: 3.4 }) + at(0, 0, 0, 1, P('M0 -30C5 -18 5 -8 2 0L-2 0C-5 -8 -5 -18 0 -30Z', gid('steel')) + P('M2 -6C8 -10 14 -10 16 -16C12 -16 8 -14 2 -12Z', gid('steel')) + P('M-2 -6C-8 -10 -14 -10 -16 -16C-12 -16 -8 -14 -2 -12Z', gid('steel')))) +
  L('M44 40C66 50 24 60 46 70C66 80 26 88 44 98', '#3a7f6e', 6) + L('M44 40C66 50 24 60 46 70C66 80 26 88 44 98', '#8fd0b8', 2.4, ' stroke-dasharray="2 2"') + C(44, 38, 3.6, '#3a7f6e') + Cn(45, 37, .9, '#ffe28a');
ART.samidare = () => artBg('水', { dx: 44, dy: 40 }) + L(Array.from({ length: 18 }, (_, i) => 'M' + (6 + i * 5.5) + ' ' + (i % 3 * 8) + 'l-5 18').join(''), '#cfe4ff', .9, op(.7)) + shadow(42, 114, 16) +
  at(44, 66, 0, 1, L('M-6 -48C16 -30 16 30 -6 48', INK, 4.6) + L('M-6 -48C16 -30 16 30 -6 48', '#b5352a', 2.6) + L('M-6 -48L-6 48', '#f3ead6', .9) + R(4.6, -6, 4.4, 12, 1, '#2b2846')) +
  at(36, 66, -90, 1, arrow({ len: 46 })) + [[18, 30], [26, 96], [62, 100]].map(([x, y]) => drop(x, y, 2.6)).join('');
ART.matsuba = () => artBg('木', { dx: 42, dy: 42 }) + L('M2 96C20 90 30 76 46 72C56 70 62 60 66 50', '#4a2e18', 5) + L('M2 96C20 90 30 76 46 72C56 70 62 60 66 50', '#7a4a26', 2.4) +
  [[18, 88], [34, 76], [52, 66], [64, 50], [28, 60], [46, 52]].map(([x, y], k) => { let t = ''; for (let i = 0; i < 9; i++) { const a = -150 + i * 15 + k * 7; t += L('M' + x + ' ' + y + 'l' + f1(Math.cos(a * Math.PI / 180) * 16) + ' ' + f1(Math.sin(a * Math.PI / 180) * 16), '#a8d07a', 1.1); } return t + Cn(x, y, 2, '#4a2e18'); }).join('') +
  [[30, 104, 20], [44, 110, -10], [58, 102, 40]].map(([x, y, r]) => at(x, y, r, 1, L('M0 0l0 -12M0 0l3 -11', '#d8e8b0', 1.2))).join('');
ART.ibara = () => artBg('木', { dx: 44, dy: 40 }) + shadow(42, 114, 14) + at(30, 98, -10, 1, R(-3, 0, 6, 16, 2, gid('dwood'))) + L('M30 98C24 70 60 66 52 44C46 28 20 34 26 18', '#2f5a34', 4.4) + L('M30 98C24 70 60 66 52 44C46 28 20 34 26 18', '#8fbf6a', 1.6) +
  [[28, 86, 200], [40, 72, 30], [54, 60, 200], [50, 44, 20], [36, 32, 220], [26, 22, 30]].map(([x, y, r]) => at(x, y, r, 1, P('M0 0L4 -2L1 3Z', '#d8e8b0'))).join('') + sakura(58, 38, .6, '#f0c9d6') + sakura(20, 46, .5, '#f0c9d6');
ART.kashi = () => artBg('木', { dx: 44, dy: 36 }) + shadow(40, 117, 14) + at(42, 18, 5, 1, R(-3.4, 0, 6.8, 96, 3, gid('wood')) + L('M-1 10v20M1 40v18M-1 70v16', '#6a4220', .7) + E(1, 50, 1.4, 2.4, '#6a4220')) +
  at(48, 22, 30, 1, leafOak(0, 0, 14)) + at(36, 28, -40, 1, leafOak(0, 0, 12)) + C(54, 32, 3, gid('clay')) + C(30, 36, 2.6, gid('clay'));
function leafOak(x, y, h) { return P('M0 0C-4 -3 -6 -6 -4 -9C-7 -10 -6 -14 -3 -14C-4 -17 -1 -19 0 -' + h + 'C1 -19 4 -17 3 -14C6 -14 7 -10 4 -9C6 -6 4 -3 0 0Z', gid('leaf')) + L('M0 0V-' + (h - 2), INK, .5); }
ART.senpu = () => artBg('木', { dx: 42, dy: 46 }) + wind(8, 40, 1.4, '#f3ead6', 1.8) + wind(30, 26, 1, '#efe0b0', 1.4) + wind(12, 100, 1.2, '#efe0b0', 1.4) + shadow(42, 114, 18) + at(40, 96, -8, 1, sensu(42, 60, 'leaf')) + [[60, 30], [70, 50], [18, 60]].map(([x, y], i) => at(x, y, i * 50, .7, leafOak(0, 0, 12))).join('');
/* 扇（ひろげた扇）。原点は要（かなめ） */
function sensu(r, ang, mat, o) {
  o = o || {};
  const a0 = (-90 - ang / 2) * Math.PI / 180, a1 = (-90 + ang / 2) * Math.PI / 180;
  const p = (a, rr) => f1(Math.cos(a) * rr) + ' ' + f1(Math.sin(a) * rr);
  let s = P('M' + p(a0, r * .3) + 'L' + p(a0, r) + 'A' + r + ' ' + r + ' 0 0 1 ' + p(a1, r) + 'L' + p(a1, r * .3) + 'A' + f1(r * .3) + ' ' + f1(r * .3) + ' 0 0 0 ' + p(a0, r * .3) + 'Z', o.fill || gid(mat));
  const n = o.ribs || 9;
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; s += L('M' + p(a, r * .3) + 'L' + p(a, r), INK, .5, op(.45)); }
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; s += L('M0 0L' + p(a, r * .3), o.rib || '#3a2312', 1.4); }
  s += C(0, 0, 1.8, gid('gold'));
  if (o.disc) s += Cn(Math.cos(-Math.PI / 2) * r * .66, Math.sin(-Math.PI / 2) * r * .66, r * .17, o.disc);
  return s;
}
ART.sunakake = () => artBg('土', { dx: 44, dy: 42 }) + Pn('M0 110C24 104 60 104 100 110V124H0Z', '#7a5420', op(.7)) + shadow(26, 108, 14) +
  at(24, 92, -40, 1.1, P('M-12 -6C-14 6 -10 16 0 16C10 16 14 6 12 -6C8 -10 -8 -10 -12 -6Z', gid('navy')) + L('M-12 -6C-6 -2 6 -2 12 -6', '#e2bd62', 2) + Pn('M-8 6C-8 0 -6 -2 -4 -2C-6 2 -6 8 -4 12Z', '#fff', op(.25)) + E(0, -8, 11, 3, '#c9a46a')) +
  (() => { const r = rng(91); let t = ''; for (let i = 0; i < 80; i++) { const u = r(), x = 30 + u * 40 + (r() - .5) * 12, y = 80 - u * 52 - Math.sin(u * 3) * 10 + (r() - .5) * 14; t += Cn(x, y, .6 + r() * 1.3, r() < .5 ? '#fbe9b2' : '#d8a44a', op(.6 + r() * .4)); } return t; })();
ART.ishi = () => artBg('土', { dx: 42, dy: 44 }) + [[22, 36, 7, 10], [46, 28, 9, -20], [32, 62, 11, 30], [58, 58, 8, 0], [18, 84, 7, 50], [48, 88, 12, -10]].map(([x, y, r, a]) => at(x, y, a, 1, P('M' + (-r) + ' 0L' + (-r * .5) + ' ' + (-r * .8) + 'L' + (r * .6) + ' ' + (-r * .9) + 'L' + r + ' ' + (-r * .1) + 'L' + (r * .5) + ' ' + (r * .8) + 'L' + (-r * .6) + ' ' + (r * .7) + 'Z', gid('stone')) + L('M' + (-r * .4) + ' ' + (-r * .5) + 'L' + (r * .3) + ' ' + (-r * .6), '#fff', .6, op(.6)))).join('') + L('M4 30l10 4M6 60l12 2M8 82l8 2', '#fbe9b2', 1.2, op(.7));
ART.iwakudaki = () => artBg('土', { dx: 44, dy: 36 }) + shadow(42, 112, 24) + at(30, 100, 0, 1, P('M-22 0L-18 -16L-6 -22L8 -18L18 -6L16 0Z', gid('stone')) + L('M-4 -22L0 -10L-8 -2M0 -10L10 -12', INK, 1)) +
  at(46, 68, 35, 1, R(-2.6, 0, 5.2, 46, 2, gid('wood')) + P('M-14 -16L14 -16L16 0L-16 0Z', gid('stone')) + L('M-14 -8H14', '#fff', .6, op(.5))) + sparks(9, 10, 16, 70, 40, 24, '#fbe9b2', 2);
ART.jiware = () => artBg('土', { dx: 44, dy: 36 }) + Pn('M0 100C30 96 70 96 100 100V124H0Z', '#5e4016') + L('M40 100L36 108L44 114L38 124M40 100L52 108L50 118', INK, 1.6) + L('M10 102l6 8M76 102l-4 10', INK, 1.2) +
  at(42, 70, -20, 1, R(-3, 0, 6, 42, 2, gid('wood')) + R(-20, -24, 40, 24, 4, gid('dwood')) + R(-21, -26, 6, 28, 2, gid('gold')) + R(15, -26, 6, 28, 2, gid('gold')) + L('M-12 -12H12', '#c9a24f', 1)) + sparks(4, 12, 10, 84, 60, 16, '#fbe9b2', 2);
ART.kanzashi = () => artBg('金', { dx: 42, dy: 40 }) + shadow(42, 114, 12) + at(38, 30, -14, 1, L('M0 0L0 80', INK, 3.2) + L('M0 0L0 80', '#eef2f6', 1.8) + L('M3 0L3 76', INK, 2.4) + L('M3 0L3 76', '#dfe3e8', 1.2)) +
  sakura(36, 28, 1.4, '#f3f4f7') + sakura(46, 22, .9, '#f7cbd5') + L('M32 34q-4 10 -2 18M40 34q2 12 4 20', '#c9a24f', .8) + Cn(30, 52, 2.4, '#c8452e') + Cn(44, 54, 2.2, '#e2bd62') + Cn(30.6, 46, 1.4, '#fff');
ART.shuriken = () => artBg('金', { dx: 40, dy: 50 }) + shadow(40, 112, 18) + at(40, 70, 18, 1, shuri(24)) + at(64, 34, -10, .45, shuri(24)) + L('M8 40l12 10M10 30l10 6', '#fff', 1.2, op(.6));
function shuri(r) { let d = ''; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; d += (i ? 'L' : 'M') + f1(Math.cos(a) * r) + ' ' + f1(Math.sin(a) * r) + 'L' + f1(Math.cos(a + Math.PI / 4) * r * .28) + ' ' + f1(Math.sin(a + Math.PI / 4) * r * .28); } return P(d + 'Z', gid('steel')) + C(0, 0, r * .16, '#33466d') + L('M0 ' + (-r) + 'L0 0M' + r + ' 0L0 0', '#fff', .6, op(.6)); }
ART.tessen = () => artBg('金', { dx: 42, dy: 46 }) + shadow(42, 114, 18) + at(40, 96, -6, 1, sensu(46, 120, 'iron', { rib: '#1b1f25', disc: '#c8452e' })) + L('M40 96L34 112', '#1b1f25', 3) + Cn(34, 113, 2, '#c8452e');
ART.hagane = () => poleScene('金', at(0, 0, 0, 1, P('M0 -34C6 -22 6 -10 3 0L-3 0C-6 -10 -6 -22 0 -34Z', gid('steel')) + L('M0 -30V-2', INK, .5) + L('M-6 0h12', INK, 2.4) + L('M-6 0h12', '#c9a24f', 1.2)), { mat: 'iron', len: 92, tassel: '#2b3456' });

/* ---- 追撃 ---- */
ART.toishi = () => artBg('plus', { dx: 42, dy: 44 }) + shadow(42, 110, 24) + at(42, 92, -8, 1, P('M-26 -8L24 -12L28 4L-24 8Z', gid('stone')) + Pn('M-22 -6L20 -10L22 -4L-20 0Z', '#e9e2d4', op(.6)) + R(-28, 4, 54, 8, 2, gid('wood'))) +
  at(36, 60, -30, 1, katana({ L: 44, W: 6, c: 2, H: 12 })) + sparks(17, 16, 20, 54, 44, 30, '#fff3c0', 2.2) + drop(66, 70, 3.4);
ART.kiai = () => artBg('plus', { dx: 42, dy: 50, dr: 34 }) + rays(42, 54, 26, 50, 20, '#fff3c0', .4, 1.4) + T(40, 72, 46, '気', '#fbf3e2', ' stroke="' + INK + '" stroke-width="1.6" paint-order="stroke"') +
  L('M6 96C24 86 56 86 76 96', '#fbf3e2', 7) + L('M6 96C24 86 56 86 76 96', '#c8452e', 4.6) + P('M70 92l10 -8l-2 10z', '#c8452e') + P('M72 96l12 2l-8 6z', '#c8452e');
ART.kairiki = () => artBg('plus', { dx: 40, dy: 54 }) + rays(40, 60, 24, 50, 16, '#fff3c0', .35) + shadow(40, 116, 22) +
  at(40, 104, 0, 1, R(-14, -8, 28, 20, 2, '#f3ead6') + L('M-14 -2h28M-14 4h28M-14 10h28', '#c9b98e', .8)) +
  at(40, 74, 0, 1.15, R(-22, -6, 44, 26, 9, '#e8b48a') +
    [-16.5, -5.5, 5.5, 16.5].map(x => R(x - 5.5, -22, 11, 24, 5.5, '#eebd94') + Pn('M' + (x - 3) + ' -19C' + (x - 1) + ' -21 ' + (x + 2) + ' -21 ' + (x + 3) + ' -18', '#fff', op(.45))).join('') +
    R(-24, 2, 30, 11, 5.5, '#e2a87e') + R(-2, 3.5, 7, 7, 2.5, '#f6d8c0') + L('M-18 18C-8 21 8 21 18 18', '#c98a62', 1) + Pn('M-20 -2C-20 -4 -18 -6 -14 -6', '#fff', op(.3))) +
  T(40, 30, 24, '力', '#fbf3e2', ' stroke="' + INK + '" stroke-width="1.4" paint-order="stroke"') + L('M10 66l-8 -3M10 78l-9 1M12 54l-7 -6', '#fff3c0', 1.6, op(.8));
ART.toshinki = () => artBg('plus', { dx: 40, dy: 52, dr: 36 }) + [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(a => at(40, 60, a, 1, flame(0, -26, 22, { wr: .5, fill: '#e2502e' }))).join('') +
  C(40, 60, 24, '#2a1208') + C(40, 60, 21, 'none', ' stroke="#e2bd62" stroke-width="1.6"') + T(40, 71, 30, '闘', '#ffe28a') + sparks(41, 18, 6, 10, 70, 100, '#fff3c0', 2);

/* ---- 防具（属性なし） ---- */
const armorScene = (inner, o) => artBg((o && o.th) || 'armor', { dx: 42, dy: 42 }) + shadow(42, 114, (o && o.sh) || 22) + inner;
ART.tenugui = () => armorScene(L('M4 30H70', '#6a4220', 1.6) + at(40, 70, -4, 1.12, P('M-24 -36C-12 -38 12 -38 24 -36L22 30C10 34 -10 34 -22 30Z', '#eef1f6') + Rn(-22, -32, 44, 58, 0, 'url(#pt-seigaiha-dk)') + L('M-24 -30C-12 -32 12 -32 24 -30M-22 24C-10 28 10 28 22 24', '#2b3f6b', 1.4)));
ART.nabebuta = () => armorScene(at(40, 76, -10, 1.3, E(0, 0, 26, 9, gid('wood')) + E(0, -2, 22, 6, '#c99a55') + L('M-18 -2h36M-20 2h40', '#8a5a2e', .7, op(.6)) + R(-8, -12, 16, 7, 2.6, gid('dwood'))) + L('M30 44c2 -6 -2 -10 0 -16M42 40c2 -6 -2 -10 0 -16', '#efe6cf', 1.4, op(.6)));
ART.amigasa = () => armorScene(at(42, 74, -6, 1, P('M-34 8C-26 -14 -12 -24 0 -26C12 -24 26 -14 34 8C20 14 -20 14 -34 8Z', gid('straw')) + L('M-26 -2C-14 4 14 4 26 -2M-18 -12C-8 -8 8 -8 18 -12M-30 4C-16 10 16 10 30 4', '#8e6d2c', .9) +
  L('M0 -26L-12 9M0 -26L12 9M0 -26L0 11M0 -26L-24 6M0 -26L24 6', '#8e6d2c', .5, op(.6)) + L('M-20 8C-16 26 -10 30 -6 34M20 8C16 26 10 30 6 34', '#c8452e', 1.2)));
ART.itadate = () => armorScene(at(40, 66, -4, 1, R(-22, -36, 44, 70, 2, gid('wood')) + L('M-11 -36V34M0 -36V34M11 -36V34', '#6a4220', 1) + R(-24, -24, 48, 5, 1, gid('dwood')) + R(-24, 18, 48, 5, 1, gid('dwood')) + mon(0, -2, 9)));
ART.kote = () => armorScene(at(40, 70, 18, 1, P('M-10 -40C-4 -42 8 -40 12 -36L14 10C10 14 -6 14 -12 10Z', '#2b2846') + [-30, -20, -10, 0].map(y => R(-11, y, 24, 7, 2, gid('iron'))).join('') + P('M-12 10C-16 18 -14 30 -4 32C6 34 16 28 14 10Z', gid('steel')) + L('M-6 14v14M0 14v16M6 14v14', INK, .6, op(.5)) + [-30, -20, -10, 0].map(y => Cn(-6, y + 3.5, .9, '#e2bd62') + Cn(7, y + 3.5, .9, '#e2bd62')).join('')));
function odoshi(x, y, w, rows, h, col, mat) { let s = ''; for (let i = 0; i < rows; i++) { s += R(x, y + i * h, w, h - .6, 1, gid(mat || 'iron')); for (let k = 1; k < 7; k++) s += L('M' + f1(x + w * k / 7) + ' ' + f1(y + i * h + 1) + 'v' + f1(h - 2.6), col, 1.1); } return s; }
ART.domaru = () => armorScene(at(42, 70, 0, 1, P('M-22 -34C-12 -38 12 -38 22 -34L24 -8C24 0 20 6 20 10H-20C-20 6 -24 0 -24 -8Z', gid('dwood')) + Pn('M-18 -30C-8 -33 8 -33 18 -30L19 -10H-19Z', '#fff', op(.12)) + L('M-14 -26C-6 -28 6 -28 14 -26', '#e2bd62', 1.2) + mon(0, -18, 6) + odoshi(-22, 10, 44, 3, 7, '#c8452e')));
ART.katabira = () => armorScene(at(42, 68, 0, 1, P('M-14 -38L-6 -34C-2 -30 2 -30 6 -34L14 -38L26 -28L20 -16L18 34H-18L-20 -16L-26 -28Z', '#3a404a') + Pn('M-14 -38L-6 -34C-2 -30 2 -30 6 -34L14 -38L26 -28L20 -16L18 34H-18L-20 -16L-26 -28Z', 'url(#pt-chain)') + L('M-6 -34C-2 -28 2 -28 6 -34', '#c9d0d8', 1.6)));
ART.gusoku = () => armorScene(at(42, 64, 0, 1, kabuto(0, -26, 1, { maedate: 'moon' }) + P('M-20 -10C-10 -14 10 -14 20 -10L22 12H-22Z', gid('navy')) + mon(0, -2, 5) + odoshi(-22, 12, 44, 3, 6, '#d8b45e', 'navy') + P('M-22 -10L-34 -4L-32 14L-22 10Z', gid('navy')) + P('M22 -10L34 -4L32 14L22 10Z', gid('navy'))), { sh: 26 });
function kabuto(x, y, s, o) {
  o = o || {};
  let k = P('M-18 4C-18 -14 -10 -22 0 -22C10 -22 18 -14 18 4Z', gid(o.mat || 'iron')) + L('M-10 -18C-8 -8 -8 -2 -8 4M0 -22V4M10 -18C8 -8 8 -2 8 4', '#9aa1aa', .7, op(.7));
  k += P('M-22 4C-24 10 -26 14 -28 16L-20 18L-18 6Z', gid(o.mat || 'iron')) + P('M22 4C24 10 26 14 28 16L20 18L18 6Z', gid(o.mat || 'iron')) + R(-19, 2, 38, 5, 1.6, gid('gold'));
  if (o.maedate === 'moon') k += P('M-14 -14C-10 -32 10 -32 14 -14C8 -26 -8 -26 -14 -14Z', gid('gold'));
  if (o.maedate === 'horn') k += P('M-6 -14C-14 -24 -18 -34 -16 -40C-12 -30 -8 -24 -2 -18Z', gid('gold')) + P('M6 -14C14 -24 18 -34 16 -40C12 -30 8 -24 2 -18Z', gid('gold'));
  if (o.maedate === 'sun') k += C(0, -24, 7, '#c8452e') + rays(0, -24, 8, 12, 12, '#e2bd62', 1, 1.2);
  return at(x, y, 0, s, k);
}
ART.ooyoroi = () => armorScene(at(42, 68, 0, .95, kabuto(0, -32, 1.05, { maedate: 'horn', mat: 'navy' }) + P('M-22 -14C-10 -18 10 -18 22 -14L24 10H-24Z', gid('red')) + L('M-16 -10C-6 -13 6 -13 16 -10', '#e2bd62', 1.2) + mon(0, -4, 5) + odoshi(-24, 10, 48, 4, 6, '#f3ead6', 'red') +
  P('M-24 -14L-38 -8L-36 18L-24 14Z', gid('red')) + P('M24 -14L38 -8L36 18L24 14Z', gid('red')) + odoshi(-38, -6, 12, 3, 7, '#f3ead6', 'red').replace(/rx="1"/g, 'rx=".6"')), { sh: 28 });
ART.odate = () => armorScene(at(40, 66, -3, 1, R(-26, -40, 52, 78, 3, gid('dwood')) + L('M-13 -40V38M0 -40V38M13 -40V38', '#3a2312', 1) + [-30, -6, 18].map(y => R(-28, y, 56, 5, 1.2, gid('iron')) + [-20, -6, 6, 20].map(x => Cn(x, y + 2.5, 1.2, '#e2bd62')).join('')).join('') + C(0, 6, 10, '#2b2846') + T(0, 11, 14, '大', '#e2bd62')), { sh: 28 });
ART.jomon = () => artBg('armor', { dx: 42, dy: 30, my: 108 }) + P('M2 34L50 18L98 34L94 40H6Z', '#2b2846') + R(10, 40, 80, 70, 1, gid('dwood')) + L('M50 40V110', INK, 1.6) +
  [52, 70, 88].map(y => R(10, y, 80, 4, 0, gid('iron')) + [18, 30, 42, 58, 70, 82].map(x => Cn(x, y + 2, 1.3, '#e2bd62')).join('')).join('') + C(44, 80, 2.6, gid('gold')) + C(56, 80, 2.6, gid('gold')) + Rn(0, 110, 100, 14, 0, '#3a3530');
ART.nanban = () => armorScene(at(42, 66, 0, 1, P('M-22 -34C-12 -40 12 -40 22 -34L24 4C24 20 14 32 0 34C-14 32 -24 20 -24 4Z', gid('steel')) + L('M0 -38V34', '#7d8693', 1.4) + Pn('M-18 -28C-10 -32 -4 -32 -2 -30L-4 20C-10 18 -16 10 -18 0Z', '#fff', op(.35)) + L('M-24 -4C-12 2 12 2 24 -4', '#7d8693', 1) + C(0, -16, 4, gid('gold')) + Cn(-14, 14, 1.2, '#7d8693') + Cn(14, 14, 1.2, '#7d8693')));
ART.ishigaki = () => artBg('armor', { dx: 40, dy: 34, my: 112 }) + Pn('M0 124V70C30 66 70 66 100 56V124Z', '#3a3530') + (() => { let s = ''; const r = rng(77); for (let row = 0; row < 6; row++) for (let i = 0; i < 6; i++) { const x = -6 + i * 18 + (row % 2) * 9 + r() * 3, y = 54 + row * 11 - (6 - i) * row * .3; s += P('M' + f1(x) + ' ' + f1(y) + 'l16 -1l2 10l-17 1z', gid('stone')); } return s; })();
ART.tenshu = () => artBg('armor', { dx: 40, dy: 30, my: 110 }) + cloud(56, 36, .7, '#efe6cf') + (() => {
  let s = Pn('M4 124L12 96H72L80 124Z', '#5c5548') + L('M8 110H76', '#3a3530', 1);
  [[16, 96, 52, 16], [22, 74, 40, 14], [28, 54, 28, 12]].forEach(([x, y, w, h], i) => { s += R(x, y - h, w, h, 0, '#f3ead6') + [1, 2, 3].map(k => R(x + w * k / 4 - 2, y - h + 4, 4, 5, 0, '#2b2846')).join('') + P('M' + (x - 8) + ' ' + (y - h) + 'Q' + (x + w / 2) + ' ' + (y - h - 10) + ' ' + (x + w + 8) + ' ' + (y - h) + 'L' + (x + w + 4) + ' ' + (y - h + 3) + 'L' + (x - 4) + ' ' + (y - h + 3) + 'Z', '#2b3456'); });
  s += P('M34 42Q42 30 50 42Z', gid('gold')) + P('M30 44l-4 -6l6 3zM54 44l4 -6l-6 3z', gid('gold'));
  return s;
})();
ART.kongo = () => artBg('armor', { dx: 42, dy: 46, dr: 34 }) + rays(42, 60, 26, 52, 24, '#dfe8ff', .55, 1.2) + armorScene('', { sh: 24 }).slice(0, 0) + shadow(42, 114, 24) + at(42, 64, 0, 1.05, P('M-22 -30C-12 -36 12 -36 22 -30L24 6C24 22 14 32 0 34C-14 32 -24 22 -24 6Z', gid('silver')) + P(flowerPath(0, -6, 14, 8), '#eaf2ff', ' stroke-width=".9"') + P('M0 -18L8 -6L0 6L-8 -6Z', gid('sky')) + L('M0 -18L0 6M-8 -6H8', '#fff', .7) + odoshi(-22, 22, 44, 1, 7, '#e2bd62', 'silver')) + sparks(52, 14, 8, 10, 70, 90, '#ffffff', 2);
ART.iwato = () => artBg('armor', { dx: 50, dy: 60, dr: 40, nodisc: true }) + Pn('M0 124V40C14 22 34 12 54 14C76 16 92 30 100 44V124Z', '#3c352e') +
  Pn('M18 124C18 84 28 58 50 52C66 60 74 86 74 124Z', '#fff3c0') + rays(46, 82, 8, 70, 22, '#fff3c0', .22, 2.4) +
  P('M40 124C36 96 42 70 62 60C80 64 92 84 92 124Z', gid('stone')) + L('M52 70C58 80 60 96 58 124M70 66C78 80 82 100 80 124', '#3c352e', .9, op(.6)) +
  rope(6, 32, 92, 34, 5) + shide(24, 37, 1) + shide(44, 40, 1) + shide(64, 39, 1);

/* ---- 防具（属性つき） ---- */
ART.hiyoke = () => artBg('火', { dx: 42, dy: 42 }) + at(42, 62, -4, 1, flame(0, 34, 26, { wr: .7, fill: '#f6a33a' })).slice(0, 0) + flame(26, 112, 24) + flame(58, 114, 20) + ofuda(26, 22, 30, 74, { char: '火', stamp: '除' });
ART.hinezumi = () => armorScene(at(42, 64, 0, 1, P('M-16 -36L-4 -30L0 -24L4 -30L16 -36L30 -22L22 -14L20 36H-20L-22 -14L-30 -22Z', gid('red')) + P('M-4 -30L0 -24L4 -30L2 36H-2Z', gid('gold')) + Pn('M-20 -10L20 -10L20 36H-20Z', 'url(#pt-hono)', op(.6)) +
  L('M-20 30C-12 24 -6 34 0 28C6 34 12 24 20 30', '#ffe28a', 1.2)) + flame(16, 110, 14, { wr: .6 }) + flame(68, 108, 12, { wr: .6 }), { th: '火' });
ART.namiyoke = () => artBg('水', { dx: 42, dy: 44 }) + waveCrest(4, 116, 46) + waveCrest(40, 120, 36, { fill: gid('sky') }) + ofuda(28, 20, 28, 64, { char: '波', stamp: '除', line: '#2b3f6b' });
ART.ryusui = () => artBg('水', { dx: 42, dy: 44 }) + shadow(42, 114, 22) + at(42, 64, -10, 1, P('M-30 -14C-10 -24 10 -6 30 -16L30 12C10 22 -10 4 -30 14Z', gid('blue')) + L('M-28 -6C-10 -14 10 2 28 -8M-28 4C-10 -4 10 12 28 2', '#cfe4ff', 1.2) + R(-6, -12, 12, 22, 2, gid('gold')) + L('M-4 -12C-12 10 -16 26 -10 40M4 -12C10 10 16 24 12 38', '#2b3f6b', 4) + L('M-4 -12C-12 10 -16 26 -10 40M4 -12C10 10 16 24 12 38', '#7fa6e0', 2));
ART.wara = () => artBg('木', { dx: 42, dy: 44 }) + shadow(42, 114, 22) + at(42, 70, 0, 1, (() => { let s = ''; for (let i = -12; i <= 12; i++) s += L('M' + (i * 1.4) + ' -36C' + (i * 1.6) + ' -10 ' + (i * 1.2) + ' 10 ' + (i * 2) + ' 40', i % 2 ? '#d1ac5a' : '#f1d98e', 2.2); return s; })() + R(-20, -12, 40, 6, 2, '#8e6d2c') + R(-22, 14, 44, 6, 2, '#8e6d2c') + L('M-20 -9h40M-22 17h44', '#c8452e', 1));
ART.takegaki = () => artBg('木', { dx: 42, dy: 40, my: 112 }) + [8, 20, 32, 44, 56, 68].map((x, i) => P('M' + (x - 4) + ' ' + (36 + (i % 2) * 6) + 'L' + (x + 4) + ' ' + (32 + (i % 2) * 6) + 'V112H' + (x - 4) + 'Z', gid('bamboo')) + L('M' + (x - 4) + ' 62H' + (x + 4) + 'M' + (x - 4) + ' 88H' + (x + 4), INK, .9)).join('') +
  R(0, 54, 78, 5, 2, gid('bamboo')) + R(0, 84, 78, 5, 2, gid('bamboo')) + [8, 32, 56].map(x => L('M' + (x - 3) + ' 54l6 5M' + (x - 3) + ' 84l6 5', '#3a2312', 1.4)).join('');
ART.donabe = () => artBg('土', { dx: 42, dy: 42 }) + shadow(42, 112, 26) + at(42, 84, 0, 1, P('M-30 0C-30 -16 -16 -22 0 -22C16 -22 30 -16 30 0Z', gid('clay')) + E(0, 0, 30, 5, gid('clay')) + L('M-24 -6C-12 -12 12 -12 24 -6', '#f3ead6', 1.2, op(.7)) + R(-6, -30, 12, 9, 4, gid('clay')) + L('M-14 -14l3 3M10 -15l3 3', '#f3ead6', .8)) + L('M30 40c2 -6 -2 -10 0 -16M44 36c2 -6 -2 -10 0 -16', '#f3ead6', 1.4, op(.6));
ART.dorui = () => artBg('土', { dx: 42, dy: 36, my: 112 }) + Pn('M0 124V78C20 64 60 60 100 70V124Z', '#6e4a1c') + P('M0 96C20 76 60 70 100 82V124H0Z', gid('clay')) + L('M4 104C24 90 60 86 96 94M8 114C30 102 60 100 92 106', '#5e3a18', 1) +
  [12, 26, 40, 54, 68].map(x => R(x - 2, 52, 4, 30, 1, gid('wood')) + P('M' + (x - 2) + ' 52l2 -5l2 5z', gid('wood'))).join('') + L('M8 60H72M8 70H72', '#6a4220', 1.8);
ART.kabuto = () => armorScene(kabuto(42, 74, 1.4, { maedate: 'moon', mat: 'iron' }), { th: '金', sh: 26 });
ART.haganetate = () => armorScene(at(42, 66, 0, 1, C(0, 0, 30, gid('steel')) + C(0, 0, 24, 'none', ' stroke="#7d8693" stroke-width="1"') + Array.from({ length: 12 }, (_, i) => Cn(Math.cos(i * Math.PI / 6) * 27, Math.sin(i * Math.PI / 6) * 27, 1.3, '#4a515b')).join('') + C(0, 0, 9, gid('iron')) + Pn('M-18 -18A26 26 0 0 1 8 -24A24 24 0 0 0 -16 -8Z', '#fff', op(.5))), { th: '金', sh: 24 });

/* ---- 防具（特別） ---- */
ART.kekkai = () => artBg('spell', { dx: 42, dy: 50, dr: 34 }) + C(42, 62, 30, 'none', ' stroke="#e2bd62" stroke-width="1.6" stroke-dasharray="3 2"') + C(42, 62, 24, 'none', ' stroke="#e2bd62" stroke-width=".8"') + rope(10, 30, 74, 30, 4.4) + shide(24, 34, .9) + shide(52, 34, .9) + ofuda(30, 38, 24, 58, { char: '結', stamp: '界' });
ART.kagami = () => artBg('spell', { dx: 42, dy: 54, dr: 36 }) + rays(42, 60, 26, 58, 20, '#fff3c0', .45, 1.6) + shadow(42, 114, 20) + C(42, 60, 26, gid('gold')) + C(42, 60, 21, gid('silver')) + Pn('M26 50A18 18 0 0 1 50 42A20 20 0 0 0 30 62Z', '#fff', op(.75)) +
  Array.from({ length: 8 }, (_, i) => Cn(42 + Math.cos(i * Math.PI / 4) * 23.5, 60 + Math.sin(i * Math.PI / 4) * 23.5, 1.2, '#9c7426')).join('') + R(38, 86, 8, 12, 2, gid('gold')) + L('M42 98q-6 8 -2 14M42 98q6 8 2 14', '#c8452e', 1.6);
ART.hauchiwa = () => artBg('木', { dx: 42, dy: 46 }) + shadow(42, 114, 16) + at(42, 64, -8, 1, Array.from({ length: 9 }, (_, i) => at(0, 0, -64 + i * 16, 1, feather(0, 0, 34, i % 2 ? '#2b2846' : '#3d3a5a'))).join('') + C(0, 0, 5, gid('gold')) + R(-2.6, 2, 5.2, 34, 2, gid('red')) + C(0, 38, 2.6, gid('gold'))) + wind(6, 100, 1, '#efe0b0') + wind(48, 30, .7, '#efe0b0');
ART.migawari = () => artBg('spell', { dx: 42, dy: 44 }) + shadow(42, 114, 16) + at(42, 72, 0, 1, P('M-14 -6C-14 18 -10 34 0 36C10 34 14 18 14 -6Z', gid('wood')) + L('M-12 6C-4 10 4 10 12 6M-12 18C-4 22 4 22 12 18', '#c8452e', 1.6) + sakura(0, 26, .8) + C(0, -20, 14, gid('wood')) + P('M-14 -22C-14 -36 14 -36 14 -22C10 -30 -10 -30 -14 -22Z', '#2a2530') +
  L('M-6 -20q2 -2 4 0M2 -20q2 -2 4 0', INK, 1) + L('M-2 -12q2 1.4 4 0', '#c8452e', 1.2) + Cn(-8, -15, 2, '#f08a8a', op(.5)) + Cn(8, -15, 2, '#f08a8a', op(.5))) + L('M10 56l8 6M74 56l-8 6M12 84l8 -2', '#efe6cf', 1.4, op(.7));
ART.minokasa = () => artBg('木', { dx: 42, dy: 40 }) + shadow(42, 116, 22) + at(42, 74, 0, 1, (() => { let s = P('M-6 -40C-14 -20 -26 10 -32 40H32C26 10 14 -20 6 -40Z', gid('straw')); for (let i = -6; i <= 6; i++) s += L('M' + (i * .9) + ' -38C' + (i * 3) + ' -8 ' + (i * 4.4) + ' 14 ' + (i * 5) + ' 40', '#8e6d2c', .8, op(.8)); [-16, 0, 16, 30].forEach(y => { s += L('M' + f1(-10 - (y + 40) * .27) + ' ' + y + 'C-4 ' + (y + 3) + ' 4 ' + (y + 3) + ' ' + f1(10 + (y + 40) * .27) + ' ' + y, '#6e5222', 1.2); }); return s; })() +
  P('M-30 -30C-20 -52 20 -52 30 -30C16 -24 -16 -24 -30 -30Z', gid('straw'))) + Pn('M0 124V100C30 108 70 108 100 100V124Z', '#cfd8d0', op(.25)) + mist(60, '#efe6cf', .35) + mist(80, '#efe6cf', .3, true);

/* ---- 術 ---- */
ART.kitsunebi = () => artBg('火', { dx: 42, dy: 48 }) + [[22, 50, 16], [46, 36, 20], [60, 62, 14], [30, 82, 12]].map(([x, y, h]) => flame(x, y, h, { wr: .55, fill: gid('sky'), core: '#ffffff' })).join('') +
  shadow(42, 114, 16) + at(42, 96, 0, 1, P('M-14 -10L-18 -26L-6 -16C-2 -18 2 -18 6 -16L18 -26L14 -10C16 -2 10 8 0 12C-10 8 -16 -2 -14 -10Z', '#fbf3e2') + P('M-12 -12L-15 -22L-8 -15Z', '#c8452e') + P('M12 -12L15 -22L8 -15Z', '#c8452e') +
  L('M-10 -6l6 2M10 -6l-6 2', '#c8452e', 1.6) + Cn(0, 6, 1.6, INK) + L('M-12 0l-6 -2M12 0l6 -2', '#c8452e', .9));
ART.kamaitachi = () => artBg('木', { dx: 42, dy: 46 }) + L('M14 104C-2 94 4 74 22 74C38 74 40 94 26 98C16 100 12 90 20 88', '#f3ead6', 1.6, op(.7)) + wind(4, 50, 1.3, '#efe0b0', 1.4) + wind(14, 104, 1.1, '#efe0b0', 1.2) +
  at(34, 74, -8, 1.1, P('M-20 4C-30 2 -36 -8 -34 -20C-32 -30 -24 -34 -18 -30C-24 -26 -26 -18 -22 -10C-20 -4 -16 0 -14 2Z', '#c99550') +
    P('M-14 6C-14 16 -6 22 4 22C-2 18 -8 14 -10 6Z', gid('steel')) +
    P('M-20 6C-22 -4 -12 -10 0 -10C10 -10 14 -14 16 -20L26 -16C24 -6 20 0 14 4C6 10 -10 14 -20 6Z', '#d8a868') + Pn('M-12 8C-4 12 8 8 14 2C8 6 -2 8 -12 8Z', '#f3dfb4') +
    E(21, -20, 8, 7, '#d8a868') + P('M27 -23L35 -19.5L27 -15Z', '#d8a868') + P('M15 -25L16 -32L21 -27Z', '#c99550') + Cn(24, -22, 1.2, INK) + Cn(34.5, -19.5, 1, INK) + Pn('M24 -15C27 -14 30 -15 32 -17', '#f3dfb4') +
    P('M12 2C18 10 30 12 38 6C30 8 22 6 16 0Z', gid('steel')) + L('M16 3C22 8 28 9 34 7', '#fff', .6, op(.8))) +
  L('M60 30l8 -10M64 42l10 -6', '#fff', 1, op(.7));
ART.raimei = () => artBg('spell', { dx: 42, dy: 44, dr: 34 }) + cloud(4, 36, 1.4, '#2c2448') + cloud(44, 28, 1.2, '#2c2448') + (() => { let s = ''; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; s += at(42 + Math.cos(a) * 26, 60 + Math.sin(a) * 26, 0, 1, C(0, 0, 5.4, gid('red')) + L('M-2 -2q2 4 4 0', '#e2bd62', 1)); } return s; })() + C(42, 60, 26, 'none', ' stroke="#e2bd62" stroke-width="1.6"') +
  P('M48 30L32 62H44L36 96L60 54H46L56 30Z', gid('gold'), ' stroke-width="1.4"') + Pn('M48 30L40 48H46Z', '#fff', op(.6));
ART.tsunami = () => artBg('水', { dx: 66, dy: 30, dr: 16 }) + waveCrest(-6, 118, 90) + waveCrest(40, 124, 40, { fill: gid('sky') }) + Pn('M0 124C20 112 40 116 60 112C80 108 90 114 100 110V124Z', '#13234a') + [[70, 40], [78, 54], [64, 50]].map(([x, y]) => Cn(x, y, 1.6, '#fff', op(.8))).join('');
ART.tamasui = () => artBg('spell', { dx: 42, dy: 46 }) + [[22, 40, 1], [56, 34, .8], [30, 80, .9]].map(([x, y, sc]) => at(x, y, 0, sc, P('M0 10C-8 10 -10 0 -6 -6C-2 -12 6 -12 8 -6C8 -2 6 2 2 2C10 6 6 14 -2 18C2 12 4 10 0 10Z', '#cfe8ff', op(.85)) + Pn('M-2 -4A3 3 0 1 1 3 -4A3 3 0 1 1 -2 -4Z', '#fff'))).join('') +
  L('M22 52C30 64 38 70 44 80M56 46C52 60 48 70 46 80M30 92C36 90 40 88 44 86', '#cfe8ff', 1.4, ' stroke-dasharray="3 3" opacity=".8"') + shadow(44, 114, 18) + at(44, 96, 0, 1, P('M-12 -14C-12 -22 12 -22 12 -14L10 8C10 12 -10 12 -10 8Z', '#3a2f4a') + E(0, -14, 12, 4, '#14101c') + Pn('M-8 -14C-4 -18 4 -18 8 -14C4 -12 -4 -12 -8 -14Z', '#cfe8ff', op(.6)));
ART.noroi = () => artBg('spell', { dx: 42, dy: 46 }) + P('M20 0C22 40 18 80 24 124H58C54 80 56 40 60 0Z', '#3a2a20') + L('M30 10C32 40 28 80 32 120M46 6C44 40 48 80 46 120', '#241a14', 1) + shadow(42, 114, 14) +
  at(42, 66, 0, 1, (() => { let t = P('M-6 -34C-12 -34 -12 -22 -6 -20L-8 -14L-24 -10L-22 -6L-8 -8L-10 14L-14 34H-8L0 16L8 34H14L10 14L8 -8L22 -6L24 -10L8 -14L6 -20C12 -22 12 -34 6 -34Z', gid('straw')); for (let i = -3; i <= 3; i++) t += L('M' + i * 1.6 + ' -32L' + i * 1.4 + ' 10', '#8e6d2c', .5, op(.7)); return t + L('M-10 -10H10M-8 8H8', '#c8452e', 1.4) + Rn(-6, -3, 12, 9, 0, '#fffdf6') + T(0, 4.4, 7, '呪', '#c8452e'); })() +
    L('M20 -4L-2 -2', '#aab2bd', 2.2) + C(21, -4, 2.4, gid('iron'))) + at(66, 46, 30, 1, R(-3, 0, 6, 18, 1, gid('dwood')) + R(-7, -4, 14, 6, 1, gid('iron')));
ART.fuin = () => artBg('spell', { dx: 42, dy: 46, dr: 34 }) + C(42, 58, 30, 'none', ' stroke="#c8452e" stroke-width="1.4"') + P('M42 30L52 72L18 46H66L32 72Z', 'none', ' stroke="#c8452e" stroke-width="1.4"') + at(42, 60, 12, 1, ofuda(-12, -32, 24, 62, { char: '封', stamp: '印' })) + at(42, 60, -14, .9, ofuda(-12, -30, 24, 60, { char: '封', stamp: '印' })).slice(0, 0);
ART.kamikakushi = () => artBg('spell', { dx: 44, dy: 40 }) + torii(42, 100, 1) + Pn('M0 82C20 74 40 80 60 74C80 68 90 76 100 72V124H0Z', '#d9d0e8', op(.35)) + mist(70, '#e8def5', .5) + mist(88, '#e8def5', .45, true) + mist(104, '#e8def5', .5) +
  at(58, 62, -20, 1, P('M0 0C-2 -8 2 -16 6 -18L8 -10C10 -12 12 -12 12 -10L10 -2C8 4 4 6 0 6Z', '#efe6f8', op(.8)));
function torii(x, y, s) { return at(x, y, 0, s, R(-24, -64, 6, 64, 1, gid('red')) + R(18, -64, 6, 64, 1, gid('red')) + P('M-34 -70C-20 -66 20 -66 34 -70L32 -62C18 -60 -18 -60 -32 -62Z', '#2a1f18') + R(-28, -60, 56, 5, 1, gid('red')) + R(-26, -48, 52, 4, 1, gid('red')) + R(-3, -60, 6, 12, .5, gid('red'))); }
ART.iyashi = () => artBg('item', { dx: 42, dy: 46 }) + [[16, 30, 30], [60, 26, -20], [24, 88, 60], [64, 80, 10], [10, 60, 0], [52, 104, 40], [34, 18, 80]].map(([x, y, r]) => petal(x, y, 1.1, r)).join('') + shadow(42, 114, 18) +
  at(40, 84, -14, 1, sensu(40, 120, 'paper', { fill: gid('rose'), disc: '#fff3e8' })) + at(40, 84, -14, 1, sakura(0, -26, 1.1, '#fff'));
ART.kirigakure = () => artBg('spell', { dx: 42, dy: 42 }) + shadow(42, 114, 16) + at(42, 76, 0, 1, P('M-12 -26C-12 -36 12 -36 12 -26C12 -18 10 -14 8 -12L18 -4L14 30H-14L-18 -4L-8 -12C-10 -14 -12 -18 -12 -26Z', '#1a1624') +
    L('M-12 -26C-12 -36 12 -36 12 -26C12 -18 10 -14 8 -12L18 -4L14 30', '#8a76b8', .9, op(.8)) + Rn(-9, -28, 18, 5, 2, '#d8cfe6') + Cn(-4, -25.5, 1, INK) + Cn(4, -25.5, 1, INK) + L('M-10 -2L10 20M10 -2L-10 20', '#3a3058', 1.2) +
    at(-16, 4, -30, 1, P('M0 -14C2 -8 2 -4 1 0H-1C-2 -4 -2 -8 0 -14Z', gid('steel')) + R(-1, 0, 2, 7, .6, '#2b2846'))) +
  mist(52, '#e8def5', .55) + mist(74, '#e8def5', .6, true) + mist(94, '#e8def5', .6) + mist(108, '#e8def5', .5, true) + sparks(13, 10, 6, 30, 60, 60, '#e8def5', 1.4);

/* ---- 道具 ---- */
const itemScene = (inner, o) => artBg((o && o.th) || 'item', { dx: 42, dy: 44 }) + shadow(42, 112, (o && o.sh) || 22) + inner;
ART.onigiri = () => itemScene(at(40, 80, 0, 1, P('M0 -28C6 -28 26 6 24 14C22 22 -22 22 -24 14C-26 6 -6 -28 0 -28Z', '#fffdf6') + Pn('M-2 -22C-4 -16 -10 -6 -12 0', '#fff', op(.9)) + R(-9, -2, 18, 20, 1, '#1e2a22') + L('M-9 4h18M-9 10h18', '#3a4a3c', .6) + Cn(-12, -8, .9, '#d8cfb4') + Cn(10, -4, .9, '#d8cfb4')) + at(60, 98, 0, 1, E(0, 0, 8, 3, '#7a1f1a') + En(0, -1, 6, 1.6, '#c8452e')));
ART.dango = () => itemScene(at(40, 66, -30, 1, L('M0 -40V40', '#d8b878', 2.4) + L('M0 -40V40', INK, .4) + C(0, -22, 10, gid('rose')) + C(0, -2, 10, gid('white')) + C(0, 18, 10, gid('leaf')) + [-22, -2, 18].map(y => En(-3, y - 4, 3, 2, '#fff', op(.6))).join('')) + petal(64, 30, 1.2, 20) + petal(16, 96, 1, -30));
ART.yakuto = () => itemScene(at(42, 86, 0, 1, P('M-18 -22H18L14 10C14 14 -14 14 -14 10Z', gid('clay')) + E(0, -22, 18, 4.4, gid('clay')) + En(0, -22, 15, 3, '#5e7a3a') + L('M-14 -6H14', '#f3ead6', 1, op(.6)) + E(0, 14, 22, 4, gid('wood'))) + L('M34 52c4 -8 -4 -12 0 -20M44 50c4 -8 -4 -12 0 -20M54 52c4 -8 -4 -12 0 -20', '#fffdf6', 1.4, op(.75)) + at(64, 98, 30, 1, leafOak(0, 0, 12)));
ART.sento = () => itemScene(at(40, 76, 0, 1, P('M0 -22C14 -24 26 -12 24 4C22 20 10 26 0 26C-10 26 -22 20 -24 4C-26 -12 -14 -24 0 -22Z', gid('rose')) + L('M0 -20C-4 -6 -4 10 0 24', '#b24a63', 1) + En(-10, -4, 5, 8, '#fff', op(.35)) +
  at(-2, -22, -30, 1, P('M0 0C-6 -4 -16 -2 -20 4C-12 6 -6 4 0 0Z', gid('leaf'))) + at(2, -22, 20, 1, P('M0 0C6 -6 16 -6 20 0C12 4 6 4 0 0Z', gid('leaf')))) + cloud(54, 36, .8, '#fffdf6') + sparks(3, 8, 12, 20, 60, 30, '#fff8e0', 1.6));
function hyotan(x, y, s, mat) { return at(x, y, 0, s, P('M0 -30C5 -30 6 -24 4 -20C10 -16 10 -8 6 -4C14 0 16 12 12 20C8 28 -8 28 -12 20C-16 12 -14 0 -6 -4C-10 -8 -10 -16 -4 -20C-6 -24 -5 -30 0 -30Z', gid(mat || 'clay')) + R(-3, -34, 6, 5, 1.4, gid('wood')) + L('M-6 -4C-2 -2 2 -2 6 -4', '#c8452e', 1.6) + Pn('M-8 6C-6 0 -4 -2 -2 -2C-6 4 -6 12 -4 18C-8 16 -9 10 -8 6Z', '#fff', op(.35))); }
ART.reisui = () => itemScene(hyotan(40, 82, 1, 'sky') + drop(60, 40, 6, gid('sky')) + sparks(6, 8, 50, 20, 26, 40, '#fff', 1.4));
ART.reiyaku = () => itemScene(hyotan(40, 82, 1.05, 'purple') + Rn(33, 84, 14, 10, 1, '#fffdf6', ' stroke="' + INK + '" stroke-width=".6"') + T(40, 92, 8, '霊', '#5a3f78') + sparks(8, 8, 52, 24, 24, 40, '#f1e5ff', 1.4));
ART.magatama = () => itemScene(at(42, 74, 0, 1.3, P('M4 -26C18 -26 26 -14 24 0C22 16 8 28 -10 30C-2 22 2 14 -2 8C-12 8 -18 0 -18 -8C-18 -20 -8 -26 4 -26Z', gid('jade')) + C(2, -10, 4, '#14261c') + Pn('M-10 -16C-6 -22 2 -24 8 -22C2 -20 -4 -18 -8 -12Z', '#fff', op(.5))) + L('M14 36C28 42 46 42 62 34', '#c8452e', 1.4) + Cn(62, 34, 2.6, gid('jade')) + Cn(14, 36, 2.6, gid('gold')));
ART.hoju = () => itemScene([0, 40, 80, 120, 160, 200, 240, 280, 320].map(a => at(40, 70, a, 1, flame(0, -20, 16, { wr: .5 }))).join('') + at(40, 74, 0, 1, P('M0 -26C4 -18 18 -10 18 4C18 16 10 22 0 22C-10 22 -18 16 -18 4C-18 -10 -4 -18 0 -26Z', gid('sky')) + Pn('M-8 -4C-6 -12 -2 -16 0 -18C-2 -10 -4 -2 -4 6C-8 6 -9 2 -8 -4Z', '#fff', op(.6)) + L('M-18 4C-10 8 10 8 18 4', '#fff', .8, op(.5))) + at(40, 100, 0, 1, P('M-14 0C-14 -6 14 -6 14 0L10 6H-10Z', gid('gold'))));
function bag(x, y, s, mat, tie) { return at(x, y, 0, s, P('M-6 -22C-4 -26 4 -26 6 -22L4 -16C16 -12 22 2 20 12C18 22 -18 22 -20 12C-22 2 -16 -12 -4 -16Z', gid(mat)) + L('M-6 -16C-2 -14 2 -14 6 -16', tie || '#c8452e', 2.2) + Pn('M-14 0C-12 -6 -8 -10 -4 -12C-8 -4 -10 4 -10 12C-14 10 -15 4 -14 0Z', '#fff', op(.3))); }
ART.zenibukuro = () => itemScene(bag(38, 82, 1.2, 'navy', '#e2bd62') + zeni(62, 100, 5.4) + zeni(52, 106, 4.6) + zeni(68, 90, 4.2) + Rn(29, 78, 18, 11, 2, '#efe6cf') + T(38, 87, 8, '銭', '#2b3456'));
ART.koban = () => itemScene(bag(36, 80, 1.05, 'red', '#e2bd62') + koban(60, 96, 1, -20) + koban(52, 104, .9, 30) + koban(68, 82, .8, 10) + sparks(12, 10, 46, 60, 30, 40, '#fff3c0', 1.6));
ART.senryobako = () => itemScene(at(40, 82, 0, 1, R(-26, -16, 52, 30, 1, gid('dwood')) + P('M-26 -16L-22 -28H22L26 -16Z', gid('wood')) + R(-26, -12, 52, 4, 0, gid('iron')) + R(-26, 6, 52, 4, 0, gid('iron')) + R(-6, -10, 12, 12, 1, gid('gold')) + C(0, -4, 2, INK) + T(0, 2, 0, '')) +
  koban(28, 54, .9, -20) + koban(42, 50, 1, 0) + koban(56, 56, .9, 24) + koban(34, 46, .8, -40) + sparks(14, 12, 18, 30, 50, 30, '#fff3c0', 1.8), { sh: 28 });
ART.kozuchi = () => itemScene(at(40, 74, -24, 1, R(-3, 0, 6, 40, 2, gid('red')) + R(-22, -20, 44, 22, 6, gid('red')) + R(-23, -21, 6, 24, 2, gid('gold')) + R(17, -21, 6, 24, 2, gid('gold')) + mon(0, -9, 7) + L('M-14 -2h28', '#e2bd62', .8) + C(0, 42, 3, gid('gold'))) + koban(62, 100, .8, 20) + koban(18, 104, .7, -20) + sparks(19, 16, 10, 16, 64, 50, '#fff3c0', 2));
ART.omiki = () => itemScene(at(28, 84, 0, 1, heishi()) + at(52, 84, 0, 1, heishi()) + R(18, 94, 44, 6, 1, gid('wood')) + shide(36, 30, .8));
function heishi() { return P('M-4 -30H4L5 -24C12 -18 12 -4 10 6L8 14H-8L-10 6C-12 -4 -12 -18 -5 -24Z', gid('white')) + R(-5, -34, 10, 5, 1.6, '#e8dcc0') + Pn('M-4 -32H4V-28H-4Z', '#c8452e', op(.85)) + Rn(-6, -14, 12, 14, 0, '#fffdf6', ' stroke="' + INK + '" stroke-width=".6"') + L('M-6 -10h12M-6 -4h12', '#c8452e', .6); }
ART.shio = () => itemScene(at(42, 92, 0, 1, E(0, 6, 24, 6, gid('wood')) + E(0, 4, 20, 4.4, '#c99a55') + P('M-14 4L0 -30L14 4C8 8 -8 8 -14 4Z', gid('white')) + L('M-8 0L0 -22', '#fff', 1, op(.8))) + sparks(30, 12, 18, 30, 50, 30, '#ffffff', 1.4));
ART.maneki = () => itemScene(at(40, 80, 0, 1, P('M-16 26C-20 10 -18 -6 -12 -12C-16 -18 -16 -28 -12 -32L-6 -24C-2 -26 2 -26 6 -24L12 -32C16 -28 16 -18 12 -12C18 -6 20 10 16 26Z', '#fffdf6') +
  Cn(-6, -14, 1.4, INK) + Cn(6, -14, 1.4, INK) + L('M-2 -9q2 2 4 0', INK, .9) + L('M-10 -10l-8 -1M10 -10l8 -1', INK, .5) + P('M-14 -2C-8 2 8 2 14 -2', 'none', ' stroke="#c8452e" stroke-width="2.2"') + Cn(0, 1, 2.4, '#e2bd62') +
  P('M12 -2C18 -10 22 -20 18 -26C14 -24 12 -16 10 -10Z', '#fffdf6') + Cn(-8, -26, 1.6, '#f08a8a', op(.6)) + Cn(-4, 12, 3, '#c8452e', op(.85)) + koban(4, 14, .7, -10)) + koban(64, 100, .7, 20));
ART.jobutsu = () => artBg('spell', { dx: 42, dy: 46 }) + rays(42, 46, 16, 40, 16, '#fff3c0', .3) + at(42, 98, 0, 1, (() => { let s = ''; [-50, -25, 0, 25, 50].forEach((a, i) => s += at(0, 0, a, 1, P('M0 0C-6 -6 -6 -16 0 -22C6 -16 6 -6 0 0Z', i % 2 ? '#f7cbd5' : '#fbe4ea'))); return s; })()) + ofuda(30, 20, 24, 60, { char: '成', stamp: '仏' });
ART.sandatsu = () => artBg('spell', { dx: 42, dy: 46 }) + at(36, 40, -16, 1, ofuda(-12, -26, 24, 52, { char: '奪', stamp: '奪' })) + shadow(42, 114, 18) +
  at(46, 86, -30, 1.1, P('M-14 20C-16 10 -14 0 -8 -6L-4 -22C-3 -26 2 -26 2 -22L1 -10L6 -24C7 -28 12 -27 11 -23L8 -10L12 -20C13 -24 18 -23 17 -19L13 -6C16 -10 20 -8 19 -4L14 6C12 14 6 20 -2 22Z', '#5a4a72') + L('M-14 20L-2 22', INK, 1)) + L('M58 30l10 -6M62 42l12 -2', '#e8def5', 1.2, op(.7));
ART.oshiuri = () => itemScene(at(40, 78, -8, 1, R(-30, -14, 60, 26, 2, gid('dwood')) + L('M-30 -6H30', '#e8dcc0', 1.4) + [-24, -16, -8, 0, 8, 16, 24].map(x => L('M' + x + ' -14V12', '#c9b98e', .7)).join('') +
  [-24, -16, -8, 0, 8, 16, 24].map((x, i) => En(x, i % 3 ? 4 : -10, 3.4, 2.4, '#c99a55', ' stroke="' + INK + '" stroke-width=".5"') + En(x, i % 3 ? -2 : 6, 3.4, 2.4, '#c99a55', ' stroke="' + INK + '" stroke-width=".5"')).join('')) +
  L('M54 30L58 50', '#c8452e', 1) + at(58, 58, 10, 1, P('M-8 -8L8 -8L8 12L0 18L-8 12Z', gid('paper')) + C(0, -4, 1.4, '#c8452e') + T(0, 9, 10, '売', '#c8452e')) + koban(18, 46, .9, -20) + koban(28, 40, .8, 10), { sh: 30 });
ART.seiren = () => itemScene(at(40, 88, 0, 1, P('M-22 -16H22L18 14C18 20 -18 20 -18 14Z', gid('iron')) + E(0, -16, 22, 5, gid('iron')) + En(0, -16, 19, 3.4, '#f6a33a') + L('M-20 -2H20', '#9aa1aa', .8)) + flame(40, 72, 24, { wr: .5 }) +
  [[20, 38, '#e86a4e'], [40, 26, '#5a83c8'], [60, 38, '#e2bd62']].map(([x, y, c]) => C(x, y, 6, c) + En(x - 2, y - 2, 2, 1.4, '#fff', op(.6))).join('') + L('M24 42L36 58M40 32V52M56 42L44 58', '#fff3c0', 1, ' stroke-dasharray="2 2"') + rays(40, 70, 6, 12, 8, '#fff3c0', .6), { sh: 26 });

/* ---- 召喚札 ---- */
ART.shokan = () => artBg('summon', { dx: 42, dy: 50, dr: 34 }) + C(42, 60, 32, 'none', ' stroke="#f2c47c" stroke-width="1.4"') + C(42, 60, 26, 'none', ' stroke="#f2c47c" stroke-width=".8" stroke-dasharray="2 2"') + P('M42 30L56 74L18 46H66L28 74Z', 'none', ' stroke="#f2c47c" stroke-width="1.2"') +
  torii(42, 106, .6) + L('M44 86C24 80 22 64 36 58C52 52 60 40 46 30', '#8a5a1e', 9) + L('M44 86C24 80 22 64 36 58C52 52 60 40 46 30', '#e2bd62', 6.4) + L('M44 86C24 80 22 64 36 58C52 52 60 40 46 30', '#9c7426', 1, ' stroke-dasharray="1.6 2.4"') +
  at(46, 28, 0, 1, P('M-8 4C-10 -4 -4 -10 4 -10C10 -10 14 -6 14 -2L10 2C8 6 2 8 -4 8Z', gid('gold')) + P('M2 -10C2 -16 6 -20 10 -22C8 -16 8 -12 8 -10Z', '#efe6cf') + P('M-4 -8C-6 -14 -4 -18 -2 -20C-2 -14 0 -12 0 -10Z', '#efe6cf') + Cn(6, -4, 1.3, INK) + L('M14 -2C18 0 20 4 18 8M12 2C16 6 16 10 12 12', '#f3ead6', .9)) +
  cloud(6, 104, .9, '#f3d7c0') + cloud(54, 112, .8, '#f3d7c0') + sparks(23, 12, 10, 14, 66, 70, '#fff3c0', 1.8);

/* ---- 絵を1回だけ置く ---- */
function installArt() {
  const defs = document.getElementById('spriteDefs'); if (!defs) return;
  let h = artDefs();
  Object.keys(ART).forEach(id => { try { h += '<symbol id="art-' + id + '" viewBox="0 0 100 124">' + ART[id]() + '</symbol>'; } catch (e) { console.error('art', id, e); } });
  defs.insertAdjacentHTML('beforeend', h);
}
const hasArt = id => !!ART[id];
