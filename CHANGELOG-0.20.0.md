# TiaBete 0.20.0 — Bolus: menus, etiquetas, alimentos frequentes

- Menus do bolus: **Razão** agora é o primeiro (vermelho do TiaBete) e **Alimentos** tem acento âmbar próprio; mesmo tamanho dos demais.
- Refeições: Café da manhã, Almoço, **Lanche da tarde**, Jantar e **Ceia** (nova). Dados antigos continuam intactos (ceia nasce vazia, sem bolus).
- Ordem igual em todas as refeições: Alimentos → Total da refeição → Refeição feita.
- Nova etiqueta nutricional (refeição, total, dia e menu Alimentos): carboidratos líquidos em destaque, depois totais, fibras, proteínas, gorduras, calorias e porção, sem abreviações.
- **Alimentos frequentes** em cada refeição (22 a 36 por refeição): um toque adiciona a porção de referência (marcada "confira a quantidade real" até você editar); repetir soma no mesmo item; ordem por adequação, favoritos, seu histórico (90 dias), carboidrato e variedade; "Ver todos" e busca em toda a biblioteca.
- Menu Alimentos: base única para todas as refeições; busca, filtros (favoritos, por refeição, sem refeição), ★ favorito, "Frequente em" por refeição, porção de referência editável. Associar não cria cópia.
- Não mudou: razão, fator de correção, arredondamento, método de fibras (líquido = totais − fibras), padrões, histórico, Análises. Valores dos alimentos novos são estimados (marcados "est.").
Arquivos: src/bolusfoods.js (novo), src/bolus2.css (novo), src/bolus.js, src/app.js, scripts/build-web.js, package.json.
