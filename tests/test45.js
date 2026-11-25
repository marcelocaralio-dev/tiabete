// test45: Meu tratamento no navegador: cartões do Início vêm do tratamento, registro com insId, quantidade opcional do lembrete, pular, suspensão.
process.removeAllListeners('warning');
const path = require('path'), fs = require('fs');
let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('test45 ignorado: playwright não está instalado'); process.exit(0); }
const HTML = process.env.HTML || path.join(__dirname, '../www/index.html'); if (!fs.existsSync(HTML)) { try { require('child_process').execFileSync('node', [path.join(__dirname, '../scripts/build-web.js')], { stdio: 'ignore' }); } catch (e) { } }
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHOU ') + m); if (!c) fail++; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext(Object.assign({}, devices['Pixel 7'])), pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + HTML); await pg.waitForSelector('#view'); await sleep(1500);
  await pg.evaluate(() => { for (const i of ['tb-gate', 'tb-splash']) { const e = document.getElementById(i); if (e) e.remove(); } });
  const cards = () => pg.evaluate(() => [...document.querySelectorAll('.tc')].map(c => ({ n: c.querySelector('.tc-n').textContent, cls: c.className, id: c.id, txt: c.innerText })));
  await pg.evaluate(() => {
    const dow = new Date().getDay(), other = (dow + 3) % 7;
    S.plan = plClean({ types: ['insulina'], insulin: [
      { name: 'Basal Alfa', role: 'basal', times: ['22:00'], alarm: false }, { name: 'Rápida Beta', role: 'rapida', times: ['12:00'], alarm: false }, { name: 'Rápida Gama', role: 'rapida', times: ['12:00'], alarm: false },
      { name: 'Outro dia', role: 'rapida', times: ['09:00'], days: [other], alarm: false }, { name: 'Suspensa', role: 'rapida', times: ['10:00'], paused: true }, { name: 'Do modelo', role: 'rapida', times: [], sug: true }] });
    S.route = 'painel'; render(); S.pm = 'trat'; pmDraw();
  });
  await sleep(600);
  let c = await cards(), names = c.map(x => x.n);
  ok(names.join('|') === 'Rápida Beta|Rápida Gama|Basal Alfa', 'cartões = tratamento cadastrado (ordem por horário; sem suspensa, sem "a confirmar", sem item de outro dia): ' + names.join(','));
  ok(!c.some(x => /Jejum|Antes do jantar/.test(x.txt)), 'sem cartões fixos de jejum/jantar');
  ok(c.every(x => /Confirmar dose aplicada/.test(x.txt)) , 'botão principal "Confirmar dose aplicada"');
  /* registrar a Rápida Beta com 6 UI (a Gama no mesmo horário continua pendente) */
  const id = await pg.evaluate(() => S.plan.insulin.find(x => x.name === 'Rápida Beta').id);
  await pg.evaluate(id => { const i = document.querySelector('input.tr-draft[data-it="' + id + '"]'); i.value = '6'; i.dispatchEvent(new Event('input', { bubbles: true })); }, id);
  await pg.click('[data-act="tr-now"][data-it="' + id + '"]'); await sleep(700);
  const rec = await pg.evaluate(() => S.inslog.slice(-1)[0]);
  ok(rec && rec.insId === id && rec.units === 6 && rec.name === 'Rápida Beta' && rec.slot === '12:00', 'registro guarda insId, nome, horário do tratamento e quantidade');
  c = await cards(); const beta = c.find(x => x.n === 'Rápida Beta'), gama = c.find(x => x.n === 'Rápida Gama');
  ok(/tc-done/.test(beta.cls) && /6 Ui/i.test(beta.txt), 'Beta fica registrada (compacta, verde) com 6 Ui');
  ok(/tc-pend/.test(gama.cls), 'Gama (mesmo horário e categoria) continua pendente: sem confusão entre insulinas');
  /* pular a Gama e desfazer */
  const gid = await pg.evaluate(() => S.plan.insulin.find(x => x.name === 'Rápida Gama').id);
  await pg.click('[data-act="tr-skip"][data-key="i:' + gid + '@12:00"]'); await sleep(400); c = await cards();
  ok(/tc-skip/.test(c.find(x => x.n === 'Rápida Gama').cls) && /Pulada/.test(c.find(x => x.n === 'Rápida Gama').txt), 'cartão pulado: estado neutro e texto "Pulada hoje"');
  await pg.click('[data-act="tr-skip"][data-key="i:' + gid + '@12:00"]'); await sleep(400);
  /* pular tudo exige confirmação */
  await pg.click('[data-act="tr-skip-ask"]'); await sleep(400);
  ok(await pg.evaluate(() => !!document.querySelector('#sheet-bg [data-act="tr-skip-all"]')) && (await cards()).filter(x => /tc-skip/.test(x.cls)).length === 0, 'Pular tudo hoje abre confirmação e ainda não pula nada');
  await pg.click('#sheet-bg [data-act="close"]'); await sleep(300);
  /* confirmação por lembrete: sem quantidade, depois complementa */
  const bid = await pg.evaluate(() => S.plan.insulin.find(x => x.name === 'Basal Alfa').id);
  await pg.evaluate(async id => { await doseConfirm({ kind: 'basal', name: 'Basal Alfa', insulin: 'Basal Alfa', insId: id, sched: '22:00', src: 'lembrete' }); render(); }, bid); await sleep(500);
  c = await cards(); const bas = c.find(x => x.n === 'Basal Alfa');
  ok(/tc-done/.test(bas.cls) && /quantidade não informada/.test(bas.txt) && /Informar quantidade/.test(bas.txt), 'confirmada pelo lembrete: aparece sem quantidade e com ação para informar depois');
  const r2 = await pg.evaluate(() => S.inslog.find(x => x.src === 'lembrete'));
  ok(r2 && r2.units === undefined && r2.insId === bid, 'a dose não foi presumida (sem units) e está ligada à insulina');
  /* suspender some do Início; histórico preservado */
  await pg.evaluate(id => { S.plan.insulin.find(x => x.id === id).paused = true; render(); }, id); await sleep(400);
  c = await cards(); ok(!c.some(x => x.n === 'Rápida Beta') && await pg.evaluate(() => S.inslog.some(x => x.name === 'Rápida Beta')), 'suspender tira o cartão, mas o registro anterior continua');
  /* tela do tratamento: resumo, histórico, exportação */
  await pg.evaluate(() => { S.route = 'esquemas'; render(); }); await sleep(600);
  const t = await pg.evaluate(() => document.getElementById('view').textContent);
  ok(/Resumo do tratamento/i.test(t) && /Histórico de alterações/i.test(t) && /Exportar tratamento/i.test(t) && /Esquema vigente/i.test(t), 'Meu tratamento mostra resumo, histórico, exportação e esquema vigente');
  /* formulário de dose passada: insulinas do tratamento */
  await pg.evaluate(() => { openSheet(insLogForm(null)); }); await sleep(400);
  const opts = await pg.evaluate(() => [...document.querySelectorAll('#il-k option')].map(o => o.textContent));
  ok(opts.some(o => /Basal Alfa/.test(o)) && !opts.some(o => /Suspensa|Do modelo/.test(o)), 'formulário de dose passada lista as insulinas ativas do tratamento');
  ok(/1 · Qual insulina/i.test(await pg.evaluate(() => document.getElementById('sheet-bg').innerText)), 'formulário em três blocos');
  /* condição de registro: nenhuma regra fixa; só vale se a pessoa configurar em Meu tratamento */
  const gid2 = await pg.evaluate(() => S.plan.insulin.find(x => x.name === 'Rápida Gama').id);
  await pg.evaluate(id => { S.plan.insulin.find(x => x.id === id).paused = false; closeSheet(); S.route = 'painel'; render(); S.pm = 'trat'; pmDraw(); }, gid2); await sleep(400);
  ok(!(await cards()).some(x => /Bloquead/.test(x.txt)), 'sem condição configurada nada fica bloqueado (regra fixa do jantar removida)');
  await pg.evaluate(id => { S.plan.insulin.find(x => x.id === id).gate = { on: true, min: 140 }; closeSheet(); S.route = 'painel'; render(); S.pm = 'trat'; pmDraw(); }, gid2); await sleep(400);
  ok((await cards()).find(x => x.n === 'Rápida Gama').txt.includes('bloqueado pela condição'), 'condição configurada no item bloqueia só aquele item');
  ok(await pg.evaluate(() => !document.querySelector('[data-act="ins-min"]')) && !(await pg.evaluate(() => /Limite da insulina do jantar/.test(document.body.textContent))), 'sem limite fixo do jantar na interface');
  ok(errs.length === 0, 'sem erros de página: ' + errs.join(' | ').slice(0, 200));
  await b.close(); console.log(fail ? 'FALHAS: ' + fail : 'tudo certo'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERRO', e.message.slice(0, 400)); process.exit(1); });
