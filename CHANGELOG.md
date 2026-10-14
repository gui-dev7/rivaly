# Changelog

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [2.0.0] — 2026-10-14

A V2 transforma Arena, Feed e Clãs (antes "em breve") em áreas reais, ligadas ao Passaporte, sobre uma comunidade simulada e explicável. Bootstrap 5.3 entra como infraestrutura visual.

### Adicionado

- **Arena** (`arena.html`): Duelo, Squad e Clã vs Clã com rating no estilo Elo (inicial 1000, K 40/32), modal com chance de vitória e cenários antes de confirmar, resultado com a conta, tiers (Bronze a Lenda), temporada semanal, ranking em tabela com abas Jogadores/Clãs e filtro por jogo, histórico paginado e accordion "Como o rating funciona".
- **Clãs** (`clans.html`): 7 clãs semeados, explorar com filtros e busca em tempo real, compatibilidade do clã com o usuário (com breakdown), entrar em clã aberto, candidatura com validação e resposta adiada, criar clã com emblema gerado a partir da tag, gestão do elenco (promover, rebaixar, remover, transferir liderança, mudar política), sair do clã, nível e meta semanal.
- **Feed** (`feed.html`): composer com contador ao vivo e validação, reações GG/Respeito/Rivalidade, comentários, abas Tudo/Meu clã/Aliados/Rivais/Arena com estados vazios, posts simulados por semana.
- **Sessão de squad**: jogar com 2 a 4 jogadores escolhidos ou com um squad sorteado (ponderado pela compatibilidade), placar e conta do resultado, pós-partida com Aliado/Rival/Neutro, elogios e ações contextuais.
- **Centro de convites** no topo: convites de clã, respostas de candidatura e desafios, com contador e "Por quê?".
- **Cartão do jogador**: o mesmo modal em todo o site, com compatibilidade, clã, rating de Arena e ações.
- **Motor da comunidade simulada** (`js/community.js`) e **PRNG determinístico** (`js/rng.js`); stores `clans-store.js`, `arena-store.js`, `feed-store.js`, `sessions.js`, `invites.js` e `partners.js`.
- **Mapa do site** (`sitemap.html`) público, com busca, contador e "Como as áreas se conectam"; `sitemap.xml`, `robots.txt` e **página 404**.
- **`js/site-map.js`** como fonte única da navegação, e `tools/sync-chrome.mjs` para gravar a moldura em cada página.
- **`js/validation.js`**: regras puras (`required`, `minLength`, `maxLength`, `pattern`, `email`, `matches`, `unique`, `noHtml`...) e feedback inline.
- **Bootstrap 5.3.8 local** (`vendor/bootstrap/`) e `css/bootstrap-theme.css`.
- **`vercel.json`** com Content-Security-Policy e cabeçalhos de segurança.
- 7 jogadores semeados (total 33), 8 conquistas (total 28), 9 regras de XP novas.
- Seção **Comunidade** no Passaporte e card **Próximo passo** e resumo de Arena e clã no Início.
- Conta demo com clã, sessões, histórico de Arena, posts e uma resposta de convite.
- Landing: seção da comunidade simulada, tabela "O jogador brasileiro em números" com fontes e bloco de vídeo que só aparece com a URL configurada.
- Rodapé com créditos (RIVALY · Guilherme Oliveira Santos · RM576218 · FIAP 2026) e link para o mapa do site em todas as páginas.
- Documentação em `docs/`.
- Testes de unidade do domínio em `tests/` (`npm test`, com o executor nativo do Node).
- Navbar simples no login e no onboarding.

### Alterado

- `storage.js`: `SCHEMA_VERSION` 2, migração que só adiciona as chaves da comunidade e helpers de `sessionStorage`; nenhum outro módulo acessa Web Storage.
- Navegação: markup Bootstrap no HTML (navbar, offcanvas abaixo de 992 px, barra inferior com Início, Passaporte, Squads, Arena e Mais), agrupada em Você, Comunidade, Explorar e Conta.
- `modal.js` reimplementado sobre `bootstrap.Modal`, mantendo `openModal`, `closeModal` e `confirmDialog`.
- Botões, cards, formulários, tabelas e grids das páginas existentes migrados para as classes do Bootstrap, com aliases da V1 no CSS.
- Login, cadastro, onboarding, Biblioteca e Passaporte validados com `validation.js` (erro inline, foco no primeiro campo inválido, mensagem de sucesso).
- Interface 100% em PT-BR: ranks, regiões e gêneros traduzidos na exibição (os ids salvos continuam iguais).
- Textos de botões, erros e estados vazios revisados (ver `docs/ux-writing-antes-depois.md`).
- Cantos retos em todo o produto (raios zerados) e loading em preenchimento reto no lugar do spinner e do radar.
- Avatares procedurais dos jogadores semeados só em preto, amarelo e neutros.
- Tutorial guiado com passos de Arena, Clãs, Feed, convites e sessão.
- Configurações: tabela de dados com as chaves novas, exportação JSON com schema, interruptores `form-switch`.
- Contagem de conquistas vem de `ACHIEVEMENTS.length` em vez de número fixo.
- `cronograma.md` movido para `docs/roadmap.md`.

### Removido

- Itens "Em breve" da navegação (`NAV_SOON`) e Arena, Feed e Clãs do roteiro.
- Scripts inline do aviso de `file://` (agora `js/protocol-check.js`).
- Rodapé injetado por JS (`js/footer.js`) e ícones de redes sociais sem perfil.
- Menção a uma V2 em React + Tailwind.
- `en_pendente.txt` e `pend2.txt` (checklists de tradução já resolvidas).
- Utilitário `.row` da V1, que colidia com o grid do Bootstrap.

### Corrigido

- `?redirect=` do login aceitava qualquer URL, inclusive externa; agora só páginas do próprio site.
- URL de capa do GameDB era interpolada no HTML sem escape.
- `settings.js` lia o `localStorage` direto; `tour.js` e `loading.js` usavam `sessionStorage` direto.
- `Math.random()` no seletor de avatar trocado por `crypto.getRandomValues`.
- Números animados apareciam no formato americano (`4,585`); agora `4.585`.
- Tempo relativo sem acento ("ha 5 min") e concordância de plural ("1 vitórias").
- Listeners de diálogos anteriores disparavam de novo (ex.: salvar o jogador de um cartão já fechado); cada diálogo agora nasce num elemento novo.
- A mesma sessão de squad podia ir mais de uma vez para a Arena.
- Publicar post e reagir não geravam atividade; marcar aliado ou rival aparecia no Feed.
- O formulário "Criar clã" era apagado quando uma resposta de candidatura chegava.
- A conquista Recruta desbloqueava ao fundar um clã (agora só ao entrar em um).
- A faixa de arte do Passaporte nunca aparecia (campo `steamAppId` inexistente, herdado da V1).
- Chips, barras e interruptores ainda tinham cantos arredondados.
- No celular, o bloco do avatar do onboarding espremia o texto.

## [1.0.0] — 2026

Primeira versão: Passaporte Gamer, DNA Gamer, Biblioteca, Descobrir (GameDB), Squads com Motor de Compatibilidade, conquistas, XP, temas e tutorial guiado. Tag `v1.0`.
