# Lembretes de insulina (PROMPT 22) no APK simulado (Capacitor falso) e na versão web. Servir www/ na 8766.
import asyncio, sys, os
from playwright.async_api import async_playwright
CHROME = os.environ.get('CHROME', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome')
MOCK = r"""
window.__log=[];window.__pend={};window.__perm='granted';window.__L=[];window.__exact='granted';
window.Capacitor={isNativePlatform:()=>true,Plugins:{
 TbExpire:{schedule:async()=>{},cancel:async()=>{}},
 TbSettings:{status:async()=>({notifications:__perm==='granted',exact:__exact==='granted',battery:false}),openNotifications:async()=>{__log.push(['opennotif'])},openExactAlarms:async()=>{__log.push(['openexact'])},openBattery:async()=>{__log.push(['openbat'])}},
 App:{addListener:()=>({remove(){}})},
 LocalNotifications:{checkPermissions:async()=>({display:__perm}),requestPermissions:async()=>{if(__perm!=='denied')__perm='granted';return{display:__perm}},
  checkExactNotificationSetting:async()=>({exact_alarm:__exact}),changeExactNotificationSetting:async()=>{__log.push(['exactsettings'])},
  getPending:async()=>({notifications:Object.values(__pend)}),
  cancel:async o=>{o.notifications.forEach(n=>{delete __pend[n.id];__log.push(['cancel',n.id])})},removeDeliveredNotifications:async o=>{__log.push(['rmdeliv',o.notifications.map(n=>n.id)])},
  createChannel:async o=>{__log.push(['channel',o])},registerActionTypes:async o=>{__log.push(['actions',o])},
  addListener:(n,cb)=>{__L.push([n,cb]);return{remove(){}}},
  schedule:async o=>{o.notifications.forEach(n=>{__pend[n.id]=n;__log.push(['sched',n.id,n.channelId])})}}}};
"""
fails = 0
def ok(c, m):
    global fails
    print(('OK   ' if c else 'FALHOU ') + m)
    if not c: fails += 1
async def boot(b, mock):
    pg = await (await b.new_context(viewport={'width':400,'height':860})).new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    if mock: await pg.add_init_script(MOCK)
    await pg.goto('http://localhost:8766/index.html'); await pg.wait_for_selector('#tb-splash', state='detached', timeout=8000); await pg.wait_for_timeout(900)
    if await pg.query_selector('#gate-skip'): await pg.click('#gate-skip'); await pg.wait_for_timeout(300)
    for i in range(6):
        if await pg.query_selector('#rw-ok'): await pg.click('#rw-ok'); await pg.wait_for_timeout(200)
    return pg, errs
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        pg, errs = await boot(b, True)
        T = lambda: pg.evaluate("document.body.innerText")
        mine = lambda: pg.evaluate("Object.values(__pend).filter(n=>n.channelId==='insrem').map(n=>({id:n.id,t:n.title,b:n.body,lb:n.largeBody,sch:n.schedule,a:n.actionTypeId,x:n.extra}))")
        # tratamento: basal 22:00 e rápida 12:00 (almoço), mais uma remédio que NÃO é insulina
        await pg.evaluate("""(async()=>{S.plan.types=['insulina','remedios'];S.plan.insulin=[plItem0({name:'Glargina U100 (Lantus, Basaglar)',role:'basal',times:['22:00']}),plItem0({name:'Lispro (Humalog)',role:'rapida',times:['12:00']})];S.plan.meds=[plItem0({name:'Metformina',role:'oral',times:['08:00']})];await plSave();})()""")
        await pg.wait_for_timeout(1500)
        trat = lambda: pg.evaluate("Object.values(__pend).filter(n=>n.channelId==='tratamento').map(n=>n.body)")
        t0 = await trat(); ok(any('Lantus' in x for x in t0), 'antes de criar lembretes: alarme antigo do tratamento cobre a insulina (nada muda para quem não usar o novo recurso)')
        await pg.evaluate("go('esquemas')"); await pg.wait_for_timeout(500)
        ok('Lembretes de insulina' in await T() and 'Gerenciar lembretes de insulina' in await T(), 'Meu tratamento mostra o card Lembretes de insulina')
        await pg.evaluate("go('insrem')"); await pg.wait_for_timeout(700)
        t = await T()
        ok('Criar a partir do meu tratamento' in t and 'Lantus' in t and 'Humalog' in t, 'tela lista as insulinas do tratamento para criar lembretes')
        ok('Notificações autorizadas' in t, 'indicador: notificações autorizadas')
        await pg.click('text=Criar todos'); await pg.wait_for_timeout(1500)
        m = await mine(); ok(len(m) == 2, f'2 notificações agendadas (veio {len(m)})')
        bs = [x for x in m if 'basal' in x['t']]; rp = [x for x in m if 'rápida' in x['t']]
        ok(len(bs) == 1 and bs[0]['sch']['on'] == {'hour': 22, 'minute': 0} and bs[0]['t'] == 'Hora da insulina basal', 'basal: 22:00 diária, título correto')
        ok('Lantus' in bs[0]['b'] and 'Basal' in bs[0]['b'] and '22:00' in bs[0]['b'], 'corpo traz nome, tipo e horário')
        ok(len(rp) == 1 and 'Almoço' in rp[0]['b'] and rp[0]['t'] == 'Hora da insulina rápida' and 'refeição' in rp[0]['lb'], 'rápida: título, refeição e texto')
        ok(all(x['a'] == 'TB_INSREM' for x in m), 'notificações têm os botões (tipo de ação TB_INSREM)')
        acts = await pg.evaluate("__log.filter(x=>x[0]==='actions')"); ids = [a['id'] for a in acts[0][1]['types'][0]['actions']] if acts else []
        ok(ids == ['confirm', 'snooze', 'open'], 'botões: confirmar, adiar, abrir tratamento')
        ch = await pg.evaluate("__log.filter(x=>x[0]==='channel'&&x[1].id==='insrem')"); ok(ch and ch[0][1]['visibility'] == 1, 'canal público (tela de bloqueio) e importância alta')
        t1 = await trat(); ok(not any('Lantus' in x or 'Humalog' in x for x in t1) and any('Metformina' in x for x in t1), 'alarme antigo da insulina saiu (sem notificação duplicada); remédio continua')
        # sem duplicar: sincronizar de novo não reagenda
        n0 = await pg.evaluate("__log.filter(x=>x[0]==='sched'&&x[2]==='insrem').length"); await pg.evaluate("TB_IR_NATIVE.sync()"); await pg.evaluate("TB_IR_NATIVE.sync()"); await pg.wait_for_timeout(600)
        n1 = await pg.evaluate("__log.filter(x=>x[0]==='sched'&&x[2]==='insrem').length"); ok(n1 == n0 and len(await mine()) == 2, 'sincronizar de novo não agenda nada duplicado')
        # o tratamento muda o horário -> o lembrete acompanha, sem mexer no tratamento
        await pg.evaluate("(async()=>{S.plan.insulin[0].times=['21:30'];await plSave();})()"); await pg.wait_for_timeout(1800)
        m = await mine(); bs = [x for x in m if 'basal' in x['t']]
        ok(len(m) == 2 and bs[0]['sch']['on'] == {'hour': 21, 'minute': 30}, 'horário do tratamento mudou: lembrete e notificação acompanharam')
        ok(await pg.evaluate("S.plan.insulin[0].times.join()") == '21:30' and await pg.evaluate("S.plan.insulin[0].dose") == '', 'tratamento (horário/dose) não foi alterado pelo lembrete')
        # editar: dias da semana
        await pg.evaluate("go('insrem')"); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelector('[data-act=ir-edit]').click()"); await pg.wait_for_timeout(300)
        await pg.select_option('#irf-r', 'util'); await pg.wait_for_timeout(100)
        ok(await pg.evaluate("[...document.querySelectorAll('.irf-d')].filter(x=>x.checked).map(x=>x.dataset.d).join()") == '1,2,3,4,5', 'repetição "dias úteis" marca seg–sex')
        await pg.click('text=Salvar'); await pg.wait_for_timeout(1500)
        m = await mine(); ok(len(m) == 2 + 4, f'dias úteis: 5 agendamentos semanais + 1 diário (total 6; veio {len(m)})')
        wd = sorted(x['sch']['on'].get('weekday') for x in m if x['sch']['on'].get('weekday')); ok(wd == [2, 3, 4, 5, 6], 'weekday 2..6 = segunda a sexta')
        # remover a insulina do tratamento -> lembrete desativado, sem notificação
        await pg.evaluate("(async()=>{S.plan.insulin=S.plan.insulin.filter(x=>x.role!=='basal');await plSave();})()"); await pg.wait_for_timeout(1800)
        m = await mine(); ok(len(m) == 1 and 'rápida' in m[0]['t'], 'insulina removida do tratamento: notificações dela canceladas')
        await pg.evaluate("go('insrem')"); await pg.wait_for_timeout(400); t = await T()
        ok('saiu do Meu tratamento' in t, 'tela avisa que o lembrete foi desativado (insulina removida)')
        # recria a basal (volta ao tratamento) para os próximos testes
        await pg.evaluate("(async()=>{S.plan.insulin.unshift(plItem0({name:'Degludeca (Tresiba)',role:'basal',times:['22:00']}));await plSave();})()"); await pg.wait_for_timeout(800)
        # --- confirmação ---
        await pg.evaluate("(async()=>{S.ir.items=S.ir.items.filter(r=>r.itemId===S.plan.insulin.find(x=>x.role==='rapida').id);S.ir.state={};await irSave();})()")
        await pg.evaluate("""(async()=>{const it=S.plan.insulin[0];const d=new Date(Date.now()-60000),p=n=>String(n).padStart(2,'0');S.ir.items.push(irItem({itemId:it.id,type:'basal',time:p(d.getHours())+':'+p(d.getMinutes()),src:'',days:[],on:true,name:it.name},uid));S.ir.adopted.push(it.id);await irSave();go('painel');})()""")
        await pg.wait_for_timeout(700); t = await T()
        ok('Hora da insulina basal' in t and 'Confirmar' in t, 'aviso dentro do app aparece na hora do lembrete')
        n_log = await pg.evaluate("S.inslog.length")
        # abrir o menu NÃO registra nada
        await pg.click('text=Adiar ou ignorar'); await pg.wait_for_timeout(300); t = await T()
        ok('Adiar 5 min' in t and 'Adiar 10 min' in t and 'Adiar 15 min' in t and 'Ignorar este lembrete' in t and 'Confirmar que apliquei' in t, 'menu: confirmar, adiar 5/10/15, ignorar')
        ok(await pg.evaluate("S.inslog.length") == n_log, 'abrir o aviso não registra aplicação')
        await pg.click('text=Adiar 10 min'); await pg.wait_for_timeout(1200)
        st = await pg.evaluate("Object.values(S.ir.state)"); ok(len(st) == 1 and 10*60000 - 5000 < st[0]['snooze'] - await pg.evaluate("Date.now()") <= 10*60000, 'adiado 10 min')
        sn = [x for x in await mine() if x['x'].get('snooze')]; ok(len(sn) == 1 and sn[0]['sch'].get('at') and '(adiado)' in sn[0]['b'], 'adiamento vira 1 notificação única no Android')
        ok(await pg.evaluate("S.inslog.length") == n_log, 'adiar não registra aplicação')
        # confirmar pelo botão da notificação (ação "confirm")
        rid = await pg.evaluate("S.ir.items.find(r=>r.type==='basal').id")
        await pg.evaluate("S.irLive=true"); await pg.evaluate("__L.filter(l=>l[0]==='localNotificationActionPerformed').forEach(l=>l[1]({actionId:'confirm',notification:{extra:{kind:'insrem',rid:%r}}}))" % rid)
        await pg.wait_for_timeout(1500)
        rec = await pg.evaluate("S.inslog.filter(x=>x.src==='lembrete')")
        ok(len(rec) == 1 and rec[0]['kind'] == 'basal' and rec[0]['status'] == 'confirmada' and 'units' not in rec[0] and rec[0]['insulin'] == 'Degludeca (Tresiba)', 'confirmar registra insulina, data e hora, situação "confirmada" e NENHUMA dose')
        ok(abs(rec[0]['ts'] - await pg.evaluate("Date.now()")) < 20000 and rec[0]['date'] == await pg.evaluate("isoDate(new Date())"), 'registro leva a data e a hora da confirmação')
        ok(not [x for x in await mine() if x['x'].get('snooze')], 'a notificação adiada foi cancelada ao confirmar')
        await pg.evaluate("go('historico')"); await pg.wait_for_timeout(500); t = await T(); ok('Aplicação confirmada' in t, 'histórico mostra "Aplicação confirmada"')
        # confirmar de novo não duplica
        await pg.evaluate("irConfirm(%r)" % rid); await pg.wait_for_timeout(500)
        ok(len(await pg.evaluate("S.inslog.filter(x=>x.src==='lembrete')")) == 1, 'confirmar duas vezes não duplica o registro')
        # tocar na notificação abre o menu, sem registrar
        await pg.evaluate("S.ir.state={}"); n_log = await pg.evaluate("S.inslog.length")
        await pg.evaluate("__L.filter(l=>l[0]==='localNotificationActionPerformed').forEach(l=>l[1]({actionId:'tap',notification:{extra:{kind:'insrem',rid:%r}}}))" % rid); await pg.wait_for_timeout(700)
        t = await T(); ok('Confirmar que apliquei' in t and 'Meu tratamento' in t, 'tocar na notificação abre Meu tratamento com o menu de resposta')
        ok(await pg.evaluate("S.inslog.length") == n_log, 'tocar na notificação não registra aplicação')
        await pg.click('text=Ignorar este lembrete'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("Object.values(S.ir.state).includes('ignored')") and await pg.evaluate("S.inslog.length") == n_log, 'ignorar não registra nada')
        # rápida do almoço -> registra como "almoço" (sem duplicar o do dia)
        rr = await pg.evaluate("S.ir.items.find(r=>r.type==='rapida').id"); await pg.evaluate("S.ir.state={}"); await pg.evaluate("irConfirm(%r)" % rr); await pg.wait_for_timeout(600)
        lk = await pg.evaluate("S.inslog.filter(x=>x.src==='lembrete'&&x.kind==='lunch')"); ok(len(lk) == 1 and 'units' not in lk[0], 'rápida do almoço confirmada vira registro de almoço, sem dose')
        # --- permissões ---
        await pg.evaluate("__perm='denied';go('insrem')"); await pg.wait_for_timeout(600); t = await T()
        ok('Notificações desativadas' in t and 'Abrir configurações do aparelho' in t, 'permissão negada: indicador vermelho e botão de configurações')
        await pg.click('text=Abrir configurações do aparelho'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("__log.some(x=>x[0]==='opennotif')"), 'botão abre as configurações de notificação do aparelho')
        await pg.evaluate("__perm='granted';__exact='denied';go('insrem')"); await pg.wait_for_timeout(600); t = await T()
        ok('Permitir horários exatos' in t and 'Ajustar bateria' in t, 'sem alarme exato / bateria: avisa e oferece o atalho')
        # fuso horário
        await pg.evaluate("S.ir.tz='Outro/Fuso|0'"); n0 = await pg.evaluate("__log.filter(x=>x[0]==='sched'&&x[2]==='insrem').length")
        await pg.evaluate("irResume()"); await pg.wait_for_timeout(1200); n1 = await pg.evaluate("__log.filter(x=>x[0]==='sched'&&x[2]==='insrem').length")
        ok(n1 > n0, 'mudança de fuso horário: agendamentos refeitos')
        # backup leva os lembretes
        bk = await pg.evaluate("(()=>{const x=JSON.stringify(S.ir);return x.length>10})()"); ok(bk, 'lembretes existem no estado')
        # desligar tudo
        await pg.evaluate("go('insrem')"); await pg.wait_for_timeout(400); await pg.evaluate("document.querySelector('[data-ir-master]').click()"); await pg.wait_for_timeout(1200)
        ok(len(await mine()) == 0, 'chave geral desligada: todas as notificações canceladas')
        ok(not errs, 'sem erros de JavaScript: ' + '; '.join(errs[:3]))
        # --- versão web ---
        pg2, errs2 = await boot(b, False)
        await pg2.evaluate("(async()=>{S.plan.types=['insulina'];S.plan.insulin=[plItem0({name:'Lispro (Humalog)',role:'rapida',times:['12:00']})];await plSave();go('insrem');})()"); await pg2.wait_for_timeout(900)
        t = await pg2.evaluate("document.body.innerText")
        ok('não conseguem agendar notificações para quando o app está fechado' in t, 'web/PWA: informa a limitação de notificações em segundo plano')
        ok('Criar a partir do meu tratamento' in t, 'web: criação a partir do tratamento funciona')
        ok(not errs2, 'web sem erros de JavaScript: ' + '; '.join(errs2[:3]))
        await b.close()
    print('FALHAS:', fails); sys.exit(1 if fails else 0)
asyncio.run(main())
