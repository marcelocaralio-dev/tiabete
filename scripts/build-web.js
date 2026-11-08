// Monta www/index.html (um único arquivo) a partir de src/ + native/native.js, com fontes locais (@fontsource).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), rd = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const order = ['src/logic.js', 'src/xlsx.js', 'src/charts.js', 'src/app.js', 'src/report.js', 'src/exams.js', 'src/extras.js', 'src/bolus.js', 'native/native.js', 'src/init.js'];
const js = 'window.TB_PUBLIC = true;\n' + order.map(f => rd(f)).join('\n');
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
fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0a090c"></head><body>' + body + '</body></html>');
console.log('www/index.html', Math.round(fs.statSync(path.join(out, 'index.html')).size / 1024) + ' KB');
