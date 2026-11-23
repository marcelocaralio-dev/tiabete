// test42: abertura (splash) com o vídeo oficial. Estático (arquivos, build, integração) + navegador real quando o playwright existe.
process.removeAllListeners('warning');
const path = require('path'), fs = require('fs'), crypto = require('crypto'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
/* 1. vídeo oficial, sem alteração, embalado localmente */
ok(sha('assets/splash/gluxo-splash.mp4') === 'f299897962eace44bf4921284b31edf401c47b63a8fc55858af0ee237d44fbe4', 'vídeo oficial preservado (SHA-256)');
cp.execFileSync('node', [path.join(ROOT, 'scripts/build-web.js')], { stdio: 'ignore' });
ok(sha('www/splash/gluxo-splash.mp4') === sha('assets/splash/gluxo-splash.mp4'), 'build copia o vídeo sem alterar para www/splash');
const html = rd('www/index.html'), sp = rd('src/splash.html');
ok(html.indexOf('id="tb-splash"') > 0 && html.indexOf('id="tb-splash"') < html.indexOf('window.TB_PUBLIC'), 'splash fica antes de todo o código do app');
ok(!/<video[^>]*\scontrols[\s>=]/.test(sp) && !/<button|<h1|<p>|spinner/i.test(sp.split('<script>')[0]), 'sem controles, botões, texto ou spinner');
ok(/background:#000;/.test(sp) && /object-fit:contain/.test(sp) && /muted/.test(sp) && /playsinline/.test(sp) && /poster="data:image\/png/.test(sp), 'preto absoluto, proporção preservada, mudo, inline, pôster preto');
ok(!/https?:\/\//.test(sp.replace(/xmlns="[^"]*"/g, '')), 'tudo local: nenhuma URL externa na abertura');
/* 2. integração */
ok(/GxSplash\.done\('app'\)/.test(rd('src/init.js')) && /GxSplash\.wait\('gate'\)/.test(rd('native/login.js')) && !/#tb-splash\{/.test(rd('native/login.js')), 'Home/entrada avisam a abertura; splash antiga estática removida');
ok(JSON.parse(rd('capacitor.config.json')).backgroundColor === '#000000' && /launchTheme/.test(rd('scripts/patch-android.js')), 'Android: WebView e tema de lançamento pretos');
ok(/splash\//.test(rd('scripts/build-pwa.js')) && /res\.status === 200/.test(rd('scripts/build-pwa.js')), 'PWA: vídeo no cache offline');
/* 3. controlador em ambiente simulado (sem navegador) */
function sim(opts) {
  const vm = require('vm'), timers = []; let now = 0; const L = {}; const cls = new Set(); let removed = 0;
  const v = { paused: true, muted: false, canPlayType: () => opts.can, addEventListener: (e, f) => { L[e] = f; }, play() { v.paused = false; return opts.playFail ? Promise.reject(new Error('x')) : Promise.resolve(); }, pause() { }, removeAttribute() { }, load() { }, set src(x) { v._s = x; } };
  const el = { querySelector: () => v, classList: { add: c => cls.add(c) }, parentNode: { removeChild: () => { removed++; } } };
  const ss = new Map(); if (opts.seen) ss.set('gx-splash-v1', '1');
  const ctx = { window: {}, document: { getElementById: i => i === 'tb-splash' ? el : null, addEventListener() { }, visibilityState: 'visible' }, sessionStorage: { getItem: k => ss.get(k) || null, setItem: (k, x) => ss.set(k, x) }, Event: function () { },
    setTimeout: (f, ms) => { timers.push({ f, at: now + ms, on: true }); return timers.length - 1; }, clearTimeout: i => { if (timers[i]) timers[i].on = false; } };
  ctx.window.dispatchEvent = () => { }; ctx.window.GxSplash = null; vm.createContext(ctx);
  vm.runInContext(sp.split('<script>')[1].split('</script>')[0], ctx);
  const adv = ms => { const to = now + ms; for (;;) { const t = timers.filter(x => x.on && x.at <= to).sort((a, b) => a.at - b.at)[0]; if (!t) break; now = t.at; t.on = false; t.f(); } now = to; };
  return { G: ctx.window.GxSplash, v, L, cls, adv, removed: () => removed };
}
let s = sim({ can: 'probably' });
s.adv(2600); s.L.ended && s.L.ended(); ok(!s.cls.has('out'), 'ao fim do vídeo, espera a Home ficar pronta');
s.G.done('app'); ok(s.cls.has('out'), 'Home pronta + vídeo terminado → fade'); s.adv(600); ok(s.removed() === 1 && !s.G.active(), 'elemento removido após o fade');
s = sim({ can: 'probably' }); s.G.done('app'); ok(!s.cls.has('out'), 'Home pronta antes do fim do vídeo não corta a animação'); s.L.ended(); ok(s.cls.has('out'), 'fade logo ao terminar');
s = sim({ can: 'probably' }); s.L.ended(); s.adv(2600); ok(s.cls.has('out'), 'app lento: abertura não fica presa (limite após o fim)');
s = sim({ can: 'probably' }); s.adv(9100); ok(s.cls.has('out'), 'vídeo travado: limite máximo dispensa a abertura');
s = sim({ can: '' }); ok(s.removed() === 1 && !s.G.active(), 'sem codec: removida na hora');
s = sim({ can: 'probably', seen: true }); ok(s.removed() === 1 && !s.G.active(), 'mesma sessão (recarga): não repete');
s = sim({ can: 'probably' }); s.G.wait('gate'); s.G.done('app'); s.L.ended(); ok(!s.cls.has('out'), 'aguarda também a tela de entrada'); s.G.done('gate'); ok(s.cls.has('out'), 'libera após a tela de entrada');
/* 4. navegador real (opcional) */
(async () => {
  s = sim({ can: 'probably', playFail: true }); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); s.G.done('app'); ok(s.cls.has('out'), 'autoplay barrado: dispensa sem travar');
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('(navegador real ignorado: playwright não instalado)'); return end(); }
  const http = require('http'), srv = http.createServer((q, r) => { const f = path.join(ROOT, 'www', q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); } r.setHeader('content-type', f.endsWith('.mp4') ? 'video/mp4' : 'text/html'); r.end(fs.readFileSync(f)); });
  await new Promise(r => srv.listen(0, r)); const url = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const b = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] }), ctx = await b.newContext({ viewport: { width: 412, height: 915 } }), pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.route('**/fonts.*/**', r => r.abort());
  await pg.goto(url); await pg.waitForSelector('#view');
  const i = await pg.evaluate(() => { const e = document.getElementById('tb-splash'); if (!e) return { gone: true }; const v = e.querySelector('video'), r = v.getBoundingClientRect(); return { w: r.width, h: r.height, c: v.controls, bg: getComputedStyle(e).backgroundColor }; });
  if (!i.gone) ok(i.w === 412 && i.h === 915 && !i.c && i.bg === 'rgb(0, 0, 0)', 'navegador: tela cheia, preta, sem controles');
  await pg.waitForSelector('#tb-splash', { state: 'detached', timeout: 10000 }); ok(await pg.evaluate(() => document.getElementById('view').children.length > 0), 'navegador: Home renderizada ao fim da abertura');
  await pg.evaluate(() => go('historico')); ok(!(await pg.$('#tb-splash')), 'navegar entre telas não repete a abertura');
  await pg.reload(); await pg.waitForSelector('#view'); ok(!(await pg.$('#tb-splash')), 'navegador: recarga na mesma sessão não repete'); ok(errs.length === 0, 'sem erros de página ' + errs.slice(0, 2));
  await b.close(); srv.close(); end();
})().catch(e => { console.log('erro', e); process.exit(1); });
function end() { console.log(fail ? `${fail} falha(s) em ${n}` : `test42 ok (${n} verificações)`); process.exit(fail ? 1 : 0); }
