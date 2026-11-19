// Indicador geral de controle (iluminação ambiente): dados mínimos, estados e histerese.
const L = require('../src/logic.js'), vm = require('vm'), fs = require('fs');
const ctx = vm.createContext({ ...L, module: { exports: {} }, localStorage: undefined, console });
vm.runInContext(fs.readFileSync(__dirname + '/../src/ambient.js', 'utf8'), ctx);
const { ambClassify, AMB } = ctx.module.exports;
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FALHOU:', m); } };
const NOW = Date.UTC(2026, 10, 14, 15), DAY = 864e5;
function mk(n, pIn, pLow, days = 10) {
  const r = []; let s = 3; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let i = 0; i < n; i++) { const x = rnd(), g = x < pLow ? 55 : x < pLow + pIn ? 110 : 230, ts = NOW - (i % days) * DAY - i * 6e4; r.push({ id: i, glucose: g, ts, date: new Date(ts).toISOString().slice(0, 10), context: 'antes', source: 'mysugr' }); }
  return r;
}
const st = (recs, prev) => ambClassify(recs, NOW, prev).state;
ok(st(mk(19, .9, 0)) === 'none', '19 medições = cinza');
ok(st(mk(40, .9, 0, 4)) === 'none', '4 dias = cinza');
ok(st(mk(40, .9, 0)) === 'ok', 'bom controle = ok');
ok(st(mk(40, .6, .02)) === 'warn', 'intermediário = warn');
ok(st(mk(40, .3, .1)) === 'bad', 'ruim = bad');
ok(st(mk(40, .9, 0).map(r => ({ ...r, source: 'exemplo' }))) === 'none', 'exemplos não contam');
ok(st(mk(40, .9, 0).map(r => ({ ...r, ts: r.ts - 30 * DAY }))) === 'none', 'fora da janela de 14 dias = cinza');
// média boa não basta: metade 60 e metade 300 tem média ~180 mas péssima variabilidade/faixa
const bi = mk(40, 0, 0).map((r, i) => ({ ...r, glucose: i % 2 ? 60 : 300 })); ok(st(bi) === 'bad', 'não classifica só pela média');
// uma medição isolada não troca o estado (histerese)
const base = mk(40, .82, 0).map(r => r.glucose === 230 ? { ...r, glucose: 190 } : r); let a = ambClassify(base, NOW, 'none').state;
const one = base.slice(); one[0] = { ...one[0], glucose: 190 }; one[1] = { ...one[1], glucose: 190 };
ok(a === 'ok', 'base ok'); ok(st(one, 'ok') === 'ok', 'duas medições não derrubam ok com folga');
console.log(fail ? fail + ' falha(s)' : 'test7 ok'); process.exit(fail ? 1 : 0);
