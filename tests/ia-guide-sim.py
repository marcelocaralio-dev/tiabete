# Assistente de IA do APK (Capacitor mockado). Uso: servir www/ na porta 8766 e rodar python3 tests/ia-guide-sim.py
import asyncio, re, json
from playwright.async_api import async_playwright
src = open('tests/ai-sim.py', encoding='utf-8').read()
MOCK = re.search(r'MOCK = r"""(.*?)"""', src, re.S).group(1)
SECRET = 'AIzaSyD-SEGREDO-MUITO-LONGO-1234567890'
async def boot(ctx, errs):
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)
    await pg.add_init_script(MOCK)
    await pg.add_init_script("navigator.clipboard.readText = async()=>window.__clip||''; navigator.clipboard.writeText = async t=>{window.__copied=t}")
    await pg.goto('http://localhost:8766/index.html'); await pg.wait_for_selector('#tb-splash', state='detached', timeout=8000); await pg.wait_for_timeout(800)
    if await pg.query_selector('#gate-skip'): await pg.click('#gate-skip'); await pg.wait_for_timeout(200)
    for i in range(6):
        if await pg.query_selector('#rw-ok'): await pg.click('#rw-ok'); await pg.wait_for_timeout(150)
    return pg
async def main():
    bad = 0
    def ok(n, c):
        nonlocal bad
        print(('OK   ' if c else 'FALHA'), n); bad += 0 if c else 1
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 400, 'height': 900}); errs = []
        pg = await boot(ctx, errs)
        await pg.evaluate("go('ia')"); await pg.wait_for_timeout(700)
        T = lambda: pg.evaluate(r"document.body.textContent.replace(/\s+/g,' ')")
        t = await T()
        heads = await pg.evaluate("[...document.querySelectorAll('h2.sec')].map(h=>h.textContent.trim())")
        ok('8 seções: ' + str(heads), len(heads) == 8)
        ok('etapa 1 e 0%', 'Etapa 1 de 7' in t and await pg.evaluate("document.querySelector('.ia-bar').getAttribute('aria-valuenow')") == '0')
        # abrir todas para testes
        await pg.evaluate("document.querySelectorAll('h2.acc-h[aria-expanded=false]').forEach(h=>accToggle(h,true))")
        # etapa 1: escolher provedor
        await pg.click('.ia-chips [data-p=gemini]'); await pg.wait_for_timeout(300)
        ok('etapa 2 após escolher', 'Etapa 2 de 7' in await T())
        await pg.click('.ia-now [data-act=ai-open]'); await pg.wait_for_timeout(300)
        ok('abre site oficial', await pg.evaluate("__open.slice(-1)[0]") == 'https://aistudio.google.com' and 'Etapa 3 de 7' in await T())
        await pg.click('.ia-now [data-act=ai-mark]'); await pg.wait_for_timeout(300)
        ok('etapa 4', 'Etapa 4 de 7' in await T())
        await pg.click('.ia-now [data-act=ai-open]'); await pg.wait_for_timeout(300)
        ok('página da chave', await pg.evaluate("__open.slice(-1)[0]") == 'https://aistudio.google.com/apikey')
        await pg.click('.ia-now [data-act=ai-copy]'); await pg.wait_for_timeout(200)
        ok('copiar endereço', await pg.evaluate("window.__copied") == 'https://aistudio.google.com/apikey')
        await pg.click('.ia-now [data-act=ai-mark][data-k=copied]'); await pg.wait_for_timeout(300)
        ok('etapa 5', 'Etapa 5 de 7' in await T())
        # colar chave (rascunho cifrado)
        await pg.evaluate("window.__clip=%s" % json.dumps(SECRET)); await pg.click('[data-act=ai-paste]'); await pg.wait_for_timeout(500)
        ok('campo preenchido', await pg.evaluate("document.getElementById('ai-key').value") == SECRET)
        raw = await pg.evaluate("""(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('tb-secure');q.onsuccess=()=>r(q.result)});const v=await new Promise(r=>{const q=db.transaction('k').objectStore('k').get('s:ai-key-draft');q.onsuccess=()=>r(q.result)});return v?JSON.stringify(Array.from(new Uint8Array(v.ct)))+'|'+(typeof v.ct):null})()""")
        ok('rascunho cifrado (sem texto claro)', raw is not None and 'SEGREDO' not in raw)
        await pg.click('[data-act=ai-eye]')
        ok('mostrar/ocultar chave', await pg.evaluate("document.getElementById('ai-key').type") == 'text')
        await pg.click('[data-act=ai-eye]'); ok('ocultar de novo', await pg.evaluate("document.getElementById('ai-key').type") == 'password')
        await pg.fill('#ai-key', 'xyz'); await pg.wait_for_timeout(100)
        ok('aviso de prefixo', 'começar com AIza' in await pg.evaluate("document.getElementById('ai-keyhint').textContent"))
        await pg.fill('#ai-key', SECRET); await pg.wait_for_timeout(900)
        # sair e voltar: progresso salvo
        await pg.close(); pg = await boot(ctx, errs); T = lambda: pg.evaluate(r"document.body.textContent.replace(/\s+/g,' ')")
        await pg.evaluate("go('ia')"); await pg.wait_for_timeout(900)
        await pg.evaluate("document.querySelectorAll('h2.acc-h[aria-expanded=false]').forEach(h=>accToggle(h,true))")
        t = await T()
        ok('retoma na etapa 6 e avisa', 'Você parou na etapa' in t and 'Etapa 6 de 7' in t)
        ok('provedor restaurado', await pg.evaluate("document.getElementById('ai-prov').value") == 'gemini')
        ok('chave em rascunho restaurada', await pg.evaluate("document.getElementById('ai-key').value") == SECRET)
        # modelos recomendados e rótulos
        t = await T()
        ok('modelos gratuitos com limites e recomendado', 'Gemini 3.8 Flash' in t and 'Recomendado' in t and 'Gratuito com limites' in t)
        await pg.click('.ia-m[data-m="gemini-3.8-flash"]'); await pg.wait_for_timeout(300)
        ok('modelo escolhido vai ao campo', await pg.evaluate("document.getElementById('ai-model').value") == 'gemini-3.8-flash')
        await pg.evaluate("document.querySelectorAll('h2.acc-h[aria-expanded=false]').forEach(h=>accToggle(h,true))")
        await pg.click('[data-act=ai-save]'); await pg.wait_for_timeout(400)
        ok('exige ciência', 'Marque a caixa' in await T())
        await pg.click('#ai-consent'); await pg.click('[data-act=ai-save] >> nth=0'); await pg.wait_for_timeout(600)
        ok('salvo', 'Configuração salva' in await T() and await pg.evaluate("TB_SECURE.has('ai-key')"))
        ok('rascunho apagado ao salvar', not await pg.evaluate("TB_SECURE.has('ai-key-draft')"))
        # teste real (mock de rede) e falha com eco da chave
        await pg.evaluate("document.querySelectorAll('h2.acc-h[aria-expanded=false]').forEach(h=>accToggle(h,true))")
        await pg.click('[data-act=ai-test] >> nth=0'); await pg.wait_for_timeout(700)
        t = await T(); ok('teste ok', 'Conexão funcionando' in t and await pg.evaluate("document.querySelector('.ia-conn').classList.contains('ok')"))
        ok('progresso 100%', await pg.evaluate("document.querySelector('.ia-bar').getAttribute('aria-valuenow')") == '100')
        await pg.evaluate("const o=Capacitor.Plugins.CapacitorHttp.request; Capacitor.Plugins.CapacitorHttp.request=async x=>({status:401,data:{error:{message:'chave inválida: %s'}}})" % SECRET)
        await pg.click('[data-act=ai-test] >> nth=0'); await pg.wait_for_timeout(700); t = await T()
        ok('erro 401 explicado', 'recusou a chave' in t and 'O que fazer' in t)
        ok('chave NÃO aparece na mensagem', 'SEGREDO' not in t and '•••' in t)
        ok('chave fora do backup', await pg.evaluate("(async()=>{const t=backupText();return !(t||'').includes('SEGREDO')})()"))
        # navegador
        await pg.evaluate("window.__open=[]"); await pg.fill('#ai-url', 'openrouter.ai/keys'); await pg.click('[data-act=ai-browse]'); await pg.wait_for_timeout(300)
        ok('navegador abre https', await pg.evaluate("__open.slice(-1)[0]") == 'https://openrouter.ai/keys')
        await pg.fill('#ai-url', 'http://inseguro.com'); await pg.click('[data-act=ai-browse]'); await pg.wait_for_timeout(300)
        ok('navegador recusa http', await pg.evaluate("__open.length") == 1)
        # OpenRouter: lista viva com rótulos pelo preço
        await pg.evaluate("""(()=>{Capacitor.Plugins.CapacitorHttp.request=async o=>o.url.endsWith('openrouter.ai/api/v1/models')?{status:200,data:{data:[{id:'a/x:free',pricing:{prompt:'0',completion:'0'}},{id:'b/pago',pricing:{prompt:'0.001',completion:'0.002'}}]}}:{status:404,data:{}}})()""")
        await pg.evaluate("document.getElementById('ai-prov').value='openrouter'; document.getElementById('ai-prov').dispatchEvent(new Event('change',{bubbles:true}))"); await pg.wait_for_timeout(400)
        await pg.fill('#ai-key', 'sk-or-teste'); await pg.evaluate("document.querySelectorAll('h2.acc-h[aria-expanded=false]').forEach(h=>accToggle(h,true))")
        await pg.evaluate("document.querySelectorAll('details.more').forEach(d=>d.open=true)")
        await pg.click('[data-act=ai-models] >> nth=0'); await pg.wait_for_timeout(600)
        await pg.evaluate("document.querySelectorAll('details.more').forEach(d=>d.open=true)")
        t = await T(); ok('OpenRouter: gratuito e pago pelo preço', 'a/x:free' in t and 'b/pago' in t and await pg.evaluate("[...document.querySelectorAll('.ia-m.sm')].map(e=>e.textContent)") == ['a/x:freeGratuito com limites', 'b/pagoPago'])
        ok('sem rolagem horizontal', await pg.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth+1"))
        await pg.screenshot(path='/tmp/ia1.png', full_page=False)
        errs[:] = [e for e in errs if 'Failed to load resource' not in e]; ok('sem erros de script', not errs)
        print('erros', errs); print('FALHAS', bad); await b.close()
asyncio.run(main())
