/* ================= GLUXO Experience 04 · Organização e personalização =================
   Usa o MESMO registro de preferências (GX_F, 'tb-gx') e o MESMO organizador do Início (tb-inicio, inicio.js/inicio-core.js).
   Favoritos, fixados e layouts guardam só referências e preferências: nunca copiam nem alteram registros clínicos.
   Resumo glicêmico (topo) e Central de Métricas (final) continuam estruturais: nada aqui os move, oculta ou duplica. */
const gxoB = (t, s, d) => [d !== false, t, s || ''];
GX_F.org_fav = { t: 'Organização · Favoritos', o: { on: gxoB('Ativar favoritos', 'Estrela para guardar o que você mais usa. Os itens são referências: o conteúdo original não é copiado.'),
  rec: gxoB('Permitir favoritar: registros de glicemia', 'Desmarcar uma categoria esconde os itens dela; eles continuam guardados.'), screen: gxoB('Permitir favoritar: telas e seções'), card: gxoB('Permitir favoritar: cards e indicadores'), food: gxoB('Permitir favoritar: alimentos', 'A estrela fica na lista de alimentos do cálculo de bolus.'), event: gxoB('Permitir favoritar: observações'), goal: gxoB('Permitir favoritar: metas e conquistas'),
  home: gxoB('Seção Favoritos na tela inicial', 'Aparece abaixo do Resumo glicêmico, só quando há favoritos.'), group: ['cat', 'Organização', '', [['cat', 'Por categorias'], ['list', 'Lista única']]], sort: ['manual', 'Ordem', '', [['manual', 'Minha ordem (setas)'], ['date', 'Mais recentes primeiro'], ['alpha', 'Alfabética']]] } };
GX_F.org_pin = { t: 'Organização · Conteúdos fixados', o: { on: gxoB('Ativar conteúdos fixados', 'Mantém o que importa abaixo do Resumo glicêmico. Alertas e avisos de segurança nunca são afetados.'),
  rec: gxoB('Permitir fixar: registros de glicemia'), screen: gxoB('Permitir fixar: telas, relatórios e gráficos'), card: gxoB('Permitir fixar: cards informativos', 'O card fixado vai para o início da lista de cards.'), goal: gxoB('Permitir fixar: metas e conquistas'),
  mode: ['compact', 'Exibição', '', [['compact', 'Compacta'], ['expanded', 'Expandida']]], order: ['pins_first', 'Ordem das seções na tela inicial', '', [['pins_first', 'Fixados, depois Favoritos'], ['favs_first', 'Favoritos, depois Fixados']]] } };
GX_F.org_home = { t: 'Organização · Tela inicial', o: { format: ['grid', 'Formato dos cards', 'Grade (padrão) ou lista em uma coluna.', [['grid', 'Grade'], ['list', 'Lista (uma coluna)']]] } };
GX_F.org_view = { t: 'Organização · Preferências de visualização', o: { density: ['comfort', 'Densidade de conteúdo', 'Espaçamento de cards e listas.', [['compact', 'Compacta'], ['comfort', 'Confortável'], ['expanded', 'Expandida']]],
  hsort: ['date_desc', 'Histórico: ordenação', 'Relevância mostra favoritos e fixados primeiro em cada dia.', [['date_desc', 'Mais recentes primeiro'], ['date_asc', 'Mais antigas primeiro'], ['relevance', 'Relevância (favoritos primeiro)']]],
  hview: ['list', 'Histórico: visualização', '', [['list', 'Lista'], ['cards', 'Cards (duas colunas)']]], hdetail: ['detailed', 'Histórico: detalhes', '', [['detailed', 'Detalhada'], ['summary', 'Resumida']]] } };
const GXO_FG = ['org_home', 'org_view'];   /* grupos de preferências que fazem parte de um layout */
const gxo = (f, k) => gxGet(f, k);
const gxoIc = n => ({ star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/></svg>', pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 3 3v2h-4v6l-1 1-1-1v-6H7v-2l3-3z"/></svg>' }[n]);
const gxoCan = (kind, t) => !gxhLocked(kind === 'fav' ? 'org_fav' : 'org_pin') && gxo(kind === 'fav' ? 'org_fav' : 'org_pin', 'on') && gxo(kind === 'fav' ? 'org_fav' : 'org_pin', t) !== false;
const gxoP = () => gxAll();
const gxoFoodIds = () => ((S.bl && S.bl.foods) || []).filter(f => f && f.fav).map(f => f.id);
const gxoFavs = () => orgFavItems(gxoP(), gxoFoodIds());
const gxoFavVis = () => gxoFavs().filter(i => gxoCan('fav', i.t) && gxoRes(i));
const gxoPinVis = () => orgPins(gxoP()).filter(i => gxoCan('pin', i.t) && gxoRes(i));

/* ---------- resolução: cada referência aponta para o conteúdo original (ou some, se ele não existe mais) ---------- */
function gxoRes(it) {
  const k = it.k;
  if (it.t === 'rec') { const r = S.records.find(x => String(x.id) === k); return r ? { label: `${typeof fn === 'function' ? fn(r.glucose, 1) : r.glucose} mg/dL`, sub: `${fmtDate(r.date)}${r.noTime ? '' : ' ' + r.time}`, ts: r.ts, open: () => openRecord(r.id) } : null; }
  if (it.t === 'screen') return TITLES[k] && VIEWS[k] ? { label: TITLES[k], sub: 'Tela', ts: 0, open: () => go(k) } : null;
  if (it.t === 'card') { const c = IN_CARDS.find(x => x.k === k); return c ? { label: c.t, sub: 'Card do Início', ts: 0, open: () => go('painel') } : null; }
  if (it.t === 'goal') { const g = typeof RW_INFO !== 'undefined' && RW_INFO[k]; return g ? { label: g.t, sub: 'Meta ou conquista', ts: 0, open: () => go('conquistas') } : null; }
  if (it.t === 'event') { const e = (S.events || []).find(x => String(x.id) === k); return e ? { label: String(e.text || 'Observação').slice(0, 60), sub: fmtDate(e.date), ts: new Date((e.date || '') + 'T12:00:00').getTime() || 0, open: () => go('eventos') } : null; }
  if (it.t === 'food') { const f = ((S.bl && S.bl.foods) || []).find(x => String(x.id) === k); return f ? { label: f.name, sub: 'Alimento', ts: 0, open: () => go(VIEWS.bolus ? 'bolus' : 'mais') } : null; }
  return null;
}
/* remove referências quebradas (só depois que os dados foram carregados) */
function gxoSweep() {
  if (!Array.isArray(S.records) || !Array.isArray(S.events)) return 0;
  const r = orgSweep(gxoP(), { rec: new Set(S.records.map(x => String(x.id))), event: new Set(S.events.map(x => String(x.id))), screen: k => TITLES[k] && VIEWS[k], card: new Set(IN_CARDS.map(c => c.k)), goal: new Set(typeof RW_INFO !== 'undefined' ? Object.keys(RW_INFO) : []) });
  if (r.removed) gxSave(r.p); return r.removed;
}
function gxoSet(p) { gxSave(p); gxoApply(); }
function gxoToggleFav(t, k) {
  if (t === 'food') { const f = S.bl.foods.find(x => String(x.id) === String(k)); if (f) { f.fav = !f.fav; blSave(); } return; }
  gxoSet(orgFavToggle(gxoP(), t, k));
}
function gxoTogglePin(t, k) {
  const had = orgIsPin(gxoP(), t, k), p = orgPinToggle(gxoP(), t, k);
  if (!had && !orgIsPin(p, t, k)) { toast(`Limite de ${ORG_MAX_PINS} fixados atingido. Desafixe algum item.`); return false; }
  gxoSet(p); return true;
}

/* ---------- aparência: densidade e formato (classes em <html>, sem reconstruir telas) ---------- */
function gxoApply() {
  const c = document.documentElement.classList, d = gxo('org_view', 'density');
  c.toggle('gxo-d-compact', d === 'compact'); c.toggle('gxo-d-expanded', d === 'expanded'); c.toggle('gxo-home-list', gxo('org_home', 'format') === 'list');
}

/* ---------- botões de favoritar e fixar (cabeçalho das telas e janela do registro) ---------- */
function gxoBtns(t, k, labeled) {
  const f = gxoCan('fav', t), p = gxoCan('pin', t); if (!f && !p) return '';
  const isF = orgIsFav(gxoP(), t, k, gxoFoodIds()), isP = orgIsPin(gxoP(), t, k);
  const b = (a, on, ic, off, onT) => `<button type="button" class="gxo-b${on ? ' on' : ''}${labeled ? ' lb' : ''}" data-gxo="${a}" data-t="${t}" data-k="${esc(k)}" aria-pressed="${on}" aria-label="${on ? onT[1] : off[1]}" title="${on ? onT[1] : off[1]}">${gxoIc(ic)}${labeled ? `<span>${on ? onT[0] : off[0]}</span>` : ''}</button>`;
  return (f ? b('fav', isF, 'star', ['Favoritar', 'Adicionar aos favoritos'], ['Favoritado', 'Remover dos favoritos']) : '') + (p ? b('pin', isP, 'pin', ['Fixar', 'Fixar na tela inicial'], ['Fixado', 'Desafixar da tela inicial']) : '');
}
function gxoSyncBtns() {
  document.querySelectorAll('[data-gxo="fav"][data-t], [data-gxo="pin"][data-t]').forEach(b => {
    const fav = b.dataset.gxo === 'fav', on = fav ? orgIsFav(gxoP(), b.dataset.t, b.dataset.k, gxoFoodIds()) : orgIsPin(gxoP(), b.dataset.t, b.dataset.k), lb = b.classList.contains('lb');
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); const a = fav ? (on ? 'Remover dos favoritos' : 'Adicionar aos favoritos') : (on ? 'Desafixar da tela inicial' : 'Fixar na tela inicial'); b.setAttribute('aria-label', a); b.title = a;
    if (lb) b.querySelector('span').textContent = fav ? (on ? 'Favoritado' : 'Favoritar') : (on ? 'Fixado' : 'Fixar');
  });
}
function gxoPost() {
  try {
    const v = document.getElementById('view'), h = v && v.querySelector('h1.pg');
    if (h && !h.querySelector('.gxo-h') && S.route !== 'painel' && S.route !== 'favoritos' && S.route !== 'gxorg' && TITLES[S.route] && VIEWS[S.route]) { const b = gxoBtns('screen', S.route); if (b) h.insertAdjacentHTML('beforeend', `<span class="gxo-h">${b}</span>`); }
    const sh = document.querySelector('#sheet-bg .sheet');
    if (sh && !sh.querySelector('.gxo-sr')) { const d = sh.querySelector('[data-act="del-ask"][data-id]'), kv = sh.querySelector('dl.kv'); if (d && kv && S.records.some(r => String(r.id) === String(d.dataset.id))) { const b = gxoBtns('rec', d.dataset.id, true); if (b) kv.insertAdjacentHTML('afterend', `<div class="gxo-sr gxo-h">${b}</div>`); } }
  } catch (e) { console.error(e); }
}
let gxoQ = 0;
const gxoSched = () => { if (gxoQ) return; gxoQ = requestAnimationFrame(() => { gxoQ = 0; gxoPost(); }); };
function gxoWatch() {
  const v = document.getElementById('view'); if (!v || typeof MutationObserver !== 'function') return;
  const mo = new MutationObserver(gxoSched); mo.observe(v, { childList: true }); mo.observe(document.body, { childList: true }); gxoSched();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', gxoWatch); else gxoWatch();

/* ---------- Início: seções Fixados e Favoritos (entre o Resumo glicêmico e os cards; a Central de Métricas segue no final) ---------- */
const gxoItem = (it, rm, extra) => { const r = gxoRes(it); return r ? `<div class="gxo-it"><button type="button" class="gxo-open" data-gxo="open" data-t="${it.t}" data-k="${esc(it.k)}"><b>${esc(r.label)}</b><small>${esc(extra || r.sub)}</small></button>${rm ? `<button type="button" class="gxo-x" data-gxo="${rm}" data-t="${it.t}" data-k="${esc(it.k)}" aria-label="${rm === 'pin' ? 'Desafixar' : 'Remover dos favoritos'}: ${esc(r.label)}" title="${rm === 'pin' ? 'Desafixar' : 'Remover dos favoritos'}">✕</button>` : ''}</div>` : ''; };
function gxoGoalSub(k) { try { const e = rwEval()[k], s = e ? e.streak : 0, N = RW_STEPS.find(n => n > s) || RW_STEPS[RW_STEPS.length - 1]; return s > 0 ? `${Math.min(s, N)} de ${N} dias` : 'Meta ou conquista'; } catch (e) { return 'Meta ou conquista'; } }
function gxoHomeHTML() {
  if (gxhLocked('org_pin')) return '';
  gxoSweep();
  const out = {};
  if (gxo('org_pin', 'on')) {
    const pins = gxoPinVis(), cards = pins.filter(i => i.t === 'card'), rest = pins.filter(i => i.t !== 'card');
    if (rest.length || cards.length) {
      const ex = gxo('org_pin', 'mode') === 'expanded';
      out.pins = `<section class="card gxo-sec gxo-pins${ex ? ' ex' : ''}" aria-label="Conteúdos fixados"><div class="row sp"><b>Fixados</b><span class="dim num">${pins.length}</span></div><div class="${ex ? 'gxo-list' : 'gxo-chips'}">${rest.map(i => gxoItem(i, 'pin', i.t === 'goal' ? gxoGoalSub(i.k) : '')).join('')}</div>${cards.length ? `<p class="hint gxo-cn">Cards fixados no topo da lista: ${cards.map(i => esc(gxoRes(i).label)).join(', ')}</p>` : ''}</section>`;
    }
  }
  if (gxo('org_fav', 'on') && gxo('org_fav', 'home')) {
    const f = gxoFavVis(); if (f.length) out.favs = `<section class="card gxo-sec gxo-favs" aria-label="Favoritos"><div class="row sp"><b>Favoritos</b><button type="button" class="gxo-more" data-gxo="goFav">Ver todos (${f.length})</button></div><div class="gxo-list">${f.slice(0, 4).map(i => gxoItem(i, 'fav')).join('')}</div></section>`;
  }
  return gxo('org_pin', 'order') === 'favs_first' ? (out.favs || '') + (out.pins || '') : (out.pins || '') + (out.favs || '');
}
const gxoVP0 = viewPainel;
viewPainel = function () {
  const h = gxoVP0(); if (typeof inEditing === 'function' && inEditing()) return h;
  let add = ''; try { add = gxoHomeHTML(); } catch (e) { console.error(e); }
  const i = h.indexOf('<div class="pn-grid'); return add && i >= 0 ? h.slice(0, i) + add + h.slice(i) : h;
};
VIEWS.painel = viewPainel;
/* card fixado = primeiro da lista de cards (só na leitura; no modo de edição vale a ordem real) */
const gxoIV0 = inVisible;
inVisible = function (p) {
  const v = gxoIV0(p); if (typeof inEditing === 'function' && inEditing()) return v;
  if (gxhLocked('org_pin') || !gxo('org_pin', 'on') || !gxo('org_pin', 'card')) return v;
  const pc = orgPins(gxoP()).filter(i => i.t === 'card' && v.includes(i.k)).map(i => i.k); return pc.length ? pc.concat(v.filter(k => !pc.includes(k))) : v;
};

/* ---------- Histórico: ordenação, visualização e marcação de favoritos/fixados ---------- */
const gxoMarks = () => { const m = {}; orgFavItems(gxoP(), []).forEach(i => { if (i.t === 'rec') m[i.k] = 'f'; }); orgPins(gxoP()).forEach(i => { if (i.t === 'rec') m[i.k] = (m[i.k] || '') + 'p'; }); return m; };
const gxoHI0 = histItems;
histItems = function () { const a = gxoHI0(), m = gxo('org_view', 'hsort'); if (m === 'date_desc') return a; const mk = gxoMarks(); return orgHistSort(a, m, i => i.t === 'r' && mk[String(i.r.id)] ? 1 : 0); };
const gxoHL0 = histListHTML;
histListHTML = function () {
  const s = gxoHL0(); if (!gxoCan('fav', 'rec') && !gxoCan('pin', 'rec')) return s; const mk = gxoMarks(); if (!Object.keys(mk).length) return s;
  return s.replace(/data-act="open" data-id="([^"]+)"/g, (m, id) => mk[id] ? `${m} data-gxo-m="${mk[id]}"` : m);
};
const gxoVH0 = viewHistorico;
viewHistorico = function () { return gxoVH0().replace('<div id="h-list"', `<div id="h-list" class="gxo-hl${gxo('org_view', 'hview') === 'cards' ? ' gxo-cards' : ''}${gxo('org_view', 'hdetail') === 'summary' ? ' gxo-sum' : ''}"`); };
VIEWS.historico = viewHistorico;

/* ---------- Central de favoritos ---------- */
function gxoFavRows(items, sortMode, full) {
  const keys = full.map(orgKey);
  return items.map((it, i) => {
    const r = gxoRes(it), key = orgKey(it), canPin = gxoCan('pin', it.t), pinned = orgIsPin(gxoP(), it.t, it.k), man = sortMode === 'manual';
    return `<div class="gxo-row" data-txt="${esc((r.label + ' ' + r.sub).toLowerCase())}"><button type="button" class="gxo-open" data-gxo="open" data-t="${it.t}" data-k="${esc(it.k)}"><b>${esc(r.label)}</b><small>${esc(r.sub)}</small></button>
      ${man ? `<button type="button" class="gxo-x" data-gxo="favmv" data-key="${esc(key)}" data-d="-1" aria-label="Mover para cima: ${esc(r.label)}"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" class="gxo-x" data-gxo="favmv" data-key="${esc(key)}" data-d="1" aria-label="Mover para baixo: ${esc(r.label)}"${i === items.length - 1 ? ' disabled' : ''}>↓</button>` : ''}
      ${canPin ? `<button type="button" class="gxo-x${pinned ? ' on' : ''}" data-gxo="pin" data-t="${it.t}" data-k="${esc(it.k)}" aria-pressed="${pinned}" aria-label="${pinned ? 'Desafixar' : 'Fixar'}: ${esc(r.label)}" title="${pinned ? 'Desafixar' : 'Fixar na tela inicial'}">${gxoIc('pin')}</button>` : ''}
      <button type="button" class="gxo-x" data-gxo="fav" data-t="${it.t}" data-k="${esc(it.k)}" aria-label="Remover dos favoritos: ${esc(r.label)}" title="Remover dos favoritos">✕</button></div>`;
  }).join('');
}
function viewFav() {
  if (gxhLocked('org_fav')) return mdGateHTML('Favoritos');
  if (!gxo('org_fav', 'on')) return `<div class="card"><b>Favoritos desligados</b><p class="hint">Ative em Mais → GLUXO Experience → Personalização das informações → Favoritos.</p><button type="button" class="btn full" data-gxo="goOrg">Abrir Personalização das informações</button></div>`;
  gxoSweep();
  const sortMode = gxo('org_fav', 'sort'), all = gxoFavs(), vis = all.filter(i => gxoCan('fav', i.t) && gxoRes(i));
  const sel = (f, k, c) => `<select class="in" data-gx="${f}.${k}" aria-label="${GX_F[f].o[k][1]}">${c.map(([v, l]) => `<option value="${v}"${gxo(f, k) === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const head = `<div class="gxo-tools"><input class="in" id="gxo-q" type="search" placeholder="Localizar nos favoritos" aria-label="Localizar nos favoritos"><div class="gxo-sel">${sel('org_fav', 'group', GX_F.org_fav.o.group[3])}${sel('org_fav', 'sort', GX_F.org_fav.o.sort[3])}</div><button type="button" class="btn sm" data-gxo="picker" data-mode="fav">Adicionar favorito</button></div>`;
  if (!vis.length) return head + `<div class="empty gxo-empty"><b>${all.length ? 'Nenhum favorito nas categorias ativas' : 'Nenhum favorito ainda'}</b><p>${all.length ? 'Reative categorias em Personalização das informações → Favoritos.' : 'Toque na estrela de um registro, tela, card, meta ou observação para guardá-lo aqui. Alimentos usam a estrela da lista do cálculo de bolus.'}</p></div>`;
  const fullKeys = all.map(orgKey), lbl = i => gxoRes(i).label, ts = i => gxoRes(i).ts;
  const sorted = sortMode === 'manual' ? vis : orgSort(vis, sortMode, lbl, ts);
  let body;
  if (gxo('org_fav', 'group') === 'list') body = `<div class="gxo-grp">${gxoFavRows(sorted, sortMode, all)}</div>`;
  else body = Object.keys(ORG_CATS).map(c => { const l = sorted.filter(i => i.t === c); return l.length ? `<h2 class="sec gxo-gh">${ORG_CATS[c]} <span class="num dim">${l.length}</span></h2><div class="gxo-grp">${gxoFavRows(l, sortMode, all)}</div>` : ''; }).join('');
  return head + body + '<p class="hint gxo-nomatch" hidden>Nenhum favorito encontrado.</p>';
}
VIEWS.favoritos = viewFav; TITLES.favoritos = 'Favoritos';

/* ---------- Organização (central de configurações) ---------- */
function gxoPinMgr() {
  const l = orgPins(gxoP()).filter(i => gxoCan('pin', i.t)), rows = l.map((it, i) => { const r = gxoRes(it); return r ? `<div class="gxo-row"><span class="gxo-open"><b>${esc(r.label)}</b><small>${esc(ORG_PIN_CATS[it.t])}</small></span><button type="button" class="gxo-x" data-gxo="pinmv" data-i="${i}" data-d="-1" aria-label="Mover para cima: ${esc(r.label)}"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" class="gxo-x" data-gxo="pinmv" data-i="${i}" data-d="1" aria-label="Mover para baixo: ${esc(r.label)}"${i === l.length - 1 ? ' disabled' : ''}>↓</button><button type="button" class="gxo-x" data-gxo="pin" data-t="${it.t}" data-k="${esc(it.k)}" aria-label="Desafixar: ${esc(r.label)}">✕</button></div>` : ''; }).join('');
  return `<div class="gxo-mgr"><div class="gxo-grp">${rows || '<p class="hint">Nada fixado. Use “Fixar conteúdo” ou o botão de fixar nas telas e nos registros.</p>'}</div><div class="gxo-act"><button type="button" class="btn sm" data-gxo="picker" data-mode="pin">Fixar conteúdo</button></div></div>`;
}
function gxoExtra(f) {
  if (f === 'org_fav') return `<div class="gxo-act"><button type="button" class="btn sm" data-gxo="goFav">Abrir central de favoritos</button><button type="button" class="btn sm" data-gxo="picker" data-mode="fav">Adicionar favorito</button></div>`;
  if (f === 'org_pin') return gxoPinMgr();
  if (f === 'org_home') return `<p class="hint">O Resumo glicêmico fica sempre no topo e a Central de Métricas sempre no final: são fixos e não podem ser movidos nem ocultados. Os demais cards podem ser arrastados (ou movidos pelas setas), ocultados e redimensionados.</p><div class="gxo-act"><button type="button" class="btn sm" data-gxo="inedit">Personalizar o Início</button><button type="button" class="btn sm" data-gxo="resetHome">Restaurar disposição original</button></div>`;
  return '';
}
const gxoSnap = () => { const a = gxoP(), org = {}; GXO_FG.forEach(f => { org[f] = {}; Object.keys(GX_F[f].o).forEach(k => { org[f][k] = gxGet(f, k); }); }); return { inicio: inCleanPrefs(inPrefs()), org }; };
const gxoDefSnap = () => { const org = {}; GXO_FG.forEach(f => { org[f] = {}; Object.keys(GX_F[f].o).forEach(k => { org[f][k] = GX_F[f].o[k][0]; }); }); return { inicio: IN_DEF(), org }; };
function gxoDirty() { const o = orgLayouts(gxoP()), base = o.active && o.items[o.active] ? o.items[o.active] : gxoDefSnap(); return !orgSame({ inicio: inCleanPrefs(base.inicio), org: base.org }, gxoSnap()); }
function gxoApplySnap(s) {
  inPrefsSave(inCleanPrefs(s.inicio)); const p = gxoP();
  GXO_FG.forEach(f => { const o = {}; Object.keys(GX_F[f].o).forEach(k => { const v = s.org && s.org[f] ? s.org[f][k] : undefined, d = GX_F[f].o[k]; if (v !== undefined && (d[3] ? d[3].some(x => x[0] === v) : typeof v === 'boolean') && v !== d[0]) o[k] = v; }); if (Object.keys(o).length) p[f] = o; else delete p[f]; });
  gxSave(p); gxoApply();
}
function gxoLayoutsCard() {
  const o = orgLayouts(gxoP()), names = Object.keys(o.items), dirty = gxoDirty();
  const state = o.active ? `Em uso: <b>${esc(o.active)}</b>${dirty ? ' · com alterações não salvas' : ''}` : `Em uso: <b>Layout padrão do GLUXO</b>${dirty ? ' · personalizado (não salvo)' : ''}`;
  const rows = names.map(n => `<div class="gxo-row"><span class="gxo-open"><b>${esc(n)}</b><small>${o.active === n ? (dirty ? 'Em uso, alterado' : 'Em uso') : 'Salvo ' + fmtDate(isoDate(new Date(o.items[n].ts)))}</small></span><button type="button" class="btn sm" data-gxo="layApply" data-n="${esc(n)}">Aplicar</button>${o.active === n && dirty ? `<button type="button" class="btn sm" data-gxo="laySave" data-n="${esc(n)}">Atualizar</button>` : ''}<button type="button" class="gxo-x" data-gxo="layDel" data-n="${esc(n)}" aria-label="Excluir layout ${esc(n)}">✕</button></div>`).join('');
  return `<details class="card gx-sec"><summary>Organização · Layouts e predefinições</summary><p class="hint" style="margin:0 0 8px">${state}. Um layout guarda a disposição do Início, o formato e as preferências de visualização. Registros nunca são alterados.</p>
    <div class="gxo-grp"><div class="gxo-row"><span class="gxo-open"><b>Layout padrão do GLUXO</b><small>Disposição original</small></span><button type="button" class="btn sm" data-gxo="layApply" data-n="">Aplicar</button></div>${rows}</div>
    <form class="gxo-save" data-gxo-form="lay"><input class="in" id="gxo-ln" maxlength="24" placeholder="Nome do novo layout" aria-label="Nome do novo layout" autocomplete="off"><button type="submit" class="btn sm pri"${names.length >= ORG_MAX_LAYOUTS ? ' disabled' : ''}>Salvar layout atual</button></form>${names.length >= ORG_MAX_LAYOUTS ? `<p class="hint">Limite de ${ORG_MAX_LAYOUTS} layouts. Exclua um para salvar outro.</p>` : ''}</details>`;
}
function gxoResetCard() {
  const b = (a, t, s) => `<div class="gxo-row"><span class="gxo-open"><b>${t}</b><small>${s}</small></span><button type="button" class="btn sm" data-gxo="${a}">Restaurar</button></div>`;
  return `<details class="card gx-sec"><summary>Organização · Restaurar configurações</summary><p class="hint" style="margin:0 0 8px">Cada botão restaura só a categoria indicada. Nenhum deles apaga registros de glicemia, exames, insulina ou outros dados clínicos.</p><div class="gxo-grp">
    ${b('resetFav', 'Favoritos', 'Remove a lista e as preferências. Estrelas de alimentos (cálculo de bolus) não mudam.')}${b('resetPin', 'Conteúdos fixados', 'Desafixa tudo e restaura as preferências.')}${b('resetHome', 'Tela inicial', 'Disposição original dos cards, tamanhos e formato.')}${b('resetView', 'Preferências de visualização', 'Densidade e opções do histórico.')}${b('resetLay', 'Layouts salvos', 'Exclui as predefinições salvas.')}${b('resetAll', 'Toda a organização', 'Todas as categorias acima.')}</div></details>`;
}
function viewOrg() { return '<h2 class="sec">Organização · GLUXO Experience</h2>' + ['org_fav', 'org_pin', 'org_home', 'org_view'].map(f => gxSec(f, GX_F[f])).join('') + gxoLayoutsCard() + gxoResetCard(); }
VIEWS.gxorg = viewOrg; TITLES.gxorg = 'Organização';
function gxoPrev() { return ''; }

/* ---------- ações ---------- */
let gxoPend = null;
function gxoAsk(title, text, fn) { gxoPend = fn; openSheet(`<h2>${esc(title)}</h2><p>${text}</p><div class="stack" style="gap:8px"><button type="button" class="btn pri full" data-gxo="yes">Confirmar</button><button type="button" class="btn full" data-act="close">Cancelar</button></div>`); }
function gxoRe() {
  const open = [...document.querySelectorAll('#view details.gx-sec[open] > summary')].map(s => s.textContent), y = window.scrollY;
  render(); document.querySelectorAll('#view details.gx-sec').forEach(d => { if (open.includes(d.querySelector('summary').textContent)) d.open = true; }); window.scrollTo(0, y);
}
function gxoClearGroup(p, groups) { groups.forEach(f => delete p[f]); return p; }
const GXO_RESET = {
  resetFav: ['Restaurar favoritos?', 'A lista de favoritos e as preferências dela voltam ao padrão. Os registros e demais conteúdos não são alterados.', () => { const p = gxoClearGroup(gxoP(), ['org_fav', 'favs', 'ofav', 'forder']); gxoSet(p); }],
  resetPin: ['Restaurar conteúdos fixados?', 'Tudo é desafixado e as preferências voltam ao padrão. Nenhum conteúdo é apagado.', () => { gxoSet(gxoClearGroup(gxoP(), ['org_pin', 'opin'])); }],
  resetHome: ['Restaurar a tela inicial?', 'A disposição, os tamanhos e os cards ocultos voltam ao padrão. Resumo glicêmico e Central de Métricas continuam fixos.', () => { inPrefsSave(IN_DEF()); gxoSet(gxoClearGroup(gxoP(), ['org_home'])); }],
  resetView: ['Restaurar visualização?', 'Densidade e opções do histórico voltam ao padrão.', () => { gxoSet(gxoClearGroup(gxoP(), ['org_view'])); }],
  resetLay: ['Excluir os layouts salvos?', 'As predefinições salvas serão excluídas. O layout atual continua como está.', () => { gxoSet(gxoClearGroup(gxoP(), ['olay'])); }],
  resetAll: ['Restaurar toda a organização?', 'Favoritos, fixados, tela inicial, visualização e layouts voltam ao padrão. Registros e dados clínicos não são alterados.', () => { inPrefsSave(IN_DEF()); gxoSet(gxoClearGroup(gxoP(), ['org_fav', 'favs', 'ofav', 'forder', 'org_pin', 'opin', 'org_home', 'org_view', 'olay'])); }]
};
function gxoPicker(mode) {
  const kind = mode === 'pin' ? 'pin' : 'fav', p = gxoP(), cats = kind === 'pin' ? ORG_PIN_CATS : ORG_CATS, on = (t, k) => kind === 'pin' ? orgIsPin(p, t, k) : orgIsFav(p, t, k, gxoFoodIds());
  const sections = [];
  if (gxoCan(kind, 'screen')) sections.push(['screen', Object.entries(TITLES).filter(([r]) => VIEWS[r] && !['painel', 'favoritos', 'gxorg', 'exame', 'comparar', 'metrica'].includes(r) && (r !== 'exames' || gxLic('exames'))).map(([r, t]) => [r, t, '']).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))]);
  if (gxoCan(kind, 'card')) sections.push(['card', IN_CARDS.map(c => [c.k, c.t, ''])]);
  if (gxoCan(kind, 'goal') && typeof RW_INFO !== 'undefined') sections.push(['goal', Object.keys(RW_INFO).map(k => [k, RW_INFO[k].t, ''])]);
  if (gxoCan(kind, 'event') && kind === 'fav') sections.push(['event', (S.events || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 15).map(e => [String(e.id), String(e.text || 'Observação').slice(0, 60), fmtDate(e.date)])]);
  if (gxoCan(kind, 'rec')) sections.push(['rec', S.records.filter(r => !isEx(r)).slice().sort((a, b) => b.ts - a.ts).slice(0, 15).map(r => [String(r.id), `${r.glucose} mg/dL`, `${fmtDate(r.date)}${r.noTime ? '' : ' ' + r.time}`])]);
  const body = sections.map(([t, l]) => l.length ? `<h3>${cats[t]}</h3>` + l.map(([k, n, s]) => `<button type="button" class="menu-item gxo-pk${on(t, k) ? ' on' : ''}" data-gxo="${kind}" data-t="${t}" data-k="${esc(k)}" data-pick="1" aria-pressed="${on(t, k)}"><b>${esc(n)}</b>${s ? `<small>${esc(s)}</small>` : ''}<span class="gxo-ck" aria-hidden="true">${on(t, k) ? '✓' : '+'}</span></button>`).join('') : '').join('');
  openSheet(`<h2>${kind === 'pin' ? 'Fixar conteúdo' : 'Adicionar favorito'}</h2><input class="in" id="gxo-pq" type="search" placeholder="Localizar" aria-label="Localizar" autocomplete="off"><div id="gxo-pl" class="gxo-pl">${body || '<p class="hint">Nenhuma categoria ativa. Ative em Personalização das informações.</p>'}</div><button type="button" class="btn full" data-act="close">Concluir</button>`);
}
document.addEventListener('input', e => {
  const t = e.target; if (t.id === 'gxo-q') { const q = t.value.trim().toLowerCase(); let n = 0; document.querySelectorAll('.gxo-row[data-txt]').forEach(r => { const h = !!q && !r.dataset.txt.includes(q); r.hidden = h; if (!h) n++; }); const m = document.querySelector('.gxo-nomatch'); if (m) m.hidden = n > 0; }
  if (t.id === 'gxo-pq') { const q = t.value.trim().toLowerCase(); document.querySelectorAll('#gxo-pl .gxo-pk').forEach(b => { b.hidden = !!q && !b.textContent.toLowerCase().includes(q); }); }
});
document.addEventListener('submit', e => {
  if (!e.target.matches || !e.target.matches('[data-gxo-form="lay"]')) return; e.preventDefault();
  const n = orgLayoutName(document.getElementById('gxo-ln').value); if (!n) { toast('Informe um nome para o layout.'); return; }
  const o = orgLayouts(gxoP()), save = () => { gxSave(orgLayoutSave(gxoP(), n, gxoSnap())); toast('Layout salvo.'); gxoRe(); };
  if (o.items[n]) gxoAsk('Substituir layout?', `Já existe um layout chamado “${esc(n)}”. Ele será atualizado com a organização atual.`, save); else save();
});
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-gxo]'); if (!b) return;
  const a = b.dataset.gxo, t = b.dataset.t, k = b.dataset.k;
  if (a === 'open') { const r = gxoRes({ t, k }); if (r) { if (document.getElementById('sheet-bg')) closeSheet(); r.open(); } return; }
  if (a === 'fav') { const had = orgIsFav(gxoP(), t, k, gxoFoodIds()); gxoToggleFav(t, k); toast(had ? 'Removido dos favoritos.' : 'Favoritado. Veja em Favoritos.'); if (b.dataset.pick) gxoPickerSync(b); else if (b.classList.contains('gxo-x') && !b.classList.contains('gxo-b')) gxoRe(); else gxoSyncBtns(); return; }
  if (a === 'pin') { const had = orgIsPin(gxoP(), t, k); if (!gxoTogglePin(t, k)) return; toast(had ? 'Desafixado da tela inicial.' : 'Fixado na tela inicial.'); if (b.dataset.pick) gxoPickerSync(b); else if (b.classList.contains('gxo-x')) gxoRe(); else gxoSyncBtns(); return; }
  if (a === 'favmv') { const mode = gxo('org_fav', 'sort'), vis = gxoFavVis(), grp = gxo('org_fav', 'group') === 'list' ? vis : vis.filter(i => i.t === (b.dataset.key || '').split(':')[0]); gxoSet(orgMove(gxoP(), gxoFavs().map(orgKey), grp.map(orgKey), b.dataset.key, +b.dataset.d)); gxoRe(); return; }
  if (a === 'pinmv') { gxoSet(orgPinMove(gxoP(), +b.dataset.i, +b.dataset.d)); gxoRe(); return; }
  if (a === 'goFav') { go('favoritos'); return; }
  if (a === 'goOrg') { go('gxorg'); return; }
  if (a === 'picker') { gxoPicker(b.dataset.mode); return; }
  if (a === 'inedit') { go('painel'); setTimeout(() => inEditOn(true), 0); return; }
  if (a === 'yes') { const f = gxoPend; gxoPend = null; closeSheet(); if (f) f(); return; }
  if (GXO_RESET[a]) { const [ti, tx, fn2] = GXO_RESET[a]; gxoAsk(ti, tx, () => { fn2(); toast('Organização restaurada.'); gxoRe(); }); return; }
  if (a === 'layApply') {
    const n = b.dataset.n, o = orgLayouts(gxoP()), snap = n ? o.items[n] : gxoDefSnap(); if (!snap) return;
    const go2 = () => { gxoApplySnap(snap); gxSave(orgLayoutActive(gxoP(), n || null)); toast('Layout aplicado.'); gxoRe(); };
    if (gxoDirty()) gxoAsk('Descartar alterações?', 'A organização atual tem alterações que não foram salvas em um layout. Ao aplicar, elas serão descartadas (nenhum registro é alterado).', go2); else go2(); return;
  }
  if (a === 'laySave') { gxSave(orgLayoutSave(gxoP(), b.dataset.n, gxoSnap())); toast('Layout atualizado.'); gxoRe(); return; }
  if (a === 'layDel') { const n = b.dataset.n; gxoAsk('Excluir layout?', `O layout “${esc(n)}” será excluído. A organização atual não muda.`, () => { gxSave(orgLayoutDelete(gxoP(), n)); toast('Layout excluído.'); gxoRe(); }); return; }
});
function gxoPickerSync(b) { const kind = b.dataset.gxo, on = kind === 'pin' ? orgIsPin(gxoP(), b.dataset.t, b.dataset.k) : orgIsFav(gxoP(), b.dataset.t, b.dataset.k, gxoFoodIds()); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); const c = b.querySelector('.gxo-ck'); if (c) c.textContent = on ? '✓' : '+'; }
/* exclusão de conteúdo: limpa as referências dele (favoritos e fixados) logo depois */
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-act^="del-do"]')) setTimeout(() => { if (gxoSweep() && ['favoritos', 'painel', 'gxorg'].includes(S.route)) render(); }, 700); }, true);
const gxoCh0 = gxChanged;
gxChanged = function () { gxoCh0.apply(this, arguments); gxoApply(); if (S.route === 'favoritos' || S.route === 'painel' || S.route === 'historico') render(); };
gxoApply();
