/* ================= Prontidão dos dados (aviso de primeiros registros) =================
   Só informa; nunca bloqueia nada e nunca inventa dados. Cada indicador tem seu próprio mínimo,
   que reaproveita as regras que o app já usa (HbA1c 30 medições em 20 dias, 3 por faixa nos gráficos etc.).
   Conta apenas registros reais (os de exemplo ficam de fora). Histórico importado vale como válido:
   se já bastar, nenhum aviso aparece. Tudo é recalculado a cada render(), então atualiza sozinho. */
const PR_KEY = 'tb-pr-off';
function prReal() { return (S.records || []).filter(r => r && !isEx(r) && typeof r.glucose === 'number' && r.date); }
function prWin(real, days, off = 0) { const to = endOfDay(addDays(Date.now(), -off)), from = startOfDay(addDays(Date.now(), -(off + days - 1))); return inRange(real, from, to); }
const prDays = rs => new Set(rs.map(r => r.date)).size;
const PR_INDS = {
  media: { name: 'Médias do período', why: 'Uma média só representa a rotina quando vem de várias medições em dias diferentes.', calc: re => { const w = prWin(re, 14); return [{ have: w.length, need: 10, u: 'medições nos últimos 14 dias' }, { have: prDays(w), need: 3, u: 'dias com medição' }]; } },
  grafico: { name: 'Gráficos de evolução', why: 'Um gráfico precisa de pontos suficientes para mostrar a direção dos valores.', calc: re => { const w = prWin(re, 30); return [{ have: w.length, need: 5, u: 'medições nos últimos 30 dias' }, { have: prDays(w), need: 2, u: 'dias com medição' }]; } },
  dia_tipico: { name: 'Dia típico', why: 'Compara os horários do dia; cada horário precisa de ao menos 4 medições.', calc: re => { let ok = 0; try { ok = typicalDay(re.filter(r => !r.noTime)).ok || 0; } catch (e) { } return [{ have: ok, need: 6, u: 'horários com 4 medições ou mais' }]; } },
  tendencia: { name: 'Tendência', why: 'A inclinação só é confiável com médias de vários dias.', calc: re => [{ have: Math.min(prDays(re), 99), need: 10, u: 'dias com medição' }, { have: re.length, need: 20, u: 'medições' }] },
  padroes: { name: 'Padrões glicêmicos', why: 'Padrões por horário e por refeição precisam de uma base de registros.', calc: re => [{ have: re.length, need: 20, u: 'medições' }, { have: prDays(re), need: 7, u: 'dias com medição' }] },
  hba1c: { name: 'Estimativa de HbA1c', why: 'A estimativa usa a média dos últimos 90 dias; poucos dados deixariam o número enganoso.', calc: re => { const w = prWin(re, 90); return [{ have: w.length, need: 30, u: 'medições nos últimos 90 dias' }, { have: prDays(w), need: 20, u: 'dias com medição' }]; } },
  comparacao: { name: 'Comparação entre períodos', why: 'Comparar exige medições nos dois períodos.', calc: re => [{ have: prWin(re, 30).length, need: 10, u: 'medições nos últimos 30 dias' }, { have: prWin(re, 30, 30).length, need: 10, u: 'medições nos 30 dias anteriores' }] }
};
const PR_CTX = {
  painel: { ttl: 'Seus indicadores estão se formando', ks: ['media', 'grafico', 'hba1c'] },
  analise: { ttl: 'Algumas análises precisam de mais registros', ks: ['media', 'grafico', 'tendencia', 'dia_tipico', 'padroes', 'comparacao', 'hba1c'] },
  relatorios: { ttl: 'O relatório fica mais completo com mais registros', ks: ['media', 'grafico', 'comparacao', 'hba1c'] },
  padroes: { ttl: 'Os padrões dependem do seu histórico', ks: ['padroes'] },
  hba1c: { ttl: 'A estimativa depende do seu histórico', ks: ['hba1c'] }
};
function prEval(k, real) {
  const parts = PR_INDS[k].calc(real).map(p => ({ ...p, miss: Math.max(0, p.need - p.have), r: Math.min(1, p.have / p.need) }));
  const ok = parts.every(p => p.miss === 0), pct = Math.min(...parts.map(p => p.r));
  return { k, name: PR_INDS[k].name, why: PR_INDS[k].why, parts, ok, pct, lim: parts.slice().sort((a, b) => a.r - b.r)[0] };
}
function prOff() { try { return JSON.parse(localStorage.getItem(PR_KEY) || '{}') || {}; } catch (e) { return {}; } }
function prSetOff(o) { try { localStorage.setItem(PR_KEY, JSON.stringify(o)); } catch (e) { } }
/* Mostra o aviso da tela ctx. Vazio quando não há o que avisar (histórico suficiente ou dispensado). */
function prNotice(ctx) {
  const C = PR_CTX[ctx]; if (!C) return '';
  const real = prReal(), hasAny = (S.records || []).length > 0;
  if (!hasAny) return ''; // sem nada, a própria tela já mostra a orientação inicial
  const ev = C.ks.map(k => prEval(k, real)), pend = ev.filter(e => !e.ok);
  if (!pend.length) return '';
  const next = pend.slice().sort((a, b) => b.pct - a.pct)[0], sig = next.k + ':' + pend.length;
  if (prOff()[ctx] === sig) return '';
  const imp = real.some(r => r.source && r.source !== 'manual'), lim = next.lim;
  const tot = real.length, miss = lim.miss;
  const intro = !tot ? 'Você ainda não tem registros próprios; os valores que aparecem são de exemplo.'
    : `Você tem <b>${tot}</b> ${tot === 1 ? 'medição registrada' : 'medições registradas'}${imp ? ' (incluindo o histórico importado)' : ''}.`;
  const need = tot && lim.have >= lim.need ? '' : `Para liberar <b>${next.name}</b>, faltam <b>${miss}</b> ${lim.u.replace(/^medições nos/, miss === 1 ? 'medição nos' : 'medições nos').replace(/^dias com medição/, miss === 1 ? 'dia com medição' : 'dias com medição')}.`;
  const recentGap = tot >= 30 && next.k === 'hba1c' ? ' Seu histórico é maior que isso, mas os dados válidos precisam estar dentro da janela recente.' : '';
  const row = e => `<li class="${e.ok ? 'ok' : ''}"><span class="pr-ic" aria-hidden="true">${e.ok ? '✓' : '○'}</span><span class="pr-t"><b>${e.name}</b>${e.ok ? ' · liberado' : ''}<small>${e.ok ? 'Já há dados suficientes.' : e.why + ' Falta: ' + e.parts.filter(p => p.miss).map(p => p.miss + ' ' + p.u.replace(/^medições nos/, 'medição(ões) nos')).join(' e ') + '.'}</small><span class="pr-mini" aria-hidden="true"><i style="width:${Math.round(e.pct * 100)}%"></i></span></span></li>`;
  const pc = Math.round(next.pct * 100);
  return `<section class="pr-card" aria-label="Aviso de registros" data-pr-ctx="${ctx}"><div class="pr-hd"><div class="pr-ey">Primeiros registros</div><button class="pr-x" data-pr="off" data-ctx="${ctx}" data-sig="${sig}" aria-label="Dispensar este aviso por enquanto" title="Dispensar por enquanto">×</button></div>
    <p class="pr-tt">${C.ttl}</p><p class="pr-tx">${intro} ${need}${recentGap} <span class="dim">Nada fica bloqueado: os números continuam aparecendo, mas só são confiáveis com dados suficientes.</span></p>
    <div class="pr-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pc}" aria-label="Progresso para liberar ${next.name}"><i style="width:${pc}%"></i></div><div class="pr-pl num">${pc}% · ${next.name}</div>
    <div class="pr-act"><button class="btn pri sm" data-act="new">Registrar glicemia</button></div>
    <details class="pr-det"><summary>O que cada indicador precisa</summary><ul class="pr-ls">${ev.map(row).join('')}</ul><p class="hint" style="margin:8px 0 0">Registros de exemplo não contam. Histórico importado conta normalmente.</p></details></section>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-pr="off"]'); if (!b) return;
  e.preventDefault(); const o = prOff(); o[b.dataset.ctx] = b.dataset.sig; prSetOff(o); render();
});
