/* GLUXO (APK) · backup no Google Drive com a conta Google do próprio usuário.
   Login OAuth 2.0 com PKCE no navegador do sistema; permissão mínima "drive.file" (o app só enxerga os arquivos que ele mesmo criou).
   O token de renovação fica cifrado no aparelho. Os dados vão do aparelho direto ao Drive do usuário. */
if (window.TB_PUBLIC && window.TB_SECURE && window.TB_HTTP) {
  const SEC = window.TB_SECURE, http = window.TB_HTTP;
  const REDIRECT = 'app.tiabete.glicose:/oauth2redirect', SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.file';
  const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3', TOK = 'https://oauth2.googleapis.com/token';
  const G = { conn: false, profile: null, loaded: false, access: null, exp: 0, pending: null, cid: (window.TB_GOOGLE_CLIENT_ID || '').trim(), baked: !!(window.TB_GOOGLE_CLIENT_ID || '').trim(), busy: false, msg: '' };
  const P = n => (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins[n]) || null;
  const E = (code, aiMsg) => ({ code, aiMsg });
  const reauth = () => E('needs_reauth', 'A conexão com o Google expirou. Toque em “Conectar conta Google” de novo.');
  const b64u = u8 => btoa(String.fromCharCode.apply(null, u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const rnd = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
  const form = o => ({ headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: o });

  /* Restaura a conta Google guardada (cofre tb-secure). Roda UMA vez, já na abertura do app (veja o fim do arquivo), e não só quando a tela de
     backup é aberta; o licenciamento e a tela de entrada esperam por ela (TB_DRV.ready). */
  async function load() {
    G.loaded = true;
    try { if (!G.baked) G.cid = ((await SEC.getCfg('g-client')) || '').trim(); G.conn = await SEC.has('g-refresh'); G.profile = await SEC.getCfg('g-profile'); } catch (e) { }
    try { if (S.route === 'backup') render(); } catch (e) { }
  }
  /* evento "tb-auth": detail.type = 'restored' (conta lida do aparelho na abertura), 'connected' (login concluído), 'disconnected' ou 'changed' */
  const notify = type => { try { window.dispatchEvent(new CustomEvent('tb-auth', { detail: { type: type || 'changed' } })); } catch (e) { try { window.dispatchEvent(new Event('tb-auth')); } catch (x) { } } };
  async function tokenCall(params) {
    const r = await http(TOK, Object.assign({ method: 'POST' }, form(Object.assign({ client_id: G.cid }, params))));
    return r;
  }
  async function accessToken(force) {
    if (!force && G.access && Date.now() < G.exp - 60000) return G.access;
    const rt = await SEC.get('g-refresh'); if (!rt) { G.conn = false; throw E('drv_not_connected', 'Conecte sua conta Google em Mais → Cópia de segurança.'); }
    const r = await tokenCall({ grant_type: 'refresh_token', refresh_token: rt });
    if (r.status === 400 || r.status === 401) { await SEC.del('g-refresh'); G.conn = false; G.access = null; throw reauth(); }
    if (r.status >= 300 || !r.data || !r.data.access_token) throw E('upstream_error', 'O Google não respondeu. Tente de novo em instantes.');
    G.access = r.data.access_token; G.exp = Date.now() + (r.data.expires_in || 3600) * 1000; return G.access;
  }
  async function api(url, o, retry) {
    const t = await accessToken(false);
    const r = await http(url, Object.assign({}, o, { headers: Object.assign({ authorization: 'Bearer ' + t }, o.headers) }));
    if (r.status === 401 && !retry) { await accessToken(true); return api(url, o, true); }
    if (r.status === 401) throw reauth();
    if (r.status === 404) throw E('tool_error', 'Item não encontrado no Drive.');
    if (r.status === 403) { const m = JSON.stringify(r.data || '').slice(0, 300); throw E('drv_forbidden', /rateLimit|quota/i.test(m) ? 'O Google limitou as consultas. Tente de novo em alguns minutos.' : /accessNotConfigured|has not been used|disabled/i.test(m) ? 'A API do Google Drive não está ativada no projeto do app (veja o guia de configuração).' : 'O Google negou o acesso. Reconecte a conta e aceite a permissão do Drive.'); }
    if (r.status === 429 || r.status >= 500) throw E('upstream_error', 'O Drive não respondeu. Tente de novo em instantes.');
    if (r.status >= 300) throw E('tool_error', 'O Drive recusou o pedido (erro ' + r.status + ').');
    return r;
  }
  const qOf = q => String(q || '').replace(/\btitle\s*=/g, 'name =').replace(/\bparentId\s*=\s*'([^']+)'/g, "'$1' in parents").replace(/\bowner\s*=\s*'me'/g, "'me' in owners");
  const json = (o) => JSON.stringify(o);

  /* ---------- Sair da conta Google (componente único, usado no Perfil e no card do Drive) ---------- */
  const LOGOUT_IC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>';
  const signedIn = () => !!(G.conn || G.profile);
  const outBtn = () => `<button type="button" class="gx-out-btn" data-act="g-out-ask" ${G.busy ? 'disabled' : ''}>${LOGOUT_IC}<span>Sair da conta Google</span></button>`;
  const withTimeout = (p, ms) => Promise.race([p, new Promise(ok => setTimeout(ok, ms))]);
  /* Seção "Conta Google" do Perfil: conectado = e-mail + botão vermelho de saída; desconectado = opção de entrar de novo. */
  function accountCard() {
    if (!signedIn()) return `<h2 class="sec">Conta Google</h2><div class="card gx-acct"><p class="hint" style="margin:0">Você não está conectado a uma conta Google. Seus registros ficam só neste aparelho. Entrar liga a cópia opcional no seu Drive e vincula a licença à conta, sem apagar nem mover nada.</p>
      <div class="stack" style="margin-top:12px"><button class="btn pri full" data-act="g-in" ${G.busy ? 'disabled' : ''}>${G.busy ? 'Aguarde…' : 'Entrar com Google'}</button></div></div>`;
    const em = G.profile && G.profile.email ? G.profile.email : '', nm = G.profile && G.profile.name ? G.profile.name : '', ini = String(nm || em || 'G').trim().charAt(0).toUpperCase();
    return `<h2 class="sec">Conta Google</h2><div class="card gx-acct"><div class="gx-acct-id"><span class="gx-acct-av" aria-hidden="true">${esc(ini)}</span><div class="gx-acct-tx"><b>${esc(nm || em || 'Conta Google conectada')}</b>${em && nm ? `<span>${esc(em)}</span>` : ''}<small>${G.conn ? 'Conectada' : 'Conexão expirada · entre de novo para usar o Drive'}</small></div></div>
      <p class="hint" style="margin:12px 0 0">Sair encerra só o login do Google neste aparelho. <b>Seus registros, histórico e configurações não são apagados.</b></p>
      <div class="stack" style="margin-top:12px">${outBtn()}</div></div>`;
  }
  /* Confirmação antes de desconectar: explica o que acontece e o que NÃO acontece. */
  function askSignOut() {
    if (G.busy || !signedIn()) return;
    const who = G.profile && G.profile.email ? `<b>${esc(G.profile.email)}</b>` : 'a sua conta Google';
    openSheet(`<h2>Sair da conta Google?</h2><p style="margin:0 0 10px">Você está prestes a sair da conta Google vinculada ao GLUXO (${who}).</p>
      <p class="hint" style="margin:0 0 16px"><b>Nenhum dado será apagado.</b> Suas medições, histórico, alimentos, medicamentos, insulinas e configurações continuam neste aparelho. A cópia programada no Drive será desligada e as cópias que já estão no seu Drive não são tocadas. Você pode entrar de novo quando quiser.</p>
      <div class="row"><button class="btn grow" type="button" data-act="close" autofocus>Cancelar</button><button class="btn gx-out-confirm grow" type="button" data-act="g-out">${LOGOUT_IC}<span>Sair da conta</span></button></div>`);
  }

  window.TB_DRV = {
    async call(tool, input) {
      input = input || {};
      if (tool === 'search_files') {
        const u = `${API}/files?q=${encodeURIComponent(qOf(input.query))}&pageSize=${input.pageSize || 10}&fields=${encodeURIComponent('files(id,name,mimeType,modifiedTime)')}${input.orderBy ? '&orderBy=' + encodeURIComponent(input.orderBy) : ''}`;
        const r = await api(u, { method: 'GET' });
        return { files: ((r.data && r.data.files) || []).map(f => ({ id: f.id, title: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime })) };
      }
      if (tool === 'create_file') {
        if (input.mimeType === 'application/vnd.google-apps.folder') {
          const r = await api(`${API}/files?fields=id`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: { name: input.title, mimeType: input.mimeType } });
          return { id: r.data && r.data.id };
        }
        const meta = { name: input.title }; if (input.parentId) meta.parents = [input.parentId];
        const bd = 'tb' + rnd(12);
        const body = `--${bd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${json(meta)}\r\n--${bd}\r\nContent-Type: ${input.contentMimeType || 'application/json'}\r\n\r\n${input.textContent || ''}\r\n--${bd}--`;
        const r = await api(`${UP}/files?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'content-type': `multipart/related; boundary=${bd}` }, body });
        return { id: r.data && r.data.id };
      }
      if (tool === 'download_file_content') {
        const r = await api(`${API}/files/${encodeURIComponent(input.fileId)}?alt=media`, { method: 'GET', text: true });
        return { content: typeof r.data === 'string' ? r.data : json(r.data) };
      }
      throw E('tool_error', 'Operação não suportada.');
    },
    signIn: () => connect(), state: G, signedIn, accountCard, askSignOut, signOut: () => disconnect(),
    card(drv, body) {
      if (!G.loaded) load();
      const intro = `Salva uma cópia completa na pasta <b>GLUXO Backups</b> do <b>seu</b> Google Drive. O app só enxerga os arquivos que ele mesmo criou. Os dados vão do seu aparelho direto ao seu Drive.`;
      if (G.conn) return `<h2 class="sec">Google Drive</h2><div class="card">${G.profile && G.profile.email ? `<p class="hint" style="margin:0 0 12px">Conectado como <b>${esc(G.profile.email)}</b></p>` : ''}${body(intro)}<div class="stack" style="margin-top:12px">${outBtn()}</div></div>`;
      const idField = G.baked ? '' : `<div class="field" style="margin-top:12px"><label class="fl" for="g-cid">ID do cliente Google (OAuth)</label><input class="in" id="g-cid" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="xxxx.apps.googleusercontent.com" value="${esc(G.cid)}"></div>`;
      return `<h2 class="sec">Google Drive</h2><div class="card"><p class="hint" style="margin:0">${intro}</p>${idField}
        <div class="stack" style="margin-top:12px"><button class="btn pri full" data-act="g-in" ${G.busy ? 'disabled' : ''}>${G.busy ? 'Aguarde…' : 'Conectar conta Google'}</button></div>
        ${G.msg ? `<p class="hint" style="margin:10px 0 0;color:var(--red-t)" role="alert">${esc(G.msg)}</p>` : ''}
        <p class="hint" style="margin:10px 0 0">Você será levado à página de login do Google no navegador e voltará ao app. Para desfazer, use “Desconectar” ou revogue em myaccount.google.com/permissions.</p>
        <p class="hint" style="margin:10px 0 0"><b>Usando sem conta?</b> Seus dados ficam só neste aparelho e este app não faz cópia automática do Android. Se você desinstalar o app, limpar os dados dele ou trocar de celular, os registros só podem ser recuperados a partir de uma cópia que você tenha exportado (botões de cópia nesta tela) ou salvo no Drive. Ao entrar com Google, os dados deste aparelho são mantidos, nada é apagado e o teste de 14 dias não é reiniciado.</p></div>`;
    },
  };

  async function connect() {
    const cidEl = document.getElementById('g-cid') || document.getElementById('gate-cid'); if (cidEl) { G.cid = cidEl.value.trim(); if (G.cid) await SEC.setCfg('g-client', G.cid); }
    if (!G.cid) { G.msg = 'Informe o ID do cliente Google.'; render(); notify(); return; }
    const B = P('Browser'); if (!B) { G.msg = 'O navegador do sistema não está disponível neste aparelho.'; return render(); }
    const verifier = rnd(48), state = rnd(16);
    const ch = b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    G.pending = { verifier, state }; G.msg = ''; G.busy = true; render(); notify('changed');
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: G.cid, redirect_uri: REDIRECT, response_type: 'code', scope: SCOPE, code_challenge: ch, code_challenge_method: 'S256', state, access_type: 'offline', prompt: 'consent' });
    try { await B.open({ url }); } catch (e) { G.busy = false; G.msg = 'Não foi possível abrir o navegador.'; render(); notify(); }
  }
  async function onUrl(url) {
    if (!url || !url.startsWith('app.tiabete.glicose:') || url.startsWith('app.tiabete.glicose:/pagamento')) return; /* /pagamento é o retorno da compra (src/license.js) */
    const B = P('Browser'); try { B && await B.close(); } catch (e) { }
    const q = new URL(url.replace('app.tiabete.glicose:/', 'https://x/')).searchParams, pend = G.pending; G.pending = null;
    try {
      if (!pend || q.get('state') !== pend.state) throw E('x', 'Resposta de login inesperada. Tente conectar de novo.');
      if (q.get('error')) throw E('x', q.get('error') === 'access_denied' ? 'Você não autorizou o acesso ao Drive.' : 'O Google recusou o login (' + q.get('error') + ').');
      const r = await tokenCall({ grant_type: 'authorization_code', code: q.get('code'), code_verifier: pend.verifier, redirect_uri: REDIRECT });
      if (r.status >= 300 || !r.data || !r.data.refresh_token) throw E('x', 'Não foi possível concluir o login' + (r.data && r.data.error_description ? ': ' + r.data.error_description : '.'));
      G.idToken = r.data.id_token || null; G.idAt = Date.now(); G.idErr = null; await SEC.set('g-refresh', r.data.refresh_token); G.access = r.data.access_token; G.exp = Date.now() + (r.data.expires_in || 3600) * 1000; G.conn = true; G.msg = '';
      try { const pl = JSON.parse(decodeURIComponent(escape(atob(String(r.data.id_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); G.profile = { email: pl.email || '', name: pl.name || '', sub: pl.sub || '' }; await SEC.setCfg('g-profile', G.profile); } catch (e) { }
      toast('Conta Google conectada.');
    } catch (e) { G.msg = e.aiMsg || 'Falha ao conectar.'; }
    G.busy = false; render(); notify(G.conn ? 'connected' : 'changed');
  }
  /* Encerra a sessão Google de verdade: revoga o token no Google (melhor esforço, com limite de tempo), apaga o token de renovação do cofre do aparelho
     e zera o estado em memória. NÃO toca em registros, histórico, alimentos, insulinas, configurações nem nas cópias que já estão no Drive.
     Se não for possível apagar o token local, nada muda (continua conectado) e a pessoa é avisada. */
  async function disconnect() {
    if (G.busy) return;
    closeSheet(); G.busy = true; G.msg = ''; render();
    try {
      let rt = null; try { rt = await SEC.get('g-refresh'); } catch (e) { }
      if (rt) { try { await withTimeout(http('https://oauth2.googleapis.com/revoke', Object.assign({ method: 'POST' }, form({ token: rt }))), 6000); } catch (e) { } }
      await SEC.del('g-refresh');
    } catch (e) {
      console.error(e); G.busy = false; toast('Não foi possível sair da conta agora. Nada foi apagado. Tente de novo.'); render(); notify('changed'); return;
    }
    try { await SEC.setCfg('g-profile', null); } catch (e) { console.error(e); }
    try { await SEC.setCfg('login-skip', false); } catch (e) { console.error(e); }
    G.profile = null; G.conn = false; G.access = null; G.exp = 0; G.idToken = null; G.idAt = 0; G.idErr = null; G.pending = null; G.busy = false; G.msg = '';
    S.drv.auto = false; S.drv.folderId = null; S.drv.list = null; try { await drvSavePref(); } catch (e) { }
    toast('Você saiu da conta Google.'); render(); notify('disconnected');
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act="g-in"],[data-act="g-out"],[data-act="g-out-ask"]'); if (!el) return;
    if (el.dataset.act === 'g-out-ask') { askSignOut(); return; }
    (el.dataset.act === 'g-in' ? connect() : disconnect()).catch(x => { console.error(x); G.busy = false; G.msg = 'Algo deu errado. Tente de novo.'; render(); });
  });
  const A = P('App'); if (A && A.addListener) A.addListener('appUrlOpen', d => onUrl(d && d.url));
  /* se o usuário fechar o navegador sem concluir, o botão volta ao normal ao retornar ao app */
  if (A && A.addListener) A.addListener('resume', () => setTimeout(() => { if (G.busy && G.pending) { G.busy = false; G.pending = null; if (S.route === 'backup') render(); notify(); } }, 4000));
  /* ID token do Google para o licenciamento (o servidor valida; o app nunca decide sozinho). Reaproveita o último se tiver menos de 45 min.
     Devolve null quando não dá, MAS agora diz o motivo em G.idErr = { code, msg } (a tela de licença mostra a mensagem):
       not_connected · needs_reauth (o Google recusou a renovação) · no_id_token · google_error · network. */
  let idFlight = null;
  async function idTokenNow() {
    await G.ready;
    if (G.idToken && Date.now() - (G.idAt || 0) < 45 * 60000) return G.idToken;
    let rt = null; try { rt = await SEC.get('g-refresh'); } catch (e) { }
    if (!rt) { G.conn = false; G.idErr = { code: 'not_connected', msg: 'Entre com a sua conta Google para iniciar o teste ou usar a licença.' }; return null; }
    G.conn = true;
    let r; try { r = await tokenCall({ grant_type: 'refresh_token', refresh_token: rt }); }
    catch (e) { G.idErr = { code: 'network', msg: 'Sem conexão para confirmar a sua conta Google. Tente de novo com a internet ligada.' }; return null; }
    if (r.status === 400 || r.status === 401) { G.idErr = { code: 'needs_reauth', msg: 'O Google não aceitou renovar o seu login' + (r.data && r.data.error ? ' (' + String(r.data.error).slice(0, 40) + ')' : '') + '. Toque em “Entrar com Google” para conectar de novo.' }; return null; }
    if (r.status >= 300 || !r.data) { G.idErr = { code: 'google_error', msg: 'O Google não respondeu direito (erro ' + r.status + '). Tente de novo em instantes.' }; return null; }
    if (!r.data.id_token) { G.idErr = { code: 'no_id_token', msg: 'O Google não enviou a identidade da conta. Saia e entre de novo com o Google.' }; return null; }
    G.idToken = r.data.id_token; G.idAt = Date.now(); G.idErr = null;
    if (r.data.access_token) { G.access = r.data.access_token; G.exp = Date.now() + (r.data.expires_in || 3600) * 1000; }
    return G.idToken;
  }
  window.TB_DRV.idToken = () => idFlight || (idFlight = idTokenNow().finally(() => { idFlight = null; }));
  window.TB_DRV.ready = () => G.ready;
  window.TB_DRV_STATE = G;
  /* restaura a conta já na abertura e avisa quem depende dela (licenciamento, tela de entrada) */
  G.ready = load().then(() => notify('restored'), () => notify('restored'));
}
