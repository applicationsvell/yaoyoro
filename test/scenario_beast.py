# 霊獣のアシスト：絵のカットインを2秒見せてから効くか。おみくじの入れかえ枚数
import json, os, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_test as T
from scenario2 import start, my_turn, push, G

SHOTS = T.SHOTS
problems = T.problems

WATCH = '''(sel) => {
  if (window.__bwob) window.__bwob.disconnect();
  window.__bw = { cut: 0, chg: 0, first: null };
  const el = () => document.querySelector(sel);
  window.__bw.first = el() ? el().textContent.trim() : null;
  const ob = new MutationObserver(() => {
    const t = Math.round(performance.now());
    if (!window.__bw.cut && document.querySelector('#cut.on .bcard .fuda.t-beast')) window.__bw.cut = t;
    const e = el();
    if (!window.__bw.chg && e && e.textContent.trim() !== window.__bw.first) window.__bw.chg = t;
  });
  window.__bwob = ob;
  ob.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
}'''


def one(page, name, beast, sel, setup):
    push(page, setup)
    page.wait_for_timeout(600)
    page.evaluate(WATCH, sel)
    push(page, 'me.beast = "' + beast + '"; window.__yao.assist(me.pid)')
    t0 = time.time()
    while time.time() - t0 < 6 and not page.evaluate('() => window.__bw.cut'):
        page.wait_for_timeout(40)
    page.wait_for_timeout(700)
    T.shot(page, f'{name}_beast_{beast}')
    while time.time() - t0 < 8 and not page.evaluate('() => window.__bw.chg'):
        page.wait_for_timeout(40)
    w = page.evaluate('() => window.__bw')
    gap = w['chg'] - w['cut'] if w['cut'] and w['chg'] else None
    print(f'  {beast}: カットインから効果まで(ms):', gap, w)
    if gap is None or not (1850 <= gap <= 2600):
        problems.append(f'[{name}] {beast} のアシストの間がおかしい: {gap}')
    page.wait_for_timeout(1200)


def scenario(p, browser, name, size, pad, mobile):
    print(f'== 霊獣のアシスト：{name}')
    ctx, page = start(p, browser, size, pad, mobile)
    if not my_turn(page):
        problems.append(f'[{name}] 自分の番が来ない')
        return
    one(page, name, 'seiryu', '#gMe .hpnum', 'me.hp = 50')
    tgt = G(page, 'const t = G.players.find(p => p.cpu && p.alive); return t.pid;')
    # 朱雀：相手を1人だけ残して、その席の体力を見る
    one(page, name, 'suzaku', '#gOpp', 'G.players.forEach(p => { if (p.cpu) { p.hp = 60; p.guardian = "oni"; p.st.shell = 0; } })')
    one(page, name, 'kinkei', '#gMe .gdv', 'me.gold = 10')
    T.shot(page, f'{name}_beast_after')
    # おみくじの大吉：5枚まで入れかえ（6枚目はえらべない）
    page.wait_for_timeout(1500)
    if my_turn(page):
        push(page, 'G.phase = "swap"; G.pend = { kind: "swap", by: me.pid, n: 5, targets: [me.pid], resp: {}, at: Date.now() }; G.deadline = 0')
        page.wait_for_timeout(900)
        before = G(page, 'return me.hand.filter(h => window.__yao.CARD[h.c].type !== "spell").map(h => h.u);')
        k = page.locator('#gHand > .fuda').count()
        for i in range(min(6, k)):
            T.tap(page, '#gHand > .fuda', i)
            page.wait_for_timeout(120)
        T.shot(page, f'{name}_kuji_swap5')
        picked = page.locator('#gHand > .fuda.add').count()
        T.tap(page, '#gActs [data-act=swap]')
        page.wait_for_timeout(1500)
        after = G(page, 'return me.hand.filter(h => window.__yao.CARD[h.c].type !== "spell").map(h => h.u);')
        gone = len(set(before) - set(after))
        print('  大吉の入れかえ：えらべた', picked, '入れかわった', gone, '手札', len(before), '→', len(after))
        if gone != 5 or len(after) != len(before):
            problems.append(f'[{name}] 大吉の5枚入れかえがおかしい: えらべた{picked} 入れかわった{gone}')
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
