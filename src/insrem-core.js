/* ================= Lembretes de insulina · núcleo (sem DOM, testável em Node) =================
   Modelo (S.ir, gravado em meta "ins-rem"):
   { v, on, adopted:[idDaInsulinaNoTratamento], tz, state:{ 'AAAA-MM-DD|idLembrete': 'done'|'ignored'|{snooze:ts} },
     items:[{ id, itemId, type:'basal'|'rapida', meal:''|'cafe'|'almoco'|'jantar'|'outra', time:'HH:MM', src:'HH:MM'|'',
              days:[0-6] (vazio = todos os dias), on, name, flag:''|'removed'|'timegone' }] }
   Regras de segurança:
   · A insulina vem sempre de "Meu tratamento" (itemId). Este módulo nunca altera dose, horário ou prescrição do tratamento.
   · "src" liga o lembrete a um horário do tratamento; se o horário do tratamento muda, o lembrete acompanha (ou pede atualização).
   · Confirmar registra só "a pessoa informou ter aplicado": sem dose, sem quantidade. */
const IR_TYPES = { basal: 'Basal', rapida: 'Rápida' };
const IR_MEALS = { cafe: 'Café da manhã', almoco: 'Almoço', jantar: 'Jantar', outra: 'Outra refeição' };
const IR_WIN_MIN = 180;                       /* por quanto tempo o aviso dentro do app continua aparecendo */
const IR_ID_MIN = 1100000, IR_ID_SPAN = 900000, IR_ID_MAX = IR_ID_MIN + IR_ID_SPAN; /* faixa de ids das notificações do Android (as outras ficam abaixo de 1.000.000) */
const IR_SNOOZE = [5, 10, 15];
const irTime = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '');
const irDays = d => { const s = [...new Set((Array.isArray(d) ? d : []).map(Number).filter(x => Number.isInteger(x) && x >= 0 && x <= 6))].sort(); return s.length === 7 ? [] : s; };
const irEffDays = r => (r.days && r.days.length ? r.days : [0, 1, 2, 3, 4, 5, 6]);
const irHash = s => { let h = 5381; for (const ch of String(s)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return h; };
function irMealGuess(name, time) {
  const n = String(name || '').toLowerCase();
  if (/caf[eé]|jejum|manh/.test(n)) return 'cafe'; if (/almo[cç]o/.test(n)) return 'almoco'; if (/jantar|ceia/.test(n)) return 'jantar';
  const m = irTime(time) ? +time.slice(0, 2) * 60 + +time.slice(3) : -1; if (m < 0) return '';
  return m < 630 ? 'cafe' : m < 930 ? 'almoco' : m < 1260 ? 'jantar' : 'outra';
}
function irItem(o, mkId) {
  o = o && typeof o === 'object' ? o : {};
  const type = o.type === 'basal' ? 'basal' : 'rapida', t = irTime(o.time) ? o.time : '08:00';
  return { id: typeof o.id === 'string' && o.id ? o.id : mkId(), itemId: String(o.itemId || ''), type, meal: type === 'rapida' && IR_MEALS[o.meal] ? o.meal : '', time: t, src: irTime(o.src) ? o.src : '', days: irDays(o.days), on: o.on !== false, name: String(o.name || '').slice(0, 80), flag: o.flag === 'removed' || o.flag === 'timegone' ? o.flag : '' };
}
function irClean(v, mkId) {
  mkId = mkId || (() => Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  v = v && typeof v === 'object' ? v : {};
  const items = (Array.isArray(v.items) ? v.items : []).filter(x => x && typeof x === 'object').slice(0, 40).map(x => irItem(x, mkId));
  const st = {}; if (v.state && typeof v.state === 'object') for (const [k0, x] of Object.entries(v.state)) {
    if (!/^\d{4}-\d\d-\d\d\|/.test(k0)) continue; let k = k0;
    { const p = irKeyParse(k0); if (p && !p.time) { const it = items.find(y => y.id === p.rid); if (it) k = irKey(p.day, p.rid, it.time); } } /* chave antiga (dia|id): passa a valer para o horário atual do lembrete */
    if (x === 'done' || x === 'ignored') st[k] = x; else if (x && typeof x.snooze === 'number' && isFinite(x.snooze)) st[k] = { snooze: x.snooze };
  }
  return { v: 1, on: v.on !== false, adopted: [...new Set((Array.isArray(v.adopted) ? v.adopted : []).map(String).filter(Boolean))], tz: String(v.tz || '').slice(0, 80), items, state: st };
}
const irPlanItem = (plan, r) => (plan && Array.isArray(plan.insulin) ? plan.insulin : []).find(x => x.id === r.itemId) || null;
const irRoleType = role => role === 'basal' ? 'basal' : role === 'rapida' ? 'rapida' : '';
/* situação derivada do tratamento: '' (normal), 'removed', 'timegone' (gravadas) ou 'paused' (insulina sem alarme/desmarcada no tratamento) */
function irStatusOf(r, plan) {
  if (r.flag) return r.flag;
  const it = irPlanItem(plan, r); if (!it) return 'removed';
  if (!plan.types.includes('insulina') || it.alarm === false) return 'paused';
  return '';
}
const irActive = (ir, r, plan) => !!(ir.on && r.on && !irStatusOf(r, plan));
/* Mantém os lembretes em dia com o tratamento. Nunca escreve no tratamento. Devolve { changed, notes }. */
function irReconcile(ir, plan) {
  let changed = false; const notes = [], note = m => { if (!notes.includes(m)) notes.push(m); };
  const lst = plan && Array.isArray(plan.insulin) ? plan.insulin : [];
  const ids = new Set(lst.map(x => x.id)), adopted = ir.adopted.filter(id => ids.has(id));
  if (adopted.length !== ir.adopted.length) { ir.adopted = adopted; changed = true; }
  const byItem = {}; for (const r of ir.items) (byItem[r.itemId] = byItem[r.itemId] || []).push(r);
  for (const [itemId, rs] of Object.entries(byItem)) {
    const it = lst.find(x => x.id === itemId);
    if (!it) { for (const r of rs) if (r.flag !== 'removed' || r.on) { r.flag = 'removed'; r.on = false; changed = true; note('Insulina removida do tratamento: lembrete desativado.'); } continue; }
    for (const r of rs) {
      if (r.flag === 'removed') { r.flag = ''; changed = true; }
      if (r.name !== (it.name || '').slice(0, 80) && it.name) { r.name = it.name.slice(0, 80); changed = true; }
      const rt = irRoleType(it.role); if (rt && r.type !== rt) { r.type = rt; if (rt === 'basal') r.meal = ''; else if (!r.meal) r.meal = irMealGuess(r.name, r.time); changed = true; }
    }
    /* horários: lembretes ligados a um horário (src) acompanham o tratamento */
    const times = (it.times || []).filter(irTime), linked = rs.filter(r => r.src);
    const orphans = linked.filter(r => !times.includes(r.src)).sort((a, b) => a.src.localeCompare(b.src));
    const covered = new Set(linked.filter(r => times.includes(r.src)).map(r => r.src));
    const fresh = times.filter(t => !covered.has(t)).sort();
    for (const r of linked) if (r.flag === 'timegone' && times.includes(r.src)) { r.flag = ''; changed = true; }
    if (orphans.length) {
      if (orphans.length === fresh.length) { orphans.forEach((r, i) => { r.time = r.src = fresh[i]; r.flag = ''; changed = true; }); note('Horário do tratamento mudou: o lembrete de insulina acompanhou.'); }
      else for (const r of orphans) if (r.flag !== 'timegone' || r.on) { r.flag = 'timegone'; r.on = false; changed = true; note('O horário da insulina mudou no tratamento. Confirme o novo horário do lembrete.'); }
    }
  }
  return { changed, notes };
}
/* Horários do tratamento (por insulina) que ainda não têm lembrete ligado a eles */
function irMissing(ir, plan) {
  const out = [];
  for (const it of (plan && plan.insulin) || []) {
    const have = new Set(ir.items.filter(r => r.itemId === it.id).map(r => r.src || r.time)); const times = (it.times || []).filter(irTime).filter(t => !have.has(t));
    if (times.length) out.push({ it, times });
  }
  return out;
}
/* Próximo disparo (ms) de um lembrete após "now", pelo relógio local */
function irNextAt(r, now) {
  const b = new Date(now), days = irEffDays(r);
  for (let d = 0; d < 8; d++) {
    const x = new Date(b.getFullYear(), b.getMonth(), b.getDate() + d); if (!days.includes(x.getDay())) continue;
    const ts = mkTs(isoDate(x), r.time); if (ts > now) return ts;
  }
  return null;
}
/* Identidade de uma ocorrência: dia + lembrete + horário programado. Mudar o horário de um lembrete cria outra ocorrência (não herda "feito" da anterior). */
const irKey = (day, rid, time) => day + '|' + rid + (time ? '@' + time : '');
const irKeyParse = k => { const m = /^(\d{4}-\d\d-\d\d)\|([^@|]+)(?:@(\d\d:\d\d))?$/.exec(String(k)); return m ? { day: m[1], rid: m[2], time: m[3] || '' } : null; };
const irOccId = key => 'ir:' + key;
function irPrune(ir, now) { const keep = [isoDate(new Date(now)), isoDate(new Date(now - 864e5))]; let ch = false; for (const k of Object.keys(ir.state)) if (!keep.includes(k.slice(0, 10))) { delete ir.state[k]; ch = true; } return ch; }
/* Ocorrências (hoje e ontem) dos lembretes ativos, no formato do vínculo com o histórico */
function irOccs(ir, plan, now) {
  const out = [], today = isoDate(new Date(now)), yest = isoDate(new Date(now - 864e5));
  for (const r of ir.items) {
    if (!irActive(ir, r, plan)) continue;
    for (const day of [yest, today]) {
      const dow = new Date(mkTs(day, '12:00')).getDay(); if (!irEffDays(r).includes(dow)) continue;
      out.push({ key: irOccId(irKey(day, r.id, r.time)), day, at: mkTs(day, r.time), kind: irLogKind(r), name: irNameOf(plan, r), r });
    }
  }
  return out;
}
/* { 'ir:chave': registroDoHistorico } das ocorrências já resolvidas pelo histórico de insulinas (registrar em qualquer tela vale para todas) */
function irMatched(ir, plan, now, logs) {
  if (!logs || typeof ocMatchLogs !== 'function') return {};
  return ocMatchLogs(irOccs(ir, plan, now), logs, IR_WIN_MIN * 60000);
}
/* Lembretes que pedem resposta agora (aviso dentro do app e menu de resposta). Com "logs" (histórico), o que já foi registrado não pede mais nada. */
function irDue(ir, plan, now, logs) {
  const out = [], mt = irMatched(ir, plan, now, logs);
  for (const o of irOccs(ir, plan, now)) {
    const r = o.r, day = o.day, key = irKey(day, r.id, r.time), st = ir.state[key];
    if (st === 'done' || st === 'ignored' || mt[o.key]) continue;
    let at = o.at, snoozed = false;
    if (st && typeof st === 'object') { if (now < st.snooze) continue; at = st.snooze; snoozed = true; }
    if (now < at || now >= at + IR_WIN_MIN * 60000) continue;
    out.push({ r, key, occ: o.key, day, at, snoozed });
  }
  return out.sort((a, b) => a.at - b.at);
}
/* Estado de uma ocorrência (id "ir:dia|lembrete@HH:MM"), calculado só do que está gravado: lembrete, tratamento, estado explícito e histórico */
function irOccStatus(ir, plan, occ, now, logs) {
  const k = String(occ).replace(/^ir:/, ''), p = irKeyParse(k); if (!p) return { st: 'cancelado', why: 'invalido' };
  const r = ir.items.find(x => x.id === p.rid); if (!r) return { st: 'cancelado', why: 'excluido' };
  if (p.time && r.time !== p.time) return { st: 'cancelado', why: 'horario' };
  if (!irEffDays(r).includes(new Date(mkTs(p.day, '12:00')).getDay())) return { st: 'cancelado', why: 'dia' };
  if (!ir.on || !r.on || irStatusOf(r, plan)) return { st: 'desativado', why: 'config' };
  const s = ir.state[k]; if (s === 'done') return { st: 'concluido', why: 'confirmado' }; if (s === 'ignored') return { st: 'ignorado', why: 'ignorado' };
  if (logs && irMatched(ir, plan, now, logs)[irOccId(k)]) return { st: 'concluido', why: 'registro' };
  let at = mkTs(p.day, r.time);
  if (s && typeof s === 'object') { if (now < s.snooze) return { st: 'programado', why: 'adiado' }; at = s.snooze; }
  if (now >= at + IR_WIN_MIN * 60000) return { st: 'expirado', why: 'janela' };
  return now < at ? { st: 'programado', why: '' } : { st: 'pendente', why: '' };
}
/* chave de estado de uma ocorrência guardada: devolve o id do lembrete (ou null) */
const irStateRid = k => { const p = irKeyParse(k); return p ? p.rid : null; };
/* Próxima notificação de um lembrete, considerando um adiamento em andamento */
function irNextShown(ir, r, now) {
  const nx = irNextAt(r, now), st = ir.state[irKey(isoDate(new Date(now)), r.id, r.time)];
  if (st && typeof st === 'object' && st.snooze > now) return nx == null ? st.snooze : Math.min(nx, st.snooze);
  return nx;
}
const irTipo = r => r.type === 'basal' ? 'Basal' : 'Rápida' + (r.meal ? ' · ' + IR_MEALS[r.meal] : '');
function irText(r, name, snoozed) {
  const nm = name || r.name || 'Insulina', tipo = irTipo(r), basal = r.type === 'basal';
  return {
    title: basal ? 'Hora da insulina basal' : 'Hora da insulina rápida',
    body: nm + ' · ' + tipo + ' · ' + r.time + (snoozed ? ' (adiado)' : ''),
    largeBody: (basal ? 'Está na hora de conferir sua aplicação programada.' : 'Lembrete da aplicação programada para esta refeição.') + '\n' + nm + ' · ' + tipo + ' · programada para ' + r.time + (snoozed ? ' (adiado)' : '')
  };
}
/* Ids estáveis das notificações do Android: um por lembrete e dia da semana ('a' = todos os dias, 'z' = adiamento) */
function irIdMap(ir) {
  const used = new Set(), map = {};
  for (const r of [...ir.items].sort((a, b) => a.id.localeCompare(b.id))) for (const w of [0, 1, 2, 3, 4, 5, 6, 'a', 'z']) {
    let n = IR_ID_MIN + irHash(r.id + '#' + w) % IR_ID_SPAN; while (used.has(n)) n = n + 1 >= IR_ID_MAX ? IR_ID_MIN : n + 1; used.add(n); map[r.id + '#' + w] = n;
  }
  return map;
}
/* Lista do que deve existir agendado no Android (repetições semanais). opt.quiet(hhmm) => true pula o horário no silêncio noturno */
function irNotifPlan(ir, plan, opt) {
  opt = opt || {}; const ids = irIdMap(ir), out = [];
  for (const r of ir.items) {
    if (!irActive(ir, r, plan)) continue; if (opt.quiet && opt.quiet(r.time)) continue;
    const [h, m] = r.time.split(':').map(Number), tx = irText(r, irNameOf(plan, r)), extra = { kind: 'insrem', rid: r.id, time: r.time, type: r.type };
    if (!r.days.length) out.push({ nid: ids[r.id + '#a'], rid: r.id, hour: h, minute: m, weekday: null, ...tx, extra });
    else for (const d of r.days) out.push({ nid: ids[r.id + '#' + d], rid: r.id, hour: h, minute: m, weekday: d + 1, ...tx, extra }); /* weekday do Capacitor: 1 = domingo */
  }
  return out;
}
/* Adiamentos pendentes (uma notificação única por lembrete) */
function irSnoozes(ir, plan, now) {
  const ids = irIdMap(ir), out = [];
  for (const [k, st] of Object.entries(ir.state)) {
    if (!st || typeof st !== 'object' || !(st.snooze > now + 2000)) continue;
    const p = irKeyParse(k), rid = p && p.rid, r = rid && ir.items.find(x => x.id === rid); if (!r || (p.time && p.time !== r.time) || !irActive(ir, r, plan)) continue;
    out.push({ nid: ids[rid + '#z'], rid, at: st.snooze, ...irText(r, irNameOf(plan, r), true), extra: { kind: 'insrem', rid, time: r.time, type: r.type, snooze: true } });
  }
  return out;
}
const irNameOf = (plan, r) => { const it = irPlanItem(plan, r); return (it && it.name) || r.name || 'Insulina'; };
/* Entrada de histórico criada ao confirmar. Só informa que a aplicação foi confirmada: nunca inclui dose. */
function irLogKind(r) { return r.type === 'basal' ? 'basal' : ({ cafe: 'fast', almoco: 'lunch', jantar: 'dinner' }[r.meal] || 'extra'); }
function irFmtNext(ts, now) {
  if (!ts) return '—'; const d = new Date(ts), t = pad(d.getHours()) + ':' + pad(d.getMinutes()), a = isoDate(new Date(now)), b = isoDate(d), c = isoDate(new Date(now + 864e5));
  return (b === a ? 'hoje' : b === c ? 'amanhã' : ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d.getDay()]) + ' ' + t;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { IR_TYPES, IR_MEALS, IR_WIN_MIN, IR_ID_MIN, IR_ID_MAX, IR_SNOOZE, irTime, irDays, irEffDays, irMealGuess, irClean, irItem, irReconcile, irMissing, irNextAt, irKey, irKeyParse, irOccId, irOccs, irMatched, irOccStatus, irStateRid, irPrune, irDue, irNextShown, irText, irTipo, irIdMap, irNotifPlan, irSnoozes, irActive, irStatusOf, irLogKind, irFmtNext, irPlanItem };
