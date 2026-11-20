# Padronização do sistema visual (Design System)

Atualização **somente visual**. Nenhum cálculo, regra, dado, permissão ou navegação foi alterado.

## Arquivos novos
- `src/ds.css` — tokens (`--ds-*`), tons semânticos (`data-tone="pos|neg|warn|neu|brand"`) e a família de componentes; carregado por último no build.
- `src/ds.js` — `window.TBDS` (kpi, delta, spark, cmp, xcard, note, badge, empty, skel, prog, flash) e interações delegadas (expandir/recolher, destaque de valor que muda).

## Arquivos alterados
- `scripts/build-web.js` — inclui `ds.css` e `ds.js`.
- `src/app.js` — card de comparação entre períodos (`dsCmpMean`) acima da tabela existente.
- `src/extras.js` — botão de cópia no Drive com `aria-busy` (mostra giro enquanto trabalha).

## O que a camada faz nos módulos existentes (sem mexer no HTML deles)
- Cabeçalhos `h2.sec` com marcador vermelho; cards com filete de luz e elevação unificados.
- Barra lateral neon de categoria em `.rec` (histórico), `.pn-c` (início), `.tile.alert` e `.banner`.
- Botão primário com o degradê do CTA Premium; seletores segmentados, campos (foco/erro), barras de progresso animadas.
- Estados vazios com ícone, esqueletos/spinners, toasts e banners com entrada suave, `<details>` com revelação animada.
- Todas as animações desligam com `prefers-reduced-motion`. Paleta preservada; tema claro só redefine tokens.

## Validação
`npm test` (23 suítes) sem falhas; conferência visual nos temas escuro e claro e galeria dos componentes novos.
