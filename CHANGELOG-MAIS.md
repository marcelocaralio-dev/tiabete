# Aba Mais: nova hierarquia

Só a ordem e o agrupamento mudaram (`menuGroups()` e `maisMenu()` em `src/app.js`). Rotas, telas, dados, campos e ações são os mesmos. Os 24 itens de antes continuam acessíveis, sem duplicidade.

Ordem (do mais ao menos importante):
1. **Meu perfil** (sempre o primeiro; atalho direto)
2. **Saúde e diabetes**: Hemoglobina glicada, Exames laboratoriais, Protocolo de hipoglicemia
3. **Tratamento e insulina**: Meu tratamento, Histórico de insulinas
4. **Cálculo de bolus** (atalho direto)
5. **Histórico e registros**: Classificar medições, Eventos, Importar do mySugr
6. **Relatórios e estatísticas**: Relatórios, Padrões, Conquistas
7. **Inteligência artificial**: Perguntar ao Claude, Provedor e chave
8. **Cópia de segurança** (exportar, restaurar, Google Drive e CSV; atalho direto)
9. **Segurança e privacidade**: Bloqueio e proteção, Privacidade e armazenamento
10. **Alertas e lembretes**: Alertas e lembretes, Alertas personalizados, Histórico de alertas
11. **Aparência e ajustes**: Aparência, Configurações
12. **Sobre o TiaBete** (atalho direto)

- Categoria com um só item abre direto a tela, sem expandir (menos um toque), com o mesmo visual das demais.
- A busca continua achando tudo; o nome da categoria só aparece nos resultados quando ela tem mais de um item.
- O menu lateral (drawer) segue a mesma ordem, pois é montado a partir da mesma lista.
