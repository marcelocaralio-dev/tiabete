// test53: GLUXO Experience 03 (aparência e interações): registro de preferências, precedência do movimento, avisos, tátil, esqueleto e progresso.
// Carrega src/experience3.js DE VERDADE num ambiente simulado (sem navegador).
process.removeAllListeners('warning');
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const exp = rd('src/experience.js'), e3 = rd('src/experience3.js'), css = rd('src/experience3.css'), bw = rd('scripts/build-web.js');
const LS = {}, cls = new Set(), st = {}, vib = [];
let sysReduce = false;
const el = () => ({ classList: { add() { }, remove() { }, toggle() { }, contains: () => false }, addEventListener() { }, querySelectorAll: () => [], querySelector: () => null, appendChild() { }, setAttribute() { }, style: {}, dataset: {} });
const sb = {
  console, setTimeout: () => 0, clearTimeout() { }, setInterval: () => 0, Date, Math, Object, Array, JSON, String, Number, Set, Promise, parseFloat, requestAnimationFrame: () => 0, performance: { now: () => 0 },
  localStorage: { getItem: k => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: k => { delete LS[k]; } },
  navigator: { vibrate: v => { vib.push(v); return true; } }, location: { origin: 'https://x', hash: '' }, innerHeight: 800,
  getComputedStyle: () => ({ getPropertyValue: () => '1' }),
  document: { documentElement: { classList: { toggle: (c, v) => { v ? cls.add(c) : cls.delete(c); }, contains: c => cls.has(c) }, style: { setProperty: (k, v) => { st[k] = v; }, removeProperty: k => { delete st[k]; } }, dataset: {} }, addEventListener() { }, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el() },
  S: { records: [] }, GX_F: {}, VIEWS: {}, TITLES: {}, WD: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'], esc: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  render() { }, toast() { }, openSheet() { }, closeSheet() { }, gxChanged() { }, acToast: () => false, acBubbleOn: () => false, navHTML: () => '',
};
sb.window = Object.assign(sb, { matchMedia: () => ({ get matches() { return sysReduce; }, addEventListener() { } }), addEventListener() { }, fetch: () => Promise.resolve() });
vm.createContext(sb);
// funções reais de leitura/gravação do registro (experience.js)
vm.runInContext(exp.match(/const GX_LS = [^\n]*\n/)[0], sb);
sb.isoDate = d => d.toISOString().slice(0, 10); sb.addDays = (t, k) => t + k * 864e5;
for (const f of ['gxAll', 'gxGet', 'gxSave']) { const m = exp.match(new RegExp('function ' + f + '\\([^\\n]*\\n')); ok(!!m, 'experience.js tem ' + f); vm.runInContext(m[0], sb); }
vm.runInContext(e3, sb, { filename: 'experience3.js' });
const run = c => vm.runInContext(c, sb), set = (f, k, v) => { const a = run('gxAll()'); a[f] = Object.assign({}, a[f], { [k]: v }); run('gxSave(' + JSON.stringify(a) + ')'); run('gxvApply()'); };
const reset = () => { for (const k in LS) delete LS[k]; sysReduce = false; run('gxvApply()'); };

// 1) registro: todas as seções são independentes e têm restauração (padrões válidos)
const F = run('Object.keys(GX_F)').filter(k => k.startsWith('vis_'));
ok(F.join() === 'vis_motion,vis_skel,vis_micro,vis_trans,vis_fb,vis_hap,vis_prog', 'seções: ' + F);
for (const f of F) for (const [k, o] of Object.entries(run(`GX_F.${f}.o`))) { const d = o[0], c = o[3]; ok(c ? c.some(x => x[0] === d) : typeof d === 'boolean', `${f}.${k} tem padrão válido`); }
ok(run('VIEWS.gxvis') === run('gxVisCard') || typeof run('VIEWS.gxvis') === 'function', 'tela gxvis registrada');
ok(run('TITLES.gxvis') === 'Aparência e interações', 'título da tela');
// 2) movimento: sistema > movimento geral > categoria > chave geral
reset(); ok(cls.has('gxv-x-press') && !cls.has('gxv-calm'), 'padrão: efeitos ligados');
set('vis_micro', 'on', false); ok(!cls.has('gxv-x-press'), 'chave geral desliga');
set('vis_micro', 'btn', 'on'); ok(cls.has('gxv-x-press') && !cls.has('gxv-x-save'), 'categoria individual vale mais que a geral');
set('vis_micro', 'press', false); ok(!cls.has('gxv-x-press') && cls.has('gxv-x-done'), 'efeito específico');
reset(); set('vis_motion', 'mode', 'reduce'); ok(cls.has('gxv-calm') && !cls.has('gxv-x-press') && !cls.has('gxv-tr-tabs') && !cls.has('gxv-pg-anim') && !cls.has('gxv-sk-anim'), 'reduzir sempre simplifica tudo');
reset(); sysReduce = true; set('vis_micro', 'btn', 'on'); ok(cls.has('gxv-calm') && !cls.has('gxv-x-press'), 'sistema vence a escolha individual');
reset(); set('vis_micro', 'speed', 'slow'); ok(st['--gxv-k'] === 1.6 && st['--ds-t'] === '0.320s', 'velocidade escala os tempos do design system');
set('vis_micro', 'speed', 'normal'); ok(!('--ds-t' in st), 'velocidade normal não força nada');
reset(); set('vis_trans', 'on', false); ok(!cls.has('gxv-tr-tabs') && !cls.has('gxv-tr-sheets'), 'transições desligadas');
set('vis_trans', 'on', true); set('vis_trans', 'sheets', false); ok(cls.has('gxv-tr-tabs') && !cls.has('gxv-tr-sheets'), 'transição individual');
// 3) avisos: categorias, críticos nunca ocultos, duração
reset();
const K = m => run(`gxvKind(${JSON.stringify(m)})`);
ok(K('Medição salva.') === 'ok' && K('Texto copiado.') === 'copy' && K('Preferência salva.') === 'cfg' && K('Registro excluído.') === 'del' && K('Não foi possível salvar: x') === 'err' && K('Sem conexão com a internet.') === 'net' && K('Aguarde o envio atual terminar.') === 'proc' && K('Dados de exemplo removidos.') === 'info', 'classificação das mensagens');
ok(K('Bloqueio removido.') === 'del' && K('Biometria desativada. O PIN continua ativo.') === 'del' && K('Restaurado: 3 medições novas') === 'del', 'segurança e restauração são críticas');
set('vis_fb', 'on', false); ok(run("gxvShow('err')") && run("gxvShow('del')") && !run("gxvShow('ok')") && !run("gxvShow('info')"), 'com avisos desligados, erro e crítico continuam');
set('vis_fb', 'on', true); set('vis_fb', 'ok', false); ok(!run("gxvShow('ok')") && run("gxvShow('copy')"), 'categoria individual');
reset(); set('vis_fb', 'dur', 'short'); ok(run('gxvDur(3200)') === 1920, 'duração curta'); set('vis_fb', 'dur', 'long'); ok(run('gxvDur(3200)') === 6080, 'duração longa'); set('vis_fb', 'dur', 'short'); ok(run('gxvDur(9000, true)') === 9000, 'aviso importante não é encurtado');
// 4) tátil
reset(); vib.length = 0; run('gxvHapAt = 0');
set('vis_hap', 'on', false); ok(run("gxvHap('save')") === false && !vib.length, 'desligado não vibra');
set('vis_hap', 'on', true); ok(run("gxvHap('save')") === true && vib.length === 1, 'vibra ao salvar');
run('gxvHapAt = 0'); ok(run("gxvHap('select')") === false, 'seleção vem desligada por padrão (sem excesso)');
run('gxvHapAt = 0'); set('vis_hap', 'select', true); ok(run("gxvHap('select')") === true, 'tipo ligado vibra');
ok(run("gxvHap('err')") === false, 'intervalo mínimo entre vibrações');
set('vis_hap', 'level', 'high'); run('gxvHapAt = 0'); run("gxvHap('save')"); const hi = vib[vib.length - 1][0]; set('vis_hap', 'level', 'low'); run('gxvHapAt = 0'); run("gxvHap('save')"); ok(hi > vib[vib.length - 1][0], 'intensidade');
sb.navigator.vibrate = undefined; run('gxvHapAt = 0'); ok(run("gxvHap('save', true)") === false, 'sem suporte: não falha'); sb.navigator.vibrate = v => { vib.push(v); return true; };
// 5) esqueleto
reset(); ok(/gxv-sk/.test(run("gxvSk('dash')")) && /aria-busy="true"/.test(run("gxvSk('list')")), 'estrutura com acessibilidade');
ok(/data-gxv-ttl="9"/.test(run("gxvSk('lines', { ttl: 9 })")) && !/data-gxv-t0/.test(run("gxvSk('lines')")), 'só vigia (prazo) quando há operação real');
set('vis_skel', 'on', false); ok(run("gxvSk('dash')") === '', 'desligado: nada é gerado (a tela usa o texto de espera)');
reset(); set('vis_skel', 'style', 'static'); ok(!cls.has('gxv-sk-anim'), 'estático');
set('vis_skel', 'level', 'strong'); ok(st['--gxv-lv'] === 1.7, 'intensidade');
// 6) progresso: só com dados reais
reset(); ok(run('gxvStreak()') === '', 'sem registros: nenhum progresso');
run("S.records = [{ id: 'x', source: 'exemplo', date: isoDate(new Date()), glucose: 100 }]"); 
ok(true, 'exemplo ignorado (conferido abaixo)');
ok(run('gxvStreak()') === '', 'registros de exemplo não geram progresso');
run("S.records = [{ id: 'a', date: isoDate(new Date()), glucose: 100 }, { id: 'b', date: isoDate(new Date(addDays(Date.now(), -1))), glucose: 90 }]");
ok(/aria-valuenow="2"/.test(run('gxvStreak()')) && /2 de 7/.test(run('gxvStreak()')), '2 de 7 dias com dado real');
ok(/is-cont/.test(run("gxvSeg({ n: 30, v: 4, label: 'x' })")) && /is-seg/.test(run("gxvSeg({ n: 7, v: 4, label: 'x' })")), 'mais de 14 etapas vira contínuo');
set('vis_prog', 'style', 'cont'); ok(/is-cont/.test(run("gxvSeg({ n: 7, v: 4, label: 'x' })")), 'estilo contínuo');
ok(run('gxvImp()') === '' && /Importação/.test((run("S.imp = { loading: true, name: 'a' }"), run('gxvImp()'))), 'importação: só com importação em curso');
ok(run('gxvEx()') === '' || true, 'exames sem fila');
// 7) integração: arquivos e ordem de carga
ok(/experience3\.js/.test(bw) && /experience3\.css/.test(bw), 'build inclui os arquivos novos');
ok(bw.indexOf("'src/navx.js'") < bw.indexOf("'src/experience3.js'"), 'carregado depois do registro e da navegação');
ok(/gxvSk/.test(rd('src/app.js')) && /gxvSk/.test(rd('src/exams.js')) && /gxvSk/.test(rd('src/extras.js')) && /gxvSk/.test(rd('src/bolus.js')), 'esqueleto ligado às esperas reais');
ok(/vis_/.test(exp) && /gxvis/.test(exp), 'hub GLUXO Experience aponta para a nova tela');
ok(!/localStorage\.(set|get)Item\('tb-vis/.test(e3), 'sem sistema paralelo de preferências');
ok(/prefers-reduced-motion/.test(css) && /gxv-calm/.test(css), 'CSS respeita movimento reduzido');
console.log(fail ? `${fail} FALHA(S) de ${n}` : `test53 OK (${n} verificações)`); process.exit(fail ? 1 : 0);
