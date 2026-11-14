/* ---------- Menu lateral (Navigation Drawer) ----------
   Abre ao tocar no avatar da barra superior ou ao deslizar a partir da borda esquerda.
   Módulos: DR_ICONS (ícones) · drMetrics · drBody (conteúdo) · drOpen/drClose (estado) · gestos · teclado. */
const DR_IC = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>', list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  chart: '<path d="M4 20V11M10 20V4M16 20v-7M22 20H2"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
  pill: '<path d="M10.5 20.5a5 5 0 0 1-7-7l9-9a5 5 0 0 1 7 7z"/><path d="M8.5 8.5l7 7"/>',
  drop: '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/>', cloud: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9z"/>',
  more: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
  chev: '<path d="M6 9l6 6 6-6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', dot: '<path d="M9 6l6 6-6 6"/>'
};
const drIc = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${DR_IC[k] || DR_IC.dot}</svg>`;
const DR = { open: false, more: false, last: null };
const DR_MAIN = [['painel', 'Painel', 'home'], ['historico', 'Histórico', 'list'], ['analise', 'Análise', 'chart'], ['perfil', 'Meu Perfil', 'user'], ['bolus', 'Cálculo de bolus', 'calc'], ['esquemas', 'Esquemas de tratamento', 'pill'], ['hba1c', 'Hemoglobina glicada', 'drop'], ['backup', 'Backup e dados', 'cloud']];

function drMetrics() {
  const rs = S.records.filter(r => !isEx(r)), n = rs.length;
  if (!n) return [['—', 'medições'], ['—', 'última'], ['—', 'média 30 d']];
  const last = rs.reduce((a, b) => (b.ts > a.ts ? b : a)), lim = Date.now() - 30 * 864e5;
  const m = rs.filter(r => r.ts >= lim && Number.isFinite(r.glucose)), mean = m.length ? Math.round(m.reduce((s, r) => s + r.glucose, 0) / m.length) : null;
  return [[String(n), n === 1 ? 'medição' : 'medições'], [Number.isFinite(last.glucose) ? String(Math.round(last.glucose)) : '—', 'última mg/dL'], [mean == null ? '—' : String(mean), 'média 30 d mg/dL']];
}
function drItem(r, t, i, sub) {
  const cur = S.route === r || hubOf(S.route) === r ? ' aria-current="page"' : '';
  return `<button class="dr-it${sub ? ' sub' : ''}" type="button" data-dr-go="${r}"${cur}>${sub ? '' : drIc(i)}<span>${esc(t)}</span></button>`;
}
function drMore() {
  const used = new Set(DR_MAIN.map(x => x[0]).concat(['config', 'sobre', 'mais'])), seen = new Set(), out = [];
  for (const g of Object.values(menuGroups())) for (const x of g.items) { if (used.has(x[0]) || seen.has(x[0]) || !VIEWS[x[0]]) continue; seen.add(x[0]); out.push([x[0], x[1]]); }
  for (const [r, t] of [['relatorios', 'Relatórios'], ['importar', 'Importar do mySugr'], ['padroes', 'Padrões'], ['conquistas', 'Conquistas'], ['eventos', 'Eventos'], ['sobre', 'Sobre e limites']]) if (VIEWS[r] && !seen.has(r)) { seen.add(r); out.push([r, t]); }
  return out;
}
function drBody() {
  const p = S.profile || {}, name = p.name || '', type = p.type && p.type !== 'Prefiro não informar' ? p.type : '';
  const light = themeEff() === 'light', mt = drMetrics();
  return `<div class="dr-head"><button class="dr-x" type="button" data-dr-close aria-label="Fechar menu">${drIc('x')}</button>
    <button class="dr-me" type="button" data-dr-go="perfil" aria-label="Abrir Meu Perfil"><span class="dr-av pf-av">${pfAvatarHTML()}</span></button>
    <div class="dr-name">${esc(name || 'Seu perfil')}</div><div class="dr-sub">${esc(type ? 'Diabetes ' + type : (name ? 'Ver e editar perfil' : 'Toque para criar o seu perfil'))}</div>
    <div class="dr-met">${mt.map(m => `<div><b>${esc(m[0])}</b><span>${esc(m[1])}</span></div>`).join('')}</div></div>
  <nav class="dr-nav" aria-label="Menu principal">${DR_MAIN.filter(x => VIEWS[x[0]]).map(x => drItem(x[0], x[1], x[2])).join('')}
    <button class="dr-it dr-mb" type="button" data-dr-more aria-expanded="${DR.more}" aria-controls="dr-more">${drIc('more')}<span>Mais</span><i class="dr-ch${DR.more ? ' on' : ''}">${drIc('chev')}</i></button>
    <div class="dr-more${DR.more ? ' on' : ''}" id="dr-more"><div>${drMore().map(x => drItem(x[0], x[1], '', true)).join('')}</div></div></nav>
  <div class="dr-foot">
    <button class="dr-it" type="button" data-dr-theme role="switch" aria-checked="${light}">${drIc(light ? 'sun' : 'moon')}<span>Tema ${light ? 'claro' : 'escuro'}</span><i class="dr-sw${light ? ' on' : ''}"></i></button>
    <button class="dr-it" type="button" data-dr-go="config">${drIc('gear')}<span>Configurações e Privacidade</span></button>
    <button class="dr-it" type="button" data-dr-go="sobre">${drIc('help')}<span>Central de Ajuda</span></button></div>`;
}
function drEnsure() {
  if (document.getElementById('dr')) return;
  const bg = document.createElement('div'); bg.className = 'dr-bg'; bg.id = 'dr-bg'; bg.setAttribute('data-dr-close', '');
  const a = document.createElement('aside'); a.className = 'dr'; a.id = 'dr'; a.setAttribute('role', 'dialog'); a.setAttribute('aria-modal', 'true'); a.setAttribute('aria-label', 'Menu de navegação'); a.setAttribute('inert', '');
  document.body.append(bg, a);
}
function drOpen() {
  drEnsure(); const a = document.getElementById('dr'), bg = document.getElementById('dr-bg'); if (DR.open) return;
  DR.open = true; DR.last = document.activeElement; a.innerHTML = drBody(); a.removeAttribute('inert'); a.style.transform = ''; bg.style.opacity = '';
  a.classList.add('on'); bg.classList.add('on'); document.documentElement.classList.add('dr-lock');
  const b = document.getElementById('pfb'); if (b) b.setAttribute('aria-expanded', 'true');
  setTimeout(() => { const f = a.querySelector('.dr-me'); if (f) f.focus({ preventScroll: true }); }, 30);
}
function drClose(restore) {
  const a = document.getElementById('dr'), bg = document.getElementById('dr-bg'); if (!a || !DR.open) return;
  DR.open = false; a.classList.remove('on'); bg.classList.remove('on'); a.style.transform = ''; bg.style.opacity = ''; a.setAttribute('inert', '');
  document.documentElement.classList.remove('dr-lock');
  const b = document.getElementById('pfb'); if (b) b.setAttribute('aria-expanded', 'false');
  if (restore !== false && b) b.focus({ preventScroll: true });
}
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('#pfb')) { DR.open ? drClose() : drOpen(); return; }
  if (!DR.open) return;
  const g = t.closest('[data-dr-go]');
  if (g) { const r = g.dataset.drGo; drClose(false); go(r); return; }
  if (t.closest('[data-dr-more]')) { DR.more = !DR.more; const m = document.getElementById('dr-more'), b = t.closest('[data-dr-more]'); m.classList.toggle('on', DR.more); b.setAttribute('aria-expanded', DR.more); b.querySelector('.dr-ch').classList.toggle('on', DR.more); if (DR.more) setTimeout(() => m.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 200); return; }
  if (t.closest('[data-dr-theme]')) { setTheme(themeEff() === 'light' ? 'dark' : 'light').then(() => { const a = document.getElementById('dr'); if (a && DR.open) { const y = a.scrollTop; a.innerHTML = drBody(); a.scrollTop = y; const f = a.querySelector('[data-dr-theme]'); if (f) f.focus({ preventScroll: true }); } }); return; }
  if (t.closest('[data-dr-close]')) drClose();
});
document.addEventListener('keydown', e => {
  if (!DR.open) return;
  if (e.key === 'Escape') { e.preventDefault(); drClose(); return; }
  if (e.key !== 'Tab') return;
  const f = [...document.querySelectorAll('#dr button')].filter(x => x.offsetParent !== null); if (!f.length) return;
  const i = f.indexOf(document.activeElement);
  if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
});
/* Gesto: arrastar a partir da borda esquerda abre; arrastar para a esquerda sobre o menu fecha */
(function drSwipe() {
  const W = () => Math.min(320, window.innerWidth * .86); let g = null;
  const EDGE = 40;
  /* Vale sobre qualquer superfície, menos campos, controles deslizantes e áreas que rolam na horizontal */
  const SKIP = 'input, textarea, select, [contenteditable], [role=slider]';
  const hScroll = el => { for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 2) return true; } return false; };
  const blocked = el => !el || !el.closest || !!el.closest(SKIP) || hScroll(el) || !!el.closest('#acb, #acp, #acz') || !!document.querySelector('.sheet-bg, .rw-bg, #lk');
  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return; const t = e.touches[0];
    /* o gesto de abrir o menu foi removido: o menu abre só pelo botão; o deslize para a esquerda sobre o menu aberto continua fechando */
    if (DR.open && e.target.closest('#dr, #dr-bg')) g = { m: 'close', x: t.clientX, y: t.clientY, dx: 0, on: false };
    else g = null;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!g) return; const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.on) { if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * (g.m === 'open' && !g.edge ? .6 : 1)) { g = null; return; } if (Math.abs(dx) < (g.m === 'open' && !g.edge ? 16 : 8)) return; if (g.m === 'open' && !g.edge && Math.abs(dx) < Math.abs(dy) * 1.8) return; if ((g.m === 'open' && dx < 0) || (g.m === 'close' && dx > 0)) { g = null; return; } g.on = true; if (g.m === 'open') { drOpen(); } const a = document.getElementById('dr'); a.classList.add('drag'); document.getElementById('dr-bg').classList.add('drag'); }
    g.dx = dx; const w = W(), p = g.m === 'open' ? Math.max(0, Math.min(1, dx / w)) : Math.max(0, Math.min(1, 1 + dx / w));
    const a = document.getElementById('dr'); a.style.transform = `translateX(${(p - 1) * 100}%)`; document.getElementById('dr-bg').style.opacity = String(p);
  }, { passive: true });
  const end = () => {
    if (!g) return; const on = g.on, m = g.m, dx = g.dx; g = null; if (!on) return;
    const a = document.getElementById('dr'), bg = document.getElementById('dr-bg'); a.classList.remove('drag'); bg.classList.remove('drag');
    a.style.transform = ''; bg.style.opacity = ''; const w = W(), shown = m === 'open' ? dx > w * .33 : -dx < w * .33;
    if (shown) { DR.open = true; a.classList.add('on'); bg.classList.add('on'); } else drClose(false);
  };
  document.addEventListener('touchend', end, { passive: true }); document.addEventListener('touchcancel', end, { passive: true });
})();

/* Configuração: ligar/desligar o gesto de abrir o menu */
S.swipeMenu = true;
function swipeCard() { return swipeNavCard(); }
function swipeMenuCard() {
  const on = S.swipeMenu !== false;
  return `<h2 class="sec">Gesto do menu lateral</h2><div class="card"><div class="sw-row"><div style="min-width:0"><b>Deslizar para abrir o menu</b><div class="dim" style="font-size:14px;margin-top:2px">Deslize o dedo para a direita para abrir o menu: a partir da borda esquerda da tela nas 4 páginas principais (com a navegação por gestos ligada) e em qualquer parte da tela nas demais páginas (menos em campos, controles deslizantes e áreas que rolam para o lado). Para fechar, deslize para a esquerda sobre o menu. Desligado, o menu abre só pelo botão da foto.</div></div><button class="tgl" role="switch" aria-checked="${on}" aria-label="Deslizar para abrir o menu" data-act="swipe-menu"><i>${on ? '✓' : ''}</i></button></div></div>`;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act="swipe-menu"]'); if (!el) return;
  S.swipeMenu = !(S.swipeMenu !== false); try { await Store.put('meta', { id: 'swipe-menu', value: S.swipeMenu }); } catch (x) { } render();
});

/* ================= Navegação entre páginas por gestos =================
   O gesto de abrir o menu foi removido; a tela toda navega: esquerda→direita volta; direita→esquerda avança, na ordem Painel, Histórico, Análise, Mais, sem circular.
   A zona é decidida pela posição inicial do toque. Desligar isto não afeta o gesto do menu. */
const NAV_EDGE = 0, NAV_PAGES = ['painel', 'historico', 'analise', 'mais'];
S.swipeNav = true;
const navZone = () => S.swipeNav !== false && NAV_PAGES.includes(S.route);
function swipeNavCard() {
  const on = S.swipeNav !== false;
  return `<h2 class="sec">Navegação entre páginas por gestos</h2><div class="card"><div class="sw-row"><div style="min-width:0"><b>Navegação entre páginas por gestos</b><div class="dim" style="font-size:14px;margin-top:2px">Deslize horizontalmente pela tela para avançar ou retornar entre as páginas principais (Painel, Histórico, Análise e Mais). O menu lateral abre pelo botão da foto.</div></div><button class="tgl" role="switch" aria-checked="${on}" aria-label="Navegação entre páginas por gestos" data-act="swipe-nav"><i>${on ? '✓' : ''}</i></button></div></div>`;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act="swipe-nav"]'); if (!el) return;
  S.swipeNav = !(S.swipeNav !== false); try { await Store.put('meta', { id: 'swipe-nav', value: S.swipeNav }); } catch (x) { } render();
});
(function navSwipe() {
  let g = null;
  const SKIP = 'input, textarea, select, button[role=slider], [contenteditable], [role=slider], svg, canvas, .tbl-wrap, [data-noswipe], #acb, #acp, #acz';
  const hScroll = el => { for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 2) return true; } return false; };
  const blocked = el => !el || !el.closest || !!el.closest(SKIP) || hScroll(el) || DR.open || !!S.pm || !!document.querySelector('.sheet-bg, .rw-bg, #lk');
  const target = dx => { const i = NAV_PAGES.indexOf(S.route), j = dx > 0 ? i - 1 : i + 1; return j >= 0 && j < NAV_PAGES.length ? NAV_PAGES[j] : null; };
  const calm = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const reset = (v, anim) => { v.style.transition = anim ? 'transform .18s ease, opacity .18s ease' : ''; v.style.transform = ''; v.style.opacity = ''; if (anim) setTimeout(() => { v.style.transition = ''; }, 200); };
  document.addEventListener('touchstart', e => {
    g = null; if (e.touches.length !== 1 || !navZone()) return; const t = e.touches[0];
    if (t.clientX <= NAV_EDGE || blocked(e.target)) return;
    g = { x: t.clientX, y: t.clientY, t: Date.now(), dx: 0, lock: false };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!g) return; if (e.touches.length !== 1 || DR.open || !navZone()) { const v = document.getElementById('view'); if (v && g.lock) reset(v, false); g = null; return; }
    const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.lock) {
      if (Math.abs(dy) > 14 && Math.abs(dy) >= Math.abs(dx) * .55) { g = null; return; } /* rolagem vertical */
      if (Math.abs(dx) < 14) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.8) return;
      g.lock = true;
    }
    g.dx = dx; const v = document.getElementById('view'); if (!v || calm()) return;
    const k = target(dx) ? .35 : .08; v.style.transition = 'none'; v.style.transform = `translateX(${Math.round(dx * k)}px)`; v.style.opacity = String(1 - Math.min(.4, Math.abs(dx) / 700));
  }, { passive: true });
  const end = () => {
    if (!g) return; const { dx, lock, t } = g; g = null; const v = document.getElementById('view'); if (!lock || !v) return;
    const dt = Math.max(1, Date.now() - t), to = target(dx), ok = to && DR.open === false && Math.abs(dx) >= 80 && (Math.abs(dx) >= 130 || Math.abs(dx) / dt >= .3);
    if (!ok) { reset(v, !calm()); return; }
    const sg = dx > 0 ? 1 : -1;
    if (calm()) { reset(v, false); go(to); return; }
    v.style.transition = 'transform .12s ease-in, opacity .12s ease-in'; v.style.transform = `translateX(${sg * 48}px)`; v.style.opacity = '0';
    setTimeout(() => {
      if (S.route === to) return; go(to); const nv = document.getElementById('view'); if (!nv) return;
      nv.style.transition = 'none'; nv.style.transform = `translateX(${-sg * 48}px)`; nv.style.opacity = '0';
      requestAnimationFrame(() => requestAnimationFrame(() => { nv.style.transition = 'transform .2s ease-out, opacity .2s ease-out'; nv.style.transform = ''; nv.style.opacity = ''; setTimeout(() => { nv.style.transition = ''; }, 230); }));
    }, 120);
  };
  document.addEventListener('touchend', end, { passive: true }); document.addEventListener('touchcancel', () => { const v = document.getElementById('view'); if (g && g.lock && v) reset(v, true); g = null; }, { passive: true });
})();
