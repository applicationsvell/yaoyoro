# 席の見た目を撮る（人数・画面の大きさ別）
import json, os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_test as T
from scenario2 import push

def run(p, browser, name, size, pad, mobile, cpus):
    ctx = T.new_context(p, browser, size, pad, mobile)
    page = ctx.new_page()
    page.add_init_script('window.__YAO_TEST = ' + json.dumps({'speed': 1, 'hook': True}) + ';')
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(T.URL); page.wait_for_timeout(400)
    T.tap(page, '#btnPractice'); T.set_profile(page, 'たつや', 0)
    page.wait_for_selector('#lobbyStart', timeout=4000)
    have = page.locator('#lobbySeats .lseat').count()
    for _ in range(cpus + 1 - have):
        T.tap(page, '#lobbyCpu')
    T.tap(page, '#lobbyStart')
    page.wait_for_selector('#scrGame:not([hidden])', timeout=5000)
    page.wait_for_timeout(3000)
    push(page, 'G.settings.turnSec = 0; G.players.forEach((p, i) => { p.hp = [95, 12, 47, 3, 120, 28, 8, 60][i % 8]; p.mp = [3, 18, 0, 25, 7, 11, 40, 2][i % 8]; p.gold = [0, 35, 120, 8, 999, 14, 60, 5][i % 8]; if (i === 2) p.beast = "seiryu"; })')
    page.wait_for_timeout(900)
    page.screenshot(path=os.path.join(T.SHOTS, f'seat_{name}.png'))
    print(name, 'errors', errs[:3])
    ctx.close()

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else ''
    with sync_playwright() as p:
        b = p.chromium.launch()
        run(p, b, 'phone4' + tag, (402, 812), (47, 34), True, 3)
        run(p, b, 'phone8' + tag, (402, 812), (47, 34), True, 7)
        run(p, b, 'land8' + tag, (874, 402), (0, 21), True, 7)
        run(p, b, 'pc8' + tag, (1280, 800), (0, 0), False, 7)
        b.close()
