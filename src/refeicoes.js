/* ================= Refeições e glicemia: interface =================
   Seção da Análise que relaciona medições às refeições já registradas (cálculo em refeicoes-core.js).
   Só lê dados: não altera o Bolus, não calcula nem sugere dose, não afirma causa. */
const RFE_LS = 'tb-ana-rfe', RFE_TABS = [['resumo', 'Resumo'], ['comparar', 'Comparar'], ['padroes', 'Padrões'], ['qualidade', 'Qualidade']];
const RFE_COL = { cafe: 'rf-m-cafe', almoco: 'rf-m-almoco', jantar: 'rf-m-jantar', lanche: 'rf-m-lanche', ceia: 'rf-m-ceia' };
let rfeMemo = { key: '', M: null }, rfeSt = null, rfeShown = {}, rfeLists = {};
function rfeState() {
  if (rfeSt) return rfeSt; let o = null; try { o = JSON.parse(localStorage.getItem(RFE_LS) || 'null'); } catch (e) { }
  rfeSt = { f: rfFilterClean(o && o.f), tab: o && RFE_TABS.some(t => t[0] === o.tab) ? o.tab : 'resumo', A: o && typeof o.A === 'string' ? o.A.slice(0, 80) : '', B: o && typeof o.B === 'string' ? o.B.slice(0, 80) : '', fo: !!(o && o.fo) }; return rfeSt;
}
function rfeSave() { try { localStorage.setItem(RFE_LS, JSON.stringify(rfeSt)); } catch (e) { } }
function rfeModel() {
  const st = rfeState(), R = anBase(S.records), bl = S.bl || { meals: [] }; let cs = 0;
  for (let i = 0; i < R.length; i++) cs = (cs * 31 + Math.round(R[i].glucose * 10) + (R[i].ts % 100003) + (R[i].context ? R[i].context.length : 0) + (R[i].meal ? R[i].meal.length * 7 : 0) + Math.round((R[i].carbs || 0) * 3)) % 1000000007;
  const bm = (bl.meals || []).length, bs = (bl.meals || []).reduce((a, m) => (a * 31 + Math.round(m.net * 10) + (m.ts % 100003)) % 1000000007, 0), fd = (bl.foods || []).length;
  const key = [R.length, cs, bm, bs, fd, Object.keys(bl.days || {}).length, JSON.stringify(st.f), LIM.low, LIM.high].join('|');
  if (rfeMemo.key === key) return rfeMemo.M;
  const M = rfModel(R, bl, st.f, { calc: typeof blCalc === 'function' ? blCalc : undefined }); rfeMemo = { key, M }; return M;
}
const rfeBand = (v, ctx) => bandOf(v, ctx || 'depois').k;
const rfeN = (n, one, many) => n + ' ' + (n === 1 ? one : many);
const rfeKind = k => k === 'log' ? ['Refeição feita', 'k-log'] : k === 'registro' ? ['Registro com refeição', 'k-reg'] : ['Só classificada', 'k-cls'];
const rfeSg = (v, d = 0) => v == null ? '—' : fsign(v, d);
function rfeFilters(M) {
  const f = M.filter, st = rfeState(), act = Object.entries(f).filter(([k, v]) => v !== '' && v !== false).length;
  const sel = (id, label, items, cur) => `<div class="field"><label class="fl" for="${id}">${label}</label><select class="in" id="${id}" data-rfe="${id.slice(4)}">${items.map(([v, l]) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
  return `<details class="rf-flt" id="rfe-flt" ${st.fo || act ? 'open' : ''}><summary><b>Filtros</b>${act ? `<span class="rf-fc num">${act} ativo${act > 1 ? 's' : ''}</span>` : '<span class="rf-fc dim">nenhum</span>'}${M.hidden ? `<span class="rf-fh">${M.hidden} fora do filtro</span>` : ''}</summary>
    <div class="form-grid"><div class="field"><label class="fl" for="rfe-from">De</label><input class="in" type="date" id="rfe-from" data-rfe="from" value="${esc(f.from)}"></div><div class="field"><label class="fl" for="rfe-to">Até</label><input class="in" type="date" id="rfe-to" data-rfe="to" value="${esc(f.to)}"></div>
    ${sel('rfe-meal', 'Tipo de refeição', [['', 'Todas']].concat(RF_MEALS.map(m => [m.k, m.t])), f.meal)}
    ${sel('rfe-food', 'Alimento', [['', 'Qualquer']].concat(M.foodNames.map(n => [n, n])), f.food)}
    <div class="field"><label class="fl" for="rfe-cmin">Carboidratos de (g)</label><input class="in" id="rfe-cmin" data-rfe="cmin" inputmode="decimal" value="${esc(f.cmin)}" placeholder="mín."></div><div class="field"><label class="fl" for="rfe-cmax">até (g)</label><input class="in" id="rfe-cmax" data-rfe="cmax" inputmode="decimal" value="${esc(f.cmax)}" placeholder="máx."></div>
    ${sel('rfe-ctx', 'Contexto do dia', [['', 'Qualquer'], ['sem', 'Dia de semana'], ['fds', 'Fim de semana']], f.ctx)}
    ${sel('rfe-ins', 'Registro de insulina', [['', 'Qualquer'], ['sim', 'Com insulina registrada'], ['nao', 'Sem insulina registrada']], f.ins)}
    ${sel('rfe-origin', 'Origem do registro', [['', 'Qualquer'], ['log', 'Refeição feita (Bolus)'], ['registro', 'Registro com refeição'], ['classificada', 'Só classificada']], f.origin)}
    <div class="field"><label class="fl">Repetidas</label><button type="button" class="an-ct" data-act="rfe-rep" aria-pressed="${f.rep}">Só refeições repetidas</button></div></div>
    <div class="row" style="gap:8px;margin-top:8px"><button type="button" class="btn sm" data-act="rfe-clear" ${act ? '' : 'disabled'}>Limpar filtros</button></div>
    <p class="an-note">Nenhum campo é obrigatório: episódios sem carboidratos ou sem alimentos continuam na análise, e só saem quando o filtro correspondente pede esse dado.</p></details>`;
}
function rfeKpis(M) {
  const s = M.stats, q = M.quality.byKind;
  return `<div class="an-kpis rf-kpis">${anKpi({ t: 'Episódios', v: s.n, sub: 'refeições com medição ligada' })}${anKpi({ t: 'Com antes e depois', v: s.nPair, sub: s.n ? fn(s.nPair / s.n * 100, 0) + '% dos episódios' : '' })}${anKpi({ t: 'Refeição feita', v: q.log, sub: 'registrada no Bolus' })}${anKpi({ t: 'Registro com refeição', v: q.registro, sub: 'na própria medição' })}${anKpi({ t: 'Só classificadas', v: q.classificada, sub: 'pré/pós sem dados da refeição' })}</div>`;
}
/* gráfico antes e depois: um par por episódio, em ordem de data */
function rfePairs(eps) {
  const a = eps.filter(e => e.complete).slice(-24); if (a.length < 2) return '';
  const W = 320, H = 150, L = 30, R = 6, T = 8, B = 20, ys = a.flatMap(e => [e.pre.glucose, e.post.glucose]), y0 = Math.min(40, ...ys), y1 = Math.max(260, ...ys), Y = v => H - B - (v - y0) / (y1 - y0) * (H - B - T), step = (W - L - R) / a.length, X = i => L + step * (i + .5);
  return `<svg class="an-sc rf-pairs" viewBox="0 0 ${W} ${H}" role="img" aria-label="Glicemia antes e depois em ${a.length} episódios, do mais antigo ao mais recente."><rect class="rf-ok" x="${L}" y="${Y(LIM.high).toFixed(1)}" width="${W - L - R}" height="${(Y(LIM.low) - Y(LIM.high)).toFixed(1)}"/>${[LIM.low, LIM.high].map(v => `<text class="an-at" x="${L - 3}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${v}</text>`).join('')}
    ${a.map((e, i) => `<line class="rf-ln" x1="${X(i).toFixed(1)}" y1="${Y(e.pre.glucose).toFixed(1)}" x2="${X(i).toFixed(1)}" y2="${Y(e.post.glucose).toFixed(1)}"/><circle class="rf-d1" cx="${X(i).toFixed(1)}" cy="${Y(e.pre.glucose).toFixed(1)}" r="3"/><circle class="rf-d2 an-b-${rfeBand(e.post.glucose)}" cx="${X(i).toFixed(1)}" cy="${Y(e.post.glucose).toFixed(1)}" r="3.6"/>`).join('')}
    <text class="an-at" x="${L}" y="${H - 6}">${fmtDM(a[0].ts)}</text><text class="an-at" x="${W - R}" y="${H - 6}" text-anchor="end">${fmtDM(a[a.length - 1].ts)}</text></svg><p class="an-sc-y"><i class="rf-sw d1"></i> antes &nbsp; <i class="rf-sw d2"></i> depois (cor pela faixa) · últimos ${a.length} episódios com par</p>`;
}
function rfeEpRow(e) {
  const k = rfeKind(e.kind), g = e.pre && e.post ? `${f0(e.pre.glucose)} → ${f0(e.post.glucose)}` : e.pre ? `${f0(e.pre.glucose)} → —` : `— → ${f0(e.post.glucose)}`;
  return `<button type="button" class="rf-ep ${RFE_COL[e.meal] || ''}" data-act="rfe-ep" data-id="${esc(e.id)}"><span class="rf-ep-d num">${fmtDM(e.ts)}<small>${e.time || '—:—'}</small></span><span class="rf-ep-m"><b>${esc(rfMealName(e.meal))}</b><small class="${k[1]}">${k[0]}${e.carbs ? ' · ' + fn(e.carbs.v, 0) + ' g ' + (e.carbs.k === 'total' ? 'tot.' : 'inf.') : ''}</small></span><span class="rf-ep-g num">${g}<small>${e.delta != null ? rfeSg(e.delta) + ' mg/dL' : 'sem par'}</small></span></button>`;
}
function rfeEpList(eps, key) {
  rfeLists[key] = eps; return `<div class="rf-wrap" data-k="${esc(key)}">${rfeListInner(key)}</div>`;
}
function rfeListInner(key) {
  const sh = rfeShown[key] || 8, a = (rfeLists[key] || []).slice().sort((x, y) => y.ts - x.ts), v = a.slice(0, sh);
  return `<div class="rf-eps">${v.map(rfeEpRow).join('')}</div>${a.length > v.length ? `<button type="button" class="btn sm" data-act="rfe-more" data-k="${esc(key)}">Mostrar mais (${a.length - v.length})</button>` : ''}`;
}
function rfeMealCard(g) {
  const s = g.st; if (!s.n) return `<article class="rf-card ${RFE_COL[g.k]}"><h3>${g.t}</h3><p class="an-card-t dim">Nenhum episódio com estes filtros.</p></article>`;
  const mx = 300, small = s.nPair < RF_MIN;
  return `<article class="rf-card ${RFE_COL[g.k]}"><h3>${g.t}<span class="rf-n num">${rfeN(s.n, 'episódio', 'episódios')}</span></h3>
    ${s.hasMean ? `<div class="rf-ba"><span class="rf-ba-l">antes <b class="num">${f0(s.preMean)}</b></span>${anDumb(s.preMean, s.pairPostMean, mx)}<span class="rf-ba-l">depois <b class="num">${f0(s.pairPostMean)}</b></span></div><p class="rf-dl num ${s.deltaMean > 0 ? 'up' : 'dn'}">${rfeSg(s.deltaMean)}<small> mg/dL de variação média · ${s.nPair} com par${s.gapMed != null ? ' · intervalo típico ' + f0(s.gapMed) + ' min' : ''}</small></p>` : `<p class="an-card-t dim">Menos de ${RF_MIN_MEAN} episódios com antes e depois (${s.nPair}): sem média.</p>`}
    ${small && s.hasMean ? `<p class="an-warn">Amostra pequena (mínimo para comparar: ${RF_MIN}).</p>` : ''}
    <ul class="rf-fa"><li><span>Menor / maior depois</span><b class="num">${f0(s.postMin)} / ${f0(s.postMax)}</b></li><li><span>Valores baixos depois</span><b class="num">${s.lowN} de ${s.nPost}</b></li><li><span>Valores elevados depois</span><b class="num">${s.highN} de ${s.nPost}</b></li>${s.carbN ? `<li><span>Carboidratos (média)</span><b class="num">${f0(s.carbMean)} g<small> n=${s.carbN}</small></b></li>` : ''}${s.foodsN ? `<li><span>Alimentos por refeição</span><b class="num">${fn(s.foodsMean, 1)}<small> n=${s.foodsN}</small></b></li>` : ''}</ul>
    ${s.nPost ? `<div class="rf-dist">${anStack(s.dist, s.nPost)}<small>Distribuição das ${s.nPost} medições depois da refeição</small></div>` : ''}
    <details class="an-rel"><summary>Ver episódios (${s.n})</summary>${rfeEpList(g.eps || [], 'm' + g.k)}</details></article>`;
}
function rfeCarbs(M) {
  const t = M.carbs.total, inf = M.carbs.informado; if (!t.n && !inf.n) return anEmpty('Sem carboidratos registrados', 'Quando houver refeições feitas no Bolus ou registros de glicemia com carboidratos, a relação com a glicemia depois aparece aqui.');
  const blk = (c, title, nota) => { if (!c.n) return ''; const mx = Math.max(...c.bins.map(b => Math.abs(b.delta || 0)), 1);
    return `<article class="rf-card rf-c-carb"><h3>${title}<span class="rf-n num">${rfeN(c.n, 'refeição', 'refeições')} · ${c.nPair} com par</span></h3><p class="an-card-t">${nota}</p>
    <div class="an-ab-bins">${c.bins.map(b => `<div class="an-bn"><span>${b.l}<small>n=${b.n}</small></span><span class="an-bnt" aria-hidden="true">${b.delta != null ? `<i class="${b.delta >= 0 ? 'pos' : 'neg'}" style="${b.delta >= 0 ? 'left:50%' : 'right:50%'};width:${(Math.abs(b.delta) / mx * 50).toFixed(1)}%"></i>` : ''}</span><b class="num">${b.delta != null ? rfeSg(b.delta) + ' mg/dL' : '—'}<small>${b.delta != null ? 'variação média' : 'menos de ' + RF_MIN_MEAN}</small></b></div>`).join('')}</div>
    ${anCols(c.dist.map(d => ({ label: d.l.replace(' ou mais', '+'), v: d.n, show: d.n, cls: 'c-var' })), { label: 'Distribuição de carboidratos' })}<p class="an-note">Distribuição: quantas refeições em cada faixa de carboidratos.</p>
    ${c.r != null ? `<p class="an-corr">${anCorrTxt(c.r)}</p>` : `<p class="an-note">Correlação só com 10 ou mais pares (aqui: ${c.nPair}).</p>`}${anScatter(c.points, 'carboidratos (g)', 'variação depois − antes (mg/dL)')}</article>`; };
  return `<div class="an-cards">${blk(t, 'Carboidratos totais e variação', 'Valor <b>total</b> guardado na Refeição feita do Bolus (não é o líquido que o cálculo de bolus usa). Média: ' + f0(t.mean) + ' g.')}${blk(inf, 'Carboidratos informados no registro', 'Valor digitado no registro de glicemia, do jeito que foi informado (sem classificar como total ou líquido). Média: ' + f0(inf.mean) + ' g.')}</div>${anNote('As duas fontes ficam separadas de propósito: não são a mesma medida. Relação observada nos seus registros, sem insulina, atividade ou tipo de alimento considerados.')}`;
}
function rfeFoods(M) {
  const F = M.foodsFreq; if (!F.base) return anEmpty('Sem alimentos identificados', 'Os alimentos só aparecem quando a Refeição feita tem o mesmo total de carboidratos do registro do dia ou do modelo do Bolus. Nada é presumido.');
  const mx = F.list[0].n, top = F.list.slice(0, 10);
  return `<article class="rf-card rf-c-alim"><h3>Alimentos mais usados<span class="rf-n num">${rfeN(F.base, 'refeição', 'refeições')} com alimentos</span></h3><div class="rf-fq">${top.map(f => `<div class="rf-fqr"><span>${esc(f.name)}<small>${f.n}× · ${fn(f.pct, 0)}%</small></span><span class="rf-fqb" aria-hidden="true"><i style="width:${(f.n / mx * 100).toFixed(0)}%"></i></span><b class="num">${f.delta != null ? rfeSg(f.delta) : '—'}<small>${f.delta != null ? 'var. média (' + f.nPair + ')' : 'n=' + f.nPair}</small></b></div>`).join('')}</div>${F.list.length > 10 ? `<p class="an-note">Mostrando 10 de ${F.list.length} alimentos.</p>` : ''}</article>`;
}
function rfeBodyResumo(M) {
  if (!M.list.length) return anEmpty('Nenhum episódio de refeição', M.all.length ? 'Os filtros escolhidos não deixam nenhum episódio. Limpe os filtros para ver todos.' : 'Para esta análise é preciso marcar a refeição e o contexto (antes/depois) ao registrar a glicemia, ou usar “Refeição feita” no Bolus. Nada é inferido só pelo horário.');
  M.byMeal.forEach(g => { g.eps = M.list.filter(e => e.meal === g.k); });
  const s = M.stats;
  return `${rfeKpis(M)}<h3 class="an-sub">Por tipo de refeição</h3><div class="an-cards rf-meals">${M.byMeal.filter(g => g.st.n || RF_MEALS.slice(0, 4).some(m => m.k === g.k)).map(rfeMealCard).join('')}</div>
    <h3 class="an-sub">Antes e depois, episódio a episódio</h3><article class="rf-card rf-c-tl">${rfePairs(M.list) || '<p class="an-card-t dim">Precisa de 2 ou mais episódios com antes e depois.</p>'}</article>
    <h3 class="an-sub">Distribuição geral das medições depois</h3><article class="rf-card rf-c-dist">${s.nPost ? `${anStack(s.dist, s.nPost)}${anBandLegend(s.dist, s.nPost)}<p class="an-note">${s.nPost} medições depois de refeições. Menor ${f0(s.postMin)} · maior ${f0(s.postMax)} mg/dL.</p>` : '<p class="an-card-t dim">Sem medições depois.</p>'}</article>
    <h3 class="an-sub">Carboidratos</h3>${rfeCarbs(M)}<h3 class="an-sub">Alimentos</h3>${rfeFoods(M)}
    ${anNote('Cada episódio liga uma refeição às medições que a pessoa marcou como “antes” e “depois” do mesmo tipo, no mesmo dia e dentro da janela de tempo (antes: até 3 h; depois: 30 min a 6 h). Medições só próximas no horário não são ligadas. Relações observadas, não causas.')}`;
}
function rfeGroupOpts(M, cur) { const G = M.groups, gr = (k, l) => { const a = G.filter(g => g.kind === k); return a.length ? `<optgroup label="${l}">${a.map(g => `<option value="${esc(g.id)}" ${g.id === cur ? 'selected' : ''}>${esc(g.label)} (${g.st.n})</option>`).join('')}</optgroup>` : ''; }; return `<option value="">Escolha…</option>${gr('tipo', 'Tipos de refeição')}${gr('repetida', 'Refeições repetidas')}${gr('carbo', 'Faixas de carboidratos')}`; }
function rfeCmpCard(c) {
  const mk = (g, cls) => { const s = g.st; return `<div class="rf-cm ${cls}"><b>${esc(g.label)}</b><span class="num">${s.nPair} com par · ${s.n} episódios</span><ul><li>Antes<b class="num">${f0(s.preMean)}</b></li><li>Depois<b class="num">${f0(s.pairPostMean)}</b></li><li>Variação<b class="num">${rfeSg(s.deltaMean)}</b></li><li>Intervalo típico<b class="num">${s.gapMed != null ? f0(s.gapMed) + ' min' : '—'}</b></li><li>Carboidratos<b class="num">${s.carbMean != null ? f0(s.carbMean) + ' g' : '—'}</b></li><li>Baixos / elevados<b class="num">${s.lowN} / ${s.highN}</b></li></ul></div>`; };
  const d = c.diff, mx = Math.max(Math.abs(c.A.st.deltaMean || 0), Math.abs(c.B.st.deltaMean || 0), 1);
  return `<article class="rf-card rf-c-cmp"><div class="rf-cmg">${mk(c.A, 'a')}${mk(c.B, 'b')}</div>${[c.A, c.B].map(g => `<div class="rf-cb"><span>${esc(g.label.length > 26 ? g.label.slice(0, 25) + '…' : g.label)}</span><span class="an-bnt" aria-hidden="true">${g.st.deltaMean != null ? `<i class="${g.st.deltaMean >= 0 ? 'pos' : 'neg'}" style="${g.st.deltaMean >= 0 ? 'left:50%' : 'right:50%'};width:${(Math.abs(g.st.deltaMean) / mx * 50).toFixed(1)}%"></i>` : ''}</span><b class="num">${rfeSg(g.st.deltaMean)}</b></div>`).join('')}
    <p class="an-card-t">Diferença de variação média (A − B): <b class="num">${rfeSg(d.delta)} mg/dL</b>${d.pre != null ? ` · glicemia inicial ${rfeSg(d.pre)}` : ''}${d.carb != null ? ` · carboidratos ${rfeSg(d.carb)} g` : ''}</p>${c.notes.map(n => `<p class="an-warn">${esc(n)}</p>`).join('')}</article>`;
}
function rfeBodyComparar(M) {
  const st = rfeState(), A = M.groups.find(g => g.id === st.A), B = M.groups.find(g => g.id === st.B), rep = M.repeated;
  return `<div class="form-grid rf-pick"><div class="field"><label class="fl" for="rfe-A">Comparar (A)</label><select class="in" id="rfe-A" data-rfe="A">${rfeGroupOpts(M, st.A)}</select></div><div class="field"><label class="fl" for="rfe-B">com (B)</label><select class="in" id="rfe-B" data-rfe="B">${rfeGroupOpts(M, st.B)}</select></div></div>
    ${A && B && A.id !== B.id ? rfeCmpCard(rfCompare(A, B)) : anEmpty('Escolha dois grupos', 'Compare, por exemplo, dois cafés da manhã diferentes, almoço × jantar ou refeições com mais e menos carboidratos. Os avisos mostram quando a glicemia inicial, o intervalo ou a quantidade de registros são diferentes demais.')}
    <h3 class="an-sub">Refeições repetidas</h3>${rep.length ? `<div class="an-cards">${rep.slice(0, 12).map(r => `<article class="rf-card ${RFE_COL[r.meal]}"><h3>${esc(r.label)}<span class="rf-n num">${r.n}× · ${r.nPair} com par</span></h3>${r.st.hasMean ? `<p class="rf-dl num ${r.st.deltaMean > 0 ? 'up' : 'dn'}">${rfeSg(r.st.deltaMean)}<small> mg/dL média · de ${rfeSg(r.st.deltaMin)} a ${rfeSg(r.st.deltaMax)}</small></p>` : '<p class="an-card-t dim">Poucos pares para média.</p>'}<p class="an-card-t">${r.similar === 'semelhante' ? 'Resultados parecidos entre as repetições (diferença de até 40 mg/dL).' : r.similar === 'variavel' ? 'Resultados bem diferentes entre as repetições (mais de 80 mg/dL de diferença).' : r.similar ? 'Resultados com diferença intermediária entre as repetições.' : `Menos de ${RF_MIN_OCC} repetições com par: sem avaliação.`}</p><details class="an-rel"><summary>Ver episódios (${r.n})</summary>${rfeEpList(M.list.filter(e => r.ids.includes(e.id)), 'r' + r.id)}</details></article>`).join('')}</div>${anNote('“Repetida” = mesma combinação de alimentos reconhecida (ou mesma descrição escrita), no mesmo tipo de refeição, 2 ou mais vezes.')}` : anEmpty('Nenhuma refeição repetida identificada', 'É preciso reconhecer a mesma combinação de alimentos (ou a mesma descrição) em 2 ou mais refeições.')}`;
}
function rfeBodyPadroes(M) {
  const P = M.patterns;
  if (!P.length) return anEmpty('Nenhum padrão com amostra suficiente', `Um padrão precisa de pelo menos ${RF_MIN} episódios no grupo e ${RF_MIN_OCC} ocorrências do fato observado. Há ${M.stats.nPair} episódios com antes e depois neste filtro.`) + anNote('Sem padrão não quer dizer que não existe: pode faltar registro.');
  const tone = { high: 't-high', low: 't-low', good: 't-good', info: '' };
  return `<div class="an-cards">${P.map(p => `<article class="rf-card rf-p ${RFE_COL[p.meal] || ''} ${tone[p.tone] || ''}"><h3>${esc(p.title)}</h3><div class="an-cnt"><b class="num">${p.count}</b><span>${p.k === 'var' ? 'medições comparadas' : 'ocorrências em ' + p.universe + ' episódios'}</span><span class="an-bar" aria-hidden="true"><i style="width:${Math.min(100, Math.max(3, p.count / p.universe * 100)).toFixed(0)}%"></i></span></div><p class="an-card-t">${esc(p.text)}</p><details class="an-rel"><summary>${rfeN(p.ids.length, 'episódio que sustenta', 'episódios que sustentam')} esta observação</summary>${rfeEpList(M.list.filter(e => p.ids.includes(e.id)), 'p' + p.k + p.meal + p.title)}</details></article>`).join('')}</div>${anNote('Estas observações são <b>coincidências nos seus números</b>, não causas. <b>Não são recomendação</b> de dose, alimento ou mudança de tratamento: converse com sua equipe de saúde.')}`;
}
function rfeBodyQualidade(M) {
  const q = M.quality, row = (t, list, d, tone) => { const n = Array.isArray(list) ? list.length : list; return `<article class="rf-card rf-q ${n ? 't-warn' : 't-good'}"><h3>${t}<span class="rf-n num">${n}</span></h3><p class="an-card-t">${d}</p>${Array.isArray(list) && list.length ? `<details class="an-rel"><summary>Ver episódios (${list.length})</summary>${rfeEpList(list, 'q' + t)}</details>` : ''}</article>`; };
  if (!q.total) return anEmpty('Sem episódios para avaliar', 'Quando houver refeições e medições ligadas, os problemas dos dados aparecem aqui.');
  return `<div class="an-cards">${row('Refeição sem horário', q.semHorario, 'Não dá para ligar medições sem saber a hora.')}${row('Sem quantidade de carboidratos', q.semCarb, 'Entram na análise, mas não nas relações com carboidratos.')}${row('Sem glicemia antes', q.semPre, 'Sem variação calculada.')}${row('Sem glicemia depois', q.semPos, 'Sem variação calculada.')}${row('Intervalo muito curto ou longo', q.intervalo, `Menos de ${RF_GAP_SHORT} ou mais de ${RF_GAP_LONG} minutos entre antes e depois.`)}${row('Associação pouco confiável', q.fraca, 'Só classificadas como pré/pós, com horário aproximado ou sem horário.')}${row('Alimentos não reconhecidos', q.semAlim, 'O total da refeição não bate com o registro do dia nem com o modelo do Bolus: nenhum alimento foi presumido.')}${row('Mais de uma glicemia antes', q.variasPre, 'Foi usada a mais próxima da refeição.')}${row('Registros duplicados', q.dupRecs + q.dupMeals, `${q.dupRecs} medições e ${q.dupMeals} refeições idênticas contadas uma vez.`)}${row('Medições com refeição, sem contexto', q.semContexto, 'Sem “antes/depois” não são ligadas a nenhuma refeição.')}${row('Medições com refeição, sem horário', q.recSemHora, 'Não são ligadas.')}</div>${anNote('Nenhuma lacuna é preenchida com estimativa. Corrija os registros no Histórico ou no Bolus para melhorar a análise.')}`;
}
function anBodyRfe(M0) {
  const M = rfeModel(), st = rfeState(), body = { resumo: rfeBodyResumo, comparar: rfeBodyComparar, padroes: rfeBodyPadroes, qualidade: rfeBodyQualidade }[st.tab];
  return `<p class="an-note" style="margin-top:0">Como a glicemia se comporta em torno das refeições que você registrou. Não calcula nem sugere dose.</p>${rfeFilters(M)}
    <div class="seg an-seg rf-tabs" role="group" aria-label="Visões de refeições">${RFE_TABS.map(([k, l]) => `<button type="button" data-act="rfe-tab" data-v="${k}" aria-pressed="${st.tab === k}">${l}${k === 'padroes' && M.patterns.length ? `<small class="num">${M.patterns.length}</small>` : ''}</button>`).join('')}</div><div id="rfe-body">${body(M)}</div>`;
}
const rfeSum = M0 => { const M = rfeModel(); return M.list.length ? `<span class="an-sc-i"><b class="num">${M.stats.n}</b> episódio${M.stats.n > 1 ? 's' : ''}</span><span class="an-sc-i"><b class="num">${M.stats.nPair}</b> com antes e depois</span>` : '<span class="an-sc-i dim">Sem refeições ligadas a medições</span>'; };
function rfeRefresh() {
  rfeSave(); const sec = document.getElementById('an-rfe'), s = AN_SECS.find(x => x.id === 'rfe'); if (!sec || !s) return;
  const f = document.activeElement, fa = f && f.id ? '#' + f.id : (f && f.dataset && f.dataset.act ? `[data-act="${f.dataset.act}"]${f.dataset.v != null ? `[data-v="${f.dataset.v}"]` : ''}` : ''), b = sec.querySelector('.an-b'), pos = f && f.selectionStart != null ? f.selectionStart : null, sy = window.scrollY;
  sec.querySelector('.an-h-s').innerHTML = s.sum(null); b.innerHTML = s.body(null); try { attachCharts(b); } catch (e) { }
  if (fa) { try { const n = b.querySelector(fa); if (n) { n.focus({ preventScroll: true }); if (pos != null && n.setSelectionRange) n.setSelectionRange(pos, pos); } } catch (e) { } } window.scrollTo(0, sy);
}
/* ---------- detalhe do episódio (abre a refeição original) ---------- */
function rfeDetail(e) {
  const k = rfeKind(e.kind), M = rfeModel(), rec = (r, l) => r ? `<button type="button" class="rec g-${bandOf(r.glucose, r.context).k}" data-act="open" data-id="${r.id}"><span class="tm num"><b>${r.time}</b></span><span class="info"><span class="badge">${l}</span><span class="chips"><span class="tag">${fmtDate(r.date).slice(0, 5)}</span></span></span><span class="gl num">${fn(r.glucose, 1)}<small>mg/dL</small></span></button>` : `<p class="hint" style="margin:0">${l}: sem medição ligada.</p>`;
  const bl = S.bl, m = e.logId ? (bl.meals || []).find(x => x.id === e.logId) : null;
  const nut = m ? `<ul class="rf-fa"><li><span>Carboidratos totais</span><b class="num">${fn(m.carb, 1)} g</b></li><li><span>Fibras</span><b class="num">${fn(m.fiber, 1)} g</b></li><li><span>Carboidratos líquidos</span><b class="num">${fn(m.net, 1)} g</b></li><li><span>Calorias</span><b class="num">${f0(m.kcal)} kcal</b></li><li><span>Proteínas / gorduras</span><b class="num">${fn(m.prot, 0)} / ${fn(m.fat, 0)} g</b></li>${m.ui != null ? `<li><span>Insulina registrada com a refeição</span><b class="num">${m.ui} Ui</b></li>` : ''}</ul>` : (e.carbs ? `<ul class="rf-fa"><li><span>Carboidratos informados no registro</span><b class="num">${fn(e.carbs.v, 1)} g</b></li>${e.ui != null ? `<li><span>Insulina rápida registrada</span><b class="num">${e.ui} Ui</b></li>` : ''}</ul>` : '<p class="hint" style="margin:0">Sem carboidratos registrados nesta refeição.</p>');
  const foods = e.foods ? `<h3 class="an-sub">Alimentos <small>(${e.foodsSrc === 'dia' ? 'registro do dia no Bolus' : 'modelo atual do Bolus, o total confere com o registrado'})</small></h3><ul class="rf-fa">${e.foods.map(f => `<li><span>${esc(f.name)}</span><b class="num">${fn(f.q, 1)} ${esc(f.unit)}<small> ${fn(f.carb, 1)} g carb.</small></b></li>`).join('')}</ul>` : (e.desc ? `<h3 class="an-sub">Descrição</h3><p class="hint" style="margin:0">${esc(e.desc)}</p>` : (e.kind === 'log' ? '<p class="hint" style="margin:8px 0 0">Os alimentos não foram guardados nesta refeição e não dá para reconhecê-los com segurança.</p>' : ''));
  return `<h2>${esc(rfMealName(e.meal))} · ${fmtDate(e.date).slice(0, 5)} ${e.time || ''}</h2><p class="hint" style="margin:0 0 10px"><span class="rf-kind ${k[1]}">${k[0]}</span>${e.timeApprox ? ' · horário aproximado pela medição' : ''}${e.gap != null ? ` · ${e.gap} min entre antes e depois` : ''}${e.delta != null ? ` · variação ${rfeSg(e.delta)} mg/dL` : ''}</p>
    <div class="stack" style="gap:8px">${rec(e.pre, 'Antes')}${rec(e.post, 'Depois')}</div>${e.posts.length > 1 ? `<p class="hint">Houve ${e.posts.length} medições depois; a primeira foi usada.</p>` : ''}
    <h3 class="an-sub">Informações nutricionais registradas</h3>${nut}${foods}
    <div class="stack" style="margin-top:12px">${e.logId ? `<button class="btn full" data-act="rfe-bolus" data-meal="${e.meal}" data-date="${e.date}">Abrir no Bolus</button><button class="btn full" data-act="mlog-edit" data-id="${e.logId}">Ver / editar a refeição feita</button>` : ''}<button class="btn full" data-act="close">Fechar</button></div><p class="hint" style="margin:8px 0 0">Só leitura: nada aqui muda o cálculo do bolus.</p>`;
}
document.addEventListener('click', ev => {
  const el = ev.target.closest && ev.target.closest('[data-act^="rfe-"]'); if (!el) return; const a = el.dataset.act, st = rfeState();
  if (a === 'rfe-tab') { st.tab = el.dataset.v; rfeRefresh(); }
  else if (a === 'rfe-rep') { st.f.rep = !st.f.rep; rfeRefresh(); }
  else if (a === 'rfe-clear') { st.f = rfFilterDefaults(); rfeRefresh(); }
  else if (a === 'rfe-more') { const k = el.dataset.k, w = el.closest('.rf-wrap'); rfeShown[k] = (rfeShown[k] || 8) + 12; if (w) w.innerHTML = rfeListInner(k); }
  else if (a === 'rfe-ep') { const e = rfeModel().all.find(x => x.id === el.dataset.id); if (e) openSheet(rfeDetail(e)); }
  else if (a === 'rfe-bolus') { closeSheet(); S.blUi.tab = el.dataset.meal; S.blUi.date = el.dataset.date === blToday() ? null : el.dataset.date; S.blUi.pend = null; go('bolus'); }
});
document.addEventListener('change', ev => {
  const el = ev.target; if (!el || !el.dataset || el.dataset.rfe == null) return; const st = rfeState(), k = el.dataset.rfe;
  if (k === 'A' || k === 'B') st[k] = el.value; else { const n = Object.assign({}, st.f, { [k]: el.value }); st.f = rfFilterClean(n); if (n[k] !== '' && st.f[k] === '' && (k === 'cmin' || k === 'cmax')) el.value = ''; }
  rfeRefresh();
});
document.addEventListener('toggle', ev => { if (ev.target && ev.target.id === 'rfe-flt') { rfeState().fo = ev.target.open; rfeSave(); } }, true);
