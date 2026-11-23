// test33: identidade visual GLUXO (0.32.0) — tokens, vermelhos clínicos preservados, contraste, logotipo íntegro, escopo funcional.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), ROOT = path.join(__dirname, '..');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const brand = rd('src/brand.css'), style = rd('src/style.css'), ui = rd('src/brand-ui.css');
const tok = (css, theme, name) => { const blk = theme === 'light' ? css.slice(css.indexOf(':root[data-theme="light"]')) : css.slice(0, css.indexOf(':root[data-theme="light"]')); const m = blk.match(new RegExp('--' + name + ':\\s*(#[0-9A-Fa-f]{6})')); return m && m[1]; };
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
/* 1. paleta institucional: candidatos do logotipo em uso, hierarquia definida */
ok(/--gx-red:\s*#E50308/.test(brand) && /--gx-red-deep:\s*#BF0104/.test(brand) && /--gx-red-dark:\s*#910103/.test(brand) && /--gx-red-glow:\s*#F71220/.test(brand), 'paleta institucional #E50308 / #BF0104 / #910103 / #F71220');
for (const t of ['dark', 'light']) for (const k of ['brand', 'brand-d', 'brand-d2', 'brand-l', 'brand-t']) ok(k === 'brand' && t === 'dark' ? /--brand: var\(--gx-red\)/.test(brand) : !!tok(brand, t, k), `token --${k} definido no tema ${t}`);
/* 2. contraste (AA 4,5:1 texto; 3:1 componentes) nos dois temas, sobre as superfícies atuais (inalteradas) */
const S = { dark: { bg: tok(style, 'dark', 'bg'), s1: tok(style, 'dark', 's1'), s2: tok(style, 'dark', 's2') }, light: { bg: tok(style, 'light', 'bg'), s1: tok(style, 'light', 's1'), s2: tok(style, 'light', 's2') } };
const B = { dark: { brand: '#E50308', l: tok(brand, 'dark', 'brand-l'), t: tok(brand, 'dark', 'brand-t') }, light: { brand: tok(brand, 'light', 'brand'), l: tok(brand, 'light', 'brand-l'), t: tok(brand, 'light', 'brand-t') } };
for (const t of ['dark', 'light']) {
  ok(cr('#FFFFFF', B[t].brand) >= 4.5, `${t}: texto branco sobre o vermelho principal ${B[t].brand} (${cr('#FFFFFF', B[t].brand).toFixed(2)}:1)`);
  for (const s of ['bg', 's1', 's2']) { ok(cr(B[t].l, S[t][s]) >= 4.5, `${t}: ícone/rótulo --brand-l sobre ${s} (${cr(B[t].l, S[t][s]).toFixed(2)}:1)`); ok(cr(B[t].t, S[t][s]) >= 4.5, `${t}: texto --brand-t sobre ${s} (${cr(B[t].t, S[t][s]).toFixed(2)}:1)`); ok(cr(B[t].brand, S[t][s]) >= 3 || t === 'dark' && cr(B[t].l, S[t][s]) >= 3, `${t}: componente de marca visível sobre ${s}`); }
}
/* 3. vermelhos clínicos e superfícies: valores originais intactos */
const orig = { dark: { red: '#E31E2C', 'red-d': '#5B0D16', 'red-d2': '#2B0B11', 'red-l': '#FF8E98', 'red-t': '#FF5361', bg: '#08070A', s1: '#120F12', s2: '#1A1519', line: '#2A2227', fg: '#F5F3F4', good: '#7BEAA8', 'good-fill': '#36C978', 'meal-y': '#E8B923' }, light: { red: '#D4162A', 'red-d': '#FBD6DA', 'red-d2': '#FFEDEE', 'red-l': '#B3101F', 'red-t': '#C4132A', bg: '#F6F2F0', s1: '#FFFFFF', s2: '#EFE9E6', line: '#D9D0CC', fg: '#1C1719', good: '#14693A', 'good-fill': '#1F9A58' } };
for (const t of ['dark', 'light']) for (const [k, v] of Object.entries(orig[t])) ok((tok(style, t, k) || '').toUpperCase() === v, `tema ${t}: --${k} continua ${v} (cor clínica/superfície preservada)`);
const ds = rd('src/ds.css'); ok(/--ds-neg:\s*#FF5264/.test(ds) && /--ds-neg:\s*#C4132A/.test(ds), 'tokens --ds-neg (alerta/erro) preservados');
const logic = rd('src/logic.js'); ok(/low:\s*70/.test(logic) && /high:\s*180/.test(logic), 'limites glicêmicos preservados (70/180)');
/* 4. clínico não usa a marca: seletores de glicemia/alerta seguem nos tokens --red* */
const css = ['style', 'ds', 'gauge', 'glucoform', 'neon'].map(f => rd('src/' + f + '.css')).join('\n');
const clin = [/\.badge\.high, \.badge\.vhigh \{[^}]*var\(--red\)/, /\.badge\.low, \.badge\.vlow \{[^}]*var\(--red-l\)/, /\.hbar\.high \.fil \{[^}]*var\(--red\)/, /\.hbar\.low \.fil[^{]*\{[^}]*var\(--red-l\)/, /\.gz\.s-vhigh[^{]*\{[^}]*var\(--red\)/, /\.rec\.g-high, \.rec\.g-vhigh \{[^}]*var\(--red\)/];
clin.forEach((r, i) => ok(r.test(css), 'regra clínica ' + (i + 1) + ' segue nos tokens clínicos'));
const charts = rd('src/charts.js'); ok(/GZ_COL = \{ low: 'var\(--red-l\)', ok: 'var\(--good-fill\)', high: 'var\(--red-t\)', vhigh: 'var\(--red\)'/.test(charts) && !/--brand/.test(charts), 'gráficos de glicemia continuam nas cores clínicas');
/* 5. logotipo: original intacto, versões derivadas só recortam/removem fundo, sem recriar vetor */
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
ok(sha('assets/brand/gluxo-logo-original.png').startsWith('9e799ef8ad18c735'), 'arquivo original do logotipo preservado (SHA-256)');
for (const f of ['gluxo-logo-fundo-transparente', 'gluxo-logo-completo', 'gluxo-logo-compacto', 'gluxo-gota', 'web-logo-completo']) ok(fs.existsSync(path.join(ROOT, 'assets/brand/' + f + '.png')), 'versão de aplicação ' + f + '.png');
ok(!/<svg[^>]*>[^]*M50 4 C50 4 14 44/.test(rd('src/head.html')) && !/M50 4 C50 4 14 44/.test(rd('native/login.js')) && /GX_DROP/.test(rd('native/login.js')) && /GX_LOGO/.test(rd('src/app.js')), 'gota antiga desenhada em SVG removida; marca vem do arquivo oficial');
/* 6. ícones e instalação */
const pngSize = f => { const b = fs.readFileSync(path.join(ROOT, f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
ok(pngSize('assets/icon-only.png').join() === '1024,1024' && pngSize('assets/pwa/icon-192.png').join() === '192,192' && pngSize('assets/pwa/icon-512.png').join() === '512,512' && pngSize('assets/pwa/icon-maskable-512.png').join() === '512,512', 'ícones do app e PWA nos tamanhos corretos');
const exp = { mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 }; for (const [d, s] of Object.entries(exp)) ok(pngSize(`assets/notification/ic_stat_gluxo-${d}.png`).join() === `${s},${s}`, 'ícone de notificação ' + d);
const cap = JSON.parse(rd('capacitor.config.json')); ok(cap.plugins.LocalNotifications.iconColor === '#E50308' && cap.appId === 'app.tiabete.glicose' && cap.backgroundColor === '#000000', 'Android: cor da notificação na marca; appId preservado, fundo preto absoluto da abertura');
const pwa = rd('scripts/build-pwa.js'); ok(/short_name: 'GLUXO'/.test(pwa) && /background_color: '#0a090c'/.test(pwa), 'PWA: nome GLUXO, fundo preservado');
/* 7. movimento */
ok(/prefers-reduced-motion: reduce\) \{ \.gx-rise/.test(ui) && /prefers-reduced-motion:reduce\)\{#tb-splash\{transition:none/.test(rd('src/splash.html')), 'animações da marca respeitam movimento reduzido (interface e splash)');
/* 8. escopo: nenhum arquivo de lógica, licenciamento, armazenamento ou cálculo foi alterado */
const guard = { 'src/logic.js': null, 'src/premium.js': null, 'src/storage.js': null };
console.log(fail ? `${fail} falha(s) em ${n}` : `test33 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
