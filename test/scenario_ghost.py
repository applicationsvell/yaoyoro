# 成仏したあと：天の声（次の巡の天候をえらぶ）と呪術（吉か凶が半々）
import json, os, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_test as T
from scenario2 import start, push, G

SHOTS = T.SHOTS
problems = T.problems


def wait_for(page, cond, limit=40):
    t0 = time.time()
    while time.time() - t0 < limit:
        if G(page, 'return !!(' + cond + ');'):
            return True
        page.wait_for_timeout(150)
    return False


def settle(page, limit=30):
    # 画面の演出が追いつくのを待つ
    t0 = time.time()
    while time.time() - t0 < limit:
        if page.evaluate('() => !window.__yao.busy() && window.__yao.shownSeq() === window.__yao.G().seq'):
            return True
        page.wait_for_timeout(120)
    return False


def scenario(p, browser, name, size, pad, mobile):
    print(f'== 成仏したあとの場面テスト：{name}')
    ctx, page = start(p, browser, size, pad, mobile)
    # 自分を成仏させる（CPUは長生き）。自分の番ではないときに
    for _ in range(3):
        if G(page, 'return G.phase === "act" && G.cur !== me.pid;'):
            break
        if G(page, 'return G.cur === me.pid && G.phase === "act";'):
            page.wait_for_timeout(1500)
            T.tap(page, '#gActs [data-act=pray]', must=False)
            page.wait_for_timeout(2500)
        if G(page, 'return G.phase === "swap";'):
            T.tap(page, '#gActs [data-act=noswap]', must=False)
        wait_for(page, 'G.phase === "act" && G.cur !== me.pid', 15)
    push(page, 'me.hp = 0; me.alive = false; me.hand.forEach(h => G.discard.push(h.c)); me.hand = []; G.players.forEach(p => { if (p.cpu) p.hp = 99; }); if (G.cur === me.pid) { G.phase = "act"; }')
    try:
        page.wait_for_selector('#gActs [data-act=ghostwx]', timeout=15000)
    except Exception:
        pass
    page.wait_for_timeout(300)
    acts = page.evaluate('() => [...document.querySelectorAll("#gActs [data-act]")].map(b => b.dataset.act)')
    print('  成仏したあとのボタン:', acts)
    if 'ghostwx' not in acts or 'ghosthex' not in acts:
        problems.append(f'[{name}] 天の声・呪術のボタンがない: {acts}')
    T.shot(page, f'{name}_g1_dead')
    # 神の目：相手をタップすると手札が見える
    settle(page)
    pid0 = G(page, 'return G.players.find(p => p.alive && p.pid !== me.pid).pid;')
    idx0 = page.evaluate('pid => [...document.querySelectorAll("#gOpp .seat")].findIndex(b => Number(b.dataset.pid) === pid)', pid0)
    T.tap(page, '#gOpp .seat', idx0)
    page.wait_for_timeout(400)
    shown_n = page.evaluate('() => document.querySelectorAll("#gCenter .god-hand .fuda").length')
    real_n = G(page, 'return G.players[' + str(pid0) + '].hand.length;')
    print('  神の目で見えた手札:', shown_n, '／ 実際の手札:', real_n)
    if shown_n != real_n or not shown_n:
        problems.append(f'[{name}] 神の目で手札が見えない: {shown_n} / {real_n}')
    T.shot(page, f'{name}_g1b_god')
    T.tap(page, '#gCenter [data-cact=close]', must=False)
    page.wait_for_timeout(200)
    # 天の声
    settle(page)
    T.tap(page, '#gActs [data-act=ghostwx]')
    page.wait_for_timeout(300)
    w = page.evaluate('() => { const b = document.querySelectorAll("#gCenter [data-vote]"); return b.length ? b[b.length - 1].dataset.vote : null; }')
    T.tap(page, '#gCenter [data-vote="' + str(w) + '"]')
    page.wait_for_timeout(700)
    print('  お知らせ:', page.evaluate('() => document.getElementById("toast").textContent'), 'ボタン:', page.evaluate('() => [...document.querySelectorAll("#gActs [data-act]")].map(b => b.dataset.act + (b.disabled ? "(押せない)" : ""))'))
    T.shot(page, f'{name}_g2_vote')
    v = G(page, 'return (G.wxVote || {})[me.pid];')
    vseq = G(page, 'return G.seq;')
    print('  天の声でえらんだ天候:', w, '→', v)
    if v != w:
        problems.append(f'[{name}] 天の声がとどいていない: {w} / {v}')
    T.tap(page, '#gActs [data-act=ghostback]')
    page.wait_for_timeout(200)
    # 呪術
    settle(page)
    T.tap(page, '#gActs [data-act=ghosthex]')
    page.wait_for_timeout(300)
    can = page.evaluate('() => [...document.querySelectorAll("#gOpp .seat.can")].map(b => Number(b.dataset.pid))')
    print('  呪術をかけられる席:', can)
    if not can:
        problems.append(f'[{name}] 呪術をかけられる席がない')
        return
    idx = page.evaluate('pid => [...document.querySelectorAll("#gOpp .seat")].findIndex(b => Number(b.dataset.pid) === pid)', can[0])
    T.tap(page, '#gOpp .seat', idx)
    page.wait_for_timeout(300)
    T.shot(page, f'{name}_g3_hex_pick')
    T.tap(page, '#gActs [data-act=hex]')
    if not wait_for(page, 'G.log.some(e => e.k === "hexcast" && e.by === me.pid)', 8):
        problems.append(f'[{name}] 呪術がかからない')
    # 次の番のはじめに効く
    if not wait_for(page, 'G.log.some(e => e.k === "hex" && e.by === me.pid)', 40):
        problems.append(f'[{name}] 呪術が効かない')
        print('  いまの盤面:', G(page, 'return [G.phase, G.cur, G.turn, G.round, G.seq, G.pend && G.pend.targets, JSON.stringify(G.hexQ), G.log.slice(-6).map(e => e.k).join(",")];'))
    page.wait_for_timeout(500)
    T.shot(page, f'{name}_g4_hex_cut')
    e = G(page, 'return G.log.filter(e => e.k === "hex" && e.by === me.pid).pop();')
    print('  呪術の結果:', e)
    used = page.evaluate('() => !!document.querySelector("#gActs [data-act=ghosthex]")')
    # 巡が変わる → 天の声の天候に
    if not wait_for(page, 'G.log.some(e => e.k === "weather" && e.s > ' + str(vseq) + ')', 120):
        problems.append(f'[{name}] 巡が変わらない')
    page.wait_for_timeout(300)
    T.shot(page, f'{name}_g5_weather')
    ww = G(page, 'const e = G.log.find(e => e.k === "weather" && e.s > ' + str(vseq) + '); return [e && e.w, e && e.voice];')
    me_pid = G(page, 'return me.pid;')
    print('  巡が変わったあとの天候:', ww, '（えらんだのは', w, '）')
    if ww[0] != w or ww[1] != me_pid:
        problems.append(f'[{name}] 天の声の天候にならない: {ww} / {w}')
    # 次の巡は、同じ相手には続けてかけられない
    wait_for(page, 'G.round > G.ghost[me.pid].round', 90)
    try:
        page.wait_for_selector('#gActs [data-act=ghosthex]:not([disabled])', timeout=15000)
    except Exception:
        pass
    settle(page)
    page.wait_for_timeout(300)
    ok = G(page, 'const last = G.ghost[me.pid]; return { used: last.round === G.round, last: last.to };')
    T.tap(page, '#gActs [data-act=ghosthex]', must=False)
    page.wait_for_timeout(400)
    can2 = page.evaluate('() => [...document.querySelectorAll("#gOpp .seat.can")].map(b => Number(b.dataset.pid))')
    print('  次の巡にかけられる席:', can2, '前の巡にかけた相手:', ok['last'])
    if ok['last'] in can2 or not can2:
        problems.append(f'[{name}] 前の巡と同じ相手にかけられる／だれにもかけられない: {can2}')
    T.shot(page, f'{name}_g6_hex_again')
    for x in page.errs[:5]:
        problems.append(f'[{name}] {x}')
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
