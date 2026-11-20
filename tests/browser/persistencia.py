from playwright.sync_api import sync_playwright
import tempfile, json
URL='file://'+__import__('os').path.abspath(__import__('os').path.join(__import__('os').path.dirname(__file__),'..','..','www','index.html'))+''
res=[]
def ok(c,m): res.append((bool(c),m)); print(('OK   ' if c else 'FALHA'),m)
def boot(pg, init=None):
    if init: pg.add_init_script(init)
    pg.goto(URL); pg.wait_for_function("typeof S!=='undefined' && S.irReady===true", timeout=30000); pg.wait_for_timeout(600)
    pg.evaluate("document.getElementById('tb-gate')&&document.getElementById('tb-gate').remove()")
with sync_playwright() as p:
    d=tempfile.mkdtemp()
    ctx=p.chromium.launch_persistent_context(d); pg=ctx.pages[0] if ctx.pages else ctx.new_page()
    boot(pg)
    ok(pg.evaluate("Store.persistent && Store.metaOk"),'banco real aberto')
    # 1) configurar e "fechar/abrir"
    pg.evaluate("""async()=>{S.alerts={...alCfg(),quiet:true,qFrom:'21:30',qTo:'05:45',hypo:false,postLunch:false,backupDays:15};await alSave();
      pnlSet('classic');S.mt.period=90;localStorage.setItem('tb-mt-period','90');S.period=90;S.ana.range='180';S.ana.agg='month';S.ruleMode='etiquetas';S.ruleN=240;
      localStorage.setItem('tb-hypo-off','{"x":1}');localStorage.setItem('tb-lock',JSON.stringify({hash:'h',salt:'s'}));
      await Store.put('meta',{id:'theme',value:'light'});}""")
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pagehide'))"); pg.wait_for_timeout(800)
    pg.close(); pg=ctx.new_page(); boot(pg)
    st=pg.evaluate("({q:alCfg().quiet,f:alCfg().qFrom,t:alCfg().qTo,h:alCfg().hypo,pl:alCfg().postLunch,bd:alCfg().backupDays,pnl:pnlGet(),mt:S.mt.period,per:S.period,ar:S.ana.range,ag:S.ana.agg,rm:S.ruleMode,rn:S.ruleN,th:S.theme})")
    ok(st['q'] and st['f']=='21:30' and st['t']=='05:45' and st['h'] is False and st['pl'] is False and st['bd']==15,'alertas/silêncio/desligados preservados após fechar e abrir')
    ok(st['pnl']=='classic' and st['mt']==90 and st['th']=='light','visual do Início, período das métricas e tema preservados')
    ok(st['per']==90 and st['ar']=='180' and st['ag']=='month' and st['rm']=='etiquetas' and st['rn']==240,'filtros/seleções (período, intervalo, agrupamento, critério) preservados')
    # 2) perda do localStorage (limpeza/encerramento forçado antes do flush) -> restaura do banco
    pg.evaluate("localStorage.clear()"); pg.close(); pg=ctx.new_page(); boot(pg)
    st=pg.evaluate("({pnl:pnlGet(),mt:S.mt.period,lock:!!lkCfg(),off:JSON.stringify(S.hypoOff)})")
    ok(st['pnl']=='classic' and st['mt']==90 and st['lock'] and st['off']=='{"x":1}','localStorage perdido: visual, período, PIN e avisos restaurados da cópia no banco')
    # 3) localStorage presente tem prioridade sobre a cópia
    pg.evaluate("localStorage.setItem('tb-pnl','cards')"); pg.close(); pg=ctx.new_page(); boot(pg)
    ok(pg.evaluate("pnlGet()")=='cards','valor já existente no localStorage não é sobrescrito pela cópia')
    # 4) banco lento/falhando na 1ª tentativa: tenta de novo e NÃO cai para memória
    pg.close(); pg=ctx.new_page()
    boot(pg, "(()=>{const o=indexedDB.open.bind(indexedDB);let n=0;indexedDB.open=function(name,v){if(name==='glicotrack'&&n++<1){const r={};setTimeout(()=>r.onerror&&r.onerror(),30);return r;}return o(name,v);};})()")
    ok(pg.evaluate("Store.persistent")  and pg.evaluate("alCfg().quiet===true"),'falha na 1ª abertura do banco: repete e mantém as configurações salvas (sem virar instalação nova)')
    # 5) conexão fechada pelo sistema: reabre e grava
    pg.evaluate("Store.db.close()")
    r=pg.evaluate("""async()=>{await Store.put('meta',{id:'probe',value:42});return (await Store.all('meta')).find(x=>x.id==='probe').value}"""); ok(r==42,'conexão do banco fechada: reabre sozinha e a gravação não se perde')
    # 6) leitura de meta falhou: não grava por cima
    r=pg.evaluate("""async()=>{Store.metaOk=false;let rej=false;try{await Store.put('meta',{id:'alerts',value:{}})}catch(e){rej=true}Store.metaOk=true;return rej&&alCfg().quiet===true&&(await Store.all('meta')).find(x=>x.id==='alerts').value.quiet===true}"""); ok(r,'meta ilegível: gravação bloqueada e configuração salva intacta')
    pg.close(); pg=ctx.new_page(); boot(pg)
    # 7) atualização do app: schema só adiciona; dados continuam
    ok(pg.evaluate("alCfg().qFrom")=='21:30','reabertura após atualização preserva configurações')
    ctx.close()
bad=[m for c,m in res if not c]; print('RESULTADO:', 'tudo ok' if not bad else bad)
