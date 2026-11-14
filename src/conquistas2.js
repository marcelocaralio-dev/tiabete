/* ================= Conquistas: personalizadas + liga/desliga =================
   Dados em S.rw (meta 'rewards'), que já vai no backup:
     S.rw.cust  = [{ id, name, desc, cat, type, goal, min, lo, hi, scope, from, ic, created, u }]   conquistas criadas pelo usuário
     S.rw.off   = { hypo:1, 'c:ID':1 }                  conquistas desativadas (padrão: chaves hypo/fast/norm)
     S.rw.pause = { chave: [[dia, dia|null], …] }       períodos desativados; esses dias NÃO contam (nem somam, nem quebram a sequência)
     S.rw.got['c:ID'] = 'AAAA-MM-DD'                    data em que a personalizada foi conquistada
   Tudo é recalculado dos registros reais, então editar/excluir medições corrige o progresso. Nada aqui calcula dose. */
const CW_MAX = 30;
const CW_CATS = { glicemia: 'Glicemia', habitos: 'Hábitos', alimentacao: 'Alimentação', atividade: 'Atividade física', outra: 'Outra' };
const CW_TYPES = { seq: 'Dias seguidos dentro da condição', cont: 'Acumular medições dentro da condição', hab: 'Hábito de medir todo dia' };
const CW_SCOPES = { todas: 'Todas as medições', jejum: 'Só as de jejum', antes: 'Só as antes da refeição', depois: 'Só as depois da refeição' };
const CW_ICONS = {
  trofeu: RW_TROPHY,
  estrela: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  coracao: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  escudo: RW_INFO.hypo.ic, sol: RW_INFO.fast.ic, alvo: RW_INFO.norm.ic,
  chama: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.5 1 2 1.5 2C10 8 11 5 12 3z"/>',
  raio: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  folha: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8"/>',
  gota: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  medalha: '<circle cx="12" cy="14" r="5"/><path d="M8.5 3l3.5 6 3.5-6M12 11.5v5"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
const CW_MS = { g: 'Conquista alcançada!', fx: 'confetti', c: 30 };
const rwKeyOf = id => 'c:' + id;

/* ---------- estado ---------- */
const cwList = () => { const s = rwState(); if (!Array.isArray(s.cust)) s.cust = []; return s.cust; };
const cwFind = id => cwList().find(c => c.id === id);
const rwOn = key => !(rwState().off || {})[key];
function cwClean(c) {
  c = c || {}; const n = (x, a, b, d) => { x = Math.round(+x); return isFinite(x) && x >= a && x <= b ? x : d; }, ok = x => x === null || x === undefined || x === '' ? null : n(x, 20, 600, null);
  const type = CW_TYPES[c.type] ? c.type : 'seq'; let lo = ok(c.lo), hi = ok(c.hi);
  if (type !== 'hab' && lo == null && hi == null) lo = 70;
  if (lo != null && hi != null && lo >= hi) hi = null;
  const id = String(c.id || '').replace(/[^\w-]/g, '').slice(0, 24) || uid();
  return { id, name: String(c.name || 'Minha conquista').trim().slice(0, 40) || 'Minha conquista', desc: String(c.desc || '').trim().slice(0, 200), cat: CW_CATS[c.cat] ? c.cat : 'glicemia', type,
    goal: type === 'cont' ? n(c.goal, 1, 5000, 50) : n(c.goal, 1, 365, 7), min: n(c.min, 1, 20, 1), lo: type === 'hab' ? null : lo, hi: type === 'hab' ? null : hi, scope: CW_SCOPES[c.scope] ? c.scope : 'todas',
    from: /^\d{4}-\d{2}-\d{2}$/.test(c.from || '') ? c.from : isoDate(new Date()), ic: CW_ICONS[c.ic] ? c.ic : 'trofeu', created: +c.created || Date.now(), u: +c.u || 0 };
}
/* texto simples dos critérios (aparece no cartão, no formulário e na comemoração) */
function cwRule(c) {
  const sc = { todas: '', jejum: ' de jejum', antes: ' antes da refeição', depois: ' depois da refeição' }[c.scope] || '';
  const cond = c.lo != null && c.hi != null ? `entre ${c.lo} e ${c.hi} mg/dL` : c.lo != null ? `de ${c.lo} mg/dL ou mais` : `de até ${c.hi} mg/dL`;
  const from = `Conta a partir de ${fmtDate(c.from)}.`;
  if (c.type === 'seq') return `${c.goal} dia${c.goal > 1 ? 's' : ''} seguido${c.goal > 1 ? 's' : ''} em que todas as medições${sc} ficam ${cond}. Dia sem medição interrompe a sequência. ${from}`;
  if (c.type === 'cont') return `Registrar ${c.goal} medição${c.goal > 1 ? 'ões' : ''}${sc} ${c.goal > 1 ? 'dentro do limite' : 'dentro do limite'}: ${cond}. ${from}`;
  return `${c.goal} dia${c.goal > 1 ? 's' : ''} seguido${c.goal > 1 ? 's' : ''} com pelo menos ${c.min} medição${c.min > 1 ? 'ões' : ''}${sc} registrada${c.min > 1 ? 's' : ''} por dia. ${from}`;
}

/* ---------- pausa (desativada = não conta) ---------- */
function rwSkip(key) {
  const s = new Set(), t = dayNum(isoDate(new Date())); const iv = (rwState().pause || {})[key] || [];
  for (const [a, b] of iv) { const to = b == null ? t + 1 : b; for (let d = a; d < to && d <= t; d++) s.add(d); }
  return s;
}
const rwSkips = () => { const o = {}; for (const k of Object.keys(RW_INFO)) o[k] = rwSkip(k); return o; };
function rwSetOn(key, on) {
  const s = rwState(); s.off = s.off || {}; s.pause = s.pause || {}; const t = dayNum(isoDate(new Date())), iv = s.pause[key] = s.pause[key] || [], open = iv.find(x => x[1] == null);
  if (on) { delete s.off[key]; if (open) { if (open[0] >= t) iv.splice(iv.indexOf(open), 1); else open[1] = t; } }
  else { s.off[key] = 1; if (!open) iv.push([t, null]); }
  if (!iv.length) delete s.pause[key];
}
const rwAllKeys = () => [...Object.keys(RW_INFO), ...cwList().map(c => rwKeyOf(c.id))];

/* ---------- motor das personalizadas ---------- */
const cwRel = c => ({ jejum: r => r.context === 'jejum', antes: r => r.context === 'antes', depois: r => r.context === 'depois' }[c.scope] || (() => true));
const cwOk = (c, g) => (c.lo == null || g >= c.lo) && (c.hi == null || g <= c.hi);
function cwEval(c, records, todayIso, skip) {
  const real = (records || []).filter(r => r && r.source !== 'exemplo' && r.date && typeof r.glucose === 'number'), t = dayNum(todayIso), from = dayNum(c.from), sk = skip || new Set(), rel = cwRel(c);
  const out = { streak: 0, n: 0, seen: 0, state: 'aguardando', today: 'empty', prev: 0, brokeOn: null, cycles: 0, done: false, prog: 0, goal: c.goal };
  if (c.type === 'cont') {
    let n = 0, seen = 0;
    for (const r of real) { const d = dayNum(r.date); if (d < from || d > t || sk.has(d) || !rel(r)) continue; seen++; if (cwOk(c, r.glucose)) n++; }
    const done = n >= c.goal; return { ...out, n, seen, prog: Math.min(n, c.goal), done, state: done ? 'concluida' : n > 0 ? 'andamento' : 'aguardando' };
  }
  const byDay = new Map();
  for (const r of real) { const d = dayNum(r.date); if (d < from || d > t || sk.has(d) || !rel(r)) continue; const e = byDay.get(d) || { n: 0, bad: 0 }; e.n++; if (c.type === 'seq' && !cwOk(c, r.glucose)) e.bad++; byDay.set(d, e); }
  if (!byDay.size) return out;
  const valid = e => e && (c.type === 'seq' ? !e.bad : e.n >= c.min), first = Math.min(...byDay.keys());
  let run = 0, prev = 0, brokeOn = null, cycles = 0, seen = 0; for (const e of byDay.values()) seen += e.n;
  for (let d = first; d < t; d++) {
    if (sk.has(d)) continue;
    if (valid(byDay.get(d))) run++; else { if (run > 0) { prev = run; brokeOn = d; cycles++; } run = 0; }
  }
  const te = byDay.get(t), today = !te ? 'empty' : (c.type === 'seq' && te.bad) ? 'bad' : 'pending';
  if (today === 'bad') { if (run > 0) { prev = run; brokeOn = t; cycles++; } run = 0; }
  const done = run >= c.goal;
  return { ...out, streak: run, n: run, seen, prog: Math.min(run, c.goal), done, today, prev, brokeOn, cycles, state: run > 0 ? (done ? 'concluida' : cycles > 0 ? 'reiniciada' : 'andamento') : (prev > 0 ? 'quebrada' : 'aguardando') };
}
const cwEvalAll = () => { const today = isoDate(new Date()); return cwList().map(c => ({ c, key: rwKeyOf(c.id), on: rwOn(rwKeyOf(c.id)), e: cwEval(c, S.records, today, rwSkip(rwKeyOf(c.id))) })); };
function cwMeta(k) { if (typeof k !== 'string' || !k.startsWith('c:')) return null; const c = cwFind(k.slice(2)); return c ? { c, name: c.name, icp: CW_ICONS[c.ic] } : null; }

/* verificação contínua: chamada por rewardCheck() (extras.js) */
function cwCheck(st, q, today, canNotify) {
  let dirty = false;
  for (const x of cwEvalAll()) {
    if (!x.on) continue; const got = st.got[x.key];
    if (got && !x.e.done) { st.hist.push({ k: x.key, N: x.c.goal, date: got, brokeAt: today }); delete st.got[x.key]; dirty = true; }
    else if (!got && x.e.done && canNotify) { st.got[x.key] = today; dirty = true; q.push({ k: x.key, N: x.c.goal }); }
  }
  return dirty;
}

/* ---------- visual ---------- */
const cwSw = (key, on, name) => `<label class="cw-sw"><span>${on ? 'Ativa' : 'Desativada'}</span><input type="checkbox" class="swt" role="switch" data-act="cw-tgl" data-k="${key}" ${on ? 'checked' : ''} aria-label="${esc(name)}: ${on ? 'ativa' : 'desativada'}"></label>`;
function cwCustomCard(x) {
  const { c, e, on, key } = x, st = rwState(), got = st.got[key], pct = Math.min(100, Math.round(e.prog / c.goal * 100)), unit = c.type === 'cont' ? 'medições' : 'dias seguidos';
  const todayNote = e.today === 'pending' && c.type === 'seq' ? ' Hoje está aguardando validação: só entra quando o dia terminar.' : e.today === 'bad' ? ' Hoje já teve uma medição fora do limite.' : '';
  let prog;
  if (!on) prog = `<p class="hint" style="margin:8px 0 0">Desativada: o progresso fica pausado e nada é contado ou avisado. Os dias desativados não entram na conta quando você ligar de novo.</p>`;
  else if (!e.seen) prog = `<p class="hint" style="margin:8px 0 0">Ainda sem medições que se encaixem. A contagem começa em ${fmtDate(c.from)}.</p>`;
  else if (e.done) prog = `<p class="hint" style="margin:8px 0 0"><b style="color:var(--good)">Conquista alcançada!</b>${got ? ' Em ' + fmtDate(got) + '.' : ''}${c.type === 'cont' ? '' : ' A sequência atual é de ' + e.streak + ' dia' + (e.streak > 1 ? 's' : '') + '.'}${todayNote}</p>`;
  else prog = `<div class="rw-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${c.goal}" aria-valuenow="${e.prog}"><i style="width:${pct}%"></i></div><div class="dim" style="font-size:14px;margin-top:4px">${e.state === 'quebrada' ? `Sequência de ${e.prev} dia${e.prev > 1 ? 's' : ''} encerrada em ${fmtDate(new Date(e.brokeOn * 86400000).toISOString().slice(0, 10)).slice(0, 5)}. A nova contagem começa quando um dia for cumprido por inteiro.` : `Faltam ${c.goal - e.prog} ${c.type === 'cont' ? 'medição(ões)' : 'dia(s)'} para a meta (${e.prog} de ${c.goal}).`}${todayNote}</div>`;
  const stLbl = !on ? 'Desativada' : RW_ST[e.state];
  return `<h2 class="sec">${esc(c.name)}</h2><div class="card cw-card cw-mine${on ? '' : ' cw-off'}${on && e.done ? ' cw-done' : ''}">
    <div class="cw-top"><span class="cw-tag mine">Minha</span><span class="cw-tag">${CW_CATS[c.cat]}</span>${cwSw(key, on, c.name)}</div>
    <div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px"><div style="min-width:0">${c.desc ? `<div style="font-size:15px;overflow-wrap:anywhere">${esc(c.desc)}</div>` : ''}<div class="dim" style="font-size:14px;margin-top:2px">${esc(cwRule(c))}</div><span class="rw-st ${on ? e.state : 'aguardando'}">${stLbl}</span></div>
      <div style="text-align:right;flex:none"><div class="num" style="font-family:var(--f-display);font-size:30px;font-weight:500;line-height:1;color:${on && e.prog > 0 ? 'var(--good)' : 'var(--mut)'}">${e.prog}</div><div class="dim" style="font-size:13px">${unit}</div></div></div>${prog}
    <div class="rw-bds one">${got && e.done || got ? `<button class="rw-bd on" data-act="rw-play" data-k="${key}" data-n="${c.goal}" aria-label="${esc(c.name)}, conquistada em ${fmtDate(got)}. Toque para rever a comemoração"><span class="rw-bi">${rwSvg(CW_ICONS[c.ic], 22)}</span><b>${esc(c.name)}</b><small>${fmtDate(got).slice(0, 5)}</small></button>` : `<div class="rw-bd" aria-label="${esc(c.name)}, ainda não conquistada"><span class="rw-bi">${rwSvg(CW_ICONS[c.ic], 22)}</span><b>${esc(c.name)}</b><small>bloqueada</small></div>`}</div>
    <div class="row" style="gap:8px;margin-top:10px"><button class="btn sm" data-act="cw-edit" data-id="${esc(c.id)}">Editar</button></div></div>`;
}
function viewConquistas() {
  const st = rwState(), ev = rwEval(), cs = cwEvalAll(), stdOn = Object.keys(RW_INFO).filter(rwOn), actC = cs.filter(x => x.on);
  const nGot = stdOn.reduce((a, k) => a + RW_STEPS.filter(N => ev[k].ach[N]).length, 0) + actC.filter(x => x.e.done).length, total = stdOn.length * RW_STEPS.length + actC.length;
  const nOn = stdOn.length + actC.length, nAll = Object.keys(RW_INFO).length + cs.length;
  const std = Object.keys(RW_INFO).map(k => {
    const c = RW_INFO[k], e = ev[k], on = rwOn(k), nxt = RW_STEPS.find(N => !e.ach[N]);
    let prog;
    const todayNote = e.today === 'pending' ? ' Hoje está aguardando validação: só entra quando o dia terminar.' : e.today === 'bad' ? ' Hoje já teve uma medição fora do limite.' : '';
    if (!on) prog = `<p class="hint" style="margin:8px 0 0">Desativada: o progresso fica pausado e nada é contado ou avisado. Os dias desativados não entram na conta quando você ligar de novo.</p>`;
    else if (!e.n) prog = `<p class="hint" style="margin:6px 0 0">${k === 'fast' ? 'Ainda sem medições de jejum registradas.' : 'Ainda sem medições registradas.'}</p>`;
    else if (nxt === undefined) prog = `<p class="hint" style="margin:6px 0 0"><b style="color:var(--good)">Todas as conquistas desta categoria foram alcançadas. Excelente!</b>${todayNote}</p>`;
    else {
      const pct = Math.min(100, Math.round(e.streak / nxt * 100));
      const msg = e.state === 'quebrada' ? `Sequência de ${e.prev} dia${e.prev > 1 ? 's' : ''} encerrada em ${fmtDate(new Date(e.brokeOn * 86400000).toISOString().slice(0, 10)).slice(0, 5)}. A nova contagem começa quando um dia for cumprido por inteiro. Os selos ficam bloqueados até você conquistar de novo.${todayNote}`
        : `Faltam ${nxt - e.streak} dia${nxt - e.streak > 1 ? 's' : ''} para ${RW_LBL[nxt]}.${todayNote}`;
      prog = `<div class="rw-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${nxt}" aria-valuenow="${Math.min(e.streak, nxt)}"><i style="width:${pct}%"></i></div><div class="dim" style="font-size:14px;margin-top:4px">${msg}</div>`;
    }
    const badges = RW_STEPS.map(N => {
      const got = e.ach[N] ? (st.got[k + '-' + N] || isoDate(new Date())) : null;
      return got ? `<button class="rw-bd on" data-act="rw-play" data-k="${k}" data-n="${N}" aria-label="${RW_LBL[N]}, conquistado em ${fmtDate(got)}. Toque para rever a comemoração"><span class="rw-bi">${rwSvg(c.ic, 22)}</span><b>${RW_LBL[N]}</b><small>${fmtDate(got).slice(0, 5)}</small></button>`
        : `<div class="rw-bd" aria-label="${RW_LBL[N]}, ainda não conquistado"><span class="rw-bi">${rwSvg(c.ic, 22)}</span><b>${RW_LBL[N]}</b><small>bloqueado</small></div>`;
    }).join('');
    const stLbl = on ? RW_ST[e.state] : 'Desativada';
    return `<h2 class="sec">${c.t}</h2><div class="card cw-card${on ? '' : ' cw-off'}${on && e.state === 'concluida' ? ' cw-done' : ''}"><div class="cw-top"><span class="cw-tag std">Padrão</span>${cwSw(k, on, c.t)}</div><div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px"><div><div class="dim" style="font-size:14px">${c.d}</div><span class="rw-st ${on ? e.state : 'aguardando'}">${stLbl}</span></div><div style="text-align:right"><div class="num" style="font-family:var(--f-display);font-size:30px;font-weight:500;line-height:1;color:${on && e.streak > 0 ? 'var(--good)' : 'var(--mut)'}">${e.streak}</div><div class="dim" style="font-size:13px">${e.streak === 1 ? 'dia seguido' : 'dias seguidos'}</div></div></div>${prog}<div class="rw-bds">${badges}</div></div>`;
  }).join('');
  const master = `<div class="card cw-master"><div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><b>${nOn} de ${nAll} conquistas ativas</b><div class="dim" style="font-size:14px">${nOn === nAll ? 'Todas estão contando.' : nOn ? 'As desativadas ficam pausadas.' : 'Todas estão pausadas.'}</div></div><div class="row" style="gap:8px"><button class="btn sm" data-act="cw-all-on" ${nOn === nAll ? 'disabled' : ''}>Ativar todas</button><button class="btn sm" data-act="cw-all-off" ${nOn === 0 ? 'disabled' : ''}>Desativar todas</button></div></div></div><button class="btn pri full" data-act="cw-new" style="margin:10px 0 0">+ Criar nova conquista</button>`;
  const mine = cs.length ? cs.map(cwCustomCard).join('') : `<h2 class="sec">Minhas conquistas</h2><div class="card"><div class="empty">Você ainda não criou nenhuma. Toque em “Criar nova conquista” para escolher a sua meta.</div></div>`;
  return banners() + `<p class="hint" style="margin:0 0 12px">Marcos de 7, 14, 30 dias e 3 meses, mais as conquistas que você mesmo criar. Contam só os seus registros reais (os dados de exemplo ficam de fora). Um dia só vale depois de terminar; dia sem medição não conta e interrompe a sequência. Ao interromper, a contagem volta a zero e os selos ficam bloqueados até a conquista acontecer de novo. ${total ? (nGot ? `Você já tem <b>${nGot}</b> de ${total} conquistas ativas.` : 'Você ainda não tem conquistas ativas alcançadas — a primeira dos marcos padrão sai com 7 dias seguidos.') : 'Todas estão desativadas.'} É um incentivo baseado no que você registra, não um diagnóstico nem uma orientação de tratamento. Metas e ajustes ficam com a sua equipe médica. O aviso de comemoração pode ser ligado ou desligado em Alertas (“Avisar conquistas”).</p>${master}${std}${mine}`;
}

/* ---------- formulário (criar / editar) ---------- */
function cwForm(c, isNew) {
  const sel = (id, obj, cur) => `<select class="in" id="${id}">${Object.entries(obj).map(([k, v]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
  const cm = c.lo != null && c.hi != null ? 'both' : c.hi != null ? 'hi' : 'lo', hab = c.type === 'hab';
  return `<h3 style="margin:0 0 10px">${isNew ? 'Criar nova conquista' : 'Editar conquista'}</h3><div class="stack" style="gap:12px" data-cw-id="${esc(c.id)}" data-cw-created="${c.created}">
  <div class="field"><label class="fl" for="cw-name">Nome da conquista</label><input class="in" id="cw-name" maxlength="40" value="${isNew ? '' : esc(c.name)}" placeholder="ex.: Semana de jejum tranquilo" autofocus></div>
  <div class="field"><label class="fl" for="cw-desc">Descrição e objetivo (opcional)</label><textarea class="in" id="cw-desc" rows="2" maxlength="200" placeholder="Para que serve esta meta?">${esc(c.desc)}</textarea></div>
  <div class="field"><label class="fl" for="cw-cat">Categoria</label>${sel('cw-cat', CW_CATS, c.cat)}</div>
  <div class="field"><label class="fl" for="cw-type">Tipo de meta</label>${sel('cw-type', CW_TYPES, c.type)}</div>
  <div class="field"><label class="fl" for="cw-goal" id="cw-goal-l">${c.type === 'cont' ? 'Quantas medições' : 'Quantos dias seguidos'}</label><input class="in" id="cw-goal" inputmode="numeric" value="${c.goal}"></div>
  <div class="field" id="cw-minf" ${hab ? '' : 'hidden'}><label class="fl" for="cw-min">Mínimo de medições por dia</label><input class="in" id="cw-min" inputmode="numeric" value="${c.min}"></div>
  <div class="field"><label class="fl" for="cw-scope">Quais medições contam</label>${sel('cw-scope', CW_SCOPES, c.scope)}</div>
  <div id="cw-condf" ${hab ? 'hidden' : ''} class="stack" style="gap:12px"><div class="field"><label class="fl" for="cw-cm">Condição da glicemia</label><select class="in" id="cw-cm"><option value="lo" ${cm === 'lo' ? 'selected' : ''}>Não ficar abaixo de…</option><option value="hi" ${cm === 'hi' ? 'selected' : ''}>Não passar de…</option><option value="both" ${cm === 'both' ? 'selected' : ''}>Ficar entre…</option></select></div>
    <div class="row" style="gap:10px"><div class="field grow" id="cw-lof" ${cm === 'hi' ? 'hidden' : ''}><label class="fl" for="cw-lo">De (mg/dL)</label><input class="in" id="cw-lo" inputmode="numeric" value="${c.lo != null ? c.lo : 70}"></div><div class="field grow" id="cw-hif" ${cm === 'lo' ? 'hidden' : ''}><label class="fl" for="cw-hi">Até (mg/dL)</label><input class="in" id="cw-hi" inputmode="numeric" value="${c.hi != null ? c.hi : 180}"></div></div></div>
  <div class="field"><label class="fl" for="cw-from">Começar a contar em</label><input class="in" type="date" id="cw-from" value="${c.from}" max="${isoDate(new Date())}"></div>
  <div class="field"><span class="fl" id="cw-icl">Ícone</span><div class="cw-ics" role="radiogroup" aria-labelledby="cw-icl">${Object.keys(CW_ICONS).map(k => `<label class="cw-ic" title="${k}"><input type="radio" name="cw-ic" value="${k}" ${c.ic === k ? 'checked' : ''}><span>${rwSvg(CW_ICONS[k], 24)}</span></label>`).join('')}</div></div>
  <div class="card" style="margin:0"><div class="eyebrow">Como será desbloqueada</div><p id="cw-prev" class="hint" style="margin:6px 0 0"></p></div>
  <div class="row" style="gap:8px"><button class="btn grow" data-act="cw-cancel">Cancelar</button><button class="btn pri grow" data-act="cw-save">Salvar</button></div>
  ${isNew ? '' : '<button class="btn danger full" data-act="cw-del" data-id="' + esc(c.id) + '">Excluir</button>'}</div>`;
}
function cwRead() {
  const box = document.querySelector('[data-cw-id]'), g = id => (document.getElementById(id) || {}).value || '', type = g('cw-type'), cm = g('cw-cm'), ic = document.querySelector('input[name="cw-ic"]:checked');
  return cwClean({ id: box.dataset.cwId, created: box.dataset.cwCreated, name: g('cw-name'), desc: g('cw-desc'), cat: g('cw-cat'), type, goal: g('cw-goal'), min: g('cw-min'), scope: g('cw-scope'), from: g('cw-from'),
    lo: type !== 'hab' && cm !== 'hi' ? g('cw-lo') : null, hi: type !== 'hab' && cm !== 'lo' ? g('cw-hi') : null, ic: ic ? ic.value : 'trofeu' });
}
function cwSync() {
  const box = document.querySelector('[data-cw-id]'); if (!box) return;
  const g = id => (document.getElementById(id) || {}).value || '', type = g('cw-type'), cm = g('cw-cm'), sh = (id, on) => { const el = document.getElementById(id); if (el) el.hidden = !on; };
  sh('cw-minf', type === 'hab'); sh('cw-condf', type !== 'hab'); sh('cw-lof', cm !== 'hi'); sh('cw-hif', cm !== 'lo');
  const l = document.getElementById('cw-goal-l'); if (l) l.textContent = type === 'cont' ? 'Quantas medições' : 'Quantos dias seguidos';
  const p = document.getElementById('cw-prev'); if (p) p.textContent = cwRule(cwRead());
}
document.addEventListener('change', e => { if (e.target.closest('[data-cw-id]')) cwSync(); });
document.addEventListener('input', e => { if (e.target.closest('[data-cw-id]')) cwSync(); });
async function cwDone(msg) { await rwSave(); closeSheet(); render(); rewardSoon(); if (msg) toast(msg); }
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act^="cw-"]'); if (!el) return; const act = el.dataset.act, id = el.dataset.id;
  if (act === 'cw-new') { if (cwList().length >= CW_MAX) { toast('Limite de ' + CW_MAX + ' conquistas personalizadas.'); return; } openSheet(cwForm(cwClean({ name: '', type: 'seq', goal: 7, lo: 70 }), true)); cwSync(); }
  else if (act === 'cw-edit') { const c = cwFind(id); if (c) { openSheet(cwForm(c, false)); cwSync(); } }
  else if (act === 'cw-cancel') closeSheet();
  else if (act === 'cw-save') {
    const c = cwRead(), nm = (document.getElementById('cw-name') || {}).value || '';
    if (!nm.trim()) { toast('Dê um nome para a conquista.'); return; }
    const gl = +document.getElementById('cw-goal').value; if (!(gl >= 1)) { toast('Informe a meta (um número maior que zero).'); return; }
    if (c.type !== 'hab') { const lo = document.getElementById('cw-lo').value, hi = document.getElementById('cw-hi').value, cm = document.getElementById('cw-cm').value; if ((cm !== 'hi' && !(+lo >= 20)) || (cm !== 'lo' && !(+hi >= 20))) { toast('Informe valores de glicemia em mg/dL (de 20 a 600).'); return; } if (cm === 'both' && +lo >= +hi) { toast('O valor inicial precisa ser menor que o final.'); return; } }
    c.u = Date.now(); const L = cwList(), i = L.findIndex(x => x.id === c.id);
    if (i >= 0) L[i] = c; else { if (L.length >= CW_MAX) { toast('Limite de ' + CW_MAX + ' conquistas personalizadas.'); return; } L.push(c); }
    await cwDone(i >= 0 ? 'Conquista atualizada.' : 'Conquista criada.');
  }
  else if (act === 'cw-del') {
    if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.textContent = 'Toque de novo para excluir'; setTimeout(() => { if (el.isConnected) { el.dataset.armed = ''; el.textContent = 'Excluir'; } }, 4000); return; }
    const s = rwState(), key = rwKeyOf(id); s.cust = cwList().filter(c => c.id !== id); delete s.got[key]; if (s.off) delete s.off[key]; if (s.pause) delete s.pause[key]; if (s.hist) s.hist = s.hist.filter(h => h.k !== key); if (s.last && s.last.k === key) delete s.last;
    await cwDone('Conquista excluída.');
  }
  else if (act === 'cw-tgl') { const k = el.dataset.k; rwSetOn(k, !rwOn(k)); await rwSave(); render(); rewardSoon(); }
  else if (act === 'cw-all-on') { rwAllKeys().forEach(k => { if (!rwOn(k)) rwSetOn(k, true); }); await rwSave(); render(); rewardSoon(); toast('Todas as conquistas foram ativadas.'); }
  else if (act === 'cw-all-off') {
    if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.textContent = 'Toque de novo para desativar'; setTimeout(() => { if (el.isConnected) { el.dataset.armed = ''; el.textContent = 'Desativar todas'; } }, 4000); return; }
    rwAllKeys().forEach(k => { if (rwOn(k)) rwSetOn(k, false); }); await rwSave(); render(); toast('Todas as conquistas foram desativadas. O progresso fica pausado.');
  }
});
/* ---------- restauração de backup (chamada por applyBackupState) ---------- */
function cwRestore(r, replace) {
  const cur = rwState(), inc = (Array.isArray(r.cust) ? r.cust : []).filter(c => c && typeof c === 'object').slice(0, CW_MAX).map(cwClean);
  const offIn = r.off && typeof r.off === 'object' ? r.off : {}, pauseIn = r.pause && typeof r.pause === 'object' ? r.pause : {};
  const okIv = a => (Array.isArray(a) ? a : []).filter(x => Array.isArray(x) && Number.isInteger(x[0]) && (x[1] === null || Number.isInteger(x[1]))).slice(-60).map(x => [x[0], x[1]]);
  const validKey = k => /^(hypo|fast|norm)$/.test(k) || (k.startsWith('c:') && inc.some(c => rwKeyOf(c.id) === k));
  const fresh = new Set();
  if (replace) { cur.cust = inc; cur.off = {}; cur.pause = {}; }
  else { const L = cwList(); for (const c of inc) { const i = L.findIndex(x => x.id === c.id); if (i < 0) { if (L.length < CW_MAX) { L.push(c); fresh.add(rwKeyOf(c.id)); } } else if (c.u > (L[i].u || 0)) { L[i] = c; fresh.add(rwKeyOf(c.id)); } } }
  cur.off = cur.off || {}; cur.pause = cur.pause || {};
  const take = k => replace || fresh.has(k) || (!cur.pause[k] && !cur.off[k]); /* na mescla, o estado de uma conquista que nunca foi ligada/desligada aqui vem do backup */
  for (const k of Object.keys(offIn)) if (offIn[k] && validKey(k) && take(k)) cur.off[k] = 1;
  for (const k of Object.keys(pauseIn)) if (validKey(k) && (replace || fresh.has(k) || !cur.pause[k])) { const iv = okIv(pauseIn[k]); if (iv.length) cur.pause[k] = iv; }
  const ids = new Set(cwList().map(c => rwKeyOf(c.id)));
  for (const [k, d] of Object.entries(r.got || {})) if (/^c:[\w-]+$/.test(k) && ids.has(k) && typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && (!cur.got[k] || d < cur.got[k])) cur.got[k] = d;
}
