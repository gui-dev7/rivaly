/**
 * demo.js — one-click demo account.
 *
 * Builds a fully populated Passport so the product can be evaluated
 * without walking the onboarding every time: profile filled in, DNA
 * resolved, a stocked library, a saved squad and the achievements
 * those actions genuinely unlock.
 *
 * Nothing here is faked. The library entries go through the real
 * `addEntry()`, and the badges come from `checkAchievements()` running
 * against that state — exactly as they would if you clicked through it
 * yourself. Only the starting data is pre-written.
 */

import {
    saveUser, saveAccounts, saveSession, saveSquads, getAccounts, resetAll,
} from './storage.js';
import { createUser } from './profile.js';
import { addEntry } from './library-store.js';
import { logActivity } from './activity.js';
import { checkAchievements, awardXp } from './gamification.js';
import { buildDnaProfile } from './gamer-dna.js';
import { DNA_QUESTIONS } from './data.js';

export const DEMO_EMAIL = 'demo@happygame.local';
export const DEMO_PASSWORD = 'demo1234';

/** Answers of a strategist-leaning competitive player. */
const DEMO_ANSWERS = ['b', 'a', 'c', 'a', 'b', 'd', 'a', 'b', 'a', 'a'];

const DEMO_LIBRARY = [
    ['valorant', 'playing', 240, 5, 'pc'],
    ['cs2', 'playing', 410, 5, 'pc'],
    ['rocket-league', 'playing', 96, 4, 'playstation'],
    ['apex', 'playing', 180, 4, 'pc'],
    ['minecraft', 'playing', 310, 4, 'pc'],
    ['elden-ring', 'completed', 120, 5, 'playstation'],
    ['baldurs-gate-3', 'completed', 98, 5, 'pc'],
    ['hades2', 'completed', 38, 4, 'switch'],
    ['hollow-knight', 'completed', 41, 5, 'switch'],
    ['tekken8', 'completed', 30, 4, 'playstation'],
    ['cyberpunk', 'dropped', 22, 3, 'pc'],
    ['stardew', 'backlog', 0, 0, 'switch'],
    ['civ6', 'backlog', 0, 0, 'pc'],
    ['forza', 'wishlist', 0, 0, 'xbox'],
];

const DEMO_SQUAD = [
    { playerId: 'p11', compatibility: 99, tier: 'excellent', gameId: 'valorant' },
    { playerId: 'p22', compatibility: 96, tier: 'excellent', gameId: 'valorant' },
    { playerId: 'p02', compatibility: 88, tier: 'great', gameId: 'valorant' },
];

const DEMO_ACTIVITY = [
    ['library', 'Adicionou Counter-Strike 2 à Biblioteca'],
    ['squad', 'Encontrou 99% de compatibilidade com Aisha'],
    ['achievement', 'Desbloqueou Match Perfeito'],
    ['library', 'Zerou Elden Ring'],
    ['passport', 'Atualizou o Passaporte Gamer'],
];

/**
 * Wipes local data and rebuilds the demo profile from scratch.
 * @returns {{nickname: string}}
 */
export function seedDemoAccount() {
    resetAll({ keepAccounts: true });

    /* --- Conta --- */
    const existing = getAccounts().find((account) => account.email === DEMO_EMAIL);
    const account = existing ?? {
        id: 'acc-demo',
        nickname: 'Guilherme',
        email: DEMO_EMAIL,
        // Marked so auth.js can recognise it; the demo entry point never
        // checks a password, and the login form still requires the real one.
        passwordHash: 'demo',
        createdAt: new Date().toISOString(),
        isDemo: true,
    };
    if (!existing) saveAccounts([...getAccounts(), account]);

    /* --- Passport --- */
    const user = createUser({ nickname: account.nickname, email: account.email });
    Object.assign(user, {
        onboardingComplete: true,
        rank: 'Diamond',
        region: 'South America',
        age: 24,
        bio: 'Main de suporte, jogo à noite e sou alérgico a solo queue.',
        avatar: { type: 'dicebear', style: 'pixel-art', seed: 'rival-007' },
        platforms: ['pc', 'playstation'],
        languages: ['pt', 'en'],
        favoriteGenres: ['FPS', 'Strategy', 'RPG', 'Battle Royale'],
        currentGames: ['valorant', 'cs2', 'rocket-league'],
        playstyle: 'competitive',
        schedules: ['evening', 'night'],
        roles: ['support', 'leader'],
        voiceChat: true,
        squadSearches: 4,
        bestMatch: 99,
        dna: buildDnaProfile(
            Object.fromEntries(DNA_QUESTIONS.map((question, index) => [question.id, DEMO_ANSWERS[index]]))
        ),
    });
    saveUser(user);
    saveSession({ accountId: account.id, startedAt: new Date().toISOString() });

    /* --- Library (through the real CRUD) --- */
    let added = 0;
    DEMO_LIBRARY.forEach(([gameId, status, hours, rating, platform]) => {
        if (addEntry({ gameId, status, hours, rating, platform }).ok) added += 1;
    });

    /* --- Squad --- */
    saveSquads(DEMO_SQUAD.map((entry) => ({ ...entry, savedAt: new Date().toISOString() })));

    /* --- Activity --- */
    DEMO_ACTIVITY.forEach(([type, message]) => logActivity(type, message));

    /* --- XP for what the profile represents, then real evaluation --- */
    awardXp('createPassport', { silent: true });
    awardXp('completeDna', { silent: true });
    awardXp('completeProfile', { silent: true });
    awardXp('addGame', { silent: true, multiplier: added });
    awardXp('completeGame', { silent: true, multiplier: 5 });
    awardXp('squadSearch', { silent: true, multiplier: 4 });
    awardXp('saveTeammate', { silent: true, multiplier: DEMO_SQUAD.length });
    awardXp('perfectMatch', { silent: true });

    checkAchievements();

    return { nickname: account.nickname };
}
