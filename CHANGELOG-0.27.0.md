# 0.27.0 — Análise reformulada (PROMPT 3)

## Auditoria (antes de mexer)
- Antes: `viewAnalise` (app.js) com 11 blocos em sequência: resumo, evolução (semana/mês), distribuição por faixa, perfil do dia (dia típico + blocos de 4 h), mapa de calor, contextos, refeições (tabela + variação), janelas fixas 7/30/90/180 e comparação de dois períodos.
- Filtros: intervalo (Tudo/30/90/180 d), agrupamento (semana/mês), datas A/B. Fontes: `S.records`, `S.events`, `est90()`.
- Todos os cálculos existentes foram **mantidos** (stats, bandCounts, byTimeBlock, typicalDay, heatmap, mealDeltas, statsBlock, tendência) e agora aparecem dentro das seções. Nada foi removido: a tabela completa da comparação, a tabela de todas as semanas/meses e as janelas fixas continuam.
- A Análise continua sendo recurso premium (portão de licença inalterado).

## Estrutura nova (12 seções recolhíveis + índice)
Visão geral · Central de descobertas · Controle glicêmico · Hipoglicemias · Hiperglicemias · Variabilidade · Por horário · Por refeição · Comparação · Padrões recorrentes · Associações · Evolução histórica.
- Cada seção tem cor própria (barra neon lateral), resumo visível mesmo recolhida, e só é desenhada quando aberta (desempenho). Padrão: Visão geral e Descobertas abertas. Estado salvo em `tb-ana-open`.
- Índice de navegação rápida (chips), "Expandir tudo / Recolher tudo", intervalo agora com 7/14/30/90/180 dias e Tudo.
- A Central de descobertas ficou logo após a Visão geral (maior valor para o usuário) em vez de na posição 8.

## Componentes visuais novos
Anel de distribuição por faixa, KPIs com barra lateral, delta vs. período anterior, barra de amplitude (mín–média–máx), medidor do CV, colunas por faixa horária/dia da semana, cartões por contexto (jejum, pós-café, pré/pós-almoço, pré/pós-jantar, antes de dormir, madrugada, outros) com média, mín., máx., n, % baixas/elevadas, DP e comparação, barras divergentes (variação depois − antes), dumbbell A×B, dispersão carboidrato×glicemia, marcos históricos.

## Cálculos e honestidade
- **Proporção de medições ≠ tempo na faixa**: toda faixa aparece como "proporção das medições" e a Visão geral traz a nota explicando que o tempo real só é medido por sensor contínuo.
- HbA1c aparece como **estimativa**, nunca como exame.
- CV (DP ÷ média) aparece na Visão geral e em Variabilidade, com a marca de 36% explicada como referência de sensores (indicativa em glicemia capilar). Dentro de uma tela já premium.
- Associações usam pares "medição → próxima medição dentro de uma janela" (carboidrato: 1–4 h; insulina: 1,5–5 h; atividade: 30 min–4 h), mínimo de 8 pares, sempre com n usado, universo e limitações; sem recomendação de dose.
- Padrões trazem ocorrências e universo; descobertas só aparecem com 20+ medições em 5+ dias e trazem período, n, evidências e registros relacionados (abrem o registro ou o Histórico filtrado).
- Comparação avisa sobre: amostra pequena, quantidades/durações diferentes, horários de medição diferentes, proporção de jejum diferente. "Melhor/pior" só onde há direção objetiva; média e contagens sem julgamento.
- Exemplos nunca entram nas conclusões quando há registros reais.

## Testes
`tests/test28.js` (66 verificações: consistência com logic.js, janelas, contextos, hipo/hiper, variabilidade, comparação, recorrência, associações, descobertas, histórico e, no navegador, seções, navegação, filtros, comparação pronta/manual, poucos/nenhum dado, temas, 320 px e desempenho com 900 dias). `tests/seed-analise.js` é o gerador de dados. `logic.js` exporta mais utilitários (somente `module.exports`).
