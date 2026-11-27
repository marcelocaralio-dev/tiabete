// test58: base universal da página inicial + personalização conforme o plano (14 dias de avaliação, ativo, expirado, reativado).
// Usa o núcleo real (homebase-core.js, inicio-core.js) e carrega homebase.js/experience.js de verdade num ambiente simulado.
process.removeAllListeners('warning');
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const IC = require('../src/inicio-core.js'), HB = require('../src/homebase-core.js');
const J = JSON.stringify;

/* 1. mesma estrutura para todos no primeiro acesso, qualquer plano */
const base = J(HB.hbBase());
const perfis = { gratuito: false, avaliacao: true, ativo: true, expirado: false, novoSemConta: false };
for (const [nome, allowed] of Object.entries(perfis)) ok(J(HB.hbLayout(null, allowed)) === base, 'primeiro acesso idêntico: ' + nome);
ok(J(HB.hbLayout(undefined, true, 'standard')) === base && J(HB.hbLayout({ v: 2, order: ['n'] }, true, 'standard')) === base, 'modo padrão (futuro) parte da mesma base e nunca aplica preferências');
ok(J(HB.hbBase()) === J(IC.IN_DEF()) && HB.hbBase() !== HB.hbBase(), 'a base é a estrutura única do app (cópia nova a cada uso)');
ok(HB.hbValid(HB.hbBase()), 'base válida: sem cards duplicados nem desconhecidos');
ok(!IC.IN_CARDS.some(c => c.k === 'exa'), 'nenhum card Premium de exames na base');
ok(IC.IN_FIXED[0].k === 'resumo' && IC.IN_FIXED[0].pos === 'top' && IC.IN_FIXED[1].k === 'metricas' && IC.IN_FIXED[1].pos === 'bottom', 'Resumo no topo e Central de Métricas no final');
ok(HB.hbClassOf('resumo') === 'structural' && HB.hbClassOf('metricas') === 'structural' && HB.hbClassOf('hoje') === 'free' && HB.hbClassOf('xyz') === null, 'classificação dos componentes');

/* 2. personalização (Premium): reorganizar, ocultar, reexibir, persistir */
let p = IC.IN_DEF();
p = IC.inMoveVisible(p, 'hoje', -1); p = IC.inHide(p, 'trat'); p = IC.inSetSize(p, 'hba', 'x');
const salvo = J(p), volta = JSON.parse(salvo);
ok(J(HB.hbLayout(volta, true)) === J(IC.inCleanPrefs(volta)) && J(HB.hbLayout(volta, true)) !== base, 'autorizado: aplica as preferências guardadas');
ok(!IC.inVisible(volta).includes('trat') && IC.inVisible(IC.inShow(volta, 'trat')).includes('trat'), 'oculta e reexibe card opcional');
ok(J(IC.inCleanPrefs(IC.IN_DEF())) === base && IC.inIsDefault(IC.IN_DEF()), 'restaurar padrão volta à base');
ok(HB.hbValid(volta) && IC.inVisible(volta).length === new Set(IC.inVisible(volta)).size, 'sem duplicados depois de personalizar');

/* 3. estruturais não podem ser ocultados nem movidos */
for (const k of ['resumo', 'metricas']) {
  ok(J(IC.inHide(IC.IN_DEF(), k)) === base, 'não oculta ' + k);
  ok(J(IC.inToggleHidden(IC.IN_DEF(), k)) === base && J(IC.inMove(IC.IN_DEF(), k, 1)) === base && J(IC.inMoveVisible(IC.IN_DEF(), k, 1)) === base, 'não move nem alterna ' + k);
  const hack = IC.inCleanPrefs({ v: 2, order: [k].concat(IC.IN_CARDS.map(c => c.k)), hidden: [k] });
  ok(!hack.order.includes(k) && !hack.hidden.includes(k) && HB.hbValid(hack), 'valor corrompido não coloca ' + k + ' na lista');
}

/* 4. expiração e reativação: base na tela, preferências intactas */
const stored = J(volta);
ok(J(HB.hbLayout(volta, false)) === base && J(volta) === stored, 'expirado: layout padrão e preferências guardadas não mudam');
ok(HB.hbHasSaved(volta) && !HB.hbHasSaved(IC.IN_DEF()) && !HB.hbHasSaved(null), 'detecta personalização guardada (para explicar ao usuário)');
ok(J(HB.hbLayout(volta, true)) === J(IC.inCleanPrefs(volta)), 'reativado: recupera a configuração anterior');
ok(IC.inVisible(HB.hbLayout(volta, false)).includes('trat') && IC.inVisible(HB.hbLayout(volta, false)).includes('resumo') === false, 'expirado: cards gratuitos todos visíveis');

/* 5. integração no app (licenciamento oficial só é lido) */
function dummy() { const f = function () { return dummy(); }; return new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : dummy(), apply: () => dummy(), construct: () => dummy(), has: () => true }); }
const LS = {}, store = { console, Date, Math, JSON, Object, Array, String, Number, Set, Map, Promise, RegExp, parseFloat, parseInt, isNaN, Error, Symbol,
  localStorage: { getItem: k => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: k => { delete LS[k]; } }, GX_F: {}, esc: String, sheets: [], openSheet: h => store.sheets.push(h),
  LK: { cfg: true, loaded: true, dev: false }, premium: true, licPremiumNow: () => store.premium, licStatus: () => store.status, status: 'trial_active' };
const g = new Proxy(store, { has: () => true, get: (t, k) => k in t ? t[k] : (k === 'window' || k === 'globalThis' ? g : dummy()), set: (t, k, v) => (t[k] = v, true) });
vm.createContext(g);
for (const f of ['src/modos-core.js', 'src/homebase-core.js', 'src/homebase.js']) vm.runInContext(rd(f).replace(/^const HBC = .*$/m, 'const HBC = { IN_DEF: () => ({ v: 2, order: ["a"], hidden: [] }), inCleanPrefs: x => x, inIsDefault: x => JSON.stringify(x) === JSON.stringify({ v: 2, order: ["a"], hidden: [] }), IN_FIXED: [], IN_CARDS: [] };'), g);
vm.runInContext(rd('src/modos.js'), g);   /* serviço de modos real (DOM simulado) */
const exp = rd('src/experience.js'); vm.runInContext(exp.match(/const GX_LS = [^\n]*\n/)[0], g);
for (const f of ['gxAll', 'gxGet']) vm.runInContext(exp.match(new RegExp('function ' + f + '\\([^\\n]*\\n'))[0], g);
vm.runInContext("GX_F.vis_skel = { t: 'x', o: { on: [true, 'a', ''] } }; GX_F.org_pin = { t: 'x', o: { on: [true, 'a', ''] } }; GX_F.ctx_all = { t: 'x', o: { on: [true, 'a', ''] } }; GX_F.bubble = { t: 'x', o: { dot: [true, 'a', ''] } };", g);
const ev = c => vm.runInContext(c, g), reset = () => ev('gxhPT = { t: 0, v: true }');
LS['tb-modo'] = J({ v: 1, mode: 'experience' });
LS['tb-gx'] = J({ vis_skel: { on: false }, org_pin: { on: false }, ctx_all: { on: true }, bubble: { dot: false }, favs: ['a'] });
reset(); ok(ev('gxhPers()') === true && ev("gxGet('vis_skel','on')") === false && ev("gxGet('ctx_all','on')") === true, 'autorizado (avaliação ou ativo): preferências valem');
store.premium = false; store.status = 'trial_expired'; reset(); ok(ev('mdCheck()') === true && ev('mdChosen()') === 'standard', 'perda de Premium: volta ao Modo Padrão uma vez');
ok(ev('gxhPers()') === false && ev("gxhLocked('vis_skel')") === true, 'expirado: personalização do catálogo trava');
ok(ev("gxGet('vis_skel','on')") === true && ev("gxGet('org_pin','on')") === true, 'travado: valem os padrões do app');
ok(ev("gxGet('ctx_all','on')") === false, 'travado: inteligência contextual (catálogo Premium) fica desligada');
ok(ev("gxhLocked('bubble')") === false && ev("gxGet('bubble','dot')") === false, 'alertas e bolha (gratuitos) nunca travam e mantêm a escolha');
ok(JSON.parse(LS['tb-gx']).vis_skel.on === false && JSON.parse(LS['tb-gx']).favs[0] === 'a', 'nada foi apagado do armazenamento');
ok(/Seu teste do Premium terminou/.test(ev('gxhLockWhy()')) && ev('gxhSavedHidden()') === true, 'explicação clara e detecção de personalização guardada');
ok(/continuam guardadas/.test(ev('gxhLockNote()')) && /não foram alterados/.test(ev('gxhLockNote()')), 'aviso explica que os dados e as preferências foram preservados');
ev('gxhLockSheet()'); ok(/Personalização é Premium/.test(store.sheets[0]) && /data-r="licenca"/.test(store.sheets[0]), 'folha de explicação leva ao Premium oficial');
ev('mdSave(mdAck(mdStored()))'); ok(ev('gxhLockNote()') === '', 'a orientação não se repete depois de entendida');
store.premium = true; store.status = 'trial_active'; reset();
ok(ev('gxhPers()') === false, 'reativado: segue no Modo Padrão até a pessoa escolher o Experience'); ev("mdSave(mdSelect(mdStored(), 'experience', gxhAuth()).stored)");
ok(ev('gxhPers()') === true && ev("gxGet('vis_skel','on')") === false && ev("gxGet('ctx_all','on')") === true, 'reativado: recupera tudo, sem refazer configurações');
store.LK = { cfg: true, loaded: false }; reset(); ok(ev('gxhPers()') === false, 'licença ainda carregando: Premium espera');
store.LK = { cfg: false, dev: false }; reset(); ok(ev('gxhPers()') === false, 'produção sem servidor: nunca libera');
store.LK = { cfg: false, dev: true }; reset(); ok(ev('gxhPers()') === true, 'modo de desenvolvimento libera');
store.LK = undefined; delete store.LK; reset(); ok(ev('gxhPers()') === true, 'licenciamento ainda não carregado (abertura): não trava nem quebra');

/* 6. ligação nos módulos (sem sistema paralelo) */
const ini = rd('src/inicio.js'), bw = rd('scripts/build-web.js'), ord = bw.match(/const order = \[(.*?)\];/s)[1], pos = f => ord.indexOf(`'src/${f}'`);
ok(/const inPrefs = \(\) => hbLayout\(inPrefsStored\(\), gxhAuth\(\)/.test(ini) && /function inPrefsStored\(\)/.test(ini), 'Início lê o layout efetivo e conserva o guardado');
ok(/if \(on && !gxhPers\(\)\) \{ S\.inEdit = false; gxhLockSheet\(\)/.test(ini) && /!!S\.inEdit && gxhPers\(\)/.test(ini), 'editar a tela inicial exige autorização');
ok(!/localStorage\.removeItem\(IN_LS\)/.test(rd('src/homebase.js')) && !/setItem\(IN_LS/.test(rd('src/homebase.js')), 'a base não grava nem apaga preferências');
ok(pos('inicio-core.js') < pos('homebase-core.js') && pos('homebase-core.js') < pos('homebase.js') && pos('homebase.js') < pos('experience.js'), 'ordem de carga: núcleo, base, Experience');
ok(!/LIC_PREMIUM/.test(rd('src/homebase.js')) && !/setCfg|lic-/.test(rd('src/homebase.js')), 'não cria regra de assinatura nem toca na licença');
const lic = rd('src/license.js'); ok(/const LIC_PREMIUM = \{ bolus: [^}]*metricas: 'Central de Métricas Glicêmicas' \};/.test(lic), 'LIC_PREMIUM segue com as mesmas 7 chaves');
ok(rd('package.json').includes('node tests/test58.js'), 'teste na lista do npm test');
console.log(fail ? `test58: ${fail} falha(s) em ${n} verificações` : `test58 OK (${n} verificações)`);
process.exit(fail ? 1 : 0);
