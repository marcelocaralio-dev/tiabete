# Guia da identidade visual GLUXO (0.32.0)

Tokens em `src/brand.css` (valores) e `src/brand-ui.css` (aplicação). Superfícies, textos, verdes, amarelos e **cores clínicas não mudaram**.

## 1. Logotipo
- Original oficial: `assets/brand/gluxo-logo-original.png` (SHA-256 `9e799ef8ad18c735…`), nunca alterado. O fundo preto da imagem **não** faz parte do logotipo.
- Versões de aplicação (mesmos pixels, só sem o fundo preto e/ou recortadas; sem vetor recriado): `gluxo-logo-fundo-transparente.png`, `gluxo-logo-completo.png` (com “Controle da glicose”), `gluxo-logo-compacto.png` (sem a frase), `gluxo-gota.png` (símbolo). `web-*` são reduções para a interface.
- Fundo escuro: usar direto. Fundo claro: as letras são brancas, então o logotipo vai sobre **placa escura** `#08070A` com cantos de 12 px (`.gx-plate`). Nunca recolorir o logotipo.
- Área de respiro: metade da altura da gota. Altura mínima: 28 px (logotipo completo); abaixo disso usar só a gota.
- Ícone do app: gota oficial centrada sobre `#08070A`; adaptive icon com a gota na zona segura de 66 %.

## 2. Vermelhos
O vermelho **desenhado** no logotipo é ≈ `#FA0000` (medido nos pixels da gota). Ele só aparece nas imagens oficiais; em interface, com texto branco, `#FF0000` não passa em contraste, por isso a interface usa os tons derivados:

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--gx-red` / `--brand` | `#E50308` | `#D70207` | principal: botões, FAB, seleção, bordas de foco, marca (branco sobre ele: 4,8:1 / 5,4:1) |
| `--gx-red-deep` / `--brand-lo` | `#BF0104` | `#B00104` | pressionado, fim de gradiente |
| `--gx-red-dark` | `#910103` | — | base de gradientes e superfícies tingidas |
| `--gx-red-glow` / `--brand-hi` | `#F71220` | `#E50308` | só brilho, realce de topo, hover; nunca fundo de texto |
| `--brand-l` | `#FF7276` | `#B00206` | ícones e rótulos de destaque (≥ 4,5:1 nas 3 superfícies) |
| `--brand-t` | `#FF4A4D` | `#C20207` | texto de marca |
| `--brand-d`, `--brand-d2` | `#5D0306`, `#2C0405` | `#FCD9D6`, `#FFEFED` | tons profundos de gradientes dos cartões em destaque |
| `--brand-bd`, `--brand-bd-soft` | `#7E1013`, `#4E1114` | `#E39A9A`, `#F2BDBB` | bordas |
Gradiente principal: `--brand-grad` (`#E50308 → #BF0104`). Sombras: `--brand-sh`, `--brand-sh-fab`. Foco: `--brand-focus` (anel 2 px). Desabilitado: `--brand-disabled`.

## 3. Quatro classes de vermelho
1. **Institucional** (`--gx-red-*`, `--brand*`): marca, botões, navegação, logotipo, splash, foco.
2. **Decorativo**: brilhos e gradientes (`--brand-d*`, `--brand-hi`); nunca carregam significado.
3. **Funcional** (estados de interação e erro): pressionado/selecionado/foco usam `--brand*`; erro e aviso continuam em `--ds-neg`/`--warn*`.
4. **Clínico** (`--red`, `--red-l`, `--red-t`, `--red-d*`, `--low-*`, `--ds-neg`; aliases de leitura `--clin-*`): glicemia baixa, alta e muito alta, alertas de saúde, gráficos e faixas. **Valores originais mantidos** (teste automático). Não usar `--brand*` nesses contextos e não usar `--red*` em elementos de marca.

## 4. Regras de uso
- Um único destaque vermelho forte por região da tela; o vermelho luminoso só em brilho.
- Cor nunca é o único sinal: selos de glicemia mantêm texto e símbolo.
- Texto sobre vermelho principal: sempre branco. Texto vermelho sobre superfície: `--brand-t`; ícone: `--brand-l`.
- Nada de valores HEX de vermelho novos em componentes: usar os tokens.

## 5. Ícones
Traço 1,9–2 px, cantos arredondados, `--brand-l` como cor de destaque, tamanhos 18/21 px na interface. Ícones de alerta e estado ruim mantêm o vermelho clínico. Notificação Android: silhueta branca da gota oficial (24 a 96 px) com cor de destaque `#E50308`.

## 6. Movimento (“fluxo”)
Entrada suave (`gx-rise`, 460 ms), confirmação curta (`gx-pop`, 220 ms), varredura de luz única na abertura (`gx-sheen`). Curva `--gx-ease`. Sem loops, nada sobre dados clínicos, e `prefers-reduced-motion` desliga tudo (interface e splash).

## 7. Aplicações externas
- Ícone/loja: gota sobre `#08070A`, 1024×1024 sem cantos; capturas de tela em tema escuro com o logotipo completo no topo.
- Apresentações e redes sociais: fundo `#08070A` ou `#F6F2F0`; título em branco/`#1C1719`; um único elemento `--gx-red`; logotipo completo no canto; manter os verdes e âmbar só para dados.
- Dados de glicemia em materiais externos seguem a semântica clínica (verde na faixa, âmbar elevada, vermelho clínico baixa/muito alta).
- Tipografia: Unbounded (títulos e números), Manrope (texto), JetBrains Mono (rótulos).

## 8. Como atualizar a marca
Trocar valores em `src/brand.css`; nenhuma outra alteração manual. `scripts/gluxo-repoint.py` documenta quais linhas foram migradas de `--red*` para `--brand*`.
