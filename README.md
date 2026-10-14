# RIVALY

> **Find allies. Meet rivals.** Plataforma de identidade gamer (Rival + Ally) construída em torno do **Passaporte Gamer**.

Produção: <https://rivaly-social.vercel.app>

A RIVALY reúne num só registro quem a pessoa é como jogadora: plataformas, jogos, horários, funções no time, um perfil comportamental (o **DNA Gamer**), nível, reputação e conquistas. Todo o resto do produto lê ou escreve nesse registro:

```text
Biblioteca → preferências → DNA Gamer → compatibilidade → Squads → Arena e Clãs → Feed → XP e conquistas → Passaporte
```

Projeto individual do desafio Happy Game (FIAP, Fase 2). Autor: Guilherme Oliveira Santos, RM576218, 2026.

---

## O que há de novo na V2

| Área | O que mudou |
|---|---|
| **Arena** | Duelo, Squad e Clã vs Clã com rating no estilo Elo. Antes de cada partida aparece a chance de vitória e quanto o rating sobe ou cai; depois, a conta do resultado. Temporada semanal, ranking em tabela (jogadores e clãs) e histórico paginado. |
| **Clãs** | Explorar clãs pela compatibilidade com o seu DNA, entrar, candidatar-se, criar um clã (emblema personalizável: formato do escudo, padrão e cores, com a tag no centro), gerenciar o elenco e acompanhar nível e meta semanal. |
| **Feed** | Posts de até 280 caracteres, reações (GG, Respeito, Rivalidade), comentários e abas para clã, aliados, rivais e Arena. Junta a atividade do usuário com os posts da comunidade. |
| **Squads** | Depois da busca, o usuário joga uma **sessão** com 2 a 4 jogadores (escolhidos ou sorteados). No pós-partida marca cada colega como Aliado, Rival ou Neutro. |
| **Centro de convites** | Sino no topo, com contador: convites de clã, respostas de candidatura e desafios da Arena. |
| **Bootstrap 5.3** | Infraestrutura visível (grid, navbar, offcanvas, modal, dropdown, formulários, tabela, accordion, paginação) vestida com a identidade preto e amarelo. |
| **Arquitetura de informação** | Navegação agrupada (Você, Comunidade, Explorar, Conta) a partir de uma fonte única, página **Mapa do site** com busca, `sitemap.xml` e página 404. |
| **Validação e UX Writing** | `validation.js` com regras reutilizáveis e erro inline; todo o site em PT-BR, com botões que dizem o resultado. |
| **Segurança** | CSP e cabeçalhos de segurança no `vercel.json`, sem script inline, `?redirect=` restrito ao próprio site, texto do usuário sempre escapado. |

---

## Comunidade simulada

A RIVALY **não tem servidor nem outros usuários reais**. Os outros jogadores são 33 perfis semeados (`js/data.js`) e 7 clãs formados por eles. A interface diz isso em toda tela da comunidade (selo "Comunidade simulada", com explicação no tooltip).

Tudo o que esses jogadores "fazem" (aceitar ou recusar uma candidatura, convidar você para um clã, desafiar você na Arena, postar no Feed, ganhar uma partida) sai de um **motor determinístico e explicável** (`js/community.js`):

- **Sem `Math.random()` no domínio.** Os sorteios vêm de `js/rng.js` (mulberry32), semeados com o id do usuário, o id da entidade e a **semana ISO**. O mesmo cenário sempre dá o mesmo resultado, e a comunidade muda de uma semana para a outra.
- **Toda decisão devolve `{ decision, reasons[], score, threshold }`.** A tela mostra os motivos, inclusive o número sorteado, em "Por quê?" e "Ver a conta".
- **Respostas não são instantâneas.** Candidaturas e convites enviados ganham um intervalo simulado (12 s), persistido; a resposta chega no centro de convites na próxima visita ou quando o temporizador passa por ela.

Exemplo de decisão (candidatura a um clã):

```text
+ Seu rank (Diamante) cumpre o mínimo (Diamante).
+ Sua reputação (88) cumpre o mínimo de 85.
+ Há 5 vagas no clã.
+ Compatibilidade média com o elenco: 92%.        +92
+ Você joga Valorant, um dos jogos foco do clã.   +10
+ Estilo de jogo próximo do clã (Hardcore).        +5
- Avaliação do líder nesta semana: −3.             −3
+ Nota final 104; o clã aceita a partir de 65.
```

---

## Fórmulas

### Compatibilidade (7 fatores)

Cada fator vale de 0 a 100 e é multiplicado pelo peso. A soma é a nota.

| Fator | Peso | Como pontua |
|---|---|---|
| Jogo | 20% | joga o jogo = 100; gêneros parecidos = 62 ou 48; nada em comum = 15 |
| Rank | 15% | pela distância na escada (mesmo degrau = 100, um degrau = 85...) |
| Horário | 15% | pela distância entre faixas de horário |
| Estilo de jogo | 15% | pela distância entre Casual, Equilibrado, Competitivo e Hardcore |
| Função | 15% | função complementar = 100; mesma função = 52 |
| Comunicação | 10% | preferência de voz, multiplicada por 0,6 sem idioma em comum |
| Reputação | 10% | a reputação do jogador, direto |

A compatibilidade de um **clã** é a média dessa nota entre o usuário e cada membro.

### Arena (estilo Elo)

```text
expectativa   E  = 1 / (1 + 10^((Rb − Ra) / 400))
novo rating   R' = R + K × (S − E)        S = 1 vitória, 0 derrota
K = 40 nas 10 primeiras partidas, 32 depois. Rating inicial: 1000.
```

O resultado sai de um sorteio determinístico comparado com E (sorteio < E = vitória). Squad usa a média dos ratings do time; Clã vs Clã usa a média dos 3 melhores de cada lado. Tiers: Bronze, Prata (900), Ouro (1100), Platina (1300), Diamante (1500) e Lenda (1700). Temporada = semana ISO; pontos da temporada: vitória 3, derrota 1.

Rating dos jogadores semeados (sempre o mesmo): `700 + 95 × degrau do rank + 5 × (reputação − 60) + 40 × log10(partidas + 1)`.

### Sessão de squad

```text
poder do jogador = degrau do rank × 10 + reputação × 0,5
força do squad   = média dos poderes + (compatibilidade média − 60) × 0,3
adversário       = força do squad + desvio sorteado entre −12 e +12
chance           = 1 / (1 + e^(−(nós − eles) / 6))
```

### XP

| Ação | XP |
|---|---|
| Passaporte criado / DNA concluído / Passaporte 100% | 100 / 200 / 200 |
| Jogo adicionado / zerado / avaliado | 50 / 75 / 15 |
| Busca de squad / parceiro salvo / match acima de 90% | 150 / 60 / 120 |
| **Sessão de squad** | 120 |
| **Aliado ou Rival declarado** (uma vez por jogador) | 30 |
| **Entrar em um clã** (uma vez por clã) / **criar clã** (uma vez) | 150 / 200 |
| **Vitória na Arena** / **derrota na Arena** | 90 / 35 |
| **Post** / **reação** no Feed (até 6 por dia, somados) | 20 / 5 |
| Conquista desbloqueada | 40 |

Nível: avançar do nível L para L+1 custa `1000 + (L − 1) × 500` XP. Clã: chegar ao nível N exige `120 × (N − 1)²` XP; a meta semanal é 60 pontos por integrante.

**Reputação** e **Pontuação Gamer** não mudaram na V2 (ver `js/gamification.js`). O rating de Arena é uma métrica separada.

### Conquistas

28 conquistas em cinco raridades (Comum, Incomum, Rara, Épica, Lendária). As 8 novas: Primeira Sessão, Aliado Declarado, Rival Digno, Recruta, Bandeira Erguida, Primeira Vitória na Arena, Lenda da Arena e Voz da Comunidade.

---

## Stack

```text
HTML5 · CSS3 · JavaScript (ES Modules) · Bootstrap 5.3.8
```

- **Bootstrap 5.3.8**, baixado e servido localmente em `vendor/bootstrap/` (`bootstrap.min.css` e `bootstrap.bundle.min.js`), sem CDN. `css/bootstrap-theme.css` liga as variáveis `--bs-*` aos tokens da marca.
- **Sem React, Tailwind, jQuery ou backend.** Persistência só no navegador, via `js/storage.js` (namespace `rivaly:`, schema 2).
- **Fontes locais**: Chakra Petch e Jersey 10 (`css/fonts.css`).
- **Imagens externas** permitidas na CSP: capas da Steam CDN e do IGDB (via GameDB), avatares do DiceBear. Emblemas de clã, avatares dos jogadores semeados e fallbacks de capa são gerados no navegador.
- **Vite** é só ferramenta de desenvolvimento e build (`devDependency`).

---

## Como rodar localmente

Os ES Modules não carregam por `file://`, então é preciso um servidor.

```bash
npm install
npm run dev        # http://localhost:5173 (ou: start.bat / ./start.sh)
npm run build      # gera dist/ com as 15 páginas
npm run preview    # serve dist/ com os mesmos cabeçalhos de segurança do vercel.json
npm test           # testes de unidade do domínio (node:test, sem dependências)
```

Sem Node, `python -m http.server 5500` na raiz também abre o site, mas as imagens de `public/` (marca e capas locais) só aparecem pelo Vite ou pela Vercel.

Scripts de manutenção:

```bash
npm run sync:chrome    # regrava navbar, offcanvas, barra inferior e rodapé de cada página a partir do SITE_MAP
npm run docs:sitemap   # regera docs/mapa-do-site.md a partir do SITE_MAP
```

---

## Conta demo

Na tela de login, **"Explorar com a conta demo"** monta em um clique um Passaporte completo: DNA, 14 jogos, squad salvo, o clã [RVLY] liderado pelo usuário, sessões avaliadas (aliados e rivais), histórico de Arena, posts no Feed e uma resposta esperando no centro de convites. Tudo passa pelas funções reais do domínio.

```text
e-mail  demo@happygame.local
senha   demo1234
```

A conta é local: não há servidor, recuperação de senha nem sincronização entre dispositivos. A senha fica guardada só como hash (SHA-256 com sal fixo), e o aviso aparece na tela de login.

---

## Mapa do site

Fonte única: `js/site-map.js`. A mesma árvore alimenta a navegação, a página `sitemap.html` e o `docs/mapa-do-site.md`.

```text
RIVALY
├── Você ........... Início · Passaporte · Biblioteca · Conquistas
├── Comunidade ..... Squads · Arena · Clãs · Feed
├── Explorar ....... Descobrir
├── Conta .......... Configurações · Mapa do site
└── Públicas ....... Início público · Entrar ou criar conta · Onboarding
```

No celular, a barra inferior tem Início, Passaporte, Squads, Arena e **Mais** (abre o menu completo em offcanvas). A página `404.html` explica o erro e oferece o Início e o Mapa do site.

---

## Estrutura de pastas

```text
├── *.html                    15 páginas (inclui arena, clans, feed, sitemap e 404)
├── vendor/bootstrap/         Bootstrap 5.3.8 local
├── css/
│   ├── bootstrap-theme.css   ponte entre os tokens da RIVALY e o Bootstrap
│   ├── variables.css         todos os tokens (cores, tipografia, espaços)
│   ├── reset.css · global.css · animations.css · components.css · layout.css
│   ├── community.css         componentes da comunidade (selo, emblema, cartão do jogador)
│   └── pages/                um arquivo por página
├── js/
│   ├── storage.js            a única porta para o localStorage (schema 2 + migração)
│   ├── site-map.js           arquitetura de informação (fonte única)
│   ├── data.js               jogos, 33 jogadores, 7 clãs, conquistas, regras de XP
│   ├── rng.js                PRNG determinístico + semana ISO
│   ├── community.js          motor da comunidade simulada
│   ├── clans-store.js · arena-store.js · feed-store.js · sessions.js · invites.js · partners.js
│   ├── validation.js         regras de formulário e feedback inline
│   ├── compatibility.js · gamification.js · gamer-dna.js · profile.js · auth.js
│   ├── modal.js              diálogo sobre bootstrap.Modal (mesma API da V1)
│   ├── navigation.js         estado da navegação, XP e centro de convites
│   ├── community-ui.js · arena-ui.js · clan-ui.js · player-card.js
│   └── <página>.js           controllers (DOM e eventos)
├── public/                   marca, capturas, capas locais, sitemap.xml, robots.txt
├── tools/                    sync-chrome.mjs, sitemap-doc.mjs, fetch-assets.mjs
├── tests/                    testes de unidade do domínio (Elo, temporada, RNG, validação)
├── docs/                     decisões, mapa do site, evidências de JS, voz e tom, roteiro
└── vercel.json               cabeçalhos de segurança (CSP)
```

---

## Documentação

| Arquivo | Conteúdo |
|---|---|
| `docs/decisoes-v2.md` | Design rationale: decisão, problema na V1, justificativa e implementação |
| `docs/mapa-do-site.md` | A árvore do site em texto |
| `docs/evidencias-js.md` | Onde estão DOM, eventos, validação, funções, arrays e cada componente do Bootstrap |
| `docs/voz-e-tom.md` | Quadro de voz e tom |
| `docs/ux-writing-antes-depois.md` | Textos reais da V1 e da V2, com o motivo de cada mudança |
| `docs/roadmap.md` | O que a V2 entregou e o que continua no futuro |
| `CHANGELOG.md` | Mudanças da v1.0 para a v2.0 |

---

## Fora do escopo

Backend, contas e jogadores reais, chat em tempo real, multiplayer real, sincronização entre dispositivos, notificações push, pagamentos, integrações reais com Steam, PSN ou Xbox e IA de recomendação. O que depende disso está em `docs/roadmap.md` e aparece na landing como roteiro, nunca como botão.

---

## Créditos

RIVALY · Guilherme Oliveira Santos · RM576218 · FIAP 2026.

Títulos de jogos usados como conteúdo demonstrativo; as artes pertencem aos seus detentores. Avatares por [DiceBear](https://dicebear.com). Base de jogos aberta [LizardByte GameDB](https://github.com/LizardByte/GameDB). Bootstrap sob licença MIT (`vendor/bootstrap/LICENSE`).
