/**
 * dashboard.js — the home screen of the application.
 *
 * Reads only; it never mutates progression. Everything shown here is
 * derived from the passport, the library, the activity ledger and the
 * Compatibility Engine.
 */

import { bootApp, afterRender, haltModule } from './app.js';
import { render, escapeHtml, formatNumber, icon, emptyStateMarkup, formatHours } from './ui.js';
import { progressSnapshot, getAchievementState } from './gamification.js';
import { archetypeOf, profileCompletion, missingProfileFields } from './profile.js';
import { listHydrated, librarySummary } from './library-store.js';
import { getRecentActivity } from './activity.js';
import { findMatches } from './compatibility.js';
import { statMarkup, gameRowMarkup, squadRowMarkup, badgeMarkup, activityItemMarkup, dnaListMarkup } from './cards.js';
import { countUp } from './animations.js';
import { getGameById } from './data.js';

const user = bootApp({
    page: 'dashboard',
    title: 'Dashboard',
    subtitle: 'Your Passport at a glance',
});
if (!user) await haltModule();

const snapshot = progressSnapshot();
const summary = librarySummary();
const archetype = archetypeOf(user);

/* ============================================================
   GREETING
   ============================================================ */

function greetingLine() {
    const hour = new Date().getHours();
    if (hour < 6) return 'Late session?';
    if (hour < 12) return 'Ready to play?';
    if (hour < 18) return 'What are we playing today?';
    return 'Prime time. Ready to play?';
}

document.getElementById('greetingTitle').textContent = `Welcome back, ${user.nickname}.`;
document.getElementById('greetingSub').textContent = greetingLine();

/* ============================================================
   SETUP NUDGE
   Only shown when the passport is genuinely incomplete.
   ============================================================ */

const completion = profileCompletion(user);
const missing = missingProfileFields(user);

if (completion < 100) {
    const needsDna = missing.includes('dna');
    render(document.getElementById('setupNudge'), `
        <aside class="nudge" role="note">
            <span class="nudge__icon">${icon(needsDna ? 'dna' : 'id', { size: 20 })}</span>
            <div class="nudge__body">
                <p class="nudge__title">${needsDna ? 'Your Gamer DNA is still missing.' : 'Your Passport is ' + completion + '% complete.'}</p>
                <p class="nudge__text">${needsDna
                    ? 'Ten questions produce your six attributes and your archetype — the rest of the platform uses them.'
                    : 'Finishing it improves your match quality and unlocks the Fully Registered badge.'}</p>
                <div class="nudge__meter">
                    <span class="progress progress--thin">
                        <span class="progress__fill" data-progress="${completion}"></span>
                    </span>
                    <span class="numeric">${completion}%</span>
                </div>
            </div>
            <a class="btn btn--primary btn--sm" href="${needsDna ? 'onboarding.html?stage=dna' : 'passport.html?edit=1'}">
                ${needsDna ? 'Start the DNA' : 'Complete it'}
            </a>
        </aside>
    `);
}

/* ============================================================
   OVERVIEW
   ============================================================ */

render(document.getElementById('overviewStats'), [
    statMarkup({
        label: 'Level',
        value: snapshot.level,
        meta: `${formatNumber(snapshot.remaining)} XP to level ${snapshot.level + 1}`,
        icon: 'arrow-up',
        accent: 'var(--color-primary)',
        tooltip: 'Levels come from XP. Each level costs 500 XP more than the previous one.',
        count: snapshot.level,
    }),
    statMarkup({
        label: 'Experience',
        value: formatNumber(snapshot.xp),
        meta: `${Math.round(snapshot.percent)}% into this level`,
        icon: 'bolt',
        accent: 'var(--color-primary)',
        tooltip: 'XP is awarded for real actions: adding games, completing them, finding squads and completing your Passport.',
        count: snapshot.xp,
    }),
    statMarkup({
        label: 'Gamer Score',
        value: formatNumber(snapshot.gamerScore),
        meta: 'Overall passport strength',
        icon: 'spark',
        accent: 'var(--color-primary)',
        tooltip: 'A single number combining level, XP, achievement rarity, library size, hours played, reputation and squad activity.',
        count: snapshot.gamerScore,
    }),
    statMarkup({
        label: 'Reputation',
        value: snapshot.reputation,
        meta: 'Earned through activity',
        icon: 'shield',
        accent: 'var(--color-accent)',
        tooltip: 'Starts at 50 and grows with your level, achievements, completed games, squad size and profile completeness. Capped at 100.',
        count: snapshot.reputation,
    }),
    statMarkup({
        label: 'Games',
        value: snapshot.libraryCount,
        meta: `${formatHours(summary.hours)} tracked`,
        icon: 'controller',
        accent: 'var(--color-text-muted)',
        count: snapshot.libraryCount,
    }),
    statMarkup({
        label: 'Badges',
        value: `${snapshot.achievementsUnlocked}/${snapshot.achievementsTotal}`,
        meta: 'Achievements unlocked',
        icon: 'trophy',
        accent: 'var(--color-primary)',
    }),
].join(''));

/* ============================================================
   CURRENTLY PLAYING
   ============================================================ */

const playing = listHydrated()
    .filter((entry) => entry.status === 'playing')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5);

render(document.getElementById('currentlyPlaying'), playing.length
    ? `<ul class="game-row-list card card--flat">${playing.map(gameRowMarkup).join('')}</ul>`
    : emptyStateMarkup({
        iconName: 'controller',
        title: 'Nothing in progress.',
        text: 'Add a game and set it to Playing — your Passport starts describing what you actually play.',
        action: '<a class="btn btn--primary btn--sm" href="library.html?action=add">Add a game</a>',
    })
);

/* ============================================================
   SUGGESTED SQUAD
   The search is derived from the passport itself, so the block is
   personalised without asking the user anything.
   ============================================================ */

const squadHost = document.getElementById('suggestedSquad');
const preferredGame = user.currentGames?.[0]
    ?? summary.playing[0]?.gameId
    ?? null;

if (!preferredGame) {
    render(squadHost, emptyStateMarkup({
        iconName: 'users',
        title: 'No squad yet.',
        text: "Let's find your team. Add a game you are playing and the engine can start matching you.",
        action: '<a class="btn btn--primary btn--sm" href="squads.html">Open Squad Finder</a>',
    }));
} else {
    const criteria = {
        gameId: preferredGame,
        rank: user.rank ?? 'any',
        schedule: user.schedules?.[0] ?? 'any',
        playstyle: user.playstyle || 'any',
        role: 'any',
        voiceChat: user.voiceChat ?? 'any',
    };

    const matches = findMatches(criteria, user, { limit: 3 });
    const game = getGameById(preferredGame);

    render(squadHost, `
        <div class="card card--flat">
            <p class="suggested__intro">
                Based on your Passport · <strong>${escapeHtml(game.title)}</strong>
            </p>
            <ul class="squad-row-list">${matches.map(({ player, result }) => squadRowMarkup(player, result)).join('')}</ul>
            <a class="btn btn--secondary btn--sm btn--block" href="squads.html?game=${encodeURIComponent(preferredGame)}">
                Run a full search
            </a>
        </div>
    `);
}

/* ============================================================
   RECENT ACTIVITY
   ============================================================ */

const activity = getRecentActivity(7);

render(document.getElementById('recentActivity'), activity.length
    ? `<ul class="activity-list card card--flat">${activity.map(activityItemMarkup).join('')}</ul>`
    : emptyStateMarkup({
        iconName: 'clock',
        title: 'No activity yet.',
        text: 'Everything you do in RIVALY is recorded here — locally, in this browser.',
    })
);

/* ============================================================
   GAMER DNA
   ============================================================ */

render(document.getElementById('dnaSummary'), user.dna
    ? `
        <div class="card card--accented dna-summary">
            <div class="dna-summary__head">
                <div>
                    <p class="dna-summary__archetype" style="color:${archetype.accent}">${escapeHtml(archetype.name)}</p>
                    <p class="dna-summary__tagline">${escapeHtml(archetype.tagline)}</p>
                </div>
                <span class="dna-summary__glyph" style="color:${archetype.accent}">${icon('dna', { size: 22 })}</span>
            </div>
            ${dnaListMarkup(user.dna.scores)}
            <a class="link dna-summary__link" href="passport.html">Read the full analysis</a>
        </div>
    `
    : emptyStateMarkup({
        iconName: 'dna',
        title: 'Your DNA is unmapped.',
        text: 'Ten questions is all it takes. The result drives your archetype, your suggested roles and your matches.',
        action: '<a class="btn btn--primary btn--sm" href="onboarding.html?stage=dna">Run the analysis</a>',
    })
);

/* ============================================================
   LATEST ACHIEVEMENTS
   ============================================================ */

const unlockedBadges = getAchievementState()
    .filter((achievement) => achievement.unlocked)
    .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
    .slice(0, 4);

render(document.getElementById('latestBadges'), unlockedBadges.length
    ? `<div class="grid grid--badges">${unlockedBadges.map(badgeMarkup).join('')}</div>`
    : emptyStateMarkup({
        iconName: 'trophy',
        title: 'Your first achievement is closer than you think.',
        text: 'Add a game, complete your DNA or run a squad search — any of them unlocks something.',
        action: '<a class="btn btn--secondary btn--sm" href="achievements.html">See what is available</a>',
    })
);

/* ============================================================
   POST-RENDER
   ============================================================ */

afterRender(document);

// Count the headline numbers up once they are on screen.
document.querySelectorAll('[data-count]').forEach((node) => {
    const target = Number(node.dataset.count);
    if (!Number.isFinite(target)) return;
    const suffix = node.textContent.trim().endsWith('%') ? '%' : '';
    countUp(node, target, { duration: 900, suffix });
});
