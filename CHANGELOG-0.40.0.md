# 0.40.0 · Cabeçalho diário do Histórico

Mudança só de apresentação, restrita ao cabeçalho de cada dia da tela Histórico (`src/app.js` → `histListHTML`, `src/cards.css`).

- **Data** em destaque: "Domingo, 22/11/2026" (dia da semana por extenso, 17 px, negrito) com um filete vermelho à esquerda.
- **Média glicêmica**: indicador próprio em vermelho do app (valor em destaque + "mg/dL · média").
- **Medições** e **aplicações** (registros de insulina, não doses nem unidades) em indicadores secundários; refeições, que já eram exibidas, continuam como indicador.
- Os indicadores quebram de linha em telas estreitas (testado em 320 e 412 px), sem cortes, nos temas escuro e claro. A barra por faixa do dia foi mantida.
- Indicador sem dado não aparece (sem média quando não há medição, sem aplicações quando não há registro): nenhum valor fictício.
- Os números vêm dos mesmos cálculos de antes (`stats`, contagens do dia). Filtros, ordenação, agrupamento, navegação e o resto da tela não foram alterados.

Teste: `tests/test41.js` (18 verificações, compara cada cabeçalho com os dados reais). Arquivos: `src/app.js`, `src/cards.css`, `tests/test41.js`, `package.json`, este arquivo.
