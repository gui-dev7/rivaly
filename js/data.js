/**
 * data.js — the entire demonstrative dataset of RIVALY.
 *
 * Nothing here is fetched from a network. Games and players are static
 * demo content; every number the product *derives* from them (DNA,
 * compatibility, XP, Gamer Score) is computed by real logic elsewhere.
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
    { id: 'mobile', label: 'Mobile' },
];

export const GENRES = [
    'FPS', 'Battle Royale', 'MOBA', 'RPG', 'Action', 'Adventure', 'Strategy',
    'Simulation', 'Sports', 'Racing', 'Sandbox', 'Survival', 'Horror',
    'Fighting', 'Puzzle', 'Roguelike', 'MMO', 'Indie',
];

export const LIBRARY_STATUSES = [
    { id: 'playing', label: 'Playing', color: 'var(--color-accent)' },
    { id: 'completed', label: 'Completed', color: 'var(--color-primary)' },
    { id: 'backlog', label: 'Backlog', color: 'var(--color-text-muted)' },
    { id: 'dropped', label: 'Dropped', color: 'var(--color-danger)' },
    { id: 'wishlist', label: 'Wishlist', color: 'var(--color-secondary)' },
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
    { id: 'morning', label: 'Morning', hint: '06:00 – 12:00' },
    { id: 'afternoon', label: 'Afternoon', hint: '12:00 – 18:00' },
    { id: 'evening', label: 'Evening', hint: '18:00 – 22:00' },
    { id: 'night', label: 'Night', hint: '22:00 – 02:00' },
    { id: 'latenight', label: 'Late Night', hint: '02:00 – 06:00' },
];

/** Ordered from most relaxed to most intense. */
export const PLAYSTYLES = [
    { id: 'casual', label: 'Casual', hint: 'Play to unwind' },
    { id: 'balanced', label: 'Balanced', hint: 'Fun first, but I want to win' },
    { id: 'competitive', label: 'Competitive', hint: 'Rank matters' },
    { id: 'hardcore', label: 'Hardcore', hint: 'Scrims, VOD review, the works' },
];

export const ROLES = [
    { id: 'leader', label: 'Leader', hint: 'Calls the plays' },
    { id: 'entry', label: 'Entry', hint: 'Opens the fight' },
    { id: 'support', label: 'Support', hint: 'Utility and cover' },
    { id: 'anchor', label: 'Anchor', hint: 'Holds the line' },
    { id: 'sniper', label: 'Sniper', hint: 'Long range control' },
    { id: 'flex', label: 'Flex', hint: 'Fills whatever is missing' },
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

/* ============================================================
   GAME CATALOG
   `hue` seeds the procedurally generated cover art (see ui.js),
   which keeps the project at zero image assets and zero 404s.
   ============================================================ */

export const GAMES = [
    { id: 'valorant', title: 'Valorant', genre: ['FPS', 'Strategy'], platform: ['pc'], hue: 356, glyph: 'VL', year: 2020, competitive: true, coverMode: 'wordmark', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Valorant_logo_-_pink_color_version.svg/960px-Valorant_logo_-_pink_color_version.svg.png' },
    { id: 'cs2', title: 'Counter-Strike 2', genre: ['FPS', 'Strategy'], platform: ['pc'], hue: 34, glyph: 'CS', year: 2023, competitive: true, steamAppId: 730 },
    { id: 'lol', title: 'League of Legends', genre: ['MOBA', 'Strategy'], platform: ['pc'], hue: 205, glyph: 'LL', year: 2009, competitive: true, coverMode: 'wordmark', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/League_of_Legends_2019_vector.svg/960px-League_of_Legends_2019_vector.svg.png' },
    { id: 'dota2', title: 'Dota 2', genre: ['MOBA', 'Strategy'], platform: ['pc'], hue: 12, glyph: 'D2', year: 2013, competitive: true, steamAppId: 570 },
    { id: 'rocket-league', title: 'Rocket League', genre: ['Sports', 'Racing'], platform: ['pc', 'playstation', 'xbox', 'switch'], hue: 210, glyph: 'RL', year: 2015, competitive: true, steamAppId: 252950 },
    { id: 'fortnite', title: 'Fortnite', genre: ['Battle Royale', 'Action'], platform: ['pc', 'playstation', 'xbox', 'switch', 'mobile'], hue: 268, glyph: 'FN', year: 2017, competitive: true, coverMode: 'wordmark', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Fortnite_logo_2.svg/960px-Fortnite_logo_2.svg.png' },
    { id: 'apex', title: 'Apex Legends', genre: ['Battle Royale', 'FPS'], platform: ['pc', 'playstation', 'xbox'], hue: 8, glyph: 'AP', year: 2019, competitive: true, steamAppId: 1172470 },
    { id: 'overwatch2', title: 'Overwatch 2', genre: ['FPS', 'Action'], platform: ['pc', 'playstation', 'xbox', 'switch'], hue: 28, glyph: 'OW', year: 2022, competitive: true, steamAppId: 2357570 },
    { id: 'minecraft', title: 'Minecraft', genre: ['Sandbox', 'Survival', 'Adventure'], platform: ['pc', 'playstation', 'xbox', 'switch', 'mobile'], hue: 118, glyph: 'MC', year: 2011, competitive: false, coverMode: 'wordmark', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Minecraft_Logo-en.svg/960px-Minecraft_Logo-en.svg.png' },
    { id: 'gta5', title: 'Grand Theft Auto V', genre: ['Action', 'Adventure'], platform: ['pc', 'playstation', 'xbox'], hue: 44, glyph: 'GT', year: 2013, competitive: false, steamAppId: 271590 },
    { id: 'elden-ring', title: 'Elden Ring', genre: ['RPG', 'Action'], platform: ['pc', 'playstation', 'xbox'], hue: 42, glyph: 'ER', year: 2022, competitive: false, steamAppId: 1245620 },
    { id: 'zelda-totk', title: 'Tears of the Kingdom', genre: ['Adventure', 'RPG'], platform: ['switch'], hue: 158, glyph: 'TK', year: 2023, competitive: false, coverUrl: 'https://upload.wikimedia.org/wikipedia/en/f/fb/The_Legend_of_Zelda_Tears_of_the_Kingdom_cover.jpg' },
    { id: 'baldurs-gate-3', title: "Baldur's Gate 3", genre: ['RPG', 'Strategy'], platform: ['pc', 'playstation', 'xbox'], hue: 320, glyph: 'BG', year: 2023, competitive: false, steamAppId: 1086940 },
    { id: 'stardew', title: 'Stardew Valley', genre: ['Simulation', 'Indie'], platform: ['pc', 'playstation', 'xbox', 'switch', 'mobile'], hue: 96, glyph: 'SV', year: 2016, competitive: false, steamAppId: 413150 },
    { id: 'hades2', title: 'Hades II', genre: ['Roguelike', 'Action', 'Indie'], platform: ['pc', 'switch'], hue: 288, glyph: 'H2', year: 2024, competitive: false, steamAppId: 1145350 },
    { id: 'the-witcher-3', title: 'The Witcher 3', genre: ['RPG', 'Adventure'], platform: ['pc', 'playstation', 'xbox', 'switch'], hue: 18, glyph: 'W3', year: 2015, competitive: false, steamAppId: 292030 },
    { id: 'cyberpunk', title: 'Cyberpunk 2077', genre: ['RPG', 'Action'], platform: ['pc', 'playstation', 'xbox'], hue: 52, glyph: 'CP', year: 2020, competitive: false, steamAppId: 1091500 },
    { id: 'fifa', title: 'EA FC 25', genre: ['Sports', 'Simulation'], platform: ['pc', 'playstation', 'xbox', 'switch'], hue: 148, glyph: 'FC', year: 2024, competitive: true, steamAppId: 2669320 },
    { id: 'nba2k', title: 'NBA 2K25', genre: ['Sports', 'Simulation'], platform: ['pc', 'playstation', 'xbox', 'switch'], hue: 22, glyph: 'NB', year: 2024, competitive: true, steamAppId: 2878980 },
    { id: 'forza', title: 'Forza Horizon 5', genre: ['Racing', 'Simulation'], platform: ['pc', 'xbox'], hue: 192, glyph: 'FH', year: 2021, competitive: false, steamAppId: 1551360 },
    { id: 'gran-turismo', title: 'Gran Turismo 7', genre: ['Racing', 'Simulation'], platform: ['playstation'], hue: 218, glyph: 'GT', year: 2022, competitive: true, coverUrl: 'https://upload.wikimedia.org/wikipedia/en/1/14/Gran_Turismo_7_cover_art.jpg' },
    { id: 'street-fighter-6', title: 'Street Fighter 6', genre: ['Fighting', 'Action'], platform: ['pc', 'playstation', 'xbox'], hue: 4, glyph: 'SF', year: 2023, competitive: true, steamAppId: 1364780 },
    { id: 'tekken8', title: 'Tekken 8', genre: ['Fighting', 'Action'], platform: ['pc', 'playstation', 'xbox'], hue: 340, glyph: 'T8', year: 2024, competitive: true, steamAppId: 1778820 },
    { id: 'rust', title: 'Rust', genre: ['Survival', 'Sandbox'], platform: ['pc'], hue: 24, glyph: 'RU', year: 2018, competitive: false, steamAppId: 252490 },
    { id: 'terraria', title: 'Terraria', genre: ['Sandbox', 'Adventure', 'Indie'], platform: ['pc', 'playstation', 'xbox', 'switch', 'mobile'], hue: 174, glyph: 'TR', year: 2011, competitive: false, steamAppId: 105600 },
    { id: 'hollow-knight', title: 'Hollow Knight', genre: ['Adventure', 'Indie', 'Action'], platform: ['pc', 'playstation', 'xbox', 'switch'], hue: 232, glyph: 'HK', year: 2017, competitive: false, steamAppId: 367520 },
    { id: 'phasmophobia', title: 'Phasmophobia', genre: ['Horror', 'Survival', 'Indie'], platform: ['pc'], hue: 262, glyph: 'PH', year: 2020, competitive: false, steamAppId: 739630 },
    { id: 'civ6', title: 'Civilization VI', genre: ['Strategy', 'Simulation'], platform: ['pc', 'playstation', 'xbox', 'switch', 'mobile'], hue: 200, glyph: 'C6', year: 2016, competitive: false, steamAppId: 289070 },
    { id: 'age4', title: 'Age of Empires IV', genre: ['Strategy'], platform: ['pc', 'xbox'], hue: 38, glyph: 'A4', year: 2021, competitive: true, steamAppId: 1466860 },
    { id: 'wow', title: 'World of Warcraft', genre: ['MMO', 'RPG'], platform: ['pc'], hue: 210, glyph: 'WW', year: 2004, competitive: false, coverUrl: 'https://upload.wikimedia.org/wikipedia/en/6/65/World_of_Warcraft.png' },
    { id: 'ff14', title: 'Final Fantasy XIV', genre: ['MMO', 'RPG'], platform: ['pc', 'playstation', 'xbox'], hue: 218, glyph: 'FF', year: 2013, competitive: false, steamAppId: 39210 },
    { id: 'among-us', title: 'Among Us', genre: ['Puzzle', 'Indie'], platform: ['pc', 'switch', 'mobile'], hue: 350, glyph: 'AU', year: 2018, competitive: false, steamAppId: 945360 },
];

export const getGameById = (id) => GAMES.find((game) => game.id === id) ?? null;

/**
 * Games that make sense as a Squad Finder target: the simulated player
 * pool only fields squads for titles people actually queue for.
 */
export const SQUAD_GAMES = [
    'valorant', 'cs2', 'lol', 'dota2', 'rocket-league', 'fortnite', 'apex',
    'overwatch2', 'fifa', 'minecraft', 'rust', 'age4',
].map(getGameById).filter(Boolean);

/* ============================================================
   SIMULATED PLAYER POOL
   Hand-authored for spread: the Compatibility Engine must be able
   to produce excellent, great, good and poor matches from the same
   search. `reputation` is authored demo content, never randomised.
   ============================================================ */

export const PLAYERS = [
    {
        id: 'p01', nickname: 'Matheus', region: 'South America',
        games: ['rocket-league', 'fifa', 'fortnite'], rank: 'Diamond',
        schedules: ['night', 'evening'], playstyle: 'competitive',
        roles: ['leader', 'entry'], voiceChat: true, languages: ['pt', 'en'],
        reputation: 94, matches: 412, bio: 'Shotcaller. Three seasons of amateur RL leagues.',
    },
    {
        id: 'p02', nickname: 'Yuki', region: 'Asia',
        games: ['valorant', 'apex', 'overwatch2'], rank: 'Master',
        schedules: ['latenight', 'night'], playstyle: 'hardcore',
        roles: ['sniper', 'entry'], voiceChat: true, languages: ['ja', 'en'],
        reputation: 91, matches: 980, bio: 'Aim trainer every morning. VOD review every night.',
    },
    {
        id: 'p03', nickname: 'Lorena', region: 'South America',
        games: ['rocket-league', 'valorant', 'minecraft'], rank: 'Diamond',
        schedules: ['night'], playstyle: 'competitive',
        roles: ['support', 'flex'], voiceChat: true, languages: ['pt', 'es'],
        reputation: 88, matches: 356, bio: 'Rotation-focused support. I read the map, not the kill feed.',
    },
    {
        id: 'p04', nickname: 'Kaito', region: 'Asia',
        games: ['cs2', 'valorant'], rank: 'Elite',
        schedules: ['evening', 'night'], playstyle: 'hardcore',
        roles: ['entry'], voiceChat: true, languages: ['ja', 'en'],
        reputation: 96, matches: 1420, bio: 'Ex semi-pro entry fragger. Looking for a serious roster.',
    },
    {
        id: 'p05', nickname: 'Bianca', region: 'South America',
        games: ['minecraft', 'stardew', 'among-us', 'terraria'], rank: 'Unranked',
        schedules: ['afternoon', 'evening'], playstyle: 'casual',
        roles: ['support', 'flex'], voiceChat: false, languages: ['pt'],
        reputation: 82, matches: 74, bio: 'Building a survival world, one chunk at a time.',
    },
    {
        id: 'p06', nickname: 'Dmitri', region: 'Europe',
        games: ['dota2', 'age4', 'civ6'], rank: 'Master',
        schedules: ['evening', 'night'], playstyle: 'hardcore',
        roles: ['leader', 'anchor'], voiceChat: true, languages: ['en', 'de'],
        reputation: 79, matches: 2100, bio: 'Draft nerd. I will explain the lane matchup whether you asked or not.',
    },
    {
        id: 'p07', nickname: 'Sofia', region: 'Europe',
        games: ['valorant', 'overwatch2', 'rocket-league'], rank: 'Platinum',
        schedules: ['evening'], playstyle: 'balanced',
        roles: ['support'], voiceChat: true, languages: ['es', 'en'],
        reputation: 90, matches: 288, bio: 'Comms clean, mood light, utility on time.',
    },
    {
        id: 'p08', nickname: 'Rafa', region: 'South America',
        games: ['fifa', 'nba2k', 'rocket-league'], rank: 'Platinum',
        schedules: ['night', 'latenight'], playstyle: 'competitive',
        roles: ['entry', 'flex'], voiceChat: true, languages: ['pt'],
        reputation: 85, matches: 530, bio: 'Weekend tournaments, weekday grind.',
    },
    {
        id: 'p09', nickname: 'Nova', region: 'North America',
        games: ['apex', 'fortnite', 'valorant'], rank: 'Diamond',
        schedules: ['latenight'], playstyle: 'competitive',
        roles: ['flex'], voiceChat: true, languages: ['en'],
        reputation: 87, matches: 640, bio: 'Fill main. Give me the gap and I close it.',
    },
    {
        id: 'p10', nickname: 'Hugo', region: 'Europe',
        games: ['cs2', 'rust'], rank: 'Gold',
        schedules: ['morning', 'afternoon'], playstyle: 'balanced',
        roles: ['anchor'], voiceChat: false, languages: ['fr', 'en'],
        reputation: 71, matches: 210, bio: 'Morning player. Quiet, but I hold the site.',
    },
    {
        id: 'p11', nickname: 'Aisha', region: 'Africa',
        games: ['lol', 'valorant', 'ff14'], rank: 'Diamond',
        schedules: ['evening', 'night'], playstyle: 'competitive',
        roles: ['leader', 'support'], voiceChat: true, languages: ['en', 'fr'],
        reputation: 93, matches: 870, bio: 'Macro over mechanics. I call it, you execute it.',
    },
    {
        id: 'p12', nickname: 'Teo', region: 'South America',
        games: ['minecraft', 'terraria', 'hollow-knight'], rank: 'Unranked',
        schedules: ['afternoon'], playstyle: 'casual',
        roles: ['flex'], voiceChat: false, languages: ['pt', 'es'],
        reputation: 76, matches: 48, bio: '100% completion or nothing. Slowly.',
    },
    {
        id: 'p13', nickname: 'Ingrid', region: 'Europe',
        games: ['overwatch2', 'apex', 'rocket-league'], rank: 'Master',
        schedules: ['night'], playstyle: 'hardcore',
        roles: ['anchor', 'support'], voiceChat: true, languages: ['de', 'en'],
        reputation: 89, matches: 1180, bio: 'Off-tank brain. I hold space so you can play.',
    },
    {
        id: 'p14', nickname: 'Caio', region: 'South America',
        games: ['valorant', 'cs2', 'fortnite'], rank: 'Silver',
        schedules: ['evening', 'night'], playstyle: 'casual',
        roles: ['entry'], voiceChat: true, languages: ['pt'],
        reputation: 68, matches: 96, bio: 'New to comp. Learning fast, tilting slowly.',
    },
    {
        id: 'p15', nickname: 'Mira', region: 'Oceania',
        games: ['lol', 'dota2', 'age4'], rank: 'Platinum',
        schedules: ['morning', 'evening'], playstyle: 'balanced',
        roles: ['support', 'anchor'], voiceChat: true, languages: ['en'],
        reputation: 84, matches: 470, bio: 'Vision score enjoyer.',
    },
    {
        id: 'p16', nickname: 'Zé', region: 'South America',
        games: ['fifa', 'gta5', 'forza'], rank: 'Gold',
        schedules: ['night', 'latenight'], playstyle: 'casual',
        roles: ['flex'], voiceChat: false, languages: ['pt'],
        reputation: 74, matches: 132, bio: 'Here to have fun, not to have a career.',
    },
    {
        id: 'p17', nickname: 'Priya', region: 'Asia',
        games: ['valorant', 'lol', 'among-us'], rank: 'Gold',
        schedules: ['evening'], playstyle: 'balanced',
        roles: ['support', 'flex'], voiceChat: true, languages: ['en'],
        reputation: 86, matches: 305, bio: 'Positive comms, zero flame. Ask my duo.',
    },
    {
        id: 'p18', nickname: 'Owen', region: 'North America',
        games: ['cs2', 'apex', 'rust'], rank: 'Elite',
        schedules: ['latenight', 'night'], playstyle: 'hardcore',
        roles: ['sniper'], voiceChat: true, languages: ['en'],
        reputation: 92, matches: 1610, bio: 'AWP on repeat. Scrims Tue/Thu.',
    },
    {
        id: 'p19', nickname: 'Lulu', region: 'Europe',
        games: ['stardew', 'minecraft', 'hades2', 'hollow-knight'], rank: 'Unranked',
        schedules: ['morning', 'afternoon'], playstyle: 'casual',
        roles: ['flex'], voiceChat: false, languages: ['fr'],
        reputation: 80, matches: 38, bio: 'Cozy games and long soundtracks.',
    },
    {
        id: 'p20', nickname: 'Bruno', region: 'South America',
        games: ['rocket-league', 'apex', 'valorant'], rank: 'Diamond',
        schedules: ['night', 'evening'], playstyle: 'competitive',
        roles: ['anchor', 'flex'], voiceChat: true, languages: ['pt', 'en'],
        reputation: 90, matches: 725, bio: 'Last-man clutch specialist. Ranked only.',
    },
    {
        id: 'p21', nickname: 'Hana', region: 'Asia',
        games: ['overwatch2', 'ff14', 'street-fighter-6'], rank: 'Platinum',
        schedules: ['night'], playstyle: 'competitive',
        roles: ['support'], voiceChat: true, languages: ['ja', 'en'],
        reputation: 88, matches: 540, bio: 'Main support, secondary DPS when the team needs it.',
    },
    {
        id: 'p22', nickname: 'Diego', region: 'South America',
        games: ['cs2', 'valorant', 'fifa'], rank: 'Master',
        schedules: ['evening', 'night'], playstyle: 'competitive',
        roles: ['leader'], voiceChat: true, languages: ['es', 'pt'],
        reputation: 91, matches: 1030, bio: 'IGL. Mid-round calls are my thing.',
    },
    {
        id: 'p23', nickname: 'Fen', region: 'Oceania',
        games: ['minecraft', 'rust', 'terraria'], rank: 'Silver',
        schedules: ['latenight'], playstyle: 'balanced',
        roles: ['anchor', 'support'], voiceChat: true, languages: ['en'],
        reputation: 77, matches: 190, bio: 'Base builder. If it has walls, I made them.',
    },
    {
        id: 'p24', nickname: 'Alice', region: 'Europe',
        games: ['lol', 'valorant', 'baldurs-gate-3'], rank: 'Platinum',
        schedules: ['evening', 'afternoon'], playstyle: 'balanced',
        roles: ['flex', 'leader'], voiceChat: true, languages: ['en', 'de'],
        reputation: 83, matches: 398, bio: 'Strategy first. I read patch notes for fun.',
    },
    {
        id: 'p25', nickname: 'Nando', region: 'South America',
        games: ['fortnite', 'rocket-league', 'fifa'], rank: 'Bronze',
        schedules: ['afternoon'], playstyle: 'casual',
        roles: ['entry'], voiceChat: false, languages: ['pt'],
        reputation: 62, matches: 55, bio: 'Just started. Please be patient.',
    },
    {
        id: 'p26', nickname: 'Sasha', region: 'North America',
        games: ['apex', 'overwatch2', 'cs2'], rank: 'Diamond',
        schedules: ['night', 'latenight'], playstyle: 'competitive',
        roles: ['entry', 'sniper'], voiceChat: true, languages: ['en', 'es'],
        reputation: 86, matches: 810, bio: 'Aggressive but coordinated. Trade with me.',
    },
];

/* ============================================================
   GAMER DNA QUESTIONNAIRE
   Each option carries a weight vector across the six attributes.
   Scoring is a pure sum + normalisation — see gamer-dna.js.
   ============================================================ */

export const DNA_ATTRIBUTES = [
    { id: 'competitive', label: 'Competitive', color: 'var(--color-dna-competitive)', description: 'How much winning drives you.' },
    { id: 'social', label: 'Social', color: 'var(--color-dna-social)', description: 'How much you play with and for other people.' },
    { id: 'explorer', label: 'Explorer', color: 'var(--color-dna-explorer)', description: 'Your pull toward discovery over routine.' },
    { id: 'strategist', label: 'Strategist', color: 'var(--color-dna-strategist)', description: 'How much you plan before you act.' },
    { id: 'achiever', label: 'Achiever', color: 'var(--color-dna-achiever)', description: 'Your drive to finish what you start.' },
    { id: 'collector', label: 'Collector', color: 'var(--color-dna-collector)', description: 'How much you value owning and completing sets.' },
];

export const DNA_QUESTIONS = [
    {
        id: 'q1',
        prompt: 'A new game just finished installing. What do you do first?',
        options: [
            { id: 'a', label: 'Wander off and explore everything', weights: { explorer: 5, collector: 2, social: 1 } },
            { id: 'b', label: 'Learn the mechanics properly before anything else', weights: { strategist: 5, achiever: 2 } },
            { id: 'c', label: 'Jump straight into a ranked match', weights: { competitive: 5, achiever: 2 } },
            { id: 'd', label: 'Call friends and start a lobby', weights: { social: 5, competitive: 1 } },
        ],
    },
    {
        id: 'q2',
        prompt: 'What actually motivates you to keep playing?',
        options: [
            { id: 'a', label: 'Winning', weights: { competitive: 5, achiever: 2 } },
            { id: 'b', label: 'Discovering something new', weights: { explorer: 5, collector: 1 } },
            { id: 'c', label: 'Completing everything there is to complete', weights: { achiever: 5, collector: 3 } },
            { id: 'd', label: 'The people I play with', weights: { social: 5, strategist: 1 } },
        ],
    },
    {
        id: 'q3',
        prompt: 'Inside a team, you naturally tend to…',
        options: [
            { id: 'a', label: 'Lead and make the calls', weights: { strategist: 4, competitive: 3, social: 2 } },
            { id: 'b', label: 'Execute the plan precisely', weights: { competitive: 4, achiever: 3 } },
            { id: 'c', label: 'Analyse and adapt the strategy', weights: { strategist: 5, explorer: 2 } },
            { id: 'd', label: 'Support and keep morale up', weights: { social: 5, achiever: 1 } },
        ],
    },
    {
        id: 'q4',
        prompt: 'Which of these would you brag about the most?',
        options: [
            { id: 'a', label: 'A top-tier competitive rank', weights: { competitive: 5, achiever: 3 } },
            { id: 'b', label: 'A 100% completion save file', weights: { achiever: 5, collector: 4 } },
            { id: 'c', label: 'A rare item nobody else has', weights: { collector: 5, explorer: 2 } },
            { id: 'd', label: 'A clutch play your squad still talks about', weights: { social: 4, competitive: 3 } },
        ],
    },
    {
        id: 'q5',
        prompt: 'You lose five ranked matches in a row. Your reaction?',
        options: [
            { id: 'a', label: 'Queue again immediately — it will turn around', weights: { competitive: 5, achiever: 2 } },
            { id: 'b', label: 'Review what went wrong before queueing', weights: { strategist: 5, achiever: 2 } },
            { id: 'c', label: 'Switch to something relaxing for a while', weights: { explorer: 4, social: 2 } },
            { id: 'd', label: 'Get the squad on call and play together', weights: { social: 5, competitive: 1 } },
        ],
    },
    {
        id: 'q6',
        prompt: 'Which side quest do you take?',
        options: [
            { id: 'a', label: 'The one with the best gear reward', weights: { achiever: 4, collector: 3, competitive: 1 } },
            { id: 'b', label: 'The one hiding a secret area', weights: { explorer: 5, collector: 2 } },
            { id: 'c', label: 'The one with the most interesting story', weights: { explorer: 4, social: 2 } },
            { id: 'd', label: 'All of them, in order, on the checklist', weights: { achiever: 5, collector: 4, strategist: 1 } },
        ],
    },
    {
        id: 'q7',
        prompt: 'How do you feel about voice chat with strangers?',
        options: [
            { id: 'a', label: 'Essential — coordination wins games', weights: { social: 4, strategist: 3, competitive: 2 } },
            { id: 'b', label: 'Fine, if people are calm about it', weights: { social: 3, strategist: 1 } },
            { id: 'c', label: 'Only with people I already know', weights: { social: 2, explorer: 1 } },
            { id: 'd', label: 'I prefer to play in silence', weights: { explorer: 3, achiever: 2 } },
        ],
    },
    {
        id: 'q8',
        prompt: 'A limited-time event drops with exclusive cosmetics.',
        options: [
            { id: 'a', label: 'I clear every objective before it ends', weights: { collector: 5, achiever: 4 } },
            { id: 'b', label: 'I check whether the rewards are worth the time', weights: { strategist: 4, achiever: 2 } },
            { id: 'c', label: 'I only care about the competitive playlist', weights: { competitive: 5, strategist: 1 } },
            { id: 'd', label: 'I do it if my friends are doing it', weights: { social: 5, collector: 1 } },
        ],
    },
    {
        id: 'q9',
        prompt: 'Pick the session you would most look forward to.',
        options: [
            { id: 'a', label: 'A tournament with real stakes', weights: { competitive: 5, strategist: 2, achiever: 1 } },
            { id: 'b', label: 'A long open-world night with no goal', weights: { explorer: 5, collector: 1 } },
            { id: 'c', label: 'A five-stack running strategies', weights: { social: 4, strategist: 4 } },
            { id: 'd', label: 'Grinding the last achievements of a game', weights: { achiever: 5, collector: 4 } },
        ],
    },
    {
        id: 'q10',
        prompt: 'Finally — what would make a platform like this worth using?',
        options: [
            { id: 'a', label: 'Finding teammates at my level', weights: { competitive: 4, social: 3, strategist: 1 } },
            { id: 'b', label: 'Tracking everything I have played', weights: { collector: 5, achiever: 3 } },
            { id: 'c', label: 'Discovering games I would never find alone', weights: { explorer: 5, collector: 2 } },
            { id: 'd', label: 'Proving what I have accomplished', weights: { achiever: 4, competitive: 3, collector: 2 } },
        ],
    },
];

/* ============================================================
   ARCHETYPES
   Resolved deterministically from the DNA vector (gamer-dna.js).
   `primary` + optional `secondary` describes the match rule.
   Combination entries are evaluated before single-axis entries.
   ============================================================ */

export const ARCHETYPES = [
    {
        id: 'tactician', name: 'The Tactician', primary: 'strategist', secondary: 'competitive',
        tagline: 'You win the match before it starts.',
        description: 'You treat every game as a system to be solved. You read patch notes, you rehearse setups, and when the fight begins you already know the three ways it can end.',
        traits: ['Plans two rounds ahead', 'Adapts mid-game', 'Turns losses into data'],
        roles: ['leader', 'anchor'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'captain', name: 'The Captain', primary: 'social', secondary: 'strategist',
        tagline: 'The squad works because you are in it.',
        description: 'You are the reason a group of five becomes a team. You set the tone, you keep the comms clean, and you make sure the plan actually reaches everyone.',
        traits: ['Natural shotcaller', 'Keeps morale steady', 'Builds squads that last'],
        roles: ['leader', 'support'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'gladiator', name: 'The Gladiator', primary: 'competitive', secondary: 'social',
        tagline: 'You bring the fight and the people.',
        description: 'Competition is only fun with witnesses. You push the pace, you trade every duel, and you drag your squad up the ladder with you.',
        traits: ['Front-line presence', 'Thrives under pressure', 'Plays for the team win'],
        roles: ['entry', 'flex'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'archivist', name: 'The Archivist', primary: 'collector', secondary: 'explorer',
        tagline: 'If it exists, you have it catalogued.',
        description: 'Your library is a museum. You hunt the rare drop, the hidden room, the entry nobody else bothered to fill in — and then you organise it.',
        traits: ['Completes sets', 'Finds the hidden content', 'Documents everything'],
        roles: ['flex', 'support'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'pioneer', name: 'The Pioneer', primary: 'explorer', secondary: 'achiever',
        tagline: 'You finish the map, then look for the edge of it.',
        description: 'You are pulled forward by what you have not seen yet, and you are stubborn enough to actually reach it. New worlds, then every corner of them.',
        traits: ['Maps the unknown', 'Finishes what it starts', 'Low tolerance for routine'],
        roles: ['flex', 'entry'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'strategist', name: 'The Strategist', primary: 'strategist',
        tagline: 'Every move has a reason.',
        description: 'You would rather think once than react five times. Positioning, timing and information are your real weapons.',
        traits: ['Reads the map', 'Plays the long game', 'Calm under pressure'],
        roles: ['leader', 'anchor'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'champion', name: 'The Champion', primary: 'competitive',
        tagline: 'Second place is a to-do list.',
        description: 'You measure sessions in wins. The ladder is not a side mode to you — it is the game, and you intend to climb it.',
        traits: ['Relentless improver', 'Clutch mentality', 'Ranked-first mindset'],
        roles: ['entry', 'sniper'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'explorer', name: 'The Explorer', primary: 'explorer',
        tagline: 'The map is a suggestion.',
        description: 'You play games the way other people travel. Objectives are optional; the interesting thing is always slightly off the path.',
        traits: ['Curiosity-driven', 'Finds the secret first', 'Plays wide, not deep'],
        roles: ['flex', 'sniper'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'collector', name: 'The Collector', primary: 'collector',
        tagline: 'Nothing is complete until it is complete.',
        description: 'Rarity means something to you. So does a full shelf. Your library is not a list of games — it is a record of everything you claimed.',
        traits: ['Hunts rare items', 'Curates the library', 'Never sells anything'],
        roles: ['support', 'flex'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'socializer', name: 'The Socializer', primary: 'social',
        tagline: 'The lobby is the point.',
        description: 'The game is the excuse; the people are the reason. You would rather lose loudly with friends than win alone in silence.',
        traits: ['Builds the lobby', 'Keeps everyone playing', 'Great comms'],
        roles: ['support', 'flex'],
        accent: 'var(--color-primary)',
    },
    {
        id: 'completionist', name: 'The Completionist', primary: 'achiever',
        tagline: 'The credits are the halfway point.',
        description: 'An unfinished game bothers you personally. You clear the list, then the optional list, then the one the wiki forgot about.',
        traits: ['100% or nothing', 'Extremely persistent', 'Checklist-driven'],
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
    common: { label: 'Common', weight: 1 },
    uncommon: { label: 'Uncommon', weight: 2 },
    rare: { label: 'Rare', weight: 4 },
    epic: { label: 'Epic', weight: 7 },
    legendary: { label: 'Legendary', weight: 12 },
};

export const ACHIEVEMENTS = [
    {
        id: 'first-step', name: 'First Step', rarity: 'common', icon: 'flag', xp: 0,
        description: 'Created your Gamer Passport.',
        hint: 'Create an account to begin.',
        check: (ctx) => Boolean(ctx.user),
    },
    {
        id: 'identity-found', name: 'Identity Found', rarity: 'uncommon', icon: 'dna', xp: 0,
        description: 'Completed the Gamer DNA analysis.',
        hint: 'Answer the Gamer DNA questionnaire.',
        check: (ctx) => Boolean(ctx.user?.dna),
    },
    {
        id: 'game-on', name: 'Game On', rarity: 'common', icon: 'controller', xp: 0,
        description: 'Added your first game to the Library.',
        hint: 'Add any game to your Library.',
        check: (ctx) => ctx.library.length >= 1,
    },
    {
        id: 'shelf-builder', name: 'Shelf Builder', rarity: 'uncommon', icon: 'stack', xp: 0,
        description: 'Reached 5 games in your Library.',
        hint: 'Add 5 games to your Library.',
        check: (ctx) => ctx.library.length >= 5,
    },
    {
        id: 'collector', name: 'Collector', rarity: 'rare', icon: 'gem', xp: 0,
        description: 'Reached 10 games in your Library.',
        hint: 'Add 10 games to your Library.',
        check: (ctx) => ctx.library.length >= 10,
    },
    {
        id: 'curator', name: 'Curator', rarity: 'epic', icon: 'crown', xp: 0,
        description: 'Reached 20 games in your Library.',
        hint: 'Add 20 games to your Library.',
        check: (ctx) => ctx.library.length >= 20,
    },
    {
        id: 'the-end', name: 'Roll Credits', rarity: 'uncommon', icon: 'check', xp: 0,
        description: 'Marked a game as Completed.',
        hint: 'Finish a game and set its status to Completed.',
        check: (ctx) => ctx.library.some((entry) => entry.status === 'completed'),
    },
    {
        id: 'finisher', name: 'Finisher', rarity: 'rare', icon: 'trophy', xp: 0,
        description: 'Completed 5 games.',
        hint: 'Complete 5 games in your Library.',
        check: (ctx) => ctx.library.filter((entry) => entry.status === 'completed').length >= 5,
    },
    {
        id: 'critic', name: 'Critic', rarity: 'uncommon', icon: 'star', xp: 0,
        description: 'Rated 5 different games.',
        hint: 'Give a rating to 5 games.',
        check: (ctx) => ctx.library.filter((entry) => entry.rating > 0).length >= 5,
    },
    {
        id: 'dedicated', name: 'Dedicated', rarity: 'rare', icon: 'clock', xp: 0,
        description: 'Logged 100 hours across your Library.',
        hint: 'Accumulate 100 tracked hours.',
        check: (ctx) => ctx.totalHours >= 100,
    },
    {
        id: 'no-life', name: 'Thousand Hours', rarity: 'legendary', icon: 'infinity', xp: 0,
        description: 'Logged 1,000 hours across your Library.',
        hint: 'Accumulate 1,000 tracked hours.',
        check: (ctx) => ctx.totalHours >= 1000,
    },
    {
        id: 'multiplatform', name: 'Multiplatform', rarity: 'uncommon', icon: 'grid', xp: 0,
        description: 'Registered games on 3 different platforms.',
        hint: 'Own games on three platforms.',
        check: (ctx) => new Set(ctx.library.map((entry) => entry.platform)).size >= 3,
    },
    {
        id: 'squad-up', name: 'Squad Up', rarity: 'uncommon', icon: 'users', xp: 0,
        description: 'Ran your first squad search.',
        hint: 'Use the Squad Finder once.',
        check: (ctx) => ctx.searchCount >= 1,
    },
    {
        id: 'perfect-match', name: 'Perfect Match', rarity: 'epic', icon: 'spark', xp: 0,
        description: 'Found a teammate above 90% compatibility.',
        hint: 'Reach a 90%+ compatibility result.',
        check: (ctx) => ctx.bestMatch >= 90,
    },
    {
        id: 'full-roster', name: 'Full Roster', rarity: 'rare', icon: 'shield', xp: 0,
        description: 'Saved 5 teammates to your squad list.',
        hint: 'Save 5 players from the Squad Finder.',
        check: (ctx) => ctx.squads.length >= 5,
    },
    {
        id: 'complete-profile', name: 'Fully Registered', rarity: 'rare', icon: 'id', xp: 0,
        description: 'Filled in every field of your Gamer Passport.',
        hint: 'Complete 100% of your Passport.',
        check: (ctx) => ctx.profileCompletion >= 100,
    },
    {
        id: 'level-5', name: 'Rising', rarity: 'uncommon', icon: 'arrow-up', xp: 0,
        description: 'Reached Level 5.',
        hint: 'Earn enough XP to reach Level 5.',
        check: (ctx) => ctx.level >= 5,
    },
    {
        id: 'level-10', name: 'Veteran', rarity: 'epic', icon: 'medal', xp: 0,
        description: 'Reached Level 10.',
        hint: 'Earn enough XP to reach Level 10.',
        check: (ctx) => ctx.level >= 10,
    },
    {
        id: 'well-regarded', name: 'Well Regarded', rarity: 'rare', icon: 'heart', xp: 0,
        description: 'Reached a reputation of 80.',
        hint: 'Build your reputation through activity.',
        check: (ctx) => ctx.reputation >= 80,
    },
    {
        id: 'legend', name: 'Happy Legend', rarity: 'legendary', icon: 'crown', xp: 0,
        description: 'Unlocked 15 other achievements.',
        hint: 'Unlock 15 achievements.',
        check: (ctx) => ctx.unlockedCount >= 15,
    },
];

/* ============================================================
   XP RULES
   Single source of truth for every point the product can award.
   ============================================================ */

export const XP_RULES = {
    createPassport: { amount: 100, label: 'Gamer Passport created' },
    completeDna: { amount: 200, label: 'Gamer DNA completed' },
    addGame: { amount: 50, label: 'Game added to Library' },
    completeGame: { amount: 75, label: 'Game completed' },
    rateGame: { amount: 15, label: 'Game rated' },
    updateGame: { amount: 10, label: 'Library entry updated' },
    logHours: { amount: 5, label: 'Playtime logged' },
    squadSearch: { amount: 150, label: 'Squad search completed' },
    saveTeammate: { amount: 60, label: 'Teammate saved to squad' },
    perfectMatch: { amount: 120, label: 'High compatibility match found' },
    completeProfile: { amount: 200, label: 'Passport fully completed' },
    updateProfile: { amount: 25, label: 'Passport updated' },
    achievement: { amount: 40, label: 'Achievement unlocked' },
};

/* ============================================================
   ROADMAP — what is honestly not in V1
   Rendered on the landing page so nothing in the UI pretends
   to be functional when it is not.
   ============================================================ */

export const ROADMAP = [
    { title: 'Arena', text: 'Tournaments, brackets and live match tracking.', status: 'next' },
    { title: 'Social Feed', text: 'Clips, posts and squad activity from people you play with.', status: 'next' },
    { title: 'Contextual AI', text: 'Recommendations that read your Passport and suggest what to play next.', status: 'exploring' },
    { title: 'Clans', text: 'Persistent teams with shared identity, roster and stats.', status: 'exploring' },
    { title: 'Platform Sync', text: 'Import your real library from Steam, PlayStation and Xbox.', status: 'exploring' },
];
