// test48: análise glicêmica por refeições (PROMPT 2) — lógica pura com cálculos independentes.
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const R = require(ROOT + '/src/refeicoes-core.js'), L = require(ROOT + '/src/logic.js'), { mkTs, isoDate, addDays } = L;
const NOW = mkTs('2026-11-20', '15:00'); let id = 0;
const rec = (date, time, g, o = {}) => ({ id: 'r' + (++id), date, time, ts: mkTs(date, time), glucose: g, source: 'manual', ...o });
const day = i => isoDate(new Date(addDays(NOW, -i)));
const foods = [{ id: 'pao', name: 'Pão', basis: 'un', unit: 'un', gpu: 50, carb: 30, fiber: 2, prot: 4, fat: 1, kcal: 150 }, { id: 'ovo', name: 'Ovo', basis: 'un', unit: 'un', gpu: 50, carb: 0.4, fiber: 0, prot: 6, fat: 5, kcal: 70 }, { id: 'arroz', name: 'Arroz', basis: 'g', unit: 'g', carb: 26, fiber: 1, prot: 2, fat: .3, kcal: 120 }];
const cafe = [{ f: 'pao', q: 2 }, { f: 'ovo', q: 1 }];            /* líquido = 2*28 + .4 = 56.4 */
const alm = [{ f: 'arroz', q: 200 }];                              /* líquido = 2*25 = 50 */
const bl = { foods, tpl: { sem: { cafe, almoco: alm }, fds: { cafe, almoco: alm } }, days: {}, meals: [] };
const recs = [], gt = {};
for (let i = 40; i >= 1; i--) {
  const d = day(i);
  /* café: log às 07:00 com pré 06:50 "antes" e pós 09:00 "depois" (pós +60 nos dias pares, +20 nos ímpares) */
  bl.meals.push({ id: 'm' + i, ts: mkTs(d, '07:00'), date: d, time: '07:00', meal: 'cafe', net: 56.4, carb: 60.4, fiber: 4, prot: 14, fat: 11, kcal: 370, ui: 4 });
  recs.push(rec(d, '06:50', 100, { context: 'antes', meal: 'cafe' })); recs.push(rec(d, '09:00', i % 2 ? 120 : 160, { context: 'depois', meal: 'cafe' }));
  if (i % 2 === 0) { bl.meals.push({ id: 'a' + i, ts: mkTs(d, '12:00'), date: d, time: '12:00', meal: 'almoco', net: 50, carb: 52, fiber: 2, prot: 4, fat: 1, kcal: 240, ui: null }); recs.push(rec(d, '11:50', 110, { context: 'antes', meal: 'almoco' })); recs.push(rec(d, '14:00', i % 8 === 0 ? 200 : 130, { context: 'depois', meal: 'almoco' })); }
}
/* registro com carboidratos "informado" e só classificada */
recs.push(rec(day(3), '19:50', 120, { context: 'antes', meal: 'jantar', carbs: 45, mealDesc: 'Sopa', insMeal: 3 })); recs.push(rec(day(3), '21:50', 150, { context: 'depois', meal: 'jantar' }));
recs.push(rec(day(4), '16:00', 95, { context: 'antes', meal: 'lanche' })); recs.push(rec(day(4), '17:30', 60, { context: 'depois', meal: 'lanche' }));
recs.push(rec(day(5), '16:00', 130, { meal: 'lanche' }));                        /* sem contexto: nunca associa */
recs.push(rec(day(6), '08:10', 140, { context: 'depois', meal: 'cafe', source: 'exemplo' })); /* exemplo ignorado */
const frozen = JSON.stringify(recs), frozenBl = JSON.stringify(bl);
const B = R.rfBuild(recs, bl), logs = B.eps.filter(e => e.kind === 'log');
ok(JSON.stringify(recs) === frozen && JSON.stringify(bl) === frozenBl, 'não altera os dados de entrada');
ok(logs.length === 60, 'um episódio por refeição feita (40 cafés + 20 almoços)');
ok(logs.every(e => e.pre && e.post) && logs.filter(e => e.complete).length === 60, 'pré e pós associados pelo tipo, dia, contexto e janela');
const c1 = logs.find(e => e.logId === 'm1'), c2 = logs.find(e => e.logId === 'm2');
ok(c1.delta === 20 && c1.gap === 130 && c1.gapMeal === 120 && c2.delta === 60, 'variação e intervalo corretos');
ok(c1.carbs.k === 'total' && c1.carbs.v === 60.4 && c1.net === 56.4, 'carboidratos totais do log, sem trocar por líquidos');
ok(c1.foodsSrc === 'modelo' && c1.foods.length === 2 && c1.sig === 'f:ovo+pao', 'alimentos reconhecidos pelo modelo quando o total confere');
bl.days[day(2)] = { cafe: [{ f: 'pao', q: 1 }], almoco: alm }; const B2 = R.rfBuild(recs, bl); ok(!B2.eps.find(e => e.logId === 'm2').foods && B2.eps.find(e => e.logId === 'm2').flags.includes('sem-alimentos'), 'total diferente do registrado: não presume alimentos');
ok(B2.eps.find(e => e.logId === 'a2').foodsSrc === 'dia', 'registro do dia com total igual: fonte "dia"'); delete bl.days[day(2)];
const jan = B.eps.find(e => e.meal === 'jantar'); ok(jan.kind === 'registro' && jan.carbs.k === 'informado' && jan.insReg && jan.ui === 3 && jan.complete && jan.timeApprox, 'registro com carboidratos: origem "registro", carboidrato "informado", insulina presente');
const lan = B.eps.find(e => e.meal === 'lanche'); ok(lan.kind === 'classificada' && !lan.carbs && lan.delta === -35 && lan.flags.includes('so-classificada') && lan.flags.includes('sem-carb'), 'só classificada: sinalizada, sem carboidratos inventados');
const orphan = recs.find(r => r.meal === 'lanche' && !r.context); ok(!B.eps.some(e => (e.pre && e.pre.id === orphan.id) || (e.post && e.post.id === orphan.id) || (e.posts || []).some(r => r.id === orphan.id)), 'medição sem contexto não é associada, mesmo próxima do horário');
ok(!B.eps.some(e => e.post && e.post.source === 'exemplo'), 'registros de exemplo ficam de fora');
/* estatísticas contra referência independente */
const S = R.rfStats(logs.filter(e => e.meal === 'cafe')); const dl = []; for (let i = 40; i >= 1; i--) dl.push((i % 2 ? 120 : 160) - 100);
ok(S.nPair === 40 && Math.abs(S.deltaMean - dl.reduce((a, b) => a + b) / 40) < 1e-9 && S.deltaMin === 20 && S.deltaMax === 60 && S.gapMed === 130 && S.postMin === 120 && S.postMax === 160, 'estatísticas do café batem');
ok(S.lowN === 0 && S.highN === 0 && S.dist.ok === 40 && Math.abs(S.carbMean - 60.4) < 1e-9 && S.foodsMean === 2 && S.itemsMean === 2, 'frequências, distribuição e alimentos');
const SA = R.rfStats(logs.filter(e => e.meal === 'almoco')); ok(SA.highN === 5 && SA.nPost === 20, 'elevados no almoço (200 > 180): 5 de 20');
/* carboidratos: totais e informados nunca misturados */
const C = R.rfCarbs(B.eps); ok(C.total.n === 60 && C.informado.n === 1 && C.informado.nPair === 1 && C.total.bins[2].n === 40 && C.total.bins[1].n === 20, 'carboidratos totais separados dos informados e agrupados em faixas');
ok(C.total.r == null || Math.abs(C.total.r) <= 1, 'correlação só com amostra mínima');
/* padrões */
const P = R.rfPatterns(B.eps); ok(!P.some(p => p.k === 'elev' && p.meal === 'almoco'), 'elevação em 5 de 20 (25%) não vira padrão');
ok(P.every(p => p.count >= 1 && p.universe >= p.count && p.ids.length > 0 && !/caus|provoc|devido/i.test(p.text.replace('não indica causa', ''))), 'todo padrão traz n e não afirma causa');
const rep = R.rfRepeated(B.eps), cr = rep.find(r => r.meal === 'cafe'); ok(cr && cr.n === 40 && cr.range === 40 && cr.similar === 'semelhante', 'refeição repetida: 40 repetições, faixa de variação 40 → semelhante');
const fp = P.find(p => p.k === 'alim'); ok(!fp, 'alimento presente em todos os episódios não gera comparação "com/sem"');
/* padrão elevação/baixo com dados próprios */
const mk6 = (hi) => { const rs = []; for (let i = 1; i <= 6; i++) { const d = day(i); rs.push(rec(d, '12:00', 100, { context: 'antes', meal: 'almoco', carbs: 40 })); rs.push(rec(d, '14:00', i <= hi ? 220 : 130, { context: 'depois', meal: 'almoco' })); } return rs; };
ok(R.rfPatterns(R.rfBuild(mk6(4), { meals: [] }).eps).some(p => p.k === 'elev' && p.count === 4 && p.universe === 6), 'elevações recorrentes: 4 de 6 → padrão com n');
ok(!R.rfPatterns(R.rfBuild(mk6(2), { meals: [] }).eps).some(p => p.k === 'elev'), '2 de 6 não é padrão');
const lowr = mk6(0).map(r => r.context === 'depois' ? { ...r, glucose: 60 } : r); ok(R.rfPatterns(R.rfBuild(lowr, { meals: [] }).eps).some(p => p.k === 'baixo' && p.count === 6), 'valores baixos recorrentes após refeição');
ok(R.rfPatterns(R.rfBuild(mk6(4).slice(0, 8), { meals: [] }).eps).length === 0, 'abaixo do mínimo de episódios não gera padrão');
/* filtros */
const all = B.eps, f = x => R.rfApply(all, x);
ok(f({ meal: 'almoco' }).length === 20 && f({ origin: 'classificada' }).length === 1 && f({ ins: 'sim' }).length === 41 && f({ ins: 'nao' }).length === all.length - 41, 'filtros: tipo, origem e insulina');
ok(f({ food: 'Arroz' }).length === 20 && f({ cmin: '50', cmax: '70' }).length === 60 && f({ cmin: '30', cmax: '50' }).length === 1, 'filtros: alimento e carboidratos (sem carboidratos fica de fora quando filtrado)');
ok(f({ from: day(3), to: day(3) }).every(e => e.date === day(3)) && f({ rep: true }).every(e => e.sig) && f({ rep: true }).length === 60, 'filtros: período e repetidas');
ok(f({ ctx: 'fds' }).every(e => e.weekend) && f({ ctx: 'sem' }).every(e => !e.weekend) && f({ ctx: 'fds' }).length + f({ ctx: 'sem' }).length === all.length, 'filtro de contexto: fim de semana × dia de semana');
ok(R.rfApply(all, {}).length === all.length && R.rfFilterClean({ from: 'x', meal: 'zzz', cmin: '-4' }).from === '', 'filtro vazio mantém tudo; entrada inválida é descartada');
/* comparação */
const G = R.rfGroups(all), ga = G.find(g => g.id === 'm:cafe'), gb = G.find(g => g.id === 'm:almoco'), cp = R.rfCompare(ga, gb);
ok(Math.abs(cp.diff.delta - (ga.st.deltaMean - gb.st.deltaMean)) < 1e-9 && cp.notes.some(t => /intervalo/.test(t)) === (Math.abs(ga.st.gapMed - gb.st.gapMed) >= 45), 'comparação: diferença e avisos de intervalo');
const small = R.rfCompare(G.find(g => g.id === 'm:jantar'), ga); ok(small.notes.some(t => /Poucos episódios/.test(t)), 'comparação com poucos episódios avisa');
ok(R.rfCompare(null, ga) === null, 'comparação sem seleção devolve null');
/* qualidade */
const Q = R.rfQuality(all, B); ok(Q.semCarb.length === 1 && Q.fraca.length === 1 && Q.complete === all.length && Q.total === all.length, 'qualidade: contagens');
const dupRecs = recs.concat([{ ...recs[0], id: 'dup' }]); ok(R.rfBuild(dupRecs, bl).dupRecs === 1, 'qualidade: registro de glicemia duplicado contado uma vez');
const dupM = { ...bl, meals: bl.meals.concat([{ ...bl.meals[0], id: 'dupm' }]) }; const Bd = R.rfBuild(recs, dupM); ok(Bd.dupMeals === 1 && Bd.eps.filter(e => e.kind === 'log').length === 60, 'qualidade: refeição duplicada contada uma vez');
const odd = [rec(day(1), '07:00', 100, { context: 'antes', meal: 'cafe' }), rec(day(1), '07:20', 150, { context: 'depois', meal: 'cafe' }), rec(day(2), '07:00', 100, { context: 'antes', meal: 'cafe' }), rec(day(2), '15:00', 150, { context: 'depois', meal: 'cafe' })];
const Bo = R.rfBuild(odd, { meals: [] }); ok(Bo.eps.filter(e => e.complete).length === 0 && Bo.eps.some(e => e.flags.includes('sem-pos')) && Bo.eps.some(e => e.flags.includes('sem-pre')), 'pós muito próximo (<30 min) ou distante (>6 h) não é associado; sobra pré e pós sem par');
const mid = [rec(day(1), '07:00', 100, { context: 'antes', meal: 'cafe' }), rec(day(1), '07:50', 150, { context: 'depois', meal: 'cafe' })]; ok(R.rfQuality(R.rfBuild(mid, { meals: [] }).eps, null).intervalo.length === 1, 'intervalo de 50 min sinalizado como curto');
const noTime = { meals: [{ id: 'x', ts: mkTs(day(1), '00:00'), date: day(1), time: '', meal: 'cafe', net: 10, carb: 10, fiber: 0, kcal: 40 }] }; const Bn = R.rfBuild([rec(day(1), '06:50', 100, { context: 'antes', meal: 'cafe' })], noTime); ok(Bn.eps.find(e => e.kind === 'log').flags.includes('sem-horario') && !Bn.eps.find(e => e.kind === 'log').pre, 'refeição sem horário: sinalizada e sem associação');
/* modelo */
const M = R.rfModel(recs, bl, { meal: 'cafe' }); ok(M.list.length === 40 && M.hidden === all.length - 40 && M.foodNames.includes('Pão') && M.stats.nPair === 40, 'modelo: lista filtrada, ocultos e nomes de alimentos');
ok(R.rfModel([], { meals: [] }, {}).list.length === 0 && R.rfModel([], null, {}).stats.n === 0, 'vazio e sem Bolus não quebram');
/* nenhum texto de dose */
const src = fs.readFileSync(ROOT + '/src/refeicoes-core.js', 'utf8'); ok(!/blDose|ratio|razao/i.test(src), 'núcleo não usa cálculo de dose nem razão');
console.log(fail ? fail + ' falha(s) em ' + n : 'OK ' + n + ' verificações'); process.exit(fail ? 1 : 0);
