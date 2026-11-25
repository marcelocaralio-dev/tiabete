/* ================= Saudação animada ao registrar uma glicemia (Prompt 57) =================
   Depois que uma NOVA medição é salva com sucesso, aparece por ~2,8 s uma saudação curta no centro da tela, em uma camada temporária
   sobre a interface: fundo 100% transparente (sem escurecer, sem desfocar), sem botão, sem capturar toque e sem mexer no layout.
   · Elemento central: a gota oficial do GLUXO (a mesma imagem de brand-assets.js em todas as versões; só mudam movimento e efeitos).
   · Linguagem visual: a mesma das conquistas (extras.js / style.css): medalha com halo, anéis que se expandem (rw-ring), pop com mola (rw-pop),
     quique (rw-bounce), brilho que atravessa (rw-shine), selo que entra girando (rw-crown), confete (rwFx) e a fonte de títulos.
   · Três apresentações: abaixo da faixa = atenção e cuidado (batimento calmo, anéis suaves, pontos que sobem); dentro da faixa = reconhecimento
     (quique, brilho, selo ✓, confete verde); acima da faixa = orientação (a gota "pousa" e forma ondas calmas, sem alarme).
   · Classificação: a faixa que a pessoa configurou em Metas e referências (mtGoals(MT_CFG), padrão 70–180). Nenhum limite novo é criado.
     abaixo = menor que o limite inferior · dentro = do inferior ao superior (inclusive) · acima = maior que o superior.
   · Frases: sorteadas só do grupo da própria classificação; nunca repete a mesma frase do registro anterior (também entre grupos).
   · Registros em sequência: só existe uma saudação por vez; a nova substitui a anterior na hora, sem acumular nem sobrepor.
   · Só visual: não lê nem grava dado de saúde, não altera cálculo, alerta, notificação ou protocolo. Uma falha aqui nunca atrapalha o salvamento. */
(function () {
  const POOLS = {
    low: ['Vamos cuidar disso!', 'Atenção à glicemia.', 'Precisamos cuidar disso.', 'Vamos acompanhar de perto.'],
    ok: ['Bom trabalho!', 'Glicemia na faixa!', 'Excelente resultado!', 'Continue assim!', 'Muito bem!'],
    high: ['Vamos melhorar isso!', 'Precisamos cuidar disso.', 'Vamos acompanhar de perto.', 'Atenção à glicemia.', 'Seguimos trabalhando!']
  };
  const LBL = { low: 'Abaixo da faixa', ok: 'Dentro da faixa', high: 'Acima da faixa' };
  const SYM = { low: '▼', ok: '✓', high: '▲' };
  const SHOW_MS = 2800, OUT_MS = 520, KEY = 'gx-greet-last';
  let cur = null, lastText = '';
  try { lastText = String(localStorage.getItem(KEY) || ''); } catch (e) { }

  /* faixa configurada pelo usuário; sem ela (não deveria acontecer), usa a mesma classificação do restante do app */
  function band(v) {
    if (typeof v !== 'number' || !isFinite(v)) return null;
    try {
      if (typeof mtGoals === 'function' && typeof MT_CFG !== 'undefined') { const g = mtGoals(MT_CFG); if (g && isFinite(g.low) && isFinite(g.high)) return v < g.low ? 'low' : v <= g.high ? 'ok' : 'high'; }
    } catch (e) { }
    const k = bandOf(v).k; return k === 'vlow' || k === 'low' ? 'low' : k === 'ok' ? 'ok' : 'high';
  }
  function pick(k) {
    const pool = POOLS[k]; if (!pool) return '';
    const cand = pool.filter(t => t !== lastText), src = cand.length ? cand : pool;
    const t = src[Math.floor(Math.random() * src.length)];
    lastText = t; try { localStorage.setItem(KEY, t); } catch (e) { }
    return t;
  }
  const rm = el => { try { if (el && el.parentNode) el.parentNode.removeChild(el); } catch (e) { } };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const SOFT = ['#FFB9BF', '#FFA9B0', '#F4C6CB', '#FF9AA3'];
  function fx(box, k) {
    if (k === 'ok') { if (typeof rwFx === 'function') rwFx(box, 'confetti', 24); return; }   /* o mesmo confete verde das conquistas */
    if (k === 'low') for (let i = 0; i < 9; i++) { const d = document.createElement('i'); d.className = 'rw-p gx-rise'; d.style.cssText = `--x:${rnd(26, 74).toFixed(0)}%;--c:${SOFT[i % SOFT.length]};--dl:${rnd(.5, 1.7).toFixed(2)}s;--dx:${rnd(-18, 18).toFixed(0)}px;--s:${rnd(5, 8).toFixed(0)}px`; box.appendChild(d); }
  }
  function build(k, text, glucose) {
    const root = document.createElement('div');
    root.id = 'gx-greet'; root.className = 'gx-gr gx-g-' + k; root.setAttribute('role', 'status'); root.setAttribute('aria-live', 'polite');
    root.innerHTML = `<div class="gx-glass"><div class="gx-stage" aria-hidden="true"><div class="gx-fx"></div><span class="gx-halo"></span><span class="gx-ring"></span><span class="gx-ring r2"></span><span class="gx-rip"></span><span class="gx-rip r2"></span>
      <span class="gx-drop"><img class="gx-img" src="${GX_DROP}" alt="" width="66" height="86" draggable="false"><i class="gx-sh"></i></span><span class="gx-badge">${SYM[k]}</span></div>
      <div class="gx-chip"><span class="gx-lbl">${LBL[k]} · <span class="gx-v num">${typeof fn === 'function' ? fn(glucose, 1) : glucose} mg/dL</span></span><b class="gx-t">${esc(text)}</b></div></div>`;
    try { root.querySelector('.gx-drop').style.setProperty('--gx-mask', 'url("' + GX_DROP + '")'); } catch (e) { }
    fx(root.querySelector('.gx-fx'), k);
    return root;
  }
  /* Mostra a saudação da classificação k. Substitui na hora qualquer saudação ainda na tela. Devolve { band, text } ou null. */
  function show(k, glucose) {
    if (!POOLS[k] || !document.body) return null;
    if (cur) { clearTimeout(cur.t1); clearTimeout(cur.t2); rm(cur.el); cur = null; }
    const text = pick(k), el = build(k, text, glucose); document.body.appendChild(el);
    const o = { el, t1: setTimeout(() => { try { el.classList.add('gx-out'); } catch (e) { } }, SHOW_MS - OUT_MS), t2: setTimeout(() => { rm(el); if (cur === o) cur = null; }, SHOW_MS) };
    cur = o; return { band: k, text };
  }
  /* Ponto de entrada: chamado depois de uma medição NOVA salva com sucesso. */
  function greet(rec) {
    try { if (!rec || rec.source === 'exemplo' || rec.example === true) return null; const k = band(rec.glucose); return k ? show(k, rec.glucose) : null; } catch (e) { console.error(e); return null; }
  }
  window.gxGreet = greet;
  window.TB_GREET = { greet, show, band, pick, POOLS, LBL, MS: SHOW_MS, active: () => !!cur };
})();
