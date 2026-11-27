/* ================= GLUXO Experience · Central de personalização =================
   Reorganiza a GLUXO Experience em categorias (botões) e padroniza cada recurso: nome, o que faz, chave, resultado esperado,
   estado atual, comparação ligado/desligado, prévia e opções com legenda. Reaproveita o MESMO registro de preferências (GX_F, 'tb-gx'),
   os mesmos controles delegados (data-gx, data-gx-one) e os mesmos módulos (bolha, navegação, aparência, organização, contexto).
   Dados em gxhub-data.js. Nada aqui altera registros clínicos, cálculos, alertas de segurança ou o protocolo de hipoglicemia. */
const GXH_ALL = ['gxexp', 'gxvis', 'gxdados', 'gxctxc', 'gxnav', 'gxorg', 'gxctx'];
const gxhSvg = (k, s) => `<svg viewBox="0 0 24 24" width="${s || 22}" height="${s || 22}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GXH_IC[k] || GXH_IC.sliders}</svg>`;
const gxhOpen = new Set(), gxhPos = {};
let gxhLast = null;

/* ---------- estado e dependências ---------- */
const gxhIsOpt = (f, k) => !!(GX_F[f] && GX_F[f].o[k]);
function gxhAct(f) {   /* true = ativo, false = desativado, null = só tem opções de apresentação */
  if (f === 'bubble') return typeof acBubbleOn === 'function' ? !!acBubbleOn() : false;
  if (f === 'sound') return !!(gxGet('sound', 'beep') || gxGet('sound', 'vib'));
  const k = GXH_MASTER[f]; return k ? !!gxGet(f, k) : null;
}
function gxhDepMsg(f) {   /* primeira dependência não atendida, ou '' */
  const d = (GXH[f] && GXH[f][6]) || [];
  for (const x of d) { const ok = x.ok ? x.ok() : gxGet(x.f, x.k); if (!ok) return x.msg; }
  return '';
}
function gxhSt(f) {
  if (gxhLocked(f)) return { cls: 'lock', txt: 'Premium' };
  const a = gxhAct(f);
  if (a === null) {
    const b = Object.keys(GX_F[f].o).filter(k => typeof GX_F[f].o[k][0] === 'boolean'), n = b.filter(k => gxGet(f, k)).length;
    return { cls: 'cfg', txt: b.length ? `${n} de ${b.length} opções ligadas` : 'Opções de apresentação' };
  }
  if (!a) return { cls: 'off', txt: f === 'bubble' ? 'Modo bolha desligado' : 'Desativado' };
  return gxhDepMsg(f) ? { cls: 'wait', txt: 'Ligado, mas sem efeito' } : { cls: 'on', txt: 'Ativado' };
}
const gxhCount = c => { const fs = GXH_CATS[c].fs, sw = fs.filter(f => !gxhLocked(f) && gxhAct(f) !== null); return { on: sw.filter(f => gxhAct(f) && !gxhDepMsg(f)).length, n: sw.length, opts: fs.reduce((s, f) => s + Object.keys(GX_F[f].o).length, 0) }; };
const gxhSumHTML = c => { const k = gxhCount(c); return `<b>${k.on} de ${k.n}</b> recursos ativos <span class="dim">· ${k.opts} opções nesta categoria</span>`; };
function gxanOn(id) { const f = GXH_AN[id]; return !f || gxGet(f, 'on'); }   /* usado pela tela Análise */

/* ---------- legenda e efeito de cada opção ---------- */
const gxhLeg = (f, k) => GX_F[f].o[k][2] || GXH_L[f + '.' + k] || '';
function gxhFx(f, k) { const m = GXH_FX[f + '.' + k]; return m ? (m[gxGet(f, k)] || '') : ''; }

/* ---------- cartão de um recurso ---------- */
function gxhRow(f, k, master) {
  const [, t, , c] = GX_F[f].o[k];
  const ctl = c ? `<select data-gx="${f}.${k}" aria-label="${esc(t)}">${c.map(([v, l]) => `<option value="${esc(v)}"${gxGet(f, k) === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>` : `<input type="checkbox" role="switch" data-gx="${f}.${k}"${gxGet(f, k) ? ' checked' : ''} aria-label="${esc(t)}">`;
  return `<label class="gx-row gxh-row${master ? ' gxh-m' : ''}"><span><b>${esc(t)}</b><small class="dim">${esc(gxhLeg(f, k))}</small>${c ? `<small class="gxh-fx" data-gxh-fx="${f}.${k}">${esc(gxhFx(f, k))}</small>` : ''}</span>${ctl}<button type="button" class="gx-one" data-gx-one="${f}.${k}" aria-label="Restaurar padrão: ${esc(t)}" title="Restaurar padrão">↺</button></label>`;
}
function gxhLockedSec(f) {
  const m = GXH[f];
  return `<details class="card gx-sec gxh-sec gxh-locked" data-gxh="${f}"${gxhOpen.has(f) ? ' open' : ''}><summary><span class="gxh-ic">${gxhSvg(m[1])}</span><span class="gxh-st"><b>${esc(m[0])}</b><small>${esc(m[2])}</small></span><span class="gxh-badge lock" data-gxh-b>Premium</span></summary><p class="gxh-res"><b>Resultado esperado</b>${esc(m[3])}</p><div class="gxh-dep" role="note"><span>${esc(gxhLockWhy())} Suas preferências anteriores continuam guardadas.</span><button type="button" class="btn sm" data-act="go" data-r="licenca">Ver o Premium</button></div></details>`;
}
function gxhSec(f, here) {
  if (gxhLocked(f)) return gxhLockedSec(f);
  const m = GXH[f], x = GX_F[f], st = gxhSt(f), mk = GXH_MASTER[f], dep = gxhDepMsg(f), d0 = ((m[6] || []).find(y => (y.ok ? !y.ok() : !gxGet(y.f, y.k))) || {});
  const keys = Object.keys(x.o), order = mk ? [mk].concat(keys.filter(k => k !== mk)) : keys, on = gxhAct(f) !== false, dim = !!(mk || f === 'bubble') && gxhAct(f) === false;
  const cmp = m[4] ? `<div class="gxh-cmp" aria-label="Comparação entre ligado e desligado"><div class="${on ? 'is-on' : ''}" data-gxh-cmp="on"><b>Ligado</b><span>${esc(m[4])}</span></div><div class="${on ? '' : 'is-on'}" data-gxh-cmp="off"><b>Desligado</b><span>${esc(m[5])}</span></div></div>` : '';
  const go = d0.go && d0.go !== S.route ? `<button type="button" class="btn sm" data-act="go" data-r="${d0.go}">${esc(d0.lb || 'Abrir')}</button>` : '';
  return `<details class="card gx-sec gxh-sec" data-gxh="${f}"${gxhOpen.has(f) ? ' open' : ''}><summary><span class="gxh-ic">${gxhSvg(m[1])}</span><span class="gxh-st"><b>${esc(m[0])}</b><small>${esc(m[2])}</small></span><span class="gxh-badge ${st.cls}" data-gxh-b>${esc(st.txt)}</span></summary>`
    + `<div class="gxh-dep" role="note"${dep ? '' : ' hidden'}><span>${esc(dep)}</span>${go}</div>`
    + `<p class="gxh-res"><b>Resultado esperado</b>${esc(m[3])}</p>${m[7] ? `<p class="hint gxh-note">${esc(m[7])}</p>` : ''}`
    + `<div data-gxp="${f}">${gxPrev(f)}</div>${cmp}`
    + `<div class="gxh-opts${dim ? ' is-off' : ''}">${order.map(k => gxhRow(f, k, k === mk)).join('')}</div>`
    + `${f === 'c_lem' ? '<button type="button" class="btn sm" data-act="go" data-r="lembretes">Configurar lembretes</button>' : ''}${typeof gxoExtra === 'function' ? gxoExtra(f) : ''}`
    + `<button type="button" class="btn sm gxh-rs" data-gx-reset="${f}">Restaurar padrão deste recurso</button></details>`;
}
/* prévia: ilustrativa (marcada como exemplo) somada à prévia real que o módulo de origem já tinha */
const gxhPrev0 = gxPrev;
gxPrev = function (f) { if (f.startsWith('an_')) return GXH_PV[f] ? GXH_PV[f]() : ''; const own = GXH_PV[f] ? GXH_PV[f]() : ''; let old = ''; try { old = gxhPrev0(f) || ''; } catch (e) { } return own + old; };

/* ---------- telas ---------- */
const gxhLockCard = () => gxhPers() ? '' : `<div class="card gxh-lock" role="note"><b>${esc(gxhLockWhy())}</b><p class="hint" style="margin:6px 0 10px">A tela inicial padrão do GLUXO é a mesma para todos e continua completa. O Premium libera a personalização do catálogo da GLUXO Experience. Alertas, lembretes e o protocolo de hipoglicemia seguem gratuitos.${gxhSavedHidden() ? ' Suas personalizações anteriores continuam guardadas e voltam quando o Premium for reativado.' : ''}</p><button type="button" class="btn sm pri" data-act="go" data-r="licenca">Ver o Premium</button></div>`;
const gxhIntro = c => gxhLockCard() + `<p class="hint gxh-in">${esc(GXH_CATS[c].d)}</p><div class="gxh-sum card soft" data-gxh-sum="${c}">${gxhSumHTML(c)}</div>`;
const gxhResetCat = c => `<button type="button" class="btn full gxh-rc" data-gxh-resetcat="${c}">Restaurar a categoria “${esc(GXH_CATS[c].t)}”</button>`;
function gxhCat(c) {
  if (!gxhPers()) return c === 'C' ? mdAlertsPage() : mdGateHTML(GXH_CATS[c].t);   /* Modo Padrão: só os alertas (compartilhados) */
  const C = GXH_CATS[c]; let h = gxhIntro(c);
  const open = gxhPers();
  if (c === 'B' && open && typeof VIEWS.ctxres === 'function') h += '<button type="button" class="btn full" data-act="go" data-r="ctxres" style="margin:12px 0">Ver insights e resumos</button>';
  h += C.fs.map(f => gxhSec(f)).join('');
  if (c === 'B' && open && typeof cxGxExtras === 'function') h += cxGxExtras();
  if (c === 'D' && open) { if (typeof gxoLayoutsCard === 'function') h += gxoLayoutsCard(); if (typeof gxoResetCard === 'function') h += gxoResetCard(); }
  return h + (C.fs.some(f => !gxhLocked(f)) ? gxhResetCat(c) : '');
}
function gxhHub() {
  if (!gxhPers()) return mdAlertsPage();
  const all = Object.keys(GXH_CATS).map(c => gxhCount(c)), on = all.reduce((s, k) => s + k.on, 0), n = all.reduce((s, k) => s + k.n, 0), cv = typeof IC === 'object' && IC.chev ? `<svg class="chv" viewBox="0 0 24 24">${IC.chev}</svg>` : '';
  return gxhLockCard() + `<p class="hint gxh-in">Central de personalização do GLUXO. Escolha uma categoria: cada recurso explica o que muda, mostra uma prévia e salva sozinho neste aparelho.</p>`
    + `<div class="gxh-sum card soft"><b>${on} de ${n}</b> recursos ativos <span class="dim">· tudo é salvo automaticamente</span></div>`
    + `<div class="stack gxh-cats" style="gap:10px;margin-top:12px">${Object.entries(GXH_CATS).map(([c, C]) => { const k = gxhCount(c); return `<button type="button" class="menu-item gxh-cat" data-act="go" data-r="${C.r}"><span class="mi-ic">${gxhSvg(C.ic)}</span><div>${esc(C.t)}<span>${esc(C.d)}</span><span class="gxh-cnt"><b>${k.on} de ${k.n}</b> ativos · ${k.opts} opções</span></div>${cv}</button>`; }).join('')}</div>`
    + '<button type="button" class="btn full" data-gxh-resetall style="margin-top:14px">Restaurar toda a personalização</button>';
}
VIEWS.gxexp = gxhHub; TITLES.gxexp = 'GLUXO Experience';
VIEWS.gxvis = () => gxhCat('A'); TITLES.gxvis = 'Experiência visual';
VIEWS.gxdados = VIEWS.gxctx = () => gxhCat('B'); TITLES.gxdados = TITLES.gxctx = 'Inteligência dos dados';
VIEWS.gxctxc = () => gxhCat('C'); TITLES.gxctxc = 'Experiências contextuais';
VIEWS.gxnav = VIEWS.gxorg = () => gxhCat('D'); TITLES.gxnav = TITLES.gxorg = 'Personalização das informações';
const gxhBack0 = backOf;
backOf = function (r) { return GXH_ALL.includes(r) && r !== 'gxexp' ? 'gxexp' : gxhBack0(r); };

/* ---------- atualização sem redesenhar (mantém foco, rolagem e seções abertas) ---------- */
function gxhRefresh() {
  document.querySelectorAll('details.gxh-sec').forEach(d => {
    const f = d.dataset.gxh; if (!GX_F[f]) return;
    const st = gxhSt(f), b = d.querySelector('[data-gxh-b]'), dep = gxhDepMsg(f), de = d.querySelector('.gxh-dep'), on = gxhAct(f) !== false;
    if (b) { b.className = 'gxh-badge ' + st.cls; b.textContent = st.txt; }
    if (de) { de.hidden = !dep; const s = de.querySelector('span'); if (s) s.textContent = dep; }
    const o = d.querySelector('.gxh-opts'); if (o) o.classList.toggle('is-off', !!(GXH_MASTER[f] || f === 'bubble') && !on);
    d.querySelectorAll('[data-gxh-cmp]').forEach(c => c.classList.toggle('is-on', (c.dataset.gxhCmp === 'on') === on));
  });
  document.querySelectorAll('[data-gxh-fx]').forEach(e => { const [f, k] = e.dataset.gxhFx.split('.'); if (GX_F[f] && GX_F[f].o[k]) e.textContent = gxhFx(f, k); });
  document.querySelectorAll('[data-gxh-sum]').forEach(e => { e.innerHTML = gxhSumHTML(e.dataset.gxhSum); });
}
const gxhChanged0 = gxChanged;
gxChanged = function () { gxhChanged0.apply(this, arguments); try { gxhRefresh(); } catch (e) { console.error(e); } };
document.addEventListener('toggle', e => { const d = e.target; if (d && d.classList && d.classList.contains('gxh-sec')) { if (d.open) gxhOpen.add(d.dataset.gxh); else gxhOpen.delete(d.dataset.gxh); } }, true);
/* a restauração das seções abertas (organização) passa a usar o recurso, não o texto do título */
gxoRe = function () {
  const y = window.scrollY, open = [...document.querySelectorAll('#view details.gxh-sec[open]')].map(d => d.dataset.gxh), others = [...document.querySelectorAll('#view details.gx-sec:not(.gxh-sec)[open] > summary')].map(s => s.textContent);
  open.forEach(f => gxhOpen.add(f)); render();
  document.querySelectorAll('#view details.gx-sec').forEach(d => { if (d.classList.contains('gxh-sec') ? gxhOpen.has(d.dataset.gxh) : others.includes((d.querySelector('summary') || {}).textContent)) d.open = true; });
  window.scrollTo(0, y);
};

/* ---------- restaurar (categoria e tudo) ---------- */
function gxhResetCatDo(c) { const p = gxAll(); GXH_CATS[c].fs.filter(f => !gxhLocked(f)).forEach(f => { delete p[f]; }); gxSave(p); gxChanged(); }   /* recursos travados nunca são restaurados: a configuração guardada fica intacta */
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-gxh-resetcat], [data-gxh-resetall]'); if (!t) return;
  if (t.dataset.gxhResetcat) { const c = t.dataset.gxhResetcat; gxoAsk('Restaurar esta categoria?', `Todas as opções de “${esc(GXH_CATS[c].t)}” voltam ao padrão. Registros e dados clínicos não são alterados.`, () => { gxhResetCatDo(c); toast('Categoria restaurada.'); }); return; }
  gxoAsk('Restaurar toda a personalização?', 'Todas as opções da GLUXO Experience voltam ao padrão. Favoritos, fixados, layouts salvos e registros não são apagados.', () => { const a = gxAll(), p = ['favs', 'ofav', 'opin', 'forder', 'olay'].reduce((m, k) => (a[k] !== undefined && (m[k] = a[k]), m), {}); gxSave(p); gxChanged(); toast('Personalização restaurada.'); });
});

/* ---------- posição ao voltar (hub e categorias) ---------- */
const gxhRender0 = render;
render = function () {
  const prev = gxhLast, cur = VIEWS[S.route] ? S.route : 'painel';
  if (prev && GXH_ALL.includes(prev)) gxhPos[prev] = window.scrollY;
  const back = !!prev && prev !== cur && GXH_ALL.includes(cur) && backOf(prev) === cur, r = gxhRender0.apply(this, arguments);
  gxhLast = VIEWS[S.route] ? S.route : 'painel';
  if (GXH_ALL.includes(cur)) { if (back && gxhPos[cur] != null) { const y = gxhPos[cur]; setTimeout(() => window.scrollTo(0, y), 0); } else if (prev !== cur) delete gxhPos[cur]; }
  return r;
};
