# Política de privacidade do TiaBete

**Resumo: o TiaBete não coleta, não envia e não vende nenhum dado seu.**

## Onde ficam os dados
Medições, insulina, exames, alimentos, preferências e demais informações ficam **apenas no armazenamento local do seu aparelho** (banco de dados do app). Não existe conta, servidor do projeto, análise de uso, rastreadores ou anúncios.

## O que o app não faz
- Não usa a internet para enviar seus dados.
- Não pede nem guarda sua localização.
- Não pede acesso a contatos, câmera ou microfone.
- O backup automático do Android/Google está **desativado** para o app, para que dados de saúde não saiam do aparelho sem você decidir.

## Permissões
- **Notificações:** só para lembretes e avisos que você ativar em Mais → Alertas e notificações.
- **Compartilhar arquivos:** quando você exporta backup, PDF, Excel ou CSV, o Android abre a tela de compartilhamento e **você** escolhe o destino.

## Seus arquivos de backup
Os arquivos que você exporta contêm seus dados de saúde sem criptografia. Guarde-os em local seguro e pense antes de enviá-los a terceiros ou a serviços na nuvem.

## Apagar tudo
Desinstalar o app ou limpar os dados dele nas configurações do Android remove todas as informações do aparelho. Backups exportados por você continuam existindo onde foram salvos.

## Crianças
O app não tem recursos voltados a crianças nem coleta dados. Responsáveis devem acompanhar o uso e o tratamento com a equipe de saúde.

## Mudanças
Alterações nesta política aparecem neste arquivo, com a data da versão. Última atualização: novembro de 2026.


## Recursos opcionais (desligados até você configurar)

**IA com chave própria (Mais → Inteligência artificial).** Quando você usa a análise de exames, as perguntas sobre os registros ou o cálculo de carboidratos, o conteúdo necessário é enviado **direto do aparelho ao provedor que você escolheu** (Anthropic, OpenAI, Google, OpenRouter ou outro). O TiaBete não tem servidor e não recebe esses dados. A chave da API fica cifrada no aparelho (WebCrypto, chave não exportável), fora de backups e relatórios. Só são aceitos endereços https://. Cada provedor tem sua própria política de dados; em planos gratuitos alguns usam o conteúdo para melhorar produtos.

**Backup no Google Drive (Mais → Backup e dados).** Login Google (OAuth com PKCE) com a permissão `drive.file`: o app só acessa os arquivos que criou, na pasta "TiaBete Backups" do **seu** Drive. O token fica cifrado no aparelho. Nada é enviado sem você conectar a conta; o backup automático só roda se você ligar.

## Licença e teste gratuito (0.34.0)
Para conceder o teste de 14 dias uma única vez por aparelho (com ou sem conta Google), o servidor de licença guarda: um identificador aleatório da instalação, o hash de um segredo aleatório, as datas UTC de início e fim do teste e um **identificador pseudonimizado do aparelho**.

- **Como é feito:** o app lê o `ANDROID_ID` pela API oficial do Android e o envia por HTTPS. No servidor ele é transformado em HMAC-SHA256 com um segredo que só o servidor conhece, e o valor original é descartado: não é gravado no banco, em logs, em mensagens de erro nem devolvido ao app. O app também não o guarda nem o mostra.
- **Para que serve:** somente reconhecer que este aparelho já recebeu o teste (prevenção a abuso). Não é senha, não autentica ninguém e não é usado para publicidade, rastreamento ou perfil.
- **Base legal (LGPD, art. 7º, IX):** legítimo interesse do desenvolvedor em evitar o uso repetido do teste gratuito, com coleta mínima e pseudonimização. O texto da política deve ser conferido por quem responde pelo app.
- **O que não é coletado:** MAC, IMEI, número de série, e-mail (sem login), localização e qualquer dado de saúde. Os dados de saúde nunca saem do aparelho, a não ser pelas cópias que você pede.
- **Limites:** o `ANDROID_ID` muda após restauração de fábrica, em outro perfil de usuário no mesmo aparelho e se a chave de assinatura do APK mudar. Quem muda de aparelho recebe um novo identificador.
- **Retenção:** o registro do aparelho é mantido enquanto o serviço existir, porque apagá-lo reabriria o teste. Para pedir a exclusão, fale com o desenvolvedor (Marcelo Gomes Chaves).
Detalhes técnicos em `docs/PROTECAO-TESTE-ANDROID-ID.md`.
