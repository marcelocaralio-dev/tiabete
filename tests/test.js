const L=require('../src/logic.js');
const header='Data,Horário,Etiquetas,Aferição da Glicemia (mg/dL),Unidades de Injeção de Insulina (Caneta),Unidades de Injeção Basal,Unidades de Injeção de Insulina (bomba),Insulina (Refeição),Insulina (correção),Porcentagem Basal Temporária,Duração Basal Temporária (Minutos),"Carboidratos na Refeição (Gramas, Fator 1)",Descrições de Refeições,Duração da Atividade (Minutos),"Intensidade da Atividade (1: Confortável, 2: Normal, 3: Rigorosa)",Descrição da Atividade,Passos,Nota,Localização,Pressão sanguínea,Peso corporal (kg),HbA1c (Porcentagem),Cetonas,Tipo de alimento,Medicação,Fuso horário,Latitude,Longitude';
const rows=[
'03/11/2026,07:15,"Jejum, Café da Manhã","112",,,,,,,,,"pão, ovo",,,,,"Acordei bem",Limoeiro,,,,,,,America/Fortaleza,-5.1,-38.0',
'03/11/2026,12:30,Almoço,"185,5",6,,,5,1,,,"62,5","arroz, feijão",30,2,Caminhada,3200,"Nota com ""aspas"" e\nquebra",,,,,,,,,,',
'03/11/2026,12:30,Almoço,"185,5",6,,,5,1,,,"62,5",,,,,,,,,,,,,,,,',
'04/11/2026,,Lanche,95,,,,,,,,,,,,,,,,,,,,,,,,',
'05/11/2026,08:00,,,,12,,,,,,,,,,,,,,,,,,,,,,',
'32/13/2026,08:00,,100,,,,,,,,,,,,,,,,,,,,,,,,',
'06/11/2026,08:00,,HI,,,,,,,,,,,,,,,,,,,,,,,,',
'06/11/2026,09:00,,,,,,,,,,,,,,,,,,,,6.8,,,,,,',
'07/11/2026,10:00,Depois da refeição,2500,,,,,,,,,,,,,,,,,,,,,,,,',
'',
];
const csv='﻿'+header+'\n'+rows.join('\n');
const r=L.parseMySugr(csv);
console.log('ok',r.ok,'delim',JSON.stringify(r.delim),'cols',r.columns.length,'ignoredCols',r.ignoredCols);
console.log('items',r.items.length);
r.items.forEach(i=>console.log(JSON.stringify(i)));
console.log('ignored',JSON.stringify(r.reasons),'hba',JSON.stringify(r.hba),'other',r.withOtherData,'total',r.totalRows,'empty',r.emptyRows);
// semicolon + decimal comma
const csv2='Data;Horário;Aferição da Glicemia (mg/dL);Carboidratos na Refeição (Gramas, Fator 1)\n"03/11/2026";"07:00";"110";"45,5"\n';
const r2=L.parseMySugr(csv2); console.log('semi',r2.ok,r2.delim,JSON.stringify(r2.items[0]));
console.log(L.parseNum('1.234,5'),L.parseNum('1,234.5'),L.parseNum('5,5'),L.parseNum('5.5'),L.parseNum('abc'),L.parseNum(''));
console.log(L.parseDate('2026-11-03'),L.parseDate('3/1/26'),L.parseDate('31/02/2026'),L.parseTime('9:05 PM'),L.parseTime('07h30'));
// periods
const now=new Date(2026,10,4,18,0).getTime();
const p=L.periodRanges(30,now); console.log(new Date(p.cur[0]).toISOString(),new Date(p.cur[1]).toISOString(),new Date(p.prev[0]).toISOString(),new Date(p.prev[1]).toISOString());
console.log(L.stats([{glucose:60},{glucose:100},{glucose:200}]));
console.log(L.compareStats({mean:140},{mean:130}),L.compareStats({mean:140},{mean:null}));
console.log(L.parseMySugr('foo,bar\n1,2').error);
