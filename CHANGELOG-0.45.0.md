# Resumo glicêmico do dia (recolhido/expandido) e filtro de período independente

Escopo único: o card **Resumo glicêmico** da tela Início e o reposicionamento do seletor 7 · 30 · 90 dias. Nenhuma outra tela, cartão ou cálculo foi alterado.

## Resumo glicêmico (só o dia atual)
- Trabalha exclusivamente com as medições **reais** da data local de hoje (`inToday`, em `src/inicio-core.js`); não depende do período 7/30/90 nem do dia escolhido na "Evolução do dia". A virada do dia é acompanhada (verificação a cada 30 s; "há X min" também se atualiza sozinho).
- **Recolhido:** título + "Hoje · dd/mm" + seta; **Última glicemia registrada** em destaque (valor, mg/dL, selo de classificação pelas faixas configuradas, horário, tempo decorrido e contexto); barra horizontal de faixas; **Média do dia** e **Registros do dia** em indicadores compactos.
- **Expandido** (toque em qualquer ponto do cartão, ou no título; sem navegar): mantém tudo do recolhido, sem duplicar a barra, e acrescenta Menor, Maior, Na faixa e Fora da faixa, e a lista de **todos** os registros de hoje (mais recente primeiro) com horário, valor, classificação e contexto, usando o componente de lista `.rec` do Histórico. Tocar num registro abre os detalhes dele. "Recolher" no fim da lista.
- Animação no padrão do app (`grid-template-rows` + `--ds-t-slow`/`--ds-ease`, seta `.ds-chev`), sem animação com `prefers-reduced-motion`; o conteúdo recolhido fica `inert` (fora do foco e da leitura de tela). O estado aberto/fechado é mantido quando a tela é redesenhada (nova medição, edição, exclusão).
- **Barra de faixa preservada** (mesma lógica `GZ`/`GZ_ZONES`/`gzFrac`): segmentos coloridos, marcações 70 · 180 · 250 · 400, marcador circular na **última** glicemia (nunca na média). Sem medição hoje: barra neutra e sem marcador.
- **Dia sem medições:** "Nenhuma medição hoje", média "—", 0 registros, sem estatísticas inventadas e sem expansão. **Uma medição:** média, menor e maior iguais ao valor.
- Saíram do card (continuam no app): filtro, média de 7 dias, tendência, variabilidade, % na faixa do período, comparações e texto automático.

## Período de análise (componente independente)
- Nova seção `.in-pc`, **fora** do cartão e logo abaixo dele (o aviso "Sem medições há N dias", quando existe, fica entre os dois): rótulo, intervalo de datas e o seletor 7 · 30 · 90 dias (mesmos `data-act="period"`, `S.period` e persistência), com os indicadores prioritários e o texto do período que sempre dependeram dele. O texto do período deixou de repetir "Última medição…" (`inSummary(m, {noLast:true})`), já mostrada no cartão.
- O filtro continua alimentando Evolução da glicemia, Média no período, Comparação, Variabilidade, Distribuição, Central de Métricas etc.; escolher outro período não altera o Resumo glicêmico nem o recolhe/expande.

## Arquivos
`src/inicio.js`, `src/inicio-core.js` (`inToday`, opção em `inSummary`), `src/inicio.css`, `src/painel2.js` (ordem: Resumo → aviso → Período), `tests/test22.js` e `tests/test27.js` (ajustados à nova estrutura; `test27` passou a remover o portão de login como os demais testes), `tests/test50.js` (novo, 62 verificações: lógica do dia, recolhido/expandido/vazio, filtro 7/30/90, inclusão/edição/exclusão, 320–768 px) e `package.json` (script `test`).
