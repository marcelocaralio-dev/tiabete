# 0.33.0 · PROMPT 52 · Modo visitante, 14 dias Premium e persistência de licenças
- Visitante ("Continuar sem conta") recebe os mesmos 14 dias Premium, contados no primeiro acesso efetivo, no servidor.
- (O teste provisório de 72 h desta versão foi removido na 0.34.0.)
- Vale sempre o início mais antigo entre instalação e conta: login, logout e troca de conta não reiniciam.
- Relógio protegido (não recua nem congela) e gravado com frequência.
- Tela de entrada com dois botões equivalentes e aviso das limitações; avisos de fim de teste discretos.
- Oferta de cópia no Drive e mesclagem ao entrar com Google, sem enviar nada sozinho e sem apagar nada.
- Backend: migration `0005_guests.sql` + deploy do Worker.
Relatório completo: docs/VISITANTE-TESTE-14-DIAS.md
