# Relatório de alterações — GLUXO 0.32.0

## Adicionados
- `src/brand.css` — tokens institucionais (paleta, papéis por tema, bordas, gradientes, sombras, foco, desabilitado, movimento, aliases clínicos).
- `src/brand-ui.css` — aplicação: logotipo/placa, botão principal e FAB com gradiente institucional, estado desabilitado, animações da marca, preservação do vermelho clínico nos ícones de alerta.
- `src/brand-assets.js` — logotipo oficial e gota embutidos (data URI gerado no build).
- `assets/brand/*` — original intacto e versões de aplicação (fundo transparente, completo, compacto, gota, reduções web).
- `scripts/gluxo-repoint.py` — registro idempotente das 144 linhas migradas de `--red*` para `--brand*`.
- `tests/test33.js`, `tests/browser/identidade-compara.py`, `docs/*GLUXO*.md`, `CHANGELOG-0.32.0.md`.

## Modificados
| Arquivo | Alteração | Componentes afetados |
|---|---|---|
| `src/head.html` | topo: logotipo oficial no lugar do desenho antigo; título GLUXO | cabeçalho |
| `src/app.js` | Sobre: logotipo oficial | tela Sobre |
| `native/login.js` | abertura com logotipo e animação “fluxo”; gota oficial na entrada; cor `--brand` | splash, tela de entrada (só visual) |
| `native/ai-ui.js` | cores de assistente de IA → `--brand*` (7 linhas) | assistente |
| `src/extras.js` | avatar padrão → `--brand*` (1 linha) | avatar |
| `src/style.css`, `ds.css`, `buttons.css`, `cards.css`, `inicio.css`, `analise.css`, `bolus2.css`, `acchat.css`, `uipicker.css`, `premium.css`, `ptr.css`, `readmore.css`, `metricas.css`, `layout.css`, `neon.css` | vermelhos institucionais → tokens `--brand*` | botões, seleção, foco, campos, navegação, cartões em destaque, progresso, tooltips |
| `scripts/build-web.js` | inclui `brand.css`, `brand-ui.css`, `brand-assets.js` e embute o logotipo | build |
| `scripts/build-pwa.js` | nome/short_name GLUXO, título iOS | instalação PWA |
| `capacitor.config.json` | `appName` GLUXO; cor de notificação `#E50308` | Android |
| `assets/icon-*.png`, `assets/pwa/*`, `assets/notification/*` | ícones com a gota oficial (app, adaptativo, PWA, maskable, notificações 24–96 px) | instalação, notificações |
| `tests/test6.js` | cor esperada da notificação `#E50308` (mudança intencional) | teste |

## Não modificados (verificado por `diff`)
`logic.js`, armazenamento, licenciamento/premium (`premium.js`), autenticação, sincronização, exportação, cálculos, HbA1c, `patch-android.js`, limites e classificações glicêmicas. O texto “TiaBete” **dentro de frases** (≈150 ocorrências, notificações, backup) foi mantido por regra de preservação de textos; decidir a troca para GLUXO em etapa própria. Ícones SVG antigos `assets/tiabete-*.svg` foram mantidos (arquivos de referência antigos, sem uso na interface).

## Pendências declaradas
- Avatar do centro de alertas (`alertcenter.js`) mantém o desenho/gradiente antigo (ícone funcional de alertas).
- Não foi gerado APK nem testado em aparelho (sem Android SDK no ambiente).
- Fontes (Unbounded, Manrope) não estavam em `node_modules`; capturas usam fontes de sistema.
