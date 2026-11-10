/* TiaBete (APK) · backup no Google Drive com a conta Google do próprio usuário.
   Login OAuth 2.0 com PKCE no navegador do sistema; permissão mínima "drive.file" (o app só enxerga os arquivos que ele mesmo criou).
   O token de renovação fica cifrado no aparelho. Os dados vão do aparelho direto ao Drive do usuário. */
if (window.TB_PUBLIC && window.TB_SECURE && window.TB_HTTP) {
  const SEC = window.TB_SECURE, http = window.TB_HTTP;
  const REDIRECT = 'app.tiabete.glicose:/oauth2redirect', SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3', TOK = 'https://oauth2.googleapis.com/token';
  const G = { conn: false, loaded: false, access: null, exp: 0, pending: null, cid: (window.TB_GOOGLE_CLIENT_ID || '').trim(), baked: !!(window.TB_GOOGLE_CLIENT_ID || '').trim(), busy: false, msg: '' };
  const P = n => (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins[n]) || null;
  const E = (code, aiMsg) => ({ code, aiMsg });
  const reauth = () => E('needs_reauth', 'A conexão com o Google expirou. Toque em “Conectar conta Google” de novo.');
  const b64u = u8 => btoa(String.fromCharCode.apply(null, u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const rnd = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
  const form = o => ({ headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: o });

  async function load() {
    G.loaded = true;
    try { if (!G.baked) G.cid = ((await SEC.getCfg('g-client')) || '').trim(); G.conn = await SEC.has('g-refresh'); } catch (e) { }
    if (S.route === 'backup') render();
  }
  async function tokenCall(params) {
    const r = await http(TOK, Object.assign({ method: 'POST' }, form(Object.assign({ client_id: G.cid }, params))));
    return r;
  }
  async function accessToken(force) {
    if (!force && G.access && Date.now() < G.exp - 60000) return G.access;
    const rt = await SEC.get('g-refresh'); if (!rt) { G.conn = false; throw E('drv_not_connected', 'Conecte sua conta Google em Mais → Backup e dados.'); }
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
    card(drv, body) {
      if (!G.loaded) load();
      const intro = `Salva uma cópia do backup completo na pasta <b>TiaBete Backups</b> do <b>seu</b> Google Drive. O app só enxerga os arquivos que ele mesmo criou. Os dados vão do seu aparelho direto ao seu Drive.`;
      if (G.conn) return `<h2 class="sec">Google Drive</h2><div class="card">${body(intro)}<div class="stack" style="margin-top:12px"><button class="btn full" data-act="g-out" ${G.busy ? 'disabled' : ''}>Desconectar conta Google</button></div></div>`;
      const idField = G.baked ? '' : `<div class="field" style="margin-top:12px"><label class="fl" for="g-cid">ID do cliente Google (OAuth)</label><input class="in" id="g-cid" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="xxxx.apps.googleusercontent.com" value="${esc(G.cid)}"></div>`;
      return `<h2 class="sec">Google Drive</h2><div class="card"><p class="hint" style="margin:0">${intro}</p>${idField}
        <div class="stack" style="margin-top:12px"><button class="btn pri full" data-act="g-in" ${G.busy ? 'disabled' : ''}>${G.busy ? 'Aguarde…' : 'Conectar conta Google'}</button></div>
        ${G.msg ? `<p class="hint" style="margin:10px 0 0;color:var(--red-t)" role="alert">${esc(G.msg)}</p>` : ''}
        <p class="hint" style="margin:10px 0 0">Você será levado à página de login do Google no navegador e voltará ao app. Para desfazer, use “Desconectar” ou revogue em myaccount.google.com/permissions.</p></div>`;
    },
  };

  async function connect() {
    const cidEl = document.getElementById('g-cid'); if (cidEl) { G.cid = cidEl.value.trim(); if (G.cid) await SEC.setCfg('g-client', G.cid); }
    if (!G.cid) { G.msg = 'Informe o ID do cliente Google.'; return render(); }
    const B = P('Browser'); if (!B) { G.msg = 'O navegador do sistema não está disponível neste aparelho.'; return render(); }
    const verifier = rnd(48), state = rnd(16);
    const ch = b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    G.pending = { verifier, state }; G.msg = ''; G.busy = true; render();
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: G.cid, redirect_uri: REDIRECT, response_type: 'code', scope: SCOPE, code_challenge: ch, code_challenge_method: 'S256', state, access_type: 'offline', prompt: 'consent' });
    try { await B.open({ url }); } catch (e) { G.busy = false; G.msg = 'Não foi possível abrir o navegador.'; render(); }
  }
  async function onUrl(url) {
    if (!url || !url.startsWith('app.tiabete.glicose:')) return;
    const B = P('Browser'); try { B && await B.close(); } catch (e) { }
    const q = new URL(url.replace('app.tiabete.glicose:/', 'https://x/')).searchParams, pend = G.pending; G.pending = null;
    try {
      if (!pend || q.get('state') !== pend.state) throw E('x', 'Resposta de login inesperada. Tente conectar de novo.');
      if (q.get('error')) throw E('x', q.get('error') === 'access_denied' ? 'Você não autorizou o acesso ao Drive.' : 'O Google recusou o login (' + q.get('error') + ').');
      const r = await tokenCall({ grant_type: 'authorization_code', code: q.get('code'), code_verifier: pend.verifier, redirect_uri: REDIRECT });
      if (r.status >= 300 || !r.data || !r.data.refresh_token) throw E('x', 'Não foi possível concluir o login' + (r.data && r.data.error_description ? ': ' + r.data.error_description : '.'));
      await SEC.set('g-refresh', r.data.refresh_token); G.access = r.data.access_token; G.exp = Date.now() + (r.data.expires_in || 3600) * 1000; G.conn = true; G.msg = '';
      toast('Conta Google conectada.');
    } catch (e) { G.msg = e.aiMsg || 'Falha ao conectar.'; }
    G.busy = false; render();
  }
  async function disconnect() {
    G.busy = true; render();
    try { const rt = await SEC.get('g-refresh'); if (rt) await http('https://oauth2.googleapis.com/revoke', Object.assign({ method: 'POST' }, form({ token: rt }))); } catch (e) { }
    await SEC.del('g-refresh'); G.conn = false; G.access = null; G.busy = false; G.msg = '';
    S.drv.auto = false; S.drv.folderId = null; S.drv.list = null; try { await drvSavePref(); } catch (e) { }
    toast('Conta Google desconectada.'); render();
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act="g-in"],[data-act="g-out"]'); if (!el) return;
    (el.dataset.act === 'g-in' ? connect() : disconnect()).catch(x => { console.error(x); G.busy = false; G.msg = 'Algo deu errado. Tente de novo.'; render(); });
  });
  const A = P('App'); if (A && A.addListener) A.addListener('appUrlOpen', d => onUrl(d && d.url));
  /* se o usuário fechar o navegador sem concluir, o botão volta ao normal ao retornar ao app */
  if (A && A.addListener) A.addListener('resume', () => setTimeout(() => { if (G.busy && G.pending) { G.busy = false; G.pending = null; if (S.route === 'backup') render(); } }, 4000));
  window.TB_DRV_STATE = G;
}
