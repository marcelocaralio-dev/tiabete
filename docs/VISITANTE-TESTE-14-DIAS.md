# Modo visitante, teste de 14 dias e migração para Google (0.33.0)

## Diagnóstico da versão anterior (0.32.0)
- "Continuar sem conta" existia (link pequeno e sublinhado), mas o visitante **não recebia Premium**: o teste só nascia no servidor, no primeiro login Google (`/v1/session`). Sem conta, o status ficava `pending_trial` e todo recurso Premium ficava bloqueado.
- O teste estava preso à conta Google (`accounts.trial_started_at`): protegia contra reinstalar *depois* de entrar, mas não havia nenhum registro para quem nunca entrou.
- Os dados (glicemia, insulina, histórico, configurações) são **100% locais** (IndexedDB do WebView). Entrar com Google nunca os move nem os esconde; a conta só traz cópia opcional no Drive, licença vinculada e recuperação. Nenhuma informação local ficava inacessível após o login.
- Relógio: o "maior instante já visto" só era gravado a cada resposta do servidor, e recuar a data **congelava** o tempo (teste e tolerância offline de 7 dias não venciam até o relógio alcançar o valor antigo). Um relógio adiantado por engano ficava gravado.
- Backup: `allowBackup="false"` (mantido). Backup só no Drive do usuário, por pedido dele.

## O que mudou
| Área | Arquivo | Mudança |
|---|---|---|
| Servidor | `worker/migrations/0005_guests.sql` | tabela `installs` (id aleatório, hash do segredo, início, vínculo) |
| Servidor | `worker/src/index.js` | `POST /v1/guest/start`, `POST /v1/guest/refresh`; `/v1/session` aceita `install_id/install_secret` e aplica "vale o início mais antigo" |
| Núcleo | `src/licensecore.js` | `LIC_PROV_MS`, `licGuestStart`, `licEarliest` |
| App | `src/license.js` | teste do visitante, relógio protegido, avisos, textos |
| App | `native/login.js` | "Continuar sem conta" vira botão do mesmo peso + texto das limitações |
| App | `native/drive.js` | `sub` no perfil; aviso ao visitante na tela de backup |
| App | `native/migrate.js` (novo) | oferta/migração visitante → Google |
| App | `src/app.js`, `scripts/build-web.js`, `package.json` | gancho dos avisos, inclusão no build, versão 0.33.0 |
| Testes | `tests/test34.js` (novo); `test9/13/14/23/24` | ajustes de valores congelados |

## Identificação do visitante
Id aleatório da instalação (o mesmo `lic-dev` já existente) + segredo aleatório de 192 bits, ambos só no cofre local (chave AES-GCM **não exportável** do WebCrypto). Sem IMEI, serial, MAC ou ID de publicidade. O servidor guarda só o id e o SHA-256 do segredo. Android Keystore nativo não é usado (exigiria plugin novo); o cofre atual é o recurso criptográfico disponível sem mudar a arquitetura.

## Proteção dos 14 dias
- Início = hora do **servidor** no primeiro acesso efetivo (depois da escolha na tela de entrada), 336 h corridas.
- Repetir `start` é idempotente; atualizar, reabrir, reiniciar não mudam o fim.
- Login/logout/troca de conta: vale sempre o início **mais antigo** entre instalação e conta (nos dois registros). Conta existente nunca ganha teste novo.
- Relógio: o tempo protegido avança pelo tempo real decorrido, nunca recua e não congela; é gravado a cada minuto de uso, ao sair do app e a cada resposta do servidor; o servidor desfaz um "adiantado" além de 5 min.
- Sem internet no primeiro acesso: **sem teste local** (substituído na 0.34.0): o gratuito funciona e o teste começa quando houver internet.
- Freios: 60 chamadas/10 min por IP, 30 instalações novas/24 h por IP.

## Limitações inevitáveis
- (0.33.0) Quem apagava os dados do app sem conta Google ganhava novo teste. **Na 0.34.0 isso é coberto pelo Android ID**; ver `docs/PROTECAO-TESTE-ANDROID-ID.md`. Só uma identidade externa persistente (conta Google) resolve; não exigimos login de todos nem usamos identificador invasivo.
- Quem cria várias contas Google novas, cada uma em instalação nova, também obtém testes novos.
- Várias pessoas num mesmo celular compartilham o início mais antigo daquela instalação.
- Play Integrity: avaliado, **não implementado**. Exige projeto Google Cloud, nonce e decodificação no Worker com credencial de serviço, mais plugin nativo. Seria só sinal complementar. Block Store (Play Services) também exige plugin nativo e não foi verificado aqui.
- A Central de Métricas continua exclusiva da licença vitalícia (divisão aprovada), mesmo durante o teste. O pedido diz "todas as funcionalidades Premium"; mantive o aprovado. Se quiser liberá-la no teste, é uma linha em `LIC_LIFETIME`.
- Usuários atuais que já usavam sem conta nunca tiveram teste: recebem 14 dias no primeiro uso desta versão.

## Migração visitante → Google
Os dados já são locais e não mudam de lugar. `migrate.js`, depois de um login concluído:
1. **oferece** salvar uma cópia no Drive (nada é enviado sem o toque, regra de privacidade do app);
2. lista as cópias que a conta já tinha, depois envia a do aparelho (arquivo novo, aditivo);
3. se havia cópias antigas, oferece "Revisar e mesclar" (restauração existente: mescla, remove duplicados, nunca apaga);
4. falha ou app fechado no meio: estado `pendente`, dados intactos, tentar de novo.
Só grava o marcador `guest-link`; nunca toca nos registros. O teste: ver acima (início mais antigo).

## Licença vitalícia
Inalterada: R$ 29,90, vinculada à conta, recuperada após autenticar em outro aparelho, sem duplicar (testado). O caminho do visitante nunca concede licença; comprar exige Google.

## Testes
`npm test` completo passa, incluindo `test34` (121 verificações: Worker real em SQLite + app real, todos os cenários da tabela do pedido, falhas de migração e servidor fora). Mutações (relógio antigo; sem "mais antigo") fazem o test34 falhar. Simulação em Chromium: tela de entrada, visitante com Worker real, reabrir, expiração e bloqueio. `tests/login-sim.py` já falhava na versão original (campo `#pf-type` do perfil mudou); não é regressão.
**Não testado aqui:** instalação do APK em Android e login Google real (dependem de aparelho/credenciais).

## Configuração do backend
1. `wrangler d1 migrations apply` (aplica `0005_guests.sql`).
2. `wrangler deploy` do Worker. Sem novas variáveis ou segredos.
3. Deploy do Worker **antes** de distribuir o APK; sem ele o visitante só terá o teste quando o servidor responder.
Privacidade: o servidor passa a guardar um id aleatório de instalação e a data de início; nenhum dado de saúde.
