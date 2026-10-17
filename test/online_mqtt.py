# 合言葉のオンライン対戦（ホーム画面アプリ版）を、手元の中継所2か所と3台のスマホでためす
#   python3 test/online_mqtt.py
# 中継所が片方止まる・全部いったん止まる・参加者がページを開き直す・進行役が開き直す・途中で抜ける、をふくめて
# 最後（結果画面→もう一度→部屋を閉じる）まで遊べるかを確かめる
import json, os, subprocess, sys, time, urllib.parse, urllib.request
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_test as T

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B1, B2, WEB = 8891, 8892, 8790
URL = 'http://127.0.0.1:%d/' % WEB
PASS = 'さくら-たぬき-72'
problems = T.problems


def broker(port, path):
    return urllib.request.urlopen('http://127.0.0.1:%d%s' % (port, path), timeout=5).read().decode()


def new_phone(p, browser, tag, url=URL, speed=0.15):
    ctx = browser.new_context(viewport={'width': 402, 'height': 812}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='ja-JP', service_workers='block')
    page = ctx.new_page()
    page.add_init_script('window.__YAO_TEST = ' + json.dumps({'speed': speed, 'hook': True, 'brokers': ['ws://127.0.0.1:%d/mqtt' % B1, 'ws://127.0.0.1:%d/mqtt' % B2]}) + ';')
    errs = []
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'WebSocket' not in m.text else None)
    page.errs = errs
    page.tag = tag
    page.goto(url)
    page.wait_for_timeout(500)
    return ctx, page


def pass_enter(page, text, expect_lobby=True):
    page.wait_for_selector('#ovPass:not([hidden])', timeout=6000)
    page.fill('#passInp', text)
    T.tap(page, '#passGo')
    if expect_lobby:
        page.wait_for_selector('#scrLobby:not([hidden])', timeout=15000)
        return None
    page.wait_for_function('() => { const w = document.getElementById("passWarn"); return w && !w.classList.contains("ok") && w.textContent.length > 4; }', timeout=15000)
    return page.locator('#passWarn').inner_text()


def seats(page):
    return page.evaluate('() => [...document.querySelectorAll("#lobbySeats .lseat .ln")].map(e => e.textContent)')


def main():
    procs = [subprocess.Popen(['node', os.path.join(ROOT, 'test', 'mqtt_broker.js'), str(port)], stdout=subprocess.DEVNULL) for port in (B1, B2)]
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(WEB), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    time.sleep(1.2)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            if os.environ.get('ONLY') != 'race':
                run(p, browser)
            race(p, browser)
            browser.close()
    finally:
        for pr in procs:
            pr.terminate()
    print('\n==== 問題', len(problems), '件')
    for x in problems[:40]:
        print(' -', x)


def run(p, browser):
    print('== 合言葉のオンライン対戦（中継所2か所・3台）')
    cA, A = new_phone(p, browser, 'A')
    # 1) 進行役：部屋をつくる（合言葉を自分で入れる）
    T.tap(A, '#btnCreate')
    T.set_profile(A, 'ホスト', 1)
    A.wait_for_selector('#ovPass:not([hidden])', timeout=6000)
    sug = A.input_value('#passInp')
    print('  おすすめの合言葉:', sug)
    if len(sug) < 6:
        problems.append('おすすめの合言葉が出ていない')
    T.shot(A, 'mq_01_create_sheet')
    pass_enter(A, PASS)
    A.wait_for_selector('#codeBox .cd.pass', timeout=8000)
    shown = A.locator('#codeBox .cd.pass').inner_text().strip()
    print('  待合室の合言葉:', shown, '／', A.locator('#linkSt').inner_text())
    if shown != PASS:
        problems.append('待合室の合言葉がちがう: ' + shown)
    # 2) 同じ合言葉でもう1つ部屋をつくろうとする → 使われている
    cD, D = new_phone(p, browser, 'D')
    T.tap(D, '#btnCreate')
    T.set_profile(D, 'べつの人', 3)
    msg = pass_enter(D, 'サクラ たぬき 72', expect_lobby=False)
    print('  同じ合言葉で部屋をつくる:', msg)
    if '使われて' not in msg:
        problems.append('同じ合言葉の部屋がつくれてしまう: ' + msg)
    # 3) ちがう合言葉で入ろうとする → 見つからない
    T.tap(D, '#ovPass [data-close]')
    D.wait_for_timeout(200)
    T.tap(D, '#btnJoin')
    msg = pass_enter(D, 'ちがう-あいことば-11', expect_lobby=False)
    print('  ない合言葉で入る:', msg)
    if '見つかりません' not in msg:
        problems.append('ない合言葉なのに見つかった: ' + msg)
    cD.close()
    # 4) 参加者B：書き方のちがう合言葉（カタカナ・空白）で入る
    cB, B = new_phone(p, browser, 'B')
    T.tap(B, '#btnJoin')
    T.set_profile(B, 'ゲストB', 2)
    pass_enter(B, 'サクラ　タヌキ 72')
    # 5) 参加者C：共有のリンク（#join=）から入る
    cC, C = new_phone(p, browser, 'C', URL + '#join=' + urllib.parse.quote(PASS))
    T.set_profile(C, 'ゲストC', 4)
    C.wait_for_selector('#ovPass:not([hidden])', timeout=6000)
    pre = C.input_value('#passInp')
    print('  リンクから開いたときの合言葉:', pre)
    if pre != PASS:
        problems.append('リンクの合言葉が入っていない: ' + pre)
    T.tap(C, '#passGo')
    C.wait_for_selector('#scrLobby:not([hidden])', timeout=15000)
    A.wait_for_function('document.querySelectorAll("#lobbySeats .lseat").length >= 3', timeout=15000)
    print('  待合室（進行役の画面）:', seats(A))
    print('  待合室（Bの画面）:', seats(B))
    T.tap(A, '#lobbyCpu')
    A.wait_for_timeout(600)
    T.tap(A, '#segTeams button', 1)
    A.wait_for_timeout(900)
    B.wait_for_timeout(500)
    T.tap(B, '#lobbySeats .tbtn', 0, must=False)
    A.wait_for_timeout(1200)
    T.shot(A, 'mq_02_lobby_host')
    T.shot(B, 'mq_03_lobby_guest')
    if A.locator('#lobbyStart[disabled]').count():
        problems.append('開始ボタンが押せない: ' + A.locator('#lobbyFoot .warn').inner_text())
    T.tap(A, '#lobbyStart')
    for pg in (A, B, C):
        pg.wait_for_selector('#scrGame:not([hidden])', timeout=15000)
    print('  合戦がはじまった')
    # 途中の出来事をためせるように、しばらくは体力を足して合戦を長びかせる（100秒たったらCPUの体力を1にして決着させる）
    def hp_top(force_end=False):
        js = ('const G = window.__yao.G(); if (G && G.phase !== "over") { G.players.forEach(p => { if (p.alive) { ' +
              ('if (p.cpu && !p.left) p.hp = 1;' if force_end else 'if (p.hp < 60) p.hp = 80;') + ' } }); window.__yao.changed(); }')
        try:
            A.evaluate('() => { ' + js + ' }')
        except Exception:
            pass
    last_top = 0
    pages = [A, B, C]
    stats = {}
    t0 = time.time()
    done, events = set(), set()
    while time.time() - t0 < 600 and len(done) < 3:
        el = time.time() - t0
        if el < 100 and el - last_top > 6:
            last_top = el
            hp_top()
        if el > 100 and 'end' not in events:
            events.add('end')
            hp_top(True)
        if el > 12 and 'b1down' not in events:
            events.add('b1down')
            broker(B1, '/down?ms=25000')
            print('  [%3ds] 中継所1が止まった（25秒）' % el)
        if el > 24 and 'breload' not in events:
            events.add('breload')
            print('  [%3ds] Bがページを開き直す' % el)
            B.reload()
            B.wait_for_timeout(800)
            rb = B.locator('#btnResume')
            txt = rb.inner_text() if rb.count() and rb.is_visible() else ''
            print('        戻るボタン:', txt)
            if '合言葉' not in txt:
                problems.append('開き直したあと「部屋に戻る」がない: ' + txt)
            T.tap(B, '#btnResume')
            try:
                B.wait_for_selector('#scrGame:not([hidden])', timeout=20000)
                print('        合戦にもどった')
            except Exception:
                problems.append('Bが合戦にもどれない')
        if el > 45 and 'alldown' not in events:
            events.add('alldown')
            broker(B1, '/down?ms=5000')
            broker(B2, '/down?ms=5000')
            print('  [%3ds] 中継所が2か所とも止まった（5秒）' % el)
        if el > 58 and 'badge' not in events:
            events.add('badge')
            print('        つながりの表示（A/B/C）:', [pg.evaluate('() => { const b = document.getElementById("netBadge"); return b.hidden ? "なし" : b.textContent; }') for pg in pages if pg not in done])
        if el > 66 and 'areload' not in events and A not in done:
            events.add('areload')
            print('  [%3ds] 進行役Aがページを開き直す' % el)
            before = A.evaluate('() => { const G = window.__yao.G(); return G ? [G.seq, G.turn] : null; }')
            A.reload()
            A.wait_for_timeout(800)
            T.tap(A, '#btnResume')
            try:
                A.wait_for_selector('#scrGame:not([hidden])', timeout=20000)
                A.wait_for_timeout(500)
                after = A.evaluate('() => { const G = window.__yao.G(); return G ? [G.seq, G.turn] : null; }')
                print('        進行役として再開:', before, '→', after)
                if not after or after[0] < before[0]:
                    problems.append('進行役の再開で盤面がもどってしまった: %s → %s' % (before, after))
            except Exception:
                problems.append('進行役Aが合戦にもどれない')
        if el > 80 and 'cleave' not in events and C not in done:
            events.add('cleave')
            T.tap(C, '#gMenu')
            C.wait_for_timeout(250)
            T.tap(C, '#mLeave')
            C.wait_for_timeout(250)
            T.tap(C, '#askGo')
            done.add(C)
            print('  [%3ds] Cが抜けた' % el)
        for pg in pages:
            if pg in done:
                continue
            try:
                if T.bot_step(pg, stats) == 'result':
                    done.add(pg)
            except Exception as e:
                print('   (操作の失敗)', pg.tag, str(e)[:80])
        A.wait_for_timeout(100)
    print('  結果画面:', sorted(pg.tag for pg in done), '%.0f秒' % (time.time() - t0), stats)
    if A not in done or B not in done:
        problems.append('合戦が結果画面まで行かなかった')
    print('  中継所の記録:', broker(B1, '/stats'), broker(B2, '/stats'))
    T.shot(A, 'mq_04_result_host')
    T.shot(B, 'mq_05_result_guest')
    A.wait_for_timeout(700)
    T.tap(A, '#resBtns [data-res=again]')
    B.wait_for_selector('#scrLobby:not([hidden])', timeout=12000)
    print('  もう一度でBも待合室へ: OK　人数', len(seats(A)))
    T.tap(A, '#lobbyBack')
    A.wait_for_timeout(250)
    T.tap(A, '#askGo')
    B.wait_for_selector('#scrTitle:not([hidden])', timeout=12000)
    print('  進行役が部屋を閉じるとBもタイトルへ: OK')
    for pg in (A, B, C):
        print('  エラー', pg.tag, pg.errs[:5])
        problems.extend(pg.errs)
    for c in (cA, cB, cC):
        c.close()


def race(p, browser):
    # ほぼ同時に2人が同じ合言葉で部屋をつくった（確かめのすき間をすり抜けた）ときに、先にできた部屋だけが残るか
    print('== 同じ合言葉で、ほぼ同時に部屋ができたとき')
    RP = 'かっぱ-だるま-35'
    cE, E = new_phone(p, browser, 'E')
    T.tap(E, '#btnCreate')
    T.set_profile(E, '先の人', 1)
    pass_enter(E, RP)
    E.wait_for_selector('#codeBox .cd.pass', timeout=8000)
    cF, F = new_phone(p, browser, 'F')
    T.tap(F, '#btnCreate')
    T.set_profile(F, '後の人', 2)
    F.wait_for_selector('#ovPass:not([hidden])', timeout=6000)
    T.tap(F, '#ovPass [data-close]')
    F.wait_for_timeout(200)
    # 確かめをせずに、そのまま進行役になる（すり抜けたのと同じ状態）
    F.evaluate('rp => window.__yao.hostNow(rp)', RP)
    try:
        F.wait_for_selector('#scrTitle:not([hidden])', timeout=12000)
        print('  後からできた部屋はたたまれた（Fはタイトルへ）')
    except Exception:
        problems.append('同じ合言葉の部屋が2つ残った（Fが進行役のまま）')
    hosted = F.evaluate('() => localStorage.getItem("yao-hosted")')
    if hosted and 'かっぱ' in hosted:
        problems.append('たたんだ部屋の控えが残っている')
    E.wait_for_timeout(800)
    if not E.locator('#scrLobby:not([hidden])').count():
        problems.append('先にできた部屋（E）が待合室にいない')
    # あとから入る人は、先にできた部屋に入れる
    cG, G = new_phone(p, browser, 'G')
    T.tap(G, '#btnJoin')
    T.set_profile(G, '入る人', 3)
    pass_enter(G, RP)
    try:
        E.wait_for_function('document.querySelectorAll("#lobbySeats .lseat").length >= 2', timeout=12000)
        print('  あとから入った人は先の部屋に入れた:', seats(E), '／', seats(G))
    except Exception:
        problems.append('あとから入った人が先の部屋に入れない: %s / %s' % (seats(E), seats(G)))
    if '先の人' not in ' '.join(seats(G)):
        problems.append('入った先が先の部屋ではない: %s' % seats(G))
    for pg in (E, F, G):
        errs = [x for x in pg.errs if 'taken' not in x]
        print('  エラー', pg.tag, errs[:5])
        problems.extend(errs)
    for c in (cE, cF, cG):
        c.close()


if __name__ == '__main__':
    main()
