# TiaBete 0.4.0

## Implementado nesta atualização
- Novo perfil local com nome, tipo de diabetes, data de nascimento e imagem.
- Atalho circular para abrir o perfil na barra superior e acesso em Mais.
- Perfil salvo no IndexedDB e incluído no backup/restauração.
- Tipo de diabetes também editável em Esquemas de tratamento, sincronizado com o perfil local.
- Backup inclui sempre o estado do módulo de bolus, mesmo quando ainda não existem dias registrados.
- Restauração mescla alimentos, modelos de refeições, dias e registros de razão sem descartar dados já existentes; opção de substituição continua respeitando o modo escolhido.
- Registro histórico de carboidratos, unidades de insulina, refeição, glicemia pré/pós, tipo de insulina e observações para conversar com a equipe de saúde.
- Tutorial sobre razão insulina/carboidratos, com orientação para obter a razão com a equipe de saúde. O registro histórico não altera a razão configurada.
- Configuração de frequência do backup no Google Drive: 1, 7, 15 ou 30 dias, com 1 dia como padrão. A verificação ocorre quando o app é aberto.
- Mensagens de dependência da IA e atalho para sua configuração nos módulos de exames e bolus.
- Textos de exames atualizados para usar o termo IA em vez de Claude.

## Limitações conhecidas
- Perfil é local ao aparelho/navegador. Não há conta nem sincronização automática entre dispositivos.
- Backup automático do Drive depende de o app estar aberto e com conexão; PWA não garante execução diária em segundo plano.
- Notificações ainda usam os lembretes configurados manualmente. A sincronização automática com cada medicamento/insulina cadastrado em esquemas de tratamento permanece pendente.
- A definição e alteração de razão insulina/carboidratos e doses continuam sob responsabilidade da equipe de saúde.
- Os testes automatizados existentes passaram; ainda é necessário validar a interface, permissões e notificações em aparelho Android real.
