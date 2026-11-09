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
