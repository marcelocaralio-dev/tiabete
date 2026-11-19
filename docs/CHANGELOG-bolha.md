# GLUXO – bolha de notificações e toque fora de cards (sobre o GLUXO-main, versão 0.21.1)

Arquivos alterados: src/alertcenter.js, src/acchat.css, scripts/build-web.js (só a entrada overlayguard), package.json (só a cadeia de testes). Também alterados (ícones): src/bolus.js, native/ai-ui.js. Novos: src/overlayguard.js, src/iconset.js, tests/test16.js, tests/test19.js, tests/test21.js.
Nada de licenciamento, Worker, Android, assinatura ou geração de alertas foi tocado. Os arquivos da bolha do GLUXO-main eram idênticos aos da 0.21.1 original, então o trabalho foi reaplicado e revalidado nesta base.

## Corrigido
- Painel mais largo (até 560 px, respeitando 12 px de margem), altura automática, sem reticências. Mensagem longa fica recolhida com "Ler tudo" / "Recolher" (tocar no texto também expande).
- Margem direita: a medição de escala (acK) era feita com a bolha já ampliada durante o arrasto/transição; agora usa uma sonda fora da tela. A bolha encosta nas duas laterais.
- Arrasto só vertical; o lado vem da posição do dedo (histerese 42%/58%); ao soltar, sempre encosta. Zona de descarte continua funcionando.
- Persistência: gravação imediata (espelho síncrono em localStorage + IndexedDB), descarga ao ocultar/fechar, restauração antecipada na abertura, tomada do registro mais novo; listeners ligados uma única vez (sem duplicar bolha).

## Limites
- A bolha é interna ao app (não há sobreposição nativa nem serviço Android; não existe permissão de sobreposição a pedir/revogar). Ela reaparece sozinha ao abrir o app; não existe restauração com o app fechado/reinício do aparelho.
- A causa exata do desaparecimento no Android não foi reproduzida; as defesas acima cobrem as rotas plausíveis. Testes em Chromium (Pixel 7 emulado), não em aparelho; APK não gerado.

## Toque fora de card aberto (PROMPT 33)
- src/overlayguard.js: o toque no fundo de uma folha, cartão de conquista, menu lateral ou painel da bolha só fecha; o clique do mesmo toque é descartado e nada atrás é acionado. Desarma sozinho.
- tests/test16.js (17 verificações): antes da correção 7 falhavam na base; agora todas passam.

## Ícones (PROMPT 32)
- src/iconset.js: padrão único (viewBox 24, traço 1,8, pontas arredondadas, sem preenchimento) e tabela categoria → ícone. Cada categoria principal tem forma própria; itens da mesma categoria (menu lateral, aba Mais, alertas) compartilham o ícone. Ajustes: HbA1c deixou de usar a gota da glicemia; Mais deixou de ser "+"; Lembretes de insulina deixou de cair no ícone de Sobre; tema usa sol/lua, refeições não.
- src/bolus.js e native/ai-ui.js: só ícones das seções, sem mudar texto, ação ou navegação.
- tests/test19.js (10 verificações): tabela completa, nenhuma forma repetida entre categorias diferentes, nenhum item sem ícone, sem fill/traço próprio, seções da tela de IA com ícones diferentes.
