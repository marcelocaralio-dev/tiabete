/* GLUXO Experience: registro reutilizável de preferências. Novo recurso = nova entrada em GX_F.
   Só afeta indicadores visuais: alertas, histórico e proteções clínicas continuam iguais. */
const GX_LS = 'tb-gx';
const GX_F = {
  bubble: { t: 'Bolha flutuante', o: { dot: [true, 'Indicador de novos', 'Halo quando há alerta não lido.'], count: [false, 'Contador na bolha', 'Número de alertas não lidos.'], anim: [true, 'Animações', 'Movimento da bolha e do painel; pulso ao chegar alerta.'] ,
    style: ['soft', 'Pulso de novo alerta', '', [['soft', 'Suave'], ['strong', 'Destacado']]], side: ['free', 'Posição', '', [['free', 'Onde eu soltar'], ['left', 'Esquerda'], ['right', 'Direita']]] } },
  list: { t: 'Lista, prévias e ações', o: { preview: [true, 'Prévia da mensagem', 'Alertas protegidos sempre mostram o texto.'], tap: ['go', 'Toque no alerta', '', [['go', 'Acessar direto'], ['options', 'Mostrar opções antes']]], read: [true, 'Ação: marcar como lida', ''], go: [true, 'Ação: acessar', ''], dismiss: [true, 'Ação: remover', ''], confirm: [false, 'Confirmar remoção', ''], group: [false, 'Agrupar por categoria', 'Na central da bolha.'], quick: [true, 'Ações rápidas', 'Botões nos alertas.'], done: [true, 'Ação: concluir ou confirmar', 'Quando o alerta oferece.'], snooze: [true, 'Ação: adiar', 'Quando o alerta oferece.'], doneConfirm: [false, 'Confirmar antes de concluir', ''], hgroup: [false, 'Agrupar no histórico', 'Segue a escolha de cada categoria.'], freq: ['0', 'Abertura de avisos informativos', 'Intervalo mínimo na bolha.', [['0', 'Sempre'], ['5', 'A cada 5 min'], ['30', 'A cada 30 min']]] } },
  sound: { t: 'Som e vibração da hipoglicemia', o: { beep: [true, 'Som', 'O aviso visual continua sempre.'], vib: [true, 'Vibração', 'No alerta dentro do app.'] } },
  badge: { t: 'Badges', o: { all: [true, 'Ativar badges', 'Vale para todas as áreas abaixo.'], on: [false, 'Menu Mais', 'Alertas não lidos.'], home: [false, 'Menu Início', 'Só alertas glicêmicos não lidos.'], hist: [true, 'Botão do histórico', 'Quantidade no botão.'], num: [true, 'Mostrar número', 'Desligado, aparece só um ponto.'], keep: [false, 'Manter após leitura', 'Conta também alertas ativos já lidos.'], panel: [true, 'Total na central', 'Número ao lado do título.'] } }
};
const GX_G = { glic: ['Alertas glicêmicos', 'hipo', 'glic', 'pers'], lem: ['Lembretes e compromissos', 'lembrete', 'plano'], reg: ['Registros e atividades', 'conf', 'analise', 'rel'], met: ['Metas e conquistas', 'conquista'], app: ['Informações do aplicativo'] };
for (const [g, [t]] of Object.entries(GX_G)) GX_F['c_' + g] = { t, o: { on: [true, 'Receber na central', 'Desligado, fica só no histórico.'], bubble: [true, 'Mostrar na bolha', ''], group: [true, 'Agrupar', 'Vale com o agrupamento ligado.'], open: [true, 'Grupo começa expandido', ''], hi: [g === 'glic', 'Destaque visual', ''] } };
const gxGroup = c => Object.keys(GX_G).find(g => GX_G[g].includes(c)) || 'app';
/* proteção: críticos, hipoglicemia e alertas de prioridade alta nunca são filtrados */
const gxSafe = x => x.src === 'insrem' || x.src === 'basal' || x.cat === 'hipo' || x.prio >= 3 || (x.prio >= 2 && gxGroup(x.cat) === 'glic');
const gxAllowed = x => gxSafe(x) || gxGet('c_' + gxGroup(x.cat), 'on');
const gxPops = x => gxSafe(x) || (gxAllowed(x) && gxGet('c_' + gxGroup(x.cat), 'bubble'));
const gxOpen = {};
let gxInfoAt = 0;
function gxMayPop(x) { if (!gxPops(x)) return false; const f = +gxGet('list', 'freq'); if (x.prio || !f) return true; if (Date.now() - gxInfoAt < f * 60000) return false; gxInfoAt = Date.now(); return true; }
function gxRows(list) {
  const grp = x => !gxSafe(x) && gxGet('list', 'group') && gxGet('c_' + gxGroup(x.cat), 'group');
  const hi = x => gxGet('c_' + gxGroup(x.cat), 'hi') ? ' gx-hi' : '';
  return list.filter(x => !grp(x)).map(x => `<div class="gx-w${hi(x)}">${acRow(x)}</div>`).join('') + Object.keys(GX_G).map(g => { const l = list.filter(x => grp(x) && gxGroup(x.cat) === g); if (!l.length) return ''; const o = gxOpen[g] ?? gxGet('c_' + g, 'open'); return `<details class="gx-g${hi(l[0])}" data-gxg="${g}"${o ? ' open' : ''}><summary>${GX_G[g][0]} (${l.length})</summary>${l.map(acRow).join('')}</details>`; }).join('');
}
document.addEventListener('toggle', e => { const g = e.target.dataset && e.target.dataset.gxg; if (g) gxOpen[g] = e.target.open; }, true);
document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('[data-ac^="dismiss"], [data-acid="dismiss"]'); if (el && gxGet('list', 'confirm') && !window.confirm('Remover da lista?')) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
function gxAll() { try { return JSON.parse(localStorage.getItem(GX_LS)) || {}; } catch (e) { return {}; } }
function gxGet(f, k) { const v = (gxAll()[f] || {})[k]; const [d, , , c] = GX_F[f].o[k]; return (c ? c.some(x => x[0] === v) : typeof v === 'boolean') ? v : d; }
function gxSave(p) { try { if (Object.keys(p).length) localStorage.setItem(GX_LS, JSON.stringify(p)); else localStorage.removeItem(GX_LS); } catch (e) { } }
let gxLast = null;
function gxApply(n) {
  const d = document.documentElement, on = gxB('on') && n > 0, num = gxGet('badge', 'num');
  d.classList.toggle('gx-badge', on); d.classList.toggle('gx-badge-dot', on && !num);
  d.style.setProperty('--gx-n', `"${on && num ? (n > 99 ? '99+' : n) : ''}"`);
  const g = acList().filter(x => x.active && x.html && gxGroup(x.cat) === 'glic' && (!x.read || gxGet('badge', 'keep'))).length;
  d.classList.toggle('gx-home', gxB('home') && g > 0); d.style.setProperty('--gx-h', `"${num ? g : '•'}"`);
  const b = document.getElementById('acb'), anim = gxGet('bubble', 'anim');
  d.classList.toggle('gx-still', !anim); d.classList.toggle('gx-strong', gxGet('bubble', 'style') === 'strong');
  if (gxGet('badge', 'keep')) n = acList().filter(x => x.active && x.html).length;
  if (!b) return;
  n = acList().filter(x => x.active && x.html && !x.read && gxPops(x)).length;
  b.classList.toggle('has', n > 0 && gxGet('bubble', 'dot'));
  let s = b.querySelector('.gx-n');
  if (!(n && gxGet('bubble', 'count'))) { if (s) s.remove(); gxLast = n; return; }
  if (!s) { s = document.createElement('span'); s.className = 'gx-n'; s.setAttribute('aria-hidden', 'true'); b.appendChild(s); }
  s.textContent = n > 99 ? '99+' : n;
  if (anim && gxLast != null && n > gxLast) { s.classList.remove('gx-new'); b.getBoundingClientRect(); s.classList.add('gx-new'); }
  gxLast = n;
}
function gxSec(f, x) {
  return `<details class="card gx-sec"><summary>${x.t}</summary>${f === 'c_lem' ? '<button type="button" class="btn sm" data-act="go" data-r="lembretes">Configurar lembretes</button>' : ''}<div data-gxp="${f}">${gxPrev(f)}</div>${typeof gxoExtra === 'function' ? gxoExtra(f) : ''}${Object.entries(x.o).map(([k, [, t, s, c]]) => `<label class="gx-row"><span><b>${t}</b><small class="dim">${s}</small></span>${c ? `<select data-gx="${f}.${k}">${c.map(([v, l]) => `<option value="${v}"${gxGet(f, k) === v ? ' selected' : ''}>${l}</option>`).join('')}</select>` : `<input type="checkbox" role="switch" data-gx="${f}.${k}"${gxGet(f, k) ? ' checked' : ''}>`}<button type="button" class="gx-one" data-gx-one="${f}.${k}" aria-label="Restaurar padrão: ${t}" title="Restaurar padrão">↺</button></label>`).join('')}<button type="button" class="btn sm" data-gx-reset="${f}">Restaurar padrão</button></details>`;
}
function gxCard(nav) {
  return `<h2 class="sec">Personalização · GLUXO Experience</h2>` + (nav === true ? '' : '<button type="button" class="btn full" data-act="go" data-r="gxnav">Navegação</button><button type="button" class="btn full" data-act="go" data-r="gxvis" style="margin-top:8px">Aparência e interações</button><button type="button" class="btn full" data-act="go" data-r="gxorg" style="margin-top:8px">Organização</button><button type="button" class="btn full" data-act="go" data-r="gxctx" style="margin-top:8px">Inteligência contextual</button>') + Object.entries(GX_F).filter(([f]) => !f.startsWith('vis_') && !f.startsWith('org_') && !f.startsWith('ctx_') && f.startsWith('nav_') === (nav === true)).map(([f, x]) => gxSec(f, x)).join('') + '<button type="button" class="btn full" data-gx-reset="">Restaurar toda a personalização</button>';
}
function gxChanged() { document.querySelectorAll('[data-gx]').forEach(i => { const [f, k] = i.dataset.gx.split('.'); if (i.type === 'checkbox') i.checked = gxGet(f, k); else i.value = gxGet(f, k); }); document.querySelectorAll('[data-gxp]').forEach(e => { e.innerHTML = gxPrev(e.dataset.gxp); }); for (const g in gxOpen) delete gxOpen[g]; acRefresh(); }
document.addEventListener('change', e => { const v = e.target.dataset && e.target.dataset.gx; if (!v) return; const [f, k] = v.split('.'), p = gxAll();
  if (f === 'sound' && !e.target.checked && !window.confirm('Desligar este aviso da hipoglicemia? Você pode deixar de perceber uma glicemia baixa. O aviso visual continua.')) { e.target.checked = true; return; } p[f] = Object.assign({}, p[f], { [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); gxSave(p); gxChanged(); });
document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('[data-gx-reset]'); if (!el) return; const f = el.dataset.gxReset, a = gxAll(), p = f ? a : (['favs', 'ofav', 'opin', 'forder', 'olay'].reduce((m, k) => (a[k] !== undefined && (m[k] = a[k]), m), {})); delete p[f]; gxSave(p); gxChanged(); });
const gxB = k => gxGet('badge', 'all') && gxGet('badge', k);
function gxPrev(f) {
  if (f.startsWith('org_') || f.startsWith('ctx_')) return '';
  if (f === 'sound') return '';
  if (f.startsWith('vis_')) return typeof gxVisPrev === 'function' ? gxVisPrev(f) : '';
  if (f.startsWith('nav_')) return typeof gxNavPrev === 'function' ? gxNavPrev(f) : '';
  const box = h => `<div class="gx-pv" aria-label="Pré-visualização">${h}</div>`, n = v => `<i class="gx-pn">${v}</i>`;
  if (f === 'bubble') return box(`<i class="gx-pb${gxGet(f, 'dot') ? ' has' : ''}${gxGet(f, 'anim') ? ' ' + gxGet(f, 'style') : ''}"></i>${gxGet(f, 'count') ? n(3) : ''}<small>${{ free: 'posição livre', left: 'à esquerda', right: 'à direita' }[gxGet(f, 'side')]}</small>`);
  if (f === 'badge') return box(`Mais ${gxB('on') ? n(gxGet(f, 'num') ? 3 : '') : ''}`);
  if (f === 'list') return box(`<span>${gxGet(f, 'preview') ? 'Hora de medir a glicemia' : 'Lembretes'}<br><small>${gxGet(f, 'quick') ? [['read', 'Lida'], ['go', 'Acessar'], ['dismiss', 'Remover'], ['done', 'Concluir'], ['snooze', 'Adiar']].filter(a => gxGet(f, a[0])).map(a => a[1]).join(' · ') : 'sem botões'}</small></span>`);
  return box(`<span class="${gxGet(f, 'hi') ? 'gx-hi' : ''}">&nbsp;${GX_F[f].t}</span>`);
}
const gxShown = {};
const gxOptsMode = () => gxGet('list', 'quick') && gxGet('list', 'tap') === 'options';
const gxShowActs = id => gxGet('list', 'quick') && (!gxOptsMode() || !!gxShown[id]);
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('#acp [data-ac="opts"]')) { e.preventDefault(); e.target.click(); } });
const gxKind = b => /snooze|adiar/i.test(b.dataset.act) ? 'snooze' : /^(pl-done|ir-confirm|ca-ok)$/.test(b.dataset.act) ? 'done' : '';
function gxActs(it) {
  if (!it.active || !it.html) return '';
  return [...acTmpl(it.html).querySelectorAll('button[data-act]')].filter(b => gxKind(b) && gxGet('list', gxKind(b))).map(b => { const c = b.cloneNode(true); c.className = 'acr-b gx-' + gxKind(b); c.removeAttribute('style'); c.type = 'button'; return c.outerHTML; }).join('');
}
function gxHist(list, cards) {
  if (!gxGet('list', 'hgroup')) return cards(list);
  const grp = x => !gxSafe(x) && gxGet('c_' + gxGroup(x.cat), 'group');
  return cards(list.filter(x => !grp(x))) + Object.keys(GX_G).map(g => { const l = list.filter(x => grp(x) && gxGroup(x.cat) === g); return l.length ? `<details class="gx-g${gxGet('c_' + g, 'hi') ? ' gx-hi' : ''}" data-gxg="${g}"${gxOpen[g] ?? gxGet('c_' + g, 'open') ? ' open' : ''}><summary>${GX_G[g][0]} (${l.length})</summary>${cards(l)}</details>` : ''; }).join('');
}
/* modo convencional: faixas de categorias desligadas saem da página (protegidas ficam) */
const gxBanners = banners;
banners = function () {
  const h = gxBanners(); if (!h || S._acCollect || acBubbleOn() || Object.keys(GX_G).every(g => gxGet('c_' + g, 'on'))) return h;
  const tx = e => e.textContent.replace(/\s+/g, ' ').trim(), off = new Set(acSources().filter(x => !gxAllowed(x)).flatMap(x => [...acTmpl(x.html).children].map(tx)));
  const t = document.createElement('template'); t.innerHTML = h; t.content.querySelectorAll('.banner').forEach(e => { if (off.has(tx(e))) e.remove(); }); return t.content.querySelector('.banner') ? t.innerHTML : '';
};
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-gx-one], .gx-done'); if (!t) return;
  if (t.dataset.gxOne) { e.preventDefault(); const [f, k] = t.dataset.gxOne.split('.'), p = gxAll(); if (p[f]) { delete p[f][k]; if (!Object.keys(p[f]).length) delete p[f]; } gxSave(p); gxChanged(); }
  else if (gxGet('list', 'doneConfirm') && !window.confirm('Concluir este item?')) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
VIEWS.gxexp = gxCard; TITLES.gxexp = 'GLUXO Experience';
