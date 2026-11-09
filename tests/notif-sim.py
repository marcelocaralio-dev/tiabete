# Testa os lembretes de 2 h, a expiração em 10 min, o painel de alertas e o diagnóstico. Servir www/ na 8766.
import asyncio
from playwright.async_api import async_playwright
MOCK = r"""
window.__log=[];window.__pend={};window.__deliv={};window.__perm='prompt';
window.Capacitor={isNativePlatform:()=>true,Plugins:{
 TbExpire:{schedule:async o=>{__log.push(['expire',o.id,+o.at])},cancel:async o=>{__log.push(['expcancel',o.id])}},
 App:{addListener:()=>({remove(){}})},
 LocalNotifications:{checkPermissions:async()=>({display:__perm}),requestPermissions:async()=>{__perm='granted';return{display:'granted'}},
  checkExactNotificationSetting:async()=>({exact_alarm:'denied'}),changeExactNotificationSetting:async()=>{__log.push(['exactsettings'])},
  getPending:async()=>({notifications:Object.values(__pend)}),
  cancel:async o=>{o.notifications.forEach(n=>delete __pend[n.id])},removeDeliveredNotifications:async o=>{__log.push(['rmdeliv',o.notifications.map(n=>n.id)])},
  createChannel:async()=>{},schedule:async o=>{o.notifications.forEach(n=>{__pend[n.id]=n;__log.push(['sched',n.id,n.channelId,n.schedule.at?+n.schedule.at:null])})}}}};
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await (await b.new_context(viewport={'width':400,'height':860})).new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); await pg.add_init_script(MOCK)
        await pg.goto('http://localhost:8766/index.html'); await pg.wait_for_selector('#tb-splash', state='detached', timeout=8000); await pg.wait_for_timeout(1000)
        if await pg.query_selector('#gate-skip'): await pg.click('#gate-skip'); await pg.wait_for_timeout(300)
        for i in range(6):
            if await pg.query_selector('#rw-ok'): await pg.click('#rw-ok'); await pg.wait_for_timeout(200)
        T = lambda: pg.evaluate("document.body.innerText")
        L = lambda k: pg.evaluate("__log.filter(x=>x[0]==='%s')"%k)
        add = lambda id, mins, **kw: pg.evaluate("""async([id,mins,kw])=>{const ts=Date.now()-mins*60000,d=new Date(ts),p=n=>String(n).padStart(2,'0'),date=isoDate(d);await Store.put('records',Object.assign({id,date,time:p(d.getHours())+':'+p(d.getMinutes()),ts,glucose:110,source:'manual'},kw));await loadAll();}""",[id,mins,kw])
        # 1) painel de alertas
        await pg.evaluate("go('lembretes')"); await pg.wait_for_timeout(400); await pg.click('text=Expandir tudo'); await pg.wait_for_timeout(300); t = await T()
        print('chaves:', await pg.evaluate("document.querySelectorAll('.al-on').length"), all(x in t for x in ['Insulina basal','Faixa de hipoglicemia','Medir 2 h após a insulina do almoço','Medir 2 h após a insulina do jantar','Diagnóstico das notificações']))
        print('diagnóstico:', await pg.evaluate("document.getElementById('nt-status').innerText.replace(/\\n/g,' | ')"))
        await pg.click('[data-act=nt-test]'); await pg.wait_for_timeout(500); print('teste agendado:', [x for x in await L('sched') if x[1]==999])
        ins = lambda id, kind, mins: pg.evaluate("""async([id,kind,mins])=>{const ts=Date.now()-mins*60000;await Store.put('inslog',{id,kind,ts,date:isoDate(new Date(ts)),at:Date.now()});S.inslog.push({id,kind,ts,date:isoDate(new Date(ts)),at:Date.now()});await loadAll();}""",[id,kind,mins])
        # 2) insulina do almoço 30 min atrás -> agenda +2h
        await ins('i1','lunch',30); await pg.wait_for_timeout(700)
        s = [x for x in await L('sched') if x[2]=='pos']; print('agendou 2h após insulina:', len(s), 'em ~', round((s[0][3]-await pg.evaluate("Date.now()"))/60000) if s else None, 'min')
        ex = await L('expire'); print('expiração +10min:', len(ex), round((ex[0][2]-s[0][3])/60000) if ex and s else None)
        # 3) glicemia perto das 2h cancela
        await pg.evaluate("(async()=>{const r=S.inslog.find(x=>x.id==='i1');r.ts=Date.now()-118*60000;await Store.put('inslog',r);})()"); await add('m2', 0, context='depois'); await pg.wait_for_timeout(700)
        print('cancelou ao medir:', len(await L('expcancel'))>0, 'pendentes pos:', await pg.evaluate("Object.values(__pend).filter(n=>n.channelId==='pos').length"))
        # 4) chave desligada não agenda; basal não conta
        await pg.evaluate("S.alerts.postDinner=false;__log.length=0"); await ins('i2','dinner',5); await pg.wait_for_timeout(500)
        print('desligado não agenda:', len([x for x in await L('sched') if x[2]=='pos'])==0)
        await pg.evaluate("S.alerts.postDinner=true"); await ins('i3','dinner',6); await pg.wait_for_timeout(500)
        print('religado agenda:', len([x for x in await L('sched') if x[2]=='pos'])>=1)
        await pg.evaluate("__log.length=0"); await ins('i4','basal',3); await pg.wait_for_timeout(400); print('basal não gera:', len([x for x in await L('sched') if x[2]=='pos'])==0)
        print('chaves em forma de interruptor:', await pg.evaluate("getComputedStyle(document.querySelector('.al-on')).appearance"))
        print('permissão pedida na abertura:', await pg.evaluate("__perm"))
        print('erros', errs); await b.close()
asyncio.run(main())
