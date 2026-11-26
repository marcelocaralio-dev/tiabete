/* ================= GLUXO Experience 03 · Aparência e interações =================
   Usa o MESMO registro de preferências do Experience 01/02 (GX_F, chave 'tb-gx'): cada recurso é uma entrada "vis_*" e
   aparece em Configurações > Personalização > GLUXO Experience > Aparência e interações (VIEWS.gxvis).
   Só apresentação: não toca em cálculos, métricas, relatórios, planos, autenticação, backup ou sincronização.
   Precedência do movimento: preferência do sistema (reduzir movimento) > "Movimento geral" > escolha de cada categoria > chave geral da seção. */
const GXV_TRI = [['auto', 'Seguir o geral'], ['on', 'Ligado'], ['off', 'Desligado']];
const GXV_SPD = [['fast', 'Rápida'], ['normal', 'Normal'], ['slow', 'Suave']];
const GXV_AMP = [['soft', 'Discreta'], ['normal', 'Normal'], ['strong', 'Marcante']];
const gxvB = (t, s, d) => [d !== false, t, s || ''];
GX_F.vis_motion = { t: 'Visual · Movimento geral', o: { mode: ['system', 'Movimento', 'O aviso do sistema para reduzir movimento é sempre respeitado. “Reduzir sempre” simplifica as animações não essenciais mesmo sem ele.', [['system', 'Seguir o sistema'], ['reduce', 'Reduzir sempre']]] } };
GX_F.vis_skel = { t: 'Visual · Skeleton Loading', o: { on: gxvB('Ativar Skeleton Loading', 'Estruturas temporárias no lugar de telas vazias e textos de espera.'), style: ['shimmer', 'Apresentação', '', [['shimmer', 'Animada (brilho)'], ['pulse', 'Animada (pulsar)'], ['static', 'Estática']]], level: ['normal', 'Intensidade do efeito', '', [['soft', 'Suave'], ['normal', 'Normal'], ['strong', 'Forte']]], nav: gxvB('Ao abrir telas pesadas', 'Só aparece quando a tela costuma demorar para montar neste aparelho. Em telas rápidas nunca aparece.') } };
GX_F.vis_micro = { t: 'Visual · Microanimações', o: { on: gxvB('Microanimações', 'Chave geral. Cada categoria abaixo pode seguir o geral, ficar sempre ligada ou desligada (a escolha da categoria vale mais).'), speed: ['normal', 'Velocidade', '', GXV_SPD], amp: ['normal', 'Intensidade', '', GXV_AMP],
  btn: ['auto', 'Categoria: botões', '', GXV_TRI], card: ['auto', 'Categoria: cards', '', GXV_TRI], rec: ['auto', 'Categoria: registros', '', GXV_TRI], chart: ['auto', 'Categoria: gráficos', '', GXV_TRI], goal: ['auto', 'Categoria: metas e conquistas', '', GXV_TRI],
  press: gxvB('Botões: ao pressionar'), done: gxvB('Botões: ao concluir uma ação'), select: gxvB('Cards e seletores: ao selecionar'), reorder: gxvB('Cards: ao reorganizar'), save: gxvB('Registros: ao salvar ou editar'), del: gxvB('Registros: ao excluir'), chartin: gxvB('Gráficos: entrada dos dados'), chartsel: gxvB('Gráficos: destaque ao selecionar'), goalfx: gxvB('Metas: comemoração ao atingir') } };
GX_F.vis_trans = { t: 'Visual · Transições entre telas', o: { on: gxvB('Transições', 'Desligado: a navegação troca de tela sem animação.'), kind: ['fade', 'Tipo', '', [['fade', 'Esmaecer'], ['slide', 'Deslizar'], ['rise', 'Subir suavemente']]], speed: ['normal', 'Velocidade', '', GXV_SPD], tabs: gxvB('Entre as abas do rodapé'), screens: gxvB('Ao abrir e voltar de detalhes'), panels: gxvB('Expandir e recolher painéis'), sheets: gxvB('Abrir e fechar folhas (janelas de baixo)') } };
GX_F.vis_fb = { t: 'Visual · Feedback visual (avisos)', o: { on: gxvB('Mensagens visuais não essenciais', 'Erros, exclusões e confirmações de operações críticas aparecem sempre.'), pos: ['bottom', 'Posição', 'Vale para os avisos do modo convencional; a bolha de alertas tem a própria posição.', [['bottom', 'Embaixo'], ['top', 'No topo']]], dur: ['normal', 'Duração', '', [['short', 'Curta'], ['normal', 'Normal'], ['long', 'Longa']]],
  ok: gxvB('Salvo, alterado ou concluído'), copy: gxvB('Copiado ou compartilhado'), cfg: gxvB('Configuração atualizada'), proc: gxvB('Operação em andamento', 'Barra fina no topo, só em operações com a internet que demoram.'), net: gxvB('Conexão (sem internet e reconectado)'), info: gxvB('Outras informações'),
  dedupe: gxvB('Evitar avisos repetidos', 'A mesma mensagem não se repete em seguida.'), mode: ['replace', 'Vários avisos', '', [['replace', 'Substituir o anterior'], ['stack', 'Empilhar (até 3)']]], tap: gxvB('Tocar para fechar'), icon: gxvB('Ícone de sucesso, atenção ou erro', 'Não depender só da cor.') } };
GX_F.vis_hap = { t: 'Visual · Feedback tátil', o: { on: gxvB('Vibração leve nas interações', 'Só em aparelhos que oferecem vibração; segue as regras do sistema.'), level: ['mid', 'Intensidade', '', [['low', 'Leve'], ['mid', 'Média'], ['high', 'Forte']]], save: gxvB('Confirmar um registro'), select: gxvB('Selecionar opções', '', false), done: gxvB('Concluir tarefas'), toggle: gxvB('Ativar configurações'), ctrl: gxvB('Controles importantes (botão +, abas)', '', false), err: gxvB('Erros e avisos importantes') } };
GX_F.vis_prog = { t: 'Visual · Indicadores de progresso', o: { on: gxvB('Indicadores adicionais', 'Só aparecem com dados reais que sustentem o valor mostrado.'), style: ['seg', 'Estilo', '', [['seg', 'Segmentado (como os Stories)'], ['cont', 'Contínuo']]], anim: gxvB('Animar o preenchimento'), streak: gxvB('Início: registros dos últimos 7 dias'), goal: gxvB('Início: progresso das conquistas'), imp: gxvB('Importação: etapas'), ex: gxvB('Exames: fila de envio') } };

const gxv = (f, k) => gxGet('vis_' + f, k);
const gxvMQ = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) { return null; } })();
const gxvSys = () => !!(gxvMQ && gxvMQ.matches);
const gxvCalm = () => gxvSys() || gxv('motion', 'mode') === 'reduce';
/* categoria de microanimação ativa: a escolha da categoria prevalece sobre a chave geral; movimento reduzido vence tudo */
function gxvM(c) { if (gxvCalm()) return false; const p = gxv('micro', c); return p === 'on' || (p === 'auto' && gxv('micro', 'on')); }
const GXV_E = { press: 'btn', done: 'btn', select: 'card', reorder: 'card', save: 'rec', del: 'rec', chartin: 'chart', chartsel: 'chart', goalfx: 'goal' };
const gxvX = e => document.documentElement.classList.contains('gxv-x-' + e);
const gxvEsc = s => typeof esc === 'function' ? esc(s) : String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function gxvApply() {
  const d = document.documentElement, c = d.classList, calm = gxvCalm(), K = { fast: .6, normal: 1, slow: 1.6 }, A = { soft: .6, normal: 1, strong: 1.5 }, L = { soft: .55, normal: 1, strong: 1.7 };
  c.toggle('gxv-calm', calm);
  for (const [e, cat] of Object.entries(GXV_E)) c.toggle('gxv-x-' + e, gxvM(cat) && gxv('micro', e));
  const T = !calm && gxv('trans', 'on');
  for (const k of ['tabs', 'screens', 'panels', 'sheets']) c.toggle('gxv-tr-' + k, T && gxv('trans', k));
  c.toggle('gxv-pg-anim', !calm && gxv('prog', 'anim'));
  c.toggle('gxv-sk-anim', !calm && gxv('skel', 'style') !== 'static');
  d.dataset.gxvSk = gxv('skel', 'style'); d.dataset.gxvTr = gxv('trans', 'kind'); d.dataset.gxvPos = gxv('fb', 'pos');
  const k = K[gxv('micro', 'speed')], s = d.style;
  s.setProperty('--gxv-k', k); s.setProperty('--gxv-amp', A[gxv('micro', 'amp')]); s.setProperty('--gxv-tk', K[gxv('trans', 'speed')]); s.setProperty('--gxv-lv', L[gxv('skel', 'level')]);
  [['--ds-t-fast', .12], ['--ds-t', .2], ['--ds-t-slow', .32]].forEach(([n, v]) => { if (k === 1) s.removeProperty(n); else s.setProperty(n, (v * k).toFixed(3) + 's'); });
}
try { if (gxvMQ && gxvMQ.addEventListener) gxvMQ.addEventListener('change', gxvApply); } catch (e) { }

/* ---------- Skeleton Loading ---------- */
const GXV_KIND = { painel: 'dash', historico: 'list', analise: 'chart', relatorios: 'report', metricas: 'metrics' };
function gxvSk(kind, o) {
  o = o || {}; if (!gxv('skel', 'on')) return '';
  const B = (h, w, c) => `<i class="gxv-b${c ? ' ' + c : ''}" style="height:${h}px${w ? ';width:' + w : ''}"></i>`, card = (...x) => `<div class="gxv-c">${x.join('')}</div>`;
  const rows = n => Array.from({ length: n }, () => `<div class="gxv-r">${B(38, '38px', 'rd')}<div class="gxv-rt">${B(12, '62%')}${B(10, '38%')}</div>${B(14, '44px')}</div>`).join('');
  const lines = n => Array.from({ length: n }, (_, i) => B(12, [100, 86, 64][i % 3] + '%')).join('');
  const h = ({
    dash: () => card(B(12, '42%'), B(40, '52%'), B(12, '100%', 'bar')) + `<div class="gxv-g2">${card(B(10, '50%'), B(28, '60%'))}${card(B(10, '50%'), B(28, '60%'))}</div>` + card(B(10, '36%'), B(150, '100%')),
    list: () => card(B(12, '30%')) + rows(o.n || 6),
    chart: () => card(B(12, '40%'), B(190, '100%'), B(10, '70%')) + card(B(12, '30%'), B(120, '100%')),
    report: () => card(B(14, '46%'), B(12, '100%'), B(12, '92%'), B(12, '70%')) + card(B(14, '38%'), B(12, '100%'), B(12, '88%')),
    metrics: () => `<div class="gxv-g2">${[0, 1, 2, 3].map(() => card(B(10, '55%'), B(30, '45%'), B(10, '80%'))).join('')}</div>`,
    rows: () => rows(o.n || 3), card: () => card(B(12, '40%'), B(28, '55%'), B(10, '80%'))
  }[kind] || (() => lines(o.n || 3)))();
  const t = o.ttl ? ` data-gxv-t0="${Date.now()}" data-gxv-ttl="${o.ttl}"` : '';
  return `<div class="gxv-sk gxv-k-${kind}" role="status" aria-busy="true" aria-label="${gxvEsc(o.label || 'Carregando')}"${t}${o.h ? ` style="min-height:${Math.round(o.h)}px"` : ''}>${h}</div>`;
}
/* nunca deixa o esqueleto para sempre: vira estado de falha com nova tentativa */
function gxvFail(e, msg) {
  if (!e || !e.replaceWith) return;
  const n = document.createElement('div'); n.className = 'ds-note'; n.setAttribute('data-tone', 'neg'); n.setAttribute('role', 'alert');
  n.innerHTML = `<i aria-hidden="true"></i><div><b>${gxvEsc(msg || 'Está demorando mais que o esperado.')}</b><div style="margin-top:8px"><button type="button" class="btn sm" data-gxv-retry>Tentar de novo</button></div></div>`;
  e.replaceWith(n);
}
setInterval(() => { try { const l = document.querySelectorAll('[data-gxv-t0]'); if (!l.length) return; const now = Date.now(); l.forEach(e => { if (now - +e.dataset.gxvT0 > +e.dataset.gxvTtl) gxvFail(e); }); } catch (e) { } }, 4000);
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-gxv-retry]')) { e.preventDefault(); render(); } });

/* ---------- Haptic ---------- */
let gxvHapAt = 0;
function gxvHap(kind, force) {
  try {
    if (!force && !(gxv('hap', 'on') && gxv('hap', kind))) return false;
    if (typeof navigator.vibrate !== 'function') return false;
    const now = Date.now(); if (now - gxvHapAt < 80) return false; gxvHapAt = now;
    const m = { low: 1, mid: 1.8, high: 3 }[gxv('hap', 'level')] || 1.8, base = kind === 'err' ? [14, 40, 14] : (kind === 'save' || kind === 'done') ? [8, 30, 8] : [8];
    return !!navigator.vibrate(base.map((v, i) => i % 2 ? v : Math.round(v * m)));
  } catch (e) { return false; }
}

/* ---------- Feedback visual: um único caminho para todos os avisos ---------- */
const GXV_ICON = { ok: '✓', copy: '✓', cfg: '✓', del: '✓', err: '!', net: '!', proc: 'i', info: 'i' };
function gxvKind(m) {
  m = String(m || '');
  if (/^(sem conexão|conexão restabelecida)|offline|sem internet/i.test(m)) return 'net';
  if (/não foi possível|não consegui|erro|falh|inválid|negad|recus|algo deu errado|^informe|cole o texto|máximo|limite de|grande demais|não há |ainda não há|precisa estar|não é possível/i.test(m)) return 'err';
  if (/exclu[ií]d|foram apagad|apagad[ao]s?\.|restaurad|bloqueio|biometria|cifra|\bpin\b|licen[çc]a|desconectad/i.test(m)) return 'del';   /* crítico: nunca oculto */
  if (/copiad|compartilh/i.test(m)) return 'copy';
  if (/preferência|configura|roleta salva|atalho|apelido|favorit|ativad|desativad/i.test(m)) return 'cfg';
  if (/salv|atualizad|editad|alterad|importad|conclu[ií]d|enviad|registrad|aplicad|exportad|adicionad|criad|voltaram/i.test(m)) return 'ok';
  if (/aguarde|consultando|enviando|em andamento/i.test(m)) return 'proc';
  return 'info';
}
const gxvCrit = k => k === 'err' || k === 'del';
const gxvShow = k => gxvCrit(k) || (gxv('fb', 'on') && gxv('fb', k) !== false);
const gxvDur = (ms, crit) => { const k = { short: .6, normal: 1, long: 1.9 }[gxv('fb', 'dur')] || 1, v = Math.round(ms * k); return crit ? Math.max(v, ms) : v; };
function gxvBye(t) { if (!t || !t.parentNode) return; if (gxvCalm()) { t.remove(); return; } t.classList.add('out'); setTimeout(() => t.remove(), 180); }
function gxvDom(msg, kind) {
  let w = document.getElementById('gxv-tw'); if (!w) { w = document.createElement('div'); w.id = 'gxv-tw'; w.className = 'gxv-tw'; document.body.appendChild(w); }
  document.querySelectorAll('body > .toast').forEach(x => x.remove());
  if (gxv('fb', 'mode') === 'stack') { while (w.children.length >= 3) w.firstChild.remove(); } else w.innerHTML = '';
  const t = document.createElement('div'); t.className = 'toast gxv-ti-' + kind; t.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  t.innerHTML = (gxv('fb', 'icon') ? `<i class="gxv-ic" aria-hidden="true">${GXV_ICON[kind] || 'i'}</i>` : '') + `<span>${gxvEsc(msg)}</span>`;
  if (gxv('fb', 'tap')) t.addEventListener('click', () => gxvBye(t)); else t.style.pointerEvents = 'none';
  w.appendChild(t); setTimeout(() => gxvBye(t), kind === 'err' ? Math.max(gxvDur(3200), 5000) : gxvDur(3200));
}
let gxvLastMsg = '', gxvLastAt = 0;
toast = function (msg) {
  const kind = gxvKind(msg), now = Date.now();
  if (gxv('fb', 'dedupe') && msg === gxvLastMsg && now - gxvLastAt < 1500) return;
  gxvLastMsg = msg; gxvLastAt = now;
  if (!gxvShow(kind)) { try { if (!acBubbleOn()) acToast(msg); } catch (e) { } return; }   /* oculto: no modo convencional ainda fica no histórico de avisos */
  if (kind === 'ok') gxvHap('save'); else if (kind === 'err') gxvHap('err');
  try { if (acToast(msg)) return; } catch (e) { }
  gxvDom(msg, kind);
};
window.addEventListener('offline', () => toast('Sem conexão com a internet. Seus dados continuam salvos neste aparelho.'));
window.addEventListener('online', () => toast('Conexão restabelecida.'));
/* operação em andamento: barra fina só quando a chamada à internet demora (não aparece em operações instantâneas) */
let gxvNet = 0, gxvNetT = 0;
function gxvNetBar(on) { let b = document.getElementById('gxv-nb'); if (!on) { if (b) b.remove(); return; } if (b) return; b = document.createElement('div'); b.id = 'gxv-nb'; b.className = 'gxv-nb'; b.setAttribute('role', 'progressbar'); b.setAttribute('aria-label', 'Operação em andamento'); b.innerHTML = '<i></i>'; document.body.appendChild(b); }
function gxvNetBegin() { gxvNet++; if (gxvNet === 1) { clearTimeout(gxvNetT); gxvNetT = setTimeout(() => { if (gxvNet > 0 && gxv('fb', 'on') && gxv('fb', 'proc')) gxvNetBar(true); }, 700); } }
function gxvNetEnd() { gxvNet = Math.max(0, gxvNet - 1); if (!gxvNet) { clearTimeout(gxvNetT); gxvNetBar(false); } }
try { const f0 = window.fetch; if (typeof f0 === 'function') window.fetch = function (u) { const p = f0.apply(this, arguments); try { const s = String((u && u.url) || u); if (/^https?:/i.test(s) && s.indexOf(location.origin) !== 0) { gxvNetBegin(); p.then(gxvNetEnd, gxvNetEnd); } } catch (e) { } return p; }; } catch (e) { }
try { const h0 = window.TB_HTTP; if (typeof h0 === 'function') window.TB_HTTP = function () { gxvNetBegin(); const p = h0.apply(this, arguments); try { p.then(gxvNetEnd, gxvNetEnd); } catch (e) { gxvNetEnd(); } return p; }; } catch (e) { }

/* ---------- Progresso (segmentado como os Stories ou contínuo) ---------- */
function gxvSeg(o) {
  const n = o.n, v = Math.max(0, Math.min(n, o.v || 0)), cont = gxv('prog', 'style') === 'cont' || n > 14;
  const inner = cont ? `<i class="gxv-fill" style="--p:${(n ? v / n : 0).toFixed(3)}"></i>` : Array.from({ length: n }, (_, i) => { const s = o.states ? o.states[i] : i < v ? 'on' : (o.cur && i === v ? 'cur' : ''); return `<i${s ? ` class="${s}"` : ''} style="--i:${i}"></i>`; }).join('');
  return `<div class="gxv-seg ${cont ? 'is-cont' : 'is-seg'}" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${v}" aria-label="${gxvEsc(o.label)}">${inner}</div>`;
}
const gxvPgCard = (title, right, seg, extra) => `<section class="card gxv-pg" aria-label="${gxvEsc(title)}"><div class="row sp"><b>${gxvEsc(title)}</b><span class="num">${gxvEsc(right)}</span></div>${seg}${extra || ''}</section>`;
function gxvStreak() {
  const real = (S.records || []).filter(r => r && r.source !== 'exemplo' && r.date); if (!real.length) return '';
  const set = new Set(real.map(r => r.date)), days = Array.from({ length: 7 }, (_, i) => isoDate(new Date(addDays(Date.now(), i - 6))));
  const st = days.map((d, i) => set.has(d) ? 'on' : i === 6 ? 'cur' : ''), v = st.filter(x => x === 'on').length;
  return gxvPgCard('Registros nos últimos 7 dias', `${v} de 7`, gxvSeg({ n: 7, v, states: st, label: `Registros nos últimos 7 dias: ${v} de 7 dias com medição` }), `<div class="gxv-wd" aria-hidden="true">${days.map(d => `<span>${WD[new Date(d + 'T12:00:00').getDay()].slice(0, 1).toUpperCase()}</span>`).join('')}</div>`);
}
function gxvGoals() {
  if (typeof rewardEval !== 'function' || typeof RW_INFO === 'undefined' || typeof rwEval !== 'function') return '';
  let ev; try { ev = rwEval(); } catch (e) { return ''; }
  const l = Object.keys(RW_INFO).filter(k => rwOn(k) && ev[k] && ev[k].streak > 0).map(k => {
    const s = ev[k].streak, N = RW_STEPS.find(n => n > s) || RW_STEPS[RW_STEPS.length - 1], v = Math.min(s, N);
    return `<div class="gxv-gl"><div class="row sp"><span>${RW_INFO[k].t}</span><span class="num">${v} de ${N} dias</span></div>${gxvSeg({ n: N, v, label: `${RW_INFO[k].t}: ${v} de ${N} dias até o próximo marco` })}</div>`;
  }).join('');
  return l ? `<section class="card gxv-pg" aria-label="Progresso das conquistas"><b>Conquistas em andamento</b>${l}</section>` : '';
}
function gxvImp() {
  const i = S.imp; if (!i || i.error) return '';
  const st = i.done ? ['on', 'on', 'on'] : i.loading ? ['cur', '', ''] : ['on', 'cur', ''], v = st.filter(x => x === 'on').length;
  return gxvPgCard('Importação', i.done ? 'Concluída' : i.loading ? 'Lendo o arquivo' : 'Conferindo os dados', gxvSeg({ n: 3, v, states: st, label: `Importação: etapa ${Math.min(3, v + 1)} de 3 (ler, conferir, gravar)` }), '<div class="gxv-wd gxv-wd3" aria-hidden="true"><span>Ler</span><span>Conferir</span><span>Gravar</span></div>');
}
function gxvEx() {
  const q = (S.ex && S.ex.queue) || []; if (!q.length || !S.ex.busy) return '';
  const st = q.map(x => x.st === 'erro' ? 'err' : (x.st === 'ok' || x.st === 'dup') ? 'on' : (x.st === 'lendo' || x.st === 'analisando') ? 'cur' : ''), v = st.filter(x => x === 'on' || x === 'err').length;
  return gxvPgCard('Envio de exames', `${v} de ${q.length}`, gxvSeg({ n: q.length, v, states: st, label: `Envio de exames: ${v} de ${q.length} concluídos` }));
}
function gxvProg(route, view) {
  if (!gxv('prog', 'on')) return;
  const h = route === 'painel' ? (gxv('prog', 'streak') ? gxvStreak() : '') + (gxv('prog', 'goal') ? gxvGoals() : '') : route === 'importar' && gxv('prog', 'imp') ? gxvImp() : route === 'exames' && gxv('prog', 'ex') ? gxvEx() : '';
  if (!h) return;
  const t = document.createElement('template'); t.innerHTML = h;
  /* sem repetir a animação quando nada mudou desde o desenho anterior */
  t.content.querySelectorAll('.gxv-pg').forEach((c, i) => { const k = route + i, s = gxvH32(c.innerHTML); if (gxvSigs['p' + k] === s) c.querySelectorAll('.gxv-seg').forEach(x => x.classList.add('still')); gxvSigs['p' + k] = s; });
  const pg = view.querySelector('nav.gx-bar') || view.querySelector('.in-top') || view.querySelector('h1.pg'); if (pg) pg.after(t.content); else view.prepend(t.content);   /* no Início, abaixo dos atalhos */
}

/* ---------- Motor de render: transições, esqueleto adaptativo, destaques ---------- */
const gxvRender0 = render, gxvOpen0 = openSheet, gxvClose0 = closeSheet;
const gxvT = {}, gxvH = {}, gxvSigs = {}, gxvIds = {};
let gxvRoute = null, gxvBooted = false, gxvPend = 0, gxvNavTap = false, gxvAct = 0, gxvSel = null, gxvOpening = false, gxvCfg = null;
const gxvH32 = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const GXV_TABS = ['painel', 'historico', 'analise', 'mais'];
function gxvGhost(src, cls, ms, css) {
  try {
    if (!src || src.querySelectorAll('*').length > 1500) return null;
    const r = src.getBoundingClientRect(), g = src.cloneNode(true);
    g.removeAttribute('id'); g.querySelectorAll('[id]').forEach(n => n.removeAttribute('id')); g.querySelectorAll('[data-act],[data-gx],[data-gxs],[name],[autofocus]').forEach(n => { ['data-act', 'data-gx', 'data-gxs', 'name', 'autofocus'].forEach(a => n.removeAttribute(a)); });
    g.classList.add('gxv-ghost', cls); g.setAttribute('aria-hidden', 'true'); try { g.inert = true; } catch (e) { }
    g.style.cssText = (css || `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${Math.max(0, Math.min(r.height, innerHeight - Math.max(r.top, 0)))}px;overflow:hidden;margin:0;`) + `pointer-events:none;animation-duration:${ms}ms;`;
    document.body.appendChild(g); setTimeout(() => g.remove(), ms + 80); return g;
  } catch (e) { return null; }
}
function gxvDir(a, b) { const i = GXV_TABS.indexOf(a), j = GXV_TABS.indexOf(b); if (i >= 0 && j >= 0) return j >= i ? 1 : -1; return j >= 0 ? -1 : 1; }
const gxvFlipSel = '.gx-bar button, #view [data-pm]';
const gxvFlipKey = e => e.dataset.pm ? 'pm' + e.dataset.pm : 'b' + (e.dataset.r || e.dataset.act || e.textContent.trim());
function gxvSync() {   /* reaplica quando as preferências mudaram por fora (restauração, outra tela) */
  let raw = ''; try { raw = localStorage.getItem('tb-gx') || ''; } catch (e) { }
  if (raw !== gxvCfg) { gxvCfg = raw; gxvApply(); }
}
function gxvPop(el) { if (!el) return; el.classList.remove('gxv-popin'); void el.offsetWidth; el.classList.add('gxv-popin'); setTimeout(() => el.classList.remove('gxv-popin'), 600); }
function gxvDo(route, changed, deferred, args) {
  gxvSync();
  const view = document.getElementById('view'), cl = document.documentElement.classList, prev = gxvRoute;
  const tabs = GXV_TABS.includes(prev) && GXV_TABS.includes(route), tr = changed && (tabs ? cl.contains('gxv-tr-tabs') : cl.contains('gxv-tr-screens'));
  const dir = gxvDir(prev, route);
  let flip = null;
  if (!changed && cl.contains('gxv-x-reorder')) { flip = {}; try { document.querySelectorAll(gxvFlipSel).forEach(e => { flip[gxvFlipKey(e)] = e.getBoundingClientRect(); }); } catch (e) { flip = null; } }
  if (tr && !deferred && window.scrollY < 40) { const g = gxvGhost(view, 'gxv-gout', Math.round(140 * parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gxv-tk') || 1))); if (g) g.style.setProperty('--gxv-ox', document.documentElement.dataset.gxvTr === 'slide' ? `${-16 * dir}px` : '0px'); }
  const t0 = performance.now();
  gxvRender0.apply(null, args);
  const dt = performance.now() - t0; gxvT[route] = gxvT[route] == null ? dt : gxvT[route] * .5 + dt * .5;
  gxvRoute = route; gxvH[route] = Math.min(view.offsetHeight, 3000);
  try { gxvProg(route, view); } catch (e) { console.error(e); }
  view.classList.remove('gxv-tin', 'gxv-swap');
  if (tr || deferred && !cl.contains('gxv-calm')) {
    view.style.setProperty('--gxv-dir', dir); void view.offsetWidth; view.classList.add(tr ? 'gxv-tin' : 'gxv-swap');
    const done = () => view.classList.remove('gxv-tin', 'gxv-swap'); view.addEventListener('animationend', done, { once: true }); setTimeout(done, 700);
  }
  if (flip) {
    try { document.querySelectorAll(gxvFlipSel).forEach(e => { const o = flip[gxvFlipKey(e)]; if (!o || !e.animate) return; const n = e.getBoundingClientRect(), dx = o.left - n.left, dy = o.top - n.top; if (Math.abs(dx) > 3 || Math.abs(dy) > 3) e.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 240 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gxv-k')) || 1), easing: 'cubic-bezier(.2,.7,.2,1)' }); }); } catch (e) { }
  }
  /* gráficos: só animam quando o desenho é diferente do anterior (nova tela, novo período, dados novos) */
  try {
    view.querySelectorAll('.chart').forEach((c, i) => { const k = 'c' + route + (c.dataset.chart || i), s = gxvH32(c.outerHTML.replace(/ class="[^"]*gxv-ci[^"]*"/, '')); if (gxvSigs[k] !== s && gxvX('chartin')) { c.classList.add('gxv-ci'); setTimeout(() => c.classList.remove('gxv-ci'), 900); } gxvSigs[k] = s; });
  } catch (e) { }
  /* registros: destaca o que acabou de ser salvo ou editado (só com ação recente do usuário e até 2 linhas) */
  try {
    const els = [...view.querySelectorAll('[data-act="open"][data-id]')];
    if (els.length <= 400) {
      const cur = {}; els.forEach(e => { cur[e.dataset.id] = gxvH32(e.outerHTML); }); const old = gxvIds[route]; gxvIds[route] = cur;
      if (old && !changed && gxvX('save') && Date.now() - gxvAct < 2500) { const hit = els.filter(e => old[e.dataset.id] !== cur[e.dataset.id]); if (hit.length && hit.length <= 2) hit.forEach(e => { e.classList.add('gxv-new'); setTimeout(() => e.classList.remove('gxv-new'), 1400); }); }
    } else gxvIds[route] = null;
  } catch (e) { }
  if (gxvSel && Date.now() - gxvSel.t < 900) { const el = document.querySelectorAll(GXV_SEL)[gxvSel.i]; gxvSel = null; if (el && gxvSelOn(el)) gxvPop(el.closest('.mk') ? el.closest('.mk').querySelector('span') || el : el); }
}
render = function () {
  const route = VIEWS[S.route] ? S.route : 'painel', first = !gxvBooted, changed = gxvBooted && route !== gxvRoute, args = arguments;
  gxvBooted = true; if (gxvPend) gxvPend = 0;
  const heavy = changed && gxvNavTap && gxv('skel', 'on') && gxv('skel', 'nav') && GXV_KIND[route] && (gxvT[route] || 0) >= 80;
  if (!heavy) { gxvDo(route, changed, first && !!document.querySelector('#view .gxv-sk'), args); return; }
  const view = document.getElementById('view'), nav = document.getElementById('nav');
  view.innerHTML = `<h1 class="pg">${gxvEsc(TITLES[route] || '')}</h1>` + gxvSk(GXV_KIND[route], { ttl: 20000, h: gxvH[route], label: 'Carregando ' + (TITLES[route] || '') });
  if (nav) nav.innerHTML = navHTML();
  const tok = ++gxvPend;
  requestAnimationFrame(() => setTimeout(() => { if (tok !== gxvPend) return; gxvPend = 0; try { gxvDo(route, true, true, args); } catch (e) { console.error(e); const s = view.querySelector('.gxv-sk'); if (s) gxvFail(s, 'Não foi possível montar esta tela.'); } }, 0));
};
const GXV_SEL = '#view .seg button, #view .seg-b, #view .chip, #view .ac-chip, #view .ia-chip, #view .mk';
const gxvSelOn = el => el.getAttribute('aria-pressed') === 'true' || el.classList.contains('on') || !!el.querySelector('input:checked');
openSheet = function () { gxvOpening = true; try { return gxvOpen0.apply(this, arguments); } finally { gxvOpening = false; } };
closeSheet = function () {
  const b = document.getElementById('sheet-bg');
  if (b && !gxvOpening && document.documentElement.classList.contains('gxv-tr-sheets')) gxvGhost(b, 'gxv-sg', Math.round(160 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gxv-tk')) || 1)), 'position:fixed;inset:0;');
  return gxvClose0.apply(this, arguments);
};

/* ---------- Eventos delegados (nada é ligado por elemento) ---------- */
['pointerdown', 'keydown', 'submit'].forEach(n => document.addEventListener(n, () => { gxvAct = Date.now(); }, { capture: true, passive: true }));
document.addEventListener('click', e => {
  const t = e.target; if (!t || !t.closest) return;
  if (t.closest('#nav [data-act="go"]')) { gxvNavTap = true; setTimeout(() => { gxvNavTap = false; }, 0); }
  if (t.closest('.fab, .nav button')) gxvHap('ctrl');
  const b = t.closest('button[data-act]'); if (b && typeof gxKind === 'function' && gxKind(b) === 'done') gxvHap('done');
  const s = t.closest('.seg button, .seg-b, .chip, .ac-chip, .ia-chip, .mk');
  if (s) { gxvHap('select'); if (gxvX('select')) { const all = [...document.querySelectorAll(GXV_SEL)], i = all.indexOf(s); gxvSel = i >= 0 ? { i, t: Date.now() } : null; setTimeout(() => { if (s.isConnected && gxvSelOn(s)) { gxvSel = null; gxvPop(s.closest('.mk') ? s.closest('.mk').querySelector('span') || s : s); } }, 0); } }
  const sel = typeof BT_SEL === 'string' ? t.closest(BT_SEL) : null;
  if (sel) { if (!gxvX('done')) sel.classList.remove('is-hit'); else if (sel.classList.contains('btn')) { sel.classList.remove('gxv-pop'); void sel.offsetWidth; sel.classList.add('gxv-pop'); setTimeout(() => sel.classList.remove('gxv-pop'), 500); } }
  const d = t.closest('[data-act="del-do"], [data-act="del-do-hba"], [data-act="del-do-sch"]');
  if (d && gxvX('del') && d.dataset.id) { try { const row = document.querySelector(`#view [data-id="${CSS.escape(d.dataset.id)}"]`); if (row) gxvGhost(row, 'gxv-del', 260); } catch (er) { } }
}, true);
document.addEventListener('change', e => {
  const t = e.target; if (!t || !t.matches) return;
  if (t.matches('input.swt, input[role="switch"], .tgl input')) gxvHap('toggle'); else if (t.matches('select, input[type="radio"]')) gxvHap('select');
}, true);

/* ---------- Central de configurações: Aparência e interações ---------- */
function gxvDemoSeg() { return gxvSeg({ n: 7, v: 5, states: ['on', 'on', 'on', 'on', 'on', 'cur', ''], label: 'Exemplo: 5 de 7' }); }
function gxVisPrev(f) {
  const box = h => `<div class="gx-pv gxv-pv" aria-label="Pré-visualização">${h}</div>`, t = k => `<button type="button" class="btn sm" data-gxv-test="${k}">`;
  if (f === 'vis_motion') return box(`<small>Aparelho: ${gxvSys() ? 'pede movimento reduzido' : 'sem pedido de movimento reduzido'} · Agora: <b>${gxvCalm() ? 'animações simplificadas' : 'animações completas'}</b></small>`);
  if (f === 'vis_skel') return box(`<div class="gxv-demo-sk">${gxvSk('card') || '<small>Desligado: as telas usam o texto de espera de sempre.</small>'}</div>`);
  if (f === 'vis_micro') return box(`<span class="gxv-states" aria-label="Estados dos componentes"><span class="btn sm gxv-demo">Normal</span><span class="btn sm" aria-pressed="true" style="background:var(--brand-d);border-color:var(--brand)">Selecionado</span><span class="btn sm" style="transform:scale(.96);background:var(--brand-d);border-color:var(--brand)">Pressionado</span><span class="btn sm" aria-disabled="true" style="opacity:.45">Desabilitado</span><span class="btn sm" aria-busy="true">Carregando</span><span class="btn sm is-hit">Concluído</span><span class="btn sm" style="border-color:var(--red-l)">⚠ Erro</span></span>${t('micro')}Testar</button>`);
  if (f === 'vis_trans') return box(`<span class="gxv-demo-t">${gxv('trans', 'on') ? { fade: 'Esmaecer', slide: 'Deslizar', rise: 'Subir suavemente' }[gxv('trans', 'kind')] : 'Sem animação'}</span>${t('trans')}Testar</button>`);
  if (f === 'vis_fb') return box(`${t('fb')}Testar aviso</button><small>Erros e exclusões aparecem sempre, mesmo com as categorias desligadas.</small>`);
  if (f === 'vis_hap') return box(`${t('hap')}Testar vibração</button><small>${typeof navigator.vibrate === 'function' ? 'Este aparelho oferece vibração.' : 'Este aparelho (ou visualizador) não oferece vibração.'}</small>`);
  if (f === 'vis_prog') return box(`<div style="flex:1">${gxv('prog', 'on') ? gxvDemoSeg() : '<small>Desligado.</small>'}</div>${t('prog')}Animar</button>`);
  return '';
}
function gxVisCard() {
  return `<h2 class="sec">Aparência e interações · GLUXO Experience</h2><p class="hint" style="margin:0 0 12px">Cada recurso tem as próprias opções. Escolha o que quer ver e sentir; o aviso do sistema para reduzir movimento sempre é respeitado.</p>`
    + Object.entries(GX_F).filter(([f]) => f.startsWith('vis_')).map(([f, x]) => gxSec(f, x)).join('')
    + '<button type="button" class="btn full" data-gxv-reset-all>Restaurar tudo desta categoria</button>';
}
document.addEventListener('click', e => {
  const r = e.target.closest && e.target.closest('[data-gxv-reset-all]');
  if (r) { const p = gxAll(); Object.keys(p).forEach(k => { if (k.startsWith('vis_')) delete p[k]; }); gxSave(p); gxChanged(); return; }
  const b = e.target.closest && e.target.closest('[data-gxv-test]'); if (!b) return;
  const k = b.dataset.gxvTest, box = b.closest('.gxv-pv');
  if (k === 'fb') gxvDom('Registro salvo. Este é um exemplo de aviso.', 'ok');
  else if (k === 'hap') { if (!gxvHap('save', true)) gxvDom('Este aparelho não oferece vibração.', 'info'); }
  else if (k === 'micro') { if (!gxvCalm()) { gxvPop(box.querySelector('.gxv-demo')); gxvPop(box.querySelector('.is-hit')); } }
  else if (k === 'trans') { const d = box.querySelector('.gxv-demo-t'); if (d && gxv('trans', 'on') && !gxvCalm()) { d.classList.remove('gxv-tin'); void d.offsetWidth; d.classList.add('gxv-tin'); d.style.setProperty('--gxv-dir', 1); } }
  else if (k === 'prog') { const d = box.querySelector('div'); if (d) { d.innerHTML = gxvDemoSeg(); } }
});
const gxvChanged0 = gxChanged;
gxChanged = function () { gxvChanged0.apply(this, arguments); gxvCfg = null; gxvSync(); };
VIEWS.gxvis = gxVisCard; TITLES.gxvis = 'Aparência e interações';
gxvApply(); try { gxvCfg = localStorage.getItem('tb-gx') || ''; } catch (e) { }
/* abertura: se os dados demorarem, mostra o esqueleto da tela em vez de um vazio (some no primeiro desenho; se travar, vira falha com nova tentativa) */
setTimeout(() => { try { const v = document.getElementById('view'); if (!gxvBooted && v && !v.children.length && gxv('skel', 'on')) v.innerHTML = gxvSk(GXV_KIND[(location.hash || '').replace('#', '')] || 'dash', { ttl: 30000, label: 'Carregando o GLUXO' }); } catch (e) { } }, 250);
