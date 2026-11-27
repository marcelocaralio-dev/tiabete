/* ================= Base universal da página inicial · lado do app =================
   Só LÊ o licenciamento oficial (LK, licPremiumNow) e as preferências; não cria regra de assinatura, não grava licença e não apaga preferência.
   gxhAuth()   = autorização Premium (avaliação de 14 dias ou licença ativa), vinda SÓ do licenciamento oficial.
   gxhPers()   = o Modo Experience está EM USO: autorizado E escolhido em Aparência → Modo de interface (src/modos.js, classificação em modos-core.js).
   gxhLocked(f)= o recurso f do catálogo não vale agora (modo Padrão, teste terminado, sem Premium). Quando trava, valem os padrões do app e
                 as preferências guardadas continuam intactas. É o ÚNICO ponto que decide isso: os módulos só perguntam aqui. */
const GXH_FREE = MD_SHARED;   /* alertas e lembretes são compartilhados entre os modos: nunca travam (classificação em modos-core.js) */
let gxhPT = { t: 0, v: true };
/* Licença ainda não respondeu (carregando ou sem token lido)? */
const gxhUnsure = () => { try { return typeof LK !== 'undefined' && !!LK.cfg && (LK.loaded !== true || !LK.payload); } catch (e) { return false; } };   /* sem token lido = não sabemos (cofre ainda não pronto ou leitura falhou): não é perda */
/* gxhAuth = Premium confirmado agora (gxhAuthReal) OU, só enquanto a licença não responde, a confirmação anterior de quem escolheu o Experience (mdProvisional). */
function gxhAuth() {
  if (gxhAuthReal()) return true;
  try { return gxhUnsure() && typeof mdProvisional === 'function' && mdProvisional(mdStored(), Date.now()); } catch (e) { return false; }
}
function gxhAuthReal() {
  try {   /* antes de o licenciamento carregar (abertura do app) as constantes dele ainda não existem: não trava nada */
    if (typeof LK === 'undefined' || typeof licPremiumNow !== 'function') return true;   /* sem licenciamento (testes isolados): sem trava */
    const now = Date.now(); if (now - gxhPT.t < 1000) return gxhPT.v;
    const v = !LK.cfg ? !!LK.dev : (LK.loaded && licPremiumNow());
    gxhPT = { t: now, v }; return v;
  } catch (e) { return true; }
}
function gxhPers() {
  try { return gxhAuth() && (typeof mdChosen === 'function' ? mdChosen() : 'experience') === 'experience'; } catch (e) { return false; }
}
function gxhLocked(f) { return !GXH_FREE.includes(f) && !gxhPers(); }
/* Há personalização guardada que não está sendo aplicada agora? (para explicar ao usuário; nunca para apagar) */
const gxhStatusKey = () => { try { return typeof licStatus === 'function' ? licStatus() : 'x'; } catch (e) { return 'x'; } };
function gxhSavedHidden() {
  if (gxhPers()) return false;
  return typeof mdHasSaved === 'function' ? mdHasSaved() : false;
}
function gxhLockWhy() {
  if (gxhAuth()) return 'Você está no Modo Padrão. Este recurso faz parte do Modo Experience.';
  const st = gxhStatusKey();
  return st === 'trial_expired' ? 'Seu teste do Premium terminou.' : st === 'refunded' || st === 'revoked' ? 'A licença Premium não está ativa.' : 'A GLUXO Experience faz parte do Premium.';
}
/* Aviso único quando o Premium deixou de valer e o app voltou ao Modo Padrão (some em "Entendi"). */
function gxhLockNote() { return typeof mdLostNote === 'function' ? mdLostNote() : ''; }
/* Explicação curta, sem erro de permissão: leva ao Premium (sem autorização) ou ao seletor de modo (Premium no Modo Padrão). */
function gxhLockSheet() {
  const auth = gxhAuth();
  openSheet(`<h2>${auth ? 'Disponível no Modo Experience' : 'Personalização é Premium'}</h2><p>${esc(gxhLockWhy())} A tela inicial padrão do GLUXO continua completa e gratuita, com Resumo glicêmico no topo e Central de Métricas no final.</p>${gxhSavedHidden() ? '<p>Suas personalizações anteriores estão guardadas e voltam quando o Modo Experience estiver ativo.</p>' : ''}<div class="stack" style="gap:8px">${auth ? '<button type="button" class="btn pri full" data-act="go" data-r="aparencia">Abrir Modo de interface</button>' : (typeof VIEWS !== 'undefined' && VIEWS.licenca ? '<button type="button" class="btn pri full" data-act="go" data-r="licenca">Conhecer o Premium</button>' : '')}<button type="button" class="btn full" data-act="close">Agora não</button></div>`);
}
