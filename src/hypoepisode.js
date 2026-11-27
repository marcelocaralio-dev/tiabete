/* ================= Episódio de hipoglicemia persistente + bolha contextual vermelha =================
   Regras puras: hypoepisode-core.js. Aqui ficam: gravação, ganchos nos fluxos existentes, bolha, menu, consulta e confirmações.
   Armazenamento: o MESMO mecanismo do app (IndexedDB, loja "meta", registro "hypo-episodes") + espelho síncrono em localStorage ("tb-he"),
   igual ao da bolha de alertas: vale o estado gravado mais recentemente (campo ts), então nada se perde se o sistema encerrar o app antes
   de a gravação assíncrona terminar. As medições continuam na loja "records"; o episódio guarda um instantâneo (id, data, hora, valor).
   A bolha é independente da bolha de alertas (#acb): não altera o código nem o comportamento dela. */
const HE = { st: heEmpty(), ready: false, open: false, timer: null };
const HE_ID = 'hypo-episodes', HE_MIR = 'tb-he', HB_SIZE = 76;   /* bolha de alertas = 56: a de hipoglicemia é bem maior e tem rótulo de texto (reforço de acessibilidade) */
const heId = () => 'he' + uid();
const heTm = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const heDt = ts => fmtDM(ts) + ' ' + heTm(ts);
const heSvg = (p, s) => `<svg viewBox="0 0 24 24" width="${s || 22}" height="${s || 22}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
/* ícones próprios (traço 24×24, padrão do iconset): escudo com sinal de atenção na bolha — nada de gota */
const HE_IC = {
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6L12 3z"/><path d="M12 8.2v4.4"/><path d="M12 15.6h.01"/>',
  aid: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  list: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4.5h6M8.5 10h7M8.5 14h7M8.5 17.5h4"/>'
};

/* ---------- gravação ---------- */
const heMirrorRead = () => { try { return heClean(JSON.parse(localStorage.getItem(HE_MIR) || 'null')); } catch (e) { return null; } };
let heSaveP = Promise.resolve();
function heSave() {
  HE.st.ts = Date.now();
  try { localStorage.setItem(HE_MIR, JSON.stringify(HE.st)); } catch (e) { } /* espelho síncrono: sobrevive a encerramento forçado */
  heSaveP = heSaveP.then(() => Store.put('meta', { id: HE_ID, value: HE.st })).catch(e => { console.error(e); });
  return heSaveP;
}
/* Abertura do app: lê o estado (banco x espelho), adota o episódio que já estava em andamento antes da atualização (uma única vez) e mostra a bolha. */
async function heBoot() {
  let db = null; try { const m = (await Store.all('meta')).find(x => x.id === HE_ID); if (m) db = heClean(m.value); } catch (e) { }
  HE.st = heNewer(db, heMirrorRead()) || heEmpty();
  if (!HE.st.migrated) HE.st = heAdopt(HE.st, hypoEpisode(S.records, Date.now()), heId);
  HE.ready = true;
  HE.st = heReconcile(HE.st, new Set(S.records.map(r => r.id)));
  await heSave(); heRefresh();
}
/* chamado no fim de loadAll(): medição apagada sai do episódio ativo */
function heAfterLoad() {
  if (!HE.ready) return;
  const ns = heReconcile(HE.st, new Set(S.records.map(r => r.id)));
  if (ns !== HE.st) { HE.st = ns; heSave(); heRefresh(); }
}
async function heWipe() { HE.st = { ...heEmpty(), migrated: true, pos: HE.st.pos }; await heSave(); heRefresh(); }

/* Estado no formato que o protocolo (extras.js) já usa: { last, start, ep, id, protocol }. Vem do episódio persistente, não da tela. */
function heHypoState() {
  const a = HE.st.active; if (!a) return null;
  const by = new Map(S.records.map(r => [r.id, r]));
  const ep = a.ms.map(m => by.get(m.id) || { id: m.id, ts: m.ts, date: m.date, time: m.time, glucose: m.glucose }).sort((x, y) => x.ts - y.ts);
  return { last: ep[ep.length - 1], start: ep[0], ep, id: a.id, protocol: true, episode: a };
}
const heActive = () => HE.st.active;

/* Medição registrada (formulário normal ou formulário do protocolo). Devolve 'start' | 'attach' | 'recovery' | 'update' | 'none'. */
async function heOnSaved(rec) {
  if (!HE.ready) return 'none';
  const r = heRecord(HE.st, rec, Date.now(), heId); if (r.kind === 'none') return 'none';
  HE.st = HE.st.active || r.state.active ? heDraft(r.state, '') : r.state; await heSave(); heRefresh();
  try { if (typeof hypoSyncNow === 'function') hypoSyncNow(); } catch (e) { }
  if (r.kind !== 'update') { try { render(); } catch (e) { } }
  return r.kind;
}
async function heCloseEpisode(reason) {
  if (!HE.st.active) return false;
  HE.st = heClose(HE.st, reason, Date.now()); await heSave(); hbCollapse(true); heRefresh();
  ['he-ask', 'he-conf'].forEach(i => { const o = document.getElementById(i); if (o) o.remove(); });
  const o = document.getElementById('gl-over'); if (o) o.remove(); else if (document.getElementById('hypo-form')) closeSheet();
  try { if (typeof hypoNativeAck === 'function') hypoNativeAck(); if (typeof hypoSyncNow === 'function') hypoSyncNow(); } catch (e) { }
  try { render(); } catch (e) { }
  toast(reason === 'recovery' ? 'Recuperação confirmada. Episódio encerrado.' : 'Episódio encerrado por decisão sua.');
  return true;
}

/* ---------- diálogos (por cima de qualquer folha aberta) ---------- */
function heDialog(id, html, onBack) {
  const old = document.getElementById(id); if (old) old.remove();
  const bg = document.createElement('div'); bg.className = 'sheet-bg'; bg.id = id; bg.style.zIndex = '50';
  bg.innerHTML = `<div class="sheet he-dlg" role="alertdialog" aria-modal="true" tabindex="-1"><div class="grab"></div>${html}</div>`;
  bg.addEventListener('pointerdown', e => { if (e.target === bg) { bg.remove(); if (onBack) onBack(); } });
  document.body.appendChild(bg); const sh = bg.querySelector('.sheet'); if (sh) sh.focus({ preventScroll: true }); return bg;
}
/* Medição >= 70 dentro de um episódio ativo: NUNCA encerra sozinho; a pessoa confirma ou mantém o acompanhamento. */
function heAskRecovery(rec) {
  if (!HE.st.active) return;
  heDialog('he-ask', `<h2>Glicemia de volta a 70 mg/dL ou mais?</h2>
    <p style="margin:8px 0">Você registrou <b class="num">${f0(rec.glucose)}</b> mg/dL às <b class="num">${esc(rec.time || heTm(rec.ts))}</b>.</p>
    <p class="hint" style="margin:0 0 12px">Se confirmar, o episódio de hipoglicemia é encerrado e a bolha vermelha some. As medições e o histórico continuam salvos. Se quiser continuar medindo, mantenha o acompanhamento.</p>
    <div class="stack" style="gap:8px"><button class="btn pri full" type="button" data-he="recover-yes">Confirmar resolução e encerrar</button><button class="btn full" type="button" data-he="recover-keep">Manter acompanhamento</button></div>`,
  () => { HE.st = heKeep(HE.st, Date.now()); heSave(); });
}
function heAskDiscard() {
  if (!HE.st.active) return;
  heDialog('he-conf', `<h2>Encerrar este episódio?</h2>
    <p class="hint" style="margin:8px 0 12px">O episódio será encerrado por decisão sua, <b>sem contar como recuperação glicêmica</b>. A bolha vermelha some. As medições e o histórico continuam salvos e o episódio fica disponível para consulta.</p>
    <div class="stack" style="gap:8px"><button class="btn danger full" type="button" data-he="discard-do">Encerrar episódio</button><button class="btn full" type="button" data-he="back">Voltar</button></div>`);
}

/* ---------- consulta do episódio ---------- */
const heDur = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + pad(m % 60) + ' min'; };
function heEvText(e) {
  const g = e.g != null ? `<b class="num">${f0(e.g)}</b> mg/dL` : '';
  return { start: 'Episódio iniciado com ' + g, low: 'Nova medição abaixo de 70: ' + g, high: 'Medição de ' + g + ' (70 ou mais)', keep: 'Acompanhamento mantido', recovered: 'Recuperação confirmada', discarded: 'Encerrado por decisão do usuário' }[e.type] || esc(e.type);
}
function heViewHTML(ep) {
  const act = ep.state === 'active', end = act ? Date.now() : ep.closedTs || ep.ms[ep.ms.length - 1].ts;
  const min = Math.min(...ep.ms.map(m => m.glucose));
  const ev = ep.events.slice().sort((a, b) => a.ts - b.ts);
  return `<h2>Episódio de hipoglicemia</h2>
  <span class="he-st${act ? '' : ' end'}">${act ? 'Em andamento' : esc(HE_REASON[ep.closeReason] || 'Encerrado')}</span>
  <dl class="he-kv"><dt>Início</dt><dd class="num">${heDt(ep.startTs)}</dd><dt>Glicemia inicial</dt><dd class="num"><b>${f0(ep.startGlucose)}</b> mg/dL</dd><dt>Menor valor</dt><dd class="num">${f0(min)} mg/dL</dd><dt>Medições</dt><dd class="num">${ep.ms.length}</dd>
  <dt>${act ? 'Duração até agora' : 'Duração'}</dt><dd class="num">${heDur(end - ep.startTs)}</dd>${act ? '' : `<dt>Encerrado em</dt><dd class="num">${heDt(ep.closedTs || end)}</dd>`}</dl>
  <h3 class="hy-h">Medições do episódio</h3><div class="stack" style="gap:6px">${ep.ms.map((m, i) => `<div class="row" style="justify-content:space-between;gap:8px;font-size:14px"><span class="num dim">${i + 1}ª · ${esc(m.time || heTm(m.ts))}</span><span class="num"><b>${f0(m.glucose)}</b> mg/dL</span>${badge(m.glucose)}</div>`).join('')}</div>
  <h3 class="hy-h">Acontecimentos</h3><ul class="he-ev">${ev.map(e => `<li><time class="num">${heTm(e.ts)}</time><span>${heEvText(e)}</span></li>`).join('') || '<li class="dim">Nenhum acontecimento registrado.</li>'}</ul>
  ${act ? '<button class="btn pri full" type="button" data-he="open" style="margin-top:14px">Abrir protocolo</button>' : ''}<button class="btn full" type="button" data-act="close" style="margin-top:${act ? 8 : 14}px">Fechar</button>`;
}
function heView(id) { const ep = heFind(HE.st, id); if (ep) openSheet(heViewHTML(ep)); }
/* Histórico: o cartão de episódio ganha o estado e o acesso à consulta quando existe episódio persistido para aquelas medições. */
function heEpiLink(e) {
  const ep = (e.members || []).map(m => heByRec(HE.st, m.id)).find(Boolean); if (!ep) return '';
  return `<div class="epi-f he-lk"><span>${ep.state === 'active' ? 'Em acompanhamento' : esc(HE_REASON[ep.closeReason] || 'Encerrado')}</span><button class="btn sm" type="button" data-he="view" data-id="${ep.id}">Consultar episódio</button></div>`;
}

/* ---------- bolha ---------- */
const hbEl = () => document.getElementById('hyb'), hpEl = () => document.getElementById('hyp');
const hbK = b => typeof acK === 'function' ? acK(b) : 1;
function hbBlocked() { return (typeof SEC !== 'undefined' && SEC.locked) || !!(document.getElementById('lk') || document.getElementById('tb-gate') || document.getElementById('tb-splash')); }
function hbEnsure() {
  if (hbEl() || !document.body) return;
  document.body.insertAdjacentHTML('beforeend', `<button id="hyb" class="hyb" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="hyp" aria-label="Episódio de hipoglicemia ativo. Abrir opções" hidden>${heSvg(HE_IC.shield, 34)}<span class="hyb-t">HIPO</span></button>
  <div id="hyps" class="hyp-scrim" hidden></div>
  <div id="hyp" class="hyp" role="menu" aria-label="Episódio de hipoglicemia" hidden><div class="hyp-t">Hipoglicemia</div>
    <button class="hyp-i main" type="button" role="menuitem" data-he="open"><span class="hyp-c main">${heSvg(HE_IC.aid, 30)}</span><span>Abrir protocolo</span></button>
    <button class="hyp-i" type="button" role="menuitem" data-he="new"><span class="hyp-c">${heSvg(HE_IC.plus, 30)}</span><span>Registrar glicemia</span></button>
    <button class="hyp-i" type="button" role="menuitem" data-he="view-act"><span class="hyp-c">${heSvg(HE_IC.list, 30)}</span><span>Ver episódio</span></button>
    <button class="hyp-i hyp-x" type="button" role="menuitem" data-he="close"><span>Fechar</span></button></div>`);
  hbBind(hbEl());
  document.addEventListener('pointerdown', e => { if (HE.open && !e.target.closest('#hyp, #hyb')) hbCollapse(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && HE.open) { hbCollapse(); const b = hbEl(); if (b) b.focus(); } });
  addEventListener('resize', () => { hbPlace(); if (HE.open) hbMenuPos(); });
  addEventListener('orientationchange', () => setTimeout(() => { hbPlace(); if (HE.open) hbMenuPos(); }, 200));
}
/* Lateral esquerda/direita e altura livre, como a bolha de alertas (mesmas margens: topo, barra de navegação, zoom do app). Em repouso, se a bolha de alertas estiver no mesmo ponto, sobe/desce para não sobrepor. */
function hbPlace(left, top, free) {
  const b = hbEl(); if (!b) return null; const k = b._k = hbK(b), sz = HB_SIZE * k, vw = innerWidth, vh = innerHeight;
  const { M, TOP, BOT } = typeof acBounds === 'function' ? acBounds(k) : { M: 6 * k, TOP: 64 * k, BOT: 74 * k }, p = HE.st.pos || { fx: 1, fy: .5 }, side = p.fx >= .5 ? 1 : 0;
  const L = left != null ? left : (side ? vw - sz - M : M), T = top != null ? top : TOP + p.fy * (vh - sz - TOP - BOT);
  const l = free ? Math.min(vw - sz, Math.max(0, L)) : Math.min(vw - sz - M, Math.max(M, L));
  let t = free ? Math.min(vh - sz, Math.max(0, T)) : Math.min(vh - sz - BOT, Math.max(TOP, T));
  if (!free && left == null) {
    const o = document.getElementById('acb');
    if (o && !o.hidden && !o.classList.contains('drag')) {
      const r = o.getBoundingClientRect(), g = 8 * k;
      if (r.width > 0 && l < r.right + g && l + sz > r.left - g && t < r.bottom + g && t + sz > r.top - g) {
        const up = r.top - sz - g, down = r.bottom + g, maxT = vh - sz - BOT;
        t = up >= TOP ? up : Math.min(maxT, down);
      }
    }
  }
  b.style.left = l / k + 'px'; b.style.top = t / k + 'px'; b.dataset.side = side ? 'r' : 'l'; return { left: l, top: t };
}
/* Painel centralizado e destacado: largura generosa, centrado na tela e contido na área visível (rola por dentro se a tela for muito baixa; nenhum botão fica cortado). */
function hbMenuPos() {
  const b = hbEl(), p = hpEl(); if (!b || !p) return;
  const k = b._k || hbK(b), vw = innerWidth, vh = innerHeight, W = Math.min(420 * k, vw - 24 * k);
  p.style.width = W / k + 'px'; p.style.maxHeight = (vh - 24 * k) / k + 'px'; p.style.bottom = 'auto'; p.style.left = Math.max(12 * k, (vw - W) / 2) / k + 'px';
  const h = p.offsetHeight * k; p.style.top = Math.max(12 * k, (vh - h) / 2) / k + 'px'; p.style.transformOrigin = '50% 50%';
}
const hbScrim = on => { const o = document.getElementById('hyps'); if (o) o.hidden = !on; };
function hbOpen() {
  const b = hbEl(), p = hpEl(); if (!b || !p || b.hidden) return;
  HE.open = true; b.setAttribute('aria-expanded', 'true'); hbScrim(true); p.hidden = false; hbMenuPos(); requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('on')));
  clearTimeout(HE.timer); HE.timer = setTimeout(() => hbCollapse(), 30000);   /* mais tempo para decidir com calma durante o episódio */
}
function hbCollapse(now) {
  clearTimeout(HE.timer); const p = hpEl(), b = hbEl(); if (!p) return;
  HE.open = false; if (b) b.setAttribute('aria-expanded', 'false'); p.classList.remove('on'); hbScrim(false);
  if (now) { p.hidden = true; return; } setTimeout(() => { if (!HE.open) p.hidden = true; }, 260);
}
/* Toque abre/fecha o menu; arrastar move a bolha e, ao soltar, ela encosta na lateral mais próxima (posição gravada com o episódio). Não existe "soltar para dispensar":
   só o encerramento confirmado do episódio remove a bolha. */
function hbBind(b) {
  let d = null;
  b.addEventListener('pointerdown', e => { if (e.button > 0) return; try { b.setPointerCapture(e.pointerId); } catch (x) { } b._k = hbK(b); const r = b.getBoundingClientRect(); d = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false, left: r.left, top: r.top, side: r.left + r.width / 2 < innerWidth / 2 ? 0 : 1 }; });
  b.addEventListener('pointermove', e => {
    if (!d) return; const dx = e.clientX - d.sx, dy = e.clientY - d.sy, k = b._k || 1, sz = HB_SIZE * k;
    if (!d.moved && Math.hypot(dx, dy) > 9) { d.moved = true; b.classList.add('hyb-drag'); document.body.classList.add('hyb-dragging'); hbCollapse(true); }
    if (!d.moved) return;
    const p = hbPlace(d.ox + dx, d.oy + dy, true); d.left = p.left; d.top = p.top; d.side = p.left + sz / 2 < innerWidth / 2 ? 0 : 1; b.dataset.side = d.side ? 'r' : 'l';
  });
  const end = e => {
    if (!d) return; const g = d; d = null; b.classList.remove('hyb-drag'); document.body.classList.remove('hyb-dragging');
    const cancel = e.type === 'pointercancel' || e.type === 'lostpointercapture';
    if (!g.moved) { if (cancel) { hbPlace(); return; } if (HE.open) hbCollapse(); else hbOpen(); return; }
    const k = b._k || hbK(b), { TOP, BOT } = typeof acBounds === 'function' ? acBounds(k) : { TOP: 64 * k, BOT: 74 * k }, span = innerHeight - HB_SIZE * k - TOP - BOT;
    HE.st.pos = { fx: g.side, fy: span > 0 ? Math.min(1, Math.max(0, (g.top - TOP) / span)) : 0 }; heSave();
    b.classList.add('snap'); hbPlace(); setTimeout(() => b.classList.remove('snap'), 340);
  };
  b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end); b.addEventListener('lostpointercapture', e => { if (d) end(e); });
  b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (HE.open) hbCollapse(); else hbOpen(); } });
}
/* A bolha existe SÓ com episódio ativo; some com PIN/abertura/login (operações importantes) e, por CSS, com o teclado aberto ou o menu lateral. */
function heRefresh() {
  if (!document.body) return;
  const show = HE.ready && !!HE.st.active && !hbBlocked();
  if (show) hbEnsure();
  const b = hbEl(); if (!b) return;
  if (b.hidden === show) { b.hidden = !show; if (!show) hbCollapse(true); }
  if (show && !b.classList.contains('hyb-drag') && !HE.open) hbPlace();
}
setInterval(() => { try { heRefresh(); } catch (e) { } }, 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') heRefresh(); });

/* ---------- ações ---------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-he]'); if (!el) return; const a = el.dataset.he;
  if (el.closest('#hyp')) hbCollapse();
  try {
    if (a === 'open') hypoOpen();
    else if (a === 'new') openSheet(recordForm(null)); /* o mesmo formulário de "Nova medição"; ao salvar, a medição entra no episódio ativo */
    else if (a === 'view-act') { if (HE.st.active) heView(HE.st.active.id); }
    else if (a === 'view') heView(el.dataset.id);
    else if (a === 'discard') heAskDiscard();
    else if (a === 'discard-do') { el.disabled = true; await heCloseEpisode('manual'); }
    else if (a === 'recover-yes') { el.disabled = true; await heCloseEpisode('recovery'); }
    else if (a === 'recover-keep') { HE.st = heKeep(HE.st, Date.now()); heSave(); const o = document.getElementById('he-ask'); if (o) o.remove(); toast('Acompanhamento mantido.'); }
    else if (a === 'back') { const o = document.getElementById('he-conf'); if (o) o.remove(); }
  } catch (x) { console.error(x); }
});
/* o que já foi digitado no protocolo fica guardado no episódio (não se perde ao sair da tela) */
let heDraftT = null;
document.addEventListener('input', e => {
  if (!e.target || e.target.id !== 'hy-g' || !HE.ready || !HE.st.active) return;
  const v = e.target.value; clearTimeout(heDraftT); heDraftT = setTimeout(() => { if (HE.st.active) { HE.st = heDraft(HE.st, v); heSave(); } }, 300);
});
