# Análise glicêmica por refeições (Prompt 2)

Nova seção **Refeições e glicemia** na tela Análise (atalho "Refeição×glicemia"), que mostra como as medições se comportam em torno das refeições já registradas. Só lê dados: não altera o Bolus, não calcula nem sugere dose, não afirma causa.

## Auditoria (o que já existia e foi reaproveitado)
- Medições (`S.records`): `meal`, `context` (antes/depois), `carbs`, `mealDesc`, `insMeal`/`insCorr`.
- Bolus: **Refeição feita** (`S.bl.meals`: horário, carboidratos totais, fibras, líquidos, kcal, bolus registrado, sem lista de alimentos), registro do dia (`S.bl.days`), modelos (`S.bl.tpl`) e alimentos (`S.bl.foods`). Refeições salvas (`S.saved`) são só atalhos de preenchimento.
- Nenhum dado fictício, nenhuma estrutura nova de armazenamento.

## Como a medição é ligada à refeição (só com evidência)
- Mesmo dia, **mesmo tipo de refeição marcado pela pessoa**, contexto "antes"/"depois" e janela: antes de 3 h antes até 15 min depois do horário; depois de 30 min a 6 h, antes da próxima refeição do mesmo tipo no dia.
- Medição só próxima no horário, sem tipo ou sem contexto, **não** é ligada.
- Três origens, sempre diferenciadas: **Refeição feita** (Bolus), **Registro com refeição** (carboidratos/descrição/insulina na própria medição) e **Só classificada** (pré/pós sem dados da refeição).
- Alimentos só são reconhecidos quando o total do registro do dia (ou do modelo atual) bate com o líquido registrado (tolerância 0,6 g); senão nada é presumido.
- Carboidratos **totais** (log do Bolus) e **informados** (registro de glicemia) ficam separados; nunca viram "líquidos".

## O que a tela mostra
- Resumo: cartões por tipo (café, almoço, jantar, lanches, ceia) com antes/depois, variação, intervalo típico, menor/maior, frequência de baixos e elevados, carboidratos, alimentos, distribuição e lista de episódios; gráfico antes/depois por episódio; distribuição geral; carboidratos × variação (faixas, distribuição, correlação com 10+ pares, dispersão); alimentos mais usados.
- Comparar: dois grupos quaisquer (tipos, refeições repetidas, faixas de carboidratos) com avisos de glicemia inicial, intervalo e amostra diferentes; refeições repetidas com amplitude entre repetições.
- Padrões: mínimo de 5 episódios no grupo e 3 ocorrências; sempre com n e lista dos episódios; sem causalidade.
- Qualidade: sem horário, sem carboidratos, sem antes/depois, intervalo curto/longo, associação pouco confiável, alimentos não reconhecidos, duplicados, sem contexto.
- Filtros (todos opcionais): período, tipo, alimento, carboidratos, contexto (dia de semana/fim de semana), insulina registrada, origem, só repetidas. Preservados entre aberturas.
- Detalhe do episódio: medições, informações nutricionais registradas, alimentos, **Abrir no Bolus** e editar a refeição feita (fluxo já existente).
- Barras neon laterais por categoria; temas claro e escuro; sem rolagem horizontal.

## Arquivos
- Novos: `src/refeicoes-core.js`, `src/refeicoes.js`, `src/refeicoes.css`, `tests/test48.js` (lógica, 42 verificações), `tests/test49.js` (navegador, 28 verificações).
- Alterados: `src/analise.js` (registra a seção 14), `scripts/build-web.js`, `package.json` (testes), `tests/test28.js` (14 seções).
