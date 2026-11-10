/* ================= Armazenamento local (IndexedDB) ================= */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const Store = {
  db: null, persistent: false, mem: { records: [], hba1c: [], schemes: [], meta: [], exams: [], events: [], inslog: [] },
  async init() {
    try {
      this.db = await new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('timeout')), 4000);
        const rq = indexedDB.open('glicotrack', SCHEMA_VERSION);
        /* Migrações só ADICIONAM stores. Nunca apagam dados. Próximas versões: novo bloco "if (old < N)". */
        rq.onupgradeneeded = e => {
          const db = rq.result, old = e.oldVersion;
          ['records', 'hba1c', 'schemes', 'meta', 'exams', 'events', 'inslog'].forEach(n => { if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: 'id' }); });
        };
        rq.onsuccess = () => { clearTimeout(t); res(rq.result); };
        rq.onerror = () => { clearTimeout(t); rej(rq.error); };
        rq.onblocked = () => { clearTimeout(t); rej(new Error('blocked')); };
      });
      this.persistent = true;
      try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
    } catch (e) { this.db = null; this.persistent = false; }
  },
  all(store) {
    if (!this.db) return Promise.resolve([...this.mem[store]]);
    return new Promise((res, rej) => { const rq = this.db.transaction(store).objectStore(store).getAll(); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
  },
  putMany(store, arr) {
    if (!this.db) { arr.forEach(o => { const i = this.mem[store].findIndex(x => x.id === o.id); if (i >= 0) this.mem[store][i] = o; else this.mem[store].push(o); }); return Promise.resolve(); }
    return new Promise((res, rej) => { const t = this.db.transaction(store, 'readwrite'), s = t.objectStore(store); arr.forEach(o => s.put(o)); t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  },
  put(store, o) { return this.putMany(store, [o]); },
  del(store, id) {
    if (!this.db) { this.mem[store] = this.mem[store].filter(x => x.id !== id); return Promise.resolve(); }
    return new Promise((res, rej) => { const t = this.db.transaction(store, 'readwrite'); t.objectStore(store).delete(id); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
  },
  delMany(store, ids) {
    if (!this.db) { this.mem[store] = this.mem[store].filter(x => !ids.includes(x.id)); return Promise.resolve(); }
    return new Promise((res, rej) => { const t = this.db.transaction(store, 'readwrite'), s = t.objectStore(store); ids.forEach(i => s.delete(i)); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
  }
};

/* ================= Estado ================= */
const S = {
  records: [], hba: [], schemes: [], route: 'painel', period: 30, day: null, ruleN: 180, ruleMode: 'horario',
  hist: { q: '', from: '', to: '', band: '', ctx: '', meal: '', mark: '', limit: 60 },
  ana: { range: 'all', agg: 'week', A: { from: '', to: '' }, B: { from: '', to: '' } },
  rep: { from: '', to: '' }, a1cT: A1C_TARGET_DEFAULT, est: false, imp: null, rest: null
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const isEx = o => o && (o.source === 'exemplo' || o.example === true);
const hasExamples = () => S.records.some(isEx) || S.hba.some(isEx) || S.schemes.some(isEx);

async function loadAll() {
  S.records = (await Store.all('records')).sort((a, b) => a.ts - b.ts);
  S.hba = (await Store.all('hba1c')).sort((a, b) => a.date.localeCompare(b.date));
  S.schemes = (await Store.all('schemes')).sort((a, b) => a.start.localeCompare(b.start));
  S.exams = (await Store.all('exams')).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  S.events = await Store.all('events');
  S.inslog = (await Store.all('inslog')).sort((a, b) => a.ts - b.ts);
  if (typeof insSync === 'function') insSync();
  if (typeof syncExamA1c === 'function' && await syncExamA1c()) S.hba = (await Store.all('hba1c')).sort((a, b) => a.date.localeCompare(b.date));
}
async function removeExamples() {
  await Store.delMany('records', S.records.filter(isEx).map(r => r.id));
  await Store.delMany('hba1c', S.hba.filter(isEx).map(r => r.id));
  await Store.delMany('schemes', S.schemes.filter(isEx).map(r => r.id));
  await loadAll();
}

/* ---------- dados de exemplo (marcados, removidos no primeiro registro real) ---------- */
function makeExamples() {
  let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) / Math.sqrt(0.5); };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const slots = [
    { t: '06:50', c: 'jejum', m: '', b: 116 }, { t: '09:50', c: 'depois', m: 'cafe', b: 148 },
    { t: '12:10', c: 'antes', m: 'almoco', b: 122 }, { t: '14:20', c: 'depois', m: 'almoco', b: 166 },
    { t: '19:00', c: 'antes', m: 'jantar', b: 126 }, { t: '22:15', c: 'deitar', m: '', b: 136 }
  ];
  const recs = [];
  for (let i = 119; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const drift = i > 60 ? 15 : 0;
    slots.forEach(s => {
      if (rnd() < 0.2) return;
      if (i === 0 && s.t > nowHM()) return;
      let v = s.b + drift + gauss() * 25;
      if (rnd() < 0.05) v -= 48; if (rnd() < 0.05) v += 75;
      v = Math.round(Math.max(38, Math.min(340, v)));
      const date = isoDate(d), r = { id: uid(), date, time: s.t, glucose: v, context: s.c, source: 'exemplo' };
      if (s.m) r.meal = s.m;
      if (s.c === 'antes') { r.carbs = 30 + Math.round(rnd() * 12) * 5; r.insMeal = 3 + Math.round(rnd() * 8) / 2; }
      r.ts = mkTs(date, s.t); recs.push(r);
    });
  }
  const dA = new Date(today); dA.setDate(dA.getDate() - 119); const dAe = new Date(today); dAe.setDate(dAe.getDate() - 61); const dB = new Date(today); dB.setDate(dB.getDate() - 60);
  const schemes = [
    { id: uid(), example: true, name: 'Esquema A (exemplo)', basalInsulin: 'Basal exemplo', basalDose: '16 U à noite', rapidInsulin: 'Rápida exemplo', mealDoses: 'Café, almoço e jantar (valores de exemplo)', times: '22:00 basal', extraMeds: '', start: isoDate(dA), end: isoDate(dAe), notes: 'Esquema fictício para demonstração.' },
    { id: uid(), example: true, name: 'Esquema B (exemplo)', basalInsulin: 'Basal exemplo', basalDose: '18 U à noite', rapidInsulin: 'Rápida exemplo', mealDoses: 'Café, almoço e jantar (valores de exemplo)', times: '22:00 basal', extraMeds: '', start: isoDate(dB), end: '', notes: 'Esquema fictício para demonstração.' }
  ];
  const d1 = new Date(today); d1.setDate(d1.getDate() - 104), d2 = new Date(today); d2.setDate(d2.getDate() - 14);
  const hba = [
    { id: uid(), example: true, date: isoDate(d1), value: 7.9, lab: 'Laboratório de exemplo', notes: 'Resultado fictício.' },
    { id: uid(), example: true, date: isoDate(d2), value: 7.3, lab: 'Laboratório de exemplo', notes: 'Resultado fictício.' }
  ];
  return { recs, schemes, hba };
}

/* ================= Utilidades de interface ================= */
/* Recursos que dependem do Claude (perguntas, leitura de exames, backup no Drive) só existem quando o app roda dentro do Claude. */
const HAS_CLAUDE = !!(window.claude && window.claude.use);
const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const IC = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>', list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', chart: '<path d="M4 20V11M10 20V4M16 20v-7M22 20H2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', chev: '<path d="M9 6l6 6-6 6"/>'
};
/* ---------- ícones de refeição / insulina / cuidado (somente nas 90 medições mais recentes) ---------- */
const MIC = {
  jejum: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>',
  cafe: '<path d="M4 9h12v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9zM16 10h2a2 2 0 0 1 0 4h-2M7 3v2.5M11 3v2.5"/>',
  almoco: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  jantar: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z"/>',
  lanche: '<circle cx="12" cy="12" r="9"/><path d="M8.5 9h.01M14 8h.01M15.5 13h.01M10 14.5h.01M12.5 17h.01"/>',
  refeicao: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-3 4-3 7h3v11"/>',
  deitar: '<path d="M3 19v-9M3 15.5h18V19M21 15.5v-3a3 3 0 0 0-3-3h-7v6"/>',
  madrugada: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  outro: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  seringa: '<path d="m18 2 4 4M17 7l3-3M19 9 8.5 19.5a2.12 2.12 0 0 1-3-3L16 6M9 11l4 4M5 19l-3 3M14 4l6 6"/>'
};
let ICON_CUT = 0;
function iconCutSet() { const t = S.records.map(r => r.ts || 0).sort((x, y) => y - x); ICON_CUT = t.length >= 90 ? t[89] : 0; }
function mealIcon(r) {
  if (!r || (r.ts || 0) < ICON_CUT) return '';
  const c = r.context, ph = c === 'antes' ? 'Pré' : c === 'depois' ? 'Pós' : c === 'jejum' ? 'Jejum' : '';
  const k = c === 'jejum' ? 'jejum' : (c === 'antes' || c === 'depois') ? (r.meal && MIC[r.meal] ? r.meal : 'refeicao') : (MIC[c] ? c : 'outro');
  return `<svg class="mi" viewBox="0 0 24 24" aria-hidden="true">${MIC[k]}</svg>${ph ? `<i class="mi-l">${ph}</i>` : ''}`;
}
function insIcon(x) { return (x.ts || 0) < ICON_CUT ? '' : `<svg class="mi" viewBox="0 0 24 24" aria-hidden="true">${MIC.seringa}</svg><i class="mi-l">${x.kind === 'basal' ? 'Basal' : 'Rápida'}</i>`; }
const ic = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;
const TITLES = { config: 'Configurações', perfil: 'Perfil', aparencia: 'Aparência', painel: 'Painel', historico: 'Histórico', analise: 'Análise', mais: 'Mais', hba1c: 'Hemoglobina glicada', esquemas: 'Esquemas de tratamento', importar: 'Importar do mySugr', classificar: 'Classificar medições', relatorios: 'Relatórios', backup: 'Backup e dados', sobre: 'Sobre o TiaBete', exames: 'Exames laboratoriais', eventos: 'Eventos', exame: 'Exame', comparar: 'Comparar exames', conquistas: 'Conquistas',  lembretes: 'Alertas e notificações', padroes: 'Padrões', perguntas: 'Perguntar ao Claude', insulinas: 'Histórico de insulinas' };
const navGroup = r => ['painel', 'historico', 'analise'].includes(r) ? r : 'mais';
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function toast(msg) {
  const old = $('.toast'); if (old) old.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
function openSheet(html) {
  closeSheet();
  const bg = document.createElement('div'); bg.className = 'sheet-bg'; bg.id = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  bg.addEventListener('pointerdown', e => { if (e.target === bg) closeSheet(); });
  document.body.appendChild(bg); document.body.style.overflow = 'hidden';
  const f = bg.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 60);
}
function closeSheet() { const b = $('#sheet-bg'); if (b) b.remove(); document.body.style.overflow = ''; }
function relTime(ms) {
  const d = Date.now() - ms, h = d / 3600000;
  if (d < 0) return 'agora';
  if (h < 1) return `há ${Math.max(1, Math.round(d / 60000))} min`;
  if (h < 24) return `há ${Math.round(h)} h`;
  const days = Math.round(h / 24); return days === 1 ? 'há 1 dia' : `há ${days} dias`;
}
const a1cBadge = v => { const b = a1cEval(v, S.a1cT); return b ? `<span class="badge ${b.k}">${b.sym} ${b.txt}</span>` : ''; };
function badge(v, ctx) { const b = bandOf(v, ctx); return `<span class="badge ${b.k}">${b.sym} ${b.txt}</span>`; }
function emptyBlock(t, d, extra = '') { return `<div class="empty"><b>${t}</b>${d}${extra}</div>`; }
function recChips(r) {
  const c = [];
  if (r.context) c.push(CONTEXTS[r.context]); if (r.meal) c.push(MEALS[r.meal]);
  if (r.carbs != null) c.push(fn(r.carbs) + ' g carb.');
  if (r.insMeal != null) c.push(fn(r.insMeal) + ' Ui rápida'); if (r.insCorr != null) c.push(fn(r.insCorr) + ' Ui correção');
  if (r.insBasal != null) c.push(fn(r.insBasal) + ' Ui basal'); if (r.insPen != null) c.push(fn(r.insPen) + ' Ui caneta'); if (r.insPump != null) c.push(fn(r.insPump) + ' Ui bomba');
  if (r.actMin != null || r.actDesc) c.push('Atividade' + (r.actMin != null ? ' ' + fn(r.actMin) + ' min' : ''));
  return c.map(x => `<span class="tag">${esc(x)}</span>`).join('') + markTxt(r).map(x => `<span class="tag warn">${esc(x)}</span>`).join('');
}
const curRange = () => periodRanges(S.period, Date.now());

/* ================= Telas ================= */
function banners() {
  let h = '';
  if (!Store.persistent) h += `<div class="banner warn"><span>O armazenamento do navegador não está disponível aqui. Os dados valem só nesta sessão. Exporte um backup antes de sair.</span></div>`;
  h += hypoBanner() + hyperBanner() + rwBanner() + backupBanner() + basalBanner() + dinnerBanner() + remBanner();
  if (hasExamples()) h += `<div class="banner"><span><b>Dados de exemplo.</b> Eles somem sozinhos quando você importar ou registrar a primeira medição real.</span><button class="btn sm" data-act="rm-examples">Remover agora</button></div>`;
  return h;
}

/* ---------- Painel: medições do dia e HbA1c ---------- */
function dayRecs(iso) { const a = mkTs(iso, '00:00'); return inRange(S.records, a, endOfDay(a)); }
function stepFmt(d) { const v = +d.toFixed(1); return fsign(v, Number.isInteger(v) ? 0 : 1); }
function gapFmt(min) { const m = Math.round(min); if (m < 60) return m + ' min'; const h = Math.floor(m / 60), r = m % 60; return h + ' h' + (r ? ' ' + r + ' min' : ''); }
function todayBlock() {
  iconCutSet();
  const todayIso = isoDate(new Date()), iso = S.day || todayIso, isToday = iso === todayIso;
  const d = new Date(mkTs(iso, '12:00')), rs = dayRecs(iso), st = stats(rs);
  const lab = (isToday ? 'Hoje' : iso === isoDate(new Date(addDays(Date.now(), -1))) ? 'Ontem' : WD[d.getDay()]) + ' · ' + fmtDate(iso);
  let h = `<div class="row sp" style="margin:22px 0 10px"><h2 class="sec" style="margin:0">${lab}</h2><div class="day-nav">${isToday ? '' : '<button class="btn sm" data-act="day-today">Hoje</button>'}<button class="btn sm" data-act="day-prev" aria-label="Dia anterior">‹</button><button class="btn sm" data-act="day-next" aria-label="Próximo dia" ${isToday ? 'disabled' : ''}>›</button></div></div>`;
  if (!rs.length) {
    const prevRec = [...S.records].reverse().find(r => r.ts < mkTs(iso, '00:00'));
    return h + `<div class="card">${emptyBlock(isToday ? 'Nenhuma medição hoje' : 'Nenhuma medição neste dia', prevRec ? `Última medição: ${fn(prevRec.glucose, 1)} mg/dL em ${fmtDate(prevRec.date)}.` : 'Registre uma medição para começar.', isToday ? '<br><br><button class="btn pri" data-act="new">Registrar medição</button>' : '')}</div>`;
  }
  const spread = st.max - st.min;
  h += `<div class="card"><div class="day-g"><div class="lb">Média do dia</div><div class="gauge-box gauge-md">${gaugeSvg(st.mean, false, 'Média do dia: ' + fn(st.mean, 1) + ' mg/dL. Mostrador de 70 a 250 mg/dL.')}</div></div>
    <div class="sum day-sum">
    <div class="tile"><div class="lb">Medições</div><div class="v num" style="font-size:32px">${st.n}</div><div class="sub">${st.hypo ? st.hypo + ' abaixo de 70 · ' : ''}${st.hyper ? st.hyper + ' acima da faixa' : (st.hypo ? '' : 'todas dentro da faixa')}</div></div>
    <div class="tile"><div class="lb">Variação</div>${st.n > 1 ? `<div class="v num" style="font-size:32px">${stepFmt(spread).replace('+', '')}<small>mg/dL</small></div><div class="sub">Maior ${fn(st.max, 1)} · menor ${fn(st.min, 1)}</div>` : `<div class="v num" style="font-size:32px">—</div><div class="sub">Precisa de 2 medições</div>`}</div>
  </div>`;
  if (rs.length > 1) h += `<div style="margin-top:16px">${glucoseChart(rs, mkTs(iso, '00:00'), endOfDay(mkTs(iso, '00:00')), { day: true, h: 170 })}</div><div class="legend"><span><i class="lg-dot"></i>medição</span><span><i class="lg-line"></i>sequência do dia</span><span><i class="lg-dash"></i>70 e 180 mg/dL</span></div>`;
  h += `</div><div style="margin-top:10px">`;
  rs.forEach((r, i) => {
    let delta;
    if (!i) delta = '<span class="tag first">1ª do dia</span>';
    else {
      const dv = r.glucose - rs[i - 1].glucose, sym = dv > 0 ? '▲' : dv < 0 ? '▼' : '■', gap = (!r.noTime && !rs[i - 1].noTime) ? ' · ' + gapFmt((r.ts - rs[i - 1].ts) / 60000) + ' depois' : '';
      delta = `<span class="tag ${dv > 0 ? 'up' : ''}">${sym} ${stepFmt(dv)} mg/dL${gap}</span>`;
    }
    h += `<button class="rec" data-act="open" data-id="${r.id}"><span class="tm num${mealIcon(r) ? ' ic' : ''}">${mealIcon(r)}<b>${r.noTime ? '—:—' : r.time}</b></span><span class="info">${badge(r.glucose, r.context)}<span class="chips">${delta}${recChips(r)}</span></span><span class="gl num">${fn(r.glucose, 1)}<small>mg/dL</small></span></button>`;
  });
  return h + `</div>`;
}
function est90() {
  const r = inRange(S.records, startOfDay(addDays(Date.now(), -89)), endOfDay(Date.now())), st = stats(r), days = new Set(r.map(x => x.date)).size;
  return { st, days, ok: st.n >= 30 && days >= 20, value: st.n ? estimatedA1c(st.mean) : null };
}
function hbaCard() {
  const e = est90(), h = `<h2 class="sec">Hemoglobina glicada · estimativa</h2>`;
  const note = '<div class="sub" style="margin-top:8px">Estimativa matemática aproximada. Não é exame de laboratório e não é o GMI.</div>';
  if (!e.ok) return h + `<div class="card soft" style="border-style:dashed"><div class="eyebrow">Últimos 90 dias</div><div class="tile"><div class="v num" style="font-size:30px">—</div><div class="sub">Estimativa indisponível: são necessárias ao menos 30 medições em 20 dias diferentes. Há ${e.st.n} medições em ${e.days} dias.</div></div>${note}</div>`;
  const ev = a1cEval(e.value, S.a1cT), key = 'e' + e.value.toFixed(2) + '|' + S.a1cT, an = S.a1mKey !== key; S.a1mKey = key;
  return h + `<div class="card hba2 hb-${ev.k}"><div class="hr-top"><div class="eyebrow">Estimada · últimos 90 dias</div></div>
    <div class="hba2-v"><span class="num">≈ ${fn(e.value, 1)}</span><small>%</small></div><div class="hr-state" style="margin-top:6px">${a1cBadge(e.value)}</div>
    ${a1cMeter(e.value, S.a1cT, an)}
    <div class="sub" style="margin-top:12px">Média de ${fm(e.st.mean)} mg/dL em ${e.st.n} medições capilares, ao longo de ${e.days} dias. Meta definida: ${fn(S.a1cT, 1)}%.</div>${note}
    <button class="btn sm" data-act="go" data-r="hba1c" style="margin-top:12px">Limites e exames</button></div>`;
}

function lastExtremes(all) {
  const real = all.filter(r => r.source !== 'exemplo'), src = real.length ? real : all;
  const find = fn => { for (let i = src.length - 1; i >= 0; i--) if (fn(src[i])) return src[i]; return null; };
  const item = (lab, r, col) => `<div class="lx"><div class="lx-l" style="color:${col}">${lab}</div>${r ? `<b class="num">${fn(r.glucose, 0)}<small> mg/dL</small></b><div class="lx-d num">${fmtDate(r.date).slice(0, 5)}${r.noTime ? '' : ' · ' + r.time}</div>` : '<div class="lx-d">nenhuma registrada</div>'}</div>`;
  const w7 = stats(inRange(src, startOfDay(addDays(Date.now(), -6)), endOfDay(Date.now())));
  const avg = `<div class="lx"><div class="lx-l" style="color:var(--fg)">● Média 7 dias</div>${w7.n ? `<b class="num">${fn(w7.mean, 0)}<small> mg/dL</small></b><div class="lx-d num">${w7.n} medi${w7.n > 1 ? 'ções' : 'ção'}</div>` : '<div class="lx-d">sem medições</div>'}</div>`;
  return `<div class="lxs">${item('▼ Última baixa (<' + LIM.low + ')', find(r => r.glucose < LIM.low), 'var(--red-t)')}${item('▲ Última alta (>' + LIM.high + ')', find(r => r.glucose > LIM.high), 'var(--warn, var(--red-t))')}${avg}</div>`;
}
function viewPainel() {
  let h = banners() + labelBanner();
  const all = S.records;
  if (!all.length) {
    return h + `<div class="card red"><div class="eyebrow">Bem-vindo</div><div class="hero-n" style="font-size:30px;margin:12px 0 8px">Seu painel começa aqui</div><p class="hint" style="color:var(--fg);margin:0 0 16px">Importe o CSV do mySugr ou registre uma medição. Os dados ficam só neste navegador.</p>
    <div class="big-cta"><button class="btn pri full" data-act="go" data-r="importar">Importar CSV do mySugr</button><button class="btn full" data-act="new">Registrar medição</button></div></div>`;
  }
  const last = all[all.length - 1];
  const gKey = last.id + '|' + last.glucose, gAnim = S.gaugeKey !== gKey; S.gaugeKey = gKey;
  const bnd = bandOf(last.glucose, last.context), gLbl = `Glicemia de ${fn(last.glucose, 1)} mg/dL, ${bnd.txt}. Mostrador de 70 a 250 mg/dL.`;
  h += `<div class="card red hero hero2 b-${bnd.k}${(last.glucose < LIM.low || last.glucose > LIM.high) ? ' oor' : ''}"><div class="hr-top"><div class="eyebrow">Glicemia mais recente</div><span class="hr-when">${relTime(last.ts)}</span></div>
    <div class="gauge-box">${gaugeSvg(last.glucose, gAnim, gLbl)}</div>
    <div class="hr-state">${badge(last.glucose, last.context)}</div>
    <div class="hr-info"><div class="hr-d num">${WD[new Date(last.ts).getDay()]} · ${fmtDate(last.date)}${last.noTime ? '' : ' · ' + last.time}</div><div class="chips" style="justify-content:center">${recChips(last)}</div></div>${lastExtremes(all)}</div>`;
  h += todayBlock() + insCard() + hbaCard();
  const { cur, prev } = curRange();
  const rc = inRange(all, cur[0], cur[1]), rp = inRange(all, prev[0], prev[1]);
  const sc = stats(rc), sp = stats(rp), cmp = compareStats(sc, sp);
  h += `<div class="row sp" style="margin:18px 0 12px"><div class="seg" role="group" aria-label="Período">${[7, 30, 90].map(p => `<button data-act="period" data-p="${p}" aria-pressed="${S.period === p}">${p} dias</button>`).join('')}</div><span class="eyebrow">${fmtDM(cur[0])} – ${fmtDM(cur[1])}</span></div>`;
  h += `<div class="stack">
    <div class="card tile big"><div class="lb">Média no período</div><div class="v num">${fm(sc.mean)}<small>mg/dL</small></div>
      <div class="sub">${sc.n ? `${cmp.diff != null ? `${fsign(cmp.diff)} mg/dL vs. ${S.period} dias anteriores` : 'Sem média no período anterior para comparar'}` : 'Sem medições neste período'}</div></div>
    <div class="grid3">
      <div class="card tile"><div class="lb">Menor</div><div class="v num">${f0(sc.min)}</div></div>
      <div class="card tile"><div class="lb">Maior</div><div class="v num">${f0(sc.max)}</div></div>
      <div class="card tile"><div class="lb">Medições</div><div class="v num">${sc.n}</div></div>
    </div>
    <div class="grid2">
      <div class="card tile ${sc.hypo ? 'alert' : ''}"><div class="lb">Episódios &lt; 70</div><div class="v num">${sc.hypo}<small>medições</small></div><div class="sub">${sc.n ? (sc.hypo / sc.n * 100).toFixed(0) + '% das medições' : '—'}</div></div>
      <div class="card tile ${sc.hyper ? 'alert' : ''}"><div class="lb">Acima da faixa</div><div class="v num">${sc.hyper}<small>medições</small></div><div class="sub">${sc.n ? (sc.hyper / sc.n * 100).toFixed(0) + '% das medições' : '—'}</div></div>
    </div></div>`;
  h += `<h2 class="sec">Evolução glicêmica</h2><div class="card">`;
  h += rc.length ? glucoseChart(rc, cur[0], cur[1]) + `<div class="legend"><span><i class="lg-dot"></i>medição</span><span><i class="lg-line"></i>média diária</span><span><i class="lg-dash"></i>70 e 180 mg/dL</span></div><p class="hint">Pontilhado: limite de 130 mg/dL para medições em jejum. Cada ponto é uma medição real. Toque ou passe o dedo para ver o valor.</p>` : emptyBlock('Sem medições', 'Nenhuma medição nos últimos ' + S.period + ' dias.');
  h += `</div>${eventLegend(cur[0], cur[1])}`;
  const row = (lb, a, b, d, cls = '') => `<tr><td>${lb}</td><td>${a}</td><td class="dim">${b}</td><td class="${cls}">${d}</td></tr>`;
  const few = (sc.n && sc.n < 5) || (sp.n && sp.n < 5);
  h += `<h2 class="sec">Comparação com o período anterior</h2><div class="card"><div class="tbl-wrap"><table class="t"><thead><tr><th></th><th>Atual<small>${fmtDM(cur[0])}–${fmtDM(cur[1])}</small></th><th>Anterior<small>${fmtDM(prev[0])}–${fmtDM(prev[1])}</small></th><th>Dif.<small>&nbsp;</small></th></tr></thead><tbody>
    ${row('Média (mg/dL)', fm(sc.mean), fm(sp.mean), fsign(cmp.diff), cmp.diff > 0 ? 'delta-up' : '')}
    ${row('Variação %', '', '', cmp.pct == null ? '—' : fsign(cmp.pct) + '%', cmp.pct > 0 ? 'delta-up' : '')}
    ${row('Medições', sc.n, sp.n, fsign(sc.n - sp.n, 0))}
    ${row('Hipoglicemia (&lt; 70)', `${sc.hypo}<small>${sc.n ? (sc.hypo / sc.n * 100).toFixed(0) + '%' : '—'}</small>`, `${sp.hypo}<small>${sp.n ? (sp.hypo / sp.n * 100).toFixed(0) + '%' : '—'}</small>`, fsign(sc.hypo - sp.hypo, 0))}
    ${row('Hiperglicemia (acima da faixa)', `${sc.hyper}<small>${sc.n ? (sc.hyper / sc.n * 100).toFixed(0) + '%' : '—'}</small>`, `${sp.hyper}<small>${sp.n ? (sp.hyper / sp.n * 100).toFixed(0) + '%' : '—'}</small>`, fsign(sc.hyper - sp.hyper, 0))}
    </tbody></table></div>${few ? '<p class="hint"><b>Poucas medições</b> em um dos períodos. Compare com cautela.</p>' : ''}
    <p class="hint">As contagens dependem de quantas medições foram feitas em cada período; os percentuais ajudam a comparar.</p></div>`;
  h += `<h2 class="sec">Distribuição por faixa</h2><div class="card">${distBars(rc)}</div>`;
  return h;
}

/* ---------- Histórico ---------- */
function filteredRecs() {
  const f = S.hist, q = norm(f.q);
  return S.records.filter(r => {
    if (f.from && r.date < f.from) return false; if (f.to && r.date > f.to) return false;
    if (f.band === 'baixa' && !(r.glucose < LIM.low)) return false;
    if (f.band === 'inter' && !(r.glucose >= LIM.low && r.glucose <= highOf(r))) return false;
    if (f.band === 'alta' && !(r.glucose > highOf(r))) return false;
    if (f.mark && !(r.marks || []).includes(f.mark)) return false;
    if (f.ctx && r.context !== f.ctx) return false; if (f.meal && r.meal !== f.meal) return false;
    if (q) { const hay = norm([r.glucose, fmtDate(r.date), r.date, r.time, r.notes, r.tags, r.mealDesc, r.actDesc, CONTEXTS[r.context], MEALS[r.meal], r.medication, markTxt(r).join(' ')].join(' ')); if (!hay.includes(q)) return false; }
    return true;
  }).reverse();
}
/* itens do histórico: medições + registros do card de insulinas, do mais novo para o mais antigo */
function histInsItems() {
  const f = S.hist; if (f.band || f.ctx || f.meal || f.mark) return [];
  const q = norm(f.q);
  return (S.inslog || []).filter(x => {
    if (f.from && x.date < f.from) return false; if (f.to && x.date > f.to) return false;
    if (q) { const hay = norm(['insulina', insLabel(x), fmtDate(x.date), x.date, HM(x.ts), x.units != null ? x.units + ' u unidades' : ''].join(' ')); if (!hay.includes(q)) return false; }
    return true;
  });
}
function insLabel(x) { return x.kind === 'basal' ? 'Insulina basal tomada' : 'Insulina rápida tomada · ' + { fast: 'jejum', lunch: 'pré-almoço', dinner: 'pré-jantar' }[x.kind]; }
function histItems() {
  const fr = filteredRecs(), eps = hypoEpisodes(fr), inEp = new Set(eps.flatMap(e => e.members.map(m => m.id)));
  const recs = fr.filter(r => !inEp.has(r.id)).map(r => ({ t: 'r', ts: r.ts, date: r.date, r })).concat(eps.map(e => ({ t: 'e', ts: e.ts, date: e.date, e }))), ins = histInsItems().map(x => ({ t: 'i', ts: x.ts, date: x.date, x }));
  return recs.concat(ins, histMealItems().map(m => ({ t: 'm', ts: m.ts, date: m.date, m }))).sort((a, b) => b.ts - a.ts || (a.t === 'i' ? -1 : 1));
}
const itKey = i => i.t === 'r' ? 'r' + i.r.id : i.t === 'e' ? 'e' + i.e.id : i.t === 'm' ? 'm' + i.m.id : 'i' + i.x.id;
const itRecs = its => its.flatMap(i => i.t === 'r' ? [i.r] : i.t === 'e' ? i.e.members : []);
function epiHTML(e) {
  const n = e.members.length, dur = n > 1 ? ` → ${HM(e.end)} · ${gapFmt((e.end - e.start) / 60000)}` : '';
  return `<div class="rec epi" data-key="e${e.id}" data-ts="${e.ts}"><div class="epi-h"><svg class="epi-x" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11"/><path d="M12 6.5v11M6.5 12h11"/></svg><div><div class="epi-t">Episódio de hipoglicemia</div><div class="epi-s num">${HM(e.start)}${dur}</div></div><div class="epi-min num">${f0(e.min)}<small>menor</small></div></div>
    <div class="epi-ms">${e.members.map(r => `<button class="epi-m" data-act="open" data-id="${r.id}"><span class="num">${r.time}</span>${badge(r.glucose, r.context)}<span class="epi-g num">${fn(r.glucose, 1)}<small>mg/dL</small></span></button>`).join('')}</div>
    <div class="epi-f ${e.rec ? 'ok' : 'no'}">${e.rec ? `✓ Voltou a ${f0(e.rec.glucose)} mg/dL às ${HM(e.rec.ts)}` : 'Sem medição de 70 mg/dL ou mais registrada depois'}</div></div>`;
}
function histListHTML() {
  const items = histItems();
  if (!S.records.length && !(S.inslog || []).length && !(S.bl.meals || []).length) return emptyBlock('Nenhum registro ainda', 'Registre uma medição ou importe o CSV do mySugr.');
  if (!items.length) return emptyBlock('Nada encontrado', 'Ajuste a busca ou os filtros.');
  iconCutSet();
  const shown = items.slice(0, S.hist.limit), groups = groupBy(shown, i => i.date), nr = itRecs(items).length, ni = items.filter(i => i.t === 'i').length, nm = items.filter(i => i.t === 'm').length;
  let h = `<p class="hint" style="margin:0 2px 4px"><span class="num">${nr}</span> ${nr === 1 ? 'medição' : 'medições'}${ni ? ` · <span class="num">${ni}</span> registro${ni === 1 ? '' : 's'} de insulina` : ''}${nm ? ` · <span class="num">${nm}</span> refeição${nm === 1 ? '' : 'ões'}` : ''}</p>`;
  for (const [date, its] of groups) {
    const rs = itRecs(its), st = stats(rs), d = new Date(its[0].ts), ni2 = its.filter(i => i.t === 'i').length, nm2 = its.filter(i => i.t === 'm').length;
    h += `<div class="day-h" data-d="${date}"><span>${WD[d.getDay()]} · ${fmtDate(date)}</span><span class="num">${rs.length ? `${rs.length} med. · média ${f0(st.mean)}` : ''}${rs.length && ni2 ? ' · ' : ''}${ni2 ? `${ni2} insulina` : ''}${nm2 ? `${rs.length || ni2 ? ' · ' : ''}${nm2} refeição` : ''}</span></div>`;
    its.forEach(i => {
      if (i.t === 'e') h += epiHTML(i.e);
      else if (i.t === 'm') h += mealLogHTML(i.m, 'hist');
      else if (i.t === 'r') { const r = i.r; h += `<button class="rec" data-key="r${r.id}" data-ts="${r.ts}" data-act="open" data-id="${r.id}"><span class="tm num${mealIcon(r) ? ' ic' : ''}">${mealIcon(r)}<b>${r.noTime ? '—:—' : r.time}</b></span><span class="info">${badge(r.glucose, r.context)}<span class="chips">${recChips(r)}</span></span><span class="gl num">${fn(r.glucose, 1)}<small>mg/dL</small></span></button>`; }
      else { const x = i.x; h += `<button class="rec ins" data-key="i${x.id}" data-ts="${x.ts}" data-act="ins-log-edit" data-id="${x.id}"><span class="tm num${insIcon(x) ? ' ic' : ''}">${insIcon(x)}<b>${HM(x.ts)}</b></span><span class="info"><span class="badge ins-b">${x.kind === 'basal' ? 'Basal tomada' : 'Rápida tomada'}</span>${x.kind === 'basal' ? '' : `<span class="chips"><span class="tag">${{ fast: 'Jejum', lunch: 'Pré-almoço', dinner: 'Pré-jantar' }[x.kind]}</span></span>`}</span><span class="gl num">${x.units != null ? fn(x.units, 1) + '<small>Ui</small>' : '<small>sem Ui</small>'}</span></button>`; }
    });
  }
  if (items.length > shown.length) h += `<button class="btn full" data-act="more">Mostrar mais (${items.length - shown.length})</button>`;
  return h;
}
function viewHistorico() {
  const f = S.hist;
  const opt = (obj, cur, all) => `<option value="">${all}</option>` + Object.entries(obj).map(([k, v]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${v}</option>`).join('');
  const active = [f.from, f.to, f.band, f.ctx, f.meal, f.mark].filter(Boolean).length;
  return banners() + labelBanner() + `<h2 class="sec">Buscar e filtrar</h2><input class="in" id="h-q" type="search" placeholder="Buscar valor, nota, etiqueta, refeição…" value="${esc(f.q)}" aria-label="Buscar registros">
  <details class="more" style="margin-top:10px" ${active ? 'open' : ''}><summary>Filtros${active ? ` · ${active} ativo${active > 1 ? 's' : ''}` : ''}</summary><div class="form-grid">
    <div class="field"><label class="fl" for="h-from">De</label><input class="in" type="date" id="h-from" value="${f.from}"></div>
    <div class="field"><label class="fl" for="h-to">Até</label><input class="in" type="date" id="h-to" value="${f.to}"></div>
    <div class="field"><label class="fl" for="h-band">Faixa</label><select class="in" id="h-band"><option value="">Todas</option><option value="baixa" ${f.band === 'baixa' ? 'selected' : ''}>Baixas (&lt; 70)</option><option value="inter" ${f.band === 'inter' ? 'selected' : ''}>Dentro da faixa (70–180; jejum 70–130)</option><option value="alta" ${f.band === 'alta' ? 'selected' : ''}>Elevadas (&gt; 180)</option></select></div>
    <div class="field"><label class="fl" for="h-ctx">Contexto</label><select class="in" id="h-ctx">${opt(CONTEXTS, f.ctx, 'Todos')}</select></div>
    <div class="field"><label class="fl" for="h-meal">Refeição</label><select class="in" id="h-meal">${opt(MEALS, f.meal, 'Todas')}</select></div>
    <div class="field"><label class="fl" for="h-mark">Marcação</label><select class="in" id="h-mark">${opt(MARKS, f.mark, 'Todas')}</select></div>
    <div class="full"><button class="btn sm" data-act="clear-filters">Limpar filtros</button></div></div></details>
  ${histJumpBar()}
  <h2 class="sec">Medições</h2><div id="h-list" style="margin-top:6px">${histListHTML()}</div>`;
}

/* ---------- Registro (formulário) ---------- */
const MARKS = { hipo: 'Reavaliação de hipoglicemia', fora: 'Comi fora', semtreino: 'Dia sem treino', perna: 'Dia de perna', alcool: 'Bebi álcool', estresse: 'Estresse', doente: 'Doente', sono: 'Dormi mal', atraso: 'Refeição atrasada', viagem: 'Viagem' };
const MARKS_OLD = { treino: 'Treino' }; // marcação antiga: só aparece em registros que já a tinham
const markTxt = r => (r.marks || []).map(k => MARKS[k] || MARKS_OLD[k]).filter(Boolean);
const numAttr = v => v == null ? '' : String(v).replace('.', ',');
function recordForm(rec, pref) {
  const r = rec || { date: isoDate(new Date()), time: nowHM(), ...(pref || {}) };
  const opts = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${v}</option>`).join('');
  const hasMore = ['carbs', 'insMeal', 'insBasal', 'insCorr', 'actMin', 'actDesc'].some(k => r[k] != null && r[k] !== '');
  const sch = S.schemes.map(s => `<option value="${s.id}" ${r.scheme === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  return `<h2>${rec ? 'Editar medição' : 'Nova medição'}</h2><form id="rec-form" data-id="${rec ? rec.id : ''}" novalidate>
  <label class="fl" for="f-glu">Glicemia</label>
  <div class="glu-in"><input id="f-glu" inputmode="decimal" autocomplete="off" placeholder="000" value="${numAttr(r.glucose)}" ${rec ? '' : 'autofocus'}><span>mg/dL</span></div>
  <div class="form-grid" style="margin-top:12px">
    <div class="field"><label class="fl" for="f-date">Data</label><input class="in" type="date" id="f-date" value="${r.date}"></div>
    <div class="field"><label class="fl" for="f-time">Horário</label><input class="in" type="time" id="f-time" value="${r.noTime ? '' : r.time}"></div>
    <div class="field"><label class="fl" for="f-ctx">Contexto</label><select class="in" id="f-ctx"><option value="">—</option>${opts(CONTEXTS, r.context)}</select></div>
    <div class="field"><label class="fl" for="f-meal">Refeição</label><select class="in" id="f-meal"><option value="">—</option>${opts(MEALS, r.meal)}</select></div>
  </div>
  ${mealChips()}<details class="more" style="margin-top:12px" ${hasMore ? 'open' : ''}><summary>Carboidratos, insulina e atividade</summary><div class="form-grid">
    <div class="field full"><label class="fl" for="f-mdesc">Descrição da refeição</label><input class="in" id="f-mdesc" maxlength="120" value="${esc(r.mealDesc || '')}" placeholder="opcional"></div>
    <div class="field"><label class="fl" for="f-carbs">Carboidratos (g)</label><input class="in" id="f-carbs" inputmode="decimal" value="${numAttr(r.carbs)}"></div>
    <div class="field"><label class="fl" for="f-ins-meal">Insulina rápida (Ui)</label><input class="in" id="f-ins-meal" inputmode="decimal" value="${numAttr(r.insMeal)}"></div>
    <div class="field"><label class="fl" for="f-ins-basal">Insulina basal (Ui)</label><input class="in" id="f-ins-basal" inputmode="decimal" value="${numAttr(r.insBasal)}"></div>
    <div class="field"><label class="fl" for="f-ins-corr">Insulina de correção (Ui)</label><input class="in" id="f-ins-corr" inputmode="decimal" value="${numAttr(r.insCorr)}"></div>
    <div class="field"><label class="fl" for="f-act-desc">Atividade física</label><input class="in" id="f-act-desc" placeholder="Ex.: caminhada" value="${esc(r.actDesc || '')}"></div>
    <div class="field"><label class="fl" for="f-act-min">Duração (min)</label><input class="in" id="f-act-min" inputmode="numeric" value="${numAttr(r.actMin)}"></div>
  </div></details>
  <div class="form-grid" style="margin-top:12px">
    <div class="field full"><label class="fl">Marcações rápidas</label><div class="mks">${Object.entries({ ...MARKS, ...((r.marks || []).includes('treino') ? MARKS_OLD : {}) }).map(([k, t]) => `<label class="mk"><input type="checkbox" name="mk" value="${k}" ${(r.marks || []).includes(k) ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div>
    <div class="field full"><label class="fl" for="f-notes">Observações</label><textarea class="in" id="f-notes">${esc(r.notes || '')}</textarea></div>
    ${S.schemes.length ? `<div class="field full"><label class="fl" for="f-scheme">Esquema de tratamento</label><select class="in" id="f-scheme"><option value="">Automático pela data</option>${sch}</select></div>` : ''}
  </div>
  <p class="err" id="f-err" role="alert"></p>
  <div class="row" style="margin-top:6px"><button class="btn pri grow" type="submit">Salvar</button><button class="btn" type="button" data-act="close">Cancelar</button></div>
  ${rec ? `<button class="btn danger full" type="button" style="margin-top:10px" data-act="del-ask" data-id="${rec.id}">Excluir registro</button>` : ''}</form>`;
}
async function saveRecord(form) {
  const v = id => $('#' + id, form)?.value.trim() ?? '';
  const err = m => { $('#f-err').textContent = m; return false; };
  const glucose = parseNum(v('f-glu'));
  if (glucose === null || glucose < GLU_MIN || glucose > GLU_MAX) return err(`Informe a glicemia entre ${GLU_MIN} e ${GLU_MAX} mg/dL.`);
  const date = parseDate(v('f-date')); if (!date) return err('Informe uma data válida.');
  const time = v('f-time') ? parseTime(v('f-time')) : null; if (v('f-time') && !time) return err('Horário inválido.');
  const opt = (id, label, max) => { const raw = v(id); if (!raw) return undefined; const n = parseNum(raw); if (n === null || n < 0 || n > max) { err(`${label}: valor inválido (0 a ${max}).`); return false; } return n; };
  const carbs = opt('f-carbs', 'Carboidratos', 500), insMeal = opt('f-ins-meal', 'Insulina rápida', 200), insBasal = opt('f-ins-basal', 'Insulina basal', 300), insCorr = opt('f-ins-corr', 'Insulina de correção', 200), actMin = opt('f-act-min', 'Duração da atividade', 720);
  if ([carbs, insMeal, insBasal, insCorr, actMin].includes(false)) return false;
  const id = form.dataset.id, old = id ? S.records.find(r => r.id === id) : null;
  const rec = { ...(old || {}), id: id || uid(), date, time: time || '00:00', glucose, source: old ? old.source : 'manual' };
  if (!time) rec.noTime = true; else delete rec.noTime;
  if (old && old.insFrom && insMeal !== old.insMeal) delete rec.insFrom;
  const setOr = (k, val) => { if (val === undefined || val === '') delete rec[k]; else rec[k] = val; };
  setOr('context', v('f-ctx')); setOr('meal', v('f-meal')); setOr('mealDesc', v('f-mdesc')); setOr('carbs', carbs); setOr('insMeal', insMeal); setOr('insBasal', insBasal); setOr('insCorr', insCorr);
  setOr('actMin', actMin); setOr('actDesc', v('f-act-desc')); setOr('notes', v('f-notes')); { const mk = [...form.querySelectorAll('input[name=mk]:checked')].map(x => x.value); if (mk.length) rec.marks = mk; else delete rec.marks; } if ($('#f-scheme')) setOr('scheme', v('f-scheme'));
  if (old && old.cls && (rec.context !== old.context || rec.meal !== old.meal)) { delete rec.cls; delete rec.prev; }
  rec.ts = mkTs(rec.date, rec.time); delete rec.key;
  let note = '';
  if (hasExamples() && !old) { await removeExamples(); note = ' Dados de exemplo removidos.'; }
  await Store.put('records', rec); await loadAll(); closeSheet(); render(); toast('Medição salva.' + note);
  hypoAfterSave(rec);
}
function openRecord(id) {
  const r = S.records.find(x => x.id === id); if (!r) return;
  const kv = [];
  const add = (k, v) => { if (v != null && v !== '') kv.push(`<dt>${k}</dt><dd>${esc(v)}</dd>`); };
  add('Glicemia', fn(r.glucose, 1) + ' mg/dL'); add('Data e hora', fmtDate(r.date) + (r.noTime ? ' (sem horário)' : ' ' + r.time));
  add('Contexto', CONTEXTS[r.context]); add('Refeição', MEALS[r.meal]); add('Carboidratos', r.carbs != null ? fn(r.carbs) + ' g' : null);
  add('Insulina rápida', r.insMeal != null ? fn(r.insMeal) + ' Ui' : null); add('Correção', r.insCorr != null ? fn(r.insCorr) + ' Ui' : null); add('Basal', r.insBasal != null ? fn(r.insBasal) + ' Ui' : null);
  add('Caneta', r.insPen != null ? fn(r.insPen) + ' Ui' : null); add('Bomba', r.insPump != null ? fn(r.insPump) + ' Ui' : null);
  add('Basal temporária', r.tbPct != null ? fn(r.tbPct) + '%' + (r.tbMin != null ? ' por ' + fn(r.tbMin) + ' min' : '') : null);
  add('Atividade', [r.actDesc, r.actMin != null ? fn(r.actMin) + ' min' : '', r.actInt ? INTENSITY[r.actInt] : ''].filter(Boolean).join(' · '));
  add('Passos', r.steps); add('Refeição (descrição)', r.mealDesc); add('Tipo de alimento', r.foodType); add('Medicação', r.medication);
  add('Marcações', markTxt(r).join(', ')); add('Etiquetas', r.tags); add('Pressão', r.bp); add('Peso', r.weight != null ? fn(r.weight) + ' kg' : null); add('Cetonas', r.ketones);
  add('Observações', r.notes);
  const sch = S.schemes.find(s => s.id === schemeOf(r, S.schemes)); add('Esquema', sch ? sch.name : null);
  add('Origem', { manual: 'Registro manual', mysugr: 'Importado do mySugr', libre: 'Importado do FreeStyle Libre', dexcom: 'Importado do Dexcom Clarity', exemplo: 'Exemplo' }[r.source] || r.source);
  openSheet(`<h2>${badge(r.glucose, r.context)}</h2><dl class="kv">${kv.join('')}</dl><div class="row" style="margin-top:18px"><button class="btn pri grow" data-act="edit" data-id="${r.id}">Editar</button><button class="btn danger" data-act="del-ask" data-id="${r.id}">Excluir</button></div>`);
}

/* ---------- Análise ---------- */
function meanBars(rows) {
  const ok = rows.filter(r => r.n >= MIN_BUCKET);
  if (!rows.some(r => r.n)) return '<div class="empty">Sem dados.</div>';
  return rows.map(r => r.n >= MIN_BUCKET
    ? `<div class="hbar ${r.mean > (r.hi || LIM.high) ? 'high' : r.mean < LIM.low ? 'low' : 'ok'}"><span class="lab">${esc(r.label)}</span><span class="trk"><span class="fil" style="display:block;width:${Math.min(100, r.mean / 260 * 100).toFixed(1)}%"></span></span><span class="val num">${fm(r.mean)}<small>n=${r.n}</small></span></div>`
    : `<div class="hbar"><span class="lab">${esc(r.label)}</span><span class="trk"></span><span class="val dim">${r.n ? 'n=' + r.n + ' · insuficiente' : '—'}</span></div>`).join('');
}
function statsBlock(label, rs) {
  const s = stats(rs);
  return { s, html: `<tr><td>${label}</td><td>${fm(s.mean)}</td><td>${s.n ? f0(s.min) + '–' + f0(s.max) : '—'}</td><td>${s.n}</td><td>${s.hypo}<small>${s.n ? (s.hypo / s.n * 100).toFixed(0) + '%' : '—'}</small></td><td>${s.hyper}<small>${s.n ? (s.hyper / s.n * 100).toFixed(0) + '%' : '—'}</small></td></tr>` };
}
function compareCardHTML() {
  const { A, B } = S.ana;
  const rng = p => p.from && p.to && p.from <= p.to ? [mkTs(p.from, '00:00'), endOfDay(mkTs(p.to, '00:00'))] : null;
  const ra = rng(A), rb = rng(B);
  let h = `<div class="form-grid"><div class="field"><label class="fl" for="a-from">Período A · de</label><input class="in" type="date" id="a-from" value="${A.from}"></div><div class="field"><label class="fl" for="a-to">até</label><input class="in" type="date" id="a-to" value="${A.to}"></div>
  <div class="field"><label class="fl" for="b-from">Período B · de</label><input class="in" type="date" id="b-from" value="${B.from}"></div><div class="field"><label class="fl" for="b-to">até</label><input class="in" type="date" id="b-to" value="${B.to}"></div></div>`;
  if (!ra || !rb) return h + '<p class="hint">Informe as duas datas de cada período.</p>';
  const sa = stats(inRange(S.records, ra[0], ra[1])), sb = stats(inRange(S.records, rb[0], rb[1])), c = compareStats(sa, sb);
  const row = (lb, a, b, d) => `<tr><td>${lb}</td><td>${a}</td><td>${b}</td><td>${d}</td></tr>`;
  h += `<div class="tbl-wrap" style="margin-top:12px"><table class="t"><thead><tr><th></th><th>A</th><th>B</th><th>A − B</th></tr></thead><tbody>
  ${row('Média', fm(sa.mean), fm(sb.mean), fsign(c.diff))}${row('Variação %', '', '', c.pct == null ? '—' : fsign(c.pct) + '%')}
  ${row('Desvio-padrão', fm(sa.sd), fm(sb.sd), sa.sd != null && sb.sd != null ? fsign(sa.sd - sb.sd) : '—')}
  ${row('Menor – maior', sa.n ? f0(sa.min) + '–' + f0(sa.max) : '—', sb.n ? f0(sb.min) + '–' + f0(sb.max) : '—', '')}
  ${row('Medições', sa.n, sb.n, fsign(sa.n - sb.n, 0))}${row('&lt; 70', `${sa.hypo}<small>${sa.n ? (sa.hypo / sa.n * 100).toFixed(0) + '%' : '—'}</small>`, `${sb.hypo}<small>${sb.n ? (sb.hypo / sb.n * 100).toFixed(0) + '%' : '—'}</small>`, fsign(sa.hypo - sb.hypo, 0))}
  ${row('Acima da faixa', `${sa.hyper}<small>${sa.n ? (sa.hyper / sa.n * 100).toFixed(0) + '%' : '—'}</small>`, `${sb.hyper}<small>${sb.n ? (sb.hyper / sb.n * 100).toFixed(0) + '%' : '—'}</small>`, fsign(sa.hyper - sb.hyper, 0))}</tbody></table></div>`;
  if (sa.n < 10 || sb.n < 10) h += '<p class="hint"><b>Poucas medições</b> em um dos períodos (menos de 10). A comparação pode não representar a rotina.</p>';
  return h;
}
function viewAnalise() {
  let h = banners();
  if (!S.records.length) return h + emptyBlock('Sem dados para analisar', 'Importe o CSV do mySugr ou registre medições.', '<br><br><button class="btn pri" data-act="go" data-r="importar">Importar CSV</button>');
  const a = S.ana, now = Date.now();
  const recs = a.range === 'all' ? S.records : inRange(S.records, startOfDay(addDays(now, -(+a.range - 1))), endOfDay(now));
  const st = stats(recs);
  h += `<div class="seg" role="group" aria-label="Intervalo">${[['all', 'Tudo'], ['30', '30 d'], ['90', '90 d'], ['180', '180 d']].map(([k, l]) => `<button data-act="ana-range" data-v="${k}" aria-pressed="${a.range === k}">${l}</button>`).join('')}</div>`;
  if (!recs.length) return h + `<div class="card" style="margin-top:12px">${emptyBlock('Sem medições', 'Não há medições neste intervalo.')}</div>`;
  h += `<h2 class="sec">Resumo geral</h2><div class="card"><div class="grid3" style="gap:14px 10px">
    <div class="tile"><div class="lb">Média</div><div class="v num" style="font-size:22px">${fm(st.mean)}</div></div>
    <div class="tile"><div class="lb">Desvio-padrão</div><div class="v num" style="font-size:22px">${fm(st.sd)}</div></div>
    <div class="tile"><div class="lb">Medições</div><div class="v num" style="font-size:22px">${st.n}</div></div>
    <div class="tile"><div class="lb">Menor</div><div class="v num" style="font-size:22px">${f0(st.min)}</div></div>
    <div class="tile ${st.hypo ? 'alert' : ''}"><div class="lb">&lt; 70</div><div class="v num" style="font-size:22px">${st.hypo}<small>${(st.hypo / st.n * 100).toFixed(0)}%</small></div></div>
    <div class="tile ${st.hyper ? 'alert' : ''}"><div class="lb">Acima da faixa</div><div class="v num" style="font-size:22px">${st.hyper}<small>${(st.hyper / st.n * 100).toFixed(0)}%</small></div></div></div></div>`;
  /* evolução semanal / mensal */
  const wk = a.agg === 'week', g = groupBy(recs, r => wk ? weekStart(r.ts) : monthStart(r.ts));
  let buckets = [...g.entries()].sort((x, y) => x[0] - y[0]).map(([t, rs]) => ({ t, ...stats(rs) }));
  const total = buckets.length; buckets = buckets.slice(-12);
  h += `<div class="row sp" style="margin:26px 0 10px"><h2 class="sec" style="margin:0">Evolução ${wk ? 'semanal' : 'mensal'}</h2><div class="seg"><button data-act="ana-agg" data-v="week" aria-pressed="${wk}">Semana</button><button data-act="ana-agg" data-v="month" aria-pressed="${!wk}">Mês</button></div></div><div class="card">`;
  h += barChart(buckets.map(b => ({ label: wk ? fmtDM(b.t) : new Date(b.t).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''), value: b.mean, n: b.n, sub: `Menor ${f0(b.min)} · maior ${f0(b.max)}` })), { label: 'Média por ' + (wk ? 'semana' : 'mês') });
  h += `<p class="hint">Média de mg/dL por ${wk ? 'semana (início na segunda)' : 'mês'}. ${total > 12 ? `Mostrando os últimos 12 de ${total}. ` : ''}Barras com menos de ${MIN_BUCKET} medições não mostram média.</p>`;
  const tr = trend(recs);
  h += `<p class="hint">${tr ? `<b>Tendência aproximada:</b> ${fsign(tr.perWeek)} mg/dL por semana, calculada sobre ${tr.days} dias com medição. Descreve o passado e não prevê o futuro.` : '<b>Tendência:</b> dados insuficientes (precisa de ao menos 10 dias e 20 medições).'}</p></div>`;
  h += `<h2 class="sec">Distribuição por faixa</h2><div class="card">${distBars(recs)}</div>`;
  h += `<h2 class="sec">Média por horário</h2><div class="card">${barChart(byTimeBlock(recs).map(b => ({ label: b.label, value: b.mean, n: b.n })), { label: 'Média por faixa horária' })}<p class="hint">Medições sem horário (importadas sem hora) ficam de fora.</p></div>`;
  h += `<h2 class="sec">Dia típico</h2><div class="card">${typicalDayChart(recs)}<p class="hint" style="margin:8px 0 0">Junta todos os dias do intervalo escolhido em um só dia de 24 horas. A linha é a mediana por horário (janela de 3 h) e as faixas mostram onde ficou a maioria das medições. Mostra o que aconteceu, sem prever nem orientar tratamento.</p></div>`;
  h += heatmapCard(recs);
  const ctxRows = Object.entries(CONTEXTS).map(([k, l]) => ({ label: l, hi: k === 'jejum' ? FAST.high : LIM.high, ...stats(recs.filter(r => r.context === k)) })).filter(r => r.n);
  const none = stats(recs.filter(r => !r.context));
  h += `<h2 class="sec">Antes e depois das refeições</h2><div class="card">${ctxRows.length ? meanBars(ctxRows.map(r => ({ ...r, label: r.label.replace(' da refeição', '') }))) : '<div class="empty">Nenhuma medição com contexto informado.</div>'}${none.n ? `<p class="hint">${none.n} medições sem contexto não entram nesta lista.</p>` : ''}</div>`;
  const mealRows = Object.entries(MEALS).map(([k, l]) => { const ar = recs.filter(r => r.meal === k); return { l, all: stats(ar), antes: stats(ar.filter(r => r.context === 'antes')), depois: stats(ar.filter(r => r.context === 'depois')) }; });
  const cell = s => s.n >= MIN_BUCKET ? `${fm(s.mean)}<small>n=${s.n}</small>` : `<span class="dim">${s.n ? 'n=' + s.n : '—'}</span>`;
  h += `<h2 class="sec">Por tipo de refeição</h2><div class="card"><div class="tbl-wrap"><table class="t"><thead><tr><th>Refeição</th><th>Antes</th><th>Depois</th><th>Todas</th></tr></thead><tbody>${mealRows.map(m => `<tr><td>${m.l}</td><td>${cell(m.antes)}</td><td>${cell(m.depois)}</td><td>${cell(m.all)}</td></tr>`).join('')}</tbody></table></div><p class="hint">Médias em mg/dL. Mostradas só com ${MIN_BUCKET} ou mais medições.</p></div>`;
  h += mealDeltaCard(recs);
  h += `<h2 class="sec">Médias por período do calendário</h2><div class="card"><div class="tbl-wrap"><table class="t"><thead><tr><th>Período</th><th>Média</th><th>Min–máx</th><th>n</th><th>&lt;70</th><th>Acima</th></tr></thead><tbody>${[7, 30, 90, 180].map(d => statsBlock(d + ' dias', inRange(S.records, startOfDay(addDays(now, -(d - 1))), endOfDay(now))).html).join('')}</tbody></table></div></div>`;
  h += `<h2 class="sec">Comparar dois períodos</h2><div class="card" id="cmp">${compareCardHTML()}</div>`;
  return h;
}

/* ---------- HbA1c ---------- */
function hbaForm(x) {
  x = x || { date: isoDate(new Date()) };
  return `<h2>${x.id ? 'Editar resultado' : 'Novo resultado laboratorial'}</h2><form id="hba-form" data-id="${x.id || ''}" novalidate><div class="form-grid">
    <div class="field"><label class="fl" for="hb-v">HbA1c (%)</label><input class="in" id="hb-v" inputmode="decimal" placeholder="7,0" value="${numAttr(x.value)}" autofocus></div>
    <div class="field"><label class="fl" for="hb-d">Data da coleta</label><input class="in" type="date" id="hb-d" value="${x.date}"></div>
    <div class="field full"><label class="fl" for="hb-l">Laboratório</label><input class="in" id="hb-l" value="${esc(x.lab || '')}"></div>
    <div class="field full"><label class="fl" for="hb-n">Observações</label><textarea class="in" id="hb-n">${esc(x.notes || '')}</textarea></div></div>
    <p class="err" id="hb-err" role="alert"></p><div class="row"><button class="btn pri grow" type="submit">Salvar</button><button class="btn" type="button" data-act="close">Cancelar</button></div>
    ${x.id ? `<button class="btn danger full" type="button" style="margin-top:10px" data-act="del-ask-hba" data-id="${x.id}">Excluir resultado</button>` : ''}</form>`;
}
function viewHba() {
  let h = banners();
  h += `<p class="hint" style="margin:0 0 12px">Resultados de <b>exames de laboratório</b>. Estimativas calculadas ficam separadas, mais abaixo.</p><button class="btn pri full" data-act="hba-new">Adicionar resultado</button>`;
  h += lastExamBox();
  if (S.hba.length) { const L = S.hba[S.hba.length - 1], ev = a1cEval(L.value, S.a1cT), key = 'l' + L.id + L.value + '|' + S.a1cT, an = S.a1mKey2 !== key; S.a1mKey2 = key; h += `<h2 class="sec">Último exame de laboratório</h2><div class="card hba2 hb-${ev.k}"><div class="hr-top"><div class="eyebrow">${fmtDate(L.date)}${L.lab ? ' · ' + esc(L.lab) : ''}</div></div><div class="hba2-v"><span class="num">${fn(L.value, 1)}</span><small>%</small></div><div class="hr-state" style="margin-top:6px">${a1cBadge(L.value)}</div>${a1cMeter(L.value, S.a1cT, an)}</div>`; }
  h += `<h2 class="sec">Avaliador · meta de HbA1c (MODY)</h2><div class="card"><div class="row" style="align-items:flex-end"><div class="field grow"><label class="fl" for="a1c-t">Meta (%)</label><input class="in" id="a1c-t" inputmode="decimal" value="${numAttr(S.a1cT)}"></div><button class="btn pri" data-act="a1c-save">Salvar</button></div><p class="hint">O avaliador compara a HbA1c com esta meta: até ela, <b>Dentro da faixa</b>; acima, <b>Acima da faixa</b>. O padrão do app é 7,0%. No MODY a meta depende do subtipo (por exemplo, no MODY 2 a HbA1c costuma ficar levemente elevada e estável). Defina o valor junto com seu médico.</p></div>`;
  h += `<h2 class="sec">Resultados laboratoriais</h2>`;
  if (!S.hba.length) h += `<div class="card">${emptyBlock('Nenhum resultado', 'Adicione o valor, a data da coleta e o laboratório.')}</div>`;
  else {
    h += `<div class="card">${lineSimple(S.hba.map(x => ({ ts: mkTs(x.date, '12:00'), value: x.value, tip: `<b>${fn(x.value, 1)}%</b><br><span>${fmtDate(x.date)}${x.lab ? ' · ' + esc(x.lab) : ''}</span>` })), { label: 'Evolução da HbA1c laboratorial' })}`;
    if (S.hba.length > 1) { const a = S.hba[S.hba.length - 2], b = S.hba[S.hba.length - 1]; h += `<p class="hint">Entre os dois últimos exames (${fmtDate(a.date)} e ${fmtDate(b.date)}): <b>${fsign(b.value - a.value)} ponto percentual</b>.</p>`; }
    h += `</div><div class="stack" style="margin-top:12px">` + [...S.hba].reverse().map(x => `<button class="rec" style="grid-template-columns:1fr auto" data-act="hba-edit" data-id="${x.id}"><span class="info"><span class="num">${fmtDate(x.date)}</span><span class="chips">${a1cBadge(x.value)}${x.lab ? `<span class="tag">${esc(x.lab)}</span>` : ''}${x.source === 'mysugr' ? '<span class="tag">Importado do mySugr</span>' : ''}${x.source === 'exame' ? '<span class="tag">Do exame enviado</span>' : ''}${x.example ? '<span class="tag warn">Exemplo</span>' : ''}</span>${x.notes ? `<span class="dim" style="font-size:12.5px">${esc(x.notes)}</span>` : ''}</span><span class="gl num">${fn(x.value, 1)}%<small>laboratório</small></span></button>`).join('') + `</div>`;
  }
  h += `<h2 class="sec">Estimativa matemática (opcional)</h2><div class="card soft" style="border-style:dashed">`;
  if (!S.est) h += `<p class="hint" style="margin:0 0 12px">Calcula um valor aproximado a partir da média das suas glicemias capilares. <b>Não é um exame</b> e não é o GMI.</p><button class="btn" data-act="est-on">Mostrar estimativa</button>`;
  else {
    const E = est90(), st = E.st, days = E.days;
    if (st.n < 30 || days < 20) h += `<div class="eyebrow">Estimativa indisponível</div><p class="hint">Faltam dados: são necessárias ao menos 30 medições em 20 dias distintos nos últimos 90 dias. Há ${st.n} medições em ${days} dias.</p>`;
    else h += `<div class="eyebrow">Estimativa matemática aproximada</div><div class="hero-n num" style="font-size:40px;margin:8px 0">≈ ${fn(estimatedA1c(st.mean), 1)}%<small>estimada</small></div><div style="margin-bottom:8px">${a1cBadge(estimatedA1c(st.mean))}</div><p class="hint" style="margin:0">Fórmula aplicada à média de ${fm(st.mean)} mg/dL em ${st.n} medições capilares (${days} dias, últimos 90 dias).</p>`;
    h += `<ul class="plain"><li>Não é HbA1c de laboratório e não deve ser comparada a ele como equivalente.</li><li>Não é GMI, que depende de monitorização contínua de glicose.</li><li>Medições pontuais costumam se concentrar em certos horários e podem enviesar a média.</li><li>Anemias, hemoglobinas variantes e outras condições alteram a HbA1c real.</li></ul><button class="btn sm" style="margin-top:12px" data-act="est-off">Ocultar estimativa</button>`;
  }
  return h + `</div>`;
}

/* ---------- Esquemas ---------- */
function schemeForm(x) {
  x = x || { start: isoDate(new Date()) };
  const f = (id, lb, v, full, ph = '') => `<div class="field ${full ? 'full' : ''}"><label class="fl" for="${id}">${lb}</label><input class="in" id="${id}" value="${esc(v || '')}" placeholder="${ph}"></div>`;
  return `<h2>${x.id ? 'Editar esquema' : 'Novo esquema'}</h2><form id="sch-form" data-id="${x.id || ''}" novalidate><div class="form-grid">
    ${f('s-name', 'Nome do esquema', x.name, true)}${f('s-bi', 'Insulina basal', x.basalInsulin)}${f('s-bd', 'Dose basal', x.basalDose, false, 'Ex.: 16 U à noite')}
    ${f('s-ri', 'Insulina rápida', x.rapidInsulin, true)}
    <div class="field full"><label class="fl" for="s-md">Doses por refeição</label><textarea class="in" id="s-md" placeholder="Ex.: café 4 U · almoço 6 U · jantar 5 U">${esc(x.mealDoses || '')}</textarea></div>
    ${f('s-t', 'Horários', x.times, true, 'Ex.: basal 22:00')}${f('s-em', 'Medicamentos adicionais', x.extraMeds, true)}
    <div class="field"><label class="fl" for="s-st">Início</label><input class="in" type="date" id="s-st" value="${x.start}"></div>
    <div class="field"><label class="fl" for="s-en">Encerramento</label><input class="in" type="date" id="s-en" value="${x.end || ''}"></div>
    <div class="field full"><label class="fl" for="s-no">Observações</label><textarea class="in" id="s-no">${esc(x.notes || '')}</textarea></div></div>
    <p class="hint" style="margin:0 0 8px">Registro para organizar informações. O app não sugere nem calcula doses.</p>
    <p class="err" id="s-err" role="alert"></p><div class="row"><button class="btn pri grow" type="submit">Salvar</button><button class="btn" type="button" data-act="close">Cancelar</button></div>
    ${x.id ? `<button class="btn danger full" type="button" style="margin-top:10px" data-act="del-ask-sch" data-id="${x.id}">Excluir esquema</button>` : ''}</form>`;
}
function schemeStats(sc) {
  const recs = S.records.filter(r => schemeOf(r, S.schemes) === sc.id), st = stats(recs);
  const end = sc.end || isoDate(new Date()), days = Math.max(1, Math.round((mkTs(end, '00:00') - mkTs(sc.start, '00:00')) / DAY) + 1);
  return { ...st, days, perDay: st.n / days, recs };
}
function viewEsquemas() {
  let h = banners() + `<p class="hint" style="margin:0 0 12px">Cadastre cada esquema com suas datas. As medições entram no esquema pelo período de uso (ou pela escolha feita no registro). O app só compara resultados e não recomenda mudanças.</p><button class="btn pri full" data-act="sch-new">Novo esquema</button>`;
  if (!S.schemes.length) return h + `<div class="card" style="margin-top:12px">${emptyBlock('Nenhum esquema', 'Cadastre o esquema atual e os anteriores para poder compará-los.')}</div>`;
  h += `<h2 class="sec">Esquemas cadastrados</h2><div class="stack">` + [...S.schemes].reverse().map(x => {
    const act = !x.end || x.end >= isoDate(new Date());
    return `<button class="rec" style="grid-template-columns:1fr auto" data-act="sch-edit" data-id="${x.id}"><span class="info"><b>${esc(x.name)}</b><span class="dim num" style="font-size:12.5px">${fmtDate(x.start)} → ${x.end ? fmtDate(x.end) : 'em uso'}</span><span class="chips">${x.basalInsulin ? `<span class="tag">Basal: ${esc(x.basalInsulin)}${x.basalDose ? ' ' + esc(x.basalDose) : ''}</span>` : ''}${x.rapidInsulin ? `<span class="tag">Rápida: ${esc(x.rapidInsulin)}</span>` : ''}${x.example ? '<span class="tag warn">Exemplo</span>' : ''}</span></span>${act ? '<span class="badge high">Em uso</span>' : '<span class="badge">Encerrado</span>'}</button>`;
  }).join('') + `</div>`;
  const rows = S.schemes.map(sc => ({ sc, ...schemeStats(sc) }));
  h += `<h2 class="sec">Comparação de resultados</h2><div class="card"><div class="tbl-wrap"><table class="t"><thead><tr><th>Esquema</th><th>Dias</th><th>n</th><th>Média</th><th>&lt;70</th><th>Acima</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td>${esc(r.sc.name)}<small>${fmtDM(mkTs(r.sc.start, '00:00'))}${r.sc.end ? '–' + fmtDM(mkTs(r.sc.end, '00:00')) : ' → hoje'}</small></td><td>${r.days}</td><td>${r.n}${r.n < 20 ? '<small>poucas</small>' : `<small>${fn(r.perDay, 1)}/dia</small>`}</td><td>${fm(r.mean)}</td><td>${r.hypo}<small>${r.n ? (r.hypo / r.n * 100).toFixed(0) + '%' : '—'}</small></td><td>${r.hyper}<small>${r.n ? (r.hyper / r.n * 100).toFixed(0) + '%' : '—'}</small></td></tr>`).join('') +
    `</tbody></table></div><p class="hint">Comparação descritiva. Diferenças podem refletir alimentação, rotina, quantidade de medições e outros fatores, e não apenas o esquema. Esquemas com menos de 20 medições são marcados como "poucas". Leve estes dados à sua equipe de saúde.</p></div>`;
  return h;
}

/* ---------- Importação mySugr ---------- */
function viewImportar() {
  let h = banners();
  const imp = S.imp;
  if (imp && imp.done) {
    const r = imp.result;
    return h + `<div class="card red"><div class="eyebrow">Importação concluída</div><div class="grid3" style="margin:14px 0 4px"><div class="tile"><div class="lb">Importados</div><div class="v num">${r.added}</div></div><div class="tile"><div class="lb">Duplicados</div><div class="v num">${r.dup}</div></div><div class="tile"><div class="lb">Ignorados</div><div class="v num">${r.ignored}</div></div></div>
      ${r.hba ? `<p class="hint">${r.hba} resultado(s) de HbA1c também importado(s).</p>` : ''}${r.removedExamples ? '<p class="hint">Dados de exemplo foram removidos.</p>' : ''}</div>
      <div class="row" style="margin-top:12px"><button class="btn pri grow" data-act="go" data-r="painel">Ver painel</button><button class="btn" data-act="imp-reset">Importar outro</button></div>
      <p class="hint">Importar o mesmo arquivo de novo não duplica os registros.</p>`;
  }
  if (imp && imp.parsed) {
    const p = imp.parsed;
    if (!p.ok) return h + `<div class="card"><div class="eyebrow">Não foi possível importar</div><p style="margin:10px 0 14px">${esc(p.error)}</p><button class="btn" data-act="imp-reset">Escolher outro arquivo</button></div>`;
    const reasons = Object.entries(p.reasons);
    const ign = reasons.reduce((a, [, n]) => a + n, 0);
    return h + `<div class="card"><div class="eyebrow">Prévia · ${esc(imp.name)}</div><div class="grid3" style="margin:14px 0 6px"><div class="tile"><div class="lb">Novos</div><div class="v num">${imp.newCount}</div></div><div class="tile"><div class="lb">Duplicados</div><div class="v num">${imp.dupCount}</div></div><div class="tile ${ign ? 'alert' : ''}"><div class="lb">Ignorados</div><div class="v num">${ign}</div></div></div>
      <p class="hint" style="margin-top:4px">${p.totalRows} linhas lidas${p.items.length ? `, de ${fmtDate(p.items[0].date)} a ${fmtDate(p.items[p.items.length - 1].date)}` : ''}. Serão gravadas em ordem cronológica.</p>
      ${p.warning ? `<p class="err">${esc(p.warning)}</p>` : ''}
      ${reasons.length ? `<h2 class="sec" style="margin-top:18px">Linhas ignoradas</h2><ul class="plain">${reasons.map(([k, n]) => `<li>${n} · ${esc(k)}</li>`).join('')}</ul>${p.withOtherData ? `<p class="hint">${p.withOtherData} linha(s) sem glicemia tinham dose de insulina ou carboidrato. Elas não são importadas, porque o TiaBete guarda cada registro a partir de uma medição.</p>` : ''}${p.ignored.length ? `<details class="more" style="margin-top:10px"><summary>Ver linhas (${Math.min(p.ignored.length, 200)})</summary><ul class="plain" style="margin-bottom:12px">${p.ignored.slice(0, 60).map(i => `<li>Linha ${i.line}: ${esc(i.reason)}${i.extra ? ' (“' + esc(i.extra.slice(0, 30)) + '”)' : ''}</li>`).join('')}${p.ignored.length > 60 ? `<li>…e mais ${p.ignored.length - 60}</li>` : ''}</ul></details>` : ''}` : ''}
      ${p.hba.length ? `<label class="chk" style="margin-top:16px"><input type="checkbox" id="imp-hba" ${imp.includeHba ? 'checked' : ''}><span>Importar também ${p.hba.length} valor(es) de HbA1c encontrados no arquivo, como resultado sem laboratório informado.</span></label>` : ''}
      <label class="chk" style="margin-top:16px"><input type="checkbox" id="imp-rule" ${imp.timeRule ? 'checked' : ''}><span>Definir jejum, pré e pós-prandial pelo <b>horário</b> da medição (${p.items.filter(i => applyRule(i)).length} de ${p.items.length} serão definidas ou alteradas). As etiquetas originais do mySugr são mantidas.</span></label>
      <details class="more" style="margin-top:14px"><summary>Colunas reconhecidas (${p.columns.length})</summary><p class="hint" style="margin:0 0 12px">${p.columns.join(', ')}.${p.ignoredCols.length ? ' Localização, fuso horário, latitude e longitude são descartados por privacidade.' : ''}</p></details>
      <p class="hint">Etiquetas como “Almoço” ou “Antes da refeição” preenchem refeição e contexto quando reconhecidas. O texto original das etiquetas é mantido. Doses de caneta, bomba, refeição, correção e basal ficam em campos separados e nunca são somadas.</p>
      <div class="row" style="margin-top:16px"><button class="btn pri grow" data-act="imp-commit" ${imp.newCount || (imp.includeHba && p.hba.length) ? '' : 'disabled'}>Importar ${imp.newCount} registro${imp.newCount === 1 ? '' : 's'}</button><button class="btn" data-act="imp-reset">Cancelar</button></div></div>`;
  }
  return h + `<div class="card red"><div class="eyebrow">CSV do mySugr, FreeStyle Libre (LibreView) ou Dexcom Clarity</div><p style="margin:10px 0 16px;color:var(--fg)">Escolha o arquivo no seu aparelho. Ele é lido aqui mesmo, sem enviar nada para a internet.</p>
    <input type="file" id="imp-file" accept=".csv,.txt,text/csv,text/plain" hidden><button class="btn pri full" data-act="pick-csv">Escolher arquivo CSV</button></div>
    <h2 class="sec">Como funciona</h2><div class="card"><ul class="plain" style="margin:0">
    <li>Datas em DD/MM/AAAA e números com vírgula ou ponto são reconhecidos.</li><li>Você vê uma prévia antes de gravar qualquer coisa.</li><li>Registros que já existem (mesma data, hora e valor) são tratados como duplicados.</li><li>Linhas sem glicemia válida ou sem data são ignoradas e contadas.</li><li>Localização e coordenadas não são guardadas.</li></ul></div>`;
}
async function handleCsvFile(file) {
  if (!file) return;
  if (file.size > 25 * 1024 * 1024) { toast('Arquivo grande demais (máx. 25 MB).'); return; }
  let text; try { const buf = await file.arrayBuffer(); try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { text = new TextDecoder('windows-1252').decode(buf); } } catch (e) { toast('Não consegui ler o arquivo.'); return; }
  const p = parseMySugr(text);
  const have = new Set(S.records.filter(r => !isEx(r)).map(dedupKey)); let newCount = 0, dupCount = 0;
  if (p.ok) p.items.forEach(it => { const k = dedupKey(it); if (have.has(k)) dupCount++; else { have.add(k); newCount++; } });
  S.imp = { name: file.name, parsed: p, newCount, dupCount, includeHba: true, timeRule: false }; render();
}
async function commitImport() {
  const imp = S.imp, p = imp.parsed; const real = S.records.filter(r => !isEx(r));
  const have = new Set(real.map(dedupKey)); const add = []; let dup = 0;
  for (const it of p.items) { const k = dedupKey(it); if (have.has(k)) { dup++; continue; } have.add(k); let rec = { ...it, id: uid() }; delete rec.key; if (imp.timeRule) rec = applyRule(rec) || rec; add.push(rec); }
  const hadEx = hasExamples(); if (hadEx) await removeExamples();
  await Store.putMany('records', add);
  let hbaAdded = 0;
  if (imp.includeHba) {
    const seen = new Set(S.hba.filter(x => !isEx(x)).map(x => x.date + '|' + x.value)); const nh = [];
    p.hba.forEach(x => { const k = x.date + '|' + x.value; if (!seen.has(k)) { seen.add(k); nh.push({ id: uid(), date: x.date, value: x.value, lab: '', notes: 'Importado do mySugr (laboratório não informado).', source: 'mysugr' }); } });
    await Store.putMany('hba1c', nh); hbaAdded = nh.length;
  }
  await loadAll();
  S.imp = { done: true, result: { added: add.length, dup, ignored: Object.values(p.reasons).reduce((a, b) => a + b, 0), hba: hbaAdded, removedExamples: hadEx } };
  render();
}

/* ---------- Aviso: últimas medições sem antes/depois ---------- */
function labelBanner() {
  if (!alCfg().bLabel) return '';
  const recs = S.records.filter(r => !isEx(r)), scope = recs.slice(-Math.max(1, S.ruleN || 180));
  const pend = scope.filter(r => !r.context && targetFor(r, 'horario')).length;
  if (!pend) return '';
  return `<div class="banner" style="display:block"><b>${pend} das ${scope.length} últimas medições</b> estão sem jejum, antes ou depois da refeição.<div class="row" style="margin-top:10px"><button class="btn sm pri" data-act="label-now">Etiquetar agora pelo horário</button><button class="btn sm" data-act="go" data-r="classificar">Escolher critério</button></div></div>`;
}

/* ---------- Classificação (horário ou etiquetas) ---------- */
const RULE_MODES = { horario: 'Pelo horário', etiquetas: 'Pelas etiquetas do mySugr' };
const tgtKey = t => t.context + '/' + (t.meal || '');
const tgtLabel = t => CONTEXTS[t.context] + (t.meal ? ' · ' + MEALS[t.meal] : '');
const TGT_ORDER = ['jejum/', 'antes/cafe', 'depois/cafe', 'antes/almoco', 'depois/almoco', 'antes/jantar', 'depois/jantar', 'antes/lanche', 'depois/lanche', 'deitar/', 'antes/', 'depois/'];
function ruleSummary() {
  const mode = S.ruleMode || 'horario';
  const recs = S.records.filter(r => !isEx(r)), scope = recs.slice(-Math.max(1, S.ruleN || 180)), groups = new Map(), changed = new Map();
  let none = 0; const conflicts = [];
  scope.forEach(r => {
    const t = targetFor(r, mode);
    if (!t) { none++; return; }
    const k = tgtKey(t); if (!groups.has(k)) groups.set(k, { t, n: 0, ch: 0 });
    const g = groups.get(k); g.n++;
    const nr = applyRule(r, mode); if (nr) { g.ch++; changed.set(r.id, nr); }
    const th = targetFor(r, 'horario'), te = targetFor(r, 'etiquetas');
    if (th && te && tgtKey(th) !== tgtKey(te) && inferFromTags(r.tags || '').context) conflicts.push({ r, th, te });
  });
  const rows = [...groups.entries()].sort((x, y) => (TGT_ORDER.indexOf(x[0]) + 99) % 99 - (TGT_ORDER.indexOf(y[0]) + 99) % 99).map(x => x[1]);
  const after = recs.map(r => changed.get(r.id) || r);
  return { mode, recs, scope, rows, none, changed, conflicts, before: stats(recs), after: stats(after), undoable: S.records.filter(r => r.prev).length };
}
function viewClassificar() {
  const R = ruleSummary();
  if (!R.recs.length) return banners() + `<div class="card">${emptyBlock('Sem medições', 'Importe o CSV do mySugr ou registre medições para classificar.', '<br><br><button class="btn pri" data-act="go" data-r="importar">Importar CSV</button>')}</div>`;
  let h = banners() + `<p class="hint" style="margin:0 0 12px">Define o contexto (jejum, antes ou depois da refeição) e a refeição de cada medição. As etiquetas originais do mySugr não são apagadas, e o valor anterior fica guardado para você desfazer.</p>`;
  h += `<div class="card"><div class="row sp"><div class="field" style="width:130px"><label class="fl" for="rule-n">Últimas medições</label><input class="in" id="rule-n" inputmode="numeric" value="${S.ruleN}"></div><p class="hint grow" style="margin:0">Só as <b class="num">${R.scope.length}</b> mais recentes, de <span class="num">${fmtDate(R.scope[0].date)}</span> a <span class="num">${fmtDate(R.scope[R.scope.length - 1].date)}</span>. As mais antigas não são alteradas.</p></div>
    <div style="margin-top:14px"><div class="fl">Critério</div><div class="seg" role="group" aria-label="Critério" style="display:flex">${Object.entries(RULE_MODES).map(([k, l]) => `<button style="flex:1" data-act="rule-mode" data-v="${k}" aria-pressed="${R.mode === k}">${l}</button>`).join('')}</div>
    <p class="hint">${R.mode === 'horario' ? '04h–08h jejum · 08h–10h pós do café · 10h–12h pré do almoço · 12h–16h pós do almoço · 16h–19h pré do jantar · 19h–00h pós do jantar. Entre 00h e 04h não há regra.' : 'Usa Pré-prandial, Pós-prandial, Jejum e a refeição marcados no mySugr. Quando a etiqueta não traz a refeição ou o pré/pós, o horário completa.'}</p></div></div><div style="height:12px"></div>`;
  h += `<div class="card"><div class="tbl-wrap"><table class="t"><thead><tr><th>Classificação</th><th>Medições</th><th>Mudam</th></tr></thead><tbody>${R.rows.map(x => `<tr><td style="text-align:left;white-space:normal">${tgtLabel(x.t)}</td><td>${x.n}</td><td>${x.ch}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">${R.none ? R.none + ' medições não entram em nenhuma classificação e ficam como estão.' : 'Todas as medições deste grupo entram em alguma classificação.'}</p></div>`;
  if (R.conflicts.length) {
    const ex = R.conflicts.slice(0, 3).map(c => `${fmtDate(c.r.date).slice(0, 5)} ${c.r.time}: etiqueta "${esc(c.r.tags)}" → ${tgtLabel(c.te)}; horário → ${tgtLabel(c.th)}`).join('<br>');
    h += `<div class="banner warn" style="margin-top:12px;display:block"><b>${R.conflicts.length} medições</b> têm etiqueta do mySugr diferente da regra de horários. Exemplos:<br><span class="dim">${ex}</span></div>`;
  }
  h += `<h2 class="sec">Efeito nas contagens</h2><div class="card"><div class="grid2"><div class="tile"><div class="lb">Acima da faixa hoje</div><div class="v num" style="font-size:28px">${R.before.hyper}</div></div><div class="tile ${R.after.hyper > R.before.hyper ? 'alert' : ''}"><div class="lb">Depois de aplicar</div><div class="v num" style="font-size:28px">${R.after.hyper}</div></div></div>
    <p class="hint">Medições de jejum usam 70 a 130 mg/dL como faixa normal. Valores entre 131 e 180 classificados como jejum passam a contar como acima da faixa.</p></div>`;
  h += `<div class="stack" style="margin-top:14px"><button class="btn pri full" data-act="rule-ask" ${R.changed.size ? '' : 'disabled'}>${R.changed.size ? 'Aplicar ao histórico (' + R.changed.size + ' mudam)' : 'Nada a alterar'}</button>${R.undoable ? `<button class="btn full" data-act="rule-undo">Desfazer (${R.undoable} medições)</button>` : ''}<button class="btn full" data-act="go" data-r="backup">Fazer backup antes</button></div>`;
  return h;
}

/* ---------- Relatórios ---------- */
function viewRelatorios() {
  const r = S.rep;
  if (!r.from) { r.to = isoDate(new Date()); r.from = isoDate(new Date(addDays(Date.now(), -29))); }
  const a = mkTs(r.from, '00:00'), b = endOfDay(mkTs(r.to, '00:00')), recs = inRange(S.records, a, b), st = stats(recs);
  return banners() + `<div class="card"><div class="form-grid"><div class="field"><label class="fl" for="r-from">De</label><input class="in" type="date" id="r-from" value="${r.from}"></div><div class="field"><label class="fl" for="r-to">Até</label><input class="in" type="date" id="r-to" value="${r.to}"></div></div>
    <div class="row" style="margin-top:12px">${[['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias']].map(([d, l]) => `<button class="btn sm" data-act="rep-quick" data-d="${d}">${l}</button>`).join('')}</div></div>
    <h2 class="sec">O que entra</h2><div class="card"><div class="grid3"><div class="tile"><div class="lb">Medições</div><div class="v num" style="font-size:22px">${st.n}</div></div><div class="tile"><div class="lb">Média</div><div class="v num" style="font-size:22px">${fm(st.mean)}</div></div><div class="tile"><div class="lb">&lt;70 / acima</div><div class="v num" style="font-size:22px">${st.hypo}/${st.hyper}</div></div></div>
    <ul class="plain"><li>Resumo, estatísticas, gráfico de medições e distribuição por faixa</li><li>Comparação com o período anterior de mesma duração</li><li>Episódios de hipoglicemia e hiperglicemia</li><li>Resultados laboratoriais de HbA1c (sem estimativas)</li><li>Esquemas de tratamento e comparação</li><li>Histórico completo de medições</li></ul></div>
    <div class="stack" style="margin-top:14px"><button class="btn pri full" data-act="rep-pdf" ${st.n ? '' : 'disabled'}>Gerar PDF</button><button class="btn full" data-act="rep-xlsx" ${st.n ? '' : 'disabled'}>Gerar Excel</button><button class="btn full" data-act="rep-summary">Resumo para a consulta (PDF, últimos 90 dias)</button></div>
    ${st.n ? '' : '<p class="hint">Não há medições neste intervalo.</p>'}<p class="hint" id="rep-status" role="status"></p>`;
}

/* ---------- Backup ---------- */
function viewBackup() {
  const nReal = S.records.filter(r => !isEx(r)).length;
  let h = banners() + `<div class="card"><div class="eyebrow">Seus dados</div><div class="grid3" style="margin-top:12px"><div class="tile"><div class="lb">Medições</div><div class="v num" style="font-size:22px">${S.records.length}</div></div><div class="tile"><div class="lb">HbA1c</div><div class="v num" style="font-size:22px">${S.hba.length}</div></div><div class="tile"><div class="lb">Esquemas</div><div class="v num" style="font-size:22px">${S.schemes.length}</div></div></div>
    <p class="hint" id="persist-note">Armazenamento: ${Store.persistent ? 'banco IndexedDB neste navegador' : 'indisponível (somente sessão)'}.</p>
    <p class="hint"><b>Atenção:</b> limpar os dados do site ou do navegador apaga tudo daqui. Faça backups regulares.</p></div>
    <h2 class="sec">Exportar</h2><div class="stack"><button class="btn pri full" data-act="bk-json">Backup completo (.json)</button><button class="btn full" data-act="bk-csv">Medições em CSV (.csv)</button></div>
    ${driveCard()}
    <h2 class="sec">Restaurar</h2><div class="card"><p class="hint" style="margin:0 0 12px">Escolha um arquivo .json gerado pelo TiaBete.</p><input type="file" id="rest-file" accept=".json,application/json" hidden><button class="btn full" data-act="pick-json">Escolher backup</button>`;
  if (S.rest) {
    const x = S.rest;
    h += `<div style="margin-top:14px"><div class="eyebrow">Arquivo lido</div><p style="margin:6px 0 4px" class="num">${x.records.length} medições · ${x.hba.length} HbA1c · ${x.schemes.length} esquemas</p><p class="hint" style="margin:0 0 12px">Exportado em ${esc(x.exportedAt ? new Date(x.exportedAt).toLocaleString('pt-BR') : 'data desconhecida')}.</p>
      <div class="stack"><button class="btn pri full" data-act="rest-merge">Mesclar com meus dados (sem duplicar)</button>
      <button class="btn danger full" data-act="rest-replace-ask">Substituir tudo por este backup</button></div></div>`;
  }
  h += lastBackupLine();
  h += `</div><h2 class="sec">Apagar dados</h2><div class="card" style="border-color:var(--low-bd)"><p class="hint" style="margin:0 0 12px">Remove os dados <b>deste aparelho</b> de forma definitiva. Não dá para desfazer: faça um backup antes.</p><div class="stack"><button class="btn danger full" data-act="wipe-ask" data-w="records">Apagar todas as medições (${S.records.filter(r => !isEx(r)).length})</button><button class="btn danger full" data-act="wipe-ask" data-w="all">Apagar tudo (medições, HbA1c, esquemas e exames)</button></div></div>`;
  return h;
}
function wipeSheet(w) {
  const nR = S.records.length, all = w === 'all';
  const what = all ? `${nR} medições, ${S.hba.length} resultados de HbA1c, ${S.schemes.length} esquemas e ${S.exams.length} exames` : `${nR} medições (HbA1c, esquemas e exames ficam)`;
  openSheet(`<h2>${all ? 'Apagar tudo?' : 'Apagar todas as medições?'}</h2><p style="margin:0 0 10px">Serão apagados: <b>${what}</b>. Isso não pode ser desfeito.</p><button class="btn full" data-act="bk-json" style="margin-bottom:12px">Fazer backup antes (.json)</button><label class="fl" for="wipe-t">Digite APAGAR para confirmar</label><input class="in" id="wipe-t" autocomplete="off" autocapitalize="characters" placeholder="APAGAR"><div class="row" style="margin-top:12px"><button class="btn danger grow" id="wipe-go" data-act="wipe-do" data-w="${w}" disabled>Apagar definitivamente</button><button class="btn" data-act="close">Cancelar</button></div>`);
}
async function wipeData(w) {
  await Store.delMany('records', S.records.map(r => r.id));
  if (w === 'all') { await Store.delMany('hba1c', S.hba.map(r => r.id)); await Store.delMany('schemes', S.schemes.map(r => r.id)); await Store.delMany('exams', S.exams.map(r => r.id)); await Store.delMany('events', S.events.map(r => r.id)); await Store.delMany('inslog', S.inslog.map(r => r.id)); S.inslog = []; S.ins = { basalTs: null, day: isoDate(new Date()), fast: null, lunch: null, dinner: null, dinnerMin: S.ins.dinnerMin }; await Store.put('meta', { id: 'insulin', ...S.ins }); }
  S.imp = null; S.rest = null; S.day = null; if (S.ex) { S.ex.sel = null; S.ex.narr = {}; S.ex.queue = []; if (w === 'all') S.ex.id = null; }
  await loadAll(); closeSheet(); go(w === 'all' ? 'painel' : 'backup'); toast(w === 'all' ? 'Todos os dados foram apagados.' : 'Todas as medições foram apagadas.');
}

/* ---------- Mais / Sobre ---------- */
const MI = {
  config: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900l2.100 2.100M17 17l2.100 2.100M4.900 19.100L7 17M17 7l2.100-2.100"/>',
  perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.400 3.600-7 8-7s8 2.600 8 7"/>',
  bolus: '<path d="M3 21l6-6M14 4l6 6M12 6l6 6-7 7-6-6zM9 9l3 3"/>',
  hba1c: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.500 6-11 6-11z"/><path d="M9.500 14.500a2.500 2.500 0 0 0 2.500 2.500"/>',
  hypo: '<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/>',
  insulinas: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  refeicoes: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10"/>',
  conquistas: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 21h8M10 17h4"/>',
  padroes: '<path d="M3 17l5-6 4 4 8-9M15 6h5v5"/>',
  exames: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M8 15h8"/>',
  classificar: '<path d="M20 12l-8 8-9-9V3h8zM7.500 7.500h.01"/>',
  perguntas: '<path d="M4 5h16v11H9l-5 4zM9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.700.400-1 .900-1 1.700"/>',
  importar: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  eventos: '<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/>',
  lembretes: '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4"/>',
  esquemas: '<path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3"/>',
  relatorios: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7"/>',
  backup: '<path d="M7 18a4 4 0 0 1-.500-8 6 6 0 0 1 11.500 1.500A3.500 3.500 0 0 1 17.500 18zM12 11v6M9.500 13.500L12 11l2.500 2.500"/>',
  ia: '<path d="M12 3l1.8 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800zM19 16l.8 2.200L22 19l-2.200.8L19 22l-.8-2.200L16 19l2.200-.8z"/>',
  aparencia: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.400 1.400M17.600 17.600L19 19M5 19l1.400-1.400M17.600 6.400L19 5"/>',
  sobre: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500h.01"/>'
};
function viewMais() {
  const mi = k => `<i class="mi-ic"><svg viewBox="0 0 24 24">${MI[k]}</svg></i>`;
  const it = (r, t, d) => `<button class="menu-item" data-act="go" data-r="${r}">${mi(r)}<div>${t}<span>${d}</span></div><svg class="chv" viewBox="0 0 24 24">${IC.chev}</svg></button>`;
  const hypo = `<button class="menu-item" data-act="hypo-open">${mi('hypo')}<div>Protocolo de hipoglicemia<span>Reavaliar a cada 15 minutos até voltar a 70 mg/dL ou mais</span></div><svg class="chv" viewBox="0 0 24 24">${IC.chev}</svg></button>`;
  return banners() + `<div class="stack">${it('bolus', 'Cálculo de bolus', 'Alimentos, refeições salvas, refeições feitas e bolus por dia')}${it('hba1c', 'Hemoglobina glicada', 'Resultados de laboratório e gráfico')}${hypo}${it('insulinas', 'Histórico de insulinas', 'Horários da basal e da insulina rápida, média e variação')}${it('conquistas', 'Conquistas', 'Marcos de 7, 14, 30 dias e 3 meses sem hipoglicemia, jejum até 130 e glicemia até 180')}${it('padroes', 'Padrões', 'Observações automáticas sobre horários, jejum e etiquetas')}${HAS_CLAUDE ? it('exames', 'Exames laboratoriais', 'Enviar PDFs, notas, contexto e comparação') : ''}${it('classificar', 'Classificar medições', 'Jejum, pré e pós-prandial e refeição das últimas medições')}${HAS_CLAUDE ? it('perguntas', 'Perguntar ao Claude', 'Faça perguntas sobre o seu histórico de registros') : ''}${VIEWS.ia ? it('ia', 'Inteligência artificial', 'Escolha o provedor e informe a sua chave') : ''}${it('importar', 'Importar do mySugr', 'Enviar CSV exportado, com prévia')}${it('eventos', 'Eventos', 'Marcar doença, viagem ou mudança de rotina nos gráficos')}${it('lembretes', 'Alertas e notificações', 'Avisos, lembretes de horário e silêncio noturno')}${it('esquemas', 'Esquemas de tratamento', 'Cadastro e comparação')}${it('relatorios', 'Relatórios', 'PDF e Excel por período')}${it('backup', 'Backup e dados', 'Exportar, restaurar, CSV')}${it('config', 'Configurações', 'Tema, tamanho da tela, metas, alertas e demais ajustes')}${it('perfil', 'Perfil', 'Nome, nascimento, tipo de diabetes e equipe de saúde')}${it('aparencia', 'Aparência', 'Tema claro, escuro ou automático')}${it('sobre', 'Sobre e limites', 'Privacidade, métodos e avisos')}</div>`;
}
function viewAparencia() { return banners() + themeCard() + scaleCard(); }

function viewSobre() {
  const kv = (k, v) => `<div class="row sp" style="gap:12px;padding:7px 0;border-bottom:1px solid var(--line);align-items:flex-start"><span class="dim" style="flex:none">${k}</span><b style="text-align:right;overflow-wrap:anywhere">${v}</b></div>`;
  const n = { med: S.records.filter(r => !isEx(r)).length, hba: S.hba.filter(x => !isEx(x)).length, ex: S.exams.length, ins: S.inslog.length };
  return `<div class="card"><div class="about-logo" role="img" aria-label="TiaBete Glicose Control"><svg viewBox="0 0 100 100" width="56" height="56" aria-hidden="true"><path d="M50 4 C50 4 14 44 14 66 A36 36 0 0 0 86 66 C86 44 50 4 50 4 Z" fill="var(--red)"/><path d="M30 66 A20 20 0 0 0 46 85" fill="none" stroke="var(--bg)" stroke-width="5.5" stroke-linecap="round"/></svg><span class="lw"><span class="ln">Tia<b>Bete</b></span><span class="ls">GLICOSE CONTROL</span></span></div><p style="margin:10px 0 0">Registro, importação e análise de glicemia capilar para acompanhar o controle da glicemia.</p></div>
  <h2 class="sec">Informações do aplicativo</h2><div class="card">
    ${kv('Versão', APP_VERSION)}${kv('Compilação', BUILD_DATE || '—')}${kv('Plataforma', IS_NATIVE ? 'Aplicativo Android' : 'Versão web (navegador)')}${kv('Banco de dados', 'Local no aparelho · esquema ' + SCHEMA_VERSION)}${kv('Desenvolvimento', esc(APP_INFO.dev))}${kv('Com assistência de', esc(APP_INFO.assist))}${kv('Código-fonte', esc(APP_INFO.repo))}
    <p class="hint" style="margin:10px 0 0">Para dúvidas e sugestões, abra uma “Issue” no repositório do código-fonte. Gráficos, importação de CSV e geração de Excel são do próprio app; PDF e leitura de exames usam as bibliotecas jsPDF e pdf.js, carregadas só quando você pede.</p></div>
  <h2 class="sec">Seus dados neste aparelho</h2><div class="card">${kv('Medições de glicemia', n.med)}${kv('Resultados de HbA1c', n.hba)}${kv('Exames laboratoriais', n.ex)}${kv('Registros de insulina', n.ins)}<p class="hint" style="margin:10px 0 0">Tudo fica só neste aparelho. Faça backup em Mais → Backup e dados.</p></div>
  <h2 class="sec">Privacidade</h2><div class="card"><p class="hint" style="margin:0">Os dados ficam no banco local deste aparelho. Não há contas nem rastreamento. Arquivos CSV e backups são lidos no aparelho. Única exceção: na tela de Exames, quando você pede a análise, o texto do exame (sem CPF e e-mail) é enviado ao Claude da sua conta, com sua autorização.</p></div>
  <h2 class="sec">Como os números são calculados</h2><div class="card"><ul class="plain" style="margin:0"><li>Faixas: &lt; 54 muito baixa · 54–69 baixa · 70–180 dentro da faixa · 181–250 elevada · &gt; 250 muito elevada (mg/dL). Em medições de <b>jejum</b> a faixa normal é 70–130, e acima de 130 é elevada.</li><li>“Episódio” de hipo ou hiperglicemia é uma medição fora do limite (&lt; 70 ou acima da faixa: &gt; 180, ou &gt; 130 em jejum). O app não agrupa medições em eventos.</li><li>As medições são pontuais. A distribuição por faixa é contagem de medições e não equivale a tempo no alvo (TIR).</li><li>Período anterior: mesma duração, imediatamente antes (30 dias contra os 30 anteriores).</li><li>Médias com menos de ${MIN_BUCKET} medições não são exibidas.</li><li>Classificação por horário (opcional): 04h–08h jejum; 08h–10h pós-prandial do café; 10h–12h pré-prandial do almoço; 12h–16h pós-prandial do almoço; 16h–19h pré-prandial do jantar; 19h–00h pós-prandial do jantar. Medições entre 00h e 04h e sem horário não são alteradas.</li><li>Estimativa de HbA1c: (média + 46,7) ÷ 28,7, opcional e separada dos exames. Não é GMI.</li></ul></div>
  <h2 class="sec">Avisos</h2><div class="card"><p class="hint" style="margin:0">O TiaBete não substitui avaliação médica nem muda o tratamento por conta própria. O cálculo de bolus apenas faz a conta com a razão que você definiu com a sua equipe de saúde, sem considerar a glicemia atual. Use os relatórios para conversar com sua equipe de saúde.</p></div>`;
}

/* ================= Roteamento e renderização ================= */

const VIEWS = { config: () => viewConfig(), perfil: () => viewPerfil(), aparencia: viewAparencia, painel: viewPainel, historico: viewHistorico, analise: viewAnalise, mais: viewMais, hba1c: viewHba, esquemas: viewEsquemas, importar: viewImportar, classificar: viewClassificar, relatorios: viewRelatorios, backup: viewBackup, sobre: viewSobre, exames: viewExames, eventos: viewEventos, insulinas: viewInsulinas, conquistas: viewConquistas,  lembretes: viewLembretes, padroes: viewPadroes, perguntas: viewPerguntas, exame: viewExame, comparar: viewComparar };
function render() {
  const route = VIEWS[S.route] ? S.route : 'painel';
  const back = !['painel', 'historico', 'analise', 'mais'].includes(route);
  const view = $('#view');
  view.innerHTML = `<h1 class="pg">${back ? `<button class="btn sm" data-act="go" data-r="${route === 'exame' || route === 'comparar' ? 'exames' : route === 'insulinas' ? 'painel' : 'mais'}" style="margin-right:10px;vertical-align:middle" aria-label="Voltar">←</button>` : ''}${TITLES[route]}</h1>` + VIEWS[route]();
  $('#nav').innerHTML = navHTML();
  makeAccordions(view);
  attachCharts(view);
  rewardSoon();
  setTimeout(drvAuto, 2500);
  setTimeout(insLink, 50); setTimeout(scrSetup, 30);
}
function navHTML() {
  const cur = navGroup(S.route), b = (r, i, l) => `<button data-act="go" data-r="${r}" ${cur === r ? 'aria-current="page"' : ''}>${ic(i)}${l}</button>`;
  return `<div class="nav-in">${b('painel', 'home', 'Painel')}${b('historico', 'list', 'Histórico')}<button class="fab" data-act="new" aria-label="Nova medição">${ic('plus')}</button>${b('analise', 'chart', 'Análise')}${b('mais', 'menu', 'Mais')}</div>`;
}
function go(r) { S.route = r; if (location.hash !== '#' + r) { try { location.hash = r; } catch (e) { } } render(); window.scrollTo(0, 0); }
function routeFromHash() { const h = location.hash.replace('#', ''); return h === 'exame' ? (S.exams.some(x => x.id === S.ex.id) ? 'exame' : 'exames') : VIEWS[h] ? h : 'painel'; }

/* ================= Eventos ================= */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  try {
    switch (act) {
      case 'go': S.imp = (el.dataset.r === 'importar' && S.imp && S.imp.done) ? null : S.imp; go(el.dataset.r); break;
      case 'new': openSheet(recordForm(null, el.dataset.ctx ? { context: el.dataset.ctx, meal: el.dataset.meal || undefined } : undefined)); break;
      case 'close': closeSheet(); break;
      case 'wipe-ask': wipeSheet(el.dataset.w); break;
      case 'wipe-do': if ($('#wipe-t').value.trim().toUpperCase() === 'APAGAR') { el.disabled = true; await wipeData(el.dataset.w); } break;
      case 'period': S.period = +el.dataset.p; render(); break;
      case 'day-prev': S.day = isoDate(new Date(addDays(mkTs(S.day || isoDate(new Date()), '12:00'), -1))); render(); break;
      case 'day-next': { const nx = isoDate(new Date(addDays(mkTs(S.day || isoDate(new Date()), '12:00'), 1))); S.day = nx >= isoDate(new Date()) ? null : nx; render(); break; }
      case 'day-today': S.day = null; render(); break;
      case 'open': openRecord(id); break;
      case 'edit': openSheet(recordForm(S.records.find(r => r.id === id))); break;
      case 'more': S.hist.limit += 60; $('#h-list').innerHTML = histListHTML(); break;
      case 'clear-filters': Object.assign(S.hist, { from: '', to: '', band: '', ctx: '', meal: '', mark: '' }); render(); break;
      case 'rm-examples': await removeExamples(); render(); toast('Dados de exemplo removidos.'); break;
      case 'del-ask': el.dataset.act = 'del-do'; el.textContent = 'Toque de novo para excluir'; el.classList.add('pri'); setTimeout(() => { if (el.isConnected && el.dataset.act === 'del-do') { el.dataset.act = 'del-ask'; el.textContent = 'Excluir registro'; el.classList.remove('pri'); } }, 4000); break;
      case 'del-do': await Store.del('records', id); await loadAll(); closeSheet(); render(); toast('Registro excluído.'); break;
      case 'ana-range': S.ana.range = el.dataset.v; render(); break;
      case 'ana-agg': S.ana.agg = el.dataset.v; render(); break;
      case 'hba-new': openSheet(hbaForm()); break;
      case 'hba-edit': { const x = S.hba.find(y => y.id === id); if (x && x.source === 'exame') openSheet(`<h2>Resultado vindo de um exame</h2><p style="margin:0 0 12px">HbA1c de <b>${fn(x.value, 1)}%</b> em ${fmtDate(x.date)}${x.lab ? ' · ' + esc(x.lab) : ''}. Este valor é lido do exame enviado. Para corrigir a data ou excluir, use a tela do exame.</p><div class="row"><button class="btn pri grow" data-act="ex-open" data-id="${x.examId}">Abrir o exame</button><button class="btn" data-act="close">Fechar</button></div>`); else openSheet(hbaForm(x)); break; }
      case 'del-ask-hba': case 'del-ask-sch': el.dataset.act = act.replace('ask', 'do'); el.textContent = 'Toque de novo para excluir'; el.classList.add('pri'); setTimeout(() => { if (el.isConnected && el.dataset.act === act.replace('ask', 'do')) { el.dataset.act = act; el.textContent = 'Excluir'; el.classList.remove('pri'); } }, 4000); break;
      case 'del-do-hba': await Store.del('hba1c', id); await loadAll(); closeSheet(); render(); toast('Resultado excluído.'); break;
      case 'del-do-sch': await Store.del('schemes', id); await loadAll(); closeSheet(); render(); toast('Esquema excluído.'); break;
      case 'a1c-save': { const v = parseNum($('#a1c-t').value); if (v === null || v < 4 || v > 12) { toast('Informe uma meta entre 4 e 12%.'); break; } S.a1cT = v; await Store.put('meta', { id: 'a1c-target', value: v }); render(); toast('Meta de HbA1c salva: ' + fn(v, 1) + '%.'); break; }
      case 'est-on': S.est = true; render(); break;
      case 'est-off': S.est = false; render(); break;
      case 'sch-new': openSheet(schemeForm()); break;
      case 'sch-edit': openSheet(schemeForm(S.schemes.find(x => x.id === id))); break;
      case 'pick-csv': $('#imp-file').click(); break;
      case 'rule-ask': el.dataset.act = 'rule-apply'; el.textContent = 'Toque de novo para confirmar'; setTimeout(() => { if (el.isConnected && el.dataset.act === 'rule-apply') { el.dataset.act = 'rule-ask'; el.textContent = 'Aplicar ao histórico'; render(); } }, 5000); break;
      case 'label-now': { const sv = S.ruleMode; S.ruleMode = 'horario'; const ch = [...ruleSummary().changed.values()]; S.ruleMode = sv; await Store.putMany('records', ch); await loadAll(); render(); toast(ch.length + ' medições etiquetadas. Para desfazer: Mais, Classificar medições.'); break; }
      case 'rule-mode': S.ruleMode = el.dataset.v; render(); break;
      case 'rule-apply': { const ch = [...ruleSummary().changed.values()]; await Store.putMany('records', ch); await loadAll(); render(); toast(ch.length + ' medições atualizadas.'); break; }
      case 'rule-undo': { const ch = S.records.map(undoRule).filter(Boolean); await Store.putMany('records', ch); await loadAll(); render(); toast(ch.length + ' medições voltaram ao valor anterior.'); break; }
      case 'imp-reset': S.imp = null; render(); break;
      case 'imp-commit': el.disabled = true; await commitImport(); break;
      case 'rep-quick': { const to = isoDate(new Date()); S.rep = { to, from: isoDate(new Date(addDays(Date.now(), -(+el.dataset.d - 1)))) }; render(); break; }
      case 'rep-pdf': el.disabled = true; await makePDF(); el.disabled = false; break;
      case 'rep-xlsx': el.disabled = true; await makeXLSX(); el.disabled = false; break;
      case 'bk-json': await exportBackup(); break;
      case 'bk-csv': await exportCSV(); break;
      case 'pick-json': $('#rest-file').click(); break;
      case 'rest-merge': await restoreBackup(false); break;
      case 'rest-replace-ask': el.dataset.act = 'rest-replace'; el.textContent = 'Toque de novo: isto apaga os dados atuais'; el.classList.add('pri'); break;
      case 'rest-replace': await restoreBackup(true); break;
    }
  } catch (err) { console.error(err); toast('Algo deu errado: ' + (err && err.message || err)); }
});
document.addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target;
  try {
    if (f.id === 'rec-form') await saveRecord(f);
    else if (f.id === 'hba-form') {
      const v = parseNum($('#hb-v').value), d = parseDate($('#hb-d').value), err = m => { $('#hb-err').textContent = m; };
      if (v === null || v < 3 || v > 20) return err('Informe a HbA1c entre 3 e 20%.'); if (!d) return err('Informe a data da coleta.');
      const old = f.dataset.id ? S.hba.find(x => x.id === f.dataset.id) : null;
      const x = { ...(old || {}), id: old ? old.id : uid(), date: d, value: v, lab: $('#hb-l').value.trim(), notes: $('#hb-n').value.trim() };
      let note = ''; if (hasExamples() && !old) { await removeExamples(); note = ' Dados de exemplo removidos.'; }
      await Store.put('hba1c', x); await loadAll(); closeSheet(); render(); toast('Resultado salvo.' + note);
    } else if (f.id === 'sch-form') {
      const name = $('#s-name').value.trim(), st = parseDate($('#s-st').value), en = $('#s-en').value ? parseDate($('#s-en').value) : '', err = m => { $('#s-err').textContent = m; };
      if (!name) return err('Dê um nome ao esquema.'); if (!st) return err('Informe a data de início.'); if ($('#s-en').value && !en) return err('Data de encerramento inválida.'); if (en && en < st) return err('O encerramento não pode ser antes do início.');
      const old = f.dataset.id ? S.schemes.find(x => x.id === f.dataset.id) : null;
      const x = { ...(old || {}), id: old ? old.id : uid(), name, basalInsulin: $('#s-bi').value.trim(), basalDose: $('#s-bd').value.trim(), rapidInsulin: $('#s-ri').value.trim(), mealDoses: $('#s-md').value.trim(), times: $('#s-t').value.trim(), extraMeds: $('#s-em').value.trim(), start: st, end: en, notes: $('#s-no').value.trim() };
      let note = ''; if (hasExamples() && !old) { await removeExamples(); note = ' Dados de exemplo removidos.'; }
      await Store.put('schemes', x); await loadAll(); closeSheet(); render(); toast('Esquema salvo.' + note);
    }
  } catch (err) { console.error(err); toast('Não foi possível salvar: ' + (err && err.message || err)); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'wipe-t') { const b = $('#wipe-go'); if (b) b.disabled = e.target.value.trim().toUpperCase() !== 'APAGAR'; return; }
  if (e.target.id === 'ex-q') { S.ex.q = e.target.value; const l = $('#ex-list'); if (l) l.innerHTML = exListHTML(); return; }
  if (e.target.id === 'h-q') { S.hist.q = e.target.value; S.hist.limit = 60; $('#h-list').innerHTML = histListHTML(); }
});
document.addEventListener('change', async e => {
  const t = e.target, id = t.id;
  const map = { 'h-from': 'from', 'h-to': 'to', 'h-band': 'band', 'h-ctx': 'ctx', 'h-meal': 'meal', 'h-mark': 'mark' };
  if (map[id]) { S.hist[map[id]] = t.value; S.hist.limit = 60; $('#h-list').innerHTML = histListHTML(); const sm = $('details.more summary'); const n = [S.hist.from, S.hist.to, S.hist.band, S.hist.ctx, S.hist.meal].filter(Boolean).length; if (sm) sm.textContent = 'Filtros' + (n ? ` · ${n} ativo${n > 1 ? 's' : ''}` : ''); }
  else if (['a-from', 'a-to', 'b-from', 'b-to'].includes(id)) { S.ana[id[0].toUpperCase()][id.slice(2)] = t.value; $('#cmp').innerHTML = compareCardHTML(); }
  else if (id === 'r-from' || id === 'r-to') { S.rep[id.slice(2)] = t.value; if (S.rep.from && S.rep.to && S.rep.from > S.rep.to) { S.rep.to = S.rep.from; } render(); }
  else if (id === 'imp-file') { await handleCsvFile(t.files[0]); t.value = ''; }
  else if (id === 'imp-hba') { S.imp.includeHba = t.checked; render(); }
  else if (id === 'imp-rule') { S.imp.timeRule = t.checked; render(); }
  else if (id === 'rule-n') { const n = parseInt(t.value, 10); S.ruleN = n > 0 ? Math.min(n, 100000) : 180; render(); }
  else if (id === 'rest-file') { await readBackupFile(t.files[0]); t.value = ''; }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
document.addEventListener('pointerdown', e => { if (!e.target.closest('.chart')) $$('.tip').forEach(t => t.hidden = true); });
window.addEventListener('hashchange', () => { const r = routeFromHash(); if (r !== S.route) { S.route = r; render(); window.scrollTo(0, 0); } });

/* ================= Arquivos: salvar, backup e CSV ================= */
async function saveFile(name, data, textFallback) {
  let dl = null; try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { }
  if (!dl) {
    if (textFallback) { openSheet(`<h2>Copie o conteúdo</h2><p class="hint" style="margin:0 0 10px">Este visualizador não permite baixar arquivos. Copie o texto abaixo e salve como <b>${esc(name)}</b>.</p><textarea class="in" id="fb-text" style="min-height:200px;font-family:var(--f-mono);font-size:12px" readonly>${esc(textFallback)}</textarea><div class="row" style="margin-top:12px"><button class="btn pri grow" data-act="close">Fechar</button></div>`); setTimeout(() => { const t = $('#fb-text'); if (t) t.select(); }, 80); return false; }
    toast('Download indisponível neste visualizador.'); return false;
  }
  try { await dl.save({ filename: name, data }); toast('Arquivo salvo: ' + name); return true; }
  catch (e) { toast(e && e.code === 'declined' ? 'Download cancelado.' : 'Não foi possível salvar o arquivo.'); return false; }
}
const stamp = () => isoDate(new Date());
function backupText() {
  const payload = { app: 'TiaBete', version: APP_VERSION, schema: SCHEMA_VERSION, exportedAt: new Date().toISOString(), records: S.records.filter(r => !isEx(r)), hba1c: S.hba.filter(x => !isEx(x) && x.source !== 'exame'), schemes: S.schemes.filter(x => !isEx(x)), exams: S.exams, events: S.events, inslog: S.inslog, settings: { a1cTarget: S.a1cT }, state: { insulin: S.ins, rewards: S.rw || null, saved: S.saved || [], profile: S.profile || undefined, alerts: JSON.stringify(alCfg()) !== JSON.stringify(AL_DEF) ? alCfg() : undefined, bolus: blHasData() || JSON.stringify(S.bl.foods) !== JSON.stringify(BL_FOODS) ? S.bl : null } };
  if (!payload.records.length && !payload.hba1c.length && !payload.schemes.length && !payload.exams.length && !blHasData()) return null;
  return JSON.stringify(payload, null, 1);
}
async function exportBackup() {
  const txt = backupText(); if (!txt) { toast('Ainda não há dados reais para exportar.'); return; }
  if (await saveFile(`tiabete-backup-${stamp()}.json`, txt, txt) === true) { await markBackup(); render(); }
}
function csvCell(v) { const s = String(v == null ? '' : v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
const csvNum = v => v == null ? '' : String(v).replace('.', ',');
async function exportCSV() {
  const head = ['Data', 'Horário', 'Glicemia (mg/dL)', 'Contexto', 'Refeição', 'Carboidratos (g)', 'Insulina rápida (U)', 'Correção (U)', 'Basal (U)', 'Caneta (U)', 'Bomba (U)', 'Atividade (min)', 'Atividade', 'Etiquetas', 'Observações', 'Esquema', 'Origem'];
  const rows = S.records.filter(r => !isEx(r)).map(r => { const sc = S.schemes.find(s => s.id === schemeOf(r, S.schemes)); return [fmtDate(r.date), r.noTime ? '' : r.time, csvNum(r.glucose), CONTEXTS[r.context] || '', MEALS[r.meal] || '', csvNum(r.carbs), csvNum(r.insMeal), csvNum(r.insCorr), csvNum(r.insBasal), csvNum(r.insPen), csvNum(r.insPump), csvNum(r.actMin), r.actDesc || '', r.tags || '', r.notes || '', sc ? sc.name : '', r.source || '']; });
  if (!rows.length) { toast('Ainda não há medições reais para exportar.'); return; }
  const txt = '﻿' + [head, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n');
  await saveFile(`tiabete-medicoes-${stamp()}.csv`, txt, txt);
}
async function readBackupFile(file) {
  if (!file) return;
  try {
    const j = JSON.parse((await file.text()).replace(/^﻿/, ''));
    if (!j || !['GlicoTrack', 'TiaBete'].includes(j.app) || !Array.isArray(j.records)) throw new Error('Este arquivo não é um backup do TiaBete.');
    if (j.schema && j.schema > SCHEMA_VERSION) throw new Error('Este backup foi criado por uma versão mais nova do TiaBete.');
    const okRec = r => r && typeof r.date === 'string' && parseDate(r.date) && typeof r.glucose === 'number' && r.glucose >= GLU_MIN && r.glucose <= GLU_MAX;
    const recs = j.records.filter(okRec).map(r => ({ ...r, id: r.id || uid(), time: r.time || '00:00', ts: mkTs(r.date, r.time || '00:00') }));
    const bad = j.records.length - recs.length;
    S.rest = { state: j.state && typeof j.state === 'object' ? j.state : null, records: recs, hba: (j.hba1c || []).filter(x => x && parseDate(x.date) && typeof x.value === 'number').map(x => ({ ...x, id: x.id || uid() })), schemes: (j.schemes || []).filter(x => x && x.name && parseDate(x.start)).map(x => ({ ...x, id: x.id || uid() })), settings: j.settings && typeof j.settings.a1cTarget === 'number' ? j.settings : null, events: (Array.isArray(j.events) ? j.events : []).filter(x => x && parseDate(x.date) && typeof x.text === 'string').map(x => ({ id: x.id || uid(), date: x.date, text: x.text.slice(0, 60) })), exams: (Array.isArray(j.exams) ? j.exams : []).filter(x => x && Array.isArray(x.items)).map(x => ({ ...x, id: x.id || uid() })), inslog: (Array.isArray(j.inslog) ? j.inslog : []).filter(x => x && ['basal', 'fast', 'lunch', 'dinner'].includes(x.kind) && typeof x.ts === 'number' && x.ts > 0).map(x => ({ id: x.id || uid(), kind: x.kind, ts: x.ts, date: isoDate(new Date(x.ts)), at: x.at || x.ts })), exportedAt: j.exportedAt, bad };
    if (bad) toast(`${bad} registro(s) inválido(s) do arquivo serão ignorados.`);
    render();
  } catch (e) { S.rest = null; render(); toast(e.message && e.message.length < 90 ? e.message : 'Não consegui ler este backup.'); }
}
async function restoreBackup(replace) {
  const x = S.rest; if (!x) return;
  if (replace) { await Store.delMany('records', S.records.map(r => r.id)); await Store.delMany('hba1c', S.hba.map(r => r.id)); await Store.delMany('schemes', S.schemes.map(r => r.id)); await Store.delMany('exams', S.exams.map(r => r.id)); await Store.delMany('events', S.events.map(r => r.id)); await Store.delMany('inslog', S.inslog.map(r => r.id)); await loadAll(); }
  else if (hasExamples()) await removeExamples();
  const haveK = new Set(S.records.map(dedupKey)), haveId = new Set(S.records.map(r => r.id)); let added = 0, dup = 0; const addR = [];
  x.records.forEach(r => { const k = dedupKey(r); if (haveId.has(r.id) || haveK.has(k)) { dup++; return; } haveK.add(k); haveId.add(r.id); addR.push(r); added++; });
  const hk = new Set(S.hba.map(h => h.id + '|' + h.date + '|' + h.value)), hs = new Set(S.hba.map(h => h.date + '|' + h.value)); const addH = x.hba.filter(h => !hs.has(h.date + '|' + h.value));
  const sid = new Set(S.schemes.map(s => s.id)); const addS = x.schemes.filter(s => !sid.has(s.id));
  await Store.putMany('records', addR); await Store.putMany('hba1c', addH); await Store.putMany('schemes', addS);
  const eid = new Set(S.exams.map(x => x.id)), eh = new Set(S.exams.map(x => x.hash).filter(Boolean)); const addE = (x.exams || []).filter(e => !eid.has(e.id) && !(e.hash && eh.has(e.hash))); await Store.putMany('exams', addE);
  const evk = new Set(S.events.map(v => v.date + '|' + v.text)), evid = new Set(S.events.map(v => v.id)); await Store.putMany('events', (x.events || []).filter(v => !evid.has(v.id) && !evk.has(v.date + '|' + v.text)));
  { const ik = new Set(S.inslog.map(v => v.kind + '|' + v.ts)), iid = new Set(S.inslog.map(v => v.id)); await Store.putMany('inslog', (x.inslog || []).filter(v => !iid.has(v.id) && !ik.has(v.kind + '|' + v.ts))); }
  if (replace && x.settings && x.settings.a1cTarget >= 4 && x.settings.a1cTarget <= 12) { S.a1cT = x.settings.a1cTarget; await Store.put('meta', { id: 'a1c-target', value: S.a1cT }); }
  await applyBackupState(x.state, replace);
  S.rest = null; await loadAll(); render(); toast(`Restaurado: ${added} medições novas, ${dup} já existiam` + (addE.length ? `, ${addE.length} exame(s).` : '.'));
}
