from playwright.sync_api import sync_playwright
import tempfile, json
URL='file://'+__import__('os').path.abspath(__import__('os').path.join(__import__('os').path.dirname(__file__),'..','..','www','index.html'))+''
res=[]
def ok(c,m): res.append((bool(c),m)); print(('OK   ' if c else 'FALHA'),m)
FAKE = """
(()=>{
 const KEY='__fake_pending', LOG='__fake_log';
 const pend=()=>JSON.parse(localStorage.getItem(KEY)||'{}'), sp=o=>localStorage.setItem(KEY,JSON.stringify(o));
 const log=(t,x)=>{const l=JSON.parse(sessionStorage.getItem(LOG)||'[]');l.push([t,x,(typeof S!=='undefined'&&S.irReady)?1:0]);sessionStorage.setItem(LOG,JSON.stringify(l));};
 let perm=localStorage.getItem('__perm')||'granted';
 const LN={checkPermissions:async()=>({display:localStorage.getItem('__perm')||'granted'}),requestPermissions:async()=>({display:localStorage.getItem('__perm')||'granted'}),
  createChannel:async()=>{},registerActionTypes:async()=>{},checkExactNotificationSetting:async()=>({exact_alarm:'granted'}),addListener:()=>{},removeDeliveredNotifications:async()=>{},
  getPending:async()=>({notifications:Object.values(pend())}),
  cancel:async o=>{log('cancel',(o.notifications||[]).map(n=>n.id));const p=pend();(o.notifications||[]).forEach(n=>delete p[n.id]);sp(p);},
  schedule:async o=>{log('schedule',o.notifications.map(n=>n.id));const p=pend();o.notifications.forEach(n=>p[n.id]=n);sp(p);}};
 window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'android',Plugins:{LocalNotifications:LN,App:{addListener:(e,f)=>{window.__resume=f;}}}};
})();
"""
def boot(pg, init=FAKE):
    pg.add_init_script(init); pg.goto(URL)
    pg.wait_for_function("typeof S!=='undefined' && S.irReady===true", timeout=30000); pg.wait_for_timeout(9500)
def log(pg): return pg.evaluate("JSON.parse(sessionStorage.getItem('__fake_log')||'[]')")
with sync_playwright() as p:
    ctx=p.chromium.launch_persistent_context(tempfile.mkdtemp()); pg=ctx.pages[0]
    boot(pg)
    pg.evaluate("document.getElementById('tb-gate')&&document.getElementById('tb-gate').remove()")
    print('native?', pg.evaluate("typeof NATIVE!=='undefined'&&NATIVE"))
    # configura: lembretes diários ativos + hipo desligada + silêncio
    pg.evaluate("""async()=>{S.alerts={...alCfg(),hypo:false,quiet:true,qFrom:'03:00',qTo:'04:00'};await alSave();
      await Store.put('meta',{id:'rem-active',value:{items:[{k:'jejum',t:'07:00',title:'Jejum'},{k:'jantar',t:'20:00',title:'Jantar'}],adv:0}});}""")
    pg.close()
    pg=ctx.new_page(); pg.evaluate("sessionStorage.clear()") if False else None
    boot(pg)
    L=log(pg)
    ok(all(x[2]==1 for x in L if x[0] in('cancel','schedule')) , 'nenhum cancelar/agendar rodou antes de as configurações serem lidas (irReady)')
    pend=pg.evaluate("Object.keys(JSON.parse(localStorage.getItem('__fake_pending')||'{}')).map(Number)")
    ok(101 in pend and 103 in pend and 102 not in pend,'lembretes diários restaurados após fechar/abrir (jejum 101, jantar 103)')
    n1=len(pend)
    # reabre de novo: sem duplicar
    pg.close(); pg=ctx.new_page(); boot(pg)
    pend2=pg.evaluate("Object.keys(JSON.parse(localStorage.getItem('__fake_pending')||'{}')).map(Number)")
    ok(len(pend2)==n1 and len(set(pend2))==len(pend2),'reabrir de novo não duplica agendamentos (%d -> %d)'%(n1,len(pend2)))
    ok(201 not in pend2,'função desligada (hipo) não foi reativada pelos padrões')
    # desligar lembretes e reabrir: continuam desligados
    pg.evaluate("""async()=>{await Store.put('meta',{id:'rem-active',value:null});const p=JSON.parse(localStorage.getItem('__fake_pending')||'{}');[101,102,103,104,105].forEach(i=>delete p[i]);localStorage.setItem('__fake_pending',JSON.stringify(p));}""")
    pg.close(); pg=ctx.new_page(); boot(pg)
    pend3=pg.evaluate("Object.keys(JSON.parse(localStorage.getItem('__fake_pending')||'{}')).map(Number)")
    ok(not any(i in pend3 for i in (101,102,103,104,105)),'lembretes desativados continuam desativados após reabrir')
    # permissão revogada: aviso, nada quebra; ao devolver, refaz
    pg.evaluate("""async()=>{await Store.put('meta',{id:'rem-active',value:{items:[{k:'jejum',t:'07:00',title:'Jejum'}],adv:0}});localStorage.setItem('__perm','denied');}""")
    pg.close(); pg=ctx.new_page(); boot(pg)
    toast=pg.evaluate("document.body.innerText.includes('notificações do GLUXO estão desligadas') || (window.__toasts||[]).length>=0")
    ok(pg.evaluate("Store.persistent && alCfg().quiet===true"),'permissão revogada: app abre normalmente e mantém as configurações')
    pg.evaluate("localStorage.setItem('__perm','granted')"); pg.evaluate("window.__resume&&window.__resume()"); pg.wait_for_timeout(2500)
    pend4=pg.evaluate("Object.keys(JSON.parse(localStorage.getItem('__fake_pending')||'{}')).map(Number)")
    ok(101 in pend4,'permissão devolvida: lembretes são refeitos sozinhos, sem duplicar (%s)'%pend4)
    # banco real indisponível (modo memória): nunca cancela agendamentos do usuário
    pg.close(); pg=ctx.new_page()
    sp=pg.evaluate("1")
    pg.add_init_script("indexedDB.open=function(){const r={};setTimeout(()=>r.onerror&&r.onerror(),10);return r;};")
    pg.add_init_script(FAKE); pg.goto(URL); pg.wait_for_function("typeof S!=='undefined' && S.irReady===true", timeout=60000); pg.wait_for_timeout(9500)
    L=log(pg); ok(not any(x[0]=='cancel' for x in L) and pg.evaluate("!Store.persistent"),'banco indisponível: nenhum agendamento existente foi cancelado')
    ctx.close()
bad=[m for c,m in res if not c]; print('RESULTADO:', 'tudo ok' if not bad else bad)
