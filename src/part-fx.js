/* =====================================================================
   LOOK & SOUND — 札の絵、式神の紋、効果音（Web Audio で合成）、BGM、演出
   ===================================================================== */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const wait = ms => new Promise(r => setTimeout(r, ms * SPEED));
const GKANJI = { tengu: '天', kitsune: '狐', gama: '蝦', oni: '邪', ryujin: '龍' };
const BKANJI = { seiryu: '青', suzaku: '朱', byakko: '白', genbu: '玄', kirin: '麟', yatagarasu: '烏', komainu: '狛', baku: '獏', kinkei: '鶏', shinigami: '死' };
const TYPE_LABEL = { weapon: '武器', plus: '追撃', armor: '防具', spell: '術', item: '道具', summon: '召喚' };
const ST_LABEL = { curse: '呪い', seal: '封印', mist: '霧隠れ', kiai: '気合' };
const ASSIST_NOTE = 'だれの番でも、番のはじめに10回に1回くらい';

/* ---------- card words ---------- */
/* 属性の攻めを、どの守札で守れるか */
function guardRule(elem, spell) {
  if (!elem) return 'どの守札でも守れる';
  return elem + 'の守札・' + strongerOf(elem) + 'の守札（' + elem + 'に強い）' + (spell ? '・結界札' : '') + 'で守れる';
}
function cardText(C) {
  if (!C) return '';
  switch (C.type) {
    case 'weapon': {
      let t = (C.all ? '相手全員に' : C.fx === 'rand' ? '自分以外のだれかにランダムで（味方に当たることも！）' : 'えらんだ1人に（味方もえらべる）') + (C.elem ? C.elem + 'の' : '') + '攻撃' + C.atk + '。' + (C.elem ? guardRule(C.elem) : '属性なし。' + guardRule(null));
      if (C.all) t += '。ほかの武器とは重ねられない（追撃札は足せる）';
      else t += C.elem ? '。' + C.elem + 'の武器どうし重ねられる（追撃札を足すと属性なしになる）' : '。追撃札だけ足せる';
      if (C.fx === 'draw') t += '。ダメージが通ったら札を1枚引く';
      return t;
    }
    case 'plus': return 'どの武器にも足せる。攻撃＋' + C.atk + '。属性の武器に足すと、属性なしの攻めになる（相性なし・どの守札でも守れる）';
    case 'armor':
      if (C.special === 'reflect') return '攻撃や術を、そっくり相手にはね返す。はね返された人も鏡を持っていれば、またはね返せる。属性に関係なく使える';
      if (C.special === 'deflect') return '攻撃や術を弾く。弾いた攻めは流れ弾になって、自分もふくめた全員の中からランダムに選ばれた1人に飛ぶ（飛んだ先の人は守札で守れる）。属性に関係なく使える';
      if (C.special === 'null') return '攻撃や術を、なかったことにする。属性に関係なく使える';
      if (C.special === 'dodge') return '武器の攻撃を、半分の確率でまるごとかわす。属性に関係なく使える';
      if (C.magic) return '守り' + C.def + '。術ならどの属性でも守れる。属性のない攻撃も守れる';
      if (C.elem) return '守り' + C.def + '。' + C.elem + 'の攻め、' + BEATS[C.elem] + 'の攻め（' + C.elem + 'が強い）、属性のない攻めを守れる。何枚でも重ねられる';
      return '守り' + C.def + '。属性のない攻めだけ守れる。何枚でも重ねられる';
    case 'spell': {
      const aim = aimOf(C);
      const who = aim === 'all' ? '相手全員' : aim === 'help' ? '自分かえらんだ人（だれでも）' : 'えらんだ1人（味方もえらべる）';
      const head = '霊力' + C.mp + 'で使う。使っても手札に残り、何度でも使える。';
      if (C.eff === 'dmg') return head + who + 'に' + (C.elem ? C.elem + 'の' : '') + C.val + 'ダメージ。' + guardRule(C.elem, true);
      if (C.eff === 'drain') return head + who + 'に' + C.val + 'ダメージ。与えた分だけ自分の体力が回復。' + guardRule(C.elem, true);
      if (C.eff === 'curse') return head + who + 'を呪う（番のはじめに体力−3を3回）。守札1枚で防げる';
      if (C.eff === 'seal') return head + who + 'を封印（2回の番のあいだ術が使えない）。守札1枚で防げる';
      if (C.eff === 'steal') return head + who + 'の手札をタダで1枚うばう。守れない';
      if (C.eff === 'heal') return head + who + 'の体力＋' + C.val + '（99まで）';
      if (C.eff === 'mist') return head + who + 'が、その人の次の番まで、ほかのだれにも狙われない';
      return head;
    }
    case 'item':
      if (C.eff === 'heal') return '自分かえらんだ人（だれでも）の体力＋' + C.val + '（はじめの体力より多くなってもよい。99まで）';
      if (C.eff === 'mp') return '自分かえらんだ人の霊力＋' + C.val + '（99まで）';
      if (C.eff === 'gold') return '自分かえらんだ人の小判＋' + C.val + '両';
      if (C.eff === 'kiai') return '自分かえらんだ人の、次の攻撃が＋5（気合）';
      if (C.eff === 'cleanse') return '自分かえらんだ人の呪いと封印を治して、体力＋' + C.val;
      if (C.eff === 'maneki') return '自分かえらんだ人の小判＋' + C.val + '両と霊力＋3';
      if (C.eff === 'jobutsu') return '霊獣を連れた人1人に使う。半分の確率で、その霊獣を成仏させる';
      if (C.eff === 'usurp') return 'えらんだ人の手札からランダムに1枚を見る。値段を払えば自分の札になる（払った小判はその人に渡る）。買わなければ戻す。守れない';
      if (C.eff === 'sell') return '自分の手札の札を1枚、えらんだ人に値段どおりに売りつける。小判が足りなければ霊力から、それでも足りなければ体力から払わせる。払いきれなければ成仏。守れない';
      if (C.eff === 'hpswap') return 'えらんだ人と、自分の体力を入れかえる。守れない';
      if (C.eff === 'shuffle') return '全員の手札（術札はのぞく）を集めてまぜ、もとの枚数ずつ配り直す';
      if (C.eff === 'refine') return '自分の体力・霊力・小判を、5ずつ好きなように入れかえる（体力は1より下にできない）';
      return '';
    case 'summon': return '霊力' + C.mp + 'で霊獣を1体呼んで、自分かえらんだ人（だれでも。龍神はのぞく）につける。どの霊獣が出るかはランダム（いまの霊獣とは別のもの）。霊獣は' + ASSIST_NOTE + '持ち主を助けてくれる';
  }
  return '';
}
const TYPE_SEAL = { weapon: '武', plus: '追', armor: '守', spell: '術', item: '道', summon: '召' };
const ELEM_NAME = { '木': 'もく', '火': 'か', '土': 'ど', '金': 'ごん', '水': 'すい' };
/* 家紋ふうの印（属性・天候）。どれも 24×24 の中に描く */
const CREST = {
  '木': '<path d="M12 12C9.6 9.2 9.6 5.4 12 2.6c2.4 2.8 2.4 6.6 0 9.4z"/><path d="M12 12C9.6 9.2 9.6 5.4 12 2.6c2.4 2.8 2.4 6.6 0 9.4z" transform="rotate(120 12 12)"/><path d="M12 12C9.6 9.2 9.6 5.4 12 2.6c2.4 2.8 2.4 6.6 0 9.4z" transform="rotate(240 12 12)"/><circle cx="12" cy="12" r="1.3"/>',
  '火': '<path d="M12.2 2.4c.4 3.1 3.3 4.9 4.6 7.8 1.6 3.6-.6 9.4-4.8 9.4-4.3 0-6.3-4.9-5-8.4.7-1.9 2.1-2.6 2.6-4.6.5 1.6.2 2.9 1.1 3.9.2-3 1.1-5.8 1.5-8.1z"/>',
  '土': '<path d="M12 1.9l4.4 4.4L12 10.7 7.6 6.3zM17.7 7.6l4.4 4.4-4.4 4.4-4.4-4.4zM12 13.3l4.4 4.4-4.4 4.4-4.4-4.4zM6.3 7.6l4.4 4.4-4.4 4.4L1.9 12z"/>',
  '金': '<path fill-rule="evenodd" d="M12 2.4a9.6 9.6 0 1 1 0 19.2 9.6 9.6 0 0 1 0-19.2zm-3 6.6v6h6V9z"/>',
  '水': '<g fill="none" stroke="currentColor" stroke-width="1.9"><path d="M2.6 19.5a9.4 9.4 0 0 1 18.8 0"/><path d="M6.3 19.5a5.7 5.7 0 0 1 11.4 0"/><path d="M9.9 19.5a2.1 2.1 0 0 1 4.2 0"/></g>',
  calm: '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 8h18M5 12h14M7 16h10"/></g>',
  fair: '<path d="M12 3.5c4.4 0 7 3.8 7 8.5s-2.6 8.5-7 8.5-7-3.8-7-8.5 2.6-8.5 7-8.5z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.6 9h12.8M5.2 12h13.6M5.6 15h12.8" stroke="currentColor" stroke-width="1.3"/><path d="M10 1.8h4v2h-4zM10 20.2h4v2h-4z"/>',
  moon: '<circle cx="12" cy="12" r="8.6"/>',
  storm: '<path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M12 12.2c0-1 1.6-1.4 2.2-.4.9 1.6-.8 3.6-2.8 3.3-2.6-.4-3.6-3.6-2-5.8 2-2.8 6.6-2.4 8.2.8 1.8 3.6-.6 8.2-4.8 8.6-4.6.5-8.3-3.4-7.6-8"/>',
};
const CREST_ID = { '木': 'moku', '火': 'ka', '土': 'do', '金': 'kin', '水': 'sui', calm: 'calm', fair: 'fair', moon: 'moon', storm: 'storm' };
/* 家紋は1回だけ定義して <use> で使い回す（描き直しを軽くする） */
function installCrests() {
  const defs = $('spriteDefs'); if (!defs) return;
  defs.innerHTML = Object.keys(CREST).map(k => '<symbol id="cr-' + CREST_ID[k] + '" viewBox="0 0 24 24">' + CREST[k] + '</symbol>').join('');
}
function crestSVG(key, cls) {
  if (!CREST[key]) return '';
  return '<svg class="crest ' + (cls || '') + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><use href="#cr-' + CREST_ID[key] + '"/></svg>';
}
/* 中身が同じなら描き直さない */
function setHTML(el, html) { if (el && el.__h !== html) { el.__h = html; el.innerHTML = html; } }
const weatherCrest = w => crestSVG(w.crest || w.elem || w.kind);
function fudaHTML(id, o) {
  o = o || {};
  const C = CARD[id]; if (!C) return '';
  const cls = ['fuda', 't-' + C.type];
  if (C.elem) cls.push('tint', 'el-' + C.elem);
  ['sel', 'add', 'off', 'mini', 'pick', 'dim', 'nw'].forEach(k => { if (o[k]) cls.push(k); });
  const nm = C.name.replace('・', '');
  const tag = o.tag || 'div';
  const attrs = (o.u != null ? ' data-u="' + o.u + '" data-c="' + C.id + '"' : '') + (o.nw && o.nwAt > 0 ? ' style="animation-delay:-' + Math.round(o.nwAt) + 'ms"' : '') + (o.i != null ? ' data-i="' + o.i + '"' : '') + (o.id ? ' data-card="' + C.id + '"' : '') + (tag === 'button' ? ' type="button"' : '') +
    ' aria-label="' + esc(C.name + '：' + cardText(C)) + '"' + (o.pressed != null ? ' aria-pressed="' + (o.pressed ? 'true' : 'false') + '"' : '');
  const val = cardVal(C);
  const tagTxt = C.all || C.tgt === 'all' ? '全体' : C.fx === 'draw' ? '通れば1枚' : '';
  const ch = Array.from(nm);
  return '<' + tag + ' class="' + cls.join(' ') + '"' + attrs + '>' +
    '<span class="f-art" aria-hidden="true"><svg viewBox="0 0 100 124" preserveAspectRatio="xMidYMid slice"><use href="#art-' + C.id + '"/></svg></span>' +
    '<span class="f-seal">' + TYPE_SEAL[C.type] + '</span>' +
    '<span class="f-name n' + Math.min(7, ch.length) + '" aria-hidden="true">' + ch.map(x => '<i>' + esc(x) + '</i>').join('') + '</span>' +
    (tagTxt ? '<span class="f-tag">' + tagTxt + '</span>' : '') +
    '<span class="f-foot">' + (C.elem ? '<span class="f-crest el-' + C.elem + '">' + crestSVG(C.elem) + '</span>' : '') +
    '<span class="f-val"><small>' + val[0] + '</small>' + esc(val[1]) + '</span></span>' +
    (o.badge ? '<span class="f-badge">' + esc(o.badge) + '</span>' : '') +
    (o.price != null ? '<span class="f-price">' + esc(o.price) + '</span>' : '') +
    '</' + tag + '>';
}
/* 札の下の数字：[小さな文字, 数字] */
function cardVal(C) {
  switch (C.type) {
    case 'weapon': return ['攻', String(C.atk)];
    case 'plus': return ['攻＋', String(C.atk)];
    case 'armor': return C.special === 'reflect' ? ['', '返す'] : C.special === 'deflect' ? ['', '弾く'] : C.special === 'null' ? ['', '無効'] : C.special === 'dodge' ? ['', '回避'] : ['守', String(C.def)];
    case 'spell': return ['霊', String(C.mp)];
    case 'summon': return ['霊', String(C.mp)];
    case 'item': return C.eff === 'heal' ? ['体＋', String(C.val)] : C.eff === 'mp' ? ['霊＋', String(C.val)] : C.eff === 'gold' ? ['両＋', String(C.val)] : C.eff === 'kiai' ? ['', '気合'] : C.eff === 'cleanse' ? ['', '浄め'] : C.eff === 'jobutsu' ? ['', '成仏'] : C.eff === 'usurp' ? ['', '簒奪'] : C.eff === 'sell' ? ['', '押売'] : C.eff === 'refine' ? ['', '精錬'] : C.eff === 'hpswap' ? ['', '入替'] : C.eff === 'shuffle' ? ['', '混ぜる'] : ['', '招福'];
  }
  return ['', ''];
}
/* 札の名前は縦書き。4文字以上は2列にする（右の列から読む） */
function nameCols(nm) {
  const ch = Array.from(nm);
  const cols = ch.length <= 3 ? [ch] : [ch.slice(0, Math.ceil(ch.length / 2)), ch.slice(Math.ceil(ch.length / 2))];
  return '<span class="fn' + (cols.length > 1 ? ' two' : '') + '" aria-hidden="true">' + cols.map(c => '<span class="fc">' + c.map(x => '<span>' + esc(x) + '</span>').join('') + '</span>').join('') + '</span>';
}
function embHTML(gid, size) {
  const g = GUARD[gid] || GUARD_LIST[0];
  return '<span class="emb el-' + g.elem + '" style="--s:' + (size || 34) + 'px" aria-hidden="true"><span class="emb-k">' + (GKANJI[g.id] || g.name.slice(0, 1)) + '</span><span class="emb-c">' + crestSVG(g.elem) + '</span></span>';
}
/* 霊獣のしるし：角の丸い札に一字 */
function beastHTML(bid, size, withName) {
  const B = BEAST[bid]; if (!B) return '';
  return '<span class="bst' + (B.elem ? ' el-' + B.elem : '') + (withName ? ' wn' : '') + '" style="--s:' + (size || 18) + 'px" title="霊獣 ' + esc(B.name) + '"><i>' + (BKANJI[B.id] || B.name.slice(0, 1)) + '</i>' + (withName ? '<span>' + esc(B.name) + '</span>' : '') + '</span>';
}
/* 霊獣の札（絵つき）。召喚やアシストのカットイン・案内・席の説明で使う */
function beastCardHTML(bid, o) {
  o = o || {};
  const B = BEAST[bid]; if (!B) return '';
  const ch = Array.from(B.name);
  return '<span class="fuda t-beast bfuda' + (B.elem ? ' tint el-' + B.elem : '') + (o.cls ? ' ' + o.cls : '') + '" aria-label="霊獣 ' + esc(B.name) + '">' +
    '<span class="f-art" aria-hidden="true"><svg viewBox="0 0 100 124" preserveAspectRatio="xMidYMid slice"><use href="#bart-' + B.id + '"/></svg></span>' +
    '<span class="f-seal">獣</span>' +
    '<span class="f-name n' + Math.min(7, ch.length) + '" aria-hidden="true">' + ch.map(x => '<i>' + esc(x) + '</i>').join('') + '</span>' +
    '<span class="f-foot">' + (B.elem ? '<span class="f-crest el-' + B.elem + '">' + crestSVG(B.elem) + '</span>' : '') + '<span class="f-val f-bv">霊獣</span></span>' +
    '</span>';
}
function teamHTML(team) { return '<span class="team team-' + team + '" title="' + TEAM_NAMES[team] + '組">' + TEAM_NAMES[team] + '</span>'; }

/* =====================================================================
   SOUND — 和楽器ふうの音を合成（音声ファイルなし）
   ===================================================================== */
const SE_KEY = 'yao-se', BGM_KEY = 'yao-bgm';
function impulse(ctx, dur, decay) {
  const len = Math.floor(ctx.sampleRate * dur);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return b;
}
function sendOut(A, g, rv) {
  g.connect(A.o);
  if (rv) { const s = A.c.createGain(); s.gain.value = rv; g.connect(s); s.connect(A.r); }
}
function tone(A, t, o) {
  const c = A.c, osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.bend || o.d));
  if (o.det) osc.detune.value = o.det;
  let node = osc;
  if (o.lp) {
    const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = o.q || 1;
    fl.frequency.setValueAtTime(o.lp, t);
    if (o.lp2) fl.frequency.exponentialRampToValueAtTime(o.lp2, t + o.d);
    osc.connect(fl); node = fl;
  }
  const a = o.a || 0.005, peak = o.g || 0.2, d = o.d;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  if (o.sus) { const rel = Math.min(o.rel || 0.15, d - a - 0.01); g.gain.setValueAtTime(peak, t + d - rel); }
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  node.connect(g); sendOut(A, g, o.rv);
  if (o.vib) {
    const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibD || 6;
    l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + d + 0.05);
  }
  osc.start(t); osc.stop(t + d + 0.05);
}
function noise(A, t, o) {
  const c = A.c, src = c.createBufferSource();
  src.buffer = A.nb;
  const fl = c.createBiquadFilter(); fl.type = o.type || 'bandpass'; fl.Q.value = o.q || 1;
  fl.frequency.setValueAtTime(o.f || 1000, t);
  if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + o.d);
  const g = c.createGain(), a = o.a || 0.008;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.g || 0.2, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
  src.connect(fl); fl.connect(g); sendOut(A, g, o.rv);
  src.start(t, Math.random() * 1.5); src.stop(t + o.d + 0.05);
}
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
const crash = (A, t, g) => noise(A, t, { d: 1.6, g: g || 0.3, type: 'highpass', f: 4500, rv: 0.5 });
const bellHit = (A, t, f, d, g) => { tone(A, t, { type: 'sine', f, d, g, rv: 0.6 }); tone(A, t, { type: 'sine', f: f * 2.76, d: d * 0.5, g: g * 0.45, rv: 0.6 }); tone(A, t, { type: 'sine', f: f * 5.4, d: d * 0.25, g: g * 0.25, rv: 0.6 }); };
const sparkle = (A, t, n) => { const P = [2093, 2349.3, 2637, 3136, 3520, 4186]; for (let i = 0; i < n; i++) tone(A, t + i * 0.055 + Math.random() * 0.02, { type: 'triangle', f: P[Math.floor(Math.random() * P.length)], d: 0.35, g: 0.045, rv: 0.6 }); };
/* 和楽器 */
const taiko = (A, t, g) => { g = g == null ? 1 : g; tone(A, t, { type: 'sine', f: 128, f2: 46, bend: 0.2, d: 0.75, g: 0.95 * g, rv: 0.3 }); tone(A, t, { type: 'triangle', f: 92, f2: 52, bend: 0.12, d: 0.35, g: 0.32 * g }); noise(A, t, { d: 0.14, g: 0.42 * g, type: 'lowpass', f: 650, rv: 0.25 }); };
const kaRim = (A, t, g) => { g = g == null ? 1 : g; noise(A, t, { d: 0.05, g: 0.35 * g, type: 'bandpass', f: 2400, q: 3 }); tone(A, t, { type: 'square', f: 1100, d: 0.03, g: 0.05 * g }); };
const koto = (A, t, f, d, g) => { d = d || 1.2; g = g || 0.12; tone(A, t, { type: 'triangle', f, f2: f * 0.995, d, g, lp: 4200, lp2: 900, rv: 0.35 }); tone(A, t, { type: 'sine', f: f * 2, d: d * 0.5, g: g * 0.35, rv: 0.35 }); noise(A, t, { d: 0.03, g: g * 0.5, type: 'bandpass', f: Math.min(9000, f * 3), q: 2 }); };
const shami = (A, t, f, d, g) => { d = d || 0.35; g = g || 0.1; tone(A, t, { type: 'sawtooth', f, d, g, lp: 3200, lp2: 600, q: 3, rv: 0.2 }); noise(A, t, { d: 0.025, g: g * 1.1, type: 'highpass', f: 3000 }); };
const fue = (A, t, f, d, g) => { g = g || 0.06; tone(A, t, { type: 'sine', f, d, g, a: 0.08, sus: 1, rel: 0.15, vib: 5.2, vibD: 7, rv: 0.45 }); tone(A, t, { type: 'triangle', f: f * 2, d, g: g * 0.18, a: 0.08, sus: 1, rel: 0.15, rv: 0.45 }); noise(A, t, { d: Math.min(d, 0.5), g: g * 0.45, type: 'bandpass', f: Math.min(9000, f * 1.5), q: 6, a: 0.05 }); };
const hyoshigi = (A, t) => [0, 0.17].forEach(dt => { noise(A, t + dt, { d: 0.07, g: 0.95, type: 'bandpass', f: 2300, q: 9, rv: 0.4 }); tone(A, t + dt, { type: 'square', f: 1760, d: 0.025, g: 0.1, rv: 0.3 }); });
const suzu = (A, t, n) => { for (let i = 0; i < (n || 6); i++) bellHit(A, t + i * 0.05 + Math.random() * 0.03, 2600 + Math.random() * 1400, 0.4, 0.045); };
const gong = (A, t, g) => { g = g || 1; [1, 2.4, 3.9, 5.3].forEach((m, i) => tone(A, t, { type: 'sine', f: 98 * m, d: 3.2 - i * 0.5, g: (0.32 / (i + 1)) * g, rv: 0.7 })); noise(A, t, { d: 0.25, g: 0.2 * g, type: 'lowpass', f: 900 }); };
const kane = (A, t, g) => { bellHit(A, t, 2150, 0.14, 0.05 * (g || 1)); noise(A, t, { d: 0.03, g: 0.05 * (g || 1), type: 'highpass', f: 5000 }); };
const YO = [62, 64, 67, 69, 71, 74, 76, 79, 81, 83, 86];
const SOUNDS = {
  tap: (A, t) => koto(A, t, mf(81), 0.28, 0.06),
  select: (A, t) => koto(A, t, mf(86), 0.22, 0.05),
  paper: (A, t) => noise(A, t, { d: 0.18, g: 0.22, type: 'bandpass', f: 1500, f2: 4500, q: 0.8 }),
  myturn: (A, t) => { hyoshigi(A, t); koto(A, t + 0.4, mf(74), 0.9, 0.08); koto(A, t + 0.5, mf(79), 0.9, 0.08); },
  turn: (A, t) => kaRim(A, t, 0.6),
  sword: (A, t) => { noise(A, t, { d: 0.32, g: 0.5, type: 'highpass', f: 7000, f2: 1800 }); bellHit(A, t + 0.02, 3300, 0.7, 0.06); taiko(A, t + 0.05, 0.8); },
  allatk: (A, t) => { [0, 0.12, 0.24].forEach((dt, i) => taiko(A, t + dt, 0.6 + i * 0.2)); [57, 64, 69].forEach(m => shami(A, t + 0.24, mf(m), 0.5, 0.06)); crash(A, t + 0.24, 0.2); },
  spell: (A, t) => { suzu(A, t, 5); tone(A, t, { type: 'sine', f: 220, f2: 880, bend: 0.6, d: 0.8, g: 0.12, rv: 0.6 }); tone(A, t, { type: 'sawtooth', f: 55, d: 1, g: 0.08, lp: 300, rv: 0.4 }); },
  hit: (A, t) => { taiko(A, t, 1.1); noise(A, t, { d: 0.25, g: 0.4, type: 'lowpass', f: 1600, f2: 200 }); },
  bighit: (A, t) => { taiko(A, t, 1.3); taiko(A, t + 0.11, 1.2); crash(A, t + 0.11, 0.35); [45, 52, 57].forEach(m => shami(A, t + 0.11, mf(m), 0.6, 0.07)); },
  block: (A, t) => { bellHit(A, t, 720, 0.5, 0.18); bellHit(A, t, 1430, 0.3, 0.1); noise(A, t, { d: 0.06, g: 0.4, type: 'highpass', f: 3000 }); },
  reflect: (A, t) => { bellHit(A, t, 1568, 1.2, 0.12); bellHit(A, t + 0.08, 2349, 1, 0.09); tone(A, t + 0.1, { type: 'sine', f: 3000, f2: 500, bend: 0.4, d: 0.5, g: 0.1 }); crash(A, t, 0.2); sparkle(A, t + 0.1, 8); },
  nullify: (A, t) => { noise(A, t, { d: 0.4, g: 0.3, type: 'bandpass', f: 2500, f2: 300, q: 0.8 }); [79, 76, 74, 71].forEach((m, i) => koto(A, t + 0.08 * i, mf(m), 0.5, 0.06)); },
  dodge: (A, t) => noise(A, t, { d: 0.28, g: 0.3, type: 'bandpass', f: 3500, f2: 500, q: 0.9 }),
  heal: (A, t) => { [62, 67, 69, 74, 79].forEach((m, i) => koto(A, t + i * 0.07, mf(m), 0.9, 0.07)); sparkle(A, t + 0.3, 8); },
  power: (A, t) => { taiko(A, t, 0.9); shami(A, t, mf(57), 0.5, 0.09); shami(A, t + 0.1, mf(64), 0.6, 0.09); },
  curse: (A, t) => { [98, 104, 147].forEach(f => tone(A, t, { type: 'sawtooth', f, d: 1.2, g: 0.06, lp: 900, lp2: 200, rv: 0.5 })); noise(A, t, { d: 1, g: 0.18, type: 'lowpass', f: 400, rv: 0.4 }); },
  seal: (A, t) => { noise(A, t, { d: 0.09, g: 0.6, type: 'bandpass', f: 900, q: 1.5 }); tone(A, t, { type: 'sine', f: 140, f2: 90, d: 0.6, g: 0.25 }); },
  steal: (A, t) => { noise(A, t, { d: 0.25, g: 0.3, type: 'bandpass', f: 800, f2: 5000, q: 1 }); koto(A, t + 0.15, mf(83), 0.4, 0.06); },
  coin: (A, t) => { tone(A, t, { type: 'square', f: 988, d: 0.08, g: 0.1 }); tone(A, t + 0.08, { type: 'square', f: 1319, d: 0.4, g: 0.1, rv: 0.2 }); },
  pray: (A, t) => { suzu(A, t, 9); suzu(A, t + 0.35, 6); koto(A, t + 0.2, mf(74), 1.2, 0.05); },
  ko: (A, t) => { gong(A, t, 1); suzu(A, t + 0.3, 4); },
  curseTick: (A, t) => tone(A, t, { type: 'sawtooth', f: 110, f2: 70, d: 0.5, g: 0.1, lp: 700 }),
  start: (A, t) => { [0, 0.3, 0.6, 0.75, 0.9].forEach((dt, i) => taiko(A, t + dt, 0.8 + i * 0.1)); hyoshigi(A, t + 1.2); crash(A, t + 0.9, 0.3); },
  win: (A, t) => {
    for (let i = 0; i < 16; i++) taiko(A, t + i * 0.06, 0.25 + i * 0.03);
    const t2 = t + 1.05; taiko(A, t2, 1.3); crash(A, t2, 0.4); gong(A, t2, 0.7);
    [[0, 74, 0.3], [0.3, 76, 0.3], [0.6, 79, 0.6], [1.2, 81, 0.3], [1.5, 79, 0.3], [1.8, 86, 1.4]].forEach(([dt, m, d]) => fue(A, t2 + dt, mf(m), d, 0.07));
    sparkle(A, t2 + 0.2, 14);
  },
  lose: (A, t) => { [76, 74, 71, 69, 67, 62].forEach((m, i) => koto(A, t + i * 0.16, mf(m), 1, 0.08)); gong(A, t + 1, 0.6); },
  tick: (A, t) => kaRim(A, t, 0.5),
  timeup: (A, t) => { [0, 0.15, 0.3].forEach(dt => kaRim(A, t + dt, 1)); taiko(A, t + 0.45, 1); },
  buzz: (A, t) => shami(A, t, 110, 0.4, 0.12),
  omikuji: (A, t) => { for (let i = 0; i < 7; i++) noise(A, t + i * 0.07, { d: 0.05, g: 0.35, type: 'bandpass', f: 1800 + (i % 2) * 500, q: 4 }); },
  daikichi: (A, t) => { hyoshigi(A, t); [74, 79, 83, 86].forEach((m, i) => koto(A, t + 0.2 + i * 0.08, mf(m), 1, 0.08)); fue(A, t + 0.5, mf(86), 0.9, 0.06); sparkle(A, t + 0.4, 12); },
  kichi: (A, t) => { suzu(A, t, 6); [74, 79, 83].forEach((m, i) => koto(A, t + 0.1 + i * 0.08, mf(m), 0.8, 0.07)); },
  kyo: (A, t) => { [69, 65, 62].forEach((m, i) => koto(A, t + i * 0.14, mf(m), 0.9, 0.07)); gong(A, t + 0.4, 0.35); },
  summon: (A, t) => { gong(A, t, 0.55); suzu(A, t + 0.15, 8); [[0.2, 74, 0.35], [0.5, 79, 0.35], [0.8, 86, 0.9]].forEach(([dt, m, d]) => fue(A, t + dt, mf(m), d, 0.06)); sparkle(A, t + 0.6, 10); },
  assist: (A, t) => { suzu(A, t, 5); [79, 83, 86].forEach((m, i) => koto(A, t + 0.08 + i * 0.07, mf(m), 0.7, 0.06)); },
  deflect: (A, t) => { noise(A, t, { d: 0.35, g: 0.42, type: 'bandpass', f: 600, f2: 5200, q: 0.7 }); bellHit(A, t + 0.05, 1200, 0.4, 0.08); },
  usurp: (A, t) => { noise(A, t, { d: 0.22, g: 0.3, type: 'bandpass', f: 900, f2: 4200, q: 1 }); [71, 74, 78].forEach((m, i) => shami(A, t + 0.12 + i * 0.09, mf(m), 0.3, 0.07)); },
  gone: (A, t) => { [86, 83, 79, 74].forEach((m, i) => koto(A, t + i * 0.1, mf(m), 0.8, 0.05)); suzu(A, t + 0.4, 3); },
  /* 札を場に1枚置く／札を1枚引く／合計が出る */
  /* 体力0（どくん、どくん）と、成仏（太鼓・鉦・鈴・笛が天にのぼる） */
  dying: (A, t) => { taiko(A, t, 0.55); taiko(A, t + 0.2, 0.4); tone(A, t, { type: 'sine', f: 60, f2: 45, d: 0.5, g: 0.18 }); },
  jobutsu: (A, t) => { taiko(A, t, 1.3); crash(A, t, 0.32); gong(A, t + 0.04, 1.15); suzu(A, t + 0.3, 12);
    [[0.35, 74, 0.45], [0.62, 79, 0.45], [0.9, 83, 0.45], [1.15, 86, 1.3]].forEach(([dt, m, d]) => fue(A, t + dt, mf(m), d, 0.07)); sparkle(A, t + 0.45, 16); },
  deal: (A, t) => { noise(A, t, { d: 0.07, g: 0.42, type: 'bandpass', f: 2200, q: 2 }); taiko(A, t, 0.32); },
  draw: (A, t) => { noise(A, t, { d: 0.12, g: 0.2, type: 'bandpass', f: 2600, f2: 5200, q: 1 }); koto(A, t + 0.02, mf(88), 0.18, 0.025); },
  sum: (A, t) => { taiko(A, t, 0.75); koto(A, t + 0.03, mf(76), 0.6, 0.07); koto(A, t + 0.09, mf(81), 0.6, 0.05); },
};
const NO_DUCK = new Set(['tap', 'select', 'paper', 'turn', 'tick', 'coin', 'dodge', 'curseTick', 'deal', 'draw']);
const SE = {
  on: true, A: null,
  init() { try { if (localStorage.getItem(SE_KEY) === '0') this.on = false; } catch (_) { /* ignore */ } },
  ensure() {
    if (!this.A) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        const c = new AC();
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.18;
        const lim = c.createDynamicsCompressor();
        lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
        const o = c.createGain(); o.gain.value = 0.95; o.connect(comp); comp.connect(lim); lim.connect(c.destination);
        const r = c.createConvolver(); r.buffer = impulse(c, 2.4, 2.6);
        const rg = c.createGain(); rg.gain.value = 0.34; r.connect(rg); rg.connect(o);
        const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.A = { c, o, r, nb };
      } catch (_) { this.A = null; return null; }
      BGM.sync();
    }
    if (this.A.c.state === 'suspended' && document.visibilityState !== 'hidden') { try { this.A.c.resume(); } catch (_) { /* ignore */ } }
    return this.A;
  },
  play(name, delay) {
    if (!this.on) return;
    const A = this.ensure(); if (!A) return;
    const f = SOUNDS[name]; if (!f) return;
    try { f(A, A.c.currentTime + 0.01 + (delay || 0)); } catch (_) { /* ignore */ }
    if (!NO_DUCK.has(name)) BGM.duck(delay || 0);
  },
  toggle() {
    this.on = !this.on;
    try { localStorage.setItem(SE_KEY, this.on ? '1' : '0'); } catch (_) { /* ignore */ }
    if (this.on) this.play('coin');
  },
};
const sfx = (n, d) => SE.play(n, d);

/* ---------- BGM: 16分音符のステップで鳴らす小さなシーケンサー ---------- */
const MENU_MEL = [
  [[0, 74, 4], [4, 76, 2], [6, 74, 2], [8, 71, 4], [12, 69, 4]],
  [[0, 67, 4], [4, 69, 2], [6, 71, 2], [8, 74, 8]],
  [[0, 76, 4], [4, 79, 2], [6, 76, 2], [8, 74, 4], [12, 71, 4]],
  [[0, 69, 4], [4, 71, 2], [6, 69, 2], [8, 67, 8]],
];
const MENU_FUE = [[[0, 86, 8], [8, 88, 8]], [[0, 83, 8], [8, 81, 8]], [[0, 88, 6], [6, 91, 2], [8, 88, 8]], [[0, 86, 16]]];
const BAT_RIFF = [[69, 70, 69, 65, 64, 65, 62, 64], [69, 70, 74, 70, 69, 65, 64, 65], [62, 64, 65, 64, 62, 58, 57, 58], [57, 62, 64, 65, 64, 62, 58, 57]];
const BAT_ROOT = [45, 45, 38, 40];
const BAT_FUE = [[[0, 81, 6], [6, 82, 2], [8, 81, 8]], [[0, 77, 8], [8, 76, 8]], [[0, 74, 6], [6, 76, 2], [8, 77, 8]], [[0, 76, 12], [12, 74, 4]]];
const RES_MEL = [[[0, 74, 2], [2, 76, 2], [4, 79, 4], [8, 81, 2], [10, 79, 2], [12, 76, 4]], [[0, 74, 2], [2, 76, 2], [4, 74, 2], [6, 71, 2], [8, 69, 8]], [[0, 74, 2], [2, 76, 2], [4, 79, 4], [8, 81, 2], [10, 83, 2], [12, 86, 4]], [[0, 83, 2], [2, 81, 2], [4, 79, 4], [8, 74, 8]]];
const TRACKS = {
  menu: { bpm: 76, steps: 128, vol: 0.85, fn(B, t, s, sd) {
    const bar = (s >> 4) & 3, st = s & 15, sec = (s >> 6) & 1;
    if (st === 0) { taiko(B, t, 0.35); tone(B, t, { type: 'sine', f: mf(38), d: sd * 15, g: 0.08, a: 0.4, sus: 1, rel: 0.6 }); }
    if (st === 8 && bar % 2) kaRim(B, t, 0.25);
    const n = MENU_MEL[bar].find(x => x[0] === st);
    if (n) koto(B, t, mf(n[1]), n[2] * sd * 2.2, 0.09);
    if (sec === 1) { const f = MENU_FUE[bar].find(x => x[0] === st); if (f) fue(B, t, mf(f[1] - 12), f[2] * sd * 1.05, 0.035); }
    if (st % 4 === 2) koto(B, t, mf(YO[(bar * 3 + (st >> 2)) % 5]), sd * 3, 0.03);
  } },
  battle: { bpm: 128, steps: 128, vol: 0.8, fn(B, t, s, sd) {
    const bar = (s >> 4) & 3, st = s & 15, sec = (s >> 6) & 1;
    const T = { 0: 1, 4: 0.55, 6: 0.5, 8: 0.95, 11: 0.45, 12: 0.75, 14: 0.55 };
    if (T[st] != null) taiko(B, t, T[st] * 0.55);
    if (bar === 3 && st === 15) taiko(B, t, 0.4);
    if (st === 2 || st === 10) kaRim(B, t, 0.35);
    if (st % 2 === 0) shami(B, t, mf(BAT_RIFF[bar][st >> 1]), sd * 1.8, 0.05);
    if (st === 0 || st === 8) tone(B, t, { type: 'sine', f: mf(BAT_ROOT[bar]), d: sd * 8, g: 0.12, a: 0.02, sus: 1, rel: 0.1 });
    if (sec === 1) { const f = BAT_FUE[bar].find(x => x[0] === st); if (f) fue(B, t, mf(f[1]), f[2] * sd * 1.05, 0.03); }
    if (s % 64 === 0) crash(B, t, 0.06);
  } },
  pinch: { bpm: 156, steps: 32, vol: 0.8, fn(B, t, s, sd) {
    const bar = (s >> 4) & 1, st = s & 15;
    taiko(B, t, st % 4 === 0 ? 0.5 : 0.18 + (bar ? st * 0.015 : 0));
    if (st % 2 === 0) shami(B, t, mf(bar ? 58 : 57), sd * 1.5, 0.045);
    if (st === 0) { tone(B, t, { type: 'sine', f: 70, f2: 38, bend: 0.09, d: 0.22, g: 0.6 }); tone(B, t + 0.17, { type: 'sine', f: 60, f2: 34, bend: 0.09, d: 0.25, g: 0.45 }); }
    if (st === 8) kaRim(B, t, 0.4);
  } },
  result: { bpm: 132, steps: 64, vol: 0.85, fn(B, t, s, sd) {
    const bar = (s >> 4) & 3, st = s & 15;
    if (st % 2 === 0) kane(B, t, st % 4 === 0 ? 1.2 : 0.7);
    if ([0, 3, 6, 8, 10, 12].includes(st)) taiko(B, t, st === 0 || st === 8 ? 0.6 : 0.35);
    const n = RES_MEL[bar].find(x => x[0] === st);
    if (n) fue(B, t, mf(n[1]), n[2] * sd * 1.05, 0.05);
    if (st === 0) koto(B, t, mf(62), sd * 8, 0.06);
  } },
};
const BGM = {
  on: true, want: null, cur: null, timer: 0, bus: null, busR: null, base: 1,
  init() { try { if (localStorage.getItem(BGM_KEY) === '0') this.on = false; } catch (_) { /* ignore */ } },
  play(name) { if (this.want === name) return; this.want = name; this.sync(); },
  stop() { this.want = null; this.sync(); },
  sync() {
    const A = SE.A; if (!A) return;
    const name = this.on && TRACKS[this.want] ? this.want : null;
    if ((this.cur ? this.cur.name : null) === name) return;
    if (this.cur) this.fade(this.cur);
    this.cur = null;
    if (!name) { clearInterval(this.timer); this.timer = 0; return; }
    const c = A.c, tr = TRACKS[name], now = c.currentTime;
    if (!this.bus) { this.bus = c.createGain(); this.bus.connect(A.o); this.busR = c.createGain(); this.busR.connect(A.r); }
    const g = c.createGain(), rg = c.createGain();
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(tr.vol * 0.6, now + 0.4);
    g.connect(this.bus); rg.connect(this.busR);
    const B = { c, o: g, r: rg, nb: A.nb };
    this.cur = { name, tr, B, g, rg, step: 0, next: now + 0.08, sd: 60 / tr.bpm / 4 };
    if (!this.timer) this.timer = setInterval(() => this.pump(), 50);
    this.pump();
  },
  fade(cur) {
    const t = SE.A.c.currentTime;
    try {
      cur.g.gain.cancelScheduledValues(t); cur.g.gain.setValueAtTime(cur.g.gain.value, t); cur.g.gain.linearRampToValueAtTime(0, t + 0.5);
      cur.rg.gain.setTargetAtTime(0, t + 0.3, 0.3);
    } catch (_) { /* ignore */ }
    setTimeout(() => { try { cur.g.disconnect(); cur.rg.disconnect(); } catch (_) { /* ignore */ } }, 3500);
  },
  pump() {
    const cur = this.cur, A = SE.A;
    if (!cur || !A || A.c.state !== 'running') return;
    const now = A.c.currentTime;
    if (cur.next < now - 0.1) cur.next = now + 0.03;
    while (cur.next < now + 0.3) {
      try { cur.tr.fn(cur.B, cur.next, cur.step % cur.tr.steps, cur.sd); } catch (_) { /* ignore */ }
      cur.next += cur.sd; cur.step++;
    }
  },
  duck(delay) {
    if (!this.bus || !this.cur) return;
    const t = SE.A.c.currentTime + (delay || 0), n = this.bus.gain;
    n.cancelScheduledValues(t); n.setTargetAtTime(this.base * 0.35, t, 0.03); n.setTargetAtTime(this.base, t + 1, 0.4);
  },
  toggle() {
    this.on = !this.on;
    try { localStorage.setItem(BGM_KEY, this.on ? '1' : '0'); } catch (_) { /* ignore */ }
    if (this.on) SE.ensure();
    this.sync();
  },
};

/* =====================================================================
   EFFECTS — 桜吹雪、テロップ、フラッシュ、揺れ、数字、ハンコ、カットイン
   ===================================================================== */
const PETAL = ['#e6cd8f', '#c6a25a', '#f4e4b8', '#a9853f', '#fff3d2'];
const FXC = {
  cv: null, cx: null, parts: [], raf: 0, w: 0, h: 0, dpr: 1,
  size() {
    if (!this.cv) { this.cv = $('fxCanvas'); this.cx = this.cv.getContext('2d'); }
    const r = $('shell').getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1); this.w = r.width; this.h = r.height;
    this.cv.width = Math.round(r.width * this.dpr); this.cv.height = Math.round(r.height * this.dpr);
  },
  add(p) { this.parts.push(p); if (!this.raf) this.raf = requestAnimationFrame(() => this.loop()); },
  petals(n, burst) {
    this.size();
    if (reduceMotion) n = Math.min(n, 14);
    for (let i = 0; i < n; i++) {
      const fromTop = !burst || Math.random() < 0.5;
      this.add({ x: Math.random() * this.w, y: fromTop ? -20 - Math.random() * this.h * 0.6 : this.h * 0.4,
        vx: (Math.random() - 0.5) * (burst ? 7 : 1.5), vy: fromTop ? 1 + Math.random() * 1.8 : -4 - Math.random() * 5, g: 0.04,
        w: 6 + Math.random() * 7, h: 6 + Math.random() * 7, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.08,
        ph: Math.random() * 6.28, c: PETAL[i % PETAL.length], life: 1, decay: 0.0025 + Math.random() * 0.002 });
    }
  },
  /* 光の粒が立ちのぼる（成仏） */
  motes(x, y, n) {
    if (!this.w) this.size();
    if (reduceMotion) n = Math.min(n, 8);
    for (let i = 0; i < n; i++) {
      this.add({ x: x + (Math.random() - 0.5) * 50, y: y + (Math.random() - 0.3) * 30, vx: (Math.random() - 0.5) * 1.2, vy: -1.5 - Math.random() * 3.2, g: -0.03, w: 3 + Math.random() * 4, h: 0, r: 0, vr: 0, ph: Math.random() * 6.28,
        c: ['#fff6d0', '#ffe9a8', '#cfe8ff', '#ffffff'][i % 4], life: 1, decay: 0.009 + Math.random() * 0.008, mote: true });
    }
  },
  sparks(x, y, n, cols) {
    if (!this.w) this.size();
    if (reduceMotion) n = Math.min(n, 8);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 5;
      this.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, g: 0.15, w: 4 + Math.random() * 3, h: 4, r: 0, vr: 0.2, ph: 0, c: cols[i % cols.length], life: 1, decay: 0.025, spark: true });
    }
  },
  loop() {
    try {
      const cx = this.cx, P = this.parts;
      cx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      cx.clearRect(0, 0, this.w, this.h);
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        p.ph += 0.05; p.vx *= 0.99; p.vy = Math.min(p.vy + p.g, p.spark ? 9 : 2.2);
        p.x += p.vx + (p.spark ? 0 : Math.sin(p.ph) * 0.8); p.y += p.vy; p.r += p.vr; p.life -= p.decay;
        if (p.life <= 0 || p.y > this.h + 30 || p.y < -40) { P.splice(i, 1); continue; }
        if (p.mote) { cx.globalAlpha = Math.min(1, p.life * 1.6); cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, p.w / 2, 0, 6.283); cx.fill(); cx.globalAlpha *= 0.3; cx.beginPath(); cx.arc(p.x, p.y, p.w * 1.4, 0, 6.283); cx.fill(); continue; }
        cx.globalAlpha = Math.min(1, p.life * 2);
        cx.fillStyle = p.c;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r);
        cx.beginPath();
        if (p.spark) cx.rect(-p.w / 2, -p.h / 2, p.w, p.h);
        else { const k = Math.abs(Math.cos(p.ph * 0.7)) + 0.08; cx.moveTo(-p.w / 2, -p.h / 2 * k); cx.lineTo(p.w / 2, -p.h / 2 * k * 0.7); cx.lineTo(p.w / 2 * 0.8, p.h / 2 * k); cx.lineTo(-p.w / 2 * 0.9, p.h / 2 * k * 0.8); cx.closePath(); }
        cx.fill(); cx.restore();
      }
      cx.globalAlpha = 1;
      if (P.length) this.raf = requestAnimationFrame(() => this.loop());
      else { this.raf = 0; cx.clearRect(0, 0, this.w, this.h); }
    } catch (_) { this.parts = []; this.raf = 0; }
  },
};
function relPos(el) {
  const a = $('shell').getBoundingClientRect(), r = el.getBoundingClientRect();
  return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2, w: r.width, h: r.height };
}
function telop(html, cls, ms) {
  const el = document.createElement('div');
  el.className = 'telop ' + (cls || '');
  el.innerHTML = html;
  if (ms) el.style.setProperty('--t', ms + 'ms');
  $('telop').appendChild(el);
  setTimeout(() => el.remove(), (ms || 1300) + 80);
}
function flash(color) {
  if (reduceMotion) return;
  const f = $('flash'); f.style.setProperty('--fl', color || '#ffffff');
  f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
}
function shakeEl(el, cls, ms) {
  if (reduceMotion || !el) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}
function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) { /* ignore */ } }
/* 札が1枚、場所から場所へ飛ぶ（補充のときなど） */
function flyCard(from, to, ms) {
  if (!from || !to || reduceMotion) return;
  const el = document.createElement('div');
  el.className = 'flyc';
  el.style.left = from.x + 'px'; el.style.top = from.y + 'px';
  $('fx').appendChild(el);
  const t = (ms || 320) * SPEED;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transition = 'transform ' + t + 'ms cubic-bezier(.3,.7,.4,1), opacity ' + t + 'ms';
    el.style.transform = 'translate(-50%, -50%) translate(' + (to.x - from.x) + 'px,' + (to.y - from.y) + 'px) scale(.7)';
    el.style.opacity = '.2';
  }));
  setTimeout(() => el.remove(), t + 60);
}
function popAt(pos, text, cls, delay) {
  if (!pos) return;
  setTimeout(() => {
    const el = document.createElement('div');
    el.className = 'pop ' + (cls || '');
    el.textContent = text;
    el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px';
    $('fx').appendChild(el);
    /* 長いことばが画面の端で切れないように、内側に寄せる */
    const w = el.offsetWidth, vw = $('fx').clientWidth || window.innerWidth;
    if (w && vw) el.style.left = Math.max(w / 2 + 6, Math.min(vw - w / 2 - 6, pos.x)) + 'px';
    setTimeout(() => el.remove(), 1400);
  }, delay || 0);
}
function stampAt(pos, text, cls) {
  if (!pos) return;
  const el = document.createElement('div');
  el.className = 'stampfx' + (cls ? ' ' + cls : '');
  el.textContent = text;
  el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px';
  $('fx').appendChild(el);
  setTimeout(() => el.remove(), 1700);
}
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'tst'; el.textContent = msg;
  const box = $('toast'); box.innerHTML = ''; box.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 2900);
}
let cutTimer = 0;
/* 成仏の演出：天からの光の柱・広がる光の輪・立ちのぼる魂と光の粒 */
function koFx(pos) {
  if (!pos) return;
  const fx = $('fx');
  const mk = cls => { const el = document.createElement('div'); el.className = cls; el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px'; fx.appendChild(el); return el; };
  const els = [];
  if (!reduceMotion) {
    const pil = mk('kopil'); pil.style.top = '0px'; pil.style.setProperty('--y', pos.y + 'px'); els.push(pil);
    els.push(mk('koring'), mk('koring k2'));
    const soul = mk('kosoul'); soul.style.setProperty('--rise', Math.max(140, pos.y + 80) + 'px'); els.push(soul);
  }
  FXC.motes(pos.x, pos.y, 34);
  FXC.sparks(pos.x, pos.y, 20, ['#fff6d0', '#e8d199', '#bfe3ff', '#ffffff']);
  setTimeout(() => els.forEach(e => e.remove()), 2300 * SPEED);
}
function cutIn(html, ms) {
  const c = $('cut');
  $('cutIn').innerHTML = html;
  c.style.setProperty('--t', ms + 'ms');
  c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
  clearTimeout(cutTimer);
  cutTimer = setTimeout(() => { c.classList.remove('on'); $('cutIn').innerHTML = ''; }, ms + 30);
}
