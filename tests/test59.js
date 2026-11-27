// test59: modos de interface Padrão × Experience (escolha, autorização, expiração, preservação, classificação central).
// Núcleo real (modos-core.js) + homebase.js/modos.js/gxGet reais carregados num ambiente simulado.
process.removeAllListeners('warning');
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const M = require('../src/modos-core.js'), IC = require('../src/inicio-core.js'), HB = require('../src/homebase-core.js');
const J = JSON.stringify;

/* 1. escolha inicial e modo em uso */
ok(M.mdInitial(null, false).mode === 'standard', 'padrão para quem nunca escolheu: Modo Padrão');
ok(M.mdInitial(null, true).mode === 'experience', 'quem já tinha personalização guardada continua no Experience');
ok(M.mdInitial({ v: 1, mode: 'standard' }, true).mode === 'standard', 'escolha já feita nunca é trocada pela inicial');
ok(M.mdClean('lixo').mode === null && M.mdClean({ mode: 'x' }).mode === null && M.mdParse('{quebrado').mode === null, 'valor corrompido não vira modo');
const E = { v: 1, mode: 'experience' }, S0 = { v: 1, mode: 'standard' };
ok(M.mdEffective(E, true) === 'experience' && M.mdEffective(E, false) === 'standard' && M.mdEffective(E, undefined) === 'standard' && M.mdEffective(E, null) === 'standard', 'Experience exige escolha E autorização exata');
ok(M.mdEffective(S0, true) === 'standard' && M.mdEffective(null, true) === 'standard', 'Premium no Modo Padrão vê o Modo Padrão');

/* 2. troca de modo: a recusa acontece na lógica */
ok(M.mdSelect(S0, 'experience', false).ok === false && M.mdSelect(S0, 'experience', false).reason === 'premium' && M.mdSelect(S0, 'experience', false).stored.mode === 'standard', 'gratuito não ativa o Experience');
ok(M.mdSelect(S0, 'experience', undefined).ok === false && M.mdSelect(S0, 'experience', 'true').ok === false, 'autorização duvidosa não vale');
ok(M.mdSelect(S0, 'experience', true).stored.mode === 'experience' && M.mdSelect(E, 'standard', false).stored.mode === 'standard', 'Premium alterna; o Padrão é sempre permitido');
ok(M.mdSelect(S0, 'nada', true).ok === false, 'modo inválido recusado');

/* 3. perda e reativação do Premium */
ok(M.mdReconcile(E, false, false, 'x', 1).changed === false, 'licença ainda carregando: nada se conclui');
const lost = M.mdReconcile(E, true, false, 'trial_expired', 5);
ok(lost.changed && lost.stored.mode === 'standard' && lost.stored.lost.st === 'trial_expired' && M.mdLostPending(lost.stored), 'perda confirmada: Modo Padrão e aviso pendente');
ok(M.mdReconcile(lost.stored, true, false, 'trial_expired', 9).changed === false, 'a perda é tratada uma só vez');
ok(!M.mdLostPending(M.mdAck(lost.stored)) && M.mdAck(lost.stored).lost, 'aviso some em Entendi');
ok(M.mdReconcile(E, true, true, 'ok', 1).changed === false && M.mdReconcile(S0, true, false, 'x', 1).changed === false, 'sem perda não muda nada');
ok(M.mdEffective(lost.stored, true) === 'standard' && M.mdSelect(lost.stored, 'experience', true).stored.mode === 'experience' && M.mdSelect(lost.stored, 'experience', true).stored.lost === null, 'reativado: a pessoa volta ao Experience quando quiser');

/* 4. classificação central */
ok(['bubble', 'list', 'badge', 'sound', 'c_glic', 'c_lem', 'c_reg', 'c_met', 'c_app'].every(f => M.mdFeatureClass(f) === 'shared'), 'alertas, lembretes, bolha e hipoglicemia: compartilhados');
ok(['vis_skel', 'org_pin', 'org_fav', 'ctx_ins', 'nav_sc', 'an_hor'].every(f => M.mdFeatureClass(f) === 'experience'), 'catálogo restante: Experience');
ok(M.mdForcedOff('ctx_all', 'on') && M.mdForcedOff('nav_sc', 'on') && !M.mdForcedOff('vis_skel', 'on') && !M.mdForcedOff('nav_gest', 'tabs') && !M.mdForcedOff('bubble', 'dot'), 'o que sai fora do Experience');
ok(M.MD_ADDON.every(f => !M.MD_SHARED.includes(f)), 'nada é compartilhado e adicional ao mesmo tempo');
const fx = M.MD_HOME.find(x => x.k === 'resumo'), mt = M.MD_HOME.find(x => x.k === 'metricas');
ok(fx.class === 'shared' && fx.fixed === 'top' && mt.class === 'shared' && mt.fixed === 'bottom', 'Resumo glicêmico (topo) e Central de Métricas (final) são estruturais');
ok(M.mdHomeShown('resumo', 'standard') && M.mdHomeShown('metricas', 'standard') && M.mdHomeShown('cards', 'standard') && !M.mdHomeShown('fixados', 'standard') && M.mdHomeShown('fixados', 'experience'), 'componentes por modo');
ok(HB.hbClassOf('resumo') === 'structural' && HB.hbClassOf('metricas') === 'structural' && IC.IN_CARDS.every(c => HB.hbClassOf(c.k) === 'free'), 'cards do catálogo são gratuitos e coerentes com a base');
ok(J(HB.hbLayout({ v: 2, order: ['n'] }, true, 'standard')) === J(HB.hbBase()), 'Modo Padrão usa a base mesmo com Premium e preferências guardadas');
const src = ['experience', 'navx', 'experience3', 'organizacao', 'contexto', 'gxhub-data'].map(f => rd('src/' + f + '.js')).join('\n');
const regd = f => new RegExp('GX_F\\.' + f + '\\s*=').test(src) || new RegExp("for \\(const [^)]*\\) GX_F\\['" + f.split('_')[0] + "_'").test(src) || f.startsWith('c_');
ok(M.MD_ADDON.every(regd) && M.MD_HOME.filter(x => x.gate).every(x => regd(x.gate)), 'todo recurso classificado existe no catálogo');
const cats = { A: { t: 'Visual', fs: ['vis_skel', 'bubble'] }, B: { t: 'Dados', fs: ['bubble'] } };
ok(J(M.mdExclusive(cats, { vis_skel: 'Skeleton', bubble: 'Bolha' })) === J([{ c: 'A', t: 'Visual', items: ['Skeleton'] }]), 'lista de exclusivos não inclui compartilhados');

/* 5. integração real: homebase.js + modos.js + gxGet */
function dummy() { const f = function () { return dummy(); }; return new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : dummy(), apply: () => dummy(), construct: () => dummy(), has: () => true }); }
const LS = {}, store = { console, Date, Math, JSON, Object, Array, String, Number, Set, Map, Promise, RegExp, parseFloat, parseInt, isNaN, Error, Symbol, setInterval: () => 0,
  localStorage: { getItem: k => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: k => { delete LS[k]; } }, GX_F: {}, esc: String, sheets: [], openSheet: h => store.sheets.push(h), TITLES: {}, VIEWS: { licenca: () => '' },
  LK: { cfg: true, loaded: true, dev: false, payload: { st: 'x' } }, premium: true, licPremiumNow: () => store.premium, licStatus: () => store.status, status: 'trial_active' };
const g = new Proxy(store, { has: () => true, get: (t, k) => k in t ? t[k] : (k === 'window' || k === 'globalThis' ? g : dummy()), set: (t, k, v) => (t[k] = v, true) });
vm.createContext(g);
for (const f of ['src/modos-core.js', 'src/homebase-core.js', 'src/homebase.js']) vm.runInContext(rd(f).replace(/^const HBC = .*$/m, 'const HBC = { IN_DEF: () => ({ v: 2, order: ["a"], hidden: [] }), inCleanPrefs: x => x, inIsDefault: x => JSON.stringify(x) === JSON.stringify({ v: 2, order: ["a"], hidden: [] }) };'), g);
vm.runInContext(rd('src/modos.js'), g);
const exp = rd('src/experience.js'); vm.runInContext(exp.match(/const GX_LS = [^\n]*\n/)[0], g);
for (const f of ['gxAll', 'gxGet']) vm.runInContext(exp.match(new RegExp('function ' + f + '\\([^\\n]*\\n'))[0], g);
vm.runInContext("GX_F.nav_sc = { t: 'x', o: { on: [true, 'a', ''], size: ['normal', 'T', '', [['normal', 'N'], ['small', 'S']]] } }; GX_F.nav_search = { t: 'x', o: { on: [true, 'a', ''] } }; GX_F.vis_skel = { t: 'x', o: { on: [true, 'a', ''] } }; GX_F.ctx_all = { t: 'x', o: { on: [true, 'a', ''] } }; GX_F.org_pin = { t: 'x', o: { on: [true, 'a', ''] } }; GX_F.bubble = { t: 'x', o: { dot: [true, 'a', ''] } };", g);
vm.runInContext("function inPrefsStored() { try { return JSON.parse(localStorage.getItem('tb-inicio')); } catch (e) { return null; } }", g);
const ev = c => vm.runInContext(c, g), reset = () => ev('gxhPT = { t: 0, v: true }');
const GX = J({ nav_sc: { on: false, size: 'small' }, nav_search: { on: false }, vis_skel: { on: false }, ctx_all: { on: true }, org_pin: { on: false }, bubble: { dot: false }, favs: ['a'], opin: [{ t: 'rec', k: '1' }] });
LS['tb-gx'] = GX; LS['tb-inicio'] = J({ v: 2, order: ['hoje'], hidden: [] });

/* Premium escolhe o Experience: preferências valem */
LS['tb-modo'] = J(E); reset();
ok(ev('gxhPers()') === true && ev("gxGet('nav_sc','on')") === false && ev("gxGet('nav_sc','size')") === 'small' && ev("gxGet('vis_skel','on')") === false && ev("gxGet('ctx_all','on')") === true, 'Experience: valem as preferências do usuário');
ok(ev("gxhLocked('nav_sc')") === false && ev("gxhLocked('bubble')") === false, 'nada travado no Experience');
/* Premium no Modo Padrão */
LS['tb-modo'] = J(S0); reset();
ok(ev('gxhAuth()') === true && ev('gxhPers()') === false && ev("gxhLocked('nav_sc')") === true && ev("gxhLocked('org_pin')") === true, 'Premium no Modo Padrão: catálogo não se aplica');
ok(ev("gxGet('nav_sc','on')") === false && ev("gxGet('nav_search','on')") === false && ev("gxGet('ctx_all','on')") === false, 'Modo Padrão: elementos adicionais desligados (mesmo se a pessoa tinha deixado ligados)');
ok(ev("gxGet('vis_skel','on')") === true && ev("gxGet('nav_sc','size')") === 'normal', 'Modo Padrão: padrões de fábrica nas demais opções');
ok(ev("gxhLocked('bubble')") === false && ev("gxGet('bubble','dot')") === false, 'alertas continuam com a escolha da pessoa nos dois modos');
ok(ev('gxhSavedHidden()') === true && /Modo Padrão/.test(ev('gxhLockWhy()')), 'orientação: personalização guardada, explicação do modo');
/* adulteração: modo Experience gravado à mão por usuário sem Premium */
store.premium = false; store.status = 'pending_trial'; LS['tb-modo'] = J(E); reset();
ok(ev('gxhPers()') === false && ev("gxGet('nav_sc','on')") === false && ev("gxGet('ctx_all','on')") === false && ev("gxhLocked('org_pin')") === true, 'gratuito com modo Experience gravado à mão: continua no Modo Padrão');
ok(ev("mdSelect(mdStored(), 'experience', gxhAuth()).ok") === false, 'seleção sem autorização recusada pelo serviço real');
/* expiração durante o uso, depois reativação */
store.premium = true; store.status = 'active'; LS['tb-modo'] = J(E); reset();
ok(ev('gxhPers()') === true, 'Premium ativo no Experience');
store.premium = false; store.status = 'trial_expired'; reset();
ok(ev('gxhPers()') === false && ev('mdCheck()') === true && ev('mdChosen()') === 'standard' && ev('mdCheck()') === false, 'expirou: Modo Padrão, tratado uma vez');
ok(/Seu teste do Premium terminou/.test(ev('gxhLockNote()')) && /continuam guardadas/.test(ev('gxhLockNote()')) && /não foram alterados/.test(ev('gxhLockNote()')), 'explicação clara da mudança');
store.premium = true; store.status = 'active'; reset();
ok(ev('gxhPers()') === false, 'reativado: espera a escolha da pessoa');
ev("mdSave(mdSelect(mdStored(), 'experience', gxhAuth()).stored)"); reset();
ok(ev('gxhPers()') === true && ev("gxGet('nav_sc','size')") === 'small' && ev("gxGet('vis_skel','on')") === false, 'reativado e escolhido: configuração anterior recuperada');
/* alternar várias vezes nunca altera dados nem preferências */
for (let i = 0; i < 6; i++) { ev(`mdSave(mdSelect(mdStored(), '${i % 2 ? 'experience' : 'standard'}', true).stored)`); reset(); }
ok(LS['tb-gx'] === GX && LS['tb-inicio'] === J({ v: 2, order: ['hoje'], hidden: [] }), 'alternar modos não altera preferências, favoritos, fixados nem layout');
/* escolha inicial na primeira abertura */
delete LS['tb-modo']; LS['tb-gx'] = GX; reset(); ev('mdBoot()');
ok(JSON.parse(LS['tb-modo']).mode === 'experience', 'primeira abertura com personalização guardada e Premium: Experience');
delete LS['tb-modo']; LS['tb-gx'] = J({ bubble: { dot: false } }); delete LS['tb-inicio']; reset(); ev('mdBoot()');
ok(JSON.parse(LS['tb-modo']).mode === 'standard', 'primeira abertura sem personalização (alertas não contam): Modo Padrão');
LS['tb-gx'] = GX; LS['tb-inicio'] = J({ v: 2, order: ['hoje'], hidden: [] });
/* licença carregando: não conclui perda */
store.LK = { cfg: true, loaded: false }; LS['tb-modo'] = J(E); reset();
ok(ev('mdCheck()') === false && ev('mdChosen()') === 'experience', 'licença carregando não derruba o Experience escolhido');
store.LK = { cfg: true, loaded: true, dev: false, payload: { st: 'x' } };

/* 5b. estabilidade do Experience: nada que seja carregamento, falha ou demora conta como desativação */
const MC = M, pay = { st: 'trial_active' };
ok(MC.mdLossConfirmed('trial_expired', pay, true, false) && MC.mdLossConfirmed('refunded', pay, true, false) && MC.mdLossConfirmed('revoked', pay, true, false), 'perda confirmada: teste terminado, reembolso, revogação');
ok(!MC.mdLossConfirmed('trial_expired', null, true, false) && !MC.mdLossConfirmed('trial_expired', pay, false, false) && !MC.mdLossConfirmed('trial_expired', pay, true, true), 'sem token assinado, carregando ou leitura falha: não é perda');
ok(!MC.mdLossConfirmed('lifetime_active', pay, true, false) && !MC.mdLossConfirmed('trial_active', pay, true, false) && !MC.mdLossConfirmed('pending_trial', null, true, false), 'tolerância offline vencida, relógio fora do lugar ou sem resposta: não é perda');
const st0 = MC.mdStamp({ mode: 'experience' }, 1000);
ok(MC.mdProvisional(st0, 2000) && !MC.mdProvisional(st0, 1000 + 8 * 86400e3) && !MC.mdProvisional({ mode: 'experience' }, 2000) && !MC.mdProvisional(MC.mdStamp({ mode: 'standard' }, 1000), 2000), 'continuidade provisória: só quem escolheu o Experience e já teve o Premium confirmado, por tempo limitado');
const setLK = o => { store.LK = Object.assign({ cfg: true, loaded: true, dev: false, payload: { st: 'x' } }, o); reset(); };
const keepE = () => { LS['tb-modo'] = J({ v: 1, mode: 'experience', ok: Date.now() }); };
/* carregando */
keepE(); setLK({ loaded: false, payload: null }); store.premium = false; store.status = 'pending_trial';
ok(ev('mdCheck()') === false && ev('mdChosen()') === 'experience' && ev('gxhPers()') === true, 'licença carregando: Experience continua (não desativa prematuramente)');
/* leitura do cofre falhou */
keepE(); setLK({ readErr: true, payload: null });
ok(ev('mdCheck()') === false && ev('mdChosen()') === 'experience' && ev('gxhPers()') === true && ev('gxhLockNote()') === '', 'falha de leitura do cofre: sem desativação e sem mensagem');
/* tolerância offline vencida (token assinado antigo): Premium não vale agora, mas não é perda */
keepE(); setLK({}); store.premium = false; store.status = 'lifetime_active';
ok(ev('mdCheck()') === false && ev('mdChosen()') === 'experience' && ev('gxhLockNote()') === '', 'token antigo/sem resposta: escolha mantida, sem aviso');
/* sem nenhum Premium confirmado antes: não há continuidade provisória */
LS['tb-modo'] = J({ v: 1, mode: 'experience' }); setLK({ readErr: true, payload: null });
ok(ev('gxhPers()') === false, 'sem confirmação anterior: nada é liberado durante a falha');
/* Premium confirmado carimba a escolha; voltando ao normal tudo segue */
LS['tb-modo'] = J({ v: 1, mode: 'experience' }); setLK({}); store.premium = true; store.status = 'trial_active';
ev('mdCheck()'); ok(JSON.parse(LS['tb-modo']).ok > 0 && ev('mdChosen()') === 'experience', 'Premium confirmado: escolha carimbada e mantida');
/* perda realmente confirmada */
store.premium = false; store.status = 'trial_expired'; reset();
ok(ev('mdCheck()') === true && ev('mdChosen()') === 'standard' && /terminou/.test(ev('gxhLockNote()')), 'perda confirmada com token assinado: Padrão uma vez, com aviso');
/* consulta em andamento não decide */
keepE(); setLK({ busy: true }); store.premium = false; store.status = 'trial_expired';
ok(ev('mdCheck()') === false && ev('mdChosen()') === 'experience', 'consulta de licença em andamento: espera o resultado');
/* desativar manualmente restaura o Padrão e preserva preferências */
keepE(); setLK({}); store.premium = true; store.status = 'trial_active'; LS['tb-gx'] = GX;
ev("mdSave(mdSelect(mdStored(), 'standard', gxhAuth()).stored)"); reset();
ok(ev('mdChosen()') === 'standard' && ev('gxhPers()') === false && LS['tb-gx'] === GX && ev('mdCheck()') === false, 'desativar manualmente: Padrão, sem reativar sozinho, preferências intactas');
/* leitura do armazenamento falhando na abertura não vira escolha nem sobrescreve */
keepE(); const gi = store.localStorage.getItem; const saved = LS['tb-modo'];
store.localStorage.getItem = k => { if (k === 'tb-modo') throw new Error('x'); return LS[k] ?? null; };
ev('mdMemo = { raw: undefined, st: null }'); ev('mdBoot()'); ok(LS['tb-modo'] === saved && ev('mdCheck()') === false, 'falha ao ler tb-modo: nada é regravado nem tratado como desativação');
store.localStorage.getItem = gi; ev('mdMemo = { raw: undefined, st: null }');
LS['tb-modo'] = '{quebrado'; ev('mdBoot()'); ok(LS['tb-modo'] === '{quebrado', 'valor ilegível não é sobrescrito pela inicialização');
/* recarregar (reabrir): mesma escolha lida de novo */
keepE(); ev('mdMemo = { raw: undefined, st: null }'); setLK({}); store.premium = true; ev('mdBoot()');
ok(ev('mdChosen()') === 'experience' && ev('gxhPers()') === true, 'recarregar/reabrir: Experience permanece');
store.premium = true; store.status = 'trial_active'; setLK({}); LS['tb-gx'] = GX;

/* 6. ligação nos módulos (sem sistema paralelo, sem escrever preferências) */
const mo = rd('src/modos.js'), hbS = rd('src/homebase.js'), bw = rd('scripts/build-web.js'), ord = bw.match(/const order = \[(.*?)\];/s)[1], pos = f => ord.indexOf(`'src/${f}'`);
ok(!/setItem\('tb-gx'|setItem\('tb-inicio'|removeItem\('tb-gx'|removeItem\('tb-inicio'|gxSave\(|inPrefsSave\(/.test(mo), 'o serviço de modos nunca grava nem apaga preferências');
ok(!/LIC_PREMIUM|setCfg|lic-/.test(mo + hbS) && /gxhAuth/.test(mo), 'a autorização vem só do licenciamento oficial (sem sistema paralelo)');
ok(pos('modos-core.js') > 0 && pos('modos-core.js') < pos('homebase-core.js') && pos('homebase.js') < pos('gxhub.js') && pos('gxhub.js') < pos('modos.js') && pos('modos.js') < pos('init.js'), 'ordem de carga');
ok(bw.includes("rd('src/modos.css')"), 'estilos incluídos no build');
ok(/'tb-modo'\]/.test(rd('src/persist.js')), 'escolha do modo entra na cópia durável (sobrevive ao reinício)');
const ini = rd('src/init.js'); ok(ini.indexOf('psRestore()') < ini.indexOf('mdBoot()') && ini.indexOf('mdBoot()') < ini.indexOf('render();'), 'mdBoot roda depois da restauração e antes da primeira tela');
ok(/typeof mdCard === 'function' \? mdCard\(\)/.test(rd('src/app.js')), 'Aparência mostra o seletor de modo');
ok(!/data-r="gxexp">Personalização · GLUXO Experience/.test(rd('src/extras.js')) && (rd('src/extras.js').match(/mdEntryBtn\(\)/g) || []).length === 1 && !/mdEntryBtn\(\)/.test(rd('src/extras.js').split('function viewConfig')[1] || ''), 'entrada isolada saiu das Configurações (só Lembretes mantém o atalho dos alertas)');
ok(/if \(!gxhPers\(\)\) return gxhLockNote\(\)/.test(rd('src/inicio.js')), 'Modo Padrão não mostra o botão de personalizar a tela inicial');
ok(/filter\(f => !gxhLocked\(f\)\)/.test(rd('src/gxhub.js')), 'restaurar categoria nunca apaga configuração de recurso travado');
ok(rd('package.json').includes('node tests/test59.js'), 'teste na lista do npm test');
console.log(fail ? `test59: ${fail} falha(s) em ${n} verificações` : `test59 OK (${n} verificações)`);
process.exit(fail ? 1 : 0);
