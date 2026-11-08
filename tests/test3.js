const L=require('../src/logic.js'); let fail=0; const ok=(c,m)=>{ if(!c){fail++;console.log('FALHA',m);} else console.log('ok   ',m); };
const b=(v,c)=>L.bandOf(v,c).k;
ok(b(130,'jejum')==='ok'&&b(131,'jejum')==='high'&&b(70,'jejum')==='ok'&&b(69,'jejum')==='low','jejum: 70–130 normal, 131 elevada, 69 baixa');
ok(b(150)==='ok'&&b(150,'antes')==='ok'&&b(181)==='high'&&b(181,'depois')==='high','demais contextos continuam 70–180');
ok(b(150,'jejum')==='high'&&b(251,'jejum')==='vhigh'&&b(53,'jejum')==='vlow','jejum: extremos mantidos');
const recs=[{glucose:140,context:'jejum'},{glucose:140,context:'antes'},{glucose:125,context:'jejum'},{glucose:190},{glucose:65,context:'jejum'}];
const s=L.stats(recs); ok(s.hyper===2,'contagem acima da faixa = 2 (140 em jejum e 190)'); ok(s.hypo===1,'hipoglicemia = 1');
const c=L.bandCounts(recs); ok(c.high===2&&c.ok===2&&c.low===1,'distribuição por faixa respeita o jejum');
// importação do mySugr: etiqueta "Jejum" vira contexto
const r=L.parseMySugr('Data,Horário,Etiquetas,Aferição da Glicemia (mg/dL)\n03/11/2026,06:30,Jejum,128\n03/11/2026,06:31,Jejum,135\n'); ok(r.items[0].context==='jejum'&&b(r.items[0].glucose,r.items[0].context)==='ok'&&b(r.items[1].glucose,r.items[1].context)==='high','import: etiqueta Jejum aplica a regra (128 normal, 135 elevada)');
console.log(fail?fail+' falhas':'tudo certo'); process.exit(fail?1:0);
