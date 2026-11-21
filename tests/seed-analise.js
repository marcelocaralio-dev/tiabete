(async () => { await Store.put('meta', { id: 'seeded', at: 1 }); await Store.put('meta',{id:'rewards',value:{got:{},act:{},init:true}}); await removeExamples();
 let seed=7; const rnd=()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296;};
 const recs=[], today=new Date(); today.setHours(0,0,0,0);
 for (let i=89;i>=1;i--){ const d=new Date(today); d.setDate(d.getDate()-i); const date=isoDate(d), act=i%4===0, carbs=30+Math.round(rnd()*60), u=Math.round(carbs/12);
  const mk=(t,g,o={})=>({id:'a'+i+t,date,time:t,ts:mkTs(date,t),glucose:Math.round(g),source:'manual',...o});
  recs.push(mk('07:00',105+rnd()*40,{context:'jejum'}));
  recs.push(mk('12:15',110+rnd()*30,{context:'antes',meal:'almoco',carbs,insMeal:u}));
  recs.push(mk('14:30',150+rnd()*90+carbs/2,{context:'depois',meal:'almoco'}));
  recs.push(mk('19:00',115+rnd()*35,{context:'antes',meal:'jantar',carbs:carbs-10,insMeal:u-1, actMin: act?40:undefined}));
  recs.push(mk('21:30',140+rnd()*80,{context:'depois',meal:'jantar'}));
  if (i%9===0) recs.push(mk('03:20',52+rnd()*14,{context:'madrugada'}));
  if (i%5===0) recs.push(mk('22:50',120+rnd()*30,{context:'deitar'}));
 }
 await Store.putMany('records',recs); await Store.put('events',{id:'e1',date:isoDate(new Date(today.getTime()-10*86400000)),text:'Gripe'}); await loadAll(); S.route='analise'; render(); })()
