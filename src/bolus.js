/* ================= Cálculo de bolus (alimentos, refeições e registro por dia) =================
   Regra configurada pela própria pessoa: 1 Ui cobre X g de carboidrato líquido, arredondando para Ui inteira, sem fator de correção.
   O app não olha a glicemia para sugerir dose. Confira sempre antes de aplicar e siga o plano do seu médico. */
const BL_PUBLIC = !!window.TB_PUBLIC; /* versão pública (APK): sem alimentos, refeições nem razão pré-definidos */
const blRule = () => S.bl.ratio >= 1;
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
function blDefault() { if (BL_PUBLIC) return { v: 1, ratio: null, bolusOn: { cafe: true, almoco: true, jantar: false, lanche: false }, foods: [], tpl: { sem: { cafe: [], almoco: [], jantar: [], lanche: [] }, fds: { cafe: [], almoco: [], jantar: [], lanche: [] } }, days: {}, ratioLog: [] };
  return { v: 1, ratio: 15, bolusOn: { cafe: true, almoco: true, jantar: false, lanche: false }, foods: blClone(BL_FOODS), tpl: { sem: blClone(BL_TPL), fds: blClone(BL_TPL) }, days: {}, ratioLog: [] }; }
S.bl = blDefault();
S.blUi = { tab: 'cafe', date: null, pend: null, busy: false, msg: {} };
let blTimer = null;
function blSave() { clearTimeout(blTimer); blTimer = setTimeout(blFlush, 120); }
function blFlush() { clearTimeout(blTimer); try { Store.put('meta', { id: 'bolus', value: S.bl }); } catch (e) { } }
document.addEventListener('visibilitychange', () => { if (document.hidden) blFlush(); });
window.addEventListener('pagehide', blFlush);
function blHasData() { return Object.keys(S.bl.days || {}).length > 0; }
function blLoad(v) {
  if (!v || typeof v !== 'object' || !Array.isArray(v.foods) || !v.tpl || typeof v.tpl !== 'object') return;
  const d = blDefault(), ok = x => x && typeof x === 'object';
  S.bl = { v: 1, ratio: v.ratio >= 1 && v.ratio <= 200 ? v.ratio : (BL_PUBLIC ? null : 15), bolusOn: { ...d.bolusOn, ...(ok(v.bolusOn) ? v.bolusOn : {}) }, foods: v.foods.filter(f => f && f.id && typeof f.name === 'string'), tpl: { sem: ok(v.tpl.sem) ? v.tpl.sem : d.tpl.sem, fds: ok(v.tpl.fds) ? v.tpl.fds : d.tpl.fds }, days: ok(v.days) ? v.days : {}, ratioLog: Array.isArray(v.ratioLog) ? v.ratioLog.filter(x => x && x.id) : [] };
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
const blDose = net => blRule() ? Math.round(net / S.bl.ratio) : 0;
const blOn = id => !!S.bl.bolusOn[id];
const blIc = k => `<svg class="mi" viewBox="0 0 24 24" aria-hidden="true">${k === 'dia' ? '<path d="M5 20V10M12 20V4M19 20v-7"/>' : k === 'alimentos' ? '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>' : MIC[k]}</svg>`;

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
  if (!blRule()) return `<div class="card red hero bl-hero"><div class="hr-top"><div class="eyebrow">Bolus · ${meal.name}</div></div><div class="bl-big"><span class="num">—</span></div><div class="hr-d" style="text-align:center">Defina a sua regra (gramas por Ui) na aba Alimentos. Sem ela o app não calcula.</div></div>`;
  const ex = t.net / S.bl.ratio, ui = blDose(t.net);
  return `<div class="card red hero bl-hero"><div class="hr-top"><div class="eyebrow">Bolus · ${meal.name}</div></div><div class="bl-big"><span class="num">${ui}</span><small>Ui</small></div>${blScale(ex)}<div class="bl-hl"><span class="num">${blN(t.net)} g ÷ ${fn(S.bl.ratio, 1)} = ${blN(ex, 2)}</span><span>arredonda para ${ui} Ui</span></div></div>`;
}

/* ---- Claude calcula alimento novo (só dentro do Claude) ---- */
function blAiBlock(meal) {
  if (!HAS_CLAUDE) return '';
  const k = meal || 'lib', m = S.blUi.msg[k] || {};
  return `<div class="bl-ai"><b>Alimento novo? O Claude calcula.</b><span class="hint">${meal ? 'Diga o alimento e a quantidade, como “1 ovo cozido” ou “150 g de peito de frango grelhado”. Ele é adicionado só nesta refeição.' : 'Digite o nome, com o preparo se quiser, e os valores por 100 g são preenchidos.'}</span>
    <div class="row" style="flex-wrap:wrap"><input class="in grow" style="flex:1 1 100%" id="bl-ai-${k}" data-blai="${k}" placeholder="${meal ? 'Ex.: 1 ovo cozido' : 'Ex.: peito de frango grelhado'}" autocomplete="off" ${S.blUi.busy ? 'disabled' : ''}><button class="btn pri full" data-bl="ai" data-meal="${meal || ''}" ${S.blUi.busy ? 'disabled' : ''}>${S.blUi.busy ? 'Calculando…' : (meal ? 'Calcular e adicionar' : 'Calcular e salvar')}</button></div>
    <p class="hint ${m.err ? 'bl-err' : ''}" style="margin:0" role="status" aria-live="polite">${esc(m.t || '')}</p></div>`;
}
async function blAi(meal) {
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
    <h2 class="sec">Total da refeição</h2><div class="card" id="bl-facts">${t.rows.length ? blFacts(t, true) : '<p class="hint" style="margin:0">Adicione alimentos abaixo para ver os totais.</p>'}</div>
    <h2 class="sec">Alimentos</h2><div class="card">${items ? `<div class="bl-items">${items}</div>` : '<p class="hint" style="margin:0">Nenhum alimento ainda.</p>'}
      <div class="bl-add"><select class="in" id="bl-add-${id}" aria-label="Alimento para adicionar">${S.bl.foods.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}</select><button class="btn pri full" data-bl="add" data-meal="${id}">Adicionar alimento</button><button class="btn full" data-bl="reset" data-meal="${id}">${pend === id ? 'Confirmar: voltar ao padrão' : 'Voltar ao padrão'}</button></div>${blAiBlock(id)}</div>`;
}
function blRefresh(id) {
  const meal = blMeal(id), t = blSum(id);
  $('#bl-hero').innerHTML = blHero(meal, t);
  $('#bl-facts').innerHTML = t.rows.length ? blFacts(t, true) : '<p class="hint" style="margin:0">Adicione alimentos abaixo para ver os totais.</p>';
  (blM()[id] || []).forEach((it, i) => { const el = $('#bl-ch-' + id + '-' + i), c = blCalc(it); if (el && c) el.innerHTML = blChips(c); });
}
function blDayView() {
  const tot = { carb: 0, fiber: 0, net: 0, prot: 0, fat: 0, kcal: 0, est: false }; let ui = 0; const parts = [];
  const rows = BL_MEALS.map(m => {
    const t = blSum(m.id); ['carb', 'fiber', 'net', 'prot', 'fat', 'kcal'].forEach(k => tot[k] += t[k]); if (t.est && t.rows.length) tot.est = true;
    const b = blOn(m.id) ? blDose(t.net) : null; if (b !== null) { ui += b; parts.push(`${m.short} ${b}`); }
    return `<div class="bl-mrow"><div class="row sp"><b>${m.name}</b><span class="tag ${b === null ? '' : 'bl-dose'}">${b === null ? 'sem bolus' : b + ' Ui'}</span></div>${t.rows.length ? `<div class="bl-chips">${blChips(t)}</div>` : '<p class="hint" style="margin:0">Sem alimentos.</p>'}</div>`;
  }).join('');
  const d = blDate(), com = !!S.bl.days[d], wk = blWeekend(d), tn = wk ? 'fim de semana' : 'dias de semana', pend = S.blUi.pend;
  const days = Object.keys(S.bl.days).filter(k => BL_MEALS.some(m => (S.bl.days[k][m.id] || []).length)).sort().reverse().slice(0, 60);
  return `<div class="card red hero bl-hero"><div class="hr-top"><div class="eyebrow">Bolus do dia</div></div><div class="bl-big"><span class="num">${ui}</span><small>Ui</small></div><div class="bl-hl"><span>${esc(parts.join(' + ')) || 'nenhuma refeição com bolus'}</span></div></div>
    <h2 class="sec">Total do dia</h2><div class="card">${blFacts(tot, true)}</div>
    <h2 class="sec">Por refeição</h2><div class="card bl-mrows">${rows}</div>
    <h2 class="sec">Registro do dia</h2><div class="card"><p class="hint" style="margin:0 0 12px">${com ? 'Este dia está salvo no histórico.' : `Este dia mostra o padrão de ${tn} e ainda não está no histórico. Qualquer alteração que você fizer o registra.`}</p><div class="stack" style="gap:8px">${com ? `<button class="btn full" data-bl="daydel">${pend === 'day-del' ? 'Confirmar: apagar registro' : 'Apagar registro do dia'}</button>` : `<button class="btn pri full" data-bl="daycommit">Registrar este dia</button>`}<button class="btn full" data-bl="daytpl">${pend === 'day-tpl' ? 'Confirmar: trocar o padrão' : 'Usar como padrão de ' + tn}</button></div></div>
    <h2 class="sec">Histórico</h2><div class="card">${days.length ? days.map(k => { let u = 0, net = 0; const ps = []; BL_MEALS.forEach(m => { const t = blSum(m.id, S.bl.days[k]); net += t.net; if (blOn(m.id)) { const b = blDose(t.net); u += b; ps.push(`${m.short} ${b}`); } }); const dt = k.split('-').map(Number), w = WD[new Date(dt[0], dt[1] - 1, dt[2]).getDay()];
      return `<button class="bl-h ${k === d ? 'cur' : ''}" data-bl="goto" data-date="${k}"><span><b>${w} · ${fmtDate(k)}</b><small class="dim">${esc(ps.join(' · '))} · ${blN(net)} g líq.</small></span><span class="tag bl-dose">${u} Ui</span></button>`; }).join('') : '<p class="hint" style="margin:0">Nenhum dia registrado ainda. Registre o dia de hoje acima.</p>'}</div>`;
}
function blNum(id, field, label, v) { return `<label class="bl-fl">${label}<input class="in num" type="number" inputmode="decimal" step="any" min="0" data-food="${id}" data-field="${field}" value="${Math.round(v * 100) / 100}"></label>`; }
function blFoodsView() {
  const rule = `<h2 class="sec">Regra do bolus</h2><div class="card"><p class="hint" style="margin:0 0 12px">Defina a regra combinada com a sua equipe de saúde. O app só faz a conta com ela: não usa glicemia nem fator de correção.</p>
    <div class="field"><label class="fl" for="bl-ratio">1 Ui cobre quantos gramas de carboidrato líquido?</label><input class="in num" id="bl-ratio" type="number" inputmode="decimal" step="any" min="1" max="200" value="${S.bl.ratio || ''}" placeholder="Preencha conforme orientação profissional"></div>
    <details class="more" style="margin-top:12px"><summary>Como descobrir minha razão?</summary><div class="hint"><p>A razão insulina/carboidratos informa quantos gramas de carboidrato são cobertos por 1 unidade de insulina rápida. Exemplo apenas ilustrativo: 1 U para 15 g.</p><ol><li>Peça ao endocrinologista ou educador em diabetes a razão indicada para cada refeição.</li><li>Confira o plano escrito, receita ou orientação de alta, se houver.</li><li>Se não encontrar esse dado, não tente deduzi-lo sozinho. Peça à equipe que o determine.</li><li>Registre aqui a orientação recebida. Algumas pessoas têm razões diferentes no café, almoço e jantar.</li></ol><p>O aplicativo não determina, valida nem ajusta sua razão. Não use registros isolados para alterar doses.</p></div></details>
    <div class="fl" style="margin:14px 0 8px">Refeições com bolus</div><div class="row">${BL_MEALS.map(m => `<label class="bl-chk"><input type="checkbox" data-blon="${m.id}" ${blOn(m.id) ? 'checked' : ''}><span>${m.short}</span></label>`).join('')}</div></div>`;
  const cards = S.bl.foods.map(f => `<div class="bl-food"><div class="row" style="flex-wrap:nowrap"><input class="in" data-food="${f.id}" data-field="name" value="${esc(f.name)}" aria-label="Nome"><button class="btn danger sm" data-bl="delfood" data-food="${f.id}">Excluir</button></div>
    <div class="row" style="margin-top:10px"><label class="bl-fl">Base<select class="in" data-food="${f.id}" data-field="basis"><option value="g"${f.basis === 'g' ? ' selected' : ''}>100 g</option><option value="un"${f.basis === 'un' ? ' selected' : ''}>Unidade</option></select></label>${f.basis === 'un' ? `<label class="bl-fl">Unidade<input class="in" data-food="${f.id}" data-field="unit" value="${esc(f.unit || '')}"></label><label class="bl-fl">g por unidade<input class="in num" type="number" inputmode="decimal" step="any" min="0" data-food="${f.id}" data-field="gpu" value="${f.gpu || 0}"></label>` : ''}</div>
    <label class="bl-chk" style="margin-top:10px"><input type="checkbox" data-food="${f.id}" data-field="est" ${f.est ? 'checked' : ''}><span>Valores estimados</span></label><p class="hint" style="margin:8px 0">Valores ${f.basis === 'g' ? 'por 100 g' : 'por ' + esc(f.unit || 'unidade')}</p>
    <div class="bl-grid">${blNum(f.id, 'carb', 'Carb. tot. (g)', f.carb)}${blNum(f.id, 'fiber', 'Fibras (g)', f.fiber)}${blNum(f.id, 'prot', 'Prot. (g)', f.prot)}${blNum(f.id, 'fat', 'Gord. (g)', f.fat)}${blNum(f.id, 'kcal', 'kcal', f.kcal)}</div></div>`).join('');
  const ratioLog = `<h2 class="sec">Registros para conversar com sua equipe</h2><div class="card"><p class="hint" style="margin:0 0 10px">Registre o que foi orientado ou observado. A relação carboidratos ÷ insulina é apenas um dado histórico e não altera sua razão configurada.</p><form id="bl-ratio-log" class="stack" style="gap:10px"><div class="form-grid"><div class="field"><label class="fl" for="br-date">Data</label><input class="in" type="date" id="br-date" value="${isoDate(new Date())}" required></div><div class="field"><label class="fl" for="br-meal">Período</label><select class="in" id="br-meal"><option value="cafe">Café da manhã</option><option value="almoco">Almoço</option><option value="jantar">Jantar</option><option value="lanche">Lanche</option></select></div><div class="field"><label class="fl" for="br-ins-time">Horário da aplicação</label><input class="in" type="time" id="br-ins-time"></div><div class="field"><label class="fl" for="br-meal-time">Horário da refeição</label><input class="in" type="time" id="br-meal-time"></div><div class="field"><label class="fl" for="br-ins">Insulina rápida (U)</label><input class="in" type="number" min="0.1" step="0.1" id="br-ins" required></div><div class="field"><label class="fl" for="br-carb">Carboidratos (g)</label><input class="in" type="number" min="0" step="0.1" id="br-carb" required></div><div class="field"><label class="fl" for="br-before">Glicemia antes (mg/dL)</label><input class="in" type="number" min="20" max="1000" id="br-before"></div><div class="field"><label class="fl" for="br-after">Glicemia depois (mg/dL)</label><input class="in" type="number" min="20" max="1000" id="br-after"></div><div class="field full"><label class="fl" for="br-insulin">Tipo/nome da insulina</label><input class="in" id="br-insulin" maxlength="80" placeholder="Conforme seu tratamento"></div><div class="field full"><label class="fl" for="br-notes">Observações</label><textarea class="in" id="br-notes" rows="2" maxlength="300"></textarea></div></div><button class="btn pri full" type="submit">Salvar registro</button></form>${(S.bl.ratioLog || []).length ? `<div class="stack" style="margin-top:12px">${S.bl.ratioLog.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(x=>`<div class="row sp"><span><b>${fmtDate(x.date)} · ${({cafe:'Café',almoco:'Almoço',jantar:'Jantar',lanche:'Lanche'})[x.meal] || x.meal}</b><small class="dim">${x.carbs} g ÷ ${x.units} U = ${(x.carbs/x.units).toFixed(1)} g/U · ${esc(x.insulin || 'Insulina não informada')}</small></span></div>`).join('')}</div>` : '<p class="hint" style="margin:10px 0 0">Nenhum registro adicionado.</p>'}</div>`;
  return rule + ratioLog + `<h2 class="sec">Seus alimentos</h2><p class="hint" style="margin:0 2px 10px">Valores por 100 g ou por unidade. Itens estimados vêm de tabelas médias: troque pelos números do rótulo.</p><div class="stack">${cards}</div>
    <h2 class="sec">Novo alimento</h2><div class="card">${blAiBlock(null)}<form id="bl-new" class="stack" style="gap:10px;${HAS_CLAUDE ? 'margin-top:14px' : ''}">${HAS_CLAUDE ? '<p class="hint" style="margin:0">Ou preencha à mão:</p>' : ''}<input class="in" id="bl-nf-name" placeholder="Nome do alimento" required><div class="row"><select class="in" id="bl-nf-basis" style="flex:1 1 120px"><option value="g">Por 100 g</option><option value="un">Por unidade</option></select><input class="in" id="bl-nf-unit" placeholder="Unidade (ex.: fatia)" style="flex:1 1 120px"><input class="in num" type="number" inputmode="decimal" step="any" min="0" id="bl-nf-gpu" placeholder="g por unidade" style="flex:1 1 120px"></div>
    <div class="bl-grid">${['carb:Carb. tot. (g)', 'fiber:Fibras (g)', 'prot:Prot. (g)', 'fat:Gord. (g)', 'kcal:kcal'].map(x => { const [k, l] = x.split(':'); return `<label class="bl-fl">${l}<input class="in num" type="number" inputmode="decimal" step="any" min="0" id="bl-nf-${k}" value="0"></label>`; }).join('')}</div><button class="btn pri full" type="submit">Salvar alimento</button></form></div>`;
}
function viewBolus() {
  const tab = S.blUi.tab, d = blDate(), com = !!S.bl.days[d], isT = d === blToday();
  const tabs = BL_MEALS.map(m => ({ id: m.id, l: m.short, ic: m.ic })).concat([{ id: 'dia', l: 'Dia', ic: 'dia' }, { id: 'alimentos', l: 'Alimentos', ic: 'alimentos' }]);
  const dt = d.split('-').map(Number), wd = new Date(dt[0], dt[1] - 1, dt[2]).getDay();
  const bar = tab === 'alimentos' ? '' : `<div class="bl-date"><button class="btn" data-bl="prev" aria-label="Dia anterior">‹</button><input class="in" type="date" id="bl-day" value="${d}" aria-label="Escolher o dia"><button class="btn" data-bl="next" aria-label="Próximo dia">›</button></div>
    <div class="row" style="margin:10px 2px 0;gap:6px"><span class="tag">${WD[wd]} · ${fmtDate(d)}</span><span id="bl-dstat" class="tag ${com ? 'on' : ''}">${com ? 'Registrado' : 'Não registrado'}</span><span class="tag">${blWeekend(d) ? 'Fim de semana' : 'Dia de semana'}</span>${isT ? '' : '<button class="btn sm" data-bl="today">Ir para hoje</button>'}</div>`;
  return banners() + (VIEWS.ia ? `<div class="card soft" style="margin-bottom:12px"><p class="hint" style="margin:0 0 8px">A identificação automática de alimentos depende da configuração da IA. Sem ela, cadastre os alimentos e os carboidratos manualmente.</p><button class="btn full" data-act="go" data-r="ia">Configurar inteligência artificial</button></div>` : '') + `<div id="bl"><div class="bl-tabs" role="tablist">${tabs.map(t => `<button class="seg-b ${t.id === tab ? 'on' : ''}" role="tab" aria-selected="${t.id === tab}" data-bl="tab" data-tab="${t.id}">${blIc(t.ic)}<span>${t.l}</span></button>`).join('')}</div>${bar}
    <div class="stack" style="margin-top:14px;gap:0">${tab === 'dia' ? blDayView() : tab === 'alimentos' ? blFoodsView() : blMealView(tab)}</div>
    <p class="hint" style="margin:18px 2px 0">Carboidrato líquido = carboidratos totais − fibras. A dose é calculada só com a sua regra (${blRule() ? '1 Ui a cada ' + fn(S.bl.ratio, 1) + ' g' : 'regra ainda não definida'}, arredondada para Ui inteira). Confira sempre o resultado antes de aplicar e siga o plano do seu médico. Em emergência, ligue 192 (SAMU).</p></div>`;
}
VIEWS.bolus = viewBolus; TITLES.bolus = 'Cálculo de bolus';

/* ---- eventos ---- */
document.addEventListener('click', e => {
  const b = e.target.closest('#bl [data-bl]'); if (!b) return; e.stopPropagation();
  const a = b.dataset.bl, m = b.dataset.meal, U = S.blUi;
  if (a === 'ai') { blAi(m || null); return; }
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
  if (t.id === 'bl-ratio') { const n = parseFloat(String(t.value).replace(',', '.')); if (n >= 1 && n <= 200) { S.bl.ratio = n; blSave(); } else toast('Informe um valor entre 1 e 200 g por Ui.'); render(); return; }
  if (t.dataset.blon) { S.bl.bolusOn[t.dataset.blon] = t.checked; blSave(); return; }
  if (t.dataset.blunit) { const it = blM(true)[t.dataset.meal][+t.dataset.idx], fd = it && blFood(it.f); if (fd && fd.gpu > 0) { const toG = t.value === 'g', fromG = it.u === 'g'; if (toG && !fromG) it.q = Math.round(it.q * fd.gpu * 100) / 100; else if (!toG && fromG) it.q = Math.round(it.q / fd.gpu * 100) / 100; it.u = toG ? 'g' : 'un'; blSave(); render(); } return; }
  if (t.dataset.food === undefined || !t.dataset.field) return;
  const f = blFood(t.dataset.food); if (!f) return; const k = t.dataset.field;
  if (k === 'name') f.name = t.value.trim() || f.name; else if (k === 'unit') f.unit = t.value.trim() || 'un'; else if (k === 'basis') f.basis = t.value; else if (k === 'est') f.est = t.checked;
  else { const n = parseFloat(String(t.value).replace(',', '.')); f[k] = isNaN(n) || n < 0 ? 0 : n; }
  blSave(); if (k === 'basis' || k === 'name') render();
});
document.addEventListener('keydown', e => { const k = e.target && e.target.dataset && e.target.dataset.blai; if (e.key === 'Enter' && k) { e.preventDefault(); blAi(k === 'lib' ? null : k); } });
document.addEventListener('submit', e => {
  if (e.target.id === 'bl-ratio-log') { e.preventDefault(); const units = parseFloat($('#br-ins').value), carbs = parseFloat($('#br-carb').value); if (!(units > 0) || !(carbs >= 0)) { toast('Informe insulina e carboidratos válidos.'); return; } S.bl.ratioLog = S.bl.ratioLog || []; S.bl.ratioLog.push({ id: 'rl' + Date.now().toString(36), date: $('#br-date').value, meal: $('#br-meal').value, insulinTime: $('#br-ins-time').value, mealTime: $('#br-meal-time').value, units, carbs, before: $('#br-before').value ? +$('#br-before').value : null, after: $('#br-after').value ? +$('#br-after').value : null, insulin: $('#br-insulin').value.trim(), notes: $('#br-notes').value.trim() }); blSave(); render(); toast('Registro salvo. Ele não altera sua razão configurada.'); return; }
  if (e.target.id !== 'bl-new') return; e.preventDefault();
  const g = i => { const n = parseFloat(String($('#bl-nf-' + i).value).replace(',', '.')); return isNaN(n) || n < 0 ? 0 : n; };
  const name = $('#bl-nf-name').value.trim(); if (!name) return; const basis = $('#bl-nf-basis').value;
  S.bl.foods.push({ id: 'f' + Date.now().toString(36), name, basis, unit: basis === 'g' ? 'g' : ($('#bl-nf-unit').value.trim() || 'un'), gpu: basis === 'g' ? 0 : g('gpu'), kcal: g('kcal'), carb: g('carb'), prot: g('prot'), fat: g('fat'), fiber: g('fiber'), est: false });
  blSave(); render();
});
