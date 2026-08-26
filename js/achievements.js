/**
 * achievements.js — controller for the Achievements page.
 *
 * Read-only. The unlock rules live in data.js next to the copy, and
 * the evaluation runs in gamification.js; this page only presents the
 * result and explains what is still missing.
 */

import { bootApp, afterRender, haltModule } from './app.js';
import { getAchievementState, progressSnapshot, buildContext } from './gamification.js';
import { RARITIES } from './data.js';
import { badgeMarkup } from './cards.js';
import { $, render, escapeHtml, icon, emptyStateMarkup } from './ui.js';
import { countUp } from './animations.js';

const user = bootApp({
    page: 'achievements',
    title: 'Achievements',
    subtitle: 'Badges, rarities and progress',
});
if (!user) await haltModule();

const state = getAchievementState();
const snapshot = progressSnapshot();
const context = buildContext();

/* ============================================================
   PROGRESS
   ============================================================ */

const unlocked = state.filter((achievement) => achievement.unlocked);
const percent = Math.round((unlocked.length / state.length) * 100);

$('#totalCount').textContent = `/${state.length}`;
$('#collectionBar').dataset.progress = String(percent);
$('#progressMeta').textContent = `${percent}% of the collection · ${snapshot.achievementsUnlocked * 40} XP earned from badges`;
countUp($('#unlockedCount'), unlocked.length, { duration: 900 });

render($('#rarityBreakdown'), Object.entries(RARITIES).map(([id, rarity]) => {
    const all = state.filter((achievement) => achievement.rarity === id);
    const got = all.filter((achievement) => achievement.unlocked).length;
    return `
        <div class="rarity-chip rarity-${escapeHtml(id)}">
            <span class="rarity-chip__dot" aria-hidden="true"></span>
            <span class="rarity-chip__label">${escapeHtml(rarity.label)}</span>
            <span class="rarity-chip__count numeric">${got}/${all.length}</span>
        </div>
    `;
}).join(''));

/* ============================================================
   CLOSEST TO UNLOCKING
   A small, honest heuristic: how far the user is from the numeric
   threshold each locked achievement checks.
   ============================================================ */

const PROGRESS_HINTS = {
    'shelf-builder': () => ({ current: context.library.length, target: 5 }),
    collector: () => ({ current: context.library.length, target: 10 }),
    curator: () => ({ current: context.library.length, target: 20 }),
    finisher: () => ({ current: context.library.filter((entry) => entry.status === 'completed').length, target: 5 }),
    critic: () => ({ current: context.library.filter((entry) => entry.rating > 0).length, target: 5 }),
    dedicated: () => ({ current: Math.round(context.totalHours), target: 100 }),
    'no-life': () => ({ current: Math.round(context.totalHours), target: 1000 }),
    multiplatform: () => ({ current: new Set(context.library.map((entry) => entry.platform)).size, target: 3 }),
    'full-roster': () => ({ current: context.squads.length, target: 5 }),
    'complete-profile': () => ({ current: context.profileCompletion, target: 100 }),
    'level-5': () => ({ current: context.level, target: 5 }),
    'level-10': () => ({ current: context.level, target: 10 }),
    'well-regarded': () => ({ current: context.reputation, target: 80 }),
    legend: () => ({ current: context.unlockedCount, target: 15 }),
    'perfect-match': () => ({ current: context.bestMatch, target: 90 }),
};

const nextUp = state
    .filter((achievement) => !achievement.unlocked && PROGRESS_HINTS[achievement.id])
    .map((achievement) => {
        const { current, target } = PROGRESS_HINTS[achievement.id]();
        return { achievement, current, target, ratio: Math.min(1, current / target) };
    })
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3);

render($('#nextUp'), nextUp.length
    ? `<div class="next-up">${nextUp.map(({ achievement, current, target, ratio }) => `
        <article class="next-up__item rarity-${escapeHtml(achievement.rarity)}">
            <span class="next-up__medal">${icon(achievement.icon, { size: 20 })}</span>
            <div class="next-up__body">
                <p class="next-up__name">${escapeHtml(achievement.name)}</p>
                <p class="next-up__hint">${escapeHtml(achievement.hint)}</p>
                <div class="next-up__meter">
                    <span class="progress progress--thin">
                        <span class="progress__fill" data-progress="${ratio * 100}"></span>
                    </span>
                    <span class="numeric">${current}/${target}</span>
                </div>
            </div>
        </article>
    `).join('')}</div>`
    : emptyStateMarkup({
        iconName: 'crown',
        title: 'Every measurable badge is yours.',
        text: 'There is nothing left with a countable target — the rest unlock from single actions.',
    })
);

/* ============================================================
   FILTERS
   ============================================================ */

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'unlocked', label: 'Unlocked' },
    { id: 'locked', label: 'Locked' },
    ...Object.entries(RARITIES).map(([id, rarity]) => ({ id, label: rarity.label })),
];

let activeFilter = 'all';

function countFor(filterId) {
    if (filterId === 'all') return state.length;
    if (filterId === 'unlocked') return unlocked.length;
    if (filterId === 'locked') return state.length - unlocked.length;
    return state.filter((achievement) => achievement.rarity === filterId).length;
}

function renderTabs() {
    render($('#achvTabs'), FILTERS.map((filter) => `
        <button type="button" class="segmented__item" role="tab" data-filter="${escapeHtml(filter.id)}"
                aria-selected="${activeFilter === filter.id}" aria-controls="badgeGrid">
            ${escapeHtml(filter.label)}
            <span class="segmented__count">${countFor(filter.id)}</span>
        </button>
    `).join(''));
}

function visibleAchievements() {
    if (activeFilter === 'all') return state;
    if (activeFilter === 'unlocked') return state.filter((achievement) => achievement.unlocked);
    if (activeFilter === 'locked') return state.filter((achievement) => !achievement.unlocked);
    return state.filter((achievement) => achievement.rarity === activeFilter);
}

function renderGrid() {
    const items = visibleAchievements();

    render($('#badgeGrid'), items.length
        ? `<div class="grid grid--badges stagger">${items.map(badgeMarkup).join('')}</div>`
        : emptyStateMarkup({
            iconName: 'trophy',
            title: 'Nothing here yet.',
            text: activeFilter === 'unlocked'
                ? 'Your first achievement is closer than you think — adding one game unlocks Game On.'
                : 'No achievement matches this filter.',
            action: activeFilter === 'unlocked'
                ? '<a class="btn btn--primary btn--sm" href="library.html?action=add">Add a game</a>'
                : '',
        })
    );

    afterRender($('#badgeGrid'));
}

$('#achvTabs').addEventListener('click', (event) => {
    const tab = event.target.closest('[data-filter]');
    if (!tab) return;
    activeFilter = tab.dataset.filter;
    renderTabs();
    renderGrid();
});

$('#achvTabs').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const tabs = Array.from($('#achvTabs').querySelectorAll('[data-filter]'));
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : (index - 1 + tabs.length) % tabs.length;
    tabs[next].focus();
    tabs[next].click();
});

/* ============================================================
   BOOT
   ============================================================ */

renderTabs();
renderGrid();
afterRender(document);
