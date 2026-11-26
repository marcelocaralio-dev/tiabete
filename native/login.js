/* GLUXO (APK) · tela de entrada. Login com Google (também libera o backup no Drive) ou uso só neste aparelho.
   Não há servidor de contas: o login identifica a pessoa no próprio aparelho e liga o backup no Drive dela. */
if (window.TB_PUBLIC && window.TB_DRV && window.TB_SECURE) {
  const SEC = window.TB_SECURE, G = TB_DRV.state;
  let gate = null, ready = false;
  /* A abertura (vídeo do logotipo) é a etapa de inicialização feita em src/splash.html. Aqui só pedimos que ela espere a decisão da tela de entrada,
     para a pessoa ver o app (ou a tela de entrada) já pronto quando o vídeo terminar. */
  try { if (window.GxSplash) GxSplash.wait('gate'); } catch (e) { }
  const endSplash = () => { try { if (window.GxSplash) GxSplash.done('gate'); } catch (e) { } };
  const css = `#tb-gate{position:fixed;inset:0;z-index:2000;background-color:#030101;color:#F5F3F4;display:flex;flex-direction:column;gap:18px;padding:max(24px,env(safe-area-inset-top)) 24px max(24px,env(safe-area-inset-bottom));overflow:auto;font-family:var(--f-body)}
  #tb-gate>*{flex:none}#tb-gate>:first-child{margin-top:auto}
  #tb-gate .gt,#tb-gate p,#tb-gate .fl,#tb-gate .gn{--fg:#F5F3F4;--mut:#BDB6BA;--red-t:#FF5361}#tb-gate .fl{color:var(--mut)}
  #tb-gate .gn{display:flex;align-items:flex-start;gap:14px;color:var(--mut)}#tb-gate .gn svg{flex:none;width:30px;height:30px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
  #tb-gate .gn.gd{align-items:center;border-top:1px solid rgba(255,255,255,.18);padding-top:18px}
  #tb-gate .gt{font-family:var(--f-display);font-size:26px;font-weight:700;margin:0;line-height:1.15;color:#F5F3F4}
  #tb-gate p{margin:0;color:var(--mut);font-size:15px;line-height:1.5}#tb-gate .gb{display:flex;flex-direction:column;gap:10px}
  #tb-gate .gl{background:none;border:0;color:var(--mut);text-decoration:underline;font:inherit;font-size:14px;padding:10px;cursor:pointer}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const drop = '<img src="' + GX_DROP + '" alt="" width="34" height="44" style="display:block;height:44px;width:auto">';
  const shield = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 20 5.5v6c0 4.800-3.4 8.3-8 10-4.600-1.7-8-5.200-8-10v-6z"/><rect x="8.500" y="11" width="7" height="5.500" rx="1"/><path d="M10 11V9.500a2 2 0 0 1 4 0V11"/></svg>';
  const info = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.500"/><path d="M12 11v6M12 7.500v.01"/></svg>';
  /* Fotografia de fundo (assets/brand/login-fundo.jpg, 841x1870, embutida no build). Largura total e proporção original; rola junto com o conteúdo.
     As medidas abaixo são frações da largura da foto: fim dos rostos (0,95), borda da mesa (1,33) e quanto ela pode subir sem cortar cabeças (0,27). */
  const BG = 'data:image/jpeg;base64,%%GX_LOGIN_BG%%';
  function fit() {
    if (!gate) return;
    const w = Math.min(gate.clientWidth, gate.clientHeight / 1.5), up = 0.27 * w;
    gate.style.paddingTop = 'max(env(safe-area-inset-top, 0px) + 24px, ' + Math.round(0.95 * w - up) + 'px)';
    const drop1 = gate.firstElementChild, title = gate.querySelector('.gt');
    const y = drop1.offsetTop, t = title.offsetTop, off = Math.round(Math.min(up, Math.max(0, 0.95 * w - y, 1.33 * w - t)));
    gate.style.backgroundImage = `linear-gradient(180deg, rgba(3,1,1,.38), rgba(3,1,1,0) 72px), linear-gradient(180deg, rgba(3,1,1,0) ${t - 90}px, rgba(3,1,1,.58) ${t}px, rgba(3,1,1,.86) ${t + 70}px, #030101 ${t + 180}px), url("${BG}")`;
    gate.style.backgroundSize = `100% 100%, 100% 100%, ${Math.ceil(w)}px auto`;
    gate.style.backgroundPosition = `0 0, 0 0, center ${-off}px`;
    gate.style.backgroundRepeat = 'no-repeat';
    gate.style.backgroundAttachment = 'local';
  }
  window.addEventListener('resize', fit);
  try { document.fonts.addEventListener('loadingdone', fit); } catch (e) { }
  const need = async () => !(await SEC.getCfg('g-profile')) && !(await SEC.getCfg('login-skip')) && !(await SEC.has('g-refresh'));
  function paint() {
    if (!gate) { gate = document.createElement('div'); gate.id = 'tb-gate'; gate.setAttribute('role', 'dialog'); gate.setAttribute('aria-label', 'Entrar no GLUXO'); document.body.appendChild(gate); }
    const idField = (window.TB_GOOGLE_CLIENT_ID || '').trim() ? '' : `<div><label class="fl" for="gate-cid">ID do cliente Google (OAuth)</label><input class="in" id="gate-cid" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="xxxx.apps.googleusercontent.com" value="${esc(G.cid || '')}"></div>`;
    gate.innerHTML = `<div>${drop}</div><h1 class="gt">Bem-vindo ao GLUXO</h1>
      <p>Você tem <b>14 dias de experiência Premium</b> com ou sem conta Google. Seus registros de glicemia ficam guardados <b>neste aparelho</b>; o GLUXO não vê seus dados de saúde.</p>${idField}
      <div class="gb"><button class="btn pri full" id="gate-in" ${G.busy ? 'disabled' : ''}>${G.busy ? 'Aguarde…' : 'Entrar com Google'}</button>
      <button class="btn full" id="gate-skip" ${G.busy ? 'disabled' : ''}>Continuar sem conta</button></div>
      ${G.msg ? `<p style="color:var(--red-t)" role="alert">${esc(G.msg)}</p>` : ''}
      <div class="gn">${shield}<p style="font-size:13.5px"><b>Com Google:</b> cópia opcional no seu Drive, licença vinculada à conta e recuperação ao trocar de aparelho. <b>Sem conta:</b> tudo funciona, mas os dados ficam só neste aparelho; se desinstalar o app, limpar os dados dele ou trocar de celular, só uma cópia exportada por você permite recuperá-los. Você pode entrar com Google depois, sem perder nada.</p></div>
      <div class="gn gd">${info}<p style="font-size:12.5px">O app não substitui acompanhamento médico. Em emergência, ligue 192 (SAMU).</p></div>`;
    fit();
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
