# Testa a tela de entrada (login Google simulado). Servir www/ na porta 8766.
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
  if(u==='https://oauth2.googleapis.com/token'){ if(b.grant_type==='refresh_token'){__tok++;return J(200,{access_token:'at'+__tok,expires_in:3600})} return J(200,{access_token:'at0',refresh_token:'rt0',expires_in:3600,id_token:'x.'+btoa(JSON.stringify({email:'maria@gmail.com',name:'Maria'}))+'.y'});}
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
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(MOCK)
        await pg.goto('http://localhost:8766/index.html'); await pg.wait_for_timeout(1200)
        T = lambda: pg.evaluate("document.body.innerText")
        print('gate aparece:', await pg.is_visible('#gate-in'))
        await pg.fill('#gate-cid','abc.apps.googleusercontent.com'); await pg.click('#gate-in'); await pg.wait_for_timeout(500)
        url = await pg.evaluate("__open[0]"); print('escopos:', all(x in url for x in ['openid','email','drive.file']))
        st = await pg.evaluate("new URL(__open[0]).searchParams.get('state')")
        await pg.evaluate("(s)=>__lst.appUrlOpen({url:'app.tiabete.glicose:/oauth2redirect?code=C&state='+s})", st); await pg.wait_for_timeout(800)
        print('gate some após login:', not await pg.query_selector('#tb-gate'))
        await pg.wait_for_timeout(600); print('abre cadastro opcional:', 'Cadastro opcional' in await T(), 'nome do Google:', await pg.input_value('#pf-name'))
        await pg.fill('#pf-birth','1990-05-17'); await pg.select_option('#pf-type','MODY'); await pg.fill('#pf-team','Dra. Ana'); await pg.click('#pf-form button[type=submit]'); await pg.wait_for_timeout(400)
        print('perfil salvo:', await pg.evaluate("JSON.stringify(S.profile)"), 'linha PDF:', await pg.evaluate("pfLine()"))
        print('backup leva perfil:', await pg.evaluate("(async()=>{const d=isoDate(new Date());await Store.put('records',{id:'t1',date:d,time:'07:00',ts:mkTs(d,'07:00'),glucose:110,context:'jejum',source:'manual'});await loadAll();return (backupText()||'').includes('Dra. Ana')})()"))
        await pg.reload(); await pg.wait_for_timeout(1500); print('lembra login após reabrir:', not await pg.query_selector('#tb-gate'), 'perfil recarregado:', await pg.evaluate('!!S.profile'))
        for i in range(6):
            if await pg.query_selector('#rw-ok'): await pg.click('#rw-ok'); await pg.wait_for_timeout(200)
        await pg.evaluate("go('backup')"); await pg.wait_for_timeout(400); await pg.click('text=Expandir tudo'); await pg.wait_for_timeout(200)
        print('mostra e-mail:', 'maria@gmail.com' in await T())
        await pg.click('[data-act=g-out]'); await pg.wait_for_timeout(800); print('sair mostra gate:', await pg.is_visible('#gate-in'))
        await pg.click('#gate-skip'); await pg.wait_for_timeout(300); print('pular some:', not await pg.query_selector('#tb-gate'))
        await pg.reload(); await pg.wait_for_timeout(1200); print('pular lembrado:', not await pg.query_selector('#tb-gate'))
        print('erros', errs); await b.close()
asyncio.run(main())
