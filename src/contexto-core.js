/* ================= GLUXO Experience 05 · Inteligência contextual: lógica pura (sem DOM) =================
   Tudo é local e determinístico: nenhuma chamada externa, nenhum dado inventado. Reaproveita as funções da Análise (anSummary, anCompare,
   anPairs, anRecurrence, anAssociations) e de logic.js (stats, trend, hypoEpisodes, limites LIM/FAST), então os números são os mesmos do resto do app.
   Regras:
   - só registros reais (exemplos e duplicatas exatas ficam de fora; nada é gravado nem alterado aqui);
   - cada observação traz período, quantidade de medições, critério, limitações e os ids dos registros que a originaram;
   - sem amostra mínima não há observação (a função devolve a razão em "why"); ausência de registros nunca é lida como melhora ou piora;
   - descreve associações estatísticas, nunca causa; não diagnostica, não sugere dose, medicamento nem ajuste de tratamento;
   - não toca em alertas glicêmicos, metas, limites nem cálculos clínicos. */
const CXN = typeof module !== 'undefined' && typeof require === 'function';
const CXL = CXN ? require('./logic.js') : { LIM, FAST, stats, bandCounts, mkTs, isoDate, startOfDay, endOfDay, addDays, inRange, groupBy, trend, hypoEpisodes, DAY };
const CXA = CXN ? require('./analise-core.js') : { anSummary, anCompare, anPairs, anRecurrence, anAssociations };
const CX_MIN_N = 10, CX_MIN_D = 4;          /* janela mínima para qualquer observação: 10 medições em 4 dias diferentes */
const CX_MIN_P = 5;                          /* mínimo de medições por período do dia / por grupo comparado */
const CX_PERIODS = [{ k: 'manha', t: 'manhã', a: 5, b: 12 }, { k: 'tarde', t: 'tarde', a: 12, b: 18 }, { k: 'noite', t: 'noite', a: 18, b: 24 }];
const CX_DAY = 86400000;
const cxF = (x, d = 0) => x == null || !isFinite(x) ? '—' : (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const cxMean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const cxSd = a => { if (a.length < 2) return null; const m = cxMean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const cxP2 = n => String(n).padStart(2, '0');
const cxDM = ms => { const d = new Date(ms); return cxP2(d.getDate()) + '/' + cxP2(d.getMonth() + 1); };
const cxDMH = ms => { const d = new Date(ms); return cxDM(ms) + ' ' + cxP2(d.getHours()) + ':' + cxP2(d.getMinutes()); };
const cxRange = r => r ? cxDM(r[0]) + ' a ' + cxDM(r[1]) : '';
const cxHi = r => (r && r.context === 'jejum') ? CXL.FAST.high : CXL.LIM.high;
const cxHour = r => (r.noTime || !r.time) ? null : parseInt(String(r.time).slice(0, 2), 10);
const cxDays = a => new Set(a.map(r => r.date)).size;
const cxIds = a => a.map(r => r.id);
const cxAgo = ms => { const h = Math.max(0, Math.round(ms / 3600e3)); return h < 48 ? h + (h === 1 ? ' hora' : ' horas') : Math.round(h / 24) + ' dias'; };

/* Registros válidos para análise: reais, com valor e instante válidos e sem duplicata exata. Devolve também o que ficou de fora (qualidade dos dados). */
function cxClean(records, now) {
  const raw = (records || []).filter(r => r && r.source !== 'exemplo' && r.example !== true);
  const lim = (now || Date.now()) + CX_DAY;
  const valid = raw.filter(r => typeof r.glucose === 'number' && isFinite(r.glucose) && r.glucose >= 10 && r.glucose <= 1000 && typeof r.ts === 'number' && isFinite(r.ts) && r.ts <= lim);
  const seen = new Set(), recs = []; let dup = 0;
  valid.slice().sort((a, b) => a.ts - b.ts).forEach(r => { const k = [r.date, r.noTime ? '' : r.time, r.glucose, r.context || '', r.meal || ''].join('|'); if (seen.has(k)) { dup++; return; } seen.add(k); recs.push(r); });
  return { recs, dup, invalid: raw.length - valid.length, noTime: recs.filter(r => r.noTime || !r.time).length };
}
function cxWin(recs, days, now) {
  const c0 = CXL.startOfDay(CXL.addDays(now, -(days - 1))), c1 = CXL.endOfDay(now), p1 = c0 - 1, p0 = CXL.startOfDay(CXL.addDays(c0, -days));
  return { cur: CXL.inRange(recs, c0, c1), prev: CXL.inRange(recs, p0, p1), curR: [c0, c1], prevR: [p0, p1] };
}
const cxWhy = (n, d, days) => n ? `Há ${n} ${n === 1 ? 'medição' : 'medições'} em ${d} ${d === 1 ? 'dia' : 'dias'} nos últimos ${days} dias. Para gerar observações são necessárias ao menos ${CX_MIN_N} medições em ${CX_MIN_D} dias diferentes. Ausência de registros não é interpretada como melhora ou piora.` : `Não há registros nos últimos ${days} dias. Ausência de registros não é interpretada como melhora ou piora.`;
const CX_LIM_STAT = 'É uma observação estatística dos seus registros, não uma orientação clínica nem uma relação de causa e efeito.';

/* ---------- 3. insights glicêmicos ---------- */
function cxInsights(records, o) {
  o = o || {}; const now = o.now || Date.now(), days = [7, 14, 30].includes(+o.days) ? +o.days : 14;
  const K = Object.assign({ compare: true, trend: true, period: true, variab: true, weekday: true, target: true }, o.kinds || {});
  const cl = cxClean(records, now), W = cxWin(cl.recs, days, now), cur = W.cur, prev = W.prev, dc = cxDays(cur), dp = cxDays(prev);
  const win = { days, n: cur.length, dayN: dc, range: cxRange(W.curR), prevN: prev.length, prevDays: dp, prevRange: cxRange(W.prevR), dup: cl.dup };
  if (cur.length < CX_MIN_N || dc < CX_MIN_D) return { list: [], why: cxWhy(cur.length, dc, days), win, enough: false };
  const per = `últimos ${days} dias (${win.range})`, list = [], A = CXA.anSummary(cur);
  const mk = (id, kind, tone, title, text, ex) => list.push(Object.assign({ id: id + '|' + days, cat: 'ins', kind, tone, title, text, period: per, n: cur.length, limits: CX_LIM_STAT, recIds: cxIds(cur) }, ex));
  const hasPrev = prev.length >= CX_MIN_N && dp >= CX_MIN_D, B = hasPrev ? CXA.anSummary(prev) : null;
  /* frequência abaixo / acima da faixa (faixa do app: 70–180; jejum até 130) */
  if (K.target) {
    const lowC = cur.filter(r => r.glucose < CXL.LIM.low), lowP = prev.filter(r => r.glucose < CXL.LIM.low);
    if (lowC.length >= 2 || (hasPrev && lowP.length >= 2 && lowC.length !== lowP.length)) {
      const cmp = hasPrev ? ` No período anterior (${cxRange(W.prevR)}) foram ${lowP.length} de ${prev.length} (${cxF(lowP.length / prev.length * 100)}%).` : ' Sem comparação: o período anterior tem poucos registros.';
      mk('baixas', 'target', 'low', 'Medições abaixo de ' + CXL.LIM.low, `Você registrou ${lowC.length} ${lowC.length === 1 ? 'medição' : 'medições'} abaixo de ${CXL.LIM.low} mg/dL (${cxF(lowC.length / cur.length * 100)}% das ${cur.length}) nos últimos ${days} dias.${cmp} Se valores baixos se repetem, converse com seu profissional de saúde.`, { crit: `Contagem de medições com valor menor que ${CXL.LIM.low} mg/dL, o mesmo limite usado nos alertas do app.`, recIds: cxIds(lowC), n: cur.length, nPrev: prev.length, pri: 0 });
    }
    const hiC = cur.filter(r => r.glucose > cxHi(r)), hiP = prev.filter(r => r.glucose > cxHi(r));
    if (hasPrev && hiC.length >= 3) {
      const d = hiC.length / cur.length * 100 - hiP.length / prev.length * 100;
      if (Math.abs(d) >= 10) mk('altas', 'target', 'high', 'Medições acima da faixa', `${hiC.length} de ${cur.length} medições (${cxF(hiC.length / cur.length * 100)}%) ficaram acima da faixa nos últimos ${days} dias, contra ${hiP.length} de ${prev.length} (${cxF(hiP.length / prev.length * 100)}%) no período anterior: ${d > 0 ? 'proporção maior' : 'proporção menor'} em ${cxF(Math.abs(d))} pontos percentuais.`, { crit: `Medições acima de ${CXL.LIM.high} mg/dL (acima de ${CXL.FAST.high} em jejum), comparadas em proporção entre dois períodos de mesma duração; diferença mínima de 10 pontos percentuais.`, recIds: cxIds(hiC), nPrev: prev.length, pri: 2 });
    }
  }
  /* comparação com o período anterior */
  if (K.compare && hasPrev) {
    const diff = A.mean - B.mean, cmp = CXA.anCompare(cur, prev);
    if (Math.abs(diff) >= 10) mk('media', 'compare', 'info', 'Média em relação ao período anterior', `A média dos últimos ${days} dias (${cxF(A.mean)} mg/dL, ${A.n} medições) foi ${diff > 0 ? 'maior' : 'menor'} que a do período anterior (${cxF(B.mean)} mg/dL, ${B.n} medições): diferença de ${cxF(Math.abs(diff))} mg/dL.`, { crit: `Média de todas as medições de cada período (${days} dias cada), diferença mínima de 10 mg/dL.`, nPrev: prev.length, pri: 1, limits: (cmp.warn.length ? cmp.warn.join(' ') + ' ' : '') + CX_LIM_STAT });
  }
  /* tendência: reta sobre as médias diárias, em janela de pelo menos 14 dias */
  if (K.trend) {
    const td = Math.max(days, 14), TW = cxWin(cl.recs, td, now), tr = CXL.trend(TW.cur);
    if (tr && Math.abs(tr.perWeek) >= 8) mk('tendencia', 'trend', 'info', tr.perWeek > 0 ? 'Tendência de elevação' : 'Tendência de redução', `As médias diárias dos últimos ${td} dias mostram tendência de ${tr.perWeek > 0 ? 'elevação' : 'redução'} de cerca de ${cxF(Math.abs(tr.perWeek))} mg/dL por semana (${tr.days} dias com registro).`, { crit: 'Reta ajustada às médias diárias (mínimo de 10 dias com registro e 20 medições); só aparece com inclinação de pelo menos 8 mg/dL por semana. Dias sem registro são ignorados.', period: `últimos ${td} dias (${cxRange(TW.curR)})`, n: TW.cur.length, recIds: cxIds(TW.cur), pri: 3, limits: 'As medições podem ter sido feitas em horários e contextos diferentes. ' + CX_LIM_STAT });
  }
  /* períodos do dia */
  const P = CX_PERIODS.map(p => { const rs = cur.filter(r => { const h = cxHour(r); return h != null && h >= p.a && h < p.b; }); const v = rs.map(r => r.glucose); return Object.assign({ rs, n: rs.length, d: cxDays(rs), mean: cxMean(v), sd: cxSd(v), fast: rs.filter(r => r.context === 'jejum').length / (rs.length || 1) }, p); }).filter(p => p.n >= CX_MIN_P && p.d >= 3);
  if (K.period && P.length >= 2) {
    const hi = P.reduce((a, b) => b.mean > a.mean ? b : a), lo = P.reduce((a, b) => b.mean < a.mean ? b : a);
    if (hi.mean - lo.mean >= 20) mk('periodo', 'period', 'info', 'Período do dia com valores mais elevados', `As medições da ${hi.t} tiveram média mais alta (${cxF(hi.mean)} mg/dL, ${hi.n} medições em ${hi.d} dias) que as da ${lo.t} (${cxF(lo.mean)} mg/dL, ${lo.n} medições em ${lo.d} dias) nos últimos ${days} dias.`, { crit: 'Média por período (manhã 5–12 h, tarde 12–18 h, noite 18–24 h), com ao menos 5 medições em 3 dias em cada um; diferença mínima de 20 mg/dL.', recIds: cxIds(hi.rs), n: hi.n + lo.n, pri: 4, limits: (Math.abs(hi.fast - lo.fast) >= 0.3 ? 'A proporção de medições em jejum é bem diferente entre esses períodos, o que influencia a média. ' : '') + CX_LIM_STAT });
  }
  if (K.variab) {
    const S = P.filter(p => p.n >= 6 && p.sd != null);
    if (S.length >= 2) { const hi = S.reduce((a, b) => b.sd > a.sd ? b : a), lo = S.reduce((a, b) => b.sd < a.sd ? b : a); if (hi.sd >= lo.sd * 1.25 && hi.sd - lo.sd >= 8) mk('variacao', 'var', 'info', 'Período com maior variação', `As medições da ${hi.t} variaram mais (desvio-padrão ${cxF(hi.sd)} mg/dL, ${hi.n} medições) que as da ${lo.t} (${cxF(lo.sd)} mg/dL, ${lo.n} medições) nos últimos ${days} dias.`, { crit: 'Desvio-padrão por período do dia, com ao menos 6 medições em cada; o maior precisa ser 25% acima do menor e diferir em pelo menos 8 mg/dL.', recIds: cxIds(hi.rs), n: hi.n + lo.n, pri: 5 }); }
  }
  /* dias da semana: janela fixa de 30 dias (com 7 ou 14 dias há poucas repetições de cada dia) */
  if (K.weekday) {
    const WW = cxWin(cl.recs, 30, now), WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const w = WD.map((l, d) => { const rs = WW.cur.filter(r => new Date(r.ts).getDay() === d); return { l, d, rs, n: rs.length, days: cxDays(rs), mean: cxMean(rs.map(r => r.glucose)) }; }).filter(x => x.n >= CX_MIN_P && x.days >= 2);
    if (w.length >= 3) { const hi = w.reduce((a, b) => b.mean > a.mean ? b : a), lo = w.reduce((a, b) => b.mean < a.mean ? b : a); if (hi.mean - lo.mean >= 25) mk('semana', 'weekday', 'info', 'Diferença entre dias da semana', `Nos últimos 30 dias, a média foi ${cxF(hi.mean)} mg/dL ${hi.l === 'sábado' || hi.l === 'domingo' ? 'aos ' : 'às '}${hi.l}s (${hi.n} medições em ${hi.days} dias) e ${cxF(lo.mean)} mg/dL ${lo.l === 'sábado' || lo.l === 'domingo' ? 'aos ' : 'às '}${lo.l}s (${lo.n} medições em ${lo.days} dias).`, { crit: 'Média por dia da semana nos últimos 30 dias, com ao menos 5 medições em 2 dias de cada; diferença mínima de 25 mg/dL entre o maior e o menor.', period: `últimos 30 dias (${cxRange(WW.curR)})`, n: hi.n + lo.n, recIds: cxIds(hi.rs.concat(lo.rs)), pri: 6 }); }
  }
  list.sort((a, b) => a.pri - b.pri);
  return { list, why: list.length ? '' : `Com os ${cur.length} registros dos últimos ${days} dias não há nenhum destaque claro. Isso é normal quando os valores estão distribuídos de forma uniforme.`, win, enough: true, noPrev: !hasPrev ? `O período anterior (${cxRange(W.prevR)}) tem poucos registros, então não há comparação com ele.` : '' };
}

/* ---------- 4. padrões e associações (descritivas) ---------- */
function cxPatterns(records, events, o) {
  o = o || {}; const now = o.now || Date.now(), days = 30, minOcc = Math.max(3, +o.minOcc || CX_MIN_P);
  const K = Object.assign({ meal: true, activity: true, marks: true, events: true, timing: true }, o.kinds || {});
  const cl = cxClean(records, now), W = cxWin(cl.recs, days, now), cur = W.cur, dc = cxDays(cur);
  const win = { days, n: cur.length, dayN: dc, range: cxRange(W.curR) };
  if (cur.length < 20 || dc < 7) return { list: [], why: `Há ${cur.length} ${cur.length === 1 ? 'medição' : 'medições'} em ${dc} ${dc === 1 ? 'dia' : 'dias'} nos últimos ${days} dias. Para reconhecer padrões são necessárias ao menos 20 medições em 7 dias diferentes.`, win, enough: false };
  const per = `últimos ${days} dias (${win.range})`, list = [], LIM_P = 'Associação estatística entre os registros; não indica que um fator causou o outro.';
  const mk = (id, kind, title, text, ex) => list.push(Object.assign({ id: 'p-' + id, cat: 'pat', kind, tone: 'info', title, text, period: per, limits: LIM_P }, ex));
  if (K.meal) {
    const posts = cur.filter(r => r.context === 'depois' && r.meal);
    [['cafe', 'café da manhã'], ['almoco', 'almoço'], ['jantar', 'jantar']].forEach(([m, nm]) => {
      const a = posts.filter(r => r.meal === m), b = posts.filter(r => r.meal !== m);
      if (a.length >= minOcc && cxDays(a) >= 3 && b.length >= minOcc) {
        const d = cxMean(a.map(r => r.glucose)) - cxMean(b.map(r => r.glucose));
        if (Math.abs(d) >= 15) mk('refeicao-' + m, 'meal', 'Medições depois do ' + nm, `Nos registros disponíveis, suas medições depois do ${nm} costumam apresentar valores ${d > 0 ? 'mais elevados' : 'mais baixos'} (média ${cxF(cxMean(a.map(r => r.glucose)))} mg/dL, ${a.length} medições em ${cxDays(a)} dias) que depois das outras refeições (${cxF(cxMean(b.map(r => r.glucose)))} mg/dL, ${b.length} medições).`, { n: a.length + b.length, count: a.length, crit: `Medições marcadas como “depois da refeição” com a refeição informada, mínimo de ${minOcc} em cada grupo e 3 dias; diferença mínima de 15 mg/dL.`, recIds: cxIds(a) });
      }
      if (K.timing) {
        const pr = CXA.anPairs(cur, r => r.meal === m && r.context === 'antes', 30, 360).filter(p => p.next.meal === m && p.next.context === 'depois' && p.next.date === p.r.date);
        if (pr.length >= minOcc) {
          const dl = pr.map(p => p.next.glucose - p.r.glucose), md = cxMean(dl), gaps = pr.map(p => p.gap).sort((x, y) => x - y), gm = gaps[Math.floor(gaps.length / 2)];
          if (Math.abs(md) >= 20) mk('antesdepois-' + m, 'meal', `Antes e depois do ${nm}`, `Em ${pr.length} dias com medição antes e depois do ${nm}, a glicemia depois foi em média ${cxF(Math.abs(md))} mg/dL ${md > 0 ? 'maior' : 'menor'} que a de antes (intervalo mediano entre as medições: ${cxF(gm)} min).`, { n: pr.length * 2, count: pr.length, crit: `Pares “antes” e “depois” da mesma refeição, no mesmo dia, entre 30 min e 6 h um do outro; mínimo de ${minOcc} pares e variação média de pelo menos 20 mg/dL.`, recIds: pr.flatMap(p => [p.r.id, p.next.id]) });
        }
      }
    });
  }
  if (K.activity) {
    const isAct = r => r.actMin != null || !!r.actDesc, pa = CXA.anPairs(cur, isAct, 30, 240), pb = CXA.anPairs(cur, r => !isAct(r) && !(r.marks || []).includes('ativ'), 30, 240);
    if (pa.length >= minOcc && pb.length >= 10) {
      const da = cxMean(pa.map(p => p.next.glucose - p.r.glucose)), db = cxMean(pb.map(p => p.next.glucose - p.r.glucose));
      if (Math.abs(da - db) >= 15) mk('atividade', 'activity', 'Medições depois de atividade física', `Em ${pa.length} registros de atividade com outra medição entre 30 min e 4 h depois, a variação média foi de ${da > 0 ? '+' : '−'}${cxF(Math.abs(da))} mg/dL, contra ${db > 0 ? '+' : '−'}${cxF(Math.abs(db))} mg/dL nos ${pb.length} pares de medições sem atividade registrada.`, { n: pa.length + pb.length, count: pa.length, crit: `Pares de medições (30 min a 4 h de intervalo) a partir de registros com atividade, mínimo de ${minOcc}, comparados com pares sem atividade (mínimo de 10); diferença de pelo menos 15 mg/dL.`, recIds: pa.flatMap(p => [p.r.id, p.next.id]), limits: 'Duração, intensidade e alimentação variam, e atividade não anotada fica nos pares sem atividade. ' + LIM_P });
    }
  }
  if (K.marks) {
    CXA.anRecurrence(cur, o.markLabels || {}).filter(x => x.k === 'baixas' || x.k === 'posrefeicao' || x.k === 'semana' || x.k === 'atividade' || /^marca-/.test(x.k)).forEach(x => {
      if (x.k === 'atividade' && K.activity && list.some(p => p.kind === 'activity')) return;
      mk('rec-' + x.k, /^marca-/.test(x.k) ? 'marks' : 'recurrence', x.title, x.text, { n: x.universe, count: x.count, crit: 'Recorrência calculada pela Análise do app com os mesmos limites mínimos de ocorrências.', recIds: x.recIds || [], limits: LIM_P });
    });
  }
  if (K.events) {
    const ev = CXA.anAssociations(cur, events || []).find(x => x.k === 'eventos');
    if (ev) ev.bins.slice(0, 3).forEach((b, i) => mk('evento-' + i, 'events', 'Dia do evento “' + b.l + '”', `No dia de “${b.l}” (${b.date.split('-').reverse().slice(0, 2).join('/')}) e no seguinte, a média foi ${cxF(b.post)} mg/dL (${b.n} medições), ${b.delta >= 0 ? '+' : '−'}${cxF(Math.abs(b.delta))} mg/dL em relação aos dias fora de eventos.`, { n: b.n, count: b.n, crit: 'Média do dia do evento e do dia seguinte, com ao menos 3 medições, contra a média dos dias sem eventos (mínimo de 10 medições).', recIds: b.ids || [], limits: 'Um evento não é a única coisa que muda de um dia para o outro. ' + LIM_P }));
  }
  /* diferenciar recorrência de acontecimento isolado: toda entrada precisa de pelo menos 3 ocorrências */
  const out = list.filter(p => (p.count == null ? p.n : p.count) >= 3);
  return { list: out, why: out.length ? '' : `Com os ${cur.length} registros dos últimos ${days} dias não há padrão recorrente claro. Com mais registros de contexto (refeição, atividade, etiquetas) as comparações ficam possíveis.`, win, enough: true };
}

/* ---------- 8. resumos por período ---------- */
function cxSummary(records, o) {
  o = o || {}; const now = o.now || Date.now(), range = String(o.range || '7'), cl = cxClean(records, now);
  let c0, c1, label;
  if (range === '24h') { c1 = now; c0 = now - CX_DAY; label = 'últimas 24 horas'; }
  else if (range === 'custom') {
    const a = CXL.mkTs(o.from, '00:00'), b = CXL.mkTs(o.to, '23:59');
    if (!o.from || !o.to || !isFinite(a) || !isFinite(b)) return { ok: false, why: 'Escolha a data inicial e a final.' };
    if (a > b) return { ok: false, why: 'A data inicial precisa ser anterior à final.' };
    if (b - a > 366 * CX_DAY) return { ok: false, why: 'O período personalizado pode ter no máximo 366 dias.' };
    c0 = a; c1 = b; label = 'período de ' + o.from.split('-').reverse().join('/') + ' a ' + o.to.split('-').reverse().join('/');
  } else { const d = [7, 14, 30].includes(+range) ? +range : 7; c0 = CXL.startOfDay(CXL.addDays(now, -(d - 1))); c1 = CXL.endOfDay(now); label = 'últimos ' + d + ' dias'; }
  const len = c1 - c0, p1 = c0 - 1, p0 = c0 - len - 1, cur = CXL.inRange(cl.recs, c0, c1), prev = CXL.inRange(cl.recs, p0, p1);
  const R = { ok: true, label, curR: [c0, c1], prevR: [p0, p1], n: cur.length, prevN: prev.length, recIds: cxIds(cur), enough: cur.length >= 3 };
  const spanDays = Math.max(1, Math.round(len / CX_DAY)), days = cxDays(cur);
  R.quality = { n: cur.length, days, spanDays, coverage: days / spanDays * 100, noTime: cur.filter(r => r.noTime || !r.time).length, dup: cl.dup, invalid: cl.invalid, fasting: cur.filter(r => r.context === 'jejum').length, noContext: cur.filter(r => !r.context).length };
  if (!cur.length) { R.why = 'Não há registros neste período. Ausência de registros não é interpretada como melhora ou piora.'; return R; }
  R.A = CXA.anSummary(cur);
  if (!R.enough) R.why = `Há apenas ${cur.length} ${cur.length === 1 ? 'medição' : 'medições'} neste período; com menos de 3 não há média confiável.`;
  R.minRec = cur.reduce((a, b) => b.glucose < a.glucose ? b : a); R.maxRec = cur.reduce((a, b) => b.glucose > a.glucose ? b : a);
  if (prev.length >= 3 && R.enough) { R.B = CXA.anSummary(prev); R.cmp = CXA.anCompare(cur, prev); } else R.noPrev = prev.length ? `O período anterior (${cxRange(R.prevR)}) tem só ${prev.length} ${prev.length === 1 ? 'medição' : 'medições'}, pouco para comparar.` : `Não há registros no período anterior (${cxRange(R.prevR)}).`;
  const vl = cur.filter(r => r.glucose < 54), vh = cur.filter(r => r.glucose > CXL.LIM.vhigh), eps = CXL.hypoEpisodes(cur);
  R.attention = { vlow: vl, vhigh: vh, epN: eps.length, lowN: cur.filter(r => r.glucose < CXL.LIM.low).length, ids: cxIds(vl.concat(vh)) };
  R.trend = cur.length >= 20 && days >= 10 ? CXL.trend(cur) : null;
  return R;
}

/* ---------- 5. assistência contextual por tela ---------- */
function cxAssist(route, records, o) {
  o = o || {}; const now = o.now || Date.now(), cl = cxClean(records, now), out = [], per = d => `últimos ${d} dias`;
  const note = (id, title, text, ex) => out.push(Object.assign({ id: 'a-' + id, cat: 'ast', route, title, text }, ex));
  if (route === 'painel') {
    const W = cxWin(cl.recs, 7, now), A = W.cur.length >= 3 ? CXA.anSummary(W.cur) : null;
    if (A) { const B = W.prev.length >= 3 ? CXA.anSummary(W.prev) : null; note('painel', 'Resumo dos últimos 7 dias', `${A.n} medições em ${A.days} dias, média de ${cxF(A.mean)} mg/dL e ${cxF(A.pIn)}% das medições na faixa.${B ? ` Nos 7 dias anteriores: média de ${cxF(B.mean)} mg/dL em ${B.n} medições.` : ' Sem comparação: o período anterior tem poucos registros.'}`, { period: per(7) + ' (' + cxRange(W.curR) + ')', n: A.n, crit: 'Média e proporção de medições na faixa (70–180 mg/dL; jejum até 130) dos registros reais do período; o mesmo cálculo da Análise.', recIds: cxIds(W.cur) }); }
    else note('painel', 'Resumo dos últimos 7 dias', `Há ${W.cur.length === 0 ? 'nenhum registro' : W.cur.length === 1 ? 'só 1 medição' : 'só ' + W.cur.length + ' medições'} nos últimos 7 dias, pouco para resumir. Ausência de registros não significa melhora ou piora.`, { period: per(7) + ' (' + cxRange(W.curR) + ')', n: W.cur.length, crit: 'Resumos pedem ao menos 3 medições no período.', recIds: cxIds(W.cur) });
  } else if (route === 'historico') {
    const W = cxWin(cl.recs, 30, now), cur = W.cur;
    if (cur.length >= CX_MIN_N) {
      const g = CXL.groupBy(cur, r => r.date), cnt = [...g.entries()].sort((a, b) => b[1].length - a[1].length || b[0].localeCompare(a[0]));
      const dates = [...g.keys()].sort(), gaps = []; for (let i = 1; i < dates.length; i++) { const d = Math.round((Date.parse(dates[i] + 'T12:00:00Z') - Date.parse(dates[i - 1] + 'T12:00:00Z')) / CX_DAY) - 1; if (d >= 3) gaps.push({ a: dates[i - 1], b: dates[i], d }); }
      const lastGap = gaps.sort((x, y) => y.d - x.d)[0];
      note('hist', 'Seus registros nos últimos 30 dias', `O dia com mais registros foi ${cnt[0][0].split('-').reverse().slice(0, 2).join('/')} (${cnt[0][1].length} medições).${lastGap ? ` O maior intervalo sem dados foi de ${lastGap.d} dias, entre ${lastGap.a.split('-').reverse().slice(0, 2).join('/')} e ${lastGap.b.split('-').reverse().slice(0, 2).join('/')}.` : ' Não há intervalos de 3 dias ou mais sem registros.'}`, { period: per(30) + ' (' + cxRange(W.curR) + ')', n: cur.length, crit: 'Contagem de medições por dia; intervalo = dias consecutivos sem nenhum registro (mínimo de 3).', recIds: cxIds(g.get(cnt[0][0])) });
    } else note('hist', 'Seus registros nos últimos 30 dias', `Há ${cur.length} ${cur.length === 1 ? 'medição' : 'medições'} nos últimos 30 dias, pouco para apontar concentrações ou intervalos.`, { period: per(30), n: cur.length, crit: 'A leitura do histórico pede ao menos 10 medições no período.', recIds: cxIds(cur) });
  } else if (route === 'analise') {
    const W = cxWin(cl.recs, 30, now), cur = W.cur, d = cxDays(cur);
    if (cur.length < 20 || d < 10) note('analise', 'Dados para interpretar os gráficos', `Há ${cur.length} ${cur.length === 1 ? 'medição' : 'medições'} em ${d} ${d === 1 ? 'dia' : 'dias'} nos últimos 30 dias. Tendências pedem ao menos 20 medições em 10 dias; até lá, leia os gráficos como retrato dos poucos registros existentes.`, { period: per(30), n: cur.length, crit: 'Mínimo de 20 medições em 10 dias para a tendência.', recIds: cxIds(cur) });
    else { const tr = CXL.trend(cur); note('analise', 'Tendência nos últimos 30 dias', tr && Math.abs(tr.perWeek) >= 8 ? `As médias diárias indicam ${tr.perWeek > 0 ? 'elevação' : 'redução'} de cerca de ${cxF(Math.abs(tr.perWeek))} mg/dL por semana (${tr.days} dias com registro).` : `As médias diárias não mostram tendência clara (variação menor que 8 mg/dL por semana) em ${tr ? tr.days : d} dias com registro.`, { period: per(30) + ' (' + cxRange(W.curR) + ')', n: cur.length, crit: 'Reta ajustada às médias diárias; destaque só com inclinação de pelo menos 8 mg/dL por semana.', recIds: cxIds(cur) }); }
    note('analise-ind', 'O que os indicadores mostram', 'Média resume o nível dos valores; desvio-padrão e coeficiente de variação mostram o quanto eles se espalham. Proporção na faixa conta medições, não tempo contínuo.', { period: '', n: 0, crit: 'Texto educativo, sem relação com a sua faixa de valores.', edu: true });
  } else if (route === 'metricas' || route === 'metrica') {
    const W = cxWin(cl.recs, 30, now), A = W.cur.length >= 3 ? CXA.anSummary(W.cur) : null, B = W.prev.length >= 3 ? CXA.anSummary(W.prev) : null;
    if (A) note('metricas', 'Evolução em relação ao período anterior', B ? `Nos últimos 30 dias a média foi ${cxF(A.mean)} mg/dL (${A.n} medições), contra ${cxF(B.mean)} mg/dL (${B.n} medições) nos 30 dias anteriores${A.n / B.n >= 2 || B.n / A.n >= 2 ? '. As quantidades de medições são bem diferentes, então compare com cautela' : ''}.` : `Média de ${cxF(A.mean)} mg/dL em ${A.n} medições nos últimos 30 dias. Sem comparação: o período anterior tem poucos registros.`, { period: per(30) + ' (' + cxRange(W.curR) + ')', n: A.n, crit: 'Média de todas as medições reais de cada janela de 30 dias.', recIds: cxIds(W.cur) });
    else note('metricas', 'Evolução em relação ao período anterior', 'Há poucas medições nos últimos 30 dias para contextualizar a evolução.', { period: per(30), n: W.cur.length, crit: 'Pede ao menos 3 medições no período.', recIds: cxIds(W.cur) });
  } else if (route === 'bolus' || route === 'refeicoes') {
    const W = cxWin(cl.recs, 30, now), ms = W.cur.filter(r => r.meal), withC = W.cur.filter(r => r.meal && r.carbs != null && r.carbs > 0);
    if (ms.length >= 3) {
      const by = [['cafe', 'café da manhã'], ['almoco', 'almoço'], ['jantar', 'jantar'], ['lanche', 'lanche']].map(([k, t]) => ({ k, t, rs: ms.filter(r => r.meal === k) })).filter(x => x.rs.length).sort((a, b) => b.rs.length - a.rs.length), top = by[0], last = top.rs[top.rs.length - 1];
      note('alim', 'Seus registros de refeição', `${ms.length} medições dos últimos 30 dias têm refeição informada (${withC.length} com carboidratos). A mais frequente é ${top.t}, com ${top.rs.length}; a última foi em ${cxDM(last.ts)}${last.carbs ? ` com ${cxF(last.carbs)} g de carboidratos` : ''}.`, { period: per(30) + ' (' + cxRange(W.curR) + ')', n: ms.length, crit: 'Contagem das medições com refeição informada; carboidratos como registrados, sem reclassificar.', recIds: cxIds(ms) });
    } else note('alim', 'Seus registros de refeição', `Há ${ms.length} ${ms.length === 1 ? 'medição' : 'medições'} com refeição informada nos últimos 30 dias, pouco para comparar com refeições anteriores.`, { period: per(30), n: ms.length, crit: 'Pede ao menos 3 medições com refeição informada.', recIds: cxIds(ms) });
  }
  return out;
}

/* ---------- 6. sugestões de funcionalidades ---------- */
function cxCandidates(c) {
  const now = c.now || Date.now(), cl = cxClean(c.records, now), W = cxWin(cl.recs, 30, now), w14 = cxWin(cl.recs, 14, now).cur, w7 = cxWin(cl.recs, 7, now).cur;
  const use = c.usage || {}, st = c.state || {}, dis = st.dis || {}, acc = st.acc || {}, rej = st.rej || {}, cats = c.cats || { discover: true, data: true, report: true };
  const has = c.has || (() => true), allowed = c.allowed || (() => true), n30 = W.cur.length, d30 = cxDays(W.cur), noCtx = w14.filter(r => !r.context).length;
  const L = [
    { id: 'ver-analise', cat: 'discover', routes: ['painel', 'historico'], feat: 'analise', target: 'analise', label: 'Abrir a Análise', title: 'Acompanhar tendências na Análise', text: 'Você já tem registros suficientes para ver tendências e comparações na Análise.', why: `${n30} medições em ${d30} dias nos últimos 30 dias.`, ok: n30 >= 20 && d30 >= 10 && !use.analise },
    { id: 'ver-padroes', cat: 'discover', routes: ['analise', 'painel'], feat: 'padroes', target: 'padroes', label: 'Ver padrões', title: 'Padrões e observações', text: 'Há dados suficientes para consultar observações automáticas sobre os seus registros.', why: `${n30} medições em ${d30} dias nos últimos 30 dias.`, ok: n30 >= 30 && d30 >= 10 && !use.padroes },
    { id: 'ver-resumo', cat: 'discover', routes: ['painel'], target: 'ctxres', label: 'Ver resumos', title: 'Resumos por período', text: 'Você pode ver um resumo dos últimos 7, 14 ou 30 dias, ou de um período que escolher.', why: `${w7.length} medições nos últimos 7 dias.`, ok: w7.length >= 5 && !use.ctxres },
    { id: 'ver-relatorio', cat: 'report', routes: ['painel', 'analise', 'historico'], target: 'relatorios', label: 'Abrir relatórios', title: 'Relatório do período', text: 'Os relatórios reúnem o período escolhido para você consultar ou levar ao seu profissional de saúde.', why: `${n30} medições nos últimos 30 dias.`, ok: n30 >= 30 && !use.relatorios },
    { id: 'completar-contexto', cat: 'data', routes: ['historico', 'painel'], target: 'classificar', label: 'Classificar medições', title: 'Completar o contexto das medições', text: 'Parte das medições recentes está sem contexto (jejum, antes ou depois da refeição). Informar o contexto enriquece os padrões e comparações.', why: `${noCtx} de ${w14.length} medições dos últimos 14 dias sem contexto.`, ok: w14.length >= 10 && noCtx / w14.length >= 0.5 }
  ];
  const score = x => 10 + 2 * (acc[x.cat] || 0) - 3 * (rej[x.cat] || 0) + Math.min(3, (use[x.target] || 0) ? 0 : 1);
  return L.filter(x => x.ok && cats[x.cat] !== false && x.routes.includes(c.route) && has(x.target) && (!x.feat || allowed(x.feat)) && !((dis[x.id] || 0) > now) && !((rej[x.cat] || 0) >= 3 && !(acc[x.cat] || 0))).map(x => Object.assign({ score: score(x) }, x)).sort((a, b) => b.score - a.score);
}

/* ---------- 7. lembretes contextuais (só informativos; nunca presumem quando medir) ---------- */
function cxQuiet(ts, q) {
  if (!q || !q.on || !q.from || !q.to) return false;
  const m = s => { const p = String(s).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }, d = new Date(ts), v = d.getHours() * 60 + d.getMinutes(), a = m(q.from), b = m(q.to);
  return a === b ? false : a < b ? (v >= a && v < b) : (v >= a || v < b);
}
function cxReminders(c) {
  const now = c.now || Date.now(), cl = cxClean(c.records, now), cfg = Object.assign({ routine: true, gap: 48, habit: false, report: true }, c.cfg || {}), out = [], dis = (c.state && c.state.rdis) || {};
  const today = CXL.isoDate(new Date(now)), mk = (key, kind, title, text, ex) => { if ((dis[key] || 0) > now) return; out.push(Object.assign({ id: 'r-' + key, key, cat: 'rem', kind, title, text, period: '', limits: 'Lembrete informativo baseado nos seus próprios registros: o GLUXO não indica quando medir.' }, ex)); };
  if (cxQuiet(now, c.quiet)) return { list: [], quiet: true };
  const last = cl.recs[cl.recs.length - 1], gapMs = (+cfg.gap || 48) * 3600e3;
  if (cfg.routine && last && now - last.ts >= gapMs) {
    const lim = now - gapMs, b = cl.recs.filter(r => r.ts < lim && r.ts >= lim - 14 * CX_DAY), bd = cxDays(b);
    if (bd >= 8) mk('rotina|' + last.id, 'routine', 'Pausa na rotina de registros', `Você tinha registros em ${bd} dos 14 dias antes desta pausa. O último foi em ${cxDMH(last.ts)}, há ${cxAgo(now - last.ts)}. É só um aviso sobre a sua rotina de registros.`, { n: b.length, period: 'até ' + cxDM(lim), crit: `Sem registros há pelo menos ${cfg.gap} horas, depois de registros em 8 ou mais dos 14 dias anteriores.`, recIds: cxIds(b.slice(-20)) });
  }
  if (cfg.habit) {
    const W = cxWin(cl.recs, 21, now), cur = W.cur.filter(r => !r.noTime && r.time), days = cxDays(cur), H = {};
    cur.forEach(r => { const h = cxHour(r); (H[h] = H[h] || new Set()).add(r.date); });
    const best = Object.entries(H).map(([h, s]) => [+h, s.size]).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    if (best && best[1] >= 10 && best[1] / Math.max(1, days) >= 0.5) {
      const h = best[0], hn = new Date(now).getHours(), doneToday = cl.recs.some(r => r.date === today && !r.noTime && Math.abs(cxHour(r) - h) <= 1);
      if (hn >= h + 2 && !doneToday) mk('habito|' + today + '|' + h, 'habit', 'Horário habitual de registro', `Nos últimos 21 dias você registrou por volta das ${cxP2(h)}h em ${best[1]} dias. Hoje ainda não há registro nesse horário.`, { n: best[1], period: 'últimos 21 dias', crit: 'Horário em que há registro em pelo menos 10 dias e em metade ou mais dos dias com registro.', recIds: cur.filter(r => cxHour(r) === h).map(r => r.id) });
    }
  }
  if (cfg.report && c.route === 'relatorios') {
    const W = cxWin(cl.recs, 30, now), age = last ? now - last.ts : null;
    mk('relatorio|' + today, 'report', 'Antes de gerar o relatório', last ? `O último registro foi em ${cxDMH(last.ts)} (há ${cxAgo(age)}) e há ${W.cur.length} ${W.cur.length === 1 ? 'medição' : 'medições'} nos últimos 30 dias.` : 'Ainda não há registros reais para compor um relatório.', { n: W.cur.length, period: 'últimos 30 dias (' + cxRange(W.curR) + ')', crit: 'Conferência da quantidade e da data dos registros antes de gerar o relatório.', recIds: cxIds(W.cur) });
  }
  return { list: out, quiet: false };
}

if (typeof module !== 'undefined') module.exports = { CX_MIN_N, CX_MIN_D, CX_PERIODS, cxClean, cxWin, cxInsights, cxPatterns, cxSummary, cxAssist, cxCandidates, cxReminders, cxQuiet, cxF, cxRange, cxDM, cxDMH };
