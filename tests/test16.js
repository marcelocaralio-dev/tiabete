// test16: toque fora de um card aberto fecha o card e NÃO aciona nada atrás. Chromium (Playwright) com toque, emulando um Pixel 7.
// Uso: node tests/test16.js            (www/ compilado; roda npm run build:web antes se faltar)
//      HTML=/caminho/index.html node tests/test16.js   (para comparar com outra versão)
process.removeAllListeners('warning');
const path = require('path'), fs = require('fs');
let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('test16 ignorado: playwright não está instalado'); process.exit(0); }
const HTML = process.env.HTML || path.join(__dirname, '../www/index.html'); if (!fs.existsSync(HTML) && !process.env.HTML) { try { require('child_process').execFileSync('node', [path.join(__dirname, '../scripts/build-web.js')], { stdio: 'ignore' }); } catch (e) { } } if (!fs.existsSync(HTML)) { console.log('test16 ignorado: compile o app web antes (www/index.html)'); process.exit(0); }
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } }; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext(Object.assign({}, devices['Pixel 7'])), pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + HTML); await pg.waitForSelector('#view'); await sleep(1200); await pg.evaluate(() => { for (const i of ['tb-gate', 'tb-splash']) { const e = document.getElementById(i); if (e) e.remove(); } }); /* tela de entrada Google não faz parte deste teste */
  /* sonda: botão de página sob o dedo, no alto da tela, onde cada card deixa uma área de fundo */
  await pg.evaluate(() => { window.__hits = 0; const p = document.createElement('button'); p.id = 'probe'; p.textContent = 'sonda'; p.style.cssText = 'position:fixed;left:8px;top:8px;width:120px;height:44px;z-index:39'; p.addEventListener('click', () => window.__hits++); document.body.appendChild(p); });
  const PC = await pg.evaluate(() => { const r = document.getElementById('probe').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  const tap = async (x, y) => { await pg.touchscreen.tap(x, y); await sleep(700); };
  const hits = () => pg.evaluate(() => window.__hits), has = s => pg.evaluate(q => !!document.querySelector(q), s);
  ok(await pg.evaluate(() => { const r = document.getElementById('probe').getBoundingClientRect(); return document.elementFromPoint(r.x + 5, r.y + 5) === document.getElementById('probe'); }), 'T0: a sonda recebe toque quando nada está aberto');
  await tap(...PC); ok(await hits() === 1, 'T0b: toque normal na sonda funciona (1 clique)');
  const open = async fn => { await pg.evaluate(fn); await sleep(400); };
  /* 1. folha (openSheet) */
  await open(() => openSheet('<h2>Teste</h2><p>conteúdo</p><button class="btn" id="in-btn">dentro</button>'));
  ok(await has('#sheet-bg'), 'A0: folha aberta');
  await tap(...PC); ok(!(await has('#sheet-bg')), 'A1: toque fora fechou a folha'); ok(await hits() === 1, 'A2: o toque fora NÃO acionou o botão atrás (cliques=' + await hits() + ')');
  await tap(...PC); ok(await hits() === 2, 'A3: depois de fechar, a página volta ao normal (1 toque = 1 clique)');
  /* toque dentro da folha segue funcionando */
  await open(() => { window.__in = 0; openSheet('<button class="btn" id="in-btn">dentro</button>'); document.getElementById('in-btn').addEventListener('click', () => window.__in++); });
  await pg.tap('#in-btn'); await sleep(500); ok(await pg.evaluate(() => window.__in) === 1 && await has('#sheet-bg'), 'A4: botão dentro da folha funciona e não fecha');
  await tap(...PC); ok(!(await has('#sheet-bg')) && await hits() === 2, 'A5: fecha por fora sem acionar a sonda');
  /* 2. protocolo por cima (gl-over) e painel detalhe (pm-bg) */
  await open(() => { const bg = document.createElement('div'); bg.className = 'sheet-bg'; bg.id = 'gl-over'; bg.style.zIndex = '45'; bg.innerHTML = '<div class="sheet"><div class="grab"></div><p>x</p></div>'; bg.addEventListener('pointerdown', e => { if (e.target === bg) glOverClose(); }); document.body.appendChild(bg); });
  await tap(...PC); ok(!(await has('#gl-over')) && await hits() === 2, 'B1: folha por cima fecha sem acionar a sonda');
  /* 3. menu lateral */
  await open(() => drOpen()); ok(await pg.evaluate(() => DR.open), 'C0: menu lateral aberto');
  await tap(395, 400); ok(!(await pg.evaluate(() => DR.open)), 'C1: toque no fundo fechou o menu'); 
  await open(() => drOpen()); await tap(...PC); ok(!(await pg.evaluate(() => DR.open)) && await hits() === 2, 'C2: nada atrás foi acionado');
  await open(() => drOpen()); await pg.tap('#dr .dr-x'); await sleep(500); ok(!(await pg.evaluate(() => DR.open)), 'C3: botão fechar do menu continua funcionando');
  /* 4. cartão de conquista */
  await open(() => { const bg = document.createElement('div'); bg.className = 'rw-bg'; bg.id = 'rw-bg'; bg.innerHTML = '<div class="rw-card"><button class="btn pri" id="rw-ok">Continuar</button></div>'; bg.querySelector('#rw-ok').onclick = () => closeRw(); document.body.appendChild(bg); });
  await tap(...PC); ok(!(await has('#rw-bg')) && await hits() === 2, 'D1: toque fora do cartão de conquista fecha e não aciona a sonda');
  /* 5. teste de contraste: um toque fora com o dedo ficando 1,2 s (pressão longa) também não vaza */
  await open(() => openSheet('<p>x</p>')); await pg.touchscreen.tap(...PC); await sleep(1300); ok(!(await has('#sheet-bg')) && await hits() === 2, 'E1: sem vazamento mesmo com espera');
  /* depois de tudo, nada fica armado */
  ok(await pg.evaluate(() => typeof TB_OVG === 'undefined' || !TB_OVG.armed()), 'F1: a proteção se desarma sozinha');
  ok(errs.length === 0, 'F2: sem erros de script: ' + errs.slice(0, 2).join(' | '));
  await b.close(); console.log(fail ? `${fail} falha(s) em ${n}` : `test16 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRO', e); process.exit(2); });
