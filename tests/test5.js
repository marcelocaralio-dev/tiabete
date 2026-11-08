const L=require('../src/logic.js');let f=0;const ok=(c,m)=>{if(!c){f++;console.log('FALHA',m)}};
const A=L.cleanExam({date:'2026-03-10',lab:'Lab X',title:'Check-up',items:[
 {name:'Glicose em jejum',canonical:'Glicemia de jejum',value:'112',unit:'mg/dL',refLow:70,refHigh:99,context:'x'},
 {name:'Colesterol LDL',value:130,unit:'mg/dL',refHigh:100},
 {name:'Hemoglobina',value:'14,2',unit:'g/dL',refLow:13,refHigh:17},
 {name:'Urina - proteínas',text:'Negativo',flag:'normal'},
 {name:'TSH',value:2.1,refLow:.4,refHigh:4.5}, {name:'',value:1}, null]});
ok(A.items.length===5,'itens '+A.items.length);
ok(A.items[0].flag==='alto'&&A.items[0].value===112,'alto');
ok(A.items[2].value===14.2&&A.items[2].flag==='normal','vírgula');
ok(A.items[3].flag==='normal'&&A.items[3].value===null,'texto');
const s=L.examScore(A.items);ok(s&&s.n===5&&s.ok===3&&s.out===2,'contagem '+JSON.stringify(s));
// créditos: glicose dev 13/99=.131 → .869 ; LDL .3 → .7 ; (0.869+0.7+3)/5=.9138 → 9.1
ok(s.score===9.1,'nota '+s.score);
ok(L.examScore(A.items.slice(0,2))===null,'min 3');
ok(L.examBand(9.1).k==='a'&&L.examBand(4).k==='d','faixas');
ok(L.cleanExam({date:'2999-01-01',items:[]}).date==='','data futura');
ok(L.cleanExam({date:'10/03/2026',items:[]}).date==='2026-03-10','data br');
const B=L.cleanExam({date:'2026-09-10',items:[{name:'Glicose',canonical:'Glicemia de jejum',value:95,refLow:70,refHigh:99},{name:'LDL',canonical:'colesterol ldl',value:150,refHigh:100},{name:'Ferritina',value:80,refLow:30,refHigh:300}]});
A.items[1].key=L.examKey('colesterol ldl');
const C=L.compareExams([{id:'b',date:B.date,items:B.items},{id:'a',date:A.date,items:A.items},{id:'z',date:'',items:[]}]);
ok(C.exams.length===2&&C.exams[0].id==='a','ordem');
const g=C.multi.find(r=>r.key==='glicemia de jejum');ok(g&&g.dir==='desceu'&&g.rel==='perto','glicemia '+JSON.stringify(g&&[g.dir,g.rel]));
const l=C.multi.find(r=>r.key==='colesterol ldl');ok(l&&l.dir==='subiu'&&l.rel==='longe','ldl');
ok(C.single.some(r=>r.key==='ferritina')&&C.single.some(r=>r.key==='tsh'),'single');
ok(L.hashText('abc')===L.hashText('abc')&&L.hashText('abc')!==L.hashText('abd'),'hash');
console.log(f?f+' falhas':'exames OK');
