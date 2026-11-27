// test56: GLUXO Experience como central de personalização (categorias, legendas, estados, dependências, Análise, navegação).
// Carrega os módulos DE VERDADE num ambiente simulado (sem navegador); globais desconhecidos viram objetos inertes.
process.removeAllListeners('warning');
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };

function dummy() { const f = function () { return dummy(); }; return new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : dummy(), apply: () => dummy(), construct: () => dummy(), has: () => true }); }
const LS = {}, scrolls = [];
const store = {
  console, Date, Math, JSON, Object, Array, String, Number, Set, Map, Promise, RegExp, parseFloat, parseInt, isNaN, Error, Symbol,
  localStorage: { getItem: k => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: k => { delete LS[k]; } },
  S: { route: 'gxexp', records: [], events: [], ac: { mode: 'classic' } }, VIEWS: {}, TITLES: {}, MI: {},
  esc: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  IC: { chev: '<path d="M9 6l6 6-6 6"/>' }, scrollY: 0, scrollTo: (x, y) => { scrolls.push(y); }, setTimeout: f => { f(); return 0; },
  LK: { cfg: false, dev: true }, licPremiumNow: () => true,
  acBubbleOn: () => store.S.ac.mode === 'bubble', backOf: () => 'mais', render: () => { }, toast: () => { }
};
const g = new Proxy(store, { has: () => true, get: (t, k) => k in t ? t[k] : (k === 'window' || k === 'globalThis' ? g : dummy()), set: (t, k, v) => (t[k] = v, true) });
vm.createContext(g);
const run = f => vm.runInContext(rd(f), g, { filename: f });
for (const f of ['src/modos-core.js', 'src/homebase.js', 'src/experience.js', 'src/navx.js', 'src/experience3.js', 'src/organizacao.js', 'src/contexto.js']) run(f);
store.render = () => { };   /* o desenho do app é simulado: só interessa o gancho da central */
run('src/gxhub-data.js'); run('src/gxhub.js'); run('src/modos.js');
vm.runInContext("mdSave(mdSelect(mdStored(), 'experience', true).stored)", g);   /* central completa = Modo Experience escolhido e autorizado */
const ev = c => vm.runInContext(c, g);
const html = c => ev(c);

/* 1. categorias: cada recurso existente está em exatamente uma categoria, com descrição própria */
const feats = ev('Object.keys(GX_F)'), cats = ev('Object.entries(GXH_CATS).map(([c, x]) => [c, x.fs, x.r])');
const inCats = cats.flatMap(c => c[1]);
ok(cats.length === 4, '4 categorias');
ok(feats.every(f => inCats.filter(x => x === f).length === 1), 'todo recurso existente aparece em exatamente uma categoria: ' + feats.filter(f => inCats.filter(x => x === f).length !== 1).join(','));
ok(inCats.every(f => feats.includes(f)), 'nenhuma categoria cita recurso inexistente');
ok(feats.length === 40, '40 recursos (34 existentes + 6 da Análise): ' + feats.length);
ok(feats.every(f => ev(`!!GXH['${f}'] && GXH['${f}'][0] && GXH['${f}'][2] && GXH['${f}'][3]`)), 'todo recurso tem nome, o que faz e resultado esperado');

/* 2. toda opção tem legenda; toda escolha de lista tem efeito explicado */
let semLeg = [], semFx = [], nOpt = 0, nSel = 0;
for (const f of feats) for (const k of ev(`Object.keys(GX_F['${f}'].o)`)) {
  nOpt++; if (!ev(`gxhLeg('${f}','${k}')`)) semLeg.push(f + '.' + k);
  const c = ev(`GX_F['${f}'].o['${k}'][3] || null`);
  if (c) { nSel++; for (const [v] of c) if (!ev(`(GXH_FX['${f}.${k}'] || {})['${v}']`)) semFx.push(`${f}.${k}=${v}`); }
}
ok(!semLeg.length, 'toda opção tem legenda: ' + semLeg.join(','));
ok(!semFx.length, 'toda escolha tem explicação do efeito: ' + semFx.join(','));
ok(nOpt === 223 && nSel === 39, `223 opções e 39 listas (${nOpt}/${nSel})`);
const generic = /^(ativar funcionalidade|habilitar experi[eê]ncia|mostrar informa[cç][õo]es adicionais|personalizar visualiza[cç][aã]o)\.?$/i;
ok(!ev('Object.values(GXH_L)').some(t => generic.test(t)) && !feats.some(f => ev(`GXH['${f}'].slice(2,4)`).some(t => generic.test(t))), 'sem legendas genéricas');
ok(ev('Object.values(GXH_L)').every(t => t.length > 25), 'legendas específicas (não curtas demais)');
ok(ev('Object.entries(GXH_MASTER)').every(([f, k]) => ev(`typeof GX_F['${f}'].o['${k}'][0] === 'boolean'`)), 'toda chave principal é uma opção ligar/desligar real');

/* 3. a tela principal só tem botões de categoria, sem chaves */
const hub = ev('gxhHub()');
ok(cats.every(([, , r]) => hub.includes(`data-r="${r}"`)), 'um botão por categoria');
ok(!/data-gx="/.test(hub) && !/type="checkbox"/.test(hub), 'a tela principal não traz chaves');
ok(/class="mi-ic"/.test(hub) && /ativos · \d+ opções/.test(hub), 'cada botão tem ícone, descrição e contagem');
ok(/Experiência visual/.test(hub) && /Inteligência dos dados/.test(hub) && /Experiências contextuais/.test(hub) && /Personalização das informações/.test(hub), 'nomes das categorias');
ok(/data-gxh-resetall/.test(hub), 'restaurar tudo fica na tela principal');

/* 4. cada categoria: cada recurso com nome, legenda, chave, resultado esperado e estado */
for (const [c, fs, r] of cats) {
  const h = ev(`gxhCat('${c}')`);
  ok(ev(`VIEWS['${r}']`) && ev(`TITLES['${r}']`), 'rota ' + r);
  for (const f of fs) {
    ok(h.includes(`data-gxh="${f}"`), `${c}: seção de ${f}`);
    ok(ev(`Object.keys(GX_F['${f}'].o)`).every(k => h.includes(`data-gx="${f}.${k}"`)), `${f}: todas as opções têm controle`);
    ok(h.includes('Resultado esperado') && h.includes('data-gxh-b'), `${f}: resultado esperado e estado`);
  }
  ok(h.includes('data-gxh-resetcat="' + c + '"'), c + ': restaurar categoria');
  ok(h.includes('data-gxh-sum="' + c + '"'), c + ': contador de recursos ativos');
}
ok(ev('VIEWS.gxorg && VIEWS.gxctx && VIEWS.gxnav && VIEWS.gxvis && VIEWS.gxdados && VIEWS.gxctxc'), 'rotas antigas (gxorg, gxctx) continuam abrindo');
ok(['gxvis', 'gxdados', 'gxctxc', 'gxnav', 'gxorg', 'gxctx'].every(r => ev(`backOf('${r}')`) === 'gxexp') && ev("backOf('gxexp')") === 'mais', 'voltar leva à central');

/* 5. estado atual e dependências */
ok(ev("gxhSt('an_hor')").cls === 'on', 'análise por horários vem ativada (compatível com quem já usava)');
LS['tb-gx'] = JSON.stringify({ an_hor: { on: false } });
ok(ev("gxhSt('an_hor')").cls === 'off' && ev("gxhSt('an_hor')").txt === 'Desativado', 'estado desativado');
ok(/class="gxh-badge off"/.test(ev("gxhSec('an_hor')")), 'selo de desativado na tela');
LS['tb-gx'] = JSON.stringify({ ctx_all: { on: false } });
ok(ev("gxhSt('ctx_ins')").cls === 'wait' && /chave geral/.test(ev("gxhDepMsg('ctx_ins')")), 'dependência da chave geral é informada');
ok(!/ hidden/.test(ev("gxhSec('ctx_ins')").match(/<div class="gxh-dep"[^>]*>/)[0]), 'aviso de dependência visível');
LS['tb-gx'] = JSON.stringify({});
ok(ev("gxhSt('ctx_ins')").cls === 'on' && /hidden/.test(ev("gxhSec('ctx_ins')").match(/<div class="gxh-dep"[^>]*>/)[0]), 'sem dependência pendente: aviso oculto');
ok(ev("gxhSt('bubble')").cls === 'off' && /Bolha/.test(ev("gxhDepMsg('bubble')")), 'bolha: avisa que depende do modo Bolha');
store.S.ac.mode = 'bubble'; ok(ev("gxhSt('bubble')").cls === 'on' && !ev("gxhDepMsg('bubble')"), 'bolha ativa no modo Bolha'); store.S.ac.mode = 'classic';
ok(ev("gxhSt('list')").cls === 'cfg' && /opções ligadas/.test(ev("gxhSt('list')").txt), 'recurso sem chave mostra quantas opções estão ligadas');
LS['tb-gx'] = JSON.stringify({ sound: { beep: false, vib: false } });
ok(ev("gxhSt('sound')").cls === 'off', 'som e vibração da hipoglicemia: desativado quando ambos desligados');
ok(/Exemplo ilustrativo|Som desligado/.test(ev("gxhSec('sound')")), 'prévia do som reflete o estado real'); LS['tb-gx'] = JSON.stringify({});

/* 6. prévias: ilustrativas sempre marcadas como exemplo */
for (const f of ['an_hor', 'an_ref', 'an_pad', 'an_comp', 'an_ass', 'an_desc', 'ctx_ins', 'ctx_pat', 'ctx_sum', 'ctx_ast', 'ctx_sug', 'ctx_rem', 'nav_search', 'org_fav', 'org_pin'])
  ok(/Exemplo ilustrativo · não são os seus dados/.test(ev(`gxPrev('${f}')`)), 'prévia de ' + f + ' identificada como exemplo');
ok(ev("gxPrev('vis_prog')").includes('gx-pv') && ev("gxPrev('bubble')").includes('gx-pb'), 'prévias reais dos módulos continuam');
ok(['an_hor', 'an_ref', 'an_pad', 'an_comp', 'an_ass', 'an_desc'].every(f => !/Dados ·/.test(ev(`gxPrev('${f}')`))), 'sem prévia genérica nas chaves da Análise');
ok(feats.filter(f => ev(`GXH['${f}'][4]`)).every(f => /gxh-cmp/.test(ev(`gxhSec('${f}')`))), 'comparação ligado/desligado onde há chave');

/* 7. as chaves da Análise controlam seções reais */
const an = rd('src/analise.js');
ok(/const anSecsOn = \(\) =>/.test(an) && (an.match(/anSecsOn\(\)\.map/g) || []).length === 2, 'Análise desenha menu e seções por anSecsOn');
ok(!/\$\{AN_SECS\.map/.test(an), 'Análise não usa mais a lista completa ao desenhar');
const ids = ['visao', 'desc', 'ctrl', 'hipo', 'hiper', 'var', 'hor', 'tmp', 'ref', 'rfe', 'comp', 'pad', 'ass', 'evo'];
ok(ids.every(i => ev(`gxanOn('${i}')`)), 'tudo visível por padrão');
LS['tb-gx'] = JSON.stringify({ an_hor: { on: false }, an_desc: { on: false } });
ok(!ev("gxanOn('hor')") && !ev("gxanOn('tmp')") && !ev("gxanOn('desc')") && ev("gxanOn('ref')") && ev("gxanOn('comp')") && ev("gxanOn('visao')"), 'desligar horários/descobertas oculta só as seções delas');
LS['tb-gx'] = JSON.stringify({ an_ref: { on: false }, an_pad: { on: false }, an_comp: { on: false }, an_ass: { on: false } });
ok(['ref', 'rfe', 'pad', 'comp', 'ass'].every(i => !ev(`gxanOn('${i}')`)) && ['visao', 'ctrl', 'hipo', 'hiper', 'var', 'evo'].every(i => ev(`gxanOn('${i}')`)), 'refeições, recorrência, comparação e correlação');
ok(ev("Object.keys(GXH_AN)").every(i => /id: '/.test(an) && an.includes(`id: '${i}'`)), 'toda seção citada existe na Análise');
LS['tb-gx'] = JSON.stringify({});

/* 8. persistência e compatibilidade */
ev("gxSave({ vis_skel: { on: false }, favs: ['x'] })");
ok(JSON.parse(LS['tb-gx']).vis_skel.on === false && ev("gxGet('vis_skel','on')") === false, 'preferência salva no mesmo registro');
ev("gxhResetCatDo('A')"); const a = JSON.parse(LS['tb-gx'] || '{}');
ok(!a.vis_skel && JSON.stringify(a.favs) === '["x"]', 'restaurar categoria não apaga favoritos nem dados');
ev("gxSave({ nav_sc: { on: false }, vis_fb: { on: false }, org_fav: { on: false } })"); ev("gxhResetCatDo('D')");
const d = JSON.parse(LS['tb-gx'] || '{}'); ok(!d.nav_sc && !d.org_fav && d.vis_fb && d.vis_fb.on === false, 'restaurar categoria afeta só a categoria');
LS['tb-gx'] = JSON.stringify({ bubble: { dot: false }, list: { tap: 'options' } });
ok(ev("gxGet('bubble','dot')") === false && ev("gxGet('list','tap')") === 'options' && ev("gxGet('an_hor','on')") === true, 'preferências antigas continuam valendo; novas chaves partem ligadas');
LS['tb-gx'] = JSON.stringify({});

/* 9. posição de rolagem ao voltar */
store.S.route = 'gxexp'; store.scrollY = 0; ev('render()');
store.scrollY = 420; store.S.route = 'gxnav'; ev('render()');
store.scrollY = 0; scrolls.length = 0; store.S.route = 'gxexp'; ev('render()');
ok(scrolls.includes(420), 'voltar à central restaura a posição de rolagem: ' + scrolls.join(','));
store.scrollY = 0; store.S.route = 'mais'; ev('render()'); scrolls.length = 0; store.S.route = 'gxexp'; ev('render()');
ok(!scrolls.includes(420), 'entrar de outra tela começa no topo');

/* 10. build, estilos e identidade visual */
const bw = rd('scripts/build-web.js'), ord = bw.match(/const order = \[(.*?)\];/s)[1];
const pos = f => ord.indexOf(`'src/${f}'`);
ok(pos('organizacao.js') > 0 && pos('contexto-core.js') > pos('organizacao.js') && pos('contexto.js') > pos('contexto-core.js') && pos('gxhub-data.js') > pos('contexto.js') && pos('gxhub.js') > pos('gxhub-data.js'), 'ordem de carga: organização, contexto, dados da central, central');
ok(bw.includes("rd('src/contexto.css')") && bw.includes("rd('src/gxhub.css')"), 'estilos entram no build');
const css = rd('src/gxhub.css'), tok = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0]);
ok(!tok.length, 'o CSS da central não cria cores novas: só tokens do GLUXO ' + tok.join(','));
ok(/var\(--brand/.test(css) && /var\(--s1\)/.test(css) && /var\(--line\)/.test(css), 'usa a paleta atual');
ok(rd('src/gxhub.js').includes('class="menu-item gxh-cat"') && rd('src/gxhub.js').includes('class="card gx-sec gxh-sec"'), 'reaproveita menu-item e card');
ok(!/localStorage/.test(rd('src/gxhub.js')) && !/localStorage\.setItem/.test(rd('src/gxhub-data.js')), 'a central usa o registro existente (gxSave), sem armazenamento paralelo');
ok(rd('package.json').includes('node tests/test56.js'), 'teste entra na lista do npm test');

console.log(fail ? `test56: ${fail} falha(s) em ${n} verificações` : `test56 OK (${n} verificações)`);
process.exit(fail ? 1 : 0);
