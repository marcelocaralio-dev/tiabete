/* GLUXO · Sistema de ícones (revisão e padronização).
   Fica DEPOIS de todos os módulos que definem ícones e ANTES de src/init.js: ajusta os dicionários (MI, MIC, DR_IC, ACI, IC, PNI, RW_INFO, CW_ICONS)
   e registra a tabela categoria → ícone usada pelo teste de exclusividade. Padrão único: viewBox 24, traço 1,8, pontas e cantos arredondados, sem preenchimento.
   Regra: cada categoria/função principal tem um ícone só dela. Itens da MESMA categoria compartilham o ícone (ex.: Menu lateral, aba Mais e alertas). */
(function () {
  const P = {
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    tube: '<path d="M9 3h6M10 3v12.5a2 2 0 0 0 4 0V3M10 10h4"/>',
    hypo: '<path d="M12 3s5.5 6 5.5 10a5.5 5.5 0 0 1-11 0C6.5 9 12 3 12 3z"/><path d="M12 10.5v5M9.8 13.5l2.2 2.2 2.2-2.2"/>',
    ticket: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v2.5M14 11v2M14 15.5V18"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.2A9.7 9.7 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z"/>',
    alarm: '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 1.5M4.5 4.5L3 6M19.5 4.5L21 6"/>',
    adiar: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 3.5v5h5M12 8v4.5l3 1.5"/>',
    bellLines: '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4M9.5 11h5M9.5 14h3.5"/>',
    bowl: '<path d="M3 12h18a9 9 0 0 1-18 0zM8 8c0-1.500 1-2 1-3.500M12 8c0-1.500 1-2 1-3.500M16 8c0-1.500 1-2 1-3.500"/>',
    cloche: '<path d="M3 18h18M5 18a7 7 0 0 1 14 0M12 8.500V11M10.500 8.500h3"/>',
    milk: '<path d="M7 3h10l-1.200 17.200a1 1 0 0 1-1 .8H9.200a1 1 0 0 1-1-.8zM7.400 9h9.200"/>',
    hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>',
    sunrise: '<path d="M3 19h18M6.500 19a5.500 5.500 0 0 1 11 0M12 6v3.500M4.700 10.700l1.700 1.700M19.300 10.700l-1.700 1.700"/>',
    ellipsis: '<path d="M5 12h.01M12 12h.01M19 12h.01"/>',
    apple: '<path d="M12 8c-2.500-2-7-1-7 4.500C5 17 8 21 10.500 21c.8 0 1-.5 1.500-.5s.7.5 1.500.5c2.500 0 5.500-4 5.500-8.500C19 7 14.500 6 12 8zM12 8c0-2 1-3.500 3-4.500"/>',
    sigma: '<path d="M18 5H6l6 7-6 7h12"/>',
    cloudUp: '<path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.500 1.500A3.500 3.500 0 0 1 17.500 18zM12 11v6M9.500 13.500L12 11l2.500 2.500"/>'
  };
  const SYR = MIC.seringa, TROPHY = MI.conquistas, GEAR = DR_IC.gear, PILL = DR_IC.pill, CALC = DR_IC.calc;
  /* refeições e contextos da medição (sol/lua ficam só para o tema) */
  Object.assign(MIC, { jejum: P.hourglass, almoco: P.bowl, jantar: P.cloche, ceia: P.milk, madrugada: P.sunrise, outro: P.ellipsis });
  /* aba Mais */
  Object.assign(MI, { config: GEAR, aparencia: P.contrast, hypo: P.hypo, hba1c: P.tube, bolus: CALC, insulinas: SYR, esquemas: PILL, insrem: P.alarm, licenca: P.ticket, privacidade: P.eyeoff, alertashist: P.bellLines });
  Object.assign(MI, { 'g-trat': MI.esquemas, 'g-saude': MI.hba1c, 'g-bolus': MI.bolus, 'g-seg': MI.seguranca, 'g-aj': MI.aparencia, 'g-notif': MI.lembretes, 'g-perfil': MI.perfil, 'g-hist': MI.classificar, 'g-relat': MI.relatorios, 'g-analises': MI.padroes, 'g-exames': MI.exames, 'g-ia': MI.ia, 'g-dados': MI.backup, 'g-sobre': MI.sobre });
  /* barra inferior e menu lateral */
  IC.menu = P.grid;
  Object.assign(DR_IC, { more: P.grid, tube: P.tube, cloud: P.cloudUp }); delete DR_IC.drop;
  for (const x of DR_MAIN) if (x[0] === 'hba1c') x[2] = 'tube';
  /* alertas */
  Object.assign(ACI, { hypo: P.hypo, pill: PILL, award: TROPHY, gear: GEAR, snooze: P.adiar, alarm: P.alarm });
  AC_CIC.hipo = 'hypo'; AC_ACT['hypo-open'] = 'hypo'; AC_ACT['ir-open'] = 'alarm';
  /* conquistas (decoração escolhida pelo usuário mantém a própria paleta; os três marcos seguem os ícones do sistema) */
  const sunDecor = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.500M12 19.500V22M2 12h2.500M19.500 12H22M4.900 4.900l1.800 1.800M17.300 17.300l1.800 1.800M4.900 19.100l1.800-1.800M17.300 6.700l1.800-1.800"/>';
  RW_INFO.fast.ic = P.hourglass; Object.assign(CW_ICONS, { escudo: RW_INFO.hypo.ic, sol: sunDecor, alvo: RW_INFO.norm.ic });
  /* painel */
  Object.assign(PNI, { hb: P.tube, syringe: SYR });
  /* guia de bolus: as abas Dia (soma) e Alimentos (maçã) usam P.sigma e P.apple, definidos em src/bolus.js (blIc) */
  /* ----- Tabela categoria → ícone (cada linha é uma categoria/função principal; o teste 19 exige formas diferentes) ----- */
  const T = [
    ['Início', IC.home], ['Histórico', IC.list], ['Análise', IC.chart], ['Mais (menu)', P.grid], ['Nova medição', IC.plus],
    ['Meu perfil', MI.perfil], ['Licença', P.ticket], ['Glicemia', ACI.drop], ['Hemoglobina glicada', P.tube], ['Hipoglicemia', P.hypo],
    ['Exames laboratoriais', MI.exames], ['Cálculo de bolus', CALC], ['Insulina', SYR], ['Meu tratamento', PILL], ['Lembretes de insulina', P.alarm],
    ['Refeições', MIC.refeicao], ['Alimentos', P.apple], ['Conquistas', TROPHY], ['Padrões', MI.padroes], ['Relatórios', MI.relatorios],
    ['Importar de outros aplicativos', MI.importar], ['Cópia de segurança', P.cloudUp], ['Classificar medições', MI.classificar], ['Eventos', MI.eventos],
    ['Perguntar ao Claude', MI.perguntas], ['Inteligência artificial', MI.ia], ['Alertas e lembretes', MI.lembretes], ['Alertas personalizados', MI.alertasp], ['Histórico de alertas', P.bellLines],
    ['Bloqueio e proteção', MI.seguranca], ['Privacidade', P.eyeoff], ['Configurações', GEAR], ['Aparência e tema', P.contrast], ['Sobre o app', MI.sobre], ['Ajuda', DR_IC.help],
    ['Café da manhã', MIC.cafe], ['Almoço', MIC.almoco], ['Lanche', MIC.lanche], ['Jantar', MIC.jantar], ['Ceia', MIC.ceia], ['Jejum', MIC.jejum], ['Ao deitar', MIC.deitar], ['Madrugada', MIC.madrugada], ['Outro horário', MIC.outro],
    ['Tema claro', DR_IC.sun], ['Tema escuro', DR_IC.moon],
    ['Confirmar', ACI.ok], ['Fechar', ACI.x], ['Adiar', P.adiar], ['Silenciar', ACI.bellOff], ['Ver', ACI.eye], ['Tentar de novo', ACI.retry], ['Apagar', ACI.trash], ['Atenção', ACI.warn], ['Razão insulina/carboidrato', '<path d="M5 19L19 5M7.500 8.500a2 2 0 100-4 2 2 0 000 4zM16.500 19.500a2 2 0 100-4 2 2 0 000 4z"/>'], ['Resumo do dia (bolus)', P.sigma]
  ];
  const norm = s => String(s).replace(/(\d)\.0+(?=\D|$)/g, '$1').replace(/(\.\d*?)0+(?=\D|$)/g, '$1').replace(/\s+/g, '');
  window.TB_ICONSET = { tabela: T.map(x => ({ categoria: x[0], forma: x[1] })), duplicados() { const m = {}, out = []; for (const [c, f] of T) { const k = norm(f); if (m[k]) out.push([m[k], c]); else m[k] = c; } return out; } };
})();
