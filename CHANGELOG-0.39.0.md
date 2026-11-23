# 0.39.0 · Reformulação das notificações e da bolha flutuante (PROMPT 52)

Validado em navegador real (Chromium, Pixel 7) por `tests/test40.js` (47 verificações, temas escuro e claro, reinício completo do navegador) e `tests/test21.js` (layout da bolha, atualizado). A bolha e o painel têm uma única fonte de verdade: `S.ac.items` (mesma estrutura e mesma persistência de antes; só foram acrescentados `dest` e o uso de `dismissed`/`read`).

## Análise prévia (o que existia)
- Bolha e painel em `src/alertcenter.js`; CSS em `src/style.css` e `src/acchat.css`; estado `S.ac` gravado no espelho `localStorage` e no IndexedDB (`alert-center`).
- Gota antiga: SVG redesenhado com gradiente; contador numérico `.acb-n`; borda vermelha e pulso (`crit`) como indicadores; cada alerta com ícones de ação (ações da faixa, "lido", "dispensar"); "Ler tudo" por item; "Dispensar todos" com confirmação.
- A primeira sincronização da abertura (`init.js` → `acSync`) abria o painel para itens novos.

## O que mudou
1. **Gota oficial**: a bolha usa o PNG oficial da marca (`GX_DROP`, o mesmo de `assets/brand/web-gota.png`), sem redesenho, proporção original, centralizada. Nenhum outro ícone foi alterado.
2. **Bolha branca** nos dois temas, gota vermelha; tamanho, forma, posição, arrasto e animações inalterados.
3. **Abertura sempre recolhida**: a primeira sincronização depois da inicialização (`AC.booted`) nunca expande; o halo informa os não lidos.
4. **Chegada nova durante a sessão**: expande, mostra o conteúdo e recolhe no tempo original (`acPop`/`acOpen`/`acTimer`/`acCollapse` não foram alterados; o teste confere o tempo).
5. **Halo verde externo** (pseudo-elemento, independente de expandir/recolher/arrastar), com exatamente o verde das bordas dos cards positivos (`--ds-pos`, o `--tone` de `data-tone="pos"`). Só acende com não lidos ativos na lista; é o único indicador (pulso vermelho e borda vermelha removidos).
6. **Contador numérico removido** (número, círculo, borda). A contagem interna (`acUnread`) continua.
7. **Painel com superfície e elevação próprias**: novos tokens `--acp-bg/--acp-row/--acp-bd/--acp-sh/--acp-hl` definidos para escuro e claro (tom de superfície, borda discreta, sombra, realce interno). Não depende de escurecer/clarear a página; texto e botões ≥ 4,5:1 de contraste. Outras telas e cards intactos.
8. **Dois botões por notificação**: "Marcar como lida" (mantém na lista; atualiza contagem e halo) e "Remover da lista" (sai da lista ativa, lida ou não; o item continua no Histórico de alertas). Ícones de ação e "Ler tudo" removidos; a mensagem agora aparece inteira.
9. **Conteúdo clicável com destino** (`it.dest = {r, p}` por fonte, com parâmetros da ocorrência): o toque marca como lida, remove da lista na hora e então navega; em "insrem" também abre a folha do lembrete. Destino ausente ou inválido, ou falha na navegação: o item já foi lido e removido, sem erro nem redirecionamento errado.
10. **Cabeçalho**: "Marcar todas como lidas" (mantém todas, zera contagem e halo) e "Remover todas" (esvazia a lista ativa, zera contagem e halo, preserva histórico), separados. Ao remover todas, **não há mais a etapa de confirmação** (o histórico preserva tudo e o item pode ser restaurado ali).
11. **Persistência**: lido, remoção individual, remoção por clique e "remover todas" são gravados na hora (espelho + IndexedDB); removido não reaparece nem se a fonte do alerta continuar ativa.

## Checklist (28 itens)
Todos verificados em `test40` (B1–B7, I1–I2, N1–N2, H1–H3, P1–P5, R1–R5, C0–C3, T0–T2, S1–S5, E0) e `test21`. Captura dos dois temas conferida visualmente.

## Limites
- Não houve teste em aparelho Android real.
- As ações rápidas das faixas (ex.: "Já apliquei") deixaram de aparecer no painel (item 8 do pedido); continuam nas faixas do modo convencional e nas telas de destino.

## Arquivos
Novo: `tests/test40.js`, este arquivo. Alterados: `src/alertcenter.js`, `src/style.css`, `src/acchat.css`, `tests/test21.js`, `package.json` (0.39.0).
