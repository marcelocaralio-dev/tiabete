# Ativar o backup no Google Drive (passo a passo)

Você faz isto **uma vez**. É grátis. O backup no Drive só funciona depois que você cria uma "chave de acesso" (ID do cliente) no Google. Sem isso, o resto do app funciona normalmente.

Dados do app para preencher abaixo:
- Nome do pacote: `app.tiabete.glicose`
- Impressão digital SHA-1: `D8:5C:5A:BC:06:A8:91:EF:B6:19:B6:49:9E:60:D1:76:D8:E5:FA:87`

## 1. Criar o projeto
1. Entre em https://console.cloud.google.com com a sua conta Google.
2. No topo, clique no seletor de projetos → **Novo projeto** → nome `TiaBete` → **Criar**.

## 2. Ativar a API do Drive
1. Menu ☰ → **APIs e serviços** → **Biblioteca**.
2. Pesquise **Google Drive API** → **Ativar**.

## 3. Tela de consentimento
1. **APIs e serviços** → **Tela de permissão OAuth** (ou "Google Auth Platform").
2. Tipo de usuário: **Externo**. Nome do app: `TiaBete`. E-mail de suporte: o seu. Salve.
3. Em **Escopos / Acesso a dados**, adicione `.../auth/drive.file` ("Ver, editar, criar e excluir somente os arquivos do Google Drive que você usa com este app").
4. Em **Público**, clique em **Publicar app** (mudar de "Teste" para "Produção"). Sem isso, o login expira a cada 7 dias. Como o escopo `drive.file` não é restrito, não exige verificação demorada; pode aparecer um aviso de "app não verificado" no login, e é normal para um app pessoal (Avançado → Continuar).

## 4. Criar o ID do cliente Android
1. **APIs e serviços** → **Credenciais** → **Criar credenciais** → **ID do cliente OAuth**.
2. Tipo de aplicativo: **Android**. Nome: `TiaBete Android`.
3. Nome do pacote: `app.tiabete.glicose`. Impressão digital SHA-1: a do início deste arquivo.
4. Abra **Configurações avançadas** e ative **Ativar esquema de URI personalizado** (custom URI scheme). Esse passo é essencial.
5. **Criar**. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`).

## 5. Dar o ID ao app (escolha uma opção)
- **Opção A (recomendada):** no GitHub, em `tiabete` → **Add file → Create new file**, nome `config/google-client-id.txt`, conteúdo: só o ID do cliente. Commit. Depois rode **Actions → APK Android → Run workflow** e instale o novo APK. O ID não é segredo.
- **Opção B:** instale o APK sem o arquivo e cole o ID no app, em **Mais → Backup e dados → Google Drive**.

## 6. Conectar
No app: **Mais → Backup e dados → Google Drive → Conectar conta Google**. Entre, aceite a permissão e volte ao app. Depois use **Fazer backup no Drive agora** e, se quiser, ligue o backup automático.

## Segurança
- O app só enxerga os arquivos que ele mesmo criou (permissão `drive.file`), nunca o resto do seu Drive.
- Para desconectar: botão **Desconectar** no app ou https://myaccount.google.com/permissions.
- Se o login falhar com "redirect_uri_mismatch" ou "invalid_request", confira o passo 4.4 e o pacote/SHA-1.
