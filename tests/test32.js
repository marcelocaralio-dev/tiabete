// test32: análise glicêmica por horários e períodos do dia (0.31.0, PROMPT 1) — lógica pura, com cálculos independentes.
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const near = (a, b, e = 1e-9) => a != null && b != null && Math.abs(a - b) <= e;
const A = require(ROOT + '/src/analise-core.js'), L = require(ROOT + '/src/logic.js');
const { mkTs, isoDate, addDays, LIM, FAST } = L;
/* ---- gerador determinístico ---- */
let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const NOW = mkTs('2026-11-20', '15:00'), recs = []; let id = 0;
const mk = (date, time, g, o = {}) => ({ id: 'r' + (++id), date, time, ts: mkTs(date, time), glucose: Math.round(g), source: 'manual', ...o });
for (let i = 119; i >= 0; i--) {
  const d = isoDate(new Date(addDays(NOW, -i)));
  recs.push(mk(d, '07:05', 100 + rnd() * 50, { context: 'jejum' }));
  recs.push(mk(d, '12:10', 100 + rnd() * 40, { context: 'antes', meal: 'almoco' }));
  if (i % 2 === 0) recs.push(mk(d, '14:20', 140 + rnd() * 110, { context: 'depois', meal: 'almoco' }));
  if (i % 3 === 0) recs.push(mk(d, '21:40', 110 + rnd() * 100, { context: 'depois', meal: 'jantar' }));
  if (i % 10 === 0) recs.push(mk(d, '03:30', 55 + rnd() * 12, { context: 'madrugada' }));
  if (i % 7 === 0) recs.push(mk(d, '15:00', 90 + rnd() * 60));                       /* sem contexto, à tarde */
  if (i % 11 === 0) recs.push(mk(d, '07:30', 120 + rnd() * 20, { context: 'depois', meal: 'cafe' })); /* pós-café às 7h30: hora não decide o contexto */
  if (i % 13 === 0) recs.push({ id: 'r' + (++id), date: d, time: '', noTime: true, ts: mkTs(d, '00:00'), glucose: 150, source: 'manual' });
}
const frozen = JSON.stringify(recs), scr = { cur: recs, prev: null, curR: null, prevR: null };
const D = A.anTDefaults();
/* ---- referências independentes (laços simples, sem usar o núcleo) ---- */
const ref = list => {
  const n = list.length; if (!n) return { n: 0 };
  const v = list.map(r => r.glucose).sort((a, b) => a - b), mean = v.reduce((a, b) => a + b, 0) / n, med = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  let ss = 0; for (const x of v) ss += (x - mean) * (x - mean); const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : null;
  let low = 0, high = 0, ok_ = 0; for (const r of list) { if (r.glucose < 70) low++; const hi = r.context === 'jejum' ? 130 : 180; if (r.glucose > hi) high++; if (r.glucose >= 70 && r.glucose <= hi) ok_++; }
  return { n, mean, med, sd, cv: sd != null ? sd / mean * 100 : null, min: v[0], max: v[n - 1], low, high, ok: ok_, days: new Set(list.map(r => r.date)).size };
};
/* 1. contexto: cada medição em um só grupo; hora não define o contexto */
let T = A.anTModel(recs, { ...D, src: 'ctx' }, NOW, scr);
ok(T.all.reduce((s, g) => s + g.s.n, 0) === recs.length, 'contexto: soma dos grupos = total (sem duplicar nem perder registros)');
const pc = T.all.find(g => g.k === 'poscafe'), pa = T.all.find(g => g.k === 'posalmoco'), ou = T.all.find(g => g.k === 'outros');
ok(pc.recs.every(r => r.time === '07:30' && r.context === 'depois' && r.meal === 'cafe') && pc.s.n === recs.filter(r => r.meal === 'cafe').length, 'pós-café vem do contexto registrado (mesmo às 07:30, quando o jejum também acontece)');
ok(ou.recs.some(r => r.time === '15:00' && !r.context) && !pa.recs.some(r => r.time === '15:00'), 'medição sem contexto à tarde NÃO vira pós-prandial pelo horário');
ok(ou.recs.some(r => r.noTime), 'contexto: medição sem horário continua contada no seu contexto');
/* 2. indicadores batem com o cálculo independente */
for (const g of T.all) {
  const e = ref(g.recs), s = g.s; if (!e.n) { ok(s.n === 0 && s.mean == null, g.t + ': grupo vazio sem números inventados'); continue; }
  ok(s.n === e.n && s.days === e.days && near(s.mean, e.mean) && near(s.median, e.med) && s.min === e.min && s.max === e.max, `${g.t}: n, dias, média, mediana, menor e maior`);
  ok((e.sd == null ? s.sd == null : near(s.sd, e.sd, 1e-9)) && (e.cv == null ? s.cv == null : near(s.cv, e.cv, 1e-9)), `${g.t}: desvio-padrão e CV`);
  ok(s.lowN === e.low && s.highN === e.high && s.bc.ok === e.ok && near(s.lowPct, e.low / e.n * 100) && near(s.highPct, e.high / e.n * 100), `${g.t}: baixas, elevadas e faixa (jejum até ${FAST.high})`);
}
/* 3. faixas de horário */
T = A.anTModel(recs, { ...D, src: 'hora', step: 4 }, NOW, scr);
const withTime = recs.filter(r => !r.noTime), noT = recs.length - withTime.length;
ok(T.all.length === 6 && T.noTimeN === noT && T.all.reduce((s, g) => s + g.s.n, 0) === withTime.length, 'hora: 6 faixas de 4 h; sem horário fora delas e contado à parte (' + noT + ')');
ok(T.all.every(g => g.recs.every(r => +r.time.slice(0, 2) >= g.a && +r.time.slice(0, 2) < g.b)), 'hora: cada medição na faixa da sua hora');
const bd = A.anTBands({ step: 4 }); ok(bd[0].t === '00–04h' && bd[5].t === '20–24h', 'rótulos das faixas de 4 h');
ok(A.anTBands({ step: 2 }).length === 12 && A.anTBands({ step: 3 }).length === 8 && A.anTBands({ step: 6 }).length === 4, 'faixas de 2, 3 e 6 horas');
const edge = [mk('2026-11-01', '03:59', 100), mk('2026-11-01', '04:00', 100), mk('2026-11-01', '23:59', 100), mk('2026-11-01', '00:00', 100)];
const Te = A.anTModel(edge, { ...D, src: 'hora', step: 4 }, NOW, { cur: edge, prev: null });
ok(Te.all[0].s.n === 2 && Te.all[1].s.n === 1 && Te.all[5].s.n === 1, 'limites: 00:00 e 03:59 → 00–04h; 04:00 → 04–08h; 23:59 → 20–24h');
const cu = A.anTParseCuts('6, 10 14;18'); ok(cu.ok && cu.cuts.join() === '6,10,14,18', 'cortes personalizados aceitam vírgula, espaço e ponto e vírgula');
ok(!A.anTParseCuts('').ok && !A.anTParseCuts('0, 5').ok && !A.anTParseCuts('24').ok && !A.anTParseCuts('abc').ok && !A.anTParseCuts('1.5').ok && !A.anTParseCuts('1,2,3,4,5,6,7,8,9,10,11,12').ok, 'cortes inválidos são recusados com mensagem');
ok(A.anTBands({ step: 'custom', cuts: '9, 9, 5' }).map(b => b.t).join() === '00–05h,05–09h,09–24h', 'cortes repetidos e fora de ordem são organizados');
const Tc = A.anTModel(recs, { ...D, src: 'hora', step: 'custom', cuts: '6, 12, 18' }, NOW, scr);
ok(Tc.all.length === 4 && Tc.all.reduce((s, g) => s + g.s.n, 0) === withTime.length, 'faixas personalizadas cobrem todas as medições com horário');
/* 4. contexto × hora: o cruzamento mostra as duas informações separadas */
const x07 = T.all.find(g => g.k === 'h4'); ok(x07.recs.length && T.cross.h4 && T.cross.h4.jejum > 0 && T.cross.h4.poscafe > 0, 'faixa 04–08h mostra jejum e pós-café como contextos distintos');
/* 5. janelas, período anterior e fusos */
for (const tz of ['America/Sao_Paulo', 'UTC', 'Pacific/Auckland']) {
  process.env.TZ = tz; const now = mkTs('2026-11-20', '15:00'), rz = recs.map(r => ({ ...r, ts: mkTs(r.date, r.time || '00:00') })), sz = { cur: rz, prev: null, curR: null, prevR: null }, w = A.anTWindow(rz, { ...D, range: '7' }, now, sz), w2 = A.anTWindow(rz, { ...D, range: 'custom', from: '2026-11-10', to: '2026-11-14' }, now, sz);
  const inDates = (list, a, b) => list.every(r => r.date >= a && r.date <= b);
  ok(w.cur.length && inDates(w.cur, '2026-11-14', '2026-11-20') && new Set(w.cur.map(r => r.date)).size === 7, tz + ': 7 dias = 14 a 20/11, sem escorregar de dia');
  ok(w.prev.length && inDates(w.prev, '2026-11-07', '2026-11-13'), tz + ': período anterior = 7 a 13/11 (mesmo tamanho, colado ao atual)');
  ok(w2.cur.length && inDates(w2.cur, '2026-11-10', '2026-11-14') && inDates(w2.prev, '2026-11-05', '2026-11-09'), tz + ': intervalo personalizado e o período anterior de mesmo tamanho');
}
process.env.TZ = 'America/Sao_Paulo';
ok(A.anTWindow(recs, { ...D, range: 'custom', from: '2026-11-14', to: '2026-11-10' }, NOW, scr).invalid && A.anTWindow(recs, { ...D, range: 'custom', from: '', to: '' }, NOW, scr).invalid, 'datas personalizadas invertidas ou vazias são inválidas');
ok(A.anTWindow(recs, { ...D, range: 'tela' }, NOW, scr).prev === null, '"Da tela" em Tudo: sem período anterior');
for (const r of ['7', '14', '30', '90', '180']) { const w = A.anTWindow(recs, { ...D, range: r }, NOW, scr); ok(w.cur.length > 0 && w.curR[1] - w.curR[0] + 1 >= +r * 86399000 && w.prevR[1] === w.curR[0] - 1, 'filtro de ' + r + ' dias: janelas coladas'); }
/* 6. destaques exigem amostra mínima: nunca uma medição isolada */
const few = [mk('2026-11-18', '03:00', 50, { context: 'madrugada' }), mk('2026-11-19', '07:00', 110, { context: 'jejum' })];
const Tf = A.anTModel(few, D, NOW, { cur: few, prev: null });
ok(!Tf.hl.some(h => ['baixas', 'altas', 'variab', 'melhor', 'mudanca'].includes(h.id)), 'amostra mínima: nenhuma medição isolada vira destaque de problema');
ok(Tf.quality.some(q => /Poucas medições/.test(q)) && Tf.quality.some(q => /Sem registros/.test(q)), 'avisos: poucas medições e períodos sem registro');
const one = []; for (let i = 0; i < 8; i++) one.push(mk('2026-11-' + String(10 + i).padStart(2, '0'), '14:00', i === 0 ? 55 : 120, { context: 'depois', meal: 'almoco' }));
ok(!A.anTModel(one, D, NOW, { cur: one, prev: null }).hl.some(h => h.id === 'baixas'), 'um único valor baixo em 8 medições não gera destaque de hipoglicemia');
const concD = []; for (let i = 0; i < 8; i++) concD.push(mk('2026-11-15', String(8 + i).padStart(2, '0') + ':00', 100 + i, { context: 'jejum' }));
const Tcd = A.anTModel(concD, D, NOW, { cur: concD, prev: null });
ok(Tcd.quality.some(q => /concentrados em poucos dias/.test(q)) && Tcd.all.find(g => g.k === 'jejum').s.concentrated, 'aviso de registros concentrados em um dia');
const Te0 = A.anTModel([], D, NOW, { cur: [], prev: null }); ok(Te0.total === 0 && Te0.hl.length === 0 && Te0.all.every(g => g.s.n === 0 && g.s.mean == null), 'sem dados: nada é inventado');
/* 7. comparação temporal */
const W30 = A.anTWindow(recs, { ...D, range: '30' }, NOW, scr), T30 = A.anTModel(recs, { ...D, range: '30' }, NOW, scr);
ok(T30.groups.every(g => g.p && g.p.n === ref(recs.filter(r => r.ts >= W30.prevR[0] && r.ts <= W30.prevR[1] && A.anSlotOf(r) === g.k)).n), 'período anterior: contagens por grupo batem com o cálculo independente');
const j = T30.all.find(g => g.k === 'jejum'), pj = ref(recs.filter(r => r.ts >= W30.prevR[0] && r.ts <= W30.prevR[1] && r.context === 'jejum'));
ok(near(j.dMean, j.s.mean - pj.mean), 'diferença absoluta da média = atual − anterior');
/* 8. mapa de calor */
const H = A.anTHeat(withTime, { ...D, step: 4 }); let hs = 0; H.rows.forEach(r => r.forEach(c => { hs += c.n; }));
ok(hs === withTime.length && H.rows.length === 7 && H.rows[0].length === 6, 'mapa de calor: 7 dias × 6 faixas, soma das células = medições com horário');
let okH = true; H.rows.forEach((row, d) => row.forEach((c, bi) => { const rs = withTime.filter(r => (new Date(r.ts).getDay() + 6) % 7 === d && +r.time.slice(0, 2) >= H.bands[bi].a && +r.time.slice(0, 2) < H.bands[bi].b); const e = ref(rs); if (c.n !== e.n) okH = false; if (e.n && !near(c.pLow, (rs.filter(r => r.glucose < 70).length) / e.n * 100)) okH = false; })); ok(okH, 'mapa de calor: contagem e % de baixas por célula conferem');
/* 9. evolução: sem interpolar semanas vazias */
const gap = [], base = mk('2026-09-07', '07:00', 100); for (const dd of ['2026-09-07', '2026-09-08', '2026-09-09', '2026-10-05', '2026-10-06', '2026-10-07']) gap.push(mk(dd, '07:00', 100 + gap.length, { context: 'jejum' }));
const ev = A.anTEvo(gap, 40); ok(ev.buckets.length === 2 && ev.buckets.every(b => b.ok) && ev.pts.length === 6, 'evolução: só as semanas com dados entram (as semanas entre elas não são preenchidas)');
ok(!A.anTEvo(gap, 10).weekly && A.anTEvo(gap, 10).buckets.length === 0, 'evolução: intervalos curtos mostram só os pontos');
/* 10. integridade e desempenho */
ok(JSON.stringify(recs) === frozen, 'registros originais não foram alterados');
const big = []; for (let i = 0; i < 50000; i++) { const d = isoDate(new Date(addDays(NOW, -(i % 700)))); big.push(mk(d, String(i % 24).padStart(2, '0') + ':' + String((i * 7) % 60).padStart(2, '0'), 60 + (i * 37) % 200, { context: ['jejum', 'antes', 'depois', 'deitar', 'madrugada'][i % 5], meal: 'almoco' })); }
const t0 = Date.now(); A.anTModel(big, { ...D, src: 'hora', step: 2 }, NOW, { cur: big, prev: null }); const dt = Date.now() - t0; ok(dt < 2500, '50 mil registros em ' + dt + ' ms (< 2,5 s)');
/* 11. a seção e os textos existem na interface */
const ui = fs.readFileSync(ROOT + '/src/analise.js', 'utf8'), css = fs.readFileSync(ROOT + '/src/analise.css', 'utf8');
ok(/id: 'tmp'/.test(ui) && /an-c13/.test(css) && /an13/.test(css), 'seção "Horários e períodos do dia" registrada, com cor própria nos dois temas');
ok(!/\bmelhorou\b|\bpiorou\b/.test(ui.slice(ui.indexOf('7b. Horários'), ui.indexOf('8. Refeição'))), 'textos da seção nova não dizem "melhorou/piorou"');
ok(/não\s*é o tempo|Não é o tempo/.test(ui) && /nada é preenchido ou ligado/.test(ui), 'avisos: proporção ≠ tempo real; sem interpolação');
console.log(fail ? `${fail} falha(s) em ${n}` : `test32 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
