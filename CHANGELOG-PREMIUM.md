# Central Premium · página de Licença Vitalícia

**Escopo:** só a experiência da página Licença para quem tem a licença vitalícia ativa. O módulo de licenciamento NÃO foi alterado.

## O que mudou
- **`src/premium.js` (novo):** troca a tela `licenca` pela Central Premium **somente** quando `licStatus() === 'lifetime_active'`. Teste, pendente, expirada, reembolsada, sem conta, sem servidor e modo de desenvolvimento continuam com a tela original (`viewLicenca`), inclusive o fluxo de "Usar este lugar" quando o limite de aparelhos é atingido.
- **`src/premium.css` (novo):** estilos pequenos que usam só as variáveis e os componentes já existentes (cartões, chips, badges, botões, banner, janela de confirmação).
- **`scripts/build-web.js`:** inclui `premium.js` logo depois de `license.js` e `premium.css` no fim do CSS (duas linhas).
- **`scripts/build-pwa.js`, `assets/pwa/*` (novos), `package.json` (script `build:pwa`), `.gitignore` (`pwa/`):** versão instalável pelo navegador. Não mexe em `www/` nem no APK.
- **`tests/test23.js` (novo, 40 verificações)** e `npm test` passa a executá-lo.

## Comportamento da Central
1. **Saudação:** "Você é Premium! Aproveite tudo o que o GLUXO tem a oferecer.", selo "Ativa", licença vitalícia, sem cobrança recorrente, vínculo com a conta Google. O agradecimento aparece só na primeira semana depois da primeira visita (depois fica a versão compacta).
2. **Aparelhos conectados:** nome/modelo e sistema (só quando o nome registrado pelo app realmente diz), vinculado em, última consulta à licença, selo "Este aparelho", contador "N de 2", aviso de limite atingido / vaga restante, "Lista atualizada em…", botão **Atualizar lista**, **Apelido** (guardado só neste aparelho), **Desconectar** (com confirmação) e **Desconectar os outros aparelhos** (com confirmação). O aparelho atual nunca é removido por esta tela, e se o app não souber qual é o aparelho atual, nenhum botão de desconexão aparece.
3. **O que a licença inclui:** montado a partir de `LIC_PREMIUM`/`LIC_LIFETIME` (nada escrito à mão), cada recurso com botão "Abrir".
4. **Conta e situação:** e-mail mascarado, situação, última validação pelo servidor, "Funciona sem internet até".
5. **Segurança e ajuda:** orientações de proteção da conta Google, atalhos para Bloqueio e Cópia de segurança, passo a passo de troca de aparelho e de recuperação de acesso.
6. **Estados:** carregando ("Consultando…", botões desabilitados), sucesso e erro por aviso (toast), anti-duplicação (toques repetidos geram uma única chamada), aviso de "Validação pendente" quando o token venceu offline.

## Usa o que já existe (sem alterar)
`licRefresh(true)` para atualizar; `licRemoveDevice(id)` (endpoint `/v1/devices/remove` já existente) para desconectar; `licAuth()` apenas para saber se há credencial. Depois de cada remoção a tela confere a lista: só mostra sucesso se o aparelho saiu mesmo.

## Não implementado (e por quê)
- **Data de aquisição/ativação, histórico de vinculações e alterações da licença:** o servidor guarda `activated_at` e eventos, mas não os envia ao app. Exibir exigiria mudar a API/Worker (proibido). Alternativa segura: expor esses campos em `/v1/refresh` numa versão futura do Worker, com sua autorização.
- **Modelo/sistema detalhados:** o app só registra o nome tirado do user-agent; mostramos apenas o que ele contém.
- **"Atualizações futuras incluídas":** não há texto nem regra no sistema que garanta isso; por isso não aparece. Se for compromisso comercial, informe e adicionamos a frase.
- **Canal de suporte:** o app não tem canal próprio; nenhum foi inventado. A estrutura de ajuda (troca de aparelho, recuperação) está pronta para receber um botão quando existir.
- **Desconectar o próprio aparelho:** cortaria o acesso de quem está usando; não oferecido.
