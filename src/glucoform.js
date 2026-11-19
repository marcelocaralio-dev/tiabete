/* ================= Tela de medição: cores dinâmicas por faixa =================
   Enquanto a pessoa digita a glicemia, a folha inteira troca de paleta (via variáveis de cor, ver glucoform.css):
     abaixo de 70 → vermelho fraco + alerta de hipoglicemia + atalho para o protocolo
     de 70 a 180 (inclusive) → verde
     acima de 180 → vermelho forte + alerta de glicemia acima da faixa
   Campo vazio ou valor inválido (mesma regra do botão Salvar) → visual original.
   Só apresentação: não altera valores, gravação, cálculos nem classificações do restante do app.
   Os limites desta tela são exatamente 70 e 180, em qualquer contexto (inclusive jejum). */
const GL_LOW = 70, GL_HIGH = 180;
function glBand(raw) {
  const v = parseNum(String(raw == null ? '' : raw));
  if (v === null || v < GLU_MIN || v > GLU_MAX) return null;
  return v < GL_LOW ? 'low' : v <= GL_HIGH ? 'ok' : 'high';
}
const GL_TXT = {
  low: { ic: '⚠', t: 'Hipoglicemia', d: 'Abaixo de 70 mg/dL. Siga o plano combinado com seu médico.' },
  ok: { ic: '✓', t: 'Dentro da faixa', d: 'De 70 a 180 mg/dL.' },
  high: { ic: '▲', t: 'Acima da faixa', d: 'Acima de 180 mg/dL.' }
};
let glLiveTimer = 0;
function glApply(input) {
  const sheet = input.closest('.sheet'), box = input.closest('.glu-in'); if (!sheet || !box) return;
  const band = glBand(input.value); let al = sheet.querySelector('#gl-alert'), lv = sheet.querySelector('#gl-live');
  if (!lv) { lv = document.createElement('div'); lv.id = 'gl-live'; lv.setAttribute('aria-live', 'polite'); lv.setAttribute('role', 'status'); lv.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap'; box.insertAdjacentElement('afterend', lv); }
  if (!band) { sheet.removeAttribute('data-gl'); if (al) al.remove(); lv.textContent = ''; clearTimeout(glLiveTimer); return; }
  sheet.setAttribute('data-gl', band);
  const x = GL_TXT[band];
  if (!al || al.dataset.b !== band) {
    if (al) al.remove();
    al = document.createElement('div'); al.id = 'gl-alert'; al.className = 'gl-alert gl-' + band; al.dataset.b = band;
    al.innerHTML = `<span class="gl-ic" aria-hidden="true">${x.ic}</span><div class="gl-tx"><b>${x.t}</b><span>${x.d}</span></div>` +
      (band === 'low' ? '<button type="button" class="btn sm gl-go" data-act="gl-hypo">Abrir protocolo de hipoglicemia</button>' : '');
    box.insertAdjacentElement('afterend', al);
  }
  /* leitor de tela: anuncia só depois que a pessoa para de digitar */
  clearTimeout(glLiveTimer); glLiveTimer = setTimeout(() => { lv.textContent = x.t + '. ' + x.d; }, 700);
}
document.addEventListener('input', e => { if (e.target && e.target.id === 'f-glu') glApply(e.target); });
/* chamado por openSheet(): na edição de uma medição o valor já vem preenchido */
function glInit(root) { const g = root && root.querySelector('#f-glu'); if (g) glApply(g); }

/* Protocolo de hipoglicemia aberto POR CIMA do formulário: nada do que foi preenchido se perde. */
function glHypoOver() {
  if (document.getElementById('gl-over')) return;
  const bg = document.createElement('div'); bg.className = 'sheet-bg'; bg.id = 'gl-over'; bg.style.zIndex = '45';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" tabindex="-1"><div class="grab"></div>${hypoSheet().replace('data-act="close"', 'data-act="gl-over-close"')}</div>`;
  bg.addEventListener('pointerdown', e => { if (e.target === bg) glOverClose(); });
  document.body.appendChild(bg);
  const sh = bg.querySelector('.sheet'); if (sh) sh.focus({ preventScroll: true });
}
function glOverClose() {
  const o = document.getElementById('gl-over'); if (o) o.remove();
  const b = document.querySelector('[data-act="gl-hypo"]'); if (b) b.focus({ preventScroll: true });
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act="gl-hypo"], [data-act="gl-over-close"]'); if (!el) return;
  if (el.dataset.act === 'gl-hypo') glHypoOver(); else glOverClose();
});
