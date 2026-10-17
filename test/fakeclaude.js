// テスト用：Claude の共有データ（db）のまねをする。同じブラウザの中の複数の画面で
// localStorage と BroadcastChannel を通してデータを共有する。少し遅れて届くようにしてある。
(() => {
  const KEY = 'fakedb:';
  const ch = new BroadcastChannel('fakedb');
  const subs = new Set();
  const delay = () => 40 + Math.random() * 120;
  const read = p => { try { const v = localStorage.getItem(KEY + p); return v == null ? undefined : JSON.parse(v); } catch (_) { return undefined; } };
  const keys = () => Object.keys(localStorage).filter(k => k.startsWith(KEY)).map(k => k.slice(KEY.length));
  const snapDoc = (path, data) => Object.freeze({ id: path.split('/').pop(), exists: data !== undefined, data: () => (data === undefined ? undefined : JSON.parse(JSON.stringify(data))), metadata: { fromCache: false, hasPendingWrites: false } });
  const changed = path => { subs.forEach(s => s.check(path)); };
  ch.onmessage = ev => { setTimeout(() => changed(ev.data), delay()); };
  const bump = path => { ch.postMessage(path); setTimeout(() => changed(path), 5); };
  const segs = p => p.split('/').length;
  function docRef(path) {
    if (segs(path) % 2) throw new TypeError('doc path needs even segments: ' + path);
    return {
      id: path.split('/').pop(), path,
      get: () => new Promise(r => setTimeout(() => r(snapDoc(path, read(path))), delay())),
      set: data => new Promise(r => setTimeout(() => { localStorage.setItem(KEY + path, JSON.stringify(data)); bump(path); r(); }, delay())),
      update: data => new Promise((r, j) => setTimeout(() => { const cur = read(path); if (!cur) { j({ code: 'invalid_argument', message: 'missing' }); return; } localStorage.setItem(KEY + path, JSON.stringify(Object.assign(cur, data))); bump(path); r(); }, delay())),
      delete: () => new Promise(r => setTimeout(() => { localStorage.removeItem(KEY + path); bump(path); r(); }, delay())),
      onSnapshot(next) {
        let last = '__none__';
        const s = { check(p) { if (p !== path) return; const d = read(path); const j = JSON.stringify(d); if (j === last) return; last = j; next(snapDoc(path, d)); } };
        subs.add(s);
        setTimeout(() => s.check(path), delay());
        return () => subs.delete(s);
      },
      collection: sub => colRef(path + '/' + sub),
    };
  }
  function colRef(path) {
    if (segs(path) % 2 === 0) throw new TypeError('collection path needs odd segments: ' + path);
    const inCol = k => k.startsWith(path + '/') && segs(k) === segs(path) + 1;
    const list = () => keys().filter(inCol).sort().map(k => snapDoc(k, read(k)));
    const q = {
      path,
      doc: id => docRef(path + '/' + (id || Math.random().toString(36).slice(2, 12))),
      add(data) { const ref = q.doc(); return ref.set(data).then(() => ref); },
      where() { return q; }, orderBy() { return q; }, limit() { return q; },
      get: () => new Promise(r => setTimeout(() => { const docs = list(); r({ docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map((d, i) => ({ type: 'added', doc: d, oldIndex: -1, newIndex: i })), metadata: {} }); }, delay())),
      onSnapshot(next) {
        let prev = new Map();
        const s = {
          check(p) {
            if (p !== '*' && !inCol(p)) return;
            const docs = list();
            const now = new Map(docs.map(d => [d.id, JSON.stringify(d.data())]));
            const changes = [];
            docs.forEach((d, i) => { if (!prev.has(d.id)) changes.push({ type: 'added', doc: d, oldIndex: -1, newIndex: i }); else if (prev.get(d.id) !== now.get(d.id)) changes.push({ type: 'modified', doc: d, oldIndex: i, newIndex: i }); });
            prev.forEach((v, id) => { if (!now.has(id)) changes.push({ type: 'removed', doc: snapDoc(path + '/' + id, JSON.parse(v)), oldIndex: 0, newIndex: -1 }); });
            prev = now;
            if (!changes.length && p !== '*') return;
            next({ docs, size: docs.length, empty: !docs.length, docChanges: () => changes, metadata: { fromCache: false, hasPendingWrites: false } });
          },
        };
        subs.add(s);
        setTimeout(() => s.check('*'), delay());
        return () => subs.delete(s);
      },
    };
    return q;
  }
  const db = Object.freeze({ doc: docRef, collection: colRef });
  const user = Object.freeze({ can: async () => true, isOwner: async () => true, canEdit: async () => true, id: async () => 'u' + ((window.__YAO_TEST || {}).tag || '') });
  window.claude = { use: name => new Promise(r => setTimeout(() => r(name === 'db' ? db : name === 'user' ? user : null), 50)) };
})();
