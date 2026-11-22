# 0.35.0 · Migração do nome TiaBete para GLUXO

Só nomenclatura. Identidade visual, telas, cálculos, Premium, licenças, dados e integrações permanecem como estavam.

## O que mudou
- Todos os textos visíveis (telas, notificações, relatórios PDF/Excel, resumo para o médico, calendário .ics, mensagens do login, biometria, IA, licença, página de retorno do pagamento) agora dizem GLUXO.
- Arquivos exportados: `gluxo-backup-…`, `gluxo-medicoes-…`, `gluxo-relatorio-…`, `gluxo-resumo-consulta-…`, `gluxo-lembretes-…`.
- Novas cópias de segurança levam `app: "GLUXO"`. A restauração continua aceitando cópias antigas (`TiaBete`, `GlicoTrack`) e novas.
- Google Drive: a pasta nova é `GLUXO Backups`. Quem já tem a pasta `TiaBete Backups` continua usando a mesma pasta (achada pelo ID salvo ou pelo nome antigo); a lista mostra cópias com prefixo antigo e novo.
- Workflow do GitHub: `Compilar APK GLUXO`, arquivos `GLUXO.apk` e `GLUXO-debug.apk`.
- Nomes de arquivos de recursos: `assets/gluxo-*.svg` e `assets/notification/ic_stat_gluxo-*.png` (só o nome; imagens idênticas). O arquivo antigo pode ser apagado do repositório.
- Cache do PWA: `gluxo-pwa-…`; caches `tiabete-pwa-…` antigos são apagados na ativação.
- Variável de build `GLUXO_DEV` (a `TIABETE_DEV` continua funcionando).
- `package.json`, README, LEIA-ME, PRIVACY e documentação atualizados.

## Mantido de propósito (compatibilidade)
`app.tiabete.glicose` (applicationId, login Google, retorno do pagamento), Worker `tiabete-license-api`, banco D1 `tiabete-licenses`, endereço da API de licenças, repositório GitHub, chave de assinatura `tiabete.jks`, UID dos eventos de calendário. Detalhes em `docs/MIGRACAO-NOME-GLUXO.md`.

## Testes
`tests/test36.js` (novo) e hashes de `src/license.js` e `worker/src/index.js` em `test23`/`test24` atualizados de propósito (só mudaram textos). Regras de versão em `test34`/`test35` aceitam 0.35.
