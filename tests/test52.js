// test52: backup no Google Drive (0.48.0): sem carregamento infinito, listagem real, backup programado de verdade, erros e nova tentativa.
// Usa native/drive.js e o trecho do Drive de src/extras.js DE VERDADE, ligados a um "Google Drive" de mentira (sem rede).
process.removeAllListeners('warning');
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ex = rd('src/extras.js'), sec = ex.slice(ex.indexOf('/* ================= Backup no Google Drive'), ex.indexOf('setInterval(drvAuto, 15 * 60000);') + 'setInterval(drvAuto, 15 * 60000);'.length);
const GF = { files: [], seq: 0, mode: 'ok', tokenMode: 'ok', calls: [], hang: false, uploads: 0, noId: false };
const J = (status, data) => ({ status, data });
function google(url, o) {
  GF.calls.push(url);
  if (url.startsWith('https://oauth2.googleapis.com/token')) { if (GF.tokenMode === 'invalid_grant') return J(400, { error: 'invalid_grant' }); if (GF.tokenMode === 'bad_client') return J(401, { error: 'invalid_client' }); return J(200, { access_token: 'at', expires_in: 3600 }); }
  if (GF.hang) return new Promise(() => { });
  if (GF.mode === 'offline') { const e = { code: 'ai_network', net: true, aiMsg: 'Não consegui falar com o provedor de IA.' }; throw e; }
  if (GF.mode === '503') return J(503, {});
  if (GF.mode === '403api') return J(403, { error: { message: 'Google Drive API has not been used in project' } });
  if (GF.mode === '403') return J(403, { error: { message: 'insufficientPermissions' } });
  const u = new URL(url);
  if (u.pathname === '/drive/v3/files' && o.method === 'GET') {
    const q = u.searchParams.get('q') || ''; let r = GF.files.filter(f => !f.trashed);
    const m = q.match(/name = '([^']+)'/); if (m) r = r.filter(f => f.name === m[1] && f.mimeType === 'application/vnd.google-apps.folder');
    const pm = q.match(/'([^']+)' in parents/); if (pm) r = r.filter(f => (f.parents || []).includes(pm[1]));
    return J(200, { files: r.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.created, createdTime: f.created, size: f.content ? String(f.content.length) : undefined })) });
  }
  if (u.pathname === '/drive/v3/files' && o.method === 'POST') { const f = { id: 'F' + (++GF.seq), name: o.body.name, mimeType: o.body.mimeType, created: new Date(Date.now() + GF.seq).toISOString() }; GF.files.push(f); return J(200, { id: f.id }); }
  if (u.pathname === '/upload/drive/v3/files' && o.method === 'POST') {
    const parts = String(o.body).split(/--tb[\w-]+/); const meta = JSON.parse(parts[1].split('\r\n\r\n')[1].trim()), content = parts[2].split('\r\n\r\n')[1].replace(/\r\n$/, '');
    const f = { id: 'F' + (++GF.seq), name: meta.name, parents: meta.parents, mimeType: 'application/json', content, created: new Date(Date.now() + GF.seq).toISOString() }; GF.files.push(f); GF.uploads++;
    return J(200, GF.noId ? {} : { id: f.id, name: f.name, size: String(content.length), createdTime: f.created });
  }
  if (u.pathname.startsWith('/drive/v3/files/') && o.method === 'GET') { const f = GF.files.find(x => x.id === decodeURIComponent(u.pathname.split('/').pop())); return f ? J(200, f.content) : J(404, {}); }
  return J(404, {});
}
function boot(rt, extra) {
  const store = new Map(), cfg = new Map(), meta = new Map(), L = {}, ctx = { console, crypto, TextEncoder, TextDecoder, atob, btoa, Blob, Uint8Array, JSON, Math, Promise, setTimeout, clearTimeout, URL, URLSearchParams, Event, CustomEvent, Date, Array, Object, String, Number, RegExp };
  const ET = new EventTarget(); ctx.window = ctx; ctx.addEventListener = ET.addEventListener.bind(ET); ctx.dispatchEvent = ET.dispatchEvent.bind(ET);
  ctx.document = { addEventListener(t, f) { (L[t] = L[t] || []).push(f); }, hidden: false, getElementById: () => null }; ctx.setInterval = () => 0;
  ctx.TB_PUBLIC = true; ctx.Capacitor = { Plugins: {} };
  ctx.TB_SECURE = { get: async k => store.get(k) ?? null, set: async (k, v) => { store.set(k, v); }, has: async k => store.has(k), del: async k => { store.delete(k); }, getCfg: async k => cfg.get(k) ?? null, setCfg: async (k, v) => { cfg.set(k, v); } };
  ctx.TB_HTTP = async (url, o) => { if (o && o.timeout && GF.hang) { await sleep(Math.min(o.timeout, 200)); throw { code: 'ai_timeout', timeout: true }; } return google(url, o || {}); };
  ctx.S = { route: 'backup', drv: {}, lastBackup: 0 }; ctx.render = () => { ctx.renders = (ctx.renders || 0) + 1; }; ctx.esc = s => String(s); ctx.toast = m => { ctx.toasts.push(m); }; ctx.toasts = []; ctx.openSheet = () => { }; ctx.closeSheet = () => { };
  ctx.Store = { put: async (t, v) => { meta.set(v.id, v); }, all: async () => [...meta.values()] };
  ctx.TB_GOOGLE_CLIENT_ID = 'x.apps.googleusercontent.com'; ctx.HAS_CLAUDE = true;
  ctx.DATA = { records: 3, v: 1 }; ctx.backupText = () => ctx.DATA ? JSON.stringify({ app: 'GLUXO', exportedAt: new Date().toISOString(), data: ctx.DATA }) : null; ctx.hasRealData = () => !!ctx.DATA;
  ctx.secDriveKey = async () => null; ctx.secSeal = async t => t; ctx.b64d = s => s; ctx.markBackup = async () => { ctx.S.lastBackup = Date.now(); }; ctx.isoDate = d => d.toISOString().slice(0, 10); ctx.pad = x => String(x).padStart(2, '0');
  ctx.readBackupFile = async b => { ctx.restored = await b.text(); };
  if (rt) store.set('g-refresh', 'rt'); Object.assign(ctx, extra || {}); vm.createContext(ctx);
  vm.runInContext(rd('native/drive.js'), ctx, { filename: 'drive.js' }); vm.runInContext(sec, ctx, { filename: 'extras-drive.js' });
  ctx.run = s => vm.runInContext(s, ctx); ctx.store = store; ctx.meta = meta; ctx.L = L; return ctx;
}
(async () => {
  /* A) conectado: backup manual cria arquivo REAL na pasta e atualiza o último backup */
  let c = boot(true); await c.run('TB_DRV.ready()'); ok(c.run('TB_DRV_STATE.conn') === true, 'A1 conta restaurada');
  GF.files = [];
  ok(await c.run('drvBackup(true)') === true, 'A2 backup manual concluído');
  const folder = GF.files.find(f => f.mimeType === 'application/vnd.google-apps.folder'), up = GF.files.filter(f => f.content);
  ok(folder && folder.name === 'GLUXO Backups' && up.length === 1 && up[0].parents[0] === folder.id && /^gluxo-backup-.*\.json$/.test(up[0].name), 'A3 arquivo gluxo-backup-*.json criado dentro da pasta GLUXO Backups');
  ok(JSON.parse(up[0].content).data.records === 3, 'A4 o arquivo contém os dados esperados');
  ok(c.run('S.drv.lastStatus') === 'ok' && c.run('S.drv.lastTs') > 0 && !c.run('S.drv.busy') && c.run('S.lastBackup') > 0, 'A5 último backup atualizado e carregamento encerrado');
  ok(c.meta.get('drive-pref').lastTs === c.run('S.drv.lastTs') && c.meta.get('drive-pref').lastHash, 'A6 estado gravado no aparelho');
  /* B) consulta ao Drive: arquivos reais, mais recente primeiro, nome/data/tamanho */
  await sleep(5); await c.run('S.drv.lastHash=""; drvBackup(true)');
  await c.run('drvList()'); let li = c.run('S.drv.list');
  ok(li.length === 2 && li[0].createdTime >= li[1].createdTime && li.every(f => f.title && f.createdTime && f.size > 0), 'B1 lista real com nome, criação e tamanho, ordenada pela mais recente');
  ok(c.run('S.drv.listState') === 'ok' && !c.run('S.drv.busy') && /mais recente/.test(c.run('driveCardBody("x")')) && /Criada em/.test(c.run('driveCardBody("x")')), 'B2 tela mostra a lista, o selo "mais recente" e as informações');
  await c.run('drvLoad(S.drv.list[0].id)'); ok(c.restored && JSON.parse(c.restored).data.records === 3, 'B3 restaurar baixa o conteúdo real');
  GF.files = []; c = boot(true); await c.run('TB_DRV.ready()'); await c.run('drvList()');
  ok(c.run('S.drv.listState') === 'empty' && /Nenhuma cópia/.test(c.run('S.drv.msg')) && !GF.files.length && /Nenhuma cópia/.test(c.run('driveCardBody("x")')), 'B4 estado vazio claro e sem criar pasta só por consultar');
  /* C) backup automático */
  GF.files = []; GF.uploads = 0; c = boot(true); await c.run('TB_DRV.ready()');
  c.run('S.drv.auto = true; S.drv.freq = "1"; S.drv.lastTs = 0'); c.run('drvAuto()'); await sleep(150);
  ok(GF.uploads === 1 && c.run('S.drv.lastStatus') === 'ok', 'C1 ligado e sem cópia: envia sozinho, sem tocar em botão');
  c.run('drvAuto()'); await sleep(100); ok(GF.uploads === 1, 'C2 dentro do intervalo não envia de novo');
  c.run('S.drv.lastTs = Date.now() - 3 * 86400000; S.drv.checkedAt = 0; drvAuto()'); await sleep(150); ok(GF.uploads === 1, 'C3 intervalo vencido mas dados iguais: não duplica arquivo no Drive');
  c.run('DATA = { records: 4 }; S.drv.checkedAt = 0; drvAuto()'); await sleep(150); ok(GF.uploads === 2 && c.run('S.drv.lastTs') > Date.now() - 5000, 'C4 dados mudaram e intervalo vencido: envia e atualiza a data');
  c.run('S.drv.auto = false; S.drv.lastTs = 0; S.drv.checkedAt = 0; drvAuto()'); await sleep(100); ok(GF.uploads === 2, 'C5 desligado: não envia');
  c.run('S.drv.auto = true; S.drv.lastTs = 0; DATA = null; drvAuto()'); await sleep(100); ok(GF.uploads === 2, 'C6 sem dados reais: não envia');
  c.run('DATA = { records: 9 }; S.drv.lastTs = 0; S.drv.checkedAt = 0'); c.ctxSave = c.run('S.drv.auto');
  const c2 = boot(true); c2.meta.set('drive-pref', c.meta.get('drive-pref')); await c2.run('TB_DRV.ready()');
  await c2.run("(async()=>{ const dp = (await Store.all('meta')).find(x => x.id === 'drive-pref'); Object.assign(S.drv, { auto: !!dp.auto, lastTs: dp.lastTs || 0, lastHash: dp.lastHash || '', freq: String(dp.freq) }); })()");
  ok(c2.run('S.drv.auto') === true && c2.run('S.drv.lastHash.length') === 64, 'C7 configuração salva e recuperada (ativada, frequência, impressão digital)');
  const dispatched = []; c2.addEventListener('tb-drv-fail', e => dispatched.push(e.detail)); c2.run('DATA={records:11}; S.drv.lastTs=0; S.drv.checkedAt=0'); GF.mode = '503'; c2.run('drvAuto()'); await sleep(150);
  ok(c2.run('S.drv.lastStatus') === 'fail' && c2.run('S.drv.lastMsg') && dispatched.length === 1 && !c2.run('S.drv.busy'), 'C8 falha da cópia automática: registra erro, avisa e libera');
  const up0 = GF.uploads; GF.mode = 'ok'; c2.run('drvAuto()'); await sleep(100); ok(GF.uploads === up0, 'C9 após falha espera antes de tentar sozinha (sem martelar o Google)');
  c2.run('S.drv.failAt = 0'); c2.run('drvAuto()'); await sleep(150); ok(GF.uploads === up0 + 1 && c2.run('S.drv.lastStatus') === 'ok', 'C10 depois do prazo tenta de novo e conclui');
  /* D) falhas: nunca fica preso, sempre dá para tentar de novo */
  for (const [mode, re, name] of [['offline', /Sem conexão/, 'sem internet'], ['503', /não respondeu/, 'API indisponível'], ['403api', /não está ativada/, 'API desativada'], ['403', /negou o acesso/, 'sem permissão']]) {
    GF.mode = mode; c = boot(true); await c.run('TB_DRV.ready()');
    await c.run('drvList()'); ok(c.run('S.drv.listState') === 'error' && re.test(c.run('S.drv.msg')) && !c.run('S.drv.busy') && re.test(c.run('driveCardBody("x")')), 'D ver cópias, ' + name + ': mensagem clara e sem carregamento preso');
    await c.run('drvBackup(true)'); ok(c.run('S.drv.lastStatus') === 'fail' && re.test(c.run('S.drv.lastMsg')) && !c.run('S.drv.busy'), 'D backup, ' + name + ': falha registrada e sem carregamento preso');
    GF.mode = 'ok'; GF.files = []; ok(await c.run('drvBackup(true)') === true && c.run('S.drv.lastStatus') === 'ok', 'D tentar de novo funciona sem sair da conta (' + name + ')');
  }
  GF.mode = 'ok'; c = boot(); await c.run('TB_DRV.ready()'); await c.run('drvBackup(true)'); ok(c.run('S.drv.lastStatus') === 'fail' && /Conecte sua conta/.test(c.run('S.drv.lastMsg')) && !c.run('S.drv.busy'), 'D conta desconectada: avisa para conectar');
  GF.tokenMode = 'invalid_grant'; c = boot(true); await c.run('TB_DRV.ready()'); await c.run('drvList()'); ok(/expirou/.test(c.run('S.drv.msg')) && !c.store.has('g-refresh') && !c.run('S.drv.busy'), 'D autorização vencida (invalid_grant): pede reconexão');
  GF.tokenMode = 'bad_client'; c = boot(true); await c.run('TB_DRV.ready()'); await c.run('drvList()'); ok(/recusou a autorização/.test(c.run('S.drv.msg')) && c.store.has('g-refresh'), 'D falha de autorização que não é de login: mantém a conexão guardada e explica');
  GF.tokenMode = 'ok';
  /* E) Requisição que nunca responde: o limite de tempo encerra e libera */
  GF.hang = true; c = boot(true); await c.run('TB_DRV.ready()'); const t0 = Date.now(); await c.run('drvList()');
  ok(c.run('S.drv.listState') === 'error' && /demorou demais/.test(c.run('S.drv.msg')) && !c.run('S.drv.busy') && Date.now() - t0 < 3000, 'E1 chamada pendurada no Google vira erro de tempo e libera a tela');
  c = boot(true); await c.run('TB_DRV.ready()'); 
  ok(await c.run('(async()=>{ const p = drvDeadline(new Promise(()=>{}), 200).catch(e => e.code); return p; })()') === 'drv_timeout', 'E2 prazo geral do app também encerra operação que não termina');
  c.run('S.drv.busy = true; S.drv.busyAt = Date.now() - 200000'); ok(c.run('drvIsBusy()') === false && c.run('drvBegin("x")') > 0, 'E3 operação esquecida como "ocupada" é descartada e não bloqueia mais');
  GF.hang = false;
  /* F) cliques repetidos */
  GF.files = []; GF.uploads = 0; c = boot(true); await c.run('TB_DRV.ready()');
  await c.run('Promise.all([drvBackup(true), drvBackup(true), drvBackup(true)])'); ok(GF.uploads === 1, 'F1 três cliques seguidos geram um único envio');
  /* G) upload sem confirmação do Drive não conta como sucesso */
  GF.noId = true; c = boot(true); await c.run('TB_DRV.ready()'); ok(await c.run('drvBackup(true)') === false && c.run('S.drv.lastStatus') === 'fail', 'G1 Drive não confirmou o arquivo: falha (não finge sucesso)'); GF.noId = false;
  /* H) ligar a chave sem permissão desliga; falha temporária mantém */
  c = boot(); await c.run('TB_DRV.ready()'); c.run('window.__ev={target:{id:"drv-auto",checked:true}}'); const ch = c.L.change; for (const f of ch) await f({ target: { id: 'drv-auto', checked: true } });
  ok(c.run('S.drv.auto') === false, 'H1 sem conta conectada a chave volta a desligada (não finge estar ligada)');
  GF.mode = '503'; c = boot(true); await c.run('TB_DRV.ready()'); for (const f of c.L.change) await f({ target: { id: 'drv-auto', checked: true } });
  ok(c.run('S.drv.auto') === true, 'H2 falha temporária ao ligar: a chave continua ligada e tentará de novo'); GF.mode = 'ok';
  /* I) arquivos de interface */
  ok(/gx-out-wrap/.test(rd('native/drive.js')) && /gx-out-wrap/.test(rd('src/readmore.js')) && /\.gx-out-wrap/.test(rd('src/conta.css')), 'I1 botão de sair fica por último no cartão (textos recolhíveis não passam à frente)');
  console.log(fail ? 'test52: ' + fail + ' falha(s) de ' + n : 'test52 ok (' + n + ' verificações)'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERRO', e); process.exit(1); });
