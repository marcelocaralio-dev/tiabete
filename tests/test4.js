const L=require('../src/logic.js'); let fail=0; const ok=(c,m)=>{ if(!c){fail++;console.log('FALHA',m);} else console.log('ok   ',m); };
const f=(t)=>{const r=L.applyRule({time:t}); return r?`${r.context}/${r.meal||'-'}`:null;};
const T={'03:59':null,'04:00':'jejum/-','07:59':'jejum/-','08:00':'depois/cafe','09:59':'depois/cafe','10:00':'antes/almoco','11:59':'antes/almoco','12:00':'depois/almoco','15:59':'depois/almoco','16:00':'antes/jantar','18:59':'antes/jantar','19:00':'depois/jantar','23:59':'depois/jantar','00:00':null};
for(const [t,e] of Object.entries(T)) ok(f(t)===e, `${t} → ${e}`);
const r={time:'07:00',context:'depois',meal:'cafe'}; const a=L.applyRule(r); ok(a.context==='jejum'&&!('meal' in a)&&a.prev.meal==='cafe','jejum limpa a refeição e guarda o valor anterior');
const u=L.undoRule(a); ok(u.context==='depois'&&u.meal==='cafe'&&!u.prev&&!u.cls,'desfazer restaura');
ok(L.applyRule({time:'12:30',context:'depois',meal:'almoco'})===null,'sem alteração quando já está igual'); ok(L.applyRule({time:'12:30',noTime:true})===null,'sem horário não é alterado');
console.log(fail?fail+' falhas':'tudo certo'); process.exit(fail?1:0);
