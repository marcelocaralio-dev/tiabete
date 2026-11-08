// Ajustes no projeto Android gerado pelo Capacitor: permissão de notificações e sem backup automático do Google (dados de saúde).
const fs = require('fs'), path = require('path');
const f = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(f)) { console.error('AndroidManifest.xml não encontrado. Rode "npx cap add android" antes.'); process.exit(1); }
let x = fs.readFileSync(f, 'utf8');
const perms = ['android.permission.POST_NOTIFICATIONS', 'android.permission.RECEIVE_BOOT_COMPLETED'];
for (const p of perms) if (!x.includes(p)) x = x.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`);
if (/android:allowBackup="true"/.test(x)) x = x.replace('android:allowBackup="true"', 'android:allowBackup="false"');
fs.writeFileSync(f, x);
console.log('AndroidManifest.xml ajustado.');

// Número de versão que sobe a cada montagem (o Android só aceita atualizar para um versionCode maior).
const g = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
if (fs.existsSync(g)) {
  const pkg = require('../package.json');
  const code = parseInt(process.env.GITHUB_RUN_NUMBER || '1', 10) || 1;
  let t = fs.readFileSync(g, 'utf8');
  t = t.replace(/versionCode\s+\d+/, 'versionCode ' + code).replace(/versionName\s+"[^"]*"/, 'versionName "' + pkg.version + '"');
  fs.writeFileSync(g, t);
  console.log('versionCode', code, 'versionName', pkg.version);
}
