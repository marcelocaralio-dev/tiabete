# 0.28.0 — Reorganização e evolução dos cards (PROMPT 4)

Atualização **somente de apresentação**: dados, cálculos, ações e funcionalidades foram mantidos. Ajustes aprovados do APK (`K = 1.29`, `patch-android.js`) não foram tocados.

## Auditoria (antes de mexer)
- **Já bem resolvidos, mantidos como estavam:** Início (hero, indicadores, medidor, variabilidade), Análise (12 seções com barra neon, KPIs, anel, mapa de calor), Central de Métricas Premium, Bolus (hero com régua de Ui e tabela nutricional no formato definido pelo usuário), Lembretes e Relatórios.
- **Monótonos / mal aproveitados:** lista de Exames (card único repetido), detalhe do Exame (todos os itens numa caixa só), HbA1c (lista e avaliador longos), Tratamento (esquemas sem resumo nem comparação), Conquistas (parágrafo longo no topo, sem resumo), cabeçalho do dia no Histórico (texto puro), Histórico de alertas e Alertas personalizados (sem identificação por estado).

## Biblioteca nova — `src/cards.js` (`TBCards`) e `src/cards.css`
A indicador principal · B compacto (+ grade) · C categorizado · D comparativo · E evolução · F gráfico/faixa · G expansível (`<details>` nativo) · H cronológico · I alerta · J resumo; auxiliares `range`, `seg`, `prog`, `ring`, `tag`. Textos escapados; só tons semânticos existentes (`pos|neg|warn|neu|brand`).

## Barras laterais padronizadas
3 px, raio 0 3 3 0, recuo vertical 14 px, conteúdo a 18 px; contêineres de seção 4 px (tokens `--gx-bar-*`). Cores semânticas por estado/gravidade, brilho reduzido no tema claro. Uniformizadas: `.an-card` (era 4 px) e as conquistas próprias (era borda de 4 px).

## Aplicação por módulo
- **Exames (lista):** C + anel E com a nota + barra dentro/fora/sem faixa; barra lateral pela faixa da nota. A ação de abrir continua no botão.
- **Exame (detalhe):** resumo J (itens, dentro, fora, sem faixa), cada item vira card F com a posição do valor na faixa de referência e barra pelo estado; "Pontos para conversar com o médico" em alerta I; "Dentro da referência" e "Sem faixa" recolhíveis (G).
- **HbA1c:** comparativo D (último × anterior), lista cronológica C com variação em pontos percentuais, avaliador de meta recolhível (G, campo preservado), estimativa em A.
- **Tratamento:** esquemas em C (barra: em uso/encerrado, medições e média do período), comparativo D entre os dois esquemas mais recentes; a tabela completa foi mantida.
- **Conquistas:** resumo J (conquistadas, ativas, minhas) com progresso; regras e avisos num G recolhível (texto integral mantido).
- **Histórico:** cabeçalho do dia com barra por faixa (baixas/na faixa/elevadas).
- **Alertas:** histórico com barra por prioridade; alertas personalizados com barra ativo/desligado.

## Testes
`tests/test29.js` (56 verificações): modelos A–J, escape e tons, ações preservadas, sem rolagem horizontal em 320 px, temas escuro/claro, barra de 3 px, ajustes aprovados do APK intactos. As 25 suítes anteriores continuam passando.
