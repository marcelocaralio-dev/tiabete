// test55: Etapa 05 (inteligência contextual) — lógica pura de src/contexto-core.js com dados sintéticos de teste (nunca entram no app).
process.removeAllListeners('warning');
const C = require('../src/contexto-core.js'), L = require('../src/logic.js');
let n = 0, fail = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const NOW = L.mkTs('2026-11-25', '20:00'); let id = 0;
const rec = (date, time, glucose, x) => Object.assign({ id: 'r' + (++id), date, time, ts: L.mkTs(date, time), glucose }, x || {});
const dAgo = k => L.isoDate(new Date(L.addDays(NOW, -k)));
// ---- sem registros e com poucos
let r = C.cxInsights([], { now: NOW }); ok(!r.enough && r.list.length === 0 && /Não há registros/.test(r.why), 'sem registros explica e não inventa');
r = C.cxInsights([rec(dAgo(1), '08:00', 100), rec(dAgo(2), '08:00', 300)], { now: NOW }); ok(!r.enough && r.list.length === 0 && /ao menos 10/.test(r.why), 'poucos registros: dados insuficientes');
ok(C.cxInsights([rec('2026-01-01', '08:00', 100)], { now: NOW }).why.includes('Não há registros'), 'registro antigo fora da janela não vira insight');
// ---- exemplos, duplicatas, inválidos
const ex = [rec(dAgo(1), '08:00', 100, { source: 'exemplo' }), rec(dAgo(1), '09:00', 5), rec(dAgo(1), '10:00', 120), rec(dAgo(1), '10:00', 120), { id: 'x', glucose: 'a' }, rec(dAgo(-5), '10:00', 120)];
const cl = C.cxClean(ex, NOW); ok(cl.recs.length === 1 && cl.dup === 1, 'limpa exemplos, valor impossível, duplicata exata e registro do futuro');
// ---- elevação nos 14 dias x 14 anteriores (+ período da manhã mais alto)
const mkSet = (fn) => { const a = []; for (let k = 0; k < 28; k++) { [['07:00', 'jejum'], ['13:30', 'depois'], ['21:00', 'depois']].forEach(([t, c], i) => a.push(rec(dAgo(k), t, fn(k, i), { context: c, meal: i === 1 ? 'almoco' : i === 2 ? 'jantar' : undefined }))); } return a; };
const up = mkSet((k, i) => (k < 14 ? 150 : 110) + (i === 0 ? 30 : 0) + (k % 3) * 2);
r = C.cxInsights(up, { now: NOW, days: 14 });
ok(r.enough && r.list.some(x => x.kind === 'compare' && /maior/.test(x.text)), 'média maior que o período anterior');
ok(r.list.every(x => x.period && x.n > 0 && x.crit && x.limits && x.recIds.length), 'todo insight traz período, n, critério, limites e registros');
ok(r.list.some(x => x.kind === 'period' && /manhã/.test(x.text)), 'período da manhã mais elevado');
ok(!r.list.some(x => /causa|devido|por causa|provoc/i.test(x.text)), 'sem linguagem causal');
const dn = mkSet((k, i) => (k < 14 ? 100 : 150) + (k % 3));
r = C.cxInsights(dn, { now: NOW, days: 14 }); ok(r.list.some(x => x.kind === 'compare' && /menor/.test(x.text)), 'média menor que o período anterior');
// ---- tendência
const tr = []; for (let k = 0; k < 28; k++) [0, 1].forEach(i => tr.push(rec(dAgo(k), i ? '19:00' : '08:00', 220 - k * 4 + i * 3)));
r = C.cxInsights(tr, { now: NOW, days: 14 }); ok(r.list.some(x => x.kind === 'trend' && /elevação/.test(x.text)), 'tendência de elevação (dia mais recente tem valores maiores)');
const tr2 = tr.map(x => Object.assign({}, x, { glucose: 400 - x.glucose })); r = C.cxInsights(tr2, { now: NOW, days: 14 }); ok(r.list.some(x => x.kind === 'trend' && /redução/.test(x.text)), 'tendência de redução');
ok(C.cxInsights(tr, { now: NOW, days: 14, kinds: { trend: false } }).list.every(x => x.kind !== 'trend'), 'categoria desligada não gera insight');
// ---- baixas: sempre com contagem e linguagem sem alarme
const lows = up.map(x => Object.assign({}, x)); lows.filter(x => x.ts > NOW - 5 * 864e5).slice(0, 4).forEach(x => x.glucose = 62);
r = C.cxInsights(lows, { now: NOW, days: 7 }); const lw = r.list.find(x => x.kind === 'target' && x.tone === 'low');
ok(lw && /4 medições abaixo de 70/.test(lw.text) && /profissional de saúde/.test(lw.text) && !/perigo|grave|urgente|!/i.test(lw.text), 'baixas: contagem exata, orienta profissional, sem alarmismo');
ok(lw && lw.recIds.length === 4, 'baixas: ids dos registros que sustentam');
// ---- ausência de registros não é melhora
const gap = up.filter(x => x.ts < NOW - 14 * 864e5); r = C.cxInsights(gap, { now: NOW, days: 14 }); ok(!r.enough && r.list.length === 0, 'ausência de registros recentes não produz melhora/piora');
// ---- padrões
const pt = []; for (let k = 0; k < 30; k++) { pt.push(rec(dAgo(k), '12:00', 100, { context: 'antes', meal: 'almoco' })); pt.push(rec(dAgo(k), '14:00', 190 + (k % 4), { context: 'depois', meal: 'almoco' })); pt.push(rec(dAgo(k), '19:00', 100, { context: 'antes', meal: 'jantar' })); pt.push(rec(dAgo(k), '21:00', 120 + (k % 3), { context: 'depois', meal: 'jantar' })); }
let p = C.cxPatterns(pt, [], { now: NOW }); const pm = p.list.find(x => x.id === 'p-refeicao-almoco');
ok(p.enough && pm && /depois do almoço costumam apresentar valores mais elevados/.test(pm.text) && pm.recIds.length >= 25 && /não indica que um fator causou/.test(pm.limits), 'padrão por refeição, com n, ids e sem causalidade');
ok(p.list.some(x => x.id === 'p-antesdepois-almoco' && /mediano/.test(x.text)), 'antes/depois usa pares e informa o intervalo mediano');
ok(p.list.some(x => x.id === 'p-refeicao-jantar' && /mais baixos/.test(x.text)) && !p.list.some(x => x.id === 'p-refeicao-cafe'), 'direção correta (jantar mais baixo) e sem padrão sem dados do café');
p = C.cxPatterns(pt.slice(0, 12), [], { now: NOW }); ok(!p.enough && p.list.length === 0, 'amostra pequena: sem padrões');
const iso = pt.map(x => Object.assign({}, x)); iso.filter(x => x.meal === 'almoco' && x.context === 'depois').forEach((x, i) => { if (i > 1) x.glucose = 105; });
p = C.cxPatterns(iso, [], { now: NOW }); ok(!p.list.some(x => x.id === 'p-refeicao-almoco'), 'acontecimento isolado (2 valores) não vira padrão');
ok(C.cxPatterns(pt, [], { now: NOW, kinds: { meal: false } }).list.every(x => x.kind !== 'meal'), 'categoria de padrões desligada');
// atividade
const ac = pt.slice(); for (let k = 0; k < 8; k++) { ac.push(rec(dAgo(k), '16:00', 150, { actMin: 30 })); ac.push(rec(dAgo(k), '17:30', 100)); }
p = C.cxPatterns(ac, [], { now: NOW }); ok(p.list.some(x => x.kind === 'activity' && /−/.test(x.text)), 'atividade: variação depois (descritiva)');
// ---- resumo
let s = C.cxSummary(up, { now: NOW, range: '7' }); ok(s.ok && s.enough && s.A.n === s.recIds.length && s.B && s.cmp, 'resumo 7 dias com comparação');
ok(C.cxSummary(up, { now: NOW, range: '24h' }).n === 3, 'resumo de 24 horas');
s = C.cxSummary(up, { now: NOW, range: 'custom', from: dAgo(9), to: dAgo(3) }); ok(s.ok && s.n === 15 + 6 && s.prevN > 0, 'período personalizado e período anterior de mesma duração');
ok(!C.cxSummary(up, { now: NOW, range: 'custom', from: dAgo(3), to: dAgo(9) }).ok, 'datas invertidas são recusadas');
s = C.cxSummary([], { now: NOW, range: '30' }); ok(s.ok && !s.enough && /Ausência/.test(s.why), 'resumo sem registros');
s = C.cxSummary([rec(dAgo(1), '08:00', 100), rec(dAgo(1), '09:00', 300)], { now: NOW, range: '7' }); ok(!s.enough && /apenas 2/.test(s.why), 'resumo com 2 medições não apresenta média');
const A = require('../src/analise-core.js'); s = C.cxSummary(up, { now: NOW, range: '14' }); const base = L.inRange(C.cxClean(up, NOW).recs, s.curR[0], s.curR[1]);
ok(Math.abs(s.A.mean - L.stats(base).mean) < 1e-9 && s.A.n === A.anSummary(base).n, 'resumo usa os mesmos cálculos de logic/analise (sem divergência)');
// ---- assistência por tela
['painel', 'historico', 'analise', 'metricas', 'bolus'].forEach(rt => { const a = C.cxAssist(rt, up.concat(pt), { now: NOW }); ok(a.length >= 1 && a.every(x => x.id && x.text && x.route === rt), 'assistência em ' + rt); });
ok(/pouco para resumir/.test(C.cxAssist('painel', [], { now: NOW })[0].text), 'assistência da tela inicial sem dados');
ok(C.cxAssist('historico', up, { now: NOW })[0].recIds.length > 0, 'assistência do histórico aponta os registros');
// ---- sugestões
const cand = (o) => C.cxCandidates(Object.assign({ now: NOW, records: up, route: 'painel', usage: {}, state: {} }, o));
ok(cand().some(x => x.id === 'ver-analise'), 'sugere a Análise quando há dados e ela nunca foi aberta');
ok(!cand({ usage: { analise: 3 } }).some(x => x.id === 'ver-analise'), 'não sugere o que já usa');
ok(!cand({ allowed: f => f !== 'analise' }).some(x => x.id === 'ver-analise'), 'não sugere recurso indisponível no plano');
ok(!cand({ state: { dis: { 'ver-analise': NOW + 1000 } } }).some(x => x.id === 'ver-analise'), 'respeita sugestão dispensada');
ok(!cand({ cats: { discover: false, data: true, report: true } }).some(x => x.cat === 'discover'), 'respeita categorias desligadas');
ok(!cand({ records: [] }).length, 'sem dados não há sugestão');
ok(!cand({ state: { rej: { discover: 3 } } }).some(x => x.cat === 'discover'), 'aprende com categoria sempre dispensada');
// ---- lembretes
const old = []; for (let k = 4; k < 18; k++) old.push(rec(dAgo(k), '08:00', 110));
let rm = C.cxReminders({ now: NOW, records: old, cfg: { routine: true, gap: 48 }, route: 'painel' }); ok(rm.list.length === 1 && rm.list[0].kind === 'routine' && /não indica quando medir|só um aviso/.test(rm.list[0].text), 'pausa na rotina');
ok(C.cxReminders({ now: NOW, records: old, cfg: { routine: false }, route: 'painel' }).list.length === 0, 'categoria desligada');
ok(C.cxReminders({ now: NOW, records: old.slice(0, 3).concat([rec(dAgo(0), '08:00', 100)]), cfg: { routine: true, gap: 48 }, route: 'painel' }).list.length === 0, 'sem rotina estabelecida ou com registro recente não há lembrete');
ok(C.cxReminders({ now: NOW, records: old, cfg: { routine: true, gap: 48 }, route: 'painel', quiet: { on: true, from: '19:00', to: '07:00' } }).quiet, 'respeita horário silencioso');
const key = rm.list[0].key; ok(C.cxReminders({ now: NOW, records: old, cfg: { routine: true, gap: 48 }, route: 'painel', state: { rdis: { [key]: NOW + 1e6 } } }).list.length === 0, 'lembrete dispensado não repete (sem duplicar)');
ok(C.cxReminders({ now: NOW, records: old, cfg: { routine: true, gap: 72 }, route: 'painel' }).list.length === 1 && C.cxReminders({ now: NOW, records: old, cfg: { routine: true, gap: 72 }, route: 'painel' }).list[0].key === key, 'mesma pausa mantém a mesma chave');
const hb = []; for (let k = 1; k < 16; k++) hb.push(rec(dAgo(k), '08:10', 110)); hb.push(rec(dAgo(0), '09:00', 110, {})); hb.pop();
rm = C.cxReminders({ now: L.mkTs('2026-11-25', '11:00'), records: hb, cfg: { habit: true, routine: false }, route: 'painel' }); ok(rm.list.some(x => x.kind === 'habit' && /por volta das 08h/.test(x.text)), 'horário habitual: só informa, sem presumir medição');
rm = C.cxReminders({ now: NOW, records: old, cfg: { report: true, routine: false }, route: 'relatorios' }); ok(rm.list.some(x => x.kind === 'report'), 'conferência antes do relatório');
// nada altera os dados
const snap = JSON.stringify(up); C.cxInsights(up, { now: NOW }); C.cxPatterns(up, [], { now: NOW }); C.cxSummary(up, { now: NOW, range: '30' }); ok(JSON.stringify(up) === snap, 'a lógica não altera registros');
console.log(`test55: ${n - fail}/${n} ok`); process.exit(fail ? 1 : 0);
