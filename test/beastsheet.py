# 霊獣の絵を一覧にして撮る（絵の確認用）
import json, os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('SHOTS', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots'))
art = open(os.path.join(ROOT, 'src', 'part-art.js'), encoding='utf8').read() + '\n' + open(os.path.join(ROOT, 'src', 'part-beast.js'), encoding='utf8').read()
only = sys.argv[1].split(',') if len(sys.argv) > 1 and sys.argv[1] else None
size = int(os.environ.get('W', '240'))
html = '''<!doctype html><meta charset=utf8><style>body{margin:0;background:#120a08;font:13px sans-serif;color:#ddd}
.g{display:flex;flex-wrap:wrap;gap:10px;padding:10px}.c{width:%dpx}.c svg{width:%dpx;height:%dpx;display:block;border-radius:8px}.c p{margin:3px 0 0;text-align:center}</style>
<svg width="0" height="0" style="position:absolute"><defs id="spriteDefs"></defs></svg><div class="g" id="g"></div><script>%s
installArt(); installBeastArt();
const MOCK=%s; const only=%s;
const ids = Object.keys(BART).filter(i => !only || only.includes(i));
document.getElementById('g').innerHTML = ids.map(id => '<div class="c"><svg viewBox="0 0 100 124"><use href="#bart-'+id+'"/>' + (MOCK ? '<rect x="73" y="3" width="24" height="88" fill="#fbf5e6" opacity=".9"/><rect x="3" y="3" width="23" height="23" fill="#a63f2c" opacity=".9"/>' : '') + '</svg><p>' + id + '</p></div>').join('');
</script>''' % (size, size, int(size * 1.24), art, 'true' if os.environ.get('MOCK') else 'false', json.dumps(only))
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': int(os.environ.get('VW', '1300')), 'height': 800}, device_scale_factor=1)
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.set_content(html)
    pg.wait_for_timeout(500)
    name = os.environ.get('NAME', 'beastsheet')
    pg.screenshot(path=os.path.join(OUT, name + '.png'), full_page=True)
    print('errors:', errs[:10])
    b.close()
