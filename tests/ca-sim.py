# Alertas personalizados no Android (Capacitor simulado): agenda, cancela ao apagar o registro, não duplica, toque abre a tela. Servir www/ na 8766.
import asyncio
from playwright.async_api import async_playwright
MOCK = r"""
window.__log=[];window.__pend={};window.__perm='prompt';window.__act=null;
window.Capacitor={isNativePlatform:()=>true,Plugins:{
 TbExpire:{schedule:async()=>{},cancel:async()=>{}},
 App:{addListener:()=>({remove(){}})},
 LocalNotifications:{checkPermissions:async()=>({display:__perm}),requestPermissions:async()=>{__perm='granted';return{display:'granted'}},
  checkExactNotificationSetting:async()=>({exact_alarm:'denied'}),changeExactNotificationSetting:async()=>{},
  addListener:(n,f)=>{if(n==='localNotificationActionPerformed')window.__act=f;return{remove(){}}},
  getPending:async()=>({notifications:Object.values(__pend)}),
  cancel:async o=>{o.notifications.forEach(n=>{delete __pend[n.id];__log.push(['cancel',n.id])})},removeDeliveredNotifications:async()=>{},
  createChannel:async o=>{__log.push(['chan',o.id])},schedule:async o=>{o.notifications.forEach(n=>{__pend[n.id]=n;__log.push(['sched',n.id,n.channelId,+n.schedule.at])})}}}};
"""
ok=True
def chk(c,m):
    global ok; print(('OK   ' if c else 'FALHA ')+m); ok=ok and c
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await (await b.new_context(viewport={'width':400,'height':860})).new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); await pg.add_init_script(MOCK)
        await pg.goto('http://localhost:8766/index.html'); await pg.wait_for_selector('#tb-splash', state='detached', timeout=8000); await pg.wait_for_timeout(1200)
        if await pg.query_selector('#gate-skip'): await pg.click('#gate-skip'); await pg.wait_for_timeout(300)
        for i in range(6):
            if await pg.query_selector('#rw-ok'): await pg.click('#rw-ok'); await pg.wait_for_timeout(200)
        pend = lambda: pg.evaluate("Object.values(__pend).filter(n=>n.channelId==='alertasp')")
        # registro com Dia de perna às 08:00 de hoje -> agenda no almoço
        await pg.evaluate("""(async()=>{const d=new Date(),ts=new Date(d.getFullYear(),d.getMonth(),d.getDate(),6,0).getTime();await Store.put('records',{id:window.__p1=Date.now().toString(36)+'p1',date:isoDate(d),time:'06:00',ts,glucose:110,source:'manual',marks:['perna']});await loadAll();})()"""); await pg.wait_for_timeout(1200)
        h = await pg.evaluate("new Date().getHours()")
        pn = await pend()
        chk(len(pn)>=1 and all(n['extra']['route']=='alertasp' for n in pn), f'agendou {len(pn)} notificação(ões) do alerta (hora atual {h}h)')
        if pn: chk(pn[0]['body'].startswith('Dia de perna identificado!') and pn[0]['title'].startswith('TiaBete'), 'texto e título')
        # sem duplicar ao sincronizar de novo
        await pg.evaluate("caSync()"); await pg.wait_for_timeout(500); chk(len(await pend())==len(pn),'sincronizar de novo não duplica')
        # tocar abre a tela
        await pg.evaluate("go('painel')"); await pg.wait_for_timeout(300)
        await pg.evaluate("__act({notification:{extra:{route:'alertasp'}}})"); await pg.wait_for_timeout(400)
        chk(await pg.evaluate("S.route")=='alertasp','tocar na notificação abre Alertas personalizados')
        # apagar o registro cancela
        await pg.evaluate("(async()=>{await Store.del('records',window.__p1);await loadAll();})()"); await pg.wait_for_timeout(900)
        chk(len(await pend())==0 and len(await pg.evaluate("__log.filter(x=>x[0]==='cancel')"))>=1,'apagar o registro cancela a notificação')
        # desligar cancela
        await pg.evaluate("""(async()=>{const d=new Date(),ts=new Date(d.getFullYear(),d.getMonth(),d.getDate(),6,0).getTime();await Store.put('records',{id:Date.now().toString(36)+'p2',date:isoDate(d),time:'06:00',ts,glucose:110,source:'manual',marks:['perna']});await loadAll();})()"""); await pg.wait_for_timeout(900)
        before=len(await pend()); await pg.evaluate("S.ca.rules[0].on=false;caSync()"); await pg.wait_for_timeout(700)
        chk(before>=1 and len(await pend())==0,'desligar o alerta cancela')
        chk(not errs,'sem erros '+str(errs)); await b.close()
asyncio.run(main()); print('TUDO OK' if ok else 'HÁ FALHAS')
