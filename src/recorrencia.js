/* ===== Recorrências: cartões, filtros, histórico e evidências (seção "Padrões recorrentes" da Análise) ===== */
const RC_ST = { f: {}, open: new Set(), shown: {}, min: 3 };
let rcMemo = { key: '', M: null };
function rcData(M) {
  /* a chave cobre todos os campos usados: qualquer edição relevante invalida o resultado */
  const key = JSON.stringify([RC_ST.min, LIM.low, LIM.high, M.cur.map(r => [r.id, r.ts, r.time, r.noTime, r.glucose, r.context, r.meal, r.marks, r.insMeal, r.insCorr, r.insBasal, r.actMin, r.actDesc, r.mealDesc, r.carbs]), (S.bl || {}).meals]);
  if (rcMemo.key !== key) rcMemo = { key, M: rcModel(M.cur, { marks: MARKS, crit: { minOcc: RC_ST.min, minDays: Math.min(3, RC_ST.min) }, eps: rfBuild(M.cur, S.bl || { meals: [] }, { calc: typeof blCalc === 'function' ? blCalc : undefined }).eps }) };
  return rcMemo.M;
}
const rcSel = (k, l, items) => `<div class="field"><label class="fl" for="rc-${k}">${l}</label><select class="in" id="rc-${k}" data-rc="${k}">${items.map(([v, t]) => `<option value="${v}" ${String(k === 'min' ? RC_ST.min : RC_ST.f[k] || '') === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
const rcPct = (h, n) => n ? fn(h / n * 100, 0) + '%' : '—';
function rcCard(p) {
  const open = RC_ST.open.has(p.id), k = esc(p.id), show = RC_ST.shown[p.id] || 10, rows = [];
  for (let e = p.recs.length; open && e > Math.max(0, p.recs.length - show); e -= 10) rows.push(pmRecList(p.recs.slice(Math.max(0, e - 10), e)));
  const link = { tempo: ['tmp', 'Análise por horários'], ali: ['rfe', 'Refeições e glicemia'], trat: ['ass', 'Associações'], comp: ['ass', 'Associações'], gli: ['comp', 'Comparar períodos'] }[p.cat];
  return `<article class="an-card rc-${p.cat}"><span class="rc-cat">${RC_CATS[p.cat]}</span><h3>${esc(p.name)}</h3>
  <p class="an-card-t">Foi observado em ${p.count} de ${p.total} ${p.unit} (${fn(p.rate, 0)}%), em ${p.days} dias.</p>
  <p class="an-meta"><span>${RC_FREQ[p.freq]}</span><span>${RC_EVO[p.k]}</span>${p.recent ? '<span>Recente</span>' : ''}<span>Consistência ${p.cons}</span><span>${anDay(p.first)} a ${anDay(p.last)}</span></p>
  <button type="button" class="btn" data-act="rc-open" data-k="${k}" aria-expanded="${open}">${open ? 'Ocultar detalhes' : 'Ver detalhes e registros'}</button>
  ${open ? `<div class="rc-det"><p><b>Critério:</b> ${p.crit} Mínimo de ${rcMemo.M.crit.minOcc} ocorrências. Consistência: presente em ${fn(p.weeks, 0)}% das semanas analisadas.</p>
  <p><b>Evolução:</b> metade antiga ${p.half.old.join('/')} (${rcPct(...p.half.old)}); metade recente ${p.half.rec.join('/')} (${rcPct(...p.half.rec)}).<br>${p.months.map(m => `${m.m.split('-').reverse().join('/')}: ${m.h}/${m.n}`).join(' · ')}</p>
  <p><b>Por horário:</b> ${p.blocks.filter(b => b.n).map(b => `${b.l}: ${b.n}`).join(' · ') || 'sem horário'}${p.noTime ? ` · ${p.noTime} registro(s) sem horário` : ''}</p>
  ${p.other ? `<p><b>Nos demais dias:</b> ${fn(p.other.rate, 0)}% de ${p.other.n} dias.</p>` : ''}${p.also.length ? `<p><b>Os mesmos registros também aparecem como:</b> ${p.also.map(esc).join('; ')}.</p>` : ''}
  <button type="button" class="btn" data-act="an-go" data-k="${link[0]}">${link[1]}</button>${rows.join('')}${p.recs.length > show ? `<button type="button" class="btn" data-act="rc-more" data-k="${k}">Mostrar mais (${p.recs.length - show})</button>` : ''}</div>` : ''}</article>`;
}
function rcBody(M) {
  const R = rcData(M), f = RC_ST.f, list = R.list.filter(p => (!f.cat || p.cat === f.cat) && (!f.freq || p.freq === f.freq) && (!f.evo || (f.evo === 'recente' ? p.recent : p.k === f.evo)) && (!f.band || p.band === f.band) && (!f.type || p.type === f.type) && (!f.hour || p.blocks[+f.hour].n));
  const all = [['', 'Todos']], types = [['hipo', 'Hipoglicemia'], ['hiper', 'Hiperglicemia'], ['oscilacao', 'Oscilação'], ['variabilidade', 'Variabilidade'], ['media', 'Média diária'], ['regularidade', 'Regularidade de horários']];
  const hist = Object.entries(RC_EVO).filter(([k]) => k !== 'curto').map(([k, l]) => [k, l, R.list.filter(p => p.k === k).length]);
  return `<div id="rc-root"><div class="rc-hist" role="group" aria-label="Histórico de padrões"><button type="button" data-act="rc-evo" data-k="">Identificados<b class="num">${R.list.length}</b></button>${hist.map(([k, l, n]) => `<button type="button" data-act="rc-evo" data-k="${k}" aria-pressed="${f.evo === k}">${l}<b class="num">${n}</b></button>`).join('')}</div>
  <details class="an-ev" ${Object.values(f).some(Boolean) ? 'open' : ''}><summary>Filtros e critérios</summary><div class="form-grid">${rcSel('cat', 'Categoria', all.concat(Object.entries(RC_CATS)))}${rcSel('freq', 'Frequência', all.concat(Object.entries(RC_FREQ)))}${rcSel('evo', 'Evolução', all.concat(Object.entries(RC_EVO), [['recente', 'Recente (14 dias)']]))}${rcSel('hour', 'Horário', all.concat(TIME_BLOCKS.map((b, i) => [i, b.label])))}${rcSel('band', 'Classificação glicêmica', all.concat([['low', 'Baixa'], ['high', 'Elevada']]))}${rcSel('type', 'Tipo de evento', all.concat(types))}${rcSel('min', 'Mínimo de ocorrências', [2, 3, 5, 8].map(n => [n, n]))}</div></details>
  ${anNote(`Período: ${M.rl} (ajuste no intervalo de dias). ${R.n} registros analisados; ${R.dup} duplicados ignorados; ${R.noTime} sem horário e ${R.noCtx} sem contexto específico ficam fora das análises que dependem desses campos. Dias sem registro não contam como ausência do evento.`)}
  ${list.length ? `<div class="an-cards">${list.map(rcCard).join('')}</div>` : anEmpty('Nenhum padrão claro', 'Não há recorrência com os critérios e filtros atuais.')}
  ${anNote('Ocorreu repetidamente ou apareceu associado não significa que um fato causou o outro. Não são diagnósticos nem recomendações.')}</div>`;
}
function rcRefresh() { const r = document.getElementById('rc-root'); if (r) r.outerHTML = rcBody(anModel()); }
document.addEventListener('click', e => {
  const el = e.target.closest && e.target.closest('[data-act^="rc-"]'); if (!el) return; const a = el.dataset.act, k = el.dataset.k;
  if (a === 'rc-open') RC_ST.open.has(k) ? RC_ST.open.delete(k) : RC_ST.open.add(k); else if (a === 'rc-more') RC_ST.shown[k] = (RC_ST.shown[k] || 10) + 20; else RC_ST.f.evo = k;
  rcRefresh();
});
document.addEventListener('change', e => { const t = e.target, k = t && t.dataset && t.dataset.rc; if (!k) return; if (k === 'min') RC_ST.min = +t.value; else RC_ST.f[k] = t.value; rcRefresh(); });
