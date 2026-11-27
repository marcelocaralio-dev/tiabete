/* ================= Modos de interface · lado do app (Configurações → Aparência → Modo de interface) =================
   Serviço único: guarda a ESCOLHA do modo ('tb-modo'), consulta a autorização Premium só no licenciamento oficial (gxhAuth, em homebase.js),
   trata a perda de assinatura e desenha o seletor. Não cria regra de assinatura, não grava licença e NUNCA toca em preferências,
   favoritos, fixados, layouts ou registros: trocar de modo só muda o que é APRESENTADO (gxhLocked decide, em um lugar só).
   Classificação dos recursos e dos componentes: modos-core.js. */
const MD_LS = 'tb-modo';
let mdMemo = { raw: undefined, st: null };
/* undefined = a LEITURA falhou (não é "nunca escolheu"); null = realmente não existe. Falha de leitura nunca vira escolha nem sobrescreve o guardado. */
function mdRaw() { try { return localStorage.getItem(MD_LS); } catch (e) { return undefined; } }
function mdStored() { const raw = mdRaw(); if (!mdMemo.st || raw !== mdMemo.raw) mdMemo = { raw, st: mdParse(raw) }; return mdMemo.st; }
function mdSave(o) { try { localStorage.setItem(MD_LS, JSON.stringify(mdClean(o))); } catch (e) { } mdMemo = { raw: undefined, st: null }; }
/* Modo ESCOLHIDO (sem olhar a autorização). O modo EM USO é gxhPers() ? 'experience' : 'standard'. */
const mdChosen = () => mdSelected(mdStored());
const mdActive = () => gxhPers() ? 'experience' : 'standard';

/* Há personalização do Experience guardada? (só para decidir a escolha inicial e para explicar; nunca para apagar) */
function mdHasSaved() {
  try { if (typeof hbHasSaved === 'function' && typeof inPrefsStored === 'function' && hbHasSaved(inPrefsStored())) return true; } catch (e) { }
  try {
    const a = JSON.parse(localStorage.getItem('tb-gx')) || {};
    return Object.keys(a).some(k => (k in GX_F ? mdFeatureClass(k) === 'experience' : ['favs', 'ofav', 'opin', 'forder', 'olay'].includes(k)) && !/^(\{\}|\[\])$/.test(JSON.stringify(a[k])));
  } catch (e) { return false; }
}

/* O licenciamento já respondeu? Enquanto carrega, nada se conclui (nem perda de Premium). */
function mdKnown() { try { return typeof LK !== 'undefined' && (!LK.cfg || (LK.loaded === true && LK.readErr !== true)); } catch (e) { return false; } }
/* Chamado uma vez na abertura, depois de as configurações serem restauradas e antes de a primeira tela ser desenhada. */
function mdBoot() {
  try {
    const raw = mdRaw();   /* só inicializa quando a leitura funcionou e não há nada guardado; ilegível/falha: mantém o que existe e usa o Padrão só na tela */
    if (raw === null) mdSave(mdInitial(mdStored(), mdHasSaved()));
    mdCheck();
  } catch (e) { console.error(e); }
}
/* Perda de autorização → Modo Padrão (uma vez, com aviso). Os dados e as preferências não são tocados. */
function mdCheck() {
  if (!mdKnown() || mdRaw() === undefined) return false;
  const now = Date.now();
  if (gxhAuthReal() && typeof LK !== 'undefined' && LK.cfg) {   /* Premium confirmado: carimba (no máximo 1 vez por hora) para segurar o Experience enquanto a licença é relida */
    const st = mdStored(); if (st.mode === 'experience' && now - st.ok > 3600e3) mdSave(mdStamp(st, now));
    return false;
  }
  /* Só uma perda CONFIRMADA tira o Experience (teste terminado, reembolso, revogação, em token assinado já lido, sem consulta em andamento).
     Tolerância offline vencida, relógio fora do lugar, servidor sem resposta ou leitura falha: mantém a escolha e a licença é relida. */
  const sure = typeof LK !== 'undefined' && !LK.busy && mdLossConfirmed(gxhStatusKey(), LK.payload, LK.loaded, LK.readErr);
  const r = mdReconcile(mdStored(), sure, false, gxhStatusKey(), now);
  if (!r.changed) { try { if (!sure && mdChosen() === 'experience' && !gxhAuthReal() && typeof licRefresh === 'function') licRefresh(false); } catch (e) { } return false; }
  mdSave(r.stored); return true;
}
/* Reaplica o que depende das preferências (classes visuais, badges, listas) depois de uma troca de modo. */
function mdRefresh() {
  try { S.inEdit = false; } catch (e) { }
  try { gxChanged(); } catch (e) { console.error(e); }
  try { render(); } catch (e) { console.error(e); }
}
const mdIdle = () => !document.getElementById('sheet-bg') && !/INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '');
setInterval(() => { try { if (mdCheck()) { if (mdIdle()) mdRefresh(); else try { gxChanged(); } catch (e) { } } } catch (e) { } }, 20000);
document.addEventListener('visibilitychange', () => { try { if (!document.hidden && mdCheck()) mdRefresh(); } catch (e) { } });
{ const r0 = render; render = function () { try { mdCheck(); } catch (e) { } return r0.apply(this, arguments); }; }

/* ---------- textos ---------- */
const mdWhy = st => st === 'trial_expired' ? 'Seu teste do Premium terminou.' : st === 'refunded' || st === 'revoked' ? 'A licença Premium não está ativa.' : 'O Premium não está ativo.';
function mdLostNote() {
  const st = mdStored(); if (!mdLostPending(st)) return '';
  return `<div class="gxh-lockn md-note" role="status"><p><b>${esc(mdWhy(st.lost.st))}</b> O app voltou ao Modo Padrão. Suas configurações do Experience continuam guardadas e seus registros não foram alterados. Com o Premium ativo, escolha o Modo Experience em Aparência para recuperá-las.</p><button type="button" class="btn sm" data-md-ack>Entendi</button></div>`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-md-ack]'); if (!b) return; mdSave(mdAck(mdStored())); const n = b.closest('.md-note'); if (n) n.remove(); try { if (S.route === 'aparencia') render(); } catch (x) { } });
/* Cartão de explicação para telas do Experience abertas no Modo Padrão (favoritos, atalhos antigos, etc.): uma frase, um botão. */
function mdGateHTML(title) {
  const auth = gxhAuth();
  return `<div class="card md-gate"><b>${esc(title)} · ${auth ? 'Modo Experience' : 'Premium'}</b><p class="hint">${esc(gxhLockWhy())} O que você já configurou continua guardado.</p>${auth ? '<button type="button" class="btn pri full" data-act="go" data-r="aparencia">Abrir Modo de interface</button>' : mdPremiumBtn('full')}</div>`;
}
const mdPremiumBtn = cls => typeof VIEWS !== 'undefined' && VIEWS.licenca ? `<button type="button" class="btn ${cls === 'full' ? 'full' : 'sm'}" data-act="go" data-r="licenca">Conhecer o Premium</button>` : '';
function mdPremiumSheet() {
  openSheet(`<h2>Modo Experience é Premium</h2><p>${esc(gxhLockWhy())} O Modo Experience libera a personalização completa da interface e todo o catálogo da GLUXO Experience.</p><p>O Modo Padrão continua completo e gratuito: Resumo glicêmico, cards, Central de Métricas, alertas e todos os seus registros.</p><div class="stack" style="gap:8px">${mdPremiumBtn('full').replace('class="btn full"', 'class="btn pri full"')}<button type="button" class="btn full" data-act="close">Agora não</button></div>`);
}

/* ---------- entrada da personalização nas telas de ajustes ---------- */
/* Modo Experience: central completa. Modo Padrão: só a personalização dos alertas (recursos compartilhados). */
const mdEntryBtn = () => gxhPers() ? '<button class="btn full" data-act="go" data-r="gxexp">Personalização · GLUXO Experience</button>' : '<button class="btn full" data-act="go" data-r="gxexp">Personalização dos alertas</button>';
function mdTitle(r) { return gxhPers() ? { gxexp: 'GLUXO Experience', gxctxc: 'Experiências contextuais' }[r] : 'Personalização dos alertas'; }
['gxexp', 'gxctxc'].forEach(r => { const t0 = TITLES[r]; Object.defineProperty(TITLES, r, { get() { return mdTitle(r) || t0; }, set(v) { }, enumerable: true, configurable: true }); });
/* Página de alertas do Modo Padrão: só os recursos COMPARTILHADOS (Etapa 01). As demais telas do catálogo mostram uma explicação (gxhub.js → mdGateHTML). */
function mdAlertsPage() {
  const fs = GXH_CATS.C.fs.filter(f => mdFeatureClass(f) === 'shared');
  return `<p class="hint gxh-in">Bolha de alertas, categorias, badges e som e vibração da hipoglicemia. Funcionam igual nos dois modos de interface.</p>` + fs.map(f => gxhSec(f)).join('')
    + `<button type="button" class="btn full gxh-rc" data-gxh-resetcat="C">Restaurar os alertas ao padrão</button>`
    + `<div class="card md-gate" style="margin-top:12px"><b>Mais personalização</b><p class="hint">Atalhos, pesquisa, organização da tela inicial, favoritos e inteligência contextual fazem parte do Modo Experience.</p><button type="button" class="btn full" data-act="go" data-r="aparencia">Ver Modo de interface</button></div>`;
}

/* ---------- seletor: Configurações → Aparência → Modo de interface ---------- */
function mdExclusiveHTML() {
  const names = {}; Object.keys(GXH).forEach(f => { names[f] = GXH[f][0]; });
  const g = mdExclusive(GXH_CATS, names), home = MD_HOME.filter(x => x.class === 'experience').map(x => x.t);
  return `<details class="md-more"><summary>O que o Modo Experience inclui</summary><div class="md-list"><p><b>Tela inicial</b><span>${home.map(esc).join(' · ')}</span></p>${g.map(x => `<p><b>${esc(x.t)}</b><span>${x.items.map(esc).join(' · ')}</span></p>`).join('')}</div></details>`;
}
function mdCard() {
  const auth = gxhAuth(), act = mdActive(), st = mdStored();
  const state = (m, can) => act === m ? '<span class="md-s on">Ativo</span>' : can ? '<span class="md-s">Toque para usar</span>' : '<span class="md-s md-lock">Exige Premium ativo</span>';
  const opt = (m, badge, title, desc, can) => `<button type="button" class="md-opt${act === m ? ' on' : ''}${can ? '' : ' md-lock'}" role="radio" aria-checked="${act === m}" data-md-pick="${m}"><span class="md-h"><b>${title}</b><span class="gxh-badge ${badge[0]}">${badge[1]}</span></span><span class="md-d">${desc}</span>${state(m, can)}</button>`;
  const hint = !auth ? `<p class="hint md-hint">${esc(gxhLockWhy())} O Modo Experience exige uma assinatura Premium ativa.</p>${mdPremiumBtn('sm')}`
    : st.lost && act === 'standard' ? '<p class="hint md-hint">Seu Premium está ativo de novo. Escolha o Modo Experience para recuperar suas configurações.</p>' : '';
  return `<h2 class="sec">Modo de interface</h2><div class="card md-card"><div class="md-opts" role="radiogroup" aria-label="Modo de interface">`
    + opt('standard', ['cfg', 'Gratuito'], 'Modo Padrão', 'Utilize a interface tradicional do GLUXO, com os cards e recursos disponíveis no plano gratuito.', true)
    + opt('experience', ['on', 'Premium'], 'Modo Experience', 'Desbloqueie uma experiência avançada, com personalização completa da interface e acesso ao catálogo GLUXO Experience. Exclusivo Premium.', auth)
    + `</div>${mdLostNote()}${hint}<p class="hint md-hint">Alertas, lembretes, Resumo glicêmico e Central de Métricas são iguais nos dois modos. Trocar de modo não apaga registros, favoritos, fixados nem configurações.</p>${mdExclusiveHTML()}</div>`;
}
/* ---------- card Premium de acesso ao GLUXO Experience (Aparência, logo depois do tema) ---------- */
const mdExpIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/><path d="M19 2.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill="currentColor" stroke="none"/></svg>';
function mdExpCard() {
  return `<button type="button" class="gxe-card acc-skip" data-md-open aria-label="GLUXO Experience, Premium. Explorar GLUXO Experience"><span class="gxe-top"><span class="gxe-ic">${mdExpIcon}</span><span class="gxe-tag">PREMIUM</span></span><span class="gxe-t">GLUXO Experience</span><span class="gxe-s">Seu GLUXO. Suas escolhas. Uma experiência completamente personalizada.</span><span class="gxe-d">Personalize a interface, explore recursos exclusivos e configure o aplicativo de acordo com suas preferências.</span><span class="gxe-cta">EXPLORAR GLUXO EXPERIENCE <b aria-hidden="true">→</b></span></button>`;
}
/* Quem está no Experience abre a central de personalização; os demais veem a apresentação (sem ativar nada sem a licença). */
function mdOpenExp() {
  if (gxhPers()) { go('gxexp'); return; }
  const names = {}; Object.keys(GXH).forEach(f => { names[f] = GXH[f][0]; });
  const g = mdExclusive(GXH_CATS, names), auth = gxhAuth();
  openSheet(`<h2>GLUXO Experience</h2><p><b>Seu GLUXO. Suas escolhas.</b> Personalize a interface, explore recursos exclusivos e configure o aplicativo de acordo com suas preferências.</p><div class="md-list">${g.map(x => `<p><b>${esc(x.t)}</b><span>${x.items.map(esc).join(' · ')}</span></p>`).join('')}</div><p class="hint">${auth ? 'Você tem o Premium ativo. Ative o Modo Experience para usar tudo isso. Suas configurações guardadas voltam junto.' : esc(gxhLockWhy()) + ' O Modo Padrão continua completo e gratuito.'}</p><div class="stack" style="gap:8px">${auth ? '<button type="button" class="btn pri full" data-md-pick="experience">Ativar Modo Experience</button>' : mdPremiumBtn('full').replace('class="btn full"', 'class="btn pri full"')}<button type="button" class="btn full" data-act="close">Agora não</button></div>`);
}
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-md-open]')) mdOpenExp(); });
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-md-pick]'); if (!b) return;
  if (b.closest('#sheet-bg')) { try { closeSheet(); } catch (x) { } }
  const m = b.dataset.mdPick; if (m === mdActive()) return;
  const r = mdSelect(mdStored(), m, gxhAuth());   /* a autorização é conferida AQUI, na lógica, não só na tela */
  if (!r.ok) { if (r.reason === 'premium') mdPremiumSheet(); return; }
  mdSave(r.stored); mdRefresh(); toast(m === 'experience' ? 'Modo Experience ativado.' : 'Modo Padrão ativado. Suas configurações continuam guardadas.');
});
