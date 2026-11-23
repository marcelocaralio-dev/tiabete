# Notificações da bolha: navegação contextual, botão "Acessar" e cards mais espaçosos

- Causa do bug: o destino era só uma rota; "Medição" ia para `lembretes` (configuração de alertas) e telas que são painéis (nova glicemia, protocolo de hipoglicemia) nunca abriam.
- Mapeamento central por tipo (`AC_DEST` em `src/alertcenter.js`), com rota (`r`), ação (`a`), rolagem (`s`) e parâmetros (`p`). Itens antigos são corrigidos ao carregar (`acFixDest`).
- Terceiro botão "Acessar" = mesmo caminho do clique no conteúdo: marca lida, remove da lista ativa (histórico preservado) e navega.
- Cards com mais espaço, texto de 15,5 px, botões de 44 px que quebram em duas linhas em telas estreitas.
- `caCompute` passa a devolver `recId` e a faixa do alerta personalizado leva `data-rec`.
- Testes: `tests/test43.js` (263 verificações); `test21` e `test40` atualizados para 3 botões / novo destino.

| Tipo | Destino |
|---|---|
| Medição (lembrete) | Nova glicemia, já em jejum / antes do almoço / antes do jantar |
| Tratamento: Medir | Nova glicemia |
| Tratamento: Hora do tratamento | Início, card Meu tratamento |
| Hipoglicemia | Protocolo de hipoglicemia |
| Glicemia muito elevada | Nova glicemia |
| Basal | Início, card da basal |
| Pré-jantar | Início, card da insulina do jantar |
| Lembrete de insulina | Aviso daquela insulina |
| Alerta personalizado | Registro que disparou (senão Histórico) |
| Conquista | Conquistas |
| Cópia, Drive, armazenamento | Cópia de segurança |
| Dados de exemplo | Nova glicemia |
| Confirmações | Tela onde a ação aconteceu |
