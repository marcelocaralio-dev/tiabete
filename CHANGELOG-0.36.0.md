# 0.36.0 · Identificação visual dos recursos Premium após o teste

Só apresentação. O sistema de licenciamento (`license.js`, `licensecore.js`, Worker, banco, preços, teste de 14 dias) **não foi alterado**.

## O que mudou
- **Selo PREMIUM (cadeado + rótulo)** nos pontos de acesso dos recursos Premium: cartões do menu Mais, menu lateral, aba Análise (só o cadeado, sem mudar a largura da aba), botão "Gerar PDF" e demais botões/links que levam a recurso Premium.
- **Janela explicativa** ao tocar num recurso bloqueado: diz que o recurso faz parte do Premium, o motivo (teste encerrado, licença não ativa, pagamento pendente ou validação vencida sem internet), o que continua gratuito, e leva à tela da licença vitalícia ("Ver licença vitalícia") ou fecha ("Agora não"). Não cria cobrança nem tela comercial nova.
- Os recursos **continuam visíveis**; nada some da interface.
- **Atualização automática**: ao comprar a licença, ao restaurar a validação, ao voltar ao app ou quando o teste termina com o app aberto, selos e telas se atualizam sozinhos (sem fechar e abrir).

## Quando aparece
Só com licenciamento configurado, token assinado guardado (o teste realmente começou), fora do teste ativo e sem licença válida. A decisão é sempre `licAllowed(recurso)` + `LIC_PREMIUM`.
- Durante os 14 dias: nenhum selo. Com licença vitalícia válida: nenhum selo, cadeado ou aviso.
- Falha de rede não apaga nem invalida nada (regra já existente do licenciamento, preservada).
- A Central de Métricas mantém a identificação Premium própria que já tinha (sem duplicar).

## Segurança e classificação
- `LIC_PREMIUM` continua sendo a única referência de quais recursos são Premium. Fora dela = gratuito = sem selo. Recurso novo não ganha selo por inferência (precisa de mapeamento explícito de rota).
- O selo **não é** mecanismo de segurança: o bloqueio segue nos portões existentes.
- Correção de segurança: "Enviar relatório do período (PDF)" (compartilhar) não passava pela verificação de licença do PDF; agora `makePDF()` usa a mesma `licAllowed('rel-pdf')` do botão "Gerar PDF". Excel e CSV continuam gratuitos.
- Gratuitos intactos: registrar glicemia e insulina, histórico, exportar os próprios dados.

## Arquivos
Novos: `src/premiumlock.js`, `src/premiumlock.css`, `tests/test37.js`, este arquivo.
Alterados: `scripts/build-web.js` (inclui o módulo e o CSS), `src/report.js` (portão do PDF), `package.json` (0.36.0 e test37), `tests/test34.js` e `tests/test35.js` (regra de versão aceita 0.36).

## Testes
`tests/test37.js` (Chromium, `license.js` real, tokens ECDSA assinados): teste ativo, teste encerrado, licença vitalícia, compra após o vencimento (desbloqueio sem reabrir), fechar e reabrir, queda de rede/erro 500, validação vitalícia vencida, virada do teste com o app aberto, classificação centralizada. Suíte completa passa.
