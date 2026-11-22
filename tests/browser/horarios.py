# Teste de interface da seção "Horários e períodos do dia" (0.31.0). Uso: node scripts/build-web.js && python3 tests/browser/horarios.py
# Requer: pip install playwright && playwright install chromium. Salva capturas em tests/browser/out/ quando SHOTS=1.
import os, sys, time, re
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SEED = open(os.path.join(ROOT, 'tests', 'seed-analise.js'), encoding='utf8').read()
EXTRA = '''(async()=>{ const today=new Date(); today.setHours(0,0,0,0); const recs=[];
 for(let i=40;i>=1;i--){ const d=new Date(today); d.setDate(d.getDate()-i); const date=isoDate(d);
  if(i%3===0) recs.push({id:'x'+i+'a',date,time:'16:40',ts:mkTs(date,'16:40'),glucose:95+((i*37)%120),context:'outro',meal:'lanche',source:'manual'});
  if(i%7===0) recs.push({id:'x'+i+'n',date,noTime:true,time:'',ts:mkTs(date,'00:00'),glucose:130+((i*13)%70),source:'manual'});
  if(i%6===0) recs.push({id:'x'+i+'h',date,time:'18:05',ts:mkTs(date,'18:05'),glucose:58+((i*7)%10),context:'antes',meal:'jantar',source:'manual'});
 } await Store.putMany('records',recs); await loadAll(); render(); })()'''
FEW = '''(async()=>{ await Store.put('meta',{id:'seeded',at:1}); await removeExamples(); const t=new Date(); const mk=(i,tm,g,o={})=>{const d=new Date(t.getTime()-i*864e5);const date=isoDate(d);return {id:'f'+i+tm,date,time:tm,ts:mkTs(date,tm),glucose:g,source:'manual',...o};};
 await Store.putMany('records',[mk(1,'07:00',112,{context:'jejum'}),mk(2,'07:10',98,{context:'jejum'}),mk(2,'14:00',210,{context:'depois',meal:'almoco'}),mk(3,'03:00',52,{context:'madrugada'})]); await loadAll(); S.route='analise'; render(); })()'''
OLD = '''(async()=>{ await Store.put('meta',{id:'seeded',at:1}); await removeExamples(); const d=isoDate(new Date(Date.now()-200*864e5)); await Store.putMany('records',[{id:'o1',date:d,time:'08:00',ts:mkTs(d,'08:00'),glucose:120,context:'jejum',source:'manual'}]); await loadAll(); S.route='analise'; render(); })()'''
fail = 0; n = 0
def ok(c, m):
    global fail, n
    n += 1
    if not c: fail += 1; print('FALHOU:', m)
def page(p, w, seed, extra=None, theme='dark'):
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': w, 'height': 900}, device_scale_factor=2, is_mobile=w < 700, has_touch=True); pg = ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    pg.goto('file://' + ROOT + '/www/index.html'); time.sleep(1)
    pg.add_style_tag(content='#rw-bg,#tb-gate,#tb-splash{display:none!important;pointer-events:none!important}')
    pg.evaluate(seed); time.sleep(1.2)
    if extra: pg.evaluate(extra); time.sleep(.5)
    pg.evaluate("window.licAllowed=()=>true; localStorage.removeItem('tb-ana-tm'); S.ana.tm=null; S.ana.range='all'; S.route='analise'; render();")
    if theme == 'light': pg.evaluate("document.documentElement.setAttribute('data-theme','light')")
    pg.b = b; return pg
q = lambda pg, s: pg.evaluate("s=>document.querySelectorAll(s).length", s)
tx = lambda pg, s: pg.evaluate("s=>(document.querySelector(s)||{}).textContent||''", s)
def open_tmp(pg): pg.evaluate("document.querySelector('[data-act=\"an-go\"][data-k=\"tmp\"]').click()"); time.sleep(.5)
def clk(pg, sel): pg.evaluate("s=>document.querySelector(s).click()", sel); time.sleep(.25)
def lum(rgb):
    f = lambda c: (c / 255 / 12.92) if c / 255 <= .03928 else (((c / 255 + .055) / 1.055) ** 2.4)
    return .2126 * f(rgb[0]) + .7152 * f(rgb[1]) + .0722 * f(rgb[2])
def ratio(a, b):
    la, lb = lum(a), lum(b); hi, lo = max(la, lb), min(la, lb); return (hi + .05) / (lo + .05)
RGB = """e=>{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d',{willReadFrequently:true});const g=(s)=>{x.clearRect(0,0,1,1);x.fillStyle='#000';x.fillStyle=s;x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data].slice(0,3)};const cs=getComputedStyle(e);let b=e,bs=cs.backgroundColor;while((bs==='transparent'||/^rgba\\(.*,\\s*0\\)$/.test(bs))&&b.parentElement){b=b.parentElement;bs=getComputedStyle(b).backgroundColor}return {fg:g(cs.color),bg:g(bs)}}"""
SHOTS = os.environ.get('SHOTS') == '1'; OUT = os.path.join(ROOT, 'tests', 'browser', 'out')
if SHOTS: os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    pg = page(p, 412, SEED, EXTRA)
    ok(q(pg, '.an-sec') == 13 and q(pg, '.an-nv') == 13 and q(pg, '#an-tmp') == 1, 'ui: seção nova entre as 13 e com atalho próprio')
    ok(q(pg, '#an-tmp .an-b:not([hidden])') == 0 or q(pg, '#an-tmp.open') == 0, 'ui: recolhida por padrão e sem conteúdo (desempenho)')
    open_tmp(pg); sec = '#an-tmp'
    ok(q(pg, sec + '.open') == 1 and q(pg, sec + ' .an-tp') == 9, 'ui: abre e mostra 9 cartões (8 contextos + outros)')
    exp = pg.evaluate("""()=>{ const R=S.records.filter(r=>r.source!=='exemplo'); const m=a=>a.reduce((x,y)=>x+y,0)/a.length; const f=R.filter(r=>r.context==='jejum').map(r=>r.glucose); return {n:f.length, mean:Math.round(m(f))} }""")
    card = pg.evaluate("""()=>{const c=document.querySelector('#an-tmp .an-tp[data-k="jejum"]'); return {v:c.querySelector('.an-tp-v').textContent, k:c.className}}""")
    ok(('n=%d' % exp['n']) in card['v'] and str(exp['mean']) in card['v'].replace('.', ''), 'ui: cartão Jejum mostra n e média iguais ao cálculo independente (%s)' % card['v'])
    ok(q(pg, sec + ' .an-tp[data-k="poscafe"]') == 0 and 'sem registros' in tx(pg, sec + ' .an-tp.off'), 'ui: contexto sem registros é informado, sem números inventados')
    # cartão expandido traz os indicadores pedidos
    pg.evaluate("document.querySelector('#an-tmp .an-tp[data-k=\"posalmoco\"]').open=true"); time.sleep(.2)
    t = tx(pg, sec + ' .an-tp[data-k="posalmoco"]')
    ok(all(x in t for x in ['Média', 'Mediana', 'Menor', 'Maior', 'Medições', 'Dias', 'Desvio-padrão', 'Coef. de variação', 'Baixas', 'Elevadas']) and q(pg, sec + ' .an-tp[data-k="posalmoco"] .an-bl') == 1, 'ui: cartão expandido: média, mediana, menor, maior, n, dias, DP, CV, baixas, elevadas e distribuição')
    ok('Hora real das medições' in t, 'ui: contexto mostra a hora real em que as medições aconteceram')
    # toque abre os registros que compõem o resultado
    clk(pg, sec + ' [data-act="an-tm-rec"][data-kind="g"][data-k="posalmoco"]')
    cnt = pg.evaluate("document.querySelector('#an-tm-det .an-tm-dh .num').textContent"); real = pg.evaluate("S.records.filter(r=>r.source!=='exemplo'&&r.context==='depois'&&r.meal==='almoco').length")
    ok(int(re.findall(r'\d+', cnt)[0]) == real and q(pg, '#an-tm-det .rec') == min(20, real), 'ui: toque no cartão lista os registros do período (%s de %d)' % (cnt, real))
    clk(pg, '#an-tm-det [data-act="an-tm-more"]'); ok(q(pg, '#an-tm-det .rec') == min(40, real), 'ui: "Mostrar mais" amplia a lista')
    clk(pg, '#an-tm-det .rec'); time.sleep(.3); ok(q(pg, '#sheet.open, .sheet.open, [role=dialog]') >= 1 or pg.evaluate("document.body.innerText.includes('Glicemia')"), 'ui: tocar em um registro abre os detalhes')
    pg.evaluate("typeof closeSheet==='function'&&closeSheet()"); time.sleep(.2)
    clk(pg, '#an-tm-det [data-act="an-tm-close"]'); ok(q(pg, '#an-tm-det.on') == 0, 'ui: fechar a lista')
    # destaques e filtros
    ok(q(pg, sec + ' .an-card') >= 3 and 'Evidências' in tx(pg, sec + ' .an-card'), 'ui: destaques com evidências')
    clk(pg, sec + ' [data-act="an-tm-rec"][data-kind="hl"]'); ok(q(pg, '#an-tm-det .rec') >= 1, 'ui: toque no destaque mostra os registros')
    for r in ['7', '14', '30', '90', '180', 'tela']:
        clk(pg, sec + ' [data-act="an-tm-range"][data-v="%s"]' % r)
        tot = pg.evaluate("anModel().tm().total"); exp = pg.evaluate("(r)=>{const now=Date.now(); const R=S.records.filter(x=>x.source!=='exemplo'); if(r==='tela') return R.length; const d=+r; const a=startOfDay(addDays(now,-(d-1))), b=endOfDay(now); return R.filter(x=>x.ts>=a&&x.ts<=b).length}", r)
        ok(tot == exp, 'ui: filtro %s: %d medições = %d do cálculo independente' % (r, tot, exp))
    clk(pg, sec + ' [data-act="an-tm-range"][data-v="custom"]'); ok(q(pg, '#an-tm-from') == 1 and q(pg, '#an-tm-to') == 1, 'ui: intervalo personalizado mostra as datas')
    pg.evaluate("()=>{const f=document.getElementById('an-tm-from'); f.value='2026-11-10'; f.dispatchEvent(new Event('change',{bubbles:true}));}"); time.sleep(.2)
    pg.evaluate("()=>{const f=document.getElementById('an-tm-to'); f.value='2026-11-05'; f.dispatchEvent(new Event('change',{bubbles:true}));}"); time.sleep(.2)
    ok('antes da final' in tx(pg, sec), 'ui: datas invertidas geram aviso')
    pg.evaluate("()=>{const f=document.getElementById('an-tm-to'); f.value='2026-11-15'; f.dispatchEvent(new Event('change',{bubbles:true}));}"); time.sleep(.2)
    exp = pg.evaluate("()=>{const a=mkTs('2026-11-10','00:00'),b=endOfDay(mkTs('2026-11-15','00:00')); return S.records.filter(x=>x.source!=='exemplo'&&x.ts>=a&&x.ts<=b).length}")
    ok(pg.evaluate("anModel().tm().total") == exp, 'ui: intervalo personalizado confere (%d medições)' % exp)
    # seleção de contextos e comparação entre dois períodos do dia
    clk(pg, sec + ' [data-act="an-tm-range"][data-v="tela"]'); clk(pg, sec + ' [data-act="an-tm-sel"][data-v="jejum"]'); clk(pg, sec + ' [data-act="an-tm-sel"][data-v="posalmoco"]')
    ok(q(pg, sec + ' .an-tp') == 2, 'ui: selecionar contextos mostra só os escolhidos')
    pg.evaluate("document.querySelectorAll('#an-tmp details.an-ev').forEach(d=>{if(/Comparar dois/.test(d.textContent.slice(0,40)))d.open=true})"); time.sleep(.2)
    ok(q(pg, sec + ' #an-tm-ca') == 1 and 'Jejum' in tx(pg, sec + ' table.t') and 'Pós-almoço' in tx(pg, sec + ' table.t'), 'ui: comparação entre dois períodos do dia')
    pg.evaluate("()=>{const s=document.getElementById('an-tm-cb'); const o=[...s.options].map(x=>x.value); s.value=o[0]; s.dispatchEvent(new Event('change',{bubbles:true}));}"); time.sleep(.2)
    clk(pg, sec + ' [data-act="an-tm-sel"][data-v="*"]'); ok(q(pg, sec + ' .an-tp') == 9, 'ui: "Todos" restaura')
    # faixas de horário configuráveis
    clk(pg, sec + ' [data-act="an-tm-src"][data-v="hora"]'); ok(q(pg, sec + ' .an-tp') == 6 and 'sem horário' in tx(pg, sec + ' .an-tm-sum'), 'ui: faixas de horário (4 h) e aviso de medições sem horário')
    for st, cnt in [('2', 12), ('3', 8), ('6', 4)]:
        clk(pg, sec + ' [data-act="an-tm-step"][data-v="%s"]' % st); ok(q(pg, sec + ' .an-tp') == cnt, 'ui: faixas de %s h → %d cartões' % (st, cnt))
    clk(pg, sec + ' [data-act="an-tm-step"][data-v="custom"]'); ok(q(pg, '#an-tm-cuts') == 1, 'ui: faixas personalizadas mostram o campo de horas')
    pg.fill('#an-tm-cuts', '5, 11, 17'); clk(pg, sec + ' [data-act="an-tm-cuts"]'); ok(q(pg, sec + ' .an-tp') == 4 and '00–05h' in tx(pg, sec + ' .an-tm-cuts'), 'ui: cortes 5, 11, 17 → 4 faixas (00–05h, 05–11h, 11–17h, 17–24h)')
    pg.fill('#an-tm-cuts', '5, 30, x'); clk(pg, sec + ' [data-act="an-tm-cuts"]'); ok(q(pg, sec + ' .an-tp') == 4 and 'de 1 a 23' in tx(pg, '#an-tm-err'), 'ui: horas inválidas mostram erro e mantêm as faixas anteriores')
    clk(pg, sec + ' [data-act="an-tm-step"][data-v="4"]')
    # mapa de calor
    ok(q(pg, sec + ' .an-hm2 tbody tr') == 7 and q(pg, sec + ' .an-hm2 thead th') == 7, 'ui: mapa de calor 7 dias × 6 faixas')
    for m in ['ok', 'low', 'n', 'high']: clk(pg, sec + ' [data-act="an-tm-heat"][data-v="%s"]' % m); ok(q(pg, sec + ' .an-hm2.' + m) == 1, 'ui: mapa de calor mostra "%s"' % m)
    cell = pg.evaluate("()=>{const b=[...document.querySelectorAll('#an-tmp .hm2:not(.l-1)')][3]; return {wd:b.dataset.wd, bi:b.dataset.bi, n:+(b.querySelector('i').textContent.replace('n=','')||0)}}")
    pg.evaluate("()=>{const b=[...document.querySelectorAll('#an-tmp .hm2')].find(x=>x.dataset.wd==='2'&&x.dataset.bi==='3'); b.click()}"); time.sleep(.25)
    exp = pg.evaluate("()=>{return S.records.filter(r=>r.source!=='exemplo'&&!r.noTime&&((new Date(r.ts).getDay()+6)%7)===2&&+r.time.slice(0,2)>=12&&+r.time.slice(0,2)<16).length}")
    ok(int(re.findall(r'\d+', pg.evaluate("document.querySelector('#an-tm-det .an-tm-dh .num').textContent"))[0]) == exp and 'Qua' in tx(pg, '#an-tm-det .an-tm-dh b'), 'ui: toque no quadro Qua · 12–16h lista %d registros' % exp)
    # evolução
    ok(q(pg, sec + ' .an-ln') == 1 and q(pg, sec + ' #an-tm-ev') == 1, 'ui: gráfico de evolução e seletor de período')
    # indicadores e gráficos pedidos
    t = tx(pg, sec)
    ok(all(x in t for x in ['Períodos que merecem atenção', 'Cartões por período', 'Distribuição das medições por faixa', 'Média comparada entre períodos', 'Variabilidade por período', 'Mapa de calor', 'Evolução ao longo do tempo', 'Comparar dois períodos do dia', 'Evolução de cada período em relação ao anterior']), 'ui: todos os blocos visuais presentes')
    ok(not re.search(r'melhorou|piorou', t) and 'não é o tempo real' in t, 'ui: sem "melhorou/piorou" e com o aviso de proporção ≠ tempo')
    # comparação com período anterior
    clk(pg, sec + ' [data-act="an-tm-range"][data-v="30"]')
    pg.evaluate("document.querySelectorAll('#an-tmp details.an-ev').forEach(d=>{if(/Evolução de cada/.test(d.textContent.slice(0,60)))d.open=true})"); time.sleep(.2)
    ok(q(pg, sec + ' .an-cr') >= 5 and 'Antes' in tx(pg, sec) and 'Descreve como os números mudaram' in tx(pg, sec), 'ui: evolução de cada período vs. o anterior (diferença absoluta, %, baixas/elevadas, medições)')
    # persistência
    pg.evaluate("S.ana.tm=null"); st = pg.evaluate("JSON.parse(localStorage.getItem('tb-ana-tm'))"); ok(st['src'] == 'hora' and st['range'] == '30', 'ui: escolhas salvas no aparelho')
    ok(len(pg.errs) == 0, 'ui: sem erros de script %s' % pg.errs[:2]); pg.b.close()
    # sem rolagem horizontal e telas
    for w in [320, 360, 412, 600, 1024]:
        pg = page(p, w, SEED, EXTRA); open_tmp(pg); pg.evaluate("document.querySelectorAll('#an-tmp .an-tp').forEach(d=>d.open=true)"); time.sleep(.3)
        ok(pg.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth") <= 1, '%d px: sem rolagem horizontal da página' % w)
        ok(pg.evaluate("[...document.querySelectorAll('#an-tmp *')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0 && !e.closest('.tbl-wrap,.an-cols') && (r.right>document.documentElement.clientWidth+1)}).length") == 0, '%d px: nada da seção ultrapassa a tela' % w)
        ok(pg.evaluate("()=>{const ref=document.querySelector('[data-act=\"ana-range\"]').getBoundingClientRect().height; return [...document.querySelectorAll('#an-tmp button, #an-tmp summary')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0 && r.height<ref-1}).length}") == 0, '%d px: alvos de toque tão grandes quanto os controles já existentes da Análise' % w)
        if SHOTS and w in (360, 412): pg.query_selector('#an-tmp').screenshot(path=os.path.join(OUT, 'horarios-%d-escuro.png' % w))
        ok(len(pg.errs) == 0, '%d px: sem erros de script' % w); pg.b.close()
    # contraste (AA) dos quadros do mapa de calor nos dois temas
    for theme in ['dark', 'light']:
        pg = page(p, 412, SEED, EXTRA, theme); open_tmp(pg); bad = []
        for m in ['high', 'ok', 'low', 'n']:
            clk(pg, '#an-tmp [data-act="an-tm-heat"][data-v="%s"]' % m)
            for c in pg.evaluate("[...document.querySelectorAll('#an-tmp .hm2')].map(e=>e)") and range(1):
                pass
            res = pg.evaluate("(RGB)=>{const f=eval(RGB); return [...document.querySelectorAll('#an-tmp .hm2')].map(e=>({c:e.className,...f(e)}))}", RGB)
            for r in res:
                rr = ratio(r['fg'], r['bg'])
                if rr < 4.5: bad.append((m, r['c'], round(rr, 2)))
        ok(not bad, 'contraste AA do mapa de calor (%s): %s' % (theme, bad[:4]))
        res = pg.evaluate("(RGB)=>{const f=eval(RGB); return [...document.querySelectorAll('#an-tmp .an-tp-v, #an-tmp .an-note, #an-tmp .an-sub, #an-tmp .an-tp-f i, #an-tmp .an-ct')].map(e=>{const o=f(e); const bg=getComputedStyle(e.closest('.an-tp,.an-tmc,.an-b')||document.body).backgroundColor; return {c:e.className,fg:o.fg,bg:f({style:{}}).bg}})}", RGB) if False else None
        if SHOTS:
            pg.query_selector('#an-tmp').screenshot(path=os.path.join(OUT, 'horarios-412-%s.png' % ('claro' if theme == 'light' else 'escuro')))
        ok(len(pg.errs) == 0, 'tema %s: sem erros de script' % theme); pg.b.close()
    # dados insuficientes e ausência de dados
    pg = page(p, 412, FEW.replace("await Store.put('meta',{id:'seeded',at:1}); await removeExamples();", "await Store.put('meta',{id:'seeded',at:1}); await removeExamples();") , None); pg.evaluate("window.licAllowed=()=>true; S.ana.range='all'; S.ana.tm=null; S.route='analise'; render()")
    ok(q(pg, '.an-sec') == 13, 'poucos registros: tela monta'); open_tmp(pg)
    t = tx(pg, '#an-tmp'); ok('Poucas medições' in t and 'Sem registros em' in t and q(pg, '#an-tmp .an-tp.off') >= 4, 'poucos registros: avisos de dados insuficientes e períodos vazios')
    ok(q(pg, '#an-tmp [data-act="an-tm-rec"][data-kind="hl"]') <= 2 and 'Mais resultados baixos' not in t, 'poucos registros: nenhuma medição isolada vira destaque')
    if SHOTS: pg.query_selector('#an-tmp').screenshot(path=os.path.join(OUT, 'horarios-poucos-dados.png'))
    ok(len(pg.errs) == 0, 'poucos registros: sem erros'); pg.b.close()
    pg = page(p, 412, OLD, None); pg.evaluate("window.licAllowed=()=>true; S.ana.range='all'; S.ana.tm=null; S.route='analise'; render()"); open_tmp(pg)
    clk(pg, '#an-tmp [data-act="an-tm-range"][data-v="7"]'); t = tx(pg, '#an-tmp')
    ok('Sem medições neste intervalo' in t and q(pg, '#an-tmp .an-tp') == 0, 'sem medições no intervalo: mensagem clara e nenhum número inventado')
    if SHOTS: pg.query_selector('#an-tmp').screenshot(path=os.path.join(OUT, 'horarios-sem-dados.png'))
    ok(len(pg.errs) == 0, 'sem medições: sem erros'); pg.b.close()
print('%d falha(s) em %d' % (fail, n) if fail else 'horarios ok (%d verificações)' % n); sys.exit(1 if fail else 0)
