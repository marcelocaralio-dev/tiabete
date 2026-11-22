# Migração do nome TiaBete para GLUXO (0.35.0)

## Números
- Referências ao nome antigo encontradas (texto, 71 arquivos): **284**.
- Substituídas: **180** (em 49 arquivos de código, configuração e documentação) mais **8 arquivos** de recursos renomeados (3 SVG e 5 PNG de notificação, só o nome).
- Restantes: **104**, todas classificadas abaixo.

## Restantes por classe
| Classe | Qtd | Motivo |
|---|---|---|
| Históricos (`CHANGELOG-*.md`, 14 arquivos) | 16 | Registro do passado: não se reescreve. |
| Backup do Worker (`worker/src/index.js.backup`) | 7 | Cópia antiga sem uso; mantida intacta. |
| Endereço da API (`config/license-api.txt`) | 1 | URL real em produção. |
| `app.tiabete.glicose` (capacitor, drive.js, patch-android, worker, docs, testes) | 27 | applicationId e esquema de retorno do login/pagamento. Mudar quebra Google, pagamento e atualização do app instalado. |
| Worker `tiabete-license-api` e D1 `tiabete-licenses` (wrangler, docs, testes) | 41 | Recursos reais já criados na Cloudflare. Renomear cria outro banco e perde licenças. |
| Chave de assinatura `tiabete.jks` e alias (docs/ASSINATURA) | 5 | Trocar impede atualizar o app já instalado. |
| Repositório GitHub (`logic.js`, docs) | 2 | URL do repositório. |
| UID do calendário (`extras.js`) | 2 | Reexportar atualiza os eventos já criados, sem duplicar. |
| Compatibilidade de dados (`app.js`, `extras.js`, `build-pwa.js`, `build-web.js`) | 4 | Restaurar cópias antigas, achar a pasta antiga do Drive, apagar cache antigo, variável antiga. |
| Relatórios históricos (`docs/AUDITORIA-GLUXO.md`, `docs/RELATORIO-ALTERACOES-GLUXO.md`) | 2 | Descrevem a etapa anterior (com aviso). |
| **Visíveis ao usuário** | **0** | |

## Pendências fora do código
- Pasta `TiaBete Backups` no Google Drive de quem já tem cópias: continua em uso (renomear é opcional, pelo próprio Drive).
- Eventos de calendário já criados mostram o título antigo até o usuário reexportar o .ics.
- Tela de consentimento OAuth no Google Cloud: o nome do app lá é editado no console, não no código.
- Apagar do repositório (opcional) `assets/tiabete-*.svg` e `assets/notification/ic_stat_tiabete-*.png`.
