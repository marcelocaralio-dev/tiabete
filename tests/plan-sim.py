# Testa os alarmes do "Meu tratamento" no APK (notificações diárias + troca de cateter). Servir www/ na 8766.
import asyncio, re
from playwright.async_api import async_playwright
src = open('tests/notif-sim.py').read()
MOCK = re.search(r'MOCK = r"""(.*?)"""', src, re.S).group(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await (await b.new_context(viewport={'width':400,'height':860})).new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); await pg.add_init_script(MOCK)
        await pg.goto('http://localhost:8766/index.html'); await pg.wait_for_selector('#tb-splash', state='detached', timeout=8000); await pg.wait_for_timeout(1000)
        if await pg.query_selector('#gate-skip'): await pg.click('#gate-skip'); await pg.wait_for_timeout(300)
        for i in range(6):
            if await pg.query_selector('#rw-ok'): await pg.click('#rw-ok'); await pg.wait_for_timeout(200)
        L = lambda: pg.evaluate("Object.values(__pend).filter(n=>n.channelId==='tratamento').map(n=>[n.title,n.body,n.schedule.on?n.schedule.on.hour+':'+n.schedule.on.minute:'único'])")
        await pg.evaluate("""(async()=>{S.plan.types=['insulina','remedios','bomba'];S.plan.insulin=[plItem0({name:'Insulina basal',times:['22:00']})];S.plan.meds=[plItem0({name:'Metformina',times:['08:00','20:00'],dose:'1 comprimido'})];S.plan.checks=[plItem0({name:'Glicemia em jejum',times:['06:45']})];S.plan.pump={model:'Omnipod',notes:'',siteDays:3,lastChange:isoDate(new Date()),siteTime:'09:00',alarm:true};await plSave();})()"""); await pg.wait_for_timeout(1200)
        l = await L(); print('agendados:', len(l)); [print('  ', x) for x in l]
        await pg.evaluate("(async()=>{S.plan.meds[0].alarm=false;await plSave();})()"); await pg.wait_for_timeout(1200)
        print('sem alarme da metformina:', len(await L()), '(esperado 3)')
        await pg.evaluate("(async()=>{S.alerts={...alCfg(),plan:false};await alSave();})()"); await pg.wait_for_timeout(1200)
        print('chave geral desligada:', len(await L()), '(esperado 0)')
        print('erros', errs); await b.close()
asyncio.run(main())
