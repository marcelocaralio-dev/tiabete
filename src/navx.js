/* GLUXO Experience 02 · navegação. Usa o mesmo registro de preferências (GX_F, 'tb-gx'). */
const GXN = { new: ['Registrar glicemia', 'drop'], historico: ['Histórico', 'list'], analise: ['Gráficos', 'chart'], relatorios: ['Relatórios', 'file'], insulinas: ['Insulinas', 'pill'], eventos: ['Observações', 'star'], hba1c: ['HbA1c', 'scale'], lembretes: ['Lembretes', 'bell'], backup: ['Backup', 'cloud'], esquemas: ['Medicamentos', 'pill'] };
const gxIcon = k => typeof MI === 'object' && MI[k] ? `<svg viewBox="0 0 24 24">${MI[k]}</svg>` : k === 'historico' ? ic('list') : acSvg(GXN[k][1], 22);
const gxSw = t => [true, t, ''];
GX_F.nav_sc = { t: 'Navegação · Atalhos circulares', o: Object.assign({ on: gxSw('Mostrar no Início'), size: ['normal', 'Tamanho', '', [['normal', 'Normal'], ['small', 'Compacto'], ['grid', 'Em grade']]] }, Object.fromEntries(Object.entries(GXN).map(([k, [t]]) => [k, gxSw(t)]))) };
GX_F.nav_search = { t: 'Navegação · Pesquisa global', o: { on: gxSw('Botão de pesquisa no Início'), live: gxSw('Resultados enquanto digita'), hist: gxSw('Salvar pesquisas recentes'), exam: gxSw('Exames (Premium)'), hba: gxSw('HbA1c'), rec: gxSw('Glicemias e refeições'), ins: gxSw('Insulinas'), ev: gxSw('Observações e eventos'), fn: gxSw('Telas e configurações') } };
GX_F.nav_ptr = { t: 'Navegação · Puxar para atualizar', o: { on: gxSw('Ativar gesto'), painel: gxSw('No Início'), historico: gxSw('No Histórico'), analise: gxSw('Na Análise'), relatorios: gxSw('Nos Relatórios'), style: ['normal', 'Indicador', '', [['normal', 'Normal'], ['compact', 'Compacto']]] } };
function gxPtrOk(r) { document.documentElement.classList.toggle('gx-ptr-compact', gxGet('nav_ptr', 'style') === 'compact'); return gxGet('nav_ptr', 'on') && (!GX_F.nav_ptr.o[r] || gxGet('nav_ptr', r)); }
function gxOrder() { const s = gxhLocked('nav_sc') ? null : (gxAll().nav_sc || {}).order, all = Object.keys(GXN), o = Array.isArray(s) ? s.filter(k => all.includes(k)) : []; return o.concat(all.filter(k => !o.includes(k))); }
function gxNavPrev(f) {
  if (f !== 'nav_sc') return '';
  const l = gxOrder().filter(k => gxGet(f, k));
  return `<b>Ordem</b>` + l.map((k, i) => `<div class="gx-row"><span>${GXN[k][0]}</span>${[[-1, '↑', 'Subir'], [1, '↓', 'Descer']].map(([d, c, t]) => `<button type="button" class="btn sm" data-gx-mv="${k}" data-d="${d}" aria-label="${t} ${GXN[k][0]}"${i + d < 0 || i + d >= l.length ? ' disabled' : ''}>${c}</button>`).join('')}</div>`).join('');
}
function gxNavBar() {
  const s = gxGet('nav_search', 'on') ? '<button type="button" class="btn sm full" data-gxs="open">Pesquisar no GLUXO</button>' : '';
  const l = gxGet('nav_sc', 'on') ? gxOrder().filter(k => gxGet('nav_sc', k)) : [];
  return s + (l.length ? `<nav class="gx-bar ${gxGet('nav_sc', 'size')}" aria-label="Atalhos">${l.map(k => `<button type="button" ${k === 'new' ? 'data-act="new"' : `data-act="go" data-r="${k}"`}><i aria-hidden="true">${gxIcon(k)}</i><span>${GXN[k][0]}</span></button>`).join('')}</nav>` : '');
}
function gxMove(k, d) { const o = gxOrder(), v = o.filter(x => gxGet('nav_sc', x)), other = v[v.indexOf(k) + d]; if (!other) return; const i = o.indexOf(k), j = o.indexOf(other), p = gxAll(); [o[i], o[j]] = [o[j], o[i]]; p.nav_sc = Object.assign({}, p.nav_sc, { order: o }); gxSave(p); }
const gxNorm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
let gxRecent = [];
try { gxRecent = JSON.parse(localStorage.getItem('tb-gxq')) || []; } catch (e) { }
function gxRecentSave() { try { if (gxRecent.length) localStorage.setItem('tb-gxq', JSON.stringify(gxRecent)); else localStorage.removeItem('tb-gxq'); } catch (e) { } }
const gxWipe = wipeData;
wipeData = function (...a) { gxRecent = []; gxRecentSave(); return gxWipe.apply(this, a); };
const gxLic = f => typeof licAllowed === 'function' && licAllowed(f) === true;
function gxFind(q) {
  const w = gxNorm(q).split(/\s+/).filter(Boolean); if (!w.length) return [];
  const hit = t => { const n = gxNorm(t); return w.every(x => n.includes(x)); }, day = d => d ? `${d} ${fmtDate(d)}` : '';
  const newest = a => [...(a || [])].sort((x, y) => String(y.date + (y.time || '')).localeCompare(String(x.date + (x.time || ''))));
  const cats = [
    ['rec', 'Glicemias e refeições', () => newest(S.records).filter(r => hit([day(r.date), r.time, r.glucose, r.context, r.meal, r.note, r.notes, recChips(r).replace(/<[^>]+>/g, ' ')].join(' '))).map(r => [`${fmtDate(r.date)} ${r.time || ''} · ${r.glucose} mg/dL`, 'rec', r.id])],
    ['ins', 'Insulinas', () => newest(S.inslog).filter(x => hit([day(x.date), x.time, x.kind, x.units, x.name, 'insulina'].join(' '))).map(x => [`${fmtDate(x.date)} ${x.time || ''} · ${x.units ?? '—'} U`, 'go', 'insulinas'])],
    ['ev', 'Observações e eventos', () => newest(S.events).filter(x => hit(day(x.date) + ' ' + x.text)).map(x => [`${fmtDate(x.date)} · ${x.text}`, 'go', 'eventos'])],
    ['exam', 'Exames', () => gxLic('exames') ? newest(S.exams).filter(x => hit(day(x.date) + ' ' + JSON.stringify([x.title, x.name, x.lab, x.items]))).map(x => [`${x.date ? fmtDate(x.date) : 'Sem data'} · ${x.title || x.name || x.lab || 'Exame'}`, 'exam', x.id]) : []],
    ['hba', 'HbA1c', () => newest(S.hba).filter(x => hit(`hba1c hemoglobina glicada ${day(x.date)} ${x.value}`)).map(x => [`${fmtDate(x.date)} · HbA1c ${x.value}%`, 'go', 'hba1c'])],
    ['fn', 'Telas, métricas e gráficos', () => Object.entries(TITLES).filter(([r]) => VIEWS[r] && !['exame', 'comparar'].includes(r)).map(([r, t]) => [t, r]).concat([['Gráficos', 'analise']], IN_CARDS.map(c => [c.t + ' (Início)', 'painel'])).filter(([t]) => hit(t)).map(([t, r]) => [t, 'go', r])]];
  return cats.filter(c => gxGet('nav_search', c[0])).map(([, t, f]) => [t, f()]).filter(c => c[1].length);
}
function gxShow(q) {
  const el = document.getElementById('gxs-r'); if (!el) return;
  if (!q.trim()) { const fav = (gxAll().favs || []).map(id => S.records.find(r => r.id === id)).filter(Boolean); el.innerHTML = (fav.length ? '<h3>Favoritos</h3>' + fav.map(r => `<button type="button" class="menu-item" data-gxs="rec" data-id="${esc(r.id)}">${esc(`${fmtDate(r.date)} ${r.time || ''} · ${r.glucose} mg/dL`)}</button>`).join('') : '') + gxGet('nav_search', 'hist') && gxRecent.length ? '<h3>Recentes</h3>' + gxRecent.map(t => `<button type="button" class="btn sm" data-gxs="recent">${esc(t)}</button>`).join('') + '<button type="button" class="btn sm" data-gxs="clear">Limpar histórico</button>' : ''; return; }
  const r = gxFind(q);
  el.innerHTML = r.length ? r.map(([t, l]) => `<h3>${t} (${l.length})</h3>` + l.slice(0, 20).map(([n, k, id]) => `<button type="button" class="menu-item" data-gxs="${k}" data-id="${esc(id)}">${esc(n)}</button>`).join('') + (l.length > 20 ? '<p class="dim">Mostrando os 20 primeiros. Refine a busca.</p>' : '')).join('') : '<p class="dim">Nenhum resultado.</p>';
}
document.addEventListener('input', e => { if (e.target.id === 'gxs-q' && (gxGet('nav_search', 'live') || !e.target.value)) gxShow(e.target.value); });
document.addEventListener('submit', e => { if (e.target.id === 'gxs-f') { e.preventDefault(); gxShow(document.getElementById('gxs-q').value); } });
document.addEventListener('click', e => {
  const m = e.target.closest && e.target.closest('[data-gx-mv]');
  if (m) { gxMove(m.dataset.gxMv, +m.dataset.d); gxChanged(); return; }
  const el = e.target.closest && e.target.closest('[data-gxs]'); if (!el) return;
  const a = el.dataset.gxs, q = document.getElementById('gxs-q');
  if (a === 'open') { openSheet('<h2>Pesquisar</h2><form id="gxs-f" role="search"><input id="gxs-q" type="search" placeholder="Data, valor, observação ou tela" aria-label="Pesquisar no GLUXO" autocomplete="off"></form><div id="gxs-r"></div><button type="button" class="btn full" data-act="close">Fechar</button>'); gxShow(''); document.getElementById('gxs-q').focus(); }
  else if (a === 'recent') { q.value = el.textContent; gxShow(q.value); }
  else if (a === 'clear') { gxRecent = []; gxRecentSave(); gxShow(''); }
  else { if (gxGet('nav_search', 'hist') && q.value.trim()) gxRecent = [q.value.trim(), ...gxRecent.filter(x => x !== q.value.trim())].slice(0, 6); gxRecentSave(); closeSheet(); if (a === 'rec') openRecord(el.dataset.id); else if (a === 'exam') { S.ex.id = el.dataset.id; go('exame'); } else go(el.dataset.id); }
});

/* ---------- Menus contextuais ---------- */
GX_F.nav_menu = { t: 'Navegação · Menus contextuais', o: { on: gxSw('Ativar menus'), long: gxSw('Abrir por pressão longa'), button: gxSw('Botão "Mais opções" nos detalhes'), rec: gxSw('Em registros glicêmicos'), sc: gxSw('Em atalhos'), card: gxSw('Em cards de métricas'), details: gxSw('Ação: detalhes'), edit: gxSw('Ação: editar'), del: gxSw('Ação: excluir'), share: gxSw('Ação: compartilhar'), fav: gxSw('Ação: favoritar') } };
const gxM = k => gxGet('nav_menu', k);
const gxFavs = () => gxAll().favs || [];
function gxTarget(t) {
  if (!gxM('on') || !t || !t.closest || t.closest('#sheet-bg, .pn-ed')) return null;
  let el;
  if ((el = t.closest('.gx-bar button'))) return gxM('sc') ? { type: 'sc', el, k: el.dataset.r || 'new' } : null;
  if ((el = t.closest('[data-act="open"][data-id]'))) return gxM('rec') ? { type: 'rec', el, k: el.dataset.id } : null;
  if ((el = t.closest('#view [data-pm]'))) return gxM('card') ? { type: 'card', el, k: el.dataset.pm } : null;
  return null;
}
let gxCur = null;
function gxMenu(m) {
  const b = (a, t) => `<button type="button" class="btn full" data-gxm="${a}">${t}</button>`; let title, h = '';
  if (m.type === 'rec') {
    const r = S.records.find(x => x.id === m.k); if (!r) return false; title = `${fmtDate(r.date)} ${r.time || ''} · ${r.glucose} mg/dL`;
    h = (gxM('details') ? b('details', 'Consultar detalhes') : '') + (gxM('edit') ? `<button type="button" class="btn full" data-act="edit" data-id="${esc(r.id)}">Editar</button>` : '') + (gxM('share') ? b('share', 'Compartilhar') : '') + (gxM('fav') && !gxhLocked('org_fav') ? b('fav', gxFavs().includes(r.id) ? 'Remover dos favoritos' : 'Favoritar') : '') + (gxM('del') ? `<button type="button" class="btn danger full" data-act="del-ask" data-id="${esc(r.id)}">Excluir</button>` : '');
  } else if (m.type === 'sc') { title = GXN[m.k][0]; h = b('left', 'Mover para a esquerda') + b('right', 'Mover para a direita') + b('remove', 'Remover do Início') + b('config', 'Configurar atalhos'); }
  else { title = inCardT(m.k); h = (gxM('details') ? b('details', 'Consultar detalhes') : '') + (IN_CARDS.some(c => c.k === m.k) ? b('expand', 'Expandir card') : '') + (gxM('share') ? b('share', 'Compartilhar') : '') + b('custom', 'Personalizar o Início'); m.text = m.el.innerText; }
  if (!h) return false;
  gxCur = m; openSheet(`<h2>${esc(title)}</h2><div class="stack" style="gap:8px">${h}<button type="button" class="btn full" data-act="close">Cancelar</button></div>`); return true;
}
async function gxShare(text) {
  try { const P = window.Capacitor?.Plugins?.Share; if (IS_NATIVE && P) await P.share({ title: 'GLUXO', text }); else if (navigator.share) await navigator.share({ title: 'GLUXO', text }); else { await navigator.clipboard.writeText(text); toast('Texto copiado.'); } }
  catch (e) { if (!/abort|cancel/i.test(e.name + e.message)) toast('Não foi possível compartilhar.'); }
}
document.addEventListener('click', e => {
  const el = e.target.closest && e.target.closest('[data-gxm]'); if (!el || !gxCur) return;
  const a = el.dataset.gxm, m = gxCur; closeSheet();
  if (a === 'details') { if (m.type === 'rec') openRecord(m.k); else document.querySelector(`#view [data-pm="${m.k}"]`)?.click(); }
  else if (a === 'share') { const r = S.records.find(x => x.id === m.k); gxShare(m.type === 'rec' ? `Glicemia: ${r.glucose} mg/dL em ${fmtDate(r.date)} ${r.time || ''}` : m.text); }
  else if (a === 'fav') { const p = gxAll(), f = gxFavs(), had = f.includes(m.k); p.favs = had ? f.filter(x => x !== m.k) : [m.k, ...f]; gxSave(p); toast(had ? 'Removido dos favoritos.' : 'Favoritado. Veja na Pesquisa.'); }
  else if (a === 'left' || a === 'right') { gxMove(m.k, a === 'left' ? -1 : 1); render(); }
  else if (a === 'remove') { const p = gxAll(); p.nav_sc = Object.assign({}, p.nav_sc, { [m.k]: false }); gxSave(p); render(); toast('Atalho removido. Reative em Personalização.'); }
  else if (a === 'config') go('gxnav');
  else if (a === 'expand') { inPrefsSave(inSetSize(inPrefs(), m.k, 'x')); inRedraw(null, false); }
  else if (a === 'custom') inEditOn(true);
});
/* pressão longa: qualquer movimento (rolagem, deslize) cancela; o toque curto segue normal */
const gxLP = { t: 0, eat: false };
const gxStop = () => { clearTimeout(gxLP.t); gxLP.t = 0; };
document.addEventListener('pointerdown', e => { gxStop(); gxLP.eat = false; if (e.button || !gxM('long')) return; const m = gxTarget(e.target); if (!m) return; gxLP.x = e.clientX; gxLP.y = e.clientY; gxLP.t = setTimeout(() => { gxLP.t = 0; if (m.el.isConnected && gxMenu(m)) gxLP.eat = true; }, 550); }, true);
document.addEventListener('pointermove', e => { if (gxLP.t && Math.hypot(e.clientX - gxLP.x, e.clientY - gxLP.y) > 10) gxStop(); }, true);
['pointerup', 'pointercancel'].forEach(n => document.addEventListener(n, () => { gxStop(); if (gxLP.eat) setTimeout(() => { gxLP.eat = false; }, 350); }, true));
document.addEventListener('scroll', gxStop, true);
window.addEventListener('click', e => { if (gxLP.eat) { gxLP.eat = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
document.addEventListener('contextmenu', e => { if (!gxM('long')) return; if (gxLP.eat) { e.preventDefault(); return; } const m = gxTarget(e.target); if (m && gxMenu(m)) { e.preventDefault(); if (gxLP.t) gxLP.eat = true; gxStop(); } });
const gxOpenRecord = openRecord;
openRecord = function (id) {
  gxOpenRecord(id); const s = document.querySelector('#sheet-bg .sheet'); if (!s || !gxM('on') || !gxM('button') || !gxM('rec')) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn full'; b.style.marginTop = '10px'; b.textContent = '⋯ Mais opções'; b.onclick = e => { e.stopPropagation(); gxMenu({ type: 'rec', k: id }); }; s.appendChild(b);
};

/* ---------- Gestos (todos têm botão equivalente) ---------- */
GX_F.nav_gest = { t: 'Navegação · Gestos', o: { on: gxSw('Ativar gestos'), tabs: gxSw('Deslizar entre abas'), dismiss: gxSw('Deslizar para dispensar alerta'), period: gxSw('Deslizar no card de período do Início') } };
const gxG = k => gxGet('nav_gest', 'on') && gxGet('nav_gest', k);
let gxSwp = null;
document.addEventListener('touchstart', e => { const t = e.touches[0]; gxSwp = e.touches.length === 1 && e.target.closest ? { x: t.clientX, y: t.clientY, el: e.target } : null; }, { passive: true });
document.addEventListener('touchcancel', () => { gxSwp = null; }, { passive: true });
document.addEventListener('touchend', e => {
  const s = gxSwp; gxSwp = null; if (!s) return;
  const t = e.changedTouches[0], dx = t.clientX - s.x; if (Math.abs(dx) < 80 || Math.abs(t.clientY - s.y) > 40) return;
  const row = s.el.closest('#acp [data-ac-row]'), per = s.el.closest('.in-pc');
  if (row && gxG('dismiss')) { const it = S.ac.items.find(x => x.id === row.dataset.acRow); if (!it || (it.active && gxSafe(it))) return; e.preventDefault(); if (gxGet('list', 'confirm') && !window.confirm('Remover da lista?')) return; acDismiss([it.id]); acTimer(12000); }
  else if (per && gxG('period')) { const b = [...per.querySelectorAll('[data-act="period"]')], n = b[b.findIndex(x => x.getAttribute('aria-pressed') === 'true') + (dx < 0 ? 1 : -1)]; if (n) { e.preventDefault(); n.click(); } }
}, { passive: false });
VIEWS.gxnav = () => gxCard(true); TITLES.gxnav = 'Navegação';
