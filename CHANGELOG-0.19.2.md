# TiaBete 0.19.2 — Insulinas do Início

- As três insulinas rápidas (Jejum, Antes do almoço, Antes do jantar) agora têm o mesmo formato da basal: um cartão cada, roleta de Ui + botão na mesma linha e, logo abaixo, os botões menores (Outro horário / Pular hoje; na basal, também Parar lembrete) todos numa linha só.
- As chaves (interruptores) foram removidas. O botão de todas as insulinas agora se chama **Tomei agora**.
- Depois de tocar em Tomei agora, o cartão inteiro fica **verde** (borda do cartão, borda do retângulo da roleta, linhas, "UI", botão e bordas dos botões menores) e continua assim até o fim do dia; no dia seguinte volta ao vermelho.
- Regras mantidas: o jantar continua bloqueado até a glicemia pré-jantar atingir o limite, a basal pede confirmação ao registrar de novo, "Pular hoje/Pular tudo hoje", horário editável, unidades memorizadas e histórico. Textos que falavam em "chave" foram ajustados.

Alterados: `src/extras.js`, `src/uipicker.css`, `package.json`.
