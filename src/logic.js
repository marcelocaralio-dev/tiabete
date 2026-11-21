/* ================= TiaBete · lógica pura (sem DOM) ================= */
const APP_VERSION = '0.2';
const SCHEMA_VERSION = 5;
const BUILD_RAW = '__BUILD_DATE__', BUILD_DATE = BUILD_RAW.startsWith('__') ? '' : BUILD_RAW;
const APP_INFO = { dev: 'Marcelo Gomes Chaves', assist: 'Claude (Anthropic)', repo: 'github.com/marcelocaralio-dev/tiabete' };
const LIM = { vlow: 54, low: 70, high: 180, vhigh: 250 };
const FAST = { low: 70, high: 130 };  /* faixa considerada normal em jejum */
const GLU_MIN = 10, GLU_MAX = 1000;
const DAY = 86400000;
/* Hipoglicemia: toda glicemia < 70 é categorizada como "Hipoglicemia".
   O protocolo (abertura automática, cronômetro de 15 min, lembretes) vale para toda glicemia abaixo de 70 mg/dL (HYPO_PROTO = 70, comparação "<"). */
const HYPO_PROTO = 70, HYPO_TAG = 'Hipoglicemia';
function hypoClass(g) { const hypo = Number.isFinite(g) && g < LIM.low; return { hypo, tag: hypo ? HYPO_TAG : null, protocol: hypo && g < HYPO_PROTO }; }
function hypoEpisode(records, now) {
  const real = records.filter(r => !r.noTime && r.source !== 'exemplo' && r.ts).sort((a, b) => a.ts - b.ts), last = real[real.length - 1];
  if (!last || last.glucose >= LIM.low || now - last.ts > 4 * 3600e3) return null;
  let i = real.length - 1;
  while (i > 0) { const p = real[i - 1]; if ((p.glucose < LIM.low || (p.marks || []).includes('hipo')) && real[i].ts - p.ts <= 90 * 60e3) i--; else break; }
  const ep = real.slice(i); return { last, start: ep[0], ep, id: ep[0].id, protocol: ep.some(r => r.glucose < HYPO_PROTO) };
}
function hypoStamp(rec) { const c = hypoClass(rec.glucose); if (c.tag) rec.status = c.tag; else delete rec.status; return rec; }
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

/* ---------- Importador universal: mapeamento de colunas (mySugr, Glooko, Libre, Dexcom, Diabetes:M e outros) ---------- */
const MMOL = 18.0182; /* 1 mmol/L de glicose = 18,0182 mg/dL */
const SOURCE_NAMES = { mysugr: 'mySugr', glooko: 'Glooko', libre: 'FreeStyle Libre (LibreView)', dexcom: 'Dexcom Clarity', diabetesm: 'Diabetes:M', importado: 'Outro aplicativo (colunas reconhecidas automaticamente)' };
/* As regras originais do mySugr vêm primeiro e continuam valendo; os sinônimos (inglês, Glooko, Diabetes:M, planilhas e JSON) só ACRESCENTAM reconhecimento. */
const COLUMN_RULES = [
  ['date', h => h === 'data' || h === 'date' || /^(data ?\/? ?hora|data e hora|data hora|date ?\/? ?time|date and time|datetime|time stamp|fecha( y hora)?|created at|createdat|datestring|display ?time)$/.test(h) || h.startsWith('timestamp') || h.startsWith('carimbo de data')],
  ['time', h => h === 'horario' || h === 'hora' || h === 'time' || h === 'hour' || h === 'hora do dia' || h === 'time of day' || h === 'horario da medicao' || h === 'hora da medicao'],
  ['tags', h => h === 'etiquetas' || h === 'tags' || h === 'tag' || h === 'etiqueta' || h === 'category' || h === 'categoria' || h === 'event' || h === 'evento' || h === 'event tag'],
  ['glucose', h => h.includes('afericao da glicemia') || (h.includes('glicemia') && h.includes('mg')) || h.includes('blood glucose')],
  ['insPen', h => h.includes('caneta') || /\bpen\b/.test(h)],
  ['insBasal', h => h.includes('injecao basal') || h === 'basal (u)' || h.includes('basal insulin') || /long[- ]acting/.test(h) || h.includes('insulina basal') || h.includes('insulina lenta')],
  ['insPump', h => (h.includes('bomba') && !h.includes('porcentagem')) || (h.includes('pump') && !/(percent|%|duration|rate)/.test(h))],
  ['insMeal', h => h.includes('insulina (refeicao)') || h === 'insulina rapida (u)' || h.includes('insulin (meal)') || h.includes('meal insulin') || h.includes('bolus insulin') || h.includes('insulina rapida') || /rapid[- ]acting/.test(h) || h.includes('insulin delivered') || (h.includes('bolus') && !h.includes('extended'))],
  ['insCorr', h => h.includes('insulina (correcao)') || h === 'correcao (u)' || h.includes('insulin (correction)') || h === 'correction (u)' || h === 'correction'],
  ['insUnk', h => /^(insulin|insulina|insulin \(u\)|insulina \(u\)|insulin units|insulin dose|dose de insulina|insulin \(units\))$/.test(h)],
  ['tbPct', h => h.includes('porcentagem basal')],
  ['tbMin', h => h.includes('duracao basal')],
  ['carbs', h => (h.includes('carboidrato') || h.includes('carbs') || h.includes('carbohydrate') || h.includes('carb input')) && !/(ratio|razao)/.test(h)],
  ['ctxLabel', h => h === 'contexto' || h === 'context'],
  ['mealLabel', h => h === 'refeicao' || h === 'meal' || h === 'meal tag' || h === 'tag de refeicao'],
  ['mealDesc', h => h.includes('descricoes de refeicoes') || h.includes('descricao de refeicao') || h === 'food' || h === 'meal description' || h === 'alimentos'],
  ['actMin', h => h.includes('duracao da atividade') || h === 'atividade (min)' || h === 'exercise (min)' || h === 'exercise duration'],
  ['actInt', h => h.includes('intensidade da atividade') || h === 'exercise intensity'],
  ['actDesc', h => h.includes('descricao da atividade') || h === 'atividade' || h === 'exercise' || h === 'activity'],
  ['steps', h => h === 'passos' || h === 'steps'],
  ['notes', h => h === 'nota' || h === 'notas' || h === 'observacoes' || h === 'observacao' || h === 'note' || h === 'notes' || h === 'comment' || h === 'comments' || h === 'comentario' || h === 'comentarios' || h === 'memo' || h === 'remarks'],
  ['bp', h => h.includes('pressao') || h.includes('blood pressure')],
  ['weight', h => h.includes('peso corporal') || h === 'weight' || h === 'peso' || h === 'body weight' || h === 'weight (kg)'],
  ['a1c', h => h.includes('hba1c') || h === 'a1c'],
  ['ketones', h => h === 'cetonas' || h === 'ketones' || h === 'ketone'],
  ['foodType', h => h.includes('tipo de alimento')],
  ['medication', h => h.includes('medicacao') || h === 'medication' || h === 'medications'],
  ['unit', h => /(^|[. ])(unit|unidade)$/.test(h) || h === 'glucose unit' || h === 'glucose units' || h === 'unidade de glicose' || h === 'unidade da glicemia' || h === 'unidade de medida'],
  ['rtype', h => h === 'type' || h === 'rectype'],
  /* Localização, fuso horário, latitude e longitude são reconhecidos para serem DESCARTADOS (privacidade) */
  ['_location', h => h === 'localizacao' || h === 'location' || h === 'gps'],
  ['_tz', h => h.includes('fuso') || h === 'timezone' || h === 'time zone'],
  ['_lat', h => h === 'latitude' || h === 'lat'],
  ['_lon', h => h === 'longitude' || h === 'lng' || h === 'lon'],
  /* Colunas conhecidas que não têm o que importar (identificação do aparelho/arquivo): reconhecidas, sem aviso */
  ['~origem', h => h === 'origem' || h === 'source' || h === 'fonte'],
  ['~esquema', h => h === 'esquema' || h === 'scheme'],
  ['~id', h => h === 'id' || h === '#' || h === 'index'],
  ['~device', h => h === 'device' || h === 'dispositivo' || h === 'device name' || h === 'model' || h === 'modelo'],
  ['~serial', h => h === 'serial number' || h === 'numero de serie' || h === 'serial']
];
/* Só se não houver coluna de glicemia pelas regras acima: nomes genéricos (Glucose, Glicose, BG, SGV...). Colunas de sensor (CGM) nunca entram como medição. */
const GLU_FALLBACK = h => /(^|[^a-z])(glicemia|glicose|glucose|glucosa|blood sugar|bg|sgv|mbg|bloodglucose)([^a-z]|$)/.test(h) && !/(cgm|historic|historico|scan|varredura|sensor|target|alvo|meta|ratio|razao|correct|insulin|carb|media|mean|average|a1c|estimad|unit|unidade)/.test(h);
const GLU_AUTO = h => /(cgm|historic|historico|sensor)/.test(h) && /(glucose|glicose|glicemia)/.test(h) && !/(unit|unidade)/.test(h);
function mapColumns(headerRow) {
  const map = {};
  const hs = headerRow.map(raw => norm(raw).replace(/_/g, ' '));
  hs.forEach((h, idx) => {
    for (const [key, test] of COLUMN_RULES) {
      if (!(key in map) && test(h)) { map[key] = idx; break; }
    }
  });
  if (!('glucose' in map)) {
    const used = new Set(Object.values(map));
    const gi = hs.findIndex((h, i) => !used.has(i) && GLU_FALLBACK(h));
    if (gi >= 0) { map.glucose = gi; map._fallback = true; }
    else { const ai = hs.findIndex((h, i) => !used.has(i) && GLU_AUTO(h)); if (ai >= 0) map.glucoseAuto = ai; }
  }
  return map;
}
function inferFromTags(tags) {
  const t = norm(tags); const out = {};
  if (/cafe da manha|breakfast|desayuno/.test(t)) out.meal = 'cafe';
  else if (/almoco|lunch|almuerzo/.test(t)) out.meal = 'almoco';
  else if (/jantar|dinner|supper|cena/.test(t)) out.meal = 'jantar';
  else if (/lanche|snack/.test(t)) out.meal = 'lanche';
  if (/jejum|fasting|ayuno/.test(t)) out.context = 'jejum';
  else if (/antes d[ao]s? (refeicao|cafe|almoco|jantar|lanche)|pre[- ]?(refeicao|prandial|meal)|before[- ](a )?(meal|breakfast|lunch|dinner|supper|snack)|antes de (comer|la comida)/.test(t)) out.context = 'antes';
  else if (/depois d[ao]s? (refeicao|cafe|almoco|jantar|lanche)|pos[- ]?(refeicao|prandial|meal)|post[- ]?(meal|prandial)|after[- ](a )?(meal|breakfast|lunch|dinner|supper|snack)|despues de (comer|la comida)/.test(t)) out.context = 'depois';
  else if (/deitar|dormir|sono|bedtime|before bed|at bed|acostar/.test(t)) out.context = 'deitar';
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

/* Data/hora em formatos de outros apps: ISO com fuso (Z, -03:00), epoch em segundos ou milissegundos. Vira horário LOCAL do aparelho. */
function isoLocal(d) { return isoDate(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function normStamp(s) {
  s = String(s == null ? '' : s).trim();
  if (/^\d{13}$/.test(s) || /^\d{10}$/.test(s)) { const d = new Date(s.length === 13 ? +s : +s * 1000); return isNaN(d) ? s : isoLocal(d); }
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})$/i);
  if (m) {
    let z = m[4].toUpperCase(); if (z !== 'Z' && !z.includes(':')) z = z.slice(0, 3) + ':' + z.slice(3);
    const d = new Date(m[1] + 'T' + m[2] + ':' + (m[3] || '00') + z); return isNaN(d) ? s : isoLocal(d);
  }
  return s;
}
const newResult = () => ({ ok: false, error: '', delim: ',', columns: [], ignoredCols: [], unmappedCols: [], items: [], hba: [], ignored: [], reasons: {}, totalRows: 0, emptyRows: 0, withOtherData: 0, format: '', source: '', fileKind: '', converted: 0, unit: 'mg/dL', unitNote: '', skipped: [] });
const NO_GLU_MSG = 'Não encontrei as colunas de data e de glicemia neste arquivo. Ele precisa ter, no mínimo, uma coluna de data (ou de data e hora) e uma de glicemia, como "Data" e "Glicemia (mg/dL)".';
const AUTO_ONLY_MSG = 'Este arquivo só tem leituras automáticas de sensor (CGM). O TiaBete importa as medições manuais (dedo, tira, leitura e calibração).';

/* Interpreta um CSV (ou JSON) de qualquer aplicativo suportado. Não grava nada: só devolve o que encontrou.
   parseMySugr continua existindo com o mesmo nome e o mesmo resultado para os arquivos que já eram aceitos. */
function parseMySugr(text) { return parseImportText(text); }
function tablesFromText(text) {
  text = String(text == null ? '' : text).replace(/^﻿/, '');
  const t = text.trimStart();
  if (t[0] === '{' || t[0] === '[') {
    let j; try { j = JSON.parse(text); } catch (e) { if (t[0] === '{') return { error: 'O arquivo parece ser JSON, mas está com defeito e não pôde ser lido.' }; }
    if (j !== undefined) { const tb = jsonTables(j); return tb.length ? { tables: tb, kind: 'JSON' } : { error: 'Não encontrei uma lista de registros dentro do JSON.' }; }
  }
  let body = text, delim;
  const sep = body.match(/^sep=(.)\r?\n/i); if (sep) { delim = sep[1]; body = body.slice(sep[0].length); }
  if (!body.trim()) return { error: 'O arquivo está vazio.' };
  delim = delim || detectDelim(body);
  const { rows, unterminated } = parseCSV(body, delim);
  return { tables: [{ name: '', rows, delim, warning: unterminated ? 'O arquivo termina com um campo entre aspas sem fechamento. A última linha pode estar incompleta.' : '' }], kind: 'CSV' };
}
function parseImportText(text) {
  const tt = tablesFromText(text);
  if (tt.error) { const r = newResult(); r.error = tt.error; return r; }
  const r = parseImportTables(tt.tables); r.fileKind = tt.kind; return r;
}
function parseImportTables(tables) {
  const parts = tables.map(t => { const r = parseTable(t.rows, t); r.where = t.name || ''; return r; });
  if (parts.length === 1) return parts[0];
  const res = newResult(), good = parts.filter(p => p.ok);
  if (!good.length) {
    const r = parts.find(p => p.error && p.error !== NO_GLU_MSG) || parts[0] || res;
    r.skipped = parts.filter(p => p !== r).map(p => ({ name: p.where, error: p.error })); return r;
  }
  const seen = new Set(), hseen = new Set(), names = new Set(), cols = new Set(), icols = new Set(), um = new Set();
  good.forEach(p => {
    p.items.forEach(it => { const k = dedupKey(it); if (!seen.has(k)) { seen.add(k); res.items.push(it); } else res.reasons['Repetido dentro do próprio arquivo'] = (res.reasons['Repetido dentro do próprio arquivo'] || 0) + 1; });
    p.hba.forEach(x => { const k = x.date + '|' + x.value; if (!hseen.has(k)) { hseen.add(k); res.hba.push(x); } });
    for (const [k, n] of Object.entries(p.reasons)) res.reasons[k] = (res.reasons[k] || 0) + n;
    p.ignored.forEach(i => { if (res.ignored.length < 200) res.ignored.push({ ...i, extra: i.extra, where: p.where }); });
    res.totalRows += p.totalRows; res.emptyRows += p.emptyRows; res.withOtherData += p.withOtherData; res.converted += p.converted;
    if (p.format) names.add(p.format); p.columns.forEach(c => cols.add(c)); p.ignoredCols.forEach(c => icols.add(c)); p.unmappedCols.forEach(c => um.add(c));
    if (p.warning) res.warning = (res.warning ? res.warning + ' ' : '') + p.warning;
    if (p.unitNote && !res.unitNote.includes(p.unitNote)) res.unitNote += (res.unitNote ? ' ' : '') + p.unitNote;
  });
  res.items.sort((a, b) => a.ts - b.ts);
  res.format = [...names].join(' + '); res.source = good.length && good.every(p => p.source === good[0].source) ? good[0].source : 'importado';
  res.columns = [...cols]; res.ignoredCols = [...icols]; res.unmappedCols = [...um].slice(0, 40);
  res.skipped = parts.filter(p => !p.ok).map(p => ({ name: p.where, error: p.error }));
  res.ok = true; res.delim = good[0].delim; return res;
}
function detectSource(rows, hi, map, strong) {
  const head = rows.slice(0, hi + 1).map(r => r.map(c => norm(c)).join(' '));
  const all = head.join(' ');
  if ((/^name:/.test(norm(rows[0] && rows[0][0] || '')) && /date range/.test(all)) || /glooko/.test(all)) return 'glooko';
  const hdr = norm((rows[hi] || []).join(' '));
  if (/serial number/.test(hdr) && /(carbs input|insulin delivered|blood glucose input|insulin type)/.test(hdr)) return 'glooko';
  if (/diabetes ?: ?m|diabetesm/.test(all)) return 'diabetesm';
  if (strong) return 'mysugr';
  return 'importado';
}
function parseTable(rows, opt) {
  opt = opt || {};
  const res = newResult(); res.delim = opt.delim || ','; if (opt.warning) res.warning = opt.warning;
  if (!rows || !rows.length || rows.every(r => r.every(c => !String(c).trim()))) { res.error = 'O arquivo está vazio.'; return res; }
  { const sn = detectSensor(rows); if (sn) return parseSensor(rows, sn, res); }
  let hi = -1, map = null;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const m = mapColumns(rows[i]);
    if ('date' in m && ('glucose' in m || 'a1c' in m || 'glucoseAuto' in m)) { hi = i; map = m; break; }
  }
  if (hi < 0) { res.error = NO_GLU_MSG; return res; }
  if ('glucoseAuto' in map) { res.error = AUTO_ONLY_MSG; res.format = SOURCE_NAMES[detectSource(rows, hi, map, false)]; return res; }
  if (!('glucose' in map)) { res.error = 'A coluna de glicemia não foi encontrada. Ela precisa ter um nome como "Glicemia (mg/dL)" ou "Glucose".'; return res; }
  const strong = !map._fallback;
  const src = detectSource(rows, hi, map, strong);
  res.source = src; res.format = SOURCE_NAMES[src];
  res.columns = Object.keys(map).filter(k => k[0] !== '_' && k[0] !== '~' && k !== 'rtype' && k !== 'unit');
  res.ignoredCols = Object.keys(map).filter(k => k[0] === '_' && k !== '_fallback');
  const g = (row, k) => (k in map ? (row[map[k]] ?? '').trim() : '');
  const gn = (row, k) => parseNum(g(row, k));
  const bump = (reason, line, extra) => {
    res.reasons[reason] = (res.reasons[reason] || 0) + 1;
    if (res.ignored.length < 200) res.ignored.push({ line, reason, extra: extra || '' });
  };
  /* Unidade da glicemia: cabeçalho (mmol ou mg), coluna "Unidade" linha a linha, ou, sem nenhuma indicação, os próprios valores. */
  const gh = norm(rows[hi][map.glucose]).replace(/_/g, ' ');
  let fileUnit = /mmol/.test(gh) ? 'mmol' : /mg ?\/? ?dl|mgdl/.test(gh) ? 'mgdl' : '';
  if (!fileUnit && !('unit' in map)) {
    const vs = []; for (let i = hi + 1; i < rows.length && vs.length < 5000; i++) { const m0 = String(rows[i][map.glucose] ?? '').match(/^\s*([0-9][0-9.,]*)/); const v = m0 ? parseNum(m0[1]) : null; if (v !== null && v > 0) vs.push(v); }
    if (vs.length && Math.max(...vs) <= 45 && (vs.some(v => v % 1 !== 0) || vs.sort((a, b) => a - b)[vs.length >> 1] <= 30)) { fileUnit = 'mmol'; res.unitNote = 'A unidade não está no arquivo; como todos os valores são pequenos (até 45), foram tratados como mmol/L e convertidos para mg/dL. Confira na prévia.'; }
  }
  const startCols = new Set(Object.keys(map).filter(k => k !== '_fallback').map(k => map[k]));
  const data = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(c => !String(c).trim())) { res.emptyRows++; continue; }
    res.totalRows++;
    const line = i + 1;
    const rawDate = normStamp(g(row, 'date'));
    const date = parseDate(rawDate);
    if (!date) { bump('Data não reconhecida', line, rawDate); continue; }
    if ('rtype' in map && /^(sgv|egv|cgm)/.test(norm(g(row, 'rtype')))) { bump('Leitura automática do sensor (só medições manuais entram)', line); continue; }
    const embedded = rawDate.match(/(?:\s|T)(\d{1,2}[:h.]\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)\s*$/);
    let time = parseTime(g(row, 'time')) || (embedded ? parseTime(embedded[1]) : null);
    let glucoseRaw = g(row, 'glucose'), unit = fileUnit;
    const um = glucoseRaw.match(/^\s*([0-9][0-9.,]*)\s*(mg\/dl|mmol\/l|mg|mmol)\s*$/i);
    if (um) { glucoseRaw = um[1]; unit = /mmol/i.test(um[2]) ? 'mmol' : 'mgdl'; }
    else if ('unit' in map) { const ru = norm(g(row, 'unit')); if (/mmol/.test(ru)) unit = 'mmol'; else if (/mg/.test(ru)) unit = 'mgdl'; }
    let glucose = parseNum(glucoseRaw), origGlu;
    if (glucose !== null && unit === 'mmol') { origGlu = glucoseRaw + ' mmol/L'; glucose = Math.round(glucose * MMOL * 10) / 10; res.converted++; }
    const a1c = gn(row, 'a1c');
    const insulinOrCarbs = ['insPen', 'insBasal', 'insPump', 'insMeal', 'insCorr', 'insUnk', 'carbs'].some(k => gn(row, k) > 0);
    if (glucose === null || glucose < GLU_MIN || glucose > GLU_MAX) {
      if (a1c !== null && a1c >= 3 && a1c <= 20) res.hba.push({ date, value: a1c, line });
      if (glucose === null && glucoseRaw) bump('Glicemia não numérica', line, glucoseRaw);
      else if (glucose === null) { bump('Sem glicemia', line); if (insulinOrCarbs) res.withOtherData++; }
      else bump('Glicemia fora de ' + GLU_MIN + '–' + GLU_MAX + ' mg/dL', line, glucoseRaw);
      continue;
    }
    if (a1c !== null && a1c >= 3 && a1c <= 20) res.hba.push({ date, value: a1c, line });
    const tags = g(row, 'tags');
    const inf = inferFromTags([tags, g(row, 'ctxLabel'), g(row, 'mealLabel')].join(' '));
    const unk = gn(row, 'insUnk');
    const notes = [g(row, 'notes'), unk > 0 ? 'Insulina: ' + unk + ' U (tipo não informado no arquivo)' : ''].filter(Boolean).join(' · ');
    const rec = compact({
      date, time: time || '00:00', noTime: time ? undefined : true,
      glucose, origGlu,
      tags, context: labelToKey(CONTEXTS, g(row, 'ctxLabel')) || inf.context, meal: labelToKey(MEALS, g(row, 'mealLabel')) || inf.meal,
      carbs: gn(row, 'carbs'),
      insPen: gn(row, 'insPen'), insPump: gn(row, 'insPump'),
      insMeal: gn(row, 'insMeal'), insCorr: gn(row, 'insCorr'), insBasal: gn(row, 'insBasal'),
      tbPct: gn(row, 'tbPct'), tbMin: gn(row, 'tbMin'),
      mealDesc: g(row, 'mealDesc'), foodType: g(row, 'foodType'),
      actMin: gn(row, 'actMin'), actInt: gn(row, 'actInt'), actDesc: g(row, 'actDesc'),
      steps: gn(row, 'steps'), notes,
      bp: g(row, 'bp'), weight: gn(row, 'weight'), ketones: g(row, 'ketones'), medication: g(row, 'medication'),
      source: src
    });
    rec.ts = mkTs(rec.date, rec.time);
    rec.key = dedupKey(rec);
    data.push(rec);
  }
  /* Colunas do arquivo que não têm campo correspondente (e têm conteúdo): avisadas na prévia, nunca em silêncio. */
  rows[hi].forEach((raw, ci) => {
    if (startCols.has(ci) || !String(raw).trim() || res.unmappedCols.length >= 40) return;
    for (let i = hi + 1; i < Math.min(rows.length, hi + 4000); i++) if (String(rows[i][ci] ?? '').trim()) { res.unmappedCols.push(String(raw).trim()); break; }
  });
  if (res.converted) res.unitNote = ('Valores em mmol/L foram convertidos para mg/dL (× ' + String(MMOL).replace('.', ',') + ', com 1 casa decimal); o valor original fica guardado no registro. ' + res.unitNote).trim();
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
    const isHist = x => x.includes('historic glucose') || x.includes('historico de glicose'), isScan = x => x.includes('scan glucose') || x.includes('leitura da glicose') || x.includes('glicose de varredura'), isStrip = x => x.includes('strip glucose') || x.includes('glicose da tira');
    let hist = f(x => isHist(x) && !x.includes('mmol')), scan = f(x => isScan(x) && !x.includes('mmol')), strip = f(x => isStrip(x) && !x.includes('mmol')), mmol = false;
    if (ts >= 0 && hist < 0 && scan < 0 && strip < 0) { hist = f(x => isHist(x) && x.includes('mmol')); scan = f(x => isScan(x) && x.includes('mmol')); strip = f(x => isStrip(x) && x.includes('mmol')); mmol = hist >= 0 || scan >= 0 || strip >= 0; }
    if (ts >= 0 && (hist >= 0 || scan >= 0 || strip >= 0)) {
      return { kind: 'libre', hi: i, ts, hist, scan, strip, mmol, ins: f(x => x.includes('rapid-acting insulin (units)') || x.includes('insulina de acao rapida (unidades)')), carbs: f(x => x.includes('carbohydrates (grams)') || x.includes('carboidratos (gramas)')), notes: f(x => x === 'notes' || x === 'notas') };
    }
    const dts = f(x => x.includes('timestamp') || x.includes('carimbo de data'));
    const et = f(x => x === 'event type' || x === 'tipo de evento');
    let gv = f(x => (x.includes('glucose value') || x.includes('valor de glicose')) && !x.includes('mmol')), dm = false;
    if (gv < 0) { gv = f(x => (x.includes('glucose value') || x.includes('valor de glicose')) && x.includes('mmol')); dm = gv >= 0; }
    if (dts >= 0 && et >= 0 && gv >= 0) return { kind: 'dexcom', hi: i, ts: dts, et, gv, mmol: dm, ins: f(x => x.includes('insulin value') || x.includes('valor de insulina')), carbs: f(x => x.includes('carb value') || x.includes('valor de carboidratos')) };
  }
  return null;
}
function parseSensor(rows, sn, res) {
  const name = sn.kind === 'libre' ? 'FreeStyle Libre (LibreView)' : 'Dexcom Clarity', fac = sn.mmol ? MMOL : 1;
  res.format = name; res.source = sn.kind; res.columns = ['date', 'time', 'glucose'].concat(sn.ins >= 0 ? ['insMeal'] : [], sn.carbs >= 0 ? ['carbs'] : []);
  if (sn.mmol) res.unitNote = 'Valores em mmol/L foram convertidos para mg/dL (× ' + String(MMOL).replace('.', ',') + ', com 1 casa decimal); o valor original fica guardado no registro.';
  const bump = (reason, line, extra) => { res.reasons[reason] = (res.reasons[reason] || 0) + 1; if (res.ignored.length < 200) res.ignored.push({ line, reason, extra: extra || '' }); };
  const AUTO = 'Leitura automática do sensor (a cada 5 ou 15 min; só leituras manuais entram)';
  const data = [];
  for (let i = sn.hi + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(c => !String(c).trim())) { res.emptyRows++; continue; }
    res.totalRows++; const line = i + 1, c = k => (row[k] ?? '').trim();
    const rawTs = normStamp(c(sn.ts)), date = parseDate(rawTs);
    if (!date) { bump('Data não reconhecida', line, rawTs); continue; }
    const m = rawTs.match(/(?:\s|T)(\d{1,2}[:h.]\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)\s*$/), time = m ? parseTime(m[1]) : null;
    let glu = null, auto = false, kind = '', orig;
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
    if (fac !== 1) { orig = glu + ' mmol/L'; glu = Math.round(glu * fac * 10) / 10; res.converted++; }
    if (glu < GLU_MIN || glu > GLU_MAX) { bump('Glicemia fora de ' + GLU_MIN + '–' + GLU_MAX + ' mg/dL', line, String(glu)); continue; }
    const insU = sn.ins >= 0 ? parseNum(c(sn.ins)) : null, cb = sn.carbs >= 0 ? parseNum(c(sn.carbs)) : null, nt = sn.notes >= 0 ? c(sn.notes) : '';
    const rec = compact({ date, time: time || '00:00', noTime: time ? undefined : true, glucose: glu, origGlu: orig, insMeal: insU > 0 ? insU : undefined, carbs: cb > 0 ? cb : undefined, notes: nt, tags: kind, source: sn.kind === 'libre' ? 'libre' : 'dexcom' });
    rec.ts = mkTs(rec.date, rec.time); rec.key = dedupKey(rec); data.push(rec);
  }
  data.sort((a, b) => a.ts - b.ts); res.items = data; res.ok = true;
  if (!data.length) { res.ok = false; res.error = 'Este arquivo de ' + name + ' só tem leituras automáticas do sensor. O TiaBete importa as medições manuais (leituras, tira e calibrações).'; }
  return res;
}

/* ---------- JSON: qualquer lista de registros vira uma tabela (colunas = nomes dos campos) ---------- */
function flattenRec(o, pre, out, depth) {
  for (const k of Object.keys(o)) {
    const v = o[k], key = pre ? pre + '.' + k : k;
    if (Array.isArray(v)) { if (v.every(x => x === null || typeof x !== 'object')) out[key] = v.join('; '); }
    else if (v && typeof v === 'object') { if (depth < 2) flattenRec(v, key, out, depth + 1); }
    else out[key] = v;
  }
  return out;
}
function objsToRows(arr) {
  if (arr.length && arr.every(x => Array.isArray(x))) return arr.map(r => r.map(c => c == null ? '' : String(c)));
  const recs = arr.filter(x => x && typeof x === 'object' && !Array.isArray(x)).slice(0, 500000).map(x => flattenRec(x, '', {}, 0));
  const cols = []; const seen = new Set();
  for (const r of recs) for (const k of Object.keys(r)) if (!seen.has(k) && cols.length < 200) { seen.add(k); cols.push(k); }
  return [cols].concat(recs.map(r => cols.map(k => r[k] == null ? '' : String(r[k]))));
}
function jsonTables(j) {
  const out = [];
  const isRec = a => Array.isArray(a) && a.length && a.some(x => x && typeof x === 'object');
  const walk = (v, path, depth) => {
    if (isRec(v)) { out.push({ name: path || 'JSON', rows: objsToRows(v), delim: ',' }); return; }
    if (v && typeof v === 'object' && !Array.isArray(v) && depth < 4) for (const k of Object.keys(v)) walk(v[k], path ? path + '.' + k : k, depth + 1);
  };
  walk(j, '', 0);
  if (!out.length && j && typeof j === 'object' && !Array.isArray(j)) out.push({ name: 'JSON', rows: objsToRows([j]), delim: ',' });
  return out;
}

/* ---------- Arquivos compactados: ZIP e XLSX (leitura segura, sem biblioteca externa) ---------- */
const ZIP_MAX_ENTRY = 80 * 1024 * 1024, ZIP_MAX_TOTAL = 200 * 1024 * 1024, ZIP_MAX_FILES = 3000;
class ImportError extends Error { }
function zipList(u8) {
  let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 5 && u8[i + 3] === 6) { e = i; break; }
  if (e < 0) throw new ImportError('O arquivo compactado está com defeito (não consegui ler o índice).');
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  if (n > ZIP_MAX_FILES) throw new ImportError('O arquivo compactado tem arquivos demais.');
  const dec = new TextDecoder(), list = []; let total = 0;
  for (let i = 0; i < n; i++) {
    if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) throw new ImportError('O arquivo compactado está com defeito.');
    const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    if (name.endsWith('/')) continue;
    if (usize > ZIP_MAX_ENTRY) throw new ImportError('Um dos arquivos dentro do compactado é grande demais.');
    total += usize; if (total > ZIP_MAX_TOTAL) throw new ImportError('O conteúdo do arquivo compactado é grande demais.');
    list.push({ name, flags, method, csize, usize, lho });
  }
  return list;
}
async function inflateRaw(u8, max) {
  if (typeof DecompressionStream === 'undefined') throw new ImportError('Este aparelho não consegue abrir arquivos compactados (XLSX/ZIP). Exporte o arquivo como CSV e tente de novo.');
  const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter();
  w.write(u8).catch(() => { }); w.close().catch(() => { });
  const rd = ds.readable.getReader(), chunks = []; let total = 0;
  for (; ;) {
    let r; try { r = await rd.read(); } catch (e) { throw new ImportError('O arquivo compactado está com defeito.'); }
    if (r.done) break; total += r.value.length;
    if (total > max) { rd.cancel().catch(() => { }); throw new ImportError('O conteúdo do arquivo compactado é maior do que o declarado.'); }
    chunks.push(r.value);
  }
  const out = new Uint8Array(total); let o = 0; chunks.forEach(c => { out.set(c, o); o += c.length; }); return out;
}
async function zipRead(u8, ent) {
  if (ent.flags & 1) throw new ImportError('O arquivo compactado tem senha. Remova a senha e tente de novo.');
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (ent.lho + 30 > u8.length || dv.getUint32(ent.lho, true) !== 0x04034b50) throw new ImportError('O arquivo compactado está com defeito.');
  const st = ent.lho + 30 + dv.getUint16(ent.lho + 26, true) + dv.getUint16(ent.lho + 28, true), raw = u8.subarray(st, st + ent.csize);
  if (ent.method === 0) return raw;
  if (ent.method === 8) return inflateRaw(raw, ent.usize + 16);
  throw new ImportError('O arquivo compactado usa um método de compressão não suportado.');
}
const xmlUn = s => String(s).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const xmlAttr = (tag, a) => { const m = tag.match(new RegExp('(?:^|[\\s])' + a + '="([^"]*)"')); return m ? xmlUn(m[1]) : ''; };
const xlsxText = x => { const parts = []; String(x).replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').replace(/<t\b[^>]*>([\s\S]*?)<\/t>/g, (_, t) => { parts.push(xmlUn(t)); return ''; }); return parts.join(''); };
function xlsxSerial(v, d1904) {
  let tot = Math.round((v + (d1904 ? 1462 : 0)) * 1440); if (!isFinite(tot) || tot < 0) return String(v);
  const days = Math.floor(tot / 1440), mins = tot - days * 1440, hh = Math.floor(mins / 60), mm = mins % 60, hm = pad(hh) + ':' + pad(mm);
  if (days === 0) return hm;
  const d = new Date(Date.UTC(1899, 11, 30) + days * 86400000), ds = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  return mins ? ds + ' ' + hm : ds;
}
async function xlsxTables(u8, list, fname) {
  const byName = {}; list.forEach(e => { byName[e.name.replace(/^\//, '')] = e; });
  const txt = async n => byName[n] ? new TextDecoder().decode(await zipRead(u8, byName[n])) : '';
  const wb = await txt('xl/workbook.xml'); if (!wb) throw new ImportError('Não consegui ler a planilha (XLSX sem pasta de trabalho).');
  const rels = await txt('xl/_rels/workbook.xml.rels'), relMap = {};
  (rels.match(/<Relationship\b[^>]*>/g) || []).forEach(t => { relMap[xmlAttr(t, 'Id')] = xmlAttr(t, 'Target'); });
  const shared = []; { const ss = await txt('xl/sharedStrings.xml'); (ss.match(/<si\b[^>]*?(?:\/>|>[\s\S]*?<\/si>)/g) || []).forEach(s => shared.push(xlsxText(s))); }
  const isDate = []; {
    const st = await txt('xl/styles.xml'), custom = {};
    (st.match(/<numFmt\b[^>]*>/g) || []).forEach(t => { custom[xmlAttr(t, 'numFmtId')] = xmlAttr(t, 'formatCode'); });
    const cx = (st.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1] || '';
    const builtin = id => (id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47) || (id >= 50 && id <= 58);
    (cx.match(/<xf\b[^>]*>/g) || []).forEach(t => { const id = +xmlAttr(t, 'numFmtId') || 0; const code = custom[id]; isDate.push(code != null ? (/[dmyhs]/i.test(code.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, '')) && !/[#0?]/.test(code.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, '')) ) : builtin(id)); });
  }
  const d1904 = /<workbookPr\b[^>]*date1904="(1|true)"/i.test(wb);
  const tables = []; let cells = 0;
  for (const t of (wb.match(/<sheet\b[^>]*>/g) || [])) {
    const sname = xmlAttr(t, 'name'), rid = xmlAttr(t, 'r:id'); let target = relMap[rid]; if (!target) continue;
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const xml = await txt(target); if (!xml) continue;
    const grid = []; let r0 = -1, rowIdx = -1;
    xml.replace(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, (_, ra, body) => {
      const rn = +xmlAttr(ra, 'r'); rowIdx = rn ? rn - 1 : rowIdx + 1; if (!body) return '';
      let ci = -1;
      body.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (_2, ca, cb) => {
        const ref = xmlAttr(ca, 'r').match(/^([A-Z]+)/); if (ref) { ci = 0; for (const ch of ref[1]) ci = ci * 26 + ch.charCodeAt(0) - 64; ci -= 1; } else ci++;
        if (cb == null || ++cells > 4000000 || ci > 500) return '';
        const ty = xmlAttr(ca, 't'), s = +xmlAttr(ca, 's') || 0; let v = '';
        const vm = cb.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
        if (ty === 's') v = shared[+(vm && vm[1])] ?? '';
        else if (ty === 'inlineStr') v = xlsxText(cb);
        else if (ty === 'str' || ty === 'd') v = vm ? xmlUn(vm[1]) : '';
        else if (ty === 'b') v = vm && vm[1] === '1' ? '1' : '0';
        else if (ty === 'e') v = '';
        else if (vm) v = isDate[s] && isFinite(+vm[1]) ? xlsxSerial(+vm[1], d1904) : vm[1];
        if (v === '') return '';
        (grid[rowIdx] = grid[rowIdx] || [])[ci] = v; return '';
      });
      return '';
    });
    const rows = []; for (let i = 0; i < grid.length; i++) { const r = grid[i] || []; const w = Array.from({ length: r.length }, (_, k) => r[k] ?? ''); rows.push(w); }
    if (rows.length) tables.push({ name: (fname ? fname + ' · ' : '') + sname, rows, delim: ',' });
  }
  if (!tables.length) throw new ImportError('A planilha está vazia.');
  return tables;
}
function decodeText(u8) {
  if (u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(u8.subarray(2));
  if (u8[0] === 0xFE && u8[1] === 0xFF) return new TextDecoder('utf-16be').decode(u8.subarray(2));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (e) { return new TextDecoder('windows-1252').decode(u8); }
}
function sniffFormat(u8) {
  if (u8[0] === 0x50 && u8[1] === 0x4b && (u8[2] === 3 || u8[2] === 5)) return 'zip';
  if (u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0) return 'xls';
  if (u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46) return 'pdf';
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E) return 'img';
  if (u8[0] === 0xFF && u8[1] === 0xD8) return 'img';
  return 'text';
}
/* Detecta o formato pelo CONTEÚDO (não pela extensão) e devolve as tabelas encontradas. */
async function tablesFromBytes(name, u8, depth) {
  const kind = sniffFormat(u8);
  if (kind === 'xls') throw new ImportError('Este é um arquivo Excel antigo (.xls), que não dá para ler com segurança aqui. Abra no Excel ou em Planilhas, use "Salvar como" .xlsx ou .csv e escolha o novo arquivo.');
  if (kind === 'pdf' || kind === 'img') throw new ImportError('Este arquivo é ' + (kind === 'pdf' ? 'um PDF' : 'uma imagem') + ', não uma exportação de dados. Use CSV, XLSX, JSON ou ZIP.');
  if (kind === 'zip') {
    const list = zipList(u8);
    if (list.some(e => e.name.replace(/^\//, '') === 'xl/workbook.xml')) return { tables: await xlsxTables(u8, list, name), kind: 'XLSX' };
    if (depth > 0) throw new ImportError('Arquivo compactado dentro de outro compactado não é suportado.');
    const out = [], skipped = [];
    for (const e of list) {
      const base = e.name.split('/').pop();
      if (!base || base.startsWith('.') || /^__MACOSX/.test(e.name)) continue;
      if (!/\.(csv|tsv|txt|json|xlsx)$/i.test(base)) { skipped.push({ name: base, error: 'Tipo de arquivo não suportado.' }); continue; }
      try { const r = await tablesFromBytes(base, await zipRead(u8, e), depth + 1); r.tables.forEach(t => out.push({ ...t, name: base + (t.name && t.name !== base ? ' · ' + t.name.replace(base + ' · ', '') : '') })); }
      catch (err) { if (err instanceof ImportError) skipped.push({ name: base, error: err.message }); else throw err; }
    }
    if (!out.length) { const bad = skipped.find(x => x.error !== 'Tipo de arquivo não suportado.'); throw new ImportError(bad ? bad.name + ': ' + bad.error : 'Não encontrei CSV, XLSX ou JSON dentro do arquivo compactado.'); }
    return { tables: out, kind: 'ZIP', skipped };
  }
  const tt = tablesFromText(decodeText(u8)); if (tt.error) throw new ImportError(tt.error);
  tt.tables.forEach(t => { t.name = depth > 0 ? name : t.name; }); return tt;
}
/* Ponto de entrada da tela: recebe o conteúdo do arquivo escolhido, devolve a mesma estrutura de parseMySugr. Nunca grava nada. */
async function parseImportFile(name, buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (!u8.length) { const r = newResult(); r.error = 'O arquivo está vazio.'; return r; }
  try {
    const tt = await tablesFromBytes(name || 'arquivo', u8, 0);
    const r = parseImportTables(tt.tables); r.fileKind = tt.kind;
    if (tt.skipped && tt.skipped.length) r.skipped = (r.skipped || []).concat(tt.skipped);
    if (!r.ok && r.skipped && r.skipped.length && tt.kind === 'ZIP') r.error = r.error || 'Nenhum arquivo dentro do compactado tem medições de glicemia.';
    return r;
  } catch (e) {
    if (e instanceof ImportError) { const r = newResult(); r.error = e.message; return r; }
    const r = newResult(); r.error = 'Não consegui ler este arquivo. Ele pode estar corrompido ou em um formato que o TiaBete não conhece.'; return r;
  }
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
  { a: 8, b: 10, label: '08h–10h', context: 'depois', meal: 'cafe', name: 'Depois do café da manhã' },
  { a: 10, b: 12, label: '10h–12h', context: 'antes', meal: 'almoco', name: 'Antes do almoço' },
  { a: 12, b: 16, label: '12h–16h', context: 'depois', meal: 'almoco', name: 'Depois do almoço' },
  { a: 16, b: 19, label: '16h–19h', context: 'antes', meal: 'jantar', name: 'Antes do jantar' },
  { a: 19, b: 24, label: '19h–00h', context: 'depois', meal: 'jantar', name: 'Depois do jantar' }
];
function ruleFor(rec) {
  if (!rec || rec.noTime || !rec.time) return null;
  const h = parseInt(String(rec.time).slice(0, 2), 10);
  return TIME_RULE.find(w => h >= w.a && h < w.b) || null;
}
/* Classificação-alvo de uma medição.
   mode 'horario': pela regra de horários.
   mode 'etiquetas': pelas etiquetas do mySugr (Pré/Depois da refeição, Jejum, refeição); o horário só completa o que a etiqueta não diz. */
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
/* Regra única de validação (todas as categorias):
   - um dia só conta depois de ENCERRADO (hoje fica "aguardando validação");
   - dia válido = ao menos uma medição relevante e NENHUMA fora do limite (todas as medições do dia são consideradas);
   - dia sem medição relevante não cumpre a meta (ausência nunca vira cumprimento) e interrompe a sequência;
   - uma medição fora do limite hoje já é falha definitiva (nenhuma medição nova desfaz) e zera a sequência;
   - a sequência é sempre recalculada do histórico completo, então editar/excluir registros antigos corrige tudo. */
function rewardEval(records, todayIso, skip) {
  const real = (records || []).filter(r => r && r.source !== 'exemplo' && r.date && typeof r.glucose === 'number'), t = dayNum(todayIso), out = {};
  for (const [k, c] of Object.entries(RW_CATS)) {
    const byDay = new Map(), sk = skip && skip[k];
    for (const r of real) { const d = dayNum(r.date); if (d > t || !c.rel(r) || (sk && sk.has(d))) continue; const e = byDay.get(d) || { n: 0, bad: 0 }; e.n++; if (c.bad(r)) e.bad++; byDay.set(d, e); }
    if (!byDay.size) { out[k] = { streak: 0, ach: {}, n: 0, state: 'aguardando', today: 'empty', prev: 0, brokeOn: null, cycles: 0 }; continue; }
    const first = Math.min(...byDay.keys());
    let run = 0, prev = 0, brokeOn = null, cycles = 0, n = 0;
    for (const e of byDay.values()) n += e.n;
    for (let d = first; d < t; d++) {
      if (sk && sk.has(d)) continue; /* dia com a conquista desativada: não conta nem quebra */
      const e = byDay.get(d);
      if (e && !e.bad) run++;
      else { if (run > 0) { prev = run; brokeOn = d; cycles++; } run = 0; }
    }
    const te = byDay.get(t), today = !te ? 'empty' : te.bad ? 'bad' : 'pending';
    if (today === 'bad') { if (run > 0) { prev = run; brokeOn = t; cycles++; } run = 0; }
    const ach = {}; for (const N of RW_STEPS) ach[N] = run >= N;
    const state = run > 0 ? (ach[RW_STEPS[RW_STEPS.length - 1]] ? 'concluida' : cycles > 0 ? 'reiniciada' : 'andamento') : (prev > 0 ? 'quebrada' : 'aguardando');
    out[k] = { streak: run, ach, n, state, today, prev, brokeOn, cycles };
  }
  return out;
}



/* ---------- Alertas personalizados (lógica pura; não calcula nem sugere doses) ----------
   Regra: { id, name, on, trig:{k:'mark'|'low'|'high', mark?, v?}, when:{t:'meal'|'time'|'after', meal?, lead?, time?, min?}, freq:'each'|'daily'|'once', msg }
   Um alerta só existe enquanto a condição existir nos registros de HOJE: apagar/editar o registro cancela o aviso. */
const CA_MEAL_DEF = { cafe: '07:00', almoco: '12:00', lanche: '16:00', jantar: '19:00' };
const CA_MAXMSG = 240;
function caMealTimes(records, now) {
  const out = { ...CA_MEAL_DEF }, from = now - 45 * 864e5;
  for (const k of Object.keys(CA_MEAL_DEF)) {
    const ms = (records || []).filter(r => r && r.source !== 'exemplo' && r.meal === k && r.time && r.ts >= from && r.ts <= now && (!r.context || r.context === 'antes' || r.context === 'jejum')).map(r => { const [h, m] = r.time.split(':').map(Number); return h * 60 + m; }).sort((a, b) => a - b);
    if (ms.length >= 3) { const md = ms[Math.floor(ms.length / 2)]; out[k] = pad(Math.floor(md / 60)) + ':' + pad(md % 60); }
  }
  return out;
}
function caClean(r) {
  r = r || {}; const t = r.trig || {}, w = r.when || {};
  const k = ['mark', 'low', 'high'].includes(t.k) ? t.k : 'mark', num = x => { x = +x; return isFinite(x) ? Math.min(600, Math.max(20, Math.round(x))) : (k === 'low' ? 70 : 250); };
  const wt = ['meal', 'time', 'after'].includes(w.t) ? w.t : 'meal';
  return {
    id: String(r.id || ('ca' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6))), name: String(r.name || 'Meu alerta').slice(0, 60).trim() || 'Meu alerta', on: r.on !== false,
    trig: k === 'mark' ? { k, mark: String(t.mark || 'perna').slice(0, 20) } : { k, v: num(t.v) },
    when: wt === 'meal' ? { t: wt, meal: ['next', ...Object.keys(CA_MEAL_DEF)].includes(w.meal) ? w.meal : 'next', lead: [0, 15, 30, 60].includes(+w.lead) ? +w.lead : 0 } : wt === 'time' ? { t: wt, time: /^\d\d:\d\d$/.test(w.time) ? w.time : '12:00' } : { t: wt, min: Math.min(720, Math.max(5, Math.round(+w.min) || 30)) },
    freq: ['each', 'daily', 'once'].includes(r.freq) ? r.freq : 'daily', msg: String(r.msg || '').slice(0, CA_MAXMSG).trim()
  };
}
function caHash(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return 710000 + (Math.abs(h) % 80000); }
/* o id dos registros manuais começa com a hora de criação em base 36 */
function caBorn(r) { const n = parseInt(String(r.id || '').slice(0, 8), 36); return isFinite(n) && n > 1.7e12 && n < 4.1e12 && Math.abs(n - r.ts) < 30 * 864e5 ? n : r.ts; }
function caOccur(rule, records, today) {
  const t = rule.trig;
  return (records || []).filter(r => r && r.source !== 'exemplo' && r.date === today && typeof r.ts === 'number' && (t.k === 'mark' ? (r.marks || []).includes(t.mark) : t.k === 'low' ? typeof r.glucose === 'number' && r.glucose < t.v : typeof r.glucose === 'number' && r.glucose > t.v)).sort((a, b) => a.ts - b.ts);
}
function caInQuiet(ts, q) { if (!q || !q.on) return false; const d = new Date(ts), v = d.getHours() * 60 + d.getMinutes(), m = x => { const [h, mi] = String(x).split(':').map(Number); return h * 60 + mi; }, f = m(q.from), e = m(q.to); return f === e ? false : f < e ? (v >= f && v < e) : (v >= f || v < e); }
function caAfterQuiet(ts, q) { let t = ts, n = 0; while (caInQuiet(t, q) && n++ < 400) t += 5 * 60000; return t; }
function caCompute(rules, records, now, opts) {
  opts = opts || {}; const st = opts.state || {}, today = isoDate(new Date(now)), mt = opts.mealTimes || caMealTimes(records, now), q = opts.quiet, out = [], seen = new Set();
  const dayTs = (day, hm) => mkTs(day, hm), tomorrow = isoDate(new Date(dayTs(today, '12:00') + 864e5));
  for (const raw of rules || []) {
    const rule = caClean(raw); if (!raw || raw.on === false || (rule.freq === 'once' && st.once && st.once[rule.id])) continue;
    let occ = caOccur(rule, records, today); if (!occ.length) continue;
    occ = rule.freq === 'each' ? occ.slice(0, 6) : [occ[0]];
    for (const o of occ) {
      const t0 = o.ts, w = rule.when; let at = null;
      if (w.t === 'after') at = t0 + w.min * 60000;
      else if (w.t === 'time') { at = dayTs(today, w.time); if (at <= t0) at = dayTs(tomorrow, w.time); }
      else {
        const cand = (w.meal === 'next' ? Object.entries(mt) : [[w.meal, mt[w.meal]]]).map(([k, hm]) => dayTs(today, hm)).sort((a, b) => a - b);
        const base = Math.max(t0, caBorn(o)); /* registro lançado depois da hora: conta a partir do momento em que foi criado (estável, sem duplicar avisos) */
        let m = cand.find(x => x - w.lead * 60000 > base);
        if (m == null && w.meal === 'next') m = Math.min(...Object.values(mt).map(hm => dayTs(tomorrow, hm)));
        if (m == null) continue;
        at = m - w.lead * 60000;
      }
      at = caAfterQuiet(at, q); if (at < now - 3 * 3600e3) continue;
      const key = rule.id + '|' + Math.round(at / 60000); if (seen.has(key)) continue; seen.add(key);
      out.push({ key, id: caHash(key), ruleId: rule.id, name: rule.name, at, title: 'TiaBete · ' + rule.name, body: rule.msg || 'Alerta personalizado: confira sua orientação.', route: 'alertasp' });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
function caPresets() {
  return [
    { name: 'Dia de perna', trig: { k: 'mark', mark: 'perna' }, when: { t: 'meal', meal: 'next', lead: 0 }, freq: 'daily', msg: 'Dia de perna identificado! Lembre-se de considerar seu ajuste personalizado de insulina na próxima refeição. Confira sua orientação antes de aplicar.' },
    { name: 'Treino de membros superiores', trig: { k: 'mark', mark: 'superiores' }, when: { t: 'meal', meal: 'next', lead: 0 }, freq: 'daily', msg: 'Dia de treino de membros superiores. Confira sua orientação pessoal antes da próxima refeição.' },
    { name: 'Atividade física prolongada', trig: { k: 'mark', mark: 'ativ' }, when: { t: 'after', min: 120 }, freq: 'daily', msg: 'Atividade física prolongada registrada. Meça sua glicemia e confira seu plano.' },
    { name: 'Glicemia abaixo de…', trig: { k: 'low', v: 70 }, when: { t: 'after', min: 15 }, freq: 'each', msg: 'Passou um tempo desde uma glicemia baixa. Meça de novo e siga o protocolo do seu médico.' },
    { name: 'Glicemia acima de…', trig: { k: 'high', v: 250 }, when: { t: 'after', min: 60 }, freq: 'each', msg: 'Glicemia alta registrada. Meça de novo e confira a orientação do seu médico.' }
  ];
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
  module.exports = { TIME_BLOCKS, MIN_BUCKET, CONTEXTS, MEALS, groupBy, byTimeBlock, weekStart, monthStart, stats, bandOf, bandCounts, inRange, periodRanges, compareStats, startOfDay, endOfDay, addDays, mkTs, isoDate, fmtDate, dailyMeans, trend, estimatedA1c, DAY, caClean, caCompute, caMealTimes, caPresets, caHash, CA_MEAL_DEF, HYPO_PROTO, HYPO_TAG, hypoClass, hypoEpisode, hypoStamp, LIM, hypoEpisodes, patternNotes, typicalDay, pctl, rewardEval, RW_STEPS, circMean, wrapDiff, hhmm, insStats, minOfDay, a1cEval, A1C_TARGET_DEFAULT, examFlag, examDev, examScore, examBand, cleanExam, hashText, compareExams, examKey, inferFromTags, targetFor, TIME_RULE, ruleFor, applyRule, undoRule, FAST, highOf, MONTHS, norm, parseMySugr, parseImportText, parseImportFile, parseImportTables, jsonTables, normStamp, mapColumns, MMOL, SOURCE_NAMES, parseNum, parseDate, parseTime, parseCSV, detectDelim, stats, periodRanges, compareStats, bandOf, mkTs, isoDate, dedupKey, trend, byTimeBlock, estimatedA1c, schemeOf, weekStart, dailyMeans, bandCounts, inRange, addDays, startOfDay, endOfDay };
}
