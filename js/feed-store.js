/**
 * feed-store.js — o Feed como uma fonte única.
 *
 * Junta, em ordem de data:
 *   - a atividade do próprio usuário (activity.js): biblioteca, conquistas,
 *     nível, DNA, sessões, Arena, clã e convites;
 *   - os posts do usuário;
 *   - os posts simulados dos jogadores semeados (community.js), que são
 *     determinísticos por semana e vão aparecendo conforme os dias passam.
 *
 * Reações (GG, Respeito, Rivalidade) e comentários são do usuário e ficam
 * no storage. Os números que vêm "da comunidade" são simulados e o Feed
 * diz isso na tela.
 */

import { REACTIONS, FEED_DAILY_XP_LIMIT, getPlayerById } from './data.js';
import { getFeed, saveFeed, getActivity, getUser, getRelations, LIMITS } from './storage.js';
import { simulatedPosts } from './community.js';
import { allClans, myClan, addClanContribution } from './clans-store.js';
import { awardXp, checkAchievements } from './gamification.js';
import { rngFor, currentWeekKey, weekStart, previousWeek } from './rng.js';
import {
    validateValue, required, maxLength, noHtml, notBlank, sanitizeText,
} from './validation.js';

export const POST_MAX = 280;
export const COMMENT_MAX = 140;

export const FEED_TABS = [
    { id: 'all', label: 'Tudo' },
    { id: 'clan', label: 'Meu clã' },
    { id: 'allies', label: 'Aliados' },
    { id: 'rivals', label: 'Rivais' },
    { id: 'arena', label: 'Arena' },
];

export const postRules = () => [
    notBlank('O post não pode ter só espaços. Escreva uma frase.'),
    required('Escreva algo antes de publicar.'),
    maxLength(POST_MAX, `Use no máximo ${POST_MAX} caracteres.`),
    noHtml(),
];

export const commentRules = () => [
    notBlank('O comentário não pode ter só espaços.'),
    required('Escreva o comentário antes de enviar.'),
    maxLength(COMMENT_MAX, `Use no máximo ${COMMENT_MAX} caracteres.`),
    noHtml(),
];

/* ============================================================
   AGREGAÇÃO
   ============================================================ */

// Entrar na conta é ruído, e "publicou no Feed" já é o próprio post.
const HIDDEN_ACTIVITY = new Set(['account', 'feed']);

function authorOf(id, clanIndex) {
    if (id === 'self') {
        const user = getUser();
        return { id: 'self', name: user?.nickname ?? 'Você', clan: myClan(), isSelf: true };
    }
    const player = getPlayerById(id);
    return { id, name: player?.nickname ?? 'Jogador', clan: clanIndex(id), isSelf: false, player };
}

/** Reações que a comunidade simulada deixou num post do usuário (crescem com o tempo). */
function communityReactionsFor(post) {
    const minutes = Math.max(0, (Date.now() - new Date(post.at).getTime()) / 60000);
    const rng = rngFor(post.id, 'community-reactions');
    const growth = Math.min(1, minutes / 360);
    return {
        gg: Math.floor(rng.int(2, 9) * growth),
        respeito: Math.floor(rng.int(1, 6) * growth),
        rivalidade: Math.floor(rng.int(0, 3) * growth),
    };
}

/**
 * Monta o Feed completo, mais recente primeiro.
 * @returns {Array<object>}
 */
export function buildFeed() {
    const user = getUser();
    const feed = getFeed();
    const clans = allClans();
    const clanIndex = (playerId) => clans.find((clan) => clan.roster.some((entry) => entry.id === playerId)) ?? null;
    const relations = getRelations();
    const now = Date.now();

    const thisWeek = { key: currentWeekKey(), start: weekStart() };
    const last = previousWeek();
    const simulated = [
        ...simulatedPosts({ user, weekKey: last.key, start: last.start, clanOf: clanIndex, count: 8 }),
        ...simulatedPosts({ user, weekKey: thisWeek.key, start: thisWeek.start, clanOf: clanIndex, count: 12 }),
    ].filter((post) => new Date(post.at).getTime() <= now);

    const toPost = (post, base) => {
        const mine = feed.reactions[post.id] ?? [];
        const counts = Object.fromEntries(REACTIONS.map((reaction) => [
            reaction.id,
            (base[reaction.id] ?? 0) + (mine.includes(reaction.id) ? 1 : 0),
        ]));
        const comments = [...(post.comments ?? []), ...(feed.comments[post.id] ?? [])]
            .filter((comment) => new Date(comment.at).getTime() <= now)
            .sort((a, b) => new Date(a.at) - new Date(b.at))
            .map((comment) => ({ ...comment, author: authorOf(comment.authorId, clanIndex) }));

        const author = authorOf(post.authorId, clanIndex);
        return {
            id: post.id,
            type: 'post',
            kind: post.kind ?? 'user',
            text: post.text,
            at: post.at,
            gameId: post.gameId ?? null,
            simulated: Boolean(post.simulated),
            author,
            relation: post.authorId === 'self' ? null : relations[post.authorId]?.type ?? null,
            reactions: counts,
            myReactions: mine,
            comments,
        };
    };

    const posts = [
        ...feed.posts.map((post) => toPost(post, communityReactionsFor(post))),
        ...simulated.map((post) => toPost(post, post.baseReactions)),
    ];

    const activity = getActivity()
        .filter((entry) => !HIDDEN_ACTIVITY.has(entry.type))
        .map((entry) => ({
            id: entry.id,
            type: 'activity',
            kind: entry.type,
            text: entry.message,
            at: entry.at,
            author: authorOf('self', clanIndex),
            meta: entry.meta ?? {},
        }));

    return [...posts, ...activity].sort((a, b) => new Date(b.at) - new Date(a.at));
}

/**
 * Filtra os itens do Feed por aba.
 * @param {Array} items  saída de buildFeed()
 * @param {string} tab   all | clan | allies | rivals | arena
 */
export function filterFeed(items, tab) {
    const clan = myClan();
    const clanIds = new Set(clan ? clan.roster.map((entry) => entry.id) : []);

    switch (tab) {
        case 'clan':
            return clan
                ? items.filter((item) => (item.type === 'post' && clanIds.has(item.author.id)) || (item.type === 'activity' && item.kind === 'clan'))
                : [];
        case 'allies':
            return items.filter((item) => item.type === 'post' && item.relation === 'ally');
        case 'rivals':
            return items.filter((item) => item.type === 'post' && item.relation === 'rival');
        case 'arena':
            return items.filter((item) => (item.type === 'activity' && item.kind === 'arena') || (item.type === 'post' && item.kind === 'arena'));
        default:
            return items;
    }
}

/**
 * Junta atividades seguidas do usuário num bloco só, para os posts da
 * comunidade não sumirem embaixo de uma sequência de "você fez X".
 * Uma atividade isolada continua sozinha.
 */
export function groupActivity(items) {
    const out = [];
    items.forEach((item) => {
        const last = out[out.length - 1];
        if (item.type === 'activity' && last?.type === 'activity') {
            out[out.length - 1] = { type: 'activity-group', id: `grp-${last.id}`, at: last.at, items: [last, item] };
        } else if (item.type === 'activity' && last?.type === 'activity-group') {
            last.items.push(item);
        } else {
            out.push(item);
        }
    });
    return out;
}

/* ============================================================
   XP COM LIMITE DIÁRIO
   ============================================================ */

const today = () => new Date().toISOString().slice(0, 10);

function takeDailyXpSlot(feed) {
    const daily = feed.daily?.date === today() ? feed.daily : { date: today(), xpEvents: 0 };
    if (daily.xpEvents >= FEED_DAILY_XP_LIMIT) return { allowed: false, daily };
    return { allowed: true, daily: { ...daily, xpEvents: daily.xpEvents + 1 } };
}

export function dailyXpLeft() {
    const feed = getFeed();
    const used = feed.daily?.date === today() ? feed.daily.xpEvents : 0;
    return Math.max(0, FEED_DAILY_XP_LIMIT - used);
}

/* ============================================================
   AÇÕES
   ============================================================ */

/** Publica um post do usuário. */
export function publishPost(text) {
    const errors = validateValue(text, postRules());
    if (errors.length) return { ok: false, errors };

    const feed = getFeed();
    const post = {
        id: `post-${Date.now().toString(36)}`,
        authorId: 'self',
        text: sanitizeText(text, POST_MAX),
        at: new Date().toISOString(),
        kind: 'user',
    };

    const slot = takeDailyXpSlot(feed);
    saveFeed({ ...feed, posts: [post, ...feed.posts], daily: slot.daily });

    if (slot.allowed) awardXp('feedPost', { silent: true });
    addClanContribution(2, { xp: 3 });
    checkAchievements();

    return { ok: true, post, xp: slot.allowed ? 20 : 0 };
}

/** Liga/desliga uma reação. Devolve o novo estado e a contagem final. */
export function toggleReaction(postId, reactionId) {
    if (!REACTIONS.some((reaction) => reaction.id === reactionId)) return { ok: false };

    const feed = getFeed();
    const current = new Set(feed.reactions[postId] ?? []);
    const active = !current.has(reactionId);
    if (active) current.add(reactionId); else current.delete(reactionId);

    const rewardKey = `${postId}:${reactionId}`;
    const rewarded = { ...(feed.rewarded ?? {}) };
    let slot = { allowed: false, daily: feed.daily };
    // XP só na primeira vez que esta reação entra neste post: ligar e
    // desligar repetidas vezes não rende nada.
    if (active && !rewarded[rewardKey]) {
        slot = takeDailyXpSlot(feed);
        if (slot.allowed) rewarded[rewardKey] = true;
    }

    saveFeed({
        ...feed,
        reactions: { ...feed.reactions, [postId]: [...current] },
        rewarded,
        daily: slot.daily ?? feed.daily,
    });

    if (slot.allowed) awardXp('feedReaction', { silent: true });
    return { ok: true, active, xp: slot.allowed ? 5 : 0 };
}

/** Comenta em um post (até 140 caracteres, sem HTML). */
export function addComment(postId, text) {
    const errors = validateValue(text, commentRules());
    if (errors.length) return { ok: false, errors };

    const feed = getFeed();
    const comment = {
        id: `c-${Date.now().toString(36)}`,
        authorId: 'self',
        text: sanitizeText(text, COMMENT_MAX),
        at: new Date().toISOString(),
    };
    const list = [...(feed.comments[postId] ?? []), comment].slice(-LIMITS.commentsPerPost);
    saveFeed({ ...feed, comments: { ...feed.comments, [postId]: list } });
    return { ok: true, comment };
}

export const myPostCount = () => getFeed().posts.length;
