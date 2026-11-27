/* ================= Licenciamento · lado do app =================
   REGRA INEGOCIÁVEL: registrar glicemia e insulina, consultar o histórico e exportar os próprios dados NUNCA dependem de licença.
   Este módulo não lê nem escreve dados de saúde (não toca no banco dos registros): só guarda o token da licença no cofre "tb-secure".
   Só estes recursos são premium (LIC_PREMIUM). Qualquer outro nome é gratuito por padrão.
   PRODUÇÃO (padrão): sem o endereço do servidor (config/license-api.txt) e a chave pública, o premium fica BLOQUEADO; o gratuito segue normal.
   VISITANTE (0.33.0): quem escolhe "Continuar sem conta" recebe os mesmos 14 dias Premium. O teste nasce no servidor (/v1/guest/start) ligado a um
   identificador aleatório de instalação. 0.34.0: o servidor também reconhece o APARELHO (HMAC do ANDROID_ID, só no backend), então limpar dados,
   reinstalar ou restaurar backup não gera teste novo. Sem conexão no primeiro acesso NÃO há teste local: o gratuito funciona e o teste começa
   (no servidor) quando houver internet.
   DESENVOLVIMENTO: só com o modo explícito (npm run build:web:dev → TB_DEV_MODE) e sem servidor configurado o premium é liberado para testes. */
const LIC_PREMIUM = { bolus: 'Cálculo de bolus', padroes: 'Padrões e observações automáticas', exames: 'Exames laboratoriais', analise: 'Análise e gráficos', 'rel-pdf': 'Relatório em PDF', ia: 'Recursos de inteligência artificial', metricas: 'Central de Métricas Glicêmicas' };
/* Recursos premium que o teste de 14 dias NÃO libera: só a licença vitalícia paga (payload assinado com st = lifetime_active). Mesmo token, mesma assinatura, mesmo relógio: nenhum estado novo. */
const LIC_LIFETIME = { metricas: true };
const LIC_FREE_LIST = ['Registrar glicemias e aplicações de insulina, sem limite', 'Histórico de glicemias e de insulinas', 'Editar e corrigir seus registros', 'Início, Hemoglobina glicada e Meu tratamento', 'Protocolo de hipoglicemia, alertas e lembretes', 'Perfil, segurança, biometria e privacidade', 'Cópia de segurança, restauração e Google Drive', 'Exportar seus dados (Excel e CSV)'];
const LK = { dev: window.TB_DEV_MODE === true, api: '', pub: null, cfg: false, loaded: false, payload: null, awaiting: false, ack: null, seen: 0, seenL: 0, seenSaved: 0, info: null, devices: [], conflict: null, busy: false, msg: '', last: 0 };
try { LK.api = String(window.TB_LICENSE_API || '').trim().replace(/\/+$/, ''); LK.pub = window.TB_LICENSE_PUBKEY ? JSON.parse(window.TB_LICENSE_PUBKEY) : null; LK.cfg = !!(LK.api && LK.pub); } catch (e) { LK.cfg = false; }

/* ---- direito premium (síncrono; usa o último token válido guardado, nunca o relógio sozinho) ---- */
/* Relógio protegido (0.33.0): avança pelo tempo REAL decorrido e nunca volta. Se o relógio do aparelho for atrasado, o tempo protegido não recua
   e também não congela: continua andando a partir do novo ponto (antes, recuar a data "congelava" o teste e a tolerância offline até o relógio alcançar o
   maior instante já visto). O estado vai ao cofre a cada minuto de uso, ao sair do app e a cada consulta ao servidor, e o servidor corrige o relógio quando responde. */
function licNow() {
  const loc = Date.now();
  if (!LK.seenL) { LK.seen = licClock(LK.seen, loc); LK.seenL = loc; }          /* primeira observação desta abertura (ou instalação antiga com lic-seen numérico) */
  else { const d = loc - LK.seenL; LK.seenL = loc; if (d > 0) LK.seen += d; }    /* relógio andou para trás (d < 0): reancora sem recuar o tempo protegido */
  if (LK.loaded && LK.seen - LK.seenSaved >= 60e3) licSeenFlush();
  return LK.seen;
}
function licSeenFlush() {
  LK.seenSaved = LK.seen; const S_ = licSec(); if (!S_ || !LK.cfg) return;
  try { Promise.resolve(S_.setCfg('lic-seen', { t: LK.seen, l: LK.seenL })).catch(() => { }); } catch (e) { }
}
function licPremiumNow() { return licPremium(LK.payload, licNow()); }
function licAllowed(f) {
  if (!LIC_PREMIUM[f]) return true;           /* tudo que não é premium é livre */
  if (!LK.cfg) return LK.dev;                 /* sem servidor: só o modo de desenvolvimento libera; produção nunca */
  if (!LK.loaded) return false;               /* ainda lendo o token guardado: o premium espera, o gratuito nunca espera */
  if (!licPremiumNow()) return false;
  return LIC_LIFETIME[f] ? !!(LK.payload && LK.payload.st === 'lifetime_active') : true;
}
window.TB_GATE = licAllowed;
if (!LK.cfg) LK.loaded = true;
function licStatus() {
  if (!LK.cfg) return LK.dev ? 'dev' : 'unconfigured';
  const p = LK.payload; if (!p) return LK.awaiting ? 'trial_unverified' : 'pending_trial';
  const n = licNow();
  if (p.st === 'trial_active' && p.te != null && n >= p.te) return 'trial_expired';
  if (p.st === 'payment_pending' && p.te != null && n >= p.te) return 'payment_pending';
  return p.st;
}
function licMenuDesc() {
  const st = licStatus(), te = LK.payload && LK.payload.te;
  return st === 'dev' ? 'Modo de desenvolvimento' : st === 'unconfigured' ? 'Recursos gratuitos · premium indisponível nesta versão' : st === 'trial_active' ? `Teste ativo · restam ${licRemaining(te, licNow())}` : st === 'trial_unverified' ? 'Conecte-se à internet para iniciar o teste · registros continuam gratuitos' : st === 'lifetime_active' ? 'Licença vitalícia ativa' : st === 'trial_expired' ? 'Teste encerrado · registros continuam gratuitos' : st === 'payment_pending' ? 'Pagamento em análise' : 'Gratuito · 14 dias de teste Premium, com ou sem conta';
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
  /* hora do servidor manda: nunca fica atrás dela; e um "adiantado" além da tolerância (data do aparelho errada no passado) é desfeito */
  const srv = +r.server_time || 0, loc = Date.now();
  LK.seen = srv ? Math.max(srv, Math.min(LK.seen, srv + LIC_SKEW_MS)) : Math.max(LK.seen, loc); LK.seenL = loc;
  LK.awaiting = false; LK.seenSaved = LK.seen; await S_.setCfg('lic-seen', { t: LK.seen, l: LK.seenL });
}
/* Falha ao ler o cofre (ainda não pronto, erro momentâneo) NÃO é "sem licença": marca readErr e relê algumas vezes. Só sinaliza; não muda nenhuma regra de assinatura. */
let licLoadTry = 0;
function licLoadRetry() { if (++licLoadTry <= 5 && typeof setTimeout === 'function') setTimeout(() => { licLoad().then(() => { if (!LK.readErr) licRefresh(false); }).catch(() => { }); }, 1500 * licLoadTry); }
async function licLoad() {
  if (!LK.cfg) { LK.loaded = true; return; }
  if (!licSec()) { LK.readErr = true; LK.loaded = true; licLoadRetry(); return; }
  try {
    const sv = await licSec().getCfg('lic-seen'); if (sv && typeof sv === 'object') { LK.seen = +sv.t || 0; LK.seenL = +sv.l || 0; } else LK.seen = +sv || 0;
    LK.seenSaved = LK.seen; try { if (await licSec().getCfg('lic-prov')) await licSec().setCfg('lic-prov', null); } catch (e) { }   /* resto do teste provisório da 0.33.0: removido, não vale mais */
    LK.ack = await licSec().getCfg('lic-ack') || null;
    const t = await licSec().get('lic-token'); LK.payload = t ? await licVerify(t, LK.pub) : null;
    const i = await licSec().getCfg('lic-info'); if (i) { LK.info = i; LK.devices = i.devices || []; }
    LK.readErr = false;
  } catch (e) { LK.readErr = true; licLoadRetry(); }
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
/* Instalação anônima: o id é o mesmo identificador aleatório do aparelho (lic-dev); o segredo é outro valor aleatório. Ambos ficam só no cofre do app
   (chave AES-GCM não exportável do WebCrypto). Nada de IMEI, serial, MAC ou qualquer identificador do hardware. */
async function licInstAuth() {
  const id = await licDevId(); let s = await licSec().get('lic-isec');
  if (!s) { s = licB64u(crypto.getRandomValues(new Uint8Array(24))); await licSec().set('lic-isec', s); }
  return { id, s };
}
/* ANDROID_ID (API oficial do Android, via plugin TbDevice): só reconhece "este aparelho já recebeu um teste". Lido na hora, enviado por HTTPS e NUNCA
   guardado, mostrado nem logado pelo app; o servidor o transforma em HMAC e descarta o valor bruto. Não é senha, token nem prova de identidade.
   Sem plugin (web, navegador) ou com valor inválido = sem sinal de aparelho e o resto funciona igual. */
async function licDeviceHint() {
  try {
    const P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TbDevice; if (!P || !P.androidId) return null;
    const r = await P.androidId(), v = r && r.id; return typeof v === 'string' && /^[0-9a-fA-F]{8,64}$/.test(v) ? v.toLowerCase() : null;
  } catch (e) { return null; }
}
/* Visitante = escolheu "Continuar sem conta" (login-skip) e não há conta Google nem aparelho de conta neste cofre. */
async function licGuestChosen() { try { return !!(await licSec().getCfg('login-skip')); } catch (e) { return false; } }
/* Teste do visitante: /v1/guest/start (idempotente) ou /v1/guest/refresh. O servidor é a única autoridade do início e do fim. Sem conexão no primeiro
   acesso não existe teste local (senão apagar os dados e ficar offline renovaria o Premium): o gratuito segue normal e o teste começa quando houver internet. */
async function licGuestRun() {
  if (!LK.cfg) return false; let okk = false;
  try {
    const { id, s } = await licInstAuth(), hint = await licDeviceHint();
    const known = LK.payload && LK.payload.inst === id;
    let r = known ? await licCall('/v1/guest/refresh', hint ? { device_hint: hint } : {}, `Install ${id}.${s}`) : null;
    if (!r || r.status === 401) r = await licCall('/v1/guest/start', hint ? { install_id: id, install_secret: s, device_hint: hint } : { install_id: id, install_secret: s });
    if (r.status === 200) { await licSave(r.data); okk = true; }
    else if (r.status === 401) LK.msg = 'O servidor não reconheceu esta instalação. Os recursos gratuitos continuam normais.';
    else if (r.status === 429) LK.msg = 'Muitas tentativas em pouco tempo. Tente de novo mais tarde. Os recursos gratuitos continuam normais.';
    else LK.msg = 'Não foi possível registrar o teste agora (erro ' + r.status + '). Os recursos gratuitos continuam normais.';
    if (!okk && !LK.payload) LK.awaiting = true;
  } catch (e) {
    LK.msg = e && e.lic === 'sig' ? LIC_MSG_SIG : 'Sem conexão no momento. O teste começa quando houver internet. Os recursos gratuitos continuam normais.';
    if (!LK.payload) LK.awaiting = true;
  }
  return okk;
}
/* nested = chamada de dentro de outra operação (ex.: compra) que já marcou LK.busy */
async function licSession(replaceId, nested) {
  if (!LK.cfg || (LK.busy && !nested)) return false; const own = !nested; if (own) LK.busy = true; LK.msg = ''; let okk = false;
  try {
    await licDriveReady();
    const idt = window.TB_DRV && TB_DRV.idToken ? await TB_DRV.idToken() : null;
    if (!idt) { LK.msg = (window.TB_DRV_STATE && TB_DRV_STATE.idErr && TB_DRV_STATE.idErr.msg) || 'Entre com a sua conta Google para iniciar o teste ou usar a licença.'; return false; }
    let inst = {}; try { const i = await licInstAuth(); inst = { install_id: i.id, install_secret: i.s }; } catch (e) { }
    try { const h = await licDeviceHint(); if (h) inst.device_hint = h; } catch (e) { }
    const r = await licCall('/v1/session', { ...inst, id_token: idt, device_id: await licDevId(), device_name: (navigator.userAgent.match(/\(([^)]+)\)/) || [])[1] || 'Aparelho', replace_device_id: replaceId || undefined });
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
      const hint = await licDeviceHint(), r = await licCall('/v1/refresh', hint ? { device_hint: hint } : {}, a);
      if (r.status === 200) { await licSave(r.data); done = true; }
      else if (r.status === 401) { LK.busy = false; done = await licSession(undefined, false); LK.busy = true; if (!done && !LK.msg) LK.msg = 'O servidor não reconheceu este aparelho. Entre com o Google de novo.'; }
      else if (r.status === 429) LK.msg = 'Muitas consultas em pouco tempo. Tente de novo mais tarde.';
      else LK.msg = 'O servidor de licenças não respondeu direito (erro ' + r.status + '). A licença guardada continua valendo.';
    } else if (await licHasAccount()) { LK.busy = false; done = await licSession(undefined, false); LK.busy = true; }
    else if (await licGuestChosen()) { done = await licGuestRun(); }
    else LK.msg = 'Entre com a sua conta Google ou continue sem conta para iniciar o teste de 14 dias.';
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
    if (r.status === 200 && r.data.checkout_url) { const B = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Browser; if (B) await B.open({ url: r.data.checkout_url }); else window.open(r.data.checkout_url, '_blank'); LK.msg = 'Depois de pagar, volte ao GLUXO. A licença é liberada quando o pagamento for confirmado.'; }
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
  return banners() + `<div class="card"><h2 style="margin:0 0 6px">${esc(LIC_PREMIUM[f])}</h2><p class="hint" style="margin:0 0 10px">Este é um recurso <b>premium</b>. ${st === 'trial_expired' ? 'A sua experiência Premium de 14 dias terminou.' : st === 'trial_unverified' ? 'O teste começa quando o servidor puder registrá-lo. Conecte-se à internet para liberar os 14 dias.' : st === 'unconfigured' ? 'O licenciamento ainda não está disponível nesta versão.' : 'Ele fica liberado durante o teste de 14 dias e com a licença vitalícia.'}</p>
  <p class="hint" style="margin:0 0 12px"><b>Continuam gratuitos:</b> registrar glicemias e insulina, consultar o histórico e exportar os seus dados. Nada foi apagado: os seus registros continuam todos preservados.</p>
  <button class="btn pri full" data-act="go" data-r="licenca">Ver teste e licença</button></div>`;
}
function viewLicenca() {
  const st = licStatus(), te = LK.payload && LK.payload.te, n = licNow(), price = LK.info && LK.info.price || 2990, guest = !!(LK.payload ? LK.payload.guest : LK.awaiting);
  let head, tone = '';
  if (st === 'dev') head = ['Modo de desenvolvimento', 'Premium liberado só para testes. Esta versão não deve ser publicada.'];
  else if (st === 'unconfigured') head = ['Plano gratuito', 'O servidor de licenças não está configurado nesta versão, então o teste e a licença não estão disponíveis. Registrar glicemia e insulina, histórico e exportação funcionam normalmente.'];
  else if (st === 'lifetime_active') head = ['Licença vitalícia ativa', 'Todos os recursos do GLUXO, sem mensalidade' + (LK.info && LK.info.paid ? ' · valor pago ' + licMoney(LK.info.paid) : '') + '.'];
  else if (st === 'trial_active' && te) head = ['Teste gratuito ativo', `Restam ${licRemaining(te, n)}. Termina em ${new Date(te).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}. Todos os recursos do teste estão liberados${guest ? '. Você está usando sem conta Google' : ''}.`];
  else if (st === 'trial_unverified') head = ['Teste aguardando conexão', 'Conecte-se à internet para o servidor registrar o início do seu teste de 14 dias. Enquanto isso, os recursos gratuitos e os seus registros continuam normais.'];
  else if (st === 'trial_expired') head = ['A experiência Premium terminou', 'Os seus registros continuam preservados e as funcionalidades gratuitas continuam disponíveis. Para voltar a usar os recursos Premium, adquira a licença vitalícia.'];
  else if (st === 'payment_pending') head = ['Pagamento em análise', 'Assim que o Mercado Pago confirmar, a licença é liberada. Pix costuma confirmar em instantes.'];
  else if (st === 'refunded' || st === 'revoked') head = ['Licença não está ativa', 'Seus registros e dados continuam todos disponíveis, como no plano gratuito.'];
  else if (window.TB_DRV_STATE && TB_DRV_STATE.conn) head = ['Plano gratuito', 'Conta Google conectada. Toque em “Atualizar situação” para consultar o teste de 14 dias ou a licença vitalícia.'];
  else head = ['Plano gratuito', 'Entre com a conta Google ou continue sem conta para iniciar o teste de 14 dias com todos os recursos. Sem cartão de crédito.'];
  const signed = !!(window.TB_DRV_STATE && TB_DRV_STATE.conn);
  const guestUse = !signed && st !== 'dev' && st !== 'unconfigured' && st !== 'lifetime_active';
  const buy = st !== 'dev' && st !== 'unconfigured' && st !== 'lifetime_active' && st !== 'payment_pending';
  return banners() + `<div class="card"><div class="eyebrow">Seu plano</div><h2 style="margin:4px 0 6px">${head[0]}</h2><p class="hint" style="margin:0">${head[1]}</p>
    ${LK.msg ? `<p class="hint" style="margin:10px 0 0" role="status">${esc(LK.msg)}</p>` : ''}
    <div class="stack" style="margin-top:12px">${st === 'dev' || st === 'unconfigured' ? '' : !signed ? `<button class="btn pri full" data-act="g-in" ${window.TB_DRV_STATE && TB_DRV_STATE.busy ? 'disabled' : ''}>${st === 'pending_trial' ? 'Entrar com Google e iniciar o teste' : st === 'trial_expired' ? 'Entrar com Google para adquirir a licença' : 'Entrar com Google (vincular dados e licença)'}</button>` : ''}
    ${guestUse && st !== 'pending_trial' ? `<p class="hint" style="margin:6px 0 0">Sem conta Google, os seus registros ficam só neste aparelho. A licença vitalícia é vinculada à conta Google para valer em outro aparelho. Entrar não reinicia nem renova o teste, e os seus dados são mantidos.</p>` : ''}
    ${buy && signed ? `<button class="btn ${st === 'pending_trial' ? '' : 'pri'} full" data-act="lic-buy" ${LK.busy ? 'disabled' : ''}>Licença vitalícia · ${licMoney(price)} (pagamento único)</button>` : ''}
    ${st !== 'dev' && st !== 'unconfigured' && signed ? `<button class="btn full" data-act="lic-refresh" ${LK.busy ? 'disabled' : ''}>${LK.busy ? 'Consultando…' : 'Atualizar situação'}</button>` : ''}</div>
    ${LK.okAt && !LK.busy ? `<p class="hint" style="margin:10px 0 0">Última consulta ao servidor: ${new Date(LK.okAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.</p>` : ''}</div>
    <h2 class="sec">Sempre gratuito</h2><div class="card"><ul class="plain">${LIC_FREE_LIST.map(x => `<li>${x}</li>`).join('')}</ul><p class="hint" style="margin:8px 0 0">Nada disso depende de pagamento, nem depois do teste.</p></div>
    <h2 class="sec">Premium (teste de 14 dias ou licença vitalícia)</h2><div class="card"><ul class="plain">${Object.entries(LIC_PREMIUM).filter(([k]) => !LIC_LIFETIME[k]).map(([, x]) => `<li>${x}</li>`).join('')}</ul></div>
    <h2 class="sec">Exclusivo da licença vitalícia</h2><div class="card"><ul class="plain">${Object.entries(LIC_PREMIUM).filter(([k]) => LIC_LIFETIME[k]).map(([, x]) => `<li>${x} <span class="hint">(não faz parte do teste de 14 dias)</span></li>`).join('')}</ul><p class="hint" style="margin:8px 0 0">Pagamento único, sem mensalidade, válido em até 2 aparelhos. O preço de novas vendas pode mudar, mas a licença já comprada não muda.</p></div>
    ${LK.cfg && (LK.devices.length || LK.conflict) ? `<h2 class="sec">Aparelhos</h2><div class="card">${(LK.conflict || LK.devices).map(d => `<div class="row sp" style="margin:6px 0"><span>${esc(d.name || 'Aparelho')}<span class="hint" style="display:block">visto em ${new Date(d.last_seen).toLocaleDateString('pt-BR')}</span></span><button class="btn sm" data-act="lic-dev-rm" data-id="${esc(d.id)}">${LK.conflict ? 'Usar este lugar' : 'Remover'}</button></div>`).join('')}<p class="hint" style="margin:8px 0 0">Remover um aparelho libera uma vaga e não apaga os dados dele.</p></div>` : ''}`;
}
/* Avisos discretos na faixa de avisos do app: faltando até 3 dias para o teste acabar, e uma vez depois que ele acaba. Nunca alarmistas, nunca bloqueiam. */
function licBanner() {
  try {
    if (!LK.cfg || !LK.loaded || !LK.payload) return '';
    const st = licStatus(), te = LK.payload.te;
    if (st === 'trial_active' && te) {
      const left = te - licNow();
      if (left > 0 && left <= 3 * 864e5) return `<div class="banner"><span><b>Seu teste Premium termina em ${licRemaining(te, licNow())}.</b> Seus registros continuam preservados e os recursos gratuitos seguem normais.</span><button class="btn sm" data-act="go" data-r="licenca">Ver licença</button></div>`;
    }
    if (st === 'trial_expired' && te && !(LK.ack && LK.ack.exp === te)) return `<div class="banner"><span><b>A experiência Premium terminou.</b> Seus registros continuam preservados e as funcionalidades gratuitas continuam disponíveis. Você pode adquirir a licença vitalícia quando quiser.</span><button class="btn sm" data-act="go" data-r="licenca">Ver licença</button><button class="btn sm" data-act="lic-ack">Entendi</button></div>`;
  } catch (e) { }
  return '';
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act^="lic-"]'); if (!el) return;
  if (el.dataset.act === 'lic-ack') { LK.ack = { exp: LK.payload && LK.payload.te }; try { licSec().setCfg('lic-ack', LK.ack); } catch (x) { } try { render(); } catch (x) { } return; }
  if (el.dataset.act === 'lic-buy') licBuy(); else if (el.dataset.act === 'lic-refresh') licRefresh(true);
  else if (el.dataset.act === 'lic-dev-rm') licRemoveDevice(el.dataset.id);
});
/* registro das telas: as originais continuam intactas; só ganham um portão quando o recurso é premium */
(function () {
  VIEWS.licenca = viewLicenca; TITLES.licenca = 'Licença GLUXO';
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
    const t = ev && ev.detail && ev.detail.type; if (t !== 'restored' && t !== 'connected' && t !== 'guest') return;
    if (typeof setTimeout !== 'function') return; clearTimeout(authT); authT = setTimeout(() => { if (!LK.loaded) return; if (t === 'connected' || t === 'guest' || !LK.payload) licRefresh(true); else licRefresh(false); }, 250);
  });
  try { const A = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App; if (A && A.addListener) {
    A.addListener('appUrlOpen', d => { if (d && /^app\.gluxo\.glicose:\/pagamento/.test(d.url || '')) { try { const B = Capacitor.Plugins.Browser; B && B.close(); } catch (e) { } licRefresh(true).then(() => go('licenca')); } });
    A.addListener('resume', () => licRefresh(false));
  } } catch (e) { }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') licRefresh(false); else if (LK.loaded) { licNow(); licSeenFlush(); } });
}
