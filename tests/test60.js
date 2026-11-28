// test60: correlação e associação entre variáveis (correlacao-core.js).
// Confere os coeficientes e testes com valores de referência calculados de forma independente (scipy) e valida as regras de qualidade
// com conjuntos controlados: correlação positiva, negativa, inexistente, amostra pequena, valores extremos, dados incompletos e duplicados.
process.removeAllListeners('warning');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const C = require('../src/correlacao-core.js');
const near = (a, b, t) => a != null && Math.abs(a - b) <= (t || 1e-9);
const REF = {"x":[38.0,30.1,46.3,56.3,67.0,51.6,41.7,38.2,61.2,74.5,54.1,31.5,35.6,74.0,53.0,24.0,48.7,32.6,40.6,42.7,39.3,58.3,49.1,41.2,56.1,62.4,25.4,46.1,35.3,47.4,30.7,50.3,49.4,45.4,34.3,44.1,33.6,29.7,53.4,33.4],"y":[36.8,26.7,3.8,37.0,27.0,31.4,25.5,-0.9,33.9,41.6,44.0,4.7,30.2,31.2,27.8,4.3,46.6,26.4,53.5,33.3,33.7,45.1,22.2,23.9,49.9,32.7,17.5,27.4,28.5,24.1,16.6,33.1,30.9,16.9,31.3,10.9,5.7,2.4,43.6,15.7],"x2":[3.0,6.0,4.0,7.0,8.0,4.0,4.0,5.0,6.0,4.0,5.0,8.0,6.0,3.0,4.0,4.0,2.0,1.0,7.0,4.0,3.0,6.0,5.0,8.0,5.0,8.0,5.0,3.0,3.0,8.0],"y2":[5.0,2.0,7.0,7.0,1.0,2.0,6.0,4.0,3.0,1.0,2.0,7.0,7.0,7.0,5.0,2.0,3.0,5.0,8.0,3.0,5.0,4.0,5.0,5.0,6.0,1.0,8.0,7.0,7.0,3.0],"a":[20.6,39.1,30.2,23.8,23.7,20.1,30.5,40.7,26.7,34.2,48.8,17.9,32.6,26.9,19.4,19.7,29.8,34.3],"b":[33.6,40.7,48.7,43.6,50.4,45.5,45.9,61.9,47.5,41.6,48.5,29.0,35.9,49.5,47.6,58.6,40.1,22.5,63.4,53.1,27.3,56.5],"c":[35.3,18.7,31.2,30.4,49.3,27.9,32.7,32.5,31.6,26.8,37.0,44.7,40.6,26.7,24.7],"pear":[0.5285784154122969,0.00045466755587552813],"spr":[0.5876172607879926,6.703648550478881e-05],"spr2":[-0.1198399719845813,0.5281849006863161],"welch":[-5.331449866705046,4.7108071061754375e-06,37.95350652293063],"mw":[50.5,6.426342902778787e-05],"kw":[20.05376388169157,4.4195749403537164e-05],"pci":[0.25985624721385386,0.7213176748384307],"bh_in":[0.001,0.008,0.039,0.041,0.042,0.06,0.074,0.205,0.212,0.216],"bh":[0.01,0.04,0.084,0.084,0.084,0.1,0.1057142857142857,0.216,0.216,0.216]};

/* 1. conferência independente (scipy) */
ok(near(C.crPearson(REF.x, REF.y), REF.pear[0]) && near(C.crRP(REF.pear[0], 40), REF.pear[1]), 'Pearson e p conferem');
ok(near(C.crSpearman(REF.x, REF.y), REF.spr[0]) && near(C.crSpearman(REF.x2, REF.y2), REF.spr2[0]), 'Spearman (com e sem empates) confere');
const ci = C.crFisherCI(REF.pear[0], 40, false); ok(near(ci[0], REF.pci[0], 1e-6) && near(ci[1], REF.pci[1], 1e-6), 'IC 95% de Fisher confere');
const w = C.crWelch(REF.a, REF.b); ok(near(w.t, REF.welch[0]) && near(w.p, REF.welch[1], 1e-12) && near(w.df, REF.welch[2]), 'Welch confere');
const mw = C.crMannWhitney(REF.a, REF.b); ok(near(mw.U, REF.mw[0]) && near(mw.p, REF.mw[1], 1e-12), 'Mann–Whitney confere');
const kw = C.crKruskal([REF.a, REF.b, REF.c]); ok(near(kw.H, REF.kw[0]) && near(kw.p, REF.kw[1], 1e-12), 'Kruskal–Wallis confere');
C.crBH(REF.bh_in).forEach((q, i) => ok(near(q, REF.bh[i]), 'Benjamini–Hochberg ' + i));
ok(near(C.crTcrit(10), 2.228138851986274) && near(C.crChi2Sf(5.991, 2), Math.exp(-5.991 / 2), 1e-12), 'distribuições t e qui-quadrado');
ok(C.crPearson([1, 2, 3], [1, 1, 1]) === null && C.crPearson([1, 2], [1, 2]) === null, 'sem variação ou com menos de 3 pares: sem coeficiente');

/* 2. conjuntos controlados */
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pad = v => String(v).padStart(2, '0');
function gen(days, f, o) {
  o = o || {}; const recs = []; let id = 0;
  for (let d = 0; d < days; d++) {
    const dt = new Date(2026, 8, 1 + d), date = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    const mk = (time, g, x) => { const [h, m] = time.split(':'); recs.push({ id: 'r' + (id++), date, time, glucose: Math.round(g), ts: new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), +h, +m).getTime(), source: o.source || 'manual', ...x }); };
    f(d, mk, rnd);
  }
  return recs;
}
const meal = (slope, noise) => (d, mk, r) => { const carbs = 20 + Math.round(r() * 60), pre = 110 + r() * 30; mk('07:00', 100 + r() * 20, { context: 'jejum' }); mk('12:00', pre, { context: 'antes', meal: 'almoco', carbs, insMeal: Math.round(carbs / 10) }); mk('14:30', pre + carbs * slope + (r() - .5) * noise, { context: 'depois', meal: 'almoco' }); };
const pos = C.crModel(gen(60, meal(1.2, 30)), {}), neg = C.crModel(gen(60, meal(-1.0, 30)), {}), nul = C.crModel(gen(60, meal(0, 60)), {});
const rp = C.crAnalyze(pos, 'refeicao', 'carb_inf', 'delta'), rn = C.crAnalyze(neg, 'refeicao', 'carb_inf', 'delta'), r0 = C.crAnalyze(nul, 'refeicao', 'carb_inf', 'delta');
ok(rp.ok && rp.coef > 0.7 && rp.dir === 1 && rp.strength === 'forte' && rp.ci[0] > 0 && rp.n === 60, 'correlação positiva forte detectada, com n e IC');
ok(rn.ok && rn.coef < -0.5 && rn.dir === -1, 'correlação negativa detectada');
ok(r0.ok && Math.abs(r0.coef) < 0.3 && (r0.inconclusive || r0.strength === 'fraca' || r0.strength === 'nenhuma'), 'sem relação: coeficiente perto de zero');
ok(nul.auto.highlights.every(h => Math.abs(h.coef || 0) < 0.9) && !nul.auto.highlights.some(h => h.x === 'carb_inf' && h.y === 'delta'), 'sem relação não vira destaque');
ok(pos.auto.highlights.some(h => h.x === 'carb_inf' && h.y === 'delta' && h.q <= C.CR_Q_HIGH), 'relação real vira destaque após a correção (q ≤ 0,10)');
ok(pos.auto.tested >= 3 && pos.auto.list.filter(r => r.ok).every(r => r.q == null || r.q >= r.p - 1e-12), 'q ajustado nunca é menor que p');
ok(rp.method === 'pearson' || rp.method === 'spearman', 'método escolhido'); ok(/Pearson|Spearman/.test(rp.methodWhy), 'motivo do método explicado');
ok(rp.meaning && rp.meaning.length > 40, 'significado do coeficiente explicado');
const loo = rp.loo; ok(loo[0] <= rp.coef + 1e-9 && loo[1] >= rp.coef - 1e-9, 'estabilidade: faixa ao retirar um registro contém o coeficiente');
ok(rp.points.length === 60 && rp.points.every(p => p.rec.length === 2 && p.id), 'cada ponto traz os registros de origem');

/* 3. amostra pequena, poucos dias, dados incompletos */
const small = C.crModel(gen(6, meal(1.2, 30)), {}); const rs = C.crAnalyze(small, 'refeicao', 'carb_inf', 'delta');
ok(!rs.ok && rs.code === 'amostra' && /Poucas observações/.test(rs.why) && rs.coef === undefined, 'amostra pequena: aviso em vez de coeficiente');
const inc = gen(40, (d, mk, r) => { mk('12:00', 120, { context: 'antes', meal: 'almoco', carbs: 50 }); if (d % 10 === 0) mk('14:30', 150, { context: 'depois', meal: 'almoco' }); });
const mi = C.crModel(inc, {}); ok(mi.units.refeicao.n === 4 && mi.units.refeicao.excl['sem par antes/depois'] === 36, 'refeições sem par ficam de fora e são contadas');
ok(!C.crAnalyze(mi, 'refeicao', 'carb_inf', 'delta').ok, 'dados incompletos não geram correlação');
ok(C.crModel([], {}).auto.highlights.length === 0 && C.crModel([{ id: 'x', date: '2026-09-01', time: '10:00', glucose: 100, ts: 1, source: 'exemplo' }], {}).quality.examples === 1, 'sem dados e dados de exemplo não entram');

/* 4. valores extremos */
const ext = gen(50, meal(0.6, 20)); ext.filter(r => r.context === 'depois').slice(0, 2).forEach(r => { r.glucose = 520; });
const me = C.crModel(ext, {}), re = C.crAnalyze(me, 'refeicao', 'carb_inf', 'delta');
ok(re.ok && re.outN >= 1 && re.method === 'spearman' && re.noOut && re.flags.some(f => /extremos/.test(f.k)), 'valores extremos identificados; Spearman usado; coeficiente sem extremos informado');

/* 5. duplicados e vínculo temporal */
const base = gen(30, meal(1.2, 30)), dup = base.concat(base.map(r => ({ ...r, id: 'd' + r.id })));
ok(C.crModel(dup, {}).units.refeicao.n === C.crModel(base, {}).units.refeicao.n && C.crModel(dup, {}).quality.dup === base.length, 'registros duplicados não duplicam observações');
const nextDay = ds => { const [y, m, dd] = ds.split('-').map(Number), t = new Date(y, m - 1, dd + 1); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
const wrongDay = gen(30, (d, mk, r) => { mk('12:00', 120, { context: 'antes', meal: 'almoco', carbs: 20 + d }); }).concat(gen(30, (d, mk) => { mk('14:30', 150, { context: 'depois', meal: 'almoco' }); }).map(r => ({ ...r, id: 'p' + r.id, date: nextDay(r.date), ts: r.ts + 86400000 + 86400000 })));
ok(C.crModel(wrongDay, {}).units.refeicao.n === 0, 'medição de outro dia nunca é associada à refeição');
ok(C.crModel(wrongDay, {}).units.refeicao.n === 0, 'medição de outro dia nunca é associada à refeição');
const ins = gen(40, (d, mk, r) => { mk('08:00', 140, { context: 'antes', meal: 'cafe', carbs: 40, insMeal: 4 }); mk('09:00', 150, { insMeal: 2 }); mk('11:00', 150 - 3 * (d % 5), {}); mk('11:30', 150, { context: 'antes', meal: 'almoco', carbs: 50, insMeal: 5 }); });
const mins = C.crModel(ins, {}); ok((mins.units.insulina.excl['refeição, insulina ou atividade no meio'] || 0) >= 30, 'insulina: refeição ou nova dose entre as medições invalida o par');

/* 6. regras de combinação */
const U = pos.units.refeicao, U2 = pos.units.dia;
ok(!C.crPairRule(U, 'post', 'delta').ok && C.crPairRule(U, 'pre', 'delta').ok && C.crPairRule(U, 'pre', 'delta').coupled, 'variação × glicemia posterior é recusada; × anterior é aceita com alerta de acoplamento');
ok(!C.crPairRule(U, 'refeicao', 'fds').ok && !C.crPairRule(U, 'hora', 'periodo').ok && !C.crPairRule(U, 'carb_total', 'carb_liq').ok && !C.crPairRule(U, 'delta', 'delta').ok, 'categoria × categoria e variáveis derivadas são recusadas');
ok(C.crCombos(pos, 'refeicao', 'carb_inf').every(c => c.id !== 'carb_inf' && c.kind) && !C.crCombos(pos, 'refeicao', 'delta').some(c => c.id === 'post'), 'interface só recebe combinações válidas');
ok(pos.auto.list.every(r => !r.coupled), 'análise acoplada fica fora da varredura automática');
const cp = C.crAnalyze(pos, 'refeicao', 'pre', 'delta'); ok(cp.ok && cp.flags.some(f => f.k === 'acoplado'), 'pré × variação mostra a limitação de construção');

/* 7. comparação entre grupos (dias com e sem atividade) */
const act = gen(60, (d, mk, r) => { const a = d % 2 === 0; for (const t of ['08:00', '12:00', '16:00', '21:00']) mk(t, (a ? 105 : 150) + (r() - .5) * 40, a && t === '08:00' ? { actMin: 40, actDesc: 'caminhada' } : {}); });
const ma = C.crModel(act, {}), rg = C.crAnalyze(ma, 'dia', 'dia_ativ', 'dia_media');
ok(rg.ok && rg.groups.length === 2 && rg.n === 60 && rg.p < 0.001 && rg.higher === 'Dias sem atividade registrada' && rg.effect.ci, 'dias com × sem atividade: grupos, n, p e IC');
ok(/Dias sem atividade registrada/.test(C.crText(rg)) && /mediana/.test(C.crText(rg)), 'texto descreve as medianas');
ok(rg.groups.every(g => g.points.length === g.n && g.points[0].rec.length), 'grupos preservam os registros individuais');
const few = gen(8, (d, mk) => { for (const t of ['08:00', '12:00', '16:00']) mk(t, 100 + d, d < 2 ? { actMin: 30 } : {}); });
ok(!C.crAnalyze(C.crModel(few, {}), 'dia', 'dia_ativ', 'dia_media').ok, 'poucos dias por grupo: comparação recusada');

/* 8. linguagem: sem causa, sem dose */
const bad = /provoc|causa(m|ram)? |faz(em)? (subir|cair|aumentar)|resposta à insulina|aumente|reduza|dose ideal/i, texts = [];
pos.auto.list.filter(r => r.ok).forEach(r => { texts.push(C.crText(r), C.crHeadline(r), r.methodWhy || '', r.meaning || '', ...r.flags.map(f => f.t)); });
ok(texts.length > 5 && texts.every(t => !bad.test(t)), 'textos gerados não usam linguagem causal nem recomendam dose');
const ri = C.crAnalyze(mins, 'insulina', 'ins_units', 'delta'); ok(!ri.ok || ri.noDose === true, 'análises de insulina carregam o aviso de que não são resposta nem dose');

/* 9. matriz e repetições */
const mx = C.crMatrix(pos, 'refeicao'); ok(mx && mx.vars.length >= 4 && mx.cells.every(r => r.length === mx.vars.length) && mx.cells[0][0].self, 'matriz quadrada com diagonal');
const ip = mx.vars.findIndex(v => v.id === 'post'), id = mx.vars.findIndex(v => v.id === 'delta'); ok(mx.cells[ip][id].na === 'calc', 'matriz marca pares calculados um a partir do outro');
ok(typeof pos.repeats.ok === 'boolean', 'refeições repetidas avaliadas');
ok(C.crDedupe([{ topic: 'a' }, { topic: 'b' }], ['a']).keep.length === 1 && C.crDedupe([{ topic: 'a' }], ['a']).dupes.length === 1, 'deduplicação com outras áreas');

console.log(fail ? `test60: ${fail} falha(s) de ${n}` : `test60 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
