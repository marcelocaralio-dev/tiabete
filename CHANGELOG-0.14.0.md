# 0.14.0 · Revisão de linguagem (Prompt 21)

Só textos, nomes, títulos e descrições. Cálculos, dados, rotas, recursos, `K = 1.29` e `patch-android.js` ficam como estavam. Os 7 testes existentes dão a mesma saída da 0.13.1.

## Principais trocas
- **Painel → Início** (menu, barra inferior, título, atalho do logotipo, avisos e textos de ajuda). A rota interna continua `painel`.
- **Backup → cópia de segurança** (menu "Cópia de segurança", grupo "Dados e cópias", botões, avisos e notificações). A pasta do Drive continua "TiaBete Backups".
- **Termos técnicos em palavras comuns:** "pré/pós-prandial" → "antes/depois da refeição"; "Esquemas de tratamento" → "Meu tratamento"; "Alertas e notificações" → "Alertas e lembretes"; "Evolução/Padrões glicêmicos" → "da glicemia"; "Cards" → "Cartões"; "vs." → "em relação a".
- **Fora do português:** "Glicose Control" → "Controle da glicose"; "PWA", "IndexedDB", "Issue", "Download", "Chrome Custom Tabs", "TIR" e "set de infusão" trocados ou explicados; "GMI" ganhou explicação.
- **Abreviações por extenso:** "Dif.", "Carb. tot.", "Prot.", "Gord.".
- **Menus e legendas mais curtos** e cerca de 40 textos longos reescritos em frases diretas, sem tirar avisos de segurança.

## Mantido de propósito
Termos de saúde (hipoglicemia, hiperglicemia, HbA1c, bolus, basal, mg/dL), marcas (mySugr, FreeStyle Libre, Dexcom Clarity, Google Drive, Claude), siglas conhecidas (PIN, IA, SAMU, PDF, CSV) e os nomes de botões de sites externos nos passos da chave de IA ("Sign in", "Create API key"), que precisam bater com o site.

## Arquivos alterados
`src/` (app, extras, painel2, plan, secure, logic, report, drawer, alertas, alertcenter, bolus, charts, exams, prontidao, head.html), `native/` (ai-ui, drive, login, native), `scripts/build-web.js` (só o texto do cartão "Aplicativo Android"), `package.json` (versão 0.14.0).
