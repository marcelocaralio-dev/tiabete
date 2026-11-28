/* ===== Central de descobertas: interface (corpo da seção "Central de descobertas" da Análise) =====
   Cálculos em descobertas-core.js; os resultados vêm dos mecanismos que a Análise já usa (rcData, crData, anTModel, anCompare, rfPatterns).
   Histórico e cache ficam no banco local (meta "discoveries"); nada sai do aparelho. */
const DC_ST = { view: 'atuais', hv: 'todas', f: {}, open: new Set(), shown: 12 };
let dcMemo = { key: '', D: null }, dcLed = dsLedgerNew(), dcCache = null, dcReady = false, dcTimer = null;
const DC_COL = { recentes: 'c7', recorrentes: 'c6', mudancas: 'c5', horarios: 'c1', alimentacao: 'c8', associacoes: 'c11', evolucao: 'c3', insuficientes: 'c13' };
const DC_TIER = { alta: 'Prioridade alta', media: 'Prioridade média', baixa: 'Prioridade baixa' };
const DC_SIT = { novo: 'Novo', aumento: 'Em aumento', queda: 'Em diminuição', sumiu: 'Deixou de aparecer', estavel: 'Mantém-se', volta: 'Voltou a aparecer', curto: 'Mantém-se' };
const DC_FREQ = { freq: 'Frequente', mod: 'Moderada', oca: 'Ocasional' };
function dcLoad(v) { if (v && v.led && v.led.items) dcLed = v.led; if (v && v.cache && v.cache.key) dcCache = v.cache; dcReady = true; }
function dcSave() { if (!dcReady) return; clearTimeout(dcTimer); dcTimer = setTimeout(async () => { try { const c = dcCache && JSON.stringify(dcCache).length < 450000 ? dcCache : null; await Store.put('meta', { id: 'discoveries', value: { v: DS_VER, led: dcLed, cache: c } }); } catch (e) { } }, 800); }
function dcWipe() { dcLed = dsLedgerNew(); dcCache = null; dcMemo = { key: '', D: null }; dcSave(); }
function dcRc(M) { return RC_ST.min === RC_DEF.minOcc ? rcData(M) : rcModel(M.cur, { marks: MARKS, crit: { minOcc: 3, minDays: 3 }, eps: rfBuild(M.cur, S.bl || { meals: [] }, { calc: typeof blCalc === 'function' ? blCalc : undefined }).eps }); }
function dcData(M) {
  const bl = S.bl || { meals: [] }, key = [M.range, isoDate(new Date(M.now)), LIM.low, LIM.high, dsFp(M.cur, { m: (bl.meals || []).length, i: (S.inslog || []).length, e: (S.events || []).length, h: (S.hba || []).length, p: M.prev ? M.prev.length : -1, rc: RC_ST.min })].join('|');
  if (dcMemo.key === key) return dcMemo.D;
  let res = dcCache && dcCache.key === key ? dcCache.res : null;
  if (!res) {
    const calc = typeof blCalc === 'function' ? blCalc : undefined, W = { cur: M.cur, prev: M.prev, curR: M.curR, prevR: M.prevR, base: M.base };
    res = dsAssemble({ W, now: M.now, range: M.range, rc: dcRc(M), cr: crData(M), rfp: rfPatterns(rfBuild(M.cur, bl, { calc }).eps), cmp: M.prev ? anCompare(M.cur, M.prev) : null, ...dsTm(W, M.now) });
    dcCache = { key, res: dsLight(res) };
  } else res = { ...res, list: res.list.map(d => ({ ...d, cats: d.cats.filter(c => c !== 'recentes') })) };
  const rr = dsReconcile(dcLed, res, M.now); dcLed = rr.led; if (rr.changed || res.list.length) dcSave();
  const D = { res, sum: dsSummary(res) }; dcMemo = { key, D }; return D;
}
/* ---------- componentes ---------- */
const dcBar = (v, cls) => `<span class="dc-bar ${cls || ''}" aria-hidden="true"><i style="width:${Math.max(3, Math.min(100, v)).toFixed(0)}%"></i></span>`;
function dcSpark(d) {
  const recs = anRecs(d.recIds); if (recs.length < 3) return ''; const tl = dsTimeline(recs); if (!tl.pts || tl.pts.length < 2) return '';
  const mx = Math.max(...tl.pts.map(p => p.n), 1), pts = tl.pts.slice(-24);
  return `<span class="dc-spark" role="img" aria-label="Ocorrências ao longo do tempo (por ${tl.unit})">${pts.map(p => `<i style="height:${p.n ? Math.max(14, p.n / mx * 100).toFixed(0) : 6}%" class="${p.n ? '' : 'z'}"></i>`).join('')}</span>`;
}
function dcCmpVis(c) {
  if (!c || c.prev == null || c.cur == null) return ''; const mx = Math.max(c.prev, c.cur, 1) * 1.15, d = c.cur - c.prev;
  return `<div class="dc-cmp"><span>${esc(c.label)}</span><span class="dc-cmp-n num">${fn(c.prev, 1)}${esc(c.unit)} → <b>${fn(c.cur, 1)}${esc(c.unit)}</b> <small>(${fsign(d, 1)})</small></span>${anDumb(c.cur, c.prev, mx)}</div>`;
}
function dcDetail(d) {
  const recs = anRecs(d.recIds), tl = recs.length >= 3 ? dsTimeline(recs) : null, v = d.viz || {};
  let h = `<div class="dc-det"><h4>Dados utilizados</h4><ul class="dc-ev">${d.evidence.map(e => `<li>${esc(e)}</li>`).join('')}<li>${d.n} registros · ${d.days} dias · período ${esc(d.period)}</li>${d.also.length ? `<li>Também identificado em: ${d.also.map(esc).join(', ')}</li>` : ''}</ul>`;
  if (d.explain) h += `<h4>Explicação do resultado</h4><p>${esc(d.explain)}</p>`;
  if (tl && tl.pts && tl.pts.length > 1) h += `<h4>Distribuição temporal <small>(ocorrências por ${tl.unit})</small></h4>${anCols(tl.pts.slice(-16).map(p => ({ label: fmDMY(p.t).slice(0, 5), v: p.n, cls: 'c-' + (d.tone === 'low' ? 'low' : d.tone === 'high' ? 'high' : 'ok') })), { label: 'Ocorrências ao longo do tempo' })}`;
  if (v.blocks && v.blocks.some(b => b.n)) h += `<h4>Por faixa do dia</h4>${anCols(v.blocks.map(b => ({ label: b.l.replace('h', ''), v: b.n, cls: 'c-' + (d.tone === 'low' ? 'low' : 'high') })), { label: 'Ocorrências por faixa horária' })}`;
  if (v.months && v.months.length > 1) h += `<h4>Por mês <small>(ocorrências / unidades)</small></h4><p class="dc-mo">${v.months.map(m => `<span>${m.m.split('-').reverse().join('/')}: <b class="num">${m.h}/${m.n}</b></span>`).join('')}</p>`;
  if (v.scatter && v.scatter.length >= 8) h += `<h4>Gráfico</h4>${anScatter(v.scatter, v.xl, v.yl)}`;
  if (d.compare) h += `<h4>Comparação</h4>${dcCmpVis(d.compare)}`;
  h += `<h4>Critérios de identificação</h4><p>${esc(d.criteria || '')}</p><h4>Limitações</h4><ul class="dc-ev">${d.limits.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`;
  h += `<h4>Prioridade de leitura</h4><div class="dc-parts">${[['rec', 'Recorrência'], ['mag', 'Magnitude'], ['cons', 'Consistência'], ['atu', 'Atualidade'], ['evid', 'Evidências'], ['imp', 'Importância do indicador']].map(([k, l]) => `<div><span>${l}</span>${dcBar(d.parts[k] * 100)}</div>`).join('')}</div><p class="an-note">Evidência estatística (${d.stat}/100) e importância do indicador são medidas diferentes. A prioridade só ordena a leitura: não é diagnóstico nem avaliação de risco.</p>`;
  h += `<h4>Registros de origem</h4>${d.recTotal > recs.length ? `<p class="an-note">Mostrando ${recs.length} de ${d.recTotal} registros.</p>` : ''}${anRelated(recs, d.hist || { band: '' }, 'Ver os registros')}`;
  h += `<p class="dc-when"><span>Identificada em <b>${fmtDate(isoDate(new Date(d.firstSeen || Date.now())))}</b></span><span>Ocorrências ${d.first ? 'de ' + anDay(d.first) + ' a ' + anDay(d.last) : 'no período'}</span><span>Atualizada em <b>${fmtDate(isoDate(new Date(d.lastUpdate || Date.now())))}</b></span></p>`;
  return h + `<button type="button" class="btn sm" data-act="an-go" data-k="${d.link}">Ver a análise completa</button></div>`;
}
function dcCard(d) {
  const open = DC_ST.open.has(d.key), k = esc(d.key), cat = d.cats[0], rec = d.cats.includes('recentes');
  return `<article class="dc-card dc-${DC_COL[cat]} t-${d.tone} dc-t-${d.tier}${rec ? ' dc-new' : ''}"><div class="dc-top"><span class="dc-cat">${DS_CATS[cat]}</span>${rec ? '<span class="dc-pill new">Nova</span>' : ''}${d.sit && d.sit !== 'estavel' && d.sit !== 'novo' ? `<span class="dc-pill">${DC_SIT[d.sit] || ''}</span>` : ''}${d.cats.includes('mudancas') && cat !== 'mudancas' ? '<span class="dc-pill">Mudança</span>' : ''}${d.ex ? '<span class="dc-pill warn">Exploratória</span>' : ''}${d.isolated ? '<span class="dc-pill warn">Poucas repetições</span>' : ''}</div>
  <h3>${esc(d.title)}</h3><p class="an-card-t">${esc(d.text)}</p>
  <div class="dc-ind"><div><span>Relevância</span>${dcBar(d.score, 'rel')}<b class="num">${d.score}</b></div><div><span>Evidência</span>${dcBar(d.stat)}<b class="num">${d.stat}</b></div><div><span>Importância do indicador</span><b class="dc-imp ${d.impTier}">${{ alta: 'Alta', media: 'Média', baixa: 'Baixa' }[d.impTier]}</b></div></div>
  ${dcSpark(d)}${dcCmpVis(d.compare)}<p class="an-meta"><span>${esc(d.period)}</span><span>${d.n} registros · ${d.days} dias</span><span>Consistência ${d.cons}</span>${d.freq !== 'na' ? `<span>${DC_FREQ[d.freq]}</span>` : ''}<span>${DC_TIER[d.tier]}</span></p>
  <p class="dc-obs">Observação do histórico; não indica a causa.</p><button type="button" class="btn" data-act="dc-open" data-k="${k}" aria-expanded="${open}">${open ? 'Ocultar detalhes' : 'Ver detalhes'}</button>${open ? dcDetail(d) : ''}</article>`;
}
function dcSummaryHTML(D) {
  const s = D.sum, T = (k, l, n, cat) => `<button type="button" class="dc-tile dc-${DC_COL[cat || 'recentes']}" data-act="dc-cat" data-v="${cat || ''}"><b class="num">${n}</b><span>${l}</span></button>`;
  return `<div class="dc-hero"><p class="dc-lead">${esc(s.texto)}</p><div class="dc-tiles">${T('t', 'Descobertas', s.total, '')}${T('n', 'Recentes', s.novas, 'recentes')}${T('m', 'Mudanças', s.mudancas, 'mudancas')}${T('r', 'Recorrentes', s.recorrentes, 'recorrentes')}${T('a', 'Associações', s.associacoes, 'associacoes')}<button type="button" class="dc-tile dc-c13" data-act="dc-view" data-v="lacunas"><b class="num">${s.insuficientes}</b><span>Dados insuficientes</span></button></div>
  ${s.acompanhar ? `<p class="dc-watch"><b>Indicadores que merecem acompanhamento (${s.acompanhar}):</b> ${s.nomes.map(esc).join('; ')}${s.acompanhar > 3 ? '…' : ''}. É uma ordem de leitura, não uma avaliação de risco.</p>` : ''}</div>`;
}
function dcFilters(D) {
  const f = DC_ST.f, L = D.res.list, sel = (k, l, items) => `<div class="field"><label class="fl" for="dc-${k}">${l}</label><select class="in" id="dc-${k}" data-dc="${k}"><option value="">Todos</option>${items.map(([v, t]) => `<option value="${v}" ${String(f[k] || '') === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
  const cats = Object.keys(DS_CATS).filter(c => c !== 'insuficientes'), cnt = c => L.filter(d => d.cats.includes(c)).length;
  return `<div class="dc-chips" role="group" aria-label="Categorias"><button type="button" class="dc-chip" data-act="dc-cat" data-v="" aria-pressed="${!f.cat}">Todas<small>${L.length}</small></button>${cats.map(c => `<button type="button" class="dc-chip dc-${DC_COL[c]}" data-act="dc-cat" data-v="${c}" aria-pressed="${f.cat === c}">${DS_CATS[c]}<small>${cnt(c)}</small></button>`).join('')}</div>
  <details class="an-ev" ${Object.keys(f).some(k => k !== 'cat' && f[k]) ? 'open' : ''}><summary>Filtros</summary><div class="form-grid">${sel('per', 'Período das evidências', [[7, 'Últimos 7 dias'], [14, 'Últimos 14 dias'], [30, 'Últimos 30 dias'], [90, 'Últimos 90 dias']])}${sel('rel', 'Relevância', [['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa']])}${sel('rec', 'Recorrência', Object.entries(DC_FREQ))}${sel('nov', 'Novidade', [['novas', 'Recentes'], ['antigas', 'Já conhecidas']])}${sel('sit', 'Situação atual', [['estavel', 'Mantém-se'], ['aumento', 'Em aumento'], ['queda', 'Em diminuição'], ['novo', 'Novo'], ['volta', 'Voltou a aparecer'], ['sumiu', 'Deixou de aparecer']])}${sel('tipo', 'Tipo de associação', [['correlacao', 'Correlação entre variáveis'], ['grupos', 'Comparação entre grupos']])}</div></details>
  ${Object.values(f).some(Boolean) ? '<button type="button" class="btn sm" data-act="dc-reset">Restaurar visualização completa</button>' : ''}`;
}
function dcGapsHTML(D) {
  const g = D.res.gaps; return g.length ? `<div class="an-cards">${g.map(x => `<article class="dc-card dc-c13"><div class="dc-top"><span class="dc-cat">Dados insuficientes</span></div><h3>${esc(x.area)}</h3><p class="an-card-t">${esc(x.have)}.</p><p class="dc-obs">${esc(x.need)}</p></article>`).join('')}</div><p class="an-note">Ausência de registros não significa ausência de eventos: apenas não há dados para analisar.</p>` : anEmpty('Nenhuma lacuna importante', 'Todas as áreas analisadas têm dados suficientes neste período.');
}
function dcHistHTML(D) {
  const st = DC_ST.hv, all = Object.values(dcLed.items).filter(e => e.range === D.res.range).sort((a, b) => b.firstSeen - a.firstSeen);
  const tabs = [['todas', 'Anteriores e atuais'], ['ativa', 'Atuais'], ['ausente', 'Deixaram de aparecer'], ['tier', 'Mudaram de classificação'], ['evo', 'Evolução das evidências']], pick = e => st === 'ativa' ? e.status === 'ativa' : st === 'ausente' ? e.status === 'ausente' : st === 'tier' ? !!e.tierChangedAt : st === 'evo' ? e.snaps.length > 1 : true, rows = all.filter(pick);
  const dd = ms => fmtDate(isoDate(new Date(ms)));
  return `<div class="seg an-seg" role="group" aria-label="Histórico">${tabs.map(([k, l]) => `<button type="button" data-act="dc-hv" data-v="${k}" aria-pressed="${st === k}">${l}</button>`).join('')}</div>
  ${rows.length ? `<div class="an-cards">${rows.slice(0, 60).map(e => `<article class="dc-card dc-${DC_COL[e.cat] || 'c13'} ${e.status === 'ausente' ? 'dc-gone' : ''}"><div class="dc-top"><span class="dc-cat">${DS_CATS[e.cat] || ''}</span><span class="dc-pill ${e.status === 'ausente' ? 'warn' : ''}">${e.status === 'ausente' ? 'Deixou de aparecer' : 'Ativa'}</span></div><h3>${esc(e.title)}</h3>
  <p class="an-meta"><span>Identificada em ${dd(e.firstSeen)}</span><span>Última vez vista em ${dd(e.lastSeen)}</span>${e.absentSince ? `<span>Não observada desde ${dd(e.absentSince)}</span>` : ''}${e.first ? `<span>Ocorrências de ${anDay(e.first)} a ${anDay(e.last)}</span>` : ''}</p>
  ${e.tierChangedAt ? `<p class="an-card-t">Classificação: ${DC_TIER[e.tierPrev] || ''} → ${DC_TIER[e.tier]} em ${dd(e.tierChangedAt)}.</p>` : ''}
  ${e.snaps.length > 1 ? `<div class="dc-snaps" aria-label="Evolução das evidências">${e.snaps.map(s => `<span title="${dd(s.t)}: ${s.n} registros, relevância ${s.score}"><i style="height:${Math.max(12, s.score)}%"></i><small>${s.n}</small></span>`).join('')}</div><p class="an-note">Cada barra é uma leitura (data de identificação); o número é a quantidade de registros naquela leitura.</p>` : ''}</article>`).join('')}</div>` : anEmpty('Nada por aqui ainda', 'O histórico é formado a cada leitura da Central, sem apagar descobertas antigas.')}
  <p class="an-note">A data de identificação é quando a Central notou o padrão; o período das ocorrências é quando os fatos aconteceram nos seus registros.${dcLed.trimmed ? ` ${dcLed.trimmed} registros muito antigos foram arquivados por limite de espaço.` : ''}</p>`;
}
function dcBody(M) {
  const D = dcData(M), R = D.res;
  if (!R.list.length && !R.gaps.length) return anEmpty('Nenhuma descoberta por enquanto', esc(R.why));
  const views = [['atuais', 'Descobertas'], ['hist', 'Histórico'], ['lacunas', 'Dados insuficientes' + (R.gaps.length ? ` (${R.gaps.length})` : '')]];
  const list = dsFilter(R.list, { ...DC_ST.f, now: M.now }), show = list.slice(0, DC_ST.shown);
  const body = DC_ST.view === 'hist' ? dcHistHTML(D) : DC_ST.view === 'lacunas' ? dcGapsHTML(D) : !R.list.length ? anEmpty('Nenhuma descoberta por enquanto', esc(R.why)) : `${dcFilters(D)}${list.length ? `<div class="an-cards dc-cards">${show.map(dcCard).join('')}</div>${list.length > show.length ? `<button type="button" class="btn" data-act="dc-more">Mostrar mais (${list.length - show.length})</button>` : ''}` : anEmpty('Nenhuma descoberta com estes filtros', 'Restaure a visualização completa para ver todas.')}`;
  return `<div id="dc-root">${dcSummaryHTML(D)}<div class="seg an-seg dc-views" role="group" aria-label="Visões da Central">${views.map(([k, l]) => `<button type="button" data-act="dc-view" data-v="${k}" aria-pressed="${DC_ST.view === k}">${l}</button>`).join('')}</div>${body}${anNote('Descobertas descrevem números dos seus registros neste período. Mostram o que aconteceu, não a causa, e não são diagnóstico, avaliação de risco, recomendação de tratamento ou de dose. Só aparecem com evidência suficiente.')}</div>`;
}
const dcSum = M => { const s = dcData(M).sum; return s.total ? `<span class="an-sc-i"><b class="num">${s.total}</b> descoberta${s.total > 1 ? 's' : ''}</span>${s.novas ? `<span class="an-sc-i"><b class="num">${s.novas}</b> recente${s.novas > 1 ? 's' : ''}</span>` : ''}${s.mudancas ? `<span class="an-sc-i"><b class="num">${s.mudancas}</b> mudança${s.mudancas > 1 ? 's' : ''}</span>` : ''}` : '<span class="an-sc-i dim">Sem destaques com estes dados</span>'; };
function dcRefresh() { const r = document.getElementById('dc-root'); if (r) { const y = window.scrollY; r.outerHTML = dcBody(anModel()); try { attachCharts(document.getElementById('dc-root')); } catch (e) { } window.scrollTo(0, y); } }
document.addEventListener('click', e => {
  const el = e.target.closest && e.target.closest('[data-act^="dc-"]'); if (!el || S.route !== 'analise') return; const a = el.dataset.act, v = el.dataset.v;
  if (a === 'dc-open') DC_ST.open.has(el.dataset.k) ? DC_ST.open.delete(el.dataset.k) : DC_ST.open.add(el.dataset.k);
  else if (a === 'dc-cat') { DC_ST.f.cat = v || ''; DC_ST.view = 'atuais'; DC_ST.shown = 12; }
  else if (a === 'dc-view') DC_ST.view = v; else if (a === 'dc-hv') DC_ST.hv = v;
  else if (a === 'dc-reset') { DC_ST.f = {}; DC_ST.shown = 12; } else if (a === 'dc-more') DC_ST.shown += 12;
  dcRefresh();
});
document.addEventListener('change', e => { const t = e.target, k = t && t.dataset && t.dataset.dc; if (!k) return; DC_ST.f[k] = t.value; DC_ST.shown = 12; dcRefresh(); });
