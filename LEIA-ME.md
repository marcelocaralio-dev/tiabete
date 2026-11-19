# GLUXO 0.21.1 -> repositório antigo (mantém a assinatura original)
Arquivos novos e alterados do código atual (GLUXO-main) para copiar por cima do repositório antigo (0.13.1), mantendo os caminhos.

NÃO copie nem altere no repositório antigo:
- `.github/workflows/android.yml` (já é idêntico ao atual; é ele que assina com os seus segredos);
- `android/` (o antigo gera essa pasta a cada montagem com `npx cap add android`; o atual a versiona só por causa do `gradlew`).

O `.gitignore` incluído é o ANTIGO (continua ignorando `android/`) mais 4 linhas de proteção que o `test10` exige (`worker/wrangler.local.toml` etc.). Pode substituir o do repositório antigo por ele.

Substitui `package.json` e `package-lock.json` (dependências novas) e `scripts/patch-android.js` (o `versionCode` continua = número de execução do repositório antigo, que continua crescendo).

Depois de rodar o workflow, ANTES de instalar: o arquivo deve se chamar `TiaBete.apk` (não `TiaBete-debug.apk`) e `apksigner verify --print-certs TiaBete.apk` deve mostrar o mesmo SHA-256 do app instalado.
