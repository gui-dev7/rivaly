/**
 * data.js — the entire demonstrative dataset of RIVALY.
 *
 * Nothing here is fetched from a network. Games, players and clans are
 * static demo content; every number the product *derives* from them (DNA,
 * compatibility, XP, Pontuação Gamer, Arena rating) is computed by real
 * logic elsewhere.
 *
 * Stored values stay as stable ids (e.g. rank 'Diamond'); the UI always
 * shows the PT-BR label through rankLabel(), regionLabel() and genreLabel(),
 * so V1 data keeps working after the translation.
 *
 * Real game titles are used as demonstrative content only.
 */

/* ============================================================
   TAXONOMIES
   ============================================================ */

export const PLATFORMS = [
    { id: 'pc', label: 'PC' },
    { id: 'playstation', label: 'PlayStation' },
    { id: 'xbox', label: 'Xbox' },
    { id: 'switch', label: 'Nintendo Switch' },
    { id: 'mobile', label: 'Celular' },
];

export const GENRES = [
    'FPS', 'Battle Royale', 'MOBA', 'RPG', 'Action', 'Adventure', 'Strategy',
    'Simulation', 'Sports', 'Racing', 'Sandbox', 'Survival', 'Horror',
    'Fighting', 'Puzzle', 'Roguelike', 'MMO', 'Indie',
];

export const LIBRARY_STATUSES = [
    { id: 'playing', label: 'Jogando', color: 'var(--color-accent)' },
    { id: 'completed', label: 'Zerado', color: 'var(--color-primary)' },
    { id: 'backlog', label: 'Fila', color: 'var(--color-text-muted)' },
    { id: 'dropped', label: 'Abandonado', color: 'var(--color-danger)' },
    { id: 'wishlist', label: 'Lista de desejos', color: 'var(--color-secondary)' },
];

/**
 * A single universal competitive ladder.
 * Every game maps onto it so rank compatibility stays comparable
 * across titles. Index order matters — the engine measures distance.
 */
export const RANK_LADDER = [
    'Unranked', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Elite',
];

/** Ordered — the engine treats neighbouring slots as partially compatible. */
export const SCHEDULES = [
    { id: 'morning', label: 'Manhã', hint: '06:00 – 12:00' },
    { id: 'afternoon', label: 'Tarde', hint: '12:00 – 18:00' },
    { id: 'evening', label: 'Noite', hint: '18:00 – 22:00' },
    { id: 'night', label: 'Madrugada', hint: '22:00 – 02:00' },
    { id: 'latenight', label: 'Alta madrugada', hint: '02:00 – 06:00' },
];

/** Ordered from most relaxed to most intense. */
export const PLAYSTYLES = [
    { id: 'casual', label: 'Casual', hint: 'Jogo para relaxar' },
    { id: 'balanced', label: 'Equilibrado', hint: 'Diversão primeiro, mas quero ganhar' },
    { id: 'competitive', label: 'Competitivo', hint: 'Rank importa' },
    { id: 'hardcore', label: 'Hardcore', hint: 'Scrim, review de VOD, o pacote completo' },
];

export const ROLES = [
    { id: 'leader', label: 'Líder', hint: 'Faz as chamadas' },
    { id: 'entry', label: 'Entry', hint: 'Abre o confronto' },
    { id: 'support', label: 'Suporte', hint: 'Utilitário e cobertura' },
    { id: 'anchor', label: 'Âncora', hint: 'Segura a linha' },
    { id: 'sniper', label: 'Sniper', hint: 'Controle de longa distância' },
    { id: 'flex', label: 'Flex', hint: 'Preenche o que estiver faltando' },
];

/**
 * Squad chemistry: which roles actively complete each other.
 * A duplicated role is not "bad", just less useful than a gap filled.
 */
export const COMPLEMENTARY_ROLES = {
    leader: ['entry', 'support', 'anchor', 'sniper'],
    entry: ['support', 'anchor', 'leader'],
    support: ['entry', 'sniper', 'leader'],
    anchor: ['entry', 'flex', 'leader'],
    sniper: ['support', 'anchor', 'leader'],
    flex: ['leader', 'entry', 'support', 'anchor', 'sniper'],
};

export const LANGUAGES = [
    { id: 'pt', label: 'Português' },
    { id: 'en', label: 'English' },
    { id: 'es', label: 'Español' },
    { id: 'fr', label: 'Français' },
    { id: 'de', label: 'Deutsch' },
    { id: 'ja', label: '日本語' },
];

export const REGIONS = [
    'South America', 'North America', 'Europe', 'Asia', 'Oceania', 'Africa',
];

/* ------------------------------------------------------------
   PT-BR LABELS
   Ids are what is stored; labels are what is shown.
   ------------------------------------------------------------ */

export const RANK_LABELS = {
    Unranked: 'Sem rank',
    Bronze: 'Bronze',
    Silver: 'Prata',
    Gold: 'Ouro',
    Platinum: 'Platina',
    Diamond: 'Diamante',
    Master: 'Mestre',
    Elite: 'Elite',
};

export const REGION_LABELS = {
    'South America': 'América do Sul',
    'North America': 'América do Norte',
    Europe: 'Europa',
    Asia: 'Ásia',
    Oceania: 'Oceania',
    Africa: 'África',
    Global: 'Global',
};

export const GENRE_LABELS = {
    FPS: 'FPS',
    'Battle Royale': 'Battle Royale',
    MOBA: 'MOBA',
    RPG: 'RPG',
    Action: 'Ação',
    Adventure: 'Aventura',
    Strategy: 'Estratégia',
    Simulation: 'Simulação',
    Sports: 'Esportes',
    Racing: 'Corrida',
    Sandbox: 'Sandbox',
    Survival: 'Sobrevivência',
    Horror: 'Terror',
    Fighting: 'Luta',
    Puzzle: 'Quebra-cabeça',
    Roguelike: 'Roguelike',
    MMO: 'MMO',
    Indie: 'Indie',
};

export const rankLabel = (id) => RANK_LABELS[id] ?? id ?? '';
export const regionLabel = (id) => REGION_LABELS[id] ?? id ?? '';
export const genreLabel = (id) => GENRE_LABELS[id] ?? id ?? '';

/* ============================================================
   GAME CATALOG

   Artwork is NOT stored here. A game carries at most:

     steamId       -> js/game-assets.js derives cover/hero/header/capsule
                      from the Steam CDN
     customAssets  -> explicit override, or the only source for the
                      titles that are not on Steam

   `hue` + `glyph` remain: they render the Rivaly fallback that shows
   whenever artwork is missing, offline or still loading.
   ============================================================ */

export const GAMES = [
    { id: 'valorant', title: 'Valorant', genre: ['FPS', 'Strategy'], platform: ['pc'], hue: 356, glyph: 'VL', year: 2020, competitive: true, steamId: null, customAssets: { cover: '/assets/covers/valorant.webp' } },
    { id: 'cs2', title: 'Counter-Strike 2', genre: ['FPS', 'Strategy'], platform: ['pc'], hue: 34, glyph: 'CS', year: 2023, competitive: true, steamId: 730 },
    { id: 'lol', title: 'League of Legends', genre: ['MOBA', 'Strategy'], platform: ['pc'], hue: 205, glyph: 'LL', year: 2009, competitive: true, steamId: null, customAssets: { cover: '/assets/covers/lol.webp' } },
    { id: 'dota2', title: 'Dota 2', genre: ['MOBA', 'Strategy'], platform: ['pc'], hue: 12, glyph: 'D2', year: 2013, competitive: true, steamId: 570 },
    { id: 'rocket-league', title: 'Rocket League', genre: ['Sports', 'Racing'], platform: ['pc', 'playstation', 'xbox', 'switch'], hue: 210, glyph: 'RL', year: 2015, competitive: true, steamId: 252950 },
    { id: 'fortnite', title: 'Fortnite', genre: ['Battle Royale', 'Action'], platform: ['pc', 'playstation', 'xbox', 'switch', 'mobile'], hue: 268, glyph: 'FN', year: 2017, competitive: true, steamId: null, customAssets: { cover: '/assets/covers/fortnite.webp' } },
    { id: 'apex', title: 'Apex Legends', genre: ['Battle Royale', 'FPS'], platform: ['pc', 'playstation', 'xbox'], hue: 8, glyph: 'AP', year: 2019, competitive: true, steamId: 1172470 },
    { id: 'overwatch2', title: 'Overwatch 2', genre: ['FPS', 'Action'], platform: ['pc', 'playstation', 'xbox', 'switch'], hue: 28, glyph: 'OW', year: 2022, competitive: true, steamId: 2357570 },
    { id: 'minecraft', title: 'Minecraft', genre: ['Sandbox', 'Survival', 'Adventure'], platform: ['pc', 'playstation', 'xbox', 'switch', 'mobile'], hue: 118, glyph: 'MC', year: 2011, competitive: false, steamId: null, customAssets: { cover: '/assets/covers/minecraft.webp' } },
    { id: 'gta5', title: 'Grand Theft Auto V', genre: ['Action', 'Adventure'], platform: ['pc', 'playstation', 'xbox'], hue: 44, glyph: 'GT', year: 2013, competitive: false, steamId: 271590 },
    { id: 'elden-ring', title: 'Elden Ring', genre: ['RPG', 'Action'], platform: ['pc', 'playstation', 'xbox'], hue: 42, glyph: 'ER', year: 2022, competitive: false, steamId: 1245620 },
    { id: 'zelda-totk', title: 'Tears of the Kingdom', genre: ['Adventure', 'RPG'], platform: ['switch'], hue: 158, glyph: 'TK', year: 2023, competitive: false, steamId: null, customAssets: { cover: '/assets/covers/zelda-totk.webp' } },
    { id: 'baldurs-gate-3', title: "Baldur's Gate 3", genre: ['RPG', 'Strategy'], platform: ['pc', 'playstation', 'xbox'], hue: 320, glyph: 'BG', year: 2023, competitive: false, steamId: 1086940 },
    { id: 'stardew', title: 'Stardew Valley', genre: ['Simulation', 'Indie'], platform: ['pc', 'playstation', 'xbox', 'switch', 'mobile'], hue: 96, glyph: 'SV', year: 2016, competitive: false, steamId: 413150 },
    { id: 'hades2', title: 'Hades II', genre: ['Roguelike', 'Action', 'Indie'], platform: ['pc', 'switch'], hue: 288, glyph: 'H2', year: 2024, competitive: false, steamId: 1145350 },
    { id: 'the-witcher-3', title: 'The Witcher 3', genre: ['RPG', 'Adventure'], platform: ['pc', 'playstation', 'xbox', 'switch'], hue: 18, glyph: 'W3', year: 2015, competitive: false, steamId: 292030 },
    { id: 'cyberpunk', title: 'Cyberpunk 2077', genre: ['RPG', 'Action'], platform: ['pc', 'playstation', 'xbox'], hue: 52, glyph: 'CP', year: 2020, competitive: false, steamId: 1091500 },
    { id: 'fifa', title: 'EA FC 25', genre: ['Sports', 'Simulation'], platform: ['pc', 'playstation', 'xbox', 'switch'], hue: 148, glyph: 'FC', year: 2024, competitive: true, steamId: 2669320 },
    { id: 'nba2k', title: 'NBA 2K25', genre: ['Sports', 'Simulation'], platform: ['pc', 'playstation', 'xbox', 'switch'], hue: 22, glyph: 'NB', year: 2024, competitive: true, steamId: 2878980 },
    { id: 'forza', title: 'Forza Horizon 5', genre: ['Racing', 'Simulation'], platform: ['pc', 'xbox'], hue: 192, glyph: 'FH', year: 2021, competitive: false, steamId: 1551360 },
    { id: 'gran-turismo', title: 'Gran Turismo 7', genre: ['Racing', 'Simulation'], platform: ['playstation'], hue: 218, glyph: 'GT', year: 2022, competitive: true, steamId: null, customAssets: { cover: '/assets/covers/gran-turismo.webp' } },
    { id: 'street-fighter-6', title: 'Street Fighter 6', genre: ['Fighting', 'Action'], platform: ['pc', 'playstation', 'xbox'], hue: 4, glyph: 'SF', year: 2023, competitive: true, steamId: 1364780 },
    { id: 'tekken8', title: 'Tekken 8', genre: ['Fighting', 'Action'], platform: ['pc', 'playstation', 'xbox'], hue: 340, glyph: 'T8', year: 2024, competitive: true, steamId: 1778820 },
    { id: 'rust', title: 'Rust', genre: ['Survival', 'Sandbox'], platform: ['pc'], hue: 24, glyph: 'RU', year: 2018, competitive: false, steamId: 252490 },
    { id: 'terraria', title: 'Terraria', genre: ['Sandbox', 'Adventure', 'Indie'], platform: ['pc', 'playstation', 'xbox', 'switch', 'mobile'], hue: 174, glyph: 'TR', year: 2011, competitive: false, steamId: 105600 },
    { id: 'hollow-knight', title: 'Hollow Knight', genre: ['Adventure', 'Indie', 'Action'], platform: ['pc', 'playstation', 'xbox', 'switch'], hue: 232, glyph: 'HK', year: 2017, competitive: false, steamId: 367520 },
    { id: 'phasmophobia', title: 'Phasmophobia', genre: ['Horror', 'Survival', 'Indie'], platform: ['pc'], hue: 262, glyph: 'PH', year: 2020, competitive: false, steamId: 739630 },
    { id: 'civ6', title: 'Civilization VI', genre: ['Strategy', 'Simulation'], platform: ['pc', 'playstation', 'xbox', 'switch', 'mobile'], hue: 200, glyph: 'C6', year: 2016, competitive: false, steamId: 289070 },
    { id: 'age4', title: 'Age of Empires IV', genre: ['Strategy'], platform: ['pc', 'xbox'], hue: 38, glyph: 'A4', year: 2021, competitive: true, steamId: 1466860 },
    { id: 'wow', title: 'World of Warcraft', genre: ['MMO', 'RPG'], platform: ['pc'], hue: 210, glyph: 'WW', year: 2004, competitive: false, steamId: null, customAssets: { cover: '/assets/covers/wow.webp' } },
    { id: 'ff14', title: 'Final Fantasy XIV', genre: ['MMO', 'RPG'], platform: ['pc', 'playstation', 'xbox'], hue: 218, glyph: 'FF', year: 2013, competitive: false, steamId: 39210 },
    { id: 'among-us', title: 'Among Us', genre: ['Puzzle', 'Indie'], platform: ['pc', 'switch', 'mobile'], hue: 350, glyph: 'AU', year: 2018, competitive: false, steamId: 945360 },
];

export const getGameById = (id) => GAMES.find((game) => game.id === id) ?? null;

/**
 * Games that make sense as a Buscar Squad target: the simulated player
 * pool only fields squads for titles people actually queue for.
 */
export const SQUAD_GAMES = [
    'valorant', 'cs2', 'lol', 'dota2', 'rocket-league', 'fortnite', 'apex',
    'overwatch2', 'fifa', 'minecraft', 'rust', 'age4',
].map(getGameById).filter(Boolean);

/* ============================================================
   SIMULATED PLAYER POOL
   Hand-authored for spread: the Motor de Compatibilidade must be able
   to produce excellent, great, good and poor matches from the same
   search. `reputation` is authored demo content, never randomised.
   ============================================================ */

export const PLAYERS = [
    {
        id: 'p01', nickname: 'Matheus', region: 'South America',
        games: ['rocket-league', 'fifa', 'fortnite'], rank: 'Diamond',
        schedules: ['night', 'evening'], playstyle: 'competitive',
        roles: ['leader', 'entry'], voiceChat: true, languages: ['pt', 'en'],
        reputation: 94, matches: 412, bio: 'Shotcaller. Três temporadas de ligas amadoras de RL.',
    },
    {
        id: 'p02', nickname: 'Yuki', region: 'Asia',
        games: ['valorant', 'apex', 'overwatch2'], rank: 'Master',
        schedules: ['latenight', 'night'], playstyle: 'hardcore',
        roles: ['sniper', 'entry'], voiceChat: true, languages: ['ja', 'en'],
        reputation: 91, matches: 980, bio: 'Treino de mira toda manhã. Review de VOD toda noite.',
    },
    {
        id: 'p03', nickname: 'Lorena', region: 'South America',
        games: ['rocket-league', 'valorant', 'minecraft'], rank: 'Diamond',
        schedules: ['night'], playstyle: 'competitive',
        roles: ['support', 'flex'], voiceChat: true, languages: ['pt', 'es'],
        reputation: 88, matches: 356, bio: 'Suporte focado em rotação. Leio o mapa, não o kill feed.',
    },
    {
        id: 'p04', nickname: 'Kaito', region: 'Asia',
        games: ['cs2', 'valorant'], rank: 'Elite',
        schedules: ['evening', 'night'], playstyle: 'hardcore',
        roles: ['entry'], voiceChat: true, languages: ['ja', 'en'],
        reputation: 96, matches: 1420, bio: 'Ex-entry fragger semi-pro. Procurando um time sério.',
    },
    {
        id: 'p05', nickname: 'Bianca', region: 'South America',
        games: ['minecraft', 'stardew', 'among-us', 'terraria'], rank: 'Unranked',
        schedules: ['afternoon', 'evening'], playstyle: 'casual',
        roles: ['support', 'flex'], voiceChat: false, languages: ['pt'],
        reputation: 82, matches: 74, bio: 'Construindo um mundo de survival, um chunk por vez.',
    },
    {
        id: 'p06', nickname: 'Dmitri', region: 'Europe',
        games: ['dota2', 'age4', 'civ6'], rank: 'Master',
        schedules: ['evening', 'night'], playstyle: 'hardcore',
        roles: ['leader', 'anchor'], voiceChat: true, languages: ['en', 'de'],
        reputation: 79, matches: 2100, bio: 'Nerd de draft. Explico o confronto de rota, você perguntando ou não.',
    },
    {
        id: 'p07', nickname: 'Sofia', region: 'Europe',
        games: ['valorant', 'overwatch2', 'rocket-league'], rank: 'Platinum',
        schedules: ['evening'], playstyle: 'balanced',
        roles: ['support'], voiceChat: true, languages: ['es', 'en'],
        reputation: 90, matches: 288, bio: 'Call limpa, clima leve, utilitário na hora certa.',
    },
    {
        id: 'p08', nickname: 'Rafa', region: 'South America',
        games: ['fifa', 'nba2k', 'rocket-league'], rank: 'Platinum',
        schedules: ['night', 'latenight'], playstyle: 'competitive',
        roles: ['entry', 'flex'], voiceChat: true, languages: ['pt'],
        reputation: 85, matches: 530, bio: 'Torneio no fim de semana, grind na semana.',
    },
    {
        id: 'p09', nickname: 'Nova', region: 'North America',
        games: ['apex', 'fortnite', 'valorant'], rank: 'Diamond',
        schedules: ['latenight'], playstyle: 'competitive',
        roles: ['flex'], voiceChat: true, languages: ['en'],
        reputation: 87, matches: 640, bio: 'Main fill. Me dá o espaço que eu preencho.',
    },
    {
        id: 'p10', nickname: 'Hugo', region: 'Europe',
        games: ['cs2', 'rust'], rank: 'Gold',
        schedules: ['morning', 'afternoon'], playstyle: 'balanced',
        roles: ['anchor'], voiceChat: false, languages: ['fr', 'en'],
        reputation: 71, matches: 210, bio: 'Jogo de manhã. Quieto, mas seguro o bomb.',
    },
    {
        id: 'p11', nickname: 'Aisha', region: 'Africa',
        games: ['lol', 'valorant', 'ff14'], rank: 'Diamond',
        schedules: ['evening', 'night'], playstyle: 'competitive',
        roles: ['leader', 'support'], voiceChat: true, languages: ['en', 'fr'],
        reputation: 93, matches: 870, bio: 'Macro acima de mecânica. Eu chamo, você executa.',
    },
    {
        id: 'p12', nickname: 'Teo', region: 'South America',
        games: ['minecraft', 'terraria', 'hollow-knight'], rank: 'Unranked',
        schedules: ['afternoon'], playstyle: 'casual',
        roles: ['flex'], voiceChat: false, languages: ['pt', 'es'],
        reputation: 76, matches: 48, bio: '100% ou nada. Devagar.',
    },
    {
        id: 'p13', nickname: 'Ingrid', region: 'Europe',
        games: ['overwatch2', 'apex', 'rocket-league'], rank: 'Master',
        schedules: ['night'], playstyle: 'hardcore',
        roles: ['anchor', 'support'], voiceChat: true, languages: ['de', 'en'],
        reputation: 89, matches: 1180, bio: 'Cabeça de off-tank. Seguro espaço para você jogar.',
    },
    {
        id: 'p14', nickname: 'Caio', region: 'South America',
        games: ['valorant', 'cs2', 'fortnite'], rank: 'Silver',
        schedules: ['evening', 'night'], playstyle: 'casual',
        roles: ['entry'], voiceChat: true, languages: ['pt'],
        reputation: 68, matches: 96, bio: 'Novo no competitivo. Aprendo rápido, tilto devagar.',
    },
    {
        id: 'p15', nickname: 'Mira', region: 'Oceania',
        games: ['lol', 'dota2', 'age4'], rank: 'Platinum',
        schedules: ['morning', 'evening'], playstyle: 'balanced',
        roles: ['support', 'anchor'], voiceChat: true, languages: ['en'],
        reputation: 84, matches: 470, bio: 'Apreciador de vision score.',
    },
    {
        id: 'p16', nickname: 'Zé', region: 'South America',
        games: ['fifa', 'gta5', 'forza'], rank: 'Gold',
        schedules: ['night', 'latenight'], playstyle: 'casual',
        roles: ['flex'], voiceChat: false, languages: ['pt'],
        reputation: 74, matches: 132, bio: 'Aqui para me divertir, não para fazer carreira.',
    },
    {
        id: 'p17', nickname: 'Priya', region: 'Asia',
        games: ['valorant', 'lol', 'among-us'], rank: 'Gold',
        schedules: ['evening'], playstyle: 'balanced',
        roles: ['support', 'flex'], voiceChat: true, languages: ['en'],
        reputation: 86, matches: 305, bio: 'Call positiva, zero flame. Pergunta pro meu duo.',
    },
    {
        id: 'p18', nickname: 'Owen', region: 'North America',
        games: ['cs2', 'apex', 'rust'], rank: 'Elite',
        schedules: ['latenight', 'night'], playstyle: 'hardcore',
        roles: ['sniper'], voiceChat: true, languages: ['en'],
        reputation: 92, matches: 1610, bio: 'AWP sem parar. Scrim ter/qui.',
    },
    {
        id: 'p19', nickname: 'Lulu', region: 'Europe',
        games: ['stardew', 'minecraft', 'hades2', 'hollow-knight'], rank: 'Unranked',
        schedules: ['morning', 'afternoon'], playstyle: 'casual',
        roles: ['flex'], voiceChat: false, languages: ['fr'],
        reputation: 80, matches: 38, bio: 'Jogos tranquilos e trilhas longas.',
    },
    {
        id: 'p20', nickname: 'Bruno', region: 'South America',
        games: ['rocket-league', 'apex', 'valorant'], rank: 'Diamond',
        schedules: ['night', 'evening'], playstyle: 'competitive',
        roles: ['anchor', 'flex'], voiceChat: true, languages: ['pt', 'en'],
        reputation: 90, matches: 725, bio: 'Especialista em clutch de último homem. Só ranqueada.',
    },
    {
        id: 'p21', nickname: 'Hana', region: 'Asia',
        games: ['overwatch2', 'ff14', 'street-fighter-6'], rank: 'Platinum',
        schedules: ['night'], playstyle: 'competitive',
        roles: ['support'], voiceChat: true, languages: ['ja', 'en'],
        reputation: 88, matches: 540, bio: 'Suporte principal, DPS secundário quando o time precisa.',
    },
    {
        id: 'p22', nickname: 'Diego', region: 'South America',
        games: ['cs2', 'valorant', 'fifa'], rank: 'Master',
        schedules: ['evening', 'night'], playstyle: 'competitive',
        roles: ['leader'], voiceChat: true, languages: ['es', 'pt'],
        reputation: 91, matches: 1030, bio: 'IGL. Call de meio de round é comigo.',
    },
    {
        id: 'p23', nickname: 'Fen', region: 'Oceania',
        games: ['minecraft', 'rust', 'terraria'], rank: 'Silver',
        schedules: ['latenight'], playstyle: 'balanced',
        roles: ['anchor', 'support'], voiceChat: true, languages: ['en'],
        reputation: 77, matches: 190, bio: 'Construtor de base. Se tem parede, fui eu que fiz.',
    },
    {
        id: 'p24', nickname: 'Alice', region: 'Europe',
        games: ['lol', 'valorant', 'baldurs-gate-3'], rank: 'Platinum',
        schedules: ['evening', 'afternoon'], playstyle: 'balanced',
        roles: ['flex', 'leader'], voiceChat: true, languages: ['en', 'de'],
        reputation: 83, matches: 398, bio: 'Estratégia primeiro. Leio nota de patch por diversão.',
    },
    {
        id: 'p25', nickname: 'Nando', region: 'South America',
        games: ['fortnite', 'rocket-league', 'fifa'], rank: 'Bronze',
        schedules: ['afternoon'], playstyle: 'casual',
        roles: ['entry'], voiceChat: false, languages: ['pt'],
        reputation: 62, matches: 55, bio: 'Comecei agora. Tenha paciência.',
    },
    {
        id: 'p26', nickname: 'Sasha', region: 'North America',
        games: ['apex', 'overwatch2', 'cs2'], rank: 'Diamond',
        schedules: ['night', 'latenight'], playstyle: 'competitive',
        roles: ['entry', 'sniper'], voiceChat: true, languages: ['en', 'es'],
        reputation: 86, matches: 810, bio: 'Agressivo, mas coordenado. Faz a troca comigo.',
    },
    {
        id: 'p27', nickname: 'Luan', region: 'South America',
        games: ['lol', 'valorant', 'fortnite'], rank: 'Gold',
        schedules: ['evening', 'night'], playstyle: 'balanced',
        roles: ['support', 'leader'], voiceChat: true, languages: ['pt'],
        reputation: 87, matches: 344, bio: 'Gosto de explicar a jogada depois. E de ouvir a sua.',
    },
    {
        id: 'p28', nickname: 'Kenji', region: 'Asia',
        games: ['street-fighter-6', 'tekken8', 'overwatch2'], rank: 'Diamond',
        schedules: ['night', 'latenight'], playstyle: 'competitive',
        roles: ['entry'], voiceChat: false, languages: ['ja', 'en'],
        reputation: 92, matches: 1250, bio: 'Jogo de luta é xadrez em alta velocidade.',
    },
    {
        id: 'p29', nickname: 'Valentina', region: 'South America',
        games: ['valorant', 'apex', 'overwatch2'], rank: 'Platinum',
        schedules: ['evening'], playstyle: 'competitive',
        roles: ['sniper', 'support'], voiceChat: true, languages: ['es', 'pt'],
        reputation: 89, matches: 512, bio: 'Operator na mão, call curta no ouvido.',
    },
    {
        id: 'p30', nickname: 'Theo', region: 'Europe',
        games: ['age4', 'civ6', 'dota2'], rank: 'Gold',
        schedules: ['afternoon', 'evening'], playstyle: 'balanced',
        roles: ['leader', 'anchor'], voiceChat: true, languages: ['en', 'fr'],
        reputation: 81, matches: 266, bio: 'Macro, economia e paciência. Nessa ordem.',
    },
    {
        id: 'p31', nickname: 'Gabi', region: 'South America',
        games: ['minecraft', 'among-us', 'fortnite'], rank: 'Silver',
        schedules: ['afternoon', 'evening'], playstyle: 'casual',
        roles: ['support', 'flex'], voiceChat: true, languages: ['pt'],
        reputation: 91, matches: 158, bio: 'Organizo o servidor, você traz o lanche.',
    },
    {
        id: 'p32', nickname: 'Arjun', region: 'Asia',
        games: ['dota2', 'lol', 'cs2'], rank: 'Master',
        schedules: ['night'], playstyle: 'hardcore',
        roles: ['leader', 'support'], voiceChat: true, languages: ['en'],
        reputation: 85, matches: 1840, bio: 'Draft primeiro, mecânica depois.',
    },
    {
        id: 'p33', nickname: 'Marina', region: 'South America',
        games: ['rocket-league', 'fifa', 'valorant'], rank: 'Gold',
        schedules: ['night'], playstyle: 'competitive',
        roles: ['anchor', 'flex'], voiceChat: true, languages: ['pt', 'en'],
        reputation: 84, matches: 377, bio: 'Defendo o gol e o clima do time.',
    },
];

export const getPlayerById = (id) => PLAYERS.find((player) => player.id === id) ?? null;

/* ============================================================
   CLÃS SEMEADOS
   Formados só por jogadores de PLAYERS. Cada jogador está em no
   máximo um clã, e onze ficam de fora de propósito: são os que a
   comunidade simulada permite recrutar. O emblema não é imagem:
   é um SVG montado a partir da tag e da escolha de formato, padrão e
   cores (ver clans-store.js).
   ============================================================ */

export const CLAN_CAPACITY = 8;

export const CLAN_POLICIES = {
    open: { label: 'Aberto', hint: 'Entra na hora quem cumpre os requisitos.' },
    application: { label: 'Candidatura', hint: 'O clã lê a sua mensagem e responde.' },
    invite: { label: 'Só convite', hint: 'Só entra quem for convidado por um membro.' },
};

export const CLANS = [
    {
        id: 'nox', name: 'Nox Protocol', tag: 'NOX',
        emblem: { shape: 'heater', pattern: 'diagonal', palette: 'classic' },
        focusGames: ['valorant', 'cs2'], playstyle: 'hardcore', region: 'South America',
        languages: ['pt', 'es'], minRank: 'Diamond', minReputation: 85, policy: 'application',
        leaderId: 'p22', officers: ['p20'], members: ['p03'],
        motto: 'Informação primeiro, troca depois.',
    },
    {
        id: 'aurora', name: 'Aurora Tática', tag: 'AUR',
        emblem: { shape: 'octagon', pattern: 'half', palette: 'bone' },
        focusGames: ['lol', 'dota2'], playstyle: 'competitive', region: 'Global',
        languages: ['en', 'fr', 'de'], minRank: 'Platinum', minReputation: 80, policy: 'open',
        leaderId: 'p11', officers: ['p24'], members: ['p15', 'p32'],
        motto: 'Macro vence micro.',
    },
    {
        id: 'gol', name: 'Linha de Gol', tag: 'GOL',
        emblem: { shape: 'classic', pattern: 'bars', palette: 'classic' },
        focusGames: ['rocket-league', 'fifa'], playstyle: 'competitive', region: 'South America',
        languages: ['pt'], minRank: 'Gold', minReputation: 75, policy: 'open',
        leaderId: 'p01', officers: ['p08'], members: ['p33'],
        motto: 'Bola no chão, cabeça erguida.',
    },
    {
        id: 'vertice', name: 'Vértice', tag: 'VTX',
        emblem: { shape: 'kite', pattern: 'chevron', palette: 'inverse' },
        focusGames: ['apex', 'overwatch2'], playstyle: 'hardcore', region: 'North America',
        languages: ['en'], minRank: 'Diamond', minReputation: 85, policy: 'invite',
        leaderId: 'p18', officers: ['p13'], members: ['p26', 'p02'],
        motto: 'Ângulo certo, tempo certo.',
    },
    {
        id: 'bloco', name: 'Bloco Construtor', tag: 'BLOC',
        emblem: { shape: 'square', pattern: 'quarters', palette: 'steel' },
        focusGames: ['minecraft', 'terraria'], playstyle: 'casual', region: 'Global',
        languages: ['pt', 'en', 'fr'], minRank: 'Unranked', minReputation: 70, policy: 'open',
        leaderId: 'p05', officers: ['p31'], members: ['p23', 'p12'],
        motto: 'Um chunk por vez.',
    },
    {
        id: 'ringue', name: 'Ringue', tag: 'RNG',
        emblem: { shape: 'crest', pattern: 'cross', palette: 'classic' },
        focusGames: ['street-fighter-6', 'tekken8'], playstyle: 'competitive', region: 'Asia',
        languages: ['ja', 'en'], minRank: 'Platinum', minReputation: 80, policy: 'application',
        leaderId: 'p28', officers: [], members: ['p21'],
        motto: 'Cada round é uma conversa.',
    },
    {
        id: 'estrategos', name: 'Estrategos', tag: 'STRG',
        emblem: { shape: 'banner', pattern: 'base', palette: 'bone' },
        focusGames: ['age4', 'civ6'], playstyle: 'balanced', region: 'Europe',
        languages: ['en', 'fr', 'de'], minRank: 'Gold', minReputation: 75, policy: 'application',
        leaderId: 'p06', officers: ['p30'], members: [],
        motto: 'Quem planeja a economia ganha a guerra.',
    },
].map((clan) => ({ ...clan, seeded: true }));

/* ============================================================
   ARENA
   Rating no estilo Elo: começa em 1000. Os tiers usam nomes da
   marca e não têm relação com o rank declarado no Passaporte.
   ============================================================ */

export const ARENA_TIERS = [
    { id: 'bronze', label: 'Bronze', min: 0 },
    { id: 'silver', label: 'Prata', min: 900 },
    { id: 'gold', label: 'Ouro', min: 1100 },
    { id: 'platinum', label: 'Platina', min: 1300 },
    { id: 'diamond', label: 'Diamante', min: 1500 },
    { id: 'legend', label: 'Lenda', min: 1700 },
];

/* ============================================================
   COMUNIDADE: relações, elogios e reações
   Rival + Ally: rivalidade aqui é respeito, "quero enfrentar de novo".
   ============================================================ */

export const RELATION_TYPES = {
    ally: { label: 'Aliado', hint: 'Quero jogar junto de novo.' },
    rival: { label: 'Rival', hint: 'Quero enfrentar de novo.' },
    neutral: { label: 'Neutro', hint: 'Sem marcação.' },
};

export const PRAISES = [
    { id: 'comms', label: 'Comunicação' },
    { id: 'strategy', label: 'Estratégia' },
    { id: 'fairplay', label: 'Fair play' },
    { id: 'carry', label: 'Carregou o time' },
];

export const REACTIONS = [
    { id: 'gg', label: 'GG' },
    { id: 'respeito', label: 'Respeito' },
    { id: 'rivalidade', label: 'Rivalidade' },
];

/**
 * Modelos dos posts simulados. {game}, {rank}, {role}, {tag} e {mate}
 * são preenchidos com dados reais do jogador que "posta". Cada modelo
 * declara quando faz sentido (estilo de jogo, função, ter clã).
 */
export const POST_TEMPLATES = [
    { id: 't01', kind: 'grind', styles: ['competitive', 'hardcore'], text: 'Mais uma noite de {game}. Faltam duas vitórias para segurar o {rank}.' },
    { id: 't02', kind: 'grind', styles: ['competitive', 'hardcore'], text: 'Revisei três partidas de {game} hoje. O erro era o mesmo nas três: entrar sem informação.' },
    { id: 't03', kind: 'lfg', styles: ['balanced', 'competitive'], text: 'Procuro duo para {game} hoje à noite. Jogo de {role} e uso voz.' },
    { id: 't04', kind: 'lfg', styles: ['casual', 'balanced'], text: 'Alguém para um {game} sem pressão depois do jantar? Prometo não reclamar de nada.' },
    { id: 't05', kind: 'casual', styles: ['casual'], text: 'Sessão longa de {game} hoje. Zero objetivo, muita conversa. Do jeito certo.' },
    { id: 't06', kind: 'casual', styles: ['casual', 'balanced'], text: 'Terminei a semana com {game}. Nem lembro o placar, lembro das risadas.' },
    { id: 't07', kind: 'role', roles: ['support'], text: 'Lembrete de quem joga de suporte: utilitário bem usado não aparece no placar, aparece na vitória.' },
    { id: 't08', kind: 'role', roles: ['leader'], text: 'Call boa é call curta. Se precisa de três frases, o plano está complicado demais.' },
    { id: 't09', kind: 'role', roles: ['entry'], text: 'Entrar primeiro é aceitar morrer primeiro às vezes. Faz parte. A troca é o que importa.' },
    { id: 't10', kind: 'role', roles: ['sniper'], text: 'Um ângulo bem segurado vale mais que dez tiros apressados.' },
    { id: 't11', kind: 'role', roles: ['anchor'], text: 'Segurar o lado sozinho por 40 segundos não rende highlight, mas rende round.' },
    { id: 't12', kind: 'role', roles: ['flex'], text: 'Jogo do que o time precisar. Hoje foi de tudo um pouco em {game}.' },
    { id: 't13', kind: 'clan', clan: true, text: 'Treino do [{tag}] marcado para quinta. Quem faltar paga a próxima rodada de call.' },
    { id: 't14', kind: 'clan', clan: true, text: 'Orgulho do [{tag}] essa semana. Ninguém tiltou, todo mundo jogou junto.' },
    { id: 't15', kind: 'arena', styles: ['competitive', 'hardcore'], text: 'Duelo duro na Arena hoje. Perdi, mas saí com vontade de pedir revanche.' },
    { id: 't16', kind: 'arena', styles: ['competitive', 'hardcore', 'balanced'], text: 'Subi um degrau no rating da Arena. A temporada é curta, então cada partida conta.' },
    { id: 't17', kind: 'mate', text: 'Joguei com {mate} ontem em {game}. Que call limpa. Já marquei como aliado.' },
    { id: 't18', kind: 'mate', text: 'Enfrentei {mate} na Arena. Rival de respeito, quero a revanche.' },
    { id: 't19', kind: 'grind', styles: ['hardcore'], text: 'Treino de mira, duas horas de ranqueada, revisão de VOD. Rotina fechada em {game}.' },
    { id: 't20', kind: 'casual', styles: ['casual', 'balanced'], text: 'Dica para quem está começando em {game}: jogue com quem conversa. O resto vem.' },
];

/* ============================================================
   GAMER DNA QUESTIONNAIRE
   Each option carries a weight vector across the six attributes.
   Scoring is a pure sum + normalisation — see gamer-dna.js.
   ============================================================ */

export const DNA_ATTRIBUTES = [
    { id: 'competitive', label: 'Competitivo', color: 'var(--color-dna-competitive)', description: 'O quanto vencer te move.' },
    { id: 'social', label: 'Social', color: 'var(--color-dna-social)', description: 'O quanto você joga com e pelos outros.' },
    { id: 'explorer', label: 'Explorador', color: 'var(--color-dna-explorer)', description: 'Sua atração por descobrir em vez de repetir.' },
    { id: 'strategist', label: 'Estrategista', color: 'var(--color-dna-strategist)', description: 'O quanto você planeja antes de agir.' },
    { id: 'achiever', label: 'Realizador', color: 'var(--color-dna-achiever)', description: 'Sua vontade de terminar o que começa.' },
    { id: 'collector', label: 'Colecionador', color: 'var(--color-dna-collector)', description: 'O quanto você valoriza ter e completar coleções.' },
];

export const DNA_QUESTIONS = [
    {
        id: 'q1',
        prompt: 'Você acabou de instalar um jogo novo. O que faz primeiro?',
        options: [
            { id: 'a', label: 'Sair explorando tudo', weights: { explorer: 5, collector: 2, social: 1 } },
            { id: 'b', label: 'Aprender bem as mecânicas antes de tudo', weights: { strategist: 5, achiever: 2 } },
            { id: 'c', label: 'Cair direto numa ranqueada', weights: { competitive: 5, achiever: 2 } },
            { id: 'd', label: 'Chamar os amigos e abrir um lobby', weights: { social: 5, competitive: 1 } },
        ],
    },
    {
        id: 'q2',
        prompt: 'O que de fato te motiva a continuar jogando?',
        options: [
            { id: 'a', label: 'Vencer', weights: { competitive: 5, achiever: 2 } },
            { id: 'b', label: 'Descobrir algo novo', weights: { explorer: 5, collector: 1 } },
            { id: 'c', label: 'Completar tudo o que dá para completar', weights: { achiever: 5, collector: 3 } },
            { id: 'd', label: 'As pessoas com quem eu jogo', weights: { social: 5, strategist: 1 } },
        ],
    },
    {
        id: 'q3',
        prompt: 'Dentro de um time, você naturalmente tende a…',
        options: [
            { id: 'a', label: 'Liderar e fazer as calls', weights: { strategist: 4, competitive: 3, social: 2 } },
            { id: 'b', label: 'Executar o plano com precisão', weights: { competitive: 4, achiever: 3 } },
            { id: 'c', label: 'Analisar e adaptar a estratégia', weights: { strategist: 5, explorer: 2 } },
            { id: 'd', label: 'Dar suporte e manter a moral', weights: { social: 5, achiever: 1 } },
        ],
    },
    {
        id: 'q4',
        prompt: 'De qual destes você se gabaria mais?',
        options: [
            { id: 'a', label: 'Um rank competitivo de elite', weights: { competitive: 5, achiever: 3 } },
            { id: 'b', label: 'Um save com 100% de conclusão', weights: { achiever: 5, collector: 4 } },
            { id: 'c', label: 'Um item raro que ninguém mais tem', weights: { collector: 5, explorer: 2 } },
            { id: 'd', label: 'Um clutch que seu squad comenta até hoje', weights: { social: 4, competitive: 3 } },
        ],
    },
    {
        id: 'q5',
        prompt: 'Você perde cinco ranqueadas seguidas. Qual é a sua reação?',
        options: [
            { id: 'a', label: 'Entrar na fila de novo na hora — a maré vira', weights: { competitive: 5, achiever: 2 } },
            { id: 'b', label: 'Revisar o que deu errado antes de voltar', weights: { strategist: 5, achiever: 2 } },
            { id: 'c', label: 'Mudar para algo relaxante por um tempo', weights: { explorer: 4, social: 2 } },
            { id: 'd', label: 'Chamar o squad na call e jogar junto', weights: { social: 5, competitive: 1 } },
        ],
    },
    {
        id: 'q6',
        prompt: 'Qual missão secundária você aceita?',
        options: [
            { id: 'a', label: 'A que dá o melhor equipamento', weights: { achiever: 4, collector: 3, competitive: 1 } },
            { id: 'b', label: 'A que esconde uma área secreta', weights: { explorer: 5, collector: 2 } },
            { id: 'c', label: 'A que tem a história mais interessante', weights: { explorer: 4, social: 2 } },
            { id: 'd', label: 'Todas, em ordem, no checklist', weights: { achiever: 5, collector: 4, strategist: 1 } },
        ],
    },
    {
        id: 'q7',
        prompt: 'O que você acha de chat de voz com desconhecidos?',
        options: [
            { id: 'a', label: 'Essencial — coordenação ganha partida', weights: { social: 4, strategist: 3, competitive: 2 } },
            { id: 'b', label: 'Tranquilo, se o pessoal for de boa', weights: { social: 3, strategist: 1 } },
            { id: 'c', label: 'Só com gente que eu já conheço', weights: { social: 2, explorer: 1 } },
            { id: 'd', label: 'Prefiro jogar em silêncio', weights: { explorer: 3, achiever: 2 } },
        ],
    },
    {
        id: 'q8',
        prompt: 'Um evento por tempo limitado chega com cosméticos exclusivos.',
        options: [
            { id: 'a', label: 'Limpo todos os objetivos antes de acabar', weights: { collector: 5, achiever: 4 } },
            { id: 'b', label: 'Avalio se as recompensas valem o tempo', weights: { strategist: 4, achiever: 2 } },
            { id: 'c', label: 'Só me importo com a playlist competitiva', weights: { competitive: 5, strategist: 1 } },
            { id: 'd', label: 'Faço se os meus amigos estiverem fazendo', weights: { social: 5, collector: 1 } },
        ],
    },
    {
        id: 'q9',
        prompt: 'Qual destas sessões você mais gostaria de jogar?',
        options: [
            { id: 'a', label: 'Um torneio valendo de verdade', weights: { competitive: 5, strategist: 2, achiever: 1 } },
            { id: 'b', label: 'Uma noite longa de mundo aberto sem objetivo', weights: { explorer: 5, collector: 1 } },
            { id: 'c', label: 'Um time de cinco treinando estratégias', weights: { social: 4, strategist: 4 } },
            { id: 'd', label: 'Fazendo o grind das últimas conquistas de um jogo', weights: { achiever: 5, collector: 4 } },
        ],
    },
    {
        id: 'q10',
        prompt: 'Por fim — o que faria uma plataforma como esta valer a pena?',
        options: [
            { id: 'a', label: 'Encontrar parceiros do meu nível', weights: { competitive: 4, social: 3, strategist: 1 } },
            { id: 'b', label: 'Registrar tudo o que eu já joguei', weights: { collector: 5, achiever: 3 } },
            { id: 'c', label: 'Descobrir jogos que eu nunca acharia sozinho', weights: { explorer: 5, collector: 2 } },
            { id: 'd', label: 'Provar o que eu já conquistei', weights: { achiever: 4, competitive: 3, collector: 2 } },
        ],
    },
];

/* ============================================================
   ARCHETYPES
   Resolved deterministically from the DNA vector (gamer-dna.js).
   `primary` + opcional `secondary` describes the match rule.
   Combination entries are evaluated before single-axis entries.
   ============================================================ */

export const ARCHETYPES = [
    {
        id: 'tactician', name: 'O Tático', primary: 'strategist', secondary: 'competitive',
        tagline: 'Você vence a partida antes de ela começar.',
        description: 'Você trata cada jogo como um sistema a resolver. Lê notas de patch, ensaia setups e, quando a luta começa, já conhece os três jeitos de ela terminar.',
        traits: ['Planeja dois rounds à frente', 'Se adapta no meio da partida', 'Transforma derrota em dado'],
        roles: ['leader', 'anchor'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'captain', name: 'O Capitão', primary: 'social', secondary: 'strategist',
        tagline: 'O squad funciona porque você está nele.',
        description: 'Você é o motivo de um grupo de cinco virar time. Define o tom, mantém a comunicação limpa e garante que o plano chegue a todo mundo.',
        traits: ['Shotcaller nato', 'Mantém a moral firme', 'Monta squads duradouros'],
        roles: ['leader', 'support'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'gladiator', name: 'O Gladiador', primary: 'competitive', secondary: 'social',
        tagline: 'Você traz a briga e traz a galera.',
        description: 'Competir só tem graça com plateia. Você acelera o ritmo, troca todo duelo e puxa seu squad para cima no ranking.',
        traits: ['Presença de linha de frente', 'Cresce sob pressão', 'Joga pela vitória do time'],
        roles: ['entry', 'flex'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'archivist', name: 'O Arquivista', primary: 'collector', secondary: 'explorer',
        tagline: 'Se existe, você já catalogou.',
        description: 'Sua biblioteca é um museu. Você caça o drop raro, a sala escondida, o registro que ninguém se deu o trabalho de preencher — e depois organiza tudo.',
        traits: ['Completa coleções', 'Acha o conteúdo escondido', 'Documenta tudo'],
        roles: ['flex', 'support'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'pioneer', name: 'O Pioneiro', primary: 'explorer', secondary: 'achiever',
        tagline: 'Você termina o mapa e depois procura a borda dele.',
        description: 'O que ainda não viu é o que te puxa, e você é teimoso o bastante para chegar lá. Mundos novos e, depois, cada canto deles.',
        traits: ['Mapeia o desconhecido', 'Termina o que começa', 'Pouca paciência com rotina'],
        roles: ['flex', 'entry'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'strategist', name: 'O Estrategista', primary: 'strategist',
        tagline: 'Todo movimento tem um motivo.',
        description: 'Você prefere pensar uma vez a reagir cinco. Posicionamento, timing e informação são suas armas de verdade.',
        traits: ['Lê o mapa', 'Joga o jogo longo', 'Calmo sob pressão'],
        roles: ['leader', 'anchor'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'champion', name: 'O Campeão', primary: 'competitive',
        tagline: 'Segundo lugar é uma lista de tarefas.',
        description: 'Você mede sessões em vitórias. O ranqueado não é um modo secundário para você — é o jogo, e você pretende subir.',
        traits: ['Melhora sem parar', 'Mentalidade de clutch', 'Ranqueada em primeiro lugar'],
        roles: ['entry', 'sniper'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'explorer', name: 'O Explorador', primary: 'explorer',
        tagline: 'O mapa é uma sugestão.',
        description: 'Você joga do jeito que os outros viajam. Objetivos são opcionais; o interessante está sempre um pouco fora da trilha.',
        traits: ['Movido por curiosidade', 'Acha o segredo primeiro', 'Joga em largura, não em profundidade'],
        roles: ['flex', 'sniper'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'collector', name: 'O Colecionador', primary: 'collector',
        tagline: 'Nada está completo até estar completo.',
        description: 'Raridade significa algo para você. Prateleira cheia também. Sua biblioteca não é uma lista de jogos — é o registro de tudo o que você conquistou.',
        traits: ['Caça itens raros', 'Faz curadoria da biblioteca', 'Nunca vende nada'],
        roles: ['support', 'flex'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'socializer', name: 'O Sociável', primary: 'social',
        tagline: 'O lobby é o que importa.',
        description: 'O jogo é a desculpa; as pessoas são o motivo. Você prefere perder rindo com amigos a vencer sozinho em silêncio.',
        traits: ['Monta o lobby', 'Mantém todo mundo jogando', 'Comunicação excelente'],
        roles: ['support', 'flex'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'completionist', name: 'O Completista', primary: 'achiever',
        tagline: 'Os créditos são a metade do caminho.',
        description: 'Um jogo inacabado te incomoda pessoalmente. Você conclui a campanha principal, depois as missões opcionais e, por fim, aquela que a wiki esqueceu.',
        traits: ['100% ou nada', 'Extremamente persistente', 'Movido por checklist'],
        roles: ['anchor', 'flex'],
        accent: 'var(--color-primary)',
    },
];

/* ============================================================
   ACHIEVEMENTS
   `check` receives the full derived context and returns a boolean.
   Keeping the rule next to the copy means a badge can never drift
   out of sync with what unlocks it.
   ============================================================ */

export const RARITIES = {
    common: { label: 'Comum', weight: 1 },
    uncommon: { label: 'Incomum', weight: 2 },
    rare: { label: 'Rara', weight: 4 },
    epic: { label: 'Épica', weight: 7 },
    legendary: { label: 'Lendária', weight: 12 },
};

export const ACHIEVEMENTS = [
    {
        id: 'first-step', name: 'Primeiro Passo', rarity: 'common', icon: 'flag', xp: 0,
        description: 'Criou seu Passaporte Gamer.',
        hint: 'Crie uma conta para começar.',
        check: (ctx) => Boolean(ctx.user),
    },
    {
        id: 'identity-found', name: 'Identidade Encontrada', rarity: 'uncommon', icon: 'dna', xp: 0,
        description: 'Concluiu a análise do DNA Gamer.',
        hint: 'Responda ao questionário do DNA Gamer.',
        check: (ctx) => Boolean(ctx.user?.dna),
    },
    {
        id: 'game-on', name: 'Começou o Jogo', rarity: 'common', icon: 'controller', xp: 0,
        description: 'Adicionou seu primeiro jogo à Biblioteca.',
        hint: 'Adicione qualquer jogo à Biblioteca.',
        check: (ctx) => ctx.library.length >= 1,
    },
    {
        id: 'shelf-builder', name: 'Montador de Prateleira', rarity: 'uncommon', icon: 'stack', xp: 0,
        description: 'Chegou a 5 jogos na Biblioteca.',
        hint: 'Adicione 5 jogos à Biblioteca.',
        check: (ctx) => ctx.library.length >= 5,
    },
    {
        id: 'collector', name: 'Colecionador', rarity: 'rare', icon: 'gem', xp: 0,
        description: 'Chegou a 10 jogos na Biblioteca.',
        hint: 'Adicione 10 jogos à Biblioteca.',
        check: (ctx) => ctx.library.length >= 10,
    },
    {
        id: 'curator', name: 'Curador', rarity: 'epic', icon: 'crown', xp: 0,
        description: 'Chegou a 20 jogos na Biblioteca.',
        hint: 'Adicione 20 jogos à Biblioteca.',
        check: (ctx) => ctx.library.length >= 20,
    },
    {
        id: 'the-end', name: 'Subiram os Créditos', rarity: 'uncommon', icon: 'check', xp: 0,
        description: 'Marcou um jogo como Zerado.',
        hint: 'Termine um jogo e marque o status como Zerado.',
        check: (ctx) => ctx.library.some((entry) => entry.status === 'completed'),
    },
    {
        id: 'finisher', name: 'Finalizador', rarity: 'rare', icon: 'trophy', xp: 0,
        description: 'Zerou 5 jogos.',
        hint: 'Zere 5 jogos da Biblioteca.',
        check: (ctx) => ctx.library.filter((entry) => entry.status === 'completed').length >= 5,
    },
    {
        id: 'critic', name: 'Crítico', rarity: 'uncommon', icon: 'star', xp: 0,
        description: 'Avaliou 5 jogos diferentes.',
        hint: 'Avalie 5 jogos.',
        check: (ctx) => ctx.library.filter((entry) => entry.rating > 0).length >= 5,
    },
    {
        id: 'dedicated', name: 'Dedicado', rarity: 'rare', icon: 'clock', xp: 0,
        description: 'Registrou 100 horas na Biblioteca.',
        hint: 'Acumule 100 horas registradas.',
        check: (ctx) => ctx.totalHours >= 100,
    },
    {
        id: 'no-life', name: 'Mil Horas', rarity: 'legendary', icon: 'infinity', xp: 0,
        description: 'Registrou 1.000 horas na Biblioteca.',
        hint: 'Acumule 1.000 horas registradas.',
        check: (ctx) => ctx.totalHours >= 1000,
    },
    {
        id: 'multiplatform', name: 'Multiplataforma', rarity: 'uncommon', icon: 'grid', xp: 0,
        description: 'Registrou jogos em 3 plataformas diferentes.',
        hint: 'Tenha jogos em três plataformas.',
        check: (ctx) => new Set(ctx.library.map((entry) => entry.platform)).size >= 3,
    },
    {
        id: 'squad-up', name: 'Formou Squad', rarity: 'uncommon', icon: 'users', xp: 0,
        description: 'Fez sua primeira busca de squad.',
        hint: 'Faça uma busca de squad.',
        check: (ctx) => ctx.searchCount >= 1,
    },
    {
        id: 'perfect-match', name: 'Match Perfeito', rarity: 'epic', icon: 'spark', xp: 0,
        description: 'Encontrou um parceiro acima de 90% de compatibilidade.',
        hint: 'Alcance um resultado de 90% ou mais de compatibilidade.',
        check: (ctx) => ctx.bestMatch >= 90,
    },
    {
        id: 'full-roster', name: 'Elenco Completo', rarity: 'rare', icon: 'shield', xp: 0,
        description: 'Salvou 5 parceiros na sua lista de squad.',
        hint: 'Salve 5 jogadores pela busca de squad.',
        check: (ctx) => ctx.squads.length >= 5,
    },
    {
        id: 'complete-profile', name: 'Cadastro Completo', rarity: 'rare', icon: 'id', xp: 0,
        description: 'Preencheu todos os campos do seu Passaporte Gamer.',
        hint: 'Complete 100% do seu Passaporte.',
        check: (ctx) => ctx.profileCompletion >= 100,
    },
    {
        id: 'level-5', name: 'Em Ascensão', rarity: 'uncommon', icon: 'arrow-up', xp: 0,
        description: 'Chegou ao nível 5.',
        hint: 'Ganhe XP suficiente para chegar ao nível 5.',
        check: (ctx) => ctx.level >= 5,
    },
    {
        id: 'level-10', name: 'Veterano', rarity: 'epic', icon: 'medal', xp: 0,
        description: 'Chegou ao nível 10.',
        hint: 'Ganhe XP suficiente para chegar ao nível 10.',
        check: (ctx) => ctx.level >= 10,
    },
    {
        id: 'well-regarded', name: 'Bem Falado', rarity: 'rare', icon: 'heart', xp: 0,
        description: 'Chegou a uma reputação de 80.',
        hint: 'Construa sua reputação com atividade.',
        check: (ctx) => ctx.reputation >= 80,
    },
    {
        id: 'legend', name: 'Lenda', rarity: 'legendary', icon: 'crown', xp: 0,
        description: 'Desbloqueou outras 15 conquistas.',
        hint: 'Desbloqueie 15 conquistas.',
        check: (ctx) => ctx.unlockedCount >= 15,
    },

    /* --- V2: comunidade --- */
    {
        id: 'first-session', name: 'Primeira Sessão', rarity: 'common', icon: 'play', xp: 0,
        description: 'Jogou a primeira sessão com um squad.',
        hint: 'Em Squads, jogue uma sessão com um squad escolhido ou sorteado.',
        check: (ctx) => ctx.sessionCount >= 1,
    },
    {
        id: 'declared-ally', name: 'Aliado Declarado', rarity: 'uncommon', icon: 'heart', xp: 0,
        description: 'Marcou um colega de squad como aliado.',
        hint: 'Depois de uma sessão, marque alguém como Aliado.',
        check: (ctx) => ctx.allyCount >= 1,
    },
    {
        id: 'worthy-rival', name: 'Rival Digno', rarity: 'uncommon', icon: 'target', xp: 0,
        description: 'Marcou alguém como rival: quer enfrentar de novo.',
        hint: 'Depois de uma sessão, marque alguém como Rival.',
        check: (ctx) => ctx.rivalCount >= 1,
    },
    {
        id: 'recruit', name: 'Recruta', rarity: 'uncommon', icon: 'shield', xp: 0,
        description: 'Entrou em um clã.',
        hint: 'Entre em um clã aberto, seja aceito numa candidatura ou aceite um convite.',
        check: (ctx) => ctx.joinedClan,
    },
    {
        id: 'banner-raised', name: 'Bandeira Erguida', rarity: 'rare', icon: 'flag', xp: 0,
        description: 'Fundou o próprio clã.',
        hint: 'Crie um clã na página Clãs.',
        check: (ctx) => ctx.createdClan,
    },
    {
        id: 'arena-first-win', name: 'Primeira Vitória na Arena', rarity: 'uncommon', icon: 'trophy', xp: 0,
        description: 'Venceu uma partida de Arena.',
        hint: 'Vença um duelo, uma partida de squad ou um Clã vs Clã.',
        check: (ctx) => ctx.arenaWins >= 1,
    },
    {
        id: 'arena-legend', name: 'Lenda da Arena', rarity: 'legendary', icon: 'crown', xp: 0,
        description: 'Chegou ao tier Lenda na Arena (1.700 de rating).',
        hint: 'Alcance 1.700 de rating na Arena.',
        check: (ctx) => ctx.arenaRating >= 1700,
    },
    {
        id: 'community-voice', name: 'Voz da Comunidade', rarity: 'common', icon: 'globe', xp: 0,
        description: 'Publicou o primeiro post no Feed.',
        hint: 'Escreva um post no Feed.',
        check: (ctx) => ctx.postCount >= 1,
    },
];

/* ============================================================
   XP RULES
   Single source of truth for every point the product can award.
   ============================================================ */

export const XP_RULES = {
    createPassport: { amount: 100, label: 'Passaporte Gamer criado' },
    completeDna: { amount: 200, label: 'DNA Gamer concluído' },
    addGame: { amount: 50, label: 'Jogo adicionado à Biblioteca' },
    completeGame: { amount: 75, label: 'Jogo zerado' },
    rateGame: { amount: 15, label: 'Jogo avaliado' },
    updateGame: { amount: 10, label: 'Entrada da Biblioteca atualizada' },
    logHours: { amount: 5, label: 'Horas registradas' },
    squadSearch: { amount: 150, label: 'Busca de squad concluída' },
    saveTeammate: { amount: 60, label: 'Parceiro salvo no squad' },
    perfectMatch: { amount: 120, label: 'Match de alta compatibilidade' },
    completeProfile: { amount: 200, label: 'Passaporte 100% completo' },
    updateProfile: { amount: 25, label: 'Passaporte atualizado' },
    achievement: { amount: 40, label: 'Conquista desbloqueada' },

    /* --- V2: comunidade --- */
    squadSession: { amount: 120, label: 'Sessão de squad concluída' },
    markAlly: { amount: 30, label: 'Aliado declarado' },
    markRival: { amount: 30, label: 'Rival declarado' },
    joinClan: { amount: 150, label: 'Entrou em um clã' },
    createClan: { amount: 200, label: 'Clã criado' },
    arenaWin: { amount: 90, label: 'Vitória na Arena' },
    arenaMatch: { amount: 35, label: 'Partida de Arena disputada' },
    feedPost: { amount: 20, label: 'Post publicado no Feed' },
    feedReaction: { amount: 5, label: 'Reação no Feed' },
};

/** Ações do Feed que rendem XP por dia (posts e reações somados). */
export const FEED_DAILY_XP_LIMIT = 6;

/* ============================================================
   ROADMAP — o que honestamente ainda não existe
   Arena, Feed e Clãs saíram daqui na V2: agora existem, como
   comunidade simulada. O que resta depende de backend ou de
   integrações reais, e aparece na landing como roteiro, nunca
   como botão.
   ============================================================ */

export const ROADMAP = [
    { title: 'Multiplayer real', text: 'Backend, contas de verdade, amigos e chat em tempo real. Hoje a comunidade é simulada no seu navegador.', status: 'next' },
    { title: 'IA contextual', text: 'Recomendações que leem o seu Passaporte e sugerem o próximo jogo.', status: 'exploring' },
    { title: 'Sincronização de plataformas', text: 'Importe sua biblioteca real da Steam, PlayStation e Xbox.', status: 'exploring' },
];
