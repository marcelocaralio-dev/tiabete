# GLUXO/TiaBete 0.21.1 — conta Google na abertura e validação da licença

Problema: depois do login Google a licença continuava "Plano gratuito"; "Atualizar situação" não mudava nada; a conta só era reconhecida depois de abrir Mais → Cópia de segurança.

## Causa principal
`native/drive.js` só lia a conta Google guardada (`load()`) quando a tela de backup era desenhada. Na abertura, `TB_DRV_STATE.conn` ficava falso, então `licRefresh()` (src/license.js) não tinha aparelho nem conta, não consultava o servidor e o token da licença vitalícia nunca era buscado. Falhas silenciosas escondiam o resto: `idToken()` devolvia `null` sem motivo, resposta com assinatura inválida era ignorada, e a compra chamava `licSession()` com `LK.busy` ligado (retorno imediato).

## Correções
- native/drive.js: a conta é restaurada UMA vez na abertura (`TB_DRV.ready()`); o evento `tb-auth` agora diz o tipo (restored, connected, disconnected, changed); `idToken()` explica a falha em `TB_DRV_STATE.idErr` (sem conta, Google recusou, sem identidade, sem conexão, erro do Google) e junta chamadas simultâneas.
- src/license.js: a abertura espera a conta Google restaurada antes de consultar; novo fluxo único `licRefresh` (aparelho conhecido → /v1/refresh; sem aparelho ou 401 → /v1/session); `licSave` confere a assinatura ANTES de aceitar e guardar (o "status" da resposta nunca libera nada) e mantém o token anterior se a conferência falhar; mensagens claras para rede, 401, 429, erro do servidor e assinatura; "Atualizar situação" mostra "Consultando…" e a última consulta; a compra não perde mais a sessão; login concluído ou restaurado atualiza a licença sem abrir o backup.
- Ordem de compilação: NÃO alterada (license.js precisa vir antes dos módulos nativos para proteger as telas premium); a ordem de inicialização é garantida por espera e evento.
- Não mudou: regras de trial, Premium, preço, limite de 2 aparelhos, Worker, banco, chaves, recursos gratuitos, telas.

## Testes
- tests/test15.js (novo): drive.js + license.js reais, na ordem do build, ligados ao Worker real em SQLite. Na 0.21.0 falha 18 de 24 verificações (reproduz o defeito); na 0.21.1 passa 24/24.
- package.json e package-lock.json: versão 0.21.1; test15 incluído em `npm test`.
