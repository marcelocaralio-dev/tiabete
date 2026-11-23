/* GLUXO (APK) · tela de entrada. Login com Google (também libera o backup no Drive) ou uso só neste aparelho.
   Não há servidor de contas: o login identifica a pessoa no próprio aparelho e liga o backup no Drive dela. */
if (window.TB_PUBLIC && window.TB_DRV && window.TB_SECURE) {
  const SEC = window.TB_SECURE, G = TB_DRV.state;
  let gate = null, ready = false;
  /* A abertura (vídeo do logotipo) é a etapa de inicialização feita em src/splash.html. Aqui só pedimos que ela espere a decisão da tela de entrada,
     para a pessoa ver o app (ou a tela de entrada) já pronto quando o vídeo terminar. */
  try { if (window.GxSplash) GxSplash.wait('gate'); } catch (e) { }
  const endSplash = () => { try { if (window.GxSplash) GxSplash.done('gate'); } catch (e) { } };
  const css = `#tb-gate{position:fixed;inset:0;z-index:2000;background:var(--bg);color:var(--fg);display:flex;flex-direction:column;justify-content:center;gap:18px;padding:max(24px,env(safe-area-inset-top)) 24px max(24px,env(safe-area-inset-bottom));overflow:auto;font-family:var(--f-body)}
  #tb-gate .gt{font-family:var(--f-display);font-size:26px;font-weight:700;margin:0;line-height:1.15}#tb-gate .gt b{color:var(--brand)}
  #tb-gate p{margin:0;color:var(--mut);font-size:15px;line-height:1.5}#tb-gate .gb{display:flex;flex-direction:column;gap:10px}
  #tb-gate .gl{background:none;border:0;color:var(--mut);text-decoration:underline;font:inherit;font-size:14px;padding:10px;cursor:pointer}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const drop = '<img src="' + GX_DROP + '" alt="" width="34" height="44" style="display:block;height:44px;width:auto">';
  const need = async () => !(await SEC.getCfg('g-profile')) && !(await SEC.getCfg('login-skip')) && !(await SEC.has('g-refresh'));
  function paint() {
    if (!gate) { gate = document.createElement('div'); gate.id = 'tb-gate'; gate.setAttribute('role', 'dialog'); gate.setAttribute('aria-label', 'Entrar no GLUXO'); document.body.appendChild(gate); }
    const idField = (window.TB_GOOGLE_CLIENT_ID || '').trim() ? '' : `<div><label class="fl" for="gate-cid">ID do cliente Google (OAuth)</label><input class="in" id="gate-cid" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="xxxx.apps.googleusercontent.com" value="${esc(G.cid || '')}"></div>`;
    gate.innerHTML = `<div>${drop}</div><h1 class="gt">Bem-vindo ao Tia<b>Bete</b></h1>
      <p>Você tem <b>14 dias de experiência Premium</b> com ou sem conta Google. Seus registros de glicemia ficam guardados <b>neste aparelho</b>; o GLUXO não vê seus dados de saúde.</p>${idField}
      <div class="gb"><button class="btn pri full" id="gate-in" ${G.busy ? 'disabled' : ''}>${G.busy ? 'Aguarde…' : 'Entrar com Google'}</button>
      <button class="btn full" id="gate-skip" ${G.busy ? 'disabled' : ''}>Continuar sem conta</button></div>
      ${G.msg ? `<p style="color:var(--red-t)" role="alert">${esc(G.msg)}</p>` : ''}
      <p style="font-size:13.5px"><b>Com Google:</b> cópia opcional no seu Drive, licença vinculada à conta e recuperação ao trocar de aparelho. <b>Sem conta:</b> tudo funciona, mas os dados ficam só neste aparelho; se desinstalar o app, limpar os dados dele ou trocar de celular, só uma cópia exportada por você permite recuperá-los. Você pode entrar com Google depois, sem perder nada.</p>
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
    else if (e.target.closest('#gate-skip')) { await SEC.setCfg('login-skip', true); refresh(); try { window.dispatchEvent(new CustomEvent('tb-auth', { detail: { type: 'guest' } })); } catch (x) { } }
  });
  window.addEventListener('tb-auth', refresh);
  refresh().then(endSplash, endSplash);
}
