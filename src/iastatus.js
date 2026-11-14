/* ================= Estado da conexão com a IA (central, compartilhado por todas as telas) =================
   Mostra se a IA está respondendo de verdade, e não só se existe uma chave cadastrada.
   - App Android: pergunta ao provedor a lista de modelos (consulta leve, sem gerar texto nem gastar créditos),
     o que confere internet, serviço e chave ao mesmo tempo.
   - Dentro do Claude: confere se o Claude foi liberado para o app.
   - Qualquer pedido real de IA que der certo ou falhar atualiza o estado na hora (via getSample).
   Para não pesar: um resultado "conectada" vale 5 minutos e "desconectada" 20 segundos; consultas simultâneas viram uma só.
   A etiqueta é colocada no topo apenas das telas que usam IA e se atualiza no lugar, sem redesenhar a tela. */
const IA_ROUTES = ['perguntas', 'exames', 'exame', 'comparar', 'bolus', 'ia'];
const IAS = { st: null, why: '', code: '', at: 0, busy: null, fp: undefined, w: 0 };
const IA_WHY = {
  ai_not_configured: 'Falta informar o provedor e a chave.',
  ai_auth: 'O provedor recusou a chave (inválida ou sem permissão).',
  ai_network: 'Sem comunicação com o provedor. Verifique a internet.',
  ai_busy: 'O serviço do provedor está indisponível ou sobrecarregado.',
  ai_billing: 'O provedor informou falta de crédito ou de cobrança ativa.',
  ai_model: 'Modelo não encontrado ou sem acesso.',
  ai_insecure: 'O endereço do provedor precisa começar com https://.',
  not_granted: 'O Claude não está liberado para este app.',
  none: 'Este recurso só funciona dentro do Claude ou no aplicativo para Android.'
};
const IA_IGNORE = ['rate_limited', 'aborted', 'invalid_json', 'prompt_too_large', 'empty_completion', 'ai_incomplete'];
const iaIsRoute = r => IA_ROUTES.includes(r);
function iaWhyOf(e) {
  const c = (e && e.code) || '';
  if (['not_declared', 'sampling_disabled', 'capability_disabled', 'capability_removed'].includes(c)) return ['not_granted', IA_WHY.not_granted];
  const tx = String((e && (e.detail || e.aiMsg || e.message)) || '');
  if (c === 'ai_http' && /api key|invalid.*key|unauthori|permission/i.test(tx)) return ['ai_auth', IA_WHY.ai_auth];
  if (IA_WHY[c]) return [c, IA_WHY[c]];
  return [c || 'erro', (e && e.aiMsg ? String(e.aiMsg).slice(0, 140) : 'Falha na comunicação com a IA.')];
}
function iaSet(st, why, code) {
  const ch = IAS.st !== st || IAS.why !== (why || ''); IAS.st = st; IAS.why = why || ''; IAS.code = code || ''; IAS.at = Date.now();
  if (ch) iaPaint();
}
function iaFail(e) { if (e && IA_IGNORE.includes(e.code)) return; const [c, w] = iaWhyOf(e); iaSet('off', w, c); }
function iaOk() { if (IAS.st !== 'ok') iaSet('ok', '', ''); else IAS.at = Date.now(); }
const iaFp = c => c ? [c.provider, c.model, c.base, c.key ? c.key.length + ':' + c.key.slice(-4) : ''].join('|') : '';
async function iaCheck(force) {
  if (IAS.busy) return IAS.busy;
  if (!force && IAS.st && Date.now() - IAS.at < (IAS.st === 'ok' ? 300000 : 20000)) return;
  if (!IAS.st || (force && IAS.st !== 'ok')) iaSet('chk', '', '');
  IAS.busy = (async () => {
    try {
      if (!HAS_CLAUDE) return iaSet('off', IA_WHY.none, 'none');
      if (navigator.onLine === false) return iaSet('off', 'Sem internet no aparelho.', 'ai_network');
      if (window.TB_AI && window.TB_AI.config) {
        const c = await window.TB_AI.config().catch(() => null); IAS.fp = iaFp(c);
        if (!c) return iaSet('off', IA_WHY.ai_not_configured, 'ai_not_configured');
        try { await window.TB_AI.listModels(c.provider, c.base, c.key); iaSet('ok', '', ''); }
        catch (e) { if (e && e.code === 'ai_model') iaSet('ok', '', ''); else iaFail(e && e.code ? e : { code: 'ai_network' }); } /* 404 na lista de modelos: provedor sem esse endereço, não dá para afirmar falha */
      } else {
        let s = null; try { s = await window.claude.use('sample'); } catch (e) { s = null; }
        if (!s) return iaSet('off', IA_WHY.not_granted, 'not_granted');
        try { await s.limits(); iaSet('ok', '', ''); } catch (e) { iaFail(e); }
      }
    } catch (e) { iaFail(e); } finally { IAS.busy = null; }
  })();
  return IAS.busy;
}
/* Envolve o objeto de IA usado pelas telas: cada pedido real atualiza o estado conforme o resultado. */
function iaWrap(s) {
  if (!s) { if (HAS_CLAUDE) iaSet('off', IA_WHY.not_granted, 'not_granted'); return s; }
  if (s.__ia) return s;
  const w = (i, o) => s(i, o).then(r => { iaOk(); return r; }, e => { iaFail(e); throw e; });
  w.json = (i, o) => s.json(i, o).then(r => { iaOk(); return r; }, e => { iaFail(e); throw e; });
  w.limits = s.limits ? (...a) => s.limits(...a) : undefined; w.__ia = true;
  return w;
}
const IA_SVG = {
  ok: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0zM12 16v5"/></svg>',
  off: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l10 18H2zM12 10v5M12 18h.01"/></svg>',
  chk: '<span class="ia-spin" aria-hidden="true"></span>'
};
function iaTagHtml(route) {
  const st = IAS.st || 'chk', cfg = !!(typeof VIEWS !== 'undefined' && VIEWS.ia);
  const t = st === 'ok' ? 'IA conectada' : st === 'off' ? 'IA desconectada' : 'Verificando conexão...';
  const btn = st === 'off' && cfg && route !== 'ia' ? '<button class="btn sm pri" data-act="go" data-r="ia">Configurar IA</button>' : '';
  const re = st === 'off' && IAS.code !== 'none' ? '<button class="ia-re" data-ia="retest">Testar de novo</button>' : '';
  return `<div id="ia-tag" class="ia-tag ia-${st}" role="status" aria-live="polite"><span class="ia-ic">${IA_SVG[st] || IA_SVG.chk}</span><span class="ia-tx"><b>${t}</b>${st === 'off' && IAS.why ? `<small>${esc(IAS.why)}</small>` : ''}</span><span class="ia-bt">${re}${btn}</span></div>`;
}
function iaPaint() { const el = document.getElementById('ia-tag'); if (!el || !iaIsRoute(S.route)) return; el.outerHTML = iaTagHtml(S.route); }
/* Chamado a cada render: coloca a etiqueta no topo da tela de IA e confere o estado quando está velho. */
function iaMount(view, route) {
  if (!iaIsRoute(route) || !view) return;
  const h = view.querySelector('h1.pg'); if (!h || view.querySelector('#ia-tag')) return;
  h.insertAdjacentHTML('afterend', iaTagHtml(route));
  iaCheck(false);
  if (window.TB_AI && window.TB_AI.config && Date.now() - IAS.w > 1500 && IAS.st) { /* chave/provedor mudaram na tela de configuração? confere de novo */
    IAS.w = Date.now();
    window.TB_AI.config().then(c => { if (IAS.fp !== undefined && iaFp(c) !== IAS.fp) iaCheck(true); }).catch(() => { });
  }
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-ia="retest"]'); if (!b) return; e.preventDefault(); iaCheck(true); });
window.addEventListener('online', () => { if (iaIsRoute(S.route)) iaCheck(true); });
window.addEventListener('offline', () => { if (iaIsRoute(S.route) || IAS.st) iaSet('off', 'Sem internet no aparelho.', 'ai_network'); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && iaIsRoute(S.route)) iaCheck(false); });
