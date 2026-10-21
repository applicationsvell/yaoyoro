// 「札はだれにでも使える」「春一番は味方にも当たる」「ハプニング」のルールを1つずつ確かめる
//   node test/rules_chaos.js
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/part-engine.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/cards.json'), 'utf8'));
const E = new Function(src + '\nreturn { loadData, newGame, act, tick, targetsFor, randomTarget, whyNot, happening, aimOf, cpuChoose, defOptions, CARD: () => CARD, HAPPENINGS };')();
E.loadData(data);
let bad = 0, ok = 0;
const check = (cond, msg) => { if (cond) ok++; else { bad++; console.log('  ×', msg); } };

/* 4人・2チーム（0と2が紅、1と3が白）。p0の番から */
function game(opts) {
  opts = opts || {};
  const seats = [0, 1, 2, 3].map(i => ({ cid: 'c' + i, name: 'P' + i, guardian: (opts.guards || [])[i] || 'gama', team: i % 2 }));
  const G = E.newGame(seats, Object.assign({ teams: 2, turnSec: 0, defSec: 0 }, opts.settings || {}), opts.seed || 5, 1000);
  /* 席の順をそろえる（newGame は席をまぜるので、pid の順にチームを決め直す） */
  G.players.forEach(p => { p.team = p.pid % 2; p.hp = 30; p.mp = 30; p.gold = 30; p.st = { curse: 0, seal: 0, mist: 0, kiai: 0, boost: 0, shell: 0 }; p.beast = null; });
  G.cur = 0; G.phase = 'act'; G.pend = null; G.weather = 'nagi';
  return G;
}
const give = (G, pid, id) => { const h = { u: G.uid++, c: id }; G.players[pid].hand.push(h); return h.u; };
const last = (G, k) => G.log.slice().reverse().find(e => e.k === k);

console.log('== 札はだれにでも使える');
{
  const G = game();
  const u = give(G, 0, 'onigiri');
  G.players[2].hp = 10;
  check(!E.act(G, 0, { t: 'item', i: u, to: 2 }, 2000), 'おにぎりを味方に使えない');
  check(G.players[2].hp === 15, '味方の体力が回復していない ' + G.players[2].hp);
  check(last(G, 'item').to === 2, '道具の記録に相手がない');
}
{
  const G = game();
  const u = give(G, 0, 'dango');
  G.players[1].hp = 10;
  check(!E.act(G, 0, { t: 'item', i: u, to: 1 }, 2000), '団子を相手に使えない');
  check(G.players[1].hp === 20, '相手の体力が回復していない');
}
{
  const G = game();
  const u = give(G, 0, 'onigiri');
  G.players[0].hp = 10;
  check(!E.act(G, 0, { t: 'item', i: u }, 2000) && G.players[0].hp === 15, '相手をえらばないと自分に使われない');
}
{
  const G = game();
  const u = give(G, 0, 'katana');
  check(!E.act(G, 0, { t: 'attack', ws: [u], adds: [], to: 2 }, 2000), '味方を攻められない');
  check(G.pend && G.pend.targets[0] === 2 || (G.pend && G.pend.slip != null), '味方への攻めになっていない');
}
{
  const G = game();
  const u = give(G, 0, 'katana');
  check(E.act(G, 0, { t: 'attack', ws: [u], adds: [], to: 0 }, 2000) === 'target', '自分を攻められてしまう');
}
{
  const G = game();
  G.players[1].st.mist = 1;
  const u = give(G, 0, 'onigiri');
  check(E.act(G, 0, { t: 'item', i: u, to: 1 }, 2000) === 'target', '霧隠れの人に道具が使えてしまう');
}
{
  const G = game();
  const s = give(G, 0, 'iyashi');
  G.players[3].hp = 5;
  check(!E.act(G, 0, { t: 'spell', s, to: 3 }, 2000) && G.players[3].hp === 12, '癒しの舞を相手に使えない');
}
{
  const G = game();
  const s = give(G, 0, 'kirigakure');
  check(!E.act(G, 0, { t: 'spell', s, to: 2 }, 2000) && G.players[2].st.mist === 1, '霧隠れを味方にかけられない');
}
{
  const G = game();
  const s = give(G, 0, 'noroi');
  check(!E.act(G, 0, { t: 'spell', s, to: 2 }, 2000) && G.pend && G.pend.targets[0] === 2, '呪いを味方にかけられない');
}
{
  const G = game();
  const u = give(G, 0, 'shokan');
  check(!E.act(G, 0, { t: 'summon', s: u, to: 2 }, 2000) && G.players[2].beast && !G.players[0].beast, '霊獣を味方につけられない');
  check(last(G, 'summon').to === 2, '召喚の記録に相手がない');
}
{
  const G = game({ guards: ['ryujin', 'gama', 'gama', 'ryujin'] });
  ['ryujin', 'gama', 'gama', 'ryujin'].forEach((g, i) => { G.players[i].guardian = g; });
  const u = give(G, 0, 'shokan');
  check(E.act(G, 0, { t: 'summon', s: u }, 2000) === 'nosummon', '龍神が自分に霊獣をつけられてしまう');
  check(E.act(G, 0, { t: 'summon', s: u, to: 3 }, 2000) === 'nosummon', '龍神に霊獣をつけられてしまう');
  check(!E.act(G, 0, { t: 'summon', s: u, to: 2 }, 2000) && G.players[2].beast, '龍神が味方に霊獣をつけられない');
}
{
  const G = game();
  G.players[2].beast = 'seiryu';
  const u = give(G, 0, 'jobutsu');
  check(!E.act(G, 0, { t: 'item', i: u, to: 2 }, 2000), '成仏札を味方の霊獣に使えない');
}
{
  const G = game();
  const u = give(G, 0, 'seiren');
  check(E.aimOf(E.CARD()['seiren']) === 'none', '精錬札は自分だけのはず');
  check(!E.act(G, 0, { t: 'item', i: u, d: { hp: 5, mp: -5, gold: 0 } }, 2000), '精錬札が使えない');
}

console.log('== 春一番は味方にも当たる');
{
  const hit = new Set();
  for (let s = 1; s <= 80; s++) {
    const G = game({ seed: s, settings: { chaos: 0 } });
    G.weather = 'haru';
    const u = give(G, 0, 'katana');
    E.act(G, 0, { t: 'attack', ws: [u], adds: [], to: 1 }, 2000);
    if (G.pend) hit.add(G.pend.targets[0]);
  }
  check(hit.has(2), '春一番で味方（P2）に当たらない ' + [...hit]);
  check(hit.has(1) && hit.has(3), '春一番で相手に当たらない ' + [...hit]);
  check(!hit.has(0), '春一番で自分に当たった');
}

console.log('== すっぽ抜け・会心の一撃');
{
  let slip = 0, crit = 0, slipAlly = 0;
  const N = 2000;
  for (let s = 1; s <= N; s++) {
    const G = game({ seed: s, settings: { chaos: 1 } });
    G.rng = s * 7 + 1;
    const u = give(G, 0, 'katana');
    E.act(G, 0, { t: 'attack', ws: [u], adds: [], to: 1 }, 2000);
    const d = last(G, 'declare');
    if (d.slip != null) { slip++; if (d.targets[0] === 2) slipAlly++; check(d.targets[0] !== 1 && d.targets[0] !== 0, 'すっぽ抜けの先がおかしい'); }
    if (d.crit) { crit++; check(d.base === 14, '会心の一撃で2倍になっていない ' + d.base); }
  }
  console.log('  すっぽ抜け', (slip / N * 100).toFixed(1) + '%（味方へ ' + slipAlly + '）　会心', (crit / N * 100).toFixed(1) + '%');
  check(slip > N * 0.03 && slip < N * 0.08, 'すっぽ抜けの割合がおかしい');
  check(crit > N * 0.04 && crit < N * 0.09, '会心の割合がおかしい');
  check(slipAlly > 0, 'すっぽ抜けが味方に当たらない');
  let none = 0;
  for (let s = 1; s <= 400; s++) {
    const G = game({ seed: s, settings: { chaos: 0 } });
    const u = give(G, 0, 'katana');
    E.act(G, 0, { t: 'attack', ws: [u], adds: [], to: 1 }, 2000);
    const d = last(G, 'declare'); if (d.slip != null || d.crit) none++;
  }
  check(none === 0, 'ハプニング「なし」なのにすっぽ抜け・会心が起きた');
}

console.log('== 暴れ独楽・狸の化け葉・福笑い');
{
  const hit = new Set();
  for (let s = 1; s <= 60; s++) {
    const G = game({ seed: s, settings: { chaos: 0 } });
    const u = give(G, 0, 'abaregoma');
    E.act(G, 0, { t: 'attack', ws: [u], adds: [] }, 2000);
    if (G.pend) hit.add(G.pend.targets[0]);
  }
  check(hit.size === 3 && !hit.has(0), '暴れ独楽が自分以外の全員に散らばらない ' + [...hit]);
}
{
  const G = game();
  G.players[0].hp = 4; G.players[1].hp = 40;
  const u = give(G, 0, 'bakeha');
  check(!E.act(G, 0, { t: 'item', i: u, to: 1 }, 2000) && G.players[0].hp === 40 && G.players[1].hp === 4, '狸の化け葉で体力が入れかわらない');
}
{
  const G = game();
  const before = G.players.map(p => p.hand.filter(h => E.CARD()[h.c].type !== 'spell').length);
  const all = G.players.reduce((n, p) => n + p.hand.length, 0);
  const u = give(G, 0, 'fukuwarai');
  check(!E.act(G, 0, { t: 'item', i: u }, 2000), '福笑いが使えない');
  const e = last(G, 'fukuwarai');
  const after = G.players.map(p => (e.deal[p.pid] || []).length);
  check(JSON.stringify(before) === JSON.stringify(after), '福笑いのあとの枚数がちがう ' + before + ' / ' + after);
  check(G.players.reduce((n, p) => n + p.hand.length, 0) >= all, '福笑いで札がへった');
}
{
  const G = game({ settings: { chaos: 0 } });
  check(!G.deck.concat(G.players.flatMap(p => p.hand.map(h => h.c))).some(c => E.CARD()[c].chaos), 'ハプニング「なし」でハプニング札が入っている');
  const H = game({ settings: { chaos: 1 } });
  check(H.deck.concat(H.players.flatMap(p => p.hand.map(h => h.c))).some(c => E.CARD()[c].chaos), 'ハプニング札が山札にない');
}

console.log('== 巡のはじめのハプニング');
E.HAPPENINGS.forEach(H => {
  const G = game();
  G.players[0].gold = 50; G.players[1].gold = 2; G.players[2].beast = 'kirin';
  G.players[1].hp = 12;
  const hp0 = G.players.map(p => p.hp), cards0 = G.players.reduce((n, p) => n + p.hand.length, 0) + G.deck.length + G.discard.length + G.shop.length;
  const e = E.happening(G, H.id);
  check(e && e.k === 'happen' && e.id === H.id, H.name + 'が起きない');
  if (!e) return;
  const cards1 = G.players.reduce((n, p) => n + p.hand.length, 0) + G.deck.length + G.discard.length + G.shop.length;
  check(cards0 === cards1, H.name + 'で札の数がずれた');
  check(G.players.every(p => p.hp >= 1), H.name + 'で体力が0になった');
  if (H.id === 'jishin') check(G.players.every((p, i) => p.hp === hp0[i] - 3), '地震で全員−3になっていない');
  if (H.id === 'matsuri') check(G.players.every((p, i) => p.hp === hp0[i] + 5), 'お祭りで全員＋5になっていない');
  if (H.id === 'nezumi') check(G.players[0].gold === 35 && G.players[1].gold === 17, 'ねずみ小僧の小判がおかしい ' + G.players.map(p => p.gold));
  if (H.id === 'iede') check(G.players[3].beast === 'kirin' && !G.players[2].beast, '霊獣の家出でとなりへ行かない');
  if (H.id === 'irekawari') check(G.players.map(p => p.hp).sort().join() === hp0.slice().sort().join(), '魂の入れかわりで体力の組がおかしい');
});
{
  let n = 0;
  for (let s = 1; s <= 1000; s++) { const G = game({ seed: s }); G.rng = s * 13 + 7; if (E.happening(G)) n++; }
  console.log('  ふつうで起きる割合', (n / 10).toFixed(1) + '%');
  check(n > 280 && n < 420, 'ふつうのハプニングの割合がおかしい');
  let z = 0;
  for (let s = 1; s <= 300; s++) { const G = game({ seed: s, settings: { chaos: 0 } }); if (E.happening(G)) z++; }
  check(z === 0, 'ハプニング「なし」なのに起きた');
}

console.log('== CPU：味方を回復する・味方を攻めない');
{
  let heal = 0, ff = 0;
  for (let s = 1; s <= 200; s++) {
    const G = game({ seed: s });
    G.players[0].hand = [];
    give(G, 0, 'sento'); give(G, 0, 'katana');
    G.players[2].hp = 6;
    const a = E.cpuChoose(G, 0);
    if (a.t === 'item' && a.to === 2) heal++;
    if (a.t === 'attack' && a.to === 2) ff++;
  }
  check(heal > 100, 'CPUが弱った味方を回復しない ' + heal);
  check(ff === 0, 'CPUが味方を攻めた');
}

console.log('== 追撃札を足すと属性なし');
{
  const G = game({ settings: { chaos: 0 } });
  ['kitsune', 'gama', 'gama', 'gama'].forEach((g, i) => { G.players[i].guardian = g; });
  const w = give(G, 0, 'hiya'), k = give(G, 0, 'kiai');
  check(!E.act(G, 0, { t: 'attack', ws: [w], adds: [k], to: 1 }, 2000), '火矢＋気合で攻められない');
  const d = last(G, 'declare');
  check(d.elem === null, '追撃札を足しても属性が残っている: ' + d.elem);
  /* 九尾の狐の火の力（＋5）は乗らない。式神の力＋3だけ：4＋3＋3＝10 */
  check(d.base === 10, '属性なしなのに火の力が乗っている: ' + d.base);
  const a = give(G, 1, 'domaru');
  check(E.defOptions(G, G.players[1]).some(h => h.u === a), '属性なしになったのに、ふつうの守札で守れない');
}
{
  const G = game({ settings: { chaos: 0 } });
  const w = give(G, 0, 'hiya');
  E.act(G, 0, { t: 'attack', ws: [w], adds: [], to: 1 }, 2000);
  check(last(G, 'declare').elem === '火', '追撃札なしの火矢が火の攻めになっていない');
  const a = give(G, 1, 'domaru');
  check(!E.defOptions(G, G.players[1]).some(h => h.u === a), '火の攻めを、ふつうの守札で守れてしまう');
}
{
  const G = game({ settings: { chaos: 0 } });
  const w1 = give(G, 0, 'hiya'), w2 = give(G, 0, 'homura'), k = give(G, 0, 'toishi');
  check(!E.act(G, 0, { t: 'attack', ws: [w1, w2], adds: [k], to: 1 }, 2000) && last(G, 'declare').elem === null, '重ね打ち＋追撃札で属性が残っている');
}

console.log('\n==== 問題', bad, '件（確かめた数', ok + bad, '）');
process.exit(bad ? 1 : 0);
