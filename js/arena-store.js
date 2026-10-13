/**
 * arena-store.js — regras da Arena.
 *
 * RATING (estilo Elo)
 *   expectativa  E = 1 / (1 + 10^((Rb − Ra) / 400))
 *   novo rating  R' = R + K × (S − E)      S = 1 vitória, 0 derrota
 *   K = 40 nas 10 primeiras partidas, 32 depois
 *   rating inicial: 1000
 *
 * RESULTADO
 *   Um número sorteado de forma determinística (rng.js) é comparado com
 *   a expectativa: sorteio < E → vitória. O modal mostra os dois números.
 *
 * TEMPORADA
 *   A semana ISO é a temporada. Na virada da semana a pontuação da
 *   temporada volta a zero; o rating geral continua.
 *   Pontos: vitória = 3, derrota = 1.
 */

import { ARENA_TIERS, PLAYERS, getPlayerById } from './data.js';
import { getArena, saveArena, getUser, getRelations, getSessions, saveSessions, getLibrary } from './storage.js';
import { seededRating, ratingOf, weeklyChallengers, userSeed } from './community.js';
import { allClans, myClan, clanStats, addClanContribution, clanOfPlayer } from './clans-store.js';
import { addInvite, registerInviteHandler, completeInvite, listInvites } from './invites.js';
import { awardXp, checkAchievements } from './gamification.js';
import { logActivity } from './activity.js';
import { rngFor, currentWeekKey } from './rng.js';

export const START_RATING = 1000;
export const SEASON_POINTS = { win: 3, loss: 1 };

/* ============================================================
   FÓRMULAS (puras)
   ============================================================ */

export const kFactor = (matches) => (matches < 10 ? 40 : 32);

export const expectedScore = (rating, opponentRating) =>
    1 / (1 + 10 ** ((opponentRating - rating) / 400));

/** Chance de vitória (0–1) pela expectativa Elo. */
export const calculateWinChance = (rating, opponentRating) => expectedScore(rating, opponentRating);

/** Quanto o rating sobe numa vitória e cai numa derrota. */
export function ratingDeltas(rating, opponentRating, matches) {
    const k = kFactor(matches);
    const expected = expectedScore(rating, opponentRating);
    return {
        k,
        expected,
        win: Math.round(k * (1 - expected)),
        loss: Math.round(k * (0 - expected)),
    };
}

/** R' = R + K × (S − E) */
export function updateRating(rating, opponentRating, matches, won) {
    const { k, expected } = ratingDeltas(rating, opponentRating, matches);
    const delta = Math.round(k * ((won ? 1 : 0) - expected));
    return { before: rating, after: Math.max(100, rating + delta), delta, k, expected };
}

export function tierFor(rating) {
    return [...ARENA_TIERS].reverse().find((tier) => rating >= tier.min) ?? ARENA_TIERS[0];
}

export function nextTier(rating) {
    return ARENA_TIERS.find((tier) => tier.min > rating) ?? null;
}

/** Progresso dentro do tier atual, para a barra. */
export function tierProgress(rating) {
    const tier = tierFor(rating);
    const next = nextTier(rating);
    if (!next) return { tier, next: null, percent: 100, remaining: 0 };
    const span = next.min - tier.min;
    return {
        tier,
        next,
        percent: Math.min(100, Math.max(0, ((rating - tier.min) / span) * 100)),
        remaining: next.min - rating,
    };
}

/* ============================================================
   ESTADO DO USUÁRIO (com virada de temporada)
   ============================================================ */

export function arenaState() {
    const arena = getArena();
    const week = currentWeekKey();
    if (arena.season?.week !== week) {
        arena.season = { week, points: 0, wins: 0, losses: 0 };
        saveArena(arena);
    }
    return arena;
}

/** Temporada simulada de um jogador semeado (pontos até agora). */
export function seededSeason(player, week = currentWeekKey(), now = new Date()) {
    const rng = rngFor(player.id, week, 'season');
    const rating = seededRating(player).rating;
    const weekday = now.getDay() || 7;
    const played = Math.round(rng.int(4, 14) * (weekday / 7));
    // Quem tem rating maior vence mais, mas ninguém vence sempre.
    const winRate = Math.min(0.78, Math.max(0.28, 0.5 + (rating - 1200) / 1600));
    let wins = 0;
    for (let i = 0; i < played; i += 1) if (rng.next() < winRate) wins += 1;
    const losses = played - wins;
    return { wins, losses, points: wins * SEASON_POINTS.win + losses * SEASON_POINTS.loss };
}

/* ============================================================
   ADVERSÁRIOS E PRÉVIAS
   ============================================================ */

/** Adversários de duelo: rivais primeiro, depois rating mais próximo. */
export function duelOpponents() {
    const arena = arenaState();
    const relations = getRelations();
    return PLAYERS.map((player) => {
        const rating = seededRating(player).rating;
        return {
            player,
            rating,
            tier: tierFor(rating),
            isRival: relations[player.id]?.type === 'rival',
            isAlly: relations[player.id]?.type === 'ally',
            chance: calculateWinChance(arena.rating, rating),
            clan: clanOfPlayer(player.id),
        };
    }).sort((a, b) => (Number(b.isRival) - Number(a.isRival))
        || Math.abs(a.rating - arena.rating) - Math.abs(b.rating - arena.rating));
}

function preview({ mode, opponent, myRating, opponentRating, extraReasons = [] }) {
    const arena = arenaState();
    const deltas = ratingDeltas(myRating, opponentRating, arena.matches);
    return {
        mode,
        opponent,
        myRating,
        opponentRating,
        userRating: arena.rating,
        chance: deltas.expected,
        k: deltas.k,
        winDelta: deltas.win,
        lossDelta: deltas.loss,
        reasons: [
            ...extraReasons,
            `Expectativa: 1 / (1 + 10^((${opponentRating} − ${myRating}) / 400)) = ${(deltas.expected * 100).toFixed(1)}%.`,
            `K = ${deltas.k} (${arena.matches < 10 ? `partida ${arena.matches + 1} de 10 com K maior` : 'depois das 10 primeiras partidas'}).`,
            `Vitória: ${deltas.k} × (1 − ${deltas.expected.toFixed(3)}) = +${deltas.win}. Derrota: ${deltas.k} × (0 − ${deltas.expected.toFixed(3)}) = ${deltas.loss}.`,
        ],
    };
}

export function previewDuel(playerId) {
    const player = getPlayerById(playerId);
    if (!player) return null;
    const arena = arenaState();
    const opponentRating = seededRating(player).rating;
    return preview({
        mode: 'duel',
        opponent: { type: 'player', id: player.id, name: player.nickname, rating: opponentRating },
        myRating: arena.rating,
        opponentRating,
    });
}

/** Sessões de squad que ainda podem ir para a Arena. */
export const arenaReadySessions = () => getSessions().filter((session) => !session.arenaPlayed).slice(0, 6);

export function previewSquadMatch(sessionId) {
    const session = getSessions().find((item) => item.id === sessionId);
    if (!session) return null;
    const arena = arenaState();
    const teamRatings = [arena.rating, ...session.teammates.map(ratingOf)];
    const teamRating = Math.round(teamRatings.reduce((sum, value) => sum + value, 0) / teamRatings.length);
    const offset = rngFor(userSeed(getUser()), session.id, 'arena-opponent').int(-120, 120);
    const opponentRating = teamRating + offset;
    const names = session.teammates.map((id) => getPlayerById(id)?.nickname).filter(Boolean);
    return preview({
        mode: 'squad',
        opponent: { type: 'squad', id: `opp-${session.id}`, name: 'Squad adversário', rating: opponentRating },
        myRating: teamRating,
        opponentRating,
        session,
        extraReasons: [
            `Rating do seu squad: média de você (${arena.rating}) e ${names.join(', ')} = ${teamRating}.`,
            `Adversário sorteado para esta sessão: ${offset >= 0 ? '+' : ''}${offset} em relação ao seu squad = ${opponentRating}.`,
        ],
    });
}

export function previewClanMatch(clanId) {
    const mine = myClan();
    const theirs = allClans().find((clan) => clan.id === clanId);
    if (!mine || !theirs || mine.id === theirs.id) return null;
    const myTop = clanStats(mine).top3Rating;
    const theirTop = clanStats(theirs).top3Rating;
    return preview({
        mode: 'clan',
        opponent: { type: 'clan', id: theirs.id, name: theirs.name, tag: theirs.tag, rating: theirTop },
        myRating: myTop,
        opponentRating: theirTop,
        extraReasons: [
            `[${mine.tag}]: média dos 3 melhores ratings = ${myTop}.`,
            `[${theirs.tag}]: média dos 3 melhores ratings = ${theirTop}.`,
        ],
    });
}

/* ============================================================
   JOGAR
   ============================================================ */

function scoreLine(rng, won) {
    // Melhor de cinco: quem vence fecha em 3.
    const loserGames = rng.int(0, 2);
    return won ? `3 × ${loserGames}` : `${loserGames} × 3`;
}

/**
 * Resolve uma partida a partir de uma prévia e aplica todos os efeitos:
 * rating, temporada, histórico, XP, atividade, clã e conquistas.
 */
function resolveMatch(prev, { challengeId = null, sessionId = null } = {}) {
    const arena = arenaState();
    const user = getUser();
    const rng = rngFor(userSeed(user), 'arena', arena.matches, prev.mode, prev.opponent.id, arena.season.week);
    const draw = rng.next();
    const won = draw < prev.chance;

    // Squad e Clã vs Clã comparam médias. A expectativa só depende da
    // diferença entre os ratings, então aplicar a mesma diferença sobre o
    // rating do usuário dá exatamente o ganho/perda mostrado na prévia.
    const { after, delta } = updateRating(arena.rating, arena.rating + (prev.opponentRating - prev.myRating), arena.matches, won);

    const match = {
        id: `m-${Date.now().toString(36)}-${arena.matches}`,
        mode: prev.mode,
        at: new Date().toISOString(),
        week: arena.season.week,
        opponent: prev.opponent,
        myRating: prev.myRating,
        opponentRating: prev.opponentRating,
        rating: { before: arena.rating, after, delta },
        expected: prev.chance,
        k: prev.k,
        draw,
        won,
        score: scoreLine(rng, won),
        reasons: [
            ...prev.reasons,
            `Sorteio determinístico: ${draw.toFixed(3)} ${won ? '<' : '≥'} ${prev.chance.toFixed(3)} → ${won ? 'vitória' : 'derrota'}.`,
            `Rating: ${arena.rating} ${delta >= 0 ? '+' : '−'} ${Math.abs(delta)} = ${after}.`,
        ],
        challengeId,
        sessionId,
    };

    const season = {
        ...arena.season,
        wins: arena.season.wins + (won ? 1 : 0),
        losses: arena.season.losses + (won ? 0 : 1),
        points: arena.season.points + (won ? SEASON_POINTS.win : SEASON_POINTS.loss),
    };

    saveArena({
        ...arena,
        rating: after,
        peak: Math.max(arena.peak ?? START_RATING, after),
        matches: arena.matches + 1,
        wins: arena.wins + (won ? 1 : 0),
        losses: arena.losses + (won ? 0 : 1),
        season,
        history: [match, ...arena.history],
    });

    if (challengeId) completeInvite(challengeId);
    if (sessionId) {
        saveSessions(getSessions().map((session) => (session.id === sessionId ? { ...session, arenaPlayed: true, arenaMatchId: match.id } : session)));
    }

    const label = prev.opponent.type === 'clan' ? `[${prev.opponent.tag}] ${prev.opponent.name}` : prev.opponent.name;
    const modeLabel = { duel: 'Duelo', squad: 'Squad', clan: 'Clã vs Clã' }[prev.mode];
    logActivity('arena', `${won ? 'Venceu' : 'Perdeu'} na Arena (${modeLabel}) contra ${label}: ${match.score}, rating ${after}`, {
        xp: won ? 90 : 35, matchId: match.id, won,
    });

    awardXp(won ? 'arenaWin' : 'arenaMatch', { silent: true });
    addClanContribution(won ? (prev.mode === 'clan' ? 40 : 20) : 5, { xp: won ? 40 : 8 });
    checkAchievements({ achievementContext: won ? `${modeLabel} contra ${label}` : '' });

    return match;
}

export function playDuel(playerId, options = {}) {
    const prev = previewDuel(playerId);
    return prev ? resolveMatch(prev, options) : null;
}

export function playSquadMatch(sessionId) {
    const prev = previewSquadMatch(sessionId);
    return prev ? resolveMatch(prev, { sessionId }) : null;
}

export function playClanMatch(clanId) {
    const prev = previewClanMatch(clanId);
    return prev ? resolveMatch(prev) : null;
}

export const matchHistory = () => arenaState().history;

/* ============================================================
   RANKING
   ============================================================ */

function userPlaysGame(gameId) {
    if (!gameId) return true;
    const user = getUser();
    return (user?.currentGames ?? []).includes(gameId) || getLibrary().some((entry) => entry.gameId === gameId);
}

/**
 * @param {{ tab?: 'players'|'clans', gameId?: string }} options
 * @returns {Array} linhas ordenadas por pontos da temporada e, no empate, rating
 */
export function renderRankingData({ tab = 'players', gameId = '' } = {}) {
    const week = currentWeekKey();

    if (tab === 'clans') {
        return allClans()
            .filter((clan) => !gameId || clan.focusGames.includes(gameId))
            .map((clan) => {
                const stats = clanStats(clan);
                return {
                    id: clan.id,
                    clan,
                    isMine: clan.roster.some((entry) => entry.id === 'self'),
                    rating: stats.top3Rating,
                    points: stats.weekPoints,
                    wins: stats.seasonWins,
                    members: clan.roster.length,
                };
            })
            .sort((a, b) => b.points - a.points || b.rating - a.rating)
            .map((row, index) => ({ ...row, position: index + 1 }));
    }

    const arena = arenaState();
    const user = getUser();
    const rows = PLAYERS
        .filter((player) => !gameId || player.games.includes(gameId))
        .map((player) => {
            const season = seededSeason(player, week);
            const rating = seededRating(player).rating;
            return { id: player.id, player, isMe: false, rating, tier: tierFor(rating), ...season, clan: clanOfPlayer(player.id) };
        });

    if (userPlaysGame(gameId)) {
        rows.push({
            id: 'self',
            player: null,
            nickname: user?.nickname ?? 'Você',
            isMe: true,
            rating: arena.rating,
            tier: tierFor(arena.rating),
            wins: arena.season.wins,
            losses: arena.season.losses,
            points: arena.season.points,
            clan: myClan(),
        });
    }

    return rows
        .sort((a, b) => b.points - a.points || b.rating - a.rating)
        .map((row, index) => ({ ...row, position: index + 1 }));
}

/* ============================================================
   DESAFIOS RECEBIDOS
   ============================================================ */

/** Gera (uma vez por semana) os desafios dos rivais. Idempotente. */
export function ensureWeeklyChallenges() {
    const week = currentWeekKey();
    const user = getUser();
    if (!user) return [];
    const challengers = weeklyChallengers({ user, relations: getRelations(), week, userRating: arenaState().rating });
    return challengers.map(({ player, rating, reasons }) => addInvite({
        id: `ch-${week}-${player.id}`,
        kind: 'arena-challenge',
        playerId: player.id,
        rating,
        reasons,
    }));
}

export const pendingChallenges = () =>
    listInvites().filter((invite) => invite.kind === 'arena-challenge' && invite.status === 'pending');

registerInviteHandler('arena-challenge', {
    // Aceitar abre a prévia do duelo; o convite só fecha quando a partida é jogada.
    accept(invite) {
        const player = getPlayerById(invite.playerId);
        if (!player) return { ok: false, reason: 'Esse jogador não está mais disponível.' };
        return { ok: true, keepPending: true, duel: { playerId: player.id, challengeId: invite.id } };
    },
});
