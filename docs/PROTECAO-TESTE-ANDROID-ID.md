# Proteção do teste de 14 dias contra reinstalação e limpeza de dados (0.34.0)

## Arquitetura encontrada (0.33.0) e falhas
- Visitante: teste no servidor (`installs`), preso a um id aleatório que vive **só no cofre do app**. O cofre, o banco de registros e o id morrem juntos ao limpar os dados ou desinstalar.
- Conta Google: o teste fica em `accounts.trial_started_at` e sobrevive a reinstalar **depois de entrar**.
- Backend: Worker + D1 `tiabete-licenses` (`database_id` real em `wrangler.toml`). O D1 é persistente em produção e sobrevive a novos deploys; as migrations só acrescentam tabelas. (Nos testes automáticos o banco é SQLite em memória; isso não vale para produção.)
- Backup: contém só dados pessoais (`backupText`); nenhum estado de licença/teste entra nele nem é lido na restauração. Confirmado por teste.
- **Falha 1:** visitante que limpava os dados ou reinstalava virava instalação nova e ganhava outro teste.
- **Falha 2:** o teste provisório offline de 72 h (0.33.0) renovava o Premium a cada limpeza de dados feita sem internet. **Removido:** sem conexão no primeiro acesso não há teste local; o gratuito funciona e o teste começa (no servidor) quando houver internet.
- **Falha 3:** quem usava só com Google, deixava vencer, limpava os dados e escolhia visitante ganhava teste novo (a conta não era consultada).

## Android ID
- Plugin nativo `TbDevice` (gerado por `scripts/patch-android.js`) devolve `Settings.Secure.ANDROID_ID` (API oficial; sem permissões novas; sem MAC, IMEI ou serial).
- O app lê o valor na hora, envia por HTTPS (`device_hint`) e **não o guarda, mostra nem registra**.
- O Worker calcula `HMAC-SHA256(DEVICE_HMAC_KEY, "tb-android-id-v1|" + id)` e descarta o valor bruto. Só o hash (64 hex) vai para `trial_devices`. Nada em log, erro ou resposta.
- Valores inválidos ou sabidamente repetidos (`9774d56d682e549c`, zeros, repetições) são ignorados para não negar o teste a quem nunca o usou. Sem `DEVICE_HMAC_KEY` o recurso fica desligado; nunca se grava hash sem segredo.
- Não é senha, token nem prova de identidade: só diz "este aparelho já recebeu um teste".
- **Limites:** muda após restauração de fábrica, em outro perfil de usuário e se a chave de assinatura do APK mudar (o workflow usa o keystore fixo dos Secrets: não troque). Algumas fabricantes repetem valores. Quem troca de aparelho recebe novo valor.

## Registro permanente (D1, tabela `trial_devices`)
`dev_hash`, `trial_started_at`, `trial_expires_at` (UTC, hora do servidor), `trial_granted`, `first_install_id`, `created_at`, `last_seen`. Nunca é apagado pelo app. O início só pode ficar **mais antigo**.
- Instalação nova: o servidor consulta o aparelho; se existir, a nova instalação herda o início original (expirado continua expirado; válido mantém a expiração original). Só sem registro nasce um teste novo, com a hora do servidor (o app não escolhe o início).
- Conta Google e `/v1/refresh` também registram/igualam o aparelho: conta, instalações e aparelho ficam com o início mais antigo. Login depois não dá segundo teste.
- A licença vitalícia é da conta e não é tocada: o registro do teste nunca a sobrescreve nem bloqueia (testado no mesmo aparelho e em outro).

## Offline e servidor fora
Sem validação o Premium não é liberado, mas o gratuito e todos os registros seguem normais; nenhum teste novo é concedido. O relógio protegido (0.33.0) e a tolerância offline de 7 dias do token continuam valendo.

## O que ainda permite um novo teste
- Restauração de fábrica, outro perfil de usuário, outro aparelho ou mudança da chave de assinatura (Android ID novo).
- Android ID inválido ou repetido (ignorado).
- Quem cria outra conta Google **e** troca o Android ID.
- Troca da `DEVICE_HMAC_KEY` (não faça).
- Instalações sem o plugin nativo (versão web) não têm reconhecimento por aparelho.

## Configuração necessária
1. `wrangler secret put DEVICE_HMAC_KEY` (valor aleatório longo; guarde-o em local seguro e **nunca troque**).
2. `wrangler d1 migrations apply` (aplica `0006_trial_devices.sql`) e `wrangler deploy`.
3. Android: nenhuma permissão nova. O plugin é gerado no build pelo `patch-android.js`; gere o APK com a mesma assinatura de sempre (instala por cima).
4. Privacidade: texto atualizado em `PRIVACY.md` (LGPD). Confira a política publicada.

## Testes
`tests/test35.js` (47 verificações): os 13 cenários do pedido, mais Google-primeiro vencido, conta antiga, vitalícia no mesmo aparelho e em outro, Android ID inválido, ausência de segredo, e ausência do valor bruto em tabelas, logs, respostas, erros, cofre e telas. Não testado aqui: execução real do plugin num Android (compilado só contra stubs) e o D1 de produção.
