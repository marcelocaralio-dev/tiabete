/* TiaBete (APK) · tela de entrada. Login com Google (também libera o backup no Drive) ou uso só neste aparelho.
   Não há servidor de contas: o login identifica a pessoa no próprio aparelho e liga o backup no Drive dela. */
if (window.TB_PUBLIC && window.TB_DRV && window.TB_SECURE) {
  const SEC = window.TB_SECURE, G = TB_DRV.state;
  let gate = null, ready = false;
  /* Abertura: logo centralizado com animação; só depois entra a tela de login (ou direto o app, para quem já entrou). */
  const SPLASH_MS = 1900, t0 = Date.now();
  const splash = document.createElement('div'); splash.id = 'tb-splash'; splash.setAttribute('role', 'img'); splash.setAttribute('aria-label', 'GLUXO · Controle da glicose');
  splash.innerHTML = '<div class="sp-logo"><img src="' + GX_LOGO + '" alt="" width="380" height="138"></div>';
  document.body.appendChild(splash);
  const hideSplash = () => { const w = Math.max(0, SPLASH_MS - (Date.now() - t0)); setTimeout(() => { splash.classList.add('out'); setTimeout(() => splash.remove(), 450); }, w); };
  const css0 = `#tb-splash{position:fixed;inset:0;z-index:3000;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity .45s ease}#tb-splash.out{opacity:0;pointer-events:none}
  #tb-splash .sp-logo{position:relative;overflow:hidden;border-radius:22px;animation:gx-rise .7s cubic-bezier(.22,.9,.3,1) both}
  #tb-splash .sp-logo img{display:block;width:min(78vw,380px);height:auto;filter:drop-shadow(0 8px 28px rgba(var(--brand-rgb),.38))}
  #tb-splash .sp-logo::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 36%,rgba(255,255,255,.14) 50%,transparent 64%);animation:gx-sheen 1.4s ease-out .55s both;pointer-events:none}
  :root[data-theme="light"] #tb-splash .sp-logo{background:#08070A;padding:22px 28px;box-shadow:0 10px 40px rgba(28,23,25,.25)}
  @keyframes sp-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  @media (prefers-reduced-motion:reduce){#tb-splash *{animation:none!important}}`;
  const css = css0 + `#tb-gate{position:fixed;inset:0;z-index:2000;background:var(--bg);color:var(--fg);display:flex;flex-direction:column;justify-content:center;gap:18px;padding:max(24px,env(safe-area-inset-top)) 24px max(24px,env(safe-area-inset-bottom));overflow:auto;font-family:var(--f-body)}
  #tb-gate .gt{font-family:var(--f-display);font-size:26px;font-weight:700;margin:0;line-height:1.15}#tb-gate .gt b{color:var(--brand)}
  #tb-gate p{margin:0;color:var(--mut);font-size:15px;line-height:1.5}#tb-gate .gb{display:flex;flex-direction:column;gap:10px}
  #tb-gate .gl{background:none;border:0;color:var(--mut);text-decoration:underline;font:inherit;font-size:14px;padding:10px;cursor:pointer}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const drop = '<img src="' + GX_DROP + '" alt="" width="34" height="44" style="display:block;height:44px;width:auto">';
  const need = async () => !(await SEC.getCfg('g-profile')) && !(await SEC.getCfg('login-skip')) && !(await SEC.has('g-refresh'));
  function paint() {
    if (!gate) { gate = document.createElement('div'); gate.id = 'tb-gate'; gate.setAttribute('role', 'dialog'); gate.setAttribute('aria-label', 'Entrar no TiaBete'); document.body.appendChild(gate); }
    const idField = (window.TB_GOOGLE_CLIENT_ID || '').trim() ? '' : `<div><label class="fl" for="gate-cid">ID do cliente Google (OAuth)</label><input class="in" id="gate-cid" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="xxxx.apps.googleusercontent.com" value="${esc(G.cid || '')}"></div>`;
    gate.innerHTML = `<div>${drop}</div><h1 class="gt">Bem-vindo ao Tia<b>Bete</b></h1>
      <p>Entre com a sua conta Google para ativar a cópia no seu próprio Drive. Seus registros de glicemia ficam guardados <b>neste aparelho</b>; o TiaBete não tem servidor e não vê seus dados.</p>${idField}
      <div class="gb"><button class="btn pri full" id="gate-in" ${G.busy ? 'disabled' : ''}>${G.busy ? 'Aguarde…' : 'Entrar com Google'}</button></div>
      ${G.msg ? `<p style="color:var(--red-t)" role="alert">${esc(G.msg)}</p>` : ''}
      <button class="gl" id="gate-skip">Continuar sem conta</button>
      <p style="font-size:12.5px">O app não substitui acompanhamento médico. Em emergência, ligue 192 (SAMU).</p>`;
  }
  async function maybePrompt() {
    for (let i = 0; i < 40 && !(typeof insLoaded !== 'undefined' && insLoaded); i++) await new Promise(ok => setTimeout(ok, 250));
    try { const sk = (await Store.all('meta')).some(x => x.id === 'profile-skip' && x.value); if (!S.profile && !sk && G.profile) { S.profPrompt = true; go('perfil'); } } catch (e) { }
  }
  async function refresh() {
    if (await need()) paint(); else if (gate) { gate.remove(); gate = null; maybePrompt(); }
    if (!ready) { ready = true; }
  }
  document.addEventListener('click', async e => {
    if (e.target.closest('#gate-in')) { try { await TB_DRV.signIn(); } catch (x) { console.error(x); G.busy = false; G.msg = 'Algo deu errado. Tente de novo.'; paint(); } }
    else if (e.target.closest('#gate-skip')) { await SEC.setCfg('login-skip', true); refresh(); }
  });
  window.addEventListener('tb-auth', refresh);
  refresh().then(hideSplash, hideSplash);
}
