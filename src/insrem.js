/* ================= Lembretes de insulina (PROMPT 22) =================
   Camada de tela e ações. A lógica pura está em insrem-core.js; o agendamento no Android, em native/insrem-native.js.
   · Usa as insulinas de "Meu tratamento" (sem cadastro duplicado) e nunca altera dose, horário ou prescrição.
   · Confirmar registra no histórico só que a pessoa informou ter aplicado (sem dose). Abrir a notificação não registra nada.
   · No Android as notificações são do sistema (tocam com o app fechado). No navegador/PWA só há aviso com o app aberto. */
S.ir = irClean(null, uid); S.irReady = false; S._irSeen = {}; window.TB_IR_ST = null;
const irNative = () => (typeof window !== 'undefined' && window.TB_IR_NATIVE) || null;
let irAdSig = null;
const irSave = async () => {
  try { await Store.put('meta', { id: 'ins-rem', value: S.ir }); } catch (e) { }
  const sg = irCoverSig(); if (irAdSig !== null && sg !== irAdSig && window.tbPlanSync) window.tbPlanSync(); irAdSig = sg; /* o conjunto de horários com lembrete próprio mudou: os alarmes antigos do tratamento saem (sem duplicar) */
};
const irLoad = v => { S.ir = irClean(v, uid); irAdSig = irCoverSig(); };
let irT = null;
function irSync(ms) { clearTimeout(irT); irT = setTimeout(() => { const n = irNative(); if (n) n.sync(); }, ms == null ? 250 : ms); }
const irCovers = id => !!(S.ir && S.ir.adopted.includes(id));
/* Um horário do tratamento é "coberto" quando existe um lembrete de insulina ligado a ele (ligado ou não): só esse lembrete responde por ele.
   Horários da mesma insulina SEM lembrete próprio continuam com o alarme do tratamento (antes ficavam sem aviso nenhum). */
const irCoversTime = (itemId, t) => !!(S.ir && S.ir.items.some(r => r.itemId === itemId && (r.src || r.time) === t));
const irCoverSig = () => S.ir.items.map(r => r.itemId + '@' + (r.src || r.time)).sort().join();
/* avisos pendentes agora, já descontando o que o histórico de insulinas mostra como aplicado */
const irDueNow = () => irDue(S.ir, S.plan, Date.now(), S.inslog);
const irName = r => irNameOf(S.plan, r);
const irById = id => S.ir.items.find(x => x.id === id);
const irRepOf = d => { const k = irDays(d).join(); return !k ? 'all' : k === '1,2,3,4,5' ? 'util' : k === '0,6' ? 'fds' : 'custom'; };
const irDaysTxt = r => { const k = irRepOf(r.days); return k === 'all' ? 'todos os dias' : k === 'util' ? 'dias úteis' : k === 'fds' ? 'fins de semana' : r.days.map(x => PL_WD[x]).join(', '); };
const irDueDay = r => { const now = Date.now(), t = mkTs(isoDate(new Date(now)), r.time); return t > now + 30 * 60000 ? isoDate(new Date(now - 864e5)) : isoDate(new Date(now)); };

/* ----- Sincronia com o tratamento ----- */
async function irAfterPlan() {
  if (!S.irReady) return;
  try {
    const res = irReconcile(S.ir, S.plan); if (res.changed) await irSave();
    irSync(400);
    if (res.notes.length) { toast(res.notes[0]); if ((S.route === 'insrem' || S.route === 'esquemas') && !document.getElementById('sheet-bg') && !/INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) render(); }
  } catch (e) { console.error(e); }
}
{ const _put = Store.put; Store.put = function (st, v) { const r = _put.apply(this, arguments); if (st === 'meta' && v && v.id === 'plan') setTimeout(irAfterPlan, 150); return r; }; }

/* ----- Fuso horário: refaz os horários se o fuso (ou o horário de verão) mudou ----- */
const irTzKey = () => { let z = ''; try { z = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { } return z + '|' + new Date().getTimezoneOffset(); };
function irTzCheck() {
  const k = irTzKey(); if (S.ir.tz === k) return; const first = !S.ir.tz; S.ir.tz = k; irSave();
  if (!first && S.ir.items.length) { const n = irNative(); if (n) n.sync(true); try { toast('O fuso horário mudou. Os horários dos lembretes de insulina foram refeitos.'); } catch (e) { } }
}
function irResume() { try { irTzCheck(); irPrune(S.ir, Date.now()); irSync(300); } catch (e) { } }
setInterval(() => { try { irTzCheck(); } catch (e) { } }, 60000);

/* ----- Aviso dentro do app (Início e central de alertas) ----- */
function irBanner() {
  if (S.route !== 'painel' && !S._acCollect) return '';
  const l = irDueNow(); S._irk = l.map(x => x.key).join(',');
  return l.slice(0, 3).map(d => {
    const tx = irText(d.r, irName(d.r), d.snoozed), a = `data-id="${esc(d.r.id)}" data-day="${d.day}"`;
    return `<div class="banner" data-occ="${esc(d.occ)}"><span><b>${esc(tx.title)}.</b> ${esc(irName(d.r))} · ${esc(irTipo(d.r))} · <span class="num">${d.r.time}</span>${d.snoozed ? ' (adiado)' : ''}</span><span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm pri" data-act="ir-confirm" ${a}>Confirmar</button><button class="btn sm" data-act="ir-open" ${a}>Adiar ou ignorar</button></span></div>`;
  }).join('');
}
/* Navegador/PWA: sem servidor só dá para avisar com a página aberta */
setInterval(() => {
  try {
    const now = Date.now(), due = irDueNow();
    if (!irNative() && typeof Notification !== 'undefined' && Notification.permission === 'granted') for (const d of due) {
      if (now - d.at > 3 * 60000) continue; const k = d.key + '|' + d.at; if (S._irSeen[k]) continue; S._irSeen[k] = 1;
      const tx = irText(d.r, irName(d.r), d.snoozed);
      try { const n = new Notification(tx.title, { body: tx.body, tag: 'tb-ir-' + d.r.id }); n.onclick = () => { try { window.focus(); } catch (e) { } go('esquemas'); openSheet(irSheet(d.r, d.day)); n.close(); }; } catch (e) { }
    }
    if (S.route === 'painel' && !document.getElementById('sheet-bg')) { const k = due.map(x => x.key).join(','); if (k !== (S._irk || '')) render(); }
  } catch (e) { }
}, 20000);

/* ----- Menu de resposta (abrir a notificação não registra nada; só as escolhas abaixo agem) ----- */
function irSheet(r, day) {
  const tx = irText(r, irName(r)), a = `data-id="${esc(r.id)}" data-day="${esc(day)}"`;
  return `<h2>${esc(tx.title)}</h2><p class="hint" style="margin:0 0 12px"><b>${esc(irName(r))}</b> · ${esc(irTipo(r))} · programada para <b class="num">${r.time}</b>.</p>
  <div class="stack" style="gap:8px"><button class="btn pri full" data-act="ir-confirm" ${a}>Confirmar que apliquei</button>
  <div class="row" style="gap:8px;flex-wrap:nowrap">${IR_SNOOZE.map(m => `<button class="btn" style="flex:1" data-act="ir-snooze" ${a} data-m="${m}">Adiar ${m} min</button>`).join('')}</div>
  <button class="btn full" data-act="ir-ignore" ${a}>Ignorar este lembrete</button><button class="btn full" data-act="ir-treat">Abrir meu tratamento</button></div>
  <p class="hint" style="margin:12px 0 0">“Confirmar” registra no histórico só que você informou ter aplicado. A dose não é preenchida: se quiser, informe as unidades depois no histórico. Abrir este aviso não registra nada.</p>`;
}
function irNativeClear(r) { const n = irNative(); if (n) n.clear(r.id); irSync(150); }
/* Confirmar a aplicação (bolha, faixa, notificação do Android). É a MESMA ação lógica de registrar em Meu tratamento: se o histórico já tem essa
   aplicação (feita em qualquer tela), só reconhece; senão cria exatamente um registro, ligado à ocorrência, e toques repetidos não criam outro. */
async function irConfirm(rid, day) {
  const r = irById(rid); if (!r) { closeSheet(); toast('Este lembrete não existe mais.'); return false; }
  day = day || irDueDay(r); const key = irKey(day, rid, r.time), occ = irOccId(key);
  if (S.ir.state[key] === 'done') { closeSheet(); toast('Esta aplicação já foi confirmada.'); return false; }
  const have = irMatched(S.ir, S.plan, Date.now(), S.inslog)[occ];
  if (have) { closeSheet(); render(); toast('Esta aplicação já estava registrada no histórico (' + HM(have.ts) + '). Nada foi duplicado.'); irNativeClear(r); return false; }
  const name = irName(r), kind = irLogKind(r), res = await doseConfirm({ kind, name, occ, rem: r.id, sched: r.time, insulin: name, insId: r.itemId || '', src: 'lembrete' });
  if (res.dup && !res.rec) return false; /* outro toque do mesmo aviso ainda está registrando */
  S.ir.state[key] = 'done';
  await irSave(); irNativeClear(r); closeSheet(); render();
  toast(res.dup ? 'Esta aplicação já estava registrada. Nada foi duplicado.' : 'Aplicação confirmada e registrada no histórico. A dose não foi preenchida.'); return !res.dup;
}
async function irSnoozeDo(rid, day, m) {
  const r = irById(rid); if (!r || !IR_SNOOZE.includes(m)) return; day = day || irDueDay(r);
  S.ir.state[irKey(day, rid, r.time)] = { snooze: Date.now() + m * 60000 }; await irSave(); irNativeClear(r); closeSheet(); render(); toast('Lembrete adiado por ' + m + ' minutos.');
}
async function irIgnoreDo(rid, day) {
  const r = irById(rid); if (!r) return; day = day || irDueDay(r);
  S.ir.state[irKey(day, rid, r.time)] = 'ignored'; await irSave(); irNativeClear(r); closeSheet(); render(); toast('Lembrete ignorado. Nada foi registrado.');
}
/* ação tocada na própria notificação do Android (chamada por native/insrem-native.js) */
async function irNotifAction(actionId, x) {
  const r = irById(x && x.rid);
  if (!r) { go('esquemas'); toast('Este lembrete não existe mais.'); return; }
  if (actionId === 'confirm') { go('esquemas'); await irConfirm(r.id, irDueDay(r)); return; }
  go('esquemas'); if (actionId === 'open') return;
  openSheet(irSheet(r, irDueDay(r)));
}
window.irFlushQueue = () => { const q = window.__irQ || []; window.__irQ = []; q.forEach(([a, x]) => { try { irNotifAction(a, x); } catch (e) { console.error(e); } }); };

/* ----- Indicador de situação das notificações ----- */
function irStatus() {
  const n = irNative(), st = window.TB_IR_ST, b = [];
  if (n) {
    if (!st) return { lvl: 'info', t: 'Verificando as notificações do celular…', d: '', b };
    if (st.perm !== 'granted') {
      b.push(st.perm === 'prompt' ? ['ir-perm', 'Permitir notificações', 1] : ['ir-settings', 'Abrir configurações do aparelho', 1]);
      return { lvl: 'bad', t: 'Notificações desativadas', d: st.perm === 'prompt' ? 'O GLUXO ainda não tem permissão. Sem ela, os lembretes não tocam.' : 'O Android está bloqueando os avisos do GLUXO. Ative-os nas configurações para os lembretes tocarem com o app fechado.', b };
    }
    const extra = []; let lvl = 'ok', t = 'Notificações autorizadas e funcionando';
    const want = irNotifPlan(S.ir, S.plan, { quiet: plQuietAt }).length;
    if (S.ir.items.length && want && !st.pending) { lvl = 'warn'; t = 'Autorizadas, mas ainda sem avisos agendados'; extra.push('Toque em “Testar” ou abra esta tela de novo para refazer o agendamento.'); }
    else if (want) extra.push(st.pending + ' aviso' + (st.pending === 1 ? '' : 's') + ' agendado' + (st.pending === 1 ? '' : 's') + ' no celular. Tocam com o app fechado, na tela de bloqueio (conforme as regras do aparelho) e depois de reiniciar.');
    else extra.push('Nenhum lembrete de insulina ligado agora.');
    if (st.exact === 'denied') { if (lvl === 'ok') { lvl = 'warn'; t = 'Autorizadas, mas sem horário exato'; } extra.push('Sem a permissão de alarmes exatos, o Android pode atrasar os avisos em alguns minutos.'); b.push(['ir-exact', 'Permitir horários exatos', 0]); }
    if (st.battery === false) extra.push('Se o celular for Xiaomi, Samsung, Motorola ou Huawei, deixe o GLUXO “sem restrição” na bateria para não perder avisos.');
    if (st.battery === false) b.push(['ir-battery', 'Ajustar bateria', 0]);
    b.push(['ir-test', 'Testar em 10 segundos', 0]);
    return { lvl, t, d: extra.join(' '), b };
  }
  const supported = typeof Notification !== 'undefined', perm = supported ? Notification.permission : 'unsupported';
  const lim = 'Navegador e aplicativo instalado pela página (PWA) não conseguem agendar notificações para quando o app está fechado. Os avisos só aparecem com o GLUXO aberto. Para receber com o app fechado, use o aplicativo Android (APK).';
  if (!supported) return { lvl: 'warn', t: 'Este navegador não oferece notificações', d: lim, b };
  if (perm === 'granted') { b.push(['ir-test', 'Testar aviso agora', 0]); return { lvl: 'warn', t: 'Avisos do navegador ligados, só com o app aberto', d: lim, b }; }
  if (perm === 'denied') return { lvl: 'bad', t: 'Notificações bloqueadas no navegador', d: 'Libere as notificações deste site nas configurações do navegador. ' + lim, b };
  b.push(['ir-perm', 'Ativar avisos do navegador', 1]);
  return { lvl: 'warn', t: 'Avisos do navegador ainda não ativados', d: lim, b };
}
function irStatusBox() {
  const s = irStatus();
  return `<div class="ir-st ${s.lvl}" role="status"><span class="ir-dot" aria-hidden="true"></span><div><b>${esc(s.t)}</b>${s.d ? `<small>${esc(s.d)}</small>` : ''}</div></div>${s.b.length ? `<div class="stack" style="gap:8px;margin-top:12px">${s.b.map(([a, l, p]) => `<button class="btn ${p ? 'pri ' : ''}full" data-act="${a}">${esc(l)}</button>`).join('')}</div>` : ''}`;
}
async function irStatusRefresh() {
  const n = irNative(); if (n) { try { window.TB_IR_ST = await n.status(); } catch (e) { window.TB_IR_ST = { perm: 'prompt', exact: 'na', battery: null, pending: 0 }; } }
  const el = document.getElementById('ir-status'); if (el) el.innerHTML = irStatusBox();
  const sm = document.getElementById('ir-sum'); if (sm) { const i = irSumInfo(); sm.className = 'ir-st ' + i.s.lvl; const a = document.getElementById('ir-sum-t'), b = document.getElementById('ir-sum-d'); if (a) a.textContent = i.t; if (b) b.textContent = i.d; }
}

/* ----- Telas ----- */
function irRowHTML(r) {
  const st = irStatusOf(r, S.plan), eff = irActive(S.ir, r, S.plan), now = Date.now(), name = irName(r), nx = eff ? irNextShown(S.ir, r, now) : null;
  const msg = st === 'removed' ? 'Esta insulina saiu do Meu tratamento. O lembrete foi desativado: escolha outra insulina ou exclua.' : st === 'timegone' ? 'O horário mudou em Meu tratamento. Confirme o novo horário e ligue o lembrete.' : st === 'paused' ? 'O alarme desta insulina está desligado em Meu tratamento, por isso não toca.' : '';
  const quiet = eff && plQuietAt(r.time) ? ' Não toca no silêncio noturno.' : '';
  return `<div class="ir-r ${eff ? '' : 'off'}"><div class="ir-h"><label class="pl-rs"><input type="checkbox" class="swt" role="switch" data-ir-on="${esc(r.id)}" ${r.on ? 'checked' : ''} ${st === 'removed' ? 'disabled' : ''} aria-label="Lembrete de ${esc(name)} às ${r.time}"></label>
    <div class="ir-i"><div class="ir-t"><span class="num ir-tm">${r.time}</span><b>${esc(name)}</b></div><div class="ir-s"><span class="tag ${r.type === 'basal' ? 'on' : ''}">${esc(irTipo(r))}</span><span class="tag">${esc(irDaysTxt(r))}</span></div>
    <div class="ir-n">${eff ? 'Próxima notificação: <b>' + irFmtNext(nx, now) + '</b>.' + quiet : 'Sem notificação agendada.'}</div>${msg ? `<div class="ir-w">${esc(msg)}</div>` : ''}</div></div>
    <div class="ir-b"><button class="btn sm" data-act="ir-edit" data-id="${esc(r.id)}">Editar</button><button class="btn sm danger" data-act="ir-del" data-id="${esc(r.id)}">Excluir</button></div></div>`;
}
function viewInsRem() {
  const ir = S.ir, miss = irMissing(ir, S.plan), has = (S.plan.insulin || []).length; setTimeout(irStatusRefresh, 60);
  let h = banners() + `<p class="hint" style="margin:0 0 12px">Avisos de aplicação de insulina basal e rápida. As insulinas vêm de <b>Meu tratamento</b>: o app não cria cadastro novo, não sugere dose e não muda nenhum horário do tratamento.</p>`;
  h += `<h2 class="sec">Situação das notificações</h2><div class="card pl-card" id="ir-status">${irStatusBox()}</div>`;
  h += `<h2 class="sec">Lembretes cadastrados</h2><div class="card pl-card"><label class="al-l pl-sw" style="margin-top:0"><input type="checkbox" class="swt" role="switch" data-ir-master ${ir.on ? 'checked' : ''}><span><b>Lembretes de insulina ligados</b><small>Chave geral. Desligada, nenhum aviso de insulina toca.</small></span></label>
    <div class="ir-list">${ir.items.map(irRowHTML).join('') || `<p class="hint" style="margin:12px 0 0">Nenhum lembrete ainda.${has ? ' Crie a partir do seu tratamento abaixo ou toque em “Novo lembrete”.' : ''}</p>`}</div>
    ${has ? '<button class="btn full" style="margin-top:12px" data-act="ir-new">+ Novo lembrete</button>' : `<div class="banner warn" style="margin:12px 0 0"><span><b>Nenhuma insulina cadastrada.</b> Cadastre a insulina em Meu tratamento: é de lá que os lembretes buscam o nome e o tipo.</span><button class="btn sm pri" data-act="go" data-r="esquemas">Abrir Meu tratamento</button></div>`}</div>`;
  if (miss.length) h += `<h2 class="sec">Criar a partir do meu tratamento</h2><div class="card pl-card"><p class="hint" style="margin:0 0 10px">Horários que você já cadastrou em Meu tratamento e ainda não têm lembrete. Se você mudar o horário lá, o lembrete acompanha.</p><div class="stack" style="gap:8px">${miss.map(m => `<div class="ir-m"><span><b>${esc(m.it.name || 'Sem nome')}</b><small>${esc(irRoleTxt(m.it.role))} · ${m.times.join(' · ')}</small></span><button class="btn sm pri" data-act="ir-make" data-item="${esc(m.it.id)}">Criar</button></div>`).join('')}</div>${miss.length > 1 ? '<button class="btn full" style="margin-top:10px" data-act="ir-make-all">Criar todos</button>' : ''}</div>`;
  h += `<h2 class="sec">Limitações</h2><div class="card pl-card"><details class="pl-it"><summary><span class="pl-s"><b>O que pode impedir um aviso</b><small>Android, bateria, navegador</small></span></summary><div class="pl-b hint" style="line-height:1.5">
    <p style="margin:0 0 8px"><b>Aplicativo Android.</b> Usa alarmes do sistema: tocam com o app fechado, em segundo plano e depois de reiniciar o celular. Podem falhar se a permissão de notificações estiver negada, se a economia de bateria do fabricante travar o app, se o modo Não perturbe estiver ligado ou se o app for forçado a parar (abra-o uma vez para voltar). A tela de bloqueio mostra o aviso conforme as regras do aparelho.</p>
    <p style="margin:0 0 8px"><b>Fuso horário.</b> Os horários seguem o relógio do celular. Ao mudar de fuso ou de horário de verão, o GLUXO refaz os agendamentos quando é aberto; se o app ficar fechado depois da mudança, os avisos podem sair no horário antigo até a próxima abertura.</p>
    <p style="margin:0"><b>Navegador e PWA.</b> Sem servidor, o navegador não agenda notificações para quando o app está fechado. Os avisos só aparecem com o GLUXO aberto (faixa no Início e, se você permitir, notificação do navegador).</p></div></details></div>`;
  return h;
}
const irRoleTxt = role => role === 'basal' ? 'Basal' : role === 'rapida' ? 'Rápida' : role === 'mista' ? 'Pré-misturada' : 'Insulina';
function irSumInfo() {
  const n = S.ir.items.length, act = S.ir.items.filter(r => irActive(S.ir, r, S.plan)), now = Date.now(); let nx = null; for (const r of act) { const t = irNextShown(S.ir, r, now); if (t && (!nx || t < nx)) nx = t; }
  const s = irStatus(), miss = irMissing(S.ir, S.plan).length;
  return { s, t: n ? act.length + ' de ' + n + ' lembrete' + (n === 1 ? '' : 's') + ' ativo' + (act.length === 1 ? '' : 's') : 'Nenhum lembrete de insulina', d: (nx ? 'Próxima notificação: ' + irFmtNext(nx, now) + '. ' : '') + s.t + '.' + (miss ? ' ' + miss + ' insulina' + (miss === 1 ? '' : 's') + ' com horário ainda sem lembrete.' : '') };
}
function irSummaryCard() {
  const i = irSumInfo(); setTimeout(irStatusRefresh, 80);
  return `<h2 class="sec">Lembretes de insulina</h2><div class="card pl-card"><div class="ir-st ${i.s.lvl}" id="ir-sum"><span class="ir-dot" aria-hidden="true"></span><div><b id="ir-sum-t">${esc(i.t)}</b><small id="ir-sum-d">${esc(i.d)}</small></div></div>
    <button class="btn pri full" style="margin-top:12px" data-act="go" data-r="insrem">Gerenciar lembretes de insulina</button><p class="hint" style="margin:10px 0 0">Avisos de basal e rápida com confirmação da aplicação. Usam as insulinas cadastradas aqui e não mudam doses nem horários.</p></div>`;
}
/* ----- Editor ----- */
function irEditor(r, pre) {
  const lst = S.plan.insulin || [], cur = r || pre || {}, it0 = lst.find(x => x.id === cur.itemId) || lst[0], it = it0 || {}, role = irRoleType(it.role);
  const type = cur.type || role || 'rapida', time = cur.time || (it.times && it.times[0]) || '08:00', days = cur.days || (it.days || []), on = r ? r.on : true;
  const meal = type === 'rapida' ? (cur.meal !== undefined && cur.meal !== '' ? cur.meal : irMealGuess(it.name, time)) : '';
  const rep = irRepOf(days), eff = days.length ? days : [0, 1, 2, 3, 4, 5, 6], removed = r && !lst.some(x => x.id === r.itemId);
  const opts = lst.map(x => `<option value="${esc(x.id)}" data-role="${esc(x.role || '')}" ${it0 && x.id === it0.id && !removed ? 'selected' : ''}>${esc(x.name || 'Sem nome')} (${esc(irRoleTxt(x.role))})</option>`).join('');
  return `<h2>${r ? 'Editar lembrete' : 'Novo lembrete de insulina'}</h2><p class="hint" style="margin:0 0 12px">A insulina vem de Meu tratamento. Aqui você só define quando ser lembrado.</p>
  <div class="stack"><div class="field"><label class="fl" for="irf-i">Insulina</label><select class="in" id="irf-i">${removed ? '<option value="" selected>Escolha uma insulina…</option>' : ''}${opts}</select></div>
  <div class="field"><label class="fl" for="irf-ty">Tipo</label><select class="in" id="irf-ty" ${role ? 'disabled' : ''}><option value="basal" ${type === 'basal' ? 'selected' : ''}>Basal</option><option value="rapida" ${type === 'rapida' ? 'selected' : ''}>Rápida</option></select>${role ? '<small class="hint" style="display:block;margin-top:4px">O tipo segue o cadastro da insulina em Meu tratamento.</small>' : ''}</div>
  <div class="field" id="irf-mw" ${type === 'rapida' ? '' : 'hidden'}><label class="fl" for="irf-m">Refeição</label><select class="in" id="irf-m">${Object.entries(IR_MEALS).map(([k, v]) => `<option value="${k}" ${meal === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
  <div class="field"><label class="fl" for="irf-t">Horário da aplicação</label><input class="in" type="time" id="irf-t" value="${esc(time)}"></div>
  <div class="field"><label class="fl" for="irf-r">Repetição</label><select class="in" id="irf-r">${[['all', 'Todos os dias'], ['util', 'Dias úteis'], ['fds', 'Fins de semana'], ['custom', 'Personalizada']].map(([k, v]) => `<option value="${k}" ${rep === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
  <div class="field"><span class="fl">Dias da semana</span><div class="row" style="gap:6px">${PL_WD.map((w, d) => `<label class="bl-chk"><input type="checkbox" class="irf-d" data-d="${d}" ${eff.includes(d) ? 'checked' : ''}><span>${w}</span></label>`).join('')}</div></div>
  <label class="al-l pl-sw"><input type="checkbox" class="swt" role="switch" id="irf-on" ${on ? 'checked' : ''}><span><b>Lembrete ligado</b></span></label>
  <p class="err" id="irf-err" role="alert"></p><button class="btn pri full" data-act="ir-save" ${r ? `data-id="${esc(r.id)}"` : ''} ${pre && pre.src ? `data-src="${esc(pre.src)}"` : ''}>Salvar</button>${r ? `<button class="btn full danger" data-act="ir-del" data-id="${esc(r.id)}" data-sheet="1">Excluir lembrete</button>` : ''}<button class="btn full" data-act="close">Cancelar</button></div>`;
}
async function irSaveForm(el) {
  const err = m => { $('#irf-err').textContent = m; return false; }, id = el.dataset.id, itemId = $('#irf-i').value, it = (S.plan.insulin || []).find(x => x.id === itemId);
  if (!it) return err('Escolha a insulina. Se ela não estiver na lista, cadastre em Meu tratamento.');
  const time = $('#irf-t').value; if (!irTime(time)) return err('Informe um horário válido.');
  const days = [...document.querySelectorAll('.irf-d')].filter(x => x.checked).map(x => +x.dataset.d); if (!days.length) return err('Marque pelo menos um dia.');
  const role = irRoleType(it.role), type = role || $('#irf-ty').value, meal = type === 'rapida' ? $('#irf-m').value : '', dd = irDays(days);
  const clash = S.ir.items.find(x => x.id !== id && x.itemId === itemId && x.time === time && irEffDays(x).some(d => days.includes(d)));
  if (clash) return err('Já existe um lembrete desta insulina nesse horário e dia.');
  const old = id ? irById(id) : null, src = (it.times || []).includes(time) ? time : '';
  const rec = { id: old ? old.id : uid(), itemId, type, meal, time, src, days: dd, on: $('#irf-on').checked, name: (it.name || '').slice(0, 80), flag: '' };
  if (old) S.ir.items = S.ir.items.map(x => x.id === old.id ? irItem(rec, uid) : x); else S.ir.items.push(irItem(rec, uid));
  if (!S.ir.adopted.includes(itemId)) S.ir.adopted.push(itemId);
  await irSave(); irSync(150); closeSheet(); render(); toast(old ? 'Lembrete atualizado.' : 'Lembrete criado.'); return true;
}
async function irMake(itemId) {
  const m = irMissing(S.ir, S.plan).find(x => x.it.id === itemId); if (!m) return 0; const it = m.it, role = irRoleType(it.role);
  if (!role) { openSheet(irEditor(null, { itemId: it.id, time: m.times[0], src: m.times[0], days: it.days || [] })); return 0; } /* mista/outra: a pessoa escolhe o tipo */
  for (const t of m.times) S.ir.items.push(irItem({ itemId: it.id, type: role, meal: role === 'rapida' ? irMealGuess(it.name, t) : '', time: t, src: t, days: it.days || [], on: true, name: it.name }, uid));
  if (!S.ir.adopted.includes(it.id)) S.ir.adopted.push(it.id); return m.times.length;
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act^="ir-"]'); if (!el) return; const a = el.dataset.act, n = irNative();
  try {
    if (a === 'ir-open') { const r = irById(el.dataset.id); if (r) openSheet(irSheet(r, el.dataset.day)); }
    else if (a === 'ir-confirm') await irConfirm(el.dataset.id, el.dataset.day);
    else if (a === 'ir-snooze') await irSnoozeDo(el.dataset.id, el.dataset.day, +el.dataset.m);
    else if (a === 'ir-ignore') await irIgnoreDo(el.dataset.id, el.dataset.day);
    else if (a === 'ir-treat') { closeSheet(); go('esquemas'); }
    else if (a === 'ir-new') openSheet(irEditor(null, null));
    else if (a === 'ir-edit') { const r = irById(el.dataset.id); if (r) openSheet(irEditor(r)); }
    else if (a === 'ir-save') await irSaveForm(el);
    else if (a === 'ir-del') {
      const r = irById(el.dataset.id); if (!r) return;
      if (el.dataset.ask !== '1') { const t0 = el.textContent; el.dataset.ask = '1'; el.textContent = 'Toque de novo para excluir'; setTimeout(() => { if (el.isConnected) { el.dataset.ask = ''; el.textContent = t0; } }, 4000); return; }
      S.ir.items = S.ir.items.filter(x => x.id !== r.id); for (const k of Object.keys(S.ir.state)) if (irStateRid(k) === r.id) delete S.ir.state[k];
      await irSave(); if (n) n.clear(r.id); irSync(150); closeSheet(); render(); toast('Lembrete excluído.');
    }
    else if (a === 'ir-make') { const c = await irMake(el.dataset.item); if (c) { await irSave(); irSync(150); render(); toast(c + ' lembrete' + (c === 1 ? '' : 's') + ' criado' + (c === 1 ? '' : 's') + '.'); } }
    else if (a === 'ir-make-all') { let c = 0; for (const m of irMissing(S.ir, S.plan)) c += await irMake(m.it.id); if (c) { await irSave(); irSync(150); render(); toast(c + ' lembrete' + (c === 1 ? '' : 's') + ' criado' + (c === 1 ? '' : 's') + '.'); } }
    else if (a === 'ir-perm') {
      if (n) { await n.request(); irSync(100); }
      else if (typeof Notification !== 'undefined') { try { await Notification.requestPermission(); } catch (x) { } }
      await irStatusRefresh(); if (!n) { const el2 = document.getElementById('ir-status'); if (el2) el2.innerHTML = irStatusBox(); }
    }
    else if (a === 'ir-settings') { if (n) await n.openSettings(); }
    else if (a === 'ir-exact') { if (n) await n.openExact(); }
    else if (a === 'ir-battery') { if (n) await n.openBattery(); }
    else if (a === 'ir-test') {
      if (n) { const ok = await n.test(); toast(ok ? 'Teste agendado. Pode fechar o app e aguardar 10 segundos.' : 'Permita as notificações do GLUXO nas configurações do Android.'); }
      else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') { try { new Notification('Hora da insulina basal', { body: 'Teste: os avisos do navegador estão funcionando (com o app aberto).' }); } catch (x) { toast('O navegador não permitiu mostrar o aviso.'); } }
    }
  } catch (err) { console.error(err); toast('Algo deu errado: ' + (err && err.message || err)); }
});
document.addEventListener('change', async e => {
  const t = e.target; if (!t || !t.dataset && !t.id) return;
  if (t.dataset && t.dataset.irMaster !== undefined) { S.ir.on = t.checked; await irSave(); irSync(100); render(); return; }
  if (t.dataset && t.dataset.irOn) { const r = irById(t.dataset.irOn); if (!r) return; r.on = t.checked; if (t.checked && r.flag === 'timegone') r.flag = ''; await irSave(); irSync(100); render(); return; }
  if (t.id === 'irf-i') { const o = t.selectedOptions[0], role = irRoleType(o && o.dataset.role), ty = $('#irf-ty'); if (ty) { ty.disabled = !!role; if (role) ty.value = role; } const it = (S.plan.insulin || []).find(x => x.id === t.value); if (it) { const m = $('#irf-m'); if (m && ty && ty.value === 'rapida') m.value = irMealGuess(it.name, $('#irf-t').value) || m.value; if (it.times && it.times[0] && !irTime($('#irf-t').value)) $('#irf-t').value = it.times[0]; } const w = $('#irf-mw'); if (w && ty) w.hidden = ty.value !== 'rapida'; return; }
  if (t.id === 'irf-ty') { const w = $('#irf-mw'); if (w) w.hidden = t.value !== 'rapida'; return; }
  if (t.id === 'irf-r') { const set = { all: [0, 1, 2, 3, 4, 5, 6], util: [1, 2, 3, 4, 5], fds: [0, 6] }[t.value]; if (set) document.querySelectorAll('.irf-d').forEach(x => { x.checked = set.includes(+x.dataset.d); }); return; }
  if (t.classList && t.classList.contains('irf-d')) { const d = [...document.querySelectorAll('.irf-d')].filter(x => x.checked).map(x => +x.dataset.d), r = $('#irf-r'); if (r) r.value = irRepOf(d); }
});
