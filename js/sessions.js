/**
 * sessions.js — sessões de squad e a avaliação pós-partida.
 *
 * Uma sessão é uma partida simulada que o usuário joga com 2 a 4
 * jogadores semeados. O resultado não é sorteado do nada:
 *
 *   FORÇA DE CADA JOGADOR
 *     poder = degrau do rank × 10 + reputação × 0,5
 *
 *   FORÇA DO SQUAD
 *     média dos poderes + química
 *     química = (compatibilidade média com você − 60) × 0,3
 *
 *   ADVERSÁRIO
 *     força do squad + desvio sorteado entre −12 e +12
 *
 *   CHANCE
 *     p = 1 / (1 + e^(−(nós − eles) / 6))
 *     sorteio determinístico < p → vitória
 *
 * O desempenho individual (0–100) define quem se destacou e entra na
 * regra que decide se algum colega convida você para o clã dele.
 */

import {
    RANK_LADDER, PRAISES, RELATION_TYPES, getPlayerById, getGameById,
} from './data.js';
import { getSessions, saveSessions, getRelations, saveRelations, getUser } from './storage.js';
import { findMatches } from './compatibility.js';
import { compatibilityWith, decideTeammateClanInvite, userSeed } from './community.js';
import { clanOfPlayer, myClan, addClanContribution } from './clans-store.js';
import { addInvite } from './invites.js';
import { awardXp, awardOnceFor, buildContext, checkAchievements } from './gamification.js';
import { logActivity } from './activity.js';
import { rngFor, currentWeekKey } from './rng.js';

export const MIN_TEAMMATES = 2;
export const MAX_TEAMMATES = 4;

const rankStep = (rank) => Math.max(0, RANK_LADDER.indexOf(rank ?? 'Unranked'));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** poder = degrau do rank × 10 + reputação × 0,5 */
export const playerPower = (rank, reputation) => rankStep(rank) * 10 + reputation * 0.5;

/* ============================================================
   PLACAR POR TIPO DE JOGO
   Só a forma de mostrar muda; o resultado vem da chance.
   ============================================================ */

const SCORE_FORMATS = {
    rounds: { games: ['valorant', 'cs2'], unit: 'rounds', make: (rng, won) => (won ? [13, rng.int(4, 11)] : [rng.int(4, 11), 13]) },
    goals: { games: ['rocket-league', 'fifa', 'nba2k'], unit: 'gols', make: (rng, won) => { const w = rng.int(2, 5); const l = rng.int(0, w - 1); return won ? [w, l] : [l, w]; } },
    kills: { games: ['lol', 'dota2'], unit: 'abates', make: (rng, won) => { const w = rng.int(22, 38); const l = rng.int(10, w - 4); return won ? [w, l] : [l, w]; } },
    maps: { games: ['overwatch2', 'age4'], unit: 'mapas', make: (rng, won) => { const l = rng.int(0, 1); return won ? [2, l] : [l, 2]; } },
    placement: { games: ['fortnite', 'apex'], unit: 'colocação', make: (rng, won) => (won ? [1, 20] : [rng.int(2, 9), 20]) },
    objectives: { games: [], unit: 'objetivos', make: (rng, won) => { const l = rng.int(0, 2); return won ? [3, l] : [l, 3]; } },
};

function formatFor(gameId) {
    return Object.values(SCORE_FORMATS).find((format) => format.games.includes(gameId)) ?? SCORE_FORMATS.objectives;
}

export function scoreLabel(score) {
    if (score.unit === 'colocação') return score.us === 1 ? 'Top 1 de 20' : `Top ${score.us} de 20`;
    return `${score.us} × ${score.them} ${score.unit}`;
}

/* ============================================================
   FORÇA DO SQUAD (pura)
   ============================================================ */

export function squadStrength({ user, reputation, teammates, gameId }) {
    const members = [
        { id: 'self', name: user?.nickname ?? 'Você', power: playerPower(user?.rank, reputation) },
        ...teammates.map((player) => ({ id: player.id, name: player.nickname, power: playerPower(player.rank, player.reputation) })),
    ];
    const average = members.reduce((sum, member) => sum + member.power, 0) / members.length;
    const compat = teammates.map((player) => compatibilityWith(player, user, gameId).total);
    const avgCompat = compat.length ? compat.reduce((sum, value) => sum + value, 0) / compat.length : 60;
    const chemistry = (avgCompat - 60) * 0.3;
    return {
        members,
        average: Math.round(average * 10) / 10,
        avgCompat: Math.round(avgCompat),
        chemistry: Math.round(chemistry * 10) / 10,
        total: Math.round((average + chemistry) * 10) / 10,
    };
}

/* ============================================================
   SQUAD ALEATÓRIO
   Sorteio determinístico, ponderado pela compatibilidade ao quadrado:
   quem combina mais tem muito mais chance, mas não é garantido.
   ============================================================ */

export function randomSquad(criteria, user = getUser(), size = 3) {
    const pool = findMatches(criteria, user, { limit: 12 });
    const week = currentWeekKey();
    const sessionsThisWeek = getSessions().filter((session) => session.week === week).length;
    const rng = rngFor(userSeed(user), week, sessionsThisWeek, criteria.gameId, 'random-squad');
    const total = pool.reduce((sum, match) => sum + match.result.total ** 2, 0) || 1;
    const picked = rng.weightedSample(pool, (match) => match.result.total ** 2, size);
    return picked.map((match) => ({
        player: match.player,
        compatibility: match.result.total,
        weight: Math.round(((match.result.total ** 2) / total) * 1000) / 10,
    }));
}

/* ============================================================
   JOGAR UMA SESSÃO
   ============================================================ */

/**
 * @param {{ gameId:string, teammateIds:string[], mode?:'chosen'|'random' }} args
 * @returns {{ ok:boolean, session?:object, reason?:string }}
 */
export function playSession({ gameId, teammateIds, mode = 'chosen' }) {
    const unique = [...new Set(teammateIds)];
    if (unique.length < MIN_TEAMMATES || unique.length > MAX_TEAMMATES) {
        return { ok: false, reason: `Escolha de ${MIN_TEAMMATES} a ${MAX_TEAMMATES} jogadores para formar o squad.` };
    }
    const teammates = unique.map(getPlayerById).filter(Boolean);
    if (teammates.length !== unique.length) return { ok: false, reason: 'Algum jogador escolhido não existe mais.' };
    const game = getGameById(gameId);
    if (!game) return { ok: false, reason: 'Escolha um jogo para a sessão.' };

    const context = buildContext();
    const user = context.user;
    const week = currentWeekKey();
    const index = getSessions().filter((session) => session.week === week).length;
    const rng = rngFor(userSeed(user), week, index, gameId, [...unique].sort().join(','), 'session');

    const strength = squadStrength({ user, reputation: context.reputation, teammates, gameId });
    const offset = rng.int(-12, 12);
    const opponent = Math.round((strength.total + offset) * 10) / 10;
    const chance = 1 / (1 + Math.exp(-(strength.total - opponent) / 6));
    const draw = rng.next();
    const won = draw < chance;

    const [us, them] = formatFor(gameId).make(rng, won);
    const score = { us, them, unit: formatFor(gameId).unit };

    // Desempenho individual: o poder relativo ao squad mais uma variação.
    const performance = {};
    strength.members.forEach((member) => {
        const noise = rng.int(-15, 15);
        performance[member.id] = clamp(Math.round(55 + (member.power - strength.average) * 1.2 + noise + (won ? 6 : -4)), 12, 98);
    });
    const standoutId = Object.entries(performance).sort((a, b) => b[1] - a[1])[0][0];

    const session = {
        id: `s-${Date.now().toString(36)}-${index}`,
        gameId,
        mode,
        teammates: unique,
        at: new Date().toISOString(),
        week,
        index,
        won,
        score,
        strength: {
            ...strength,
            opponent,
            offset,
            chance: Math.round(chance * 1000) / 1000,
            draw: Math.round(draw * 1000) / 1000,
        },
        performance,
        standoutId,
        ratings: {},
        clanInvite: null,
        arenaPlayed: false,
    };

    // O outro lado também age: algum colega convida você para o clã dele?
    session.clanInvite = evaluateTeammateInvites(session, context);

    saveSessions([session, ...getSessions()]);

    const names = teammates.map((player) => player.nickname).join(', ');
    logActivity('session', `${won ? 'Venceu' : 'Perdeu'} uma sessão de ${game.title} com ${names} (${scoreLabel(score)})`, {
        xp: 120, sessionId: session.id,
    });
    awardXp('squadSession', { silent: true });
    addClanContribution(10, { xp: 15 });

    if (session.clanInvite?.invited) {
        const { playerId, clanId, decision } = session.clanInvite;
        addInvite({
            id: `ci-${session.id}-${playerId}`,
            kind: 'clan-invite',
            clanId,
            playerId,
            sessionId: session.id,
            decision,
        });
        const clan = clanOfPlayer(playerId);
        logActivity('invite', `${getPlayerById(playerId)?.nickname} convidou você para o [${clan?.tag}]`, { clanId, playerId });
    }

    checkAchievements({ achievementContext: `${game.title} · ${scoreLabel(score)}` });
    return { ok: true, session };
}

/** Avalia, colega a colega, quem convidaria você. Fica a melhor nota. */
function evaluateTeammateInvites(session, context) {
    if (myClan()) {
        return { invited: false, summary: 'Você já está em um clã, então ninguém fez convite.', evaluations: [] };
    }

    const evaluations = session.teammates
        .map((playerId) => {
            const player = getPlayerById(playerId);
            const clan = clanOfPlayer(playerId);
            if (!clan) return null;
            const decision = decideTeammateClanInvite({
                player,
                clan,
                user: context.user,
                reputation: context.reputation,
                performance: session.performance.self,
                sessionId: session.id,
            });
            return { playerId, clanId: clan.id, tag: clan.tag, decision };
        })
        .filter(Boolean)
        .sort((a, b) => b.decision.score - a.decision.score);

    if (evaluations.length === 0) {
        return { invited: false, summary: 'Ninguém deste squad tem clã para convidar você.', evaluations: [] };
    }

    const winner = evaluations.find((entry) => entry.decision.decision === 'invite');
    if (winner) {
        return { invited: true, playerId: winner.playerId, clanId: winner.clanId, decision: winner.decision, summary: winner.decision.summary, evaluations };
    }
    return { invited: false, summary: evaluations[0].decision.summary, decision: evaluations[0].decision, playerId: evaluations[0].playerId, evaluations };
}

export const getSession = (sessionId) => getSessions().find((session) => session.id === sessionId) ?? null;
export const recentSessions = (limit = 5) => getSessions().slice(0, limit);

/* ============================================================
   PÓS-PARTIDA: ALIADO, RIVAL OU NEUTRO
   ============================================================ */

/**
 * @param {string} sessionId
 * @param {string} playerId
 * @param {{ relation:'ally'|'rival'|'neutral', praises?:string[] }} rating
 */
export function ratePlayer(sessionId, playerId, { relation, praises = [], silent = false }) {
    const player = getPlayerById(playerId);
    if (!player || !RELATION_TYPES[relation]) return { ok: false, reason: 'Escolha Aliado, Rival ou Neutro.' };
    const validPraises = praises.filter((id) => PRAISES.some((praise) => praise.id === id));

    const sessions = getSessions();
    const index = sessions.findIndex((session) => session.id === sessionId);
    const alreadyRated = index >= 0 && Boolean(sessions[index].ratings?.[playerId]);
    if (index >= 0) {
        sessions[index] = { ...sessions[index], ratings: { ...sessions[index].ratings, [playerId]: { relation, praises: validPraises } } };
        saveSessions(sessions);
    }

    const relations = getRelations();
    const previous = relations[playerId];
    const praiseCounts = { ...(previous?.praises ?? {}) };
    validPraises.forEach((id) => { praiseCounts[id] = (praiseCounts[id] ?? 0) + 1; });

    relations[playerId] = {
        type: relation,
        praises: praiseCounts,
        sessions: (previous?.sessions ?? 0) + (index >= 0 && !alreadyRated ? 1 : 0),
        updatedAt: new Date().toISOString(),
    };
    saveRelations(relations);

    if (relation !== 'neutral' && previous?.type !== relation) {
        const label = RELATION_TYPES[relation].label.toLowerCase();
        logActivity('relation', `Marcou ${player.nickname} como ${label}`, { playerId, relation });
        awardOnceFor(relation === 'ally' ? 'markAlly' : 'markRival', playerId, {
            detail: relation === 'ally' ? `${player.nickname} é seu aliado` : `${player.nickname} é seu rival`,
            silent,
        });
        checkAchievements();
    }

    return { ok: true, relation: relations[playerId] };
}

/** Aliados e rivais do usuário, com o jogador resolvido. */
export function relationList(type = null) {
    return Object.entries(getRelations())
        .filter(([, relation]) => !type || relation.type === type)
        .map(([playerId, relation]) => ({ player: getPlayerById(playerId), ...relation }))
        .filter((entry) => entry.player);
}

export const relationOf = (playerId) => getRelations()[playerId]?.type ?? null;

export const relationCounts = () => {
    const all = Object.values(getRelations());
    return {
        allies: all.filter((relation) => relation.type === 'ally').length,
        rivals: all.filter((relation) => relation.type === 'rival').length,
    };
};
