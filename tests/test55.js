/* Episódio de hipoglicemia persistente: regras puras (hypoepisode-core.js) */
const c = require('../src/hypoepisode-core.js'); let f = 0, n = 0;
const ok = (m, v) => { n++; if (!v) { f++; console.log('FALHA', m); } };
const NOW = Date.now(), R = (id, g, min) => ({ id, glucose: g, ts: NOW - min * 60e3, date: '2026-01-01', time: '10:00' });
let s = c.heEmpty(), r;
r = c.heRecord(s, R('a', 65, 5), NOW, () => 'E1'); s = r.state; ok('65 inicia', r.kind === 'start' && s.active.id === 'E1' && s.active.startGlucose === 65);
r = c.heRecord(s, R('b', 60, 2), NOW, () => 'E2'); s = r.state; ok('<70 associa, sem duplicar', r.kind === 'attach' && s.active.id === 'E1' && s.active.ms.length === 2 && !s.history.length);
const copy = JSON.stringify(s); r = c.heRecord(s, R('b', 60, 2), NOW); ok('mesma medição = update, sem duplicar', r.kind === 'update' && r.state.active.ms.length === 2);
const s2 = c.heRecord(s, R('c', 70, 1), NOW); ok('70 pede recuperação e não encerra', s2.kind === 'recovery' && !!s2.state.active && s2.state.active.ms.length === 3);
ok('80 idem', c.heRecord(s, R('d', 80, 1), NOW).kind === 'recovery');
ok('estado original imutável', JSON.stringify(s) === copy);
let k = c.heKeep(s2.state, NOW); ok('manter acompanhamento mantém ativo', !!k.active && k.active.events.some(e => e.type === 'keep'));
const rec = c.heClose(k, 'recovery', NOW); ok('recuperação encerra e vai ao histórico', !rec.active && rec.history.length === 1 && rec.history[0].closeReason === 'recovery' && rec.history[0].ms.length === 3);
const man = c.heClose(s, 'manual', NOW); ok('descarte manual identificado', man.history[0].closeReason === 'manual' && man.history[0].closeReason !== 'recovery' && !man.active);
ok('motivo inválido ignorado', c.heClose(s, 'x', NOW) === s);
ok('>=70 sem episódio não abre', c.heRecord(c.heEmpty(), R('e', 90, 1), NOW).kind === 'none');
ok('<70 antigo (>4h) não abre', c.heRecord(c.heEmpty(), R('f', 50, 300), NOW).kind === 'none');
ok('noTime/exemplo ignorados', c.heRecord(c.heEmpty(), { ...R('g', 50, 1), noTime: true }, NOW).kind === 'none' && c.heRecord(c.heEmpty(), { ...R('g', 50, 1), source: 'exemplo' }, NOW).kind === 'none');
ok('novo episódio após encerrar', c.heRecord(rec, R('h', 55, 0), NOW, () => 'E3').state.active.id === 'E3');
ok('medição anterior ao início não entra', c.heRecord(s, R('i', 60, 60), NOW).kind === 'none');
// persistência (ida e volta JSON) e integridade
const back = c.heClean(JSON.parse(JSON.stringify(rec)));
ok('ida e volta preserva histórico', back.history.length === 1 && back.history[0].ms.length === 3 && back.history[0].closeReason === 'recovery' && back.history[0].ms[0].glucose === 65 && back.history[0].ms[0].time === '10:00');
ok('ida e volta ativo', c.heClean(JSON.parse(JSON.stringify(s))).active.ms.length === 2);
ok('lixo vira vazio', c.heClean('x').active === null && c.heClean({ active: { id: 1 } }).active === null);
ok('mais novo vence', c.heNewer({ ts: 1 }, { ts: 2 }).ts === 2 && c.heNewer({ ts: 3 }, { ts: 2 }).ts === 3);
// reconciliação (registro apagado)
ok('apagar medição preserva as demais', c.heReconcile(s, new Set(['a'])).active.ms.length === 1);
ok('apagar tudo remove ativo', c.heReconcile(s, new Set()).active === null);
ok('sem mudança = mesma referência', c.heReconcile(s, new Set(['a', 'b'])) === s);
ok('encerrado não é alterado pela reconciliação', c.heReconcile(rec, new Set()).history.length === 1);
// migração
const d = { ep: [R('a', 62, 20), R('b', 58, 5)] }; const m = c.heAdopt(c.heEmpty(), d, () => 'M');
ok('adota episódio em andamento (1x)', m.active.ms.length === 2 && m.migrated && c.heAdopt(m, d).active.id === 'M');
ok('não adota se já havia recuperado', c.heAdopt(c.heEmpty(), { ep: [R('a', 62, 20), R('b', 90, 5)] }).active === null);
ok('busca por medição', c.heByRec(rec, 'b').id === 'E1' && c.heFind(rec, 'E1').state === 'closed');
console.log(n - f + '/' + n + ' ok'); process.exit(f ? 1 : 0);
