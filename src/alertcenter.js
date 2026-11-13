/* ================= Central de alertas internos =================
   Um único mecanismo e um único histórico para os dois modos de exibição:
   - Convencional: faixas e avisos como sempre foram (nada muda na apresentação).
   - Bolha: gota flutuante com painel que se expande a partir dela.
   Trocar de modo muda só a apresentação; alertas, histórico e estados (lido, dispensado) são os mesmos.
   Tudo é interno ao app: sem notificação do Android, som ou vibração, e sem janela que bloqueie a navegação. */
const AC_CATS = { hipo: 'Hipoglicemia', glic: 'Glicemia', lembrete: 'Lembretes', plano: 'Tratamento', backup: 'Backup e sincronização', pers: 'Alertas personalizados', conquista: 'Conquistas', info: 'Informações', conf: 'Confirmações', atencao: 'Atenção', ia: 'Inteligência artificial', rel: 'Relatórios', analise: 'Análise', config: 'Configurações' };
const AC_PRIO = { 0: 'Baixa', 1: 'Normal', 2: 'Alta', 3: 'Crítica' }, AC_MAX = 300, AC_SIZE = 56;
S.ac = { mode: 'classic', pos: null, hidden: false, items: [] };
const AC = { open: false, id: null, timer: null, fresh: false };
const acBubbleOn = () => S.ac.mode === 'bubble';
const acNorm = s => String(s || '').replace(/\s+/g, ' ').trim();
let acSaveT = null;
function acSave() { clearTimeout(acSaveT); acSaveT = setTimeout(async () => { try { await Store.put('meta', { id: 'alert-center', value: { mode: S.ac.mode, pos: S.ac.pos, hidden: S.ac.hidden, items: S.ac.items.slice(0, AC_MAX).map(({ html, ...r }) => r) } }); } catch (e) { } }, 250); }
function acLoad(v) {
  v = v || {};
  S.ac = { mode: v.mode === 'bubble' ? 'bubble' : 'classic', pos: v.pos && isFinite(v.pos.fx) && isFinite(v.pos.fy) ? { fx: Math.min(1, Math.max(0, v.pos.fx)), fy: Math.min(1, Math.max(0, v.pos.fy)) } : null, hidden: !!v.hidden, items: (Array.isArray(v.items) ? v.items : []).filter(x => x && x.id && x.key).slice(0, AC_MAX) };
}
/* ----- fontes de alerta: todas as faixas do app, com categoria e prioridade ----- */
function acSources() {
  const out = []; S._acCollect = true;
  const add = (src, cat, prio, fn, by) => { let h = ''; try { h = fn() || ''; } catch (e) { } if (h) out.push({ src, cat, prio, by: by || 'title', html: h }); };
  try {
    add('mem', 'atencao', 2, () => Store.persistent ? '' : `<div class="banner warn"><span><b>Armazenamento.</b> O armazenamento do navegador não está disponível aqui. Os dados valem só nesta sessão. Exporte um backup antes de sair.</span></div>`);
    add('hipo', 'hipo', 3, hypoBanner); add('hiper', 'glic', 3, hyperBanner); add('conq', 'conquista', 1, rwBanner);
    add('drv', 'backup', 2, drvBanner); add('bkp', 'backup', 2, backupBanner); add('basal', 'plano', 2, basalBanner); add('jantar', 'glic', 2, dinnerBanner);
    add('rem', 'lembrete', 2, remBanner, 'text'); add('plano', 'plano', 2, planBanner, 'text'); add('ca', 'pers', 2, caBanner, 'text');
    add('ex', 'info', 1, () => hasExamples() ? `<div class="banner"><span><b>Dados de exemplo.</b> Eles somem sozinhos quando você importar ou registrar a primeira medição real.</span><button class="btn sm" data-act="rm-examples">Remover agora</button></div>` : '');
  } finally { S._acCollect = false; }
  const live = [];
  for (const s of out) {
    const t = document.createElement('template'); t.innerHTML = s.html;
    [...t.content.children].filter(e => e.classList.contains('banner')).forEach(el => {
      const plain = el.cloneNode(true); plain.querySelectorAll('button,[data-hy-next]').forEach(n => n.remove());
      const text = acNorm(plain.textContent), b = plain.querySelector('b'), title = acNorm(b ? b.textContent : '').replace(/^[⚠▲\s]+/, '').replace(/[:.]+$/, '') || AC_CATS[s.cat];
      live.push({ src: s.src, cat: s.cat, prio: s.prio, title, text, html: el.outerHTML, key: s.src + '|' + (s.by === 'text' ? text : title) });
    });
  }
  return live;
}
/* ----- gestão: fila, deduplicação, histórico ----- */
function acUpsert(live) {
  const now = Date.now(), fresh = []; let dirty = false, seen = new Set(live.map(x => x.key));
  for (const it of S.ac.items) if (it.active && !seen.has(it.key)) { it.active = false; it.html = null; dirty = true; }
  for (const L of live) {
    const it = S.ac.items.find(x => x.key === L.key && x.active);
    if (it) { it.html = L.html; if (it.text !== L.text) { it.text = L.text; it.rev = (it.rev || 0) + 1; dirty = true; } }
    else { const n = { id: uid(), key: L.key, src: L.src, cat: L.cat, prio: L.prio, title: L.title, text: L.text, ts: now, read: false, dismissed: false, active: true, rev: 0, html: L.html }; S.ac.items.unshift(n); fresh.push(n); dirty = true; }
  }
  if (S.ac.items.length > AC_MAX) S.ac.items.length = AC_MAX;
  if (dirty) acSave();
  return fresh;
}
function acToast(msg, cat) {
  const text = acNorm(msg); if (!text) return false;
  const now = Date.now(), r = S.route, c = cat || (/não foi possível|erro|falhou|inválid|negad|recus/i.test(text) ? 'atencao' : { ia: 'ia', relatorios: 'rel', analise: 'analise', backup: 'backup', config: 'config', lembretes: 'config', aparencia: 'config', alertasp: 'pers' }[r] || 'conf');
  const prio = c === 'atencao' ? 2 : 0, last = S.ac.items.find(x => !x.active && x.text === text && now - x.ts < 60000);
  let it = last;
  if (last) { last.n = (last.n || 1) + 1; last.ts = now; if (!acBubbleOn()) { acSave(); return false; } }
  else { it = { id: uid(), key: 't|' + text + '|' + now, src: 'toast', cat: c, prio, title: AC_CATS[c], text, ts: now, read: prio === 0, dismissed: false, active: false, rev: 0 }; S.ac.items.unshift(it); if (S.ac.items.length > AC_MAX) S.ac.items.length = AC_MAX; }
  acSave();
  if (!acBubbleOn()) { acRefresh(); return false; }
  S.ac.hidden = false; acPop(it, prio === 0 ? 3500 : 9000); return true;
}
function acSync() {
  let live = []; try { live = acSources(); } catch (e) { }
  const fresh = acUpsert(live);
  if (acBubbleOn() && fresh.length) { const f = fresh.filter(x => !x.dismissed).sort((a, b) => b.prio - a.prio)[0]; if (f) { S.ac.hidden = false; acPop(f); } }
  acRefresh();
}
const acList = () => S.ac.items.filter(x => !x.dismissed).sort((a, b) => (a.read - b.read) || (b.prio - a.prio) || (b.ts - a.ts));
const acUnread = () => S.ac.items.filter(x => !x.dismissed && !x.read && (x.active || x.src !== 'toast')).length;
function acSetState(id, patch) { const it = S.ac.items.find(x => x.id === id); if (!it) return; Object.assign(it, patch); acSave(); acRefresh(); }
/* ----- elementos da bolha ----- */
const AC_DROP = `<svg viewBox="-5.5 -2.5 111 111" width="30" height="30" aria-hidden="true"><defs><linearGradient id="acg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF5A66"/><stop offset="1" stop-color="#E0182B"/></linearGradient><mask id="acm" maskUnits="userSpaceOnUse" x="-6" y="-3" width="112" height="112"><rect x="-6" y="-3" width="112" height="112" fill="#fff"/><path d="M30 66 A20 20 0 0 0 46 85" fill="none" stroke="#000" stroke-width="5.5" stroke-linecap="round"/></mask></defs><path mask="url(#acm)" d="M50 4 C50 4 14 44 14 66 A36 36 0 0 0 86 66 C86 44 50 4 50 4 Z" fill="url(#acg)"/></svg>`;
function acEnsure() {
  if (document.getElementById('acb')) return;
  document.body.insertAdjacentHTML('beforeend', `<button id="acb" class="acb" type="button" aria-haspopup="true" aria-expanded="false" hidden>${AC_DROP}<span class="acb-n" hidden></span></button><div id="acz" class="acz" aria-hidden="true" hidden><span>Solte aqui para dispensar</span></div><div id="acp" class="acp" role="region" aria-live="polite" aria-label="Alertas do TiaBete" hidden></div>`);
  acBind(document.getElementById('acb'));
  document.addEventListener('pointerdown', e => { if (AC.open && !e.target.closest('#acp, #acb')) acCollapse(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && AC.open) { acCollapse(); const b = document.getElementById('acb'); if (b) b.focus(); } });
  document.addEventListener('focusin', e => document.body.classList.toggle('acb-typing', /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !/^(checkbox|radio|button|range)$/.test(e.target.type || '')));
  document.addEventListener('focusout', () => setTimeout(() => { const a = document.activeElement; document.body.classList.toggle('acb-typing', !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !/^(checkbox|radio|button|range)$/.test(a.type || '')); }, 60));
  addEventListener('resize', () => { acPlace(); if (AC.open) acPanelPos(); });
  addEventListener('orientationchange', () => setTimeout(() => { acPlace(); if (AC.open) acPanelPos(); }, 200));
}
function acPlace(left, top) {
  const b = document.getElementById('acb'); if (!b) return; const vw = innerWidth, vh = innerHeight, M = 6, TOP = 64, BOT = 8, p = S.ac.pos || { fx: .9, fy: .62 };
  const L = left != null ? left : M + p.fx * (vw - AC_SIZE - 2 * M), T = top != null ? top : TOP + p.fy * (vh - AC_SIZE - TOP - BOT);
  b.style.left = Math.min(vw - AC_SIZE - M, Math.max(M, L)) + 'px'; b.style.top = Math.min(vh - AC_SIZE - BOT, Math.max(TOP, T)) + 'px';
}
function acRefresh() {
  if (!document.body) return;
  const on = acBubbleOn(); if (on) acEnsure();
  const b = document.getElementById('acb'); if (!b) return;
  const show = on && !S.ac.hidden; b.hidden = !show; if (!show) { acCollapse(true); return; }
  const n = acUnread(), nb = b.querySelector('.acb-n'); nb.hidden = !n; nb.textContent = n > 9 ? '9+' : n;
  b.classList.toggle('has', n > 0); b.classList.toggle('crit', S.ac.items.some(x => x.active && !x.read && !x.dismissed && x.prio >= 3));
  b.setAttribute('aria-label', n ? `Alertas: ${n} não lido${n > 1 ? 's' : ''}` : 'Alertas'); acPlace();
  if (AC.open) acPanel();
}
/* ----- painel que se expande da gota ----- */
function acPanelPos() {
  const b = document.getElementById('acb'), p = document.getElementById('acp'); if (!b || !p) return;
  const r = b.getBoundingClientRect(), vw = innerWidth, vh = innerHeight, W = Math.min(340, vw - 24); p.style.width = W + 'px';
  const left = Math.min(vw - W - 12, Math.max(12, r.left + r.width / 2 - W / 2)), above = r.top + r.height / 2 > vh / 2;
  p.style.left = left + 'px'; p.classList.toggle('below', !above);
  p.style.maxHeight = Math.max(160, (above ? r.top : vh - r.bottom) - 24) + 'px';
  if (above) { p.style.bottom = (vh - r.top + 8) + 'px'; p.style.top = 'auto'; } else { p.style.top = (r.bottom + 8) + 'px'; p.style.bottom = 'auto'; }
  p.style.setProperty('--tx', (r.left + r.width / 2 - left) + 'px'); p.style.transformOrigin = (r.left + r.width / 2 - left) + 'px ' + (above ? '100%' : '0%');
}
function acPanel() {
  const p = document.getElementById('acp'), list = acList(); if (!p) return;
  let it = list.find(x => x.id === AC.id) || list[0];
  if (it) AC.id = it.id;
  const i = it ? list.indexOf(it) : -1, fmtT = ts => { const d = new Date(ts); return (isoDate(d) === isoDate(new Date()) ? 'hoje' : fmtDate(isoDate(d)).slice(0, 5)) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  p.innerHTML = it ? `<div class="acp-h"><span class="acp-cat">${esc(AC_CATS[it.cat] || 'Alerta')}</span><span class="acp-t">${fmtT(it.ts)}${it.n > 1 ? ' · ' + it.n + 'x' : ''}</span><span class="acp-nav"><button class="acp-i" data-ac="prev" aria-label="Alerta anterior" ${i <= 0 ? 'disabled' : ''}>‹</button><span class="num">${i + 1}/${list.length}</span><button class="acp-i" data-ac="next" aria-label="Próximo alerta" ${i >= list.length - 1 ? 'disabled' : ''}>›</button></span></div>
    <div class="acp-b ${it.read ? 'read' : ''}">${it.active && it.html ? it.html : `${it.title === AC_CATS[it.cat] ? '' : `<div class="acp-tt">${esc(it.title)}</div>`}<div>${esc(it.text)}</div>`}</div>
    <div class="acp-f"><button class="btn sm" data-ac="read" ${it.read ? 'disabled' : ''}>${it.read ? 'Lido' : 'Marcar como lido'}</button><button class="btn sm" data-ac="dismiss">Dispensar</button><button class="btn sm ghost" data-ac="hist">Histórico</button></div>`
    : `<div class="acp-b"><div class="acp-tt">Sem alertas</div><div>Nenhum alerta no momento.</div></div><div class="acp-f"><button class="btn sm ghost" data-ac="hist">Histórico</button></div>`;
  acPanelPos();
}
function acPop(it, ms) {
  acEnsure(); const b = document.getElementById('acb'); if (!b) return;
  S.ac.hidden = false; AC.id = it ? it.id : null; acOpen(ms || (it && it.prio >= 3 ? 14000 : 8000));
}
function acOpen(ms) {
  const b = document.getElementById('acb'), p = document.getElementById('acp'); if (!b || !p || b.hidden && !acBubbleOn()) return;
  b.hidden = false; AC.open = true; b.setAttribute('aria-expanded', 'true'); acPanel(); p.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('on'))); acTimer(ms || 10000);
}
function acTimer(ms) { clearTimeout(AC.timer); AC.timer = setTimeout(() => acCollapse(), ms); }
function acCollapse(now) {
  clearTimeout(AC.timer); const p = document.getElementById('acp'), b = document.getElementById('acb'); if (!p) return;
  if (AC.open) { /* toasts de confirmação são lidos ao recolher */ const it = S.ac.items.find(x => x.id === AC.id); if (it && it.src === 'toast' && it.prio === 0 && !it.read) { it.read = true; acSave(); } }
  AC.open = false; if (b) b.setAttribute('aria-expanded', 'false'); p.classList.remove('on');
  if (now) { p.hidden = true; return; } setTimeout(() => { if (!AC.open) p.hidden = true; }, 260);
  if (b) { const n = acUnread(), nb = b.querySelector('.acb-n'); nb.hidden = !n; nb.textContent = n > 9 ? '9+' : n; }
}
/* ----- gestos: tocar abre o último alerta; arrastar reposiciona; arrastar para baixo até a área de descarte dispensa ----- */
function acBind(b) {
  let d = null; const z = () => document.getElementById('acz');
  const zone = () => { const vw = innerWidth, vh = innerHeight; return { x: vw / 2, y: vh - 56 - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0) }; };
  b.addEventListener('pointerdown', e => { if (e.button > 0) return; try { b.setPointerCapture(e.pointerId); } catch (x) { } const r = b.getBoundingClientRect(); d = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, t: Date.now(), moved: false, hot: false }; });
  b.addEventListener('pointermove', e => {
    if (!d) return; const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > 9) { d.moved = true; b.classList.add('drag'); document.body.classList.add('acb-drag'); acCollapse(true); const zz = z(); zz.hidden = false; requestAnimationFrame(() => zz.classList.add('on')); }
    if (!d.moved) return; acPlace(d.ox + dx, d.oy + dy);
    const r = b.getBoundingClientRect(), c = zone(), dist = Math.hypot(r.left + r.width / 2 - c.x, r.top + r.height / 2 - c.y);
    d.hot = dist < 64 && dy > 90; z().classList.toggle('hot', d.hot);
  });
  const end = e => {
    if (!d) return; const g = d; d = null; b.classList.remove('drag'); document.body.classList.remove('acb-drag'); const zz = z(); zz.classList.remove('on', 'hot'); setTimeout(() => { zz.hidden = true; }, 200);
    if (e.type === 'pointercancel') { acPlace(); return; }
    if (!g.moved) { if (AC.open) acCollapse(); else { const l = acList(); AC.id = l[0] ? l[0].id : null; acOpen(12000); } return; }
    const r = b.getBoundingClientRect(), vh = innerHeight;
    if (g.hot) { b.classList.add('gone'); setTimeout(() => { S.ac.hidden = true; b.classList.remove('gone'); acSave(); acRefresh(); }, 220); return; }
    if (r.top + r.height / 2 > vh * .72 && e.clientY - g.sy > 40) { b.classList.add('back'); acPlace(g.ox, g.oy); setTimeout(() => b.classList.remove('back'), 300); return; } /* arrastou para baixo sem chegar à área de descarte: volta */
    const vw = innerWidth, M = 6, TOP = 64, BOT = 8; S.ac.pos = { fx: Math.min(1, Math.max(0, (r.left - M) / (vw - AC_SIZE - 2 * M))), fy: Math.min(1, Math.max(0, (r.top - TOP) / (vh - AC_SIZE - TOP - BOT))) }; acSave(); acPlace();
  };
  b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
  b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (AC.open) acCollapse(); else { const l = acList(); AC.id = l[0] ? l[0].id : null; acOpen(12000); } } });
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-ac]'); const inP = e.target.closest('#acp');
  if (el) {
    const a = el.dataset.ac, list = acList(), i = list.findIndex(x => x.id === AC.id);
    if (a === 'prev' && i > 0) AC.id = list[i - 1].id; else if (a === 'next' && i < list.length - 1) AC.id = list[i + 1].id;
    else if (a === 'read') { acSetState(AC.id, { read: true }); }
    else if (a === 'dismiss') { const nx = list[i + 1] || list[i - 1]; acSetState(AC.id, { dismissed: true, read: true }); AC.id = nx ? nx.id : null; if (!nx) { acCollapse(); return; } }
    else if (a === 'hist') { acCollapse(); go('alertashist'); return; }
    acPanel(); acTimer(12000); return;
  }
  if (inP && e.target.closest('button[data-act], a[href]')) setTimeout(() => acCollapse(), 80); /* tocou numa ação do alerta: recolhe e deixa a navegação livre */
  else if (inP) acTimer(12000);
});
/* ----- configuração e histórico ----- */
function acSetMode(m) { S.ac.mode = m === 'bubble' ? 'bubble' : 'classic'; if (m === 'bubble') S.ac.hidden = false; acSave(); acCollapse(true); acRefresh(); render(); }
function acModeCard() {
  const on = acBubbleOn(), n = S.ac.items.length, un = acUnread(), opt = (k, t, d) => `<button class="ac-opt${(on ? 'bubble' : 'classic') === k ? ' on' : ''}" role="radio" aria-checked="${(on ? 'bubble' : 'classic') === k}" data-acm="${k}"><span class="ac-r"></span><span style="min-width:0"><b>${t}</b><span class="dim">${d}</span></span></button>`;
  return `<h2 class="sec">Modo de exibição dos alertas</h2><div class="card"><div role="radiogroup" aria-label="Modo de exibição dos alertas" class="stack" style="gap:8px">${opt('classic', 'Modo convencional', 'Faixas e avisos como sempre foram, dentro de cada página.')}${opt('bubble', 'Bolha flutuante', 'Uma gota sobre as páginas; o alerta se abre a partir dela e recolhe sozinho.')}</div>
  <p class="hint" style="margin:10px 0 0">A escolha vale na hora e fica salva. Os dois modos usam o mesmo histórico: trocar de modo muda só a apresentação, nunca os alertas. Tudo fica dentro do app, sem som, vibração nem notificação do Android.</p>
  ${on ? `<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">${S.ac.hidden ? '<button class="btn" data-acm-do="show">Mostrar a bolha</button>' : ''}<button class="btn" data-acm-do="reset">Posição padrão</button></div>` : ''}
  <button class="btn full" style="margin-top:10px" data-act="go" data-r="alertashist">Histórico de alertas (${n}${un ? ' · ' + un + ' não lido' + (un > 1 ? 's' : '') : ''})</button></div>`;
}
let acFilter = 'all';
function viewAlertasHist() {
  const items = S.ac.items, cats = [...new Set(items.map(x => x.cat))], un = items.filter(x => !x.read && !x.dismissed).length;
  const shown = items.filter(x => acFilter === 'all' ? true : acFilter === 'unread' ? !x.read && !x.dismissed : x.cat === acFilter);
  let day = '', h = banners() + `<div class="card"><p class="hint" style="margin:0">Todos os alertas internos do app, na ordem em que apareceram. O histórico é o mesmo nos dois modos de exibição.</p><div class="ac-chips"><button class="ac-chip${acFilter === 'all' ? ' on' : ''}" data-acf="all">Todos (${items.length})</button><button class="ac-chip${acFilter === 'unread' ? ' on' : ''}" data-acf="unread">Não lidos (${un})</button>${cats.map(c => `<button class="ac-chip${acFilter === c ? ' on' : ''}" data-acf="${c}">${esc(AC_CATS[c] || c)}</button>`).join('')}</div>${un ? '<button class="btn full" style="margin-top:10px" data-acm-do="readall">Marcar todos como lidos</button>' : ''}</div>`;
  if (!shown.length) return h + '<div class="card"><div class="empty">Nenhum alerta aqui ainda.</div></div>';
  for (const x of shown) {
    const d = new Date(x.ts), ds = isoDate(d); if (ds !== day) { day = ds; h += `<h2 class="sec">${ds === isoDate(new Date()) ? 'Hoje' : fmtDate(ds)}</h2>`; }
    h += `<div class="card ac-it${x.read || x.dismissed ? ' read' : ''}"><div class="row sp" style="gap:8px;align-items:flex-start"><div style="min-width:0"><span class="atag">${esc(AC_CATS[x.cat] || 'Alerta')}</span> <span class="atag">${AC_PRIO[x.prio] || ''}</span></div><span class="dim num" style="white-space:nowrap">${pad(d.getHours())}:${pad(d.getMinutes())}${x.n > 1 ? ' · ' + x.n + 'x' : ''}</span></div>
    <div class="ac-tt">${esc(x.title)}</div><div class="ac-tx">${esc(x.text)}</div>
    <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">${x.active && !x.dismissed ? '<span class="atag on">Ativo agora</span>' : ''}${!x.read && !x.dismissed ? '<span class="atag">Não lido</span>' : ''}${x.dismissed ? '<span class="atag">Dispensado</span>' : ''}<span style="flex:1"></span>${!x.read && !x.dismissed ? `<button class="btn sm" data-acid="read" data-id="${x.id}">Marcar como lido</button>` : ''}${x.dismissed ? `<button class="btn sm" data-acid="restore" data-id="${x.id}">Restaurar</button>` : `<button class="btn sm" data-acid="dismiss" data-id="${x.id}">Dispensar</button>`}</div></div>`;
  }
  return h;
}
document.addEventListener('click', e => {
  let el = e.target.closest('[data-acm]'); if (el) { acSetMode(el.dataset.acm); return; }
  el = e.target.closest('[data-acm-do]'); if (el) { const a = el.dataset.acmDo; if (a === 'show') { S.ac.hidden = false; acSave(); acRefresh(); render(); } else if (a === 'reset') { S.ac.pos = null; acSave(); acPlace(); toast('Posição padrão restaurada.'); } else if (a === 'readall') { S.ac.items.forEach(x => { if (!x.dismissed) x.read = true; }); acSave(); acRefresh(); render(); } return; }
  el = e.target.closest('[data-acf]'); if (el) { acFilter = el.dataset.acf; render(); return; }
  el = e.target.closest('[data-acid]'); if (el) { const a = el.dataset.acid; acSetState(el.dataset.id, a === 'read' ? { read: true } : a === 'dismiss' ? { dismissed: true, read: true } : { dismissed: false }); render(); }
});
setInterval(() => { try { acSync(); } catch (e) { } }, 5000);
(function () { const _l = loadAll; loadAll = async function () { const r = await _l.apply(this, arguments); try { acSync(); } catch (e) { } return r; }; })();
/* logotipo -> Painel (sem recarregar; não mexe em dados) */
(function () { const go2 = () => { if (S.route === 'painel') window.scrollTo(0, 0); else go('painel'); }; document.addEventListener('click', e => { if (e.target.closest('#logo-home')) go2(); }); document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'logo-home') { e.preventDefault(); go2(); } }); })();
