// CPU同士で何百回も対戦させて、ルールの不具合・ゲームの長さ・式神の強さ・札の出やすさを確かめる
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/part-engine.js'), 'utf8');
const DATA_FILE = process.env.DATA || path.join(__dirname, '../src/cards.json');
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const E = new Function(src + '\nreturn { loadData, newGame, act, tick, cpuChoose, cpuDefend, cpuUsurp, cpuSwap, defOptions, hexTargets, CARD: () => CARD, GUARD_LIST: () => GUARD_LIST, WEATHER_LIST: () => WEATHER_LIST };')();
let stacks = 0, stackN = 0;
const SPN = { sum: 0, n: 0, max: 0 };
const GH = { vote: 0, hex: 0 };
const ev = {};
if (process.env.GV) { const o = JSON.parse(process.env.GV); data.guardians.forEach(g => Object.assign(g, o[g.id] || {})); }
E.loadData(data);
const TOTAL = data.cards.reduce((s, c) => s + c.n, 0);
const GIDS = data.guardians.map(g => g.id);
const GAMES = Number(process.env.GAMES || 0);

function countCards(G) {
  let n = G.deck.length + G.discard.length + G.shop.length;
  G.players.forEach(p => { n += p.hand.length; });
  if (G.pend && G.pend.resp) Object.values(G.pend.resp).forEach(r => { n += r.cards.length; });
  return n;
}
function run(seed, nPlayers, teams, guardOf) {
  const seats = [];
  for (let i = 0; i < nPlayers; i++) seats.push({ cid: 'c' + i, name: 'P' + i, cpu: true, guardian: guardOf ? guardOf(i) : GIDS[(seed + i) % GIDS.length], team: teams ? i % teams : undefined });
  let now = 1000;
  const G = E.newGame(seats, { teams, turnSec: 60, defSec: 20 }, seed * 7919 + 13, now);
  let steps = 0, errors = 0, timeouts = 0;
  const kinds = {};
  const seen = new Set(), used = new Set();
  const healGot = {}, healShop = new Set();
  const isHeal = c => { const C = E.CARD()[c]; return C && C.type === 'item' && C.eff === 'heal'; };
  const look = () => {
    G.shop.forEach(h => { seen.add(h.c); if (isHeal(h.c)) healShop.add(h.u); });
    G.players.forEach(p => p.hand.forEach(h => { seen.add(h.c); if (isHeal(h.c)) (healGot[p.pid] = healGot[p.pid] || new Set()).add(h.u); }));
  };
  look();
  while (G.phase !== 'over' && steps < 6000) {
    steps++; now += 1000;
    /* 成仏した人の天の声と呪術（GHOST=1 のとき） */
    if (process.env.GHOST) G.players.filter(p => !p.alive).forEach(p => {
      if (Math.random() < 0.2) { const ws = E.WEATHER_LIST().filter(w => w.id !== G.weather); const err = E.act(G, p.pid, { t: 'wx', w: ws[Math.floor(Math.random() * ws.length)].id }, now); if (err) throw new Error('wx ' + err); GH.vote++; }
      if (Math.random() < 0.2) { const ts = E.hexTargets(G, p); const t = ts[Math.floor(Math.random() * ts.length)]; if (t) { const err = E.act(G, p.pid, { t: 'hex', to: t.pid }, now); if (err && err !== 'hexused') throw new Error('hex ' + err); if (!err) GH.hex++; } }
    });
    if (G.phase === 'act') {
      const p = G.players[G.cur];
      if (seed % 9 === 0 && steps % 17 === 0) { now = G.deadline; E.tick(G, now); timeouts++; continue; }
      const a = E.cpuChoose(G, p.pid);
      kinds[a.t] = (kinds[a.t] || 0) + 1;
      if (a.t === 'attack') { stackN++; if (a.ws.length > 1) stacks++; }
      const err = E.act(G, p.pid, a, now);
      if (err) { errors++; if (errors < 5) console.log('act error', err, JSON.stringify(a)); E.act(G, p.pid, { t: 'pray' }, now); }
    } else if (G.phase === 'swap') {
      const err = E.act(G, G.pend.by, { t: 'swap', cards: E.cpuSwap(G, G.pend.by) }, now);
      if (err) { errors++; if (errors < 5) console.log('swap error', err); E.act(G, G.pend.by, { t: 'swap', cards: [] }, now); }
    } else if (G.phase === 'usurp') {
      const err = E.act(G, G.pend.by, { t: 'usurp', buy: E.cpuUsurp(G, G.pend.by) }, now);
      if (err) { errors++; if (errors < 5) console.log('usurp error', err); E.act(G, G.pend.by, { t: 'usurp', buy: false }, now); }
    } else if (G.phase === 'defend') {
      if (seed % 7 === 0 && steps % 11 === 0) { now = G.deadline; E.tick(G, now); timeouts++; continue; }
      for (const t of G.pend.targets.slice()) {
        if (!G.pend || G.pend.resp[t]) continue;
        const cards = E.cpuDefend(G, t);
        const err = E.act(G, t, { t: 'defend', cards }, now);
        if (err) { errors++; if (errors < 5) console.log('def error', err, cards); E.act(G, t, { t: 'defend', cards: [] }, now); }
      }
    }
    G.log.forEach(e => {
      if (e.s <= (G.__seen || 0)) return;
      ev[e.k] = (ev[e.k] || 0) + 1;
      if (e.k === 'declare') (e.cards || [e.card]).concat(e.adds || []).forEach(c => used.add(c));
      if (['item', 'spell', 'summon', 'refine'].includes(e.k) && e.card) used.add(e.card);
      if ((e.k === 'usurp' || e.k === 'sold') && e.item) used.add(e.item);
      if (e.k === 'resolve') e.results.forEach(r => (r.cards || []).forEach(c => used.add(c)));
    });
    G.__seen = G.seq;
    look();
    const c = countCards(G);
    if (c !== TOTAL) throw new Error('card count ' + c + ' != ' + TOTAL + ' seed ' + seed);
    G.players.forEach(p => {
      if (p.hp < 0 || p.hp > 99) throw new Error('hp out of range ' + p.hp);
      const nh = p.hand.filter(h => E.CARD()[h.c].type !== 'spell').length;
      if (nh > 12) throw new Error('hand too big');
      const sp = p.hand.filter(h => E.CARD()[h.c].type === 'spell').map(h => h.c);
      if (new Set(sp).size !== sp.length) throw new Error('same spell twice');
      SPN.sum += sp.length; SPN.n++; SPN.max = Math.max(SPN.max, sp.length);
      if (!p.alive && p.hand.length) throw new Error('dead with hand');
      if (p.alive && p.hp <= 0) throw new Error('alive with 0 hp');
      if (p.mp < 0 || p.gold < 0) throw new Error('negative mp/gold');
      if (p.mp > 99 || p.gold > 999) throw new Error('mp/gold too big');
    });
    if (JSON.stringify(G).length > 250000) throw new Error('state too big');
  }
  return { steps, turns: G.turn, rounds: G.round, over: G.phase === 'over', errors, timeouts, kinds, size: JSON.stringify(G).length, winner: G.winner, G, seen, used,
    heal: G.players.map(p => (healGot[p.pid] ? healGot[p.pid].size : 0)), healShop: healShop.size };
}
const pct = (a, b) => (100 * a / b).toFixed(1) + '%';
if (process.env.MODE === 'heal') {
  // 体力を回復する道具が、1試合で1人あたり何枚手に入るか（手札に入ったか）／棚に並んだか
  const n = Number(process.env.P || 4), games = GAMES || 400;
  let none = 0, total = 0, shop0 = 0, shopSum = 0, players = 0;
  for (let s = 1; s <= games; s++) {
    const r = run(s, n, 0);
    r.heal.forEach(k => { players++; total += k; if (!k) none++; });
    shopSum += r.healShop; if (!r.healShop) shop0++;
  }
  const deck = data.cards.filter(c => c.type === 'item' && c.eff === 'heal').reduce((x, c) => x + c.n, 0);
  const items = data.cards.filter(c => c.type === 'item').reduce((x, c) => x + c.n, 0);
  console.log(JSON.stringify({ 人数: n, 試合: games, 山札の枚数: TOTAL, 道具の枚数: items, 回復の道具の枚数: deck,
    '1人が1枚も手に入れられない割合': pct(none, players), '1人あたり手に入る枚数': (total / players).toFixed(2),
    '棚に1回も並ばない試合': pct(shop0, games), '1試合で棚に並ぶ枚数': (shopSum / games).toFixed(2) }));
  process.exit(0);
}
if (process.env.MODE === 'cards') {
  // 札の出やすさ：1試合のうちに、手札か棚に1回でも出てきたか／使われたか
  const n = Number(process.env.P || 4), games = GAMES || 400;
  const seenC = {}, usedC = {};
  const rounds = [];
  for (let s = 1; s <= games; s++) {
    const r = run(s, n, 0);
    rounds.push(r.rounds);
    r.seen.forEach(c => { seenC[c] = (seenC[c] || 0) + 1; });
    r.used.forEach(c => { usedC[c] = (usedC[c] || 0) + 1; });
  }
  const rows = data.cards.map(c => ({ id: c.id, name: c.name, n: c.n, type: c.type, seen: (seenC[c.id] || 0) / games, used: (usedC[c.id] || 0) / games }));
  rows.sort((a, b) => a.seen - b.seen);
  rounds.sort((a, b) => a - b);
  const byN = {};
  rows.forEach(r => { (byN[r.n] = byN[r.n] || []).push(r); });
  console.log(JSON.stringify({ games, players: n, deck: TOTAL, medianRounds: rounds[Math.floor(rounds.length / 2)],
    byCopies: Object.fromEntries(Object.entries(byN).map(([k, v]) => [k, { kinds: v.length, seenAvg: pct(v.reduce((s, r) => s + r.seen, 0), v.length), seenMin: pct(Math.min(...v.map(r => r.seen)), 1), usedAvg: pct(v.reduce((s, r) => s + r.used, 0), v.length) }])),
    rarest: rows.slice(0, 8).map(r => r.name + ' ' + r.n + '枚 出た' + pct(r.seen, 1) + ' 使われた' + pct(r.used, 1)),
    leastUsed: rows.slice().sort((a, b) => a.used - b.used).slice(0, 12).map(r => r.name + ' 出た' + pct(r.seen, 1) + ' 使われた' + pct(r.used, 1)),
    neverSeen: rows.filter(r => r.seen === 0).map(r => r.name) }, null, 1));
  return;
}
if (process.env.MODE === 'guard') {
  // 式神の強さ：4人個人戦（式神はばらばら）と、1対1の総当たり
  const games = GAMES || 1500;
  const winsBy = {}, playsBy = {};
  for (let s = 1; s <= games; s++) {
    const r = run(s, 4, 0);
    r.G.players.forEach(p => { playsBy[p.guardian] = (playsBy[p.guardian] || 0) + 1; if (p.alive) winsBy[p.guardian] = (winsBy[p.guardian] || 0) + 1; });
  }
  console.log('4人個人戦の勝率（ふつうは25%）:', Object.fromEntries(Object.keys(playsBy).map(g => [g, pct(winsBy[g] || 0, playsBy[g])])));
  const duel = {};
  for (const a of GIDS) for (const b of GIDS) {
    if (a >= b) continue;
    let wa = 0, tot = 0;
    for (let s = 1; s <= (Number(process.env.DUEL) || 200); s++) {
      const r = run(s, 2, 0, i => ((i + s) % 2 ? a : b));
      const w = r.G.players.find(p => p.alive);
      if (w) { tot++; if (w.guardian === a) wa++; }
    }
    duel[a + ' 対 ' + b] = pct(wa, tot);
  }
  console.log('1対1（左の式神の勝率）:', duel);
  // 生き残った人の体力など
  return;
}
const stats = {};
let worst = 0;
for (const n of (process.env.QUICK ? [2, 4, 8] : [2, 3, 4, 6, 8])) for (const teams of (process.env.QUICK ? [0] : [0, 2])) {
  if (teams && n < 4) continue;
  const key = n + (teams ? '人チーム' : '人');
  const res = [];
  for (let s = 1; s <= (process.env.QUICK ? 80 : 150); s++) res.push(run(s, n, teams));
  const turns = res.map(r => r.turns).sort((a, b) => a - b);
  const rounds = res.map(r => r.rounds).sort((a, b) => a - b);
  const notOver = res.filter(r => !r.over).length;
  const errs = res.reduce((s, r) => s + r.errors, 0);
  worst = Math.max(worst, ...res.map(r => r.size));
  const k = {}; res.forEach(r => Object.entries(r.kinds).forEach(([a, b]) => { k[a] = (k[a] || 0) + b; }));
  stats[key] = { 中央のターン数: turns[Math.floor(turns.length / 2)], 中央の巡: rounds[Math.floor(rounds.length / 2)], 最長: turns[turns.length - 1], 終わらない: notOver, エラー: errs, 行動: k };
}
console.log(process.env.QUICK ? Object.entries(stats).map(([k, v]) => k + ': 中央' + v.中央のターン数 + '手(' + v.中央の巡 + '巡) 最長' + v.最長 + ' 終わらない' + v.終わらない + ' err' + v.エラー).join(' / ') : JSON.stringify(stats, null, 1));
console.log('最大の状態サイズ(byte):', worst);
console.log('重ね打ちの割合:', pct(stacks, stackN));
console.log('天の声・呪術の回数:', JSON.stringify(GH));
console.log('術札ゾーンの枚数 平均/最大:', (SPN.sum / Math.max(1, SPN.n)).toFixed(2), SPN.max);
console.log('出来事の回数:', JSON.stringify(ev));
