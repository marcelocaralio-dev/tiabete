/* ================= Início: interface =================
   Centro de acompanhamento. A lógica (sem DOM) está em inicio-core.js; aqui só há montagem de HTML e eventos.
   Estrutura da tela (de cima para baixo):
   1. avisos e lembretes (banners existentes, intactos)
   2. Situação geral (essencial): Resumo glicêmico (última glicemia + barra de faixa + média do dia), resumo em texto, indicadores prioritários, período
   3. Atalhos contextuais (discretos; nunca registram nada sozinhos)
   4. Acontecimentos importantes (só aparece quando há algo relevante)
   5. Cartões personalizáveis (ordem e visibilidade escolhidas pela pessoa)
   6. Central de Métricas (bloco existente, adicionado por viewPainel) */
const IN_LS = 'tb-inicio';
let inPrefsRaw, inPrefsCache = null, inMemo = { key: '', m: null };
function inPrefs() {
  let raw = null; try { raw = localStorage.getItem(IN_LS); } catch (e) { }
  if (inPrefsCache === null || raw !== inPrefsRaw) { inPrefsRaw = raw; inPrefsCache = inParsePrefs(raw); }
  return inPrefsCache;
}
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
  flat: '<path d="M4 12h16M16 8l4 4-4 4"/>'
});
const IN_EVI = { hipo: 'warn', media: 'trend', var: 'scale', exame: 'flask', hba: 'hb', recorde: 'star', padrao: 'pie' };
const inTone = t => t === 'bad' ? ' st-bad' : t === 'warn' ? ' st-warn' : t === 'ok' ? ' st-ok' : '';
const inBand = k => k === 'ok' ? 'ok' : (k === 'low' || k === 'vlow') ? 'low' : 'high';

/* ---------- 2. Situação geral ---------- */
/* Barra de faixa glicêmica: mesmas faixas, cores e escala (30–600) do glicosímetro (GZ, GZ_ZONES, gzFrac em charts.js).
   `pv` = {f, v, st} da última barra desenhada: a animação do marcador (e da cor) parte dali. */
let inRsMem = null;
function inRangeBar(g, anim, pv) {
  const C = GZ.ult, hi = g > 600, st = gzState(g), act = hi ? 'xhigh' : st, f = hi ? 1 : gzFrac('ult', g), p0 = pv || { f: 0, st };
  inRsMem = { f, v: g, st };
  const pc = x => (x * 100).toFixed(2);
  const segs = GZ_ZONES.map(z => {
    const a = Math.max(z.from, C.min), b = Math.min(z.to, C.max); if (b <= a) return '';
    return `<i class="in-rb-z${z.k === act ? ' on' : ''}${z.dash ? ' dash' : ''}" style="left:${pc(gzFrac('ult', a))}%;width:${pc(gzFrac('ult', b) - gzFrac('ult', a))}%;--zc:${z.c}"></i>`;
  }).join('');
  const ticks = C.ticks.filter(t => t > C.min && t < C.max).map(t => `<span style="left:${pc(gzFrac('ult', t))}%">${t}</span>`).join('');
  return `<span class="in-rb s-${st}${anim ? ' in-rb-anim' : ''}" style="--p:${pc(f)}%;--pf:${pc(p0.f)}%;--gc:${GZ_COL[st]};--gc0:${GZ_COL[p0.st]}" aria-hidden="true"><span class="in-rb-bar">${segs}<i class="in-rb-mk"></i></span><span class="in-rb-t">${ticks}</span></span>`;
}
/* Resumo glicêmico: glicemia mais recente em destaque (abre os detalhes), barra de faixa e, em segundo plano, a média do dia selecionado. */
function inResumo(M, d) {
  const last = M.last, bnd = M.lastBand, g = last.glucose, hi = g > 600;
  const gKey = last.id + '|' + g, gAnim = S.gaugeKey !== gKey; S.gaugeKey = gKey;
  const pv = inRsMem, bar = inRangeBar(g, gAnim, pv), from = pv ? pv.v : GZ.ult.min;
  const dl = pnDayLab(d.iso, d.isToday), dayTxt = dl.indexOf('/') >= 0 ? dl : dl + ' · ' + fmtDate(d.iso).slice(0, 5);
  const ctx = last.context && CONTEXTS[last.context] ? `<span class="tag">${esc(CONTEXTS[last.context])}</span>` : '';
  const sd = d.sd, has = d.rs.length > 0, dTone = has && bandOf(sd.mean).k === 'ok' ? ' st-ok' : has ? ' st-bad' : '';
  const when = `${last.noTime ? '' : last.time + ' · '}${fmtDate(last.date).slice(0, 5)} · ${relTime(last.ts)}`;
  const avg = has
    ? `<button type="button" class="in-rs-m${dTone}" data-pm="dia" aria-haspopup="dialog" aria-label="Média do dia: ${fn(sd.mean, 1)} mg/dL, ${bandOf(sd.mean).txt}, ${sd.n} medi${sd.n === 1 ? 'ção' : 'ções'}. Toque para ver os detalhes."><span class="in-rs-c"><span class="in-rs-k">Média do dia</span><span class="in-rs-mv num"><b>${fn(sd.mean, 1)}</b><small>mg/dL</small></span>${badge(sd.mean)}</span><span class="in-rs-c"><span class="in-rs-k">Medições</span><span class="in-rs-mv num"><b>${sd.n}</b></span><span class="in-rs-s">usadas na média</span></span></button>`
    : `<button type="button" class="in-rs-m" data-pm="dia" aria-haspopup="dialog" aria-label="Média do dia: sem medições. Toque para ver os detalhes."><span class="in-rs-c"><span class="in-rs-k">Média do dia</span><span class="in-rs-mv num"><b>—</b></span><span class="in-rs-s">${d.isToday ? 'Nenhuma medição hoje' : 'Nenhuma medição neste dia'}</span></span></button>`;
  return `<header class="in-rs-h"><h2 class="in-rs-t">Resumo glicêmico</h2><span class="in-rs-d num">${esc(dayTxt)}</span></header>
    <button type="button" class="in-last${gAnim ? ' in-rs-anim' : ''}" data-pm="ult" aria-haspopup="dialog" aria-label="Glicemia mais recente: ${hi ? 'HI, acima de 600' : fn(g, 1)} mg/dL, ${bnd.txt}, ${esc(when)}. Escala de ${GZ.ult.min} a ${GZ.ult.max} mg/dL. Toque para ver os detalhes.">
      <span class="in-last-top"><span class="in-last-v num"><span class="in-rs-num" data-to="${hi ? '' : g}" data-from="${from}">${hi ? 'HI' : fn(g, 1)}</span><small>${hi ? 'acima de 600 mg/dL' : 'mg/dL'}</small></span>${badge(g, last.context, true)}</span>
      <span class="in-when num">${when}${ctx}</span>${bar}
    </button>${avg}`;
}
function inHero(M, d) {
  const last = M.last, bnd = M.lastBand, oor = last.glucose < LIM.low || last.glucose > LIM.high;
  const pri = inPrefs().pri.map(k => inIndicator(k, M));
  const chip = x => {
    const bar = x.k === 'faixa' && x.pct != null ? `<i class="in-bar" aria-hidden="true"><i style="width:${Math.max(2, Math.min(100, x.pct)).toFixed(0)}%"></i></i>` : '';
    const arrow = x.k === 'tend' ? `<span class="in-arr dir-${x.dir || 'none'}" aria-hidden="true">${x.v}</span>` : `<b class="num in-ind-v">${x.v}</b>`;
    return `<button type="button" class="in-ind${inTone(x.tone)}" data-pm="${x.pm}" aria-haspopup="dialog" aria-label="${esc(x.t)}: ${esc(x.v + ' ' + x.u)}, ${esc(x.sub)}. Toque para ver os detalhes."><span class="in-ind-t">${esc(x.t)}</span><span class="in-ind-row">${arrow}<small class="in-ind-u">${esc(x.u)}</small></span>${bar}<span class="in-ind-s">${esc(x.sub)}</span></button>`;
  };
  const stale = M.stale ? `<div class="in-stale" role="status"><span>Sem medições há ${Math.round(M.ageMs / 86400e3)} dias.</span><button type="button" class="btn sm" data-act="new">Nova medição</button></div>` : '';
  return `<section class="in-hero b-${bnd.k}${oor ? ' oor' : ''}" aria-label="Situação geral">
    ${inResumo(M, d)}
    ${stale}<p class="in-sum">${esc(M.summary)}</p>
    <div class="in-inds" style="--n:${pri.length}">${pri.map(chip).join('')}</div>
    <div class="in-per"><div class="seg" role="group" aria-label="Período">${[7, 30, 90].map(p => `<button data-act="period" data-p="${p}" aria-pressed="${S.period === p}">${p} dias</button>`).join('')}</div><span class="eyebrow num">${fmtDM(M.cur[0])} – ${fmtDM(M.cur[1])}</span></div>
  </section>`;
}

/* ---------- 3. Atalhos contextuais ---------- */
function inShortcutsHTML() {
  let remWin = null, planN = 0, irN = 0;
  try { remWin = alCfg().bMiss ? remPending() : null; } catch (e) { }
  try { planN = plPending().length; } catch (e) { }
  try { irN = irDue(S.ir, S.plan, Date.now()).length; } catch (e) { }
  const list = inShortcuts({ records: S.records, exams: S.exams, now: Date.now(), remWin, planN, irN });
  if (!list.length) return '';
  return `<div class="in-sc" role="group" aria-label="Atalhos">${list.map(x => `<button type="button" class="in-chip" data-act="${x.act}"${x.id ? ` data-id="${esc(x.id)}"` : ''}${x.d ? ` data-d="${esc(x.d)}" data-t="${esc(x.t || '')}"` : ''}${x.ctx ? ` data-ctx="${esc(x.ctx)}"` : ''}${x.meal ? ` data-meal="${esc(x.meal)}"` : ''}>${pnIc(x.icon)}<span><b>${esc(x.label)}</b><small>${esc(x.sub)}</small></span></button>`).join('')}</div>`;
}

/* ---------- 4. Acontecimentos importantes ---------- */
function inEventItem(e) {
  const a = e.act || {};
  return `<li><button type="button" class="in-evi${inTone(e.tone)}" data-act="in-ev" data-t="${esc(a.type || '')}" data-id="${esc(a.id || '')}"><span class="in-evi-ic">${pnIc(IN_EVI[e.kind] || 'bars')}</span><span class="in-evi-b"><b>${esc(e.title)}</b><span>${esc(e.text)}</span></span><span class="in-evi-go" aria-hidden="true">›</span></button></li>`;
}
function inEventsCard(M) {
  const ev = M.events || []; if (!ev.length) return '';
  const top = ev.slice(0, IN_EV_MAX), rest = ev.slice(IN_EV_MAX);
  return `<section class="in-ev" aria-labelledby="in-ev-h"><div class="in-ev-hd"><h2 id="in-ev-h">Acontecimentos importantes</h2><span class="in-count num" aria-label="${ev.length} acontecimentos">${ev.length}</span></div><ul class="in-evl">${top.map(inEventItem).join('')}</ul>${rest.length ? `<details class="in-more"><summary>Ver mais ${rest.length}</summary><ul class="in-evl">${rest.map(inEventItem).join('')}</ul></details>` : ''}</section>`;
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
  pts.forEach((it, i) => { const p = pts[i - 1]; if (p && it.joinPrev) g += `<line class="in-ln" x1="${X(p.r.ts).toFixed(1)}" y1="${Y(p.r.glucose).toFixed(1)}" x2="${X(it.r.ts).toFixed(1)}" y2="${Y(it.r.glucose).toFixed(1)}"/>`; });
  pts.forEach(it => { g += `<circle class="in-pt p-${inBand(it.band)}" cx="${X(it.r.ts).toFixed(1)}" cy="${Y(it.r.glucose).toFixed(1)}" r="4.2"/>`; });
  return `<svg class="in-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Medições do dia ${D.iso}: ${D.n}, entre ${f0(D.min)} e ${f0(D.max)} mg/dL.">${g}</svg>`;
}
function inTlItem(it) {
  const r = it.r, gap = it.gapMin != null && it.gapMin >= 60 ? `<li class="in-gap${it.gapMin > 360 ? ' long' : ''}" aria-hidden="false"><span>${esc(gapFmt(it.gapMin))} sem medir</span></li>` : '';
  const dv = it.delta == null ? '<span class="tag first">1ª do dia</span>' : `<span class="tag ${it.delta > 0 ? 'up' : ''}">${it.delta > 0 ? '▲' : it.delta < 0 ? '▼' : '■'} ${stepFmt(it.delta)} mg/dL</span>`;
  return gap + `<li><button type="button" class="in-tli g-${it.band}" data-act="open" data-id="${r.id}"><span class="in-tl-t num">${r.noTime ? '—:—' : r.time}</span><i class="in-tl-d p-${inBand(it.band)}" aria-hidden="true"></i><span class="in-tl-b"><span class="chips">${dv}${recChips(r)}</span></span><span class="in-tl-v num">${fn(r.glucose, 1)}<small>${it.out === 'low' ? ' ▼' : it.out === 'high' ? ' ▲' : ''}</small></span></button></li>`;
}
function inDayCard(d) {
  const iso = d.iso, D = inDay(S.records, iso, S.events), isToday = d.isToday;
  const nav = `<div class="day-nav">${isToday ? '' : '<button class="btn sm" data-act="day-today">Hoje</button>'}<button class="btn sm" data-act="day-prev" aria-label="Dia anterior">‹</button><button class="btn sm" data-act="day-next" aria-label="Próximo dia" ${isToday ? 'disabled' : ''}>›</button></div>`;
  let body;
  if (!D.n) {
    const prevRec = [...S.records].reverse().find(r => r.ts < mkTs(iso, '00:00'));
    body = `<p class="pn-sub">${isToday ? 'Nenhuma medição hoje.' : 'Nenhuma medição neste dia.'} ${prevRec ? `Última: ${fn(prevRec.glucose, 1)} mg/dL em ${fmtDate(prevRec.date).slice(0, 5)}.` : ''}</p>${isToday ? '<button type="button" class="btn sm pri" data-act="new">Nova medição</button>' : ''}`;
  } else {
    const seq = `<span class="in-seq" aria-hidden="true">${D.items.map(i => `<i class="p-${inBand(i.band)}"></i>`).join('')}</span>`;
    const facts = [`${D.n} medi${D.n === 1 ? 'ção' : 'ções'}`, `${D.inRange} na faixa`, D.out ? `${D.out} fora` : '', D.maxGapMin != null ? `maior intervalo ${gapFmt(D.maxGapMin)}` : '', D.n > 1 ? `amplitude ${f0(D.max - D.min)} mg/dL` : ''].filter(Boolean).join(' · ');
    const first = D.items.slice(0, 4), more = D.items.slice(4);
    const ev = D.events.length ? `<p class="in-dev">${D.events.map(e => `<span class="tag">${esc(e.text)}</span>`).join('')}</p>` : '';
    body = `${seq}<p class="pn-sub in-facts">${esc(facts)}</p>${inDayChart(D, isToday)}${D.untimed ? `<p class="hint">${D.untimed} medição(ões) sem horário não aparecem no gráfico.</p>` : ''}<p class="in-leg"><span><i class="in-pt p-ok"></i>na faixa</span><span><i class="in-pt p-low"></i>baixa</span><span><i class="in-pt p-high"></i>alta</span><span class="dim">Pontos são medições reais; a linha só liga medições com até 6 h de intervalo.</span></p>${ev}<ol class="in-tl">${first.map(inTlItem).join('')}</ol>${more.length ? `<details class="in-more"><summary>Ver todas as ${D.n} medições</summary><ol class="in-tl">${more.map(inTlItem).join('')}</ol></details>` : ''}`;
  }
  return `<section class="in-card in-day wide" aria-label="Evolução do dia"><div class="row sp in-card-h"><span class="pn-h">${pnIc('clock')}<span class="pn-t">Evolução · ${esc(pnDayLab(iso, isToday))}${isToday ? '' : ' ' + esc(fmtDate(iso).slice(0, 5))}</span></span>${nav}</div>${body}</section>`;
}

/* ---------- cartões novos: variabilidade e exames ---------- */
function inVarCard(M) {
  const v = M.vari;
  if (!v) return pnCard('var', '', 'scale', 'Variabilidade', `<span class="pn-big num">—</span><span class="pn-sub">${M.sc.n ? 'Precisa de 5 medições no período' : 'Sem medições no período'}</span>`, 'Variabilidade: sem dados suficientes');
  const sc = inScale([M.sc.min, M.sc.max], LIM.low, LIM.high), a = sc.pos(LIM.low), b = sc.pos(LIM.high), x0 = sc.pos(M.sc.min), x1 = sc.pos(M.sc.max), mm = sc.pos(M.sc.mean);
  const cv = typeof mtAllowed === 'function' && mtAllowed() && v.cv != null ? ` · CV ${fn(v.cv, 0)}%` : '';
  return pnCard('var', 'wide', 'scale', 'Variabilidade', `<span class="pn-row"><span class="pn-big num">${f0(v.sd)}<small>mg/dL de desvio-padrão</small></span></span><span class="in-rng" aria-hidden="true"><i class="in-rng-ok" style="left:${a.toFixed(1)}%;width:${(b - a).toFixed(1)}%"></i><i class="in-rng-sp" style="left:${x0.toFixed(1)}%;width:${Math.max(1, x1 - x0).toFixed(1)}%"></i><i class="in-rng-m" style="left:${mm.toFixed(1)}%"></i></span><span class="pn-sub num">Menor ${f0(M.sc.min)} · média ${f0(M.sc.mean)} · maior ${f0(M.sc.max)} mg/dL${cv}</span>`, `Variabilidade: desvio-padrão de ${f0(v.sd)} mg/dL, amplitude de ${f0(v.amp)} mg/dL`);
}
function inExamCard() {
  const ex = S.exams.filter(e => e.date && e.source !== 'exemplo').sort((a, b) => b.date.localeCompare(a.date) || (b.addedAt || 0) - (a.addedAt || 0))[0];
  const lab = S.hba.filter(x => !isEx(x) && x.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const ago = iso => { const n = Math.round((startOfDay(Date.now()) - startOfDay(mkTs(iso, '12:00'))) / DAY); return n <= 0 ? 'hoje' : n === 1 ? 'ontem' : n < 60 ? `há ${n} dias` : `há ${Math.round(n / 30)} meses`; };
  let body;
  if (!ex && !lab) body = `<p class="pn-sub">Nenhum exame registrado ainda.</p><button type="button" class="btn sm" data-act="go" data-r="exames">Adicionar exame</button>`;
  else {
    const est = est90();
    body = `<div class="in-exl">${ex ? `<button type="button" class="in-exr" data-act="ex-open" data-id="${esc(ex.id)}"><span class="dim">Último exame</span><b>${esc(ex.title && ex.title !== 'Exame' ? ex.title : 'Exame laboratorial')}</b><span class="num dim">${fmtDate(ex.date)} · ${ago(ex.date)}</span></button>` : ''}${lab ? `<button type="button" class="in-exr" data-act="go" data-r="hba1c"><span class="dim">HbA1c de laboratório</span><b class="num">${fn(lab.value, 1)}%</b><span class="num dim">${fmtDate(lab.date)} · ${ago(lab.date)}${est.ok ? ` · estimativa atual ≈ ${fn(est.value, 1)}%` : ''}</span></button>` : ''}</div>`;
  }
  return `<section class="in-card in-exa" aria-label="Exames"><span class="pn-h">${pnIc('flask')}<span class="pn-t">Exames</span></span>${body}</section>`;
}
/* barras de comparação (período atual x anterior) usadas no cartão Comparação */
function inCmpBars(a, b, per) {
  if (a == null || b == null) return '';
  const mx = Math.max(a, b, 1);
  return `<span class="in-cmpb" aria-hidden="true"><span><i style="width:${(a / mx * 100).toFixed(0)}%"></i><em class="num">${f0(a)}</em></span><span class="prev"><i style="width:${(b / mx * 100).toFixed(0)}%"></i><em class="num">${f0(b)}</em></span></span>`;
}
const inMiniBar = (n, tot, cls) => tot ? `<i class="in-bar ${cls || ''}" aria-hidden="true"><i style="width:${Math.max(n ? 3 : 0, n / tot * 100).toFixed(0)}%"></i></i>` : '';

/* ---------- 6. Personalização ---------- */
function inCustHTML(msg) {
  const p = inPrefs();
  const ind = IN_IND.map(i => `<button type="button" class="in-pill" data-act="in-pri" data-k="${i.k}" aria-pressed="${p.pri.includes(i.k)}">${esc(i.t)}</button>`).join('');
  const rows = p.order.map((k, i) => {
    const c = IN_CARDS.find(x => x.k === k), hid = p.hidden.includes(k);
    return `<li class="in-cr${hid ? ' off' : ''}"><span class="in-cr-t">${esc(c.t)}${hid ? ' <small>(oculto)</small>' : ''}</span><span class="in-cr-b"><button type="button" class="btn sm" data-act="in-mv" data-k="${k}" data-d="-1" aria-label="Subir ${esc(c.t)}" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="btn sm" data-act="in-mv" data-k="${k}" data-d="1" aria-label="Descer ${esc(c.t)}" ${i === p.order.length - 1 ? 'disabled' : ''}>↓</button><button type="button" class="btn sm" data-act="in-vis" data-k="${k}" aria-pressed="${!hid}" aria-label="${hid ? 'Mostrar' : 'Ocultar'} ${esc(c.t)}">${pnIc(hid ? 'eyeoff' : 'eye')}</button></span></li>`;
  }).join('');
  return `<h2>Personalizar o Início</h2><p class="hint" style="margin:0 0 12px">A situação geral, os acontecimentos, os atalhos e os avisos de segurança sempre aparecem. Aqui você escolhe os indicadores do painel e a ordem dos cartões.</p>
    <h3 class="in-h3">Indicadores do painel <small>(1 a ${IN_PRI_MAX})</small></h3><div class="in-pills" role="group" aria-label="Indicadores do painel">${ind}</div><p class="hint in-msg" id="in-msg" role="status" aria-live="polite">${esc(msg || '')}</p>
    <h3 class="in-h3">Cartões</h3><ul class="in-cl">${rows}</ul>
    <div class="row" style="margin-top:14px;gap:8px"><button type="button" class="btn" data-act="in-reset" ${inIsDefault(p) ? 'disabled' : ''}>Restaurar padrão</button><button type="button" class="btn pri grow" data-act="in-done">Concluir</button></div>`;
}
function inCustRedraw(msg) {
  const sh = document.querySelector('#sheet-bg .sheet'); if (!sh) return;
  const top = sh.scrollTop; sh.innerHTML = '<div class="grab"></div>' + inCustHTML(msg); sh.scrollTop = top;
}
function inApply(p, msg) { inPrefsSave(p); inMemo = { key: '', m: null }; render(); inCustRedraw(msg); }
document.addEventListener('click', e => {
  const el = e.target.closest && e.target.closest('[data-act^="in-"]'); if (!el) return;
  const a = el.dataset.act, k = el.dataset.k;
  if (a === 'in-cust') openSheet(inCustHTML(''));
  else if (a === 'in-done') closeSheet();
  else if (a === 'in-mv') inApply(inMove(inPrefs(), k, +el.dataset.d || 0));
  else if (a === 'in-vis') inApply(inToggleHidden(inPrefs(), k));
  else if (a === 'in-pri') { const r = inTogglePri(inPrefs(), k); inApply(r.prefs, r.msg); }
  else if (a === 'in-reset') { inApply(IN_DEF(), 'Organização padrão restaurada.'); }
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
