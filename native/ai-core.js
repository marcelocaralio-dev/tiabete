/* TiaBete (APK) · camada de IA com chave própria do usuário.
   Define `window.claude` com a mesma interface usada pelo app web (capacidade "sample"), mas falando direto com o provedor
   escolhido (Claude/Anthropic, OpenAI, Google Gemini, OpenRouter ou outro compatível com OpenAI). Nada passa por servidor do projeto.
   Segurança: a chave fica cifrada (AES-GCM, chave não exportável do WebCrypto) num banco separado do aparelho, fora de backups.
   Só HTTPS. Este arquivo roda ANTES do app (precisa existir quando o app calcula HAS_CLAUDE). */
(function () {
  if (!window.TB_PUBLIC) return;

  /* ---------- cofre local (cifrado) ---------- */
  const SEC = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((ok, no) => {
      const r = indexedDB.open('tb-secure', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('k');
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
    }));
    const tx = async (mode, f) => { const db = await open(); return new Promise((ok, no) => { const t = db.transaction('k', mode), q = f(t.objectStore('k')); t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error); }); };
    const raw = { get: k => tx('readonly', s => s.get(k)), set: (k, v) => tx('readwrite', s => s.put(v, k)), del: k => tx('readwrite', s => s.delete(k)) };
    async function master() {
      let k = await raw.get('master');
      if (!k) { k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); await raw.set('master', k); }
      return k;
    }
    return {
      async set(name, text) {
        const k = await master(), iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(text));
        await raw.set('s:' + name, { iv, ct });
      },
      async get(name) {
        const v = await raw.get('s:' + name); if (!v) return null;
        try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: v.iv }, await master(), v.ct)); } catch (e) { return null; }
      },
      async has(name) { return !!(await raw.get('s:' + name)); },
      async del(name) { await raw.del('s:' + name); },
      /* configurações que não são segredo (provedor, modelo, ID de cliente) */
      async getCfg(name) { try { return (await raw.get('c:' + name)) || null; } catch (e) { return null; } },
      async setCfg(name, v) { await raw.set('c:' + name, v); },
    };
  })();
  window.TB_SECURE = SEC;

  /* ---------- HTTP (nativo quando possível, para não esbarrar em CORS) ---------- */
  const isHttps = u => /^https:\/\//i.test(u);
  async function http(url, o) {
    o = o || {};
    if (!isHttps(url)) throw { code: 'ai_insecure', aiMsg: 'Por segurança, só são aceitos endereços que começam com https://.' };
    const method = o.method || 'POST', headers = Object.assign({}, o.headers), P = window.Capacitor && window.Capacitor.Plugins, CH = P && P.CapacitorHttp;
    const abort = o.signal ? new Promise((_, no) => { if (o.signal.aborted) no({ code: 'aborted' }); o.signal.addEventListener('abort', () => no({ code: 'aborted' })); }) : null;
    const run = (async () => {
      if (CH && CH.request) {
        const r = await CH.request({ url, method, headers, data: o.body, responseType: o.text ? 'text' : 'json', connectTimeout: 30000, readTimeout: 180000 });
        let d = r.data;
        if (!o.text && typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { } }
        if (o.text && d && typeof d === 'object') d = JSON.stringify(d);
        return { status: r.status, data: d };
      }
      const form = /x-www-form-urlencoded/i.test(headers['content-type'] || headers['Content-Type'] || '');
      const fb = o.body == null ? undefined : typeof o.body === 'string' ? o.body : form ? new URLSearchParams(o.body).toString() : JSON.stringify(o.body);
      const r = await fetch(url, { method, headers, body: fb, signal: o.signal });
      const t = await r.text(); let d = t; if (!o.text) { try { d = JSON.parse(t); } catch (e) { } }
      return { status: r.status, data: d };
    })();
    try { return await (abort ? Promise.race([run, abort]) : run); }
    catch (e) { if (e && (e.code === 'aborted' || e.aiMsg)) throw e; throw { code: 'ai_network', aiMsg: 'Não consegui falar com o provedor de IA. Verifique a internet e tente de novo.' + (e && (e.message || e.errorMessage) ? ' (' + String(e.message || e.errorMessage).slice(0, 80) + ')' : '') }; }
  }
  window.TB_HTTP = http;

  /* ---------- provedores ---------- */
  const PROVIDERS = {
    anthropic: { name: 'Claude (Anthropic)', kind: 'anthropic', base: 'https://api.anthropic.com/v1', model: 'claude-haiku-5-5', hint: 'Chave em console.anthropic.com → API keys. Exige crédito pré-pago.' },
    openai: { name: 'ChatGPT (OpenAI)', kind: 'openai', base: 'https://api.openai.com/v1', model: '', hint: 'Chave em platform.openai.com → API keys. Exige crédito pré-pago.' },
    gemini: { name: 'Google Gemini', kind: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta', model: '', hint: 'Chave em aistudio.google.com. Cuidado: o plano gratuito pode usar o conteúdo para melhorar produtos do Google; para dados de saúde, prefira o plano pago.' },
    openrouter: { name: 'OpenRouter', kind: 'openai', base: 'https://openrouter.ai/api/v1', model: '', hint: 'Chave em openrouter.ai/keys. Dá acesso a modelos de vários fabricantes.' },
    custom: { name: 'Outro (compatível com OpenAI)', kind: 'openai', base: '', model: '', hint: 'Informe o endereço https:// do serviço e o modelo. Serve para servidores próprios com HTTPS.' },
  };
  window.TB_PROVIDERS = PROVIDERS;

  const ERR = {
    notcfg: { code: 'ai_not_configured', aiMsg: 'A IA ainda não está configurada. Abra Mais → Inteligência artificial e informe o provedor e a chave.' },
    auth: { code: 'ai_auth', aiMsg: 'O provedor recusou a chave. Confira a chave em Mais → Inteligência artificial.' },
    rate: { code: 'rate_limited', aiMsg: 'Muitas consultas seguidas ou limite do provedor atingido. Aguarde um pouco e tente de novo.' },
    bill: { code: 'ai_billing', aiMsg: 'O provedor informou falta de crédito ou de cobrança ativa. Verifique o saldo na conta dele.' },
    model: { code: 'ai_model', aiMsg: 'Modelo não encontrado ou sem acesso. Escolha outro em Mais → Inteligência artificial.' },
    big: { code: 'prompt_too_large', aiMsg: 'O conteúdo é grande demais para uma única consulta.' },
  };
  function httpErr(r) {
    const st = r.status, d = r.data, m = d && (d.error && (d.error.message || d.error) || d.message) || '';
    const txt = (typeof m === 'string' ? m : JSON.stringify(m)).slice(0, 200);
    if (st === 401 || st === 403) return Object.assign({}, ERR.auth, { aiMsg: ERR.auth.aiMsg + (txt ? ' Resposta do provedor: ' + txt : ''), detail: txt });
    if (st === 402 || /credit|billing|quota|insufficient/i.test(txt)) return st === 429 && !/credit|billing|insufficient/i.test(txt) ? ERR.rate : Object.assign({}, ERR.bill, { detail: txt });
    if (st === 429) return ERR.rate;
    if (st >= 500 || /high demand|overloaded|unavailable|try again later/i.test(txt)) return { code: 'ai_busy', aiMsg: 'O modelo escolhido está sobrecarregado no provedor neste momento (isso costuma passar em minutos). Tente de novo ou escolha outro modelo em Mais → Inteligência artificial.', detail: txt };
    if (st === 404) return Object.assign({}, ERR.model, { aiMsg: ERR.model.aiMsg + (txt ? ' Resposta do provedor: ' + txt : ''), detail: txt });
    if (st === 413) return ERR.big;
    return { code: 'ai_http', aiMsg: 'O provedor de IA recusou o pedido' + (txt ? ': ' + txt : ' (erro ' + st + ').'), detail: txt };
  }

  const b64 = blob => new Promise((ok, no) => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(',')[1]); f.onerror = () => no(f.error); f.readAsDataURL(blob); });
  async function config() {
    const c = await SEC.getCfg('ai'), key = await SEC.get('ai-key');
    if (!c || !key || !c.model) return null;
    const P = PROVIDERS[c.provider]; if (!P) return null;
    return { provider: c.provider, kind: P.kind, base: (c.base || P.base || '').replace(/\/+$/, ''), model: c.model, key };
  }

  /* ---------- um turno de conversa, por família de API ---------- */
  const adapters = {
    async anthropic(cfg, st, tools, signal) {
      const body = { model: cfg.model, max_tokens: 8192, messages: st.msgs };
      if (tools.length) body.tools = tools.map(t => ({ name: t.name, description: t.description || '', input_schema: t.inputSchema || { type: 'object', properties: {} } }));
      const r = await http(cfg.base + '/messages', { headers: { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body, signal });
      if (r.status >= 300) throw httpErr(r);
      const parts = (r.data && r.data.content) || [], text = parts.filter(p => p.type === 'text').map(p => p.text).join('');
      const calls = parts.filter(p => p.type === 'tool_use');
      st.msgs.push({ role: 'assistant', content: parts });
      return { text, calls: calls.map(c => ({ id: c.id, name: c.name, args: c.input || {} })), done: !calls.length };
    },
    async openai(cfg, st, tools, signal) {
      const body = { model: cfg.model, messages: st.msgs };
      if (tools.length) body.tools = tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description || '', parameters: t.inputSchema || { type: 'object', properties: {} } } }));
      const r = await http(cfg.base + '/chat/completions', { headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key }, body, signal });
      if (r.status >= 300) throw httpErr(r);
      const m = r.data && r.data.choices && r.data.choices[0] && r.data.choices[0].message; if (!m) throw { code: 'empty_completion', aiMsg: 'O provedor não devolveu resposta.' };
      st.msgs.push(m);
      const calls = (m.tool_calls || []).map(c => { let a = {}; try { a = JSON.parse(c.function.arguments || '{}'); } catch (e) { } return { id: c.id, name: c.function.name, args: a }; });
      return { text: typeof m.content === 'string' ? m.content : (m.content || []).map(p => p.text || '').join(''), calls, done: !calls.length };
    },
    async gemini(cfg, st, tools, signal) {
      const body = { contents: st.msgs };
      if (tools.length) body.tools = [{ functionDeclarations: tools.map(t => { const s = Object.assign({}, t.inputSchema || { type: 'object', properties: {} }); delete s.additionalProperties; return { name: t.name, description: t.description || '', parameters: s }; }) }];
      const r = await http(cfg.base + '/models/' + encodeURIComponent(cfg.model.replace(/^models\//, '')) + ':generateContent', { headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.key }, body, signal });
      if (r.status >= 300) throw httpErr(r);
      const cand = r.data && r.data.candidates && r.data.candidates[0], parts = cand && cand.content && cand.content.parts;
      if (!parts) throw { code: 'empty_completion', aiMsg: 'O provedor não devolveu resposta (pode ter bloqueado o conteúdo).' };
      st.msgs.push(cand.content);
      const calls = parts.filter(p => p.functionCall).map((p, i) => ({ id: 'g' + i, name: p.functionCall.name, args: p.functionCall.args || {} }));
      return { text: parts.filter(p => p.text && !p.thought).map(p => p.text).join(''), calls, done: !calls.length };
    },
  };
  const toolResult = {
    anthropic: (c, out) => ({ type: 'tool_result', tool_use_id: c.id, content: out }),
    openai: (c, out) => ({ role: 'tool', tool_call_id: c.id, content: out }),
    gemini: (c, out) => ({ functionResponse: { name: c.name, response: { result: out } } }),
  };

  async function initialMessages(kind, input, images) {
    const list = typeof input === 'string' ? [{ role: 'user', content: input }] : input.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) }));
    const imgs = []; for (const b of images || []) imgs.push({ mime: b.type || 'image/jpeg', data: await b64(b) });
    return list.map((m, i) => {
      const last = i === list.length - 1 && m.role === 'user', mine = last ? imgs : [];
      if (kind === 'anthropic') return { role: m.role, content: mine.map(x => ({ type: 'image', source: { type: 'base64', media_type: x.mime, data: x.data } })).concat([{ type: 'text', text: m.content }]) };
      if (kind === 'openai') return { role: m.role, content: mine.length ? [{ type: 'text', text: m.content }].concat(mine.map(x => ({ type: 'image_url', image_url: { url: `data:${x.mime};base64,${x.data}` } }))) : m.content };
      return { role: m.role === 'assistant' ? 'model' : 'user', parts: mine.map(x => ({ inlineData: { mimeType: x.mime, data: x.data } })).concat([{ text: m.content }]) };
    });
  }

  async function run(input, opts, extra) {
    opts = opts || {};
    const cfg = await config(); if (!cfg) throw ERR.notcfg;
    const tools = opts.tools || [], st = { msgs: await initialMessages(cfg.kind, extra && extra.json ? (typeof input === 'string' ? input + '\n\nResponda SOMENTE com JSON válido, sem comentários nem texto fora do JSON.' : input) : input, opts.images) };
    let acc = '';
    for (let round = 0; round < 8; round++) {
      if (opts.signal && opts.signal.aborted) throw { code: 'aborted' };
      let r, tryN = 0;
      for (;;) {
        const keep = st.msgs.length;
        try { r = await adapters[cfg.kind](cfg, st, tools, opts.signal); break; }
        catch (e) { st.msgs.length = keep; if (e && (e.code === 'ai_busy' || e.code === 'ai_network') && tryN < 2) { await new Promise(ok => setTimeout(ok, 2500 * (tryN + 1))); tryN++; continue; } throw e; }
      }
      if (r.text) { acc = r.text; if (opts.onText) { try { opts.onText({ text: acc, delta: r.text }); } catch (e) { } } }
      if (r.done) return { text: acc, truncated: false };
      const outs = [];
      for (const c of r.calls) {
        const t = tools.find(x => x.name === c.name); let out;
        try { out = JSON.stringify(t ? await t.execute(c.args) : { erro: 'ferramenta desconhecida' }); } catch (e) { out = JSON.stringify({ erro: String(e && e.message || e).slice(0, 200) }); }
        if (out.length > 60000) out = out.slice(0, 60000);
        outs.push(toolResult[cfg.kind](c, out));
      }
      if (cfg.kind === 'anthropic') st.msgs.push({ role: 'user', content: outs });
      else if (cfg.kind === 'openai') outs.forEach(o => st.msgs.push(o));
      else st.msgs.push({ role: 'user', parts: outs });
    }
    return { text: acc || '', truncated: true };
  }
  function parseJson(t) {
    t = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    try { return JSON.parse(t); } catch (e) { }
    const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { } }
    throw { code: 'invalid_json', aiMsg: 'A IA respondeu em formato inesperado. Tente de novo.' };
  }
  const sample = (input, opts) => run(input, opts);
  sample.json = async (input, opts) => parseJson((await run(input, opts, { json: true })).text);
  sample.limits = async () => ({ images: { mediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxInputBytes: 5 * 1024 * 1024, maxCount: 4 } });
  window.TB_AI = {
    run, parseJson, config,
    async listModels(provider, base, key) {
      const P = PROVIDERS[provider]; base = (base || P.base || '').replace(/\/+$/, '');
      if (!base || !key) throw { code: 'ai_incomplete', aiMsg: 'Informe o endereço e a chave antes de carregar os modelos.' };
      let r;
      if (P.kind === 'anthropic') r = await http(base + '/models?limit=100', { method: 'GET', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } });
      else if (P.kind === 'gemini') r = await http(base + '/models?pageSize=200', { method: 'GET', headers: { 'x-goog-api-key': key } });
      else r = await http(base + '/models', { method: 'GET', headers: { authorization: 'Bearer ' + key } });
      if (r.status >= 300) throw httpErr(r);
      const d = r.data || {};
      if (P.kind === 'gemini') return (d.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace(/^models\//, '')).sort();
      return (d.data || []).map(m => m.id).filter(Boolean).sort();
    },
    async test(provider, base, key, model) {
      const P = PROVIDERS[provider], cfg = { kind: P.kind, base: (base || P.base || '').replace(/\/+$/, ''), model, key }, st = { msgs: await initialMessages(P.kind, 'Responda apenas com a palavra: ok', []) };
      const r = await adapters[P.kind](cfg, st, [], null); return r.text || '(sem texto)';
    },
  };

  /* ---------- ponte no formato da plataforma ---------- */
  window.claude = {
    use: async name => name === 'sample' ? sample : null, // 'mcp' e 'downloads' não existem no APK
  };
})();
