# 0.30.0 — Padronização e equivalência visual entre tema claro e escuro (PROMPT 6)

Atualização **somente de apresentação**: dados, cálculos, doses, ações e funcionalidades foram mantidos. Ajustes aprovados do APK (`K = 1.29`, `patch-android.js`) não foram tocados.

## Auditoria (29 telas × 2 temas, 412 px)
- **Contraste:** varredura de todo texto visível (WCAG AA). Escuro: 1 caso; claro: 3 casos (ícone ✓ das Análises, "bloqueado" nas Conquistas, abas Razão/Alimentos do bolus) + 1 rodapé das Métricas.
- **Efeitos só no escuro:** comparação de `box-shadow`, `filter`, `text-shadow`, gradientes e animações elemento a elemento. Restavam o brilho do ícone ativo da navegação e o brilho do mostrador (número e arco). O restante (fundo ambiente do indicador geral, halos dos cards, selos, barras neon, botões, gráficos, avisos, cards premium e Métricas Premium) já tinha correspondente no claro.
- **Troca de tema:** o tema só era aplicado depois de carregar todo o script, o que podia mostrar um "flash" escuro para quem usa o claro; a cor da barra do sistema (`theme-color`) ficava sempre escura.

## Mudanças
- **`src/neon.css` refeito com tokens.** Antes eram duas cópias das regras (uma `:not([data-theme="light"])`, outra `[data-theme="light"]`). Agora há **uma regra por efeito** e as diferenças entre os temas ficam em tokens (`--amb-*`, `--nh-*`, `--hero-*`, `--g-*`), escuro em `:root` e claro em `:root[data-theme="light"]`. Um efeito novo passa a existir nos dois temas ao mesmo tempo. Estilos computados antes/depois foram comparados em 7 telas e 3 estados do indicador geral: idênticos, exceto os itens abaixo.
- **Indicador geral (fundo verde/âmbar/vermelho):** mesma lógica (`ambient.js`), mesmas transições, agora controlado por tokens `--amb-ok/warn/bad` em cada tema.
- **Ícone ativo da navegação** e **mostrador (gauge)** ganham brilho também no tema claro, com intensidade reduzida (tokens `--g-navic`, `--g-gz-num-p`, `--g-gz-lit-p`).
- **Sem flash:** script mínimo no início da página aplica o tema salvo (`tb-theme`; padrão escuro; "automático" segue o sistema) antes da primeira pintura. `applyTheme()` atualiza `theme-color`.
- **Contraste:** ✓ das Análises usa `--good`; abas Razão (tinta 10 %) e Alimentos (âmbar do tema claro `#9A6000`) com texto legível; conquistas bloqueadas com opacidade 0,78; legenda das Métricas mais escura no claro.

## Testes
`tests/test31.js` (141 verificações): nenhuma regra exclusiva do escuro nos CSS; todos os tokens definidos nos dois temas; os 3 estados do indicador geral mudam fundo e faixa do topo em ambos; halo verde/vermelho/âmbar nos cards; brilho do ícone ativo e do mostrador; contraste AA de todo texto em 11 telas × 2 temas; `data-theme` correto desde a primeira mutação e persistência ao recarregar. As 27 suítes anteriores continuam passando.
