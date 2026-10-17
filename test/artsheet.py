# 札の絵を一覧にして撮る（絵の確認用）
import json, os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('SHOTS', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots'))
art = open(os.path.join(ROOT, 'src', 'part-art.js'), encoding='utf8').read()
cards = json.load(open(os.path.join(ROOT, 'src', 'cards.json'), encoding='utf8'))['cards']
only = sys.argv[1].split(',') if len(sys.argv) > 1 and sys.argv[1] else None
size = int(os.environ.get('W', '150'))
ids = [c['id'] for c in cards if not only or c['id'] in only or c['type'] in only]
names = {c['id']: c['name'] for c in cards}
html = '''<!doctype html><meta charset=utf8><style>body{margin:0;background:#120a08;font:12px sans-serif;color:#ddd}
.g{display:flex;flex-wrap:wrap;gap:8px;padding:8px}.c{width:%dpx}.c svg{width:%dpx;height:%dpx;display:block;border-radius:6px}.c p{margin:2px 0 0;text-align:center}</style>
<svg width="0" height="0" style="position:absolute"><defs id="spriteDefs"></defs></svg><div class="g" id="g"></div><script>%s
installArt();
const MOCK=%s; const ids=%s, names=%s;
document.getElementById('g').innerHTML = ids.map(id => '<div class="c"><svg viewBox="0 0 100 124">' + (hasArt(id) ? '<use href="#art-'+id+'"/>' + (MOCK ? '<rect x="73" y="3" width="24" height="88" fill="#fbf5e6" opacity=".92"/><rect x="3" y="3" width="23" height="23" fill="#a63f2c" opacity=".92"/>' : '') : '<rect width="100" height="124" fill="#333"/><text x="50" y="62" fill="#f66" font-size="10" text-anchor="middle">なし</text>') + '</svg><p>' + names[id] + '</p></div>').join('');
</script>''' % (size, size, int(size * 1.24), art, 'true' if os.environ.get('MOCK') else 'false', json.dumps(ids), json.dumps(names, ensure_ascii=False))
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': int(os.environ.get('VW', '1280')), 'height': 800}, device_scale_factor=1)
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.set_content(html)
    pg.wait_for_timeout(500)
    name = os.environ.get('NAME', 'artsheet')
    pg.screenshot(path=os.path.join(OUT, name + '.png'), full_page=True)
    print('missing:', [i for i in ids if not pg.evaluate('id => !!document.getElementById("art-" + id)', i)][:200])
    print('errors:', errs[:10])
    b.close()
