/* ================= Licenciamento · núcleo compartilhado (app e Worker) =================
   Só lógica pura e criptografia Web Crypto: sem acesso a dados de saúde, sem armazenamento, sem rede.
   O mesmo arquivo roda no app (escopo global) e no Worker/testes (module.exports).
   Token da licença = base64url(JSON) + "." + base64url(assinatura ECDSA P-256/SHA-256, formato bruto r||s).
   O Worker assina; o app só tem a chave pública e confere a assinatura (funciona offline). */
const LIC_TRIAL_MS = 336 * 3600 * 1000;        /* 14 dias = exatamente 336 horas */
const LIC_GRACE_MS = 7 * 24 * 3600 * 1000;     /* validade do token sem internet; depois só os recursos premium pausam */
const LIC_GRACE_LIFETIME_MS = 30 * 24 * 3600 * 1000; /* licença vitalícia já paga: tolera 30 dias sem internet */
const LIC_SKEW_MS = 5 * 60 * 1000;
const LIC_STATES = ['pending_trial', 'trial_active', 'trial_expired', 'payment_pending', 'lifetime_active', 'refunded', 'revoked'];

const licB64u = u => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const licB64d = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const licSubtle = () => (typeof crypto !== 'undefined' && crypto.subtle) || null;
const licEnc = new TextEncoder(), licDec = new TextDecoder();

/* Estado a partir dos dados do servidor. now vem SEMPRE do relógio do servidor. */
function licComputeState(acct, lic, openOrder, now) {
  if (lic && lic.status === 'refunded') return 'refunded';
  if (lic && lic.status === 'revoked') return 'revoked';
  if (lic && lic.status === 'active') return 'lifetime_active';
  if (!acct || acct.trial_started_at == null) return 'pending_trial';
  if (openOrder) return 'payment_pending';
  return now < acct.trial_started_at + LIC_TRIAL_MS ? 'trial_active' : 'trial_expired';
}
function licTrialEnd(acct) { return acct && acct.trial_started_at != null ? acct.trial_started_at + LIC_TRIAL_MS : null; }
/* Direito às funções premium segundo o PAYLOAD (usado pelo app e pelo Worker). now = relógio já protegido contra recuo. */
function licPremium(p, now) {
  if (!p || p.v !== 1) return false;
  if (now < p.iat - LIC_SKEW_MS || now > p.vexp) return false;
  if (p.st === 'lifetime_active') return true;
  if ((p.st === 'trial_active' || p.st === 'payment_pending') && p.te != null) return now < p.te;
  return false;
}
async function licSign(payload, privJwk) {
  const s = licSubtle(), k = await s.importKey('jwk', privJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const body = licB64u(licEnc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await s.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, licEnc.encode(body)));
  return body + '.' + licB64u(sig);
}
/* Devolve o payload se a assinatura confere; null se não. Não olha datas (isso é licPremium). */
async function licVerify(token, pubJwk) {
  try {
    const [body, sig] = String(token || '').split('.'); if (!body || !sig) return null;
    const s = licSubtle(), k = await s.importKey('jwk', pubJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await s.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, licB64d(sig), licEnc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(licDec.decode(licB64d(body))); return p && p.v === 1 ? p : null;
  } catch (e) { return null; }
}
/* Relógio protegido: nunca volta para trás em relação ao maior instante já visto neste aparelho. */
function licClock(lastSeen, nowLocal) { return Math.max(+lastSeen || 0, nowLocal); }
/* Texto do prazo restante do teste (só para a interface). */
function licRemaining(te, now) {
  const ms = Math.max(0, te - now), h = Math.floor(ms / 3600e3), d = Math.floor(h / 24);
  return d >= 1 ? `${d} ${d === 1 ? 'dia' : 'dias'}${h % 24 ? ' e ' + (h % 24) + ' h' : ''}` : `${h} h`;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { LIC_TRIAL_MS, LIC_GRACE_MS, LIC_GRACE_LIFETIME_MS, LIC_SKEW_MS, LIC_STATES, licB64u, licB64d, licComputeState, licTrialEnd, licPremium, licSign, licVerify, licClock, licRemaining };
