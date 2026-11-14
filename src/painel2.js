/* ================= Painel em cards (visual novo) =================
   Reversível: o visual antigo continua inteiro em viewPainelClassic() (app.js).
   A chave "Visual do painel" (Cards | Clássico) fica no topo do Painel e guarda a escolha neste aparelho.
   Para voltar de vez ao antigo: troque o valor padrão de pnlGet() para 'classic'. */
const PNL_KEY = 'tb-pnl';
function pnlGet() { try { return localStorage.getItem(PNL_KEY) === 'classic' ? 'classic' : 'cards'; } catch (e) { return 'cards'; } }
let pnlMode = pnlGet();
function pnlSet(v) { pnlMode = v === 'classic' ? 'classic' : 'cards'; try { localStorage.setItem(PNL_KEY, pnlMode); } catch (e) { } }
function pnlSwitch() {
  return `<div class="pn-sw" role="group" aria-label="Visual do painel"><span>Visual do painel</span><div class="seg">${[['cards', 'Cards'], ['classic', 'Clássico']].map(([k, t]) => `<button data-act="pnl-mode" data-v="${k}" aria-pressed="${pnlMode === k}">${t}</button>`).join('')}</div></div>`;
}
function viewPainel() { return pnlSwitch() + (pnlMode === 'classic' ? viewPainelClassic() : viewPainelCards()); }

const PNI = {
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  hb: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><circle cx="12" cy="14" r="2.4"/>',
  bars: '<path d="M5 20v-7M12 20V5M19 20v-10"/>',
  trend: '<path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
  syringe: '<path d="M15 4l5 5M17 6l-9.5 9.5L6 19l3.5-1.5L19 8M12 9l3 3M3 21l3-3"/>',
  scale: '<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  down: '<path d="M12 4v16M6 14l6 6 6-6"/>',
  up: '<path d="M12 20V4M6 10l6-6 6 6"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  pie: '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M14.5 3.5A9 9 0 0 1 20.5 9.5h-6z"/>',
  cmp: '<path d="M4 7h13M13 3l4 4-4 4M20 17H7M11 13l-4 4 4 4"/>'
};
const pnIc = k => `<svg class="pn-ic" viewBox="0 0 24 24" aria-hidden="true">${PNI[k]}</svg>`;
const pnHead = (ic, t) => `<span class="pn-h">${pnIc(ic)}<span class="pn-t">${t}</span></span>`;
/* st: true = dentro da faixa (borda verde, ✓) · false = fora (borda vermelha, ▲) · null = sem faixa */
const pnCard = (key, cls, ic, title, body, label, st) => `<button type="button" class="pn-c pn-${key} ${cls || ''}${st === true ? ' st-ok' : st === false ? ' st-bad' : ''}" data-pm="${key}" aria-haspopup="dialog" aria-label="${esc(label || title)}${st === true ? ', dentro da faixa' : st === false ? ', fora da faixa' : ''}. Toque para ver os detalhes.">${pnHead(ic, title)}${body}</button>`;

/* ---------- dados comuns ---------- */
function pnData() {
  const all = S.records, last = all[all.length - 1], { cur, prev } = curRange();
  const rc = inRange(all, cur[0], cur[1]), rp = inRange(all, prev[0], prev[1]), sc = stats(rc), sp = stats(rp);
  const todayIso = isoDate(new Date()), iso = S.day || todayIso, rs = dayRecs(iso), sd = stats(rs);
  return { all, last, cur, prev, rc, rp, sc, sp, cmp: compareStats(sc, sp), iso, isToday: iso === todayIso, rs, sd };
}
const pnDayLab = (iso, isToday) => isToday ? 'Hoje' : iso === isoDate(new Date(addDays(Date.now(), -1))) ? 'Ontem' : fmtDate(iso);

/* ---------- Tratamento (resumo) ---------- */
/* relógio igual ao do card de Insulinas: horas e minutos grandes, segundos menores */
function pnClock(b) {
  const t = hms(b.rem), over = b.st === 'over';
  return `<span class="pn-clk${over ? ' over' : ''}" data-st="${b.st}"><span class="pn-hm">${over ? '+' : ''}${t.slice(0, -3)}</span><small class="pn-s">${t.slice(-3)}</small></span>`;
}
setInterval(() => {
  const el = document.querySelector('.pn-clk'); if (!el || typeof insLoaded === 'undefined' || !insLoaded) return;
  const b = basalInfo(); if (!b) { render(); return; }
  if (b.st !== el.dataset.st) { render(); return; }
  const t = hms(b.rem), hm = el.querySelector('.pn-hm'), sec = el.querySelector('.pn-s');
  if (hm) hm.textContent = (b.st === 'over' ? '+' : '') + t.slice(0, -3); if (sec) sec.textContent = t.slice(-3);
}, 500);
function pnTrat() {
  const p = S.plan, on = k => p.types.includes(k), lines = []; let big = '—', unit = '', st = null;
  if (!p.types.length) return { big, unit, sub: 'Escolha como você trata o diabetes.' };
  if (on('insulina')) {
    try { insRoll(); } catch (e) { }
    const b = basalInfo(), done = ['fast', 'lunch', 'dinner'].filter(k => S.ins[k]).length, sk = skipped('basal');
    if (sk) { big = 'Pulada'; unit = 'basal hoje'; }
    else if (b) { st = b.st === 'ok'; big = pnClock(b); unit = b.st === 'over' ? 'passaram 24 h · atraso' : 'faltam para a próxima'; lines.push(`Última basal: ${new Date(S.ins.basalTs).toDateString() === new Date().toDateString() ? 'hoje' : 'ontem'} ${HM(S.ins.basalTs)}`); if (b.st !== 'ok') lines.push(b.st === 'over' ? '▲▲ Hora da basal' : '▲ Chegando a hora da basal'); }
    else { big = '—'; unit = 'basal sem contagem'; }
    lines.push(`Rápida hoje: ${done} de 3`);
  }
  if (on('remedios')) { const n = p.meds.filter(x => x.name || x.times.length).length; lines.push(`Remédios: ${n || 'nenhum'} cadastrado${n === 1 ? '' : 's'}`); if (big === '—' && !on('insulina')) { big = String(n); unit = n === 1 ? 'remédio' : 'remédios'; } }
  if (on('bomba')) lines.push('Bomba de insulina');
  return { big, unit, sub: lines.join(' · '), st };
}

/* ---------- Painel (cards compactos) ---------- */
function viewPainelCards() {
  const d = pnData(), { all, last, sc, cmp, rc, sd, rs } = d;
  if (!all.length) return viewPainelClassic(); // boas-vindas
  let h = banners() + labelBanner() + pfInvite();
  const bnd = bandOf(last.glucose, last.context), gKey = last.id + '|' + last.glucose, gAnim = S.gaugeKey !== gKey; S.gaugeKey = gKey;
  const gl = (v, a, lbl) => `<div class="pn-gauge">${gaugeSvg(v, a, lbl)}</div>`;
  const cards = [];
  cards.push(pnCard('ult', `b-${bnd.k}${(last.glucose < LIM.low || last.glucose > LIM.high) ? ' oor' : ''}`, 'drop', 'Glicemia mais recente',
    `${gl(last.glucose, gAnim, `Glicemia de ${fn(last.glucose, 1)} mg/dL, ${bnd.txt}. Mostrador de 70 a 250 mg/dL.`)}<span class="pn-mid">${badge(last.glucose, last.context)}</span><span class="pn-sub num">${last.noTime ? '' : 'Última medição: ' + last.time + ' · '}${fmtDate(last.date).slice(0, 5)} · ${relTime(last.ts)}</span>`,
    `Glicemia mais recente: ${fn(last.glucose, 1)} mg/dL, ${bnd.txt}`, bnd.k === 'ok'));
  cards.push(pnCard('dia', '', 'bars', 'Média do dia',
    rs.length ? `${gl(sd.mean, false, 'Média do dia: ' + fn(sd.mean, 1) + ' mg/dL. Mostrador de 70 a 250 mg/dL.')}<span class="pn-mid">${badge(sd.mean)}</span><span class="pn-sub num">Medições: ${sd.n} · ${pnDayLab(d.iso, d.isToday)}</span>`
      : `<span class="pn-big num">—</span><span class="pn-sub">${d.isToday ? 'Nenhuma medição hoje' : 'Nenhuma medição neste dia'}</span>`,
    rs.length ? `Média do dia: ${fn(sd.mean, 1)} mg/dL, ${sd.n} medições` : 'Média do dia: sem medições', rs.length ? bandOf(sd.mean).k === 'ok' : null));
  const e = est90();
  cards.push(pnCard('hba', 'wide', 'hb', 'Hemoglobina glicada (HbA1c)',
    e.ok ? `<span class="pn-row"><span class="pn-big num">≈ ${fn(e.value, 1)}<small>%</small></span>${a1cBadge(e.value)}<span class="pn-sub pn-r">Estimativa: 90 dias</span></span>`
      : `<span class="pn-row"><span class="pn-big num">—</span><span class="pn-sub pn-r">Estimativa indisponível: ${e.st.n} medições em ${e.days} dias</span></span>`,
    e.ok ? `HbA1c estimada: aproximadamente ${fn(e.value, 1)} por cento` : 'HbA1c estimada indisponível', e.ok ? a1cEval(e.value, S.a1cT).k === 'ok' : null));
  cards.push(pnCard('evo', '', 'trend', 'Evolução glicêmica',
    `<span class="pn-spark">${rc.length > 1 ? sparkline(rc) : ''}</span><span class="pn-sub">${rc.length ? `${rc.length} medi${rc.length > 1 ? 'ções' : 'ção'} · ${S.period} dias` : 'Sem medições em ' + S.period + ' dias'}</span>`,
    'Evolução glicêmica', sc.n ? bandOf(sc.mean).k === 'ok' : null));
  const tr = pnTrat();
  cards.push(pnCard('trat', '', 'syringe', 'Meu tratamento', `<span class="pn-big num">${tr.big}</span>${tr.unit ? `<span class="pn-unit">${tr.unit}</span>` : ''}<span class="pn-sub">${esc(tr.sub)}</span>`, 'Meu tratamento', tr.st));
  cards.push(`<div class="pn-per"><div class="seg" role="group" aria-label="Período dos indicadores">${[7, 30, 90].map(p => `<button data-act="period" data-p="${p}" aria-pressed="${S.period === p}">${p} dias</button>`).join('')}</div><span class="eyebrow">${fmtDM(d.cur[0])} – ${fmtDM(d.cur[1])}</span></div>`);
  cards.push(pnCard('med', '', 'bars', 'Média no período', `<span class="pn-big num">${fm(sc.mean)}<small>mg/dL</small></span><span class="pn-sub">${sc.n ? (cmp.diff != null ? `${fsign(cmp.diff)} mg/dL vs. ${S.period} dias anteriores` : 'Sem média anterior para comparar') : 'Sem medições neste período'}</span>`, 'Média no período', sc.n ? bandOf(sc.mean).k === 'ok' : null));
  cards.push(pnCard('cmp', '', 'cmp', 'Comparação', `<span class="pn-big num">${cmp.pct == null ? '—' : fsign(cmp.pct, 0)}<small>%</small></span><span class="pn-sub">vs. período anterior</span>`, 'Comparação com o período anterior'));
  cards.push(pnCard('min', 'mini', 'down', 'Menor', `<span class="pn-big num">${f0(sc.min)}</span><span class="pn-unit">mg/dL</span>`, 'Menor glicemia do período', sc.n ? bandOf(sc.min).k === 'ok' : null));
  cards.push(pnCard('max', 'mini', 'up', 'Maior', `<span class="pn-big num">${f0(sc.max)}</span><span class="pn-unit">mg/dL</span>`, 'Maior glicemia do período', sc.n ? bandOf(sc.max).k === 'ok' : null));
  cards.push(pnCard('n', 'mini', 'bars', 'Medições', `<span class="pn-big num">${sc.n}</span><span class="pn-unit">no período</span>`, 'Quantidade de medições no período'));
  cards.push(pnCard('hipo', '', 'warn', 'Episódios &lt; 70', `<span class="pn-big num">${sc.hypo}<small>medições</small></span><span class="pn-sub">${sc.n ? (sc.hypo / sc.n * 100).toFixed(0) + '% das medições' : '—'}</span>`, 'Episódios abaixo de 70', sc.n ? sc.hypo === 0 : null));
  cards.push(pnCard('hiper', '', 'warn', 'Acima da faixa', `<span class="pn-big num">${sc.hyper}<small>medições</small></span><span class="pn-sub">${sc.n ? (sc.hyper / sc.n * 100).toFixed(0) + '% das medições' : '—'}</span>`, 'Medições acima da faixa', sc.n ? sc.hyper === 0 : null));
  const bc = bandCounts(rc), n = rc.length;
  cards.push(pnCard('dist', 'wide pn-dist-c', 'pie', 'Distribuição por faixa',
    n ? `<span class="pn-bar" aria-hidden="true">${BAND_LIST.filter(b => bc[b.k]).map(b => `<i class="d-${b.k}" style="flex:${bc[b.k]}"></i>`).join('')}</span><span class="pn-leg">${BAND_LIST.filter(b => bc[b.k]).map(b => `<span><i class="d-${b.k}"></i><b class="num">${(bc[b.k] / n * 100).toFixed(0)}%</b> ${b.name.toLowerCase()}</span>`).join('')}</span>` : '<span class="pn-sub">Sem medições neste período.</span>',
    'Distribuição por faixa'));
  return h + `<div class="pn-grid">${cards.join('')}</div>`;
}

/* ---------- Janela flutuante (detalhes) ---------- */
const PM_TITLES = { ult: 'Glicemia mais recente', dia: 'Média do dia', hba: 'Hemoglobina glicada (HbA1c)', evo: 'Evolução glicêmica', trat: 'Meu tratamento', med: 'Média no período', cmp: 'Comparação com o período anterior', min: 'Menor glicemia', max: 'Maior glicemia', n: 'Medições', hipo: 'Episódios abaixo de 70', hiper: 'Acima da faixa', dist: 'Distribuição por faixa' };
const pmBig = (v, u, sub) => `<div class="pm-big"><span class="num">${v}</span>${u ? `<small>${u}</small>` : ''}</div>${sub ? `<p class="pm-sub">${sub}</p>` : ''}`;
const pmRow = (a, b) => `<div class="row sp pm-r"><span class="dim">${a}</span><b class="num">${b}</b></div>`;
const pmRecLine = r => r ? `${fn(r.glucose, 0)} mg/dL em ${fmtDate(r.date).slice(0, 5)}${r.noTime ? '' : ' às ' + r.time}` : 'nenhuma registrada';
function pmRecList(arr) {
  if (!arr.length) return '<p class="pm-sub">Nenhuma medição neste período.</p>';
  return `<div style="margin-top:12px">` + arr.slice().reverse().slice(0, 10).map(r => `<button class="rec g-${bandOf(r.glucose, r.context).k}" data-act="open" data-id="${r.id}"><span class="tm num"><b>${r.noTime ? '—:—' : r.time}</b></span><span class="info">${badge(r.glucose, r.context)}<span class="chips"><span class="tag">${fmtDate(r.date).slice(0, 5)}</span>${recChips(r)}</span></span><span class="gl num">${fn(r.glucose, 1)}<small>mg/dL</small></span></button>`).join('') + (arr.length > 10 ? `<p class="hint">Mostrando as 10 mais recentes de ${arr.length}. O histórico completo está na aba Histórico.</p>` : '') + `</div>`;
}
function pmDetail(key) {
  iconCutSet();
  const d = pnData(), { all, last, cur, prev, rc, rp, sc, sp, cmp } = d, per = `${fmtDM(cur[0])} – ${fmtDM(cur[1])} · ${S.period} dias`;
  switch (key) {
    case 'ult': {
      const bnd = bandOf(last.glucose, last.context);
      return `<div class="card red hero hero2 b-${bnd.k}${(last.glucose < LIM.low || last.glucose > LIM.high) ? ' oor' : ''}"><div class="hr-top"><div class="eyebrow">Glicemia mais recente</div><span class="hr-when">${relTime(last.ts)}</span></div>
        <div class="gauge-box">${gaugeSvg(last.glucose, false, `Glicemia de ${fn(last.glucose, 1)} mg/dL, ${bnd.txt}. Mostrador de 70 a 250 mg/dL.`)}</div>
        <div class="hr-state">${badge(last.glucose, last.context)}</div>
        <div class="hr-info"><div class="hr-d num">${WD[new Date(last.ts).getDay()]} · ${fmtDate(last.date)}${last.noTime ? '' : ' · ' + last.time}</div><div class="chips" style="justify-content:center">${recChips(last)}</div></div>${lastExtremes(all)}</div>
        <button class="btn full" style="margin-top:12px" data-act="open" data-id="${last.id}">Abrir esta medição</button>`;
    }
    case 'dia': return todayBlock();
    case 'hba': return hbaCard();
    case 'trat': return treatmentCard();
    case 'evo': {
      const selBar = `<div class="row sp" style="margin:0 0 12px;flex-wrap:wrap;gap:8px"><div class="seg" role="group" aria-label="Período da evolução e dos indicadores">${[7, 30, 90].map(p => `<button data-act="period" data-p="${p}" aria-pressed="${S.period === p}">${p} dias</button>`).join('')}</div><span class="eyebrow">${per}</span></div>`;
      return `<div class="card">${selBar}${rc.length ? glucoseChart(rc, cur[0], cur[1]) + `<div class="legend"><span><i class="lg-dot"></i>medição</span><span><i class="lg-line"></i>média diária</span><span><i class="lg-dash"></i>70 e 180 mg/dL</span></div><p class="hint">Pontilhado: limite de 130 mg/dL para medições em jejum. Cada ponto é uma medição real. Toque ou passe o dedo para ver o valor.</p>` : emptyBlock('Sem medições', 'Nenhuma medição nos últimos ' + S.period + ' dias.')}</div>${eventLegend(cur[0], cur[1])}`;
    }
    case 'med': return pmBig(fm(sc.mean), 'mg/dL', per) + pmRow('Média no período anterior', sp.n ? fm(sp.mean) + ' mg/dL' : '—') + pmRow('Diferença', cmp.diff != null ? fsign(cmp.diff) + ' mg/dL' : '—') + pmRow('Medições no período', sc.n);
    case 'cmp': {
      const row = (lb, a, b, dd, cls = '') => `<tr><td>${lb}</td><td>${a}</td><td class="dim">${b}</td><td class="${cls}">${dd}</td></tr>`, few = (sc.n && sc.n < 5) || (sp.n && sp.n < 5);
      return pmBig(cmp.pct == null ? '—' : fsign(cmp.pct, 0), '%', 'vs. período anterior') + `<div class="tbl-wrap"><table class="t"><thead><tr><th></th><th>Atual<small>${fmtDM(cur[0])}–${fmtDM(cur[1])}</small></th><th>Anterior<small>${fmtDM(prev[0])}–${fmtDM(prev[1])}</small></th><th>Dif.<small>&nbsp;</small></th></tr></thead><tbody>
        ${row('Média (mg/dL)', fm(sc.mean), fm(sp.mean), fsign(cmp.diff), cmp.diff > 0 ? 'delta-up' : '')}
        ${row('Variação %', '', '', cmp.pct == null ? '—' : fsign(cmp.pct) + '%', cmp.pct > 0 ? 'delta-up' : '')}
        ${row('Medições', sc.n, sp.n, fsign(sc.n - sp.n, 0))}
        ${row('Hipoglicemia (&lt; 70)', `${sc.hypo}<small>${sc.n ? (sc.hypo / sc.n * 100).toFixed(0) + '%' : '—'}</small>`, `${sp.hypo}<small>${sp.n ? (sp.hypo / sp.n * 100).toFixed(0) + '%' : '—'}</small>`, fsign(sc.hypo - sp.hypo, 0))}
        ${row('Hiperglicemia (acima da faixa)', `${sc.hyper}<small>${sc.n ? (sc.hyper / sc.n * 100).toFixed(0) + '%' : '—'}</small>`, `${sp.hyper}<small>${sp.n ? (sp.hyper / sp.n * 100).toFixed(0) + '%' : '—'}</small>`, fsign(sc.hyper - sp.hyper, 0))}
        </tbody></table></div>${few ? '<p class="hint"><b>Poucas medições</b> em um dos períodos. Compare com cautela.</p>' : ''}<p class="hint">As contagens dependem de quantas medições foram feitas em cada período; os percentuais ajudam a comparar.</p>`;
    }
    case 'min': case 'max': {
      const r = rc.find(x => x.glucose === (key === 'min' ? sc.min : sc.max));
      return pmBig(f0(key === 'min' ? sc.min : sc.max), 'mg/dL', per) + (sc.n ? pmRow(key === 'min' ? 'Menor glicemia' : 'Maior glicemia', pmRecLine(r)) + pmRow('Média no período', fm(sc.mean) + ' mg/dL') + (r ? `<button class="btn full" style="margin-top:12px" data-act="open" data-id="${r.id}">Abrir esta medição</button>` : '') : '<p class="pm-sub">Sem medições neste período.</p>');
    }
    case 'n': {
      const days = new Set(rc.map(x => x.date)).size;
      return pmBig(sc.n, 'no período', per) + pmRow('Dias com medição', days) + pmRow('Período anterior', sp.n) + pmRow('Média por dia com medição', days ? fm(sc.n / days) : '—');
    }
    case 'hipo': case 'hiper': {
      const lo = key === 'hipo', arr = rc.filter(r => lo ? r.glucose < LIM.low : r.glucose > highOf(r)), v = lo ? sc.hypo : sc.hyper;
      return pmBig(v, 'medições', per) + pmRow('Parte das medições', sc.n ? (v / sc.n * 100).toFixed(0) + '%' : '—') + pmRow('Período anterior', lo ? sp.hypo : sp.hyper) + pmRecList(arr);
    }
    case 'dist': return distBars(rc);
  }
  return '';
}
let pmFocus = '';
function pmOpenNow() { return !!(typeof S !== 'undefined' && S.pm); }
function pmDraw() {
  const key = S.pm; if (!key) return;
  if (S.route !== 'painel' || pnlMode === 'classic' || !S.records.length) { pmClose(true); return; }
  let bg = document.getElementById('pm-bg');
  if (!bg) {
    bg = document.createElement('div'); bg.className = 'sheet-bg pm-bg'; bg.id = 'pm-bg';
    bg.innerHTML = `<div class="sheet pm" role="dialog" aria-modal="true" aria-labelledby="pm-t"><div class="grab"></div><div class="pm-hd"><h2 id="pm-t"></h2><button type="button" class="btn sm" data-act="pm-close" aria-label="Fechar">✕</button></div><div class="pm-b"></div></div>`;
    bg.addEventListener('pointerdown', e => { if (e.target === bg) pmClose(); });
    document.body.appendChild(bg); document.body.style.overflow = 'hidden';
    setTimeout(() => { const c = bg.querySelector('[data-act="pm-close"]'); if (c) c.focus(); }, 60);
  }
  const sh = bg.querySelector('.sheet'), top = sh.scrollTop, pb = bg.querySelector('.pm-b');
  bg.querySelector('#pm-t').textContent = PM_TITLES[key] || '';
  pb.innerHTML = pmDetail(key); attachCharts(pb); sh.scrollTop = top;
}
function pmClose(quiet) {
  const key = S.pm; S.pm = null; const b = document.getElementById('pm-bg'); if (b) b.remove();
  if (!document.getElementById('sheet-bg')) document.body.style.overflow = '';
  if (!quiet && key) setTimeout(() => { const c = document.querySelector(`[data-pm="${key}"]`); if (c) c.focus({ preventScroll: true }); }, 30);
}
document.addEventListener('click', e => {
  const c = e.target.closest('[data-pm]');
  if (c) { S.pm = c.dataset.pm; pmDraw(); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'pm-close') pmClose();
  else if (a.dataset.act === 'pnl-mode') { pmClose(true); pnlSet(a.dataset.v); render(); window.scrollTo(0, 0); }
  else if (a.dataset.act === 'go' && S.pm) pmClose(true);
});
let pmEscSheet = false; // Esc fecha só a folha por cima (se houver); o modal fecha no Esc seguinte
document.addEventListener('keydown', e => { pmEscSheet = !!document.getElementById('sheet-bg'); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.pm && !pmEscSheet) pmClose(); });
