/* ================= GLUXO Experience · Central de personalização (dados) =================
   Só texto e registro: categorias, descrição de cada recurso, legenda de cada opção, efeito de cada escolha e prévias ilustrativas.
   As preferências continuam no MESMO registro (GX_F, chave 'tb-gx'): nada aqui cria ou move dados. A lógica fica em gxhub.js.
   Novos recursos de Análise (an_*): cada chave mostra ou oculta uma seção real da tela Análise; os dados e os cálculos não mudam. */
const GXH_ON = (t, s) => [true, t, s || ''];
GX_F.an_hor = { t: 'Dados · Análise por horários', o: { on: GXH_ON('Ativar análise por horários') } };
GX_F.an_ref = { t: 'Dados · Análise por refeições', o: { on: GXH_ON('Ativar análise por refeições') } };
GX_F.an_pad = { t: 'Dados · Recorrência de eventos', o: { on: GXH_ON('Ativar recorrência de eventos') } };
GX_F.an_comp = { t: 'Dados · Comparação entre períodos', o: { on: GXH_ON('Ativar comparação entre períodos') } };
GX_F.an_ass = { t: 'Dados · Correlação entre variáveis', o: { on: GXH_ON('Ativar correlação entre variáveis') } };
GX_F.an_desc = { t: 'Dados · Central de descobertas', o: { on: GXH_ON('Ativar a central de descobertas') } };

/* categorias (ordem dos recursos = ordem na tela) */
const GXH_CATS = {
  A: { r: 'gxvis', t: 'Experiência visual', ic: 'eye', d: 'Animações, transições, avisos, vibração e indicadores de progresso: como o GLUXO se move e responde.', fs: ['vis_motion', 'vis_skel', 'vis_micro', 'vis_trans', 'vis_fb', 'vis_hap', 'vis_prog', 'org_home'] },
  B: { r: 'gxdados', t: 'Inteligência dos dados', ic: 'chart', d: 'Análises por horário e refeição, recorrência, comparação, correlação, descobertas e observações sobre seus registros.', fs: ['an_hor', 'an_ref', 'an_pad', 'an_comp', 'an_ass', 'an_desc', 'ctx_all', 'ctx_ins', 'ctx_pat', 'ctx_sum', 'ctx_ada', 'ctx_priv'] },
  C: { r: 'gxctxc', t: 'Experiências contextuais', ic: 'bubble', d: 'Bolha de alertas, categorias, badges, som e vibração da hipoglicemia, assistência e sugestões nas telas.', fs: ['bubble', 'list', 'badge', 'sound', 'c_glic', 'c_lem', 'c_reg', 'c_met', 'c_app', 'ctx_ast', 'ctx_sug', 'ctx_rem'] },
  D: { r: 'gxnav', t: 'Personalização das informações', ic: 'sliders', d: 'Atalhos, pesquisa, gestos, menus, favoritos, fixados e o nível de detalhe do histórico.', fs: ['nav_sc', 'nav_search', 'nav_ptr', 'nav_menu', 'nav_gest', 'org_fav', 'org_pin', 'org_view'] }
};
/* chave que liga/desliga cada recurso (sem chave: o recurso só tem opções de apresentação) */
const GXH_MASTER = { an_hor: 'on', an_ref: 'on', an_pad: 'on', an_comp: 'on', an_ass: 'on', an_desc: 'on', vis_skel: 'on', vis_micro: 'on', vis_trans: 'on', vis_fb: 'on', vis_hap: 'on', vis_prog: 'on', badge: 'all', c_glic: 'on', c_lem: 'on', c_reg: 'on', c_met: 'on', c_app: 'on', nav_sc: 'on', nav_search: 'on', nav_ptr: 'on', nav_menu: 'on', nav_gest: 'on', org_fav: 'on', org_pin: 'on', ctx_all: 'on', ctx_ins: 'on', ctx_pat: 'on', ctx_sum: 'on', ctx_ada: 'on', ctx_ast: 'on', ctx_sug: 'on', ctx_rem: 'on' };
/* seção da Análise -> recurso que a liga ou desliga */
const GXH_AN = { desc: 'an_desc', hor: 'an_hor', tmp: 'an_hor', ref: 'an_ref', rfe: 'an_ref', pad: 'an_pad', comp: 'an_comp', ass: 'an_ass' };

const GXH_CTX = { f: 'ctx_all', k: 'on', msg: 'Precisa da chave geral “Inteligência contextual” ligada.', go: 'gxdados' };
const GXH_CG = { c_glic: 'Alertas glicêmicos', c_lem: 'Lembretes e compromissos', c_reg: 'Registros e atividades', c_met: 'Metas e conquistas', c_app: 'Informações do aplicativo' };
/* nome, ícone, o que faz, resultado esperado, com a chave ligada, com a chave desligada, dependências, observação */
const GXH = {
  vis_motion: ['Movimento geral', 'motion', 'Define se as animações seguem o aviso de movimento reduzido do aparelho ou ficam sempre simplificadas.', 'Com “Reduzir sempre”, transições, pulsos e efeitos não essenciais ficam simplificados mesmo que o aparelho não peça isso.'],
  vis_skel: ['Skeleton Loading', 'skel', 'Mostra a silhueta da tela (blocos cinza) enquanto ela monta, no lugar de um espaço vazio ou de um texto de espera.', 'Na abertura do app e em telas pesadas aparece uma estrutura temporária com o formato do conteúdo. Telas rápidas continuam sem ela.', 'Telas lentas mostram blocos que imitam o conteúdo que está chegando.', 'Telas lentas mostram o texto de espera de sempre.'],
  vis_micro: ['Microanimações', 'touch', 'Pequenos movimentos de resposta ao toque: pressionar, concluir, selecionar, reorganizar, salvar, excluir, gráficos e metas.', 'Botões, cards, registros, gráficos e metas reagem com um movimento curto que confirma a ação.', 'Os elementos reagem ao toque com movimentos curtos.', 'Os elementos mudam sem movimento.', 0, 'O aviso do sistema para reduzir movimento sempre prevalece sobre estas escolhas.'],
  vis_trans: ['Transições entre telas', 'swap', 'Anima a troca de tela, a abertura de detalhes, a expansão de painéis e as janelas que sobem da base.', 'Ao navegar, a nova tela entra com o estilo escolhido (esmaecer, deslizar ou subir).', 'A tela nova entra com animação.', 'A tela troca de uma vez, sem animação.', 0, 'O aviso do sistema para reduzir movimento sempre prevalece sobre estas escolhas.'],
  vis_fb: ['Feedback visual (avisos)', 'msg', 'Mensagens curtas que confirmam salvamentos, cópias, mudanças de configuração e o estado da conexão.', 'Os avisos aparecem na posição e pelo tempo escolhidos. Erros e exclusões aparecem sempre.', 'Confirmações não essenciais aparecem como aviso.', 'Só erros e exclusões geram aviso.'],
  vis_hap: ['Feedback tátil', 'vibe', 'Vibração leve em algumas interações, nos aparelhos que têm vibrador.', 'O aparelho vibra de forma curta nas ocasiões marcadas, como confirmar um registro ou concluir uma tarefa.', 'O aparelho vibra de leve nas ocasiões marcadas.', 'Nenhuma vibração nas interações.'],
  vis_prog: ['Indicadores de progresso', 'prog', 'Barras segmentadas ou contínuas com os registros dos últimos 7 dias, o progresso das conquistas, as etapas da importação e a fila de exames.', 'Cartões de progresso aparecem no Início, na Importação e nos Exames, sempre calculados com dados reais.', 'Os cartões de progresso aparecem nas telas escolhidas.', 'Nenhum cartão de progresso adicional.'],
  org_home: ['Formato do Início', 'home', 'Escolhe como os cards da tela inicial são dispostos.', 'Os cards do Início passam a aparecer em grade (duas colunas) ou em lista (uma coluna).'],

  an_hor: ['Análise por horários', 'clock', 'Agrupa suas medições por período do dia e por contexto para mostrar quando a glicemia costuma ficar mais alta ou mais baixa.', 'A tela Análise passa a ter as seções “Análise por horário” e “Horários e períodos do dia”, com agrupamentos e indicadores.', 'Análise: seções por horário disponíveis.', 'Análise: seções por horário ocultas. Seus registros continuam salvos.'],
  an_ref: ['Análise por refeições', 'meal', 'Compara a glicemia antes e depois de cada refeição registrada.', 'A Análise passa a ter “Análise por refeição” e “Refeições e glicemia”, com a variação medida por tipo de refeição.', 'Análise: seções de refeição disponíveis.', 'Análise: seções de refeição ocultas. Seus registros continuam salvos.'],
  an_pad: ['Recorrência de eventos', 'repeat', 'Identifica situações glicêmicas que se repetem ao longo do tempo e apresenta seus padrões.', 'A Análise passa a ter a seção “Padrões recorrentes”, com cada padrão e os registros que o sustentam.', 'Análise: seção de padrões recorrentes disponível.', 'Análise: seção de padrões recorrentes oculta.'],
  an_comp: ['Comparação entre períodos', 'compare', 'Permite comparar seus resultados glicêmicos entre diferentes intervalos de tempo.', 'A Análise passa a ter a seção “Comparação entre períodos”, com o que melhorou e o que piorou entre os intervalos escolhidos.', 'Análise: seção de comparação disponível.', 'Análise: seção de comparação oculta.'],
  an_ass: ['Correlação entre variáveis', 'link', 'Mostra relações observadas entre a glicemia e outras informações dos seus registros, sem afirmar causa.', 'A Análise passa a ter a seção “Associações entre variáveis”, com a força da relação e a quantidade de pares usados.', 'Análise: seção de associações disponível.', 'Análise: seção de associações oculta.'],
  an_desc: ['Central de descobertas', 'spark', 'Reúne observações e padrões identificados pelo GLUXO a partir dos seus registros.', 'A Análise passa a ter a seção “Central de descobertas”, logo depois da Visão geral.', 'Análise: seção de descobertas disponível.', 'Análise: seção de descobertas oculta.'],
  ctx_all: ['Inteligência contextual (chave geral)', 'brain', 'Liga ou desliga de uma vez todas as observações, sugestões, resumos e lembretes contextuais.', 'Desligada, nenhuma observação contextual é calculada nem exibida. Alertas glicêmicos e proteções de segurança continuam ativos.', 'Observações, sugestões e resumos contextuais disponíveis.', 'Nenhuma observação contextual é calculada.'],
  ctx_ins: ['Insights glicêmicos', 'chart', 'Observações sobre os seus registros, sempre com período, quantidade de medições e critério.', 'Os insights aparecem em “Insights e resumos” e, se você escolher, como um destaque discreto no Início.', 'Insights disponíveis em Insights e resumos.', 'Nenhum insight é calculado.', [GXH_CTX]],
  ctx_pat: ['Reconhecimento de padrões', 'repeat', 'Associações entre registros (horário, refeição, atividade, etiquetas e eventos) que se repetem o número mínimo de vezes escolhido.', 'A seção Padrões de “Insights e resumos” lista os padrões que atingem o mínimo de ocorrências.', 'Padrões disponíveis em Insights e resumos.', 'Nenhum padrão é calculado.', [GXH_CTX, { ok: () => typeof cxAllow !== 'function' || cxAllow('padroes'), msg: 'Faz parte de “Padrões e observações automáticas”, recurso Premium.' }]],
  ctx_sum: ['Resumos por período', 'sum', 'Resumo calculado com as mesmas contas da Análise, para 24 horas, 7, 14, 30 dias ou datas escolhidas.', 'Em “Insights e resumos” aparece o resumo do período, com comparação e consistência dos dados, se você escolher.', 'Resumo por período disponível.', 'Nenhum resumo é calculado.', [GXH_CTX]],
  ctx_ada: ['Adaptação ao uso', 'refresh', 'Usa as telas que você mais abre e as sugestões que aceita ou dispensa para melhorar a relevância das sugestões.', 'As sugestões deixam de repetir o que você já usa e de insistir no que você sempre dispensa. Nada clínico muda.', 'As sugestões se ajustam ao seu uso.', 'As sugestões não aprendem com o seu uso.', [GXH_CTX]],
  ctx_priv: ['Privacidade e transparência', 'shield', 'Controla o histórico de insights vistos e se os detalhes de “Como foi calculado” já aparecem abertos.', 'Você pode consultar e apagar o histórico, e os critérios de cada observação ficam recolhidos ou abertos.'],

  bubble: ['Bolha flutuante', 'bubble', 'Botão flutuante que reúne os alertas e lembretes do GLUXO, no lugar de faixas fixas nas telas.', 'Com o modo Bolha ligado, a bolha mostra indicador de novos, contador, animações e posição conforme as opções.', 'Alertas e lembretes ficam na bolha flutuante.', 'Alertas aparecem como faixas nas telas (modo convencional).', [{ ok: () => typeof acBubbleOn === 'function' && acBubbleOn(), msg: 'Vale só com o modo de alertas em “Bolha”.', go: 'lembretes', lb: 'Abrir modo de alertas' }]],
  list: ['Lista, prévias e ações dos alertas', 'list', 'Define como cada alerta aparece na lista e quais botões de ação ele mostra.', 'A lista passa a mostrar a prévia do texto e os botões de ação marcados, agrupados como você definir.'],
  badge: ['Badges de alertas', 'badge', 'Número ou ponto que indica alertas não lidos no menu Mais, no Início e no Histórico.', 'Números ou pontos aparecem nos botões escolhidos enquanto houver alertas não lidos.', 'Os badges aparecem nas áreas marcadas.', 'Nenhum badge de alerta é exibido.'],
  sound: ['Protocolo de hipoglicemia: som e vibração', 'sound', 'Define o aviso sonoro e a vibração quando surge uma glicemia baixa (abaixo de 70 mg/dL). O aviso visual e o protocolo continuam sempre.', 'Ao surgir uma glicemia baixa, o app toca três bipes e vibra, conforme as opções ligadas.'],
  ctx_ast: ['Assistência contextual', 'tip', 'Caixa discreta no alto de cada tela com informações sobre o que você está vendo.', 'Nas telas marcadas aparece uma caixa com lembrete, observação, insight ou sugestão, até o limite escolhido.', 'A caixa de assistência aparece nas telas marcadas.', 'Nenhuma caixa de assistência nas telas.', [GXH_CTX]],
  ctx_sug: ['Sugestões de funcionalidades', 'spark', 'Dicas para descobrir recursos do app, completar registros e preparar relatórios. Nunca insistem e nunca empurram recursos pagos.', 'Uma sugestão por vez aparece na caixa de assistência, com o intervalo escolhido entre uma e outra.', 'Sugestões aparecem na caixa de assistência.', 'Nenhuma sugestão é exibida.', [GXH_CTX]],
  ctx_rem: ['Lembretes contextuais', 'bell', 'Avisos informativos feitos a partir dos seus registros, só com o app aberto. Não substituem os lembretes que você programou.', 'Quando a situação marcada acontece (por exemplo uma pausa nos registros), um aviso informativo aparece na caixa de assistência.', 'Avisos informativos aparecem com o app aberto.', 'Nenhum lembrete contextual é exibido.', [GXH_CTX]],

  nav_sc: ['Atalhos circulares do Início', 'nav', 'Fileira de atalhos redondos no Início para as telas que você mais usa.', 'O Início mostra os atalhos marcados, na ordem e no tamanho escolhidos.', 'O Início mostra a fileira de atalhos.', 'O Início fica sem a fileira de atalhos.'],
  nav_search: ['Pesquisa global', 'search', 'Botão no Início para pesquisar registros, insulinas, observações, exames, HbA1c e telas.', 'O botão “Pesquisar no GLUXO” aparece no Início e busca só nas áreas marcadas.', 'O Início mostra o botão de pesquisa.', 'O botão de pesquisa não aparece no Início.'],
  nav_ptr: ['Puxar para atualizar', 'refresh', 'Gesto de puxar a tela para baixo para atualizar a informação exibida.', 'Nas telas marcadas, puxar para baixo atualiza o conteúdo e mostra o indicador escolhido.', 'O gesto funciona nas telas marcadas.', 'Puxar a tela não faz nada.'],
  nav_menu: ['Menus contextuais', 'menu', 'Menus de ações rápidas sobre registros, atalhos e cards, abertos por pressão longa ou pelo botão “Mais opções”.', 'Ao pressionar um item (ou tocar em “Mais opções”), abre um menu com as ações marcadas.', 'Os menus de ações rápidas estão disponíveis.', 'Pressão longa e “Mais opções” não abrem menu.'],
  nav_gest: ['Gestos', 'gesture', 'Deslizar entre abas, dispensar alertas e trocar o período do Início com o dedo. Todos têm botão equivalente.', 'Os gestos marcados passam a funcionar; os botões continuam disponíveis.', 'Os gestos marcados funcionam.', 'Nenhum gesto de deslizar funciona; use os botões.'],
  org_fav: ['Favoritos', 'star', 'Estrela para guardar o que você mais usa. Os itens são referências: o conteúdo original não é copiado.', 'A estrela aparece nas categorias permitidas e os favoritos ficam na central de Favoritos e, se quiser, no Início.', 'A estrela e a central de favoritos estão disponíveis.', 'Sem estrela e sem favoritos. A lista guardada não é apagada.'],
  org_pin: ['Conteúdos fixados', 'pin', 'Mantém no topo do Início o que importa. Alertas e avisos de segurança nunca são afetados.', 'Os itens fixados aparecem abaixo do Resumo glicêmico, no formato e na ordem escolhidos.', 'Os itens fixados aparecem no Início.', 'Nada fixado aparece no Início. A lista guardada não é apagada.'],
  org_view: ['Densidade e histórico', 'density', 'Escolhe o espaçamento de cards e listas e como o Histórico ordena, exibe e detalha os registros.', 'Cards e listas ficam mais compactos ou mais amplos, e o Histórico muda de ordem, visualização e nível de detalhe.']
};
['c_glic', 'c_lem', 'c_reg', 'c_met', 'c_app'].forEach(f => {
  GXH[f] = [GXH_CG[f], 'bell', `Controla como os alertas de “${GXH_CG[f].toLowerCase()}” chegam à central, à bolha e ao histórico.`, 'Os alertas desta categoria seguem as opções abaixo. Alertas críticos e de hipoglicemia nunca são filtrados.', 'Os alertas desta categoria chegam à central.', 'Os alertas desta categoria ficam só no histórico.'];
});

/* legenda de cada opção que não traz texto próprio no registro */
const GXH_L = {
  'an_hor.on': 'Quando ativada, a Análise agrupa suas medições por períodos do dia e mostra os horários com mais glicemias elevadas ou baixas.',
  'an_ref.on': 'Quando ativada, a Análise compara a glicemia antes e depois de cada tipo de refeição que você registrou.',
  'an_pad.on': 'Quando ativada, a Análise identifica situações glicêmicas que se repetem ao longo do tempo e apresenta seus padrões.',
  'an_comp.on': 'Quando ativada, a Análise permite comparar seus resultados glicêmicos entre dois intervalos de tempo.',
  'an_ass.on': 'Quando ativada, a Análise mostra relações observadas entre a glicemia e outras informações registradas, sem afirmar causa.',
  'an_desc.on': 'Quando ativada, a Análise reúne as observações e os padrões que o GLUXO identificou a partir dos seus registros.',
  'bubble.style': 'Define se o pulso que chama a atenção quando chega um alerta é discreto ou mais evidente. Só tem efeito com “Animações” ligadas.',
  'bubble.side': 'Escolhe onde a bolha fica: onde você soltar, encostada na esquerda ou na direita da tela.',
  'list.tap': 'Define o que acontece ao tocar num alerta da lista: abrir direto a tela relacionada ou mostrar primeiro os botões de ação.',
  'list.read': 'Mostra o botão para marcar o alerta como lido, sem abri-lo.',
  'list.go': 'Mostra o botão “Acessar”, que leva à tela relacionada ao alerta.',
  'list.dismiss': 'Mostra o botão para remover o alerta da lista.',
  'list.confirm': 'Pergunta “Remover da lista?” antes de remover um alerta, para evitar remoção sem querer.',
  'list.doneConfirm': 'Pede confirmação antes de concluir um alerta que oferece essa ação.',
  'nav_sc.on': 'Mostra a fileira de atalhos circulares no topo do Início.',
  'nav_sc.size': 'Define o tamanho dos atalhos: normal, compacto (menores) ou em grade (vários por linha).',
  'nav_search.on': 'Mostra o botão “Pesquisar no GLUXO” no Início.',
  'nav_search.live': 'Atualiza os resultados a cada letra digitada. Desligado, a busca só roda ao confirmar.',
  'nav_search.hist': 'Guarda as últimas pesquisas neste aparelho para repetir com um toque.',
  'nav_search.exam': 'Inclui exames nos resultados da pesquisa (recurso Premium).',
  'nav_search.hba': 'Inclui as medições de HbA1c nos resultados da pesquisa.',
  'nav_search.rec': 'Inclui glicemias e refeições nos resultados da pesquisa.',
  'nav_search.ins': 'Inclui os registros de insulina nos resultados da pesquisa.',
  'nav_search.ev': 'Inclui observações e eventos nos resultados da pesquisa.',
  'nav_search.fn': 'Inclui telas, métricas e gráficos do app nos resultados da pesquisa.',
  'nav_ptr.on': 'Liga o gesto de puxar a tela para baixo para atualizar. Cada tela abaixo pode ficar de fora.',
  'nav_ptr.painel': 'Permite puxar para atualizar na tela Início.',
  'nav_ptr.historico': 'Permite puxar para atualizar na tela Histórico.',
  'nav_ptr.analise': 'Permite puxar para atualizar na tela Análise.',
  'nav_ptr.relatorios': 'Permite puxar para atualizar na tela Relatórios.',
  'nav_ptr.style': 'Define a aparência do indicador que surge ao puxar: normal ou compacto (menor).',
  'nav_menu.on': 'Liga os menus de ações rápidas sobre registros, atalhos e cards.',
  'nav_menu.long': 'Abre o menu ao manter o dedo pressionado por cerca de meio segundo. O toque curto segue normal.',
  'nav_menu.button': 'Adiciona o botão “Mais opções” na janela de detalhes de um registro, para quem prefere tocar.',
  'nav_menu.rec': 'Permite abrir o menu em registros glicêmicos.',
  'nav_menu.sc': 'Permite abrir o menu nos atalhos circulares (mover, remover e configurar).',
  'nav_menu.card': 'Permite abrir o menu nos cards de métricas do Início.',
  'nav_menu.details': 'Inclui a ação “Consultar detalhes” nos menus.',
  'nav_menu.edit': 'Inclui a ação “Editar” no menu dos registros.',
  'nav_menu.del': 'Inclui a ação “Excluir” no menu dos registros. A exclusão continua pedindo confirmação.',
  'nav_menu.share': 'Inclui a ação “Compartilhar” nos menus.',
  'nav_menu.fav': 'Inclui a ação “Favoritar” no menu dos registros.',
  'nav_gest.on': 'Liga os gestos de deslizar. Todos têm um botão equivalente.',
  'nav_gest.tabs': 'Deslizar para os lados troca de aba no rodapé.',
  'nav_gest.dismiss': 'Deslizar um alerta para o lado o remove da lista. Alertas de segurança ativos não saem.',
  'nav_gest.period': 'Deslizar no card de período do Início troca o período exibido.',
  'vis_skel.style': 'Define como os blocos temporários se movem: brilho passando, pulsar ou parados.',
  'vis_skel.level': 'Define o contraste dos blocos temporários: suave, normal ou forte.',
  'vis_micro.speed': 'Define a rapidez dos movimentos: rápida, normal ou suave (mais lenta).',
  'vis_micro.amp': 'Define o tamanho dos movimentos: discreta, normal ou marcante.',
  'vis_micro.btn': 'Decide se os movimentos dos botões seguem a chave geral, ficam sempre ligados ou sempre desligados.',
  'vis_micro.card': 'Decide se os movimentos de cards e seletores seguem a chave geral, ficam sempre ligados ou sempre desligados.',
  'vis_micro.rec': 'Decide se os movimentos dos registros seguem a chave geral, ficam sempre ligados ou sempre desligados.',
  'vis_micro.chart': 'Decide se os movimentos dos gráficos seguem a chave geral, ficam sempre ligados ou sempre desligados.',
  'vis_micro.goal': 'Decide se os movimentos de metas e conquistas seguem a chave geral, ficam sempre ligados ou sempre desligados.',
  'vis_micro.press': 'O botão encolhe um pouco enquanto você o pressiona.',
  'vis_micro.done': 'O botão faz um pequeno pulso ao concluir uma ação.',
  'vis_micro.select': 'Chips, abas e seletores ganham um leve destaque ao serem escolhidos.',
  'vis_micro.reorder': 'Ao reorganizar itens, eles deslizam até a nova posição em vez de pular.',
  'vis_micro.save': 'O registro que acabou de ser salvo ou editado fica destacado por instantes na lista.',
  'vis_micro.del': 'Ao excluir, a linha do registro sai da lista com uma animação curta.',
  'vis_micro.chartin': 'Os gráficos entram com uma animação quando o desenho muda (nova tela, novo período ou dados novos).',
  'vis_micro.chartsel': 'O ponto ou a faixa selecionada num gráfico ganha um destaque animado.',
  'vis_micro.goalfx': 'Ao atingir uma meta, o marco aparece com uma pequena comemoração.',
  'vis_trans.kind': 'Define o estilo da animação ao trocar de tela: esmaecer, deslizar ou subir suavemente.',
  'vis_trans.speed': 'Define a rapidez da transição: rápida, normal ou suave (mais lenta).',
  'vis_trans.tabs': 'Anima a troca entre as abas do rodapé.',
  'vis_trans.screens': 'Anima a abertura e o retorno das telas de detalhe.',
  'vis_trans.panels': 'Anima a expansão e o recolhimento de painéis.',
  'vis_trans.sheets': 'Anima a abertura e o fechamento das janelas que sobem da base da tela.',
  'vis_fb.dur': 'Define por quanto tempo o aviso fica na tela. Avisos de erro ficam pelo menos o tempo normal.',
  'vis_fb.ok': 'Mostra um aviso quando algo é salvo, alterado ou concluído.',
  'vis_fb.copy': 'Mostra um aviso quando um texto é copiado ou compartilhado.',
  'vis_fb.cfg': 'Mostra um aviso quando uma configuração é atualizada.',
  'vis_fb.net': 'Mostra um aviso quando o aparelho fica sem internet e quando a conexão volta.',
  'vis_fb.info': 'Mostra os demais avisos informativos que não se encaixam nas opções acima.',
  'vis_fb.mode': 'Define o que acontece quando chega um aviso com outro ainda na tela: trocar pelo novo ou empilhar até 3.',
  'vis_fb.tap': 'Permite fechar o aviso com um toque antes de o tempo acabar.',
  'vis_hap.level': 'Define a força da vibração: leve, média ou forte.',
  'vis_hap.save': 'Vibra de leve ao confirmar um registro.',
  'vis_hap.select': 'Vibra de leve ao selecionar opções em chips, abas e seletores.',
  'vis_hap.done': 'Vibra de leve ao concluir uma tarefa ou um lembrete.',
  'vis_hap.toggle': 'Vibra de leve ao ligar ou desligar uma configuração.',
  'vis_hap.ctrl': 'Vibra de leve ao tocar no botão + e nas abas do rodapé.',
  'vis_hap.err': 'Vibra de forma curta e dupla quando ocorre um erro ou um aviso importante.',
  'vis_prog.style': 'Define o desenho da barra: segmentada (um traço por dia ou etapa) ou contínua.',
  'vis_prog.anim': 'Anima o preenchimento da barra quando ela aparece ou muda.',
  'vis_prog.streak': 'Mostra no Início quantos dos últimos 7 dias têm registro de glicemia.',
  'vis_prog.goal': 'Mostra no Início o avanço de cada conquista em andamento até o próximo marco.',
  'vis_prog.imp': 'Mostra as etapas (ler, conferir e gravar) durante uma importação.',
  'vis_prog.ex': 'Mostra quantos exames da fila de envio já foram concluídos.',
  'org_fav.screen': 'Mostra a estrela para favoritar telas e seções do app.',
  'org_fav.card': 'Mostra a estrela para favoritar cards e indicadores do Início.',
  'org_fav.event': 'Mostra a estrela para favoritar observações.',
  'org_fav.goal': 'Mostra a estrela para favoritar metas e conquistas.',
  'org_fav.group': 'Define se a central de favoritos separa os itens por categoria ou mostra uma lista única.',
  'org_fav.sort': 'Define a ordem dos favoritos: a que você montar com as setas, os mais recentes ou a ordem alfabética.',
  'org_pin.rec': 'Permite fixar registros de glicemia na tela inicial.',
  'org_pin.screen': 'Permite fixar telas, relatórios e gráficos na tela inicial.',
  'org_pin.goal': 'Permite fixar metas e conquistas na tela inicial.',
  'org_pin.mode': 'Define como os fixados aparecem no Início: em linha compacta ou em lista expandida.',
  'org_pin.order': 'Define qual seção vem primeiro no Início: Fixados ou Favoritos.',
  'org_view.hview': 'Define se o Histórico mostra os registros em lista ou em cards de duas colunas.',
  'org_view.hdetail': 'Define quantas informações cada registro mostra no Histórico: detalhada ou resumida.',
  'ctx_ins.compare': 'Compara o período analisado com o período anterior de mesma duração.',
  'ctx_ins.trend': 'Aponta quando os valores vêm subindo ou descendo ao longo do período.',
  'ctx_ins.period': 'Observa manhã, tarde e noite separadamente.',
  'ctx_ins.variab': 'Destaca os períodos do dia em que os valores variam mais.',
  'ctx_ins.weekday': 'Observa se algum dia da semana se destaca.',
  'ctx_ins.target': 'Conta as medições acima e abaixo da faixa-alvo configurada.',
  'ctx_pat.meal': 'Procura padrões ligados às refeições registradas.',
  'ctx_pat.timing': 'Procura padrões nas medições de antes e depois das refeições.',
  'ctx_pat.activity': 'Procura padrões ligados à atividade física registrada.',
  'ctx_pat.marks': 'Procura padrões ligados a etiquetas, dias da semana e recorrências.',
  'ctx_pat.events': 'Procura padrões ligados a eventos e observações registrados.',
  'ctx_ast.home': 'Mostra a caixa de assistência na tela Início.',
  'ctx_ast.hist': 'Mostra a caixa de assistência na tela Histórico.',
  'ctx_ast.analise': 'Mostra a caixa de assistência na Análise e nos gráficos.',
  'ctx_ast.metricas': 'Mostra a caixa de assistência na tela Métricas.',
  'ctx_ast.food': 'Mostra a caixa de assistência nas telas de alimentação e bolus.',
  'ctx_sug.discover': 'Sugere recursos do app que você ainda não usou.',
  'ctx_sug.data': 'Sugere completar registros que estão faltando informação.',
  'ctx_sug.report': 'Sugere preparar relatórios quando houver dados suficientes.',
  'ctx_rem.gap': 'Define quanto tempo sem registros é considerado uma pausa.',
  'ctx_rem.report': 'Confere os dados antes de você gerar um relatório e avisa se algo pode estar faltando.',
  'ctx_sum.range': 'Define o período que o resumo mostra ao abrir.',
  'ctx_sum.compare': 'Mostra, junto do resumo, o período anterior de mesma duração.',
  'ctx_sum.attention': 'Lista os registros que merecem uma conferência, como valores fora do comum.',
  'ctx_sum.quality': 'Mostra a consistência dos dados: quantidade de medições e dias cobertos.'
};
['c_glic', 'c_lem', 'c_reg', 'c_met', 'c_app'].forEach(f => {
  GXH_L[f + '.bubble'] = 'Quando ligado, novos alertas desta categoria abrem o aviso da bolha. Desligado, ficam só na lista.';
  GXH_L[f + '.open'] = 'Define se o grupo desta categoria já aparece aberto quando os alertas estão agrupados.';
  GXH_L[f + '.hi'] = 'Realça visualmente os alertas desta categoria na lista.';
});
Object.keys(GXN).forEach(k => { GXH_L['nav_sc.' + k] = `Mostra o atalho “${GXN[k][0]}” na fileira do Início.`; });

/* efeito de cada escolha (mostrado abaixo da opção, conforme o valor selecionado) */
const GXH_TRI = { auto: 'Segue a chave geral de Microanimações.', on: 'Fica sempre ligada, mesmo com a chave geral desligada.', off: 'Fica sempre desligada, mesmo com a chave geral ligada.' };
const GXH_SPD = { fast: 'Os movimentos ficam mais rápidos.', normal: 'Velocidade padrão do GLUXO.', slow: 'Os movimentos ficam mais lentos e suaves.' };
const GXH_FX = {
  'bubble.style': { soft: 'O pulso é suave e discreto.', strong: 'O pulso é mais evidente e se repete mais vezes.' },
  'bubble.side': { free: 'A bolha fica onde você a soltar.', left: 'A bolha encosta na lateral esquerda.', right: 'A bolha encosta na lateral direita.' },
  'list.tap': { go: 'Tocar no alerta abre direto a tela relacionada.', options: 'Tocar no alerta mostra primeiro os botões de ação.' },
  'list.freq': { 0: 'Avisos informativos abrem a bolha sempre que chegam.', 5: 'No máximo um aviso informativo a cada 5 minutos.', 30: 'No máximo um aviso informativo a cada 30 minutos.' },
  'nav_sc.size': { normal: 'Atalhos em tamanho padrão, em uma fileira.', small: 'Atalhos menores, para caber mais na fileira.', grid: 'Atalhos distribuídos em grade, sem rolar para o lado.' },
  'nav_ptr.style': { normal: 'Indicador de tamanho padrão.', compact: 'Indicador menor, que ocupa menos espaço.' },
  'vis_motion.mode': { system: 'As animações seguem o pedido de movimento reduzido do aparelho.', reduce: 'As animações não essenciais ficam sempre simplificadas.' },
  'vis_skel.style': { shimmer: 'Um brilho passa pelos blocos enquanto a tela carrega.', pulse: 'Os blocos pulsam suavemente.', static: 'Os blocos ficam parados.' },
  'vis_skel.level': { soft: 'Blocos quase imperceptíveis.', normal: 'Contraste padrão.', strong: 'Blocos bem visíveis.' },
  'vis_micro.speed': GXH_SPD,
  'vis_micro.amp': { soft: 'Movimentos pequenos, quase imperceptíveis.', normal: 'Tamanho padrão do GLUXO.', strong: 'Movimentos maiores e mais evidentes.' },
  'vis_micro.btn': GXH_TRI, 'vis_micro.card': GXH_TRI, 'vis_micro.rec': GXH_TRI, 'vis_micro.chart': GXH_TRI, 'vis_micro.goal': GXH_TRI,
  'vis_trans.kind': { fade: 'A tela nova surge aos poucos.', slide: 'A tela nova desliza de lado.', rise: 'A tela nova sobe suavemente.' },
  'vis_trans.speed': GXH_SPD,
  'vis_fb.pos': { bottom: 'Os avisos aparecem na parte de baixo da tela.', top: 'Os avisos aparecem no topo da tela.' },
  'vis_fb.dur': { short: 'O aviso some mais rápido.', normal: 'Tempo padrão.', long: 'O aviso fica mais tempo na tela.' },
  'vis_fb.mode': { replace: 'Um aviso novo substitui o anterior.', stack: 'Até 3 avisos ficam empilhados ao mesmo tempo.' },
  'vis_hap.level': { low: 'Vibração curta e suave.', mid: 'Vibração de força média.', high: 'Vibração mais forte.' },
  'vis_prog.style': { seg: 'Um traço para cada dia ou etapa, como nos Stories.', cont: 'Uma única barra que vai enchendo.' },
  'org_fav.group': { cat: 'Favoritos separados por categoria.', list: 'Todos os favoritos em uma lista só.' },
  'org_fav.sort': { manual: 'Você move cada favorito com as setas.', date: 'Os mais recentes ficam no topo.', alpha: 'Ordem alfabética.' },
  'org_pin.mode': { compact: 'Fixados em linha compacta, só com o nome.', expanded: 'Fixados em lista, com mais informações de cada item.' },
  'org_pin.order': { pins_first: 'No Início, Fixados vêm antes de Favoritos.', favs_first: 'No Início, Favoritos vêm antes de Fixados.' },
  'org_home.format': { grid: 'Cards do Início em duas colunas.', list: 'Cards do Início em uma coluna.' },
  'org_view.density': { compact: 'Cards e listas com menos espaço entre os itens.', comfort: 'Espaçamento padrão.', expanded: 'Cards e listas com mais espaço entre os itens.' },
  'org_view.hsort': { date_desc: 'Histórico dos mais recentes para os mais antigos.', date_asc: 'Histórico dos mais antigos para os mais recentes.', relevance: 'Em cada dia, favoritos e fixados aparecem primeiro.' },
  'org_view.hview': { list: 'Registros em uma coluna.', cards: 'Registros em cards de duas colunas.' },
  'org_view.hdetail': { detailed: 'Cada registro mostra todas as informações.', summary: 'Cada registro mostra só o essencial.' },
  'ctx_ins.win': { 7: 'Insights sobre os últimos 7 dias, comparados com os 7 anteriores.', 14: 'Insights sobre os últimos 14 dias, comparados com os 14 anteriores.', 30: 'Insights sobre os últimos 30 dias, comparados com os 30 anteriores.' },
  'ctx_pat.minocc': { 5: 'Mais padrões aparecem, cada um com ao menos 5 repetições.', 8: 'Menos padrões, cada um com ao menos 8 repetições.', 12: 'Só padrões muito repetidos, com ao menos 12 ocorrências.' },
  'ctx_ast.max': { 1: 'A caixa mostra 1 item por vez.', 2: 'A caixa mostra até 2 itens.', 3: 'A caixa mostra até 3 itens.' },
  'ctx_sug.freq': { 1: 'Uma sugestão nova por dia, no máximo.', 3: 'Uma sugestão nova a cada 3 dias, no máximo.', 7: 'Uma sugestão nova por semana, no máximo.' },
  'ctx_rem.gap': { 24: 'Avisa depois de 24 horas sem registro.', 48: 'Avisa depois de 48 horas sem registro.', 72: 'Avisa depois de 72 horas sem registro.' },
  'ctx_sum.range': { '24h': 'O resumo abre com as últimas 24 horas.', 7: 'O resumo abre com os últimos 7 dias.', 14: 'O resumo abre com os últimos 14 dias.', 30: 'O resumo abre com os últimos 30 dias.' },
  'ctx_priv.open': { closed: '“Como foi calculado” aparece recolhido.', open: '“Como foi calculado” aparece aberto.' }
};

/* ícones de traço (24x24), no mesmo estilo dos ícones do menu */
const GXH_IC = {
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  bubble: '<path d="M12 4a8 8 0 0 0-7 11.9L4 20l4.3-1A8 8 0 1 0 12 4z"/>', sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  motion: '<path d="M3 12h4l3-7 4 14 3-7h4"/>', skel: '<rect x="4" y="5" width="16" height="4" rx="1.5"/><rect x="4" y="12" width="10" height="3" rx="1.5"/><rect x="4" y="18" width="14" height="2" rx="1"/>',
  touch: '<path d="M9 11V5a2 2 0 0 1 4 0v6l5 1v4a5 5 0 0 1-5 5h-2a5 5 0 0 1-4-2l-3-4 2-1z"/>', swap: '<path d="M4 8h13M13 4l4 4-4 4M20 16H7M11 12l-4 4 4 4"/>',
  msg: '<rect x="3" y="5" width="18" height="12" rx="3"/><path d="M8 21l3-4"/>', vibe: '<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4 8v8M20 8v8"/>',
  prog: '<rect x="3" y="9" width="18" height="6" rx="3"/><path d="M6 12h6"/>', home: '<path d="M4 11l8-7 8 7M6 10v10h12V10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', meal: '<path d="M5 4v7a3 3 0 0 0 3 3v6M8 4v6M11 4v7a3 3 0 0 1-3 3M17 4c-2 1.5-2.5 4-2.5 7H17v9"/>',
  repeat: '<path d="M4 12a6 6 0 0 1 6-6h8M15 3l3 3-3 3M20 12a6 6 0 0 1-6 6H6M9 21l-3-3 3-3"/>', compare: '<path d="M4 7h13M13 3l4 4-4 4M20 17H7M11 13l-4 4 4 4"/>',
  link: '<circle cx="7" cy="8" r="2.5"/><circle cx="17" cy="16" r="2.5"/><path d="M9 9.5l6 5"/>', spark: '<path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/>',
  brain: '<path d="M12 3a4 4 0 0 0-4 4 3 3 0 0 0-2 5 3 3 0 0 0 2 5 4 4 0 0 0 8 0 3 3 0 0 0 2-5 3 3 0 0 0-2-5 4 4 0 0 0-4-4zM12 3v18"/>', bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', badge: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  sound: '<path d="M4 10v4h4l5 4V6l-5 4zM17 9a4 4 0 0 1 0 6"/>', nav: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>', refresh: '<path d="M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4"/>',
  menu: '<path d="M5 7h14M5 12h14M5 17h14"/>', gesture: '<path d="M5 12h14M9 8l-4 4 4 4M15 8l4 4-4 4"/>', star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/>',
  pin: '<path d="M9 3h6l-1 6 3 3v2h-4v6l-1 1-1-1v-6H7v-2l3-3z"/>', density: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  tip: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>', sum: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/>'
};

/* prévias ILUSTRATIVAS (nunca são os dados da pessoa; vêm sempre com a etiqueta de exemplo) */
const gxhX = h => `<div class="gx-pv gxh-pv gxh-x"><span class="gxh-tag">Exemplo ilustrativo · não são os seus dados</span>${h}</div>`;
const gxhCols = l => `<div class="gxh-cols" aria-hidden="true">${l.map(([n, v, p]) => `<span><i style="height:${p}%"></i><b class="num">${v}</b><small>${n}</small></span>`).join('')}</div>`;
const GXH_PV = {
  an_hor: () => gxhX(gxhCols([['Madrugada', 118, 52], ['Manhã', 142, 66], ['Tarde', 131, 60], ['Noite', 156, 78]]) + '<small>Média de glicemia por período do dia (mg/dL).</small>'),
  an_ref: () => gxhX('<div class="gxh-rows" aria-hidden="true"><span>Café da manhã <b class="num">118 → 152</b></span><span>Almoço <b class="num">126 → 171</b></span><span>Jantar <b class="num">121 → 158</b></span></div><small>Antes → depois da refeição (mg/dL).</small>'),
  an_pad: () => gxhX('<div class="gxh-card"><b>Glicemia acima da faixa depois do jantar</b><small>Em 5 de 9 dias analisados</small></div>'),
  an_comp: () => gxhX('<div class="gxh-rows" aria-hidden="true"><span>Últimos 7 dias <b class="num">138 mg/dL</b></span><span>7 dias anteriores <b class="num">147 mg/dL</b></span></div><small>Comparação da média entre dois períodos.</small>'),
  an_ass: () => gxhX('<svg class="gxh-sc" viewBox="0 0 120 56" aria-hidden="true"><path d="M8 48h104M8 8v40" /><circle cx="22" cy="40" r="3"/><circle cx="38" cy="34" r="3"/><circle cx="50" cy="38" r="3"/><circle cx="64" cy="26" r="3"/><circle cx="78" cy="30" r="3"/><circle cx="92" cy="16" r="3"/><circle cx="104" cy="20" r="3"/></svg><small>Cada ponto é um par de registros. Correlação positiva moderada (exemplo).</small>'),
  an_desc: () => gxhX('<div class="gxh-card"><b>Descoberta</b><small>As manhãs concentram mais medições acima da faixa do que o resto do dia.</small></div>'),
  ctx_ins: () => gxhX('<div class="gxh-card"><b>Insight</b><small>A média dos últimos 14 dias ficou abaixo da dos 14 dias anteriores. Período, quantidade de medições e critério ficam visíveis.</small></div>'),
  ctx_pat: () => gxhX('<div class="gxh-card"><b>Padrão</b><small>Medições mais altas depois do almoço em 6 ocorrências.</small></div>'),
  ctx_sum: () => gxhX('<div class="gxh-rows" aria-hidden="true"><span>Medições <b class="num">52 em 14 dias</b></span><span>Na faixa <b class="num">68%</b></span><span>Média <b class="num">141 mg/dL</b></span></div>'),
  ctx_ast: () => gxhX('<div class="gxh-card"><b>Assistente</b><small>Caixa discreta no alto da tela, com até 3 itens.</small></div>'),
  ctx_sug: () => gxhX('<div class="gxh-card"><b>Sugestão</b><small>Você pode marcar o tipo de refeição ao registrar.</small></div>'),
  ctx_rem: () => gxhX('<div class="gxh-card"><b>Lembrete contextual</b><small>Faz 2 dias que não há registros. Aviso informativo, não indica quando medir.</small></div>'),
  sound: () => `<div class="gx-pv gxh-pv"><span>${gxGet('sound', 'beep') ? 'Som: três bipes' : 'Som desligado'} · ${gxGet('sound', 'vib') ? 'Vibração: ligada' : 'Vibração desligada'}</span><small>O aviso visual e o protocolo de hipoglicemia continuam sempre.</small></div>`,
  nav_search: () => gxhX('<span class="btn sm full" aria-hidden="true" style="pointer-events:none">Pesquisar no GLUXO</span>'),
  org_fav: () => gxhX('<div class="gxh-rows" aria-hidden="true"><span>★ 126 mg/dL · 12/11 <b>Registro</b></span><span>★ Análise <b>Tela</b></span></div>'),
  org_pin: () => gxhX('<div class="gxh-rows" aria-hidden="true"><span>• Relatórios <b>Tela</b></span><span>• Hipoglicemias <b>Card</b></span></div>')
};
