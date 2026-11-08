/* ================= Exames laboratoriais: envio, avaliação e comparação ================= */
const PDFJS_V = '3.11.174';
S.exams = [];
S.ex = { queue: [], busy: false, id: null, sel: null, narr: {}, narrBusy: false, paste: false };

const FLAG_UI = {
  normal: { c: 'ok', g: '✓', t: 'Dentro da faixa' }, baixo: { c: 'low', g: '▼', t: 'Abaixo' },
  alto: { c: 'high', g: '▲', t: 'Acima' }, indeterminado: { c: '', g: '?', t: 'Sem faixa' }
};
const flagBadge = f => { const u = FLAG_UI[f] || FLAG_UI.indeterminado; return `<span class="badge ${u.c}">${u.g} ${u.t}</span>`; };
const exLabel = e => (e.title && e.title !== 'Exame' ? e.title : 'Exame') + (e.lab ? ' · ' + e.lab : '');
const fnum = (v, d = 2) => v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: d });
const scoreTxt = s => s ? fnum(s.score, 1) : '—';
const exSorted = () => [...S.exams].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.addedAt || 0) - (a.addedAt || 0));

/* ---------- acesso ao Claude (capacidade "sample") ---------- */
async function getSample() { try { return window.claude && window.claude.use ? await window.claude.use('sample') : null; } catch (e) { return null; } }
function sampleErrMsg(e) {
  const c = e && e.code;
  if (c === 'not_granted' || c === 'sampling_disabled' || c === 'not_declared' || c === 'capability_disabled' || c === 'capability_removed') return 'O Claude não está liberado para este app (a permissão foi negada ou não existe neste visualizador).';
  if (c === 'rate_limited') return 'Muitas consultas seguidas. Aguarde um pouco e tente de novo.';
  if (c === 'prompt_too_large') return 'O exame é grande demais para uma única análise.';
  if (c === 'invalid_json') return 'O Claude respondeu em formato inesperado. Tente de novo.';
  if (c === 'image_rejected' || c === 'images_unavailable') return 'Não consegui enviar as imagens deste exame.';
  if (c === 'session_expired') return 'Sua sessão expirou. Entre de novo no Claude e tente outra vez.';
  return 'Não foi possível analisar agora. Tente de novo em instantes.';
}

/* ---------- leitura do arquivo ---------- */
async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await loadScript(`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_V}/pdf.min.js`);
  const lib = window.pdfjsLib; if (!lib) throw new Error('pdfjs');
  lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_V}/pdf.worker.min.js`;
  return lib;
}
function pageText(content) {
  const its = content.items.filter(i => i.str && i.str.trim() !== '' || i.hasEOL).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width || 0 }));
  its.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = []; let cur = null;
  its.forEach(i => { if (cur && Math.abs(cur.y - i.y) <= 3) cur.p.push(i); else { cur = { y: i.y, p: [i] }; lines.push(cur); } });
  return lines.map(l => { l.p.sort((a, b) => a.x - b.x); let t = '', end = null; l.p.forEach(i => { if (end !== null) t += (i.x - end > 10) ? '   ' : (i.x - end > 1 ? ' ' : ''); t += i.s; end = i.x + i.w; }); return t.trim(); }).filter(Boolean).join('\n');
}
async function extractPdf(file, wantImages) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = Math.min(pdf.numPages, 40); let text = '';
  for (let p = 1; p <= pages; p++) { const pg = await pdf.getPage(p); text += `\n--- página ${p} ---\n` + pageText(await pg.getTextContent()); }
  const useful = text.replace(/--- página \d+ ---/g, '').replace(/\s+/g, '');
  if (useful.length >= 200) return { text, kind: 'pdf-texto', pages, cut: pdf.numPages > pages };
  /* PDF digitalizado (sem texto): renderiza as páginas como imagem */
  if (!wantImages) throw Object.assign(new Error('scan'), { scan: true });
  const imgs = [], max = Math.min(wantImages.maxCount || 4, 8, pdf.numPages);
  for (let p = 1; p <= max; p++) {
    const pg = await pdf.getPage(p), vp = pg.getViewport({ scale: 1.7 }), cv = document.createElement('canvas');
    cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
    await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    imgs.push(await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.82)));
  }
  return { images: imgs, kind: 'pdf-imagem', pages: max, cut: pdf.numPages > max };
}
function redact(t) {
  return t.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF removido]').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail removido]');
}

/* ---------- pedido ao Claude ---------- */
const EXAM_RULES = `Regras:
- Responda SOMENTE com um objeto JSON válido, sem markdown e sem texto fora do JSON.
- Não inclua nome do paciente, CPF, data de nascimento, endereço nem outros dados pessoais.
- Não invente nada. Se um dado não estiver legível ou não constar no laudo, use null (ou omita o item).
- Não faça diagnóstico, não indique medicamentos, doses nem mudanças de tratamento. Use linguagem prudente ("pode estar associado a", "vale conversar com seu médico").
- Texto em português do Brasil, simples, para uma pessoa leiga.`;
function examPrompt(text) {
  return `Você lê laudos de exames laboratoriais para uma pessoa adulta que acompanha o diabetes no app TiaBete.
Leia o laudo ${text ? 'abaixo' : 'nas imagens anexas'} e devolva este JSON:
{"date":"AAAA-MM-DD da coleta ou null","lab":"laboratório ou null","title":"nome curto do exame ou conjunto (ex.: Check-up, Lipidograma)",
"items":[{"name":"nome como está no laudo","canonical":"nome padrão curto, minúsculo, sem acento (ex.: glicemia de jejum, hemoglobina glicada, colesterol ldl, creatinina, tsh)","value":número ou null,"text":"resultado em texto quando não for numérico (ex.: Negativo) ou \\"\\"","unit":"unidade","refLow":limite inferior numérico da referência do próprio laudo ou null,"refHigh":limite superior numérico ou null,"refText":"referência como impressa","flag":"normal|baixo|alto|indeterminado","context":"até 2 frases: o que o exame mede e o que este resultado significa, só para itens fora da referência ou importantes no diabetes (glicemia, hemoglobina glicada, lipídios, função renal, microalbuminúria, TSH, vitamina B12); para os demais use \\"\\""}],
"summary":"leitura geral em 3 a 5 frases","attention":["até 5 pontos que merecem conversa com o médico"],"questions":["até 5 perguntas úteis para levar à consulta"]}
Detalhes: "value" deve ser número com ponto decimal. Para referência do tipo "< 100", use refHigh=100 e refLow=null. Para "desejável < 200" use esse limite e coloque o texto completo em refText. Inclua todos os resultados do laudo (até 80 itens). Mantenha cada "context" curto.
${EXAM_RULES}
${text ? '\nLAUDO:\n' + text : ''}`;
}
async function analyzeExam(src, signal) {
  const sample = await getSample(); if (!sample) throw { code: 'not_declared' };
  const opts = { modelTier: 'default', cache: false, signal };
  if (src.images) opts.images = src.images;
  const raw = await sample.json(examPrompt(src.text ? redact(src.text).slice(0, 150000) : ''), opts);
  return cleanExam(raw);
}

/* ---------- fila de envio ---------- */
function setQ(q, patch) { Object.assign(q, patch); if (S.route === 'exames') render(); }
async function processExamFile(file, q) {
  try {
    const sample = await getSample();
    if (!sample) { setQ(q, { st: 'erro', msg: 'O Claude não está disponível neste visualizador, então não consigo analisar o exame.' }); return; }
    let lim = null; try { lim = (await sample.limits()).images || null; } catch (e) { }
    let src, hash;
    const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
    setQ(q, { st: 'lendo', msg: 'Lendo o arquivo…' });
    if (isPdf) {
      try { src = await extractPdf(file, lim); }
      catch (e) {
        if (e && e.scan) { setQ(q, { st: 'erro', msg: 'Este PDF é digitalizado (sem texto) e este visualizador não aceita imagens. Envie uma foto do laudo ou cole o texto.' }); return; }
        console.error(e); setQ(q, { st: 'erro', msg: 'Não consegui abrir este PDF. Se ele tiver senha, remova-a. Você também pode colar o texto do laudo.' }); return;
      }
    } else if (/^image\//.test(file.type)) {
      if (!lim) { setQ(q, { st: 'erro', msg: 'Este visualizador não aceita imagens. Envie o PDF ou cole o texto.' }); return; }
      if (!lim.mediaTypes.includes(file.type)) { setQ(q, { st: 'erro', msg: 'Formato de imagem não aceito. Use JPEG, PNG, WebP ou GIF.' }); return; }
      if (file.size > lim.maxInputBytes) { setQ(q, { st: 'erro', msg: 'Imagem grande demais.' }); return; }
      src = { images: [file], kind: 'imagem', pages: 1 };
    } else { setQ(q, { st: 'erro', msg: 'Envie um PDF ou uma imagem do exame.' }); return; }
    hash = src.text ? hashText(src.text) : hashText(file.name + '|' + file.size + '|' + file.lastModified);
    if (S.exams.some(e => e.hash === hash)) { setQ(q, { st: 'dup', msg: 'Este exame já foi enviado antes.' }); return; }
    setQ(q, { st: 'analisando', msg: 'O Claude está avaliando o exame…' });
    const ex = await analyzeExam(src);
    if (!ex.items.length) { setQ(q, { st: 'erro', msg: 'Não encontrei resultados de exame neste arquivo.' }); return; }
    const rec = { id: uid(), addedAt: Date.now(), hash, fileName: file.name, source: src.kind, ...ex };
    await Store.put('exams', rec); await loadAll();
    setQ(q, { st: 'ok', msg: ex.items.length + ' itens lidos.', exId: rec.id, warn: src.cut ? 'Só as primeiras páginas foram lidas.' : (ex.date ? '' : 'Não encontrei a data da coleta. Informe-a no exame para poder comparar.') });
  } catch (e) { console.error(e); setQ(q, { st: 'erro', msg: sampleErrMsg(e) }); }
}
async function processExamText(text) {
  const q = { name: 'Texto colado', st: 'analisando', msg: 'O Claude está avaliando o exame…' }; S.ex.queue.unshift(q); render();
  try {
    const hash = hashText(text);
    if (S.exams.some(e => e.hash === hash)) { setQ(q, { st: 'dup', msg: 'Este exame já foi enviado antes.' }); return; }
    const ex = await analyzeExam({ text });
    if (!ex.items.length) { setQ(q, { st: 'erro', msg: 'Não encontrei resultados de exame neste texto.' }); return; }
    const rec = { id: uid(), addedAt: Date.now(), hash, fileName: 'Texto colado', source: 'texto-colado', ...ex };
    await Store.put('exams', rec); await loadAll(); setQ(q, { st: 'ok', msg: ex.items.length + ' itens lidos.', exId: rec.id, warn: ex.date ? '' : 'Informe a data da coleta no exame para poder comparar.' });
  } catch (e) { console.error(e); setQ(q, { st: 'erro', msg: sampleErrMsg(e) }); }
}
async function handleExamFiles(files) {
  if (S.ex.busy) { toast('Aguarde o envio atual terminar.'); return; }
  const list = [...files].slice(0, 12); if (!list.length) return;
  if (hasExamples() === false) { /* nada */ }
  S.ex.queue = list.map(f => ({ name: f.name, st: 'fila', msg: 'Na fila' })); S.ex.busy = true; render();
  for (let i = 0; i < list.length; i++) await processExamFile(list[i], S.ex.queue[i]);
  S.ex.busy = false; if (S.route === 'exames') render();
}

/* ---------- telas ---------- */
const QST = { fila: '…', lendo: '…', analisando: '…', ok: '✓', dup: '=', erro: '!' };
function queueHTML() {
  if (!S.ex.queue.length) return '';
  return `<div class="stack" style="margin-top:12px" aria-live="polite">${S.ex.queue.map(q => `<div class="card soft" style="padding:12px 14px"><div class="row sp" style="gap:10px"><span style="min-width:0;overflow-wrap:anywhere"><b>${QST[q.st] || ''} ${esc(q.name)}</b><br><span class="dim" style="font-size:12.5px">${esc(q.msg || '')}${q.warn ? ' ' + esc(q.warn) : ''}</span></span>${q.exId ? `<button class="btn sm" data-act="ex-open" data-id="${q.exId}">Abrir</button>` : ''}</div></div>`).join('')}</div>`;
}
function examCard(e) {
  const sc = examScore(e.items), bd = examBand(sc && sc.score), out = e.items.filter(i => i.flag === 'alto' || i.flag === 'baixo').length;
  return `<button class="rec" style="grid-template-columns:1fr auto" data-act="ex-open" data-id="${e.id}"><span class="info"><span class="num">${e.date ? fmtDate(e.date) : 'Sem data'}</span><span style="font-weight:700;overflow-wrap:anywhere">${esc(exLabel(e))}</span><span class="chips">${e.date ? '' : '<span class="tag warn">Informe a data</span>'}<span class="tag">${e.items.length} itens</span>${out ? `<span class="tag warn">${out} fora da referência</span>` : '<span class="tag">nenhum fora da referência</span>'}</span></span><span class="gl num">${scoreTxt(sc)}<small>${sc ? 'de 10' : 'sem nota'}</small></span></button>`;
}
function exMatch(e, q) {
  if (!q) return true;
  const hay = norm([e.lab, e.title, e.date ? fmtDate(e.date) : '', e.date, e.summary, (e.attention || []).join(' '), (e.questions || []).join(' '), ...e.items.map(i => [i.name, i.value != null ? fnum(i.value) : '', i.text, i.unit, i.flag === 'alto' ? 'alto acima' : i.flag === 'baixo' ? 'baixo abaixo' : ''].join(' '))].join(' '));
  return q.split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}
function exListHTML() {
  const q = norm(S.ex.q || '').trim(), list = exSorted().filter(e => exMatch(e, q));
  if (!list.length) return `<div class="card">${emptyBlock('Nada encontrado', 'Tente outro termo: nome do exame, laboratório, data ou resultado.')}</div>`;
  return (q ? `<p class="hint" style="margin:0 2px 8px"><span class="num">${list.length}</span> exame${list.length === 1 ? '' : 's'} encontrado${list.length === 1 ? '' : 's'}</p>` : '') + `<div class="stack">${list.map(examCard).join('')}</div>`;
}
function viewExames() {
  const dated = S.exams.filter(e => e.date).length;
  let h = banners();
  h += `<p class="hint" style="margin:0 0 12px">Envie seus exames de laboratório em <b>PDF</b> (ou foto). O Claude lê cada um, compara com a referência impressa no próprio laudo, dá uma <b>nota de 0 a 10</b> e explica o contexto. Depois você pode comparar os exames entre si.</p>
  ${lastExamBox()}<div style="height:12px"></div>
  <input type="file" id="ex-file" accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,image/gif" multiple hidden>
  <div class="stack"><button class="btn pri full" data-act="ex-pick" ${S.ex.busy ? 'disabled' : ''}>Enviar exames (PDF ou foto)</button>
  <button class="btn full" data-act="ex-paste" ${S.ex.busy ? 'disabled' : ''}>Colar o texto de um laudo</button></div>`;
  if (S.ex.paste) h += `<div class="card" style="margin-top:12px"><label class="fl" for="ex-text">Cole aqui o texto do laudo</label><textarea class="in" id="ex-text" style="min-height:160px" placeholder="Copie o texto do site do laboratório ou do PDF e cole aqui"></textarea><div class="row" style="margin-top:10px"><button class="btn pri grow" data-act="ex-paste-go">Analisar</button><button class="btn" data-act="ex-paste">Cancelar</button></div></div>`;
  h += queueHTML();
  h += `<div class="card soft" style="margin-top:12px;border-style:dashed"><p class="hint" style="margin:0"><b>Privacidade.</b> Ao analisar, o texto do exame (sem CPF nem e-mail) é enviado ao Claude da sua conta, depois de você autorizar. Os resultados ficam salvos só neste navegador; o PDF em si não é guardado. A análise é educativa, <b>não é diagnóstico</b> e não indica tratamento. Confira sempre com o laudo original e converse com seu médico.</p></div>`;
  h += `<h2 class="sec">Meus exames</h2>`;
  if (!S.exams.length) h += `<div class="card">${emptyBlock('Nenhum exame ainda', 'Envie um PDF para começar. Cada exame aparece aqui com a nota e a data.')}</div>`;
  else {
    if (dated >= 2) h += `<button class="btn pri full" style="margin-bottom:12px" data-act="go" data-r="comparar">Comparar exames</button>`;
    else h += `<p class="hint" style="margin:0 0 12px">Com dois ou mais exames datados, o botão de comparação aparece aqui.</p>`;
    h += `<input class="in" id="ex-q" type="search" placeholder="Buscar exame, laboratório, data ou resultado…" value="${esc(S.ex.q || '')}" aria-label="Buscar exames" style="margin-bottom:12px"><div id="ex-list">${exListHTML()}</div>`;
  }
  return h;
}

function itemRow(it) {
  const val = it.value != null ? `<b class="num">${fnum(it.value)}</b> <span class="dim">${esc(it.unit)}</span>` : `<b>${esc(it.text || '—')}</b>`;
  const ref = it.refText || (it.refLow != null || it.refHigh != null ? `${it.refLow != null ? fnum(it.refLow) : ''}–${it.refHigh != null ? fnum(it.refHigh) : ''}` : '');
  return `<div class="exi"><div class="row sp" style="gap:10px;align-items:flex-start"><span style="min-width:0;overflow-wrap:anywhere"><span style="font-weight:700">${esc(it.name)}</span><br>${val}</span>${flagBadge(it.flag)}</div>${ref ? `<div class="dim" style="font-size:12px;margin-top:4px">Referência do laudo: ${esc(ref)}</div>` : ''}${it.note ? `<div class="exn">${esc(it.note)}</div>` : ''}</div>`;
}
function viewExame() {
  const e = S.exams.find(x => x.id === S.ex.id);
  if (!e) return `<div class="card">${emptyBlock('Exame não encontrado', 'Volte à lista de exames.', '<br><br><button class="btn" data-act="go" data-r="exames">Ver exames</button>')}</div>`;
  const sc = examScore(e.items), bd = examBand(sc && sc.score);
  const bad = e.items.filter(i => i.flag === 'alto' || i.flag === 'baixo'), good = e.items.filter(i => i.flag === 'normal'), nf = e.items.filter(i => i.flag === 'indeterminado');
  let h = `<div class="card red"><div class="eyebrow">${e.date ? fmtDate(e.date) : 'Data não identificada'}${e.lab ? ' · ' + esc(e.lab) : ''}</div><div style="font-weight:700;margin:6px 0 0;overflow-wrap:anywhere">${esc(e.title)}</div>
    <div class="hero-n num" style="font-size:54px;margin:10px 0 2px">${scoreTxt(sc)}<small>${sc ? 'nota de 0 a 10' : 'sem nota'}</small></div>
    <div style="font-weight:700">${bd.label}</div>
    <p class="hint" style="margin:6px 0 0">${sc ? `${sc.ok} de ${sc.n} itens avaliados estão dentro da referência do laudo${sc.out ? `; ${sc.out} fora` : ''}.` : 'São necessários ao menos 3 itens com referência para calcular a nota.'}</p>
    <div class="row" style="margin-top:12px"><button class="btn sm" data-act="ex-edit" data-id="${e.id}">${e.date ? 'Editar dados' : 'Informar a data'}</button><button class="btn sm" data-act="go" data-r="comparar">Comparar</button></div></div>
  <details class="more" style="margin-top:10px"><summary>Como a nota é calculada</summary><p class="hint" style="margin:0 0 14px">Cada item com número e referência impressa no laudo vale de 0 a 1: dentro da faixa vale 1; fora, perde pontos conforme o afastamento em relação ao limite (um item 30% acima do limite vale 0,7). A nota é a média disso vezes 10. Itens sem faixa numérica entram só se o laudo os marcou como normais (1) ou alterados (0,5). É um resumo prático, não uma nota clínica: faixas de referência variam entre laboratórios e pessoas.</p></details>`;
  if (e.summary) h += `<h2 class="sec">Leitura geral</h2><div class="card"><p style="margin:0;overflow-wrap:anywhere">${esc(e.summary)}</p><p class="hint" style="margin:10px 0 0">Texto gerado pelo Claude a partir do laudo. Pode conter erros: confira com o original.</p></div>`;
  if (e.attention && e.attention.length) h += `<h2 class="sec">Pontos para conversar com o médico</h2><div class="card"><ul class="plain" style="margin:0">${e.attention.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>`;
  if (bad.length) h += `<h2 class="sec">Fora da referência (${bad.length})</h2><div class="card"><div class="exl">${bad.map(itemRow).join('')}</div></div>`;
  if (good.length) h += `<h2 class="sec">Dentro da referência (${good.length})</h2><div class="card"><div class="exl">${good.map(itemRow).join('')}</div></div>`;
  if (nf.length) h += `<h2 class="sec">Sem faixa para comparar (${nf.length})</h2><div class="card"><div class="exl">${nf.map(itemRow).join('')}</div></div>`;
  if (e.questions && e.questions.length) h += `<h2 class="sec">Perguntas para levar à consulta</h2><div class="card"><ul class="plain" style="margin:0">${e.questions.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>`;
  h += `<p class="hint" style="margin-top:16px">Arquivo: ${esc(e.fileName || '')}. Análise educativa, não é diagnóstico nem indicação de tratamento.</p>`;
  return h;
}
function examForm(e) {
  return `<h2>Dados do exame</h2><form id="ex-form" data-id="${e.id}" novalidate><div class="form-grid">
    <div class="field"><label class="fl" for="xe-d">Data da coleta</label><input class="in" type="date" id="xe-d" value="${e.date || ''}" autofocus></div>
    <div class="field"><label class="fl" for="xe-l">Laboratório</label><input class="in" id="xe-l" value="${esc(e.lab || '')}"></div>
    <div class="field full"><label class="fl" for="xe-t">Nome do exame</label><input class="in" id="xe-t" value="${esc(e.title || '')}"></div></div>
    <p class="err" id="xe-err" role="alert"></p><div class="row"><button class="btn pri grow" type="submit">Salvar</button><button class="btn" type="button" data-act="close">Cancelar</button></div>
    <button class="btn danger full" type="button" style="margin-top:10px" data-act="ex-del-ask" data-id="${e.id}">Excluir exame</button></form>`;
}

/* ---------- gráfico de evolução de um item ---------- */
function trendChart(items, opt = {}) {
  const id = 'c' + (++chartSeq), W = 360, H = 200, L = 40, R = 16, T = 18, B = 24, pw = W - L - R, ph = H - T - B;
  const vals = items.map(i => i.value).concat([opt.refLow, opt.refHigh].filter(v => v != null));
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1; lo -= pad; hi += pad; if (lo < 0 && Math.min(...vals) >= 0) lo = 0;
  let x0 = Math.min(...items.map(i => i.ts)), x1 = Math.max(...items.map(i => i.ts));
  if (x0 === x1) { x0 -= 15 * DAY; x1 += 15 * DAY; } else { const p = (x1 - x0) * 0.06; x0 -= p; x1 += p; }
  const X = t => L + (t - x0) / (x1 - x0) * pw, Y = v => T + ph - (v - lo) / (hi - lo) * ph;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label || 'Evolução')}">`;
  if (opt.refLow != null || opt.refHigh != null) {
    const yt = Y(opt.refHigh != null ? Math.min(opt.refHigh, hi) : hi), yb = Y(opt.refLow != null ? Math.max(opt.refLow, lo) : lo);
    s += `<rect x="${L}" y="${yt}" width="${pw}" height="${Math.max(2, yb - yt)}" fill="var(--red)" opacity=".10"/>`;
    if (opt.refHigh != null) s += `<line x1="${L}" x2="${W - R}" y1="${Y(opt.refHigh)}" y2="${Y(opt.refHigh)}" stroke="var(--mut)" stroke-width=".8" stroke-dasharray="3 3"/>`;
    if (opt.refLow != null) s += `<line x1="${L}" x2="${W - R}" y1="${Y(opt.refLow)}" y2="${Y(opt.refLow)}" stroke="var(--mut)" stroke-width=".8" stroke-dasharray="3 3"/>`;
  }
  niceTicks(lo, hi, 4).forEach(v => { s += `<text class="ax" x="${L - 6}" y="${Y(v) + 3}" text-anchor="end">${fnum(v, 1)}</text>`; });
  const sorted = [...items].sort((a, b) => a.ts - b.ts);
  sorted.forEach((i, k) => { if (sorted.length <= 6 || k % 2 === 0 || k === sorted.length - 1) s += `<text class="ax" x="${X(i.ts)}" y="${H - 7}" text-anchor="middle">${fmtDate(isoDate(new Date(i.ts))).slice(0, 5)}/${String(new Date(i.ts).getFullYear()).slice(2)}</text>`; });
  if (sorted.length > 1) s += `<polyline fill="none" stroke="var(--red)" stroke-width="1.8" stroke-linejoin="round" points="${sorted.map(i => X(i.ts).toFixed(1) + ',' + Y(i.value).toFixed(1)).join(' ')}"/>`;
  const pts = [];
  sorted.forEach(i => { const x = X(i.ts), y = Y(i.value); s += `<circle cx="${x}" cy="${y}" r="4" fill="var(--red)" stroke="var(--s1)" stroke-width="2"/><text class="ax" x="${x}" y="${y - 9}" text-anchor="middle" style="fill:var(--fg);font-size:10.5px">${fnum(i.value, 1)}</text>`; pts.push({ x, y, tip: i.tip }); });
  s += `<line class="xh" x1="0" x2="0" y1="${T}" y2="${T + ph}" stroke="var(--fg)" stroke-width=".8" opacity="0"/><circle class="hl" r="7" fill="none" stroke="var(--fg)" stroke-width="1.4" opacity="0"/></svg>`;
  CHARTS[id] = { pts, W, H, T, ph };
  return `<div class="chart" data-chart="${id}">${s}<div class="tip" hidden></div></div>`;
}
function trendSheet(key) {
  const all = S.exams.filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date)), pts = [];
  let name = key, unit = '', last = null;
  all.forEach(e => { const it = e.items.find(i => i.key === key); if (!it) return; name = it.name; unit = it.unit || unit; if (it.value != null) { pts.push({ ts: mkTs(e.date, '12:00'), value: it.value, tip: `<b>${fnum(it.value)} ${esc(it.unit)}</b><br><span>${fmtDate(e.date)}</span>` }); last = it; } });
  let h = `<h2>${esc(name)}${unit ? ' <span class="dim" style="font-size:13px">(' + esc(unit) + ')</span>' : ''}</h2>`;
  if (pts.length < 2) h += `<p class="hint">São necessários ao menos 2 resultados numéricos para o gráfico.</p>`;
  else h += trendChart(pts, { refLow: last.refLow, refHigh: last.refHigh, label: 'Evolução de ' + name }) + `<p class="hint">A faixa vermelha clara é a referência do exame mais recente. Toque no gráfico para ver cada valor.</p>`;
  h += `<div class="row" style="margin-top:12px"><button class="btn grow" data-act="close">Fechar</button></div>`;
  openSheet(h); attachCharts($('#sheet-bg'));
}

/* ---------- comparação ---------- */
function selIds() {
  const dated = S.exams.filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date));
  if (!S.ex.sel) S.ex.sel = dated.slice(-6).map(e => e.id);
  S.ex.sel = S.ex.sel.filter(id => dated.some(e => e.id === id));
  return S.ex.sel;
}
function cmpKey() { return selIds().slice().sort().join(','); }
const REL = { perto: '↘ mais perto da referência', longe: '↗ mais longe da referência', dentro: '✓ dentro nos dois', igual: '= mesma distância da referência' };
const DIRG = { subiu: '▲ subiu', desceu: '▼ desceu', igual: '= estável' };
function viewComparar() {
  const dated = S.exams.filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date));
  if (dated.length < 2) return banners() + `<div class="card">${emptyBlock('Poucos exames para comparar', 'Envie ao menos dois exames com data.', '<br><br><button class="btn pri" data-act="go" data-r="exames">Enviar exames</button>')}</div>`;
  const ids = selIds(), picked = S.exams.filter(e => ids.includes(e.id));
  let h = banners() + `<p class="hint" style="margin:0 0 10px">Escolha quais exames comparar (os mais antigos à esquerda).</p><div class="pill-row" role="group" aria-label="Exames na comparação">${dated.map(e => `<button class="seg-b ${ids.includes(e.id) ? 'on' : ''}" aria-pressed="${ids.includes(e.id)}" data-act="ex-sel" data-id="${e.id}">${fmtDate(e.date).slice(0, 5)}/${e.date.slice(2, 4)}${e.lab ? ' · ' + esc(e.lab.slice(0, 14)) : ''}</button>`).join('')}</div>`;
  if (picked.length < 2) return h + `<div class="card" style="margin-top:12px">${emptyBlock('Selecione ao menos 2 exames', 'Toque nas datas acima.')}</div>`;
  const C = compareExams(picked);
  h += `<h2 class="sec">Nota por exame</h2><div class="card"><div class="sum" style="grid-template-columns:repeat(${Math.min(C.exams.length, 3)},1fr)">${C.exams.map(e => { const sc = examScore(e.items); return `<div class="tile"><div class="lb">${fmtDate(e.date).slice(0, 5)}/${e.date.slice(2, 4)}</div><div class="v num" style="font-size:28px">${scoreTxt(sc)}</div><div class="sub">${sc ? sc.ok + ' de ' + sc.n + ' dentro' : 'sem nota'}</div></div>`; }).join('')}</div></div>`;
  h += `<h2 class="sec">Itens presentes em mais de um exame (${C.multi.length})</h2>`;
  if (!C.multi.length) h += `<div class="card"><p class="hint" style="margin:0">Nenhum item aparece em mais de um dos exames escolhidos, ou os nomes não coincidem.</p></div>`;
  else h += `<div class="card"><div class="tbl-wrap"><table class="t xt"><thead><tr><th>Item</th>${C.exams.map(e => `<th>${fmtDate(e.date).slice(0, 5)}<small>${e.date.slice(0, 4)}</small></th>`).join('')}<th>Variação</th></tr></thead><tbody>${C.multi.map(r => {
    const cells = r.cells.map(c => !c ? '<td class="dim">—</td>' : `<td>${c.value != null ? fnum(c.value) : esc(c.text || '—')}${c.flag === 'alto' ? ' <span aria-label="acima da referência">▲</span>' : c.flag === 'baixo' ? ' <span aria-label="abaixo da referência">▼</span>' : ''}</td>`).join('');
    const v = r.dir ? `<td class="xv"><b>${DIRG[r.dir]}</b>${r.dir !== 'igual' ? `<small>${fsign(r.delta, Math.abs(r.delta) < 10 ? 2 : 1)}${r.pct != null ? ' (' + fsign(r.pct, 0) + '%)' : ''}</small>` : ''}${r.rel ? `<small>${REL[r.rel]}</small>` : ''}</td>` : '<td class="dim">—</td>';
    return `<tr class="xr" data-act="ex-trend" data-k="${esc(r.key)}" tabindex="0" role="button" aria-label="Ver gráfico de ${esc(r.name)}"><td><b>${esc(r.name)}</b>${r.unit ? `<small>${esc(r.unit)}</small>` : ''}</td>${cells}${v}</tr>`;
  }).join('')}</tbody></table></div><p class="hint" style="margin:10px 0 0">▲ acima e ▼ abaixo da referência do laudo daquela data. Toque numa linha para ver o gráfico com todos os seus exames.</p></div>`;
  if (C.single.length) h += `<details class="more" style="margin-top:12px"><summary>Itens em apenas um exame (${C.single.length})</summary><ul class="plain" style="margin:0 0 14px">${C.single.map(r => { const i = r.cells.findIndex(Boolean), c = r.cells[i]; return `<li><b>${esc(r.name)}</b>: ${c.value != null ? fnum(c.value) + ' ' + esc(c.unit) : esc(c.text)} <span class="dim">(${fmtDate(C.exams[i].date)})</span></li>`; }).join('')}</ul></details>`;
  const nar = S.ex.narr[cmpKey()];
  h += `<h2 class="sec">Leitura comparativa do Claude</h2><div class="card">${nar ? `<div id="ex-narr" style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(nar)}</div><p class="hint" style="margin:10px 0 0">Texto gerado pelo Claude a partir dos números acima. Não é diagnóstico.</p>` : `<p class="hint" style="margin:0 0 12px">Peça ao Claude um resumo do que mudou entre os exames escolhidos e do que vale conversar com o médico.</p><div id="ex-narr" style="white-space:pre-wrap;overflow-wrap:anywhere"></div>`}<button class="btn ${nar ? '' : 'pri'}" style="margin-top:12px" data-act="ex-narr" ${S.ex.narrBusy ? 'disabled' : ''}>${S.ex.narrBusy ? 'Gerando…' : nar ? 'Gerar de novo' : 'Gerar leitura comparativa'}</button></div>`;
  return h;
}
function narrPrompt(C) {
  const rows = C.multi.map(r => `- ${r.name}${r.unit ? ' (' + r.unit + ')' : ''}: ` + r.cells.map((c, i) => c ? `${fmtDate(C.exams[i].date)} = ${c.value != null ? c.value : c.text}${c.refText ? ' [ref ' + c.refText + ']' : ''}` : null).filter(Boolean).join(' → ')).join('\n');
  const sc = C.exams.map(e => { const s = examScore(e.items); return `${fmtDate(e.date)}: nota ${s ? s.score : 'n/d'}`; }).join('; ');
  return `Você ajuda uma pessoa adulta com diabetes a entender a evolução de exames laboratoriais, no app TiaBete.
Abaixo estão os mesmos itens em exames de datas diferentes (cada valor com a referência impressa no laudo). Escreva uma leitura comparativa em português do Brasil, simples, com 2 a 4 parágrafos curtos: o que melhorou, o que piorou, o que ficou estável e o que merece conversa com o médico. Cite os números. Use apenas os dados abaixo.
Regras: não faça diagnóstico, não indique medicamentos, doses nem mudanças de tratamento; use linguagem prudente; não use markdown, listas nem títulos.
Notas calculadas pelo app (0 a 10): ${sc}.
DADOS:
${rows}`;
}
async function genNarrative() {
  const C = compareExams(S.exams.filter(e => selIds().includes(e.id))); if (C.multi.length < 1) { toast('Não há itens em comum para comparar.'); return; }
  const key = cmpKey(); S.ex.narrBusy = true; render();
  try {
    const sample = await getSample(); if (!sample) throw { code: 'not_declared' };
    let last = '';
    const r = await sample(narrPrompt(C), { modelTier: 'default', cache: false, onText: ({ text }) => { last = text; const el = $('#ex-narr'); if (el && S.route === 'comparar') el.textContent = text; } });
    S.ex.narr[key] = (r && r.text || last || '').trim();
    if (!S.ex.narr[key]) delete S.ex.narr[key];
  } catch (e) { console.error(e); toast(sampleErrMsg(e)); }
  S.ex.narrBusy = false; if (S.route === 'comparar') render();
}

/* ---------- eventos ---------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act^="ex-"]'); if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  try {
    switch (act) {
      case 'ex-pick': $('#ex-file').click(); break;
      case 'ex-paste': S.ex.paste = !S.ex.paste; render(); break;
      case 'ex-paste-go': { const t = ($('#ex-text').value || '').trim(); if (t.length < 40) { toast('Cole o texto completo do laudo.'); break; } S.ex.paste = false; await processExamText(t); break; }
      case 'ex-open': closeSheet(); S.ex.id = id; go('exame'); break;
      case 'ex-edit': openSheet(examForm(S.exams.find(x => x.id === id))); break;
      case 'ex-del-ask': el.dataset.act = 'ex-del-do'; el.textContent = 'Toque de novo para excluir'; el.classList.add('pri'); setTimeout(() => { if (el.isConnected && el.dataset.act === 'ex-del-do') { el.dataset.act = 'ex-del-ask'; el.textContent = 'Excluir exame'; el.classList.remove('pri'); } }, 4000); break;
      case 'ex-del-do': await Store.del('exams', id); await loadAll(); S.ex.sel = null; S.ex.narr = {}; closeSheet(); go('exames'); toast('Exame excluído.'); break;
      case 'ex-sel': { const s = selIds(); S.ex.sel = s.includes(id) ? s.filter(x => x !== id) : [...s, id]; render(); break; }
      case 'ex-trend': trendSheet(el.dataset.k); break;
      case 'ex-narr': await genNarrative(); break;
    }
  } catch (err) { console.error(err); toast('Algo deu errado: ' + (err && err.message || err)); }
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('xr')) { e.preventDefault(); trendSheet(e.target.dataset.k); } });
document.addEventListener('change', async e => { if (e.target.id === 'ex-file') { const f = [...e.target.files]; e.target.value = ''; await handleExamFiles(f); } });
document.addEventListener('submit', async e => {
  if (e.target.id !== 'ex-form') return; e.preventDefault();
  try {
    const f = e.target, old = S.exams.find(x => x.id === f.dataset.id); if (!old) return;
    const dv = $('#xe-d').value, d = dv ? parseDate(dv) : '';
    if (dv && !d) { $('#xe-err').textContent = 'Data inválida.'; return; }
    if (d && d > isoDate(new Date())) { $('#xe-err').textContent = 'A data não pode ser futura.'; return; }
    await Store.put('exams', { ...old, date: d || '', lab: $('#xe-l').value.trim(), title: $('#xe-t').value.trim() || 'Exame' });
    await loadAll(); S.ex.sel = null; S.ex.narr = {}; closeSheet(); render(); toast('Exame atualizado.');
  } catch (err) { console.error(err); toast('Não foi possível salvar: ' + (err && err.message || err)); }
});

/* ---------- HbA1c lida dos exames enviados (sincroniza o menu Hemoglobina glicada) ---------- */
const A1C_KEY = /(hemoglobina (glicada|glicosilada)|glico ?hemoglobina|hba ?1 ?c|\ba1c\b)/;
function a1cFromExam(e) {
  if (!e.date) return null;
  const it = e.items.find(i => A1C_KEY.test(i.key || '') && i.value != null);
  if (!it) return null;
  let v = it.value;
  if (/mmol\/mol/i.test(it.unit || '')) v = v * 0.09148 + 2.152;   /* IFCC -> NGSP (%) */
  v = Math.round(v * 10) / 10;
  return v >= 3 && v <= 20 ? v : null;
}
async function syncExamA1c() {
  let changed = false;
  const want = new Map();
  S.exams.forEach(e => { const v = a1cFromExam(e); if (v != null) want.set('ex-' + e.id, { id: 'ex-' + e.id, examId: e.id, source: 'exame', date: e.date, value: v, lab: e.lab || '', notes: e.title && e.title !== 'Exame' ? e.title : '' }); });
  const manual = new Set(S.hba.filter(x => x.source !== 'exame').map(x => x.date + '|' + x.value));
  for (const x of S.hba.filter(x => x.source === 'exame')) if (!want.has(x.id)) { await Store.del('hba1c', x.id); changed = true; }
  for (const [id, r] of want) {
    if (manual.has(r.date + '|' + r.value)) { if (S.hba.some(x => x.id === id)) { await Store.del('hba1c', id); changed = true; } continue; }
    const old = S.hba.find(x => x.id === id);
    if (!old || old.date !== r.date || old.value !== r.value || old.lab !== r.lab || old.notes !== r.notes) { await Store.put('hba1c', r); changed = true; }
  }
  return changed;
}
