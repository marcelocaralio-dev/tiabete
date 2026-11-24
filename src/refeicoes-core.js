/* ================= Refeições e glicemia: lógica pura (sem DOM) =================
   Relaciona medições de glicemia às refeições já registradas no GLUXO (Refeição feita do Bolus, registros de glicemia com refeição/carboidratos).
   Regras:
   - só associa medição e refeição com EVIDÊNCIA: mesmo dia, mesmo tipo de refeição marcado pela pessoa, contexto "antes"/"depois" e janela de tempo;
     medição apenas próxima no horário, sem marcação, nunca é associada;
   - refeições com registro (log do Bolus ou registro com carboidratos/descrição/insulina) são diferenciadas de medições só classificadas como pré/pós;
   - carboidratos totais ≠ líquidos: o valor mostrado é o que o app já guarda (total do log; "informado" no registro de glicemia, sem reclassificar);
   - nada é estimado ou preenchido; sem amostra mínima não há padrão; nenhuma afirmação de causa; nenhuma sugestão de dose;
   - não altera nenhum dado nem cálculo do Bolus (só lê). */
const RFC = (typeof module !== 'undefined' && typeof require === 'function') ? require('./logic.js') : { LIM, mkTs, isoDate, DAY, norm };
const RF_MIN = 5;            /* mínimo de episódios com par antes/depois para comparar e para um padrão */
const RF_MIN_OCC = 3;        /* mínimo de ocorrências do fato observado para um padrão */
const RF_MIN_MEAN = 3;       /* mínimo para mostrar uma média (igual ao resto do app) */
const RF_PRE = [180, 15];    /* glicemia anterior: de 180 min antes até 15 min depois do horário da refeição */
const RF_POST = [30, 360];   /* glicemia posterior: de 30 min a 6 h depois */
const RF_GAP_SHORT = 60, RF_GAP_LONG = 300;
const RF_MEALS = [{ k: 'cafe', t: 'Café da manhã', s: 'Café' }, { k: 'almoco', t: 'Almoço', s: 'Almoço' }, { k: 'jantar', t: 'Jantar', s: 'Jantar' }, { k: 'lanche', t: 'Lanches', s: 'Lanche' }, { k: 'ceia', t: 'Ceia e outras', s: 'Ceia' }];
const rfMealName = k => (RF_MEALS.find(m => m.k === k) || { t: 'Outra' }).t;
const rfNorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const rfMean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const rfSd = a => { if (a.length < 2) return null; const m = rfMean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const rfMed = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
function rfCorr(xs, ys) {
  const n = xs.length; if (n < 3) return null; const mx = rfMean(xs), my = rfMean(ys); let a = 0, b = 0, c = 0;
  for (let i = 0; i < n; i++) { a += (xs[i] - mx) * (ys[i] - my); b += (xs[i] - mx) ** 2; c += (ys[i] - my) ** 2; }
  return b > 0 && c > 0 ? a / Math.sqrt(b * c) : null;
}
const rfWeekend = d => { const [y, m, dd] = d.split('-').map(Number), g = new Date(y, m - 1, dd).getDay(); return g === 0 || g === 6; };

/* ---------- entrada ---------- */
function rfReal(recs) { return (recs || []).filter(r => r && r.source !== 'exemplo' && r.example !== true && typeof r.glucose === 'number' && isFinite(r.glucose) && typeof r.ts === 'number'); }
function rfDedupeRecs(recs) {
  const seen = new Set(), out = []; let dup = 0;
  recs.slice().sort((a, b) => a.ts - b.ts).forEach(r => { const k = [r.date, r.noTime ? '' : r.time, r.glucose, r.context || '', r.meal || ''].join('|'); if (seen.has(k)) { dup++; return; } seen.add(k); out.push(r); });
  return { recs: out, dup };
}
function rfDedupeMeals(ms) {
  const seen = new Set(), out = []; let dup = 0;
  (ms || []).filter(m => m && typeof m.ts === 'number' && typeof m.net === 'number').slice().sort((a, b) => a.ts - b.ts).forEach(m => { const k = [m.date, m.time, m.meal, Math.round(m.net * 10)].join('|'); if (seen.has(k)) { dup++; return; } seen.add(k); out.push(m); });
  return { meals: out, dup };
}
/* mesma conta do Bolus (blCalc), usada só para reconhecer a composição; o app pode injetar a própria (opt.calc) */
function rfCalcDefault(foods) {
  const map = new Map((foods || []).map(f => [f.id, f]));
  return it => { const f = map.get(it.f); if (!f) return null; const k = f.basis === 'g' ? it.q / 100 : (it.u === 'g' && f.gpu > 0 ? it.q / f.gpu : it.q); const carb = f.carb * k, fiber = f.fiber * k; return { f, q: it.q, carb, fiber, net: Math.max(0, carb - fiber) }; };
}
function rfFoodsOf(log, bl, calc) {
  const plan = (bl && bl.days && bl.days[log.date] && bl.days[log.date][log.meal]) || null;
  let src = null, items = null;
  if (bl && bl.days && bl.days[log.date]) { if (plan && plan.length) { items = plan; src = 'dia'; } }
  else if (bl && bl.tpl) { const t = (rfWeekend(log.date) ? bl.tpl.fds : bl.tpl.sem) || {}; if (t[log.meal] && t[log.meal].length) { items = t[log.meal]; src = 'modelo'; } }
  if (!items) return null;
  const rows = items.map(it => calc(it)).filter(Boolean); if (!rows.length) return null;
  const net = rows.reduce((s, r) => s + r.net, 0); if (Math.abs(net - log.net) > 0.6) return null;   /* só aceita se o total bate com o registrado */
  return { src, rows: rows.map(r => ({ id: r.f.id, name: r.f.name, q: r.q, unit: r.f.basis === 'g' ? 'g' : (r.f.unit || 'un'), carb: r.carb, fiber: r.fiber, net: r.net, est: !!r.f.est })) };
}

/* ---------- episódios ---------- */
function rfBuild(records, bl, opt) {
  opt = opt || {}; const calc = opt.calc || rfCalcDefault(bl && bl.foods);
  const rr = rfDedupeRecs(rfReal(records)), recs = rr.recs, mm = rfDedupeMeals(bl && bl.meals), used = new Set(), eps = [];
  const sameMeal = (r, meal, date) => r.meal === meal && r.date === date && !r.noTime && r.time;
  const hasData = r => (r.carbs > 0) || (r.insMeal > 0) || !!(r.mealDesc && String(r.mealDesc).trim());
  const mk = o => Object.assign({ pre: null, post: null, posts: [], carbs: null, net: null, fiber: null, kcal: null, prot: null, fat: null, ui: null, insReg: false, foods: null, foodsSrc: null, desc: '', logId: null, timeApprox: false, flags: [] }, o);
  /* 1. refeições feitas (Bolus) com horário: escolhem a glicemia anterior marcada "antes" mais próxima */
  const anchors = [];
  mm.meals.forEach(m => {
    const ep = mk({ kind: 'log', meal: m.meal, date: m.date, ts: m.ts, time: m.time, logId: m.id, carbs: m.carb > 0 ? { v: m.carb, k: 'total' } : null, net: m.net, fiber: m.fiber, kcal: m.kcal, prot: m.prot, fat: m.fat, ui: typeof m.ui === 'number' ? m.ui : null });
    ep.insReg = ep.ui != null && ep.ui > 0;
    const fd = rfFoodsOf(m, bl, calc); if (fd) { ep.foods = fd.rows; ep.foodsSrc = fd.src; }
    eps.push(ep); if (m.time) anchors.push(ep); else ep.flags.push('sem-horario');
  });
  anchors.sort((a, b) => a.ts - b.ts).forEach(ep => {
    const c = recs.filter(r => !used.has(r.id) && r.context === 'antes' && sameMeal(r, ep.meal, ep.date) && r.ts >= ep.ts - RF_PRE[0] * 60000 && r.ts <= ep.ts + RF_PRE[1] * 60000);
    if (!c.length) return; c.sort((a, b) => Math.abs(a.ts - ep.ts) - Math.abs(b.ts - ep.ts)); ep.pre = c[0]; used.add(c[0].id); if (c.length > 1) ep.flags.push('varias-pre');
    if (c[0].insMeal > 0 || c[0].insCorr > 0) ep.insReg = true;
  });
  /* 2. medições "antes" que sobraram: refeição declarada no próprio registro ou apenas classificada */
  recs.filter(r => !used.has(r.id) && r.context === 'antes' && r.meal && !r.noTime && r.time).forEach(r => {
    const reg = hasData(r), ep = mk({ kind: reg ? 'registro' : 'classificada', meal: r.meal, date: r.date, ts: r.ts, time: r.time, pre: r, timeApprox: true, desc: r.mealDesc ? String(r.mealDesc).trim() : '' });
    if (r.carbs > 0) ep.carbs = { v: r.carbs, k: 'informado' }; ep.insReg = r.insMeal > 0 || r.insCorr > 0; if (r.insMeal > 0) ep.ui = r.insMeal;
    used.add(r.id); eps.push(ep); anchors.push(ep);
  });
  /* 3. glicemia posterior: marcada "depois", mesmo tipo e dia, 30 min a 6 h depois e antes da próxima refeição do mesmo tipo no dia */
  anchors.sort((a, b) => a.ts - b.ts); const byKey = new Map();
  anchors.forEach(a => { const k = a.meal + '|' + a.date; (byKey.get(k) || byKey.set(k, []).get(k)).push(a); });
  anchors.forEach(ep => {
    const sib = byKey.get(ep.meal + '|' + ep.date), nxt = sib.find(x => x.ts > ep.ts), lim = Math.min(ep.ts + RF_POST[1] * 60000, nxt ? nxt.ts : Infinity);
    const c = recs.filter(r => !used.has(r.id) && r.context === 'depois' && sameMeal(r, ep.meal, ep.date) && r.ts >= ep.ts + RF_POST[0] * 60000 && r.ts < lim).sort((a, b) => a.ts - b.ts);
    if (c.length) { ep.post = c[0]; ep.posts = c; c.forEach(r => used.add(r.id)); }
  });
  /* 4. posteriores sem refeição associada */
  recs.filter(r => !used.has(r.id) && r.context === 'depois' && r.meal && !r.noTime && r.time).forEach(r => { used.add(r.id); eps.push(mk({ kind: 'classificada', meal: r.meal, date: r.date, ts: r.ts, time: r.time, post: r, posts: [r], timeApprox: true })); });
  /* derivados e sinalizações */
  eps.forEach(ep => {
    ep.id = ep.kind + ':' + (ep.logId || (ep.pre ? ep.pre.id : ep.post ? ep.post.id : ep.ts));
    ep.complete = !!(ep.pre && ep.post);
    ep.delta = ep.complete ? ep.post.glucose - ep.pre.glucose : null;
    ep.gap = ep.complete ? Math.round((ep.post.ts - ep.pre.ts) / 60000) : null;
    ep.gapMeal = ep.post && !ep.timeApprox ? Math.round((ep.post.ts - ep.ts) / 60000) : null;
    ep.weekend = rfWeekend(ep.date);
    if (ep.foods) ep.sig = 'f:' + ep.foods.map(f => f.id).sort().join('+'); else if (ep.desc) ep.sig = 'd:' + rfNorm(ep.desc); else ep.sig = null;
    if (!ep.pre && ep.time !== '' && !ep.flags.includes('sem-horario')) ep.flags.push('sem-pre');
    if (!ep.post) ep.flags.push('sem-pos');
    if (!ep.carbs) ep.flags.push('sem-carb');
    if (ep.kind === 'classificada') ep.flags.push('so-classificada');
    if (ep.timeApprox) ep.flags.push('hora-aprox');
    if (ep.complete && (ep.gap < RF_GAP_SHORT || ep.gap > RF_GAP_LONG)) ep.flags.push(ep.gap < RF_GAP_SHORT ? 'intervalo-curto' : 'intervalo-longo');
    if (ep.kind === 'log' && !ep.foods && ep.net > 0) ep.flags.push('sem-alimentos');
  });
  eps.sort((a, b) => a.ts - b.ts);
  const noCtx = recs.filter(r => r.meal && !r.context).length, noTimeRecs = recs.filter(r => r.meal && (r.noTime || !r.time)).length;
  return { eps, dupRecs: rr.dup, dupMeals: mm.dup, noCtx, noTimeRecs, nRecs: recs.length };
}

/* ---------- filtros ---------- */
const rfFilterDefaults = () => ({ from: '', to: '', meal: '', food: '', cmin: '', cmax: '', ctx: '', ins: '', rep: false, origin: '' });
function rfFilterClean(o) {
  const d = rfFilterDefaults(); if (!o || typeof o !== 'object') return d; const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (iso.test(o.from || '')) d.from = o.from; if (iso.test(o.to || '')) d.to = o.to;
  if (RF_MEALS.some(m => m.k === o.meal)) d.meal = o.meal; if (typeof o.food === 'string') d.food = o.food.slice(0, 40);
  ['cmin', 'cmax'].forEach(k => { const v = parseFloat(String(o[k]).replace(',', '.')); if (isFinite(v) && v >= 0 && v <= 1000) d[k] = String(v); });
  if (o.ctx === 'sem' || o.ctx === 'fds') d.ctx = o.ctx; if (o.ins === 'sim' || o.ins === 'nao') d.ins = o.ins; d.rep = o.rep === true;
  if (['log', 'registro', 'classificada'].includes(o.origin)) d.origin = o.origin; return d;
}
function rfRepeatIds(eps) { const c = {}; eps.forEach(e => { if (e.sig) { const k = e.meal + '|' + e.sig; c[k] = (c[k] || 0) + 1; } }); return new Set(eps.filter(e => e.sig && c[e.meal + '|' + e.sig] >= 2).map(e => e.id)); }
function rfApply(eps, f) {
  f = rfFilterClean(f); const rep = f.rep ? rfRepeatIds(eps) : null, cmin = f.cmin !== '' ? +f.cmin : null, cmax = f.cmax !== '' ? +f.cmax : null;
  return eps.filter(e => {
    if (f.from && e.date < f.from) return false; if (f.to && e.date > f.to) return false; if (f.meal && e.meal !== f.meal) return false;
    if (f.origin && e.kind !== f.origin) return false; if (f.ctx && (f.ctx === 'fds') !== e.weekend) return false;
    if (f.ins === 'sim' && !e.insReg) return false; if (f.ins === 'nao' && e.insReg) return false;
    if (f.food && !(e.foods && e.foods.some(x => x.name === f.food))) return false;
    if (cmin != null || cmax != null) { if (!e.carbs) return false; if (cmin != null && e.carbs.v < cmin) return false; if (cmax != null && e.carbs.v > cmax) return false; }
    if (rep && !rep.has(e.id)) return false; return true;
  });
}

/* ---------- estatísticas ---------- */
function rfStats(eps) {
  const pairs = eps.filter(e => e.complete), pres = eps.filter(e => e.pre), posts = eps.filter(e => e.post), L = RFC.LIM;
  const pv = posts.map(e => e.post.glucose), dl = pairs.map(e => e.delta), gaps = pairs.map(e => e.gap), cv = eps.filter(e => e.carbs).map(e => e.carbs.v);
  const dist = { vlow: 0, low: 0, ok: 0, high: 0, vhigh: 0 }; pv.forEach(v => { dist[v < L.vlow ? 'vlow' : v < L.low ? 'low' : v <= L.high ? 'ok' : v <= L.vhigh ? 'high' : 'vhigh']++; });
  const fo = eps.filter(e => e.foods);
  return { n: eps.length, nPre: pres.length, nPost: posts.length, nPair: pairs.length, enough: pairs.length >= RF_MIN, hasMean: pairs.length >= RF_MIN_MEAN,
    preMean: rfMean(pairs.map(e => e.pre.glucose)), postMean: rfMean(pv), pairPostMean: rfMean(pairs.map(e => e.post.glucose)), deltaMean: rfMean(dl), deltaSd: rfSd(dl), deltaMin: dl.length ? Math.min(...dl) : null, deltaMax: dl.length ? Math.max(...dl) : null,
    postMin: pv.length ? Math.min(...pv) : null, postMax: pv.length ? Math.max(...pv) : null, postSd: rfSd(pv), gapMed: rfMed(gaps), gapMin: gaps.length ? Math.min(...gaps) : null, gapMax: gaps.length ? Math.max(...gaps) : null,
    lowN: pv.filter(v => v < L.low).length, highN: pv.filter(v => v > L.high).length, dist, lowIds: posts.filter(e => e.post.glucose < L.low).map(e => e.id), highIds: posts.filter(e => e.post.glucose > L.high).map(e => e.id),
    carbMean: rfMean(cv), carbN: cv.length, foodsN: fo.length, foodsMean: rfMean(fo.map(e => new Set(e.foods.map(f => f.id)).size)), itemsMean: rfMean(fo.map(e => e.foods.length)), insN: eps.filter(e => e.insReg).length, ids: eps.map(e => e.id) };
}
function rfByMeal(eps) { return RF_MEALS.map(m => ({ k: m.k, t: m.t, s: m.s, st: rfStats(eps.filter(e => e.meal === m.k)) })); }

/* ---------- carboidratos × variação ---------- */
const RF_BINS = [['até 29 g', v => v < 30], ['30 a 59 g', v => v >= 30 && v < 60], ['60 g ou mais', v => v >= 60]];
function rfCarbs(eps) {
  const mk = kind => {
    const all = eps.filter(e => e.carbs && e.carbs.k === kind), pr = all.filter(e => e.complete);
    const bins = RF_BINS.map(([l, f]) => { const a = pr.filter(e => f(e.carbs.v)); return { l, n: a.length, delta: a.length >= RF_MIN_MEAN ? rfMean(a.map(e => e.delta)) : null, post: a.length >= RF_MIN_MEAN ? rfMean(a.map(e => e.post.glucose)) : null, ids: a.map(e => e.id) }; });
    const dist = RF_BINS.map(([l, f]) => ({ l, n: all.filter(e => f(e.carbs.v)).length }));
    return { kind, n: all.length, nPair: pr.length, bins, dist, r: pr.length >= 10 ? rfCorr(pr.map(e => e.carbs.v), pr.map(e => e.delta)) : null, points: pr.map(e => [e.carbs.v, e.delta]), mean: rfMean(all.map(e => e.carbs.v)) };
  };
  return { total: mk('total'), informado: mk('informado') };   /* nunca misturados */
}

/* ---------- alimentos ---------- */
function rfFoodsFreq(eps) {
  const m = new Map(); const withF = eps.filter(e => e.foods);
  withF.forEach(e => new Set(e.foods.map(f => f.id)).forEach(id => { const f = e.foods.find(x => x.id === id); const o = m.get(id) || { id, name: f.name, eps: [] }; o.eps.push(e); m.set(id, o); }));
  return { base: withF.length, list: [...m.values()].map(o => { const pr = o.eps.filter(e => e.complete); return { id: o.id, name: o.name, n: o.eps.length, pct: o.eps.length / withF.length * 100, nPair: pr.length, delta: pr.length >= RF_MIN_MEAN ? rfMean(pr.map(e => e.delta)) : null, ids: o.eps.map(e => e.id) }; }).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'pt-BR')) };
}

/* ---------- grupos comparáveis ---------- */
function rfSigLabel(e) { if (e.sig && e.sig[0] === 'f') { const n = [...new Set(e.foods.map(f => f.name))]; return n.slice(0, 3).join(' + ') + (n.length > 3 ? ' +' + (n.length - 3) : ''); } return e.desc; }
function rfGroups(eps) {
  const out = [];
  RF_MEALS.forEach(m => { const a = eps.filter(e => e.meal === m.k); if (a.length) out.push({ id: 'm:' + m.k, kind: 'tipo', label: m.t, meal: m.k, eps: a }); });
  const sg = new Map(); eps.filter(e => e.sig).forEach(e => { const k = e.meal + '|' + e.sig; (sg.get(k) || sg.set(k, []).get(k)).push(e); });
  [...sg.entries()].filter(([, a]) => a.length >= 2).forEach(([k, a]) => out.push({ id: 's:' + k, kind: 'repetida', label: rfMealName(a[0].meal) + ': ' + rfSigLabel(a[0]), meal: a[0].meal, eps: a }));
  RF_MEALS.forEach(m => RF_BINS.forEach(([l, f], i) => { const a = eps.filter(e => e.meal === m.k && e.carbs && e.carbs.k === 'total' && f(e.carbs.v)); if (a.length) out.push({ id: 'c:' + m.k + ':' + i, kind: 'carbo', label: m.s + ' · ' + l + ' (totais)', meal: m.k, eps: a }); }));
  out.forEach(g => { g.st = rfStats(g.eps); }); return out;
}
function rfRepeated(eps) {
  return rfGroups(eps).filter(g => g.kind === 'repetida').map(g => { const pr = g.eps.filter(e => e.complete), dl = pr.map(e => e.delta), range = dl.length ? Math.max(...dl) - Math.min(...dl) : null;
    return { id: g.id, label: g.label, meal: g.meal, n: g.eps.length, nPair: pr.length, st: g.st, range, similar: pr.length >= RF_MIN_OCC ? (range <= 40 ? 'semelhante' : range > 80 ? 'variavel' : 'intermediario') : null, ids: g.st.ids }; }).sort((a, b) => b.n - a.n);
}
function rfCompare(A, B) {
  if (!A || !B) return null; const a = A.st, b = B.st, notes = [];
  if (a.nPair < RF_MIN || b.nPair < RF_MIN) notes.push(`Poucos episódios com par antes/depois (${a.nPair} e ${b.nPair}; o mínimo é ${RF_MIN}). Leia como registro, não como tendência.`);
  if (a.preMean != null && b.preMean != null && Math.abs(a.preMean - b.preMean) >= 30) notes.push(`A glicemia inicial média foi diferente (${Math.round(a.preMean)} e ${Math.round(b.preMean)} mg/dL): isso pesa na variação.`);
  if (a.gapMed != null && b.gapMed != null && Math.abs(a.gapMed - b.gapMed) >= 45) notes.push(`O intervalo típico entre as medições foi diferente (${Math.round(a.gapMed)} e ${Math.round(b.gapMed)} min).`);
  if (a.carbMean != null && b.carbMean != null && A.kind !== 'carbo' && Math.abs(a.carbMean - b.carbMean) >= 15) notes.push(`A quantidade média de carboidratos foi diferente (${Math.round(a.carbMean)} e ${Math.round(b.carbMean)} g).`);
  const dd = (x, y) => x != null && y != null ? x - y : null;
  return { A, B, notes, diff: { pre: dd(a.preMean, b.preMean), post: dd(a.pairPostMean, b.pairPostMean), delta: dd(a.deltaMean, b.deltaMean), carb: dd(a.carbMean, b.carbMean), gap: dd(a.gapMed, b.gapMed) } };
}

/* ---------- padrões (sempre com n, nunca causais) ---------- */
function rfPatterns(eps) {
  const out = [], by = rfByMeal(eps).filter(g => g.st.n), L = RFC.LIM;
  by.forEach(g => {
    const s = g.st;
    if (s.nPost >= RF_MIN && s.highN >= RF_MIN_OCC && s.highN / s.nPost >= .5) out.push({ k: 'elev', tone: 'high', meal: g.k, title: `Elevações depois de ${g.t.toLowerCase()}`, count: s.highN, universe: s.nPost, ids: s.highIds, text: `${s.highN} de ${s.nPost} medições depois de ${g.t.toLowerCase()} ficaram acima de ${L.high} mg/dL.` });
    if (s.nPost >= RF_MIN && s.lowN >= RF_MIN_OCC) out.push({ k: 'baixo', tone: 'low', meal: g.k, title: `Valores baixos depois de ${g.t.toLowerCase()}`, count: s.lowN, universe: s.nPost, ids: s.lowIds, text: `${s.lowN} de ${s.nPost} medições depois de ${g.t.toLowerCase()} ficaram abaixo de ${L.low} mg/dL.` });
  });
  const vg = by.filter(g => g.st.nPost >= RF_MIN && g.st.postSd != null);
  if (vg.length >= 2) { const top = vg.slice().sort((a, b) => b.st.postSd - a.st.postSd)[0], oth = rfMean(vg.filter(g => g !== top).map(g => g.st.postSd));
    if (top.st.postSd >= 30 && top.st.postSd >= oth * 1.25) out.push({ k: 'var', tone: 'info', meal: top.k, title: `Resultados mais variáveis em ${top.t.toLowerCase()}`, count: top.st.nPost, universe: top.st.nPost, ids: top.st.ids, text: `O desvio-padrão da glicemia depois de ${top.t.toLowerCase()} foi ${Math.round(top.st.postSd)} mg/dL, contra ${Math.round(oth)} nas demais refeições comparadas (${top.st.nPost} medições).` }); }
  rfRepeated(eps).filter(r => r.similar && r.nPair >= RF_MIN_OCC).forEach(r => {
    if (r.similar === 'semelhante') out.push({ k: 'rep-sem', tone: 'good', meal: r.meal, title: 'Refeição repetida com resultados parecidos', count: r.nPair, universe: r.n, ids: r.ids, text: `${r.label}: em ${r.nPair} repetições com par, a variação ficou entre ${r.st.deltaMin > 0 ? '+' : ''}${Math.round(r.st.deltaMin)} e ${r.st.deltaMax > 0 ? '+' : ''}${Math.round(r.st.deltaMax)} mg/dL.` });
    else if (r.similar === 'variavel') out.push({ k: 'rep-var', tone: 'info', meal: r.meal, title: 'Refeição repetida com resultados diferentes', count: r.nPair, universe: r.n, ids: r.ids, text: `${r.label}: em ${r.nPair} repetições com par, a variação foi de ${r.st.deltaMin > 0 ? '+' : ''}${Math.round(r.st.deltaMin)} a ${r.st.deltaMax > 0 ? '+' : ''}${Math.round(r.st.deltaMax)} mg/dL.` });
  });
  RF_MEALS.forEach(m => {
    const pr = eps.filter(e => e.meal === m.k && e.complete && e.foods); if (pr.length < RF_MIN * 2) return;
    const ids = new Map(); pr.forEach(e => new Set(e.foods.map(f => f.id)).forEach(id => ids.set(id, e.foods.find(f => f.id === id).name)));
    [...ids.entries()].forEach(([id, name]) => { const w = pr.filter(e => e.foods.some(f => f.id === id)), wo = pr.filter(e => !e.foods.some(f => f.id === id)); if (w.length < RF_MIN || wo.length < RF_MIN) return;
      const a = rfMean(w.map(e => e.delta)), b = rfMean(wo.map(e => e.delta)); if (Math.abs(a - b) >= 30) out.push({ k: 'alim', tone: 'info', meal: m.k, title: `${name} em ${m.t.toLowerCase()}`, count: w.length, universe: pr.length, ids: w.map(e => e.id), text: `Variação média de ${a > 0 ? '+' : ''}${Math.round(a)} mg/dL nos ${w.length} episódios com este alimento e ${b > 0 ? '+' : ''}${Math.round(b)} mg/dL nos ${wo.length} sem ele. Muita coisa muda entre as refeições; não indica causa.` }); });
  });
  return out;
}

/* ---------- qualidade dos dados ---------- */
function rfQuality(all, built) {
  const c = f => all.filter(f), q = {};
  q.total = all.length; q.semHorario = c(e => e.flags.includes('sem-horario')); q.semCarb = c(e => e.flags.includes('sem-carb')); q.semPre = c(e => e.flags.includes('sem-pre') && !e.flags.includes('sem-horario')); q.semPos = c(e => e.flags.includes('sem-pos'));
  q.intervalo = c(e => e.flags.includes('intervalo-curto') || e.flags.includes('intervalo-longo')); q.fraca = c(e => e.flags.includes('so-classificada') || e.flags.includes('sem-horario') || (e.timeApprox && !e.complete));
  q.semAlim = c(e => e.flags.includes('sem-alimentos')); q.variasPre = c(e => e.flags.includes('varias-pre'));
  q.dupRecs = built ? built.dupRecs : 0; q.dupMeals = built ? built.dupMeals : 0; q.semContexto = built ? built.noCtx : 0; q.recSemHora = built ? built.noTimeRecs : 0;
  q.byKind = { log: c(e => e.kind === 'log').length, registro: c(e => e.kind === 'registro').length, classificada: c(e => e.kind === 'classificada').length };
  q.complete = c(e => e.complete).length; return q;
}

/* ---------- modelo completo ---------- */
function rfModel(records, bl, filter, opt) {
  const built = rfBuild(records, bl, opt), f = rfFilterClean(filter), list = rfApply(built.eps, f), foods = new Set();
  built.eps.forEach(e => e.foods && e.foods.forEach(x => foods.add(x.name)));
  return { built, all: built.eps, list, filter: f, byMeal: rfByMeal(list), stats: rfStats(list), carbs: rfCarbs(list), foodsFreq: rfFoodsFreq(list), groups: rfGroups(list), repeated: rfRepeated(list), patterns: rfPatterns(list), quality: rfQuality(list, built), foodNames: [...foods].sort((a, b) => a.localeCompare(b, 'pt-BR')), hidden: built.eps.length - list.length };
}

if (typeof module !== 'undefined') module.exports = { RF_MIN, RF_MIN_OCC, RF_MIN_MEAN, RF_PRE, RF_POST, RF_GAP_SHORT, RF_GAP_LONG, RF_MEALS, RF_BINS, rfMealName, rfNorm, rfReal, rfDedupeRecs, rfDedupeMeals, rfCalcDefault, rfFoodsOf, rfBuild, rfFilterDefaults, rfFilterClean, rfApply, rfRepeatIds, rfStats, rfByMeal, rfCarbs, rfFoodsFreq, rfGroups, rfRepeated, rfCompare, rfPatterns, rfQuality, rfModel };
