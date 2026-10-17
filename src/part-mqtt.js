/* =====================================================================
   合言葉のオンライン対戦（ホーム画面アプリ版）
   だれでも使える無料の「中継所」（MQTTの公開ブローカー）を2か所同時に使う。
   - 合言葉から「部屋の場所（トピック）」と「暗号のかぎ」を作る。合言葉を知らない人には中身が読めない
   - 部屋をつくった人の画面が進行役（Host）。盤面は「s」に置き（中継所が最後の1つを覚えてくれる）、
     参加者の操作は「a」で届き、進行役の生存確認は「p」で流れる
   - 中継所が片方止まっても、もう片方で続く。切れたら自動でつなぎ直す
   ===================================================================== */
const MQTT_BROKERS = TEST.brokers || ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const HOSTED_KEY = 'yao-hosted' + TAG;
const u8enc = new TextEncoder(), u8dec = new TextDecoder();
const hexOf = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

/* 合言葉の書き方のゆれをそろえる：全角半角・大文字小文字・カタカナとひらがな・空白や「-」のあるなし */
function normPass(s) {
  return String(s || '').normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s\-_.・,、。/]+/g, '');
}
const PASS_WORDS = ['さくら', 'もみじ', 'つばき', 'たぬき', 'きつね', 'うさぎ', 'からす', 'かえる', 'だんご', 'おにぎり', 'ちょうちん', 'ふうりん', 'かぶと', 'かたな', 'みこし',
  'こばん', 'はなび', 'まつり', 'おばけ', 'てんぐ', 'かっぱ', 'たいこ', 'ひょうたん', 'まねきねこ', 'だるま', 'こけし', 'おみくじ', 'ほたる', 'すずめ', 'いなり'];
function suggestPass() {
  const p = () => PASS_WORDS[Math.floor(Math.random() * PASS_WORDS.length)];
  let a = p(), b = p(); while (b === a) b = p();
  return a + '-' + b + '-' + (10 + Math.floor(Math.random() * 90));
}
/* 合言葉 → 部屋の場所と暗号のかぎ */
async function roomKeys(pass) {
  if (!(window.crypto && crypto.subtle)) throw Object.assign(new Error('nocrypto'), { code: 'nocrypto' });
  const norm = normPass(pass);
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', u8enc.encode('yaoyoro-room:' + norm)));
  const base = 'yaoyoro/v1/' + hexOf(h).slice(0, 32);
  const km = await crypto.subtle.importKey('raw', u8enc.encode(norm), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: u8enc.encode('yaoyoro-salt-v1'), iterations: 40000, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return { norm, base, key };
}
const canZip = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
async function pipeBytes(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
/* 中身を縮めて（使えれば）暗号にする。先頭1バイト：1＝縮めた */
async function sealMsg(key, obj) {
  let data = u8enc.encode(JSON.stringify(obj)), flag = 0;
  if (canZip && data.length > 600) { try { data = await pipeBytes(data, new CompressionStream('deflate-raw')); flag = 1; } catch (_) { data = u8enc.encode(JSON.stringify(obj)); flag = 0; } }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const out = new Uint8Array(13 + ct.length);
  out[0] = flag; out.set(iv, 1); out.set(ct, 13);
  return out;
}
async function openMsg(key, bytes) {
  if (!bytes || bytes.length < 14) return null;
  const flag = bytes[0];
  let data = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(1, 13) }, key, bytes.slice(13)));
  if (flag & 1) {
    if (!canZip) throw Object.assign(new Error('nozip'), { code: 'nozip' });
    data = await pipeBytes(data, new DecompressionStream('deflate-raw'));
  }
  return JSON.parse(u8dec.decode(data));
}

/* ---------- MQTT 3.1.1 の最小限（QoS 0・保持メッセージ） ---------- */
function mqLen(n) { const out = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; out.push(b); } while (n > 0); return out; }
function mqStr(s) { const b = u8enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; }
function mqPacket(first, body) { const head = [first, ...mqLen(body.length)]; const out = new Uint8Array(head.length + body.length); out.set(head, 0); out.set(body, head.length); return out; }
class MqttConn {
  constructor(url, onMsg, onState) {
    this.url = url; this.onMsg = onMsg; this.onState = onState;
    this.ws = null; this.ok = false; this.connecting = false; this.closed = false;
    this.subs = new Set(); this.buf = new Uint8Array(0); this.pid = 1; this.retry = 0;
    this.retryTimer = 0; this.pingTimer = 0; this.pongDue = 0;
    this.id = 'yy' + Math.random().toString(36).slice(2, 12);
    this.open();
  }
  open() {
    if (this.closed || this.connecting || this.ok) return;
    clearTimeout(this.retryTimer); this.retryTimer = 0;
    this.connecting = true; this.buf = new Uint8Array(0);
    let ws;
    try { ws = new WebSocket(this.url, ['mqtt']); } catch (_) { this.connecting = false; this.later(); return; }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    const giveUp = setTimeout(() => { if (this.ws === ws && !this.ok) { try { ws.close(); } catch (_) { /* ignore */ } } }, 9000);
    ws.onopen = () => {
      /* CONNECT：clean session、keepalive 60秒 */
      const body = [...mqStr('MQTT'), 4, 0x02, 0, 60, ...mqStr(this.id)];
      this.raw(mqPacket(0x10, body));
    };
    ws.onmessage = ev => { if (this.ws === ws) this.feed(new Uint8Array(ev.data)); };
    ws.onclose = () => { clearTimeout(giveUp); if (this.ws === ws) this.down(); };
    ws.onerror = () => { /* onclose が続けて来る */ };
  }
  raw(bytes) { try { if (this.ws && this.ws.readyState === 1) { this.ws.send(bytes); return true; } } catch (_) { /* ignore */ } return false; }
  feed(chunk) {
    const b = new Uint8Array(this.buf.length + chunk.length); b.set(this.buf, 0); b.set(chunk, this.buf.length);
    let i = 0;
    for (;;) {
      if (b.length - i < 2) break;
      let len = 0, mul = 1, j = i + 1, okLen = false;
      for (let k = 0; k < 4 && j < b.length; k++, j++) { len += (b[j] & 127) * mul; mul *= 128; if (!(b[j] & 128)) { okLen = true; j++; break; } }
      if (!okLen || b.length - j < len) break;
      this.handle(b[i] >> 4, b[i] & 15, b.subarray(j, j + len));
      i = j + len;
    }
    this.buf = b.slice(i);
  }
  handle(type, flags, body) {
    if (type === 2) {                        /* CONNACK */
      if (body[1] !== 0) { try { this.ws.close(); } catch (_) { /* ignore */ } return; }
      this.ok = true; this.connecting = false; this.retry = 0;
      this.subs.forEach(t => this.subscribe(t));
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.ping(), 15000);
      this.onState();
    } else if (type === 3) {                 /* PUBLISH */
      const tl = (body[0] << 8) | body[1];
      const topic = u8dec.decode(body.subarray(2, 2 + tl));
      const qos = (flags >> 1) & 3;
      let p = 2 + tl;
      if (qos) { const id = [body[p], body[p + 1]]; p += 2; if (qos === 1) this.raw(new Uint8Array([0x40, 2, ...id])); }
      this.onMsg(topic, body.slice(p), !!(flags & 1));
    } else if (type === 13) {                /* PINGRESP */
      this.pongDue = 0;
    }
  }
  subscribe(topic) {
    const id = this.pid = (this.pid % 65000) + 1;
    this.raw(mqPacket(0x82, [id >> 8, id & 255, ...mqStr(topic), 0]));
  }
  sub(topic) { this.subs.add(topic); if (this.ok) this.subscribe(topic); }
  pub(topic, bytes, retain) {
    if (!this.ok) return false;
    const t = mqStr(topic), body = new Uint8Array(t.length + bytes.length);
    body.set(t, 0); body.set(bytes, t.length);
    return this.raw(mqPacket(0x30 | (retain ? 1 : 0), body));
  }
  /* 生きているか確かめる。返事がなければ切ってつなぎ直す */
  ping(wait) {
    if (!this.ok) return;
    if (this.pongDue && Date.now() > this.pongDue) { try { this.ws.close(); } catch (_) { /* ignore */ } this.down(); return; }
    this.raw(new Uint8Array([0xc0, 0]));
    if (!this.pongDue) this.pongDue = Date.now() + (wait || 10000);
    if (wait) setTimeout(() => { if (this.pongDue && Date.now() >= this.pongDue) { try { this.ws.close(); } catch (_) { /* ignore */ } this.down(); } }, wait + 50);
  }
  down() {
    const was = this.ok;
    this.ok = false; this.connecting = false; this.pongDue = 0;
    clearInterval(this.pingTimer); this.pingTimer = 0;
    if (this.ws) { const w = this.ws; this.ws = null; w.onmessage = w.onclose = w.onopen = null; try { w.close(); } catch (_) { /* ignore */ } }
    if (was) this.onState();
    this.later();
  }
  later() {
    if (this.closed || this.retryTimer) return;
    const ms = Math.min(15000, 600 * Math.pow(2, this.retry++)) + Math.random() * 400;
    this.retryTimer = setTimeout(() => { this.retryTimer = 0; this.open(); }, ms);
  }
  /* 画面にもどってきたとき：すぐにつなぎ直す／生きているか確かめる */
  wake() {
    if (this.closed) return;
    if (this.ok) this.ping(4000);
    else { this.retry = 0; clearTimeout(this.retryTimer); this.retryTimer = 0; this.open(); }
  }
  close() {
    this.closed = true;
    clearTimeout(this.retryTimer); clearInterval(this.pingTimer);
    if (this.ok) this.raw(new Uint8Array([0xe0, 0]));
    const w = this.ws; this.ws = null; this.ok = false;
    if (w) { w.onmessage = w.onclose = w.onopen = null; setTimeout(() => { try { w.close(); } catch (_) { /* ignore */ } }, 50); }
  }
}
/* 中継所を2か所同時に使う */
class MqttBus {
  constructor(onMsg, onState) {
    this.onState = onState;
    this.conns = MQTT_BROKERS.map(u => new MqttConn(u, onMsg, () => this.onState && this.onState(this.up)));
  }
  get up() { return this.conns.filter(c => c.ok).length; }
  sub(t) { this.conns.forEach(c => c.sub(t)); }
  pub(t, bytes, retain) { let n = 0; this.conns.forEach(c => { if (c.pub(t, bytes, retain)) n++; }); return n; }
  wake() { this.conns.forEach(c => c.wake()); }
  close() { this.conns.forEach(c => c.close()); }
  waitUp(ms) {
    return new Promise(res => {
      if (this.up) { res(true); return; }
      const t0 = Date.now();
      const iv = setInterval(() => { if (this.up || Date.now() - t0 > ms) { clearInterval(iv); res(!!this.up); } }, 100);
    });
  }
}

/* ---------- 合言葉の部屋 ---------- */
class MqttNet {
  constructor(pass) {
    this.mode = 'mqtt'; this.pass = String(pass || '').trim();
    this.host = null; this.listener = null; this.onError = null; this.onLink = null;
    this.cur = null; this.lastHost = 0; this.hostPing = 0;
    this.pend = new Map(); this.n = 0; this.done = new Map();
    this.next = null; this.sealing = false; this.flushing = null;
    this.timers = [];
  }
  async init() {
    this.k = await roomKeys(this.pass);
    this.code = this.pass;
    const b = this.k.base;
    this.T = { s: b + '/s', a: b + '/a', p: b + '/p' };
    this.bus = new MqttBus((t, p, r) => this.msg(t, p, r), up => this.link(up));
    this.bus.sub(this.T.s); this.bus.sub(this.T.p);
    /* 届かなかった操作は送り直す。進行役は生存確認を流す */
    this.timers.push(setInterval(() => this.tick(), 1000));
    return this;
  }
  link(up) {
    if (up && this.host) this.republish();      /* つなぎ直したら、最新の盤面を置き直す */
    if (up) this.pend.forEach(it => this.sendAct(it));
    if (this.onLink) this.onLink(up);
  }
  get up() { return this.bus ? this.bus.up : 0; }
  async msg(topic, bytes, retained) {
    if (!bytes.length) { if (topic === this.T.s && !this.host) this.gotRoom(null); return; }
    let m;
    try { m = await openMsg(this.k.key, bytes); }
    catch (e) { if (e && e.code === 'nozip' && this.onError) this.onError(e); return; }
    if (!m) return;
    if (topic === this.T.s) { if (!this.host) this.gotRoom(m); else if (!retained) this.rival(m); }
    else if (topic === this.T.p) { if (m.k === 'host' && (!this.host || m.cid !== myCid)) { this.hostPing = Date.now(); this.lastHost = Date.now(); } }
    else if (topic === this.T.a && this.host) this.gotAct(m);
  }
  /* 進行役なのに、同じ合言葉で別の部屋の盤面が「いま」流れてきた（ほぼ同時に2人が部屋をつくったとき）。
     先にできた部屋を残す：こちらが後なら身を引き、こちらが先なら自分の盤面を置き直す。
     （中継所が覚えていた古い盤面＝retained は、ここには来ない） */
  rival(r) {
    const mine = this.host && this.host.room;
    if (!mine || !r || r.closed || !r.created || r.created === mine.created) return;
    if (r.created < mine.created) {
      this.host.stop(); this.host = null;
      const saved = lsGet(HOSTED_KEY, null);
      if (saved && saved.norm === this.k.norm) lsSet(HOSTED_KEY, null);
      if (this.onError) this.onError({ code: 'taken' });
    } else {
      clearTimeout(this.reclaim);
      this.reclaim = setTimeout(() => this.republish(), 300);
    }
  }
  gotRoom(r) {
    if (!r) return;
    const c = this.cur;
    if (c && r.created === c.created && r.ver <= c.ver) return;     /* 古い盤面（もう1か所の中継所から遅れて来たもの）は捨てる */
    this.cur = r; this.lastHost = Date.now();
    const L = (r.acks && r.acks[myCid]) || [];
    L.forEach(x => { const it = this.pend.get(x.id); if (it) { this.pend.delete(x.id); it.res(x.err || null); } });
    if (this.listener) this.listener(clone(r));
  }
  watch(onRoom) { this.listener = onRoom; if (this.cur && !this.host) { const c = clone(this.cur); setTimeout(() => { if (this.listener === onRoom && !this.host) onRoom(c); }, 0); } }
  /* 合言葉の部屋がいまあるか、進行役が起きているかを確かめる */
  async probe(ms) {
    const t0 = Date.now();
    this.hostPing = 0;
    const ask = () => sealMsg(this.k.key, { k: 'probe', cid: myCid, t: Date.now() }).then(b => this.bus.pub(this.T.a, b, false));
    await ask();
    await new Promise(res => {
      const iv = setInterval(() => {
        const el = Date.now() - t0;
        if ((this.cur && this.hostPing) || el > ms || (!this.cur && el > ms * 0.6)) { clearInterval(iv); res(); }
      }, 100);
    });
    return { room: this.cur ? clone(this.cur) : null, alive: !!this.hostPing };
  }
  /* ---------- 進行役 ---------- */
  hostRoom(room) {
    const h = this.host = new Host(room, r => { if (this.host === h) this.publish(r); });
    this.bus.sub(this.T.a);
    this.timers.push(setInterval(() => this.beat(), 10000));
    this.beat();
    this.host.changed();
  }
  beat() { if (this.host) sealMsg(this.k.key, { k: 'host', cid: myCid, ver: this.host.room.ver, t: Date.now() }).then(b => this.bus.pub(this.T.p, b, false)); }
  publish(r) {
    this.cur = clone(r);
    if (this.listener) { const c = clone(r); setTimeout(() => this.listener && this.listener(c), 0); }
    this.next = clone(r);
    this.pump();
    this.saveLater();
  }
  republish() { if (this.host) { this.next = clone(this.host.room); this.pump(); this.beat(); } }
  pump() {
    if (this.sealing) return;
    this.sealing = true;
    this.flushing = (async () => {
      while (this.next) {
        /* 続けざまに変わったときは、0.15秒ごとにまとめて送る（無料の中継所に負担をかけすぎない） */
        const wait = 150 - (Date.now() - (this.lastPub || 0));
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        const r = this.next; this.next = null;
        if (!r) break;
        try { const b = await sealMsg(this.k.key, r); this.bus.pub(this.T.s, b, true); this.lastPub = Date.now(); } catch (e) { console.error(e); }
      }
      this.sealing = false;
    })();
  }
  /* 進行役の手元にも盤面を残しておく（中継所が忘れても、ここから再開できる） */
  saveLater() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => { this.saveTimer = 0; if (this.host) lsSet(HOSTED_KEY, { norm: this.k.norm, room: this.host.room }); }, 800);
  }
  gotAct(m) {
    if (m.k === 'probe') { this.beat(); return; }
    if (m.k !== 'act' || typeof m.cid !== 'string' || !m.id) return;
    const seen = this.done.get(m.id);
    if (seen) { if (Date.now() - seen > 1500) { this.done.set(m.id, Date.now()); this.host.changed(); } return; }   /* 同じ操作が2か所から届く／送り直し */
    this.done.set(m.id, Date.now());
    if (this.done.size > 400) { const old = [...this.done.keys()].slice(0, 200); old.forEach(k => this.done.delete(k)); }
    this.handleAct(m.cid, m.a, m.id);
  }
  handleAct(cid, a, id) {
    const R = this.host.room;
    const ack = err => { R.acks = R.acks || {}; const L = (R.acks[cid] || []).filter(x => x.id !== id); L.push({ id, err: err || null }); R.acks[cid] = L.slice(-6); };
    if (id) ack(null);
    const v0 = R.ver;
    let err = null;
    try { err = this.host.handle(cid, a); } catch (e) { console.error(e); err = 'bad'; }
    if (id && (err || R.ver === v0)) { if (err) ack(err); this.host.changed(); }
    return err;
  }
  /* ---------- 参加者 ---------- */
  send(a) {
    if (this.host) return Promise.resolve(this.handleAct(myCid, a, null));
    const id = myCid + '.' + (++this.n) + '.' + Date.now().toString(36);
    return new Promise(res => { const it = { id, a, res, at: Date.now(), last: 0, tries: 0 }; this.pend.set(id, it); this.sendAct(it); });
  }
  sendAct(it) {
    it.tries++; it.last = Date.now();
    sealMsg(this.k.key, { k: 'act', cid: myCid, id: it.id, a: it.a, t: Date.now() }).then(b => this.bus.pub(this.T.a, b, false)).catch(() => {});
  }
  tick() {
    const now = Date.now();
    this.pend.forEach(it => {
      if (now - it.at > 20000) { this.pend.delete(it.id); it.res('net'); }
      else if (now - it.last > 3000 && this.up) this.sendAct(it);
    });
  }
  /* 進行役から最後に便りがあってからの時間（ミリ秒） */
  hostSilence() { return this.host ? 0 : (this.lastHost ? Date.now() - this.lastHost : 0); }
  wake() { if (this.bus) this.bus.wake(); if (this.host) setTimeout(() => this.republish(), 600); }
  async close() {
    this.timers.forEach(t => clearInterval(t)); this.timers = [];
    if (this.host) { this.host.stop(); }
    this.listener = null;
    try { await Promise.race([this.flushing || Promise.resolve(), new Promise(r => setTimeout(r, 1200))]); } catch (_) { /* ignore */ }
    setTimeout(() => { if (this.bus) this.bus.close(); }, 150);
  }
}
