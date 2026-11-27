/* ================= Início: interface =================
   Centro de acompanhamento. A lógica (sem DOM) está em inicio-core.js; aqui só há montagem de HTML e eventos.
   Estrutura da tela (de cima para baixo):
   1. avisos e lembretes (banners existentes, intactos)
   2. Resumo glicêmico (estrutural, fixo no topo; só o dia atual, recolhido/expandido)
   3. Cards personalizáveis, todos movíveis e ocultáveis (ordem e visibilidade escolhidas pela pessoa): Período de análise (7/30/90 dias e texto),
      indicadores do painel (um card cada), atalhos contextuais, acontecimentos importantes e os demais cartões do Início
   4. Central de Métricas (estrutural, fixa no final; bloco existente, adicionado por viewPainel) */
const IN_LS = 'tb-inicio';
let inPrefsRaw, inPrefsCache = null, inMemo = { key: '', m: null };
/* Preferências GUARDADAS (nunca apagadas por mudança de plano). inPrefs() é o layout EFETIVO: sem autorização Premium vale a base universal. */
function inPrefsStored() {
  let raw = null; try { raw = localStorage.getItem(IN_LS); } catch (e) { }
  if (inPrefsCache === null || raw !== inPrefsRaw) { inPrefsRaw = raw; inPrefsCache = inParsePrefs(raw); }
  return inPrefsCache;
}
const inPrefs = () => hbLayout(inPrefsStored(), gxhAuth(), typeof mdActive === 'function' ? mdActive() : 'experience');
function inPrefsSave(p) {
  p = inCleanPrefs(p);
  try { if (inIsDefault(p)) localStorage.removeItem(IN_LS); else localStorage.setItem(IN_LS, JSON.stringify(p)); } catch (e) { }
  inPrefsCache = p; try { inPrefsRaw = localStorage.getItem(IN_LS); } catch (e) { inPrefsRaw = null; }
}

/* Modelo calculado uma vez por combinação de dados/período/minuto (as telas redesenham com frequência). */
function inModel() {
  const now = Date.now(), R = S.records, n = R.length, last = R[n - 1];
  let cs = 0; for (let i = 0; i < n; i++) cs = (cs * 31 + Math.round(R[i].glucose * 10) + (R[i].ts % 100003)) % 1000000007;
  const hs = S.hba.reduce((a, x) => a + (x.value || 0) * 7 + (x.date ? x.date.length : 0), 0), xs = S.exams.reduce((a, x) => a + ((x.addedAt || 0) % 9973) + (x.items ? x.items.length : 0), 0);
  const key = [n, last && last.id, cs, S.period, Math.floor(now / 60000), S.hba.length, hs, S.exams.length, xs, S.a1cT, LIM.low, LIM.high].join('|');
  if (inMemo.key === key) return inMemo.m;
  const e = est90(), hbaEst = { ok: e.ok, value: e.value, tone: e.ok ? (a1cEval(e.value, S.a1cT).k === 'ok' ? 'ok' : 'warn') : null };
  const m = inSituation(R, now, S.period, hbaEst);
  m.events = inEvents({ records: R, hba: S.hba, exams: S.exams, now, period: S.period, markLabels: typeof MARKS === 'object' ? MARKS : {} });
  inMemo = { key, m }; return m;
}

/* ---------- ícones novos ---------- */
Object.assign(PNI, {
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  plate: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.7M6.6 7.6A17 17 0 0 0 2 12s4 6 10 6a9.4 9.4 0 0 0 4-.9"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  flat: '<path d="M4 12h16M16 8l4 4-4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
});
const IN_EVI = { hipo: 'warn', media: 'trend', var: 'scale', exame: 'flask', hba: 'hb', recorde: 'star', padrao: 'pie' };
const inTone = t => t === 'bad' ? ' st-bad' : t === 'warn' ? ' st-warn' : t === 'ok' ? ' st-ok' : '';
const inBand = k => k === 'ok' ? 'ok' : (k === 'low' || k === 'vlow') ? 'low' : 'high';

/* ---------- 2. Resumo glicêmico (só o dia atual) e período de análise (componente independente) ---------- */
/* Barra de faixa glicêmica: mesmas faixas, cores e escala (30–600) do glicosímetro (GZ, GZ_ZONES, gzFrac em charts.js).
   `pv` = {f, v, st} da última barra desenhada: a animação do marcador (e da cor) parte dali.
   g == null (sem medição no dia): barra neutra, todas as faixas atenuadas e sem marcador. */
let inRsMem = null;
function inRangeBar(g, anim, pv) {
  const C = GZ.ult, none = g == null, hi = !none && g > 600, st = none ? 'ok' : gzState(g), act = none ? '' : hi ? 'xhigh' : st, f = none ? 0 : hi ? 1 : gzFrac('ult', g), p0 = pv || { f: 0, st };
  if (!none) inRsMem = { f, v: g, st };
  const pc = x => (x * 100).toFixed(2);
  const segs = GZ_ZONES.map(z => {
    const a = Math.max(z.from, C.min), b = Math.min(z.to, C.max); if (b <= a) return '';
    return `<i class="in-rb-z${z.k === act ? ' on' : ''}${z.dash ? ' dash' : ''}" style="left:${pc(gzFrac('ult', a))}%;width:${pc(gzFrac('ult', b) - gzFrac('ult', a))}%;--zc:${z.c}"></i>`;
  }).join('');
  const ticks = C.ticks.filter(t => t > C.min && t < C.max).map(t => `<span style="left:${pc(gzFrac('ult', t))}%">${t}</span>`).join('');
  return `<span class="in-rb s-${st}${none ? ' none' : ''}${anim && !none ? ' in-rb-anim' : ''}" style="--p:${pc(f)}%;--pf:${pc(p0.f)}%;--gc:${GZ_COL[st]};--gc0:${GZ_COL[p0.st]}" aria-hidden="true"><span class="in-rb-bar">${segs}${none ? '' : '<i class="in-rb-mk"></i>'}</span><span class="in-rb-t">${ticks}</span></span>`;
}
/* Cartão "Resumo glicêmico": só medições da data local de hoje (inToday). Recolhido: última glicemia + barra + média e registros do dia.
   Expandido (toque no cartão): estatísticas do dia e todos os registros, do mais recente ao mais antigo. Não depende do período 7/30/90. */
const inRsIso = () => isoDate(new Date());
function inRsRow(r) {
  return `<button class="rec g-${bandOf(r.glucose, r.context).k}" data-act="open" data-id="${esc(r.id)}"><span class="tm num"><b>${r.noTime ? '—:—' : r.time}</b></span><span class="info">${badge(r.glucose, r.context)}<span class="chips">${recChips(r)}</span></span><span class="gl num">${fn(r.glucose, 1)}<small>mg/dL</small></span></button>`;
}
function inHero() {
  const T = inToday(S.records, Date.now()), has = T.n > 0, last = T.last, g = has ? last.glucose : null, hi = has && g > 600;
  const bnd = has ? bandOf(g, last.context) : null, open = has && !!S.rsOpen;
  const gKey = has ? last.id + '|' + g : '', gAnim = has && S.gaugeKey !== gKey; if (has) S.gaugeKey = gKey;
  const pv = inRsMem, bar = inRangeBar(g, gAnim, pv), from = pv ? pv.v : GZ.ult.min;
  const dayTxt = 'Hoje · ' + fmtDate(T.iso).slice(0, 5);
  const title = has
    ? `<button type="button" class="in-rs-tg" data-act="in-rs" aria-expanded="${open}" aria-controls="in-rs-x" aria-label="Resumo glicêmico, ${open ? 'expandido' : 'recolhido'}. ${open ? 'Toque para recolher' : 'Toque para ver todos os registros de hoje'}.">Resumo glicêmico</button>`
    : 'Resumo glicêmico';
  const head = `<header class="in-rs-h"><h2 class="in-rs-t">${title}</h2><span class="in-rs-d num">${esc(dayTxt)}</span>${has ? '<span class="ds-chev in-rs-chev" aria-hidden="true"></span>' : ''}</header>`;
  const when = has ? (last.noTime ? '<span>Sem horário</span>' : `<span>${last.time}</span><span class="in-ago" data-ts="${last.ts}">${esc(relTime(last.ts))}</span>`) + (last.context && CONTEXTS[last.context] ? `<span class="tag">${esc(CONTEXTS[last.context])}</span>` : '') : '';
  const lastBlk = has
    ? `<div class="in-last${gAnim ? ' in-rs-anim' : ''}" role="group" aria-label="Última glicemia registrada: ${hi ? 'HI, acima de 600' : fn(g, 1)} mg/dL, ${bnd.txt}, ${last.noTime ? 'sem horário' : esc(last.time)}. Escala de ${GZ.ult.min} a ${GZ.ult.max} mg/dL.">
        <span class="in-last-k">Última glicemia registrada</span>
        <span class="in-last-top"><span class="in-last-v num"><span class="in-rs-num" data-to="${hi ? '' : g}" data-from="${from}">${hi ? 'HI' : fn(g, 1)}</span><small>${hi ? 'acima de 600 mg/dL' : 'mg/dL'}</small></span>${badge(g, last.context, true)}</span>
        <span class="in-when num">${when}</span>${bar}</div>`
    : `<div class="in-last is-none" role="group" aria-label="Última glicemia registrada: nenhuma medição hoje.">
        <span class="in-last-k">Última glicemia registrada</span>
        <span class="in-last-top"><span class="in-last-v num"><span class="in-rs-num">—</span></span></span>
        <span class="in-when">Nenhuma medição hoje</span>${bar}</div>`;
  const dTone = has && bandOf(T.mean).k === 'ok' ? ' st-ok' : has ? ' st-warn' : '';
  const ind = `<div class="in-rs-m${dTone}" role="group" aria-label="Indicadores do dia"><span class="in-rs-c"><span class="in-rs-k">Média do dia</span><span class="in-rs-mv num"><b>${has ? fn(T.mean, 1) : '—'}</b>${has ? '<small>mg/dL</small>' : ''}</span></span><span class="in-rs-c"><span class="in-rs-k">Registros do dia</span><span class="in-rs-mv num"><b>${T.n}</b></span></span></div>`;
  let more = '';
  if (has) {
    const st = (k, v, u, tone) => `<span class="in-rs-c${tone ? ' ' + tone : ''}"><span class="in-rs-k">${k}</span><span class="in-rs-mv num"><b>${v}</b>${u ? `<small>${u}</small>` : ''}</span></span>`;
    more = `<div class="in-rs-xb"><div class="in-rs-xin" id="in-rs-x" role="region" aria-label="Registros de hoje"${open ? '' : ' inert'}>
      <div class="in-rs-st">${st('Menor', fn(T.min, 1), 'mg/dL')}${st('Maior', fn(T.max, 1), 'mg/dL')}${st('Na faixa', T.inN, '', 'ok')}${st('Fora da faixa', T.outN, '', T.outN ? 'bad' : '')}</div>
      <h3 class="in-h3 in-rs-lh">Registros de hoje <small class="num">· ${T.n}</small></h3>
      <div class="in-rs-list">${T.items.map(inRsRow).join('')}</div>
      <button type="button" class="btn sm in-rs-less" data-act="in-rs">Recolher</button>
    </div></div>`;
  }
  const cls = has ? 'b-' + bnd.k : 'b-none';
  return `<section class="in-hero ${cls}${open ? ' open' : ''}${has ? ' can-open' : ''}" data-day="${T.iso}" aria-label="Resumo glicêmico">${head}${lastBlk}${ind}${more}</section>`;
}
/* Aviso discreto quando a última medição de todas tem mais de 48 h (independe do período e do dia). */
function inStale(M) {
  return M.stale ? `<div class="in-stale" role="status"><span>Sem medições há ${Math.round(M.ageMs / 86400e3)} dias.</span><button type="button" class="btn sm" data-act="new">Nova medição</button></div>` : '';
}
/* Período de análise: card editável (movível e ocultável como os demais). O seletor 7/30/90 dias (data-act="period", S.period) e o texto do
   período ficam aqui; os indicadores são cards próprios (inIndCard). Nada disso altera o Resumo glicêmico. */
function inPeriodo(M) {
  return `<section class="in-pc wide" aria-label="Período de análise">
    <div class="in-per"><span class="eyebrow in-per-t">Período de análise</span><span class="eyebrow num in-per-r">${fmtDM(M.cur[0])} – ${fmtDM(M.cur[1])}</span></div>
    <div class="seg" role="group" aria-label="Período">${[7, 30, 90].map(p => `<button data-act="period" data-p="${p}" aria-pressed="${S.period === p}">${p} dias</button>`).join('')}</div>
    <p class="in-sum">${esc(inSummary(M, { noLast: true }))}</p>
  </section>`;
}
/* Indicador do painel como card próprio (id do card: 'ind-' + indicador). Mesmos valores, textos e janela de detalhes de antes. */
function inIndCard(k, M) {
  const x = inIndicator(k, M);
  const bar = x.k === 'faixa' && x.pct != null ? `<i class="in-bar" aria-hidden="true"><i style="width:${Math.max(2, Math.min(100, x.pct)).toFixed(0)}%"></i></i>` : '';
  const arrow = x.k === 'tend' ? `<span class="in-arr dir-${x.dir || 'none'}" aria-hidden="true">${x.v}</span>` : `<b class="num in-ind-v">${x.v}</b>`;
  return `<button type="button" class="in-ind${inTone(x.tone)}" data-pm="${x.pm}" aria-haspopup="dialog" aria-label="${esc(x.t)}: ${esc(x.v + ' ' + x.u)}, ${esc(x.sub)}. Toque para ver os detalhes.">`
    + `<span class="in-ind-t">${esc(x.t)}</span><span class="in-ind-row">${arrow}<small class="in-ind-u">${esc(x.u)}</small></span>${bar}<span class="in-ind-s">${esc(x.sub)}</span></button>`;
}

/* ---------- 3. Atalhos contextuais ---------- */
function inShortcutsHTML() {
  let remWin = null, planN = 0, irN = 0;
  try { remWin = alCfg().bMiss ? remPending() : null; } catch (e) { }
  try { planN = plPending().length; } catch (e) { }
  try { irN = irDueNow().length; } catch (e) { }
  const list = inShortcuts({ records: S.records, exams: S.exams, now: Date.now(), remWin, planN, irN });
  if (!list.length) return '';
  return `<div class="in-sc wide" role="group" aria-label="Atalhos">${list.map(x => `<button type="button" class="in-chip" data-act="${x.act}"${x.id ? ` data-id="${esc(x.id)}"` : ''}${x.d ? ` data-d="${esc(x.d)}" data-t="${esc(x.t || '')}"` : ''}${x.ctx ? ` data-ctx="${esc(x.ctx)}"` : ''}${x.meal ? ` data-meal="${esc(x.meal)}"` : ''}>${pnIc(x.icon)}<span><b>${esc(x.label)}</b><small>${esc(x.sub)}</small></span></button>`).join('')}</div>`;
}

/* ---------- 4. Acontecimentos importantes ---------- */
function inEventItem(e) {
  const a = e.act || {};
  return `<li><button type="button" class="in-evi${inTone(e.tone)}" data-act="in-ev" data-t="${esc(a.type || '')}" data-id="${esc(a.id || '')}"><span class="in-evi-ic">${pnIc(IN_EVI[e.kind] || 'bars')}</span><span class="in-evi-b"><b>${esc(e.title)}</b><span>${esc(e.text)}</span></span><span class="in-evi-go" aria-hidden="true">›</span></button></li>`;
}
function inEventsCard(M, sz) {
  const ev = M.events || []; if (!ev.length) return '';
  const top = ev.slice(0, sz === 'x' ? ev.length : IN_EV_MAX), rest = ev.slice(top.length);
  return `<section class="in-ev wide" aria-labelledby="in-ev-h"><div class="in-ev-hd"><h2 id="in-ev-h">Acontecimentos importantes</h2><span class="in-count num" aria-label="${ev.length} acontecimentos">${ev.length}</span></div><ul class="in-evl">${top.map(inEventItem).join('')}</ul>${rest.length ? `<details class="in-more"><summary>Ver mais ${rest.length}</summary><ul class="in-evl">${rest.map(inEventItem).join('')}</ul></details>` : ''}</section>`;
}

/* ---------- 5. Evolução do dia ---------- */
function inDayChart(D, isToday) {
  const W = 320, H = 104, L = 26, R = 8, T = 8, B = 18, pw = W - L - R, ph = H - T - B, pts = D.timed;
  if (!pts.length) return '';
  const sc = inScale(pts.map(i => i.r.glucose), LIM.low, LIM.high), X = ts => { const d = new Date(ts); return L + ((d.getHours() * 60 + d.getMinutes()) / 1440) * pw; }, Y = v => T + ph - sc.pos(v) / 100 * ph;
  let g = `<rect class="in-gb" x="${L}" y="${Y(LIM.high).toFixed(1)}" width="${pw}" height="${(Y(LIM.low) - Y(LIM.high)).toFixed(1)}"/>`;
  [0, 6, 12, 18, 24].forEach(h => { const x = L + h / 24 * pw; g += `<line class="in-gx" x1="${x}" x2="${x}" y1="${T}" y2="${T + ph}"/><text class="in-gt" x="${x}" y="${H - 4}" text-anchor="${h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}">${String(h).padStart(2, '0')}h</text>`; });
  [LIM.low, LIM.high].forEach(v => { g += `<text class="in-gt" x="${L - 3}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${v}</text>`; });
  if (isToday) { const x = X(Date.now()).toFixed(1); g += `<line class="in-now" x1="${x}" x2="${x}" y1="${T}" y2="${T + ph}"/>`; }
  /* Linha: UM traçado contínuo por trecho (junções arredondadas), na ordem das medições. Trecho com intervalo > 6 h vira outro traçado, tracejado.
     Os traçados vêm ANTES dos pontos e são mais finos que eles, mas com os pontos menores a linha aparece também entre medições muito próximas. */
  const XY = it => X(it.r.ts).toFixed(1) + ' ' + Y(it.r.glucose).toFixed(1); let run = [], runGap = false;
  const flush = () => { if (run.length > 1) g += `<path class="in-ln${runGap ? ' gap' : ''}" d="M${run.join(' L')}"/>`; run = []; };
  pts.forEach((it, i) => { const p = pts[i - 1]; if (!p || !it.joinPrev) { flush(); run = [XY(it)]; runGap = false; return; } if (!!it.longGap !== runGap) { const last = run[run.length - 1]; flush(); run = [last]; runGap = !!it.longGap; } run.push(XY(it)); });
  flush();
  pts.forEach(it => { g += `<circle class="in-pt p-${inBand(it.band)}" cx="${X(it.r.ts).toFixed(1)}" cy="${Y(it.r.glucose).toFixed(1)}" r="3.3"/>`; });
  return `<svg class="in-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Medições do dia ${D.iso}: ${D.n}, entre ${f0(D.min)} e ${f0(D.max)} mg/dL.">${g}</svg>`;
}
function inTlItem(it) {
  const r = it.r, gap = it.gapMin != null && it.gapMin >= 60 ? `<li class="in-gap${it.gapMin > 360 ? ' long' : ''}" aria-hidden="false"><span>${esc(gapFmt(it.gapMin))} sem medir</span></li>` : '';
  const dv = it.delta == null ? '<span class="tag first">1ª do dia</span>' : `<span class="tag ${it.delta > 0 ? 'up' : ''}">${it.delta > 0 ? '▲' : it.delta < 0 ? '▼' : '■'} ${stepFmt(it.delta)} mg/dL</span>`;
  return gap + `<li><button type="button" class="in-tli g-${it.band}" data-act="open" data-id="${r.id}"><span class="in-tl-t num">${r.noTime ? '—:—' : r.time}</span><i class="in-tl-d p-${inBand(it.band)}" aria-hidden="true"></i><span class="in-tl-b"><span class="chips">${dv}${recChips(r)}</span></span><span class="in-tl-v num">${fn(r.glucose, 1)}<small>${it.out === 'low' ? ' ▼' : it.out === 'high' ? ' ▲' : ''}</small></span></button></li>`;
}
function inDayCard(d, sz) {
  const iso = d.iso, D = inDay(S.records, iso, S.events), isToday = d.isToday;
  const nav = `<div class="day-nav">${isToday ? '' : '<button class="btn sm" data-act="day-today">Hoje</button>'}<button class="btn sm" data-act="day-prev" aria-label="Dia anterior">‹</button><button class="btn sm" data-act="day-next" aria-label="Próximo dia" ${isToday ? 'disabled' : ''}>›</button></div>`;
  let body;
  if (!D.n) {
    const prevRec = [...S.records].reverse().find(r => r.ts < mkTs(iso, '00:00'));
    body = `<p class="pn-sub">${isToday ? 'Nenhuma medição hoje.' : 'Nenhuma medição neste dia.'} ${prevRec ? `Última: ${fn(prevRec.glucose, 1)} mg/dL em ${fmtDate(prevRec.date).slice(0, 5)}.` : ''}</p>${isToday ? '<button type="button" class="btn sm pri" data-act="new">Nova medição</button>' : ''}`;
  } else {
    const seq = `<span class="in-seq" aria-hidden="true">${D.items.map(i => `<i class="p-${inBand(i.band)}"></i>`).join('')}</span>`;
    const facts = [`${D.n} medi${D.n === 1 ? 'ção' : 'ções'}`, `${D.inRange} na faixa`, D.out ? `${D.out} fora` : '', D.maxGapMin != null ? `maior intervalo ${gapFmt(D.maxGapMin)}` : '', D.n > 1 ? `amplitude ${f0(D.max - D.min)} mg/dL` : ''].filter(Boolean).join(' · ');
    const first = D.items.slice(0, sz === 'x' ? D.items.length : 4), more = D.items.slice(sz === 'x' ? D.items.length : 4);
    const ev = D.events.length ? `<p class="in-dev">${D.events.map(e => `<span class="tag">${esc(e.text)}</span>`).join('')}</p>` : '';
    body = `${seq}<p class="pn-sub in-facts">${esc(facts)}</p>${inDayChart(D, isToday)}${D.untimed ? `<p class="hint">${D.untimed} medição(ões) sem horário não aparecem no gráfico.</p>` : ''}<p class="in-leg"><span><i class="in-pt p-ok"></i>na faixa</span><span><i class="in-pt p-low"></i>baixa</span><span><i class="in-pt p-high"></i>alta</span><span class="dim">Pontos são medições reais; a linha liga as medições em sequência e fica tracejada quando o intervalo passa de 6 h (nada é estimado entre elas).</span></p>${ev}<ol class="in-tl">${first.map(inTlItem).join('')}</ol>${more.length ? `<details class="in-more"><summary>Ver todas as ${D.n} medições</summary><ol class="in-tl">${more.map(inTlItem).join('')}</ol></details>` : ''}`;
  }
  return `<section class="in-card in-day wide" aria-label="Evolução do dia"><div class="row sp in-card-h"><span class="pn-h">${pnIc('clock')}<span class="pn-t">Evolução · ${esc(pnDayLab(iso, isToday))}${isToday ? '' : ' ' + esc(fmtDate(iso).slice(0, 5))}</span></span>${nav}</div>${body}</section>`;
}

/* ---------- cartões novos: variabilidade (o card Exames saiu em 0.49.0: exames são Premium) ---------- */
function inVarCard(M) {
  const v = M.vari;
  if (!v) return pnCard('var', '', 'scale', 'Variabilidade', `<span class="pn-big num">—</span><span class="pn-sub">${M.sc.n ? 'Precisa de 5 medições no período' : 'Sem medições no período'}</span>`, 'Variabilidade: sem dados suficientes');
  const sc = inScale([M.sc.min, M.sc.max], LIM.low, LIM.high), a = sc.pos(LIM.low), b = sc.pos(LIM.high), x0 = sc.pos(M.sc.min), x1 = sc.pos(M.sc.max), mm = sc.pos(M.sc.mean);
  const cv = typeof mtAllowed === 'function' && mtAllowed() && v.cv != null ? ` · CV ${fn(v.cv, 0)}%` : '';
  return pnCard('var', 'wide', 'scale', 'Variabilidade', `<span class="pn-row"><span class="pn-big num">${f0(v.sd)}<small>mg/dL de desvio-padrão</small></span></span><span class="in-rng" aria-hidden="true"><i class="in-rng-ok" style="left:${a.toFixed(1)}%;width:${(b - a).toFixed(1)}%"></i><i class="in-rng-sp" style="left:${x0.toFixed(1)}%;width:${Math.max(1, x1 - x0).toFixed(1)}%"></i><i class="in-rng-m" style="left:${mm.toFixed(1)}%"></i></span><span class="pn-sub num">Menor ${f0(M.sc.min)} · média ${f0(M.sc.mean)} · maior ${f0(M.sc.max)} mg/dL${cv}</span>`, `Variabilidade: desvio-padrão de ${f0(v.sd)} mg/dL, amplitude de ${f0(v.amp)} mg/dL`);
}
/* barras de comparação (período atual x anterior) usadas no cartão Comparação */
function inCmpBars(a, b, per) {
  if (a == null || b == null) return '';
  const mx = Math.max(a, b, 1);
  return `<span class="in-cmpb" aria-hidden="true"><span><i style="width:${(a / mx * 100).toFixed(0)}%"></i><em class="num">${f0(a)}</em></span><span class="prev"><i style="width:${(b / mx * 100).toFixed(0)}%"></i><em class="num">${f0(b)}</em></span></span>`;
}
const inMiniBar = (n, tot, cls) => tot ? `<i class="in-bar ${cls || ''}" aria-hidden="true"><i style="width:${Math.max(n ? 3 : 0, n / tot * 100).toFixed(0)}%"></i></i>` : '';

/* ---------- Tamanhos dos cards (0.49.0) ----------
   Três estados por card: c recolhido · n normal (padrão) · x expandido. A escolha mora em `sz` das preferências (inicio-core.js).
   O conteúdo é adaptado, não só o contêiner: o recolhido esconde (por CSS, ver inicio.css) tudo que é secundário; o normal é o card de sempre;
   o expandido acrescenta linhas complementares calculadas com os MESMOS dados e fórmulas já usados nas janelas de detalhes (nada novo é calculado). */
const IN_SZ_LAB = { c: 'recolhido', n: 'normal', x: 'expandido' };
const inSzOf = k => inSize(inPrefs(), k);
function inSized(k, html, extra) {
  if (!html) return html;
  const sz = inSzOf(k);
  html = html.replace(/^(\s*<(?:button|section|div)\b)/, `$1 data-sz="${sz}"`);
  if (sz === 'x' && extra) { const i = html.lastIndexOf('</'); if (i > 0) html = html.slice(0, i) + extra + html.slice(i); }
  return html;
}
const inXr = rows => { rows = rows.filter(r => r && r[1] != null && r[1] !== ''); return rows.length ? `<span class="in-xr">${rows.map(([a, b]) => `<span class="in-xrr"><span class="dim">${a}</span><b class="num">${b}</b></span>`).join('')}</span>` : ''; };
/* Linhas complementares do tamanho expandido, por janela de detalhes (mesmos números de pmDetail em painel2.js). */
function inXRows(pm, d, M) {
  const { sc, sp, cmp, rc } = d, mm = v => (v == null ? '—' : fm(v) + ' mg/dL');
  switch (pm) {
    case 'med': return [['Média no período anterior', sp.n ? mm(sp.mean) : '—'], ['Diferença', cmp.diff != null ? fsign(cmp.diff) + ' mg/dL' : '—'], ['Medições no período', sc.n]];
    case 'cmp': return [['Média atual', sc.n ? mm(sc.mean) : '—'], ['Média anterior', sp.n ? mm(sp.mean) : '—'], ['Medições (atual · anterior)', sc.n + ' · ' + sp.n], ['Abaixo de 70 (atual · anterior)', sc.hypo + ' · ' + sp.hypo]];
    case 'min': case 'max': return [['Média no período', sc.n ? mm(sc.mean) : '—'], [pm === 'min' ? 'Maior' : 'Menor', sc.n ? f0(pm === 'min' ? sc.max : sc.min) + ' mg/dL' : '—'], ['Medições no período', sc.n]];
    case 'n': { const days = new Set(rc.map(x => x.date)).size; return [['Dias com medição', days], ['Período anterior', sp.n], ['Média por dia com medição', days ? fm(sc.n / days) : '—']]; }
    case 'hipo': case 'hiper': { const lo = pm === 'hipo', v = lo ? sc.hypo : sc.hyper; return [['Parte das medições', sc.n ? (v / sc.n * 100).toFixed(0) + '%' : '—'], ['Período anterior', lo ? sp.hypo : sp.hyper], ['Medições no período', sc.n]]; }
    case 'var': { const v = M.vari; return v ? [['Amplitude (maior − menor)', f0(v.amp) + ' mg/dL'], ['Menor · maior', f0(sc.min) + ' · ' + f0(sc.max) + ' mg/dL'], ['Média', mm(sc.mean)], ['Desvio-padrão no período anterior', v.prevSd != null ? f0(v.prevSd) + ' mg/dL' : '—']] : []; }
    case 'dist': { const bc = bandCounts(rc), n = rc.length; return BAND_LIST.filter(b => bc[b.k]).map(b => [b.name, `${bc[b.k]} · ${(bc[b.k] / n * 100).toFixed(0)}%`]); }
    case 'hba': { const e = est90(), lab = S.hba.filter(x => !isEx(x) && x.date).sort((a, b) => b.date.localeCompare(a.date))[0]; return [['Medições usadas (90 dias)', e.st.n], ['Dias com medição', e.days], lab ? ['HbA1c de laboratório', `${fn(lab.value, 1)}% · ${fmtDate(lab.date)}`] : null].filter(Boolean); }
    case 'per': return [['Medições no período', sc.n], ['Média', sc.n ? mm(sc.mean) : '—'], ['Menor · maior', sc.n ? f0(sc.min) + ' · ' + f0(sc.max) + ' mg/dL' : '—'], ['Período anterior', sp.n + ' medições']];
  }
  return [];
}

/* ---------- Encaixe automático (0.49.0) ----------
   CSS Grid de 12 colunas com posicionamento automático denso (já existente) + linhas de 4 px: cada card ocupa `span N` linhas, N medido a partir
   da sua altura real. Assim, ao recolher ou expandir um card, o grid recalcula a posição de todos e os vizinhos sobem para ocupar o espaço livre,
   sem lacunas verticais. Só é ligado quando há card recolhido/expandido: com tudo em Normal o visual continua exatamente o de antes (linhas de altura igual). */
const IN_ROW = 4;
let inFitSig = '', inFitRaf = 0, inFitGrid = null, inFitRO = null;
function inFitDo(grid) {
  const kids = [...grid.children], gap = grid.classList.contains('editing') ? 28 : 10;
  const sig = grid.offsetWidth + '|' + kids.map(c => c.offsetHeight + (c.dataset.sz || '')).join(',');
  if (sig === inFitSig && grid.classList.contains('in-fit')) return;
  kids.forEach(c => { if (c.classList.contains('dragging')) return; c.style.gridRowEnd = 'span ' + Math.max(1, Math.ceil((c.offsetHeight + gap) / IN_ROW)); });
  inFitSig = grid.offsetWidth + '|' + kids.map(c => c.offsetHeight + (c.dataset.sz || '')).join(',');
}
function inFit() {
  const grid = document.querySelector('.pn-grid'); if (!grid) return;
  const on = !!grid.querySelector('[data-sz="c"], [data-sz="x"]');
  grid.classList.toggle('in-fit', on);
  if (!on) { [...grid.children].forEach(c => { c.style.gridRowEnd = ''; }); inFitSig = ''; return; }
  inFitSig = ''; inFitDo(grid);
  if (inFitGrid !== grid) {     /* acompanha mudanças de largura/orientação, conteúdo que cresce e cards que entram/saem (arraste) */
    inFitGrid = grid;
    const again = () => { if (inFitRaf) return; inFitRaf = requestAnimationFrame(() => { inFitRaf = 0; if (grid.isConnected && grid.classList.contains('in-fit')) inFitDo(grid); }); };
    try { if (inFitRO) inFitRO.disconnect(); inFitRO = typeof ResizeObserver === 'function' ? new ResizeObserver(again) : null; if (inFitRO) { inFitRO.observe(grid); [...grid.children].forEach(c => inFitRO.observe(c)); } new MutationObserver(m => { if (inFitRO) [...grid.children].forEach(c => inFitRO.observe(c)); again(); }).observe(grid, { childList: true }); } catch (e) { }
  } else if (inFitRO) [...grid.children].forEach(c => inFitRO.observe(c));
}
window.addEventListener('resize', () => { try { const g = document.querySelector('.pn-grid.in-fit'); if (g) { inFitSig = ''; inFitDo(g); } } catch (e) { } });

/* ---------- 6. Personalização direto no Início ----------
   Estado de edição só em memória (S.inEdit); ordem e ocultos vão para 'tb-inicio' (mesmo mecanismo de antes, com cópia durável em persist.js).
   Resumo glicêmico e Central de Métricas são estruturais (IN_FIXED): nunca entram na lista, nunca têm alça nem ocultação. */
const inEditing = () => !!S.inEdit && gxhPers() && S.route === 'painel' && typeof pnlMode !== 'undefined' && pnlMode !== 'classic';
const inSpan = html => /class="[^"]*\b(wide|in-card)\b/.test(html) ? 'wide' : /class="[^"]*\bmini\b/.test(html) ? 'mini' : /class="[^"]*\bin-ind\b/.test(html) ? 'ind' : '';
const inCardT = k => (IN_CARDS.find(c => c.k === k) || {}).t || k;
/* Botão discreto "Personalizar", na linha do título "Início". */
function inTopBtn() {
  if (!gxhPers()) return gxhLockNote();   /* Modo Padrão: sem botão de personalizar (o Experience é escolhido em Aparência) */
  return `<div class="in-top"><button type="button" class="in-pbtn" data-act="in-cust" aria-label="Personalizar a tela inicial">${pnIc('sliders')}<span>Personalizar</span></button></div>${gxhLockNote()}`;
}
/* Barra do modo de edição (fixa ao rolar) + painel recolhível "Cards disponíveis" (inclui os indicadores do painel ocultos). */
function inEditBar(msg) {
  const p = inPrefs(), av = inHiddenCards(p), avOpen = !!S.inAvOpen;
  const items = av.length ? av.map(c => `<li class="in-av-i"><span class="in-av-t"><b>${esc(c.t)}</b><small>${esc(c.d || '')}</small></span><button type="button" class="btn sm in-av-add" data-act="in-add" data-k="${c.k}" aria-label="Adicionar ${esc(c.t)} à tela inicial">${pnIc('plus')}<span>Adicionar à tela inicial</span></button></li>`).join('') : '';
  const body = av.length ? `<ul class="in-av-l">${items}</ul>` : '<p class="in-av-none">Nenhum card oculto. Todos os cards estão na tela inicial.</p>';
  const pan = (id, open, act, title, cnt, inner) => `<section class="in-ed-p${open ? ' open' : ''}"><button type="button" class="in-ed-ph" data-act="${act}" aria-expanded="${open}" aria-controls="${id}"><span class="in-ed-pt">${title}</span>${cnt}<span class="ds-chev" aria-hidden="true"></span></button><div class="in-ed-pb" id="${id}"${open ? '' : ' inert'}><div class="in-ed-pin">${inner}</div></div></section>`;
  return `<div class="in-edit" role="region" aria-label="Personalização da tela inicial">
    <div class="in-ed-bar"><div class="in-ed-ti"><b>Personalizar</b><small>Arraste pela alça para mover · ✕ oculta · os ícones da base mudam o tamanho.</small></div>
      <button type="button" class="btn sm in-ed-rs" data-act="in-reset"${inIsDefault(p) ? ' disabled' : ''}>Restaurar padrão</button><button type="button" class="btn sm pri in-ed-ok" data-act="in-done">Concluir</button></div>
    ${pan('in-av-b', avOpen, 'in-avt', 'Cards disponíveis', `<span class="in-count num" aria-label="${av.length} ocultos">${av.length}</span>`, body)}
    <p class="in-sr" id="in-live" role="status" aria-live="polite"></p></div>`;
}
const inFixRow = pos => `<div class="in-fixrow" aria-hidden="true">${pnIc('lock')}<span>${pos === 'top' ? 'Resumo glicêmico · fixo no topo' : 'Central de Métricas · fixa no final'}</span></div>`;
/* Em edição cada cartão ganha uma moldura sem mudar o cartão: alça de arraste e botão de ocultar sobre a borda superior; tamanho em faixa própria abaixo dele. */
const IN_SZ_IC = { c: '<rect x="8" y="10" width="8" height="4" rx="1.5"/>', n: '<rect x="6" y="8" width="12" height="8" rx="2"/>', x: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/>' };
function inSizeCtl(k, t, sz) {
  return `<div class="in-sz" role="group" aria-label="Tamanho de ${t}">${['c', 'n', 'x'].map(s => `<button type="button" data-act="in-size" data-k="${k}" data-s="${s}" aria-pressed="${sz === s}" aria-label="${IN_SZ_LAB[s][0].toUpperCase() + IN_SZ_LAB[s].slice(1)}: ${t}" title="${IN_SZ_LAB[s][0].toUpperCase() + IN_SZ_LAB[s].slice(1)}"><svg viewBox="0 0 24 24" aria-hidden="true">${IN_SZ_IC[s]}</svg></button>`).join('')}</div>`;
}
function inEditCard(k, html) {
  const t = esc(inCardT(k)), sz = inSzOf(k), pc = /^\s*<[a-z]+ [^>]*class="[^"]*\bpn-c\b/.test(html);
  /* Atalhos e Acontecimentos só aparecem na tela quando há algo a mostrar; na edição ficam com um espaço reservado, para poderem ser movidos ou ocultados mesmo vazios. */
  if (!html) html = `<section class="in-card in-ghost wide" aria-label="${t}"><span class="pn-h">${pnIc(k === 'atalhos' ? 'list' : 'star')}<span class="pn-t">${t}</span></span><p class="pn-sub">Nada a mostrar agora. Este card aparece aqui quando houver conteúdo.</p></section>`;
  if (!/^\s*<[a-z]+ [^>]*data-sz=/.test(html)) html = html.replace(/^(\s*<[a-z]+)/, `$1 data-sz="${sz}"`);
  return `<div class="pn-ed ${inSpan(html)}${pc ? ' is-pc' : ''}" data-ed="${k}" data-sz="${sz}"><div class="pn-ed-in" inert aria-hidden="true">${html}</div>
    ${inSizeCtl(k, t, sz)}
    <button type="button" class="in-grip" data-grip="${k}" aria-label="Mover ${t}. Arraste, ou use as setas para cima e para baixo." title="Arrastar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h.01M12 7h.01M16 7h.01M8 12h.01M12 12h.01M16 12h.01"/></svg></button>
    <button type="button" class="in-hide" data-act="in-hide" data-k="${k}" aria-label="Ocultar ${t}">${pnIc('x')}</button></div>`;
}
/* Redesenha mantendo a rolagem; FLIP suave nos cartões que mudaram de lugar. */
function inFlipRects() { const m = {}; document.querySelectorAll('.pn-ed[data-ed]').forEach(e => { m[e.dataset.ed] = e.getBoundingClientRect(); }); return m; }
function inFlipPlay(before) {
  if (!before || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  document.querySelectorAll('.pn-ed[data-ed]').forEach(e => {
    const b = before[e.dataset.ed], a = e.getBoundingClientRect(); if (!b) return;
    const k = inScaleK(e), dx = (b.left - a.left) / k, dy = (b.top - a.top) / k; if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    e.style.transition = 'none'; e.style.transform = `translate(${dx}px,${dy}px)`; e.getBoundingClientRect();
    e.style.transition = 'transform .22s cubic-bezier(.2,.7,.2,1)'; e.style.transform = '';
    setTimeout(() => { e.style.transition = ''; }, 260);
  });
}
/* Fator entre pixels da tela e pixels do elemento (o app usa zoom no <html>): medido de verdade, não presumido. */
function inScaleK(el) { const w = el.offsetWidth; const k = w ? el.getBoundingClientRect().width / w : 1; return k > 0.05 ? k : 1; }
function inRedraw(msg, keepFlip) {
  const y = window.scrollY, before = keepFlip ? inFlipRects() : null;
  inMemo = { key: '', m: null }; render(); window.scrollTo(0, y);
  if (msg != null) { const m = document.getElementById('in-live'); if (m) m.textContent = msg; }
  inFlipPlay(before);
}
function inApply(p, msg, live) { inPrefsSave(p); inRedraw(live, true); }
function inEditOn(on) {
  if (on && !gxhPers()) { S.inEdit = false; gxhLockSheet(); return; }
  S.inEdit = !!on; inRedraw(null, false);
  if (on) { const t = document.querySelector('.top'); document.documentElement.style.setProperty('--in-top', (t ? t.offsetHeight : 56) + 'px'); const b = document.querySelector('.in-ed-ok'); if (b) b.focus({ preventScroll: true }); }
  else { const b = document.querySelector('.in-pbtn'); if (b) b.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}
/* Em edição, tocar num cartão não abre os detalhes (o conteúdo está inerte, mas o clique na borda também é barrado). */
document.addEventListener('click', e => { if (inEditing() && e.target.closest && e.target.closest('.pn-ed') && !e.target.closest('[data-act^="in-"]')) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);

/* Sair da tela Início encerra o modo de edição (as alterações já estão salvas). */
document.addEventListener('click', e => { if (S.inEdit && e.target.closest && e.target.closest('[data-act="go"], .nav-in button:not(.fab)')) S.inEdit = false; }, true);
window.addEventListener('hashchange', () => { if (S.inEdit && S.route !== 'painel') S.inEdit = false; });

/* ---------- arrastar e soltar (mouse, caneta e toque) ---------- */
const inDrag = { on: false };
document.addEventListener('pointerdown', e => {
  const g = e.target.closest && e.target.closest('.in-grip'); if (!g || !inEditing() || inDrag.on || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const grid = g.closest('.pn-grid'), card = g.closest('.pn-ed'); if (!grid || !card) return;
  e.preventDefault();
  const k = inScaleK(grid), rect = card.getBoundingClientRect(), gr = grid.getBoundingClientRect();
  const ph = document.createElement('div'); ph.className = 'pn-ph ' + (card.classList.contains('wide') ? 'wide' : card.classList.contains('mini') ? 'mini' : card.classList.contains('ind') ? 'ind' : '');
  ph.style.height = card.offsetHeight + 'px'; ph.dataset.sz = card.dataset.sz || 'n'; if (card.classList.contains('is-pc')) ph.classList.add('is-pc'); ph.style.gridRowEnd = card.style.gridRowEnd; card.after(ph);
  const D = Object.assign(inDrag, { on: true, id: e.pointerId, card, grid, ph, k, gx: e.clientX - rect.left, gy: e.clientY - rect.top, px: e.clientX, py: e.clientY, raf: 0, key: card.dataset.ed, grip: g, w: card.offsetWidth, h: card.offsetHeight });
  card.classList.add('dragging'); card.style.width = D.w + 'px'; card.style.height = D.h + 'px'; grid.classList.add('is-dragging'); document.documentElement.classList.add('in-noselect');
  try { g.setPointerCapture(e.pointerId); } catch (err) { }
  inDragPlace(); D.raf = requestAnimationFrame(inDragTick);
});
function inDragPlace() {
  const D = inDrag, gr = D.grid.getBoundingClientRect();
  D.card.style.left = ((D.px - D.gx - gr.left) / D.k) + 'px'; D.card.style.top = ((D.py - D.gy - gr.top) / D.k) + 'px';
}
/* posição do ponteiro em coordenadas de layout da grade (independe de transformações em andamento) */
function inDragTarget() {
  const D = inDrag, gr = D.grid.getBoundingClientRect(), x = (D.px - gr.left) / D.k, y = (D.py - gr.top) / D.k;
  const sibs = [...D.grid.children].filter(c => c !== D.card && c !== D.ph);
  const inside = r => x >= r.l && x <= r.l + r.w && y >= r.t && y <= r.t + r.h, box = c => ({ l: c.offsetLeft, t: c.offsetTop, w: c.offsetWidth, h: c.offsetHeight });
  if (inside(box(D.ph))) return null;
  let best = null, bd = 1e9;
  for (const c of sibs) { const r = box(c), cx = r.l + r.w / 2, cy = r.t + r.h / 2, d = inside(r) ? -1 : Math.hypot(x - cx, (y - cy) * 1.6); if (d < bd) { bd = d; best = { c, r }; } }
  if (!best) return null;
  const { c, r } = best, dx = (x - (r.l + r.w / 2)) / r.w, dy = (y - (r.t + r.h / 2)) / r.h, wide = r.w > D.grid.offsetWidth * .9;
  const after = wide || Math.abs(dy) * 1.2 >= Math.abs(dx) ? dy > 0 : dx > 0;
  return { c, after };
}
function inDragTick() {
  const D = inDrag; if (!D.on) return;
  if (!D.grid.isConnected) return inDragEnd(true);
  /* rolagem automática perto das bordas da área visível (abaixo do cabeçalho/barra, acima da navegação) */
  const vh = window.innerHeight, top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--in-top')) || 56) * (D.k) + 70, bot = vh - 110, edge = 56;
  let sp = 0; if (D.py < top + edge * .4) sp = -Math.min(28, (top + edge * .4 - D.py) / 3 + 6); else if (D.py > bot - edge * .4) sp = Math.min(28, (D.py - (bot - edge * .4)) / 3 + 6);
  if (sp) { const y0 = window.scrollY; window.scrollBy(0, sp); if (window.scrollY === y0) sp = 0; }
  inDragPlace();
  const t = inDragTarget();
  if (t) {
    const ref = t.after ? t.c.nextSibling : t.c;
    if (ref !== D.ph && !(t.after && t.c.nextSibling === D.ph) && !(!t.after && t.c.previousSibling === D.ph)) {
      const before = new Map([...D.grid.children].filter(c => c !== D.card && c !== D.ph).map(c => [c, c.getBoundingClientRect()]));
      D.grid.insertBefore(D.ph, ref);
      if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) before.forEach((b, c) => {
        const a = c.getBoundingClientRect(), dx = (b.left - a.left) / D.k, dy = (b.top - a.top) / D.k; if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        c.style.transition = 'none'; c.style.transform = `translate(${dx}px,${dy}px)`; c.getBoundingClientRect(); c.style.transition = 'transform .2s cubic-bezier(.2,.7,.2,1)'; c.style.transform = '';
      });
    }
  }
  D.raf = requestAnimationFrame(inDragTick);
}
document.addEventListener('pointermove', e => { const D = inDrag; if (D.on && e.pointerId === D.id) { D.px = e.clientX; D.py = e.clientY; e.preventDefault(); } }, { passive: false });
function inDragEnd(cancel) {
  const D = inDrag; if (!D.on) return; cancelAnimationFrame(D.raf); D.on = false;
  document.documentElement.classList.remove('in-noselect');
  if (D.grid.isConnected) {
    D.grid.classList.remove('is-dragging');
    if (!cancel) {
      D.ph.replaceWith(D.card);
    } else D.ph.remove();
    D.card.classList.remove('dragging'); D.card.style.width = D.card.style.height = D.card.style.left = D.card.style.top = '';
    D.grid.querySelectorAll('.pn-ed').forEach(c => { c.style.transition = ''; c.style.transform = ''; });
    if (!cancel) {
      const keys = [...D.grid.querySelectorAll('.pn-ed')].map(c => c.dataset.ed), p0 = inPrefs(), p1 = inReorder(p0, keys);
      if (JSON.stringify(p1.order) !== JSON.stringify(p0.order)) {
        inPrefsSave(p1); inMemo = { key: '', m: null };
        const pos = keys.indexOf(D.key) + 1, m = document.getElementById('in-live'); if (m) m.textContent = `${inCardT(D.key)} movido para a posição ${pos} de ${keys.length}.`;
      }
      try { D.grip.focus({ preventScroll: true }); } catch (err) { }
    }
  }
}
document.addEventListener('pointerup', e => { if (inDrag.on && e.pointerId === inDrag.id) inDragEnd(false); });
document.addEventListener('pointercancel', e => { if (inDrag.on && e.pointerId === inDrag.id) inDragEnd(true); });
document.addEventListener('contextmenu', e => { if (inDrag.on || (e.target.closest && e.target.closest('.in-grip'))) e.preventDefault(); });
/* Teclado/leitor de tela: setas na alça movem o cartão; Esc cancela um arraste. */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && inDrag.on) { inDragEnd(true); return; }
  const g = e.target.closest && e.target.closest('.in-grip'); if (!g || !inEditing()) return;
  const d = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : 0; if (!d) return;
  e.preventDefault(); const k = g.dataset.grip, p0 = inPrefs(), p1 = inMoveVisible(p0, k, d); if (JSON.stringify(p1.order) === JSON.stringify(p0.order)) return;
  const vis = inVisible(p1);
  inApply(p1, '', `${inCardT(k)} movido para a posição ${vis.indexOf(k) + 1} de ${vis.length}.`);
  const ng = document.querySelector(`.in-grip[data-grip="${k}"]`); if (ng) ng.focus({ preventScroll: true });
});
document.addEventListener('click', e => {
  const el = e.target.closest && e.target.closest('[data-act^="in-"]'); if (!el) return;
  const a = el.dataset.act, k = el.dataset.k;
  if (a === 'in-cust') inEditOn(true);
  else if (a === 'in-done') { inEditOn(false); }
  else if (a === 'in-rs') inRsToggle(el);
  else if (a === 'in-hide') { const n = inCardT(k); inApply(inHide(inPrefs(), k), '', `${n} ocultado. Está em Cards disponíveis.`); }
  else if (a === 'in-add') { const n = inCardT(k); inApply(inShow(inPrefs(), k), '', `${n} adicionado ao fim da tela inicial.`); }
  else if (a === 'in-size') {
    const sz = el.dataset.s, n = inCardT(k); if (sz === inSzOf(k)) return;
    inApply(inSetSize(inPrefs(), k, sz), '', `${n}: tamanho ${IN_SZ_LAB[sz]}.`);
    const c = document.querySelector(`.pn-ed[data-ed="${k}"]`); if (c && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) c.classList.add('sz-pop');
    const b = document.querySelector(`.in-sz [data-k="${k}"][data-s="${sz}"]`); if (b) b.focus({ preventScroll: true });
  }
  else if (a === 'in-avt') { S.inAvOpen = !S.inAvOpen; inPanelToggle(el, S.inAvOpen); }
  else if (a === 'in-reset') openSheet('<h2>Restaurar padrão?</h2><p style="margin:0 0 14px">A sua organização personalizada será substituída pela configuração original do GLUXO: ordem padrão, tamanho normal em todos os cards e todos os cards visíveis de novo. Nenhum registro, dado glicêmico ou histórico é apagado.</p><div class="row"><button type="button" class="btn pri grow" data-act="in-reset-ok" autofocus>Restaurar padrão</button><button type="button" class="btn" data-act="close">Cancelar</button></div>');
  else if (a === 'in-reset-ok') { closeSheet(); inApply(IN_DEF(), 'Organização padrão restaurada.', 'Organização padrão restaurada.'); }
  else if (a === 'in-ev') {
    const t = el.dataset.t, id = el.dataset.id;
    if (t === 'open' && id) openRecord(id);
    else if (t === 'pm' && id) { S.pm = id; pmDraw(); }
    else if (t === 'exam' && id) { S.ex.id = id; go('exame'); }
    else if (t === 'go' && id) go(id);
  }
  else if (a === 'in-hist') { const d = el.dataset.d, t = el.dataset.t; go('historico'); setTimeout(() => { try { histScrollTo(d, t, true); } catch (err) { } }, 80); }
  else if (a === 'in-rem') {
    const b = document.querySelector('#view [data-act="ir-confirm"], #view [data-act="pl-done"]'), bn = b && b.closest('.banner');
    if (bn) { const red = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; bn.scrollIntoView({ block: 'center', behavior: red ? 'auto' : 'smooth' }); bn.classList.add('in-flash'); setTimeout(() => bn.classList.remove('in-flash'), 1800); try { b.focus({ preventScroll: true }); } catch (err) { } }
    else if (typeof acOpen === 'function') { try { acOpen(); } catch (err) { } }
    else go('lembretes');
  }
});


/* ---------- Resumo glicêmico: expandir/recolher (sem navegar, sem redesenhar a tela) ---------- */
function inPanelToggle(btn, open) {
  const sec = btn.closest('.in-ed-p'), b = sec && sec.querySelector('.in-ed-pb'); if (!sec) return;
  sec.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); if (b) { if (open) b.removeAttribute('inert'); else b.setAttribute('inert', ''); }
}
function inRsToggle(el) {
  const sec = el.closest('.in-hero'); if (!sec || !sec.classList.contains('can-open')) return;
  const open = !sec.classList.contains('open'), tg = sec.querySelector('.in-rs-tg'), x = sec.querySelector('.in-rs-xin');
  sec.classList.toggle('open', open); S.rsOpen = open;
  if (tg) { tg.setAttribute('aria-expanded', String(open)); tg.setAttribute('aria-label', `Resumo glicêmico, ${open ? 'expandido' : 'recolhido'}. ${open ? 'Toque para recolher' : 'Toque para ver todos os registros de hoje'}.`); }
  if (x) { if (open) x.removeAttribute('inert'); else x.setAttribute('inert', ''); }
  if (!open && el !== tg) { /* "Recolher" no fim da lista: devolve o foco ao título e mantém o cartão à vista */
    if (tg) { try { tg.focus({ preventScroll: true }); } catch (e) { } }
    const r = sec.getBoundingClientRect(); if (r.top < 0) { const red = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; sec.scrollIntoView({ block: 'start', behavior: red ? 'auto' : 'smooth' }); }
  }
}
/* "há X min" acompanha o relógio sem redesenhar a tela; na virada do dia (data local) o cartão passa a mostrar o novo dia. */
setInterval(() => {
  try {
    if (typeof S === 'undefined' || S.route !== 'painel') return;
    document.querySelectorAll('.in-hero .in-ago[data-ts]').forEach(e => { const t = relTime(+e.dataset.ts); if (e.textContent !== t) e.textContent = t; });
    const h = document.querySelector('.in-hero[data-day]');
    if (h && h.dataset.day !== inRsIso() && !document.getElementById('sheet-bg') && !S.pm) render();
  } catch (e) { }
}, 30000);
