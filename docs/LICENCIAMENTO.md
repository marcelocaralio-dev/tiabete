# Licenciamento do TiaBete: guia de ativação

> **Regra inegociável:** registrar glicemia e insulina, consultar o histórico e exportar os próprios dados são **sempre gratuitos**, com teste ativo, expirado ou sem licença. O licenciamento não lê nem grava dados de saúde e não mexe no banco `glicotrack`.

## Como funciona (resumo)
- **Gratuito para sempre:** registros de glicemia e insulina, históricos, edição, Início, Hemoglobina glicada, Meu tratamento, hipoglicemia, alertas, perfil, segurança, backup e restauração, Drive, exportação Excel/CSV.
- **Premium** (teste de 14 dias ou licença vitalícia): cálculo de bolus, Padrões, Exames, Análise, relatório em PDF e IA. A lista está em `LIC_PREMIUM` (`src/license.js`).
- **Teste:** 336 horas a partir do primeiro login com Google, contadas pelo relógio do **servidor**. Não reinicia ao reinstalar ou trocar de aparelho.
- **Licença vitalícia:** R$ 29,90 (preço no banco; mudar vale só para vendas novas). Até 2 aparelhos; trocar é gratuito.
- **Offline:** o app guarda um token assinado e confere a assinatura com a chave pública. Vale 7 dias sem internet no teste e 30 dias na licença vitalícia. Depois disso só o premium pausa; o gratuito nunca para.
- **Produção x desenvolvimento:** o build normal é **produção**: sem servidor configurado, o premium fica **bloqueado** (o gratuito segue normal). O modo de desenvolvimento só existe com `npm run build:web:dev` e **nunca** deve ser publicado.

## O que você vai precisar (nunca envie estes dados a ninguém, nem a mim)
Senhas, o **Access Token** do Mercado Pago, a **assinatura secreta** do webhook e a **chave privada** de licença são digitados só no seu terminal ou no painel de cada serviço. Nada disso vai para o repositório nem para o app.

---

## Passo 1. Conta na Cloudflare (gratuito; você já tem)
- **Onde:** https://dash.cloudflare.com/sign-up
- **O que criar:** uma conta com seu e-mail e uma senha forte. Confirme o e-mail recebido. Não precisa cadastrar cartão.
- **Como verificar:** ao entrar em https://dash.cloudflare.com você vê o painel. Anote o nome do seu "subdomínio workers.dev" (aparece em *Workers & Pages*, ao criar o primeiro Worker).

## Passo 2. Conferir os recursos já criados e preencher o `wrangler.toml`
Recursos já existentes na sua conta (não crie outros): Worker **`tiabete-license-api`**, banco D1 **`tiabete-licenses`**, binding **`DB`**.
- **Onde:** no computador, na pasta do projeto TiaBete. Precisa de Node 22.13 ou mais novo (`node -v`).
- **O que fazer:**
  1. `npm install -g wrangler` e depois `wrangler login` (abre o navegador; clique em *Allow*).
  2. Abra `worker/wrangler.toml`. Já estão certos: `name = "tiabete-license-api"`, `binding = "DB"`, `database_name = "tiabete-licenses"` e `migrations_dir = "migrations"`.
  3. Preencha os três campos pendentes (tabela abaixo).
- **Como verificar:** `wrangler whoami` mostra a sua conta e `wrangler d1 list` mostra `tiabete-licenses` com o UUID.

| Campo | Onde fica | O que colocar | Onde obter |
|---|---|---|---|
| `database_id` | bloco `[[d1_databases]]` | UUID do banco, formato `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Painel Cloudflare → *Storage & Databases* → *D1* → `tiabete-licenses`; ou `wrangler d1 list` |
| `GOOGLE_CLIENT_ID` | bloco `[vars]` | ID do cliente OAuth do app, termina em `.apps.googleusercontent.com` | É o conteúdo de `config/google-client-id.txt` |
| `PUBLIC_URL` | bloco `[vars]` | `https://tiabete-license-api.SEU-SUBDOMINIO.workers.dev`, sem barra no fim | Painel Cloudflare → *Workers & Pages* → `tiabete-license-api` (endereço do Worker) |
| `APP_RETURN` | bloco `[vars]` | já vem `app.tiabete.glicose:/pagamento`: **não mude** | — |

`GOOGLE_CLIENT_ID`, `PUBLIC_URL` e `APP_RETURN` são públicos (não são segredo) e podem ficar no arquivo versionado.

## Passo 3. Rodar as migrations no banco `tiabete-licenses`
- **Quando:** só depois de preencher o `database_id`, e quando você decidir. Isto altera o banco remoto.
- **O que fazer:** na pasta `worker`: `wrangler d1 migrations apply tiabete-licenses --remote` (responda `y`). Aplica `0001_init.sql` (contas, licenças, pedidos, aparelhos, preço) `0002_security.sql` (anti-repetição e limite de frequência) `0003_orders_api.sql` (guarda o id da Order do Mercado Pago) e `0004_chargebacks.sql` (estado da contestação e data da última atualização aplicada). Ambas só adicionam colunas/índice, não apagam nada.
- **Como verificar:** `wrangler d1 execute tiabete-licenses --remote --command "SELECT key,value FROM config"` deve listar `price_cents = 2990` e `currency = BRL`.
- **Mudar o preço de novas vendas:** `wrangler d1 execute tiabete-licenses --remote --command "UPDATE config SET value='3490' WHERE key='price_cents'"`. Licenças já vendidas não mudam. Não há tela de administração pública; só quem está logado na sua conta Cloudflare muda o preço.

## Passo 4. Gerar a chave de assinatura e cadastrar os Worker Secrets
Os três segredos ficam **só no Worker**, cadastrados com `wrangler secret put`. Esse comando pede o valor no terminal **sem mostrá-lo** e o envia criptografado para a Cloudflare. Nunca ponha esses valores no `wrangler.toml`, em arquivos do projeto, no GitHub, no app ou em conversas.
- **Onde:** terminal. Passos 1 e 2 na raiz do projeto, o resto na pasta `worker`.
- **O que fazer:**
  1. **Chave de assinatura (rode uma única vez):** `node worker/gen-keys.js`. A chave é criada no **seu computador**. Ele grava `config/license-public-key.json` (a parte **pública**, que vai no app e no GitHub) e mostra a **chave privada** uma única vez no terminal, numa linha começando com `{`.
  2. Em `worker`: `wrangler secret put LICENSE_PRIVATE_JWK`; quando o terminal pedir, cole essa linha e dê Enter. Depois feche o terminal (ou limpe o histórico) para a chave não ficar na tela. Não salve a chave em nenhum arquivo.
  3. `wrangler secret put MP_ACCESS_TOKEN`: cole o **Access Token de produção** do Mercado Pago (passo 5).
  4. `wrangler secret put MP_WEBHOOK_SECRET`: cole a **Assinatura secreta** do webhook (passo 6).
- **Como verificar:** `wrangler secret list` mostra os três nomes (os valores nunca são exibidos).
- **Se a chave privada vazar ou você rodar `gen-keys.js` de novo:** gere outra, cadastre-a de novo com `wrangler secret put LICENSE_PRIVATE_JWK` e gere um APK novo com a nova chave pública. Os tokens antigos deixam de valer; o gratuito continua normal e o app renova o token na próxima conexão.
- **Atenção:** o `build` do app **recusa** um `config/license-public-key.json` com parte privada. Isso protege você de um erro.

## Passo 5. Criar a aplicação e obter as credenciais do Mercado Pago
- **Onde:** https://www.mercadopago.com.br/developers/panel/app (*Suas integrações*), logado na conta que vai receber os pagamentos.
- **O que criar:** *Criar aplicação* → um nome (ex.: TiaBete) → tipo de solução **Pagamentos online** → produto **Checkout Pro** (o Worker cria os pedidos pela **API de Orders**, `POST /v1/orders`; a API de Preferences, legado, não é mais usada). Os nomes dos botões podem mudar; siga o que o painel mostrar.
- **O que copiar:** em *Credenciais*, o **Access Token de produção** (formato `APP_USR-...`). Para testar sem dinheiro existem as *credenciais de teste* (formato `TEST-...`).
- **Onde colocar:** `wrangler secret put MP_ACCESS_TOKEN` (cole no terminal, nunca em arquivo).
- **Como verificar:** o painel mostra a aplicação com *Checkout Pro* ativo. Se a conta ainda não tiver identidade validada, o Mercado Pago pede isso antes de liberar produção.

## Passo 6. Cadastrar e testar o webhook
- **Onde:** na mesma aplicação, menu **Webhooks → Configurar notificações**.
- **O que preencher:** na aba **Modo produtivo**, URL `https://tiabete-license-api.SEU-SUBDOMINIO.workers.dev/v1/mp/webhook` (precisa ser HTTPS); evento **Order (Mercado Pago)** (tópico `orders`; não marque "Pagamentos", que é o tópico legado) **e também "Contestações"** (na documentação oficial, a contestação chega como `order.charged_back` no mesmo tópico de Orders); *Salvar configuração*. O painel gera a **Assinatura secreta**: copie e rode `wrangler secret put MP_WEBHOOK_SECRET`.
- **Como verificar:** no mesmo painel use **Simular**: escolha a URL, o evento Order e um *Data ID* qualquer, e *Enviar teste*. O Worker recusa com erro (4xx/5xx) um *Data ID* inventado, porque essa Order não existe: isso é normal. O que você confere é se a chamada chegou ao Worker: em outro terminal rode `wrangler tail` (na pasta `worker`) e veja a requisição aparecer. Um **200** vem de Orders reais.
- **Pagamentos de teste:** a documentação do Mercado Pago informa que pagamentos criados com credenciais de teste **não enviam notificações**. Por isso o app também confirma sozinho: ao tocar em *Atualizar situação*, o servidor consulta a Order direto na API (`GET /v1/orders/{id}`).
- **Teste real, barato:** deixe o preço em R$ 1,00 (`UPDATE config SET value='100' WHERE key='price_cents'`), compre você mesmo pelo app, confira a licença ativa, devolva o valor no painel do Mercado Pago (o reembolso deve tirar o premium) e volte o preço para `2990`.
- **Como funciona o Pix:** o pedido fica *payment_pending* até o Mercado Pago confirmar. Pendente nunca libera a licença.

## Passo 7. Configurar o endereço no app e gerar um APK de teste
- **Onde:** na pasta do projeto.
- **O que fazer:**
  1. Crie `config/license-api.txt` com **apenas** o endereço público, ex.: `https://tiabete-license-api.SEU-SUBDOMINIO.workers.dev` (sem barra no fim, sem caminho, sem token). O build ignora qualquer outra coisa.
  2. Confirme que `config/license-public-key.json` existe (gerado no passo 4) e vá para o GitHub (os dois arquivos são públicos e podem ser enviados).
  3. Gere o APK: **Actions → APK Android → Run workflow**, ou localmente `npm run android:debug`.
- **Como verificar:** instale o APK, entre com o Google; em *Mais → Perfil e configurações → Licença TiaBete* deve aparecer **Teste gratuito ativo** com os dias restantes. Sem internet, registre uma glicemia: deve funcionar. Com o teste vencido, as telas premium mostram o aviso e o resto segue normal.
- **Desenvolvimento:** `npm run build:web:dev` libera o premium **sem** servidor, só para testar visualmente. Nunca publique esse build (o terminal avisa).

---

## Sequência definitiva de comandos (depois de preencher o `wrangler.toml`)
> Só rode quando decidir publicar. Os passos marcados com ⚠ alteram a sua conta Cloudflare.
```bash
# na pasta worker
wrangler login                                                    # uma vez
wrangler d1 list                                                  # confere o UUID de tiabete-licenses
wrangler d1 migrations apply tiabete-licenses --remote            # ⚠ cria as tabelas no banco remoto
wrangler secret put LICENSE_PRIVATE_JWK                           # ⚠ (chave gerada por node worker/gen-keys.js)
wrangler secret put MP_ACCESS_TOKEN                               # ⚠
wrangler secret put MP_WEBHOOK_SECRET                             # ⚠
wrangler deploy                                                   # ⚠ publica o código em tiabete-license-api
```
Depois abra `SEU_ENDERECO/v1/health`: deve aparecer `{"ok":true}`.

## Publicar com a configuração local (valores reais fora do ZIP)
O `worker/wrangler.toml` do ZIP é só modelo (marcadores vazios) e **não deve ser preenchido**. Os valores reais ficam em `worker/wrangler.local.toml`, que está no `.gitignore` e nunca entra no ZIP de distribuição.
1. Na pasta `worker`: `cp wrangler.local.toml.example wrangler.local.toml` (Windows: `copy wrangler.local.toml.example wrangler.local.toml`).
2. Edite `wrangler.local.toml` e troque só os três marcadores: `database_id` (UUID do banco `tiabete-licenses`; `wrangler d1 list`), `GOOGLE_CLIENT_ID` (o de `config/google-client-id.txt`) e `PUBLIC_URL` (endereço do Worker, sem barra no fim). Mantenha `APP_RETURN`, o binding `DB`, `database_name` e `migrations_dir`.
3. Chaves: **não rode `gen-keys.js` de novo.** A chave privada já cadastrada continua no Cloudflare (`wrangler secret list --config wrangler.local.toml` mostra o nome) e a chave pública já está no app. Gerar outra invalidaria os tokens emitidos.
4. Comandos (na pasta `worker`; os marcados com ⚠ alteram sua conta Cloudflare):
```bash
npm test                                                                   # na raiz do projeto: testes (não usam a nuvem)
wrangler deploy --dry-run --config wrangler.local.toml                     # simula o empacotamento, não publica
wrangler d1 migrations list tiabete-licenses --remote --config wrangler.local.toml   # mostra o que falta aplicar
wrangler d1 migrations apply tiabete-licenses --remote --config wrangler.local.toml  # ⚠ aplica 0003_orders_api.sql (e as pendentes)
wrangler deploy --config wrangler.local.toml                               # ⚠ publica em tiabete-license-api
```
5. Ao montar um novo ZIP, exclua `worker/wrangler.local.toml` e `node_modules`. No seu computador, `npm test` reclama se o arquivo local existir (de propósito, para você notar); rode `TB_ALLOW_LOCAL=1 npm test` (Windows PowerShell: `$env:TB_ALLOW_LOCAL=1; npm test`).

## O que você pode fazer de graça
- Cloudflare: conta, Worker e D1 têm plano gratuito (limites diários generosos para um app deste tamanho; confira os valores atuais em https://developers.cloudflare.com/workers/platform/pricing/).
- Mercado Pago: criar conta, aplicação, credenciais de teste e cadastrar o webhook não têm custo. A taxa só é cobrada sobre cada venda real (consulte a tabela de tarifas atual no painel).
- Google: o login que o app já usa não tem custo.

## Segurança do servidor (o que já está implementado)
Segredos só como Worker Secrets · validação do ID token do Google (assinatura, emissor, público, validade, `sub`) · conta identificada pelo `sub` · webhook com assinatura HMAC-SHA256 comparada em tempo constante, anti-repetição e conferência da Order na API antes de ativar (pedido e id da Order gravados na criação, conta, valor e valor pago, BRL, status `processed`/`accredited`, pagamento não reutilizado, ainda não processado); `refunded` ou chargeback encerram o premium; `canceled` fecha o pedido · limites de frequência por IP, conta e aparelho · vaga de aparelho tomada de forma atômica no D1 · nenhuma rota administrativa pública · dados médicos nunca enviados.

## Contestações (chargebacks)
Fonte oficial: [Gerenciar contestações](https://www.mercadopago.com.br/developers/en/docs/checkout-pro-orders/chargebacks/manage), [Configurar notificações de contestações](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/chargebacks/notifications) e [GET /v1/chargebacks/{id}](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api/chargebacks/get-chargeback/get).
- A notificação chega como `type: order`, `action: order.charged_back`, `data.id` = id da Order, e é validada com o mesmo HMAC. O corpo **não** decide nada: o Worker consulta `GET /v1/orders/{id}` e, para cada `transactions.chargebacks[].case_id`, `GET /v1/chargebacks/{case_id}` (cabeçalhos `Authorization` e `X-Caller-Id` = `user_id` da Order, o vendedor).
- Estados no TiaBete (`orders.chargeback_state`): **open** (contestação com `coverage_applied` vazio): só registra na auditoria, a licença **não** é revogada · **lost** (`coverage_applied = false` ou Order `charged_back`): licença `revoked` · **won** (`coverage_applied = true`): licença mantida; se havia sido revogada por perda, só é restaurada se a Order voltou a `processed/accredited` com o pagamento original `processed`; senão fica registrado `chargeback_won_unconfirmed` para você conferir.
- A contestação só vale para a licença se o `payments[]` dela contém o pagamento do pedido; contestação de outro pagamento/pedido é ignorada. Falha na API de contestações responde 502 (o Mercado Pago reenvia) e **nada** muda.
- Notificação antiga: `last_updated_date` da Order mais antigo que o já aplicado é ignorado (`stale`); uma decisão `lost` não é desfeita por uma consulta "sem contestação".
- Pagamento relevante da Order: o que já ativou a licença; antes disso, só o único `processed` com valor pago igual ao preço (mais de um = ambíguo, não ativa). Reembolso de outro pagamento da mesma Order não derruba a licença.

### Correções finais (0.18.4)
- **Status oficial `charged_back`:** com a Order consultada na API em `charged_back` e **um pagamento inequívoco** (a Order tem um só pagamento, ou o pagamento que ativou a licença está marcado `charged_back`), a licença é revogada mesmo que a contestação não traga `transaction_id`, a lista venha em formato inesperado, haja mais de 5 casos ou `MP_SELLER_ID` divirja do `user_id`. Com vários pagamentos e nenhum confirmado como o contestado: *unverified*, licença intacta. Falha ao consultar a Order ou a contestação continua sendo *unverified*.
- **`MP_SELLER_ID`:** vazio = sem consulta de contestações (comportamento anterior). Preenchido e divergente do `user_id` da Order: não há chamada, e só vale o status oficial `charged_back`. O `user_id` **nunca** substitui `MP_SELLER_ID`.
- **Assinatura:** o manifesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (partes ausentes omitidas) está na [documentação de notificações de Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/optional-notifications?scope=prod). Essa página não diz se o `data.id` deve ir em minúsculas (regra que existia nas páginas de pagamentos) e os ids de Orders são em maiúsculas (`ORD01…`). Por isso o Worker aceita o `data.id` **como recebido ou em minúsculas**; ambas exigem o segredo. Que o mesmo manifesto valha para `order.charged_back` **não está confirmado** na documentação (a página de contestações só cita a assinatura secreta do aplicativo); o evento chega com `type: order` e passa pela mesma validação.
- **Ordem das migrations** (o Worker 0.18.4 exige as quatro): `0001_init.sql` → `0002_security.sql` → `0003_orders_api.sql` → `0004_chargebacks.sql`. A 0002 só depende das tabelas da 0001 (cria `webhook_log` e `rate_limits`). A 0003 e a 0004 só dependem da tabela `orders` da 0001 e são independentes entre si (0003 cria `mp_order_id` e índice; 0004 cria `chargeback_state` e `mp_updated_at`), mas o Worker precisa das duas. Com só 0001+0002 faltam essas três colunas. O `wrangler d1 migrations apply` aplica as pendentes em ordem e não repete as já aplicadas.

### Endurecimento (0.18.3)
- **Associação:** cada contestação da Order traz `transaction_id` (id do pagamento dentro da própria Order, conforme o exemplo oficial de `GET /v1/orders/{id}`). Só vale para o pagamento que ativou a licença se for igual a ele. Sem `transaction_id`, ou com id que não é pagamento da Order, o resultado é *unverified* (502, nada muda). Contestação de outro pagamento da mesma Order é ignorada. O campo `payments` da API de contestações não é usado (o exemplo oficial o mostra como `[ {} ]`).
- **Pagamento ausente ou ambíguo:** não associa nada. Pedido nunca ativado não tem licença a revogar; pedido ativado cujo pagamento sumiu da Order dá *unverified*.
- **`coverage_applied`:** `true` ganha, `false` perdida, `null` explícito em andamento. Campo ausente, texto, número ou objeto: *unverified*, nunca open nem lost.
- **`case_id` grande:** números de 15+ dígitos em `id`/`case_id` são lidos como texto antes do JSON (sem arredondar). Notação científica, decimal, negativo, vazio ou não numérico: *unverified*, sem consulta.
- **X-Caller-Id:** a documentação diz "ID do usuário autenticado (seller ID)" mas não diz onde obtê-lo, e não diz que o `user_id` da Order seja esse valor. Por isso o ID vem de `MP_SELLER_ID` (variável pública em `[vars]`; no arquivo local). Se a Order trouxer `user_id` diferente, não há chamada (*unverified*). Se `MP_SELLER_ID` estiver vazio ou inválido, **não há consulta**: vale só o status oficial da Order (`charged_back` com um único pagamento revoga; contestação com status `in_process` só é registrada; outro status: *unverified*).
- **Limite de casos:** até 5 por pagamento; acima disso, *unverified* (nenhuma decisão parcial). Se qualquer caso não puder ser verificado, nenhuma decisão é tomada.
- **Descoberta:** as contestações vêm só de `transactions.chargebacks` da Order consultada na API, nunca do corpo do webhook.

## Pendências de conferência
Lido na documentação oficial (Orders API): criação `POST /v1/orders` (type `online`, processing_mode `manual`, `total_amount` em texto, `X-Idempotency-Key`), resposta com `checkout_url`, `GET /v1/orders/{id}`, cancelamento, status `created`, `processing`, `action_required`, `processed/accredited`, `processed/partially_refunded`, `failed`, `refunded`, `canceled`, e webhook `order.*` com `x-signature` (`ts`, `v1`), `x-request-id` e `data.id`.

**Não confirmado nas páginas oficiais** (o texto do manifesto e a lista completa de ações não aparecem para a ferramenta de leitura): (1) o manifesto da assinatura para o tópico orders; o código usa `id:<data.id em minúsculas>;request-id:<x-request-id>;ts:<ts>;` (o mesmo formato dos webhooks anteriores, que o SDK oficial valida); (2) o formato exato dos campos `currency` e `transactions.payments[].paid_amount` na resposta real; (3) os valores possíveis de `status` do chargeback dentro da Order (só `settled` aparece no exemplo oficial; o código usa `coverage_applied` da API de contestações); (4) se o `id` em `chargebacks[].payments[]` é o mesmo `transactions.payments[].id` das Orders (a documentação não afirma; se forem diferentes, a contestação é ignorada e só vale o status oficial `charged_back` da Order); (5) o manifesto da assinatura para o evento de contestações (a página só diz que usa a mesma assinatura secreta do aplicativo); (6) se uma Order com contestação ganha volta para `processed`; sem isso a restauração fica em `chargeback_won_unconfirmed`. **Onde achar o ID do vendedor (`MP_SELLER_ID`):** a documentação não diz. Provavelmente é o número da sua conta Mercado Pago (o mesmo `user_id` que as Orders devolvem), mas confirme no painel antes de preencher; se estiver errado, o Mercado Pago recusa a consulta e o Worker não revoga nada. Valide com um pagamento de baixo valor feito por você antes de divulgar. Se algo divergir, o Worker recusa com segurança (nunca libera premium por engano) e *Atualizar situação* continua confirmando pela API.
