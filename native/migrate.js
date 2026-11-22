/* GLUXO (APK) · do modo visitante para a conta Google (0.33.0).
   Neste app os dados NUNCA ficam presos a uma conta: o banco é local ao aparelho, tanto para visitante quanto para quem entra com Google. Por isso entrar
   com Google não move, não renomeia e não apaga nenhum registro, e não existe "estrutura autenticada" para a qual copiar. O que a conta traz é a cópia opcional
   no Drive do próprio usuário, a licença vinculada à conta e a recuperação ao trocar de aparelho. Este módulo cuida do que pode dar errado nessa passagem:
     1) NÃO envia nada ao Drive sem o usuário pedir (regra de privacidade do app): oferece e espera o toque em "Salvar no meu Drive".
     2) Ao salvar: primeiro LISTA as cópias que a conta já tinha, depois envia a cópia dos dados deste aparelho. É aditivo (arquivo novo com data e hora),
        nunca substitui nem apaga nada, nem no aparelho nem no Drive. Falhou? O estado fica "pendente", os dados locais seguem intactos e dá para tentar de novo.
     3) Se a conta já tinha cópias: oferece "Revisar e mesclar", que usa a restauração existente (mescla sem apagar, remove duplicados por id e por data/hora/valor).
   Estado persistido em meta "guest-link" (só um marcador; não mexe em registros): offer · linking · pending · merge · done · declined.
   Só a licença (src/license.js) cuida do teste: o servidor mantém o início MAIS ANTIGO entre instalação e conta, então entrar não concede dias novos. */
if (window.TB_PUBLIC && window.TB_DRV && window.TB_SECURE) {
  const G = TB_DRV.state, META = 'guest-link', GM = { st: null, busy: false, loaded: false };
  const keyOf = () => (G.profile && (G.profile.sub || G.profile.email)) || '';
  const redraw = () => { try { render(); } catch (e) { } };
  const storeOk = () => !!(Store.persistent && Store.metaOk);
  async function ready() { for (let i = 0; i < 60 && !(S.irReady && typeof insLoaded !== 'undefined' && insLoaded); i++) await new Promise(ok => setTimeout(ok, 250)); }
  async function load() {
    try { const m = storeOk() ? (await Store.all('meta')).find(x => x.id === META) : null; GM.st = m && m.value && typeof m.value === 'object' ? m.value : null; } catch (e) { GM.st = null; }
    GM.loaded = true;
  }
  async function save(v) { GM.st = v; if (!storeOk()) return; try { await Store.put('meta', { id: META, value: v }); } catch (e) { } }
  /* chamada quando um login Google é CONCLUÍDO neste aparelho (evento "connected"): decide se há o que oferecer */
  async function onConnected() {
    await ready(); await load(); const key = keyOf(); if (!key || !G.conn) return;
    if (GM.st && GM.st.acct === key) { if (GM.st.state === 'linking') await save(Object.assign({}, GM.st, { state: 'pending' })); redraw(); return; }   /* mesma conta de antes: mantém o estado */
    if (!hasRealData()) { await save({ acct: key, state: 'done', at: Date.now(), empty: true }); redraw(); return; }                                     /* nada para guardar */
    await save({ acct: key, state: 'offer', at: Date.now() }); redraw();
  }
  async function run() {
    if (GM.busy) return; const key = keyOf(); if (!key) return;
    GM.busy = true; redraw();
    try {
      await save({ acct: key, state: 'linking', at: Date.now() });
      /* 1) cópias que a conta já tinha (antes de enviar a nossa, para não confundir com ela) */
      const pid = await drvFolder();
      const older = drvFiles(await drvCall('search_files', { query: `parentId = '${pid}' and trashed = false`, excludeContentSnippets: true, orderBy: 'modifiedTime desc', pageSize: 15 })).filter(f => f && f.id && /\.json$/i.test(f.title || ''));
      /* 2) cópia dos dados deste aparelho (aditiva) */
      if (!(await drvBackup(false))) throw new Error('upload');
      await save(older.length ? { acct: key, state: 'merge', at: Date.now(), n: older.length, id: older[0].id } : { acct: key, state: 'done', at: Date.now() });
      toast('Cópia salva na sua conta. Os dados deste aparelho foram mantidos.');
    } catch (e) {
      await save({ acct: key, state: 'pending', at: Date.now() });
      toast('Seus dados continuam intactos neste aparelho. Não deu para salvar agora; tente de novo.');
    }
    GM.busy = false; redraw();
  }
  window.gmBanner = function () {
    const st = GM.st && GM.st.state; if (!st || !G.conn || GM.st.acct !== keyOf()) return '';
    if (GM.busy) return `<div class="banner"><span><b>Salvando a cópia dos seus dados na sua conta…</b> Nada está sendo apagado.</span></div>`;
    if (st === 'offer') return `<div class="banner"><span><b>Conta Google conectada.</b> Seus dados continuam neste aparelho e o teste de 14 dias não foi reiniciado. Quer salvar agora uma cópia deles no seu Drive?</span><span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm pri" data-act="gm-save">Salvar no meu Drive</button><button class="btn sm" data-act="gm-later">Agora não</button></span></div>`;
    if (st === 'pending' || st === 'linking') return `<div class="banner warn"><span><b>A cópia na sua conta ainda não foi salva.</b> Seus dados continuam intactos neste aparelho.</span><span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm pri" data-act="gm-save">Tentar de novo</button><button class="btn sm" data-act="gm-later">Fechar</button></span></div>`;
    if (st === 'merge') return `<div class="banner"><span><b>Sua conta já tem ${GM.st.n > 1 ? GM.st.n + ' cópias' : 'uma cópia'} no Drive.</b> A cópia dos dados deste aparelho foi salva sem apagar nada. Para juntar com os dados antigos, revise e mescle: registros repetidos são ignorados.</span><span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm pri" data-act="gm-merge">Revisar e mesclar</button><button class="btn sm" data-act="gm-done">Fechar</button></span></div>`;
    return '';
  };
  document.addEventListener('click', async e => {
    const el = e.target.closest && e.target.closest('[data-act^="gm-"]'); if (!el) return; const a = el.dataset.act, key = keyOf();
    if (a === 'gm-save') run();
    else if (a === 'gm-later') { await save({ acct: key, state: 'declined', at: Date.now() }); toast('Tudo bem. Você pode salvar quando quiser em Mais → Cópia de segurança.'); redraw(); }
    else if (a === 'gm-done') { await save(Object.assign({}, GM.st, { acct: key, state: 'done', at: Date.now() })); redraw(); }
    else if (a === 'gm-merge') { const id = GM.st && GM.st.id; go('backup'); if (id) drvLoad(id); }
  });
  window.addEventListener('tb-auth', ev => { const t = ev && ev.detail && ev.detail.type; if (t === 'connected') onConnected(); else if (t === 'restored') ready().then(load).then(redraw); });
  window.TB_GUEST_LINK = { state: () => GM.st, run, onConnected };
}
