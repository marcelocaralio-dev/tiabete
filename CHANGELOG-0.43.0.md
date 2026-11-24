# Sair da conta Google (Prompt 55) e saudação animada da glicemia (Prompt 57)

## Sair da conta Google
- Seção **Conta Google** em Mais → Meu perfil (aberta por padrão), logo após "Dados da conta": avatar, nome, e-mail, situação e botão vermelho **Sair da conta Google** com ícone de saída (56 px de altura). Sem conta: mostra "Entrar com Google".
- O mesmo botão substitui o antigo, sem confirmação, do card do Google Drive (Cópia de segurança).
- Confirmação antes de sair (Cancelar / Sair da conta) explicando que nenhum dado é apagado.
- `disconnect()` em `native/drive.js`: revoga o token no Google (melhor esforço, limite de 6 s), apaga o token do cofre, limpa perfil e estado em memória, desliga a cópia programada, avisa `tb-auth: disconnected` (tela de entrada reaparece). Se o token local não puder ser apagado, nada muda e a pessoa é avisada. Toque duplo não duplica.
- Não toca em registros, histórico, alimentos, insulinas, medicamentos, configurações nem nas cópias do Drive.
- Arquivos: `native/drive.js`, `src/extras.js`, `src/conta.css` (novo). Teste: `tests/test47.js`; `tests/login-sim.py` atualizado.

## Saudação animada ao registrar glicemia
- `src/saudacao.js` + `src/saudacao.css` (novos). Dispara só depois de **nova** medição salva com sucesso (`saveRecord` e protocolo de hipoglicemia); editar não dispara.
- Camada central transparente (sem escurecer/desfocar, sem toque, sem botão), some sozinha em ~2,8 s; uma por vez (a nova substitui a anterior).
- Gota oficial do GLUXO (`GX_DROP`) igual nas três; linguagem das conquistas (rw-pop, rw-bounce, rw-ring, rw-shine, rw-crown, confete `rwFx`).
  - Abaixo: batimento calmo, anéis suaves, pontos que sobem, contorno tracejado.
  - Dentro: quique, brilho, selo ✓, confete verde.
  - Acima: a gota pousa e forma ondas calmas, contorno forte.
- Classificação pela faixa que o usuário configurou (`mtGoals(MT_CFG)`, Metas e referências; padrão 70–180). Frases sorteadas por grupo, sem repetir a anterior. Respeita movimento reduzido e os dois temas.
- Teste: `tests/test46.js`.
