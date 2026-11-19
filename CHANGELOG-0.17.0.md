# 0.17.0 — Lembretes de insulina (PROMPT 22)
Novo sistema de lembretes de aplicação de insulina (basal e rápida), com notificações nativas no Android.

## Arquivos novos
- `src/insrem-core.js`: lógica pura (agenda, ids estáveis, reconciliação com Meu tratamento, avisos). Testes: `tests/test8.js`.
- `src/insrem.js` / `src/insrem.css`: tela "Lembretes de insulina" (menu: Tratamento e insulina), card em Meu tratamento, editor, aviso no Início, menu de resposta.
- `native/insrem-native.js`: agendamento no Android (LocalNotifications), botões da notificação, status e atalhos de configuração.
- `scripts/patch-android.js`: plugin `TbSettings` (abrir configurações de notificações, alarmes exatos e bateria; informar se estão liberadas) e permissão VIBRATE.
- `tests/insrem-sim.py`: simulação do APK (Capacitor falso) e da versão web.

## Comportamento
- Lembretes usam as insulinas de **Meu tratamento** (sem cadastro duplicado). Tipo (basal/rápida) segue o cadastro. Nunca altera dose, horário ou prescrição.
- Campos: insulina, tipo, refeição, horário, dias da semana (todos, úteis, fins de semana, personalizado), liga/desliga individual, chave geral.
- Criar a partir do tratamento: botão "Criar" por insulina ou "Criar todos". Novos horários no tratamento só são oferecidos, nunca criados sozinhos.
- Horário do tratamento mudou: o lembrete ligado a ele acompanha. Insulina removida ou horário que sumiu: lembrete desativado com aviso. Alarme da insulina desligado no tratamento: não toca.
- Insulinas com lembrete próprio deixam de ter o alarme genérico antigo (sem notificação duplicada).
- Notificação: "Hora da insulina basal" / "Hora da insulina rápida", com nome, tipo e horário; botões **Já apliquei**, **Adiar**, **Abrir tratamento**. Tocar no corpo abre o menu: confirmar, adiar 5/10/15 min, ignorar.
- **Confirmar** grava no histórico só "aplicação confirmada" (insulina, data, hora), sem dose. Abrir, adiar ou ignorar não registram nada. Confirmar duas vezes não duplica.
- Ids estáveis + assinatura: sincronizar de novo não duplica. Refaz ao abrir, voltar do segundo plano, mudar o tratamento ou mudar o fuso/horário de verão.
- Indicador de situação (autorizado / bloqueado), botão para abrir configurações do aparelho, alarmes exatos e bateria.
- Backup inclui os lembretes.

## Limitações (informadas no app)
- Navegador/PWA sem servidor não agenda notificações com o app fechado: só aviso com o app aberto.
- Mudança de fuso com o app fechado: horários são refeitos na próxima abertura. Fabricantes com economia de bateria agressiva podem atrasar avisos.
- O código Java do plugin e o comportamento real das notificações não foram compilados/testados em aparelho neste ambiente (sem Android SDK/rede); a lógica foi validada por testes e simulação.
