/* ================= Meu tratamento · núcleo (sem DOM, testável em Node) =================
   O tratamento cadastrado (S.plan) é a ÚNICA fonte para: cartões de insulina do Início, lembretes, resumo e exportação.
   Este módulo só LÊ o tratamento; nunca cria dose, horário, medicamento nem regra clínica.
   Registro de aplicação (S.inslog) ganha, para registros novos, dois campos opcionais:
     insId = id da insulina em S.plan.insulin · slot = horário (HH:MM) do tratamento a que o registro se refere.
   Registros antigos (sem insId) continuam válidos: são ligados por categoria só quando não há ambiguidade. */
const TR_ROLES = { basal: 'Basal', rapida: 'Rápida ou ultrarrápida', mista: 'Mista', outra: 'Outra' };
const trRoleTxt = r => TR_ROLES[r] || 'Outra';
const trPaused = it => !!(it && it.paused);
/* item que pode gerar cartões e lembretes: não suspenso e já confirmado pela pessoa (mesma regra de plActive em plan.js) */
const trLive = it => !!it && !it.paused && !it.sug;
const trTimes = it => (it.times || []).filter(t => trHm(t) && !(it.guess || []).includes(t));
const trSlotKey = (id, time) => 'i:' + id + '@' + (time || '');
const trKind = (it, time) => (typeof ocDoseKind === 'function' ? ocDoseKind(it.role, it.name, time) : 'extra');
const trHm = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '');
const trDowOf = (day, mk) => new Date(mk(day, '12:00')).getDay();
/* Cartões do dia: um por horário de cada insulina ativa; insulina sem horário vira um cartão "quando necessário". */
function trSlots(plan, day, mk) {
  const out = [], list = plan && plan.types && plan.types.includes('insulina') ? (plan.insulin || []) : [], dow = trDowOf(day, mk);
  for (const it of list) {
    if (!trLive(it)) continue;
    const days = it.days || [];
    if (days.length && !days.includes(dow)) continue;
    const times = trTimes(it).slice().sort();
    if (!times.length) { out.push({ it, time: '', key: trSlotKey(it.id, ''), kind: trKind(it, ''), onDemand: true }); continue; }
    for (const t of times) out.push({ it, time: t, key: trSlotKey(it.id, t), kind: trKind(it, t), onDemand: false, off: (it.off || []).includes(t) });
  }
  return out.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || String(a.it.name).localeCompare(String(b.it.name)));
}
/* Liga os registros do dia aos cartões. Devolve { [key do cartão]: [registros] }.
   1) registro com insId: só vale para aquela insulina (horário pelo campo slot/sched; sem horário, o mais próximo);
   2) registro antigo (sem insId): só entra se existe UM cartão daquela categoria no dia (nada de adivinhar entre duas insulinas). */
function trAssign(slots, day, logs, mk) {
  const res = {}; slots.forEach(s => { res[s.key] = []; });
  const today = (logs || []).filter(l => l && l.date === day && typeof l.ts === 'number').sort((a, b) => a.ts - b.ts);
  const withId = today.filter(l => l.insId), legacy = today.filter(l => !l.insId);
  const ids = [...new Set(slots.map(s => s.it.id))];
  for (const id of ids) {
    const mine = slots.filter(s => s.it.id === id), recs = withId.filter(l => l.insId === id), used = new Set();
    if (mine.length === 1) { res[mine[0].key].push(...recs); continue; }
    for (const s of mine) for (const l of recs) if (!used.has(l.id) && s.time && (l.slot === s.time || l.sched === s.time)) { res[s.key].push(l); used.add(l.id); }
    const left = mine.filter(s => !res[s.key].length && s.time);
    for (const l of recs) {
      if (used.has(l.id)) continue;
      let best = null, bd = 1e18;
      for (const s of left) { if (res[s.key].length) continue; const d = Math.abs(l.ts - mk(day, s.time)); if (d < bd) { bd = d; best = s; } }
      if (best) { res[best.key].push(l); used.add(l.id); }
    }
  }
  const byKind = {}; slots.forEach(s => { (byKind[s.kind] = byKind[s.kind] || []).push(s); });
  for (const [k, ss] of Object.entries(byKind)) {
    if (ss.length !== 1) continue; const s = ss[0]; if (res[s.key].length) continue;
    const l = legacy.filter(x => x.kind === k && (k !== 'extra' || !x.name || String(x.name).toLowerCase() === String(s.it.name || '').toLowerCase()));
    if (l.length) res[s.key].push(...l);
  }
  return res;
}
/* Última quantidade registrada de uma insulina (só leitura: não é sugestão). */
function trLastUnits(it, logs, singleOfKind, kind) {
  const l = [...(logs || [])].reverse().find(x => x.units != null && (x.insId === it.id || (!x.insId && singleOfKind && x.kind === kind)));
  return l ? l.units : null;
}
/* ----- resumo ----- */
function trResume(plan, now, mk) {
  const ins = plan.insulin || [], meds = plan.meds || [], act = l => l.filter(x => !x.paused && !x.tbd).length;
  const out = { ins: ins.length, meds: meds.length, active: act(ins) + act(meds), paused: ins.concat(meds).filter(x => x.paused).length, tbd: ins.concat(meds, plan.checks || []).filter(x => x.sug || (x.guess || []).length).length, upd: plan.updated || 0, next: [] };
  const day = new Date(now), iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const cand = [];
  for (let d = 0; d < 2; d++) {
    const dd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + d), ds = iso(dd), dow = dd.getDay();
    for (const [lb, l] of [['Insulina', ins], ['Medicamento', meds]]) for (const it of l) {
      if (!trLive(it) || (lb === 'Insulina' && !(plan.types || []).includes('insulina')) || (lb === 'Medicamento' && !(plan.types || []).includes('remedios'))) continue;
      if ((it.days || []).length && !it.days.includes(dow)) continue;
      for (const t of trTimes(it)) { const ts = mk(ds, t); if (ts > now) cand.push({ ts, t, name: it.name || 'Sem nome', lb, day: d === 0 ? 'hoje' : 'amanhã' }); }
    }
  }
  out.next = cand.sort((a, b) => a.ts - b.ts).slice(0, 3);
  return out;
}
/* ----- exportação (texto simples, só o que está cadastrado) ----- */
function trExportText(plan, schemes, ctx) {
  ctx = ctx || {}; const L = [], f = ctx.fmtDate || (d => d), ts = ctx.fmtTs || (t => new Date(t).toLocaleString('pt-BR'));
  const days = it => { const d = it.days || []; return !d.length || d.length === 7 ? 'todos os dias' : d.map(x => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][x]).join(', '); };
  const line = (it, ins) => `- ${it.name || 'Sem nome'}${ins ? ' (' + trRoleTxt(it.role).toLowerCase() + ')' : ''}${it.paused ? ' [SUSPENSO]' : ''}${it.sug ? ' [a confirmar]' : ''}\n    Horários: ${trTimes(it).length ? trTimes(it).join(', ') + ' · ' + days(it) : 'sem horário fixo (quando necessário)'}${it.dose ? '\n    Dose cadastrada: ' + it.dose : ''}${it.notes ? '\n    Observações: ' + it.notes : ''}\n    Lembrete: ${it.alarm && trTimes(it).length ? 'ligado' : 'desligado'}`;
  L.push('Meu tratamento (GLUXO)'); if (ctx.diabetes) L.push('Diabetes: ' + ctx.diabetes);
  if (plan.updated) L.push('Última atualização do tratamento: ' + ts(plan.updated));
  L.push('Informações cadastradas pelo próprio usuário; não substituem a prescrição da equipe de saúde.', '');
  if ((plan.insulin || []).length) { L.push('INSULINAS'); plan.insulin.forEach(i => L.push(line(i, true))); L.push(''); }
  if ((plan.meds || []).length) { L.push('OUTROS MEDICAMENTOS'); plan.meds.forEach(i => L.push(line(i, false))); L.push(''); }
  if ((plan.checks || []).length) { L.push('MEDIÇÕES PROGRAMADAS'); plan.checks.forEach(i => L.push(`- ${i.name}: ${(i.times || []).join(', ') || 'sem horário'}`)); L.push(''); }
  if ((plan.log || []).length) { L.push('HISTÓRICO DE ALTERAÇÕES (mais recentes primeiro)'); plan.log.slice().reverse().slice(0, 60).forEach(h => L.push(`- ${ts(h.ts)}: ${h.txt}`)); L.push(''); }
  if ((schemes || []).length) { L.push('ESQUEMAS CADASTRADOS'); schemes.slice().reverse().forEach(s => L.push(`- ${s.name}: ${f(s.start)} → ${s.end ? f(s.end) : 'em uso'}${s.basalInsulin ? ' · basal ' + s.basalInsulin + (s.basalDose ? ' ' + s.basalDose : '') : ''}${s.rapidInsulin ? ' · rápida ' + s.rapidInsulin : ''}`)); L.push(''); }
  return L.join('\n').trim() + '\n';
}
/* ----- comparação de esquemas: indicadores por período, sem inventar dados ----- */
function trCompare(rows) {
  return rows.map(r => {
    const n = r.n || 0, d = Math.max(1, r.days || 1);
    return { id: r.sc.id, name: r.sc.name, days: d, n, perDay: n / d, mean: n ? r.mean : null, hypo: r.hypo || 0, hyper: r.hyper || 0,
      hypoPct: n ? (r.hypo || 0) / n * 100 : null, hyperPct: n ? (r.hyper || 0) / n * 100 : null,
      hypoPer30: n ? (r.hypo || 0) / d * 30 : null, hyperPer30: n ? (r.hyper || 0) / d * 30 : null,
      few: n < 20, short: d < 14 };
  });
}
if (typeof module !== 'undefined' && module.exports) module.exports = { TR_ROLES, trRoleTxt, trPaused, trLive, trTimes, trSlotKey, trKind, trSlots, trAssign, trLastUnits, trResume, trExportText, trCompare };
