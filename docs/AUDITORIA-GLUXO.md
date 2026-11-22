# Relatório de auditoria (etapa 1) — identidade GLUXO

Base: código-fonte recebido (0.30.0 + a análise por horários 0.31.0 já entregue). O pedido cita a 0.21.1; a árvore em uso é a mais recente enviada.

## Arquivos que definem a identidade
- Tokens: `src/style.css` (`:root` escuro e `:root[data-theme="light"]`), `src/ds.css`, `src/neon.css`; temas aplicados por `data-theme` (script no topo de `head.html`, `extras.js applyTheme`).
- Componentes: `style.css`, `ds.css`, `buttons.css`, `cards.css`, `inicio.css`, `analise.css`, `bolus2.css`, `acchat.css`, `uipicker.css`, `premium.css`, `ptr.css`, `readmore.css`, `metricas.css`, `layout.css`, `gauge.css`, `glucoform.css`, `insrem.css`.
- CSS dentro de JS: `native/ai-ui.js`, `native/login.js` (splash e entrada); SVG em JS: `charts.js`, `exams.js`, `extras.js`, `alertcenter.js`.
- Logotipo: `head.html` (topo), `app.js` (Sobre), `native/login.js` (abertura e entrada), `alertcenter.js` (avatar do centro de alertas).
- Recursos: `assets/icon-*.png`, `assets/pwa/*`, `assets/notification/*`, `assets/*.svg` (marca antiga TiaBete), `capacitor.config.json`, `scripts/build-pwa.js`, `scripts/patch-android.js`.
- Cópias compiladas/embutidas: `www/index.html` e `pwa/` são **geradas** (`build-web.js`, `build-pwa.js`) e não entram no código-fonte; fontes vêm de `node_modules`/`www/fonts`.

## Inventário de vermelhos
Tokens: `--red` `#E31E2C`/`#D4162A`, `--red-l` `#FF8E98`/`#B3101F`, `--red-t` `#FF5361`/`#C4132A`, `--red-d*`, `--low-*`, `--ds-neg`, `#FF2E3E` (notificação e logotipo antigo), `#E0182B/#FF5A66` (avatar do alertas). Ocorrências: `var(--red)` 123 em CSS + 41 em JS; `--red-l` 75 + 21; `--red-t` 17 + 17; `--red-d` 15; `--red-d2` 9; `--red-rgb` 60.

## Classificação
| Classe | Onde | Decisão |
|---|---|---|
| Institucional | logotipo, FAB, botões primários, seleção (`.seg`, `.seg-b.on`), foco, campos, barras de seção, navegação ativa, cartões em destaque, abertura, notificação | migrado para `--brand*` (144 linhas, `scripts/gluxo-repoint.py`) |
| Decorativo | brilhos `.hero::after`, gradientes `.card.red`, `.ds-card.is-featured` | migrado (tons `--brand-d*`, glow) |
| Funcional | pressionado/hover/foco, progresso, spinner, contadores | migrado; erro/aviso mantidos |
| Clínico | selos de glicemia, `.hbar`, `.rec.g-*`, `.hero.b-*`, gauge, mapa de calor, gráficos, banners de hipo/hiper, alertas, doses de insulina, episódios | **inalterado** (`--red*`, `--ds-neg`) |
Exceções mantidas: avatar do centro de alertas (`alertcenter.js`, ícone funcional de alertas clínicos), ícones de alerta em cartões `.pn-c.alert/.st-bad` (regra explícita preserva o vermelho clínico), cartões de insulina/lembretes (`.ic-*`, `.ir-*`).

## Temas
Escuro e claro compartilham os mesmos tokens de marca com valores próprios por tema; o claro põe o logotipo em placa escura porque as letras do desenho são brancas.

## Android × web
Mesma interface; Android usa `capacitor.config.json` (nome, cor de notificação, fundo), adaptive icon (`icon-foreground/background`) e ícone de notificação por densidade. Web instalável: `build-pwa.js`.
