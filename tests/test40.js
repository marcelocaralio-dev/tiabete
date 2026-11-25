// test40: bolha e painel de notificações (PROMPT 52). Chromium real (Pixel 7), temas escuro e claro, reinício completo do navegador.
process.removeAllListeners('warning');
const path = require('path'), fs = require('fs'), os = require('os');
let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('test40 ignorado: playwright não está instalado'); process.exit(0); }
const SRC = process.env.HTML || path.join(__dirname, '../www/index.html'); if (!fs.existsSync(SRC)) { console.log('test40 ignorado: compile o app web antes'); process.exit(0); }
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'acb40-'));
/* cópia do app em que acSources() também devolve os alertas gravados em localStorage['__live'] (a fonte continua presente depois de reiniciar, como as reais) */
const HTML = path.join(DIR + '-app.html'); { let h = fs.readFileSync(SRC, 'utf8'); const k = 'function acSources() {'; if (!h.includes(k)) throw new Error('acSources não encontrada'); h = h.replace(k, k + " let __L = []; try { __L = JSON.parse(localStorage.getItem('__live') || '[]'); } catch (e) { } if (__L.length) return __L.map(x => ({ src: x.src, cat: x.cat || 'lembrete', prio: x.prio || 1, title: x.title, text: x.text, occ: '', html: '<div class=\"banner\"><span><b>' + x.title + '.</b> ' + x.text + '</span><button class=\"btn sm\" data-act=\"go\" data-r=\"painel\">ir</button></div>', key: x.src + '|' + x.title }));"); fs.writeFileSync(HTML, h); }
async function open() { const ctx = await chromium.launchPersistentContext(DIR, Object.assign({}, devices['Pixel 7'])), pg = ctx.pages()[0] || await ctx.newPage(); pg._errs = []; pg.on('pageerror', e => pg._errs.push(e.message)); await pg.route('**/fonts.*/**', r => r.abort()); await pg.goto('file://' + HTML); await pg.waitForSelector('#view'); await sleep(1500); await pg.evaluate(() => { for (const i of ['tb-gate', 'tb-splash']) { const e = document.getElementById(i); if (e) e.remove(); } }); return [ctx, pg]; }
/* alertas "vivos" injetados no lugar das fontes reais (mesmo caminho de acSync/acUpsert) */
const addLive = (pg, arr) => pg.evaluate(arr => { const c = JSON.parse(localStorage.getItem('__live') || '[]'); localStorage.setItem('__live', JSON.stringify(c.concat(arr))); acSync(); }, arr);
const clrLive = pg => pg.evaluate(() => localStorage.setItem('__live', '[]'));
const A = { src: 'insrem', title: 'Insulina A', text: 'Aplicar a basal das 22:00.' }, B = { src: 'plano', title: 'Tratamento B', text: 'Medir a glicemia em jejum.' }, C = { src: 'ca', title: 'Personalizado C', text: 'Dia de perna: confira a medição.' }, D = { src: 'hiper', cat: 'glic', prio: 3, title: 'Hiper D', text: 'Glicemia acima do limite.' };
const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const st = pg => pg.evaluate(() => { const b = document.getElementById('acb'), p = document.getElementById('acp'); return { has: b.classList.contains('has'), halo: +getComputedStyle(b, '::after').opacity, open: AC.open, pHidden: p.hidden, un: acUnread(), list: acList().map(x => x.title), items: S.ac.items.map(x => ({ t: x.title, r: !!x.read, d: !!x.dismissed })), route: S.route }; });
(async () => {
  let [ctx, pg] = await open();
  await pg.evaluate(() => { acSetMode('bubble'); S.ac.hidden = false; acRefresh(); }); await sleep(300);
  /* ---- 1/2/5/6 visual da bolha ---- */
  for (const th of ['dark', 'light']) {
    await pg.evaluate(t => { document.documentElement.dataset.theme = t; }, th); await sleep(150);
    const v = await pg.evaluate(() => { const b = document.getElementById('acb'), i = b.querySelector('img.acb-d'), r = b.getBoundingClientRect(), ir = i.getBoundingClientRect(); return { k: b._k || 1, bg: getComputedStyle(b).backgroundColor, src: i && i.src === GX_DROP, w: r.width, h: r.height, cx: Math.abs((ir.left + ir.width / 2) - (r.left + r.width / 2)), cy: Math.abs((ir.top + ir.height / 2) - (r.top + r.height / 2)), ratio: i.naturalWidth / i.naturalHeight, rr: ir.width / ir.height, n: !!b.querySelector('.acb-n'), txt: b.textContent.trim(), svg: b.querySelectorAll('svg').length }; });
    ok(v.bg === 'rgb(255, 255, 255)', `B1 (${th}): fundo da bolha branco: ${v.bg}`);
    ok(v.src, `B2 (${th}): a gota é o arquivo oficial da marca (GX_DROP)`);
    ok(Math.abs(v.w / v.k - 56) < 1, `B3 (${th}): tamanho da bolha inalterado (${v.w})`);
    ok(v.cx < 1 && v.cy < 1, `B4 (${th}): gota centralizada (${v.cx.toFixed(2)}, ${v.cy.toFixed(2)})`);
    ok(Math.abs(v.ratio - v.rr) < .02, `B5 (${th}): proporções originais mantidas`);
    ok(!v.n && v.txt === '' && v.svg === 0, `B6 (${th}): sem contador nem outros elementos (${v.txt})`);
  }
  const red = await pg.evaluate(async () => { const i = new Image(); i.src = GX_DROP; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(i.width >> 1, (i.height * .6) | 0, 1, 1).data; return [...d]; });
  ok(red[0] > 240 && red[1] < 20 && red[2] < 20 && red[3] > 240, 'B7: a gota é vermelha (' + red + ')');
  /* ---- 3 abertura sempre recolhida (itens pendentes não expandem; halo avisa) ---- */
  await addLive(pg, [A, B]); await sleep(300); await pg.evaluate(() => { acCollapse(true); S.ac.items = []; acSave(true); }); await sleep(400); /* itens ainda não conhecidos na abertura = serão criados já na primeira sincronização */
  await ctx.close(); [ctx, pg] = await open();
  let s = await st(pg);
  ok(!s.open && s.pHidden, 'I1: ao abrir o app com alertas pendentes a bolha está recolhida e o painel fechado');
  ok(s.list.length === 2 && s.has && s.halo === 1 && s.un === 2, 'I2: o halo acende na abertura e a contagem interna é 2 (' + JSON.stringify([s.list, s.has, s.halo, s.un]) + ')');
  /* ---- 4 chegada nova durante a sessão expande e recolhe no tempo original ---- */
  await pg.evaluate(() => { window.__t = []; const o = window.setTimeout; window.setTimeout = function (f, ms) { window.__t.push(ms); return o.apply(this, arguments); }; });
  await addLive(pg, [C]); await sleep(500); s = await st(pg);
  ok(s.open && !s.pHidden, 'N1: nova notificação com o app aberto expande a bolha e mostra o conteúdo');
  const exp = 8000 + Math.min(9000, ('Personalizado C. Dia de perna: confira a medição.'.length) * 35), tm = await pg.evaluate(() => window.__t);
  const msgLen = await pg.evaluate(() => acMsg(S.ac.items.find(x => x.title === 'Personalizado C')).length), expT = 8000 + Math.min(9000, msgLen * 35);
  ok(tm.includes(expT), 'N2: tempo de recolhimento automático é o original (' + expT + ' ms) — registrados: ' + tm.filter(x => x > 1000).join(','));
  await pg.evaluate(() => { acCollapse(); }); await sleep(400);
  /* ---- 5 halo: apaga com tudo lido, acende com chegada, expandir/recolher não interfere ---- */
  s = await st(pg); ok(s.has && s.halo === 1, 'H1: recolhida com não lidos: halo aceso'); await pg.evaluate(() => acOpen(60000)); await sleep(400); s = await st(pg); ok(s.has && s.halo === 1, 'H2: expandida: halo continua aceso');
  const hc = await pg.evaluate(() => { const b = document.getElementById('acb'); const r = document.createElement('i'); r.style.color = 'var(--red)'; document.body.appendChild(r); const rc = getComputedStyle(r).color; r.remove(); return { halo: getComputedStyle(b, '::after').borderTopColor, red: rc }; });
  ok(hc.halo === hc.red, 'H3: o halo usa exatamente o vermelho principal da identidade visual (--red) (' + hc.halo + ' = ' + hc.red + ')');
  /* ---- 7 painel com superfície e elevação próprias, nos dois temas ---- */
  for (const th of ['dark', 'light']) {
    await pg.evaluate(t => { document.documentElement.dataset.theme = t; }, th); await sleep(200);
    const q = await pg.evaluate(() => { const p = document.getElementById('acp'), cs = getComputedStyle(p), row = p.querySelector('.acr'), m = p.querySelector('.acr-m'), bt = p.querySelector('.acr-b'), tb = p.querySelector('.acp-tb'); return { bg: cs.backgroundColor, page: getComputedStyle(document.documentElement).backgroundColor, card: getComputedStyle(document.documentElement).getPropertyValue('--s1').trim(), bd: cs.borderTopColor, bw: cs.borderTopWidth, sh: cs.boxShadow, row: getComputedStyle(row).backgroundColor, mc: getComputedStyle(m).color, bc: getComputedStyle(bt).color, bb: getComputedStyle(bt).backgroundColor, tc: getComputedStyle(tb).color, tbb: getComputedStyle(tb).backgroundColor }; });
    ok(q.bg !== q.page && q.sh !== 'none' && parseFloat(q.bw) > 0 && q.bd !== q.bg, `P1 (${th}): painel com fundo, borda e sombra próprios (${q.bg} / ${q.bd})`);
    ok(cr(q.bg, q.page) >= 1.08 || cr(q.bd, q.page) >= 1.5, `P2 (${th}): painel se destaca do fundo da página (contraste painel/página ${cr(q.bg, q.page).toFixed(2)}, borda ${cr(q.bd, q.page).toFixed(2)})`);
    ok(q.row !== q.bg, `P3 (${th}): itens têm superfície distinta do painel`);
    ok(cr(q.mc, q.row) >= 4.5 && cr(q.bc, q.bb) >= 4.5 && cr(q.tc, q.tbb) >= 4.5, `P4 (${th}): texto e botões legíveis (${cr(q.mc, q.row).toFixed(1)}, ${cr(q.bc, q.bb).toFixed(1)}, ${cr(q.tc, q.tbb).toFixed(1)})`);
    await pg.screenshot({ path: path.join(os.tmpdir(), 'acp-' + th + '.png') });
  }
  const other = await pg.evaluate(() => getComputedStyle(document.documentElement).backgroundColor); ok(other === 'rgb(246, 242, 240)', 'P5: fundo da página claro não foi alterado (' + other + ')');
  await pg.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }); await sleep(100);
  /* ---- 8 botões da notificação ---- */
  const rb = await pg.evaluate(() => [...document.querySelectorAll('#acp .acr')].map(r => ({ n: r.querySelectorAll('button').length, svgBtn: r.querySelectorAll('button svg').length, t: [...r.querySelectorAll('button')].map(b => b.textContent.trim()).join('|') })));
  ok(rb.length === 3 && rb.every(r => r.n === 3 && r.svgBtn === 0 && r.t === 'Marcar como lida|Acessar|Remover da lista'), 'R1: cada notificação tem exatamente os botões "Marcar como lida", "Acessar" e "Remover da lista", sem ícones: ' + JSON.stringify(rb));
  const idOf = t => pg.evaluate(t => S.ac.items.find(x => x.title === t).id, t);
  await pg.click(`#acp [data-ac="read"][data-id="${await idOf('Insulina A')}"]`); await sleep(200); s = await st(pg);
  ok(s.items.find(x => x.t === 'Insulina A').r && s.list.includes('Insulina A') && s.un === 2 && s.has, 'R2: marcar como lida mantém o item, atualiza a contagem (2) e o halo segue aceso');
  await pg.click(`#acp [data-ac="dismiss"][data-id="${await idOf('Tratamento B')}"]`); await sleep(600); s = await st(pg);
  ok(!s.list.includes('Tratamento B') && s.items.find(x => x.t === 'Tratamento B').d && s.un === 1, 'R3: remover tira da lista ativa, contagem 1; histórico preserva o item');
  const hist = await pg.evaluate(() => { go('alertashist'); return document.body.innerText.includes('Tratamento B'); }); ok(hist, 'R4: o histórico geral continua mostrando o item removido'); await pg.evaluate(() => go('painel'));
  await pg.evaluate(() => { acOpen(60000); }); await sleep(300);
  await pg.click(`#acp [data-ac="dismiss"][data-id="${await idOf('Personalizado C')}"]`); await sleep(600); s = await st(pg); ok(s.un === 0 && !s.has && s.halo === 0, 'R5: remover o último não lido apaga o halo (un=' + s.un + ')');
  /* ---- 9 clique no conteúdo: lê, remove e navega; destino inválido/ausente ---- */
  await addLive(pg, [D]); await sleep(300); await pg.evaluate(() => acOpen(60000)); await sleep(300);
  const dd = await pg.evaluate(() => S.ac.items.find(x => x.title === 'Hiper D').dest); ok(dd && dd.v === 2 && dd.a === 'new' && typeof dd.p === 'object', 'C0: item guarda destino com parâmetros: ' + JSON.stringify(dd));
  await pg.evaluate(() => go('historico')); await sleep(200); await pg.evaluate(() => acOpen(60000)); await sleep(300);
  await pg.click(`#acp [data-ac="open"][data-id="${await idOf('Hiper D')}"]`); await sleep(500); s = await st(pg);
  ok(await pg.evaluate(() => !!document.getElementById('rec-form')) && !s.list.includes('Hiper D') && s.items.find(x => x.t === 'Hiper D').r && s.items.find(x => x.t === 'Hiper D').d && !s.has, 'C1: clique marca como lida, remove da lista e navega ao destino (rota=' + s.route + ')'); await pg.evaluate(() => closeSheet());
  await pg.evaluate(() => { const it = S.ac.items.find(x => x.title === 'Insulina A'); it.read = false; it.dismissed = false; it.dest = { v: 2, r: 'rota-que-nao-existe', p: {} }; acRefresh(); go('historico'); acOpen(60000); }); await sleep(300);
  await pg.click(`#acp [data-ac="open"][data-id="${await idOf('Insulina A')}"]`); await sleep(400); s = await st(pg);
  ok(s.route === 'historico' && !s.list.includes('Insulina A') && s.items.find(x => x.t === 'Insulina A').d && pg._errs.length === 0, 'C2: destino inválido: marca lida, remove, não navega e não quebra (rota=' + s.route + ')');
  await pg.evaluate(() => { S.ac.hidden = false; acToast('Confirmação de teste sem destino'); }); await sleep(500);
  const tid = await pg.evaluate(() => S.ac.items.find(x => x.text === 'Confirmação de teste sem destino').id); await pg.click(`#acp [data-ac="open"][data-id="${tid}"]`); await sleep(400); s = await st(pg);
  ok(s.route === 'historico' && !s.list.includes('Confirmação de teste sem destino') && pg._errs.length === 0, 'C3: item sem destino é lido e removido sem navegar');
  /* ---- 10 comandos do cabeçalho ---- */
  await pg.evaluate(() => { localStorage.setItem('__live', '[]'); S.ac.items = []; }); await addLive(pg, [A, B, C]); await sleep(500); await pg.evaluate(() => { acCollapse(true); acOpen(60000); }); await sleep(400);
  const hc2 = await pg.evaluate(() => [...document.querySelectorAll('#acp .acp-tb')].map(b => b.textContent)); ok(hc2.join('|') === 'Marcar todas como lidas|Remover todas', 'T0: dois comandos separados no cabeçalho: ' + hc2);
  await pg.click('#acp [data-ac="readall"]'); await sleep(300); s = await st(pg); ok(s.list.length === 3 && s.un === 0 && !s.has && s.halo === 0, 'T1: "Marcar todas como lidas" mantém os 3 na lista, contagem 0, halo apagado');
  await pg.evaluate(() => { S.ac.items.forEach(x => x.read = false); acRefresh(); }); await sleep(200);
  await pg.click('#acp [data-ac="dismissall"]'); await sleep(700); s = await st(pg); ok(s.list.length === 0 && s.un === 0 && !s.has && s.items.length === 3 && s.items.every(x => x.d), 'T2: "Remover todas" esvazia a lista, apaga o halo e preserva o histórico');
  /* ---- 11 persistência e reinício ---- */
  await pg.evaluate(() => { localStorage.setItem('__live', '[]'); S.ac.items = []; }); await addLive(pg, [A, B, C, D]); await sleep(400); await pg.evaluate(() => { acCollapse(true); acOpen(60000); }); await sleep(300);
  await pg.click(`#acp [data-ac="read"][data-id="${await idOf('Insulina A')}"]`); await sleep(150);
  await pg.click(`#acp [data-ac="dismiss"][data-id="${await idOf('Tratamento B')}"]`); await sleep(600);
  await pg.evaluate(() => acOpen(60000)); await sleep(300); await pg.click(`#acp [data-ac="open"][data-id="${await idOf('Personalizado C')}"]`); await sleep(400);
  await ctx.close(); [ctx, pg] = await open();
  s = await pg.evaluate(() => ({ open: AC.open, pHidden: document.getElementById('acp').hidden, it: S.ac.items.map(x => ({ t: x.title, r: !!x.read, d: !!x.dismissed })) }));
  ok(!s.open && s.pHidden, 'S1: depois de reiniciar, a bolha abre recolhida');
  ok(s.it.find(x => x.t === 'Insulina A').r && !s.it.find(x => x.t === 'Insulina A').d, 'S2: lida continua lida e na lista após reiniciar');
  ok(s.it.find(x => x.t === 'Tratamento B').d && s.it.find(x => x.t === 'Personalizado C').d, 'S3: removida e removida por clique continuam removidas');
  await sleep(300); s = await st(pg);
  ok(!s.list.includes('Tratamento B') && !s.list.includes('Personalizado C') && s.list.includes('Insulina A') && s.list.includes('Hiper D'), 'S4: mesmo com a fonte ainda ativa, itens removidos não reaparecem (' + s.list + ')');
  ok(s.un === 1 && s.has && s.halo === 1, 'S5: halo reflete só o que segue não lido (Hiper D)');
  ok(pg._errs.length === 0, 'E0: sem erros de script: ' + pg._errs.slice(0, 2).join(' | '));
  await ctx.close(); fs.rmSync(DIR, { recursive: true, force: true });
  console.log(fail ? `${fail} falha(s) em ${n}` : `test40 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRO', e); process.exit(2); });
