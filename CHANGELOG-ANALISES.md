# Aba Análise: legibilidade, rolagem horizontal e legendas

Só apresentação foi alterada. Cálculos, estatísticas, dados, registros, filtros de período e demais controles ficaram como estavam.

## Rolagem horizontal (só onde falta espaço)
- Média por semana/mês (Evolução), Média por faixa horária e Dia típico agora são desenhados em largura própria, com textos em tamanho normal (nada foi reduzido para caber). Se o cartão for mais estreito, o gráfico rola para os lados; se couber, não rola.
- O eixo de valores (mg/dL) fica fixo à esquerda durante a rolagem.
- Aviso "Deslize para os lados" aparece só quando há rolagem. Mapa de calor e tabelas largas também rolam, com a primeira coluna fixa.
- Funciona por toque, mouse (barra de rolagem) e teclado (as áreas aceitam foco e setas). A navegação por gestos entre páginas não interfere.

## Legendas
- Cada gráfico tem o quadro "Como ler este gráfico": n (quantidade de medições), média, desvio-padrão, mediana, faixas 25–75% e 10–90%, limites 70 e 180, símbolos ▼▼ ▼ ● ▲ ▲▲, traço (—) e ponto (·), unidade (mg/dL), semana (começa na segunda) e blocos de 4 horas.
- Siglas e abreviações trocadas por palavras completas: "Min–máx" → "Menor–maior", "n" → "Nº de medições", "<70" → "Abaixo de 70", "Acima" → "Acima da faixa", "insuf." → "insuficiente", "TIR" explicado.
- Distribuição por faixa mostra o nome da faixa (Muito baixa, Baixa…) e o intervalo em mg/dL.
- Tabelas de comparação e variação por refeição ganharam explicação de "A − B", "Variação (%)" e do sinal + / −.

## Arquivos alterados
`src/charts.js`, `src/app.js` (somente a view da Análise), `src/extras.js` (mapa de calor e tabela de variação por refeição: textos e envoltório), `src/style.css` (bloco novo no final).
