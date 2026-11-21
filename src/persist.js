/* ================= Persistência reforçada =================
   Objetivo: nada que a pessoa configurou volta ao padrão ao fechar e abrir o app (inclusive encerramento forçado e reinício do aparelho).
   1) Ajustes que ficavam SÓ no localStorage do WebView (visual do Início, período das métricas, avisos dispensados, bloqueio por PIN)
      ganham uma cópia durável no banco (meta "ls-mirror"). Na abertura, o que faltar no localStorage é restaurado dali.
      O que já existe no localStorage tem prioridade (nunca é sobrescrito pela cópia).
   2) Escolhas de visualização (período do painel, intervalo/agrupamento da análise, critério de rótulo) agora sobrevivem ao fechamento.
   3) Gravação imediata ao sair da tela (visibilitychange/pagehide) e `tbCfgReady`: as sincronizações nativas só rodam depois de as
      configurações serem lidas do banco (antes, rodavam com valores padrão e podiam cancelar lembretes que a pessoa tinha configurado). */
const PS_LS = ['tb-pnl', 'tb-inicio', 'tb-ana-open', 'tb-mt-period', 'tb-pr-off', 'tb-hypo-off', 'tb-hyper-off', 'tb-hypo-alert', 'tb-lock'];
const PS_ID = 'ls-mirror';
let psReady = false, psTimer = null;
const psSel = () => ({ period: S.period, anaRange: S.ana && S.ana.range, anaAgg: S.ana && S.ana.agg, ruleMode: S.ruleMode, ruleN: S.ruleN });
function psSnap() { const o = {}; for (const k of PS_LS) { try { const v = localStorage.getItem(k); if (v != null) o[k] = v; } catch (e) { } } return o; }
async function psFlush() {
  clearTimeout(psTimer); psTimer = null;
  if (!psReady || !Store.persistent || !Store.metaOk) return;
  try { await Store.put('meta', { id: PS_ID, value: { ls: psSnap(), sel: psSel(), at: Date.now() } }); } catch (e) { }
}
function psSched(ms) { if (!psReady) return; clearTimeout(psTimer); psTimer = setTimeout(psFlush, ms == null ? 400 : ms); }
/* qualquer gravação nas chaves acompanhadas agenda a cópia (o PIN é copiado na hora) */
(function () {
  try {
    const set = Storage.prototype.setItem, del = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (k, v) { const r = set.apply(this, arguments); if (this === localStorage && PS_LS.includes(k)) psSched(k === 'tb-lock' ? 0 : 400); return r; };
    Storage.prototype.removeItem = function (k) { const r = del.apply(this, arguments); if (this === localStorage && PS_LS.includes(k)) psSched(k === 'tb-lock' ? 0 : 400); return r; };
  } catch (e) { }
})();
const psOk = {
  period: v => [7, 30, 90].includes(v), anaRange: v => ['all', '7', '14', '30', '90', '180'].includes(v), anaAgg: v => v === 'week' || v === 'month',
  ruleMode: v => typeof RULE_MODES === 'object' && Object.prototype.hasOwnProperty.call(RULE_MODES, v), ruleN: v => Number.isInteger(v) && v > 0 && v <= 100000
};
/* Chamado na abertura, logo depois de o banco abrir e ANTES de as telas serem desenhadas. */
async function psRestore() {
  try {
    if (!Store.persistent || !Store.metaOk) { psReady = true; return; }
    const m = (await Store.all('meta')).find(x => x.id === PS_ID), v = m && m.value;
    if (v && v.ls && typeof v.ls === 'object') {
      for (const k of PS_LS) { try { if (localStorage.getItem(k) == null && typeof v.ls[k] === 'string') localStorage.setItem(k, v.ls[k]); } catch (e) { } }
      /* valores lidos uma única vez quando os scripts carregaram: lê de novo agora que o localStorage está completo */
      try { S.hypoOff = JSON.parse(localStorage.getItem('tb-hypo-off') || '{}') || {}; } catch (e) { }
      try { S.hyperOff = JSON.parse(localStorage.getItem('tb-hyper-off') || '{}') || {}; } catch (e) { }
      try { const p = +localStorage.getItem('tb-mt-period'); if (S.mt && typeof MT_PERIODS !== 'undefined' && MT_PERIODS.includes(p)) S.mt.period = p; } catch (e) { }
      try { if (typeof pnlGet === 'function') pnlMode = pnlGet(); } catch (e) { }
    }
    const s = v && v.sel;
    if (s && typeof s === 'object') {
      if (psOk.period(s.period)) S.period = s.period;
      if (psOk.anaRange(s.anaRange)) S.ana.range = s.anaRange;
      if (psOk.anaAgg(s.anaAgg)) S.ana.agg = s.anaAgg;
      if (psOk.ruleMode(s.ruleMode)) S.ruleMode = s.ruleMode;
      if (psOk.ruleN(s.ruleN)) S.ruleN = s.ruleN;
    }
  } catch (e) { console.error(e); }
  psReady = true; psSched(1500);
}
document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('[data-act="period"],[data-act="ana-range"],[data-act="ana-agg"],[data-act="rule-mode"]'); if (el) setTimeout(() => psSched(250), 0); });
document.addEventListener('change', e => { if (e.target && e.target.id === 'rule-n') setTimeout(() => psSched(250), 0); });
document.addEventListener('visibilitychange', () => { if (document.hidden) psFlush(); });
window.addEventListener('pagehide', psFlush);
