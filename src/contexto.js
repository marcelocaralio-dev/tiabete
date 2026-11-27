/* ================= GLUXO Experience 05 · Inteligência contextual =================
   Usa o MESMO registro de preferências das etapas anteriores (GX_F, chave 'tb-gx', copiada no banco por persist.js): cada categoria é uma
   entrada "ctx_*" e aparece em Configurações > Personalização > GLUXO Experience > Inteligência contextual (VIEWS.gxctx).
   O que o app aprende (telas usadas, sugestões aceitas/dispensadas) e o que foi dispensado ficam no mesmo objeto, sob a chave "cxs".
   Tudo roda no aparelho, sem internet e sem enviar dado nenhum. A lógica fica em contexto-core.js (testada em node).
   NÃO toca em alertas glicêmicos, no protocolo de hipoglicemia, em metas, limites, cálculos clínicos, Premium nem em registros:
   desligar qualquer opção daqui só tira observações extras da tela. */
const cxb = (t, s, d) => [d !== false, t, s || ''];
const CX_SAFE = 'Alertas glicêmicos e proteções de segurança não dependem destas opções e continuam sempre ativos.';
GX_F.ctx_all = { t: 'Inteligência · Geral', o: { on: cxb('Ativar a inteligência contextual', 'Chave geral. Desligada, nenhuma observação, sugestão ou lembrete contextual aparece. ' + CX_SAFE) } };
GX_F.ctx_ins = { t: 'Inteligência · Insights glicêmicos', o: { on: cxb('Ativar insights glicêmicos', 'Observações sobre os seus registros, sempre com período, quantidade de medições e critério.'), win: ['14', 'Período analisado', 'Janela usada nos insights. Sempre é comparada com o período anterior de mesma duração.', [['7', 'Últimos 7 dias'], ['14', 'Últimos 14 dias'], ['30', 'Últimos 30 dias']]],
  compare: cxb('Comparação com o período anterior'), trend: cxb('Tendências de elevação e redução'), period: cxb('Períodos do dia (manhã, tarde e noite)'), variab: cxb('Períodos com maior variação'), weekday: cxb('Dias da semana'), target: cxb('Medições acima e abaixo da faixa'),
  home: cxb('Destacar um insight na tela inicial', 'Aparece discreto abaixo do resumo; os demais ficam em Insights e resumos.') } };
GX_F.ctx_pat = { t: 'Inteligência · Reconhecimento de padrões', o: { on: cxb('Ativar o reconhecimento de padrões', 'Associações entre registros (horário, refeição, atividade, etiquetas, eventos). Faz parte de Padrões e observações automáticas (Premium).'), meal: cxb('Refeições'), timing: cxb('Antes e depois das refeições'), activity: cxb('Atividade física'), marks: cxb('Etiquetas, dias da semana e recorrências'), events: cxb('Eventos registrados'),
  minocc: ['5', 'Mínimo de ocorrências', 'Quanto maior, mais rigoroso: menos padrões aparecem, com mais repetições por trás.', [['5', '5 ocorrências (padrão)'], ['8', '8 ocorrências'], ['12', '12 ocorrências']]] } };
GX_F.ctx_ast = { t: 'Inteligência · Assistência contextual', o: { on: cxb('Ativar a assistência contextual', 'Uma caixa discreta no alto de cada tela com informações sobre o que você está vendo.'), home: cxb('Tela inicial'), hist: cxb('Histórico'), analise: cxb('Análise e gráficos'), metricas: cxb('Métricas'), food: cxb('Alimentação e bolus'),
  max: ['3', 'Itens por tela', 'Quantidade máxima de itens (lembrete, observação, insight e sugestão) na caixa.', [['1', '1 item'], ['2', '2 itens'], ['3', '3 itens']]] } };
GX_F.ctx_sug = { t: 'Inteligência · Sugestões de funcionalidades', o: { on: cxb('Ativar sugestões', 'Ajudam a descobrir recursos do app. Nunca insistem e nunca empurram recursos pagos.'), freq: ['3', 'Frequência de novas sugestões', 'Uma sugestão fica visível até você tocar ou dispensar; a próxima só vem depois deste intervalo.', [['1', 'No máximo 1 por dia'], ['3', 'No máximo 1 a cada 3 dias'], ['7', 'No máximo 1 por semana']]],
  discover: cxb('Descobrir recursos'), data: cxb('Completar registros'), report: cxb('Relatórios') } };
GX_F.ctx_rem = { t: 'Inteligência · Lembretes contextuais', o: { on: cxb('Ativar lembretes contextuais', 'Avisos informativos feitos a partir dos seus próprios registros, só com o app aberto. Não substituem os lembretes que você programou e respeitam o horário silencioso.'), routine: cxb('Pausa na rotina de registros', 'Avisa quando os registros param depois de uma rotina regular. Não indica quando medir.'), gap: ['48', 'Pausa considerada', '', [['24', '24 horas'], ['48', '48 horas'], ['72', '72 horas']]], habit: cxb('Horário habitual de registro', 'Informa se ainda não há registro no horário em que você costuma registrar.', false), report: cxb('Conferência antes de gerar relatórios') } };
GX_F.ctx_sum = { t: 'Inteligência · Resumos por período', o: { on: cxb('Ativar resumos por período', 'Mostra o resumo calculado com as mesmas contas da Análise.'), range: ['7', 'Período inicial', '', [['24h', 'Últimas 24 horas'], ['7', 'Últimos 7 dias'], ['14', 'Últimos 14 dias'], ['30', 'Últimos 30 dias']]], compare: cxb('Comparar com o período anterior'), attention: cxb('Registros que merecem atenção'), quality: cxb('Consistência dos dados') } };
GX_F.ctx_ada = { t: 'Inteligência · Adaptação ao uso', o: { on: cxb('Ativar a adaptação', 'Só melhora a relevância das sugestões. Não muda a tela inicial, preferências, metas nem configurações clínicas.'), learn: cxb('Aprender com as telas que você usa', 'Evita sugerir o que você já usa.'), sugl: cxb('Aprender com sugestões aceitas e dispensadas', 'Categorias que você sempre dispensa deixam de ser sugeridas.') } };
GX_F.ctx_priv = { t: 'Inteligência · Privacidade e transparência', o: { hist: cxb('Guardar o histórico de insights vistos', 'Só neste aparelho, até 30 itens; você pode consultar e apagar.'), open: ['closed', 'Detalhes de “Como foi calculado”', 'Período, quantidade de registros, critério e limitações estão sempre disponíveis.', [['closed', 'Recolhidos'], ['open', 'Abertos']]] } };

const CX_ROUTES = ['painel', 'historico', 'analise', 'metricas', 'metrica', 'bolus', 'refeicoes', 'relatorios'];
const CX_AKEY = { painel: 'home', historico: 'hist', analise: 'analise', metricas: 'metricas', metrica: 'metricas', bolus: 'food', refeicoes: 'food' };
const CX_LIC = { analise: 'analise', metricas: 'metricas', metrica: 'metricas', bolus: 'bolus' };
const CX_CATS = { discover: 'Descobrir recursos', data: 'Completar registros', report: 'Relatórios' };
const CX_TAG = { rem: 'Lembrete contextual', ins: 'Insight', ast: 'Assistente', sug: 'Sugestão', pat: 'Padrão' };
const cxo = (f, k) => gxGet('ctx_' + f, k);
const cxMaster = () => gxGet('ctx_all', 'on');
const cxOn = f => cxMaster() && gxGet('ctx_' + f, 'on');
const cxAllow = f => typeof licAllowed !== 'function' || !f || licAllowed(f);
const cxHas = r => !!(VIEWS[r] && TITLES[r]);
const cxIdx = {};                                  /* id do item exibido -> registros que o sustentam */
const cxKinds = (f, ks) => ks.reduce((m, k) => (m[k] = !!cxo(f, k), m), {});
S.cx = S.cx || { win: '', range: '', from: '', to: '' };

/* ---------- estado aprendido e itens dispensados (junto das preferências; sem sistema paralelo) ---------- */
function cxState() { const s = gxAll().cxs; return s && typeof s === 'object' && !Array.isArray(s) ? s : {}; }
function cxMut(fn) {
  const p = gxAll(), s = p.cxs && typeof p.cxs === 'object' && !Array.isArray(p.cxs) ? p.cxs : {}, now = Date.now(); fn(s);
  ['dis', 'rdis'].forEach(k => { if (s[k]) { Object.keys(s[k]).forEach(i => { if (s[k][i] <= now) delete s[k][i]; }); if (!Object.keys(s[k]).length) delete s[k]; } });
  if (s.dlog) { const ks = Object.keys(s.dlog).sort((a, b) => s.dlog[b].at - s.dlog[a].at); ks.slice(40).forEach(i => delete s.dlog[i]); }
  if (s.log && s.log.length > 30) s.log = s.log.slice(-30);
  if (s.use && Object.keys(s.use).length > 60) { const t = Object.entries(s.use).sort((a, b) => b[1] - a[1]).slice(0, 60); s.use = Object.fromEntries(t); }
  if (Object.keys(s).length) p.cxs = s; else delete p.cxs; gxSave(p);
}
const cxHid = (s, id) => ((s.dis || {})[id] || 0) > Date.now();
let cxRoute0 = '', cxHour0 = false;
function cxTrack() {
  if (!cxOn('ada') || !cxo('ada', 'learn') || S.route === cxRoute0) return; cxRoute0 = S.route;
  const r = S.route, h = new Date().getHours(), first = !cxHour0; cxHour0 = true;
  cxMut(s => { s.use = s.use || {}; s.use[r] = (s.use[r] || 0) + 1; if (first) { s.hrs = s.hrs || {}; s.hrs[h] = (s.hrs[h] || 0) + 1; } });
}
function cxLog(list) {
  if (!cxOn('ins') || !cxo('priv', 'hist') || !list.length) return;
  const s = cxState(), seen = new Set((s.log || []).map(x => x.id + '|' + x.x)), add = list.filter(x => !seen.has(x.id + '|' + x.text));
  if (add.length) cxMut(st => { st.log = (st.log || []).concat(add.map(x => ({ id: x.id, t: x.title, x: x.text, p: x.period, n: x.n, at: Date.now() }))); });
}

/* ---------- itens da caixa contextual ---------- */
const cxInsOpts = () => ({ now: Date.now(), days: +cxo('ins', 'win'), kinds: cxKinds('ins', ['compare', 'trend', 'period', 'variab', 'weekday', 'target']) });
const cxPatOpts = () => ({ now: Date.now(), minOcc: +cxo('pat', 'minocc'), markLabels: typeof MARKS === 'object' ? MARKS : {}, kinds: cxKinds('pat', ['meal', 'timing', 'activity', 'marks', 'events']) });
function cxCalm() { try { return typeof hypoEpisode === 'function' && !!hypoEpisode(S.records, Date.now()); } catch (e) { return false; } }   /* durante um episódio de hipoglicemia o foco é o protocolo: nada de sugestões */
let cxMemo = { sig: '', route: '', items: [] };
function cxSig() { let h = 0; for (const r of S.records) h = (h * 31 + (r.glucose | 0) + (r.ts % 997)) | 0; let lk = ''; try { lk = localStorage.getItem('tb-gx') || ''; } catch (e) { } return [S.records.length, h, (S.events || []).length, lk.length, lk.slice(0, 400), typeof licStatus === 'function' ? licStatus() : '', new Date().toDateString(), Math.floor(Date.now() / 600000)].join('|'); }
function cxItems(route) {
  if (!cxMaster() || !CX_ROUTES.includes(route)) return [];
  const sig = cxSig(); if (cxMemo.sig === sig && cxMemo.route === route) return cxMemo.items;
  const now = Date.now(), st = cxState(), out = [], calm = cxCalm(), quiet = typeof caQuiet === 'function' ? caQuiet() : null;
  try {
    if (cxOn('rem') && (route === 'painel' || route === 'relatorios') && !calm) {
      const r = cxReminders({ now, records: S.records, cfg: { routine: cxo('rem', 'routine'), gap: +cxo('rem', 'gap'), habit: cxo('rem', 'habit'), report: cxo('rem', 'report') }, quiet, route, state: st });
      r.list.slice(0, 1).forEach(x => out.push(Object.assign({ k: 'rem' }, x)));
    }
    if (cxOn('ast') && cxo('ast', CX_AKEY[route] || '') && cxAllow(CX_LIC[route]) && route !== 'relatorios') cxAssist(route, S.records, { now }).filter(x => !cxHid(st, x.id)).forEach(x => out.push(Object.assign({ k: 'ast', limits: CX_LIM_STAT }, x)));
    if (cxOn('ins') && route === 'painel' && cxo('ins', 'home') && !calm) { const t = cxInsights(S.records, cxInsOpts()).list.find(x => !cxHid(st, x.id)); if (t) out.push(Object.assign({ k: 'ins' }, t)); }
    if (cxOn('sug') && !calm && !cxQuiet(now, quiet)) {
      const learn = cxOn('ada') && cxo('ada', 'learn'), sl = cxOn('ada') && cxo('ada', 'sugl'), usage = Object.assign({}, st.use || {});
      if (!learn) ['analise', 'padroes', 'ctxres', 'relatorios'].forEach(k => { usage[k] = 1; });   /* sem aprender o uso, não dá para saber o que já foi usado: só sugestões baseadas em dados */
      const cand = cxCandidates({ now, records: S.records, route, usage, state: { dis: st.dis, acc: sl ? st.acc : {}, rej: sl ? st.rej : {} }, cats: cxKinds('sug', ['discover', 'data', 'report']), has: cxHas, allowed: cxAllow });
      const cur = st.cur && cand.find(x => x.id === st.cur.id), frz = +cxo('sug', 'freq') * 86400000;
      let pick = cur || null;
      if (!pick && cand.length && now - (st.lastNew || 0) >= frz) { pick = cand[0]; cxMut(s => { s.cur = { id: pick.id, at: now }; s.lastNew = now; }); }
      if (pick) out.push(Object.assign({ k: 'sug', n: 0, period: '', crit: 'Sugestão baseada nos seus registros e no uso do app; não faz parte de nenhuma recomendação clínica.', limits: 'Você pode dispensar esta sugestão ou desligar as sugestões em Configurações.' }, pick));
    }
  } catch (e) { console.error(e); }
  const max = +cxo('ast', 'max') || 3, seenK = {}; const items = out.filter(x => (seenK[x.k] = (seenK[x.k] || 0) + 1) <= (x.k === 'ast' ? 2 : 1)).slice(0, max);
  cxMemo = { sig, route, items }; return items;
}
function cxWhyHTML(x) {
  const row = (a, b) => b ? `<dt>${a}</dt><dd>${esc(b)}</dd>` : '';
  return `<details class="cx-d"${cxo('priv', 'open') === 'open' ? ' open' : ''}><summary>Como foi calculado</summary><dl>${row('Período analisado', x.period || '—')}${row('Registros considerados', x.n != null ? String(x.n) : '')}${x.nPrev ? row('Período anterior', x.nPrev + ' medições') : ''}${row('Critério', x.crit)}${row('Limitações', x.limits)}</dl></details>`;
}
function cxItemHTML(x) {
  cxIdx[x.id] = x.recIds || [];
  const rec = x.recIds && x.recIds.length ? `<button type="button" class="cx-b" data-cx="recs" data-id="${esc(x.id)}" data-t="${esc(x.title)}">Ver registros (${x.recIds.length})</button>` : '';
  let acts;
  if (x.k === 'sug') acts = `<button type="button" class="cx-b pri" data-cx="sug-go" data-id="${esc(x.id)}" data-cat="${x.cat}" data-r="${esc(x.target)}">${esc(x.label)}</button><button type="button" class="cx-b" data-cx="sug-no" data-id="${esc(x.id)}" data-cat="${x.cat}">Agora não</button><button type="button" class="cx-b" data-cx="sug-never" data-id="${esc(x.id)}" data-cat="${x.cat}" data-t="${esc(x.title)}">Não sugerir mais</button>`;
  else if (x.k === 'rem') acts = rec + `<button type="button" class="cx-b" data-cx="rem-x" data-key="${esc(x.key)}" data-t="${esc(x.title)}">Dispensar</button>`;
  else acts = rec + (x.edu ? '' : `<button type="button" class="cx-b" data-cx="x" data-id="${esc(x.id)}" data-t="${esc(x.title)}">Dispensar</button>`);
  const why = x.k === 'sug' ? `<p class="cx-w dim">${esc(x.why || '')}</p>` : cxWhyHTML(x);
  return `<div class="cx-n cx-${x.k}"><div class="cx-h"><b>${esc(x.title)}</b><span class="cx-tag">${CX_TAG[x.k]}</span></div><p class="cx-p">${esc(x.text)}</p>${x.period && x.k !== 'sug' ? `<p class="cx-m dim">${esc(x.period)}${x.n ? ' · ' + x.n + ' medições' : ''}</p>` : ''}${why}<div class="cx-a">${acts}</div></div>`;
}
function cxBoxHTML(route) {
  const items = cxItems(route); if (!items.length) return '';
  const foot = route === 'painel' && cxHas('ctxres') ? `<div class="cx-f"><button type="button" class="cx-b" data-act="go" data-r="ctxres">Insights e resumos</button><button type="button" class="cx-b" data-act="go" data-r="gxctx" aria-label="Configurar a inteligência contextual">Configurar</button></div>` : `<div class="cx-f"><button type="button" class="cx-b" data-act="go" data-r="gxctx" aria-label="Configurar a inteligência contextual">Configurar</button></div>`;
  return `<section class="card cx-box" data-cxr="${route}" aria-label="Assistência contextual">${items.map(cxItemHTML).join('')}${foot}</section>`;
}
/* Início: a caixa entra logo abaixo do Resumo glicêmico (que continua estrutural, no topo) */
const cxVP0 = viewPainel;
viewPainel = function () {
  const h = cxVP0(); try { if (typeof inEditing === 'function' && inEditing()) return h; const b = cxBoxHTML('painel'); if (!b) return h; const i = h.indexOf('<div class="pn-grid'); return i >= 0 ? h.slice(0, i) + b + h.slice(i) : h; } catch (e) { return h; }
};
VIEWS.painel = viewPainel;
function cxPost() {
  try {
    const v = document.getElementById('view'), h = v && v.querySelector('h1.pg'); if (!h) return; cxTrack();
    if (!cxMaster() || !CX_ROUTES.includes(S.route) || v.querySelector('.cx-box')) return;
    const html = cxBoxHTML(S.route); if (!html) return;
    let ref = h; while (ref.nextElementSibling && ref.nextElementSibling.classList.contains('banner')) ref = ref.nextElementSibling;
    ref.insertAdjacentHTML('afterend', html);
  } catch (e) { console.error(e); }
}
let cxQ = 0;
const cxSched = () => { if (cxQ) return; cxQ = requestAnimationFrame(() => { cxQ = 0; cxPost(); }); };
function cxWatch() { const v = document.getElementById('view'); if (!v || typeof MutationObserver !== 'function') return; new MutationObserver(cxSched).observe(v, { childList: true }); cxSched(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cxWatch); else cxWatch();

/* ---------- registros que sustentam cada informação ---------- */
function cxRecsSheet(title, ids) {
  const set = new Set((ids || []).map(String)), rs = S.records.filter(r => set.has(String(r.id))).sort((a, b) => b.ts - a.ts), sh = rs.slice(0, 80);
  const sub = r => [r.context ? CONTEXTS[r.context] : '', r.meal ? MEALS[r.meal] : ''].filter(Boolean).join(' · ') || 'Sem contexto informado';
  return `<h2 style="margin:0 0 6px">${esc(title)}</h2><p class="hint" style="margin:0 0 10px">${rs.length} ${rs.length === 1 ? 'registro sustenta' : 'registros sustentam'} esta informação${rs.length > sh.length ? ` (os ${sh.length} mais recentes aparecem abaixo)` : ''}. Toque em um registro para abrir.</p><div class="stack">${sh.length ? sh.map(r => `<button type="button" class="menu-item" data-act="open" data-id="${r.id}"><div>${fmtDate(r.date)}${r.noTime ? '' : ' ' + r.time} · ${fn(r.glucose, 1)} mg/dL<span>${esc(sub(r))}</span></div></button>`).join('') : '<p class="hint">Estes registros não estão mais disponíveis.</p>'}</div><button type="button" class="btn full" style="margin-top:12px" data-act="close">Fechar</button>`;
}

/* ---------- ações ---------- */
document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-cx]'); if (!b) return; const a = b.dataset.cx, id = b.dataset.id, DAYS = 86400000, now = Date.now();
  if (a === 'recs') { openSheet(cxRecsSheet(b.dataset.t || 'Registros', cxIdx[id] || (id === 'sum' ? cxIdx.sum : []))); return; }
  if (a === 'x') { cxMut(s => { (s.dis = s.dis || {})[id] = now + 7 * DAYS; (s.dlog = s.dlog || {})[id] = { t: b.dataset.t || id, at: now }; }); cxMemo.sig = ''; render(); toast('Dispensado por 7 dias. Você pode restaurar em Configurações.'); return; }
  if (a === 'rem-x') { const k = b.dataset.key; cxMut(s => { (s.rdis = s.rdis || {})[k] = now + 7 * DAYS; (s.dlog = s.dlog || {})['r-' + k] = { t: b.dataset.t || 'Lembrete', at: now, r: 1 }; }); cxMemo.sig = ''; render(); return; }
  if (a === 'sug-go') { cxMut(s => { (s.acc = s.acc || {})[b.dataset.cat] = ((s.acc || {})[b.dataset.cat] || 0) + 1; (s.dis = s.dis || {})[id] = now + 30 * DAYS; delete s.cur; }); cxMemo.sig = ''; go(b.dataset.r); return; }
  if (a === 'sug-no') { cxMut(s => { (s.rej = s.rej || {})[b.dataset.cat] = ((s.rej || {})[b.dataset.cat] || 0) + 1; (s.dis = s.dis || {})[id] = now + 14 * DAYS; delete s.cur; }); cxMemo.sig = ''; render(); return; }
  if (a === 'sug-never') { cxMut(s => { (s.rej = s.rej || {})[b.dataset.cat] = ((s.rej || {})[b.dataset.cat] || 0) + 1; (s.dis = s.dis || {})[id] = 9e15; (s.dlog = s.dlog || {})[id] = { t: b.dataset.t || id, at: now }; delete s.cur; }); cxMemo.sig = ''; render(); return; }
  if (a === 'restore') { cxMut(s => { if (s.dis) delete s.dis[id]; if (s.rdis) delete s.rdis[id.replace(/^r-/, '')]; if (s.dlog) delete s.dlog[id]; }); cxMemo.sig = ''; render(); return; }
  if (a === 'restore-all') { cxMut(s => { delete s.dis; delete s.rdis; delete s.dlog; delete s.cur; }); cxMemo.sig = ''; render(); return; }
  if (a === 'clear-learn') { if (!window.confirm('Apagar o que o GLUXO aprendeu com o seu uso? As suas preferências e os seus registros não mudam.')) return; cxMut(s => { delete s.use; delete s.hrs; delete s.acc; delete s.rej; delete s.cur; delete s.lastNew; }); cxMemo.sig = ''; render(); return; }
  if (a === 'clear-log') { cxMut(s => { delete s.log; }); render(); return; }
  if (a === 'reset-all') { const p = gxAll(); Object.keys(p).forEach(k => { if (k.startsWith('ctx_')) delete p[k]; }); gxSave(p); cxMemo.sig = ''; render(); toast('Inteligência contextual restaurada ao padrão.'); return; }
  if (a === 'win') { S.cx.win = b.dataset.v; render(); return; }
  if (a === 'range') { S.cx.range = b.dataset.v; render(); return; }
  if (a === 'sum-apply') { const f = document.getElementById('cx-from'), t = document.getElementById('cx-to'); S.cx.from = f ? f.value : ''; S.cx.to = t ? t.value : ''; S.cx.range = 'custom'; render(); return; }
  if (a === 'sum-share') { const R = cxSum(); if (R && R.ok && R.enough && typeof gxShare === 'function') gxShare(cxSumText(R)); return; }
});

/* ---------- tela "Insights e resumos" ---------- */
const cxRange0 = () => S.cx.range || cxo('sum', 'range'), cxWin0 = () => S.cx.win || cxo('ins', 'win');
function cxSum() { return cxSummary(S.records, { now: Date.now(), range: cxRange0(), from: S.cx.from, to: S.cx.to }); }
const cxChip = (a, v, cur, t) => `<button type="button" class="seg-b${String(cur) === String(v) ? ' on' : ''}" data-cx="${a}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`;
function cxBar(bc, n) {
  const P = [['vlow', 'Muito baixa (< 54)', 'var(--red-d)'], ['low', 'Baixa (54–69)', 'var(--red-l)'], ['ok', 'Na faixa (70–180)', 'var(--good-fill)'], ['high', 'Elevada (181–250)', 'var(--warn-bd)'], ['vhigh', 'Muito elevada (> 250)', 'var(--red)']];
  return `<div class="cx-bar" role="img" aria-label="Distribuição das medições por faixa">${P.map(([k, , c]) => bc[k] ? `<i style="width:${bc[k] / n * 100}%;background:${c}"></i>` : '').join('')}</div><ul class="cx-leg">${P.map(([k, t, c]) => `<li><i style="background:${c}"></i>${t}: <b>${cxF(bc[k] / n * 100)}%</b> <span class="dim">(${bc[k]})</span></li>`).join('')}</ul>`;
}
function cxSumHTML(R) {
  if (!R.ok) return `<div class="card"><p class="hint" style="margin:0">${esc(R.why)}</p></div>`;
  const head = `<b>Resumo · ${esc(R.label)}</b><small class="dim" style="display:block">${cxRange(R.curR)}</small>`;
  if (!R.enough) return `<div class="card">${head}<p class="hint">${esc(R.why)}</p>${R.recIds.length ? `<button type="button" class="cx-b" data-cx="recs" data-id="sum" data-t="Registros do resumo">Ver registros (${R.recIds.length})</button>` : ''}</div>`;
  cxIdx.sum = R.recIds; const A = R.A, q = R.quality, dt = r => cxDM(r.ts);
  const st = (t, v, s) => `<div class="cx-st"><small class="dim">${t}</small><b class="num">${v}</b>${s ? `<small class="dim">${s}</small>` : ''}</div>`;
  let h = `<div class="card cx-sum">${head}<div class="cx-grid">${st('Média', cxF(A.mean) + ' mg/dL')}${st('Medições', A.n, A.days + (A.days === 1 ? ' dia' : ' dias'))}${st('Mínimo', cxF(R.minRec.glucose) + ' mg/dL', dt(R.minRec))}${st('Máximo', cxF(R.maxRec.glucose) + ' mg/dL', dt(R.maxRec))}</div><h3 class="cx-h3">Distribuição das medições</h3>${cxBar(A.bc, A.n)}<p class="hint" style="margin:6px 0 0">Proporção de medições, não de tempo na faixa.</p>`;
  h += `<h3 class="cx-h3">Tendência</h3><p class="cx-p">${R.trend ? (Math.abs(R.trend.perWeek) >= 8 ? `As médias diárias indicam ${R.trend.perWeek > 0 ? 'elevação' : 'redução'} de cerca de ${cxF(Math.abs(R.trend.perWeek))} mg/dL por semana (${R.trend.days} dias com registro).` : `Sem tendência clara nas médias diárias (${R.trend.days} dias com registro).`) : 'Tendência não calculada: pede ao menos 20 medições em 10 dias diferentes.'}</p>`;
  if (cxo('sum', 'compare')) {
    if (R.cmp) { const rows = R.cmp.rows.filter(r => ['mean', 'n', 'pIn', 'pLow', 'pHigh', 'cv'].includes(r.k)), f = r => r.a == null ? '—' : cxF(r.a, r.dec) + (r.u === '%' ? '%' : ''), g = r => r.b == null ? '—' : cxF(r.b, r.dec) + (r.u === '%' ? '%' : '');
      h += `<h3 class="cx-h3">Comparação com o período anterior</h3><p class="hint" style="margin:0 0 6px">${cxRange(R.prevR)} · ${R.B.n} medições</p><div class="cx-tb" role="table"><div class="cx-tr hd" role="row"><span>Indicador</span><span>Agora</span><span>Antes</span></div>${rows.map(r => `<div class="cx-tr" role="row"><span>${esc(r.t)}</span><b class="num">${f(r)}</b><span class="num">${g(r)}</span></div>`).join('')}</div>${R.cmp.warn.map(w => `<p class="hint" style="margin:6px 0 0">⚠ ${esc(w)}</p>`).join('')}`;
    } else h += `<h3 class="cx-h3">Comparação com o período anterior</h3><p class="hint">${esc(R.noPrev)}</p>`;
  }
  if (cxo('sum', 'attention')) {
    const t = R.attention, list = t.vlow.concat(t.vhigh).sort((a, b) => b.ts - a.ts).slice(0, 6);
    h += `<h3 class="cx-h3">Registros que merecem atenção</h3>${list.length ? `<ul class="cx-ul">${list.map(r => `<li><button type="button" class="cx-lk" data-act="open" data-id="${r.id}">${fmtDate(r.date)}${r.noTime ? '' : ' ' + r.time} · <b>${fn(r.glucose, 1)} mg/dL</b> (${r.glucose < 54 ? 'muito baixa' : 'muito elevada'})</button></li>`).join('')}</ul>` : '<p class="cx-p">Nenhuma medição abaixo de 54 nem acima de 250 mg/dL neste período.</p>'}<p class="hint" style="margin:6px 0 0">${t.lowN} ${t.lowN === 1 ? 'medição abaixo' : 'medições abaixo'} de ${LIM.low} mg/dL${t.epN ? ` (${t.epN} ${t.epN === 1 ? 'episódio' : 'episódios'})` : ''}. Valores baixos ou muito altos que se repetem merecem conversa com o seu profissional de saúde.</p>`;
  }
  if (cxo('sum', 'quality')) h += `<h3 class="cx-h3">Consistência dos dados</h3><ul class="cx-ul"><li>${q.days} de ${q.spanDays} ${q.spanDays === 1 ? 'dia' : 'dias'} com registro (${cxF(q.coverage)}%).</li><li>${q.noContext} ${q.noContext === 1 ? 'medição sem contexto' : 'medições sem contexto'} (jejum, antes ou depois da refeição).</li>${q.noTime ? `<li>${q.noTime} sem horário.</li>` : ''}${q.dup ? `<li>${q.dup} ${q.dup === 1 ? 'duplicata exata ignorada' : 'duplicatas exatas ignoradas'} nos cálculos (os registros não foram alterados).</li>` : ''}</ul>`;
  h += `<div class="cx-a" style="margin-top:12px"><button type="button" class="cx-b" data-cx="recs" data-id="sum" data-t="Registros do resumo">Ver registros (${R.recIds.length})</button><button type="button" class="cx-b" data-cx="sum-share">Compartilhar resumo</button></div><p class="hint" style="margin:10px 0 0">Resumo informativo dos seus registros: não é uma avaliação clínica.</p></div>`;
  return h;
}
function cxSumText(R) {
  const A = R.A, L = [`Resumo GLUXO · ${R.label} (${cxRange(R.curR)})`, `Medições: ${A.n} em ${A.days} dias`, `Média: ${cxF(A.mean)} mg/dL · mínimo ${cxF(R.minRec.glucose)} · máximo ${cxF(R.maxRec.glucose)}`, `Na faixa (70–180): ${cxF(A.pIn)}% das medições · abaixo de 70: ${cxF(A.pLow)}%`];
  if (R.B) L.push(`Período anterior (${cxRange(R.prevR)}): ${R.B.n} medições, média ${cxF(R.B.mean)} mg/dL`); L.push('Resumo informativo; não é avaliação clínica.'); return L.join('\n');
}
function cxCardFull(x) { cxIdx[x.id] = x.recIds || []; return cxItemHTML(Object.assign({ k: x.cat === 'pat' ? 'pat' : 'ins' }, x)); }
function viewCtxRes() {
  if (!cxMaster()) return banners() + `<div class="card"><p class="hint" style="margin:0 0 10px">A inteligência contextual está desligada. Nenhuma observação é calculada. ${CX_SAFE}</p><button type="button" class="btn full" data-act="go" data-r="gxctx">Abrir configurações</button></div>`;
  const st = cxState(); let h = banners() + `<p class="hint" style="margin:0 0 12px">Observações feitas só com os seus registros, neste aparelho. São estatísticas descritivas: não indicam causa nem substituem a orientação do seu profissional de saúde.</p>`;
  h += '<h2 class="sec">Insights</h2>';
  if (!cxOn('ins')) h += '<div class="card"><p class="hint" style="margin:0">Insights desligados em Configurações > Inteligência contextual.</p></div>';
  else { const o = Object.assign(cxInsOpts(), { days: +cxWin0() }), r = cxInsights(S.records, o); cxLog(r.list);
    h += `<div class="seg cx-seg" role="group" aria-label="Período dos insights">${['7', '14', '30'].map(v => cxChip('win', v, o.days, v + ' dias')).join('')}</div>`;
    h += r.list.length ? r.list.map(x => cxCardFull(x)).join('') : `<div class="card"><p class="hint" style="margin:0">${esc(r.why)}</p></div>`; if (r.noPrev && r.enough) h += `<p class="hint">${esc(r.noPrev)}</p>`; }
  h += '<h2 class="sec">Padrões</h2>';
  if (!cxOn('pat')) h += '<div class="card"><p class="hint" style="margin:0">Reconhecimento de padrões desligado em Configurações > Inteligência contextual.</p></div>';
  else if (!cxAllow('padroes')) h += '<div class="card"><p class="hint" style="margin:0">O reconhecimento de padrões faz parte de “Padrões e observações automáticas”, recurso Premium.</p></div>';
  else { const r = cxPatterns(S.records, S.events || [], cxPatOpts()); cxLog(r.list); h += r.list.length ? r.list.map(x => cxCardFull(x)).join('') : `<div class="card"><p class="hint" style="margin:0">${esc(r.why)}</p></div>`; }
  h += '<h2 class="sec">Resumo por período</h2>';
  if (!cxOn('sum')) h += '<div class="card"><p class="hint" style="margin:0">Resumos desligados em Configurações > Inteligência contextual.</p></div>';
  else { const cur = cxRange0(); h += `<div class="seg cx-seg" role="group" aria-label="Período do resumo">${[['24h', '24 horas'], ['7', '7 dias'], ['14', '14 dias'], ['30', '30 dias'], ['custom', 'Personalizado']].map(([v, t]) => cxChip('range', v, cur, t)).join('')}</div>`;
    if (cur === 'custom') { const iso = d => isoDate(new Date(d)); h += `<div class="card"><div class="row" style="gap:10px;align-items:flex-end"><div class="field grow"><label class="fl" for="cx-from">De</label><input class="in" id="cx-from" type="date" value="${esc(S.cx.from || iso(addDays(Date.now(), -13)))}"></div><div class="field grow"><label class="fl" for="cx-to">Até</label><input class="in" id="cx-to" type="date" value="${esc(S.cx.to || iso(Date.now()))}"></div><button type="button" class="btn pri" data-cx="sum-apply">Aplicar</button></div></div>`; }
    h += cxSumHTML(cxSum()); }
  if (cxo('priv', 'hist') && (st.log || []).length) h += `<h2 class="sec">Insights vistos</h2><div class="card"><ul class="cx-ul">${st.log.slice(-10).reverse().map(x => `<li><b>${esc(x.t)}</b><br><span class="dim">${esc(x.p || '')} · visto em ${cxDM(x.at)}</span></li>`).join('')}</ul><button type="button" class="cx-b" data-cx="clear-log">Limpar histórico</button></div>`;
  return h + `<button type="button" class="btn full" style="margin-top:12px" data-act="go" data-r="gxctx">Configurar a inteligência contextual</button>`;
}
VIEWS.ctxres = viewCtxRes; TITLES.ctxres = 'Insights e resumos'; MI.ctxres = MI.padroes;

/* ---------- configurações: Personalização > GLUXO Experience > Inteligência contextual ---------- */
/* Itens dispensados, o que o GLUXO aprendeu e restaurar tudo: usados aqui e na central GLUXO Experience (Inteligência dos dados) */
function cxGxExtras() {
  const st = cxState(), dl = Object.entries(st.dlog || {}).sort((a, b) => b[1].at - a[1].at), use = Object.entries(st.use || {}).filter(([r]) => TITLES[r]).sort((a, b) => b[1] - a[1]).slice(0, 5), hrs = Object.entries(st.hrs || {}).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const cats = Object.keys(CX_CATS).filter(k => (st.acc || {})[k] || (st.rej || {})[k]);
  return `<h2 class="sec">Itens dispensados</h2><div class="card">${dl.length ? `<ul class="cx-ul">${dl.map(([id, v]) => `<li class="row sp" style="gap:8px"><span>${esc(v.t)}<br><small class="dim">${v.r ? 'Lembrete' : 'Observação ou sugestão'} · ${cxDM(v.at)}</small></span><button type="button" class="cx-b" data-cx="restore" data-id="${esc(id)}">Restaurar</button></li>`).join('')}</ul><button type="button" class="cx-b" data-cx="restore-all">Restaurar todos</button>` : '<p class="hint" style="margin:0">Nada dispensado. Quando você dispensar uma observação, sugestão ou lembrete, ele aparece aqui para ser restaurado.</p>'}</div>`
    + `<h2 class="sec">O que o GLUXO aprendeu</h2><div class="card"><p class="hint" style="margin:0 0 8px">Só serve para tornar as sugestões mais relevantes. Fica neste aparelho e não muda a sua tela inicial, preferências, metas nem configurações clínicas.</p>${use.length || cats.length || hrs.length ? `<ul class="cx-ul">${use.length ? `<li>Telas mais usadas: ${use.map(([r, n]) => esc(TITLES[r]) + ' (' + n + ')').join(', ')}</li>` : ''}${cats.map(k => `<li>${CX_CATS[k]}: ${(st.acc || {})[k] || 0} aceitas, ${(st.rej || {})[k] || 0} dispensadas</li>`).join('')}${hrs.length ? `<li>Horários de abertura mais comuns: ${hrs.map(([h]) => cxP2(+h) + 'h').join(' e ')}</li>` : ''}</ul><button type="button" class="cx-b" data-cx="clear-learn">Apagar o que foi aprendido</button>` : '<p class="hint" style="margin:0">Ainda não há nada aprendido.</p>'}</div>`
    + `<button type="button" class="btn full" style="margin-top:12px" data-cx="reset-all">Restaurar toda a inteligência contextual</button>`;
}
function viewGxCtx() {
  return banners() + `<h2 class="sec">Inteligência contextual · GLUXO Experience</h2><p class="hint" style="margin:0 0 12px">Observações, sugestões e resumos feitos só com os seus registros, no aparelho: nada é enviado para fora. Cada categoria liga e desliga sozinha. ${CX_SAFE}</p><button type="button" class="btn full" data-act="go" data-r="ctxres" style="margin-bottom:12px">Ver insights e resumos</button>`
    + Object.entries(GX_F).filter(([f]) => f.startsWith('ctx_')).map(([f, x]) => gxSec(f, x)).join('')
    + cxGxExtras();
}
VIEWS.gxctx = viewGxCtx; TITLES.gxctx = 'Inteligência contextual';
const cxBack0 = backOf; backOf = function (r) { return r === 'gxctx' ? 'gxexp' : r === 'ctxres' ? 'painel' : cxBack0(r); };
document.addEventListener('change', e => { if (e.target && e.target.dataset && e.target.dataset.gx && /^ctx_/.test(e.target.dataset.gx)) cxMemo.sig = ''; });
