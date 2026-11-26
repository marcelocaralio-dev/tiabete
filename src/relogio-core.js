/* GLUXO · relógio analógico: lógica pura do seletor de horário (sem DOM). Formato de armazenamento inalterado: "HH:MM" em 24 horas. */
const ckP2 = n => String(n).padStart(2, '0');
function ckFmt(h, m) { return ckP2(h) + ':' + ckP2(m); }
/* "HH:MM" (ou "HH:MM:SS") estrito -> {h,m}; inválido -> null */
function ckParse(s) { const x = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(String(s == null ? '' : s).trim()); if (!x) return null; const h = +x[1], m = +x[2]; return h <= 23 && m <= 59 ? { h, m } : null; }
/* digitação livre: "0813", "813", "8:13", "8.13", "8h13", "8" -> {h,m}; inválido -> null */
function ckTyped(s) {
  const t = String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ''); let h, m;
  let x = /^(\d{1,2})[:.h,](\d{1,2})$/.exec(t); if (x) { h = +x[1]; m = +x[2]; if (x[2].length === 1) return null; }
  else if ((x = /^(\d{1,2})h?$/.exec(t))) { h = +x[1]; m = 0; }
  else if ((x = /^(\d{3,4})$/.exec(t))) { const d = x[1].padStart(4, '0'); h = +d.slice(0, 2); m = +d.slice(2); }
  else return null;
  return h <= 23 && m <= 59 ? { h, m } : null;
}
const ckTo12 = h => (h % 12) || 12;                    /* 0→12, 13→1 */
const ckTo24 = (h12, pm) => (h12 % 12) + (pm ? 12 : 0); /* 12 AM→0, 12 PM→12 */
/* ângulo (graus, horário, 0 = topo) do ponto (x,y) em relação ao centro */
function ckAngle(x, y, cx, cy) { let a = Math.atan2(x - cx, cy - y) * 180 / Math.PI; return (a + 360) % 360; }
const ckHourFromAngle = a => Math.round(a / 30) % 12 || 12;
const ckMinFromAngle = a => Math.round(a / 6) % 60;
const ckAngleHour = h12 => (h12 % 12) * 30;
const ckAngleMin = m => m * 6;
/* teclado: soma delta ao valor da etapa; horas rodam 1–12, minutos 0–59 */
function ckStep(mode, v, d) { return mode === 'h' ? (((v - 1 + d) % 12) + 12) % 12 + 1 : (((v + d) % 60) + 60) % 60; }
if (typeof module !== 'undefined') module.exports = { ckFmt, ckParse, ckTyped, ckTo12, ckTo24, ckAngle, ckHourFromAngle, ckMinFromAngle, ckAngleHour, ckAngleMin, ckStep };
