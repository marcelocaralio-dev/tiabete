/* ================= Meu tratamento: tipo de tratamento, medicamentos, horários e alarmes ================= */
/* O app só organiza e lembra. Doses, horários e medicamentos são os que a equipe de saúde do usuário indicou. */
const PL_TYPES = [['insulina', 'Insulina', 'Canetas ou seringas'], ['remedios', 'Medicamentos', 'Comprimidos e injetáveis que não são insulina'], ['bomba', 'Bomba de insulina', 'Infusão contínua']];
const PL_INS = [
  ['Basais (ação prolongada)', 'basal', ['Glargina U100 (Lantus, Basaglar)', 'Glargina U300 (Toujeo)', 'Detemir (Levemir)', 'Degludeca (Tresiba)', 'NPH (Humulin N, Novolin N)']],
  ['Rápidas e ultrarrápidas (refeições)', 'rapida', ['Regular (Humulin R, Novolin R)', 'Lispro (Humalog)', 'Asparte (NovoRapid, Fiasp)', 'Glulisina (Apidra)']],
  ['Pré-misturadas', 'mista', ['NPH + Regular 70/30', 'Asparte bifásica (NovoMix 30)', 'Lispro bifásica (Humalog Mix 25)']],
  ['Combinações com GLP-1', 'outra', ['Degludeca + liraglutida (Xultophy)', 'Glargina + lixisenatida (Soliqua)']]
];
const PL_MEDS = [
  ['Biguanida', ['Metformina', 'Metformina de liberação prolongada (XR)']],
  ['Sulfonilureias', ['Glibenclamida', 'Glimepirida', 'Gliclazida (MR)']],
  ['Glinidas', ['Repaglinida', 'Nateglinida']],
  ['Inibidores da DPP-4', ['Sitagliptina', 'Vildagliptina', 'Linagliptina', 'Saxagliptina']],
  ['Inibidores da SGLT2', ['Dapagliflozina', 'Empagliflozina', 'Canagliflozina']],
  ['Outros comprimidos', ['Pioglitazona', 'Acarbose']],
  ['Injetáveis (não são insulina)', ['Semaglutida', 'Liraglutida', 'Dulaglutida', 'Tirzepatida']],
  ['Combinações', ['Metformina + sitagliptina', 'Metformina + vildagliptina', 'Dapagliflozina + metformina', 'Empagliflozina + linagliptina']]
];
const PL_PUMPS = ['Medtronic MiniMed', 'Omnipod', 'Tandem t:slim X2', 'Accu-Chek Insight', 'Ypsomed mylife YpsoPump', 'Outra'];
const PL_PRESETS = {
  'Tipo 1': { intro: 'No tipo 1 o corpo não produz insulina, então o tratamento é feito com insulina (canetas ou bomba). O modelo abaixo é só uma estrutura para você preencher e editar.', types: ['insulina'], insulin: [{ name: 'Insulina basal', role: 'basal', times: ['22:00'] }, { name: 'Insulina rápida · café', role: 'rapida', times: ['07:00'] }, { name: 'Insulina rápida · almoço', role: 'rapida', times: ['12:00'] }, { name: 'Insulina rápida · jantar', role: 'rapida', times: ['19:00'] }], meds: [], checks: [{ name: 'Glicemia em jejum', times: ['06:45'] }, { name: 'Glicemia antes do almoço', times: ['11:45'] }, { name: 'Glicemia antes do jantar', times: ['18:45'] }, { name: 'Glicemia ao deitar', times: ['22:00'] }], tips: ['Quem usa bomba pode marcar também “Bomba de insulina” (troca do cateter e conferência).'] },
  'Tipo 2': { intro: 'No tipo 2 o tratamento costuma começar com alimentação, atividade física e comprimidos; algumas pessoas usam também injetáveis ou insulina. O modelo é só uma estrutura para editar.', types: [], insulin: [], meds: [], checks: [{ name: 'Glicemia em jejum', times: ['07:00'] }, { name: 'Glicemia 2 h após o almoço', times: ['14:00'] }], tips: ['Marque abaixo o que a sua equipe indicou (comprimidos, injetáveis ou insulina) e cadastre cada item com o nome e os horários dela.'] },
  'MODY': { intro: 'No MODY o tratamento depende do subtipo genético: alguns usam comprimidos, outros só alimentação e outros insulina. Preencha somente o que a sua equipe indicou.', types: [], insulin: [], meds: [], checks: [{ name: 'Glicemia em jejum', times: ['07:00'] }, { name: 'Glicemia 2 h após o almoço', times: ['14:00'] }], tips: ['No MODY não há medicamento ou esquema único. Marque abaixo somente o que a sua equipe indicou; se o seu tratamento é só alimentação, não marque nada.'] },
  'Gestacional': { intro: 'Na diabetes gestacional o cuidado costuma ser alimentação e medições frequentes; se a equipe prescrever insulina ou remédio, ative abaixo. Ajuste os horários ao que a equipe pediu (1 h ou 2 h após as refeições).', types: [], insulin: [], meds: [], checks: [{ name: 'Glicemia em jejum', times: ['07:00'] }, { name: 'Glicemia 1 h após o café', times: ['08:30'] }, { name: 'Glicemia 1 h após o almoço', times: ['13:30'] }, { name: 'Glicemia 1 h após o jantar', times: ['20:30'] }], tips: ['Se receber insulina, ative “Insulina” e cadastre o que a equipe indicou.'] }
};
S.plan = { updated: 0, log: [], types: [], insulin: [], meds: [], checks: [], others: [], pump: { model: '', notes: '', siteDays: 3, lastChange: '', siteTime: '08:00', alarm: false } };
S.planOpen = {}; S.planDone = { day: '', map: {} };
const plTime = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '');
const plDays0 = d => [...new Set((Array.isArray(d) ? d : []).map(Number).filter(x => x >= 0 && x <= 6))].sort(), plOff0 = (o, tm) => (Array.isArray(o.off) ? o.off : []).filter(t => tm.includes(t));
/* Condição de registro (opcional, definida pela pessoa com a equipe): libera o botão só com a última glicemia de hoje a partir de um valor. O app não recomenda dose. */
const plGate0 = g => g && typeof g === 'object' ? { on: !!g.on, min: isFinite(+g.min) && +g.min >= 40 && +g.min <= 600 ? Math.round(+g.min) : null } : null;
const plGateOn = it => !!(it && it.gate && it.gate.on && it.gate.min);
const plItem0 = (o, role) => { const tm = (o.times || []).filter(plTime).slice(0, 8); return plItem1(o, role, tm); };
const plItem1 = (o, role, tm) => ({ id: uid(), name: String(o.name || '').slice(0, 80), role: o.role || role || '', times: tm, days: plDays0(o.days), off: plOff0(o, tm), dose: String(o.dose || '').slice(0, 120), notes: String(o.notes || '').slice(0, 200), alarm: o.alarm !== false, paused: !!o.paused, sug: !!o.sug, gate: plGate0(o.gate), guess: (Array.isArray(o.guess) ? o.guess : []).filter(t => tm.includes(t)), cat: String(o.cat || '').slice(0, 40) });
function plClean(v) {
  v = v && typeof v === 'object' ? v : {}; const arr = a => Array.isArray(a) ? a.filter(x => x && typeof x === 'object').slice(0, 30).map(x => ({ ...plItem0(x), id: typeof x.id === 'string' && x.id ? x.id : uid() })) : [];
  const p = v.pump && typeof v.pump === 'object' ? v.pump : {};
  const lg = (Array.isArray(v.log) ? v.log : []).filter(x => x && typeof x === 'object' && isFinite(+x.ts) && x.txt).slice(-100).map(x => ({ ts: +x.ts, txt: String(x.txt).slice(0, 140) }));
  return { updated: isFinite(+v.updated) && +v.updated > 0 ? +v.updated : 0, log: lg, types: (Array.isArray(v.types) ? v.types : []).filter(t => PL_TYPES.some(x => x[0] === t)), insulin: arr(v.insulin), meds: arr(v.meds), checks: arr(v.checks), others: (Array.isArray(v.others) ? v.others : []).filter(x => x && typeof x === 'object').slice(0, 30).map(x => ({ id: typeof x.id === 'string' && x.id ? x.id.slice(0, 40) : uid(), name: String(x.name || '').slice(0, 80), notes: String(x.notes || '').slice(0, 200) })), pump: { model: String(p.model || '').slice(0, 60), notes: String(p.notes || '').slice(0, 300), siteDays: [2, 3, 4, 5].includes(+p.siteDays) ? +p.siteDays : 3, lastChange: /^\d{4}-\d\d-\d\d$/.test(p.lastChange || '') ? p.lastChange : '', siteTime: plTime(p.siteTime) ? p.siteTime : '08:00', alarm: !!p.alarm } };
}
function plLoad(v) { S.plan = plClean(v); }
const plSave = async () => { try { S.plan.updated = Date.now(); await Store.put('meta', { id: 'plan', value: S.plan }); } catch (e) { } };
const plHas = () => S.plan.types.length || S.plan.insulin.length || S.plan.meds.length || S.plan.checks.length || S.plan.others.length || S.plan.pump.model || S.plan.pump.notes || S.plan.pump.lastChange;
/* Item ativo = fora da suspensão e já confirmado pela pessoa (itens de modelo ficam como sugestão até serem confirmados). Horários "a confirmar" (guess) são valores padrão, não prescritos. */
const plActive = it => !!it && !it.paused && !it.sug;
const plRealTimes = it => (it.times || []).filter(t => plTime(t) && !(it.guess || []).includes(t));
function plLog(txt) { S.plan.log = (S.plan.log || []).concat([{ ts: Date.now(), txt: String(txt).slice(0, 140) }]).slice(-100); }
const plSec = { insulina: 'insulin', remedios: 'meds', checks: 'checks' };
const plNext = (times) => { const l = times[times.length - 1]; if (!l) return '08:00'; const [h, m] = l.split(':').map(Number); return pad((h + 4) % 24) + ':' + pad(m); };
const plTimesTxt = it => it.times.length ? it.times.join(' · ') + (it.days && it.days.length && it.days.length < 7 ? ' · ' + plDaysTxt(it) : '') : 'sem horário fixo';

/* ----- Alarmes do tratamento (lista do dia; usada pela faixa do app e, no Android, pelas notificações) ----- */
const PL_WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'], PL_WDL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const plDaysTxt = it => { const d = it.days || []; return !d.length || d.length === 7 ? 'todos os dias' : d.join() === '1,2,3,4,5' ? 'dias úteis' : d.join() === '0,6' ? 'fins de semana' : d.map(x => PL_WD[x]).join(', '); };
function plQuietAt(t) { const c = alCfg(); if (!c.plQuiet || !c.quiet) return false; const m = x => { const [h, mi] = String(x).split(':').map(Number); return h * 60 + mi; }, v = m(t), f = m(c.qFrom), e = m(c.qTo); return f === e ? false : f < e ? (v >= f && v < e) : (v >= f || v < e); }
/* Lista única de lembretes do tratamento: só o que a pessoa cadastrou (item, horário, dias). all=true inclui os desligados. */
function plCollect(all) {
  const p = S.plan, out = [];
  const add = (sec, items, on) => { if (on) items.forEach(it => { if (!plActive(it)) return; if (all || it.alarm) plRealTimes(it).forEach(t => { if (!plTime(t)) return; if (sec === 'Insulina' && typeof irCoversTime === 'function' && irCoversTime(it.id, t)) return; /* este horário já tem lembrete de insulina próprio: só ele responde */ const off = !it.alarm || (it.off || []).includes(t); if (off && !all) return; out.push({ key: it.id + '@' + t, time: t, label: it.name || sec, sec, itemId: it.id, dose: it.dose || '', days: it.days || [], off, secKey: sec === 'Insulina' ? 'insulin' : sec === 'Remédio' ? 'meds' : 'checks' }); }); }); };
  add('Insulina', p.insulin, p.types.includes('insulina')); add('Medicamento', p.meds, p.types.includes('remedios')); add('Medição', p.checks, true);
  return out.sort((a, b) => a.time.localeCompare(b.time));
}
const plDow = day => new Date(mkTs(day, '12:00')).getDay();
function planAlarms(day) {
  day = day || isoDate(new Date()); const p = S.plan, dow = plDow(day);
  const out = plCollect(false).filter(a => !a.days.length || a.days.includes(dow));
  if (p.types.includes('bomba') && p.pump.alarm && p.pump.lastChange) { const due = isoDate(new Date(addDays(mkTs(p.pump.lastChange, '12:00'), p.pump.siteDays))); if (day >= due) out.push({ key: 'pump@' + due, time: p.pump.siteTime, label: 'Trocar o cateter da bomba', sec: 'Bomba', pump: true }); }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}
/* Estado do dia dos avisos, gravado no banco (antes ficava só na memória e voltava ao abrir o app): "Feito" e adiamento do tratamento, "Dispensar" da medição. */
async function adSave() { if (!S.adReady) return; try { await Store.put('meta', { id: 'alert-day', value: { day: S.planDone.day, plan: S.planDone.map, rem: S.remOff } }); } catch (e) { } }
function adLoad(v) {
  if (!v || typeof v !== 'object') return; const d = isoDate(new Date());
  if (v.day === d && v.plan && typeof v.plan === 'object') { const m = {}; for (const [k, x] of Object.entries(v.plan)) if (x === 1 || (typeof x === 'number' && isFinite(x))) m[k] = x; S.planDone = { day: d, map: m }; }
  if (v.rem && typeof v.rem === 'object') for (const k of Object.keys(v.rem)) if (k.startsWith(d)) S.remOff[k] = 1;
}
function plDoneRoll() { const d = isoDate(new Date()); if (S.planDone.day !== d) { S.planDone = { day: d, map: {} }; S.remOff = {}; adSave(); } }
const plOccId = (day, key) => 'pl:' + day + '|' + key;
const plItemOf = a => (S.plan.insulin || []).find(x => x.id === a.itemId);
const plAlarmKind = a => { const it = plItemOf(a); return it ? ocDoseKind(it.role, it.name, a.time) : 'extra'; };
/* alarmes de insulina de hoje que o histórico de insulinas já mostra como aplicados: { 'pl:dia|chave': registro } */
function plInsMatched(day) {
  day = day || isoDate(new Date()); const occs = planAlarms(day).filter(a => a.sec === 'Insulina').map(a => ({ key: plOccId(day, a.key), day, at: mkTs(day, a.time), kind: plAlarmKind(a), name: (plItemOf(a) || {}).name }));
  return occs.length ? ocMatchLogs(occs, S.inslog, 120 * 60000) : {};
}
function plPending() {
  if (!alCfg().plan) return []; plDoneRoll(); const now = new Date(), m = now.getHours() * 60 + now.getMinutes(), day = isoDate(now), mt = plInsMatched(day);
  return planAlarms().filter(a => { const [h, mi] = a.time.split(':').map(Number), mm = h * 60 + mi, st = S.planDone.map[a.key]; if (st === 1) return false; if (typeof st === 'number' && st > Date.now()) return false; if (a.sec === 'Medição' && plCheckDone(a.time)) return false; if (a.sec === 'Insulina' && mt[plOccId(day, a.key)]) return false; return m >= mm && (a.pump || m < mm + 120); });
}
/* Estado de uma ocorrência do tratamento (id "pl:dia|item@HH:MM"), calculado do que está gravado */
function plOccStatus(occ, now) {
  const p = ocParse(occ); if (!p || p.src !== 'pl' || !p.time) return { st: 'cancelado', why: 'invalido' }; now = now || Date.now();
  let it = null, sec = ''; for (const k of ['insulin', 'meds', 'checks']) { const f = (S.plan[k] || []).find(x => x.id === p.id); if (f) { it = f; sec = k; break; } }
  if (!it) return { st: 'cancelado', why: 'excluido' };
  if (!plActive(it)) return { st: 'desativado', why: 'config' };
  if (!alCfg().plan || (sec === 'insulin' && !S.plan.types.includes('insulina')) || (sec === 'meds' && !S.plan.types.includes('remedios'))) return { st: 'desativado', why: 'config' };
  if (!it.times.includes(p.time)) return { st: 'cancelado', why: 'horario' };
  if (!it.alarm || (it.off || []).includes(p.time)) return { st: 'desativado', why: 'config' };
  if (sec === 'insulin' && typeof irCoversTime === 'function' && irCoversTime(it.id, p.time)) return { st: 'cancelado', why: 'substituido' };
  if (it.days.length && !it.days.includes(new Date(mkTs(p.day, '12:00')).getDay())) return { st: 'cancelado', why: 'dia' };
  const key = p.id + '@' + p.time; plDoneRoll();
  if (S.planDone.day === p.day) { const st = S.planDone.map[key]; if (st === 1) return { st: 'concluido', why: 'confirmado' }; if (typeof st === 'number' && st > now) return { st: 'programado', why: 'adiado' }; }
  if (sec === 'checks' && p.day === isoDate(new Date(now)) && plCheckDone(p.time)) return { st: 'concluido', why: 'registro' };
  if (sec === 'insulin' && plInsMatched(p.day)[occ]) return { st: 'concluido', why: 'registro' };
  const at = mkTs(p.day, p.time); if (now >= at + 120 * 60000) return { st: 'expirado', why: 'janela' };
  return now < at ? { st: 'programado', why: '' } : { st: 'pendente', why: '' };
}
/* Já existe aviso programado da basal (lembrete de insulina ou alarme do tratamento)? Então o aviso genérico de "24 h desde a última basal" não repete a mesma coisa. */
function basalAlertCovered() {
  try { if (irDueNow().some(d => d.r.type === 'basal')) return true; return plPending().some(a => a.sec === 'Insulina' && plAlarmKind(a) === 'basal'); } catch (e) { return false; }
}
function planBanner() {
  if (S.route !== 'painel' && !S._acCollect) return ''; const l = plPending(); S._pk = l.map(x => x.key).join(','); const day = isoDate(new Date());
  return l.slice(0, 3).map(a => `<div class="banner"${a.pump ? '' : ` data-occ="${esc(plOccId(day, a.key))}"`}><span><b>${a.sec === 'Medição' ? 'Medir.' : 'Hora do tratamento.'}</b> ${esc(a.label)} · <span class="num">${a.time}</span></span><span class="row" style="gap:6px;flex-wrap:nowrap">${a.sec === 'Medição' ? `<button class="btn sm pri" data-act="new">Registrar</button>` : ''}<button class="btn sm ${a.sec === 'Medição' ? '' : 'pri'}" data-act="pl-done" data-k="${esc(a.key)}">Feito</button><button class="btn sm" data-act="pl-snooze" data-k="${esc(a.key)}">+10 min</button></span></div>`).join('');
}
setInterval(() => { if (S.route === 'painel' && !document.getElementById('sheet-bg')) { const k = plPending().map(x => x.key).join(','); if (k !== (S._pk || '')) render(); } }, 30000);

/* ----- Telas ----- */
/* A roleta de Ui escreve no campo de dose (texto livre) só o trecho "N Ui" do começo; o resto do texto do usuário fica como está. */
const PL_DOSE_RE = /^\s*(\d+(?:[.,]\d+)?)\s*(?:ui|u)?\b\s*/i;
const plDoseUi = d => { const m = PL_DOSE_RE.exec(d || ''); return m ? m[1] : null; };
function plDoseWrite(old, un) { const rest = String(old || '').replace(PL_DOSE_RE, '').trim(); const head = un ? fU(un) : ''; return (head + (head && rest ? ' · ' : '') + rest).slice(0, 120); }
document.addEventListener('change', e => {
  const el = e.target; if (!el.id || !el.id.startsWith('pl-du-')) return;
  const t = document.getElementById('pl-d-' + el.id.slice(6)); if (!t) return;
  const u = parseUnits(el.value); t.value = plDoseWrite(t.value, u === 'bad' ? null : u);
  t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true }));
});
/* selos de situação de um item (não dependem só de cor) */
function plBadges(it) {
  const b = [];
  if (it.paused) b.push('<span class="tag">⏸ Suspenso</span>'); if (it.sug) b.push('<span class="tag warn">A confirmar</span>');
  if ((it.guess || []).length) b.push('<span class="tag warn">Horário a confirmar</span>');
  if (!(it.name || '').trim()) b.push('<span class="tag warn">Falta o nome</span>');
  return b.length ? `<span class="pl-bd">${b.join('')}</span>` : '';
}
/* lembretes associados ao item (cadastro do tratamento e lembretes de insulina) */
function plRemInfo(it) {
  const tm = plRealTimes(it); if (!tm.length) return '';
  const cov = t => typeof irCoversTime === 'function' && irCoversTime(it.id, t);
  const rows = tm.map(t => `<span class="tag">${t} · ${cov(t) ? 'lembrete de insulina' : (it.alarm && !(it.off || []).includes(t) ? 'ligado' : 'desligado')}</span>`).join('');
  return `<div class="pl-rinfo"><span class="fl">Lembretes deste item</span><div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px">${rows}</div></div>`;
}
function plItemHTML(sec, it) {
  const open = S.planOpen[it.id], n = it.times.length;
  const times = it.times.map((t, i) => `<div class="field"><label class="fl" for="pl-t-${it.id}-${i}">Horário ${i + 1}</label><input class="in" type="time" id="pl-t-${it.id}-${i}" data-pl="time" data-i="${i}" value="${t}"></div>`).join('');
  const nameLb = sec === 'checks' ? 'O que medir' : sec === 'meds' ? 'Medicamento' : 'Insulina';
  return `<details class="pl-it" data-id="${it.id}" data-sec="${sec}" ${open ? 'open' : ''}><summary><span class="pl-s"><b data-pl-name>${esc(it.name || 'Sem nome')}</b><small data-pl-sum>${esc(plTimesTxt(it))}${it.alarm && n ? ' · alarme ligado' : ''}</small>${plBadges(it)}</span></summary>
    <div class="pl-b"><div class="form-grid"><div class="field full"><label class="fl" for="pl-n-${it.id}">${nameLb}</label><input class="in" id="pl-n-${it.id}" data-pl="name" value="${esc(it.name)}" maxlength="80"></div>
    <div class="field full"><label class="fl" for="pl-c-${it.id}">Quantas vezes por dia</label><select class="in" id="pl-c-${it.id}" data-pl="count"><option value="0" ${n === 0 ? 'selected' : ''}>Só quando necessário</option>${[1, 2, 3, 4, 5, 6, 7, 8].map(c => `<option value="${c}" ${n === c ? 'selected' : ''}>${c} ${c === 1 ? 'vez' : 'vezes'} ao dia</option>`).join('')}</select></div>${times}
    ${n ? `<div class="field full"><span class="fl">Dias da semana</span><div class="row" style="gap:6px">${PL_WD.map((w, d) => `<label class="bl-chk"><input type="checkbox" data-pl="day" data-d="${d}" ${!it.days.length || it.days.includes(d) ? 'checked' : ''}><span>${w}</span></label>`).join('')}</div><small class="hint" style="display:block;margin-top:4px">Vale para todos os horários deste item. Desmarque os dias em que não usa.</small></div>` : ''}
    ${sec === 'insulin' ? `<div class="field full"><label class="fl">Unidades por aplicação (Ui) · gire para escolher</label>${uipHTML({ id: 'pl-du-' + it.id, value: plDoseUi(it.dose), label: 'Unidades por aplicação' })}</div>` : ''}${sec === 'checks' ? '' : `<div class="field full"><label class="fl" for="pl-d-${it.id}">Dose indicada pela equipe</label><input class="in" id="pl-d-${it.id}" data-pl="dose" value="${esc(it.dose)}" maxlength="120" placeholder="Ex.: 1 comprimido · 10 Ui (como a equipe indicou)"></div>`}
    <div class="field full"><label class="fl" for="pl-o-${it.id}">Observações</label><input class="in" id="pl-o-${it.id}" data-pl="notes" value="${esc(it.notes)}" maxlength="200" placeholder="Ex.: junto com o almoço"></div></div>
    <label class="al-l pl-sw"><input type="checkbox" class="swt" role="switch" data-pl="alarm" ${it.alarm ? 'checked' : ''} ${n ? '' : 'disabled'}><span><b>Alarme nestes horários</b><small>${n ? 'Faixa no Início (e notificação no aplicativo Android) na hora marcada.' : 'Defina horários para poder ligar o alarme.'}</small></span></label>
    ${sec === 'insulin' && typeof irCoversTime === 'function' && it.times.some(t => irCoversTime(it.id, t)) ? '<p class="hint" style="margin:8px 0 0">Os avisos dos horários desta insulina que têm lembrete próprio são feitos em <b>Lembretes de insulina</b> (com confirmação da aplicação), por isso não aparecem na lista de lembretes do tratamento.</p><button class="btn sm" style="margin-top:8px" data-act="go" data-r="insrem">Abrir Lembretes de insulina</button>' : ''}
    ${sec === 'insulin' ? `<div class="field full pl-gate"><label class="al-l pl-sw"><input type="checkbox" class="swt" role="switch" data-pl="gate-on" ${it.gate && it.gate.on ? 'checked' : ''}><span><b>Condição para registrar (opcional)</b><small>Só libera o botão de confirmar depois de uma glicemia de hoje a partir do valor abaixo. Regra sua, definida com a equipe; o app só compara e não recomenda dose.</small></span></label>${it.gate && it.gate.on ? `<label class="fl" for="pl-g-${it.id}">Glicemia mínima para liberar (mg/dL)</label><input class="in" id="pl-g-${it.id}" data-pl="gate-min" inputmode="numeric" value="${it.gate.min || ''}" placeholder="Ex.: 140">` : ''}</div>` : ''}
    ${plRemInfo(it)}
    ${it.sug ? `<p class="hint" style="margin:10px 0 0"><b>Item do modelo, a confirmar.</b> Não aparece no Início nem gera lembretes até você conferir o nome, os horários e a dose com a sua equipe.</p><button class="btn pri full" style="margin-top:8px" data-act="pl-confirm" data-id="${it.id}" data-sec="${sec}">Confirmar este item</button>` : ''}
    ${(it.guess || []).length ? `<p class="hint" style="margin:10px 0 0"><b>Horário a confirmar:</b> ${esc(it.guess.join(' · '))}. É só um valor inicial, não um horário prescrito. Ajuste ao que a equipe indicou ou confirme.</p><button class="btn full" style="margin-top:8px" data-act="pl-confirm-times" data-id="${it.id}" data-sec="${sec}">Confirmar horários</button>` : ''}
    <div class="pl-mg"><button class="btn" data-act="pl-dup" data-id="${it.id}" data-sec="${sec}">Duplicar</button><button class="btn" data-act="pl-pause" data-id="${it.id}" data-sec="${sec}">${it.paused ? 'Reativar' : 'Suspender'}</button></div>
    <button class="btn full danger" style="margin-top:10px" data-act="pl-del" data-id="${it.id}" data-sec="${sec}">Remover da lista</button></div></details>`;
}
const PL_INS_GROUPS = [['basal', 'Basais'], ['rapida', 'Rápidas e ultrarrápidas'], ['mista', 'Mistas'], ['outra', 'Outras']];
function plListCard(sec, title, hint, addLabel) {
  const items = S.plan[sec];
  let body;
  if (sec === 'insulin') body = PL_INS_GROUPS.map(([r, t]) => { const l = items.filter(it => (PL_INS_GROUPS.some(g => g[0] === it.role) ? it.role : 'outra') === r); return l.length ? `<div class="pl-grp"><p class="eyebrow" style="margin:4px 0 6px">${t} · ${l.length}</p><div class="stack" style="gap:8px">${l.map(it => plItemHTML(sec, it)).join('')}</div></div>` : ''; }).join('');
  else body = items.length ? `<div class="stack" style="gap:8px">${items.map(it => plItemHTML(sec, it)).join('')}</div>` : '';
  return `<h2 class="sec">${title}</h2><div class="card pl-card"><p class="hint" style="margin:0 0 10px">${hint}</p><div class="stack" style="gap:10px">${body || '<p class="dim" style="margin:0;font-size:14.5px">Nada cadastrado ainda.</p>'}<button class="btn full" data-act="pl-add" data-sec="${sec}">+ ${addLabel}</button></div></div>`;
}
function plPumpCard() {
  const p = S.plan.pump, due = p.lastChange ? isoDate(new Date(addDays(mkTs(p.lastChange, '12:00'), p.siteDays))) : '';
  const known = PL_PUMPS.includes(p.model);
  return `<h2 class="sec">Bomba de insulina</h2><div class="card pl-card" id="pl-pump"><p class="hint" style="margin:0 0 10px">Anote o modelo, as observações do seu perfil e a troca do cateter. O app não programa nem controla a bomba.</p><div class="form-grid">
    <div class="field full"><label class="fl" for="pp-model">Modelo</label><select class="in" id="pp-model" data-pp="model"><option value="">Não informado</option>${PL_PUMPS.map(m => `<option ${p.model === m ? 'selected' : ''}>${m}</option>`).join('')}${p.model && !known ? `<option selected>${esc(p.model)}</option>` : ''}</select></div>
    <div class="field full"><label class="fl" for="pp-notes">Observações (perfil basal, relação insulina/carboidrato, sensor…)</label><textarea class="in" id="pp-notes" data-pp="notes" maxlength="300" placeholder="Como a equipe configurou">${esc(p.notes)}</textarea></div>
    <div class="field"><label class="fl" for="pp-days">Trocar cateter a cada</label><select class="in" id="pp-days" data-pp="siteDays">${[2, 3, 4, 5].map(d => `<option value="${d}" ${p.siteDays === d ? 'selected' : ''}>${d} dias</option>`).join('')}</select></div>
    <div class="field"><label class="fl" for="pp-last">Última troca</label><input class="in" type="date" id="pp-last" data-pp="lastChange" value="${p.lastChange}" max="${isoDate(new Date())}"></div>
    <div class="field"><label class="fl" for="pp-time">Avisar às</label><input class="in" type="time" id="pp-time" data-pp="siteTime" value="${p.siteTime}"></div></div>
    <p class="hint" style="margin:8px 0">${due ? `Próxima troca: <b class="num">${fmtDate(due)}</b>.` : 'Informe a data da última troca para calcular a próxima.'}</p>
    <label class="al-l pl-sw"><input type="checkbox" class="swt" role="switch" data-pp="alarm" ${p.alarm ? 'checked' : ''}><span><b>Alarme da troca do cateter</b><small>Aviso no dia da troca, até você tocar em “Feito”.</small></span></label>
    ${p.lastChange ? `<button class="btn full" style="margin-top:10px" data-act="pl-pump-now">Troquei o cateter hoje</button>` : ''}</div>`;
}

/* ----- Lembretes do tratamento: lista central, uma linha por horário ----- */
function plPlatform() {
  const nat = typeof IS_NATIVE !== 'undefined' && IS_NATIVE;
  if (nat) {
    const n = window.TB_PLAN_N, perm = window.TB_PLAN_PERM;
    if (perm === false) return '<div class="banner warn" style="margin:0 0 12px"><span><b>Notificações bloqueadas.</b> Ative em Configurações do Android → Apps → GLUXO → Notificações. Sem isso, os lembretes não tocam com o app fechado.</span></div>';
    if (typeof n === 'number') return `<p class="hint" style="margin:0 0 12px">✓ ${n ? n + ' notificaç' + (n === 1 ? 'ão agendada' : 'ões agendadas') + ' no celular. Tocam com o app fechado e são refeitas sozinhas quando você altera o tratamento.' : 'Nenhuma notificação agendada agora.'}</p>`;
    return '<p class="hint" style="margin:0 0 12px">Verificando as notificações do celular…</p>';
  }
  return '<div class="banner" style="margin:0 0 12px"><span><b>Aqui o lembrete aparece como faixa no Início, com o app aberto.</b> Para tocar com o app fechado, use o aplicativo Android (APK) do GLUXO.</span></div>';
}
function plRemindersCard() {
  const c = alCfg(), all = plCollect(true), p = S.plan;
  const rows = all.map(a => { const quiet = !a.off && plQuietAt(a.time);
    return `<div class="pl-r ${a.off ? 'off' : ''}"><label class="pl-rs"><input type="checkbox" class="swt" role="switch" data-plr="${esc(a.key)}" data-sec="${a.secKey}" ${a.off ? '' : 'checked'} aria-label="Lembrete ${esc(a.label)} às ${a.time}"></label>
      <button class="pl-rb" data-act="pl-rem-edit" data-k="${esc(a.key)}" data-sec="${a.secKey}"><span class="pl-rt num">${a.time}</span><span class="pl-ri"><b>${esc(a.label)}</b><small>${esc(a.sec)} · ${esc(plDaysTxt(a))}${a.dose && a.sec !== 'Medição' ? ' · ' + esc(a.dose) : ''}${quiet ? ' · não toca no silêncio noturno' : ''}</small></span><span class="pl-re" aria-hidden="true">Editar</span></button></div>`; }).join('');
  const pump = p.types.includes('bomba') && p.pump.alarm && p.pump.lastChange ? `<p class="hint" style="margin:10px 0 0">Bomba: aviso de troca do cateter a cada ${p.pump.siteDays} dias, às ${esc(p.pump.siteTime)} (conforme você definiu).</p>` : '';
  return `<h2 class="sec">Lembretes do tratamento</h2><div class="card pl-card">${plPlatform()}
    <label class="al-l pl-sw"><input type="checkbox" class="swt" role="switch" data-plm="plan" ${c.plan ? 'checked' : ''}><span><b>Lembretes ligados</b><small>Chave geral de todos os lembretes do tratamento.</small></span></label>
    ${c.quiet ? `<label class="al-l pl-sw"><input type="checkbox" class="swt" role="switch" data-plm="plQuiet" ${c.plQuiet ? 'checked' : ''}><span><b>Respeitar o silêncio noturno</b><small>${esc(c.qFrom)} às ${esc(c.qTo)}. Desligado, os horários de tratamento tocam mesmo nesse período.</small></span></label>` : ''}
    <div class="pl-rl">${rows || '<p class="hint" style="margin:10px 0 0">Nenhum lembrete ainda. Cadastre horários nos itens de insulina, remédios e medições abaixo.</p>'}</div>${pump}
    <p class="hint" style="margin:12px 0 0">Os lembretes usam só os medicamentos, doses e horários que <b>você</b> cadastrou. O app não cria nem muda horários de dose. Mudou o tratamento? Fale com a sua equipe e atualize aqui: os alarmes se ajustam sozinhos.</p>
    <details class="pl-it" style="margin-top:12px"><summary><span class="pl-s"><b>Limitações por plataforma</b><small>Android, aplicativo instalado e navegador</small></span></summary><div class="pl-b hint" style="line-height:1.5">
    <p style="margin:0 0 8px"><b>Aplicativo Android (APK).</b> Agenda alarmes no sistema: tocam com o app fechado e são refeitos quando você altera o tratamento. Podem falhar se: a permissão de notificações estiver negada; a economia de bateria do fabricante (Xiaomi, Samsung, Huawei e outros) travar o app, então deixe o GLUXO “sem restrição”; o modo Não perturbe estiver ligado; ou o app for forçado a parar (abra-o uma vez para voltar). Depois de reiniciar o celular, abra o app uma vez para garantir.</p>
    <p style="margin:0 0 8px"><b>Aplicativo instalado pelo navegador.</b> Sem servidor, o navegador não permite agendar notificação com o app fechado, e no iPhone isso exige envio por servidor. Só aparece a faixa no Início com o app aberto.</p>
    <p style="margin:0"><b>Versão web dentro do Claude.</b> Igual ao aplicativo instalado: faixa no Início enquanto a página está aberta.</p></div></details></div>`;
}
function plRemEdit(key, sec) {
  const it = S.plan[sec] && S.plan[sec].find(x => key.startsWith(x.id + '@')), t = key.slice(key.indexOf('@') + 1); if (!it) return '';
  const on = it.alarm && !(it.off || []).includes(t);
  return `<h2>Editar lembrete</h2><p class="hint" style="margin:0 0 12px"><b>${esc(it.name || 'Sem nome')}</b>${it.dose ? ' · ' + esc(it.dose) : ''}. Nome e dose se editam no item, em Meu tratamento.</p>
    <div class="stack"><div class="field"><label class="fl" for="plr-t">Horário</label><input class="in" type="time" id="plr-t" value="${t}"></div>
    <div class="field"><span class="fl">Dias da semana (vale para todos os horários deste item)</span><div class="row" style="gap:6px">${PL_WD.map((w, d) => `<label class="bl-chk"><input type="checkbox" class="plr-d" data-d="${d}" ${!it.days.length || it.days.includes(d) ? 'checked' : ''}><span>${w}</span></label>`).join('')}</div></div>
    <label class="al-l pl-sw"><input type="checkbox" class="swt" role="switch" id="plr-on" ${on ? 'checked' : ''}><span><b>Lembrete ligado</b></span></label>
    <p class="err" id="plr-err" role="alert"></p><button class="btn pri full" data-act="pl-rem-save" data-id="${it.id}" data-sec="${sec}" data-t="${t}">Salvar</button><button class="btn full" data-act="close">Cancelar</button></div>`;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act="pl-rem-edit"],[data-act="pl-rem-save"]'); if (!el) return;
  if (el.dataset.act === 'pl-rem-edit') { const h = plRemEdit(el.dataset.k, el.dataset.sec); if (h) openSheet(h); return; }
  const it = S.plan[el.dataset.sec].find(x => x.id === el.dataset.id); if (!it) return; const t0 = el.dataset.t, t1 = $('#plr-t').value, err = m => { $('#plr-err').textContent = m; };
  if (!plTime(t1)) return err('Informe um horário válido.');
  if (t1 !== t0 && it.times.includes(t1)) return err('Este item já tem um lembrete nesse horário.');
  const days = [...document.querySelectorAll('.plr-d')].filter(x => x.checked).map(x => +x.dataset.d); if (!days.length) return err('Marque pelo menos um dia.');
  const on = $('#plr-on').checked; it.times = it.times.map(x => x === t0 ? t1 : x).sort(); it.off = (it.off || []).filter(x => x !== t0 && x !== t1); if (!on) it.off.push(t1); else it.alarm = true;
  it.days = days.length === 7 ? [] : days; await plSave(); closeSheet(); render(); toast('Lembrete atualizado.');
});
document.addEventListener('change', async e => {
  const t = e.target; if (!t.dataset) return;
  if (t.dataset.plm) { S.alerts = { ...(S.alerts || {}), [t.dataset.plm]: t.checked }; await alSave(); render(); return; }
  if (t.dataset.plr) { const key = t.dataset.plr, it = S.plan[t.dataset.sec].find(x => key.startsWith(x.id + '@')), tm = key.slice(key.indexOf('@') + 1); if (!it) return;
    it.off = (it.off || []).filter(x => x !== tm); if (t.checked) it.alarm = true; else it.off.push(tm); await plSave(); render(); }
});
/* ---- Central Meu tratamento (dentro do Meu perfil) ---- */
function dbCard() {
  const p = S.profile || {}, { cat, sub } = dbSel(p), c = DB_BY[cat];
  const opts = DB_CATS.filter(x => x.k !== 'insipido').map(x => `<option value="${x.k}" ${cat === x.k ? 'selected' : ''}>${x.n}</option>`).join('');
  return `<h2 class="sec">Diabetes</h2><div class="card pl-card"><div class="field"><label class="fl" for="db-cat">Tipo de diabetes</label><select class="in" id="db-cat"><option value="">Não informado</option>${opts}<optgroup label="Não é diabetes mellitus"><option value="insipido" ${cat === 'insipido' ? 'selected' : ''}>Diabetes insípido</option></optgroup></select></div>
    ${c && c.subs.length ? `<div class="field" style="margin-top:12px"><label class="fl" for="db-sub">${c.sl}</label><select class="in" id="db-sub"><option value="">${cat === 'insipido' ? 'Ainda não confirmado' : 'Não sei ou não confirmado'}</option>${c.subs.map(x => `<option value="${x[0]}" ${sub === x[0] ? 'selected' : ''}>${x[1]}</option>`).join('')}</select></div>` : ''}
    ${cat === 'insipido' ? `<div class="banner warn" style="margin:12px 0 0"><span><b>Diabetes insípido não é diabetes mellitus.</b> É outra doença, rara, ligada ao hormônio antidiurético e aos rins: causa muita sede e muita urina, mas não tem relação com a glicemia nem com a insulina. O nome parecido costuma confundir.</span></div>` : c && c.info ? `<p class="hint" style="margin:10px 0 0">${c.info}</p>` : ''}
    <div class="field" style="margin-top:12px"><label class="fl" for="db-note">Informações complementares (opcional)</label><input class="in" id="db-note" maxlength="200" autocomplete="off" value="${esc(p.dnote || '')}" placeholder="Ex.: ano do diagnóstico, observações da equipe"></div>
    <small class="hint" style="display:block;margin-top:8px">Pode mudar quando quiser. Muda também no Perfil, nos relatórios e no modelo de tratamento.</small></div>`;
}
document.addEventListener('change', async e => {
  const t = e.target; if (t.id !== 'db-cat' && t.id !== 'db-sub' && t.id !== 'db-note') return;
  const cur = S.profile || {}, up = t.id === 'db-cat' ? { dcat: t.value, dsub: '' } : t.id === 'db-sub' ? { dsub: t.value } : { dnote: t.value.trim() };
  S.profile = pfClean({ ...cur, dcat: dbSel(cur).cat, dsub: dbSel(cur).sub, ...up }); S.profPrompt = false; await pfSave(); render(); toast('Tipo de diabetes atualizado.');
});
function plOthersCard() {
  const l = S.plan.others;
  return `<h2 class="sec">Outros tratamentos</h2><div class="card pl-card"><p class="hint" style="margin:0 0 10px">Outros meios que a sua equipe indicou, como alimentação planejada, atividade física, sensor, terapia nutricional ou acompanhamento. Só para você anotar: não gera alarmes.</p>
    <div class="stack" style="gap:8px">${l.map(o => `<div class="pl-oth" data-id="${o.id}"><div class="field"><label class="fl" for="po-n-${o.id}">Tratamento</label><input class="in" id="po-n-${o.id}" data-po="name" maxlength="80" value="${esc(o.name)}"></div><div class="field" style="margin-top:8px"><label class="fl" for="po-o-${o.id}">Observações</label><input class="in" id="po-o-${o.id}" data-po="notes" maxlength="200" value="${esc(o.notes)}"></div><button class="btn sm danger" style="margin-top:8px" data-act="po-del" data-id="${o.id}">Remover</button></div>`).join('') || '<p class="dim" style="margin:0;font-size:14.5px">Nada cadastrado ainda.</p>'}
    <button class="btn full" data-act="po-add">+ Adicionar outro tratamento</button></div></div>`;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act="po-add"],[data-act="po-del"]'); if (!el) return;
  if (el.dataset.act === 'po-add') S.plan.others.push({ id: uid(), name: '', notes: '' }); else S.plan.others = S.plan.others.filter(x => x.id !== el.dataset.id);
  await plSave(); render();
});
document.addEventListener('change', async e => {
  const t = e.target, k = t.dataset && t.dataset.po; if (!k) return; const box = t.closest('.pl-oth'), o = box && S.plan.others.find(x => x.id === box.dataset.id); if (!o) return;
  o[k] = t.value.trim().slice(0, k === 'name' ? 80 : 200); await plSave(); toast('Salvo.');
});
function plSettingsCard() {
  return `<h2 class="sec">Configurações do tratamento</h2><div class="card pl-card"><div class="stack" style="gap:8px"><button class="btn full" data-act="go" data-r="bolus">Razão insulina/carboidratos e bolus</button><button class="btn full" data-act="go" data-r="config">Roleta de insulina (máximo por aplicação)</button></div></div>
  <h2 class="sec">Histórico do tratamento</h2><div class="card pl-card"><div class="stack" style="gap:8px"><button class="btn full" data-act="go" data-r="insulinas">Histórico de insulinas</button><button class="btn full" data-act="go" data-r="historico">Histórico de medições</button></div><p class="hint" style="margin:10px 0 0">Esquemas anteriores e comparação ficam no fim desta página.</p></div>
  <div class="card" style="margin-top:12px"><div class="row sp" style="gap:10px"><span><b>Avisos e lembretes</b><br><span class="dim" style="font-size:14px">Ficam em uma área própria, separada do tratamento.</span></span><button class="btn sm" data-act="go" data-r="lembretes">Abrir</button></div></div>`;
}
function planCards() {
  const type = (S.profile || {}).type || '', pre = PL_PRESETS[type], p = S.plan, on = k => p.types.includes(k);
  const sw = ([k, t, d]) => `<label class="al-l pl-sw"><input type="checkbox" class="swt" role="switch" data-ptype="${k}" ${on(k) ? 'checked' : ''}><span><b>${t}</b><small>${d}</small></span></label>`;
  let h = `<div class="banner warn" style="margin:0 0 12px"><span><b>O GLUXO não substitui a consulta com a sua equipe de saúde.</b> Medicamentos, doses e horários devem ser os que ela indicou. O app só organiza as informações e lembra.</span></div>` + (typeof trSummaryCard === 'function' ? trSummaryCard() : '') + dbCard();
  h += `<h2 class="sec">Como você trata</h2><div class="card pl-card">
    ${pre ? `<p class="hint" style="margin:0">${esc(pre.intro)}</p>${pre.tips.map(t => `<p class="hint" style="margin:6px 0 0">• ${esc(t)}</p>`).join('')}<button class="btn full" style="margin-top:12px" data-act="pl-preset">Ver sugestão de modelo para ${esc(type)}</button><p class="hint" style="margin:8px 0 0">O modelo é só uma sugestão: entra “a confirmar”, sem horários, sem dose e sem lembretes. Nada é ativado sem a sua confirmação.</p>`
      : `<p class="hint" style="margin:0">${type && type !== 'Prefiro não informar' ? 'Para este tipo não há modelo pronto.' : 'Escolha o tipo de diabetes acima para ver um modelo de tratamento do seu tipo.'} Você também pode montar o seu do zero abaixo.</p>`}
    <p class="eyebrow" style="margin:16px 0 4px">Que tipo de tratamento você usa?</p><p class="hint" style="margin:0 0 6px">Pode marcar mais de um.</p>${PL_TYPES.map(sw).join('')}</div>`;
  if (on('insulina')) h += plListCard('insulin', 'Insulinas', 'Cadastre cada insulina que você usa, quantas vezes por dia e em quais horários. Toque em um item para editar.', 'Adicionar insulina');
  if (on('remedios')) h += plListCard('meds', 'Outros medicamentos', 'Comprimidos e injetáveis que não são insulina, separados das insulinas. Cadastre o nome, quantas vezes por dia, os horários e a dose que a equipe indicou. Toque em um item para editar.', 'Adicionar medicamento');
  if (on('bomba')) h += plPumpCard();
  h += plOthersCard();
  h += plListCard('checks', 'Medições programadas', 'Horários em que você quer ser lembrado de medir a glicemia. Os alarmes aparecem como faixa no Início.', 'Adicionar medição');
  return h + plRemindersCard() + (typeof trManageCards === 'function' ? trManageCards() : '') + plSettingsCard();
}
function plPicker(sec) {
  const groups = sec === 'insulin' ? PL_INS.map(g => [g[0], g[2], g[1]]) : PL_MEDS.map(g => [g[0], g[1], 'oral']);
  return `<h2>${sec === 'insulin' ? 'Adicionar insulina' : 'Adicionar medicamento'}</h2><p class="hint" style="margin:0 0 10px">Toque em um grupo para abrir a lista e escolha. Depois você define as vezes por dia e os horários.</p>
    <div class="stack" style="gap:8px">${groups.map((g, gi) => `<details class="pl-it"><summary><span class="pl-s"><b>${esc(g[0])}</b><small>${g[1].length} opções</small></span></summary><div class="pl-b stack" style="gap:6px">${g[1].map((n, ni) => `<button class="btn full" style="text-align:left" data-act="pl-pick" data-sec="${sec}" data-g="${gi}" data-n="${ni}">${esc(n)}</button>`).join('')}</div></details>`).join('')}
    <button class="btn full" data-act="pl-pick" data-sec="${sec}" data-g="-1">Outro (digitar o nome)</button><button class="btn full" data-act="close">Cancelar</button></div>`;
}
function plAddItem(sec, name, role, cat) {
  const it = plItem0({ name, role, times: [], alarm: false, cat: cat || '' }); S.plan[sec].push(it); plLog('Adicionou: ' + (name || 'item sem nome')); S.planOpen[it.id] = true;
  const ty = sec === 'insulin' ? 'insulina' : sec === 'meds' ? 'remedios' : ''; if (ty && !S.plan.types.includes(ty)) S.plan.types.push(ty);
  return it;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act^="pl-"]'); if (!el) return; const a = el.dataset.act, sec = el.dataset.sec;
  try {
    if (a === 'pl-add') { if (sec === 'checks') { plAddItem('checks', 'Glicemia', '', ''); await plSave(); render(); } else openSheet(plPicker(sec)); }
    else if (a === 'pl-pick') {
      const g = +el.dataset.g; let name = '', role = sec === 'insulin' ? 'outra' : 'oral';
      if (g >= 0) { name = sec === 'insulin' ? PL_INS[g][2][+el.dataset.n] : PL_MEDS[g][1][+el.dataset.n]; if (sec === 'insulin') role = PL_INS[g][1]; }
      const cat = g >= 0 ? (sec === 'insulin' ? PL_INS[g][0] : PL_MEDS[g][0]) : ''; plAddItem(sec, name, role, cat); await plSave(); closeSheet(); render(); toast('Adicionado. Defina as vezes por dia e os horários; o lembrete fica desligado até você ligar.');
    }
    else if (a === 'pl-del') { const it = S.plan[sec].find(x => x.id === el.dataset.id); if (!it) return; if (el.dataset.ask !== '1') { el.dataset.ask = '1'; el.textContent = 'Toque de novo para remover'; setTimeout(() => { if (el.isConnected) { el.dataset.ask = ''; el.textContent = 'Remover da lista'; } }, 4000); return; } S.plan[sec] = S.plan[sec].filter(x => x.id !== it.id); delete S.planOpen[it.id]; plLog('Removeu: ' + (it.name || 'item')); await plSave(); render(); toast('Removido. Os registros de aplicações já feitos continuam no histórico.'); }
    else if (a === 'pl-preset') {
      const type = (S.profile || {}).type, pre = PL_PRESETS[type]; if (!pre) return;
      openSheet(`<h2>Usar modelo para ${esc(type)}</h2><p class=\"hint\" style=\"margin:0 0 10px\">O modelo é só uma <b>sugestão de estrutura</b>. Os itens entram marcados como <b>“a confirmar”</b>, sem horários, sem dose e com os lembretes desligados. Nada aparece como tratamento ativo no Início até você revisar e confirmar cada item.</p><p class=\"hint\" style=\"margin:0 0 12px\">O que você já cadastrou é mantido.</p><div class=\"stack\"><button class=\"btn pri full\" data-act=\"pl-preset-do\">Adicionar sugestões</button><button class=\"btn full\" data-act=\"close\">Cancelar</button></div>`);
    }
    else if (a === 'pl-preset-do') {
      const type = (S.profile || {}).type, pre = PL_PRESETS[type]; if (!pre) return; let added = 0;
      const mk = (k, list) => list.forEach(x => { if (S.plan[k].some(y => (y.name || '').trim().toLowerCase() === x.name.toLowerCase())) return; S.plan[k].push(plItem0({ name: x.name, role: x.role, times: [], alarm: false, sug: true })); added++; });
      mk('insulin', pre.insulin); mk('meds', pre.meds); mk('checks', pre.checks);
      S.plan.types = [...new Set([...S.plan.types, ...pre.types])]; plLog('Adicionou sugestões do modelo ' + type + ' (' + added + ' itens a confirmar)');
      await plSave(); closeSheet(); render(); toast(added ? 'Sugestões adicionadas. Revise e confirme cada item.' : 'Os itens do modelo já estavam na lista.');
    }
    else if (a === 'pl-dup') {
      const it = S.plan[sec].find(x => x.id === el.dataset.id); if (!it) return;
      const cp = plItem0({ ...it, name: (it.name || 'Item') + ' (cópia)', alarm: false, off: [], paused: false, sug: false, guess: [] }); S.plan[sec].push(cp); S.planOpen[cp.id] = true; plLog('Duplicou: ' + (it.name || 'item'));
      await plSave(); render(); toast('Item duplicado. O lembrete da cópia fica desligado até você ligar.');
    }
    else if (a === 'pl-pause') {
      const it = S.plan[sec].find(x => x.id === el.dataset.id); if (!it) return; it.paused = !it.paused; plLog((it.paused ? 'Suspendeu: ' : 'Reativou: ') + (it.name || 'item'));
      await plSave(); render(); toast(it.paused ? 'Item suspenso. O histórico de aplicações foi mantido.' : 'Item reativado.');
    }
    else if (a === 'pl-confirm') {
      const it = S.plan[sec].find(x => x.id === el.dataset.id); if (!it) return; it.sug = false; it.guess = []; plLog('Confirmou: ' + (it.name || 'item'));
      await plSave(); render(); toast('Item confirmado.');
    }
    else if (a === 'pl-confirm-times') {
      const it = S.plan[sec].find(x => x.id === el.dataset.id); if (!it) return; it.guess = []; plLog('Confirmou os horários de: ' + (it.name || 'item'));
      await plSave(); render(); toast('Horários confirmados.');
    }
    else if (a === 'pl-done') {
      plDoneRoll(); const k = el.dataset.k, day = S.planDone.day;
      if (k.startsWith('pump@')) { S.planDone.map[k] = 1; S.plan.pump.lastChange = isoDate(new Date()); await plSave(); await adSave(); render(); return; }
      const al = planAlarms(day).find(x => x.key === k);
      if (al && al.sec === 'Insulina') { /* "Feito" numa insulina é registrar a aplicação: a mesma ação de Meu tratamento (um único registro, sem duplicar) */
        const it = plItemOf(al), occ = plOccId(day, k);
        if (plInsMatched(day)[occ]) { render(); toast('Esta aplicação já estava registrada no histórico. Nada foi duplicado.'); return; }
        const res = await doseConfirm({ kind: plAlarmKind(al), name: it && it.name, occ, insulin: it && it.name, insId: it ? it.id : '', sched: al.time, src: 'tratamento' }); if (res.dup && !res.rec) return;
        toast(res.dup ? 'Esta aplicação já estava registrada. Nada foi duplicado.' : 'Aplicação registrada no histórico. A dose não foi preenchida.');
      }
      S.planDone.map[k] = 1; await adSave(); render();
    }
    else if (a === 'pl-snooze') { plDoneRoll(); S.planDone.map[el.dataset.k] = Date.now() + 10 * 60000; await adSave(); render(); toast('Aviso adiado por 10 minutos.'); }
    else if (a === 'pl-pump-now') { S.plan.pump.lastChange = isoDate(new Date()); await plSave(); render(); toast('Troca registrada.'); }
  } catch (err) { console.error(err); toast('Algo deu errado: ' + (err && err.message || err)); }
});
document.addEventListener('toggle', e => { const d = e.target; if (d.classList && d.classList.contains('pl-it') && d.dataset.id) S.planOpen[d.dataset.id] = d.open; }, true);
document.addEventListener('change', async e => {
  const t = e.target; 
  if (!t.dataset) return;
  if (t.dataset.ptype) { const k = t.dataset.ptype; S.plan.types = t.checked ? [...new Set([...S.plan.types, k])] : S.plan.types.filter(x => x !== k); await plSave(); render(); return; }
  if (t.dataset.pp) { const k = t.dataset.pp, p = S.plan.pump; if (k === 'alarm') p.alarm = t.checked; else if (k === 'siteDays') p.siteDays = +t.value; else if (k === 'siteTime') p.siteTime = plTime(t.value) ? t.value : p.siteTime; else p[k] = t.value; await plSave(); if (k === 'lastChange' || k === 'siteDays') render(); return; }
  const k = t.dataset.pl; if (!k) return; const box = t.closest('.pl-it'); if (!box) return; const sec = box.dataset.sec, it = S.plan[sec].find(x => x.id === box.dataset.id); if (!it) return;
  if (k === 'name') { plLog('Renomeou: ' + (it.name || 'item') + ' → ' + (t.value.trim() || 'sem nome')); it.name = t.value.trim().slice(0, 80); const b = box.querySelector('[data-pl-name]'); if (b) b.textContent = it.name || 'Sem nome'; }
  else if (k === 'dose') it.dose = t.value.slice(0, 120); else if (k === 'notes') it.notes = t.value.slice(0, 200);
  else if (k === 'time') { if (plTime(t.value)) { const old = it.times[+t.dataset.i]; it.times[+t.dataset.i] = t.value; it.times.sort(); it.off = (it.off || []).filter(x => x !== old); it.guess = (it.guess || []).filter(x => x !== old && x !== t.value); plLog('Alterou horário de: ' + (it.name || 'item')); } else return; }
  else if (k === 'day') { const set = new Set(it.days.length ? it.days : [0, 1, 2, 3, 4, 5, 6]); t.checked ? set.add(+t.dataset.d) : set.delete(+t.dataset.d); if (!set.size) { t.checked = true; toast('Deixe pelo menos um dia marcado, ou desligue o alarme.'); return; } it.days = set.size === 7 ? [] : [...set].sort(); }
  else if (k === 'gate-on') { it.gate = { on: t.checked, min: it.gate && it.gate.min ? it.gate.min : null }; plLog((t.checked ? 'Definiu condição de registro em: ' : 'Removeu a condição de registro de: ') + (it.name || 'item')); await plSave(); render(); return; }
  else if (k === 'gate-min') { const v = Math.round(Number(String(t.value).replace(',', '.'))); if (!(v >= 40 && v <= 600)) { toast('Informe um valor entre 40 e 600 mg/dL.'); return; } it.gate = { on: true, min: v }; plLog('Condição de registro de ' + (it.name || 'item') + ': glicemia a partir de ' + v); }
  else if (k === 'alarm') { it.alarm = t.checked; plLog((t.checked ? 'Ligou' : 'Desligou') + ' o lembrete de: ' + (it.name || 'item')); }
  else if (k === 'count') { const c = +t.value; while (it.times.length > c) it.times.pop(); it.off = (it.off || []).filter(x => it.times.includes(x)); while (it.times.length < c) { const nt = plNext(it.times); it.times.push(nt); (it.guess = it.guess || []).push(nt); } it.guess = (it.guess || []).filter(x => it.times.includes(x)); plLog('Frequência de ' + (it.name || 'item') + ': ' + c + ' por dia'); S.planOpen[it.id] = true; await plSave(); render(); return; }
  await plSave(); const s = box.querySelector('[data-pl-sum]'); if (s) s.textContent = plTimesTxt(it) + (it.alarm && it.times.length ? ' · alarme ligado' : '');
});

/* ----- Outras insulinas durante o dia ----- */
function extraInsForm() {
  const now = new Date(), names = [...new Set([...S.plan.insulin.map(x => x.name).filter(Boolean), ...PL_INS.flatMap(g => g[2])])];
  return `<h2>Adicionar outra insulina</h2><p class="hint" style="margin:0 0 12px">Para registrar uma dose além das chaves do dia (como uma correção indicada pela sua equipe). O app só registra: não sugere dose.</p>
  <form id="ins-extra-form" novalidate><div class="form-grid"><div class="field full"><label class="fl" for="ie-n">Insulina</label><input class="in" id="ie-n" list="ie-list" maxlength="80" autocomplete="off" placeholder="Escolha ou digite o nome"><datalist id="ie-list">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist></div>
  <div class="field"><label class="fl" for="ie-t">Horário</label><input class="in" type="time" id="ie-t" value="${HM(now.getTime())}"></div>
  <div class="field"><label class="fl">Unidades (Ui)</label>${uipHTML({ id: 'ie-u', label: 'Unidades de insulina' })}</div></div>
  <p class="err" id="ie-err" role="alert"></p><div class="stack" style="margin-top:10px"><button class="btn pri full" type="submit">Registrar</button><button class="btn full" type="button" data-act="close">Cancelar</button></div></form>`;
}
document.addEventListener('submit', async e => {
  if (e.target.id !== 'ins-extra-form') return; e.preventDefault();
  const name = $('#ie-n').value.trim().slice(0, 80), t = $('#ie-t').value, un = parseUnits($('#ie-u').value);
  if (name.length < 2) { $('#ie-err').textContent = 'Informe qual insulina foi.'; return; }
  if (!plTime(t)) { $('#ie-err').textContent = 'Informe o horário.'; return; }
  const ts = mkTs(isoDate(new Date()), t); if (ts > Date.now() + 60000) { $('#ie-err').textContent = 'Esse horário ainda não chegou hoje.'; return; }
  if (typeof un !== 'number' || !(un > 0)) { $('#ie-err').textContent = 'Informe as unidades (Ui) tomadas, entre 0,5 e 300.'; return; }
  const r = await logAdd('extra', ts, un); r.name = name; await logPut(r); closeSheet(); render(); toast('Registrado: ' + name + ' às ' + t + '.');
});
function extraInsCard() {
  const today = S.inslog.filter(x => x.kind === 'extra' && x.date === isoDate(new Date())).sort((a, b) => a.ts - b.ts);
  return `<div class="card" style="margin-top:12px"><div class="eyebrow">Outras insulinas · hoje</div>${today.length ? `<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:10px">${today.map(r => `<button class="btn sm" data-act="ins-log-edit" data-id="${r.id}">${esc(r.name || 'Outra insulina')} · ${HM(r.ts)}${r.units != null ? ' · ' + fU(r.units) : ''}</button>`).join('')}</div>` : '<p class="hint" style="margin:8px 0 0">Nenhuma outra insulina registrada hoje.</p>'}
    <button class="btn full" style="margin-top:12px" data-act="ins-extra">+ Adicionar outra insulina</button><p class="hint" style="margin:10px 0 0">Use só se a sua equipe orientou doses além das chaves acima. O app não sugere dose.</p></div>`;
}
document.addEventListener('click', e => { const el = e.target.closest('[data-act="ins-extra"]'); if (el) openSheet(extraInsForm()); });

/* ----- Painel: card "Meu tratamento" (muda conforme o que foi configurado em Meu tratamento) ----- */
function plCheckDone(t) { const [h, m] = t.split(':').map(Number), a = mkTs(isoDate(new Date()), t); return S.records.some(r => !isEx(r) && !r.noTime && r.date === isoDate(new Date()) && r.ts >= a - 30 * 60000 && r.ts <= a + 90 * 60000); }
function plChips(it, sec) {
  if (!it.times.length) return '<span class="dim" style="font-size:14px">Só quando necessário</span>';
  plDoneRoll(); const now = new Date(), m = now.getHours() * 60 + now.getMinutes();
  return it.times.map(t => {
    const key = it.id + '@' + t, done = sec === 'checks' ? plCheckDone(t) : S.planDone.map[key] === 1, [h, mi] = t.split(':').map(Number), late = !done && m >= h * 60 + mi + 30;
    return sec === 'checks' ? `<span class="btn sm pl-chip ${done ? 'pri' : ''} ${late ? 'late' : ''}">${done ? '✓ ' : ''}${t}</span>` : `<button class="btn sm pl-chip ${done ? 'pri' : ''} ${late ? 'late' : ''}" data-act="pl-tgl" data-k="${esc(key)}" aria-pressed="${done}">${done ? '✓ ' : ''}${t}</button>`;
  }).join('');
}
function plTodayCard(eyebrow, sec, items, hint) {
  return `<div class="card" style="margin-top:12px"><div class="eyebrow">${eyebrow}</div><div class="stack" style="gap:12px;margin-top:10px">${items.map(it => `<div><div class="row" style="justify-content:space-between;gap:8px;align-items:baseline"><b style="overflow-wrap:anywhere">${esc(it.name || 'Sem nome')}</b>${it.dose ? `<span class="dim" style="font-size:14px;text-align:right">${esc(it.dose)}</span>` : ''}</div>${it.notes ? `<div class="dim" style="font-size:14px;margin-top:2px">${esc(it.notes)}</div>` : ''}<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px">${plChips(it, sec)}</div></div>`).join('')}</div>${hint ? `<p class="hint" style="margin:12px 0 0">${hint}</p>` : ''}</div>`;
}
function plPumpToday() {
  const p = S.plan.pump, due = p.lastChange ? isoDate(new Date(addDays(mkTs(p.lastChange, '12:00'), p.siteDays))) : '', today = isoDate(new Date());
  const left = due ? Math.round((mkTs(due, '12:00') - mkTs(today, '12:00')) / DAY) : null;
  const st = left === null ? 'Informe a última troca em Meu tratamento.' : left < 0 ? `Troca atrasada há ${-left} dia${left === -1 ? '' : 's'} (era ${fmtDate(due)}).` : left === 0 ? 'Troca do cateter hoje.' : `Próxima troca em ${left} dia${left === 1 ? '' : 's'} (${fmtDate(due)}).`;
  return `<div class="card" style="margin-top:12px"><div class="eyebrow">Bomba de insulina${p.model ? ' · ' + esc(p.model) : ''}</div><div style="margin-top:10px;font-weight:700;${left !== null && left <= 0 ? 'color:var(--red-l)' : ''}">${st}</div>${p.notes ? `<p class="hint" style="margin:6px 0 0">${esc(p.notes)}</p>` : ''}<button class="btn full ${left !== null && left <= 0 ? 'pri' : ''}" style="margin-top:12px" data-act="pl-pump-now">Troquei o cateter hoje</button></div>`;
}
/* Resumo compacto do Início: só o que já foi cadastrado (sem categorias vazias). */
function trSummary() {
  const p = S.plan, rows = [], nm = l => l.filter(x => x.name).map(x => esc(x.name));
  const dl = dbLabel(S.profile || {}); if (dl) rows.push(['Diabetes', esc(dl)]);
  const ins = p.types.includes('insulina') ? nm(p.insulin) : []; if (ins.length) rows.push(['Insulinas', ins.join(' · ')]);
  const med = p.types.includes('remedios') ? nm(p.meds) : []; if (med.length) rows.push(['Medicamentos', med.join(' · ')]);
  const oth = nm(p.others); if (p.types.includes('bomba')) oth.unshift('Bomba de insulina' + (p.pump.model ? ' (' + esc(p.pump.model) + ')' : '')); if (oth.length) rows.push(['Outros', oth.join(' · ')]);
  return rows.length ? `<div class="card tr-sum">${rows.map(([k, v]) => `<div class="tr-r"><span class="tr-k">${k}</span><span class="tr-v">${v}</span></div>`).join('')}</div>` : '';
}
function treatmentCard() {
  const p = S.plan, on = k => p.types.includes(k);
  const head = `<div class="row" style="justify-content:space-between;align-items:center;gap:8px"><h2 class="sec" style="margin:0">Meu tratamento</h2></div>`;
  const sm = `<div class="tr-wrap">${trSummary()}</div>`;
  let h = on('insulina') ? trInsCards(sm) : head + sm;

  if (!p.types.length) h += `<div class="card"><div class="eyebrow">Como você trata o diabetes?</div><p class="hint" style="margin:8px 0 12px">Escolha abaixo. O cartão do Início passa a mostrar o que você usa. Depois cadastre medicamentos e horários em Meu tratamento.</p><div class="stack" style="gap:8px">${PL_TYPES.map(([k, t, d]) => `<button class="btn full" data-act="pl-settype" data-k="${k}">${t}<small style="display:block;font-weight:400;color:var(--mut)">${d}</small></button>`).join('')}</div></div>`;
  const meds = p.meds.filter(x => plActive(x) && (x.name || x.times.length));
  if (on('remedios')) h += meds.length ? plTodayCard('Medicamentos · hoje', 'meds', meds, 'Toque no horário ao tomar. As marcas voltam a zerar a cada novo dia.') : `<div class="card" style="margin-top:12px"><div class="eyebrow">Medicamentos</div><p class="hint" style="margin:8px 0 0">Nenhum medicamento cadastrado. Adicione em Meu tratamento.</p></div>`;
  if (on('bomba')) h += plPumpToday();
  const ck = p.checks.filter(x => plActive(x) && x.times.length);
  if (ck.length) h += plTodayCard('Medições programadas · hoje', 'checks', ck, 'Marcam sozinhas quando você registra uma glicemia perto do horário.');
  h += `<div class="card" style="margin-top:12px"><button class="btn pri full tr-edit" data-act="go" data-r="esquemas">EDITAR MEU TRATAMENTO</button><p class="hint" style="margin:10px 0 0">O GLUXO não substitui a consulta com a sua equipe de saúde. Siga o que ela indicou; o app só organiza e lembra.</p></div>`;
  return h;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act="pl-tgl"],[data-act="pl-settype"]'); if (!el) return;
  if (el.dataset.act === 'pl-tgl') { plDoneRoll(); const k = el.dataset.k; if (S.planDone.map[k] === 1) delete S.planDone.map[k]; else S.planDone.map[k] = 1; await adSave(); render(); }
  else { const k = el.dataset.k; if (!S.plan.types.includes(k)) S.plan.types.push(k); await plSave(); render(); }
});
