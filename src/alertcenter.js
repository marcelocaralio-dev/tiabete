/* ================= Central de alertas internos =================
   Um único mecanismo e um único histórico para os dois modos de exibição:
   - Convencional: faixas e avisos como sempre foram (nada muda na apresentação).
   - Bolha: gota flutuante com painel que se expande a partir dela.
   Trocar de modo muda só a apresentação; alertas, histórico e estados (lido, dispensado) são os mesmos.
   Tudo é interno ao app: sem notificação do Android, som ou vibração, e sem janela que bloqueie a navegação. */
const AC_CATS = { hipo: 'Hipoglicemia', glic: 'Glicemia', lembrete: 'Lembretes', plano: 'Tratamento', backup: 'Cópia e sincronização', pers: 'Alertas personalizados', conquista: 'Conquistas', info: 'Informações', conf: 'Confirmações', atencao: 'Atenção', ia: 'Inteligência artificial', rel: 'Relatórios', analise: 'Análise', config: 'Configurações' };
const AC_PRIO = { 0: 'Baixa', 1: 'Normal', 2: 'Alta', 3: 'Crítica' }, AC_MAX = 300, AC_SIZE = 56;
S.ac = { mode: 'classic', pos: null, hidden: false, items: [] };
const AC = { open: false, id: null, timer: null, fresh: false, only: null, confirm: false };
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
    add('mem', 'atencao', 2, () => Store.persistent ? '' : `<div class="banner warn"><span><b>Armazenamento.</b> O armazenamento do navegador não está disponível aqui. Os dados valem só nesta sessão. Exporte uma cópia antes de sair.</span></div>`);
    add('hipo', 'hipo', 3, hypoBanner); add('hiper', 'glic', 3, hyperBanner); add('conq', 'conquista', 1, rwBanner);
    add('drv', 'backup', 2, drvBanner); add('bkp', 'backup', 2, backupBanner); add('basal', 'plano', 2, basalBanner); add('jantar', 'glic', 2, dinnerBanner);
    add('rem', 'lembrete', 2, remBanner, 'text'); add('plano', 'plano', 2, planBanner, 'text'); add('insrem', 'lembrete', 2, irBanner, 'text'); add('ca', 'pers', 2, caBanner, 'text');
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
/* A bolha fica sempre encostada numa das laterais (esquerda ou direita); só a altura é livre. Margem de baixo respeita a barra de navegação. */
/* Escala entre os pixels da tela (retângulos e ponteiro) e os do estilo: o app usa "zoom" no html, então medimos pela própria bolha. */
const acK = b => { if (!b || b.classList.contains('drag')) return (b && b._k) || 1; const w = b.getBoundingClientRect().width; return w > 8 ? w / AC_SIZE : (b._k || 1); };
function acBounds(k) { k = k || 1; const nav = document.getElementById('nav'), nh = nav ? nav.getBoundingClientRect().height : 0; return { M: 6 * k, TOP: 64 * k, BOT: (nh || 64 * k) + 10 * k }; }
function acPlace(left, top) {
  const b = document.getElementById('acb'); if (!b) return; const k = b._k = acK(b), sz = AC_SIZE * k, vw = innerWidth, vh = innerHeight, { M, TOP, BOT } = acBounds(k), p = S.ac.pos || { fx: 1, fy: .62 }, side = p.fx >= .5 ? 1 : 0;
  const L = left != null ? left : (side ? vw - sz - M : M), T = top != null ? top : TOP + p.fy * (vh - sz - TOP - BOT);
  b.style.left = Math.min(vw - sz - M, Math.max(M, L)) / k + 'px'; b.style.top = Math.min(vh - sz - BOT, Math.max(TOP, T)) / k + 'px'; b.dataset.side = side ? 'r' : 'l';
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
  const k = b._k || acK(b), r = b.getBoundingClientRect(), vw = innerWidth, vh = innerHeight, W = Math.min(340 * k, vw - 24 * k); p.style.width = W / k + 'px';
  const left = Math.min(vw - W - 12 * k, Math.max(12 * k, r.left + r.width / 2 - W / 2)), above = r.top + r.height / 2 > vh / 2;
  p.style.left = left / k + 'px'; p.classList.toggle('below', !above);
  p.style.maxHeight = Math.max(160, ((above ? r.top : vh - r.bottom) - 24 * k) / k) + 'px';
  if (above) { p.style.bottom = (vh - r.top + 8 * k) / k + 'px'; p.style.top = 'auto'; } else { p.style.top = (r.bottom + 8 * k) / k + 'px'; p.style.bottom = 'auto'; }
  p.style.setProperty('--tx', (r.left + r.width / 2 - left) / k + 'px'); p.style.transformOrigin = (r.left + r.width / 2 - left) / k + 'px ' + (above ? '100%' : '0%');
}
/* ícones (traço, 24×24) */
const ACI = {
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', all: '<path d="M2 12.5l4.5 4.5L15 8M10 16l1 1L21 7.5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  snooze: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M5 3.5L2.5 6M19 3.5L21.5 6"/>', plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>', bellOff: '<path d="M6 16v-5a6 6 0 0 1 9-5.2M18 11v5l1.5 2H8"/><path d="M10 21h4M4 4l16 16"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>', cloud: '<path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 9.5 4 4 0 0 1 17 18z"/><path d="M12 15v-5M9.5 12.5L12 10l2.5 2.5"/>', retry: '<path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', clear: '<path d="M4 7h11M4 12h11M4 17h7M16 14l5 5M21 14l-5 5"/>', drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  pill: '<path d="M10.5 3.5l10 10a4.2 4.2 0 0 1-6 6l-10-10a4.2 4.2 0 0 1 6-6zM9 9l6 6"/>', sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>', award: '<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 21l5-3 5 3-1.5-7.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', spark: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>', doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>', chart: '<path d="M5 20v-7M12 20V5M19 20v-10"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>', tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>'
};
const acSvg = (k, s) => `<svg viewBox="0 0 24 24" width="${s || 18}" height="${s || 18}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ACI[k] || ACI.arrow}</svg>`;
const AC_CIC = { hipo: 'warn', glic: 'drop', lembrete: 'bell', plano: 'pill', backup: 'cloud', pers: 'sliders', conquista: 'award', info: 'info', conf: 'ok', atencao: 'warn', ia: 'spark', rel: 'doc', analise: 'chart', config: 'gear' };
/* ação original de cada botão das faixas -> ícone (o botão original é mantido, com os mesmos data-*; só muda a aparência) */
const AC_ACT = { 'new': 'plus', 'pl-done': 'ok', 'ir-confirm': 'ok', 'ca-ok': 'ok', 'pl-snooze': 'snooze', 'ir-open': 'snooze', 'bk-snooze': 'snooze', 'hypo-open': 'warn', 'go': 'eye', 'rw-open': 'eye', 'bk-json': 'cloud', 'drv-retry': 'retry', 'rm-examples': 'trash', 'rem-off': 'bellOff', 'hypo-off': 'bellOff', 'hyper-off': 'bellOff', 'rw-dismiss': 'bellOff', 'drv-dismiss': 'bellOff', 'label-now': 'tag' };
const acBtnKind = (bt, label) => AC_ACT[bt.dataset.act] || (/dispens|fechar|×|depois/i.test(label) ? 'bellOff' : /feito|entendi|confirm|ok\b/i.test(label) ? 'ok' : 'arrow');
const acTmpl = h => { const t = document.createElement('template'); t.innerHTML = h; return t.content; };
function acActions(it) {
  if (!it.active || !it.html) return { h: '', n: 0 };
  const bs = [...acTmpl(it.html).querySelectorAll('button')];
  return { n: bs.length, h: bs.map(bt => {
    const label = acNorm(bt.getAttribute('aria-label') || bt.textContent) || 'Ação', c = bt.cloneNode(false);
    c.className = 'acr-i act' + (bt.classList.contains('pri') ? ' pri' : ''); c.removeAttribute('style'); c.setAttribute('title', label); c.setAttribute('aria-label', label); c.innerHTML = acSvg(acBtnKind(bt, label), 17); return c.outerHTML;
  }).join('') };
}
function acMsg(it) {
  if (it.active && it.html) { const f = acTmpl(it.html); f.querySelectorAll('button').forEach(n => n.remove()); const x = acNorm(f.textContent); if (x) return x; }
  return it.text || it.title || '';
}
function acRow(it) {
  const d = new Date(it.ts), tm = pad(d.getHours()) + ':' + pad(d.getMinutes()), cat = AC_CATS[it.cat] || 'Alerta', a = acActions(it), n = a.n + (it.read ? 0 : 1) + 1;
  return `<div class="acr${it.read ? ' read' : ''}${it.active && it.prio >= 3 ? ' crit' : ''}" data-ac-row="${it.id}" role="group" aria-label="${esc(cat)}" title="${esc(cat)} · ${tm}"><span class="acr-c" aria-hidden="true">${acSvg(AC_CIC[it.cat] || 'info', 15)}</span>
    <p class="acr-m"><span class="acr-tm num">${tm}</span>${esc(acMsg(it))}${it.n > 1 ? ` <span class="acr-n">${it.n}×</span>` : ''}</p>
    <span class="acr-a" style="--rows:${n > 3 ? 2 : 1}">${a.h}${it.read ? '' : `<button class="acr-i" data-ac="read" data-id="${it.id}" title="Marcar como lido" aria-label="Marcar como lido">${acSvg('ok', 16)}</button>`}<button class="acr-i" data-ac="dismiss" data-id="${it.id}" title="Dispensar" aria-label="Dispensar este alerta">${acSvg('x', 16)}</button></span></div>`;
}
function acPanel() {
  const p = document.getElementById('acp'); if (!p) return; const all = acList(); let list = all;
  if (AC.only) { const o = all.filter(x => x.id === AC.only); if (o.length) list = o; else AC.only = null; }
  if (AC.confirm && all.length < 2) AC.confirm = false;
  const ib = (a, ic, t, cls) => `<button class="acp-i${cls ? ' ' + cls : ''}" data-ac="${a}" title="${t}" aria-label="${t}">${acSvg(ic, 17)}</button>`;
  const head = AC.only ? '' : AC.confirm
    ? `<div class="acp-h2"><span class="acp-q">Dispensar todos (${all.length})?</span><span class="acp-ctl">${ib('dismissall-yes', 'ok', 'Sim, dispensar todos', 'yes')}${ib('dismissall-no', 'x', 'Cancelar', 'no')}</span></div>`
    : `<div class="acp-h2"><span class="acp-ti">${acSvg('bell', 16)}<b>Alertas</b>${all.length ? `<span class="num">${all.length}</span>` : ''}</span><span class="acp-ctl">${ib('hist', 'clock', 'Histórico de alertas')}${all.length ? ib('readall', 'all', 'Marcar todos como lidos') + ib('dismissall', 'clear', 'Dispensar todos os alertas') : ''}</span></div>`;
  const body = list.length ? `<div class="acp-l">${list.slice(0, 40).map(acRow).join('')}</div>` : `<div class="acp-l"><div class="acr read"><span class="acr-c" aria-hidden="true">${acSvg('ok', 15)}</span><p class="acr-m">Nenhum alerta no momento.</p><span></span></div></div>`;
  const h = head + body; if (p._h !== h) { p.innerHTML = h; p._h = h; }
  acPanelPos();
}
function acDismiss(ids) {
  const p = document.getElementById('acp'); AC.confirm = false;
  if (p) ids.forEach((id, k) => { const r = p.querySelector(`[data-ac-row="${id}"]`); if (r) { r.style.transitionDelay = Math.min(k, 6) * 30 + 'ms'; r.classList.add('out'); } });
  setTimeout(() => { for (const id of ids) { const it = S.ac.items.find(x => x.id === id); if (it) { it.dismissed = true; it.read = true; } } acSave(); AC.only = null; if (!acList().length) acCollapse(); acRefresh(); if (AC.open) acTimer(12000); }, 200 + Math.min(ids.length, 6) * 30);
}
function acPop(it, ms) {
  acEnsure(); const b = document.getElementById('acb'); if (!b) return;
  S.ac.hidden = false; AC.id = it ? it.id : null; AC.confirm = false; AC.only = it && it.src === 'toast' && it.prio === 0 ? it.id : null; acOpen(ms || (it && it.prio >= 3 ? 14000 : 8000));
}
function acOpen(ms) {
  const b = document.getElementById('acb'), p = document.getElementById('acp'); if (!b || !p || b.hidden && !acBubbleOn()) return;
  b.hidden = false; AC.open = true; b.setAttribute('aria-expanded', 'true'); acPanel(); p.hidden = false;
  p.classList.add('fresh'); setTimeout(() => p.classList.remove('fresh'), 600); requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('on'))); acTimer(ms || 10000);
}
function acTimer(ms) { clearTimeout(AC.timer); AC.timer = setTimeout(() => acCollapse(), ms); }
function acCollapse(now) {
  clearTimeout(AC.timer); const p = document.getElementById('acp'), b = document.getElementById('acb'); if (!p) return;
  if (AC.open) { /* toasts de confirmação são lidos ao recolher */ const it = S.ac.items.find(x => x.id === AC.id); if (it && it.src === 'toast' && it.prio === 0 && !it.read) { it.read = true; acSave(); } }
  AC.open = false; AC.confirm = false; if (b) b.setAttribute('aria-expanded', 'false'); p.classList.remove('on');
  if (now) { p.hidden = true; return; } setTimeout(() => { if (!AC.open) p.hidden = true; }, 260);
  if (b) { const n = acUnread(), nb = b.querySelector('.acb-n'); nb.hidden = !n; nb.textContent = n > 9 ? '9+' : n; }
}
/* ----- gestos: tocar abre o último alerta; arrastar reposiciona; arrastar para baixo até a área de descarte dispensa ----- */
function acBind(b) {
  let d = null; const z = () => document.getElementById('acz');
  const zone = () => { const vw = innerWidth, vh = innerHeight; return { x: vw / 2, y: vh - 56 - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0) }; };
  b.addEventListener('pointerdown', e => { if (e.button > 0) return; try { b.setPointerCapture(e.pointerId); } catch (x) { } b._k = acK(b); const r = b.getBoundingClientRect(); d = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, t: Date.now(), moved: false, hot: false }; });
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
    if (!g.moved) { if (AC.open) acCollapse(); else { const l = acList(); AC.id = l[0] ? l[0].id : null; AC.only = null; acOpen(12000); } return; }
    const r = b.getBoundingClientRect(), vh = innerHeight;
    if (g.hot) { b.classList.add('gone'); setTimeout(() => { S.ac.hidden = true; b.classList.remove('gone'); acSave(); acRefresh(); }, 220); return; }
    if (r.top + r.height / 2 > vh * .72 && e.clientY - g.sy > 40) { b.classList.add('back'); acPlace(g.ox, g.oy); setTimeout(() => b.classList.remove('back'), 300); return; } /* arrastou para baixo sem chegar à área de descarte: volta */
    const vw = innerWidth, k = b._k || 1, { TOP, BOT } = acBounds(k); S.ac.pos = { fx: (r.left + r.width / 2) > vw / 2 ? 1 : 0, fy: Math.min(1, Math.max(0, (r.top - TOP) / (vh - AC_SIZE * k - TOP - BOT))) }; acSave(); b.classList.add('snap'); acPlace(); setTimeout(() => b.classList.remove('snap'), 340); /* encaixe automático na margem mais próxima */
  };
  b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
  b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (AC.open) acCollapse(); else { const l = acList(); AC.id = l[0] ? l[0].id : null; AC.only = null; acOpen(12000); } } });
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-ac]'); const inP = e.target.closest('#acp');
  if (el) {
    const a = el.dataset.ac, id = el.dataset.id;
    if (a === 'read') acSetState(id, { read: true });
    else if (a === 'dismiss') { acDismiss([id]); acTimer(12000); return; }
    else if (a === 'dismissall') { const l = acList(); if (l.length > 1) { AC.confirm = true; acPanel(); acTimer(8000); return; } acDismiss(l.map(x => x.id)); return; } /* com mais de um alerta, pede confirmação antes de dispensar todos */
    else if (a === 'dismissall-yes') { acDismiss(acList().map(x => x.id)); return; }
    else if (a === 'dismissall-no') { AC.confirm = false; }
    else if (a === 'readall') { S.ac.items.forEach(x => { if (!x.dismissed) x.read = true; }); acSave(); acRefresh(); }
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
  <p class="hint" style="margin:10px 0 0">A escolha vale na hora e fica salva. Os dois modos usam o mesmo histórico: trocar muda só a aparência, nunca os alertas. Tudo fica dentro do app, sem som, vibração nem notificação do Android.</p>
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
