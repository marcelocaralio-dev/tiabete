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
