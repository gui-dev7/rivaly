/**
 * library.js — controller for the Game Library page.
 *
 * Owns: filtering, sorting, the add/edit dialog, removal, native
 * drag-and-drop between statuses, and the XP/achievement side effects
 * of every mutation. Data operations live in library-store.js.
 */

import { bootApp, afterRender, haltModule } from './app.js';
import {
    listHydrated, addEntry, updateEntry, removeEntry, findEntry,
    statusCounts, librarySummary, hasGame,
} from './library-store.js';
import { GAMES, LIBRARY_STATUSES, PLATFORMS, getGameById } from './data.js';
import { awardXp, checkAchievements } from './gamification.js';
import { logActivity } from './activity.js';
import { toast, toastInfo } from './notifications.js';
import { openModal, confirmDialog } from './modal.js';
import { refreshNavigationProgress } from './navigation.js';
import { gameCardMarkup, statMarkup } from './cards.js';
import {
    $, render, escapeHtml, icon, emptyStateMarkup, formatHours, coverArt,
} from './ui.js';
import { prefersReducedMotion } from './animations.js';

const user = bootApp({
    page: 'library',
    title: 'Game Library',
    subtitle: 'Everything you play, in one record',
});
if (!user) await haltModule();

/* ============================================================
   VIEW STATE
   ============================================================ */

const view = {
    status: 'all',
    query: '',
    sort: 'recent',
};

const gridHost = $('#libraryGrid');
const tabsHost = $('#statusTabs');
const summaryHost = $('#librarySummary');

/* ============================================================
   SUMMARY
   ============================================================ */

function renderSummary() {
    const summary = librarySummary();
    render(summaryHost, [
        statMarkup({
            label: 'Total games', value: summary.total, icon: 'library',
            meta: summary.platforms.length ? `${summary.platforms.length} platform${summary.platforms.length > 1 ? 's' : ''}` : 'Nothing yet',
            accent: 'var(--color-primary)',
        }),
        statMarkup({
            label: 'Hours tracked', value: formatHours(summary.hours), icon: 'clock',
            meta: summary.total ? `${Math.round(summary.hours / Math.max(1, summary.total))}h average` : '—',
            accent: 'var(--color-text-muted)',
        }),
        statMarkup({
            label: 'Completed', value: summary.completed, icon: 'check-circle',
            meta: summary.total ? `${Math.round((summary.completed / summary.total) * 100)}% of your library` : '—',
            accent: 'var(--color-accent)',
        }),
        statMarkup({
            label: 'Average rating', value: summary.averageRating || '—', icon: 'star',
            meta: summary.topGenres[0] ? `Top genre: ${summary.topGenres[0].genre}` : 'Rate a game to start',
            accent: 'var(--color-primary)',
        }),
    ].join(''));
}

/* ============================================================
   TABS
   ============================================================ */

function renderTabs() {
    const counts = statusCounts();
    const tabs = [{ id: 'all', label: 'All' }, ...LIBRARY_STATUSES];

    render(tabsHost, tabs.map((status) => `
        <button type="button" class="segmented__item" role="tab" data-status="${escapeHtml(status.id)}"
                aria-selected="${view.status === status.id}" aria-controls="libraryGrid">
            ${escapeHtml(status.label)}
            <span class="segmented__count">${counts[status.id] ?? 0}</span>
        </button>
    `).join(''));
}

tabsHost.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-status]');
    if (!tab) return;
    view.status = tab.dataset.status;
    renderTabs();
    renderGrid();
});

// Arrow-key navigation across the filter tabs.
tabsHost.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const tabs = Array.from(tabsHost.querySelectorAll('[data-status]'));
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
   GRID
   ============================================================ */

function visibleEntries() {
    const needle = view.query.trim().toLowerCase();

    let entries = listHydrated();

    if (view.status !== 'all') {
        entries = entries.filter((entry) => entry.status === view.status);
    }

    if (needle) {
        entries = entries.filter((entry) =>
            entry.game.title.toLowerCase().includes(needle) ||
            entry.game.genre.some((genre) => genre.toLowerCase().includes(needle))
        );
    }

    const sorters = {
        recent: (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
        added: (a, b) => new Date(b.addedAt) - new Date(a.addedAt),
        title: (a, b) => a.game.title.localeCompare(b.game.title),
        hours: (a, b) => b.hours - a.hours || a.game.title.localeCompare(b.game.title),
        rating: (a, b) => b.rating - a.rating || a.game.title.localeCompare(b.game.title),
    };

    return entries.sort(sorters[view.sort] ?? sorters.recent);
}

function renderGrid() {
    const entries = visibleEntries();
    const total = listHydrated().length;

    if (entries.length === 0) {
        render(gridHost, total === 0
            ? emptyStateMarkup({
                iconName: 'library',
                title: 'Your library is waiting.',
                text: 'Add your first game and start building your Gamer Passport. Genres, platforms and hours all feed back into your identity.',
                action: '<button type="button" class="btn btn--primary btn--sm" data-action="add">Add game</button>',
            })
            : emptyStateMarkup({
                iconName: 'search',
                title: 'Nothing matches this view.',
                text: view.query
                    ? `No game in your library matches “${view.query}”.`
                    : 'No games have this status yet. Drag a card onto this tab, or edit an entry to move it here.',
                action: '<button type="button" class="btn btn--secondary btn--sm" data-action="clear-filters">Clear filters</button>',
            })
        );
        return;
    }

    render(gridHost, `<div class="grid grid--cards stagger">${
        entries.map((entry) => gameCardMarkup(entry, { draggable: true })).join('')
    }</div>`);

    afterRender(gridHost);
}

$('#librarySearch').addEventListener('input', (event) => {
    view.query = event.target.value;
    renderGrid();
});

$('#librarySort').addEventListener('change', (event) => {
    view.sort = event.target.value;
    renderGrid();
});

/* ============================================================
   ADD / EDIT DIALOG
   ============================================================ */

function statusOptions(selected) {
    return LIBRARY_STATUSES.map((status) =>
        `<option value="${status.id}"${status.id === selected ? ' selected' : ''}>${escapeHtml(status.label)}</option>`
    ).join('');
}

function platformOptions(game, selected) {
    return game.platform.map((platformId) => {
        const label = PLATFORMS.find((platform) => platform.id === platformId)?.label ?? platformId;
        return `<option value="${platformId}"${platformId === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
}

function ratingInput(selected = 0) {
    // Reversed in the DOM so the CSS sibling selector can light up
    // every star to the left of the hovered one.
    return `<div class="rating-input" role="radiogroup" aria-label="Rating">
        ${[5, 4, 3, 2, 1].map((value) => `
            <input type="radio" name="rating" id="rating-${value}" value="${value}"${Number(selected) === value ? ' checked' : ''}>
            <label for="rating-${value}" title="${value} star${value > 1 ? 's' : ''}">
                ${icon('star', { size: 18, title: `${value} stars` })}
            </label>
        `).join('')}
    </div>`;
}

function openGameDialog(entryId = null) {
    const existing = entryId ? findEntry(entryId) : null;
    const existingGame = existing ? getGameById(existing.gameId) : null;

    const available = GAMES
        .filter((game) => !hasGame(game.id) || game.id === existing?.gameId)
        .sort((a, b) => a.title.localeCompare(b.title));

    if (!existing && available.length === 0) {
        toastInfo('Catalogue complete', 'Every game in the demo catalogue is already in your library.');
        return;
    }

    const body = `
        <form class="stack stack-md" id="gameForm" novalidate>
            ${existing
                ? `<div class="game-dialog__head">
                        <span class="game-dialog__cover">${coverArt(existingGame)}</span>
                        <div>
                            <p class="game-dialog__title">${escapeHtml(existingGame.title)}</p>
                            <p class="game-dialog__meta">${escapeHtml(existingGame.genre.join(' · '))}</p>
                        </div>
                   </div>`
                : `<div class="field">
                        <label class="field__label" for="gameSelect">Game</label>
                        <div class="select-wrap">
                            <select class="select" id="gameSelect" required data-autofocus>
                                ${available.map((game) => `<option value="${game.id}">${escapeHtml(game.title)} — ${escapeHtml(game.genre[0])}</option>`).join('')}
                            </select>
                        </div>
                        <p class="field__hint">${available.length} game${available.length === 1 ? '' : 's'} still available in the demo catalogue.</p>
                   </div>`}

            <div class="grid grid--form-2">
                <div class="field">
                    <label class="field__label" for="statusSelect">Status</label>
                    <div class="select-wrap">
                        <select class="select" id="statusSelect">${statusOptions(existing?.status ?? 'playing')}</select>
                    </div>
                </div>

                <div class="field">
                    <label class="field__label" for="platformSelect">Platform</label>
                    <div class="select-wrap">
                        <select class="select" id="platformSelect">
                            ${existing
                                ? platformOptions(existingGame, existing.platform)
                                : platformOptions(available[0], null)}
                        </select>
                    </div>
                </div>
            </div>

            <div class="grid grid--form-2">
                <div class="field">
                    <label class="field__label" for="hoursInput">Hours played</label>
                    <input class="input" type="number" id="hoursInput" min="0" max="99999" step="1"
                           inputmode="numeric" value="${existing?.hours ?? 0}">
                </div>

                <div class="field">
                    <span class="field__label">Your rating</span>
                    ${ratingInput(existing?.rating ?? 0)}
                </div>
            </div>

            <div class="field">
                <label class="field__label" for="noteInput">Note <span class="ob-optional">optional</span></label>
                <input class="input" type="text" id="noteInput" maxlength="200"
                       placeholder="e.g. Waiting for the co-op patch" value="${escapeHtml(existing?.note ?? '')}">
            </div>
        </form>
    `;

    const { close, root } = openModal({
        title: existing ? 'Edit library entry' : 'Add a game',
        subtitle: existing ? 'Update status, hours and rating.' : 'Pick a title from the demo catalogue.',
        body,
        footer: `
            <button type="button" class="btn btn--ghost" data-modal-close>Cancel</button>
            <button type="submit" form="gameForm" class="btn btn--primary">${existing ? 'Save changes' : 'Add to library'}</button>
        `,
    });

    // Keep the platform list in sync with the chosen game.
    const gameSelect = root.querySelector('#gameSelect');
    gameSelect?.addEventListener('change', () => {
        const game = getGameById(gameSelect.value);
        root.querySelector('#platformSelect').innerHTML = platformOptions(game, null);
    });

    root.querySelector('#gameForm').addEventListener('submit', (event) => {
        event.preventDefault();

        const payload = {
            status: root.querySelector('#statusSelect').value,
            platform: root.querySelector('#platformSelect').value,
            hours: Number(root.querySelector('#hoursInput').value) || 0,
            rating: Number(root.querySelector('input[name="rating"]:checked')?.value ?? 0),
            note: root.querySelector('#noteInput').value,
        };

        if (existing) {
            applyUpdate(existing.id, payload);
        } else {
            applyAdd(gameSelect.value, payload);
        }
        close();
    });
}

/* ============================================================
   MUTATIONS
   Each one: persist → award → log → notify → re-render.
   ============================================================ */

function refreshAll() {
    renderSummary();
    renderTabs();
    renderGrid();
    refreshNavigationProgress();
    afterRender(document);
}

function applyAdd(gameId, payload) {
    const result = addEntry({ gameId, ...payload });
    if (!result.ok) {
        toast({ title: 'Could not add the game', message: result.reason, type: 'warning' });
        return;
    }

    const game = getGameById(gameId);
    logActivity('library', `Added ${game.title} to the Library`, { xp: 50 });
    awardXp('addGame', { detail: `${game.title} added`, silent: true });
    toast({ title: 'Game added.', message: game.title, type: 'success', xp: 50 });

    if (payload.rating > 0) awardXp('rateGame', { silent: true });
    if (payload.status === 'completed') awardXp('completeGame', { silent: true });

    checkAchievements();
    refreshAll();
}

function applyUpdate(entryId, payload) {
    const result = updateEntry(entryId, payload);
    if (!result.ok) return;

    const game = getGameById(result.entry.gameId);
    let xp = 0;

    if (result.statusChanged && result.entry.status === 'completed') {
        awardXp('completeGame', { silent: true });
        xp += 75;
        logActivity('library', `Completed ${game.title}`, { xp: 75 });
    } else {
        awardXp('updateGame', { silent: true });
        xp += 10;
    }

    if (result.ratingChanged) {
        awardXp('rateGame', { silent: true });
        xp += 15;
    }

    if (result.hoursAdded >= 10) {
        awardXp('logHours', { silent: true, multiplier: Math.min(10, Math.floor(result.hoursAdded / 10)) });
        xp += 5 * Math.min(10, Math.floor(result.hoursAdded / 10));
    }

    toast({ title: 'Passport updated.', message: `${game.title} · ${result.entry.status}`, type: 'success', xp });
    checkAchievements();
    refreshAll();
}

async function applyRemove(entryId) {
    const entry = findEntry(entryId);
    if (!entry) return;
    const game = getGameById(entry.gameId);

    const confirmed = await confirmDialog({
        title: `Remove ${game.title}?`,
        message: 'The entry is deleted from your library. XP you already earned stays on your Passport.',
        confirmLabel: 'Remove',
        danger: true,
    });
    if (!confirmed) return;

    removeEntry(entryId);
    logActivity('library', `Removed ${game.title} from the Library`);
    toast({ title: 'Removed from library.', message: game.title, type: 'info' });
    refreshAll();
}

function moveToStatus(entryId, status) {
    const entry = findEntry(entryId);
    if (!entry || entry.status === status) return;
    applyUpdate(entryId, { status });
}

/* ============================================================
   EVENT DELEGATION
   One listener on the page handles every card action, so the grid
   can be re-rendered freely without leaking listeners.
   ============================================================ */

document.getElementById('main-content').addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;

    const { action } = trigger.dataset;
    const entryId = trigger.dataset.entry;

    if (action === 'add') openGameDialog();
    if (action === 'edit') openGameDialog(entryId);
    if (action === 'remove') applyRemove(entryId);
    if (action === 'clear-filters') {
        view.status = 'all';
        view.query = '';
        $('#librarySearch').value = '';
        renderTabs();
        renderGrid();
    }
});

$('#addGameBtn').addEventListener('click', () => openGameDialog());

/* ============================================================
   DRAG AND DROP
   Native HTML Drag and Drop API. The status tabs are the drop
   targets; every action is also reachable from the edit dialog,
   so nothing depends on a pointer.
   ============================================================ */

let draggedEntryId = null;

gridHost.addEventListener('dragstart', (event) => {
    const card = event.target.closest('[data-entry]');
    if (!card) return;

    draggedEntryId = card.dataset.entry;
    card.classList.add('is-dragging');
    tabsHost.classList.add('is-drop-target');

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedEntryId);
});

gridHost.addEventListener('dragend', (event) => {
    event.target.closest('[data-entry]')?.classList.remove('is-dragging');
    tabsHost.classList.remove('is-drop-target');
    tabsHost.querySelectorAll('.is-drop-hover').forEach((tab) => tab.classList.remove('is-drop-hover'));
    draggedEntryId = null;
});

tabsHost.addEventListener('dragover', (event) => {
    const tab = event.target.closest('[data-status]');
    if (!tab || !draggedEntryId || tab.dataset.status === 'all') return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    tab.classList.add('is-drop-hover');
});

tabsHost.addEventListener('dragleave', (event) => {
    event.target.closest('[data-status]')?.classList.remove('is-drop-hover');
});

tabsHost.addEventListener('drop', (event) => {
    const tab = event.target.closest('[data-status]');
    if (!tab || tab.dataset.status === 'all') return;
    event.preventDefault();

    const entryId = event.dataTransfer.getData('text/plain') || draggedEntryId;
    tab.classList.remove('is-drop-hover');
    if (entryId) moveToStatus(entryId, tab.dataset.status);
});

// Touch devices get no drag events; say so instead of leaving a dead affordance.
if (window.matchMedia('(hover: none)').matches) {
    $('#libraryHint').textContent = 'Tip: use the edit button on a card to change its status, hours or rating.';
}

/* ============================================================
   BOOT
   ============================================================ */

renderSummary();
renderTabs();
renderGrid();
afterRender(document);

// Deep link from the Dashboard: library.html?action=add
if (new URLSearchParams(window.location.search).get('action') === 'add') {
    openGameDialog();
}

// Reduced motion removes the stagger; nothing else changes.
if (prefersReducedMotion()) {
    gridHost.querySelector('.stagger')?.classList.remove('stagger');
}
