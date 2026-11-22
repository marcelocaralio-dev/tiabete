# 0.37.0 · Recorde pessoal nas Conquistas

Cada conquista de dias seguidos agora mostra, no próprio cartão, o **recorde pessoal**: a maior sequência que o usuário já alcançou naquela conquista, ao lado da sequência atual.

## O que mudou
- **Cartão**: a sequência atual continua no número grande à direita ("dias seguidos"). O recorde aparece como uma etiqueta discreta com troféu dourado ("Recorde 21 dias"), na mesma linha do estado ("Reiniciada", "Concluída"…), sem aumentar a altura do cartão. Quando a sequência atual iguala o recorde, a etiqueta ganha um realce leve. Sem histórico: "Recorde —". Em telas ≤ 360 px só o troféu e o número.
- **Preservação**: o recorde só sobe. Perder a sequência atual, apagar ou editar registros antigos não reduz nem zera o valor guardado.
- **Atualização automática**: ao superar o recorde, o valor é atualizado e gravado (mesma rotina que já confere as conquistas).
- **Retroativo**: quem já tinha sequências antes desta versão ganha o recorde na primeira abertura (calculado do histórico completo).
- **Independência**: um recorde por conquista (`hypo`, `fast`, `norm` e cada personalizada `c:ID`), nunca compartilhado. "Acumular medições" não tem sequência e não mostra recorde.
- **Mudança de regra**: se o usuário altera a regra de contagem de uma conquista personalizada (tipo, limites, medições que contam, mínimo por dia ou data inicial), o recorde antigo era de outra regra e é recalculado; o app avisa. Mudar só a meta em dias não afeta o recorde. Excluir a conquista remove o seu recorde.

## Persistência e sincronização
Fica em `S.rw.rec` (meta `rewards`), junto das demais conquistas: sobrevive a reiniciar e atualizar o app, e vai no backup, no Google Drive e na restauração. Ao restaurar, vale o maior valor de cada conquista (nunca diminui); chaves ou valores inválidos são ignorados.

## Arquivos
Novos: `src/conquistas-rec.css`, `tests/test38.js`, este arquivo.
Alterados: `src/logic.js` (`best`/`bestEnd` em `rewardEval`), `src/conquistas2.js` (recorde, cartões, restauração, exclusão, texto de ajuda), `src/extras.js` (`rewardCheck` grava o recorde), `scripts/build-web.js`, `package.json` (0.37.0 + test38), `tests/test34.js`, `tests/test35.js`.
Nada mudou nas regras de validação dos dias, nos selos 7/14/30/90, nas comemorações nem no licenciamento.
