/* GLUXO · Toque fora de um card aberto = UMA ação só: fechar. Nunca fechar e acionar o que está atrás.
   Causa do problema: as folhas fecham no "pointerdown" e o "click" do mesmo toque, que vem depois, caía no elemento da página que
   ficou sob o dedo. Aqui, ao detectar um toque no fundo de um card/painel aberto, o toque é consumido: os eventos de mouse/click
   que seguem esse mesmo toque são engolidos (fase de captura) até o toque acabar. Não muda animações, tamanhos nem o conteúdo dos cards.
   Cobertura: folhas (#sheet-bg, #pm-bg, #gl-over), cartão de conquista (#rw-bg), menu lateral (#dr-bg) e painel da bolha de alertas (#acp). */
(function () {
  const G = { on: false, fail: 0, rel: 0 };
  const SWALLOW = ['click', 'dblclick', 'auxclick', 'mousedown', 'mouseup'];
  const disarm = () => { G.on = false; clearTimeout(G.fail); clearTimeout(G.rel); };
  const arm = () => { disarm(); G.on = true; G.fail = setTimeout(disarm, 10000); };
  /* Qual card está aberto e foi tocado por fora? Devolve o nome ou null. */
  function outsideOf(t) {
    if (!t || !t.closest) return null;
    const rw = document.getElementById('rw-bg'); if (rw && rw.contains(t)) return t.closest('.rw-card') ? null : 'rw';
    if (typeof DR !== 'undefined' && DR.open && t.closest('#dr-bg')) return 'dr';
    if (t.classList && t.classList.contains('sheet-bg')) return 'sheet'; // o próprio fundo da folha (as folhas já fecham sozinhas)
    if (typeof AC !== 'undefined' && AC.open && !t.closest('#acp, #acb, .sheet, .rw-card, #dr')) return 'ac'; // o painel já se recolhe sozinho
    return null;
  }
  document.addEventListener('pointerdown', e => {
    if (e.button > 0) return; const k = outsideOf(e.target); if (!k) return;
    arm();
    if (k === 'dr') { try { drClose(); } catch (x) { } }
    else if (k === 'rw') { try { closeRw(); } catch (x) { } }
  }, true);
  const end = () => { if (G.on) { clearTimeout(G.rel); G.rel = setTimeout(disarm, 450); } };
  document.addEventListener('pointerup', end, true); document.addEventListener('pointercancel', disarm, true);
  SWALLOW.forEach(n => document.addEventListener(n, e => {
    if (!G.on) return; e.preventDefault(); e.stopImmediatePropagation();
    if (n === 'click') disarm();
  }, true));
  window.TB_OVG = { armed: () => G.on };
})();
