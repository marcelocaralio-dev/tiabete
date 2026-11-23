# 0.41.0 · Abertura animada (Splash Screen) GLUXO

Etapa de inicialização com o vídeo oficial da animação do logotipo (`assets/splash/gluxo-splash.mp4`, 1280×720, 2,6 s), usado **sem nenhuma alteração** (SHA-256 conferido no teste).

- **Fluxo:** abrir o app → splash em preto absoluto (#000000) → fade de 0,38 s → Home. Não é rota: é uma camada que fica antes de todo o código do app (`src/splash.html`, inserida no início do `index.html`) e começa a tocar antes de o app carregar.
- **Apresentação:** vídeo mudo, tela cheia, `object-fit: contain` (centralizado, sem cortar, esticar ou distorcer), sem controles, barra, botão, texto ou spinner. Pôster preto evita o ícone de play do WebView.
- **Duração:** a do vídeo. Termina no evento `ended`; o fade só espera a Home (e, no APK, a decisão da tela de entrada) estarem prontas, com limite de 2,5 s depois do fim.
- **Uma vez por sessão:** `sessionStorage` impede repetir em recarga; navegar entre Início, Histórico, Relatórios etc. nunca a repete (nova abertura do app = nova sessão).
- **À prova de falhas:** sem codec, erro, autoplay barrado ou vídeo travado, a abertura é dispensada (limite máximo de 9 s); nunca prende o usuário.
- **Local e leve:** o vídeo vai em `www/splash/` (≈ 243 KB), sem internet; ao terminar, o decodificador é liberado e o elemento removido. O app carrega em paralelo, sem bloqueio. Com as fontes locais presentes, o link externo do Google Fonts deixa de ser incluído (ele atrasava a execução do app sem internet).
- **Android:** `capacitor.config.json` → `backgroundColor` `#000000`; `scripts/patch-android.js` deixa o tema de lançamento preto (sem a imagem padrão do Capacitor), idempotente.
- **PWA:** o vídeo entra no cache offline; o service worker não tenta mais guardar respostas parciais (206).
- Substitui a splash estática antiga de `native/login.js` (que agora só avisa a nova splash quando a tela de entrada está decidida).

Teste: `tests/test42.js` (26 verificações: arquivo intacto, build, integração, lógica de tempo e falhas, e navegador real). `tests/test33.js` ajustado (fundo preto do Android e local do `prefers-reduced-motion`).
Arquivos: `assets/splash/gluxo-splash.mp4`, `src/splash.html`, `src/head.html`, `src/init.js`, `native/login.js`, `scripts/build-web.js`, `scripts/build-pwa.js`, `scripts/patch-android.js`, `capacitor.config.json`, `package.json`, `tests/test33.js`, `tests/test42.js`, este arquivo.
