/* ================= Correlação e associação entre variáveis: lógica pura (sem DOM) =================
   Investiga como informações diferentes dos registros se comportam em conjunto. Descreve associação estatística; NUNCA afirma causa,
   não interpreta como resposta individual à insulina, não estima doses nem sugere mudança de tratamento.
   Regras de projeto:
   - cada análise parte de uma "unidade de observação" com vínculo temporal explícito (refeição: glicemia antes → depois; aplicação: dose →
     medição 1h30–5h depois; atividade: registro → medição 30 min–4 h depois; dia; medição em um mesmo contexto; exame × 90 dias anteriores);
     nunca se associa um registro a todas as medições do dia;
   - só combinações tecnicamente válidas são oferecidas (mesma unidade, sem variável calculada a partir da outra, sem categoria × categoria);
   - nada é inventado nem presumido: falta de registro de insulina/atividade/carboidrato não vira "zero" nem "não houve";
   - método conforme a distribuição: Pearson só com premissas razoáveis, senão Spearman; grupos por Welch ou Mann–Whitney (2) / Kruskal–Wallis (3+);
   - incerteza (IC 95%), valores extremos, sensibilidade (sem extremos, retirada de um registro), ajuste pela glicemia inicial e correção para
     múltiplas comparações (Benjamini–Hochberg) nas análises automáticas, que continuam exploratórias;
   - lê dados, não grava nada. */
const CRN = typeof module !== 'undefined' && typeof require === 'function';
const CRL = CRN ? require('./logic.js') : { LIM, FAST };
const CRF = CRN ? require('./refeicoes-core.js') : { rfBuild, rfReal, rfDedupeRecs, RF_MEALS, RF_GAP_SHORT, RF_GAP_LONG };

/* ---------- limites de qualidade ---------- */
const CR_MIN_N = 10;          /* observações mínimas para calcular uma correlação */
const CR_MIN_DAYS = 4;        /* dias diferentes mínimos (observações do mesmo dia não são independentes) */
const CR_MIN_GROUP = 5;       /* observações mínimas por grupo comparado */
const CR_MIN_DISTINCT = 4;    /* valores diferentes mínimos em cada variável numérica */
const CR_MIN_DAY_N = 3;       /* medições mínimas para um dia entrar na unidade "dia" */
const CR_MAX_LOO = 300;       /* retiradas individuais avaliadas (a partir daí, amostra regular) */
const CR_Q_HIGH = 0.10;       /* taxa de falsas descobertas aceita nos destaques */
const CR_IDX_MIN = 0.30;      /* intensidade mínima (r ou equivalente) para um destaque */
const CR_LOO_UNSTABLE = 0.20; /* amplitude do coeficiente ao retirar um registro por vez */

/* ---------- estatística básica ---------- */
const crIsNum = v => typeof v === 'number' && isFinite(v);
const crMean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
const crSd = a => { if (a.length < 2) return null; const m = crMean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
function crQuantile(sorted, q) { const n = sorted.length; if (!n) return null; const h = (n - 1) * q, lo = Math.floor(h), hi = Math.ceil(h); return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo); }
const crSorted = a => a.slice().sort((x, y) => x - y);
const crMedian = a => crQuantile(crSorted(a), 0.5);
/* assimetria de Fisher–Pearson ajustada (G1); exige 3 valores */
function crSkew(a) {
  const n = a.length; if (n < 3) return null; const m = crMean(a); let s2 = 0, s3 = 0; a.forEach(v => { s2 += (v - m) ** 2; s3 += (v - m) ** 3; });
  const sd = Math.sqrt(s2 / n); if (!(sd > 0)) return 0; return Math.sqrt(n * (n - 1)) / (n - 2) * (s3 / n) / sd ** 3;
}
const crDistinct = a => new Set(a.map(v => Math.round(v * 1e9))).size;
/* postos médios (empates recebem a média das posições) */
function crRanks(a) {
  const idx = a.map((v, i) => i).sort((i, j) => a[i] - a[j]), r = new Array(a.length);
  for (let k = 0; k < idx.length;) { let e = k; while (e + 1 < idx.length && a[idx[e + 1]] === a[idx[k]]) e++; const rk = (k + e) / 2 + 1; for (let t = k; t <= e; t++) r[idx[t]] = rk; k = e + 1; }
  return r;
}
function crTies(a) { const c = new Map(); a.forEach(v => c.set(v, (c.get(v) || 0) + 1)); let s = 0; c.forEach(t => { s += t ** 3 - t; }); return s; }
function crPearson(xs, ys) {
  const n = xs.length; if (n < 3 || ys.length !== n) return null; const mx = crMean(xs), my = crMean(ys); let a = 0, b = 0, c = 0;
  for (let i = 0; i < n; i++) { a += (xs[i] - mx) * (ys[i] - my); b += (xs[i] - mx) ** 2; c += (ys[i] - my) ** 2; }
  return b > 0 && c > 0 ? Math.max(-1, Math.min(1, a / Math.sqrt(b * c))) : null;
}
const crSpearman = (xs, ys) => crPearson(crRanks(xs), crRanks(ys));
/* correlação parcial de primeira ordem (controlando z), a partir das três correlações */
function crPartial(rxy, rxz, ryz) { const d = Math.sqrt((1 - rxz * rxz) * (1 - ryz * ryz)); return d > 0 ? Math.max(-1, Math.min(1, (rxy - rxz * ryz) / d)) : null; }

/* ---------- funções especiais (distribuições t, normal e qui-quadrado) ---------- */
function crLgamma(x) {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - crLgamma(1 - x);
  x -= 1; let a = c[0]; const t = x + 7.5; for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function crBetacf(a, b, x) {
  const TINY = 1e-300, qab = a + b, qap = a + 1, qam = a - 1; let c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < TINY) d = TINY; d = 1 / d; let h = d;
  for (let m = 1; m <= 400; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY; c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY; c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY; d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 3e-16) break;
  }
  return h;
}
function crIbeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(crLgamma(a + b) - crLgamma(a) - crLgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * crBetacf(a, b, x) / a : 1 - bt * crBetacf(b, a, 1 - x) / b;
}
/* p bilateral da distribuição t de Student */
const crTp2 = (t, df) => df > 0 && isFinite(t) ? Math.min(1, Math.max(0, crIbeta(df / (df + t * t), df / 2, 0.5))) : null;
/* valor t crítico bilateral (conf = 0,95 → t que deixa 2,5% em cada cauda) */
function crTcrit(df, conf) {
  const a = 1 - (conf || 0.95); let lo = 0, hi = 1e4; for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (crTp2(mid, df) > a) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
/* cauda superior da qui-quadrado/gama regularizada Q(a, x) */
function crGammaQ(a, x) {
  if (x <= 0) return 1; const g = crLgamma(a);
  if (x < a + 1) { let ap = a, sum = 1 / a, del = sum; for (let n = 0; n < 1000; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-16) break; } return Math.max(0, 1 - sum * Math.exp(-x + a * Math.log(x) - g)); }
  const TINY = 1e-300; let b = x + 1 - a, c = 1 / TINY, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < TINY) d = TINY; c = b + an / c; if (Math.abs(c) < TINY) c = TINY; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-16) break; }
  return Math.exp(-x + a * Math.log(x) - g) * h;
}
const crChi2Sf = (x, k) => k > 0 ? crGammaQ(k / 2, x / 2) : null;
const crNormP2 = z => isFinite(z) ? crGammaQ(0.5, z * z / 2) : null;   /* p bilateral da normal padrão */

/* ---------- intervalos e comparações ---------- */
/* Fisher: Pearson EP = 1/√(n−3); Spearman EP = √((1+r²/2)/(n−3)) (Bonett & Wright). */
function crFisherCI(r, n, spearman, extra) {
  const d = n - 3 - (extra || 0); if (r == null || d < 1 || Math.abs(r) >= 1) return null;
  const se = (spearman ? Math.sqrt((1 + r * r / 2) / d) : 1 / Math.sqrt(d)), z = Math.atanh(r);
  return [Math.tanh(z - 1.959964 * se), Math.tanh(z + 1.959964 * se)];
}
const crRP = (r, n, extra) => { const df = n - 2 - (extra || 0); if (r == null || df < 1) return null; if (Math.abs(r) >= 1) return 0; return crTp2(r * Math.sqrt(df / (1 - r * r)), df); };
function crRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function crWelch(a, b) {
  const na = a.length, nb = b.length; if (na < 2 || nb < 2) return null; const ma = crMean(a), mb = crMean(b), va = crSd(a) ** 2, vb = crSd(b) ** 2, se2 = va / na + vb / nb;
  if (!(se2 > 0)) return null; const se = Math.sqrt(se2), t = (ma - mb) / se, df = se2 * se2 / ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1)), tc = crTcrit(df, 0.95);
  const sp = Math.sqrt(((na - 1) * va + (nb - 1) * vb) / (na + nb - 2)), d = sp > 0 ? (ma - mb) / sp : null, J = 1 - 3 / (4 * (na + nb) - 9);
  return { t, df, p: crTp2(t, df), diff: ma - mb, ci: [ma - mb - tc * se, ma - mb + tc * se], d, g: d == null ? null : d * J };
}
function crMannWhitney(a, b) {
  const na = a.length, nb = b.length; if (!na || !nb) return null; const all = a.concat(b), rk = crRanks(all); let ra = 0; for (let i = 0; i < na; i++) ra += rk[i];
  const U = ra - na * (na + 1) / 2, N = na + nb, mu = na * nb / 2, v = na * nb / 12 * ((N + 1) - crTies(all) / (N * (N - 1)));
  if (!(v > 0)) return null; const z = (Math.abs(U - mu) - 0.5) / Math.sqrt(v);
  return { U, z: U >= mu ? Math.max(0, z) : -Math.max(0, z), p: crNormP2(Math.max(0, z)), rb: 2 * U / (na * nb) - 1 };   /* rb > 0: a tende a ter valores maiores que b */
}
function crKruskal(groups) {
  const gs = groups.filter(g => g.length), k = gs.length, all = [].concat(...gs), N = all.length; if (k < 2 || N < 3) return null;
  const rk = crRanks(all); let pos = 0, s = 0; gs.forEach(g => { let r = 0; for (let i = 0; i < g.length; i++) r += rk[pos + i]; pos += g.length; s += r * r / g.length; });
  let H = 12 / (N * (N + 1)) * s - 3 * (N + 1); const c = 1 - crTies(all) / (N ** 3 - N); if (!(c > 0)) return null; H /= c;
  return { H, df: k - 1, p: crChi2Sf(Math.max(0, H), k - 1), eps2: Math.max(0, Math.min(1, H / (N - 1))) };
}
/* IC por reamostragem (percentil) da diferença de medianas; semente fixa → resultado reprodutível */
function crBootMedDiff(a, b, B) {
  if (a.length + b.length > 4000) return null; const rnd = crRng(20260601), out = [], pick = x => { const s = new Array(x.length); for (let i = 0; i < x.length; i++) s[i] = x[Math.floor(rnd() * x.length)]; return crMedian(s); };
  for (let i = 0; i < (B || 800); i++) out.push(pick(a) - pick(b)); out.sort((x, y) => x - y); return [crQuantile(out, 0.025), crQuantile(out, 0.975)];
}
/* Benjamini–Hochberg: valores q ajustados (monótonos) na mesma ordem de entrada */
function crBH(ps) {
  const idx = ps.map((p, i) => i).filter(i => crIsNum(ps[i])).sort((a, b) => ps[a] - ps[b]), m = idx.length, q = ps.map(() => null); let prev = 1;
  for (let k = m - 1; k >= 0; k--) { const v = Math.min(prev, ps[idx[k]] * m / (k + 1)); q[idx[k]] = Math.min(1, v); prev = q[idx[k]]; }
  return q;
}
/* Tendência: reta de mínimos quadrados e reta de Theil–Sen (mediana das inclinações, robusta a extremos) */
function crOls(xs, ys) { const n = xs.length, mx = crMean(xs), my = crMean(ys); let a = 0, b = 0; for (let i = 0; i < n; i++) { a += (xs[i] - mx) * (ys[i] - my); b += (xs[i] - mx) ** 2; } return b > 0 ? { slope: a / b, icpt: my - a / b * mx } : null; }
function crTheilSen(xs, ys) {
  let ix = xs.map((v, i) => i); if (ix.length > 300) { const st = ix.length / 300; ix = Array.from({ length: 300 }, (v, i) => Math.floor(i * st)); }
  const sl = []; for (let i = 0; i < ix.length; i++) for (let j = i + 1; j < ix.length; j++) { const dx = xs[ix[j]] - xs[ix[i]]; if (dx !== 0) sl.push((ys[ix[j]] - ys[ix[i]]) / dx); }
  if (!sl.length) return null; const slope = crMedian(sl); return { slope, icpt: crMedian(ys.map((y, i) => y - slope * xs[i])) };
}
/* Valores extremos pelo critério de Tukey (1,5 × IQR; "severo" a 3 × IQR) */
function crOutliers(a) {
  const s = crSorted(a), q1 = crQuantile(s, .25), q3 = crQuantile(s, .75), iqr = q3 - q1, idx = [], sev = [];
  if (!(iqr > 0)) return { q1, q3, lo: q1, hi: q3, idx, sev };
  a.forEach((v, i) => { if (v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr) idx.push(i); if (v < q1 - 3 * iqr || v > q3 + 3 * iqr) sev.push(i); });
  return { q1, q3, lo: q1 - 1.5 * iqr, hi: q3 + 1.5 * iqr, idx, sev };
}
function crDescribe(a) {
  const n = a.length; if (!n) return { n: 0 }; const s = crSorted(a), o = crOutliers(a);
  return { n, mean: crMean(a), sd: crSd(a), median: crQuantile(s, .5), q1: crQuantile(s, .25), q3: crQuantile(s, .75), min: s[0], max: s[n - 1], skew: crSkew(a), distinct: crDistinct(a), outIdx: o.idx, outSev: o.sev, fence: [o.lo, o.hi] };
}
/* Histograma (regra de Sturges, entre 4 e 12 faixas) */
function crHist(a) {
  const n = a.length; if (n < 3) return null; const mn = Math.min(...a), mx = Math.max(...a); if (mx === mn) return null;
  const k = Math.max(4, Math.min(12, Math.ceil(Math.log2(n) + 1))), w = (mx - mn) / k, bins = Array.from({ length: k }, (v, i) => ({ a: mn + i * w, b: mn + (i + 1) * w, n: 0 }));
  a.forEach(v => { bins[Math.min(k - 1, Math.floor((v - mn) / w))].n++; }); return { bins, min: mn, max: mx };
}
/* Intensidade descritiva (mesmos cortes da tela Análise); não é grau de importância clínica. */
const crStrengthOf = i => i == null ? null : i < .2 ? 'nenhuma' : i < .4 ? 'fraca' : i < .7 ? 'moderada' : 'forte';
const CR_STRENGTH_TXT = { nenhuma: 'praticamente nenhuma', fraca: 'fraca', moderada: 'moderada', forte: 'forte' };
const CR_STRENGTH_LV = { nenhuma: 0, fraca: 1, moderada: 2, forte: 3 };

/* ================= variáveis e unidades de observação ================= */
const CR_WD = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const CR_PER = { madrugada: 'Madrugada (0–5 h)', manha: 'Manhã (5–12 h)', tarde: 'Tarde (12–18 h)', noite: 'Noite (18–24 h)' };
const CR_MARKS = { estresse: 'Estresse', doente: 'Doente', sono: 'Dormi mal', alcool: 'Bebi álcool', fora: 'Comi fora', atraso: 'Refeição atrasada', viagem: 'Viagem' };
const CR_TRAIN = ['ativ', 'perna', 'superiores', 'treino'];
const CR_CAT = { ali: 'Alimentação', ins: 'Insulina registrada', ativ: 'Atividade física', ctx: 'Contexto e eventos', tempo: 'Horários e dias', exame: 'Exames' };
const CR_V = (l, u, f, o) => Object.assign({ l, u: u || '', t: 'num', f }, o || {});
const CR_BIN = (l, f, a, b, o) => Object.assign({ l, t: 'cat', f, lv: { sim: a, nao: b }, order: ['sim', 'nao'] }, o || {});
const CR_VARS = {
  carb_total: CR_V('Carboidratos totais da refeição (Bolus)', 'g', 'ali'), carb_liq: CR_V('Carboidratos líquidos da refeição (Bolus)', 'g', 'ali', { der: { hard: ['carb_total'] } }),
  carb_inf: CR_V('Carboidratos informados no registro', 'g', 'ali'), ins_rap: CR_V('Insulina rápida e de correção registradas', 'Ui', 'ins'),
  pre: CR_V('Glicemia anterior', 'mg/dL', 'gli'), post: CR_V('Glicemia posterior', 'mg/dL', 'gli'),
  delta: CR_V('Variação da glicemia (depois − antes)', 'mg/dL', 'gli', { der: { hard: ['post'], soft: ['pre'] } }),
  abs_delta: CR_V('Tamanho da variação (sem o sinal)', 'mg/dL', 'gli', { der: { hard: ['post', 'delta'], soft: ['pre'] } }),
  gap: CR_V('Intervalo entre as duas medições', 'min', 'tempo'), gap_meal: CR_V('Tempo da refeição até a medição posterior', 'min', 'tempo'),
  desde_ref: CR_V('Intervalo desde a refeição anterior do dia', 'h', 'tempo', { d: 1 }),
  refeicao: { l: 'Tipo de refeição', t: 'cat', f: 'ali', lv: { cafe: 'Café da manhã', almoco: 'Almoço', jantar: 'Jantar', lanche: 'Lanche', ceia: 'Ceia e outras' }, order: ['cafe', 'almoco', 'jantar', 'lanche', 'ceia'] },
  hora: CR_V('Horário', 'h', 'tempo', { fmt: 'hm' }), periodo: { l: 'Período do dia', t: 'cat', f: 'tempo', lv: CR_PER, order: ['madrugada', 'manha', 'tarde', 'noite'], der: { hard: ['hora'] } },
  semana: { l: 'Dia da semana', t: 'cat', f: 'tempo', lv: { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' }, order: [1, 2, 3, 4, 5, 6, 0] },
  fds: { l: 'Dia útil ou fim de semana', t: 'cat', f: 'tempo', lv: { util: 'Dia útil', fds: 'Fim de semana' }, order: ['util', 'fds'], der: { hard: ['semana'] } },
  ins_units: CR_V('Insulina rápida e de correção da aplicação', 'Ui', 'ins'), ins_basal: CR_V('Insulina basal registrada', 'Ui', 'ins'), jej: CR_V('Glicemia de jejum seguinte', 'mg/dL', 'gli'),
  grupo: { l: 'Atividade registrada antes da medição', t: 'cat', f: 'ativ', lv: { ativ: 'Depois de atividade registrada', ctrl: 'Sem atividade registrada' }, order: ['ativ', 'ctrl'] },
  ativ_min: CR_V('Duração da atividade registrada', 'min', 'ativ'), ativ_int: { l: 'Intensidade da atividade registrada', t: 'cat', f: 'ativ', lv: { 1: 'Confortável', 2: 'Normal', 3: 'Rigorosa' }, order: [1, 2, 3] },
  dia_media: CR_V('Glicemia média do dia', 'mg/dL', 'gli'), dia_dp: CR_V('Desvio-padrão da glicemia do dia', 'mg/dL', 'gli'), dia_cv: CR_V('Coeficiente de variação do dia', '%', 'gli', { der: { soft: ['dia_dp', 'dia_media'] } }),
  dia_pin: CR_V('Medições do dia dentro da faixa', '%', 'gli'), dia_n: CR_V('Medições registradas no dia', '', 'tempo', { d: 0 }), dia_hipo: CR_V('Medições abaixo da faixa no dia', '', 'gli', { d: 0 }),
  dia_ativ: CR_BIN('Atividade física no dia', 'ativ', 'Dias com atividade registrada', 'Dias sem atividade registrada'), ativ_total: CR_V('Minutos de atividade registrados no dia', 'min', 'ativ'),
  hba: CR_V('Hemoglobina glicada (exame)', '%', 'exame', { d: 1 }), media90: CR_V('Glicemia média dos 90 dias anteriores ao exame', 'mg/dL', 'gli'),
  glu: CR_V('Glicemia', 'mg/dL', 'gli'), desde_ant: CR_V('Intervalo desde a medição anterior', 'h', 'tempo', { d: 1 })
};
Object.entries(CR_MARKS).forEach(([k, l]) => { CR_VARS['m_' + k] = CR_BIN(`Marcação “${l}” no dia`, 'ctx', `Dias com “${l}”`, 'Dias sem a marcação'); });
const crVar = id => CR_VARS[id] || (/^ev_/.test(id) ? CR_VARS[id] : null);

/* ---------- utilitários de tempo e registros ---------- */
const crTimed = r => !!r && !r.noTime && typeof r.time === 'string' && /^\d{2}:\d{2}/.test(r.time) && crIsNum(r.ts);
const crHM = r => +r.time.slice(0, 2) + +r.time.slice(3, 5) / 60;
const crHTs = ts => { const d = new Date(ts); return d.getHours() + d.getMinutes() / 60; };
const crPeriodOf = h => h < 5 ? 'madrugada' : h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite';
const crDow = date => { const [y, m, d] = String(date).split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
const crWeekendOf = date => { const g = crDow(date); return g === 0 || g === 6; };
const crUnitsOf = r => (r.insMeal > 0 ? r.insMeal : 0) + (r.insCorr > 0 ? r.insCorr : 0);
const crIsAct = r => r.actMin > 0 || !!(r.actDesc && String(r.actDesc).trim()) || (r.marks || []).includes('ativ');
/* registro que "mexe" no resultado: refeição, insulina rápida, atividade ou marcação antes da refeição */
const crBusy = r => r.carbs > 0 || crUnitsOf(r) > 0 || crIsAct(r) || (r.context === 'antes' && !!r.meal);
const crHigh = r => r.context === 'jejum' ? CRL.FAST.high : CRL.LIM.high;
const crNorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const crHash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
function crLB(arr, ts) { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].ts < ts) lo = m + 1; else hi = m; } return lo; }   /* primeiro índice com ts >= valor */
function crUB(arr, ts) { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].ts <= ts) lo = m + 1; else hi = m; } return lo; }  /* primeiro índice com ts > valor */
const crIso = ts => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const crTimeVars = (ts, date) => { const h = crHTs(ts); return { hora: h, periodo: crPeriodOf(h), semana: crDow(date), fds: crWeekendOf(date) ? 'fds' : 'util' }; };

/* ---------- aplicações de insulina (registros de glicemia + histórico de insulinas), sem contar a mesma aplicação duas vezes ---------- */
function crDoses(timed, inslog, kinds, unitsOfRec) {
  const doses = [], linked = new Set(timed.map(r => r.insFrom).filter(Boolean));
  timed.forEach(r => { const u = unitsOfRec(r); if (u > 0) doses.push({ ts: r.ts, date: r.date, units: u, before: r, src: 'registro', carb: r.carbs > 0 ? r.carbs : null }); });
  (inslog || []).filter(e => e && crIsNum(e.ts) && kinds.includes(e.kind) && e.example !== true).forEach(e => {
    if (linked.has(e.id)) return;
    if (doses.some(d => d.src === 'registro' && Math.abs(d.ts - e.ts) <= 20 * 60e3)) return;
    const bf = timed.filter(r => r.ts <= e.ts + 5 * 60e3 && r.ts >= e.ts - 60 * 60e3).sort((a, b) => Math.abs(a.ts - e.ts) - Math.abs(b.ts - e.ts))[0] || null;
    const date = e.date || crIso(e.ts);
    doses.push({ ts: e.ts, date, units: crIsNum(e.units) && e.units > 0 ? e.units : null, before: bf, src: 'aplicacao', logId: e.id, carb: null });
  });
  return doses.sort((a, b) => a.ts - b.ts);
}

const CR_UNIT_DEF = {
  refeicao: { l: 'Refeições (glicemia antes → depois)', s: 'Refeições', f: 'ali', d: 'Cada observação é uma refeição com glicemia anterior (até 3 h antes) e posterior (30 min a 6 h depois) do mesmo dia e do mesmo tipo marcado por você; só entram intervalos de 1 a 5 h entre as duas medições.', strata: 'refeicao', lab: { hora: 'Horário da medição anterior à refeição' }, lim: ['Refeições de tipos diferentes (café, almoço, jantar) misturam tamanhos e horários.', 'Gordura, proteína, fibras, atividade e doses variam entre as refeições e nem sempre estão registradas.'] },
  insulina: { l: 'Aplicações de insulina rápida → medição seguinte', s: 'Insulina rápida', f: 'ins', d: 'Cada observação é uma aplicação de insulina rápida ou de correção registrada, com a primeira medição feita 1h30 a 5 h depois, sem outra aplicação, refeição ou atividade registrada no meio.', strata: 'periodo', lab: { hora: 'Horário da aplicação' }, lim: ['Não distingue o tipo de insulina nem a velocidade de ação.', 'Doses maiores costumam acompanhar refeições maiores ou glicemias iniciais mais altas.'] },
  basal: { l: 'Insulina basal → próxima glicemia de jejum', s: 'Insulina basal', f: 'ins', d: 'Cada observação é uma aplicação de insulina basal registrada e a primeira glicemia de jejum feita 4 a 20 h depois, sem outra basal registrada no meio.', lab: { hora: 'Horário da aplicação da basal' }, lim: ['A jejum reflete a noite inteira (alimentação, atividade, horário de dormir), não só a basal.'] },
  atividade: { l: 'Atividade registrada → medição seguinte', s: 'Atividade', f: 'ativ', d: 'Cada observação é um registro com atividade física e a primeira medição 30 min a 4 h depois, sem refeição, insulina ou outra atividade no meio. O grupo de comparação são medições sem atividade, carboidrato nem insulina registrados, no mesmo contexto e fora de dias de treino.', lab: { hora: 'Horário do registro da atividade' }, lim: ['A atividade é registrada na medição, sem o horário exato do exercício.', 'Atividade que não foi anotada entra no grupo “sem atividade registrada”.'] },
  dia: { l: 'Dias (resumo do dia)', s: 'Dias', f: 'ctx', d: `Cada observação é um dia com ${CR_MIN_DAY_N} ou mais medições. Atividade e marcações são registradas no dia, sem horário exato; a glicemia do dia mistura momentos antes e depois do evento.`, lim: ['“Sem marcação” significa que nada foi anotado, não que o evento não ocorreu.', 'Dias com mais medições mostram mais variação e mais picos.'] },
  exame: { l: 'Exames de hemoglobina glicada × 90 dias anteriores', s: 'Exames', f: 'exame', d: 'Cada observação é um exame de hemoglobina glicada comparado com a média das glicemias registradas nos 90 dias anteriores (mínimo de 20 medições em 12 dias).', lab: {}, lim: ['A hemoglobina glicada depende dos últimos 2 a 3 meses, com mais peso nas últimas semanas, e de fatores individuais.', 'Medições capilares pontuais não representam o dia inteiro.'] }
};

/* ---------- construção das unidades de observação ---------- */
function crBuild(records, opt) {
  opt = opt || {};
  const real = CRF.rfReal(records), dd = CRF.rfDedupeRecs(real), recs = dd.recs, timed = recs.filter(crTimed);
  const ex = {}, units = {}, bump = (u, why) => { (ex[u] || (ex[u] = {}))[why] = (ex[u][why] || 0) + 1; };
  const mk = (k, rows, extra) => {
    const seen = new Set(); let dup = 0; const rr = rows.filter(r => { if (seen.has(r.key)) { dup++; return false; } seen.add(r.key); return true; }).sort((a, b) => a.ts - b.ts);
    const base = CR_UNIT_DEF[k] || extra.def;
    units[k] = { k, l: base.l, s: base.s, f: base.f, d: base.d, lim: base.lim || [], strata: base.strata || null, lab: Object.assign({}, base.lab || {}, extra.lab || {}), vars: extra.vars, rows: rr, n: rr.length, days: new Set(rr.map(r => r.date)).size, dup, excl: ex[k] || {} };
  };
  /* 1. refeições */
  const built = CRF.rfBuild(records, opt.bl || { meals: [] }, { calc: opt.calc }), anchors = built.eps.filter(e => e.time && e.date).sort((a, b) => a.ts - b.ts), ai = new Map(anchors.map((a, i) => [a, i])), mealRows = [];
  built.eps.forEach(e => {
    if (!(e.pre || e.post)) return;
    if (!e.complete) { bump('refeicao', 'sem par antes/depois'); return; }
    if (e.gap < CRF.RF_GAP_SHORT || e.gap > CRF.RF_GAP_LONG) { bump('refeicao', 'intervalo fora de 1 a 5 h'); return; }
    let prev = null; for (let j = (ai.has(e) ? ai.get(e) : anchors.length) - 1; j >= 0; j--) { if (anchors[j].date !== e.date) break; if (anchors[j].ts < e.ts) { prev = anchors[j]; break; } }
    const pre = e.pre, post = e.post, ins = crUnitsOf(pre), t = crTimeVars(pre.ts, e.date);
    const v = { pre: pre.glucose, post: post.glucose, delta: e.delta, abs_delta: Math.abs(e.delta), gap: e.gap, gap_meal: e.gapMeal != null ? e.gapMeal : null, refeicao: e.meal, desde_ref: prev ? (e.ts - prev.ts) / 3.6e6 : null,
      carb_total: e.carbs && e.carbs.k === 'total' ? e.carbs.v : null, carb_liq: e.kind === 'log' && e.net > 0 ? e.net : null, carb_inf: e.carbs && e.carbs.k === 'informado' ? e.carbs.v : null, ins_rap: ins > 0 ? ins : null, hora: t.hora, periodo: t.periodo, semana: t.semana, fds: t.fds };
    mealRows.push({ key: pre.id + '>' + post.id, id: 'm:' + e.id, ts: pre.ts, date: e.date, v, rec: [pre.id, post.id], ep: e });
  });
  const MV = ['carb_total', 'carb_liq', 'carb_inf', 'ins_rap', 'pre', 'post', 'delta', 'abs_delta', 'gap', 'gap_meal', 'desde_ref', 'refeicao', 'hora', 'periodo', 'semana', 'fds'];
  mk('refeicao', mealRows, { vars: MV });
  CRF.RF_MEALS.forEach(m => { const rows = mealRows.filter(r => r.v.refeicao === m.k); if (rows.length) mk('ref:' + m.k, rows, { def: { l: `${m.t}: glicemia antes → depois`, s: m.s, f: 'ali', d: CR_UNIT_DEF.refeicao.d, lab: CR_UNIT_DEF.refeicao.lab, lim: CR_UNIT_DEF.refeicao.lim }, vars: MV.filter(x => x !== 'refeicao') }); });
  /* 2. insulina rápida */
  const doses = crDoses(timed, opt.inslog, ['fast', 'lunch', 'dinner'], crUnitsOf), insRows = [], usedNext = new Set();
  doses.forEach(d => {
    const j = crLB(timed, d.ts + 90 * 60e3), nx = timed[j]; if (!nx || nx.ts > d.ts + 300 * 60e3) { bump('insulina', 'sem medição entre 1h30 e 5 h depois'); return; }
    if (timed.slice(crUB(timed, d.ts), j).some(crBusy)) { bump('insulina', 'refeição, insulina ou atividade no meio'); return; }
    if (doses.some(o => o !== d && o.ts > d.ts + 60e3 && o.ts < nx.ts - 60e3)) { bump('insulina', 'outra aplicação no meio'); return; }
    if (usedNext.has(nx.id)) { bump('insulina', 'mesma medição já usada'); return; }
    usedNext.add(nx.id); const pre = d.before ? d.before.glucose : null, t = crTimeVars(d.ts, d.date);
    insRows.push({ key: 'i:' + (d.before ? d.before.id : d.logId) + '>' + nx.id, id: 'i:' + (d.logId || d.before.id), ts: d.ts, date: d.date, rec: [d.before && d.before.id, nx.id].filter(Boolean), v: { ins_units: d.units, carb_inf: d.carb, pre, post: nx.glucose, delta: pre != null ? nx.glucose - pre : null, abs_delta: pre != null ? Math.abs(nx.glucose - pre) : null, gap: Math.round((nx.ts - d.ts) / 60000), hora: t.hora, periodo: t.periodo, semana: t.semana, fds: t.fds } });
  });
  mk('insulina', insRows, { vars: ['ins_units', 'carb_inf', 'pre', 'post', 'delta', 'abs_delta', 'gap', 'hora', 'periodo', 'semana', 'fds'] });
  /* 3. insulina basal → próxima glicemia de jejum */
  const bas = [], linkedB = new Set(); timed.forEach(r => { if (r.insBasal > 0) { bas.push({ ts: r.ts, date: r.date, units: r.insBasal, rec: r }); linkedB.add(r.id); } });
  (opt.inslog || []).filter(e => e && e.kind === 'basal' && crIsNum(e.ts)).forEach(e => { if (!bas.some(b => Math.abs(b.ts - e.ts) <= 30 * 60e3)) { bas.push({ ts: e.ts, date: e.date || crIso(e.ts), units: crIsNum(e.units) && e.units > 0 ? e.units : null, logId: e.id }); } });
  bas.sort((a, b) => a.ts - b.ts); const basRows = [], usedJ = new Set();
  bas.forEach(b => {
    let nx = null; for (let j = crLB(timed, b.ts + 4 * 36e5); j < timed.length && timed[j].ts <= b.ts + 20 * 36e5; j++) if (timed[j].context === 'jejum') { nx = timed[j]; break; }
    if (!nx) { bump('basal', 'sem glicemia de jejum entre 4 e 20 h depois'); return; }
    if (bas.some(o => o !== b && o.ts > b.ts + 60e3 && o.ts < nx.ts - 60e3)) { bump('basal', 'outra basal no meio'); return; }
    if (usedJ.has(nx.id)) { bump('basal', 'mesma medição já usada'); return; } usedJ.add(nx.id);
    const t = crTimeVars(b.ts, b.date); basRows.push({ key: 'b:' + (b.rec ? b.rec.id : b.logId) + '>' + nx.id, id: 'b:' + (b.logId || b.rec.id), ts: b.ts, date: b.date, rec: [b.rec && b.rec.id, nx.id].filter(Boolean), v: { ins_basal: b.units, jej: nx.glucose, gap: Math.round((nx.ts - b.ts) / 36e5 * 10) / 10, hora: t.hora, periodo: t.periodo, semana: t.semana, fds: t.fds } });
  });
  mk('basal', basRows, { vars: ['ins_basal', 'jej', 'gap', 'hora', 'periodo', 'semana', 'fds'] });
  /* 4. atividade registrada × medições sem atividade (mesmo contexto) */
  const trainDays = new Set(recs.filter(r => crIsAct(r) || (r.marks || []).some(m => CR_TRAIN.includes(m))).map(r => r.date)), actRows = [], used = new Set(), allDoses = crDoses(timed, opt.inslog, ['fast', 'lunch', 'dinner', 'basal', 'extra'], r => crUnitsOf(r) + (r.insBasal > 0 ? r.insBasal : 0));
  const pairFor = (s, kind) => {
    const j = crLB(timed, s.ts + 30 * 60e3), nx = timed[j]; if (!nx || nx.ts > s.ts + 240 * 60e3) return bump('atividade', 'sem medição entre 30 min e 4 h depois');
    if (timed.slice(crUB(timed, s.ts), j).some(crBusy)) return bump('atividade', 'refeição, insulina ou atividade no meio');
    if (allDoses.some(o => o.ts > s.ts + 60e3 && o.ts < nx.ts - 60e3)) return bump('atividade', 'insulina no meio');
    if (used.has(nx.id) || used.has(s.id)) return bump('atividade', 'mesma medição já usada');
    used.add(nx.id); used.add(s.id); const t = crTimeVars(s.ts, s.date);
    actRows.push({ key: 'a:' + s.id + '>' + nx.id, id: 'a:' + s.id, ts: s.ts, date: s.date, rec: [s.id, nx.id], ctx: s.context || '', v: { grupo: kind, ativ_min: kind === 'ativ' && s.actMin > 0 ? s.actMin : null, ativ_int: kind === 'ativ' && s.actInt >= 1 && s.actInt <= 3 ? s.actInt : null, pre: s.glucose, post: nx.glucose, delta: nx.glucose - s.glucose, abs_delta: Math.abs(nx.glucose - s.glucose), gap: Math.round((nx.ts - s.ts) / 60000), hora: t.hora, periodo: t.periodo, semana: t.semana, fds: t.fds } });
  };
  const actStarts = timed.filter(crIsAct), actCtx = new Set(actStarts.map(r => r.context || ''));
  actStarts.forEach(s => { if (s.carbs > 0 || crUnitsOf(s) > 0) { bump('atividade', 'carboidrato ou insulina no mesmo registro'); return; } pairFor(s, 'ativ'); });
  timed.filter(s => !crBusy(s) && !(s.insBasal > 0) && !trainDays.has(s.date) && !(s.marks || []).includes('hipo') && s.glucose >= CRL.LIM.low && actCtx.has(s.context || '')).forEach(s => pairFor(s, 'ctrl'));
  mk('atividade', actRows, { vars: ['grupo', 'ativ_min', 'ativ_int', 'pre', 'post', 'delta', 'abs_delta', 'gap', 'hora', 'periodo', 'semana', 'fds'] });
  /* 5. dias */
  const byDate = new Map(); recs.forEach(r => { (byDate.get(r.date) || byDate.set(r.date, []).get(r.date)).push(r); });
  const evs = new Map(); (opt.events || []).filter(e => e && e.date && e.text).forEach(e => { const k = crNorm(e.text); if (!k) return; const o = evs.get(k) || { text: String(e.text).trim(), dates: new Set() }; o.dates.add(e.date); evs.set(k, o); });
  const evList = [...evs.entries()].map(([k, o]) => ({ k, id: 'ev_' + crHash(k), text: o.text, dates: o.dates })).filter(o => [...o.dates].filter(d => (byDate.get(d) || []).length >= CR_MIN_DAY_N).length >= CR_MIN_GROUP).sort((a, b) => b.dates.size - a.dates.size).slice(0, 6);
  evList.forEach(o => { CR_VARS[o.id] = CR_BIN(`Evento “${o.text}” no dia`, 'ctx', `Dias com “${o.text}”`, 'Dias sem o evento'); });
  const dayRows = [];
  byDate.forEach((rs, date) => {
    if (rs.length < CR_MIN_DAY_N) { bump('dia', `menos de ${CR_MIN_DAY_N} medições`); return; }
    const g = rs.map(r => r.glucose), m = crMean(g), sd = crSd(g), acts = rs.filter(crIsAct), has = acts.length > 0 || rs.some(r => (r.marks || []).some(x => CR_TRAIN.includes(x))), no = rs.some(r => (r.marks || []).includes('semtreino'));
    const v = { dia_media: m, dia_dp: sd, dia_cv: m > 0 && sd != null ? sd / m * 100 : null, dia_pin: rs.filter(r => r.glucose >= CRL.LIM.low && r.glucose <= crHigh(r)).length / rs.length * 100, dia_n: rs.length, dia_hipo: rs.filter(r => r.glucose < CRL.LIM.low).length,
      dia_ativ: has && no ? null : has ? 'sim' : 'nao', ativ_total: acts.some(r => r.actMin > 0) ? acts.reduce((s, r) => s + (r.actMin > 0 ? r.actMin : 0), 0) : null, semana: crDow(date), fds: crWeekendOf(date) ? 'fds' : 'util' };
    if (has && no) bump('dia', 'atividade e “dia sem treino” no mesmo dia');
    Object.keys(CR_MARKS).forEach(k => { v['m_' + k] = rs.some(r => (r.marks || []).includes(k)) ? 'sim' : 'nao'; });
    evList.forEach(o => { v[o.id] = o.dates.has(date) ? 'sim' : 'nao'; });
    dayRows.push({ key: 'd:' + date, id: 'd:' + date, ts: rs[0].ts, date, v, rec: rs.map(r => r.id) });
  });
  mk('dia', dayRows, { vars: ['dia_media', 'dia_dp', 'dia_cv', 'dia_pin', 'dia_n', 'dia_hipo', 'dia_ativ', 'ativ_total', 'semana', 'fds'].concat(Object.keys(CR_MARKS).map(k => 'm_' + k), evList.map(o => o.id)) });
  /* 6. medições dentro de um mesmo contexto (jejum; antes/depois de cada refeição): nunca misturadas entre contextos */
  const CTX = { jejum: 'em jejum', deitar: 'ao deitar', madrugada: 'na madrugada' }, medGroups = new Map();
  timed.forEach((r, i) => {
    let k = null, l = null;
    if (CTX[r.context]) { k = r.context; l = 'Medições ' + CTX[r.context]; } else if ((r.context === 'antes' || r.context === 'depois') && CRF.RF_MEALS.some(m => m.k === r.meal)) { k = r.context + ':' + r.meal; l = `Medições ${r.context === 'antes' ? 'antes' : 'depois'} ${r.meal === 'cafe' ? 'do café da manhã' : r.meal === 'almoco' ? 'do almoço' : r.meal === 'jantar' ? 'do jantar' : r.meal === 'lanche' ? 'do lanche' : 'da ceia'}`; }
    if (!k) return; const prev = i > 0 ? timed[i - 1] : null, t = crTimeVars(r.ts, r.date), g = (r.ts - (prev ? prev.ts : r.ts)) / 3.6e6;
    (medGroups.get(k) || medGroups.set(k, { l, rows: [] }).get(k)).rows.push({ key: 'g:' + r.id, id: 'g:' + r.id, ts: r.ts, date: r.date, rec: [r.id], v: { glu: r.glucose, hora: t.hora, semana: t.semana, fds: t.fds, desde_ant: prev && g <= 24 ? g : null } });
  });
  medGroups.forEach((o, k) => mk('med:' + k, o.rows, { def: { l: o.l, s: o.l.replace('Medições ', ''), f: 'tempo', d: 'Cada observação é uma medição com horário, comparada só com medições do mesmo contexto (valores em jejum, antes ou depois da mesma refeição não se misturam).', lab: { hora: 'Horário da medição' }, lim: ['Dentro de um mesmo contexto, o horário também muda com a rotina (dias de semana e fim de semana).'] }, vars: ['glu', 'hora', 'semana', 'fds', 'desde_ant'] }));
  /* 7. exames: hemoglobina glicada × média dos 90 dias anteriores */
  const hbaRows = []; (opt.hba || []).filter(h => h && h.example !== true && h.source !== 'exemplo' && crIsNum(h.value) && /^\d{4}-\d{2}-\d{2}$/.test(h.date || '')).forEach(h => {
    const t1 = new Date(h.date + 'T23:59:59').getTime(), w = recs.filter(r => r.ts <= t1 && r.ts > t1 - 90 * 864e5);
    if (w.length < 20 || new Set(w.map(r => r.date)).size < 12) { bump('exame', 'poucas medições nos 90 dias anteriores'); return; }
    hbaRows.push({ key: 'h:' + h.date + ':' + h.value, id: 'h:' + (h.id || h.date), ts: t1, date: h.date, rec: [], hbaId: h.id, v: { hba: h.value, media90: crMean(w.map(r => r.glucose)) } });
  });
  mk('exame', hbaRows, { vars: ['hba', 'media90'] });
  const q = { records: recs.length, dup: dd.dup, noTime: recs.length - timed.length, examples: (records || []).length - real.length, eps: built.eps.length, epsComplete: mealRows.length, dupMeals: built.dupMeals };
  return { units, quality: q, recs, built, doses, evList };
}

/* ================= análise de um par de variáveis ================= */
const crFmt = (x, d) => x == null || !isFinite(x) ? '—' : x.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const crSg = (x, d) => x == null ? '—' : (x > 0 ? '+' : x < 0 ? '−' : '') + crFmt(Math.abs(x), d);
const crVL = (u, id) => (u && u.lab && u.lab[id]) || (CR_VARS[id] || {}).l || id;
function crFV(id, v) {
  const V = CR_VARS[id] || {}; if (v == null || !isFinite(v)) return '—'; if (V.fmt === 'hm') { const t = Math.round(v * 60), h = Math.floor(t / 60) % 24, m = t % 60; return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }
  return crFmt(v, V.d != null ? V.d : /^ins_/.test(id) ? 1 : 0);
}
const crUnitTxt = id => { const u = (CR_VARS[id] || {}).u; return u ? ' ' + u : ''; };
const crLevel = (id, k) => { const V = CR_VARS[id] || {}; return V.lv && V.lv[k] != null ? V.lv[k] : String(k); };
function crPairRule(u, x, y) {
  if (x === y) return { ok: false, why: 'Escolha duas informações diferentes.' };
  const X = CR_VARS[x], Y = CR_VARS[y];
  if (!X || !Y || !u || !u.vars.includes(x) || !u.vars.includes(y)) return { ok: false, why: 'Uma das informações não existe neste tipo de observação.' };
  const rel = (a, b) => { const d = CR_VARS[a].der; return d ? (d.hard && d.hard.includes(b) ? 'hard' : d.soft && d.soft.includes(b) ? 'soft' : null) : null; };
  const h = rel(x, y) || rel(y, x);
  if (h === 'hard') return { ok: false, why: 'Uma delas é calculada a partir da outra: a associação seria automática e não revelaria nada novo.' };
  if (X.t === 'cat' && Y.t === 'cat') return { ok: false, why: 'Duas informações em categorias não têm um método estatístico apropriado aqui. Compare uma categoria com uma medida numérica.' };
  return { ok: true, coupled: h === 'soft', kind: X.t === 'num' && Y.t === 'num' ? 'corr' : 'group' };
}
function crCatOf(u, x, y) {
  const fs = [CR_VARS[x].f, CR_VARS[y].f]; for (const k of ['ins', 'ali', 'ativ', 'ctx', 'exame', 'tempo']) if (fs.includes(k)) return k; return u.f || 'ctx';
}
const crBase = (u, x, y, rule, kind) => ({ id: u.k + '|' + x + '|' + y, ok: false, kind, unit: u.k, unitL: u.l, unitS: u.s, x, y, xl: crVL(u, x), yl: crVL(u, y), cat: crCatOf(u, x, y), coupled: !!rule.coupled, noDose: [x, y].some(i => /^ins_/.test(i)), limits: (u.lim || []).slice(), flags: [] });
const crBad = (res, why, code) => Object.assign(res, { ok: false, why, code });
const crSign = v => v > 0 ? 1 : v < 0 ? -1 : 0;
const CR_MEANING = {
  spearman: 'O coeficiente de Spearman (ρ) compara a ordem dos valores e vai de −1 a +1. Perto de 0, os valores quase não andam juntos; positivo, valores maiores de uma informação tendem a vir com valores maiores da outra; negativo, com valores menores. Não diz quanto uma muda quando a outra muda.',
  pearson: 'O coeficiente de Pearson (r) mede o quanto os pontos se alinham numa reta e vai de −1 a +1. Perto de 0, não há alinhamento linear; positivo, as duas sobem juntas; negativo, uma sobe quando a outra desce.',
  welch: 'O teste de Welch compara as médias dos dois grupos. A diferença vem com o intervalo de confiança de 95%; o d de Cohen expressa a diferença em desvios-padrão (cerca de 0,2 pequena, 0,5 média, 0,8 grande, só como referência).',
  mannwhitney: 'O teste de Mann–Whitney compara a posição dos valores entre os dois grupos, sem supor distribuição simétrica. O r de postos vai de −1 a +1 e indica o quanto os valores de um grupo tendem a superar os do outro.',
  kruskal: 'O teste de Kruskal–Wallis verifica se ao menos um dos grupos tende a ter valores diferentes dos demais, sem supor distribuição simétrica. O ε² (de 0 a 1) é a parcela da variação, em postos, associada ao grupo; ele não diz qual grupo difere.'
};
const CR_DISCLAIMER = 'Associação estatística não demonstra que uma informação provocou a outra. Não é orientação de tratamento, de dose ou de alimentação.';
const CR_NODOSE = 'Esta relação não representa a resposta do seu corpo à insulina e não serve para calcular ou ajustar doses.';

function crCorrelate(u, xid, yid, rule) {
  const res = crBase(u, xid, yid, rule, 'corr'), rows = u.rows.filter(r => crIsNum(r.v[xid]) && crIsNum(r.v[yid])), n = rows.length, days = new Set(rows.map(r => r.date)).size;
  Object.assign(res, { n, days, missing: u.rows.length - n });
  if (n < CR_MIN_N) return crBad(res, `Poucas observações com as duas informações: ${n} (mínimo ${CR_MIN_N}). Em amostras pequenas um coeficiente engana: não é calculado.`, 'amostra');
  if (days < CR_MIN_DAYS) return crBad(res, `As observações estão em poucos dias diferentes: ${days} (mínimo ${CR_MIN_DAYS}). Observações do mesmo dia não são independentes.`, 'dias');
  const xs = rows.map(r => r.v[xid]), ys = rows.map(r => r.v[yid]), dx = crDescribe(xs), dy = crDescribe(ys);
  if (dx.distinct < CR_MIN_DISTINCT || dy.distinct < CR_MIN_DISTINCT) return crBad(res, `Uma das informações assume poucos valores diferentes (${res.xl}: ${dx.distinct}; ${res.yl}: ${dy.distinct}; mínimo ${CR_MIN_DISTINCT}). Use a comparação entre grupos.`, 'constante');
  const rs = crSpearman(xs, ys), rp = crPearson(xs, ys); if (rs == null || rp == null) return crBad(res, 'Uma das informações é praticamente constante: não há variação para associar.', 'constante');
  const why = []; if (n < 15) why.push('menos de 15 pares'); if (Math.abs(dx.skew) > 1 || Math.abs(dy.skew) > 1) why.push('distribuição assimétrica'); if (dx.outSev.length || dy.outSev.length) why.push('valores extremos'); if (dx.distinct < 8 || dy.distinct < 8) why.push('poucos valores diferentes'); if (Math.abs(rs - rp) >= 0.1) why.push('Pearson e Spearman divergem (relação pouco linear)');
  const method = why.length ? 'spearman' : 'pearson', f = method === 'spearman' ? crSpearman : crPearson, coef = method === 'spearman' ? rs : rp;
  const out = new Set([...dx.outIdx, ...dy.outIdx]), ci = crFisherCI(coef, n, method === 'spearman'), p = crRP(coef, n), idx = Math.abs(coef);
  Object.assign(res, { ok: true, method, methodWhy: why.length ? 'Spearman, porque há ' + why.join('; ') + '.' : 'Pearson, porque a relação parece linear, as distribuições são simétricas, não há extremos severos e há 15 pares ou mais.', coef, ci, p, idx, strength: crStrengthOf(idx), dir: crSign(coef), rs, rp, dx, dy, meaning: CR_MEANING[method], outN: out.size });
  /* valores extremos: o coeficiente muda sem eles? */
  if (out.size) { const keep = rows.map((r, i) => i).filter(i => !out.has(i)); if (keep.length >= CR_MIN_N) { const c2 = f(keep.map(i => xs[i]), keep.map(i => ys[i])); res.noOut = { coef: c2, n: keep.length }; if (c2 != null && Math.abs(c2 - coef) >= 0.15) res.flags.push({ k: 'extremos', t: `Há ${out.size} observação${out.size > 1 ? 'ões' : ''} com valor extremo; sem ela${out.size > 1 ? 's' : ''} o coeficiente seria ${crFmt(c2, 2)} (era ${crFmt(coef, 2)}). O resultado é sensível a elas.` }); else res.flags.push({ k: 'extremos-ok', t: `Há ${out.size} observação${out.size > 1 ? 'ões' : ''} com valor extremo; sem ela${out.size > 1 ? 's' : ''} o coeficiente seria ${crFmt(c2, 2)}, próximo do calculado.` }); } }
  /* estabilidade: coeficiente ao retirar um registro de cada vez */
  const pick = n > CR_MAX_LOO ? Array.from({ length: CR_MAX_LOO }, (v, i) => Math.floor(i * n / CR_MAX_LOO)) : [...Array(n).keys()]; let lo = Infinity, hi = -Infinity;
  pick.forEach(i => { const c = f(xs.filter((v, j) => j !== i), ys.filter((v, j) => j !== i)); if (c != null) { lo = Math.min(lo, c); hi = Math.max(hi, c); } });
  res.loo = [lo, hi]; res.inconclusive = !!ci && ci[0] <= 0 && ci[1] >= 0; res.unstable = (hi - lo) >= CR_LOO_UNSTABLE || (lo < 0 && hi > 0 && idx >= 0.1);
  if (res.unstable) res.flags.push({ k: 'instavel', t: `Resultado instável: ao retirar um registro por vez, o coeficiente foi de ${crFmt(lo, 2)} a ${crFmt(hi, 2)}.` });
  if (res.inconclusive) res.flags.push({ k: 'inconclusivo', t: 'O intervalo de confiança inclui o zero: com estes dados não é possível afirmar sequer a direção da associação.' });
  /* glicemia inicial como fator de confusão: correlação parcial */
  if (u.vars.includes('pre') && xid !== 'pre' && yid !== 'pre') {
    const r2 = rows.filter(r => crIsNum(r.v.pre));
    if (r2.length >= CR_MIN_N + 3) {
      const a = r2.map(r => r.v[xid]), b = r2.map(r => r.v[yid]), z = r2.map(r => r.v.pre), rxy = f(a, b), rxz = f(a, z), ryz = f(b, z), pc = rxy != null && rxz != null && ryz != null ? crPartial(rxy, rxz, ryz) : null;
      if (pc != null) { res.adj = { coef: pc, ci: crFisherCI(pc, r2.length, method === 'spearman', 1), p: crRP(pc, r2.length, 1), n: r2.length, rxz, ryz, by: 'glicemia anterior' }; if (Math.abs(rxz) >= 0.3 && Math.abs(ryz) >= 0.3) res.flags.push({ k: 'confusao', t: `A glicemia anterior anda junto com as duas informações (${crFmt(rxz, 2)} e ${crFmt(ryz, 2)}); ela pode estar influenciando o resultado. Ajustada por ela, a associação é ${crFmt(pc, 2)}.` }); }
    }
  }
  /* mistura de contextos: o sinal se mantém dentro de cada estrato? */
  if (u.strata && xid !== u.strata && yid !== u.strata && u.vars.includes(u.strata)) {
    const m = new Map(); rows.forEach(r => { const k = r.v[u.strata]; if (k != null) (m.get(k) || m.set(k, []).get(k)).push(r); });
    const st = [...m.entries()].filter(([k, a]) => a.length >= 8 && new Set(a.map(r => r.date)).size >= 3).map(([k, a]) => ({ key: k, label: crLevel(u.strata, k), n: a.length, coef: f(a.map(r => r.v[xid]), a.map(r => r.v[yid])) })).filter(s => s.coef != null);
    if (st.length >= 2) { res.strata = st; const bad = st.filter(s => crSign(s.coef) !== crSign(coef) && Math.abs(s.coef) >= 0.2); if (bad.length) res.flags.push({ k: 'simpson', t: `O sentido da associação muda dentro de ${bad.map(s => s.label.toLowerCase()).join(', ')}: misturar esses grupos pode esconder ou inverter o resultado.` }); }
  }
  const dc = new Map(); rows.forEach(r => dc.set(r.date, (dc.get(r.date) || 0) + 1)); const top = Math.max(...dc.values());
  if (n >= 10 && top / n > 0.35 && top >= 3) res.flags.push({ k: 'concentrado', t: `${crFmt(top / n * 100, 0)}% das observações são de um único dia.` });
  else if (n / days > 3) res.flags.push({ k: 'agrupado', t: `Há em média ${crFmt(n / days, 1)} observações por dia; as do mesmo dia não são independentes, então a incerteza real pode ser maior que a mostrada.` });
  if (res.coupled) res.flags.push({ k: 'acoplado', t: 'A variação é calculada com a glicemia anterior (depois − antes). Glicemias iniciais altas tendem a mostrar quedas e baixas, altas por construção, então esta associação é em parte automática.' });
  if (Math.abs(dx.skew) > 1 || Math.abs(dy.skew) > 1) res.flags.push({ k: 'assimetria', t: 'Pelo menos uma das distribuições é bastante assimétrica; por isso o método considera a ordem dos valores.' });
  const tr = method === 'pearson' ? crOls(xs, ys) : crTheilSen(xs, ys); res.trend = tr ? Object.assign(tr, { kind: method === 'pearson' ? 'mínimos quadrados' : 'Theil–Sen (robusta a extremos)' }) : null;
  res.points = rows.map((r, i) => ({ x: xs[i], y: ys[i], id: r.id, date: r.date, ts: r.ts, rec: r.rec, out: out.has(i), hbaId: r.hbaId })); res.recIds = [...new Set([].concat(...rows.map(r => r.rec)))];
  res.dist = { x: crHist(xs), y: crHist(ys) }; return res;
}

function crCompare(u, gid, vid, rule) {
  const res = crBase(u, gid, vid, rule, 'group'), G = CR_VARS[gid], rows = u.rows.filter(r => r.v[gid] != null && crIsNum(r.v[vid]));
  Object.assign(res, { g: gid, v: vid, gl: crVL(u, gid), vl: crVL(u, vid), x: gid, y: vid, xl: crVL(u, gid), yl: crVL(u, vid), missing: u.rows.length - rows.length });
  const ord = (G.order || []).map(String), keys = [...new Set(rows.map(r => String(r.v[gid])))].sort((a, b) => (ord.indexOf(a) < 0 ? 99 : ord.indexOf(a)) - (ord.indexOf(b) < 0 ? 99 : ord.indexOf(b)) || a.localeCompare(b));
  const all = keys.map(k => { const rr = rows.filter(r => String(r.v[gid]) === k); return { key: k, label: crLevel(gid, G.lv && G.lv[k] == null && !isNaN(+k) ? +k : k), rows: rr, vals: rr.map(r => r.v[vid]) }; });
  const use = all.filter(g => g.vals.length >= CR_MIN_GROUP), dropped = all.filter(g => g.vals.length < CR_MIN_GROUP);
  res.dropped = dropped.map(g => ({ label: g.label, n: g.vals.length }));
  if (use.length < 2) return crBad(res, `É preciso ao menos dois grupos com ${CR_MIN_GROUP} observações ou mais. ${all.map(g => `${g.label}: ${g.vals.length}`).join('; ') || 'Sem observações'}.`, 'amostra');
  const ur = [].concat(...use.map(g => g.rows)), n = ur.length, days = new Set(ur.map(r => r.date)).size; Object.assign(res, { n, days });
  if (n < CR_MIN_N) return crBad(res, `Poucas observações: ${n} (mínimo ${CR_MIN_N}).`, 'amostra');
  if (days < CR_MIN_DAYS) return crBad(res, `As observações estão em poucos dias diferentes: ${days} (mínimo ${CR_MIN_DAYS}).`, 'dias');
  if (crDistinct(ur.map(r => r.v[vid])) < 3) return crBad(res, 'A medida comparada assume poucos valores diferentes.', 'constante');
  res.groups = use.map(g => Object.assign(crDescribe(g.vals), { key: g.key, label: g.label, vals: g.vals, points: g.rows.map((r, i) => ({ y: g.vals[i], id: r.id, date: r.date, rec: r.rec, out: crDescribe(g.vals).outIdx.includes(i) })) }));
  const allOut = res.groups.reduce((s, g) => s + g.outIdx.length, 0), k = use.length;
  if (k === 2) {
    const [A, B] = use, a = A.vals, b = B.vals, dA = res.groups[0], dB = res.groups[1], okW = a.length >= 15 && b.length >= 15 && Math.abs(dA.skew) <= 1 && Math.abs(dB.skew) <= 1 && !dA.outSev.length && !dB.outSev.length;
    const W = crWelch(a, b), M = crMannWhitney(a, b); if (!M) return crBad(res, 'Os valores são praticamente constantes: não há o que comparar.', 'constante');
    const method = okW && W ? 'welch' : 'mannwhitney', medDiff = dA.median - dB.median, rEq = W && W.d != null ? W.d / Math.sqrt(W.d * W.d + 4) : null;
    const idx = method === 'welch' ? Math.abs(rEq) : Math.abs(M.rb), boot = method === 'mannwhitney' ? crBootMedDiff(a, b) : null, ci = method === 'welch' ? W.ci : boot;
    Object.assign(res, { ok: true, method, methodWhy: method === 'welch' ? 'Welch, porque os dois grupos têm 15 observações ou mais, distribuição simétrica e sem extremos severos.' : 'Mann–Whitney, porque ' + [(a.length < 15 || b.length < 15) ? 'algum grupo tem menos de 15 observações' : '', (Math.abs(dA.skew) > 1 || Math.abs(dB.skew) > 1) ? 'a distribuição é assimétrica' : '', (dA.outSev.length || dB.outSev.length) ? 'há valores extremos' : ''].filter(Boolean).join('; ') + '.', p: method === 'welch' ? W.p : M.p, idx, strength: crStrengthOf(idx),
      effect: { diffMean: W ? W.diff : null, diffMedian: medDiff, ci, ciKind: method === 'welch' ? 'diferença de médias' : 'diferença de medianas (reamostragem)', d: W ? W.g : null, rb: M.rb, rEq }, check: { welchP: W ? W.p : null, mwP: M.p }, meaning: CR_MEANING[method], higher: (method === 'welch' ? W.diff : medDiff) >= 0 ? A.label : B.label });
    res.A = res.groups[0]; res.B = res.groups[1]; res.inconclusive = !!ci && ci[0] <= 0 && ci[1] >= 0; res.coef = method === 'welch' ? W.diff : medDiff; res.dir = crSign(res.coef);
  } else {
    const K = crKruskal(use.map(g => g.vals)); if (!K) return crBad(res, 'Os valores são praticamente constantes: não há o que comparar.', 'constante');
    const idx = Math.sqrt(K.eps2); Object.assign(res, { ok: true, method: 'kruskal', methodWhy: `Kruskal–Wallis, porque há ${k} grupos e a comparação por postos não exige distribuição simétrica.`, p: K.p, idx, strength: crStrengthOf(idx), effect: { H: K.H, df: K.df, eps2: K.eps2 }, meaning: CR_MEANING.kruskal, coef: K.eps2, dir: 0, inconclusive: K.p >= 0.05 });
    const ms = res.groups.slice().sort((x, y) => y.median - x.median); res.higher = ms[0].label; res.lower = ms[ms.length - 1].label;
  }
  res.unstable = !!res.inconclusive;
  if (res.inconclusive) res.flags.push({ k: 'inconclusivo', t: res.method === 'kruskal' ? 'O teste não distingue os grupos (p ≥ 0,05): as diferenças observadas podem ser acaso.' : 'O intervalo de confiança da diferença inclui o zero: não é possível afirmar a direção da diferença.' });
  if (allOut) res.flags.push({ k: 'extremos-ok', t: `Há ${allOut} valor${allOut > 1 ? 'es' : ''} extremo${allOut > 1 ? 's' : ''} nos grupos (critério de Tukey); a comparação por postos reduz a influência deles.` });
  if (dropped.length) res.flags.push({ k: 'grupos', t: `Grupos com menos de ${CR_MIN_GROUP} observações ficaram de fora: ${dropped.map(g => `${g.label} (${g.vals.length})`).join(', ')}.` });
  /* desequilíbrio entre grupos em fatores que também influenciam o resultado */
  const conf = []; ['pre', 'dia_n'].forEach(c => {
    if (!u.vars.includes(c) || c === vid) return; const gs = use.map(g => g.rows.map(r => r.v[c]).filter(crIsNum)); if (gs.some(a => a.length < CR_MIN_GROUP)) return;
    const t = gs.length === 2 ? crMannWhitney(gs[0], gs[1]) : crKruskal(gs), eff = gs.length === 2 ? t && Math.abs(t.rb) : t && Math.sqrt(t.eps2);
    if (t && t.p < 0.05 && eff >= 0.3) conf.push(c === 'pre' ? 'a glicemia anterior' : 'a quantidade de medições do dia');
  });
  if (conf.length) res.flags.push({ k: 'confusao', t: `Os grupos diferem em ${conf.join(' e ')}, que também influencia${conf.length > 1 ? 'm' : ''} o resultado; a diferença pode refletir isso.` });
  if (u.k === 'dia' && gid !== 'fds') { const sh = use.map(g => g.rows.filter(r => r.v.fds === 'fds').length / g.rows.length); if (Math.max(...sh) - Math.min(...sh) >= 0.25) res.flags.push({ k: 'confusao', t: 'A proporção de fins de semana é bem diferente entre os grupos; o dia da semana pode estar influenciando.' }); }
  res.points = ur.map(r => ({ y: r.v[vid], g: String(r.v[gid]), id: r.id, date: r.date, rec: r.rec })); res.recIds = [...new Set([].concat(...ur.map(r => r.rec)))];
  const hv = crHist(ur.map(r => r.v[vid])); res.dist = { y: hv }; return res;
}

function crAnalyze(model, unitK, x, y) {
  const u = model.units[unitK]; if (!u) return { ok: false, why: 'Tipo de observação desconhecido.', code: 'unidade' };
  const rule = crPairRule(u, x, y); if (!rule.ok) return Object.assign(crBase(u, x, y, {}, 'invalid'), { ok: false, why: rule.why, code: 'regra' });
  const X = CR_VARS[x], Y = CR_VARS[y]; return X.t === 'num' && Y.t === 'num' ? crCorrelate(u, x, y, rule) : X.t === 'num' ? crCompare(u, y, x, rule) : crCompare(u, x, y, rule);
}
/* Combinações que a interface pode oferecer para uma variável: só as tecnicamente válidas, com a quantidade de observações. */
function crCombos(model, unitK, x) {
  const u = model.units[unitK]; if (!u || !u.vars.includes(x)) return [];
  return u.vars.filter(v => v !== x).map(v => { const r = crPairRule(u, x, v); if (!r.ok) return null; const X = CR_VARS[x], Y = CR_VARS[v], num = X.t === 'num' && Y.t === 'num', gid = X.t === 'cat' ? x : v, vid = X.t === 'cat' ? v : x;
    const n = num ? u.rows.filter(rw => crIsNum(rw.v[x]) && crIsNum(rw.v[v])).length : u.rows.filter(rw => rw.v[gid] != null && crIsNum(rw.v[vid])).length; return { id: v, label: crVL(u, v), n, ok: n >= CR_MIN_N, coupled: r.coupled, kind: r.kind }; }).filter(Boolean);
}
const crUnitList = model => Object.values(model.units).map(u => ({ k: u.k, l: u.l, n: u.n, days: u.days, ok: u.n >= CR_MIN_N && u.days >= CR_MIN_DAYS })).sort((a, b) => (b.ok - a.ok) || b.n - a.n);

/* ================= matriz de correlação (Spearman, par a par) ================= */
function crMatrix(model, unitK, ids) {
  const u = model.units[unitK]; if (!u) return null; const vars = (ids || u.vars).filter(v => u.vars.includes(v) && CR_VARS[v].t === 'num' && u.rows.filter(r => crIsNum(r.v[v])).length >= CR_MIN_N);
  const cells = vars.map(a => vars.map(b => {
    if (a === b) return { self: true };
    const rule = crPairRule(u, a, b); if (!rule.ok) return { na: 'calc', why: rule.why };
    const rows = u.rows.filter(r => crIsNum(r.v[a]) && crIsNum(r.v[b])), n = rows.length, days = new Set(rows.map(r => r.date)).size;
    if (n < CR_MIN_N || days < CR_MIN_DAYS) return { na: 'n', n, why: `Poucas observações (${n}).` };
    const xs = rows.map(r => r.v[a]), ys = rows.map(r => r.v[b]); if (crDistinct(xs) < CR_MIN_DISTINCT || crDistinct(ys) < CR_MIN_DISTINCT) return { na: 'n', n, why: 'Poucos valores diferentes.' };
    const r = crSpearman(xs, ys); return r == null ? { na: 'n', n, why: 'Sem variação.' } : { r, n, p: crRP(r, n), coupled: rule.coupled };
  }));
  const ps = [], pos = []; cells.forEach((row, i) => row.forEach((c, j) => { if (j > i && c.r != null) { pos.push([i, j]); ps.push(c.p); } })); crBH(ps).forEach((q, k) => { const [i, j] = pos[k]; cells[i][j].q = q; cells[j][i].q = q; });
  return { unit: u.k, unitL: u.l, vars: vars.map(v => ({ id: v, label: crVL(u, v) })), cells, tested: ps.length, method: 'Spearman (posições), com correção de Benjamini–Hochberg para as comparações da matriz.' };
}

/* ================= refeições repetidas: a mesma refeição varia tanto quanto refeições diferentes? ================= */
function crRepeats(model) {
  const u = model.units.refeicao; if (!u) return { ok: false, why: 'Sem refeições com par antes/depois.' };
  const g = new Map(); u.rows.forEach(r => { const e = r.ep; if (!e || !e.sig) return; const k = e.meal + '|' + e.sig; (g.get(k) || g.set(k, { meal: e.meal, label: e.foods ? [...new Set(e.foods.map(f => f.name))].slice(0, 3).join(' + ') : e.desc, rows: [] }).get(k)).rows.push(r); });
  const gs = [...g.values()].filter(x => x.rows.length >= 3), k = gs.length, N = gs.reduce((s, x) => s + x.rows.length, 0);
  if (k < 3) return { ok: false, why: `São necessárias ao menos 3 refeições repetidas (mesma composição registrada) com 3 ou mais pares cada. Há ${k}.`, k, N };
  const all = [].concat(...gs.map(x => x.rows.map(r => r.v.delta))), gm = crMean(all);
  let ssb = 0, ssw = 0; const info = gs.map(x => { const v = x.rows.map(r => r.v.delta), m = crMean(v); ssb += v.length * (m - gm) ** 2; v.forEach(t => { ssw += (t - m) ** 2; }); return { label: x.label, meal: x.meal, n: v.length, mean: m, sd: crSd(v), ids: x.rows.map(r => r.id), rec: [].concat(...x.rows.map(r => r.rec)) }; });
  const msb = ssb / (k - 1), msw = ssw / (N - k), n0 = (N - gs.reduce((s, x) => s + x.rows.length ** 2, 0) / N) / (k - 1), icc = Math.max(0, Math.min(1, (msb - msw) / (msb + (n0 - 1) * msw)));
  return { ok: true, k, N, sdWithin: Math.sqrt(msw), sdTotal: crSd(all), icc, groups: info.sort((a, b) => b.n - a.n), recIds: [...new Set([].concat(...info.map(i => i.rec)))] };
}

/* ================= leitura em palavras (sem linguagem de causa) ================= */
function crText(res, u) {
  if (!res.ok) return res.why || '';
  const f2 = v => crFmt(v, 2), pf = (id, v) => crFV(id, v) + crUnitTxt(id);
  if (res.kind === 'corr') {
    const sym = res.method === 'spearman' ? 'ρ de Spearman' : 'r de Pearson', ci = res.ci ? `; IC 95%: ${f2(res.ci[0])} a ${f2(res.ci[1])}` : '';
    if (res.inconclusive) return `Em ${res.n} pares, não houve associação distinguível de zero entre ${res.xl.toLowerCase()} e ${res.yl.toLowerCase()} (${sym} = ${f2(res.coef)}${ci}).`;
    const s = res.strength === 'nenhuma' ? 'praticamente nenhuma' : CR_STRENGTH_TXT[res.strength], d = res.dir > 0 ? `valores maiores de ${res.xl.toLowerCase()} apareceram junto com valores maiores de ${res.yl.toLowerCase()}` : `valores maiores de ${res.xl.toLowerCase()} apareceram junto com valores menores de ${res.yl.toLowerCase()}`;
    return `Em ${res.n} pares, ${d} (associação ${res.dir > 0 ? 'positiva' : 'negativa'} ${s}; ${sym} = ${f2(res.coef)}${ci}).`;
  }
  const e = res.effect;
  if (res.method === 'kruskal') return `Entre ${res.groups.length} grupos (${res.n} observações), a mediana de ${res.vl.toLowerCase()} foi mais alta em ${res.higher} e mais baixa em ${res.lower} (ε² = ${f2(e.eps2)}; p = ${crFmt(res.p, 3)}).`;
  const A = res.A, B = res.B, ci = e.ci ? `; IC 95% da ${e.ciKind}: ${crSg(e.ci[0], 0)} a ${crSg(e.ci[1], 0)}${crUnitTxt(res.v)}` : '';
  return `${A.label} (n = ${A.n}): mediana ${pf(res.v, A.median)}; ${B.label} (n = ${B.n}): mediana ${pf(res.v, B.median)}. ${res.inconclusive ? 'A diferença observada não é distinguível de zero' : 'A mediana foi mais alta em ' + res.higher}${res.method === 'welch' ? ` (diferença de médias ${crSg(e.diffMean, 0)}${crUnitTxt(res.v)}` : ` (diferença de medianas ${crSg(e.diffMedian, 0)}${crUnitTxt(res.v)}`}${ci}; p = ${crFmt(res.p, 3)}).`;
}
/* Resumo de uma frase para os destaques e para a Central de descobertas */
function crHeadline(res) {
  if (!res.ok) return res.why; const nm = res.kind === 'corr' ? `${res.xl} e ${res.yl}` : `${res.vl} por ${res.gl.toLowerCase()}`;
  return `${nm}: ${res.kind === 'corr' ? (res.dir > 0 ? 'associação positiva ' : 'associação negativa ') : 'diferença observada '}${CR_STRENGTH_TXT[res.strength]} em ${res.n} observações`;
}

/* ================= varredura automática (exploratória, com correção para múltiplas comparações) ================= */
function crAutoSpecs(model) {
  const U = model.units, S = [], add = (unit, x, y, topic) => { const u = U[unit]; if (u && u.n >= CR_MIN_N && u.vars.includes(x) && u.vars.includes(y)) S.push({ unit, x, y, topic }); };
  [['carb_total', 'delta'], ['carb_total', 'post'], ['carb_liq', 'delta'], ['carb_inf', 'delta'], ['carb_inf', 'post']].forEach(([x, y]) => add('refeicao', x, y, 'carb-variacao'));
  add('refeicao', 'pre', 'post', 'glicemia-inicial'); add('refeicao', 'refeicao', 'delta', 'tipo-refeicao'); add('refeicao', 'periodo', 'abs_delta', 'variab-periodo'); add('refeicao', 'fds', 'delta', 'fds-refeicao'); add('refeicao', 'desde_ref', 'delta', 'intervalo-refeicoes');
  CRF.RF_MEALS.forEach(m => add('ref:' + m.k, 'hora', 'delta', 'hora-refeicao-' + m.k));
  add('insulina', 'ins_units', 'delta', 'insulina-variacao'); add('insulina', 'hora', 'delta', 'hora-aplicacao'); add('insulina', 'periodo', 'delta', 'hora-aplicacao');
  add('basal', 'ins_basal', 'jej', 'basal-jejum'); add('basal', 'hora', 'jej', 'basal-jejum');
  add('atividade', 'grupo', 'delta', 'atividade-pos'); add('atividade', 'ativ_min', 'delta', 'atividade-pos'); add('atividade', 'ativ_int', 'delta', 'atividade-pos');
  add('dia', 'dia_ativ', 'dia_media', 'atividade-dia'); add('dia', 'dia_ativ', 'dia_cv', 'atividade-dia'); add('dia', 'ativ_total', 'dia_media', 'atividade-dia');
  Object.keys(CR_MARKS).forEach(k => { add('dia', 'm_' + k, 'dia_media', 'marcacao-' + k); add('dia', 'm_' + k, 'dia_cv', 'marcacao-' + k); });
  (model.evList || []).forEach(o => { add('dia', o.id, 'dia_media', 'evento'); add('dia', o.id, 'dia_cv', 'evento'); });
  add('dia', 'fds', 'dia_media', 'dia-semana'); add('dia', 'fds', 'dia_cv', 'dia-semana'); add('dia', 'semana', 'dia_media', 'dia-semana'); add('dia', 'semana', 'dia_cv', 'dia-semana');
  Object.keys(U).filter(k => k.startsWith('med:')).forEach(k => { add(k, 'hora', 'glu', 'hora-glicemia'); add(k, 'fds', 'glu', 'fds-glicemia'); if (k === 'med:jejum') add(k, 'semana', 'glu', 'dia-semana'); });
  add('exame', 'hba', 'media90', 'hba-media');
  return S;
}
function crModel(records, opt) {
  const B = crBuild(records, opt), model = { units: B.units, quality: B.quality, evList: B.evList, built: B.built };
  const specs = crAutoSpecs(model), res = specs.map(sp => Object.assign(crAnalyze(model, sp.unit, sp.x, sp.y), { topic: sp.topic, auto: true }));
  const q = crBH(res.map(r => r.ok && !r.coupled ? r.p : null)); res.forEach((r, i) => { r.q = q[i]; });
  const m = res.filter(r => r.ok && !r.coupled && crIsNum(r.p)).length;
  res.forEach(r => { r.tier = !r.ok || r.coupled || r.unstable || r.inconclusive || r.idx < CR_IDX_MIN ? 'none' : r.q != null && r.q <= CR_Q_HIGH ? 'destaque' : r.p < 0.05 ? 'explor' : 'none'; });
  const byQ = (a, b) => a.q - b.q || b.idx - a.idx;
  model.auto = { list: res, tested: m, highlights: res.filter(r => r.tier === 'destaque').sort(byQ), exploratory: res.filter(r => r.tier === 'explor').sort((a, b) => a.p - b.p || b.idx - a.idx), invalid: res.filter(r => !r.ok), valid: res.filter(r => r.ok) };
  model.repeats = crRepeats(model); return model;
}
/* Remove dos destaques o que já aparece em outras áreas (Central de descobertas, padrões) e devolve o que foi omitido. */
function crDedupe(items, covered) {
  const cov = new Set(covered || []), keep = [], dupes = []; items.forEach(r => (cov.has(r.topic) ? dupes : keep).push(r)); return { keep, dupes };
}

if (typeof module !== 'undefined') module.exports = { CR_MIN_N, CR_MIN_DAYS, CR_MIN_GROUP, CR_MIN_DISTINCT, CR_MIN_DAY_N, CR_Q_HIGH, CR_IDX_MIN, CR_VARS, CR_CAT, CR_MARKS, CR_MEANING, CR_DISCLAIMER, CR_NODOSE, CR_STRENGTH_TXT, CR_STRENGTH_LV,
  crMean, crSd, crMedian, crQuantile, crSkew, crRanks, crPearson, crSpearman, crPartial, crLgamma, crIbeta, crTp2, crTcrit, crChi2Sf, crNormP2, crFisherCI, crRP, crWelch, crMannWhitney, crKruskal, crBootMedDiff, crBH, crOls, crTheilSen, crOutliers, crDescribe, crHist, crStrengthOf,
  crBuild, crPairRule, crCorrelate, crCompare, crAnalyze, crCombos, crUnitList, crMatrix, crRepeats, crText, crHeadline, crAutoSpecs, crModel, crDedupe, crFmt, crFV, crVL, crLevel, crUnitsOf, crIsAct, crDoses };
