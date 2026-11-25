# Correção do backup no Google Drive (0.48.0)

Escopo: botão "Sair da conta Google", comandos do Drive que ficavam em "Aguarde…", backup automático e "Ver cópias no Drive". Nenhum dado local, formato de backup, restauração, cálculo ou tela fora desse escopo foi alterado.

## Causas encontradas
1. **Botão desalinhado**: o recurso "Ler mais" (`src/readmore.js`) movia os textos explicativos longos para o fim do cartão, *depois* do botão "Sair da conta Google". O botão ficava no meio do texto e com espaçamento irregular.
2. **Carregamento infinito**: as chamadas ao Google não tinham limite de tempo (o caminho `fetch` não tinha nenhum; o nativo esperava até 3 min) e a leitura do cofre local (IndexedDB) não tratava transação abortada. Uma única chamada pendurada deixava `S.drv.busy` ligado para sempre: botões em "Aguarde…" e **o backup automático bloqueado** (`drvAuto` só roda com `busy` desligado). Além disso, o resultado de "Ver cópias" (vazio/erro) nunca era mostrado na tela, e erros de rede mostravam a mensagem "provedor de IA".
3. **Backup automático não enviava**: além do bloqueio acima, (a) qualquer erro 400/401 do Google apagava o login guardado, inclusive erro de configuração; (b) o envio era dado como concluído sem o Drive confirmar o arquivo; (c) ao ligar a chave, qualquer falha (até a temporária, ou outra operação em andamento) desligava a chave em silêncio; (d) nada reagia à conta Google ser restaurada/conectada, e a configuração restaurada na abertura só era usada depois do próximo gatilho.

## Correções
- Botão sempre por último no cartão (`.gx-out-wrap`), largura e espaçamento padronizados, testado em 360, 412 e 768 px.
- `native/ai-core.js`: `http()` aceita `timeout` (fetch e nativo) e erros de rede/tempo identificáveis; o cofre trata `onabort`.
- `native/drive.js`: toda chamada ao Google tem limite (30 s; envio 90 s), renovação de token em uma só chamada, o login só é apagado em `invalid_grant`, mensagens próprias do Drive, upload só vale com `id` confirmado, listagem traz data de criação e tamanho, aviso claro quando o login do Google não existe (versão web/PWA).
- `src/extras.js`: uma operação por vez com identificação e prazo geral (120 s); operação esquecida é descartada após 150 s; cliques repetidos ignorados; "Ver cópias" mostra lista real (nome, criação, tamanho, selo "mais recente"), estado vazio e erro com orientação para tentar de novo; consulta não cria pasta; backup automático dispara ao abrir, ao voltar ao app, ao conectar/restaurar a conta e a cada 15 min com o app aberto; não reenvia cópia idêntica à última (evita duplicar arquivos); falhas temporárias tentam de novo em 10 min; a chave só desliga sozinha por falta de conexão/permissão.
- `src/init.js`: restaura a impressão digital da última cópia e verifica o backup programado logo após carregar a configuração.
- Frequência e condições (intervalo escolhido, só com o app aberto) **não foram alteradas**. Estrutura do arquivo de backup, pasta `GLUXO Backups`/`TiaBete Backups`, restauração e cópias antigas: intactos; nenhuma cópia é apagada ou sobrescrita.

## Limitações
- O Android/PWA não permitem envio com o app fechado; a cópia programada continua dependendo de o app estar aberto.
- Entrar com o Google exige o aplicativo Android (retorno por esquema próprio); na versão web/PWA o app avisa e mantém "Exportar cópia".
- Testes com conta Google real e aparelho Android real não foram executados aqui (Google simulado).

## Arquivos
`native/ai-core.js`, `native/drive.js`, `src/extras.js`, `src/init.js`, `src/readmore.js`, `src/conta.css`, `package.json` (script de testes), `tests/test52.js` (novo), `CHANGELOG-0.48.0.md`.
