# iPhone の画面を再現して、実際にタップしながら最後まで遊べるか確かめる
import json, os, random, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.environ.get('SHOTS', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots'))
os.makedirs(SHOTS, exist_ok=True)
SK = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>'
BODY = open(os.path.join(ROOT, 'dist', 'yaoyorozu.html'), encoding='utf8').read()
def page_html(top=47, bottom=34):
    return SK + '<style>:root{padding-top:%dpx!important;padding-bottom:%dpx!important}</style>' % (top, bottom) + BODY + '</body></html>'
FAKE = open(os.path.join(ROOT, 'test', 'fakeclaude.js'), encoding='utf8').read()
URL = 'http://yao.test/'
problems = []


def new_context(p, browser, size=(402, 812), pad=(47, 34), mobile=True):
    ctx = browser.new_context(viewport={'width': size[0], 'height': size[1]}, device_scale_factor=3 if mobile else 1.5, is_mobile=mobile, has_touch=True, locale='ja-JP')
    body = page_html(*pad)
    def route(r):
        if r.request.url.startswith(URL):
            r.fulfill(status=200, content_type='text/html; charset=utf-8', body=body)
        else:
            r.abort()
    ctx.route('**/*', route)
    return ctx


def open_page(ctx, tag='', speed=1, fake=False, hook=False):
    page = ctx.new_page()
    page.add_init_script('window.__YAO_TEST = ' + json.dumps({'tag': tag, 'speed': speed, 'hook': hook}) + ';')
    if fake:
        page.add_init_script(FAKE)
    errs = []
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    page.errs = errs
    page.tag = tag or 'solo'
    page.goto(URL)
    page.wait_for_timeout(400)
    return page


def tap(page, sel, nth=0, must=True):
    loc = page.locator(sel)
    if loc.count() <= nth:
        if must:
            problems.append(f'[{page.tag}] 見つからない: {sel}')
        return False
    el = loc.nth(nth)
    try:
        el.scroll_into_view_if_needed(timeout=1000)
    except Exception:
        pass
    try:
        box = el.bounding_box(timeout=1500)
    except Exception:
        return False  # 描き直しの途中（不具合ではない）
    if not box:
        if must:
            problems.append(f'[{page.tag}] 表示されていない: {sel}')
        return False
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    try:
        ok = el.evaluate('(e, p) => { const t = document.elementFromPoint(p[0], p[1]); return !!t && (t === e || e.contains(t)); }', [x, y], timeout=1500)
    except Exception:
        return False
    if not ok:
        who = page.evaluate('p => { const t = document.elementFromPoint(p[0], p[1]); return t ? (t.id || t.className || t.tagName) : "なし"; }', [x, y])
        problems.append(f'[{page.tag}] ふさがれている: {sel} の上に {who}')
        return False
    page.touchscreen.tap(x, y)
    return True


STATE_JS = """() => {
  const vis = id => { const e = document.getElementById(id); return !!e && !e.hidden; };
  const cls = (b, c) => b.classList.contains(c);
  return {
    screen: ['scrTitle','scrProfile','scrLobby','scrGame','scrResult'].find(vis),
    ask: vis('ovAsk'),
    acts: [...document.querySelectorAll('#gActs button')].map(b => ({ act: b.dataset.act, dis: b.disabled })),
    hand: [...document.querySelectorAll('#gHand .fuda')].map((b, i) => ({ i, type: ([...b.classList].find(c => c.startsWith('t-')) || '').slice(2), off: cls(b, 'off'), sel: cls(b, 'sel'), add: cls(b, 'add'), pick: cls(b, 'pick') })),
    can: document.querySelectorAll('#gOpp .seat.can').length,
    meCan: !!document.querySelector('#gMe.can'),
  };
}"""


def acts_of(s):
    return {a['act']: a for a in s['acts']}


def bot_step(page, stats):
    s = page.evaluate(STATE_JS)
    if s['screen'] == 'scrResult':
        return 'result'
    if s['screen'] != 'scrGame':
        return s['screen']
    if s['ask']:
        tap(page, '#ovAsk [data-close]')
        return 'ask'
    acts = acts_of(s)
    if 'take' in acts:
        stats['def'] = stats.get('def', 0) + 1
        page.wait_for_timeout(450)
        picks = [h for h in s['hand'] if h['pick']]
        if picks and random.random() < 0.7:
            tap(page, '#gHand .fuda', picks[0]['i'])
            page.wait_for_timeout(80)
            if page.locator('#gActs [data-act=guard]:not([disabled])').count():
                tap(page, '#gActs [data-act=guard]')
                return 'guard'
        tap(page, '#gActs [data-act=take]')
        return 'take'
    if 'trade' in acts:
        if s['hand'] and random.random() < 0.7:
            tap(page, '#gHand .fuda', 0)
            page.wait_for_timeout(60)
        if random.random() < 0.5 and page.locator('#cShelf .fuda:not(.off)').count():
            tap(page, '#cShelf .fuda:not(.off)', 0)
            page.wait_for_timeout(60)
        if page.locator('#gActs [data-act=trade]:not([disabled])').count():
            tap(page, '#gActs [data-act=trade]')
            stats['shop'] = stats.get('shop', 0) + 1
            return 'trade'
        tap(page, '#gActs [data-act=shopcancel]')
        return 'shopcancel'
    if 'noswap' in acts:
        page.wait_for_timeout(450)
        if s['hand'] and random.random() < 0.7:
            tap(page, '#gHand .fuda', random.randrange(len(s['hand'])))
            page.wait_for_timeout(80)
            if page.locator('#gActs [data-act=swap]:not([disabled])').count():
                tap(page, '#gActs [data-act=swap]')
                stats['swap'] = stats.get('swap', 0) + 1
                return 'swap'
        tap(page, '#gActs [data-act=noswap]')
        return 'noswap'
    if 'buy' in acts:
        page.wait_for_timeout(450)
        if not acts['buy']['dis'] and random.random() < 0.6:
            tap(page, '#gActs [data-act=buy]')
            stats['buy'] = stats.get('buy', 0) + 1
            return 'buy'
        tap(page, '#gActs [data-act=nobuy]')
        stats['nobuy'] = stats.get('nobuy', 0) + 1
        return 'nobuy'
    if 'result' in acts:
        page.wait_for_timeout(420)
        # 待っているあいだに結果画面へ自動で移ることがある（そのときは押せなくてよい。次の回で結果画面になる）
        tap(page, '#gActs [data-act=result]', must=False)
        return 'toresult'
    for a in ('attack', 'spell', 'item', 'spellself', 'summon'):
        if a in acts and not acts[a]['dis']:
            tap(page, f'#gActs [data-act={a}]')
            stats[a] = stats.get(a, 0) + 1
            return a
    if s['can'] and any(h['sel'] for h in s['hand']):
        n = page.locator('#gOpp .seat.can').count()
        if n:
            # 数えたあとに描き直されたり、合戦が終わって結果画面へ移ったりすることがある（そのときは次の回でやり直す）
            tap(page, '#gOpp .seat.can', random.randrange(n), must=False)
        return 'target'
    if 'cancel' in acts and not acts['cancel']['dis']:
        tap(page, '#gActs [data-act=cancel]')
        return 'cancel'
    if 'pray' in acts and not acts['pray']['dis']:
        r = random.random()
        usable = [h for h in s['hand'] if not h['off']]
        weapons = [h for h in usable if h['type'] == 'weapon']
        others = [h for h in usable if h['type'] in ('spell', 'item', 'summon')]
        if weapons and r < 0.65:
            h = random.choice(weapons)
            tap(page, '#gHand .fuda', h['i'])
            page.wait_for_timeout(60)
            picks = [x for x in page.evaluate(STATE_JS)['hand'] if x['pick']]
            if picks and random.random() < 0.6:
                tap(page, '#gHand .fuda', picks[0]['i'])
                stats['stack'] = stats.get('stack', 0) + 1
            return 'pickweapon'
        if others and r < 0.85:
            tap(page, '#gHand .fuda', random.choice(others)['i'])
            return 'pickother'
        if r < 0.92:
            tap(page, '#gActs [data-act=shop]')
            return 'openshop'
        tap(page, '#gActs [data-act=pray]')
        stats['pray'] = stats.get('pray', 0) + 1
        return 'pray'
    return 'wait'


def set_profile(page, name, gidx):
    page.wait_for_selector('#scrProfile:not([hidden])', timeout=4000)
    page.fill('#nameInp', name)
    tap(page, '#glist .gopt', gidx)
    tap(page, '#profOk')


def play_until_result(pages, limit_s, stats):
    t0 = time.time()
    done = set()
    while time.time() - t0 < limit_s and len(done) < len(pages):
        for pg in pages:
            if pg in done:
                continue
            r = bot_step(pg, stats)
            if r == 'result':
                done.add(pg)
        pages[0].wait_for_timeout(120)
    return len(done) == len(pages), time.time() - t0


def shot(page, name):
    page.screenshot(path=os.path.join(SHOTS, name + '.png'))


def test_practice(p, browser):
    print('== 練習モード（CPU 3人）')
    ctx = new_context(p, browser)
    page = open_page(ctx, speed=0.12)
    shot(page, '01_title')
    tap(page, '#btnPractice')
    page.wait_for_timeout(200)
    shot(page, '02_profile')
    set_profile(page, 'たつや', 3)
    page.wait_for_selector('#lobbyStart', timeout=4000)
    page.wait_for_timeout(300)
    shot(page, '03_lobby')
    tap(page, '#lobbyStart')
    page.wait_for_selector('#scrGame:not([hidden])', timeout=5000)
    stats = {}
    ok, sec = play_until_result([page], 300, stats)
    print('  結果画面まで:', ok, f'{sec:.0f}秒', stats)
    if not ok:
        problems.append('練習モードが結果画面まで行かなかった')
    page.wait_for_timeout(700)
    shot(page, '09_result')
    # もう一度 → 待合室 → 開始
    tap(page, '#resBtns [data-res=again]')
    page.wait_for_selector('#scrLobby:not([hidden])', timeout=4000)
    tap(page, '#lobbyStart')
    page.wait_for_selector('#scrGame:not([hidden])', timeout=5000)
    page.wait_for_timeout(800)
    # リロードして続きから
    page.reload()
    page.wait_for_timeout(600)
    if page.locator('#btnResume:not([hidden])').count() == 0:
        problems.append('リロード後に「続きから」が出ない')
    else:
        tap(page, '#btnResume')
        page.wait_for_selector('#scrGame:not([hidden])', timeout=5000)
        print('  リロード後に続きから再開: OK')
    # 遊び方ガイド
    page.wait_for_timeout(300)
    tap(page, '#gMenu')
    page.wait_for_timeout(200)
    tap(page, '#mHow')
    page.wait_for_timeout(200)
    for i in range(page.locator('#howTabs button').count()):
        tap(page, '#howTabs button', i)
        page.wait_for_timeout(120)
        if i in (0, 1, 3, 4):
            shot(page, f'10_guide{i}')
    tap(page, '#ovHow [data-close]')
    print('  エラー:', page.errs[:5])
    problems.extend(page.errs)
    ctx.close()


def wait_my_turn(page, limit=160):
    t0 = time.time()
    while time.time() - t0 < limit:
        s = page.evaluate(STATE_JS)
        acts = acts_of(s)
        if 'pray' in acts:
            return True
        if 'take' in acts:
            page.wait_for_timeout(450)
            tap(page, '#gActs [data-act=take]')
        page.wait_for_timeout(200)
    return False


def wait_defend(page, limit=90):
    t0 = time.time()
    while time.time() - t0 < limit:
        s = page.evaluate(STATE_JS)
        acts = acts_of(s)
        if 'take' in acts:
            return True
        if 'pray' in acts:
            tap(page, '#gActs [data-act=pray]')
        page.wait_for_timeout(200)
    return False


def test_layout(p, browser, name, size, pad, mobile, cpus, fps=False):
    print(f'== 画面の見た目：{name} {size[0]}×{size[1]}・{cpus + 1}人')
    ctx = new_context(p, browser, size, pad, mobile)
    page = open_page(ctx, speed=1)
    page.wait_for_timeout(300)
    shot(page, f'{name}_1title')
    tap(page, '#btnPractice')
    set_profile(page, 'たつや', 3)
    page.wait_for_selector('#lobbyStart', timeout=4000)
    for _ in range(max(0, cpus - 3)):
        tap(page, '#lobbyCpu')
        page.wait_for_timeout(60)
    page.wait_for_timeout(300)
    shot(page, f'{name}_2lobby')
    tap(page, '#lobbyStart')
    page.wait_for_selector('#scrGame:not([hidden])', timeout=5000)
    ok_turn = wait_my_turn(page)
    print('  自分の番が来た:', ok_turn)
    if ok_turn:
        page.wait_for_timeout(1300)
        shot(page, f'{name}_3myturn')
        s = page.evaluate(STATE_JS)
        weapons = [h for h in s['hand'] if h['type'] == 'weapon' and not h['off']]
        if weapons:
            tap(page, '#gHand .fuda', weapons[0]['i'])
            page.wait_for_timeout(250)
            picks = [h for h in page.evaluate(STATE_JS)['hand'] if h['pick']]
            if picks:
                tap(page, '#gHand .fuda', picks[0]['i'])
                page.wait_for_timeout(200)
            if page.locator('#gOpp .seat.can').count():
                tap(page, '#gOpp .seat.can', 0)
                page.wait_for_timeout(250)
            shot(page, f'{name}_4weapon')
            tap(page, '#gActs [data-act=cancel]')
            page.wait_for_timeout(150)
        tap(page, '#gActs [data-act=shop]')
        page.wait_for_timeout(250)
        tap(page, '#cShelf .fuda', 0)
        tap(page, '#gHand .fuda', 0)
        page.wait_for_timeout(250)
        shot(page, f'{name}_5shop')
        tap(page, '#gActs [data-act=shopcancel]')
        page.wait_for_timeout(150)
        tap(page, '#gActs [data-act=pray]')
    ok_def = wait_defend(page)
    print('  攻められた:', ok_def)
    if ok_def:
        page.wait_for_timeout(500)
        picks = [h for h in page.evaluate(STATE_JS)['hand'] if h['pick']]
        if picks:
            tap(page, '#gHand .fuda', picks[0]['i'])
            page.wait_for_timeout(250)
        shot(page, f'{name}_6defend')
        tap(page, '#gActs [data-act=take]')
    # 相手をタップ → 説明
    page.wait_for_timeout(1500)
    s = page.evaluate(STATE_JS)
    if 'pray' not in acts_of(s) and 'take' not in acts_of(s):
        tap(page, '#gOpp .seat', 0)
        page.wait_for_timeout(250)
        shot(page, f'{name}_7seat')
    if fps:
        cdp = ctx.new_cdp_session(page)
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': 6})
        f = page.evaluate("""() => new Promise(res => { let n = 0, worst = 0, last = performance.now(); const t0 = last;
          function f(now) { n++; worst = Math.max(worst, now - last); last = now; if (now - t0 < 6000) requestAnimationFrame(f); else res({ fps: n / ((now - t0) / 1000), worst }); }
          requestAnimationFrame(f); })""")
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
        print('  CPU6倍遅い状態のfps:', round(f['fps'], 1), ' 最長のコマ間隔(ms):', round(f['worst']))
        if f['fps'] < 40:
            problems.append(f'fps が低い: {f["fps"]:.1f}')
    # はみ出しチェック
    over = page.evaluate("""() => { const W = document.documentElement.clientWidth; const bad = [];
      document.querySelectorAll('#scrGame *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1) && !el.closest('.hand') && !el.closest('.wx')) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right)); });
      return bad.slice(0, 6); }""")
    if over:
        problems.append(f'[{name}] 画面からはみ出し: {over}')
    print('  エラー:', page.errs[:5])
    problems.extend(page.errs)
    ctx.close()


def test_online(p, browser):
    print('== オンライン対戦（進行役＋参加者2人＋CPU、2チーム）')
    ctx = new_context(p, browser)
    A = open_page(ctx, tag='A', speed=0.15, fake=True)
    B = open_page(ctx, tag='B', speed=0.15, fake=True)
    C = open_page(ctx, tag='C', speed=0.15, fake=True)
    A.wait_for_timeout(400)
    if A.locator('#btnCreate[disabled]').count():
        problems.append('オンラインのボタンが押せない')
    tap(A, '#btnCreate')
    set_profile(A, 'ホスト', 1)
    A.wait_for_selector('#codeBox .cd', timeout=6000)
    code = A.locator('#codeBox .cd').inner_text().strip()
    print('  部屋番号:', code)
    for pg, nm, g in ((B, 'ゲストB', 2), (C, 'ゲストC', 4)):
        tap(pg, '#btnJoin')
        set_profile(pg, nm, g)
        pg.wait_for_selector('#ovJoin:not([hidden])', timeout=4000)
        pg.fill('#joinInp', code)
        tap(pg, '#joinGo')
    A.wait_for_function('document.querySelectorAll("#lobbySeats .lseat").length >= 3', timeout=8000)
    tap(A, '#lobbyCpu')
    A.wait_for_timeout(500)
    tap(A, '#segTeams button', 1)
    A.wait_for_timeout(700)
    # ゲストが自分のチームを変える
    B.wait_for_timeout(500)
    tap(B, '#lobbySeats .tbtn', 0, must=False)
    A.wait_for_timeout(900)
    shot(A, '11_online_lobby_host')
    shot(B, '12_online_lobby_guest')
    if A.locator('#lobbyStart[disabled]').count():
        problems.append('オンラインの開始ボタンが押せない: ' + A.locator('#lobbyFoot .warn').inner_text())
    tap(A, '#lobbyStart')
    for pg in (A, B, C):
        pg.wait_for_selector('#scrGame:not([hidden])', timeout=8000)
    # ゲストCは途中で抜ける
    stats = {}
    t0 = time.time()
    left = False
    done = set()
    while time.time() - t0 < 420 and len(done) < 3:
        for pg in (A, B, C):
            if pg in done:
                continue
            if pg is C and not left and time.time() - t0 > 25:
                tap(C, '#gMenu')
                C.wait_for_timeout(200)
                tap(C, '#mLeave')
                C.wait_for_timeout(200)
                tap(C, '#askGo')
                left = True
                done.add(C)
                print('  ゲストCが抜けた')
                continue
            if bot_step(pg, stats) == 'result':
                done.add(pg)
        A.wait_for_timeout(100)
    print('  結果画面:', [pg.tag for pg in done], f'{time.time() - t0:.0f}秒', stats)
    if A not in done or B not in done:
        problems.append('オンライン対戦が結果画面まで行かなかった')
    shot(A, '13_online_result_host')
    shot(B, '14_online_result_guest')
    # もう一度
    A.wait_for_timeout(700)
    tap(A, '#resBtns [data-res=again]')
    B.wait_for_selector('#scrLobby:not([hidden])', timeout=6000)
    print('  もう一度でゲストも待合室へ: OK')
    seats = A.locator('#lobbySeats .lseat').count()
    print('  待合室の人数（抜けた人は外れる）:', seats)
    # ホストが部屋を閉じる → ゲストはタイトルへ
    tap(A, '#lobbyBack')
    A.wait_for_timeout(200)
    tap(A, '#askGo')
    B.wait_for_selector('#scrTitle:not([hidden])', timeout=8000)
    print('  ホストが部屋を閉じるとゲストもタイトルへ: OK')
    for pg in (A, B, C):
        print('  エラー', pg.tag, pg.errs[:5])
        problems.extend(pg.errs)
    ctx.close()


if __name__ == '__main__':
  with sync_playwright() as p:
    browser = p.chromium.launch()
    which = sys.argv[1:] or ['practice', 'screens', 'online']
    if 'practice' in which:
        test_practice(p, browser)
    if 'screens' in which:
        test_layout(p, browser, 'phone', (402, 812), (47, 34), True, 7, fps=True)
        if 'phoneonly' not in which:
            test_layout(p, browser, 'land', (874, 402), (0, 21), True, 5)
            test_layout(p, browser, 'pc', (1280, 800), (0, 0), False, 7)
    if 'online' in which:
        test_online(p, browser)
    browser.close()

  print('\n==== 問題', len(problems), '件')
  for x in problems[:40]:
    print(' -', x)
