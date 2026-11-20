// test26: importador universal ("Importar de outros aplicativos"): formatos, apps, unidades, segurança e compatibilidade com o mySugr.
const L = require('../src/logic.js'), fs = require('fs'), path = require('path'), zlib = require('zlib');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const FX = f => fs.readFileSync(path.join(__dirname, 'fixtures', 'import', f));
const loc = iso => { const d = new Date(iso); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
(async () => {
  /* ---- compatibilidade: tudo que o importador do mySugr já aceitava continua igual ---- */
  let r = L.parseMySugr('Data,Horário,Etiquetas,Aferição da Glicemia (mg/dL),Carboidratos (gramas),Localização\n03/11/2026,06:30,Jejum,128,,Casa\n');
  ok(r.ok && r.source === 'mysugr' && r.format === 'mySugr' && r.items[0].source === 'mysugr' && r.items[0].context === 'jejum' && r.items[0].glucose === 128, 'mySugr: continua reconhecido, source "mysugr", etiqueta Jejum');
  ok(r.ignoredCols.includes('_location') && !JSON.stringify(r.items[0]).includes('Casa'), 'mySugr: localização descartada');
  ok(L.parseImportText('Data,Horário,Aferição da Glicemia (mg/dL)\n03/11/2026,07:00,100\n').items.length === 1, 'parseImportText aceita o mesmo CSV');
  ok(!L.parseMySugr('nada,a,ver\n1,2,3').ok && /data e de glicemia/.test(L.parseMySugr('nada,a,ver\n1,2,3').error), 'arquivo sem colunas úteis: erro claro, genérico (sem citar um app só)');
  /* ---- unidades ---- */
  r = L.parseMySugr('Data,Horário,Aferição da Glicemia (mmol/L)\n03/11/2026,07:00,5.5\n03/11/2026,08:00,"6,1"\n');
  ok(r.ok && r.items[0].glucose === 99.1 && r.items[1].glucose === 109.9 && r.converted === 2 && r.items[0].origGlu === '5.5 mmol/L', 'mmol/L no cabeçalho: convertido com 1 casa e valor original guardado');
  r = L.parseImportText('Date,Time,Glucose,Unit\n2026-11-03,07:00,5.5,mmol/L\n2026-11-03,08:00,120,mg/dL\n');
  ok(r.ok && r.items[0].glucose === 99.1 && r.items[1].glucose === 120 && r.converted === 1, 'coluna Unidade: conversão linha a linha');
  r = L.parseImportText('Date,Time,Glucose\n2026-11-03,07:00,5.5\n2026-11-03,08:00,7.2\n');
  ok(r.ok && r.items[0].glucose === 99.1 && /mmol/.test(r.unitNote) && /não está no arquivo/.test(r.unitNote), 'sem unidade e valores pequenos: tratado como mmol/L, com aviso');
  r = L.parseImportText('Date,Time,Glucose\n2026-11-03,07:00,98\n2026-11-03,08:00,7.2\n');
  ok(r.ok && r.items[0].glucose === 98 && r.converted === 0, 'sem unidade e valores normais: mg/dL, nada convertido');
  r = L.parseImportText('Date,Time,Glucose\n2026-11-03,07:00,5.6 mmol/L\n');
  ok(r.items[0].glucose === 100.9, 'unidade escrita junto do número');
  /* ---- aplicativos ---- */
  r = await L.parseImportFile('glooko.csv', FX('glooko.csv'));
  ok(r.ok && r.source === 'glooko' && r.format === 'Glooko' && r.items.length === 2 && r.items[0].glucose === 112, 'Glooko CSV (linha de identificação + Timestamp)');
  r = await L.parseImportFile('b.csv', FX('glooko_bolus.csv'));
  ok(r.ok && r.items[0].glucose === 150 && r.items[0].carbs === 60 && r.items[0].insMeal === 7.5 && r.withOtherData === 1 && r.unmappedCols.includes('Insulin Type'), 'Glooko bolus: glicemia, carbo e insulina; sem glicemia vira "ignorado"; coluna sem destino é avisada');
  r = await L.parseImportFile('cgm.csv', FX('glooko_cgm.csv'));
  ok(!r.ok && /sensor/.test(r.error), 'Glooko só com CGM: recusado com explicação');
  r = await L.parseImportFile('libre.csv', FX('libre_mmol.csv'));
  ok(r.ok && r.source === 'libre' && r.items.length === 1 && r.items[0].glucose === 122.5 && r.converted === 1, 'Libre em mmol/L: leitura manual convertida, automáticas ignoradas');
  r = await L.parseImportFile('dex.csv', FX('dexcom_mmol.csv'));
  ok(r.ok && r.source === 'dexcom' && r.items.length === 1 && r.items[0].glucose === 109.9, 'Dexcom em mmol/L: calibração convertida');
  ok(L.parseMySugr('Device Timestamp,Record Type,Historic Glucose mg/dL,Scan Glucose mg/dL\n03-11-2026 07:00,1,100,\n03-11-2026 08:00,1,,95\n').items.length === 1, 'Libre em mg/dL continua igual');
  /* ---- formatos ---- */

  r = await L.parseImportFile('x.xlsx', FX('diabetesm.xlsx'));
  ok(r.ok && r.fileKind === 'XLSX' && r.source === 'diabetesm' && r.items.length === 3, 'XLSX real (compactado): lido, origem Diabetes:M, linhas de título ignoradas');
  ok(r.items[0].date === '2026-11-03' && r.items[0].time === '07:15' && r.items[0].glucose === 100.9 && r.items[0].context === 'jejum', 'XLSX: data/hora de célula formatada e glicose em mmol/L');
  ok(r.items[1].carbs === 60 && /Insulina: 5 U/.test(r.items[1].notes) && r.items[1].context === 'antes' && r.items[1].meal === 'almoco', 'XLSX: carboidratos, insulina sem tipo vai para a nota (não é classificada), categoria vira contexto/refeição');
  ok(r.skipped.length === 1 && /Vazia/.test(r.skipped[0].name), 'XLSX: aba sem dados listada como não importada');
  r = await L.parseImportFile('n.json', FX('nightscout.json'));
  ok(r.ok && r.fileKind === 'JSON' && r.items.length === 1 && r.items[0].glucose === 130 && r.items[0].date + ' ' + r.items[0].time === loc('2026-11-03T10:15:00Z'), 'JSON: ISO com fuso vira horário local; leitura de sensor (sgv) ignorada');
  r = await L.parseImportFile('g.json', FX('generico.json'));
  ok(r.ok && r.items.length === 2 && r.items[0].glucose === 109.9 && r.items[0].notes === 'cafe' && r.items[1].glucose === 210, 'JSON genérico com objetos aninhados e unidade por registro');
  ok(L.parseImportText('{"data":[{"date":"2026-11-03","time":"07:00","glucose":100}]}').items.length === 1, 'JSON como texto (lista dentro de "data")');
  ok(!L.parseImportText('{"a":').ok && /JSON/.test(L.parseImportText('{"a":').error), 'JSON quebrado: erro claro');
  r = await L.parseImportFile('e.zip', FX('glooko_export.zip'));
  ok(r.ok && r.fileKind === 'ZIP' && r.items.length === 3 && r.skipped.length === 2, 'ZIP com vários CSV: junta os que têm glicemia e lista os que não puderam ser importados');
  r = await L.parseImportFile('a.xls', FX('legacy.xls'));
  ok(!r.ok && /\.xlsx/.test(r.error), '.xls antigo: orientação para salvar como .xlsx/.csv (não é lido às cegas)');
  r = await L.parseImportFile('renomeado.csv', FX('diabetesm.xlsx'));
  ok(r.ok && r.fileKind === 'XLSX', 'formato detectado pelo conteúdo, não pela extensão');
  r = await L.parseImportFile('x.pdf', Buffer.from('%PDF-1.4 ...'));
  ok(!r.ok && /PDF/.test(r.error), 'PDF recusado com mensagem');
  r = await L.parseImportFile('v.csv', Buffer.alloc(0)); ok(!r.ok && /vazio/.test(r.error), 'arquivo vazio');
  const u16 = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from('Data,Aferição da Glicemia (mg/dL)\n03/11/2026 07:00,110\n', 'utf16le')]);
  r = await L.parseImportFile('u.csv', u16); ok(r.ok && r.items.length === 1, 'CSV em UTF-16');
  r = await L.parseImportFile('w.csv', Buffer.from('Data;Horário;Glicemia (mg/dL);Notas\n03/11/2026;07:00;110;caf\xe9\n', 'latin1')); ok(r.ok && r.items[0].notes === 'café', 'CSV em Windows-1252');
  r = await L.parseImportFile('s.csv', Buffer.from('sep=;\nData;Hora;Glicemia\n03/11/2026;07:00;110\n')); ok(r.ok && r.items.length === 1, 'linha "sep=;" do Excel');
  /* ---- segurança ---- */
  const mkZip = (name, raw, lieUsize) => { const c = zlib.deflateRawSync(raw), nm = Buffer.from(name), lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(c.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26); const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(c.length, 20); ch.writeUInt32LE(lieUsize ?? raw.length, 24); ch.writeUInt16LE(nm.length, 28); const cdOff = lh.length + nm.length + c.length, cd = Buffer.concat([ch, nm]), eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(1, 8); eo.writeUInt16LE(1, 10); eo.writeUInt32LE(cd.length, 12); eo.writeUInt32LE(cdOff, 16); return Buffer.concat([lh, nm, c, cd, eo]); };
  r = await L.parseImportFile('ok.zip', mkZip('a.csv', Buffer.from('Data,Hora,Glicemia (mg/dL)\n03/11/2026,07:00,110\n'))); ok(r.ok && r.items.length === 1, 'ZIP simples montado à mão é lido (valida o leitor)');
  r = await L.parseImportFile('bomba.zip', mkZip('a.csv', Buffer.alloc(120 * 1024 * 1024, 48))); ok(!r.ok && /grande/.test(r.error), 'ZIP que declara conteúdo enorme é recusado antes de abrir');
  r = await L.parseImportFile('mentira.zip', mkZip('a.csv', Buffer.alloc(30 * 1024 * 1024, 48), 1000)); ok(!r.ok && /maior do que o declarado|defeito|grande/.test(r.error), 'ZIP que mente sobre o tamanho é interrompido (sem estourar memória)');
  const zt = FX('glooko_export.zip'); r = await L.parseImportFile('t.zip', zt.subarray(0, zt.length - 40)); ok(!r.ok && r.error, 'ZIP truncado: erro, sem travar');
  r = await L.parseImportFile('lixo.bin', Buffer.from([1, 2, 3, 250, 251, 0, 0, 9])); ok(!r.ok && r.error, 'binário aleatório: erro, sem travar');
  const before = JSON.stringify(L.parseImportText('Data,Horário,Aferição da Glicemia (mg/dL)\n03/11/2026,07:00,100\n'));
  ok(before === JSON.stringify(L.parseImportText('Data,Horário,Aferição da Glicemia (mg/dL)\n03/11/2026,07:00,100\n')), 'análise é determinística e não grava nada (função pura)');
  /* ---- textos da interface: nada preso a um único aplicativo ---- */
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8'), dr = fs.readFileSync(path.join(__dirname, '..', 'src', 'drawer.js'), 'utf8'), ic = fs.readFileSync(path.join(__dirname, '..', 'src', 'iconset.js'), 'utf8');
  ok(!/Importar do mySugr|Importar CSV do mySugr|Importe o CSV do mySugr/.test(app + dr + ic), 'rótulos antigos "Importar do mySugr" removidos');
  ok(/importar: 'Importar de outros aplicativos'/.test(app) && /\['importar', 'Importar de outros aplicativos'/.test(app + dr) && /\['Importar de outros aplicativos', MI\.importar\]/.test(ic), 'título, menu, gaveta e tabela de ícones usam "Importar de outros aplicativos"');
  ok(/accept="[^"]*\.csv[^"]*\.json[^"]*\.xlsx[^"]*\.zip/.test(app), 'seletor de arquivo aceita CSV, XLSX, JSON e ZIP');
  ok(/Store\.delMany\('records', add\.map/.test(app) && !/Store\.del\('records'/.test(app.slice(app.indexOf('async function commitImport'), app.indexOf('/* ---------- Aviso: últimas'))), 'gravação desfaz o que acrescentou se a segunda etapa falhar e nunca apaga registros existentes');
  console.log(fail ? 'test26 FALHOU (' + fail + ')' : 'test26 ok (' + n + ' verificações)'); process.exit(fail ? 1 : 0);
})();
