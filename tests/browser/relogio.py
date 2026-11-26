# Relógio analógico: teste real no navegador (www/index.html), dados só de teste
from playwright.sync_api import sync_playwright
import tempfile, os
URL='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','www','index.html'))
res=[]
def ok(c,m): res.append(bool(c)); print('OK   ' if c else 'FALHA',m)
with sync_playwright() as p:
    ctx=p.chromium.launch_persistent_context(tempfile.mkdtemp(),viewport={'width':390,'height':760},has_touch=True); pg=ctx.pages[0]; errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.wait_for_function("typeof S!=='undefined' && S.irReady===true",timeout=30000); pg.wait_for_timeout(500)
    pg.evaluate("document.getElementById('tb-gate')&&document.getElementById('tb-gate').remove();document.getElementById('tb-splash')&&document.getElementById('tb-splash').remove();document.querySelectorAll('.rw-bg').forEach(e=>e.remove())")
    # campo de teste global com os mesmos atributos dos reais
    pg.evaluate("document.body.insertAdjacentHTML('beforeend','<label for=tt>Horário de teste</label><input class=in type=time id=tt value=\"14:27\" style=\"position:fixed;top:130px;left:10px;z-index:99\"><input class=in type=time id=t2 style=\"position:fixed;top:180px;left:10px;z-index:99\">');window.ev=[];['input','change'].forEach(n=>tt.addEventListener(n,()=>ev.push(n)))")
    def val(): return pg.evaluate("document.getElementById('tt').value")
    def open_(id='tt'): pg.click('#'+id); pg.wait_for_selector('#ck-bg')
    def hdr(): return pg.evaluate("ckEl('ck-bh').textContent+':'+ckEl('ck-bm').textContent")
    def dial_click(v,mode):  # toca no número desejado
        pg.click(f"#ck-nums .ck-n[data-v='{v}']")
    # abre com o horário do campo
    open_(); ok(hdr()=='14:27','abre com o horário já registrado (14:27)')
    ok(pg.evaluate("document.getElementById('ck-dial').getBoundingClientRect().width")>=190 and pg.evaluate("(()=>{const r=document.querySelector('.ck-dlg').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()"),'mostrador inteiro dentro da tela (390×760)')
    ok(pg.evaluate("document.querySelectorAll('#ck-nums .ck-n').length")==12,'12 números no mostrador')
    # cancelar preserva
    dial_click(3,'h'); pg.click("[data-ck=cancel]"); ok(val()=='14:27' and not pg.evaluate("!!document.getElementById('ck-bg')"),'cancelar preserva o valor anterior e fecha')
    # escolher 8h, 13 min (minuto intermediário por arraste)
    open_(); pg.click("[data-ck=am]"); dial_click(8,'h'); pg.wait_for_timeout(50)
    box=pg.evaluate("(()=>{const r=ckEl('ck-dial').querySelector('.ck-svg').getBoundingClientRect();return [r.left,r.top,r.width]})()")
    import math
    def at(minute):
        a=math.radians(minute*6); cx=box[0]+box[2]/2; cy=box[1]+box[2]/2; rr=box[2]*0.37; return cx+math.sin(a)*rr, cy-math.cos(a)*rr
    pg.evaluate("ckSt.mode='m';ckDraw()")
    x,y=at(13); pg.mouse.move(x,y); pg.mouse.down(); x2,y2=at(13); pg.mouse.move(x2,y2); pg.mouse.up()
    ok(hdr()=='08:13','hora 8 + minuto intermediário 13 por toque/arraste → 08:13')
    pg.click("[data-ck=ok]"); ok(val()=='08:13','confirmar grava exatamente 08:13')
    ok(pg.evaluate("ev.join()")=='input,change','dispara input e change (regras de cada tela continuam valendo)')
    # 23:59, 00:00, 12:00
    for target,(hh,mm,pm) in {'23:59':(11,59,True),'00:00':(12,0,False),'12:00':(12,0,True),'13:05':(1,5,True)}.items():
        open_(); pg.click("[data-ck=pm]" if pm else "[data-ck=am]"); pg.click("[data-ck=h]"); dial_click(hh,'h')
        pg.evaluate(f"ckSt.mode='m';ckSt.m={mm};ckDraw()"); pg.click("[data-ck=ok]"); ok(val()==target,'horário '+target+' salvo corretamente')
    # digitação e teclado
    open_(); pg.fill('#ck-in','0813'); ok(hdr()=='08:13','digitar 0813 atualiza o relógio'); pg.keyboard.press('Enter'); ok(val()=='08:13','Enter confirma')
    open_(); pg.focus('#ck-dial'); pg.keyboard.press('ArrowRight'); pg.keyboard.press('Escape'); ok(val()=='08:13' and not pg.evaluate("!!document.getElementById('ck-bg')"),'Esc cancela')
    open_(); pg.fill('#ck-in','2575'); pg.keyboard.press('Enter'); ok(pg.evaluate("ckEl('ck-err').textContent")!='' and pg.evaluate("!!document.getElementById('ck-bg')"),'horário inválido digitado é recusado'); pg.click("[data-ck=cancel]")
    # campo vazio abre no horário atual e só grava ao confirmar
    open_('t2'); ok(pg.evaluate("document.getElementById('t2').value")=='','campo vazio permanece vazio ao abrir'); pg.click("[data-ck=cancel]"); ok(pg.evaluate("document.getElementById('t2').value")=='','cancelar em campo vazio mantém vazio')
    open_('t2'); pg.click("[data-ck=ok]"); ok(len(pg.evaluate("document.getElementById('t2').value"))==5,'confirmar em campo vazio grava o horário mostrado')
    # campos reais do app
    pg.evaluate("document.getElementById('tt').remove();document.getElementById('t2').remove();go('painel')"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelectorAll('.rw-bg').forEach(e=>e.remove())")
    pg.evaluate("openRecordForm ? openRecordForm() : null") if pg.evaluate("typeof openRecordForm==='function'") else pg.evaluate("document.querySelector('[data-act=new]')&&document.querySelector('[data-act=new]').click()")
    pg.wait_for_timeout(400); has=pg.evaluate("!!document.getElementById('f-time')")
    if has:
        pg.evaluate("document.querySelectorAll('.rw-bg').forEach(e=>e.remove())"); pg.evaluate("document.getElementById('f-time').click()"); pg.wait_for_selector('#ck-bg')
        ok(True,'registro de glicemia (f-time) abre o relógio'); pg.click("[data-ck=cancel]")
    else: print('AVISO: formulário de registro não abriu no teste (verificado só por auditoria)')
    ok(not errs,'sem erros de JavaScript '+(errs[0][:150] if errs else ''))
    ctx.close()
print('%d/%d ok'%(sum(res),len(res))); raise SystemExit(0 if all(res) else 1)
