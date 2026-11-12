# Simula o ambiente do APK (Capacitor) e confere arquivos e lembretes. Uso: python3 tests/native-sim.py (servindo www/ na porta 8766)
import asyncio, json
from playwright.async_api import async_playwright
MOCK = """
window.__log=[];
window.Capacitor={isNativePlatform:()=>true,Plugins:{
 Filesystem:{writeFile:async o=>{__log.push(['write',o.path,o.directory,typeof o.data,o.data.length]);return {uri:'file:///cache/'+o.path}}},
 Share:{share:async o=>{__log.push(['share',o.files[0]]);return {}}},
 LocalNotifications:{checkPermissions:async()=>({display:'prompt'}),requestPermissions:async()=>({display:'granted'}),cancel:async o=>{__log.push(['cancel',o.notifications.length])},createChannel:async()=>{__log.push(['channel'])},schedule:async o=>{__log.push(['schedule',JSON.stringify(o.notifications.map(n=>[n.id,n.schedule.on?n.schedule.on.hour:'at',n.schedule.on?n.schedule.on.minute:(new Date(n.schedule.at)-Date.now())/60000|0]))])}}}};
"""
async def main(web):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await (await b.new_context(viewport={'width':400,'height':860},accept_downloads=True)).new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        if not web: await pg.add_init_script(MOCK)
        await pg.goto('http://localhost:8766/index.html'); await pg.wait_for_selector('#tb-splash', state='detached', timeout=8000); await pg.wait_for_timeout(1000)
        await pg.evaluate("""(async()=>{const d=isoDate(new Date());await Store.put('records',{id:'t1',date:d,time:'07:00',ts:mkTs(d,'07:00'),glucose:110,context:'jejum',source:'manual'});await loadAll();render();})()"""); await pg.wait_for_timeout(300)
        if await pg.query_selector('#gate-skip'): await pg.click('#gate-skip'); await pg.wait_for_timeout(300)
        for i in range(6):
            if await pg.query_selector('#rw-ok'): await pg.click('#rw-ok'); await pg.wait_for_timeout(200)
        await pg.evaluate("go('mais')"); await pg.wait_for_timeout(300)
        t = await pg.evaluate("document.body.innerText")
        print('menu com IA:', 'Perguntar à IA' in t and 'Exames laboratoriais' in t and 'Inteligência artificial' in t, '| tem Alertas e notificações:', 'Alertas e notificações' in t)
        await pg.evaluate("go('backup')"); await pg.wait_for_timeout(300)
        print('card Drive presente:', 'Google Drive' in await pg.evaluate("document.body.innerText"))
        if web:
            print('web puro: sem download nativo (só funciona no Claude ou no APK)')
        else:
            await pg.click('[data-act=bk-json]'); await pg.wait_for_timeout(500)
            print('log arquivos:', await pg.evaluate("__log"))
            await pg.evaluate("go('lembretes')"); await pg.wait_for_timeout(300); await pg.click('text=Expandir tudo'); await pg.wait_for_timeout(200)
            print('tela lembretes nativa:', await pg.evaluate("!!document.querySelector('[data-act=rem-on]') && !document.querySelector('[data-act=ics-make]')"))
            await pg.evaluate("__log.length=0"); await pg.select_option('#ics-adv','15'); await pg.click('[data-act=rem-on]'); await pg.wait_for_timeout(500)
            print('lembretes agendados:', await pg.evaluate("__log"))
            await pg.evaluate("__log.length=0"); await pg.click('[data-act=rem-off]'); await pg.wait_for_timeout(300); print('desligar:', await pg.evaluate("__log"))
            # silêncio noturno: 22:00-08:00 deve tirar o lembrete de jejum (07:00 - 15 min) e o de deitar
            await pg.evaluate("__log.length=0"); await pg.evaluate("S.alerts={...alCfg(),quiet:true,qFrom:'22:00',qTo:'08:00'}"); await pg.click('[data-act=rem-on]'); await pg.wait_for_timeout(500)
            print('com silêncio:', await pg.evaluate("__log.filter(x=>x[0]=='schedule')"), await pg.evaluate("document.querySelector('.toast, #toast')?.innerText||''"))
            # hipoglicemia: medição de 60 mg/dL agora deve agendar reavaliação (id 201) em 15 min
            await pg.evaluate("__log.length=0"); await pg.evaluate("(async()=>{const d=isoDate(new Date()),t=new Date().toTimeString().slice(0,5);await Store.put('records',{id:'h1',date:d,time:t,ts:mkTs(d,t),glucose:60,context:'jejum',source:'manual'});await loadAll();})()"); await pg.wait_for_timeout(600)
            print('hipo agendado:', await pg.evaluate("__log.filter(x=>x[0]=='hypo'||x[0]=='schedule')"))
            await pg.evaluate("__log.length=0"); await pg.evaluate("(async()=>{const d=isoDate(new Date()),t=new Date().toTimeString().slice(0,5);await Store.put('records',{id:'h2',date:d,time:t,ts:mkTs(d,t)+60000,glucose:95,context:'jejum',source:'manual'});await loadAll();})()"); await pg.wait_for_timeout(600)
            print('recuperou, cancela:', await pg.evaluate("__log"))
        print('erros', errs); await b.close()
import sys
asyncio.run(main(len(sys.argv)>1 and sys.argv[1]=='web'))
