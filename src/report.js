/* ================= Relatórios (PDF e Excel) ================= */
const _loaded = {};
function loadScript(src) {
  if (_loaded[src]) return _loaded[src];
  _loaded[src] = new Promise((res, rej) => { const t = document.createElement('script'); t.src = src; t.onload = res; t.onerror = () => { delete _loaded[src]; rej(new Error('load')); }; document.head.appendChild(t); });
  return _loaded[src];
}
function reportData() {
  const { from, to } = S.rep;
  const a = mkTs(from, '00:00'), b = endOfDay(mkTs(to, '00:00'));
  const days = Math.round((startOfDay(b) - startOfDay(a)) / DAY) + 1;
  const pa = startOfDay(addDays(a, -days)), pb = a - 1;
  const recs = inRange(S.records, a, b), prev = inRange(S.records, pa, pb);
  const st = stats(recs), sp = stats(prev);
  const sch = S.schemes.filter(s => s.start <= to && (!s.end || s.end >= from)).map(s => {
    const rs = recs.filter(r => schemeOf(r, S.schemes) === s.id);
    return { s, rs, ...stats(rs) };
  });
  return {
    from, to, days, a, b, pa, pb, recs, prev, st, sp, cmp: compareStats(st, sp),
    hypo: recs.filter(r => r.glucose < LIM.low), hyper: recs.filter(r => r.glucose > highOf(r)),
    bands: bandCounts(recs), blocks: byTimeBlock(recs), hba: S.hba, sch, ex: recs.some(isEx)
  };
}
const trunc = (s, n) => { s = String(s || '').replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n - 3) + '...' : s; };
const pdfSign = (x, d = 1) => fsign(x, d).replace('\u2212', '-');
const pdfSafe = t => String(t == null ? '' : t).replace(/[‒-―−]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/→/g, '->').replace(/…/g, '...').replace(/•/g, '-').replace(/[^\u0009\u000A -~ -ÿ]/gu, '?');
const insTxt = r => [r.insMeal != null ? fn(r.insMeal) + ' rápida' : '', r.insCorr != null ? fn(r.insCorr) + ' corr.' : '', r.insBasal != null ? fn(r.insBasal) + ' basal' : '', r.insPen != null ? fn(r.insPen) + ' caneta' : '', r.insPump != null ? fn(r.insPump) + ' bomba' : ''].filter(Boolean).join(' · ');

async function makePDF() {
  try { await makePDFInner(); } catch (e) { console.error(e); toast('Não consegui gerar o PDF: ' + (e && e.message || e)); const st = $('#rep-status'); if (st) st.textContent = ''; }
}
async function makePDFInner() {
  const status = $('#rep-status'); if (status) status.textContent = 'Gerando PDF…';
  try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'); } catch (e) { }
  if (!window.jspdf || !window.jspdf.jsPDF) { toast('A biblioteca de PDF não carregou. Verifique a conexão e recarregue.'); if (status) status.textContent = ''; return; }
  const D = reportData(), { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'pt', format: 'a4' });
  if (typeof doc.autoTable !== 'function') { toast('O módulo de tabelas do PDF não carregou.'); if (status) status.textContent = ''; return; }
  const _tx = doc.text.bind(doc); doc.text = (t, ...a) => _tx(Array.isArray(t) ? t.map(pdfSafe) : pdfSafe(t), ...a);
  const W = 595, H = 842, M = 40, CW = W - 2 * M;
  const RED = [255, 46, 62], DARK = [91, 13, 22], INK = [30, 24, 27], MUT = [112, 102, 107];
  let y = 0;
  /* cabeçalho */
  doc.setFillColor(8, 7, 10); doc.rect(0, 0, W, 88, 'F'); doc.setFillColor(...RED); doc.rect(0, 88, W, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.setTextColor(255, 255, 255); doc.text('Tia', M, 50);
  const gw = doc.getTextWidth('Tia'); doc.setTextColor(...RED); doc.text('Bete', M + gw, 50);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(185, 175, 180);
  doc.text('RELATÓRIO GLICÊMICO · versão ' + APP_VERSION, M, 70);
  doc.text(`Período ${fmtDate(D.from)} a ${fmtDate(D.to)}   ·   gerado em ${new Date().toLocaleDateString('pt-BR')}`, W - M, 70, { align: 'right' });
  y = 116;
  if (D.ex) { doc.setTextColor(...RED); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('ATENÇÃO: este relatório contém DADOS DE EXEMPLO.', M, y); y += 18; }
  const need = h => { if (y + h > H - 56) { doc.addPage(); y = 52; } };
  const h2 = t => { need(60); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...RED); doc.text(t.toUpperCase(), M, y); doc.setDrawColor(...DARK); doc.setLineWidth(.8); doc.line(M, y + 5, W - M, y + 5); y += 20; };
  const note = t => { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUT); const l = doc.splitTextToSize(t, CW); need(l.length * 11 + 6); doc.text(l, M, y); y += l.length * 11 + 8; };
  const tbl = (head, body, opt = {}) => {
    need(50);
    doc.autoTable({ startY: y, head: [head.map(pdfSafe)], body: body.map(r => r.map(pdfSafe)), theme: 'grid', margin: { left: M, right: M, bottom: 56 }, styles: { font: 'helvetica', fontSize: opt.fs || 8.5, cellPadding: 4, textColor: INK, lineColor: [225, 218, 221], lineWidth: .4 }, headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: 'bold' }, alternateRowStyles: { fillColor: [250, 246, 247] }, columnStyles: opt.cols || {}, didParseCell: opt.cell });
    y = doc.lastAutoTable.finalY + 14;
  };
  /* resumo */
  h2('Resumo geral');
  const s = D.st;
  tbl(['Indicador', 'Valor'], [
    ['Medições no período', String(s.n)], ['Média', s.n ? fm(s.mean) + ' mg/dL' : '-'], ['Desvio-padrão', s.sd != null ? fm(s.sd) + ' mg/dL' : '-'],
    ['Menor / maior medição', s.n ? `${f0(s.min)} / ${f0(s.max)} mg/dL` : '-'],
    ['Medições abaixo de 70 mg/dL', `${s.hypo}${s.n ? ' (' + (s.hypo / s.n * 100).toFixed(0) + '%)' : ''}`],
    ['Medições acima da faixa (180; jejum 130)', `${s.hyper}${s.n ? ' (' + (s.hyper / s.n * 100).toFixed(0) + '%)' : ''}`]
  ], { cols: { 0: { cellWidth: 220, fontStyle: 'bold' } } });
  /* dia típico */
  { const td = typicalDay(D.recs), hs = td.hours.filter(x => x.p50 != null);
    if (td.ok >= 6) {
      h2('Dia típico (mediana e faixas por horário)'); need(190);
      const cx = M + 30, cy = y, cw = CW - 36, ch = 140, ymin = 40, ymax = Math.max(250, Math.ceil(Math.max(...hs.map(x => x.p90)) / 50) * 50);
      const X = h => cx + (h + .5) / 24 * cw, Y = v => cy + ch - (Math.min(v, ymax) - ymin) / (ymax - ymin) * ch, bw = cw / 24;
      doc.setFillColor(232, 245, 237); doc.rect(cx, Y(LIM.high), cw, Y(LIM.low) - Y(LIM.high), 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUT); doc.setDrawColor(225, 218, 221); doc.setLineWidth(.4);
      for (let v = 50; v <= ymax; v += ymax > 300 ? 100 : 50) { doc.line(cx, Y(v), cx + cw, Y(v)); doc.text(String(v), cx - 4, Y(v) + 2, { align: 'right' }); }
      [0, 6, 12, 18, 24].forEach(h => doc.text(pad(h % 24) + 'h', cx + h / 24 * cw, cy + ch + 11, { align: 'center' }));
      hs.forEach(x => { doc.setFillColor(222, 218, 220); doc.rect(X(x.h) - bw / 2, Y(x.p90), bw, Y(x.p10) - Y(x.p90), 'F'); doc.setFillColor(190, 183, 187); doc.rect(X(x.h) - bw / 2, Y(x.p75), bw, Y(x.p25) - Y(x.p75), 'F'); });
      doc.setDrawColor(...RED); doc.setLineWidth(1.6); hs.forEach((x, i) => { const n = hs[i + 1]; if (n && n.h - x.h === 1) doc.line(X(x.h), Y(x.p50), X(n.h), Y(n.p50)); });
      y = cy + ch + 20; note('Linha vermelha: mediana por horário (janela de 3 h). Cinza escuro: 25-75% das medições; cinza claro: 10-90%. Faixa verde: 70-180 mg/dL. Descreve o período, sem orientar tratamento.');
    } }
  /* gráfico */
  h2('Medições ao longo do período'); need(190);
  const cx = M + 30, cy = y, cw = CW - 36, ch = 150, vals = D.recs.map(r => r.glucose);
  const ymin = Math.floor((Math.min(50, ...vals) - 10) / 10) * 10, ymax = Math.ceil((Math.max(200, ...vals) + 10) / 10) * 10;
  const X = t => cx + (t - D.a) / (D.b - D.a) * cw, Y = v => cy + ch - (v - ymin) / (ymax - ymin) * ch;
  doc.setFillColor(253, 238, 240); doc.rect(cx, Y(LIM.high), cw, Y(LIM.low) - Y(LIM.high), 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUT); doc.setDrawColor(225, 218, 221); doc.setLineWidth(.4);
  niceTicks(ymin, ymax, 5).forEach(v => { doc.line(cx, Y(v), cx + cw, Y(v)); doc.text(String(v), cx - 5, Y(v) + 2.5, { align: 'right' }); });
  doc.setLineDash([3, 2], 0); doc.setDrawColor(...RED); doc.line(cx, Y(LIM.high), cx + cw, Y(LIM.high)); doc.setDrawColor(190, 60, 75); doc.line(cx, Y(LIM.low), cx + cw, Y(LIM.low)); doc.setLineDash([1, 2.5], 0); doc.setDrawColor(225, 120, 135); doc.line(cx, Y(FAST.high), cx + cw, Y(FAST.high)); doc.setLineDash([], 0);
  for (let i = 0; i <= 4; i++) { const t = D.a + (D.b - D.a) * i / 4; doc.text(fmtDM(t), X(t), cy + ch + 11, { align: i === 0 ? 'left' : i === 4 ? 'right' : 'center' }); }
  const dm = dailyMeans(D.recs); doc.setDrawColor(...RED); doc.setLineWidth(1);
  for (let i = 1; i < dm.length; i++) doc.line(X(dm[i - 1].ts), Y(dm[i - 1].mean), X(dm[i].ts), Y(dm[i].mean));
  D.recs.forEach(r => { const b = bandOf(r.glucose, r.context).k; doc.setFillColor(...(b === 'ok' ? [95, 88, 92] : b === 'low' || b === 'vlow' ? [190, 40, 60] : [255, 46, 62])); doc.circle(X(r.ts), Y(r.glucose), 1.7, 'F'); });
  y = cy + ch + 26;
  note('Cada ponto é uma medição. A linha vermelha liga as médias diárias. Linhas tracejadas: 70 e 180 mg/dL; pontilhada: 130 mg/dL (limite em jejum).');
  /* distribuição */
  h2('Distribuição por faixa'); need(120);
  const mx = Math.max(...Object.values(D.bands), 1);
  BAND_LIST.forEach(b => {
    const n = D.bands[b.k], bw = n / mx * (CW - 190);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...INK); doc.text(`${b.label}  ${b.name}`, M, y + 8);
    doc.setFillColor(...(b.k === 'ok' ? [150, 142, 147] : b.k === 'low' || b.k === 'vlow' ? [214, 90, 105] : [255, 46, 62])); if (bw > 0) doc.rect(M + 150, y, Math.max(bw, 1.5), 10, 'F');
    doc.text(`${n}  (${D.st.n ? (n / D.st.n * 100).toFixed(0) : 0}%)`, M + 150 + Math.max(bw, 1.5) + 6, y + 8); y += 18;
  });
  note('Contagem de medições pontuais por faixa. Medições em jejum usam 70 a 130 mg/dL como faixa normal. Não representa tempo no alvo (TIR), que exige monitorização contínua.');
  /* comparação */
  h2('Comparação com o período anterior');
  const c = D.cmp, p = D.sp;
  tbl(['', `Atual (${fmtDM(D.a)} a ${fmtDM(D.b)})`, `Anterior (${fmtDM(D.pa)} a ${fmtDM(D.pb)})`, 'Diferença'], [
    ['Média (mg/dL)', fm(s.mean), fm(p.mean), pdfSign(c.diff)], ['Variação percentual', '', '', c.pct == null ? '-' : pdfSign(c.pct) + '%'],
    ['Medições', String(s.n), String(p.n), pdfSign(s.n - p.n, 0)],
    ['Abaixo de 70', `${s.hypo}`, `${p.hypo}`, pdfSign(s.hypo - p.hypo, 0)], ['Acima da faixa', `${s.hyper}`, `${p.hyper}`, pdfSign(s.hyper - p.hyper, 0)]
  ], { cols: { 0: { fontStyle: 'bold' } } });
  if (s.n < 10 || p.n < 10) note('Poucas medições em um dos períodos: a comparação pode não representar a rotina.');
  h2('Média por horário do dia');
  tbl(['Faixa horária', 'Medições', 'Média (mg/dL)'], D.blocks.map(b => [b.label, String(b.n), b.n >= MIN_BUCKET ? fm(b.mean) : 'dados insuficientes']));
  /* episódios */
  const epRow = r => [fmtDate(r.date), r.noTime ? '-' : r.time, fn(r.glucose, 1), CONTEXTS[r.context] || '', MEALS[r.meal] || '', pdfSafe(trunc(r.notes, 60))];
  const epHead = ['Data', 'Hora', 'mg/dL', 'Contexto', 'Refeição', 'Observações'];
  h2(`Hipoglicemia (< 70 mg/dL) · ${D.hypo.length} medições`);
  if (D.hypo.length) tbl(epHead, D.hypo.map(epRow), { cols: { 2: { fontStyle: 'bold' } } }); else note('Nenhuma medição abaixo de 70 mg/dL no período.');
  h2(`Hiperglicemia (acima de 180; jejum acima de 130) · ${D.hyper.length}`);
  if (D.hyper.length) tbl(epHead, D.hyper.map(epRow), { cols: { 2: { fontStyle: 'bold' } } }); else note('Nenhuma medição acima da faixa no período.');
  /* HbA1c */
  h2('Hemoglobina glicada · resultados laboratoriais');
  if (D.hba.length) tbl(['Data da coleta', 'HbA1c (%)', 'Laboratório', 'Observações'], D.hba.map(x => [fmtDate(x.date), fn(x.value, 1), pdfSafe(x.lab) || '-', pdfSafe(trunc(x.notes, 70))]));
  else note('Nenhum resultado laboratorial cadastrado.');
  note('Somente resultados de exame. Estimativas calculadas a partir de glicemias capilares não fazem parte deste relatório.');
  /* esquemas */
  h2('Esquemas de tratamento');
  if (D.sch.length) {
    tbl(['Esquema', 'Início', 'Fim', 'Basal', 'Rápida', 'Doses / horários'], D.sch.map(x => [pdfSafe(x.s.name), fmtDate(x.s.start), x.s.end ? fmtDate(x.s.end) : 'em uso', pdfSafe([x.s.basalInsulin, x.s.basalDose].filter(Boolean).join(' ')), pdfSafe(x.s.rapidInsulin), pdfSafe(trunc([x.s.mealDoses, x.s.times, x.s.extraMeds].filter(Boolean).join(' | '), 90))]), { fs: 8 });
    tbl(['Esquema', 'Medições', 'Média (mg/dL)', '< 70', 'Acima'], D.sch.map(x => [pdfSafe(x.s.name), String(x.n), fm(x.mean), `${x.hypo}${x.n ? ' (' + (x.hypo / x.n * 100).toFixed(0) + '%)' : ''}`, `${x.hyper}${x.n ? ' (' + (x.hyper / x.n * 100).toFixed(0) + '%)' : ''}`]));
    note('Resultados dentro do período do relatório. Comparação descritiva: diferenças podem refletir outros fatores. Este documento não recomenda doses nem mudanças de tratamento.');
  } else note('Nenhum esquema de tratamento no período.');
  /* histórico */
  h2(`Histórico de medições · ${D.recs.length}`);
  tbl(['Data', 'Hora', 'mg/dL', 'Faixa', 'Contexto / refeição', 'Carb. (g)', 'Insulina (Ui)', 'Obs.'], [...D.recs].reverse().map(r => [fmtDate(r.date), r.noTime ? '-' : r.time, fn(r.glucose, 1), bandOf(r.glucose, r.context).txt, pdfSafe([CONTEXTS[r.context], MEALS[r.meal]].filter(Boolean).join(' / ')), r.carbs != null ? fn(r.carbs) : '', pdfSafe(insTxt(r)), pdfSafe(trunc(r.notes, 40))]), { fs: 7.5, cols: { 2: { fontStyle: 'bold' } }, cell: d => { if (d.section === 'body' && d.column.index === 2) { const f = String(d.row.raw && d.row.raw[3] || ''); if (/elevada/i.test(f)) d.cell.styles.textColor = [214, 20, 40]; else if (/baixa/i.test(f)) d.cell.styles.textColor = [150, 20, 40]; } } });
  /* rodapé */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setDrawColor(...DARK); doc.setLineWidth(.6); doc.line(M, H - 38, W - M, H - 38);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUT);
    doc.text('TiaBete ' + APP_VERSION + ' · Dados armazenados localmente · Não substitui avaliação médica', M, H - 26);
    doc.text(`Página ${i} de ${pages}`, W - M, H - 26, { align: 'right' });
  }
  const ok = await saveFile(`tiabete-relatorio-${D.from}_${D.to}.pdf`, doc.output('arraybuffer'));
  if (status) status.textContent = ok ? 'PDF gerado.' : '';
}

async function makeXLSX() {
  try { await makeXLSXInner(); } catch (e) { console.error(e); toast('Não consegui gerar o Excel: ' + (e && e.message || e)); const st = $('#rep-status'); if (st) st.textContent = ''; }
}
async function makeXLSXInner() {
  const status = $('#rep-status'); if (status) status.textContent = 'Gerando Excel…';
  const D = reportData(), s = D.st, p = D.sp, c = D.cmp;
  const r1 = (x, d = 1) => x == null ? '' : +x.toFixed(d);
  const hist = r => [fmtDate(r.date), r.noTime ? '' : r.time, r.glucose, bandOf(r.glucose, r.context).txt, CONTEXTS[r.context] || '', MEALS[r.meal] || '', r.carbs ?? '', r.insMeal ?? '', r.insCorr ?? '', r.insBasal ?? '', r.insPen ?? '', r.insPump ?? '', r.actMin ?? '', r.actDesc || '', r.tags || '', r.notes || '', r.source || ''];
  const hh = ['Data', 'Horário', 'Glicemia (mg/dL)', 'Faixa', 'Contexto', 'Refeição', 'Carboidratos (g)', 'Insulina rápida (U)', 'Correção (U)', 'Basal (U)', 'Caneta (U)', 'Bomba (U)', 'Atividade (min)', 'Atividade', 'Etiquetas', 'Observações', 'Origem'];
  const hw = [12, 8, 16, 14, 18, 14, 14, 16, 12, 10, 10, 10, 14, 18, 20, 30, 10];
  const sheets = [
    { name: 'Resumo', title: 0, hdr: [4, 13], widths: [36, 26, 18], rows: [
      ['TiaBete ' + APP_VERSION + ' - Relatório glicêmico'], ['Período', fmtDate(D.from) + ' a ' + fmtDate(D.to)], D.ex ? ['ATENÇÃO', 'Contém dados de exemplo'] : [], [],
      ['Indicador', 'Valor'], ['Medições', s.n], ['Média (mg/dL)', r1(s.mean)], ['Desvio-padrão (mg/dL)', r1(s.sd)], ['Menor (mg/dL)', s.min ?? ''], ['Maior (mg/dL)', s.max ?? ''], ['Medições < 70', s.hypo], ['Medições acima da faixa', s.hyper], [],
      ['Faixa (mg/dL)', 'Medições', '% das medições'], ...BAND_LIST.map(b => [b.label + ' ' + b.name, D.bands[b.k], s.n ? r1(D.bands[b.k] / s.n * 100) : 0]), [],
      ['Observação', 'Contagem de medições pontuais; não representa tempo no alvo (TIR). Este relatório não recomenda doses.']] },
    { name: 'Comparação', hdr: [0, 8], widths: [24, 28, 28, 14], rows: [
      ['', 'Período atual', 'Período anterior', 'Diferença'], ['Intervalo', fmtDate(D.from) + ' a ' + fmtDate(D.to), fmtDate(isoDate(new Date(D.pa))) + ' a ' + fmtDate(isoDate(new Date(D.pb))), ''],
      ['Média (mg/dL)', r1(s.mean), r1(p.mean), r1(c.diff)], ['Variação %', '', '', r1(c.pct)], ['Medições', s.n, p.n, s.n - p.n], ['< 70', s.hypo, p.hypo, s.hypo - p.hypo], ['Acima da faixa', s.hyper, p.hyper, s.hyper - p.hyper], [],
      ['Faixa horária', 'Medições', 'Média (mg/dL)'], ...D.blocks.map(b => [b.label, b.n, b.n >= MIN_BUCKET ? r1(b.mean) : 'insuficiente'])] },
    { name: 'Histórico', widths: hw, rows: [hh, ...D.recs.map(hist)] },
    { name: 'Hipoglicemia', widths: hw, rows: [hh, ...D.hypo.map(hist)] },
    { name: 'Hiperglicemia', widths: hw, rows: [hh, ...D.hyper.map(hist)] },
    { name: 'HbA1c', widths: [16, 12, 28, 40], rows: [['Data da coleta', 'HbA1c (%)', 'Laboratório', 'Observações'], ...D.hba.map(x => [fmtDate(x.date), x.value, x.lab || '', x.notes || '']), [], ['Somente resultados laboratoriais. Estimativas não são incluídas.']] },
    { name: 'Esquemas', widths: [24, 12, 12, 18, 16, 18, 28, 18, 24, 30, 12, 12, 8, 8], rows: [['Esquema', 'Início', 'Fim', 'Insulina basal', 'Dose basal', 'Insulina rápida', 'Doses por refeição', 'Horários', 'Medicamentos adicionais', 'Observações', 'Medições no período', 'Média (mg/dL)', '< 70', 'Acima da faixa'],
      ...D.sch.map(x => [x.s.name, fmtDate(x.s.start), x.s.end ? fmtDate(x.s.end) : 'em uso', x.s.basalInsulin || '', x.s.basalDose || '', x.s.rapidInsulin || '', x.s.mealDoses || '', x.s.times || '', x.s.extraMeds || '', x.s.notes || '', x.n, r1(x.mean), x.hypo, x.hyper]), [], ['Comparação descritiva. Não recomenda doses nem mudanças de tratamento.']] }
  ];
  const ok = await saveFile(`tiabete-relatorio-${D.from}_${D.to}.xlsx`, buildXlsx(sheets));
  if (status) status.textContent = ok ? 'Excel gerado.' : '';
}
