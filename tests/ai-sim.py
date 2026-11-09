# Simula o APK com IA e Drive (Capacitor mockado). Uso: servir www/ na porta 8766 e rodar python3 tests/ai-sim.py
import asyncio, json
from playwright.async_api import async_playwright
MOCK = r"""
window.__req=[];window.__open=[];window.__lst={};window.__tok=0;window.__files=[];
const J=(s,d)=>({status:s,data:d});
window.Capacitor={isNativePlatform:()=>true,Plugins:{
 Browser:{open:async o=>{__open.push(o.url)},close:async()=>{}},
 App:{addListener:(n,f)=>{__lst[n]=f;return {remove(){}}}},
 CapacitorHttp:{request:async o=>{
  const b=typeof o.data==='string'&&o.headers['content-type']&&/json/.test(o.headers['content-type'])?JSON.parse(o.data):o.data; __req.push({url:o.url,method:o.method,h:o.headers,b});
  const u=o.url;
  if(u.startsWith('https://api.anthropic.com/v1/messages')){const last=b.messages[b.messages.length-1];const tr=Array.isArray(last.content)&&last.content.some(c=>c.type==='tool_result');
    if(b.tools&&!tr)return J(200,{content:[{type:'text',text:'vou consultar'},{type:'tool_use',id:'t1',name:b.tools[0].name,input:{q:1}}]});
    return J(200,{content:[{type:'text',text:'```json\n{"ok":true}\n```'}]});}
  if(u.endsWith('/v1/models?limit=100'))return J(200,{data:[{id:'claude-haiku-5-5'},{id:'claude-opus-5-5'}]});
  if(u.includes('/chat/completions')){const last=b.messages[b.messages.length-1];
    if(b.tools&&last.role!=='tool')return J(200,{choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'c1',type:'function',function:{name:b.tools[0].function.name,arguments:'{"q":1}'}}]}}]});
    return J(200,{choices:[{message:{role:'assistant',content:'resposta openai'}}]});}
  if(u.includes(':generateContent')){const last=b.contents[b.contents.length-1];const fr=last.parts.some(p=>p.functionResponse);
    if(b.tools&&!fr)return J(200,{candidates:[{content:{role:'model',parts:[{functionCall:{name:b.tools[0].functionDeclarations[0].name,args:{q:1}}}]}}]});
    return J(200,{candidates:[{content:{role:'model',parts:[{text:'resposta gemini'}]}}]});}
  if(u.includes('/v1beta/models?'))return J(200,{models:[{name:'models/gemini-2.0-flash',supportedGenerationMethods:['generateContent']},{name:'models/embed',supportedGenerationMethods:['embedContent']}]});
  if(u==='https://oauth2.googleapis.com/token'){ if(b.grant_type==='refresh_token'){__tok++;return J(200,{access_token:'at'+__tok,expires_in:3600})} return J(200,{access_token:'at0',refresh_token:'rt0',expires_in:3600});}
  if(u.startsWith('https://oauth2.googleapis.com/revoke'))return J(200,{});
  if(u.startsWith('https://www.googleapis.com/drive/v3/files?q=')){ const q=decodeURIComponent(u.split('q=')[1].split('&')[0]);
    if(window.__401&&o.headers.authorization==='Bearer at0'){return J(401,{})}
    if(q.includes('mimeType'))return J(200,{files:[]}); return J(200,{files:__files.map(f=>({id:f.id,name:f.name,modifiedTime:'2026-11-08T10:00:00Z'}))});}
  if(u.startsWith('https://www.googleapis.com/drive/v3/files?fields=id'))return J(200,{id:'folder1'});
  if(u.startsWith('https://www.googleapis.com/upload/drive/v3/files')){const m=/"name":"([^"]+)"/.exec(o.data);__files.push({id:'f'+__files.length,name:m[1],body:o.data});return J(200,{id:'f'+(__files.length-1)});}
  if(u.includes('?alt=media')){const f=__files[+u.split('/files/f')[1].split('?')[0]];const body=f.body.split('\r\n\r\n')[2].split('\r\n--')[0];return J(200,body);}
  return J(404,{error:{message:'nope '+u}});
 }}}};
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await (await b.new_context(viewport={'width':400,'height':860})).new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'favicon' not in m.text else None)
        await pg.add_init_script(MOCK)
        await pg.goto('http://localhost:8766/index.html'); await pg.wait_for_timeout(1000)
        await pg.evaluate("""(async()=>{const d=isoDate(new Date());await Store.put('records',{id:'t1',date:d,time:'07:00',ts:mkTs(d,'07:00'),glucose:110,context:'jejum',source:'manual'});await loadAll();render();})()"""); await pg.wait_for_timeout(300)
        if await pg.query_selector('#gate-skip'): await pg.click('#gate-skip'); await pg.wait_for_timeout(300)
        for i in range(6):
            if await pg.query_selector('#rw-ok'): await pg.click('#rw-ok'); await pg.wait_for_timeout(200)
        T = lambda: pg.evaluate("document.body.innerText")
        await pg.evaluate("go('mais')"); await pg.wait_for_timeout(300); t = await T()
        print('menu IA:', all(x in t for x in ['Perguntar à IA','Exames laboratoriais','Inteligência artificial']), 'Claude' not in t)
        # sem configuração
        e = await pg.evaluate("(async()=>{try{const s=await window.claude.use('sample');await s('oi')}catch(e){return e.code+'|'+e.aiMsg}})()"); print('sem config:', e)
        await pg.evaluate("go('ia')"); await pg.wait_for_timeout(500)
        print('guia:', 'Passo a passo da chave' in await T() and 'Create Key' in await T()); await pg.select_option('#ai-prov','openrouter'); await pg.wait_for_timeout(200); print('guia openrouter:', ':free' in await T()); await pg.select_option('#ai-prov','anthropic'); await pg.wait_for_timeout(200)
        await pg.fill('#ai-key','sk-ant-SEGREDO123'); await pg.click('[data-act=ai-save]'); await pg.wait_for_timeout(300); print('sem consentimento:', 'Marque a caixa' in await T())
        await pg.click('#ai-consent'); await pg.fill('#ai-key','sk-ant-SEGREDO123'); await pg.click('[data-act=ai-save]'); await pg.wait_for_timeout(500); print('salvo:', 'Configuração salva' in await T())
        await pg.fill('#ai-key','sk-ant-SEGREDO123') ; await pg.click('[data-act=ai-test]'); await pg.wait_for_timeout(500); print('teste:', 'Conexão funcionando' in await T())
        raw = await pg.evaluate("""(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('tb-secure');q.onsuccess=()=>r(q.result)});const v=await new Promise(r=>{const q=db.transaction('k').objectStore('k').get('s:ai-key');q.onsuccess=()=>r(q.result)});return JSON.stringify([Object.keys(v),v.ct.byteLength])})()"""); print('cofre cifrado:', raw)
        print('chave fora do backup:', await pg.evaluate("(async()=>{const t=backupText();const all=JSON.stringify(await Promise.all(['records','meta'].map(s=>Store.all?Store.all(s):[])));return !(t||'').includes('SEGREDO')&&!all.includes('SEGREDO')})()"))
        await pg.click('[data-act=ai-models]'); await pg.wait_for_timeout(500); print('modelos:', '2 modelos' in await T(), await pg.evaluate("document.querySelectorAll('#ai-models option').length"))
        # chamadas com ferramentas, três famílias
        for prov,model in [('anthropic','claude-haiku-5-5'),('openai','gpt-x'),('gemini','gemini-2.0-flash')]:
            await pg.evaluate("(async([p,m])=>{await TB_SECURE.setCfg('ai',{provider:p,base:'',model:m,consent:true})})", [prov,model])
            r = await pg.evaluate("""(async()=>{const s=await window.claude.use('sample');let calls=0,txt='';const out=await s('pergunta',{tools:[{name:'ler',description:'x',inputSchema:{type:'object',properties:{q:{type:'number'}}},execute:async i=>{calls++;return {v:i.q}}}],onText:x=>txt=x.text});return JSON.stringify([out.text.slice(0,30),calls,txt.slice(0,30)])})()""")
            print(prov, r)
        j = await pg.evaluate("(async()=>{await TB_SECURE.setCfg('ai',{provider:'anthropic',base:'',model:'claude-haiku-5-5',consent:true});const s=await window.claude.use('sample');return JSON.stringify(await s.json('dê json'))})()"); print('json:', j)
        reqs = await pg.evaluate("JSON.stringify(__req.filter(r=>r.url.includes('anthropic')).slice(-1)[0].h)"); print('headers anthropic:', reqs)
        print('insegura:', await pg.evaluate("(async()=>{try{await TB_HTTP('http://x.com/a')}catch(e){return e.code}})()"))
        # Drive
        await pg.evaluate("go('backup')"); await pg.wait_for_timeout(400); await pg.click('text=Expandir tudo'); await pg.wait_for_timeout(200); t = await T(); print('card Drive desconectado:', 'Conectar conta Google' in t)
        await pg.fill('#g-cid','abc.apps.googleusercontent.com'); await pg.click('[data-act=g-in]'); await pg.wait_for_timeout(500)
        url = await pg.evaluate("__open[0]"); print('url login:', url[:60], all(x in url for x in ['code_challenge_method=S256','access_type=offline','drive.file','redirect_uri=app.tiabete.glicose']))
        st = await pg.evaluate("new URL(__open[0]).searchParams.get('state')")
        await pg.evaluate("(s)=>__lst.appUrlOpen({url:'app.tiabete.glicose:/oauth2redirect?code=CODE&state='+s})", st); await pg.wait_for_timeout(600)
        t = await T(); print('conectado:', 'Desconectar conta Google' in t and 'Fazer backup no Drive agora' in t)
        await pg.click('[data-act=drv-now]'); await pg.wait_for_timeout(800); t=await T(); print('backup:', await pg.evaluate("__files.map(f=>f.name)"), 'Ainda não há dados' in t)
        await pg.evaluate("(async()=>{await Store.put('hba',{id:'x1',date:isoDate(new Date()),value:6.1,source:'manual'}).catch(()=>{})})()")
        print('hasRealData', await pg.evaluate("hasRealData()"))
        await pg.click('[data-act=drv-list]'); await pg.wait_for_timeout(800); print('lista:', await pg.evaluate("S.drv.list&&S.drv.list.length"), (await T())[-200:].replace('\n',' '))
        # 401 -> refresh
        await pg.evaluate("window.__401=true;G=TB_DRV_STATE;G.access=null;"); 
        await pg.evaluate("TB_DRV_STATE.access='at0';TB_DRV_STATE.exp=Date.now()+3600000"); r=await pg.evaluate("(async()=>JSON.stringify(await TB_DRV.call('search_files',{query:\"parentId = 'folder1' and trashed = false\"})))()"); print('401→refresh:', r[:80], await pg.evaluate("__tok"))
        qs = await pg.evaluate("__req.filter(r=>r.url.includes('drive/v3/files?q=')).map(r=>decodeURIComponent(r.url.split('q=')[1].split('&')[0]))"); print('consultas Drive:', qs[:2])
        await pg.click('[data-act=drv-load]'); await pg.wait_for_timeout(800); print('restaurar abre o backup:', await pg.evaluate("document.body.innerText.includes('Restaurar')||document.body.innerText.includes('restaur')"))
        await pg.evaluate("go('backup')"); await pg.wait_for_timeout(300); await pg.click('[data-act=g-out]'); await pg.wait_for_timeout(500); print('desconectado:', 'Conectar conta Google' in await T())
        print('erros', errs); await b.close()
asyncio.run(main())
