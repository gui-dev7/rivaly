/**
 * profile.js — the shape of a Passaporte Gamer and everything derived
 * directly from it (Gamer ID, completion, display helpers).
 *
 * The passport is the product's central record: every other feature
 * either reads it or writes into it.
 */

import { getUser, saveUser } from './storage.js';
import { hashString } from './ui.js';
import { getArchetypeById } from './gamer-dna.js';
import { defaultAvatarFor } from './avatar-service.js';

/* ------------------------------------------------------------------
   GAMER ID
   Visual identity only — explicitly not a security token.
   Derived from nickname + creation timestamp so it is stable for a
   given account and effectively unique inside one browser.
   ------------------------------------------------------------------ */

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O — avoids 1/0 confusion

export function generateGamerId(nickname, createdAt) {
    const hash = hashString(`${nickname}|${createdAt}`);
    const digits = String(hash % 10000).padStart(4, '0');
    const letterA = ID_ALPHABET[hash % ID_ALPHABET.length];
    const letterB = ID_ALPHABET[Math.floor(hash / ID_ALPHABET.length) % ID_ALPHABET.length];
    return `HG-${digits}-${letterA}${letterB}`;
}

/* ------------------------------------------------------------------
   FACTORY
   ------------------------------------------------------------------ */

export function createUser({ nickname, email }) {
    const createdAt = new Date().toISOString();
    return {
        nickname,
        email,
        createdAt,
        gamerId: generateGamerId(nickname, createdAt),
        // Unified avatar model. A brand-new passport gets a stable
        // DiceBear avatar seeded from the nickname, so it is never blank.
        avatar: defaultAvatarFor(nickname),

        // Optional identity fields, filled during onboarding.
        age: null,
        region: '',
        languages: [],
        platforms: [],
        favoriteGenres: [],
        currentGames: [],
        playstyle: '',
        schedules: [],
        roles: [],
        bio: '',

        // Behavioural profile.
        dna: null,

        // Progression.
        xp: 0,
        level: 1,

        // Lifecycle flags.
        onboardingComplete: false,
        updatedAt: createdAt,
    };
}

/* ------------------------------------------------------------------
   MUTATION
   ------------------------------------------------------------------ */

/** Shallow-merges a patch into the stored passport and persists it. */
export function updateUser(patch) {
    const current = getUser();
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    saveUser(next);
    return next;
}

/* ------------------------------------------------------------------
   COMPLETION
   Weighted so the fields that make matchmaking work count for more
   than the decorative ones.
   ------------------------------------------------------------------ */

const COMPLETION_FIELDS = [
    { key: 'nickname', weight: 10, filled: (user) => Boolean(user.nickname) },
    { key: 'avatar', weight: 5, filled: (user) => Boolean(user.avatar?.seed || user.avatar?.src) },
    { key: 'dna', weight: 20, filled: (user) => Boolean(user.dna) },
    { key: 'platforms', weight: 12, filled: (user) => user.platforms?.length > 0 },
    { key: 'favoriteGenres', weight: 10, filled: (user) => user.favoriteGenres?.length > 0 },
    { key: 'playstyle', weight: 10, filled: (user) => Boolean(user.playstyle) },
    { key: 'schedules', weight: 10, filled: (user) => user.schedules?.length > 0 },
    { key: 'roles', weight: 10, filled: (user) => user.roles?.length > 0 },
    { key: 'languages', weight: 5, filled: (user) => user.languages?.length > 0 },
    { key: 'region', weight: 4, filled: (user) => Boolean(user.region) },
    { key: 'bio', weight: 4, filled: (user) => (user.bio ?? '').trim().length >= 12 },
];

export function profileCompletion(user) {
    if (!user) return 0;
    const total = COMPLETION_FIELDS.reduce((sum, field) => sum + field.weight, 0);
    const earned = COMPLETION_FIELDS.reduce(
        (sum, field) => sum + (field.filled(user) ? field.weight : 0),
        0
    );
    return Math.round((earned / total) * 100);
}

/** The fields still missing, so the UI can tell the user what to do next. */
export function missingProfileFields(user) {
    if (!user) return [];
    return COMPLETION_FIELDS.filter((field) => !field.filled(user)).map((field) => field.key);
}

/* ------------------------------------------------------------------
   DISPLAY HELPERS
   ------------------------------------------------------------------ */

export function archetypeOf(user) {
    if (!user?.dna?.archetypeId) return null;
    return getArchetypeById(user.dna.archetypeId);
}

export function archetypeName(user) {
    return archetypeOf(user)?.name ?? 'Não classificado';
}

/**
 * The user's own "player record", shaped exactly like a simulated
 * player so the Motor de Compatibilidade can compare like with like.
 */
export function toPlayerShape(user, { reputation = 75 } = {}) {
    return {
        id: 'self',
        nickname: user?.nickname ?? 'You',
        games: user?.currentGames ?? [],
        rank: user?.rank ?? 'Unranked',
        schedules: user?.schedules ?? [],
        playstyle: user?.playstyle ?? 'balanced',
        roles: user?.roles ?? ['flex'],
        voiceChat: user?.voiceChat ?? true,
        languages: user?.languages ?? ['en'],
        reputation,
    };
}
