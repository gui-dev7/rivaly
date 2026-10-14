/**
 * gamification.js — XP, levels, achievements, reputation, Pontuacao Gamer.
 *
 * The single authority on progression. Pages never mutate `xp` or
 * `level` themselves; they call `awardXp()` and let this module handle
 * the level curve, the celebration, the activity log and the
 * achievement re-evaluation that follows.
 *
 * Everything here is deterministic. No randomness anywhere.
 */

import {
    getUser, saveUser, getLibrary, getAchievements, saveAchievements, getSquads,
    getSessions, getRelations, getClanMembership, getArena, getFeed,
} from './storage.js';
import { XP_RULES, ACHIEVEMENTS, RARITIES } from './data.js';
import { logActivity } from './activity.js';
import { profileCompletion } from './profile.js';
import { toast, showAchievement, showLevelUp } from './notifications.js';

/* ============================================================
   LEVEL CURVE
   ------------------------------------------------------------
   XP required to advance FROM level L to L+1:
       step(L) = 1000 + (L - 1) * 500
         L1→L2 = 1000    L2→L3 = 1500    L3→L4 = 2000 …

   Cumulative XP required to REACH level L:
       total(L) = (L - 1) * (250L + 500)

   The inverse is solved analytically rather than by looping, so
   arbitrarily large XP values resolve in constant time.
   ============================================================ */

export const xpStepForLevel = (level) => 1000 + (Math.max(1, level) - 1) * 500;

export const totalXpForLevel = (level) => {
    const safe = Math.max(1, Math.floor(level));
    return (safe - 1) * (250 * safe + 500);
};

export function levelFromXp(xp) {
    const safeXp = Math.max(0, Number(xp) || 0);
    // 250L² + 250L - 500 = xp  →  solve for L, then floor.
    const level = (-250 + Math.sqrt(62500 + 1000 * (500 + safeXp))) / 500;
    return Math.max(1, Math.floor(level));
}

/** Everything the UI needs to draw an XP bar. */
export function levelProgress(xp) {
    const safeXp = Math.max(0, Number(xp) || 0);
    const level = levelFromXp(safeXp);
    const floor = totalXpForLevel(level);
    const ceiling = totalXpForLevel(level + 1);
    const span = ceiling - floor;
    const into = safeXp - floor;
    return {
        level,
        xp: safeXp,
        currentLevelXp: into,
        nextLevelXp: span,
        remaining: Math.max(0, span - into),
        percent: span > 0 ? Math.min(100, (into / span) * 100) : 0,
    };
}

/* ============================================================
   XP AWARDS
   ============================================================ */

/** Mutates + persists XP without side effects. Internal use only. */
function grantXp(amount) {
    const user = getUser();
    if (!user) return null;

    const before = levelFromXp(user.xp);
    const nextXp = Math.max(0, (user.xp ?? 0) + amount);
    const after = levelFromXp(nextXp);

    saveUser({ ...user, xp: nextXp, level: after, updatedAt: new Date().toISOString() });

    return { xp: nextXp, levelBefore: before, levelAfter: after, leveledUp: after > before };
}

/**
 * Awards XP for a named rule and produces all the feedback that
 * should accompany it.
 *
 * @param {keyof XP_RULES} ruleKey
 * @param {object} [options]
 * @param {string} [options.detail]   Overrides the toast message.
 * @param {number} [options.multiplier] For repeatable rules (e.g. hours).
 * @param {boolean} [options.silent]  Skip the toast (used when a richer
 *                                    toast has already been shown).
 */
export function awardXp(ruleKey, { detail = '', multiplier = 1, silent = false } = {}) {
    const rule = XP_RULES[ruleKey];
    if (!rule) return null;

    const amount = Math.round(rule.amount * multiplier);
    const result = grantXp(amount);
    if (!result) return null;

    if (!silent) {
        toast({
            title: detail || rule.label,
            message: 'Experiência adicionada ao seu Passaporte.',
            type: 'success',
            xp: amount,
        });
    }

    if (result.leveledUp) {
        showLevelUp(result.levelBefore, result.levelAfter);
        logActivity('level', `Chegou ao Nível ${result.levelAfter}`, { level: result.levelAfter });
    }

    // A level change (or the action itself) may satisfy new achievements.
    checkAchievements();

    return { ...result, amount };
}

/**
 * Awards a rule at most once per passport, ever.
 *
 * Milestones like "profile fully completed" can be re-reached after an
 * edit; without this guard they would pay out again each time. The
 * flag lives on the passport under `rewards`.
 */
export function awardOnce(ruleKey, options = {}) {
    const user = getUser();
    if (!user) return null;
    const claimed = user.rewards ?? {};
    if (claimed[ruleKey]) return null;

    saveUser({ ...user, rewards: { ...claimed, [ruleKey]: new Date().toISOString() } });
    return awardXp(ruleKey, options);
}

/**
 * Same guard as awardOnce, but per target: marking Aliado on two
 * different players pays twice, marking the same player twice pays once.
 */
export function awardOnceFor(ruleKey, targetKey, options = {}) {
    const user = getUser();
    if (!user) return null;
    const claimed = user.rewards ?? {};
    const flag = `${ruleKey}:${targetKey}`;
    if (claimed[flag]) return null;

    saveUser({ ...user, rewards: { ...claimed, [flag]: new Date().toISOString() } });
    return awardXp(ruleKey, options);
}

/* ============================================================
   DERIVED CONTEXT
   Everything the achievement rules are allowed to read.
   ============================================================ */

export function buildContext() {
    const user = getUser();
    const library = getLibrary();
    const unlocked = getAchievements();
    const squads = getSquads();

    // V2: a comunidade também conta. Lido direto do storage para que este
    // módulo não dependa dos *-store.js (que dependem dele).
    const relations = Object.values(getRelations());
    const arena = getArena();
    const membership = getClanMembership();

    const totalHours = library.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
    const level = levelFromXp(user?.xp ?? 0);
    const completion = profileCompletion(user);

    const context = {
        user,
        library,
        squads,
        totalHours,
        level,
        profileCompletion: completion,
        unlockedCount: unlocked.length,
        bestMatch: user?.bestMatch ?? 0,
        searchCount: user?.squadSearches ?? 0,
        reputation: 0,

        sessionCount: getSessions().length,
        allyCount: relations.filter((relation) => relation.type === 'ally').length,
        rivalCount: relations.filter((relation) => relation.type === 'rival').length,
        inClan: Boolean(membership?.clanId),
        // Entrou num clã de outra pessoa (aberto, candidatura ou convite).
        // Fundar o próprio clã é outra conquista (Bandeira Erguida).
        joinedClan: Boolean(membership?.clanId) && membership.via !== 'create',
        clanMembership: membership,
        createdClan: Boolean(user?.rewards?.createClan),
        arenaRating: arena.rating,
        arenaWins: arena.wins,
        arenaMatches: arena.matches,
        postCount: getFeed().posts.length,
    };

    context.reputation = calculateReputacao(context);
    return context;
}

/* ============================================================
   REPUTATION
   ------------------------------------------------------------
   A transparent, additive score. Reputação is *earned by
   activity*, not assigned randomly. Unchanged in V2: the Arena
   rating is a separate metric and does not feed it.

     50  base
     +2  per level
     +1.5 per achievement unlocked
     +0.8 per completed game
     +1  per saved teammate
     +0.12 per point of profile completion

   Capped at 100.
   ============================================================ */

export function calculateReputacao(context) {
    const completedGames = context.library.filter((entry) => entry.status === 'completed').length;
    const raw =
        50 +
        context.level * 2 +
        context.unlockedCount * 1.5 +
        completedGames * 0.8 +
        context.squads.length * 1 +
        context.profileCompletion * 0.12;
    return Math.max(0, Math.min(100, Math.round(raw)));
}

/* ============================================================
   GAMER SCORE
   ------------------------------------------------------------
   One headline number that summarises the whole passport.
   Weighted so no single axis can dominate it.
   ============================================================ */

export function calculateGamerScore(context = buildContext()) {
    const unlocked = getAchievements();
    const rarityPoints = unlocked.reduce((sum, entry) => {
        const definition = ACHIEVEMENTS.find((achievement) => achievement.id === entry.id);
        const weight = RARITIES[definition?.rarity]?.weight ?? 1;
        return sum + weight;
    }, 0);

    const completedGames = context.library.filter((entry) => entry.status === 'completed').length;

    return Math.round(
        context.level * 500 +
        (context.user?.xp ?? 0) * 0.25 +
        rarityPoints * 250 +
        context.library.length * 80 +
        completedGames * 120 +
        context.totalHours * 2 +
        context.reputation * 10 +
        context.squads.length * 100
    );
}

/* ============================================================
   ACHIEVEMENTS
   ============================================================ */

export const isUnlocked = (id) => getAchievements().some((entry) => entry.id === id);

export function getAchievementState() {
    const unlocked = getAchievements();
    const map = new Map(unlocked.map((entry) => [entry.id, entry]));
    return ACHIEVEMENTS.map((achievement) => ({
        ...achievement,
        unlocked: map.has(achievement.id),
        unlockedAt: map.get(achievement.id)?.unlockedAt ?? null,
        context: map.get(achievement.id)?.context ?? '',
    }));
}

/**
 * Re-entrancy guard: unlocking an achievement grants XP, which can
 * trigger a level-up, which can satisfy a *different* achievement.
 * A bounded loop resolves the cascade without infinite recursion.
 */
let evaluating = false;

export function checkAchievements(extra = {}) {
    if (evaluating) return [];
    evaluating = true;

    const newlyUnlocked = [];

    try {
        for (let pass = 0; pass < 4; pass += 1) {
            const context = { ...buildContext(), ...extra };
            const unlocked = getAchievements();
            const unlockedIds = new Set(unlocked.map((entry) => entry.id));

            const found = ACHIEVEMENTS.filter((achievement) => {
                if (unlockedIds.has(achievement.id)) return false;
                try {
                    return achievement.check(context) === true;
                } catch {
                    return false;
                }
            });

            if (found.length === 0) break;

            const stamped = found.map((achievement) => ({
                id: achievement.id,
                unlockedAt: new Date().toISOString(),
                context: extra.achievementContext ?? '',
            }));
            saveAchievements([...unlocked, ...stamped]);

            found.forEach((achievement) => {
                newlyUnlocked.push(achievement);
                grantXp(XP_RULES.achievement.amount);
                logActivity('achievement', `Desbloqueou ${achievement.name}`, { id: achievement.id });
            });
        }
    } finally {
        evaluating = false;
    }

    newlyUnlocked.forEach((achievement) => {
        showAchievement(achievement, extra.achievementContext ?? '');
    });

    return newlyUnlocked;
}

/* ============================================================
   SNAPSHOT
   One call that returns every progression number a page can need.
   ============================================================ */

export function progressSnapshot() {
    const context = buildContext();
    const progress = levelProgress(context.user?.xp ?? 0);
    return {
        ...progress,
        reputation: context.reputation,
        gamerScore: calculateGamerScore(context),
        achievementsUnlocked: context.unlockedCount,
        achievementsTotal: ACHIEVEMENTS.length,
        libraryCount: context.library.length,
        totalHours: context.totalHours,
        profileCompletion: context.profileCompletion,
        squadCount: context.squads.length,
    };
}
