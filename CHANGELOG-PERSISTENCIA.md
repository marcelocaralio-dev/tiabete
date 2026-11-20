# Auditoria de persistência (configurações, tarefas e lembretes)

## Problemas encontrados (confirmados por teste no código anterior)
1. **Sincronizações de notificações rodavam antes de as configurações carregarem.** `loadAll()` dispara `hypoSync/postSync/caSync` e, 5 s depois da abertura, `remResync/planSync`, sempre com os valores PADRÃO. Eles cancelam e refazem agendamentos: lembretes do plano e alertas personalizados podiam ser apagados, e funções desligadas (reavaliação de hipoglicemia, "medir 2 h depois") reagendadas, ignorando o silêncio noturno salvo. Em aparelho lento (>5 s para abrir) o plano ficava sem alarmes até editar ou voltar ao app. *Teste no código antigo: falhou.*
2. **Banco que não abre em 4 s virava "instalação nova".** `Store.init` desistia e usava memória: configurações pareciam perdidas e novas gravações não ficavam salvas. Com o banco indisponível, as sincronizações nativas ainda **cancelavam** os agendamentos reais. *Teste no código antigo: falhou.*
3. **Gravação "relaxada" do IndexedDB** (padrão do Chrome): uma alteração feita pouco antes de reiniciar/forçar o encerramento podia não ir ao disco.
4. **Conexão do banco fechada pelo sistema** (pouca memória): as gravações seguintes falhavam em silêncio.
5. **Leitura de configurações com erro + gravação depois** podia sobrescrever o salvo com padrões.
6. **Ajustes só no `localStorage`** (visual do Início, período das Métricas, bloqueio por PIN, avisos de hipo/hiper dispensados, Prontidão) sem cópia durável.
7. **Escolhas de visualização** (período do painel, intervalo/agrupamento da análise, critério e janela dos rótulos) voltavam ao padrão a cada abertura.
8. **Cofre do aparelho (`tb-secure`):** chamadas simultâneas na primeira abertura podiam criar chaves mestras diferentes (o login Google/tokens ficariam ilegíveis); falha ao abrir ficava em cache para sempre.
9. **Permissão de notificações revogada:** o app não avisava, e ao voltar a permitir não refazia os lembretes sem abrir/editar.

## Correções
- `src/app.js` (Store): 3 tentativas de abertura (6/10/15 s), `durability: 'strict'` em toda gravação, reabertura automática da conexão e nova tentativa, `onversionchange` (atualização do app não trava), e **trava `metaOk`**: se as configurações não puderam ser lidas, nada em `meta` é gravado por cima.
- `src/init.js`: lê `meta` com novas tentativas antes de qualquer gravação, restaura a cópia de ajustes e só então libera `tbCfgReady()`.
- `src/persist.js` (novo): cópia durável (`meta` → `ls-mirror`) dos ajustes do localStorage e das escolhas de visualização; restaura só o que faltar (o que já existe no localStorage tem prioridade); grava ao sair (`visibilitychange`/`pagehide`).
- `native/native.js` e `native/insrem-native.js`: toda sincronização que cancela/refaz agendamentos só roda com configurações lidas **e** banco real aberto (`cfgOk`). `permWatch()` avisa uma vez por sessão quando a permissão é revogada e refaz tudo (ids fixos, sem duplicar) quando volta.
- `native/ai-core.js`: chave mestra única (promessa memorizada) e reabertura do cofre após falha.
- `scripts/build-web.js`: `persist.js` antes de `init.js`.

## Armazenamento por tipo
IndexedDB `glicotrack`/`meta` (configurações, tarefas, agendamentos; durável) · cópia `ls-mirror` (ajustes de localStorage) · localStorage (leitura rápida na abertura) · cofre `tb-secure` (tokens, cifrado) · agendador do Android via LocalNotifications (alarmes).

## Restaurado automaticamente
Lembretes diários, alarmes do Meu tratamento (inclusive semanais e troca de cateter), "medir 2 h depois", reavaliação de hipoglicemia, alertas personalizados e lembretes de insulina (já tinham assinatura anti-duplicação): reconferidos na abertura, ao voltar do segundo plano e quando a permissão volta. Após reiniciar o aparelho, o Capacitor restaura os alarmes e o app reconfere ao abrir.

## Testes (todos passaram)
`npm test` (21 arquivos, incluindo `test24`) + simulações em Chromium real (`tests/browser/persistencia.py`, `notificacoes.py`; rodar `npm run build:web` antes):
fechar/abrir com configurações · localStorage perdido (restaurado do banco) · prioridade do valor existente · 1ª abertura do banco falhando · conexão fechada · meta ilegível (não sobrescreve) · reabrir sem duplicar agendamentos · função desligada continua desligada · lembretes desativados continuam desativados · permissão revogada e devolvida · banco indisponível não cancela agendamentos. Os dois testes de notificação que falham no código anterior passam agora.

## Limites e pendências (honestos)
- **Não foi possível testar em aparelho Android real** (reinício físico, encerramento forçado pelo sistema, economia de bateria). Simulei esses cenários no navegador e com um plugin de notificações falso. Recomendo testar no aparelho.
- **Execução em segundo plano depende do Android/fabricante** (bateria, horários exatos); a persistência garante a configuração, não a entrega. Ver o diagnóstico de notificações no app.
- **Alarme de "apagar a notificação após 10 min" (TbExpire)** é do AlarmManager e não sobrevive a reinício; ao abrir, `postClean` remove as notificações vencidas. Corrigir de vez exige código Java novo (receptor de boot), que não pude compilar aqui.
- **Filtros de busca do Histórico** (texto, datas) continuam zerando ao abrir, de propósito, para não mostrar lista filtrada sem a pessoa lembrar.
- **Bolha (alert-center):** já tinha cópia em localStorage + meta e gravação ao sair; sem alteração. A permissão de sobreposição não é usada pelo app.
- **Módulo de licenciamento intacto** (arquivos idênticos, conferido por hash no `test24`); nenhuma leitura de dados de saúde via licença.

## Correção visual: card "Glicemia mais recente" com fundo verde
Causa: em `src/metricas.css` a regra genérica `.b-ok { background: var(--mt-ok) }` (feita para as barras da Central de Métricas) também atingia o card do Início, que usa a classe `b-ok` quando a glicemia está na faixa (o mesmo valria para `b-vlow` e `b-vhigh`). Correção: as regras agora valem só para `i.b-*` (as barras/legendas das métricas). Teste de regressão: `tests/test25.js`.
