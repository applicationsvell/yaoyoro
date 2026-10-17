# 舞台：使った札を大きく出して、約2秒見せてから効果が出るか
import json, os, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_test as T
from scenario2 import start, my_turn, push, G, tap_card, tap_seat

SHOTS = T.SHOTS
problems = T.problems

WATCH = '''(sel) => {
  if (window.__stob) window.__stob.disconnect();
  window.__st = { open: [], close: [], chg: 0, first: null };
  const el = () => document.querySelector(sel);
  window.__st.first = el() ? el().textContent.trim() : null;
  let on = false;
  const ob = new MutationObserver(() => {
    const t = Math.round(performance.now());
    const cur = document.querySelector('#gCenter > .c-stg');
    if (cur && cur !== on) { if (on) window.__st.close.push(t); window.__st.open.push(t); }
    if (!cur && on) window.__st.close.push(t);
    on = cur || false;
    const e = el();
    if (!window.__st.chg && e && e.textContent.trim() !== window.__st.first) window.__st.chg = t;
  });
  window.__stob = ob;
  ob.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
}'''


def waitv(page, js, limit=15):
    t0 = time.time()
    while time.time() - t0 < limit:
        v = page.evaluate(js)
        if v:
            return v
        page.wait_for_timeout(40)
    return None


def scenario(p, browser, name, size, pad, mobile):
    print(f'== 札を大きく見せる舞台：{name}')
    ctx, page = start(p, browser, size, pad, mobile)
    if not my_turn(page):
        problems.append(f'[{name}] 自分の番が来ない')
        return
    # 1) 道具：おにぎりで回復
    push(page, 'me.hp = 40; me.hand.push({ u: G.uid++, c: "onigiri" })')
    page.wait_for_timeout(600)
    page.evaluate(WATCH, '#gMe .hpnum')
    tap_card(page, 'onigiri')
    T.tap(page, '#gActs [data-act=item]')
    waitv(page, '() => window.__st.open.length')
    page.wait_for_timeout(900)
    T.shot(page, f'{name}_stage_item')
    waitv(page, '() => window.__st.chg')
    st = page.evaluate('() => window.__st')
    gap = st['chg'] - st['open'][0] if st['open'] and st['chg'] else None
    print('  道具：舞台が出てから体力が変わるまで(ms):', gap)
    if gap is None or gap < 2400:
        problems.append(f'[{name}] 道具の効果が早すぎる: {gap}')
    # 2) 攻め：太刀で攻める
    if not my_turn(page):
        problems.append(f'[{name}] 2回目の自分の番が来ない')
        return
    tgt = G(page, 'const t = G.players.find(p => p.cpu && p.alive); t.hp = 60; t.st.mist = 0; t.hand = t.hand.filter(h => window.__yao.CARD[h.c].type !== "armor"); t.hand.push({ u: G.uid++, c: "tenugui" }); return t.pid;')
    push(page, 'me.hand.push({ u: G.uid++, c: "katana" })')
    page.wait_for_timeout(600)
    page.evaluate(WATCH, '#gOpp .seat[data-pid="' + str(tgt) + '"] .hpnum')
    tap_card(page, 'katana')
    tap_seat(page, tgt)
    T.tap(page, '#gActs [data-act=attack]')
    waitv(page, '() => window.__st.open.length')
    page.wait_for_timeout(1000)
    T.shot(page, f'{name}_stage_attack')
    waitv(page, '() => window.__st.open.length >= 2', 15)
    page.wait_for_timeout(900)
    T.shot(page, f'{name}_stage_defend')
    waitv(page, '() => window.__st.chg', 15)
    st = page.evaluate('() => window.__st')
    print('  攻め：舞台が開いた/閉じた時刻:', st['open'], st['close'], '体力が変わった:', st['chg'])
    if len(st['open']) < 2 or not st['close']:
        problems.append(f'[{name}] 攻めと守りの舞台が出ていない: {st}')
    else:
        d1 = st['close'][0] - st['open'][0]
        print('  攻めの舞台を見せた時間(ms):', d1)
        if d1 < 2600:
            problems.append(f'[{name}] 攻めの舞台が短い: {d1}')
        res = G(page, 'const e = G.log.filter(x => x.k === "resolve").pop(); return e ? e.results[0] : null;')
        print('  守りの結果:', res and res.get('how'), res and res.get('dmg'))
        if res and res.get('how') == 'hit' and res.get('dmg'):
            if not st['chg'] or st['chg'] < st['open'][1] + 2000:
                problems.append(f'[{name}] 守りを見せたあとにダメージが出ていない: {st}')
    page.wait_for_timeout(1500)
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
