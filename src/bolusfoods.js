/* ================= Biblioteca de alimentos: Alimentos frequentes por refeição =================
   Uma única base de alimentos (S.bl.foods) serve ao menu Alimentos e a todas as refeições.
   Cada alimento pode ter: meals (refeições em que é frequente), pr (prioridade inicial por refeição, 1 a 3),
   ref (porção de referência, na unidade do alimento), grp (grupo, para variar a lista) e fav (favorito).
   Nada aqui altera razão, dose ou regra de cálculo: a lista só facilita escolher o alimento. */
const BL_MKEY = { c: 'cafe', a: 'almoco', l: 'lanche', j: 'jantar', e: 'ceia' };
/* id | nome | unidade ('g' = por 100 g) | g por unidade | kcal | carb. totais | prot. | gord. | fibras (por 100 g) | porção de referência | grupo | refeições (letra + prioridade 1 a 3) */
const BL_PRE_ROWS = [
  'pao|Pão francês|un|50|300|58.6|8|3.1|2.3|1|pao|c1 l2 j3',
  'pf-int|Pão de forma integral|fatia|25|253|49.9|9.4|3.7|6.9|2|pao|c1 l1 j3 e3',
  'pf-br|Pão de forma branco|fatia|25|270|50|8|4|2.3|2|pao|c2 l2 j3 e3',
  'tapioca|Tapioca (goma hidratada)|g|0|240|59.2|0|0|0|60|amil|c1 l2 j3 e3',
  'cuscuz|Cuscuz de milho|g|0|113|25.3|2.2|0.7|2.1|120|cereal|c1 j2 l3 a3',
  'pao-q|Pão de queijo|un|20|363|34.2|5.1|24.6|0.6|2|pao|c2 l1',
  'ovo|Ovo cozido|un|50|146|0.6|13.3|9.5|0|1|prot|c1 a3 j1 e3',
  'qmin|Queijo minas frescal|fatia|30|264|3.2|17.4|20.2|0|1|lat|c1 l1 j2 e2',
  'qmuc|Queijo muçarela|fatia|20|330|3|22.6|25.2|0|1|lat|c2 l1 j2',
  'pres|Presunto|fatia|15|94|1.4|14.4|2.7|0|2|prot|c2 l2 j3',
  'reqj|Requeijão cremoso|colher de sopa|25|257|2.4|9.6|23.4|0|1|lat|c2 l3',
  'mant|Manteiga|colher de chá|5|726|0.1|0.4|82|0|1|gord|c2 l3',
  'margarina|Margarina|colher de chá|5|720|0|0|80|0|1|gord|c2 l3 j3',
  'leite-i|Leite integral|copo|200|61|4.7|3.2|3.3|0|1|beb|c1 l2 e1',
  'iogn|Iogurte natural integral|pote|170|51|1.9|4.1|3|0|1|lat|c2 l1 e1',
  'iogg|Iogurte grego natural|pote|100|97|4|9|5|0|1|lat|e2 l3',
  'cafe-p|Café sem açúcar|xícara|50|2|0.8|0.1|0|0|1|beb|c1 l2',
  'cha|Chá sem açúcar|xícara|200|1|0.2|0|0|0|1|beb|e1',
  'banana|Banana prata|un|70|98|26|1.3|0.1|2|1|fruta|c1 l1 e1',
  'mamao|Mamão papaia|fatia|100|40|10.4|0.5|0.1|1|1|fruta|c1 l2 e2',
  'maca|Maçã|un|130|56|15.2|0.3|0|1.3|1|fruta|c2 l1 e1',
  'pera|Pêra|un|140|53|14|0.6|0.1|3|1|fruta|l2 e2 c3',
  'uva|Uva|g|0|53|13.6|0.7|0.2|0.9|100|fruta|l2 e3',
  'melancia|Melancia|g|0|33|8.1|0.9|0|0.1|150|fruta|l3',
  'abacaxi|Abacaxi|fatia|75|48|12.3|0.9|0.1|1|1|fruta|l3 c3',
  'morango|Morango|g|0|30|6.8|0.9|0.3|1.7|100|fruta|e2 l3 c3',
  'kiwi|Kiwi|un|75|51|11.5|1.3|0.6|2.7|1|fruta|e3 l3',
  'laranja|Laranja|un|180|37|8.9|1|0.1|0.8|1|fruta|a3 l2 c3',
  'suco-l|Suco de laranja natural (sem açúcar)|copo|200|41|9.5|0.7|0.1|0.2|1|beb|c2 l3',
  'aveia|Aveia em flocos|colher de sopa|15|394|67|13.9|8.5|9.1|2|cereal|c2 l3 e2',
  'bolo|Bolo simples|fatia|60|363|59.2|6.1|11.2|1.3|1|dce|c3 l2',
  'cracker|Biscoito cream cracker|un|6|432|68.7|10.1|14.4|2.5|3|dce|c3 l1 e1',
  'maria|Biscoito maria|un|6|443|75.2|8|11.8|2.1|4|dce|l2 e3',
  'barra|Barra de cereal|un|25|390|70|5|9|4|1|dce|l3',
  'pipoca|Pipoca (com óleo, sem sal)|g|0|448|60.1|9.9|15.9|14.3|20|cereal|l3',
  'cast-p|Castanha-do-pará|un|4|643|15.1|14.5|63.5|7.9|2|ole|l2 e2',
  'cast-c|Castanha-de-caju|un|2|570|29.1|18.5|46.3|3.7|5|ole|l2 e1',
  'amend|Amendoim torrado|g|0|606|18.7|22.5|54|7.8|20|ole|l2 e3',
  'arroz|Arroz parboilizado cozido|g|0|123|26|2.6|0.3|1|100|cereal|a1 j1',
  'arroz-b|Arroz branco cozido|g|0|128|28.1|2.5|0.2|1.6|100|cereal|a1 j1',
  'arroz-i|Arroz integral cozido|g|0|124|25.8|2.6|1|2.7|100|cereal|a2 j2',
  'fj-car|Feijão carioca cozido|g|0|76|13.6|4.8|0.5|8.5|100|leg|a1 j1',
  'fj-pre|Feijão preto cozido|g|0|77|14|4.5|0.5|8.4|100|leg|a2 j2',
  'feijao|Feijão de corda cozido|g|0|80|14|5.5|0.5|4.5|100|leg|a2 j3',
  'lent|Lentilha cozida|g|0|93|16.3|6.3|0.5|7.9|80|leg|a3 j3',
  'gbico|Grão-de-bico cozido|g|0|164|27.4|8.9|2.6|7.6|80|leg|a3 j3',
  'mac|Macarrão cozido|g|0|102|19.9|3.4|0.5|1.4|140|cereal|a2 j2',
  'bat|Batata inglesa cozida|g|0|52|11.9|1.2|0|1.3|100|amil|a2 j2',
  'bat-d|Batata-doce cozida|g|0|77|18.4|0.6|0.1|2.2|100|amil|a2 j2',
  'mand|Mandioca cozida|g|0|125|30.1|0.6|0.3|1.6|100|amil|a2 j2',
  'pure|Purê de batata|g|0|83|14.7|1.8|1.8|1.1|100|amil|a3 j3',
  'farofa|Farofa de mandioca|g|0|365|89.2|1.2|0.3|6.5|30|cereal|a3 j3',
  'frgr|Frango grelhado (peito)|g|0|159|0|32|2.5|0|120|prot|a1 j1',
  'carne|Carne bovina grelhada (patinho)|g|0|219|0|35.9|7.3|0|100|prot|a1 j2',
  'peixe|Peixe grelhado (tilápia)|g|0|128|0|26.1|2.7|0|120|prot|a2 j2',
  'alface|Alface|g|0|14|2.4|1.4|0.2|2|50|verd|a1 j1',
  'tom|Tomate|g|0|15|3.1|1.1|0.2|1.2|60|verd|a1 j1',
  'cen|Cenoura cozida|g|0|30|6.7|0.8|0.2|2.6|60|verd|a2 j2',
  'broc|Brócolis cozido|g|0|25|4.4|2.1|0.5|3.4|70|verd|a2 j2',
  'couve|Couve refogada|g|0|90|8.7|1.7|6.6|5.7|40|verd|a3 j3',
  'abob|Abobrinha cozida|g|0|15|3|1.1|0.2|1.4|70|verd|a3 j2',
  'beter|Beterraba cozida|g|0|32|7.2|1.3|0.1|3.4|50|verd|a3 j3',
  'sopa|Sopa de legumes|g|0|45|7.5|1.7|1|1.2|300|sopa|j2'
];
/* alimentos pessoais já existentes na biblioteca (versão não pública): só ganham refeição e porção, nada mais muda */
const BL_PERS = { leite: ['c1', 37], whey: ['c2', 1], linhaca: ['c3', 1], chia: ['c3', 1], psyllium: ['c3', 4], 'arroz-leite': ['a3 j3', 100], frango: ['a2 j2', 100], macarrao: ['a2 j2', 140] };
const blNm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
function blPreParse(r) {
  const p = r.split('|'), n = x => parseFloat(x), unit = p[2], g = unit === 'g', gpu = n(p[3]), k = g ? 1 : gpu / 100;
  const food = { id: p[0], name: p[1], basis: g ? 'g' : 'un', unit: g ? 'g' : unit, gpu: g ? 0 : gpu, kcal: n(p[4]) * k, carb: n(p[5]) * k, prot: n(p[6]) * k, fat: n(p[7]) * k, fiber: n(p[8]) * k, est: true, ref: n(p[9]), grp: p[10] };
  return { food, tok: p[11] };
}
function blTokens(tok) { const meals = [], pr = {}; String(tok || '').split(/\s+/).filter(Boolean).forEach(t => { const m = BL_MKEY[t[0]]; if (m) { meals.push(m); pr[m] = +t[1] || 2; } }); return { meals, pr }; }
/* mantém um único cadastro: o que já existe só ganha refeição, prioridade e porção; o que falta é incluído (valores estimados) */
function blSeed(bl) {
  if (!bl || bl.seed >= 1) return bl;
  bl.foods = bl.foods || [];
  const apply = (f, tok, ref, grp) => { const t = blTokens(tok); if (f.meals === undefined) { f.meals = t.meals; f.pr = t.pr; } if (!(f.ref > 0) && ref > 0) f.ref = ref; if (!f.grp && grp) f.grp = grp; };
  BL_PRE_ROWS.forEach(r => {
    const { food, tok } = blPreParse(r), ex = bl.foods.find(x => x.id === food.id) || bl.foods.find(x => blNm(x.name) === blNm(food.name));
    if (ex) apply(ex, tok, food.ref, food.grp); else { const t = blTokens(tok); food.meals = t.meals; food.pr = t.pr; bl.foods.push(food); }
  });
  Object.keys(BL_PERS).forEach(id => { const ex = bl.foods.find(x => x.id === id); if (ex) apply(ex, BL_PERS[id][0], BL_PERS[id][1], ''); });
  /* o que já está nos padrões de refeição de cada pessoa passa a ser frequente naquela refeição */
  ['sem', 'fds'].forEach(k => { const t = bl.tpl && bl.tpl[k]; if (t) Object.keys(t).forEach(m => (t[m] || []).forEach(it => { const f = bl.foods.find(x => x.id === it.f); if (f) { f.meals = f.meals || []; if (!f.meals.includes(m)) f.meals.push(m); } })); });
  bl.foods.forEach(f => { if (!Array.isArray(f.meals)) f.meals = []; });
  bl.seed = 1; return bl;
}
const blEmptyM = () => ({ cafe: [], almoco: [], lanche: [], jantar: [], ceia: [] });
function blNorm(bl) { /* refeições novas (ex.: ceia) em dados antigos */
  const fix = m => { if (m && typeof m === 'object') Object.keys(blEmptyM()).forEach(k => { if (!Array.isArray(m[k])) m[k] = []; }); };
  if (bl.tpl) { fix(bl.tpl.sem); fix(bl.tpl.fds); } Object.values(bl.days || {}).forEach(fix); return bl;
}
const blL = (mm, m) => mm[m] || (mm[m] = []);

/* ---- uso real: quantas vezes cada alimento entrou naquela refeição (últimos 90 dias) ---- */
function blUse(meal) {
  const out = {}, lim = isoDate(new Date(Date.now() - 90 * 864e5));
  Object.keys(S.bl.days || {}).forEach(d => { if (d >= lim) ((S.bl.days[d] || {})[meal] || []).forEach(it => { out[it.f] = (out[it.f] || 0) + 1; }); });
  return out;
}
const blRefOf = f => f.ref > 0 ? f.ref : (f.basis === 'g' ? 100 : 1);
/* ordem da lista de frequentes: adequação à refeição, favoritos, histórico pessoal, carboidrato (relevante para o bolus) e variedade */
function blFreqList(meal) {
  const use = blUse(meal), cand = S.bl.foods.filter(f => (f.meals || []).includes(meal) || (use[f.id] || 0) >= 2);
  const sc = cand.map(f => {
    const pr = (f.pr && f.pr[meal]) || 2, c = blCalc({ f: f.id, q: blRefOf(f) }), net = c ? c.net : 0;
    return { f, s: (4 - pr) * 12 + (f.fav ? 30 : 0) + Math.min(40, (use[f.id] || 0) * 4) + (net >= 8 ? 6 : net >= 3 ? 3 : 0) };
  });
  const out = [], seen = {};
  while (sc.length) {
    let bi = 0, bs = -1e9;
    sc.forEach((x, i) => { const v = x.s - 5 * (seen[x.f.grp || x.f.id] || 0); if (v > bs) { bs = v; bi = i; } });
    const x = sc.splice(bi, 1)[0]; seen[x.f.grp || x.f.id] = (seen[x.f.grp || x.f.id] || 0) + 1; out.push(x.f);
  }
  return out;
}

/* ---- adicionar ao cálculo: um alimento repetido soma a quantidade no mesmo item ---- */
function blAddFood(meal, fid, q) {
  const f = blFood(fid); if (!f) return null;
  const mm = blM(true), list = blL(mm, meal), q0 = q != null ? q : (f.ref > 0 ? f.ref : (f.basis === 'g' ? 0 : 1));
  const ex = list.find(x => x.f === fid);
  if (ex) { const add = ex.u === 'g' && f.gpu > 0 ? q0 * f.gpu : q0; ex.q = Math.round(((ex.q || 0) + add) * 100) / 100; if (q == null && f.ref > 0) ex.r = 1; blSave(); return ex; }
  const it = { f: fid, q: q0 }; if (q == null && f.ref > 0) it.r = 1; list.push(it); blSave(); return it;
}

/* ---- etiquetas nutricionais (mesma linguagem na refeição, no total e no menu Alimentos) ---- */
const blQtyTxt = q => String(Math.round((q || 0) * 100) / 100).replace('.', ',');
function blPortion(f, q, u) {
  if (f.basis === 'g' || u === 'g') return `${blQtyTxt(q)} g`;
  return `${blQtyTxt(q)} ${blUnit(f)}` + (f.gpu > 0 ? ` (≈ ${blQtyTxt(q * f.gpu)} g)` : '');
}
function blNutri(c, portion) {
  const t = (l, v, u, cls) => `<div${cls ? ` class="${cls}"` : ''}><dt>${l}</dt><dd class="num">${v}<small>${u}</small></dd></div>`;
  return `<div class="nu"><div class="nu-net"><span class="nu-l"><b>Carboidratos líquidos</b><small>carboidratos totais − fibras</small></span><span class="nu-v num">${blN(c.net)}<small>g</small></span></div>
    <dl class="nu-g">${portion ? `<div class="wide"><dt>Porção considerada</dt><dd class="num nu-p">${esc(portion)}</dd></div>` : ''}${t('Carboidratos totais', blN(c.carb), 'g')}${t('Fibras', blN(c.fiber), 'g')}${t('Proteínas', blN(c.prot), 'g')}${t('Gorduras', blN(c.fat), 'g')}${t('Calorias', blN(c.kcal, 0), 'kcal', 'wide')}</dl></div>`;
}
const blFoodNutri = f => { const q = f.basis === 'g' ? 100 : 1; return blNutri(blCalc({ f: f.id, q }), f.basis === 'g' ? '100 g' : blPortion(f, 1)); };

/* ---- bloco "Alimentos frequentes" de cada refeição ---- */
function blChip(meal, f, n) {
  const ref = blRefOf(f), c = blCalc({ f: f.id, q: ref }), it = (blM()[meal] || []).find(x => x.f === f.id);
  return `<button type="button" class="bl-fc${f.fav ? ' fav' : ''}${it ? ' in' : ''}" data-bl="addf" data-meal="${meal}" data-food="${esc(f.id)}" aria-label="Adicionar ${esc(f.name)}, porção de referência ${esc(blPortion(f, ref))}">
    <span class="fc-n">${f.fav ? '<i aria-hidden="true">★</i> ' : ''}${esc(f.name)}</span><span class="fc-m">${esc(blPortion(f, ref))} · líq. ${f.est ? '≈ ' : ''}${blN(c ? c.net : 0)} g</span>${it ? `<span class="fc-k">na refeição</span>` : ''}</button>`;
}
function blFreqHTML(meal) {
  const all = blFreqList(meal), open = S.blUi.fall && S.blUi.fall[meal], list = open ? all : all.slice(0, 8);
  return `<div class="bl-fm-h"><b>Alimentos frequentes</b><small>Toque para adicionar a porção de referência e depois ajuste para a quantidade real que você comeu. Valores com ≈ são estimados.</small></div>
    ${list.length ? `<div class="bl-fm-g">${list.map(f => blChip(meal, f)).join('')}</div>` : '<p class="hint" style="margin:0">Nenhum alimento frequente nesta refeição. Marque em Alimentos, ou busque abaixo.</p>'}
    ${all.length > 8 ? `<button type="button" class="btn sm full" data-bl="fmall" data-meal="${meal}">${open ? 'Mostrar menos' : 'Ver todos os frequentes (' + all.length + ')'}</button>` : ''}`;
}
function blSearchHTML(meal) {
  return `<div class="bl-srch"><label class="fl" for="bl-s-${meal}">Buscar em toda a biblioteca</label><input class="in" type="search" id="bl-s-${meal}" data-blsearch="${meal}" placeholder="Digite o nome do alimento" autocomplete="off" enterkeyhint="search"><div class="bl-sr" id="bl-sr-${meal}" aria-live="polite"></div></div>`;
}
function blSearchRes(meal, q) {
  const s = blNm(q); if (!s) return '';
  const use = blUse(meal), hit = S.bl.foods.filter(f => blNm(f.name).includes(s)).sort((a, b) => (blNm(b.name).startsWith(s) - blNm(a.name).startsWith(s)) || ((b.fav ? 1 : 0) - (a.fav ? 1 : 0)) || ((use[b.id] || 0) - (use[a.id] || 0)) || a.name.localeCompare(b.name, 'pt-BR'));
  if (!hit.length) return '<p class="hint" style="margin:8px 0 0">Nada encontrado. Cadastre o alimento em Alimentos.</p>';
  return hit.slice(0, 30).map(f => { const ref = blRefOf(f), c = blCalc({ f: f.id, q: ref });
    return `<button type="button" class="bl-sri" data-bl="addf" data-meal="${meal}" data-food="${esc(f.id)}"><span class="fc-n">${f.fav ? '<i aria-hidden="true">★</i> ' : ''}${esc(f.name)}</span><span class="fc-m">${esc(blPortion(f, ref))} · líq. ${f.est ? '≈ ' : ''}${blN(c ? c.net : 0)} g</span></button>`; }).join('');
}

/* ---- item da refeição ---- */
function blItemHTML(id, it, i) {
  const f = blFood(it.f); if (!f) return ''; const c = blCalc(it);
  return `<div class="bl-item"><div class="row sp" style="align-items:flex-start;flex-wrap:nowrap"><span class="bl-nm">${esc(f.name)}${f.est ? ' <span class="tag">est.</span>' : ''}${it.n ? `<small class="dim">pedido: ${esc(it.n)}</small>` : ''}</span><button class="bl-x" data-bl="remove" data-meal="${id}" data-idx="${i}" aria-label="Remover ${esc(f.name)}">×</button></div>
    <div class="bl-qr"><label class="fl" for="bl-q-${id}-${i}">Quantidade</label><div class="row" style="flex-wrap:nowrap"><input class="in bl-q num" type="number" inputmode="decimal" step="any" min="0" id="bl-q-${id}-${i}" data-meal="${id}" data-idx="${i}" value="${it.q || ''}" placeholder="0" aria-label="Quantidade de ${esc(f.name)}">${blUnitCtl(id, i, it, f)}</div></div>
    <p class="bl-rn" id="bl-rn-${id}-${i}"${it.r ? '' : ' hidden'}>Porção de referência. Confira a quantidade que você realmente comeu.</p>
    <div class="bl-chips" id="bl-ch-${id}-${i}">${blChips(c, f, it)}</div></div>`;
}
function blItemsHTML(id) {
  const items = (blM()[id] || []).map((it, i) => blItemHTML(id, it, i)).join('');
  return items ? `<div class="bl-items">${items}</div>` : '<p class="hint" style="margin:0">Nenhum alimento ainda. Toque em um alimento frequente ou busque abaixo.</p>';
}
