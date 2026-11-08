const L=require('../src/logic.js'); let fail=0;
const ok=(c,m)=>{ if(!c){fail++;console.log('FALHA',m);} else console.log('ok   ',m); };
// data+hora na mesma célula, dia/mês de 1 dígito
let r=L.parseMySugr('Data,Aferição da Glicemia (mg/dL)\n3/1/2026 7:15,110\n03/01/2026 07:15,111\n"3 de nov. de 2026 21:40",95\n');
ok(r.items.length===3,'3 linhas lidas'); ok(r.items[0].time==='07:15'&&r.items[1].time==='07:15','hora embutida (7:15 e 07:15)'); ok(r.items[2].time==='21:40'&&r.items[2].date==='2026-11-03','data por extenso com hora');
// mmol/L
r=L.parseMySugr('Data,Horário,Aferição da Glicemia (mmol/L)\n03/11/2026,07:00,5.5\n'); ok(!r.ok && /mmol/.test(r.error),'mmol/L recusado com mensagem clara');
// CSV exportado pelo próprio app (ida e volta)
const exp='﻿Data;Horário;Glicemia (mg/dL);Contexto;Refeição;Carboidratos (g);Insulina rápida (U);Correção (U);Basal (U);Caneta (U);Bomba (U);Atividade (min);Atividade;Etiquetas;Observações;Esquema;Origem\r\n03/11/2026;12:30;185,5;Antes da refeição;Almoço;62,5;5;1;;6;;30;Caminhada;Almoço;"Nota; com ponto e vírgula";Esquema A;manual\r\n';
r=L.parseMySugr(exp); const i=r.items[0]||{};
ok(r.ok&&r.delim===';','delimitador ; detectado'); ok(i.glucose===185.5&&i.context==='antes'&&i.meal==='almoco','contexto/refeição reconhecidos');
ok(i.carbs===62.5&&i.insMeal===5&&i.insCorr===1&&i.insPen===6&&i.actMin===30&&i.actDesc==='Caminhada','doses e atividade preservadas, separadas'); ok(i.notes==='Nota; com ponto e vírgula','observação com ; preservada');
ok(i.insBasal===undefined&&i.insPump===undefined,'campos vazios não viram 0');
// CRLF, aspas duplas e quebra de linha em nota
r=L.parseMySugr('Data,Horário,Aferição da Glicemia (mg/dL),Nota\r\n03/11/2026,07:00,100,"linha1\r\nlinha ""2"""\r\n03/11/2026,08:00,101,\r\n'); ok(r.items.length===2&&r.items[0].notes.includes('"2"'),'CRLF e aspas escapadas');
// linhas de lixo / sem cabeçalho
r=L.parseMySugr('nada,a,ver\n1,2,3'); ok(!r.ok,'cabeçalho ausente tratado');
r=L.parseMySugr(''); ok(!r.ok,'arquivo vazio tratado');
// linhas com menos colunas que o cabeçalho
r=L.parseMySugr('Data,Horário,Aferição da Glicemia (mg/dL),Nota\n03/11/2026,07:00,100\n'); ok(r.items.length===1,'linha curta aceita');
// glicemia 0, negativa, texto
r=L.parseMySugr('Data,Horário,Aferição da Glicemia (mg/dL)\n03/11/2026,07:00,0\n03/11/2026,07:01,-5\n03/11/2026,07:02,LO\n03/11/2026,07:03,99\n'); ok(r.items.length===1&&Object.values(r.reasons).reduce((a,b)=>a+b,0)===3,'valores inválidos ignorados e contados');
// ordem cronológica
r=L.parseMySugr('Data,Horário,Aferição da Glicemia (mg/dL)\n05/11/2026,07:00,100\n03/11/2026,07:00,101\n04/11/2026,07:00,102\n'); ok(r.items.map(x=>x.date).join()==='2026-11-03,2026-11-04,2026-11-05','importado em ordem cronológica');
// localização/coordenadas nunca guardadas
r=L.parseMySugr('Data,Horário,Aferição da Glicemia (mg/dL),Localização,Latitude,Longitude,Fuso horário\n03/11/2026,07:00,100,Casa,-5.1,-38.0,America/Fortaleza\n'); ok(!('Localização' in r.items[0])&&!JSON.stringify(r.items[0]).match(/Casa|-5\.1|-38|Fortaleza/),'localização descartada');
console.log(fail?('\n'+fail+' falhas'):'\ntudo certo'); process.exit(fail?1:0);
