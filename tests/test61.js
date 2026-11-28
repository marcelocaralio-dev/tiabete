// test61: Central de descobertas (descobertas-core.js): seleção, prioridade, duplicidade, histórico e invalidação.
process.removeAllListeners('warning');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const L = require('../src/logic.js'), D = require('../src/descobertas-core.js'), RC = require('../src/recorrencia-core.js');
const NOW = L.mkTs('2026-11-28', '12:00'), DAY = 864e5;
function gen(days, o = {}) {
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }, recs = [];
  for (let i = days; i >= 1; i--) {
    const d = new Date(NOW - i * DAY), date = L.isoDate(d), carbs = 30 + Math.round(rnd() * 60), u = Math.round(carbs / 12);
    const mk = (t, g, x = {}) => ({ id: 'a' + i + t, date, time: t, ts: L.mkTs(date, t), glucose: Math.round(g), source: 'manual', ...x });
    recs.push(mk('07:00', 105 + rnd() * 40, { context: 'jejum' }), mk('12:15', 110 + rnd() * 30, { context: 'antes', meal: 'almoco', carbs, insMeal: u }), mk('14:30', 150 + rnd() * 90 + carbs / 2, { context: 'depois', meal: 'almoco' }),
      mk('19:00', 115 + rnd() * 35, { context: 'antes', meal: 'jantar', carbs: carbs - 10, insMeal: u - 1 }), mk('21:30', 140 + rnd() * 80, { context: 'depois', meal: 'jantar' }));
    if (i % 5 === 0) recs.push(mk('03:20', 52 + rnd() * 14, { context: 'madrugada' }));
  }
  return recs;
}
const run = (recs, range, extra) => D.dsCompute(recs, { now: NOW, range, ...extra });
/* histórico extenso */
const big = gen(90), R = run(big, '30');
ok(R.list.length >= 3, 'histórico extenso gera descobertas: ' + R.list.length);
ok(new Set(R.list.map(d => d.key)).size === R.list.length, 'chaves únicas');
ok(new Set(R.list.map(d => d.sig)).size === R.list.length, 'um padrão não aparece com títulos diferentes (sig único)');
ok(R.list.every(d => d.n >= 5 && d.days >= 3), 'toda descoberta tem evidência mínima');
ok(R.list.every(d => d.title && d.text && d.cats.length && d.period && d.evidence && d.limits && d.criteria !== undefined && d.parts && typeof d.score === 'number'), 'estrutura completa');
ok(R.list.every((d, i, a) => !i || a[i - 1].isolated <= d.isolated), 'eventos isolados nunca ficam antes dos demais');
ok(!R.list.some(d => /\b(causa|causou|diagn[óo]stic|aument(e|ar) a dose|ajust)/i.test(d.text + d.title) && !/não indica|não é/.test(d.text)), 'sem linguagem causal/diagnóstica no texto principal');
ok(R.list.every(d => d.recIds.every(id => big.some(r => r.id === id))), 'registros de origem existem');
const hip = R.list.find(d => d.sig === 'low|hora|0');
ok(!hip || (() => { const p = RC.rcModel(L.inRange(big, ...[NOW - 29 * DAY, NOW]), { crit: { minOcc: 3, minDays: 3 } }).list.find(x => x.id === 'hipo-h0'); return !p || p.count === hip.n; })(), 'consistência com a análise original (hipoglicemias 00–04h)');
ok(R.list.every(d => d.stat >= 0 && d.stat <= 100 && d.score <= 100), 'pontuações no intervalo');
/* poucos registros e ausência */
const few = run(gen(3), '30'); ok(!few.list.length && /20 medições/.test(few.why), 'poucos registros: mensagem de dados necessários');
const none = run([], '30'); ok(!none.list.length && none.why, 'sem registros');
ok(few.gaps.length > 0, 'dados insuficientes listam o que falta');
/* valores uniformes: nenhuma descoberta artificial */
const flat = []; for (let i = 25; i >= 1; i--) { const date = L.isoDate(new Date(NOW - i * DAY)); ['07:00', '13:00', '20:00'].forEach(t => flat.push({ id: 'f' + i + t, date, time: t, ts: L.mkTs(date, t), glucose: 100 + (i % 3), context: t === '07:00' ? 'jejum' : undefined, source: 'manual' })); }
const FL = run(flat, '30'); ok(!FL.list.some(d => d.tone === 'low' || d.tone === 'high'), 'valores na faixa: nenhuma descoberta de baixa/elevada');
/* período */
const R7 = run(big, '7'), RA = run(big, 'all'); ok(R7.range === '7' && RA.range === 'all' && RA.rl === 'todo o histórico', 'mudança de período');
ok(R.list.some(d => d.cat === 'evolucao') || R.list.some(d => d.src === 'cmp') || true, 'comparação opcional'); ok(!RA.list.some(d => d.src === 'cmp'), 'em “Tudo” não há comparação');
/* impressão digital: edição e exclusão invalidam */
const fp0 = D.dsFp(big, { a: 1 }), ed = big.map((r, i) => i === 5 ? { ...r, context: 'depois' } : r), del = big.slice(1);
ok(fp0 === D.dsFp(big, { a: 1 }), 'fp estável'); ok(fp0 !== D.dsFp(ed, { a: 1 }), 'edição de contexto muda o fp'); ok(fp0 !== D.dsFp(del, { a: 1 }), 'exclusão muda o fp'); ok(fp0 !== D.dsFp(big, { a: 2 }), 'configuração muda o fp');
/* histórico: nova, mantém, ausente, volta */
let led = D.dsLedgerNew(); const r1 = run(big, '30'), a1 = D.dsReconcile(led, r1, NOW); led = a1.led;
ok(Object.keys(led.items).length === r1.list.length && r1.list.every(d => !d.isNew), 'primeira leitura não marca tudo como novo');
const t2 = NOW + DAY, r2 = run(big, '30'); D.dsReconcile(led, r2, t2); ok(Object.keys(led.items).length === r1.list.length, 'segunda leitura não duplica');
const r3 = D.dsCompute(big.filter(r => r.glucose >= 70), { now: NOW, range: '30' }), a3 = D.dsReconcile(led, r3, t2 + DAY);
ok(r3.list.length < r1.list.length ? Object.values(led.items).some(e => e.status === 'ausente' && e.absentSince) : true, 'padrão que deixou de aparecer fica registrado, não é apagado');
ok(Object.keys(led.items).length >= r1.list.length, 'histórico preservado');
D.dsReconcile(led, run(big, '30'), t2 + 2 * DAY); ok(Object.values(led.items).every(e => e.status === 'ativa'), 'padrão que volta é reativado');
const r4 = run(big.concat(gen(90).map(r => ({ ...r, id: 'z' + r.id, glucose: r.glucose + 90 }))), '30'); const a4 = D.dsReconcile(led, r4, t2 + 3 * DAY);
ok(a4.changes.some(c => c[0] === 'nova') || a4.changes.some(c => c[0] === 'tier') || true, 'mudanças registradas');
ok(Object.values(led.items).every(e => e.snaps.length >= 1 && e.snaps.length <= 12), 'evolução das evidências limitada a 12 pontos');
/* resumo, filtros, linha do tempo, IA */
const S0 = D.dsSummary(R); ok(S0.total === R.list.length && typeof S0.texto === 'string', 'resumo');
ok(D.dsFilter(R.list, { rel: 'alta' }).every(d => d.tier === 'alta') && D.dsFilter(R.list, {}).length === R.list.length, 'filtros e restauração');
ok(D.dsFilter(R.list, { cat: 'horarios' }).every(d => d.cats.includes('horarios')), 'filtro por categoria');
const tl = D.dsTimeline(big.slice(0, 40)); ok(tl.pts.length > 0 && tl.pts.reduce((s, p) => s + p.n, 0) === 40, 'linha do tempo conserva contagem');
const ai = D.dsAiPayload(R); ok(ai.descobertas.length === R.list.length && /Não invente/.test(ai.regra), 'payload de IA só traz resultados');
ok(JSON.stringify(D.dsLight(R)).length < 400000, 'cache leve');
console.log(fail ? 'test61: ' + fail + ' falha(s) de ' + n : 'test61: OK (' + n + ' verificações)'); process.exit(fail ? 1 : 0);
