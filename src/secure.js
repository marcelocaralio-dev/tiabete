/* ---------- Segurança: backup cifrado (AES-GCM), Drive cifrado e bloqueio por PIN ----------
   Tudo roda no aparelho (Web Crypto). Não há servidor, e senha/PIN esquecidos não têm recuperação. */
const SEC = { bioAvail: false, bioMsg: '', form: null, pend: null, msg: '', drvOn: false, hiddenAt: 0, locked: false, bioBusy: false, bioSt: null };
const SEC_ITER = 250000, SEC_MIN = 8;
const secOk = () => !!(window.crypto && crypto.subtle);
const b64e = u => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); };
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function secKey(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pass).normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function secSeal(text, key, salt, iter) {
  const iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
  return JSON.stringify({ app: 'TiaBete', enc: 1, kdf: 'PBKDF2-SHA256', iter, salt: b64e(salt), iv: b64e(iv), data: b64e(ct) });
}
async function secOpenWith(env, key) {
  try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(env.iv) }, key, b64d(env.data))); }
  catch (e) { throw new Error('Senha incorreta ou arquivo danificado.'); }
}
async function secOpen(env, pass) {
  if (!env || env.enc !== 1 || !env.salt || !env.iv || !env.data || !(env.iter >= 1e5 && env.iter <= 2e6)) throw new Error('Arquivo protegido em formato desconhecido.');
  return secOpenWith(env, await secKey(pass, b64d(env.salt), env.iter));
}
const secPassOk = (a, b) => a.length < SEC_MIN ? `Use pelo menos ${SEC_MIN} caracteres.` : a !== b ? 'As senhas não conferem.' : '';
/* Chave do Drive: derivada da senha e guardada (não extraível) no banco local, para os backups automáticos */
async function secDriveRec() { try { return (await Store.all('meta')).find(x => x.id === 'enc-key') || null; } catch (e) { return null; } }
async function secDriveKey() { const r = await secDriveRec(); if (!r) return null; if (!r.key) throw new Error('A chave de proteção do Drive não está disponível neste aparelho. Defina a senha de novo.'); return r; }
async function secExportEnc(pass) {
  const txt = backupText(); if (!txt) { toast('Ainda não há dados reais para exportar.'); return false; }
  const salt = crypto.getRandomValues(new Uint8Array(16)), out = await secSeal(txt, await secKey(pass, salt, SEC_ITER), salt, SEC_ITER);
  if (await saveFile(`tiabete-backup-${stamp()}-protegido.json`, out, out) === true) { await markBackup(); return true; } return false;
}
async function secIngest(text) {
  const j = JSON.parse(text); await ingestBackup(j);
}
/* ---- Bloqueio por PIN ---- */
const LK_KEY = 'tb-lock';
const lkCfg = () => { try { const c = JSON.parse(localStorage.getItem(LK_KEY) || 'null'); return c && c.hash && c.salt ? c : null; } catch (e) { return null; } };
const lkSave = c => { try { if (c) localStorage.setItem(LK_KEY, JSON.stringify(c)); else localStorage.removeItem(LK_KEY); } catch (e) { } };
async function lkHash(pin, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode('tb-pin:' + pin), 'PBKDF2', false, ['deriveBits']);
  return b64e(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64d(salt), iterations: 150000, hash: 'SHA-256' }, base, 256)));
}
async function lkCheck(pin) { const c = lkCfg(); return !!c && (await lkHash(pin, c.salt)) === c.hash; }
const lkWait = () => { const c = lkCfg(); return c && c.until > Date.now() ? Math.ceil((c.until - Date.now()) / 1000) : 0; };
/* ---- Biometria / rosto (WebAuthn, autenticador do próprio aparelho) ---- */
/* No APK: biometria nativa do Android (BiometricPrompt, via plugin TbBiometric). Nos demais ambientes: WebAuthn. */
const bioNat = () => { try { const C = window.Capacitor; return (C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.TbBiometric) || null; } catch (e) { return null; } };
const BIO_TXT = { none_hardware: 'Este aparelho não tem leitor de digital nem reconhecimento facial compatível.', none_enrolled: 'O aparelho tem biometria, mas nenhuma digital ou rosto está cadastrado. Cadastre nas configurações do Android e volte aqui.', hw_unavailable: 'O sensor de biometria está indisponível agora. Tente de novo em instantes.', security_update: 'O Android pede uma atualização de segurança antes de liberar a biometria.', unsupported: 'Este Android não oferece este nível de biometria ao app.', lockout: 'Biometria bloqueada por muitas tentativas. Aguarde um pouco ou use o PIN.', lockout_permanent: 'O Android bloqueou a biometria. Desbloqueie o aparelho com o PIN ou a senha dele para liberá-la. Enquanto isso, use o PIN do TiaBete.', user_cancel: 'Autenticação cancelada.', timeout: 'Tempo esgotado. Tente de novo ou use o PIN.', unavailable: 'A biometria não está disponível agora. Use o PIN.', unknown: 'Não foi possível verificar a biometria deste aparelho.' };
const bioWhy = code => BIO_TXT[code] || BIO_TXT.unknown;
const bioDo = async fn => { SEC.bioBusy = true; try { return await fn(); } finally { setTimeout(() => { SEC.bioBusy = false; SEC.hiddenAt = 0; }, 1200); } };
const bioOk = () => !!(bioNat() || (window.PublicKeyCredential && navigator.credentials && secOk()));
const b64u = u => b64e(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const bioRnd = n => crypto.getRandomValues(new Uint8Array(n));
async function bioProbe() { const N = bioNat(); if (N) { try { SEC.bioSt = await N.status(); SEC.bioAvail = !!SEC.bioSt.available; } catch (e) { SEC.bioSt = { available: false, code: 'unknown' }; SEC.bioAvail = false; } } else { try { SEC.bioAvail = bioOk() && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch (e) { SEC.bioAvail = false; } } if ((S.route === 'backup' || S.route === 'seguranca') && typeof render === 'function') { try { render(); } catch (e) { } } }
async function bioEnroll() {
  const N = bioNat();
  if (N) {
    await bioProbe(); if (!SEC.bioAvail) { const e = new Error(bioWhy(SEC.bioSt && SEC.bioSt.code)); e.bioCode = SEC.bioSt && SEC.bioSt.code; throw e; }
    try { await bioDo(() => N.authenticate({ title: 'Ativar biometria no TiaBete', subtitle: 'Confirme com a digital ou o rosto cadastrados no aparelho', negative: 'Cancelar' })); }
    catch (er) { const e = new Error(bioWhy(er && er.code)); e.bioCode = er && er.code; throw e; }
    return { native: 1 };
  }
  const cred = await navigator.credentials.create({ publicKey: { rp: { name: 'TiaBete' }, user: { id: bioRnd(16), name: 'tiabete', displayName: 'TiaBete' }, challenge: bioRnd(32), pubKeyCredParams: [{ type: 'public-key', alg: -7 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000, attestation: 'none' } });
  const pk = cred && cred.response.getPublicKey && cred.response.getPublicKey(); if (!pk) throw new Error('Este aparelho não devolveu a chave de verificação.');
  return { id: b64e(new Uint8Array(cred.rawId)), pk: b64e(new Uint8Array(pk)) };
}
function bioDer(sig) { // assinatura ECDSA DER -> r||s (64 bytes)
  let i = 2; if (sig[1] & 0x80) i += sig[1] & 0x7f; const rd = () => { i++; const l = sig[i++]; let v = sig.slice(i, i + l); i += l; while (v.length > 32 && v[0] === 0) v = v.slice(1); const o = new Uint8Array(32); o.set(v, 32 - v.length); return o; };
  const r = rd(), s = rd(), o = new Uint8Array(64); o.set(r); o.set(s, 32); return o;
}
async function bioVerify(bio) {
  if (bio && bio.native) { const N = bioNat(); if (!N) return false; await bioDo(() => N.authenticate({ title: 'Abrir o TiaBete', subtitle: 'Use a digital ou o rosto cadastrados no aparelho', negative: 'Usar PIN' })); return true; }
  const ch = bioRnd(32);
  const a = await navigator.credentials.get({ publicKey: { challenge: ch, allowCredentials: [{ type: 'public-key', id: b64d(bio.id), transports: ['internal'] }], userVerification: 'required', timeout: 60000 } });
  const r = a.response, cd = new Uint8Array(r.clientDataJSON), cj = JSON.parse(new TextDecoder().decode(cd)), ad = new Uint8Array(r.authenticatorData);
  if (cj.type !== 'webauthn.get' || cj.challenge !== b64u(ch) || !(ad[32] & 4)) return false;
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', cd)), data = new Uint8Array(ad.length + 32); data.set(ad); data.set(h, ad.length);
  const key = await crypto.subtle.importKey('spki', b64d(bio.pk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, bioDer(new Uint8Array(r.signature)), data);
}
async function lkBio(silent) {
  const c = lkCfg(); if (!c || !c.bio || !SEC.locked) return;
  const msg = document.getElementById('lk-msg');
  if (SEC.bioBusy) return;
  try { if (await bioVerify(c.bio)) { c.fails = 0; c.until = 0; lkSave(c); lkHide(); return; } if (msg && !silent) msg.textContent = 'Não foi possível confirmar. Use o PIN.'; }
  catch (e) {
    const code = e && e.code; if (c.bio && c.bio.native && msg && (code !== 'user_cancel' || !silent)) msg.textContent = (code === 'user_cancel' ? 'Autenticação cancelada. Digite o PIN ou toque em “Usar biometria ou rosto”.' : bioWhy(code) + (code === 'lockout' || code === 'lockout_permanent' || code === 'none_enrolled' || code === 'none_hardware' || code === 'hw_unavailable' ? '' : ' Use o PIN.'));
    else if (msg && !silent) msg.textContent = 'Biometria cancelada ou indisponível. Use o PIN.';
  }
}
function lkShow(forgot) {
  const c = lkCfg(); if (!c || !document.body) return;
  SEC.locked = true; try { if (typeof drClose === 'function') drClose(false); } catch (e) { }
  let o = document.getElementById('lk');
  if (!o) { o = document.createElement('div'); o.id = 'lk'; o.className = 'lk'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'TiaBete bloqueado'); document.body.appendChild(o); }
  document.querySelectorAll('.top, #view, #nav').forEach(e => e.setAttribute('inert', ''));
  o.innerHTML = forgot ? `<div class="lk-in"><h1>Esqueci o PIN</h1><p>Por segurança, o PIN não pode ser recuperado. Você pode <b>apagar todos os dados deste aparelho</b> e remover o bloqueio. Depois, restaure um backup seu, se tiver.</p>
      <form data-lk-form="wipe"><label for="lk-w">Digite APAGAR para confirmar</label><input id="lk-w" autocomplete="off" autocapitalize="characters"><button class="btn pri full" type="submit">Apagar dados e remover PIN</button><button class="btn full" type="button" data-lk="back">Voltar</button></form></div>`
    : `<div class="lk-in"><h1>TiaBete</h1><p>Digite o seu PIN para abrir.</p>
      <form data-lk-form="pin"><input id="lk-pin" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="8" aria-label="PIN" aria-describedby="lk-msg"><div class="lk-msg" id="lk-msg" role="alert"></div><button class="btn pri full" type="submit">Entrar</button>${c.bio ? '<button class="btn full" type="button" data-lk="bio">Usar biometria ou rosto</button>' : ''}<button class="btn full" type="button" data-lk="forgot">Esqueci o PIN</button></form></div>`;
  const f = o.querySelector('input'); if (f) setTimeout(() => f.focus(), 30);
  if (!forgot && c.bio) setTimeout(() => lkBio(true), 350);
}
function lkHide() { SEC.locked = false; const o = document.getElementById('lk'); if (o) o.remove(); document.querySelectorAll('.top, #view, #nav').forEach(e => e.removeAttribute('inert')); }
document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-lk-form]'); if (!f) return; e.preventDefault();
  if (f.dataset.lkForm === 'pin') {
    const inp = f.querySelector('input'), msg = f.querySelector('.lk-msg'), w = lkWait(); if (w) { msg.textContent = `Muitas tentativas. Aguarde ${w} s.`; return; }
    if (await lkCheck(inp.value)) { const c = lkCfg(); c.fails = 0; c.until = 0; lkSave(c); lkHide(); return; }
    const c = lkCfg(); c.fails = (c.fails || 0) + 1; if (c.fails >= 5) { c.until = Date.now() + Math.min(300, 15 * 2 ** (c.fails - 5)) * 1000; } lkSave(c);
    inp.value = ''; msg.textContent = c.until > Date.now() ? `PIN incorreto. Aguarde ${lkWait()} s para tentar de novo.` : 'PIN incorreto.'; inp.focus();
  } else if (f.dataset.lkForm === 'wipe') {
    if (f.querySelector('input').value.trim().toUpperCase() !== 'APAGAR') return;
    lkSave(null); try { await Store.del('meta', 'enc-key'); } catch (er) { } SEC.drvOn = false; lkHide(); await wipeData('all');
  }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-lk]'); if (!b) return; if (b.dataset.lk === 'bio') { lkBio(false); return; } lkShow(b.dataset.lk === 'forgot');
});
document.addEventListener('visibilitychange', () => {
  if (!lkCfg()) return;
  if (SEC.bioBusy) return;
  if (document.hidden) { SEC.hiddenAt = Date.now(); return; }
  const c = lkCfg(); if (!SEC.locked && SEC.hiddenAt && Date.now() - SEC.hiddenAt >= (c.after || 0) * 1000) lkShow();
});
if (lkCfg()) { if (document.body) lkShow(); else document.addEventListener('DOMContentLoaded', () => lkShow()); }
/* ---- Cartão "Proteção dos dados" (Backup e dados) ---- */
const secPwField = (id, label, auto) => `<label class="fl" for="${id}">${label}</label><input id="${id}" type="password" autocomplete="${auto || 'new-password'}" class="in" style="width:100%;margin-bottom:10px">`;
function secForm() {
  const f = SEC.form, msg = SEC.msg ? `<p class="hint" role="alert" style="color:var(--red-t);margin:0 0 10px">${esc(SEC.msg)}</p>` : '';
  const pin = (id, l) => `<label class="fl" for="${id}">${l}</label><input id="${id}" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" class="in" style="width:100%;margin-bottom:10px">`;
  const warn = '<p class="hint" style="margin:0 0 10px"><b>Atenção:</b> se você esquecer a senha, ninguém consegue recuperar estes dados, nem o TiaBete.</p>';
  const go = t => `<div class="row" style="gap:8px"><button class="btn pri grow" type="submit">${t}</button><button class="btn" type="button" data-sec="cancel">Cancelar</button></div>`;
  if (f === 'bk') return `<form data-sec-form="bk">${warn}${secPwField('sec-p1', `Senha do arquivo (mín. ${SEC_MIN} caracteres)`)}${secPwField('sec-p2', 'Repita a senha')}${msg}${go('Gerar backup protegido')}</form>`;
  if (f === 'drv') return `<form data-sec-form="drv">${warn}<p class="hint" style="margin:0 0 10px">Os backups enviados ao Drive passam a ser gravados cifrados. Para restaurar em outro aparelho você vai precisar desta senha.</p>${secPwField('sec-p1', `Senha dos backups do Drive (mín. ${SEC_MIN} caracteres)`)}${secPwField('sec-p2', 'Repita a senha')}${msg}${go('Ativar cifra no Drive')}</form>`;
  if (f === 'pin') return `<form data-sec-form="pin">${pin('sec-p1', 'Novo PIN (4 a 8 números)')}${pin('sec-p2', 'Repita o PIN')}${msg}${go('Salvar PIN')}</form>`;
  if (f === 'pin-off') return `<form data-sec-form="pin-off">${pin('sec-p1', 'PIN atual')}${msg}${go('Remover bloqueio')}</form>`;
  return '';
}
function secCard() {
  if (!secOk()) return `<h2 class="sec">Proteção dos dados</h2><div class="card"><p class="hint" style="margin:0">Este navegador não oferece criptografia segura (Web Crypto). Use o app em endereço seguro (https).</p></div>`;
  const lk = lkCfg(), f = SEC.form, open = k => f === k;
  const blk = (t, d, btn, k) => `<div style="padding:12px 0;border-top:1px solid var(--line)"><div class="row sp" style="gap:10px;align-items:center"><div style="min-width:0"><b>${t}</b><p class="hint" style="margin:2px 0 0">${d}</p></div>${open(k) ? '' : btn}</div>${open(k) ? `<div style="margin-top:12px">${secForm()}</div>` : ''}</div>`;
  const bio = lk ? `<div style="padding:12px 0;border-top:1px solid var(--line)"><div class="row sp" style="gap:10px;align-items:center"><div style="min-width:0"><b>Biometria ou rosto</b><p class="hint" style="margin:2px 0 0">${lk.bio ? '✓ Ativa: você pode abrir o app com a biometria do aparelho. O PIN continua valendo.' : SEC.bioAvail ? 'Abre o app com a digital ou o rosto cadastrados no aparelho. O PIN continua como reserva.' : (bioNat() ? bioWhy(SEC.bioSt && SEC.bioSt.code) : 'Não disponível aqui: o aparelho ou o ambiente (por exemplo, o visualizador) não oferece biometria ao app.')}</p></div>${lk.bio ? '<button class="btn" data-sec="bio-off">Desativar</button>' : SEC.bioAvail ? '<button class="btn" data-sec="bio-on">Ativar</button>' : bioNat() ? '<button class="btn" data-sec="bio-recheck">Verificar de novo</button>' : ''}</div>${!lk.bio && !SEC.bioAvail && bioNat() && SEC.bioSt && SEC.bioSt.code === 'none_enrolled' ? '<button class="btn full" style="margin-top:10px" data-sec="bio-settings">Abrir as configurações de biometria do Android</button>' : ''}${SEC.bioMsg ? `<p class="hint" role="alert" style="color:var(--red-t);margin:8px 0 0">${esc(SEC.bioMsg)}</p>` : ''}</div>` : '';
  const sel = lk ? `<div style="padding:12px 0;border-top:1px solid var(--line)"><label class="fl" for="sec-after">Pedir o PIN ao voltar para o app</label><select id="sec-after" class="in" style="width:100%">${[[0, 'Sempre'], [60, 'Após 1 minuto fora'], [300, 'Após 5 minutos fora']].map(([v, t]) => `<option value="${v}" ${(lk.after || 0) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>` : '';
  return `<h2 class="sec">Proteção dos dados</h2><div class="card"><p class="hint" style="margin:0 0 4px">Seus dados de saúde ficam só neste aparelho. Estas opções protegem o <b>arquivo de backup</b>, os backups do <b>Drive</b> e o <b>acesso ao app</b>.</p>
    ${blk('Backup protegido por senha', 'Gera um arquivo .json cifrado (AES-256). Sem a senha ele é ilegível.', '<button class="btn" data-sec="bk">Gerar</button>', 'bk')}
    ${blk('Drive com criptografia', SEC.drvOn ? '✓ Ativa: os backups novos do Drive são gravados cifrados.' : 'Cifra os backups antes de enviar ao Drive. Desativada.', SEC.drvOn ? '<button class="btn" data-sec="drv-off">Desativar</button>' : '<button class="btn" data-sec="drv">Ativar</button>', 'drv')}
    ${blk('Bloqueio por PIN', lk ? '✓ Ativo: o app pede o PIN ao abrir.' : 'Pede um PIN ao abrir o app. Protege contra uso casual do aparelho.', lk ? '<button class="btn" data-sec="pin-off">Remover</button>' : '<button class="btn" data-sec="pin">Ativar</button>', lk ? 'pin-off' : 'pin')}
    ${bio}${sel}
    <p class="hint" style="margin:12px 0 0">O PIN e a biometria impedem o acesso pelo app, mas <b>não cifra</b> o que está guardado no aparelho; quem tiver acesso ao navegador ou ao arquivo do app pode ler os dados. O bloqueio do celular continua sendo a proteção principal. PIN ou senha esquecidos não podem ser recuperados.</p></div>`;
}
function secPrompt() {
  if (!SEC.pend) return '';
  return `<form data-sec-form="open" style="margin-top:14px"><div class="eyebrow">Backup protegido</div><p class="hint" style="margin:6px 0 10px">Digite a senha usada ao gerar este arquivo.</p>${secPwField('sec-pw', 'Senha', 'current-password')}${SEC.msg ? `<p class="hint" role="alert" style="color:var(--red-t);margin:0 0 10px">${esc(SEC.msg)}</p>` : ''}<div class="row" style="gap:8px"><button class="btn pri grow" type="submit">Abrir backup</button><button class="btn" type="button" data-sec="cancel-open">Cancelar</button></div></form>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-sec]'); if (!b) return; const a = b.dataset.sec;
  if (['bk', 'drv', 'pin', 'pin-off'].includes(a)) { SEC.form = a; SEC.msg = ''; render(); setTimeout(() => { const i = document.getElementById('sec-p1'); if (i) i.focus(); }, 30); }
  else if (a === 'cancel') { SEC.form = null; SEC.msg = ''; render(); }
  else if (a === 'cancel-open') { SEC.pend = null; SEC.msg = ''; render(); }
  else if (a === 'bio-on') { SEC.bioMsg = ''; try { const bio = await bioEnroll(), c = lkCfg(); if (c) { c.bio = bio; lkSave(c); toast('Biometria ativada.'); } } catch (er) { SEC.bioMsg = er && er.bioCode ? er.message : er && er.name === 'NotAllowedError' ? 'Cancelado, ou este ambiente não permite biometria. Se estiver no visualizador, abra o app pelo endereço dele.' : (er && er.message && er.message.length < 120 ? er.message : 'Não foi possível ativar a biometria.'); } render(); }
  else if (a === 'bio-recheck') { await bioProbe(); render(); }
  else if (a === 'bio-settings') { try { await bioNat().openSettings(); } catch (er) { SEC.bioMsg = 'Não consegui abrir as configurações. Abra Configurações do Android → Segurança → Biometria.'; render(); } }
  else if (a === 'bio-off') { const c = lkCfg(); if (c) { delete c.bio; lkSave(c); } SEC.bioMsg = ''; render(); toast('Biometria desativada. O PIN continua ativo.'); }
  else if (a === 'drv-off') { try { await Store.del('meta', 'enc-key'); } catch (er) { } SEC.drvOn = false; render(); toast('Cifra do Drive desativada. Os próximos backups serão sem senha.'); }
});
document.addEventListener('change', e => { if (e.target.id !== 'sec-after') return; const c = lkCfg(); if (c) { c.after = +e.target.value || 0; lkSave(c); toast('Preferência salva.'); } });
document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-sec-form]'); if (!f) return; e.preventDefault(); const k = f.dataset.secForm, v = id => (document.getElementById(id) || {}).value || '';
  const fail = m => { SEC.msg = m; render(); };
  try {
    if (k === 'bk') { const m = secPassOk(v('sec-p1'), v('sec-p2')); if (m) return fail(m); const ok = await secExportEnc(v('sec-p1')); SEC.form = null; SEC.msg = ''; render(); if (ok) toast('Backup protegido salvo.'); }
    else if (k === 'drv') { const m = secPassOk(v('sec-p1'), v('sec-p2')); if (m) return fail(m); const salt = crypto.getRandomValues(new Uint8Array(16)); await Store.put('meta', { id: 'enc-key', salt: b64e(salt), iter: SEC_ITER, key: await secKey(v('sec-p1'), salt, SEC_ITER) }); SEC.drvOn = true; SEC.form = null; SEC.msg = ''; render(); toast('Backups do Drive agora são cifrados.'); }
    else if (k === 'pin') { const p = v('sec-p1'); if (!/^\d{4,8}$/.test(p)) return fail('Use de 4 a 8 números.'); if (p !== v('sec-p2')) return fail('Os PINs não conferem.'); const salt = b64e(crypto.getRandomValues(new Uint8Array(16))); lkSave({ salt, hash: await lkHash(p, salt), after: 60, fails: 0, until: 0 }); SEC.form = null; SEC.msg = ''; render(); toast('PIN ativado.'); }
    else if (k === 'pin-off') { if (!(await lkCheck(v('sec-p1')))) return fail('PIN incorreto.'); lkSave(null); SEC.form = null; SEC.msg = ''; render(); toast('Bloqueio removido.'); }
    else if (k === 'open') {
      const env = SEC.pend; let key = null; const r = await secDriveRec();
      const txt = r && r.key && r.salt === env.salt ? await secOpenWith(env, r.key).catch(() => null) : null;
      const plain = txt != null && !v('sec-pw') ? txt : await secOpen(env, v('sec-pw'));
      SEC.pend = null; SEC.msg = ''; await secIngest(plain);
    }
  } catch (er) { SEC.msg = er && er.message && er.message.length < 120 ? er.message : 'Não foi possível concluir.'; render(); }
});
(async () => { const r = await secDriveRec(); SEC.drvOn = !!r; })();
bioProbe();

document.addEventListener('visibilitychange', () => { if (!document.hidden && bioNat() && !SEC.bioBusy) bioProbe(); });
