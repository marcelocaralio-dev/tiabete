# TiaBete 0.19.6 — "Tomei agora" apagado e bloqueado

- Depois de registrar, o botão **Tomei agora** fica em **verde apagado** e bloqueado (não aceita toque), até a regra de cada insulina liberar:
  - **Rápidas (jejum, almoço, jantar):** liberam no dia seguinte, quando o app zera o dia. (O jantar continua exigindo a glicemia pré-jantar para registrar.)
  - **Basal:** libera quando faltar 1 hora ou menos para a próxima dose (quando o contador de 24 h muda para "Chegando a hora") ou passar das 24 h. Para registrar antes disso, use "Outro horário".
- Corrigir o horário continua possível em "Editar horário" / "Outro horário".

Alterados: `src/extras.js`, `src/buttons.css`, `package.json` (e tudo da 0.19.5: `src/buttons.js`).
