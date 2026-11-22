# 0.31.0 — Análise glicêmica por horários e períodos do dia (PROMPT 1)

Nova seção **“Horários e períodos do dia”** (atalho **Períodos**) na aba Análise. Nada foi removido nem alterado: cálculos, gráficos, filtros e dados das 12 seções anteriores seguem iguais. Ajustes aprovados do APK (`K = 1.29`, `patch-android.js`) não foram tocados.

## Auditoria (antes de implementar)
- Registros: `date`/`time` (hora local digitada), `ts` (data+hora local), `context` (jejum, antes, depois, deitar, madrugada, outro), `meal` (café, almoço, jantar, lanche), `noTime` para medições sem horário.
- Já existiam: faixas de 4 h (`TIME_BLOCKS`), `stats`, `bandOf`, `bandCounts`, `hypoEpisodes`, `typicalDay`, janelas e período anterior (`anWindows`), cartões por contexto (`anSlots`) e mapa de calor de médias. Foram **reutilizados** (mesmos limites: 54/70/180/250 e 130 em jejum); nenhum cálculo duplicado.
- Limitação dos dados: o horário vem do que a pessoa informou; medições sem horário não entram em faixas de horário (são contadas à parte). Não existe “horário da refeição”, só o contexto marcado.

## O que a seção traz
- **Dois agrupamentos independentes**: *Contexto registrado* (Jejum, Pós-café, Pré-almoço, Pós-almoço, Pré-jantar, Pós-jantar, Antes de dormir, Madrugada, Outros) e *Faixa de horário* (2, 3, 4 ou 6 h, ou **cortes personalizados**, ex.: `5, 11, 17, 22`). A hora **nunca** define o contexto: uma medição sem contexto às 15 h não vira “pós-prandial”. O cartão de cada contexto mostra a hora real das medições (mediana e faixa central) e o de cada faixa mostra quais contextos foram marcados nela.
- **Indicadores por período**: média, mediana, menor, maior, nº de medições, nº de dias, desvio-padrão, coeficiente de variação, distribuição pelas 5 faixas, frequência de baixas e de elevadas. Média só com 3+ medições; DP e CV só com 5+.
- **Destaques** (mais baixas, mais elevadas, maior variabilidade, melhor resultado, mais registros, maior mudança na média): exigem 5+ medições, 2+ dias e mais de uma ocorrência. Cada destaque traz as evidências e abre os registros.
- **Visualizações**: cartões expansíveis com barra lateral colorida; distribuição por faixa; colunas comparativas das médias; barras de menor–maior; variabilidade com marca de 36 %; **mapa de calor dia da semana × faixa de horário** (categoria à escolha: elevadas, na faixa, baixas ou quantidade; cada quadro é independente, sem sugerir continuidade); linha de evolução (pontos = medições, linha = média semanal só onde há 3+ medições, sem atravessar semanas vazias); comparação entre dois períodos do dia.
- **Filtros**: da tela, 7, 14, 30, 90 e 180 dias (6 meses), intervalo personalizado; seleção de contextos/faixas. Escolhas ficam salvas no aparelho.
- **Comparação temporal**: média anterior × atual, diferença absoluta, variação percentual (só com 5+ medições nos dois períodos), mudança em baixas, elevadas e nº de medições — descrita sem dizer “melhorou/piorou”.
- **Dados insuficientes**: avisos de poucas medições, poucos dias, registros concentrados em um dia, períodos sem registro, grande diferença de quantidade entre períodos ou entre os intervalos comparados, e medições sem horário. Períodos vazios ficam vazios.
- **Integração**: tocar em um cartão, destaque ou quadro do mapa lista os registros que compõem o número (20 por vez, com “Mostrar mais”); tocar no registro abre a medição; contextos têm “Ver no histórico”.

## Cuidados técnicos
Dados originais intocados; datas e horas pelo relógio local; cada medição em um só grupo; sem interpolação; proporção de medições nunca é chamada de tempo na faixa; passada única sobre os registros (50 mil registros em menos de 2,5 s no teste).

## Arquivos
`src/analise-core.js` (cálculo puro, `anT*`), `src/analise.js` (seção, controles e eventos), `src/analise.css` (estilos nos dois temas, cor própria `--an13`), `tests/test32.js`, `tests/browser/horarios.py`, `tests/test28.js` (agora conta 13 seções), `package.json`, `package-lock.json`.

## Testes
`tests/test32.js` (69 verificações, lógica pura): cálculos comparados com laços independentes (n, dias, média, mediana, DP, CV, mín., máx., baixas, elevadas, faixa), limites 03:59/04:00/23:59, cortes inválidos, fusos (São Paulo, UTC, Auckland), período anterior, amostra mínima, ausência de dados, mapa de calor, evolução sem preencher semanas vazias, registros não alterados e desempenho.
`tests/browser/horarios.py` (74 verificações, `python3`): fluxo completo na interface, contagens conferidas com cálculo independente, 320 a 1024 px sem rolagem horizontal, contraste AA do mapa de calor nos dois temas, poucos dados e ausência de dados. As 28 suítes anteriores continuam passando (`test28` ajustado de 12 para 13 seções).
