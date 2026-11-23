# 0.38.0 · Auditoria e unificação do sistema de alertas

Relatório técnico da auditoria de alertas e notificações. Tudo abaixo foi verificado em navegador real (`tests/browser/alertas-sync.py`, 30 verificações) e em teste puro (`tests/test39.js`, 24 verificações).

## 1. Fontes de alertas identificadas
| Fonte | Configuração | Estado | Bolha | Nativo (Android) |
|---|---|---|---|---|
| Lembretes de insulina (`insrem`) | meta `ins-rem` | `S.ir.state` (gravado) | `irBanner` | notificações semanais |
| Alarmes do Meu tratamento (insulina, remédios, medição, bomba) | meta `plan` + chave "plan" | `S.planDone` (**só em memória**) | `planBanner` | `planSync` |
| Basal "24 h" | chave `bBasal` | derivado de `S.ins.basalTs` | `basalBanner` | — |
| Pré‑jantar, medição pendente, hipo/hiper, backup, conquistas | chaves de Alertas | derivado / `S.remOff` (**só em memória**) | banners | parte |
| Alertas personalizados (`ca`) | meta `custom-alerts` | `S.ca.state` | `caBanner` | `caNativeSync` |
| Lembretes de horário (diários, inclui basal) | meta `rem-active` | — | — | só nativo |

## 2–5. Inconsistências, causa‑raiz e duplicidades
1. **Causa‑raiz do bug principal.** O "feito" de um alerta vivia separado do fato "dose aplicada". Registrar em Meu tratamento gravava o histórico e `S.ins.basalTs`, mas nada avisava o alerta (`irDue` só olhava `S.ir.state`). Ao confirmar pela bolha, `irConfirm` só checava duplicidade para refeições (`kind !== 'basal' && kind !== 'extra'`), então basal e "outra insulina" geravam **segundo registro**. Além disso a checagem acontecia antes de um `await`, então dois toques rápidos também duplicavam (condição de corrida).
2. **"Feito" do alarme do tratamento não registrava nem era lido por Meu tratamento** (só escondia o aviso).
3. **`S.planDone` e `S.remOff` não eram gravados**: reiniciar o app trazia de volta avisos já concluídos/dispensados.
4. **Alertas desativados/concluídos "na bolha"**: a lista da bolha (`acList`) mostrava também itens **inativos** (histórico) como se fossem avisos, e a contagem de não lidos os incluía. Ao desligar um lembrete, apagar, mudar o horário ou concluir, o item ficava lá.
5. **Identidade fraca**: chave da ocorrência = `dia|idLembrete` (sem horário) e, na bolha, `fonte|texto` (sem dia). Mudar o horário herdava o "feito" do horário antigo.
6. **Cobertura por insulina inteira**: ao criar um lembrete de insulina para um horário, **todos** os alarmes do tratamento daquela insulina sumiam, inclusive horários sem lembrete (ficavam sem aviso algum).
7. **Aviso duplicado**: o aviso genérico "24 h desde a última basal" aparecia junto com o lembrete/alarme da própria basal.
8. **Sincronização nativa descartava mudanças** (`planBusy`/`caBusy` simplesmente retornavam), deixando agendamentos com estado antigo.
9. **"Outro horário"** da rápida apagava e recriava o registro (perdendo o vínculo) em vez de editar o original.

## 6–8. Arquitetura, sincronização e histórico
- **Novo `src/alertstate-core.js`** (puro): estados (programado, pendente, exibido, concluído, ignorado, cancelado, desativado, expirado), transições (final não volta; única exceção explícita: o usuário apaga o registro que concluía o alerta), identidade de ocorrência (`ir:dia|lembrete@HH:MM`, `pl:dia|item@HH:MM`) e `ocMatchLogs`, que liga ocorrências ao histórico (vínculo explícito `occ`; refeição = registro do tipo no dia; basal/outra = registro mais próximo em [−4 h, +3 h], sem reutilizar o mesmo registro e sem usar só o nome).
- **Fonte única de verdade**: a dose vive só em `S.inslog`; o estado explícito fica com a fonte do aviso e é gravado; o estado de cada item da bolha é **calculado** por resolvedores (`irOccStatus`, `plOccStatus`, `caOccStatus`). Registrar por Meu tratamento, bolha, faixa, notificação ou histórico é a mesma ação lógica.
- `doseConfirm` + `logAdd(…, occ)`: caminho único e **idempotente** para registrar a partir de um aviso (trava contra toques simultâneos; segundo pedido devolve o registro existente). Registros criados por aviso guardam `occ`, `rem`, `sched`.
- `irDue`/`plPending` descontam o que o histórico já mostra como aplicado; "Feito" numa insulina do tratamento agora registra a aplicação (1 registro, sem dose preenchida, como já era no lembrete).
- Apagar o registro desfaz a conclusão do aviso (`alUndoOcc`); editar mantém o mesmo registro (inclusive "Outro horário").
- Chave de estado inclui o horário; chaves antigas são migradas na leitura. Horário alterado = nova ocorrência; a antiga fica **Cancelada**.
- Cobertura por **horário** (não por insulina inteira).
- Bolha: lista só alertas ativos (+ confirmações); concluídos/cancelados/desativados/expirados vão só ao Histórico de alertas, com o estado escrito. Item final não reaparece; alerta com ocorrência mantém um item por ocorrência. A sincronização só roda depois de as configurações serem lidas (evita cancelar tudo ao abrir).
- `S.planDone`/`S.remOff` agora gravados (meta `alert-day`).
- Observador único (`alKick`): qualquer gravação em histórico de insulinas, tratamento, lembretes, alertas e configurações atualiza a bolha e os agendamentos na hora.
- Nativo: `planSync`/`caNativeSync` não descartam mais mudanças concorrentes.
- Visual da bolha, marca e telas: **inalterados**.

## 9. Resultado dos cenários (navegador real)
A registro em Meu tratamento ✔ · B registro pela bolha (botão real) ✔ · C desativado (inclui reinício e chave geral) ✔ · D mudança de horário (lembrete e alarme) ✔ · E duplicidade (reconfirmar, toques simultâneos, "Feito") ✔ · F recorrência ✔ · G reinício/persistência ✔. Linha de base na versão original: 3 falhas reproduzindo o relato (alerta continuava pendente e a confirmação criou 2º registro).

## 10. Pendências / limites conhecidos
- **Notificação do Android de uma dose registrada ANTES do horário** ainda toca (alarmes semanais repetidos não permitem pular uma única ocorrência sem reescrever a repetição, e isso não pôde ser validado em aparelho). Tocar nela ou em "Já apliquei" não duplica nada e a bolha não a mostra.
- "Lembretes de horário" (diários, inclui basal) continuam uma configuração independente só nativa; não foi unificada para não remover funcionalidade.
- Registros duplicados que já existam no histórico **não foram apagados nem alterados** (preservação). Os novos não são mais criados.
- Os testes de navegador usam o relógio real (horário = agora − 10 min); não rodar colado à meia‑noite.
- Verificação em aparelho Android real não foi feita neste ambiente.

## Arquivos
Novos: `src/alertstate-core.js`, `tests/test39.js`, `tests/browser/alertas-sync.py`, este arquivo.
Alterados: `src/insrem-core.js`, `src/insrem.js`, `src/plan.js`, `src/alertcenter.js`, `src/alertas.js`, `src/extras.js`, `src/inicio.js`, `src/init.js`, `native/native.js`, `scripts/build-web.js`, `package.json` (0.38.0), `tests/test8.js`, `tests/test21.js`.
