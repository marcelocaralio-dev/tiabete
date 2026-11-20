/* ================= Central Premium (licença vitalícia) =================
   Este arquivo SÓ LÊ o estado do licenciamento (LK, licStatus, licPremiumNow, LIC_PREMIUM, LIC_LIFETIME) e chama as funções que já existem
   (licRefresh, licRemoveDevice, licAuth). Não valida, ativa, grava nem altera licença: license.js, licensecore.js, o Worker e o banco continuam como estavam.
   Só quem está com a licença vitalícia ativa vê esta tela. Teste, pendente, expirada ou sem servidor continuam com a tela original (viewLicenca).
   Dados exibidos: só o que o servidor já entrega ao app (aparelhos: id, nome, vinculado em, última consulta; payload assinado: emissão e validade).
   Único dado gravado aqui: apelidos dos aparelhos e a data da primeira visita, em localStorage deste aparelho (só interface). */
(function () {
  if (typeof VIEWS === 'undefined' || typeof VIEWS.licenca !== 'function' || typeof LK === 'undefined') return;
  const orig = VIEWS.licenca;
  const BRAND = 'GLUXO';      /* nome usado nos textos desta tela */
  const MAX_DEV = 2;          /* mesmo limite informado ao usuário em license.js e aplicado pelo servidor (MAX_DEVICES) */
  const FIRST_WEEK = 7 * 864e5;
  const PR = { busy: false, devId: null, devTried: false, listAt: 0 };
  const KA = 'tb-prem-alias', KF = 'tb-prem-first';

  const fmt = ts => ts ? new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  const fmtD = ts => ts ? new Date(ts).toLocaleDateString('pt-BR') : null;
  const money = c => 'R$ ' + (c / 100).toFixed(2).replace('.', ',');
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const aliases = () => { try { const o = JSON.parse(lsGet(KA) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  const onRoute = () => typeof S !== 'undefined' && S.route === 'licenca';
  const active = () => !!(LK.cfg && licStatus() === 'lifetime_active');
  const busy = () => PR.busy || LK.busy;

  /* ---- aparelho atual: id gravado pelo app (leitura; nunca cria) ---- */
  const curId = () => (LK.payload && LK.payload.dev) || PR.devId || null;
  async function loadDevId() {
    if (PR.devTried) return; PR.devTried = true;
    try { const s = window.TB_SECURE; const d = s && await s.getCfg('lic-dev'); if (d) { PR.devId = d; if (onRoute() && active()) render(); } } catch (e) { }
  }
  const isCur = d => !!curId() && d.id === curId();

  /* ---- só mostra o que o nome registrado realmente diz (sem inventar modelo ou sistema) ---- */
  function devInfo(name) {
    const n = String(name || ''), o = { model: null, os: null };
    let m;
    if ((m = n.match(/Android\s*([\d.]+)?/i))) { o.os = 'Android' + (m[1] ? ' ' + m[1] : ''); const segs = n.split(';').map(x => x.trim()); const i = segs.findIndex(x => /^Android/i.test(x)); const mod = segs[i + 1]; if (mod && mod.length > 1 && !/^(wv|mobile|u|k)$/i.test(mod)) o.model = mod.replace(/\sBuild\/.*$/i, ''); }
    else if ((m = n.match(/\b(iPhone|iPad)\b/))) { o.model = m[1]; const v = n.match(/OS (\d+)[_.](\d+)?/); o.os = 'iOS' + (v ? ' ' + v[1] + (v[2] ? '.' + v[2] : '') : ''); }
    else if (/Windows/i.test(n)) o.os = 'Windows';
    else if (/Mac OS X|Macintosh/i.test(n)) o.os = 'macOS';
    else if (/CrOS/i.test(n)) o.os = 'ChromeOS';
    else if (/Linux/i.test(n)) o.os = 'Linux';
    return o;
  }
  const mask = e => { const m = String(e || '').match(/^([^@]+)@(.+)$/); if (!m) return null; const u = m[1]; return (u.length <= 2 ? u[0] : u.slice(0, 2)) + '•••@' + m[2]; };
  const acctEmail = () => (LK.info && LK.info.email) || (window.TB_DRV_STATE && TB_DRV_STATE.profile && TB_DRV_STATE.profile.email) || null;

  /* ---- ações ---- */
  async function doRefresh() {
    if (busy()) return;
    PR.busy = true; render();
    let ok = false; try { ok = await licRefresh(true); } catch (e) { }
    PR.busy = false; if (ok) PR.listAt = Date.now();
    toast(ok ? 'Lista de aparelhos e situação da licença atualizadas.' : (navigator.onLine === false ? 'Sem conexão no momento. O que está na tela é o último dado guardado.' : (LK.msg || 'Não foi possível atualizar agora. Tente de novo em instantes.')));
    if (onRoute()) render();
  }
  /* Remove um aparelho pelo mecanismo que já existe (licRemoveDevice). Confere a lista depois: só diz "feito" se o aparelho saiu mesmo. */
  async function removeOne(id) {
    if (!(await licAuth())) return false;
    await licRemoveDevice(id);
    return !LK.devices.some(d => d.id === id);
  }
  async function doRemove(ids, many) {
    if (busy()) return;
    PR.busy = true; render();
    let n = 0, fail = false;
    try {
      if (!(await licAuth())) { toast('Este aparelho precisa estar conectado à conta Google para gerenciar os outros.'); PR.busy = false; if (onRoute()) render(); return; }
      for (const id of ids) { if (id === curId()) continue; if (await removeOne(id)) n++; else { fail = true; break; } }
    } catch (e) { fail = true; }
    PR.busy = false; if (n) PR.listAt = Date.now();
    if (fail) toast((n ? n + ' desconectado(s), mas ' : '') + (navigator.onLine === false ? 'sem conexão no momento. Tente de novo quando voltar a internet.' : 'não foi possível concluir agora. Atualize a lista e tente de novo.'));
    else toast(many ? (n === 1 ? '1 aparelho desconectado. Uma vaga foi liberada.' : n + ' aparelhos desconectados. ' + n + ' vagas liberadas.') : 'Aparelho desconectado. Uma vaga foi liberada.');
    if (onRoute()) render();
  }
  const devName = id => { const d = (LK.devices || []).find(x => x.id === id); if (!d) return 'Aparelho'; const a = aliases()[id], i = devInfo(d.name); return a || i.model || i.os || d.name || 'Aparelho'; };
  const after = `<ul class="plain pr-ul"><li>A vaga fica livre agora e o aparelho deixa de contar no limite de ${MAX_DEV}.</li><li>Ele perde o acesso Premium quando consultar o servidor de novo. Sem internet, pode manter por até 30 dias o que já estava validado.</li><li>Os dados e os registros guardados nele <b>não são apagados</b>.</li><li>Se ele ainda estiver conectado à sua conta Google, pode ocupar uma vaga livre sozinho ao abrir o app. Para impedir, saia da conta Google nele ou proteja a conta Google (troque a senha).</li></ul>`;
  function askOne(id) {
    const d = (LK.devices || []).find(x => x.id === id); if (!d || isCur(d) || !curId()) return;
    openSheet(`<h2>Desconectar “${esc(devName(id))}”?</h2><p class="pr-p" style="margin:0 0 6px">O que acontece depois:</p>${after}
      <div class="stack" style="margin-top:14px"><button class="btn pri full" data-act="pr-rm-ok" data-id="${esc(id)}">Desconectar aparelho</button><button class="btn full" data-act="pr-cancel">Cancelar</button></div>`);
  }
  function askOthers() {
    const o = (LK.devices || []).filter(d => !isCur(d)); if (!o.length || !curId()) return;
    openSheet(`<h2>Desconectar os outros aparelhos?</h2><p class="pr-p" style="margin:0 0 6px"><b>${o.length === 1 ? 'Será desconectado 1 aparelho' : 'Serão desconectados ' + o.length + ' aparelhos'}</b>: ${o.map(d => esc(devName(d.id))).join(', ')}. Este aparelho continua conectado.</p>${after}
      <div class="stack" style="margin-top:14px"><button class="btn pri full" data-act="pr-rm-others-ok">Desconectar os outros</button><button class="btn full" data-act="pr-cancel">Cancelar</button></div>`);
  }
  function askAlias(id) {
    const a = aliases()[id] || '';
    openSheet(`<h2>Apelido do aparelho</h2><p class="pr-p" style="margin:0 0 10px">Ajuda a reconhecer cada aparelho na lista. O apelido fica guardado só neste aparelho; não muda nada na sua licença.</p>
      <input id="pr-alias-in" class="in" type="text" maxlength="30" value="${esc(a)}" placeholder="Ex.: Celular da sala" autofocus style="width:100%">
      <div class="stack" style="margin-top:14px"><button class="btn pri full" data-act="pr-alias-ok" data-id="${esc(id)}">Salvar apelido</button>${a ? `<button class="btn full" data-act="pr-alias-del" data-id="${esc(id)}">Remover apelido</button>` : ''}<button class="btn full" data-act="pr-cancel">Cancelar</button></div>`);
  }
  function setAlias(id, v) {
    const o = aliases(); v = String(v || '').trim().slice(0, 30);
    if (v) o[id] = v; else delete o[id];
    lsSet(KA, JSON.stringify(o)); closeSheet(); toast(v ? 'Apelido salvo neste aparelho.' : 'Apelido removido.'); if (onRoute()) render();
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act^="pr-"]'); if (!el) return;
    const a = el.dataset.act, id = el.dataset.id;
    if (a === 'pr-refresh') doRefresh();
    else if (a === 'pr-rm') askOne(id);
    else if (a === 'pr-rm-others') askOthers();
    else if (a === 'pr-rm-ok') { const d = (LK.devices || []).find(x => x.id === id); closeSheet(); if (d && !isCur(d) && curId()) doRemove([id], false); }
    else if (a === 'pr-rm-others-ok') { const ids = (LK.devices || []).filter(d => !isCur(d)).map(d => d.id); closeSheet(); if (ids.length && curId()) doRemove(ids, true); }
    else if (a === 'pr-alias') askAlias(id);
    else if (a === 'pr-alias-ok') { const i = document.getElementById('pr-alias-in'); setAlias(id, i && i.value); }
    else if (a === 'pr-alias-del') setAlias(id, '');
    else if (a === 'pr-cancel') closeSheet();
  });

  /* ---- tela ---- */
  const FEAT_ROUTE = { bolus: 'bolus', padroes: 'padroes', exames: 'exames', analise: 'analise', 'rel-pdf': 'relatorios', ia: 'perguntas', metricas: 'metricas' };

  function hero(n) {
    const first = +lsGet(KF) || 0; if (!first) lsSet(KF, String(n));
    const welcome = !first || n - first < FIRST_WEEK;
    const dv = (LK.devices || []).length;
    const crown = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 8.5l4.2 3.6L12 5l4.3 7.1 4.2-3.6-1.7 9.4H5.2z"/><path d="M5.6 20.5h12.8"/></svg>';
    return `<div class="card pr-hero"><i class="pr-glow" aria-hidden="true"></i>
      <div class="pr-top"><span class="pr-seal" aria-hidden="true">${crown}</span><div class="pr-id"><div class="eyebrow">Licença vitalícia</div><b class="pr-plan">PREMIUM</b></div><span class="badge ok pr-tag">✓ Ativa</span></div>
      <h2 class="pr-ti">Você é Premium!</h2>
      <p class="pr-p" style="margin:0">Aproveite tudo o que o ${BRAND} tem a oferecer. A sua conta tem acesso Premium com licença vitalícia, sem cobrança recorrente.</p>
      ${welcome ? `<p class="pr-p" style="margin:8px 0 0">Obrigado pela confiança no ${BRAND}.</p>` : ''}
      <div class="pr-tags"><span class="chip good pr-tag">Sem mensalidade</span><span class="chip pr-tag">Vinculada à conta Google</span>${dv ? `<span class="chip pr-tag">${dv} de ${MAX_DEV} aparelhos</span>` : ''}</div></div>`;
  }
  function stale() {
    return licPremiumNow() ? '' : `<div class="banner warn" role="status"><span><b>Validação pendente.</b> O app não conseguiu confirmar a sua licença com o servidor dentro do prazo sem internet (30 dias), então os recursos Premium estão pausados. Conecte-se à internet e toque em “Atualizar”. Seus registros e dados continuam disponíveis.</span></div>`;
  }
  function deviceRow(d) {
    const cur = isCur(d), a = aliases()[d.id], i = devInfo(d.name), title = a || i.model || i.os || d.name || 'Aparelho';
    const lines = [];
    if (a && (i.model || i.os || d.name)) lines.push(['Aparelho', i.model || d.name]);
    if (!a && i.model && i.os) lines.push(['Sistema', i.os]); else if (a && i.os) lines.push(['Sistema', i.os]);
    if (d.created_at) lines.push(['Vinculado em', fmt(d.created_at)]);
    if (d.last_seen) lines.push(['Última consulta à licença', fmt(d.last_seen)]);
    return `<div class="pr-dev${cur ? ' cur' : ''}"><div class="pr-dh"><b class="pr-dt">${esc(title)}</b>${cur ? '<span class="badge ok pr-tag">Este aparelho</span>' : ''}</div>
      ${lines.map(l => `<div class="pr-ln"><span>${l[0]}</span><span>${esc(l[1])}</span></div>`).join('')}
      <div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="pr-alias" data-id="${esc(d.id)}" ${busy() ? 'disabled' : ''}>Apelido</button>${!cur && curId() ? `<button class="btn sm danger" data-act="pr-rm" data-id="${esc(d.id)}" ${busy() ? 'disabled' : ''}>Desconectar</button>` : ''}</div></div>`;
  }
  function devices() {
    const list = LK.devices || [], n = list.length, others = list.filter(d => !isCur(d)).length, at = Math.max(PR.listAt, LK.okAt || 0) || (LK.payload && LK.payload.iat) || 0;
    const lim = n >= MAX_DEV ? `<div class="banner warn" style="margin:0 0 12px"><span><b>Limite atingido:</b> ${n} de ${MAX_DEV} aparelhos em uso. Para usar a licença em outro aparelho, desconecte um daqui.</span></div>` : n === MAX_DEV - 1 ? `<p class="pr-p" style="margin:0 0 12px">${n} de ${MAX_DEV} aparelhos em uso. Resta 1 vaga.</p>` : n ? `<p class="pr-p" style="margin:0 0 12px">${n} de ${MAX_DEV} aparelhos em uso.</p>` : '';
    return `<h2 class="sec">Aparelhos conectados</h2><div class="card" id="pr-devs">
      <p class="pr-p" style="margin:0 0 12px">Estes são os aparelhos vinculados à sua licença. Se algum não for seu, desconecte-o e proteja a sua conta Google.</p>${lim}
      ${n ? list.map(deviceRow).join('') : '<p class="pr-p" style="margin:0 0 4px">Nenhum aparelho guardado neste aparelho ainda. Toque em “Atualizar lista” para consultar o servidor.</p>'}
      <p class="pr-p" style="margin:12px 0 0" role="status">${at ? 'Lista atualizada em ' + fmt(at) + '.' : 'Lista ainda não atualizada.'}</p>
      <div class="stack" style="margin-top:12px"><button class="btn full" data-act="pr-refresh" ${busy() ? 'disabled' : ''}>${busy() ? 'Consultando…' : 'Atualizar lista'}</button>
      ${others && curId() ? `<button class="btn danger full" data-act="pr-rm-others" ${busy() ? 'disabled' : ''}>Desconectar os outros aparelhos</button>` : ''}</div>
      <p class="pr-p" style="margin:10px 0 0">Desconectar libera uma vaga e não apaga os dados do aparelho. Este aparelho não pode ser desconectado daqui.</p></div>`;
  }
  function benefits() {
    const rows = Object.entries(LIC_PREMIUM).map(([k, t]) => `<li class="pr-feat"><span>${esc(t)}${LIC_LIFETIME[k] ? ' <span class="pr-m">· exclusivo da licença vitalícia</span>' : ''}</span>${VIEWS[FEAT_ROUTE[k]] ? `<button class="btn sm" data-act="go" data-r="${FEAT_ROUTE[k]}">Abrir</button>` : ''}</li>`).join('');
    return `<h2 class="sec">O que a sua licença inclui</h2><div class="card"><ul class="plain" style="margin:0 0 12px"><li><b>Acesso Premium permanente</b>, sem prazo e sem renovação.</li><li>Vinculada à <b>conta Google</b>, não a um aparelho.</li><li>Até ${MAX_DEV} aparelhos ao mesmo tempo; trocar de aparelho é gratuito.</li><li>Sem mensalidade: pagamento único${LK.info && LK.info.paid ? ' (' + money(LK.info.paid) + ')' : ''}.</li></ul>
      <div class="eyebrow" style="margin-bottom:2px">Recursos Premium liberados hoje</div><ul class="plain pr-feats">${rows}</ul>
      <p class="pr-p" style="margin:10px 0 0">Registrar glicemia e insulina, histórico e exportação dos seus dados continuam gratuitos para todos.</p></div>`;
  }
  function account() {
    const p = LK.payload, em = mask(acctEmail());
    const r = [['Conta Google', em || (window.TB_DRV_STATE && TB_DRV_STATE.conn ? 'Conectada' : null)], ['Situação', 'Licença vitalícia ativa'], ['Última validação pelo servidor', fmt(p && p.iat)], ['Funciona sem internet até', p && licPremiumNow() ? fmt(p.vexp) : null]].filter(x => x[1]);
    return `<h2 class="sec">Conta e situação</h2><div class="card">${r.map(x => `<div class="pr-ln"><span>${x[0]}</span><span>${esc(x[1])}</span></div>`).join('')}
      <p class="pr-p" style="margin:10px 0 0">A licença pertence a esta conta Google. O e-mail aparece parcialmente por privacidade. Para conferir a situação agora, use “Atualizar lista” acima.</p>
      ${LK.msg ? `<p class="pr-p" style="margin:8px 0 0" role="status">${esc(LK.msg)}</p>` : ''}</div>`;
  }
  function security() {
    return `<h2 class="sec">Segurança e ajuda</h2><div class="card">
      <ul class="plain" style="margin:0 0 12px"><li>A sua licença está ligada à conta Google. Proteja-a com senha forte e verificação em duas etapas.</li><li>Não reconhece um aparelho? Desconecte-o na lista acima e saia da conta Google nele, ou troque a senha da conta.</li></ul>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="go" data-r="seguranca">Bloqueio e proteção do app</button><button class="btn sm" data-act="go" data-r="backup">Cópia de segurança</button></div>
      <details class="pr-det"><summary>Troquei de aparelho</summary><ol class="plain"><li>No aparelho novo, instale o app e entre com a <b>mesma conta Google</b>.</li><li>Se aparecer que o limite de ${MAX_DEV} aparelhos foi atingido, escolha qual deixar de usar.</li><li>Ou, no aparelho que você ainda tem, desconecte o antigo nesta tela.</li><li>Os dados de saúde ficam no aparelho: use a cópia de segurança para levá-los.</li></ol></details>
      <details class="pr-det"><summary>Perdi o acesso ao Premium</summary><ol class="plain"><li>Confirme que está com a mesma conta Google da compra.</li><li>Conecte à internet e toque em “Atualizar lista”.</li><li>Se o limite de aparelhos foi atingido, libere uma vaga em outro aparelho seu.</li><li>Seus registros continuam disponíveis no plano gratuito enquanto isso.</li></ol></details></div>`;
  }
  function view() {
    loadDevId();
    const n = licNow();
    return banners() + stale() + hero(n) + devices() + benefits() + account() + security();
  }
  VIEWS.licenca = function () { try { return active() ? view() : orig.apply(this, arguments); } catch (e) { console.error(e); return orig.apply(this, arguments); } };
})();
