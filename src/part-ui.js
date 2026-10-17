/* =====================================================================
   SCREENS — タイトル／名前と式神／待合室／対戦／結果／遊び方
   ===================================================================== */
let DB = null, USER = null, onlineState = 'checking';
/* ホーム画面アプリ版（GitHub Pages）のときは true。いまは練習だけ遊べる */
const APP_MODE = !!window.APP_MODE;
let net = null, room = null, shown = null, screen = 'title';
let profile = lsGet(PROFILE_KEY, null);
let afterProfile = null, profDraft = null;
let skew = 0, wasSeated = false, wakeLock = null, stallWarned = 0, lastTickSec = -1;
const guardAt = { act: 0, res: 0 };
const ui = { sel: null, ws: [], adds: [], target: null, sending: false, sentVer: 0, sendAt: 0, key: '', def: [], shop: false, buy: -1, sell: [], ware: null, ref: { hp: 0, mp: 0, gold: 0 }, look: null, centerKey: '' };
const pres = { q: [], busy: false, seq: 0, gid: null, resultFor: null, startFor: null };
const SCREENS = { title: 'scrTitle', profile: 'scrProfile', lobby: 'scrLobby', game: 'scrGame', result: 'scrResult' };

function showScreen(name) {
  if (screen !== name) { $('fx').innerHTML = ''; $('telop').innerHTML = ''; }
  screen = name;
  Object.entries(SCREENS).forEach(([k, id]) => { $(id).hidden = k !== name; });
  if (name !== 'game') closeOv('ovMenu');
  sceneBGM();
  if (name === 'game') keepAwake(); else releaseAwake();
}
function openOv(id) { $(id).hidden = false; if (id === 'ovHow') $('shell').classList.add('covered'); }
function closeOv(id) { const el = $(id); if (el) el.hidden = true; if (id === 'ovHow') $('shell').classList.remove('covered'); }
function sceneBGM() {
  if (screen === 'game' && shown && shown.game) {
    const me = mePlayer(shown);
    BGM.play(me && me.alive && me.hp <= Math.ceil(me.hp0 * 0.3) ? 'pinch' : 'battle');
  } else if (screen === 'result') BGM.play('result');
  else BGM.play('menu');
}
async function keepAwake() { try { if (!wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (_) { wakeLock = null; } }
function releaseAwake() { try { if (wakeLock) wakeLock.release(); } catch (_) { /* ignore */ } wakeLock = null; }

/* ---------- who am I in this room ---------- */
function mePlayer(r) {
  const G = r && r.game; if (!G) return null;
  return G.players.find(p => p.cid === myCid && !p.left) || null;
}
const isHost = () => !!(net && (net.mode === 'local' || net.host));
const pname = (G, pid) => (G.players[pid] ? G.players[pid].name : '？');

/* =====================================================================
   TITLE
   ===================================================================== */
function renderTitle() {
  $('titleFive').innerHTML = ELEMS.map(e => '<li class="el-' + e + '">' + crestSVG(e) + '<span>' + e + '</span></li>').join('');
  const g = profile && GUARD[profile.guardian];
  $('profBtn').innerHTML = profile && g
    ? embHTML(g.id, 40) + '<span><span class="pn">' + esc(profile.name) + '</span><br><span class="ps">' + esc(g.name) + '　' + esc(g.skill) + '</span></span><span class="chg">変える</span>'
    : embHTML(GUARD_LIST[0].id, 40) + '<span><span class="pn">名前と式神をえらぶ</span><br><span class="ps">はじめに1回だけ</span></span><span class="chg">えらぶ</span>';
  const ok = onlineState === 'ok';
  $('btnCreate').disabled = !ok; $('btnJoin').disabled = !ok;
  const note = $('onlineNote');
  note.hidden = ok;
  note.textContent = onlineState === 'checking' ? 'オンライン対戦の準備をしています…'
    : onlineState === 'readonly' ? 'この開き方ではオンライン対戦の部屋に書き込めません。作った人に「編集できる」権限で招待してもらうと遊べます。ひとりで練習はいつでもできます。'
      : APP_MODE ? 'オンライン対戦は準備中です。いまは「ひとりで練習」でCPUと対戦できます。'
        : 'オンライン対戦は、Claudeにログインしてこのページを開いたときに使えます。いまは、ひとりで練習（CPUと対戦）ができます。';
  const local = ssGet(LOCAL_ROOM_KEY, null);
  const online = ok ? lsGet(ONLINE_KEY, null) : null;
  const rb = $('btnResume');
  if (local && local.game && local.game.phase !== 'over') { rb.hidden = false; rb.textContent = '練習の続きから'; rb.dataset.kind = 'local'; }
  else if (online && online.code) { rb.hidden = false; rb.textContent = '部屋 ' + online.code + ' に戻る'; rb.dataset.kind = 'online'; }
  else rb.hidden = true;
  renderSoundBtns();
}
function renderSoundBtns() {
  [['seBtn', 'seLabel'], ['seBtn2', 'seLabel2']].forEach(([b, l]) => { $(b).setAttribute('aria-pressed', String(SE.on)); $(l).textContent = SE.on ? '効果音 ON' : '効果音 OFF'; });
  [['bgmBtn', 'bgmLabel'], ['bgmBtn2', 'bgmLabel2']].forEach(([b, l]) => { $(b).setAttribute('aria-pressed', String(BGM.on)); $(l).textContent = BGM.on ? 'BGM ON' : 'BGM OFF'; });
}

/* =====================================================================
   PROFILE
   ===================================================================== */
function ensureProfile(then) {
  if (profile && profile.name && GUARD[profile.guardian]) { then(); return; }
  openProfile(then);
}
function openProfile(then) {
  afterProfile = then || null;
  profDraft = { name: profile ? profile.name : '', guardian: profile && GUARD[profile.guardian] ? profile.guardian : GUARD_LIST[0].id };
  $('nameInp').value = profDraft.name;
  renderProfile();
  showScreen('profile');
}
function renderProfile() {
  $('glist').innerHTML = GUARD_LIST.map(g => '<button class="gopt" type="button" data-g="' + g.id + '" aria-pressed="' + (profDraft.guardian === g.id) + '">' +
    embHTML(g.id, 50) + '<span class="grow"><span class="gn">' + esc(g.name) + '</span><span class="gk">' + esc(g.yomi || '') + '</span>' +
    '<span class="gs"><b>' + esc(g.skill) + '</b>　' + esc(g.text) + '</span>' +
    '<span class="gst"><span class="elchip el-' + g.elem + '">' + crestSVG(g.elem) + g.elem + 'の属性</span>　体力 ' + g.hp + '　霊力 ' + g.mp + '</span></span></button>').join('');
}
function saveProfile() {
  const name = $('nameInp').value.trim().slice(0, 8);
  if (!name) { toast('名前を入れてください'); $('nameInp').focus(); return; }
  profile = { name, guardian: profDraft.guardian };
  lsSet(PROFILE_KEY, profile);
  sfx('select');
  const then = afterProfile; afterProfile = null;
  if (then) then(); else { renderTitle(); showScreen('title'); }
}

/* =====================================================================
   START / JOIN / RESUME
   ===================================================================== */
function closeNet() { if (net) { try { net.close(); } catch (_) { /* ignore */ } } net = null; room = null; shown = null; pres.q = []; pres.gid = null; wasSeated = false; }
function startPractice() {
  ensureProfile(() => {
    closeNet();
    net = new LocalNet();
    const r = newRoom('練習', 'local', profile);
    net.start(r, onRoom);
    [0, 1, 2].forEach(() => net.send({ t: 'addCpu' }));
    showLobbyLoading('練習の準備');
  });
}
function showLobbyLoading(label) {
  $('codeBox').innerHTML = '<div class="cl">' + esc(label) + '</div>';
  $('lobbySettings').innerHTML = ''; $('lobbySeats').innerHTML = '<p class="note">つないでいます…</p>'; $('lobbyFoot').innerHTML = '';
  showScreen('lobby');
}
async function freeCode() {
  for (let i = 0; i < 6; i++) {
    const code = String(1000 + Math.floor(Math.random() * 9000));
    const s = await DB.doc('rooms/' + code).get();
    if (!s.exists) return code;
    const d = s.data() || {};
    if (d.closed || Date.now() - (d.at || 0) > 6 * 3600e3) return code;
  }
  return String(1000 + Math.floor(Math.random() * 9000));
}
function createRoom() {
  if (onlineState !== 'ok') return;
  ensureProfile(async () => {
    closeNet();
    showLobbyLoading('部屋をつくっています…');
    try {
      const code = await freeCode();
      net = new DbNet(DB, code);
      net.onError = netError;
      net.watch(onRoom);
      net.hostRoom(newRoom(code, 'db', profile));
      lsSet(ONLINE_KEY, { code, host: true });
    } catch (e) { netError(e); leaveToTitle(); }
  });
}
function openJoin() {
  if (onlineState !== 'ok') return;
  ensureProfile(() => {
    if (screen !== 'title') { renderTitle(); showScreen('title'); }
    $('joinInp').value = ''; $('joinWarn').textContent = '';
    openOv('ovJoin');
    setTimeout(() => { try { $('joinInp').focus(); } catch (_) { /* ignore */ } }, 60);
  });
}
async function joinRoom(code, quiet) {
  code = String(code || '').replace(/\D/g, '');
  if (code.length !== 4) { $('joinWarn').textContent = '4けたの番号を入れてください'; return; }
  $('joinGo').disabled = true;
  try {
    const s = await DB.doc('rooms/' + code).get();
    const d = s.exists ? s.data() : null;
    if (!d || d.closed) { $('joinWarn').textContent = 'その番号の部屋は見つかりませんでした'; if (quiet) { toast('部屋 ' + code + ' はもうありません'); lsSet(ONLINE_KEY, null); renderTitle(); } return; }
    closeOv('ovJoin');
    closeNet();
    net = new DbNet(DB, code);
    net.onError = netError;
    if (d.host === myCid) { net.watch(onRoom); net.hostRoom(d); }
    else {
      net.watch(onRoom);
      if (d.phase === 'lobby') await net.send({ t: 'join', name: profile.name, guardian: profile.guardian });
    }
    lsSet(ONLINE_KEY, { code, host: d.host === myCid });
    showLobbyLoading('部屋 ' + code + ' に入っています…');
  } catch (e) { netError(e); }
  finally { $('joinGo').disabled = false; }
}
function resume() {
  const kind = $('btnResume').dataset.kind;
  if (kind === 'local') {
    const r = ssGet(LOCAL_ROOM_KEY, null);
    if (!r) { renderTitle(); return; }
    closeNet();
    net = new LocalNet();
    net.start(r, onRoom);
  } else {
    const o = lsGet(ONLINE_KEY, null);
    if (o && o.code) ensureProfile(() => joinRoom(o.code, true));
  }
}
function netError(e) {
  const code = e && e.code;
  if (code === 'quota_exceeded') toast('部屋の保存場所がいっぱいです。しばらくしてからためしてください');
  else if (code === 'revoked') { toast('この画面ではオンライン対戦が使えなくなりました'); leaveToTitle(); }
  else if (code === 'invalid_argument') toast('書き込みが許可されていません。作った人に「編集できる」権限で招待してもらってください');
  else toast('通信がうまくいきませんでした。電波のよいところでためしてください');
}
function leaveToTitle(keepOnline) {
  closeNet();
  if (!keepOnline) lsSet(ONLINE_KEY, null);
  ['ovDef', 'ovShop', 'ovMenu', 'ovAsk', 'ovLog', 'ovJoin'].forEach(closeOv);
  renderTitle();
  showScreen('title');
}
/* the host closes the room for everyone */
function closeRoomAndLeave() {
  if (net && net.mode === 'db' && net.host) {
    net.host.room.closed = true;
    net.host.changed();
    const n = net; net = null;
    setTimeout(() => { try { n.close(); } catch (_) { /* ignore */ } }, 1500);
  }
  leaveToTitle();
}

/* =====================================================================
   ROOM UPDATES
   ===================================================================== */
function onRoom(r) {
  if (!net) return;
  if (!r) {
    if (net.mode === 'db' && !net.host) { toast('部屋がなくなりました'); leaveToTitle(); }
    return;
  }
  if (r.closed && r.host !== myCid) { toast('進行役が部屋を閉じました'); leaveToTitle(); return; }
  if (net.mode === 'db' && !net.host && r.at) skew = r.at - Date.now();
  else skew = 0;
  room = r;
  if (r.phase === 'lobby') {
    pres.q = []; pres.gid = null; shown = null;
    const seated = r.seats.some(s => s.cid === myCid);
    if (!isHost()) {
      if (seated) wasSeated = true;
      else if (wasSeated) { toast('部屋から外されました'); leaveToTitle(); return; }
    }
    renderLobby();
    if (screen !== 'lobby') showScreen('lobby');
    return;
  }
  if (r.phase === 'game' && r.game) { pres.q.push(r); pump(); }
}

/* ---------- lobby ---------- */
function renderLobby() {
  const R = room; if (!R) return;
  const host = isHost();
  const local = R.mode === 'local';
  $('codeBox').innerHTML = local
    ? '<div class="cl">練習</div><div class="h2" style="font-size:21px;margin-top:4px">CPUを相手に遊んでみよう</div>'
    : '<div class="cl">部屋の番号</div><div class="cd">' + esc(R.code) + '</div><div class="cl">この番号を友達に伝えて「部屋に入る」から入ってもらいます</div>';
  const st = R.settings;
  if (host) {
    const teams = [[0, '個人戦'], [2, '2チーム'], [3, '3チーム'], [4, '4チーム']];
    const times = [[30, '30秒'], [60, '60秒'], [90, '90秒'], [0, 'なし']];
    $('lobbySettings').innerHTML = '<div class="seg-l">戦い方</div><div class="seg" id="segTeams">' +
      teams.map(([v, l]) => '<button type="button" data-teams="' + v + '" aria-pressed="' + (st.teams === v) + '">' + l + '</button>').join('') + '</div>' +
      (local ? '' : '<div class="seg-l" style="margin-top:8px">持ち時間（自分の番）</div><div class="seg" id="segTime">' +
        times.map(([v, l]) => '<button type="button" data-time="' + v + '" aria-pressed="' + (st.turnSec === v) + '">' + l + '</button>').join('') + '</div>');
  } else {
    $('lobbySettings').innerHTML = '<p class="note" style="text-align:left">' + (st.teams ? st.teams + 'チームに分かれて戦います' : '個人戦（全員が敵）') +
      '・持ち時間 ' + (st.turnSec ? st.turnSec + '秒' : 'なし') + '</p>';
  }
  $('lobbySeats').innerHTML = R.seats.map((s, i) => {
    const g = GUARD[s.guardian] || GUARD_LIST[0];
    const mine = s.cid === myCid;
    const canTeam = st.teams && (host || mine);
    return '<div class="lseat">' + embHTML(g.id, 36) +
      '<div class="grow"><div class="ln">' + esc(s.name) + (mine ? '<span class="tag">あなた</span>' : '') + (s.cid === R.host && !local ? '<span class="tag host">進行役</span>' : '') + (s.cpu ? '<span class="tag">CPU</span>' : '') + '</div>' +
      '<div class="ls">' + esc(g.name) + '（' + g.elem + '）・' + esc(g.skill) + '</div></div>' +
      (st.teams ? (canTeam ? '<button class="tbtn" type="button" data-team="' + i + '" aria-label="チームを変える">' + teamHTML(s.team) + '</button>' : teamHTML(s.team)) : '') +
      (host && s.cid !== R.host ? '<button class="kick" type="button" data-kick="' + i + '">外す</button>' : '') + '</div>';
  }).join('') + (R.seats.length < MAX_SEATS ? '<p class="note">' + R.seats.length + '／' + MAX_SEATS + '人' + (st.teams ? '・チーム札をタップするとチームが変わります' : '') + '</p>' : '');
  const prob = lobbyProblem(R);
  if (host) {
    $('lobbyFoot').innerHTML = '<div class="warn">' + esc(prob || '') + '</div>' + (local ? '' : '<button class="btn btn-xs btn-ghost" id="lobbyProf" type="button">自分の名前・式神を変える</button>') + '<div class="acts">' +
      '<button class="btn" id="lobbyCpu" type="button"' + (R.seats.length >= MAX_SEATS ? ' disabled' : '') + '>CPUを追加</button>' +
      '<button class="btn btn-gold" id="lobbyStart" type="button"' + (prob ? ' disabled' : '') + '>合戦をはじめる</button></div>';
  } else {
    const hs = R.seats.find(s => s.cid === R.host);
    const seated = R.seats.some(s => s.cid === myCid);
    $('lobbyFoot').innerHTML = seated
      ? '<p class="note">進行役（' + esc(hs ? hs.name : '部屋をつくった人') + '）が始めるのを待っています…</p><button class="btn btn-s" id="lobbyProf" type="button">名前・式神を変える</button>'
      : '<p class="warn">満員のため入れませんでした（8人まで）</p>';
  }
}
function lobbyTap(e) {
  const b = e.target.closest('button'); if (!b || !net) return;
  if (b.dataset.teams != null) { sfx('select'); net.send({ t: 'settings', teams: Number(b.dataset.teams) }); }
  else if (b.dataset.time != null) { sfx('select'); net.send({ t: 'settings', turnSec: Number(b.dataset.time) }); }
  else if (b.dataset.team != null) { sfx('select'); net.send({ t: 'team', seat: Number(b.dataset.team) }); }
  else if (b.dataset.kick != null) { sfx('tap'); net.send({ t: 'kick', seat: Number(b.dataset.kick) }); }
  else if (b.id === 'lobbyCpu') { sfx('tap'); net.send({ t: 'addCpu' }); }
  else if (b.id === 'lobbyStart') { sfx('tap'); SE.ensure(); net.send({ t: 'start' }).then(err => { if (err) toast(errText(err)); }); }
  else if (b.id === 'lobbyProf') { openProfile(() => { showScreen('lobby'); net && net.send({ t: 'join', name: profile.name, guardian: profile.guardian }); }); }
}
function lobbyBack() {
  if (!net) { leaveToTitle(); return; }
  if (net.mode === 'local') { leaveToTitle(); return; }
  if (net.host) { ask('部屋を閉じますか？', '入っている人もタイトルにもどります。', '部屋を閉じる', closeRoomAndLeave); return; }
  net.send({ t: 'leave' });
  setTimeout(() => leaveToTitle(), 300);
}

/* =====================================================================
   RESULT
   ===================================================================== */
function renderResult() {
  const G = shown && shown.game; if (!G) return;
  const me = mePlayer(shown);
  const winners = G.players.filter(p => p.alive);
  const team = G.settings.teams && G.winner != null;
  $('resBig').textContent = G.winner == null ? '相打ち' : '天下統一';
  const won = me && G.winner != null && me.team === G.winner;
  $('resWho').innerHTML = G.winner == null ? '最後の一撃で全員が成仏しました<small>引き分け</small>'
    : (team ? TEAM_NAMES[G.winner] + '組の勝ち' : esc(winners[0].name) + 'の勝ち') +
      '<small>' + (won ? 'おめでとうございます' : me ? '次こそは天下を' : '') + (team ? '（' + winners.map(p => esc(p.name)).join('、') + '）' : '') + '</small>';
  const order = winners.concat(G.ko.slice().reverse().map(pid => G.players[pid]));
  $('resRank').innerHTML = order.map((p, i) => {
    const g = GUARD[p.guardian];
    const rank = team ? (p.team === G.winner ? '勝' : '') : kanjiNum(i + 1);
    return '<div class="rk' + (p.alive ? ' win' : '') + '"><span class="no">' + rank + '</span>' + embHTML(p.guardian, 34) +
      '<div class="grow"><div class="rn">' + esc(p.name) + (me && p.pid === me.pid ? '（あなた）' : '') + '</div><div class="rs">' + esc(g.name) + '　与えたダメージ ' + p.dealt + '　討ち取り ' + p.kos + '</div></div>' +
      (G.settings.teams ? teamHTML(p.team) : '') + '</div>';
  }).join('');
  const host = isHost();
  $('resBtns').innerHTML = (host ? '<button class="btn btn-gold" type="button" data-res="again">もう一度遊ぶ<small>同じ顔ぶれで待合室へ</small></button>'
    : '<p class="note">進行役が「もう一度」をえらぶと、待合室にもどります</p>') +
    '<div class="acts"><button class="btn btn-s" type="button" data-res="board">盤面を見る</button><button class="btn btn-s" type="button" data-res="title">タイトルへ</button></div>';
}
function resTap(e) {
  const b = e.target.closest('button[data-res]'); if (!b) return;
  if (Date.now() - guardAt.res < 600) return;
  sfx('tap');
  if (b.dataset.res === 'again' && net) net.send({ t: 'rematch' });
  else if (b.dataset.res === 'board') { showScreen('game'); renderGame(); }
  else if (b.dataset.res === 'title') {
    if (net && net.mode === 'db' && net.host) ask('部屋を閉じますか？', '入っている人もタイトルにもどります。', '部屋を閉じる', closeRoomAndLeave);
    else { if (net && net.mode === 'db') net.send({ t: 'leave' }); leaveToTitle(); }
  }
}

/* =====================================================================
   MENU / ASK
   ===================================================================== */
let askFn = null;
function ask(title, body, go, fn) {
  $('askT').textContent = title; $('askS').textContent = body; $('askGo').textContent = go;
  askFn = fn; openOv('ovAsk');
}
function leaveGame() {
  closeOv('ovMenu');
  if (!net) { leaveToTitle(); return; }
  if (net.mode === 'local') { ask('練習をやめますか？', 'タイトルにもどります。', 'やめる', () => leaveToTitle()); return; }
  if (net.host) { ask('部屋を閉じて抜けますか？', 'あなたは進行役です。抜けると部屋が閉じて、みんなの合戦が終わります。', '部屋を閉じる', closeRoomAndLeave); return; }
  ask('合戦から抜けますか？', 'あなたの代わりにCPUが戦います。', '抜ける', () => { net.send({ t: 'leave' }); setTimeout(() => leaveToTitle(), 300); });
}

/* =====================================================================
   GUIDE (遊び方)
   ===================================================================== */
const HOW_TABS = [['basic', 'はじめに'], ['turn', '自分の番'], ['guard', '守り'], ['beast', '霊獣'], ['gogyo', '五行と式神'], ['weather', '天候'], ['cards', '札の一覧'], ['online', 'オンライン']];
let howTab = 'basic';
function openHow(tab) { howTab = tab || 'basic'; renderHow(); openOv('ovHow'); }
function renderHow() {
  $('howTabs').innerHTML = HOW_TABS.map(([k, l]) => '<button type="button" role="tab" data-tab="' + k + '" aria-selected="' + (howTab === k) + '">' + l + '</button>').join('');
  $('howBody').innerHTML = howHTML(howTab);
  $('howBody').scrollTop = 0;
}
function howHTML(k) {
  const ex = (cards, say) => '<div class="ex">' + cards + '<div class="say">' + say + '</div></div>';
  const F = id => (CARD[id] ? fudaHTML(id) : '');
  const P = '<span class="plus">＋</span>';
  switch (k) {
    case 'basic': return '<h3>勝ち負け</h3><p>体力が0になると「成仏」して退場。<b>最後まで残った人（チーム戦はチーム）の勝ち</b>です。</p>' +
      '<h3>自分の番の流れ</h3><ol><li>手札から使いたい札をタップすると、まん中に大きく説明が出ます</li><li>下の金色のボタンを押すと使えます。迷ったら「おみくじ」で運だめし</li><li><b>使った札の数だけ、終わったあとに札を引きます</b>（守りに使った札も同じ）</li></ol>' +
      '<p>画面の「いまやること」の欄に、次に何をすればいいかがいつも出ています。</p>' +
      '<h3>成仏したら（霊になって参加）</h3><ul><li><b>天の声</b>：次の巡の天候をえらべます。成仏した人が何人もいて、えらんだ天候が分かれたら、その中からランダムで決まります</li>' +
      '<li><b>呪術</b>：1巡に1回、生きている人を1人えらんでかけられます。<b>吉か凶かは半々</b>で、次の番のはじめに効きます（前の巡と同じ人には続けてかけられません）</li></ul>' +
      '<div class="hx">' + [true, false].map(g => '<ul class="hx-l ' + (g ? 'good' : 'bad') + '"><li class="hx-h">' + (g ? '吉' : '凶') + '</li>' + HEXES.filter(x => x.good === g).map(x => '<li><b>' + x.name + '</b>' + esc(x.text) + '</li>').join('') + '</ul>').join('') + '</div>' +
      '<h3>攻められたら</h3><p>まん中に攻撃の大きさが出ます。「守れる」と書かれた札をタップして「守る」、何もしないなら「受ける」。</p>' +
      '<h3>札の見かた</h3>' + ex(F('hiya') + F('katana') + F('hinezumi'), '<b>外枠と左上の印</b>は札の種類（武＝武器、守＝防具、術、道＝道具、追＝追撃、召＝召喚）。<b>札の地の色</b>は属性（緑＝木、朱＝火、黄＝土、銀＝金、青＝水）。地が白い札は属性なしです。') +
      '<h3>持っているもの</h3><ul><li>体力：はじめの体力は式神によってちがいます（30〜60）。<b>上限はなく</b>、回復した分だけ増えます（99まで）。0で成仏</li><li>霊力：術を使う・霊獣を呼ぶときに払う</li><li>小判：よろず屋で札を買う。簒奪札で見つけた札も小判で買う</li><li>手札：はじめは10枚、12枚まで（術札は数えません）。番のはじめには引きません</li></ul>' +
      '<h3>手札の並び</h3><p>手札はいつも左から<b>術札 → 攻撃の札 → 守札 → その他</b>の順に並び、同じ組の中は<b>数値の小さい順</b>です。左はしの紫のわくが「術札ゾーン」です。</p>';
    case 'turn': return '<h3>攻める</h3>' + ex(F('katana') + P + F('kiai'), '武器をタップして、攻める相手をタップ。<b>追撃</b>の札はどの武器にも足せます。太刀（攻7）＋気合（＋3）で攻撃10。') +
      '<h3>重ね打ち（属性の武器だけ）</h3>' + ex(F('hiya') + P + F('homura'), '<b>同じ属性の武器どうしは何枚でも重ねられます</b>。火矢（4）＋焔の太刀（7）で火の攻撃11。') +
      ex(F('katana') + F('naginata'), '<b>属性のない武器は重ねられません</b>（1回に1枚。追撃札だけ足せます）。そのかわり、相手はどの守札でも守れてしまいます。') +
      ex(F('kaensha') + F('yabusuma'), '「全体」と書いた武器や術は、相手全員に当たります。全体の武器はほかの武器と重ねられません。') +
      ex(F('kusarigama'), '「通れば1枚」の武器は、ダメージが通ったら札を1枚引けます。') +
      '<h3>術を使う</h3>' + ex(F('kitsunebi') + F('iyashi'), '札の下の「霊3」は、使うのに必要な霊力。<b>術札は使っても手札の「術札ゾーン」に残り、霊力があれば毎番でも使えます</b>。同じ術札は1枚までで、もう持っている術を引いたときは捨てて引き直します。術札は手札の枚数に数えません。') +
      '<p>属性のある術は、同じ属性の守札・その属性に強い属性の守札・結界札で守れます。術札は押し売り・神隠し・簒奪の対象になりません（よろず屋では売れます）。</p>' +
      '<h3>道具</h3>' + ex(F('sandatsu'), '<b>簒奪札</b>：相手1人の手札からランダムに1枚を見て、<b>値段を払えば自分の札</b>にできます。払った小判は相手に渡ります。買わなければ札は相手に戻ります。') +
      ex(F('jobutsu'), '<b>成仏札</b>：霊獣を連れた相手に使うと、半分の確率でその霊獣を成仏させます。') +
      ex(F('oshiuri') + F('kinnokatana'), '<b>押し売り札</b>：手札の札を1枚、相手に値段どおり売りつけます（代金はあなたのものに）。相手の小判が足りなければ霊力、それでも足りなければ体力で払わせ、払いきれなければ成仏。金の刀（30両）のような高い札が武器になります。') +
      ex(F('seiren'), '<b>精錬札</b>：体力・霊力・小判を5ずつ入れかえられます。「−5」で減らした分を「＋5」で分けて「精錬」。') +
      ex(F('onigiri') + F('reisui') + F('zenibukuro'), '体力・霊力・小判をふやす道具は、それぞれ＋5・＋10・＋15・＋20があります。') +
      '<h3>よろず屋・おみくじ</h3><ul><li>よろず屋：棚に4枚。小判で1枚まで買える。手札は半額で売れる。1巡ごとに棚が入れかわる</li></ul>' +
      '<p>おみくじ：番を使って運だめし。入れかえは、手札からえらんだ札を捨てて同じ枚数を引き直せます。時間切れのときは自動でおみくじを引きます（入れかえはなし）。</p>' +
      '<div class="kuji-list">' + OMIKUJI.map(O => '<div class="ex">' + kujiHTML(O.id) + '<div class="say"><b>' + O.name + '</b>（' + Math.round(O.rate * 100) + '%）<br>' + esc(omikujiWord({ hp: O.hp, mp: O.mp, gold: O.gold, swap: O.swap })) + '</div></div>').join('') + '</div>';
    case 'guard': return '<h3>属性の守り</h3>' + ex(F('hiya') + '<span class="plus">→</span>' + F('hinezumi') + F('namiyoke'), '<b>属性のある攻めは、同じ属性の守札と、その属性に強い属性の守札で守れます</b>。火の攻めには、火の守札と水の守札（水は火に強い）。属性のない守札では守れません。') +
      '<ul class="gd-list">' + ELEMS.map(e => '<li><span class="elchip el-' + e + '">' + crestSVG(e) + e + 'の攻め</span> → <span class="elchip el-' + e + '">' + crestSVG(e) + e + '</span>・<span class="elchip el-' + strongerOf(e) + '">' + crestSVG(strongerOf(e)) + strongerOf(e) + '</span>の守札</li>').join('') + '</ul>' +
      ex(F('katana') + '<span class="plus">→</span>' + F('domaru') + F('hinezumi'), '<b>属性のない攻めは、どの守札でも守れます</b>（属性のある守札でもOK）。防具は何枚でも重ねられます。') +
      ex(F('kekkai'), '<b>結界札</b>：守り5。術ならどの属性でも守れます。呪い・封印は、守札を1枚出せば防げます。<b>神隠し・簒奪札・押し売り札は守れません</b>。') +
      '<h3>特別な守り（属性に関係なく使える・1回に1枚）</h3>' +
      ex(F('kagami'), '<b>照魔の鏡</b>：攻撃も術も、そっくり相手にはね返す。はね返された人も鏡を持っていれば、またはね返せます（鏡がつきるまで応酬）。') +
      ex(F('hauchiwa'), '<b>羽団扇</b>：攻めを弾く。弾いた攻めは<b>流れ弾</b>になって、<b>自分もふくめた全員</b>の中からランダムに選ばれた1人に飛びます。飛んだ先の人には守りの番が来て、<b>守札で守れます</b>。') +
      ex(F('migawari'), '<b>身代わり人形</b>：攻撃も術も、なかったことにする') + ex(F('minokasa'), '<b>隠れ蓑</b>：武器の攻撃を半分の確率でかわす（ふつうの防具と重ねられる）') +
      '<h3>状態のしるし</h3><ul><li><span class="st st-curse">呪</span> 呪い：番のはじめに体力−3（3回）</li><li><span class="st st-seal">封</span> 封印：術が使えない（2回の番）</li><li><span class="st st-mist">霧</span> 霧隠れ：次の自分の番まで狙われない</li><li><span class="st st-kiai">気</span> 気合：次の攻撃＋5</li><li><span class="st st-kiai">力</span> 白虎の力：次の攻撃が強くなる</li><li><span class="st st-shell">甲</span> 甲羅：次に受けるダメージが減る</li></ul><p>呪いと封印は「清めの塩」で治せます。倒した人は、倒された人の小判の半分をもらえます。</p>';
    case 'beast': return '<h3>霊獣を呼ぶ</h3>' + ex(F('shokan'), '<b>召喚札</b>を使うと、霊力を払って霊獣を呼べます。<b>どの霊獣が出るかはランダム</b>です。霊獣は式神とは別に、あなたの席についてくれます。<b>1人1体まで</b>で、もう一度呼ぶと別の霊獣と入れかわります（龍神は呼べません）。') +
      '<h3>アシスト</h3><p>霊獣は、<b>だれの番でも</b>番のはじめに<b>10回に1回くらい</b>アシストを出します。</p>' +
      '<h3>霊獣が去るとき</h3><ul><li>持ち主がダメージを受けるたびに、8回に1回くらい成仏して去る</li><li>相手に<b>成仏札</b>を使われると、半分の確率で成仏する</li></ul><h3>十の霊獣</h3>' +
      BEAST_LIST.map(B => '<div class="ex ex-b">' + beastCardHTML(B.id) + '<div class="say"><b>' + esc(B.name) + '</b>（' + esc(B.yomi) + '）' + (B.elem ? '　<span class="elchip el-' + B.elem + '">' + crestSVG(B.elem) + B.elem + '</span>' : '') +
        '<br>' + esc(B.text) + '</div></div>').join('');
    case 'gogyo': return '<h3>五行の相性</h3><p>武器や術には<b>木・火・土・金・水</b>の属性があり、相手の式神の属性しだいでダメージが変わります。<b>強いと1.2倍、弱いと半分</b>。</p>' + gogyoSVG() +
      '<ul><li>木は土に強い（根が土を割る）</li><li>土は水に強い（土が水をせき止める）</li><li>水は火に強い（水が火を消す）</li><li>火は金に強い（火が金を溶かす）</li><li>金は木に強い（刃が木を切る）</li></ul>' +
      '<h3>弱点の見かた</h3><p>席の名前の横の <span class="wk el-水"><small>弱</small>' + crestSVG('水') + '</span> が、その相手の<b>弱点の属性</b>です（この属性の攻めが1.2倍）。属性のある武器や術をえらぶと、相手の席に<b>「◎1.2倍」「×半分」</b>が出ます。</p>' +
      '<div class="wk-table">' + GUARD_LIST.map(g => { const w = ELEMS.find(e => BEATS[e] === g.elem), st = BEATS[g.elem];
        return '<div class="wk-row">' + embHTML(g.id, 34) + '<span class="wk-n"><b>' + esc(g.name) + '</b><small>' + g.elem + 'の式神</small></span>' +
          '<span class="wk-c up">1.2倍 <span class="elchip el-' + w + '">' + crestSVG(w) + w + '</span></span><span class="wk-c down">半分 <span class="elchip el-' + st + '">' + crestSVG(st) + st + '</span></span></div>'; }).join('') + '</div>' +
      '<h3>式神</h3>' +
      GUARD_LIST.map(g => '<div class="ex">' + embHTML(g.id, 46) + '<div class="say"><b>' + esc(g.name) + '</b>　<span class="elchip el-' + g.elem + '">' + crestSVG(g.elem) + g.elem + '</span>　体力' + g.hp + '　霊力' + g.mp + '<br>' + esc(g.skill) + '：' + esc(g.text) + '</div></div>').join('');
    case 'weather': return '<h3>天候</h3><p>1巡ごとに天候が変わり、場に効果がかかります。いまの天候は<b>まん中の場の背景</b>（雨・月・提灯など）と画面の上に出ていて、上の札をタップすると説明が見られます。</p>' +
      WEATHER_LIST.map(w => '<div class="ex"><span style="font-size:36px;color:' + (WX_COLOR[w.id] || 'var(--kin-hi)') + '">' + weatherCrest(w) + '</span><div class="say"><b>' + esc(w.name) + '</b>（' + esc(w.yomi) + '）<br>' + esc(w.text) + '</div></div>').join('');
    case 'cards': {
      const groups = [['weapon', '武器'], ['plus', '追撃'], ['armor', '防具'], ['spell', '術'], ['item', '道具'], ['summon', '召喚（霊獣）']];
      const total = CARD_LIST.reduce((s, c) => s + c.n, 0);
      return '<p>山札は全部で' + total + '枚。「枚」は山札に入っている数、「両」はよろず屋での値段です。</p>' + groups.map(([t, l]) => '<h3>' + l + '</h3><div class="catalog">' +
        CARD_LIST.filter(c => c.type === t).map(c => '<div class="cat-i">' + fudaHTML(c.id) + '<div><b>' + esc(c.name) + '</b>' + esc(cardText(c)) + '<br><span class="cnt">' + c.n + '枚　' + c.price + '両</span></div></div>').join('') + '</div>').join('');
    }
    case 'online': return '<h3>友達と遊ぶ</h3><ol><li>ひとりが「部屋をつくる」を押すと、4けたの番号が出ます</li><li>友達は「部屋に入る」で番号を入れます</li><li>人数が足りないときはCPUを足せます（8人まで）。チーム戦は待合室でチームの札をタップして分けます</li></ol>' +
      '<h3>進行役</h3><p>部屋をつくった人の画面が「進行役」になって合戦を進めます。<b>進行役の画面を閉じると合戦が止まります</b>。閉じてしまったら、もう一度開いて「部屋に戻る」で再開できます。</p>' +
      '<h3>持ち時間</h3><p>自分の番の時間が切れると自動で「おみくじ」、守りの時間が切れると「受ける」になります。抜けた人の席はCPUが代わりに戦います。</p>' +
      (APP_MODE ? '<h3>遊べる人</h3><p>このアプリ版では、いまは<b>ひとりで練習（CPUと対戦）</b>が遊べます。オンライン対戦は準備中です。</p>'
        : '<h3>遊べる人</h3><p>いまはClaudeの中で動いているので、オンライン対戦は<b>Claudeにログインして、このページを開ける人どうし</b>で遊べます（作った人から「編集できる」権限で招待された人）。ひとりで練習はだれでもできます。</p>');
  }
  return '';
}
function gogyoSVG() {
  const R = 78, cx = 120, cy = 100;
  const pts = ELEMS.map((e, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return { e, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; });
  const col = { '木': 'var(--e-wood)', '火': 'var(--e-fire)', '土': 'var(--e-earth)', '金': 'var(--e-metal)', '水': 'var(--e-water)' };
  const byE = Object.fromEntries(pts.map(p => [p.e, p]));
  const arrows = ELEMS.map(e => {
    const a = byE[e], b = byE[BEATS[e]];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const x1 = a.x + ux * 24, y1 = a.y + uy * 24, x2 = b.x - ux * 26, y2 = b.y - uy * 26;
    return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="var(--kin)" stroke-width="1.5" marker-end="url(#ah)"/>';
  }).join('');
  return '<svg class="gocycle" viewBox="0 0 240 200" role="img" aria-label="木は土に、土は水に、水は火に、火は金に、金は木に強い"><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--kin)"/></marker></defs>' + arrows +
    pts.map(p => '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="20" fill="' + col[p.e] + '"/><text x="' + p.x.toFixed(1) + '" y="' + (p.y + 7).toFixed(1) + '" text-anchor="middle" font-size="20" font-weight="700" fill="' + (p.e === '金' ? '#231b14' : '#fff') + '" font-family="var(--gothic)">' + p.e + '</text>').join('') +
    '<text x="120" y="104" text-anchor="middle" font-size="11" fill="var(--text-2)" font-family="var(--gothic)">矢印の先に強い</text></svg>';
}

/* =====================================================================
   BOOT
   ===================================================================== */
async function initOnline() {
  const Cl = window.claude;
  if (!Cl || typeof Cl.use !== 'function') { onlineState = 'none'; renderTitle(); return; }
  try { DB = await Cl.use('db'); } catch (_) { DB = null; }
  try { USER = await Cl.use('user'); } catch (_) { USER = null; }
  if (!DB) onlineState = 'none';
  else {
    let w = null;
    try { w = USER ? await USER.can('data.write') : null; } catch (_) { w = null; }
    onlineState = w === false ? 'readonly' : 'ok';
  }
  if (screen === 'title') renderTitle();
}
function bind() {
  const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
  on('btnPractice', 'click', () => { SE.ensure(); sfx('tap'); startPractice(); });
  on('btnCreate', 'click', () => { SE.ensure(); sfx('tap'); createRoom(); });
  on('btnJoin', 'click', () => { SE.ensure(); sfx('tap'); openJoin(); });
  on('btnResume', 'click', () => { SE.ensure(); sfx('tap'); resume(); });
  on('profBtn', 'click', () => { SE.ensure(); sfx('tap'); openProfile(null); });
  on('btnHow', 'click', () => { SE.ensure(); sfx('tap'); openHow('basic'); });
  on('lobbyHow', 'click', () => { sfx('tap'); openHow('basic'); });
  const seT = () => { SE.toggle(); renderSoundBtns(); };
  const bgT = () => { BGM.toggle(); renderSoundBtns(); };
  on('seBtn', 'click', seT); on('seBtn2', 'click', seT); on('bgmBtn', 'click', bgT); on('bgmBtn2', 'click', bgT);
  on('profBack', 'click', () => { sfx('tap'); const then = afterProfile; afterProfile = null; if (then && room && screen === 'profile' && room.phase === 'lobby') showScreen('lobby'); else { renderTitle(); showScreen('title'); } });
  on('profOk', 'click', saveProfile);
  on('nameInp', 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
  on('glist', 'click', e => { const b = e.target.closest('[data-g]'); if (!b) return; sfx('select'); profDraft.guardian = b.dataset.g; profDraft.name = $('nameInp').value; renderProfile(); });
  on('joinGo', 'click', () => { sfx('tap'); joinRoom($('joinInp').value); });
  on('joinInp', 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); joinRoom($('joinInp').value); } });
  on('lobbyBack', 'click', () => { sfx('tap'); lobbyBack(); });
  on('scrLobby', 'click', lobbyTap);
  on('gHand', 'click', handTap);
  on('gOpp', 'click', seatTap);
  on('gMe', 'click', seatTap);
  on('gActs', 'click', actTap);
  on('gCenter', 'click', centerTap);
  on('gWeather', 'click', weatherTap);
  window.addEventListener('resize', () => { if (screen === 'game' && shown) renderGame(); });
  on('gMenu', 'click', () => { sfx('tap'); renderSoundBtns(); openOv('ovMenu'); });
  on('mHow', 'click', () => { closeOv('ovMenu'); openHow('turn'); });
  on('mLog', 'click', () => { closeOv('ovMenu'); openLog(); });
  on('mLeave', 'click', leaveGame);
  on('scrResult', 'click', resTap);
  on('askGo', 'click', () => { closeOv('ovAsk'); const f = askFn; askFn = null; if (f) f(); });
  on('howTabs', 'click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; sfx('select'); howTab = b.dataset.tab; renderHow(); });
  document.addEventListener('click', e => { const c = e.target.closest('[data-close]'); if (c) { sfx('tap'); closeOv(c.dataset.close); } });
  document.addEventListener('visibilitychange', () => {
    try { if (SE.A) { if (document.visibilityState === 'hidden') SE.A.c.suspend(); else SE.A.c.resume(); } } catch (_) { /* ignore */ }
    if (document.visibilityState === 'visible' && screen === 'game') keepAwake();
  });
  window.addEventListener('resize', () => { if (FXC.cv) FXC.size(); });
}
function boot() {
  try { loadData(JSON.parse($('card-data').textContent)); } catch (e) { console.error(e); }
  installCrests();
  installArt();
  installBeastArt();
  SE.init(); BGM.init();
  bind();
  renderTitle();
  showScreen('title');
  setInterval(() => { try { updateTimer(); } catch (_) { /* ignore */ } }, 250);
  initOnline();
  /* 自動テスト用の入口（ふつうに開いたときは何もしない） */
  if (TEST.hook) window.__yao = { G: () => net && net.host && net.host.room.game, changed: () => net && net.host && net.host.changed(), GUARD, CARD, BEAST, fuda: (id, o) => fudaHTML(id, o), koFx, stampAt, cutIn, relPos, embHTML, shownSeq: () => (shown && shown.game ? shown.game.seq : -1), busy: () => pres.busy || pres.q.length > 0, assist: pid => { const G = net && net.host && net.host.room.game; if (G) assist(G, G.players[pid]); } };
}
