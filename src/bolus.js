/* ================= Cálculo de bolus (alimentos, refeições e registro por dia) =================
   Regra configurada pela própria pessoa: 1 Ui cobre X g de carboidrato líquido, arredondando para Ui inteira, sem fator de correção.
   O app não olha a glicemia para sugerir dose. Confira sempre antes de aplicar e siga o plano do seu médico. */
const BL_PUBLIC = !!window.TB_PUBLIC; /* versão pública (APK): sem alimentos, refeições nem razão pré-definidos */
/* Razão insulina/carboidrato: a geral (S.bl.ratio) vale para todo período, e cada período pode ter a sua (S.bl.ratios[id]). São sempre digitadas pela pessoa. */
const blRatioOf = id => { const r = S.bl.ratios && S.bl.ratios[id]; return r >= 1 && r <= 200 ? r : (S.bl.ratio >= 1 ? S.bl.ratio : null); };
const blRule = id => id ? blRatioOf(id) != null : (S.bl.ratio >= 1 || BL_MEALS.some(m => blRatioOf(m.id) != null));
const BL_MEALS = [
  { id: 'cafe', name: 'Café da manhã', short: 'Café', ic: 'cafe' },
  { id: 'almoco', name: 'Almoço', short: 'Almoço', ic: 'almoco' },
  { id: 'jantar', name: 'Jantar', short: 'Jantar', ic: 'jantar' },
  { id: 'lanche', name: 'Lanches', short: 'Lanches', ic: 'lanche' }
];
const BL_FOODS = [
  { id: 'leite', name: 'Leite em pó integral Itambé', basis: 'g', unit: 'g', kcal: 129 / 26 * 100, carb: 10 / 26 * 100, prot: 6.5 / 26 * 100, fat: 7 / 26 * 100, fiber: 0, est: false },
  { id: 'whey', gpu: 30, name: 'Whey Muscle Up', basis: 'un', unit: 'dose', kcal: 115, carb: 3.6, prot: 24, fat: 1.5, fiber: 0, est: true },
  { id: 'linhaca', gpu: 10, name: 'Farinha de linhaça', basis: 'un', unit: 'colher de sopa', kcal: 50, carb: 4.3, prot: 1.4, fat: 3.2, fiber: 3.4, est: true },
  { id: 'chia', gpu: 12, name: 'Semente de chia', basis: 'un', unit: 'colher de sopa', kcal: 58, carb: 5, prot: 2, fat: 3.7, fiber: 4.1, est: true },
  { id: 'psyllium', name: 'Psyllium', basis: 'g', unit: 'g', kcal: 200, carb: 80, prot: 2, fat: 0.5, fiber: 75, est: true },
  { id: 'pao', gpu: 50, name: 'Pão francês', basis: 'un', unit: 'un', kcal: 150, carb: 29.3, prot: 4, fat: 1.6, fiber: 1.2, est: true },
  { id: 'ovo', gpu: 50, name: 'Ovo', basis: 'un', unit: 'un', kcal: 72, carb: 0.4, prot: 6.3, fat: 4.8, fiber: 0, est: true },
  { id: 'margarina', gpu: 5, name: 'Margarina', basis: 'un', unit: 'colher de chá', kcal: 36, carb: 0, prot: 0, fat: 4, fiber: 0, est: true },
  { id: 'arroz', name: 'Arroz parboilizado cozido', basis: 'g', unit: 'g', kcal: 123, carb: 26, prot: 2.6, fat: 0.3, fiber: 1, est: true },
  { id: 'feijao', name: 'Feijão de corda cozido', basis: 'g', unit: 'g', kcal: 80, carb: 14, prot: 5.5, fat: 0.5, fiber: 4.5, est: true },
  { id: 'macarrao', name: 'Macarrão Bonsabor pronto', basis: 'g', unit: 'g', kcal: 127, carb: 27, prot: 3.6, fat: 0.5, fiber: 1.1, est: false },
  { id: 'frango', name: 'Sobrecoxa de frango frita', basis: 'g', unit: 'g', kcal: 260, carb: 0, prot: 26, fat: 17, fiber: 0, est: true },
  { id: 'arroz-leite', name: 'Arroz de leite (sem açúcar)', basis: 'g', unit: 'g', kcal: 110, carb: 17, prot: 3, fat: 3, fiber: 0.5, est: true }
];
const BL_TPL = {
  cafe: [{ f: 'leite', q: 37 }, { f: 'whey', q: 1 }, { f: 'linhaca', q: 1 }, { f: 'chia', q: 1 }, { f: 'psyllium', q: 4 }, { f: 'pao', q: 2 }, { f: 'ovo', q: 1 }, { f: 'margarina', q: 0.5 }],
  almoco: [{ f: 'arroz', q: 100 }, { f: 'feijao', q: 125 }, { f: 'macarrao', q: 275 }], jantar: [], lanche: []
};
const blClone = o => JSON.parse(JSON.stringify(o));
function blDefault() { if (BL_PUBLIC) return { v: 1, ratio: null, bolusOn: { cafe: true, almoco: true, jantar: false, lanche: false }, foods: [], tpl: { sem: { cafe: [], almoco: [], jantar: [], lanche: [] }, fds: { cafe: [], almoco: [], jantar: [], lanche: [] } }, days: {}, meals: [], ratios: {}, rhist: [], rlog: [] };
  return { v: 1, ratio: 15, bolusOn: { cafe: true, almoco: true, jantar: false, lanche: false }, foods: blClone(BL_FOODS), tpl: { sem: blClone(BL_TPL), fds: blClone(BL_TPL) }, days: {}, meals: [], ratios: {}, rhist: [], rlog: [] }; }
S.bl = blDefault();
S.blUi = { tab: 'cafe', date: null, pend: null, busy: false, msg: {} };
let blTimer = null;
function blSave() { clearTimeout(blTimer); blTimer = setTimeout(blFlush, 120); }
function blFlush() { clearTimeout(blTimer); try { Store.put('meta', { id: 'bolus', value: S.bl }); } catch (e) { } }
document.addEventListener('visibilitychange', () => { if (document.hidden) blFlush(); });
window.addEventListener('pagehide', blFlush);
function blHasData() { return Object.keys(S.bl.days || {}).length > 0 || (S.bl.meals || []).length > 0 || (S.bl.rlog || []).length > 0; }
function blCleanMeals(l) { return (Array.isArray(l) ? l : []).filter(m => m && typeof m.id === 'string' && typeof m.ts === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(m.date) && typeof m.net === 'number').map(m => ({ id: m.id, ts: m.ts, date: m.date, time: String(m.time || '').slice(0, 5), meal: BL_MEALS.some(x => x.id === m.meal) ? m.meal : 'lanche', net: m.net, carb: +m.carb || 0, fiber: +m.fiber || 0, prot: +m.prot || 0, fat: +m.fat || 0, kcal: +m.kcal || 0, ui: typeof m.ui === 'number' ? m.ui : null, ratio: +m.ratio || null })); }
function blLoad(v) {
  if (!v || typeof v !== 'object' || !Array.isArray(v.foods) || !v.tpl || typeof v.tpl !== 'object') return;
  const d = blDefault(), ok = x => x && typeof x === 'object';
  S.bl = { v: 1, ratio: v.ratio >= 1 && v.ratio <= 200 ? v.ratio : (BL_PUBLIC ? null : 15), bolusOn: { ...d.bolusOn, ...(ok(v.bolusOn) ? v.bolusOn : {}) }, foods: v.foods.filter(f => f && f.id && typeof f.name === 'string'), tpl: { sem: ok(v.tpl.sem) ? v.tpl.sem : d.tpl.sem, fds: ok(v.tpl.fds) ? v.tpl.fds : d.tpl.fds }, days: ok(v.days) ? v.days : {}, meals: blCleanMeals(v.meals), ratios: blCleanRatios(v.ratios), rhist: blCleanRhist(v.rhist), rlog: blCleanRlog(v.rlog) };
}
const blToday = () => isoDate(new Date());
const blDate = () => S.blUi.date || blToday();
function blAdd(d, n) { const [y, m, dd] = d.split('-').map(Number); return isoDate(new Date(y, m - 1, dd + n)); }
function blWeekend(d) { const [y, m, dd] = d.split('-').map(Number), g = new Date(y, m - 1, dd).getDay(); return g === 0 || g === 6; }
const blTpl = d => blWeekend(d) ? S.bl.tpl.fds : S.bl.tpl.sem;
function blM(w) { const d = blDate(); if (S.bl.days[d]) return S.bl.days[d]; const m = blClone(blTpl(d)); if (w) { S.bl.days[d] = m; const el = $('#bl-dstat'); if (el) { el.textContent = 'Registrado'; el.classList.add('on'); } } return m; }
function blEach(fn) { Object.values(S.bl.days).forEach(fn); fn(S.bl.tpl.sem); fn(S.bl.tpl.fds); }
const blFood = id => S.bl.foods.find(f => f.id === id) || null;
const blUnit = f => f.basis === 'g' ? 'g' : (f.unit || 'un');
const blMeal = id => BL_MEALS.find(m => m.id === id);
const blN = (v, d = 1) => (v == null || isNaN(v)) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
function blCalc(it) {
  const f = blFood(it.f); if (!f) return null;
  const k = f.basis === 'g' ? it.q / 100 : (it.u === 'g' && f.gpu > 0 ? it.q / f.gpu : it.q);
  const carb = f.carb * k, fiber = f.fiber * k;
  return { f, q: it.q, carb, fiber, net: Math.max(0, carb - fiber), prot: f.prot * k, fat: f.fat * k, kcal: f.kcal * k };
}
function blSum(id, mm) {
  const t = { carb: 0, fiber: 0, net: 0, prot: 0, fat: 0, kcal: 0, est: false, rows: [] };
  ((mm || blM())[id] || []).forEach(it => { const c = blCalc(it); if (!c) return; t.rows.push(c); ['carb', 'fiber', 'net', 'prot', 'fat', 'kcal'].forEach(k => t[k] += c[k]); if (c.f.est) t.est = true; });
  return t;
}
const blDose = (net, id) => blRule(id) ? Math.round(net / blRatioOf(id)) : 0;
const blOn = id => !!S.bl.bolusOn[id];
const blIc = k => `<svg class="mi" viewBox="0 0 24 24" aria-hidden="true">${k === 'razao' ? '<path d="M5 19L19 5M7.5 8.5a2 2 0 100-4 2 2 0 000 4zM16.5 19.5a2 2 0 100-4 2 2 0 000 4z"/>' : k === 'dia' ? '<path d="M5 20V10M12 20V4M19 20v-7"/>' : k === 'alimentos' ? '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>' : MIC[k]}</svg>`;


/* ---- Refeição feita: card no histórico (sem lista de alimentos) ---- */
const blMeals = () => S.bl.meals || (S.bl.meals = []);
function histMealItems() {
  const f = S.hist; if (f.band || f.ctx || f.mark) return [];
  const q = norm(f.q);
  return blMeals().filter(x => {
    if (f.meal && x.meal !== f.meal) return false;
    if (f.from && x.date < f.from) return false; if (f.to && x.date > f.to) return false;
    if (q) { const hay = norm(['refeicao refeicoes feita carboidratos liquidos bolus', (blMeal(x.meal) || {}).name, fmtDate(x.date), x.date, x.time, blN(x.net, 0) + ' g', x.ui != null ? x.ui + ' ui unidades' : ''].join(' ')); if (!hay.includes(q)) return false; }
    return true;
  });
}
function mealLogHTML(m, where) {
  const meal = blMeal(m.meal) || { name: 'Refeição', ic: 'refeicao' };
  return `<button class="rec meal" data-key="m${m.id}" data-ts="${m.ts}" data-act="mlog-edit" data-id="${m.id}"><span class="tm num ic"><svg class="mi" viewBox="0 0 24 24" aria-hidden="true">${MIC[meal.ic] || MIC.refeicao}</svg><i class="mi-l">${esc(m.time)}</i></span>
    <span class="info"><span class="badge meal-b">${esc(meal.name)}</span><span class="chips">${m.ui != null ? `<span class="tag">bolus ${m.ui} Ui</span>` : ''}<span class="tag">tot. ${blN(m.carb, 0)} g</span><span class="tag">fibras ${blN(m.fiber, 0)} g</span><span class="tag">${blN(m.kcal, 0)} kcal</span></span></span>
    <span class="gl num">${blN(m.net, 0)}<small>g líq.</small></span></button>`;
}
function blMealsOf(d, id) { return blMeals().filter(x => x.date === d && (!id || x.meal === id)).sort((a, b) => a.ts - b.ts); }
function blDoneHTML(id) {
  const t = blSum(id), list = blMealsOf(blDate(), id), meal = blMeal(id);
  return `<button class="btn pri full" data-bl="mealdone" data-meal="${id}" ${t.rows.length ? '' : 'disabled'}>✓ Refeição feita · adicionar ao histórico</button>
    <p class="hint" style="margin:10px 0 0">${t.rows.length ? `Guarda no histórico o horário e os totais desta refeição (${blN(t.net)} g líquidos${blOn(id) && blRule(id) ? ', bolus ' + blDose(t.net, id) + ' Ui' : ''}), sem a lista de alimentos.` : 'Adicione alimentos para poder registrar a refeição.'}</p>
    ${list.length ? `<div class="stack" style="gap:8px;margin-top:12px">${list.map(m => mealLogHTML(m)).join('')}</div>` : ''}
    <button class="btn full" style="margin-top:10px" data-act="meal-fromcalc" data-meal="${id}" ${t.rows.length ? '' : 'disabled'}>Salvar como refeição salva</button>`;
}
function mealLogForm(m, id) {
  const now = new Date(), mm = m || {}, d = m ? m.date : blDate(), tm = m ? m.time : (d === isoDate(now) ? HM(now.getTime()) : '12:00'), mid = m ? m.meal : id, meal = blMeal(mid);
  const net = m ? m.net : blSum(mid).net;
  return `<h2>${m ? 'Editar refeição' : 'Refeição feita'}</h2><p class="hint" style="margin:0 0 12px">${esc(meal ? meal.name : '')} · <b class="num">${blN(net)} g</b> de carboidratos líquidos${m && m.ui != null ? ' · bolus ' + m.ui + ' Ui' : ''}. Os alimentos não ficam no histórico.</p>
    <form id="mlog-form" data-id="${m ? m.id : ''}" data-meal="${mid}" novalidate><div class="form-grid">
    <div class="field"><label class="fl" for="ml-dt">Data</label><input class="in" type="date" id="ml-dt" value="${d}" max="${isoDate(now)}" ${m ? '' : 'disabled'}></div>
    <div class="field"><label class="fl" for="ml-tm">Horário</label><input class="in" type="time" id="ml-tm" value="${tm}" ${m ? '' : 'autofocus'}></div></div>
    <p class="err" id="mlog-err" role="alert"></p><div class="stack" style="margin-top:10px"><button class="btn pri full" type="submit">${m ? 'Salvar' : 'Adicionar ao histórico'}</button>${m ? `<button class="btn full" type="button" data-act="mlog-del-ask" data-id="${m.id}">Excluir refeição</button>` : ''}<button class="btn full" type="button" data-act="close">Cancelar</button></div></form>`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act;
  if (a === 'mlog-edit') { const m = blMeals().find(x => x.id === el.dataset.id); if (m) openSheet(mealLogForm(m)); }
  else if (a === 'mlog-del-ask') { el.dataset.act = 'mlog-del-do'; el.textContent = 'Toque de novo para excluir'; el.classList.add('pri'); }
  else if (a === 'mlog-del-do') { S.bl.meals = blMeals().filter(x => x.id !== el.dataset.id); blSave(); closeSheet(); render(); toast('Refeição excluída.'); }
  else if (a === 'meal-fromcalc') { const id = el.dataset.meal, meal = blMeal(id), t = blSum(id); if (!meal || !t.rows.length) return; openSheet(mealForm({ name: meal.name, meal: id, carbs: Math.round(t.net * 10) / 10 })); }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'mlog-form') return; e.preventDefault();
  const f = e.target, tm = $('#ml-tm').value, dt = $('#ml-dt').value || blDate();
  if (!/^\d{2}:\d{2}$/.test(tm)) { $('#mlog-err').textContent = 'Informe o horário da refeição.'; return; }
  const ts = mkTs(dt, tm); if (ts > Date.now() + 60000) { $('#mlog-err').textContent = 'O horário não pode estar no futuro.'; return; }
  if (f.dataset.id) { const m = blMeals().find(x => x.id === f.dataset.id); if (m) { m.date = dt; m.time = tm; m.ts = ts; } }
  else {
    const id = f.dataset.meal, t = blSum(id); if (!t.rows.length) { closeSheet(); return; }
    blMeals().push({ id: uid(), ts, date: dt, time: tm, meal: id, net: t.net, carb: t.carb, fiber: t.fiber, prot: t.prot, fat: t.fat, kcal: t.kcal, ui: blOn(id) && blRule(id) ? blDose(t.net, id) : null, ratio: blRatioOf(id) || null });
  }
  blSave(); closeSheet(); render(); toast(f.dataset.id ? 'Refeição atualizada.' : 'Refeição adicionada ao histórico.');
});

function blChips(c) { return `<span class="chip good">líq. ${blN(c.net)} g</span><span class="chip">tot. ${blN(c.carb)} g</span><span class="chip">fibras ${blN(c.fiber)} g</span><span class="chip">prot. ${blN(c.prot)} g</span><span class="chip">gord. ${blN(c.fat)} g</span><span class="chip">${blN(c.kcal, 0)} kcal</span>`; }
function blFacts(t, note) {
  return `<div class="bl-facts"><div class="row sp"><span>Carboidratos totais</span><b class="num">${blN(t.carb)} g</b></div><div class="row sp ind"><span>Fibras</span><b class="num">${blN(t.fiber)} g</b></div><div class="row sp net"><span>Carboidratos líquidos</span><b class="num">${blN(t.net)} g</b></div><div class="row sp"><span>Proteínas</span><b class="num">${blN(t.prot)} g</b></div><div class="row sp"><span>Gorduras</span><b class="num">${blN(t.fat)} g</b></div><div class="row sp"><span>Calorias</span><b class="num">${blN(t.kcal, 0)} kcal</b></div></div>`
    + (note && t.est ? `<p class="hint" style="margin:12px 0 0">Itens com <span class="tag">est.</span> têm valores estimados. Ajuste pelo rótulo na aba Alimentos para o cálculo ficar exato.</p>` : '');
}
function blScale(exact) {
  const n = Math.min(24, Math.max(8, Math.floor(exact) + 2));
  let s = ''; for (let i = 0; i < n; i++) { const f = Math.max(0, Math.min(1, exact - i)); s += `<i class="${f >= 1 ? 'on' : f > 0 ? 'part' : ''}"${f > 0 && f < 1 ? ` style="--f:${Math.round(f * 100)}%"` : ''}></i>`; }
  return `<div class="bl-sc" aria-hidden="true">${s}</div><div class="bl-scl" aria-hidden="true"><span>0</span><span>${n} Ui</span></div>`;
}
function blHero(meal, t) {
  if (!blOn(meal.id)) return `<div class="card red hero bl-hero"><div class="hr-top"><div class="eyebrow">${meal.name} · sem bolus</div></div><div class="bl-big"><span class="num">${blN(t.net)}</span><small>g líquidos</small></div><div class="hr-d" style="text-align:center">Carboidrato líquido · refeição não coberta por bolus</div></div>`;
  if (!blRule(meal.id)) return `<div class="card red hero bl-hero"><div class="hr-top"><div class="eyebrow">Bolus · ${meal.name}</div></div><div class="bl-big"><span class="num">—</span></div><div class="hr-d" style="text-align:center">Informe a sua razão insulina/carboidrato na aba Razão. Sem ela o app não calcula.</div></div>`;
  const ex = t.net / blRatioOf(meal.id), ui = blDose(t.net, meal.id);
  return `<div class="card red hero bl-hero"><div class="hr-top"><div class="eyebrow">Bolus · ${meal.name}</div></div><div class="bl-big"><span class="num">${ui}</span><small>Ui</small></div>${blScale(ex)}<div class="bl-hl"><span class="num">${blN(t.net)} g ÷ ${fn(blRatioOf(meal.id), 1)} = ${blN(ex, 2)}</span><span>arredonda para ${ui} Ui</span></div></div>`;
}

/* ---- Claude calcula alimento novo (só dentro do Claude) ---- */
function blAiBlock(meal) {
  const st = aiState(); if (st !== 'ok') return `<div style="margin-top:${meal ? 14 : 0}px">${aiCard('bolus')}</div>`;
  const k = meal || 'lib', m = S.blUi.msg[k] || {};
  return aiCard('bolus') + `<div class="bl-ai" style="margin-top:${meal ? 12 : 0}px"><b>${meal ? 'Descreva a refeição. A IA calcula.' : 'Alimento novo? A IA calcula.'}</b><span class="hint">${meal ? 'Escreva o que vai comer, como “2 ovos mexidos e 1 pão francês”. A IA adiciona os alimentos e estima os carboidratos.' : 'Digite o nome, com o preparo se quiser, e os valores por 100 g são preenchidos.'}</span>
    <div class="row" style="flex-wrap:wrap">${meal ? `<textarea class="in grow" style="flex:1 1 100%;min-height:72px" id="bl-ai-${k}" data-blai="${k}" placeholder="Ex.: 2 ovos mexidos e 1 pão francês" ${S.blUi.busy ? 'disabled' : ''}></textarea>` : `<input class="in grow" style="flex:1 1 100%" id="bl-ai-${k}" data-blai="${k}" placeholder="Ex.: peito de frango grelhado" autocomplete="off" ${S.blUi.busy ? 'disabled' : ''}>`}<button class="btn pri full" data-bl="ai" data-meal="${meal || ''}" ${S.blUi.busy ? 'disabled' : ''}>${S.blUi.busy ? 'Calculando…' : (meal ? 'Identificar e adicionar' : 'Calcular e salvar')}</button></div>
    <p class="hint ${m.err ? 'bl-err' : ''}" style="margin:0" role="status" aria-live="polite">${esc(m.t || '')}</p></div>`;
}
function blAiErr(e) {
  const c = e && e.code; return e && e.aiMsg ? e.aiMsg : c === 'rate_limited' ? 'Muitas consultas seguidas. Tente de novo em instantes.' : (c === 'not_granted' || c === 'capability_disabled' || c === 'sampling_disabled') ? 'Não consegui usar a IA aqui. Cadastre à mão.' : c === 'refused' || c === 'invalid_json' || c === 'empty_completion' ? 'Não consegui identificar os alimentos. Tente descrever de outro jeito.' : 'Falha ao calcular. Tente novamente.';
}
/* refeição descrita em texto livre: vários alimentos de uma vez */
async function blAiMeal(meal) {
  if (S.blUi.busy) return; const k = meal, inp = $('#bl-ai-' + k), text = inp && inp.value.trim();
  if (!text) { S.blUi.msg[k] = { t: 'Descreva o que vai comer, com as quantidades.', err: 1 }; render(); return; }
  const sample = await getSample(); if (!sample) { S.blUi.msg[k] = { t: 'A IA não está disponível aqui. Cadastre os alimentos à mão.', err: 1 }; render(); return; }
  S.blUi.busy = true; S.blUi.msg[k] = { t: 'Identificando os alimentos… pode levar alguns segundos.' }; render();
  const prompt = `Você é uma tabela de composição de alimentos (TACO e USDA). O usuário descreveu uma refeição: "${text.replace(/"/g, "'")}". Separe cada alimento ou bebida citado e informe a composição média de 100 g de cada um. Se o preparo não for citado, assuma o mais comum no Brasil. Use valores realistas e coerentes entre si. Alimentos já cadastrados: ${S.bl.foods.map(f => f.name).join('; ')}. Se um item for o mesmo alimento de um cadastrado, devolva em "nome" exatamente o nome cadastrado. Responda somente com um objeto JSON neste formato: {"itens": [{"nome": "nome curto em português com o preparo", "kcal": 155, "carb": 1.1, "fibras": 0, "prot": 13, "gord": 11, "gramas": 100, "unidades": 2}]}. kcal, carb (carboidratos totais em g), fibras, prot e gord são para 100 g. "gramas" é o peso total citado em gramas; se veio em unidades ou medidas caseiras (copo = 200 ml, colher de sopa, fatia, pão francês = 50 g, ovo = 50 g), estime o peso comestível. "unidades" é o número de unidades citado, ou null. Se não houver quantidade, use null em "gramas" e "unidades". No máximo 15 itens. Se o texto não tiver alimentos, responda {"erro": "motivo curto"}.`;
  try {
    const d = await sample.json(prompt, { modelTier: 'default' });
    const list = d && Array.isArray(d.itens) ? d.itens.slice(0, 15) : null;
    if (!list || !list.length || d.erro) throw { code: 'refused' };
    const nn = v => { v = parseFloat(v); return isNaN(v) || v < 0 ? 0 : v; };
    const mm = blM(true); let tc = 0, nq = 0, n = 0, extra = 0;
    list.forEach((x, i) => {
      if (!x || !x.nome) return;
      let f = { id: 'f' + Date.now().toString(36) + i, name: String(x.nome).slice(0, 60), basis: 'g', unit: 'g', gpu: 0, kcal: nn(x.kcal), carb: nn(x.carb), prot: nn(x.prot), fat: nn(x.gord), fiber: nn(x.fibras), est: true };
      if (f.fiber > f.carb) f.fiber = f.carb;
      const ex = S.bl.foods.find(y => y.name.toLowerCase() === f.name.toLowerCase()); if (ex) f = ex; else { S.bl.foods.push(f); extra++; }
      const grams = Math.round(nn(x.gramas) * 10) / 10, un = nn(x.unidades), item = f.basis === 'g' ? { f: f.id, q: grams } : f.gpu > 0 ? { f: f.id, q: grams, u: 'g' } : { f: f.id, q: un > 0 ? un : 1 };
      item.n = String(x.nome); mm[meal].push(item); n++; if (!(item.q > 0)) nq++; else tc += blCalc(item).net;
    });
    if (!n) throw { code: 'refused' };
    S.blUi.msg[k] = { t: `${n} alimento${n === 1 ? '' : 's'} adicionado${n === 1 ? '' : 's'} (cerca de ${blN(tc)} g de carb. líquidos).${nq ? ` ${nq} sem quantidade: preencha na lista.` : ''}${extra ? ` ${extra} novo${extra === 1 ? '' : 's'} na sua lista, com valores estimados.` : ''} Confira as quantidades abaixo.` };
    blSave();
  } catch (e) { S.blUi.msg[k] = { err: 1, t: blAiErr(e) }; }
  finally { S.blUi.busy = false; render(); }
}
async function blAi(meal) {
  if (meal) return blAiMeal(meal);
  if (S.blUi.busy) return; const k = meal || 'lib', inp = $('#bl-ai-' + k), text = inp && inp.value.trim();
  if (!text) { S.blUi.msg[k] = { t: meal ? 'Digite o alimento e a quantidade.' : 'Digite o nome do alimento.', err: 1 }; render(); return; }
  const sample = await getSample(); if (!sample) { S.blUi.msg[k] = { t: 'O Claude não está disponível aqui. Cadastre o alimento à mão.', err: 1 }; render(); return; }
  S.blUi.busy = true; S.blUi.msg[k] = { t: 'Calculando… pode levar alguns segundos.' }; render();
  const prompt = `Você é uma tabela de composição de alimentos (TACO e USDA). Pedido do usuário: "${text.replace(/"/g, "'")}". Identifique o alimento e informe a composição média de 100 g dele. Se o preparo não for citado, assuma o mais comum no Brasil (cozido, grelhado ou pronto para comer). Use valores realistas e coerentes entre si. Alimentos já cadastrados: ${S.bl.foods.map(f => f.name).join('; ')}. Se o pedido for o mesmo alimento de um deles, devolva em "nome" exatamente o nome cadastrado. Responda somente com um objeto JSON neste formato: {"nome": "nome curto em português com o preparo", "kcal": 155, "carb": 1.1, "fibras": 0, "prot": 13, "gord": 11, "gramas": 50, "unidades": 1}. kcal, carb (carboidratos totais em g), fibras, prot e gord são para 100 g, sem unidades. "gramas" é o peso total pedido em gramas; se o pedido veio em unidades ou medidas caseiras, estime o peso comestível médio (1 ovo cozido = 50). "unidades" é o número de unidades pedidas, ou null se o pedido não falou em unidades. Se o pedido não tiver quantidade, use null em "gramas" e "unidades". Se o texto não for um alimento, responda {"erro": "motivo curto"}.`;
  try {
    const d = await sample.json(prompt, { modelTier: 'default' });
    if (!d || d.erro) throw { code: 'refused' };
    const nn = v => { v = parseFloat(v); return isNaN(v) || v < 0 ? 0 : v; };
    let f = { id: 'f' + Date.now().toString(36), name: String(d.nome || text).slice(0, 60), basis: 'g', unit: 'g', gpu: 0, kcal: nn(d.kcal), carb: nn(d.carb), prot: nn(d.prot), fat: nn(d.gord), fiber: nn(d.fibras), est: true };
    if (f.fiber > f.carb) f.fiber = f.carb;
    const ex = S.bl.foods.find(x => x.name.toLowerCase() === f.name.toLowerCase()); if (ex) f = ex; else S.bl.foods.push(f);
    let msg;
    if (meal) {
      const grams = Math.round(nn(d.gramas) * 10) / 10, un = nn(d.unidades), item = f.basis === 'g' ? { f: f.id, q: grams } : f.gpu > 0 ? { f: f.id, q: grams, u: 'g' } : { f: f.id, q: un > 0 ? un : 1 };
      item.n = text; blM(true)[meal].push(item); const c = blCalc(item);
      msg = !(item.q > 0) ? `Adicionei ${f.name}, mas o pedido não tinha quantidade. Digite a quantidade no item.` : `Adicionado: ${f.name}, ${String(item.q).replace('.', ',')} ${f.basis === 'g' || item.u === 'g' ? 'g' : (f.unit || 'un')} (${blN(c.net)} g carb. líq., ${blN(c.prot)} g prot., ${blN(c.fat)} g gord., ${blN(c.kcal, 0)} kcal). Valores estimados: confira com o rótulo, se tiver.`;
    } else msg = `${ex ? 'Já existia' : 'Salvo'}: ${f.name} (100 g: ${blN(f.carb)} g carb., ${blN(f.fiber)} g fibras, ${blN(f.prot)} g prot., ${blN(f.fat)} g gord., ${blN(f.kcal, 0)} kcal).`;
    S.blUi.msg[k] = { t: msg }; blSave();
  } catch (e) {
    const c = e && e.code; S.blUi.msg[k] = { err: 1, t: e && e.aiMsg ? e.aiMsg : c === 'rate_limited' ? 'Muitas consultas seguidas. Tente de novo em instantes.' : (c === 'not_granted' || c === 'capability_disabled' || c === 'sampling_disabled') ? 'Não consegui usar o Claude aqui. Cadastre à mão abaixo.' : c === 'refused' || c === 'invalid_json' || c === 'empty_completion' ? 'Não consegui calcular esse alimento. Tente descrevê-lo de outro jeito.' : 'Falha ao calcular. Tente novamente.' };
  } finally { S.blUi.busy = false; render(); }
}

/* ---- telas ---- */
function blUnitCtl(id, i, it, f) {
  if (f.basis === 'g' || !(f.gpu > 0)) return `<span class="dim">${esc(blUnit(f))}</span>`;
  return `<select class="in bl-unit" data-blunit="1" data-meal="${id}" data-idx="${i}" aria-label="Unidade de medida"><option value="un"${it.u === 'g' ? '' : ' selected'}>${esc(f.unit || 'un')}</option><option value="g"${it.u === 'g' ? ' selected' : ''}>g</option></select>`;
}
function blMealView(id) {
  const meal = blMeal(id), t = blSum(id), pend = S.blUi.pend;
  const items = (blM()[id] || []).map((it, i) => {
    const f = blFood(it.f); if (!f) return ''; const c = blCalc(it);
    return `<div class="bl-item"><div class="row sp" style="align-items:flex-start;flex-wrap:nowrap"><span class="bl-nm">${esc(f.name)}${f.est ? ' <span class="tag">est.</span>' : ''}${it.n ? `<small class="dim">pedido: ${esc(it.n)}</small>` : ''}</span><button class="bl-x" data-bl="remove" data-meal="${id}" data-idx="${i}" aria-label="Remover ${esc(f.name)}">×</button></div>
      <div class="row" style="flex-wrap:nowrap"><input class="in bl-q num" type="number" inputmode="decimal" step="any" min="0" id="bl-q-${id}-${i}" data-meal="${id}" data-idx="${i}" value="${it.q || ''}" placeholder="0" aria-label="Quantidade de ${esc(f.name)}">${blUnitCtl(id, i, it, f)}</div><div class="bl-chips" id="bl-ch-${id}-${i}">${blChips(c)}</div></div>`;
  }).join('');
  return `<div id="bl-hero">${blHero(meal, t)}</div>
    <h2 class="sec">Refeição feita</h2><div class="card" id="bl-done">${blDoneHTML(id)}</div>
    <h2 class="sec">Total da refeição</h2><div class="card" id="bl-facts">${t.rows.length ? blFacts(t, true) : '<p class="hint" style="margin:0">Adicione alimentos abaixo para ver os totais.</p>'}</div>
    <h2 class="sec">Alimentos</h2><div class="card">${items ? `<div class="bl-items">${items}</div>` : '<p class="hint" style="margin:0">Nenhum alimento ainda.</p>'}
      <div class="bl-add"><select class="in" id="bl-add-${id}" aria-label="Alimento para adicionar">${S.bl.foods.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}</select><button class="btn pri full" data-bl="add" data-meal="${id}">Adicionar alimento</button><button class="btn full" data-bl="reset" data-meal="${id}">${pend === id ? 'Confirmar: voltar ao padrão' : 'Voltar ao padrão'}</button></div>${blAiBlock(id)}</div>`;
}
function blRefresh(id) {
  const meal = blMeal(id), t = blSum(id);
  $('#bl-hero').innerHTML = blHero(meal, t); const dn = $('#bl-done'); if (dn) dn.innerHTML = blDoneHTML(id);
  $('#bl-facts').innerHTML = t.rows.length ? blFacts(t, true) : '<p class="hint" style="margin:0">Adicione alimentos abaixo para ver os totais.</p>';
  (blM()[id] || []).forEach((it, i) => { const el = $('#bl-ch-' + id + '-' + i), c = blCalc(it); if (el && c) el.innerHTML = blChips(c); });
}
function blDayView() {
  const tot = { carb: 0, fiber: 0, net: 0, prot: 0, fat: 0, kcal: 0, est: false }; let ui = 0; const parts = [];
  const rows = BL_MEALS.map(m => {
    const t = blSum(m.id); ['carb', 'fiber', 'net', 'prot', 'fat', 'kcal'].forEach(k => tot[k] += t[k]); if (t.est && t.rows.length) tot.est = true;
    const b = blOn(m.id) ? blDose(t.net, m.id) : null; if (b !== null) { ui += b; parts.push(`${m.short} ${b}`); }
    return `<div class="bl-mrow"><div class="row sp"><b>${m.name}</b><span class="tag ${b === null ? '' : 'bl-dose'}">${b === null ? 'sem bolus' : b + ' Ui'}</span></div>${t.rows.length ? `<div class="bl-chips">${blChips(t)}</div>` : '<p class="hint" style="margin:0">Sem alimentos.</p>'}</div>`;
  }).join('');
  const d = blDate(), com = !!S.bl.days[d], wk = blWeekend(d), tn = wk ? 'fim de semana' : 'dias de semana', pend = S.blUi.pend;
  const days = Object.keys(S.bl.days).filter(k => BL_MEALS.some(m => (S.bl.days[k][m.id] || []).length)).sort().reverse().slice(0, 60);
  return `<div class="card red hero bl-hero"><div class="hr-top"><div class="eyebrow">Bolus do dia</div></div><div class="bl-big"><span class="num">${ui}</span><small>Ui</small></div><div class="bl-hl"><span>${esc(parts.join(' + ')) || 'nenhuma refeição com bolus'}</span></div></div>
    <h2 class="sec">Total do dia</h2><div class="card">${blFacts(tot, true)}</div>
    <h2 class="sec">Por refeição</h2><div class="card bl-mrows">${rows}</div>
    <h2 class="sec">Refeições feitas</h2><div class="card">${blMealsOf(blDate()).length ? `<div class="stack" style="gap:8px">${blMealsOf(blDate()).map(m => mealLogHTML(m)).join('')}</div>` : '<p class="hint" style="margin:0">Nenhuma refeição registrada neste dia. Na aba de cada refeição, use "Refeição feita".</p>'}</div>
    <h2 class="sec">Registro do dia</h2><div class="card"><p class="hint" style="margin:0 0 12px">${com ? 'Este dia está salvo no histórico.' : `Este dia mostra o padrão de ${tn} e ainda não está no histórico. Qualquer alteração que você fizer o registra.`}</p><div class="stack" style="gap:8px">${com ? `<button class="btn full" data-bl="daydel">${pend === 'day-del' ? 'Confirmar: apagar registro' : 'Apagar registro do dia'}</button>` : `<button class="btn pri full" data-bl="daycommit">Registrar este dia</button>`}<button class="btn full" data-bl="daytpl">${pend === 'day-tpl' ? 'Confirmar: trocar o padrão' : 'Usar como padrão de ' + tn}</button></div></div>
    <h2 class="sec">Histórico</h2><div class="card">${days.length ? days.map(k => { let u = 0, net = 0; const ps = []; BL_MEALS.forEach(m => { const t = blSum(m.id, S.bl.days[k]); net += t.net; if (blOn(m.id)) { const b = blDose(t.net); u += b; ps.push(`${m.short} ${b}`); } }); const dt = k.split('-').map(Number), w = WD[new Date(dt[0], dt[1] - 1, dt[2]).getDay()];
      return `<button class="bl-h ${k === d ? 'cur' : ''}" data-bl="goto" data-date="${k}"><span><b>${w} · ${fmtDate(k)}</b><small class="dim">${esc(ps.join(' · '))} · ${blN(net)} g líq.</small></span><span class="tag bl-dose">${u} Ui</span></button>`; }).join('') : '<p class="hint" style="margin:0">Nenhum dia registrado ainda. Registre o dia de hoje acima.</p>'}</div>`;
}
function blNum(id, field, label, v) { return `<label class="bl-fl">${label}<input class="in num" type="number" inputmode="decimal" step="any" min="0" data-food="${id}" data-field="${field}" value="${Math.round(v * 100) / 100}"></label>`; }
function blFoodsView() {
  const sv = S.saved || [], saved = `<h2 class="sec">Refeições salvas</h2><div class="card"><p class="hint" style="margin:0 0 12px">Atalhos com nome e carboidratos para preencher o registro de uma medição com um toque. Use "Salvar como refeição salva" na aba de uma refeição. O app só preenche carboidratos e descrição, sem sugerir dose.</p><div class="stack" style="gap:8px">${sv.map(m => `<button class="menu-item" data-act="meal-edit" data-id="${m.id}"><div>${esc(m.name)}<span>${[m.meal ? MEALS[m.meal] : '', m.carbs != null ? fn(m.carbs, 0) + ' g de carboidratos' : '', m.desc || ''].filter(Boolean).map(esc).join(' · ') || 'Sem detalhes'}</span></div><svg viewBox="0 0 24 24">${IC.chev}</svg></button>`).join('')}<button class="btn full" data-act="meal-new">Nova refeição salva</button></div></div>`;
  const cards = S.bl.foods.map(f => `<div class="bl-food"><div class="row" style="flex-wrap:nowrap"><input class="in" data-food="${f.id}" data-field="name" value="${esc(f.name)}" aria-label="Nome"><button class="btn danger sm" data-bl="delfood" data-food="${f.id}">Excluir</button></div>
    <div class="row" style="margin-top:10px"><label class="bl-fl">Base<select class="in" data-food="${f.id}" data-field="basis"><option value="g"${f.basis === 'g' ? ' selected' : ''}>100 g</option><option value="un"${f.basis === 'un' ? ' selected' : ''}>Unidade</option></select></label>${f.basis === 'un' ? `<label class="bl-fl">Unidade<input class="in" data-food="${f.id}" data-field="unit" value="${esc(f.unit || '')}"></label><label class="bl-fl">g por unidade<input class="in num" type="number" inputmode="decimal" step="any" min="0" data-food="${f.id}" data-field="gpu" value="${f.gpu || 0}"></label>` : ''}</div>
    <label class="bl-chk" style="margin-top:10px"><input type="checkbox" data-food="${f.id}" data-field="est" ${f.est ? 'checked' : ''}><span>Valores estimados</span></label><p class="hint" style="margin:8px 0">Valores ${f.basis === 'g' ? 'por 100 g' : 'por ' + esc(f.unit || 'unidade')}</p>
    <div class="bl-grid">${blNum(f.id, 'carb', 'Carb. tot. (g)', f.carb)}${blNum(f.id, 'fiber', 'Fibras (g)', f.fiber)}${blNum(f.id, 'prot', 'Prot. (g)', f.prot)}${blNum(f.id, 'fat', 'Gord. (g)', f.fat)}${blNum(f.id, 'kcal', 'kcal', f.kcal)}</div></div>`).join('');
  return `<div class="card soft" style="margin-bottom:12px"><p class="hint" style="margin:0 0 10px">A sua razão insulina/carboidratos fica na aba <b>Razão</b>.</p><button class="btn full" data-bl="tab" data-tab="razao">Abrir Minha razão</button></div>` + saved + `<h2 class="sec">Seus alimentos</h2><p class="hint" style="margin:0 2px 10px">Valores por 100 g ou por unidade. Itens estimados vêm de tabelas médias: troque pelos números do rótulo.</p><div class="stack">${cards}</div>
    <h2 class="sec">Novo alimento</h2><div class="card">${blAiBlock(null)}<form id="bl-new" class="stack" style="gap:10px;margin-top:14px"><p class="hint" style="margin:0">${aiState() === 'ok' ? 'Ou preencha à mão:' : 'Cadastre o alimento à mão:'}</p><input class="in" id="bl-nf-name" placeholder="Nome do alimento" required><div class="row"><select class="in" id="bl-nf-basis" style="flex:1 1 120px"><option value="g">Por 100 g</option><option value="un">Por unidade</option></select><input class="in" id="bl-nf-unit" placeholder="Unidade (ex.: fatia)" style="flex:1 1 120px"><input class="in num" type="number" inputmode="decimal" step="any" min="0" id="bl-nf-gpu" placeholder="g por unidade" style="flex:1 1 120px"></div>
    <div class="bl-grid">${['carb:Carb. tot. (g)', 'fiber:Fibras (g)', 'prot:Prot. (g)', 'fat:Gord. (g)', 'kcal:kcal'].map(x => { const [k, l] = x.split(':'); return `<label class="bl-fl">${l}<input class="in num" type="number" inputmode="decimal" step="any" min="0" id="bl-nf-${k}" value="0"></label>`; }).join('')}</div><button class="btn pri full" type="submit">Salvar alimento</button></form></div>`;
}
function viewBolus() {
  const tab = S.blUi.tab, d = blDate(), com = !!S.bl.days[d], isT = d === blToday();
  const tabs = BL_MEALS.map(m => ({ id: m.id, l: m.short, ic: m.ic })).concat([{ id: 'razao', l: 'Razão', ic: 'razao' }, { id: 'dia', l: 'Dia', ic: 'dia' }, { id: 'alimentos', l: 'Alimentos', ic: 'alimentos' }]);
  const dt = d.split('-').map(Number), wd = new Date(dt[0], dt[1] - 1, dt[2]).getDay();
  const bar = tab === 'alimentos' || tab === 'razao' ? '' : `<div class="bl-date"><button class="btn" data-bl="prev" aria-label="Dia anterior">‹</button><input class="in" type="date" id="bl-day" value="${d}" aria-label="Escolher o dia"><button class="btn" data-bl="next" aria-label="Próximo dia">›</button></div>
    <div class="row" style="margin:10px 2px 0;gap:6px"><span class="tag">${WD[wd]} · ${fmtDate(d)}</span><span id="bl-dstat" class="tag ${com ? 'on' : ''}">${com ? 'Registrado' : 'Não registrado'}</span><span class="tag">${blWeekend(d) ? 'Fim de semana' : 'Dia de semana'}</span>${isT ? '' : '<button class="btn sm" data-bl="today">Ir para hoje</button>'}</div>`;
  return banners() + `<div id="bl"><div class="bl-tabs" role="tablist">${tabs.map(t => `<button class="seg-b ${t.id === tab ? 'on' : ''}" role="tab" aria-selected="${t.id === tab}" data-bl="tab" data-tab="${t.id}">${blIc(t.ic)}<span>${t.l}</span></button>`).join('')}</div>${bar}
    <div class="stack" style="margin-top:14px;gap:0">${tab === 'razao' ? blRazaoView() : (tab === 'alimentos' ? '' : blRatioStrip()) + (tab === 'dia' ? blDayView() : tab === 'alimentos' ? blFoodsView() : blMealView(tab))}</div>
    <p class="hint" style="margin:18px 2px 0">Carboidrato líquido = carboidratos totais − fibras. A dose é calculada só com a sua razão insulina/carboidrato (aba Razão, definida com a sua equipe de saúde; arredondada para Ui inteira). Confira sempre o resultado antes de aplicar e siga o plano do seu médico. Em emergência, ligue 192 (SAMU).</p></div>`;
}

/* ================= Minha razão insulina/carboidratos =================
   A razão é sempre digitada pela pessoa, com a sua equipe de saúde. O app nunca a calcula, sugere ou altera.
   Os registros abaixo só descrevem o que aconteceu (dose, carboidratos, glicemias) para levar à consulta. */
const BL_INS = ['Lispro (Humalog)', 'Asparte (NovoRapid)', 'Glulisina (Apidra)', 'Fiasp', 'Lyumjev', 'Regular'];
const blP = id => (BL_MEALS.find(m => m.id === id) || { name: 'Período', short: 'Período' });
function blCleanRatios(o) { const r = {}; if (o && typeof o === 'object') BL_MEALS.forEach(m => { const v = +o[m.id]; if (v >= 1 && v <= 200) r[m.id] = v; }); return r; }
function blCleanRhist(l) { return (Array.isArray(l) ? l : []).filter(x => x && typeof x.ts === 'number' && typeof x.p === 'string' && (x.v === null || (x.v >= 1 && x.v <= 200))).map(x => ({ ts: x.ts, p: x.p.slice(0, 12), v: x.v })).slice(-60); }
function blCleanRlog(l) {
  const tm = v => /^\d{2}:\d{2}$/.test(v) ? v : '', nu = v => { v = parseFloat(v); return isFinite(v) && v >= 0 ? v : null; };
  return (Array.isArray(l) ? l : []).filter(r => r && typeof r.id === 'string' && typeof r.ts === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && BL_MEALS.some(m => m.id === r.period) && r.ui > 0 && r.carb > 0)
    .map(r => ({ id: r.id, ts: r.ts, date: r.date, period: r.period, ui: +r.ui, itype: String(r.itype || '').slice(0, 40), carb: +r.carb, mealTime: tm(r.mealTime), appTime: tm(r.appTime), gb: nu(r.gb), ga: nu(r.ga), gaMin: nu(r.gaMin), reg: r.reg >= 1 ? +r.reg : null, notes: String(r.notes || '').slice(0, 400) })).slice(-1000);
}
const blRlog = () => S.bl.rlog || (S.bl.rlog = []);
function blRh(p, v) { S.bl.rhist = (S.bl.rhist || []).concat([{ ts: Date.now(), p, v }]).slice(-60); }
const blRs = r => r && r.ui > 0 ? r.carb / r.ui : null;
const blAvg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const blRatioTxt = r => r ? `1 Ui : ${fn(r, 1)} g` : '—';

/* faixa fixa no alto de cada aba: a razão é o parâmetro de referência */
function blRatioStrip() {
  const tab = S.blUi.tab, p = BL_MEALS.find(m => m.id === tab), r = p ? blRatioOf(p.id) : (S.bl.ratio >= 1 ? S.bl.ratio : null), own = p && S.bl.ratios && S.bl.ratios[p.id] >= 1;
  return `<button class="ic-strip" data-bl="tab" data-tab="razao" aria-label="Abrir Minha razão insulina/carboidratos"><span class="ic-l"><b>Minha razão</b><small>${p ? (own ? 'só para ' + esc(p.short.toLowerCase()) : 'geral · vale para ' + esc(p.short.toLowerCase())) : 'insulina/carboidratos'}</small></span><span class="ic-v num">${r ? blRatioTxt(r) : 'Definir'}</span><span class="ic-go" aria-hidden="true">›</span></button>`;
}

function rlogHTML(r) {
  const p = blP(r.period), obs = blRs(r), d = r.date.split('-');
  return `<button class="rec rl" data-key="r${r.id}" data-ts="${r.ts}" data-bl="rlogedit" data-id="${r.id}"><span class="tm num"><b>${esc(r.mealTime || '--:--')}</b><br>${d[2]}/${d[1]}</span>
    <span class="info"><span class="badge meal-b">${esc(p.name)}</span><span class="chips"><span class="tag">${fn(r.ui, 1)} Ui${r.itype ? ' · ' + esc(r.itype) : ''}</span><span class="tag">${fn(r.carb, 1)} g líq.</span>${r.gb != null || r.ga != null ? `<span class="tag">glic. ${r.gb != null ? r.gb : '—'} → ${r.ga != null ? r.ga : '—'}</span>` : ''}</span></span>
    <span class="gl num">${fn(obs, 1)}<small>g por Ui</small></span></button>`;
}
function rlogForm(r) {
  const now = new Date(), x = r || {}, tab = S.blUi.tab, h = now.getHours();
  const per = x.period || (BL_MEALS.some(m => m.id === tab) ? tab : (h < 10 ? 'cafe' : h < 15 ? 'almoco' : 'jantar'));
  const last = blRlog().slice().sort((a, b) => b.ts - a.ts)[0], pre = !r && BL_MEALS.some(m => m.id === tab) ? Math.round(blSum(tab).net * 10) / 10 : 0;
  const carb = r ? r.carb : (pre > 0 ? pre : ''), v = k => x[k] != null ? x[k] : '';
  const num = (id, lab, val, st, mx, ph) => `<div class="field"><label class="fl" for="${id}">${lab}</label><input class="in num" type="number" inputmode="decimal" step="${st}" min="0" max="${mx}" id="${id}" value="${val}" placeholder="${ph || ''}"></div>`;
  return `<h2>${r ? 'Editar registro' : 'Registrar dose e refeição'}</h2><p class="hint" style="margin:0 0 12px">Anote o que aconteceu. O app não calcula nem muda a sua razão: esses dados servem para você levar à consulta.</p>
    <form id="rlog-form" data-id="${r ? r.id : ''}" novalidate><div class="form-grid">
    <div class="field"><label class="fl" for="rl-p">Período do dia</label><select class="in" id="rl-p">${BL_MEALS.map(m => `<option value="${m.id}"${m.id === per ? ' selected' : ''}>${m.name}</option>`).join('')}</select></div>
    <div class="field"><label class="fl" for="rl-dt">Data</label><input class="in" type="date" id="rl-dt" value="${r ? r.date : isoDate(now)}" max="${isoDate(now)}"></div>
    ${num('rl-ui', 'Insulina rápida (Ui)', v('ui'), '0.5', 100, 'Ex.: 4')}
    <div class="field"><label class="fl" for="rl-it">Tipo de insulina</label><input class="in" id="rl-it" list="rl-its" maxlength="40" value="${esc(r ? r.itype : (last ? last.itype : ''))}" placeholder="Ex.: Lispro"><datalist id="rl-its">${BL_INS.map(i => `<option value="${esc(i)}">`).join('')}</datalist></div>
    ${num('rl-c', 'Carboidratos líquidos (g)', carb, 'any', 500, 'Ex.: 60')}
    <div class="field"><label class="fl" for="rl-tm">Horário da refeição</label><input class="in" type="time" id="rl-tm" value="${r ? r.mealTime : (HM(now.getTime()))}"></div>
    <div class="field"><label class="fl" for="rl-ta">Horário da aplicação</label><input class="in" type="time" id="rl-ta" value="${v('appTime')}"></div>
    ${num('rl-gb', 'Glicemia antes (mg/dL)', v('gb'), '1', 600, '')}
    ${num('rl-ga', 'Glicemia depois (mg/dL)', v('ga'), '1', 600, '')}
    ${num('rl-gm', 'Depois: minutos após a refeição', v('gaMin'), '1', 600, 'Ex.: 120')}
    <div class="field full"><label class="fl" for="rl-n">Observações</label><textarea class="in" id="rl-n" maxlength="400" style="min-height:64px" placeholder="Ex.: caminhada depois, refeição com muita gordura, local da aplicação…">${esc(r ? r.notes : '')}</textarea></div></div>
    ${pre > 0 && !r ? '<p class="hint" style="margin:8px 0 0">Carboidratos preenchidos com o total líquido da refeição aberta. Ajuste se comeu diferente.</p>' : ''}
    <p class="err" id="rlog-err" role="alert"></p><div class="stack" style="margin-top:10px"><button class="btn pri full" type="submit">${r ? 'Salvar' : 'Adicionar registro'}</button>${r ? `<button class="btn full" type="button" data-act="rlog-del-ask" data-id="${r.id}">Excluir registro</button>` : ''}<button class="btn full" type="button" data-act="close">Cancelar</button></div></form>`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act;
  if (a === 'rlog-del-ask') { el.dataset.act = 'rlog-del-do'; el.textContent = 'Toque de novo para excluir'; el.classList.add('pri'); }
  else if (a === 'rlog-del-do') { S.bl.rlog = blRlog().filter(x => x.id !== el.dataset.id); blSave(); closeSheet(); render(); toast('Registro excluído.'); }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'rlog-form') return; e.preventDefault();
  const f = e.target, err = m => { $('#rlog-err').textContent = m; }, g = id => $('#' + id).value.trim(), n = id => { const v = parseFloat(g(id).replace(',', '.')); return isNaN(v) ? null : v; };
  const ui = n('rl-ui'), carb = n('rl-c'), gb = n('rl-gb'), ga = n('rl-ga'), gm = n('rl-gm'), dt = g('rl-dt'), tm = g('rl-tm'), ta = g('rl-ta');
  if (!(ui > 0 && ui <= 100)) return err('Informe a insulina rápida usada, em Ui (maior que 0).');
  if (!(carb > 0 && carb <= 500)) return err('Informe os carboidratos líquidos da refeição, em gramas.');
  if (!dt || !/^\d{2}:\d{2}$/.test(tm)) return err('Informe a data e o horário da refeição.');
  if (ta && !/^\d{2}:\d{2}$/.test(ta)) return err('Horário da aplicação inválido.');
  for (const [v, l] of [[gb, 'antes'], [ga, 'depois']]) if (v != null && (v < 20 || v > 600)) return err(`Glicemia ${l}: informe um valor entre 20 e 600 mg/dL.`);
  if (gm != null && (gm < 5 || gm > 600)) return err('Minutos após a refeição: informe entre 5 e 600.');
  const ts = mkTs(dt, tm); if (ts > Date.now() + 60000) return err('O horário da refeição não pode estar no futuro.');
  const period = g('rl-p'), rec = { id: f.dataset.id || uid(), ts, date: dt, period, ui, itype: g('rl-it').slice(0, 40), carb, mealTime: tm, appTime: ta, gb, ga, gaMin: gm, reg: blRatioOf(period), notes: g('rl-n').slice(0, 400) };
  const l = blRlog(), i = l.findIndex(x => x.id === rec.id); if (i >= 0) { rec.reg = l[i].reg; l[i] = rec; } else l.push(rec);
  S.bl.rlog = l.sort((a, b) => a.ts - b.ts);
  blSave(); closeSheet(); render(); toast(`Registrado. Razão deste registro: 1 Ui : ${fn(carb / ui, 1)} g. Sua razão cadastrada não muda.`);
});

/* acompanhamento por período */
function blRStats() {
  const out = [];
  BL_MEALS.forEach(m => {
    const l = blRlog().filter(r => r.period === m.id).sort((a, b) => a.ts - b.ts); if (!l.length) return;
    const last = l.slice(-10), rt = a => { const u = a.reduce((s, r) => s + r.ui, 0); return u ? a.reduce((s, r) => s + r.carb, 0) / u : null; };
    const both = last.filter(r => r.gb != null && r.ga != null);
    let trend = null;
    if (l.length >= 6) { const a = rt(l.slice(-3)), b = rt(l.slice(-6, -3)); if (a && b) { const pc = Math.round((a - b) / b * 100); trend = Math.abs(pc) >= 20 ? `Nos 3 últimos registros a razão observada ${pc > 0 ? 'subiu' : 'caiu'} ${Math.abs(pc)}% em relação aos 3 anteriores. Mostre isso ao seu endocrinologista.` : 'Nos últimos registros a razão observada está estável.'; } }
    out.push({ m, n: l.length, used: last.length, obs: rt(last), reg: blRatioOf(m.id), gb: blAvg(last.filter(r => r.gb != null).map(r => r.gb)), ga: blAvg(last.filter(r => r.ga != null).map(r => r.ga)), dg: blAvg(both.map(r => r.ga - r.gb)), nb: both.length, trend });
  });
  return out;
}
function blTrackHTML() {
  const st = blRStats();
  if (!st.length) return '<div class="card">' + emptyBlock('Nada para acompanhar ainda', 'Registre doses e refeições acima. Com alguns registros por período, o app mostra a razão observada ao lado da sua razão cadastrada.') + '</div>';
  const row = (a, b) => `<div class="row sp"><span>${a}</span><b class="num">${b}</b></div>`;
  return '<div class="stack">' + st.map(x => `<div class="card"><div class="row sp" style="margin-bottom:8px"><b>${esc(x.m.name)}</b><span class="tag">${x.n} registro${x.n === 1 ? '' : 's'}</span></div><div class="bl-facts">
    ${row('Razão cadastrada', blRatioTxt(x.reg))}${row('Razão observada (últimos ' + x.used + ')', blRatioTxt(x.obs))}${x.gb != null ? row('Glicemia antes (média)', Math.round(x.gb) + ' mg/dL') : ''}${x.ga != null ? row('Glicemia depois (média)', Math.round(x.ga) + ' mg/dL') : ''}${x.dg != null ? row('Variação média (' + x.nb + ' com as duas)', (x.dg > 0 ? '+' : '') + Math.round(x.dg) + ' mg/dL') : ''}</div>
    ${x.trend ? `<p class="hint" style="margin:10px 0 0">${x.trend}</p>` : ''}</div>`).join('') + '</div>'
    + '<p class="hint" style="margin:12px 2px 0">Razão observada = carboidratos ÷ insulina dos seus registros. É um retrato do que você anotou, não uma recomendação: ela não muda a sua razão cadastrada. Se parte da insulina serviu para corrigir glicemia alta, a razão observada não reflete só a refeição.</p>';
}
function blHistHTML() {
  const h = (S.bl.rhist || []).slice().reverse().slice(0, 8);
  if (!h.length) return '<p class="hint" style="margin:12px 2px 0">Quando você alterar a razão cadastrada, a mudança aparece aqui com a data.</p>';
  return `<div class="card" style="margin-top:12px"><b>Alterações da razão cadastrada</b><div class="bl-facts" style="margin-top:8px">${h.map(x => `<div class="row sp"><span>${fmtDate(isoDate(new Date(x.ts)))} · ${x.p === 'geral' ? 'Geral' : esc(blP(x.p).short)}</span><b class="num">${x.v ? '1 : ' + fn(x.v, 1) + ' g' : 'removida'}</b></div>`).join('')}</div></div>`;
}

const BL_TUT = [
  ['O que é a razão insulina/carboidratos', '<p>É o número que diz <b>quantos gramas de carboidrato 1 unidade (Ui) de insulina rápida cobre</b>. Ela existe para ligar o que você come à dose de insulina da refeição.</p><p>É um número <b>pessoal</b>: muda de pessoa para pessoa e pode ser diferente no café da manhã, no almoço e no jantar. Também pode mudar com o tempo, com o peso, com a atividade física e com o tratamento.</p>'],
  ['Como ela é representada', '<p>Costuma ser escrita assim: <b>1:15</b> ou “1 Ui para 15 g”. Isso quer dizer que 1 Ui cobre 15 g de carboidrato. Quanto menor o segundo número, mais insulina para a mesma quantidade de carboidrato.</p><p>Só para entender a conta (não é recomendação): numa razão de 1:15, uma refeição com 60 g de carboidratos líquidos dá 60 ÷ 15 = 4. É essa divisão que o app faz com a razão que <b>você</b> informou.</p><p>Carboidrato líquido = carboidratos totais − fibras.</p>'],
  ['Onde encontrar essa informação', '<p>Ela vem da <b>sua equipe de saúde</b>: endocrinologista, educador em diabetes ou nutricionista. Procure:</p><ul><li>na receita ou no plano de insulina que você recebeu;</li><li>nas anotações ou no relatório da última consulta;</li><li>nas configurações da bomba de insulina ou do aplicativo dela, em “relação insulina/carboidrato” (I:C);</li><li>no portal do seu plano de saúde ou do hospital, se houver.</li></ul><p>Se você não achar ou tiver dúvida, <b>pergunte à equipe</b>. Não use o número de outra pessoa e não tente descobrir por conta própria.</p>'],
  ['Como conversar com o endocrinologista', '<p>Leve seus registros daqui (doses, carboidratos, glicemias antes e depois) e pergunte:</p><ul><li>Qual é a minha razão em cada período do dia? Vale para os lanches?</li><li>Quanto tempo antes da refeição devo aplicar?</li><li>Em que momento devo medir a glicemia depois de comer?</li><li>Como corrijo uma glicemia alta? (isso é outro cálculo, com outro fator)</li><li>Quando devo revisar a razão e que sinais pedem contato antes da consulta?</li></ul><p>Peça que a razão e as orientações venham <b>por escrito</b>.</p>'],
  ['Como registrar no aplicativo', '<ol><li>Na aba <b>Razão</b>, digite a razão que a sua equipe definiu. Se ela muda por período, preencha o café, o almoço e o jantar.</li><li>Depois da refeição, toque em <b>Registrar dose e refeição</b>.</li><li>Informe o período, a insulina rápida usada (e o tipo), os carboidratos líquidos e os horários da refeição e da aplicação.</li><li>Anote a glicemia de antes e, no tempo combinado com a sua equipe, a de depois.</li><li>Use as observações para o que pode ter influenciado (atividade, refeição gordurosa, estresse, local da aplicação).</li></ol>'],
  ['Como interpretar os registros', '<p>Olhe o <b>conjunto</b>, não um dia só. Em <b>Acompanhamento</b>, compare a razão cadastrada com a observada e veja a variação média da glicemia depois das refeições.</p><p>Um dia ruim costuma ter explicação: gordura e proteína em excesso, atividade, doença, estresse, horário da aplicação, insulina vencida ou mal armazenada, local da injeção.</p><p>Se glicemias altas ou baixas se repetirem nos mesmos períodos, ou se a razão observada mudar bastante e de forma constante, <b>leve os registros ao seu endocrinologista</b>. Só ele decide se a razão deve mudar. O app não ajusta nada sozinho.</p><p>Hipoglicemia: siga o plano da sua equipe. Em emergência, ligue 192 (SAMU).</p>']
];
function blRazaoView() {
  const g = S.bl.ratio >= 1 ? S.bl.ratio : null, per = BL_MEALS.filter(m => S.bl.ratios && S.bl.ratios[m.id] >= 1);
  const hero = `<div class="card red hero ic-hero"><div class="eyebrow">Minha razão insulina/carboidratos</div>
    <div class="ic-big">${g ? `<span class="num">1</span><small>Ui</small><span class="ic-c">:</span><span class="num">${fn(g, 1)}</span><small>g</small>` : '<span class="num">—</span>'}</div>
    <div class="hr-d" style="text-align:center">${g ? '1 unidade de insulina rápida para cada ' + fn(g, 1) + ' g de carboidratos líquidos' : 'Informe abaixo a razão definida pela sua equipe de saúde.'}</div>
    ${per.length ? `<div class="ic-per">${per.map(m => `<span><small>${esc(m.short)}</small><b class="num">1 : ${fn(S.bl.ratios[m.id], 1)}</b></span>`).join('')}</div>` : ''}</div>`;
  const form = `<div class="card"><p class="hint" style="margin:0 0 12px"><b>Quem define a razão é a sua equipe de saúde.</b> O app nunca a calcula, sugere ou altera sozinho: ele só faz a conta com o número que você digitar. O TiaBete não substitui a consulta.</p>
    <div class="field"><label class="fl" for="bl-ratio">Razão geral: 1 Ui cobre quantos gramas de carboidrato líquido?</label><input class="in num" id="bl-ratio" type="number" inputmode="decimal" step="any" min="1" max="200" value="${S.bl.ratio || ''}" placeholder="Combine com sua equipe de saúde"></div>
    <div class="fl" style="margin:14px 0 4px">Razão por período (opcional)</div><p class="hint" style="margin:0 0 8px">Preencha só se a sua equipe indicou razões diferentes. Em branco, vale a razão geral.</p>
    <div class="bl-grid">${BL_MEALS.map(m => `<label class="bl-fl">${m.name}<input class="in num" type="number" inputmode="decimal" step="any" min="1" max="200" data-blrp="${m.id}" value="${S.bl.ratios && S.bl.ratios[m.id] || ''}" placeholder="${g ? 'geral ' + fn(g, 1) : 'g por Ui'}"></label>`).join('')}</div>
    <div class="fl" style="margin:14px 0 8px">Refeições com bolus</div><div class="row">${BL_MEALS.map(m => `<label class="bl-chk"><input type="checkbox" data-blon="${m.id}" ${blOn(m.id) ? 'checked' : ''}><span>${m.short}</span></label>`).join('')}</div></div>${blHistHTML()}`;
  const log = blRlog().slice().sort((a, b) => b.ts - a.ts), reg = `<div class="card"><p class="hint" style="margin:0 0 12px">Anote cada refeição com insulina: dose, carboidratos, horários e glicemias de antes e depois. Esses dados ajudam você e a sua equipe a acompanhar a razão.</p><button class="btn pri full" data-bl="rlogadd">+ Registrar dose e refeição</button></div>
    ${log.length ? `<div class="stack" style="gap:8px;margin-top:12px">${log.slice(0, 20).map(rlogHTML).join('')}</div>${log.length > 20 ? `<p class="hint" style="margin:8px 2px 0">Mostrando os 20 mais recentes de ${log.length}.</p>` : ''}` : ''}`;
  const tut = `<div class="card soft" style="margin-bottom:10px"><p class="hint" style="margin:0"><b>Segurança.</b> Este conteúdo é educativo. A definição e os ajustes da razão são feitos com o profissional que cuida do seu tratamento. O app não substitui a consulta.</p></div>
    ${BL_TUT.map(([t, b], i) => `<details class="ic-tut"><summary>${i + 1}. ${t}</summary><div class="ic-tb">${b}</div></details>`).join('')}`;
  return `<h2 class="sec">Minha razão insulina/carboidratos</h2>${hero}<div style="height:12px"></div>${form}
    <h2 class="sec">Registros de dose</h2>${reg}
    <h2 class="sec">Acompanhamento</h2>${blTrackHTML()}
    <h2 class="sec">Tutorial: entenda a sua razão</h2>${tut}`;
}


/* ---- Backup: o que conta como dado do bolus e como unir um backup sem perder nem duplicar ---- */
const blDirty = () => { try { return JSON.stringify(S.bl) !== JSON.stringify(blDefault()); } catch (e) { return true; } };
/* Une o bolus de um backup ao que já existe. Nas definições (valores dos alimentos, modelos de refeição, razão I:C e chaves) o backup
   prevalece, porque quem restaura quer os dados do backup de volta; o que só existe aqui (alimentos, dias, refeições e registros) é mantido.
   Alimentos iguais (mesmo nome) são reaproveitados e as referências (modelos e dias) são religadas ao alimento local. */
function blMerge(b) {
  if (!b || typeof b !== 'object' || !Array.isArray(b.foods)) return { foods: 0, days: 0 };
  const nm = x => String(x || '').trim().toLowerCase(), map = {}, st = { foods: 0, days: 0, upd: 0, tpl: 0, meals: 0 };
  const D = blDefault(), same = (p, q) => { try { return JSON.stringify(p) === JSON.stringify(q); } catch (e) { return false; } }; /* valor local igual ao padrão do app = ainda não personalizado */
  b.foods.filter(f => f && f.id && typeof f.name === 'string').forEach(f => {
    const same = S.bl.foods.find(x => x.id === f.id && nm(x.name) === nm(f.name)), byName = S.bl.foods.find(x => nm(x.name) === nm(f.name));
    const tgt = same || byName;
    if (tgt) { map[f.id] = tgt.id; const nv = { ...f, id: tgt.id }; if (JSON.stringify(nv) !== JSON.stringify(tgt)) { Object.keys(tgt).forEach(k => delete tgt[k]); Object.assign(tgt, nv); st.upd++; } }
    else { const id = S.bl.foods.some(x => x.id === f.id) ? 'f' + uid() : f.id; S.bl.foods.push({ ...f, id }); map[f.id] = id; st.foods++; }
  });
  const rl = m => { const o = {}; BL_MEALS.forEach(x => { if (Array.isArray(m && m[x.id])) o[x.id] = m[x.id].filter(it => it && map[it.f]).map(it => ({ ...it, f: map[it.f] })); }); return o; };
  const empty = m => !m || BL_MEALS.every(x => !(m[x.id] || []).length);
  if (b.tpl && typeof b.tpl === 'object') ['sem', 'fds'].forEach(k => { if (b.tpl[k] && typeof b.tpl[k] === 'object') { const r = rl(b.tpl[k]), cur = { cafe: [], almoco: [], jantar: [], lanche: [], ...S.bl.tpl[k] }; BL_MEALS.forEach(x => { if (Array.isArray(b.tpl[k][x.id]) && (r[x.id] || []).length && JSON.stringify(cur[x.id]) !== JSON.stringify(r[x.id])) { cur[x.id] = r[x.id]; st.tpl++; } }); S.bl.tpl[k] = cur; } });
  if (b.days && typeof b.days === 'object') Object.keys(b.days).forEach(d => { if (/^\d{4}-\d{2}-\d{2}$/.test(d) && !S.bl.days[d] && b.days[d] && typeof b.days[d] === 'object') { S.bl.days[d] = { cafe: [], almoco: [], jantar: [], lanche: [], ...rl(b.days[d]) }; st.days++; } });
  if (b.ratio >= 1 && b.ratio <= 200) S.bl.ratio = b.ratio;
  if (b.bolusOn && typeof b.bolusOn === 'object') S.bl.bolusOn = { ...S.bl.bolusOn, ...b.bolusOn };
  const rr = blCleanRatios(b.ratios); S.bl.ratios = S.bl.ratios || {}; Object.keys(rr).forEach(k => { S.bl.ratios[k] = rr[k]; });
  const hk = new Set((S.bl.rhist || []).map(x => x.ts + '|' + x.p)); S.bl.rhist = (S.bl.rhist || []).concat(blCleanRhist(b.rhist).filter(x => !hk.has(x.ts + '|' + x.p))).sort((x, y) => x.ts - y.ts).slice(-60);
  const hm = new Set(blMeals().map(m => m.id)), nmeals = blCleanMeals(b.meals).filter(m => !hm.has(m.id)); st.meals = nmeals.length; S.bl.meals = blMeals().concat(nmeals);
  const hr = new Set(blRlog().map(r => r.id)); S.bl.rlog = blRlog().concat(blCleanRlog(b.rlog).filter(r => !hr.has(r.id))).sort((x, y) => x.ts - y.ts);
  return st;
}

VIEWS.bolus = viewBolus; TITLES.bolus = 'Cálculo de bolus';

/* ---- eventos ---- */
document.addEventListener('click', e => {
  const b = e.target.closest('#bl [data-bl]'); if (!b) return; e.stopPropagation();
  const a = b.dataset.bl, m = b.dataset.meal, U = S.blUi;
  if (a === 'ai') { blAi(m || null); return; }
  if (a === 'rlogadd') { openSheet(rlogForm()); return; }
  if (a === 'rlogedit') { const r = blRlog().find(x => x.id === b.dataset.id); if (r) openSheet(rlogForm(r)); return; }
  if (a === 'mealdone') { if (!blSum(m).rows.length) return; openSheet(mealLogForm(null, m)); return; }
  if (a === 'tab') { U.tab = b.dataset.tab; U.pend = null; render(); return; }
  if (a === 'prev') U.date = blAdd(blDate(), -1); else if (a === 'next') U.date = blAdd(blDate(), 1); else if (a === 'today') U.date = null;
  else if (a === 'goto') { U.date = b.dataset.date; U.tab = 'dia'; window.scrollTo(0, 0); }
  else if (a === 'daycommit') { blM(true); blSave(); }
  else if (a === 'daydel') { if (U.pend === 'day-del') { delete S.bl.days[blDate()]; U.pend = null; blSave(); } else { U.pend = 'day-del'; render(); return; } }
  else if (a === 'daytpl') { if (U.pend === 'day-tpl') { S.bl.tpl[blWeekend(blDate()) ? 'fds' : 'sem'] = blClone(blM()); U.pend = null; blSave(); } else { U.pend = 'day-tpl'; render(); return; } }
  else if (a === 'add') { const f = blFood($('#bl-add-' + m).value); if (!f) return; const mm = blM(true); mm[m].push({ f: f.id, q: f.basis === 'g' ? 0 : 1 }); blSave(); render(); const qi = $('#bl-q-' + m + '-' + (mm[m].length - 1)); if (qi) qi.focus(); return; }
  else if (a === 'remove') { blM(true)[m].splice(+b.dataset.idx, 1); blSave(); }
  else if (a === 'reset') { if (U.pend === m) { blM(true)[m] = blClone(blTpl(blDate())[m] || []); U.pend = null; blSave(); } else { U.pend = m; render(); return; } }
  else if (a === 'delfood') { const id = b.dataset.food; S.bl.foods = S.bl.foods.filter(f => f.id !== id); blEach(mm => Object.keys(mm).forEach(k => { mm[k] = (mm[k] || []).filter(it => it.f !== id); })); blSave(); }
  U.pend = a.startsWith('day') ? null : U.pend; render();
}, true);
document.addEventListener('input', e => {
  const t = e.target; if (!t.closest || !t.closest('#bl')) return;
  if (t.dataset.meal !== undefined && t.dataset.idx !== undefined && t.type === 'number') { const q = parseFloat(String(t.value).replace(',', '.')); blM(true)[t.dataset.meal][+t.dataset.idx].q = isNaN(q) || q < 0 ? 0 : q; blSave(); blRefresh(t.dataset.meal); }
});
document.addEventListener('change', e => {
  const t = e.target; if (!t.closest || !t.closest('#bl')) return;
  if (t.id === 'bl-day') { if (/^\d{4}-\d{2}-\d{2}$/.test(t.value)) { S.blUi.date = t.value; S.blUi.pend = null; render(); } return; }
  if (t.id === 'bl-ratio') { const n = parseFloat(String(t.value).replace(',', '.')); if (n >= 1 && n <= 200) { if (n !== S.bl.ratio) blRh('geral', n); S.bl.ratio = n; blSave(); } else toast('Informe um valor entre 1 e 200 g por Ui.'); render(); return; }
  if (t.dataset.blrp) { const id = t.dataset.blrp, txt = String(t.value).trim(), n = parseFloat(txt.replace(',', '.')), cur = S.bl.ratios && S.bl.ratios[id] || null; S.bl.ratios = S.bl.ratios || {};
    if (!txt) { if (cur) { delete S.bl.ratios[id]; blRh(id, null); blSave(); } } else if (n >= 1 && n <= 200) { if (n !== cur) { S.bl.ratios[id] = n; blRh(id, n); blSave(); } } else toast('Informe um valor entre 1 e 200 g por Ui.'); render(); return; }
  if (t.dataset.blon) { S.bl.bolusOn[t.dataset.blon] = t.checked; blSave(); return; }
  if (t.dataset.blunit) { const it = blM(true)[t.dataset.meal][+t.dataset.idx], fd = it && blFood(it.f); if (fd && fd.gpu > 0) { const toG = t.value === 'g', fromG = it.u === 'g'; if (toG && !fromG) it.q = Math.round(it.q * fd.gpu * 100) / 100; else if (!toG && fromG) it.q = Math.round(it.q / fd.gpu * 100) / 100; it.u = toG ? 'g' : 'un'; blSave(); render(); } return; }
  if (t.dataset.food === undefined || !t.dataset.field) return;
  const f = blFood(t.dataset.food); if (!f) return; const k = t.dataset.field;
  if (k === 'name') f.name = t.value.trim() || f.name; else if (k === 'unit') f.unit = t.value.trim() || 'un'; else if (k === 'basis') f.basis = t.value; else if (k === 'est') f.est = t.checked;
  else { const n = parseFloat(String(t.value).replace(',', '.')); f[k] = isNaN(n) || n < 0 ? 0 : n; }
  blSave(); if (k === 'basis' || k === 'name') render();
});
document.addEventListener('keydown', e => { const k = e.target && e.target.dataset && e.target.dataset.blai; if (e.key === 'Enter' && !e.shiftKey && k) { e.preventDefault(); blAi(k === 'lib' ? null : k); } });
document.addEventListener('submit', e => {
  if (e.target.id !== 'bl-new') return; e.preventDefault();
  const g = i => { const n = parseFloat(String($('#bl-nf-' + i).value).replace(',', '.')); return isNaN(n) || n < 0 ? 0 : n; };
  const name = $('#bl-nf-name').value.trim(); if (!name) return; const basis = $('#bl-nf-basis').value;
  S.bl.foods.push({ id: 'f' + Date.now().toString(36), name, basis, unit: basis === 'g' ? 'g' : ($('#bl-nf-unit').value.trim() || 'un'), gpu: basis === 'g' ? 0 : g('gpu'), kcal: g('kcal'), carb: g('carb'), prot: g('prot'), fat: g('fat'), fiber: g('fiber'), est: false });
  blSave(); render();
});
