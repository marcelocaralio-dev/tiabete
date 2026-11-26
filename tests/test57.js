// test57: relógio analógico — lógica pura (src/relogio-core.js)
const C = require('../src/relogio-core.js'); let n = 0, f = 0; const ok = (c, m) => { n++; if (!c) { f++; console.log('FALHOU:', m); } };
ok(C.ckFmt(0, 0) === '00:00' && C.ckFmt(23, 59) === '23:59' && C.ckFmt(8, 13) === '08:13', 'formato HH:MM');
ok(JSON.stringify(C.ckParse('08:13')) === '{"h":8,"m":13}' && C.ckParse('24:00') === null && C.ckParse('12:60') === null && C.ckParse('') === null && C.ckParse('23:59:30').h === 23, 'parse estrito');
for (let h = 0; h < 24; h++) ok(C.ckTo24(C.ckTo12(h), h >= 12) === h, 'ida e volta 12h/24h em ' + h);
ok(C.ckTo12(0) === 12 && C.ckTo12(12) === 12 && C.ckTo12(13) === 1 && C.ckTo24(12, false) === 0 && C.ckTo24(12, true) === 12, '00:00 e 12:00 corretos');
for (let h = 1; h <= 12; h++) ok(C.ckHourFromAngle(C.ckAngleHour(h)) === h, 'ângulo da hora ' + h);
for (let m = 0; m < 60; m++) ok(C.ckMinFromAngle(C.ckAngleMin(m)) === m, 'ângulo do minuto ' + m);
ok(Math.round(C.ckAngle(110, 100, 100, 100)) === 90 && Math.round(C.ckAngle(100, 110, 100, 100)) === 180 && Math.round(C.ckAngle(90, 100, 100, 100)) === 270, 'ângulos cardeais');
ok(C.ckMinFromAngle(359) === 0 && C.ckHourFromAngle(359) === 12, 'virada do relógio');
ok(JSON.stringify(['0813', '813', '8:13', '8.13', '8h13', '23:59', '0000', '8', '2400', '12:60', 'abc', '8:1'].map(x => { const p = C.ckTyped(x); return p ? C.ckFmt(p.h, p.m) : null; })) === JSON.stringify(['08:13', '08:13', '08:13', '08:13', '08:13', '23:59', '00:00', '08:00', null, null, null, null]), 'digitação livre');
ok(C.ckStep('h', 12, 1) === 1 && C.ckStep('h', 1, -1) === 12 && C.ckStep('m', 59, 1) === 0 && C.ckStep('m', 0, -1) === 59 && C.ckStep('m', 58, 5) === 3, 'teclado dá a volta');
console.log(`test57: ${n - f}/${n} ok`); process.exit(f ? 1 : 0);
