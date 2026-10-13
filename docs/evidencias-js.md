# Evidências de JavaScript e Bootstrap

Onde cada item da rubrica aparece no código. As linhas são do commit da V2; os links abrem o arquivo na linha citada.

Todo o JavaScript é ES Modules sem framework. O Vite serve no desenvolvimento e empacota no build, mas não roda nada no navegador.

## 1. Manipulação do DOM

| Item | Onde | O que mostra |
|---|---|---|
| Criar elementos com `createElement` | [js/feed.js:45](../js/feed.js#L45) (`el`) | Helper que cria o elemento, aplica classes e atributos e anexa filhos; o Feed inteiro é montado com ele, sem `innerHTML` para texto do usuário. |
| Montar um componente a partir de dados | [js/feed.js:99](../js/feed.js#L99) (`buildPostElement`) | Um post vira um `<article>` com autor, texto (via `textContent`), reações e comentários. |
| Inserir sem recarregar a lista | [js/feed.js:423](../js/feed.js#L423) | O comentário novo entra com `append` no fim da lista daquele post e o contador muda; o resto do Feed fica como está. |
| Trocar o conteúdo de um contêiner | [js/feed.js:197](../js/feed.js#L197) | `replaceChildren` troca a lista quando a aba muda. |
| `classList` | [js/feed.js:358](../js/feed.js#L358), [js/squads.js:445](../js/squads.js#L445) | Liga e desliga o estado ativo da reação e o card de jogador selecionado no squad. |
| `dataset` | [js/feed.js:101](../js/feed.js#L101) | O id do post fica em `data-post` e é lido de volta na delegação de eventos. |
| `textContent` em tempo real | [js/feed.js:266](../js/feed.js#L266) (`updateComposer`) | O contador "N restantes" muda a cada tecla; a contagem de reações muda sem re-renderizar ([js/feed.js:357](../js/feed.js#L357)). |
| Contador e estado vazio | [js/sitemap.js:104](../js/sitemap.js#L104) (`render`) | A busca do mapa do site atualiza o contador de resultados e, quando nada combina, mostra o estado vazio com "Limpar busca". |
| Atributos ARIA pelo JS | [js/navigation.js:38](../js/navigation.js#L38) (`markCurrent`) | Marca o item da página atual com `aria-current="page"` na navbar, no offcanvas e na barra inferior. |
| Renderizar a partir de estado | [js/clans.js:116](../js/clans.js#L116) (`renderMyClan`), [js/clans.js:264](../js/clans.js#L264) (`renderExplore`) | Cada seção da página de Clãs é redesenhada a partir do store; texto semeado passa por `escapeHtml`. |

## 2. Eventos

| Item | Onde | O que mostra |
|---|---|---|
| `submit` com `preventDefault` | [js/feed.js:294](../js/feed.js#L294) | Publica o post: valida, grava pelo store, mostra o resultado e limpa o campo. |
| `input` | [js/feed.js:281](../js/feed.js#L281) | Contador e botão "Publicar" reagem a cada tecla. |
| `keydown` (atalho) | [js/feed.js:287](../js/feed.js#L287) | Ctrl+Enter (ou ⌘+Enter) publica sem tirar a mão do teclado. |
| `keydown` (setas) | [js/arena.js:444](../js/arena.js#L444) | Setas esquerda e direita trocam a aba do ranking, como o padrão de abas da WAI-ARIA. |
| `keydown` (Esc) | [js/sitemap.js:138](../js/sitemap.js#L138) | Esc limpa a busca do mapa do site e atualiza o contador. |
| Busca em tempo real | [js/clans.js:448](../js/clans.js#L448), [js/sitemap.js:126](../js/sitemap.js#L126) | A lista de clãs e o mapa do site filtram enquanto a pessoa digita. |
| `change` em filtros | [js/clans.js:452](../js/clans.js#L452), [js/arena.js:433](../js/arena.js#L433) | Filtros de clã (jogo, estilo, política) e filtro de jogo do ranking. |
| Transformar a entrada | [js/clans.js:398](../js/clans.js#L398) | A tag do clã vira maiúscula enquanto é digitada e o emblema é redesenhado na hora. |
| Delegação de eventos | [js/feed.js:350](../js/feed.js#L350), [js/arena.js:461](../js/arena.js#L461), [js/clans.js:465](../js/clans.js#L465) | Um único listener no contêiner atende reações, comentários e ações de cada card, inclusive os criados depois. |
| Delegação global | [js/navigation.js:281](../js/navigation.js#L281) (`initPlayerCards`) | Qualquer elemento com `data-player-card` em qualquer página abre o cartão do jogador. |
| Evento customizado | [js/clan-ui.js:31](../js/clan-ui.js#L31) → [js/navigation.js:273](../js/navigation.js#L273) | `rivaly:invites-changed` avisa o centro de convites, que atualiza o contador sem acoplamento entre módulos. |
| Eventos do Bootstrap | [js/modal.js:50](../js/modal.js#L50) a [js/modal.js:75](../js/modal.js#L75) | `show`, `shown`, `hide` e `hidden.bs.modal` controlam a máquina de estados do diálogo único. |
| `DOMContentLoaded` | [js/protocol-check.js:19](../js/protocol-check.js#L19) | Mostra o aviso quando a página foi aberta por `file://`. |

## 3. Validação de formulários

`js/validation.js` separa **regras puras** (sem DOM) do **feedback** (DOM). As mesmas regras validam o formulário e o domínio.

| Item | Onde | O que mostra |
|---|---|---|
| Regras como funções puras | [js/validation.js:30](../js/validation.js#L30) a [js/validation.js:85](../js/validation.js#L85) | `required`, `minLength`, `maxLength`, `pattern`, `email`, `matches`, `unique`, `noHtml`, `notBlank`, `numberRange` e `oneOf` devolvem a mensagem de erro ou `''`. |
| Lista de erros | [js/validation.js:92](../js/validation.js#L92) (`validateValue`) | Aplica um array de regras com `map` + `filter` e devolve todos os erros do campo. |
| Erro inline acessível | [js/validation.js:139](../js/validation.js#L139) (`showFieldError`) | Escreve no `.invalid-feedback`, aplica `is-invalid`, `aria-invalid` e liga a mensagem por `aria-describedby`. |
| Validar o formulário inteiro | [js/validation.js:176](../js/validation.js#L176) (`validateForm`) | Recebe `{ campo: [regras] }`, marca cada campo (inclusive grupos de rádio e checkbox) e devolve o primeiro inválido. |
| Validação ao digitar | [js/validation.js:202](../js/validation.js#L202) (`bindLiveValidation`) | Depois do primeiro erro, o campo é revalidado a cada tecla e o erro some quando a pessoa corrige. |
| Mensagem de sucesso ou erro geral | [js/validation.js:226](../js/validation.js#L226) (`showFeedback`) | Mostra o resultado no próprio formulário, num parágrafo com `role="status"` e `aria-live`. |
| Foco no primeiro erro | [js/validation.js:242](../js/validation.js#L242) (`focusFirstInvalid`) | Leva o foco ao campo que precisa de correção. |
| Login e cadastro | [js/login.js:132](../js/login.js#L132), [js/login.js:178](../js/login.js#L178), [js/login.js:255](../js/login.js#L255) | Esquemas de entrar e criar conta (e-mail, senha, confirmação com `matches`) e a chamada no `submit`. |
| Onboarding | [js/onboarding.js:182](../js/onboarding.js#L182) | Esquema por etapa, com grupos de checkbox validados como um campo só. |
| Criar clã | [js/clans-store.js:254](../js/clans-store.js#L254) (`clanSchema`), [js/clans-store.js:350](../js/clans-store.js#L350) | Nome, tag única (`unique`), política e lema; o store revalida com `validateData` mesmo se a tela falhar. |
| Candidatura | [js/clan-ui.js:208](../js/clan-ui.js#L208), [js/clans-store.js:313](../js/clans-store.js#L313) | Mensagem de 20 a 280 caracteres, sem HTML, com contador. |
| Post e comentário | [js/feed-store.js:37](../js/feed-store.js#L37), [js/feed.js:270](../js/feed.js#L270), [js/feed.js:407](../js/feed.js#L407) | O botão "Publicar" só habilita com texto válido; comentário até 140 caracteres. |
| Biblioteca e Passaporte | [js/library.js:452](../js/library.js#L452), [js/passport.js:683](../js/passport.js#L683) | Os diálogos de adicionar jogo e editar Passaporte usam o mesmo módulo. |
| Entrada não confiável | [js/login.js:52](../js/login.js#L52) (`safeRedirect`) | O `?redirect=` do login só aceita páginas do próprio site. |

## 4. Funções

| Item | Onde | O que mostra |
|---|---|---|
| Função pura com parâmetros e retorno | [js/arena-store.js:38](../js/arena-store.js#L38) (`expectedScore`) | Expectativa Elo `1 / (1 + 10^((Rb − Ra) / 400))`. |
| Função que compõe outras | [js/arena-store.js:45](../js/arena-store.js#L45) (`ratingDeltas`) | Usa `kFactor` e `expectedScore` para calcular quanto se ganha ou perde em cada resultado. |
| Função de regra | [js/arena-store.js:63](../js/arena-store.js#L63) (`tierFor`) | Converte rating em tier (Bronze a Lenda). |
| Gerador determinístico | [js/rng.js:42](../js/rng.js#L42) (`mulberry32`), [js/rng.js:26](../js/rng.js#L26) (`seedFrom`) | Closure que guarda o estado do PRNG; a semente vem de um hash FNV-1a do texto. |
| Data | [js/rng.js:105](../js/rng.js#L105) (`isoWeek`) | Semana ISO da temporada (ex.: `2026-W42`). |
| Decisão explicável | [js/community.js:99](../js/community.js#L99) (`decideApplication`) | Devolve `{ decision, reasons[], score, threshold, summary }`; a tela mostra os motivos. |
| Valor derivado com breakdown | [js/community.js:62](../js/community.js#L62) (`seededRating`) | Rating de cada jogador semeado a partir de rank, reputação e partidas, com a conta. |
| Fluxo com efeitos | [js/sessions.js:119](../js/sessions.js#L119) (`playSession`), [js/sessions.js:254](../js/sessions.js#L254) (`ratePlayer`) | Simula a sessão, grava, dá XP, registra atividade e devolve o resultado para a tela. |
| Regra de negócio reutilizável | [js/gamification.js:145](../js/gamification.js#L145) (`awardOnceFor`) | XP só uma vez por par regra + alvo (evita farm). |
| Migração | [js/storage.js:319](../js/storage.js#L319) (`migrateToV2`) | Só cria chaves que não existem; os dados da V1 continuam. |
| `async`/`await` | [js/squads.js:482](../js/squads.js#L482) (`runSessionFlow`) | Espera a sequência de loading (`await runSequence`) antes de mostrar o placar; `confirmDialog` também devolve uma `Promise<boolean>`. |

## 5. Arrays

| Item | Onde | O que mostra |
|---|---|---|
| `filter` | [js/feed-store.js:151](../js/feed-store.js#L151) (`filterFeed`) | Cada aba do Feed (Meu clã, Aliados, Rivais, Arena) é um filtro sobre a mesma lista. |
| `filter` + `some` | [js/sitemap.js:74](../js/sitemap.js#L74) (`search`) | A busca procura o termo em título, descrição, grupo e página pai, sem acento e sem diferenciar maiúscula. |
| `sort` com critério de desempate | [js/arena-store.js:348](../js/arena-store.js#L348) | Ranking por pontos da temporada e, no empate, por rating. |
| `sort` por valor calculado | [js/clans.js:228](../js/clans.js#L228) | Clãs do mais compatível para o menos. |
| `reduce` | [js/arena-store.js:179](../js/arena-store.js#L179), [js/compatibility.js:324](../js/compatibility.js#L324) | Média de rating do time; soma dos fatores da nota de compatibilidade. |
| `map` + `filter` | [js/validation.js:93](../js/validation.js#L93) | Aplica as regras e descarta as que passaram. |
| `flatMap` | [js/site-map.js:155](../js/site-map.js#L155) (`SITE_PAGES`) | Achata a árvore de grupos em uma lista de páginas. |
| Spread + `sort` | [js/feed-store.js:143](../js/feed-store.js#L143) | Junta posts e atividades em uma linha do tempo única, do mais novo para o mais antigo. |
| `slice` para paginação | [js/arena.js:346](../js/arena.js#L346) | Histórico da Arena em páginas de tamanho fixo. |
| `slice` para limite | [js/feed-store.js:279](../js/feed-store.js#L279) | Guarda só os últimos 20 comentários por post. |
| Agrupamento | [js/feed-store.js:176](../js/feed-store.js#L176) (`groupActivity`) | Atividades seguidas viram um bloco só no Feed. |
| Amostra ponderada | [js/rng.js:80](../js/rng.js#L80) (`weightedSample`) | Sorteia o squad aleatório pesando pela compatibilidade. |

## 6. Bootstrap 5.3.8 (local)

| Item | Onde | O que mostra |
|---|---|---|
| Arquivos locais, sem CDN | `vendor/bootstrap/`, [dashboard.html:39](../dashboard.html#L39), [dashboard.html:390](../dashboard.html#L390) | CSS e bundle JS servidos do próprio site. Ordem: Bootstrap, fontes, tema, variáveis, CSS próprio. |
| Tema escuro | [dashboard.html:2](../dashboard.html#L2), [css/bootstrap-theme.css:27](../css/bootstrap-theme.css#L27) | `data-bs-theme="dark"` e as variáveis `--bs-*` ligadas aos tokens da marca (amarelo, sem azul, cantos retos, sem sombra padrão). |
| **Grid** | [clans.html:224](../clans.html#L224), [clans.html:253](../clans.html#L253), [dashboard.html:247](../dashboard.html#L247) | `row g-3` com `col-12 col-md-6 col-xl-3` nos filtros, `row-cols-*` nos cards de clã e nos números do Início. |
| **Navbar** | [index.html:134](../index.html#L134), [index.html:143](../index.html#L143), [index.html:146](../index.html#L146) | Navbar pública com `navbar-toggler` e `collapse` no celular. |
| Offcanvas | [dashboard.html:68](../dashboard.html#L68), [dashboard.html:180](../dashboard.html#L180) | A barra lateral é `offcanvas-lg`: fixa a partir de 992 px, gaveta abaixo disso (também aberta pelo "Mais" da barra inferior). |
| Dropdown | [dashboard.html:199](../dashboard.html#L199), [dashboard.html:203](../dashboard.html#L203) | Centro de convites no topo, com aceitar, recusar e "Por quê?" em cada item. |
| **Botões** | [css/components.css:10](../css/components.css#L10) a [css/components.css:24](../css/components.css#L24), [css/components.css:237](../css/components.css#L237) | `btn-primary`, `btn-outline-light`, `btn-danger` e os demais sobre `--bs-btn-*`, com aliases da V1 (`btn--primary`) e estado `is-loading`. |
| **Modais** | [js/modal.js:48](../js/modal.js#L48), [js/modal.js:119](../js/modal.js#L119), [js/modal.js:184](../js/modal.js#L184) | `bootstrap.Modal` por baixo de `openModal` e `confirmDialog`; usado na chance de vitória ([js/arena-ui.js:145](../js/arena-ui.js#L145)) e no cartão do jogador ([js/player-card.js:60](../js/player-card.js#L60)). |
| **Cards** | [feed.html:211](../feed.html#L211), [js/clans.js:235](../js/clans.js#L235), [js/cards.js:110](../js/cards.js#L110) | Composer do Feed, cards de clã (`card h-100`) e cards de jogador com `card-body` e `card-footer`. |
| **Formulários** | [login.html:114](../login.html#L114), [login.html:120](../login.html#L120), [clans.html:231](../clans.html#L231), [clans.html:242](../clans.html#L242), [settings.html:298](../settings.html#L298) | `input-group`, `invalid-feedback`, `form-select`, `form-check` e `form-switch`. |
| Abas e pílulas | [arena.html:230](../arena.html#L230), [arena.html:276](../arena.html#L276), [feed.html:231](../feed.html#L231) | Modos da Arena (`nav-pills`), ranking Jogadores/Clãs e abas do Feed (`nav-tabs`). |
| Accordion | [arena.html:313](../arena.html#L313), [sitemap.html:270](../sitemap.html#L270) | "Como o rating funciona" e "Como as áreas se conectam". |
| Tabela | [arena.html:290](../arena.html#L290), [index.html:411](../index.html#L411), [js/settings.js:183](../js/settings.js#L183) | Ranking com `table-responsive`, `table-hover` e a linha do usuário em `table-active` ([js/arena.js:279](../js/arena.js#L279)). |
| Paginação, progresso e badge | [arena.html:304](../arena.html#L304), [js/arena.js:65](../js/arena.js#L65), [js/arena.js:358](../js/arena.js#L358), [dashboard.html:201](../dashboard.html#L201) | Histórico paginado, barra até o próximo tier, resultado de cada partida em `badge` e contador do centro de convites. |
| Tooltip | [js/app.js:100](../js/app.js#L100) (`initTooltips`) | Inicializa os tooltips depois de cada renderização. |
| Ratio | [index.html:370](../index.html#L370) | Bloco de vídeo `ratio ratio-16x9`, escondido enquanto não há URL. |

## Como conferir

```bash
# Nenhum alert/confirm/prompt e nenhum Math.random no domínio
grep -rnE "\b(alert|confirm|prompt)\(" js/ | grep -v "confirmDialog"
grep -rn "Math.random" js/

# Web Storage só dentro de storage.js
grep -rnE "localStorage|sessionStorage" js/ | grep -v "^js/storage.js"

# Bootstrap local
grep -rn "cdn" *.html
```
