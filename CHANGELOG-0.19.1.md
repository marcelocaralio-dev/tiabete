# TiaBete 0.19.1 — Arrastar para baixo para atualizar

- Arraste a página para baixo, a partir do topo, e solte depois do ponto marcado (círculo vermelho que se completa e brilha): a página atual relê os dados salvos no aparelho e é redesenhada, com animação de carregamento e retorno suave.
- Só começa com a página no topo. Não age no meio da página, nem quando o toque começa em campos, listas de seleção, gráficos, roleta de insulina, áreas que rolam, folhas abertas, menu lateral ou tela de bloqueio. Rolagem normal e os gestos de trocar de aba continuam como estavam.
- Não faz duas atualizações ao mesmo tempo.
- Não grava, não apaga e não muda nada do que está salvo (só lê o banco local). Sem internet: os dados continuam e aparece um aviso discreto.
- Vale no app Android e na versão instalada (PWA); desativa o "puxar para atualizar" próprio do navegador (`overscroll-behavior-y: contain`).
- Sem botão novo. Movimento reduzido: sem animação de deslocamento.

Novos: `src/ptr.js`, `src/ptr.css`. Alterados: `scripts/build-web.js` (só registra os arquivos; `K = 1.29` intacto), `package.json`.
