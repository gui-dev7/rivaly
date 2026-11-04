/**
 * storage.js — the single door to localStorage (and sessionStorage).
 *
 * No other module in the project is allowed to touch `localStorage` or
 * `sessionStorage` directly. Everything goes through the accessors below,
 * which:
 *   - namespace every key under `rivaly:`
 *   - survive corrupted / unparseable values
 *   - survive Private Mode where writes throw QuotaExceededError
 *   - keep one schema version and migrate old data forward
 *
 * SCHEMA 2 (V2): adds the community keys — clans, clanMembership,
 * clanProgress, arena, feed, invites, sessions and relations. The
 * migration only *adds* keys; nothing written by V1 is touched.
 */

const NAMESPACE = 'rivaly';
export const SCHEMA_VERSION = 2;

export const KEYS = {
    version: `${NAMESPACE}:version`,
    accounts: `${NAMESPACE}:accounts`,
    session: `${NAMESPACE}:session`,
    user: `${NAMESPACE}:user`,
    library: `${NAMESPACE}:library`,
    achievements: `${NAMESPACE}:achievements`,
    activity: `${NAMESPACE}:activity`,
    squads: `${NAMESPACE}:squads`,
    settings: `${NAMESPACE}:settings`,
    externalGames: `${NAMESPACE}:externalGames`,

    /* --- V2: comunidade simulada --- */
    clans: `${NAMESPACE}:clans`,
    clanMembership: `${NAMESPACE}:clanMembership`,
    clanProgress: `${NAMESPACE}:clanProgress`,
    arena: `${NAMESPACE}:arena`,
    feed: `${NAMESPACE}:feed`,
    invites: `${NAMESPACE}:invites`,
    sessions: `${NAMESPACE}:sessions`,
    relations: `${NAMESPACE}:relations`,
};

/** Caps so localStorage never grows without bound (see activity.js). */
export const LIMITS = {
    feedPosts: 50,
    commentsPerPost: 20,
    arenaHistory: 60,
    sessions: 30,
    invites: 60,
};

/** Cheap availability probe — Safari Private Mode throws on setItem. */
let storageAvailable = (() => {
    try {
        const probe = `${NAMESPACE}:probe`;
        window.localStorage.setItem(probe, '1');
        window.localStorage.removeItem(probe);
        return true;
    } catch {
        return false;
    }
})();

/** In-memory fallback so the app still runs (without persistence). */
const memoryStore = new Map();

function rawGet(key) {
    if (!storageAvailable) return memoryStore.has(key) ? memoryStore.get(key) : null;
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function rawSet(key, value) {
    if (!storageAvailable) {
        memoryStore.set(key, value);
        return false;
    }
    try {
        window.localStorage.setItem(key, value);
        return true;
    } catch {
        // Quota exceeded or storage disabled mid-session: degrade, never crash.
        storageAvailable = false;
        memoryStore.set(key, value);
        return false;
    }
}

function rawRemove(key) {
    memoryStore.delete(key);
    if (!storageAvailable) return;
    try {
        window.localStorage.removeItem(key);
    } catch {
        /* nothing sensible to do */
    }
}

export function read(key, fallback = null) {
    const raw = rawGet(key);
    if (raw === null || raw === undefined) return fallback;
    try {
        const parsed = JSON.parse(raw);
        return parsed === null ? fallback : parsed;
    } catch {
        // A value written by an older/broken build. Drop it rather than
        // letting a JSON.parse error take down the whole page.
        rawRemove(key);
        return fallback;
    }
}

export function write(key, value) {
    return rawSet(key, JSON.stringify(value));
}

export function remove(key) {
    rawRemove(key);
}

export function isPersistent() {
    return storageAvailable;
}

/** Size in bytes of the raw stored value (0 when the key is empty). */
export function rawSize(key) {
    const raw = rawGet(key);
    if (raw === null || raw === undefined) return 0;
    try {
        return new Blob([raw]).size;
    } catch {
        return String(raw).length;
    }
}

/* ------------------------------------------------------------------
   Session storage (tab-scoped). Used by the guided tour and the
   landing intro; kept here so no other module touches Web Storage.
   ------------------------------------------------------------------ */

export function sessionRead(name, fallback = null) {
    try {
        const raw = window.sessionStorage.getItem(`${NAMESPACE}:${name}`);
        return raw === null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
}

export function sessionWrite(name, value) {
    try {
        if (value === null || value === undefined) window.sessionStorage.removeItem(`${NAMESPACE}:${name}`);
        else window.sessionStorage.setItem(`${NAMESPACE}:${name}`, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

/* ------------------------------------------------------------------
   Domain accessors
   ------------------------------------------------------------------ */

/* --- Accounts (academic simulation, see auth.js) --- */
export const getAccounts = () => read(KEYS.accounts, []);
export const saveAccounts = (accounts) => write(KEYS.accounts, accounts);

/* --- Session --- */
export const getSession = () => read(KEYS.session, null);
export const saveSession = (session) => write(KEYS.session, session);
export const clearSession = () => remove(KEYS.session);

/* --- Passaporte Gamer (the user profile) --- */
export const getUser = () => read(KEYS.user, null);
export const saveUser = (user) => write(KEYS.user, user);

/* --- Biblioteca de Jogos --- */
export const getLibrary = () => read(KEYS.library, []);
export const saveLibrary = (library) => write(KEYS.library, library);

/* --- Conquistas: array of { id, unlockedAt, context } --- */
export const getAchievements = () => read(KEYS.achievements, []);
export const saveAchievements = (achievements) => write(KEYS.achievements, achievements);

/* --- Activity feed --- */
export const getActivity = () => read(KEYS.activity, []);
export const saveActivity = (activity) => write(KEYS.activity, activity);

/* --- Squad history: matches the user has saved --- */
export const getSquads = () => read(KEYS.squads, []);
export const saveSquads = (squads) => write(KEYS.squads, squads);

/* --- Settings --- */
const DEFAULT_SETTINGS = {
    reducedMotion: false,
    toastsEnabled: true,
    compactDensity: false,
};

export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) });
export const saveSettings = (settings) => write(KEYS.settings, { ...getSettings(), ...settings });

/* ------------------------------------------------------------------
   V2 — Comunidade simulada
   Shapes are documented here once; the *-store.js modules own the rules.
   ------------------------------------------------------------------ */

export const DEFAULT_ARENA = () => ({
    rating: 1000,
    matches: 0,
    wins: 0,
    losses: 0,
    peak: 1000,
    season: { week: null, points: 0, wins: 0, losses: 0 },
    history: [],
});

export const DEFAULT_FEED = () => ({
    posts: [],        // posts do próprio usuário
    reactions: {},    // { [postId]: ['gg' | 'respeito' | 'rivalidade'] }
    comments: {},     // { [postId]: [{ id, authorId, text, at }] }
    daily: { date: null, xpEvents: 0 },
});

/* --- Clãs criados pelo usuário (os semeados vivem em data.js) --- */
export const getClans = () => read(KEYS.clans, []);
export const saveClans = (clans) => write(KEYS.clans, clans);

/* --- Vínculo do usuário: { clanId, role, joinedAt } ou null --- */
export const getClanMembership = () => read(KEYS.clanMembership, null);
export const saveClanMembership = (membership) => write(KEYS.clanMembership, membership);

/* --- Progresso que o usuário gerou em cada clã: { [clanId]: { xp, week, weekPoints } } --- */
export const getClanProgress = () => read(KEYS.clanProgress, {});
export const saveClanProgress = (progress) => write(KEYS.clanProgress, progress);

/* --- Arena: rating, temporada e histórico --- */
export const getArena = () => ({ ...DEFAULT_ARENA(), ...read(KEYS.arena, {}) });
export const saveArena = (arena) => write(KEYS.arena, {
    ...arena,
    history: (arena.history ?? []).slice(0, LIMITS.arenaHistory),
});

/* --- Feed: posts, reações e comentários do usuário --- */
export const getFeed = () => ({ ...DEFAULT_FEED(), ...read(KEYS.feed, {}) });
export const saveFeed = (feed) => write(KEYS.feed, {
    ...feed,
    posts: (feed.posts ?? []).slice(0, LIMITS.feedPosts),
});

/* --- Convites: clã, candidatura e desafio --- */
export const getInvites = () => read(KEYS.invites, []);
export const saveInvites = (invites) => {
    // Pendentes nunca são descartados; os resolvidos mais antigos saem primeiro.
    const pending = invites.filter((invite) => invite.status === 'pending');
    const resolved = invites.filter((invite) => invite.status !== 'pending');
    return write(KEYS.invites, [...pending, ...resolved].slice(0, Math.max(LIMITS.invites, pending.length)));
};

/* --- Sessões de squad jogadas --- */
export const getSessions = () => read(KEYS.sessions, []);
export const saveSessions = (sessions) => write(KEYS.sessions, sessions.slice(0, LIMITS.sessions));

/* --- Relações: { [playerId]: { type, praises, updatedAt } } --- */
export const getRelations = () => read(KEYS.relations, {});
export const saveRelations = (relations) => write(KEYS.relations, relations);

/* ------------------------------------------------------------------
   Lifecycle
   ------------------------------------------------------------------ */

/**
 * Wipes every namespaced key. With `keepAccounts: true` (what Settings
 * and the demo use) the login survives, so a reset never silently
 * deletes the user's account.
 */
export function resetAll({ keepAccounts = false } = {}) {
    const accounts = keepAccounts ? getAccounts() : null;
    Object.values(KEYS).forEach(remove);
    if (keepAccounts && accounts) saveAccounts(accounts);
    write(KEYS.version, SCHEMA_VERSION);
}

/**
 * Carries data written under the previous brand's namespace across to
 * the current one. Runs once: after the copy the legacy keys are
 * removed, so a returning tester keeps their passport instead of
 * silently starting from zero.
 */
const LEGACY_NAMESPACE = 'happyGame';

function migrateLegacyNamespace() {
    if (!storageAvailable) return false;
    let moved = 0;
    Object.entries(KEYS).forEach(([name, key]) => {
        const legacyKey = `${LEGACY_NAMESPACE}:${name}`;
        try {
            const value = window.localStorage.getItem(legacyKey);
            if (value === null) return;
            if (window.localStorage.getItem(key) === null) {
                window.localStorage.setItem(key, value);
                moved += 1;
            }
            window.localStorage.removeItem(legacyKey);
        } catch {
            /* Nothing recoverable here; the app simply starts fresh. */
        }
    });
    return moved > 0;
}

/**
 * Schema 1 -> 2. Only initialises the community keys that do not exist
 * yet; accounts, passport, library, achievements, activity, squads and
 * settings written by V1 are left exactly as they were.
 */
function migrateToV2() {
    const defaults = {
        [KEYS.clans]: [],
        [KEYS.clanMembership]: null,
        [KEYS.clanProgress]: {},
        [KEYS.arena]: DEFAULT_ARENA(),
        [KEYS.feed]: DEFAULT_FEED(),
        [KEYS.invites]: [],
        [KEYS.sessions]: [],
        [KEYS.relations]: {},
    };
    Object.entries(defaults).forEach(([key, value]) => {
        if (rawGet(key) === null) write(key, value);
    });
}

const MIGRATIONS = {
    2: migrateToV2,
};

/** Called once on boot. Migrates old data forward and stamps the version. */
export function initStorage() {
    const migrated = migrateLegacyNamespace();
    const stored = Number(read(KEYS.version, 0)) || 0;

    // A browser with no RIVALY data at all starts directly on the current
    // schema; one with V1 data walks every migration in order.
    const hasData = rawGet(KEYS.user) !== null || rawGet(KEYS.accounts) !== null;
    const from = stored || (hasData ? 1 : SCHEMA_VERSION);

    for (let version = from + 1; version <= SCHEMA_VERSION; version += 1) {
        MIGRATIONS[version]?.();
    }
    if (stored !== SCHEMA_VERSION) write(KEYS.version, SCHEMA_VERSION);

    return { version: SCHEMA_VERSION, from, persistent: storageAvailable, migrated };
}
