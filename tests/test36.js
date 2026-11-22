// test36: migração do nome TiaBete -> GLUXO (0.35.0): nada visível com o nome antigo; identificadores técnicos e dados antigos preservados.
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const OLD = /tia[ _-]?bete/gi;
/* tudo o que o usuário vê: o nome antigo só pode aparecer nos identificadores técnicos mantidos (lista fechada abaixo) */
const KEEP = [/app\.tiabete\.glicose/g, /tiabete-license-api/g, /tiabete-licenses/g, /marcelocaralio-dev\/tiabete/g, /UID:tiabete-\$\{it\.k\}-\$\{d0\}@tiabete\.local/g, /'TiaBete'/g, /'TiaBete Backups'/g, /tiabete-pwa-/g, /TIABETE_DEV/g, /tiabete-backup-/g, /\(\?:gluxo\|tiabete\)-backup-/g];
const strip = t => KEEP.reduce((s, r) => s.replace(r, ''), t);
for (const f of [...walk('src'), ...walk('native'), 'worker/src/index.js', 'scripts/patch-android.js', 'scripts/build-web.js', 'scripts/build-pwa.js', 'capacitor.config.json', 'package.json', 'README.md', 'LEIA-ME.md', 'PRIVACY.md', '.github/workflows/android.yml']) {
  if (!/\.(js|css|html|json|md|yml)$/.test(f)) continue;
  const left = strip(rd(f)).match(OLD); ok(!left, 'sem o nome antigo fora dos identificadores mantidos: ' + f + (left ? ' (' + left.length + ')' : ''));
}
ok(/GLUXO/.test(rd('src/secure.js')) && !/app: 'TiaBete'/.test(rd('src/app.js')), 'novas cópias de segurança saem com app GLUXO');
ok(/\['GlicoTrack', 'TiaBete', 'GLUXO'\]\.includes\(j\.app\)/.test(rd('src/app.js')), 'restauração aceita cópias antigas (TiaBete, GlicoTrack) e novas (GLUXO)');
ok(/DRV_FOLDER_OLD = 'TiaBete Backups'/.test(rd('src/extras.js')) && /find\(DRV_FOLDER_OLD\)/.test(rd('src/extras.js')), 'Drive: pasta antiga continua sendo achada (nenhuma cópia perdida)');
ok(/\(\?:gluxo\|tiabete\)-backup-/.test(rd('src/extras.js')), 'lista do Drive mostra cópias com prefixo novo e antigo');
const lab = 'tiabete-backup-2026-01-01-0800.json'.replace(/^(?:gluxo|tiabete)-backup-/, ''), lab2 = 'gluxo-backup-2026-01-01-0800.json'.replace(/^(?:gluxo|tiabete)-backup-/, ''); ok(lab === '2026-01-01-0800.json' && lab2 === lab, 'rótulo das cópias antigas e novas');
const cfg = JSON.parse(rd('capacitor.config.json')); ok(cfg.appId === 'app.tiabete.glicose' && cfg.appName === 'GLUXO', 'applicationId mantido; nome do app GLUXO');
ok(/app\.tiabete\.glicose/.test(rd('native/drive.js')) && /app\.tiabete\.glicose:\/pagamento/.test(rd('worker/src/index.js')), 'esquema de retorno do login e do pagamento mantido');
const tm = rd('worker/wrangler.toml'); ok(/^name = "tiabete-license-api"$/m.test(tm) && /^database_name = "tiabete-licenses"$/m.test(tm), 'Worker e banco D1 reais mantidos (licenças preservadas)');
ok(rd('config/license-api.txt').includes('tiabete-license-api'), 'endereço da API de licenças mantido');
ok(/\.pdf|gluxo-relatorio/.test(rd('src/report.js')) && /gluxo-backup-/.test(rd('src/app.js')) && /gluxo-lembretes/.test(rd('src/extras.js')), 'arquivos exportados com nome GLUXO');
ok(/UID:tiabete-/.test(rd('src/extras.js')), 'UID do calendário mantido (reexportar atualiza os eventos, sem duplicar)');
ok(/ic_stat_gluxo/.test(rd('capacitor.config.json')) && fs.existsSync(path.join(ROOT, 'assets/notification/ic_stat_gluxo-mdpi.png')) && !fs.existsSync(path.join(ROOT, 'assets/notification/ic_stat_tiabete-mdpi.png')), 'ícone de notificação: só o nome do arquivo mudou');
ok(/GLUXO\.apk/.test(rd('.github/workflows/android.yml')) && /Compilar APK GLUXO/.test(rd('.github/workflows/android.yml')), 'workflow gera GLUXO.apk');
console.log(fail ? 'test36 FALHOU (' + fail + ')' : 'test36 ok (' + n + ' verificações)'); process.exit(fail ? 1 : 0);
