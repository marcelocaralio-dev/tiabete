# Relatório de testes — GLUXO 0.32.0
| Teste | Resultado |
|---|---|
| Suítes antigas `test2`–`test32` (lógica, exames, Android, Drive, análise etc.) | passam (test6 ajustado para a nova cor de notificação, intencional) |
| `tests/test33.js` — 81 verificações: paleta, contraste AA nos dois temas (texto branco sobre o vermelho principal 4,8:1 escuro / 5,4:1 claro; `--brand-l`/`--brand-t` ≥ 4,5:1 sobre as 3 superfícies), cores clínicas e superfícies originais intactas, limites 70/180, original do logotipo (SHA-256), ícones nos tamanhos, Android/PWA, movimento reduzido | passa |
| `tests/browser/identidade-compara.py` — original × novo, 12 telas × 2 temas, 24 combinações, **posição e tamanho de todos os elementos idênticos**; **nenhum elemento clínico mudou de cor** | passa |
| Build `node scripts/build-web.js` e `node scripts/build-pwa.js` | ok (`www/index.html` 1,6 MB; manifesto GLUXO) |
| Capturas escuro/claro: abertura, entrada, Início, Histórico, Análise, Mais, Configurações, Novo registro, menu | em `identidade/` |
Limitações: testes de navegador em Python (Playwright de Node ausente); sem APK/aparelho; `test21` apresentou uma falha intermitente em uma execução paralela e passou nas repetições.
