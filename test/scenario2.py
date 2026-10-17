# 第8版の確かめ：手札の並び・術札ゾーン（使っても残る）・弱点と相性のしるし・1枚ずつの演出（攻め0.3秒・補充0.2秒）
import json, os, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_test as T

SHOTS = T.SHOTS
problems = T.problems


def G(page, js):
    return page.evaluate('() => { const G = window.__yao.G(); const me = G.players.find(p => !p.cpu); ' + js + ' }')


def push(page, js):
    page.evaluate('() => { const G = window.__yao.G(); const me = G.players.find(p => !p.cpu); ' + js + '; window.__yao.changed(); }')


def start(p, browser, size, pad, mobile, speed=1):
    ctx = T.new_context(p, browser, size, pad, mobile)
    page = ctx.new_page()
    page.add_init_script('window.__YAO_TEST = ' + json.dumps({'speed': speed, 'hook': True}) + ';')
    errs = []
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    page.errs = errs
    page.tag = 'scn2'
    page.goto(T.URL)
    page.wait_for_timeout(400)
    T.tap(page, '#btnPractice')
    T.set_profile(page, 'たつや', 0)
    page.wait_for_selector('#lobbyStart', timeout=4000)
    T.tap(page, '#lobbyStart')
    page.wait_for_selector('#scrGame:not([hidden])', timeout=5000)
    page.wait_for_timeout(3500)
    push(page, 'G.settings.turnSec = 0; G.settings.defSec = 0; G.deadline = 0; G.players.forEach(p => { p.hp = 95; })')
    return ctx, page


def my_turn(page, limit=90):
    t0 = time.time()
    while time.time() - t0 < limit:
        push(page, 'G.players.forEach(p => { if (p.alive && p.hp < 40) p.hp = 80; })')
        st = G(page, 'return { act: G.phase === "act" && G.cur === me.pid, def: G.phase === "defend" && G.pend && G.pend.targets.includes(me.pid) && !G.pend.resp[me.pid] };')
        if st['act'] and page.locator('#gActs [data-act=pray]').count():
            page.wait_for_timeout(600)
            return True
        if st['def'] and page.locator('#gActs [data-act=take]').count():
            page.wait_for_timeout(300)
            T.tap(page, '#gActs [data-act=take]', must=False)
        page.wait_for_timeout(250)
    return False


def hand_names(page):
    return page.evaluate('() => [...document.querySelectorAll("#gHand .fuda")].map(b => (b.getAttribute("aria-label") || "").split("：")[0])')


def tap_card(page, cid):
    i = page.evaluate('id => [...document.querySelectorAll("#gHand .fuda")].findIndex(b => b.dataset.c === id)', cid)
    if i < 0:
        problems.append('手札に見つからない: ' + cid)
        return False
    T.tap(page, '#gHand .fuda', i)
    page.wait_for_timeout(250)
    return True


def tap_seat(page, pid):
    idx = page.evaluate('pid => [...document.querySelectorAll("#gOpp .seat")].findIndex(b => Number(b.dataset.pid) === pid)', pid)
    T.tap(page, '#gOpp .seat', idx)
    page.wait_for_timeout(250)


def scenario(p, browser, name, size, pad, mobile):
    print(f'== 第8版の場面テスト：{name}')
    ctx, page = start(p, browser, size, pad, mobile)
    if not my_turn(page):
        problems.append(f'[{name}] 自分の番が来ない')
        return
    # CPUの式神を、相性がそろうように決める（火の攻めに：金は弱い、水は強い、火の狐は効かない）
    push(page, 'const gs = ["kitsune", "ryujin", "gama", "oni", "tengu"]; G.players.filter(p => p.cpu).forEach((p, i) => { p.guardian = gs[i % gs.length]; p.hp = 95; p.st.mist = 0; p.hand = p.hand.filter(h => window.__yao.CARD[h.c].type !== "armor" || !window.__yao.CARD[h.c].special); })')
    push(page, 'me.mp = 30; me.gold = 60')
    hand = ['onigiri', 'kagami', 'raimei', 'homura', 'domaru', 'kiai', 'hiya', 'kitsunebi', 'katana', 'shokan', 'iyashi', 'hinezumi', 'kusarigama']
    push(page, 'me.hand = ' + json.dumps(hand) + '.map(c => ({ u: G.uid++, c }))')
    page.wait_for_timeout(500)
    names = hand_names(page)
    print('  手札の並び:', '・'.join(names))
    want = ['癒しの舞', '狐火', '雷鳴', '鎖鎌', '火矢', '太刀', '焔の太刀', '気合', '胴丸', '火鼠の衣', '照魔の鏡', 'おにぎり', '召喚札']
    if names != want:
        problems.append(f'[{name}] 手札の並びがちがう: {names}')
    zone = page.evaluate('() => [...document.querySelectorAll("#gHand .hz-sp .fuda")].map(b => b.dataset.c)')
    print('  術札ゾーン:', zone)
    if sorted(zone) != sorted(['iyashi', 'kitsunebi', 'raimei']):
        problems.append(f'[{name}] 術札ゾーンがおかしい: {zone}')
    cnt = page.evaluate('() => document.querySelector("#gMe .hn b").textContent')
    print('  手札の枚数の表示（術札ぬき）:', cnt)
    if cnt != '10':
        problems.append(f'[{name}] 手札の枚数の表示が術札ぬきになっていない: {cnt}')
    T.shot(page, f'{name}_v8_1_hand')
    # 弱点のしるし
    wk = page.evaluate('() => [...document.querySelectorAll("#gOpp .seat")].map(b => !!b.querySelector(".wk"))')
    if not all(wk):
        problems.append(f'[{name}] 弱点のしるしが出ていない席がある: {wk}')
    # 火の武器をえらぶ → 相性のしるし
    tap_card(page, 'hiya')
    badges = page.evaluate('() => [...document.querySelectorAll("#gOpp .seat")].map(b => [Number(b.dataset.pid), (b.querySelector(".affb") || {}).textContent || ""])')
    exp = G(page, 'const Y = window.__yao; const BE = { "木": "土", "土": "水", "水": "火", "火": "金", "金": "木" }; return G.players.filter(p => p.pid !== me.pid).map(p => { const g = Y.GUARD[p.guardian]; if (g.fireImmune) return [p.pid, "効かない"]; if (BE["火"] === g.elem) return [p.pid, "◎1.2倍"]; if (BE[g.elem] === "火") return [p.pid, "×半分"]; return [p.pid, ""]; });')
    print('  火の攻めの相性:', badges)
    if sorted(map(tuple, badges)) != sorted(map(tuple, exp)):
        problems.append(f'[{name}] 相性のしるしがちがう: {badges} / 正しくは {exp}')
    T.shot(page, f'{name}_v8_2_affinity')
    # 重ね打ち＋気合で攻める → まん中に1枚ずつ
    tap_card(page, 'homura')
    tap_card(page, 'kiai')
    tgt = G(page, 'const t = G.players.find(p => p.cpu && p.alive && !window.__yao.GUARD[p.guardian].fireImmune); return t.pid;')
    push(page, 'const t = G.players[' + str(tgt) + ']; t.hand = t.hand.filter(h => window.__yao.CARD[h.c].type !== "armor"); t.hand.push({ u: G.uid++, c: "hinezumi" }, { u: G.uid++, c: "hinezumi" })')
    page.wait_for_timeout(300)
    tap_seat(page, tgt)
    page.evaluate('''() => { window.__rev = []; const ob2 = new MutationObserver(() => { const n = document.querySelectorAll("#gCenter .bt2:not(.def) .bt-c:not(.hid)").length; if (n && (!window.__rev.length || window.__rev[window.__rev.length - 1][0] !== n)) window.__rev.push([n, Math.round(performance.now())]); }); ob2.observe(document.getElementById("gCenter"), { subtree: true, attributes: true, childList: true }); }''')
    page.evaluate('''() => { window.__cnt = []; const ob = new MutationObserver(() => { const b = document.querySelector("#gMe .hn b"); if (b) { const v = b.textContent; if (!window.__cnt.length || window.__cnt[window.__cnt.length - 1][0] !== v) window.__cnt.push([v, Math.round(performance.now())]); } }); ob.observe(document.getElementById("gMe"), { subtree: true, childList: true, characterData: true }); }''')
    T.tap(page, '#gActs [data-act=attack]')
    t0 = time.time()
    page.wait_for_selector('#gCenter .c-stg .bt2', timeout=5000)
    page.wait_for_timeout(100)
    seen = page.evaluate('() => document.querySelectorAll("#gCenter .c-stg .bt-c:not(.hid)").length')
    page.wait_for_timeout(700)
    seen2 = page.evaluate('() => document.querySelectorAll("#gCenter .c-stg .bt-c:not(.hid)").length')
    page.wait_for_timeout(700)
    seen3 = page.evaluate('() => document.querySelectorAll("#gCenter .c-stg .bt-c:not(.hid)").length')
    page.wait_for_timeout(700)  # 最後の札のあとに、相性をかけた合計が出る
    num = page.evaluate('() => (document.querySelector("#gCenter .bt-n") || {}).textContent')
    T.shot(page, f'{name}_v8_4_board_done')
    rv = page.evaluate('() => window.__rev')
    print('  まん中に出た札の数（0.1秒・0.45秒・1.15秒）:', seen, seen2, seen3, '合計', num, '出た間隔(ms):', [rv[i + 1][1] - rv[i][1] for i in range(len(rv) - 1)])
    if not (seen <= 1 and seen2 >= 2 and seen3 == 3):
        problems.append(f'[{name}] 攻めの札が1枚ずつ出ていない: {seen}, {seen2}, {seen3}')
    exp_atk = G(page, 'const e = G.log.filter(x => x.k === "declare").pop(); return e ? e.atk[e.targets[0]] : null;')
    if str(exp_atk) != num:
        problems.append(f'[{name}] まん中の合計がちがう: {num} / {exp_atk}')
    gone = page.evaluate('() => ["hiya", "homura", "kiai"].filter(id => document.querySelector("#gHand .fuda[data-c=" + id + "]:not(.out)"))')
    if gone:
        problems.append(f'[{name}] 使った札が手札に残っている: {gone}')
    fresh = page.evaluate('() => !!document.querySelector("#gCenter > .c-body.fresh")')
    if fresh:
        problems.append(f'[{name}] 攻めの盤が描きなおしでちらついている')
    # 相手の守り：守札も1枚ずつ
    try:
        page.wait_for_selector('#gCenter .bt2.def', timeout=15000)
        page.wait_for_timeout(250)
        page.screenshot(path=os.path.join(SHOTS, f'{name}_v8_4b_def_mid.png'))
        page.wait_for_timeout(900)
        page.screenshot(path=os.path.join(SHOTS, f'{name}_v8_4c_def_done.png'))
        print('  相手の守りの盤: 出た')
    except Exception:
        print('  相手の守りの盤: 出なかった（守らなかった）')
    # 補充：1枚ずつ
    t1 = time.time()
    while time.time() - t1 < 20:
        c = page.evaluate('() => document.querySelector("#gMe .hn b").textContent')
        if c == '10' and G(page, 'return G.cur !== me.pid;'):
            break
        page.wait_for_timeout(100)
    page.wait_for_timeout(400)
    cl = page.evaluate('() => window.__cnt')
    counts = [c for c, _ in cl]
    gaps = [cl[i + 1][1] - cl[i][1] for i in range(len(cl) - 1)]
    print('  手札の枚数の動き:', counts, '間隔(ms):', gaps)
    if len(counts) < 4:
        problems.append(f'[{name}] 補充が1枚ずつになっていない: {counts}')
    T.shot(page, f'{name}_v8_5_refilled')
    # 次の自分の番：術札（狐火）を使っても残る
    if not my_turn(page):
        problems.append(f'[{name}] 2回目の自分の番が来ない')
        return
    push(page, 'me.mp = 30; me.st.seal = 0; G.weather = "nagi"; G.players.forEach(p => { p.st.mist = 0; })')
    page.wait_for_timeout(300)
    before = G(page, 'return { n: me.hand.filter(h => window.__yao.CARD[h.c].type !== "spell").length, has: me.hand.some(h => h.c === "kitsunebi"), mp: me.mp };')
    if not before['has']:
        push(page, 'me.hand.push({ u: G.uid++, c: "kitsunebi" })')
        page.wait_for_timeout(300)
    tap_card(page, 'kitsunebi')
    tgt = G(page, 'const t = G.players.find(p => p.cpu && p.alive && !p.st.mist); return t.pid;')
    tap_seat(page, tgt)
    T.tap(page, '#gActs [data-act=spell]')
    ok = False
    t2 = time.time()
    while time.time() - t2 < 20:
        r = G(page, 'return G.log.some(e => e.k === "resolve" && e.card === "kitsunebi" && e.by === me.pid);')
        if r:
            ok = True
            break
        page.wait_for_timeout(200)
    page.wait_for_timeout(1500)
    after = G(page, 'return { n: me.hand.filter(h => window.__yao.CARD[h.c].type !== "spell").length, has: me.hand.some(h => h.c === "kitsunebi"), mp: me.mp };')
    print('  狐火を使う前と後:', before, after, '効いた' if ok else '')
    if not after['has']:
        problems.append(f'[{name}] 術札が使ったあと手札に残っていない')
    if after['mp'] >= 30:
        problems.append(f'[{name}] 術の霊力が減っていない: {after}')
    inzone = page.evaluate('() => !!document.querySelector("#gHand .hz-sp .fuda[data-c=kitsunebi]")')
    if not inzone:
        problems.append(f'[{name}] 術札ゾーンに狐火が見えない')
    T.shot(page, f'{name}_v8_6_spell_stays')
    # よろず屋：同じ術はもう買えない
    if my_turn(page):
        push(page, 'me.gold = 60; G.shop[0] = { u: G.uid++, c: "kitsunebi" }; if (!me.hand.some(h => h.c === "kitsunebi")) me.hand.push({ u: G.uid++, c: "kitsunebi" })')
        page.wait_for_timeout(300)
        T.tap(page, '#gActs [data-act=shop]')
        page.wait_for_timeout(400)
        lab = page.evaluate('() => { const b = document.querySelector("#cShelf .fuda[data-i=\\"0\\"]"); return b ? [b.classList.contains("off"), (b.querySelector(".f-price") || {}).textContent] : null; }')
        print('  棚の狐火（もう持っている）:', lab)
        if not lab or not lab[0]:
            problems.append(f'[{name}] 持っている術札が棚で買える表示になっている: {lab}')
        T.shot(page, f'{name}_v8_7_shop')
        T.tap(page, '#gActs [data-act=shopcancel]')
    # 遊び方の五行
    for e in page.errs[:5]:
        problems.append(f'[{name}] {e}')
    print('  エラー:', page.errs[:5])
    ctx.close()


if __name__ == '__main__':
    with sync_playwright() as p:
        browser = p.chromium.launch()
        which = sys.argv[1:] or ['phone', 'pc']
        if 'phone' in which:
            scenario(p, browser, 'phone', (402, 812), (47, 34), True)
        if 'land' in which:
            scenario(p, browser, 'land', (874, 402), (0, 21), True)
        if 'pc' in which:
            scenario(p, browser, 'pc', (1280, 800), (0, 0), False)
        browser.close()
    print('\n==== 問題', len(problems), '件')
    for x in problems[:40]:
        print(' -', x)
