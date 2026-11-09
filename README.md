# TiaBete

Aplicativo gratuito e de código aberto para acompanhar **glicemia, insulina e hemoglobina glicada**, pensado para quem tem diabetes MODY. Escrito em português do Brasil (mg/dL, datas DD/MM/AAAA).

- **Seus dados ficam só no seu aparelho.** Não há conta, login, servidor nem anúncios. Veja [PRIVACY.md](PRIVACY.md).
- Funciona sem internet.
- Instalável no Android (APK) e também como página web de um único arquivo.

> **Aviso importante.** O TiaBete é uma ferramenta de **registro e organização**. Não faz diagnóstico, não substitui avaliação médica e **não decide o seu tratamento**. Siga sempre o plano da sua equipe de saúde. Em emergência, ligue **192 (SAMU)**.

## O que ele faz

- Registro de glicemia (jejum, antes e depois das refeições), insulina basal e rápida, notas e etiquetas.
- Painel, histórico e análises (médias, variabilidade, padrões por horário). O app **não** calcula TIR nem GMI.
- Hemoglobina glicada: resultados de laboratório e uma estimativa matemática aproximada (com aviso de que não é exame nem GMI).
- Protocolo de hipoglicemia (regra dos 15 minutos) e cartões especiais no histórico.
- Conquistas (sequências de dias dentro da meta).
- **Cálculo de bolus**: alimentos, refeições e registro por dia. A conta usa **somente a razão de gramas de carboidrato por unidade que você mesmo definir** com a sua equipe de saúde. Não há valores pré-definidos, não há correção pela glicemia e o resultado deve ser conferido antes de aplicar.
- Alertas e notificações: lembretes de horário, reavaliação após hipoglicemia e silêncio noturno.
- Importação de CSV do mySugr, relatórios em PDF e Excel, backup e restauração em arquivo JSON.

## Instalar o APK

1. Abra a página de [Releases](../../releases) e baixe `TiaBete.apk`.
2. No Android, permita instalar apps de fontes desconhecidas para o navegador ou gerenciador de arquivos usado.
3. Abra o arquivo e instale. Permita as notificações quando o app pedir.

Faça **backup com frequência** (Mais → Backup e dados): se o app for desinstalado ou o aparelho trocado, os dados só voltam por esse arquivo.

## Compilar

Precisa de Node 20+ (a compilação do APK usa o GitHub Actions: Java 21 e Android SDK vêm prontos).

```bash
npm install
npm test                 # testes da lógica
npm run build:web        # gera www/index.html (arquivo único)
npm run android:debug    # APK de teste (precisa do Android SDK local)
```

A forma mais simples é o fluxo do GitHub: **Actions → "APK Android" → Run workflow** (ou crie uma tag `v0.2.0`). O APK aparece nos artefatos e, para tags, na página de Releases. Para um APK assinado, veja [docs/ASSINATURA.md](docs/ASSINATURA.md).

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/` | Código do app (lógica, telas, gráficos, relatórios, bolus) |
| `native/native.js` | Camada do Android: compartilhar arquivos e notificações locais |
| `scripts/` | Montagem do `www/index.html` e ajustes no projeto Android |
| `tests/` | Testes da lógica e simulação do ambiente Android |

Na versão do APK, `window.TB_PUBLIC = true` deixa o módulo de bolus **vazio** (sem alimentos e sem razão). Recursos que dependem do Claude (perguntas, leitura de exames, backup no Google Drive) ficam ocultos.

## Contribuir

Sugestões e correções são bem-vindas por issue ou pull request. Não inclua dados de saúde reais em issues.

## Licença

MIT. Veja [LICENSE](LICENSE).


## IA e Google Drive (v0.3)
- `native/ai-core.js`, `native/ai-ui.js`: IA com chave própria (Claude, OpenAI, Gemini, OpenRouter, outro compatível com OpenAI).
- `native/drive.js`: backup no Google Drive. Guia de configuração: `docs/GOOGLE-DRIVE.md`.
- Testes simulados: `python3 tests/ai-sim.py` (servindo `www/` na porta 8766).

## Notificações (v0.5)
- Lista única em Mais → Alertas e notificações, com chave liga/desliga para cada aviso.
- Lembretes de 2 h após refeição ou glicemia, que somem após 10 min sem medição (plugin nativo `TbExpire`, criado por `scripts/patch-android.js`).
- Diagnóstico e teste de notificação na mesma tela. Teste simulado: `python3 tests/notif-sim.py`.
