/* =====================================================================
   GAME SCREEN — 対戦画面
   操作はどこでも同じ形：「札をタップ → まん中に大きく説明 → 下の大きなボタン」。
   まん中の「場」は、そのとき必要なものだけを出す（札の説明／守り／よろず屋／相手の説明／天候）。
   ===================================================================== */

/* ---------- presenter: 新しい盤面が来たら、起きたことを順番に見せてから描く ---------- */
async function pump() {
  if (pres.busy) return;
  pres.busy = true;
  try {
    while (pres.q.length) {
      let r = pres.q.shift();
      while (pres.q.length > 3) r = pres.q.shift();
      const G = r.game;
      if (!G) continue;
      if (pres.gid !== G.gid) {
        pres.gid = G.gid; pres.seq = G.seq; shown = r;
        resetSel(); ui.look = null; ui.ghost = null; ui.hexTo = null;
        if (screen !== 'game') showScreen('game');
        renderGame();
        if (G.seq <= 6 && pres.startFor !== G.gid) {
          pres.startFor = G.gid;
          sfx('start');
          telop('合戦開始<small>' + (G.settings.teams ? G.settings.teams + 'チーム戦' : '個人戦') + '　' + G.players.length + '人</small>', '', 1700);
          await wait(1600);
          const w = WEATHER[G.weather];
          if (w) { telop('天候　' + esc(w.name) + '<small>' + esc(w.text) + '</small>', '', 1500); await wait(1300); }
          afterRender(G.log.filter(e => e.k === 'turn').slice(-1), r);
        }
        if (G.phase === 'over') showResultSoon(r, true);
        continue;
      }
      const evs = koAfterCause(G.log.filter(e => e.s > pres.seq));
      pres.seq = Math.max(pres.seq, G.seq);
      const fast = pres.q.length > 1 || screen !== 'game';
      hvStart(shown, r);
      for (const e of evs) { try { await playEvent(e, r, fast); } catch (err) { console.error(err); } }
      HV.on = false; HV.batch = false;
      shown = r;
      if (screen === 'game') renderGame();
      afterRender(evs, r);
      if (G.phase === 'over') showResultSoon(r, false);
    }
  } finally { pres.busy = false; }
}
function seatEl(pid) {
  const me = mePlayer(shown);
  if (me && me.pid === pid) return $('gMe');
  return document.querySelector('#gOpp .seat[data-pid="' + pid + '"]');
}
function seatPos(pid) { const el = seatEl(pid); return el ? relPos(el) : null; }
const ST_WORD = { curse: '呪われた', seal: '封印された', steal: '札をうばわれた' };
const bname = id => (BEAST[id] ? BEAST[id].name : '霊獣');
/* =====================================================================
   1枚ずつの演出
   使った札は手札から消え、まん中に0.3秒ごとに1枚ずつ並んで合計が出る。
   補充は0.2秒ごとに1枚。新しい盤面を描く前に、手札の見た目だけ先に動かす
   ===================================================================== */
const HV = { on: false, batch: false, removed: [], added: [], gone: new Set(), ins: [], seat: {}, hp: {} };
function hvStart(prev, r) {
  HV.on = false; HV.removed = []; HV.added = []; HV.gone = new Set(); HV.ins = []; HV.seat = {}; HV.hp = {};
  HV.batch = true; pres.zeroAt = {}; pres.prevG = prev && prev.game;
  const a = prev && mePlayer(prev), b = mePlayer(r);
  if (!a || !b || a.pid !== b.pid || !prev.game || !r.game || prev.game.gid !== r.game.gid) return;
  const A = new Set(a.hand.map(h => h.u)), B = new Set(b.hand.map(h => h.u));
  HV.removed = a.hand.filter(h => !B.has(h.u));
  HV.added = b.hand.filter(h => !A.has(h.u)).sort((x, y) => x.u - y.u);
  HV.on = true;
}
/* 成仏の記録はダメージの記録より先に入っているので、ダメージを見せたあとに回す */
function koAfterCause(evs) {
  const out = []; let held = [];
  for (const e of evs) {
    if (e.k === 'ko') { held.push(e); continue; }
    if (held.length && !['resolve', 'curse', 'assist'].includes(e.k)) { out.push(...held); held = []; }
    out.push(e);
    if (held.length) { out.push(...held); held = []; }
  }
  return out.concat(held);
}
/* 席の体力の数字とバーを、その場で動かす */
function hpShow(pid, v) {
  const G0 = pres.prevG, p = G0 && G0.players[pid]; if (!p) return;
  HV.hp[pid] = v;
  const el = seatEl(pid); if (!el) return;
  const n = el.querySelector('.hpnum'), bar = el.querySelector('.hbar');
  if (n) { n.outerHTML = hpNum(p); }
  if (bar) { bar.outerHTML = hpBar(p); }
  $('gOpp').__h = null; $('gMe').__h = null;
}
function hpAdd(pid, d) {
  const G0 = pres.prevG, p = G0 && G0.players[pid]; if (!p || !d) return;
  const cur = HV.hp[pid] != null ? HV.hp[pid] : p.hp;
  const v = Math.max(0, Math.min(HP_CAP, cur + d));
  hpShow(pid, v);
  if (v <= 0 && cur > 0) markZero(pid);
}
/* 体力0：赤く脈打たせて、2秒後に成仏 */
function markZero(pid) {
  if (!pres.zeroAt) pres.zeroAt = {};
  if (pres.zeroAt[pid]) return;
  pres.zeroAt[pid] = performance.now();
  if (HV.hp[pid] == null || HV.hp[pid] > 0) hpShow(pid, 0);
  const el = seatEl(pid); if (el) el.classList.add('dying');
  sfx('dying');
  const me = mePlayer(shown);
  if (me && me.pid === pid) { vibrate([60, 120, 60]); flash('#ff3b2a'); }
}
async function koScene(G, e, me) {
  const myPid = me ? me.pid : -1;
  markZero(e.p);
  const left = 2000 - (performance.now() - pres.zeroAt[e.p]) / SPEED;
  if (left > 30) { setTimeout(() => sfx('dying'), Math.min(left, 1000) * SPEED); await wait(left); }
  const el = seatEl(e.p), pos = seatPos(e.p);
  if (el) { el.classList.remove('dying'); el.classList.add('dead'); }
  koFx(pos);
  sfx('jobutsu');
  flash('#fff6d0');
  setTimeout(() => stampAt(pos, '成仏', 'ko'), 380 * SPEED);
  const P = G.players[e.p];
  if (e.p === myPid) { vibrate([120, 60, 220]); telop('成仏<small>最後まで観戦できます</small>', 'red', 2400); }
  else if (P) {
    const by = e.by >= 0 && G.players[e.by] ? (e.by === myPid ? 'あなた' : esc(G.players[e.by].name)) : '';
    cutIn('<div class="cards">' + embHTML(P.guardian, 76) + '</div><div class="ctext"><div class="cwho">' + esc(P.name) + 'は</div><div class="cname">成仏</div>' +
      (by ? '<div class="cto">' + by + 'が討ちとった' + (e.reward ? '（小判＋' + e.reward + '両）' : '') + '</div>' : '') + '</div>', 2100);
  }
  await wait(2100);
}
const hvEl = u => document.querySelector('#gHand .fuda[data-u="' + u + '"]');
function bumpEl(el) { if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function hvCount() {
  const n = document.querySelectorAll('#gHand > .fuda:not(.out)').length;
  const b = document.querySelector('#gMe .hn b');
  if (b && b.textContent !== String(n)) { b.textContent = n; bumpEl(b); }
}
function hvOut(h) {
  HV.gone.add(h.u);
  const el = hvEl(h.u); if (!el) return;
  $('gHand').__h = null;
  el.classList.add('out');
  setTimeout(() => { el.remove(); const z = document.querySelector('#gHand .hz-sp'); if (z && !z.querySelector('.fuda')) z.remove(); }, 300 * SPEED);
}
/* 使った札を手札から消す（ids の札を1枚ずつ） */
function hvTake(ids) {
  if (!HV.on || !ids || !ids.length) return 0;
  const want = ids.slice(); let n = 0;
  HV.removed = HV.removed.filter(h => { const i = want.indexOf(h.c); if (i < 0) return true; want.splice(i, 1); hvOut(h); n++; return false; });
  if (n) hvCount();
  return n;
}
function hvTakeIf(pred, max) {
  if (!HV.on) return 0;
  let n = 0;
  HV.removed = HV.removed.filter(h => { if (n >= max || !pred(h)) return true; hvOut(h); n++; return false; });
  if (n) hvCount();
  return n;
}
/* 札を1枚、並びの正しい場所に入れる */
function hvIn(h) {
  const box = $('gHand'); if (!box || hvEl(h.u)) return null;
  box.__h = null;
  HV.ins.push(h);
  const em = box.querySelector('.hand-empty'); if (em) em.remove();
  const t = document.createElement('div');
  t.innerHTML = fudaHTML(h.c, { u: h.u, tag: 'button', nw: true });
  const el = t.firstElementChild; if (!el) return null;
  let parent = box;
  if (isSpellId(h.c)) {
    parent = box.querySelector('.hz-sp');
    if (!parent) { parent = document.createElement('div'); parent.className = 'hz-sp'; parent.innerHTML = '<span class="hz-l" aria-hidden="true"><i>術</i><i>札</i></span>'; box.insertBefore(parent, box.firstChild); }
  }
  const K = sortKey(CARD[h.c]);
  const next = Array.from(parent.children).filter(x => x.classList.contains('fuda') && !x.classList.contains('out'))
    .find(x => { const c = cmpKey(sortKey(CARD[x.dataset.c]), K); return c > 0 || (c === 0 && Number(x.dataset.u) > h.u); });
  parent.insertBefore(el, next || null);
  if (ui.handSeen) ui.handSeen.add(h.u);
  ui.newU = ui.newU || {}; ui.newU[h.u] = Date.now();
  hvCount();
  return el;
}
/* 買った札・うばった札などは、その場ですぐ入れる */
function hvGive(ids) {
  if (!HV.on || !ids) return;
  ids.forEach(id => { const i = HV.added.findIndex(h => h.c === id); if (i >= 0) hvIn(HV.added.splice(i, 1)[0]); });
}
const deckPos = () => { const el = $('gCenterBox'); return el ? relPos(el) : null; };
/* 自分が引く：0.2秒ごとに1枚 */
async function hvDraw(n) {
  if (!HV.on || !n) return;
  hvTakeIf(() => true, 99);   /* 消えるはずの札が残っていたら先に消す */
  const from = deckPos();
  for (let i = 0; i < n && HV.added.length; i++) {
    const el = hvIn(HV.added.shift());
    if (el) flyCard(from, relPos(el), 170);
    sfx('draw');
    await wait(200);
  }
}
/* 相手の席の「札」の数 */
function seatCount(pid, delta, abs) {
  const b = document.querySelector('#gOpp .seat[data-pid="' + pid + '"] .hn b'); if (!b) return;
  const v = abs != null ? abs : Math.max(0, (Number(b.textContent) || 0) + delta);
  HV.seat[pid] = v;
  if (b.textContent === String(v)) return;
  b.textContent = v; $('gOpp').__h = null;
  bumpEl(b);
}
/* 相手が引く：0.2秒ごとに1枚、山から席へ飛ぶ */
async function seatDraw(G, pid, n, sp) {
  const P = G.players[pid]; if (!P || !n) return;
  const nonSp = Math.max(0, n - (sp || 0));
  let cur = Math.max(0, handN(P) - nonSp);
  seatCount(pid, 0, cur);
  const from = deckPos(), to = seatPos(pid);
  for (let i = 0; i < n; i++) {
    flyCard(from, to, 190);
    if (i < nonSp) setTimeout(() => seatCount(pid, 0, ++cur), 170 * SPEED);
    if (i === 0) sfx('draw');
    await wait(200);
  }
}

/* ---------- まん中の「攻め」：札を0.3秒ごとに1枚ずつ並べて、合計を出す ---------- */
const EFF_WORD = { curse: '呪い', seal: '封印', steal: '札をうばう' };
function atkParts(d) {
  return (d.cards || [d.card]).concat(d.adds || []).map(id => {
    const C = CARD[id];
    return { id, v: C.type === 'spell' ? (C.eff === 'dmg' || C.eff === 'drain' ? C.val : null) : C.atk };
  });
}
function atkFinal(G, d, me) {
  const C = CARD[d.card];
  if (C.type === 'spell' && !(C.eff === 'dmg' || C.eff === 'drain')) return { dmg: false, word: EFF_WORD[C.eff] || '術' };
  const myPid = me ? me.pid : -1;
  const nm = pid => (pid === myPid ? 'あなた' : esc(pname(G, pid)));
  const vals = atkParts(d).filter(x => x.v != null).map(x => x.v);
  const sum = vals.reduce((s, v) => s + v, 0);
  const base0 = d.crit ? Math.round((d.base || 0) / 2) : d.base || 0;
  const kiai = d.kiai ? 5 : 0, boost = d.boost || 0, other = base0 - sum - kiai - boost;
  const bon = [];
  if (kiai) bon.push(['気合', kiai]);
  if (boost) bon.push(['白虎', boost]);
  if (other) bon.push([C.type === 'spell' ? '式神・天候' : '式神・天候', other]);
  let formula = vals.length > 1 || bon.length ? vals.join(' ＋ ') + bon.map(([l, v]) => (v > 0 ? ' ＋ ' : ' − ') + l + Math.abs(v)).join('') + ' ＝ <b>' + base0 + '</b>' : '';
  if (d.crit) formula = (formula ? '（' + formula.replace(/<\/?b>/g, '') + '）' : base0) + ' × 2 会心 ＝ <b>' + d.base + '</b>';
  const ts = d.targets || [];
  if (ts.length === 1) {
    const t = ts[0], T = G.players[t], f = (d.aff || {})[t] || 0, fin = (d.atk || {})[t];
    if (T && fireImmune(T, d.elem)) return { dmg: true, num: d.base, formula, note: '<span class="bt-t down">九尾の狐に火は効かない</span>' };
    if (f) return { dmg: true, num: fin, formula, note: '<span class="bt-t ' + (f > 0 ? 'up' : 'down') + '">' + (f > 0 ? '相性◎ ×1.2' : '相性× 半分') + ' ＝ ' + fin + '</span>' };
    return { dmg: true, num: fin != null ? fin : d.base, formula };
  }
  const chips = ts.map(t => {
    const T = G.players[t], f = (d.aff || {})[t] || 0;
    if (T && fireImmune(T, d.elem)) return '<span class="bt-t down">' + nm(t) + ' 無効</span>';
    return '<span class="bt-t' + (f > 0 ? ' up' : f < 0 ? ' down' : '') + '">' + nm(t) + ' ' + (f > 0 ? '◎' : f < 0 ? '×' : '') + d.atk[t] + '</span>';
  }).join('');
  return { dmg: true, num: d.base, formula, chips };
}
/* 同じ攻めの盤なら、描きなおしても「ふわっと出る」動きをくり返さない */
const btKey = (G, d) => d.by + ':' + d.card + ':' + (d.chain || 0) + ':' + (d.stray || 0) + ':' + (d.targets || []).join('.') + ':' + G.turn;
function boardHTML(G, d, me, o) {
  o = o || {};
  const myPid = me ? me.pid : -1;
  const nm = pid => (pid === myPid ? 'あなた' : esc(pname(G, pid)));
  const C = CARD[d.card], A = G.players[d.by];
  const parts = atkParts(d), F = atkFinal(G, d, me);
  const hid = o.anim ? ' hid' : '';
  const ts = d.targets || [];
  const to = ts.length > 1 ? '相手全員' : ts.length ? nm(ts[0]) : '';
  const extra = [d.chain ? '照魔の鏡ではね返った攻め' : '', d.stray ? (d.from != null ? esc(pname(G, d.from)) + 'が' : '') + '弾いた流れ弾' : '', d.slip != null ? 'すっぽ抜け（ねらいは' + nm(d.slip) + '）' : '', d.crit ? '会心の一撃' : '', d.kiai ? '気合入り' : '', d.boost ? '白虎の力' : ''].filter(Boolean).join('・');
  return '<div class="bt bt2" data-bt="' + btKey(G, d) + '">' +
    '<div class="bt-head">' + (A ? embHTML(A.guardian, 34) : '') + '<div class="bt-who"><span><b>' + nm(d.by) + '</b>の' + (C.type === 'spell' ? '術' : '攻め') + '</span>' +
      (d.elem ? '<span class="elchip el-' + d.elem + '">' + crestSVG(d.elem) + d.elem + '</span>' : '') + (to ? '<span class="bt-to">→ ' + to + '</span>' : '') + (extra ? '<small>' + extra + '</small>' : '') + '</div></div>' +
    '<div class="bt-body"><div class="bt-row" style="--n:' + parts.length + '">' + parts.map((x, i) => (i ? '<span class="bt-op' + hid + '">＋</span>' : '') +
      '<button type="button" class="bt-c' + hid + '" data-lookcard="' + x.id + '">' + fudaHTML(x.id) + '</button>').join('') + '</div>' +
    '<div class="bt-side">' + (F.dmg ? '<div class="bt-sum"><span class="bt-k">' + (C.type === 'spell' ? 'ダメージ' : '攻撃') + '</span><b class="bt-n' + (o.anim ? '' : ' fin') + '">' + (o.anim ? 0 : F.num) + '</b></div>'
      : '<div class="bt-sum"><b class="bt-w' + hid + ' bad">' + F.word + '</b></div>') + '</div></div>' +
    (F.dmg && (F.formula || F.note || F.chips) ? '<div class="bt-x' + hid + '">' + (F.formula ? '<span>' + F.formula + '</span>' : '') + (F.note || '') + (F.chips || '') + '</div>' : '') +
    (o.foot ? '<div class="bt-foot">' + o.foot + '</div>' : '') +
    '</div>';
}
/* 霊が天の声・呪術・神の目を開いているときは、まん中をじゃましない */
function ghostBusy() { const me = mePlayer(shown); return !!(me && !me.alive && (ui.ghost || ui.look)); }
/* =====================================================================
   札を見せる：まん中の場所に札を大きく出して、しばらく見せてから効果を出す
   （画面に重ねず、いつもの場所で見せる）
   ===================================================================== */
const TEMPO = { reveal: 450, atk: [2800, 1800], def: [2600, 1600], none: 1800, multi: [2800, 1600], row: 380, use: [2600, 1500] };
const STAGE_MS = TEMPO.use[0];
function stageOpen(html) {
  const box = $('gCenter'); if (!box || ghostBusy()) return null;   /* 霊が天の声・呪術・神の目を開いているときは、まん中をじゃましない */
  setHTML(box, '<div class="c-body c-stg">' + html + '</div>');
  ui.centerKey = 'stage';
  return box;
}
/* 見せはじめてから total ミリ秒、最後の札が出てから after ミリ秒は見せる */
async function stageHold(t0, total, after) { await wait(Math.max(after, total - (performance.now() - t0) / SPEED)); }
/* 札を1枚ずつ出す。onEach(i) で合計を動かす */
async function stageReveal(box, onEach, sel, per) {
  const cs = box.querySelectorAll(sel || '.bt-c'), ops = box.querySelectorAll('.bt-op');
  for (let i = 0; i < cs.length; i++) {
    if (i && ops[i - 1]) ops[i - 1].classList.remove('hid');
    cs[i].classList.remove('hid'); cs[i].classList.add('lit');
    if (onEach) onEach(i);
    sfx('deal');
    await wait(per || TEMPO.reveal);
  }
  return cs.length;
}
async function playBoard(G, d, me) {
  const parts = atkParts(d);
  pres.board = true;
  try {
    const t0 = performance.now();
    const box = stageOpen(boardHTML(G, d, me, { anim: true }));
    if (!box) { await wait(TEMPO.atk[0]); return; }
    const n = box.querySelector('.bt-n'), x = box.querySelector('.bt-x'), w = box.querySelector('.bt-w');
    const F = atkFinal(G, d, me), C = CARD[d.card];
    const myPid = me ? me.pid : -1, nm = pid => (pid === myPid ? 'あなた' : esc(pname(G, pid)));
    let sum = 0;
    await wait(200);
    await stageReveal(box, i => { if (parts[i].v != null && n) { sum += parts[i].v; n.textContent = sum; bumpEl(n); } });
    if (d.slip != null) {
      /* ハプニング：すっぽ抜け。ねらった人とはちがう人に飛んでいく */
      telop('すっぽ抜けた！<small>' + nm(d.slip) + 'をねらったのに、' + nm((d.targets || [])[0]) + 'へ飛んでいく</small>', 'chaos', 1700);
      sfx('deflect'); shakeEl(box, 'hit', 420);
      await wait(1200);
    }
    if (n && F.dmg) { n.textContent = d.crit ? Math.round(d.base / 2) : F.num; n.classList.add('fin'); bumpEl(n); }
    if (x) x.classList.remove('hid');
    if (w) w.classList.remove('hid');
    sfx(C.type === 'spell' ? 'spell' : (d.targets || []).length > 1 ? 'allatk' : 'sword');
    if (d.crit && n) {
      /* ハプニング：会心の一撃。攻撃が2倍 */
      await wait(500);
      telop('会心の一撃！<small>攻撃が2倍</small>', 'chaos', 1400);
      n.textContent = F.num; bumpEl(n); sfx('bighit'); flash('#ffe08a');
      await wait(900);
    }
    await stageHold(t0, TEMPO.atk[0], TEMPO.atk[1]);
    ui.lastBt = btKey(G, d);
  } finally { pres.board = false; }
}
/* ---------- 守り：出した守札を1枚ずつ並べて、守りの合計とダメージを出す ---------- */
function defWord(res, dmgType) {
  switch (res.how) {
    case 'reflect': return 'はね返した！';
    case 'null': return 'なかったことに';
    case 'deflect': return '弾いた！';
    case 'dodge': return 'かわした！';
    case 'evade': return 'ひらりとかわした';
    case 'immune': return '火は効かない';
    case 'block': return dmgType ? '守りきった！' : '守札で防いだ';
  }
  if (!dmgType) return '';
  return 'ダメージ ' + (res.dmg || 0);
}
function defBoardHTML(G, e, res, me, o) {
  const myPid = me ? me.pid : -1;
  const T = G.players[res.t];
  const C = CARD[e.card];
  const dmgType = e.kind === 'attack' || C.eff === 'dmg' || C.eff === 'drain';
  const cards = res.cards || [];
  const raw = cards.reduce((s, id) => s + (CARD[id] && !CARD[id].special ? CARD[id].def || 0 : 0), 0);
  const showNum = dmgType && raw > 0 && (res.how === 'hit' || res.how === 'block');
  const word = defWord(res, dmgType) || (res.how === 'hit' && res.status ? ST_WORD[res.status] : '受けた');
  const bad = res.how === 'hit' && (res.dmg > 0 || !!res.status);
  const none = !cards.length ? (res.how === 'hit' ? '守札を出さずに受けた' : res.auto ? '式神の力' : '') : '';
  return '<div class="bt bt2 def">' +
    '<div class="bt-head">' + (T ? embHTML(T.guardian, 34) : '') + '<div class="bt-who"><span><b>' + (res.t === myPid ? 'あなた' : esc(pname(G, res.t))) + '</b>の守り</span>' +
      (dmgType && res.atk != null ? '<span class="bt-to">攻撃 ' + res.atk + ' に</span>' : '') +
      (o && o.n > 1 ? '<span class="bt-step">全体の攻め ' + (o.i + 1) + '／' + o.n + '</span>' : '') + '</div></div>' +
    '<div class="bt-body">' + (cards.length ? '<div class="bt-row" style="--n:' + cards.length + '">' + cards.map((id, i) => (i ? '<span class="bt-op hid">＋</span>' : '') + '<span class="bt-c hid">' + fudaHTML(id) + '</span>').join('') + '</div>' : '') +
      '<div class="bt-side">' + (none ? '<div class="bt-sub">' + none + '</div>' : '') +
        (showNum ? '<div class="bt-sum"><span class="bt-k">守り</span><b class="bt-n dn">0</b></div>' : '') +
        '<div class="bt-sum"><b class="bt-w hid' + (bad ? ' bad' : '') + '">' + word + '</b></div></div></div>' +
    '<div class="bt-x hid">' + (showNum ? '<span>攻撃 ' + res.atk + ' − 守り ' + res.def + (raw !== res.def ? '（式神で' + (res.def > raw ? '＋' : '−') + Math.abs(res.def - raw) + '）' : '') + '</span>' : '') +
      (res.miss ? '<span class="bt-t down">隠れ蓑は外れた</span>' : '') + '</div>' +
    '</div>';
}
async function playDefBoard(G, e, res, me, o) {
  pres.board = true;
  try {
    const t0 = performance.now();
    const cards = res.cards || [];
    const box = stageOpen(defBoardHTML(G, e, res, me, o));
    if (!box) { await wait(cards.length ? TEMPO.def[0] : TEMPO.none); return; }
    const n = box.querySelector('.bt-n');
    let sum = 0;
    await wait(200);
    await stageReveal(box, i => { const D = CARD[cards[i]]; if (n && D && !D.special) { sum += D.def || 0; n.textContent = sum; bumpEl(n); } });
    if (n) { n.textContent = res.def; bumpEl(n); }
    if (cards.length) await wait(350);
    box.querySelectorAll('.bt-x, .bt-w').forEach(x => x.classList.remove('hid'));
    const w = box.querySelector('.bt-w'); if (w) bumpEl(w);
    sfx(res.how === 'hit' && res.dmg ? 'deal' : res.how === 'reflect' ? 'reflect' : 'block');
    await stageHold(t0, cards.length ? TEMPO.def[0] : TEMPO.none, cards.length ? TEMPO.def[1] : 1200);
  } finally { pres.board = false; }
}
/* 道具・術・精錬などを使ったとき：札をまん中に出してしばらく見せる */
function useHTML(G, me, o) {
  const myPid = me ? me.pid : -1, nm = pid => (pid === myPid ? 'あなた' : esc(pname(G, pid)));
  const A = G.players[o.by];
  return '<div class="bt bt2 use">' +
    '<div class="bt-head">' + (A ? embHTML(A.guardian, 34) : '') + '<div class="bt-who"><span><b>' + nm(o.by) + '</b>' + (o.title || 'の札') + '</span>' +
      (o.to != null && o.to !== o.by ? '<span class="bt-to">→ ' + nm(o.to) + '</span>' : '') + '</div></div>' +
    '<div class="bt-body"><div class="bt-row" style="--n:' + o.cards.length + '">' + o.cards.map((id, i) => '<span class="bt-c hid">' + fudaHTML(id, o.badges && o.badges[i] ? { badge: o.badges[i] } : null) + '</span>').join('') + '</div>' +
      (o.word || o.sub ? '<div class="bt-side">' + (o.word ? '<div class="bt-sum"><b class="bt-w hid' + (o.cls ? ' ' + o.cls : '') + '">' + o.word + '</b></div>' : '') +
        (o.sub ? '<div class="bt-sub hid">' + o.sub + '</div>' : '') + '</div>' : '') + '</div>' +
    '</div>';
}
async function useStage(G, me, o) {
  pres.board = true;
  try {
    const t0 = performance.now();
    const box = stageOpen(useHTML(G, me, o));
    if (!box) { await wait(o.hold || TEMPO.use[0]); return; }
    await wait(200);
    await stageReveal(box);
    await wait(250);
    box.querySelectorAll('.bt-w, .bt-sub').forEach(x => x.classList.remove('hid'));
    const w = box.querySelector('.bt-w'); if (w) bumpEl(w);
    if (o.sfx) sfx(o.sfx);
    await stageHold(t0, o.hold || TEMPO.use[0], TEMPO.use[1]);
  } finally { pres.board = false; }
}
/* 道具を使ったときの効果のことば */
function itemWord(e) {
  const C = CARD[e.card] || {}, out = [];
  if (e.cured) out.push('呪い・封印をはらった');
  if (e.hp) out.push('体力＋' + e.hp);
  if (e.mp) out.push('霊力＋' + e.mp);
  if (e.gold) out.push('小判＋' + e.gold + '両');
  if (e.kiai) out.push('次の攻撃＋5');
  if (!out.length) out.push(C.eff === 'heal' || C.eff === 'cleanse' ? '体力はもう満タン' : C.eff === 'mp' ? '霊力はもう満タン' : C.eff === 'gold' || C.eff === 'maneki' ? '小判はもう満杯' : esc(C.name || ''));
  const cls = e.hp ? 'heal' : e.mp && !e.gold ? 'mp' : e.gold ? 'gold' : e.kiai ? 'bad' : '';
  return { word: out.join('・'), cls };
}

/* 霊獣が出てくるときの帯 */
function beastCut(bid, who, title, sub, ms) {
  const B = BEAST[bid]; if (!B) return;
  cutIn('<div class="cards"><span class="bcard' + (B.elem ? ' el-' + B.elem : '') + '">' + beastCardHTML(B.id) + '</span></div>' +
    '<div class="ctext"><div class="cwho">' + who + '</div><div class="cname">' + title + '</div>' + (sub ? '<div class="cto">' + sub + '</div>' : '') + '</div>', ms || 1300);
}
/* 霊力・小判の数字を、効果が出たときに新しい値にする（演出の最後まで待たない） */
function resNow(r, pid) {
  const P = r && r.game && r.game.players[pid]; if (!P) return;
  const me = mePlayer(shown);
  const set = (el, v) => { if (el && el.textContent !== String(v)) { el.textContent = v; bumpEl(el); } };
  if (me && me.pid === pid) { set(document.querySelector('#gMe .mpv'), P.mp); set(document.querySelector('#gMe .gdv'), P.gold); $('gMe').__h = null; }
  else { const s = document.querySelector('#gOpp .seat[data-pid="' + pid + '"]'); if (s) { set(s.querySelector('.rs-mp b'), P.mp); set(s.querySelector('.rs-gd b'), P.gold); $('gOpp').__h = null; } }
}
/* 守りの結果を1人ぶん、席の上に出す（ダメージ・防いだ・はね返した など） */
function showResult(G, e, res, me, fast) {
  const myPid = me ? me.pid : -1;
  const pos = seatPos(res.t), el = seatEl(res.t), isMe = res.t === myPid;
  if (res.how === 'hit' && res.dmg > 0) {
    popAt(pos, '−' + res.dmg, '');
    hpAdd(res.t, -res.dmg);
    if (res.aff > 0) popAt(pos ? { x: pos.x, y: pos.y - 28 } : null, '相性◎', 'word', 120);
    sfx(res.dmg >= 10 ? 'bighit' : 'hit');
    shakeEl(el, 'hit', 520);
    if (pos) FXC.sparks(pos.x, pos.y, 10, ['#ff9a7a', '#e8d199', '#fff']);
    if (isMe) { flash('#ff3b2a'); vibrate(res.dmg >= 10 ? [80, 40, 80] : 70); if (res.dmg >= 10) shakeEl($('shell'), 'shake-big', 820); }
    if (res.heal) { popAt(seatPos(e.by), '+' + res.heal, 'heal', 300); hpAdd(e.by, res.heal); }
  } else if (res.how === 'block' && !res.atk) { popAt(pos, '守札で防いだ', 'word'); sfx('block'); }
  else if (res.how === 'block') { popAt(pos, '防いだ', 'word'); sfx('block'); }
  else if (res.how === 'null') { popAt(pos, '身代わり', 'word'); sfx('nullify'); }
  else if (res.how === 'dodge') { popAt(pos, 'かわした', 'word'); sfx('dodge'); }
  else if (res.how === 'evade') { popAt(pos, 'ひらりとかわした', 'word'); sfx('dodge'); }
  else if (res.how === 'immune') { popAt(pos, '火は効かない', 'word'); sfx('block'); }
  else if (res.how === 'reflect') { popAt(pos, 'はね返した', 'word'); sfx('reflect'); flash('#fff6d0'); }
  else if (res.how === 'deflect') {
    popAt(pos, res.auto ? '幻惑で弾いた' : '弾いた', 'word'); sfx('deflect');
    const vp = seatPos(res.to);
    const later = fast ? 0 : 520;
    setTimeout(() => {
      popAt(vp ? { x: vp.x, y: vp.y - 26 } : null, res.to === res.t ? '自分に飛んでくる' : '流れ弾が飛んでいく', 'word');
      if (res.to === myPid) vibrate(50);
    }, later);
  }
  if (res.miss) popAt(pos ? { x: pos.x, y: pos.y - 28 } : null, '隠れ蓑は外れた', 'word', 150);
  if (res.how === 'hit' && res.status) {
    if (res.status === 'steal') { popAt(seatPos(res.on), res.stolen ? '札をうばわれた' : 'うばえなかった', 'word'); sfx('steal'); }
    else { popAt(seatPos(res.on), ST_WORD[res.status], 'word curse'); sfx(res.status === 'seal' ? 'seal' : 'curse'); }
  }
}
async function playEvent(e, r, fast) {
  const G = r.game, me = mePlayer(r), myPid = me ? me.pid : -1;
  if (screen !== 'game') return;
  const nm = pid => (pid === myPid ? 'あなた' : esc(pname(G, pid)));
  switch (e.k) {
    case 'declare': {
      const C = CARD[e.card];
      const used = (e.cards || [e.card]).concat(e.adds || []).filter(id => !isSpellId(id));
      if (e.by === myPid) hvTake(used); else if (used.length) seatCount(e.by, -used.length);
      if (fast) { sfx(C.type === 'spell' ? 'spell' : 'sword'); await wait(250); return; }
      const toMe = e.targets.includes(myPid);
      if (toMe) vibrate(60);
      await playBoard(G, e, me);
      if (toMe) flash('#ff6b4a');
      return;
    }
    case 'bounce': {
      if (fast) { sfx('reflect'); await wait(250); return; }
      const toMe = e.to === myPid;
      if (toMe) { vibrate([50, 30, 50]); flash('#fff6d0'); }
      await useStage(G, me, { by: e.by, to: e.to, cards: ['kagami', e.card], title: 'の照魔の鏡', word: 'はね返した！', sub: (e.atk ? '攻撃 ' + e.atk : '') + (e.chain > 1 ? '（' + e.chain + '回目）' : ''), sfx: 'reflect', hold: 2400 });
      return;
    }
    case 'stray': {
      /* 弾かれた攻めが「流れ弾」になって、当たる人の守りの番になる */
      if (fast) { sfx('deflect'); await wait(250); return; }
      if (e.to === myPid) { vibrate([50, 30, 50]); flash('#fff6d0'); }
      await useStage(G, me, { by: e.from, to: e.to, cards: e.auto ? [e.card] : ['hauchiwa', e.card], title: e.auto ? 'の幻惑' : 'の羽団扇', word: '流れ弾！',
        sub: (e.to === e.from ? '自分に飛んできた' : nm(e.to) + 'に飛んでいく') + (e.atk ? '　攻撃 ' + e.atk : '') + '<br>守札で守れます', cls: 'bad', sfx: 'deflect', hold: 2400 });
      return;
    }
    case 'summon': {
      if (e.by === myPid) hvTake([e.card]); else seatCount(e.by, -1);
      if (fast) { sfx('summon'); return; }
      const B = BEAST[e.b];
      const other = e.to != null && e.to !== e.by;
      beastCut(e.b, nm(e.by) + (other ? 'が' + nm(e.to) + 'に霊獣をつけた' : 'が霊獣を呼んだ') + (e.old ? '（' + esc(bname(e.old)) + 'と入れかわり）' : ''), esc(B ? B.name : ''), B ? 'アシスト：' + esc(B.text) : '', 1900);
      sfx('summon');
      await wait(1850);
      return;
    }
    case 'assist': {
      const B = BEAST[e.b]; if (!B) return;
      const pos = seatPos(e.p), to = e.to != null ? seatPos(e.to) : null;
      /* 霊獣の絵のカットインを2秒見せてから、効果が出る */
      if (!fast) { beastCut(e.b, nm(e.p) + 'の霊獣', esc(B.name) + 'のアシスト', esc(assistWord(G, e, me)), 2000); sfx('assist'); await wait(2000); }
      else sfx('assist');
      const d = 0;
      if (e.eff === 'heal' && e.v) { popAt(pos, '+' + e.v, 'heal', d); setTimeout(() => hpAdd(e.p, e.v), d * SPEED); }
      else if (e.eff === 'burn' && to && !e.v) popAt(to, '火は効かない', 'word', d);
      else if (e.eff === 'burn' && to) { setTimeout(() => { popAt(to, '−' + (e.v || 0), ''); hpAdd(e.to, -(e.v || 0)); shakeEl(seatEl(e.to), 'hit', 520); sfx('hit'); if (e.to === myPid) flash('#ff3b2a'); }, d); }
      else if (e.eff === 'boost') popAt(pos, '次の攻撃＋' + e.v, 'word', d);
      else if (e.eff === 'shell') popAt(pos, '甲羅', 'word', d);
      else if (e.eff === 'mp') { popAt(pos, '霊力+' + e.v, 'mp', d); resNow(r, e.p); }
      else if (e.eff === 'draw') { popAt(pos, '札＋' + (e.v || 0), 'word', d); if (e.p === myPid) hvGive(HV.added.slice(0, e.v || 0).map(h => h.c)); else seatCount(e.p, e.v || 0); }
      else if (e.eff === 'cleanse') { popAt(pos, e.cured ? '浄め' : '+' + (e.v || 0), e.cured ? 'word' : 'heal', d); if (!e.cured && e.v) setTimeout(() => hpAdd(e.p, e.v), d * SPEED); }
      else if (e.eff === 'discard' && to) { popAt(to, e.self ? 'しまった！札を1枚失った' : '札を1枚失った', 'word curse', d); if (e.to === myPid) hvTake([e.card]); else seatCount(e.to, -1); }
      else if (e.eff === 'gold') { popAt(pos, '+' + e.v + '両', 'gold', d); resNow(r, e.p); }
      else if (e.eff === 'reaper') {
        setTimeout(() => { (e.all || []).forEach((pid, i) => { const hp = (e.hits || [])[i]; popAt(seatPos(pid), '−' + (hp || 0), '', i * 120); hpAdd(pid, -(hp || 0)); shakeEl(seatEl(pid), 'hit', 520); }); hpAdd(e.p, -(e.selfHit || 0)); sfx('bighit'); if ((e.all || []).includes(myPid)) flash('#ff3b2a'); }, d);
        popAt(pos ? { x: pos.x, y: pos.y + 24 } : null, '自分にも−' + (e.selfHit || 0), 'word curse', d + 400);
      }
      if (!fast) await wait(e.eff === 'reaper' ? 1200 : 1000);
      return;
    }
    case 'beastgone': {
      if (fast) return;
      popAt(seatPos(e.p), esc(bname(e.b)) + 'が成仏', 'word curse', 300);
      sfx('gone');
      await wait(500);
      return;
    }
    case 'shell': {
      if (fast) return;
      popAt(seatPos(e.p), '甲羅で−' + e.cut, 'word', 650);
      setTimeout(() => sfx('block'), 650 * SPEED);
      return;
    }
    case 'fxdraw': {
      if (fast) return;
      popAt(seatPos(e.p), '通った！札＋' + e.n, 'word', 200);
      if (e.p === myPid) await hvDraw(e.n); else await seatDraw(G, e.p, e.n, 0);
      await wait(250);
      return;
    }
    case 'usurp': {
      if (e.by === myPid) hvTake([e.item]); else seatCount(e.by, -1);
      if (fast) { sfx('usurp'); return; }
      if (e.to === myPid) vibrate(50);
      await useStage(G, me, { by: e.by, to: e.to, cards: [e.item], title: 'の簒奪', word: '手札を1枚品定め', cls: 'bad', sub: '小判で買い取るかを決めます', sfx: 'usurp' });
      if (e.to === myPid) toast(pname(G, e.by) + 'があなたの札を品定めしています');
      return;
    }
    case 'sold': {
      if (e.by === myPid) hvTake(['oshiuri', e.card]); else seatCount(e.by, -2);
      if (e.to === myPid) hvGive([e.card]); else seatCount(e.to, 1);
      if (fast) { sfx('coin'); return; }
      const toMe = e.to === myPid;
      const pays = [];
      if (e.paid.gold) pays.push('小判' + e.paid.gold);
      if (e.paid.mp) pays.push('霊力' + e.paid.mp);
      if (e.paid.hp) pays.push('体力' + e.paid.hp);
      await useStage(G, me, { by: e.by, to: e.to, cards: ['oshiuri', e.card], badges: [null, e.price + '両'], title: 'の押し売り', word: esc(CARD[e.card].name) + 'を' + e.price + '両で', cls: 'gold',
        sub: (pays.join('・') || '0') + 'で払った' + (e.dead ? '（払いきれず成仏）' : ''), sfx: 'usurp' });
      if (toMe) { vibrate(60); flash(e.paid.hp ? '#ff3b2a' : '#e8d199'); }
      const tp = seatPos(e.to);
      if (e.paid.gold) popAt(tp, '−' + e.paid.gold + '両', 'gold');
      if (e.paid.mp) popAt(tp ? { x: tp.x, y: tp.y + 22 } : null, '霊力−' + e.paid.mp, 'mp', 150);
      if (e.paid.hp) { popAt(tp ? { x: tp.x, y: tp.y - 22 } : null, '−' + e.paid.hp, '', 300); hpAdd(e.to, -e.paid.hp); shakeEl(seatEl(e.to), 'hit', 520); }
      popAt(seatPos(e.by), '+' + e.price + '両', 'gold', 200);
      resNow(r, e.to); resNow(r, e.by);
      sfx('coin');
      await wait(1100);
      return;
    }
    case 'refine': {
      if (e.by === myPid) hvTake([e.card]); else seatCount(e.by, -1);
      if (fast) return;
      const pos = seatPos(e.by);
      const wd = [['hp', '体力'], ['mp', '霊力'], ['gold', '小判']].filter(([k]) => e.d[k]).map(([k, l]) => l + (e.d[k] > 0 ? '＋' : '−') + Math.abs(e.d[k])).join('・');
      await useStage(G, me, { by: e.by, cards: [e.card], title: 'の精錬', word: wd, sub: '体力・霊力・小判を入れかえた', sfx: 'power' });
      if (e.d.hp) hpAdd(e.by, e.d.hp);
      [['hp', '体力'], ['mp', '霊力'], ['gold', '小判']].forEach(([k, l], i) => { const v = e.d[k]; if (v) popAt(pos ? { x: pos.x, y: pos.y - 26 + i * 24 } : null, l + (v > 0 ? '+' : '−') + Math.abs(v), v > 0 ? (k === 'hp' ? 'heal' : k === 'mp' ? 'mp' : 'gold') : 'word', i * 160); });
      resNow(r, e.by);
      await wait(1100);
      return;
    }
    case 'usurped': {
      if (e.buy) {
        if (e.by === myPid) hvGive([e.card]); else seatCount(e.by, 1);
        if (e.to === myPid) hvTake([e.card]); else seatCount(e.to, -1);
      }
      if (fast) return;
      if (e.buy) {
        await useStage(G, me, { by: e.by, to: e.to, cards: [e.card], title: 'の簒奪', word: e.price + '両で買い取った', cls: 'gold', sfx: 'coin', hold: 2200 });
        popAt(seatPos(e.by), CARD[e.card].name + 'を買い取った', 'word');
        popAt(seatPos(e.to), '+' + e.price + '両', 'gold', 200);
        resNow(r, e.by); resNow(r, e.to);
      } else { popAt(seatPos(e.by), '買わなかった', 'word'); sfx('tap'); }
      await wait(1000);
      return;
    }
    case 'guard': {
      if (e.p === myPid) hvTakeIf(h => CARD[h.c] && CARD[h.c].type === 'armor', e.n); else if (e.n) seatCount(e.p, -e.n);
      const pos = seatPos(e.p);
      if (pos && !fast && e.n > 0) popAt(pos, '守り札', 'word');
      return;
    }
    case 'resolve': {
      e.results.forEach(res => {
        if (res.status === 'steal' && res.stolen) {
          if (res.on === myPid) hvTake([res.stolen]); else seatCount(res.on, -1);
          if (res.thief === myPid) hvGive([res.stolen]); else if (res.thief != null) seatCount(res.thief, 1);
        }
      });
      if (fast) { e.results.forEach(res => showResult(G, e, res, me, true)); return; }
      /* 守りはもう出そろったので、席の「守り中」のしるしは消す */
      document.querySelectorAll('#gOpp .seat .flag.def').forEach(x => x.remove()); $('gOpp').__h = null;
      /* 1人ずつ順番に：守りの札を見せてから、その人のダメージを出す（全体の攻めでも1人ずつ同じ流れ） */
      const n = e.results.length;
      for (let i = 0; i < n; i++) {
        const res = e.results[i];
        await playDefBoard(G, e, res, me, n > 1 ? { i, n } : null);
        showResult(G, e, res, me, false);
        await wait(res.how === 'deflect' ? 1500 : 1400);
      }
      return;
    }
    case 'ko': {
      if (e.p === myPid) hvTakeIf(() => true, 99); else seatCount(e.p, 0, 0);
      if (fast) { sfx('ko'); return; }
      await koScene(G, e, me);
      return;
    }
    case 'item': {
      if (e.by === myPid) hvTake([e.card]); else seatCount(e.by, -1);
      if (fast) return;
      const pos = seatPos(e.by);
      if (CARD[e.card] && CARD[e.card].eff === 'jobutsu') {
        await useStage(G, me, { by: e.by, to: e.to, cards: [e.card], title: 'の道具', word: '霊獣を成仏させる', cls: 'bad', sub: e.b ? esc(bname(e.b)) + 'をねらう（半分の確率）' : '', sfx: 'spell' });
        const tp = seatPos(e.to);
        popAt(tp, e.ok ? bname(e.b) + 'が成仏した' : '成仏しなかった', e.ok ? 'word curse' : 'word'); sfx(e.ok ? 'gone' : 'buzz');
        await wait(900);
        return;
      }
      /* 札を舞台に出して2秒見せてから、効果が出る（えらんだ人に効く。自分・味方・相手のだれでも） */
      const IW = itemWord(e);
      const to = e.to != null ? e.to : e.by, tpos = seatPos(to);
      await useStage(G, me, { by: e.by, to, cards: [e.card], title: 'の道具', word: IW.word, cls: IW.cls, sfx: 'select', sub: to !== e.by && G.players[to] && G.players[e.by] && !sameTeam(G.players[to], G.players[e.by]) ? '相手に使った！' : '' });
      if (e.hp) { popAt(tpos, '+' + e.hp, 'heal'); hpAdd(to, e.hp); }
      if (e.mp) popAt(tpos, '霊力+' + e.mp, 'mp', e.hp ? 250 : 0);
      if (e.gold) popAt(tpos, '+' + e.gold + '両', 'gold', 120);
      if (e.mp || e.gold) resNow(r, to);
      if (e.kiai) popAt(tpos, '気合', 'word');
      if (e.cured) popAt(tpos, '浄め', 'word', 200);
      if (tpos && e.hp) FXC.sparks(tpos.x, tpos.y, 10, ['#9fe0a2', '#fff3d2', '#ffffff']);
      sfx(e.kiai ? 'power' : e.gold && !e.hp ? 'coin' : 'heal');
      await wait(1100);
      return;
    }
    case 'spell': {
      if (fast) return;
      const C = CARD[e.card], pos = seatPos(e.to);
      await useStage(G, me, { by: e.by, to: e.to, cards: [e.card], title: 'の術', word: C.eff === 'heal' ? '体力＋' + (e.v || 0) : '霧隠れ', cls: C.eff === 'heal' ? 'heal' : 'mp', sub: C.eff === 'heal' ? '' : '次の自分の番まで狙われない', sfx: 'spell' });
      if (C.eff === 'heal') { popAt(pos, '+' + e.v, 'heal'); hpAdd(e.to, e.v); sfx('heal'); if (pos) FXC.sparks(pos.x, pos.y, 10, ['#9fe0a2', '#fff3d2', '#ffffff']); }
      else { popAt(pos, '霧隠れ', 'word'); sfx('spell'); }
      await wait(1100);
      return;
    }
    case 'shop': {
      if (e.by === myPid) { hvTake(e.sold); if (e.bought) hvGive([e.bought]); }
      else seatCount(e.by, -e.sold.filter(id => !isSpellId(id)).length + (e.bought && !isSpellId(e.bought) ? 1 : 0));
      if (fast) return;
      const pos = seatPos(e.by);
      const sc = e.sold.concat(e.bought ? [e.bought] : []);
      if (sc.length) {
        const wd = [e.gain ? '売って＋' + e.gain + '両' : '', e.bought ? esc(CARD[e.bought].name) + 'を' + (e.price || 0) + '両で買った' : ''].filter(Boolean).join('・');
        await useStage(G, me, { by: e.by, cards: sc.slice(-5), badges: sc.slice(-5).map((id, i) => (e.bought && i === sc.slice(-5).length - 1 ? '買った' : '売った')), title: 'のよろず屋', word: wd, cls: 'gold', sfx: 'coin', hold: 2300 });
      }
      if (e.gain) popAt(pos, '+' + e.gain + '両', 'gold');
      resNow(r, e.by);
      if (e.bought) popAt(pos, CARD[e.bought].name + 'を買った', 'word', e.gain ? 300 : 0);
      sfx('coin');
      await wait(900);
      return;
    }
    case 'omikuji': {
      const O = OMIKUJI.find(o => o.id === e.r) || OMIKUJI[4];
      if (fast) { sfx('omikuji'); return; }
      sfx(e.timeout ? 'timeup' : 'omikuji');
      cutIn('<div class="cards">' + kujiHTML(O.id) + '</div><div class="ctext"><div class="cwho">' + nm(e.p) + (e.timeout ? '（時間切れ）' : '') + 'のおみくじ</div>' +
        '<div class="cname">' + O.name + '</div><div class="cto">' + esc(omikujiWord(e)) + '</div></div>', 2000);
      setTimeout(() => sfx(O.id === 'daikichi' ? 'daikichi' : O.id === 'kyo' ? 'kyo' : 'kichi'), 420 * SPEED);
      const pos = seatPos(e.p);
      if (e.hp) { popAt(pos, '+' + e.hp, 'heal', 700); setTimeout(() => hpAdd(e.p, e.hp), 700 * SPEED); }
      if (e.mp) popAt(pos ? { x: pos.x, y: pos.y - 24 } : null, '霊力+' + e.mp, 'mp', 800);
      if (e.gold) popAt(pos ? { x: pos.x, y: pos.y + 24 } : null, '+' + e.gold + '両', 'gold', 900);
      if (O.id === 'daikichi' && pos) setTimeout(() => FXC.sparks(pos.x, pos.y, 16, ['#e8d199', '#fff3d2', '#c0503a']), 600 * SPEED);
      await wait(1950);
      return;
    }
    case 'swapped': {
      if (e.p === myPid) hvTakeIf(h => !isSpellId(h.c), e.n); else seatCount(e.p, -e.n);
      if (fast) return;
      popAt(seatPos(e.p), e.n ? e.n + '枚入れかえた' : '入れかえなかった', 'word');
      if (e.n) sfx('paper');
      await wait(300);
      if (e.got) { if (e.p === myPid) await hvDraw(e.got); else await seatDraw(G, e.p, e.got, 0); }
      return;
    }
    case 'refill': {
      /* 補充：0.2秒ごとに1枚。終わってから次の番になる */
      if (fast) return;
      popAt(seatPos(e.p), '札＋' + e.n, 'word draw');
      if (e.p === myPid) await hvDraw(e.n); else await seatDraw(G, e.p, e.n, e.sp);
      await wait(120);
      return;
    }
    case 'curse': {
      if (fast) return;
      popAt(seatPos(e.p), '−' + e.dmg, 'curse'); hpAdd(e.p, -e.dmg); sfx('curseTick'); shakeEl(seatEl(e.p), 'hit', 520);
      await wait(650);
      return;
    }
    case 'weather': {
      if (fast || e.s <= 3) return;
      const w = WEATHER[e.w]; if (!w) return;
      const voice = e.voice != null ? '天の声（' + nm(e.voice) + 'の霊' + ((e.voters || []).length > 1 ? '・' + e.voters.length + '人の声からランダム' : '') + '）<br>' : '';
      telop('第' + kanjiNum(e.round) + '巡　' + esc(w.name) + '<small>' + voice + esc(w.text) + '</small>', e.voice != null ? 'ghost' : '', voice ? 1900 : 1500);
      sfx(e.voice != null ? 'summon' : 'pray');
      await wait(voice ? 1700 : 1300);
      return;
    }
    case 'hexcast': {
      if (fast) return;
      popAt(seatPos(e.to), '呪術の気配…', 'word curse');
      sfx('curseTick');
      if (e.to === myPid) toast(pname(G, e.by) + 'の霊が、あなたに呪術をかけました。次の番のはじめに吉か凶が出ます');
      else if (e.by === myPid) toast(pname(G, e.to) + 'に呪術をかけました。次の番のはじめに効きます');
      await wait(450);
      return;
    }
    case 'hex': {
      const X = HEX_OF(e.fx), pos = seatPos(e.to);
      if (X.id === 'kitsuneki') { if (e.to === myPid) hvTakeIf(h => !isSpellId(h.c), 99); else seatCount(e.to, -(e.n || 0)); }
      if (fast) { if (e.hp) hpAdd(e.to, e.hp); return; }
      const B = G.players[e.by];
      cutIn('<div class="cards"><span class="ghost-emb">' + (B ? embHTML(B.guardian, 64) : '') + '</span></div><div class="ctext"><div class="cwho">' + nm(e.by) + 'の霊の呪術 → ' + nm(e.to) + '</div>' +
        '<div class="cname"><span class="hx-tag ' + (e.good ? 'good' : 'bad') + '">' + (e.good ? '吉' : '凶') + '</span>' + X.name + '</div><div class="cto">' + esc(hexWord(G, e)) + '</div></div>', 1700);
      sfx(e.good ? (X.id === 'daikago' ? 'daikichi' : 'kichi') : (X.id === 'daitatari' ? 'kyo' : 'curse'));
      if (e.to === myPid) { vibrate(e.good ? 40 : [60, 40, 60]); flash(e.good ? '#fff3c0' : '#9b6fd0'); }
      setTimeout(() => {
        if (e.hp) { popAt(pos, (e.hp > 0 ? '+' : '−') + Math.abs(e.hp), e.hp > 0 ? 'heal' : ''); hpAdd(e.to, e.hp); if (e.hp < 0) shakeEl(seatEl(e.to), 'hit', 520); }
        if (e.mp) popAt(pos ? { x: pos.x, y: pos.y - 24 } : null, '霊力' + (e.mp > 0 ? '+' : '−') + Math.abs(e.mp), e.mp > 0 ? 'mp' : 'word curse', 120);
        if (e.gold) popAt(pos ? { x: pos.x, y: pos.y + 24 } : null, (e.gold > 0 ? '+' : '−') + Math.abs(e.gold) + '両', e.gold > 0 ? 'gold' : 'word curse', 200);
        if (!e.hp && !e.mp && !e.gold) popAt(pos, (e.good ? '吉 ' : '凶 ') + X.name, e.good ? 'word' : 'word curse');
        if (e.mp || e.gold) resNow(r, e.to);
        if (pos && e.good) FXC.sparks(pos.x, pos.y, 12, ['#fff3c0', '#e8d199', '#ffffff']);
      }, 650 * SPEED);
      await wait(1100);
      if (e.got) { if (e.to === myPid) await hvDraw(e.got); else await seatDraw(G, e.to, e.got, 0); }
      await wait(450);
      return;
    }
    case 'hpswap': {
      if (e.by === myPid) hvTake([e.card]); else seatCount(e.by, -1);
      if (fast) { hpAdd(e.by, e.hb - e.ha); hpAdd(e.to, e.ha - e.hb); return; }
      if (e.to === myPid) vibrate([60, 40, 60]);
      await useStage(G, me, { by: e.by, to: e.to, cards: [e.card], title: 'の道具', word: '体力入れかえ！', cls: 'bad', sub: nm(e.by) + ' ' + e.ha + ' ⇄ ' + e.hb + ' ' + nm(e.to), sfx: 'spell' });
      const a = seatPos(e.by), b = seatPos(e.to);
      flyCard(a, b, 380); flyCard(b, a, 380);
      sfx('reflect');
      await wait(420);
      popAt(a, (e.hb >= e.ha ? '+' : '−') + Math.abs(e.hb - e.ha), e.hb >= e.ha ? 'heal' : ''); hpAdd(e.by, e.hb - e.ha);
      popAt(b, (e.ha >= e.hb ? '+' : '−') + Math.abs(e.ha - e.hb), e.ha >= e.hb ? 'heal' : ''); hpAdd(e.to, e.ha - e.hb);
      shakeEl(seatEl(e.by), 'hit', 520); shakeEl(seatEl(e.to), 'hit', 520);
      await wait(1100);
      return;
    }
    case 'fukuwarai': {
      if (e.by === myPid) hvTake([e.card]); else seatCount(e.by, -1);
      const mine = me ? (e.deal || {})[me.pid] : null;
      if (fast) { if (me && mine) { hvTakeIf(h => !isSpellId(h.c), 99); hvGive(mine); } return; }
      await useStage(G, me, { by: e.by, cards: [e.card], title: 'の道具', word: '福笑い！', cls: 'gold', sub: '全員の手札をまぜて配り直す', sfx: 'paper' });
      /* 全員の札が、まん中に集まって、また配られる */
      const mid = deckPos();
      G.players.filter(p => p.alive).forEach((p, i) => { const pp = seatPos(p.pid); setTimeout(() => { flyCard(pp, mid, 260); setTimeout(() => flyCard(mid, pp, 260), 520 * SPEED); }, i * 90 * SPEED); });
      sfx('paper');
      await wait(500);
      if (me && mine) { hvTakeIf(h => !isSpellId(h.c), 99); await wait(250); hvGive(mine); sfx('draw'); }
      await wait(900);
      if (me && mine) popAt(seatPos(me.pid), '手札が入れかわった', 'word');
      await wait(400);
      return;
    }
    case 'happen': await playHappen(e, r, fast); return;
    case 'left': toast(pname(G, e.p) + 'さんが抜けたので、CPUが代わりに戦います'); return;
    default: return;
  }
}
/* ---------- ハプニング（巡のはじめ） ---------- */
const HAPPEN_SEAL = { nezumi: '鼠', nagareboshi: '星', jishin: '震', matsuri: '祭', yomeiri: '嫁', irekawari: '魂', iede: '獣', takarakuji: '籤' };
const HAPPEN_OF = id => HAPPENINGS.find(h => h.id === id) || HAPPENINGS[0];
/* 何が起きたかをひとことで */
function happenWord(G, e, me) {
  const myPid = me ? me.pid : -1, nm = pid => (pid === myPid ? 'あなた' : esc(pname(G, pid)));
  switch (e.id) {
    case 'nezumi': return nm(e.from) + 'の小判' + e.v + '両が、' + nm(e.to) + 'のもとへ';
    case 'nagareboshi': return nm(e.to) + 'に星が落ちた！札を' + (e.got || 0) + '枚引く';
    case 'jishin': return '全員の体力−3';
    case 'matsuri': return '全員の体力＋5';
    case 'yomeiri': return '手札を1枚ずつ、となりの人へ渡した';
    case 'irekawari': return nm(e.a) + '（' + e.ha + '）と' + nm(e.b) + '（' + e.hb + '）の体力が入れかわった！';
    case 'iede': return (e.moves || []).map(m => esc(bname(m.b)) + 'が' + (m.t < 0 ? '龍神のもとにいられず去った' : nm(m.t) + 'のもとへ')).join('、') || '霊獣が引っこした';
    case 'takarakuji': return nm(e.to) + 'が当たり！小判＋' + (e.v || 0) + '両';
  }
  return '';
}
async function playHappen(e, r, fast) {
  const G = r.game, me = mePlayer(r), myPid = me ? me.pid : -1;
  const H = HAPPEN_OF(e.id);
  /* 手札の動き（狐の嫁入り）は、見せる見せないにかかわらず数を合わせる */
  const moveCards = () => (e.moves || []).forEach(m => {
    if (e.id !== 'yomeiri') return;
    if (m.f === myPid) hvTake([m.c]); else seatCount(m.f, -1);
    if (m.t === myPid) hvGive([m.c]); else if (m.t >= 0) seatCount(m.t, 1);
  });
  if (fast) {
    moveCards();
    if (e.id === 'jishin') (e.hits || []).forEach(x => hpAdd(x.p, -x.d));
    if (e.id === 'matsuri') (e.heals || []).forEach(x => hpAdd(x.p, x.v));
    if (e.id === 'irekawari') { hpAdd(e.a, e.hb - e.ha); hpAdd(e.b, e.ha - e.hb); }
    return;
  }
  cutIn('<div class="cards"><span class="hp-seal">' + (HAPPEN_SEAL[e.id] || '変') + '</span></div><div class="ctext"><div class="cwho">ハプニング！</div>' +
    '<div class="cname">' + esc(H.name) + '</div><div class="cto">' + happenWord(G, e, me) + '</div></div>', 2100);
  sfx(e.id === 'jishin' ? 'bighit' : e.id === 'matsuri' || e.id === 'takarakuji' ? 'daikichi' : 'summon');
  if (e.id === 'jishin') { shakeEl($('shell'), 'shake-big', 900); vibrate([60, 40, 60]); }
  await wait(1900);
  const pos = pid => seatPos(pid);
  switch (e.id) {
    case 'nezumi': flyCard(pos(e.from), pos(e.to), 420); popAt(pos(e.from), '−' + e.v + '両', 'word curse'); popAt(pos(e.to), '+' + e.v + '両', 'gold', 380); resNow(r, e.from); resNow(r, e.to); sfx('coin'); break;
    case 'nagareboshi': popAt(pos(e.to), '札＋' + (e.got || 0), 'word draw'); if (e.to === myPid) await hvDraw(e.got || 0); else await seatDraw(G, e.to, e.got || 0, 0); break;
    case 'jishin': (e.hits || []).forEach((x, i) => { if (x.d) { popAt(pos(x.p), '−' + x.d, '', i * 80); hpAdd(x.p, -x.d); shakeEl(seatEl(x.p), 'hit', 520); } }); if ((e.hits || []).some(x => x.p === myPid && x.d)) flash('#ff3b2a'); break;
    case 'matsuri': (e.heals || []).forEach((x, i) => { if (x.v) { popAt(pos(x.p), '+' + x.v, 'heal', i * 80); hpAdd(x.p, x.v); } }); sfx('heal'); break;
    case 'yomeiri': (e.moves || []).forEach((m, i) => { setTimeout(() => flyCard(pos(m.f), m.t >= 0 ? pos(m.t) : deckPos(), 360), i * 110 * SPEED); }); sfx('paper'); moveCards(); break;
    case 'irekawari': {
      flyCard(pos(e.a), pos(e.b), 380); flyCard(pos(e.b), pos(e.a), 380); sfx('reflect');
      await wait(400);
      const d = e.hb - e.ha;
      popAt(pos(e.a), (d >= 0 ? '+' : '−') + Math.abs(d), d >= 0 ? 'heal' : ''); hpAdd(e.a, d);
      popAt(pos(e.b), (d <= 0 ? '+' : '−') + Math.abs(d), d <= 0 ? 'heal' : ''); hpAdd(e.b, -d);
      break;
    }
    case 'iede': (e.moves || []).forEach(m => { flyCard(pos(m.f), m.t >= 0 ? pos(m.t) : null, 420); if (m.t >= 0) popAt(pos(m.t), bname(m.b) + 'が来た', 'word', 380); else popAt(pos(m.f), bname(m.b) + 'が去った', 'word curse', 200); }); sfx('assist'); $('gOpp').__h = null; break;
    case 'takarakuji': popAt(pos(e.to), '+' + (e.v || 0) + '両', 'gold'); resNow(r, e.to); sfx('coin'); if (pos(e.to)) FXC.sparks(pos(e.to).x, pos(e.to).y, 14, ['#e8d199', '#fff3d2', '#c0503a']); break;
  }
  await wait(900);
}
function afterRender(evs, r) {
  const G = r.game, me = mePlayer(r);
  const t = evs.filter(e => e.k === 'turn').pop();
  if (t && G.phase !== 'over' && G.cur === t.p) {
    if (me && t.p === me.pid) { telop('あなたの番', '', 1100); sfx('myturn'); vibrate(40); }
    else sfx('turn');
  }
  sceneBGM();
}
function showResultSoon(r, now) {
  const G = r.game;
  if (pres.resultFor === G.gid) return;
  pres.resultFor = G.gid;
  setTimeout(() => {
    if (!shown || !shown.game || shown.game.gid !== G.gid) return;
    renderResult();
    showScreen('result');
    guardAt.res = Date.now();
    const me = mePlayer(shown);
    const won = me && G.winner != null && me.team === G.winner;
    sfx(won || !me ? 'win' : 'lose');
    FXC.petals(won ? 110 : 50, won);
  }, now ? 200 : 1300);
}
function kanjiNum(n) {
  const D = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n < 10) return D[n];
  if (n < 20) return '十' + (n % 10 ? D[n % 10] : '');
  if (n < 100) return D[Math.floor(n / 10)] + '十' + (n % 10 ? D[n % 10] : '');
  return String(n);
}

/* ---------- state helpers ---------- */
function resetSel() { ui.swap = []; ui.sel = null; ui.ws = []; ui.adds = []; ui.target = null; ui.def = []; ui.shop = false; ui.buy = -1; ui.sell = []; ui.ware = null; ui.ref = { hp: 0, mp: 0, gold: 0 }; }
function isMyAct(G, me) { return !!(me && me.alive && G.phase === 'act' && G.cur === me.pid); }
function myDefPending(G, me) { return !!(me && me.alive && G.phase === 'defend' && G.pend && G.pend.targets.includes(me.pid) && !G.pend.resp[me.pid]); }
function selCard(me) { const h = me && ui.sel != null ? me.hand.find(x => x.u === ui.sel) : null; return h ? CARD[h.c] : null; }
/* おみくじの紙（縦書きは1字ずつ積む） */
function kujiHTML(id, cls) {
  const O = OMIKUJI.find(o => o.id === id) || OMIKUJI[4];
  const col = t => Array.from(t).map(c => '<i>' + c + '</i>').join('');
  return '<span class="kuji r-' + O.id + (cls ? ' ' + cls : '') + '"><small>' + col('御神籤') + '</small><b>' + col(O.name) + '</b></span>';
}
function mySwap(G, me) { return !!(me && me.alive && G.phase === 'swap' && G.pend && G.pend.by === me.pid); }
/* おみくじの結果をひとことで */
function omikujiWord(e) {
  const out = [];
  if (e.hp) out.push('体力＋' + e.hp);
  if (e.mp) out.push('霊力＋' + e.mp);
  if (e.gold) out.push('小判＋' + e.gold);
  if (e.swap) out.push(e.timeout ? '（時間切れなので入れかえなし）' : '札を' + e.swap + '枚まで入れかえ');
  return out.length ? out.join('・') : 'なにも起きない…';
}
function myUsurp(G, me) { return !!(me && me.alive && G.phase === 'usurp' && G.pend && G.pend.by === me.pid); }
function viewOf(G, me) {
  if (G.phase === 'over') return 'over';
  if (!me) return 'spect';
  if (!me.alive) return 'dead';
  if (myDefPending(G, me)) return 'defend';
  if (myUsurp(G, me)) return 'usurp';
  if (mySwap(G, me)) return 'swap';
  if (isMyAct(G, me)) return ui.shop ? 'shop' : ui.sel != null ? 'card' : 'mine';
  return 'wait';
}
/* えらべる人（札はだれにでも使える：自分・味方・相手） */
function targetPids(G, me, C) {
  if (!me || !C || !isMyAct(G, me)) return [];
  if (randomTarget(G, C)) return [];
  const aim = aimOf(C);
  if (aim === 'all' || aim === 'none') return [];
  if (C.type === 'spell' && (wKind(G, 'nospell') || me.st.seal > 0 || me.mp < spellCost(G, me, C))) return [];
  if (C.type === 'summon' && me.mp < summonCost(me, C)) return [];
  return targetsFor(G, me, C).map(p => p.pid);
}
/* 相手をえらばないと使えない札（よいことをする札は、えらばなければ自分に使う） */
const needsTarget = C => !!C && !(shown && randomTarget(shown.game, C)) && aimOf(C) === 'harm';
/* よいことをする札（自分か、えらんだだれかに使う） */
const helpCard = C => aimOf(C) === 'help';
const WHY = { rain: '梅雨のあいだは術が使えません', sealed: '封印されているので、いまは術を使えません', nosummon: '龍神には霊獣をつけられません', nosell: '売りつける札が手札にありません', target: 'いま使える相手がいません' };
/* 武器をえらんでいるときに、いっしょに出せる札。追撃札はいつでも。武器どうしは「同じ属性」で「全体でない」ときだけ */
function addable(me, C, h) {
  if (!C || C.type !== 'weapon' || h.u === ui.sel) return false;
  const HC = CARD[h.c];
  if (HC.type === 'plus') return true;
  return HC.type === 'weapon' && !!C.elem && !C.all && !HC.all && HC.elem === C.elem;
}
const affTxt = f => (f > 0 ? '相性◎（1.2倍）' : f < 0 ? '相性×（半分）' : '');
/* ---------- 手札の並び：術 → 攻撃（武器・追撃）→ 守り → その他（道具・召喚）。同じ組の中は数値の小さい順 ---------- */
const SORT_GRP = { spell: 0, weapon: 1, plus: 2, armor: 3, item: 4, summon: 5 };
const ITEM_GRP = { heal: 0, mp: 1, gold: 2, maneki: 3, kiai: 4, cleanse: 5, jobutsu: 6, usurp: 7, sell: 8, refine: 9 };
const SPECIAL_GRP = { dodge: 0, null: 1, deflect: 2, reflect: 3 };
function sortKey(C) {
  if (!C) return [9, 0, 0, 0, ''];
  let sub = 0, v = 0;
  if (C.type === 'spell' || C.type === 'summon') v = C.mp || 0;
  else if (C.type === 'weapon' || C.type === 'plus') v = C.atk || 0;
  else if (C.type === 'armor') { sub = C.special ? 1 : 0; v = C.special ? SPECIAL_GRP[C.special] || 0 : C.def || 0; }
  else if (C.type === 'item') { sub = ITEM_GRP[C.eff] != null ? ITEM_GRP[C.eff] : 10; v = C.val || 0; }
  return [SORT_GRP[C.type] != null ? SORT_GRP[C.type] : 6, sub, v, C.elem ? ELEMS.indexOf(C.elem) + 1 : 0, C.id];
}
function cmpKey(a, b) { for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; }
function sortHand(hand) { return hand.slice().sort((x, y) => cmpKey(sortKey(CARD[x.c]), sortKey(CARD[y.c])) || x.u - y.u); }
/* 相手の式神に対する、この札の相性（属性のある攻め・ダメージ術だけ）。null は関係なし */
function affFor(G, C, t) {
  if (!C || !C.elem) return null;
  const dmg = C.type === 'weapon' || (C.type === 'spell' && (C.eff === 'dmg' || C.eff === 'drain'));
  if (!dmg) return null;
  if (fireImmune(t, C.elem)) return 'immune';
  return affinity(C.elem, guardOf(t).elem);
}
/* 式神の弱点（この属性の攻めが1.2倍） */
function weakChip(p) {
  const g = guardOf(p), w = weakVs(g.elem);
  return w ? '<span class="wk el-' + w + '" title="弱点：' + w + 'の攻めが1.2倍"><small>弱</small>' + crestSVG(w) + '</span>' : '';
}
function strongVs(elem) { return BEATS[elem]; }
function weakVs(elem) { return ELEMS.find(e => BEATS[e] === elem); }

/* =====================================================================
   RENDER
   ===================================================================== */
function renderGame() {
  const R = shown; if (!R || !R.game) return;
  const G = R.game, me = mePlayer(R);
  const key = G.gid + ':' + G.turn + ':' + G.phase;
  if (ui.key !== key) { ui.key = key; resetSel(); }
  if (ui.sending && (R.ver > ui.sentVer || Date.now() - ui.sendAt > 8000)) ui.sending = false;
  if (me) {
    if (ui.sel != null && !me.hand.some(h => h.u === ui.sel)) { ui.sel = null; ui.ws = []; ui.adds = []; ui.target = null; }
    const has = u => me.hand.some(h => h.u === u);
    ui.ws = ui.ws.filter(has); ui.adds = ui.adds.filter(has); ui.def = ui.def.filter(has); ui.sell = ui.sell.filter(has);
  }
  if (ui.look && ui.look.k === 'card' && ui.look.u != null && !(me && me.hand.some(h => h.u === ui.look.u))) ui.look = null;
  const view = viewOf(G, me);
  if (view === 'card' || view === 'defend' || view === 'shop') ui.look = null;
  if (view !== ui.lastView) { if (view === 'defend' || view === 'over') guardAt.act = Date.now(); ui.lastView = view; }
  /* top */
  $('gRound').textContent = '第' + kanjiNum(G.round) + '巡';
  const w = WEATHER[G.weather];
  setHTML($('gWeather'), w ? weatherCrest(w) + '<b>' + esc(w.name) + '</b><span>' + esc(weatherShort(w)) + '</span>' : '');
  if (w) $('gWeather').style.setProperty('--wc', WX_COLOR[w.id] || 'var(--kin-hi)');
  /* opponents */
  renderOpp(G, me, view);
  /* me */
  renderMe(G, me, view);
  /* hand */
  renderHand(G, me, view);
  /* center, guide, buttons */
  renderCenter(G, me, view);
  renderGuide(G, me, view);
  renderActs(G, me, view);
  /* side log (横長のとき) */
  const lines = G.log.map(e => logText(G, e, me)).filter(Boolean).slice(-14);
  const logEl = $('gLogSide');
  if (logEl.offsetParent !== null) { setHTML(logEl, '<p class="lh">戦況</p>' + lines.map(l => '<p>' + l + '</p>').join('')); logEl.scrollTop = 1e6; }
  updateTimer();
}
const WX_COLOR = { haru: '#9cc995', enten: '#f39467', jinari: '#dcae5c', shuso: '#e9e6dd', tsuyu: '#93b4e6', nagi: '#a8c6c1', ennichi: '#f1b45d', mangetsu: '#f4e6b6', arashi: '#bcc7d3' };
function weatherShort(w) {
  return { random: '味方にも当たる', power: (w.bonus > 0 ? 'ダメージ＋' : 'ダメージ−') + Math.abs(w.bonus || 0), onecard: '守り1枚まで', nospell: '術が使えない', fair: '半額・棚5枚', moon: '術の霊力−' + (w.cut || 1), storm: '札＋1枚', calm: '変化なし' }[w.kind] || '変化なし';
}
function renderOpp(G, me, view) {
  const others = G.players.filter(p => !me || p.pid !== me.pid);
  const box = $('gOpp');
  const n = Math.max(1, others.length);
  const wide = window.matchMedia('(min-aspect-ratio: 5/4)').matches;
  const big = wide && window.innerHeight >= 700;
  const minw = wide ? (big ? 132 : 112) : 104;
  const width = box.clientWidth || 360;
  let cols = Math.max(1, Math.min(n, Math.floor((width + 6) / (minw + 6))));
  /* 人数が多いときは、席を小さくして段の数を減らす（まん中の場所を広く取る） */
  if (!big && Math.ceil(n / cols) > 1) {
    const tc = Math.max(1, Math.min(n, Math.floor((width + 6) / (76 + 6))));
    if (Math.ceil(n / tc) < Math.ceil(n / cols)) cols = tc;
  }
  const rows = Math.ceil(n / cols); cols = Math.ceil(n / rows);
  box.style.setProperty('--cols', cols);
  box.classList.toggle('tight', width / cols < 136);
  box.classList.toggle('tiny', width / cols < 100);
  box.classList.toggle('roomy', width / cols >= 236);
  const C = view === 'card' ? selCard(me) : null;
  const valid = new Set(view === 'dead' && ui.ghost === 'hex' && me && !hexUsed(G, me) ? hexTargets(G, me).map(p => p.pid) : targetPids(G, me, C));
  /* 属性のある攻めをえらんでいるときは、相手ごとの相性を席に出す */
  const affs = {};
  if (C && me && aimOf(C) !== 'help') others.forEach(p => { if (p.alive && (aimOf(C) === 'harm' || !sameTeam(p, me))) { const f = affFor(G, C, p); if (f != null) affs[p.pid] = f; } });
  setHTML(box, others.map(p => seatHTML(G, p, valid, affs[p.pid])).join(''));
}
/* 体力に上限はない。バーは「はじめの体力」を目安にして、超えた分は金色で見せる */
const hpLow = p => p.hp <= Math.ceil((p.hp0 || 35) * 0.3);
/* 起きたことを見せている途中は、そこまでの体力を出す */
const shownHp = p => (HV.batch && HV.hp[p.pid] != null ? HV.hp[p.pid] : p.hp);
function hpNum(p) {
  const hp = shownHp(p), q = { hp, hp0: p.hp0 };
  const over = hp > (p.hp0 || 35);
  return '<span class="hpn hpnum' + (hpLow(q) ? ' lo' : over ? ' over' : '') + '"><small>体</small>' + hp + '</span>';
}
function hpBar(p) {
  const hp = shownHp(p), base = p.hp0 || 35;
  const v = Math.max(0, Math.min(1, hp / base));
  const ov = hp > base ? Math.min(1, (hp - base) / base) : 0;
  return '<span class="hbar' + (hpLow({ hp, hp0: p.hp0 }) ? ' lo' : '') + '"><i style="--v:' + v.toFixed(3) + '"></i>' + (ov ? '<b style="--v:' + ov.toFixed(3) + '"></b>' : '') + '</span>';
}
function stHTML(p) {
  const out = [];
  if (p.st.curse > 0) out.push('<span class="st st-curse" title="呪い あと' + p.st.curse + '回">呪' + p.st.curse + '</span>');
  if (p.st.seal > 0) out.push('<span class="st st-seal" title="封印 あと' + p.st.seal + '回">封' + p.st.seal + '</span>');
  if (p.st.mist > 0) out.push('<span class="st st-mist" title="霧隠れ">霧</span>');
  if (p.st.kiai > 0) out.push('<span class="st st-kiai" title="次の攻撃＋5">気</span>');
  if (p.st.boost > 0) out.push('<span class="st st-kiai" title="次の攻撃＋' + p.st.boost + '">力' + p.st.boost + '</span>');
  if (p.st.shell > 0) out.push('<span class="st st-shell" title="次に受けるダメージ−' + p.st.shell + '">甲' + p.st.shell + '</span>');
  return out.length ? '<span class="sts">' + out.join('') + '</span>' : '';
}
const AFF_BADGE = { 1: ['up', '◎1.2倍'], '-1': ['down', '×半分'], immune: ['down', '効かない'] };
function seatHTML(G, p, valid, aff) {
  const cls = ['seat'];
  let flag = '';
  if (G.cur === p.pid && G.phase === 'act') { cls.push('turn'); flag = '<span class="flag">手番</span>'; }
  if (G.phase === 'defend' && G.pend && G.pend.targets.includes(p.pid) && !G.pend.resp[p.pid]) flag = '<span class="flag def">守り中</span>';
  if (G.phase === 'usurp' && G.pend && G.pend.targets[0] === p.pid) flag = '<span class="flag def">品定め中</span>';
  if (!p.alive) cls.push('dead');
  if (HV.batch && pres.zeroAt && pres.zeroAt[p.pid] && p.alive) cls.push('dying');
  if (valid.has(p.pid)) cls.push(ui.target === p.pid || (ui.ghost === 'hex' && ui.hexTo === p.pid) ? 'picked' : 'can');
  if (ui.look && ui.look.k === 'seat' && ui.look.pid === p.pid) cls.push('picked');
  const ab = aff != null && AFF_BADGE[aff] ? AFF_BADGE[aff] : null;
  if (ab) cls.push('aff-' + ab[0]);
  const g = guardOf(p);
  return '<button class="' + cls.join(' ') + '" type="button" data-pid="' + p.pid + '" aria-label="' + esc(p.name) + '　体力' + p.hp + '　霊力' + p.mp + '　小判' + p.gold + '両　' + g.elem + 'の式神（弱点は' + weakVs(g.elem) + '）' + (ab ? '　' + ab[1] : '') + '">' + flag +
    (ab ? '<span class="affb">' + ab[1] + '</span>' : '') +
    embHTML(p.guardian, 28) +
    '<span class="snm">' + (G.settings.teams ? teamHTML(p.team) : '') + '<b>' + esc(p.name) + '</b>' + (p.cpu && shown && shown.mode !== 'local' ? '<span class="cpu">' + (p.left ? '代打' : 'CPU') + '</span>' : '') + (p.beast ? beastHTML(p.beast, 17) : '') + '</span>' +
    '<span class="srow">' + hpNum(p) + hpBar(p) + stHTML(p) + '</span>' +
    /* 体力の下に 霊力・小判・札 の順で */
    '<span class="sres"><span class="rs rs-mp"><i>霊</i><b>' + p.mp + '</b></span><span class="rs rs-gd"><i>両</i><b>' + p.gold + '</b></span><span class="rs hn"><i>札</i><b>' + (HV.on && HV.seat[p.pid] != null ? HV.seat[p.pid] : handN(p)) + '</b></span></span>' + (p.alive ? weakChip(p) : '') +
    (p.alive ? '' : '<span class="ko">成仏</span>') + '</button>';
}
function renderMe(G, me, view) {
  const el = $('gMe');
  if (!me) { el.hidden = true; return; }
  el.hidden = false;
  const C = view === 'card' ? selCard(me) : null;
  const valid = targetPids(G, me, C);
  el.className = 'me' + (G.cur === me.pid && G.phase === 'act' ? ' turn' : '') + (valid.includes(me.pid) ? ' can' : '');
  el.dataset.pid = me.pid;
  setHTML(el, embHTML(me.guardian, 38) +
    '<span class="mname">' + (G.settings.teams ? teamHTML(me.team) : '') + '<span class="mn">' + esc(me.name) + '</span>' + (me.beast ? beastHTML(me.beast, 18, true) : '') + stHTML(me) + (me.alive ? weakChip(me) : '<span class="st st-cpu">成仏</span>') + '</span>' +
    hpNum(me) +
    '<span class="mres">' + hpBar(me) + '<span>霊力 <b class="mpv">' + me.mp + '</b></span><span>小判 <b class="gdv">' + me.gold + '</b></span><span class="hn">札 <b>' + (HV.on ? me.hand.filter(h => !HV.gone.has(h.u) && !isSpellId(h.c)).length + HV.ins.filter(h => !isSpellId(h.c) && !me.hand.some(x => x.u === h.u)).length : handN(me)) + '</b></span></span>');
}
function renderHand(G, me, view) {
  const box = $('gHand');
  if (!me) { setHTML(box, '<div class="hand-empty">観戦中です</div>'); return; }
  if (!me.hand.length) { setHTML(box, '<div class="hand-empty">' + (me.alive ? '手札がありません。札を使うか、おみくじで運だめし' : '手札はありません') + '</div>'); return; }
  const C = view === 'card' ? selCard(me) : null;
  const defOk = view === 'defend' ? new Set(defOptions(G, me).map(h => h.u)) : null;
  const appraised = G.phase === 'usurp' && G.pend && G.pend.targets[0] === me.pid ? G.pend.u : null;
  /* 新しく来た札は少し光らせる（何を引いたか分かるように） */
  const nowT = Date.now();
  if (!ui.handSeen || ui.handGid !== G.gid) { ui.handSeen = new Set(me.hand.map(h => h.u)); ui.handGid = G.gid; ui.newU = {}; }
  me.hand.forEach(h => { if (!ui.handSeen.has(h.u)) { ui.handSeen.add(h.u); ui.newU[h.u] = nowT; } });
  const one = h => {
    const HC = CARD[h.c];
    const o = { u: h.u, tag: 'button', nw: nowT - (ui.newU[h.u] || 0) < 1300, nwAt: nowT - (ui.newU[h.u] || 0) };
    if (view === 'card' && C && C.type === 'item' && C.eff === 'sell') {
      if (h.u === ui.sel) o.sel = true;
      else if (HC.type === 'spell') o.off = true;
      else if (ui.ware === h.u) { o.add = true; o.badge = '売る ' + priceOf(G, h.c) + '両'; }
      else { o.pick = true; o.price = priceOf(G, h.c) + '両'; }
    } else if (view === 'card') {
      if (h.u === ui.sel) o.sel = true;
      else if (ui.ws.includes(h.u) || ui.adds.includes(h.u)) o.add = true;
      else if (addable(me, C, h)) { o.pick = true; o.badge = '＋足せる'; }
      else if (C && C.type === 'weapon') o.off = true;
    } else if (view === 'mine') {
      o.off = HC.type === 'armor' || HC.type === 'plus' || !canUse(G, me, h);
    } else if (view === 'defend') {
      if (ui.def.includes(h.u)) o.add = true;
      else if (defOk.has(h.u)) { o.pick = true; o.badge = HC.special === 'reflect' ? '返せる' : HC.special === 'deflect' ? '弾ける' : '守れる'; }
      else o.off = true;
    } else if (view === 'shop') {
      if (ui.sell.includes(h.u)) o.add = true;
      o.price = '売 ' + sellPrice(h.c) + '両';
    } else if (view === 'usurp') o.dim = true;
    else if (view === 'swap') { if (HC.type === 'spell') o.off = true; else if (ui.swap.includes(h.u)) { o.add = true; o.badge = '入れかえ'; } else o.pick = ui.swap.length < G.pend.n; }
    else if (appraised === h.u) { o.sel = true; o.badge = '品定め中'; }
    else if (ui.look && ui.look.k === 'card' && ui.look.u === h.u) o.sel = true;
    return fudaHTML(h.c, o);
  };
  /* 起きたことを見せている途中なら、そこまでに消えた札・入った札を反映して描く */
  const list = HV.on ? me.hand.filter(h => !HV.gone.has(h.u)).concat(HV.ins.filter(h => !me.hand.some(x => x.u === h.u))) : me.hand;
  setHTML(box, handZonesHTML(sortHand(list), one));
}
/* 術札は左の「術札ゾーン」にまとめる（使っても残る札） */
function handZonesHTML(list, one) {
  const sp = list.filter(h => isSpellId(h.c)), rest = list.filter(h => !isSpellId(h.c));
  return (sp.length ? '<div class="hz-sp" role="group" aria-label="術札ゾーン（使っても残る）"><span class="hz-l" aria-hidden="true"><i>術</i><i>札</i></span>' + sp.map(one).join('') + '</div>' : '') + rest.map(one).join('');
}

/* ---------- まん中の「場」 ---------- */
function renderCenter(G, me, view) {
  const box = $('gCenter');
  if (pres.board && !ghostBusy()) return;   /* まん中で札を1枚ずつ並べている途中は描きかえない（霊が天の声・呪術をえらんでいるときはそちらを出す） */
  let html = '', key = view;
  if (view === 'card') { html = centerCard(G, me); key += ':' + ui.sel; }
  else if (view === 'defend') { html = centerDefend(G, me); key += ':' + G.seq; }
  else if (view === 'usurp') { html = centerUsurp(G, me); key += ':' + G.seq; }
  else if (view === 'swap') { html = centerSwap(G, me); key += ':' + G.seq; }
  else if (view === 'shop') html = centerShop(G, me);
  else if (view === 'dead' && ui.ghost === 'wx') { html = centerVote(G, me); key += ':wx'; }
  else if (view === 'dead' && ui.ghost === 'hex') { html = centerHex(G, me); key += ':hex'; }
  else if (ui.look) { html = centerLook(G, me); key += ':' + JSON.stringify(ui.look); }
  else { html = centerTable(G, me, view); key += ':' + G.seq; }
  setHTML(box, html);
  if (ui.centerKey !== key) {
    ui.centerKey = key;
    const b = box.firstElementChild, bt = box.querySelector('.bt[data-bt]');
    const same = bt && bt.dataset.bt === ui.lastBt;
    if (bt) ui.lastBt = bt.dataset.bt;
    if (b && !reduceMotion && !same) { b.classList.add('fresh'); }
  }
  /* 背景に天候 */
  const w = WEATHER[G.weather], wrap = $('gCenterBox');
  if (w && wrap.dataset.w !== w.id) {
    wrap.dataset.w = w.id;
    wrap.style.setProperty('--wc', WX_COLOR[w.id] || 'var(--kin)');
    setHTML($('gWx'), '<div class="wx-fx"></div><span class="wx-crest">' + weatherCrest(w) + '</span><span class="wx-name">' + Array.from(w.name).map(c => '<span>' + esc(c) + '</span>').join('') + '</span>');
  }
}
function cardMeta(C, extra) {
  const parts = ['<span>' + TYPE_LABEL[C.type] + '</span>'];
  if (C.elem) parts.push('<span class="elchip el-' + C.elem + '">' + crestSVG(C.elem) + C.elem + '</span>' + (C.type === 'weapon' || C.type === 'spell' ? '<span>' + strongVs(C.elem) + 'の式神に強い　' + weakVs(C.elem) + 'の式神に弱い</span>' : ''));
  else if (C.type === 'weapon' || (C.type === 'armor' && !C.special)) parts.push('<span>属性なし</span>');
  if (extra) parts.push(extra);
  return '<div class="c-meta">' + parts.join('') + '</div>';
}
function inspectHTML(C, now, opts) {
  opts = opts || {};
  return '<div class="c-body">' + fudaHTML(C.id, { mini: false }).replace('class="fuda', 'class="fuda c-big') +
    '<div class="c-text"><h3 class="c-name">' + esc(C.name) + '<small>' + esc(C.yomi || '') + '</small></h3>' + cardMeta(C, opts.meta) +
    '<p class="c-eff">' + esc(cardText(C)) + '</p>' + (now ? '<div class="c-now' + (opts.warn ? ' warn-l' : '') + '">' + now + '</div>' : '') + '</div></div>' +
    (opts.close ? '<button class="c-close" type="button" data-cact="close" aria-label="とじる">×</button>' : '');
}
/* 属性の攻めをえらんだとき：どの相手に効くか（1.2倍・半分・効かない）をまとめて出す */
function affSummary(G, me, C) {
  if (!C || !C.elem) return '';
  const up = [], down = [], imm = [];
  enemiesOf(G, me).forEach(t => { const f = affFor(G, C, t); if (f === 'immune') imm.push(t); else if (f > 0) up.push(t); else if (f < 0) down.push(t); });
  const nm = a => a.map(t => esc(t.name)).join('・');
  const parts = [];
  if (up.length) parts.push('<span class="aff-up">◎1.2倍　' + nm(up) + '</span>');
  if (down.length) parts.push('<span class="aff-down">×半分　' + nm(down) + '</span>');
  if (imm.length) parts.push('<span class="aff-down">効かない　' + nm(imm) + '</span>');
  if (!parts.length) parts.push('<span class="c-hint">いまの相手には、相性で変わる式神がいません</span>');
  return '<br><span class="c-aff">' + parts.join('') + '</span>';
}
function centerCard(G, me) {
  const C = selCard(me);
  if (!C) return '';
  if (C.type === 'item' && C.eff === 'refine') return centerRefine(G, me, C);
  let now = '', warn = false;
  const why = whyNot(G, me, C);
  const rndT = randomTarget(G, C);
  if (C.type === 'weapon') {
    const ws = [ui.sel].concat(ui.ws);
    const base = attackBase(G, me, ws, ui.adds);
    const parts = ws.map(u => CARD[me.hand.find(h => h.u === u).c].atk).concat(ui.adds.map(u => CARD[me.hand.find(h => h.u === u).c].atk));
    const bonus = base - parts.reduce((x, y) => x + y, 0);
    const sum = (parts.length > 1 || bonus ? parts.join('＋') + (bonus ? (bonus > 0 ? '＋' : '−') + Math.abs(bonus) + '（式神・天候・気合）' : '') + '＝' : '') + '<b>' + base + '</b>';
    if (C.all) now = '相手全員に 攻撃 ' + sum + '　相手の式神によって相性で変わります';
    else if (rndT) now = '攻撃 ' + sum + '<br>' + (C.fx === 'rand' ? '暴れ独楽：自分以外のだれかに当たります（味方のことも！）' : '春一番：攻める相手はランダムで決まります（味方に当たることも！）');
    else if (ui.target == null) now = '攻撃 ' + sum + '<br>攻める相手をタップしてください';
    else {
      const t = G.players[ui.target], f = affinity(C.elem, guardOf(t).elem);
      now = esc(t.name) + 'に 攻撃 ' + sum + (f ? '　→　' + affTxt(f) + ' <b>' + applyAff(base, f) + '</b>' : '');
      if (sameTeam(t, me)) now += '<br><span class="bad">' + esc(t.name) + 'は味方です！それでも攻めますか？</span>';
      if (fireImmune(t, C.elem)) now += '<br><span class="bad">九尾の狐は火の攻撃ではダメージを受けません</span>';
    }
    now += affSummary(G, me, C);
    const more = me.hand.filter(h => addable(me, C, h) && !ui.ws.includes(h.u) && !ui.adds.includes(h.u)).length;
    if (more) now += '<br><span class="c-hint">「＋足せる」の札をタップすると重ねて強くできます' + (C.elem ? '' : '（属性のない武器に足せるのは追撃札だけ）') + '</span>';
    now += '<br><span class="c-hint">' + (C.elem ? '相手は' + C.elem + 'の守札か' + strongerOf(C.elem) + 'の守札（' + C.elem + 'に強い）でしか守れません' : '属性がないので、相手はどの守札でも守れます') + '</span>';
  } else if (C.type === 'spell') {
    const cost = spellCost(G, me, C);
    if (why === 'rain' || why === 'sealed') { now = WHY[why]; warn = true; }
    else if (me.mp < cost) { now = '霊力が足りません（必要 ' + cost + '・いま ' + me.mp + '）'; warn = true; }
    else {
      now = '霊力 <b>' + cost + '</b> を使います' + (cost !== C.mp ? '（もとは' + C.mp + '）' : '');
      if (C.eff === 'dmg' || C.eff === 'drain') {
        const base = Math.max(0, C.val + atkBonus(G, me, C.elem, false));
        if (rndT) now += '<br>ダメージ ' + base + '　春一番：相手はランダムで決まります（味方に当たることも！）';
        else if (ui.target != null) { const f = affinity(C.elem, guardOf(G.players[ui.target]).elem); now += '<br>' + esc(pname(G, ui.target)) + 'に <b>' + applyAff(base, f) + '</b> ダメージ' + (f ? '　' + affTxt(f) : '') + (sameTeam(G.players[ui.target], me) ? '　<span class="bad">（味方です！）</span>' : ''); }
        else now += '<br>ダメージ ' + base + (C.tgt === 'all' ? '（相手全員）' : '　相手をタップしてください');
        now += affSummary(G, me, C);
      } else if (helpCard(C)) now += '<br>' + (ui.target != null && ui.target !== me.pid ? esc(pname(G, ui.target)) + 'に使います' + (sameTeam(G.players[ui.target], me) ? '（味方）' : '（相手）') : '自分に使います') + '<br><span class="c-hint">ほかの人をタップすると、その人に使えます（味方にも相手にも）</span>';
      else if (C.tgt !== 'all') now += rndT ? '<br>春一番：かける相手はランダムで決まります（味方に当たることも！）' : ui.target != null ? '<br>' + esc(pname(G, ui.target)) + 'にかけます' + (sameTeam(G.players[ui.target], me) ? '　<span class="bad">（味方です！）</span>' : '') : '<br>かける相手をタップしてください';
    }
    now += '<br><span class="c-hint">術札は使っても手札に残ります。霊力があれば次の番もまた使えます</span>';
  } else if (C.type === 'item' && C.eff === 'jobutsu') {
    const ts = targetsFor(G, me, C);
    if (!ts.length) { now = '霊獣を連れた相手がいないので、いまは使えません'; warn = true; }
    else if (ui.target == null) now = '霊獣を連れた相手をタップしてください（' + ts.map(t => esc(t.name) + '：' + esc(bname(t.beast))).join('、') + '）';
    else { const t = G.players[ui.target]; now = esc(t.name) + 'の霊獣「' + esc(bname(t.beast)) + '」を、<b>半分</b>の確率で成仏させます'; }
  } else if (C.type === 'item' && C.eff === 'usurp') {
    if (ui.target == null) now = '札を見る相手をタップしてください';
    else { const t = G.players[ui.target]; now = esc(t.name) + 'の手札（' + t.hand.length + '枚）からランダムに1枚を見ます。<br>買うかどうかは、札を見てから決められます（いまの小判 <b>' + me.gold + '</b>両）'; }
  } else if (C.type === 'item' && C.eff === 'sell') {
    const ware = ui.ware != null ? me.hand.find(h => h.u === ui.ware) : null;
    if (why) { now = WHY[why] || 'いまは使えません'; warn = true; }
    else if (!ware) now = '① 売りつける札を、手札からタップしてください（値段が高い札ほど相手は苦しい）';
    else {
      const pr = priceOf(G, ware.c);
      now = '「' + esc(CARD[ware.c].name) + '」を <b>' + pr + '</b>両で売りつけます';
      if (ui.target == null) now += '<br>② 売りつける相手をタップしてください';
      else {
        const t = G.players[ui.target];
        const g = Math.min(t.gold, pr), m = Math.min(t.mp, pr - g), h = pr - g - m;
        now += '<br>' + esc(t.name) + 'は 小判' + g + (m ? '・霊力' + m : '') + (h ? '・体力' + Math.min(h, t.hp) : '') + 'で払います' + (h >= t.hp ? '　<span class="bad">払いきれずに成仏！</span>' : '');
      }
    }
  } else if (C.type === 'item' && C.eff === 'hpswap') {
    if (!targetsFor(G, me, C).length) { now = 'いまえらべる人がいません'; warn = true; }
    else if (ui.target == null) now = '体力を入れかえる人をタップしてください（いまのあなたの体力 <b>' + me.hp + '</b>）';
    else { const t = G.players[ui.target]; now = esc(t.name) + 'と体力を入れかえます<br>あなた ' + me.hp + ' → <b>' + t.hp + '</b>　／　' + esc(t.name) + ' ' + t.hp + ' → <b>' + me.hp + '</b>' + (sameTeam(t, me) ? '<br><span class="bad">（味方です！）</span>' : ''); }
  } else if (C.type === 'item' && C.eff === 'shuffle') now = '全員の手札（術札はのぞく）を集めてまぜ、もとの枚数ずつ配り直します。<br>あなたの手札も、だれかの札と入れかわります';
  else if (C.type === 'item') {
    const t = ui.target != null ? G.players[ui.target] : me;
    now = (t === me ? '自分に使います' : esc(t.name) + 'に使います' + (sameTeam(t, me) ? '（味方）' : '（相手）')) + '<br><span class="c-hint">ほかの人をタップすると、その人に使えます（味方にも相手にも）</span>';
  } else if (C.type === 'summon') {
    const cost = summonCost(me, C);
    const t = ui.target != null ? G.players[ui.target] : me;
    if (why === 'target') { now = 'いま霊獣をつけられる人がいません'; warn = true; }
    else if (me.mp < cost) { now = '霊力が足りません（必要 ' + cost + '・いま ' + me.mp + '）'; warn = true; }
    else if (t === me && guardOf(me).noSummon) now = '霊力 <b>' + cost + '</b> を使って呼びます。<br>龍神は霊獣を連れられないので、霊獣をつける人をタップしてください（味方にも相手にも）';
    else now = '霊力 <b>' + cost + '</b> を使って呼び、' + (t === me ? '自分' : esc(t.name)) + 'につけます。どの霊獣が出るかはお楽しみ' + (t.beast ? '<br>いまの霊獣「' + esc(bname(t.beast)) + '」と入れかわります' : '') + '<br><span class="c-hint">ほかの人をタップすると、その人につけられます（味方にも相手にも）</span>';
  }
  else if (C.type === 'plus') { now = '武器といっしょに出す札です。先に武器の札をタップしてください'; warn = true; }
  else if (C.type === 'armor') { now = '守りの札です。攻められたときに使います'; warn = true; }
  return inspectHTML(C, now, { warn });
}
/* 精錬：体力・霊力・小判を5ずつ入れかえる */
const REF_ROWS = [['hp', '体力', HP_CAP], ['mp', '霊力', MP_MAX], ['gold', '小判', GOLD_MAX]];
function refPool() { return -(ui.ref.hp + ui.ref.mp + ui.ref.gold); }
function refCan(me, k, dir) {
  const cur = me[k] + ui.ref[k], lim = REF_ROWS.find(r => r[0] === k)[2];
  if (dir < 0) return cur - 5 >= (k === 'hp' ? 1 : 0);
  if (k === 'mp' && guardOf(me).noMpGain && ui.ref.mp >= 0) return false;
  return refPool() >= 5 && cur + 5 <= lim;
}
function centerRefine(G, me, C) {
  const pool = refPool();
  const rows = REF_ROWS.map(([k, label]) => {
    const d = ui.ref[k], v = me[k] + d;
    return '<div class="rf-row"><span class="rf-l">' + label + '</span>' +
      '<button type="button" class="rf-b" data-ref="' + k + '" data-dir="-1"' + (refCan(me, k, -1) ? '' : ' disabled') + ' aria-label="' + label + 'を5へらす">−5</button>' +
      '<span class="rf-v"><b>' + v + '</b>' + (d ? '<small class="' + (d > 0 ? 'good' : 'bad') + '">' + (d > 0 ? '＋' : '−') + Math.abs(d) + '</small>' : '<small>&nbsp;</small>') + '</span>' +
      '<button type="button" class="rf-b" data-ref="' + k + '" data-dir="1"' + (refCan(me, k, 1) ? '' : ' disabled') + ' aria-label="' + label + 'を5ふやす">＋5</button></div>';
  }).join('');
  return '<div class="c-body"><div class="c-stack"><p class="c-title">精錬　自分の力を入れかえる</p>' +
    '<div class="rf">' + rows + '<div class="rf-pool">分けられる分 <b>' + pool + '</b></div></div>' +
    '<div class="c-now" style="width:100%;max-width:520px">「−5」で減らした分を「＋5」で別のところに分けます。分け終わったら「精錬」' +
    (guardOf(me).noMpGain ? '<br><span class="c-hint">龍神は霊力をふやせません</span>' : '') + '</div></div></div>';
}
/* いまの攻めを、どの札で守れるか（ひとことで） */
function defRule(P) {
  if (P.chain) return 'はね返ってきた攻めは、照魔の鏡でしか返せません（ほかの札では守れません）';
  if (P.kind === 'spell' && !(P.eff === 'dmg' || P.eff === 'drain')) return '守札を1枚出せば防げます（羽団扇・身代わり人形・照魔の鏡も使えます）';
  if (P.elem) return '<b class="elw el-' + P.elem + '">' + P.elem + 'の攻め</b>は、' + P.elem + 'の守札・<b class="elw el-' + strongerOf(P.elem) + '">' + strongerOf(P.elem) + 'の守札</b>（' + P.elem + 'に強い）' + (P.kind === 'spell' ? '・結界札' : '') + 'で守れます。鏡・羽団扇・身代わり' + (P.kind === 'attack' ? '・隠れ蓑' : '') + 'も使えます';
  return '属性のない攻めなので、どの守札でも守れます';
}
/* 守れない札をタップしたときの理由 */
function defWhy(P, HC) {
  if (HC.type !== 'armor') return 'この札は守りには使えません';
  if (P.chain) return 'はね返ってきた攻めは、照魔の鏡でしか返せません';
  if (HC.special === 'dodge') return '隠れ蓑でかわせるのは武器の攻撃だけです';
  if (P.elem && HC.elem) return P.elem + 'の攻めは、' + P.elem + 'か' + strongerOf(P.elem) + 'の守札でしか守れません（これは' + HC.elem + 'の守札）';
  if (P.elem) return P.elem + 'の攻めは、' + P.elem + 'か' + strongerOf(P.elem) + 'の守札' + (P.kind === 'spell' ? '・結界札' : '') + 'でしか守れません（属性のない守札は使えません）';
  return 'この札では守れません';
}
function centerDefend(G, me) {
  const P = G.pend, A = G.players[P.by];
  const atk = P.atk[me.pid] || 0, f = P.aff[me.pid] || 0;
  const dmgType = P.kind === 'attack' || P.eff === 'dmg' || P.eff === 'drain';
  const chosen = ui.def.map(u => CARD[me.hand.find(h => h.u === u).c]);
  const sp = chosen.find(x => x.special);
  const def = defenseValue(G, me, ui.def);
  const opts = defOptions(G, me);
  let res;
  if (sp && sp.special === 'reflect') res = '照魔の鏡で <b>はね返す</b>。あなたは無傷' + (P.chain ? '' : '。相手も鏡を持っていれば、またはね返ってきます');
  else if (sp && sp.special === 'null') res = '身代わり人形で <b>なかったことに</b>。あなたは無傷';
  else if (sp && sp.special === 'deflect') res = '羽団扇で <b>弾く</b>。流れ弾が、全員の中からランダムに選ばれた1人に飛びます（あなたに戻ることも）。飛んだ先の人は守札で守れます';
  else if (dmgType) {
    const raw = Math.max(0, atk - def);
    const shell = Math.min(me.st.shell || 0, raw);
    const dmg = raw - shell;
    res = (sp && sp.special === 'dodge' ? '半分の確率でかわします。かわせなければ' : '') + (def ? '守り ' + def + ' → ' : '') + (shell ? '甲羅で−' + shell + ' → ' : '') + '受けるダメージ <b class="' + (dmg ? 'bad' : 'good') + '">' + dmg + '</b>' +
      (dmg ? '　体力 ' + me.hp + ' → ' + Math.max(0, me.hp - dmg) + (me.hp - dmg <= 0 ? '（成仏）' : '') : '');
  } else res = chosen.length ? '守札で <b class="good">防ぎます</b>' : 'このままだと <b class="bad">' + ({ curse: '呪われます', seal: '封印されます', steal: '手札を1枚うばわれます' }[P.eff] || '術がかかります') + '</b>' +
    ({ curse: '（番のはじめに体力−3を3回）', seal: '（2回の番のあいだ術が使えない）', steal: '' }[P.eff] || '');
  if (dmgType && fireImmune(me, P.elem)) res = '九尾の狐は火の攻撃では <b class="good">ダメージを受けません</b>';
  if (!opts.length) res += '<br><span class="bad">守れる札がありません。「受ける」を押してください</span>';
  if (wKind(G, 'onecard') && !P.chain) res += '<br><span class="c-hint">秋霜：守りに出せる札は1枚だけ</span>';
  if (guardOf(me).armorHalf && def) res += '<br><span class="c-hint">龍神は守札の守りが半分になります</span>';
  const names = (P.cards || [P.card]).concat(P.adds || []).map(id => CARD[id].name).join('＋');
  const head = P.chain ? 'はね返ってきた！' : P.stray ? '流れ弾が飛んできた！' : esc(A.name) + 'の' + esc(names);
  const sub = P.chain ? esc(A.name) + 'が照魔の鏡で' + esc(names) + 'をはね返しました' : P.stray ? esc(pname(G, P.from)) + 'が' + esc(A.name) + 'の' + esc(names) + 'を弾きました。守札で守れます' : (P.targets.length > 1 ? '相手全員への攻め' : 'あなたへの攻め');
  return '<div class="c-body"><div class="c-stack">' +
    '<div class="c-incoming">' + embHTML(A.guardian, 46) + '<div><p class="c-title" style="text-align:left">' + head + '</p>' +
    '<p class="c-sub" style="text-align:left">' + sub + (P.elem ? '　<span class="elchip el-' + P.elem + '">' + crestSVG(P.elem) + P.elem + 'の属性</span>' : '　属性なし') + '</p></div>' +
    (dmgType ? '<div class="num"><small>' + (P.kind === 'spell' ? '術' : '攻撃') + '</small>' + atk + '</div>' : '') + '</div>' +
    (f ? '<p class="c-sub">' + affTxt(f) + '：' + P.elem + 'の攻撃 × あなたの式神（' + guardOf(me).elem + '）</p>' : '') +
    '<div class="c-now" style="width:100%;max-width:540px">' + res + '<br><span class="c-hint">' + defRule(P) + '</span>' +
    (guardOf(me).dodge && P.kind === 'attack' && !P.chain ? '<br><span class="c-hint">天狗の力で、10回に1回くらいは自然にかわせます</span>' : '') +
    (guardOf(me).deflectRate && P.kind === 'attack' && !P.chain ? '<br><span class="c-hint">天邪鬼の幻惑で、' + Math.round(guardOf(me).deflectRate * 100) + '%の確率で自然に弾きます</span>' : '') + '</div>' +
    '</div></div>';
}
/* おみくじの入れかえ */
function centerSwap(G, me) {
  const P = G.pend;
  const ev = G.log.slice().reverse().find(e => e.k === 'omikuji' && e.p === me.pid);
  const O = OMIKUJI.find(o => o.id === (ev && ev.r)) || OMIKUJI[1];
  const picked = ui.swap.map(u => me.hand.find(h => h.u === u)).filter(Boolean);
  return '<div class="c-body">' + kujiHTML(O.id, 'kuji-c') + '<div class="c-text">' +
    '<h3 class="c-name">' + O.name + '<small>おみくじ</small></h3>' + (ev ? '<p class="c-eff c-eff-s">' + esc(omikujiWord(ev)) + '</p>' : '') +
    '<div class="c-now">手札から、入れかえる札を <b>' + P.n + '</b>枚までタップしてください。えらんだ札を捨てて、同じ枚数を山札から引きます' +
    (picked.length ? '<br>えらんだ札：' + picked.map(h => esc(CARD[h.c].name)).join('、') : '') + '</div></div></div>';
}
/* 簒奪：見つけた札を買うかどうか */
function centerUsurp(G, me) {
  const P = G.pend, t = G.players[P.targets[0]], C = CARD[P.c];
  const full = handN(me) >= HAND_MAX, poor = me.gold < P.price;
  let now = '値段 <b>' + P.price + '</b>両　<span class="c-hint">いまの小判 ' + me.gold + '両</span>' +
    '<br><span class="c-hint">買うと払った小判は' + esc(t.name) + 'へ。買わなければ札は' + esc(t.name) + 'に戻ります</span>';
  if (poor) now += '<br><span class="bad">小判が足りないので買えません</span>';
  if (full) now += '<br><span class="bad">手札がいっぱいなので買えません（12枚まで）</span>';
  return '<div class="c-body">' + fudaHTML(C.id).replace('class="fuda', 'class="fuda c-big') +
    '<div class="c-text"><p class="c-sub" style="text-align:left">' + esc(t.name) + 'の手札から見つけた札</p><h3 class="c-name">' + esc(C.name) + '<small>' + esc(C.yomi || '') + '</small></h3>' +
    '<div class="c-now' + (poor || full ? ' warn-l' : '') + '">' + now + '</div>' + cardMeta(C) + '<p class="c-eff c-eff-s">' + esc(cardText(C)) + '</p></div></div>';
}
/* よろず屋で買えない理由（手札がいっぱい／同じ術をもう持っている） */
function shopBlock(G, me, item) {
  if (!item) return null;
  const sold = ui.sell.map(u => me.hand.find(x => x.u === u)).filter(Boolean);
  if (isSpellId(item.c)) return hasSpell(me, item.c) && !sold.some(h => h.c === item.c) ? 'have' : null;
  return handN(me) - sold.filter(h => !isSpellId(h.c)).length >= HAND_MAX ? 'full' : null;
}
function centerShop(G, me) {
  const gain = ui.sell.reduce((s, u) => { const h = me.hand.find(x => x.u === u); return s + (h ? sellPrice(h.c) : 0); }, 0);
  const item = ui.buy >= 0 ? G.shop[ui.buy] : null;
  const price = item ? priceOf(G, item.c) : 0;
  const left = me.gold + gain - price;
  const block = shopBlock(G, me, item), full = block === 'full';
  let sum = '小判 <b>' + me.gold + '</b>両' + (gain ? '　売って <b class="good">＋' + gain + '</b>' : '') + (item ? '　買って <b class="bad">−' + price + '</b>' : '') + ((gain || item) ? '　残り <b>' + left + '</b>両' : '');
  if (item) sum += '<br>' + esc(CARD[item.c].name) + '：' + esc(cardText(CARD[item.c]));
  if (left < 0) sum += '<br><span class="bad">小判が足りません</span>';
  if (full) sum += '<br><span class="bad">手札がいっぱいです（12枚まで）</span>';
  if (block === 'have') sum += '<br><span class="bad">同じ術札をもう持っています（術札は1種類1枚まで）</span>';
  const w = WEATHER[G.weather];
  return '<div class="c-body"><div class="c-stack"><p class="c-title">よろず屋</p>' +
    '<div class="c-shelf" id="cShelf">' + G.shop.map((h, i) => { const have = isSpellId(h.c) && hasSpell(me, h.c); return fudaHTML(h.c, { i, tag: 'button', sel: ui.buy === i, price: have ? '持っている' : priceOf(G, h.c) + '両', off: (have || priceOf(G, h.c) > me.gold + gain) && ui.buy !== i }); }).join('') + '</div>' +
    '<div class="c-now" style="width:100%;max-width:520px">' + sum + (w && w.kind === 'fair' ? '<br><span style="font-size:12.5px;color:var(--text-2)">縁日なので値段が半分です</span>' : '') + '</div></div></div>';
}
/* 成仏した人は「神の目」で、相手の手札が見える（手札をいちばん上に大きく） */
function godLook(G, me, p, sts) {
  const g = guardOf(p), B = p.beast ? BEAST[p.beast] : null;
  const one = h => '<span class="gh-c">' + fudaHTML(h.c) + '</span>';
  return '<div class="c-body"><div class="c-stack god-v">' +
    '<div class="god-top">' + embHTML(p.guardian, 40) + '<div class="god-n"><b>' + esc(p.name) + '</b><small>' + esc(g.name) + '・体力' + p.hp + '・霊力' + p.mp + '・小判' + p.gold + '両' + (B ? '・霊獣 ' + esc(B.name) : '') + '</small></div></div>' +
    '<p class="god-h">神の目　手札（札' + handN(p) + (p.hand.length > handN(p) ? '・術札' + (p.hand.length - handN(p)) : '') + '）</p>' +
    '<div class="god-hand">' + (p.hand.length ? handZonesHTML(sortHand(p.hand), one) : '<span class="c-hint">手札はありません</span>') + '</div>' +
    (sts.length ? '<div class="c-now">' + sts.map(esc).join('<br>') + '</div>' : '') +
    '</div></div><button class="c-close" type="button" data-cact="close" aria-label="とじる">×</button>';
}
function centerLook(G, me) {
  const L = ui.look;
  if (L.k === 'card') {
    const C = CARD[L.id]; if (!C) return '';
    let now = '';
    if (L.shelf != null) now = 'よろず屋の棚の札。' + (me && isMyAct(G, me) ? '「よろず屋」から買えます' : '自分の番に「よろず屋」から買えます') + '（' + priceOf(G, L.id) + '両）';
    else if (me && me.alive && !isMyAct(G, me)) now = C.type === 'armor' ? '攻められたときに使えます' : '自分の番になったら使えます';
    return inspectHTML(C, now, { close: true, meta: L.shelf != null ? '<span>値段 ' + priceOf(G, L.id) + '両</span>' : '' });
  }
  if (L.k === 'seat') {
    const p = G.players[L.pid], g = guardOf(p);
    const sts = [];
    if (p.st.curse > 0) sts.push('呪い：番のはじめに体力−3（あと' + p.st.curse + '回）');
    if (p.st.seal > 0) sts.push('封印：術が使えない（あと' + p.st.seal + '回の番）');
    if (p.st.mist > 0) sts.push('霧隠れ：次の自分の番まで狙えない');
    if (p.st.kiai > 0) sts.push('気合：次の攻撃＋5');
    if (p.st.boost > 0) sts.push('白虎の力：次の攻撃＋' + p.st.boost);
    if (p.st.shell > 0) sts.push('甲羅：次に受けるダメージ−' + p.st.shell);
    const mine = me && p.pid === me.pid;
    const B = p.beast ? BEAST[p.beast] : null;
    if (me && !me.alive && p.alive && p.pid !== me.pid) return godLook(G, me, p, sts);
    const hint = '<span class="elchip el-' + weakVs(g.elem) + '">' + crestSVG(weakVs(g.elem)) + weakVs(g.elem) + '</span>の攻めが <b>1.2倍</b>（弱点）、<span class="elchip el-' + strongVs(g.elem) + '">' + crestSVG(strongVs(g.elem)) + strongVs(g.elem) + '</span>の攻めは <b>半分</b>' +
      (g.fireImmune ? '<br>九尾の狐なので、火の攻めではダメージを受けません' : '') + (mine ? '<br><span class="c-hint">あなたの式神の相性です</span>' : '');
    return '<div class="c-body">' + embHTML(p.guardian, 76) + '<div class="c-text"><h3 class="c-name">' + esc(p.name) + (mine ? '<small>あなた</small>' : '') + '</h3>' +
      '<div class="c-meta"><span>' + esc(g.name) + '</span><span class="elchip el-' + g.elem + '">' + crestSVG(g.elem) + g.elem + 'の属性</span>' + (p.cpu ? '<span>CPU</span>' : '') + (G.settings.teams ? '<span>' + TEAM_NAMES[p.team] + '組</span>' : '') + '</div>' +
      '<p class="c-eff">' + esc(g.skill) + '：' + esc(g.text) + '</p>' +
      '<div class="c-meta"><span>体力 ' + p.hp + '（はじめ ' + p.hp0 + '）</span><span>霊力 ' + p.mp + '</span><span>小判 ' + p.gold + '両</span><span>手札 ' + handN(p) + '枚</span>' + (p.hand.length > handN(p) ? '<span>術札 ' + (p.hand.length - handN(p)) + '枚</span>' : '') + '</div>' +
      (B ? '<div class="c-now c-beast">' + beastCardHTML(B.id) + '<span>霊獣 <b>' + esc(B.name) + '</b>' + (B.elem ? '（' + B.elem + '）' : '') + '<br><span class="c-hint">アシスト（' + ASSIST_NOTE + '）：' + esc(B.text) + '</span></span></div>' : '') +
      (sts.length ? '<div class="c-now">' + sts.map(esc).join('<br>') + '</div>' : '') + (hint ? '<div class="c-now">' + hint + '</div>' : '') +
      '</div></div><button class="c-close" type="button" data-cact="close" aria-label="とじる">×</button>';
  }
  if (L.k === 'weather') {
    const w = WEATHER[G.weather]; if (!w) return '';
    return '<div class="c-body"><span style="font-size:74px;color:var(--wc, var(--kin-hi));flex:none">' + weatherCrest(w) + '</span><div class="c-text"><h3 class="c-name">天候　' + esc(w.name) + '<small>' + esc(w.yomi) + '</small></h3>' +
      '<p class="c-eff">' + esc(w.text) + '</p><div class="c-now">天候は1巡ごとに変わります。次は第' + kanjiNum(G.round + 1) + '巡から</div></div></div>' +
      '<button class="c-close" type="button" data-cact="close" aria-label="とじる">×</button>';
  }
  return '';
}
function centerTable(G, me, view) {
  const cur = G.players[G.cur];
  /* 守りを待っているあいだは、出された札と合計をそのまま見せておく */
  if (G.phase === 'defend' && G.pend && CARD[G.pend.card]) {
    const P = G.pend, tn = P.targets.length > 1 ? '相手全員' : me && P.targets[0] === me.pid ? 'あなた' : esc(pname(G, P.targets[0]));
    return '<div class="c-body">' + boardHTML(G, P, me, { foot: P.chain ? tn + 'が受けるかどうか考えています' : tn + 'が守りを考えています' }) + '</div>';
  }
  let who;
  if (view === 'over') who = '勝負がつきました';
  else if (view === 'mine') who = 'あなたの番です';
  else if (G.phase === 'defend' && G.pend && G.pend.chain) who = '照魔の鏡ではね返った攻め。' + esc(pname(G, G.pend.targets[0])) + 'が受けるかどうか考えています';
  else if (G.phase === 'defend' && G.pend && G.pend.stray) who = '弾かれた流れ弾。' + esc(pname(G, G.pend.targets[0])) + 'が守りを考えています';
  else if (G.phase === 'defend' && G.pend) who = esc(pname(G, G.pend.by)) + 'の攻め。' + (G.pend.targets.length > 1 ? '相手全員' : esc(pname(G, G.pend.targets[0]))) + 'が守りを考えています';
  else if (G.phase === 'swap' && G.pend) who = esc(pname(G, G.pend.by)) + 'がおみくじで札を入れかえています';
  else if (G.phase === 'usurp' && G.pend) {
    const vic = G.pend.targets[0];
    who = me && vic === me.pid ? esc(pname(G, G.pend.by)) + 'が、あなたの「' + esc(CARD[G.pend.c].name) + '」を品定めしています' : esc(pname(G, G.pend.by)) + 'が' + esc(pname(G, vic)) + 'の札を品定めしています';
  }
  else who = esc(cur.name) + 'の番です';
  /* いちばん最近の「出来事」 */
  const ev = G.log.slice().reverse().find(e => ['resolve', 'item', 'spell', 'shop', 'omikuji', 'declare', 'curse', 'ko', 'summon', 'assist', 'usurp', 'usurped', 'bounce', 'stray', 'sold', 'refine'].includes(e.k));
  let cards = [];
  if (ev && (ev.k === 'resolve' || ev.k === 'declare')) {
    const d = ev.k === 'declare' ? ev : G.log.slice().reverse().find(x => x.k === 'declare' && x.s < ev.s);
    if (d) cards = (d.cards || [d.card]).concat(d.adds || []);
  } else if (ev && (ev.k === 'item' || ev.k === 'spell' || ev.k === 'summon' || ev.k === 'bounce' || ev.k === 'stray')) cards = [ev.card];
  else if (ev && ev.k === 'usurped' && ev.buy) cards = [ev.card];
  else if (ev && ev.k === 'sold') cards = ['oshiuri', ev.card];
  else if (ev && ev.k === 'shop' && ev.bought) cards = [ev.bought];
  const res = ev ? logText(G, ev, me) : '合戦のはじまり';
  const shelf = '<div class="mini-shelf"><span class="lab">よろず屋の棚</span>' + G.shop.map((h, i) => '<button type="button" data-shelf="' + i + '">' + fudaHTML(h.c, { mini: true }) + '</button>').join('') + '</div>';
  return '<div class="c-body"><div class="c-last">' + (view === 'mine' ? '' : embHTML(cur.guardian, 40)) +
    '<div class="who">' + who + '</div>' +
    (cards.length ? '<div class="c-row">' + cards.slice(0, 4).map(id => '<button type="button" data-lookcard="' + id + '">' + fudaHTML(id) + '</button>').join('') + '</div>' : '') +
    '<div class="res">' + res + '</div>' + shelf + '</div></div>';
}

/* ---------- 成仏したあと：天の声と呪術 ---------- */
function centerVote(G, me) {
  const mine = (G.wxVote || {})[me.pid];
  const others = Object.entries(G.wxVote || {}).filter(([pid]) => Number(pid) !== me.pid);
  const list = WEATHER_LIST.filter(w => w.id !== G.weather).map(w => '<button type="button" class="vt' + (mine === w.id ? ' on' : '') + '" data-vote="' + w.id + '" style="--wc:' + (WX_COLOR[w.id] || 'var(--kin-hi)') + '">' +
    '<span class="vt-c">' + weatherCrest(w) + '</span><b>' + esc(w.name) + '</b><small>' + esc(weatherShort(w)) + '</small></button>').join('');
  return '<div class="c-body"><div class="c-stack"><p class="c-title">天の声　次の巡の天候をえらぶ</p>' +
    '<div class="vt-grid">' + list + '</div>' +
    '<div class="c-now" style="width:100%;max-width:560px">' + (mine ? '次の巡は <b>' + esc(WEATHER[mine].name) + '</b> を推しています（えらび直せます）' : '推したい天候をタップしてください') +
    (others.length ? '<br><span class="c-hint">ほかの霊の声：' + others.map(([pid, w]) => esc(pname(G, Number(pid))) + '→' + esc((WEATHER[w] || {}).name || '')).join('、') + '。分かれたら、その中からランダムで決まります</span>' : '<br><span class="c-hint">ほかの霊とえらんだ天候が分かれたら、その中からランダムで決まります</span>') + '</div></div></div>';
}
function centerHex(G, me) {
  const t = ui.hexTo != null ? G.players[ui.hexTo] : null;
  const row = good => HEXES.filter(x => x.good === good).map(x => '<li><b>' + x.name + '</b>' + esc(x.text) + '</li>').join('');
  const used = hexUsed(G, me), last = G.ghost && G.ghost[me.pid];
  let now;
  if (used) now = '<span class="bad">この巡はもう呪術をかけました。次の巡になったらまたかけられます</span>';
  else if (t && t.alive) now = '<b>' + esc(t.name) + '</b>に呪術をかけます。吉か凶かは半々で、<b>次の番のはじめ</b>に効きます';
  else now = '呪術をかける相手（生きている人）をタップしてください' + (last && G.players[last.to] && G.players[last.to].alive ? '<br><span class="c-hint">前の巡にかけた' + esc(pname(G, last.to)) + 'には、続けてかけられません</span>' : '');
  return '<div class="c-body"><div class="c-stack"><p class="c-title">呪術　吉と凶が半々</p>' +
    '<div class="hx"><ul class="hx-l good"><li class="hx-h">吉</li>' + row(true) + '</ul><ul class="hx-l bad"><li class="hx-h">凶</li>' + row(false) + '</ul></div>' +
    '<div class="c-now" style="width:100%;max-width:560px">' + now + '</div></div></div>';
}
const HEX_OF = id => HEXES.find(x => x.id === id) || HEXES[0];
function hexWord(G, e) {
  const X = HEX_OF(e.fx);
  const parts = [];
  if (e.hp) parts.push('体力' + (e.hp > 0 ? '＋' : '−') + Math.abs(e.hp));
  if (e.mp) parts.push('霊力' + (e.mp > 0 ? '＋' : '−') + Math.abs(e.mp));
  if (e.gold) parts.push('小判' + (e.gold > 0 ? '＋' : '−') + Math.abs(e.gold) + '両');
  if (X.id === 'tenkei') parts.push('札を' + (e.got || 0) + '枚引いた');
  if (X.id === 'kitsuneki') parts.push('手札' + (e.n || 0) + '枚を入れかえた');
  if (X.id === 'reigen' && !e.mp) parts.push('霊力はふえなかった');
  if (X.id === 'daitatari' && !e.hp) parts.push('体力はそのまま');
  return parts.join('、') || X.text;
}

/* ---------- いまやること ---------- */
function renderGuide(G, me, view) {
  let seal = '待', text = '', small = '', cls = '';
  const C = view === 'card' ? selCard(me) : null;
  const cur = G.players[G.cur];
  switch (view) {
    case 'mine': seal = '番'; cls = 'mine'; text = 'あなたの番です'; small = '札をタップ。迷ったら「おみくじ」で運だめし'; break;
    case 'swap': seal = '籤'; cls = 'mine'; text = '入れかえる札を' + G.pend.n + '枚までタップ'; small = 'えらんだら「入れかえる」。そのままでよければ「入れかえない」'; break;
    case 'card': {
      seal = '番'; cls = 'mine';
      if (C.type === 'weapon') {
        const more = me.hand.some(h => addable(me, C, h) && !ui.ws.includes(h.u) && !ui.adds.includes(h.u));
        if (C.all) { text = '相手全員に攻めます'; small = more ? '「＋足せる」札を重ねると強くなる' : '下のボタンで決まり'; }
        else if (randomTarget(G, C)) { text = C.fx === 'rand' ? 'だれに当たるかは運まかせ' : '春一番：相手はランダムで決まります'; small = (more ? '「＋足せる」札を重ねると強くなる。' : '') + '味方に当たることも！'; }
        else if (ui.target == null) { text = '攻める相手をタップ'; small = more ? '「＋足せる」札を重ねると強くなる' : '光っている人をえらべます（味方も）'; }
        else { text = '「' + esc(pname(G, ui.target)) + 'を攻める」で決まり'; small = more ? 'まだ札を重ねられます' : ''; }
      } else if (C.type === 'spell') {
        const cost = spellCost(G, me, C);
        if (wKind(G, 'nospell') || me.st.seal > 0 || me.mp < cost) { text = 'この術はいま使えません'; small = wKind(G, 'nospell') ? '梅雨のあいだは術が使えません' : 'ほかの札をえらぶか、「やめる」'; }
        else if (aimOf(C) === 'harm' && randomTarget(G, C)) { text = '春一番：かける相手はランダム'; small = '味方に当たることも！'; }
        else if (helpCard(C) && ui.target == null) { text = '使う人をタップ（だれでも）'; small = '「自分に使う」でもOK'; }
        else if (aimOf(C) === 'harm' && ui.target == null) { text = '術をかける相手をタップ'; small = '光っている人をえらべます（味方も）'; }
        else { text = '下のボタンで術を使います'; }
      } else if (C.type === 'item' && C.eff === 'sell') {
        if (whyNot(G, me, C)) { text = 'この道具はいま使えません'; small = WHY[whyNot(G, me, C)] || ''; }
        else if (ui.ware == null) { text = '売りつける札を手札からタップ'; small = '値段が高い札ほど相手は苦しい'; }
        else if (ui.target == null) { text = '売りつける相手をタップ'; small = '小判が足りないと霊力、さらに体力で払わせる'; }
        else text = '下のボタンで売りつけます';
      } else if (C.type === 'item' && C.eff === 'refine') {
        seal = '精'; text = '「−5」で減らして「＋5」で分ける'; small = refPool() ? 'あと ' + refPool() + ' 分けられます' : '分け終わったら「精錬」';
      } else if (C.type === 'item' && needsTarget(C)) {
        if (!targetsFor(G, me, C).length) { text = 'この道具はいま使えません'; small = C.eff === 'jobutsu' ? '霊獣を連れた人がいません' : C.eff === 'usurp' ? '手札のある人がいません' : 'えらべる人がいません'; }
        else if (ui.target == null) { text = C.eff === 'jobutsu' ? '霊獣を連れた人をタップ' : C.eff === 'hpswap' ? '体力を入れかえる人をタップ' : '札を見る人をタップ'; small = '光っている人をえらべます（味方も）'; }
        else text = '下のボタンで使います';
      } else if (C.type === 'item' && C.eff === 'shuffle') { text = '「使う」で全員の手札をまぜます'; small = 'だれの札がだれに行くかは運まかせ'; }
      else if (C.type === 'item') { text = ui.target == null || ui.target === me.pid ? '自分に使うなら「自分に使う」' : '下のボタンで使います'; small = 'ほかの人をタップすると、その人に使えます（味方にも相手にも）'; }
      else if (C.type === 'summon') {
        if (me.mp < summonCost(me, C)) { text = '霊力が足りません'; small = 'おみくじの中吉や霊力の道具で霊力をふやせます'; }
        else if (whyNot(G, me, C)) { text = 'いま霊獣をつけられる人がいません'; small = 'ほかの札をえらぶか、「やめる」'; }
        else if (guardOf(me).noSummon && (ui.target == null || ui.target === me.pid)) { text = '霊獣をつける人をタップ'; small = '龍神は霊獣を連れられません。味方にも相手にもつけられます'; }
        else { text = '「呼ぶ」で霊獣を呼びます'; small = 'ほかの人をタップすると、その人につけられます'; }
      }
      else { text = 'この札はいま出せません'; small = C.type === 'plus' ? '先に武器をえらぶと、いっしょに出せます' : '攻められたときに守りとして使います'; }
      break;
    }
    case 'defend': {
      seal = '守'; cls = 'def';
      const P = G.pend;
      if (P.chain) { text = '攻めがはね返ってきました'; small = '照魔の鏡があれば「はね返す」、なければ「受ける」'; }
      else if (P.stray) { text = '流れ弾が飛んできました'; small = defOptions(G, me).length ? '「守れる」札をえらんで「守る」、守らないなら「受ける」' : '守れる札がありません。「受ける」を押してください'; }
      else { text = esc(pname(G, P.by)) + 'に攻められています'; small = defOptions(G, me).length ? (wKind(G, 'onecard') ? '秋霜：守りに出せるのは1枚だけ。えらんで「守る」' : '「守れる」札をえらんで「守る」、守らないなら「受ける」') : '守れる札がありません。「受ける」を押してください'; }
      break;
    }
    case 'usurp': seal = '奪'; cls = 'mine'; text = '見つけた札を買いますか？'; small = '払った小判は相手に渡ります'; break;
    case 'shop': seal = '商'; cls = 'mine'; text = '買う札（棚）と売る札（手札）をタップ'; small = '棚から1枚まで。取引すると番が終わる'; break;
    case 'wait': text = G.phase === 'defend' && G.pend ? '守りを待っています' : G.phase === 'swap' && G.pend ? esc(pname(G, G.pend.by)) + 'が札を入れかえ中です' : G.phase === 'usurp' && G.pend ? esc(pname(G, G.pend.by)) + 'が品定め中です' : esc(cur.name) + 'の番です'; small = '札や相手をタップすると説明が出ます'; break;
    case 'dead': {
      seal = '霊'; cls = 'ghost';
      if (ui.ghost === 'wx') { text = '次の巡の天候をタップ'; small = 'ほかの霊とちがったら、その中からランダムで決まります'; }
      else if (ui.ghost === 'hex') { text = hexUsed(G, me) ? 'この巡の呪術はかけました' : ui.hexTo == null ? '呪術をかける相手をタップ' : '下のボタンで呪術をかけます'; small = '吉か凶かは半々。前の巡と同じ相手には続けてかけられません'; }
      else { text = 'あなたは成仏しました'; small = '霊になって「天の声」で次の天候を、「呪術」で吉か凶を（1巡に1回）。相手をタップすると手札が見えます'; }
      break;
    }
    case 'spect': seal = '観'; text = '観戦中です'; break;
    case 'over': seal = '終'; text = '勝負がつきました'; break;
  }
  const el = $('gGuide');
  el.className = 'guide ' + cls;
  setHTML(el, '<span class="gs" aria-hidden="true">' + seal + '</span><span class="gt">' + text + (small ? '<small>' + small + '</small>' : '') + '</span>');
}

/* ---------- 下の大きなボタン ---------- */
function abtn(act, label, cls, dis, sub) {
  return '<button class="btn ' + (cls || '') + '" type="button" data-act="' + act + '"' + (dis || ui.sending ? ' disabled' : '') + '>' + label + (sub ? '<small>' + sub + '</small>' : '') + '</button>';
}
function renderActs(G, me, view) {
  let b = '';
  const C = view === 'card' ? selCard(me) : null;
  const wide = window.matchMedia('(min-aspect-ratio: 5/4)').matches;
  if (ui.sending) b = abtn('wait', ui.acked ? '進んでいます…' : '送っています…', '', true);
  else switch (view) {
    case 'mine': b = abtn('shop', 'よろず屋', '', false, '札を買う・売る') + abtn('pray', 'おみくじ', 'btn-gold', false, '運だめし・番が終わる'); break;
    case 'swap': b = abtn('noswap', '入れかえない') + abtn('swap', ui.swap.length ? ui.swap.length + '枚入れかえる' : '札をえらんでください', 'btn-gold', !ui.swap.length); break;
    case 'card':
      if (C.type === 'weapon') {
        if (C.all) b = abtn('cancel', 'やめる') + abtn('attack', '相手全員を攻める', 'btn-gold', !targetsFor(G, me, C).length);
        else if (randomTarget(G, C)) b = abtn('cancel', 'やめる') + abtn('attack', C.fx === 'rand' ? '運まかせで攻める' : 'ランダムなだれかを攻める', 'btn-gold', !targetsFor(G, me, C).length);
        else b = abtn('cancel', 'やめる') + (ui.target == null ? abtn('none', '相手をえらんでください', 'btn-gold', true) : abtn('attack', esc(pname(G, ui.target)) + 'を攻める', 'btn-gold'));
      } else if (C.type === 'spell') {
        const ok = !whyNot(G, me, C) || whyNot(G, me, C) === 'target';
        if (!ok) b = abtn('cancel', 'やめる');
        else if (aimOf(C) === 'harm' && randomTarget(G, C)) b = abtn('cancel', 'やめる') + abtn('spell', 'ランダムなだれかにかける', 'btn-gold', !targetsFor(G, me, C).length);
        else if (C.tgt === 'all') b = abtn('cancel', 'やめる') + abtn('spell', '相手全員にかける', 'btn-gold', !targetsFor(G, me, C).length);
        else if (helpCard(C)) b = abtn('cancel', 'やめる') + (ui.target == null || ui.target === me.pid ? abtn('spellself', '自分に使う', 'btn-gold') : abtn('spell', esc(pname(G, ui.target)) + 'に使う', 'btn-gold'));
        else b = abtn('cancel', 'やめる') + (ui.target == null ? abtn('none', '相手をえらんでください', 'btn-gold', true) : abtn('spell', esc(pname(G, ui.target)) + 'にかける', 'btn-gold'));
      } else if (C.type === 'item' && C.eff === 'sell') {
        const ware = ui.ware != null ? me.hand.find(h => h.u === ui.ware) : null;
        b = abtn('cancel', 'やめる') + (!ware ? abtn('none', '売る札をえらんでください', 'btn-gold', true) : ui.target == null ? abtn('none', '相手をえらんでください', 'btn-gold', true) : abtn('item', esc(pname(G, ui.target)) + 'に売りつける', 'btn-gold', false, priceOf(G, ware.c) + '両'));
      } else if (C.type === 'item' && C.eff === 'refine') {
        b = abtn('cancel', 'やめる') + abtn('refine', '精錬', 'btn-gold', refPool() !== 0 || !(ui.ref.hp || ui.ref.mp || ui.ref.gold), refPool() ? 'あと ' + refPool() + ' 分ける' : '');
      } else if (C.type === 'item' && needsTarget(C)) {
        b = abtn('cancel', 'やめる') + (ui.target == null ? abtn('none', '相手をえらんでください', 'btn-gold', true) : abtn('item', esc(pname(G, ui.target)) + (C.eff === 'usurp' ? 'の札を見る' : C.eff === 'hpswap' ? 'と入れかえる' : 'に使う'), 'btn-gold'));
      } else if (C.type === 'item' && helpCard(C)) b = abtn('cancel', 'やめる') + abtn('item', ui.target == null || ui.target === me.pid ? '自分に使う' : esc(pname(G, ui.target)) + 'に使う', 'btn-gold');
      else if (C.type === 'item') b = abtn('cancel', 'やめる') + abtn('item', '使う', 'btn-gold');
      else if (C.type === 'summon') {
        const self = ui.target == null || ui.target === me.pid;
        const dis = !!whyNot(G, me, C) || (self && guardOf(me).noSummon);
        b = abtn('cancel', 'やめる') + abtn('summon', self ? '呼ぶ' : esc(pname(G, ui.target)) + 'に呼ぶ', 'btn-gold', dis, '霊力 ' + summonCost(me, C));
      }
      else b = abtn('cancel', 'やめる');
      break;
    case 'defend': {
      const sp = ui.def.map(u => CARD[(me.hand.find(h => h.u === u) || {}).c]).find(x => x && x.special);
      const label = sp && sp.special === 'reflect' ? 'はね返す' : sp && sp.special === 'deflect' ? '弾く' : '守る';
      b = abtn('take', '受ける', '', false, '守らない') + abtn('guard', label, 'btn-gold', !ui.def.length);
      break;
    }
    case 'usurp': {
      const P = G.pend;
      b = abtn('nobuy', '買わない', '', false, '相手に戻す') + abtn('buy', P.price + '両で買う', 'btn-gold', me.gold < P.price || handN(me) >= HAND_MAX, '小判は相手へ');
      break;
    }
    case 'shop': {
      const gain = ui.sell.reduce((s, u) => { const h = me.hand.find(x => x.u === u); return s + (h ? sellPrice(h.c) : 0); }, 0);
      const item = ui.buy >= 0 ? G.shop[ui.buy] : null;
      const left = me.gold + gain - (item ? priceOf(G, item.c) : 0);
      const full = !!shopBlock(G, me, item);
      b = abtn('shopcancel', 'やめる') + abtn('trade', '取引する', 'btn-gold', !((gain || item) && left >= 0 && !full), '番が終わります');
      break;
    }
    case 'over': b = abtn('result', '結果を見る', 'btn-gold'); break;
    case 'dead': {
      const vote = (G.wxVote || {})[me.pid], used = hexUsed(G, me);
      if (ui.ghost === 'wx') b = abtn('ghostback', 'もどる') + (wide ? '' : abtn('log', '戦況を見る', 'btn-quiet'));
      else if (ui.ghost === 'hex') b = abtn('ghostback', 'やめる') + (used ? abtn('none', 'この巡はかけました', 'btn-gold', true) : ui.hexTo == null ? abtn('none', '相手をえらんでください', 'btn-gold', true) : abtn('hex', esc(pname(G, ui.hexTo)) + 'に呪術をかける', 'btn-gold', false, '吉か凶かは半々'));
      else b = abtn('ghostwx', '天の声', '', false, vote && WEATHER[vote] ? '次は' + esc(WEATHER[vote].name) + 'を推す' : '次の天候をえらぶ') + abtn('ghosthex', '呪術', 'btn-gold', false, used ? 'この巡はかけた' : '1巡に1回') + (wide ? '' : abtn('log', '戦況', 'btn-quiet btn-s'));
      break;
    }
    default: b = wide ? '' : abtn('log', '戦況を見る', 'btn-quiet');
  }
  setHTML($('gActs'), b);
}

/* =====================================================================
   TAPS
   ===================================================================== */
async function send(a) {
  if (!net || ui.sending) return;
  ui.sending = true; ui.acked = false; ui.sentVer = shown ? shown.ver : 0; ui.sendAt = Date.now();
  if (shown) renderGame();
  let err = null;
  try { err = await net.send(a); } catch (_) { err = 'net'; }
  if (err) {
    ui.sending = false;
    toast(errText(err)); sfx('buzz');
    if (shown) renderGame();
    return;
  }
  /* 霊の天の声・呪術は、演出の終わりを待たずに次の操作ができる */
  if (a.t === 'wx' || a.t === 'hex') ui.sending = false; else ui.acked = true;
  if (shown) renderGame();
}
function errText(err) {
  const M = { notturn: 'いまはあなたの番ではありません', target: 'その相手はえらべません', mp: '霊力が足りません', sealed: '封印中は術が使えません', gold: '小判が足りません',
    full: '手札がいっぱいです（12枚まで）。先に売るか使ってください', have: '同じ術札をもう持っています（術札は1種類1枚まで）', nodef: '守りの時間は終わりました', special: '鏡・身代わり人形・隠れ蓑は1回に1枚だけです',
    mix: '重ねられるのは同じ属性の武器だけです', stackall: '全体攻撃の武器は重ねられません', stacknone: '属性のない武器は重ねられません（追撃札だけ足せます）',
    dup: '同じ札は1回しか出せません', rain: '梅雨のあいだは術が使えません', nosummon: '龍神は霊獣を呼べません', nosell: '売りつける札をえらんでください',
    onecard: '秋霜のあいだは、守りに出せる札は1枚だけです', refinesum: '減らした分を全部分けてから「精錬」を押してください', refinehp: '体力は1より下にできません（99まで）',
    refinemp: '霊力は0から99のあいだです', refinegold: '小判が足りません', nompgain: '龍神は霊力をふやせません',
    over: 'この合戦はもう終わっています', ghost: '天の声と呪術は、成仏した人だけが使えます', hexused: '呪術は1巡に1回です', hexsame: '前の巡と同じ相手には、続けてかけられません', net: '通信がうまくいきませんでした', bad: 'その操作はできません', nosuch: 'あなたはこの合戦に入っていません' };
  if (M[err]) return M[err];
  if (/[ぁ-んァ-ン一-龥]/.test(String(err))) return String(err);
  return 'うまく送れませんでした。もう一度ためしてください';
}
function actTap(e) {
  const b = e.target.closest('button[data-act]'); if (!b || !shown) return;
  if (Date.now() - guardAt.act < 380) return; /* 出た直後の押しまちがいを防ぐ */
  const G = shown.game, me = mePlayer(shown), C = selCard(me);
  SE.ensure();
  switch (b.dataset.act) {
    case 'cancel': sfx('tap'); resetSel(); renderGame(); return;
    case 'pray': sfx('tap'); send({ t: 'pray' }); return;
    case 'swap': sfx('tap'); send({ t: 'swap', cards: ui.swap.slice() }); return;
    case 'noswap': sfx('tap'); send({ t: 'swap', cards: [] }); return;
    case 'shop': sfx('tap'); resetSel(); ui.shop = true; renderGame(); return;
    case 'shopcancel': sfx('tap'); resetSel(); renderGame(); return;
    case 'trade': send({ t: 'shop', buy: ui.buy, sell: ui.sell.slice() }); return;
    case 'attack': if (C) send({ t: 'attack', ws: [ui.sel].concat(ui.ws), adds: ui.adds.slice(), to: C.all ? undefined : ui.target }); return;
    case 'spell': if (C) send({ t: 'spell', s: ui.sel, to: aimOf(C) === 'all' || randomTarget(G, C) ? undefined : ui.target }); return;
    case 'spellself': if (C) send({ t: 'spell', s: ui.sel, to: me.pid }); return;
    case 'item': send({ t: 'item', i: ui.sel, to: needsTarget(C) || helpCard(C) ? (ui.target != null ? ui.target : undefined) : undefined, c: C && C.eff === 'sell' ? ui.ware : undefined }); return;
    case 'refine': send({ t: 'item', i: ui.sel, d: Object.assign({}, ui.ref) }); return;
    case 'summon': send({ t: 'summon', s: ui.sel, to: ui.target != null ? ui.target : undefined }); return;
    case 'buy': sfx('tap'); send({ t: 'usurp', buy: true }); return;
    case 'nobuy': sfx('tap'); send({ t: 'usurp', buy: false }); return;
    case 'take': sfx('tap'); send({ t: 'defend', cards: [] }); return;
    case 'guard': sfx('tap'); send({ t: 'defend', cards: ui.def.slice() }); return;
    case 'result': sfx('tap'); renderResult(); showScreen('result'); return;
    case 'log': sfx('tap'); openLog(); return;
    case 'ghostwx': sfx('select'); ui.ghost = 'wx'; ui.look = null; renderGame(); return;
    case 'ghosthex': sfx('select'); ui.ghost = 'hex'; ui.hexTo = null; ui.look = null; renderGame(); return;
    case 'ghostback': sfx('tap'); ui.ghost = null; ui.hexTo = null; renderGame(); return;
    case 'hex': if (ui.hexTo != null) { sfx('curse'); const to = ui.hexTo; ui.ghost = null; ui.hexTo = null; send({ t: 'hex', to }); } return;
  }
}
function handTap(e) {
  const b = e.target.closest('.fuda[data-u]'); if (!b || !shown) return;
  const u = Number(b.dataset.u);
  const G = shown.game, me = mePlayer(shown); if (!me) return;
  const h = me.hand.find(x => x.u === u); if (!h) return;
  const HC = CARD[h.c];
  const view = viewOf(G, me);
  sfx('select');
  if (view === 'defend') {
    const ok = defOptions(G, me).some(x => x.u === u);
    if (!ok) { toast(defWhy(G.pend, HC)); return; }
    const i = ui.def.indexOf(u);
    if (i >= 0) ui.def.splice(i, 1);
    else {
      /* 鏡・弾く・身代わりは1枚だけで使う。隠れ蓑はふつうの防具と重ねられる */
      const cOf = x => CARD[me.hand.find(y => y.u === x).c];
      const solo = (HC.special && HC.special !== 'dodge') || wKind(G, 'onecard');
      if (solo) ui.def = [];
      else if (HC.special) ui.def = ui.def.filter(x => !cOf(x).special);
      else ui.def = ui.def.filter(x => !cOf(x).special || cOf(x).special === 'dodge');
      ui.def.push(u);
    }
    renderGame(); return;
  }
  if (view === 'shop') { const i = ui.sell.indexOf(u); if (i >= 0) ui.sell.splice(i, 1); else ui.sell.push(u); renderGame(); return; }
  if (view === 'usurp') { toast('いまは見つけた札を買うかどうかを決めてください'); return; }
  if (view === 'swap') {
    if (HC.type === 'spell') { toast('術札は入れかえられません（使っても残る札です）'); return; }
    const i = ui.swap.indexOf(u);
    if (i >= 0) ui.swap.splice(i, 1);
    else if (ui.swap.length < G.pend.n) ui.swap.push(u);
    else { ui.swap.shift(); ui.swap.push(u); }
    renderGame(); return;
  }
  if (view === 'card' || view === 'mine') {
    const C = selCard(me);
    /* 押し売り：ほかの札をタップすると「売る札」になる */
    if (C && C.type === 'item' && C.eff === 'sell' && u !== ui.sel) {
      if (HC.type === 'spell') { toast('術札は売りつけられません'); return; }
      ui.ware = ui.ware === u ? null : u; renderGame(); return;
    }
    if (C && addable(me, C, h)) {
      const list = HC.type === 'plus' ? ui.adds : ui.ws;
      const i = list.indexOf(u);
      if (i >= 0) list.splice(i, 1); else list.push(u);
      renderGame(); return;
    }
    if (ui.ws.includes(u) || ui.adds.includes(u)) { ui.ws = ui.ws.filter(x => x !== u); ui.adds = ui.adds.filter(x => x !== u); renderGame(); return; }
    if (ui.sel === u) { resetSel(); renderGame(); return; }
    resetSel();
    ui.sel = u;
    const ts = targetPids(G, me, HC);
    if (ts.length === 1 && aimOf(HC) === 'harm') ui.target = ts[0];
    if (HC.type === 'weapon' && C && C.type === 'weapon' && !C.elem && !HC.elem) toast('属性のない武器どうしは重ねられません（追撃札だけ足せます）');
    renderGame(); return;
  }
  /* 自分の番ではないとき：説明だけ */
  ui.look = ui.look && ui.look.k === 'card' && ui.look.u === u ? null : { k: 'card', id: h.c, u };
  renderGame();
}
function seatTap(e) {
  const b = e.target.closest('[data-pid]'); if (!b || !shown) return;
  const pid = Number(b.dataset.pid);
  const G = shown.game, me = mePlayer(shown);
  const view = viewOf(G, me);
  const C = view === 'card' ? selCard(me) : null;
  if (view === 'dead' && ui.ghost === 'hex' && me) {
    const ok = !hexUsed(G, me) && hexTargets(G, me).some(t => t.pid === pid);
    if (ok) { sfx('select'); ui.hexTo = ui.hexTo === pid ? null : pid; renderGame(); }
    else { sfx('tap'); toast(hexUsed(G, me) ? '呪術は1巡に1回です' : !G.players[pid].alive ? '成仏した人にはかけられません' : '前の巡と同じ相手には、続けてかけられません'); }
    return;
  }
  const valid = targetPids(G, me, C);
  if (valid.includes(pid)) { sfx('select'); ui.target = ui.target === pid ? null : pid; renderGame(); return; }
  sfx('tap');
  if (view === 'card' && valid.length) {
    const p = G.players[pid];
    toast('この人はえらべません' + (p.st.mist && p.pid !== me.pid ? '（霧隠れ中）' : !p.alive ? '（成仏）' : C && C.type === 'summon' && guardOf(p).noSummon ? '（龍神には霊獣をつけられません）' : C && C.eff === 'jobutsu' ? '（霊獣を連れていません）' : C && C.eff === 'usurp' ? '（手札がありません）' : me && p.pid === me.pid ? '（自分には使えない札です）' : ''));
    return;
  }
  if (view === 'defend' || view === 'shop' || view === 'card') return;
  ui.look = ui.look && ui.look.k === 'seat' && ui.look.pid === pid ? null : { k: 'seat', pid };
  renderGame();
}
function centerTap(e) {
  if (!shown) return;
  const G = shown.game, me = mePlayer(shown);
  const view = viewOf(G, me);
  const cl = e.target.closest('[data-cact="close"]');
  if (cl) { sfx('tap'); ui.look = null; renderGame(); return; }
  const vt = e.target.closest('[data-vote]');
  if (vt && view === 'dead' && me) { sfx('select'); send({ t: 'wx', w: vt.dataset.vote }); return; }
  const rf = e.target.closest('[data-ref]');
  if (rf && view === 'card' && me) {
    const k = rf.dataset.ref, dir = Number(rf.dataset.dir);
    if (!refCan(me, k, dir)) { sfx('buzz'); return; }
    sfx(dir < 0 ? 'tap' : 'select');
    ui.ref[k] += dir * 5;
    renderGame(); return;
  }
  const sh = e.target.closest('#cShelf .fuda[data-i]');
  if (sh && view === 'shop') { sfx('select'); const i = Number(sh.dataset.i); ui.buy = ui.buy === i ? -1 : i; renderGame(); return; }
  const ms = e.target.closest('[data-shelf]');
  if (ms) {
    sfx('tap');
    const i = Number(ms.dataset.shelf);
    if (view === 'mine') { resetSel(); ui.shop = true; ui.buy = i; renderGame(); return; }
    ui.look = { k: 'card', id: G.shop[i].c, shelf: i }; renderGame(); return;
  }
  const lc = e.target.closest('[data-lookcard]');
  if (lc && view !== 'defend' && view !== 'shop' && view !== 'card') { sfx('tap'); ui.look = { k: 'card', id: lc.dataset.lookcard }; renderGame(); }
}
function weatherTap() {
  if (!shown) return;
  const G = shown.game, me = mePlayer(shown);
  const view = viewOf(G, me);
  const w = WEATHER[G.weather];
  sfx('tap');
  if (view === 'defend' || view === 'shop' || view === 'card') { if (w) toast('天候 ' + w.name + '：' + w.text); return; }
  ui.look = ui.look && ui.look.k === 'weather' ? null : { k: 'weather' };
  renderGame();
}

/* ---------- timer ---------- */
function updateTimer() {
  const box = $('gTimer');
  const G = room && room.game;
  if (screen !== 'game' || !G || !shown || !shown.game || G.gid !== shown.game.gid || !G.deadline || G.phase === 'over') { box.hidden = true; return; }
  const total = (G.phase === 'act' ? G.settings.turnSec : G.settings.defSec) * 1000 || 1;
  const left = Math.min(total, Math.max(0, G.deadline - (Date.now() + skew)));   /* 演出のぶんのばした時間は、満タンのまま見せる */
  const sec = Math.ceil(left / 1000);
  box.hidden = false;
  $('gTimerT').textContent = sec;
  $('gTimerC').setAttribute('stroke-dashoffset', String(94.25 * (1 - Math.min(1, left / total))));
  box.classList.toggle('low', sec <= 10);
  const me = mePlayer(room);
  const mine = (G.phase === 'act' && me && G.cur === me.pid) || myDefPending(G, me) || myUsurp(G, me) || mySwap(G, me);
  if (mine && sec <= 5 && sec > 0 && sec !== lastTickSec) { lastTickSec = sec; sfx('tick'); }
  if (net && (net.mode === 'db' || net.mode === 'mqtt') && !net.host && left === 0 && Date.now() + skew > G.deadline + 9000 && stallWarned !== G.deadline) {
    stallWarned = G.deadline;
    toast('進行役（部屋をつくった人）の画面が閉じているかもしれません');
  }
}

/* ---------- log ---------- */
/* 霊獣のアシストをひとことで */
function assistWord(G, e, me) {
  const N = pid => (me && pid === me.pid ? 'あなた' : pname(G, pid));
  switch (e.eff) {
    case 'heal': return N(e.p) + 'の体力＋' + (e.v || 0);
    case 'burn': return e.to == null ? '相手がいない' : e.v ? N(e.to) + 'に火の' + e.v + 'ダメージ' : N(e.to) + 'には火が効かなかった';
    case 'boost': return N(e.p) + 'の次の攻撃＋' + e.v;
    case 'shell': return N(e.p) + 'に甲羅（次に受けるダメージ−' + e.v + '）';
    case 'mp': return N(e.p) + 'の霊力＋' + (e.v || 0);
    case 'draw': return N(e.p) + 'が札を' + (e.v || 0) + '枚引いた';
    case 'cleanse': return e.cured ? N(e.p) + 'の呪い・封印をはらった' : N(e.p) + 'の体力＋' + (e.v || 0);
    case 'discard': return e.to == null ? '捨てる札がなかった' : e.self ? 'しまった！' + N(e.p) + 'の札を1枚捨ててしまった' : N(e.to) + 'の札を1枚捨てさせた';
    case 'gold': return N(e.p) + 'の小判＋' + (e.v || 0) + '両';
    case 'reaper': return '相手全員に5ダメージ、' + N(e.p) + 'にも' + (e.selfHit || 0) + 'ダメージ';
  }
  return '';
}
function logText(G, e, me) {
  const N = pid => (me && pid === me.pid ? 'あなた' : esc(pname(G, pid)));
  const cn = id => esc((CARD[id] || {}).name || '');
  switch (e.k) {
    case 'start': return '合戦開始';
    case 'turn': return '第' + kanjiNum(e.round) + '巡　' + N(e.p) + 'の番';
    case 'weather': { const w = WEATHER[e.w]; return w ? (e.voice != null ? '天の声（' + N(e.voice) + 'の霊）で' : '') + '天候が「' + esc(w.name) + '」に（' + esc(w.text) + '）' : ''; }
    case 'hexcast': return N(e.by) + 'の霊が' + N(e.to) + 'に呪術をかけた（次の番のはじめに効く）';
    case 'hex': { const X = HEX_OF(e.fx); return N(e.by) + 'の霊の呪術：' + N(e.to) + 'に' + (e.good ? '吉' : '凶') + '「' + X.name + '」（' + esc(hexWord(G, e)) + '）'; }
    case 'declare': return (e.slip != null ? 'すっぽ抜け！' : '') + (e.crit ? '会心の一撃！' : '') + N(e.by) + 'が' + (e.cards || [e.card]).concat(e.adds || []).map(cn).join('＋') + (e.elem ? '（' + e.elem + '）' : '') + 'で' + (e.targets.length > 1 ? '相手全員' : N(e.targets[0])) + 'を' + (CARD[e.card].type === 'spell' ? '狙う' : '攻める') + (e.slip != null ? '（ねらいは' + N(e.slip) + 'だった）' : '');
    case 'bounce': return '攻めが' + N(e.to) + 'へはね返った' + (e.atk ? '（' + e.atk + '）' : '');
    case 'stray': return N(e.from) + 'が弾いた流れ弾が' + N(e.to) + 'へ' + (e.atk ? '（' + e.atk + '）' : '');
    case 'resolve': return e.results.map(r => {
      if (r.how === 'null') return N(r.t) + 'は身代わり人形で無傷';
      if (r.how === 'reflect') return N(r.t) + 'が照魔の鏡ではね返した';
      if (r.how === 'immune') return N(r.t) + 'に火は効かなかった';
      if (r.how === 'deflect') return N(r.t) + (r.auto ? 'が幻惑で弾いた→' : 'が羽団扇で弾いた→') + N(r.to) + (r.vdmg ? 'に' + r.vdmg + 'ダメージ' : r.status ? (r.status === 'curse' ? 'が呪われた' : r.status === 'seal' ? 'が封印された' : r.stolen ? 'が札を1枚うばわれた' : 'に当たった') : 'に当たった');
      if (r.how === 'dodge') return N(r.t) + 'は隠れ蓑でかわした';
      if (r.how === 'evade') return N(r.t) + 'はひらりとかわした';
      if (r.status) return N(r.on) + (r.status === 'curse' ? 'は呪われた' : r.status === 'seal' ? 'は封印された' : r.stolen ? 'は札を1枚うばわれた' : 'から札はうばえなかった');
      if (r.how === 'block') return N(r.t) + 'は防ぎきった';
      return N(r.t) + 'に' + r.dmg + 'ダメージ' + (r.aff > 0 ? '（相性◎）' : '') + (r.miss ? '（隠れ蓑は外れた）' : '') + (r.heal ? '、' + N(e.by) + 'が' + r.heal + '回復' : '');
    }).join('、');
    case 'ko': return N(e.p) + 'は成仏した' + (e.reward ? '（' + N(e.by) + 'が小判' + e.reward + '両を手に入れた）' : '');
    case 'item':
      if (CARD[e.card] && CARD[e.card].eff === 'jobutsu') return N(e.by) + 'が成仏札を' + N(e.to) + 'の' + esc(bname(e.b)) + 'に使った→' + (e.ok ? '成仏した' : '成仏しなかった');
      return N(e.by) + 'は' + cn(e.card) + 'を' + (e.to != null && e.to !== e.by ? N(e.to) + 'に' : '') + '使った' + (e.hp ? '（体力＋' + e.hp + '）' : e.mp ? '（霊力＋' + e.mp + '）' : e.gold ? '（小判＋' + e.gold + '）' : e.kiai ? '（気合）' : '');
    case 'spell': return N(e.by) + 'は' + cn(e.card) + (e.v ? '（' + N(e.to) + 'の体力＋' + e.v + '）' : e.to != null && e.to !== e.by ? 'で' + N(e.to) + 'を霧に隠した' : 'で霧に隠れた');
    case 'hpswap': return N(e.by) + 'が狸の化け葉で' + N(e.to) + 'と体力を入れかえた（' + e.ha + '⇄' + e.hb + '）';
    case 'fukuwarai': return N(e.by) + 'の福笑いで、全員の手札がまざって配り直された';
    case 'happen': return 'ハプニング「' + esc(HAPPEN_OF(e.id).name) + '」：' + happenWord(G, e, me);
    case 'shop': return N(e.by) + 'はよろず屋で' + (e.bought ? cn(e.bought) + 'を買った' : '') + (e.sold.length ? (e.bought ? '、' : '') + '札を' + e.sold.length + '枚売った（＋' + e.gain + '両）' : '');
    case 'omikuji': { const O = OMIKUJI.find(o => o.id === e.r); return N(e.p) + (e.timeout ? 'は時間切れでおみくじ：' : 'のおみくじは') + (O ? O.name : '') + '（' + omikujiWord(e) + '）'; }
    case 'swapped': return e.n ? N(e.p) + 'は札を' + e.n + '枚入れかえた' : N(e.p) + 'は札を入れかえなかった';
    case 'curse': return N(e.p) + 'は呪いで体力−' + e.dmg;
    case 'summon': return N(e.by) + 'は霊獣「' + esc(bname(e.b)) + '」を' + (e.to != null && e.to !== e.by ? N(e.to) + 'につけた' : '呼んだ') + (e.old ? '（' + esc(bname(e.old)) + 'と入れかわり）' : '');
    case 'assist': return esc(bname(e.b)) + 'のアシスト：' + esc(assistWord(G, e, me));
    case 'beastgone': return N(e.p) + 'の霊獣「' + esc(bname(e.b)) + '」は成仏した';
    case 'shell': return N(e.p) + 'は甲羅でダメージを' + e.cut + '減らした';
    case 'fxdraw': return N(e.p) + 'は攻めが通ったので札を' + e.n + '枚引いた';
    case 'usurp': return N(e.by) + 'が簒奪札で' + N(e.to) + 'の札を品定め';
    case 'sold': return N(e.by) + 'が' + N(e.to) + 'に' + cn(e.card) + 'を' + e.price + '両で押し売り（' + [e.paid.gold ? '小判' + e.paid.gold : '', e.paid.mp ? '霊力' + e.paid.mp : '', e.paid.hp ? '体力' + e.paid.hp : ''].filter(Boolean).join('・') + 'で払った）' + (e.dead ? '→払いきれずに成仏' : '');
    case 'refine': return N(e.by) + 'は精錬した（' + [['hp', '体力'], ['mp', '霊力'], ['gold', '小判']].filter(([k]) => e.d[k]).map(([k, l]) => l + (e.d[k] > 0 ? '＋' : '−') + Math.abs(e.d[k])).join('、') + '）';
    case 'usurped': return e.buy ? N(e.by) + 'は' + N(e.to) + 'から' + cn(e.card) + 'を' + e.price + '両で買い取った' : N(e.by) + 'は' + (me && (me.pid === e.by || me.pid === e.to) ? cn(e.card) + 'を' : '') + '買わなかった';
    case 'left': return N(e.p) + 'が抜けた（CPUが代打）';
    case 'defTimeout': return '守りの時間切れ';
    case 'win': return '勝負あり';
    default: return '';
  }
}
function openLog() {
  const G = shown && shown.game; if (!G) return;
  const me = mePlayer(shown);
  $('logLines').innerHTML = G.log.map(e => logText(G, e, me)).filter(Boolean).reverse().map(t => '<p>' + t + '</p>').join('');
  openOv('ovLog');
}
