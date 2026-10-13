/**
 * achievements.js — controller for the Conquistas page.
 *
 * Read-only. The unlock rules live in data.js next to the copy, and
 * the evaluation runs in gamification.js; this page only presents the
 * result and explains what is still missing.
 */

import { bootApp, afterRender, haltModule } from './app.js';
import { getAchievementState, progressSnapshot, buildContext } from './gamification.js';
import { RARITIES, ACHIEVEMENTS } from './data.js';
import { badgeMarkup } from './cards.js';
import { $, render, escapeHtml, icon, emptyStateMarkup } from './ui.js';
import { countUp } from './animations.js';

const user = bootApp({
    page: 'achievements',
    title: 'Conquistas',
    subtitle: 'Medalhas, raridades e progresso',
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
$('#progressMeta').textContent = `${percent}% da coleção · ${snapshot.achievementsUnlocked * 40} XP ganhos com medalhas`;
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
    'first-session': () => ({ current: context.sessionCount, target: 1 }),
    'declared-ally': () => ({ current: context.allyCount, target: 1 }),
    'worthy-rival': () => ({ current: context.rivalCount, target: 1 }),
    'arena-first-win': () => ({ current: context.arenaWins, target: 1 }),
    'arena-legend': () => ({ current: context.arenaRating, target: 1700 }),
    'community-voice': () => ({ current: context.postCount, target: 1 }),
};

// O total nunca é escrito à mão: vem da lista de conquistas.
const NUMBER_WORDS = { 20: 'Vinte', 28: 'Vinte e oito' };
$('#achvLede').textContent = `${NUMBER_WORDS[ACHIEVEMENTS.length] ?? ACHIEVEMENTS.length} medalhas, cinco raridades. Cada uma está ligada a algo que você fez na RIVALY. Nenhuma é dada de graça.`;

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
        title: 'Todas as medalhas com progresso mensurável são suas.',
        text: 'Não resta nenhuma com meta numérica. As outras saem de ações específicas, como fundar um clã.',
    })
);

/* ============================================================
   FILTERS
   ============================================================ */

const FILTERS = [
    { id: 'all', label: 'Todas' },
    { id: 'unlocked', label: 'Desbloqueadas' },
    { id: 'locked', label: 'Bloqueadas' },
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
        ? `<div class="row row-cols-2 row-cols-sm-3 row-cols-lg-4 row-cols-xl-5 g-3 stagger">${items.map((item) => `<div class="col">${badgeMarkup(item)}</div>`).join('')}</div>`
        : emptyStateMarkup({
            iconName: 'trophy',
            title: 'Nada por aqui ainda.',
            text: activeFilter === 'unlocked'
                ? 'Sua primeira conquista está mais perto do que parece: adicionar um jogo já desbloqueia Começou o Jogo.'
                : 'Nenhuma conquista corresponde a este filtro.',
            action: activeFilter === 'unlocked'
                ? '<a class="btn btn-primary btn-sm" href="library.html?action=add">Adicionar um jogo</a>'
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
