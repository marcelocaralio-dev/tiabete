# Ajustes de tela aprovados (não alterar em releases futuros)

Validado no aparelho do mantenedor em 08/11/2026 ("agora está perfeito"):

- `scripts/build-web.js`: `const K = 1.29;` e `<style>html{zoom:1/K}</style>` (≈ 0,7752). Faz o APK ter o mesmo tamanho de letras do app web.
- `scripts/patch-android.js`: `versionCode` = `GITHUB_RUN_NUMBER`; `setTextZoom(100)`, `setUseWideViewPort(true)` e `setLoadWithOverviewMode(true)` na `MainActivity`.

Só mude esses valores com pedido explícito. Ao atualizar o APK, copie apenas `src/` (e `native/` se necessário); não sobrescreva esses dois scripts.
