/* test10: configuração local de implantação separada; o wrangler.toml continua sendo só modelo de distribuição */
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..');
let n = 0, fail = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU: ' + m); } };
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const main = rd('worker/wrangler.toml'), ex = rd('worker/wrangler.local.toml.example'), gi = rd('.gitignore'), doc = rd('docs/LICENCIAMENTO.md');
ok(/^database_id = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"/im.test(main) && /^PUBLIC_URL = "https?:\/\/[^"]+"/m.test(main) && /^GOOGLE_CLIENT_ID = "[^"]+\.apps\.googleusercontent\.com"/m.test(main), 'wrangler.toml principal preserva a configuração pública real');
ok(/^worker\/wrangler\.local\.toml$/m.test(gi), 'wrangler.local.toml está no .gitignore');
for (const k of ['name = "tiabete-license-api"', 'binding = "DB"', 'database_name = "tiabete-licenses"', 'migrations_dir = "migrations"', 'APP_RETURN = "app.tiabete.glicose:/pagamento"', 'MP_SELLER_ID', 'main = "src/index.js"']) ok(ex.includes(k), 'modelo local preserva ' + k);
ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(ex), 'modelo local sem UUID real');
ok(!/(APP_USR|TEST-|"d"\s*:|MP_ACCESS_TOKEN\s*=|MP_WEBHOOK_SECRET\s*=|LICENSE_PRIVATE_JWK\s*=)/.test(ex + main), 'sem segredos nos arquivos de modelo');
ok(!fs.existsSync(path.join(ROOT, 'worker/wrangler.local.toml')) || process.env.TB_ALLOW_LOCAL === '1', 'ZIP/pasta de distribuição sem wrangler.local.toml (use TB_ALLOW_LOCAL=1 só no seu computador)');
ok(doc.includes('--config wrangler.local.toml') && doc.includes('--dry-run') && doc.includes('wrangler.local.toml.example'), 'documentação traz os comandos com --config e dry-run');
console.log(fail ? `${fail} falha(s) em ${n}` : `test10 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
