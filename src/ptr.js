/* ================= Arrastar para baixo para atualizar (pull-to-refresh) =================
   Só vale quando a página está no topo e o gesto começa em área livre. Atualizar = reler os dados salvos
   no aparelho e redesenhar a página atual. Não grava, não apaga e não muda nada do que está salvo. */
const PTR = { busy: false, on: false, y0: 0, x0: 0, d: 0, id: 0 };
const PTR_TRIGGER = 72, PTR_MAX = 96;
(function () {
  const SKIP = '.in-grip, input, textarea, select, [contenteditable], [role=slider], [role=spinbutton], .uip, .chart, .xscroll, #acb, #acp, #acz, #dr, #lk, .sheet-bg, .rw-bg, .pm-bg';
  const calm = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const top = () => (document.scrollingElement || document.documentElement).scrollTop <= 0;
  /* algum contêiner que rola (horizontal ou vertical) entre o toque e a página? então não é com a gente */
  const scroller = el => { for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 2) return true; if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 2) return true; } return false; };
  const el = () => { let e = document.getElementById('ptr'); if (!e) { e = document.createElement('div'); e.id = 'ptr'; e.setAttribute('aria-hidden', 'true'); e.innerHTML = '<svg viewBox="0 0 24 24"><circle class="ptr-bg" cx="12" cy="12" r="9"/><circle class="ptr-ar" cx="12" cy="12" r="9"/></svg>'; document.body.appendChild(e); } return e; };
  const paint = (d, spin) => {
    const e = el(), p = Math.min(1, d / PTR_TRIGGER), v = document.getElementById('view');
    e.style.transform = `translate(-50%, ${Math.round(Math.min(d, PTR_MAX) - 44)}px) scale(${(.6 + .4 * p).toFixed(2)})`; e.style.opacity = String(Math.min(1, p * 1.2));
    e.classList.toggle('spin', !!spin); e.classList.toggle('rdy', p >= 1); e.style.setProperty('--p', String(p));
    if (v && !calm()) { v.style.transition = 'none'; v.style.transform = d ? `translateY(${Math.round(Math.min(d, PTR_MAX) * .45)}px)` : ''; }
  };
  const rest = anim => { const e = el(), v = document.getElementById('view'); e.classList.add('back'); e.style.transform = 'translate(-50%, -48px) scale(.6)'; e.style.opacity = '0'; e.classList.remove('spin', 'rdy');
    if (v) { v.style.transition = anim && !calm() ? 'transform .22s ease' : ''; v.style.transform = ''; setTimeout(() => { v.style.transition = ''; }, 240); } setTimeout(() => e.classList.remove('back'), 260); };
  async function refresh() {
    if (PTR.busy) return; PTR.busy = true; const t0 = Date.now(), off = navigator.onLine === false;
    paint(PTR_TRIGGER, true); let ok = true;
    try { await loadAll(); if (typeof iaIsRoute === 'function' && iaIsRoute(S.route) && typeof iaCheck === 'function') iaCheck(true); if (typeof acRefresh === 'function') acRefresh(); } catch (e) { ok = false; }
    const w = 650 - (Date.now() - t0); if (w > 0) await new Promise(r => setTimeout(r, w));
    try { render(); } catch (e) { ok = false; }
    rest(true); PTR.busy = false;
    if (!ok) toast('Não deu para atualizar agora. Seus dados continuam salvos.'); else if (off) toast('Sem internet. Mostrando os dados salvos no aparelho.');
  }
  document.addEventListener('touchstart', e => {
    PTR.on = false; PTR.armed = false;
    if (PTR.busy || e.touches.length !== 1 || !top() || DR.open || !document.getElementById('view')) return;
    if (document.querySelector('.sheet-bg, .rw-bg, #lk') || (document.activeElement && document.activeElement.matches && document.activeElement.matches('input, textarea, select'))) return;
    if (e.target.closest && (e.target.closest(SKIP) || scroller(e.target))) return;
    const t = e.touches[0]; PTR.x0 = t.clientX; PTR.y0 = t.clientY; PTR.d = 0; PTR.armed = true;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!PTR.armed) return; if (e.touches.length !== 1 || !top()) { if (PTR.on) { rest(true); } PTR.on = false; PTR.armed = false; return; }
    const t = e.touches[0], dy = t.clientY - PTR.y0, dx = t.clientX - PTR.x0;
    if (!PTR.on) { if (dy < 0 || Math.abs(dx) > Math.abs(dy) || (Math.abs(dy) < 10 && Math.abs(dx) < 10)) { if (dy < -8 || Math.abs(dx) > 14) PTR.armed = false; return; } if (dy < 10) return; PTR.on = true; }
    PTR.d = Math.max(0, (dy - 10) * .55); paint(PTR.d, false);
  }, { passive: true });
  const end = () => { if (!PTR.armed) return; const was = PTR.on, d = PTR.d; PTR.on = false; PTR.armed = false; if (!was) return; if (d >= PTR_TRIGGER) refresh(); else rest(true); };
  document.addEventListener('touchend', end, { passive: true }); document.addEventListener('touchcancel', () => { if (PTR.on) rest(true); PTR.on = false; PTR.armed = false; }, { passive: true });
})();
