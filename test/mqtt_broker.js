// テスト用の小さな中継所（MQTT 3.1.1 over WebSocket の最小限）
//   node test/mqtt_broker.js 8891
//   GET /down?ms=5000 … いまのつながりを全部切って、しばらく受け付けない（中継所が止まったまね）
//   GET /stats        … つながっている数・保持している盤面の数など
// 本物の公開中継所（broker.emqx.io / broker.hivemq.com）と同じ決まりで動くように、
// QoS 0 の PUBLISH・保持メッセージ（retain）・SUBSCRIBE・PING だけを扱う
const http = require('http');
let WS;
try { WS = require('ws'); } catch (_) { WS = require('/opt/npm-tools/node_modules/ws'); }

const port = Number(process.argv[2] || 8891);
const retained = new Map();
const clients = new Set();
let downUntil = 0, published = 0, delivered = 0, maxPacket = 0;

function lenBytes(n) { const out = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; out.push(b); } while (n > 0); return out; }
function packet(first, body) { return Buffer.concat([Buffer.from([first, ...lenBytes(body.length)]), body]); }
function strBuf(s) { const b = Buffer.from(s, 'utf8'); return Buffer.concat([Buffer.from([b.length >> 8, b.length & 255]), b]); }
function match(filter, topic) {
  if (filter === topic || filter === '#') return true;
  const f = filter.split('/'), t = topic.split('/');
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true;
    if (f[i] !== '+' && f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}
function send(c, buf) { try { if (c.ws.readyState === 1) c.ws.send(buf); } catch (_) { /* ignore */ } }
function publishTo(c, topic, payload, retain) { send(c, packet(0x30 | (retain ? 1 : 0), Buffer.concat([strBuf(topic), payload]))); delivered++; }

function handle(c, type, flags, body) {
  if (!c.ok && type !== 1) { c.ws.terminate(); return; }
  if (type === 1) {                                   // CONNECT
    const pl = (body[0] << 8) | body[1];
    const proto = body.slice(2, 2 + pl).toString();
    const level = body[2 + pl];
    if (proto !== 'MQTT' || level !== 4) { send(c, Buffer.from([0x20, 2, 0, 1])); c.ws.close(); return; }
    c.ok = true;
    send(c, Buffer.from([0x20, 2, 0, 0]));
  } else if (type === 8) {                            // SUBSCRIBE
    if (flags !== 2) { c.ws.terminate(); return; }
    const id = body.slice(0, 2);
    let i = 2; const topics = [];
    while (i < body.length) { const l = (body[i] << 8) | body[i + 1]; topics.push(body.slice(i + 2, i + 2 + l).toString()); i += 2 + l + 1; }
    topics.forEach(t => c.subs.add(t));
    send(c, packet(0x90, Buffer.concat([id, Buffer.from(topics.map(() => 0))])));
    topics.forEach(f => retained.forEach((p, t) => { if (match(f, t)) publishTo(c, t, p, true); }));
  } else if (type === 3) {                            // PUBLISH
    const tl = (body[0] << 8) | body[1];
    const topic = body.slice(2, 2 + tl).toString();
    const qos = (flags >> 1) & 3;
    const payload = body.slice(2 + tl + (qos ? 2 : 0));
    published++;
    if (flags & 1) { if (payload.length) retained.set(topic, payload); else retained.delete(topic); }
    clients.forEach(o => { if (o.ok && [...o.subs].some(f => match(f, topic))) publishTo(o, topic, payload, false); });
  } else if (type === 12) {                           // PINGREQ
    send(c, Buffer.from([0xd0, 0]));
  } else if (type === 14) {                           // DISCONNECT
    c.ws.close();
  }
}
function feed(c, chunk) {
  c.buf = Buffer.concat([c.buf, chunk]);
  for (;;) {
    if (c.buf.length < 2) return;
    let len = 0, mul = 1, j = 1, ok = false;
    for (let k = 0; k < 4 && j < c.buf.length; k++, j++) { len += (c.buf[j] & 127) * mul; mul *= 128; if (!(c.buf[j] & 128)) { ok = true; j++; break; } }
    if (!ok || c.buf.length - j < len) return;
    maxPacket = Math.max(maxPacket, len);
    const first = c.buf[0], body = c.buf.slice(j, j + len);
    c.buf = c.buf.slice(j + len);
    handle(c, first >> 4, first & 15, body);
  }
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/down') {
    downUntil = Date.now() + Number(u.searchParams.get('ms') || 5000);
    clients.forEach(c => c.ws.terminate());
    res.end('down');
  } else if (u.pathname === '/stats') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ clients: clients.size, retained: retained.size, published, delivered, maxPacket }));
  } else { res.statusCode = 404; res.end(); }
});
const wss = new WS.WebSocketServer({ server, path: '/mqtt', handleProtocols: protos => (protos.has('mqtt') ? 'mqtt' : false) });
wss.on('connection', ws => {
  if (Date.now() < downUntil) { ws.terminate(); return; }
  const c = { ws, subs: new Set(), buf: Buffer.alloc(0), ok: false };
  clients.add(c);
  ws.on('message', data => { try { feed(c, Buffer.from(data)); } catch (e) { console.error(e); ws.terminate(); } });
  ws.on('close', () => clients.delete(c));
  ws.on('error', () => {});
});
server.listen(port, '127.0.0.1', () => console.log('mqtt broker on', port));
