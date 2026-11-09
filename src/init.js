/* ================= Início ================= */
(async function init() {
  const today = Date.now();
  S.ana.A = { from: isoDate(new Date(addDays(today, -29))), to: isoDate(new Date(today)) };
  S.ana.B = { from: isoDate(new Date(addDays(today, -59))), to: isoDate(new Date(addDays(today, -30))) };
  await Store.init();
  await loadAll();
  let seeded = false;
  try { const ms = await Store.all('meta'); const lb = ms.find(x => x.id === 'last-backup'), sn = ms.find(x => x.id === 'bk-snooze'); const si = ms.find(x => x.id === 'insulin'); if (si) { const { id, ...rest } = si; Object.assign(S.ins, rest); } if (lb) S.lastBackup = lb.ts; if (sn) S.bkSnooze = sn.ts; } catch (e) { }
  insLoaded = true;
  try { const m = (await Store.all('meta')).find(x => x.id === 'a1c-target'); if (m && m.value >= 4 && m.value <= 12) S.a1cT = m.value; } catch (e) { }
  try { if (S.ins.dinnerMin === 150) S.ins.dinnerMin = 140; await insBackfill(); insSync(); await insSave(); } catch (e) { }
  try { const th = (await Store.all('meta')).find(x => x.id === 'theme'); if (th && ['light', 'dark', 'auto'].includes(th.value)) { S.theme = th.value; try { localStorage.setItem('tb-theme', th.value); } catch (e) { } } applyTheme(); } catch (e) { }
  try { const ac = (await Store.all('meta')).find(x => x.id === 'acc'); if (ac && ac.value && typeof ac.value === 'object') { S.acc = ac.value; try { localStorage.setItem('tb-acc', JSON.stringify(S.acc)); } catch (e) { } } } catch (e) { }
  try { const rw = (await Store.all('meta')).find(x => x.id === 'rewards'); if (rw && rw.value) S.rw = { got: {}, act: {}, init: false, ...rw.value }; } catch (e) { }
  try { const am = (await Store.all('meta')).find(x => x.id === 'alerts'); if (am && am.value) S.alerts = { ...AL_DEF, ...am.value }; } catch (e) { }
  try { const pm = (await Store.all('meta')).find(x => x.id === 'profile'); if (pm && pm.value) S.profile = pfClean(pm.value); } catch (e) { }
  try { const bm = (await Store.all('meta')).find(x => x.id === 'bolus'); if (bm) blLoad(bm.value); } catch (e) { }
  try { const dp = (await Store.all('meta')).find(x => x.id === 'drive-pref'); if (dp) Object.assign(S.drv, { auto: !!dp.auto, folderId: dp.folderId || null, lastTs: dp.lastTs || 0 }); } catch (e) { }
  try { const ip = (await Store.all('meta')).find(x => x.id === 'ics-pref'); if (ip && ip.value) S.icsPref = ip.value; } catch (e) { }
  try { const sv = (await Store.all('meta')).find(x => x.id === 'saved-meals'); if (sv && Array.isArray(sv.value)) S.saved = sv.value; } catch (e) { }
  askPersist();
  try { seeded = (await Store.all('meta')).some(x => x.id === 'seeded'); } catch (e) { }
  if (!seeded) {
    if (!S.records.length && !S.hba.length && !S.schemes.length) {
      const ex = makeExamples();
      await Store.putMany('records', ex.recs); await Store.putMany('schemes', ex.schemes); await Store.putMany('hba1c', ex.hba); await loadAll();
    }
    try { await Store.put('meta', { id: 'seeded', at: Date.now() }); } catch (e) { }
  }
  S.route = routeFromHash();
  render();
})();
