/**
 * storage.js — the single door to localStorage.
 *
 * No other module in the project is allowed to touch `localStorage`
 * directly. Everything goes through the accessors below, which:
 *   - namespace every key under `rivaly:`
 *   - survive corrupted / unparseable values
 *   - survive Private Mode where writes throw QuotaExceededError
 *   - keep one schema version so future migrations are possible
 */

const NAMESPACE = 'rivaly';
const SCHEMA_VERSION = 1;

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
   Lifecycle
   ------------------------------------------------------------------ */

/**
 * Wipes every namespaced key. Accounts are preserved by default so a
 * "reset demo data" does not silently delete the user's login.
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

/** Called once on boot. Stamps the schema version for future migrations. */
export function initStorage() {
    const migrated = migrateLegacyNamespace();
    const stored = read(KEYS.version, null);
    if (stored === null) {
        write(KEYS.version, SCHEMA_VERSION);
    }
    return { version: SCHEMA_VERSION, persistent: storageAvailable, migrated };
}
