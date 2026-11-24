/* Meu tratamento: núcleo (cartões a partir do tratamento, ligação dos registros, resumo, exportação, comparação) */
const T = require('../src/tratamento-core.js');
const IR = require('../src/insrem-core.js'); global.irRoleType = IR.irRoleType; global.irMealGuess = IR.irMealGuess; global.ocDoseKind = require('../src/alertstate-core.js').ocDoseKind;
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHOU ') + m); if (!c) fail++; };
const mk = (d, t) => new Date(d + 'T' + t + ':00').getTime();
const day = '2026-11-23'; // segunda
const plan = { types: ['insulina', 'remedios'], insulin: [
  { id: 'a', name: 'Basal X', role: 'basal', times: ['22:00'], days: [], alarm: false },
  { id: 'b', name: 'Rápida A', role: 'rapida', times: ['12:00', '19:00'], days: [], alarm: false },
  { id: 'c', name: 'Rápida B', role: 'rapida', times: ['12:00'], days: [], alarm: false },
  { id: 'd', name: 'Só terça', role: 'rapida', times: ['08:00'], days: [2], alarm: false },
  { id: 'e', name: 'Suspensa', role: 'rapida', times: ['09:00'], days: [], paused: true },
  { id: 'f', name: 'Modelo', role: 'rapida', times: [], days: [], sug: true },
  { id: 'g', name: 'Horário padrão', role: 'rapida', times: ['08:00'], days: [], guess: ['08:00'] },
  { id: 'h', name: 'Sob demanda', role: 'outra', times: [], days: [] } ], meds: [{ id: 'm', name: 'Med', times: ['08:00'], days: [], alarm: true }], checks: [], updated: mk(day, '10:00'), log: [{ ts: mk(day, '10:00'), txt: 'Adicionou: Basal X' }] };
const sl = T.trSlots(plan, day, mk), names = sl.map(s => s.it.name + '@' + s.time);
ok(names.includes('Basal X@22:00') && names.includes('Rápida A@12:00') && names.includes('Rápida A@19:00') && names.includes('Rápida B@12:00'), 'cartões vêm do tratamento cadastrado (insulinas, horários)');
ok(!names.some(n => n.startsWith('Só terça')), 'dia da semana respeitado (item de terça não aparece na segunda)');
ok(!names.some(n => /Suspensa|Modelo/.test(n)), 'suspensa e "a confirmar" não geram cartão');
ok(!names.some(n => n.startsWith('Horário padrão@08:00')) && names.includes('Horário padrão@'), 'horário padrão (a confirmar) não vira horário prescrito');
ok(sl.find(s => s.it.id === 'h').onDemand, 'insulina sem horário vira cartão "quando necessário"');
ok(T.trSlots(plan, '2026-11-24', mk).some(s => s.it.id === 'd'), 'item de terça aparece na terça');
/* registros: com insId, duas rápidas no mesmo horário não se confundem */
const logs = [{ id: 1, kind: 'lunch', ts: mk(day, '12:05'), date: day, insId: 'b', units: 6 }, { id: 2, kind: 'lunch', ts: mk(day, '12:10'), date: day, insId: 'c', units: 4 }];
const as = T.trAssign(sl, day, logs, mk);
ok(as['i:b@12:00'].length === 1 && as['i:b@12:00'][0].id === 1 && as['i:c@12:00'][0].id === 2, 'duas insulinas no mesmo horário/categoria ficam separadas pelo insId');
ok(!as['i:b@19:00'].length, 'horário sem registro continua pendente');
/* registro antigo (sem insId): só entra quando não há ambiguidade */
const old = [{ id: 9, kind: 'basal', ts: mk(day, '22:05'), date: day }, { id: 10, kind: 'lunch', ts: mk(day, '12:05'), date: day }];
const as2 = T.trAssign(sl, day, old, mk);
ok(as2['i:a@22:00'].length === 1, 'registro antigo de basal liga à única basal cadastrada');
ok(!as2['i:b@12:00'].length && !as2['i:c@12:00'].length, 'registro antigo de almoço NÃO é atribuído a uma das duas rápidas (ambíguo)');
/* mesmo insulina em 2 horários: slot explícito e mais próximo */
const l3 = [{ id: 20, kind: 'dinner', ts: mk(day, '19:30'), date: day, insId: 'b' }];
const as3 = T.trAssign(sl.filter(s => s.it.id === 'b'), day, l3, mk);
ok(as3['i:b@19:00'].length === 1 && !as3['i:b@12:00'].length, 'registro sem slot vai ao horário mais próximo');
ok(T.trLastUnits(plan.insulin[1], [{ insId: 'b', units: 28 }], false, 'lunch') === 28 && T.trLastUnits(plan.insulin[1], [{ insId: 'c', units: 9 }], false, 'lunch') === null, 'última quantidade vem só da própria insulina (não é sugestão)');
/* resumo */
const r = T.trResume(plan, mk(day, '10:00'), mk);
ok(r.ins === 8 && r.meds === 1 && r.paused === 1 && r.tbd === 2 && r.upd === mk(day, '10:00'), 'resumo reflete o cadastro real');
ok(r.next.length === 3 && r.next[0].t === '12:00', 'próximos horários só de itens ativos e confirmados');
/* exportação */
const tx = T.trExportText(plan, [{ name: 'Esq 1', start: '2026-01-01', end: '2026-06-01', basalInsulin: 'Basal X' }], {});
ok(/Basal X/.test(tx) && /\[SUSPENSO\]/.test(tx) && /HISTÓRICO DE ALTERAÇÕES/.test(tx) && /ESQUEMAS CADASTRADOS/.test(tx) && !/NaN|undefined/.test(tx), 'exportação organizada e sem dados inventados');
/* comparação */
const c = T.trCompare([{ sc: { id: 1, name: 'A' }, n: 10, days: 5, mean: 150, hypo: 1, hyper: 3 }, { sc: { id: 2, name: 'B' }, n: 0, days: 30, mean: NaN, hypo: 0, hyper: 0 }]);
ok(c[0].few && c[0].short && c[0].perDay === 2 && c[0].hypoPct === 10, 'comparação sinaliza poucas medições/período curto');
ok(c[1].mean === null && c[1].hypoPct === null, 'sem medições: não inventa média nem percentual');
console.log(fail ? 'FALHAS: ' + fail : 'tudo certo'); process.exit(fail ? 1 : 0);
