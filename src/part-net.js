/* =====================================================================
   NET — 部屋（ルーム）の進行役。部屋を作った人の画面が「進行役」になり、
   参加者の操作を受け取ってルールを動かし、盤面をみんなに配る。
   練習モードは同じ進行役を、通信なしで自分の画面の中だけで動かす。
   ===================================================================== */
/* テスト用のつまみ（ふだんは空）：複数の画面を1つのブラウザで別人として動かす・待ち時間を縮める */
const TEST = window.__YAO_TEST || {};
const SPEED = TEST.speed || 1, TAG = TEST.tag || '';
const CID_KEY = 'yao-cid' + TAG, PROFILE_KEY = 'yao-profile' + TAG, LOCAL_ROOM_KEY = 'yao-local-room' + TAG, ONLINE_KEY = 'yao-online' + TAG;
const MAX_SEATS = 8;
const CPU_NAMES = ['権兵衛', 'お菊', '弥助', 'お鶴', '与作', '茂平', 'お梅', '源内', 'お春', '佐吉', 'お蝶', '五郎太'];
const myCid = (() => {
  try {
    let c = localStorage.getItem(CID_KEY);
    if (!c) { c = 'c' + Math.random().toString(36).slice(2, 10); localStorage.setItem(CID_KEY, c); }
    return c;
  } catch (_) { return 'c' + Math.random().toString(36).slice(2, 10); }
})();
const clone = o => JSON.parse(JSON.stringify(o));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } };
const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* ignore */ } };
const ssGet = (k, d) => { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } };
const ssSet = (k, v) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* ignore */ } };

function newRoom(code, mode, profile) {
  return {
    v: 1, code, mode, host: myCid, ver: 1, at: Date.now(), created: Date.now(), phase: 'lobby',
    settings: { teams: 0, turnSec: mode === 'local' ? 0 : 60, defSec: mode === 'local' ? 0 : 20 },
    seats: [{ cid: myCid, name: profile.name, guardian: profile.guardian, team: 0, cpu: false }],
    game: null, closed: false,
  };
}
function pickCpuName(room) {
  const used = new Set(room.seats.map(s => s.name));
  const free = CPU_NAMES.filter(n => !used.has(n));
  return free.length ? free[Math.floor(Math.random() * free.length)] : 'CPU' + room.seats.length;
}

/* ---------- the host (進行役) ---------- */
class Host {
  constructor(room, publish) {
    this.room = room;
    this.publish = publish;
    this.cpuDue = 0; this.cpuKey = '';
    this.defDue = {};
    this.timer = setInterval(() => { try { this.loop(); } catch (e) { console.error(e); } }, 200);
  }
  stop() { clearInterval(this.timer); this.timer = 0; }
  changed() {
    const G = this.room.game;
    if (G) {
      /* 持ち時間は、画面で札を見せている時間のぶんだけのばす（演出のあいだに時間が減らないように） */
      if (G.gid !== this.dlGid) { this.dlGid = G.gid; this.dlSeq = G.seq; this.dlSeen = G.deadline; }
      if (G.deadline && G.deadline !== this.dlSeen && G.phase !== 'over') G.deadline += Math.round(animMs(G, this.dlSeq || 0) * SPEED);
      this.dlSeen = G.deadline; this.dlSeq = G.seq;
    }
    this.room.ver++;
    this.room.at = Date.now();
    this.publish(this.room);
  }
  /* an operation from someone in the room (including the host's own screen) */
  handle(cid, a) {
    const R = this.room;
    if (!a || typeof a !== 'object') return 'bad';
    if (R.phase === 'lobby') return this.lobbyAct(cid, a);
    const G = R.game;
    if (!G) return 'bad';
    if (a.t === 'leave') {
      const p = G.players.find(x => x.cid === cid);
      if (p && !p.cpu && p.alive) { p.cpu = true; p.left = true; logE(G, { k: 'left', p: p.pid }); this.changed(); }
      return null;
    }
    if (a.t === 'rematch') { if (cid !== R.host) return 'bad'; return this.toLobby(); }
    if (a.t === 'join') return null; /* 対戦中は観戦 */
    const p = G.players.find(x => x.cid === cid && !x.cpu);
    if (!p) return 'nosuch';
    const err = act(G, p.pid, a, Date.now());
    if (!err) this.changed();
    return err;
  }
  lobbyAct(cid, a) {
    const R = this.room;
    const isHost = cid === R.host;
    const seat = R.seats.find(s => s.cid === cid && !s.cpu);
    switch (a.t) {
      case 'join': {
        const name = String(a.name || '').trim().slice(0, 8) || '名無し';
        const guardian = GUARD[a.guardian] ? a.guardian : GUARD_LIST[0].id;
        if (seat) { seat.name = name; seat.guardian = guardian; }
        else {
          if (R.seats.length >= MAX_SEATS) return 'full';
          R.seats.push({ cid, name, guardian, team: R.settings.teams ? this.smallTeam() : 0, cpu: false });
        }
        break;
      }
      case 'leave': {
        if (!seat || isHost) return null;
        R.seats.splice(R.seats.indexOf(seat), 1);
        break;
      }
      case 'team': {
        const s = Number.isInteger(a.seat) ? R.seats[a.seat] : seat;
        if (!s || (!isHost && s !== seat) || !R.settings.teams) return 'bad';
        s.team = (s.team + 1) % R.settings.teams;
        break;
      }
      case 'addCpu': {
        if (!isHost || R.seats.length >= MAX_SEATS) return 'bad';
        /* なるべく式神がかぶらないように選ぶ */
        const cnt = id => R.seats.filter(s => s.guardian === id).length;
        const least = Math.min.apply(null, GUARD_LIST.map(x => cnt(x.id)));
        const pool = GUARD_LIST.filter(x => cnt(x.id) === least);
        const g = pool[Math.floor(Math.random() * pool.length)];
        R.seats.push({ cid: 'cpu' + Math.random().toString(36).slice(2, 7), name: pickCpuName(R), guardian: g.id, team: R.settings.teams ? this.smallTeam() : 0, cpu: true });
        break;
      }
      case 'kick': {
        if (!isHost) return 'bad';
        const s = R.seats[a.seat];
        if (!s || s.cid === R.host) return 'bad';
        R.seats.splice(a.seat, 1);
        break;
      }
      case 'settings': {
        if (!isHost) return 'bad';
        if ([0, 2, 3, 4].includes(a.teams)) {
          R.settings.teams = a.teams;
          if (a.teams) R.seats.forEach((s, i) => { s.team = i % a.teams; });
        }
        if ([0, 30, 60, 90].includes(a.turnSec)) { R.settings.turnSec = a.turnSec; R.settings.defSec = a.turnSec ? Math.max(15, Math.round(a.turnSec / 3)) : 0; }
        break;
      }
      case 'start': {
        if (!isHost) return 'bad';
        const err = lobbyProblem(R);
        if (err) return err;
        const seed = (Math.random() * 2147483647) | 0;
        R.game = newGame(R.seats, R.settings, seed, Date.now());
        R.game.gid = 'g' + Math.random().toString(36).slice(2, 8);
        R.phase = 'game';
        this.cpuKey = ''; this.defDue = {};
        break;
      }
      default: return 'bad';
    }
    this.changed();
    return null;
  }
  smallTeam() {
    const R = this.room, n = R.settings.teams, cnt = new Array(n).fill(0);
    R.seats.forEach(s => { if (s.team < n) cnt[s.team]++; });
    return cnt.indexOf(Math.min.apply(null, cnt));
  }
  toLobby() {
    const R = this.room;
    if (R.phase !== 'game') return 'bad';
    /* 抜けた人は待合室から外す */
    const leftCids = new Set((R.game ? R.game.players : []).filter(p => p.left).map(p => p.cid));
    R.seats = R.seats.filter(s => !leftCids.has(s.cid));
    R.phase = 'lobby'; R.game = null;
    this.changed();
    return null;
  }
  loop() {
    const R = this.room, G = R.game;
    if (R.phase !== 'game' || !G || G.phase === 'over') return;
    const now = Date.now();
    /* 画面では札を1枚ずつ見せるので、そのぶんCPUは待つ */
    if (G.seq !== this.animSeq) { this.animWait = animMs(G, this.animSeq || 0) * SPEED; this.animSeq = G.seq; }
    const aw = this.animWait || 0;
    if (tick(G, now)) { this.changed(); return; }
    if (G.phase === 'act') {
      const p = G.players[G.cur];
      if (!p.cpu) return;
      const key = G.turn + ':' + G.seq;
      if (this.cpuKey !== key) { this.cpuKey = key; this.cpuDue = now + (1900 + Math.random() * 1000) * SPEED + aw; return; }
      if (now < this.cpuDue) return;
      let err = act(G, p.pid, cpuChoose(G, p.pid), now);
      if (err) err = act(G, p.pid, { t: 'pray' }, now);
      this.changed();
    } else if (G.phase === 'swap' && G.pend) {
      const p = G.players[G.pend.by];
      if (!p.cpu) return;
      const key = 's' + G.seq;
      if (this.cpuKey !== key) { this.cpuKey = key; this.cpuDue = now + (1800 + Math.random() * 800) * SPEED + aw; return; }
      if (now < this.cpuDue) return;
      if (act(G, p.pid, { t: 'swap', cards: cpuSwap(G, p.pid) }, now)) act(G, p.pid, { t: 'swap', cards: [] }, now);
      this.changed();
    } else if (G.phase === 'usurp' && G.pend) {
      const p = G.players[G.pend.by];
      if (!p.cpu) return;
      const key = 'u' + G.seq;
      if (this.cpuKey !== key) { this.cpuKey = key; this.cpuDue = now + (2200 + Math.random() * 800) * SPEED + aw; return; }
      if (now < this.cpuDue) return;
      if (act(G, p.pid, { t: 'usurp', buy: cpuUsurp(G, p.pid) }, now)) act(G, p.pid, { t: 'usurp', buy: false }, now);
      this.changed();
    } else if (G.phase === 'defend' && G.pend) {
      const P = G.pend;
      let did = false;
      P.targets.forEach((t, i) => {
        const p = G.players[t];
        if (!p.cpu || P.resp[t] || !G.pend) return;
        const key = G.seq + ':' + t;
        const due = this.defDue[key] || (this.defDue[key] = P.at + (1500 + i * 300 + Math.random() * 700) * SPEED + aw);
        if (now < due || !G.pend) return;
        const e = act(G, t, { t: 'defend', cards: cpuDefend(G, t) }, now);
        if (e) act(G, t, { t: 'defend', cards: [] }, now);
        did = true;
      });
      if (did) { this.defDue = {}; this.changed(); }
    }
  }
}
/* 盤面の出来事を画面で見せるのにかかる時間のめやす（札を1枚ずつ並べる・引く分） */
function animMs(G, from) {
  let ms = 0;
  /* まん中で札を見せる時間：1枚ずつ出して（per）、最後の札から after、全体で total 以上 */
  const stage = (n, total, after, per) => Math.max(total, 200 + (per || 450) * n + after);
  for (let i = G.log.length - 1; i >= 0; i--) {
    const e = G.log[i];
    if (e.s <= from) break;
    switch (e.k) {
      case 'refill': ms += 200 * e.n + 120; break;
      case 'declare': ms += stage((e.cards || []).length + (e.adds || []).length, 2800, 1800); break;
      case 'resolve': {
        const R = e.results || [];
        /* 1人ずつ順番に：守りの札を見せて、ダメージを出す */
        R.forEach(x => { const n = (x.cards || []).length; ms += (n ? stage(n, 2600, 1950) : 1800) + (x.how === 'deflect' ? 1500 : 1400); });
        break;
      }
      case 'item': case 'spell': ms += stage(1, 2600, 1750) + 1100; break;
      case 'refine': ms += stage(1, 2600, 1750) + 1100; break;
      case 'sold': ms += stage(2, 2600, 1750) + 1100; break;
      case 'usurp': ms += stage(1, 2600, 1750); break;
      case 'usurped': ms += e.buy ? stage(1, 2200, 1750) + 1000 : 1000; break;
      case 'shop': ms += ((e.sold || []).length || e.bought ? stage(Math.min(5, (e.sold || []).length + (e.bought ? 1 : 0)), 2300, 1750) : 0) + 900; break;
      case 'bounce': case 'stray': ms += stage(2, 2400, 1750); break;
      case 'omikuji': ms += 1950; break;
      case 'swapped': ms += 300 + 200 * (e.got || 0); break;
      case 'fxdraw': ms += 200 * e.n + 250; break;
      case 'curse': ms += 650; break;
      case 'ko': ms += 3600; break;   /* 体力0から2秒＋成仏の演出 */
      case 'hex': ms += 1600 + 200 * (e.got || 0); break;
      case 'weather': ms += e.voice != null ? 1700 : 1300; break;
      case 'assist': ms += 3000; break;   /* 霊獣の絵を2秒見せてから効く */
      case 'summon': ms += 1850; break;
      default: break;
    }
  }
  return Math.min(ms, 24000);
}
function lobbyProblem(R) {
  if (R.seats.length < 2) return '2人以上そろうと始められます（CPUを追加できます）';
  if (R.settings.teams) {
    const used = new Set(R.seats.map(s => s.team));
    if (used.size < 2) return 'チームが1つしかありません。名前の横のチーム札をタップして分けてください';
  }
  return null;
}

/* ---------- connections ---------- */
/* 練習：自分の画面の中だけ */
class LocalNet {
  constructor() { this.mode = 'local'; this.listener = null; this.host = null; }
  start(room, onRoom) {
    this.listener = onRoom;
    this.host = new Host(room, r => { ssSet(LOCAL_ROOM_KEY, r); const c = clone(r); setTimeout(() => this.listener && this.listener(c), 0); });
    this.host.changed();
  }
  send(a) { return Promise.resolve(this.host ? this.host.handle(myCid, a) : 'bad'); }
  close() { if (this.host) this.host.stop(); this.host = null; this.listener = null; ssSet(LOCAL_ROOM_KEY, null); }
}
/* オンライン：Claude のアーティファクトの共有データ（db）を使う */
class DbNet {
  constructor(db, code) {
    this.mode = 'db'; this.db = db; this.code = code;
    this.roomRef = db.doc('rooms/' + code);
    this.acts = db.collection('rooms/' + code + '/acts');
    this.host = null; this.unsubRoom = null; this.unsubActs = null;
    this.writing = false; this.next = null; this.seen = new Set();
    this.onError = null;
  }
  watch(onRoom) {
    this.unsubRoom = this.roomRef.onSnapshot(s => { onRoom(s.exists ? s.data() : null); }, e => { if (this.onError) this.onError(e); });
  }
  /* become the host for `room` (new room, or resuming one we host) */
  hostRoom(room) {
    this.host = new Host(room, r => this.write(r));
    this.unsubActs = this.acts.onSnapshot(snap => {
      const items = [];
      snap.docChanges().forEach(ch => { if (ch.type === 'added' && !this.seen.has(ch.doc.id)) { this.seen.add(ch.doc.id); items.push({ id: ch.doc.id, d: ch.doc.data() }); } });
      items.sort((a, b) => (a.d.t || 0) - (b.d.t || 0));
      const born = (this.host && this.host.room.created) || 0;
      items.forEach(it => {
        /* 部屋ができる前の古い操作（前に同じ番号を使った部屋の残り）は捨てる */
        const stale = born && (it.d.t || 0) < born - 30000;
        if (!stale && this.host && it.d && typeof it.d.cid === 'string') { try { this.host.handle(it.d.cid, it.d.a); } catch (e) { console.error(e); } }
        this.acts.doc(it.id).delete().catch(() => {});
      });
    }, e => { if (this.onError) this.onError(e); });
    this.host.changed();
  }
  write(room) {
    this.next = clone(room);
    if (this.writing) return;
    this.writing = true;
    const go = async () => {
      while (this.next) {
        const r = this.next; this.next = null;
        try { await this.roomRef.set(r); }
        catch (e) {
          if (e && e.code === 'unavailable') { await new Promise(res => setTimeout(res, 400 + Math.random() * 600)); if (!this.next) this.next = r; }
          else if (this.onError) this.onError(e);
        }
      }
      this.writing = false;
    };
    go();
  }
  send(a) {
    if (this.host) return Promise.resolve(this.host.handle(myCid, a));
    return this.acts.add({ cid: myCid, a, t: Date.now() }).then(() => null, e => (e && e.code) || 'net');
  }
  close() {
    if (this.unsubRoom) this.unsubRoom(); if (this.unsubActs) this.unsubActs();
    if (this.host) this.host.stop();
    this.host = null; this.unsubRoom = null; this.unsubActs = null;
  }
}
