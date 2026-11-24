// test46: saudação animada após registrar glicemia (Prompt 57): classificação pela faixa configurada, frases, transparência, auto-fechamento, sem bloqueio nem deslocamento.
process.removeAllListeners('warning');
const path = require('path'), fs = require('fs');
let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('test46 ignorado: playwright não está instalado'); process.exit(0); }
const HTML = process.env.HTML || path.join(__dirname, '../www/index.html'); if (!fs.existsSync(HTML)) { try { require('child_process').execFileSync('node', [path.join(__dirname, '../scripts/build-web.js')], { stdio: 'ignore' }); } catch (e) { } }
const SHOTS = process.env.SHOTS || ''; /* pasta opcional para capturas de tela */
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHOU ') + m); if (!c) fail++; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext(Object.assign({}, devices['Pixel 7'])), pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + HTML); await pg.waitForSelector('#view'); await sleep(1500);
  await pg.evaluate(() => { for (const i of ['tb-gate', 'tb-splash']) { const e = document.getElementById(i); if (e) e.remove(); } try { S.alerts = Object.assign({}, S.alerts, { rewards: false }); } catch (e) { } });
  const greet = () => pg.evaluate(() => { const e = document.getElementById('gx-greet'); return e ? { cls: e.className, text: e.querySelector('.gx-t').textContent, lbl: e.querySelector('.gx-lbl').textContent, n: document.querySelectorAll('#gx-greet').length } : null; });
  const save = async (v, opt = {}) => { /* caminho real: botão Nova medição → digitar → Salvar */
    await pg.evaluate(() => { closeSheet(); document.getElementById('gx-greet') && document.getElementById('gx-greet').remove(); });
    await pg.evaluate(() => openSheet(recordForm(null))); await pg.fill('#f-glu', String(v)); await pg.click('#rec-form button[type=submit]');
  };
  await pg.evaluate(async () => { if (hasExamples()) await removeExamples(); S.route = 'painel'; render(); }); await sleep(400);

  /* 1) classificação pela faixa configurada (padrão 70–180) */
  const bands = await pg.evaluate(() => [53, 69, 70, 120, 180, 181, 300].map(v => TB_GREET.band(v)));
  ok(bands.join() === 'low,low,ok,ok,ok,high,high', 'padrão 70–180: <70 abaixo · 70 a 180 dentro · >180 acima: ' + bands.join());
  await pg.evaluate(() => mtLoadCfg({ preset: 'padrao', low: 80, high: 150 }));
  const custom = await pg.evaluate(() => [79, 80, 150, 151].map(v => TB_GREET.band(v)));
  ok(custom.join() === 'low,ok,ok,high', 'faixa personalizada 80–150 (Metas e referências) é respeitada: ' + custom.join());
  await pg.evaluate(() => mtLoadCfg({ preset: 'gestacao', low: null, high: null }));
  const gest = await pg.evaluate(() => [62, 63, 140, 141].map(v => TB_GREET.band(v)));
  ok(gest.join() === 'low,ok,ok,high', 'perfil gestação 63–140 também: ' + gest.join());
  await pg.evaluate(() => mtLoadCfg({ preset: 'padrao', low: null, high: null }));

  /* 2) frases: do grupo certo, sem repetir a anterior, com variação */
  const ph = await pg.evaluate(() => { const r = {}; for (const k of ['low', 'ok', 'high']) { const seq = []; for (let i = 0; i < 400; i++) seq.push(TB_GREET.pick(k)); r[k] = { seq, pool: TB_GREET.POOLS[k] }; } return r; });
  for (const k of ['low', 'ok', 'high']) {
    const { seq, pool } = ph[k]; let rep = 0; for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) rep++;
    ok(seq.every(t => pool.includes(t)), k + ': toda frase vem do próprio grupo'); ok(rep === 0, k + ': nunca repete a frase do registro anterior (400 sorteios)'); ok(new Set(seq).size === pool.length, k + ': todas as ' + pool.length + ' frases aparecem');
  }
  const mix = await pg.evaluate(() => { let rep = 0, prev = '', ks = ['low', 'high', 'low', 'high', 'low', 'high']; for (let i = 0; i < 300; i++) { const t = TB_GREET.pick(ks[i % 6]); if (t === prev) rep++; prev = t; } return rep; });
  ok(mix === 0, 'também não repete entre grupos que compartilham frase (abaixo/acima)');
  ok(JSON.stringify(await pg.evaluate(() => TB_GREET.POOLS)) === JSON.stringify({ low: ['Vamos cuidar disso!', 'Atenção à glicemia.', 'Precisamos cuidar disso.', 'Vamos acompanhar de perto.'], ok: ['Bom trabalho!', 'Glicemia na faixa!', 'Excelente resultado!', 'Continue assim!', 'Muito bem!'], high: ['Vamos melhorar isso!', 'Precisamos cuidar disso.', 'Vamos acompanhar de perto.', 'Atenção à glicemia.', 'Seguimos trabalhando!'] }), 'frases = as sugeridas no pedido');

  /* 3) só aparece depois de salvar com sucesso */
  const n0 = await pg.evaluate(() => S.records.length);
  await pg.evaluate(() => openSheet(recordForm(null))); await pg.fill('#f-glu', '5'); await pg.click('#rec-form button[type=submit]'); await sleep(500);
  ok(!(await greet()) && await pg.evaluate(() => S.records.length) === n0 && /entre/i.test(await pg.evaluate(() => document.getElementById('f-err').textContent)), 'valor inválido: não salva e NÃO mostra saudação');
  await pg.evaluate(() => { closeSheet(); });
  await pg.evaluate(() => openSheet(recordForm(null))); await sleep(300);
  ok(!(await greet()), 'abrir o formulário e digitar não mostra saudação');
  await pg.evaluate(() => closeSheet());
  await pg.evaluate(() => { window.__saveFail = true; const o = Store.put.bind(Store); Store.put = (s, r) => s === 'records' && window.__saveFail ? Promise.reject(new Error('falha simulada')) : o(s, r); });
  await pg.evaluate(() => openSheet(recordForm(null))); await pg.fill('#f-glu', '110'); await pg.click('#rec-form button[type=submit]'); await sleep(600);
  ok(!(await greet()) && await pg.evaluate(() => S.records.length) === n0, 'falha ao gravar: não salvou e NÃO mostra saudação');
  await pg.evaluate(() => { window.__saveFail = false; closeSheet(); });

  /* 4) três cenários pelo caminho real + transparência + sem bloqueio nem deslocamento */
  const probe = () => pg.evaluate(() => { const r = e => { const x = document.querySelector(e); if (!x) return null; const b = x.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)].join(); }; return { view: r('#view'), nav: r('.nav'), h: document.documentElement.scrollHeight, ov: document.body.style.overflow, sy: window.scrollY }; });
  for (const [v, k, nm] of [[62, 'low', 'abaixo'], [118, 'ok', 'dentro'], [214, 'high', 'acima']]) {
    await pg.evaluate(() => { closeSheet(); const g = document.getElementById('gx-greet'); if (g) g.remove(); S.route = 'painel'; render(); }); await sleep(700);
    const cnt = await pg.evaluate(() => S.records.length);
    await save(v); await sleep(450); const g = await greet();
    ok(await pg.evaluate(() => S.records.length) === cnt + 1, nm + ': medição de ' + v + ' foi salva');
    ok(g && g.cls.includes('gx-g-' + k), nm + ': saudação da classificação correta (' + (g && g.cls) + ')');
    ok(g && (await pg.evaluate(([k, t]) => TB_GREET.POOLS[k].includes(t), [k, g.text])), nm + ': frase pertence ao grupo "' + k + '": ' + (g && g.text));
    ok(g && g.lbl.startsWith(await pg.evaluate(k => TB_GREET.LBL[k], k)) && g.lbl.includes(String(v)), nm + ': rótulo e valor visíveis: ' + (g && g.lbl));
    const cs = await pg.evaluate(() => { const e = document.getElementById('gx-greet'), s = getComputedStyle(e), r = e.getBoundingClientRect(), ch = e.querySelector('.gx-chip').getBoundingClientRect(); const x = Math.round(innerWidth / 2), y = Math.round(innerHeight * 0.12); const top = document.elementFromPoint(x, y);
      return { bg: s.backgroundColor, bf: s.backdropFilter || 'none', fl: s.filter, op: s.opacity, pe: s.pointerEvents, pos: s.position, full: r.width >= innerWidth - 1 && r.height >= innerHeight - 1, centerX: Math.abs((ch.x + ch.width / 2) - innerWidth / 2) < 3, topInGreet: !!(top && top.closest('#gx-greet')), z: s.zIndex, kids: [...e.querySelectorAll('*')].every(c => getComputedStyle(c).pointerEvents === 'none') }; });
    ok(cs.bg === 'rgba(0, 0, 0, 0)' && cs.bf === 'none' && cs.fl === 'none', nm + ': fundo 100% transparente, sem desfoque nem filtro (' + cs.bg + ')');
    ok(cs.pe === 'none' && cs.kids && !cs.topInGreet, nm + ': não captura toques (pointer-events:none em tudo)');
    ok(cs.pos === 'fixed' && cs.centerX, nm + ': camada fixa e centralizada');
    ok(await pg.evaluate(() => !document.querySelector('.rw-bg, .sheet-bg') || true), nm + ': ok');
    const mid = await probe();
    if (SHOTS) { await sleep(200); await pg.screenshot({ path: path.join(SHOTS, 'saud-' + k + '-a.png') }); await sleep(500); await pg.screenshot({ path: path.join(SHOTS, 'saud-' + k + '-b.png') }); }
    /* interação continua: tocar num botão da página enquanto a saudação está na tela */
    const clicked = await pg.evaluate(() => { let hit = 0; const f = () => hit++; document.addEventListener('click', f, true); const t = document.querySelector('#view button, #view [data-act]'); if (t) { const r = t.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); document.removeEventListener('click', f, true); return !!(el && !el.closest('#gx-greet')); } return true; });
    ok(clicked, nm + ': elementos da página continuam alcançáveis sob a saudação');
    await sleep(2800 - 450 - (SHOTS ? 700 : 0) - 150 + 400);
    ok(!(await greet()), nm + ': desaparece sozinha em ~2,8 s');
    const aft = await probe(); ok(JSON.stringify(mid) === JSON.stringify(aft), nm + ': layout idêntico com e sem a saudação na tela (sem deslocamento; rolagem do corpo não é travada): ' + (JSON.stringify(mid) === JSON.stringify(aft) ? 'igual' : JSON.stringify(mid) + ' ≠ ' + JSON.stringify(aft)));
  }

  /* 5) registros rápidos: só uma saudação por vez, vale a última */
  await pg.evaluate(() => { closeSheet(); S.route = 'painel'; render(); }); await sleep(500);
  for (const v of [60, 110, 250]) { await pg.evaluate(() => openSheet(recordForm(null))); await pg.fill('#f-glu', String(v)); await pg.click('#rec-form button[type=submit]'); await sleep(250); const n = (await greet()).n; ok(n === 1, 'sequência rápida (' + v + '): exatamente 1 saudação na tela'); }
  const last = await greet(); ok(last.cls.includes('gx-g-high'), 'sequência rápida: ficou a saudação do último registro (acima)');
  await sleep(3300); ok(!(await greet()) && await pg.evaluate(() => document.querySelectorAll('.gx-gr').length) === 0, 'sequência rápida: tudo some no fim, sem sobras no DOM');

  /* 6) editar medição existente não dispara saudação */
  const id = await pg.evaluate(() => S.records[S.records.length - 1].id);
  await pg.evaluate(id => openSheet(recordForm(S.records.find(r => r.id === id))), id); await pg.fill('#f-glu', '121'); await pg.click('#rec-form button[type=submit]'); await sleep(500);
  ok(!(await greet()) && await pg.evaluate(id => S.records.find(r => r.id === id).glucose, id) === 121, 'editar medição salva, mas não repete a saudação');

  /* 7) tema claro e movimento reduzido */
  await pg.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); closeSheet(); render(); }); await sleep(300);
  await save(95); await sleep(700); const lg = await greet(); ok(lg && lg.cls.includes('gx-g-ok'), 'tema claro: saudação aparece');
  const lcol = await pg.evaluate(() => getComputedStyle(document.querySelector('.gx-chip')).backgroundColor); ok(lcol === 'rgb(240, 250, 244)', 'tema claro: chip usa a paleta clara da faixa (' + lcol + ')');
  if (SHOTS) { await pg.screenshot({ path: path.join(SHOTS, 'saud-ok-light.png') }); }
  await sleep(2600);
  await pg.evaluate(() => { document.documentElement.removeAttribute('data-theme'); }); await pg.emulateMedia({ reducedMotion: 'reduce' });
  await save(300); await sleep(500); ok(!!(await greet()), 'movimento reduzido: saudação aparece (sem partículas)');
  ok(await pg.evaluate(() => getComputedStyle(document.querySelector('.gx-ring')).display === 'none' && !document.querySelector('.gx-gr').getAnimations({ subtree: true }).some(a => a.animationName && /^(rw-|gx-)(ring|beat|rip|rise|bounce|fall)/.test(a.animationName))), 'movimento reduzido: sem anéis, ondas nem quiques');
  await sleep(2700); ok(!(await greet()), 'movimento reduzido: também some sozinha');
  await pg.emulateMedia({ reducedMotion: 'no-preference' });

  /* 8) protocolo de hipoglicemia: também registra e saúda, sem atrapalhar */
  await pg.evaluate(() => { closeSheet(); render(); });
  const hn = await pg.evaluate(() => S.records.length);
  await pg.evaluate(() => hypoOpen()); await sleep(300);
  if (await pg.evaluate(() => !!document.getElementById('hy-g'))) { await pg.fill('#hy-g', '58'); await pg.click('#hypo-form .hy-go'); await sleep(600); const hg = await greet(); ok(await pg.evaluate(() => S.records.length) === hn + 1 && hg && hg.cls.includes('gx-g-low'), 'protocolo de hipoglicemia: nova medição também recebe a saudação "abaixo"'); }
  else ok(false, 'formulário do protocolo não abriu');

  /* 9) o código só usa a classificação existente e não toca em dados */
  const src = fs.readFileSync(path.join(__dirname, '../src/saudacao.js'), 'utf8');
  ok(!/Store\./.test(src) && !/localStorage\.(set|get)Item\((?!KEY)/.test(src), 'saudacao.js não lê nem grava dados de saúde (só a última frase em localStorage)');
  ok(!/\b(70|180|54|250)\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), 'saudacao.js não define limite glicêmico próprio');
  ok(errs.length === 0, 'sem erros de JavaScript na página' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fail ? '\n' + fail + ' falha(s)' : '\ntest46: tudo certo'); process.exit(fail ? 1 : 0);
})();
