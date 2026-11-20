// test25: classes de faixa (.b-*) não podem pintar cartões do Início; só as barras <i> das Métricas.
const fs = require('fs'), path = require('path'); let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
for (const f of fs.readdirSync(path.join(__dirname, '..', 'src')).filter(x => x.endsWith('.css'))) {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/(^|[};\n])\s*\.b-(vlow|low1|ok|high1|vhigh)\b[^{]*\{/.test(css), f + ': seletor .b-* solto pintaria cartões do Início');
}
const mc = fs.readFileSync(path.join(__dirname, '..', 'src', 'metricas.css'), 'utf8');
ok(/i\.b-ok \{ background: var\(--mt-ok\)/.test(mc) && !/(^|\n)\.b-ok \{/.test(mc), 'metricas.css: .b-ok restrito às barras <i>');
console.log(fail ? 'test25 FALHOU (' + fail + ')' : 'test25 ok (' + n + ' verificações)'); process.exit(fail ? 1 : 0);
