/**
 * site-map.js — a arquitetura de informação da RIVALY, em um lugar só.
 *
 * Três consumidores leem esta árvore:
 *   - a navegação (sidebar/offcanvas, barra inferior e rodapé), gravada
 *     como markup Bootstrap em cada página por tools/sync-chrome.mjs;
 *   - a página Mapa do site (sitemap.html), que renderiza e filtra a árvore;
 *   - docs/mapa-do-site.md, que é a mesma árvore em texto.
 *
 * Cada nó tem a mesma forma: { id, title, href, description, group, icon,
 * children }. Grupos não têm href; páginas podem ter filhos que apontam
 * para seções internas (âncoras). Nada aqui toca o DOM, então o arquivo
 * pode ser importado tanto pelo navegador quanto pelo Node.
 */

export const SITE_MAP = [
    {
        id: 'voce',
        title: 'Você',
        group: 'voce',
        description: 'Sua identidade: o Passaporte e tudo o que alimenta ele.',
        children: [
            {
                id: 'dashboard', title: 'Início', short: 'Início', href: 'dashboard.html', icon: 'home', auth: true,
                description: 'Resumo do Passaporte, próximo passo, Arena, clã e atividade recente.',
                children: [
                    { id: 'dashboard-next', title: 'Próximo passo', href: 'dashboard.html#nextStepTitle', description: 'A ação que mais faz o seu Passaporte avançar agora.' },
                    { id: 'dashboard-community', title: 'Arena e clã', href: 'dashboard.html#communityTitle', description: 'Seu rating, seu tier e a meta semanal do clã.' },
                ],
            },
            {
                id: 'passport', title: 'Passaporte', short: 'Passaporte', href: 'passport.html', icon: 'id', auth: true,
                description: 'O cartão de identidade gamer: DNA, preferências, medalhas e comunidade.',
                children: [
                    { id: 'passport-community', title: 'Comunidade', href: 'passport.html#communityTitle', description: 'Clã, rating de Arena, aliados e rivais.' },
                    { id: 'passport-dna', title: 'DNA Gamer', href: 'passport.html#dnaFullTitle', description: 'Seis atributos e o seu arquétipo.' },
                ],
            },
            {
                id: 'library', title: 'Biblioteca', short: 'Biblioteca', href: 'library.html', icon: 'library', auth: true,
                description: 'Tudo o que você joga, já zerou ou quer jogar, com horas e notas.',
            },
            {
                id: 'achievements', title: 'Conquistas', short: 'Conquistas', href: 'achievements.html', icon: 'trophy', auth: true,
                description: 'Medalhas em cinco raridades, cada uma ligada a algo que você fez.',
            },
        ],
    },
    {
        id: 'comunidade',
        title: 'Comunidade',
        group: 'comunidade',
        description: 'Onde o Passaporte encontra outros jogadores. A comunidade é simulada e explica cada decisão.',
        children: [
            {
                id: 'squads', title: 'Squads', short: 'Squads', href: 'squads.html', icon: 'users', auth: true,
                description: 'Encontre parceiros compatíveis e jogue uma sessão com eles.',
                children: [
                    { id: 'squads-search', title: 'Buscar squad', href: 'squads.html#searchTitle', description: 'Sete fatores ponderados e a conta completa de cada resultado.' },
                    { id: 'squads-session', title: 'Jogar uma sessão', href: 'squads.html#resultsTitle', description: 'Escolha o squad ou peça um sorteio ponderado por compatibilidade.' },
                    { id: 'squads-saved', title: 'Seu squad', href: 'squads.html#savedTitle', description: 'Os parceiros que você salvou.' },
                ],
            },
            {
                id: 'arena', title: 'Arena', short: 'Arena', href: 'arena.html', icon: 'target', auth: true,
                description: 'Duelos, partidas de squad e Clã vs Clã com rating no estilo Elo.',
                children: [
                    { id: 'arena-play', title: 'Jogar', href: 'arena.html#playTitle', description: 'Duelo, Squad ou Clã vs Clã, com a chance de vitória antes de confirmar.' },
                    { id: 'arena-ranking', title: 'Ranking', href: 'arena.html#rankingTitle', description: 'Tabela de jogadores e de clãs da temporada.' },
                    { id: 'arena-history', title: 'Histórico', href: 'arena.html#historyTitle', description: 'Suas partidas, com a conta de cada resultado.' },
                    { id: 'arena-rules', title: 'Como o rating funciona', href: 'arena.html#rulesTitle', description: 'A fórmula da expectativa e do ganho de rating.' },
                ],
            },
            {
                id: 'clans', title: 'Clãs', short: 'Clãs', href: 'clans.html', icon: 'shield', auth: true,
                description: 'Explore, entre, crie e gerencie um clã com identidade própria.',
                children: [
                    { id: 'clans-mine', title: 'Meu clã', href: 'clans.html#myClanTitle', description: 'Elenco, meta semanal e gestão para líderes e oficiais.' },
                    { id: 'clans-explore', title: 'Explorar clãs', href: 'clans.html#exploreTitle', description: 'Filtros, busca e compatibilidade de cada clã com você.' },
                    { id: 'clans-create', title: 'Criar clã', href: 'clans.html#createTitle', description: 'Nome, tag, política e emblema gerado a partir da tag.' },
                ],
            },
            {
                id: 'feed', title: 'Feed', short: 'Feed', href: 'feed.html', icon: 'globe', auth: true,
                description: 'Posts, reações e comentários da sua comunidade, com filtros por aba.',
                children: [
                    { id: 'feed-compose', title: 'Publicar', href: 'feed.html#composerTitle', description: 'Escreva até 280 caracteres.' },
                    { id: 'feed-tabs', title: 'Abas', href: 'feed.html#feedTitle', description: 'Tudo, Meu clã, Aliados, Rivais e Arena.' },
                ],
            },
        ],
    },
    {
        id: 'explorar',
        title: 'Explorar',
        group: 'explorar',
        description: 'Fora do catálogo da RIVALY: a base aberta do GameDB.',
        children: [
            {
                id: 'discover', title: 'Descobrir', short: 'Descobrir', href: 'discover.html', icon: 'search', auth: true,
                description: 'Busque qualquer jogo na base aberta e registre direto na Biblioteca.',
            },
        ],
    },
    {
        id: 'conta',
        title: 'Conta',
        group: 'conta',
        description: 'Preferências, dados locais e o mapa de tudo.',
        children: [
            {
                id: 'settings', title: 'Configurações', short: 'Ajustes', href: 'settings.html', icon: 'settings', auth: true,
                description: 'Tema, movimento, notificações, exportação e reset dos dados locais.',
            },
            {
                id: 'sitemap', title: 'Mapa do site', short: 'Mapa', href: 'sitemap.html', icon: 'compass', auth: false,
                description: 'Todas as páginas da RIVALY, com busca e a explicação de como se conectam.',
            },
        ],
    },
    {
        id: 'publicas',
        title: 'Páginas públicas',
        group: 'publicas',
        description: 'O que qualquer visitante vê antes de entrar.',
        children: [
            {
                id: 'home', title: 'Início público', href: 'index.html', icon: 'rivaly', auth: false,
                description: 'Apresentação da RIVALY, o motor de compatibilidade e o roteiro.',
            },
            {
                id: 'login', title: 'Entrar ou criar conta', href: 'login.html', icon: 'user', auth: false,
                description: 'Conta local de demonstração, com aviso claro de que nada sai do navegador.',
                children: [
                    { id: 'login-signin', title: 'Entrar', href: 'login.html?mode=signin', description: 'Volte para o seu Passaporte.' },
                    { id: 'login-create', title: 'Criar conta', href: 'login.html?mode=create', description: 'Três campos e o Passaporte nasce.' },
                ],
            },
            {
                id: 'onboarding', title: 'Onboarding', href: 'onboarding.html', icon: 'dna', auth: true,
                description: 'Montagem do perfil e as dez perguntas do DNA Gamer.',
            },
        ],
    },
];

/* ============================================================
   DERIVADOS
   ============================================================ */

/** Grupos que aparecem na navegação do app (as públicas ficam de fora). */
export const NAV_GROUPS = SITE_MAP.filter((group) => group.id !== 'publicas');

/** Todas as páginas (nós com href no segundo nível), já com o grupo. */
export const SITE_PAGES = SITE_MAP.flatMap((group) =>
    group.children.map((page) => ({ ...page, group: group.id, groupTitle: group.title }))
);

export const pageById = (id) => SITE_PAGES.find((page) => page.id === id) ?? null;

/** Os quatro destinos fixos da barra inferior; o quinto botão é "Mais". */
export const BOTTOM_NAV_IDS = ['dashboard', 'passport', 'squads', 'arena'];

/**
 * Lista plana de todos os nós navegáveis (páginas e seções), usada pela
 * busca do mapa do site. Cada item carrega o caminho até ele.
 */
export function flattenSiteMap() {
    const out = [];
    SITE_MAP.forEach((group) => {
        group.children.forEach((page) => {
            out.push({ ...page, group: group.id, groupTitle: group.title, depth: 1, parentTitle: group.title });
            (page.children ?? []).forEach((child) => {
                out.push({
                    ...child,
                    icon: page.icon,
                    auth: page.auth,
                    group: group.id,
                    groupTitle: group.title,
                    depth: 2,
                    parentTitle: page.title,
                });
            });
        });
    });
    return out;
}

/** Páginas públicas que entram no sitemap.xml. */
export const PUBLIC_PAGE_HREFS = SITE_PAGES.filter((page) => page.auth === false).map((page) => page.href);

/* ============================================================
   CRÉDITOS
   Uma linha só, repetida no rodapé de todas as páginas.
   ============================================================ */
export const CREDITS = {
    product: 'RIVALY',
    author: 'Guilherme Oliveira Santos',
    rm: 'RM576218',
    school: 'FIAP',
    year: 2026,
};

export const creditsLine = () =>
    `${CREDITS.product} · ${CREDITS.author} · ${CREDITS.rm} · ${CREDITS.school} ${CREDITS.year}`;
