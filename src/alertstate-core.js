/* ================= Alertas · núcleo de ocorrências, estados e vínculo com o histórico (sem DOM, testável em Node) =================
   Uma ocorrência é "este aviso, neste dia, neste horário, para esta insulina/medicamento". Ela tem identidade própria (id com prefixo da fonte:
   "ir:AAAA-MM-DD|idLembrete@HH:MM" nos lembretes de insulina e "pl:AAAA-MM-DD|idItem@HH:MM" nos alarmes do tratamento). O nome do medicamento
   sozinho nunca identifica nada: duas aplicações do mesmo remédio no mesmo dia são ocorrências diferentes.

   Fonte única de verdade:
   · A DOSE aplicada vive só no histórico de insulinas (S.inslog). Registrar pela tela Meu tratamento, pela bolha, pela notificação do Android
     ou pelo histórico é a mesma ação lógica. Quem decide se uma ocorrência está resolvida é ocMatchLogs (abaixo), olhando o histórico: não há
     "cópia" do fato em cada tela.
   · O ESTADO explícito (concluído, ignorado, adiado) vive junto da fonte do aviso (S.ir.state, S.planDone) e é persistido.
   · A bolha só apresenta e responde: o estado de cada item dela é sempre calculado por um resolvedor a partir dessas duas fontes. */

const OC_STATES = { programado: 'Programado', pendente: 'Pendente', exibido: 'Exibido', concluido: 'Concluído', ignorado: 'Ignorado', cancelado: 'Cancelado', desativado: 'Desativado', expirado: 'Expirado' };
const OC_FINAL = new Set(['concluido', 'ignorado', 'cancelado', 'desativado', 'expirado']);
/* transições permitidas entre estados não finais; qualquer estado não final pode ir para um final; um final não sai dele */
const OC_NEXT = { programado: ['pendente', 'exibido'], pendente: ['exibido', 'programado'], exibido: ['pendente', 'programado'] };
const OC_BEFORE_MIN = 240; /* um registro de até 4 h ANTES do horário já conta para aquela ocorrência */

function ocCan(from, to) {
  if (!OC_STATES[to] || !OC_STATES[from]) return false;
  if (from === to) return true;
  if (OC_FINAL.has(from)) return false;
  if (OC_FINAL.has(to)) return true;
  return (OC_NEXT[from] || []).includes(to);
}
/* Move o item de estado. Devolve true se o item ficou em "to". Um estado final nunca volta (concluído não vira pendente, cancelado não reaparece).
   Única exceção, explícita: o usuário APAGOU ou EDITOU o registro que concluía o aviso (why = 'registro' → why 'desfeito'): o aviso volta a pendente. */
function ocMove(it, to, why) {
  const from = it.st || 'pendente';
  if (from === to) { if (why && !it.why) it.why = why; return true; }
  if (from === 'concluido' && to === 'pendente' && it.why === 'registro' && why === 'desfeito') { it.st = 'pendente'; it.why = ''; return true; }
  if (!ocCan(from, to)) return false;
  it.st = to; it.why = why || ''; return true;
}
const ocIsFinal = st => OC_FINAL.has(st);

/* Para qual tipo de registro do histórico uma dose agendada conta: basal, rápida da refeição (fast/lunch/dinner) ou outra insulina (extra). */
function ocDoseKind(role, name, time) {
  const t = typeof irRoleType === 'function' ? irRoleType(role) : (role === 'basal' ? 'basal' : role === 'rapida' ? 'rapida' : '');
  if (t === 'basal') return 'basal';
  if (t === 'rapida') return { cafe: 'fast', almoco: 'lunch', jantar: 'dinner' }[irMealGuess(name, time)] || 'extra';
  return 'extra';
}
const OC_MEAL_KIND = { fast: 1, lunch: 1, dinner: 1 };
const ocNameEq = (a, b) => { a = String(a || '').trim().toLowerCase(); b = String(b || '').trim().toLowerCase(); return !a || !b || a === b || a.includes(b) || b.includes(a); };

/* Liga ocorrências a registros do histórico. occs: [{ key, day, at, kind, name }]. logs: S.inslog. afterMs: até quando depois do horário um registro conta.
   Devolve { [key]: registro }.
   1) vínculo explícito (registro.occ === key): sempre vale;
   2) refeição (fast/lunch/dinner): qualquer registro daquele tipo no mesmo dia (o app guarda uma aplicação por refeição por dia);
   3) basal/outra: o registro mais próximo do horário, dentro de [horário − 4 h, horário + afterMs], sem usar o mesmo registro em duas ocorrências. */
function ocMatchLogs(occs, logs, afterMs) {
  const out = {}, used = new Set(), after = afterMs == null ? 180 * 60000 : afterMs;
  logs = (logs || []).filter(l => l && typeof l.ts === 'number' && l.kind);
  const byOcc = new Map(); for (const l of logs) if (l.occ) byOcc.set(l.occ, l);
  for (const o of occs) { const l = byOcc.get(o.key); if (l) { out[o.key] = l; used.add(l.id); } }
  const pairs = [];
  for (const o of occs) {
    if (out[o.key]) continue;
    if (OC_MEAL_KIND[o.kind]) { const c = logs.filter(l => l.kind === o.kind && l.date === o.day); if (c.length) out[o.key] = c[c.length - 1]; continue; }
    for (const l of logs) {
      if (l.kind !== o.kind || l.occ || used.has(l.id) || !ocNameEq(o.kind === 'extra' ? o.name : '', o.kind === 'extra' ? l.name : '')) continue;
      if (l.ts < o.at - OC_BEFORE_MIN * 60000 || l.ts > o.at + after) continue;
      pairs.push({ o, l, d: Math.abs(l.ts - o.at) });
    }
  }
  pairs.sort((a, b) => a.d - b.d || a.o.at - b.o.at || a.l.ts - b.l.ts);
  for (const p of pairs) { if (out[p.o.key] || used.has(p.l.id)) continue; out[p.o.key] = p.l; used.add(p.l.id); }
  return out;
}
/* "ir:AAAA-MM-DD|id@HH:MM" / "pl:AAAA-MM-DD|id@HH:MM" -> { src, day, id, time } */
function ocParse(occ) {
  const m = /^(ir|pl|ca):(\d{4}-\d\d-\d\d)\|([^@]+?)(?:@(\d\d:\d\d))?$/.exec(String(occ || '')); return m ? { src: m[1], day: m[2], id: m[3], time: m[4] || '' } : null;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { OC_STATES, OC_FINAL, OC_NEXT, OC_BEFORE_MIN, ocCan, ocMove, ocIsFinal, ocDoseKind, ocMatchLogs, ocParse };
