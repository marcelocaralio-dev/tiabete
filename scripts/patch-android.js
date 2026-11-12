// Ajustes no projeto Android gerado pelo Capacitor: permissão de notificações e sem backup automático do Google (dados de saúde).
const fs = require('fs'), path = require('path');
const f = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(f)) { console.error('AndroidManifest.xml não encontrado. Rode "npx cap add android" antes.'); process.exit(1); }
let x = fs.readFileSync(f, 'utf8');
const perms = ['android.permission.POST_NOTIFICATIONS', 'android.permission.RECEIVE_BOOT_COMPLETED', 'android.permission.SCHEDULE_EXACT_ALARM'];
for (const p of perms) if (!x.includes(p)) x = x.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`);
/* Retorno do login Google (backup no Drive): o app recebe app.tiabete.glicose:/oauth2redirect */
if (!x.includes('app.tiabete.glicose"')) {
  const filt = '\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="app.tiabete.glicose" />\n            </intent-filter>\n        ';
  const i = x.indexOf('</activity>'); if (i > 0) x = x.slice(0, i) + filt.replace(/\s+$/, '\n        ') + x.slice(i); else console.warn('Não achei </activity> no manifesto; login Google não configurado.');
}
/* Receptor que apaga a notificação "medir 2 h depois" se ninguém mediu em 10 minutos */
if (!x.includes('.ExpireReceiver')) x = x.replace('</application>', '    <receiver android:name=".ExpireReceiver" android:exported="false" />\n    </application>');
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
    const pk = (/package\s+([\w.]+)\s*;/.exec(j) || [])[1];
    if (pk) writeExpire(path.dirname(f), pk); else console.warn('Pacote do MainActivity não encontrado; expiração de notificações não instalada.');
    j = j.replace(/extends\s+BridgeActivity\s*\{\s*\}/, 'extends BridgeActivity {\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(TbExpirePlugin.class);\n        super.onCreate(savedInstanceState);\n        getBridge().getWebView().getSettings().setTextZoom(100);\n        getBridge().getWebView().getSettings().setUseWideViewPort(true);\n        getBridge().getWebView().getSettings().setLoadWithOverviewMode(true);\n    }\n}');
    fs.writeFileSync(f, j); console.log('textZoom 100% aplicado em', e.name);
  }
})(path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java'));


/* Plugin nativo mínimo: agenda e cancela a "expiração" de uma notificação (remove da bandeja após N ms). */
function writeExpire(dir, pk) {
  fs.writeFileSync(path.join(dir, 'ExpireReceiver.java'), `package ${pk};

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class ExpireReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        int id = intent.getIntExtra("nid", -1);
        if (id < 0) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(id);
    }
}
`);
  fs.writeFileSync(path.join(dir, 'TbExpirePlugin.java'), `package ${pk};

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TbExpire")
public class TbExpirePlugin extends Plugin {
    private PendingIntent pending(int id) {
        Intent i = new Intent(getContext(), ExpireReceiver.class);
        i.setAction("${pk}.EXPIRE." + id);
        i.putExtra("nid", id);
        return PendingIntent.getBroadcast(getContext(), id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        try {
            int id = Integer.parseInt(call.getString("id"));
            long at = Long.parseLong(call.getString("at"));
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(id));
            call.resolve();
        } catch (Exception e) {
            call.reject("expire schedule failed");
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        try {
            int id = Integer.parseInt(call.getString("id"));
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            am.cancel(pending(id));
            call.resolve();
        } catch (Exception e) {
            call.reject("expire cancel failed");
        }
    }
}
`);
  console.log('Plugin TbExpire gravado em', dir);
}

/* Ícone das notificações: a gota oficial do TiaBete (máscara branca sobre transparente, como o Android exige).
   Os PNGs saem de assets/notification/ e a cor de destaque vem de capacitor.config.json (iconColor). */
(function notifIcon() {
  const res = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res'), src = path.join(__dirname, '..', 'assets', 'notification');
  if (!fs.existsSync(res) || !fs.existsSync(src)) { console.warn('Pasta res ou assets/notification não encontrada; ícone de notificação não instalado.'); return; }
  let n = 0;
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    const from = path.join(src, 'ic_stat_tiabete-' + d + '.png'); if (!fs.existsSync(from)) continue;
    const dir = path.join(res, 'drawable-' + d); fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(from, path.join(dir, 'ic_stat_tiabete.png')); n++;
  }
  console.log('Ícone de notificação (gota) instalado em', n, 'densidades.');
})();
