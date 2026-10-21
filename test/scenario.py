# 新しいルール（属性の守り・跳ね返し・弾く・簒奪・霊獣・天候の背景）を、場面を作って画面で確かめる
import json, os, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_test as T

SHOTS = T.SHOTS
problems = T.problems
WEATHERS = ['haru', 'enten', 'jinari', 'shuso', 'tsuyu', 'nagi', 'ennichi', 'mangetsu', 'arashi']


def G(page, js):
    return page.evaluate('() => { const G = window.__yao.G(); const me = G.players.find(p => !p.cpu); ' + js + ' }')


def push(page, js):
    page.evaluate('() => { const G = window.__yao.G(); const me = G.players.find(p => !p.cpu); ' + js + '; window.__yao.changed(); }')


def wait_for(page, cond, limit=40, step=150):
    t0 = time.time()
    while time.time() - t0 < limit:
        if G(page, 'return !!(' + cond + ');'):
            return True
        page.wait_for_timeout(step)
    return False


def start(p, browser, size, pad, mobile, speed=0.35):
    ctx = T.new_context(p, browser, size, pad, mobile)
    page = ctx.new_page()
    page.add_init_script('window.__YAO_TEST = ' + json.dumps({'speed': speed, 'hook': True}) + ';')
    errs = []
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    page.errs = errs
    page.tag = 'scn'
    page.goto(T.URL)
    page.wait_for_timeout(400)
    T.tap(page, '#btnPractice')
    T.set_profile(page, 'たつや', 0)
    page.wait_for_selector('#lobbyStart', timeout=4000)
    T.tap(page, '#lobbyStart')
    page.wait_for_selector('#scrGame:not([hidden])', timeout=5000)
    page.wait_for_timeout(2500)
    push(page, 'G.settings.turnSec = 0; G.settings.defSec = 0; G.deadline = 0; G.players.forEach(p => { p.hp = 95; })')
    return ctx, page


def settle(page, limit=20):
    # 画面の演出が追いつくのを待つ
    t0 = time.time()
    while time.time() - t0 < limit:
        if page.evaluate('() => !window.__yao.busy() && window.__yao.shownSeq() === window.__yao.G().seq'):
            return True
        page.wait_for_timeout(120)
    return False


def give(page, cards, who='me'):
    push(page, who + '.hand = ' + json.dumps(cards) + '.map(c => ({ u: G.uid++, c }))')


def my_turn(page, limit=60):
    push(page, 'G.players.forEach(p => { if (p.alive && p.hp < 40) p.hp = 80; })')
    t0 = time.time()
    while time.time() - t0 < limit:
        st = G(page, 'return { act: G.phase === "act" && G.cur === me.pid, def: G.phase === "defend" && G.pend && G.pend.targets.includes(me.pid) && !G.pend.resp[me.pid] };')
        if st['act'] and page.locator('#gActs [data-act=pray]').count():
            page.wait_for_timeout(700)
            return True
        if st['def']:
            page.wait_for_timeout(500)
            T.tap(page, '#gActs [data-act=take]', must=False)
        page.wait_for_timeout(200)
    return False


def hand_index(page, cid):
    return page.evaluate('id => [...document.querySelectorAll("#gHand .fuda")].findIndex(b => (b.getAttribute("aria-label") || "").startsWith(window.__yao.CARD[id].name + "："))', cid)


def tap_card(page, cid):
    i = hand_index(page, cid)
    if i < 0:
        problems.append('手札に見つからない: ' + cid)
        return False
    T.tap(page, '#gHand .fuda', i)
    page.wait_for_timeout(250)
    return True


def scenario(p, browser, name, size, pad, mobile):
    print(f'== 場面テスト：{name}')
    ctx, page = start(p, browser, size, pad, mobile)
    # 天候の背景
    for w in WEATHERS:
        push(page, 'G.weather = "' + w + '"')
        page.wait_for_timeout(350)
        page.locator('#gCenterBox').screenshot(path=os.path.join(SHOTS, f'{name}_w_{w}.png'))
    push(page, 'G.weather = "tsuyu"')
    # 自分の番に札をそろえる
    if not my_turn(page):
        problems.append(f'[{name}] 自分の番が来ない')
    push(page, 'me.mp = 30; me.gold = 60; G.players.forEach(p => { if (p.cpu) { p.hand.push({ u: G.uid++, c: "kagami" }, { u: G.uid++, c: "kagami" }); p.beast = "suzaku"; } })')
    give(page, ['shokan', 'sandatsu', 'jobutsu', 'hiya', 'homura', 'katana', 'naginata', 'kiai', 'kagami', 'kagami', 'hauchiwa', 'hinezumi'])
    page.wait_for_timeout(400)
    T.shot(page, f'{name}_s1_hand')
    # 属性のない武器は重ねられない
    tap_card(page, 'katana')
    picks = page.evaluate('() => [...document.querySelectorAll("#gHand .fuda.pick")].map(b => b.getAttribute("aria-label").split("：")[0])')
    print('  太刀をえらんだときに足せる札:', picks)
    if any(n in ('薙刀', '火矢', '焔の太刀') for n in picks):
        problems.append('属性のない武器に武器が重ねられる表示になっている')
    tap_card(page, 'hiya')
    picks = page.evaluate('() => [...document.querySelectorAll("#gHand .fuda.pick")].map(b => b.getAttribute("aria-label").split("：")[0])')
    print('  火矢をえらんだときに足せる札:', picks)
    if '焔の太刀' not in picks:
        problems.append('火の武器どうしが重ねられない')
    T.tap(page, '#gActs [data-act=cancel]')
    page.wait_for_timeout(200)
    # 霊獣を呼ぶ
    tap_card(page, 'shokan')
    T.shot(page, f'{name}_s2_summon_card')
    T.tap(page, '#gActs [data-act=summon]')
    page.wait_for_timeout(500)
    T.shot(page, f'{name}_s3_summon_cut')
    if not wait_for(page, '!!me.beast', 10):
        problems.append('霊獣を呼べなかった')
    page.wait_for_timeout(1500)
    T.shot(page, f'{name}_s4_beast_seat')
    # 次の自分の番：簒奪
    if not my_turn(page):
        problems.append(f'[{name}] 2回目の自分の番が来ない')
    push(page, 'me.gold = 60')
    if hand_index(page, 'sandatsu') < 0:
        give(page, ['sandatsu', 'hiya', 'homura', 'kagami', 'kagami', 'hauchiwa', 'hinezumi', 'katana'])
        page.wait_for_timeout(300)
    tap_card(page, 'sandatsu')
    if page.locator('#gActs [data-act=item]:not([disabled])').count() == 0 and page.locator('#gOpp .seat.can').count():
        T.tap(page, '#gOpp .seat.can', 0)
        page.wait_for_timeout(200)
    T.shot(page, f'{name}_s5_usurp_pick')
    print('  簒奪の前:', page.evaluate(T.STATE_JS)['acts'], G(page, 'return { phase: G.phase, cur: G.cur, me: me.pid, alive: me.alive, foes: G.players.filter(p => p.cpu).map(p => [p.alive, p.hand.length, p.st.mist]) };'))
    T.tap(page, '#gActs [data-act=item]')
    if not wait_for(page, 'G.phase === "usurp"', 8):
        problems.append('簒奪の品定めにならない')
    page.wait_for_timeout(900)
    T.shot(page, f'{name}_s6_usurp_view')
    before = G(page, 'return G.pend ? { gold: me.gold, n: me.hand.length, price: G.pend.price, vic: G.players[G.pend.targets[0]].gold } : null;')
    if not before:
        problems.append('簒奪の品定めにならなかった')
        before = {'gold': 0, 'price': 0}
    # 「簒奪札を使う → 見つけた札を見せる」の演出が終わると、買うボタンが出る
    page.wait_for_selector('#gActs [data-act=buy]', timeout=20000)
    T.tap(page, '#gActs [data-act=buy]')
    wait_for(page, 'G.phase !== "usurp"', 8)
    after = G(page, 'const v = G.log.filter(e => e.k === "usurped").pop(); return { gold: me.gold, n: me.hand.length, vic: G.players[v.to].gold, buy: v.buy };')
    print('  簒奪：', before, '→', after)
    gain = G(page, 'const v = G.log.filter(e => e.k === "usurped").pop(); return G.log.filter(e => e.s > v.s && e.k === "assist" && e.p === me.pid && e.eff === "gold").reduce((s, e) => s + (e.v || 0), 0);')  # 霊獣のアシストで小判がふえることがある
    if not after['buy'] or after['gold'] != before['gold'] - before['price'] + gain or after['vic'] != before['vic'] + before['price']:
        problems.append(f'簒奪の支払いがおかしい: {before} {after}')
    page.wait_for_timeout(1200)
    # 属性の攻めを受ける場面（CPUの番のあいだに、火の攻めを自分に向ける）
    wait_for(page, 'G.phase === "act" && G.cur !== me.pid', 20)
    push(page, 'const by = G.cur; me.hp = 80; me.hand = ["hinezumi", "namiyoke", "wara", "domaru", "kekkai", "kagami", "hauchiwa", "minokasa"].map(c => ({ u: G.uid++, c })); '
               'G.phase = "defend"; G.deadline = 0; G.pend = { kind: "attack", by, card: "homura", cards: ["hiya", "homura"], adds: [], elem: "火", base: 11, atk: { [me.pid]: 11 }, aff: { [me.pid]: 0 }, kiai: false, boost: 0, draws: 0, targets: [me.pid], resp: {}, at: Date.now() }')
    settle(page)
    page.wait_for_timeout(300)
    T.shot(page, f'{name}_s7_defend_fire')
    offs = page.evaluate('() => [...document.querySelectorAll("#gHand .fuda")].map(b => [b.getAttribute("aria-label").split("：")[0], b.classList.contains("off")])')
    print('  火の攻めで守れない札:', [n for n, o in offs if o])
    if dict(offs).get('胴丸') is False or dict(offs).get('藁の束') is False or dict(offs).get('火鼠の衣') is True or dict(offs).get('波除け') is True or dict(offs).get('照魔の鏡') is True:
        problems.append(f'属性の守りの判定がおかしい: {offs}')
    tap_card(page, 'domaru')
    page.wait_for_timeout(200)
    tap_card(page, 'kagami')
    page.wait_for_timeout(300)
    T.shot(page, f'{name}_s8_defend_reflect')
    T.tap(page, '#gActs [data-act=guard]')
    # はね返しの応酬：相手は鏡を2枚持っているので、はね返ってくることがある
    got_chain = wait_for(page, 'G.phase === "defend" && G.pend && G.pend.chain && G.pend.targets.includes(me.pid)', 10)
    print('  はね返しがはね返ってきた:', got_chain)
    if got_chain:
        settle(page)
        page.wait_for_timeout(300)
        T.shot(page, f'{name}_s9_chain')
        offs = page.evaluate('() => [...document.querySelectorAll("#gHand .fuda")].map(b => [b.getAttribute("aria-label").split("：")[0], b.classList.contains("off")])')
        if any(not o for n, o in offs if n != '照魔の鏡'):
            problems.append(f'はね返ってきた攻めで鏡以外が使える表示: {offs}')
        T.tap(page, '#gActs [data-act=take]')
    page.wait_for_timeout(2500)
    # 弾く
    wait_for(page, 'G.phase === "act" && G.cur !== me.pid', 20)
    push(page, 'const by = G.cur; me.hp = Math.max(me.hp, 40); me.hand.push({ u: G.uid++, c: "hauchiwa" }); G.phase = "defend"; G.deadline = 0; '
               'G.pend = { kind: "attack", by, card: "odachi", cards: ["odachi"], adds: [], elem: null, base: 10, atk: { [me.pid]: 10 }, aff: { [me.pid]: 0 }, kiai: false, boost: 0, draws: 0, targets: [me.pid], resp: {}, at: Date.now() }')
    settle(page)
    page.wait_for_timeout(300)
    tap_card(page, 'hauchiwa')
    T.shot(page, f'{name}_s10_deflect')
    T.tap(page, '#gActs [data-act=guard]')
    page.wait_for_timeout(600)
    T.shot(page, f'{name}_s11_deflect_anim')
    page.wait_for_timeout(1500)
    dres = G(page, 'const e = G.log.filter(x => x.k === "resolve" && x.results.some(r => r.how === "deflect")).pop(); return e && e.results[0];')
    print('  弾いた結果:', dres and {k: dres.get(k) for k in ('how', 'to')})
    # 弾いた攻めは「流れ弾」になって、飛んだ先の人の守りの番になる
    got_stray = wait_for(page, 'G.log.some(e => e.k === "stray")', 8)
    st = G(page, 'const e = G.log.filter(x => x.k === "stray").pop(); return e ? { to: e.to, from: e.from, atk: e.atk } : null;')
    print('  流れ弾:', st)
    if not got_stray or not dres or st['to'] != dres.get('to'):
        problems.append(f'弾いた攻めが流れ弾になっていない: {dres} {st}')
    if st and st['to'] == G(page, 'return me.pid;'):
        # 自分に飛んできた：守る画面が出る
        settle(page)
        page.wait_for_timeout(300)
        T.shot(page, f'{name}_s11b_stray_me')
        head = page.evaluate('() => (document.querySelector("#gCenter .c-title") || {}).textContent')
        print('  自分に飛んできた流れ弾の画面:', head)
        if '流れ弾' not in (head or ''):
            problems.append(f'流れ弾の守る画面が出ていない: {head}')
        T.tap(page, '#gActs [data-act=take]')
        page.wait_for_timeout(1500)
    # 霊獣のアシストを必ず出す
    push(page, 'window.__yao.GUARD[me.guardian].beastRate = 1; if (!me.beast) me.beast = "seiryu"')
    wait_for(page, 'G.log.some(e => e.k === "assist" && e.p === me.pid)', 30, 100)
    page.wait_for_timeout(300)
    T.shot(page, f'{name}_s12_assist')
    push(page, 'window.__yao.GUARD[me.guardian].beastRate = 0')
    # 相手の席をタップ（霊獣の説明）
    page.wait_for_timeout(1500)
    if G(page, 'return G.phase === "act" && G.cur !== me.pid;'):
        T.tap(page, '#gOpp .seat', 0, must=False)
        page.wait_for_timeout(300)
        T.shot(page, f'{name}_s13_seat_beast')
    # 押し売り：小判5・霊力10・体力20の相手に金の刀（30両）を売りつける → 小判5・霊力10・体力15で払う
    if my_turn(page):
        push(page, 'me.gold = 10; const t = G.players.find(p => p.cpu && p.alive); t.gold = 5; t.mp = 10; t.hp = 20; t.st.mist = 0; window.__t = t.pid')
        give(page, ['oshiuri', 'kinnokatana', 'seiren', 'katana', 'hiya'])
        page.wait_for_timeout(300)
        tap_card(page, 'oshiuri')
        T.shot(page, f'{name}_s15_sell_pick')
        tap_card(page, 'kinnokatana')
        tpid = G(page, 'return window.__t;')
        idx = page.evaluate('pid => [...document.querySelectorAll("#gOpp .seat")].findIndex(b => Number(b.dataset.pid) === pid)', tpid)
        T.tap(page, '#gOpp .seat', idx)
        page.wait_for_timeout(300)
        T.shot(page, f'{name}_s16_sell_ready')
        T.tap(page, '#gActs [data-act=item]')
        page.wait_for_timeout(900)
        T.shot(page, f'{name}_s17_sell_cut')
        wait_for(page, 'G.log.some(e => e.k === "sold")', 8)
        r = G(page, 'const e = G.log.filter(x => x.k === "sold").pop(); const t = G.players[e.to]; return { card: e.card, paid: e.paid, gold: t.gold, mp: t.mp, hp: t.hp, my: me.gold, has: t.hand.some(h => h.c === "kinnokatana") };')
        print('  押し売り:', r)
        if r['paid'] != {'gold': 5, 'mp': 10, 'hp': 15} or r['my'] < 40:
            problems.append(f'押し売りの支払いがおかしい: {r}')
        page.wait_for_timeout(1500)
    # 精錬：体力10・小判40 → 小判を20減らして体力に20
    if my_turn(page):
        push(page, 'me.hp = 10; me.gold = 40; me.mp = 12')
        if hand_index(page, 'seiren') < 0:
            give(page, ['seiren', 'katana'])
            page.wait_for_timeout(300)
        tap_card(page, 'seiren')
        for _ in range(4):
            T.tap(page, '#gCenter [data-ref=gold][data-dir="-1"]')
            page.wait_for_timeout(80)
        T.shot(page, f'{name}_s18_refine_pool')
        for _ in range(4):
            T.tap(page, '#gCenter [data-ref=hp][data-dir="1"]')
            page.wait_for_timeout(80)
        T.shot(page, f'{name}_s19_refine_ready')
        T.tap(page, '#gActs [data-act=refine]')
        wait_for(page, 'G.log.some(e => e.k === "refine")', 8)
        # 精錬のあとすぐ相手に攻められて体力が変わることがあるので、精錬の記録で確かめる
        r = G(page, 'const e = G.log.filter(x => x.k === "refine").pop(); return e ? { hp: e.d.hp, gold: e.d.gold, mp: e.d.mp } : null;')
        print('  精錬:', r)
        if r != {'hp': 20, 'gold': -20, 'mp': 0}:
            problems.append(f'精錬の結果がおかしい: {r}')
        page.wait_for_timeout(1200)
    # 春一番：相手えらびなしで攻める
    if my_turn(page):
        push(page, 'G.weather = "haru"; me.hp = 40')
        give(page, ['katana', 'hiya', 'kitsunebi'])
        page.wait_for_timeout(300)
        tap_card(page, 'katana')
        T.shot(page, f'{name}_s20_random')
        if page.locator('#gActs [data-act=attack]:not([disabled])').count() == 0:
            problems.append('春一番で「ランダムな相手を攻める」が押せない')
        T.tap(page, '#gActs [data-act=attack]')
        page.wait_for_timeout(1500)
    # おみくじ：入れかえが出るまで何回か引く
    got_swap = False
    for k in range(8):
        if not my_turn(page):
            break
        T.tap(page, '#gActs [data-act=pray]')
        page.wait_for_timeout(700)
        if k == 0:
            T.shot(page, f'{name}_s21_omikuji_cut')
        if wait_for(page, 'G.phase === "swap" && G.pend && G.pend.by === me.pid', 4, 100):
            page.wait_for_timeout(1400)
            before = G(page, 'return { n: me.hand.filter(h => window.__yao.CARD[h.c].type !== "spell").length, ids: me.hand.filter(h => window.__yao.CARD[h.c].type !== "spell").map(h => h.u) };')
            T.tap(page, '#gHand > .fuda', 0)  # 術札ゾーンの札は入れかえられないので、ふつうの札をえらぶ
            page.wait_for_timeout(150)
            T.shot(page, f'{name}_s22_omikuji_swap')
            T.tap(page, '#gActs [data-act=swap]')
            wait_for(page, 'G.phase !== "swap"', 6)
            after = G(page, 'return { n: me.hand.filter(h => window.__yao.CARD[h.c].type !== "spell").length, ids: me.hand.filter(h => window.__yao.CARD[h.c].type !== "spell").map(h => h.u) };')
            print('  おみくじの入れかえ:', before['n'], '→', after['n'], '入れかわった札', len(set(before['ids']) - set(after['ids'])))
            if after['n'] != before['n'] or len(set(before['ids']) - set(after['ids'])) != 1:  # 手札は並べ替えて見せるので、どれか1枚が入れかわっていればよい
                problems.append(f'おみくじの入れかえがおかしい: {before} {after}')
            got_swap = True
            break
        page.wait_for_timeout(1200)
    print('  おみくじで入れかえが出た:', got_swap)
    # 体力が上限を超えて増える
    push(page, 'me.hp = me.hp0 + 12')
    page.wait_for_timeout(300)
    T.shot(page, f'{name}_s14_hp_over')
    # 遊び方の霊獣のページ
    T.tap(page, '#gMenu')
    page.wait_for_timeout(200)
    T.tap(page, '#mHow')
    page.wait_for_timeout(200)
    for i in (0, 2, 3):
        T.tap(page, '#howTabs button', i)
        page.wait_for_timeout(150)
        T.shot(page, f'{name}_g{i}')
    T.tap(page, '#ovHow [data-close]')
    print('  エラー:', page.errs[:5])
    problems.extend(page.errs)
    ctx.close()


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
