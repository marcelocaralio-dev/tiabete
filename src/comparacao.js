/* ===== Comparação entre períodos: painel detalhado e PDF (dentro da seção "Comparação entre períodos") ===== */
let cpMemo = { key: '', M: null };
function cpData(c) {
  const iso = r => [isoDate(new Date(r[0])), isoDate(new Date(r[1]))], ra = iso(c.ra), rb = iso(c.rb), base = anBase(S.records);
  const key = JSON.stringify([ra, rb, LIM.low, LIM.high, S.hba, base.map(r => [r.id, r.date, r.time, r.glucose, r.context, r.meal, r.marks, r.carbs, r.insMeal, r.insCorr, r.insBasal, r.actMin, r.actDesc])]);
  if (key !== cpMemo.key) cpMemo = { key, M: cpModel(base, ra, rb, { hba: S.hba.filter(x => !isEx(x)), rc: { marks: MARKS } }) };
  return cpMemo.M;
}
const cpV = (v, d = 0) => v == null ? '—' : fn(v, d), cpSg = (v, d = 0) => v == null ? '—' : fsign(v, d);
const cpPair = (l, a, b, max, d = 0, u = '') => `<div class="cp-pair"><span>${esc(l)}</span>${[[a, 'a'], [b, 'b']].map(([v, k]) => `<div><b>${k.toUpperCase()}</b><span class="cp-bar"><i class="${k}" style="width:${v == null ? 0 : Math.min(100, v / max * 100).toFixed(1)}%"></i></span><small class="num">${cpV(v, d)}${u}</small></div>`).join('')}</div>`;
function cpLines(series, label) {
  const pts = series.flatMap(s => s.p); if (!pts.length) return '';
  const mx = Math.max(1, ...pts.map(p => p[0])), lo = Math.min(...pts.map(p => p[1])), hi = Math.max(...pts.map(p => p[1])), X = x => (30 + x / mx * 265).toFixed(1), Y = y => (100 - (y - lo) / (hi - lo || 1) * 88).toFixed(1);
  return `<svg class="cp-svg" viewBox="0 0 300 112" role="img" aria-label="${label}"><text x="0" y="14">${fn(hi, 0)}</text><text x="0" y="102">${fn(lo, 0)}</text>${series.map(s => `<polyline class="${s.k}" points="${s.p.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}"/>${s.p.map(p => `<circle class="${s.k}" cx="${X(p[0])}" cy="${Y(p[1])}" r="2"/>`).join('')}`).join('')}</svg>`;
}
const cpSec = (t, h, open) => `<details class="an-ev" ${open ? 'open' : ''}><summary>${t}</summary>${h}</details>`;
const cpTable = (head, rows) => `<div class="tbl-wrap" tabindex="0"><table class="t"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const cpChanges = M => ['Melhorou', 'Piorou', 'Estável', 'Aumentou', 'Diminuiu'].map(k => [k, M.rows.filter(r => r.cls === k).map(r => r.t)]).filter(x => x[1].length);
function cpHTML(c) {
  const M = cpData(c), q = [M.qa, M.qb];
  let h = `<h3 class="an-sub">Resumo</h3><p class="an-card-t">${M.summary}</p>`;
  h += cpSec('Principais mudanças', cpChanges(M).map(([k, l]) => `<p><b>${k}${M.comparable ? '' : ' (com ressalva)'}:</b> ${l.join(', ')}.</p>`).join('') + (M.big.length ? `<p><b>Maiores diferenças de média:</b> ${M.big.map(i => `${i.g} · ${i.l}: ${cpSg(i.d)} mg/dL`).join('; ')}.</p>` : ''), true);
  h += cpSec('Indicadores e diferenças', cpTable(['Indicador', 'A', 'B', 'A − B', 'Var.', 'Evolução'], M.rows.map(r => [r.t, cpV(r.a, r.dec), cpV(r.b, r.dec), cpSg(r.d, r.dec) + (r.pp && r.d != null ? ' pp' : ''), r.pct == null ? '—' : cpSg(r.pct) + '%', r.cls])));
  h += cpSec('Gráficos e tendência', `<p>Média de cada dia, alinhada pelo dia do período (A e B sobrepostos).</p>${cpLines([{ k: 'a', p: M.dA }, { k: 'b', p: M.dB }], 'Médias diárias dos períodos A e B')}<p>Média de cada um de 6 períodos consecutivos de ${M.qa.len} dias (não são medições individuais).</p>${cpLines([{ k: 'a', p: M.trend.map((t, i) => [i, t.mean]).filter(p => p[1] != null) }], 'Tendência das médias por período')}${cpTable(['Período', 'n', 'Média', 'CV %', '% baixas', '% elevadas'], M.trend.map(t => [t.r.map(d => d.split('-').reverse().join('/')).join(' a '), t.n, cpV(t.mean), cpV(t.cv), cpV(t.pLow), cpV(t.pHigh)]))}`);
  h += M.groups.map(g => cpSec(g.t, g.items.map(i => cpPair(`${i.l} · n ${i.a.n}/${i.b.n}${i.ok ? ` · ${cpSg(i.d)} mg/dL` : ' · amostra insuficiente'}`, i.a.n >= 3 ? i.a.mean : null, i.b.n >= 3 ? i.b.mean : null, 300) + (i.ok ? `<small>CV ${cpV(i.a.cv)}% / ${cpV(i.b.cv)}% · baixas ${cpV(i.a.pLow)}% / ${cpV(i.b.pLow)}% · elevadas ${cpV(i.a.pHigh)}% / ${cpV(i.b.pHigh)}%</small>` : '')).join(''))).join('');
  h += cpSec('Eventos recorrentes', M.events.length ? cpTable(['Padrão', 'A', 'B'], M.events.map(e => [esc(e.name), e.a, e.b])) : '<p>Nenhum padrão atingiu o critério.</p>');
  h += cpSec('Cobertura e composição', cpTable(['', 'A', 'B'], [['Dias no período', 'len'], ['Medições', 'n'], ['Dias com registro', 'days'], ['Dias sem medições', 'empty'], ['Medições por dia', 'perDay', 1], ['Faixas de 4 h cobertas (de 6)', 'hours'], ['Sem horário', 'noTime'], ['Sem contexto específico', 'noCtx']].map(([l, k, d]) => [l, ...q.map(x => cpV(x[k], d))]).concat([['Maior concentração', ...q.map(x => x.n ? `${x.top.l} (${fn(x.top.p, 0)}%)` : '—')]])) + ['blocks', 'ctx'].map(k => M.qa[k].map((x, i) => cpPair(x.l, x.p, M.qb[k][i].p, 100, 0, '%')).join('')).join(''));
  h += cpSec('Insulina, carboidratos e exames', cpTable(['', 'A', 'B'], M.extra.map(e => [e.t, cpV(e.a, 1), cpV(e.b, 1)]).concat([['HbA1c laboratorial (%)', ...[M.labA, M.labB].map(l => l.map(v => fn(v, 1)).join(', ') || '—')]])));
  return h + `<button type="button" class="btn full" data-act="cp-pdf">Gerar PDF comparativo</button>${anNote('Percentuais são proporções de medições, não tempo na faixa. Diferenças não indicam causa. Nenhuma estimativa de HbA1c é usada como exame.')}`;
}
async function cpPDF() {
  if (typeof licAllowed === 'function' && !licAllowed('rel-pdf')) { toast('O relatório em PDF é um recurso premium.'); return; }
  const c = anCmpPick(anModel()); if (!c) return;
  try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'); } catch (e) { }
  if (!window.jspdf) { toast('A biblioteca de PDF não carregou. Verifique a conexão.'); return; }
  const M = cpData(c), doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' }); if (!doc.autoTable) { toast('O módulo de tabelas do PDF não carregou.'); return; }
  let y = 40; const room = n => { if (y + n > 800) { doc.addPage(); y = 40; } };
  const text = (t, s = 10) => { doc.setFontSize(s); doc.splitTextToSize(pdfSafe(t), 515).forEach(l => { room(s + 4); doc.text(l, 40, y); y += s + 4; }); };
  const table = (head, body) => { room(60); doc.autoTable({ startY: y, head: [head], body: body.map(r => r.map(x => pdfSafe(x))), styles: { fontSize: 8 }, margin: { left: 40, right: 40 } }); y = doc.lastAutoTable.finalY + 18; };
  const per = r => r.map(d => d.split('-').reverse().join('/')).join(' a ');
  text('GLUXO · Relatório comparativo', 16); text(`A: ${per(M.ra)} (${M.qa.n} medições, ${M.qa.days} dias). B: ${per(M.rb)} (${M.qb.n} medições, ${M.qb.days} dias).`); text(M.summary);
  text('Limitações: ' + (M.limits.join(' ') || 'nenhuma diferença relevante de amostragem detectada.') + ' Percentuais são proporções de medições, não tempo na faixa.');
  table(['Indicador', 'A', 'B', 'A - B', 'Var. %', 'Evolução'], M.rows.map(r => [r.t, cpV(r.a, r.dec), cpV(r.b, r.dec), r.d == null ? '-' : pdfSign(r.d, r.dec), r.pct == null ? '-' : pdfSign(r.pct, 0), r.cls]));
  cpChanges(M).forEach(([k, l]) => text(`${k}: ${l.join(', ')}.`));
  /* gráfico: médias diárias sobrepostas */
  const pts = M.dA.concat(M.dB); if (pts.length) { room(150); const mx = Math.max(1, ...pts.map(p => p[0])), hi = Math.max(...pts.map(p => p[1]));
    text('Médias diárias: A em azul, B em laranja (eixo vertical a partir de zero).'); [[M.dA, [37, 99, 235]], [M.dB, [234, 120, 20]]].forEach(([s, col]) => { doc.setDrawColor(...col); s.forEach((p, i) => { const X = q => 40 + q[0] / mx * 515, Y = q => y + 100 - q[1] / hi * 100; doc.circle(X(p), Y(p), 1.2); if (i) doc.line(X(s[i - 1]), Y(s[i - 1]), X(p), Y(p)); }); }); y += 120; }
  M.groups.forEach(g => table([g.t, 'n A/B', 'Média A', 'Média B'], g.items.map(i => [i.l, `${i.a.n}/${i.b.n}`, i.a.n >= 3 ? cpV(i.a.mean) : '-', i.b.n >= 3 ? cpV(i.b.mean) : '-'])));
  await outFile(`gluxo-comparativo-${M.ra[0]}_${M.ra[1]}.pdf`, doc.output('arraybuffer'));
}
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-act="cp-pdf"]')) cpPDF(); });
