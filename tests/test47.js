// test47: botão "Sair da conta Google" (Prompt 55): localização, confirmação, logout efetivo, dados preservados, reentrada e erros. Google simulado.
process.removeAllListeners('warning');
const path = require('path'), fs = require('fs');
let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('test47 ignorado: playwright não está instalado'); process.exit(0); }
const HTML = process.env.HTML || path.join(__dirname, '../www/index.html'); if (!fs.existsSync(HTML)) { try { require('child_process').execFileSync('node', [path.join(__dirname, '../scripts/build-web.js')], { stdio: 'ignore' }); } catch (e) { } }
const SHOTS = process.env.SHOTS || '';
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHOU ') + m); if (!c) fail++; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const MOCK = `window.__req=[];window.__open=[];window.__lst={};window.__revokeFail=false;
const J=(s,d)=>({status:s,data:d});
window.Capacitor={isNativePlatform:()=>true,Plugins:{Browser:{open:async o=>{__open.push(o.url)},close:async()=>{}},App:{addListener:(n,f)=>{__lst[n]=f;return {remove(){}}}},
 CapacitorHttp:{request:async o=>{const b=o.data;__req.push({url:o.url,b});const u=o.url;
  if(u==='https://oauth2.googleapis.com/token'){ if(b.grant_type==='refresh_token')return J(200,{access_token:'at',expires_in:3600}); return J(200,{access_token:'at0',refresh_token:'rt0',expires_in:3600,id_token:'x.'+btoa(JSON.stringify({email:'maria@gmail.com',name:'Maria',sub:'s1'}))+'.y'});}
  if(u.startsWith('https://oauth2.googleapis.com/revoke')){ if(window.__revokeFail) throw new Error('offline'); return J(200,{});}
  if(u.includes('/drive/v3/files')) return J(200,{files:[]});
  return J(404,{});}}}};`;
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext(Object.assign({}, devices['Pixel 7'])), pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(MOCK); await pg.goto('file://' + HTML); await pg.waitForSelector('#view'); await sleep(2500);
  const gateOn = () => pg.evaluate(() => !!document.getElementById('gate-in'));
  const signIn = async () => { await pg.click('#gate-in'); await sleep(300); const st = await pg.evaluate(() => new URL(__open[__open.length - 1]).searchParams.get('state')); await pg.evaluate(s => __lst.appUrlOpen({ url: 'app.tiabete.glicose:/oauth2redirect?code=C&state=' + s }), st); await sleep(1200); };
  const snap = () => pg.evaluate(async () => { const o = {}; for (const s of ['records', 'hba1c', 'schemes', 'exams', 'events', 'inslog']) o[s] = JSON.stringify(await Store.all(s)); o.meta = JSON.stringify((await Store.all('meta')).filter(x => !['drive-pref', 'guest-link'].includes(x.id)).map(x => x.id).sort()); return o; });
  const state = () => pg.evaluate(async () => ({ conn: TB_DRV.state.conn, prof: !!TB_DRV.state.profile, rt: await TB_SECURE.has('g-refresh'), cfg: !!(await TB_SECURE.getCfg('g-profile')), n: S.records.length }));
  ok(await gateOn(), 'abre na tela de entrada (sem conta)');
  await signIn(); let st = await state(); ok(!(await gateOn()) && st.conn && st.rt && st.prof, 'entrou com Google (simulado)');
  await pg.evaluate(async () => { for (const r of S.records.filter(isEx)) { } if (hasExamples()) await removeExamples(); const d = isoDate(new Date()); await Store.putMany('records', [1, 2, 3].map(i => ({ id: 'k' + i, date: d, time: '0' + i + ':00', ts: mkTs(d, '0' + i + ':00'), glucose: 100 + i, context: 'jejum', source: 'manual' }))); await loadAll(); S.drv.auto = true; });
  const before = await snap();
  /* localização e aparência */
  await pg.evaluate(() => go('perfil')); await sleep(600);
  const btn = await pg.evaluate(() => { const e = document.querySelector('#view .gx-out-btn'); if (!e) return null; const s = getComputedStyle(e), r = e.getBoundingClientRect(); const sec = [...document.querySelectorAll('#view h2.sec')].map(x => x.textContent); return { t: e.textContent.trim(), svg: !!e.querySelector('svg'), mh: s.minHeight, color: s.color, bd: s.borderColor, w: Math.round(r.width), sec, tag: e.tagName }; });
  ok(btn && btn.t === 'Sair da conta Google' && btn.svg, 'Meu perfil → seção Conta Google: botão com texto "Sair da conta Google" e ícone de saída');
  ok(btn && parseInt(btn.mh) >= 56 && btn.w > 250, 'área de toque confortável (altura mínima ' + (btn && btn.mh) + ', largura ' + (btn && btn.w) + ')');
  ok(btn && /^rgb\((2[0-9]{2}|1[89][0-9]),/.test(btn.color), 'texto em vermelho (' + (btn && btn.color) + ')');
  ok(btn && btn.sec.includes('Conta Google') && btn.sec.indexOf('Conta Google') > btn.sec.indexOf('Dados da conta'), 'a seção vem logo depois das informações da conta conectada');
  ok(await pg.evaluate(() => document.getElementById('view').innerText.includes('maria@gmail.com')), 'mostra a conta conectada (e-mail)');
  if (SHOTS) { await pg.evaluate(() => document.querySelector('#view .gx-acct').scrollIntoView({ block: 'center' })); await sleep(300); await pg.screenshot({ path: path.join(SHOTS, 'conta-escuro.png') }); }
  /* confirmação: cancelar */
  await pg.click('#view .gx-out-btn'); await sleep(400);
  const sh = await pg.evaluate(() => { const s = document.querySelector('#sheet-bg'); return s ? s.innerText : null; });
  ok(sh && /Sair da conta Google\?/.test(sh) && /vinculada ao GLUXO/.test(sh) && /maria@gmail\.com/.test(sh) && /Nenhum dado será apagado/.test(sh) && /Cancelar/.test(sh) && /Sair da conta/.test(sh), 'abre confirmação clara, com Cancelar e Sair da conta');
  ok(await pg.evaluate(() => !__req.some(r => /revoke/.test(r.url))), 'abrir a confirmação ainda não desconecta nada');
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'conta-confirma-escuro.png') });
  await pg.click('#sheet-bg [data-act="close"]'); await sleep(300); st = await state();
  ok(st.conn && st.rt && st.prof && !(await gateOn()), 'Cancelar mantém a conta conectada');
  /* erro: não conseguiu apagar o token local => continua conectado, avisa */
  await pg.click('#view .gx-out-btn'); await sleep(300);
  await pg.evaluate(() => { window.__del = TB_SECURE.del; TB_SECURE.del = async () => { throw new Error('cofre'); }; });
  await pg.click('#sheet-bg [data-act="g-out"]'); await sleep(900); st = await state();
  ok(st.conn && st.rt, 'falha ao apagar o token: segue conectado (sem falso "desconectado")');
  ok(await pg.evaluate(() => /Não foi possível sair/.test(document.body.innerText)) , 'falha: mostra aviso de erro');
  ok(await pg.evaluate(() => !TB_DRV.state.busy) && (await snap()).records === before.records, 'falha: botão volta ao normal e nenhum dado mudou');
  await pg.evaluate(() => { TB_SECURE.del = window.__del; });
  await sleep(3400);
  /* sair de verdade (revogação falha/offline não impede o logout local) + toque duplo */
  await pg.evaluate(() => { window.__revokeFail = true; __req.length = 0; });
  await pg.click('#view .gx-out-btn'); await sleep(300);
  await pg.evaluate(() => { const c = document.querySelector('#sheet-bg [data-act="g-out"]'); c.click(); c.click(); }); await sleep(1500);
  st = await state();
  ok(!st.conn && !st.prof && !st.rt && !st.cfg, 'confirmou: sessão encerrada de verdade (token apagado do cofre, perfil limpo, estado em memória)');
  ok(await pg.evaluate(() => __req.filter(r => /revoke/.test(r.url)).length) === 1, 'toque duplo gera uma só desconexão (e o Google foi avisado para revogar)');
  ok(await gateOn(), 'interface mostra o estado desconectado: tela de entrada com "Entrar com Google" disponível');
  const after = await snap(); ok(JSON.stringify(after) === JSON.stringify(before), 'NENHUM dado perdido: registros, HbA1c, esquemas, exames, eventos, insulinas e configurações idênticos');
  ok(await pg.evaluate(() => S.drv.auto === false), 'cópia programada no Drive desligada (sem token) — dados locais intactos');
  /* continuar sem conta: telas refletem desconectado */
  await pg.click('#gate-skip'); await sleep(500); await pg.evaluate(() => go('perfil')); await sleep(500);
  ok(await pg.evaluate(() => !document.querySelector('#view .gx-out-btn') && /Você não está conectado/.test(document.getElementById('view').innerText) && !!document.querySelector('#view [data-act="g-in"]')), 'Perfil mostra desconectado e oferece "Entrar com Google"');
  await pg.evaluate(() => go('backup')); await sleep(500);
  ok(await pg.evaluate(() => !!document.querySelector('#view [data-act="g-in"]') && !document.querySelector('#view .gx-out-btn')), 'tela de cópia (Drive) também reflete desconectado');
  await pg.reload(); await sleep(2500); ok(await pg.evaluate(async () => !TB_DRV.state.conn && !(await TB_SECURE.has('g-refresh'))), 'depois de reabrir o app continua desconectado');
  /* entrar de novo */
  await pg.evaluate(async () => { await TB_SECURE.setCfg('login-skip', false); window.dispatchEvent(new CustomEvent('tb-auth', { detail: { type: 'changed' } })); }); await sleep(600);
  await signIn(); st = await state(); ok(st.conn && st.rt && st.prof && st.n === 3, 'é possível entrar de novo com Google, com os mesmos 3 registros');
  await pg.evaluate(() => go('perfil')); await sleep(500); ok(await pg.evaluate(() => !!document.querySelector('#view .gx-out-btn')), 'botão de sair volta a aparecer');
  await pg.evaluate(() => go('backup')); await sleep(500);
  ok(await pg.evaluate(() => { const e = document.querySelector('#view .gx-out-btn'); return !!e && /Sair da conta Google/.test(e.textContent); }), 'card do Drive usa o mesmo botão (agora com confirmação)');
  ok(JSON.stringify(await snap()) === JSON.stringify(before), 'após reentrar, dados continuam idênticos (sem perda nem duplicação)');
  /* tema claro */
  await pg.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); go('perfil'); }); await sleep(500);
  const lt = await pg.evaluate(() => { const e = document.querySelector('#view .gx-out-btn'); const s = getComputedStyle(e); return { c: s.color, bd: s.borderColor }; });
  ok(/^rgb\(19[0-9]|^rgb\(2/.test(lt.c), 'tema claro: botão continua vermelho e legível (' + lt.c + ')');
  if (SHOTS) { await pg.evaluate(() => document.querySelector('#view .gx-acct').scrollIntoView({ block: 'center' })); await sleep(300); await pg.screenshot({ path: path.join(SHOTS, 'conta-claro.png') }); await pg.click('#view .gx-out-btn'); await sleep(400); await pg.screenshot({ path: path.join(SHOTS, 'conta-confirma-claro.png') }); }
  ok(errs.length === 0, 'sem erros de JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fail ? '\n' + fail + ' falha(s)' : '\ntest47: tudo certo'); process.exit(fail ? 1 : 0);
})();
