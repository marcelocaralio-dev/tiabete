/* ================= Identificação visual dos recursos Premium (0.36.0) =================
   SÓ APRESENTAÇÃO. Este arquivo não valida, não ativa, não grava nem altera licença: usa SOMENTE licAllowed(), licStatus(), LK e LIC_PREMIUM
   (license.js / licensecore.js, intactos). O bloqueio efetivo continua nas verificações já existentes (portão das telas em license.js,
   'rep-pdf' em app.js, TB_GATE na IA). Se este arquivo falhar ou for removido, nada é liberado nem bloqueado a mais.
   QUANDO MOSTRA: só com o licenciamento configurado, já carregado, com token assinado guardado (o teste de fato começou) e
   fora do teste ativo e fora da licença válida: teste encerrado, licença estornada/revogada, pagamento não confirmado dentro do prazo,
   ou validação vitalícia vencida sem internet. Durante o teste de 14 dias e com a licença válida: nenhum selo, nenhum aviso.
   QUAIS RECURSOS: só os que estão em LIC_PREMIUM e que licAllowed(feature) nega naquele instante. Nada é classificado por inferência:
   abaixo só existe o MAPA de qual tela/botão abre qual chave de LIC_PREMIUM (as mesmas rotas que license.js já protege).
   NUNCA marca: registrar glicemia/insulina, histórico, exportação Excel/CSV e demais itens gratuitos (não estão em LIC_PREMIUM). */
(function () {
  if (typeof LK === 'undefined' || typeof licAllowed !== 'function' || typeof LIC_PREMIUM === 'undefined' || typeof document === 'undefined') return;

  /* rota (data-r / data-dr-go) -> chave de LIC_PREMIUM. Espelha as rotas que license.js já protege, mais a Central de Métricas. */
  const ROUTE_FEAT = { bolus: 'bolus', padroes: 'padroes', perguntas: 'ia', exames: 'exames', exame: 'exames', comparar: 'exames', analise: 'analise', metricas: 'metricas', metrica: 'metricas' };
  /* ação (data-act) -> chave de LIC_PREMIUM */
  const ACT_FEAT = { 'rep-pdf': 'rel-pdf', 'sh-pdf-rep': 'rel-pdf' };
  /* elementos que já têm identificação Premium própria (Central de Métricas na tela inicial) */
  const OWN = '.mt-blk, .mt-prem';
  const SEL = '[data-r], [data-dr-go], [data-act="rep-pdf"], [data-act="sh-pdf-rep"]';

  const lockSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

  /* ---- estado: pergunta ao sistema existente, nunca decide sozinho ---- */
  function lockedAny() {
    try { return !!(LK.cfg && LK.loaded && LK.payload && licStatus() !== 'trial_active'); } catch (e) { return false; }
  }
  function locked(f) {
    try { return !!(f && LIC_PREMIUM[f] && lockedAny() && !licAllowed(f)); } catch (e) { return false; }
  }
  function featOf(el) {
    const a = el.getAttribute('data-act'), r = el.getAttribute('data-r') || el.getAttribute('data-dr-go');
    if (a && ACT_FEAT[a]) return ACT_FEAT[a];
    if (!r || (a && a !== 'go')) return null;        /* só navegação: data-r com outra ação não é acesso a recurso */
    return ROUTE_FEAT[r] || null;
  }
  const sig = () => { try { return lockedAny() ? Object.keys(LIC_PREMIUM).filter(f => locked(f)).join(',') + '|' + licStatus() : ''; } catch (e) { return ''; } };

  /* ---- selo ---- */
  function variant(el) { return el.closest('#nav') ? 'nav' : el.classList.contains('dr-it') ? 'dr' : (el.classList.contains('menu-item') || el.classList.contains('mx-h')) ? 'menu' : 'inl'; }
  function mark(el, f) {
    if (el.matches(OWN) || el.closest(OWN)) return;
    const v = variant(el);
    if (el.dataset.plF === f && el.querySelector(':scope > .pl-bd')) return;
    unmark(el);
    const b = document.createElement('i'); b.className = 'pl-bd pl-' + v; b.setAttribute('aria-hidden', 'true');
    b.innerHTML = lockSvg + (v === 'nav' ? '' : '<b>PREMIUM</b>');
    el.dataset.plF = f; el.classList.add('pl-has');
    if (v === 'menu') { const t = el.querySelector(':scope > div'); (t || el).appendChild(b); } else el.appendChild(b);
    if (!el.dataset.plAria) { el.dataset.plAria = el.getAttribute('aria-label') || '1'; }
    if (v === 'nav') el.setAttribute('aria-label', (el.textContent || '').trim() + ', Premium, bloqueado');
    else el.setAttribute('aria-description', 'Recurso Premium, exige licença');
  }
  function unmark(el) {
    el.querySelectorAll(':scope > .pl-bd, :scope > div > .pl-bd').forEach(n => n.remove());
    if (el.dataset.plF === undefined) return;
    delete el.dataset.plF; el.classList.remove('pl-has'); el.removeAttribute('aria-description');
    if (el.dataset.plAria !== undefined) { if (el.dataset.plAria === '1') el.removeAttribute('aria-label'); else el.setAttribute('aria-label', el.dataset.plAria); delete el.dataset.plAria; }
  }
  let busy = false;
  function paint(root) {
    if (busy) return; busy = true;
    try {
      if (obs) obs.disconnect();
      const on = lockedAny(); const scope = root || document;
      if (!on) { document.querySelectorAll('[data-pl-f]').forEach(unmark); }
      else {
        scope.querySelectorAll('[data-pl-f]').forEach(el => { if (!locked(el.dataset.plF)) unmark(el); });
        scope.querySelectorAll(SEL).forEach(el => { const f = featOf(el); if (f && locked(f)) mark(el, f); else if (el.dataset.plF !== undefined) unmark(el); });
      }
    } catch (e) { } finally { busy = false; if (obs && document.body) obs.observe(document.body, { childList: true, subtree: true }); }
  }
  let raf = 0; const soon = () => { if (raf) return; raf = (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout)(() => { raf = 0; paint(); arm(); }); };   /* re-agenda a virada do teste sempre que a tela muda (o token pode ter acabado de carregar) */
  let obs = null;
  try { obs = new MutationObserver(soon); } catch (e) { obs = null; }

  /* ---- janela explicativa ---- */
  function why() {
    const st = licStatus();
    if (st === 'trial_expired') return 'O seu teste gratuito de 14 dias terminou. Para voltar a usar este recurso, adquira a licença vitalícia.';
    if (st === 'refunded' || st === 'revoked') return 'A licença vitalícia não está ativa nesta conta. Para voltar a usar este recurso, é preciso ter uma licença vitalícia ativa.';
    if (st === 'payment_pending') return 'O pagamento ainda não foi confirmado. Assim que for, este recurso é liberado automaticamente.';
    if (st === 'lifetime_active') return 'O app não conseguiu confirmar a sua licença vitalícia com o servidor dentro do prazo sem internet. Conecte-se à internet e atualize a situação da licença: ela volta sozinha. Nada foi perdido.';
    return 'Este recurso exige uma licença Premium.';
  }
  function sheet(f) {
    const stale = licStatus() === 'lifetime_active';
    openSheet(`<div class="pl-sh"><div class="pl-sh-h"><span class="pl-sh-ic" aria-hidden="true">${lockSvg}</span><div><div class="eyebrow">Recurso Premium</div><h2 style="margin:2px 0 0">${esc(LIC_PREMIUM[f])}</h2></div></div>
      <p class="pl-sh-p">${esc(why())}</p>
      <p class="pl-sh-p"><b>Continuam gratuitos:</b> registrar glicemia e insulina, consultar o histórico e exportar os seus dados (Excel e CSV). Os seus registros continuam todos preservados.</p>
      <div class="stack" style="margin-top:14px"><button class="btn pri full" data-act="pl-go">${stale ? 'Ver situação da licença' : 'Ver licença vitalícia'}</button><button class="btn full" data-act="pl-close">Agora não</button></div></div>`);
  }
  document.addEventListener('click', e => {
    const t = e.target; if (!t || !t.closest) return;
    const g = t.closest('[data-act="pl-go"], [data-act="pl-close"]');
    if (g) { e.preventDefault(); e.stopPropagation(); closeSheet(); if (g.dataset.act === 'pl-go') { try { if (typeof drClose === 'function' && typeof DR !== 'undefined' && DR.open) drClose(false); } catch (x) { } go('licenca'); } return; }
    const el = t.closest('[data-pl-f]'); if (!el) return;
    const f = el.dataset.plF;
    if (!locked(f)) { try { unmark(el); } catch (x) { } return; }          /* estado mudou: deixa o clique seguir o caminho normal (o portão existente decide) */
    e.preventDefault(); e.stopImmediatePropagation();
    try { if (typeof drClose === 'function' && typeof DR !== 'undefined' && DR.open) drClose(false); } catch (x) { }
    sheet(f);
  }, true);

  /* ---- reatividade: refaz a tela e os selos quando a situação da licença muda (sem fechar o app) ---- */
  let last = sig(), timer = 0;
  function tick(force) {
    const s = sig();
    if (s !== last || force) {
      /* render() reconstrói as telas (portões de license.js e o resto). Com uma janela aberta (formulário, etc.) espera o próximo ciclo para não atrapalhar. */
      if (!document.querySelector('.sheet-bg')) { last = s; try { if (typeof render === 'function') render(); } catch (e) { } }
    }
    paint();
    arm();
  }
  /* agenda a virada exata do teste (te) e confere a cada 30 s e ao voltar ao app */
  function arm() {
    if (timer) clearTimeout(timer);
    let wait = 30e3;
    try { const te = LK.payload && LK.payload.te; if (te != null && licStatus() === 'trial_active') { const left = te - licNow() + 250; if (left > 0 && left < wait) wait = left; } } catch (e) { }
    timer = setTimeout(() => tick(false), Math.max(250, wait));
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(false); });
  try { window.addEventListener('tb-auth', () => setTimeout(() => tick(false), 400)); } catch (e) { }
  try { const A = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App; if (A && A.addListener) A.addListener('resume', () => tick(false)); } catch (e) { }
  if (obs && document.body) obs.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', () => { if (obs) obs.observe(document.body, { childList: true, subtree: true }); soon(); });
  window.TB_PREMIUM_LOCK = { paint, sig, locked, featOf };   /* só leitura/diagnóstico */
  arm(); soon();
})();
