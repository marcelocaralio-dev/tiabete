/* ================= TiaBete · lógica pura (sem DOM) ================= */
const APP_VERSION = '0.2';
const SCHEMA_VERSION = 5;
const LIM = { vlow: 54, low: 70, high: 180, vhigh: 250 };
const FAST = { low: 70, high: 130 };  /* faixa considerada normal em jejum */
const GLU_MIN = 10, GLU_MAX = 1000;
const DAY = 86400000;
const MIN_BUCKET = 3;

const CONTEXTS = {
  jejum: 'Jejum', antes: 'Antes da refeição', depois: 'Depois da refeição',
  deitar: 'Ao deitar', madrugada: 'Madrugada', outro: 'Outro'
};
const MEALS = { cafe: 'Café da manhã', almoco: 'Almoço', jantar: 'Jantar', lanche: 'Lanche' };
const INTENSITY = { 1: 'Confortável', 2: 'Normal', 3: 'Rigorosa' };

const pad = n => String(n).padStart(2, '0');
function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function fmtDate(iso) { if (!iso) return ''; const p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
function fmtDM(ms) { const d = new Date(ms); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); }
function mkTs(date, time) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0).getTime();
}
function startOfDay(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
function endOfDay(ms) { const d = new Date(ms); d.setHours(23, 59, 59, 999); return d.getTime(); }
function addDays(ms, n) { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); }
function nowHM() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

function norm(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/* ---------- números / datas / horas (formato brasileiro e internacional) ---------- */
function parseNum(s) {
  if (s == null) return null;
  let t = String(s).trim().replace(/\s/g, '');
  if (t === '' || t === '-') return null;
  const hasC = t.includes(','), hasD = t.includes('.');
  if (hasC && hasD) {
    if (t.lastIndexOf(',') > t.lastIndexOf('.')) t = t.replace(/\./g, '').replace(',', '.');
    else t = t.replace(/,/g, '');
  } else if (hasC) {
    t = (t.match(/,/g).length > 1) ? t.replace(/,/g, '') : t.replace(',', '.');
  }
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const v = parseFloat(t);
  return isFinite(v) ? v : null;
}
function validYMD(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1) return null;
  return y + '-' + pad(m) + '-' + pad(d);
}
const MONTHS = { jan: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, set: 9, sep: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12 };
function parseDate(s) {
  if (!s) return null;
  s = String(s).trim();
  let w = norm(s).match(/^(\d{1,2})[\s-]+(?:de\s+)?([a-z]{3,9})\.?[\s-]+(?:de\s+)?(\d{4})(?!\d)/);
  if (w && MONTHS[w[2].slice(0, 3)]) return validYMD(+w[3], MONTHS[w[2].slice(0, 3)], +w[1]);
  w = norm(s).match(/^([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})(?!\d)/);
  if (w && MONTHS[w[1].slice(0, 3)]) return validYMD(+w[3], MONTHS[w[1].slice(0, 3)], +w[2]);
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?!\d)/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return validYMD(y, +m[2], +m[1]); }
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?!\d)/);
  if (m) return validYMD(+m[1], +m[2], +m[3]);
  return null;
}
function parseTime(s) {
  if (!s) return null;
  const m = String(s).trim().match(/(\d{1,2})[:h.](\d{2})(?::\d{2})?\s*([AaPp][Mm])?\s*$/);
  if (!m) return null;
  let h = +m[1]; const mi = +m[2];
  if (m[3]) { const pm = /p/i.test(m[3]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
  if (h > 23 || mi > 59) return null;
  return pad(h) + ':' + pad(mi);
}

/* ---------- CSV ---------- */
function detectDelim(text) {
  const line = text.split(/\r?\n/).find(l => l.trim()) || '';
  const c = { ',': 0, ';': 0, '\t': 0 };
  let q = false;
  for (const ch of line) { if (ch === '"') q = !q; else if (!q && ch in c) c[ch]++; }
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0] && c[Object.keys(c).sort((a, b) => c[b] - c[a])[0]] > 0
    ? Object.keys(c).sort((a, b) => c[b] - c[a])[0] : ',';
}
function parseCSV(text, delim) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c === '\r') { /* ignora */ }
      else cur += c;
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return { rows, unterminated: q };
}

/* ---------- mapeamento de colunas do mySugr ---------- */
const COLUMN_RULES = [
  ['date', h => h === 'data' || h === 'date'],
  ['time', h => h === 'horario' || h === 'hora' || h === 'time'],
  ['tags', h => h === 'etiquetas' || h === 'tags'],
  ['glucose', h => h.includes('afericao da glicemia') || (h.includes('glicemia') && h.includes('mg')) || h.includes('blood glucose')],
  ['insPen', h => h.includes('caneta')],
  ['insBasal', h => h.includes('injecao basal') || h === 'basal (u)'],
  ['insPump', h => h.includes('bomba') && !h.includes('porcentagem')],
  ['insMeal', h => h.includes('insulina (refeicao)') || h === 'insulina rapida (u)'],
  ['insCorr', h => h.includes('insulina (correcao)') || h === 'correcao (u)'],
  ['tbPct', h => h.includes('porcentagem basal')],
  ['tbMin', h => h.includes('duracao basal')],
  ['carbs', h => h.includes('carboidratos')],
  ['ctxLabel', h => h === 'contexto'],
  ['mealLabel', h => h === 'refeicao'],
  ['mealDesc', h => h.includes('descricoes de refeicoes') || h.includes('descricao de refeicao')],
  ['actMin', h => h.includes('duracao da atividade') || h === 'atividade (min)'],
  ['actInt', h => h.includes('intensidade da atividade')],
  ['actDesc', h => h.includes('descricao da atividade') || h === 'atividade'],
  ['steps', h => h === 'passos'],
  ['notes', h => h === 'nota' || h === 'notas' || h === 'observacoes'],
  ['bp', h => h.includes('pressao')],
  ['weight', h => h.includes('peso corporal')],
  ['a1c', h => h.includes('hba1c')],
  ['ketones', h => h === 'cetonas'],
  ['foodType', h => h.includes('tipo de alimento')],
  ['medication', h => h.includes('medicacao')],
  /* Localização, fuso horário, latitude e longitude são reconhecidos para serem DESCARTADOS (privacidade) */
  ['_location', h => h === 'localizacao'],
  ['_tz', h => h.includes('fuso')],
  ['_lat', h => h === 'latitude'],
  ['_lon', h => h === 'longitude']
];
function mapColumns(headerRow) {
  const map = {};
  headerRow.forEach((raw, idx) => {
    const h = norm(raw);
    for (const [key, test] of COLUMN_RULES) {
      if (!(key in map) && test(h)) { map[key] = idx; break; }
    }
  });
  return map;
}
function inferFromTags(tags) {
  const t = norm(tags); const out = {};
  if (/cafe da manha|breakfast/.test(t)) out.meal = 'cafe';
  else if (/almoco|lunch/.test(t)) out.meal = 'almoco';
  else if (/jantar|dinner/.test(t)) out.meal = 'jantar';
  else if (/lanche|snack/.test(t)) out.meal = 'lanche';
  if (/jejum|fasting/.test(t)) out.context = 'jejum';
  else if (/antes d[ao]s? (refeicao|cafe|almoco|jantar|lanche)|pre[- ]?(refeicao|prandial)|before meal/.test(t)) out.context = 'antes';
  else if (/depois d[ao]s? (refeicao|cafe|almoco|jantar|lanche)|pos[- ]?(refeicao|prandial)|after meal/.test(t)) out.context = 'depois';
  else if (/deitar|dormir|sono|bedtime/.test(t)) out.context = 'deitar';
  return out;
}
function labelToKey(obj, label) {
  const n = norm(label); if (!n) return undefined;
  return Object.keys(obj).find(k => norm(obj[k]) === n);
}
function compact(o) {
  const r = {};
  for (const k in o) { const v = o[k]; if (v !== null && v !== undefined && v !== '') r[k] = v; }
  return r;
}
function dedupKey(r) { return r.date + 'T' + r.time + '|' + r.glucose; }

/* Interpreta um CSV do mySugr. Não grava nada: só devolve o que encontrou. */
function parseMySugr(text) {
  text = String(text).replace(/^﻿/, '');
  const res = { ok: false, error: '', delim: ',', columns: [], ignoredCols: [], items: [], hba: [], ignored: [], reasons: {}, totalRows: 0, emptyRows: 0, withOtherData: 0 };
  if (!text.trim()) { res.error = 'O arquivo está vazio.'; return res; }
  const delim = detectDelim(text); res.delim = delim;
  const { rows, unterminated } = parseCSV(text, delim);
  if (unterminated) res.warning = 'O arquivo termina com um campo entre aspas sem fechamento. A última linha pode estar incompleta.';
  let hi = -1, map = null;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const m = mapColumns(rows[i]);
    if ('date' in m && ('glucose' in m || 'a1c' in m)) { hi = i; map = m; break; }
  }
  if (hi < 0) { const sn = detectSensor(rows); if (sn) return parseSensor(rows, sn, res); }
  if (hi < 0) {
    res.error = 'Não encontrei o cabeçalho do mySugr. O arquivo precisa ter as colunas "Data" e "Aferição da Glicemia (mg/dL)".';
    return res;
  }
  if (!('glucose' in map)) { res.error = 'A coluna de glicemia ("Aferição da Glicemia (mg/dL)") não foi encontrada.'; return res; }
  if (norm(rows[hi][map.glucose]).includes('mmol')) { res.error = 'Este arquivo está em mmol/L. O TiaBete trabalha em mg/dL. Exporte o CSV do mySugr com a unidade mg/dL e tente de novo.'; return res; }
  res.columns = Object.keys(map).filter(k => k[0] !== '_');
  res.ignoredCols = Object.keys(map).filter(k => k[0] === '_');
  const g = (row, k) => (k in map ? (row[map[k]] ?? '').trim() : '');
  const gn = (row, k) => parseNum(g(row, k));
  const bump = (reason, line, extra) => {
    res.reasons[reason] = (res.reasons[reason] || 0) + 1;
    if (res.ignored.length < 200) res.ignored.push({ line, reason, extra: extra || '' });
  };
  const seen = new Set();
  const data = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(c => !String(c).trim())) { res.emptyRows++; continue; }
    res.totalRows++;
    const line = i + 1;
    const rawDate = g(row, 'date');
    const date = parseDate(rawDate);
    if (!date) { bump('Data não reconhecida', line, rawDate); continue; }
    const embedded = rawDate.match(/(?:\s|T)(\d{1,2}[:h.]\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)\s*$/);
    let time = parseTime(g(row, 'time')) || (embedded ? parseTime(embedded[1]) : null);
    const glucoseRaw = g(row, 'glucose');
    const glucose = parseNum(glucoseRaw);
    const a1c = gn(row, 'a1c');
    const insulinOrCarbs = ['insPen', 'insBasal', 'insPump', 'insMeal', 'insCorr', 'carbs'].some(k => gn(row, k) > 0);
    if (glucose === null || glucose < GLU_MIN || glucose > GLU_MAX) {
      if (a1c !== null && a1c >= 3 && a1c <= 20) res.hba.push({ date, value: a1c, line });
      if (glucose === null && glucoseRaw) bump('Glicemia não numérica', line, glucoseRaw);
      else if (glucose === null) { bump('Sem glicemia', line); if (insulinOrCarbs) res.withOtherData++; }
      else bump('Glicemia fora de ' + GLU_MIN + '–' + GLU_MAX + ' mg/dL', line, glucoseRaw);
      continue;
    }
    if (a1c !== null && a1c >= 3 && a1c <= 20) res.hba.push({ date, value: a1c, line });
    const tags = g(row, 'tags');
    const inf = inferFromTags(tags);
    const rec = compact({
      date, time: time || '00:00', noTime: time ? undefined : true,
      glucose,
      tags, context: labelToKey(CONTEXTS, g(row, 'ctxLabel')) || inf.context, meal: labelToKey(MEALS, g(row, 'mealLabel')) || inf.meal,
      carbs: gn(row, 'carbs'),
      insPen: gn(row, 'insPen'), insPump: gn(row, 'insPump'),
      insMeal: gn(row, 'insMeal'), insCorr: gn(row, 'insCorr'), insBasal: gn(row, 'insBasal'),
      tbPct: gn(row, 'tbPct'), tbMin: gn(row, 'tbMin'),
      mealDesc: g(row, 'mealDesc'), foodType: g(row, 'foodType'),
      actMin: gn(row, 'actMin'), actInt: gn(row, 'actInt'), actDesc: g(row, 'actDesc'),
      steps: gn(row, 'steps'), notes: g(row, 'notes'),
      bp: g(row, 'bp'), weight: gn(row, 'weight'), ketones: g(row, 'ketones'), medication: g(row, 'medication'),
      source: 'mysugr'
    });
    rec.ts = mkTs(rec.date, rec.time);
    rec.key = dedupKey(rec);
    data.push(rec);
  }
  data.sort((a, b) => a.ts - b.ts);
  res.items = data;
  res.ok = true;
  return res;
}

/* ---------- Sensores: FreeStyle Libre (LibreView) e Dexcom Clarity ---------- */
function detectSensor(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const h = rows[i].map(norm), f = fn2 => h.findIndex(fn2);
    const ts = f(x => x.includes('device timestamp') || x.includes('carimbo de data/hora do dispositivo') || x.includes('carimbo de data e hora do dispositivo'));
    const hist = f(x => (x.includes('historic glucose') || x.includes('historico de glicose')) && !x.includes('mmol'));
    const scan = f(x => (x.includes('scan glucose') || x.includes('leitura da glicose') || x.includes('glicose de varredura')) && !x.includes('mmol'));
    const strip = f(x => (x.includes('strip glucose') || x.includes('glicose da tira')) && !x.includes('mmol'));
    if (ts >= 0 && (hist >= 0 || scan >= 0 || strip >= 0)) {
      const mm = f(x => (x.includes('historic glucose') || x.includes('scan glucose')) && x.includes('mmol'));
      return { kind: 'libre', hi: i, ts, hist, scan, strip, mmol: mm >= 0 && hist < 0 && scan < 0, ins: f(x => x.includes('rapid-acting insulin (units)') || x.includes('insulina de acao rapida (unidades)')), carbs: f(x => x.includes('carbohydrates (grams)') || x.includes('carboidratos (gramas)')), notes: f(x => x === 'notes' || x === 'notas') };
    }
    const dts = f(x => x.includes('timestamp') || x.includes('carimbo de data'));
    const et = f(x => x === 'event type' || x === 'tipo de evento');
    const gv = f(x => (x.includes('glucose value') || x.includes('valor de glicose')) && !x.includes('mmol'));
    if (dts >= 0 && et >= 0 && gv >= 0) return { kind: 'dexcom', hi: i, ts: dts, et, gv, mmol: false, ins: f(x => x.includes('insulin value') || x.includes('valor de insulina')), carbs: f(x => x.includes('carb value') || x.includes('valor de carboidratos')) };
    if (dts >= 0 && et >= 0 && h.some(x => (x.includes('glucose value') || x.includes('valor de glicose')) && x.includes('mmol'))) return { kind: 'dexcom', hi: i, mmol: true };
  }
  return null;
}
function parseSensor(rows, sn, res) {
  const name = sn.kind === 'libre' ? 'FreeStyle Libre (LibreView)' : 'Dexcom Clarity';
  if (sn.mmol) { res.error = 'Este arquivo de ' + name + ' está em mmol/L. O TiaBete trabalha em mg/dL. Exporte novamente em mg/dL.'; return res; }
  res.format = name; res.columns = ['date', 'time', 'glucose'].concat(sn.ins >= 0 ? ['insMeal'] : [], sn.carbs >= 0 ? ['carbs'] : []);
  const bump = (reason, line, extra) => { res.reasons[reason] = (res.reasons[reason] || 0) + 1; if (res.ignored.length < 200) res.ignored.push({ line, reason, extra: extra || '' }); };
  const AUTO = 'Leitura automática do sensor (a cada 5 ou 15 min; só leituras manuais entram)';
  const data = [];
  for (let i = sn.hi + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(c => !String(c).trim())) { res.emptyRows++; continue; }
    res.totalRows++; const line = i + 1, c = k => (row[k] ?? '').trim();
    const rawTs = c(sn.ts), date = parseDate(rawTs);
    if (!date) { bump('Data não reconhecida', line, rawTs); continue; }
    const m = rawTs.match(/(?:\s|T)(\d{1,2}[:h.]\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)\s*$/), time = m ? parseTime(m[1]) : null;
    let glu = null, auto = false, kind = '';
    if (sn.kind === 'libre') {
      const sv = sn.strip >= 0 ? parseNum(c(sn.strip)) : null, cv = sn.scan >= 0 ? parseNum(c(sn.scan)) : null, hv = sn.hist >= 0 ? parseNum(c(sn.hist)) : null;
      if (sv !== null) { glu = sv; kind = 'tira'; } else if (cv !== null) { glu = cv; kind = 'leitura do sensor'; } else if (hv !== null) auto = true;
    } else {
      const ev = norm(c(sn.et)), gvv = parseNum(c(sn.gv));
      if (/^(egv|glicose estimada|valor de glicose)/.test(ev) || ev === 'egv') auto = true;
      else if (/calib/.test(ev) && gvv !== null) { glu = gvv; kind = 'calibração (glicemia de dedo)'; }
    }
    if (auto) { bump(AUTO, line); continue; }
    if (glu === null) { bump('Sem glicemia', line); if ((sn.ins >= 0 && parseNum(c(sn.ins)) > 0) || (sn.carbs >= 0 && parseNum(c(sn.carbs)) > 0)) res.withOtherData++; continue; }
    if (glu < GLU_MIN || glu > GLU_MAX) { bump('Glicemia fora de ' + GLU_MIN + '–' + GLU_MAX + ' mg/dL', line, String(glu)); continue; }
    const insU = sn.ins >= 0 ? parseNum(c(sn.ins)) : null, cb = sn.carbs >= 0 ? parseNum(c(sn.carbs)) : null, nt = sn.notes >= 0 ? c(sn.notes) : '';
    const rec = compact({ date, time: time || '00:00', noTime: time ? undefined : true, glucose: glu, insMeal: insU > 0 ? insU : undefined, carbs: cb > 0 ? cb : undefined, notes: nt, tags: kind, source: sn.kind === 'libre' ? 'libre' : 'dexcom' });
    rec.ts = mkTs(rec.date, rec.time); rec.key = dedupKey(rec); data.push(rec);
  }
  data.sort((a, b) => a.ts - b.ts); res.items = data; res.ok = true;
  if (!data.length) { res.ok = false; res.error = 'Este arquivo de ' + name + ' só tem leituras automáticas do sensor. O TiaBete importa as medições manuais (leituras, tira e calibrações).'; }
  return res;
}

/* ---------- estatísticas ---------- */
const highOf = r => (r && r.context === 'jejum') ? FAST.high : LIM.high;
function bandOf(v, ctx) {
  const hi = ctx === 'jejum' ? FAST.high : LIM.high;
  if (v < LIM.vlow) return { k: 'vlow', sym: '▼▼', txt: 'Muito baixa' };
  if (v < LIM.low) return { k: 'low', sym: '▼', txt: 'Baixa' };
  if (v <= hi) return { k: 'ok', sym: '●', txt: 'Dentro da faixa' };
  if (v <= LIM.vhigh) return { k: 'high', sym: '▲', txt: 'Elevada' };
  return { k: 'vhigh', sym: '▲▲', txt: 'Muito elevada' };
}
const BAND_LIST = [
  { k: 'vlow', label: '< 54', name: 'Muito baixa' },
  { k: 'low', label: '54–69', name: 'Baixa' },
  { k: 'ok', label: '70–180', name: 'Dentro da faixa' },
  { k: 'high', label: '181–250', name: 'Elevada' },
  { k: 'vhigh', label: '> 250', name: 'Muito elevada' }
];
function stats(arr) {
  const n = arr.length;
  if (!n) return { n: 0, mean: null, min: null, max: null, sd: null, hypo: 0, hyper: 0 };
  const v = arr.map(r => r.glucose);
  const sum = v.reduce((a, b) => a + b, 0), mean = sum / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;
  return {
    n, mean, min: Math.min(...v), max: Math.max(...v), sd,
    hypo: v.filter(x => x < LIM.low).length, hyper: arr.filter(r => r.glucose > highOf(r)).length
  };
}
function bandCounts(arr) {
  const c = { vlow: 0, low: 0, ok: 0, high: 0, vhigh: 0 };
  arr.forEach(r => c[bandOf(r.glucose, r.context).k]++);
  return c;
}
function inRange(recs, a, b) { return recs.filter(r => r.ts >= a && r.ts <= b); }
function periodRanges(days, anchorMs) {
  const end = endOfDay(anchorMs);
  const curStart = startOfDay(addDays(anchorMs, -(days - 1)));
  const prevEnd = curStart - 1;
  const prevStart = startOfDay(addDays(curStart, -days));
  return { cur: [curStart, end], prev: [prevStart, prevEnd] };
}
function compareStats(cur, prev) {
  const diff = (cur.mean != null && prev.mean != null) ? cur.mean - prev.mean : null;
  const pct = (diff != null && prev.mean > 0) ? diff / prev.mean * 100 : null;
  return { diff, pct };
}
function weekStart(ms) {
  const d = new Date(ms); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
function monthStart(ms) { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
function groupBy(arr, fn) {
  const m = new Map();
  arr.forEach(r => { const k = fn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
  return m;
}
function dailyMeans(recs) {
  const g = groupBy(recs, r => r.date);
  return [...g.entries()].sort().map(([date, rs]) => ({ date, ts: mkTs(date, '12:00'), mean: stats(rs).mean, n: rs.length }));
}
/* Inclinação (mg/dL por semana) sobre as médias diárias. Exige dados mínimos. */
function trend(recs) {
  const dm = dailyMeans(recs);
  if (dm.length < 10 || recs.length < 20) return null;
  const x0 = dm[0].ts, xs = dm.map(d => (d.ts - x0) / DAY), ys = dm.map(d => d.mean);
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  if (!den) return null;
  return { perWeek: num / den * 7, days: n };
}
const TIME_BLOCKS = [
  { label: '00–04h', a: 0, b: 4 }, { label: '04–08h', a: 4, b: 8 }, { label: '08–12h', a: 8, b: 12 },
  { label: '12–16h', a: 12, b: 16 }, { label: '16–20h', a: 16, b: 20 }, { label: '20–24h', a: 20, b: 24 }
];
function byTimeBlock(recs) {
  return TIME_BLOCKS.map(tb => {
    const rs = recs.filter(r => !r.noTime && parseInt(r.time.slice(0, 2), 10) >= tb.a && parseInt(r.time.slice(0, 2), 10) < tb.b);
    return { ...tb, ...stats(rs) };
  });
}
/* Regra de horários definida pelo usuário. Faixa 00h–04h não tem regra e não é alterada. */
const TIME_RULE = [
  { a: 4, b: 8, label: '04h–08h', context: 'jejum', meal: null, name: 'Jejum' },
  { a: 8, b: 10, label: '08h–10h', context: 'depois', meal: 'cafe', name: 'Pós-prandial do café da manhã' },
  { a: 10, b: 12, label: '10h–12h', context: 'antes', meal: 'almoco', name: 'Pré-prandial do almoço' },
  { a: 12, b: 16, label: '12h–16h', context: 'depois', meal: 'almoco', name: 'Pós-prandial do almoço' },
  { a: 16, b: 19, label: '16h–19h', context: 'antes', meal: 'jantar', name: 'Pré-prandial do jantar' },
  { a: 19, b: 24, label: '19h–00h', context: 'depois', meal: 'jantar', name: 'Pós-prandial do jantar' }
];
function ruleFor(rec) {
  if (!rec || rec.noTime || !rec.time) return null;
  const h = parseInt(String(rec.time).slice(0, 2), 10);
  return TIME_RULE.find(w => h >= w.a && h < w.b) || null;
}
/* Classificação-alvo de uma medição.
   mode 'horario': pela regra de horários.
   mode 'etiquetas': pelas etiquetas do mySugr (Pré/Pós-prandial, Jejum, refeição); o horário só completa o que a etiqueta não diz. */
function targetFor(rec, mode) {
  const w = ruleFor(rec);
  if (mode === 'etiquetas') {
    const inf = inferFromTags(rec.tags || '');
    const context = inf.context || (w && w.context) || null;
    if (!context) return null;
    let meal = null;
    if (context === 'jejum') meal = null;
    else if (context === 'deitar') meal = inf.meal || null;
    else meal = inf.meal || (w && w.meal) || null;
    return { context, meal };
  }
  return w ? { context: w.context, meal: w.meal || null } : null;
}
/* Devolve uma cópia atualizada, ou null se não há alvo ou nada muda. Guarda o valor anterior em prev. */
function applyRule(rec, mode) {
  const t = targetFor(rec, mode || 'horario'); if (!t) return null;
  const meal = t.meal || undefined;
  if (rec.context === t.context && rec.meal === meal) return null;
  const out = { ...rec };
  if (!out.prev) out.prev = { context: rec.context ?? null, meal: rec.meal ?? null };
  out.context = t.context; if (meal) out.meal = meal; else delete out.meal;
  out.cls = mode === 'etiquetas' ? 'etiqueta' : 'horario';
  return out;
}
function undoRule(rec) {
  if (!rec.prev) return null;
  const out = { ...rec };
  if (rec.prev.context) out.context = rec.prev.context; else delete out.context;
  if (rec.prev.meal) out.meal = rec.prev.meal; else delete out.meal;
  delete out.prev; delete out.cls; return out;
}
/* Avaliador da HbA1c: compara com a meta definida pelo usuário (padrão 7,0%). */
const A1C_TARGET_DEFAULT = 7.0, A1C_LOW = 4.0;
function a1cEval(v, target) {
  const t = (typeof target === 'number' && target >= 4 && target <= 12) ? target : A1C_TARGET_DEFAULT;
  if (v == null) return null;
  if (v < A1C_LOW) return { k: 'low', sym: '▼', txt: 'Baixa', t };
  if (v <= t) return { k: 'ok', sym: '●', txt: 'Dentro da faixa', t };
  if (v <= t + 2) return { k: 'high', sym: '▲', txt: 'Elevada', t };
  return { k: 'vhigh', sym: '▲▲', txt: 'Muito elevada', t };
}
function estimatedA1c(meanGlucose) { return (meanGlucose + 46.7) / 28.7; }

/* esquema de tratamento ao qual um registro pertence */
function schemeOf(rec, schemes) {
  if (rec.scheme && schemes.some(s => s.id === rec.scheme)) return rec.scheme;
  if (rec.scheme) return null;
  const cands = schemes.filter(s => rec.date >= s.start && (!s.end || rec.date <= s.end));
  return cands.length === 1 ? cands[0].id : (cands.length > 1 ? cands.sort((a, b) => b.start.localeCompare(a.start))[0].id : null);
}

/* ================= Exames laboratoriais (lógica pura) ================= */
const isNum = v => typeof v === 'number' && isFinite(v);
const examKey = s => norm(String(s || '')).replace(/[^a-z0-9]+/g, ' ').trim();
/* Situação do item. Com valor numérico e faixa de referência do próprio laboratório, o cálculo é feito aqui
   (não pelo modelo). Sem isso, usa o que o modelo leu no laudo: normal, baixo, alto ou indeterminado. */
function examFlag(it) {
  if (isNum(it.value)) {
    const lo = isNum(it.refLow), hi = isNum(it.refHigh);
    if (lo && it.value < it.refLow) return 'baixo';
    if (hi && it.value > it.refHigh) return 'alto';
    if (lo || hi) return 'normal';
  }
  return ['normal', 'baixo', 'alto'].includes(it.flagModel) ? it.flagModel : 'indeterminado';
}
/* Distância relativa para fora da faixa (0 = dentro). */
function examDev(it) {
  if (!isNum(it.value)) return null;
  const lo = isNum(it.refLow), hi = isNum(it.refHigh);
  if (!lo && !hi) return null;
  if (lo && it.value < it.refLow) return Math.abs(it.refLow) > 0 ? (it.refLow - it.value) / Math.abs(it.refLow) : 1;
  if (hi && it.value > it.refHigh) return Math.abs(it.refHigh) > 0 ? (it.value - it.refHigh) / Math.abs(it.refHigh) : 1;
  return 0;
}
/* Nota 0–10: média do "crédito" de cada item avaliável. Dentro da referência = 1. Fora = 1 − afastamento relativo (mínimo 0).
   Itens sem faixa numérica contam só pela situação lida (normal = 1, alterado = 0,5). Exige ao menos 3 itens avaliáveis. */
function examScore(items) {
  let sum = 0, n = 0, ok = 0, out = 0;
  items.forEach(it => {
    const f = it.flag || examFlag(it);
    if (!['normal', 'baixo', 'alto'].includes(f)) return;
    let c;
    if (f === 'normal') { c = 1; ok++; }
    else { const d = examDev(it); c = d == null ? 0.5 : Math.max(0, 1 - d); out++; }
    sum += c; n++;
  });
  if (n < 3) return null;
  return { score: Math.round(sum / n * 100) / 10, n, ok, out };
}
function examBand(score) {
  if (score == null) return { k: 'na', label: 'Sem nota' };
  if (score >= 9) return { k: 'a', label: 'Quase tudo dentro da referência' };
  if (score >= 7) return { k: 'b', label: 'Maioria dentro da referência' };
  if (score >= 5) return { k: 'c', label: 'Vários itens fora da referência' };
  return { k: 'd', label: 'Muitos itens fora da referência' };
}
/* Normaliza a resposta do modelo para o formato guardado. */
function cleanExam(raw) {
  const j = raw && typeof raw === 'object' ? raw : {};
  const num = v => { if (isNum(v)) return v; const p = parseNum(v); return isNum(p) ? p : null; };
  const str = (v, m) => (typeof v === 'string' ? v.trim().slice(0, m) : '');
  const items = (Array.isArray(j.items) ? j.items : []).slice(0, 300).map(x => {
    if (!x || typeof x !== 'object') return null;
    const name = str(x.name, 90); if (!name) return null;
    const it = { name, key: examKey(x.canonical || name), value: num(x.value), text: str(x.text, 80), unit: str(x.unit, 24), refLow: num(x.refLow), refHigh: num(x.refHigh), refText: str(x.refText, 90), flagModel: str(x.flag, 16).toLowerCase(), note: str(x.context, 600) };
    if (it.value == null && !it.text) return null;
    it.flag = examFlag(it);
    return it;
  }).filter(Boolean);
  let date = typeof j.date === 'string' ? parseDate(j.date) : null;
  if (date && (date > isoDate(new Date()) || date < '1990-01-01')) date = null;
  const list = a => (Array.isArray(a) ? a : []).map(s => str(s, 400)).filter(Boolean).slice(0, 8);
  return { date: date || '', lab: str(j.lab, 80), title: str(j.title, 100) || 'Exame', items, summary: str(j.summary, 1500), attention: list(j.attention), questions: list(j.questions) };
}
function hashText(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + '-' + s.length; }
/* Comparação: um item por exame (o último com a mesma chave), em ordem cronológica. */
function compareExams(exams) {
  const list = exams.filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date) || (a.addedAt || 0) - (b.addedAt || 0));
  const map = new Map();
  list.forEach((e, ei) => e.items.forEach(it => {
    if (!it.key) return;
    if (!map.has(it.key)) map.set(it.key, { key: it.key, name: it.name, unit: it.unit, cells: new Array(list.length).fill(null) });
    const row = map.get(it.key); row.cells[ei] = it; if (!row.unit && it.unit) row.unit = it.unit;
  }));
  const rows = [...map.values()].map(r => {
    const have = r.cells.map((c, i) => c ? i : -1).filter(i => i >= 0);
    r.count = have.length;
    const nums = have.filter(i => isNum(r.cells[i].value));
    if (nums.length >= 2) {
      const a = r.cells[nums[0]], b = r.cells[nums[nums.length - 1]];
      r.delta = b.value - a.value; r.pct = a.value !== 0 ? r.delta / Math.abs(a.value) * 100 : null;
      r.dir = Math.abs(r.pct != null ? r.pct : r.delta) < 2 ? 'igual' : (r.delta > 0 ? 'subiu' : 'desceu');
      const da = examDev(a), db = examDev(b);
      if (da != null && db != null) r.rel = (da === 0 && db === 0) ? 'dentro' : (Math.abs(db - da) < 0.02 ? 'igual' : db < da ? 'perto' : 'longe');
      else r.rel = null;
    }
    return r;
  });
  return { exams: list, multi: rows.filter(r => r.count >= 2).sort((a, b) => a.name.localeCompare(b.name, 'pt')), single: rows.filter(r => r.count < 2).sort((a, b) => a.name.localeCompare(b.name, 'pt')) };
}

/* ---------- Histórico de insulinas (descritivo; sem doses) ---------- */
const minOfDay = ts => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };
function circMean(mins) { // média circular de horários (min do dia); null se vazio
  if (!mins.length) return null; let sx = 0, sy = 0;
  mins.forEach(m => { const a = m / 1440 * 2 * Math.PI; sx += Math.cos(a); sy += Math.sin(a); });
  let a = Math.atan2(sy, sx); if (a < 0) a += 2 * Math.PI; return Math.round(a / (2 * Math.PI) * 1440) % 1440;
}
const wrapDiff = (m, ref) => { let d = (m - ref) % 1440; if (d > 720) d -= 1440; if (d < -720) d += 1440; return d; };
const hhmm = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
function insStats(list) { // list: [{ts}] de um mesmo tipo
  const ts = list.map(x => x.ts).sort((a, b) => a - b), n = ts.length;
  if (!n) return { n: 0 };
  const mins = ts.map(minOfDay), mean = circMean(mins), dev = mins.map(m => wrapDiff(m, mean));
  const early = Math.min(...dev), late = Math.max(...dev);
  const iv = []; for (let i = 1; i < n; i++) iv.push({ from: ts[i - 1], to: ts[i], h: (ts[i] - ts[i - 1]) / 3600e3 });
  const ivh = iv.map(x => x.h), ivMean = ivh.length ? ivh.reduce((a, b) => a + b, 0) / ivh.length : null;
  const near = ivh.filter(h => Math.abs(h - 24) <= 1).length;
  const sd = dev.length > 1 ? Math.sqrt(dev.reduce((a, d) => a + d * d, 0) / dev.length) : 0;
  return { n, mean, earliest: (mean + early + 1440) % 1440, latest: (mean + late + 1440) % 1440, spread: late - early, sd: Math.round(sd), iv, ivMean, near };
}

/* ---------- Conquistas: sequências sem hipoglicemia / jejum ≤ 130 / glicemia ≤ 180 ---------- */
const RW_STEPS = [7, 14, 30, 90]; // 90 dias = 3 meses
const RW_CATS = {
  hypo: { rel: () => true, bad: r => r.glucose < LIM.low },
  fast: { rel: r => r.context === 'jejum', bad: r => r.glucose > FAST.high },
  norm: { rel: () => true, bad: r => r.glucose > LIM.high },
};
const dayNum = d => Math.round(Date.parse(d + 'T00:00:00Z') / 86400000);
function rewardEval(records, todayIso) {
  const real = (records || []).filter(r => r && r.source !== 'exemplo' && r.date && typeof r.glucose === 'number'), t = dayNum(todayIso), out = {};
  for (const [k, c] of Object.entries(RW_CATS)) {
    const rel = real.filter(c.rel).filter(r => dayNum(r.date) <= t);
    if (!rel.length) { out[k] = { streak: 0, ach: {}, cov: {}, n: 0 }; continue; }
    const first = Math.min(...rel.map(r => dayNum(r.date))), bads = rel.filter(c.bad).map(r => dayNum(r.date)), lastBad = bads.length ? Math.max(...bads) : null;
    // a sequência só conta até o último dia COM medição da categoria: dia sem registro não avança conquista
    const last = Math.max(...rel.map(r => dayNum(r.date))), streak = lastBad === null ? last - first + 1 : last - lastBad, days = new Set(rel.map(r => dayNum(r.date))), ach = {}, cov = {};
    for (const N of RW_STEPS) { let c2 = 0; for (let d = last - N + 1; d <= last; d++) if (days.has(d)) c2++; cov[N] = c2; ach[N] = streak >= N && c2 >= Math.ceil(0.7 * N); }
    out[k] = { streak, ach, cov, n: rel.length };
  }
  return out;
}


/* ---------- Episódios de hipoglicemia: sequência a partir de uma medição < 70, até a primeira ≥ 70 (ou 60 min sem medir) ---------- */
function hypoEpisodes(recs, gapMin = 60) {
  const sorted = (recs || []).filter(r => r && !r.noTime && typeof r.glucose === 'number' && r.ts).slice().sort((a, b) => a.ts - b.ts), eps = [];
  let cur = null;
  for (const r of sorted) {
    if (cur) { const last = cur[cur.length - 1]; if (last.glucose < LIM.low && r.ts - last.ts <= gapMin * 60000) { cur.push(r); continue; } cur = null; }
    if (r.glucose < LIM.low) { cur = [r]; eps.push(cur); }
  }
  return eps.map(m => { const last = m[m.length - 1]; return { id: m[0].id, members: m, start: m[0].ts, end: last.ts, ts: last.ts, date: m[0].date, min: Math.min(...m.filter(x => x.glucose < LIM.low).map(x => x.glucose)), rec: last.glucose >= LIM.low ? last : null }; });
}

/* ---------- Dia típico (percentis por horário, janela de 3 h centrada) ---------- */
function pctl(sorted, p) { if (!sorted.length) return null; const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); }
function typicalDay(recs, minN = 4) {
  const real = (recs || []).filter(r => r && !r.noTime && r.source !== 'exemplo' && typeof r.glucose === 'number' && r.time), out = [];
  for (let h = 0; h < 24; h++) {
    const v = real.filter(r => { const hh = +r.time.slice(0, 2), d = Math.min((hh - h + 24) % 24, (h - hh + 24) % 24); return d <= 1; }).map(r => r.glucose).sort((a, b) => a - b);
    out.push(v.length >= minN ? { h, n: v.length, p10: pctl(v, .1), p25: pctl(v, .25), p50: pctl(v, .5), p75: pctl(v, .75), p90: pctl(v, .9) } : { h, n: v.length });
  }
  return { hours: out, n: real.length, ok: out.filter(x => x.p50 != null).length };
}

/* ---------- Padrões descritivos (sem causa, sem recomendação) ---------- */
function patternNotes(records, markLabels, todayIso) {
  const real = (records || []).filter(r => r && r.source !== 'exemplo' && r.date && typeof r.glucose === 'number'), out = [];
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length, f1 = x => (Math.round(x * 10) / 10).toLocaleString('pt-BR'), dn = d => Math.round(Date.parse(d + 'T00:00:00Z') / 86400000);
  const nextDay = d => new Date((dn(d) + 1) * 86400000).toISOString().slice(0, 10);
  // A) horário das baixas
  const lows = real.filter(r => r.glucose < LIM.low && !r.noTime && r.time);
  if (lows.length >= 3) {
    const B = [['madrugada (0h–6h)', 0, 6], ['manhã (6h–11h)', 6, 11], ['tarde (11h–18h)', 11, 18], ['noite (18h–24h)', 18, 24]];
    const c = B.map(([l, a, b]) => [l, lows.filter(r => { const h = +r.time.slice(0, 2); return h >= a && h < b; }).length]).sort((x, y) => y[1] - x[1]);
    if (c[0][1] / lows.length >= 0.4) out.push({ k: 'baixas', t: 'Quando as baixas aparecem', d: `${c[0][1]} de ${lows.length} glicemias abaixo de ${LIM.low} (${Math.round(c[0][1] / lows.length * 100)}%) foram na ${c[0][0]}.`, n: lows.length });
  }
  // B) jejum: últimos 30 dias x 30 anteriores
  if (todayIso) {
    const t = dn(todayIso), fa = real.filter(r => r.context === 'jejum'), cur = fa.filter(r => dn(r.date) > t - 30 && dn(r.date) <= t).map(r => r.glucose), prv = fa.filter(r => dn(r.date) > t - 60 && dn(r.date) <= t - 30).map(r => r.glucose);
    if (cur.length >= 5 && prv.length >= 5) { const d = mean(cur) - mean(prv); out.push({ k: 'jejum', t: 'Jejum: últimos 30 dias', d: `Média de ${f1(mean(cur))} mg/dL (${cur.length} medições), contra ${f1(mean(prv))} mg/dL nos 30 dias anteriores (${prv.length}). ${Math.abs(d) < 5 ? 'Praticamente igual.' : d > 0 ? `Subiu ${f1(d)} mg/dL.` : `Caiu ${f1(-d)} mg/dL.`} ${Math.round(cur.filter(v => v > FAST.high).length / cur.length * 100)}% dos jejuns recentes ficaram acima de ${FAST.high}.`, n: cur.length + prv.length }); }
  }
  // C) etiquetas x jejum do dia seguinte
  const fastBy = {}; real.filter(r => r.context === 'jejum').forEach(r => (fastBy[r.date] = fastBy[r.date] || []).push(r.glucose));
  const markDays = {}; real.forEach(r => (r.marks || []).forEach(m => { (markDays[m] = markDays[m] || new Set()).add(r.date); }));
  Object.keys(markLabels || {}).forEach(m => {
    const ds = markDays[m]; if (!ds || ds.size < 3 || m === 'hipo') return;
    const withM = [], without = [];
    Object.keys(fastBy).forEach(d => { const prev = new Date((dn(d) - 1) * 86400000).toISOString().slice(0, 10), v = mean(fastBy[d]); (ds.has(prev) ? withM : without).push(v); });
    if (withM.length >= 3 && without.length >= 3) { const d = mean(withM) - mean(without); if (Math.abs(d) >= 10) out.push({ k: 'marca-' + m, t: `Jejum depois de “${markLabels[m]}”`, d: `Na manhã seguinte a dias com essa etiqueta, o jejum médio foi ${f1(mean(withM))} mg/dL (${withM.length} dias), contra ${f1(mean(without))} mg/dL nos outros dias (${without.length}): ${d > 0 ? '+' : '−'}${f1(Math.abs(d))} mg/dL.`, n: withM.length + without.length }); }
  });
  // D) glicemia depois do jantar x jejum seguinte
  const dinner = {}; real.filter(r => r.meal === 'jantar' && r.context === 'depois').forEach(r => { dinner[r.date] = Math.max(dinner[r.date] || 0, r.glucose); });
  const hi = [], lo = []; Object.keys(dinner).forEach(d => { const n = fastBy[nextDay(d)]; if (n) (dinner[d] > LIM.high ? hi : lo).push(mean(n)); });
  if (hi.length >= 3 && lo.length >= 3) { const d = mean(hi) - mean(lo); out.push({ k: 'jantar-jejum', t: 'Depois do jantar × jejum seguinte', d: `Quando a glicemia depois do jantar passou de ${LIM.high}, o jejum do dia seguinte teve média de ${f1(mean(hi))} mg/dL (${hi.length} noites); quando ficou em ${LIM.high} ou menos, ${f1(mean(lo))} mg/dL (${lo.length} noites). ${Math.abs(d) < 5 ? 'Diferença pequena.' : (d > 0 ? '+' : '−') + f1(Math.abs(d)) + ' mg/dL.'}`, n: hi.length + lo.length }); }
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = { hypoEpisodes, patternNotes, typicalDay, pctl, rewardEval, RW_STEPS, circMean, wrapDiff, hhmm, insStats, minOfDay, a1cEval, A1C_TARGET_DEFAULT, examFlag, examDev, examScore, examBand, cleanExam, hashText, compareExams, examKey, inferFromTags, targetFor, TIME_RULE, ruleFor, applyRule, undoRule, FAST, highOf, MONTHS, norm, parseMySugr, parseNum, parseDate, parseTime, parseCSV, detectDelim, stats, periodRanges, compareStats, bandOf, mkTs, isoDate, dedupKey, trend, byTimeBlock, estimatedA1c, schemeOf, weekStart, dailyMeans, bandCounts, inRange, addDays, startOfDay, endOfDay };
}
