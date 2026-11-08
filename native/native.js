/* ================= Camada nativa (Capacitor) =================
   Só age quando o app roda dentro do APK. No navegador comum, nada muda.
   - Arquivos (backup, PDF, Excel, CSV): abre o compartilhar do Android.
   - Lembretes: notificações locais que tocam com o app fechado. */
const CAP = window.Capacitor, NATIVE = IS_NATIVE;
const capP = n => (CAP && CAP.Plugins && CAP.Plugins[n]) || null;

function b64(data) {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data.buffer ? data.buffer : data);
  let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
if (NATIVE) {
  saveFile = async function (name, data) {
    const FS = capP('Filesystem'), SH = capP('Share');
    if (!FS || !SH) { toast('Compartilhar arquivos não está disponível neste aparelho.'); return false; }
    try {
      const payload = typeof data === 'string' ? { data: btoa(unescape(encodeURIComponent(data))) } : { data: b64(data) };
      const w = await FS.writeFile({ path: name, directory: 'CACHE', ...payload });
      await SH.share({ title: name, files: [w.uri], dialogTitle: 'Salvar ou enviar ' + name });
      return true;
    } catch (e) {
      if (e && /cancel/i.test(String(e.message || e))) { toast('Compartilhamento cancelado.'); return false; }
      console.error(e); toast('Não foi possível salvar o arquivo.'); return false;
    }
  };

  const REM_ID = { jejum: 101, almoco: 102, jantar: 103, deitar: 104, basal: 105 }, HYPO_ID = 201;
  const remIntro = 'Estes lembretes diários tocam nos horários escolhidos, mesmo com o app fechado.';
  VIEWS.lembretes = function () {
    let h = viewLembretes();
    const k = h.indexOf('Os avisos dentro do app só aparecem'), a = h.lastIndexOf('<p', k), b = h.indexOf('</p>', k) + 4;
    if (k >= 0) h = h.slice(0, a) + `<p class="hint" style="margin:0 0 12px">${remIntro}</p>` + h.slice(b);
    h = h.replace('data-act="ics-make">Gerar arquivo de calendário</button>', 'data-act="rem-on">Ativar lembretes neste aparelho</button><button class="btn full" style="margin-top:8px" data-act="rem-off">Desligar todos os lembretes</button>');
    h = h.replace('Para parar os lembretes, apague os eventos “TiaBete” do calendário.', 'Para parar, use “Desligar todos os lembretes”.');
    return h;
  };
  const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const inQuiet = (h, m) => {
    const c = alCfg(); if (!c.quiet) return false;
    const x = h * 60 + m, f = toMin(c.qFrom), t = toMin(c.qTo);
    return f === t ? false : f < t ? (x >= f && x < t) : (x >= f || x < t);
  };
  const LN = () => capP('LocalNotifications');
  async function ensurePerm() {
    const ln = LN(); if (!ln) return false;
    let p = await ln.checkPermissions(); if (p.display !== 'granted') p = await ln.requestPermissions();
    return p.display === 'granted';
  }
  const readItems = () => {
    const items = [], pref = {};
    for (const x of ICS_ITEMS) {
      const on = $('.ics-on[data-k=' + x.k + ']').checked, t = parseTime($('#ics-' + x.k).value); pref[x.k] = { on, t: t || undefined };
      if (on) { if (!t) { toast('Informe um horário válido para: ' + x.t + '.'); return null; } items.push({ k: x.k, t, title: x.t }); }
    }
    return { items, pref, adv: +$('#ics-adv').value || 0 };
  };
  /* Agenda os lembretes diários; os que cairiam no silêncio noturno ficam de fora. Retorna quantos foram agendados. */
  async function remSchedule(items, adv) {
    const ln = LN(); await ln.cancel({ notifications: Object.values(REM_ID).map(id => ({ id })) });
    try { await ln.createChannel({ id: 'lembretes', name: 'Lembretes', description: 'Horários de medir a glicemia e da insulina', importance: 4, vibration: true }); } catch (x) { }
    const list = [];
    for (const it of items) {
      let [h, m] = it.t.split(':').map(Number); m -= adv; while (m < 0) { m += 60; h = (h + 23) % 24; }
      if (inQuiet(h, m)) continue;
      list.push({ id: REM_ID[it.k], title: 'TiaBete', body: it.title + '. Registre no app depois.', channelId: 'lembretes', schedule: { on: { hour: h, minute: m }, allowWhileIdle: true } });
    }
    if (list.length) await ln.schedule({ notifications: list });
    return list.length;
  }
  async function remResync() {
    try {
      const m = (await Store.all('meta')).find(x => x.id === 'rem-active'); if (!m || !m.value || !LN()) return;
      await remSchedule(m.value.items, m.value.adv);
    } catch (e) { console.error(e); }
  }
  /* Reavaliação após hipoglicemia: se a última medição (de hoje, com horário) foi abaixo de 70, avisa em X minutos. */
  async function hypoSync() {
    const ln = LN(); if (!ln) return;
    try {
      const c = alCfg(), last = S.records.filter(r => !r.noTime && r.ts).sort((a, b) => b.ts - a.ts)[0];
      const low = last && last.glucose < LIM.low && Date.now() - last.ts < 60 * 60000;
      if (!c.hypo || !low) { await ln.cancel({ notifications: [{ id: HYPO_ID }] }); return; }
      const at = last.ts + c.hypoMin * 60000; if (at <= Date.now() + 5000) return;
      if (!(await ensurePerm())) return;
      try { await ln.createChannel({ id: 'hipo', name: 'Reavaliação de hipoglicemia', description: 'Aviso para medir de novo depois de uma glicemia baixa', importance: 5, vibration: true }); } catch (x) { }
      await ln.schedule({ notifications: [{ id: HYPO_ID, title: 'TiaBete · medir de novo', body: 'Passaram ' + c.hypoMin + ' minutos da glicemia baixa. Meça novamente e siga o protocolo do seu médico. Emergência: 192 (SAMU).', channelId: 'hipo', schedule: { at: new Date(at), allowWhileIdle: true } }] });
    } catch (e) { console.error(e); }
  }
  const _loadAll = loadAll;
  loadAll = async function () { const r = await _loadAll.apply(this, arguments); hypoSync(); return r; };
  setTimeout(hypoSync, 2000);
  document.addEventListener('change', e => { if (e.target.closest('.al-on, .al-sel, .al-tm')) setTimeout(() => { hypoSync(); remResync(); }, 60); });
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-act="rem-on"],[data-act="rem-off"]'); if (!el) return;
    e.stopImmediatePropagation();
    if (!LN()) { toast('Notificações não estão disponíveis neste aparelho.'); return; }
    try {
      if (el.dataset.act === 'rem-off') {
        await LN().cancel({ notifications: Object.values(REM_ID).map(id => ({ id })) });
        await Store.put('meta', { id: 'rem-active', value: null }); toast('Lembretes desligados.'); return;
      }
      const r = readItems(); if (!r) return; if (!r.items.length) { toast('Marque pelo menos um lembrete.'); return; }
      if (!(await ensurePerm())) { toast('Permita as notificações do TiaBete nas configurações do Android.'); return; }
      const n = await remSchedule(r.items, r.adv);
      S.icsPref = r.pref; try { await Store.put('meta', { id: 'ics-pref', value: r.pref }); await Store.put('meta', { id: 'rem-active', value: { items: r.items, adv: r.adv } }); } catch (x) { }
      const sk = r.items.length - n;
      toast(`${n} lembrete${n === 1 ? '' : 's'} ativado${n === 1 ? '' : 's'}.` + (sk ? ` ${sk} ficou fora por cair no silêncio noturno.` : ''));
    } catch (err) { console.error(err); toast('Não consegui programar os lembretes.'); }
  }, true);
}
