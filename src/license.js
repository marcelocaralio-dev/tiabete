/* ================= Licenciamento · lado do app =================
   REGRA INEGOCIÁVEL: registrar glicemia e insulina, consultar o histórico e exportar os próprios dados NUNCA dependem de licença.
   Este módulo não lê nem escreve dados de saúde (não toca no banco dos registros): só guarda o token da licença no cofre "tb-secure".
   Só estes recursos são premium (LIC_PREMIUM). Qualquer outro nome é gratuito por padrão.
   PRODUÇÃO (padrão): sem o endereço do servidor (config/license-api.txt) e a chave pública, o premium fica BLOQUEADO; o gratuito segue normal.
   DESENVOLVIMENTO: só com o modo explícito (npm run build:web:dev → TB_DEV_MODE) e sem servidor configurado o premium é liberado para testes. */
const LIC_PREMIUM = { bolus: 'Cálculo de bolus', padroes: 'Padrões e observações automáticas', exames: 'Exames laboratoriais', analise: 'Análise e gráficos', 'rel-pdf': 'Relatório em PDF', ia: 'Recursos de inteligência artificial' };
const LIC_FREE_LIST = ['Registrar glicemias e aplicações de insulina, sem limite', 'Histórico de glicemias e de insulinas', 'Editar e corrigir seus registros', 'Início, Hemoglobina glicada e Meu tratamento', 'Protocolo de hipoglicemia, alertas e lembretes', 'Perfil, segurança, biometria e privacidade', 'Cópia de segurança, restauração e Google Drive', 'Exportar seus dados (Excel e CSV)'];
const LK = { dev: window.TB_DEV_MODE === true, api: '', pub: null, cfg: false, loaded: false, payload: null, seen: 0, seenSaved: 0, info: null, devices: [], conflict: null, busy: false, msg: '', last: 0 };
try { LK.api = String(window.TB_LICENSE_API || '').trim().replace(/\/+$/, ''); LK.pub = window.TB_LICENSE_PUBKEY ? JSON.parse(window.TB_LICENSE_PUBKEY) : null; LK.cfg = !!(LK.api && LK.pub); } catch (e) { LK.cfg = false; }

/* ---- direito premium (síncrono; usa o último token válido guardado, nunca o relógio sozinho) ---- */
function licNow() { const n = licClock(LK.seen, Date.now()); LK.seen = n; return n; }
function licPremiumNow() { return licPremium(LK.payload, licNow()); }
function licAllowed(f) {
  if (!LIC_PREMIUM[f]) return true;           /* tudo que não é premium é livre */
  if (!LK.cfg) return LK.dev;                 /* sem servidor: só o modo de desenvolvimento libera; produção nunca */
  if (!LK.loaded) return false;               /* ainda lendo o token guardado: o premium espera, o gratuito nunca espera */
  return licPremiumNow();
}
window.TB_GATE = licAllowed;
if (!LK.cfg) LK.loaded = true;
function licStatus() {
  if (!LK.cfg) return LK.dev ? 'dev' : 'unconfigured';
  const p = LK.payload; if (!p) return 'pending_trial';
  const n = licNow();
  if (p.st === 'trial_active' && p.te != null && n >= p.te) return 'trial_expired';
  if (p.st === 'payment_pending' && p.te != null && n >= p.te) return 'payment_pending';
  return p.st;
}
function licMenuDesc() {
  const st = licStatus(), te = LK.payload && LK.payload.te;
  return st === 'dev' ? 'Modo de desenvolvimento' : st === 'unconfigured' ? 'Recursos gratuitos · premium indisponível nesta versão' : st === 'trial_active' ? `Teste ativo · restam ${licRemaining(te, licNow())}` : st === 'lifetime_active' ? 'Licença vitalícia ativa' : st === 'trial_expired' ? 'Teste encerrado · registros continuam gratuitos' : st === 'payment_pending' ? 'Pagamento em análise' : 'Gratuito · 14 dias de teste ao entrar';
}

/* ---- armazenamento (cofre tb-secure) ---- */
const licSec = () => window.TB_SECURE;
async function licDevId() {
  let d = await licSec().getCfg('lic-dev'); if (!d) { d = licB64u(crypto.getRandomValues(new Uint8Array(18))); await licSec().setCfg('lic-dev', d); } return d;
}
/* Só vale o que tem assinatura conferida com a chave pública do app. O "status" que o servidor informa na resposta NUNCA decide nada sozinho:
   a interface usa o payload assinado (licStatus). Resposta com assinatura que não confere é recusada e o token anterior (válido) é mantido. */
async function licSave(r) {
  const S_ = licSec(), pl = await licVerify(r && r.token, LK.pub);
  if (!pl) { const e = new Error('assinatura'); e.lic = 'sig'; throw e; }
  await S_.set('lic-token', r.token);
  if (r.device_secret) await S_.set('lic-secret', r.device_secret);
  LK.info = { status: r.status, te: r.trial_ends_at, price: r.price_cents, paid: r.licensed_price_cents, email: r.email || (LK.info && LK.info.email) || null };
  LK.devices = r.devices || LK.devices; await S_.setCfg('lic-info', Object.assign({ devices: LK.devices }, LK.info));
  LK.payload = pl; LK.conflict = null; LK.okAt = Date.now();
  LK.seen = Math.max(LK.seen, r.server_time || 0, Date.now()); await S_.setCfg('lic-seen', LK.seen);
}
async function licLoad() {
  if (!LK.cfg || !licSec()) { LK.loaded = true; return; }
  try {
    LK.seen = +(await licSec().getCfg('lic-seen')) || 0;
    const t = await licSec().get('lic-token'); LK.payload = t ? await licVerify(t, LK.pub) : null;
    const i = await licSec().getCfg('lic-info'); if (i) { LK.info = i; LK.devices = i.devices || []; }
  } catch (e) { }
  LK.loaded = true; try { render(); } catch (e) { }
}
/* ---- rede: falhas NUNCA bloqueiam nada gratuito; só deixam o último token valer até o fim da tolerância ---- */
async function licCall(path, body, auth) {
  const h = { 'content-type': 'application/json' }; if (auth) h.authorization = auth;
  return window.TB_HTTP(LK.api + path, { method: 'POST', headers: h, body: body || {} });
}
async function licAuth() { const s = await licSec().get('lic-secret'); return s ? `Device ${await licDevId()}.${s}` : null; }
const LIC_MSG_SIG = 'A resposta do servidor de licenças não passou na conferência de assinatura do app. Nada foi alterado. Se continuar, instale a versão mais recente do app.';
const licNoNet = e => !e || e.lic !== 'sig';
/* Espera a conta Google ser restaurada do aparelho (native/drive.js) antes de decidir se há conta. Não trava se o módulo não existe. */
async function licDriveReady() { try { if (window.TB_DRV && TB_DRV.ready) await Promise.race([TB_DRV.ready(), new Promise(ok => setTimeout(ok, 4000))]); } catch (e) { } }
async function licHasAccount() { await licDriveReady(); if (window.TB_DRV_STATE && TB_DRV_STATE.conn) return true; try { return !!(await licSec().has('g-refresh')); } catch (e) { return false; } }
/* nested = chamada de dentro de outra operação (ex.: compra) que já marcou LK.busy */
async function licSession(replaceId, nested) {
  if (!LK.cfg || (LK.busy && !nested)) return false; const own = !nested; if (own) LK.busy = true; LK.msg = ''; let okk = false;
  try {
    await licDriveReady();
    const idt = window.TB_DRV && TB_DRV.idToken ? await TB_DRV.idToken() : null;
    if (!idt) { LK.msg = (window.TB_DRV_STATE && TB_DRV_STATE.idErr && TB_DRV_STATE.idErr.msg) || 'Entre com a sua conta Google para iniciar o teste ou usar a licença.'; return false; }
    const r = await licCall('/v1/session', { id_token: idt, device_id: await licDevId(), device_name: (navigator.userAgent.match(/\(([^)]+)\)/) || [])[1] || 'Aparelho', replace_device_id: replaceId || undefined });
    if (r.status === 200) { await licSave(r.data); okk = true; }
    else if (r.status === 409 && r.data && r.data.error === 'device_limit') { LK.conflict = r.data.devices || []; LK.msg = 'Esta licença já está em 2 aparelhos. Escolha qual deles deixar de usar.'; }
    else if (r.status === 429) LK.msg = 'Muitas tentativas ou trocas de aparelho em pouco tempo. Tente de novo mais tarde.';
    else if (r.status === 401) LK.msg = 'O servidor não aceitou a sua conta Google agora (erro 401). Saia e entre de novo com o Google.';
    else LK.msg = 'Não foi possível validar agora (erro ' + r.status + '). Os recursos gratuitos continuam normais.';
  } catch (e) { LK.msg = e && e.lic === 'sig' ? LIC_MSG_SIG : 'Sem conexão no momento. Os recursos gratuitos continuam normais.'; }
  finally { if (own) LK.busy = false; try { render(); } catch (e) { } }
  return okk;
}
/* Atualiza a situação: aparelho já conhecido -> /v1/refresh; sem aparelho (ou 401) -> /v1/session com a conta Google restaurada.
   Falha de rede ou do servidor NUNCA apaga o token guardado. force = vem do botão ou de login novo. */
let licFlight = null;
function licRefresh(force) { return licFlight || (licFlight = licRefreshRun(force).finally(() => { licFlight = null; })); }
async function licRefreshRun(force) {
  if (!LK.cfg || !LK.loaded) return;
  if (!force && LK.payload && Date.now() - LK.last < 6 * 3600e3) return;
  if (!force && Date.now() - (LK.tried || 0) < 20e3) return;
  LK.tried = Date.now(); LK.last = Date.now(); LK.busy = true; LK.msg = ''; try { render(); } catch (e) { }
  let done = false;
  try {
    const a = await licAuth();
    if (a) {
      const r = await licCall('/v1/refresh', {}, a);
      if (r.status === 200) { await licSave(r.data); done = true; }
      else if (r.status === 401) { LK.busy = false; done = await licSession(undefined, false); LK.busy = true; if (!done && !LK.msg) LK.msg = 'O servidor não reconheceu este aparelho. Entre com o Google de novo.'; }
      else if (r.status === 429) LK.msg = 'Muitas consultas em pouco tempo. Tente de novo mais tarde.';
      else LK.msg = 'O servidor de licenças não respondeu direito (erro ' + r.status + '). A licença guardada continua valendo.';
    } else if (await licHasAccount()) { LK.busy = false; done = await licSession(undefined, false); LK.busy = true; }
    else LK.msg = 'Entre com a sua conta Google para iniciar o teste ou usar a licença.';
  } catch (e) { LK.msg = e && e.lic === 'sig' ? LIC_MSG_SIG : 'Sem conexão no momento. A licença já validada continua valendo até o fim da tolerância sem internet.'; }
  LK.busy = false; if (done) LK.msg = ''; try { render(); } catch (e) { }
  return done;
}
async function licBuy() {
  if (!LK.cfg) return; LK.busy = true; LK.msg = ''; try { render(); } catch (e) { }
  try {
    let a = await licAuth(); if (!a) { await licSession(undefined, true); a = await licAuth(); }
    if (!a) { if (!LK.msg) LK.msg = 'Entre com a sua conta Google antes de comprar.'; LK.busy = false; try { render(); } catch (e) { } return; }
    const r = await licCall('/v1/order', {}, a);
    if (r.status === 200 && r.data.checkout_url) { const B = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Browser; if (B) await B.open({ url: r.data.checkout_url }); else window.open(r.data.checkout_url, '_blank'); LK.msg = 'Depois de pagar, volte ao TiaBete. A licença é liberada quando o pagamento for confirmado.'; }
    else if (r.status === 409) { LK.msg = 'Você já tem a licença vitalícia.'; await licRefresh(true); }
    else LK.msg = 'Não foi possível abrir o pagamento agora. Tente de novo em instantes.';
  } catch (e) { LK.msg = 'Sem conexão no momento. Tente de novo mais tarde.'; }
  LK.busy = false; try { render(); } catch (e) { }
}
async function licRemoveDevice(id) {
  try { const a = await licAuth(); if (a) { const r = await licCall('/v1/devices/remove', { id }, a); if (r.status === 200) { LK.devices = r.data.devices; } } else if (LK.conflict) { await licSession(id); return; } } catch (e) { LK.msg = 'Sem conexão no momento.'; }
  try { render(); } catch (e) { }
}

/* ---- telas ---- */
const licMoney = c => 'R$ ' + (c / 100).toFixed(2).replace('.', ',');
function licLockView(f) {
  const st = licStatus();
  return banners() + `<div class="card"><h2 style="margin:0 0 6px">${esc(LIC_PREMIUM[f])}</h2><p class="hint" style="margin:0 0 10px">Este é um recurso <b>premium</b>. ${st === 'trial_expired' ? 'O seu teste de 14 dias terminou.' : st === 'unconfigured' ? 'O licenciamento ainda não está disponível nesta versão.' : 'Ele fica liberado durante o teste de 14 dias e com a licença vitalícia.'}</p>
  <p class="hint" style="margin:0 0 12px"><b>Continuam gratuitos:</b> registrar glicemias e insulina, consultar o histórico e exportar os seus dados. Nada foi apagado.</p>
  <button class="btn pri full" data-act="go" data-r="licenca">Ver teste e licença</button></div>`;
}
function viewLicenca() {
  const st = licStatus(), te = LK.payload && LK.payload.te, n = licNow(), price = LK.info && LK.info.price || 2990;
  let head, tone = '';
  if (st === 'dev') head = ['Modo de desenvolvimento', 'Premium liberado só para testes. Esta versão não deve ser publicada.'];
  else if (st === 'unconfigured') head = ['Plano gratuito', 'O servidor de licenças não está configurado nesta versão, então o teste e a licença não estão disponíveis. Registrar glicemia e insulina, histórico e exportação funcionam normalmente.'];
  else if (st === 'lifetime_active') head = ['Licença vitalícia ativa', 'Todos os recursos do TiaBete, sem mensalidade' + (LK.info && LK.info.paid ? ' · valor pago ' + licMoney(LK.info.paid) : '') + '.'];
  else if (st === 'trial_active') head = ['Teste gratuito ativo', `Restam ${licRemaining(te, n)}. Termina em ${new Date(te).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}. Todos os recursos estão liberados.`];
  else if (st === 'trial_expired') head = ['Teste encerrado', 'Você continua com acesso gratuito a registrar glicemias e insulina, ao histórico e à exportação dos seus dados.'];
  else if (st === 'payment_pending') head = ['Pagamento em análise', 'Assim que o Mercado Pago confirmar, a licença é liberada. Pix costuma confirmar em instantes.'];
  else if (st === 'refunded' || st === 'revoked') head = ['Licença não está ativa', 'Seus registros e dados continuam todos disponíveis, como no plano gratuito.'];
  else if (window.TB_DRV_STATE && TB_DRV_STATE.conn) head = ['Plano gratuito', 'Conta Google conectada. Toque em “Atualizar situação” para consultar o teste de 14 dias ou a licença vitalícia.'];
  else head = ['Plano gratuito', 'Entre com a conta Google para iniciar o teste de 14 dias com todos os recursos. Sem cartão de crédito.'];
  const signed = !!(window.TB_DRV_STATE && TB_DRV_STATE.conn);
  const buy = st !== 'dev' && st !== 'unconfigured' && st !== 'lifetime_active' && st !== 'payment_pending';
  return banners() + `<div class="card"><div class="eyebrow">Seu plano</div><h2 style="margin:4px 0 6px">${head[0]}</h2><p class="hint" style="margin:0">${head[1]}</p>
    ${LK.msg ? `<p class="hint" style="margin:10px 0 0" role="status">${esc(LK.msg)}</p>` : ''}
    <div class="stack" style="margin-top:12px">${st === 'dev' || st === 'unconfigured' ? '' : !signed ? `<button class="btn pri full" data-act="g-in" ${window.TB_DRV_STATE && TB_DRV_STATE.busy ? 'disabled' : ''}>Entrar com Google e iniciar o teste</button>` : ''}
    ${buy && signed ? `<button class="btn ${st === 'pending_trial' ? '' : 'pri'} full" data-act="lic-buy" ${LK.busy ? 'disabled' : ''}>Licença vitalícia · ${licMoney(price)} (pagamento único)</button>` : ''}
    ${st !== 'dev' && st !== 'unconfigured' && signed ? `<button class="btn full" data-act="lic-refresh" ${LK.busy ? 'disabled' : ''}>${LK.busy ? 'Consultando…' : 'Atualizar situação'}</button>` : ''}</div>
    ${LK.okAt && !LK.busy ? `<p class="hint" style="margin:10px 0 0">Última consulta ao servidor: ${new Date(LK.okAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.</p>` : ''}</div>
    <h2 class="sec">Sempre gratuito</h2><div class="card"><ul class="plain">${LIC_FREE_LIST.map(x => `<li>${x}</li>`).join('')}</ul><p class="hint" style="margin:8px 0 0">Nada disso depende de pagamento, nem depois do teste.</p></div>
    <h2 class="sec">Premium (teste de 14 dias ou licença vitalícia)</h2><div class="card"><ul class="plain">${Object.values(LIC_PREMIUM).map(x => `<li>${x}</li>`).join('')}</ul><p class="hint" style="margin:8px 0 0">Pagamento único, sem mensalidade, válido em até 2 aparelhos. O preço de novas vendas pode mudar, mas a licença já comprada não muda.</p></div>
    ${LK.cfg && (LK.devices.length || LK.conflict) ? `<h2 class="sec">Aparelhos</h2><div class="card">${(LK.conflict || LK.devices).map(d => `<div class="row sp" style="margin:6px 0"><span>${esc(d.name || 'Aparelho')}<span class="hint" style="display:block">visto em ${new Date(d.last_seen).toLocaleDateString('pt-BR')}</span></span><button class="btn sm" data-act="lic-dev-rm" data-id="${esc(d.id)}">${LK.conflict ? 'Usar este lugar' : 'Remover'}</button></div>`).join('')}<p class="hint" style="margin:8px 0 0">Remover um aparelho libera uma vaga e não apaga os dados dele.</p></div>` : ''}`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act^="lic-"]'); if (!el) return;
  if (el.dataset.act === 'lic-buy') licBuy(); else if (el.dataset.act === 'lic-refresh') licRefresh(true);
  else if (el.dataset.act === 'lic-dev-rm') licRemoveDevice(el.dataset.id);
});
/* registro das telas: as originais continuam intactas; só ganham um portão quando o recurso é premium */
(function () {
  VIEWS.licenca = viewLicenca; TITLES.licenca = 'Licença TiaBete';
  try { MI.licenca = '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.500-7-10V6z"/><path d="M9 12l2 2 4-4"/>'; } catch (e) { }
  for (const [route, feat] of [['bolus', 'bolus'], ['padroes', 'padroes'], ['perguntas', 'ia'], ['exames', 'exames'], ['exame', 'exames'], ['comparar', 'exames'], ['analise', 'analise']]) {
    const o = VIEWS[route]; if (typeof o !== 'function') continue;
    VIEWS[route] = function () { return licAllowed(feat) ? o.apply(this, arguments) : licLockView(feat); };
  }
})();
/* início: carrega o token guardado, ESPERA a conta Google ser restaurada (native/drive.js carrega depois deste arquivo, por isso a espera
   começa num setTimeout) e só então consulta o servidor. Depois acompanha login, retorno do pagamento e volta ao app.
   Não reordenei o build: este arquivo precisa vir antes dos módulos nativos para envolver as telas premium; a ordem correta
   da inicialização é garantida pela espera (TB_DRV.ready) e pelo evento tb-auth, não pela posição no arquivo. */
if (LK.cfg) {
  const boot = () => licLoad().then(() => licDriveReady()).then(() => licRefresh(false)).catch(() => { });
  if (typeof setTimeout === 'function') setTimeout(boot, 0); else Promise.resolve().then(boot);
  let authT = null;
  window.addEventListener('tb-auth', ev => {
    const t = ev && ev.detail && ev.detail.type; if (t !== 'restored' && t !== 'connected') return;
    if (typeof setTimeout !== 'function') return; clearTimeout(authT); authT = setTimeout(() => { if (!LK.loaded) return; if (t === 'connected' || !LK.payload) licRefresh(true); else licRefresh(false); }, 250);
  });
  try { const A = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App; if (A && A.addListener) {
    A.addListener('appUrlOpen', d => { if (d && /^app\.tiabete\.glicose:\/pagamento/.test(d.url || '')) { try { const B = Capacitor.Plugins.Browser; B && B.close(); } catch (e) { } licRefresh(true).then(() => go('licenca')); } });
    A.addListener('resume', () => licRefresh(false));
  } } catch (e) { }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') licRefresh(false); });
}
