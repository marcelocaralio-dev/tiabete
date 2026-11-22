# 0.34.0 · PROMPT 53 · Teste Premium protegido contra reinstalação e limpeza de dados
- Plugin nativo `TbDevice` (ANDROID_ID, API oficial). O servidor guarda só o HMAC (segredo `DEVICE_HMAC_KEY`) em `trial_devices` (migration 0006).
- Reinstalar ou limpar dados não gera teste novo: o início original do aparelho é preservado (válido ou vencido).
- Removido o teste provisório offline (era renovável): sem conexão não há Premium, o gratuito segue normal.
- Conta, `/v1/refresh`, instalação e aparelho sempre convergem para o início mais antigo.
- PRIVACY.md atualizado (LGPD). Detalhes: docs/PROTECAO-TESTE-ANDROID-ID.md
