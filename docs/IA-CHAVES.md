# Como ativar a IA no TiaBete (passo a passo)

A IA do TiaBete precisa de uma **chave** (uma senha de acesso) de um provedor de IA. O mesmo passo a passo aparece dentro do app, em **Mais → Inteligência artificial**.

## Qual escolher?
- **OpenRouter** – o mais fácil e tem modelos gratuitos (terminam em `:free`). Limite de uso por dia.
- **Claude (Anthropic)** ou **ChatGPT (OpenAI)** – mais estáveis; cobram por uso, com crédito pré-pago (centavos por consulta). A assinatura do Claude ou do ChatGPT não vale: a API é outra conta.
- **Gemini (Google)** – tem plano gratuito, mas pode falhar conforme a conta e a região, e o plano gratuito pode usar o conteúdo para melhorar produtos do Google.

## OpenRouter (gratuito)
1. Abra https://openrouter.ai/keys e entre com a conta Google.
2. Toque em **Create Key**, dê um nome (TiaBete) e **Create**.
3. Copie a chave (começa com `sk-or-`). Ela só aparece uma vez.
4. No app: **Mais → Inteligência artificial**, provedor **OpenRouter**, cole a chave em **Chave da API**.
5. Toque em **Carregar lista de modelos** e escolha um que termine em `:free`.
6. Marque a caixa de ciência, toque em **Salvar** e depois em **Testar conexão**.

## Google Gemini
1. Abra https://aistudio.google.com/apikey e entre com a conta Google.
2. **Criar chave de API**; copie a chave (começa com `AIza`).
3. No app: provedor **Google Gemini**, cole a chave, **Carregar lista de modelos**, escolha um modelo (de preferência com `flash`), ciência, **Salvar**, **Testar conexão**.

## Claude (Anthropic)
1. Abra https://console.anthropic.com/settings/keys e crie a conta.
2. Em **Plans & Billing**, adicione crédito.
3. **Create Key** e copie a chave (começa com `sk-ant-`).
4. No app: provedor **Claude (Anthropic)**, cole a chave (o modelo já vem preenchido), ciência, **Salvar**, **Testar conexão**.

## ChatGPT (OpenAI)
1. Abra https://platform.openai.com/api-keys e entre.
2. Em **Billing**, adicione crédito.
3. **Create new secret key** e copie (começa com `sk-`).
4. No app: provedor **ChatGPT (OpenAI)**, cole a chave, **Carregar lista de modelos**, escolha um modelo pequeno (`mini`), ciência, **Salvar**, **Testar conexão**.

## Dicas
- A chave fica guardada cifrada **só neste aparelho** e nunca entra em backups.
- Se der erro de "modelo não encontrado", toque em **Carregar lista de modelos** e escolha outro.
- Se der "sobrecarregado", espere uns minutos ou troque de modelo.
- Nunca compartilhe a chave. Se vazar, apague-a no site do provedor e crie outra.
