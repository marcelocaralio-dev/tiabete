/* ================= GLUXO · seletor de horário com relógio analógico =================
   Componente ÚNICO para todo campo <input type="time"> do app (inclusive os criados depois): abre ao tocar no campo.
   Não muda o armazenamento: grava "HH:MM" em 24 h no próprio input e dispara input/change, então as regras de cada tela continuam valendo.
   Cancelar não altera nada. A digitação continua disponível (campo "Digitar" do seletor e teclado direto no campo).
   Configuração por atributos do input: data-ck="off" (não usa o relógio), data-ck-title="Título", min/max (validados na confirmação). */
const CK_R = 100, CK_C = 120;
const CK_SEL = 'input[type="time"], input[data-ck="time"]';   /* campos nativos de horário e campos de texto marcados com data-ck="time" */
let ckSt = null;
const ckEl = id => document.getElementById(id);
function ckSvg() {
  const nums = (mode) => Array.from({ length: 12 }, (_, i) => { const n = mode === 'h' ? i + 1 : i * 5, a = (mode === 'h' ? n % 12 : i) * 30 * Math.PI / 180, x = CK_C + Math.sin(a) * 88, y = CK_C - Math.cos(a) * 88; return `<g class="ck-n" data-v="${n}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="19"/><text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle">${mode === 'h' ? n : ckP2(n)}</text></g>`; }).join('');
  return `<svg class="ck-svg" viewBox="0 0 240 240" role="presentation"><circle class="ck-face" cx="120" cy="120" r="116"/><g id="ck-hand" class="ck-hand"><line x1="120" y1="120" x2="120" y2="${CK_C - 88 + 19}"/><circle class="ck-tip" cx="120" cy="32" r="19"/></g><circle class="ck-dot" cx="120" cy="120" r="4"/><g id="ck-nums"></g><g id="ck-rest"><circle id="ck-mdot" r="4" class="ck-mdot" cx="120" cy="32" style="display:none"/></g></svg>`;
}
function ckOpen(inp) {
  if (ckSt) return; const cur = ckParse(inp.value) || ckTyped(inp.value), d = new Date(), base = cur || { h: d.getHours(), m: d.getMinutes() };
  const title = inp.dataset.ckTitle || (inp.id && document.querySelector(`label[for="${inp.id}"]`) ? document.querySelector(`label[for="${inp.id}"]`).textContent.trim() : inp.getAttribute('aria-label') || 'Horário');
  ckSt = { inp, h12: ckTo12(base.h), pm: base.h >= 12, m: base.m, mode: 'h', rot: null, orig: inp.value, prevFocus: document.activeElement };
  const bg = document.createElement('div'); bg.className = 'ck-bg'; bg.id = 'ck-bg';
  bg.innerHTML = `<div class="ck-dlg" role="dialog" aria-modal="true" aria-labelledby="ck-ttl"><div class="ck-ttl" id="ck-ttl">${esc(title)}</div>
  <div class="ck-top" role="group" aria-label="Horário selecionado"><button type="button" class="ck-hm" id="ck-bh" data-ck="h" aria-label="Horas"></button><span class="ck-sep" aria-hidden="true">:</span><button type="button" class="ck-hm" id="ck-bm" data-ck="m" aria-label="Minutos"></button>
    <div class="ck-ap" role="group" aria-label="Período"><button type="button" id="ck-am" data-ck="am">AM</button><button type="button" id="ck-pm" data-ck="pm">PM</button></div></div>
  <div class="ck-step" id="ck-step" aria-live="polite"></div>
  <div class="ck-dial" id="ck-dial" tabindex="0" role="slider" aria-orientation="vertical" aria-label="Relógio" aria-valuemin="0" aria-valuemax="59">${ckSvg()}</div>
  <div class="ck-typ"><label for="ck-in">Digitar</label><input class="in" id="ck-in" inputmode="numeric" autocomplete="off" placeholder="HH:MM" maxlength="5"></div><div class="ck-err" id="ck-err" role="alert"></div>
  <div class="ck-act"><button type="button" class="btn" data-ck="cancel">Cancelar</button><button type="button" class="btn pri" data-ck="ok">Confirmar</button></div></div>`;
  document.body.appendChild(bg); ckDraw(true); ckEl('ck-dial').focus({ preventScroll: true });
}
function ckVal24() { return ckTo24(ckSt.h12, ckSt.pm); }
function ckDraw(init) {
  const s = ckSt; if (!s) return; const h = s.mode === 'h';
  ckEl('ck-bh').textContent = ckP2(ckVal24()); ckEl('ck-bm').textContent = ckP2(s.m);
  ckEl('ck-bh').classList.toggle('on', h); ckEl('ck-bm').classList.toggle('on', !h); ckEl('ck-bh').setAttribute('aria-pressed', h); ckEl('ck-bm').setAttribute('aria-pressed', !h);
  ckEl('ck-am').classList.toggle('on', !s.pm); ckEl('ck-pm').classList.toggle('on', s.pm); ckEl('ck-am').setAttribute('aria-pressed', !s.pm); ckEl('ck-pm').setAttribute('aria-pressed', s.pm);
  ckEl('ck-step').textContent = h ? 'Etapa 1 de 2 · escolha a hora' : 'Etapa 2 de 2 · escolha os minutos';
  const g = ckEl('ck-nums'), want = s.mode; if (g.dataset.m !== want) { g.dataset.m = want; g.innerHTML = ''; const t = document.createElement('div'); t.innerHTML = `<svg>${ckSvgNums(want)}</svg>`; [...t.firstChild.childNodes].forEach(n => g.appendChild(n)); g.classList.remove('ck-fade'); void g.getBoundingClientRect(); g.classList.add('ck-fade'); }
  const sel = h ? s.h12 : s.m; g.querySelectorAll('.ck-n').forEach(n => { const v = +n.dataset.v, on = h ? v === s.h12 : v === s.m; n.classList.toggle('sel', on); });
  const ang = h ? ckAngleHour(s.h12) : ckAngleMin(s.m); let r = s.rot == null ? ang : s.rot; r += ((ang - r) % 360 + 540) % 360 - 180; s.rot = r;
  const hand = ckEl('ck-hand'); hand.style.transition = init ? 'none' : ''; hand.style.transform = `rotate(${r}deg)`;
  const md = ckEl('ck-mdot'); const off5 = !h && s.m % 5 !== 0; md.style.display = off5 ? '' : 'none'; hand.classList.toggle('ck-between', off5);
  const dial = ckEl('ck-dial'); dial.setAttribute('aria-valuenow', sel); dial.setAttribute('aria-valuetext', (h ? 'Hora ' : 'Minuto ') + (h ? ckVal24() : s.m) + ', horário ' + ckFmt(ckVal24(), s.m));
  const inp = ckEl('ck-in'); if (document.activeElement !== inp) inp.value = ckFmt(ckVal24(), s.m);
  ckEl('ck-err').textContent = '';
}
function ckSvgNums(mode) { return Array.from({ length: 12 }, (_, i) => { const n = mode === 'h' ? i + 1 : i * 5, a = (mode === 'h' ? n % 12 : i) * 30 * Math.PI / 180, x = CK_C + Math.sin(a) * 88, y = CK_C - Math.cos(a) * 88; return `<g class="ck-n" data-v="${n}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="19"/><text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle">${mode === 'h' ? n : ckP2(n)}</text></g>`; }).join(''); }
function ckClose(restore) { const s = ckSt; if (!s) return; ckSt = null; const b = ckEl('ck-bg'); if (b) b.remove(); if (restore) { try { s.prevFocus && s.prevFocus.focus({ preventScroll: true }); } catch (e) { } } }
function ckConfirm() {
  const s = ckSt; if (!s) return; const h = ckVal24(), v = ckFmt(h, s.m), inp = s.inp;
  if (inp.min && v < inp.min.slice(0, 5) || inp.max && v > inp.max.slice(0, 5)) { ckEl('ck-err').textContent = 'Escolha um horário entre ' + (inp.min || '00:00') + ' e ' + (inp.max || '23:59') + '.'; return; }
  ckClose(true); if (inp.value !== v) { inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); }
}
function ckFromPoint(e) {
  const s = ckSt, r = ckEl('ck-dial').querySelector('.ck-svg').getBoundingClientRect(), a = ckAngle(e.clientX, e.clientY, r.left + r.width / 2, r.top + r.height / 2);
  if (s.mode === 'h') s.h12 = ckHourFromAngle(a); else s.m = ckMinFromAngle(a); ckDraw();
}
let ckDrag = false;
document.addEventListener('pointerdown', e => { const d = e.target.closest && e.target.closest('#ck-dial'); if (!d || !ckSt) return; ckDrag = true; try { d.setPointerCapture(e.pointerId); } catch (x) { } ckEl('ck-hand').style.transition = 'none'; ckFromPoint(e); e.preventDefault(); });
document.addEventListener('pointermove', e => { if (ckDrag && ckSt) ckFromPoint(e); });
document.addEventListener('pointerup', e => { if (!ckDrag) return; ckDrag = false; if (!ckSt) return; ckEl('ck-hand').style.transition = ''; if (ckSt.mode === 'h') { ckSt.mode = 'm'; ckDraw(); } else ckDraw(); });
document.addEventListener('pointercancel', () => { ckDrag = false; });
document.addEventListener('click', e => {
  const t = e.target; if (!t.closest) return;
  const b = t.closest('[data-ck]');
  if (ckSt && b && ckEl('ck-bg') && ckEl('ck-bg').contains(b)) { const a = b.dataset.ck;
    if (a === 'cancel') ckClose(true); else if (a === 'ok') ckConfirm(); else if (a === 'h' || a === 'm') { ckSt.mode = a; ckDraw(); } else if (a === 'am' || a === 'pm') { ckSt.pm = a === 'pm'; ckDraw(); } return; }
  if (ckSt && t.id === 'ck-bg') { ckClose(true); return; }
  const inp = t.closest(CK_SEL); if (inp && !inp.disabled && !inp.readOnly && inp.dataset.ck !== 'off' && !ckSt) { e.preventDefault(); inp.blur(); ckOpen(inp); }
}, true);
document.addEventListener('mousedown', e => { const i = e.target.closest && e.target.closest(CK_SEL); if (i && !i.disabled && !i.readOnly && i.dataset.ck !== 'off') e.preventDefault(); }, true);
document.addEventListener('keydown', e => {
  if (ckSt) {
    const inp = ckEl('ck-in'), typing = document.activeElement === inp;
    if (e.key === 'Escape') { e.preventDefault(); ckClose(true); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (typing) { const p = ckTyped(inp.value); if (!p) { ckEl('ck-err').textContent = 'Use HH:MM, de 00:00 a 23:59.'; return; } ckSt.h12 = ckTo12(p.h); ckSt.pm = p.h >= 12; ckSt.m = p.m; } ckConfirm(); return; }
    if (e.key === 'Tab') { const f = [...ckEl('ck-bg').querySelectorAll('button,input,[tabindex="0"]')].filter(x => !x.disabled), i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } return; }
    if (document.activeElement === ckEl('ck-dial')) { const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[e.key]; if (k != null) { e.preventDefault(); if (ckSt.mode === 'h') ckSt.h12 = ckStep('h', ckSt.h12, k); else ckSt.m = ckStep('m', ckSt.m, k); ckDraw(); } else if (e.key === ' ') { e.preventDefault(); ckSt.mode = ckSt.mode === 'h' ? 'm' : 'h'; ckDraw(); } }
    return;
  }
  const i = e.target; if (i && i.matches && i.matches(CK_SEL) && i.dataset.ck !== 'off' && !i.readOnly && (e.key === ' ' || (e.altKey && e.key === 'ArrowDown'))) { e.preventDefault(); ckOpen(i); }
});
document.addEventListener('input', e => { if (!ckSt || e.target.id !== 'ck-in') return; const p = ckTyped(e.target.value); if (p) { ckSt.h12 = ckTo12(p.h); ckSt.pm = p.h >= 12; ckSt.m = p.m; const f = e.target; ckDraw(); f.value = e.target.value; } });
