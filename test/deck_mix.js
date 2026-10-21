// 山札の割合と、実際の合戦での「手札の中身」「守れたか」を測る
//   node test/deck_mix.js            （いまの cards.json）
//   DATA=別の.json node test/deck_mix.js
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/part-engine.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(process.env.DATA || path.join(__dirname, '../src/cards.json'), 'utf8'));
const E = new Function(src + '\nreturn { loadData, newGame, act, tick, cpuChoose, cpuDefend, cpuUsurp, cpuSwap, defOptions, CARD: () => CARD };')();
E.loadData(data);
const LABEL = { weapon: '武器', plus: '追撃', armor: '守札', spell: '術', item: '道具', summon: '召喚' };
const total = data.cards.reduce((s, c) => s + c.n, 0);
const by = {};
data.cards.forEach(c => { by[c.type] = (by[c.type] || 0) + c.n; });
console.log('山札', total, '枚');
Object.keys(LABEL).forEach(t => console.log('  ' + LABEL[t].padEnd(3, '　'), String(by[t] || 0).padStart(4), '枚', ((by[t] || 0) / total * 100).toFixed(1).padStart(5) + '%'));
const itemKinds = {};
data.cards.filter(c => c.type === 'item').forEach(c => { const k = ['heal', 'mp', 'gold'].includes(c.eff) ? c.eff : 'other'; itemKinds[k] = (itemKinds[k] || 0) + c.n; });
console.log('  道具の内わけ', JSON.stringify(itemKinds));

/* CPUどうしの合戦で：番のはじめの手札の中身、攻められたときに守札を出せたか */
const GIDS = data.guardians.map(g => g.id);
const hand = { weapon: 0, armor: 0, item: 0, other: 0, n: 0 };
let attacked = 0, couldDef = 0, elemAtk = 0, elemDef = 0, noWeapon = 0, turns = 0, prays = 0;
for (let seed = 1; seed <= 160; seed++) {
  const np = [2, 4, 6, 8][seed % 4];
  const seats = []; for (let i = 0; i < np; i++) seats.push({ cid: 'c' + i, name: 'P' + i, cpu: true, guardian: GIDS[(seed + i) % GIDS.length], team: seed % 3 === 0 ? i % 2 : undefined });
  let now = 1000;
  const G = E.newGame(seats, { teams: seed % 3 === 0 ? 2 : 0, turnSec: 60, defSec: 20 }, seed * 7919 + 13, now);
  let steps = 0, lastTurn = -1;
  while (G.phase !== 'over' && steps++ < 4000) {
    now += 1000;
    if (G.phase === 'act') {
      const p = G.players[G.cur];
      if (G.turn !== lastTurn) {
        lastTurn = G.turn; turns++;
        p.hand.forEach(h => { const C = E.CARD()[h.c]; if (C.type === 'spell') return; const k = C.type === 'weapon' ? 'weapon' : C.type === 'armor' ? 'armor' : C.type === 'item' ? 'item' : 'other'; hand[k]++; });
        hand.n++;
        if (!p.hand.some(h => E.CARD()[h.c].type === 'weapon')) noWeapon++;
      }
      const a = E.cpuChoose(G, G.cur);
      if (a.t === 'pray') prays++;
      if (E.act(G, G.cur, a, now)) E.act(G, G.cur, { t: 'pray' }, now);
    } else if (G.phase === 'defend') {
      const P = G.pend;
      const dmg = P.kind === 'attack' || P.eff === 'dmg' || P.eff === 'drain';
      P.targets.forEach(t => {
        if (P.resp[t] || !G.players[t].alive) return;
        const T = G.players[t];
        if (dmg && !P.chain) { attacked++; const ok = E.defOptions(G, T).length > 0; if (ok) couldDef++; if (P.elem) { elemAtk++; if (ok) elemDef++; } }
        E.act(G, t, { t: 'defend', cards: E.cpuDefend(G, t) }, now);
      });
      if (G.phase === 'defend') E.tick(G, now + 1e9);
    } else if (G.phase === 'usurp') E.act(G, G.pend.by, { t: 'usurp', buy: E.cpuUsurp(G, G.pend.by) }, now);
    else if (G.phase === 'swap') E.act(G, G.pend.by, { t: 'swap', cards: E.cpuSwap(G, G.pend.by) }, now);
    else E.tick(G, now + 1e9);
  }
}
const f = k => (hand[k] / hand.n).toFixed(1);
console.log('番のはじめの手札（術札をのぞく）平均：武器', f('weapon'), '・守札', f('armor'), '・道具', f('item'), '・そのほか', f('other'));
console.log('武器が1枚もない番', (noWeapon / turns * 100).toFixed(1) + '%　おみくじ（なにもできない）', (prays / turns * 100).toFixed(1) + '%');
console.log('攻められたとき守札を出せた', (couldDef / attacked * 100).toFixed(1) + '%（属性の攻めでは', (elemDef / Math.max(1, elemAtk) * 100).toFixed(1) + '%）');
