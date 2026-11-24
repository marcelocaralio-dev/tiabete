/* ================= Início: lógica pura (sem DOM) =================
   Tudo aqui recebe os dados por parâmetro e devolve objetos simples, para poder ser testado em Node (tests/test27.js).
   Regras de honestidade:
   - só medições reais entram nas conclusões (dados de exemplo ficam de fora);
   - nada é estimado entre duas medições: o dia mostra apenas os pontos registrados e os intervalos entre eles;
   - sem dados suficientes, o indicador devolve null (a tela mostra "—" e explica por quê), nunca um número inventado;
   - nenhum texto aqui diagnostica, orienta tratamento ou aponta causa. */
const INC = (typeof module !== 'undefined' && typeof require === 'function') ? require('./logic.js') : {
  stats, bandOf, bandCounts, inRange, periodRanges, compareStats, startOfDay, endOfDay, addDays, mkTs, isoDate, fmtDate, hypoEpisodes, patternNotes, LIM, FAST, DAY
};

/* ---------- catálogo de cartões e indicadores ---------- */
/* Cartões que o usuário pode reordenar e ocultar. Ficam de fora (essenciais, sempre visíveis): situação geral, acontecimentos
   importantes, atalhos, avisos/lembretes (banners) e a navegação. */
const IN_CARDS = [
  { k: 'hoje', t: 'Evolução do dia' },
  { k: 'hba', t: 'Hemoglobina glicada (estimativa)' },
  { k: 'exa', t: 'Exames e HbA1c de laboratório' },
  { k: 'evo', t: 'Evolução da glicemia' },
  { k: 'trat', t: 'Meu tratamento' },
  { k: 'var', t: 'Variabilidade' },
  { k: 'med', t: 'Média no período' },
  { k: 'cmp', t: 'Comparação' },
  { k: 'min', t: 'Menor' },
  { k: 'max', t: 'Maior' },
  { k: 'n', t: 'Medições' },
  { k: 'hipo', t: 'Episódios abaixo de 70' },
  { k: 'hiper', t: 'Acima da faixa' },
  { k: 'dist', t: 'Distribuição por faixa' }
];
/* Indicadores que podem ir para o painel de situação geral (máximo IN_PRI_MAX). */
const IN_IND = [
  { k: 'media', t: 'Média do período' },
  { k: 'tend', t: 'Tendência recente' },
  { k: 'var', t: 'Variabilidade' },
  { k: 'faixa', t: 'Dentro da faixa' },
  { k: 'hipo', t: 'Hipoglicemias' },
  { k: 'hiper', t: 'Acima da faixa' },
  { k: 'comp', t: 'Comparação com o período anterior' },
  { k: 'hba', t: 'HbA1c estimada' }
];
const IN_PRI_MAX = 4, IN_PRI_DEF = ['media', 'tend', 'var', 'faixa'];
const IN_DEF = () => ({ v: 1, order: IN_CARDS.map(c => c.k), hidden: [], pri: IN_PRI_DEF.slice() });

/* Limpa qualquer valor vindo do armazenamento: chaves desconhecidas somem, as que faltam voltam ao fim (cartões novos aparecem sozinhos). */
function inCleanPrefs(v) {
  const d = IN_DEF(); if (!v || typeof v !== 'object') return d;
  const keys = IN_CARDS.map(c => c.k), seen = new Set(), order = [];
  (Array.isArray(v.order) ? v.order : []).forEach(k => { if (keys.includes(k) && !seen.has(k)) { seen.add(k); order.push(k); } });
  keys.forEach(k => { if (!seen.has(k)) order.push(k); });
  const hidden = [...new Set((Array.isArray(v.hidden) ? v.hidden : []).filter(k => keys.includes(k)))];
  const ik = IN_IND.map(i => i.k);
  let pri = [...new Set((Array.isArray(v.pri) ? v.pri : []).filter(k => ik.includes(k)))].slice(0, IN_PRI_MAX);
  if (!pri.length) pri = IN_PRI_DEF.slice();
  return { v: 1, order, hidden, pri };
}
function inParsePrefs(raw) { try { return inCleanPrefs(raw ? JSON.parse(raw) : null); } catch (e) { return IN_DEF(); } }
const inIsDefault = p => JSON.stringify(inCleanPrefs(p)) === JSON.stringify(IN_DEF());
/* Move um cartão uma posição (dir = -1 sobe, +1 desce). */
function inMove(p, k, dir) {
  const q = inCleanPrefs(p), i = q.order.indexOf(k), j = i + dir;
  if (i < 0 || j < 0 || j >= q.order.length) return q;
  [q.order[i], q.order[j]] = [q.order[j], q.order[i]]; return q;
}
function inToggleHidden(p, k) {
  const q = inCleanPrefs(p); if (!IN_CARDS.some(c => c.k === k)) return q;
  q.hidden = q.hidden.includes(k) ? q.hidden.filter(x => x !== k) : [...q.hidden, k]; return q;
}
/* Liga/desliga um indicador prioritário: sempre fica pelo menos 1 e no máximo IN_PRI_MAX. */
function inTogglePri(p, k) {
  const q = inCleanPrefs(p); if (!IN_IND.some(i => i.k === k)) return { prefs: q, msg: '' };
  if (q.pri.includes(k)) { if (q.pri.length <= 1) return { prefs: q, msg: 'Deixe pelo menos um indicador.' }; q.pri = q.pri.filter(x => x !== k); return { prefs: q, msg: '' }; }
  if (q.pri.length >= IN_PRI_MAX) return { prefs: q, msg: `Escolha no máximo ${IN_PRI_MAX} indicadores.` };
  q.pri = [...q.pri, k]; return { prefs: q, msg: '' };
}
const inVisible = p => { const q = inCleanPrefs(p); return q.order.filter(k => !q.hidden.includes(k)); };

/* ---------- utilitários ---------- */
const inReal = recs => (recs || []).filter(r => r && r.source !== 'exemplo' && r.example !== true && typeof r.glucose === 'number' && isFinite(r.glucose) && r.glucose > 0 && typeof r.ts === 'number');
const inPct = (a, b) => (b > 0 ? a / b * 100 : null);
const inGap = min => { const m = Math.round(min); if (m < 60) return m + ' min'; const h = Math.floor(m / 60), r = m % 60; return h + ' h' + (r ? ' ' + r + ' min' : ''); };
const inHM = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

/* ---------- situação geral ---------- */
/* Tendência recente: média dos últimos 7 dias contra os 7 anteriores. Precisa de 5 medições em cada janela; muda de classe só a partir de ±10 mg/dL. */
function inTrend(records, now) {
  const rs = (inReal(records).length ? inReal(records) : (records || []).filter(r => r && typeof r.glucose === 'number' && typeof r.ts === 'number')), a = INC.stats(INC.inRange(rs, INC.startOfDay(INC.addDays(now, -6)), INC.endOfDay(now)));
  const b = INC.stats(INC.inRange(rs, INC.startOfDay(INC.addDays(now, -13)), INC.startOfDay(INC.addDays(now, -6)) - 1));
  if (a.n < 5 || b.n < 5) return null;
  const diff = a.mean - b.mean;
  return { diff, dir: Math.abs(diff) < 10 ? 'flat' : diff > 0 ? 'up' : 'down', cur: a.mean, prev: b.mean, nCur: a.n, nPrev: b.n };
}
/* Modelo da situação geral. `period` em dias. Tudo vem das medições reais do período e do anterior. */
function inSituation(records, now, period, hbaEst) {
  /* Base única: medições reais; só quando não existe nenhuma (pessoa nova vendo os dados de exemplo) a base são os de exemplo.
     Assim a última glicemia, as médias e o resumo sempre falam dos mesmos registros. */
  const valid = (records || []).filter(r => r && typeof r.glucose === 'number' && isFinite(r.glucose) && typeof r.ts === 'number'), realOnly = inReal(records);
  const all = (realOnly.length ? realOnly : valid).slice().sort((a, b) => a.ts - b.ts), last = all[all.length - 1] || null;
  const rs = all, { cur, prev } = INC.periodRanges(period, now);
  const rc = INC.inRange(rs, cur[0], cur[1]), rp = INC.inRange(rs, prev[0], prev[1]), sc = INC.stats(rc), sp = INC.stats(rp), cmp = INC.compareStats(sc, sp);
  const bc = INC.bandCounts(rc), n = rc.length, tr = inTrend(records, now);
  const ageMs = last ? now - last.ts : null, stale = ageMs != null && ageMs > 48 * 3600e3;
  const lastBand = last ? INC.bandOf(last.glucose, last.context) : null;
  const var_ = sc.n >= 5 && sc.sd != null ? { amp: sc.max - sc.min, sd: sc.sd, cv: sc.mean > 0 ? sc.sd / sc.mean * 100 : null, prevSd: sp.n >= 5 ? sp.sd : null } : null;
  const few = sc.n > 0 && sc.n < 10;
  const m = { last, lastBand, ageMs, stale, period, cur, prev, rc, rp, sc, sp, cmp, bc, n, trend: tr, vari: var_, few, hba: hbaEst || null,
    tir: n ? inPct(bc.ok, n) : null, hypoN: sc.hypo, hyperN: sc.hyper };
  m.summary = inSummary(m);
  return m;
}
/* Texto-resumo: só fatos que os registros sustentam. */
function inSummary(m, opt) {
  if (!m.last) return 'Registre uma medição para o resumo aparecer aqui.';
  const parts = [], f1 = x => (Math.round(x * 10) / 10).toLocaleString('pt-BR'), f0 = x => Math.round(x).toLocaleString('pt-BR');
  const when = m.ageMs < 90 * 60e3 ? 'agora há pouco' : m.ageMs < 24 * 3600e3 ? `há ${Math.round(m.ageMs / 3600e3)} h` : `há ${Math.round(m.ageMs / 86400e3)} dia${Math.round(m.ageMs / 86400e3) === 1 ? '' : 's'}`;
  /* opt.noLast: o Resumo glicêmico (só do dia atual) já mostra a última medição; o texto do período não a repete */
  if (!(opt && opt.noLast)) parts.push(`Última medição ${when}: ${f0(m.last.glucose)} mg/dL (${m.lastBand.txt.toLowerCase()}).`);
  if (m.stale) parts.push('Sem medições recentes; os números abaixo refletem o que foi registrado antes.');
  if (m.sc.n) {
    let s = `Média de ${m.period} dias: ${f0(m.sc.mean)} mg/dL em ${m.sc.n} medi${m.sc.n === 1 ? 'ção' : 'ções'}`;
    if (m.cmp.diff != null && m.sp.n >= 5 && m.sc.n >= 5) s += Math.abs(m.cmp.diff) < 1 ? ', igual ao período anterior' : `, ${m.cmp.diff > 0 ? 'acima' : 'abaixo'} em ${f1(Math.abs(m.cmp.diff))} mg/dL do período anterior`;
    parts.push(s + '.');
    if (m.few) parts.push('Poucas medições no período: interprete com cautela.');
  } else parts.push(`Sem medições nos últimos ${m.period} dias.`);
  if (m.sc.hypo) parts.push(`${m.sc.hypo} medi${m.sc.hypo === 1 ? 'ção' : 'ções'} abaixo de ${INC.LIM.low}.`);
  return parts.join(' ');
}
/* Valor de cada indicador prioritário. tone: ok | bad | warn | null. Nunca devolve número sem base: sem dados → v '—'. */
function inIndicator(k, m, extra) {
  const f0 = x => Math.round(x).toLocaleString('pt-BR'), f1 = x => (Math.round(x * 10) / 10).toLocaleString('pt-BR'), sg = (x, d) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const none = (t, sub) => ({ k, t, v: '—', u: '', sub: sub || 'sem dados suficientes', tone: null, pm: 'med' });
  switch (k) {
    case 'media': return m.sc.n ? { k, t: 'Média', v: f0(m.sc.mean), u: 'mg/dL', sub: `${m.period} dias`, tone: INC.bandOf(m.sc.mean).k === 'ok' ? 'ok' : 'warn', pm: 'med' } : none('Média', `sem medições em ${m.period} dias`);
    case 'tend': return m.trend ? { k, t: 'Tendência', v: m.trend.dir === 'up' ? '▲' : m.trend.dir === 'down' ? '▼' : '■', u: m.trend.dir === 'flat' ? 'estável' : sg(m.trend.diff, 0) + ' mg/dL', sub: '7 dias vs 7 anteriores', tone: null, pm: 'cmp', dir: m.trend.dir } : none('Tendência', 'precisa de 5 medições em cada semana');
    case 'var': return m.vari ? { k, t: 'Variabilidade', v: f0(m.vari.sd), u: 'mg/dL de DP', sub: `amplitude ${f0(m.vari.amp)} mg/dL`, tone: null, pm: 'var' } : none('Variabilidade', 'precisa de 5 medições');
    case 'faixa': return m.n ? { k, t: 'Na faixa', v: f0(m.tir), u: '%', sub: `${m.bc.ok} de ${m.n} medições`, tone: m.tir >= 70 ? 'ok' : m.tir >= 50 ? 'warn' : 'bad', pm: 'dist', pct: m.tir } : none('Na faixa', 'sem medições');
    case 'hipo': return m.n ? { k, t: 'Abaixo de ' + INC.LIM.low, v: String(m.hypoN), u: m.hypoN === 1 ? 'medição' : 'medições', sub: `${f0(inPct(m.hypoN, m.n))}% do período`, tone: m.hypoN === 0 ? 'ok' : 'bad', pm: 'hipo' } : none('Abaixo de ' + INC.LIM.low, 'sem medições');
    case 'hiper': return m.n ? { k, t: 'Acima da faixa', v: String(m.hyperN), u: m.hyperN === 1 ? 'medição' : 'medições', sub: `${f0(inPct(m.hyperN, m.n))}% do período`, tone: m.hyperN === 0 ? 'ok' : 'warn', pm: 'hiper' } : none('Acima da faixa', 'sem medições');
    case 'comp': return m.cmp.pct != null && m.sp.n >= 5 && m.sc.n >= 5 ? { k, t: 'Comparação', v: sg(m.cmp.pct, 0), u: '%', sub: 'vs período anterior', tone: null, pm: 'cmp' } : none('Comparação', 'período anterior com poucas medições');
    case 'hba': return m.hba && m.hba.ok ? { k, t: 'HbA1c est.', v: '≈ ' + f1(m.hba.value), u: '%', sub: 'estimativa de 90 dias', tone: m.hba.tone || null, pm: 'hba' } : none('HbA1c est.', 'estimativa indisponível');
  }
  return none(k);
}

/* ---------- evolução do dia ---------- */
/* Linha do tempo do dia. Só pontos registrados; `joinPrev` indica se dá para ligar ao ponto anterior no gráfico (até 6 h de intervalo). */
function inDay(recs, iso, events, lowOf, highOf) {
  const day = (recs || []).filter(r => r && typeof r.glucose === 'number' && r.date === iso).slice().sort((a, b) => a.ts - b.ts);
  const lo = lowOf || INC.LIM.low, hiOf = highOf || (r => (r.context === 'jejum' ? INC.FAST.high : INC.LIM.high));
  let pt = null; /* última medição com horário: o intervalo só existe entre medições com horário */
  const items = day.map((r, i) => {
    const p = i ? day[i - 1] : null, gap = pt && !r.noTime ? Math.round((r.ts - pt.ts) / 60000) : null; if (!r.noTime) pt = r;
    const out = r.glucose < lo ? 'low' : r.glucose > hiOf(r) ? 'high' : null;
    return { r, gapMin: gap, joinPrev: gap != null && gap <= 360, out, band: INC.bandOf(r.glucose, r.context).k, delta: p ? r.glucose - p.glucose : null };
  });
  const timed = items.filter(i => !i.r.noTime), gaps = items.map(i => i.gapMin).filter(g => g != null);
  const outN = items.filter(i => i.out).length;
  return {
    iso, n: items.length, items, timed, untimed: items.length - timed.length,
    out: outN, inRange: items.length - outN, maxGapMin: gaps.length ? Math.max(...gaps) : null,
    min: items.length ? Math.min(...items.map(i => i.r.glucose)) : null, max: items.length ? Math.max(...items.map(i => i.r.glucose)) : null,
    events: (events || []).filter(e => e && e.date === iso)
  };
}

/* ---------- acontecimentos importantes ---------- */
const IN_EV_MAX = 4;
/* input: { records, hba, exams, now, period, markLabels }. Cada evento: { id, kind, tone, title, text, ts, act } — act = { type, id?, r? } para abrir os registros relacionados. */
function inEvents(inp) {
  const now = inp.now, rs = inReal(inp.records).slice().sort((a, b) => a.ts - b.ts), ev = [], f0 = x => Math.round(x).toLocaleString('pt-BR'), f1 = x => (Math.round(x * 10) / 10).toLocaleString('pt-BR');
  const dm = ts => { const d = new Date(ts); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); };
  const ago = ts => { const d = now - ts; return d < 3600e3 ? `há ${Math.max(1, Math.round(d / 60000))} min` : d < 86400e3 ? `há ${Math.round(d / 3600e3)} h` : `há ${Math.round(d / 86400e3)} dia${Math.round(d / 86400e3) === 1 ? '' : 's'}`; };
  /* 1) hipoglicemia nos últimos 7 dias (episódios: sequência de medições abaixo do limite) */
  const eps = INC.hypoEpisodes(INC.inRange(rs, now - 7 * 86400e3, now)).sort((a, b) => b.ts - a.ts);
  const allEps = INC.hypoEpisodes(rs);
  eps.slice(0, 2).forEach(e => {
    const isMin = allEps.length >= 3 && allEps.every(x => x === allEps.find(y => y.id === e.id) || x.min > e.min);
    ev.push({ id: 'hipo-' + e.id, kind: 'hipo', tone: 'bad', ts: e.ts, title: 'Hipoglicemia registrada', text: `${f0(e.min)} mg/dL em ${dm(e.start)} às ${inHM(e.start)} (${ago(e.start)})${e.members.filter(x => x.glucose < INC.LIM.low).length > 1 ? `, ${e.members.filter(x => x.glucose < INC.LIM.low).length} medições seguidas abaixo de ${INC.LIM.low}` : ''}${isMin ? '. É o menor valor já registrado' : ''}.`, act: { type: 'open', id: e.members[0].id } });
  });
  if (eps.length > 2) ev.push({ id: 'hipo-mais', kind: 'hipo', tone: 'bad', ts: eps[2].ts, title: `${eps.length} episódios em 7 dias`, text: `Além dos acima, há mais ${eps.length - 2} episódio${eps.length - 2 === 1 ? '' : 's'} abaixo de ${INC.LIM.low} na última semana.`, act: { type: 'pm', id: 'hipo' } });
  /* 2) mudança na média e 3) na variabilidade: período atual x anterior, com mínimo de dados */
  const { cur, prev } = INC.periodRanges(inp.period || 30, now), sc = INC.stats(INC.inRange(rs, cur[0], cur[1])), sp = INC.stats(INC.inRange(rs, prev[0], prev[1])), cmp = INC.compareStats(sc, sp);
  if (sc.n >= 10 && sp.n >= 10 && cmp.diff != null && Math.abs(cmp.diff) >= 10 && Math.abs(cmp.pct) >= 8) {
    const down = cmp.diff < 0;
    ev.push({ id: 'media-' + (inp.period || 30), kind: 'media', tone: down && sc.mean >= INC.LIM.low ? 'ok' : down ? 'warn' : 'warn', ts: now, title: down ? 'Média em queda' : 'Média em alta', text: `A média de ${inp.period || 30} dias foi ${f0(sc.mean)} mg/dL, ${down ? 'abaixo' : 'acima'} em ${f1(Math.abs(cmp.diff))} mg/dL (${Math.abs(Math.round(cmp.pct))}%) do período anterior (${f0(sp.mean)} mg/dL).`, act: { type: 'pm', id: 'cmp' } });
  }
  if (sc.n >= 10 && sp.n >= 10 && sc.sd != null && sp.sd != null && Math.abs(sc.sd - sp.sd) >= 10 && Math.abs(sc.sd - sp.sd) / sp.sd >= 0.2) {
    const up = sc.sd > sp.sd;
    ev.push({ id: 'var-' + (inp.period || 30), kind: 'var', tone: up ? 'warn' : 'ok', ts: now - 1, title: up ? 'Oscilação maior' : 'Oscilação menor', text: `O desvio-padrão foi ${f0(sc.sd)} mg/dL, contra ${f0(sp.sd)} mg/dL no período anterior. ${up ? 'As medições estão mais espalhadas.' : 'As medições estão mais próximas da média.'}`, act: { type: 'pm', id: 'var' } });
  }
  /* 4) exames novos (14 dias) e 5) HbA1c novas (30 dias). Exame de exemplo nunca gera acontecimento. */
  const nowD = INC.isoDate(new Date(now)), dAgo = iso => Math.round((INC.startOfDay(now) - INC.startOfDay(INC.mkTs(iso, '12:00'))) / 86400e3);
  const exams = (inp.exams || []).filter(e => e && e.id && e.source !== 'exemplo' && e.example !== true), hbaAll = (inp.hba || []).filter(x => x && x.source !== 'exemplo' && x.example !== true && typeof x.value === 'number');
  const examHba = {}; hbaAll.forEach(x => { if (x.examId) examHba[x.examId] = x; });
  exams.forEach(e => {
    const t = e.addedAt || (e.date ? INC.mkTs(e.date, '12:00') : 0); if (!t || now - t > 14 * 86400e3 || now - t < -86400e3) return;
    const h = examHba[e.id], n = Array.isArray(e.items) ? e.items.length : 0;
    ev.push({ id: 'ex-' + e.id, kind: 'exame', tone: 'info', ts: t, title: 'Novo exame', text: `${e.title && e.title !== 'Exame' ? e.title : 'Exame laboratorial'}${e.date ? ' · ' + INC.fmtDate(e.date) : ''}${n ? ` · ${n} resultado${n === 1 ? '' : 's'}` : ''}${h ? ` · HbA1c ${f1(h.value)}%` : ''}.`, act: { type: 'exam', id: e.id } });
  });
  const labs = hbaAll.filter(x => x.date).sort((a, b) => a.date.localeCompare(b.date));
  labs.forEach((x, i) => {
    if (x.examId && exams.some(e => e.id === x.examId && ev.some(v => v.id === 'ex-' + e.id))) return;
    if (dAgo(x.date) > 30 || dAgo(x.date) < -1) return;
    const p = labs[i - 1];
    ev.push({ id: 'hba-' + x.id, kind: 'hba', tone: 'info', ts: INC.mkTs(x.date, '12:00'), title: 'Novo resultado de HbA1c', text: `${f1(x.value)}% em ${INC.fmtDate(x.date)}${p ? `. O anterior foi ${f1(p.value)}% em ${INC.fmtDate(p.date)}` : ''}.`, act: { type: 'go', id: 'hba1c' } });
  });
  /* 6) recordes históricos (precisam de histórico: 30 medições em 14 dias ou mais) */
  if (rs.length >= 30 && rs[rs.length - 1].ts - rs[0].ts >= 14 * 86400e3) {
    const sorted = rs.slice().sort((a, b) => a.ts - b.ts), top = sorted.reduce((a, b) => (b.glucose > a.glucose ? b : a));
    const before = sorted.filter(r => r.ts < top.ts), topIsNew = before.length >= 20 && before.every(r => r.glucose < top.glucose);
    if (topIsNew && top.glucose > INC.LIM.high && now - top.ts <= 7 * 86400e3) ev.push({ id: 'rec-max-' + top.id, kind: 'recorde', tone: 'warn', ts: top.ts, title: 'Maior glicemia já registrada', text: `${f0(top.glucose)} mg/dL em ${dm(top.ts)} (${ago(top.ts)}).`, act: { type: 'open', id: top.id } });
    /* sequência de dias com todas as medições na faixa (pelo menos 2 por dia), a maior já registrada e com 5 dias ou mais */
    const byDay = new Map(); rs.forEach(r => { const k = r.date || INC.isoDate(new Date(r.ts)); (byDay.get(k) || byDay.set(k, []).get(k)).push(r); });
    const days = [...byDay.keys()].sort(), okDay = d => { const a = byDay.get(d); return a.length >= 2 && a.every(r => INC.bandOf(r.glucose, r.context).k === 'ok'); };
    let run = 0, best = 0, endsRecent = false;
    days.forEach((d, i) => { const consecutive = i && Math.round((INC.mkTs(d, '12:00') - INC.mkTs(days[i - 1], '12:00')) / 86400e3) === 1; if (okDay(d)) { run = consecutive && okDay(days[i - 1]) ? run + 1 : 1; } else run = 0; if (run > best) best = run; if (i === days.length - 1) endsRecent = run > 0 && dAgo(d) <= 1; });
    if (endsRecent && run >= 5 && run >= best) ev.push({ id: 'rec-seq-' + run, kind: 'recorde', tone: 'ok', ts: now - 2, title: 'Maior sequência na faixa', text: `${run} dias seguidos com todas as medições dentro da faixa (${run === best ? 'a maior já registrada' : ''}).`.replace(' ()', ''), act: { type: 'go', id: 'historico' } });
  }
  /* 7) padrões descritivos do aplicativo (no máximo 1) */
  try {
    const notes = INC.patternNotes(rs, inp.markLabels || {}, nowD);
    const pn = notes.find(x => x.k === 'baixas') || notes[0];
    if (pn) ev.push({ id: 'pad-' + pn.k, kind: 'padrao', tone: 'info', ts: now - 3, title: pn.t, text: pn.d, act: { type: 'go', id: 'padroes' } });
  } catch (e) { }
  const rank = { hipo: 0, exame: 1, hba: 1, recorde: 2, media: 3, var: 4, padrao: 5 };
  ev.sort((a, b) => (rank[a.kind] - rank[b.kind]) || (b.ts - a.ts));
  return ev;
}

/* ---------- atalhos contextuais ---------- */
/* input: { records, exams, now, remWin, planN, irN, calendar }. Devolve no máximo 3 atalhos, do mais para o menos relevante.
   Nenhum atalho registra ou confirma nada sozinho: todos só abrem uma tela ou levam ao aviso correspondente. */
function inShortcuts(inp) {
  const now = inp.now, out = [], rs = inReal(inp.records).slice().sort((a, b) => a.ts - b.ts), last = rs[rs.length - 1];
  if (inp.irN > 0 || inp.planN > 0) out.push({ k: 'rem', icon: 'bell', label: (inp.irN + inp.planN) > 1 ? `${inp.irN + inp.planN} lembretes pendentes` : 'Lembrete pendente', sub: 'Ir ao aviso para confirmar', act: 'in-rem' });
  else if (inp.remWin) out.push({ k: 'rem', icon: 'bell', label: 'Medição pendente', sub: `Sem glicemia ${inp.remWin.t} hoje`, act: 'new', ctx: inp.remWin.ctx, meal: inp.remWin.meal });
  if (last && !last.noTime && now - last.ts >= 0 && now - last.ts <= 90 * 60e3) out.push({ k: 'hist', icon: 'list', label: 'Ver no histórico', sub: `Medição das ${last.time}`, act: 'in-hist', id: last.id, d: last.date, t: last.time });
  /* refeição registrada nas últimas 3 h (medição de antes/durante a refeição) que ainda não teve uma medição "depois" */
  const meal = [...rs].reverse().find(r => r.meal && r.context !== 'depois' && now - r.ts >= 0 && now - r.ts <= 3 * 3600e3) || null;
  if (meal && !rs.some(r => r.ts > meal.ts && r.context === 'depois')) out.push({ k: 'meal', icon: 'plate', label: 'Acompanhar depois da refeição', sub: `Refeição registrada às ${meal.time || inHM(meal.ts)}`, act: 'new', ctx: 'depois', meal: meal.meal });
  const newEx = (inp.exams || []).filter(e => e && e.id && e.source !== 'exemplo' && e.example !== true && (e.addedAt || 0) > 0 && now - e.addedAt >= 0 && now - e.addedAt <= 7 * 86400e3).sort((a, b) => b.addedAt - a.addedAt)[0];
  if (newEx) out.push({ k: 'exam', icon: 'flask', label: 'Ver resultados do exame', sub: newEx.title && newEx.title !== 'Exame' ? newEx.title : 'Novo exame', act: 'ex-open', id: newEx.id });
  return out.slice(0, 3);
}

/* ---------- Resumo glicêmico: só o dia atual ----------
   Usa apenas medições reais da data local de `now`. Independe do período (7/30/90 dias) e do dia escolhido na Evolução do dia.
   items: da medição mais recente para a mais antiga. Nada é estimado: sem medições, mean/min/max/last são null. */
function inToday(records, now) {
  const iso = INC.isoDate(new Date(now));
  const items = inReal(records).filter(r => r.date === iso).slice().sort((a, b) => (b.ts - a.ts) || String(b.id).localeCompare(String(a.id)));
  const n = items.length, vals = items.map(r => r.glucose);
  const inN = items.filter(r => INC.bandOf(r.glucose, r.context).k === 'ok').length;
  return {
    iso, n, items, last: n ? items[0] : null,
    mean: n ? vals.reduce((a, b) => a + b, 0) / n : null,
    min: n ? Math.min(...vals) : null, max: n ? Math.max(...vals) : null,
    inN, outN: n - inN
  };
}

/* ---------- variabilidade: posição na escala (para a barra de amplitude) ---------- */
function inScale(vals, lo, hi) {
  const mn = Math.min(40, ...vals), mx = Math.max(hi + 40, ...vals), span = mx - mn;
  return { min: mn, max: mx, pos: v => Math.max(0, Math.min(100, (v - mn) / span * 100)) };
}

if (typeof module !== 'undefined') module.exports = { IN_CARDS, IN_IND, IN_PRI_MAX, IN_PRI_DEF, IN_DEF, inCleanPrefs, inParsePrefs, inIsDefault, inMove, inToggleHidden, inTogglePri, inVisible, inReal, inTrend, inSituation, inSummary, inToday, inIndicator, inDay, inEvents, inShortcuts, inScale, inGap, IN_EV_MAX };
