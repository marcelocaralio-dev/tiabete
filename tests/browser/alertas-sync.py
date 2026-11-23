"""Cenários A–G do sistema de alertas (0.38.0). Chromium real, app compilado (www/), contexto persistente para testar reinício.
Uso: python3 tests/browser/alertas-sync.py [url]   (sem url: sobe um servidor local em www/)"""
import asyncio, sys, os, tempfile, subprocess, time
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
URL = sys.argv[1] if len(sys.argv) > 1 else None
ok_n = bad_n = 0
def check(c, m):
    global ok_n, bad_n
    print(('ok   ' if c else 'FALHOU: ') + m); ok_n += bool(c); bad_n += (not c)

async def open_app(ctx, url):
    pg = ctx.pages[0] if ctx.pages else await ctx.new_page()
    pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    await pg.goto(url)
    await pg.wait_for_function("typeof S!=='undefined' && S.irReady===true", timeout=15000)
    await pg.wait_for_timeout(700)
    for sel in ('#gate-skip', '#rw-ok'):
        for _ in range(3):
            if await pg.query_selector(sel): await pg.click(sel); await pg.wait_for_timeout(250)
    return pg

SETUP = """async(o)=>{
  const d=new Date(Date.now()-10*60000), hm=pad(d.getHours())+':'+pad(d.getMinutes());
  S.plan=plClean({types:['insulina','remedios'],insulin:[{id:'b1',name:'Lantus',role:'basal',times:[hm],alarm:true,dose:'10 Ui'}],meds:[{id:'m1',name:'Metformina',times:[hm],alarm:true}]}); await plSave();
  irLoad(irClean({on:true,adopted:o.ir?['b1']:[],items:o.ir?[{id:'r1',itemId:'b1',type:'basal',time:hm,src:hm,on:true,name:'Lantus'}]:[]},uid)); await irSave();
  S.ins.basalTs=null; acSetMode('bubble'); S.ac.hidden=false; acSync(); await new Promise(r=>setTimeout(r,150)); return hm; }"""
LIVE = "acList().filter(x=>x.active&&x.src==='%s')"
NB = "S.inslog.filter(x=>x.kind==='basal').length"

async def fresh(p, url):
    d = tempfile.mkdtemp(prefix='al-')
    ctx = await p.chromium.launch_persistent_context(d, viewport={'width': 400, 'height': 860}, args=['--no-sandbox'])
    return d, ctx, await open_app(ctx, url)
async def restart(p, d, ctx, url):
    await ctx.close()
    ctx = await p.chromium.launch_persistent_context(d, viewport={'width': 400, 'height': 860}, args=['--no-sandbox'])
    return ctx, await open_app(ctx, url)

async def main(url):
    async with async_playwright() as p:
        # ---- A: registro pela tela Meu tratamento
        d, ctx, pg = await fresh(p, url); hm = await pg.evaluate(SETUP, {'ir': True})
        check(len(await pg.evaluate(LIVE % 'insrem' + '.map(x=>x.id)')) == 1, 'A: alerta de basal aparece na bolha')
        await pg.evaluate("openSheet(treatmentCard())"); await pg.wait_for_timeout(400)
        await pg.click('[data-act=ins-basal]'); await pg.wait_for_timeout(800)
        check(await pg.evaluate("irDueNow().length") == 0, 'A: alerta deixa de estar pendente')
        check(await pg.evaluate("(LIVE=>acList().filter(x=>x.active&&x.src==='insrem').length)()") == 0, 'A: bolha não mostra mais o alerta')
        it = await pg.evaluate("S.ac.items.find(x=>x.src==='insrem')")
        check(it and it['st'] == 'concluido', 'A: item da bolha ficou Concluído (%s)' % (it and it['st']))
        check(await pg.evaluate(NB) == 1, 'A: um único registro no histórico')
        # ---- E (parte 1): confirmar de novo pela bolha / toques simultâneos
        r = await pg.evaluate("(async()=>{const d=isoDate(new Date());await Promise.all([irConfirm('r1',d),irConfirm('r1',d)]);return S.inslog.filter(x=>x.kind==='basal').length})()")
        check(r == 1, 'E: reconfirmar pela bolha não cria 2º registro (%s)' % r)
        # ---- G: reinício
        await pg.wait_for_timeout(300); ctx, pg = await restart(p, d, ctx, url)
        check(await pg.evaluate(NB) == 1 and await pg.evaluate("irDueNow().length") == 0 and await pg.evaluate("acList().filter(x=>x.active&&x.src==='insrem').length") == 0, 'G: após reiniciar, histórico com 1 registro e alerta não reaparece')
        await ctx.close()

        # ---- B: registro pela bolha (botão real)
        d, ctx, pg = await fresh(p, url); await pg.evaluate(SETUP, {'ir': True})
        await pg.evaluate("acOpen()"); await pg.wait_for_timeout(300)
        btn = await pg.query_selector('#acp [data-act=ir-confirm], .acp [data-act=ir-confirm], [data-act=ir-confirm]')
        check(btn is not None, 'B: botão de confirmar aparece na bolha')
        if btn: await btn.click(); await pg.wait_for_timeout(900)
        check(await pg.evaluate(NB) == 1, 'B: um único registro de basal')
        check(await pg.evaluate("basalInfo().st") == 'ok', 'B: Meu tratamento reconhece a basal como tomada')
        check(await pg.evaluate("acList().filter(x=>x.active&&x.src==='insrem').length") == 0, 'B: alerta sai da bolha')
        check(await pg.evaluate("S.inslog.find(x=>x.kind==='basal').occ") is not None, 'B: registro ligado à ocorrência (occ)')
        # undo: apagar o registro faz o alerta voltar (única volta de um concluído)
        await pg.evaluate("logDel(S.inslog.find(x=>x.kind==='basal').id)"); await pg.wait_for_timeout(500)
        check(await pg.evaluate("irDueNow().length") == 1 and await pg.evaluate("S.ac.items.find(x=>x.src==='insrem').st") in ('pendente', 'exibido'), 'B: apagar o registro reabre o alerta')
        await ctx.close()

        # ---- C: alerta desativado
        d, ctx, pg = await fresh(p, url); await pg.evaluate(SETUP, {'ir': True})
        check(await pg.evaluate("acList().filter(x=>x.active&&x.src==='insrem').length") == 1, 'C: alerta ativo na bolha')
        await pg.evaluate("(async()=>{S.ir.items[0].on=false;await irSave();})()"); await pg.wait_for_timeout(400)
        check(await pg.evaluate("acList().filter(x=>x.src==='insrem').length") == 0, 'C: desativado some da bolha na hora')
        check(await pg.evaluate("S.ac.items.find(x=>x.src==='insrem').st") == 'desativado', 'C: estado Desativado')
        check(await pg.evaluate("irNotifPlan(S.ir,S.plan,{}).length") == 0 and await pg.evaluate("irDueNow().length") == 0, 'C: sem agendamento nem aviso')
        await pg.wait_for_timeout(300); ctx, pg = await restart(p, d, ctx, url)
        await pg.wait_for_timeout(500)
        check(await pg.evaluate("S.ir.items[0].on") is False and await pg.evaluate("acList().filter(x=>x.src==='insrem').length") == 0, 'C: após reiniciar continua desativado')
        # chave geral dos alertas do tratamento
        await pg.evaluate(SETUP, {'ir': False}); await pg.wait_for_timeout(300)
        n1 = await pg.evaluate("acList().filter(x=>x.active&&x.src==='plano').length")
        await pg.evaluate("(async()=>{S.alerts={...alCfg(),plan:false};await alSave();})()"); await pg.wait_for_timeout(400)
        check(n1 >= 1 and await pg.evaluate("acList().filter(x=>x.src==='plano').length") == 0, 'C: chave "alertas do tratamento" desligada some da bolha (antes %s)' % n1)
        await ctx.close()

        # ---- D: alteração de horário
        d, ctx, pg = await fresh(p, url); await pg.evaluate(SETUP, {'ir': True})
        old = await pg.evaluate("S.ir.items[0].time")
        await pg.evaluate("(async()=>{S.ir.items[0].time='23:50';S.ir.items[0].src='23:50';await irSave();})()"); await pg.wait_for_timeout(400)
        check(await pg.evaluate("irNotifPlan(S.ir,S.plan,{}).map(x=>x.hour+':'+x.minute).join()") == '23:50' or True, 'D: (informativo) plano nativo')
        plan = await pg.evaluate("irNotifPlan(S.ir,S.plan,{}).map(x=>x.hour*60+x.minute)")
        check(set(plan) == {23 * 60 + 50}, 'D: só o novo horário permanece agendado (%s)' % plan)
        check(await pg.evaluate("S.ac.items.find(x=>x.src==='insrem').st") == 'cancelado' and await pg.evaluate("acList().filter(x=>x.src==='insrem').length") == 0, 'D: ocorrência do horário antigo fica Cancelada e sai da bolha')
        # alarme do tratamento (sem lembrete de insulina): trocar horário
        await pg.evaluate(SETUP, {'ir': False}); await pg.wait_for_timeout(200)
        await pg.evaluate("(async()=>{S.plan.insulin[0].times=['23:51'];await plSave();})()"); await pg.wait_for_timeout(400)
        keys = await pg.evaluate("planAlarms().filter(a=>a.sec==='Insulina').map(a=>a.time)")
        check(keys == ['23:51'], 'D: alarme do tratamento só no novo horário (%s)' % keys)
        await ctx.close()

        # ---- E (parte 2): registrar na bolha e depois na tela; alarme do tratamento "Feito"
        d, ctx, pg = await fresh(p, url); await pg.evaluate(SETUP, {'ir': False})
        check(await pg.evaluate("acList().filter(x=>x.active&&x.src==='plano'&&/Lantus/.test(x.text)).length") == 1, 'E: alarme de insulina do tratamento aparece')
        await pg.evaluate("go('painel');render()")
        await pg.evaluate("(async()=>{const el=document.createElement('button');el.dataset.act='pl-done';el.dataset.k=planAlarms().find(a=>a.sec==='Insulina').key;document.body.appendChild(el);el.click();})()")
        await pg.wait_for_timeout(800)
        check(await pg.evaluate(NB) == 1, 'E: "Feito" no alarme de insulina cria 1 registro')
        await pg.evaluate("openSheet(treatmentCard())"); await pg.wait_for_timeout(300)
        dis = await pg.evaluate("(document.querySelector('[data-act=ins-basal]')||{}).disabled")
        check(dis or await pg.evaluate("basalInfo().st") == 'ok', 'E: Meu tratamento já mostra a basal como tomada')
        check(await pg.evaluate("plPending().filter(a=>a.sec==='Insulina').length") == 0, 'E: alarme não pede mais a dose')
        # medicamento: estado persiste ao reiniciar
        await pg.evaluate("(async()=>{plDoneRoll();S.planDone.map[planAlarms().find(a=>a.sec==='Medicamento'||a.sec==='Remédio'||/Metformina/.test(a.label)).key]=1;await adSave();})()"); await pg.wait_for_timeout(300)
        await ctx.close() if False else None
        ctx, pg = await restart(p, d, ctx, url); await pg.wait_for_timeout(500)
        check(await pg.evaluate("plPending().filter(a=>/Metformina/.test(a.label)).length") == 0 and await pg.evaluate(NB) == 1, 'G: "Feito" do medicamento e a basal persistem após reiniciar')
        await ctx.close()

        # ---- F: recorrência
        d, ctx, pg = await fresh(p, url); await pg.evaluate(SETUP, {'ir': True})
        res = await pg.evaluate("""async()=>{ const r=S.ir.items[0], today=isoDate(new Date()), tm=isoDate(new Date(Date.now()+864e5));
          await irConfirm('r1',today);
          const keys=Object.keys(S.ir.state), nxt=irOccStatus(S.ir,S.plan,irOccId(irKey(tm,'r1',r.time)),Date.now(),S.inslog);
          const tmAt=mkTs(tm,r.time)+60000, due=irDue(S.ir,S.plan,tmAt,S.inslog);
          return { keys, nxt, dueTomorrow: due.length, dueKey: due[0]&&due[0].key, nextAt: irNextAt(r,Date.now()) > Date.now() } }""")
        check(len(res['keys']) == 1 and res['keys'][0].startswith(await pg.evaluate("isoDate(new Date())")), 'F: só a ocorrência de hoje foi concluída')
        check(res['nxt']['st'] == 'programado' and res['dueTomorrow'] == 1 and res['nextAt'], 'F: a próxima ocorrência segue programada e pendente na hora (não é confundida com a anterior)')
        await ctx.close()
        print('erros de página:', pg.errs)
    print('\n== %d ok, %d falhas ==' % (ok_n, bad_n)); return bad_n

if URL: sys.exit(1 if asyncio.run(main(URL)) else 0)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8791'], cwd=os.path.join(ROOT, 'www'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try: rc = asyncio.run(main('http://localhost:8791/index.html'))
finally: srv.kill()
sys.exit(1 if rc else 0)
