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

// Fontes do app iguais às da versão web: ignora o "tamanho da fonte" do Android dentro do WebView (textZoom 100%).
(function findMain(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { findMain(f); continue; }
    if (e.name !== 'MainActivity.java') continue;
    let j = fs.readFileSync(f, 'utf8');
    if (j.includes('setTextZoom')) return;
    if (!/extends\s+BridgeActivity\s*\{\s*\}/.test(j)) { console.warn('MainActivity.java com formato inesperado; textZoom não aplicado.'); return; }
    j = j.replace(/extends\s+BridgeActivity\s*\{\s*\}/, 'extends BridgeActivity {\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        getBridge().getWebView().getSettings().setTextZoom(100);\n    }\n}');
    fs.writeFileSync(f, j); console.log('textZoom 100% aplicado em', e.name);
  }
})(path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java'));
