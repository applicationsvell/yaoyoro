# 全体の攻め：1人ずつ順番に「守りの札 → 結果 → ダメージ」を見せるか
import json, os, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_test as T
from scenario2 import start, my_turn, push, G, tap_card

SHOTS = T.SHOTS
problems = T.problems

WATCH = '''(pids) => {
  window.__al = { boards: [], chg: {} };
  const first = {};
  const hp = pid => { const s = document.querySelector('#gOpp .seat[data-pid="' + pid + '"] .hpnum'); return s ? s.textContent.trim() : null; };
  pids.forEach(p => { first[p] = hp(p); });
  let last = null;
  new MutationObserver(() => {
    const t = Math.round(performance.now());
    const b = document.querySelector('#gCenter > .c-stg .bt2.def');
    if (b && b !== last) { const st = b.querySelector('.bt-step'); const who = b.querySelector('.bt-who b'); window.__al.boards.push([t, who ? who.textContent : '', st ? st.textContent : '']); }
    last = b;
    pids.forEach(p => { if (!window.__al.chg[p] && hp(p) !== first[p]) window.__al.chg[p] = t; });
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
}'''


def scenario(p, browser, name, size, pad, mobile):
    print(f'== 全体の攻めを1人ずつ：{name}')
    ctx, page = start(p, browser, size, pad, mobile)
    if not my_turn(page):
        problems.append(f'[{name}] 自分の番が来ない')
        return
    # 相手は全員 体力60。1人目は守札あり、ほかは守札なし。天候と式神のふしぎな力は消す
    pids = G(page, '''const cs = G.players.filter(p => p.cpu && p.alive);
      cs.forEach((t, i) => { t.hp = 60; t.st.mist = 0; t.st.shell = 0; t.guardian = "kitsune"; t.beast = null;
        t.hand = t.hand.filter(h => window.__yao.CARD[h.c].type !== "armor"); if (i === 0) t.hand.push({ u: G.uid++, c: "domaru" }); });
      return cs.map(t => t.pid);''')
    push(page, 'me.hand.push({ u: G.uid++, c: "ozutsu" })')
    page.wait_for_timeout(700)
    page.evaluate(WATCH, pids)
    tap_card(page, 'ozutsu')
    T.tap(page, '#gActs [data-act=attack]')
    t0 = time.time()
    shot = False
    while time.time() - t0 < 40:
        al = page.evaluate('() => window.__al')
        if not shot and len(al['boards']) >= 2:
            T.shot(page, f'{name}_all_2nd')
            shot = True
        if len(al['chg']) >= len(pids) and len(al['boards']) >= len(pids):
            break
        page.wait_for_timeout(150)
    page.wait_for_timeout(500)
    al = page.evaluate('() => window.__al')
    res = G(page, 'const e = G.log.filter(x => x.k === "resolve" && x.by === me.pid).pop(); return e ? e.results.map(r => [r.t, r.how, r.dmg || 0]) : null;')
    print('  守りの盤（時刻・だれ・何人目）:', al['boards'])
    print('  体力が変わった時刻:', al['chg'])
    print('  結果:', res)
    if not res or len(al['boards']) < len(res):
        problems.append(f'[{name}] 1人ずつの守りの盤が出ていない: {al["boards"]} / {res}')
    else:
        steps = [b[2] for b in al['boards'][:len(res)]]
        exp = ['全体の攻め %d／%d' % (i + 1, len(res)) for i in range(len(res))]
        if steps != exp:
            problems.append(f'[{name}] 何人目かのしるしがちがう: {steps} / {exp}')
        # それぞれの人の体力は、その人の盤が出たあと・次の人の盤より前に変わる
        for i, (t, how, dmg) in enumerate(res):
            if how != 'hit' or not dmg:
                continue
            c = al['chg'].get(str(t))
            b0 = al['boards'][i][0]
            b1 = al['boards'][i + 1][0] if i + 1 < len(al['boards']) else 10 ** 12
            if not c or not (b0 + 1500 <= c <= b1):
                problems.append(f'[{name}] {i + 1}人目のダメージの時がおかしい: 盤{b0} 体力{c} 次の盤{b1}')
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
        if 'pc' in which:
            scenario(p, browser, 'pc', (1280, 800), (0, 0), False)
        browser.close()
    print('\n==== 問題', len(problems), '件')
    for x in problems[:40]:
        print(' -', x)
