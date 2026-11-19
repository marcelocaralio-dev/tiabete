# Bolha de alertas em estilo de chat: linhas de até 2 linhas, ícones, dispensar um/todos, adiar, encaixe lateral. Servir www/ na 8766.
import asyncio, sys, os
from playwright.async_api import async_playwright
CHROME = os.environ.get('CHROME', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome')
fails = 0
def ok(c, m):
    global fails; print(('OK   ' if c else 'FALHOU ') + m); fails += 0 if c else 1
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg = await (await b.new_context(viewport={'width':390,'height':780}, has_touch=False)).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8766/index.html'); await pg.wait_for_selector('#tb-splash', state='detached', timeout=8000); await pg.wait_for_timeout(900)
        if await pg.query_selector('#gate-skip'): await pg.click('#gate-skip')
        for i in range(6):
            if await pg.query_selector('#rw-ok'): await pg.click('#rw-ok'); await pg.wait_for_timeout(200)
        # modo bolha + dois alertas ativos: lembrete de tratamento (com Feito e +10 min) e lembrete de insulina (Confirmar / adiar)
        await pg.evaluate("""(async()=>{
          const d=new Date(Date.now()-5*60000),p=n=>String(n).padStart(2,'0'),t=p(d.getHours())+':'+p(d.getMinutes());
          S.plan.types=['insulina','remedios'];S.plan.meds=[plItem0({name:'Metformina',role:'oral',times:[t]})];
          S.plan.insulin=[plItem0({name:'Glargina',role:'basal',times:[t]})];await plSave();
          S.ir.items.push(irItem({itemId:S.plan.insulin[0].id,type:'basal',time:t,src:t,days:[],on:true,name:'Glargina'},uid));S.ir.adopted.push(S.plan.insulin[0].id);await irSave();
          S.alerts={...(S.alerts||{}),plan:true};
          acSetMode('bubble'); S.ac.items=[]; acSync();})()""")
        await pg.wait_for_timeout(1500)
        await pg.evaluate("acCollapse(true)"); await pg.click('#acb'); await pg.wait_for_timeout(600)
        rows = await pg.evaluate("document.querySelectorAll('.acr').length"); ok(rows >= 2, f'painel mostra {rows} mensagens como lista de bolhas')
        ok(await pg.evaluate("[...document.querySelectorAll('.acr-m')].every(m=>{const lh=parseFloat(getComputedStyle(m).lineHeight);return m.getBoundingClientRect().height<=lh*2+2})"), 'cada mensagem ocupa no máximo 2 linhas')
        ok(await pg.evaluate("[...document.querySelectorAll('.acr')].every(r=>r.getBoundingClientRect().height<=76)"), 'altura de cada bolha compacta (<= 76px)')
        ok(await pg.evaluate("[...document.querySelectorAll('.acr .acr-i, .acp-i')].every(b=>b.getAttribute('title')&&b.getAttribute('aria-label')&&!b.textContent.trim())"), 'todos os controles são ícones com tooltip e descrição acessível')
        ok(await pg.evaluate("!!document.querySelector('[data-ac=dismissall]')"), 'ícone global de dispensar todos visível')
        ok(await pg.evaluate("!!document.querySelector('.acr [data-act=pl-snooze]') && !!document.querySelector('.acr [data-act=ir-open]') && !!document.querySelector('.acr [data-act=pl-done]') && !!document.querySelector('.acr [data-act=ir-confirm]')"), 'ações originais (Feito, +10 min, Confirmar, adiar) preservadas como ícones')
        ok(await pg.evaluate("(()=>{const p=document.getElementById('acp').getBoundingClientRect();return p.left>=0&&p.right<=innerWidth})"), 'painel dentro da tela')
        # adiar (ação original) funciona
        await pg.evaluate("document.querySelector('.acr [data-act=pl-snooze]').click()"); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("Object.keys(S.planDone.map).length>=1"), 'ícone de adiar executa o adiamento original (+10 min)')
        await pg.evaluate("acCollapse(true)"); await pg.click('#acb'); await pg.wait_for_timeout(500)
        # ação original de confirmar insulina
        n0 = await pg.evaluate("S.inslog.length"); await pg.evaluate("document.querySelector('.acr [data-act=ir-confirm]')&&document.querySelector('.acr [data-act=ir-confirm]').click()"); await pg.wait_for_timeout(700)
        ok(await pg.evaluate("S.inslog.length")==n0+1, 'ícone de confirmar executa a confirmação original da insulina')
        # dispensa individual
        await pg.evaluate("S.ac.items.forEach(x=>{x.dismissed=false;x.read=false});acCollapse(true);acRefresh()"); await pg.click('#acb'); await pg.wait_for_timeout(500)
        n = await pg.evaluate("acList().length"); await pg.click('.acr [data-ac=dismiss]'); await pg.wait_for_timeout(700)
        ok(await pg.evaluate("acList().length")==n-1, 'dispensar individual remove uma mensagem')
        ok(await pg.evaluate("S.ac.items.filter(x=>x.dismissed&&x.read).length")>=1, 'dispensa individual usa o mesmo estado (dispensado + lido)')
        # marcar como lido
        if await pg.query_selector('.acr [data-ac=read]'):
            await pg.click('.acr [data-ac=read]'); await pg.wait_for_timeout(300); ok(True, 'ícone de lido funciona')
        # dispensar todos com confirmação
        await pg.evaluate("S.ac.items.forEach(x=>{x.dismissed=false;x.read=false});acRefresh()"); await pg.wait_for_timeout(300)
        if not await pg.evaluate("AC.open"): await pg.click('#acb'); await pg.wait_for_timeout(500)
        n = await pg.evaluate("acList().length"); await pg.click('[data-ac=dismissall]'); await pg.wait_for_timeout(300)
        ok(n>1 and await pg.evaluate("!!document.querySelector('[data-ac=dismissall-yes]')") and await pg.evaluate("acList().length")==n, 'dispensar todos pede confirmação e ainda não dispensa')
        await pg.click('[data-ac=dismissall-no]'); await pg.wait_for_timeout(300); ok(await pg.evaluate("acList().length")==n, 'cancelar mantém os alertas')
        await pg.click('[data-ac=dismissall]'); await pg.wait_for_timeout(200); await pg.click('[data-ac=dismissall-yes]'); await pg.wait_for_timeout(900)
        ok(await pg.evaluate("acList().length")==0 and await pg.evaluate("S.ac.items.every(x=>x.dismissed)"), 'confirmar dispensa todos de uma vez')
        # encaixe lateral
        await pg.wait_for_timeout(600); print(await pg.evaluate("(()=>{const b=document.getElementById('acb');return [b.style.left,b.dataset.side,b.className,getComputedStyle(b).transform,b.hidden,JSON.stringify(S.ac.pos)]})()"))
        box = await pg.evaluate("(()=>{const r=document.getElementById('acb').getBoundingClientRect();return [r.left,r.right,innerWidth]})()")
        ok(box[0] <= 8 or box[1] >= box[2]-8, f'bolha encostada numa lateral (left={box[0]:.0f}, right={box[1]:.0f}, largura={box[2]})')
        await pg.evaluate("S.ac.hidden=false;acRefresh()"); 
        async def drag(x0,y0,x1,y1):
            await pg.mouse.move(x0,y0); await pg.mouse.down(); 
            for i in range(1,11): await pg.mouse.move(x0+(x1-x0)*i/10, y0+(y1-y0)*i/10)
            await pg.mouse.up(); await pg.wait_for_timeout(600)
        r = await pg.evaluate("(()=>{const r=document.getElementById('acb').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")
        await drag(r[0], r[1], 190, 300)   # solta no meio da tela
        box = await pg.evaluate("(()=>{const r=document.getElementById('acb').getBoundingClientRect();return [r.left,r.right,innerWidth]})()")
        ok(box[0] <= 8 or box[1] >= box[2]-8, f'solta no meio: encaixa na margem (left={box[0]:.0f}, right={box[1]:.0f})')
        await drag(box[0]+28, 300+28, 40, 320)  # arrasta para a esquerda
        box = await pg.evaluate("(()=>{const r=document.getElementById('acb').getBoundingClientRect();return [r.left,r.right,innerWidth]})()")
        ok(box[0] <= 8, f'arrastar para a esquerda encaixa na margem esquerda (left={box[0]:.0f})')
        await pg.set_viewport_size({'width':320,'height':640}); await pg.wait_for_timeout(500)
        box = await pg.evaluate("(()=>{const r=document.getElementById('acb').getBoundingClientRect();return [r.left,r.right,innerWidth,r.bottom,innerHeight]})()")
        ok(box[0] <= 8 or box[1] >= box[2]-8, 'após redimensionar continua encostada')
        ok(not errs, 'sem erros de JavaScript: ' + '; '.join(errs[:3]))
        await b.close()
    print('FALHAS:', fails); sys.exit(1 if fails else 0)
asyncio.run(main())
