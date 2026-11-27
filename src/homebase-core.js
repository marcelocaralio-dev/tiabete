/* ================= Base universal da página inicial: lógica pura (sem DOM, sem armazenamento, sem licença) =================
   Separa TRÊS coisas que nunca são tratadas como uma só configuração:
     1) ESTRUTURA padrão do app: IN_DEF() (Resumo glicêmico no topo, cards gratuitos, Central de Métricas no final). Igual para todos.
     2) PREFERÊNCIAS pessoais de organização: o que foi salvo ('tb-inicio' e 'tb-gx'). Nunca são apagadas por mudança de plano.
     3) AUTORIZAÇÃO Premium: decidida só pelo licenciamento oficial (license.js). Aqui ela chega como um booleano `allowed`.
   Regra: a estrutura exibida = base universal quando não há autorização; base + preferências quando há. Quem trabalha no primeiro acesso,
   em avaliação, ativo ou expirado parte SEMPRE da mesma base. O que muda é só se as preferências são aplicadas.
   Preparação para os modos Padrão e Experience (etapa futura, SEM seletor): os dois partem desta mesma base; o modo "standard" nunca aplica
   preferências e o modo "experience" aplica quando autorizado. Nenhuma segunda página inicial é criada. */
const HBC = (typeof module !== 'undefined' && typeof require === 'function') ? require('./inicio-core.js') : { IN_DEF, inCleanPrefs, inIsDefault, IN_FIXED, IN_CARDS };
const HB_MODES = ['standard', 'experience'];
/* Classificação comercial dos componentes da tela inicial. Resumo e Central de Métricas são estruturais (sempre presentes, em posição fixa);
   os cards do catálogo são gratuitos e opcionais: o Premium só dá permissão para reorganizá-los e ocultá-los. */
const HB_CLASS = { structural: 'estrutural', free: 'gratuito', premium: 'premium' };
function hbClassOf(k) { if (HBC.IN_FIXED.some(f => f.k === k)) return 'structural'; return HBC.IN_CARDS.some(c => c.k === k) ? 'free' : null; }
/* Base universal: cópia nova a cada chamada (ninguém altera a original). */
const hbBase = () => HBC.IN_DEF();
/* Layout efetivo. stored = preferências guardadas (qualquer formato; é limpo), allowed = autorização Premium, mode = 'experience' (padrão) ou 'standard'. */
function hbLayout(stored, allowed, mode) {
  const m = HB_MODES.includes(mode) ? mode : 'experience';
  return allowed && m === 'experience' ? HBC.inCleanPrefs(stored) : hbBase();
}
/* Há personalização guardada que está sendo ignorada por falta de autorização? (para explicar ao usuário; nunca para apagar) */
const hbHasSaved = stored => !!stored && !HBC.inIsDefault(stored);
/* A estrutura é válida? Resumo e Central de Métricas nunca entram na lista personalizável; não há cards duplicados nem desconhecidos. */
function hbValid(p) {
  const q = HBC.inCleanPrefs(p), keys = HBC.IN_CARDS.map(c => c.k);
  return q.order.length === keys.length && new Set(q.order).size === keys.length && keys.every(k => q.order.includes(k)) && !HBC.IN_FIXED.some(f => q.order.includes(f.k) || q.hidden.includes(f.k));
}
if (typeof module !== 'undefined') module.exports = { HB_MODES, HB_CLASS, hbClassOf, hbBase, hbLayout, hbHasSaved, hbValid };
