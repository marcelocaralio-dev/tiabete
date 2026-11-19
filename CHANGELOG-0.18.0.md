# 0.18.0 — Bolha de alertas em estilo de chat
- `src/alertcenter.js` + `src/acchat.css`: o painel da bolha virou uma lista de mensagens horizontais (bolhas de chat), cada uma com no máximo 2 linhas, ícone da categoria e hora.
- Controles em ícones (com tooltip e aria-label): lido, dispensar, histórico, marcar todos como lidos e **dispensar todos** (pede confirmação quando há mais de um alerta). Os botões originais de cada faixa (Feito, +10 min, Confirmar, Adiar, Registrar, Ver, Fazer cópia etc.) são os mesmos elementos, só trocados por ícones; continuam com a mesma ação.
- Dispensa individual e global usam o mesmo estado (dispensado + lido) e a mesma animação de saída. Avisos de confirmação rápidos (toasts) continuam aparecendo sozinhos como uma única bolha.
- Encaixe lateral: a bolha fica sempre na margem esquerda ou direita (só a altura é livre), com encaixe animado ao soltar e ao girar/redimensionar a tela; não fica mais sobre a barra de navegação. A área de descarte (arrastar para baixo para ocultar a bolha) foi mantida.
- Corrige a medição de posição com o zoom da interface (a bolha não alcançava a margem direita).
- Navegação "anterior/próximo" foi substituída pela lista (todos os alertas ficam visíveis). Modo convencional, histórico e estados não mudaram.
- Testes: `tests/acchat-sim.py`.
