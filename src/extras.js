/* ================= Extras: lembrete de backup, refeições, mapa de calor, eventos, último exame, resumo para consulta ================= */
S.events = []; S.lastBackup = 0; S.bkSnooze = 0;

/* ---------- 1. Lembrete de backup ---------- */
const BK_DAYS = 7;
const AL_DEF = { bHypo: true, bHyper: true, bBasal: true, bPre: true, bMiss: true, bLabel: true, postFast: true, postLunch: true, postDinner: true, backup: true, backupDays: 7, rewards: true, plan: true, plQuiet: false, hypo: true, hypoMin: 15, quiet: false, qFrom: '22:00', qTo: '06:00' };
S.alerts = { ...AL_DEF };
S.profile = null;
const alCfg = () => ({ ...AL_DEF, ...(S.alerts || {}) });
async function alSave() { try { await Store.put('meta', { id: 'alerts', value: S.alerts }); } catch (e) { } }
const hasRealData = () => S.records.some(r => !isEx(r)) || S.exams.length > 0 || S.hba.some(x => !isEx(x) && x.source !== 'exame') || blDirty() || plHas();
function backupBanner() {
  if (!alCfg().backup || !hasRealData() || Date.now() < S.bkSnooze) return '';
  const days = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / DAY) : null;
  if (days !== null && days < alCfg().backupDays) return '';
  return `<div class="banner warn"><span><b>Backup.</b> ${days === null ? 'Você ainda não fez backup deste aparelho.' : `Faz ${days} dia${days === 1 ? '' : 's'} desde o último backup.`} Seus dados ficam só neste navegador.</span><span class="row"><button class="btn sm pri" data-act="bk-json">Fazer backup</button><button class="btn sm" data-act="bk-snooze">Depois</button></span></div>`;
}
const lastBackupLine = () => `<p class="hint" style="margin:10px 0 0">Último backup: <b>${S.lastBackup ? new Date(S.lastBackup).toLocaleDateString('pt-BR') + ' (há ' + sinceTxt(isoDate(new Date(S.lastBackup))) + ')' : 'nenhum ainda'}</b>. O app lembra a cada ${alCfg().backupDays} dias (ajuste em Alertas e notificações).</p><p class="hint" style="margin:6px 0 0">Proteção do navegador contra limpeza automática: <b>${S.persisted ? 'ativa' : 'não concedida'}</b>. Mesmo ativa, limpar os dados do site apaga tudo; o backup é a garantia.</p>`;
async function markBackup() { S.lastBackup = Date.now(); try { await Store.put('meta', { id: 'last-backup', ts: S.lastBackup }); } catch (e) { } }

/* ---------- 6. Tempo desde o último exame ---------- */
function sinceTxt(iso) {
  const d = Math.max(0, Math.round((startOfDay(Date.now()) - startOfDay(mkTs(iso, '12:00'))) / DAY));
  if (d === 0) return 'hoje';
  if (d < 45) return d + (d === 1 ? ' dia' : ' dias');
  const m = Math.round(d / 30.44);
  if (m < 24) return m + (m === 1 ? ' mês' : ' meses');
  return Math.floor(d / 365.25) + ' anos';
}
function lastExamBox() {
  const ex = S.exams.filter(e => e.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const lab = S.hba.filter(x => !isEx(x)).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!ex && !lab) return '';
  const old = d => Math.round((startOfDay(Date.now()) - startOfDay(mkTs(d, '12:00'))) / DAY) > 90;
  const row = (t, d) => `<div class="row sp" style="gap:10px"><span>${t}</span><span style="text-align:right"><b class="num">${fmtDate(d)}</b> <span class="dim">· há ${sinceTxt(d)}</span>${old(d) ? ' <span class="tag warn">mais de 3 meses</span>' : ''}</span></div>`;
  return `<div class="card soft" style="margin:12px 0 0"><div class="stack" style="gap:8px">${ex ? row('Último exame enviado', ex.date) : ''}${lab ? row('Última HbA1c de laboratório', lab.date) : ''}</div><p class="hint" style="margin:8px 0 0">Com que frequência repetir os exames é uma decisão do seu médico.</p></div>`;
}

/* ---------- 2. Variação da refeição (depois − antes, no mesmo dia) ---------- */
function mealDeltas(recs) {
  const defs = [['cafe', 'Café da manhã', 'jejum (antes)'], ['almoco', 'Almoço', 'antes'], ['jantar', 'Jantar', 'antes']];
  const byDate = groupBy(recs, r => r.date);
  return defs.map(([m, name, pre]) => {
    const pairs = [];
    byDate.forEach(rs => {
      const a = rs.filter(r => m === 'cafe' ? (r.context === 'jejum' && !r.meal) : (r.context === 'antes' && r.meal === m));
      const b = rs.filter(r => r.context === 'depois' && r.meal === m);
      if (a.length && b.length) pairs.push({ pre: stats(a).mean, post: stats(b).mean });
    });
    const n = pairs.length, mean = k => pairs.reduce((s, p) => s + p[k], 0) / n;
    return { name, pre, n, a: n ? mean('pre') : null, b: n ? mean('post') : null, d: n ? mean('post') - mean('pre') : null };
  });
}
function mealDeltaCard(recs, inner) {
  const rows = mealDeltas(recs);
  return (inner ? '' : '<h2 class="sec">Variação da refeição (depois − antes)</h2><div class="card">') + `<div class="tbl-wrap"><table class="t"><thead><tr><th>Refeição</th><th>Antes</th><th>Depois</th><th>Variação</th></tr></thead><tbody>${rows.map(r => r.n >= MIN_BUCKET
    ? `<tr><td><b>${r.name}</b><small>${r.n} dias com par · antes = ${r.pre}</small></td><td>${fm(r.a)}</td><td>${fm(r.b)}</td><td><b>${fsign(r.d)}</b><small>mg/dL</small></td></tr>`
    : `<tr><td><b>${r.name}</b><small>antes = ${r.pre}</small></td><td colspan="3" class="dim">${r.n ? r.n + ' dia(s) com par · insuficiente' : 'sem pares no período'}</td></tr>`).join('')}</tbody></table></div><p class="hint">Para cada dia que tem medição antes e depois da mesma refeição, calcula-se a diferença; a tabela mostra a média dessas diferenças (mínimo ${MIN_BUCKET} dias). No café da manhã, o "antes" é o jejum. Descreve o que aconteceu e não indica dose.</p>` + (inner ? '' : '</div>');
}

/* ---------- 3. Mapa de calor: dia da semana × horário ---------- */
function heatmapCard(recs) {
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const cell = (d, tb) => { const rs = recs.filter(r => !r.noTime && ((new Date(r.ts).getDay() + 6) % 7) === d && parseInt(r.time.slice(0, 2), 10) >= tb.a && parseInt(r.time.slice(0, 2), 10) < tb.b); const s = stats(rs); return s.n >= MIN_BUCKET ? { v: s.mean, n: s.n } : { n: s.n }; };
  const rows = days.map((nm, d) => `<tr><th scope="row">${nm}</th>${TIME_BLOCKS.map(tb => { const c = cell(d, tb); if (c.v == null) return `<td class="hm-e" title="${c.n} medição(ões): insuficiente">${c.n ? '·' : '—'}</td>`; const b = bandOf(c.v); return `<td class="hm-${b.k}" title="Média ${fm(c.v)} mg/dL em ${c.n} medições · ${b.txt}"><b>${f0(c.v)}</b><i>${c.n}</i></td>`; }).join('')}</tr>`).join('');
  return `<h2 class="sec">Mapa de calor · dia e horário</h2><div class="card"><div class="tbl-wrap"><table class="hm"><thead><tr><th></th>${TIME_BLOCKS.map(tb => `<th>${tb.label}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div><div class="legend"><span><i class="hm-sw hm-ok"></i>dentro da faixa</span><span><i class="hm-sw hm-low"></i>baixa</span><span><i class="hm-sw hm-high"></i>elevada</span><span><i class="hm-sw hm-vhigh"></i>muito elevada</span></div><p class="hint">Cada quadro mostra a média em mg/dL e, em pequeno, o número de medições. "—" e "·" indicam menos de ${MIN_BUCKET} medições. A cor segue a faixa da média.</p></div>`;
}

/* ---------- 5. Eventos nos gráficos ---------- */
const evTs = e => mkTs(e.date, '12:00');
function eventsIn(x0, x1) { return S.events.filter(e => { const t = evTs(e); return t >= x0 && t <= x1; }).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 9); }
function eventMarks(x0, x1, X, T, ph) {
  return eventsIn(x0, x1).map((e, i) => { const x = X(evTs(e)).toFixed(1); return `<line x1="${x}" x2="${x}" y1="${T + 9}" y2="${T + ph}" stroke="var(--fg)" stroke-width=".8" stroke-dasharray="2 3" opacity=".55"/><circle cx="${x}" cy="${T + 6}" r="6" fill="var(--fg)"/><text x="${x}" y="${T + 9.3}" text-anchor="middle" style="font:700 9px var(--f-mono);fill:var(--bg)">${i + 1}</text>`; }).join('');
}
function eventLegend(x0, x1) {
  const ev = eventsIn(x0, x1); if (!ev.length) return '';
  return `<div class="legend" style="flex-direction:column;gap:4px;margin-top:8px">${ev.map((e, i) => `<span><b class="evn">${i + 1}</b>${fmtDate(e.date).slice(0, 5)} · ${esc(e.text)}</span>`).join('')}</div>`;
}
function viewEventos() {
  const list = [...S.events].sort((a, b) => b.date.localeCompare(a.date));
  return banners() + `<p class="hint" style="margin:0 0 12px">Marque doença, viagem, mudança de rotina ou de tratamento. As marcas aparecem como números sobre o gráfico de medições, para ajudar a entender picos e quedas fora do padrão.</p><button class="btn pri full" data-act="ev-new">Adicionar evento</button><h2 class="sec">Meus eventos</h2>` +
    (list.length ? `<div class="stack">${list.map(e => `<button class="rec" style="grid-template-columns:1fr" data-act="ev-edit" data-id="${e.id}"><span class="info"><span class="num">${fmtDate(e.date)}</span><span style="font-weight:700;overflow-wrap:anywhere">${esc(e.text)}</span></span></button>`).join('')}</div>` : `<div class="card">${emptyBlock('Nenhum evento', 'Adicione o primeiro, por exemplo "Gripe" ou "Viagem".')}</div>`);
}
function eventForm(x) {
  x = x || { date: isoDate(new Date()), text: '' };
  return `<h2>${x.id ? 'Editar evento' : 'Novo evento'}</h2><form id="ev-form" data-id="${x.id || ''}" novalidate><div class="form-grid"><div class="field"><label class="fl" for="ev-d">Data</label><input class="in" type="date" id="ev-d" value="${x.date}"></div><div class="field full"><label class="fl" for="ev-t">O que aconteceu</label><input class="in" id="ev-t" maxlength="60" value="${esc(x.text)}" placeholder="Ex.: Gripe, viagem, mudança de rotina"></div></div><p class="err" id="ev-err" role="alert"></p><div class="row"><button class="btn pri grow" type="submit">Salvar</button><button class="btn" type="button" data-act="close">Cancelar</button></div>${x.id ? `<button class="btn danger full" type="button" style="margin-top:10px" data-act="ev-del-ask" data-id="${x.id}">Excluir evento</button>` : ''}</form>`;
}

/* ---------- 4. Resumo para a consulta (PDF) ---------- */
async function makeSummaryPDF() {
  const status = $('#rep-status'), say = t => { if (status) status.textContent = t; };
  try {
    say('Gerando resumo…');
    try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'); } catch (e) { }
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('A biblioteca de PDF não carregou. Verifique a conexão e recarregue.'); say(''); return; }
    const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    if (typeof doc.autoTable !== 'function') { toast('O módulo de tabelas do PDF não carregou.'); say(''); return; }
    const _tx = doc.text.bind(doc); doc.text = (t, ...a) => _tx(Array.isArray(t) ? t.map(pdfSafe) : pdfSafe(t), ...a);
    const W = 595, H = 842, M = 40, CW = W - 2 * M, RED = [255, 46, 62], DARK = [91, 13, 22], INK = [30, 24, 27], MUT = [112, 102, 107];
    const to = isoDate(new Date()), from = isoDate(new Date(addDays(Date.now(), -89)));
    const recs = inRange(S.records.filter(r => !isEx(r)), mkTs(from, '00:00'), endOfDay(Date.now())), st = stats(recs), bc = bandCounts(recs);
    let y = 0;
    doc.setFillColor(8, 7, 10); doc.rect(0, 0, W, 78, 'F'); doc.setFillColor(...RED); doc.rect(0, 78, W, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(255, 255, 255); doc.text('Tia', M, 46);
    const gw = doc.getTextWidth('Tia'); doc.setTextColor(...RED); doc.text('Bete', M + gw, 46);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(185, 175, 180);
    doc.text('RESUMO PARA A CONSULTA', M, 64);
    doc.text(`Ultimos 90 dias (${fmtDate(from)} a ${fmtDate(to)})  ·  gerado em ${new Date().toLocaleDateString('pt-BR')}`, W - M, 64, { align: 'right' });
    y = 104;
    const need = h => { if (y + h > H - 50) { doc.addPage(); y = 50; } };
    const h2 = t => { need(50); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...RED); doc.text(t.toUpperCase(), M, y); doc.setDrawColor(...DARK); doc.setLineWidth(.8); doc.line(M, y + 4, W - M, y + 4); y += 17; };
    const para = (t, o = {}) => { doc.setFont('helvetica', o.b ? 'bold' : 'normal'); doc.setFontSize(o.fs || 9); doc.setTextColor(...(o.c || INK)); const l = doc.splitTextToSize(t, CW); need(l.length * 11.5 + 4); doc.text(l, M, y); y += l.length * 11.5 + 3; };
    const tbl = (head, body, cols) => { need(40); doc.autoTable({ startY: y, head: [head.map(pdfSafe)], body: body.map(r => r.map(pdfSafe)), theme: 'grid', margin: { left: M, right: M, bottom: 50 }, styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3.2, textColor: INK, lineColor: [225, 218, 221], lineWidth: .4 }, headStyles: { fillColor: DARK, textColor: 255, fontStyle: 'bold' }, columnStyles: cols || {} }); y = doc.lastAutoTable.finalY + 12; };
    h2('Glicemias capilares');
    if (!st.n) para('Sem medicoes neste periodo.', { c: MUT });
    else {
      tbl(['Indicador', 'Valor', 'Indicador', 'Valor'], [
        ['Medicoes', String(st.n), 'Media', fm(st.mean) + ' mg/dL'],
        ['Desvio-padrao', st.sd != null ? fm(st.sd) + ' mg/dL' : '-', 'Menor / maior', `${f0(st.min)} / ${f0(st.max)} mg/dL`],
        ['Abaixo de 70', `${st.hypo} (${(st.hypo / st.n * 100).toFixed(0)}%)`, 'Acima da faixa (180; jejum 130)', `${st.hyper} (${(st.hyper / st.n * 100).toFixed(0)}%)`]], { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } });
      tbl(['Faixa (mg/dL)', 'Medicoes', '%'], BAND_LIST.map(b => [b.label + '  ' + b.name, String(bc[b.k]), (bc[b.k] / st.n * 100).toFixed(0) + '%']), { 0: { cellWidth: 260 } });
    }
    h2('Hemoglobina glicada (HbA1c)');
    const labs = S.hba.filter(x => !isEx(x)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
    if (labs.length) tbl(['Data', 'HbA1c (laboratorio)', 'Avaliacao', 'Laboratorio'], labs.map(x => { const e = a1cEval(x.value, S.a1cT); return [fmtDate(x.date), fn(x.value, 1) + '%', e.txt + ` (meta ${fn(S.a1cT, 1)}%)`, x.lab || '-']; }));
    else para('Nenhum resultado de laboratorio registrado.', { c: MUT });
    const e90 = est90(); para(e90.ok ? `Estimativa matematica (nao e exame): aprox. ${fn(e90.value, 1)}% pela media dos ultimos 90 dias (${e90.st.n} medicoes em ${e90.days} dias).` : 'Estimativa matematica indisponivel: poucas medicoes nos ultimos 90 dias.', { c: MUT, fs: 8.5 });
    const exs = S.exams.filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date)), last2 = exs.slice(-2), lastEx = exs[exs.length - 1];
    h2('Exames laboratoriais');
    if (!lastEx) para('Nenhum exame enviado.', { c: MUT });
    else {
      const sc = e => { const s = examScore(e.items); return s ? fn(s.score, 1) + '/10' : 'sem nota'; };
      para(`Nota (0-10, resumo do app): ` + last2.map(e => `${fmtDate(e.date)} = ${sc(e)}`).join('   |   '), { b: true });
      const C = compareExams(last2);
      if (last2.length === 2 && C.multi.length) {
        const rows = C.multi.map(r => [r.name + (r.unit ? ' (' + r.unit + ')' : ''), ...r.cells.map(c => c ? (c.value != null ? fn(c.value) : c.text) + (c.flag === 'alto' ? ' ^' : c.flag === 'baixo' ? ' v' : '') : '-'), r.dir ? { subiu: 'subiu', desceu: 'desceu', igual: 'estavel' }[r.dir] + (r.rel && r.rel !== 'igual' ? ', ' + { perto: 'mais perto da ref.', longe: 'mais longe da ref.', dentro: 'dentro nos dois' }[r.rel] : '') : '-']);
        tbl(['Item', ...C.exams.map(e => fmtDate(e.date)), 'Variacao'], rows.slice(0, 16), { 0: { cellWidth: 190 } });
        if (rows.length > 16) para(`(+${rows.length - 16} itens na comparacao completa do app)`, { c: MUT, fs: 8 });
        para('^ acima e v abaixo da referencia do laudo daquela data.', { c: MUT, fs: 8 });
      } else {
        const bad = lastEx.items.filter(i => i.flag === 'alto' || i.flag === 'baixo');
        para(`Exame de ${fmtDate(lastEx.date)}${lastEx.lab ? ' (' + lastEx.lab + ')' : ''}: ${bad.length ? bad.length + ' item(ns) fora da referencia do laudo.' : 'nenhum item fora da referencia do laudo.'}`);
        if (bad.length) tbl(['Item', 'Resultado', 'Referencia do laudo', 'Situacao'], bad.slice(0, 14).map(i => [i.name, (i.value != null ? fn(i.value) + ' ' + i.unit : i.text), i.refText || '-', i.flag === 'alto' ? 'Acima' : 'Abaixo']));
      }
      const att = (lastEx.attention || []).slice(0, 4), qs = (lastEx.questions || []).slice(0, 4);
      if (att.length) { para('Pontos para conversar (texto gerado por IA a partir do laudo):', { b: true }); att.forEach(t => para('- ' + t, { fs: 8.5 })); }
      if (qs.length) { para('Perguntas para levar a consulta:', { b: true }); qs.forEach(t => para('- ' + t, { fs: 8.5 })); }
    }
    const ev = S.events.filter(e => e.date >= from).sort((a, b) => a.date.localeCompare(b.date)).slice(-6);
    if (ev.length) { h2('Eventos marcados'); ev.forEach(e => para(`${fmtDate(e.date)} - ${e.text}`, { fs: 8.5 })); }
    need(40); y = Math.max(y, H - 56); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUT);
    doc.text(doc.splitTextToSize('Documento de acompanhamento pessoal gerado pelo TiaBete. Nao e diagnostico nem indicacao de tratamento; a interpretacao e do medico. Notas e textos de exames sao resumos automaticos: confira com os laudos originais.', CW), M, y);
    const pdf = doc.output('arraybuffer');
    await outFile(`tiabete-resumo-consulta-${stamp()}.pdf`, new Uint8Array(pdf));
    say('');
  } catch (e) { console.error(e); toast('Não consegui gerar o resumo: ' + (e && e.message || e)); const st = $('#rep-status'); if (st) st.textContent = ''; }
}

/* ---------- eventos de interface ---------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  try {
    switch (act) {
      case 'rw-open': go('conquistas'); break;
      case 'rw-dismiss': rwState().seen = S.rw.last && S.rw.last.ts; await rwSave(); render(); break;
      case 'rw-play': rwCelebrate(el.dataset.k, +el.dataset.n); break;
      case 'bk-snooze': S.bkSnooze = Date.now() + 2 * DAY; try { await Store.put('meta', { id: 'bk-snooze', ts: S.bkSnooze }); } catch (x) { } render(); break;
      case 'ev-new': openSheet(eventForm()); break;
      case 'ev-edit': openSheet(eventForm(S.events.find(x => x.id === id))); break;
      case 'ev-del-ask': el.dataset.act = 'ev-del-do'; el.textContent = 'Toque de novo para excluir'; el.classList.add('pri'); setTimeout(() => { if (el.isConnected && el.dataset.act === 'ev-del-do') { el.dataset.act = 'ev-del-ask'; el.textContent = 'Excluir evento'; el.classList.remove('pri'); } }, 4000); break;
      case 'ev-del-do': await Store.del('events', id); await loadAll(); closeSheet(); render(); toast('Evento excluído.'); break;
      case 'rep-summary': await makeSummaryPDF(); break;
    }
  } catch (err) { console.error(err); toast('Algo deu errado: ' + (err && err.message || err)); }
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'ev-form') return; e.preventDefault();
  try {
    const f = e.target, d = parseDate($('#ev-d').value), t = $('#ev-t').value.trim();
    if (!d) { $('#ev-err').textContent = 'Informe uma data válida.'; return; }
    if (!t) { $('#ev-err').textContent = 'Descreva o evento.'; return; }
    const old = f.dataset.id ? S.events.find(x => x.id === f.dataset.id) : null;
    await Store.put('events', { ...(old || {}), id: old ? old.id : uid(), date: d, text: t.slice(0, 60) });
    await loadAll(); closeSheet(); render(); toast('Evento salvo.');
  } catch (err) { console.error(err); toast('Não foi possível salvar: ' + (err && err.message || err)); }
});

/* ---------- Insulinas (Painel): basal com cronômetro de 24 h e três chaves de insulina rápida ---------- */
const H24 = 24 * 3600e3, HM = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
S.ins = { basalTs: null, day: '', fast: null, lunch: null, dinner: null, dinnerMin: 140 };
let insLoaded = false; // só grava o estado das insulinas depois de lido do banco (evita sobrescrever com valores vazios)
const insSave = async () => { if (!insLoaded) return; try { await Store.put('meta', { id: 'insulin', ...S.ins }); } catch (e) { } };
function insRoll() { const d = isoDate(new Date()); if (S.ins.day === d) return false; S.ins.day = d; S.ins.fast = S.ins.lunch = S.ins.dinner = null; S.ins.skip = {}; return true; }
const skipped = k => !!(S.ins.skip && S.ins.skip[k]);
const setSkip = (k, v) => { S.ins.skip = S.ins.skip || {}; if (v) S.ins.skip[k] = 1; else delete S.ins.skip[k]; };
const INS_KIND = { basal: 'Basal', fast: 'Jejum', lunch: 'Almoço', dinner: 'Jantar', extra: 'Outra insulina' };
const insName = r => r.kind === 'extra' ? (r.name || 'Outra insulina') : INS_KIND[r.kind];
async function logAdd(kind, ts, units) { const r = { id: uid(), kind, ts, date: isoDate(new Date(ts)), at: Date.now() }; if (units != null) r.units = units; await Store.put('inslog', r); S.inslog.push(r); S.inslog.sort((a, b) => a.ts - b.ts); return r; }
async function logDel(id) { await Store.del('inslog', id); S.inslog = S.inslog.filter(x => x.id !== id); }
async function logPut(r) { await Store.put('inslog', r); S.inslog = S.inslog.map(x => x.id === r.id ? r : x).sort((a, b) => a.ts - b.ts); }
const todayLog = k => S.inslog.filter(x => x.kind === k && x.date === isoDate(new Date()));
async function logDayClear(k) { for (const r of todayLog(k)) await logDel(r.id); }
function insSync() { S.ins.day = isoDate(new Date()); ['fast', 'lunch', 'dinner'].forEach(k => { const l = todayLog(k); S.ins[k] = l.length ? l[l.length - 1].ts : null; }); }
async function insBackfill() { // migração única: estado do dia e basal já registrados antes do histórico existir
  let ch = false;
  if (S.ins.basalTs && !S.inslog.some(x => x.kind === 'basal' && x.ts === S.ins.basalTs)) { await logAdd('basal', S.ins.basalTs); ch = true; }
  if (S.ins.day === isoDate(new Date())) for (const k of ['fast', 'lunch', 'dinner']) if (S.ins[k] && !S.inslog.some(x => x.kind === k && x.ts === S.ins[k])) { await logAdd(k, S.ins[k]); ch = true; }
  return ch;
}
function parseUnits(s) { s = String(s == null ? '' : s).trim().replace(',', '.'); if (!s) return null; const v = Number(s); return isFinite(v) && v > 0 && v <= 300 ? Math.round(v * 10) / 10 : 'bad'; }
const unitsEntry = k => k === 'basal' ? S.inslog.find(x => x.kind === 'basal' && x.ts === S.ins.basalTs) : todayLog(k).slice(-1)[0];
const fU = u => String(u).replace('.', ',') + ' Ui';
function unitsInline(k) { const e = unitsEntry(k); return `<div class="un-row"><label for="un-${k}">Unidades tomadas</label><span class="un-f"><input class="in un-in" id="un-${k}" data-k="${k}" inputmode="decimal" autocomplete="off" placeholder="—" value="${e && e.units != null ? String(e.units).replace('.', ',') : ''}" aria-label="Unidades tomadas"><b>Ui</b></span></div>`; }
function unitsField(id, cur) { return `<div class="field"><label class="fl" for="${id}">Unidades (opcional)</label><input class="in" id="${id}" inputmode="decimal" autocomplete="off" placeholder="ex.: 8" value="${cur != null ? String(cur).replace('.', ',') : ''}"></div>`; }
function hms(ms) { const t = Math.floor(Math.abs(ms) / 1000); return Math.floor(t / 3600) + ':' + pad(Math.floor(t % 3600 / 60)) + ':' + pad(t % 60); }
function basalInfo() {
  if (!S.ins.basalTs) return null;
  const el = Date.now() - S.ins.basalTs, rem = H24 - el;
  return { el, rem, st: rem <= 0 ? 'over' : rem <= 3600e3 ? 'soon' : 'ok' };
}
function basalBanner() {
  if (!alCfg().bBasal) return '';
  const b = basalInfo(); if (!b || b.st === 'ok' || skipped('basal')) return '';
  return `<div class="banner warn"><span><b>Basal.</b> ${b.st === 'over' ? 'Já passaram 24 h desde a última dose de basal.' : `Faltam ${Math.max(1, Math.ceil(b.rem / 60000))} min para completar 24 h da última basal.`}</span>${S.route === 'painel' ? '' : '<button class="btn sm" data-act="go" data-r="painel">Ver</button>'}</div>`;
}
function preDinner() {
  const a = mkTs(isoDate(new Date()), '00:00');
  const rs = inRange(S.records, a, endOfDay(a)).filter(r => !r.noTime && ((r.context === 'antes' && r.meal === 'jantar') || (!r.context && (() => { const w = ruleFor(r); return w && w.context === 'antes' && w.meal === 'jantar'; })())));
  return rs.length ? rs[rs.length - 1] : null;
}
const dinnerOpen = () => { const pd = preDinner(); return !!(pd && pd.glucose >= S.ins.dinnerMin); };
const isLocked = k => k === 'dinner' && !S.ins.dinner && !dinnerOpen();
function dinnerBanner() {
  if (!alCfg().bPre) return '';
  insRoll(); if (S.ins.dinner || skipped('dinner') || !dinnerOpen()) return '';
  const pd = preDinner();
  return `<div class="banner warn"><span><b>Pré-jantar.</b> Sua medição das ${pd.time} foi <b class="num">${f0(pd.glucose)}</b> mg/dL, no limite de ${S.ins.dinnerMin} ou acima. A chave da insulina rápida do jantar está liberada.</span>${S.route === 'painel' ? '' : '<button class="btn sm" data-act="go" data-r="painel">Ver</button>'}</div>`;
}
/* Lembrete de medição pré-refeição (só no Painel, só avisa; nada é enviado) */
const REM_WIN = [{ k: 'jejum', t: 'em jejum', a: 240, b: 480, ctx: 'jejum', meal: 'cafe' }, { k: 'almoco', t: 'antes do almoço', a: 600, b: 720, ctx: 'antes', meal: 'almoco' }, { k: 'jantar', t: 'antes do jantar', a: 960, b: 1140, ctx: 'antes', meal: 'jantar' }];
S.remOff = {};
function remPending() {
  const now = new Date(), m = now.getHours() * 60 + now.getMinutes(), day = isoDate(now);
  const w = REM_WIN.find(x => m >= x.a && m < x.b); if (!w || S.remOff[day + w.k]) return null;
  const has = S.records.some(r => r.date === day && !r.noTime && (() => { const t = parseTime(r.time); if (!t) return false; const [h, mi] = t.split(':').map(Number); const mm = h * 60 + mi; return mm >= w.a && mm < w.b; })());
  return has ? null : { ...w, key: day + w.k };
}
function remBanner() {
  if (!alCfg().bMiss) return '';
  if (S.route !== 'painel' && !S._acCollect) return ''; const r = remPending(); S._rk = r ? r.key : '';
  return r ? `<div class="banner"><span><b>Medição.</b> Ainda sem glicemia ${r.t} hoje (janela ${hhmm(r.a)}–${hhmm(r.b)}).</span><span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm pri" data-act="new" data-ctx="${r.ctx}" data-meal="${r.meal}">Registrar</button><button class="btn sm" data-act="rem-off" data-k="${r.key}">Dispensar</button></span></div>` : '';
}
setInterval(() => { if (S.route === 'painel' && !document.getElementById('sheet-bg')) { const r = remPending(), k = r ? r.key : ''; if (k !== (S._rk || '')) render(); } }, 5000);
document.addEventListener('click', e => { const el = e.target.closest('[data-act="rem-off"]'); if (!el) return; S.remOff[el.dataset.k] = 1; render(); });
S.ud = {};
/* doses memorizadas: última quantidade registrada de cada insulina, independente; só muda quando uma aplicação é registrada */
const fnU = u => u == null ? '' : String(u).replace('.', ',');
const lastUnits = k => { const l = [...S.inslog].reverse().find(x => x.kind === k && x.units != null); return l ? l.units : null; };
const memU = k => S.ud[k] !== undefined ? S.ud[k] : fnU(S.ins.lastU && S.ins.lastU[k] != null ? S.ins.lastU[k] : lastUnits(k));
const memNum = k => { const u = parseUnits(memU(k)); return typeof u === 'number' ? u : null; };
function memSet(k, u) { if (typeof u !== 'number' || !(u > 0)) return; S.ins.lastU = S.ins.lastU || {}; S.ins.lastU[k] = u; S.ud[k] = fnU(u); }
let insBusy = false;
const udOk = k => { const u = parseUnits(memU(k)); return typeof u === 'number' && u > 0; };
const draftUnits = (k, req = true) => `<div class="un-row"><label for="ud-${k}">Unidades</label><span class="un-f"><input class="in un-in un-draft" id="ud-${k}" data-k="${k}" inputmode="decimal" autocomplete="off" placeholder="ex.: 8" value="${esc(memU(k))}" aria-label="Unidades de ${k === 'basal' ? 'basal' : 'insulina rápida'}"><b>Ui</b></span></div>${req ? `<div class="dim" id="udh-${k}" style="font-size:13.5px;margin-top:4px${udOk(k) ? ';display:none' : ''}">Informe as unidades (Ui) para liberar a chave.</div>` : ''}`;
document.addEventListener('input', e => {
  const el = e.target.closest && e.target.closest('input.un-draft'); if (!el) return;
  const k = el.dataset.k; S.ud[k] = el.value; const ok = udOk(k), b = document.querySelector('.tgl[data-k="' + k + '"]'), h = document.getElementById('udh-' + k);
  if (h) h.style.display = ok ? 'none' : '';
  if (b && !b.dataset.lk) { b.disabled = !ok; b.setAttribute('aria-disabled', String(!ok)); b.style.opacity = ok ? '' : '.35'; }
  const nb = document.querySelector('[data-act="ins-now"][data-k="' + k + '"]'); if (nb) { nb.disabled = !ok; nb.setAttribute('aria-disabled', String(!ok)); }
});
function swRow(k, title, sub, extra = '') {
  const on = S.ins[k], lk = isLocked(k), sk = skipped(k) && !on;
  const nowBtn = on ? `<button class="btn ins-act" disabled aria-label="${title}: dose já registrada">✓ Registrada</button>` : `<button class="btn pri ins-act" data-act="ins-now" data-k="${k}" ${udOk(k) ? '' : 'disabled aria-disabled="true"'}>Tomei agora</button>`;
  return `<div class="sw-row"><div style="min-width:0;flex:1"><b>${title}</b><div class="dim" style="font-size:14px;margin-top:2px;overflow-wrap:anywhere">${on ? `<b style="color:var(--good)">✓ Tomada às ${HM(on)}${on && unitsEntry(k) && unitsEntry(k).units != null ? ' · ' + fU(unitsEntry(k).units) : ''}</b>` : sk ? '<b style="color:var(--mut)">⏭ Pulada hoje</b>' : lk ? '🔒 Bloqueada até a glicemia pré-jantar ser ' + S.ins.dinnerMin + ' ou mais' : 'Ainda não tomada'}${sub ? ' · ' + sub : ''}</div>${sk ? `<button class="btn sm" style="margin-top:8px" data-act="ins-skip" data-k="${k}">Desfazer</button>` : lk ? '' : `${draftUnits(k)}<div class="ins-line" style="margin-top:8px">${nowBtn}</div><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn sm" data-act="ins-time" data-k="${k}" data-t="${title}">${on ? 'Editar horário' : 'Outro horário'}</button>${on ? '' : `<button class="btn sm" data-act="ins-skip" data-k="${k}">Pular hoje</button>`}</div>`}${extra}</div><button class="tgl" role="switch" ${lk || sk ? 'data-lk="1" ' : ''}${lk || sk || (!on && !udOk(k)) ? 'disabled aria-disabled="true" style="opacity:.35" ' : ''}aria-checked="${!!on}" aria-label="${title}: ${on ? 'tomada' : 'não tomada'}" data-act="ins-tgl" data-k="${k}"><i>${on ? '✓' : ''}</i></button></div>`;
}
function insCard() {
  insRoll();
  const b = basalInfo(), pd = preDinner(), min = S.ins.dinnerMin;
  let dn = '', dnWarn = '';
  if (!pd) dn = `<div class="dim" style="font-size:14px;margin-top:6px">Sem medição pré-jantar hoje (16h–19h). A chave só libera com ${min} mg/dL ou mais.</div>`;
  else { const yes = pd.glucose >= min; dn = `<div style="margin-top:6px;font-size:14px">Pré-jantar <b class="num">${f0(pd.glucose)}</b> mg/dL às ${pd.time}: <span class="badge ${yes ? 'high' : 'ok'}">${yes ? '▲ ' + min + ' ou mais' : '● abaixo de ' + min}</span> <span class="dim">${yes ? 'chave liberada.' : 'chave bloqueada.'}</span>${S.ins.dinner && !yes ? ' <span class="tag warn">marcada fora da regra</span>' : ''}</div>`; }
  dn += `<button class="btn sm" style="margin-top:8px" data-act="ins-min">Alterar limite (${min})</button>`;
  const basal = !b ? `<div class="v num" id="ib-t" style="font-family:var(--f-display);font-weight:500;font-size:34px;letter-spacing:-.03em;line-height:1.1">—</div><div class="dim" style="font-size:14px;margin-top:4px">Marque quando tomar a basal para iniciar a contagem de 24 h.</div>`
    : `<div class="dim" style="font-size:13.5px;font-family:var(--f-mono);letter-spacing:.08em">${b.st === 'over' ? 'PASSARAM 24 H · ATRASO' : 'FALTAM PARA A PRÓXIMA'}</div><div class="v num" id="ib-t" style="font-family:var(--f-display);font-weight:500;font-size:34px;letter-spacing:-.03em;line-height:1.1;${b.st === 'over' ? 'color:var(--red-l)' : ''}">${b.st === 'over' ? '+' : ''}${hms(b.rem)}</div>
      <div class="ib-bar"><span id="ib-bar" style="width:${Math.min(100, b.el / H24 * 100).toFixed(1)}%"></span></div>
      <div class="dim" style="font-size:14px;margin-top:6px">Última basal: <b class="num">${new Date(S.ins.basalTs).toDateString() === new Date().toDateString() ? 'hoje' : 'ontem'} ${HM(S.ins.basalTs)}</b> · próxima: <b class="num">${new Date(S.ins.basalTs + H24).toDateString() === new Date().toDateString() ? 'hoje' : 'amanhã'} ${HM(S.ins.basalTs + H24)}</b></div>${b.st !== 'ok' ? `<div style="margin-top:8px"><span class="badge high">${b.st === 'over' ? '▲▲ Hora da basal' : '▲ Chegando a hora'}</span></div>` : ''}`;
  const skB = skipped('basal'), pend = ['fast', 'lunch', 'dinner'].filter(k => !S.ins[k]), allSk = skB && pend.every(skipped);
  const basalShow = skB ? `<div style="font-weight:700">⏭ Basal pulada hoje</div><div class="dim" style="font-size:14px;margin-top:4px">O lembrete de 24 h fica em silêncio até amanhã.${b ? ' Última basal: ' + (new Date(S.ins.basalTs).toDateString() === new Date().toDateString() ? 'hoje' : 'ontem') + ' ' + HM(S.ins.basalTs) + '.' : ''}</div>` : basal;
  return `<div class="row" style="justify-content:space-between;align-items:center;gap:8px"><h2 class="sec" style="margin:0">Insulinas</h2><button class="btn sm" data-act="ins-skip-all">${allSk ? 'Desfazer pulos de hoje' : 'Pular tudo hoje'}</button></div><div class="card" id="ins-basal" data-st="${b ? b.st : 'none'}"><div class="eyebrow">Basal · lembrete de 24 h</div><div style="margin-top:8px">${basalShow}</div>
    ${skB ? '' : `<div class="ins-line">${draftUnits('basal', false)}<button class="btn ${b && b.st === 'ok' ? '' : 'pri'} ins-act" data-act="ins-basal">Tomei a basal agora</button></div>`}
    <div class="ins-sec"><button class="btn sm" data-act="ins-basal-at">Outro horário</button><button class="btn sm" data-act="ins-skip" data-k="basal">${skB ? 'Desfazer pulo' : 'Pular hoje'}</button>${b ? '<button class="btn sm" data-act="ins-basal-stop">Parar lembrete</button>' : ''}</div></div>
  <div class="card" style="margin-top:12px"><div class="eyebrow">Insulina rápida · hoje</div><p class="hint" style="margin:4px 0 2px">Unidades memorizadas da última dose; edite quando precisar. A chave fica verde ao registrar e desliga sozinha a cada dia.</p>
    ${swRow('fast', 'Jejum', '')}${swRow('lunch', 'Pré-prandial do almoço', '')}${swRow('dinner', 'Pré-prandial do jantar', '', dn)}
    <button class="btn full" style="margin-top:12px" data-act="go" data-r="insulinas">Ver histórico de insulinas</button>
    <p class="hint" style="margin:10px 0 0">O app só registra e lembra, segundo as regras que você definiu. Não calcula nem sugere dose. Confirme sempre com seu médico.</p></div>${extraInsCard()}`;
}
setInterval(() => {
  if (!insLoaded) return;
  if (insRoll()) { insSave(); render(); return; }
  const card = document.getElementById('ins-basal'); if (!card) return;
  const b = basalInfo(), st = b ? b.st : 'none';
  if (card.dataset.st !== st) { render(); return; }
  if (!b) return;
  const t = document.getElementById('ib-t'); if (t) t.textContent = (b.st === 'over' ? '+' : '') + hms(b.rem);
  const bar = document.getElementById('ib-bar'); if (bar) bar.style.width = Math.min(100, b.el / H24 * 100).toFixed(1) + '%';
}, 500);
let basalConfirm = 0;
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act^="ins-"]'); if (!el) return;
  const act = el.dataset.act;
  try {
    if (act === 'ins-tgl') { insRoll(); const k = el.dataset.k; if (isLocked(k)) { toast('Bloqueada: só libera com glicemia pré-jantar de ' + S.ins.dinnerMin + ' ou mais.'); return; } setSkip(k, false); if (S.ins[k]) { await logDayClear(k); S.ins[k] = null; } else { const inp = document.getElementById('ud-' + k), u = parseUnits(inp ? inp.value : (S.ud[k] || '')); if (typeof u !== 'number' || !(u > 0)) { toast('Informe as unidades (Ui) antes de marcar.'); return; } if (insBusy) return; insBusy = true; try { const r = await logAdd(k, Date.now(), u); S.ins[k] = r.ts; memSet(k, u); } finally { insBusy = false; } } await insSave(); render(); }
    else if (act === 'ins-now') {
      insRoll(); const k = el.dataset.k; if (isLocked(k)) { toast('Bloqueada: só libera com glicemia pré-jantar de ' + S.ins.dinnerMin + ' ou mais.'); return; } if (S.ins[k] || insBusy) return;
      const inp = document.getElementById('ud-' + k), u = parseUnits(inp ? inp.value : memU(k)); if (typeof u !== 'number' || !(u > 0)) { toast('Informe as unidades (Ui) antes de registrar.'); return; }
      insBusy = true; try { const r = await logAdd(k, Date.now(), u); S.ins[k] = r.ts; setSkip(k, false); memSet(k, u); await insSave(); } finally { insBusy = false; }
      render(); toast(INS_KIND[k] + ' registrada às ' + HM(S.ins[k]) + ' · ' + fU(u) + '.');
    }
    else if (act === 'ins-basal') {
      if (insBusy) return; const b = basalInfo(), inp = document.getElementById('ud-basal'), u = parseUnits(inp ? inp.value : memU('basal'));
      if (u === 'bad') { toast('Unidades: informe um número entre 0,5 e 300.'); return; }
      if (b && b.st === 'ok' && Date.now() - basalConfirm > 5000) { basalConfirm = Date.now(); el.textContent = 'Confirmar nova dose'; el.classList.add('pri'); setTimeout(() => { basalConfirm = 0; if (el.isConnected) render(); }, 5000); return; }
      insBusy = true; try { const r = await logAdd('basal', Date.now(), u == null ? undefined : u); S.ins.basalTs = r.ts; setSkip('basal', false); memSet('basal', u); } finally { insBusy = false; } basalConfirm = 0; await insSave(); render(); toast('Basal registrada às ' + HM(S.ins.basalTs) + (typeof u === 'number' ? ' · ' + fU(u) : '') + '. Contagem de 24 h iniciada.');
    }
    else if (act === 'ins-basal-at') {
      const cur = S.ins.basalTs, d = isoDate(new Date(cur || Date.now())), t = HM(cur || Date.now());
      openSheet(`<h2>Horário da basal</h2><p class="hint" style="margin:0 0 12px">Use se você tomou antes de abrir o app ou para corrigir a data e a hora. A contagem de 24 h parte deste horário.</p><form id="ins-at-form" novalidate><div class="form-grid">
        ${cur ? `<div class="field full"><label class="fl" for="ia-m">O que fazer</label><select class="in" id="ia-m"><option value="fix">Corrigir a dose em contagem</option><option value="new">Registrar uma nova dose</option></select></div>` : ''}
        <div class="field"><label class="fl" for="ia-d">Data</label><input class="in" type="date" id="ia-d" value="${d}" max="${isoDate(new Date())}"></div>
        <div class="field"><label class="fl" for="ia-t">Tomada às</label><input class="in" type="time" id="ia-t" value="${t}"></div>
        ${unitsField('ia-u', (unitsEntry('basal') || {}).units != null ? unitsEntry('basal').units : memNum('basal'))}</div><p class="err" id="ia-err" role="alert"></p><div class="row" style="margin-top:10px"><button class="btn pri grow" type="submit">Salvar</button><button class="btn" type="button" data-act="close">Cancelar</button></div></form>`);
    }
    else if (act === 'ins-time') { insRoll(); const k = el.dataset.k, cur = S.ins[k]; if (isLocked(k)) { toast('Bloqueada: só libera com glicemia pré-jantar de ' + S.ins.dinnerMin + ' ou mais.'); return; } openSheet(`<h2>Horário · ${esc(el.dataset.t)}</h2><p class="hint" style="margin:0 0 12px">Informe a hora em que você tomou a insulina rápida hoje.</p><form id="ins-time-form" data-k="${k}" novalidate><div class="form-grid"><div class="field"><label class="fl" for="it-t">Tomada às</label><input class="in" type="time" id="it-t" value="${cur ? HM(cur) : nowHM()}"></div>${unitsField('it-u', (unitsEntry(k) || {}).units != null ? unitsEntry(k).units : memNum(k))}</div><p class="err" id="it-err" role="alert"></p><div class="row"><button class="btn pri grow" type="submit">Salvar</button><button class="btn" type="button" data-act="close">Cancelar</button></div>${cur ? `<button class="btn danger full" type="button" style="margin-top:10px" data-act="ins-time-off" data-k="${k}">Desmarcar (não tomei)</button>` : ''}</form>`); }
    else if (act === 'ins-time-off') { await logDayClear(el.dataset.k); S.ins[el.dataset.k] = null; await insSave(); closeSheet(); render(); }
    else if (act === 'ins-basal-stop') { S.ins.basalTs = null; await insSave(); render(); toast('Lembrete da basal desligado.'); }
    else if (act === 'ins-skip') { insRoll(); const k = el.dataset.k; setSkip(k, !skipped(k)); await insSave(); render(); }
    else if (act === 'ins-skip-all') { insRoll(); const pend = ['fast', 'lunch', 'dinner'].filter(k => !S.ins[k]), all = skipped('basal') && pend.every(skipped); ['basal', ...pend].forEach(k => setSkip(k, !all)); await insSave(); render(); toast(all ? 'Pulos de hoje desfeitos.' : 'Insulinas de hoje puladas.'); }
    else if (act === 'ins-log-new') openSheet(insLogForm(null));
    else if (act === 'ins-log-edit') { const r = S.inslog.find(x => x.id === el.dataset.id); if (r) openSheet(insLogForm(r)); }
    else if (act === 'ins-log-del-ask') { el.dataset.act = 'ins-log-del-do'; el.textContent = 'Toque de novo para excluir'; el.classList.add('pri'); setTimeout(() => { if (el.isConnected && el.dataset.act === 'ins-log-del-do') { el.dataset.act = 'ins-log-del-ask'; el.textContent = 'Excluir registro'; el.classList.remove('pri'); } }, 4000); }
    else if (act === 'ins-log-del-do') {
      const r = S.inslog.find(x => x.id === el.dataset.id); if (r) { await logDel(r.id); if (r.kind === 'basal' && r.ts === S.ins.basalTs) S.ins.basalTs = null; insSync(); await insSave(); }
      closeSheet(); render(); toast('Registro excluído.');
    }
    else if (act === 'ins-min') openSheet(`<h2>Limite do jantar</h2><p class="hint" style="margin:0 0 12px">Valor definido por você e seu médico. O app só compara a medição pré-jantar de hoje com ele.</p><form id="ins-min-form" novalidate><div class="field"><label class="fl" for="im-v">mg/dL (ou mais)</label><input class="in" inputmode="numeric" id="im-v" value="${S.ins.dinnerMin}"></div><p class="err" id="im-err" role="alert"></p><div class="row"><button class="btn pri grow" type="submit">Salvar</button><button class="btn" type="button" data-act="close">Cancelar</button></div></form>`);
  } catch (err) { console.error(err); toast('Algo deu errado: ' + (err && err.message || err)); }
});
document.addEventListener('submit', async e => {
  if (e.target.id === 'ins-at-form') {
    e.preventDefault(); const t = parseTime($('#ia-t').value), d = $('#ia-d').value; if (!parseDate(d)) { $('#ia-err').textContent = 'Informe uma data válida.'; return; } if (!t) { $('#ia-err').textContent = 'Informe um horário válido.'; return; }
    const un = parseUnits($('#ia-u').value); if (un === 'bad') { $('#ia-err').textContent = 'Unidades: informe um número entre 0,5 e 300 (ou deixe em branco).'; return; }
    const ts = mkTs(d, t); if (ts > Date.now() + 60000) { $('#ia-err').textContent = 'Esse horário ainda não chegou.'; return; }
    const mode = $('#ia-m') ? $('#ia-m').value : 'new', en = unitsEntry('basal');
    if (mode === 'fix' && en) { const nb = { ...en, ts, date: isoDate(new Date(ts)) }; if (un != null) nb.units = un; else delete nb.units; await logPut(nb); S.ins.basalTs = ts; }
    else { await logAdd('basal', ts, un); if (!S.ins.basalTs || ts >= S.ins.basalTs) S.ins.basalTs = ts; }
    memSet('basal', typeof un === 'number' ? un : null);
    setSkip('basal', false); await insSave(); closeSheet(); render(); toast('Basal registrada: ' + fmtDate(isoDate(new Date(ts))).slice(0, 5) + ' às ' + HM(ts) + '.');
  } else if (e.target.id === 'ins-time-form') {
    e.preventDefault(); const t = parseTime($('#it-t').value); if (!t) { $('#it-err').textContent = 'Informe um horário válido.'; return; }
    const un = parseUnits($('#it-u').value); if (un === 'bad') { $('#it-err').textContent = 'Unidades: informe um número entre 0,5 e 300 (ou deixe em branco).'; return; }
    const ts = mkTs(isoDate(new Date()), t); if (ts > Date.now() + 60000) { $('#it-err').textContent = 'Esse horário ainda não chegou hoje.'; return; }
    insRoll(); const kk = e.target.dataset.k; if (isLocked(kk)) { closeSheet(); return; } let u2 = un; if (u2 == null) { const ex = unitsEntry(kk); if (ex && ex.units != null) u2 = ex.units; } if (!(u2 > 0)) { $('#it-err').textContent = 'Informe as unidades (Ui) tomadas.'; return; } await logDayClear(kk); await logAdd(kk, ts, u2); S.ins[kk] = ts; memSet(kk, u2); setSkip(kk, false); await insSave(); closeSheet(); render(); toast('Horário salvo: ' + t + '.');
  } else if (e.target.id === 'ins-log-form') {
    e.preventDefault(); const id = e.target.dataset.id, old = id ? S.inslog.find(x => x.id === id) : null;
    const kind = old ? old.kind : $('#il-k').value, d = $('#il-d').value, t = parseTime($('#il-t').value);
    if (!parseDate(d)) { $('#il-err').textContent = 'Informe uma data válida.'; return; }
    if (!t) { $('#il-err').textContent = 'Informe um horário válido (ex.: 21:30).'; return; }
    const ts = mkTs(d, t); if (ts > Date.now() + 60000) { $('#il-err').textContent = 'Esse horário ainda não chegou.'; return; }
    const un = parseUnits($('#il-u').value); if (un === 'bad') { $('#il-err').textContent = 'Unidades: informe um número entre 0,5 e 300 (ou deixe em branco).'; return; }
    if (old) { const nb = { ...old, ts, date: isoDate(new Date(ts)) }; if (kind === 'extra' && $('#il-n')) nb.name = $('#il-n').value.trim().slice(0, 80) || old.name; if (un != null) nb.units = un; else delete nb.units; await logPut(nb); if (kind === 'basal' && old.ts === S.ins.basalTs) S.ins.basalTs = ts; }
    else { await logAdd(kind, ts, un); if (kind === 'basal') { const lb = S.inslog.filter(x => x.kind === 'basal').pop(); if (!S.ins.basalTs || lb.ts > S.ins.basalTs) S.ins.basalTs = lb.ts; } }
    insSync(); await insSave(); closeSheet(); render(); toast('Registro salvo.');
  } else if (e.target.id === 'ins-min-form') {
    e.preventDefault(); const v = parseNum($('#im-v').value); if (v === null || v < 70 || v > 400) { $('#im-err').textContent = 'Informe um valor entre 70 e 400.'; return; }
    S.ins.dinnerMin = Math.round(v); await insSave(); closeSheet(); render(); toast('Limite salvo: ' + S.ins.dinnerMin + ' mg/dL.');
  }
});


/* ---------- Histórico de insulinas: tela ---------- */
function insLogForm(r) {
  const now = new Date(), d = r ? r.date : isoDate(now), t = r ? HM(r.ts) : HM(now.getTime());
  return `<h2>${r ? 'Editar · ' + esc(insName(r)) : 'Registrar dose passada'}</h2><p class="hint" style="margin:0 0 12px">Horário e unidades são registros seus. O app não calcula nem sugere dose.</p><form id="ins-log-form" data-id="${r ? r.id : ''}" novalidate><div class="form-grid">
    ${r && r.kind === 'extra' ? `<div class="field full"><label class="fl" for="il-n">Insulina</label><input class="in" id="il-n" maxlength="80" value="${esc(r.name || '')}"></div>` : ''}${r ? '' : `<div class="field full"><label class="fl" for="il-k">Tipo</label><select class="in" id="il-k"><option value="basal">Basal</option><option value="fast">Rápida · Jejum</option><option value="lunch">Rápida · Pré-prandial do almoço</option><option value="dinner">Rápida · Pré-prandial do jantar</option></select></div>`}
    <div class="field"><label class="fl" for="il-d">Data</label><input class="in" type="date" id="il-d" value="${d}" max="${isoDate(now)}"></div>
    <div class="field"><label class="fl" for="il-t">Horário</label><input class="in" id="il-t" value="${t}" inputmode="numeric" placeholder="21:30" autocomplete="off"></div>${unitsField('il-u', r ? r.units : null)}</div>
    <div class="err" id="il-err" role="alert" style="color:var(--red-l);min-height:18px;margin-top:6px"></div>
    <div class="stack" style="margin-top:10px"><button class="btn pri full" type="submit">Salvar</button>${r ? `<button class="btn full" type="button" data-act="ins-log-del-ask" data-id="${r.id}">Excluir registro</button>` : ''}</div></form>`;
}
function insDotChart(list) {
  const id = 'c' + (++chartSeq), W = 360, H = 230, L = 34, R = 12, T = 14, B = 24, pw = W - L - R, ph = H - T - B, N = 30;
  const t0 = mkTs(isoDate(new Date(addDays(Date.now(), -(N - 1)))), '00:00');
  const X = ts => L + (Math.floor((mkTs(isoDate(new Date(ts)), '00:00') - t0) / DAY + .5) + .5) / N * pw, Y = m => T + (m - y0) / (y1 - y0) * ph;
  const ms = list.map(r => minOfDay(r.ts)); let y0 = 0, y1 = 1440;
  if (ms.length) { const lo = Math.floor((Math.min(...ms) - 60) / 60) * 60, hi = Math.ceil((Math.max(...ms) + 60) / 60) * 60; if (hi - lo <= 14 * 60) { y0 = Math.max(0, lo); y1 = Math.min(1440, Math.max(hi, y0 + 6 * 60)); y0 = Math.max(0, Math.min(y0, y1 - 6 * 60)); } }
  const hstep = (y1 - y0) <= 360 ? 1 : (y1 - y0) <= 720 ? 2 : 6;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Horários das doses nos últimos 30 dias">`;
  for (let h = Math.ceil(y0 / 60 / hstep) * hstep; h * 60 <= y1; h += hstep) { const y = Y(h * 60); s += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="var(--mut)" stroke-width=".5" opacity=".35"/><text class="ax" x="${L - 6}" y="${y + 3}" text-anchor="end">${pad(h)}h</text>`; }
  for (let i = 0; i < N; i += 7) { const ts = t0 + i * DAY + 12 * 3600e3; s += `<text class="ax" x="${X(ts)}" y="${H - 7}" text-anchor="middle">${fmtDate(isoDate(new Date(ts))).slice(0, 5)}</text>`; }
  const bs = insStats(list.filter(x => x.kind === 'basal'));
  if (bs.n > 1) s += `<line x1="${L}" x2="${W - R}" y1="${Y(bs.mean)}" y2="${Y(bs.mean)}" stroke="var(--red)" stroke-width="1" stroke-dasharray="2 4" opacity=".8"/>`;
  const pts = [], shape = { basal: (x, y) => `<circle cx="${x}" cy="${y}" r="4.5" fill="var(--red)" stroke="var(--s1)" stroke-width="1.5"/>`, fast: (x, y) => `<path d="M${x} ${y - 5}L${x + 5} ${y}L${x} ${y + 5}L${x - 5} ${y}Z" fill="var(--fg)" stroke="var(--s1)" stroke-width="1.2"/>`, lunch: (x, y) => `<path d="M${x} ${y - 5}L${x + 5} ${y + 4}L${x - 5} ${y + 4}Z" fill="var(--c-lunch)" stroke="var(--s1)" stroke-width="1.2"/>`, dinner: (x, y) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="var(--mut)" stroke="var(--s1)" stroke-width="1.2"/>` };
  list.forEach(r => { const x = X(r.ts), y = Y(minOfDay(r.ts)); s += shape[r.kind](x, y); pts.push({ x, y, tip: `<b>${INS_KIND[r.kind]} · ${HM(r.ts)}${r.units != null ? ' · ' + fU(r.units) : ''}</b><br><span class="dim">${fmtDate(r.date)}</span>` }); });
  s += `<line class="xh" x1="0" x2="0" y1="${T}" y2="${T + ph}" stroke="var(--fg)" stroke-width=".8" opacity="0"/><circle class="hl" r="8" fill="none" stroke="var(--fg)" stroke-width="1.4" opacity="0"/></svg>`;
  CHARTS[id] = { pts, W, H, T, ph };
  return `<div class="chart" data-chart="${id}">${s}<div class="tip" hidden></div></div>`;
}
function unitsStat(list) { const u = list.map(r => r.units).filter(v => v != null); if (!u.length) return null; const m = u.reduce((a, b) => a + b, 0) / u.length; return { n: u.length, mean: Math.round(m * 10) / 10, min: Math.min(...u), max: Math.max(...u) }; }
const unitsTxt = s => s ? `dose média ${fU(s.mean)}${s.n > 1 ? ' (' + fU(s.min) + ' a ' + fU(s.max) + ')' : ''} · ${s.n} com unidades` : '';
function viewInsulinas() {
  const from = mkTs(isoDate(new Date(addDays(Date.now(), -29))), '00:00'), all = S.inslog.filter(x => x.ts >= from), list = all.filter(x => x.kind !== 'extra');
  const bs = insStats(list.filter(x => x.kind === 'basal'));
  let basal;
  if (!bs.n) basal = `<p class="hint" style="margin:8px 0 0">Ainda sem doses de basal nos últimos 30 dias. Elas entram aqui quando você toca em “Tomei a basal agora” no Painel, ou em “Registrar dose passada”.</p>`;
  else {
    const dd = m => (m > 0 ? '+' : m < 0 ? '−' : '±') + Math.abs(m) + ' min';
    basal = `<div class="v num" style="font-family:var(--f-display);font-weight:500;font-size:34px;letter-spacing:-.03em;line-height:1.1;margin-top:8px">${hhmm(bs.mean)}</div><div class="dim" style="font-size:14px;margin-top:2px">horário médio · ${bs.n} dose${bs.n > 1 ? 's' : ''} em 30 dias</div>`;
    { const us = unitsStat(list.filter(x => x.kind === 'basal')); if (us) basal += `<div style="margin-top:8px;font-size:13.5px"><b class="num">${unitsTxt(us)}</b></div>`; }
    if (bs.n < 2) basal += `<p class="hint" style="margin:10px 0 0">Com 2 doses ou mais aparecem a variação e os intervalos.</p>`;
    else {
      basal += `<div class="grid2" style="margin-top:12px"><div class="mini"><div class="dim" style="font-size:13.5px">MAIS CEDO – MAIS TARDE</div><b class="num">${hhmm(bs.earliest)} – ${hhmm(bs.latest)}</b><div class="dim" style="font-size:13.5px">amplitude ${Math.floor(bs.spread / 60)} h ${pad(bs.spread % 60)} min</div></div>
      <div class="mini"><div class="dim" style="font-size:13.5px">VARIAÇÃO TÍPICA</div><b class="num">± ${bs.sd} min</b><div class="dim" style="font-size:13.5px">em torno da média</div></div>
      <div class="mini"><div class="dim" style="font-size:13.5px">INTERVALO MÉDIO</div><b class="num">${bs.ivMean.toFixed(1).replace('.', ',')} h</b><div class="dim" style="font-size:13.5px">entre doses seguidas</div></div>
      <div class="mini"><div class="dim" style="font-size:13.5px">PERTO DE 24 H (±1 H)</div><b class="num">${bs.near} de ${bs.iv.length}</b><div class="dim" style="font-size:13.5px">intervalos</div></div></div>`;
      const last = bs.iv.slice(-7).reverse();
      basal += `<div class="eyebrow" style="margin-top:14px">Últimos intervalos</div><div class="stack" style="gap:6px;margin-top:6px">${last.map(i => { const h = Math.floor(i.h), m = Math.round((i.h - h) * 60), dev = i.h - 24, off = Math.abs(dev) > 1; return `<div class="row" style="justify-content:space-between;font-size:14.5px;gap:8px"><span class="num dim">${fmtDate(isoDate(new Date(i.from))).slice(0, 5)} ${HM(i.from)} → ${fmtDate(isoDate(new Date(i.to))).slice(0, 5)} ${HM(i.to)}</span><b class="num"${off ? ' style="color:var(--red-l)"' : ''}>${h} h ${pad(m)}</b></div>`; }).join('')}</div>`;
    }
  }
  const rapid = ['fast', 'lunch', 'dinner'].map(k => { const st = insStats(list.filter(x => x.kind === k)); return `<div class="row" style="justify-content:space-between;gap:8px;padding:8px 0;border-top:1px solid var(--line,var(--line))"><span><b>${k === 'fast' ? 'Jejum' : k === 'lunch' ? 'Pré-prandial do almoço' : 'Pré-prandial do jantar'}</b><div class="dim" style="font-size:13.5px">${st.n ? st.n + ' registro' + (st.n > 1 ? 's' : '') + ' em 30 dias' : 'Sem registros em 30 dias'}${(() => { const us = unitsStat(list.filter(x => x.kind === k)); return us ? '<br>' + unitsTxt(us) : ''; })()}</div></span><span class="num" style="text-align:right">${st.n ? '<b>' + hhmm(st.mean) + '</b><div class="dim" style="font-size:13.5px">' + (st.n > 1 ? hhmm(st.earliest) + ' – ' + hhmm(st.latest) : 'média') + '</div>' : '—'}</span></div>`; }).join('');
  const byDay = {}; all.forEach(r => (byDay[r.date] = byDay[r.date] || []).push(r));
  const days = Object.keys(byDay).sort().reverse();
  const dl = days.length ? `<div class="stack" style="gap:8px">${days.map(d => `<div class="card" style="padding:12px"><div class="num" style="font-weight:700;margin-bottom:8px">${fmtDate(d)}</div><div class="row" style="flex-wrap:wrap;gap:6px">${byDay[d].sort((a, b) => a.ts - b.ts).map(r => `<button class="btn sm" data-act="ins-log-edit" data-id="${r.id}">${esc(insName(r))} · ${HM(r.ts)}${r.units != null ? ' · ' + fU(r.units) : ''}</button>`).join('')}</div></div>`).join('')}</div>` : `<div class="card"><p class="hint" style="margin:0">Nenhum registro nos últimos 30 dias.</p></div>`;
  return banners() + `<p class="hint" style="margin:0 0 12px">Mostra a que horas você costuma tomar cada insulina e quanto isso varia de um dia para o outro. Horários e unidades são só registros seus: o app não calcula nem sugere dose.</p>
  <button class="btn pri full" data-act="ins-log-new">Registrar dose passada</button>
  <h2 class="sec">Basal · últimos 30 dias</h2><div class="card">${basal}</div>
  <h2 class="sec">Horários no gráfico</h2><div class="card">${insDotChart(list)}<div class="row" style="flex-wrap:wrap;gap:12px;font-size:13.5px;margin-top:8px"><span><b style="color:var(--red-t)">●</b> Basal</span><span><b style="color:var(--fg)">◆</b> Jejum</span><span><b style="color:var(--c-lunch)">▲</b> Almoço</span><span><b style="color:var(--mut)">■</b> Jantar</span></div><p class="hint" style="margin:8px 0 0">Cada ponto é uma dose; a linha pontilhada vermelha é o horário médio da basal. Toque no gráfico para ver o horário exato.</p></div>
  <h2 class="sec">Insulina rápida</h2><div class="card" style="padding-top:4px">${rapid}</div>
  <h2 class="sec">Registros por dia</h2>${dl}`;
}


/* ---------- Tema claro / escuro ---------- */
const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
S.theme = 'dark';
const sysLight = () => { try { return window.matchMedia('(prefers-color-scheme: light)').matches; } catch (e) { return false; } };
const themeEff = () => S.theme === 'auto' ? (sysLight() ? 'light' : 'dark') : S.theme;
function applyTheme() {
  const t = themeEff(); document.documentElement.setAttribute('data-theme', t);
  const b = document.getElementById('thm');
  if (b) { b.innerHTML = t === 'light' ? MOON : SUN; b.setAttribute('aria-label', t === 'light' ? 'Mudar para o tema escuro' : 'Mudar para o tema claro'); b.title = b.getAttribute('aria-label'); }
}
async function setTheme(v) {
  S.theme = v; applyTheme();
  try { localStorage.setItem('tb-theme', v); } catch (e) { }
  try { await Store.put('meta', { id: 'theme', value: v }); } catch (e) { }
}
try { const v = localStorage.getItem('tb-theme'); if (v === 'light' || v === 'dark' || v === 'auto') S.theme = v; } catch (e) { }
applyTheme();
try { window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (S.theme === 'auto') applyTheme(); }); } catch (e) { }
function themeCard() {
  const o = [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']];
  return `<h2 class="sec">Tema do aplicativo</h2><div class="card" style="margin-bottom:12px"><div class="seg" role="group" aria-label="Tema" style="display:flex">${o.map(([k, t]) => `<button class="grow" data-act="theme" data-v="${k}" aria-pressed="${S.theme === k}">${t}</button>`).join('')}</div><p class="hint" style="margin:8px 0 0">“Automático” segue o modo claro ou escuro do seu aparelho. O botão no topo alterna na hora.</p></div>`;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act="theme"]'); if (!el) return;
  await setTheme(el.dataset.v); render();
});


/* ---------- Tópicos expansíveis / retráteis ---------- */
S.acc = {};
const ACC_ALL = /[?&]all\b/.test(location.search); // gancho de teste: abre todos os tópicos
const ACC_OPEN = { ia: ['como a ia', 'assistente'], painel: ['hoje', 'meu tratamento', 'evolucao'], esquemas: ['meu', 'lembretes', 'insulinas', 'remedios', 'bomba', 'medicoes'], historico: [''], bolus: [''], padroes: [''], conquistas: [''], ia: [''], alertasp: ['seus alertas'], backup: ['exportar', 'google drive', 'restaurar'], perfil: ['informa', 'diabetes'] }; // abertos por padrão; nas demais páginas, só o primeiro (ou todos, se forem até 2)
try { const a = JSON.parse(localStorage.getItem('tb-acc') || '{}'); if (a && typeof a === 'object') S.acc = a; } catch (e) { }
const accSave = () => { try { localStorage.setItem('tb-acc', JSON.stringify(S.acc)); } catch (e) { } try { Store.put('meta', { id: 'acc', value: S.acc }); } catch (e) { } };
const accKey = (route, h2, i) => route + '|' + (route === 'painel' && i === 0 ? 'hoje' : norm(h2.textContent).trim().split('·')[0].trim().slice(0, 40)); // 1º tópico do Painel muda de rótulo (Hoje/Ontem/data)
function makeAccordions(view) {
  const route = S.route, bl = view.querySelector(':scope > #bl');
  if (bl) view = bl.querySelector(':scope > .stack') || bl; // o Cálculo de bolus fica dentro de um contêiner próprio
  const kids = [...view.children];
  const isHead = e => e.matches && (e.matches('h2.sec') || (e.matches('div.row') && e.firstElementChild && e.firstElementChild.matches('h2.sec')));
  const heads = kids.filter(isHead); if (!heads.length) return;
  const many = heads.length >= 3, dflt = ACC_OPEN[route];
  heads.forEach((h, i) => {
    const h2 = h.matches('h2.sec') ? h : h.firstElementChild, key = accKey(route, h2, i);
    const body = []; for (let n = h.nextElementSibling; n && !isHead(n); n = n.nextElementSibling) body.push(n);
    if (!body.length) return;
    const k0 = key.split('|')[1];
    const open = ACC_ALL ? true : key in S.acc ? !!S.acc[key] : route === 'bolus' && k0.startsWith('tutorial') ? false : dflt ? dflt.some(d => k0.startsWith(d)) : many ? i === 0 : true;
    const wrap = document.createElement('div'); wrap.className = 'acc-b'; wrap.id = 'acc-' + i; wrap.hidden = !open;
    h.after(wrap); body.forEach(n => wrap.appendChild(n));
    h2.classList.add('acc-h'); h2.setAttribute('role', 'button'); h2.tabIndex = 0; h2.dataset.key = key; h2.setAttribute('aria-expanded', open); h2.setAttribute('aria-controls', wrap.id);
    h.classList.add('acc-top'); if (!open) h.classList.add('closed');
  });
  if (many) {
    const first = heads[0], allOpen = view.querySelectorAll('.acc-h[aria-expanded="false"]').length === 0;
    const c = document.createElement('div'); c.className = 'acc-ctl';
    c.innerHTML = `<button class="btn sm" data-act="acc-all" data-v="${allOpen ? 0 : 1}">${allOpen ? 'Recolher tudo' : 'Expandir tudo'}</button>`;
    first.before(c);
  }
}
function accToggle(h2, force) {
  const open = force != null ? force : h2.getAttribute('aria-expanded') !== 'true', body = document.getElementById(h2.getAttribute('aria-controls'));
  h2.setAttribute('aria-expanded', open); if (body) body.hidden = !open;
  const top = h2.closest('.acc-top'); if (top) top.classList.toggle('closed', !open);
  S.acc[h2.dataset.key] = open ? 1 : 0;
}
document.addEventListener('click', e => {
  const h2 = e.target.closest('h2.acc-h'); if (h2) { accToggle(h2); accSave(); const b = document.querySelector('[data-act="acc-all"]'); if (b) { const all = !document.querySelector('.acc-h[aria-expanded="false"]'); b.dataset.v = all ? 0 : 1; b.textContent = all ? 'Recolher tudo' : 'Expandir tudo'; } return; }
  const el = e.target.closest('[data-act="acc-all"]'); if (!el) return;
  const v = el.dataset.v === '1'; document.querySelectorAll('#view .acc-h').forEach(h => accToggle(h, v)); accSave();
  el.dataset.v = v ? 0 : 1; el.textContent = v ? 'Recolher tudo' : 'Expandir tudo';
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('h2.acc-h')) { e.preventDefault(); e.target.click(); } });


/* campo de unidades do card: só valida; não altera registros anteriores */
document.addEventListener('change', e => { const el = e.target.closest && e.target.closest('input.un-draft'); if (!el) return; const u = parseUnits(el.value); if (u === 'bad') { toast('Unidades: número entre 0,5 e 300.'); S.ud[el.dataset.k] = undefined; delete S.ud[el.dataset.k]; el.value = memU(el.dataset.k); } });
/* unidades: salva ao sair do campo */
document.addEventListener('change', async e => {
  const el = e.target.closest && e.target.closest('input.un-in:not(.un-draft)'); if (!el) return;
  const k = el.dataset.k, u = parseUnits(el.value), en = unitsEntry(k);
  if (u === 'bad') { toast('Unidades: número entre 0,5 e 300.'); const o = en && en.units != null ? String(en.units).replace('.', ',') : ''; el.value = o; return; }
  if (!en) return;
  const nb = { ...en }; if (u != null) nb.units = u; else delete nb.units;
  await logPut(nb); el.value = u != null ? String(u).replace('.', ',') : ''; toast(u != null ? 'Unidades salvas: ' + fU(u) + '.' : 'Unidades removidas.'); insLink();
});

document.addEventListener('change', e => { if (e.target.id !== 'ia-m') return; const n = e.target.value === 'new', now = Date.now(), c = S.ins.basalTs || now; $('#ia-d').value = isoDate(new Date(n ? now : c)); $('#ia-t').value = HM(n ? now : c); const en = unitsEntry('basal'); $('#ia-u').value = n ? fnU(memNum('basal')) : (!en || en.units == null ? '' : String(en.units).replace('.', ',')); });


/* ---------- Alerta e protocolo de hipoglicemia (< 70 mg/dL) ---------- */
const HYPO_STEP = 15 * 60e3; // intervalo entre reavaliações
S.hypoOff = {};
try { S.hypoOff = JSON.parse(localStorage.getItem('tb-hypo-off') || '{}') || {}; } catch (e) { }
function hypoState() { const st = hypoEpisode(S.records, Date.now()); return st && st.protocol ? st : null; } // episódio com reavaliação ativa (glicemia <= 60)
function hypoLow() { const st = hypoEpisode(S.records, Date.now()); return st && !st.protocol ? st : null; } // 61 a 69: só registro, sem reavaliação
function hypoNextTxt(st) {
  const rem = st.last.ts + HYPO_STEP - Date.now();
  return rem > 0 ? 'Próxima medição em <b class="num">' + (m => pad(Math.floor(m / 60)) + ':' + pad(m % 60))(Math.ceil(rem / 1000)) + '</b>' : '<b>⏱ Já passaram 15 min: meça de novo agora.</b>';
}
function hypoBanner() {
  if (!alCfg().bHypo) return '';
  const lo = hypoLow();
  if (lo && !S.hypoOff[lo.id]) return `<div class="banner hypo" role="alert"><div><b>Glicemia baixa:</b> <b class="num">${f0(lo.last.glucose)}</b> mg/dL às ${lo.last.time}, registrada como hipoglicemia.<div style="margin-top:2px;opacity:.95">Siga o plano combinado com seu médico.</div></div><div class="hy-btns"><button class="btn sm" data-act="hypo-open">Abrir protocolo</button><button class="btn sm" data-act="hypo-off">Dispensar</button></div></div>`;
  const st = hypoState(); if (!st || S.hypoOff[st.id]) return '';
  const g = st.last.glucose;
  return `<div class="banner hypo" role="alert"><div><b>⚠ Hipoglicemia:</b> <b class="num">${f0(g)}</b> mg/dL às ${st.last.time}${g < LIM.vlow ? ' · muito baixa' : ''}.<div style="margin-top:4px" data-hy-next>${hypoNextTxt(st)}</div><div style="margin-top:2px;opacity:.95">Meça a cada 15 min até voltar a 70 ou mais.</div></div><div class="hy-btns"><button class="btn sm" data-act="hypo-open">Abrir protocolo</button><button class="btn sm ghost" data-act="hypo-off">Dispensar</button></div></div>`;
}
function hypoRow(i, t) {
  return `<div class="hy-row"><span class="hy-n">${i}</span><input class="in" type="time" data-hy="t" value="${t}" aria-label="Horário da medição ${i}"><input class="in" data-hy="g" inputmode="decimal" autocomplete="off" placeholder="mg/dL" aria-label="Glicemia da medição ${i}"><button class="btn sm" type="button" data-act="hypo-rm" aria-label="Remover campo">×</button></div>`;
}
function hypoSheet() {
  const st = hypoState(), now = nowHM();
  let top;
  if (st) {
    const g = st.last.glucose, ago = Math.max(0, Math.round((Date.now() - st.last.ts) / 60000));
    top = `<div class="hy-big"><span class="num">${f0(g)}</span><small>mg/dL</small></div><div class="dim" style="font-size:14.5px">às ${st.last.time} · há ${ago} min ${g < LIM.vlow ? '<span class="badge vlow">▼ Muito baixa</span>' : ''}</div><div class="hy-next" data-hy-next>${hypoNextTxt(st)}</div>`;
  } else top = `<p class="hint" style="margin:0 0 8px">Nenhuma reavaliação ativa. O protocolo começa com glicemia de 60 mg/dL ou menos. Se medir agora e estiver baixa, registre abaixo.</p>`;
  const list = st ? `<h3 class="hy-h">Medições deste episódio</h3><div class="stack" style="gap:6px">${st.ep.map(r => `<div class="row" style="justify-content:space-between;gap:8px;font-size:14px"><span class="num dim">${r.time}</span><span class="num"><b>${f0(r.glucose)}</b> mg/dL</span>${badge(r.glucose, r.context)}</div>`).join('')}</div>` : '';
  return `<h2>${st ? '⚠ Hipoglicemia' : 'Protocolo de hipoglicemia'}</h2>${top}
  <p class="hint" style="margin:10px 0 8px">Meça de novo a cada 15 minutos até a glicemia voltar a 70 mg/dL ou mais. Siga o plano de hipoglicemia combinado com seu médico.</p>
  <div class="hy-warn"><b>Emergência:</b> com confusão, convulsão, desmaio ou dificuldade para engolir, peça ajuda agora (SAMU 192).</div>
  ${list}<h3 class="hy-h">Registrar reavaliações</h3>
  <form id="hypo-form" novalidate><div id="hy-rows">${hypoRow(1, now)}${hypoRow(2, now)}</div>
  <button class="btn full" type="button" data-act="hypo-add" style="margin-top:8px">+ Adicionar outro campo</button>
  <p class="err" id="hy-err" role="alert" style="min-height:18px;margin:8px 0 0"></p>
  <div class="row" style="margin-top:8px"><button class="btn pri grow" type="submit">Salvar medições</button><button class="btn" type="button" data-act="close">Fechar</button></div></form>`;
}
function hypoOpen() { openSheet(hypoSheet()); }
function hypoAfterSave(rec) { const st = hypoState(); if (rec && st && !rec.noTime && Date.now() - rec.ts < 4 * 3600e3 && st.ep.some(r => r.id === rec.id)) setTimeout(hypoOpen, 150); }
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act^="hypo-"]'); if (!el) return; const act = el.dataset.act;
  if (act === 'hypo-open') hypoOpen();
  else if (act === 'hypo-off') { const st = hypoState() || hypoLow(); if (st) { S.hypoOff[st.id] = 1; try { localStorage.setItem('tb-hypo-off', JSON.stringify(S.hypoOff)); } catch (x) { } } render(); }
  else if (act === 'hypo-add') { const rows = document.getElementById('hy-rows'); rows.insertAdjacentHTML('beforeend', hypoRow(rows.children.length + 1, nowHM())); const l = rows.lastElementChild.querySelector('[data-hy=g]'); if (l) l.focus(); }
  else if (act === 'hypo-rm') { const rows = document.getElementById('hy-rows'); if (rows.children.length > 2) { el.closest('.hy-row').remove(); [...rows.children].forEach((r, i) => { r.querySelector('.hy-n').textContent = i + 1; }); } else toast('Mantenha ao menos 2 campos.'); }
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'hypo-form') return; e.preventDefault();
  const err = m => { $('#hy-err').textContent = m; }, out = [], today = isoDate(new Date());
  for (const row of document.querySelectorAll('#hy-rows .hy-row')) {
    const gv = row.querySelector('[data-hy=g]').value.trim(); if (!gv) continue;
    const g = parseNum(gv), t = parseTime(row.querySelector('[data-hy=t]').value);
    if (g === null || g < GLU_MIN || g > GLU_MAX) return err(`Glicemia entre ${GLU_MIN} e ${GLU_MAX} mg/dL.`);
    if (!t) return err('Informe o horário de cada medição.');
    const ts = mkTs(today, t); if (ts > Date.now() + 60000) return err('Esse horário ainda não chegou.');
    out.push(hypoStamp({ id: uid(), date: today, time: t, glucose: g, source: 'manual', marks: ['hipo'], ts }));
  }
  if (!out.length) return err('Preencha ao menos uma glicemia.');
  try {
    if (hasExamples()) await removeExamples();
    await Store.putMany('records', out); await loadAll(); closeSheet(); render();
    if (!hypoState()) toast(hypoLow() ? 'Medições salvas. A glicemia ainda está abaixo de 70.' : 'Glicemia de volta a 70 mg/dL ou mais. Protocolo encerrado.');
    else { toast('Medições salvas. Meça de novo em 15 min.'); setTimeout(hypoOpen, 200); }
  } catch (x) { console.error(x); toast('Não foi possível salvar: ' + (x && x.message || x)); }
});
setInterval(() => { const st = hypoState(); if (!st) return; document.querySelectorAll('[data-hy-next]').forEach(n => { n.innerHTML = hypoNextTxt(st); }); }, 1000);


/* ---------- Alerta de glicemia muito elevada (> 250 mg/dL) — só aviso, sem protocolo ---------- */
S.hyperOff = {};
try { S.hyperOff = JSON.parse(localStorage.getItem('tb-hyper-off') || '{}') || {}; } catch (e) { }
function hyperState() {
  const real = S.records.filter(r => !r.noTime && r.source !== 'exemplo' && r.ts).sort((a, b) => a.ts - b.ts), last = real[real.length - 1];
  return last && last.glucose > LIM.vhigh && Date.now() - last.ts <= 4 * 3600e3 ? last : null;
}
function hyperBanner() {
  if (!alCfg().bHyper) return '';
  const r = hyperState(); if (!r || S.hyperOff[r.id]) return '';
  return `<div class="banner hyper" role="alert"><div><b>▲ Glicemia muito elevada:</b> <b class="num">${f0(r.glucose)}</b> mg/dL às ${r.time}.<div style="margin-top:4px">Acima de ${LIM.vhigh} mg/dL. Siga o plano combinado com seu médico. Com mal-estar, vômitos, sede intensa ou respiração acelerada, procure atendimento.</div></div><button class="btn sm" data-act="hyper-off">Dispensar</button></div>`;
}
document.addEventListener('click', e => {
  if (!e.target.closest('[data-act="hyper-off"]')) return;
  const r = hyperState(); if (r) { S.hyperOff[r.id] = 1; try { localStorage.setItem('tb-hyper-off', JSON.stringify(S.hyperOff)); } catch (x) { } } render();
});

/* ---------- Conquistas (sistema de recompensa) ---------- */
const RW_INFO = {
  hypo: { t: 'Sem hipoglicemia', u: 'dias sem hipoglicemia', d: 'nenhuma glicemia abaixo de 70 mg/dL',
    ic: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>' },
  fast: { t: 'Jejum até 130', u: 'dias com jejum até 130', d: 'glicemias de jejum de até 130 mg/dL',
    ic: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>' },
  norm: { t: 'Glicemia até 180', u: 'dias com glicemia até 180', d: 'todas as glicemias de até 180 mg/dL',
    ic: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>' },
};
const RW_MS = {
  7: { g: 'Bom trabalho!', m: 'Uma semana inteira. O primeiro passo está dado.', n: 'uma semana', fx: 'float', c: 14 },
  14: { g: 'Parabéns!', m: 'Duas semanas seguidas. A constância está aparecendo.', n: 'duas semanas', fx: 'confetti', c: 30 },
  30: { g: 'Mandou muito bem!', m: 'Um mês completo. Isso é disciplina de verdade.', n: 'um mês', fx: 'shine', c: 46 },
  90: { g: 'Conquista incrível!', m: 'Três meses seguidos. Você merece comemorar.', n: 'três meses', fx: 'epic', c: 70 },
};
const RW_ST = { andamento: 'Em andamento', concluida: 'Concluída', quebrada: 'Quebrada', reiniciada: 'Reiniciada', aguardando: 'Aguardando validação' };
const RW_LBL = { 7: '7 dias', 14: '14 dias', 30: '30 dias', 90: '3 meses' };
const RW_GREENS = ['#22c55e', '#4ade80', '#86efac', '#16a34a', '#bbf7d0', '#34d399'];
const rwSvg = (p, s = 28) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const RW_TROPHY = '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4v3h-4z"/>';
function rwState() { S.rw = S.rw || {}; S.rw.got = S.rw.got || {}; return S.rw; }
const rwSave = async () => { try { await Store.put('meta', { id: 'rewards', value: S.rw }); } catch (e) { } };
const rwEval = () => rewardEval(S.records, isoDate(new Date()), rwSkips());
let rwTimer = null, rwBusy = false, rwDay = isoDate(new Date());
function rwTick() { const d = isoDate(new Date()); if (d !== rwDay) { rwDay = d; if (S.route === 'conquistas' && !$('#sheet-bg')) render(); } rewardSoon(); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) rwTick(); });
setInterval(rwTick, 5 * 60000);
function rewardSoon() { clearTimeout(rwTimer); rwTimer = setTimeout(rewardCheck, 500); }
async function rewardCheck() {
  if (typeof insLoaded === 'undefined' || !insLoaded || !S.records.length) return;
  const st = rwState(), ev = rwEval(), q = []; let dirty = false;
  // quebra: selo que não vale mais no ciclo atual sai de "got" (fica bloqueado) e vai para o histórico
  st.hist = st.hist || [];
  for (const k of Object.keys(RW_INFO)) for (const N of RW_STEPS) { const key = k + '-' + N; if (rwOn(k) && st.got[key] && !ev[k].ach[N]) { st.hist.push({ k, N, date: st.got[key], brokeAt: isoDate(new Date()) }); delete st.got[key]; dirty = true; } }
  if (cwCheck(st, q, isoDate(new Date()), false)) dirty = true; /* personalizadas perdidas (só remove selo) */
  if (dirty) await rwSave();
  if (rwBusy) return;
  if (!alCfg().rewards) return;
  if ($('#sheet-bg') || $('.rw-bg')) return;
  dirty = false;
  if (cwCheck(st, q, isoDate(new Date()), true)) dirty = true;
  for (const k of Object.keys(RW_INFO)) {
    if (!rwOn(k)) continue;
    const fresh = RW_STEPS.filter(N => ev[k].ach[N] && !st.got[k + '-' + N]);
    fresh.forEach(N => { st.got[k + '-' + N] = isoDate(new Date()); dirty = true; });
    if (fresh.length) q.push({ k, N: Math.max(...fresh) });
  }
  st.init = true;
  if (q.length) { st.last = { ...q[q.length - 1], ts: Date.now() }; dirty = true; }
  if (dirty) await rwSave();
  if (q.length) { rwBusy = true; rwShowQueue(q); }
}
function rwShowQueue(q) {
  const x = q.shift(); if (!x) { rwBusy = false; return; }
  rwCelebrate(x.k, x.N, () => rwShowQueue(q));
}
function rwFx(box, kind, count) {
  const rnd = (a, b) => a + Math.random() * (b - a), mk = (cls, st) => { const i = document.createElement('i'); i.className = cls; i.style.cssText = st; box.appendChild(i); };
  const col = () => RW_GREENS[Math.floor(Math.random() * RW_GREENS.length)];
  if (kind === 'float') for (let i = 0; i < count; i++) mk('rw-p rw-float', `left:${rnd(15, 85)}%;--c:${col()};--dl:${rnd(0, 1.2).toFixed(2)}s;--dx:${rnd(-30, 30).toFixed(0)}px;--s:${rnd(6, 11).toFixed(0)}px`);
  else if (kind === 'confetti') for (let i = 0; i < count; i++) { const a = rnd(0, Math.PI * 2), d = rnd(90, 230); mk('rw-p rw-burst', `--c:${col()};--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d - 40).toFixed(0)}px;--r:${rnd(-540, 540).toFixed(0)}deg;--dl:${rnd(0, .25).toFixed(2)}s;--s:${rnd(7, 12).toFixed(0)}px`); }
  else if (kind === 'shine') { for (let i = 0; i < count; i++) mk('rw-p rw-rain', `left:${rnd(0, 100)}%;--c:${col()};--dl:${rnd(0, 1.6).toFixed(2)}s;--du:${rnd(2.2, 3.6).toFixed(2)}s;--dx:${rnd(-40, 40).toFixed(0)}px;--s:${rnd(7, 12).toFixed(0)}px`); }
  else { // epic: 3 fogos + chuva
    [[28, 32], [72, 28], [50, 55]].forEach(([x, y], n) => { for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, d = rnd(70, 120); mk('rw-p rw-fire', `left:${x}%;top:${y}%;--c:${col()};--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px;--dl:${(0.2 + n * 0.55).toFixed(2)}s;--s:${rnd(5, 8).toFixed(0)}px`); } });
    for (let i = 0; i < count; i++) mk('rw-p rw-rain', `left:${rnd(0, 100)}%;--c:${col()};--dl:${rnd(0, 2.4).toFixed(2)}s;--du:${rnd(2.4, 4).toFixed(2)}s;--dx:${rnd(-50, 50).toFixed(0)}px;--s:${rnd(7, 13).toFixed(0)}px`);
  }
}
function rwCelebrate(k, N, done) {
  closeRw(true);
  const cu = cwMeta(k); if (!cu && !RW_INFO[k]) { if (done) done(); return; }
  const c = cu ? { t: esc(cu.name), ic: cu.icp } : RW_INFO[k], m = cu ? { ...CW_MS, m: cu.c.desc ? esc(cu.c.desc) : 'Você chegou lá. Continue assim!' } : RW_MS[N], big = !cu && N >= 90;
  const bg = document.createElement('div'); bg.className = 'rw-bg rw-m' + N; bg.id = 'rw-bg'; bg.setAttribute('role', 'alertdialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-label', m.g);
  bg.innerHTML = `<div class="rw-fx" aria-hidden="true"></div><div class="rw-card">
    <div class="rw-medal"><span class="rw-ring"></span><span class="rw-ring r2"></span><span class="rw-core">${rwSvg(c.ic, 44)}</span>${big ? `<span class="rw-crown">${rwSvg(RW_TROPHY, 26)}</span>` : ''}</div>
    <div class="rw-lbl">${cu ? 'Minha conquista · ' + c.t : RW_LBL[N] + ' · ' + c.t}</div>
    <h2 class="rw-g">${m.g}</h2>
    <p class="rw-m">${m.m}</p>
    <p class="rw-d">${cu ? esc(cwRule(cu.c)) + ' Pelos seus registros.' : `Foram ${N} dias seguidos com ${c.d}, pelos seus registros.`}</p>
    <button class="btn pri full" id="rw-ok" autofocus>Continuar</button>
    <button class="btn full" id="rw-see" style="margin-top:8px">Ver minhas conquistas</button></div>`;
  document.body.appendChild(bg); document.body.style.overflow = 'hidden';
  rwFx(bg.querySelector('.rw-fx'), m.fx, m.c);
  bg._done = done;
  const fin = go2 => { closeRw(); if (go2) go('conquistas'); };
  bg.querySelector('#rw-ok').onclick = () => fin(false);
  bg.querySelector('#rw-see').onclick = () => fin(true);
  setTimeout(() => { const b = bg.querySelector('#rw-ok'); if (b) b.focus(); }, 60);
}
function closeRw(silent) {
  const b = $('#rw-bg'); if (!b) return; const d = b._done; b.remove();
  if (!$('#sheet-bg')) document.body.style.overflow = '';
  if (d && !silent) d();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#rw-bg')) closeRw(); });
function rwBanner() {
  const l = S.rw && S.rw.last; if (!l || Date.now() - l.ts > DAY || (S.rw.seen === l.ts)) return '';
  const cu = cwMeta(l.k), c = cu ? { t: esc(cu.name), ic: cu.icp } : RW_INFO[l.k]; if (!c || !rwOn(l.k)) return '';
  return `<div class="banner rwb" role="status"><div class="row" style="gap:10px;align-items:center;min-width:0"><span class="rw-bi sm">${rwSvg(c.ic, 20)}</span><div><b>Nova conquista: ${cu ? c.t : RW_LBL[l.N] + ' · ' + c.t}</b><div class="dim" style="font-size:14px">${cu ? CW_MS.g : RW_MS[l.N].g}</div></div></div><div class="row" style="gap:6px"><button class="btn sm" data-act="rw-open">Ver</button><button class="btn sm" data-act="rw-dismiss" aria-label="Dispensar">×</button></div></div>`;
}
/* ---------- Unidades das chaves -> medição correspondente do histórico ---------- */
const INS_MATCH = { fast: r => r.context === 'jejum', lunch: r => r.context === 'antes' && r.meal === 'almoco', dinner: r => r.context === 'antes' && r.meal === 'jantar' };
let linkBusy = false;
async function insLink() {
  if (linkBusy || typeof insLoaded === 'undefined' || !insLoaded) return;
  linkBusy = true;
  try {
    const from = isoDate(new Date(addDays(Date.now(), -7))), ent = S.inslog.filter(x => INS_MATCH[x.kind] && x.date >= from);
    const real = S.records.filter(r => r.source !== 'exemplo' && !r.noTime), ch = new Map();
    const upd = (r, f) => { const n = ch.get(r.id) || { ...r }; f(n); ch.set(r.id, n); };
    // desfaz vínculos órfãos ou desatualizados
    for (const r of S.records) if (r.insFrom) { const e = S.inslog.find(x => x.id === r.insFrom); if (!e || e.date !== r.date || e.units == null || !INS_MATCH[e.kind](r)) upd(r, n => { if (!e || e.units == null || e.date !== r.date) delete n.insMeal; delete n.insFrom; }); }
    const cur = r => ch.get(r.id) || r;
    for (const e of ent) {
      if (e.units == null) continue;
      let t = real.map(cur).find(r => r.insFrom === e.id);
      if (!t) t = real.map(cur).filter(r => r.date === e.date && INS_MATCH[e.kind](r) && r.insMeal == null && !r.insFrom).sort((a, b) => Math.abs(a.ts - e.ts) - Math.abs(b.ts - e.ts))[0];
      if (t && (t.insMeal !== e.units || t.insFrom !== e.id)) upd(S.records.find(r => r.id === t.id), n => { n.insMeal = e.units; n.insFrom = e.id; });
    }
    if (ch.size) { const arr = [...ch.values()]; await Store.putMany('records', arr); S.records = S.records.map(r => ch.get(r.id) || r); render(); }
  } catch (e) { console.error(e); } finally { linkBusy = false; }
}

/* ---------- estado do app dentro do backup (insulinas, conquistas, refeições salvas) ---------- */
async function applyBackupState(st, replace) {
  if (!st) return;
  try { if (st.profile && typeof st.profile === 'object' && (replace || !S.profile)) { S.profile = pfClean(st.profile); await pfSave(); } } catch (e) { }
  try { if (st.plan && typeof st.plan === 'object' && (replace || !plHas())) { plLoad(st.plan); await plSave(); } } catch (e) { }
  try { if (st.alertCenter && typeof st.alertCenter === 'object' && (replace || !S.ac.items.length)) { const have = new Set(S.ac.items.map(x => x.id)); const inc = (Array.isArray(st.alertCenter.items) ? st.alertCenter.items : []).filter(x => x && x.id && x.key && !have.has(x.id)); S.ac.items = replace ? inc : S.ac.items.concat(inc); S.ac.items = S.ac.items.slice(0, AC_MAX); acSave(); } } catch (e) { }
  try { if (st.customAlerts && typeof st.customAlerts === 'object' && (replace || !S.ca.rules.length)) { caLoad(st.customAlerts); S.ca.seeded = true; await caSave(); caSync(); } } catch (e) { }
  try { if (st.alerts && (replace || JSON.stringify(alCfg()) === JSON.stringify(AL_DEF))) { S.alerts = { ...AL_DEF, ...st.alerts }; await alSave(); } } catch (e) { }
  try { if (typeof st.swipeNav === 'boolean' && replace) { S.swipeNav = st.swipeNav; await Store.put('meta', { id: 'swipe-nav', value: S.swipeNav }); } } catch (e) { }
  try { if (st.bolus && typeof st.bolus === 'object') { S._blRes = null; if (replace) blLoad(st.bolus); else S._blRes = blMerge(st.bolus); await Store.put('meta', { id: 'bolus', value: S.bl }); } } catch (e) { console.error(e); }
  try {
    const i = st.insulin;
    if (i && typeof i === 'object') {
      const lu = {}; if (i.lastU && typeof i.lastU === 'object') ['basal', 'fast', 'lunch', 'dinner'].forEach(k => { const u = +i.lastU[k]; if (isFinite(u) && u > 0 && u <= 300) lu[k] = u; });
      const clean = { lastU: lu, basalTs: typeof i.basalTs === 'number' ? i.basalTs : null, day: typeof i.day === 'string' ? i.day : '', fast: i.fast || null, lunch: i.lunch || null, dinner: i.dinner || null, dinnerMin: i.dinnerMin >= 100 && i.dinnerMin <= 400 ? i.dinnerMin : 140, skip: i.skip && typeof i.skip === 'object' ? i.skip : {} };
      { const cur = S.ins.lastU || {}; const mg = replace ? { ...clean.lastU } : { ...clean.lastU, ...cur }; S.ins.lastU = mg; insLoaded = true; await insSave(); }
      if (replace || (clean.basalTs && clean.basalTs > (S.ins.basalTs || 0))) { S.ins = replace ? clean : { ...S.ins, basalTs: clean.basalTs }; if (replace || clean.day === isoDate(new Date())) { if (clean.day === isoDate(new Date())) { S.ins.day = clean.day; S.ins.fast = clean.fast; S.ins.lunch = clean.lunch; S.ins.dinner = clean.dinner; S.ins.skip = clean.skip; } } insLoaded = true; insSync(); await insSave(); }
    }
    const r = st.rewards;
    if (r && r.got && typeof r.got === 'object') { const cur = rwState(); try { cwRestore(r, replace); } catch (e) { console.error(e); } for (const [k, d] of Object.entries(r.got)) if (/^(hypo|fast|norm)-(7|14|30|90)$/.test(k) && typeof d === 'string' && (!cur.got[k] || d < cur.got[k])) cur.got[k] = d; cur.init = true; await rwSave(); }
    if (Array.isArray(st.saved)) { const have = new Set((S.saved || []).map(m => m.id)); S.saved = (S.saved || []).concat(st.saved.filter(m => m && m.id && m.name && !have.has(m.id))); await savedSave(); }
  } catch (e) { console.error(e); }
}
async function askPersist() { try { if (navigator.storage && navigator.storage.persist) { S.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist()); } } catch (e) { } }

/* ---------- Refeições salvas (atalho de registro; sem cálculo de dose) ---------- */
const savedSave = async () => { try { await Store.put('meta', { id: 'saved-meals', value: S.saved || [] }); } catch (e) { } };
function mealChips() {
  if (!(S.saved || []).length) return '';
  return `<div class="field full" style="margin-top:12px"><label class="fl">Refeições salvas</label><div class="row" style="flex-wrap:wrap;gap:6px">${S.saved.map(m => `<button type="button" class="btn sm" data-act="meal-use" data-id="${m.id}">${esc(m.name)}${m.carbs != null ? ' · ' + fn(m.carbs, 0) + ' g' : ''}</button>`).join('')}</div><p class="hint" style="margin:6px 0 0">Toque para preencher refeição, descrição e carboidratos. Você pode ajustar antes de salvar.</p></div>`;
}
function mealForm(m) {
  m = m || { name: '', desc: '' };
  return `<h2>${m.id ? 'Editar refeição' : 'Nova refeição salva'}</h2><form id="meal-form" data-id="${m.id || ''}" novalidate><div class="form-grid">
    <div class="field full"><label class="fl" for="ml-n">Nome</label><input class="in" id="ml-n" maxlength="40" value="${esc(m.name)}" placeholder="Ex.: Almoço padrão" autofocus></div>
    <div class="field"><label class="fl" for="ml-c">Carboidratos (g)</label><input class="in" id="ml-c" inputmode="decimal" value="${numAttr(m.carbs)}" placeholder="opcional"></div>
    <div class="field"><label class="fl" for="ml-m">Refeição</label><select class="in" id="ml-m"><option value="">—</option>${Object.entries(MEALS).map(([k, l]) => `<option value="${k}" ${m.meal === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field full"><label class="fl" for="ml-d">Descrição</label><input class="in" id="ml-d" maxlength="120" value="${esc(m.desc || '')}" placeholder="Ex.: arroz, feijão de corda, macarrão"></div></div>
    <p class="err" id="ml-err" role="alert"></p><div class="row"><button class="btn pri grow" type="submit">Salvar</button><button class="btn" type="button" data-act="close">Cancelar</button></div>
    ${m.id ? `<button class="btn danger full" type="button" style="margin-top:10px" data-act="meal-del" data-id="${m.id}">Excluir refeição</button>` : ''}</form>`;
}
function viewRefeicoes() {
  const l = S.saved || [];
  return banners() + `<p class="hint" style="margin:0 0 12px">Salve refeições que você repete para registrá-las com um toque. O app só preenche carboidratos e descrição: não calcula nem sugere dose de insulina.</p><button class="btn pri full" data-act="meal-new">Nova refeição</button><div class="stack" style="margin-top:12px;gap:8px">${l.length ? l.map(m => `<button class="menu-item" data-act="meal-edit" data-id="${m.id}"><div>${esc(m.name)}<span>${[m.meal ? MEALS[m.meal] : '', m.carbs != null ? fn(m.carbs, 0) + ' g de carboidratos' : '', m.desc || ''].filter(Boolean).map(esc).join(' · ') || 'Sem detalhes'}</span></div><svg viewBox="0 0 24 24">${IC.chev}</svg></button>`).join('') : '<div class="card"><p class="hint" style="margin:0">Nenhuma refeição salva ainda.</p></div>'}</div>`;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el || !/^meal-/.test(el.dataset.act)) return;
  const id = el.dataset.id;
  try {
    switch (el.dataset.act) {
      case 'meal-new': openSheet(mealForm()); break;
      case 'meal-edit': openSheet(mealForm((S.saved || []).find(x => x.id === id))); break;
      case 'meal-del': S.saved = (S.saved || []).filter(x => x.id !== id); await savedSave(); closeSheet(); render(); toast('Refeição excluída.'); break;
      case 'meal-use': {
        const m = (S.saved || []).find(x => x.id === id); if (!m) break;
        const set = (i, v) => { const n = $('#' + i); if (n && v != null && v !== '') n.value = v; };
        set('f-meal', m.meal); set('f-carbs', m.carbs != null ? String(m.carbs).replace('.', ',') : ''); set('f-mdesc', m.desc);
        if (m.meal && $('#f-ctx') && !$('#f-ctx').value) $('#f-ctx').value = 'antes';
        const d = $('#f-carbs') && $('#f-carbs').closest('details'); if (d) d.open = true;
        toast('Refeição preenchida: ' + m.name + '.'); break;
      }
    }
  } catch (err) { console.error(err); toast('Algo deu errado: ' + (err && err.message || err)); }
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'meal-form') return; e.preventDefault();
  try {
    const f = e.target, name = $('#ml-n').value.trim(), cr = $('#ml-c').value.trim(), c = cr ? parseNum(cr) : null;
    if (!name) { $('#ml-err').textContent = 'Dê um nome à refeição.'; return; }
    if (cr && (c === null || c < 0 || c > 500)) { $('#ml-err').textContent = 'Carboidratos: informe entre 0 e 500 g.'; return; }
    const m = { id: f.dataset.id || uid(), name: name.slice(0, 40), meal: $('#ml-m').value || undefined, desc: $('#ml-d').value.trim().slice(0, 120) || undefined };
    if (c !== null) m.carbs = c;
    const l = S.saved || []; S.saved = f.dataset.id ? l.map(x => x.id === m.id ? m : x) : l.concat(m);
    await savedSave(); closeSheet(); render(); toast('Refeição salva.');
  } catch (err) { console.error(err); toast('Não foi possível salvar: ' + (err && err.message || err)); }
});

/* ---------- Lembretes no calendário (.ics) ---------- */
const ICS_ITEMS = [
  { k: 'jejum', t: 'Medir glicemia em jejum', d: '07:00' },
  { k: 'almoco', t: 'Medir glicemia antes do almoço', d: '11:45' },
  { k: 'jantar', t: 'Medir glicemia antes do jantar', d: '18:00' },
  { k: 'deitar', t: 'Medir glicemia ao deitar', d: '22:00' },
  { k: 'basal', t: 'Hora da insulina basal', d: '14:30' },
];
function icsDefault(k) {
  if (k === 'basal') { const bs = insStats(S.inslog.filter(x => x.kind === 'basal')); if (bs.n) return hhmm(bs.mean); }
  return ICS_ITEMS.find(x => x.k === k).d;
}
function alertsPanel() {
  const c = alCfg(), sw = (k, on) => `<input type="checkbox" class="al-on swt" role="switch" data-k="${k}" ${on ? 'checked' : ''}>`, opt = (arr, v, f) => arr.map(x => `<option value="${x}" ${+x === +v ? 'selected' : ''}>${f(x)}</option>`).join('');
  const row = (k, on, t, d, extra) => `<div class="al-row"><label class="al-l">${sw(k, on)}<span><b>${t}</b><small>${d}</small></span></label>${extra || ''}</div>`;
  return `<h2 class="sec">Avisos dentro do app</h2><div class="card al-card"><p class="hint" style="margin:0 0 8px">Faixas e telas que aparecem com o app aberto. Ligue ou desligue cada uma.</p>
  ${row('backup', c.backup, 'Lembrar de fazer backup', 'Faixa no topo quando o último backup está velho.', `<select class="in al-sel" data-k="backupDays" aria-label="Intervalo do backup">${opt([3, 7, 14, 30], c.backupDays, x => 'a cada ' + x + ' dias')}</select>`)}
  ${row('rewards', c.rewards, 'Avisar conquistas', 'Mostrar a tela de comemoração ao atingir um marco.')}
  ${row('plan', c.plan, 'Alarmes do meu tratamento', 'Faixa no Painel nos horários de insulina, remédios, medições e troca de cateter que você cadastrou em Esquemas de tratamento.')}
  ${row('bBasal', c.bBasal, 'Insulina basal', 'Faixa quando se aproxima ou passa de 24 h da última dose de basal.')}
  ${row('bPre', c.bPre, 'Pré-jantar', 'Faixa com a medição pré-jantar quando ela está no limite.')}
  ${row('bMiss', c.bMiss, 'Medição esquecida', 'Faixa quando ainda não há glicemia na janela do horário habitual.')}
  ${row('bLabel', c.bLabel, 'Medições sem etiqueta', 'Aviso de medições sem jejum, antes ou depois da refeição.')}
  ${row('bHypo', c.bHypo, 'Faixa de hipoglicemia', 'Alerta vermelho quando a última medição está abaixo de 70 mg/dL. É um aviso de segurança: desligue só se tiver certeza.')}
  ${row('bHyper', c.bHyper, 'Faixa de glicemia muito alta', 'Alerta quando a última medição está muito elevada.')}</div>
  <h2 class="sec">Notificações com o app fechado</h2><div class="card al-card">
  ${row('hypo', c.hypo, 'Reavaliar após hipoglicemia', 'Depois de uma medição de 60 mg/dL ou menos, avisar para medir de novo (de 61 a 69 só registra). Segue o protocolo de hipoglicemia; não indica doses.', `<select class="in al-sel" data-k="hypoMin" aria-label="Minutos para reavaliar">${opt([10, 15, 20], c.hypoMin, x => x + ' min depois')}</select>`)}
  ${row('postFast', c.postFast, 'Medir 2 h após a insulina do jejum', 'Notifica exatamente 2 horas depois de registrar a insulina rápida do jejum. Se você não registrar uma glicemia em até 10 minutos depois da hora, a notificação some e o aviso é ignorado.')}
  ${row('postLunch', c.postLunch, 'Medir 2 h após a insulina do almoço', 'Notifica 2 horas depois de registrar a insulina rápida do almoço. Some sozinha após 10 minutos sem medição.')}
  ${row('postDinner', c.postDinner, 'Medir 2 h após a insulina do jantar', 'Notifica 2 horas depois de registrar a insulina rápida do jantar. Some sozinha após 10 minutos sem medição.')}
  ${row('quiet', c.quiet, 'Silenciar à noite', 'Não notificar neste intervalo (o aviso de hipoglicemia continua).', `<span class="al-time"><input class="in al-tm" data-k="qFrom" type="time" value="${c.qFrom}" aria-label="Início do silêncio"><span>às</span><input class="in al-tm" data-k="qTo" type="time" value="${c.qTo}" aria-label="Fim do silêncio"></span>`)}
  <p class="hint" style="margin:10px 0 0">${IS_NATIVE ? 'Estas notificações tocam com o app fechado. Se o Android pedir, permita as notificações do TiaBete. Os lembretes diários de horário estão logo abaixo, cada um com sua chave.' : 'Estas notificações tocam com o app fechado no <b>aplicativo instalado (APK)</b>. Na versão web as escolhas ficam salvas, mas o navegador não notifica com o app fechado.'}</p></div>
  <h2 class="sec">Alertas personalizados</h2><div class="card"><p class="hint" style="margin:0 0 10px">Crie avisos ligados às suas marcações (como “Dia de perna”) ou a valores de glicemia, com a sua própria mensagem.</p><button class="btn full" data-act="go" data-r="alertasp">Abrir alertas personalizados</button></div>
  <h2 class="sec">Lembretes de horário</h2>`;
}
document.addEventListener('change', async e => {
  const el = e.target.closest('.al-on, .al-sel, .al-tm'); if (!el) return;
  const k = el.dataset.k; S.alerts = alCfg();
  if (el.classList.contains('al-on')) S.alerts[k] = el.checked;
  else if (el.classList.contains('al-sel')) S.alerts[k] = +el.value;
  else if (/^\d\d:\d\d$/.test(el.value)) S.alerts[k] = el.value;
  await alSave(); toast('Preferência salva.');
});
function viewLembretes() {
  const sv = S.icsPref || {};
  return banners() + (typeof acModeCard === 'function' ? acModeCard() : '') + alertsPanel() + `<p class="hint" style="margin:0 0 12px">Os avisos dentro do app só aparecem com ele aberto. Para ser lembrado com o app fechado, gere um arquivo de calendário: abra o arquivo no celular e o seu calendário cria alarmes que se repetem todo dia. Escolha os horários.</p>
  <div class="card"><div class="stack" style="gap:12px">${ICS_ITEMS.map(x => { const p = sv[x.k] || {}, on = p.on !== undefined ? p.on : x.k !== 'deitar'; return `<div class="row" style="justify-content:space-between;gap:10px;align-items:center"><label style="display:flex;flex-direction:row-reverse;justify-content:space-between;gap:10px;align-items:center;flex:1;min-width:0"><input type="checkbox" class="ics-on swt" role="switch" data-k="${x.k}" ${on ? 'checked' : ''}><span>${x.t}</span></label><input class="in ics-t" type="time" id="ics-${x.k}" value="${p.t || icsDefault(x.k)}" style="width:140px;flex:none"></div>`; }).join('')}</div>
  <div class="field" style="margin-top:14px"><label class="fl" for="ics-adv">Avisar com antecedência</label><select class="in" id="ics-adv"><option value="0">Na hora</option><option value="5">5 minutos antes</option><option value="10">10 minutos antes</option><option value="15">15 minutos antes</option></select></div></div>
  <button class="btn pri full" style="margin-top:12px" data-act="ics-make">Gerar arquivo de calendário</button>
  <p class="hint" style="margin:10px 0 0">O horário da basal vem da sua média registrada, quando existe. Para parar os lembretes, apague os eventos “TiaBete” do calendário. Os horários são só avisos seus: o app não indica doses.</p>`;
}
const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
function makeICS(items, adv) {
  const d0 = isoDate(new Date()).replace(/-/g, ''), now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TiaBete//Lembretes//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  items.forEach(it => {
    const [h, m] = it.t.split(':'), dur = new Date(2000, 0, 1, +h, +m + 10), end = pad(dur.getHours()) + pad(dur.getMinutes());
    L.push('BEGIN:VEVENT', `UID:tiabete-${it.k}-${d0}@tiabete.local`, `DTSTAMP:${now}`, `DTSTART:${d0}T${h}${m}00`, `DTEND:${d0}T${end}00`, 'RRULE:FREQ=DAILY', `SUMMARY:${icsEsc('TiaBete · ' + it.title)}`, `DESCRIPTION:${icsEsc('Lembrete do TiaBete. Registre no app depois.')}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(it.title)}`, `TRIGGER:-PT${adv}M`, 'END:VALARM', 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act="ics-make"]'); if (!el) return;
  try {
    const items = [], pref = {};
    ICS_ITEMS.forEach(x => { const on = $('.ics-on[data-k=' + x.k + ']').checked, t = parseTime($('#ics-' + x.k).value); pref[x.k] = { on, t: t || undefined }; if (on) { if (!t) { toast('Informe um horário válido para: ' + x.t + '.'); items.length = -1; } else items.push({ k: x.k, t, title: x.t }); } });
    if (items.length < 0) return;
    if (!items.length) { toast('Marque pelo menos um lembrete.'); return; }
    S.icsPref = pref; try { await Store.put('meta', { id: 'ics-pref', value: pref }); } catch (x) { }
    await saveFile(`tiabete-lembretes-${stamp()}.ics`, makeICS(items, +$('#ics-adv').value || 0), makeICS(items, +$('#ics-adv').value || 0));
  } catch (err) { console.error(err); toast('Não consegui gerar o arquivo: ' + (err && err.message || err)); }
});

/* ---------- Padrões (calculados no aparelho) ---------- */
function viewPadroes() {
  const notes = patternNotes(S.records, MARKS, isoDate(new Date()));
  return banners() + prNotice('padroes') + `<p class="hint" style="margin:0 0 12px">Observações calculadas no seu aparelho a partir dos seus registros reais (os de exemplo ficam de fora). Aparecem só quando há medições suficientes. Mostram coincidências nos números, não causas, e não são orientação de tratamento.</p>
  ${notes.length ? notes.map(x => `<h2 class="sec">${esc(x.t)}</h2><div class="card"><p style="margin:0">${esc(x.d)}</p><div class="dim" style="font-size:13.5px;margin-top:6px">Base: ${x.n} medições</div></div>`).join('') : '<div class="card"><p class="hint" style="margin:0">Ainda não há medições suficientes para mostrar padrões. Eles precisam de pelo menos 3 ocorrências de cada situação comparada.</p></div>'}</div>
  ${HAS_CLAUDE ? '<button class="btn pri full" style="margin-top:14px" data-act="go" data-r="perguntas">Perguntar ao Claude sobre meus registros</button>' : ''}`;
}

/* ---------- Perguntas ao Claude sobre o histórico ---------- */
const ASK_TIPS = [
  'Compare as 5 últimas glicemias pós-prandiais do jantar e de jejum e me diga se há um padrão entre elas.',
  'Como foi meu jejum nos últimos 14 dias?',
  'Em quais horários tive mais glicemias baixas neste mês?',
  'Meus dias de perna e sem treino mudam a glicemia?',
];
function askData() { const real = S.records.filter(r => r.source !== 'exemplo'); return real.length ? real : S.records; }
function askRec(r) {
  const o = { data: fmtDate(r.date), dia_semana: WD[new Date(r.date + 'T12:00:00').getDay()], hora: r.noTime ? null : r.time, glicemia_mg_dl: r.glucose };
  if (r.context) o.contexto = CONTEXTS[r.context]; if (r.meal) o.refeicao = MEALS[r.meal];
  if (r.carbs != null) o.carboidratos_g = r.carbs; if (r.insMeal != null) o.insulina_rapida_U = r.insMeal; if (r.insCorr != null) o.correcao_U = r.insCorr; if (r.insBasal != null) o.basal_U = r.insBasal;
  const mk = markTxt(r); if (mk.length) o.etiquetas = mk; if (r.notes) o.observacao = String(r.notes).slice(0, 200); if (r.mealDesc) o.refeicao_descricao = String(r.mealDesc).slice(0, 120);
  return o;
}
function askFilter(a) {
  let l = askData().slice();
  if (a.de && parseDate(a.de)) l = l.filter(r => r.date >= parseDate(a.de)); if (a.ate && parseDate(a.ate)) l = l.filter(r => r.date <= parseDate(a.ate));
  if (a.contexto) l = l.filter(r => r.context === a.contexto); if (a.refeicao) l = l.filter(r => r.meal === a.refeicao);
  if (typeof a.minimo === 'number') l = l.filter(r => r.glucose >= a.minimo); if (typeof a.maximo === 'number') l = l.filter(r => r.glucose <= a.maximo);
  if (a.etiqueta) { const q = norm(a.etiqueta); l = l.filter(r => (r.marks || []).some(m => m === a.etiqueta || norm(MARKS[m] || '').includes(q)) || norm(r.tags || '').includes(q)); }
  return l.sort((x, y) => x.ts - y.ts);
}
const ASK_TOOLS = () => {
  const ctxEnum = ['jejum', 'antes', 'depois', 'deitar', 'madrugada', 'outro'], meEnum = ['cafe', 'almoco', 'jantar', 'lanche'];
  const flt = { de: { type: 'string', description: 'Data inicial AAAA-MM-DD' }, ate: { type: 'string', description: 'Data final AAAA-MM-DD' }, contexto: { type: 'string', enum: ctxEnum, description: 'jejum, antes (pré-prandial), depois (pós-prandial), deitar, madrugada, outro' }, refeicao: { type: 'string', enum: meEnum }, etiqueta: { type: 'string', description: 'Etiqueta rápida (ex.: perna, alcool, semtreino) ou texto de etiqueta' } };
  return [
    { name: 'buscar_medicoes', description: 'Lista medições de glicemia do usuário com filtros. Pós-prandial do jantar = contexto "depois" + refeicao "jantar". Por padrão devolve as mais recentes.', inputSchema: { type: 'object', properties: { ...flt, minimo: { type: 'number' }, maximo: { type: 'number' }, ordem: { type: 'string', enum: ['recentes', 'antigas'] }, limite: { type: 'integer', description: 'padrão 20, máximo 200' } } },
      execute: a => { const l = askFilter(a || {}), lim = Math.min(Math.max(+(a && a.limite) || 20, 1), 200), pick = (a && a.ordem === 'antigas') ? l.slice(0, lim) : l.slice(-lim).reverse(); return { total_encontradas: l.length, retornadas: pick.length, medicoes: pick.map(askRec) }; } },
    { name: 'estatisticas', description: 'Resumo estatístico (n, média, mínimo, máximo, desvio, % abaixo de 70, % acima de 180 — 130 em jejum) das medições filtradas, com agrupamento opcional.', inputSchema: { type: 'object', properties: { ...flt, agrupar: { type: 'string', enum: ['nenhum', 'contexto', 'horario'] } } },
      execute: a => { const l = askFilter(a || {}), sm = rs => { const s = stats(rs); return { n: s.n, media: s.n ? Math.round(s.mean * 10) / 10 : null, minimo: s.n ? s.min : null, maximo: s.n ? s.max : null, desvio: s.sd != null ? Math.round(s.sd * 10) / 10 : null, abaixo_70: s.hypo, acima_da_faixa: s.hyper }; }, out = { geral: sm(l) };
        if (a && a.agrupar === 'contexto') out.por_contexto = Object.fromEntries(ctxEnum.map(c => [CONTEXTS[c], sm(l.filter(r => r.context === c))]).filter(([, v]) => v.n));
        if (a && a.agrupar === 'horario') out.por_horario = byTimeBlock(l).map(b => ({ faixa: b.label, n: b.n, media: b.mean != null ? Math.round(b.mean * 10) / 10 : null }));
        return out; } },
    { name: 'registros_insulina', description: 'Registros do card de insulinas (horário e unidades que o usuário anotou; tipos: basal, jejum, almoço, jantar).', inputSchema: { type: 'object', properties: { de: flt.de, ate: flt.ate, tipo: { type: 'string', enum: ['basal', 'fast', 'lunch', 'dinner'] }, limite: { type: 'integer' } } },
      execute: a => { let l = S.inslog.slice(); if (a && a.de) l = l.filter(x => x.date >= a.de); if (a && a.ate) l = l.filter(x => x.date <= a.ate); if (a && a.tipo) l = l.filter(x => x.kind === a.tipo); const lim = Math.min(+(a && a.limite) || 40, 200); return { total: l.length, registros: l.slice(-lim).map(x => ({ data: fmtDate(x.date), hora: HM(x.ts), tipo: INS_KIND[x.kind], unidades: x.units != null ? x.units : null })) }; } },
    { name: 'hba1c_eventos_esquemas', description: 'HbA1c de laboratório, eventos (ex.: gripe, viagem) e esquemas de tratamento cadastrados.', inputSchema: { type: 'object', properties: {} },
      execute: () => ({ hba1c: S.hba.filter(x => x.source !== 'exemplo').slice(-20).map(x => ({ data: fmtDate(x.date), valor_percent: x.value })), eventos: S.events.slice(-30).map(x => ({ data: fmtDate(x.date), texto: x.text })), esquemas: S.schemes.filter(x => x.source !== 'exemplo').map(x => ({ nome: x.name, inicio: fmtDate(x.start), fim: x.end ? fmtDate(x.end) : null })) }) },
    { name: 'resumo_dos_dados', description: 'Quantidade total de medições e período coberto. Útil para saber o que existe antes de buscar.', inputSchema: { type: 'object', properties: {} },
      execute: () => { const l = askData(), ex = l.length && l.every(r => r.source === 'exemplo'); return { total_medicoes: l.length, primeira: l.length ? fmtDate(l[0].date) : null, ultima: l.length ? fmtDate(l[l.length - 1].date) : null, apenas_dados_de_exemplo: ex }; } },
  ];
};
function askSystem() {
  return `Você é o assistente de análise de dados do aplicativo TiaBete (controle de glicemia, em mg/dL) e conversa em português do Brasil com o próprio usuário, que tem diabetes tipo MODY. Hoje é ${fmtDate(isoDate(new Date()))} (${WD[new Date().getDay()]}), ${nowHM()}.
Responda sempre com base nos dados do usuário: use as ferramentas para buscar medições, estatísticas e registros de insulina ANTES de afirmar números. Nunca invente valores; se faltar dado, diga o que falta.
REGRAS: (1) Descreva o que os números mostram, com datas e valores; padrões são coincidências observadas, não causas. (2) NUNCA recomende, calcule ou ajuste doses de insulina, nem mudança de tratamento ou de remédio. (3) Não faça diagnóstico. Para decisões de tratamento ou números preocupantes, sugira conversar com a equipe médica; em sintomas graves, procurar atendimento (SAMU 192). (4) Contexto "depois"+refeição "jantar" é o pós-prandial do jantar; "jejum" é a glicemia em jejum. (5) Faixas do app: baixa < 70; alta > 180 (jejum > 130); muito baixa < 54; muito alta > 250. (6) Seja objetivo: respostas curtas, sem tabelas Markdown (use listas curtas), no máximo cerca de 200 palavras salvo se pedirem mais.`;
}
function askFmt(t) {
  const lines = String(t || '').split('\n'); let h = '', ul = false;
  for (const ln of lines) { const m = ln.match(/^\s*[-*•]\s+(.*)/), x = esc(m ? m[1] : ln).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); if (m) { if (!ul) { h += '<ul class="plain" style="margin:6px 0">'; ul = true; } h += '<li>' + x + '</li>'; } else { if (ul) { h += '</ul>'; ul = false; } h += x ? '<p style="margin:6px 0">' + x + '</p>' : ''; } }
  return h + (ul ? '</ul>' : '');
}
function askLogHTML() {
  const c = S.chat || [];
  return c.map(m => m.role === 'user' ? `<div class="ask-u">${esc(m.text)}</div>` : `<div class="ask-a">${m.text ? askFmt(m.text) : '<span class="dim">Consultando seus registros…</span>'}</div>`).join('');
}
function viewPerguntas() {
  S.chat = S.chat || [];
  return `<div class="card" style="margin-bottom:12px"><p class="hint" style="margin:0"><b>Pergunte sobre seus registros.</b> Ao enviar uma pergunta, o app manda ao Claude apenas os dados que ele precisar consultar (valores, datas, horários, etiquetas e insulinas que você anotou) para responder. Nada é enviado antes disso e nada fica guardado pelo app além desta conversa. As respostas descrevem seus números e não substituem sua equipe médica nem indicam doses.</p></div>
  <div id="ask-log" class="ask-log" aria-live="polite">${askLogHTML()}</div>
  ${S.chat.length ? '' : `<div class="stack" style="gap:8px;margin-bottom:12px">${ASK_TIPS.map(t => `<button class="btn full ask-tip" data-act="ask-tip" style="text-align:left;white-space:normal">${esc(t)}</button>`).join('')}</div>`}
  <form id="ask-form" novalidate><textarea class="in" id="ask-q" rows="3" maxlength="800" placeholder="Ex.: compare meus jejuns da última semana com os da semana anterior"></textarea><div class="row" style="margin-top:8px"><button class="btn pri grow" type="submit" id="ask-send">Perguntar</button>${S.chat.length ? '<button class="btn" type="button" data-act="ask-clear">Limpar conversa</button>' : ''}</div></form>`;
}
let askAbort = null, askBusy = false;
async function askSend(q) {
  q = String(q || '').trim(); if (!q || askBusy) return;
  const sample = await getSample(); if (!sample) { toast('O Claude só responde quando o app é aberto dentro do Claude.'); return; }
  S.chat = S.chat || []; S.chat.push({ role: 'user', text: q }); const msg = { role: 'assistant', text: '' }; S.chat.push(msg); askBusy = true;
  const log = $('#ask-log'); if (log) log.innerHTML = askLogHTML(); const qa = $('#ask-q'); if (qa) qa.value = ''; const tips = $$('.ask-tip'); tips.forEach(t => t.parentElement && t.parentElement.remove());
  const btn = $('#ask-send'); if (btn) { btn.disabled = true; btn.textContent = 'Consultando…'; }
  const hist = S.chat.slice(0, -1).filter(m => m.text).slice(-9), input = hist.map((m, i) => ({ role: m.role, content: i === 0 ? askSystem() + '\n\n' + m.text : m.text }));
  if (input.length && input[0].role !== 'user') input.unshift({ role: 'user', content: askSystem() });
  askAbort = typeof AbortController !== 'undefined' ? new AbortController() : null;
  try {
    const r = await sample(input, { modelTier: 'default', cache: false, tools: ASK_TOOLS(), signal: askAbort && askAbort.signal, onText: ({ text }) => { msg.text = text; const l = $('#ask-log'); if (l && S.route === 'perguntas') { l.innerHTML = askLogHTML(); } } });
    msg.text = ((r && r.text) || msg.text || '').trim() || 'Não consegui montar uma resposta. Tente reformular a pergunta.';
  } catch (e) { console.error(e); msg.text = sampleErrMsg(e); msg.err = true; }
  askBusy = false; if (S.route === 'perguntas') render();
}
document.addEventListener('submit', e => { if (e.target.id !== 'ask-form') return; e.preventDefault(); askSend($('#ask-q').value); });
document.addEventListener('keydown', e => { if (e.target.id === 'ask-q' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); askSend(e.target.value); } });
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act="ask-tip"],[data-act="ask-clear"]'); if (!el) return;
  if (el.dataset.act === 'ask-tip') askSend(el.textContent); else { if (askAbort) try { askAbort.abort(); } catch (x) { } S.chat = []; askBusy = false; render(); }
});

/* ---------- Histórico: ir para dia/horário e rolagem por dias ---------- */
const histDays = () => [...new Set(histItems().map(i => i.date))];
function histJumpBar() {
  const days = histDays(); if (days.length < 2) return '';
  const today = isoDate(new Date());
  return `<h2 class="sec">Ir para um dia ou horário</h2><div class="card hj" style="margin-top:10px;padding:12px">
  <div class="row" style="gap:8px;align-items:flex-end"><div class="field" style="flex:1;min-width:0"><label class="fl" for="hj-d">Dia</label><input class="in" type="date" id="hj-d" value="${S.hjD || ''}" max="${today}"></div><div class="field" style="width:112px;flex:none"><label class="fl" for="hj-t">Hora</label><input class="in" type="time" id="hj-t" value="${S.hjT || ''}"></div><button class="btn pri" data-act="hj-go" style="flex:none">Ir</button></div>
</div>`;
}
function histScrollTo(date, time, quiet) {
  const items = histItems(); if (!items.length) return;
  let idx = items.findIndex(i => i.date <= date); if (idx < 0) idx = items.length - 1;
  const day = items[idx].date, exact = day === date;
  let target = items[idx];
  if (time && exact) { const want = mkTs(date, time); target = items.filter(i => i.date === day).sort((a, b) => Math.abs(a.ts - want) - Math.abs(b.ts - want))[0]; }
  const need = items.findIndex(i => i === target) + 25; if (S.hist.limit < need) { S.hist.limit = need; $('#h-list').innerHTML = histListHTML(); }
  const el = time && exact ? $(`#h-list [data-key="${itKey(target)}"]`) : $(`#h-list .day-h[data-d="${day}"]`);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 70; window.scrollTo({ top: Math.max(0, y), behavior: quiet ? 'auto' : 'smooth' });
  $$('#h-list .flash').forEach(n => n.classList.remove('flash')); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2200);
  if (!quiet && !exact) toast('Sem registros em ' + fmtDate(date) + '. Mostrando o dia mais próximo: ' + fmtDate(day) + '.');
}
document.addEventListener('click', e => {
  if (!e.target.closest('[data-act="hj-go"]')) return;
  const d = parseDate($('#hj-d').value), t = $('#hj-t').value ? parseTime($('#hj-t').value) : null;
  if (!d) { toast('Escolha um dia para ir até ele.'); return; }
  S.hjD = d; S.hjT = t || ''; histScrollTo(d, t);
});

/* ---------- Rolagem rápida do histórico (estilo Google Fotos): alça + meses + data no topo ---------- */
const SCR = { items: [], n: 0, drag: false, raf: 0, ms: [] };
const SCR_MON = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const SCR_WD = ['Dom.', 'Seg.', 'Ter.', 'Qua.', 'Qui.', 'Sex.', 'Sáb.'];
const scrCap = t => t.charAt(0).toUpperCase() + t.slice(1);
const scrMax = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
const scrTrack = () => { const t = $('#hscrub .sc-track'); return t ? t.getBoundingClientRect() : null; };
const scrThumbH = 56;
function scrSetup() {
  const old = $('#hscrub');
  if (S.route !== 'historico') { if (old) old.remove(); $('#hscrub-top') && $('#hscrub-top').remove(); return; }
  SCR.items = histItems(); SCR.n = SCR.items.length;
  if (SCR.n < 25) { if (old) old.remove(); return; }
  if (!old) {
    const el = document.createElement('div'); el.id = 'hscrub'; el.setAttribute('role', 'slider'); el.setAttribute('tabindex', '0'); el.setAttribute('aria-label', 'Rolagem rápida do histórico: arraste para escolher o mês, o dia e o horário'); el.setAttribute('aria-orientation', 'vertical');
    el.innerHTML = '<div class="sc-track"><div class="sc-months"></div><div class="sc-thumb"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 5l5 6H7zM12 19l-5-6h10z"/></svg></div><div class="sc-lab" hidden></div></div>';
    document.body.appendChild(el);
    const top = document.createElement('div'); top.id = 'hscrub-top'; top.hidden = true; top.setAttribute('aria-hidden', 'true'); document.body.appendChild(top);
    el.addEventListener('pointerdown', scrDown); el.addEventListener('pointermove', scrMove); el.addEventListener('pointerup', scrUp); el.addEventListener('pointercancel', scrUp); el.addEventListener('keydown', scrKey);
  }
  scrSync();
}
function scrMonths() { // pílulas de mês posicionadas pela posição real do conteúdo
  const box = $('#hscrub .sc-months'), tr = scrTrack(); if (!box || !tr) return;
  const mx = scrMax(), H = tr.height - scrThumbH, seen = {}, out = []; let lastY = -99;
  $$('#h-list .day-h').forEach(d => { const m = d.dataset.d.slice(0, 7); if (seen[m]) return; seen[m] = 1; const f = Math.min(1, Math.max(0, (d.getBoundingClientRect().top + window.scrollY - 100) / mx)), y = f * H + scrThumbH / 2; if (y - lastY >= 26) { out.push([y, m]); lastY = y; } });
  box.innerHTML = out.map(([y, m]) => `<span style="top:${y.toFixed(0)}px">${scrCap(SCR_MON[+m.slice(5) - 1]).replace('.', '')} ${m.slice(2, 4)}</span>`).join('');
}
function scrIdxFromScroll() {
  for (const r of $$('#h-list .rec')) { if (r.getBoundingClientRect().bottom > 110) { const ts = +r.dataset.ts, i = SCR.items.findIndex(x => x.ts === ts); return i < 0 ? 0 : i; } }
  return Math.max(0, SCR.n - 1);
}
function scrLabels() {
  const it = SCR.items[Math.min(SCR.n - 1, scrIdxFromScroll())]; if (!it) return;
  const d = new Date(it.ts), lab = $('#hscrub .sc-lab'), top = $('#hscrub-top');
  if (lab) lab.textContent = scrCap(SCR_MON[d.getMonth()]).replace('.', '') + ' de ' + d.getFullYear();
  if (top) top.textContent = SCR_WD[d.getDay()] + ', ' + d.getDate() + ' de ' + SCR_MON[d.getMonth()] + ' de ' + d.getFullYear() + (it.t === 'r' && it.r.noTime ? '' : ' · ' + HM(it.ts));
  $('#hscrub') && $('#hscrub').setAttribute('aria-valuetext', fmtDate(it.date) + ' ' + HM(it.ts));
}
function scrPlace(f) {
  const tr = scrTrack(); if (!tr) return;
  const y = f * (tr.height - scrThumbH), th = $('#hscrub .sc-thumb'), lab = $('#hscrub .sc-lab');
  th.style.transform = `translateY(${y.toFixed(1)}px)`; if (lab) lab.style.transform = `translateY(${(y + scrThumbH / 2 - 21).toFixed(1)}px)`;
}
function scrSync() { if (SCR.drag || !$('#hscrub')) return; scrPlace(Math.min(1, window.scrollY / scrMax())); scrLabels(); }
function scrDown(e) {
  const el = $('#hscrub'); SCR.drag = true;
  if (S.hist.limit < SCR.n) { S.hist.limit = SCR.n + 5; $('#h-list').innerHTML = histListHTML(); } // carrega tudo para a rolagem acompanhar o conteúdo todo
  el.classList.add('on'); $('#hscrub-top').hidden = false; $('.sc-lab', el).hidden = false; scrMonths();
  try { el.setPointerCapture(e.pointerId); } catch (x) { } e.preventDefault(); scrQueue(e.clientY);
}
function scrMove(e) { if (!SCR.drag) return; e.preventDefault(); scrQueue(e.clientY); }
function scrQueue(y) { SCR.y = y; if (SCR.raf) return; SCR.raf = requestAnimationFrame(() => { SCR.raf = 0; const tr = scrTrack(); if (!tr) return; const f = Math.min(1, Math.max(0, (SCR.y - tr.top - scrThumbH / 2) / (tr.height - scrThumbH))); window.scrollTo({ top: f * scrMax(), behavior: 'auto' }); scrPlace(f); scrLabels(); }); }
function scrUp() { if (!SCR.drag) return; SCR.drag = false; const el = $('#hscrub'); if (!el) return; el.classList.remove('on'); setTimeout(() => { if (!SCR.drag) { const l = $('.sc-lab', el), t = $('#hscrub-top'); if (l) l.hidden = true; if (t) t.hidden = true; } }, 900); }
function scrKey(e) {
  const k = e.key, st = k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : k === 'PageDown' ? 10 : k === 'PageUp' ? -10 : k === 'Home' ? -1e9 : k === 'End' ? 1e9 : 0; if (!st) return; e.preventDefault();
  const idx = Math.max(0, Math.min(SCR.n - 1, scrIdxFromScroll() + st)), it = SCR.items[idx]; if (!it) return;
  if (S.hist.limit < idx + 25) { S.hist.limit = idx + 25; $('#h-list').innerHTML = histListHTML(); }
  const el = $(`#h-list [data-key="${itKey(it)}"]`); if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 100), behavior: 'auto' });
  const t = $('#hscrub-top'); t.hidden = false; scrSync(); clearTimeout(SCR.kt); SCR.kt = setTimeout(() => { t.hidden = true; }, 1300);
}
window.addEventListener('scroll', () => {
  const el = $('#hscrub'); if (!el || SCR.drag || SCR.sraf) return;
  SCR.sraf = requestAnimationFrame(() => { SCR.sraf = 0; scrSync(); el.classList.add('act'); clearTimeout(SCR.at); SCR.at = setTimeout(() => el.classList.remove('act'), 1500); });
}, { passive: true });
window.addEventListener('resize', () => { if ($('#hscrub')) scrSync(); });
new MutationObserver(ms => { if (ms.every(m => m.target.nodeType === 1 && m.target.closest && m.target.closest('#hscrub,#hscrub-top'))) return; if (S.route === 'historico' && !SCR.drag) { clearTimeout(SCR.mt); SCR.mt = setTimeout(scrSetup, 60); } }).observe(document.body, { childList: true, subtree: true });


/* ================= Backup no Google Drive (conector do Claude) ================= */
const DRV = 'Google Drive', DRV_FOLDER = 'TiaBete Backups';
S.drv = { auto: false, folderId: null, lastTs: 0, busy: false, msg: '', list: null, failAt: 0, freq: '1', custom: 3, notify: true, lastStatus: '', lastMsg: '', lastAt: 0, failSeen: 0 };
/* intervalo escolhido, em ms (menos 2 h de folga, para o diário valer mesmo abrindo o app um pouco mais cedo) */
const drvGap = () => { const d = S.drv, n = d.freq === 'custom' ? Math.min(90, Math.max(1, Math.round(+d.custom) || 1)) : (+d.freq || 1); return n * 86400000 - 2 * 3600000; };
async function drvMcp() { try { return window.claude && window.claude.use ? await window.claude.use('mcp') : null; } catch (e) { return null; } }
async function drvCall(tool, input) {
  if (window.TB_DRV) return window.TB_DRV.call(tool, input); // APK: API do Drive com a conta Google do usuário
  const m = await drvMcp(); if (!m) throw { code: 'no_mcp' };
  const r = await m.callTool(DRV, tool, input, { cache: false });
  return r && r.payload !== undefined ? r.payload : r;
}
function drvErrTxt(e) {
  if (e && e.aiMsg) return e.aiMsg;
  const c = e && e.code;
  if (c === 'no_mcp' || c === 'not_granted' || c === 'capability_disabled') return 'O backup no Drive só funciona quando o app é aberto dentro do Claude.';
  if (c === 'server_not_connected' || c === 'selection_required') return 'Conecte o Google Drive em Configurações → Conectores no claude.ai.';
  if (c === 'needs_reauth') return 'A conexão com o Google Drive expirou. Reconecte em Configurações → Conectores no claude.ai.';
  if (c === 'not_in_manifest' || c === 'approval_required' || c === 'consent_required') return 'Você não autorizou o app a usar o Google Drive. Toque de novo e permita.';
  if (c === 'blocked_by_policy') return 'Sua organização bloqueou este acesso ao Drive.';
  if (c === 'server_unavailable' || c === 'upstream_error') return 'O Drive não respondeu. Tente de novo em instantes.';
  return 'Não foi possível falar com o Drive' + (e && e.message ? ': ' + String(e.message).slice(0, 80) : '.');
}
const drvFiles = p => (p && Array.isArray(p.files)) ? p.files : Array.isArray(p) ? p : [];
async function drvSavePref() { const d = S.drv; try { await Store.put('meta', { id: 'drive-pref', auto: d.auto, folderId: d.folderId, lastTs: d.lastTs, freq: d.freq, custom: d.custom, notify: d.notify, lastStatus: d.lastStatus, lastMsg: d.lastMsg, lastAt: d.lastAt, failSeen: d.failSeen }); } catch (e) { } }
async function drvFolder() {
  if (S.drv.folderId) return S.drv.folderId;
  const f = drvFiles(await drvCall('search_files', { query: `title = '${DRV_FOLDER}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and owner = 'me'`, excludeContentSnippets: true, pageSize: 5 }))[0];
  if (f && f.id) { S.drv.folderId = f.id; await drvSavePref(); return f.id; }
  const c = await drvCall('create_file', { title: DRV_FOLDER, mimeType: 'application/vnd.google-apps.folder' });
  if (!c || !c.id) throw { code: 'upstream_error', message: 'pasta não criada' };
  S.drv.folderId = c.id; await drvSavePref(); return c.id;
}
async function drvBackup(manual) {
  const d = S.drv; if (d.busy) return false;
  const txt = backupText(); if (!txt) { if (manual) toast('Ainda não há dados reais para salvar.'); return false; }
  d.busy = true; d.msg = ''; if (manual) render();
  try {
    const ek = await secDriveKey(), body = ek ? await secSeal(txt, ek.key, b64d(ek.salt), ek.iter) : txt;
    let pid = await drvFolder(), now = new Date(), name = `tiabete-backup-${isoDate(now)}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
    const mk = id => drvCall('create_file', { title: name, textContent: body, contentMimeType: 'application/json', disableConversionToGoogleType: true, parentId: id });
    try { await mk(pid); }
    catch (e) { if (e && e.code === 'tool_error') { S.drv.folderId = null; pid = await drvFolder(); await mk(pid); } else throw e; }
    d.lastTs = Date.now(); d.lastAt = d.lastTs; d.lastStatus = 'ok'; d.lastMsg = ''; d.failAt = 0; await drvSavePref(); await markBackup();
    d.msg = 'ok'; if (manual) toast('Backup salvo no Google Drive.');
    return true;
  } catch (e) { d.failAt = Date.now(); d.msg = drvErrTxt(e); d.lastAt = d.failAt; d.lastStatus = 'fail'; d.lastMsg = d.msg; await drvSavePref(); if (manual) toast(d.msg); else if (d.notify) { try { window.dispatchEvent(new CustomEvent('tb-drv-fail', { detail: d.msg })); } catch (x) { } } return false; }
  finally { d.busy = false; if (S.route === 'backup') render(); }
}
function drvAuto() {
  const d = S.drv; if (!HAS_CLAUDE || !d.auto || d.busy || !hasRealData()) return;
  if (Date.now() - d.lastTs < drvGap() || Date.now() - d.failAt < 30 * 60000) return;
  drvBackup(false);
}
async function drvList() {
  const d = S.drv; d.busy = true; d.msg = ''; render();
  try {
    const pid = await drvFolder();
    d.list = drvFiles(await drvCall('search_files', { query: `parentId = '${pid}' and trashed = false`, excludeContentSnippets: true, orderBy: 'modifiedTime desc', pageSize: 15 })).filter(f => f && f.id && /\.json$/i.test(f.title || ''));
    if (!d.list.length) d.msg = 'Nenhum backup encontrado na pasta do Drive.';
  } catch (e) { d.msg = drvErrTxt(e); }
  finally { d.busy = false; render(); }
}
async function drvLoad(id) {
  const d = S.drv; d.busy = true; d.msg = ''; render();
  try {
    const p = await drvCall('download_file_content', { fileId: id }); let s = p && typeof p === 'object' ? p.content : p;
    if (typeof s !== 'string') throw { code: 'tool_error', message: 'conteúdo vazio' };
    if (!s.trim().startsWith('{')) { const bin = atob(s.replace(/\s/g, '')); s = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); }
    d.busy = false; await readBackupFile(new Blob([s], { type: 'application/json' }));
  } catch (e) { d.msg = drvErrTxt(e); d.busy = false; render(); }
}
function driveCardBody(intro) {
  const d = S.drv, fmt = t => new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const acct = window.TB_DRV ? '' : '<p class="hint" style="margin:0 0 10px">Conta: a do conector Google Drive do seu Claude (o app não enxerga o e-mail).</p>';
  const list = d.list && d.list.length ? `<div class="stack" style="margin-top:12px">${d.list.map(f => `<button class="btn full" data-act="drv-load" data-id="${esc(f.id)}" ${d.busy ? 'disabled' : ''}>${esc(f.title.replace(/^tiabete-backup-/, '').replace(/\.json$/i, ''))} · restaurar</button>`).join('')}</div>` : '';
  const ok = d.lastStatus === 'ok' && d.lastTs, bad = d.lastStatus === 'fail';
  const status = `<div class="bl-facts" style="margin:0 0 12px"><div class="row sp"><span>Último backup</span><b class="num">${d.lastTs ? fmt(d.lastTs) : 'nenhum ainda'}</b></div>
    <div class="row sp"><span>Status</span><b>${ok ? '✓ Concluído' : bad ? '✗ Falhou' : '—'}</b></div>${bad ? `<div class="row sp"><span>Última tentativa</span><b class="num">${fmt(d.lastAt)}</b></div>` : ''}
    ${d.auto && d.lastTs ? `<div class="row sp"><span>Próxima verificação</span><b class="num">depois de ${fmt(d.lastTs + drvGap())}</b></div>` : ''}</div>${bad ? `<p class="hint" style="margin:0 0 12px;color:var(--red-t)" role="alert">${esc(d.lastMsg || d.msg || 'O backup não foi concluído.')}</p>` : ''}`;
  return `<p class="hint" style="margin:0 0 12px">${intro}</p>${acct}${status}
    <div class="stack"><button class="btn pri full" data-act="drv-now" ${d.busy ? 'disabled' : ''}>${d.busy ? 'Aguarde…' : 'Fazer backup agora'}</button>
    <button class="btn full" data-act="drv-list" ${d.busy ? 'disabled' : ''}>Ver backups no Drive para restaurar</button></div>${list}
    <div class="fl" style="margin:18px 0 8px">Backup programado</div>
    <label class="al-l pl-sw"><input type="checkbox" class="swt" role="switch" id="drv-auto" ${d.auto ? 'checked' : ''}><span><b>Fazer backup ao abrir o app</b><small>Quando passar o intervalo escolhido, o backup é feito na próxima vez que você abrir ou voltar ao app.</small></span></label>
    <div class="form-grid" style="margin-top:10px"><div class="field"><label class="fl" for="drv-freq">Frequência</label><select class="in" id="drv-freq">${[['1', 'A cada 1 dia'], ['7', 'A cada 7 dias'], ['15', 'A cada 15 dias'], ['30', 'A cada 30 dias'], ['custom', 'Personalizado']].map(([v, l]) => `<option value="${v}" ${String(d.freq) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    ${d.freq === 'custom' ? `<div class="field"><label class="fl" for="drv-custom">Dias entre backups</label><input class="in num" type="number" inputmode="numeric" min="1" max="90" id="drv-custom" value="${d.custom}"></div>` : ''}</div>
    <label class="al-l pl-sw" style="margin-top:6px"><input type="checkbox" class="swt" role="switch" id="drv-notify" ${d.notify ? 'checked' : ''}><span><b>Avisar se o backup falhar</b><small>Faixa no app${window.TB_DRV ? ' e notificação do Android' : ''}.</small></span></label>
    <p class="hint" style="margin:12px 0 0"><b>Importante:</b> este backup <b>não roda com o app fechado</b>. ${window.TB_DRV ? 'O Android não permite que o TiaBete envie arquivos em segundo plano por conta própria.' : 'O navegador e o Claude só executam o app enquanto ele está aberto.'} Ele só acontece quando você abre o app, ou toca em “Fazer backup agora”. Se ficar muitos dias sem abrir, o backup atrasa.</p>
    <p class="hint" style="margin:6px 0 0">O backup inclui medições, exames, insulinas, tratamento, alimentos, refeições, razão insulina/carboidratos e configurações. O app não apaga backups antigos do Drive.</p>`;
}
function drvBanner() {
  const d = S.drv; if (!d.auto || !d.notify || d.lastStatus !== 'fail' || d.failSeen >= d.lastAt) return '';
  return `<div class="banner warn"><span><b>O backup no Drive falhou.</b> ${esc(d.lastMsg || '')}</span><span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm pri" data-act="drv-retry">Tentar agora</button><button class="btn sm" data-act="drv-dismiss">Fechar</button></span></div>`;
}
function driveCard() {
  if (!HAS_CLAUDE) return '';
  if (window.TB_DRV) return window.TB_DRV.card(S.drv, driveCardBody);
  return `<h2 class="sec">Google Drive</h2><div class="card">${driveCardBody(`Salva uma cópia do backup completo na pasta <b>${DRV_FOLDER}</b> do seu Drive, pelo conector do Claude. Só funciona com o app aberto dentro do Claude. Seus dados de saúde vão para o <b>seu</b> Drive, e só você os acessa.`)}</div>`;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act^="drv-"]'); if (!el) return;
  const a = el.dataset.act;
  try { if (a === 'drv-retry') { await drvBackup(true); render(); } else if (a === 'drv-dismiss') { S.drv.failSeen = S.drv.lastAt; await drvSavePref(); render(); } else if (a === 'drv-now') await drvBackup(true); else if (a === 'drv-list') await drvList(); else if (a === 'drv-load') await drvLoad(el.dataset.id); }
  catch (err) { console.error(err); }
});
document.addEventListener('change', async e => {
  const id = e.target.id; if (!['drv-auto', 'drv-freq', 'drv-custom', 'drv-notify'].includes(id)) return;
  if (id === 'drv-freq') { S.drv.freq = e.target.value; await drvSavePref(); render(); return; }
  if (id === 'drv-custom') { const n = Math.round(+e.target.value); if (n >= 1 && n <= 90) { S.drv.custom = n; await drvSavePref(); render(); } else { toast('Informe de 1 a 90 dias.'); e.target.value = S.drv.custom; } return; }
  if (id === 'drv-notify') { S.drv.notify = e.target.checked; await drvSavePref(); return; }
  S.drv.auto = e.target.checked; S.drv.failAt = 0; await drvSavePref();
  if (S.drv.auto) { const ok = await drvBackup(true); if (!ok) { S.drv.auto = false; await drvSavePref(); render(); } else toast('Backup programado ligado.'); }
  else toast('Backup programado desligado.');
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(drvAuto, 1500); });
setInterval(drvAuto, 15 * 60000);


/* ================= Perfil (cadastro opcional, só neste aparelho) ================= */
const PF_TYPES = ['MODY', 'Tipo 1', 'Tipo 2', 'Gestacional', 'Outro', 'Prefiro não informar'];
const PF_PHOTO_OK = x => typeof x === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(x) && x.length <= 250000;
const pfClean = p => ({ id: typeof p.id === 'string' && p.id ? p.id.slice(0, 40) : uid(), createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(), name: String(p.name || '').slice(0, 80), birth: /^\d{4}-\d\d-\d\d$/.test(p.birth || '') ? p.birth : '', type: PF_TYPES.includes(p.type) ? p.type : '', team: String(p.team || '').slice(0, 80), photo: PF_PHOTO_OK(p.photo) ? p.photo : '' });
async function pfSave() { try { await Store.put('meta', { id: 'profile', value: S.profile }); } catch (e) { } }
function pfLine() {
  const p = S.profile; if (!p) return '';
  const parts = [p.name && 'Paciente: ' + p.name, p.birth && 'Nascimento: ' + fmtDate(p.birth), p.type && p.type !== 'Prefiro não informar' && 'Diabetes: ' + p.type, p.team && 'Equipe: ' + p.team].filter(Boolean);
  return parts.join('  ·  ');
}
/* ---- avatar (cabeçalho e página do perfil) ---- */
const PF_DEF = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="var(--red-d, #3a1a1c)"/><circle cx="20" cy="15" r="6.5" fill="var(--red)"/><path d="M7 35c1.500-7 6.500-10.500 13-10.500S31.500 28 33 35a20 20 0 0 1-26 0z" fill="var(--red)"/></svg>';
const pfAvatarHTML = () => S.profile && S.profile.photo ? `<img class="pf-img" src="${S.profile.photo}" alt="">` : PF_DEF;
function pfSync() { const b = document.getElementById('pfb'); if (!b) return; b.innerHTML = pfAvatarHTML(); const n = S.profile && S.profile.name; b.setAttribute('aria-label', 'Abrir menu de navegação' + (n ? ' · ' + n : '')); b.title = 'Menu'; }

/* convite discreto na página inicial */
S.pfSnooze = 0;
function pfInvite() {
  const p = S.profile; if ((p && (p.name || p.photo)) || Date.now() < S.pfSnooze) return '';
  return `<div class="pf-inv"><span class="pf-inv-i" aria-hidden="true">${PF_DEF}</span><span class="pf-inv-t"><b>Crie o seu perfil.</b> Uma experiência mais completa, personalizada e organizada, com seus dados e preferências mais fáceis de preservar.</span><span class="pf-inv-b"><button class="btn sm pri" data-act="go" data-r="perfil">Criar</button><button class="pf-x" data-act="pf-snooze" aria-label="Dispensar por 14 dias">×</button></span></div>`;
}
const pfKv = (k, v) => `<div class="row sp" style="gap:12px;padding:7px 0;border-bottom:1px solid var(--line);align-items:flex-start"><span class="dim" style="flex:none">${k}</span><b style="text-align:right;overflow-wrap:anywhere">${v}</b></div>`;
function viewPerfil() {
  const p = S.profile || {}, gp = window.TB_DRV_STATE && TB_DRV_STATE.profile;
  const name = p.name != null && S.profile ? p.name : (gp && gp.name) || '', has = !!S.profile;
  const dtype = p.type && p.type !== 'Prefiro não informar' ? p.type : '';
  const mi2 = (r, t, d) => menuItem(r, t, d);
  const n = { med: S.records.filter(r => !isEx(r)).length, hba: S.hba.filter(x => !isEx(x) && x.source !== 'exame').length, ex: S.exams.length, ins: S.inslog.length, fd: (S.bl.foods || []).length, sv: (S.saved || []).length, rl: (S.bl.rlog || []).length, rm: (S.bl.meals || []).length, pl: plCollect(true).length };
  const ai = aiState(), aiTx = ai === 'ok' ? (window.TB_AI ? 'Configurada' : 'Ativa (Claude)') : ai === 'notcfg' ? 'Não configurada' : 'Indisponível aqui';
  const drvTx = S.drv.lastTs ? new Date(S.drv.lastTs).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + (S.drv.lastStatus === 'fail' ? ' (última tentativa falhou)' : '') : 'nenhum ainda';
  return banners() + `<div class="card pf-hd"><button class="pf-big" id="pf-pick" type="button" aria-label="Escolher foto de perfil">${pfAvatarHTML()}<span class="pf-cam" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 8h3l1.500-2h7L17 8h3v11H4zM12 17a3.500 3.500 0 100-7 3.500 3.500 0 000 7z"/></svg></span></button>
    <input type="file" id="pf-photo" accept="image/*" hidden>
    <div class="pf-hn"><b>${esc(name || 'Seu perfil')}</b><span class="hint" style="margin:0">${dtype ? 'Diabetes ' + esc(dtype === 'Outro' ? 'outros' : dtype) : 'Tipo de diabetes não informado'}</span>
    <span class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn sm" type="button" data-act="pf-pick">${p.photo ? 'Trocar foto' : 'Adicionar foto'}</button>${p.photo ? '<button class="btn sm" type="button" data-act="pf-nophoto">Remover foto</button>' : ''}</span></div></div>
  <p class="hint" id="pf-msg" role="status" style="margin:8px 2px 0"></p>
  <h2 class="sec">Informações pessoais</h2><div class="card"><form id="pf-form" class="stack" style="gap:12px">
    <div class="field"><label class="fl" for="pf-name">Nome</label><input class="in" id="pf-name" autocomplete="off" maxlength="80" value="${esc(name)}"></div>
    <div class="field"><label class="fl" for="pf-birth">Data de nascimento (opcional)</label><input class="in" id="pf-birth" type="date" max="${isoDate(new Date())}" value="${esc(p.birth || '')}"></div>
    <div class="field"><label class="fl" for="pf-team">Médico ou equipe de saúde (opcional)</label><input class="in" id="pf-team" autocomplete="off" maxlength="80" value="${esc(p.team || '')}"></div>
    <button class="btn pri full" type="submit">Salvar</button></form>
    <p class="hint" style="margin:10px 0 0">Ficam só neste aparelho e no seu backup. Aparecem no cabeçalho dos relatórios para o médico e não mudam nenhum cálculo.</p></div>
  <h2 class="sec">Diabetes</h2><div class="card"><div class="field"><label class="fl" for="pf-type">Tipo de diabetes</label><select class="in" id="pf-type"><option value="">Não informado</option>${PF_TYPES.map(t => `<option value="${esc(t)}" ${p.type === t ? 'selected' : ''}>${t === 'Outro' ? 'Outros' : esc(t)}</option>`).join('')}</select></div>
    <p class="hint" style="margin:10px 0 0">Mudar aqui atualiza também o Meu tratamento e os relatórios.</p>
    <div class="stack" style="margin-top:12px"><button class="btn full" data-act="go" data-r="esquemas">Abrir Meu tratamento</button><button class="btn full" data-act="go" data-r="bolus">Minha razão insulina/carboidratos</button></div></div>
  <h2 class="sec">Preferências</h2><div class="stack">${mi2('aparencia', 'Aparência', 'Tema claro, escuro ou automático e tamanho da tela')}${mi2('alertasp', 'Alertas personalizados', 'Avisos ligados a marcações como Dia de perna e à glicemia')}${mi2('lembretes', 'Alertas e notificações', 'Avisos, lembretes de horário e silêncio noturno')}${mi2('config', 'Configurações', 'Meta de HbA1c, faixas e demais ajustes')}${VIEWS.ia ? mi2('ia', 'Inteligência artificial', 'Provedor e chave de IA') : ''}</div>
  <h2 class="sec">Dados da conta</h2><div class="card">${pfKv('Perfil criado em', has ? fmtDate(isoDate(new Date(p.createdAt))) : 'ainda não criado')}${has ? pfKv('Identificador', esc(String(p.id).slice(0, 8))) : ''}${pfKv('Plataforma', IS_NATIVE ? 'Aplicativo Android' : 'Versão web')}${gp && gp.email ? pfKv('Conta Google', esc(gp.email)) : ''}${pfKv('IA', aiTx)}${pfKv('Medições de glicemia', n.med)}${pfKv('Resultados de HbA1c', n.hba)}${pfKv('Exames', n.ex)}${pfKv('Registros de insulina', n.ins)}${pfKv('Lembretes do tratamento', n.pl)}${pfKv('Alimentos cadastrados', n.fd)}${pfKv('Refeições salvas e feitas', n.sv + n.rm)}${pfKv('Registros da razão', n.rl)}
    <p class="hint" style="margin:10px 0 0">Tudo o que você registra neste aparelho (medições, exames, tratamento, alimentos, bolus, IA, notificações e preferências) pertence a este perfil, é guardado no banco local e vai junto no backup. As atualizações do app não apagam esses dados.</p></div>
  <h2 class="sec">Privacidade e segurança</h2><div class="card"><p class="hint" style="margin:0 0 10px">Bloqueio por PIN, biometria, armazenamento persistente e apagar o perfil estão em Segurança e privacidade.</p><div class="stack"><button class="btn full" data-act="go" data-r="seguranca">Bloqueio e proteção</button><button class="btn full" data-act="go" data-r="privacidade">Privacidade e armazenamento</button></div></div>
  <h2 class="sec">Dados e backups</h2><div class="card">${pfKv('Último backup (arquivo)', S.lastBackup ? new Date(S.lastBackup).toLocaleDateString('pt-BR') : 'nenhum ainda')}${pfKv('Último backup no Drive', drvTx)}${pfKv('Backup programado', S.drv.auto ? 'ligado' : 'desligado')}
    <div class="stack" style="margin-top:12px"><button class="btn pri full" data-act="go" data-r="backup">Backup, restauração e Google Drive</button></div></div>`;
}
/* foto: recorta o centro em quadrado, reduz para 256 px e guarda como JPEG */
function pfPhotoFrom(file) {
  return new Promise((ok, no) => {
    if (!file || !/^image\//.test(file.type)) return no(new Error('Escolha um arquivo de imagem.'));
    const fr = new FileReader(); fr.onerror = () => no(new Error('Não consegui ler a imagem.'));
    fr.onload = () => { const im = new Image(); im.onerror = () => no(new Error('Não consegui abrir essa imagem.')); im.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), m = Math.min(im.width, im.height);
      g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); g.drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, 256, 256);
      const u = c.toDataURL('image/jpeg', 0.82); PF_PHOTO_OK(u) ? ok(u) : no(new Error('A imagem ficou grande demais.')); }; im.src = fr.result; };
    fr.readAsDataURL(file);
  });
}
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'pf-photo') { const f = t.files && t.files[0]; t.value = ''; if (!f) return; try { const u = await pfPhotoFrom(f); S.profile = pfClean({ ...(S.profile || {}), photo: u }); await pfSave(); render(); toast('Foto atualizada.'); } catch (err) { const m = document.getElementById('pf-msg'); if (m) m.textContent = err.message; toast(err.message); } return; }
  if (t.id === 'pf-type') { S.profile = pfClean({ ...(S.profile || {}), type: t.value }); await pfSave(); render(); toast(t.value ? 'Tipo de diabetes atualizado.' : 'Tipo de diabetes removido.'); }
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'pf-form') return; e.preventDefault();
  const v = id => document.getElementById(id).value.trim();
  S.profile = pfClean({ ...(S.profile || {}), name: v('pf-name'), birth: v('pf-birth'), team: v('pf-team') }); await pfSave(); render(); toast('Perfil salvo.');
});
document.addEventListener('click', async e => {
  const el = e.target.closest('#pf-pick,[data-act="pf-pick"],[data-act="pf-nophoto"],[data-act="pf-clear"],[data-act="pf-snooze"],[data-act="pf-persist"]'); if (!el) return;
  const a = el.dataset.act || 'pf-pick';
  if (a === 'pf-pick') { const i = document.getElementById('pf-photo'); if (i) i.click(); }
  else if (a === 'pf-nophoto') { S.profile = pfClean({ ...S.profile, photo: '' }); await pfSave(); render(); toast('Foto removida.'); }
  else if (a === 'pf-snooze') { S.pfSnooze = Date.now() + 14 * 86400000; try { await Store.put('meta', { id: 'profile-invite', value: S.pfSnooze }); } catch (x) { } render(); }
  else if (a === 'pf-persist') { await askPersist(); render(); toast(S.persisted ? 'Armazenamento persistente ativo.' : 'O navegador não confirmou. Seus dados continuam salvos.'); }
  else { S.profile = null; try { await Store.put('meta', { id: 'profile', value: null }); } catch (x) { } toast('Perfil apagado.'); render(); }
});

/* ================= Escala da tela (acessibilidade) ================= */
const SCALES = [[1, 'Padrão'], [1.15, 'Grande'], [1.3, 'Maior'], [1.5, 'Máximo']];
S.scale = 1;
const scaleOk = v => v <= 1.3 || window.innerWidth / v >= 300; /* em telas estreitas só os níveis que cabem, para nada ficar desconfigurado */
const BASE_ZOOM = (() => { try { return parseFloat(getComputedStyle(document.documentElement).zoom) || 1; } catch (e) { return 1; } })();
function applyScale() { try { const v = scaleOk(S.scale) ? S.scale : 1.3; document.documentElement.style.zoom = v === 1 ? '' : String(+(BASE_ZOOM * v).toFixed(4)); } catch (e) { } }
function scaleCard() {
  return `<h2 class="sec">Tamanho da tela</h2><div class="card" style="margin-bottom:12px"><p class="hint" style="margin:0 0 10px">Aumenta textos e botões para enxergar melhor. “Padrão” é o tamanho original do app.</p><div class="seg" role="group" aria-label="Tamanho da tela" style="display:flex">${SCALES.filter(([v]) => scaleOk(v)).map(([v, t]) => `<button class="grow" data-act="scale" data-v="${v}" aria-pressed="${S.scale === v}">${t}<br><small>${Math.round(v * 100)}%</small></button>`).join('')}</div></div>`;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act="scale"]'); if (!el) return;
  const v = +el.dataset.v; if (!SCALES.some(x => x[0] === v)) return;
  S.scale = v; applyScale(); try { await Store.put('meta', { id: 'ui-scale', value: v }); } catch (x) { } render();
});

/* ================= Configurações (tudo que o usuário pode ajustar) ================= */
function viewConfig() {
  const link = (r, t, d) => `<button class="menu-item" data-act="go" data-r="${r}">${MI[r] ? `<i class="mi-ic"><svg viewBox="0 0 24 24">${MI[r]}</svg></i>` : ''}<div>${t}<span>${d}</span></div><svg class="chv" viewBox="0 0 24 24">${IC.chev}</svg></button>`;
  return banners() + themeCard() + scaleCard() + swipeCard() + `
  <h2 class="sec">Metas e limites</h2><div class="card"><div class="stack" style="gap:14px">
    <div class="row" style="align-items:flex-end"><div class="field grow"><label class="fl" for="a1c-t">Meta de HbA1c (%)</label><input class="in" id="a1c-t" inputmode="decimal" value="${numAttr(S.a1cT)}"></div><button class="btn pri" data-act="a1c-save">Salvar</button></div>
    <div class="row sp"><span><b>Limite da insulina do jantar</b><br><span class="dim" style="font-size:14px">Hoje: ${S.ins.dinnerMin} mg/dL (definido por você e seu médico)</span></span><button class="btn sm" data-act="ins-min">Alterar</button></div>
    <div class="field"><label class="fl" for="rule-n">Medições usadas na classificação (últimas)</label><input class="in" id="rule-n" inputmode="numeric" value="${S.ruleN || 180}"></div>
  </div></div>
  <h2 class="sec">Outras configurações</h2><div class="stack">${link('perfil', 'Perfil', 'Nome, nascimento, tipo de diabetes e equipe de saúde')}${link('alertasp', 'Alertas personalizados', 'Avisos ligados a marcações como Dia de perna e à glicemia')}${link('lembretes', 'Alertas e notificações', 'Chaves de cada aviso, lembretes de horário e silêncio noturno')}${link('bolus', 'Cálculo de bolus', 'Razão insulina/carboidrato, alimentos e refeições')}${VIEWS.ia ? link('ia', 'Inteligência artificial', 'Provedor, modelo e chave da API') : ''}${link('backup', 'Backup e dados', 'Backup manual, Google Drive e restauração')}${link('esquemas', 'Esquemas de tratamento', 'Insulinas e horários do tratamento')}</div>`;
}


/* ================= Enviar ao meu médico (compartilhar) ================= */
/* O app não envia nada sozinho: abre o menu de compartilhar do aparelho (ou links de WhatsApp/Telegram) e o usuário escolhe o destino. */
async function shareFile(name, data, mime) {
  try {
    const f = new File([data], name, { type: mime || (name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream') });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: 'Resumo de glicemia (TiaBete)', text: 'Resumo de glicemia gerado pelo TiaBete.' }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return false; }
  if (!IS_NATIVE) toast('Este aparelho não abriu o menu de compartilhar. O PDF será salvo para você anexar à mensagem.');
  return await saveFile(name, data);
}
async function outFile(name, data) { if (S._share) { S._share = false; return shareFile(name, data); } return saveFile(name, data); }
function shareText() {
  const r = S.rep; if (!r.from) { r.to = isoDate(new Date()); r.from = isoDate(new Date(addDays(Date.now(), -29))); }
  const recs = inRange(S.records.filter(x => !isEx(x)), mkTs(r.from, '00:00'), endOfDay(mkTs(r.to, '00:00'))), st = stats(recs);
  if (!st.n) return '';
  const lab = [...S.hba].reverse().find(x => !isEx(x) && x.source !== 'estimativa' && x.value != null);
  return ['Resumo de glicemia (TiaBete)', `Período: ${fmtDate(r.from)} a ${fmtDate(r.to)}`, `${st.n} medições · média ${fn(st.mean, 0)} mg/dL · mínima ${fn(st.min, 0)} · máxima ${fn(st.max, 0)}`, `Abaixo de ${LIM.low}: ${st.hypo} · acima da faixa: ${st.hyper}`, lab ? `Última HbA1c de laboratório: ${fn(lab.value, 1)}% (${fmtDate(lab.date)})` : '', 'Dados de acompanhamento pessoal; não é diagnóstico nem indicação de tratamento.'].filter(Boolean).join('\n');
}
function shareSheet() {
  const t = shareText(), q = encodeURIComponent(t), canNative = !!navigator.share || IS_NATIVE, r = S.rep;
  openSheet(`<h2>Enviar ao meu médico</h2><p class="hint" style="margin:0 0 12px">O TiaBete não envia nada sozinho: você escolhe o destino e confere a mensagem antes. Ao compartilhar, dados de saúde saem deste aparelho.</p>
  ${t ? `<label class="fl" for="sh-text">Texto do resumo (${fmtDate(r.from)} a ${fmtDate(r.to)})</label><textarea class="in" id="sh-text" style="min-height:140px;font-size:14.5px" readonly>${esc(t)}</textarea>` : '<p class="hint">Não há medições no período escolhido em Relatórios. O PDF de resumo ainda pode ser enviado.</p>'}
  <div class="stack" style="margin-top:12px">
  <button class="btn pri full" data-act="sh-pdf-sum">Compartilhar PDF · resumo para a consulta</button>
  <button class="btn full" data-act="sh-pdf-rep" ${t ? '' : 'disabled'}>Compartilhar PDF · relatório do período</button>
  ${t ? `${canNative ? '<button class="btn full" data-act="sh-native">Compartilhar texto…</button>' : ''}<a class="btn full" style="text-align:center;text-decoration:none" href="https://wa.me/?text=${q}" target="_blank" rel="noopener">Enviar texto pelo WhatsApp</a>
    <button class="btn full" data-act="sh-copy">Copiar texto (para e-mail ou outro app)</button>` : ''}
  <button class="btn full" data-act="close">Fechar</button></div>
  <p class="hint" style="margin:12px 0 0">Se o menu de compartilhar do aparelho não abrir, o PDF é salvo e você o anexa à mensagem. O WhatsApp recebe só o texto; para enviar o PDF, use “Compartilhar PDF”.</p>`);
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act^="sh-"]'); if (!el) return; const a = el.dataset.act;
  if (a === 'sh-open') shareSheet();
  else if (a === 'sh-pdf-sum') { closeSheet(); S._share = true; try { await makeSummaryPDF(); } finally { S._share = false; } }
  else if (a === 'sh-pdf-rep') { closeSheet(); S._share = true; try { await makePDF(); } finally { S._share = false; } }
  else if (a === 'sh-native') { try { const P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share; if (IS_NATIVE && P) await P.share({ title: 'Resumo de glicemia (TiaBete)', text: shareText(), dialogTitle: 'Enviar resumo' }); else await navigator.share({ title: 'Resumo de glicemia (TiaBete)', text: shareText() }); } catch (err) { } }
  else if (a === 'sh-copy') { const t = shareText(); try { await navigator.clipboard.writeText(t); toast('Texto copiado.'); } catch (err) { const ta = $('#sh-text'); if (ta) { ta.focus(); ta.select(); } toast('Selecione o texto e copie.'); } }
});

/* ---- Segurança e privacidade (movidos do Backup e do Perfil; mesmas funções) ---- */
function viewSeguranca() { return banners() + secCard(); }
function viewPrivacidade() {
  const has = !!S.profile;
  return banners() + `<h2 class="sec">Privacidade e armazenamento</h2><div class="card"><p class="hint" style="margin:0 0 10px">Seus dados ficam no aparelho. Não há conta no TiaBete nem rastreamento. Eles só saem do aparelho quando você usa a IA (o trecho enviado) ou o Google Drive (o seu backup, na sua conta).${IS_NATIVE ? ' A chave da IA é guardada cifrada.' : ''} Para proteger o acesso, use o bloqueio por PIN (Bloqueio e proteção) ou o bloqueio de tela do aparelho.</p>
    <p class="hint" style="margin:0 0 10px">Armazenamento persistente: <b>${S.persisted ? 'ativo' : 'não confirmado'}</b>. Ele reduz o risco de o navegador apagar os dados por falta de espaço.</p>
    <div class="stack"><button class="btn full" data-act="pf-persist">Pedir armazenamento persistente</button>${has ? '<button class="btn full" data-act="pf-clear">Apagar meu perfil (nome e foto) deste aparelho</button>' : ''}</div>
    <p class="hint" style="margin:10px 0 0">Apagar o perfil não apaga medições nem outros registros. Para apagar tudo, use Backup e dados → Apagar dados.</p></div>`;
}
