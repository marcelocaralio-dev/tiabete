# GLUXO – bolha de notificações (sobre a 0.21.1)

Arquivos alterados: src/alertcenter.js, src/acchat.css; novo tests/test21.js.
Acrescente ao "test" do package.json: `&& node tests/test21.js`. Nada de licenciamento, Worker ou geração de alertas foi tocado.

## Corrigido
- Painel mais largo (até 560 px, respeitando 12 px de margem), altura automática, sem reticências. Mensagem longa fica recolhida com "Ler tudo" / "Recolher" (tocar no texto também expande).
- Margem direita: a medição de escala (acK) era feita com a bolha já ampliada durante o arrasto/transição; agora usa uma sonda fora da tela. A bolha encosta nas duas laterais.
- Arrasto só vertical; o lado vem da posição do dedo (histerese 42%/58%); ao soltar, sempre encosta. Zona de descarte continua funcionando.
- Persistência: gravação imediata (espelho síncrono em localStorage + IndexedDB), descarga ao ocultar/fechar, restauração antecipada na abertura, tomada do registro mais novo; listeners ligados uma única vez (sem duplicar bolha).

## Limites
- A bolha é interna ao app (não há sobreposição nativa nem serviço Android; não existe permissão de sobreposição a pedir/revogar). Ela reaparece sozinha ao abrir o app; não existe restauração com o app fechado/reinício do aparelho.
- A causa exata do desaparecimento no Android não foi reproduzida; as defesas acima cobrem as rotas plausíveis. Testes em Chromium (Pixel 7 emulado), não em aparelho; APK não gerado.
