/* ================= Indicador geral de controle · iluminação ambiente do Painel =================
   O fundo da tela inicial recebe um brilho discreto (neon.css) conforme o estado calculado aqui:
   ok (verde) · warn (âmbar) · bad (vermelho) · none (cinza = sem iluminação).
   Este módulo só escolhe o estado; não mexe em layout, textos, dados nem em outras classificações.

   Regras (todas nas constantes AMB, para revisão com a equipe de saúde):
   · Usa só medições reais dos últimos 14 dias (registros de exemplo ficam de fora).
   · Cada medição é enquadrada pela função bandOf() do app, que já respeita a faixa de jejum.
   · O app só importa medições pontuais (glicosímetro, tira, leitura do sensor); as leituras contínuas do
     sensor são descartadas na importação. Por isso o indicador é a PROPORÇÃO DE REGISTROS dentro e fora
     da faixa, nunca "tempo na faixa". Se um dia houver CGM completo, defina window.TB_CONTROL_STATE
     (função que recebe os registros e devolve 'ok' | 'warn' | 'bad' | 'none') e ela passa a mandar.
   · Nunca usa só a média. Combina: % dentro da faixa, % abaixo de 70, variabilidade (CV) e quantidade de dados.
   · Dados mínimos: 20 medições em 5 dias diferentes; abaixo disso o estado é "none" (cinza).
   · Uma medição isolada não troca o estado: com 20 ou mais medições ela move cada percentual em até 5 pontos,
     e para SAIR do estado atual é preciso passar do limite com folga de 5 pontos (histerese).

   Metas de "ok" seguem o consenso internacional de metas glicêmicas (Battelino et al., 2019): ≥ 70 % na faixa,
   < 4 % abaixo de 70 e CV ≤ 36 %. Os limites de "bad" (< 50 % na faixa ou ≥ 8 % abaixo de 70) são escolha
   deste projeto e precisam de validação clínica antes de qualquer uso além de efeito visual. */
const AMB = {
  days: 14, minN: 20, minDays: 5, hyst: 5,
  okIn: 70, okLow: 4, okCv: 36,
  badIn: 50, badLow: 8
};

function ambMetrics(records, now) {
  const from = now - AMB.days * 864e5;
  const w = (records || []).filter(r => r && r.source !== 'exemplo' && r.example !== true && typeof r.glucose === 'number' && typeof r.ts === 'number' && r.ts >= from && r.ts <= now);
  const n = w.length, days = new Set(w.map(r => r.date)).size;
  if (!n) return { n, days, inP: null, lowP: null, hiP: null, cv: null };
  let inR = 0, low = 0, hi = 0;
  w.forEach(r => { const k = bandOf(r.glucose, r.context).k; if (k === 'ok') inR++; else if (k === 'low' || k === 'vlow') low++; else hi++; });
  const st = stats(w), cv = st.sd != null && st.mean > 0 ? st.sd / st.mean * 100 : null;
  return { n, days, inP: inR / n * 100, lowP: low / n * 100, hiP: hi / n * 100, cv };
}

/* prev = estado anterior; ele ganha uma folga (AMB.hyst) para continuar valendo. */
function ambClassify(records, now, prev) {
  const m = ambMetrics(records, now);
  if (m.n < AMB.minN || m.days < AMB.minDays) return { state: 'none', ...m };
  const sl = k => prev === k ? AMB.hyst : 0;
  let state;
  if (m.inP < AMB.badIn + sl('bad') || m.lowP >= AMB.badLow - sl('bad')) state = 'bad';
  else if (m.inP >= AMB.okIn - sl('ok') && m.lowP < AMB.okLow + sl('ok') && (m.cv == null || m.cv <= AMB.okCv + sl('ok'))) state = 'ok';
  else state = 'warn';
  return { state, ...m };
}

let ambPrev = 'none';
try { const v = localStorage.getItem('tb-amb'); if (['ok', 'warn', 'bad'].includes(v)) ambPrev = v; } catch (e) { }
function ambState() {
  let st;
  if (typeof window !== 'undefined' && typeof window.TB_CONTROL_STATE === 'function') st = window.TB_CONTROL_STATE(S.records);
  else {
    /* Premium vitalício: considera TIR, TBR, TAR, DP e CV (metricas.js). Gratuito/sem licença: devolve null e vale a lógica abaixo, sem mudança. */
    let pm = null; try { if (typeof mtAmbientState === 'function') pm = mtAmbientState(S.records, Date.now(), ambPrev); } catch (e) { pm = null; }
    st = pm || ambClassify(S.records, Date.now(), ambPrev).state;
  }
  if (!['ok', 'warn', 'bad'].includes(st)) st = 'none';
  if (st !== ambPrev) { ambPrev = st; try { localStorage.setItem('tb-amb', st); } catch (e) { } }
  return st;
}
/* Chamado ao fim de render(): só a tela inicial tem iluminação; nas demais o brilho some com transição suave. */
function ambSync() {
  let st = 'none';
  try { if (S.route === 'painel' && S.records && S.records.length) st = ambState(); } catch (e) { }
  const el = document.documentElement;
  if (el.getAttribute('data-amb') !== st) el.setAttribute('data-amb', st);
}
if (typeof module !== 'undefined' && module.exports) module.exports = { AMB, ambMetrics, ambClassify };
