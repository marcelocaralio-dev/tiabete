// test23: Central Premium (src/premium.js). Tela só para licença vitalícia, aparelhos, confirmações, anti-duplicação e módulo de licença intacto.
process.removeAllListeners('warning');
const vm = require('vm'), fs = require('fs'), path = require('path'), crypto = require('crypto').webcrypto, nodeCrypto = require('crypto');
const ROOT = path.join(__dirname, '..'), core = require('../src/licensecore.js');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const md5 = f => nodeCrypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

(async () => {
  /* ---------- 0) o módulo de licenciamento está travado na versão 0.34.0 (visitante + Android ID): qualquer mudança futura exige atualizar estes hashes de propósito ---------- */
  const LOCK = { 'src/license.js': 'ddf8bb2807aa8f0bade16707e5b069db', 'src/licensecore.js': 'e7ba4ce34217ea6faa237f7d2ed4b278', 'worker/src/index.js': '8b8a3ae8c89ffdbbd2f630f7e52ad521' };
  for (const [f, h] of Object.entries(LOCK)) ok(md5(f) === h, 'intacto: ' + f);
  for (const f of fs.readdirSync(path.join(ROOT, 'worker/migrations'))) ok(/^000[1-6]_/.test(f), 'sem migração nova: ' + f);
  const pm = rd('src/premium.js');
  ok(!/\b(licSave|licSign|licVerify|licSession|licBuy|licCall|licComputeState)\s*\(/.test(pm), 'premium.js não chama validação, gravação, compra nem sessão');
  ok(!/LK\.(payload|devices|info|conflict|msg|seen|cfg|api)\s*=[^=]/.test(pm) && !/TB_HTTP|\.set\(|\.setCfg\(/.test(pm), 'premium.js não escreve no estado da licença, na rede nem no cofre');
  ok(/'src\/license\.js', 'src\/premium\.js'/.test(rd('scripts/build-web.js')), 'premium.js entra no build logo depois de license.js');

  /* ---------- ambiente: licença configurada com chave real de teste ---------- */
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const priv = await crypto.subtle.exportKey('jwk', kp.privateKey), pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const T = { now: Date.now() };
  const mkTok = (st, dev) => core.licSign({ v: 1, sub: 's1', st, te: null, lic: st === 'lifetime_active', iat: T.now, vexp: T.now + core.LIC_GRACE_LIFETIME_MS, dev }, priv);
  const D = (id, name, ago) => ({ id, name, created_at: T.now - ago * 864e5 - 1e6, last_seen: T.now - ago * 864e5 });
  const SRV = { devices: [], st: 'lifetime_active', calls: [], removeStatus: 200, refreshStatus: 200 };
  const http = async (url, o) => {
    const p = url.replace('https://x.test', ''); SRV.calls.push(p); const b = o.body || {};
    await new Promise(r => setTimeout(r, 5));
    if (p === '/v1/refresh') { if (SRV.refreshStatus !== 200) return { status: SRV.refreshStatus, data: {} }; return { status: 200, data: { token: await mkTok(SRV.st, 'DEV-A-0000000000000000'), status: SRV.st, trial_ends_at: null, server_time: T.now, price_cents: 2990, licensed_price_cents: 2990, devices: SRV.devices, email: 'maria.silva@gmail.com' } }; }
    if (p === '/v1/devices/remove') { if (SRV.removeStatus !== 200) return { status: SRV.removeStatus, data: {} }; SRV.devices = SRV.devices.filter(d => d.id !== b.id); return { status: 200, data: { devices: SRV.devices } }; }
    return { status: 404, data: {} };
  };
  const store = { 'lic-secret': 'sec', 'lic-dev': 'DEV-A-0000000000000000' };
  const ls = {};
  function boot(opt) {
    opt = opt || {};
    const listeners = [], sheets = [], toasts = []; let renders = 0;
    const c = { console, crypto, TextEncoder, TextDecoder, atob, btoa, Date, Math, JSON, Promise, setTimeout, clearTimeout, Uint8Array, VIEWS: { bolus: () => 'B', padroes: () => 'P', exames: () => 'E', analise: () => 'A', relatorios: () => 'R', perguntas: () => 'Q', metricas: () => 'M', seguranca: () => 'S', backup: () => 'K' }, TITLES: {}, MI: {},
      S: { route: 'licenca' }, banners: () => '', esc: s => String(s).replace(/[&<>"']/g, ch => '&#' + ch.charCodeAt(0) + ';'), go() { }, render() { renders++; }, toast: m => toasts.push(m), openSheet: h => sheets.push(h), closeSheet() { sheets.push('CLOSED'); },
      document: { addEventListener(t, f) { if (t === 'click') listeners.push(f); }, visibilityState: 'hidden' }, addEventListener() { }, navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7)', onLine: true }, localStorage: { getItem: k => ls[k] ?? null, setItem: (k, v) => { ls[k] = String(v); } },
      TB_LICENSE_API: 'https://x.test', TB_LICENSE_PUBKEY: JSON.stringify(pub), TB_DEV_MODE: false, TB_DRV_STATE: { conn: true, profile: { email: 'maria.silva@gmail.com' } } };
    c.window = c;
    c.TB_SECURE = { get: async k => store[k] || null, getCfg: async k => store[k] || null, set: async (k, v) => { store[k] = v; }, setCfg: async (k, v) => { store[k] = v; }, has: async () => true };
    c.TB_HTTP = http;
    vm.createContext(c);
    vm.runInContext(rd('src/licensecore.js') + '\n' + rd('src/license.js'), c);
    c.orig = c.VIEWS.licenca;
    vm.runInContext(pm, c);
    c.run = s => vm.runInContext(s, c);
    c.click = async (act, id) => { const el = { dataset: { act, id } }; for (const f of listeners) f({ target: { closest: () => el } }); await new Promise(r => setTimeout(r, 60)); };
    c.sheets = sheets; c.toasts = toasts; c.renders = () => renders; return c;
  }
  async function lifetime(devs, devId) {
    SRV.devices = devs.map(d => ({ ...d })); SRV.st = 'lifetime_active'; SRV.calls.length = 0; SRV.removeStatus = 200; SRV.refreshStatus = 200;
    const c = boot(); await new Promise(r => setTimeout(r, 30));
    await c.run('licLoad()'); await c.run('licRefresh(true)'); if (devId === null) c.run('LK.payload.dev = null'); SRV.calls.length = 0; return c;
  }
  const A = D('DEV-A-0000000000000000', 'Linux; Android 14; Pixel 7', 0), B = D('DEV-B-0000000000000000', 'Windows NT 10.0; Win64; x64', 3), C3 = D('DEV-C-0000000000000000', 'iPhone; CPU iPhone OS 17_2 like Mac OS X', 9);

  /* ---------- 1) quem vê a Central ---------- */
  let c = boot(); ok(c.run('licStatus()') === 'pending_trial' && c.run('VIEWS.licenca()').includes('Seu plano') && !c.run('VIEWS.licenca()').includes('Você é Premium'), 'sem licença: continua a tela original');
  c = await lifetime([A, B]);
  let h = c.run('VIEWS.licenca()');
  ok(c.run('licStatus()') === 'lifetime_active' && h.includes('Você é Premium!') && h.includes('Aproveite tudo o que o GLUXO tem a oferecer'), 'vitalícia: saudação Premium');
  ok(h.includes('sem cobrança recorrente') && h.includes('Obrigado pela confiança') && h.includes('Vinculada à conta Google'), 'vitalícia: sem recorrência, agradecimento, vínculo com a conta');
  ok(/Obrigado pela confiança/.test(h) && (() => { c.run('1'); ls['tb-prem-first'] = String(T.now - 9 * 864e5); return !c.run('VIEWS.licenca()').includes('Obrigado pela confiança'); })() && c.run('VIEWS.licenca()').includes('Você é Premium!'), 'agradecimento só na primeira semana; saudação continua compacta depois');
  ok(h.includes('Este aparelho') && h.includes('Pixel 7') && h.includes('Android 14') && h.includes('Windows') && h.includes('Vinculado em') && h.includes('Última consulta à licença'), 'aparelhos: atual identificado, modelo/sistema só quando o nome diz, datas reais');
  ok((h.match(/data-act="pr-rm"/g) || []).length === 1 && !new RegExp('data-act="pr-rm" data-id="DEV-A').test(h), 'só o outro aparelho tem "Desconectar"; o atual não');
  ok(h.includes('2 de 2 aparelhos') && h.includes('Limite atingido'), 'limite de aparelhos atingido é avisado');
  ok(h.includes('ma•••@gmail.com') && !h.includes('maria.silva'), 'e-mail da conta aparece mascarado');
  ok(['Cálculo de bolus', 'Padrões e observações automáticas', 'Exames laboratoriais', 'Análise e gráficos', 'Relatório em PDF', 'Recursos de inteligência artificial', 'Central de Métricas Glicêmicas'].every(t => h.includes(t)), 'benefícios = exatamente os recursos de LIC_PREMIUM');
  ok(!/atualizações futuras|em breve|suporte@|whatsapp/i.test(h), 'nada prometido que o sistema não garante; nenhum canal de suporte inventado');
  ok(h.includes('Última validação pelo servidor') && h.includes('Lista atualizada em'), 'validação e data da lista vêm do payload assinado');
  c.run('1'); ls['tb-prem-alias'] = JSON.stringify({ 'DEV-B-0000000000000000': 'PC <b>do</b> trabalho' });
  h = c.run('VIEWS.licenca()'); ok(h.includes('PC &#60;b&#62;do&#60;/b&#62; trabalho'), 'apelido (só neste aparelho) escapado'); delete ls['tb-prem-alias'];
  c.run('LK.devices = [LK.devices[0]]'); h = c.run('VIEWS.licenca()'); ok(h.includes('1 de 2 aparelhos') && h.includes('Resta 1 vaga') && !h.includes('Desconectar os outros'), 'com 1 aparelho: avisa vaga e não oferece desconectar outros');
  c.run('LK.devices = []'); h = c.run('VIEWS.licenca()'); ok(h.includes('Nenhum aparelho guardado') && !h.includes('data-act="pr-rm'), 'sem dados de aparelhos: nada inventado');

  /* ---------- 2) token vencido offline: aviso e nada apagado ---------- */
  c = await lifetime([A, B]); c.run('LK.payload.vexp = Date.now() - 1000'); h = c.run('VIEWS.licenca()');
  ok(h.includes('Validação pendente') && h.includes('Seus registros e dados continuam disponíveis') && h.includes('Você é Premium!'), 'token vencido: aviso claro, sem esconder a licença');

  /* ---------- 3) atualizar: uma chamada só, mesmo com toques repetidos ---------- */
  c = await lifetime([A, B]); c.click('pr-refresh'); c.click('pr-refresh'); c.click('pr-refresh'); await new Promise(r => setTimeout(r, 150));
  ok(SRV.calls.filter(x => x === '/v1/refresh').length === 1, 'toques repetidos em Atualizar = 1 só consulta');
  ok(c.toasts.some(t => /atualizadas/.test(t)), 'feedback de sucesso ao atualizar');
  c = await lifetime([A, B]); SRV.refreshStatus = 500; await c.click('pr-refresh'); await new Promise(r => setTimeout(r, 80)); ok(c.toasts.some(t => /Não foi possível|servidor/.test(t)) && c.run('LK.devices.length') === 2, 'falha ao atualizar: mensagem de erro e lista guardada preservada');

  /* ---------- 4) desconectar um aparelho: confirmação antes, ação real depois ---------- */
  c = await lifetime([A, B, C3].slice(0, 2), 1); SRV.calls.length = 0;
  await c.click('pr-rm', B.id);
  ok(c.sheets.length === 1 && /Desconectar “Windows”\?/.test(c.sheets[0]) && c.sheets[0].includes('não são apagados') && c.sheets[0].includes('vaga fica livre') && SRV.calls.length === 0, 'abre confirmação explicando o que acontece e não chama o servidor ainda');
  await c.click('pr-cancel'); ok(SRV.calls.length === 0 && SRV.devices.length === 2, 'cancelar não faz nada');
  await c.click('pr-rm-ok', B.id); await new Promise(r => setTimeout(r, 80));
  ok(SRV.calls.filter(x => x === '/v1/devices/remove').length === 1 && SRV.devices.length === 1 && c.run('LK.devices.length') === 1 && c.toasts.some(t => /desconectado/.test(t)), 'confirmar remove no servidor, atualiza a lista e mostra sucesso');
  await c.click('pr-rm-ok', A.id); ok(SRV.devices.some(d => d.id === A.id), 'o aparelho atual nunca é removido por esta tela');
  c = await lifetime([A, B]); SRV.removeStatus = 500; await c.click('pr-rm-ok', B.id); await new Promise(r => setTimeout(r, 80));
  ok(c.run('LK.devices.length') === 2 && c.toasts.some(t => /não foi possível/i.test(t)) && !c.toasts.some(t => /liberada/.test(t)), 'erro do servidor: aparelho continua na lista e o erro é informado (sem falso sucesso)');
  c = await lifetime([A, B]); c.click('pr-rm-ok', B.id); c.click('pr-rm-ok', B.id); await new Promise(r => setTimeout(r, 150)); ok(SRV.calls.filter(x => x === '/v1/devices/remove').length === 1, 'toques repetidos em confirmar = 1 só remoção');

  /* ---------- 5) desconectar os outros ---------- */
  c = await lifetime([A, B, D('DEV-C-0000000000000000', 'Linux', 5)]); await c.click('pr-rm-others'); 
  ok(c.sheets.length === 1 && c.sheets[0].includes('Serão desconectados 2 aparelhos') && c.sheets[0].includes('Este aparelho continua conectado') && SRV.devices.length === 3, 'confirmação lista quantos serão desconectados; nada acontece antes');
  await c.click('pr-rm-others-ok'); await new Promise(r => setTimeout(r, 150));
  ok(SRV.devices.length === 1 && SRV.devices[0].id === A.id && c.toasts.some(t => /2 aparelhos desconectados/.test(t)), 'só o aparelho atual permanece');

  /* ---------- 6) aparelho atual não identificado: nenhum botão de desconexão ---------- */
    const c2 = boot(); delete store['lic-dev']; SRV.devices = [A, B].map(d => ({ ...d })); await c2.run('licLoad()'); await c2.run('licRefresh(true)'); c2.run('LK.payload.dev = null'); h = c2.run('VIEWS.licenca()');
  ok(!h.includes('data-act="pr-rm"') && !h.includes('pr-rm-others') && !h.includes('Este aparelho<'), 'sem saber qual é o aparelho atual, não oferece desconectar (evita cortar o próprio acesso)'); store['lic-dev'] = 'DEV-A-0000000000000000';

  /* ---------- 7) apelido: só interface, local ---------- */
  c = await lifetime([A, B]); await c.click('pr-alias', B.id); ok(c.sheets[0].includes('Apelido do aparelho') && c.sheets[0].includes('só neste aparelho'), 'apelido explica que é local');
  /* ---------- 8) deixou de ser vitalícia: volta à tela original ---------- */
  c = await lifetime([A, B]); SRV.st = 'refunded'; await c.run('licRefresh(true)'); h = c.run('VIEWS.licenca()'); ok(c.run('licStatus()') === 'refunded' && h.includes('Licença não está ativa') && !h.includes('Você é Premium'), 'reembolsada: tela original, sem Central Premium');
  /* ---------- 9) mobile: CSS sem largura fixa ---------- */
  const css = rd('src/premium.css'); ok(!/(?<![-\w])width:\s*\d{3,}px/.test(css) && /max-width: 380px/.test(css) && /overflow-wrap/.test(css), 'CSS responsivo, sem largura fixa');
  console.log(fail ? 'test23 FALHOU (' + fail + ')' : 'test23 ok (' + n + ' verificações)'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
