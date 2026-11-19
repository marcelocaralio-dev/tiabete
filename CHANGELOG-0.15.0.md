# 0.15.0 · Botões padronizados (Prompt 21)

## Padrão visual (src/buttons.css + src/buttons.js)
- **Normal:** contorno vermelho sobre o preto (botão principal segue vermelho cheio). Parece clicável.
- **Ao tocar/pressionar:** a cor muda na hora (escurece para o vinho) e o botão encolhe até 96 % (linhas e cartões 98,5 %).
- **Depois do clique:** brilho curto de confirmação (~0,6 s) e volta ao normal sozinho.
- Vale para todo `<button>`, títulos que abrem/fecham, chips e linhas de lista. Usa as variáveis do tema, então acompanha o tema claro e as cores da tela de medição.
- Movimento reduzido: as cores mudam igual, sem animar nem encolher.
- O "hover" só vale com mouse; no celular não fica grudado depois do toque.
- `buttons.js` só liga/desliga as classes `is-press` e `is-hit`; não atrasa nem troca nenhuma ação.

## Correções de funcionamento
- **Android:** "Dispensar" do aviso de lembrete na tela Início desligava TODOS os lembretes. Agora só esconde o aviso.
- **Perguntar** com o campo vazio não fazia nada: agora avisa "Escreva sua pergunta." e foca o campo.
- **Limpar filtros** (Histórico) ganhou retorno: "Filtros limpos." ou "Nenhum filtro ativo.".
- **Adicionar alimento** (bolus) sem alimento cadastrado não fazia nada: agora avisa.

## Textos de botões mais curtos
Apagar tudo · Abrir ajustes de biometria · Apagar meu perfil · Continuar sem conta · Testar aviso em 10 segundos · Enviar resumo para a consulta (PDF) · Enviar relatório do período (PDF) · Copiar texto · Juntar aos meus dados · Ver cópias no Drive · Proteger dados no aparelho · Etiquetar pelo horário · Fazer cópia antes.

## Arquivos
Novos: `src/buttons.css`, `src/buttons.js`. Alterados: `scripts/build-web.js`, `src/style.css` (hover só com mouse), `src/neon.css`, `src/glucoform.css` (transições), `src/app.js`, `src/extras.js`, `src/bolus.js`, `src/secure.js`, `native/native.js`, `native/login.js`, `package.json`.
