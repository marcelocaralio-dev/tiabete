# Todos os cards do Início personalizáveis (0.47.0)

Escopo: tela Início. Os cards que ainda eram fixos (Período de análise, indicadores do painel, atalhos e acontecimentos importantes) passaram a ser cards personalizáveis, como os demais: dá para **mover** (alça de arraste ou setas do teclado) e **ocultar**. Só ficam fixos o **Resumo glicêmico** (topo) e a **Central de Métricas** (final), além dos avisos/lembretes. Nenhum cálculo, gráfico, dado ou conteúdo de card foi alterado.

## O que mudou
- **Indicadores do painel viram cards**: Média, Tendência, Variabilidade, Na faixa, Hipoglicemias, Acima da faixa, Comparação e HbA1c estimada são 8 cards independentes (`ind-media`, `ind-tend`, …). **Todos podem ser ocultados**, inclusive o último (não há mais mínimo de 1 nem máximo de 4). Os indicadores continuam abrindo os mesmos detalhes ao toque.
- **Padrão visual preservado**: Média, Tendência, Variabilidade e Na faixa continuam visíveis, 2 por linha no celular (4 em telas largas); os outros quatro começam em **Cards disponíveis**.
- **Período de análise** (seletor 7/30/90 dias + texto do período) é um card próprio (`per`), movível e ocultável.
- **Atalhos** (`atalhos`) e **Acontecimentos importantes** (`eventos`) também entram na lista. Na edição, se não houver conteúdo no momento, aparecem como espaço reservado ("Nada a mostrar agora"), para poderem ser movidos ou ocultados mesmo vazios; fora da edição continuam sumindo quando não há nada a mostrar.
- O painel recolhível **"Indicadores do painel (1 a 4)"** da barra de edição foi removido: os indicadores agora são geridos como qualquer outro card (✕ para ocultar; "Adicionar à tela inicial" em Cards disponíveis).
- Se o card Período de análise for ocultado, o seletor 7/30/90 deixa de aparecer na tela; o período escolhido continua valendo e também pode ser trocado na janela de detalhes de "Evolução da glicemia". Basta readicionar o card em Cards disponíveis.

## Compatibilidade (migração automática)
- Formato salvo passa de `v:1` para `v:2` (`order` e `hidden` apenas; `pri` deixa de existir). Quem já tinha personalizado **mantém a escolha**: a ordem e os ocultos antigos são preservados; os cards antes fixos entram no topo (onde sempre ficaram); os indicadores que estavam em `pri` continuam visíveis, na mesma ordem, e os demais passam a ocultos. Configuração antiga padrão equivale ao novo padrão.
- Mesmo mecanismo de armazenamento (`localStorage` `tb-inicio` + cópia durável em `persist.js`). Cards futuros continuam entrando sozinhos no fim.

## Arquivos
`src/inicio-core.js` (catálogo com 25 cards, `IN_TOP`, `IN_IND`, migração v1→v2, remoção de `pri`/`inTogglePri`), `src/inicio.js` (`inPeriodo`, `inIndCard`, espaço reservado na edição, barra de edição), `src/painel2.js` (montagem da tela: tudo, exceto Resumo e Central, na grade personalizável), `src/inicio.css`, `tests/test27.js`, `tests/test50.js` e `tests/test51.js` (adaptados; novos testes de mover/ocultar indicadores, ocultar período/atalhos/acontecimentos, readicionar, restaurar padrão e migração).

## Testes
`test27`, `test50` e `test51` passam. `test28` e `test31` falham igual na versão anterior (não relacionados a esta mudança).
