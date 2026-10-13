/**
 * community.js — o motor da comunidade simulada.
 *
 * A RIVALY não tem outros usuários reais. Os outros jogadores são os
 * PLAYERS semeados em data.js, e tudo o que eles "fazem" (aceitar uma
 * candidatura, convidar você para um clã, desafiar você na Arena, postar
 * no Feed) é decidido aqui, por regras explícitas.
 *
 * Três princípios:
 *   1. Determinístico: os sorteios vêm de rng.js, semeados com o id do
 *      usuário, o id da entidade e a semana ISO. Nada de Math.random().
 *   2. Explicável: toda decisão devolve { decision, reasons[], score,
 *      threshold }. A interface mostra os motivos, inclusive o sorteio.
 *   3. Puro: este módulo não grava nada. Os *-store.js aplicam os efeitos.
 */

import {
    PLAYERS, RANK_LADDER, PLAYSTYLES, CLAN_CAPACITY, POST_TEMPLATES, ROLES,
    getGameById, getPlayerById, rankLabel,
} from './data.js';
import { calculateTotalCompatibility } from './compatibility.js';
import { rngFor, momentInWeek, isoWeek } from './rng.js';

const labelOf = (collection, id) => collection.find((item) => item.id === id)?.label ?? id;
const rankIndex = (rank) => Math.max(0, RANK_LADDER.indexOf(rank ?? 'Unranked'));
const playstyleIndex = (id) => PLAYSTYLES.findIndex((style) => style.id === id);

/** Identificador estável do usuário para as sementes. */
export const userSeed = (user) => user?.gamerId ?? user?.email ?? 'visitante';

/* ============================================================
   COMPATIBILIDADE A PARTIR DO PASSAPORTE
   O motor de 7 fatores compara uma busca com um jogador. Aqui a
   "busca" é o próprio Passaporte do usuário.
   ============================================================ */

export function criteriaFromUser(user, gameId = null) {
    return {
        gameId: gameId ?? user?.currentGames?.[0] ?? null,
        rank: user?.rank && user.rank !== 'Unranked' ? user.rank : 'any',
        schedule: user?.schedules?.[0] ?? 'any',
        playstyle: user?.playstyle || 'any',
        role: 'any',
        voiceChat: user?.voiceChat ?? 'any',
    };
}

/** Compatibilidade (0–100 e breakdown) entre o usuário e um jogador. */
export function compatibilityWith(player, user, gameId = null) {
    return calculateTotalCompatibility(player, criteriaFromUser(user, gameId), user);
}

/* ============================================================
   RATING DE ARENA DOS JOGADORES SEMEADOS
   Derivado do que o jogador declara, sempre igual:
     700  base
     +95  por degrau do rank (Sem rank = 0 ... Elite = 7)
     +5   por ponto de reputação acima de 60
     +40  × log10(partidas + 1)   (experiência, com retorno decrescente)
   ============================================================ */

export function seededRating(player) {
    const rankPart = rankIndex(player.rank) * 95;
    const repPart = (Number(player.reputation) - 60) * 5;
    const expPart = Math.round(Math.log10((Number(player.matches) || 0) + 1) * 40);
    const rating = Math.round(700 + rankPart + repPart + expPart);
    return {
        rating,
        breakdown: [
            { label: 'Base', value: 700 },
            { label: `Rank ${rankLabel(player.rank)} (${rankIndex(player.rank)} × 95)`, value: rankPart },
            { label: `Reputação ${player.reputation} ((rep − 60) × 5)`, value: repPart },
            { label: `${player.matches} partidas (40 × log10(n + 1))`, value: expPart },
        ],
    };
}

export const ratingOf = (playerId) => {
    const player = getPlayerById(playerId);
    return player ? seededRating(player).rating : 1000;
};

/* ============================================================
   CANDIDATURA A UM CLÃ
   ============================================================ */

/**
 * O clã avalia uma candidatura do usuário.
 *
 * @param {object} args
 * @param {object} args.clan          clã resolvido (com roster)
 * @param {object} args.user          Passaporte
 * @param {number} args.reputation    reputação calculada do usuário
 * @param {number} args.compatibility média de compatibilidade com o elenco
 * @param {string} args.message       texto da candidatura (já validado)
 * @param {string[]} args.userGames   jogos do usuário (Passaporte + Biblioteca)
 * @param {string} args.week          chave da semana ISO
 */
export function decideApplication({ clan, user, reputation, compatibility, message = '', userGames = [], week }) {
    const reasons = [];
    const hard = requirementChecks({ clan, user, reputation });
    reasons.push(...hard.map(({ ok, text }) => ({ ok, text })));

    if (hard.some((check) => !check.ok)) {
        return {
            decision: 'declined',
            reasons,
            score: 0,
            threshold: 65,
            summary: hard.find((check) => !check.ok).text,
        };
    }

    let score = compatibility;
    reasons.push({ ok: compatibility >= 55, text: `Compatibilidade média com o elenco: ${compatibility}%.`, points: compatibility });

    const sharedFocus = clan.focusGames.filter((id) => userGames.includes(id));
    if (sharedFocus.length > 0) {
        score += 10;
        reasons.push({ ok: true, text: `Você joga ${getGameById(sharedFocus[0])?.title}, um dos jogos foco do clã.`, points: 10 });
    } else {
        score -= 10;
        reasons.push({ ok: false, text: `Você não joga nenhum dos jogos foco (${clan.focusGames.map((id) => getGameById(id)?.title).join(', ')}).`, points: -10 });
    }

    const styleGap = Math.abs(playstyleIndex(user.playstyle || 'balanced') - playstyleIndex(clan.playstyle));
    if (styleGap <= 1) {
        score += 5;
        reasons.push({ ok: true, text: `Estilo de jogo próximo do clã (${labelOf(PLAYSTYLES, clan.playstyle)}).`, points: 5 });
    } else {
        score -= 10;
        reasons.push({ ok: false, text: `Estilos distantes: você joga ${labelOf(PLAYSTYLES, user.playstyle)}, o clã joga ${labelOf(PLAYSTYLES, clan.playstyle)}.`, points: -10 });
    }

    const text = message.toLowerCase();
    const mentionsFocus = clan.focusGames.some((id) => text.includes((getGameById(id)?.title ?? '').toLowerCase()))
        || text.includes(clan.tag.toLowerCase()) || text.includes(clan.name.toLowerCase());
    if (mentionsFocus) {
        score += 5;
        reasons.push({ ok: true, text: 'A mensagem fala do clã ou dos jogos foco.', points: 5 });
    }

    const mood = rngFor(userSeed(user), clan.id, week, 'application').int(-6, 6);
    score += mood;
    reasons.push({ ok: mood >= 0, text: `Avaliação do líder nesta semana (sorteio determinístico): ${mood >= 0 ? '+' : ''}${mood}.`, points: mood });

    const threshold = 65;
    const accepted = score >= threshold;
    reasons.push({ ok: accepted, text: `Nota final ${Math.round(score)}; o clã aceita a partir de ${threshold}.` });

    return {
        decision: accepted ? 'accepted' : 'declined',
        reasons,
        score: Math.round(score),
        threshold,
        summary: accepted
            ? `O [${clan.tag}] aceitou sua candidatura.`
            : `O [${clan.tag}] recusou por enquanto. Nota ${Math.round(score)} de ${threshold} necessários.`,
    };
}

/** Requisitos duros de um clã: rank, reputação e vaga. */
export function requirementChecks({ clan, user, reputation, rosterSize = clan.roster?.length ?? 0 }) {
    const userRank = user?.rank ?? 'Unranked';
    const rankOk = rankIndex(userRank) >= rankIndex(clan.minRank);
    const repOk = reputation >= clan.minReputation;
    const vacancy = CLAN_CAPACITY - rosterSize;

    return [
        {
            id: 'rank',
            ok: rankOk,
            text: rankOk
                ? `Seu rank (${rankLabel(userRank)}) cumpre o mínimo (${rankLabel(clan.minRank)}).`
                : `O clã exige rank ${rankLabel(clan.minRank)} ou superior. O seu é ${rankLabel(userRank)}.`,
        },
        {
            id: 'reputation',
            ok: repOk,
            text: repOk
                ? `Sua reputação (${reputation}) cumpre o mínimo de ${clan.minReputation}.`
                : `O clã pede reputação ${clan.minReputation} ou mais. A sua é ${reputation}.`,
        },
        {
            id: 'vacancy',
            ok: vacancy > 0,
            text: vacancy > 0
                ? `Há ${vacancy} ${vacancy === 1 ? 'vaga' : 'vagas'} no clã.`
                : `O clã está cheio (${rosterSize} de ${CLAN_CAPACITY}).`,
        },
    ];
}

/* ============================================================
   CONVITE ENVIADO PELO USUÁRIO
   O usuário (líder ou oficial) convida um jogador semeado.
   ============================================================ */

export function decideInviteResponse({ player, clan, user, relation = null, playerClan = null, week }) {
    const reasons = [];
    const threshold = 60;

    if (playerClan) {
        return {
            decision: 'declined', score: 0, threshold,
            reasons: [{ ok: false, text: `${player.nickname} já está no clã [${playerClan.tag}].` }],
            summary: `${player.nickname} recusou: já tem clã.`,
        };
    }

    const rosterSize = clan.roster?.length ?? 0;
    if (rosterSize >= CLAN_CAPACITY) {
        return {
            decision: 'declined', score: 0, threshold,
            reasons: [{ ok: false, text: `O seu clã está cheio (${rosterSize} de ${CLAN_CAPACITY}).` }],
            summary: 'Convite recusado: o clã está cheio.',
        };
    }

    if (rankIndex(player.rank) < rankIndex(clan.minRank)) {
        return {
            decision: 'declined', score: 0, threshold,
            reasons: [{ ok: false, text: `${player.nickname} tem rank ${rankLabel(player.rank)}, abaixo do mínimo do clã (${rankLabel(clan.minRank)}).` }],
            summary: `${player.nickname} não cumpre o rank mínimo do clã.`,
        };
    }

    const compat = compatibilityWith(player, user, clan.focusGames[0]).total;
    let score = compat;
    reasons.push({ ok: compat >= 55, text: `Compatibilidade de ${player.nickname} com você: ${compat}%.`, points: compat });

    const playsFocus = clan.focusGames.some((id) => player.games.includes(id));
    score += playsFocus ? 12 : -12;
    reasons.push(playsFocus
        ? { ok: true, text: `Joga um dos jogos foco do clã.`, points: 12 }
        : { ok: false, text: `Não joga nenhum dos jogos foco do clã.`, points: -12 });

    const styleGap = Math.abs(playstyleIndex(player.playstyle) - playstyleIndex(clan.playstyle));
    score += styleGap <= 1 ? 5 : -10;
    reasons.push(styleGap <= 1
        ? { ok: true, text: `Estilo parecido com o do clã.`, points: 5 }
        : { ok: false, text: `Estilo de jogo distante do clã (${labelOf(PLAYSTYLES, player.playstyle)}).`, points: -10 });

    if (relation === 'ally') {
        score += 15;
        reasons.push({ ok: true, text: `Vocês se marcaram como aliados.`, points: 15 });
    } else if (relation === 'rival') {
        score -= 5;
        reasons.push({ ok: false, text: `Vocês são rivais: ${player.nickname} prefere enfrentar você a jogar junto.`, points: -5 });
    }

    const mood = rngFor(userSeed(user), player.id, clan.id, week, 'invite').int(-8, 8);
    score += mood;
    reasons.push({ ok: mood >= 0, text: `Disposição de ${player.nickname} nesta semana (sorteio determinístico): ${mood >= 0 ? '+' : ''}${mood}.`, points: mood });

    const accepted = score >= threshold;
    reasons.push({ ok: accepted, text: `Nota final ${Math.round(score)}; aceita a partir de ${threshold}.` });

    return {
        decision: accepted ? 'accepted' : 'declined',
        score: Math.round(score),
        threshold,
        reasons,
        summary: accepted
            ? `${player.nickname} aceitou entrar no [${clan.tag}].`
            : `${player.nickname} recusou o convite por enquanto.`,
    };
}

/* ============================================================
   O OUTRO LADO TAMBÉM AGE
   Depois de uma sessão, um colega pode convidar o usuário para o
   clã dele. Regra: compatibilidade com você + seu desempenho na
   sessão + política e vagas do clã.
   ============================================================ */

export function decideTeammateClanInvite({ player, clan, user, reputation, performance, sessionId }) {
    const threshold = 72;
    const hard = requirementChecks({ clan, user, reputation });
    const failed = hard.find((check) => !check.ok);
    if (failed) {
        return {
            decision: 'no-invite', score: 0, threshold,
            reasons: [{ ok: false, text: failed.text }],
            summary: `${player.nickname} não pode convidar você agora: ${failed.text.charAt(0).toLowerCase()}${failed.text.slice(1)}`,
        };
    }

    const compat = compatibilityWith(player, user, clan.focusGames[0]).total;
    const policyBonus = { invite: 6, open: 0, application: -4 }[clan.policy] ?? 0;
    const luck = rngFor(userSeed(user), player.id, sessionId, 'teammate-invite').int(-6, 6);
    const score = Math.round(compat * 0.6 + performance * 0.4 + policyBonus + luck);

    const reasons = [
        { ok: compat >= 60, text: `Compatibilidade com você: ${compat}% (peso 0,6).`, points: Math.round(compat * 0.6) },
        { ok: performance >= 60, text: `Seu desempenho na sessão: ${performance} de 100 (peso 0,4).`, points: Math.round(performance * 0.4) },
        {
            ok: policyBonus >= 0,
            text: clan.policy === 'invite'
                ? `O [${clan.tag}] só recruta por convite, então os membros convidam mais (+${policyBonus}).`
                : clan.policy === 'application'
                    ? `O [${clan.tag}] prefere receber candidaturas (${policyBonus}).`
                    : `O [${clan.tag}] é aberto (+0).`,
            points: policyBonus,
        },
        { ok: luck >= 0, text: `Sorteio determinístico da sessão: ${luck >= 0 ? '+' : ''}${luck}.`, points: luck },
        { ok: score >= threshold, text: `Nota ${score}; ${player.nickname} convida a partir de ${threshold}.` },
    ];

    return {
        decision: score >= threshold ? 'invite' : 'no-invite',
        score,
        threshold,
        reasons,
        summary: score >= threshold
            ? `${player.nickname} convidou você para o [${clan.tag}].`
            : `${player.nickname} gostou da sessão, mas não fez convite desta vez.`,
    };
}

/* ============================================================
   DESAFIOS DA SEMANA
   Cada rival decide, uma vez por semana, se desafia você.
   ============================================================ */

export function weeklyChallengers({ user, relations, week, userRating = 1000 }) {
    const rivals = Object.entries(relations)
        .filter(([, relation]) => relation.type === 'rival')
        .map(([playerId]) => getPlayerById(playerId))
        .filter(Boolean);

    return rivals
        .map((player) => {
            const rating = seededRating(player).rating;
            const gap = Math.abs(rating - userRating);
            // Rating próximo deixa o duelo mais interessante para os dois.
            const probability = gap <= 200 ? 0.75 : gap <= 400 ? 0.55 : 0.35;
            const roll = rngFor(userSeed(user), player.id, week, 'challenge').next();
            return {
                player,
                rating,
                challenges: roll < probability,
                reasons: [
                    `Diferença de rating: ${gap} (chance de desafio ${Math.round(probability * 100)}%).`,
                    `Sorteio da semana: ${roll.toFixed(2)} ${roll < probability ? '<' : '≥'} ${probability.toFixed(2)}.`,
                ],
            };
        })
        .filter((entry) => entry.challenges)
        .slice(0, 3);
}

/* ============================================================
   FEED SIMULADO
   ============================================================ */

const COMMENT_LINES = [
    'GG. Bora jogar junto essa semana?',
    'Concordo demais.',
    'Quero revanche, hein.',
    'Isso aí. Respeito.',
    'Me chama na próxima.',
    'Anotado. Vou testar hoje.',
    'Essa call eu assino embaixo.',
];

function templatesFor(player, clan) {
    return POST_TEMPLATES.filter((template) => {
        if (template.styles && !template.styles.includes(player.playstyle)) return false;
        if (template.roles && !template.roles.some((role) => player.roles.includes(role))) return false;
        if (template.clan && !clan) return false;
        return true;
    });
}

/**
 * Posts dos jogadores semeados para uma semana. Mesma semana, mesmo
 * conteúdo, mesmos horários; quem consome esconde o que está no futuro.
 *
 * @param {object} args
 * @param {object} args.user
 * @param {string} args.weekKey
 * @param {Date}   args.start         segunda-feira da semana
 * @param {(playerId:string) => object|null} args.clanOf
 * @param {number} [args.count]
 */
export function simulatedPosts({ user, weekKey, start, clanOf, count = 12 }) {
    const rng = rngFor(userSeed(user), weekKey, 'feed');
    const authors = rng.shuffle(PLAYERS).slice(0, count);

    return authors.map((player, index) => {
        const clan = clanOf(player.id);
        const options = templatesFor(player, clan);
        const template = rng.pick(options.length ? options : POST_TEMPLATES.filter((t) => t.kind === 'casual'));
        const game = getGameById(rng.pick(player.games));
        const mate = PLAYERS.filter((other) => other.id !== player.id)[rng.int(0, PLAYERS.length - 2)];

        const text = template.text
            .replaceAll('{game}', game?.title ?? 'um jogo novo')
            .replaceAll('{rank}', rankLabel(player.rank))
            .replaceAll('{role}', labelOf(ROLES, player.roles[0]).toLowerCase())
            .replaceAll('{tag}', clan?.tag ?? '')
            .replaceAll('{mate}', mate.nickname);

        const commentCount = rng.int(0, 2);
        const comments = Array.from({ length: commentCount }, (_, c) => {
            const commenter = PLAYERS[(rng.int(0, PLAYERS.length - 1) + c) % PLAYERS.length];
            return {
                id: `sim-${weekKey}-${player.id}-c${c}`,
                authorId: commenter.id === player.id ? PLAYERS[(PLAYERS.indexOf(commenter) + 1) % PLAYERS.length].id : commenter.id,
                text: rng.pick(COMMENT_LINES),
                at: null, // preenchido depois do post
                simulated: true,
            };
        });

        const at = momentInWeek(rng, start);
        comments.forEach((comment, c) => {
            comment.at = new Date(new Date(at).getTime() + (c + 1) * rng.int(8, 90) * 60000).toISOString();
        });

        return {
            id: `sim-${weekKey}-${player.id}-${index}`,
            authorId: player.id,
            text,
            kind: template.kind,
            gameId: game?.id ?? null,
            at,
            simulated: true,
            baseReactions: {
                gg: rng.int(0, 14),
                respeito: rng.int(0, 9),
                rivalidade: template.kind === 'arena' || template.kind === 'mate' ? rng.int(1, 8) : rng.int(0, 3),
            },
            comments,
        };
    });
}

/* ============================================================
   CLÃS SEMEADOS: PONTOS DA SEMANA E XP
   ============================================================ */

/** Pontos que os membros semeados somaram na semana, até agora. */
export function simulatedClanWeekPoints(clan, weekKey, now = new Date()) {
    const memberIds = (clan.roster ?? []).map((entry) => entry.id).filter((id) => id !== 'self');
    const weekday = now.getDay() || 7; // segunda = 1
    const elapsed = Math.min(1, weekday / 7);
    return memberIds.reduce((sum, id) => {
        const weekly = rngFor(clan.id, id, weekKey, 'clan-week').int(20, 70);
        return sum + Math.round(weekly * elapsed);
    }, 0);
}

/** XP acumulado pelos membros semeados (estável: vem do rating deles). */
export function simulatedClanXp(clan) {
    const memberIds = (clan.roster ?? []).map((entry) => entry.id).filter((id) => id !== 'self');
    return memberIds.reduce((sum, id) => sum + Math.round(ratingOf(id) / 4), 0);
}

export const weekKeyNow = () => isoWeek().key;
