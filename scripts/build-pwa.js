// Gera pwa/ (aplicativo web instalável pelo navegador) a partir de www/ (rode antes: node scripts/build-web.js).
// Não altera www/ nem o app Android: só copia e acrescenta manifesto, service worker e ícones.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..'), www = path.join(root, 'www'), out = path.join(root, 'pwa');
if (!fs.existsSync(path.join(www, 'index.html'))) { console.error('Rode "node scripts/build-web.js" antes (www/index.html não existe).'); process.exit(1); }
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
if (fs.existsSync(path.join(www, 'fonts'))) fs.cpSync(path.join(www, 'fonts'), path.join(out, 'fonts'), { recursive: true });
if (fs.existsSync(path.join(www, 'splash'))) fs.cpSync(path.join(www, 'splash'), path.join(out, 'splash'), { recursive: true });
for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) fs.copyFileSync(path.join(root, 'assets', 'pwa', f), path.join(out, 'icons', f));
let html = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
const head = '<link rel="manifest" href="manifest.webmanifest"><link rel="icon" type="image/png" href="icons/icon-192.png"><link rel="apple-touch-icon" href="icons/icon-192.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="GLUXO">';
const reg = '<script>if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol)){window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})})}</script>';
html = html.replace('</head>', () => head + '</head>').replace('</body>', () => reg + '</body>');
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'GLUXO · Controle da glicose', short_name: 'GLUXO', description: 'Controle de glicemia e insulina. Os dados ficam só neste aparelho.', lang: 'pt-BR',
  start_url: './index.html', scope: './', display: 'standalone', orientation: 'portrait', background_color: '#0a090c', theme_color: '#0a090c',
  icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
}, null, 2));
const files = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png']
  .concat(fs.existsSync(path.join(out, 'fonts')) ? fs.readdirSync(path.join(out, 'fonts')).map(f => 'fonts/' + f) : [])
  .concat(fs.existsSync(path.join(out, 'splash')) ? fs.readdirSync(path.join(out, 'splash')).map(f => 'splash/' + f) : []);
const ver = crypto.createHash('sha1').update(html).digest('hex').slice(0, 10);
/* Service worker: só guarda arquivos do próprio app (mesma origem). Servidor de licenças, Google e qualquer outra origem passam direto pela rede, sem cache. */
fs.writeFileSync(path.join(out, 'sw.js'), `const CACHE = 'gluxo-pwa-${ver}', FILES = ${JSON.stringify(files)};
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => (k.startsWith('gluxo-pwa-') || k.startsWith('tiabete-pwa-')) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return; const u = new URL(r.url); if (u.origin !== self.location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res && res.ok && res.status === 200) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
`);
console.log('pwa/ pronto (' + files.length + ' arquivos no cache, versão ' + ver + '). Sirva a pasta por HTTPS (ou localhost) e instale pelo navegador.');
