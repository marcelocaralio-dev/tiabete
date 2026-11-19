# 0.16.0 — Glicosímetros redesenhados (PROMPT 24)
- `src/charts.js`: `gaugeSvg(valor, animar, rótulo, 'ult'|'dia')` agora desenha um mostrador circular de 270°.
  - 'ult' (glicemia mais recente): escala 30–600; faixas 30–69, 70–180, 181–250, 251–400, 401–600; acima de 600 mostra **HI** (nunca "600").
  - 'dia' (média do dia): escala visual 70–500. O número exibido é sempre o valor calculado, sem alteração.
- `src/gauge.css` (novo): tamanhos ×1,10 (190→209, 124→136, 210→231, 460→506), animações e movimento reduzido. Para voltar ao visual antigo, tire-o de `scripts/build-web.js`.
- Cores: apenas tokens do tema (--good-fill, --red-l, --red-t, --red, --fg, --mut, --s2, --line).
- Dados, cálculos, formulas e armazenamento não foram tocados. Selo "HI" só no cartão da glicemia mais recente.

## Alinhamento dos dois cards da tela inicial
- `src/gauge.css`: Glicemia mais recente e Média do dia agora compartilham as mesmas linhas da grade (título, mostrador, selo e legenda, via subgrade). Cada linha tem a altura da maior das duas, então os mostradores e as informações ficam no mesmo nível, mesmo quando um título ou legenda ocupa mais linhas (ex.: título em 3 linhas em tela estreita, que antes empurrava um mostrador 13 px mais para baixo).
- Título, selo e legenda passam a alinhar pelo topo; sem medições no dia, o traço e a legenda ocupam as mesmas linhas do outro card.
- Sem suporte a subgrade, valem as alturas mínimas anteriores. Só CSS: cálculos, dados e textos não foram alterados.
