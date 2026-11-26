/* ================= Organização (GLUXO Experience 04): lógica pura, sem DOM =================
   Recebe o objeto de preferências do registro único (gxAll(), chave 'tb-gx') e devolve um objeto novo; nunca grava sozinho.
   Guarda apenas REFERÊNCIAS (tipo + chave): registros, cards, telas e metas continuam onde sempre estiveram, sem cópias.
   Campos usados dentro do mesmo registro de preferências:
     favs   (já existia) ids de registros favoritos        ofav   [{t,k}] favoritos de telas, cards, metas e observações
     forder ['t:k',…] ordem manual dos favoritos            opin   [{t,k}] conteúdos fixados, na ordem escolhida
     olay   { active, items:{ nome:{ inicio, org, ts } } }  layouts salvos
   Alimentos favoritos continuam sendo o marcador "fav" do próprio alimento (bolus); aqui só são listados. */
const ORG_CATS = { rec: 'Registros de glicemia', screen: 'Telas e seções', card: 'Cards e indicadores', food: 'Alimentos', event: 'Observações', goal: 'Metas e conquistas' };
const ORG_PIN_CATS = { rec: 'Registros de glicemia', screen: 'Telas, relatórios e gráficos', card: 'Cards informativos', goal: 'Metas e conquistas' };
const ORG_MAX_LAYOUTS = 6, ORG_MAX_PINS = 12;
const orgKey = it => it.t + ':' + it.k;
const orgStr = v => (typeof v === 'string' || typeof v === 'number') && String(v) !== '' ? String(v) : null;
const orgList = (v, cats) => (Array.isArray(v) ? v : []).filter(x => x && cats[x.t] && orgStr(x.k)).map(x => ({ t: x.t, k: String(x.k) }));
const orgUniq = l => { const s = new Set(); return l.filter(x => { const k = orgKey(x); if (s.has(k)) return false; s.add(k); return true; }); };

/* Favoritos: registros (campo antigo "favs") + demais tipos (ofav) + alimentos marcados. Ordem: a manual (forder) primeiro; o resto por categoria. */
function orgFavItems(p, foodIds) {
  p = p || {};
  const recs = (Array.isArray(p.favs) ? p.favs : []).filter(orgStr).map(k => ({ t: 'rec', k: String(k) }));
  const oth = orgList(p.ofav, ORG_CATS).filter(x => x.t !== 'rec' && x.t !== 'food');
  const foods = (foodIds || []).filter(orgStr).map(k => ({ t: 'food', k: String(k) }));
  const base = orgUniq(recs.concat(oth, foods)), cat = Object.keys(ORG_CATS);
  const idx = new Map((Array.isArray(p.forder) ? p.forder : []).map((k, i) => [k, i]));
  const def = base.map((x, i) => ({ x, i })).sort((a, b) => cat.indexOf(a.x.t) - cat.indexOf(b.x.t) || a.i - b.i).map(o => o.x);
  const man = def.filter(x => idx.has(orgKey(x))).sort((a, b) => idx.get(orgKey(a)) - idx.get(orgKey(b)));
  return man.concat(def.filter(x => !idx.has(orgKey(x))));
}
const orgIsFav = (p, t, k, foodIds) => orgFavItems(p, foodIds).some(x => x.t === t && x.k === String(k));
/* Liga/desliga um favorito (alimentos usam o marcador do próprio alimento, não esta função). */
function orgFavToggle(p, t, k) {
  const q = Object.assign({}, p || {}); k = String(k);
  if (t === 'rec') { const f = (q.favs || []).filter(orgStr); q.favs = f.includes(k) ? f.filter(x => x !== k) : [k].concat(f); }
  else if (ORG_CATS[t] && t !== 'food') { const f = orgList(q.ofav, ORG_CATS), had = f.some(x => x.t === t && x.k === k); q.ofav = had ? f.filter(x => !(x.t === t && x.k === k)) : [{ t, k }].concat(f); }
  if (q.favs && !q.favs.length) delete q.favs; if (q.ofav && !q.ofav.length) delete q.ofav;
  return q;
}
/* Move um item uma posição dentro do grupo exibido (groupKeys, na ordem em tela) e grava a ordem completa em forder. */
function orgMove(p, fullKeys, groupKeys, key, dir) {
  const q = Object.assign({}, p || {}), g = groupKeys.indexOf(key), n = g + dir;
  if (g < 0 || n < 0 || n >= groupKeys.length) return q;
  const full = fullKeys.slice(), a = full.indexOf(key), b = full.indexOf(groupKeys[n]);
  if (a < 0 || b < 0) return q;
  [full[a], full[b]] = [full[b], full[a]]; q.forder = full; return q;
}
/* Fixados: lista própria, ordem escolhida, no máximo ORG_MAX_PINS. */
const orgPins = p => orgUniq(orgList((p || {}).opin, ORG_PIN_CATS));
const orgIsPin = (p, t, k) => orgPins(p).some(x => x.t === t && x.k === String(k));
function orgPinToggle(p, t, k) {
  const q = Object.assign({}, p || {}); k = String(k); if (!ORG_PIN_CATS[t]) return q;
  const l = orgPins(q), had = l.some(x => x.t === t && x.k === k);
  if (!had && l.length >= ORG_MAX_PINS) return q;
  q.opin = had ? l.filter(x => !(x.t === t && x.k === k)) : l.concat({ t, k }); if (!q.opin.length) delete q.opin; return q;
}
function orgPinMove(p, i, dir) { const q = Object.assign({}, p || {}), l = orgPins(q), j = i + dir; if (i < 0 || j < 0 || j >= l.length) return q; [l[i], l[j]] = [l[j], l[i]]; q.opin = l; return q; }
/* Remove referências cujo conteúdo não existe mais (registro apagado, meta ou card que saiu do catálogo). ctx = { rec:Set, event:Set, screen:fn, card:Set, goal:Set }. */
function orgSweep(p, ctx) {
  const q = Object.assign({}, p || {}); let n = 0;
  const live = it => it.t === 'rec' ? ctx.rec.has(it.k) : it.t === 'event' ? ctx.event.has(it.k) : it.t === 'screen' ? !!ctx.screen(it.k) : it.t === 'card' ? ctx.card.has(it.k) : it.t === 'goal' ? ctx.goal.has(it.k) : true;
  if (Array.isArray(q.favs)) { const f = q.favs.filter(k => ctx.rec.has(String(k))); n += q.favs.length - f.length; if (f.length) q.favs = f; else delete q.favs; }
  if (Array.isArray(q.ofav)) { const o = orgList(q.ofav, ORG_CATS), f = o.filter(live); n += q.ofav.length - f.length; if (f.length) q.ofav = f; else delete q.ofav; }
  if (Array.isArray(q.opin)) { const o = orgPins(q), f = o.filter(live); n += q.opin.length - f.length; if (f.length) q.opin = f; else delete q.opin; }
  if (Array.isArray(q.forder)) { const keep = new Set(orgFavItems(q, null).map(orgKey)); q.forder = q.forder.filter(k => keep.has(k) || String(k).startsWith('food:')); if (!q.forder.length) delete q.forder; }
  return { p: q, removed: n };
}
/* Ordenação de listas: manual (como está), data (mais novo primeiro) ou alfabética. */
function orgSort(items, mode, label, ts) {
  if (mode === 'alpha') return items.slice().sort((a, b) => String(label(a)).localeCompare(String(label(b)), 'pt-BR', { sensitivity: 'base' }));
  if (mode === 'date') return items.map((x, i) => ({ x, i, t: ts(x) })).sort((a, b) => (b.t || 0) - (a.t || 0) || a.i - b.i).map(o => o.x);
  return items.slice();
}
/* Histórico: 'date_desc' (padrão), 'date_asc' ou 'relevance' (favoritos e fixados primeiro dentro de cada dia). Só reordena a lista exibida. */
function orgHistSort(items, mode, isMarked) {
  const a = items.slice();
  if (mode === 'date_asc') return a.sort((x, y) => x.ts - y.ts);
  if (mode === 'relevance') return a.sort((x, y) => (y.date > x.date ? 1 : y.date < x.date ? -1 : 0) || (isMarked(y) - isMarked(x)) || y.ts - x.ts);
  return a;
}

/* Layouts salvos (predefinições): guardam só preferências de organização, nunca registros. */
const orgLayoutName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 24);
const orgLayouts = p => { const o = (p || {}).olay; return o && o.items && typeof o.items === 'object' ? o : { active: null, items: {} }; };
function orgLayoutSave(p, name, snap) {
  const q = Object.assign({}, p || {}), o = orgLayouts(q), n = orgLayoutName(name); if (!n) return q;
  if (!o.items[n] && Object.keys(o.items).length >= ORG_MAX_LAYOUTS) return q;
  q.olay = { active: n, items: Object.assign({}, o.items, { [n]: { inicio: snap.inicio, org: snap.org, ts: Date.now() } }) }; return q;
}
function orgLayoutDelete(p, name) {
  const q = Object.assign({}, p || {}), o = orgLayouts(q); if (!o.items[name]) return q;
  const it = Object.assign({}, o.items); delete it[name];
  if (Object.keys(it).length) q.olay = { active: o.active === name ? null : o.active, items: it }; else delete q.olay; return q;
}
const orgLayoutActive = (p, name) => { const q = Object.assign({}, p || {}), o = orgLayouts(q); if (name && !o.items[name]) return q; q.olay = { active: name || null, items: o.items }; if (!name && !Object.keys(o.items).length) delete q.olay; return q; };
const orgStable = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((m, y) => (m[y] = x[y], m), {}) : x);
const orgSame = (a, b) => orgStable(a) === orgStable(b);
if (typeof module !== 'undefined') module.exports = { ORG_CATS, ORG_PIN_CATS, ORG_MAX_LAYOUTS, ORG_MAX_PINS, orgKey, orgFavItems, orgIsFav, orgFavToggle, orgMove, orgPins, orgIsPin, orgPinToggle, orgPinMove, orgSweep, orgSort, orgHistSort, orgLayoutName, orgLayouts, orgLayoutSave, orgLayoutDelete, orgLayoutActive, orgSame };
