/* TiaBete (APK) · tela "Inteligência artificial" (Mais). Escolha do provedor, modelo e chave própria.
   A chave é guardada cifrada no aparelho (ver ai-core.js) e nunca entra em backups nem em relatórios. */
if (window.TB_PUBLIC && window.TB_AI) {
  TITLES.ia = 'Inteligência artificial';
  S.ai = { loaded: false, provider: 'anthropic', base: '', model: '', hasKey: false, models: [], busy: false, msg: '', ok: false, consent: false };
  const A = () => S.ai;
  async function aiLoad() {
    const a = A(); a.loaded = true;
    try {
      const c = await TB_SECURE.getCfg('ai'); a.hasKey = await TB_SECURE.has('ai-key');
      if (c) { a.provider = c.provider || 'anthropic'; a.base = c.base || ''; a.model = c.model || ''; a.consent = !!c.consent; }
      else a.model = TB_PROVIDERS.anthropic.model;
    } catch (e) { a.msg = 'Não foi possível ler as configurações guardadas.'; }
    if (S.route === 'ia') render();
  }

  const GUIDE = {
    openrouter: { t: 'OpenRouter (tem modelos gratuitos, o mais fácil para começar)', url: 'https://openrouter.ai/keys', link: 'openrouter.ai/keys', steps: [
      'Toque em “Abrir a página da chave” abaixo. Entre com a sua conta Google (botão “Sign in”).',
      'Toque em “Create Key”, dê qualquer nome (por exemplo TiaBete) e toque em “Create”.',
      'Copie a chave que aparece (começa com sk-or-). Ela só é mostrada uma vez: copie agora.',
      'Volte ao TiaBete, escolha o provedor “OpenRouter” e cole a chave no campo “Chave da API”.',
      'Toque em “Carregar lista de modelos” e, no campo Modelo, escolha um que termine em “:free” (esses são gratuitos).',
      'Marque a caixa de ciência, toque em “Salvar” e depois em “Testar conexão”.'], note: 'Os modelos “:free” têm limite de uso por dia e às vezes ficam lentos ou ocupados. Se um falhar, tente outro da lista.' },
    gemini: { t: 'Google Gemini', url: 'https://aistudio.google.com/apikey', link: 'aistudio.google.com/apikey', steps: [
      'Toque em “Abrir a página da chave” abaixo e entre com a sua conta Google.',
      'Toque em “Criar chave de API” (Create API key). Se pedir um projeto, escolha o que já existe ou crie um novo.',
      'Copie a chave (começa com AIza).',
      'Volte ao TiaBete, escolha “Google Gemini”, cole a chave e toque em “Carregar lista de modelos”.',
      'Escolha um modelo da lista (prefira os que têm “flash” no nome), marque a ciência, toque em “Salvar” e “Testar conexão”.'], note: 'O plano gratuito do Gemini pode usar o conteúdo para melhorar produtos do Google e, em algumas contas e regiões, não funciona. Se der erro em qualquer modelo, use o OpenRouter.' },
    anthropic: { t: 'Claude (Anthropic)', url: 'https://console.anthropic.com/settings/keys', link: 'console.anthropic.com', steps: [
      'Toque em “Abrir a página da chave” abaixo e crie uma conta (ou entre) no console da Anthropic.',
      'Em “Plans & Billing” (cobrança), adicione crédito. O mínimo costuma ser poucos dólares e dura bastante para uso pessoal.',
      'Em “API keys”, toque em “Create Key”, dê um nome e copie a chave (começa com sk-ant-).',
      'Volte ao TiaBete, escolha “Claude (Anthropic)” e cole a chave. O modelo sugerido já vem preenchido.',
      'Marque a ciência, toque em “Salvar” e “Testar conexão”.'], note: 'A assinatura do Claude (Pro ou Max) não vale aqui: a API é uma conta separada, paga por uso.' },
    openai: { t: 'ChatGPT (OpenAI)', url: 'https://platform.openai.com/api-keys', link: 'platform.openai.com/api-keys', steps: [
      'Toque em “Abrir a página da chave” abaixo e entre na plataforma da OpenAI.',
      'Em “Billing”, adicione crédito (a API é paga por uso, separada da assinatura do ChatGPT).',
      'Em “API keys”, toque em “Create new secret key”, dê um nome e copie a chave (começa com sk-).',
      'Volte ao TiaBete, escolha “ChatGPT (OpenAI)”, cole a chave e toque em “Carregar lista de modelos”.',
      'Escolha um modelo pequeno (por exemplo com “mini” no nome), marque a ciência, toque em “Salvar” e “Testar conexão”.'], note: '' },
    custom: { t: 'Outro serviço compatível', url: '', link: '', steps: ['Informe o endereço https:// da API do serviço, o nome do modelo e a chave que ele fornecer.', 'Marque a ciência, toque em “Salvar” e “Testar conexão”.'], note: 'Serve para serviços compatíveis com o formato da OpenAI. Endereços sem https:// não são aceitos.' },
  };
  const aiGuide = p => { const g = GUIDE[p]; return `<div class="stack" style="gap:10px"><p style="margin:0"><b>${esc(g.t)}</b></p><ol class="plain" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">${g.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>${g.note ? `<p class="hint" style="margin:0">${esc(g.note)}</p>` : ''}${g.url ? `<button class="btn full" data-act="ai-open" data-url="${esc(g.url)}">Abrir a página da chave (${esc(g.link)})</button>` : ''}</div>`; };
  VIEWS.ia = function () {
    const a = A(); if (!a.loaded) aiLoad();
    const P = TB_PROVIDERS[a.provider], ph = { openai: 'ex.: gpt-4o-mini', gemini: 'ex.: gemini-2.0-flash', openrouter: 'ex.: openai/gpt-4o-mini', custom: 'nome do modelo', anthropic: 'claude-haiku-5-5' }[a.provider];
    const status = a.hasKey ? `<span class="pill ok">Configurada</span>` : `<span class="pill">Sem chave</span>`;
    return banners() + `
    <div class="card"><p class="hint" style="margin:0">A IA do TiaBete usa <b>a sua própria chave</b> de um provedor à sua escolha. Ela alimenta a análise de exames, as perguntas sobre seus registros e o cálculo de carboidratos dos alimentos. O uso é cobrado pelo provedor na sua conta, não pelo TiaBete. Estado: ${status}</p></div>
    <h2 class="sec">Qual escolher?</h2>
    <div class="card"><p class="hint" style="margin:0"><b>Mais fácil e gratuito:</b> OpenRouter (modelos “:free”). <b>Mais estável:</b> Claude ou ChatGPT, que cobram por uso (centavos por consulta, com crédito pré-pago). <b>Gemini</b> tem plano gratuito, mas pode falhar conforme a conta e a região. Escolha o provedor abaixo e siga o passo a passo.</p></div>
    <h2 class="sec">Passo a passo da chave</h2>
    <div class="card">${aiGuide(a.provider)}</div>
    <h2 class="sec">Provedor e modelo</h2>
    <div class="card"><div class="stack" style="gap:12px">
      <div class="field"><label class="fl" for="ai-prov">Provedor</label><select class="in" id="ai-prov">${Object.entries(TB_PROVIDERS).map(([k, v]) => `<option value="${k}" ${k === a.provider ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div>
      <p class="hint" style="margin:0">${esc(P.hint)}</p>
      <div class="field"><label class="fl" for="ai-base">Endereço da API ${a.provider === 'custom' ? '' : '(opcional)'}</label><input class="in" id="ai-base" type="url" inputmode="url" autocomplete="off" placeholder="${esc(P.base || 'https://…/v1')}" value="${esc(a.base)}"></div>
      <div class="field"><label class="fl" for="ai-model">Modelo</label><input class="in" id="ai-model" list="ai-models" autocomplete="off" placeholder="${esc(ph)}" value="${esc(a.model)}"><datalist id="ai-models">${a.models.map(m => `<option value="${esc(m)}">`).join('')}</datalist></div>
      <button class="btn full" data-act="ai-models" ${a.busy ? 'disabled' : ''}>Carregar lista de modelos</button>
      <div class="field"><label class="fl" for="ai-key">Chave da API</label><input class="in" id="ai-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${a.hasKey ? '•••••••• (chave salva; deixe vazio para manter)' : 'cole a chave aqui'}"></div>
    </div></div>
    <h2 class="sec">Privacidade</h2>
    <div class="card"><div class="stack" style="gap:12px">
      <p class="hint" style="margin:0">Quando você usa um recurso de IA, o conteúdo necessário (texto de exames sem CPF e e-mail, registros resumidos, nome de alimentos) é enviado <b>direto do seu aparelho ao provedor escolhido</b>. O TiaBete não tem servidor e não vê isso. Cada provedor tem as próprias regras de uso e guarda de dados; consulte-as. A chave fica cifrada neste aparelho, fora dos backups. Só endereços https:// são aceitos.</p>
      <label class="chk"><input type="checkbox" id="ai-consent" ${a.consent ? 'checked' : ''}><span>Entendo que dados de saúde serão enviados ao provedor que escolhi quando eu usar a IA.</span></label>
      <div class="stack" style="gap:8px"><button class="btn pri full" data-act="ai-save" ${a.busy ? 'disabled' : ''}>Salvar</button><button class="btn full" data-act="ai-test" ${a.busy ? 'disabled' : ''}>Testar conexão</button>${a.hasKey ? '<button class="btn full" data-act="ai-del" ' + (a.busy ? 'disabled' : '') + '>Remover chave deste aparelho</button>' : ''}</div>
      ${a.msg ? `<p class="hint" style="margin:0;${a.ok ? '' : 'color:var(--red-t)'}" role="${a.ok ? 'status' : 'alert'}">${esc(a.msg)}</p>` : ''}
    </div></div>
    <p class="hint" style="margin:12px 0 0">As respostas da IA podem conter erros. Não use para decidir doses nem mudar o tratamento: siga sempre o plano da sua equipe de saúde. Em emergência, ligue 192 (SAMU).</p>`;
  };
  const grab = () => {
    const a = A(), v = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    if (document.getElementById('ai-prov')) { a.base = v('ai-base'); a.model = v('ai-model'); a.consent = document.getElementById('ai-consent').checked; }
    return { key: v('ai-key') };
  };
  const done = (ok, msg) => { const a = A(); a.busy = false; a.ok = ok; a.msg = msg; render(); };
  const check = (base, provider) => {
    if (base && !/^https:\/\//i.test(base)) return 'O endereço precisa começar com https://.';
    if (provider === 'custom' && !base) return 'Informe o endereço da API.';
    return '';
  };
  document.addEventListener('change', e => {
    if (e.target.id === 'ai-prov') {
      const a = A(); grab(); a.provider = e.target.value; a.models = []; a.msg = ''; a.base = '';
      a.model = TB_PROVIDERS[a.provider].model || ''; render();
    }
  });
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-act^="ai-"]'); if (!el) return;
    const act = el.dataset.act, a = A(), { key } = grab();
    try {
      if (act === 'ai-open') { const B = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Browser; if (B) await B.open({ url: el.dataset.url }); else window.open(el.dataset.url, '_blank'); return; }
      if (act === 'ai-models') {
        const k = key || await TB_SECURE.get('ai-key'), err = check(a.base, a.provider);
        if (err) { return done(false, err); }
        a.busy = true; a.msg = ''; render();
        try { a.models = await TB_AI.listModels(a.provider, a.base, k); if (a.provider === 'openrouter') a.models.sort((x, y) => (/:free$/.test(y) ? 1 : 0) - (/:free$/.test(x) ? 1 : 0) || x.localeCompare(y)); done(true, a.models.length ? a.models.length + ' modelos carregados. Toque no campo Modelo para escolher.' : 'Nenhum modelo retornado. Digite o nome do modelo à mão.'); }
        catch (x) { done(false, x.aiMsg || 'Não foi possível carregar a lista.'); }
      } else if (act === 'ai-save') {
        const err = check(a.base, a.provider); if (err) return done(false, err);
        if (!a.model) return done(false, 'Informe o modelo.');
        if (!a.consent) return done(false, 'Marque a caixa de ciência sobre o envio de dados para salvar.');
        if (!key && !a.hasKey) return done(false, 'Cole a chave da API.');
        a.busy = true; render();
        if (key) { await TB_SECURE.set('ai-key', key); a.hasKey = true; }
        await TB_SECURE.setCfg('ai', { provider: a.provider, base: a.base, model: a.model, consent: true });
        done(true, 'Configuração salva. Use “Testar conexão” para conferir.');
      } else if (act === 'ai-test') {
        const k = key || await TB_SECURE.get('ai-key'), err = check(a.base, a.provider);
        if (err) return done(false, err);
        if (!k || !a.model) return done(false, 'Informe o modelo e a chave antes de testar.');
        a.busy = true; a.msg = ''; render();
        try { await TB_AI.test(a.provider, a.base, k, a.model); done(true, 'Conexão funcionando. Lembre-se de salvar.'); }
        catch (x) {
          if (x && x.code === 'ai_model') {
            try { a.models = await TB_AI.listModels(a.provider, a.base, k); } catch (y) { }
            return done(false, 'Este modelo não existe mais ou não está liberado para a sua chave (modelos antigos são desativados pelo provedor).' + (a.models.length ? ' Carreguei ' + a.models.length + ' modelos disponíveis: toque no campo Modelo, apague o texto e escolha um da lista.' : ' Toque em “Carregar lista de modelos” e escolha um.'));
          }
          done(false, x.aiMsg || 'Falha no teste.');
        }
      } else if (act === 'ai-del') {
        await TB_SECURE.del('ai-key'); a.hasKey = false; done(true, 'Chave removida deste aparelho.');
      }
    } catch (x) { console.error(x); done(false, 'Algo deu errado. Tente de novo.'); }
  });
}
