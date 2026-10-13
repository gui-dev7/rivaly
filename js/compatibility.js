/**
 * compatibility.js — the Motor de Compatibilidade.
 *
 * A real, auditable algorithm. Given a search and a player, it returns
 * a 0-100 score plus a full breakdown explaining where every point was
 * earned and where every point was lost.
 *
 * There is no `Math.random()` in this file. Identical inputs always
 * produce an identical score — that is the point.
 *
 *   Game compatibility ....... 20%
 *   Rank ..................... 15%
 *   Schedule ................. 15%
 *   Estilo de jogo ................ 15%
 *   Role compatibility ....... 15%
 *   Communication ............ 10%
 *   Reputacao ............... 10%
 *   ------------------------------
 *   Total ................... 100%
 */

import {
    PLAYERS, RANK_LADDER, SCHEDULES, PLAYSTYLES, COMPLEMENTARY_ROLES,
    getGameById, LANGUAGES, ROLES,
} from './data.js';

export const WEIGHTS = {
    game: 20,
    rank: 15,
    schedule: 15,
    playstyle: 15,
    role: 15,
    communication: 10,
    reputation: 10,
};

const labelOf = (collection, id) =>
    collection.find((item) => item.id === id)?.label ?? id;

/* ============================================================
   1. GAME — 20%
   Playing the same title is the only thing that fully counts.
   Sharing a genre is worth partial credit; nothing in common is
   heavily penalised but never zeroed.
   ============================================================ */

export function calculateGameCompatibility(player, criteria) {
    const target = getGameById(criteria.gameId);
    if (!target) {
        return { score: 70, reason: 'Nenhum jogo específico selecionado', positive: false };
    }

    if (player.games.includes(target.id)) {
        return { score: 100, reason: `Joga ${target.title}`, positive: true };
    }

    const playerGenres = new Set(
        player.games.flatMap((gameId) => getGameById(gameId)?.genre ?? [])
    );
    const shared = target.genre.filter((genre) => playerGenres.has(genre));

    if (shared.length >= 2) {
        return { score: 62, reason: `Joga gêneros parecidos (${shared.join(', ')})`, positive: false };
    }
    if (shared.length === 1) {
        return { score: 48, reason: `Alguma coincidência de gênero (${shared[0]})`, positive: false };
    }
    return { score: 15, reason: `Não joga ${target.title}`, positive: false };
}

/* ============================================================
   2. RANK — 15%
   Distance on the universal ladder. One tier apart is healthy;
   four tiers apart makes a match unproductive for both players.
   ============================================================ */

const RANK_BY_DISTANCE = [100, 85, 62, 38, 20, 8];

export function calculateRankCompatibility(player, criteria) {
    if (!criteria.rank || criteria.rank === 'any') {
        return { score: 82, reason: 'Sem exigência de rank', positive: false };
    }

    const targetIndex = RANK_LADDER.indexOf(criteria.rank);
    const playerIndex = RANK_LADDER.indexOf(player.rank);

    if (targetIndex < 0 || playerIndex < 0) {
        return { score: 60, reason: 'Rank não comparável', positive: false };
    }

    const distance = Math.abs(targetIndex - playerIndex);
    const score = RANK_BY_DISTANCE[Math.min(distance, RANK_BY_DISTANCE.length - 1)];

    if (distance === 0) return { score, reason: `Mesmo rank (${player.rank})`, positive: true };
    if (distance === 1) return { score, reason: `Um tier de diferença (${player.rank})`, positive: true };
    return {
        score,
        reason: `${distance} tiers de diferença (${player.rank} vs ${criteria.rank})`,
        positive: false,
    };
}

/* ============================================================
   3. SCHEDULE — 15%
   SCHEDULES is an ordered list, so index distance is a genuine
   measure of overlap. A player with several slots is scored on
   their best one.
   ============================================================ */

const SCHEDULE_BY_DISTANCE = [100, 72, 42, 20, 10];

export function calculateScheduleCompatibility(player, criteria) {
    if (!criteria.schedule || criteria.schedule === 'any') {
        return { score: 80, reason: 'Horário flexível solicitado', positive: false };
    }

    const targetIndex = SCHEDULES.findIndex((slot) => slot.id === criteria.schedule);
    const distances = player.schedules
        .map((slot) => SCHEDULES.findIndex((entry) => entry.id === slot))
        .filter((index) => index >= 0)
        .map((index) => Math.abs(index - targetIndex));

    if (distances.length === 0) {
        return { score: 40, reason: 'Sem informação de horário', positive: false };
    }

    const distance = Math.min(...distances);
    const score = SCHEDULE_BY_DISTANCE[Math.min(distance, SCHEDULE_BY_DISTANCE.length - 1)];
    const targetLabel = labelOf(SCHEDULES, criteria.schedule);

    if (distance === 0) return { score, reason: `Mesmo horário (${targetLabel})`, positive: true };
    if (distance === 1) return { score, reason: `Horário próximo (${targetLabel})`, positive: true };
    return {
        score,
        reason: `Costuma estar online em outro horário (${player.schedules.map((slot) => labelOf(SCHEDULES, slot)).join(', ')})`,
        positive: false,
    };
}

/* ============================================================
   4. PLAYSTYLE — 15%
   PLAYSTYLES runs casual → hardcore, so distance measures the
   mismatch in intensity directly.
   ============================================================ */

const PLAYSTYLE_BY_DISTANCE = [100, 74, 44, 18];

export function calculatePlaystyleCompatibility(player, criteria) {
    if (!criteria.playstyle || criteria.playstyle === 'any') {
        return { score: 80, reason: 'Qualquer estilo de jogo aceito', positive: false };
    }

    const targetIndex = PLAYSTYLES.findIndex((style) => style.id === criteria.playstyle);
    const playerIndex = PLAYSTYLES.findIndex((style) => style.id === player.playstyle);

    if (targetIndex < 0 || playerIndex < 0) {
        return { score: 60, reason: 'Estilo de jogo não comparável', positive: false };
    }

    const distance = Math.abs(targetIndex - playerIndex);
    const score = PLAYSTYLE_BY_DISTANCE[Math.min(distance, PLAYSTYLE_BY_DISTANCE.length - 1)];
    const playerLabel = labelOf(PLAYSTYLES, player.playstyle);

    if (distance === 0) return { score, reason: `Mesmo estilo de jogo (${playerLabel})`, positive: true };
    if (distance === 1) return { score, reason: `Estilo de jogo parecido (${playerLabel})`, positive: true };
    return { score, reason: `Intensidade diferente (${playerLabel})`, positive: false };
}

/* ============================================================
   5. ROLE — 15%
   Squads want gaps filled, not roles duplicated. A complementary
   pairing scores full marks; the same role on both sides is still
   playable, just less useful.
   ============================================================ */

function rolePairScore(userRole, playerRole) {
    if (userRole === playerRole) return 52;
    if ((COMPLEMENTARY_ROLES[userRole] ?? []).includes(playerRole)) return 100;
    return 74;
}

export function calculateRoleCompatibility(player, criteria, userRoles = []) {
    const wanted = criteria.role && criteria.role !== 'any' ? [criteria.role] : userRoles;

    if (!wanted || wanted.length === 0) {
        return { score: 75, reason: 'Sem função preferida no seu Passaporte', positive: false };
    }
    if (!player.roles || player.roles.length === 0) {
        return { score: 60, reason: 'Jogador sem função declarada', positive: false };
    }

    let best = { score: 0, userRole: wanted[0], playerRole: player.roles[0] };
    wanted.forEach((userRole) => {
        player.roles.forEach((playerRole) => {
            const score = rolePairScore(userRole, playerRole);
            if (score > best.score) best = { score, userRole, playerRole };
        });
    });

    const playerLabel = labelOf(ROLES, best.playerRole);
    const userLabel = labelOf(ROLES, best.userRole);

    if (best.score === 100) {
        return { score: 100, reason: `Função complementar (${playerLabel} cobre sua ${userLabel})`, positive: true };
    }
    if (best.score === 52) {
        return { score: 52, reason: `Mesma função que a sua (${playerLabel}) — vocês se sobrepõem`, positive: false };
    }
    return { score: best.score, reason: `Função compatível (${playerLabel})`, positive: true };
}

/* ============================================================
   6. COMMUNICATION — 10%
   Voice preference is the base; a shared language multiplies it.
   Someone who speaks nothing you speak cannot coordinate, however
   willing they are.
   ============================================================ */

export function calculateCommunicationCompatibility(player, criteria, userLanguages = []) {
    let base;
    let reason;
    let positive;

    const wantsVoice = criteria.voiceChat === true;
    const voiceIsIndifferent = criteria.voiceChat === 'any' || criteria.voiceChat === undefined;

    if (voiceIsIndifferent) {
        base = 82;
        reason = player.voiceChat ? 'Usa chat de voz' : 'Prefere apenas texto';
        positive = false;
    } else if (wantsVoice && player.voiceChat) {
        base = 100;
        reason = 'Ambos usam chat de voz';
        positive = true;
    } else if (!wantsVoice && !player.voiceChat) {
        base = 88;
        reason = 'Ambos preferem jogar sem voz';
        positive = true;
    } else if (wantsVoice && !player.voiceChat) {
        base = 25;
        reason = 'Não usa chat de voz';
        positive = false;
    } else {
        base = 70;
        reason = 'Usa chat de voz; você pediu apenas texto';
        positive = false;
    }

    if (userLanguages.length > 0) {
        const shared = player.languages.filter((language) => userLanguages.includes(language));
        if (shared.length === 0) {
            const names = player.languages.map((id) => labelOf(LANGUAGES, id)).join(', ');
            return {
                score: Math.round(base * 0.6),
                reason: `Nenhum idioma em comum (fala ${names})`,
                positive: false,
            };
        }
        if (positive) {
            const names = shared.map((id) => labelOf(LANGUAGES, id)).join(', ');
            return { score: base, reason: `${reason}, fala ${names}`, positive: true };
        }
    }

    return { score: base, reason, positive };
}

/* ============================================================
   7. REPUTATION — 10%
   Authored demo data, used directly. High reputation means the
   player has a history of good sessions.
   ============================================================ */

export function calculateReputacaoScore(player) {
    const reputation = Math.max(0, Math.min(100, Number(player.reputation) || 0));
    if (reputation >= 90) return { score: reputation, reason: `Reputação excepcional (${reputation})`, positive: true };
    if (reputation >= 80) return { score: reputation, reason: `Reputação alta (${reputation})`, positive: true };
    if (reputation >= 70) return { score: reputation, reason: `Reputação sólida (${reputation})`, positive: false };
    return { score: reputation, reason: `Reputação em construção (${reputation})`, positive: false };
}

/* ============================================================
   TOTAL
   ============================================================ */

export const TIERS = [
    { id: 'excellent', min: 90, label: 'Match Excelente' },
    { id: 'great', min: 75, label: 'Match Ótimo' },
    { id: 'good', min: 60, label: 'Match Bom' },
    { id: 'low', min: 0, label: 'Compatibilidade Baixa' },
];

export const tierFor = (total) => TIERS.find((tier) => total >= tier.min) ?? TIERS[TIERS.length - 1];

/**
 * @param {object} player   A record from PLAYERS.
 * @param {object} criteria The Buscar Squad search.
 * @param {object} [user]   The current passport (roles + languages).
 * @returns {{total:number, tier:object, breakdown:Array, highlights:Array, deductions:Array}}
 */
export function calculateTotalCompatibility(player, criteria, user = null) {
    const userRoles = user?.roles ?? [];
    const userLanguages = user?.languages ?? [];

    const parts = [
        { key: 'game', label: 'Jogo', weight: WEIGHTS.game, ...calculateGameCompatibility(player, criteria) },
        { key: 'rank', label: 'Rank', weight: WEIGHTS.rank, ...calculateRankCompatibility(player, criteria) },
        { key: 'schedule', label: 'Horário', weight: WEIGHTS.schedule, ...calculateScheduleCompatibility(player, criteria) },
        { key: 'playstyle', label: 'Estilo de jogo', weight: WEIGHTS.playstyle, ...calculatePlaystyleCompatibility(player, criteria) },
        { key: 'role', label: 'Função', weight: WEIGHTS.role, ...calculateRoleCompatibility(player, criteria, userRoles) },
        { key: 'communication', label: 'Comunicação', weight: WEIGHTS.communication, ...calculateCommunicationCompatibility(player, criteria, userLanguages) },
        { key: 'reputation', label: 'Reputação', weight: WEIGHTS.reputation, ...calculateReputacaoScore(player) },
    ];

    const breakdown = parts.map((part) => {
        const earned = (part.score / 100) * part.weight;
        return {
            ...part,
            earned: Math.round(earned * 10) / 10,
            lost: Math.round((part.weight - earned) * 10) / 10,
        };
    });

    const total = Math.round(breakdown.reduce((sum, part) => sum + part.earned, 0));

    return {
        total,
        tier: tierFor(total),
        breakdown,
        highlights: breakdown.filter((part) => part.positive),
        deductions: breakdown.filter((part) => part.lost >= 1.5).sort((a, b) => b.lost - a.lost),
    };
}

/* ============================================================
   SEARCH
   ============================================================ */

/**
 * Ranks the simulated player pool against a search.
 *
 * The pool is pre-filtered to players who are at least genre-adjacent
 * to the requested game, so results stay relevant. If that leaves too
 * few candidates, the full pool is used instead — an empty result set
 * would be a worse experience than a few honest low scores.
 */
export function findMatches(criteria, user = null, { limit = 8 } = {}) {
    const target = getGameById(criteria.gameId);

    const relevant = target
        ? PLAYERS.filter((player) => {
            if (player.games.includes(target.id)) return true;
            const genres = new Set(player.games.flatMap((id) => getGameById(id)?.genre ?? []));
            return target.genre.some((genre) => genres.has(genre));
        })
        : PLAYERS;

    const pool = relevant.length >= 4 ? relevant : PLAYERS;

    return pool
        .map((player) => ({ player, result: calculateTotalCompatibility(player, criteria, user) }))
        .sort((a, b) => {
            const byScore = b.result.total - a.result.total;
            if (byScore !== 0) return byScore;
            const byReputacao = b.player.reputation - a.player.reputation;
            if (byReputacao !== 0) return byReputacao;
            return a.player.id.localeCompare(b.player.id); // stable, deterministic
        })
        .slice(0, limit);
}
