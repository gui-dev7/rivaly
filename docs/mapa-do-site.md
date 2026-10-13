# Mapa do site da RIVALY

Gerado a partir de `js/site-map.js` por `tools/sitemap-doc.mjs`. É a mesma árvore usada pela navegação (sidebar, offcanvas, barra inferior e rodapé) e pela página `sitemap.html`.

Total: 14 páginas em 5 grupos. Páginas marcadas com (conta) exigem uma conta local; sem sessão, o mapa leva ao login e volta para a página escolhida.

## Árvore

```text
RIVALY
├── Você
│   ├── Início (dashboard.html) (conta)
│   │   ├── Próximo passo
│   │   └── Arena e clã
│   ├── Passaporte (passport.html) (conta)
│   │   ├── Comunidade
│   │   └── DNA Gamer
│   ├── Biblioteca (library.html) (conta)
│   └── Conquistas (achievements.html) (conta)
├── Comunidade
│   ├── Squads (squads.html) (conta)
│   │   ├── Buscar squad
│   │   ├── Jogar uma sessão
│   │   └── Seu squad
│   ├── Arena (arena.html) (conta)
│   │   ├── Jogar
│   │   ├── Ranking
│   │   ├── Histórico
│   │   └── Como o rating funciona
│   ├── Clãs (clans.html) (conta)
│   │   ├── Meu clã
│   │   ├── Explorar clãs
│   │   └── Criar clã
│   └── Feed (feed.html) (conta)
│       ├── Publicar
│       └── Abas
├── Explorar
│   └── Descobrir (discover.html) (conta)
├── Conta
│   ├── Configurações (settings.html) (conta)
│   └── Mapa do site (sitemap.html)
└── Páginas públicas
    ├── Início público (index.html)
    ├── Entrar ou criar conta (login.html)
    │   ├── Entrar
    │   └── Criar conta
    └── Onboarding (onboarding.html) (conta)
```

## Você

Sua identidade: o Passaporte e tudo o que alimenta ele.

| Página | Arquivo | O que faz |
|---|---|---|
| Início (conta) | `dashboard.html` | Resumo do Passaporte, próximo passo, Arena, clã e atividade recente. |
| ↳ Próximo passo | `dashboard.html#nextStepTitle` | A ação que mais faz o seu Passaporte avançar agora. |
| ↳ Arena e clã | `dashboard.html#communityTitle` | Seu rating, seu tier e a meta semanal do clã. |
| Passaporte (conta) | `passport.html` | O cartão de identidade gamer: DNA, preferências, medalhas e comunidade. |
| ↳ Comunidade | `passport.html#communityTitle` | Clã, rating de Arena, aliados e rivais. |
| ↳ DNA Gamer | `passport.html#dnaFullTitle` | Seis atributos e o seu arquétipo. |
| Biblioteca (conta) | `library.html` | Tudo o que você joga, já zerou ou quer jogar, com horas e notas. |
| Conquistas (conta) | `achievements.html` | Medalhas em cinco raridades, cada uma ligada a algo que você fez. |

## Comunidade

Onde o Passaporte encontra outros jogadores. A comunidade é simulada e explica cada decisão.

| Página | Arquivo | O que faz |
|---|---|---|
| Squads (conta) | `squads.html` | Encontre parceiros compatíveis e jogue uma sessão com eles. |
| ↳ Buscar squad | `squads.html#searchTitle` | Sete fatores ponderados e a conta completa de cada resultado. |
| ↳ Jogar uma sessão | `squads.html#resultsTitle` | Escolha o squad ou peça um sorteio ponderado por compatibilidade. |
| ↳ Seu squad | `squads.html#savedTitle` | Os parceiros que você salvou. |
| Arena (conta) | `arena.html` | Duelos, partidas de squad e Clã vs Clã com rating no estilo Elo. |
| ↳ Jogar | `arena.html#playTitle` | Duelo, Squad ou Clã vs Clã, com a chance de vitória antes de confirmar. |
| ↳ Ranking | `arena.html#rankingTitle` | Tabela de jogadores e de clãs da temporada. |
| ↳ Histórico | `arena.html#historyTitle` | Suas partidas, com a conta de cada resultado. |
| ↳ Como o rating funciona | `arena.html#rulesTitle` | A fórmula da expectativa e do ganho de rating. |
| Clãs (conta) | `clans.html` | Explore, entre, crie e gerencie um clã com identidade própria. |
| ↳ Meu clã | `clans.html#myClanTitle` | Elenco, meta semanal e gestão para líderes e oficiais. |
| ↳ Explorar clãs | `clans.html#exploreTitle` | Filtros, busca e compatibilidade de cada clã com você. |
| ↳ Criar clã | `clans.html#createTitle` | Nome, tag, política e emblema gerado a partir da tag. |
| Feed (conta) | `feed.html` | Posts, reações e comentários da sua comunidade, com filtros por aba. |
| ↳ Publicar | `feed.html#composerTitle` | Escreva até 280 caracteres. |
| ↳ Abas | `feed.html#feedTitle` | Tudo, Meu clã, Aliados, Rivais e Arena. |

## Explorar

Fora do catálogo da RIVALY: a base aberta do GameDB.

| Página | Arquivo | O que faz |
|---|---|---|
| Descobrir (conta) | `discover.html` | Busque qualquer jogo na base aberta e registre direto na Biblioteca. |

## Conta

Preferências, dados locais e o mapa de tudo.

| Página | Arquivo | O que faz |
|---|---|---|
| Configurações (conta) | `settings.html` | Tema, movimento, notificações, exportação e reset dos dados locais. |
| Mapa do site | `sitemap.html` | Todas as páginas da RIVALY, com busca e a explicação de como se conectam. |

## Páginas públicas

O que qualquer visitante vê antes de entrar.

| Página | Arquivo | O que faz |
|---|---|---|
| Início público | `index.html` | Apresentação da RIVALY, o motor de compatibilidade e o roteiro. |
| Entrar ou criar conta | `login.html` | Conta local de demonstração, com aviso claro de que nada sai do navegador. |
| ↳ Entrar | `login.html?mode=signin` | Volte para o seu Passaporte. |
| ↳ Criar conta | `login.html?mode=create` | Três campos e o Passaporte nasce. |
| Onboarding (conta) | `onboarding.html` | Montagem do perfil e as dez perguntas do DNA Gamer. |

## Como as áreas se conectam

Passaporte → DNA Gamer → Squads (compatibilidade e sessão) → Arena e Clãs → Feed → XP e conquistas → Passaporte.

1. **Passaporte e DNA**: plataformas, horários, funções e jogos; dez perguntas viram seis atributos e um arquétipo.
2. **Squads**: o Motor de Compatibilidade compara o Passaporte com cada jogador em sete fatores; com os melhores, o usuário joga uma sessão.
3. **Pós-partida**: cada colega vira Aliado, Rival ou Neutro; rivais viram desafios na Arena e colegas com clã podem convidar.
4. **Arena e Clãs**: rating no estilo Elo com a chance antes de cada partida; vitórias somam para a meta semanal e o XP do clã.
5. **Feed e XP**: sessões, partidas, clãs e posts aparecem no Feed e rendem XP e conquistas, que voltam para o Passaporte.
