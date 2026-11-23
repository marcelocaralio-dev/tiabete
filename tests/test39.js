// test39: núcleo de ocorrências e estados dos alertas (0.38.0). Puro, sem navegador.
const fs = require('fs'), vm = require('vm'), path = require('path'), L = require('../src/logic.js');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const ctx = vm.createContext({ ...L, module: { exports: {} }, console });
const C = {}; for (const f of ['alertstate-core.js', 'insrem-core.js']) { ctx.module.exports = {}; vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', f), 'utf8'), ctx); Object.assign(C, ctx.module.exports); }
const mk = () => 'id' + Math.random().toString(36).slice(2, 6);
// máquina de estados
const it = { st: 'pendente' };
ok(C.ocMove(it, 'exibido') && it.st === 'exibido', 'pendente → exibido');
ok(C.ocMove(it, 'concluido', 'confirmado') && it.st === 'concluido', 'exibido → concluído');
ok(!C.ocMove(it, 'pendente', 'x') && it.st === 'concluido', 'concluído não volta a pendente');
ok(!C.ocMove({ st: 'cancelado' }, 'pendente') && !C.ocMove({ st: 'desativado' }, 'exibido') && !C.ocMove({ st: 'expirado' }, 'pendente'), 'cancelado/desativado/expirado não reaparecem');
const u = { st: 'concluido', why: 'registro' }; ok(C.ocMove(u, 'pendente', 'desfeito'), 'única volta: registro que concluía foi apagado');
ok(C.ocCan('exibido', 'programado') && C.ocCan('programado', 'pendente'), 'adiar e voltar são permitidos');
// vínculo com histórico
const day = '2026-11-15', at = L.mkTs(day, '22:00'), occ = (k, t, kind, name) => ({ key: k, day, at: L.mkTs(day, t), kind, name });
const lg = (id, t, kind, extra) => ({ id, kind, ts: L.mkTs(day, t), date: day, ...extra });
let m = C.ocMatchLogs([occ('a', '22:00', 'basal')], [lg('l1', '21:30', 'basal')]); ok(m.a && m.a.id === 'l1', 'basal 30 min antes resolve a ocorrência');
m = C.ocMatchLogs([occ('a', '22:00', 'basal')], [lg('l1', '12:00', 'basal')]); ok(!m.a, 'basal de 10 h antes NÃO resolve');
m = C.ocMatchLogs([occ('a', '08:00', 'basal'), occ('b', '20:00', 'basal')], [lg('l1', '20:05', 'basal')]); ok(!m.a && m.b, 'duas basais no dia: o registro vai só para a ocorrência mais próxima');
m = C.ocMatchLogs([occ('a', '08:00', 'basal'), occ('b', '20:00', 'basal')], [lg('l1', '08:05', 'basal'), lg('l2', '20:05', 'basal')]); ok(m.a.id === 'l1' && m.b.id === 'l2', 'duas basais, dois registros: cada um na sua');
m = C.ocMatchLogs([occ('a', '12:00', 'lunch')], [lg('l1', '14:30', 'lunch')]); ok(m.a, 'rápida da refeição: qualquer registro do dia vale');
m = C.ocMatchLogs([occ('a', '22:00', 'basal')], [lg('l1', '22:00', 'basal', { occ: 'outra' })]); ok(!m.a, 'registro já ligado a outra ocorrência não é reaproveitado');
m = C.ocMatchLogs([occ('a', '22:00', 'basal')], [lg('l1', '03:00', 'basal', { occ: 'a' })]); ok(m.a, 'vínculo explícito sempre vale');
m = C.ocMatchLogs([{ ...occ('a', '22:00', 'basal'), day: '2026-11-16', at: L.mkTs('2026-11-16', '22:00') }], [lg('l1', '22:05', 'basal')]); ok(!m.a, 'registro de ontem não resolve a ocorrência de amanhã');
m = C.ocMatchLogs([occ('a', '10:00', 'extra', 'Fiasp')], [lg('l1', '10:00', 'extra', { name: 'Novorapid' })]); ok(!m.a, 'outra insulina com nome diferente não resolve');
// irDue com histórico, e identidade por horário
const P = { types: ['insulina'], insulin: [{ id: 'b1', name: 'Lantus', role: 'basal', times: ['22:00'], days: [], alarm: true }], meds: [], checks: [], pump: {} };
const R = C.irClean({ on: true, adopted: ['b1'], items: [{ id: 'r1', itemId: 'b1', type: 'basal', time: '22:00', src: '22:00', on: true, name: 'Lantus' }] }, mk), t = L.mkTs(day, '22:10');
ok(C.irDue(R, P, t).length === 1 && C.irDue(R, P, t, []).length === 1, 'sem registro: pendente');
const logs = [lg('l1', '21:50', 'basal')]; ok(C.irDue(R, P, t, logs).length === 0, 'com registro feito em Meu tratamento: não pede mais');
ok(C.irOccStatus(R, P, 'ir:' + day + '|r1@22:00', t, logs).why === 'registro', 'estado: Concluído por registro');
ok(C.irOccStatus(R, P, 'ir:' + day + '|r1@22:00', t, []).st === 'pendente', 'estado: Pendente');
ok(C.irOccStatus(R, P, 'ir:' + day + '|r1@22:00', L.mkTs(day, '23:00') + 3 * 3600e3, []).st === 'expirado', 'estado: Expirado após a janela');
ok(C.irOccStatus(R, P, 'ir:' + day + '|r1@21:00', t, []).st === 'cancelado', 'horário antigo: Cancelado');
R.items[0].on = false; ok(C.irOccStatus(R, P, 'ir:' + day + '|r1@22:00', t, []).st === 'desativado', 'desligado: Desativado');
R.items[0].on = true; R.state[day + '|r1@22:00'] = 'ignored'; ok(C.irOccStatus(R, P, 'ir:' + day + '|r1@22:00', t, []).st === 'ignorado', 'estado: Ignorado');
R.state = {}; ok(C.irDue(R, P, L.mkTs('2026-11-16', '22:05'), logs).length === 1, 'registro de ontem não confunde a ocorrência de hoje');
console.log(fail ? 'test39 FALHOU (' + fail + ')' : 'test39 ok (' + n + ' verificações)'); process.exit(fail ? 1 : 0);
