// Ajustes no projeto Android gerado pelo Capacitor: permissão de notificações e sem backup automático do Google (dados de saúde).
const fs = require('fs'), path = require('path');
const f = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(f)) { console.error('AndroidManifest.xml não encontrado. Rode "npx cap add android" antes.'); process.exit(1); }
let x = fs.readFileSync(f, 'utf8');
const perms = ['android.permission.POST_NOTIFICATIONS', 'android.permission.RECEIVE_BOOT_COMPLETED', 'android.permission.SCHEDULE_EXACT_ALARM', 'android.permission.USE_BIOMETRIC'];
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
    if (pk) { writeExpire(path.dirname(f), pk); writeBiometric(path.dirname(f), pk); } else console.warn('Pacote do MainActivity não encontrado; expiração de notificações não instalada.');
    j = j.replace(/extends\s+BridgeActivity\s*\{\s*\}/, 'extends BridgeActivity {\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(TbExpirePlugin.class);\n        registerPlugin(TbBiometricPlugin.class);\n        super.onCreate(savedInstanceState);\n        getBridge().getWebView().getSettings().setTextZoom(100);\n        getBridge().getWebView().getSettings().setUseWideViewPort(true);\n        getBridge().getWebView().getSettings().setLoadWithOverviewMode(true);\n    }\n}');
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


/* Biometria nativa: AndroidX Biometric (BiometricPrompt). Digital e rosto pelo sistema; o WebView não oferece WebAuthn. */
(function bioGradle() {
  const g = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
  if (!fs.existsSync(g)) return;
  let t = fs.readFileSync(g, 'utf8');
  if (t.includes('androidx.biometric:biometric')) { console.log('Dependência biometric já presente.'); return; }
  if (!/dependencies\s*\{/.test(t)) { console.warn('Bloco dependencies não achado no build.gradle; biometria nativa sem dependência!'); return; }
  t = t.replace(/dependencies\s*\{/, 'dependencies {\n    implementation "androidx.biometric:biometric:1.1.0"');
  fs.writeFileSync(g, t); console.log('Dependência androidx.biometric:biometric:1.1.0 adicionada.');
})();
function writeBiometric(dir, pk) {
  fs.writeFileSync(path.join(dir, 'TbBiometricPlugin.java'), `package ${pk};

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TbBiometric")
public class TbBiometricPlugin extends Plugin {
    private static final int WEAK = BiometricManager.Authenticators.BIOMETRIC_WEAK;
    private static final int STRONG = BiometricManager.Authenticators.BIOMETRIC_STRONG;
    private BiometricPrompt prompt;

    private String codeOf(int r) {
        switch (r) {
            case 0: return "ok";
            case 12: return "none_hardware";
            case 1: return "hw_unavailable";
            case 11: return "none_enrolled";
            case 15: return "security_update";
            case -2: return "unsupported";
            default: return "unknown";
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        try {
            Context c = getContext();
            BiometricManager bm = BiometricManager.from(c);
            int rw = bm.canAuthenticate(WEAK), rs = bm.canAuthenticate(STRONG);
            boolean ok = rw == 0 || rs == 0;
            PackageManager pm = c.getPackageManager();
            KeyguardManager km = (KeyguardManager) c.getSystemService(Context.KEYGUARD_SERVICE);
            JSObject o = new JSObject();
            o.put("available", ok);
            o.put("strong", rs == 0);
            o.put("code", ok ? "ok" : codeOf(rw != 0 ? rw : rs));
            o.put("fingerprint", pm.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT));
            o.put("face", pm.hasSystemFeature("android.hardware.biometrics.face"));
            o.put("iris", pm.hasSystemFeature("android.hardware.biometrics.iris"));
            o.put("deviceSecure", km != null && km.isDeviceSecure());
            call.resolve(o);
        } catch (Exception e) {
            call.reject("status failed", "unknown");
        }
    }

    @PluginMethod
    public void authenticate(final PluginCall call) {
        if (getActivity() == null || !(getActivity() instanceof FragmentActivity)) { call.reject("Sem atividade", "unavailable"); return; }
        final FragmentActivity act = (FragmentActivity) getActivity();
        final String title = call.getString("title", "TiaBete");
        final String sub = call.getString("subtitle", "");
        final String neg = call.getString("negative", "Usar PIN");
        act.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    BiometricManager bm = BiometricManager.from(act);
                    int rw = bm.canAuthenticate(WEAK);
                    if (rw != 0 && bm.canAuthenticate(STRONG) != 0) { call.reject("Biometria indisponível", codeOf(rw)); return; }
                    BiometricPrompt.PromptInfo.Builder b = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title).setNegativeButtonText(neg).setAllowedAuthenticators(WEAK).setConfirmationRequired(false);
                    if (sub != null && sub.length() > 0) b.setSubtitle(sub);
                    prompt = new BiometricPrompt(act, ContextCompat.getMainExecutor(act), new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                            JSObject o = new JSObject(); o.put("ok", true); call.resolve(o);
                        }
                        @Override
                        public void onAuthenticationError(int code, CharSequence msg) {
                            String k;
                            switch (code) {
                                case 10: case 13: case 5: k = "user_cancel"; break;
                                case 7: k = "lockout"; break;
                                case 9: k = "lockout_permanent"; break;
                                case 3: k = "timeout"; break;
                                case 11: k = "none_enrolled"; break;
                                case 12: k = "none_hardware"; break;
                                case 1: k = "hw_unavailable"; break;
                                default: k = "unavailable";
                            }
                            call.reject(String.valueOf(msg), k);
                        }
                        @Override
                        public void onAuthenticationFailed() { /* digital ou rosto não reconhecidos: o Android mantém o diálogo aberto */ }
                    });
                    prompt.authenticate(b.build());
                } catch (Exception e) {
                    call.reject("Falha ao abrir a biometria", "unavailable");
                }
            }
        });
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= 30) { i = new Intent(Settings.ACTION_BIOMETRIC_ENROLL); i.putExtra(Settings.EXTRA_BIOMETRIC_AUTHENTICATORS_ALLOWED, WEAK); }
            else if (Build.VERSION.SDK_INT >= 28) i = new Intent(Settings.ACTION_FINGERPRINT_ENROLL);
            else i = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { getContext().startActivity(i); }
            catch (Exception e) { Intent j = new Intent(Settings.ACTION_SECURITY_SETTINGS); j.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(j); }
            call.resolve();
        } catch (Exception e) {
            call.reject("Não foi possível abrir as configurações", "unavailable");
        }
    }
}
`);
  console.log('Plugin TbBiometric gravado em', dir);
}
