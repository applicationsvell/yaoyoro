# 成仏の演出：体力が0になってから2秒後に、光の柱・魂・ハンコで成仏するか
import json, os, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_test as T
from scenario2 import start, my_turn, push, G, tap_card, tap_seat

SHOTS = T.SHOTS
problems = T.problems

WATCH = '''() => {
  window.__ko = { zero: 0, fx: 0, dying: 0 };
  const seat = () => document.querySelector('#gOpp .seat[data-pid="' + window.__tgt + '"]');
  const ob = new MutationObserver(() => {
    const s = seat();
    const t = performance.now();
    if (s && !window.__ko.zero) { const n = s.querySelector('.hpnum'); if (n && /体0$/.test(n.textContent.trim())) window.__ko.zero = Math.round(t); }
    if (s && !window.__ko.dying && s.classList.contains('dying')) window.__ko.dying = Math.round(t);
    if (!window.__ko.fx && document.querySelector('#fx .kopil, #fx .koring')) window.__ko.fx = Math.round(t);
  });
  ob.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
}'''


def scenario(p, browser, name, size, pad, mobile):
    print(f'== 成仏の場面テスト：{name}')
    ctx, page = start(p, browser, size, pad, mobile)
    if not my_turn(page):
        problems.append(f'[{name}] 自分の番が来ない')
        return
    tgt = G(page, 'const t = G.players.find(p => p.cpu && p.alive); t.hp = 4; t.st.mist = 0; t.hand = t.hand.filter(h => window.__yao.CARD[h.c].type !== "armor"); t.guardian = "kitsune"; return t.pid;')
    push(page, 'G.players.forEach(p => { if (p.cpu && p.pid !== ' + str(tgt) + ') p.hp = 90; }); me.hand.push({ u: G.uid++, c: "katana" })')
    page.wait_for_timeout(500)
    page.evaluate('t => { window.__tgt = t; }', tgt)
    page.evaluate(WATCH)
    tap_card(page, 'katana')
    tap_seat(page, tgt)
    T.tap(page, '#gActs [data-act=attack]')
    # 体力0になるまで待つ
    t0 = time.time()
    while time.time() - t0 < 15 and not page.evaluate('() => window.__ko.zero'):
        page.wait_for_timeout(50)
    page.wait_for_timeout(700)
    T.shot(page, f'{name}_ko1_zero')
    while time.time() - t0 < 20 and not page.evaluate('() => window.__ko.fx'):
        page.wait_for_timeout(40)
    page.wait_for_timeout(250)
    ts = time.time()
    page.screenshot(path=os.path.join(SHOTS, f'{name}_ko2_fx.png'))
    t2 = time.time()
    page.wait_for_timeout(200)
    page.screenshot(path=os.path.join(SHOTS, f'{name}_ko3_fx.png'))
    print('  撮った時刻（演出が始まってから・秒）: %.2f, %.2f' % (0.25 + (ts - ts), 0.25 + (time.time() - ts)), '1枚撮るのにかかった秒: %.2f' % (t2 - ts))
    page.wait_for_timeout(1600)
    T.shot(page, f'{name}_ko4_after')
    k = page.evaluate('() => window.__ko')
    gap = k['fx'] - k['zero'] if k['zero'] and k['fx'] else None
    print('  体力0から成仏の演出まで(ms):', gap, k)
    if gap is None or not (1850 <= gap <= 2600):
        problems.append(f'[{name}] 体力0から成仏までの間がおかしい: {gap}')
    dead = G(page, 'return !G.players[' + str(tgt) + '].alive;')
    seat_dead = page.evaluate('t => { const s = document.querySelector("#gOpp .seat[data-pid=\\"" + t + "\\"]"); return !!s && s.classList.contains("dead"); }', tgt)
    print('  成仏した:', dead, '席が成仏の見た目:', seat_dead)
    if not dead or not seat_dead:
        problems.append(f'[{name}] 成仏のあとの席がおかしい')
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
