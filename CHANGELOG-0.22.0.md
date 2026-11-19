# 0.22.0 · Aprimoramento do Protocolo de Hipoglicemia
- Campo de glicemia (esquerda) e botão "Registrar agora" (direita), lado a lado, moderadamente maiores que os controles comuns.
- "Registrar agora" captura data e hora do instante do toque (fuso do aparelho); campos de horário manual do protocolo removidos. Toques repetidos não duplicam o registro.
- Cronômetro regressivo de 15:00 em destaque, calculado pela hora real da última medição (sobrevive a minimizar, bloquear, fechar e reabrir). Reinicia a cada medição abaixo de 70; para com 70 ou mais.
- Ao zerar: alerta visual, som e vibração (quando permitido), mensagem "Hora de medir novamente sua glicemia!", campo e botão destacados; um único alerta por contagem, inclusive ao voltar ao app.
- O card permanece aberto após cada registro, com confirmação visual e histórico numerado do episódio.
- Protocolo abre sozinho para glicemia abaixo de 70 (antes: só até 60; 61 a 69 apenas registrava). Valor novo sem horário, de hoje, usa a hora do toque.
- Aviso de emergência reforçado: não esperar o cronômetro.
