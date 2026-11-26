/* ================= Episódio de hipoglicemia persistente · lógica pura (sem DOM) =================
   Até aqui o episódio era só DERIVADO dos registros (hypoEpisode/hypoEpisodes em logic.js) e sumia da tela assim que a última
   medição voltava a 70 ou mais. Este módulo guarda o episódio como estado próprio, independente da tela aberta:
   - no máximo UM episódio ativo por vez (state.active);
   - medição < 70 inicia o episódio; novas medições < 70 entram no MESMO episódio;
   - medição >= 70 NÃO encerra: devolve kind 'recovery' e a interface pede confirmação;
   - encerramento só por 'recovery' (confirmado pela pessoa) ou 'manual' (descarte confirmado);
   - episódios encerrados vão para state.history, com todas as medições, e continuam consultáveis.
   Tudo imutável: cada função devolve um estado novo. Gravação em app: hypoepisode.js (meta "hypo-episodes" + espelho localStorage). */
const HE_LOW = 70, HE_START_WINDOW = 4 * 3600e3, HE_HIST_MAX = 200, HE_EV_MAX = 200;
const HE_REASON = { recovery: 'Recuperação confirmada', manual: 'Encerrado por decisão do usuário' };

const heEmpty = () => ({ v: 1, active: null, history: [], migrated: false, pos: null, ts: 0 });
const heClone = o => JSON.parse(JSON.stringify(o));
const heNum = x => typeof x === 'number' && isFinite(x);
function heSnap(r) { return { id: r.id, ts: r.ts, date: r.date, time: r.time, glucose: r.glucose }; }
function heOkRec(r) { return !!r && !r.noTime && r.source !== 'exemplo' && heNum(r.glucose) && heNum(r.ts) && !!r.id; }
function heEv(ep, ts, type, g) { const e = { ts, type }; if (heNum(g)) e.g = g; ep.events.push(e); if (ep.events.length > HE_EV_MAX) ep.events.splice(0, ep.events.length - HE_EV_MAX); }

/* Valida o que foi lido do armazenamento (nunca confia no formato). */
function heCleanEp(e) {
  if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !Array.isArray(e.ms)) return null;
  const ms = e.ms.filter(m => m && typeof m.id === 'string' && heNum(m.ts) && heNum(m.glucose)).map(m => ({ id: m.id, ts: m.ts, date: m.date, time: m.time, glucose: m.glucose })).sort((a, b) => a.ts - b.ts);
  if (!ms.length) return null;
  return {
    id: e.id, startTs: heNum(e.startTs) ? e.startTs : ms[0].ts, startGlucose: heNum(e.startGlucose) ? e.startGlucose : ms[0].glucose, startRecId: e.startRecId || ms[0].id,
    ms, events: Array.isArray(e.events) ? e.events.filter(x => x && heNum(x.ts) && typeof x.type === 'string').slice(-HE_EV_MAX) : [],
    progress: { draft: e.progress && typeof e.progress.draft === 'string' ? e.progress.draft.slice(0, 12) : '' },
    state: e.state === 'closed' ? 'closed' : 'active', closedTs: heNum(e.closedTs) ? e.closedTs : null, closeReason: e.closeReason === 'recovery' || e.closeReason === 'manual' ? e.closeReason : null,
    closeGlucose: heNum(e.closeGlucose) ? e.closeGlucose : null
  };
}
function heClean(v) {
  const s = heEmpty(); if (!v || typeof v !== 'object') return s;
  const a = heCleanEp(v.active); s.active = a && a.state === 'active' ? a : null;
  s.history = (Array.isArray(v.history) ? v.history : []).map(heCleanEp).filter(x => x && x.state === 'closed').slice(0, HE_HIST_MAX);
  s.migrated = !!v.migrated; s.ts = heNum(v.ts) ? v.ts : 0;
  s.pos = v.pos && heNum(v.pos.fx) && heNum(v.pos.fy) ? { fx: v.pos.fx >= .5 ? 1 : 0, fy: Math.min(1, Math.max(0, v.pos.fy)) } : null;
  return s;
}
/* Vale o estado gravado mais recentemente (banco x espelho síncrono). */
const heNewer = (a, b) => !a ? b : !b ? a : (b.ts > a.ts ? b : a);

/* Nova medição registrada. Devolve { state, kind }:
   'start' (abriu episódio) · 'attach' (< 70 dentro do episódio ativo) · 'recovery' (>= 70 dentro do episódio ativo: pedir confirmação)
   · 'update' (medição já pertencente ao episódio foi editada) · 'none' (nada a fazer). */
function heRecord(state, rec, now, mkId) {
  const st = heClone(state);
  if (!heOkRec(rec)) return { state, kind: 'none' };
  const a = st.active, snap = heSnap(rec), low = rec.glucose < HE_LOW;
  if (a) {
    const i = a.ms.findIndex(m => m.id === rec.id);
    if (i >= 0) { a.ms[i] = snap; a.ms.sort((x, y) => x.ts - y.ts); return { state: st, kind: 'update' }; }
    if (rec.ts < a.startTs || rec.ts > now + 5 * 60e3) return { state, kind: 'none' }; /* medição antiga lançada depois não pertence ao episódio */
    a.ms.push(snap); a.ms.sort((x, y) => x.ts - y.ts);
    heEv(a, rec.ts, low ? 'low' : 'high', rec.glucose);
    return { state: st, kind: low ? 'attach' : 'recovery' };
  }
  if (!low || now - rec.ts > HE_START_WINDOW) return { state, kind: 'none' }; /* só medição recente abre episódio (não histórico importado/antigo) */
  const ep = { id: mkId ? mkId() : 'he' + now.toString(36), startTs: rec.ts, startGlucose: rec.glucose, startRecId: rec.id, ms: [snap], events: [], progress: { draft: '' }, state: 'active', closedTs: null, closeReason: null, closeGlucose: null };
  heEv(ep, rec.ts, 'start', rec.glucose); st.active = ep;
  return { state: st, kind: 'start' };
}
/* Pessoa escolheu "manter acompanhamento" depois de uma medição >= 70. */
function heKeep(state, now) { if (!state.active) return state; const st = heClone(state); heEv(st.active, now, 'keep'); return st; }
function heDraft(state, txt) { if (!state.active) return state; const st = heClone(state); st.active.progress.draft = String(txt || '').slice(0, 12); return st; }
/* Encerra o episódio ativo: 'recovery' (confirmado) ou 'manual' (descarte). Histórico e medições ficam preservados. */
function heClose(state, reason, now) {
  if (!state.active || (reason !== 'recovery' && reason !== 'manual')) return state;
  const st = heClone(state), a = st.active, last = a.ms[a.ms.length - 1];
  a.state = 'closed'; a.closedTs = now; a.closeReason = reason; a.closeGlucose = last ? last.glucose : null; heEv(a, now, reason === 'recovery' ? 'recovered' : 'discarded');
  st.history.unshift(a); st.history = st.history.slice(0, HE_HIST_MAX); st.active = null; return st;
}
/* Medições cujo registro foi apagado saem do episódio ATIVO; sem nenhuma medição restante o episódio deixa de existir. Encerrados não mudam. */
function heReconcile(state, ids) {
  const a = state.active; if (!a) return state;
  const keep = a.ms.filter(m => ids.has(m.id)); if (keep.length === a.ms.length) return state;
  const st = heClone(state); if (!keep.length) { st.active = null; return st; }
  st.active.ms = keep; return st;
}
/* Primeira abertura após a atualização: adota o episódio que já estava em andamento (derivado dos registros). */
function heAdopt(state, derived, mkId) {
  const st = heClone(state); st.migrated = true; if (st.active || !derived || !derived.ep || !derived.ep.length) return st;
  const ms = derived.ep.filter(heOkRec).map(heSnap).sort((x, y) => x.ts - y.ts); if (!ms.length || ms[ms.length - 1].glucose >= HE_LOW) return st;
  const ep = { id: mkId ? mkId() : 'he' + ms[0].ts.toString(36), startTs: ms[0].ts, startGlucose: ms[0].glucose, startRecId: ms[0].id, ms, events: [], progress: { draft: '' }, state: 'active', closedTs: null, closeReason: null, closeGlucose: null };
  ms.forEach((m, i) => heEv(ep, m.ts, i ? (m.glucose < HE_LOW ? 'low' : 'high') : 'start', m.glucose)); st.active = ep; return st;
}
function heFind(state, id) { return state.active && state.active.id === id ? state.active : state.history.find(e => e.id === id) || null; }
function heByRec(state, recId) { const has = e => e.ms.some(m => m.id === recId); return state.active && has(state.active) ? state.active : state.history.find(has) || null; }

if (typeof module !== 'undefined' && module.exports) module.exports = { HE_LOW, HE_REASON, heEmpty, heClean, heCleanEp, heNewer, heRecord, heKeep, heDraft, heClose, heReconcile, heAdopt, heFind, heByRec };
