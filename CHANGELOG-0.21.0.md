# TiaBete 0.21.0 — integração do licenciamento (0.18.4) ao projeto de design (0.20.0)

Base: 0.20.0 (visual e funções mais recentes). Entrou da 0.18.4 apenas o licenciamento; nada do design foi trocado.

## Incluído da 0.18.4
- src/license.js, src/licensecore.js (teste de 14 dias, licença vitalícia, 2 aparelhos, portão premium, retorno do pagamento).
- config/license-api.txt e config/license-public-key.json (endereço e chave PÚBLICA preservados, sem alteração).
- worker/ completo (index.js, migrations 0001–0004, gen-keys.js, wrangler.toml e wrangler.local.toml.example) e docs/LICENCIAMENTO.md.
- native/drive.js (ID token do Google e retorno /pagamento) e native/ai-core.js (portão da IA).
- scripts/build-web.js: modo produção/desenvolvimento e injeção do endereço e da chave pública; ordem dos módulos com os dois arquivos de licença.
- package.json: build:web:dev, testes 9 a 14, engines node >=22.13. .gitignore: segredos e wrangler.local.toml.
- tests/test9–13 e o antigo test8 da 0.18.4 (licenciamento), renomeado para tests/test14.js porque tests/test8.js do design (lembretes de insulina) foi mantido.

## Ajustes na interface (design preservado)
- Mais → "Perfil e licença": o grupo Perfil ganhou o item "Licença TiaBete" (antes era atalho direto para Meu perfil).
- Relatório em PDF passa pelo portão premium; Excel e CSV continuam gratuitos.

## Não incluído de propósito
- worker/wrangler.local.toml (valores reais; o test10 exige que fique fora da pasta distribuída) e .wrangler/cache (cache da sua máquina).
