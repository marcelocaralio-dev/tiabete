/* TiaBete (APK) · tela "Inteligência artificial" (Mais): assistente de configuração guiada.
   A chave é guardada cifrada no aparelho (ver ai-core.js) e nunca entra em backups, relatórios ou mensagens de erro.
   O progresso do assistente (etapa, provedor, modelo) é salvo sozinho; a chave em rascunho também, mas cifrada no cofre. */
if (window.TB_PUBLIC && window.TB_AI) {
  TITLES.ia = 'Inteligência artificial';
  const CHECKED = '11/11/2026'; // data da última conferência das condições dos provedores (ver PV e MODELS)
  const TIER = { free: ['Gratuito', 'free'], lim: ['Gratuito com limites', 'lim'], paid: ['Pago', 'paid'], cred: ['Requer créditos', 'cred'] };
  const STEPS = ['Provedor', 'Site oficial', 'Conta', 'Gerar chave', 'Colar chave', 'Modelo', 'Testar e salvar'];
  const PV = {
    gemini: { name: 'Google Gemini', ini: 'G', col: '#3b6fd8', tier: 'lim', sum: 'Modelos do Google. Tem plano gratuito, sem cartão de crédito.', site: 'https://aistudio.google.com', siteTx: 'aistudio.google.com', keys: 'https://aistudio.google.com/apikey', pre: 'AIza',
      steps: [['Entre com sua conta Google', 'Abra o Google AI Studio e entre com a sua conta do Google.', 'Sign in'], ['Abra a página de chaves', 'No menu, toque em “Get API key” (obter chave de API).', 'Get API key'], ['Crie a chave', 'Toque em “Create API key”. Se pedir um projeto, escolha um que já existe ou crie um novo.', 'Create API key'], ['Copie a chave', 'Ela começa com AIza. Toque no ícone de copiar ao lado dela.', 'AIza…'], ['Volte ao TiaBete', 'Feche a aba do navegador e cole a chave no campo “Chave da API”.', '']],
      limits: 'Plano gratuito com limites de pedidos por minuto, por dia e de texto por minuto. Os números exatos aparecem no seu AI Studio e mudam por modelo. Os limites valem por projeto, e a cota do dia reinicia à meia-noite (horário do Pacífico).', cost: 'Sem cobrança no plano gratuito. Para limites maiores é preciso ativar a cobrança no Google.', warn: 'No plano gratuito o Google informa que o conteúdo enviado pode ser usado para melhorar os produtos dele. Como o TiaBete envia dados de saúde, pense bem antes de usar.' },
    openrouter: { name: 'OpenRouter', ini: 'OR', col: '#6d4fd6', tier: 'lim', sum: 'Um só cadastro dá acesso a vários modelos, incluindo gratuitos (os que terminam em “:free”).', site: 'https://openrouter.ai', siteTx: 'openrouter.ai', keys: 'https://openrouter.ai/keys', pre: 'sk-or-',
      steps: [['Crie a conta', 'Toque em “Sign in” e entre com Google, GitHub ou e-mail.', 'Sign in'], ['Abra a página de chaves', 'Abra o endereço de chaves (botão “Página da chave” aqui no TiaBete).', 'Keys'], ['Crie a chave', 'Toque em “Create Key”, dê um nome (por exemplo TiaBete) e confirme.', 'Create Key'], ['Copie a chave', 'Ela começa com sk-or- e só aparece uma vez. Copie na hora.', 'sk-or-…'], ['Volte ao TiaBete', 'Feche a aba e cole a chave no campo “Chave da API”.', '']],
      limits: 'Modelos “:free”: 20 pedidos por minuto e, por dia, 50 pedidos (contas com menos de US$ 10 em créditos comprados) ou 1.000 pedidos (US$ 10 ou mais). Os gratuitos às vezes ficam lentos ou indisponíveis, e a lista muda com frequência.', cost: 'Modelos “:free” não cobram. Os outros descontam do crédito da conta.', warn: 'Cada modelo gratuito é operado por um fornecedor diferente, com regras próprias sobre o uso dos dados. Confira na página do modelo no site.' },
    groq: { name: 'Groq', ini: 'Gq', col: '#d4572b', tier: 'lim', sum: 'Respostas muito rápidas com modelos abertos. Tem plano gratuito com limites.', site: 'https://groq.com', siteTx: 'groq.com', keys: 'https://console.groq.com/keys', pre: 'gsk_',
      steps: [['Crie a conta', 'Abra o console da Groq e entre (Google, GitHub ou e-mail).', 'Sign up'], ['Abra a página de chaves', 'No menu, toque em “API Keys”.', 'API Keys'], ['Crie a chave', 'Toque em “Create API Key”, dê um nome e confirme.', 'Create API Key'], ['Copie a chave', 'Ela só aparece uma vez. Copie na hora.', 'gsk_…'], ['Volte ao TiaBete', 'Feche a aba e cole a chave no campo “Chave da API”.', '']],
      limits: 'Os limites mudam por modelo e aparecem na sua conta, em Settings → Limits (console.groq.com/settings/limits). Eu não consegui confirmar números oficiais do plano gratuito, então confira lá.', cost: 'Confira na sua conta se há cobrança ativa antes de usar muito.', warn: 'Veja nos termos da Groq como ela trata o conteúdo enviado.' },
    mistral: { name: 'Mistral AI', ini: 'M', col: '#e08a1e', tier: 'lim', sum: 'Empresa europeia de IA. O plano gratuito “Experiment” não pede cartão, mas pede telefone.', site: 'https://mistral.ai', siteTx: 'mistral.ai', keys: 'https://console.mistral.ai/api-keys', pre: '',
      steps: [['Crie a conta', 'Abra o console da Mistral e crie a conta.', 'Sign up'], ['Ative o plano gratuito', 'Em Admin → Subscription → Compare plans, toque em “Experiment for free”, aceite os termos e confirme o telefone.', 'Experiment for free'], ['Crie a chave', 'Abra “API Keys” e toque em “New key”. Dê um nome e crie.', 'New key'], ['Copie a chave', 'A chave completa só aparece uma vez. Copie na hora.', ''], ['Volte ao TiaBete', 'Feche a aba e cole a chave no campo “Chave da API”.', '']],
      limits: 'O plano Experiment tem limites de pedidos por segundo, texto por minuto e por mês. Os números exatos aparecem na sua conta, em Admin → Limits. Cada telefone vale para um plano.', cost: 'Sem cobrança no Experiment. Planos pagos dão mais limites.', warn: 'No plano Experiment a Mistral avisa que os pedidos podem ser usados para treinar os modelos dela. Evite enviar dados de saúde por ele.' },
    anthropic: { name: 'Claude (Anthropic)', ini: 'C', col: '#c4683b', tier: 'cred', sum: 'Modelos Claude. Não tem plano gratuito de API: paga por uso com crédito pré-pago.', site: 'https://www.anthropic.com', siteTx: 'anthropic.com', keys: 'https://console.anthropic.com/settings/keys', pre: 'sk-ant-',
      steps: [['Crie a conta', 'Abra o console da Anthropic e crie a conta (ou entre).', 'Sign up'], ['Adicione crédito', 'Em “Plans & Billing”, adicione um valor pequeno de crédito.', 'Billing'], ['Crie a chave', 'Em “API keys”, toque em “Create Key” e dê um nome.', 'Create Key'], ['Copie a chave', 'Ela começa com sk-ant-. Copie na hora.', 'sk-ant-…'], ['Volte ao TiaBete', 'Feche a aba e cole a chave no campo “Chave da API”.', '']],
      limits: 'Limites de uso crescem conforme o crédito e o histórico da conta.', cost: 'Cobrança por uso (por consulta, em centavos), descontada do crédito. A assinatura Claude Pro ou Max não vale para a API.', warn: '' },
    openai: { name: 'ChatGPT (OpenAI)', ini: 'O', col: '#2a8f78', tier: 'cred', sum: 'Modelos GPT. A API é paga por uso com crédito, separada da assinatura do ChatGPT.', site: 'https://openai.com', siteTx: 'openai.com', keys: 'https://platform.openai.com/api-keys', pre: 'sk-',
      steps: [['Crie a conta', 'Abra a plataforma da OpenAI e entre.', 'Log in'], ['Adicione crédito', 'Em “Billing”, adicione crédito.', 'Billing'], ['Crie a chave', 'Em “API keys”, toque em “Create new secret key”.', 'Create new secret key'], ['Copie a chave', 'Ela começa com sk-. Copie na hora.', 'sk-…'], ['Volte ao TiaBete', 'Feche a aba e cole a chave no campo “Chave da API”.', '']],
      limits: 'Os limites dependem do crédito e do histórico da conta.', cost: 'Cobrança por uso, descontada do crédito.', warn: '' },
    custom: { name: 'Outro (compatível com OpenAI)', ini: '+', col: '#6b7280', tier: 'paid', sum: 'Para serviços próprios ou de terceiros que usam o mesmo formato da OpenAI, com endereço https://.', site: '', siteTx: '', keys: '', pre: '', steps: [], limits: 'Dependem do serviço escolhido.', cost: 'Dependem do serviço escolhido.', warn: '' },
  };
  /* Modelos conferidos em CHECKED. c: compatibilidade com o TiaBete (ok = texto, ferramentas e imagem; part = falta algo; unk = não conferida). */
  const MODELS = {
    gemini: [['gemini-3.8-flash', 'Gemini 3.8 Flash', 'lim', 'ok', 'Mais indicado: rápido e completo.', 1], ['gemini-3.6-flash', 'Gemini 3.6 Flash', 'lim', 'ok', 'Alternativa se o 3.8 estiver ocupado.', 1], ['gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', 'lim', 'ok', 'Mais leve e econômico em limites.', 0], ['gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite', 'lim', 'ok', 'Versão leve anterior.', 0]],
    openrouter: [['google/gemma-4-26b-a4b-it:free', 'Gemma 4 26B (Google)', 'lim', 'ok', 'Lê imagens e usa ferramentas.', 1], ['thinkingmachines/inkling-2-small:free', 'Inkling 2 Small', 'lim', 'ok', 'Lê imagens e usa ferramentas.', 1], ['nvidia/nemotron-3.5-super-vl:free', 'Nemotron 3.5 Super VL (NVIDIA)', 'lim', 'ok', 'Lê imagens e usa ferramentas.', 0], ['nvidia/nemotron-3-ultra-550b-a55b:free', 'Nemotron 3 Ultra (NVIDIA)', 'lim', 'part', 'Só texto.', 0], ['liquid/lfm-3-1.7b:free', 'LFM 3 1.7B (Liquid)', 'lim', 'part', 'Pequeno, usa ferramentas; sem imagens.', 0], ['openrouter/free', 'Gratuito automático', 'lim', 'part', 'O OpenRouter escolhe um modelo gratuito a cada pedido.', 0]],
    groq: [['openai/gpt-oss-120b', 'GPT-OSS 120B', 'lim', 'unk', 'Confira o limite na sua conta.', 1], ['openai/gpt-oss-20b', 'GPT-OSS 20B', 'lim', 'unk', 'Versão menor e mais rápida.', 0], ['qwen/qwen3.8-27b', 'Qwen 3.8 27B', 'lim', 'unk', 'Confira o limite na sua conta.', 0]],
    mistral: [['mistral-small-latest', 'Mistral Small (versão atual)', 'lim', 'unk', 'Modelo geral e econômico.', 1]],
    anthropic: [['claude-haiku-5-5', 'Claude Haiku 5.5', 'cred', 'ok', 'Rápido e barato. Mais indicado.', 1], ['claude-sonnet-5-5', 'Claude Sonnet 5.5', 'cred', 'ok', 'Mais capaz e mais caro.', 0]],
    openai: [], custom: [],
  };
  const COMPAT = { ok: ['Compatível', 'ok'], part: ['Compatível em parte', 'part'], unk: ['Compatibilidade não conferida', 'unk'] };
  S.ai = { loaded: false, provider: 'openrouter', base: '', model: '', hasKey: false, saved: false, models: [], busy: false, msg: '', ok: false, consent: false, keyBuf: '', showKey: false, lastUrl: '', errCode: '',
    w: { prov: false, site: false, acct: false, keyp: false, copied: false, model: false, tested: null, view: 0 } };
  const A = () => S.ai;
  const SEC = () => window.TB_SECURE;
  const scrub = m => String(m || '').replace(/[A-Za-z0-9_\-.]{24,}/g, '•••'); // nunca mostrar pedaços de chave em mensagens
  const saveWiz = async () => { const a = A(); try { await SEC().setCfg('ai-wiz', { provider: a.provider, base: a.base, model: a.model, w: Object.assign({}, a.w, { view: 0 }), ts: Date.now() }); } catch (e) { } };
  async function aiLoad() {
    const a = A(); a.loaded = true;
    try {
      const c = await SEC().getCfg('ai'), wz = await SEC().getCfg('ai-wiz'); a.hasKey = await SEC().has('ai-key');
      if (wz) { a.provider = PV[wz.provider] ? wz.provider : a.provider; a.base = wz.base || ''; a.model = wz.model || ''; Object.assign(a.w, wz.w || {}); }
      if (c) { a.provider = PV[c.provider] ? c.provider : a.provider; a.base = c.base || ''; a.model = c.model || ''; a.consent = !!c.consent; a.saved = !!(a.hasKey && c.model); if (a.saved) Object.assign(a.w, { prov: true, site: true, acct: true, keyp: true, copied: true, model: true }); }
      if (!a.model && !c) a.model = defModel(a.provider);
      const dk = await SEC().get('ai-key-draft'); if (dk && !a.keyBuf) a.keyBuf = dk;
      a.resume = !!(wz && Object.values(wz.w || {}).some(v => v === true) && !(a.saved && a.w.tested && a.w.tested.ok));
    } catch (e) { a.msg = 'Não foi possível ler as configurações guardadas.'; }
    if (S.route === 'ia') render();
  }
  const defModel = p => { const m = (MODELS[p] || []).find(x => x[5]); return m ? m[0] : (TB_PROVIDERS[p] && TB_PROVIDERS[p].model) || ''; };
  const done7 = () => !!(A().saved && A().w.tested && A().w.tested.ok);
  const stepsDone = () => { const a = A(), w = a.w; return [w.prov, w.site, w.acct, w.keyp && w.copied, a.hasKey || !!a.keyBuf, !!a.model && w.model, done7()]; };
  const curStep = () => { const d = stepsDone(), a = A(); if (a.w.view) return a.w.view; const i = d.findIndex(x => !x); return i < 0 ? 7 : i + 1; };
  const ic = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = { info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', list: '<path d="M4 6h16M4 12h16M4 18h10"/>', key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>' };
  const tier = k => `<span class="ia-t ${TIER[k][1]}">${TIER[k][0]}</span>`;
  const logo = p => `<span class="ia-logo" style="background:${PV[p].col}" aria-hidden="true">${esc(PV[p].ini)}</span>`;
  const uiChip = t => t ? `<span class="ia-ui" title="Nome aproximado do botão na tela do site; pode mudar">${esc(t)}</span>` : '';
  const sec = (t, i) => `<h2 class="sec">${ic(IC[i])}<span>${esc(t)}</span></h2>`;
  const btn = (act, label, extra, cls) => `<button type="button" class="btn ${cls || ''}" data-act="${act}" ${extra || ''} ${A().busy ? 'disabled' : ''}>${label}</button>`;

  /* ---- 1. Introdução ---- */
  const secIntro = () => sec('Como a IA funciona no TiaBete', 'info') + `<div class="card"><div class="stack" style="gap:10px">
    <p style="margin:0">A IA do TiaBete lê exames, responde perguntas sobre os seus registros e estima os carboidratos dos alimentos. Ela <b>não calcula doses</b> e não substitui a sua equipe de saúde.</p>
    <details class="more"><summary>O que é uma API?</summary><p class="hint" style="margin:0 0 12px">É uma “porta” que permite a um aplicativo conversar com um serviço de inteligência artificial pela internet. O TiaBete usa essa porta para enviar a sua pergunta e receber a resposta.</p></details>
    <details class="more"><summary>O que é a chave de API?</summary><p class="hint" style="margin:0 0 12px">É uma senha longa e pessoal, gerada no site do provedor. Ela mostra ao serviço que o pedido é seu e é por ela que ele cobra (ou aplica o limite gratuito). <b>Não compartilhe a sua chave com ninguém.</b></p></details>
    <p class="hint" style="margin:0"><b>Em 4 passos:</b> 1) escolha um provedor, 2) crie a conta e gere a chave no site dele, 3) cole a chave aqui e escolha um modelo, 4) teste a conexão. O assistente abaixo guia cada um e guarda o seu progresso.</p>
    <p class="hint" style="margin:0">O uso é cobrado (ou limitado) pelo provedor, na sua conta. Condições conferidas nos sites dos provedores em ${CHECKED}; elas mudam, então confirme no site antes de usar.</p></div></div>`;

  /* ---- 2. Assistente ---- */
  function stepBody(n) {
    const a = A(), P = PV[a.provider], w = a.w, st = (a.provider === 'custom');
    const next = (lab, extra) => btn('ai-step', lab, `data-n="${Math.min(7, n + 1)}" ${extra || ''}`, 'pri');
    if (n === 1) return `<p style="margin:0 0 10px">Escolha o serviço de IA. Para começar sem pagar, prefira os marcados como gratuitos.</p><div class="ia-chips">${Object.keys(PV).map(k => `<button type="button" class="ia-chip ${k === a.provider && w.prov ? 'on' : ''}" data-act="ai-pick" data-p="${k}">${logo(k)}<span>${esc(PV[k].name)}</span></button>`).join('')}</div>`;
    if (n === 2) return st ? `<p style="margin:0">Este tipo não tem site fixo. Vá direto à etapa de configuração e informe o endereço da API.</p><div style="margin-top:10px">${btn('ai-mark', 'Entendi', 'data-k="site"', 'pri')}</div>` : `<p style="margin:0 0 10px">Abra o site oficial de <b>${esc(P.name)}</b> para conhecer o serviço e criar a sua conta.</p><div class="ia-row">${btn('ai-open', ic(IC.ext) + 'Abrir site oficial', `data-url="${P.site}" data-k="site"`, 'pri')}${btn('ai-copy', ic(IC.copy) + 'Copiar endereço', `data-t="${P.site}"`)}</div><p class="hint" style="margin:8px 0 0">O site abre numa aba do navegador. Ao fechar, você volta aqui, na mesma etapa.</p>`;
    if (n === 3) return `<p style="margin:0 0 10px">Crie a conta no site de <b>${esc(P.name)}</b>, se ainda não tiver. Use um e-mail seu e guarde a senha.</p>${P.warn ? `<p class="hint" style="margin:0 0 10px;color:var(--red-t)">${esc(P.warn)}</p>` : ''}<div class="ia-row">${P.site ? btn('ai-open', ic(IC.ext) + 'Abrir site oficial', `data-url="${P.site}"`) : ''}${btn('ai-mark', 'Já tenho conta', 'data-k="acct"', 'pri')}</div>`;
    if (n === 4) return `<p style="margin:0 0 10px">Abra a página de chaves, crie uma chave nova e copie.</p>${P.steps.length ? `<ol class="ia-ol">${P.steps.map(s => `<li><b>${esc(s[0])}.</b> ${esc(s[1])} ${uiChip(s[2])}</li>`).join('')}</ol>` : '<p class="hint">Use o que o seu serviço indicar.</p>'}<div class="ia-row">${P.keys ? btn('ai-open', ic(IC.key) + 'Abrir página da chave', `data-url="${P.keys}" data-k="keyp"`, 'pri') : ''}${P.keys ? btn('ai-copy', ic(IC.copy) + 'Copiar endereço', `data-t="${P.keys}"`) : ''}${btn('ai-mark', 'Já copiei a chave', 'data-k="copied"')}</div><p class="hint" style="margin:8px 0 0">A chave costuma aparecer uma única vez: copie antes de fechar a página.</p>`;
    if (n === 5) return `<p style="margin:0 0 10px">${a.hasKey ? 'Há uma chave salva neste aparelho.' : a.keyBuf ? 'Rascunho de chave guardado (cifrado). Falta salvar.' : 'Cole a chave no campo “Chave da API”.'}</p>${btn('ai-goto', 'Ir ao campo da chave', 'data-s="Configuração" data-f="ai-key"', 'pri')}`;
    if (n === 6) return `<p style="margin:0 0 10px">Modelo atual: <b>${esc(a.model || 'nenhum')}</b>. Escolha um dos recomendados.</p>${btn('ai-goto', 'Ver modelos', 'data-s="Modelos"', 'pri')}`;
    return `<p style="margin:0 0 10px">${done7() ? '✓ Tudo pronto. A IA está configurada e testada.' : 'Marque a ciência sobre o envio de dados, teste a conexão e salve.'}</p><div class="ia-row">${btn('ai-test', 'Testar conexão', '', 'pri')}${btn('ai-save', 'Salvar')}</div>`;
  }
  function secWizard() {
    const a = A(), d = stepsDone(), n = curStep(), pct = Math.round(d.filter(Boolean).length / 7 * 100);
    return sec('Assistente de configuração', 'list') + `<div class="card"><div class="stack" style="gap:12px">
      ${a.resume && !done7() ? `<div class="ia-resume" role="status">Você parou na <b>etapa ${curStepRaw()} de 7</b>. Continue de onde estava.</div>` : ''}
      <div class="ia-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progresso da configuração"><i style="width:${pct}%"></i></div>
      <ol class="ia-steps">${STEPS.map((t, i) => `<li><button type="button" class="ia-st ${d[i] ? 'done' : ''} ${i + 1 === n ? 'cur' : ''}" data-act="ai-step" data-n="${i + 1}" aria-current="${i + 1 === n ? 'step' : 'false'}"><b>${d[i] ? '✓' : i + 1}</b><span>${t}</span></button></li>`).join('')}</ol>
      <div class="ia-now"><div class="eyebrow">Etapa ${n} de 7 · ${STEPS[n - 1]}</div><div style="margin-top:8px">${stepBody(n)}</div></div>
      <div class="ia-row">${n > 1 ? btn('ai-step', 'Voltar', `data-n="${n - 1}"`) : ''}${n < 7 ? btn('ai-step', 'Pular para a próxima', `data-n="${n + 1}"`) : ''}</div></div></div>`;
  }
  const curStepRaw = () => { const d = stepsDone(), i = d.findIndex(x => !x); return i < 0 ? 7 : i + 1; };

  /* ---- 3. Provedores ---- */
  const secProv = () => sec('Provedores', 'globe') + `<div class="stack" style="gap:10px">${Object.keys(PV).map(k => { const P = PV[k], a = A(), on = a.provider === k;
    return `<div class="card ia-pc ${on ? 'sel' : ''}"><div class="ia-ph">${logo(k)}<div style="min-width:0"><b>${esc(P.name)}</b><div>${tier(P.tier)}</div></div></div>
      <p class="hint" style="margin:8px 0">${esc(P.sum)}</p>
      <div class="ia-row">${btn('ai-pick', on ? '✓ Escolhido' : 'Escolher', `data-p="${k}"`, on ? '' : 'pri')}${P.site ? btn('ai-open', ic(IC.ext) + 'Site', `data-url="${P.site}"`) : ''}${P.keys ? btn('ai-open', ic(IC.key) + 'Criar chave', `data-url="${P.keys}"`) : ''}${P.site ? btn('ai-copy', ic(IC.copy) + 'Copiar site', `data-t="${P.site}"`) : ''}</div>
      <details class="more" style="margin-top:10px"><summary>Passo a passo, limites e custos</summary><div class="stack" style="gap:10px;padding-bottom:12px">
        ${P.steps.length ? `<ol class="ia-ol">${P.steps.map(s => `<li><b>${esc(s[0])}.</b> ${esc(s[1])} ${uiChip(s[2])}</li>`).join('')}</ol>` : ''}
        <p class="hint" style="margin:0"><b>Limites:</b> ${esc(P.limits)}</p><p class="hint" style="margin:0"><b>Cobrança:</b> ${esc(P.cost)}</p>${P.warn ? `<p class="hint" style="margin:0;color:var(--red-t)"><b>Atenção:</b> ${esc(P.warn)}</p>` : ''}
        <p class="hint" style="margin:0">Os nomes dos botões nos sites podem mudar. Conferido em ${CHECKED}.</p></div></details></div>`; }).join('')}</div>`;

  /* ---- 4. Configuração ---- */
  function secConfig() {
    const a = A(), P = TB_PROVIDERS[a.provider], PD = PV[a.provider], ph = { custom: 'nome do modelo' }[a.provider] || ('ex.: ' + (defModel(a.provider) || 'nome-do-modelo'));
    const baseEx = P.base || 'https://api.exemplo.com/v1';
    return sec('Configuração', 'key') + `<div class="card"><div class="stack" style="gap:12px">
      <div class="field"><label class="fl" for="ai-prov">Provedor</label><select class="in" id="ai-prov">${Object.entries(TB_PROVIDERS).map(([k, v]) => `<option value="${k}" ${k === a.provider ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div>
      <p class="hint" style="margin:0">${esc(P.hint)}</p>
      <div class="field"><label class="fl" for="ai-base">Endereço da API ${a.provider === 'custom' ? '' : '(opcional: já vem preenchido)'}</label><input class="in" id="ai-base" type="url" inputmode="url" autocomplete="off" placeholder="${esc(baseEx)}" value="${esc(a.base)}"><p class="hint" style="margin:6px 0 0">Exemplo: ${esc(baseEx)}. Precisa começar com https://.</p></div>
      <div class="field"><label class="fl" for="ai-key">Chave da API</label><div class="ia-keyrow"><input class="in" id="ai-key" type="${a.showKey ? 'text' : 'password'}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${a.hasKey ? '•••••••• (chave salva; deixe vazio para manter)' : (PD.pre ? 'começa com ' + PD.pre : 'cole a chave aqui')}" value="${esc(a.keyBuf)}"><button type="button" class="btn" data-act="ai-eye" aria-label="${a.showKey ? 'Ocultar chave' : 'Mostrar chave'}" aria-pressed="${a.showKey}">${ic(IC.eye)}</button><button type="button" class="btn" data-act="ai-paste">Colar</button></div>
        <p class="hint" style="margin:6px 0 0" id="ai-keyhint">Copie a chave no site do provedor e toque em “Colar”. Sem espaços antes ou depois.</p></div>
      <div class="field"><label class="fl" for="ai-model">Modelo</label><input class="in" id="ai-model" list="ai-models" autocomplete="off" placeholder="${esc(ph)}" value="${esc(a.model)}"><datalist id="ai-models">${a.models.map(m => `<option value="${esc(m)}">`).join('')}</datalist><p class="hint" style="margin:6px 0 0">Toque em um modelo recomendado na seção Modelos, ou digite o nome.</p></div>
      <label class="chk"><input type="checkbox" id="ai-consent" ${a.consent ? 'checked' : ''}><span>Entendo que dados de saúde serão enviados ao provedor que escolhi quando eu usar a IA.</span></label>
      <div class="ia-row">${btn('ai-save', 'Salvar', '', 'pri')}${a.hasKey ? btn('ai-del', 'Remover chave', '', 'danger') : ''}</div></div></div>`;
  }

  /* ---- 5. Modelos ---- */
  const mRow = m => `<button type="button" class="ia-m ${A().model === m[0] ? 'on' : ''}" data-act="ai-mpick" data-m="${esc(m[0])}"><div class="ia-mh"><b>${esc(m[1])}</b>${m[5] ? '<span class="ia-rec">Recomendado</span>' : ''}</div><div class="ia-mi">${tier(m[2])}<span class="ia-c ${COMPAT[m[3]][1]}">${COMPAT[m[3]][0]}</span></div><div class="hint" style="margin:4px 0 0">${esc(PV[A().provider].name)} · ${esc(m[4])}</div></button>`;
  function secModels() {
    const a = A(), cur = MODELS[a.provider] || [], known = new Set(cur.map(m => m[0]));
    const others = a.models.filter(m => !known.has(m)).slice(0, 80), isOR = a.provider === 'openrouter', meta = (window.TB_AI.meta || {});
    const oRow = id => { const free = isOR && meta[id] ? meta[id].free : null, k = free === true ? 'lim' : free === false ? 'paid' : null; return `<button type="button" class="ia-m sm ${a.model === id ? 'on' : ''}" data-act="ai-mpick" data-m="${esc(id)}"><b>${esc(id)}</b>${k ? tier(k) : ''}</button>`; };
    return sec('Modelos', 'list') + `<div class="card"><div class="stack" style="gap:12px">
      <div class="ia-leg">${Object.keys(TIER).map(k => tier(k)).join('')}</div>
      <p class="hint" style="margin:0">Os recomendados aparecem primeiro. Conferido em ${CHECKED}; confirme as condições no site do provedor antes de usar.</p>
      ${cur.length ? `<div class="stack" style="gap:8px">${cur.map(mRow).join('')}</div>` : '<p class="hint" style="margin:0">Para este provedor eu não listo modelos fixos, porque os nomes mudam. Carregue a lista com a sua chave e escolha um com “mini” ou “small” no nome (mais baratos).</p>'}
      <details class="more"><summary>Ver outros modelos${others.length ? ' (' + others.length + ')' : ''}</summary><div class="stack" style="gap:8px;padding-bottom:12px">${btn('ai-models', 'Carregar lista do provedor (precisa da chave)')}<p class="hint" style="margin:0">${isOR ? 'No OpenRouter, o rótulo “Gratuito com limites” vem do preço zero informado por ele.' : 'Para este provedor a lista não informa se o modelo é gratuito: veja no site dele.'}</p>${others.length ? `<div class="stack" style="gap:6px">${others.map(oRow).join('')}</div>` : ''}</div></details></div></div>`;
  }

  /* ---- 6. Navegador ---- */
  const secBrowser = () => sec('Navegador interno', 'globe') + `<div class="card"><div class="stack" style="gap:10px">
    <p class="hint" style="margin:0">Abre os sites dos provedores numa <b>aba do navegador Chromium do Android</b> (Chrome Custom Tabs) por cima do TiaBete. Ela tem barra de endereço, botões de voltar e avançar, atualizar e copiar o link (no menu da aba). Ao fechar a aba (✕ ou botão voltar do celular), você volta ao TiaBete <b>exatamente onde estava</b>; o seu progresso fica salvo.</p>
    <div class="field"><label class="fl" for="ai-url">Abrir um endereço</label><input class="in" id="ai-url" type="url" inputmode="url" autocomplete="off" placeholder="https://aistudio.google.com" value="${esc(A().lastUrl)}"></div>
    <div class="ia-row">${btn('ai-browse', ic(IC.ext) + 'Abrir', '', 'pri')}${btn('ai-copy', ic(IC.copy) + 'Copiar endereço', 'data-from="ai-url"')}</div>
    <div class="ia-row">${Object.keys(PV).filter(k => PV[k].site).slice(0, 6).map(k => `<button type="button" class="ia-chip" data-act="ai-open" data-url="${PV[k].site}">${logo(k)}<span>${esc(PV[k].name.split(' ')[0])}</span></button>`).join('')}</div>
    <div class="ia-limit"><b>Limitação, explicada:</b> o Android não deixa embutir um Chromium completo dentro do app sem trazer um navegador inteiro junto, e os sites de login bloqueiam janelas embutidas por segurança. Por isso a aba abre por cima do TiaBete, e não dentro dele. O TiaBete <b>não vê</b> as páginas, senhas, cookies nem a chave exibida: é você quem copia e cola (botão “Colar” na Configuração).</div></div></div>`;

  /* ---- 7. Teste ---- */
  function connState() {
    const a = A(), t = a.w.tested;
    if (!a.hasKey) return ['off', 'Sem chave salva'];
    if (t && t.ok && a.saved) return ['ok', 'Conexão funcionando'];
    if (a.errCode) return ['bad', 'Falhou no último teste'];
    return ['wait', a.saved ? 'Salva, ainda não testada' : 'Chave salva, falta salvar o modelo'];
  }
  const HELP = { ai_auth: 'A chave foi recusada. Confira se copiou ela inteira, sem espaços, e se é do provedor escolhido.', rate_limited: 'Você atingiu o limite de pedidos. Espere alguns minutos ou escolha outro modelo.', ai_billing: 'O provedor pede crédito ou cobrança ativa. Confira o saldo na conta dele.', ai_model: 'Esse modelo não existe ou não está liberado para a sua chave. Escolha um da seção Modelos.', ai_network: 'Sem conexão com o provedor. Confira a internet e tente de novo.', ai_busy: 'O modelo está ocupado agora. Tente de novo em alguns minutos ou troque de modelo.', ai_insecure: 'O endereço precisa começar com https://.' };
  function secTest() {
    const a = A(), [k, tx] = connState(), t = a.w.tested;
    return sec('Teste de conexão', 'info') + `<div class="card"><div class="stack" style="gap:12px">
      <div class="ia-conn ${k}" role="status"><i></i><div><b>${tx}</b>${t && t.ts ? `<div class="hint" style="margin:2px 0 0">Último teste ${t.ok ? 'ok' : 'com falha'} em ${new Date(t.ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${t.ms ? ' · ' + (t.ms / 1000).toFixed(1).replace('.', ',') + ' s' : ''}</div>` : ''}</div></div>
      <p class="hint" style="margin:0">O teste faz um pedido <b>real</b> ao provedor com a chave e o modelo informados. Ele não acerta por simulação: se a chave, o modelo ou a internet falhar, aparece o motivo.</p>
      ${a.msg ? `<p class="ia-msg ${a.ok ? 'ok' : 'bad'}" role="${a.ok ? 'status' : 'alert'}">${esc(scrub(a.msg))}</p>` : ''}${a.errCode && HELP[a.errCode] ? `<p class="hint" style="margin:0"><b>O que fazer:</b> ${esc(HELP[a.errCode])}</p>` : ''}
      <div class="ia-row">${btn('ai-test', 'Testar conexão', '', 'pri')}</div>
      <details class="more"><summary>Erros mais comuns</summary><ul class="ia-ul"><li><b>Chave recusada:</b> chave copiada incompleta, com espaço, ou de outro provedor.</li><li><b>Limite atingido:</b> espere, ou troque de modelo.</li><li><b>Falta de crédito:</b> adicione crédito na conta do provedor (ou use um modelo gratuito).</li><li><b>Modelo não encontrado:</b> escolha outro em Modelos; modelos antigos são desativados.</li><li><b>Sem conexão:</b> confira a internet do celular.</li></ul></details></div></div>`;
  }
  const secSecurity = () => sec('Segurança das suas chaves', 'lock') + `<div class="card"><ul class="ia-ul">
    <li>A chave fica <b>cifrada</b> neste aparelho (AES-GCM, com chave que o app não consegue exportar).</li>
    <li>Ela <b>não entra em backups</b>, relatórios, Google Drive nem mensagens de erro. Mesmo o rascunho da chave é guardado cifrado.</li>
    <li>O TiaBete não tem servidor: os pedidos vão <b>direto do seu celular ao provedor</b>, só por https.</li>
    <li>O navegador interno <b>não lê</b> páginas, senhas, cookies nem chaves. Você copia e cola.</li>
    <li>Quando você usa a IA, o conteúdo necessário (resumos de registros, texto de exames sem CPF e e-mail, nomes de alimentos) é enviado ao provedor. Cada provedor tem as próprias regras.</li>
    <li>Se achar que a chave vazou, apague-a no site do provedor e use “Remover chave” aqui.</li></ul></div>`;

  VIEWS.ia = function () {
    const a = A(); if (!a.loaded) aiLoad(); ensureStyle();
    return banners() + secIntro() + secWizard() + secProv() + secConfig() + secModels() + secBrowser() + secTest() + secSecurity() +
      `<p class="hint" style="margin:12px 0 0">As respostas da IA podem conter erros. Não use para decidir doses nem mudar o tratamento: siga sempre o plano da sua equipe de saúde. Em emergência, ligue 192 (SAMU).</p>`;
  };

  /* ---- ações ---- */
  const grab = () => {
    const a = A(), v = id => { const e = document.getElementById(id); return e ? e.value.trim() : null; };
    if (document.getElementById('ai-prov')) { a.base = v('ai-base') || ''; a.model = v('ai-model') || ''; a.consent = document.getElementById('ai-consent').checked; const k = v('ai-key'); if (k !== null) a.keyBuf = k; }
    return { key: a.keyBuf };
  };
  const done = (ok, msg, code) => { const a = A(); a.busy = false; a.ok = ok; a.msg = msg; a.errCode = ok ? '' : (code || ''); render(); };
  const check = (base, provider) => (base && !/^https:\/\//i.test(base)) ? 'O endereço precisa começar com https://.' : (provider === 'custom' && !base) ? 'Informe o endereço da API.' : '';
  const openSec = (name, focus) => setTimeout(() => {
    const h = [...document.querySelectorAll('h2.acc-h')].find(x => x.textContent.trim().startsWith(name)); if (h) { if (h.getAttribute('aria-expanded') !== 'true') accToggle(h, true); h.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    if (focus) setTimeout(() => { const f = document.getElementById(focus); if (f) f.focus({ preventScroll: true }); }, 350);
  }, 60);
  const copy = async t => { try { await navigator.clipboard.writeText(t); toast('Endereço copiado.'); } catch (e) { toast('Não foi possível copiar. Selecione o endereço e copie.'); } };
  const B = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Browser;
  let browserHooked = false;
  async function openUrl(url) {
    if (!/^https:\/\//i.test(url)) { toast('Só abro endereços que começam com https://.'); return; }
    A().lastUrl = url; const b = B();
    if (b) {
      if (!browserHooked && b.addListener) { browserHooked = true; b.addListener('browserFinished', () => { if (S.route === 'ia') { toast('Você voltou ao TiaBete. Continue na etapa ' + curStep() + '.'); render(); } }); }
      await b.open({ url });
    } else window.open(url, '_blank');
  }
  function setProvider(p, mark) {
    const a = A(); grab(); if (a.provider !== p) { a.provider = p; a.models = []; a.base = ''; a.model = defModel(p); a.msg = ''; a.errCode = ''; Object.assign(a.w, { site: false, acct: false, keyp: false, copied: false, model: false, tested: null }); a.saved = false; }
    if (mark) a.w.prov = true; a.w.view = 0; saveWiz(); render();
  }
  const keyWarn = () => { const a = A(), h = document.getElementById('ai-keyhint'), pre = PV[a.provider].pre; if (!h) return; const k = (document.getElementById('ai-key') || {}).value || ''; h.textContent = k && pre && !k.startsWith(pre) ? 'Atenção: chaves deste provedor costumam começar com ' + pre + '. Confira se copiou a chave certa.' : /\s/.test(k) ? 'A chave tem espaço no meio: confira se copiou inteira.' : 'Copie a chave no site do provedor e toque em “Colar”. Sem espaços antes ou depois.'; };
  let dt = null;
  document.addEventListener('input', e => {
    const a = A(), id = e.target.id;
    if (id === 'ai-key') { a.keyBuf = e.target.value.trim(); keyWarn(); clearTimeout(dt); dt = setTimeout(async () => { try { if (a.keyBuf) await SEC().set('ai-key-draft', a.keyBuf); else await SEC().del('ai-key-draft'); } catch (x) { } }, 500); }
    else if (id === 'ai-model') { a.model = e.target.value.trim(); a.w.model = !!a.model; clearTimeout(dt); dt = setTimeout(saveWiz, 500); }
    else if (id === 'ai-base') { a.base = e.target.value.trim(); clearTimeout(dt); dt = setTimeout(saveWiz, 500); }
  });
  document.addEventListener('change', e => { if (e.target.id === 'ai-prov') setProvider(e.target.value, true); });
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-act^="ai-"]'); if (!el) return;
    const act = el.dataset.act, a = A(), d = el.dataset;
    try {
      if (act === 'ai-pick') { setProvider(d.p, true); if (!a.w.view) a.w.view = 0; return; }
      if (act === 'ai-step') { a.w.view = +d.n; render(); return; }
      if (act === 'ai-mark') { a.w[d.k] = true; a.w.view = 0; saveWiz(); render(); return; }
      if (act === 'ai-open') { if (d.k) { a.w[d.k] = true; a.w.view = 0; saveWiz(); render(); } await openUrl(d.url); return; }
      if (act === 'ai-copy') { const t = d.t || (document.getElementById(d.from) || {}).value || ''; if (!t) { toast('Não há endereço para copiar.'); return; } await copy(t); return; }
      if (act === 'ai-goto') { openSec(d.s, d.f); return; }
      if (act === 'ai-browse') { let u = (document.getElementById('ai-url').value || '').trim(); if (u && !/^[a-z]+:\/\//i.test(u)) u = 'https://' + u; await openUrl(u); return; }
      if (act === 'ai-eye') { grab(); a.showKey = !a.showKey; const i = document.getElementById('ai-key'); if (i) { i.type = a.showKey ? 'text' : 'password'; el.setAttribute('aria-pressed', a.showKey); el.setAttribute('aria-label', a.showKey ? 'Ocultar chave' : 'Mostrar chave'); } return; }
      if (act === 'ai-paste') { try { const t = ((await navigator.clipboard.readText()) || '').trim(); if (!t) { toast('A área de transferência está vazia. Copie a chave primeiro.'); return; } a.keyBuf = t; const i = document.getElementById('ai-key'); if (i) i.value = t; keyWarn(); await SEC().set('ai-key-draft', t); toast('Chave colada. Não esqueça de salvar.'); render(); } catch (x) { toast('Não consegui ler a área de transferência. Cole manualmente no campo.'); } return; }
      if (act === 'ai-mpick') { grab(); a.model = d.m; a.w.model = true; a.w.view = 0; saveWiz(); render(); return; }
      const { key } = grab();
      if (act === 'ai-models') {
        const k = key || await SEC().get('ai-key'), err = check(a.base, a.provider);
        if (err) return done(false, err);
        if (!k) return done(false, 'Cole a chave antes de carregar a lista de modelos.');
        a.busy = true; a.msg = ''; render();
        try { a.models = await TB_AI.listModels(a.provider, a.base, k); if (a.provider === 'openrouter') a.models.sort((x, y) => (/:free$/.test(y) ? 1 : 0) - (/:free$/.test(x) ? 1 : 0) || x.localeCompare(y)); done(true, a.models.length ? a.models.length + ' modelos carregados. Veja em “Ver outros modelos” ou toque no campo Modelo.' : 'Nenhum modelo encontrado para esta chave.'); }
        catch (x) { done(false, x.aiMsg || 'Não foi possível carregar a lista.', x.code); }
      } else if (act === 'ai-save') {
        const err = check(a.base, a.provider); if (err) return done(false, err);
        if (!a.model) return done(false, 'Informe o modelo.');
        if (!a.consent) return done(false, 'Marque a caixa de ciência sobre o envio de dados para salvar.');
        if (!key && !a.hasKey) return done(false, 'Cole a chave da API.');
        a.busy = true; render();
        if (key) { await SEC().set('ai-key', key); a.hasKey = true; await SEC().del('ai-key-draft'); a.keyBuf = ''; }
        await SEC().setCfg('ai', { provider: a.provider, base: a.base, model: a.model, consent: true }); a.saved = true; a.w.model = true; a.w.view = 0; await saveWiz();
        done(true, a.w.tested && a.w.tested.ok ? 'Configuração salva.' : 'Configuração salva. Agora toque em “Testar conexão”.');
      } else if (act === 'ai-test') {
        const k = key || await SEC().get('ai-key'), err = check(a.base, a.provider);
        if (err) return done(false, err);
        if (!k || !a.model) return done(false, 'Informe o modelo e a chave antes de testar.');
        a.busy = true; a.msg = ''; render(); const t0 = Date.now();
        try { await TB_AI.test(a.provider, a.base, k, a.model); a.w.tested = { ok: true, ts: Date.now(), ms: Date.now() - t0 }; await saveWiz(); done(true, a.saved ? 'Conexão funcionando.' : 'Conexão funcionando. Falta salvar a configuração.'); }
        catch (x) {
          a.w.tested = { ok: false, ts: Date.now(), ms: Date.now() - t0 }; await saveWiz();
          if (x && x.code === 'ai_model') {
            try { a.models = await TB_AI.listModels(a.provider, a.base, k); } catch (y) { }
            return done(false, 'Este modelo não existe mais ou não está liberado para a sua chave.' + (a.models.length ? ' Carreguei ' + a.models.length + ' modelos: escolha um em Modelos → Ver outros modelos.' : ' Toque em “Carregar lista do provedor” em Modelos.'), 'ai_model');
          }
          done(false, x.aiMsg || 'Falha no teste.', x.code || 'ai_http');
        }
      } else if (act === 'ai-del') {
        await SEC().del('ai-key'); await SEC().del('ai-key-draft'); a.hasKey = false; a.saved = false; a.keyBuf = ''; a.w.tested = null; a.w.copied = false; await saveWiz(); done(true, 'Chave removida deste aparelho.');
      }
    } catch (x) { console.error(x && x.code ? x.code : 'erro'); done(false, 'Algo deu errado. Tente de novo.'); }
  });

  /* ---- estilo (só desta tela) ---- */
  function ensureStyle() {
    if (document.getElementById('ia-css')) return; const s = document.createElement('style'); s.id = 'ia-css';
    s.textContent = `
.ia-row{display:flex;flex-wrap:wrap;gap:8px}.ia-row .btn{display:inline-flex;align-items:center;gap:6px;flex:1 1 auto;justify-content:center}
.ia-logo{width:36px;height:36px;border-radius:10px;color:#fff;font:700 13px var(--f-display);display:inline-flex;align-items:center;justify-content:center;flex:none}
.ia-ph{display:flex;align-items:center;gap:12px}.ia-pc.sel{border-color:var(--red)}
.ia-t{display:inline-block;font:600 11.5px var(--f-mono);padding:2px 8px;border-radius:99px;border:1px solid var(--line);margin-top:3px;white-space:nowrap}
.ia-t.free{color:var(--good);border-color:var(--good-bd);background:var(--good-bg)}.ia-t.lim{color:var(--good);border-color:var(--good-bd)}.ia-t.paid{color:var(--mut)}.ia-t.cred{color:var(--red-t);border-color:var(--low-bd);background:var(--low-bg)}
.ia-leg{display:flex;flex-wrap:wrap;gap:6px}.ia-leg .ia-t{margin:0}
.ia-chips{display:flex;flex-wrap:wrap;gap:8px}.ia-chip{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--line);border-radius:12px;background:var(--s1);color:var(--fg);font:600 13px var(--f-body);cursor:pointer}.ia-chip.on{border-color:var(--red);box-shadow:0 0 0 1px var(--red) inset}.ia-chip .ia-logo{width:26px;height:26px;font-size:11px;border-radius:8px}
.ia-bar{height:8px;border-radius:99px;background:var(--s2);overflow:hidden}.ia-bar i{display:block;height:100%;background:var(--red);border-radius:99px;transition:width .3s}
.ia-steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px}
.ia-st{width:100%;display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--line);border-radius:12px;background:var(--s1);color:var(--mut);font:600 12.5px var(--f-body);text-align:left;cursor:pointer}
.ia-st b{width:22px;height:22px;border-radius:50%;border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;font:700 11px var(--f-mono);flex:none}
.ia-st.done{color:var(--fg)}.ia-st.done b{background:var(--good);border-color:var(--good);color:#fff}.ia-st.cur{border-color:var(--red);color:var(--fg)}.ia-st.cur b{border-color:var(--red);color:var(--red-t)}
.ia-now{border:1px solid var(--line);border-radius:14px;padding:14px;background:var(--s1)}.ia-resume{border:1px solid var(--red);border-radius:12px;padding:10px 12px;font-size:13.5px;background:var(--low-bg)}
.ia-ol{margin:0 0 10px;padding-left:20px;display:flex;flex-direction:column;gap:8px}.ia-ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px;font-size:14px}
.ia-ui{display:inline-block;font:600 11.5px var(--f-mono);padding:1px 8px;border-radius:7px;border:1px dashed var(--line);background:var(--s2);color:var(--fg);white-space:nowrap}
.ia-keyrow{display:flex;gap:8px}.ia-keyrow .in{flex:1;min-width:0}
.ia-m{width:100%;text-align:left;border:1px solid var(--line);border-radius:14px;background:var(--s1);color:var(--fg);padding:12px;cursor:pointer;font:inherit}.ia-m.on{border-color:var(--red);box-shadow:0 0 0 1px var(--red) inset}.ia-m.sm{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;font-size:13px;overflow-wrap:anywhere}
.ia-mh{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ia-rec{font:600 11px var(--f-mono);color:#fff;background:var(--red);padding:1px 8px;border-radius:99px}.ia-mi{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px}
.ia-c{font:600 11.5px var(--f-mono);color:var(--mut)}.ia-c.ok{color:var(--good)}
.ia-limit{border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:13px;color:var(--mut)}
.ia-conn{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--line);border-radius:14px}.ia-conn i{width:14px;height:14px;border-radius:50%;background:var(--mut);flex:none}.ia-conn.ok{border-color:var(--good-bd)}.ia-conn.ok i{background:var(--good)}.ia-conn.bad{border-color:var(--low-bd)}.ia-conn.bad i{background:var(--red)}.ia-conn.wait i{background:#e0a21e}
.ia-msg{margin:0;font-size:13.5px}.ia-msg.bad{color:var(--red-t)}.ia-msg.ok{color:var(--good)}
h2.sec svg{vertical-align:-4px;margin-right:8px;color:var(--red-l)}`;
    document.head.appendChild(s);
  }
}
