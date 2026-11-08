# Assinar o APK (release)

O Android só instala atualizações de um app se o APK for assinado **sempre com a mesma chave**. Sem chave, o fluxo gera `TiaBete-debug.apk` (serve para testar). Com a chave nos *secrets*, gera `TiaBete.apk` assinado.

## 1. Criar a chave (uma única vez)

Precisa do Java (`keytool`):

```bash
keytool -genkeypair -v -keystore tiabete.jks -alias tiabete \
  -keyalg RSA -keysize 4096 -validity 10000
```

Anote a senha e o alias. **Guarde o arquivo `tiabete.jks` e a senha em local seguro (e faça uma cópia).** Se perder, não é possível publicar atualizações para quem já instalou. Nunca coloque o `.jks` no repositório (o `.gitignore` já o ignora).

## 2. Cadastrar nos Secrets do GitHub

Em **Settings → Secrets and variables → Actions → New repository secret**:

| Nome | Valor |
|---|---|
| `KEYSTORE_BASE64` | saída de `base64 -w0 tiabete.jks` |
| `KEY_ALIAS` | `tiabete` (ou o alias escolhido) |
| `KEYSTORE_PASSWORD` | a senha da chave |

## 3. Gerar o APK

- **Actions → APK Android → Run workflow**, ou
- crie uma tag: `git tag v0.2.0 && git push origin v0.2.0` (publica também em Releases).

## 4. Conferir

```bash
apksigner verify --print-certs TiaBete.apk
```

Divulgue o **hash SHA-256** do certificado na página de Releases para que as pessoas confirmem a origem.

## Observações

- Instalação fora da Play Store exige permitir "fontes desconhecidas".
- Para publicar na Google Play será preciso conta de desenvolvedor, política de privacidade em uma URL pública (use o `PRIVACY.md`) e atenção a regras de apps de saúde. O cálculo de bolus pode exigir enquadramento regulatório (software médico) conforme o país; avalie antes de divulgar amplamente.
