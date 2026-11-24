# Resumo glicêmico (Início)

Os cartões "Glicemia mais recente" (glicosímetro circular) e "Média do dia" (glicosímetro circular) viraram um único bloco, o **Resumo glicêmico**, no topo do painel de situação geral.

- Glicemia mais recente em destaque (valor, mg/dL, selo de status, hora, data, tempo relativo e contexto). Toque abre os mesmos detalhes de antes (`data-pm="ult"`).
- Barra horizontal de faixa glicêmica no lugar do mostrador: mesmas faixas, cores e escala (30–600, HI acima de 600) do glicosímetro (`GZ`, `GZ_ZONES`, `gzState` e a nova `gzFrac`, em `charts.js`). Faixa atual em cor plena, marcador, limites 70 · 180 · 250 · 400, faixa extrema tracejada.
- Média do dia (data selecionada) e quantidade de medições em bloco secundário (`data-pm="dia"`, abre o detalhe do dia). Sem medições no dia: "—" e aviso, sem dados fictícios.
- "Média do dia" saiu da lista de cartões personalizáveis (preferências antigas são higienizadas sozinhas).
- Removidos: CSS exclusivo dos dois glicosímetros do Início (`.pn-gauge`, `.pn-mid`, `.pn-ult/.pn-dia`, alinhamento por subgrade) e `S.gaugeKeyD`. O mostrador circular continua nas janelas de detalhe, na tela de medição e no Início clássico.
- Animação (marcador, cor e número) só quando a glicemia muda e sem `prefers-reduced-motion`.
- Testes 22 e 27 ajustados para a nova estrutura.

## 0.45.0 — redesenho do card e filtro separado
- O Resumo glicêmico passou a mostrar **somente o dia atual** em dois níveis (recolhido: última glicemia + barra + média e registros do dia; expandido: estatísticas e todos os registros de hoje). Detalhes em `CHANGELOG-0.45.0.md`.
- O seletor 7/30/90 dias, os indicadores e o texto do período saíram do card e formam o componente independente **Período de análise**, logo abaixo.
- As janelas `data-pm="ult"` e `data-pm="dia"` deixaram de ser abertas pelo card (a expansão no próprio cartão as substitui); o código das janelas foi mantido.
