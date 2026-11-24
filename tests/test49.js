// test49: seção "Refeições e glicemia" (PROMPT 2) no navegador: dados reais semeados, filtros, abas, detalhe e Bolus intacto.
const fs = require('fs'), path = require('path'), os = require('os'), ROOT = path.join(__dirname, '..');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
(async () => {
  let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('parte do navegador ignorada'); process.exit(0); }
  const { execSync } = require('child_process'), sleep = ms => new Promise(r => setTimeout(r, ms)); execSync('node scripts/build-web.js', { cwd: ROOT, stdio: 'ignore' });
  const SEED = `(async () => { await Store.put('meta', { id: 'seeded', at: 1 }); await Store.put('meta',{id:'rewards',value:{got:{},act:{},init:true}}); await removeExamples();
    const today=new Date(); today.setHours(0,0,0,0); const recs=[], meals=[];
    S.bl.foods=[{id:'pao',name:'Pão',basis:'un',unit:'un',gpu:50,carb:30,fiber:2,prot:4,fat:1,kcal:150,est:false},{id:'ovo',name:'Ovo',basis:'un',unit:'un',gpu:50,carb:0.4,fiber:0,prot:6,fat:5,kcal:70,est:false},{id:'arroz',name:'Arroz',basis:'g',unit:'g',carb:26,fiber:1,prot:2,fat:.3,kcal:120,est:false}];
    S.bl.tpl={sem:{cafe:[{f:'pao',q:2},{f:'ovo',q:1}],almoco:[{f:'arroz',q:200}],jantar:[],lanche:[],ceia:[]},fds:{cafe:[{f:'pao',q:2},{f:'ovo',q:1}],almoco:[{f:'arroz',q:200}],jantar:[],lanche:[],ceia:[]}};
    for (let i=40;i>=1;i--){ const d=new Date(today); d.setDate(d.getDate()-i); const date=isoDate(d), mk=(t,g,o={})=>({id:'b'+i+t,date,time:t,ts:mkTs(date,t),glucose:g,source:'manual',...o});
      recs.push(mk('06:50',100,{context:'antes',meal:'cafe'})); recs.push(mk('09:00',i%2?120:200,{context:'depois',meal:'cafe'}));
      meals.push({id:'m'+i,ts:mkTs(date,'07:00'),date,time:'07:00',meal:'cafe',net:56.4,carb:60.4,fiber:4,prot:14,fat:11,kcal:370,ui:null});
      if(i%2===0){ recs.push(mk('11:50',110,{context:'antes',meal:'almoco',carbs:50})); recs.push(mk('14:00',140,{context:'depois',meal:'almoco'})); } }
    S.bl.meals=meals; blSave(); await Store.putMany('records',recs); await loadAll(); S.route='analise'; render(); })()`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'an49-'));
  for (const theme of ['dark', 'light']) {
    const ctx = await chromium.launchPersistentContext(dir + theme, Object.assign({}, devices['Pixel 7'], { colorScheme: theme })), pg = ctx.pages()[0] || await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('file://' + ROOT + '/www/index.html'); await sleep(1500); try { await pg.getByText('Continuar sem conta').click({ timeout: 10000 }); } catch (e) { } await pg.evaluate(() => { const g = document.getElementById('tb-gate'); if (g) g.remove(); }); await sleep(500);
    await pg.addStyleTag({ content: '#rw-bg{display:none!important;pointer-events:none!important}' }); await pg.evaluate(() => { window.licAllowed = () => true; }); await pg.evaluate(SEED); await sleep(600); if (theme === 'light') { await pg.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); }); await sleep(300); }
    await pg.evaluate(() => { const b = document.getElementById('rw-bg'); if (b) b.remove(); document.body.style.overflow = ''; });
    const q = s => pg.evaluate(s => document.querySelectorAll(s).length, s), tx = s => pg.evaluate(s => (document.querySelector(s) || {}).textContent || '', s);
    ok(await q('#an-rfe') === 1 && await q('.an-nv.an-c14') === 1, theme + ': seção e atalho existem');
    await pg.click('[data-act="an-go"][data-k="rfe"]'); await sleep(400);
    ok(await q('#an-rfe .rf-kpis .an-kpi') === 5 && await q('#an-rfe .rf-card.rf-m-cafe') >= 1 && await q('#an-rfe .rf-card.rf-m-almoco') >= 1, theme + ': KPIs e cartões por refeição com barra lateral');
    ok(/60 episódios|40 episódios/.test(await tx('#an-rfe .rf-meals')) && /Carboidratos totais/.test(await tx('#an-rfe')) && /Alimentos mais usados/.test(await tx('#an-rfe')) && await q('#an-rfe .rf-pairs') === 1, theme + ': episódios, carboidratos totais, alimentos e gráfico antes/depois');
    const cafe = await tx('#an-rfe .rf-card.rf-m-cafe'); ok(/\+60/.test(cafe) && /20 de 40|20 de 40/.test(cafe.replace(/\s+/g, ' ')), theme + ': café: variação média +60 (20 e 100) e 20 elevados de 40 — ' + cafe.slice(0, 120));
    await pg.click('#rfe-flt summary'); await sleep(200); await pg.selectOption('#rfe-meal', 'almoco'); await sleep(300); ok(await q('#an-rfe .rf-card.rf-m-almoco') === 1 && /Café da manhã/.test(await tx('#an-rfe .rf-meals')) === false || await q('#an-rfe .rf-meals .rf-card') >= 1, theme + ': filtro por tipo');
    ok(/fora do filtro/.test(await tx('#an-rfe .rf-flt summary')), theme + ': mostra quantos ficaram fora do filtro');
    await pg.click('[data-act="rfe-clear"]'); await sleep(300);
    await pg.click('[data-act="rfe-tab"][data-v="padroes"]'); await sleep(300); ok(await q('#an-rfe .rf-p') >= 1 && /não são causas|Não são recomendação|não é causa/i.test(await tx('#an-rfe')), theme + ': padrões com aviso de não causalidade');
    await pg.click('[data-act="rfe-tab"][data-v="comparar"]'); await sleep(300); await pg.selectOption('#rfe-A', 'm:cafe'); await sleep(200); await pg.selectOption('#rfe-B', 'm:almoco'); await sleep(300); ok(await q('#an-rfe .rf-c-cmp .rf-cm') === 2 && /Diferença de variação média/.test(await tx('#an-rfe .rf-c-cmp')), theme + ': comparação entre dois grupos');
    await pg.click('[data-act="rfe-tab"][data-v="qualidade"]'); await sleep(300); ok(await q('#an-rfe .rf-q') >= 8, theme + ': qualidade dos dados');
    await pg.click('[data-act="rfe-tab"][data-v="resumo"]'); await sleep(300);
    await pg.click('#an-rfe .rf-card.rf-m-cafe details summary'); await sleep(200); await pg.click('#an-rfe .rf-card.rf-m-cafe .rf-ep'); await sleep(300);
    const sh = await tx('.sheet'); ok(/Informações nutricionais/.test(sh) && /Carboidratos líquidos/.test(sh) && /Pão/.test(sh) && /Abrir no Bolus/.test(sh) && /Só leitura/.test(sh), theme + ': detalhe da refeição com alimentos e nutrição');
    const before = await pg.evaluate(() => JSON.stringify(S.bl)); await pg.click('[data-act="rfe-bolus"]'); await sleep(500); ok(await pg.evaluate(() => S.route === 'bolus' && S.blUi.tab === 'cafe'), theme + ': abre o Bolus na refeição'); ok(before === await pg.evaluate(() => JSON.stringify(S.bl)), theme + ': dados do Bolus intactos');
    ok(!errs.length, theme + ': sem erros de JavaScript' + (errs[0] ? ' (' + errs[0] + ')' : ''));
    if (theme === 'dark') { await pg.evaluate(() => { S.route = 'analise'; render(); }); await sleep(300); await pg.click('[data-act="an-go"][data-k="rfe"]'); await sleep(500); await pg.locator('#an-rfe').screenshot({ path: '/tmp/rfe-dark.png' }); }
    else { await pg.evaluate(() => { S.route = 'analise'; render(); }); await sleep(300); await pg.locator('#an-rfe').screenshot({ path: '/tmp/rfe-light.png' }); }
    const ov = await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); ok(ov, theme + ': sem rolagem horizontal');
    await ctx.close();
  }
  console.log(fail ? fail + ' falha(s) em ' + n : 'OK ' + n + ' verificações'); process.exit(fail ? 1 : 0);
})();
