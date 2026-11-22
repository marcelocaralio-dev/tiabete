# Compara duas versões compiladas (www/ original × www/ com a identidade GLUXO) tela a tela, nos dois temas:
#  1. LAYOUT: posição e tamanho de todos os elementos devem ser iguais (tolerância 0,6 px), exceto a área do logotipo;
#  2. CORES: lista o que mudou de cor e confere que NENHUM elemento clínico (glicemia, alertas de saúde, gráficos) mudou.
# Uso: python3 tests/browser/identidade-compara.py <www_original> <www_novo>
import sys, os, time, json
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
A, B = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ('/tmp/base/www', os.path.join(ROOT, 'www'))
SEED = open(os.path.join(ROOT, 'tests', 'seed-analise.js'), encoding='utf8').read()
INIT = """(()=>{let s=12345;Math.random=()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296};const R=Date,F=new R('2026-11-22T15:00:00-03:00').getTime(),T0=R.now();
class D extends R{constructor(...a){if(a.length)super(...a);else super(F+(R.now()-T0))} static now(){return F+(R.now()-T0)}};window.Date=D;})();"""
ROUTES = ['painel', 'historico', 'analise', 'metricas', 'exames', 'esquemas', 'hba1c', 'config', 'mais', 'b:alimentos', 'b:cafe', 'b:razao']
CLIN = """e=>{const q=['.badge','.rec.g-low','.rec.g-vlow','.rec.g-high','.rec.g-vhigh','.rec.epi','.hbar','.hero.b-high','.hero.b-vhigh','.hero.b-low','.hero.b-vlow','.gz','.gauge','.gauge-sm','.chart svg','svg.spark','.hm','.hm-low','.hm-high','.hm-vhigh','.hm-ok','.hm-sw','.banner.hypo','.banner.hyper','.tile.alert','.delta-up','.tag.up','.d-vlow','.d-ok','[class*="epi-"]','.sheet[data-gl]','.hy-big','.hy-lv','.hy-timer','.pn-c.alert','.pn-c.st-bad','.chip.alert','.err','.ref-lab','.lg-line','.lg-dash','.an-b-low','.an-b-vlow','.an-b-high','.an-b-vhigh','.an-b-ok','.an-arc','.an-col.c-low','.an-col.c-high','.an-card.t-low','.an-card.t-high','.an-kpi.k-low','.an-kpi.k-high','.hbar-l','.pm-big','.lxs','.pn-clk.over','.tl','.ib-bar','.a1m-bar','.hba2','.acb','.acz.hot','.lk-msg','.bl-err','.tag.bl-dose','.ir-st','.ir-w']; if(e.closest('button,.tip,.btn'))return false;return q.some(s=>{try{return e.closest(s)}catch(x){return false}})}"""
PROPS = ['color', 'backgroundColor', 'borderTopColor', 'borderLeftColor', 'outlineColor', 'fill', 'stroke', 'boxShadow', 'backgroundImage']
COLLECT = """([routes,clin])=>{const f=eval(clin);const out=[];const els=[...document.querySelectorAll('.top *, #view *, .nav *')].filter(e=>!e.closest('.logo'));
 for(const e of els){const cs=getComputedStyle(e),b=e.getBoundingClientRect();out.push({k:e.tagName+'.'+(typeof e.className==='string'?e.className:(e.className.baseVal||'')),r:[b.x,b.y,b.width,b.height].map(x=>Math.round(x*10)/10),s:%s.map(p=>cs[p]),c:f(e)})}
 return out}""" % json.dumps(PROPS)
def snap(p, www, theme, route):
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 412, 'height': 860}, is_mobile=True, has_touch=True); ctx.add_init_script(INIT); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + www + '/index.html'); time.sleep(.9)
    pg.add_style_tag(content='#rw-bg,#tb-gate,#tb-splash{display:none!important;pointer-events:none!important}*{animation:none!important;transition:none!important}')
    pg.evaluate(SEED); time.sleep(1.2)
    pg.evaluate("window.licAllowed=()=>true; S.ana.range='all'"); pg.evaluate("t=>document.documentElement.setAttribute('data-theme',t)", theme)
    pg.evaluate("r=>{if(r.startsWith('b:')){S.blUi.tab=r.slice(2);S.route='bolus'}else S.route=r;render()}", route); time.sleep(1.8)
    if route == 'analise': pg.evaluate("document.querySelectorAll('[data-act=\"an-all\"]').forEach(b=>b.click())"); time.sleep(.6)
    d = pg.evaluate(COLLECT, [ROUTES, CLIN]); b.close(); return d, errs
fail = 0; summary = {}
with sync_playwright() as p:
    for theme in ['dark', 'light']:
        for route in ROUTES:
            a, e1 = snap(p, A, theme, route); b, e2 = snap(p, B, theme, route)
            if len(a) != len(b): print('FALHOU: %s/%s: número de elementos diferente (%d × %d)' % (theme, route, len(a), len(b))); fail += 1; continue
            lay = [(i, x['k']) for i, (x, y) in enumerate(zip(a, b)) if any(abs(m - n) > .6 for m, n in zip(x['r'], y['r']))]
            if lay: print('FALHOU: %s/%s: %d elementos com posição/tamanho diferente, ex.: %s' % (theme, route, len(lay), lay[:3])); fail += 1
            chg = [(x, y) for x, y in zip(a, b) if x['s'] != y['s']]
            bad = [x['k'] for x, y in chg if x['c']]
            if bad: print('FALHOU: %s/%s: %d elementos CLÍNICOS mudaram de cor: %s' % (theme, route, len(bad), sorted(set(bad))[:6])); fail += 1
            if e1 or e2: print('FALHOU: erros de script', theme, route, e1[:1], e2[:1]); fail += 1
            for x, y in chg:
                if not x['c']: summary[x['k'].split(' ')[0][:48]] = summary.get(x['k'].split(' ')[0][:48], 0) + 1
            print('%s/%s: %d elementos, layout igual, %d com cor de marca alterada, %d clínicos alterados' % (theme, route, len(a), len(chg), len(bad)))
print('Tipos de elemento com cor de marca alterada (top 25):', sorted(summary.items(), key=lambda t: -t[1])[:25])
print('%d falha(s)' % fail if fail else 'comparação ok'); sys.exit(1 if fail else 0)
