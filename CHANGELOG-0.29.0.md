# 0.29.0 — Aproveitamento horizontal da interface (PROMPT 5)

Atualização **somente de apresentação**: dados, cálculos, doses, ações e funcionalidades foram mantidos. Ajustes aprovados do APK (`K = 1.29`, `patch-android.js`) não foram tocados.

## Auditoria
- Com a escala do APK, um celular de 412 px tem ~484 px de layout, mas os pontos de quebra usavam a largura da janela e disparavam tarde. Agora usam a **largura real do conteúdo** (`#view`, consulta de contêiner).
- Aba Alimentos: ~31 mil px de altura (63 alimentos, ~470 px por card).
- Avisos empilhados, listas de uma coluna (Histórico, Mais, Configurações, Tratamento) e blocos de Exames empilhados no Início.
- Já bem resolvidos e mantidos: hero do Início, Análise (KPIs em grade), Central de Métricas.

## Mudanças (`src/layout.css`, novo)
- **Avisos** agrupados em `.banners`: 2 colunas a partir de 640 px; alertas de hipo/hiperglicemia e o último ímpar ocupam a linha toda.
- **Alimentos:** categorias recolhíveis (Favoritos, Cereais, Pães, Frutas, Laticínios etc.), contagem por grupo, expandir/recolher todos, estado lembrado; busca e filtros abrem os grupos com resultado. Card compacto com **todos** os valores nutricionais (líquidos, totais, fibras, proteínas, gorduras, kcal, porção), chips de refeição em uma linha e edição recolhível. 2 colunas ≥ 600 px, 3 ≥ 860 px. Favoritar move o alimento para o grupo Favoritos.
- **Refeições salvas:** grade compacta, 6 visíveis e "Ver todas (n)"; botão "Abrir Minha razão" na mesma linha do texto.
- **Refeição:** frequentes em 3/4 colunas, resultados de busca em 2/3, itens em 2 colunas, campos nutricionais em 5 colunas (≥ 600 px).
- **Histórico:** medições do dia em 2 colunas (≥ 600 px) e 3 (≥ 900 px); cabeçalhos do dia e episódios em linha inteira.
- **Início:** Exames em duas colunas (≥ 440 px); grade de cards no layout largo a partir de 600 px.
- **Mais/Configurações, Tratamento, filtros e formulários:** menus e esquemas em grade, filtros e `form-grid` com mais colunas quando há espaço. Campos de leitura sequencial não foram agrupados.

## Testes
`tests/test30.js` (130 verificações): sem rolagem horizontal em 320/360/412/600/800/1024 px nas telas principais e abas do bolus, todos os alimentos preservados, grupos, busca e valores nutricionais. As 26 suítes anteriores continuam passando.
