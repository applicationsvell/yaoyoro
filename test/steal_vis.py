# 「奪う系」の札（簒奪札・神隠し・獏）で、何が動いたかがまん中に出るかを撮って確かめる
#   python3 test/steal_vis.py   （写真は test/shots/sv_*.png）
import os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_test as T
from chaos_vis import G, give, my_turn, tap_card, wait_idle

problems = T.problems


def center(page):
    return page.locator('#gCenter').inner_text().replace('\n', ' ')


def run(p, browser):
    ctx = T.new_context(p, browser)
    page = T.open_page(ctx, speed=1, hook=True)
    T.tap(page, '#btnPractice')
    T.set_profile(page, 'たつや', 2)
    page.wait_for_selector('#lobbyStart', timeout=4000)
    T.tap(page, '#segChaos button', 0)      # ハプニングなし（ねらいどおりに動かすため）
    page.wait_for_timeout(300)
    T.tap(page, '#lobbyStart')
    page.wait_for_selector('#scrGame:not([hidden])', timeout=5000)
    page.wait_for_timeout(1500)
    G(page, 'G.players.forEach(p => { p.hp = 40; p.gold = 40; }); window.__yao.changed();')
    wait_idle(page, 60000)
    foe = G(page, 'const me = G.players.find(p => !p.cpu); return G.players.find(p => p.pid !== me.pid).pid;')
    # ---- 1) 簒奪札：使う → 見つけた札を見せる → 買う
    my_turn(page)
    give(page, ['sandatsu', 'kamikakushi'])
    G(page, 'G.players[%d].hand.push({ u: G.uid++, c: "murakumo" }); G.players[%d].hand = G.players[%d].hand.filter(h => h.c === "murakumo" || window.__yao.CARD[h.c].type === "spell"); window.__yao.changed();' % (foe, foe, foe))
    page.wait_for_timeout(400)
    tap_card(page, 'sandatsu')
    T.tap(page, '#gOpp .seat[data-pid="%d"]' % foe)
    page.wait_for_timeout(250)
    T.tap(page, '#gActs [data-act=item]')
    page.wait_for_timeout(1500)
    T.shot(page, 'sv_01_usurp_use')
    t1 = center(page)
    page.wait_for_timeout(1600)
    T.shot(page, 'sv_02_usurp_found')
    t2 = center(page)
    print('  ① 使う:', t1[:60])
    print('  ② 見つけた札:', t2[:80])
    if '簒奪' not in t1:
        problems.append('簒奪札を使ったことがまん中に出ない')
    if '見つけた札' not in t2 or '天叢雲剣' not in t2:
        problems.append('見つけた札がまん中に出ない: ' + t2)
    page.wait_for_selector('#gActs [data-act=buy]', timeout=20000)
    page.wait_for_timeout(300)
    T.shot(page, 'sv_03_usurp_decide')
    T.tap(page, '#gActs [data-act=buy]')
    page.wait_for_timeout(1300)
    T.shot(page, 'sv_04_usurp_bought')
    t3 = center(page)
    print('  ③ 結果:', t3[:80])
    if '買い取った' not in t3:
        problems.append('買い取った結果がまん中に出ない: ' + t3)
    wait_idle(page)
    # ---- 2) 相手が自分の札を品定めしているとき（自分の画面）
    me = G(page, 'return G.players.find(p => !p.cpu).pid;')
    G(page, '''const me = G.players.find(p => !p.cpu); const h = me.hand.find(x => window.__yao.CARD[x.c].type === "weapon");
      G.cur = %d; G.phase = "usurp"; G.deadline = 0; G.pend = { kind: "usurp", by: %d, targets: [me.pid], u: h.u, c: h.c, price: window.__yao.CARD[h.c].price, at: Date.now(), resp: {} };
      G.log.push({ k: "usurp", by: %d, to: me.pid, item: "sandatsu", card: h.c, price: window.__yao.CARD[h.c].price, s: ++G.seq }); window.__yao.changed();''' % (foe, foe, foe))
    page.wait_for_timeout(5500)
    T.shot(page, 'sv_05_usurp_victim_wait')
    t4 = center(page)
    print('  相手が品定め中（自分の画面）:', t4[:80])
    if '買うかどうか' not in t4:
        problems.append('品定めを待つあいだ、見つけた札がまん中に出ない: ' + t4)
    wait_idle(page, 40000)
    page.wait_for_timeout(1500)
    wait_idle(page, 40000)
    # ---- 3) 神隠し
    my_turn(page)
    G(page, 'const me = G.players.find(p => !p.cpu); me.mp = 30; G.weather = "nagi"; me.hand = me.hand.filter(h => h.c === "kamikakushi" || window.__yao.CARD[h.c].type === "weapon").slice(0, 6); G.players[%d].hand.push({ u: G.uid++, c: "kongo" }); G.players[%d].hand = G.players[%d].hand.filter(h => h.c === "kongo" || window.__yao.CARD[h.c].type === "spell"); window.__yao.changed();' % (foe, foe, foe))
    page.wait_for_timeout(400)
    tap_card(page, 'kamikakushi')
    T.tap(page, '#gOpp .seat[data-pid="%d"]' % foe)
    page.wait_for_timeout(250)
    T.tap(page, '#gActs [data-act=spell]')
    found = False
    for _ in range(40):
        page.wait_for_timeout(250)
        if 'うばった' in center(page):
            found = True
            page.wait_for_timeout(500)
            T.shot(page, 'sv_06_steal')
            break
    print('  神隠し:', center(page)[:80])
    if not found:
        problems.append('神隠しでうばった札がまん中に出ない')
    wait_idle(page, 40000)
    # ---- 4) 獏
    G(page, 'const me = G.players.find(p => !p.cpu); me.beast = "baku"; window.__yao.changed();')
    page.wait_for_timeout(400)
    for _ in range(6):
        page.evaluate('() => { const G = window.__yao.G(); const me = G.players.find(p => !p.cpu); window.__yao.assist(me.pid); window.__yao.changed(); }')
        page.wait_for_timeout(2400)
        txt = page.evaluate('() => [...document.querySelectorAll(".pop")].map(e => e.textContent).join(" ")')
        if '失った' in txt:
            T.shot(page, 'sv_07_baku')
            print('  獏:', txt)
            break
        wait_idle(page)
    log = page.evaluate('() => { const G = window.__yao.G(); return G.log.filter(e => e.k === "assist" && e.eff === "discard").length; }')
    if not log:
        problems.append('獏のアシストが起きない')
    print('  エラー:', page.errs[:5])
    problems.extend(page.errs)
    ctx.close()


if __name__ == '__main__':
    with sync_playwright() as p:
        browser = p.chromium.launch()
        run(p, browser)
        browser.close()
    print('\n==== 問題', len(problems), '件')
    for x in problems[:30]:
        print(' -', x)
