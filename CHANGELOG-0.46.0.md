# Início personalizável direto na tela (0.46.0)

Escopo: gerenciamento, organização e personalização dos cards da tela Início, sem sair dela. Nenhum cálculo, gráfico, dado, função Premium ou conteúdo de card foi alterado.

## O que mudou
- **Botão "Personalizar"** discreto na linha do título "Início" (substitui o antigo "Personalizar tela" no rodapé e a folha em outra camada).
- **Modo de edição** na própria tela: barra fixa ao rolar com **Restaurar padrão** e **Concluir**; cada card personalizável ganha uma **alça de arraste** (centro da borda superior) e um botão **ocultar** (canto), sobre a borda: a altura dos cards não aumenta. O conteúdo do card fica inerte durante a edição (tocar não abre detalhes), o que evita conflito entre o gesto e os controles internos.
- **Arrastar e soltar** por Pointer Events: mouse, caneta e toque (Android). Cartão flutuante com sombra, **marcador tracejado** na posição de destino, animação suave (FLIP) dos demais, **rolagem automática** perto das bordas, Esc cancela. Funciona com o zoom da interface do app (a escala é medida em tempo de execução). A alça usa `touch-action: none`, não ativa o "puxar para atualizar" nem o deslize de navegação.
- **Teclado/leitor de tela:** setas na alça movem o cartão (pulando os ocultos), com anúncio da nova posição.
- **Ocultar** na hora, sem confirmação, reversível; nada é apagado (só o id entra em `hidden`).
- **Cards disponíveis** (recolhível, no topo da edição): nome, descrição e "Adicionar à tela inicial". O card volta **ao fim da lista personalizável** (sempre acima da Central de Métricas). Sem ocultos: "Nenhum card oculto…".
- **Indicadores do painel** (1 a 4) passaram para um painel recolhível da mesma barra (funcionalidade preservada).
- **Restaurar padrão** com confirmação: ordem original e todos visíveis (e indicadores padrão). Não toca em registros, dados glicêmicos ou históricos.

## Cards estruturais
- **Resumo glicêmico** (topo) e **Central de Métricas** (final) continuam visíveis na edição, com uma marca discreta de "fixo". Sem alça, sem ocultar, fora de `order`/`hidden` (`IN_FIXED`; `inCleanPrefs` descarta qualquer tentativa de incluí-los) e fora do arraste. A estrutura é sempre Resumo → personalizáveis → Central. Conteúdo, lógica e navegação deles não foram tocados.

## Persistência
- Mesmo mecanismo existente: `localStorage` `tb-inicio` com cópia durável no banco (`persist.js`). Formato compatível (`v:1`, `order`, `hidden`, `pri`): quem já personalizou mantém a escolha. Ids estáveis (`hoje`, `hba`, `dist`…), nunca posição. Cards novos em versões futuras entram sozinhos **no fim**, sem alterar a ordem escolhida. Salva a cada ação (não há "salvar" individual); o estado de edição não é persistido (o app sempre abre em visualização normal).

## Arquivos
`src/inicio-core.js` (catálogo com descrições, `IN_FIXED`, `inReorder`, `inMoveVisible`, `inHide`, `inShow`, `inHiddenCards`), `src/inicio.js` (modo de edição, arraste, painéis), `src/painel2.js` (montagem da tela), `src/inicio.css`, `src/ptr.js` e `src/drawer.js` (ignoram gestos que começam na alça), `tests/test27.js` (adaptado), `tests/test51.js` (novo, 46 verificações: lógica pura, mouse, toque real, rolagem automática, ocultar/adicionar, restaurar, persistência, cards fixos, 320 e 768 px) e `package.json` (script `test`).
