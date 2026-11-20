// test24: guardas estáticas da persistência (a simulação completa roda em tests/browser/*.py com Chromium: npm run build:web && python3 tests/browser/persistencia.py)
const fs = require('fs'), path = require('path'), nc = require('crypto');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const md5 = f => nc.createHash('md5').update(fs.readFileSync(path.join(__dirname, '..', f))).digest('hex');
const app = R('src/app.js'), nat = R('native/native.js'), irn = R('native/insrem-native.js'), init = R('src/init.js'), ps = R('src/persist.js'), core = R('native/ai-core.js');
ok(/durability: 'strict'/.test(app), 'gravações no banco usam durabilidade estrita (sobrevivem a encerramento forçado/reinício)');
ok(/waits = \[6000, 10000, 15000\]/.test(app) && /metaOk/.test(app), 'abertura do banco com novas tentativas e trava de meta ilegível');
ok(/onversionchange/.test(app) && /_reopen/.test(app), 'banco reabre sozinho se o sistema fechar a conexão');
ok(/Store\.metaOk = ok/.test(init) && /psRestore\(\)/.test(init) && /tbCfgReady\(\)/.test(init), 'init: lê meta antes de gravar, restaura cópia e libera as sincronizações nativas');
ok((nat.match(/!cfgOk\(\)/g) || []).length >= 7 && /Store\.metaOk/.test(irn), 'sincronizações nativas só rodam com configurações lidas e banco real');
ok(/permWatch/.test(nat) && /tbPermWatch/.test(nat), 'permissão de notificações revogada é tratada');
ok(/masterP/.test(core) && /dbp = null/.test(core), 'cofre: chave mestra única e reabertura após falha');
ok(/'tb-lock'/.test(ps) && /'tb-pnl'/.test(ps) && /pagehide/.test(ps), 'persist.js copia ajustes do localStorage para o banco e grava ao sair');
ok(/'src\/persist\.js', 'src\/init\.js'/.test(R('scripts/build-web.js')), 'persist.js carrega logo antes de init.js');
for (const [f, h] of Object.entries({ 'src/license.js': '8fc50c23d8daeea0333b6c42b5afe04d', 'src/licensecore.js': 'e040fad3daf3efa9de4cb5914b35c090', 'worker/src/index.js': '3203b894358045ee34e272db58058553' })) ok(md5(f) === h, 'módulo de licença intacto: ' + f);
console.log(fail ? 'test24 FALHOU (' + fail + ')' : 'test24 ok (' + n + ' verificações)'); process.exit(fail ? 1 : 0);
