// Lembretes de insulina (PROMPT 22): núcleo puro. Agenda, ids, reconciliação com o tratamento, avisos e textos.
const L = require('../src/logic.js'), vm = require('vm'), fs = require('fs');
const ctx = vm.createContext({ pad: n => String(n).padStart(2, '0'), ...L, module: { exports: {} }, console });
vm.runInContext(fs.readFileSync(__dirname + '/../src/insrem-core.js', 'utf8'), ctx);
const C = ctx.module.exports; let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FALHOU:', m); } else console.log('ok  ', m); };
let n = 0; const mk = () => 'r' + (++n);
const plan = (ins, types) => ({ types: types || ['insulina'], insulin: ins, meds: [], checks: [], pump: {} });
const pit = (id, name, role, times, o = {}) => ({ id, name, role, times, days: [], off: [], dose: '', notes: '', alarm: true, ...o });
const NOW = new Date(2026, 10, 15, 21, 0, 0).getTime();            // domingo 15/11/2026 21:00 (horário local)
const mkR = o => C.irItem({ id: mk(), itemId: 'b1', type: 'basal', time: '22:00', ...o }, mk);

// 1) limpeza e validação
const c = C.irClean({ items: [{ id: 'a', itemId: 'x', type: 'xx', time: '99:00', days: [1, 1, 9, 'q'], meal: 'cafe' }], state: { '2026-11-15|a': 'done', lixo: 1, '2026-11-15|b': { snooze: 5 } } }, mk);
ok(c.items[0].type === 'rapida' && c.items[0].time === '08:00', 'tipo e horário inválidos viram valores seguros');
ok(JSON.stringify(c.items[0].days) === '[1]', 'dias inválidos e repetidos são descartados');
ok(c.state['2026-11-15|a@08:00'] === 'done' && !c.state['2026-11-15|a'] && c.state['2026-11-15|b'].snooze === 5 && !c.state.lixo, 'estado: só chaves válidas; chave antiga (dia|id) passa a valer para o horário atual do lembrete');
ok(C.irDays([0, 1, 2, 3, 4, 5, 6]).length === 0, 'sete dias = todos os dias (lista vazia)');

// 2) próximo disparo, dias da semana
const daily = mkR({}), wk = mkR({ days: [1, 2, 3, 4, 5], time: '07:00' });
ok(new Date(C.irNextAt(daily, NOW)).getHours() === 22 && L.isoDate(new Date(C.irNextAt(daily, NOW))) === '2026-11-15', 'diário às 22h: hoje');
ok(L.isoDate(new Date(C.irNextAt(wk, NOW))) === '2026-11-16', 'dias úteis às 7h, domingo 21h: segunda');
const sat = mkR({ days: [6], time: '08:00' }); ok(L.isoDate(new Date(C.irNextAt(sat, NOW))) === '2026-11-21', 'só sábado: próximo sábado');
ok(C.irNextAt(mkR({ time: '21:00' }), NOW) > NOW && L.isoDate(new Date(C.irNextAt(mkR({ time: '21:00' }), NOW))) === '2026-11-16', 'horário igual ao agora vai para amanhã');

// 3) ids estáveis, únicos e na faixa própria
const ir = C.irClean({ items: [] }, mk); for (let i = 0; i < 30; i++) ir.items.push(mkR({ id: 'id' + i, time: '08:00' }));
const m1 = C.irIdMap(ir), m2 = C.irIdMap(ir), vals = Object.values(m1);
ok(JSON.stringify(m1) === JSON.stringify(m2), 'ids determinísticos');
ok(new Set(vals).size === vals.length && vals.length === 30 * 9, 'ids únicos (30 lembretes x 9 espaços)');
ok(vals.every(v => v >= C.IR_ID_MIN && v < C.IR_ID_MAX && v < 2 ** 31), 'ids dentro da faixa própria (não colidem com as outras notificações)');

// 4) agenda nativa: sem duplicar, respeitando dias, ativação e silêncio
const p1 = plan([pit('b1', 'Lantus', 'basal', ['22:00']), pit('r1', 'Humalog', 'rapida', ['12:00'])]);
const I = C.irClean({ on: true, items: [mkR({ id: 'x1', itemId: 'b1' }), C.irItem({ id: 'x2', itemId: 'r1', type: 'rapida', meal: 'almoco', time: '12:00', days: [1, 3] }, mk)] }, mk);
const pl = C.irNotifPlan(I, p1, {});
ok(pl.length === 3, 'diário = 1 agendamento; seg+qua = 2');
ok(pl.filter(x => x.rid === 'x2').map(x => x.weekday).join() === '2,4', 'weekday do Capacitor: 1 = domingo (seg=2, qua=4)');
ok(new Set(pl.map(x => x.nid)).size === 3, 'sem ids repetidos');
ok(C.irNotifPlan({ ...I, on: false }, p1, {}).length === 0, 'chave geral desligada: nada agendado');
I.items[0].on = false; ok(C.irNotifPlan(I, p1, {}).length === 2, 'lembrete desligado não agenda'); I.items[0].on = true;
ok(C.irNotifPlan(I, p1, { quiet: t => t === '22:00' }).length === 2, 'silêncio noturno pula o horário');
p1.insulin[0].alarm = false; ok(C.irStatusOf(I.items[0], p1) === 'paused' && C.irNotifPlan(I, p1, {}).length === 2, 'insulina com alarme desligado no tratamento: não toca'); p1.insulin[0].alarm = true;
ok(C.irNotifPlan(I, { ...p1, types: [] }, {}).length === 0, 'tipo "insulina" desmarcado: nada toca');

// 5) textos
const tb = C.irText(I.items[0], 'Lantus'), tr = C.irText(I.items[1], 'Humalog');
ok(tb.title === 'Hora da insulina basal' && tb.largeBody.startsWith('Está na hora de conferir sua aplicação programada.'), 'texto da basal');
ok(tr.title === 'Hora da insulina rápida' && tr.largeBody.startsWith('Lembrete da aplicação programada para esta refeição.'), 'texto da rápida');
ok(/Lantus/.test(tb.body) && /Basal/.test(tb.body) && /22:00/.test(tb.body), 'notificação traz nome, tipo e horário');
ok(/Humalog/.test(tr.body) && /Almoço/.test(tr.body) && /12:00/.test(tr.body), 'rápida traz refeição');
ok(!/\bUi\b|unidade|dose/i.test(tb.body + tb.largeBody + tr.body + tr.largeBody), 'o texto não menciona dose nem unidades');

// 6) reconciliação com Meu tratamento
{
  const P = plan([pit('b1', 'Lantus', 'basal', ['22:00'])]), R = C.irClean({ adopted: ['b1'], items: [mkR({ id: 'q1', itemId: 'b1', src: '22:00', time: '22:00' })] }, mk);
  P.insulin[0].times = ['21:30']; let r = C.irReconcile(R, P);
  ok(r.changed && R.items[0].time === '21:30' && R.items[0].src === '21:30' && R.items[0].on, 'horário do tratamento mudou (1 para 1): lembrete acompanha');
  ok(P.insulin[0].times.join() === '21:30' && P.insulin[0].name === 'Lantus', 'tratamento não foi alterado pelo lembrete');
  P.insulin[0].times = ['21:30', '06:00']; r = C.irReconcile(R, P);
  ok(R.items.length === 1 && C.irMissing(R, P).length === 1 && C.irMissing(R, P)[0].times.join() === '06:00', 'novo horário no tratamento NÃO cria lembrete sozinho (só oferece)');
  P.insulin[0].times = ['07:00', '08:00']; R.items[0].src = '21:30'; r = C.irReconcile(R, P);
  ok(R.items[0].flag === 'timegone' && R.items[0].on === false && C.irStatusOf(R.items[0], P) === 'timegone', 'horário sumiu e não dá para parear: desativa e pede atualização');
  const idBefore = R.items[0].id; P.insulin = []; r = C.irReconcile(R, P);
  ok(R.items[0].flag === 'removed' && !R.items[0].on && R.adopted.length === 0 && R.items[0].id === idBefore, 'insulina removida: lembrete desativado (não apagado) e liberada do controle');
  ok(C.irNotifPlan(R, P, {}).length === 0, 'lembrete de insulina removida não agenda');
}
{
  const P = plan([pit('b1', 'Lantus', 'rapida', ['08:00'])]), R = C.irClean({ items: [mkR({ id: 'q2', itemId: 'b1', type: 'basal', src: '08:00', time: '08:00' })] }, mk);
  C.irReconcile(R, P); ok(R.items[0].type === 'rapida' && R.items[0].meal === 'cafe', 'tipo segue o cadastro do tratamento (basal -> rápida)');
  P.insulin[0].name = 'Fiasp'; C.irReconcile(R, P); ok(R.items[0].name === 'Fiasp', 'nome segue o tratamento');
}

// 7) avisos dentro do app: janela, confirmar, ignorar, adiar
{
  const P = plan([pit('b1', 'Lantus', 'basal', ['22:00'])]), R = C.irClean({ items: [mkR({ id: 'd1', itemId: 'b1' })] }, mk), t = L.mkTs('2026-11-15', '22:00');
  ok(C.irDue(R, P, t - 60000).length === 0, 'antes da hora: nada');
  ok(C.irDue(R, P, t + 60000).length === 1, 'na hora: aparece');
  ok(C.irDue(R, P, t + 181 * 60000).length === 0, 'depois de 3 h expira');
  R.state['2026-11-15|d1@22:00'] = 'done'; ok(C.irDue(R, P, t + 60000).length === 0, 'confirmado: some');
  R.state['2026-11-15|d1@22:00'] = 'ignored'; ok(C.irDue(R, P, t + 60000).length === 0, 'ignorado: some');
  R.state['2026-11-15|d1@22:00'] = { snooze: t + 10 * 60000 }; ok(C.irDue(R, P, t + 5 * 60000).length === 0, 'adiado: some até a hora');
  ok(C.irDue(R, P, t + 11 * 60000)[0].snoozed, 'adiado: volta depois dos minutos');
  ok(C.irSnoozes(R, P, t + 5 * 60000).length === 1 && C.irSnoozes(R, P, t + 11 * 60000).length === 0, 'adiamento vira 1 notificação única enquanto vale');
  ok(C.irNextShown(R, R.items[0], t + 5 * 60000) === t + 10 * 60000, 'próxima notificação mostra o adiamento');
  R.state = {}; ok(C.irDue(R, P, L.mkTs('2026-11-16', '00:30')).length === 1 && C.irDue(R, P, L.mkTs('2026-11-16', '00:30'))[0].day === '2026-11-15', 'cruza a meia-noite: aviso de ontem ainda vale na janela');
  R.state = { '2026-11-10|d1@22:00': 'done', '2026-11-15|d1@22:00': 'done' }; C.irPrune(R, t); ok(Object.keys(R.state).length === 1, 'estado antigo é podado');
  R.items[0].on = false; ok(C.irDue(R, P, t + 60000).length === 0, 'desligado não gera aviso');
}
// 8) histórico: o tipo de registro da confirmação
ok(C.irLogKind({ type: 'basal' }) === 'basal' && C.irLogKind({ type: 'rapida', meal: 'cafe' }) === 'fast' && C.irLogKind({ type: 'rapida', meal: 'almoco' }) === 'lunch' && C.irLogKind({ type: 'rapida', meal: 'jantar' }) === 'dinner' && C.irLogKind({ type: 'rapida', meal: 'outra' }) === 'extra', 'tipo de registro conforme a refeição');
ok(C.irMealGuess('Insulina rápida · almoço', '12:00') === 'almoco' && C.irMealGuess('Humalog', '07:00') === 'cafe' && C.irMealGuess('Humalog', '19:00') === 'jantar', 'refeição sugerida pelo nome/horário');
ok(C.irFmtNext(L.mkTs('2026-11-15', '22:00'), NOW) === 'hoje 22:00' && C.irFmtNext(L.mkTs('2026-11-16', '07:00'), NOW) === 'amanhã 07:00' && C.irFmtNext(L.mkTs('2026-11-20', '07:00'), NOW) === 'sex 07:00', 'rótulo da próxima notificação');
console.log(fail ? fail + ' falha(s)' : 'test8 ok'); process.exit(fail ? 1 : 0);
