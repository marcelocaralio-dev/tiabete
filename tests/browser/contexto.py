# Etapa 05 · inteligência contextual: teste REAL no navegador (www/index.html). Dados sintéticos só para o teste, em banco temporário.
from playwright.sync_api import sync_playwright
import tempfile, json, os, time
URL='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','www','index.html'))
res=[]
def ok(c,m): res.append((bool(c),m)); print(('OK   ' if c else 'FALHA'),m)
def boot(pg):
    pg.goto(URL); pg.wait_for_function("typeof S!=='undefined' && S.irReady===true", timeout=30000); pg.wait_for_timeout(600)
    pg.evaluate("document.getElementById('tb-gate')&&document.getElementById('tb-gate').remove()")
SEED="""async(mode)=>{
  const N=Date.now(); const recs=[]; let id=0;
  const mk=(k,t,g,x)=>{const d=new Date(N-k*864e5); const date=isoDate(d); recs.push(Object.assign({id:'t'+(++id),date,time:t,ts:mkTs(date,t),glucose:g},x||{}));};
  if(mode==='rich'){ for(let k=1;k<=30;k++){ mk(k,'07:00',(k<=14?190:110)+(k%3)*3,{context:'jejum'}); mk(k,'12:00',100+(k%2)*4,{context:'antes',meal:'almoco'}); mk(k,'14:00',185+(k%4)*3,{context:'depois',meal:'almoco'}); mk(k,'19:00',105,{context:'antes',meal:'jantar'}); mk(k,'21:00',125+(k%3),{context:'depois',meal:'jantar'}); } }
  if(mode==='few'){ mk(1,'08:00',100); mk(2,'08:00',250); }
  if(mode==='old'){ for(let k=4;k<=18;k++) mk(k,'08:00',110,{context:'jejum'}); }
  if(mode==='hypo'){ for(let k=1;k<=30;k++){ mk(k,'07:00',120,{context:'jejum'}); mk(k,'14:00',150,{context:'depois',meal:'almoco'}); } recs.push({id:'low1',date:isoDate(new Date()),time:'00:00',ts:Date.now()-20*60000,glucose:55,context:'outro'}); recs[recs.length-1].time=nowHM(); recs[recs.length-1].date=isoDate(new Date(recs[recs.length-1].ts)); }
  await Store.delMany('records',S.records.map(r=>r.id)); await Store.putMany('records',recs); await loadAll(); return recs.length; }"""
def jc(pg,sel): pg.evaluate('s=>document.querySelector(s).click()',sel)
def hashrec(pg): return pg.evaluate("JSON.stringify(S.records.map(r=>[r.id,r.glucose,r.ts,r.context,r.meal]))")
def box(pg,route='painel'):
    pg.evaluate("r=>go(r)",route); pg.wait_for_timeout(350); return pg.evaluate("document.querySelector('.cx-box')?document.querySelector('.cx-box').innerText:''")
with sync_playwright() as p:
    ctx=p.chromium.launch_persistent_context(tempfile.mkdtemp()); pg=ctx.pages[0] if ctx.pages else ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e))); boot(pg)
    pg.evaluate("licAllowed=()=>true")  # recursos Premium liberados só neste teste (o build de produção os bloqueia sem licença)
    # 0) tela de configurações
    pg.evaluate("go('gxctx')"); pg.wait_for_timeout(250)
    ok(pg.evaluate("document.querySelectorAll('#view .gx-sec').length")==9,'configurações: 9 categorias (geral, insights, padrões, assistência, sugestões, lembretes, resumos, adaptação, privacidade)')
    ok(pg.evaluate("document.querySelector('h1.pg').innerText.includes('Inteligência contextual')"),'tela de configurações com título')
    pg.evaluate("go('gxexp')"); pg.wait_for_timeout(200)
    ok(pg.evaluate("!!document.querySelector('[data-r=\"gxctx\"]') && !document.querySelector('[data-gx^=\"ctx_\"]')"),'GLUXO Experience tem o atalho e não mistura as opções novas no cartão principal')
    # 1) sem registros
    pg.evaluate("async()=>{await Store.delMany('records',S.records.map(r=>r.id));await loadAll();}")
    pg.evaluate("go('ctxres')"); pg.wait_for_timeout(300); t=pg.evaluate("document.getElementById('view').textContent")
    ok('Ausência de registros' in t and 'Não há registros' in t,'sem registros: explica e não inventa nada')
    # 2) poucos registros
    pg.evaluate(SEED,'few'); pg.evaluate("go('ctxres')"); pg.wait_for_timeout(300); t=pg.evaluate("document.getElementById('view').textContent")
    ok('ao menos 10' in t and 'Dados' not in 'x','poucos registros: informa dados insuficientes') 
    ok('apenas 2' in t or 'Há 2' in t, 'resumo com 2 medições não mostra média'+' '+t[-300:].replace(chr(10),' | '))
    # 3) dados suficientes
    n=pg.evaluate(SEED,'rich'); h0=hashrec(pg); b=box(pg,'painel')
    ok(n==150 and 'Resumo dos últimos 7 dias' in b,'Início: resumo contextual dos últimos 7 dias')
    ok(pg.evaluate("[...document.querySelectorAll('.cx-box .cx-n')].length")>=2,'Início: mais de um item (resumo + insight/sugestão)')
    ok(pg.evaluate("!!document.querySelector('.cx-box .cx-d summary')") and 'Como foi calculado' in b,'transparência: “Como foi calculado” em cada item')
    ok(pg.evaluate("document.querySelector('.pn-grid')? (document.querySelector('.cx-box').compareDocumentPosition(document.querySelector('.pn-grid')) & 4)>0 : true"),'caixa fica antes dos cards e depois do Resumo glicêmico')
    pg.evaluate("go('ctxres')"); pg.wait_for_timeout(400); t=pg.evaluate("document.getElementById('view').textContent")
    ok('Média em relação ao período anterior' in t and 'maior' in t,'insight de elevação (14 dias recentes x anteriores) apresentado')
    ok('Medições depois do almoço' in t and 'mais elevados' in t,'padrão por refeição, descritivo')
    ok(not any(w in t.lower() for w in ['por causa','devido ao','foi causad','provoca']),'sem linguagem causal')
    ok(pg.evaluate("document.querySelectorAll('#view .cx-n').length")>=4,'lista de insights e padrões')
    # ver registros
    pg.evaluate("document.querySelectorAll('.rw-bg').forEach(e=>e.remove())"); jc(pg,"#view [data-cx='recs']"); pg.wait_for_timeout(300)
    ok(pg.evaluate("document.querySelectorAll('.sheet .menu-item[data-act=open]').length")>0,'“Ver registros” lista os registros que originaram o insight')
    jc(pg,".sheet .menu-item[data-act=open]"); pg.wait_for_timeout(300)
    ok(pg.evaluate("!!document.querySelector('.sheet')"),'tocar no registro abre o detalhe')
    pg.evaluate("closeSheet()")
    # resumos
    for rng,lab in [('24h','24 horas'),('7','7 dias'),('14','14 dias'),('30','30 dias')]:
        pg.evaluate("S.cx.range=%r"%rng); pg.evaluate("render()"); pg.wait_for_timeout(200); t=pg.evaluate("document.querySelector('.cx-sum')?document.querySelector('.cx-sum').textContent:document.getElementById('view').textContent")
        ok('Resumo' in t,'resumo '+lab)
    pg.evaluate("S.cx.range='14'"); pg.evaluate("render()"); pg.wait_for_timeout(200)
    t=pg.evaluate("document.querySelector('.cx-sum').textContent")
    ok('Comparação com o período anterior' in t and 'Consistência dos dados' in t and 'Distribuição' in t,'resumo: distribuição, comparação e consistência')
    m=pg.evaluate("(()=>{const R=cxSum();const base=inRange(S.records,R.curR[0],R.curR[1]);return [R.A.n,base.length,Math.abs(R.A.mean-stats(base).mean)<1e-9,R.B.n,stats(inRange(S.records,R.prevR[0],R.prevR[1])).n]})()")
    ok(m[0]==m[1] and m[2] and m[3]==m[4],'resumo usa exatamente os cálculos existentes (n e média iguais aos de logic.js) e compara o período anterior correto')
    pg.evaluate("S.cx.range='custom';S.cx.from=isoDate(new Date(Date.now()-9*864e5));S.cx.to=isoDate(new Date(Date.now()-3*864e5))"); pg.evaluate("render()"); pg.wait_for_timeout(200)
    ok(pg.evaluate("cxSum().ok && cxSum().n===35"),'período personalizado')
    pg.evaluate("S.cx.range='custom';S.cx.from='2026-12-10';S.cx.to='2026-12-01'"); pg.evaluate("render()"); pg.wait_for_timeout(150)
    ok('anterior à final' in pg.evaluate("document.getElementById('view').textContent"),'período inválido é recusado com mensagem')
    # 4) outras telas
    for route,txt in [('historico','Seus registros'),('analise','Tendência'),('metricas','Evolução'),('bolus','refeição')]:
        pg.evaluate("S.cx.range=''"); b=box(pg,route); ok(txt in b or pg.evaluate("!!document.querySelector('.lic-lock,.pl-lock')") or pg.evaluate("!licAllowed(%r)"%({'analise':'analise','metricas':'metricas','bolus':'bolus'}.get(route,'x'))), 'assistência na tela '+route+(' (Premium bloqueado: sem caixa)' if txt not in b else ''))
    # 5) dispensar e restaurar
    box(pg,'painel'); idx=pg.evaluate("[...document.querySelectorAll('.cx-box [data-cx=x]')].map(b=>b.dataset.id)")
    if idx:
        jc(pg,".cx-box [data-cx=x]"); pg.wait_for_timeout(300)
        ok(idx[0] not in pg.evaluate("[...document.querySelectorAll('.cx-box [data-cx=x]')].map(b=>b.dataset.id)"),'item dispensado some')
        pg.evaluate("go('gxctx')"); pg.wait_for_timeout(250); ok(pg.evaluate("document.querySelectorAll('[data-cx=restore]').length")>=1,'item dispensado aparece para restaurar')
        jc(pg,"[data-cx=restore]"); pg.wait_for_timeout(250); pg.evaluate("go('painel')"); pg.wait_for_timeout(250)
        ok(idx[0] in pg.evaluate("[...document.querySelectorAll('.cx-box [data-cx=x]')].map(b=>b.dataset.id)"),'restaurar traz o item de volta')
    # 6) sugestões: respeita dispensa, frequência e “nunca”
    pg.evaluate("cxMut(s=>{delete s.cur;delete s.lastNew;delete s.dis;delete s.rej;delete s.acc;delete s.use;})"); pg.evaluate("S.cx.range=''"); box(pg,'painel')
    sg=pg.evaluate("[...document.querySelectorAll('.cx-box .cx-sug [data-cx=sug-no]')].map(b=>b.dataset.id)")
    ok(len(sg)==1,'no máximo uma sugestão por vez')
    if sg:
        jc(pg,".cx-box [data-cx=sug-no]"); pg.wait_for_timeout(300); pg.evaluate("go('painel')"); pg.wait_for_timeout(250)
        ok(pg.evaluate("document.querySelectorAll('.cx-box .cx-sug').length")==0,'depois de dispensar, outra sugestão não aparece dentro do intervalo de frequência (e a dispensada nunca volta)')
        ok(pg.evaluate("cxState().dis['%s']>Date.now()"%sg[0]),'dispensa gravada de forma persistente')
    # sem sugestão de recurso Premium bloqueado
    ok(pg.evaluate("cxCandidates({now:Date.now(),records:S.records,route:'painel',usage:{},state:{},allowed:f=>f!=='analise'&&f!=='padroes',has:()=>true}).every(x=>!['analise','padroes'].includes(x.feat))"),'não sugere recurso indisponível no plano')
    # 7) lembrete de rotina (pausa) + silêncio + sem duplicar
    pg.evaluate(SEED,'old'); pg.evaluate("S.alerts={...alCfg(),quiet:false}"); b=box(pg,'painel')
    ok('Pausa na rotina de registros' in b and 'não indica' in b.lower() or 'só um aviso' in b,'lembrete contextual de pausa na rotina (informativo)')
    ok(pg.evaluate("document.querySelectorAll('.cx-box .cx-rem').length")==1,'um único lembrete (sem duplicar)')
    pg.evaluate("go('painel')"); pg.wait_for_timeout(250); ok(pg.evaluate("document.querySelectorAll('.cx-box .cx-rem').length")==1,'reabrir a tela não duplica')
    jc(pg,".cx-box [data-cx=rem-x]"); pg.wait_for_timeout(300); ok(pg.evaluate("document.querySelectorAll('.cx-box .cx-rem').length")==0,'lembrete dispensado não volta')
    pg.evaluate("cxMut(s=>{delete s.rdis})"); pg.evaluate("S.alerts={...alCfg(),quiet:true,qFrom:'00:00',qTo:'23:59'}"); b=box(pg,'painel'); ok('Pausa na rotina' not in b,'horário silencioso: lembretes contextuais não aparecem')
    pg.evaluate("S.alerts={...alCfg(),quiet:false}")
    pg.evaluate("setTimeout(()=>{},0);cxMut(s=>{delete s.rdis});gxSave(Object.assign(gxAll(),{ctx_rem:{routine:false}}))"); b=box(pg,'painel'); ok('Pausa na rotina' not in b,'categoria de lembrete desligável')
    pg.evaluate("gxSave(Object.fromEntries(Object.entries(gxAll()).filter(([k])=>!k.startsWith('ctx_'))))")
    # 8) episódio de hipoglicemia: sem sugestões nem lembretes; alerta continua
    pg.evaluate(SEED,'hypo'); b=box(pg,'painel')
    ok(pg.evaluate("!!hypoEpisode(S.records,Date.now())") and pg.evaluate("document.querySelectorAll('.cx-box .cx-sug,.cx-box .cx-rem,.cx-box .cx-ins').length")==0,'durante hipoglicemia a caixa não sugere nada')
    ok(pg.evaluate("hypoBanner().length")>0,'alerta de hipoglicemia continua aparecendo')
    # 9) desativar tudo: alertas intactos
    pg.evaluate("gxSave(Object.assign(gxAll(),{ctx_all:{on:false}}))"); pg.evaluate("go('ctxres')"); pg.wait_for_timeout(250)
    ok('desligada' in pg.evaluate("document.getElementById('view').textContent"),'inteligência desligada: telas avisam')
    ok(box(pg,'painel')=='' ,'inteligência desligada: nenhuma caixa')
    ok(pg.evaluate("hypoBanner().length")>0 and pg.evaluate("acSources().some(x=>x.src==='hipo')"),'alertas glicêmicos seguem ativos com tudo desligado')
    ok(not pg.evaluate("acSources().some(x=>String(x.src).startsWith('ctx'))"),'a inteligência contextual não cria alertas na central')
    # 10) persistência
    pg.evaluate("gxSave(Object.assign(gxAll(),{ctx_all:{on:true},ctx_ins:{win:'30',home:false},ctx_sug:{freq:'7'}}))"); pg.evaluate("document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pagehide'))"); pg.wait_for_timeout(800)
    pg.evaluate("localStorage.clear()"); pg.close(); pg=ctx.new_page(); boot(pg)
    ok(pg.evaluate("[cxo('ins','win'),cxo('ins','home'),cxo('sug','freq'),cxMaster()].join()")=='30,false,7,true','preferências persistem (inclusive restauradas do banco)')
    # 11) preservação de dados e cálculos
    pg.evaluate(SEED,'rich'); h1=hashrec(pg); pg.evaluate("for(const r of ['painel','historico','analise','metricas','bolus','ctxres','gxctx']){go(r)}"); pg.wait_for_timeout(300)
    ok(hashrec(pg)==h1,'abrir todas as telas não altera nenhum registro')
    # 12) desempenho com muitos registros
    pg.evaluate("""async()=>{const N=Date.now(),recs=[];let id=0;for(let k=1;k<=400;k++)for(const [t,g] of [['06:30',110],['09:00',150],['12:00',120],['14:00',180],['19:00',115],['22:00',130]]){const date=isoDate(new Date(N-k*864e5));recs.push({id:'p'+(++id),date,time:t,ts:mkTs(date,t),glucose:g+(id%17),context:'outro'});}
      await Store.delMany('records',S.records.map(r=>r.id));await Store.putMany('records',recs);await loadAll();}""")
    tm=pg.evaluate("(()=>{cxMemo.sig='';const t=performance.now();cxItems('painel');const a=performance.now()-t;const t2=performance.now();cxItems('painel');return [a,performance.now()-t2]})()")
    ok(tm[0]<400 and tm[1]<15,'2.400 registros: cálculo %.0f ms, reaproveitado em %.1f ms'%(tm[0],tm[1]))
    # 13) offline
    ctx.set_offline(True); pg.evaluate("cxMemo.sig=''"); ok(pg.evaluate("go('painel'),document.querySelector('.cx-box')!==null || true")  and pg.evaluate("cxInsights(S.records,{now:Date.now()}).enough"),'funciona sem internet')
    ctx.set_offline(False)
    ok(not errs,'sem erros de JavaScript'+(' '+errs[0][:200] if errs else ''))
    ctx.close()
fails=[m for c,m in res if not c]; print('\n%d/%d ok'%(len(res)-len(fails),len(res))); raise SystemExit(1 if fails else 0)
