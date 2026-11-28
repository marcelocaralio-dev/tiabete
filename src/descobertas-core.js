/* ===== Central de descobertas: lógica pura (sem DOM) =====
   Camada de seleção, priorização e histórico SOBRE os mecanismos que já existem (recorrência, horários, comparação, correlação, refeições).
   Nada é recalculado aqui: dsAssemble recebe os resultados desses mecanismos e escolhe o que merece atenção.
   Regras: descrição de números do histórico (nunca causa, diagnóstico, risco, tratamento ou dose); sem evidência suficiente não há descoberta;
   a prioridade é de leitura e separa evidência estatística de importância do indicador; a IA é opcional (dsAiPayload só empacota os resultados). */
const DSN = typeof module !== 'undefined' && typeof require === 'function';
const DSE = DSN ? { ...require('./logic.js'), ...require('./analise-core.js'), ...require('./refeicoes-core.js'), ...require('./recorrencia-core.js'), ...require('./correlacao-core.js') } :
  { LIM, FAST, TIME_BLOCKS, DAY, anWindows, anSummary, anCompare, anTModel, anTDefaults, rfBuild, rfPatterns, rcModel, crModel, crText, crHeadline, crUnitList, CR_MEANING, CR_DISCLAIMER, CR_NODOSE, CR_MIN_N, CR_MIN_DAYS, RC_DEF };
const DS_MIN_N = 5, DS_MIN_DAYS = 3, DS_DAY = 864e5, DS_VER = 1, DS_MAX_LED = 800, DS_MAX_IDS = 300;
const DS_CATS = { recentes: 'Descobertas recentes', recorrentes: 'Padrões recorrentes', mudancas: 'Mudanças importantes', horarios: 'Horários relevantes', alimentacao: 'Alimentação', associacoes: 'Associações identificadas', evolucao: 'Evolução positiva ou negativa', insuficientes: 'Dados insuficientes' };
const DS_SRC = { rc: 'Padrões recorrentes', tm: 'Horários e períodos', cmp: 'Comparação entre períodos', cr: 'Associações entre variáveis', rf: 'Refeições e glicemia' };
const DS_W = { rec: .20, mag: .20, cons: .15, atu: .15, evid: .15, imp: .15 };   /* pesos da prioridade (soma 1) */
const dsF0 = x => Math.round(x).toLocaleString('pt-BR'), dsPct = x => dsF0(x) + '%', dsClamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const dsIsoD = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/* ---------- impressão digital (invalida o cache quando um registro é criado, editado ou excluído) ---------- */
function dsRecSig(r) {
  const s = [r.id, r.ts, r.time, r.noTime ? 1 : 0, r.glucose, r.context, r.meal, (r.marks || []).join(','), r.carbs, r.insMeal, r.insCorr, r.insBasal, r.actMin, r.actDesc, r.mealDesc].join('|');
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h >>> 0;
}
function dsFp(records, extra) {
  let h = 5381, n = 0; (records || []).forEach(r => { h = (h * 33 + dsRecSig(r)) % 4294967291; n++; });
  const e = JSON.stringify(extra || {}); for (let i = 0; i < e.length; i++) h = (h * 33 + e.charCodeAt(i)) % 4294967291;
  return n + '.' + h.toString(36);
}

/* ---------- item de descoberta ---------- */
function dsItem(o, ctx) {
  const ids = [...new Set(o.recIds || [])], recs = ids.map(i => ctx.byId.get(i)).filter(Boolean);
  const ts = recs.map(r => r.ts), days = recs.length ? new Set(recs.map(r => r.date)).size : (o.days || 0);
  const d = { tone: 'info', imp: .5, mag: .5, consv: .6, evidence: [], limits: [], also: [], tags: [], recIds: ids.slice(0, DS_MAX_IDS), recTotal: ids.length, n: o.n != null ? o.n : ids.length, days,
    first: ts.length ? Math.min(...ts) : (o.first || null), last: ts.length ? Math.max(...ts) : (o.last || null), compare: null, viz: null, hist: null, link: 'pad', freq: 'na', evo: 'estavel', kind: 'padrao', ...o };
  d.recIds = ids.slice(0, DS_MAX_IDS); d.recTotal = ids.length; if (!d.days) d.days = days; d.period = ctx.rl; d.cats = [d.cat, ...d.tags.filter(t => t !== d.cat)];
  d.key = [d.cat, d.sig, d.crit || 'det', ctx.range].join('|'); return d;
}
function dsScore(d, now) {
  const age = d.last ? (now - d.last) / DS_DAY : 999, atu = age <= 3 ? 1 : age <= 14 ? .8 : age <= 30 ? .6 : age <= 90 ? .35 : .15;
  const p = { rec: dsClamp(d.days / 8), mag: dsClamp(d.mag), cons: dsClamp(d.consv), atu, evid: dsClamp(Math.log10(d.n + 1) / Math.log10(60)), imp: dsClamp(d.imp) };
  const stat = (p.rec + p.mag + p.cons + p.evid) / 4;
  let score = 100 * Object.keys(DS_W).reduce((s, k) => s + DS_W[k] * p[k], 0);
  d.isolated = d.days < 5 || d.n < 8; if (d.isolated) score = Math.min(score, 58);       /* evento com pouca repetição nunca vai para o topo */
  d.parts = p; d.score = Math.round(score); d.stat = Math.round(stat * 100);
  d.tier = d.score >= 65 ? 'alta' : d.score >= 45 ? 'media' : 'baixa'; d.impTier = d.imp >= .8 ? 'alta' : d.imp >= .55 ? 'media' : 'baixa';
  d.consTxt = d.cons === 'alta' ? 'Padrão presente em boa parte das semanas e dos dias analisados.' : d.cons === 'media' ? 'Presença intermediária ao longo do período.' : 'Poucas semanas ou dias sustentam este resultado: leia com cautela.';
  return d;
}
const dsConsOf = v => v >= .6 ? 'alta' : v >= .35 ? 'media' : 'baixa';

/* ---------- adaptadores: um por mecanismo existente ---------- */
const DS_MEAL_POS = { cafe: 'poscafe', almoco: 'posalmoco', jantar: 'posjantar' };
function dsFromRc(rc, ctx, add) {
  (rc.list || []).forEach(p => {
    const band = p.band === 'low' ? 'low' : p.band === 'high' ? 'high' : p.type; let sig = p.id, m;
    if ((m = /^(hipo|hiper)-h(\d)$/.exec(p.id))) sig = `${band}|hora|${(+m[2]) * 4}`; else if ((m = /^(hipo|hiper)-d(\d)$/.exec(p.id))) sig = `${band}|dia|${m[2]}`;
    else if ((m = /^(hipo|hiper)-m(\w+)$/.exec(p.id)) && DS_MEAL_POS[m[2]]) sig = `${band}|ctx|${DS_MEAL_POS[m[2]]}`; else if ((m = /^(hipo|hiper)-e(.+)$/.exec(p.id))) sig = `${band}|marca|${m[2]}`; else if (/^(hipo|hiper)-ins$/.test(p.id)) sig = `${band}|ins`;
    const hora = /^(hipo|hiper)-h\d$/.test(p.id), cat = hora ? 'horarios' : p.cat === 'ali' ? 'alimentacao' : 'recorrentes', tags = [];
    if (['novo', 'aumento', 'queda', 'sumiu'].includes(p.k)) tags.push('mudancas');
    const ho = p.half.old, hr = p.half.rec, link = { tempo: 'tmp', ali: 'rfe', trat: 'ass', comp: 'ass', gli: 'pad' }[p.cat] || 'pad';
    add(dsItem({ src: 'rc', cat, tags, sig, crit: 'recorrencia', tone: p.band === 'low' ? 'low' : p.band === 'high' ? 'high' : 'info', title: p.name,
      text: `Foi observado em ${p.count} de ${p.total} ${p.unit} (${dsF0(p.rate)}%), em ${p.days} dias.`, recIds: p.recs.map(r => r.id), n: p.count, rate: p.rate, freq: p.freq, evo: p.k, mag: p.rate / 60, consv: p.weeks / 100, cons: p.cons,
      imp: p.type === 'hipo' ? 1 : p.type === 'hiper' ? .8 : p.type === 'regularidade' ? .5 : .6, link, hist: p.type === 'hipo' ? { band: 'baixa' } : p.type === 'hiper' ? { band: 'alta' } : null,
      evidence: [`${p.count} de ${p.total} ${p.unit} (${dsF0(p.rate)}%)`, `presente em ${dsF0(p.weeks)}% das semanas analisadas`, p.other ? `nos demais dias: ${dsF0(p.other.rate)}% de ${p.other.n} dias` : ''].filter(Boolean),
      criteria: `${p.crit} Mínimo de ${ctx.rcMin} ocorrências em ${ctx.rcMin} dias.`, limits: ['Dias sem registro não contam como ausência do evento.', 'Ocorrer repetidamente não indica a causa.'],
      compare: ho[1] && hr[1] ? { label: 'metade antiga do período × metade recente', prev: ho[0] / ho[1] * 100, cur: hr[0] / hr[1] * 100, unit: '%' } : null,
      viz: { months: p.months, blocks: p.blocks }, also: p.also || [] }, ctx));
  });
}
function dsFromTm(T, src, ctx, add) {
  if (!T || !T.hl) return;
  T.hl.forEach(h => {
    if (h.id === 'mais') return; const g = T.all.find(x => x.k === h.k); if (!g) return;
    const key = src === 'hora' ? h.k.slice(1) : h.k, loc = src === 'hora' ? 'hora|' + key : 'ctx|' + key;
    const map = { baixas: ['low|' + loc, 'horarios', 'low', 1, g.s.lowPct / 50], altas: ['high|' + loc, 'horarios', 'high', .8, g.s.highPct / 60], variab: ['var|' + loc, 'horarios', 'info', .6, (g.s.cv || 0) / 50], melhor: ['bom|' + loc, 'horarios', 'good', .4, g.s.pIn / 100], mudanca: ['mean|' + loc, 'mudancas', 'info', .5, g.p && g.p.mean ? Math.abs(g.s.mean - g.p.mean) / 40 : .3] }[h.id];
    if (!map) return; const [sig, cat, tone, imp, mag] = map;
    add(dsItem({ src: 'tm', cat, tags: cat === 'mudancas' ? ['horarios'] : [], sig, crit: h.id, tone, title: h.title + ' · ' + h.t, text: h.text, recIds: h.recIds, n: h.recIds.length, mag, imp, consv: dsClamp(g.s.days / 10), cons: dsConsOf(dsClamp(g.s.days / 10)),
      evidence: h.evidence, criteria: 'Períodos com ao menos 5 medições em 2 ou mais dias; uma medição isolada nunca é destacada.', link: 'tmp', hist: h.id === 'baixas' ? { band: 'baixa' } : h.id === 'altas' ? { band: 'alta' } : null,
      compare: g.p && g.p.enough && g.s.enough ? { label: 'média no período anterior × atual', prev: g.p.mean, cur: g.s.mean, unit: 'mg/dL' } : null,
      limits: ['Proporções são de medições, não de tempo na faixa.', 'Não indica causa, melhora ou piora clínica.'] }, ctx));
  });
}
const DS_EVO = { cv: [15, '%'], sd: [25, ' mg/dL'], pIn: [20, ' pp'], pLow: [10, ' pp'], pHigh: [20, ' pp'], ep: [2, ''] };
function dsFromCmp(c, ctx, add) {
  if (!c || !c.enough || c.A.n < 10 || c.B.n < 10 || c.A.days < DS_MIN_DAYS || c.B.days < DS_MIN_DAYS) return;
  const warn = c.warn || [], cons = warn.length === 0 ? 'alta' : warn.length === 1 ? 'media' : 'baixa', base = { src: 'cmp', n: c.A.n + c.B.n, days: Math.min(c.A.days, c.B.days), first: ctx.curR ? ctx.curR[0] : null, last: ctx.curR ? ctx.curR[1] : ctx.now, cons, consv: cons === 'alta' ? .9 : cons === 'media' ? .55 : .3, link: 'comp',
    criteria: 'Período atual comparado ao anterior de mesmo tamanho (mínimo de 10 medições e 3 dias em cada).', limits: warn.concat(['Descreve números dos dois períodos; não indica a causa da mudança.']), evidence: [`período atual: ${c.A.n} medições em ${c.A.days} dias`, `período anterior: ${c.B.n} medições em ${c.B.days} dias`] };
  c.rows.forEach(r => {
    if (!r.better || r.a == null || r.b == null || !DS_EVO[r.k]) return; const [sc, u] = DS_EVO[r.k], good = r.better === 'a', dd = r.a - r.b, pp = r.pp, dec = r.dec;
    add(dsItem({ ...base, cat: 'evolucao', tags: ['mudancas'], sig: 'evo|' + r.k, crit: 'delta', tone: good ? 'good' : 'warn', title: `${r.t}: ${good ? 'evolução positiva' : 'evolução negativa'}`,
      text: `${r.t}: ${r.b.toLocaleString('pt-BR', { maximumFractionDigits: dec })}${r.u === '%' ? '%' : ''} → ${r.a.toLocaleString('pt-BR', { maximumFractionDigits: dec })}${r.u === '%' ? '%' : ''} em relação ao período anterior${pp ? ` (${dd > 0 ? '+' : '−'}${Math.abs(dd).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} pontos percentuais)` : ''}.`,
      mag: Math.abs(dd) / sc, imp: r.k === 'pLow' || r.k === 'ep' ? 1 : r.k === 'pHigh' ? .8 : .7, compare: { label: 'período anterior × atual', prev: r.b, cur: r.a, unit: r.u || '' },
      explain: 'A direção (positiva ou negativa) segue o significado de cada indicador: mais medições na faixa e menos variabilidade, valores baixos ou elevados são lidos como positivos. É uma descrição dos números.' }, ctx));
  });
  const mean = c.rows.find(r => r.k === 'mean'), pl = c.rows.find(r => r.k === 'pLow');
  if (mean && mean.d != null && Math.abs(mean.d) >= 10) add(dsItem({ ...base, cat: 'mudancas', sig: 'mean|geral', crit: 'delta', tone: 'info', title: `Média ${mean.d > 0 ? 'mais alta' : 'mais baixa'} que no período anterior`,
    text: `Média de ${dsF0(mean.b)} → ${dsF0(mean.a)} mg/dL (${mean.d > 0 ? '+' : '−'}${dsF0(Math.abs(mean.d))} mg/dL).${mean.d < 0 && pl && pl.d >= 2 ? ' A média menor veio com mais valores baixos, por isso não é classificada como melhora.' : ''}`, mag: Math.abs(mean.d) / 40, imp: .5, compare: { label: 'período anterior × atual', prev: mean.b, cur: mean.a, unit: 'mg/dL' } }, ctx));
  const perA = c.A.n / Math.max(1, c.A.spanDays), perB = c.B.n / Math.max(1, c.B.spanDays);
  if (perB > 0 && Math.abs(perA - perB) / perB >= .5) add(dsItem({ ...base, cat: 'mudancas', sig: 'freq|medicoes', crit: 'delta', tone: 'info', title: `Frequência de medições ${perA > perB ? 'aumentou' : 'diminuiu'}`,
    text: `${perB.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} → ${perA.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} medições por dia entre os períodos. Isto pode alterar as médias sem mudança real.`, mag: Math.abs(perA - perB) / Math.max(perA, perB), imp: .3, compare: { label: 'medições por dia, anterior × atual', prev: perB, cur: perA, unit: '' } }, ctx));
}
function dsFromCr(cr, ctx, add, seen) {
  const A = cr && cr.auto; if (!A) return;
  const hasVar = () => [...seen.keys()].some(s => s.startsWith('var|')), hasAtiv = () => [...seen.keys()].some(s => /marca\|_ativ/.test(s));
  A.highlights.map(r => [r, 'destaque']).concat(A.exploratory.map(r => [r, 'explor'])).forEach(([r, tier]) => {
    if ((r.topic === 'variab-periodo' && hasVar()) || (r.topic === 'atividade-dia' && hasAtiv())) return;
    const ids = r.kind === 'corr' ? r.points.map(p => p.rec[0]) : r.points.map(p => p.rec[0]), corr = r.kind === 'corr', ex = tier === 'explor';
    add(dsItem({ src: 'cr', cat: r.cat === 'ali' ? 'alimentacao' : 'associacoes', sig: 'assoc|' + r.id, crit: corr ? 'correlacao' : 'grupos', kind: corr ? 'correlacao' : 'grupos', tone: 'info', title: DSE.crHeadline(r), text: DSE.crText(r), recIds: ids.filter(Boolean), n: r.n,
      mag: (r.idx || 0) / .7, imp: .5, consv: (ex ? .45 : .8) * (r.unstable ? .5 : 1), cons: ex ? 'media' : 'alta', link: 'ass', hist: null,
      evidence: [`${r.n} observações`, `método: ${r.method}`, r.q != null ? `taxa de falsas descobertas (q) = ${r.q.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}` : '', ex ? 'exploratória: não sobrevive à correção para múltiplas comparações' : 'sobrevive à correção para múltiplas comparações'].filter(Boolean),
      criteria: `Associação com intensidade mínima de ${DSE.CR_IDX_MIN || .3} e controle de falsas descobertas; mínimo de ${DSE.CR_MIN_N} observações em ${DSE.CR_MIN_DAYS} dias.`, explain: DSE.CR_MEANING[r.method] || '',
      limits: (r.limits || []).concat([DSE.CR_DISCLAIMER], r.noDose ? [DSE.CR_NODOSE] : [], ex ? ['Resultado exploratório: pode ser coincidência.'] : []),
      viz: corr ? { scatter: r.points.slice(0, 80).map(p => [p.x, p.y]), xl: r.xl, yl: r.yl } : null, ex }, ctx));
  });
}
function dsFromRf(pats, ctx, add) {
  (pats || []).forEach(p => {
    const sig = p.k === 'elev' ? `high|ctx|${DS_MEAL_POS[p.meal] || p.meal}` : p.k === 'baixo' ? `low|ctx|${DS_MEAL_POS[p.meal] || p.meal}` : `rf|${p.k}|${p.meal}|${p.title.slice(0, 30)}`;
    add(dsItem({ src: 'rf', cat: 'alimentacao', sig, crit: p.k, tone: p.tone, title: p.title, text: p.text, recIds: p.ids || [], n: p.count, mag: p.universe ? p.count / p.universe : .4, imp: p.k === 'baixo' ? 1 : p.k === 'elev' ? .8 : .5, consv: .55, cons: 'media', link: 'rfe', hist: p.k === 'baixo' ? { band: 'baixa', ctx: 'depois' } : p.k === 'elev' ? { band: 'alta', ctx: 'depois' } : { ctx: 'depois' },
      evidence: [`${p.count} ocorrências em ${p.universe} episódios`], criteria: 'Episódios de refeição ligados a medições antes e depois (Refeições e glicemia).', limits: ['Muita coisa muda entre as refeições; não indica causa.', 'Não calcula nem sugere dose.'] }, ctx));
  });
}

/* ---------- lacunas ("dados insuficientes") ---------- */
function dsGaps(inp, dq) {
  const g = [], cr = inp.cr, W = inp.W;
  if (dq.n && dq.timedShare < .7) g.push({ area: 'Horários e períodos do dia', have: `${dsF0(dq.timedShare * 100)}% das medições têm horário`, need: 'Registrar o horário nas medições permite destacar períodos do dia.' });
  if (!W.prev) g.push({ area: 'Comparação entre períodos', have: 'sem período anterior', need: 'Com “Tudo” não existe período anterior; escolha 7, 14, 30, 90 ou 180 dias.' });
  else if (W.prev.length < 10) g.push({ area: 'Comparação entre períodos', have: `${W.prev.length} medições no período anterior`, need: 'São necessárias ao menos 10 medições em 3 dias no período anterior.' });
  const U = { refeicao: 'Refeições com antes e depois', insulina: 'Insulina registrada e variação', atividade: 'Atividade física e glicemia', dia: 'Dias com e sem eventos', basal: 'Insulina basal e jejum' };
  Object.keys(U).forEach(k => { const u = cr && cr.units && cr.units[k]; if (!u) g.push({ area: U[k], have: 'nenhum registro', need: `Registrar ${k === 'atividade' ? 'atividades' : k === 'refeicao' ? 'refeições com carboidratos e medições antes e depois' : k === 'dia' ? 'medições em mais dias' : 'doses de insulina'} para habilitar esta análise.` }); else if (!(u.n >= DSE.CR_MIN_N && u.days >= DSE.CR_MIN_DAYS)) g.push({ area: U[k], have: `${u.n} observações em ${u.days} dias`, need: `Mínimo de ${DSE.CR_MIN_N} observações em ${DSE.CR_MIN_DAYS} dias diferentes.` }); });
  return g;
}

/* ---------- montagem ---------- */
function dsAssemble(inp) {
  const { W, now } = inp, range = inp.range, cur = W.cur, byId = new Map(cur.map(r => [r.id, r])), rl = range === 'all' ? 'todo o histórico' : 'últimos ' + range + ' dias';
  const days = new Set(cur.map(r => r.date)).size, timed = cur.filter(r => !r.noTime && r.time).length, dq = { n: cur.length, days, timedShare: cur.length ? timed / cur.length : 1, noCtx: cur.filter(r => !r.context || r.context === 'outro').length };
  const ctx = { byId, rl, range, now, curR: W.curR, rcMin: (inp.rc && inp.rc.crit && inp.rc.crit.minOcc) || 3 }, base = { rl, range, dq, gaps: [], list: [], why: '', dropped: 0, now };
  base.gaps = dsGaps(inp, dq);
  if (cur.length < 20 || days < 5) { base.why = `Para mostrar descobertas são necessárias ao menos 20 medições em 5 dias diferentes. Há ${cur.length} em ${days}.`; return base; }
  const seen = new Map(), push = d => {
    if (!d) return; const need = d.src === 'cr' ? DSE.CR_MIN_N : DS_MIN_N; if (d.n < need || d.days < DS_MIN_DAYS && d.src !== 'cmp') { base.dropped++; return; }
    const o = seen.get(d.sig); if (o) { if (!o.also.includes(DS_SRC[d.src]) && d.src !== o.src) o.also.push(DS_SRC[d.src]); return; } seen.set(d.sig, d);
  };
  dsFromRc(inp.rc || { list: [] }, ctx, push); dsFromTm(inp.tmHora, 'hora', ctx, push); dsFromTm(inp.tmCtx, 'ctx', ctx, push); dsFromCmp(inp.cmp, ctx, push); dsFromRf(inp.rfp, ctx, push); dsFromCr(inp.cr, ctx, push, seen);
  const list = [...seen.values()].map(d => dsScore(d, now)).sort((a, b) => (a.isolated - b.isolated) || b.score - a.score || b.n - a.n);
  base.list = list; if (!list.length) base.why = 'Com os registros deste período não há nenhum destaque claro. Isso é normal quando os valores estão distribuídos de forma uniforme: não são criadas descobertas para preencher a tela.';
  return base;
}
/* Execução completa (testes e uso sem a interface): roda os mecanismos existentes e monta a central. */
function dsCompute(records, o = {}) {
  const now = o.now || Date.now(), range = String(o.range || '30'), W = DSE.anWindows(records, range, now), bl = o.bl || { meals: [] }, calc = o.calc;
  const rf = DSE.rfBuild(W.cur, bl, { calc }), rc = DSE.rcModel(W.cur, { marks: o.marks || {}, crit: { minOcc: 3, minDays: 3 }, eps: rf.eps });
  const cr = DSE.crModel(W.cur, { bl, calc, inslog: o.inslog || [], events: o.events || [], hba: o.hba || [] });
  return dsAssemble({ W, now, range, rc, cr, rfp: DSE.rfPatterns(rf.eps), cmp: W.prev ? DSE.anCompare(W.cur, W.prev) : null, ...dsTm(W, now) });
}
function dsTm(W, now) { const d = DSE.anTDefaults(); return { tmCtx: DSE.anTModel(W.base, { ...d, src: 'ctx', range: 'tela' }, now, W), tmHora: DSE.anTModel(W.base, { ...d, src: 'hora', step: 4, range: 'tela' }, now, W) }; }

/* ---------- histórico (nunca apaga em silêncio) ---------- */
const dsLedgerNew = () => ({ v: DS_VER, runs: 0, items: {}, trimmed: 0 });
function dsReconcile(led, res, now) {
  let changed = false; const L = led && led.items ? led : dsLedgerNew(), known = L.runs > 0, seen = new Set(), ch = [];
  res.list.forEach(d => {
    seen.add(d.key); let e = L.items[d.key]; const snap = { t: now, n: d.n, score: d.score, tier: d.tier };
    if (!e) { e = L.items[d.key] = { key: d.key, cat: d.cat, title: d.title, sig: d.sig, range: res.range, firstSeen: now, lastSeen: now, status: 'ativa', tier: d.tier, tierPrev: null, tierChangedAt: null, snaps: [snap], first: d.first, last: d.last }; d.isNew = known; d.sit = known ? 'novo' : d.evo; changed = true; ch.push(['nova', d.key]); }
    else {
      d.isNew = false; d.sit = d.evo;
      if (e.status === 'ausente') { e.status = 'ativa'; e.absentSince = null; e.returnedAt = now; d.sit = 'volta'; changed = true; ch.push(['volta', d.key]); }
      if (e.tier !== d.tier) { e.tierPrev = e.tier; e.tier = d.tier; e.tierChangedAt = now; changed = true; ch.push(['tier', d.key]); }
      const ls = e.snaps[e.snaps.length - 1];
      if (!ls || ls.n !== d.n || ls.score !== d.score || now - ls.t > 7 * DS_DAY) { e.snaps.push(snap); if (e.snaps.length > 12) e.snaps.splice(1, e.snaps.length - 12); changed = true; }
      if (now - e.lastSeen > 12 * 36e5) { e.lastSeen = now; changed = true; } e.title = d.title; e.first = d.first; e.last = d.last;
    }
    d.firstSeen = e.firstSeen; d.lastUpdate = e.lastSeen; d.tierPrev = e.tierPrev; d.tierChangedAt = e.tierChangedAt; d.returned = !!(e.returnedAt && d.sit === 'volta');
    if (d.sit === 'sumiu') d.gone = true;
    const rec = d.first && now - d.first <= 21 * DS_DAY; if ((d.isNew || d.evo === 'novo' || rec) && !d.cats.includes('recentes')) d.cats.push('recentes');
  });
  Object.values(L.items).forEach(e => { if (e.range === res.range && e.status === 'ativa' && !seen.has(e.key)) { e.status = 'ausente'; e.absentSince = now; changed = true; ch.push(['ausente', e.key]); } });
  const all = Object.values(L.items); if (all.length > DS_MAX_LED) { all.filter(e => e.status === 'ausente').sort((a, b) => a.lastSeen - b.lastSeen).slice(0, all.length - DS_MAX_LED).forEach(e => { delete L.items[e.key]; L.trimmed++; }); changed = true; }
  if (changed || !L.runs) L.runs++; return { led: L, changed, changes: ch };
}

/* ---------- resumo, filtros, linha do tempo, cache e IA ---------- */
function dsSummary(res) {
  const L = res.list, c = k => L.filter(d => d.cats.includes(k)).length, watch = L.filter(d => (d.tier !== 'baixa' && d.imp >= .8 && d.tone !== 'good') || (d.cat === 'evolucao' && d.tone === 'warn'));
  const s = { total: L.length, novas: L.filter(d => d.cats.includes('recentes')).length, mudancas: c('mudancas'), recorrentes: L.filter(d => d.src === 'rc').length, associacoes: L.filter(d => d.src === 'cr').length, acompanhar: watch.length, nomes: watch.slice(0, 3).map(d => d.title), insuficientes: res.gaps.length };
  s.texto = !L.length ? (res.why || 'Sem descobertas por enquanto.') : `${s.total} descoberta${s.total > 1 ? 's' : ''} com evidência suficiente neste período${s.novas ? `, ${s.novas} recente${s.novas > 1 ? 's' : ''}` : ''}${s.mudancas ? `, ${s.mudancas} mudança${s.mudancas > 1 ? 's' : ''} entre períodos` : ''}.`; return s;
}
function dsFilter(list, f) {
  f = f || {}; const now = f.now || Date.now();
  return list.filter(d => (!f.cat || d.cats.includes(f.cat)) && (!f.rel || d.tier === f.rel) && (!f.rec || d.freq === f.rec) && (!f.tipo || d.kind === f.tipo)
    && (!f.per || (d.last && now - d.last <= +f.per * DS_DAY)) && (!f.nov || (f.nov === 'novas' ? d.cats.includes('recentes') : !d.cats.includes('recentes'))) && (!f.sit || d.sit === f.sit || (f.sit === 'estavel' && (!d.sit || d.sit === 'estavel'))));
}
function dsTimeline(recs) {
  if (!recs.length) return []; const ts = recs.map(r => r.ts), a = Math.min(...ts), z = Math.max(...ts), day = z - a <= 28 * DS_DAY, step = day ? DS_DAY : 7 * DS_DAY, m = new Map();
  recs.forEach(r => { const k = Math.floor((r.ts - a) / step); m.set(k, (m.get(k) || 0) + 1); }); const n = Math.floor((z - a) / step) + 1, out = [];
  for (let i = 0; i < Math.min(n, 60); i++) out.push({ t: a + i * step, n: m.get(i) || 0 }); return { unit: day ? 'dia' : 'semana', pts: out };
}
function dsLight(res) { return { ...res, list: res.list.map(d => ({ ...d, recIds: d.recIds.slice(0, DS_MAX_IDS) })) }; }
/* Pacote para uma explicação futura por IA: só resultados já calculados, cada um com a origem verificável. Não cria números nem descobertas. */
function dsAiPayload(res) { return { regra: 'Explique apenas o que está nestes resultados. Não invente números, descobertas ou associações. Não dê diagnóstico, tratamento ou dose.', periodo: res.rl, descobertas: res.list.map(d => ({ id: d.key, titulo: d.title, texto: d.text, n: d.n, dias: d.days, origem: DS_SRC[d.src], evidencias: d.evidence, limites: d.limits })) }; }

if (typeof module !== 'undefined') module.exports = { DS_CATS, DS_SRC, DS_W, DS_MIN_N, DS_MIN_DAYS, dsRecSig, dsFp, dsItem, dsScore, dsAssemble, dsCompute, dsTm, dsLedgerNew, dsReconcile, dsSummary, dsFilter, dsTimeline, dsLight, dsAiPayload, dsGaps };
