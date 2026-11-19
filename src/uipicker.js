/* ================= Contador universal de UI (roleta de doses de insulina) =================
   Um só componente para todas as telas. Mantém um <input type="hidden"> com o mesmo id de antes,
   então quem lê o campo continua lendo texto ("8" ou "8,5"; vazio = 0 UI).
   Limite e passo vêm de S.uip (Mais → Configurações → Roleta de insulina); nada de 60 fixo no código. */
const UIP_DEFAULT_MAX = 60, UIP_ABS_MAX = 300, UIP_STEPS = [1, 0.5];
S.uip = { max: UIP_DEFAULT_MAX, step: 1 };
const uipClean = v => { v = v && typeof v === 'object' ? v : {}; const m = Math.round(+v.max); return { max: m >= 5 && m <= UIP_ABS_MAX ? m : UIP_DEFAULT_MAX, step: UIP_STEPS.includes(+v.step) ? +v.step : 1 }; };
const uipFmt = t => String(t / 10).replace('.', ',');                 /* t em décimos de UI */
const uipTenths = v => { if (v == null || v === '') return null; const n = Number(String(v).replace(',', '.')); return isFinite(n) && n >= 0 && n <= UIP_ABS_MAX ? Math.round(n * 10) : null; };
function uipValues(cur, step, max) {                                   /* grade 0..max; um valor antigo fora da grade entra exato */
  const st = Math.round(step * 10), mx = Math.round(max * 10), out = [];
  for (let t = 0; t <= mx; t += st) out.push(t);
  if (cur != null && !out.includes(cur)) { out.push(cur); out.sort((a, b) => a - b); }
  return out;
}
/* HTML do contador. id/cls/attrs são do campo original; rows: 5 (padrão) ou 3 (compacto) */
function uipHTML(o) {
  const cur = uipTenths(o.value), step = o.step || S.uip.step, max = o.max || S.uip.max, rows = o.rows === 3 ? 3 : 5;
  const val = cur == null ? '' : uipFmt(cur);
  return `<div class="uip r${rows}" data-uip data-step="${step}" data-max="${max}" data-rows="${rows}"><input type="hidden" class="uip-v ${o.cls || ''}" id="${o.id}" ${o.attrs || ''} value="${val}">
    <div class="uip-w" role="spinbutton" tabindex="0" aria-label="${esc(o.label || 'Unidades de insulina')}" aria-valuemin="0" aria-valuenow="${cur ? cur / 10 : 0}" aria-valuetext="${cur ? uipFmt(cur) : '0'} UI"><div class="uip-l"></div></div><i class="uip-ln a" aria-hidden="true"></i><i class="uip-ln b" aria-hidden="true"></i><span class="uip-u" aria-hidden="true">UI</span></div>`;
}
function uipInit(el) {
  if (el.dataset.r) return; el.dataset.r = '1';
  const inp = el.querySelector('input.uip-v'), w = el.querySelector('.uip-w'), list = el.querySelector('.uip-l');
  const step = +el.dataset.step || 1, max = +el.dataset.max || UIP_DEFAULT_MAX, rows = +el.dataset.rows || 5;
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  let vals = [], items = [], idx = 0, quiet = true, lastEmit = null, tm = 0;
  const read = () => uipTenths(desc.get.call(inp)) || 0;
  const per = () => { const n = vals.length; return n > 1 ? (w.scrollHeight - w.clientHeight) / (n - 1) : 0; };  /* distância de rolagem entre dois números (vale com zoom) */
  const paint = i => { items.forEach((it, k) => { const d = Math.abs(k - i); it.className = 'uip-i' + (d === 0 ? ' s' : d === 1 ? ' n1' : ''); }); };
  const build = cur => {
    vals = uipValues(cur, step, max);
    list.innerHTML = vals.map(t => `<div class="uip-i" data-t="${t}">${uipFmt(t)}</div>`).join(''); items = [...list.children];
    list.style.setProperty('--n', (rows - 1) / 2);
    w.setAttribute('aria-valuemax', vals[vals.length - 1] / 10);
  };
  const info = t => { w.setAttribute('aria-valuenow', t / 10); w.setAttribute('aria-valuetext', uipFmt(t) + ' UI'); };
  const place = (i, smooth) => { quiet = !smooth; paint(i); idx = i; const p = per(); if (p) w.scrollTo({ top: i * p, behavior: smooth ? 'smooth' : 'auto' }); info(vals[i]); if (!smooth) setTimeout(() => { quiet = false; }, 60); };
  const emit = (type) => { const t = vals[idx], s = t ? uipFmt(t) : ''; if (desc.get.call(inp) !== s) { desc.set.call(inp, s); } inp.dispatchEvent(new Event(type, { bubbles: true })); };
  const start = () => { const cur = read(); build(cur || null); const i = Math.max(0, vals.indexOf(cur)); lastEmit = vals[i]; place(i, false); };
  /* leitura/escrita do valor por código (ex.: outro campo preenche este) atualiza a roleta */
  Object.defineProperty(inp, 'value', { get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); const c = uipTenths(v) || 0; if (!vals.includes(c)) build(c || null); lastEmit = c; place(vals.indexOf(c), false); } });
  let raf = 0;
  w.addEventListener('scroll', () => {
    if (raf) return; raf = requestAnimationFrame(() => {
      raf = 0; const p = per(); if (!p) return;
      const i = Math.max(0, Math.min(vals.length - 1, Math.round(w.scrollTop / p)));
      if (i !== idx) { idx = i; paint(i); info(vals[i]); if (!quiet) emit('input'); }
      clearTimeout(tm); tm = setTimeout(() => { if (!quiet && vals[idx] !== lastEmit) { lastEmit = vals[idx]; emit('change'); } quiet = false; }, 140);
    });
  }, { passive: true });
  list.addEventListener('click', e => { const it = e.target.closest('.uip-i'); if (!it) return; const i = items.indexOf(it); if (i >= 0 && i !== idx) { quiet = false; w.scrollTo({ top: i * per(), behavior: 'smooth' }); } });
  w.addEventListener('keydown', e => {
    const k = e.key, big = k === 'PageUp' || k === 'PageDown'; let d = 0;
    if (k === 'ArrowUp' || k === 'PageUp') d = -1; else if (k === 'ArrowDown' || k === 'PageDown') d = 1; else if (k === 'Home') d = -1e6; else if (k === 'End') d = 1e6; else return;
    e.preventDefault(); const i = Math.max(0, Math.min(vals.length - 1, idx + d * (big ? Math.round(5 / step) : 1))); if (i !== idx) { quiet = false; w.scrollTo({ top: i * per(), behavior: 'smooth' }); }
  });
  /* mouse: arrastar com o botão pressionado (no celular a rolagem é a do próprio toque) */
  let drag = null;
  w.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button) return; drag = { y: e.clientY, s: w.scrollTop }; w.classList.add('drag'); try { w.setPointerCapture(e.pointerId); } catch (x) { } });
  w.addEventListener('pointermove', e => { if (drag) w.scrollTop = drag.s - (e.clientY - drag.y); });
  const endDrag = () => { if (!drag) return; drag = null; w.classList.remove('drag'); const p = per(); if (p) { quiet = false; w.scrollTo({ top: Math.round(w.scrollTop / p) * p, behavior: 'smooth' }); } };
  w.addEventListener('pointerup', endDrag); w.addEventListener('pointercancel', endDrag);
  /* só posiciona quando o elemento já tem tamanho (a folha pode estar abrindo) */
  const go = () => { start(); };
  if (w.clientHeight > 0) go(); else { const ro = new ResizeObserver(() => { if (w.clientHeight > 0) { ro.disconnect(); go(); } }); ro.observe(w); build(uipTenths(desc.get.call(inp)) || null); paint(Math.max(0, vals.indexOf(read()))); }
}
function uipScan(root) { (root || document).querySelectorAll('.uip:not([data-r])').forEach(uipInit); }
new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches && n.matches('.uip')) uipInit(n); else if (n.querySelector) uipScan(n); } }).observe(document.documentElement, { childList: true, subtree: true });
uipScan();

/* configuração central: Mais → Configurações → Roleta de insulina */
async function uipSave(max, step) {
  const m = Math.round(Number(String(max).replace(',', '.')));
  if (!(m >= 5 && m <= UIP_ABS_MAX)) { toast('Máximo por aplicação: informe de 5 a ' + UIP_ABS_MAX + ' Ui.'); return false; }
  S.uip = uipClean({ max: m, step: Number(step) }); await Store.put('meta', { id: 'ui-cfg', value: S.uip }); return true;
}
document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-act="uip-save"]'); if (!b) return;
  if (await uipSave($('#uip-max').value, $('#uip-step').value)) { render(); toast('Roleta salva: até ' + S.uip.max + ' Ui por aplicação.'); }
});
