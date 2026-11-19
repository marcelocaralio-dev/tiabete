// node worker/gen-keys.js  → cria config/license-public-key.json (vai no app) e imprime a chave PRIVADA (vai só no Worker).
const fs = require('fs'), path = require('path');
(async () => {
  const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = await crypto.subtle.exportKey('jwk', k.publicKey), priv = await crypto.subtle.exportKey('jwk', k.privateKey);
  fs.writeFileSync(path.join(__dirname, '..', 'config', 'license-public-key.json'), JSON.stringify(pub));
  console.log('Chave pública gravada em config/license-public-key.json.\n\nCHAVE PRIVADA (guarde só no Worker: wrangler secret put LICENSE_PRIVATE_JWK). NÃO a coloque no repositório:\n' + JSON.stringify(priv));
})();
