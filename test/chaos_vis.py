# 「だれにでも使える札」と「ハプニング」の画面を、iPhone の大きさで撮って確かめる
#   python3 test/chaos_vis.py   （写真は test/shots/cv_*.png）
import os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_test as T

problems = T.problems
SEED = {'crit': 1, 'slip': 7, 'both': 708}   # すっぽ抜け・会心が出る乱数の状態（rnd の並びから探したもの）


def G(page, js):
    return page.evaluate('() => { const G = window.__yao.G(); ' + js + ' }')


def give(page, ids):
    # 自分（pid は me）の手札に札を足す
    return page.evaluate('''ids => { const G = window.__yao.G(); const me = G.players.find(p => !p.cpu);
      ids.forEach(id => me.hand.push({ u: G.uid++, c: id })); window.__yao.changed(); return me.pid; }''', ids)


def my_turn(page):
    page.evaluate('''() => { const G = window.__yao.G(); const me = G.players.find(p => !p.cpu);
      G.cur = me.pid; G.phase = 'act'; G.pend = null; G.deadline = 0; window.__yao.changed(); }''')
    page.wait_for_function('() => !!document.querySelector("#gActs [data-act=pray]")', timeout=30000)
    page.wait_for_timeout(300)


def tap_card(page, cid):
    page.evaluate('''cid => { const G = window.__yao.G(); const me = G.players.find(p => !p.cpu);
      const h = me.hand.filter(x => x.c === cid).pop(); const el = document.querySelector('#gHand .fuda[data-u="' + h.u + '"]'); el.scrollIntoView({ block: 'nearest', inline: 'center' }); }''', cid)
    page.wait_for_timeout(150)
    u = page.evaluate('cid => { const G = window.__yao.G(); const me = G.players.find(p => !p.cpu); return me.hand.filter(x => x.c === cid).pop().u; }', cid)
    T.tap(page, '#gHand .fuda[data-u="%d"]' % u)
    page.wait_for_timeout(350)


def wait_idle(page, ms=20000):
    page.wait_for_function('() => !window.__yao.busy()', timeout=ms)
    page.wait_for_timeout(300)


def run(p, browser):
    ctx = T.new_context(p, browser)
    page = T.open_page(ctx, speed=1, hook=True)
    T.tap(page, '#btnPractice')
    T.set_profile(page, 'たつや', 2)
    page.wait_for_selector('#lobbyStart', timeout=4000)
    T.tap(page, '#segTeams button', 1)
    page.wait_for_timeout(400)
    T.shot(page, 'cv_01_lobby')
    if not page.locator('#segChaos button[aria-pressed=true]').count():
        problems.append('待合室にハプニングの設定がない')
    T.tap(page, '#lobbyStart')
    page.wait_for_selector('#scrGame:not([hidden])', timeout=5000)
    page.wait_for_timeout(1500)
    # 練習はCPUの番も見せるので、操作しやすいように持ち時間なし・体力を多めに
    G(page, 'G.players.forEach(p => { p.hp = 40; }); window.__yao.changed();')
    wait_idle(page, 60000)
    # ---- 1) おにぎりを味方に
    my_turn(page)
    me = give(page, ['onigiri', 'shokan', 'abaregoma', 'bakeha', 'fukuwarai', 'katana'])
    ally = page.evaluate('me => { const G = window.__yao.G(); const m = G.players[me]; const a = G.players.find(p => p.pid !== me && p.team === m.team); a.hp = 9; if (a.guardian === "ryujin") a.guardian = "gama";   /* 龍神には霊獣をつけられないので */ window.__yao.changed(); return a.pid; }', me)
    page.wait_for_timeout(500)
    tap_card(page, 'onigiri')
    T.shot(page, 'cv_02_onigiri_self')
    T.tap(page, '#gOpp .seat[data-pid="%d"]' % ally)
    page.wait_for_timeout(300)
    T.shot(page, 'cv_03_onigiri_ally')
    btn = page.locator('#gActs [data-act=item]').inner_text()
    print('  おにぎりのボタン:', btn.replace('\n', ' '))
    if 'に使う' not in btn:
        problems.append('味方をえらんでも「〇〇に使う」にならない: ' + btn)
    T.tap(page, '#gActs [data-act=item]')
    page.wait_for_timeout(1400)
    T.shot(page, 'cv_04_onigiri_stage')
    wait_idle(page)
    hp = G(page, 'return G.players[%d].hp;' % ally)
    print('  味方の体力:', hp)
    if hp != 14:
        problems.append('おにぎりで味方の体力が回復していない: %s' % hp)
    # ---- 2) 味方を攻めようとすると確認が出る
    my_turn(page)
    tap_card(page, 'katana')
    T.tap(page, '#gOpp .seat[data-pid="%d"]' % ally)
    page.wait_for_timeout(300)
    T.shot(page, 'cv_05_katana_ally')
    if '味方です' not in page.locator('#gCenter').inner_text():
        problems.append('味方を攻めるときに注意が出ない')
    T.tap(page, '#gActs [data-act=cancel]')
    page.wait_for_timeout(200)
    # ---- 3) すっぽ抜け＋会心の一撃
    foe = G(page, 'const me = G.players.find(p => !p.cpu); return G.players.find(p => p.team !== me.team).pid;')
    tap_card(page, 'katana')
    T.tap(page, '#gOpp .seat[data-pid="%d"]' % foe)
    page.wait_for_timeout(200)
    G(page, 'G.rng = %d;' % SEED['both'])
    T.tap(page, '#gActs [data-act=attack]')
    page.wait_for_timeout(1250)
    T.shot(page, 'cv_06_slip')
    page.wait_for_timeout(1500)
    T.shot(page, 'cv_07_crit')
    d = G(page, 'const e = G.log.slice().reverse().find(x => x.k === "declare"); return e && { slip: e.slip, crit: e.crit, to: e.targets[0], base: e.base };')
    print('  攻めの記録:', d)
    if not d or d.get('slip') is None or not d.get('crit'):
        problems.append('すっぽ抜け・会心が起きなかった: %s' % d)
    page.wait_for_timeout(2500)
    # 守りの番が自分に来たら受ける
    for _ in range(60):
        if page.locator('#gActs [data-act=take]').count():
            T.tap(page, '#gActs [data-act=take]'); break
        if not G(page, 'return G.phase === "defend";'):
            break
        page.wait_for_timeout(300)
    wait_idle(page, 60000)
    # ---- 4) 霊獣を味方に
    my_turn(page)
    tap_card(page, 'shokan')
    T.tap(page, '#gOpp .seat[data-pid="%d"]' % ally)
    page.wait_for_timeout(300)
    T.shot(page, 'cv_08_summon_ally')
    T.tap(page, '#gActs [data-act=summon]')
    page.wait_for_timeout(1200)
    T.shot(page, 'cv_09_summon_cut')
    wait_idle(page)
    if not G(page, 'return !!G.players[%d].beast;' % ally):
        problems.append('霊獣が味方につかない')
    # ---- 5) 狸の化け葉
    my_turn(page)
    G(page, 'const me = G.players.find(p => !p.cpu); me.hp = 6; G.players[%d].hp = 33; window.__yao.changed();' % foe)
    page.wait_for_timeout(400)
    tap_card(page, 'bakeha')
    T.tap(page, '#gOpp .seat[data-pid="%d"]' % foe)
    page.wait_for_timeout(300)
    T.shot(page, 'cv_10_bakeha')
    T.tap(page, '#gActs [data-act=item]')
    page.wait_for_timeout(2600)
    T.shot(page, 'cv_11_bakeha_stage')
    wait_idle(page)
    if G(page, 'const me = G.players.find(p => !p.cpu); return me.hp;') != 33:
        problems.append('狸の化け葉で体力が入れかわらない')
    # ---- 6) 福笑い
    my_turn(page)
    tap_card(page, 'fukuwarai')
    T.tap(page, '#gActs [data-act=item]')
    page.wait_for_timeout(2900)
    T.shot(page, 'cv_12_fukuwarai')
    wait_idle(page)
    # 手札の表示が実際の手札と同じか
    same = page.evaluate('''() => { const G = window.__yao.G(); const me = G.players.find(p => !p.cpu);
      const shown = [...document.querySelectorAll('#gHand .fuda[data-u]')].map(e => Number(e.dataset.u)).sort((a, b) => a - b);
      const real = me.hand.map(h => h.u).sort((a, b) => a - b); return JSON.stringify(shown) === JSON.stringify(real); }''')
    if not same:
        problems.append('福笑いのあと、手札の表示が実際とちがう')
    # ---- 7) 巡のはじめのハプニング（全部）
    G(page, 'G.players.forEach((p, i) => { p.gold = 8 + i * 9; }); window.__yao.changed();')
    page.wait_for_timeout(400)
    for i, hid in enumerate(['nezumi', 'nagareboshi', 'jishin', 'matsuri', 'yomeiri', 'irekawari', 'iede', 'takarakuji']):
        if hid == 'iede':
            G(page, 'G.players.forEach((p, i) => { if (i % 2 === 0 && p.guardian !== "ryujin") p.beast = "kirin"; }); window.__yao.changed();')
            page.wait_for_timeout(400)
        e = page.evaluate('id => window.__yao.happen(id)', hid)
        if not e:
            problems.append('ハプニングが起きない: ' + hid)
            continue
        page.wait_for_timeout(1000)
        if i in (0, 2, 4, 5):
            T.shot(page, 'cv_13_happen_' + hid)
        wait_idle(page)
        page.wait_for_timeout(200)
    same = page.evaluate('''() => { const G = window.__yao.G(); const me = G.players.find(p => !p.cpu);
      const shown = [...document.querySelectorAll('#gHand .fuda[data-u]')].map(e => Number(e.dataset.u)).sort((a, b) => a - b);
      const real = me.hand.map(h => h.u).sort((a, b) => a - b); return JSON.stringify(shown) === JSON.stringify(real); }''')
    if not same:
        problems.append('ハプニングのあと、手札の表示が実際とちがう')
    seats = page.evaluate('''() => { const G = window.__yao.G(); return [...document.querySelectorAll('#gOpp .seat')].every(s => { const p = G.players[Number(s.dataset.pid)]; return s.querySelector('.hn b').textContent === String(p.hand.filter(h => window.__yao.CARD[h.c].type !== 'spell').length); }); }''')
    if not seats:
        problems.append('相手の席の札の数が実際とちがう')
    # ---- 8) 遊び方のハプニング
    T.tap(page, '#gMenu')
    page.wait_for_timeout(200)
    T.tap(page, '#mHow')
    page.wait_for_timeout(200)
    page.evaluate('() => { const b = [...document.querySelectorAll("#howTabs button")].find(x => x.dataset.tab === "happen"); b.click(); }')
    page.wait_for_timeout(300)
    T.shot(page, 'cv_14_how_happen')
    page.evaluate('() => { document.getElementById("howBody").scrollTop = 900; }')
    page.wait_for_timeout(200)
    T.shot(page, 'cv_15_how_happen2')
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
