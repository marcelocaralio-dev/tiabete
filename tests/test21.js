// test21: bolha de alertas. Mensagens sem corte, fixação nas laterais, só arrasto vertical, persistência (inclusive reinício completo do navegador) e instância única.
// Chromium (Playwright) com toque, emulando um Pixel 7. Não substitui o teste em aparelho real (ver limites no CHANGELOG).
process.removeAllListeners('warning');
const path = require('path'), fs = require('fs'), os = require('os');
let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('test21 ignorado: playwright não está instalado'); process.exit(0); }
const HTML = process.env.HTML || path.join(__dirname, '../www/index.html'); if (!fs.existsSync(HTML)) { console.log('test21 ignorado: compile o app web antes (www/index.html)'); process.exit(0); }
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'acb-'));
async function open() { const ctx = await chromium.launchPersistentContext(DIR, Object.assign({}, devices['Pixel 7'])), pg = ctx.pages()[0] || await ctx.newPage(); pg._errs = []; pg.on('pageerror', e => pg._errs.push(e.message)); await pg.route('**/fonts.*/**', r => r.abort()); await pg.goto('file://' + HTML); await pg.waitForSelector('#view'); await sleep(1200); await pg.evaluate(() => { for (const i of ['tb-gate', 'tb-splash']) { const e = document.getElementById(i); if (e) e.remove(); } }); return [ctx, pg]; }
const geo = pg => pg.evaluate(() => { const b = document.getElementById('acb'), r = b && b.getBoundingClientRect(), k = b && b._k; return { vis: !!b && !b.hidden, left: r && r.left, right: r && innerWidth - r.right, top: r && r.top, bottom: r && r.bottom, w: r && r.width, vw: innerWidth, vh: innerHeight, side: b && b.dataset.side, pos: S.ac.pos, mode: S.ac.mode, hidden: S.ac.hidden, cnt: document.querySelectorAll('#acb').length, cz: document.querySelectorAll('#acz').length, cp: document.querySelectorAll('#acp').length }; });
const drag = async (pg, tx, ty) => { const r = await pg.evaluate(() => { const r = document.getElementById('acb').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }); await pg.mouse.move(r[0], r[1]); await pg.mouse.down(); for (let i = 1; i <= 12; i++) await pg.mouse.move(r[0] + (tx - r[0]) * i / 12, r[1] + (ty - r[1]) * i / 12); await pg.mouse.up(); await sleep(520); };
const anchored = g => g.vis && (Math.abs(g.left - 6 * (g.w / 56)) < 4 || Math.abs(g.right - 6 * (g.w / 56)) < 4); /* margem de 6 px (na escala do app) numa das laterais */
(async () => {
  let [ctx, pg] = await open();
  await pg.evaluate(() => acSetMode('bubble')); await sleep(400);
  let g = await geo(pg); ok(g.vis && anchored(g) && g.side === 'r', 'P0: bolha ativada nasce encostada na lateral direita: ' + JSON.stringify([g.left, g.right]));
  /* ---- posicionamento ---- */
  const yMid = g.vh * .5;
  await drag(pg, g.vw - 30, yMid - 120); g = await geo(pg); ok(anchored(g) && g.side === 'r' && g.top < yMid, 'A1: arrasto vertical na margem direita fixa na direita (right=' + g.right.toFixed(1) + ')');
  const topR = g.top;
  await drag(pg, 30, yMid + 60); g = await geo(pg); ok(anchored(g) && g.side === 'l', 'A2: levar ao outro lado fixa na margem esquerda (left=' + g.left.toFixed(1) + ')');
  await drag(pg, 30, yMid - 100); g = await geo(pg); ok(anchored(g) && g.side === 'l' && g.top < yMid - 60, 'A3: arrasto vertical na margem esquerda');
  await drag(pg, g.vw / 2, yMid); g = await geo(pg); ok(anchored(g), 'A4: soltar no centro não deixa a bolha solta (side=' + g.side + ', left=' + g.left.toFixed(1) + ', right=' + g.right.toFixed(1) + ')');
  await drag(pg, g.vw / 2 + 3, yMid); await drag(pg, g.vw / 2 - 3, yMid); g = await geo(pg); ok(anchored(g), 'A5: perto do meio também encosta');
  let allOk = true, seq = [];
  for (let i = 0; i < 14; i++) { const x = i % 2 ? 24 : g.vw - 24, y = 90 + ((i * 97) % (g.vh - 260)); await drag(pg, x, y); const q = await geo(pg); seq.push(q.side); if (!anchored(q) || q.top < 0 || q.bottom > q.vh || q.left < 0 || q.right < 0) { allOk = false; console.log('  solta em', i, JSON.stringify(q)); } }
  ok(allOk && new Set(seq).size === 2, 'A6: 14 trocas entre as margens, sempre encostada e visível (' + seq.join('') + ')');
  /* durante o arrasto, o deslocamento horizontal não leva a bolha para o meio */
  { const r = await pg.evaluate(() => { const r = document.getElementById('acb').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }); await pg.mouse.move(r[0], r[1]); await pg.mouse.down(); let mid = false; for (let i = 1; i <= 20; i++) { await pg.mouse.move(r[0] + (g.vw / 2 - r[0]) * i / 20, r[1] + 40); await sleep(30); const q = await geo(pg); if (q.left > q.vw * .2 && q.right > q.vw * .2) mid = true; } await pg.mouse.up(); await sleep(450); ok(mid, 'A7: durante o arrasto a bolha acompanha o dedo livremente, inclusive pelo meio da tela (v0.34: sem prender nas margens)'); }
  /* ---- persistência ---- */
  await drag(pg, g.vw - 20, 300); const before = await geo(pg); ok(before.side === 'r', 'S0: preparada na direita');
  await ctx.close(); [ctx, pg] = await open(); g = await geo(pg);
  ok(g.vis && g.mode === 'bubble' && g.side === 'r' && Math.abs(g.top - before.top) < 6, 'S1: depois de fechar o navegador por completo, a bolha volta ativada, na direita e na mesma altura (' + g.top.toFixed(0) + ' vs ' + before.top.toFixed(0) + ')');
  await drag(pg, 20, 420); const bl = await geo(pg); await ctx.close(); [ctx, pg] = await open(); g = await geo(pg); ok(g.vis && g.side === 'l' && Math.abs(g.top - bl.top) < 6, 'S2: margem esquerda e altura restauradas após novo reinício');
  /* gravação imediata: sair logo após uma troca, sem esperar */
  await pg.evaluate(() => { S.ac.pos = { fx: 1, fy: .25 }; acSave(); }); await pg.evaluate(() => { window.__x = 1; }); await pg.close().catch(() => { }); await ctx.close(); [ctx, pg] = await open(); g = await geo(pg); ok(g.side === 'r' && Math.abs(g.pos.fy - .25) < .01, 'S3: alteração salva na hora (espelho síncrono) sobrevive a um encerramento imediato');
  ok(g.cnt === 1 && g.cz === 1 && g.cp === 1, 'S4: uma única bolha, uma área de descarte e um painel após reabrir: ' + [g.cnt, g.cz, g.cp]);
  for (let i = 0; i < 5; i++) await pg.evaluate(() => { acRefresh(); acEnsure(); acSetMode('bubble'); }); g = await geo(pg); ok(g.cnt === 1 && g.cz === 1 && g.cp === 1, 'S5: ativar e atualizar várias vezes não duplica nada');
  /* a seção Alertas mostra o estado real */
  await pg.evaluate(() => go('lembretes')); await sleep(400); const radio = await pg.evaluate(() => [...document.querySelectorAll('[data-acm]')].map(b => b.dataset.acm + ':' + b.getAttribute('aria-checked')).join(','));
  ok(/bubble:true/.test(radio), 'S6: Alertas mostra "Bolha flutuante" marcada: ' + radio);
  /* desativar e reabrir */
  await pg.evaluate(() => acSetMode('classic')); await ctx.close(); [ctx, pg] = await open(); g = await geo(pg); ok(!g.vis && g.mode === 'classic', 'S7: desativada continua desativada depois de reabrir'); ok(g.cnt === 0 || !g.vis, 'S8: nada é iniciado sozinho quando está desativada');
  await pg.evaluate(() => go('lembretes')); await sleep(300); ok(/classic:true/.test(await pg.evaluate(() => [...document.querySelectorAll('[data-acm]')].map(b => b.dataset.acm + ':' + b.getAttribute('aria-checked')).join(','))), 'S9: Alertas mostra o modo convencional marcado');
  /* ---- mensagens ---- */
  await pg.evaluate(() => acSetMode('bubble')); await sleep(400);
  const T = { curta: 'Glicemia registrada.', media: 'Lembrete de insulina rápida: confirme a aplicação antes da refeição para manter o registro do dia completo e correto.', longa: 'Atenção: a sua última medição ficou acima do limite que você definiu e já faz mais de duas horas. '.repeat(1) + 'Beba água, confira se aplicou a insulina prevista e meça novamente. Se estiver com sintomas como muita sede, náusea ou dor abdominal, procure atendimento. '.repeat(2) + 'Este texto é propositalmente longo para conferir que nada é cortado e que o botão de leitura completa aparece.' };
  const show = async () => { await pg.evaluate(T => { S.ac.items = Object.entries(T).map(([k, t], i) => ({ id: 'm' + k, key: 'k' + k, src: 'toast', cat: 'info', prio: 1, title: k, text: t, ts: Date.now() - i * 1000, read: false, dismissed: false, active: false, rev: 0 })); acRefresh(); AC.only = null; acOpen(60000); }, T); await sleep(500); };
  await show();
  const rows = await pg.evaluate(() => { const p = document.getElementById('acp'), pr = p.getBoundingClientRect(); return { pl: pr.left, pr: innerWidth - pr.right, w: pr.width, vw: innerWidth, rows: [...p.querySelectorAll('.acr-w')].map(w => { const m = w.querySelector('.acr-m'); return { sh: m.scrollHeight, ch: m.clientHeight, clamp: getComputedStyle(m).webkitLineClamp, btns: w.querySelectorAll('button').length }; }) }; });
  ok(rows.pl >= 0 && rows.pr >= 0 && rows.w > rows.vw * .88, 'M0: painel largo (' + rows.w.toFixed(0) + ' de ' + rows.vw + ') e dentro das margens (' + rows.pl.toFixed(0) + '/' + rows.pr.toFixed(0) + ')');
  ok(rows.rows.every(r => r.clamp === 'none'), 'M1: sem truncamento por reticências (line-clamp) em nenhuma mensagem');
  ok(rows.rows.every(r => r.sh <= r.ch + 1), 'M2: toda mensagem (curta, média e longa) aparece inteira, sem cortes');
  ok(rows.rows.every(r => r.btns === 3), 'M3: cada notificação tem exatamente três botões (Marcar como lida, Acessar, Remover da lista)');
  const full = await pg.evaluate(T => [...document.querySelectorAll('#acp .acr-m')].some(m => m.textContent.includes(T.longa.slice(-60))), T); ok(full, 'M6: o fim da mensagem longa está presente (nada perdido)');
  /* telas estreitas e escala grande */
  await pg.setViewportSize({ width: 320, height: 640 }); await sleep(400); await pg.evaluate(() => { acPanelPos(); }); const nar = await pg.evaluate(() => { const r = document.getElementById('acp').getBoundingClientRect(); return [r.left, innerWidth - r.right]; }); ok(nar[0] >= 0 && nar[1] >= 0, 'M9: em tela de 320 px o painel respeita as margens');
  const g2 = await geo(pg); ok(anchored(g2), 'M10: a bolha continua encostada após girar/redimensionar');
  ok(pg._errs.length === 0, 'E0: sem erros de script: ' + pg._errs.slice(0, 2).join(' | '));
  await ctx.close(); fs.rmSync(DIR, { recursive: true, force: true });
  console.log(fail ? `${fail} falha(s) em ${n}` : `test21 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRO', e); process.exit(2); });
