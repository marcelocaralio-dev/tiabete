# TiaBete 0.19.0 — Central "Meu tratamento" e roleta de insulina

## Meu tratamento (dentro de Meu perfil)
- Meu perfil → **Meu tratamento** abre a central (rota `esquemas`, agora com "voltar" para o Perfil).
- Seções: Diabetes · Como você trata · Insulinas · Medicamentos · Bomba · **Outros tratamentos** (novo, lista simples sem alarmes) · Medições programadas · Configurações do tratamento · Histórico do tratamento · Esquemas anteriores e comparação.
- **Tipo de diabetes**: tipo 1 (1A autoimune, 1B idiopático), tipo 2, gestacional, outros específicos (MODY, LADA, neonatal, doenças do pâncreas, induzido por medicamentos/substâncias, genético/outras condições) e, em categoria separada, **diabetes insípido** (central, nefrogênico, dipsogênico, gestacional) com aviso de que não é diabetes mellitus. Subtipo opcional ("não confirmado") e observação livre. O campo antigo `type` continua sendo preenchido, então modelos de tratamento, relatórios e dados antigos seguem iguais.
- Os dois seletores de tipo antigos (Perfil e tratamento) viraram um só.
- "Remédios" passou a "Medicamentos".
- **Alertas separados**: o resumo de Lembretes de insulina e os Lembretes do tratamento saíram da central e ficam em Alertas e lembretes (mesmos cartões, mesmos dados e chaves).

## Início
- O cartão Meu tratamento ganhou um resumo compacto: só o que está cadastrado (diabetes, insulinas, medicamentos, outros). Termina em **EDITAR MEU TRATAMENTO** → Meu perfil → Meu tratamento. Chaves e botões do dia continuam.

## Roleta de insulina (UI)
- Componente único (`src/uipicker.js/.css`): roleta vertical, valor central grande, vizinhos esmaecidos, duas linhas, rolagem suave com encaixe, toque/arrastar/teclado/mouse. Cores do app.
- Usada em: registro de medição (rápida/basal/correção), cartões de insulina do Início (basal e rápidas), registrar dose passada, editar aplicação, aplicação extra, dose por aplicação de cada insulina cadastrada, registro de dose e refeição (bolus). Não foi aplicada a mg/ml/comprimidos.
- **0 a 60 Ui** por aplicação; máximo (5–300) e passo (1 ou 0,5) em Mais → Configurações → Roleta de insulina. Nada de 60 fixo no código.
- Valores antigos (frações, acima do limite) aparecem exatos e não são arredondados. Zero = campo vazio, como antes.
- A roleta só preenche o campo; não muda doses prescritas nem regras do bolus.

## Arquivos
Novos: `src/uipicker.js`, `src/uipicker.css`. Alterados: `src/app.js`, `src/extras.js`, `src/plan.js`, `src/bolus.js`, `src/painel2.js`, `src/drawer.js`, `src/init.js`, `scripts/build-web.js` (só registra os arquivos novos; `K = 1.29` intacto), `package.json`.
