# TiaBete 0.19.3 — Textos informativos retráteis

- Textos informativos com mais de 2 linhas (`hint` e textos de apoio) viram blocos recolhidos em 2 linhas, com **Ler mais** / **Mostrar menos** (abre e fecha com animação rápida; "movimento reduzido" desliga a animação). O texto fica inteiro na tela, só cortado até a pessoa abrir. O estado aberto é lembrado enquanto o app está aberto.
- Esses textos vão para o **fim da sua seção** (ou, se estavam soltos no topo, para o fim da página, antes do aviso de segurança), mantendo cada um na página e na seção de origem.
- Ficam como estão: avisos e alertas, textos de campos e rótulos, indicadores, textos com botões ou links, e mensagens de segurança, privacidade, cobrança, limites e passos indispensáveis (ex.: "Atenção…", "Privacidade…", "Em 4 passos…", "não use para decidir doses").
- **Página Análises não foi alterada**: nada é medido, movido nem recolhido nela (conferido comparando o conteúdo da página com o da versão 0.19.2).
- Cada página é tratada ao ser mostrada; textos dentro de seções fechadas são tratados quando a seção abre.

Novos: `src/readmore.js`, `src/readmore.css`. Alterados: `src/app.js` (uma linha no fim de `render()`), `scripts/build-web.js` (registra os arquivos; `K = 1.29` intacto), `package.json`.
