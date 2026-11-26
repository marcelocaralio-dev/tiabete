/* ================= Meu tratamento · interface =================
   Cartões do Início gerados a partir de S.plan.insulin (fonte única), resumo, histórico de alterações e exportação.
   Não cria dose, não decide aplicação. Regras antigas (limite do jantar, 24 h da basal) foram MANTIDAS como estavam. */
const trToday = () => { const d = isoDate(new Date()), sl = trSlots(S.plan, d, mkTs); return { d, sl, as: trAssign(sl, d, S.inslog, mkTs) }; };
const trItemKey = it => 'i:' + it.id;
function trMemU(it, sl) {
  const k = trItemKey(it); if (S.ud[k] !== undefined) return S.ud[k];
  const same = sl.filter(s => s.kind === trKind(it, '')).map(s => s.it.id), single = new Set(same).size <= 1;
  const u = S.ins.lastU && S.ins.lastU[k] != null ? S.ins.lastU[k] : trLastUnits(it, S.inslog, single, trKind(it, ''));
  return fnU(u);
}
const trUnitsOk = v => { const u = parseUnits(v); return typeof u === 'number' && u > 0; };
const trLastRec = it => [...S.inslog].reverse().find(x => x.insId === it.id) || null;
const trDayWord = ts => new Date(ts).toDateString() === new Date().toDateString() ? 'hoje' : new Date(ts).toDateString() === new Date(Date.now() - DAY).toDateString() ? 'ontem' : fmtDate(isoDate(new Date(ts))).slice(0, 5);
function trProx(time) {
  if (!time) return '';
  const m = Math.round((mkTs(isoDate(new Date()), time) - Date.now()) / 60000);
  if (m > 90) return `Faltam ${Math.floor(m / 60)} h ${pad(m % 60)} min`;
  if (m > 1) return `Faltam ${m} min`;
  if (m >= -1) return 'É agora';
  return m > -90 ? `Passou há ${-m} min` : `Passou há ${Math.floor(-m / 60)} h ${pad(-m % 60)} min`;
}
/* Condição de registro definida pela pessoa para esta insulina (nenhuma regra fixa do app). Usa a glicemia de hoje da refeição correspondente; sem refeição definida, a mais recente. */
function trGate(s) {
  if (!plGateOn(s.it)) return null;
  const a = mkTs(isoDate(new Date()), '00:00'), rs = inRange(S.records, a, endOfDay(a)).filter(r => !r.noTime), meal = { fast: 'cafe', lunch: 'almoco', dinner: 'jantar' }[s.kind];
  const m = meal ? rs.filter(r => r.meal === meal && (r.context === 'antes' || r.context === 'jejum')) : [], g = (m.length ? m : rs).slice(-1)[0] || null;
  return { min: s.it.gate.min, g, open: !!(g && g.glucose >= s.it.gate.min) };
}
function trCard(s, recs, first) {
  const it = s.it, k = s.key, rec = recs[recs.length - 1], sk = skipped(k) && !rec, gt = trGate(s), locked = !rec && !!gt && !gt.open;
  const idAttr = first[s.kind] === s.key && (s.kind === 'basal' || s.kind === 'dinner') ? (s.kind === 'basal' ? 'ins-basal' : 'ins-r-dinner') : 'tc-' + it.id + (s.time ? '-' + s.time.replace(':', '') : '');
  const role = trRoleTxt(it.role), when = s.time ? `Horário do tratamento ${s.time}` : 'Quando necessário';
  const head = (state, cls) => `<div class="tc-a"><div><b class="tc-n">${esc(it.name || 'Insulina sem nome')}</b><div class="tc-t">${esc(role)} · ${esc(when)}</div></div><span class="tc-st ${cls}">${state}</span></div>`;
  if (rec) { /* registrada: cartão compacto */
    const u = rec.units != null ? `<b class="num">${fU(rec.units)}</b>` : '<span class="tc-warn">Confirmada pelo lembrete · quantidade não informada</span>';
    const extra = recs.length > 1 ? ` · ${recs.length} registros hoje` : '';
    return `<div class="card tc tc-done" id="${idAttr}" data-key="${k}">${head('✓ Registrada', 'ok')}<div class="tc-r"><span>Às <b class="num">${HM(rec.ts)}</b> · ${u}${extra}</span><button class="btn sm tc-edit" data-act="ins-log-edit" data-id="${rec.id}" aria-label="Editar registro de ${esc(it.name || 'insulina')}">${rec.units != null ? 'Editar' : 'Informar quantidade'}</button></div>${s.onDemand ? `<button class="btn sm full" style="margin-top:8px" data-act="tr-more" data-key="${k}">Registrar outra aplicação</button>` : ''}</div>`;
  }
  if (sk) return `<div class="card tc tc-skip" id="${idAttr}" data-key="${k}">${head('⏭ Pulada hoje', 'neu')}<div class="tc-r"><span class="dim">Esta aplicação foi pulada hoje.</span><button class="btn sm" data-act="tr-skip" data-key="${k}">Desfazer pulo</button></div></div>`;
  const last = trLastRec(it), kind = s.kind;
  const lastTxt = last ? `Última aplicação: <b class="num">${trDayWord(last.ts)} ${HM(last.ts)}</b>${last.units != null ? ' · ' + fU(last.units) : ''}` : 'Ainda sem aplicação registrada';
  let info = `<div class="tc-i">${lastTxt}</div>`;
  if (kind === 'basal' && last && last.insId === it.id) { /* contagem de 24 h da basal: mesma regra de sempre */
    const el = Date.now() - last.ts, rem = H24 - el, st = rem <= 0 ? 'over' : rem <= 3600e3 ? 'soon' : 'ok';
    info = `<div class="tc-cd-l">${st === 'over' ? 'PASSARAM 24 H · ATRASO' : 'FALTAM PARA 24 H DA ÚLTIMA BASAL'}</div><div class="tc-cd num${st === 'over' ? ' over' : ''}" data-tc-cd="${last.ts}">${(st === 'over' ? '+' : '') + hms(rem)}</div><div class="ib-bar tc-bar"><span data-tc-bar="${last.ts}" style="width:${Math.min(100, el / H24 * 100).toFixed(1)}%"></span></div>` + info + `<div class="tc-i">Próxima: <b class="num">${trDayWord(last.ts + H24)} ${HM(last.ts + H24)}</b></div>`;
  } else if (s.time) info = `<div class="tc-cd num tc-prox">${trProx(s.time)}</div>` + info;
  let lock = '';
  if (locked) lock = `<div class="tc-lock">🔒 Registro bloqueado pela condição que você definiu em Meu tratamento: glicemia de hoje a partir de ${gt.min} mg/dL. ${gt.g ? `Última de hoje: <b class="num">${f0(gt.g.glucose)}</b> mg/dL às ${gt.g.time}.` : 'Sem glicemia registrada hoje.'} <button class="btn sm" data-act="go" data-r="esquemas">Ver condição</button></div>`;
  const mem = trMemU(it, trToday().sl), ok = trUnitsOk(mem), hasMem = mem !== '' && last && last.units != null;
  const reg = locked ? '' : `<div class="tc-u"><div class="tc-ul">Quantidade em UI</div>${uipHTML({ id: 'ud-' + k.replace(/[^\w-]/g, '_'), cls: 'un-in tr-draft', attrs: `data-it="${it.id}"`, value: mem, rows: 3, label: 'Unidades de ' + (it.name || 'insulina') })}${hasMem ? `<div class="tc-lastv">Último valor registrado: ${fU(last.units)}</div>` : ''}<div class="dim tc-hint" data-tc-hint="${it.id}" style="${ok ? 'display:none' : ''}">Escolha as unidades (UI) para liberar o botão.</div></div>
    <button class="btn pri tc-main" data-act="tr-now" data-key="${k}" data-it="${it.id}" data-slot="${s.time}" ${ok ? '' : 'disabled aria-disabled="true"'}>Confirmar dose aplicada</button>
    <div class="tc-sec"><button class="btn sm" data-act="tr-time" data-key="${k}" data-it="${it.id}" data-slot="${s.time}">Outro horário</button><button class="btn sm" data-act="tr-skip" data-key="${k}">Pular hoje</button></div>`;
  return `<div class="card tc tc-pend${locked ? ' tc-locked' : ''}" id="${idAttr}" data-key="${k}">${head(locked ? '🔒 Bloqueada' : '● Pendente', locked ? 'neu' : 'red')}<div class="tc-b">${info}</div>${lock}${reg}</div>`;
}
function trInsCards(sm) {
  insRoll(); const { sl, as } = trToday(), p = S.plan;
  const pend = sl.filter(s => !(as[s.key] || []).length && !skipped(s.key)), allSk = sl.length && sl.every(s => (as[s.key] || []).length || skipped(s.key)) && sl.some(s => skipped(s.key));
  const head = `<div class="row" style="justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px"><h2 class="sec" style="margin:0">Meu tratamento</h2>${sl.length ? `<button class="btn sm" data-act="tr-skip-ask" aria-label="Pular tudo hoje: afeta todas as aplicações de insulina pendentes">${allSk ? 'Desfazer pulos de hoje' : 'Pular tudo hoje'}</button>` : ''}</div>`;
  const first = {}; sl.forEach(s => { if (!first[s.kind]) first[s.kind] = s.key; });
  const pending = (p.insulin || []).filter(x => !x.paused && (x.sug || (x.guess || []).length)).length;
  let body = '';
  if (!sl.length) body = `<div class="card"><div class="eyebrow">Insulinas</div><p class="hint" style="margin:8px 0 10px">${(p.insulin || []).some(x => !x.paused) ? 'Nenhuma aplicação de insulina para hoje (verifique os dias da semana e se os itens foram confirmados).' : 'Nenhuma insulina cadastrada. Os cartões do Início aparecem a partir do que você cadastrar em Meu tratamento.'}</p><button class="btn pri full" data-act="go" data-r="esquemas">Cadastrar em Meu tratamento</button></div>`;
  else body = sl.map(s => trCard(s, as[s.key] || [], first)).join('');
  const note = pending ? `<div class="banner" style="margin-top:12px"><span>${pending} insulina${pending > 1 ? 's' : ''} do tratamento ainda a confirmar: ${pending > 1 ? 'não aparecem' : 'não aparece'} aqui nem geram lembrete.</span><button class="btn sm" data-act="go" data-r="esquemas">Revisar</button></div>` : '';
  const foot = `<div class="card" style="margin-top:12px"><p class="hint" style="margin:0 0 10px">As unidades ficam memorizadas da última aplicação; mude quando precisar. O cartão fica verde ao registrar e volta ao normal no dia seguinte.</p><button class="btn full" data-act="go" data-r="insulinas">Ver histórico de insulinas</button><p class="hint" style="margin:10px 0 0">O app só registra e lembra, segundo o que você cadastrou. Não calcula nem sugere dose. Confirme sempre com seu médico.</p></div>`;
  return head + sm + `<div class="tc-list">${body}</div>` + note + foot + (typeof extraInsCard === 'function' ? extraInsCard() : '');
}
/* ----- resumo e gerenciamento (aparecem em Meu tratamento) ----- */
const trFmtTs = t => fmtDate(isoDate(new Date(t))) + ' ' + HM(t);
function trSummaryCard() {
  const r = trResume(S.plan, Date.now(), mkTs); if (!r.ins && !r.meds && !(S.plan.checks || []).length) return '';
  const cell = (n, l) => `<div class="tc-sc"><b class="num">${n}</b><span>${l}</span></div>`;
  const nx = r.next.length ? r.next.map(x => `<span class="tag">${x.day} ${x.t} · ${esc(x.name)}</span>`).join('') : '<span class="dim">Nenhum horário confirmado pela frente.</span>';
  return `<div class="card tc-sum"><div class="eyebrow">Resumo do tratamento</div><div class="tc-sg">${cell(r.ins, 'insulinas')}${cell(r.meds, 'outros medicamentos')}${cell(r.active, 'ativos')}${cell(r.paused, 'suspensos')}</div>${r.tbd ? `<p class="hint" style="margin:8px 0 0"><b>${r.tbd}</b> item(ns) a confirmar: ainda não geram cartões nem lembretes.</p>` : ''}<p class="eyebrow" style="margin:12px 0 6px">Próximos horários</p><div class="row" style="flex-wrap:wrap;gap:6px">${nx}</div><p class="hint" style="margin:10px 0 0">${r.upd ? 'Última atualização: ' + trFmtTs(r.upd) : 'Tratamento ainda não atualizado neste aparelho.'}</p></div>`;
}
function trManageCards() {
  const log = (S.plan.log || []).slice().reverse();
  return `<h2 class="sec">Histórico e exportação</h2><div class="card pl-card"><details><summary style="min-height:44px;display:flex;align-items:center;cursor:pointer"><b>Histórico de alterações${log.length ? ' (' + log.length + ')' : ''}</b></summary>${log.length ? `<div class="stack" style="gap:6px;margin-top:8px">${log.slice(0, 40).map(h => `<div class="row" style="justify-content:space-between;gap:8px;font-size:14px"><span>${esc(h.txt)}</span><span class="dim num">${trFmtTs(h.ts)}</span></div>`).join('')}</div>` : '<p class="hint" style="margin:8px 0 0">Nenhuma alteração registrada ainda.</p>'}</details><p class="hint" style="margin:10px 0">Suspender um item não apaga as aplicações já registradas.</p><button class="btn full" data-act="tr-export">Exportar tratamento (texto)</button></div>`;
}
/* esquema vigente (Meu tratamento) ligado ao histórico de esquemas, sem duplicar dados */
function trVigenteCard() {
  const r = trResume(S.plan, Date.now(), mkTs), today = isoDate(new Date()), em = (S.schemes || []).filter(x => !x.end || x.end >= today);
  if (!r.ins && !r.meds) return '';
  const first = (S.plan.log || [])[0];
  return `<div class="card tc-vig"><div class="eyebrow">Esquema vigente · Meu tratamento</div><p style="margin:8px 0 0"><b>${r.active}</b> item(ns) ativo(s) · ${r.ins} insulina(s) · ${r.meds} outro(s) medicamento(s)</p><p class="hint" style="margin:6px 0 0">${first ? 'Primeira alteração registrada: ' + trFmtTs(first.ts) + '. ' : 'Início deste tratamento não registrado. '}${r.upd ? 'Atualizado em ' + trFmtTs(r.upd) + '.' : ''}</p>${em.length ? `<p class="hint" style="margin:6px 0 0">Esquema cadastrado em uso: <b>${esc(em[em.length - 1].name)}</b> (${fmtDate(em[em.length - 1].start)} → em uso). Os dois mostram a mesma fase, vistas de ângulos diferentes: nada é copiado.</p>` : '<p class="hint" style="margin:6px 0 0">Para comparar períodos, cadastre este tratamento como um esquema com datas (botão abaixo). Os esquemas anteriores continuam guardados.</p>'}</div>`;
}
/* ----- formulário de dose passada: lista de insulinas do tratamento ----- */
function ilOptions() {
  const l = S.plan.types.includes('insulina') ? (S.plan.insulin || []).filter(x => plActive(x)) : [];
  if (!l.length) return '<option value="basal">Basal</option><option value="fast">Rápida · Jejum</option><option value="lunch">Rápida · Antes do almoço</option><option value="dinner">Rápida · Antes do jantar</option>';
  return l.map(x => `<option value="p:${x.id}">${esc(x.name || 'Sem nome')} · ${esc(trRoleTxt(x.role))}</option>`).join('');
}
document.addEventListener('input', e => {
  const el = e.target.closest && e.target.closest('input.tr-draft'); if (el) {
    const id = el.dataset.it; S.ud['i:' + id] = el.value; const ok = trUnitsOk(el.value);
    document.querySelectorAll('[data-act="tr-now"][data-it="' + id + '"]').forEach(b => { b.disabled = !ok; b.setAttribute('aria-disabled', String(!ok)); });
    const h = document.querySelector('[data-tc-hint="' + id + '"]'); if (h) h.style.display = ok ? 'none' : '';
  }
  if (e.target.closest && e.target.closest('#ins-log-form')) trRev();
});
function trRev() {
  const box = document.getElementById('il-rev'); if (!box) return; const sel = document.getElementById('il-k');
  const nm = sel ? sel.options[sel.selectedIndex].text : '', u = parseUnits(document.getElementById('il-u').value);
  box.innerHTML = `<b>Revisão:</b> ${esc(nm)} · ${esc(document.getElementById('il-d').value)} ${esc(document.getElementById('il-t').value)} · ${typeof u === 'number' ? fU(u) : 'sem quantidade'}`;
}
/* ----- ações ----- */
let trBusy = false, trBasalAsk = '';
async function trRegister(s, ts, units) {
  const it = s.it, r = await logAdd(s.kind, ts, units); r.insId = it.id; r.name = it.name; r.insulin = it.name; if (s.time) r.slot = s.time; r.src = 'cartao'; await logPut(r);
  if (s.kind === 'basal' && (!S.ins.basalTs || ts > S.ins.basalTs)) S.ins.basalTs = ts;
  setSkip(s.key, false); if (s.kind === 'basal' && !trToday().sl.some(x => x.kind === 'basal' && skipped(x.key))) setSkip('basal', false);
  memSet(trItemKey(it), units); insSync(); await insSave();
}
document.addEventListener('click', async e => {
  const el = e.target.closest && e.target.closest('[data-act^="tr-"]'); if (!el) return; const act = el.dataset.act;
  const slot = () => trToday().sl.find(x => x.key === el.dataset.key);
  if (act === 'tr-now' || act === 'tr-more') {
    if (trBusy) return; insRoll(); const s = slot(); if (!s) return;
    if (act === 'tr-more') { delete S.ud[trItemKey(s.it)]; S.ud[trItemKey(s.it)] = ''; /* nova aplicação: pede a quantidade de novo */ el.closest('.tc').outerHTML = trCard(s, [], {}); uipScan(); return; }
    { const gt = trGate(s); if (gt && !gt.open && !trToday().as[s.key].length) { toast('Bloqueada pela condição definida em Meu tratamento: glicemia de hoje a partir de ' + gt.min + ' mg/dL.'); return; } }
    const u = parseUnits(S.ud[trItemKey(s.it)] !== undefined ? S.ud[trItemKey(s.it)] : trMemU(s.it, trToday().sl)); if (!(u > 0)) { toast('Escolha as unidades (UI) antes de confirmar.'); return; }
    if (s.kind === 'basal' && S.ins.basalTs && Date.now() - S.ins.basalTs < H24 - 3600e3 && trBasalAsk !== s.key) { trBasalAsk = s.key; el.textContent = 'Confirmar nova dose'; toast('A última basal tem menos de 23 h. Toque de novo para confirmar.'); setTimeout(() => { trBasalAsk = ''; }, 6000); return; }
    trBusy = true; try { trBasalAsk = ''; await trRegister(s, Date.now(), u); render(); toast('Aplicação registrada: ' + (s.it.name || 'insulina') + ' · ' + fU(u) + '.'); } finally { trBusy = false; }
  } else if (act === 'tr-skip') {
    insRoll(); const s = slot(); if (!s) return; const v = !skipped(s.key); setSkip(s.key, v);
    if (s.kind === 'basal') setSkip('basal', trToday().sl.some(x => x.kind === 'basal' && skipped(x.key))); await insSave(); render();
  } else if (act === 'tr-skip-ask') {
    const { sl, as } = trToday(), pend = sl.filter(s => !(as[s.key] || []).length), all = pend.length && pend.every(s => skipped(s.key));
    if (all) { pend.forEach(s => setSkip(s.key, false)); setSkip('basal', false); await insSave(); render(); toast('Pulos de hoje desfeitos.'); return; }
    openSheet(`<h2>Pular tudo hoje?</h2><p class="hint" style="margin:0 0 12px">Isto marca como <b>puladas</b> as ${pend.length} aplicações de insulina ainda pendentes hoje e silencia os lembretes de 24 h da basal até amanhã. Aplicações já registradas não mudam. Você pode desfazer a qualquer momento.</p><div class="stack"><button class="btn pri full" data-act="tr-skip-all">Sim, pular tudo hoje</button><button class="btn full" data-act="close">Cancelar</button></div>`);
  } else if (act === 'tr-skip-all') {
    insRoll(); const { sl, as } = trToday(); sl.filter(s => !(as[s.key] || []).length).forEach(s => setSkip(s.key, true)); if (sl.some(s => s.kind === 'basal')) setSkip('basal', true);
    await insSave(); closeSheet(); render(); toast('Insulinas de hoje puladas.');
  } else if (act === 'tr-time') {
    const s = slot(); if (!s) return; const u = parseUnits(S.ud[trItemKey(s.it)] !== undefined ? S.ud[trItemKey(s.it)] : trMemU(s.it, trToday().sl)); if (!(u > 0)) { toast('Escolha as unidades (UI) antes de informar o horário.'); return; }
    openSheet(`<h2>Outro horário · ${esc(s.it.name || 'insulina')}</h2><p class="hint" style="margin:0 0 10px">Hoje, ${fU(u)}. Informe a que horas a aplicação foi feita.</p><form id="tr-time-form" data-key="${s.key}" novalidate><div class="field"><label class="fl" for="tt-t">Horário</label><input class="in" id="tt-t" value="${HM(Date.now())}" data-ck="time" inputmode="numeric" autocomplete="off"></div><div class="err" id="tt-err" role="alert" style="color:var(--red-l);min-height:18px"></div><button class="btn pri full" type="submit">Salvar</button></form>`);
  } else if (act === 'tr-export') {
    const t = trExportText(S.plan, S.schemes, { fmtDate, fmtTs: trFmtTs, diabetes: typeof dbLabel === 'function' ? dbLabel(S.profile || {}) : '' });
    try { await outFile('tratamento-gluxo.txt', t); } catch (x) { toast('Não foi possível exportar.'); }
  }
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'tr-time-form') return; e.preventDefault();
  insRoll(); const s = trToday().sl.find(x => x.key === e.target.dataset.key); if (!s) { closeSheet(); return; }
  const t = parseTime($('#tt-t').value); if (!t) { $('#tt-err').textContent = 'Informe um horário válido (ex.: 21:30).'; return; }
  const ts = mkTs(isoDate(new Date()), t); if (ts > Date.now() + 60000) { $('#tt-err').textContent = 'Esse horário ainda não chegou hoje.'; return; }
  const u = parseUnits(S.ud[trItemKey(s.it)] !== undefined ? S.ud[trItemKey(s.it)] : trMemU(s.it, trToday().sl)); if (!(u > 0)) { $('#tt-err').textContent = 'Informe as unidades (UI).'; return; }
  await trRegister(s, ts, u); closeSheet(); render(); toast('Horário salvo: ' + t + '.');
});
setInterval(() => {
  document.querySelectorAll('[data-tc-cd]').forEach(el => { const ts = +el.dataset.tcCd, rem = H24 - (Date.now() - ts); el.textContent = (rem <= 0 ? '+' : '') + hms(rem); });
  document.querySelectorAll('[data-tc-bar]').forEach(el => { el.style.width = Math.min(100, (Date.now() - +el.dataset.tcBar) / H24 * 100).toFixed(1) + '%'; });
}, 1000);
