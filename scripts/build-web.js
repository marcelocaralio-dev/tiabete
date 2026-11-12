// Monta www/index.html (um único arquivo) a partir de src/ + native/native.js, com fontes locais (@fontsource).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), rd = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const order = ['native/ai-core.js', 'src/logic.js', 'src/xlsx.js', 'src/charts.js', 'src/app.js', 'src/report.js', 'src/exams.js', 'src/extras.js', 'src/bolus.js', 'src/plan.js', 'src/alertas.js', 'src/drawer.js', 'src/secure.js', 'native/native.js', 'native/ai-ui.js', 'native/drive.js', 'native/login.js', 'src/init.js'];
/* ID do cliente Google (OAuth) para o backup no Drive: arquivo config/google-client-id.txt (não é segredo). Se não existir, o app pede para colar na tela. */
let gid = ''; try { gid = rd('config', 'google-client-id.txt').trim().split(/\s+/)[0] || ''; } catch (e) { }
/* Textos do app web que citam o Claude viram textos neutros: no APK a IA é a que o usuário configurar. */
const APK_TEXT = [
  [/Perguntar ao Claude/g, 'Perguntar à IA'], [/Pergunte ao Claude/g, 'Pergunte à IA'],
  [/ao Claude da sua conta/g, 'ao provedor de IA que você configurou (Mais → Inteligência artificial)'],
  [/Leitura comparativa do Claude/g, 'Leitura comparativa da IA'],
  [/ao Claude/g, 'à IA'], [/do Claude/g, 'da IA'], [/pelo Claude/g, 'pela IA'], [/O Claude/g, 'A IA'], [/o Claude/g, 'a IA'],
  [/<h2 class="sec">Versão web<\/h2><div class="card"><p class="hint" style="margin:0">[^<]*<\/p><\/div>/, '<h2 class="sec">Aplicativo Android</h2><div class="card"><p class="hint" style="margin:0">Aplicativo instalável do TiaBete. Os dados ficam só neste aparelho (banco local). Recursos opcionais: IA com a sua própria chave (Mais → Inteligência artificial) e backup no seu Google Drive (Mais → Backup e dados). Ambos só enviam dados quando você pede.</p></div>'],
];
let js = order.map(f => rd(f)).join('\n');
for (const [a, b] of APK_TEXT) js = js.replace(a, b);
/* Data/hora da compilação (horário de Brasília) para a tela Sobre */
const BR = new Date(Date.now() - 3 * 3600e3), p2 = n => String(n).padStart(2, '0');
js = js.replace('__BUILD_DATE__', `${p2(BR.getUTCDate())}/${p2(BR.getUTCMonth() + 1)}/${BR.getUTCFullYear()} ${p2(BR.getUTCHours())}:${p2(BR.getUTCMinutes())}`);
js = 'window.TB_PUBLIC = true;\nwindow.TB_GOOGLE_CLIENT_ID = ' + JSON.stringify(gid) + ';\n' + js;
const fonts = [['unbounded', 'Unbounded', [500, 700]], ['manrope', 'Manrope', [400, 500, 600, 700, 800]], ['jetbrains-mono', 'JetBrains Mono', [400, 500]]];
const out = path.join(root, 'www'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
let css = '', missing = 0;
for (const [pkg, fam, ws] of fonts) for (const w of ws) {
  const f = `${pkg}-latin-${w}-normal.woff2`, src = path.join(root, 'node_modules', '@fontsource', pkg, 'files', f);
  if (!fs.existsSync(src)) { missing++; continue; }
  fs.copyFileSync(src, path.join(out, 'fonts', f));
  css += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url('fonts/${f}') format('woff2')}\n`;
}
if (missing) console.warn(`Aviso: ${missing} arquivo(s) de fonte não encontrados (rode "npm install"). O app usará fontes do sistema.`);
const body = rd('src/head.html').replace('{{FONTS}}', () => css).replace('{{CSS}}', () => rd('src/style.css')).replace('{{JS}}', () => js);
/* Escala de interface: no Claude o app é desenhado numa largura virtual maior e reduzido para caber. Aqui o mesmo efeito vem do CSS "zoom".
   Ajuste K: valores maiores deixam tudo menor (1 = tamanho nativo do Android). */
const K = 1.29;
const SCALE = `<style>html{zoom:${(1 / K).toFixed(4)}}</style>`;
fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' + SCALE + '<meta name="theme-color" content="#0a090c"></head><body>' + body + '</body></html>');
console.log('www/index.html', Math.round(fs.statSync(path.join(out, 'index.html')).size / 1024) + ' KB');
