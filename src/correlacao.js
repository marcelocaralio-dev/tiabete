/* ===== Correlação e associação entre variáveis: interface (corpo da seção "Associações entre variáveis" da Análise) =====
   Cálculos em correlacao-core.js. Aqui só se desenha: destaques automáticos, exploração de duas variáveis, matriz, distribuições, gráfico temporal e qualidade. */
const CR_ST = { unit: 'refeicao', x: '', y: '', open: new Set(), shown: {}, cat: '', mxUnit: '', det: {} };
let crMemo = { key: '', model: null };
function crData(M) {
  const R = M.cur || [], bl = S.bl || { meals: [] };
  const key = JSON.stringify([R.map(r => [r.id, r.ts, r.time, r.noTime, r.glucose, r.context, r.meal, r.marks, r.carbs, r.insMeal, r.insCorr, r.insBasal, r.actMin, r.actDesc, r.actInt, r.mealDesc, r.insFrom]), bl.meals, (S.inslog || []).map(e => [e.id, e.kind, e.ts, e.units]), (S.events || []).map(e => [e.date, e.text]), (S.hba || []).map(h => [h.id, h.date, h.value]), LIM.low, LIM.high]);
  if (crMemo.key !== key) crMemo = { key, model: crModel(R, { bl, calc: typeof blCalc === 'function' ? blCalc : undefined, inslog: S.inslog || [], events: S.events || [], hba: S.hba || [] }) };
  return crMemo.model;
}
/* temas que outras áreas da Análise já apresentam (evita repetir a mesma descoberta) */
function crCovered(M) {
  const c = new Set(), d = M.disc ? M.disc().list : []; d.forEach(x => { if (x.id === 'var-horario') c.add('variab-periodo'); });
  try { rcData(M).list.forEach(p => { if (/_ativ$/.test(p.id) || /e_ativ/.test(p.id)) c.add('atividade-dia'); }); } catch (e) { }
  return c;
}
const crPct = v => v == null ? '—' : fn(v * 100, 0) + '%';
const crP = p => p == null ? '—' : p < 0.001 ? '< 0,001' : fn(p, 3);
const crCI = (c, d) => c ? `${fn(c[0], d == null ? 2 : d)} a ${fn(c[1], d == null ? 2 : d)}` : '—';
function crStrengthBar(res) {
  const lv = CR_STRENGTH_LV[res.strength] || 0;
  return `<span class="cr-str" role="img" aria-label="Intensidade ${CR_STRENGTH_TXT[res.strength]}">${[1, 2, 3].map(i => `<i class="${lv >= i ? 'on' : ''}"></i>`).join('')}<b>${CR_STRENGTH_TXT[res.strength]}</b></span>`;
}
const crDir = res => res.kind === 'corr' ? (res.inconclusive ? 'sem direção definida' : res.dir > 0 ? 'positiva' : 'negativa') : res.inconclusive ? 'sem diferença definida' : 'diferença observada';
function crScatter(res) {
  const W = 320, H = 190, L = 40, B = 28, T = 10, Rr = 10, P = res.points, xs = P.map(p => p.x), ys = P.map(p => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const X = v => L + (x1 === x0 ? .5 : (v - x0) / (x1 - x0)) * (W - L - Rr), Y = v => H - B - (y1 === y0 ? .5 : (v - y0) / (y1 - y0)) * (H - B - T);
  let line = ''; if (res.trend && x1 > x0) { const ya = res.trend.icpt + res.trend.slope * x0, yb = res.trend.icpt + res.trend.slope * x1, cl = v => Math.max(y0, Math.min(y1, v)); line = `<line class="cr-trend" x1="${X(x0).toFixed(1)}" y1="${Y(cl(ya)).toFixed(1)}" x2="${X(x1).toFixed(1)}" y2="${Y(cl(yb)).toFixed(1)}"/>`; }
  const fx = v => crFV(res.x, v), fy = v => crFV(res.y, v);
  return `<svg class="cr-sc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dispersão: ${esc(res.xl)} e ${esc(res.yl)}, ${P.length} observações. Cada ponto é uma observação e abre o registro."><line class="an-ax" x1="${L}" y1="${H - B}" x2="${W - Rr}" y2="${H - B}"/><line class="an-ax" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/>${line}${P.map(p => `<circle class="${p.out ? 'out' : ''}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.6" data-act="open" data-id="${esc(p.rec[0] || '')}" tabindex="0"><title>${fmtDate(p.date)} · ${esc(fx(p.x))} · ${esc(fy(p.y))}</title></circle>`).join('')}<text class="an-at" x="${L}" y="${H - 12}">${esc(fx(x0))}</text><text class="an-at" x="${W - Rr}" y="${H - 12}" text-anchor="end">${esc(fx(x1))}</text><text class="an-at" x="${L - 4}" y="${H - B}" text-anchor="end">${esc(fy(y0))}</text><text class="an-at" x="${L - 4}" y="${T + 8}" text-anchor="end">${esc(fy(y1))}</text><text class="an-at" x="${(L + W - Rr) / 2}" y="${H - 1}" text-anchor="middle">${esc(res.xl)}</text></svg><p class="an-sc-y">Eixo vertical: ${esc(res.yl)}${crUnitTxt(res.y) ? ' (' + esc(crUnitTxt(res.y).trim()) + ')' : ''}. ${res.trend ? `Linha: tendência por ${res.trend.kind}.` : ''} Pontos vazados são valores extremos. Toque num ponto para abrir o registro.</p>`;
}
function crStrip(res) {
  const W = 320, G = res.groups, rowH = 44, H = G.length * rowH + 26, L = 8, Rr = 10, vals = G.flatMap(g => g.points.map(p => p.y)), v0 = Math.min(...vals), v1 = Math.max(...vals), X = v => L + (v1 === v0 ? .5 : (v - v0) / (v1 - v0)) * (W - L - Rr), fv = v => crFV(res.v, v);
  const jit = i => ((i * 37) % 17) / 17 * 14 - 7;
  return `<svg class="cr-sc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Comparação de ${esc(res.vl)} entre grupos. Cada ponto é uma observação.">${G.map((g, k) => { const cy = k * rowH + 22; return `<text class="an-at" x="${L}" y="${cy - 16}">${esc(g.label)} · n=${g.n}</text><rect class="cr-box" x="${X(g.q1).toFixed(1)}" y="${cy - 9}" width="${Math.max(2, X(g.q3) - X(g.q1)).toFixed(1)}" height="18" rx="4"/><line class="cr-med" x1="${X(g.median).toFixed(1)}" y1="${cy - 12}" x2="${X(g.median).toFixed(1)}" y2="${cy + 12}"/>${g.points.map((p, i) => `<circle class="${p.out ? 'out' : ''}" cx="${X(p.y).toFixed(1)}" cy="${(cy + jit(i)).toFixed(1)}" r="2.8" data-act="open" data-id="${esc(p.rec[0] || '')}" tabindex="0"><title>${fmtDate(p.date)} · ${esc(fv(p.y))}</title></circle>`).join('')}`; }).join('')}<text class="an-at" x="${L}" y="${H - 4}">${esc(fv(v0))}</text><text class="an-at" x="${W - Rr}" y="${H - 4}" text-anchor="end">${esc(fv(v1))}</text></svg><p class="an-sc-y">Caixa: metade central dos valores (de 25% a 75%); traço: mediana; pontos: cada observação (toque para abrir o registro).</p>`;
}
function crHistSvg(h, id, label) {
  if (!h) return `<div class="cr-h"><b>${esc(label)}</b><span class="dim">poucos valores para um gráfico</span></div>`;
  const W = 150, H = 54, mx = Math.max(...h.bins.map(b => b.n)), bw = W / h.bins.length;
  return `<div class="cr-h"><b>${esc(label)}</b><svg viewBox="0 0 ${W} ${H + 12}" role="img" aria-label="Distribuição de ${esc(label)}">${h.bins.map((b, i) => `<rect x="${(i * bw + 1).toFixed(1)}" y="${(H - b.n / mx * H).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${(b.n / mx * H).toFixed(1)}" rx="2"><title>${esc(crFV(id, b.a))} a ${esc(crFV(id, b.b))}: ${b.n}</title></rect>`).join('')}<text class="an-at" x="0" y="${H + 10}">${esc(crFV(id, h.min))}</text><text class="an-at" x="${W}" y="${H + 10}" text-anchor="end">${esc(crFV(id, h.max))}</text></svg></div>`;
}
function crTimeline(res) {
  const P = res.kind === 'corr' ? res.points.map(p => ({ t: p.ts, y: p.y, rec: p.rec, d: p.date })) : res.points.map(p => ({ t: new Date(p.date + 'T12:00:00').getTime(), y: p.y, rec: p.rec, d: p.date }));
  if (P.length < 5) return ''; const id = res.kind === 'corr' ? res.y : res.v, W = 320, H = 110, L = 38, B = 18, T = 6, Rr = 8, t0 = Math.min(...P.map(p => p.t)), t1 = Math.max(...P.map(p => p.t)), ys = P.map(p => p.y), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const X = v => L + (t1 === t0 ? .5 : (v - t0) / (t1 - t0)) * (W - L - Rr), Y = v => H - B - (y1 === y0 ? .5 : (v - y0) / (y1 - y0)) * (H - B - T);
  return `<h4 class="cr-sub">Ao longo do tempo</h4><svg class="cr-sc" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(res.kind === 'corr' ? res.yl : res.vl)} ao longo do período, uma marca por observação."><line class="an-ax" x1="${L}" y1="${H - B}" x2="${W - Rr}" y2="${H - B}"/><line class="an-ax" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/>${P.map(p => `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.8" data-act="open" data-id="${esc(p.rec[0] || '')}" tabindex="0"><title>${fmtDate(p.d)} · ${esc(crFV(id, p.y))}</title></circle>`).join('')}<text class="an-at" x="${L}" y="${H - 4}">${fmDMY(t0)}</text><text class="an-at" x="${W - Rr}" y="${H - 4}" text-anchor="end">${fmDMY(t1)}</text><text class="an-at" x="${L - 4}" y="${H - B}" text-anchor="end">${esc(crFV(id, y0))}</text><text class="an-at" x="${L - 4}" y="${T + 8}" text-anchor="end">${esc(crFV(id, y1))}</text></svg><p class="an-sc-y">Mostra se as observações se espalham pelo período ou se concentram numa fase.</p>`;
}
function crObsList(res) {
  const key = res.id, show = CR_ST.shown[key] || 10;
  const rows = res.kind === 'corr' ? res.points.map(p => ({ d: p.date, a: crFV(res.x, p.x) + crUnitTxt(res.x), b: crFV(res.y, p.y) + crUnitTxt(res.y), rec: p.rec, out: p.out, t: p.ts })) : res.points.map(p => ({ d: p.date, a: crLevel(res.g, p.g), b: crFV(res.v, p.y) + crUnitTxt(res.v), rec: p.rec, out: false, t: 0 }));
  rows.sort((a, b) => b.d.localeCompare(a.d));
  return `<details class="an-rel"><summary>Registros usados no cálculo (${rows.length})</summary><div class="tbl-wrap"><table class="t"><thead><tr><th>Data</th><th>${esc(res.kind === 'corr' ? res.xl : res.gl)}</th><th>${esc(res.kind === 'corr' ? res.yl : res.vl)}</th><th></th></tr></thead><tbody>${rows.slice(0, show).map(r => `<tr><td>${fmtDate(r.d).slice(0, 5)}</td><td>${esc(r.a)}</td><td>${esc(r.b)}${r.out ? ' <span class="dim">extremo</span>' : ''}</td><td>${r.rec.map((id, i) => `<button type="button" class="an-lk" data-act="open" data-id="${esc(id)}">${i ? 'depois' : res.unit === 'dia' ? 'dia' : 'antes'}</button>`).join(' ')}</td></tr>`).join('')}</tbody></table></div>${rows.length > show ? `<button type="button" class="btn sm" data-act="cr-more" data-k="${esc(key)}">Mostrar mais (${rows.length - show})</button>` : ''}${res.unit === 'exame' ? '' : `<button type="button" class="btn sm an-hbtn" data-act="cr-hist" data-k="${esc(key)}">Ver no histórico</button>`}</details>`;
}
function crLinks(res) {
  const l = []; if (res.unit === 'refeicao' || /^ref:/.test(res.unit) || res.unit === 'insulina') l.push(['rfe', 'Refeições e glicemia']); if (/^med:|^ref:|periodo|hora/.test(res.unit + res.x)) l.push(['tmp', 'Horários e períodos']);
  l.push(['pad', 'Padrões recorrentes'], ['comp', 'Comparar períodos'], ['desc', 'Central de descobertas']); return `<div class="cr-links">${l.map(([k, t]) => `<button type="button" class="btn sm" data-act="an-go" data-k="${k}">${t}</button>`).join('')}</div>`;
}
function crDetail(res) {
  const flags = res.flags.filter(f => f.k !== 'extremos-ok' || true), lim = res.limits;
  const stat = res.kind === 'corr'
    ? `<ul class="cr-kv"><li><span>Método</span><b>${res.method === 'spearman' ? 'Spearman' : 'Pearson'}</b></li><li><span>Coeficiente</span><b class="num">${fn(res.coef, 2)}</b></li><li><span>IC de 95%</span><b class="num">${crCI(res.ci)}</b></li><li><span>p (exploratório)</span><b class="num">${crP(res.p)}</b></li>${res.q != null ? `<li><span>q (corrigido)</span><b class="num">${crP(res.q)}</b></li>` : ''}<li><span>Pearson / Spearman</span><b class="num">${fn(res.rp, 2)} / ${fn(res.rs, 2)}</b></li><li><span>Sem um registro por vez</span><b class="num">${fn(res.loo[0], 2)} a ${fn(res.loo[1], 2)}</b></li>${res.noOut ? `<li><span>Sem valores extremos (n=${res.noOut.n})</span><b class="num">${fn(res.noOut.coef, 2)}</b></li>` : ''}${res.adj ? `<li><span>Ajustado pela glicemia anterior (n=${res.adj.n})</span><b class="num">${fn(res.adj.coef, 2)} (${crCI(res.adj.ci)})</b></li>` : ''}</ul>`
    : `<ul class="cr-kv"><li><span>Método</span><b>${{ welch: 'Welch', mannwhitney: 'Mann–Whitney', kruskal: 'Kruskal–Wallis' }[res.method]}</b></li><li><span>p (exploratório)</span><b class="num">${crP(res.p)}</b></li>${res.q != null ? `<li><span>q (corrigido)</span><b class="num">${crP(res.q)}</b></li>` : ''}${res.method === 'kruskal' ? `<li><span>ε²</span><b class="num">${fn(res.effect.eps2, 2)}</b></li>` : `<li><span>${esc(res.effect.ciKind)}</span><b class="num">${fsign(res.coef, 0)}${crUnitTxt(res.v)} (${crCI(res.effect.ci, 0)})</b></li><li><span>r de postos</span><b class="num">${fn(res.effect.rb, 2)}</b></li>${res.effect.d != null ? `<li><span>d de Cohen (Hedges)</span><b class="num">${fn(res.effect.d, 2)}</b></li>` : ''}<li><span>Verificação (Welch / Mann–Whitney)</span><b class="num">p ${crP(res.check.welchP)} / ${crP(res.check.mwP)}</b></li>`}</ul>`;
  const grp = res.kind === 'group' ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Grupo</th><th>n</th><th>Mediana</th><th>25–75%</th><th>Média ± DP</th><th>Mín–máx</th></tr></thead><tbody>${res.groups.map(g => `<tr><td>${esc(g.label)}</td><td>${g.n}</td><td>${crFV(res.v, g.median)}</td><td>${crFV(res.v, g.q1)}–${crFV(res.v, g.q3)}</td><td>${crFV(res.v, g.mean)} ± ${crFV(res.v, g.sd)}</td><td>${crFV(res.v, g.min)}–${crFV(res.v, g.max)}</td></tr>`).join('')}</tbody></table></div>` : '';
  const dx = res.kind === 'corr' ? `<div class="cr-hs">${crHistSvg(res.dist.x, res.x, res.xl)}${crHistSvg(res.dist.y, res.y, res.yl)}</div><p class="an-note">Dispersão: ${esc(res.xl)} — mediana ${crFV(res.x, res.dx.median)}, DP ${crFV(res.x, res.dx.sd)}, de ${crFV(res.x, res.dx.min)} a ${crFV(res.x, res.dx.max)}; ${esc(res.yl)} — mediana ${crFV(res.y, res.dy.median)}, DP ${crFV(res.y, res.dy.sd)}, de ${crFV(res.y, res.dy.min)} a ${crFV(res.y, res.dy.max)}.</p>` : `<div class="cr-hs">${crHistSvg(res.dist.y, res.v, res.vl)}</div>`;
  const st = res.strata ? `<p class="an-note"><b>Dentro de cada grupo:</b> ${res.strata.map(s => `${esc(s.label)} ${fn(s.coef, 2)} (n=${s.n})`).join(' · ')}.</p>` : '';
  return `<div class="cr-det"><p><b>Como ler:</b> ${esc(res.meaning)}</p><p><b>Por que este método:</b> ${esc(res.methodWhy)}</p>${stat}${grp}${st}${dx}${crTimeline(res)}${crObsList(res)}${crLinks(res)}${res.dropped && res.dropped.length ? '' : ''}</div>`;
}
function crFlags(res) {
  const f = res.flags.filter(x => x.k !== 'extremos-ok').map(x => `<li>${esc(x.t)}</li>`).concat(res.limits.map(t => `<li>${esc(t)}</li>`));
  return `<p class="an-limit"><b>Limitações:</b></p><ul class="cr-lim">${f.join('')}${res.noDose ? `<li>${CR_NODOSE}</li>` : ''}</ul>`;
}
function crCard(res, tag) {
  const open = CR_ST.open.has(res.id + (tag || '')), kid = esc(res.id + (tag || '')), nm = res.kind === 'corr' ? `${res.xl} × ${res.yl}` : `${res.vl} por ${res.gl.toLowerCase()}`;
  if (!res.ok) return `<article class="an-card cr-card cr-c-${res.cat} t-info"><span class="cr-cat">${CR_CAT[res.cat] || ''}</span><h3>${esc(nm)}</h3><p class="an-meta"><span>${res.n || 0} pares usados</span></p><div class="cr-warn" role="status"><b>Análise não apropriada com estes dados.</b><span>${esc(res.why)}</span></div></article>`;
  const vis = res.kind === 'corr' ? crScatter(res) : crStrip(res);
  return `<article class="an-card cr-card cr-c-${res.cat} t-info${res.tier === 'destaque' ? ' hl' : ''}"><span class="cr-cat">${CR_CAT[res.cat]}${res.tier === 'destaque' ? ' · destaque' : res.tier === 'explor' ? ' · exploratório' : ''}</span><h3>${esc(nm)}</h3>
  <p class="an-meta"><span>${res.n} pares usados</span><span>${res.days} dias</span><span>${res.method === 'spearman' ? 'Spearman' : res.method === 'pearson' ? 'Pearson' : res.method === 'welch' ? 'Welch' : res.method === 'mannwhitney' ? 'Mann–Whitney' : 'Kruskal–Wallis'}</span>${res.kind === 'corr' ? `<span>${res.method === 'spearman' ? 'ρ' : 'r'} = ${fn(res.coef, 2)}</span>` : ''}</p>
  <div class="cr-ind">${crStrengthBar(res)}<span class="cr-dir">${crDir(res)}</span>${res.unstable ? '<span class="cr-pill warn">instável</span>' : ''}${res.coupled ? '<span class="cr-pill warn">parcialmente automática</span>' : ''}${res.q != null && res.tier !== 'none' ? `<span class="cr-pill">q = ${crP(res.q)}</span>` : ''}</div>
  <p class="an-card-t">${esc(crText(res))}</p>${vis}${crFlags(res)}
  <button type="button" class="btn" data-act="cr-open" data-k="${kid}" aria-expanded="${open}">${open ? 'Ocultar detalhes' : 'Ver detalhes, distribuição e registros'}</button>${open ? crDetail(res) : ''}</article>`;
}
/* ---- exploração personalizada ---- */
function crExplorer(model) {
  const units = crUnitList(model), ok = units.filter(u => u.ok);
  if (!ok.length) return `<div class="an-empty"><b>Sem tipo de observação com dados suficientes</b><span>São necessárias ao menos ${CR_MIN_N} observações em ${CR_MIN_DAYS} dias diferentes.</span></div>`;
  if (!ok.some(u => u.k === CR_ST.unit)) { CR_ST.unit = ok[0].k; CR_ST.x = ''; CR_ST.y = ''; }
  const u = model.units[CR_ST.unit], vars = u.vars.filter(v => crCombos(model, u.k, v).some(c => c.ok));
  if (!vars.includes(CR_ST.x)) { CR_ST.x = vars[0] || ''; CR_ST.y = ''; }
  const cb = CR_ST.x ? crCombos(model, u.k, CR_ST.x) : []; if (!cb.some(c => c.id === CR_ST.y && c.ok)) CR_ST.y = (cb.find(c => c.ok) || {}).id || '';
  const sel = (k, l, items, cur) => `<div class="field"><label class="fl" for="cr-${k}">${l}</label><select class="in" id="cr-${k}" data-cr="${k}">${items}</select></div>`;
  const res = CR_ST.x && CR_ST.y ? crAnalyze(model, u.k, CR_ST.x, CR_ST.y) : null;
  return `<div class="cr-ex"><p class="an-note">Escolha o tipo de observação (ele define como os registros são ligados no tempo) e duas informações. Só aparecem combinações tecnicamente válidas.</p>
  ${sel('unit', 'Tipo de observação', units.map(x => `<option value="${esc(x.k)}" ${x.k === CR_ST.unit ? 'selected' : ''} ${x.ok ? '' : 'disabled'}>${esc(x.l)} · ${x.n} obs.${x.ok ? '' : ' (poucos dados)'}</option>`).join(''))}
  <div class="form-grid">${sel('x', 'Informação 1', vars.map(v => `<option value="${v}" ${v === CR_ST.x ? 'selected' : ''}>${esc(crVL(u, v))}</option>`).join(''))}
  ${sel('y', 'Informação 2', cb.map(c => `<option value="${c.id}" ${c.id === CR_ST.y ? 'selected' : ''} ${c.ok ? '' : 'disabled'}>${esc(c.label)} · ${c.n} obs.${c.coupled ? ' (parcialmente automática)' : ''}</option>`).join(''))}</div>
  <p class="an-note">${esc(u.d)}${u.dup ? ` ${u.dup} observação(ões) repetida(s) foi(ram) descartada(s).` : ''}</p>
  <div id="cr-res">${res ? crCard(res, ':ex') : ''}</div></div>`;
}
/* ---- matriz ---- */
function crMatrixHTML(model) {
  const us = crUnitList(model).filter(u => u.ok && crMatrix(model, u.k)), cur = us.find(u => u.k === CR_ST.mxUnit) || us[0]; if (!cur) return '';
  CR_ST.mxUnit = cur.k; const m = crMatrix(model, cur.k), tone = r => { const a = Math.min(1, Math.abs(r)); return `background:rgba(${r >= 0 ? '54,201,120' : '255,122,138'},${(a * .75).toFixed(2)})`; };
  if (m.vars.length < 2) return '';
  return `<div class="field"><label class="fl" for="cr-mx">Matriz de</label><select class="in" id="cr-mx" data-cr="mx">${us.map(u => `<option value="${esc(u.k)}" ${u.k === cur.k ? 'selected' : ''}>${esc(u.l)}</option>`).join('')}</select></div>
  <div class="tbl-wrap"><table class="t cr-mx" aria-label="Matriz de correlação"><thead><tr><th></th>${m.vars.map((v, i) => `<th scope="col" title="${esc(v.label)}">${i + 1}</th>`).join('')}</tr></thead><tbody>${m.cells.map((row, i) => `<tr><th scope="row" title="${esc(m.vars[i].label)}">${i + 1}. ${esc(m.vars[i].label)}</th>${row.map(c => c.self ? '<td class="self">—</td>' : c.r != null ? `<td style="${tone(c.r)}" title="n=${c.n}; q=${crP(c.q)}">${fn(c.r, 2)}${c.coupled ? '*' : ''}${c.q != null && c.q <= CR_Q_HIGH ? '<sup>●</sup>' : ''}</td>` : `<td class="na" title="${esc(c.why || '')}">${c.na === 'calc' ? '=' : '·'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  <p class="an-note">Spearman entre pares de informações da mesma observação. Verde: positiva; vermelho: negativa. “=”: uma é calculada a partir da outra. “·”: poucos dados. “*”: parcialmente automática. ● : sobrevive à correção para ${m.tested} comparações (q ≤ ${fn(CR_Q_HIGH, 2)}). Posições, não valores exatos; não indica causa.</p>`;
}
function crRepeatsHTML(model) {
  const r = model.repeats; if (!r) return '';
  if (!r.ok) return `<p class="an-note"><b>Refeições repetidas:</b> ${esc(r.why)}</p>`;
  return `<div class="an-card cr-card cr-c-ali t-info"><span class="cr-cat">${CR_CAT.ali}</span><h3>Refeições repetidas: a variação se repete?</h3><p class="an-meta"><span>${r.N} pares usados</span><span>${r.k} refeições repetidas</span></p>
  <p class="an-card-t">Entre as repetições da mesma refeição registrada, a variação da glicemia teve desvio-padrão de ${fn(r.sdWithin, 0)} mg/dL; no conjunto, ${fn(r.sdTotal, 0)} mg/dL. Coeficiente de correlação intraclasse: ${fn(r.icc, 2)}.</p>
  <p class="an-note">Perto de 0: a mesma refeição variou quase tanto quanto refeições diferentes. Perto de 1: as repetições foram parecidas entre si. Descreve os seus registros; não identifica o motivo.</p>
  <details class="an-rel"><summary>Refeições comparadas</summary><div class="tbl-wrap"><table class="t"><thead><tr><th>Refeição</th><th>n</th><th>Variação média</th><th>DP</th></tr></thead><tbody>${r.groups.map(g => `<tr><td>${esc(g.label)}</td><td>${g.n}</td><td>${fsign(g.mean, 0)}</td><td>${fn(g.sd, 0)}</td></tr>`).join('')}</tbody></table></div></details>
  <button type="button" class="btn sm" data-act="an-go" data-k="rfe">Refeições e glicemia</button></div>`;
}
function crQualityHTML(model) {
  const q = model.quality, us = Object.values(model.units).filter(u => u.n || Object.keys(u.excl).length);
  return `<details class="an-ev cr-q"><summary>Qualidade dos dados e proteções estatísticas</summary><ul class="cr-lim"><li>${q.records} medições reais consideradas${q.dup ? `; ${q.dup} duplicada(s) ignorada(s)` : ''}${q.noTime ? `; ${q.noTime} sem horário (não entram em análises temporais)` : ''}${q.examples ? `; ${q.examples} de exemplo ignorada(s)` : ''}.</li>${us.map(u => `<li><b>${esc(u.l)}:</b> ${u.n} observações em ${u.days} dias${Object.keys(u.excl).length ? `; descartadas: ${Object.entries(u.excl).map(([k, v]) => `${v} (${esc(k)})`).join(', ')}` : ''}.</li>`).join('')}
  <li>Nada é presumido: ausência de registro de insulina, atividade ou carboidrato não vira “zero”.</li><li>Nenhuma correlação é calculada com menos de ${CR_MIN_N} observações, ${CR_MIN_DAYS} dias, ${CR_MIN_DISTINCT} valores diferentes ou grupos com menos de ${CR_MIN_GROUP}.</li><li>Pearson só com relação linear plausível, distribuição simétrica, sem extremos severos e 15 pares ou mais; senão Spearman.</li><li>Nas análises automáticas (${model.auto.tested} testadas) aplica-se a correção de Benjamini–Hochberg; com tantas comparações alguns resultados surgem por acaso, por isso seguem exploratórios.</li></ul></details>`;
}
function crBody(M) {
  const model = crData(M), A = model.auto;
  if (!model.units.refeicao.n && !Object.values(model.units).some(u => u.n >= CR_MIN_N)) return anEmpty('Dados insuficientes para associações', `Elas precisam de medições reais com horário e, conforme o caso, carboidratos, insulina, atividade ou marcações, ligadas a uma medição posterior (por exemplo, 1 a 5 horas depois). São necessárias ao menos ${CR_MIN_N} observações em ${CR_MIN_DAYS} dias por relação.`) + crQualityHTML(model);
  const dd = crDedupe(A.highlights, crCovered(M)), ex = crDedupe(A.exploratory, crCovered(M)), cats = Object.keys(CR_CAT).filter(k => dd.keep.concat(ex.keep).some(r => r.cat === k));
  const f = CR_ST.cat, hl = dd.keep.filter(r => !f || r.cat === f), xp = ex.keep.filter(r => !f || r.cat === f);
  const gl = k => `<button type="button" data-act="cr-cat" data-k="${k}" aria-pressed="${f === k}">${k ? CR_CAT[k] : 'Todas'}</button>`;
  return `<div id="cr-root"><p class="an-note"><b>Associação não é causa.</b> Estas análises descrevem como os seus registros andam juntos; não mostram que uma informação provocou a outra e não orientam dose, alimentação ou tratamento.</p>
  <h3 class="an-sub">Associações em destaque</h3>${cats.length ? `<div class="rc-hist cr-cats" role="group" aria-label="Categorias">${gl('')}${cats.map(gl).join('')}</div>` : ''}
  ${hl.length ? `<div class="an-cards">${hl.map(r => crCard(r)).join('')}</div>` : `<p class="an-note">Nenhuma associação se destacou depois da correção para ${A.tested} comparações${A.tested ? '' : ' (nenhuma análise com dados suficientes ainda)'}. Isso é comum com poucos registros e não significa que não haja relação.</p>`}
  ${xp.length ? `<details class="an-ev"><summary>Sinais exploratórios (${xp.length}) — não resistem à correção</summary><p class="an-note">Chamaram atenção sem a correção, mas podem ser acaso entre tantas comparações. Use só como ideia para continuar registrando.</p><div class="an-cards">${xp.slice(0, 6).map(r => crCard(r)).join('')}</div></details>` : ''}
  ${dd.dupes.length || ex.dupes.length ? `<p class="an-note">Também aparece em outras áreas da Análise: ${[...new Set(dd.dupes.concat(ex.dupes).map(r => crHeadline(r)))].map(esc).join('; ')}. <button type="button" class="btn sm" data-act="an-go" data-k="desc">Central de descobertas</button></p>` : ''}
  <h3 class="an-sub">Explorar duas informações</h3>${crExplorer(model)}
  <h3 class="an-sub">Matriz de correlação</h3>${crMatrixHTML(model) || '<p class="an-note">Poucas informações numéricas com dados suficientes.</p>'}
  <h3 class="an-sub">Refeições repetidas</h3>${crRepeatsHTML(model)}${crQualityHTML(model)}</div>`;
}
function crRefresh() { const el = document.getElementById('cr-root'); if (el) { el.outerHTML = crBody(anModel()); } }
function crFindRes(k) {
  const m = crData(anModel()), id = k.replace(/:ex$/, ''), a = m.auto.list.find(r => r.id === id); if (a && !/:ex$/.test(k)) return a;
  const [u, x, y] = id.split('|'); return crAnalyze(m, u, x, y);
}
document.addEventListener('click', e => {
  const el = e.target.closest && e.target.closest('[data-act^="cr-"]'); if (!el || S.route !== 'analise') return; const a = el.dataset.act, k = el.dataset.k;
  if (a === 'cr-open') { if (CR_ST.open.has(k)) CR_ST.open.delete(k); else CR_ST.open.add(k); crRefresh(); }
  else if (a === 'cr-more') { CR_ST.shown[k] = (CR_ST.shown[k] || 10) + 20; crRefresh(); }
  else if (a === 'cr-cat') { CR_ST.cat = k; crRefresh(); }
  else if (a === 'cr-hist') { const r = crFindRes(k); if (!r || !r.recIds) return; const M = anModel(); Object.assign(S.hist, { q: '', from: '', to: '', band: '', ctx: '', meal: '', mark: '', limit: 60 }); const ds = r.points.map(p => p.date).sort(); S.hist.from = ds[0]; S.hist.to = ds[ds.length - 1]; go('historico'); }
});
document.addEventListener('change', e => {
  const t = e.target; if (!t || !t.dataset || !t.dataset.cr || S.route !== 'analise') return; const k = t.dataset.cr;
  if (k === 'unit') { CR_ST.unit = t.value; CR_ST.x = ''; CR_ST.y = ''; } else if (k === 'x') { CR_ST.x = t.value; CR_ST.y = ''; } else if (k === 'y') CR_ST.y = t.value; else if (k === 'mx') CR_ST.mxUnit = t.value;
  crRefresh();
});
