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
  VIEWS.ia = function () {
    const a = A(); if (!a.loaded) aiLoad();
    const P = TB_PROVIDERS[a.provider], ph = { openai: 'ex.: gpt-4o-mini', gemini: 'ex.: gemini-2.0-flash', openrouter: 'ex.: openai/gpt-4o-mini', custom: 'nome do modelo', anthropic: 'claude-haiku-5-5' }[a.provider];
    const status = a.hasKey ? `<span class="pill ok">Configurada</span>` : `<span class="pill">Sem chave</span>`;
    return banners() + `
    <div class="card"><p class="hint" style="margin:0">A IA do TiaBete usa <b>a sua própria chave</b> de um provedor à sua escolha. Ela alimenta a análise de exames, as perguntas sobre seus registros e o cálculo de carboidratos dos alimentos. O uso é cobrado pelo provedor na sua conta, não pelo TiaBete. Estado: ${status}</p></div>
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
      if (act === 'ai-models') {
        const k = key || await TB_SECURE.get('ai-key'), err = check(a.base, a.provider);
        if (err) { return done(false, err); }
        a.busy = true; a.msg = ''; render();
        try { a.models = await TB_AI.listModels(a.provider, a.base, k); done(true, a.models.length ? a.models.length + ' modelos carregados. Toque no campo Modelo para escolher.' : 'Nenhum modelo retornado. Digite o nome do modelo à mão.'); }
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
