/* ================= Análise: interface =================
   A tela é organizada em seções temáticas recolhíveis, com índice de navegação rápida. Os cálculos de antes (resumo, evolução, faixas,
   dia típico, mapa de calor, contextos, refeições, janelas fixas e comparação) continuam sendo os mesmos e agora vivem dentro das seções;
   os novos (horário/contexto, hipo/hiper, variabilidade, recorrência, associações, descobertas) vêm de analise-core.js.
   Só as seções abertas são desenhadas na hora; as demais são montadas quando a pessoa as abre (desempenho). */
const AN_LS = 'tb-ana-open', AN_DEF_OPEN = ['visao', 'desc'];
let anMemo = { key: '', M: null }, anOpenSet = null;
function anOpen() {
  if (anOpenSet) return anOpenSet;
  let a = null; try { a = JSON.parse(localStorage.getItem(AN_LS) || 'null'); } catch (e) { }
  anOpenSet = new Set(Array.isArray(a) ? a.filter(x => typeof x === 'string') : AN_DEF_OPEN); return anOpenSet;
}
function anOpenSave() { try { localStorage.setItem(AN_LS, JSON.stringify([...anOpen()])); } catch (e) { } }

/* ---------- modelo (calculado sob demanda e guardado) ---------- */
function anModel() {
  const R = S.records, n = R.length, a = S.ana, now = Date.now(); let cs = 0; for (let i = 0; i < n; i++) cs = (cs * 31 + Math.round(R[i].glucose * 10) + (R[i].ts % 100003)) % 1000000007;
  const key = [n, cs, a.range, a.agg, a.A.from, a.A.to, a.B.from, a.B.to, S.events.length, isoDate(new Date(now)), LIM.low, LIM.high].join('|');
  if (anMemo.key === key) return anMemo.M;
  const W = anWindows(R, a.range, now), cache = {}, lazy = (k, f) => () => (k in cache ? cache[k] : (cache[k] = f()));
  const rl = a.range === 'all' ? 'todo o histórico' : 'últimos ' + a.range + ' dias';
  const M = { now, range: a.range, rl, cur: W.cur, prev: W.prev, curR: W.curR, prevR: W.prevR, base: W.base, sum: anSummary(W.cur), psum: W.prev ? anSummary(W.prev) : null,
    slots: lazy('slots', () => anSlots(W.cur, W.prev)), blocks: lazy('blocks', () => anBlocks(W.cur, W.prev)), hypo: lazy('hypo', () => anHypo(W.cur)), hyper: lazy('hyper', () => anHyper(W.cur)),
    vari: lazy('vari', () => anVariability(W.cur)), rec: lazy('rec', () => anRecurrence(W.cur, MARKS)), assoc: lazy('assoc', () => anAssociations(W.cur, S.events)),
    disc: lazy('disc', () => anDiscoveries(W.cur, W.prev, rl)), hist: lazy('hist', () => anHistory(R)) };
  anMemo = { key, M }; return M;
}

/* ---------- componentes visuais ---------- */
const anTone = (v, lo, hi) => v == null ? '' : v < LIM.low ? 'low' : v > (hi || LIM.high) ? 'high' : 'ok';
const anDay = ms => fmtDM(ms) + '/' + String(new Date(ms).getFullYear()).slice(2);
function anChip(d, pct, unit, dir, dec) {
  if (d == null) return '<span class="an-dl none">sem comparação</span>';
  const z = Math.abs(d) < (dec === 0 ? 0.5 : 0.05), up = d > 0, cls = z || !dir ? 'neu' : (d * dir > 0 ? 'good' : 'bad');
  return `<span class="an-dl ${cls}" title="Diferença em relação ao período anterior"><b aria-hidden="true">${z ? '■' : up ? '▲' : '▼'}</b> ${z ? 'igual' : fsign(d, dec == null ? 1 : dec) + (unit ? ' ' + unit : '')}${pct != null && !z ? ` <small>(${fsign(pct, 0)}%)</small>` : ''}</span>`;
}
function anKpi(o) {
  return `<div class="an-kpi ${o.tone ? 'k-' + o.tone : ''}"><span class="an-kpi-t">${o.t}</span><span class="an-kpi-v num">${o.v}${o.u ? `<small>${o.u}</small>` : ''}</span>${o.sub ? `<span class="an-kpi-s">${o.sub}</span>` : ''}${o.extra || ''}${o.delta || ''}</div>`;
}
function anRing(parts, center, sub) {
  const R = 46, C = 2 * Math.PI * R, tot = parts.reduce((s, p) => s + p.n, 0); let off = 0;
  const arcs = tot ? parts.filter(p => p.n).map(p => { const len = p.n / tot * C, g = `<circle class="an-arc an-b-${p.k}" cx="60" cy="60" r="${R}" stroke-dasharray="${Math.max(0, len - (parts.filter(q => q.n).length > 1 ? 1.5 : 0)).toFixed(2)} ${(C - len + (parts.filter(q => q.n).length > 1 ? 1.5 : 0)).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`; off += len; return g; }).join('') : '';
  return `<svg class="an-ring" viewBox="0 0 120 120" role="img" aria-label="${esc(center + ' ' + sub)}"><circle class="an-arc-bg" cx="60" cy="60" r="${R}"/>${arcs}<text x="60" y="58" text-anchor="middle" class="an-ring-v">${center}</text><text x="60" y="74" text-anchor="middle" class="an-ring-s">${sub}</text></svg>`;
}
const AN_BANDS = [['vlow', 'Muito baixa', '< 54'], ['low', 'Baixa', '54–69'], ['ok', 'Na faixa', '70–180'], ['high', 'Elevada', '181–250'], ['vhigh', 'Muito elevada', '> 250']];
function anStack(bc, n) {
  if (!n) return '';
  return `<span class="an-stack" aria-hidden="true">${AN_BANDS.filter(b => bc[b[0]]).map(b => `<i class="an-b-${b[0]}" style="flex:${bc[b[0]]}"></i>`).join('')}</span>`;
}
function anBandLegend(bc, n) {
  return `<ul class="an-bl">${AN_BANDS.map(b => `<li><i class="an-sw an-b-${b[0]}"></i><span>${b[1]}<small>${b[2]} mg/dL</small></span><b class="num">${n ? fn(bc[b[0]] / n * 100, 0) : '—'}%<small>${bc[b[0]]}</small></b></li>`).join('')}</ul>`;
}
function anRange(min, mean, max) {
  if (min == null) return '';
  const lo = Math.min(40, min), hi = Math.max(260, max), sp = hi - lo, P = v => Math.max(0, Math.min(100, (v - lo) / sp * 100));
  return `<span class="an-rng" aria-hidden="true"><i class="an-rng-ok" style="left:${P(LIM.low).toFixed(1)}%;width:${(P(LIM.high) - P(LIM.low)).toFixed(1)}%"></i><i class="an-rng-sp" style="left:${P(min).toFixed(1)}%;width:${Math.max(1, P(max) - P(min)).toFixed(1)}%"></i><i class="an-rng-m" style="left:${P(mean).toFixed(1)}%"></i></span>`;
}
function anCols(items, o = {}) {
  const mx = Math.max(...items.map(i => i.v || 0), o.min || 1);
  return `<div class="an-cols" role="img" aria-label="${esc(o.label || '')}">${items.map(i => `<div class="an-col${i.v ? '' : ' empty'} ${i.cls || ''}" title="${esc(i.title || '')}"><span class="an-col-v num">${i.show != null ? i.show : (i.v || '·')}</span><span class="an-col-b"><i style="height:${i.v ? Math.max(6, i.v / mx * 100).toFixed(0) : 0}%"></i></span><span class="an-col-l">${esc(i.label)}</span>${i.sub ? `<span class="an-col-n">${esc(i.sub)}</span>` : ''}</div>`).join('')}</div>`;
}
function anDumb(a, b, max) {
  if (a == null || b == null) return '<span class="an-dumb off" aria-hidden="true"></span>';
  const P = v => Math.max(0, Math.min(100, v / max * 100)), l = Math.min(P(a), P(b)), w = Math.abs(P(a) - P(b));
  return `<span class="an-dumb" aria-hidden="true"><i class="an-dumb-l" style="left:${l.toFixed(1)}%;width:${w.toFixed(1)}%"></i><i class="an-dumb-b" style="left:${P(b).toFixed(1)}%"></i><i class="an-dumb-a" style="left:${P(a).toFixed(1)}%"></i></span>`;
}
function anScatter(pts, xl, yl) {
  if (pts.length < 8) return '';
  const W = 300, H = 150, L = 34, B = 24, T = 8, R = 8, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), X = v => L + (x1 === x0 ? .5 : (v - x0) / (x1 - x0)) * (W - L - R), Y = v => H - B - (y1 === y0 ? .5 : (v - y0) / (y1 - y0)) * (H - B - T);
  return `<svg class="an-sc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dispersão: ${esc(xl)} e ${esc(yl)}, ${pts.length} pares."><line class="an-ax" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/><line class="an-ax" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/>${pts.slice(0, 200).map(p => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3"/>`).join('')}<text class="an-at" x="${L}" y="${H - 10}">${fn(x0, 0)}</text><text class="an-at" x="${W - R}" y="${H - 10}" text-anchor="end">${fn(x1, 0)}</text><text class="an-at" x="${L - 4}" y="${H - B}" text-anchor="end">${fn(y0, 0)}</text><text class="an-at" x="${L - 4}" y="${T + 8}" text-anchor="end">${fn(y1, 0)}</text><text class="an-at" x="${(L + W - R) / 2}" y="${H - 1}" text-anchor="middle">${esc(xl)}</text></svg><p class="an-sc-y">↑ ${esc(yl)}</p>`;
}
const anNote = t => `<p class="an-note">${t}</p>`;
const anEmpty = (t, d) => `<div class="an-empty"><b>${t}</b><span>${d}</span></div>`;
const anRecs = ids => { const set = new Set(ids), a = S.records.filter(r => set.has(r.id)); return a; };
function anRelated(recs, hist, label) {
  if (!recs.length && !hist) return '';
  return `<details class="an-rel"><summary>${label || 'Registros relacionados'}${recs.length ? ` (${recs.length})` : ''}</summary>${recs.length ? pmRecList(recs) : ''}${hist ? `<button type="button" class="btn sm an-hbtn" data-act="an-hist" data-band="${hist.band || ''}" data-ctx="${hist.ctx || ''}">Ver no histórico</button>` : ''}</details>`;
}
const anCorrTxt = r => { if (r == null) return ''; const a = Math.abs(r), w = a < .2 ? 'quase nenhuma' : a < .4 ? 'fraca' : a < .7 ? 'moderada' : 'forte'; return `Correlação ${r >= 0 ? 'positiva' : 'negativa'} ${w} (r = ${fn(r, 2)}).`; };

/* ---------- seções ---------- */
const AN_ICONS = {
  visao: '<circle cx="12" cy="12" r="8"/><path d="M12 4v8l5 3"/>', desc: '<path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/>', ctrl: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  hipo: '<path d="M12 4v13M6 11l6 6 6-6"/>', hiper: '<path d="M12 20V7M6 13l6-6 6 6"/>', var: '<path d="M3 12h3l2-6 4 12 3-9 2 3h4"/>', hor: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  ref: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>', comp: '<path d="M4 7h13M13 3l4 4-4 4M20 17H7M11 13l-4 4 4 4"/>', pad: '<path d="M4 6h4v4H4zM10 6h4v4h-4zM16 6h4v4h-4zM4 14h4v4H4zM10 14h4v4h-4z"/>',
  ass: '<circle cx="7" cy="8" r="2.5"/><circle cx="17" cy="16" r="2.5"/><path d="M9 9.5l6 5"/>', evo: '<path d="M3 17l6-6 4 4 8-9M15 6h6v6"/>'
};
const AN_SECS = [
  { id: 'visao', t: 'Visão geral', n: 'Visão', c: 1, sum: M => M.sum.n ? `<span class="an-sc-i"><b class="num">${fm(M.sum.mean)}</b> mg/dL média</span><span class="an-sc-i"><b class="num">${M.sum.n}</b> medições</span><span class="an-sc-i"><b class="num">${fn(M.sum.pIn, 0)}%</b> na faixa</span>` : '', body: anBodyVisao },
  { id: 'desc', t: 'Central de descobertas', n: 'Descobertas', c: 2, sum: M => { const d = M.disc(); return d.list.length ? `<span class="an-sc-i"><b class="num">${d.list.length}</b> descoberta${d.list.length > 1 ? 's' : ''} neste período</span>` : '<span class="an-sc-i dim">Sem destaques com estes dados</span>'; }, body: anBodyDesc },
  { id: 'ctrl', t: 'Controle glicêmico', n: 'Controle', c: 3, sum: M => `<span class="an-sc-i"><b class="num">${fn(M.sum.pIn, 0)}%</b> das medições na faixa</span>`, body: anBodyCtrl },
  { id: 'hipo', t: 'Hipoglicemias', n: 'Hipos', c: 4, sum: M => { const h = M.hypo(); return `<span class="an-sc-i"><b class="num">${h.lowN}</b> abaixo de ${LIM.low}</span>${h.epN ? `<span class="an-sc-i"><b class="num">${h.epN}</b> episódio${h.epN > 1 ? 's' : ''}</span>` : ''}${h.min != null ? `<span class="an-sc-i">menor <b class="num">${f0(h.min)}</b></span>` : ''}`; }, body: anBodyHipo },
  { id: 'hiper', t: 'Hiperglicemias', n: 'Hipers', c: 5, sum: M => { const h = M.hyper(); return `<span class="an-sc-i"><b class="num">${h.highN}</b> acima da faixa</span>${h.max != null ? `<span class="an-sc-i">maior <b class="num">${f0(h.max)}</b></span>` : ''}`; }, body: anBodyHiper },
  { id: 'var', t: 'Variabilidade glicêmica', n: 'Variab.', c: 6, sum: M => { const v = M.vari(); return v.enough ? `<span class="an-sc-i">DP <b class="num">${fm(v.sd)}</b></span><span class="an-sc-i">CV <b class="num">${fn(v.cv, 0)}%</b></span>` : '<span class="an-sc-i dim">Precisa de 5 medições</span>'; }, body: anBodyVar },
  { id: 'hor', t: 'Análise por horário', n: 'Horário', c: 7, sum: M => { const s = M.slots().filter(x => x.enough); return s.length ? `<span class="an-sc-i"><b class="num">${s.length}</b> contexto${s.length > 1 ? 's' : ''} com dados</span>` : '<span class="an-sc-i dim">Poucos dados por contexto</span>'; }, body: anBodyHor },
  { id: 'ref', t: 'Análise por refeição', n: 'Refeições', c: 8, sum: M => { const d = mealDeltas(M.cur).filter(x => x.n >= MIN_BUCKET); return d.length ? `<span class="an-sc-i"><b class="num">${d.length}</b> refeição${d.length > 1 ? 'ões' : ''} com variação medida</span>` : '<span class="an-sc-i dim">Sem pares antes/depois suficientes</span>'; }, body: anBodyRef },
  { id: 'comp', t: 'Comparação entre períodos', n: 'Comparar', c: 9, sum: M => { const c = anCmpPick(M); return c && c.enough ? `<span class="an-sc-i"><b class="num">${c.good}</b> melhoraram</span><span class="an-sc-i"><b class="num">${c.bad}</b> pioraram</span>` : '<span class="an-sc-i dim">Escolha dois períodos</span>'; }, body: anBodyComp },
  { id: 'pad', t: 'Padrões recorrentes', n: 'Padrões', c: 10, sum: M => { const r = M.rec(); return r.length ? `<span class="an-sc-i"><b class="num">${r.length}</b> padrão${r.length > 1 ? 'ões' : ''} identificado${r.length > 1 ? 's' : ''}</span>` : '<span class="an-sc-i dim">Nenhum padrão claro</span>'; }, body: anBodyPad },
  { id: 'ass', t: 'Associações entre variáveis', n: 'Associações', c: 11, sum: M => { const a = M.assoc(); return a.length ? `<span class="an-sc-i"><b class="num">${a.length}</b> relação${a.length > 1 ? 'ões' : ''} observada${a.length > 1 ? 's' : ''}</span>` : '<span class="an-sc-i dim">Dados insuficientes</span>'; }, body: anBodyAss },
  { id: 'evo', t: 'Evolução histórica', n: 'Histórico', c: 12, sum: M => { const h = M.hist(); return h ? `<span class="an-sc-i"><b class="num">${h.n}</b> medições desde ${anDay(h.first)}</span>` : ''; }, body: anBodyEvo }
];
function anSecHTML(s, M) {
  const open = anOpen().has(s.id);
  return `<section class="an-sec an-c${s.c}${open ? ' open' : ''}" id="an-${s.id}" data-an="${s.id}"><button type="button" class="an-h" data-act="an-toggle" data-k="${s.id}" aria-expanded="${open}" aria-controls="an-b-${s.id}"><span class="an-h-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${AN_ICONS[s.id]}</svg></span><span class="an-h-t"><b>${s.t}</b><span class="an-h-s">${s.sum(M)}</span></span><span class="an-h-chev" aria-hidden="true">›</span></button><div class="an-b" id="an-b-${s.id}" role="region" aria-label="${s.t}" ${open ? '' : 'hidden'}>${open ? s.body(M) : ''}</div></section>`;
}

/* 1. Visão geral */
function anBodyVisao(M) {
  const s = M.sum, p = M.psum, tr = trend(M.cur), hasPrev = !!p && p.n > 0;
  const bc = s.bc, fewTxt = s.n < 10 ? '<p class="an-warn">Poucas medições neste intervalo: os números abaixo mostram o que foi registrado, mas podem não representar a sua rotina.</p>' : '';
  const dl = (k, dir, dec, u) => hasPrev ? anChip(anDelta(s[k], p[k]).d, anDelta(s[k], p[k]).pct, u, dir, dec) : '';
  const ref = M.range === 'all' ? '<span class="an-dl none">sem período anterior em “Tudo”</span>' : '';
  const cvBar = s.cv != null ? `<span class="an-gb" aria-hidden="true"><i class="an-gb-f" style="width:${Math.min(100, s.cv / 60 * 100).toFixed(0)}%"></i><i class="an-gb-t" style="left:${(36 / 60 * 100).toFixed(1)}%"></i></span>` : '';
  return `${fewTxt}<div class="an-ov"><div class="an-ov-r"><div class="an-ring-w">${anRing(AN_BANDS.map(b => ({ k: b[0], n: bc[b[0]] })), s.pIn == null ? '—' : fn(s.pIn, 0) + '%', 'na faixa')}</div><div class="an-ov-l">${anBandLegend(bc, s.n)}</div></div>
    <p class="an-note"><b>Proporção das medições</b> em cada faixa (${s.n} medições). Com glicemia capilar são medições pontuais: isto <b>não</b> é o tempo real dentro da faixa, que só um sensor contínuo mede. Em jejum a faixa vai até ${FAST.high} mg/dL.</p></div>
    <div class="an-kpis">${anKpi({ t: 'Média', v: fm(s.mean), u: 'mg/dL', tone: anTone(s.mean), extra: anRange(s.min, s.mean, s.max), sub: `menor ${f0(s.min)} · maior ${f0(s.max)}`, delta: dl('mean', 0, 1, 'mg/dL') })}
    ${anKpi({ t: 'Desvio-padrão', v: fm(s.sd), u: 'mg/dL', sub: 'o quanto as medições se afastam da média', delta: dl('sd', -1, 1, 'mg/dL') })}
    ${anKpi({ t: 'Coef. de variação', v: s.cv == null ? '—' : fn(s.cv, 0), u: '%', extra: cvBar, sub: s.cv == null ? 'precisa de 2 medições' : 'marca = 36%, referência usada com sensores', delta: dl('cv', -1, 0, '%') })}
    ${anKpi({ t: 'Medições', v: s.n, sub: M.rl, delta: dl('n', 0, 0, '') })}
    ${anKpi({ t: 'Dias com registro', v: s.days, u: `de ${s.spanDays}`, sub: s.coverage != null ? `${fn(s.coverage, 0)}% dos dias do intervalo` : '', extra: s.spanDays ? `<span class="an-bar" aria-hidden="true"><i style="width:${Math.min(100, s.coverage || 0).toFixed(0)}%"></i></span>` : '', delta: dl('days', 0, 0, '') })}
    ${anKpi({ t: 'Em relação ao período anterior', v: hasPrev && p.mean != null && s.mean != null ? fsign(s.mean - p.mean, 1) : '—', u: 'mg/dL', sub: hasPrev ? `média anterior ${fm(p.mean)} (${p.n} medições)` : (M.range === 'all' ? 'não existe período anterior em “Tudo”' : 'sem medições no período anterior'), extra: hasPrev ? anDumb(s.mean, p.mean, 300) : '' })}</div>
    <p class="an-note">${tr ? `<b>Tendência aproximada:</b> ${fsign(tr.perWeek)} mg/dL por semana, calculada sobre ${tr.days} dias com medição. Descreve o passado e não prevê o futuro.` : '<b>Tendência:</b> dados insuficientes (precisa de ao menos 10 dias e 20 medições).'}</p>${ref}`;
}
/* 2. Descobertas */
function anBodyDesc(M) {
  const d = M.disc();
  if (!d.list.length) return anEmpty('Nenhuma descoberta por enquanto', esc(d.why));
  return `<div class="an-cards">${d.list.map(x => `<article class="an-card t-${x.tone}"><h3>${esc(x.title)}</h3><p class="an-card-t">${esc(x.text)}</p><p class="an-meta"><span>Período: ${esc(x.period)}</span><span>${x.n} registros</span></p><details class="an-ev"><summary>Evidências usadas</summary><ul>${x.evidence.map(e => `<li>${esc(e)}</li>`).join('')}</ul></details>${anRelated(anRecs(x.recIds), x.hist)}</article>`).join('')}</div>${anNote('Descobertas descrevem números dos seus registros neste período. Não indicam causa nem orientam tratamento.')}`;
}
/* 3. Controle glicêmico */
function anBodyCtrl(M) {
  const s = M.sum, now = M.now, e = est90();
  return `<p class="an-lead">Como as medições se distribuem entre as faixas, a estimativa de HbA1c e como os últimos períodos fixos se comparam.</p>
    <div class="an-split"><div class="an-chip ${s.hypo ? 'alert' : ''}">Abaixo de ${LIM.low} mg/dL: <b>${s.hypo}</b> (${fn(anPct(s.hypo, s.n), 0)}%)</div><div class="an-chip ${s.hyper ? 'alert' : ''}">Acima da faixa: <b>${s.hyper}</b> (${fn(anPct(s.hyper, s.n), 0)}%)</div></div>
    ${distBars(M.cur, true, true)}
    <h3 class="an-sub">HbA1c estimada</h3>${e.ok ? `<div class="an-est"><b class="num">≈ ${fn(e.value, 1)}%</b>${a1cBadge(e.value)}<span>estimativa a partir de ${e.st.n} medições em ${e.days} dias (últimos 90 dias)</span></div><p class="an-note">É uma <b>estimativa</b> calculada com a média das medições capilares. Não é exame de laboratório e não substitui a hemoglobina glicada medida pelo laboratório.</p>` : `<p class="an-note">Estimativa indisponível: precisa de 30 medições em 20 dias diferentes nos últimos 90 dias (há ${e.st.n} em ${e.days}).</p>`}
    <button type="button" class="btn sm" data-act="go" data-r="hba1c">Limites e exames</button>
    <h3 class="an-sub">Janelas fixas · 7, 30, 90 e 180 dias</h3><div class="tbl-wrap tw-hint" tabindex="0" role="region" aria-label="Tabela com rolagem horizontal"><table class="t wide-t"><thead><tr><th>Período</th><th>Média (mg/dL)</th><th>Menor–maior</th><th>Nº de medições</th><th>Abaixo de 70</th><th>Acima da faixa</th></tr></thead><tbody>${[7, 30, 90, 180].map(d => statsBlock(d + ' dias', inRange(anBase(S.records), startOfDay(addDays(now, -(d - 1))), endOfDay(now))).html).join('')}</tbody></table></div><p class="an-note">Sempre contam a partir de hoje, com todos os registros, qualquer que seja o intervalo escolhido. <b>Abaixo de 70</b>: glicemias menores que ${LIM.low} mg/dL. <b>Acima da faixa</b>: acima de ${LIM.high} mg/dL (${FAST.high} em jejum). O número menor é a porcentagem das medições do período.</p>`;
}
/* 4. Hipoglicemias */
function anBodyHipo(M) {
  const h = M.hypo();
  if (!h.enough) return anEmpty('Poucas medições', 'Registre mais medições para ver a análise de hipoglicemias.');
  if (!h.lowN) return `<div class="an-ok"><b>Nenhuma medição abaixo de ${LIM.low} mg/dL</b><span>em ${h.n} medições (${esc(M.rl)}).</span></div>` + anNote('Isto vale só para os momentos em que você mediu. Hipoglicemias que não foram medidas não aparecem aqui.');
  const mx = Math.max(...h.byBlock.map(b => b.lows), 1), mxd = Math.max(...h.byDay.map(b => b.lows), 1);
  return `<div class="an-kpis">${anKpi({ t: 'Medições baixas', v: h.lowN, u: `de ${h.n}`, tone: 'low', sub: `${fn(h.pct, 1)}% das medições`, extra: `<span class="an-bar bad" aria-hidden="true"><i style="width:${Math.max(2, h.pct).toFixed(0)}%"></i></span>` })}${anKpi({ t: 'Episódios', v: h.epN, tone: 'low', sub: 'medições seguidas contam como 1' })}${anKpi({ t: 'Menor valor', v: f0(h.min), u: 'mg/dL', tone: 'low', sub: h.vlowN ? `${h.vlowN} abaixo de 54` : 'nenhuma abaixo de 54' })}${anKpi({ t: 'De madrugada', v: h.nightly, sub: 'antes das 6h' })}</div>
    <h3 class="an-sub">Em que faixa do dia</h3>${anCols(h.byBlock.map(b => ({ label: b.label.replace('h', ''), v: b.lows, sub: b.n ? `de ${b.n}` : '', cls: 'c-low', title: `${b.lows} baixas em ${b.n} medições` })), { label: 'Medições baixas por faixa horária' })}
    <h3 class="an-sub">Por dia da semana</h3>${anCols(h.byDay.map(b => ({ label: b.label, v: b.lows, sub: b.n ? `de ${b.n}` : '', cls: 'c-low' })), { label: 'Medições baixas por dia da semana' })}
    ${h.episodes.length ? `<h3 class="an-sub">Episódios recentes</h3><ul class="an-eps">${h.episodes.slice(0, 5).map(e => `<li><button type="button" class="an-ep" data-act="open" data-id="${e.members[0].id}"><b class="num">${f0(e.min)}</b><span>${fmtDate(e.date).slice(0, 5)} · ${e.members[0].time || '—:—'}${e.members.filter(x => x.glucose < LIM.low).length > 1 ? ` · ${e.members.filter(x => x.glucose < LIM.low).length} medições seguidas` : ''}${e.rec ? ` · recuperou para ${f0(e.rec.glucose)}` : ' · sem nova medição ≥ 70 em seguida'}</span></button></li>`).join('')}</ul>` : ''}
    ${anRelated(anRecs(h.recIds), { band: 'baixa' }, 'Todas as medições baixas')}`;
}
/* 5. Hiperglicemias */
function anBodyHiper(M) {
  const h = M.hyper();
  if (!h.enough) return anEmpty('Poucas medições', 'Registre mais medições para ver a análise de hiperglicemias.');
  if (!h.highN) return `<div class="an-ok"><b>Nenhuma medição acima da faixa</b><span>em ${h.n} medições (${esc(M.rl)}).</span></div>`;
  return `<div class="an-kpis">${anKpi({ t: 'Acima da faixa', v: h.highN, u: `de ${h.n}`, tone: 'high', sub: `${fn(h.pct, 1)}% das medições`, extra: `<span class="an-bar warn" aria-hidden="true"><i style="width:${Math.max(2, h.pct).toFixed(0)}%"></i></span>` })}${anKpi({ t: 'Muito elevadas', v: h.vhighN, tone: 'high', sub: `acima de ${LIM.vhigh} mg/dL` })}${anKpi({ t: 'Maior valor', v: f0(h.max), u: 'mg/dL', tone: 'high' })}</div>
    <h3 class="an-sub">Frequência por faixa do dia</h3><p class="an-note" style="margin-top:0">Altura = quantas medições elevadas; embaixo, o total de medições da faixa.</p>${anCols(h.byBlock.map(b => ({ label: b.label.replace('h', ''), v: b.highs, sub: b.n ? `${fn(b.pct, 0)}% de ${b.n}` : '', cls: 'c-high', title: `${b.highs} elevadas em ${b.n} medições` })), { label: 'Medições elevadas por faixa horária' })}
    <h3 class="an-sub">Por contexto</h3><div class="an-hb">${h.slots.filter(x => x.highN).sort((a, b) => b.highPct - a.highPct).map(x => `<div class="an-hr"><span>${x.t}</span><span class="an-bar warn" aria-hidden="true"><i style="width:${Math.max(3, x.highPct).toFixed(0)}%"></i></span><b class="num">${fn(x.highPct, 0)}%<small>${x.highN}/${x.n}</small></b></div>`).join('') || '<p class="an-note">Nenhum contexto com 3 ou mais medições elevadas.</p>'}</div>
    ${anRelated(anRecs(h.recIds).slice(-60), { band: 'alta' }, 'Medições elevadas')}`;
}
/* 6. Variabilidade */
function anBodyVar(M) {
  const v = M.vari();
  if (!v.enough) return anEmpty('Poucas medições', 'A variabilidade precisa de pelo menos 5 medições no intervalo.');
  const cvPos = v.cv != null ? Math.min(100, v.cv / 60 * 100) : 0;
  return `<div class="an-kpis">${anKpi({ t: 'Desvio-padrão', v: fm(v.sd), u: 'mg/dL', sub: 'afastamento típico da média' })}${anKpi({ t: 'Coef. de variação', v: fn(v.cv, 0), u: '%', sub: 'desvio-padrão ÷ média', extra: `<span class="an-gb" aria-hidden="true"><i class="an-gb-f" style="width:${cvPos.toFixed(0)}%"></i><i class="an-gb-t" style="left:60%"></i></span>` })}${anKpi({ t: 'Amplitude', v: f0(v.amp), u: 'mg/dL', sub: 'maior − menor' })}${anKpi({ t: 'Entre os dias', v: v.sdDays == null ? '—' : fm(v.sdDays), u: v.sdDays == null ? '' : 'mg/dL', sub: v.sdDays == null ? 'precisa de 5 dias' : `desvio das médias de ${v.daysN} dias` })}${anKpi({ t: 'Dentro do dia', v: v.ampMean == null ? '—' : f0(v.ampMean), u: v.ampMean == null ? '' : 'mg/dL', sub: v.ampMean == null ? 'precisa de 3 dias com 2+ medições' : `amplitude média em ${v.ampDays} dias` })}</div>
    <p class="an-note">A marca de 36% no medidor é a referência usada com sensores contínuos. Com poucas medições por dia, o coeficiente de variação é apenas indicativo. Valores menores significam medições mais próximas da média.</p>
    <h3 class="an-sub">Desvio-padrão por faixa do dia</h3>${anCols(v.blocks.map(b => ({ label: b.label.replace('h', ''), v: b.sdOk ? Math.round(b.sd) : 0, sub: b.n ? `n=${b.n}` : '', show: b.sdOk ? f0(b.sd) : (b.n ? '·' : '—'), cls: 'c-var', title: b.sdOk ? `Desvio-padrão ${fm(b.sd)} em ${b.n} medições` : 'Menos de 5 medições' })), { label: 'Desvio-padrão por faixa horária' })}<p class="an-note">Faixas com menos de 5 medições não mostram o desvio-padrão.</p>`;
}
/* 7. Horário e contexto */
function anSlotCard(x) {
  if (!x.n) return `<div class="an-slot off"><span class="an-slot-t">${x.t}</span><span class="an-slot-e">sem medições</span></div>`;
  if (!x.enough) return `<div class="an-slot off"><span class="an-slot-t">${x.t}</span><span class="an-slot-e">${x.n} medição${x.n > 1 ? 'ões' : ''} · insuficiente (mínimo ${MIN_BUCKET})</span></div>`;
  const tone = anTone(x.mean, 0, x.k === 'jejum' ? FAST.high : LIM.high);
  const prev = x.prev && x.prev.enough ? anChip(x.dMean, anPct(x.dMean, x.prev.mean), 'mg/dL', 0, 0) : '';
  return `<div class="an-slot k-${tone}"><span class="an-slot-t">${x.t}</span><span class="an-slot-v num">${f0(x.mean)}<small>mg/dL · n=${x.n}</small></span>${anRange(x.min, x.mean, x.max)}<span class="an-slot-r num">menor ${f0(x.min)} · maior ${f0(x.max)}${x.sd != null && x.n >= 5 ? ` · DP ${f0(x.sd)}` : ''}</span><span class="an-slot-f"><span><i class="an-bar bad" aria-hidden="true"><i style="width:${(x.lowPct || 0).toFixed(0)}%"></i></i>baixas ${fn(x.lowPct, 0)}%<small>${x.lowN}</small></span><span><i class="an-bar warn" aria-hidden="true"><i style="width:${(x.highPct || 0).toFixed(0)}%"></i></i>elevadas ${fn(x.highPct, 0)}%<small>${x.highN}</small></span></span>${prev ? `<span class="an-slot-d">${prev}<small>vs. período anterior</small></span>` : ''}</div>`;
}
function anBodyHor(M) {
  const sl = M.slots(), td = typicalDay(M.cur);
  return `<p class="an-lead">Cada cartão agrupa as medições pelo contexto em que foram feitas. Médias só com ${MIN_BUCKET} ou mais medições; o desvio-padrão, com 5 ou mais.</p><div class="an-slots">${sl.map(anSlotCard).join('')}</div>${M.prev ? '' : anNote('Em “Tudo” não há período anterior para comparar.')}
    <h3 class="an-sub">Média por faixa horária (blocos de 4 horas)</h3>${barChart(byTimeBlock(M.cur).map(b => ({ label: b.label, value: b.mean, n: b.n })), { label: 'Média de glicemia por faixa horária' })}${barLegend('cada barra é um período de <b>4 horas</b> do dia (00–04h = da meia-noite às 4 da manhã; 12–16h = do meio-dia às 4 da tarde).')}<p class="an-note">Medições sem horário ficam de fora.</p>
    <h3 class="an-sub">Dia típico</h3>${typicalDayChart(M.cur)}${td.ok >= 6 ? anNote('Reúne todos os dias do período em um só dia de 24 horas. A linha é a mediana por horário e as faixas mostram onde ficou a maioria das medições. Só mostra o que aconteceu: não orienta tratamento.') : ''}
    <h3 class="an-sub">Mapa de calor · dia e horário</h3>${heatmapCard(M.cur).replace(/<h2 class="sec">[^<]*<\/h2>/, '').replace('<div class="card">', '<div class="an-inner">')}`;
}
/* 8. Refeição */
function anBodyRef(M) {
  const recs = M.cur;
  const ctxRows = Object.entries(CONTEXTS).map(([k, l]) => ({ label: l, hi: k === 'jejum' ? FAST.high : LIM.high, ...stats(recs.filter(r => r.context === k)) })).filter(r => r.n), none = stats(recs.filter(r => !r.context));
  const mealRows = Object.entries(MEALS).map(([k, l]) => { const ar = recs.filter(r => r.meal === k); return { l, all: stats(ar), antes: stats(ar.filter(r => r.context === 'antes')), depois: stats(ar.filter(r => r.context === 'depois')) }; });
  const cell = s => s.n >= MIN_BUCKET ? `${fm(s.mean)}<small>n=${s.n}</small>` : `<span class="dim">${s.n ? 'n=' + s.n : '—'}</span>`;
  const md = mealDeltas(recs);
  const deltas = md.filter(r => r.n >= MIN_BUCKET), mxd = Math.max(...deltas.map(r => Math.abs(r.d)), 1);
  return `${deltas.length ? `<h3 class="an-sub">Variação (depois − antes)</h3><div class="an-dv">${deltas.map(r => `<div class="an-dvr"><span>${r.name}<small>${r.n} dias com par</small></span><span class="an-dvt" aria-hidden="true"><i class="${r.d >= 0 ? 'pos' : 'neg'}" style="${r.d >= 0 ? 'left:50%' : 'right:50%'};width:${(Math.abs(r.d) / mxd * 50).toFixed(1)}%"></i></span><b class="num">${fsign(r.d)}<small>mg/dL</small></b></div>`).join('')}</div>` : ''}
    <h3 class="an-sub">Por contexto</h3>${ctxRows.length ? meanBars(ctxRows) : '<div class="empty">Nenhuma medição com contexto informado.</div>'}${none.n ? `<p class="an-note">${none.n} medições sem contexto não entram nesta lista.</p>` : ''}
    <h3 class="an-sub">Média por tipo de refeição</h3><div class="tbl-wrap"><table class="t"><thead><tr><th>Refeição</th><th>Antes</th><th>Depois</th><th>Todas</th></tr></thead><tbody>${mealRows.map(m => `<tr><td>${m.l}</td><td>${cell(m.antes)}</td><td>${cell(m.depois)}</td><td>${cell(m.all)}</td></tr>`).join('')}</tbody></table></div><p class="an-note">Médias em mg/dL, com ${MIN_BUCKET} ou mais medições. <b>Antes</b>: medida antes de comer. <b>Depois</b>: medida depois de comer. <b>n</b>: quantidade de medições usadas.</p>
    <h3 class="an-sub">Tabela de variação por refeição</h3>${mealDeltaCard(recs, true)}<p class="an-note"><b>Como ler a variação:</b> sinal <b>+</b> significa glicemia mais alta depois da refeição; <b>−</b>, mais baixa. Em mg/dL.</p>`;
}
/* 9. Comparação */
function anCmpPick(M) {
  const A = S.ana.A, B = S.ana.B, rng = p => p.from && p.to && p.from <= p.to ? [mkTs(p.from, '00:00'), endOfDay(mkTs(p.to, '00:00'))] : null, ra = rng(A), rb = rng(B), base = anBase(S.records);
  if (ra && rb) return { ...anCompare(inRange(base, ra[0], ra[1]), inRange(base, rb[0], rb[1])), ra, rb, manual: true };
  if (M.prev && M.curR) return { ...anCompare(M.cur, M.prev), ra: M.curR, rb: M.prevR, manual: false };
  return null;
}
function compareCardHTML() {
  const { A, B } = S.ana, M = anModel(), c = anCmpPick(M);
  const pre = [['prev', 'Atual × anterior', M.range !== 'all'], ['w30', '30 × 30 dias', true], ['mon', 'Este mês × anterior', true]];
  let h = `<div class="an-pre" role="group" aria-label="Comparações prontas">${pre.map(([k, l, on]) => `<button type="button" class="an-pill" data-act="an-preset" data-v="${k}" ${on ? '' : 'disabled'}>${l}</button>`).join('')}</div>
    <div class="form-grid"><div class="field"><label class="fl" for="a-from">Período A · de</label><input class="in" type="date" id="a-from" value="${A.from}"></div><div class="field"><label class="fl" for="a-to">até</label><input class="in" type="date" id="a-to" value="${A.to}"></div>
    <div class="field"><label class="fl" for="b-from">Período B · de</label><input class="in" type="date" id="b-from" value="${B.from}"></div><div class="field"><label class="fl" for="b-to">até</label><input class="in" type="date" id="b-to" value="${B.to}"></div></div>`;
  if (!c) return h + '<p class="an-note">Escolha uma comparação pronta ou informe as duas datas de cada período. Em “Tudo” não há período anterior automático.</p>';
  const rg = r => anDay(r[0]) + ' – ' + anDay(r[1]);
  h += `<p class="an-note" style="margin-top:12px">${c.manual ? 'Comparando os períodos informados.' : `Comparando o intervalo atual (${esc(M.rl)}) com o período anterior de mesmo tamanho.`}</p>
    <div class="an-ab"><div class="an-abc a"><b>A</b><span class="num">${rg(c.ra)}</span><span>${c.A.n} medições · ${c.A.days} dias</span></div><div class="an-abc b"><b>B</b><span class="num">${rg(c.rb)}</span><span>${c.B.n} medições · ${c.B.days} dias</span></div></div>`;
  if (!c.enough) return h + `<p class="an-warn">Um dos períodos tem menos de ${MIN_BUCKET} medições. Não há como comparar.</p>`;
  if (c.warn.length) h += `<ul class="an-wl" role="note">${c.warn.map(w => `<li>${w}</li>`).join('')}</ul>`;
  h += `<div class="an-bal"><span class="an-pill on">${c.good} melhor${c.good === 1 ? 'ou' : 'aram'} em A</span><span class="an-pill">${c.bad} pior${c.bad === 1 ? 'ou' : 'aram'} em A</span></div><div class="an-cmp">${c.rows.map(r => {
    const v = x => x == null ? '—' : fn(x, r.dec), mx = r.k === 'mean' ? 300 : r.k === 'sd' ? Math.max(r.a || 0, r.b || 0, 1) * 1.3 : r.k === 'cv' ? 60 : r.k === 'ep' ? Math.max(r.a || 0, r.b || 0, 1) * 1.3 : r.pp ? 100 : Math.max(r.a || 0, r.b || 0, 1) * 1.3;
    const cls = r.better === 'a' ? 'good' : r.better === 'b' ? 'bad' : 'neu';
    return `<div class="an-cr ${cls}"><span class="an-cr-t">${r.t}</span><span class="an-cr-v"><span class="a num">A ${v(r.a)}${r.u ? `<small>${r.u}</small>` : ''}${r.extra ? `<small>${r.extra.a} ep.</small>` : ''}</span><span class="b num">B ${v(r.b)}${r.u ? `<small>${r.u}</small>` : ''}${r.extra ? `<small>${r.extra.b} ep.</small>` : ''}</span></span>${anDumb(r.a, r.b, mx)}<span class="an-cr-d num">${r.d == null ? '—' : fsign(r.d, r.dec) + (r.pp ? ' pp' : r.u ? ' ' + r.u : '')}${r.pct != null ? `<small>${fsign(r.pct, 0)}%</small>` : ''}</span>${r.better ? `<span class="an-cr-b">${r.better === 'a' ? 'A melhor' : 'B melhor'}</span>` : ''}</div>`;
  }).join('')}</div>
    <h3 class="an-sub">Distribuição por faixa (proporção das medições)</h3><div class="an-2s"><div><b>A</b>${anStack(c.A.bc, c.A.n)}<small class="num">${fn(c.A.pIn, 0)}% na faixa</small></div><div><b>B</b>${anStack(c.B.bc, c.B.n)}<small class="num">${fn(c.B.pIn, 0)}% na faixa</small></div></div>${anBandLegend(c.A.bc, c.A.n).replace('class="an-bl"', 'class="an-bl compact"')}
    <p class="an-note"><b>pp</b> = pontos percentuais (diferença entre duas porcentagens). “Melhor” só é indicado onde menos ou mais é objetivamente preferível (variabilidade, proporção na faixa, baixas e elevadas); a média e as contagens aparecem sem julgamento. As proporções são de medições, não de tempo.</p>`;
  const ra = c.ra, rb = c.rb, sa = stats(inRange(anBase(S.records), ra[0], ra[1])), sb = stats(inRange(anBase(S.records), rb[0], rb[1])), cc = compareStats(sa, sb);
  const row = (lb, a, b, d) => `<tr><td>${lb}</td><td>${a}</td><td>${b}</td><td>${d}</td></tr>`;
  h += `<details class="an-ev"><summary>Ver tabela completa</summary><div class="tbl-wrap"><table class="t"><thead><tr><th></th><th>Período A</th><th>Período B</th><th>A − B</th></tr></thead><tbody>${row('Média', fm(sa.mean), fm(sb.mean), fsign(cc.diff))}${row('Variação (%)', '', '', cc.pct == null ? '—' : fsign(cc.pct) + '%')}${row('Desvio-padrão', fm(sa.sd), fm(sb.sd), sa.sd != null && sb.sd != null ? fsign(sa.sd - sb.sd) : '—')}${row('Menor–maior', sa.n ? f0(sa.min) + '–' + f0(sa.max) : '—', sb.n ? f0(sb.min) + '–' + f0(sb.max) : '—', '')}${row('Nº de medições', sa.n, sb.n, fsign(sa.n - sb.n, 0))}${row('Abaixo de 70', `${sa.hypo}<small>${sa.n ? (sa.hypo / sa.n * 100).toFixed(0) + '%' : '—'}</small>`, `${sb.hypo}<small>${sb.n ? (sb.hypo / sb.n * 100).toFixed(0) + '%' : '—'}</small>`, fsign(sa.hypo - sb.hypo, 0))}${row('Acima da faixa', `${sa.hyper}<small>${sa.n ? (sa.hyper / sa.n * 100).toFixed(0) + '%' : '—'}</small>`, `${sb.hyper}<small>${sb.n ? (sb.hyper / sb.n * 100).toFixed(0) + '%' : '—'}</small>`, fsign(sa.hyper - sb.hyper, 0))}</tbody></table></div><p class="an-note"><b>A − B:</b> diferença entre A e B; sinal + significa que A ficou maior. Valores em mg/dL.</p></details>`;
  return h;
}
function anBodyComp(M) { return `<div id="cmp">${compareCardHTML()}</div>`; }
/* 10. Padrões */
function anBodyPad(M) {
  const r = M.rec();
  if (!r.length) return anEmpty('Nenhum padrão claro', `Padrões só aparecem com amostra suficiente (3 ou mais ocorrências, e 5 ou mais dias ou medições em cada grupo comparado). Há ${M.sum.n} medições neste intervalo.`) + anNote('Os padrões do aplicativo também podem ser vistos em Mais → Padrões.');
  return `<div class="an-cards">${r.map(x => `<article class="an-card t-${x.tone}"><h3>${esc(x.title)}</h3><div class="an-cnt"><b class="num">${x.count}</b><span>ocorrências em ${x.universe} ${x.k === 'atividade' || x.k.startsWith('marca-') ? 'dias' : 'medições'}</span><span class="an-bar" aria-hidden="true"><i style="width:${Math.min(100, Math.max(3, x.count / x.universe * 100)).toFixed(0)}%"></i></span></div><p class="an-card-t">${esc(x.text)}</p>${anRelated(anRecs(x.recIds).slice(-30), x.hist)}</article>`).join('')}</div>${anNote('Estes padrões são <b>coincidências nos números</b> dos seus registros, não causas. Muitos fatores mudam de um dia para o outro. Converse com sua equipe de saúde antes de mudar qualquer conduta.')}`;
}
/* 11. Associações */
function anBodyAss(M) {
  const a = M.assoc();
  if (!a.length) return anEmpty('Dados insuficientes para associações', 'Elas precisam de registros com carboidratos, insulina, atividade ou eventos e de uma nova medição dentro da janela de tempo (por exemplo, 1 a 4 horas depois). São necessários ao menos 8 pares por relação.');
  return `<div class="an-cards">${a.map(x => {
    const mx = Math.max(...x.bins.map(b => Math.abs(b.delta != null ? b.delta : b.post || 0)), 1);
    return `<article class="an-card t-info"><h3>${esc(x.title)}</h3><p class="an-meta"><span>${x.used} pares usados</span><span>${x.universe} registros considerados</span></p><p class="an-card-t">${esc(x.text)}</p>
    <div class="an-ab-bins">${x.bins.map(b => `<div class="an-bn"><span>${esc(b.l)}<small>n=${b.n}</small></span><span class="an-bnt" aria-hidden="true">${b.delta != null ? `<i class="${b.delta >= 0 ? 'pos' : 'neg'}" style="${b.delta >= 0 ? 'left:50%' : 'right:50%'};width:${(Math.abs(b.delta) / mx * 50).toFixed(1)}%"></i>` : `<i class="pos" style="left:0;width:${Math.min(100, (b.post || 0) / 300 * 100).toFixed(1)}%"></i>`}</span><b class="num">${b.delta != null ? fsign(b.delta, 0) + ' mg/dL' : f0(b.post) + ' mg/dL'}<small>${b.delta != null ? 'variação média' : 'glicemia depois'}</small></b></div>`).join('')}</div>
    ${x.r != null ? `<p class="an-corr">${anCorrTxt(x.r)}</p>` : ''}${anScatter(x.points || [], x.xl, x.yl)}
    <p class="an-limit"><b>Limitações:</b> ${esc(x.limits)}</p></article>`;
  }).join('')}</div>${anNote('Relações observadas nos seus registros, não causas. <b>Não são recomendações</b> de dose, alimentação ou mudança de tratamento: decida com sua equipe de saúde.')}`;
}
/* 12. Evolução histórica (Evolução por semana/mês, como antes, mais marcos) */
function anBodyEvo(M) {
  const a = S.ana, recs = M.cur, wk = a.agg === 'week', g = groupBy(recs, r => wk ? weekStart(r.ts) : monthStart(r.ts));
  const all = [...g.entries()].sort((x, y) => x[0] - y[0]).map(([t, rs]) => ({ t, ...stats(rs) })), total = all.length, buckets = all.slice(-12);
  const lbl = t => wk ? fmDMY(t) : new Date(t).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
  const H = M.hist(), mos = H ? H.months.slice(-12) : [];
  return `<div class="row sp" style="margin:0 0 10px"><span class="fl" style="margin:0">Agrupar por</span><div class="seg" role="group" aria-label="Agrupamento temporal"><button data-act="ana-agg" data-v="week" aria-pressed="${wk}">Semana</button><button data-act="ana-agg" data-v="month" aria-pressed="${!wk}">Mês</button></div></div>
    ${barChart(buckets.map(b => ({ label: wk ? fmtDM(b.t) : lbl(b.t), value: b.mean, n: b.n, sub: `Menor ${f0(b.min)} · maior ${f0(b.max)}` })), { label: 'Média de glicemia por ' + (wk ? 'semana' : 'mês') })}
    ${barLegend(wk ? 'cada barra é uma <b>semana</b>; a data embaixo (dia/mês, como 03/11) é a <b>segunda-feira em que a semana começa</b>.' : 'cada barra é um <b>mês</b> (por exemplo, nov 26 = novembro de 2026).')}
    <p class="an-note">Média por ${wk ? 'semana (início na segunda)' : 'mês'}, em mg/dL, no intervalo ${esc(M.rl)}. ${total > 12 ? `Gráfico: últimos 12 de ${total}; a tabela abaixo traz todos. ` : ''}Barras com menos de ${MIN_BUCKET} medições não mostram média.</p>
    <details class="an-ev"><summary>Ver ${wk ? 'todas as semanas' : 'todos os meses'} (${total})</summary><div class="tbl-wrap"><table class="t"><thead><tr><th>${wk ? 'Semana começando em' : 'Mês'}</th><th>Média (mg/dL)</th><th>Menor–maior</th><th>Nº de medições</th></tr></thead><tbody>${all.slice().reverse().map(b => `<tr><td>${wk ? fmDMY(b.t) : lbl(b.t)}</td><td>${b.n >= MIN_BUCKET ? fm(b.mean) : '<span class="dim">insuficiente</span>'}</td><td>${f0(b.min)}–${f0(b.max)}</td><td>${b.n}</td></tr>`).join('')}</tbody></table></div></details>
    ${H ? `<h3 class="an-sub">Proporção de medições na faixa, por mês <small>(todo o histórico)</small></h3>${anCols(mos.map(m => ({ label: new Date(m.t).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), v: m.n >= 10 ? Math.round(m.pIn) : 0, show: m.n >= 10 ? fn(m.pIn, 0) + '%' : '·', sub: `n=${m.n}`, cls: 'c-ok' })), { label: 'Proporção de medições na faixa por mês' })}<p class="an-note">Meses com menos de 10 medições ficam em branco.</p>
    <h3 class="an-sub">Marcos do histórico</h3><ul class="an-mil"><li><span>Primeira medição</span><b class="num">${fmtDate(isoDate(new Date(H.first)))}</b></li><li><span>Total de medições</span><b class="num">${H.n}</b></li><li><span>Dias com registro</span><b class="num">${H.days}</b></li><li><span>Maior glicemia</span><button type="button" class="an-lk num" data-act="open" data-id="${H.hi.id}">${f0(H.hi.glucose)} · ${fmtDate(H.hi.date).slice(0, 5)}</button></li><li><span>Menor glicemia</span><button type="button" class="an-lk num" data-act="open" data-id="${H.lo.id}">${f0(H.lo.glucose)} · ${fmtDate(H.lo.date).slice(0, 5)}</button></li>${H.best ? `<li><span>Semana com maior proporção na faixa</span><b class="num">${fn(H.best.pIn, 0)}% · ${fmDMY(H.best.t)}</b></li><li><span>Semana com menor proporção na faixa</span><b class="num">${fn(H.worst.pIn, 0)}% · ${fmDMY(H.worst.t)}</b></li>` : ''}</ul>` : ''}`;
}

/* ---------- tela ---------- */
function viewAnalise() {
  let h = banners();
  if (!S.records.length) return h + emptyBlock('Sem dados para analisar', 'Importe o arquivo de outro aplicativo ou registre medições.', '<br><br><button class="btn pri" data-act="go" data-r="importar">Importar de outros aplicativos</button>');
  const a = S.ana, M = anModel(); h += prNotice('analise');
  const span = M.cur.length ? (() => { const t = M.cur.map(r => r.ts); return fmtDM(Math.min(...t)) + '/' + new Date(Math.min(...t)).getFullYear() + ' a ' + fmtDM(Math.max(...t)) + '/' + new Date(Math.max(...t)).getFullYear(); })() : '';
  h += `<div class="card anaf an-filter"><div class="fl">Intervalo de dias</div><div class="seg an-seg" role="group" aria-label="Intervalo de dias">${[['all', 'Tudo'], ['7', '7 d'], ['14', '14 d'], ['30', '30 d'], ['90', '90 d'], ['180', '180 d']].map(([k, l]) => `<button data-act="ana-range" data-v="${k}" aria-pressed="${a.range === k}">${l}</button>`).join('')}</div><p class="hint" id="ana-span">${M.cur.length ? `Mostrando <b>${span}</b> · ${M.sum.n} medições.` : 'Sem medições neste intervalo.'} O intervalo vale para todas as seções, exceto as janelas fixas (7, 30, 90 e 180 dias) e a evolução histórica completa.</p></div>`;
  if (!M.cur.length) return h + `<div class="card" style="margin-top:12px">${emptyBlock('Sem medições', 'Não há medições neste intervalo. Escolha “Tudo” para ver todo o histórico.')}</div>`;
  h += `<nav class="an-nav" aria-label="Seções da Análise"><div class="an-nav-in">${AN_SECS.map(s => `<button type="button" class="an-nv an-c${s.c}" data-act="an-go" data-k="${s.id}">${s.n}</button>`).join('')}</div><div class="an-nav-a"><button type="button" class="btn sm" data-act="an-all">Expandir tudo</button><button type="button" class="btn sm" data-act="an-none">Recolher tudo</button></div></nav>`;
  return h + `<div class="an-secs">${AN_SECS.map(s => anSecHTML(s, M)).join('')}</div>`;
}

/* ---------- eventos ---------- */
function anFill(id) {
  const sec = document.getElementById('an-' + id), s = AN_SECS.find(x => x.id === id); if (!sec || !s) return;
  const b = sec.querySelector('.an-b'); if (b && !b.firstElementChild && !b.textContent.trim()) { b.innerHTML = s.body(anModel()); try { attachCharts(b); } catch (e) { } }
}
function anSet(id, on) {
  const sec = document.getElementById('an-' + id); if (!sec) return;
  if (on) anOpen().add(id); else anOpen().delete(id);
  anOpenSave(); const b = sec.querySelector('.an-b'), h = sec.querySelector('.an-h');
  sec.classList.toggle('open', on); h.setAttribute('aria-expanded', String(on)); b.hidden = !on; if (on) anFill(id);
}
document.addEventListener('click', e => {
  const el = e.target.closest && e.target.closest('[data-act^="an-"]'); if (!el || S.route !== 'analise') return;
  const a = el.dataset.act, k = el.dataset.k;
  if (a === 'an-toggle') anSet(k, !anOpen().has(k));
  else if (a === 'an-go') { anSet(k, true); const sec = document.getElementById('an-' + k); if (sec) { const red = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; setTimeout(() => sec.scrollIntoView({ block: 'start', behavior: red ? 'auto' : 'smooth' }), 30); const h = sec.querySelector('.an-h'); setTimeout(() => { try { h.focus({ preventScroll: true }); } catch (x) { } }, 350); } }
  else if (a === 'an-all') AN_SECS.forEach(s => anSet(s.id, true));
  else if (a === 'an-none') AN_SECS.forEach(s => anSet(s.id, false));
  else if (a === 'an-hist') {
    const M = anModel(); Object.assign(S.hist, { q: '', from: '', to: '', band: el.dataset.band || '', ctx: el.dataset.ctx || '', meal: '', mark: '', limit: 60 });
    if (M.curR) { S.hist.from = isoDate(new Date(M.curR[0])); S.hist.to = isoDate(new Date(M.curR[1])); } go('historico');
  } else if (a === 'an-preset') {
    const v = el.dataset.v, now = Date.now(), iso = ms => isoDate(new Date(ms)); let A, B;
    if (v === 'prev') { const M = anModel(); if (!M.curR) return; A = [M.curR[0], M.curR[1]]; B = [M.prevR[0], M.prevR[1]]; }
    else if (v === 'w30') { A = [startOfDay(addDays(now, -29)), now]; B = [startOfDay(addDays(now, -59)), startOfDay(addDays(now, -30))]; }
    else { const d = new Date(now), m0 = new Date(d.getFullYear(), d.getMonth(), 1).getTime(), p0 = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(); A = [m0, now]; B = [p0, m0 - DAY]; }
    S.ana.A = { from: iso(A[0]), to: iso(A[1]) }; S.ana.B = { from: iso(B[0]), to: iso(B[1]) }; anMemo = { key: '', M: null }; const c = document.getElementById('cmp'); if (c) c.innerHTML = compareCardHTML();
  }
});
