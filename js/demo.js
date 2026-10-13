/**
 * demo.js — one-click demo account.
 *
 * Builds a fully populated Passport so the product can be evaluated
 * without walking the onboarding every time: profile filled in, DNA
 * resolved, a stocked library, a saved squad and — in V2 — a clan, played
 * squad sessions with rated teammates, an Arena history, Feed posts and
 * an invite response waiting in the invite center.
 *
 * Nothing here is faked. Library entries go through `addEntry()`, the
 * clan through `createClan()`, sessions through `playSession()`, matches
 * through `playDuel()`/`playClanMatch()` and posts through `publishPost()`.
 * Results come from the same deterministic engine a click would use. Only
 * the starting data (profile, roster of the demo clan) is pre-written.
 */

import {
    saveUser, saveAccounts, saveSession, saveSquads, getAccounts, resetAll, getClans, saveClans,
} from './storage.js';
import { createUser } from './profile.js';
import { addEntry } from './library-store.js';
import { logActivity } from './activity.js';
import { checkAchievements, awardXp } from './gamification.js';
import { buildDnaProfile } from './gamer-dna.js';
import { DNA_QUESTIONS } from './data.js';
import { createClan, inviteToClan } from './clans-store.js';
import { playSession, ratePlayer } from './sessions.js';
import { playDuel, playClanMatch } from './arena-store.js';
import { publishPost } from './feed-store.js';
import { resolveDueInvites } from './invites.js';

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

/** O clã da conta demo: o usuário é o líder; o elenco já foi recrutado. */
const DEMO_CLAN = {
    name: 'Vanguarda Rivaly',
    tag: 'RVLY',
    focusGame: 'valorant',
    playstyle: 'competitive',
    policy: 'application',
    motto: 'Call curta, troca rápida, respeito sempre.',
    minRank: 'Gold',
};
const DEMO_CLAN_OFFICERS = ['p29'];
const DEMO_CLAN_MEMBERS = ['p27', 'p07'];

/** Sessões jogadas, com a avaliação de cada colega. */
const DEMO_SESSIONS = [
    { gameId: 'valorant', teammates: ['p29', 'p27', 'p07'], ratings: { p29: ['ally', ['comms', 'strategy']], p27: ['ally', ['fairplay']], p07: ['ally', ['comms']] } },
    { gameId: 'valorant', teammates: ['p11', 'p13', 'p17'], ratings: { p11: ['ally', ['strategy']], p13: ['rival', ['carry']], p17: ['neutral', []] } },
    { gameId: 'cs2', teammates: ['p04', 'p10'], ratings: { p04: ['rival', ['carry']], p10: ['neutral', ['fairplay']] } },
];

/** Partidas de Arena: rivais e adversários de vários tiers. */
const DEMO_DUELS = ['p14', 'p13', 'p16', 'p04', 'p17', 'p13'];

const DEMO_POSTS = [
    'Fechamos a semana com o [RVLY] batendo a meta. Valentina segurando o lado B foi outro nível.',
    'Procuro duo para Valorant hoje à noite. Jogo de suporte e uso voz. Quem topa?',
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

    seedCommunity();

    return { nickname: account.nickname };
}

/**
 * V2: a comunidade da conta demo, montada com as funções reais.
 * Ordem importa: o clã nasce primeiro, para que sessões e vitórias
 * contem para a meta semanal dele.
 */
function seedCommunity() {
    const created = createClan(DEMO_CLAN);
    if (created.ok) {
        saveClans(getClans().map((clan) => (clan.id === created.clan.id
            ? { ...clan, officers: [...DEMO_CLAN_OFFICERS], members: [...DEMO_CLAN_MEMBERS] }
            : clan)));
    }

    DEMO_SESSIONS.forEach(({ gameId, teammates, ratings }) => {
        const outcome = playSession({ gameId, teammateIds: teammates, mode: 'chosen' });
        if (!outcome.ok) return;
        Object.entries(ratings).forEach(([playerId, [relation, praises]]) => {
            ratePlayer(outcome.session.id, playerId, { relation, praises, silent: true });
        });
    });

    DEMO_DUELS.forEach((playerId) => playDuel(playerId));
    playClanMatch('gol');

    DEMO_POSTS.forEach((text) => publishPost(text));

    // Uma resposta esperando no centro de convites: o convite para a Nova
    // é decidido agora pelo motor, com o motivo, e fica como "não visto".
    const invite = inviteToClan('p09');
    if (invite.ok) resolveDueInvites(Date.now() + 60 * 60 * 1000);
}
