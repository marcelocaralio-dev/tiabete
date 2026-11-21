# 0.26.0 — Início como centro de acompanhamento (PROMPT 2)

## Auditoria (antes de mexer)
- Tela: `viewPainelCards` (src/painel2.js), com `banners()`, 13 cartões (`data-pm`) e janelas de detalhe; bloco da Central de Métricas ao final (`viewPainel`). Visual "Clássico" (app.js) intacto.
- Fontes: `S.records`, `S.hba`, `S.exams`, `S.events`, `S.plan/S.ir` (lembretes), `est90()`, `stats()`, `hypoEpisodes()`, `patternNotes()`.
- Duplicidades: "Glicemia mais recente" (cartão) repetia o que o painel de situação passa a mostrar → virou o próprio painel (mesma janela `data-pm="ult"`). Média/mín./máx./hipo/hiper continuam como cartões e também podem ser escolhidos como indicadores do painel. Nenhuma função ou atalho foi removido.

## Novo
- **Situação geral** (essencial): última glicemia com medidor e classificação, resumo em texto baseado nos registros, 1–4 indicadores prioritários (média, tendência 7×7 dias, variabilidade [DP e amplitude], % na faixa, hipoglicemias, acima da faixa, comparação, HbA1c estimada), seletor de período, aviso discreto quando não há medição recente.
- **Acontecimentos importantes**: hipoglicemias (7 dias), mudança relevante de média e de desvio-padrão, exame novo (14 dias), HbA1c nova (30 dias), recordes (maior glicemia; maior sequência na faixa), padrão recorrente. Cada um tem ícone/cor e abre o registro, a janela ou a tela relacionada. Sem acontecimento relevante, o card não aparece. Exemplos nunca geram acontecimento.
- **Atalhos contextuais** (máx. 3, nunca registram ou confirmam sozinhos): ver no histórico após registrar; acompanhar depois da refeição; ver resultados de exame novo; ir ao lembrete pendente / registrar medição pendente.
- **Evolução do dia**: barra sequencial por medição, gráfico 0–24 h com a faixa, linha do tempo com intervalos entre medições, contexto, eventos do dia. Só pontos reais; a linha não liga medições com mais de 6 h; medições sem horário ficam fora do gráfico e são contadas.
- Cartões novos: **Variabilidade** (barra de amplitude + janela de detalhes), **Exames e HbA1c de laboratório**; barras de progresso em Hipo/Hiper e comparação visual atual × anterior.
- **Personalização** ("Personalizar tela"): reordenar (↑/↓), ocultar, escolher indicadores, restaurar padrão. Salva em `tb-inicio` (com cópia durável no banco via persist.js). Situação geral, acontecimentos, atalhos, avisos e navegação não são ocultáveis.

## Decisões
- Variabilidade usa desvio-padrão e amplitude (já gratuitos na Análise); o CV só aparece com a licença das Métricas.
- Base única: registros reais; só sem nenhum real (pessoa nova) os exemplos são a base.
- Desempenho: modelo calculado uma vez por combinação dados/período/minuto (cache).

## Testes
- `tests/test27.js` (89 verificações: lógica pura + navegador: muitos/poucos registros, sem medição recente, sem exames, dados incompletos, preferências e persistência, temas claro/escuro, atualização após novo registro, 320 px).
- `tests/test22.js` ajustado: a ordem relativa dos cartões originais continua verificada ("ult" agora no painel).
- `logic.js` passou a exportar mais utilitários (somente `module.exports`).
