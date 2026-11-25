/* ================= Textos informativos longos: "Ler mais" / "Mostrar menos" =================
   Texto com mais de 2 linhas vira bloco recolhido e vai para o fim da sua seção (ou da página).
   O conteúdo não é alterado: só fica escondido (cortado em 2 linhas) até a pessoa tocar em "Ler mais".
   A página Análises não é tocada. Não vale para campos, avisos, alertas, indicadores nem textos com botões. */
const RM_OPEN = new Set();
/* avisos de segurança, privacidade, cobrança e passos indispensáveis ficam sempre visíveis */
const RM_KEEP = /^\s*(Atenção|Aviso|Importante|Privacidade|Cobrança|Limites|Em \d+ passos|Cuidado)\b|não use para decidir|nunca (mude|altere|ajuste)|só com orientação|emergência|hipoglicemia grave/i;
(function () {
  const CAND = '.hint, p.dim';
  const NO = '.field, label, .al-l, .banner, .err, [role=alert], [role=status], .sf-note, .acc-ctl, summary, button, .nav, .chips, .tag, .badge, .anaf, .seg, .rm-b, .tip, .gauge-box, .lg-box, .atag';
  const MOVE_IN = '.card, .acc-b, .stack, .pl-card';
  const calm = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const lineH = el => { const cs = getComputedStyle(el), l = parseFloat(cs.lineHeight); return isFinite(l) ? l : (parseFloat(cs.fontSize) || 15) * 1.5; };
  const ok = el => !el.dataset.rm && !el.id && !el.closest(NO) && !el.querySelector('button, input, select, textarea, a, svg') && !/^\s*(✓|Verificando)/.test(el.textContent) && !RM_KEEP.test(el.textContent) && el.textContent.trim().length > 60;
  const key = (el, route) => route + '|' + el.textContent.trim().slice(0, 60);
  function place(el, view) {
    const p = el.parentElement; if (!p) return;
    const rest = [...el.parentElement.children].slice([...p.children].indexOf(el) + 1).filter(x => !x.matches('.rm-b') && !x.matches('.hint, p.dim') && !x.hidden);
    if (!rest.length) return;
    if (p === view) { const last = view.lastElementChild; if (last && last.matches('.sf-note.bottom, .sf-note')) view.insertBefore(el, last); else view.appendChild(el); }
    else if (p.matches(MOVE_IN)) { const foot = p.querySelector(':scope > .gx-out-wrap'); if (foot) p.insertBefore(el, foot); else p.appendChild(el); } /* o botão de sair da conta fica sempre por último no cartão */
  }
  function setup(el, route) {
    const lh = lineH(el), k = key(el, route); el.dataset.rm = '1'; el.classList.add('rm-t'); el.dataset.lh = String(lh);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'rm-b'; b.textContent = 'Ler mais'; b.setAttribute('aria-expanded', 'false');
    el.after(b);
    const full = () => el.scrollHeight;
    const open = (animate) => { b.setAttribute('aria-expanded', 'true'); b.textContent = 'Mostrar menos'; el.classList.add('rm-o');
      if (!animate || calm()) { el.style.maxHeight = 'none'; return; } el.style.maxHeight = full() + 'px'; setTimeout(() => { if (el.classList.contains('rm-o')) el.style.maxHeight = 'none'; }, 240); };
    const close = (animate) => { b.setAttribute('aria-expanded', 'false'); b.textContent = 'Ler mais'; el.classList.remove('rm-o');
      if (!animate || calm()) { el.style.maxHeight = lh * 2 + 'px'; return; } el.style.maxHeight = full() + 'px'; void el.offsetHeight; el.style.maxHeight = lh * 2 + 'px'; };
    el.style.maxHeight = lh * 2 + 'px';
    b.addEventListener('click', () => { if (el.classList.contains('rm-o')) { RM_OPEN.delete(k); close(true); } else { RM_OPEN.add(k); open(true); } });
    if (RM_OPEN.has(k)) open(false);
  }
  window.rmScan = function (root) {
    const view = document.getElementById('view'); if (!view || S.route === 'analise') return; root = root || view;
    const route = S.route; let moved = false;
    [...root.querySelectorAll(CAND)].forEach(el => {
      if (!ok(el) || el.clientHeight === 0 || el.offsetParent === null) return;
      if (el.scrollHeight <= lineH(el) * 2 + 3) { el.dataset.rm = 'n'; return; }
      if (el.closest('.rm-t')) return;
      place(el, view); setup(el, route); moved = true;
    });
    return moved;
  };
  let t = 0; const later = () => { clearTimeout(t); t = setTimeout(() => { try { rmScan(); } catch (e) { } }, 140); };
  const start = () => { const v = document.getElementById('view'); if (!v) return; new MutationObserver(later).observe(v, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'open'] }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.addEventListener('resize', () => { document.querySelectorAll('#view [data-rm="n"]').forEach(e => { delete e.dataset.rm; }); later(); });
})();
