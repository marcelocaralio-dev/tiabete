/* ===== Comparação entre períodos: amplia anCompare (analise-core.js). A = período analisado, B = referência. Lógica pura e descritiva. ===== */
const CPA = typeof module !== 'undefined' && typeof require === 'function' ? { ...require('./logic.js'), ...require('./analise-core.js'), rcModel: require('./recorrencia-core.js').rcModel } : { anCompare, anSummary, TIME_BLOCKS, MEALS, CONTEXTS, rcModel };
const CP_PRESETS = [['7', '7 × 7 dias'], ['14', '14 × 14 dias'], ['w30', '30 × 30 dias'], ['90', '90 × 90 dias'], ['6m', '6 × 6 meses'], ['mon', 'Este mês × anterior']];
const cpIso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const cpDate = iso => new Date(iso + 'T12:00:00'), cpAdd = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const cpLen = r => Math.round((cpDate(r[1]) - cpDate(r[0])) / 864e5) + 1;
function cpPreset(k, now) {
  const t = cpDate(cpIso(new Date(now))), y = t.getFullYear(), m = t.getMonth(), out = (a, b, c, d) => ({ A: { from: cpIso(a), to: cpIso(b) }, B: { from: cpIso(c), to: cpIso(d) } });
  if (k === 'mon') return out(new Date(y, m, 1, 12), t, new Date(y, m - 1, 1, 12), new Date(y, m, 0, 12));
  if (k === '6m') { /* dia limitado ao fim do mês (ex.: 31/08 − 6 meses) */
    const back = n => new Date(y, m - n, Math.min(t.getDate(), new Date(y, m - n + 1, 0).getDate()), 12), a = cpAdd(back(6), 1); return out(a, t, cpAdd(back(12), 1), cpAdd(a, -1));
  }
  const n = k === 'w30' ? 30 : +k; return out(cpAdd(t, 1 - n), t, cpAdd(t, 1 - 2 * n), cpAdd(t, -n));
}
const cpIn = (recs, r) => recs.filter(x => x.date >= r[0] && x.date <= r[1]);
const cpShare = (a, f) => a.length ? a.filter(f).length / a.length * 100 : 0;
const cpBlock = (r, b) => !r.noTime && !!r.time && +r.time.slice(0, 2) >= b.a && +r.time.slice(0, 2) < b.b;
function cpQuality(recs, range) {
  const len = cpLen(range), days = new Set(recs.map(r => r.date)).size, blocks = CPA.TIME_BLOCKS.map(b => ({ l: b.label, p: cpShare(recs, r => cpBlock(r, b)) }));
  const ctx = Object.entries(CPA.CONTEXTS).map(([k, l]) => ({ l, p: cpShare(recs, r => r.context === k) }));
  return { len, n: recs.length, days, empty: len - days, cover: days / len * 100, perDay: recs.length / len, blocks, ctx, hours: blocks.filter(b => b.p > 0).length, top: blocks.reduce((a, b) => b.p > a.p ? b : a),
    noTime: recs.filter(r => r.noTime || !r.time).length, noCtx: recs.filter(r => !r.context || r.context === 'outro').length };
}
function cpGroups(a, b) {
  const WD = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const defs = [['Horários', CPA.TIME_BLOCKS.map(t => [t.label, r => cpBlock(r, t)])], ['Depois das refeições', Object.entries(CPA.MEALS).map(([k, l]) => [l, r => r.meal === k && r.context === 'depois'])], ['Dias da semana', WD.map((l, i) => [l, r => cpDate(r.date).getDay() === i])], ['Contextos', Object.entries(CPA.CONTEXTS).map(([k, l]) => [l, r => r.context === k])]];
  return defs.map(([t, list]) => ({ t, items: list.map(([l, f]) => { const x = CPA.anSummary(a.filter(f)), y = CPA.anSummary(b.filter(f)), ok = x.n >= 3 && y.n >= 3; return { l, a: x, b: y, ok, d: ok ? x.mean - y.mean : null }; }).filter(i => i.a.n || i.b.n) }));
}
function cpClass(r) {
  if (r.a == null || r.b == null) return 'Sem dados';
  if (r.dir) return r.better === 'a' ? 'Melhorou' : r.better === 'b' ? 'Piorou' : 'Estável';
  return Math.abs(r.a - r.b) < (r.k === 'mean' || r.k === 'median' ? 3 : 0.5) ? 'Estável' : r.a > r.b ? 'Aumentou' : 'Diminuiu';
}
/* records: base completa; ra/rb: ['AAAA-MM-DD', 'AAAA-MM-DD'] */
function cpModel(records, ra, rb, o = {}) {
  const base = records, a = cpIn(base, ra), b = cpIn(base, rb), c = CPA.anCompare(a, b), qa = cpQuality(a, ra), qb = cpQuality(b, rb), limits = [], gap = (x, y) => Math.max(...x.map((v, i) => Math.abs(v.p - y[i].p)));
  if (!a.length || !b.length) limits.push('Um dos períodos não tem medições.');
  else if (Math.min(a.length, b.length) < 10) limits.push('Menos de 10 medições em um dos períodos.');
  if (a.length && b.length) {
    if (Math.max(qa.perDay, qb.perDay) / Math.min(qa.perDay, qb.perDay) >= 2) limits.push('A quantidade de medições por dia é muito diferente.');
    if (Math.abs(qa.cover - qb.cover) >= 25) limits.push('A proporção de dias com registro é muito diferente.');
    if (gap(qa.blocks, qb.blocks) >= 20) limits.push('A distribuição por horário é muito diferente.');
    if (gap(qa.ctx, qb.ctx) >= 20) limits.push('A distribuição por contexto é muito diferente.');
  }
  if (Math.abs(qa.len - qb.len) / Math.max(qa.len, qb.len) > .1) limits.push(`Durações diferentes: ${qa.len} e ${qb.len} dias.`);
  if (ra[0] <= rb[1] && rb[0] <= ra[1]) limits.push('Os períodos se sobrepõem.');
  const comparable = !limits.length, rows = c.rows.map(r => ({ ...r, cls: cpClass(r), d: r.a != null && r.b != null ? r.a - r.b : null, pct: !r.pp && r.u !== '%' && r.a != null && r.b ? (r.a - r.b) / r.b * 100 : null }));
  const groups = cpGroups(a, b), big = groups.flatMap(g => g.items.filter(i => i.ok && Math.abs(i.d) >= 10).map(i => ({ g: g.t, ...i }))).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 5);
  const rec = rs => new Map(CPA.rcModel(rs, o.rc || {}).list.map(p => [p.id, p])), A = rec(a), B = rec(b);
  const events = [...new Set([...A.keys(), ...B.keys()])].map(id => { const x = A.get(id), y = B.get(id); return { name: (x || y).name, a: x ? `${x.count}/${x.total}` : 'não atingiu o critério', b: y ? `${y.count}/${y.total}` : 'não atingiu o critério', w: Math.abs((x ? x.rate : 0) - (y ? y.rate : 0)) }; }).sort((x, y) => y.w - x.w).slice(0, 8);
  /* complementares: só o que foi registrado */
  const avg = v => v.length ? v.reduce((s, x) => s + x, 0) / v.length : null, per = (rs, fs) => avg([...rs.reduce((m, r) => { const v = fs.reduce((s, f) => s + (r[f] || 0), 0); if (v > 0) m.set(r.date, (m.get(r.date) || 0) + v); return m; }, new Map()).values()]);
  const extra = [['Insulina registrada por dia com registro (Ui)', ['insMeal', 'insCorr', 'insBasal']], ['Carboidratos informados por dia com registro (g)', ['carbs']]].map(([t, f]) => ({ t, a: per(a, f), b: per(b, f) }));
  const lab = r => (o.hba || []).filter(x => x.date >= r[0] && x.date <= r[1]).map(x => x.value);
  /* tendência: 6 períodos consecutivos com a duração de A, terminando no fim de A */
  const trend = Array.from({ length: 6 }, (_, i) => { const end = cpAdd(cpDate(ra[1]), -(5 - i) * qa.len), r = [cpIso(cpAdd(end, 1 - qa.len)), cpIso(end)]; return { r, ...CPA.anSummary(cpIn(base, r)) }; });
  const daily = (rs, r) => [...rs.reduce((m, x) => { const i = Math.round((cpDate(x.date) - cpDate(r[0])) / 864e5); (m.get(i) || m.set(i, []).get(i)).push(x.glucose); return m; }, new Map())].map(([i, v]) => [i, avg(v)]).sort((x, y) => x[0] - y[0]);
  return { ...c, ra, rb, rows, qa, qb, limits, comparable, groups, big, events, extra, labA: lab(ra), labB: lab(rb), trend, dA: daily(a, ra), dB: daily(b, rb), summary: cpSummary(rows, qa, qb, comparable), enough: a.length >= 3 && b.length >= 3 };
}
function cpSummary(rows, qa, qb, comparable) {
  if (qa.n < 3 || qb.n < 3) return 'Não há medições suficientes nos dois períodos para um resumo.';
  const g = k => rows.find(r => r.k === k), say = (k, nome) => { const r = g(k), s = Math.abs(r.d) < (k === 'mean' ? 3 : 2); return `${nome} ${s ? 'permaneceu semelhante' : r.d > 0 ? 'apresentou aumento' : 'apresentou redução'}`; };
  let t = `Em comparação com o período B, no período A ${say('mean', 'a média glicêmica')}, ${say('pLow', 'a proporção de medições abaixo da faixa')} e ${say('pHigh', 'a proporção acima da faixa')}.`;
  if (g('mean').d < -3 && g('pLow').d >= 2) t += ' A média menor veio acompanhada de mais valores baixos, portanto não é classificada como melhora.';
  t += qa.n === qb.n ? ' Os dois têm a mesma quantidade de registros.' : ` O período ${qa.n > qb.n ? 'A' : 'B'} tem mais registros (${qa.n} em A, ${qb.n} em B).`;
  return t + (comparable ? '' : ' As amostras não são equivalentes: leia as diferenças com ressalva.');
}
if (typeof module !== 'undefined') module.exports = { cpModel, cpPreset, cpLen };
