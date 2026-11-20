/* ================= Lembretes de insulina · camada Android (PROMPT 22) =================
   Notificações locais do sistema (Capacitor LocalNotifications + AlarmManager): tocam com o app fechado, em segundo plano,
   aparecem na tela de bloqueio (conforme o aparelho) e são restauradas pelo Android após reiniciar.
   O app só confere/refaz os agendamentos (ids estáveis, sem duplicar) ao abrir, voltar do segundo plano, mudar o tratamento,
   mudar o fuso horário ou depois de uma reinicialização. A confirmação da aplicação só acontece por escolha explícita da pessoa. */
if (typeof NATIVE !== 'undefined' && NATIVE) (function () {
  const LN = () => capP('LocalNotifications'), TBS = () => capP('TbSettings');
  const CH = 'insrem', AT = 'TB_INSREM', SIG_KEY = 'tb-ir-sig', TEST_ID = IR_ID_MAX + 1;
  let busy = false, again = false, force = false, setupDone = false;
  const sigs = () => { try { return JSON.parse(localStorage.getItem(SIG_KEY) || '{}') || {}; } catch (e) { return {}; } };
  const saveSigs = o => { try { localStorage.setItem(SIG_KEY, JSON.stringify(o)); } catch (e) { } };
  async function permission() {
    const ln = LN(); if (!ln) return 'denied';
    try { const p = (await ln.checkPermissions()).display; return p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt'; } catch (e) { return 'denied'; }
  }
  async function setup() {
    if (setupDone) return; const ln = LN(); if (!ln) return;
    try { await ln.createChannel({ id: CH, name: 'Lembretes de insulina', description: 'Avisos de aplicação de insulina basal e rápida', importance: 4, visibility: 1, vibration: true }); } catch (e) { }
    try { await ln.registerActionTypes({ types: [{ id: AT, actions: [{ id: 'confirm', title: 'Já apliquei' }, { id: 'snooze', title: 'Adiar' }, { id: 'open', title: 'Abrir tratamento' }] }] }); } catch (e) { }
    setupDone = true;
  }
  async function status() {
    const st = { perm: 'denied', exact: 'na', battery: null, pending: 0, at: Date.now() }, ln = LN(); if (!ln) return st;
    st.perm = await permission();
    try { const r = await ln.checkExactNotificationSetting(); st.exact = r.exact_alarm === 'granted' ? 'granted' : 'denied'; } catch (e) { }
    try { const t = TBS(); const s = t && await t.status(); if (s) { if (s.notifications === false && st.perm === 'granted') st.perm = 'denied'; if (typeof s.battery === 'boolean') st.battery = s.battery; if (s.exact === false) st.exact = 'denied'; } } catch (e) { }
    try { st.pending = ((await ln.getPending()).notifications || []).filter(n => n.id >= IR_ID_MIN && n.id < IR_ID_MAX).length; } catch (e) { }
    return st;
  }
  /* Refaz o que falta, cancela o que sobrou e nunca agenda o mesmo aviso duas vezes (ids estáveis + assinatura) */
  async function syncOnce() {
    const ln = LN(); if (!ln || !S.irReady || !Store.persistent || !Store.metaOk) return; /* sem o banco real, nada é cancelado nem refeito */
    const now = Date.now(), want = S.ir.on ? irNotifPlan(S.ir, S.plan, { quiet: t => plQuietAt(t) }) : [], snz = S.ir.on ? irSnoozes(S.ir, S.plan, now) : [];
    const all = want.map(n => ({ ...n, snooze: false })).concat(snz.map(n => ({ ...n, snooze: true }))), wantIds = new Set(all.map(n => n.nid));
    let pend = []; try { pend = (await ln.getPending()).notifications || []; } catch (e) { }
    const pendIds = new Set(pend.map(n => n.id)), stale = pend.filter(n => n.id >= IR_ID_MIN && n.id < IR_ID_MAX && !wantIds.has(n.id)).map(n => ({ id: n.id }));
    if (stale.length) { try { await ln.cancel({ notifications: stale }); } catch (e) { } }
    if (all.length && (await permission()) === 'granted') {
      await setup();
      const old = force ? {} : sigs(), next = {}, todo = [];
      for (const n of all) {
        const sig = JSON.stringify([n.title, n.body, n.snooze ? n.at : [n.weekday, n.hour, n.minute]]); next[n.nid] = sig;
        if (old[n.nid] === sig && pendIds.has(n.nid)) continue;
        const schedule = n.snooze ? { at: new Date(n.at), allowWhileIdle: true } : { on: n.weekday ? { weekday: n.weekday, hour: n.hour, minute: n.minute } : { hour: n.hour, minute: n.minute }, allowWhileIdle: true };
        todo.push({ id: n.nid, title: n.title, body: n.body, largeBody: n.largeBody, channelId: CH, actionTypeId: AT, extra: n.extra, schedule });
      }
      if (todo.length) await ln.schedule({ notifications: todo });
      saveSigs(next);
    } else saveSigs({});
    force = false;
  }
  async function sync() {
    if (busy) { again = true; return; } busy = true;
    try { do { again = false; try { await syncOnce(); } catch (e) { console.error(e); } } while (again); }
    finally { busy = false; }
    try { window.TB_IR_ST = await status(); if (typeof irStatusRefresh === 'function') irStatusRefresh(); } catch (e) { }
  }
  async function request() {
    const ln = LN(); if (!ln) return false;
    let p = (await ln.checkPermissions()).display; if (p !== 'granted') p = (await ln.requestPermissions()).display;
    return p === 'granted';
  }
  const guide = m => { try { toast(m); } catch (e) { } };
  window.TB_IR_NATIVE = {
    sync: f => { if (f) force = true; return sync(); },
    status, request,
    /* tira da bandeja os avisos já entregues deste lembrete (o agendamento recorrente não é mexido) */
    clear: async rid => {
      const ln = LN(); if (!ln) return; const ids = irIdMap(S.ir), list = [0, 1, 2, 3, 4, 5, 6, 'a', 'z'].map(w => ids[rid + '#' + w]).filter(Boolean).map(id => ({ id }));
      try { if (list.length) await ln.removeDeliveredNotifications({ notifications: list }); } catch (e) { }
    },
    openSettings: async () => { const t = TBS(); try { if (t) { await t.openNotifications(); return; } } catch (e) { } guide('Abra Configurações do Android → Apps → TiaBete → Notificações e ative.'); },
    openExact: async () => { const t = TBS(); try { if (t) { await t.openExactAlarms(); return; } } catch (e) { } try { await LN().changeExactNotificationSetting(); } catch (e) { guide('Neste Android não é preciso permitir horários exatos.'); } },
    openBattery: async () => { const t = TBS(); try { if (t) { await t.openBattery(); return; } } catch (e) { } guide('Abra Configurações do Android → Apps → TiaBete → Bateria e escolha “Sem restrições”.'); },
    test: async () => {
      const ln = LN(); if (!ln || !(await request())) return false; await setup();
      const tx = 'Teste: os lembretes de insulina estão funcionando. Nada foi registrado.';
      await ln.schedule({ notifications: [{ id: TEST_ID, title: 'Hora da insulina basal', body: tx, largeBody: tx, channelId: CH, schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true } }] });
      return true;
    }
  };
  /* toque na notificação ou num dos botões: fica na fila até o app terminar de carregar */
  try {
    const l = LN(); if (l && l.addListener) l.addListener('localNotificationActionPerformed', ev => {
      const x = ev && ev.notification && ev.notification.extra; if (!x || x.kind !== 'insrem') return;
      if (S.irLive && typeof irNotifAction === 'function') irNotifAction(ev.actionId, x); else (window.__irQ = window.__irQ || []).push([ev.actionId, x]);
    });
  } catch (e) { }
  { const AP = capP('App'); if (AP && AP.addListener) AP.addListener('resume', () => { try { irResume(); } catch (e) { } }); }
  setTimeout(() => sync(), 6500);   /* depois de reiniciar o celular ou abrir o app: confere e refaz o que faltar */
})();
