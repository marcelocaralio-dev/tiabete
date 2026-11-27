/* ================= Modos de interface (Padrão × Experience): lógica pura, sem DOM, sem armazenamento, sem licença =================
   Três coisas ficam SEPARADAS e nunca viram uma configuração só:
     1) MODO ESCOLHIDO  → guardado em 'tb-modo' ({ v, mode, lost }). Só diz o que a pessoa quer ver.
     2) AUTORIZAÇÃO     → decidida só pelo licenciamento oficial (license.js). Aqui chega como `auth` (true | false).
     3) PREFERÊNCIAS    → 'tb-gx' e 'tb-inicio' (organização, favoritos, fixados, layouts). NUNCA são tocadas pelo modo.
   Modo EFETIVO = 'experience' somente se escolhido E autorizado. Qualquer outro caso é 'standard'.
   Classificação CENTRAL: todo recurso do catálogo (GX_F) e todo componente da tela inicial é classificado AQUI, uma vez.
   Recurso novo = uma linha em MD_SHARED ou em MD_ADDON (ou nenhuma, se for só personalização). */

const MD_VER = 1;
const MD_MODES = ['standard', 'experience'];
const MD_LABEL = { standard: 'Modo Padrão', experience: 'Modo Experience' };
const MD_CLASS = { shared: 'compartilhado', free: 'gratuito', experience: 'experience' };

/* ---------- classificação dos recursos do catálogo da GLUXO Experience (chaves de GX_F) ---------- */
/* COMPARTILHADOS: valem nos dois modos e nunca travam. Etapa 01 (alertas, lembretes, bolha, badges, som e vibração da hipoglicemia):
   já eram gratuitos antes dos modos, e alertas clínicos não podem depender de plano nem de modo. */
const MD_SHARED = ['bubble', 'list', 'badge', 'sound', 'c_glic', 'c_lem', 'c_reg', 'c_met', 'c_app'];
/* ELEMENTOS ADICIONAIS do Experience (Etapas 02 e 03): quando o Experience não está ativo ficam DESLIGADOS (não só sem personalização).
   Atalhos circulares, pesquisa global, puxar para atualizar, menus contextuais e indicadores de progresso.
   Fora desta lista de propósito: gestos (nav_gest). Deslizar entre abas já tem opção gratuita própria em Aparência (drawer.js) e os outros
   gestos são padrão de fábrica; desligá-los deixaria essa opção sem efeito. Só a personalização deles é do Experience. */
const MD_ADDON = ['nav_sc', 'nav_search', 'nav_ptr', 'nav_menu', 'vis_prog'];
/* Todo o resto do catálogo é PERSONALIZAÇÃO exclusiva do Experience: no modo Padrão vale o padrão de fábrica do app
   (movimento, avisos e seções da Análise como sempre foram), sem opções para ajustar e sem apagar o que foi guardado. */
const mdFeatureClass = f => MD_SHARED.includes(f) ? 'shared' : 'experience';
const mdAddon = f => MD_ADDON.includes(f);
/* A chave geral da inteligência contextual também fica desligada fora do Experience (Etapa 05 é Premium por inteiro). */
const mdForcedOff = (f, k) => (f === 'ctx_all' && k === 'on') || mdAddon(f);

/* ---------- classificação dos componentes da tela inicial ---------- */
/* class: 'shared' (estrutural: igual nos dois modos), 'free' (cards do catálogo gratuito), 'experience' (só no Modo Experience).
   gate: recurso do catálogo que controla o componente (a decisão real continua em gxhLocked/gxGet, uma só). */
const MD_HOME = [
  { k: 'resumo', t: 'Resumo glicêmico', class: 'shared', fixed: 'top' },
  { k: 'cards', t: 'Cards do catálogo gratuito', class: 'free' },
  { k: 'metricas', t: 'Central de Métricas', class: 'shared', fixed: 'bottom' },
  { k: 'editar', t: 'Reorganizar, ocultar e redimensionar cards', class: 'experience', gate: 'org_home' },
  { k: 'fixados', t: 'Seção Fixados', class: 'experience', gate: 'org_pin' },
  { k: 'favoritos', t: 'Seção Favoritos', class: 'experience', gate: 'org_fav' },
  { k: 'atalhos', t: 'Atalhos circulares', class: 'experience', gate: 'nav_sc' },
  { k: 'pesquisa', t: 'Pesquisa global', class: 'experience', gate: 'nav_search' },
  { k: 'assistencia', t: 'Assistência contextual', class: 'experience', gate: 'ctx_ast' },
  { k: 'progresso', t: 'Indicadores de progresso', class: 'experience', gate: 'vis_prog' }
];
const mdHomeClass = k => { const c = MD_HOME.find(x => x.k === k); return c ? c.class : null; };
const mdHomeShown = (k, effective) => { const c = mdHomeClass(k); return c === 'shared' || c === 'free' || (c === 'experience' && effective === 'experience'); };

/* ---------- estado guardado ---------- */
/* Limpa qualquer valor vindo do armazenamento. mode:null = nunca escolhido. */
function mdClean(v) {
  const o = { v: MD_VER, mode: null, lost: null, ok: 0 };
  if (v && typeof v === 'object') {
    if (MD_MODES.includes(v.mode)) o.mode = v.mode;
    if (Number.isFinite(v.ok) && v.ok > 0) o.ok = v.ok;   /* última vez em que o Premium foi CONFIRMADO (só para não desligar o Experience enquanto a licença é relida) */
    if (v.lost && typeof v.lost === 'object' && typeof v.lost.st === 'string') o.lost = { st: v.lost.st.slice(0, 40), at: Number.isFinite(v.lost.at) ? v.lost.at : 0, ack: v.lost.ack === true };
  }
  return o;
}
const mdParse = raw => { try { return mdClean(raw ? JSON.parse(raw) : null); } catch (e) { return mdClean(null); } };
/* Primeira abertura depois da atualização: o padrão é o Modo Padrão. Quem já tinha personalização guardada continua no Experience
   (hasSaved), para a atualização não esconder o que a pessoa já usava. */
function mdInitial(stored, hasSaved) { const o = mdClean(stored); if (!o.mode) o.mode = hasSaved ? 'experience' : 'standard'; return o; }

/* ---------- decisão ---------- */
const mdSelected = stored => mdClean(stored).mode || 'standard';
/* Experience só vale com escolha E autorização. auth precisa ser exatamente true (carregando, expirado, sem servidor: não vale). */
const mdEffective = (stored, auth) => mdSelected(stored) === 'experience' && auth === true ? 'experience' : 'standard';
const mdCanSelect = (mode, auth) => mode === 'standard' || (mode === 'experience' && auth === true);
/* Troca de modo pedida pela pessoa. Nunca mexe em preferências; o Experience sem autorização é recusado AQUI, não só na tela. */
function mdSelect(stored, mode, auth) {
  const o = mdClean(stored);
  if (!MD_MODES.includes(mode)) return { ok: false, reason: 'invalid', stored: o };
  if (!mdCanSelect(mode, auth)) return { ok: false, reason: 'premium', stored: o };
  o.mode = mode; o.lost = null;
  return { ok: true, stored: o };
}
/* Perda de autorização. `known` = o licenciamento já respondeu (enquanto carrega, não se conclui nada). Só muda o modo escolhido;
   preferências, favoritos, fixados e registros ficam como estão. */
function mdReconcile(stored, known, auth, status, now) {
  const o = mdClean(stored);
  if (known === true && auth === false && o.mode === 'experience') { o.mode = 'standard'; o.lost = { st: String(status || ''), at: now || Date.now(), ack: false }; return { changed: true, stored: o }; }
  return { changed: false, stored: o };
}
/* PERDA CONFIRMADA: só estas situações, lidas de um token assinado e já carregado, justificam sair do Experience e avisar:
   teste terminado, reembolso, revogação. Carregando, falha de leitura, sem resposta do servidor, tolerância offline vencida ou relógio fora do lugar
   NÃO são perda: o Experience escolhido é mantido e a licença é relida. */
const MD_LOSS = ['trial_expired', 'refunded', 'revoked'];
const mdLossConfirmed = (status, signedPayload, loaded, readErr) => loaded === true && !readErr && !!signedPayload && MD_LOSS.includes(status);
/* Enquanto a licença não responde (carregando ou leitura falhou), quem JÁ teve o Premium confirmado e escolheu o Experience continua nele (até 7 dias). */
const MD_GRACE_MS = 7 * 86400e3;
const mdProvisional = (stored, now) => { const o = mdClean(stored); return o.mode === 'experience' && o.ok > 0 && (now || Date.now()) - o.ok < MD_GRACE_MS; };
const mdStamp = (stored, now) => { const o = mdClean(stored); o.ok = now || Date.now(); return o; };
const mdAck = stored => { const o = mdClean(stored); if (o.lost) o.lost.ack = true; return o; };
/* O aviso da perda aparece uma vez (até a pessoa tocar em Entendi) e some quando o Experience volta a ser escolhido. */
const mdLostPending = stored => { const o = mdClean(stored); return !!(o.lost && !o.lost.ack); };

/* ---------- lista do que é exclusivo (para a tela de escolha): só o que existe no catálogo carregado ---------- */
function mdExclusive(cats, names) {
  const out = [];
  Object.keys(cats).forEach(c => { const fs = cats[c].fs.filter(f => mdFeatureClass(f) === 'experience' && names[f]); if (fs.length) out.push({ c, t: cats[c].t, items: fs.map(f => names[f]) }); });
  return out;
}
if (typeof module !== 'undefined') module.exports = { MD_VER, MD_MODES, MD_LABEL, MD_CLASS, MD_SHARED, MD_ADDON, MD_HOME, mdFeatureClass, mdAddon, mdForcedOff, mdHomeClass, mdHomeShown, mdClean, mdParse, mdInitial, mdSelected, mdEffective, mdCanSelect, mdSelect, mdReconcile, MD_LOSS, mdLossConfirmed, mdProvisional, mdStamp, mdAck, mdLostPending, mdExclusive };
