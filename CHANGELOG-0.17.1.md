# 0.17.1 — Visual do Painel movido para Aparência
- A chave "Visual do Início" (Cartões | Clássico) saiu do topo do Início e agora é a seção **Visual do Painel** em Mais → Aparência.
- Mesma chave de armazenamento (`tb-pnl`), mesmas opções e mesmo efeito; a escolha vale na hora e continua após fechar/recarregar. Padrão: Cartões.
- Nenhum modelo, card, gráfico ou outra configuração foi alterado. Não havia pré-visualização de modelos. O estilo `.pn-sw` ficou sem uso no CSS.
- Código: `pnlCard()` em `src/painel2.js`; `viewAparencia` em `src/app.js`.
