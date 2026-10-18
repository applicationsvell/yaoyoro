/* =====================================================================
   ENGINE — the rules. Pure game state in, game state out (the host runs it).
   Everything here is plain JSON so the whole game can be saved and sent.
   ===================================================================== */
const ELEMS = ['木', '火', '土', '金', '水'];
const BEATS = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' }; /* 五行の相剋: X は BEATS[X] に強い */
const strongerOf = e => ELEMS.find(x => BEATS[x] === e) || null;   /* e に強い属性（火なら水） */
const HAND0 = 10, HAND_MAX = 12, MP_MAX = 99, GOLD_MAX = 999, LOG_MAX = 50, HP_CAP = 99, SHOP_N = 4;
const BEAST_RATE = 0.1, BEAST_LEAVE_ON_HIT = 0.125, JOBUTSU_RATE = 0.5;
const TEAM_NAMES = ['紅', '白', '藍', '萌'];
let CARD = {}, GUARD = {}, CARD_LIST = [], GUARD_LIST = [], WEATHER = {}, WEATHER_LIST = [], BEAST = {}, BEAST_LIST = [];

function loadData(d) {
  CARD = {}; GUARD = {}; WEATHER = {}; BEAST = {};
  CARD_LIST = (d.cards || []).slice();
  GUARD_LIST = (d.guardians || []).slice();
  WEATHER_LIST = (d.weathers || []).slice();
  BEAST_LIST = (d.beasts || []).slice();
  CARD_LIST.forEach(c => { CARD[c.id] = c; });
  GUARD_LIST.forEach(g => { GUARD[g.id] = g; });
  WEATHER_LIST.forEach(w => { WEATHER[w.id] = w; });
  BEAST_LIST.forEach(b => { BEAST[b.id] = b; });
}

/* ---------- small helpers ---------- */
function rnd(G) {
  let t = (G.rng = (G.rng + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pickOne = (G, a) => (a.length ? a[Math.floor(rnd(G) * a.length)] : null);
function shuffleG(G, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(G) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function affinity(atkElem, defElem) {
  if (!atkElem || !defElem) return 0;
  if (BEATS[atkElem] === defElem) return 1;
  if (BEATS[defElem] === atkElem) return -1;
  return 0;
}
const applyAff = (v, f) => (f > 0 ? Math.ceil(v * 1.2) : f < 0 ? Math.ceil(v * 0.5) : v);
const guardOf = p => GUARD[p.guardian] || GUARD_LIST[0];
const sameTeam = (a, b) => a.team === b.team;
const enemiesOf = (G, p) => G.players.filter(t => t.alive && t.pid !== p.pid && !sameTeam(t, p));
const alliesOf = (G, p) => G.players.filter(t => t.alive && sameTeam(t, p));
const othersOf = (G, p) => G.players.filter(t => t.alive && t.pid !== p.pid);   /* 自分以外の全員（味方もふくむ） */
/* 札をだれに向けるか。札はだれにでも使える（チームの味方にも、相手にも）
   all＝相手全員　harm＝自分以外のだれか1人（味方も）　help＝自分をふくめてだれでも1人　none＝相手はいらない */
function aimOf(C) {
  if (!C) return 'none';
  if (C.type === 'weapon') return C.all ? 'all' : 'harm';
  if (C.type === 'spell') return C.tgt === 'all' ? 'all' : C.eff === 'heal' || C.eff === 'mist' ? 'help' : 'harm';
  if (C.type === 'item') return C.eff === 'refine' || C.eff === 'shuffle' ? 'none' : ['jobutsu', 'usurp', 'sell', 'hpswap'].includes(C.eff) ? 'harm' : 'help';
  if (C.type === 'summon') return 'help';
  return 'none';
}
/* ハプニングの多さ（0＝なし・1＝ふつう・2＝多め）。すっぽ抜け・会心の一撃・巡のはじめのハプニング・ハプニング札 */
const chaosLv = G => { const v = G && G.settings && G.settings.chaos; return v === 0 || v === 2 ? v : 1; };
const SLIP_RATE = [0, 0.05, 0.1], CRIT_RATE = [0, 0.06, 0.1], HAPPEN_RATE = [0, 0.35, 0.7];
/* となりの人（番の順で次の、生きている人） */
function nextAlive(G, p) { const n = G.players.length; for (let k = 1; k < n; k++) { const t = G.players[(p.pid + k) % n]; if (t.alive) return t; } return null; }
const handCard = (p, u) => p.hand.find(h => h.u === u) || null;
/* 術札は使っても手札（術札ゾーン）に残る。手札の枚数には数えず、同じ術は1枚だけ持てる */
const isSpellId = c => !!CARD[c] && CARD[c].type === 'spell';
const handN = p => p.hand.reduce((n, h) => n + (isSpellId(h.c) ? 0 : 1), 0);
const looseHand = p => p.hand.filter(h => !isSpellId(h.c));   /* うばう・売る・捨てるときに選ばれる札（術札はのぞく） */
const hasSpell = (p, id) => p.hand.some(h => h.c === id);
const sellPrice = id => Math.floor(((CARD[id] && CARD[id].price) || 0) / 2);
const weatherOf = G => (G && WEATHER[G.weather]) || null;
const freshSt = () => ({ curse: 0, seal: 0, mist: 0, kiai: 0, boost: 0, shell: 0 });
/* 天候「縁日」のあいだはよろず屋が半額 */
function priceOf(G, id) { const pr = (CARD[id] && CARD[id].price) || 0; const w = weatherOf(G); return w && w.kind === 'fair' ? Math.ceil(pr / 2) : pr; }
const shopN = G => { const w = weatherOf(G); return (w && w.shop) || SHOP_N; };
const wKind = (G, k) => { const w = weatherOf(G); return !!w && w.kind === k; };
function summonCost(p, C) { return Math.max(0, (C.mp || 0) - (guardOf(p).summonDiscount || 0)); }
function spellCost(G, p, C) { const w = weatherOf(G); return Math.max(1, (C.mp || 0) - (guardOf(p).spellDiscount || 0) - (w && w.kind === 'moon' ? w.cut || 1 : 0)); }
/* 式神の力と天候でダメージが増える分（weapon=武器の攻め） */
function atkBonus(G, p, elem, weapon) {
  const g = guardOf(p), w = weatherOf(G);
  return (elem && elem === g.elemBonusOf ? g.elemBonus || 0 : 0) + (g.atkBonus || 0) + (weapon ? g.weaponBonus || 0 : 0) + (w && w.kind === 'power' ? w.bonus || 0 : 0);
}
/* 霊力が増える（龍神は増えない） */
function gainMp(p, v) { if (guardOf(p).noMpGain || v <= 0) return 0; const d = Math.min(MP_MAX, p.mp + v) - p.mp; p.mp += d; return d; }
function gainGold(p, v) { const d = Math.min(GOLD_MAX, p.gold + v) - p.gold; p.gold += d; return d; }
/* 九尾の狐は火の攻撃ではダメージを受けない */
const fireImmune = (t, elem) => elem === '火' && !!guardOf(t).fireImmune;
function changeWeather(G) {
  if (!WEATHER_LIST.length) return;
  /* 天の声：成仏した人がえらんだ天候があれば、その中からランダムに1つ */
  const votes = Object.entries(G.wxVote || {}).filter(([, w]) => WEATHER[w] && w !== G.weather);
  G.wxVote = {};
  if (votes.length) {
    const [pid, w] = votes[Math.floor(rnd(G) * votes.length)];
    G.weather = w;
    logE(G, { k: 'weather', w, round: G.round, voice: Number(pid), voters: votes.map(v => Number(v[0])) });
    return;
  }
  const pool = WEATHER_LIST.filter(w => w.id !== G.weather);
  G.weather = pool[Math.floor(rnd(G) * pool.length)].id;
  logE(G, { k: 'weather', w: G.weather, round: G.round });
}
function logE(G, e) {
  e.s = ++G.seq;
  G.log.push(e);
  if (G.log.length > LOG_MAX) G.log.splice(0, G.log.length - LOG_MAX);
}
function drawCard(G) {
  if (!G.deck.length && G.discard.length) { G.deck = shuffleG(G, G.discard); G.discard = []; }
  if (!G.deck.length) return null;
  return { u: G.uid++, c: G.deck.pop() };
}
/* n枚引く。術札は術札ゾーンへ（枚数に数えないので、そのぶん続けて引く）。もう持っている術は捨てて引き直す。手札に入った枚数を返す */
function drawTo(G, p, n) {
  let got = 0, added = 0, guard = 0;
  while (got < n && guard++ < n + 40) {
    if (handN(p) >= HAND_MAX) break;
    const h = drawCard(G); if (!h) break;
    if (isSpellId(h.c)) {
      if (hasSpell(p, h.c)) { G.discard.push(h.c); continue; }
      p.hand.push(h); added++; continue;
    }
    p.hand.push(h); got++; added++;
  }
  return added;
}
function removeCards(G, p, us) {
  const out = [];
  us.forEach(u => { const i = p.hand.findIndex(h => h.u === u); if (i >= 0) { out.push(p.hand[i].c); p.hand.splice(i, 1); } });
  return out;
}
function refillShop(G) { while (G.shop.length < shopN(G)) { const h = drawCard(G); if (!h) break; G.shop.push(h); } }
function refreshShop(G) { G.shop.forEach(h => G.discard.push(h.c)); G.shop = []; refillShop(G); }

/* ---------- new game ---------- */
function newGame(seats, settings, seed, now) {
  const st = Object.assign({ teams: 0, turnSec: 60, defSec: 20, chaos: 1 }, settings || {});
  const G = {
    v: 2, rng: (seed | 0) || 1, round: 1, turn: 1, cur: 0, uid: 1, seq: 0, log: [], phase: 'act', pend: null, queue: [], used: {}, wxVote: {}, ghost: {}, hexQ: [],
    deadline: 0, turnAt: now || 0, ko: [], winner: null, settings: st, deck: [], discard: [], shop: [], players: [],
  };
  const order = shuffleG(G, seats.slice());
  const teamsUsed = new Set();
  G.players = order.map((s, i) => {
    const g = GUARD[s.guardian] || GUARD_LIST[0];
    let team = i;
    if (st.teams >= 2) { team = Number.isInteger(s.team) && s.team >= 0 && s.team < st.teams ? s.team : i % st.teams; teamsUsed.add(team); }
    return {
      pid: i, cid: s.cid || null, name: String(s.name || '名無し').slice(0, 10), cpu: !!s.cpu, guardian: g.id, team,
      hp: g.hp, hp0: g.hp, mp: g.mp, gold: g.gold, hand: [], st: freshSt(), beast: null,
      alive: true, dealt: 0, kos: 0, ff: 0,
    };
  });
  if (st.teams >= 2 && teamsUsed.size < 2) { st.teams = 0; G.players.forEach(p => { p.team = p.pid; }); }
  CARD_LIST.forEach(c => { if (c.chaos && !chaosLv(G)) return; for (let k = 0; k < (c.n || 0); k++) G.deck.push(c.id); });
  shuffleG(G, G.deck);
  G.players.forEach(p => drawTo(G, p, HAND0));
  logE(G, { k: 'start' });
  changeWeather(G);
  refillShop(G);
  G.cur = 0;
  beginTurn(G, now || 0);
  return G;
}

/* ---------- turn flow ---------- */
function beginTurn(G, now) {
  const p = G.players[G.cur];
  G.phase = 'act'; G.pend = null; G.queue = []; G.turnAt = now;
  if (p.st.mist) p.st.mist = 0;
  if (guardOf(p).mpRegen) gainMp(p, guardOf(p).mpRegen);
  logE(G, { k: 'turn', p: p.pid, round: G.round });
  /* 成仏した人の呪術は、番のはじめに効く */
  resolveHexes(G);
  if (checkWin(G)) return;
  /* 霊獣のアシスト：だれの番でも、番のはじめに霊獣ごとに約10% */
  const n = G.players.length;
  for (let k = 0; k < n; k++) {
    const o = G.players[(G.cur + k) % n];
    if (o.alive && o.beast && rnd(G) < (guardOf(o).beastRate || BEAST_RATE)) { assist(G, o); if (checkWin(G)) return; }
  }
  if (!p.alive) return;
  if (p.st.curse > 0) {
    p.st.curse--;
    const d = hurt(G, p, 3, null);
    logE(G, { k: 'curse', p: p.pid, dmg: d, left: p.st.curse, dead: !p.alive });
    if (!p.alive) { checkWin(G); return; }
  }
  /* 番のはじめには引かない（野分のときだけ1枚） */
  const w = weatherOf(G);
  if (w && w.kind === 'storm') { const got = drawTo(G, p, 1); if (got) logE(G, { k: 'draw', p: p.pid, n: got }); }
  G.deadline = G.settings.turnSec ? now + G.settings.turnSec * 1000 : 0;
}
/* 使った札の数を数えておき、処理が終わったら（番の終わりに）その数だけ引く */
function useCount(G, pid, n) { if (n > 0) { G.used = G.used || {}; G.used[pid] = (G.used[pid] || 0) + n; } }
function refillUsed(G) {
  const u = G.used || {};
  G.used = {};
  const n = G.players.length;
  for (let k = 0; k < n; k++) {
    const P = G.players[(G.cur + k) % n];
    if (!P.alive || !u[P.pid]) continue;
    const s0 = P.hand.length - handN(P);
    const got = drawTo(G, P, u[P.pid]);
    if (got) logE(G, { k: 'refill', p: P.pid, n: got, sp: P.hand.length - handN(P) - s0 });
  }
}
function endTurn(G, now) {
  if (G.phase !== 'over') refillUsed(G);
  const p = G.players[G.cur];
  if (p && p.alive && p.st.seal > 0) p.st.seal--;
  if (checkWin(G)) return;
  advance(G, now);
}
function advance(G, now) {
  const n = G.players.length;
  let i = G.cur;
  for (let k = 0; k < n * 3; k++) {
    i = (i + 1) % n;
    if (i === 0) { G.round++; changeWeather(G); refreshShop(G); happening(G); }
    if (!G.players[i].alive) continue;
    G.cur = i; G.turn++;
    beginTurn(G, now);
    if (G.phase === 'over') return;
    if (G.players[i].alive) return;
  }
  checkWin(G);
}
/* ダメージ：甲羅で減らし、霊獣はときどき去り、0で成仏。実際に受けた量を返す */
function hurt(G, t, amt, by) {
  if (!t.alive || amt <= 0) return 0;
  if (t.st.shell > 0) { const cut = Math.min(t.st.shell, amt); amt -= cut; t.st.shell = 0; logE(G, { k: 'shell', p: t.pid, cut }); if (amt <= 0) return 0; }
  t.hp -= amt;
  if (by != null && by !== t.pid && G.players[by]) { G.players[by].dealt += amt; if (G.settings.teams && sameTeam(G.players[by], t)) G.players[by].ff = (G.players[by].ff || 0) + amt; }
  if (t.beast && t.hp > 0 && rnd(G) < BEAST_LEAVE_ON_HIT) { logE(G, { k: 'beastgone', p: t.pid, b: t.beast, why: 'hit' }); t.beast = null; }
  if (t.hp <= 0) ko(G, t, by);
  return amt;
}
/* 成仏：手札は捨て札へ。倒した人は小判の半分をもらう */
function ko(G, t, by) {
  {
    t.hp = 0; t.alive = false; G.ko.push(t.pid);
    t.hand.forEach(h => G.discard.push(h.c)); t.hand = [];
    t.st = freshSt(); t.beast = null;
    let reward = 0;
    if (by != null && by !== t.pid && G.players[by] && G.players[by].alive) {
      reward = Math.floor(t.gold / 2);
      G.players[by].gold = Math.min(GOLD_MAX, G.players[by].gold + reward);
      G.players[by].kos++;
    }
    t.gold = 0;
    logE(G, { k: 'ko', p: t.pid, by: by == null ? -1 : by, reward });
  }
}
/* 体力の上限はなし（99まで） */
function heal(p, v) { const before = p.hp; p.hp = Math.min(HP_CAP, p.hp + v); return p.hp - before; }
function checkWin(G) {
  if (G.phase === 'over') return true;
  const alive = G.players.filter(p => p.alive);
  const teams = new Set(alive.map(p => p.team));
  if (teams.size <= 1) {
    G.phase = 'over'; G.pend = null; G.queue = []; G.deadline = 0;
    G.winner = alive.length ? alive[0].team : null;
    logE(G, { k: 'win', team: G.winner, pids: alive.map(p => p.pid) });
    return true;
  }
  return false;
}

/* ---------- 霊獣 ---------- */
function assist(G, o) {
  const B = BEAST[o.beast]; if (!B) return;
  const e = { k: 'assist', p: o.pid, b: B.id, eff: B.eff };
  const foes = enemiesOf(G, o);
  switch (B.eff) {
    case 'heal': e.v = heal(o, B.val); break;
    case 'burn': { const t = pickOne(G, foes); if (t) { e.to = t.pid; e.v = fireImmune(t, B.elem) ? 0 : hurt(G, t, applyAff(B.val, affinity(B.elem, guardOf(t).elem)), o.pid); } break; }
    case 'boost': o.st.boost += B.val; e.v = B.val; break;
    case 'shell': o.st.shell = Math.max(o.st.shell, B.val); e.v = B.val; break;
    case 'mp': e.v = gainMp(o, B.val); break;
    case 'draw': e.v = drawTo(G, o, B.val); break;
    case 'cleanse':
      if (o.st.curse > 0 || o.st.seal > 0) { o.st.curse = 0; o.st.seal = 0; e.cured = true; } else e.v = heal(o, B.val);
      break;
    case 'discard': {
      /* 獏：まれに（5回に1回）自分の手札を捨ててしまう */
      const self = rnd(G) < 0.2;
      const t = self ? (looseHand(o).length ? o : null) : pickOne(G, foes.filter(x => looseHand(x).length));
      if (t) { const L = looseHand(t); const h = L[Math.floor(rnd(G) * L.length)]; t.hand.splice(t.hand.indexOf(h), 1); G.discard.push(h.c); e.to = t.pid; e.card = h.c; e.self = self; }
      break;
    }
    case 'gold': e.v = gainGold(o, B.val); break;
    case 'reaper': {
      /* 死神：相手全員と自分に5ダメージ（守れない） */
      e.all = foes.map(x => x.pid);
      e.hits = foes.map(x => hurt(G, x, B.val, o.pid));
      e.selfHit = hurt(G, o, B.val, null);
      break;
    }
  }
  logE(G, e);
}

/* ---------- 成仏したあと：天の声（次の天候をえらぶ）と呪術（吉か凶かは半々） ---------- */
const HEXES = [
  { id: 'kago', good: true, name: '加護', text: '体力＋5' },
  { id: 'daikago', good: true, name: '大加護', text: '体力が倍（99まで）' },
  { id: 'fuku', good: true, name: '福の神', text: '小判＋15両' },
  { id: 'reigen', good: true, name: '霊験', text: '霊力＋5' },
  { id: 'tenkei', good: true, name: '天啓', text: '札を2枚引く' },
  { id: 'tatari', good: false, name: '祟り', text: '体力−5（1より下にはならない）' },
  { id: 'daitatari', good: false, name: '大祟り', text: '体力が半分' },
  { id: 'binbo', good: false, name: '貧乏神', text: '小判が半分' },
  { id: 'reisho', good: false, name: '霊障', text: '霊力−5' },
  { id: 'kitsuneki', good: false, name: '狐つき', text: '手札を総入れかえ（術札はそのまま）' },
];
const isGhost = (G, p) => !!p && !p.alive && G.phase !== 'over';
const hexUsed = (G, p) => { const g = G.ghost && G.ghost[p.pid]; return !!g && g.round === G.round; };
/* 呪術をかけられる相手：生きている人。ただし前の巡と同じ人には続けてかけられない */
function hexTargets(G, p) {
  const last = G.ghost && G.ghost[p.pid];
  const alive = G.players.filter(t => t.alive);
  return alive.filter(t => !last || t.pid !== last.to || alive.length < 2);
}
function doVote(G, p, w) {
  if (!isGhost(G, p)) return 'ghost';
  if (!WEATHER[w] || w === G.weather) return 'bad';
  G.wxVote = G.wxVote || {};
  G.wxVote[p.pid] = w;
  return null;
}
function doHex(G, p, to) {
  if (!isGhost(G, p)) return 'ghost';
  if (hexUsed(G, p)) return 'hexused';
  const t = G.players[to];
  if (!t || !t.alive) return 'target';
  if (!hexTargets(G, p).includes(t)) return 'hexsame';
  G.ghost = G.ghost || {}; G.ghost[p.pid] = { round: G.round, to };
  G.hexQ = G.hexQ || []; G.hexQ.push({ by: p.pid, to });
  logE(G, { k: 'hexcast', by: p.pid, to });
  return null;
}
function resolveHexes(G) {
  const q = G.hexQ || [];
  G.hexQ = [];
  q.forEach(h => {
    const t = G.players[h.to]; if (!t || !t.alive) return;
    const good = rnd(G) < 0.5;
    const pool = HEXES.filter(x => x.good === good);
    const X = pool[Math.floor(rnd(G) * pool.length)];
    const e = { k: 'hex', by: h.by, to: t.pid, fx: X.id, good, hp: 0, mp: 0, gold: 0 };
    switch (X.id) {
      case 'kago': e.hp = heal(t, 5); break;
      case 'daikago': e.hp = heal(t, t.hp); break;
      case 'fuku': e.gold = gainGold(t, 15); break;
      case 'reigen': e.mp = gainMp(t, 5); break;
      case 'tenkei': e.got = drawTo(G, t, 2); break;
      case 'tatari': { const d = Math.max(0, Math.min(5, t.hp - 1)); t.hp -= d; e.hp = -d; break; }
      case 'daitatari': { const d = Math.floor(t.hp / 2); t.hp -= d; e.hp = -d; break; }
      case 'binbo': { const d = Math.ceil(t.gold / 2); t.gold -= d; e.gold = -d; break; }
      case 'reisho': { const d = Math.min(5, t.mp); t.mp -= d; e.mp = -d; break; }
      case 'kitsuneki': {
        const L = looseHand(t);
        L.forEach(x => { t.hand.splice(t.hand.indexOf(x), 1); G.discard.push(x.c); });
        e.n = L.length; e.got = drawTo(G, t, L.length);
        break;
      }
    }
    logE(G, e);
  });
}

/* ---------- ハプニング：巡のはじめに、ときどき思いがけないことが起きる ---------- */
const HAPPENINGS = [
  { id: 'nezumi', name: 'ねずみ小僧', yomi: 'ねずみこぞう', text: '小判がいちばん多い人から15両を、いちばん少ない人へ' },
  { id: 'nagareboshi', name: '流れ星', yomi: 'ながれぼし', text: 'だれか1人が札を2枚引く' },
  { id: 'jishin', name: '地震', yomi: 'じしん', text: '全員の体力−3（1より下にはならない）' },
  { id: 'matsuri', name: 'お祭り', yomi: 'おまつり', text: '全員の体力＋5' },
  { id: 'yomeiri', name: '狐の嫁入り', yomi: 'きつねのよめいり', text: '全員が手札を1枚ずつ、となりの人へ渡す（どの札かはランダム）' },
  { id: 'irekawari', name: '魂の入れかわり', yomi: 'たましいのいれかわり', text: 'だれか2人の体力が入れかわる' },
  { id: 'iede', name: '霊獣の家出', yomi: 'れいじゅうのいえで', text: '霊獣がみんな、となりの人のところへ引っこす' },
  { id: 'takarakuji', name: '宝くじ', yomi: 'たからくじ', text: 'だれか1人に小判＋20両' },
];
function happening(G, force) {
  const lv = chaosLv(G);
  if (!force && (!lv || rnd(G) >= HAPPEN_RATE[lv])) return null;
  const alive = G.players.filter(p => p.alive);
  if (alive.length < 2) return null;
  const rich = alive.slice().sort((a, b) => b.gold - a.gold)[0], poor = alive.slice().sort((a, b) => a.gold - b.gold)[0];
  const ok = {
    nezumi: rich.gold > 0 && rich.gold > poor.gold,
    yomeiri: alive.filter(p => looseHand(p).length).length >= 1,
    irekawari: new Set(alive.map(p => p.hp)).size > 1,
    iede: alive.some(p => p.beast),
  };
  const pool = HAPPENINGS.filter(h => ok[h.id] !== false && (!force || force === true || force === h.id));
  const H = pickOne(G, pool); if (!H) return null;
  const e = { k: 'happen', id: H.id };
  switch (H.id) {
    case 'nezumi': { const v = Math.min(15, rich.gold); rich.gold -= v; gainGold(poor, v); Object.assign(e, { from: rich.pid, to: poor.pid, v }); break; }
    case 'nagareboshi': { const t = pickOne(G, alive); e.to = t.pid; e.got = drawTo(G, t, 2); break; }
    case 'jishin': e.hits = alive.map(p => { const d = Math.max(0, Math.min(3, p.hp - 1)); p.hp -= d; return { p: p.pid, d }; }); break;
    case 'matsuri': e.heals = alive.map(p => ({ p: p.pid, v: heal(p, 5) })); break;
    case 'yomeiri': {
      /* いっせいに渡す：先に全員の渡す札を決めてから、となりへ */
      const give = alive.map(p => { const L = looseHand(p); const h = L.length ? L[Math.floor(rnd(G) * L.length)] : null; return { p, h, to: nextAlive(G, p) }; });
      give.forEach(x => { if (x.h) x.p.hand.splice(x.p.hand.indexOf(x.h), 1); });
      e.moves = give.filter(x => x.h).map(x => {
        if (handN(x.to) < HAND_MAX) { x.to.hand.push(x.h); return { f: x.p.pid, t: x.to.pid, c: x.h.c }; }
        G.discard.push(x.h.c); return { f: x.p.pid, t: -1, c: x.h.c };
      });
      break;
    }
    case 'irekawari': {
      const a = pickOne(G, alive), b = pickOne(G, alive.filter(p => p !== a && p.hp !== a.hp)) || pickOne(G, alive.filter(p => p !== a));
      Object.assign(e, { a: a.pid, b: b.pid, ha: a.hp, hb: b.hp });
      [a.hp, b.hp] = [b.hp, a.hp];
      break;
    }
    case 'iede': {
      /* いっせいに引っこす。龍神のところへ来た霊獣は、いられずに去る */
      const was = alive.map(p => ({ p, b: p.beast, to: nextAlive(G, p) }));
      alive.forEach(p => { p.beast = null; });
      e.moves = was.filter(x => x.b).map(x => {
        if (guardOf(x.to).noSummon) return { f: x.p.pid, t: -1, b: x.b };
        x.to.beast = x.b; return { f: x.p.pid, t: x.to.pid, b: x.b };
      });
      break;
    }
    case 'takarakuji': { const t = pickOne(G, alive); e.to = t.pid; e.v = gainGold(t, 20); break; }
  }
  logE(G, e);
  return e;
}
/* 福笑い：全員の手札（術札をのぞく）を集めてまぜ、もとの枚数ずつ配り直す */
function fukuwarai(G, p) {
  const alive = G.players.filter(t => t.alive);
  const pool = [], cnt = {};
  alive.forEach(t => { const L = looseHand(t); cnt[t.pid] = L.length; L.forEach(h => { t.hand.splice(t.hand.indexOf(h), 1); pool.push(h); }); });
  shuffleG(G, pool);
  const deal = {};
  alive.forEach(t => { deal[t.pid] = []; for (let k = 0; k < cnt[t.pid]; k++) { const h = pool.pop(); t.hand.push(h); deal[t.pid].push(h.c); } });
  return { cnt, deal };
}

/* ---------- what can be done (also used by the screen and the CPU) ---------- */
/* えらべる相手。霧隠れの人は、ほかの人からはえらべない（自分にはいつでも使える） */
function targetsFor(G, p, C) {
  if (!C) return [];
  const aim = aimOf(C);
  if (aim === 'all') return enemiesOf(G, p).filter(t => !t.st.mist);
  if (aim === 'none') return [p];
  const others = othersOf(G, p).filter(t => !t.st.mist);
  if (aim === 'harm') {
    if (C.eff === 'jobutsu') return others.filter(t => t.beast);
    if (C.eff === 'usurp') return others.filter(t => looseHand(t).length > 0);
    return others;
  }
  const L = [p].concat(others);
  return C.type === 'summon' ? L.filter(t => !guardOf(t).noSummon) : L;
}
/* だれに当たるかランダム：天候「春一番」の武器と術（1人を狙うもの。味方に当たることも）・暴れ独楽 */
const randomTarget = (G, C) => !!C && ((C.type === 'weapon' && C.fx === 'rand') || (wKind(G, 'random') && ((C.type === 'weapon' && !C.all) || (C.type === 'spell' && aimOf(C) === 'harm'))));
const randomPick = (G, p) => pickOne(G, othersOf(G, p).filter(x => !x.st.mist));
/* 使えない理由（なければ null） */
function whyNot(G, p, C) {
  if (!C) return 'bad';
  if (C.type === 'spell') {
    if (wKind(G, 'nospell')) return 'rain';
    if (p.st.seal > 0) return 'sealed';
    if (p.mp < spellCost(G, p, C)) return 'mp';
  }
  if (C.type === 'summon') {
    if (p.mp < summonCost(p, C)) return 'mp';
    if (!targetsFor(G, p, C).length) return 'target';
    return null;
  }
  if (C.type === 'item' && C.eff === 'sell' && looseHand(p).length < 2) return 'nosell';
  if (C.type === 'item' && C.eff === 'refine') return null;
  if (C.type === 'armor' || C.type === 'plus') return 'bad';
  if (!targetsFor(G, p, C).length) return 'target';
  return null;
}
function canUse(G, p, h) { return !whyNot(G, p, CARD[h.c]); }
/* この守札で、いまの攻め（P）を守れるか */
function armorFits(P, A) {
  if (!A || A.type !== 'armor') return false;
  if (P.chain) return A.special === 'reflect';                 /* はね返ってきた攻撃は、跳ね返す札だけ */
  if (A.special) return A.special === 'dodge' ? P.kind === 'attack' : true;  /* 特別な守りは属性に関係なく */
  if (P.kind === 'spell' && A.magic) return true;               /* 結界札は術ならなんでも */
  if (!P.elem) return true;                                     /* 無属性の攻撃・術は、どの守札でも */
  return !!A.elem && (A.elem === P.elem || BEATS[A.elem] === P.elem);   /* 属性の攻撃は、同じ属性か、その属性に強い属性の守札（火の攻めなら火か水） */
}
function defOptions(G, p) {
  const P = G.pend; if (!P || P.kind === 'usurp' || !P.targets.includes(p.pid)) return [];
  return p.hand.filter(h => armorFits(P, CARD[h.c]));
}
function defenseCheck(G, p, us) {
  const opts = defOptions(G, p).map(h => h.u);
  if (new Set(us).size !== us.length) return 'dup';
  if (us.some(u => !opts.includes(u))) return 'bad';
  if (us.length > 1 && wKind(G, 'onecard')) return 'onecard';
  if (us.filter(u => CARD[handCard(p, u).c].special).length > 1) return 'special';
  return null;
}
/* 守りの合計。大蝦蟇は＋3、龍神は守札の守りが半分 */
function defenseValue(G, p, us) {
  let def = 0;
  us.forEach(u => { const C = CARD[handCard(p, u).c]; if (C.def && !C.special) def += C.def; });
  return armorTotal(p, def);
}
function armorTotal(p, raw) {
  if (raw <= 0) return 0;
  const g = guardOf(p);
  return (g.armorHalf ? Math.ceil(raw / 2) : raw) + (g.armorBonus || 0);
}

/* ---------- actions ---------- */
/* a.t: attack {ws, adds, to} / spell {s, to} / item {i, to} / summon {s} / shop {buy, sell} / pray / defend {cards} / usurp {buy} */
function act(G, pid, a, now) {
  if (!G || G.phase === 'over') return 'over';
  const p = G.players[pid];
  if (!p || !a) return 'bad';
  if (a.t === 'defend') return doDefend(G, p, Array.isArray(a.cards) ? a.cards.slice(0, HAND_MAX) : [], now);
  if (a.t === 'usurp') return doUsurpDecide(G, p, !!a.buy, now);
  if (a.t === 'swap') return doSwap(G, p, Array.isArray(a.cards) ? a.cards.slice(0, 5) : [], now);
  if (a.t === 'wx') return doVote(G, p, String(a.w || ''));
  if (a.t === 'hex') return doHex(G, p, Number(a.to));
  if (G.phase !== 'act' || G.cur !== pid || !p.alive) return 'notturn';
  switch (a.t) {
    case 'attack': return doAttack(G, p, a, now);
    case 'spell': return doSpell(G, p, a, now);
    case 'item': return doItem(G, p, a, now);
    case 'summon': return doSummon(G, p, a, now);
    case 'shop': return doShop(G, p, a, now);
    case 'pray': return doPray(G, p, now, false);
    default: return 'bad';
  }
}
/* おみくじ（祈る）：大吉 体力＋10と札2枚入れかえ／吉 2枚入れかえ／中吉 霊力＋5と小判＋5／小吉 1枚入れかえ／凶 なにもなし */
const OMIKUJI = [
  { id: 'daikichi', name: '大吉', rate: 0.15, swap: 5 },
  { id: 'kichi', name: '吉', rate: 0.2, swap: 3 },
  { id: 'chukichi', name: '中吉', rate: 0.25, swap: 2 },
  { id: 'shokichi', name: '小吉', rate: 0.25, swap: 1 },
  { id: 'kyo', name: '凶', rate: 0.15 },
];
function doPray(G, p, now, timeout) {
  let r = rnd(G), O = OMIKUJI[OMIKUJI.length - 1];
  for (const o of OMIKUJI) { if (r < o.rate) { O = o; break; } r -= o.rate; }
  const e = { k: 'omikuji', p: p.pid, r: O.id, hp: 0, mp: 0, gold: 0, swap: O.swap || 0, timeout: !!timeout };
  if (O.hp) e.hp = heal(p, O.hp);
  if (O.mp) e.mp = gainMp(p, O.mp);
  if (O.gold) e.gold = gainGold(p, O.gold);
  logE(G, e);
  /* 入れかえ：捨てる札を自分でえらぶ（時間切れのときは入れかえない） */
  if (e.swap && !timeout && looseHand(p).length) {
    G.pend = { kind: 'swap', by: p.pid, n: e.swap, targets: [p.pid], resp: {}, at: now };
    G.phase = 'swap';
    G.deadline = G.settings.defSec ? now + G.settings.defSec * 1000 : 0;
    return null;
  }
  endTurn(G, now);
  return null;
}
function doSwap(G, p, us, now) {
  const P = G.pend;
  if (G.phase !== 'swap' || !P || P.by !== p.pid) return 'nodef';
  if (new Set(us).size !== us.length || us.length > P.n || us.some(u => !handCard(p, u) || isSpellId(handCard(p, u).c))) return 'bad';
  const out = removeCards(G, p, us);
  out.forEach(c => G.discard.push(c));
  const got = drawTo(G, p, out.length);
  logE(G, { k: 'swapped', p: p.pid, n: out.length, got });
  G.pend = null;
  endTurn(G, now);
  return null;
}
/* 攻める：属性の武器は同じ属性どうし何枚でも重ねられる。無属性の武器は1枚（追撃札だけ足せる）。全体攻撃は1枚 */
function attackCheck(G, p, wsU, addsU) {
  if (!wsU.length) return 'bad';
  const all = wsU.concat(addsU);
  if (new Set(all).size !== all.length) return 'bad';
  const ws = wsU.map(u => handCard(p, u));
  if (ws.some(x => !x || CARD[x.c].type !== 'weapon')) return 'bad';
  const Ws = ws.map(x => CARD[x.c]);
  if (Ws.length > 1) {
    if (Ws.some(W => !W.elem)) return 'stacknone';
    if (Ws.some(W => W.elem !== Ws[0].elem)) return 'mix';
    if (Ws.some(W => W.all)) return 'stackall';
  }
  const adds = addsU.map(u => handCard(p, u));
  if (adds.some(x => !x || CARD[x.c].type !== 'plus')) return 'bad';
  return null;
}
function attackBase(G, p, wsU, addsU) {
  const Ws = wsU.map(u => CARD[handCard(p, u).c]);
  return Math.max(0, Ws.reduce((s, W) => s + W.atk, 0) + addsU.reduce((s, u) => s + CARD[handCard(p, u).c].atk, 0) + atkBonus(G, p, Ws[0].elem, true) + (p.st.kiai > 0 ? 5 : 0) + (p.st.boost || 0));
}
function startDefend(G, P, now) {
  G.pend = P;
  G.phase = 'defend';
  G.deadline = G.settings.defSec ? now + G.settings.defSec * 1000 : 0;
}
function doAttack(G, p, a, now) {
  const wsU = Array.isArray(a.ws) ? a.ws.slice(0, HAND_MAX) : (a.w != null ? [a.w] : []);
  const addsU = Array.isArray(a.adds) ? a.adds.slice(0, HAND_MAX) : [];
  const err = attackCheck(G, p, wsU, addsU); if (err) return err;
  const Ws = wsU.map(u => CARD[handCard(p, u).c]);
  const lead = Ws.slice().sort((x, y) => y.atk - x.atk)[0];
  let targets, slip = null;
  if (lead.all) targets = enemiesOf(G, p).filter(t => !t.st.mist);
  else if (randomTarget(G, lead)) { const t = randomPick(G, p); targets = t ? [t] : []; }
  else {
    let t = G.players[a.to];
    if (!t || !t.alive || t.pid === p.pid || t.st.mist) return 'target';
    /* ハプニング「すっぽ抜け」：手がすべって、ねらった人とはちがうだれかに飛ぶ（味方のことも） */
    if (rnd(G) < SLIP_RATE[chaosLv(G)]) {
      const pool = othersOf(G, p).filter(x => !x.st.mist && x.pid !== t.pid);
      if (pool.length) { slip = t.pid; t = pickOne(G, pool); }
    }
    targets = [t];
  }
  if (!targets.length) return 'target';
  /* ハプニング「会心の一撃」：攻撃が2倍 */
  const crit = rnd(G) < CRIT_RATE[chaosLv(G)];
  const base = attackBase(G, p, wsU, addsU) * (crit ? 2 : 1);
  const kiai = p.st.kiai > 0, boost = p.st.boost || 0;
  p.st.kiai = 0; p.st.boost = 0;
  const addIds = addsU.map(u => handCard(p, u).c);
  removeCards(G, p, wsU.concat(addsU)).forEach(c => G.discard.push(c));
  useCount(G, p.pid, wsU.length + addsU.length);
  const atk = {}, aff = {};
  const elem = lead.elem || null;
  targets.forEach(t => { aff[t.pid] = affinity(elem, guardOf(t).elem); atk[t.pid] = applyAff(base, aff[t.pid]); });
  const draws = Ws.filter(W => W.fx === 'draw').length;
  startDefend(G, { kind: 'attack', by: p.pid, card: lead.id, cards: Ws.map(W => W.id), adds: addIds, elem, base, atk, aff, kiai, boost, draws, crit, slip,
    targets: targets.map(t => t.pid), resp: {}, at: now }, now);
  logE(G, { k: 'declare', by: p.pid, card: lead.id, cards: G.pend.cards, adds: addIds, targets: G.pend.targets, atk, aff, kiai, boost, base, elem, crit, slip });
  return null;
}
function doSpell(G, p, a, now) {
  const s = handCard(p, a.s); if (!s) return 'bad';
  const S = CARD[s.c]; if (!S || S.type !== 'spell') return 'bad';
  if (wKind(G, 'nospell')) return 'rain';
  if (p.st.seal > 0) return 'sealed';
  const cost = spellCost(G, p, S);
  if (p.mp < cost) return 'mp';
  const aim = aimOf(S);
  let targets;
  if (aim === 'all') targets = enemiesOf(G, p).filter(t => !t.st.mist);
  else if (randomTarget(G, S)) { const t = randomPick(G, p); targets = t ? [t] : []; }
  else if (aim === 'help') {
    const t = a.to == null ? p : G.players[a.to];
    if (!t || !targetsFor(G, p, S).includes(t)) return 'target';
    targets = [t];
  } else {
    const t = G.players[a.to];
    if (!t || !t.alive || t.pid === p.pid || t.st.mist) return 'target';
    targets = [t];
  }
  if (!targets.length) return 'target';
  p.mp -= cost;
  /* 術札は使っても手札に残る（捨てない・引かない） */
  if (aim === 'help') {
    const t = targets[0];
    let v = 0;
    if (S.eff === 'heal') v = heal(t, S.val);
    if (S.eff === 'mist') t.st.mist = 1;
    logE(G, { k: 'spell', by: p.pid, card: S.id, to: t.pid, v, cost });
    endTurn(G, now);
    return null;
  }
  const dmgType = S.eff === 'dmg' || S.eff === 'drain';
  const base = dmgType ? Math.max(0, S.val + atkBonus(G, p, S.elem, false)) : 0;
  const atk = {}, aff = {};
  targets.forEach(t => { aff[t.pid] = dmgType ? affinity(S.elem, guardOf(t).elem) : 0; atk[t.pid] = dmgType ? applyAff(base, aff[t.pid]) : 0; });
  startDefend(G, { kind: 'spell', by: p.pid, card: S.id, cards: [S.id], adds: [], elem: S.elem || null, base, atk, aff, eff: S.eff,
    targets: targets.map(t => t.pid), resp: {}, at: now }, now);
  logE(G, { k: 'declare', by: p.pid, card: S.id, cards: [S.id], adds: [], targets: G.pend.targets, atk, aff, cost, elem: S.elem || null, nodef: !!S.nodef });
  /* 神隠しは守れない：守りの時間なしですぐ効く */
  if (S.nodef) resolve(G, now);
  return null;
}
function doItem(G, p, a, now) {
  const h = handCard(p, a.i); if (!h) return 'bad';
  const I = CARD[h.c]; if (!I || I.type !== 'item') return 'bad';
  const aim = aimOf(I);
  let t = p;
  if (aim === 'harm' || aim === 'help') {
    t = a.to == null ? (aim === 'help' ? p : null) : G.players[a.to];
    if (!t || !targetsFor(G, p, I).includes(t)) return 'target';
  }
  /* 押し売り：売りつける札（自分の手札の別の札） */
  let sell = null;
  if (I.eff === 'sell') { sell = handCard(p, a.c); if (!sell || sell.u === a.i || isSpellId(sell.c)) return 'nosell'; }
  /* 精錬：体力・霊力・小判を5ずつ入れかえる */
  let d = null;
  if (I.eff === 'refine') { d = refineCheck(p, a.d); if (typeof d === 'string') return d; }
  removeCards(G, p, [a.i]).forEach(c => G.discard.push(c));
  useCount(G, p.pid, 1);
  if (I.eff === 'usurp') {
    /* 簒奪：相手の手札からランダムに1枚を見て、買うかどうか決める */
    const L = looseHand(t);
    const pickH = L[Math.floor(rnd(G) * L.length)];
    G.pend = { kind: 'usurp', by: p.pid, targets: [t.pid], u: pickH.u, c: pickH.c, price: priceOf(G, pickH.c), at: now, resp: {} };
    G.phase = 'usurp';
    G.deadline = G.settings.defSec ? now + G.settings.defSec * 1000 : 0;
    logE(G, { k: 'usurp', by: p.pid, to: t.pid, item: I.id });
    return null;
  }
  if (I.eff === 'sell') { doSell(G, p, t, sell); endTurn(G, now); return null; }
  if (I.eff === 'refine') {
    p.hp += d.hp; p.mp += d.mp; p.gold += d.gold;
    logE(G, { k: 'refine', by: p.pid, card: I.id, d });
    endTurn(G, now);
    return null;
  }
  if (I.eff === 'hpswap') {
    /* 狸の化け葉：えらんだ人と体力を入れかえる（守れない） */
    const e = { k: 'hpswap', by: p.pid, to: t.pid, card: I.id, ha: p.hp, hb: t.hp };
    [p.hp, t.hp] = [t.hp, p.hp];
    logE(G, e);
    endTurn(G, now);
    return null;
  }
  if (I.eff === 'shuffle') {
    const r = fukuwarai(G, p);
    logE(G, { k: 'fukuwarai', by: p.pid, card: I.id, cnt: r.cnt, deal: r.deal });
    endTurn(G, now);
    return null;
  }
  /* 体力・霊力・小判・気合・清めは、えらんだ人（自分・味方・相手のだれでも）に効く */
  const e = { k: 'item', by: p.pid, to: t.pid, card: I.id, hp: 0, mp: 0, gold: 0 };
  if (I.eff === 'heal') e.hp = heal(t, I.val);
  if (I.eff === 'mp') e.mp = gainMp(t, I.val);
  if (I.eff === 'gold') e.gold = gainGold(t, I.val);
  if (I.eff === 'maneki') { e.gold = gainGold(t, I.val); e.mp = gainMp(t, 3); }
  if (I.eff === 'kiai') { t.st.kiai = 1; e.kiai = true; }
  if (I.eff === 'cleanse') { e.cured = t.st.curse > 0 || t.st.seal > 0; t.st.curse = 0; t.st.seal = 0; e.hp = heal(t, I.val); }
  if (I.eff === 'jobutsu') {
    e.b = t.beast;
    e.ok = rnd(G) < JOBUTSU_RATE;
    if (e.ok) t.beast = null;
  }
  logE(G, e);
  endTurn(G, now);
  return null;
}
/* 精錬の中身を確かめる。5ずつ、合計0、体力は1以上・99まで */
function refineCheck(p, d) {
  if (!d || typeof d !== 'object') return 'bad';
  const v = { hp: Number(d.hp) || 0, mp: Number(d.mp) || 0, gold: Number(d.gold) || 0 };
  if ([v.hp, v.mp, v.gold].some(x => !Number.isInteger(x) || x % 5 !== 0)) return 'bad';
  if (v.hp + v.mp + v.gold !== 0) return 'refinesum';
  if (!v.hp && !v.mp && !v.gold) return 'refinesum';
  if (p.hp + v.hp < 1 || p.hp + v.hp > HP_CAP) return 'refinehp';
  if (p.mp + v.mp < 0 || p.mp + v.mp > MP_MAX) return 'refinemp';
  if (p.gold + v.gold < 0 || p.gold + v.gold > GOLD_MAX) return 'refinegold';
  if (v.mp > 0 && guardOf(p).noMpGain) return 'nompgain';
  return v;
}
/* 押し売り：相手は値段を払って札を受け取る。小判が足りなければ霊力、それでも足りなければ体力で払う。払えなければ成仏 */
function doSell(G, p, t, h) {
  const price = priceOf(G, h.c);
  const i = p.hand.indexOf(h);
  p.hand.splice(i, 1);
  let rest = price;
  const paid = { gold: Math.min(t.gold, rest) }; rest -= paid.gold; t.gold -= paid.gold;
  paid.mp = Math.min(t.mp, rest); rest -= paid.mp; t.mp -= paid.mp;
  paid.hp = Math.min(t.hp, rest); rest -= paid.hp;
  gainGold(p, price);
  if (handN(t) < HAND_MAX) t.hand.push(h); else G.discard.push(h.c);
  const e = { k: 'sold', by: p.pid, to: t.pid, card: h.c, item: 'oshiuri', price, paid, dead: false };
  if (paid.hp > 0) { t.hp -= paid.hp; if (t.hp <= 0) e.dead = true; }
  logE(G, e);
  if (e.dead) ko(G, t, p.pid);
}
function doUsurpDecide(G, p, buy, now) {
  const P = G.pend;
  if (G.phase !== 'usurp' || !P || P.by !== p.pid) return 'nodef';
  const t = G.players[P.targets[0]];
  const h = handCard(t, P.u);
  const e = { k: 'usurped', by: p.pid, to: t.pid, card: P.c, price: P.price, buy: false };
  if (buy && h) {
    if (p.gold < P.price) return 'gold';
    if (handN(p) >= HAND_MAX) return 'full';
    p.gold -= P.price;
    t.gold = Math.min(GOLD_MAX, t.gold + P.price);
    t.hand.splice(t.hand.indexOf(h), 1);
    p.hand.push(h);
    e.buy = true;
  }
  logE(G, e);
  G.pend = null;
  endTurn(G, now);
  return null;
}
function doSummon(G, p, a, now) {
  const s = handCard(p, a.s); if (!s) return 'bad';
  const S = CARD[s.c]; if (!S || S.type !== 'summon') return 'bad';
  const cost = summonCost(p, S);
  if (p.mp < cost) return 'mp';
  /* 霊獣は、自分にも味方にも相手にもつけられる（龍神にはつけられない） */
  const t = a.to == null ? p : G.players[a.to];
  if (!t || !targetsFor(G, p, S).includes(t)) return guardOf(t || p).noSummon ? 'nosummon' : 'target';
  p.mp -= cost;
  removeCards(G, p, [a.s]).forEach(c => G.discard.push(c));
  useCount(G, p.pid, 1);
  const old = t.beast;
  /* どの霊獣が出るかはランダム（いまの霊獣とは別のもの） */
  const pick = pickOne(G, BEAST_LIST.filter(B => B.id !== old)) || BEAST_LIST[0];
  t.beast = pick.id;
  logE(G, { k: 'summon', by: p.pid, to: t.pid, b: t.beast, old, card: S.id });
  endTurn(G, now);
  return null;
}
function doShop(G, p, a, now) {
  const sell = Array.isArray(a.sell) ? a.sell : [];
  if (new Set(sell).size !== sell.length || sell.some(u => !handCard(p, u))) return 'bad';
  const buy = Number.isInteger(a.buy) ? a.buy : -1;
  if (!sell.length && buy < 0) return 'bad';
  const gain = sell.reduce((s, u) => s + sellPrice(handCard(p, u).c), 0);
  let item = null;
  if (buy >= 0) {
    item = G.shop[buy]; if (!item) return 'bad';
    if (p.gold + gain < priceOf(G, item.c)) return 'gold';
    if (isSpellId(item.c)) { if (hasSpell(p, item.c) && !sell.some(u => handCard(p, u).c === item.c)) return 'have'; }
    else if (handN(p) - sell.filter(u => !isSpellId(handCard(p, u).c)).length >= HAND_MAX) return 'full';
  }
  const sold = removeCards(G, p, sell);
  sold.forEach(c => G.discard.push(c));
  p.gold = Math.min(GOLD_MAX, p.gold + gain);
  let price = 0;
  if (item) {
    price = priceOf(G, item.c);
    p.gold -= price;
    G.shop.splice(buy, 1);
    p.hand.push(item);
    refillShop(G);
  }
  logE(G, { k: 'shop', by: p.pid, sold, gain, bought: item ? item.c : null, price });
  endTurn(G, now);
  return null;
}
function doDefend(G, p, us, now) {
  const P = G.pend;
  if (G.phase !== 'defend' || !P || !P.targets.includes(p.pid) || P.resp[p.pid]) return 'nodef';
  const err = defenseCheck(G, p, us); if (err) return err;
  const def = defenseValue(G, p, us);
  P.resp[p.pid] = { cards: removeCards(G, p, us), def };
  useCount(G, p.pid, us.length);
  logE(G, { k: 'guard', p: p.pid, n: us.length });
  if (P.targets.every(t => P.resp[t] || !G.players[t].alive)) resolve(G, now);
  return null;
}
/* 攻めの結果を出す。跳ね返しは「つぎの攻め」として順番待ちに入り、応酬が続く */
function resolve(G, now) {
  const P = G.pend; if (!P) return;
  const A = G.players[P.by];
  const C = CARD[P.card];
  const dmgType = P.kind === 'attack' || P.eff === 'dmg' || P.eff === 'drain';
  const results = [];
  let hitAny = false;
  P.targets.forEach(tid => {
    const T = G.players[tid];
    const R = P.resp[tid] || { cards: [], def: 0 };
    R.cards.forEach(c => G.discard.push(c));
    if (!T.alive) return;
    const r = { t: tid, cards: R.cards, atk: P.atk[tid], aff: P.aff[tid], def: 0, dmg: 0, how: 'hit' };
    const sp = R.cards.map(c => CARD[c]).find(c => c && c.special);
    if (sp && sp.special === 'null') r.how = 'null';
    else if (sp && sp.special === 'reflect') {
      r.how = 'reflect';
      if (A.alive) {
        /* はね返す：攻めた人に向かう新しい攻め。相手も跳ね返す札があれば返せる */
        const f = dmgType ? affinity(P.elem, guardOf(A).elem) : 0;
        G.queue.push({ kind: P.kind, by: tid, card: P.card, cards: P.cards, adds: P.adds, elem: P.elem, base: P.base, eff: P.eff,
          atk: { [A.pid]: dmgType ? applyAff(P.base, f) : 0 }, aff: { [A.pid]: f }, targets: [A.pid], chain: (P.chain || 0) + 1, from: P.by });
        r.back = A.pid;
      }
    } else if ((sp && sp.special === 'deflect') || (P.kind === 'attack' && !P.chain && !P.stray && guardOf(T).deflectRate && rnd(G) < guardOf(T).deflectRate)) {
      /* 弾く：自分もふくめて全員のなかからランダムに選ばれた人に「流れ弾」が飛ぶ（天邪鬼は武器の攻撃を40%で弾く）。
         流れ弾は、当たる人の守りの番になる（ふつうの守札で守れる） */
      const V = pickOne(G, G.players.filter(x => x.alive));
      r.how = 'deflect'; r.to = V.pid; r.auto = !(sp && sp.special === 'deflect');
      const f = dmgType ? affinity(P.elem, guardOf(V).elem) : 0;
      G.queue.push({ kind: P.kind, by: P.by, card: P.card, cards: P.cards, adds: P.adds, elem: P.elem, base: P.base, eff: P.eff, nodef: P.nodef,
        atk: { [V.pid]: dmgType ? applyAff(P.base, f) : 0 }, aff: { [V.pid]: f }, targets: [V.pid], chain: 0, stray: (P.stray || 0) + 1, from: tid, auto: r.auto });
    } else if (dmgType && fireImmune(T, P.elem)) r.how = 'immune';
    else if (sp && sp.special === 'dodge' && rnd(G) < 0.5) r.how = 'dodge';
    else if (P.kind === 'attack' && !P.chain && guardOf(T).dodge && rnd(G) < guardOf(T).dodge) r.how = 'evade';
    else {
      if (sp && sp.special === 'dodge') r.miss = true;
      if (dmgType) {
        r.def = R.def;
        const raw = Math.max(0, r.atk - r.def);
        r.dmg = raw > 0 ? hurt(G, T, raw, A.pid) : 0;
        if (raw > 0 && r.dmg < raw) r.shell = raw - r.dmg;
        if (r.dmg > 0) hitAny = true;
        if (raw <= 0) r.how = 'block';
        if (P.eff === 'drain' && r.dmg > 0 && A.alive) r.heal = heal(A, r.dmg);
      } else if (R.cards.some(c => CARD[c] && CARD[c].type === 'armor' && !CARD[c].special)) r.how = 'block';
      else applyStatus(G, P.eff, A, T, r);
    }
    r.dead = !T.alive;
    results.push(r);
  });
  logE(G, { k: 'resolve', by: P.by, card: C.id, kind: P.kind, results, adead: !A.alive, chain: P.chain || 0 });
  G.pend = null;
  if (checkWin(G)) return;
  /* ダメージが通ったら1枚引く武器 */
  if (P.draws && hitAny && A.alive && !P.chain && !P.stray) {
    const got = drawTo(G, A, P.draws);
    if (got) logE(G, { k: 'fxdraw', p: A.pid, n: got });
  }
  nextOrEnd(G, now);
}
function nextOrEnd(G, now) {
  while (G.queue && G.queue.length) {
    const Q = G.queue.shift();
    const T = G.players[Q.targets[0]];
    if (!T || !T.alive || (!Q.stray && !G.players[Q.by].alive)) continue;
    Q.resp = {}; Q.at = now;
    startDefend(G, Q, now);
    if (Q.stray) logE(G, { k: 'stray', by: Q.by, from: Q.from, to: T.pid, card: Q.card, atk: Q.atk[T.pid], auto: !!Q.auto, kind: Q.kind });
    else logE(G, { k: 'bounce', by: Q.by, to: T.pid, card: Q.card, atk: Q.atk[T.pid], chain: Q.chain });
    return;
  }
  endTurn(G, now);
}
/* curse / seal / steal from `from` onto `to` */
function applyStatus(G, eff, from, to, r) {
  if (eff === 'curse') { to.st.curse = Math.max(to.st.curse, 3); r.status = 'curse'; r.on = to.pid; }
  if (eff === 'seal') { to.st.seal = Math.max(to.st.seal, 2); r.status = 'seal'; r.on = to.pid; }
  if (eff === 'steal') {
    r.status = 'steal'; r.on = to.pid;
    const L = looseHand(to);
    if (L.length && from.alive && from.pid !== to.pid && handN(from) < HAND_MAX) {
      const h = L[Math.floor(rnd(G) * L.length)];
      to.hand.splice(to.hand.indexOf(h), 1);
      from.hand.push(h); r.stolen = h.c; r.thief = from.pid;
    }
  }
}

/* ---------- time limits (the host calls this every moment) ---------- */
function tick(G, now) {
  if (!G || G.phase === 'over') return false;
  /* 守る人がみんな答えた（か、もういない）のに止まっていたら、結果を出す */
  if (G.phase === 'defend' && G.pend && G.pend.targets.every(t => G.pend.resp[t] || !G.players[t] || !G.players[t].alive)) { resolve(G, now); return true; }
  if (!G.deadline || now < G.deadline) return false;
  if (G.phase === 'act') { doPray(G, G.players[G.cur], now, true); return true; }
  if (G.phase === 'usurp' && G.pend) { doUsurpDecide(G, G.players[G.pend.by], false, now); return true; }
  if (G.phase === 'swap' && G.pend) { doSwap(G, G.players[G.pend.by], [], now); return true; }
  if (G.phase === 'defend' && G.pend) {
    G.pend.targets.forEach(t => { if (!G.pend.resp[t]) G.pend.resp[t] = { cards: [], def: 0 }; });
    logE(G, { k: 'defTimeout' });
    resolve(G, now);
    return true;
  }
  return false;
}

/* =====================================================================
   CPU — a simple but sensible opponent
   ===================================================================== */
function cardWorth(C) {
  if (!C) return 0;
  if (C.type === 'weapon') return C.atk * (C.elem ? 1.3 : 1) + (C.all ? 3 : 0) + (C.fx ? 2 : 0);
  if (C.type === 'armor') return C.special ? 9 : (C.def || 0) * (C.elem ? 1.2 : 0.9) + (C.magic ? 2 : 0);
  if (C.type === 'plus') return C.atk;
  if (C.type === 'summon') return 6;
  if (C.type === 'spell') return C.eff === 'dmg' ? 6 + C.val * 0.5 : 7;   /* 術札は何度でも使えるので値打ちが高い */
  if (C.type === 'item') return C.eff === 'heal' || C.eff === 'mp' ? C.val * 0.5 : C.eff === 'gold' ? C.val * 0.4 : C.eff === 'sell' ? 6 : 4;
  return 2;
}
/* 押し売りの代金を払えるか（払えなければ成仏） */
const sellKills = (t, price) => t.gold + t.mp + t.hp <= price;
function cpuChoose(G, pid) {
  const p = G.players[pid];
  const hand = p.hand.map(h => ({ h, C: CARD[h.c] })).filter(x => x.C);
  const nh = handN(p);                                   /* 手札の枚数（術札はのぞく） */
  const loose = hand.filter(x => x.C.type !== 'spell');
  const enemies = enemiesOf(G, p).filter(t => !t.st.mist);
  const hpRate = p.hp / Math.max(1, p.hp0);
  const g = guardOf(p);
  const immune = (t, elem) => (fireImmune(t, elem) ? 0 : 1);
  const cands = [];
  const add = (v, a) => cands.push({ v: v + rnd(G) * 0.5, a });
  /* だれに当たるかランダムなとき（春一番・暴れ独楽）：味方に当たるとマイナスで見積もる */
  const rndPool = othersOf(G, p).filter(t => !t.st.mist);
  const randVal = f => (rndPool.length ? rndPool.reduce((s, t) => s + (sameTeam(t, p) ? -1.3 : 1) * f(t), 0) / rndPool.length : 0);
  const pluses = hand.filter(x => x.C.type === 'plus');
  const plusSum = pluses.reduce((s, x) => s + x.C.atk, 0);
  /* 守られそうな量：属性の攻撃は守りにくい */
  const expDef = (t, elem) => (elem ? Math.min(5, handN(t) * 0.45) : Math.min(7, handN(t) * 0.9));
  /* attacks: 1枚ずつ、または同じ属性の武器をまとめて（重ね打ち） */
  const weapons = hand.filter(x => x.C.type === 'weapon');
  const sets = weapons.map(x => [x]);
  const groups = {};
  weapons.filter(x => !x.C.all && x.C.elem).forEach(x => { (groups[x.C.elem] = groups[x.C.elem] || []).push(x); });
  Object.values(groups).forEach(g => {
    if (g.length < 2) return;
    const sorted = g.slice().sort((a, b) => b.C.atk - a.C.atk);
    sets.push(sorted.slice(0, 2));
    if (sorted.length > 2) sets.push(sorted);
  });
  sets.forEach(set => {
    const W = set[0].C, elem = W.elem || null;
    const wsum = set.reduce((s, x) => s + x.C.atk, 0);
    const usePlus = wsum >= 5 || W.all;
    const base = Math.max(0, wsum + (usePlus ? plusSum : 0) + atkBonus(G, p, elem, true) + (p.st.kiai ? 5 : 0) + (p.st.boost || 0));
    const adds = usePlus ? pluses.map(y => y.h.u) : [];
    const ws = set.map(x => x.h.u);
    const cost = (set.length - 1) * 1.6 + adds.length * 0.6 + (W.atk >= 12 ? 1 : 0);
    if (W.all) {
      if (!enemies.length) return;
      let v = 0;
      enemies.forEach(t => { const d = Math.max(0, applyAff(base, affinity(elem, guardOf(t).elem)) - expDef(t, elem)) * immune(t, elem); v += d + (d >= t.hp ? 8 : 0); });
      add(v * 0.9 - adds.length * 0.6, { t: 'attack', ws, adds });
    } else {
      const val = t => {
        const d = Math.max(0, applyAff(base, affinity(elem, guardOf(t).elem)) - expDef(t, elem)) * immune(t, elem) * (guardOf(t).deflectRate ? 1 - guardOf(t).deflectRate : 1);
        return d + (d >= t.hp ? 10 : 0) + (1 - Math.min(1, t.hp / t.hp0)) * 3;
      };
      if (randomTarget(G, W)) { add(randVal(val) - cost + (W.fx === 'draw' ? 1 : 0), { t: 'attack', ws, adds }); return; }
      enemies.forEach(t => add(val(t) - cost + (W.fx === 'draw' ? 1 : 0), { t: 'attack', ws, adds, to: t.pid }));
    }
  });
  /* spells */
  if (p.st.seal <= 0 && !wKind(G, 'nospell')) hand.filter(x => x.C.type === 'spell' && p.mp >= spellCost(G, p, x.C)).forEach(x => {
    const S = x.C;
    if (S.eff === 'dmg' || S.eff === 'drain') {
      const base = Math.max(0, S.val + atkBonus(G, p, S.elem, false));
      if (S.tgt === 'all') {
        let v = 0; enemies.forEach(t => { const d = (applyAff(base, affinity(S.elem, guardOf(t).elem)) - expDef(t, S.elem) * 0.5) * immune(t, S.elem); v += Math.max(0, d) + (d >= t.hp ? 8 : 0); });
        add(v - 1, { t: 'spell', s: x.h.u });
      } else if (randomTarget(G, S)) {
        add(randVal(t => { const d = (applyAff(base, affinity(S.elem, guardOf(t).elem)) - expDef(t, S.elem) * 0.5) * immune(t, S.elem); return Math.max(0, d) + (d >= t.hp ? 10 : 0); }) - 0.5, { t: 'spell', s: x.h.u });
      } else enemies.forEach(t => {
        const d = (applyAff(base, affinity(S.elem, guardOf(t).elem)) - expDef(t, S.elem) * 0.5) * immune(t, S.elem);
        add(Math.max(0, d) + (d >= t.hp ? 10 : 0) + (S.eff === 'drain' && hpRate < 0.6 ? 4 : 0) - 0.5, { t: 'spell', s: x.h.u, to: t.pid });
      });
    } else if (S.eff === 'heal') {
      alliesOf(G, p).filter(t => t.hp / t.hp0 < 0.7).forEach(t => add(Math.min(S.val, HP_CAP - t.hp, t.hp0 - t.hp) * (t.hp / t.hp0 < 0.35 ? 1.3 : 0.75) + (t.pid === p.pid ? 1 : 0), { t: 'spell', s: x.h.u, to: t.pid }));
    } else if (randomTarget(G, S)) {
      /* 春一番のあいだの呪い・封印・神隠しは、味方に当たるかもしれないので使わない */
    } else if (S.eff === 'curse') {
      enemies.filter(t => t.st.curse <= 0).forEach(t => add(4 + t.hp / 20 - t.hand.length * 0.15, { t: 'spell', s: x.h.u, to: t.pid }));
    } else if (S.eff === 'seal') {
      enemies.filter(t => t.st.seal <= 0 && t.mp >= 4).forEach(t => add(2 + t.mp / 4, { t: 'spell', s: x.h.u, to: t.pid }));
    } else if (S.eff === 'steal') {
      enemies.filter(t => looseHand(t).length >= 4 && nh < HAND_MAX).forEach(t => add(3 + looseHand(t).length / 3, { t: 'spell', s: x.h.u, to: t.pid }));
    } else if (S.eff === 'mist') {
      if (hpRate < 0.4) add(9, { t: 'spell', s: x.h.u });
    }
  });
  /* summon */
  hand.filter(x => x.C.type === 'summon' && p.mp >= summonCost(p, x.C)).forEach(x => {
    if (!g.noSummon) add(p.beast ? 0.8 : 5 + enemies.length * 0.3, { t: 'summon', s: x.h.u });
    /* 霊獣のいない味方につける（龍神は自分につけられないので、味方につける） */
    alliesOf(G, p).filter(t => t !== p && !t.beast && !t.st.mist && !guardOf(t).noSummon).forEach(t => add((g.noSummon ? 4.5 : 2.5) + enemies.length * 0.2, { t: 'summon', s: x.h.u, to: t.pid }));
  });
  const mates = alliesOf(G, p).filter(t => t !== p && !t.st.mist);
  /* items */
  hand.filter(x => x.C.type === 'item').forEach(x => {
    const I = x.C;
    if (I.eff === 'heal') {
      const lost = p.hp0 - p.hp; if (lost >= I.val * 0.8) add(Math.min(lost, I.val) * (hpRate < 0.5 ? 1.6 : 0.8), { t: 'item', i: x.h.u }); else if (nh >= HAND_MAX - 1) add(1 + I.val * 0.05, { t: 'item', i: x.h.u });
      /* 味方の体力も回復できる */
      mates.forEach(t => { const ml = t.hp0 - t.hp; if (ml >= I.val * 0.8) add(Math.min(ml, I.val) * (t.hp / t.hp0 < 0.4 ? 1.4 : 0.6), { t: 'item', i: x.h.u, to: t.pid }); });
    }
    if (I.eff === 'cleanse' && (p.st.curse > 0 || p.st.seal > 0)) add(8 + p.st.curse * 2, { t: 'item', i: x.h.u });
    if (I.eff === 'cleanse') mates.filter(t => t.st.curse > 0).forEach(t => add(5 + t.st.curse * 1.5, { t: 'item', i: x.h.u, to: t.pid }));
    if (I.eff === 'hpswap') {
      /* 狸の化け葉：体力が少ないときに、体力の多い相手と入れかえる */
      enemies.forEach(t => { const gain = t.hp - p.hp; if (gain >= 10) add(gain * (hpRate < 0.4 ? 0.7 : 0.35), { t: 'item', i: x.h.u, to: t.pid }); });
    }
    if (I.eff === 'shuffle') add(0.6 + hand.filter(y => y.C.type !== 'spell' && !canUse(G, p, y.h) && y.C.type !== 'armor').length * 0.5, { t: 'item', i: x.h.u });
    if (I.eff === 'mp' && !g.noMpGain && p.mp < 8) add(2 + I.val * 0.1, { t: 'item', i: x.h.u });
    if (I.eff === 'mp' && g.noMpGain && nh >= HAND_MAX - 1) add(0.5, { t: 'shop', buy: -1, sell: [x.h.u] });
    if (I.eff === 'sell' && loose.length >= 2) {
      /* いちばん高くて、いらない札を売りつける（術札は売りつけられない） */
      const goods = loose.filter(y => y.h.u !== x.h.u).sort((a, b) => (priceOf(G, b.h.c) - cardWorth(b.C)) - (priceOf(G, a.h.c) - cardWorth(a.C)));
      const ware = goods[0];
      if (ware) targetsFor(G, p, I).forEach(t => {
        const pr = priceOf(G, ware.h.c);
        add(pr * 0.3 - cardWorth(ware.C) * 0.4 + (sellKills(t, pr) ? 14 : 0) + (pr > t.gold ? 1.5 : 0), { t: 'item', i: x.h.u, to: t.pid, c: ware.h.u });
      });
    }
    if (I.eff === 'refine') {
      /* 体力が少ないときは、小判や霊力を体力に */
      const spare = Math.floor(Math.max(0, p.gold - 6) / 5) * 5 + Math.floor(Math.max(0, p.mp - 8) / 5) * 5;
      if (hpRate < 0.5 && spare >= 10) {
        const want = Math.min(spare, Math.floor((HP_CAP - p.hp) / 5) * 5, 40);
        const fromGold = Math.min(want, Math.floor(Math.max(0, p.gold - 6) / 5) * 5);
        const fromMp = Math.min(want - fromGold, Math.floor(Math.max(0, p.mp - 8) / 5) * 5);
        if (fromGold + fromMp >= 10) add((fromGold + fromMp) * 0.35 * (hpRate < 0.3 ? 1.6 : 1), { t: 'item', i: x.h.u, d: { hp: fromGold + fromMp, gold: -fromGold, mp: -fromMp } });
      }
    }
    if (I.eff === 'gold' || I.eff === 'maneki') add(1.5, { t: 'item', i: x.h.u });
    if (I.eff === 'kiai' && !p.st.kiai && hand.some(y => y.C.type === 'weapon')) add(2.5, { t: 'item', i: x.h.u });
    if (I.eff === 'jobutsu') targetsFor(G, p, I).forEach(t => add(4.5, { t: 'item', i: x.h.u, to: t.pid }));
    if (I.eff === 'usurp' && p.gold >= 6 && nh < HAND_MAX) targetsFor(G, p, I).forEach(t => add(1.5 + looseHand(t).length * 0.2 + p.gold / 30, { t: 'item', i: x.h.u, to: t.pid }));
  });
  /* shop */
  G.shop.forEach((s, i) => {
    const C = CARD[s.c]; const pr = priceOf(G, s.c); if (!C || p.gold < pr) return;
    if (C.type === 'spell' ? hasSpell(p, C.id) : nh >= HAND_MAX) return;
    let v = cardWorth(C) * 0.35;
    if (C.type === 'item' && C.eff === 'heal' && hpRate < 0.5) v = 4;
    if (p.gold - pr >= 10) v += 0.8;
    if (pr < C.price) v += 0.6;
    if (v > 0) add(v, { t: 'shop', buy: i, sell: [] });
  });
  /* 手札がいっぱいなら、いらない札を売って入れかえる */
  if (nh >= HAND_MAX) {
    const junk = loose.slice().sort((a, b) => cardWorth(a.C) - cardWorth(b.C)).slice(0, 2).map(x => x.h.u);
    add(2.5, { t: 'shop', buy: -1, sell: junk });
  }
  /* pray: better when the hand is thin */
  /* おみくじ：使える札が少ないほど、入れかえ目当てで引く */
  const stuck = hand.filter(x => !canUse(G, p, x.h)).length / Math.max(1, hand.length);
  add(0.3 + stuck * 2 + (hpRate < 0.5 ? 0.4 : 0), { t: 'pray' });
  cands.sort((a, b) => b.v - a.v);
  return cands.length ? cands[0].a : { t: 'pray' };
}
/* おみくじの入れかえ：使いにくい札から捨てる */
function cpuSwap(G, pid) {
  const P = G.pend, p = G.players[pid];
  const armors = p.hand.filter(h => CARD[h.c].type === 'armor').length;
  const score = h => { const C = CARD[h.c]; let v = cardWorth(C); if (C.type === 'armor' && armors >= 5) v -= 3; if (C.type === 'spell' && wKind(G, 'nospell')) v -= 1; if (C.type === 'summon' && guardOf(p).noSummon) v -= 9; if (C.type === 'item' && C.eff === 'mp' && guardOf(p).noMpGain) v -= 9; return v; };
  return looseHand(p).sort((a, b) => score(a) - score(b)).slice(0, P.n).filter(h => score(h) < 5).map(h => h.u);
}
function cpuUsurp(G, pid) {
  const P = G.pend, p = G.players[pid];
  const C = CARD[P.c];
  return p.gold >= P.price && handN(p) < HAND_MAX && cardWorth(C) >= Math.max(4, P.price * 0.55);
}
function cpuDefend(G, pid) {
  const p = G.players[pid];
  const P = G.pend;
  const opts = defOptions(G, p);
  const inc = P.atk[pid] || 0;
  const specials = opts.filter(h => CARD[h.c].special);
  const armors = opts.filter(h => !CARD[h.c].special && CARD[h.c].def);
  const rf = specials.find(h => CARD[h.c].special === 'reflect');
  const nl = specials.find(h => CARD[h.c].special === 'null');
  const df = specials.find(h => CARD[h.c].special === 'deflect');
  const dg = specials.find(h => CARD[h.c].special === 'dodge');
  const dmgType = P.kind === 'attack' || P.eff === 'dmg' || P.eff === 'drain';
  if (dmgType && fireImmune(p, P.elem)) return [];
  const pick = cpuDefendPick(G, p, P, inc, specials, armors, rf, nl, df, dg, dmgType);
  /* 秋霜のあいだは1枚だけ */
  if (pick.length > 1 && wKind(G, 'onecard')) {
    const sp = pick.find(u => CARD[handCard(p, u).c].special && CARD[handCard(p, u).c].special !== 'dodge');
    if (sp) return [sp];
    return [pick.slice().sort((a, b) => (CARD[handCard(p, b).c].def || 0) - (CARD[handCard(p, a).c].def || 0))[0]];
  }
  return pick;
}
function cpuDefendPick(G, p, P, inc, specials, armors, rf, nl, df, dg, dmgType) {
  if (P.chain) return rf && (inc >= 3 || !dmgType) && rnd(G) < 0.9 ? [rf.u] : [];
  if (!dmgType) {
    const cheap = armors.slice().sort((a, b) => CARD[a.c].def - CARD[b.c].def)[0];
    if (cheap && CARD[cheap.c].def <= 6) return [cheap.u];
    const sp = rf || nl;
    if (sp && (P.eff === 'curse' || rnd(G) < 0.5)) return [sp.u];
    return cheap ? [cheap.u] : [];
  }
  if (inc <= 0) return [];
  const lethal = inc >= p.hp;
  let best = null;
  const n = Math.min(armors.length, 10);
  for (let m = 1; m < (1 << n); m++) {
    let raw = 0, cnt = 0;
    for (let i = 0; i < n; i++) if (m & (1 << i)) { raw += CARD[armors[i].c].def; cnt++; }
    const sum = armorTotal(p, raw);
    if (sum >= inc && (!best || sum < best.sum || (sum === best.sum && cnt < best.cnt))) best = { m, sum, cnt };
  }
  const pickM = m => armors.filter((_, i) => m & (1 << i)).map(h => h.u);
  if ((lethal || inc >= 12) && rf) return [rf.u];
  if (best && best.sum - inc <= 6) return pickM(best.m);
  if ((lethal || inc >= 10) && nl) return [nl.u];
  if ((lethal || inc >= 10) && df) return [df.u];
  if (best) return pickM(best.m);
  const all = armors.map(h => h.u);
  if (lethal || inc >= 8) { const out = all.slice(); if (dg) out.push(dg.u); return out; }
  if (inc >= 5 && all.length) return all.slice(0, 1);
  return [];
}
