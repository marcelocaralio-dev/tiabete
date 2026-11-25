"""Bolha de alertas: arrasto livre, área de exclusão e encaixe (Início e Histórico).
Uso: node scripts/build-web.js --dev && python3 tests/browser/bolha-arrasto.py"""
from playwright.sync_api import sync_playwright
import os, tempfile
import pathlib
URL=(pathlib.Path(__file__).resolve().parents[2]/'www'/'index.html').as_uri()  # rode antes: node scripts/build-web.js --dev
def boot(pg, w=390, h=844):
    pg.goto(URL); pg.wait_for_function("typeof S!=='undefined' && S.irReady===true", timeout=30000); pg.wait_for_timeout(600)
    pg.evaluate("document.getElementById('tb-gate')&&document.getElementById('tb-gate').remove()")
    pg.evaluate("document.getElementById('tb-splash')&&document.getElementById('tb-splash').remove()")

res=[]
def ok(c,m): res.append(bool(c)); print(('OK   ' if c else 'FALHOU'),m)
def geo(pg): return pg.evaluate("""()=>{const b=document.getElementById('acb'),r=b.getBoundingClientRect(),z=document.getElementById('acz'); return {l:r.left,t:r.top,w:r.width,cx:r.left+r.width/2,cy:r.top+r.height/2,hidden:b.hidden,hid:S.ac.hidden,drag:b.classList.contains('drag'),over:b.classList.contains('over'),hot:z.classList.contains('hot'),zon:!z.hidden,side:b.dataset.side,vw:innerWidth,vh:innerHeight,pos:S.ac.pos}}""")
def seed(pg, route):
    pg.evaluate("""async()=>{ for(let i=0;i<40;i++){ const d=isoDate(new Date(addDays(Date.now(),-i))); await Store.put('records',{id:'r'+i,date:d,time:'08:00',ts:mkTs(d,'08:00'),glucose:100+i,source:'manual'}); } await loadAll(); S.ac.mode='bubble'; S.ac.hidden=false; S.ac.pos={fx:1,fy:.5}; acSave(true); go('%s'); acRefresh(); }"""%route)
    pg.wait_for_timeout(1200); pg.evaluate("document.querySelectorAll('#rw-bg,.gx-greet').forEach(e=>e.remove())")
with sync_playwright() as p:
  for route in ['historico','painel']:
    print('== tela',route)
    ctx=p.chromium.launch_persistent_context(tempfile.mkdtemp(), viewport={'width':390,'height':844}); pg=ctx.pages[0]
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    boot(pg); seed(pg,route)
    g=geo(pg); x,y=g['cx'],g['cy']
    # 1 arrastar livre até o meio da tela
    pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move(x-20,y,steps=3); pg.mouse.move(g['vw']/2,y-100,steps=12)
    g2=geo(pg); ok(g2['drag'] and abs(g2['cx']-g['vw']/2)<4 and abs(g2['cy']-(y-100))<4,'bolha acompanha o dedo livremente até o meio da tela (cx=%.0f cy=%.0f)'%(g2['cx'],g2['cy']))
    ok(g2['zon'] and not g2['hot'],'área de exclusão aparece durante o arrasto, ainda inativa fora dela')
    # 2 entrar na área de exclusão
    pg.mouse.move(g['vw']/2,g['vh']-60,steps=15); g3=geo(pg)
    ok(g3['hot'] and g3['over'],'sobre a área de exclusão: feedback ativo (zona e bolha)')
    # 3 sair e soltar fora -> não exclui
    pg.mouse.move(60,g['vh']-60,steps=10); g4=geo(pg); ok(not g4['hot'],'ao sair da área o feedback desliga')
    pg.mouse.up(); pg.wait_for_timeout(600); g5=geo(pg)
    ok(not g5['hid'] and not g5['hidden'] and not g5['zon'],'soltar fora da área NÃO exclui; bolha segue visível e a zona some')
    ok(g5['side']=='l' and g5['l']<20 and 0<=g5['t']<=g5['vh']-g5['w'],'encaixada na lateral esquerda em posição válida (l=%.0f t=%.0f)'%(g5['l'],g5['t']))
    # 4 soltar no meio-direita -> lateral direita
    x,y=g5['cx'],g5['cy']; pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move(300,300,steps=12); pg.mouse.up(); pg.wait_for_timeout(600); g6=geo(pg)
    ok(g6['side']=='r' and g6['l']+g6['w']>g6['vw']-14,'soltar do lado direito encaixa na direita')
    # 5 clique ainda abre painel (toque sem arrastar)
    pg.mouse.click(g6['cx'],g6['cy']); pg.wait_for_timeout(500); ok(pg.evaluate("AC.open"),'toque simples continua abrindo o painel')
    pg.evaluate("acCollapse(true)")
    # 6 excluir: arrastar até a zona e soltar
    g7=geo(pg); pg.mouse.move(g7['cx'],g7['cy']); pg.mouse.down(); pg.mouse.move(g7['vw']/2,g7['vh']-55,steps=20); h=geo(pg)['hot']; pg.mouse.up(); pg.wait_for_timeout(700); g8=geo(pg)
    ok(h and g8['hid'] and g8['hidden'],'soltar dentro da área exclui (dispensa) a bolha')
    ok(not errs,'sem erros de JS %s'%errs)
    ctx.close()
print('RESULTADO', 'tudo ok' if all(res) else 'FALHAS')
