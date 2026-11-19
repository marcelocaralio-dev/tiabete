// test19: sistema de ícones. Cada categoria principal tem um ícone só dela; nada cai no ícone padrão por falta de cadastro.
process.removeAllListeners('warning');
const path = require('path'), fs = require('fs');
let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('test19 ignorado: playwright não está instalado'); process.exit(0); }
const HTML = process.env.HTML || path.join(__dirname, '../www/index.html'); if (!fs.existsSync(HTML)) { console.log('test19 ignorado: compile o app web antes (www/index.html)'); process.exit(0); }
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } }; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(), pg = await (await b.newContext(devices['Pixel 7'])).newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + HTML); await pg.waitForSelector('#view'); await sleep(900);
  await pg.evaluate(() => { for (const i of ['tb-gate', 'tb-splash']) { const e = document.getElementById(i); if (e) e.remove(); } });
  const T = await pg.evaluate(() => TB_ICONSET.tabela), dup = await pg.evaluate(() => TB_ICONSET.duplicados());
  ok(T.length >= 50, 'I1: tabela de categorias completa (' + T.length + ')');
  ok(dup.length === 0, 'I2: nenhuma forma repetida entre categorias diferentes: ' + JSON.stringify(dup));
  ok(T.every(x => /<(path|circle|rect)/.test(x.forma)), 'I3: todos os ícones têm desenho');
  /* cada item da aba Mais e do menu lateral tem ícone próprio cadastrado (antes, "Lembretes de insulina" caía no ícone de "Sobre") */
  const miss = await pg.evaluate(() => { const o = []; for (const g of Object.values(menuGroups())) for (const x of g.items) if (!MI[x[0]]) o.push(x[0]); for (const k of Object.keys(menuGroups())) if (!MI[k]) o.push(k); for (const x of DR_MAIN) if (!DR_IC[x[2]]) o.push('dr:' + x[2]); return o; });
  ok(miss.length === 0, 'I4: itens sem ícone cadastrado: ' + miss.join(','));
  /* categorias principais da aba Mais: formas todas diferentes, exceto itens da mesma categoria (grupo e item compartilham) */
  const rep = await pg.evaluate(() => { const norm = s => s.replace(/\s+/g, ''), by = {}; for (const g of Object.values(menuGroups())) for (const x of g.items) (by[norm(MI[x[0]])] = by[norm(MI[x[0]])] || []).push(x[0]); return Object.values(by).filter(v => v.length > 1 && !(v.length === 2 && v.every(r => ['lembretes', 'alertashist'].includes(r)) && false)); });
  ok(rep.length === 0, 'I5: itens do Mais com ícone igual: ' + JSON.stringify(rep));
  /* HbA1c deixou de usar a gota da glicemia; Mais deixou de ser "+" ; tema usa sol/lua e as refeições não */
  ok(await pg.evaluate(() => MI.hba1c !== ACI.drop && DR_IC.more !== IC.plus && !Object.values(MIC).some(v => v === DR_IC.sun || v === DR_IC.moon)), 'I6: HbA1c ≠ glicemia, Mais ≠ Nova medição, sol/lua só no tema');
  ok(await pg.evaluate(() => MI.insulinas !== DR_IC.chart && MI.bolus === DR_IC.calc && MI.esquemas === DR_IC.pill && AC_CIC.hipo === 'hypo'), 'I7: bolus/tratamento/hipoglicemia coerentes entre Mais, menu lateral e alertas');
  /* padrão visual: nenhum ícone do conjunto traz preenchimento nem traço próprio */
  const bad = await pg.evaluate(() => { const o = []; for (const [dn, d] of Object.entries({ MI, MIC, DR_IC, ACI, IC, PNI })) for (const [k, v] of Object.entries(d)) if (/fill="(?!none)|stroke-width|stroke="/.test(v)) o.push(dn + '.' + k); return o; });
  ok(bad.length === 0, 'I8: ícones sem fill/traço próprio (herdam o padrão 1,8): ' + bad.join(','));
  /* nas telas: a página da IA não repete ícone de seção, e as telas abrem sem erro */
  await pg.evaluate(() => go('ia')); await sleep(400);
  const ia = await pg.evaluate(() => [...document.querySelectorAll('h2.sec svg')].map(s => s.innerHTML.replace(/\s+/g, '')));
  ok(ia.length >= 6 && new Set(ia).size === ia.length, 'I9: seções da tela de IA com ícones todos diferentes (' + new Set(ia).size + '/' + ia.length + ')');
  for (const r of await pg.evaluate(() => Object.keys(VIEWS))) { try { await pg.evaluate(r => go(r), r); await sleep(120); } catch (e) { errs.push('rota ' + r + ': ' + e.message); } }
  ok(errs.length === 0, 'I10: sem erros ao abrir todas as telas: ' + errs.slice(0, 2).join(' | '));
  await b.close(); console.log(fail ? `${fail} falha(s) em ${n}` : `test19 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRO', e); process.exit(2); });
