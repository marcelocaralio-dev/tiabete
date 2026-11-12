/* ================= Alertas personalizados =================
   Condição (marcação do registro ou glicemia acima/abaixo de um valor) + momento + mensagem + frequência.
   O TiaBete NÃO calcula nem sugere doses: o texto é um lembrete escrito pelo próprio usuário, conforme o plano dele.
   A lista de avisos é sempre recalculada dos registros de hoje; apagar ou editar o registro cancela o aviso. */
S.ca = { rules: [], state: { once: {}, seen: {}, dis: {} }, seeded: false };
S._caList = [];
const caQuiet = () => { const c = alCfg(); return { on: !!c.quiet, from: c.qFrom, to: c.qTo }; };
async function caSave() { try { await Store.put('meta', { id: 'custom-alerts', value: S.ca }); } catch (e) { } }
function caLoad(v) {
  const st = (v && v.state) || {};
  S.ca = { rules: ((v && v.rules) || []).slice(0, 30).map(caClean), seeded: !!(v && v.seeded), state: { once: st.once || {}, seen: st.seen || {}, dis: st.dis || {} } };
}
function caSeed() { if (S.ca.seeded) return false; S.ca.seeded = true; if (!S.ca.rules.length) S.ca.rules.push(caClean({ ...caPresets()[0], id: 'ca-perna' })); return true; }
function caPrune() { const lim = Date.now() - 3 * 864e5; for (const k of ['seen', 'dis']) for (const x of Object.keys(S.ca.state[k])) if (S.ca.state[k][x] < lim) delete S.ca.state[k][x]; }
function caSync() {
  try { S._caList = caCompute(S.ca.rules, S.records, Date.now(), { state: S.ca.state, quiet: caQuiet() }); } catch (e) { S._caList = []; }
  try { if (typeof window.caNativeSync === 'function') window.caNativeSync(S._caList); } catch (e) { }
}
const caDue = () => { const n = Date.now(); return S._caList.filter(x => x.at <= n && n - x.at < 3 * 3600e3 && !S.ca.state.dis[x.key]); };
async function caTick() {
  const n = Date.now(); let dirty = false;
  for (const x of S._caList) if (x.at <= n && !S.ca.state.seen[x.key]) { S.ca.state.seen[x.key] = n; dirty = true; const r = S.ca.rules.find(y => y.id === x.ruleId); if (r && r.freq === 'once') S.ca.state.once[r.id] = n; }
  if (dirty) { caPrune(); await caSave(); caSync(); }
  const k = caDue().map(x => x.key).join(',');
  if (k !== (S._cak || '')) { S._cak = k; if ((S.route === 'painel' || S.route === 'alertasp') && !document.getElementById('sheet-bg') && !/INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) render(); }
}
setInterval(caTick, 30000);
(function () { const _l = loadAll; loadAll = async function () { const r = await _l.apply(this, arguments); caSync(); caTick(); return r; }; })();
function caBanner() {
  if (S.route !== 'painel') return '';
  return caDue().slice(0, 2).map(x => `<div class="banner"><span><b>${esc(x.name)}.</b> ${esc(x.body)}</span><span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm" data-act="go" data-r="alertasp">Ver</button><button class="btn sm pri" data-act="ca-ok" data-key="${esc(x.key)}">Entendi</button></span></div>`).join('');
}
/* ----- texto das regras ----- */
const CA_FREQ = { each: 'A cada vez que acontecer', daily: 'No máximo uma vez por dia', once: 'Uma única vez' };
const caTrigTxt = r => r.trig.k === 'mark' ? `Quando eu marcar “${MARKS[r.trig.mark] || MARKS_OLD[r.trig.mark] || r.trig.mark}” no registro` : r.trig.k === 'low' ? `Quando a glicemia ficar abaixo de ${r.trig.v} mg/dL` : `Quando a glicemia ficar acima de ${r.trig.v} mg/dL`;
const caWhenTxt = r => { const w = r.when; return w.t === 'after' ? `${w.min} min depois do registro` : w.t === 'time' ? `às ${w.time}` : (w.meal === 'next' ? 'Na próxima refeição' : 'No ' + (MEALS[w.meal] || w.meal).toLowerCase()) + (w.lead ? ` (${w.lead} min antes)` : ''); };
const caFmtAt = at => { const d = new Date(at), td = isoDate(new Date()), dd = isoDate(d); return (dd === td ? 'hoje' : dd === isoDate(new Date(Date.now() + 864e5)) ? 'amanhã' : fmtDate(dd).slice(0, 5)) + ' às ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
function caRuleCard(r) {
  const nx = S._caList.filter(x => x.ruleId === r.id && x.at > Date.now())[0], due = caDue().some(x => x.ruleId === r.id), done = r.freq === 'once' && S.ca.state.once[r.id];
  const status = !r.on ? '<span class="atag">Desligado</span>' : done ? '<span class="atag">Já avisou (uma vez)</span>' : '<span class="atag on">Ativo</span>';
  return `<div class="card ca-card${r.on ? '' : ' off'}"><div class="sw-row" style="padding-top:0"><div style="min-width:0"><b>${esc(r.name)}</b><div style="margin-top:4px">${status}</div></div><button class="tgl" role="switch" aria-checked="${r.on}" aria-label="${esc(r.name)}: ${r.on ? 'ligado' : 'desligado'}" data-act="ca-tgl" data-id="${esc(r.id)}"><i>${r.on ? '✓' : ''}</i></button></div>
  <div class="kv ca-kv"><div><span>Condição</span><b>${esc(caTrigTxt(r))}</b></div><div><span>Quando avisar</span><b>${esc(caWhenTxt(r))}</b></div><div><span>Frequência</span><b>${CA_FREQ[r.freq]}</b></div><div><span>Mensagem</span><b>${esc(r.msg || 'Alerta personalizado: confira sua orientação.')}</b></div></div>
  <p class="hint" style="margin:8px 0 0">${r.on ? (due ? 'Há um aviso pendente agora.' : nx ? 'Próximo aviso: <b>' + caFmtAt(nx.at) + '</b>.' : 'Nenhum aviso agendado agora. Ele aparece quando a condição acontecer nos registros de hoje.') : 'Desligado: não avisa.'}</p>
  <div class="row" style="gap:8px;margin-top:10px"><button class="btn grow" data-act="ca-edit" data-id="${esc(r.id)}">Editar</button><button class="btn danger" data-act="ca-del" data-id="${esc(r.id)}">Excluir</button></div></div>`;
}
function viewAlertasP() {
  const rules = S.ca.rules, on = rules.filter(r => r.on).length;
  let h = banners() + `<h2 class="sec">Seus alertas</h2>`;
  h += `<div class="card"><p class="hint" style="margin:0"><b>${on}</b> ${on === 1 ? 'alerta ativo' : 'alertas ativos'} de ${rules.length}. Cada alerta liga uma condição dos seus registros a um aviso com o texto que você escrever.</p><button class="btn pri full" style="margin-top:10px" data-act="ca-new">+ Novo alerta</button></div>`;
  h += rules.length ? rules.map(caRuleCard).join('') : '<div class="card"><div class="empty">Nenhum alerta ainda. Toque em “Novo alerta” ou escolha um modelo.</div></div>';
  h += `<h2 class="sec">Modelos rápidos</h2><div class="card"><p class="hint" style="margin:0 0 10px">Toque para criar um alerta já preenchido e ajuste do seu jeito.</p><div class="chips">${caPresets().map((p, i) => `<button class="chip" data-act="ca-preset" data-i="${i}">${esc(p.name)}</button>`).join('')}</div></div>`;
  h += `<h2 class="sec">Como funciona</h2><div class="card"><p class="hint" style="margin:0">• O aviso só é criado quando a condição aparece nos registros de <b>hoje</b>. Se você apagar o registro ou tirar a marcação, o aviso é cancelado.<br>• Na próxima refeição, o horário vem do seu horário habitual (a mediana dos seus últimos registros dessa refeição). Sem histórico, usa 07:00, 12:00, 16:00 e 19:00.<br>• O silêncio noturno de “Alertas e notificações” também vale aqui.<br>• Com o app aberto, o aviso aparece como faixa no Painel. No aplicativo instalado (APK), ele toca também com o app fechado, e tocar nele abre esta tela.<br>• <b>O TiaBete não calcula nem sugere doses de insulina.</b> A mensagem é um lembrete seu, conforme a orientação do seu médico. Em emergência, ligue 192 (SAMU).</p></div>`;
  return h;
}
function caForm(r, isNew) {
  const sel = (id, obj, cur) => `<select class="in" id="${id}">${Object.entries(obj).map(([k, v]) => `<option value="${k}" ${String(cur) === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
  const marks = { ...MARKS }; if (r.trig.k === 'mark' && !marks[r.trig.mark]) marks[r.trig.mark] = MARKS_OLD[r.trig.mark] || r.trig.mark;
  const tk = r.trig.k === 'mark' ? 'mark:' + r.trig.mark : r.trig.k, w = r.when;
  const trigOpts = `<optgroup label="Marcação do registro">${Object.entries(marks).map(([k, v]) => `<option value="mark:${k}" ${tk === 'mark:' + k ? 'selected' : ''}>${v}</option>`).join('')}</optgroup><optgroup label="Valor da glicemia"><option value="low" ${tk === 'low' ? 'selected' : ''}>Glicemia abaixo de…</option><option value="high" ${tk === 'high' ? 'selected' : ''}>Glicemia acima de…</option></optgroup>`;
  const wk = w.t === 'meal' ? 'meal:' + w.meal : w.t;
  const whenOpts = `<option value="meal:next" ${wk === 'meal:next' ? 'selected' : ''}>Na próxima refeição</option>${Object.entries(MEALS).map(([k, v]) => `<option value="meal:${k}" ${wk === 'meal:' + k ? 'selected' : ''}>No ${v.toLowerCase()} (hoje)</option>`).join('')}<option value="time" ${wk === 'time' ? 'selected' : ''}>Em um horário específico</option><option value="after" ${wk === 'after' ? 'selected' : ''}>Alguns minutos depois do registro</option>`;
  return `<h3 style="margin:0 0 10px">${isNew ? 'Novo alerta' : 'Editar alerta'}</h3><div class="stack" style="gap:12px" data-ca-id="${esc(r.id)}">
  <div class="field"><label class="fl" for="ca-name">Nome do alerta</label><input class="in" id="ca-name" maxlength="60" value="${esc(r.name)}"></div>
  <div class="field"><label class="fl" for="ca-trig">Condição (o que dispara)</label><select class="in" id="ca-trig">${trigOpts}</select></div>
  <div class="field" id="ca-vf" ${r.trig.k === 'mark' ? 'hidden' : ''}><label class="fl" for="ca-v">Valor (mg/dL)</label><input class="in" id="ca-v" inputmode="numeric" value="${r.trig.v || ''}"></div>
  <div class="field"><label class="fl" for="ca-when">Quando avisar</label><select class="in" id="ca-when">${whenOpts}</select></div>
  <div class="field" id="ca-lf" ${wk.startsWith('meal') ? '' : 'hidden'}><label class="fl" for="ca-lead">Antecedência</label><select class="in" id="ca-lead">${[[0, 'Na hora da refeição'], [15, '15 min antes'], [30, '30 min antes'], [60, '1 h antes']].map(([v, l]) => `<option value="${v}" ${w.lead === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="field" id="ca-tf" ${wk === 'time' ? '' : 'hidden'}><label class="fl" for="ca-time">Horário</label><input class="in" type="time" id="ca-time" value="${w.time || '12:00'}"></div>
  <div class="field" id="ca-mf" ${wk === 'after' ? '' : 'hidden'}><label class="fl" for="ca-min">Minutos depois</label><input class="in" id="ca-min" inputmode="numeric" value="${w.min || 30}"></div>
  <div class="field"><label class="fl" for="ca-freq">Frequência</label>${sel('ca-freq', CA_FREQ, r.freq)}</div>
  <div class="field"><label class="fl" for="ca-msg">Mensagem do aviso</label><textarea class="in" id="ca-msg" rows="4" maxlength="${CA_MAXMSG}" placeholder="Escreva o lembrete que quer receber">${esc(r.msg)}</textarea><p class="hint" style="margin:6px 0 0">Escreva apenas um lembrete seu. O TiaBete não define doses nem percentuais.</p></div>
  <label class="al-l pl-sw"><input type="checkbox" class="swt" role="switch" id="ca-on" ${r.on ? 'checked' : ''}><span><b>Alerta ativo</b></span></label>
  <div class="row" style="gap:8px"><button class="btn grow" data-act="ca-cancel">Cancelar</button><button class="btn pri grow" data-act="ca-save">Salvar</button></div></div>`;
}
function caRead() {
  const box = document.querySelector('[data-ca-id]'), g = id => (document.getElementById(id) || {}).value || '', tg = g('ca-trig'), wh = g('ca-when');
  return caClean({ id: box.dataset.caId, name: g('ca-name'), on: document.getElementById('ca-on').checked, trig: tg.startsWith('mark:') ? { k: 'mark', mark: tg.slice(5) } : { k: tg, v: g('ca-v') }, when: wh.startsWith('meal:') ? { t: 'meal', meal: wh.slice(5), lead: +g('ca-lead') } : wh === 'time' ? { t: 'time', time: g('ca-time') } : { t: 'after', min: g('ca-min') }, freq: g('ca-freq'), msg: g('ca-msg') });
}
document.addEventListener('change', e => {
  if (!e.target.closest('[data-ca-id]')) return;
  const tg = document.getElementById('ca-trig').value, wh = document.getElementById('ca-when').value, sh = (id, on) => { const el = document.getElementById(id); if (el) el.hidden = !on; };
  sh('ca-vf', !tg.startsWith('mark:')); sh('ca-lf', wh.startsWith('meal:')); sh('ca-tf', wh === 'time'); sh('ca-mf', wh === 'after');
  const v = document.getElementById('ca-v'); if (v && !v.value) v.value = tg === 'low' ? 70 : 250;
});
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act^="ca-"]'); if (!el) return; const act = el.dataset.act, id = el.dataset.id, find = () => S.ca.rules.find(x => x.id === id);
  const done = async msg => { await caSave(); caSync(); closeSheet(); render(); if (msg) toast(msg); };
  if (act === 'ca-new') openSheet(caForm(caClean({ name: '', trig: { k: 'mark', mark: 'perna' }, when: { t: 'meal', meal: 'next' }, freq: 'daily' }), true));
  else if (act === 'ca-preset') { if (S.ca.rules.length >= 30) { toast('Limite de 30 alertas.'); return; } openSheet(caForm(caClean(caPresets()[+el.dataset.i]), true)); }
  else if (act === 'ca-edit') { const r = find(); if (r) openSheet(caForm(r, false)); }
  else if (act === 'ca-cancel') closeSheet();
  else if (act === 'ca-save') {
    const r = caRead(); if (r.trig.k !== 'mark' && !(r.trig.v >= 20)) { toast('Informe um valor de glicemia.'); return; }
    const i = S.ca.rules.findIndex(x => x.id === r.id); if (i >= 0) S.ca.rules[i] = r; else S.ca.rules.push(r);
    if (r.freq === 'once') delete S.ca.state.once[r.id]; await done('Alerta salvo.');
  }
  else if (act === 'ca-tgl') { const r = find(); if (r) { r.on = !r.on; if (r.on) delete S.ca.state.once[r.id]; await done(r.on ? 'Alerta ligado.' : 'Alerta desligado.'); } }
  else if (act === 'ca-del') { const r = find(); if (!r) return; if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.textContent = 'Toque de novo para excluir'; setTimeout(() => { if (el.isConnected) { el.dataset.armed = ''; el.textContent = 'Excluir'; } }, 4000); return; } S.ca.rules = S.ca.rules.filter(x => x.id !== id); await done('Alerta excluído.'); }
  else if (act === 'ca-ok') { S.ca.state.dis[el.dataset.key] = Date.now(); await caSave(); caSync(); render(); }
});
