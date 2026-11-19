/* ================= Padrão dos botões · retorno ao toque =================
   Só liga e desliga duas classes de aparência (veja buttons.css):
     .is-press  → enquanto o dedo/mouse está pressionado
     .is-hit    → ~0,6 s depois do clique (confirmação visual)
   Não impede, não atrasa e não troca nenhuma ação: usa ouvintes passivos e deixa o clique seguir.   */
const BT_SEL = 'button, summary, label.mk, [role="button"], .rec';
const BT_SKIP = '.acb, #hscrub, .sc-thumb';
function btOf(e) {
  const t = e.target; if (!t || !t.closest) return null;
  const b = t.closest(BT_SEL); if (!b || b.closest(BT_SKIP)) return null;
  if (b.disabled || b.getAttribute('aria-disabled') === 'true') return null;
  return b;
}
function btRelease() { document.querySelectorAll('.is-press').forEach(x => x.classList.remove('is-press')); }
document.addEventListener('pointerdown', e => { const b = btOf(e); if (b) b.classList.add('is-press'); }, { capture: true, passive: true });
['pointerup', 'pointercancel', 'dragstart', 'contextmenu'].forEach(n => document.addEventListener(n, btRelease, { capture: true, passive: true }));
window.addEventListener('blur', btRelease); document.addEventListener('scroll', btRelease, { capture: true, passive: true });
document.addEventListener('click', e => {
  const b = btOf(e); if (!b) return;
  b.classList.remove('is-press'); b.classList.add('is-hit');
  clearTimeout(b.__hit); b.__hit = setTimeout(() => b.classList.remove('is-hit'), 650);
}, { capture: true, passive: true });

/* ---- Depois do toque, o botão não aceita outro toque por um instante ----
   Evita registro em dobro (duas doses, duas medições, dois envios). Vale para todos os botões;
   a trava dura 0,7 s e é visual (.is-lock) e de acessibilidade (aria-busy). Se a tela for redesenhada, o botão novo já nasce livre.
   Botões marcados com data-rep (se um dia precisarem de toques seguidos) ficam de fora. */
const BT_LOCK_MS = 700;
document.addEventListener('click', e => {
  const t = e.target; if (!t || !t.closest) return;
  const b = t.closest('button, [role="button"]'); if (!b || b.closest(BT_SKIP) || b.hasAttribute('data-rep') || b.classList.contains('rm-b')) return;
  if (b.__lock) { e.preventDefault(); e.stopImmediatePropagation(); return; }
  b.__lock = true; b.classList.add('is-lock'); b.setAttribute('aria-busy', 'true');
  setTimeout(() => { b.__lock = false; b.classList.remove('is-lock'); b.removeAttribute('aria-busy'); }, BT_LOCK_MS);
}, true);
