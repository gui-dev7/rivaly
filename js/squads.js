/**
 * squads.js — controller for the Squad Finder.
 *
 * Flow: build the search from the passport → scan (a staged, honest
 * progress sequence that mirrors the actual computation) → rank →
 * render with a transparent breakdown → save teammates.
 */

import { bootApp, afterRender, haltModule } from './app.js';
import {
    SQUAD_GAMES, PLAYSTYLES, RANK_LADDER, SCHEDULES, ROLES, PLAYERS, getGameById,
} from './data.js';
import { findMatches, WEIGHTS } from './compatibility.js';
import { getUser, getSquads, saveSquads } from './storage.js';
import { updateUser } from './profile.js';
import { awardXp, checkAchievements } from './gamification.js';
import { logActivity } from './activity.js';
import { toast } from './notifications.js';
import { openModal, confirmDialog } from './modal.js';
import { refreshNavigationProgress } from './navigation.js';
import { squadCardMarkup } from './cards.js';
import {
    $, render, escapeHtml, icon, emptyStateMarkup, avatarMarkup, formatRelativeTime,
} from './ui.js';
import { runSequence, countUp, prefersReducedMotion, wait } from './animations.js';

const user = bootApp({
    page: 'squads',
    title: 'Squad Finder',
    subtitle: 'Compatibility Engine · 7 weighted factors',
});
if (!user) await haltModule();

const resultsHost = $('#resultsHost');
const savedHost = $('#savedHost');
const resultsMeta = $('#resultsMeta');

let lastResults = [];
let lastCriteria = null;

$('#poolSize').textContent = String(PLAYERS.length);

/* ============================================================
   FORM
   Defaults come from the passport, so the first search is already
   personalised.
   ============================================================ */

const optionsHtml = (items, selected) => items
    .map((item) => `<option value="${escapeHtml(item.value)}"${item.value === selected ? ' selected' : ''}>${escapeHtml(item.label)}</option>`)
    .join('');

const params = new URLSearchParams(window.location.search);
const preferredGame = params.get('game')
    ?? user.currentGames?.find((gameId) => SQUAD_GAMES.some((game) => game.id === gameId))
    ?? SQUAD_GAMES[0].id;

render($('#filterGame'), optionsHtml(
    SQUAD_GAMES.map((game) => ({ value: game.id, label: game.title })),
    preferredGame
));

render($('#filterPlaystyle'), optionsHtml(
    [{ value: 'any', label: "Doesn't matter" }, ...PLAYSTYLES.map((style) => ({ value: style.id, label: style.label }))],
    user.playstyle || 'any'
));

render($('#filterRank'), optionsHtml(
    [{ value: 'any', label: 'Any rank' }, ...RANK_LADDER.map((rank) => ({ value: rank, label: rank }))],
    user.rank ?? 'any'
));

render($('#filterSchedule'), optionsHtml(
    [{ value: 'any', label: 'Any time' }, ...SCHEDULES.map((slot) => ({ value: slot.id, label: `${slot.label} · ${slot.hint}` }))],
    user.schedules?.[0] ?? 'any'
));

render($('#filterRole'), optionsHtml(
    [{ value: 'any', label: 'Complement my Passport' }, ...ROLES.map((role) => ({ value: role.id, label: role.label }))],
    'any'
));

$('#filterVoice').value = user.voiceChat === false ? 'false' : 'true';

function readCriteria() {
    const voice = $('#filterVoice').value;
    return {
        gameId: $('#filterGame').value,
        playstyle: $('#filterPlaystyle').value,
        rank: $('#filterRank').value,
        schedule: $('#filterSchedule').value,
        role: $('#filterRole').value,
        voiceChat: voice === 'any' ? 'any' : voice === 'true',
    };
}

/* ============================================================
   SCANNING
   The lines are not decorative: each one names a factor the engine
   actually evaluates, in the order it evaluates them.
   ============================================================ */

const SCAN_STEPS = [
    { label: 'Reading the player pool…', weight: null },
    { label: 'Analysing game overlap…', weight: WEIGHTS.game },
    { label: 'Comparing rank distance…', weight: WEIGHTS.rank },
    { label: 'Checking schedule overlap…', weight: WEIGHTS.schedule },
    { label: 'Comparing playstyle…', weight: WEIGHTS.playstyle },
    { label: 'Evaluating role chemistry…', weight: WEIGHTS.role },
    { label: 'Weighing communication and reputation…', weight: WEIGHTS.communication + WEIGHTS.reputation },
    { label: 'Calculating compatibility…', weight: null },
];

async function playScan() {
    render(resultsHost, `
        <div class="scan card">
            <div class="scan__visual" aria-hidden="true">
                <span class="scan__radar"></span>
                <span class="scan__ping"></span>
                <span class="scan__ping scan__ping--delayed"></span>
            </div>
            <p class="scan__title">Scanning players…</p>
            <ul class="scan__log" id="scanLog"></ul>
            <div class="progress progress--thin scan__bar">
                <div class="progress__fill" id="scanBar" style="transform:scaleX(0)"></div>
            </div>
        </div>
    `);

    const log = $('#scanLog');
    const bar = $('#scanBar');

    await runSequence(SCAN_STEPS.map((step, index) => ({
        run: () => {
            const item = document.createElement('li');
            item.className = 'scan__line';
            item.innerHTML = `
                <span class="scan__tick">${icon('check', { size: 11 })}</span>
                <span>${escapeHtml(step.label)}</span>
                ${step.weight ? `<span class="scan__weight numeric">${step.weight}%</span>` : ''}
            `;
            log.appendChild(item);
            bar.style.transform = `scaleX(${(index + 1) / SCAN_STEPS.length})`;
        },
        wait: 210,
    })));

    await wait(prefersReducedMotion() ? 0 : 260);
}

/* ============================================================
   RESULTS
   ============================================================ */

const savedIds = () => new Set(getSquads().map((entry) => entry.playerId));

function renderResults(matches, criteria) {
    const game = getGameById(criteria.gameId);
    const saved = savedIds();

    resultsMeta.textContent = `${matches.length} candidates · ${game.title}`;

    if (matches.length === 0) {
        render(resultsHost, emptyStateMarkup({
            iconName: 'users',
            title: 'No candidates for this search.',
            text: 'Try widening the rank or schedule filter — the demo pool is intentionally small.',
        }));
        return;
    }

    render(resultsHost, `<div class="squad-results">${
        matches.map(({ player, result }) =>
            squadCardMarkup(player, result, { saved: saved.has(player.id) })
        ).join('')
    }</div>`);

    // Reveal the cards one by one, then count their scores up.
    const cards = Array.from(resultsHost.querySelectorAll('.squad-card'));
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 70}ms`;
        card.classList.add('is-entering');
    });

    afterRender(resultsHost);

    resultsHost.querySelectorAll('[data-count]').forEach((node, index) => {
        window.setTimeout(
            () => countUp(node, Number(node.dataset.count), { duration: 700, suffix: '%' }),
            index * 70
        );
    });
}

/* ============================================================
   SEARCH
   ============================================================ */

let searching = false;

$('#squadForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (searching) return;
    searching = true;

    const button = $('#findBtn');
    button.classList.add('is-loading');
    button.disabled = true;

    const criteria = readCriteria();
    lastCriteria = criteria;

    await playScan();

    const matches = findMatches(criteria, getUser(), { limit: 8 });
    lastResults = matches;
    renderResults(matches, criteria);

    button.classList.remove('is-loading');
    button.disabled = false;
    searching = false;

    // --- Progression ---
    const current = getUser();
    const best = matches[0]?.result.total ?? 0;
    const game = getGameById(criteria.gameId);

    updateUser({
        squadSearches: (current.squadSearches ?? 0) + 1,
        bestMatch: Math.max(current.bestMatch ?? 0, best),
    });

    logActivity('squad', `Searched for a ${game.title} squad — best match ${best}%`, { xp: 150 });
    awardXp('squadSearch', { silent: true });
    toast({
        title: 'Search complete.',
        message: `${matches.length} candidates ranked · best match ${best}%`,
        type: 'success',
        xp: 150,
    });

    if (best >= 90) {
        awardXp('perfectMatch', { silent: true });
        checkAchievements({ achievementContext: `${best}% compatibility` });
    } else {
        checkAchievements();
    }

    refreshNavigationProgress();
});

/* ============================================================
   BREAKDOWN DIALOG
   The full audit trail for one result.
   ============================================================ */

function openBreakdown(playerId) {
    const match = lastResults.find((entry) => entry.player.id === playerId);
    if (!match) return;

    const { player, result } = match;

    const rows = result.breakdown.map((part) => `
        <li class="breakdown__row ${part.positive ? 'is-positive' : ''}">
            <div class="breakdown__head">
                <span class="breakdown__label">${escapeHtml(part.label)}</span>
                <span class="breakdown__weight numeric">${part.weight}%</span>
            </div>
            <div class="breakdown__meter">
                <span class="breakdown__fill" data-progress="${part.score}"></span>
            </div>
            <p class="breakdown__reason">${escapeHtml(part.reason)}</p>
            <p class="breakdown__math numeric">
                ${part.score} / 100 × ${part.weight} = <strong>${part.earned}</strong> pts
                ${part.lost >= 0.1 ? `<span class="breakdown__lost">−${part.lost} lost</span>` : ''}
            </p>
        </li>
    `).join('');

    openModal({
        title: `${player.nickname} — ${result.total}% match`,
        subtitle: `${result.tier.label} · every factor, scored independently`,
        wide: true,
        body: `
            <div class="breakdown">
                <p class="breakdown__intro">${escapeHtml(player.bio)}</p>
                <ul class="breakdown__list">${rows}</ul>
                <p class="breakdown__total">
                    <span>Total</span>
                    <span class="numeric">${result.breakdown.map((part) => part.earned).join(' + ')} = <strong>${result.total}%</strong></span>
                </p>
            </div>
        `,
        footer: `<button type="button" class="btn btn--primary" data-modal-close data-autofocus>Close</button>`,
        onMount: ({ root }) => afterRender(root),
    });
}

/* ============================================================
   SAVED SQUAD
   ============================================================ */

function renderSaved() {
    const squads = getSquads();
    $('#clearSquadBtn').hidden = squads.length === 0;

    if (squads.length === 0) {
        render(savedHost, emptyStateMarkup({
            iconName: 'shield',
            title: 'No squad yet.',
            text: "Let's find your team. Run a search and add the teammates you would actually queue with.",
        }));
        return;
    }

    render(savedHost, `<ul class="saved-list">${squads.map((entry) => {
        const player = PLAYERS.find((candidate) => candidate.id === entry.playerId);
        if (!player) return '';
        const game = getGameById(entry.gameId);
        return `
            <li class="saved-item tier-${escapeHtml(entry.tier)}">
                ${avatarMarkup(player.nickname + player.id, { size: 'md' })}
                <div class="saved-item__body">
                    <p class="saved-item__nick">${escapeHtml(player.nickname)}</p>
                    <p class="saved-item__meta">
                        ${escapeHtml(game?.title ?? 'Unknown game')} · ${escapeHtml(player.rank)} · saved ${escapeHtml(formatRelativeTime(entry.savedAt))}
                    </p>
                </div>
                <span class="saved-item__score numeric">${entry.compatibility}%</span>
                <button type="button" class="btn btn--ghost btn--icon btn--sm" data-action="unsave" data-player="${escapeHtml(player.id)}"
                        aria-label="Remove ${escapeHtml(player.nickname)} from your squad">
                    ${icon('close', { size: 14 })}
                </button>
            </li>
        `;
    }).join('')}</ul>`);
}

function saveTeammate(playerId) {
    const match = lastResults.find((entry) => entry.player.id === playerId);
    if (!match || !lastCriteria) return;

    const squads = getSquads();
    if (squads.some((entry) => entry.playerId === playerId)) return;

    saveSquads([
        {
            playerId,
            compatibility: match.result.total,
            tier: match.result.tier.id,
            gameId: lastCriteria.gameId,
            savedAt: new Date().toISOString(),
        },
        ...squads,
    ]);

    logActivity('squad', `Added ${match.player.nickname} to your squad (${match.result.total}% match)`, { xp: 60 });
    awardXp('saveTeammate', { silent: true });
    toast({
        title: `${match.player.nickname} added to your squad.`,
        message: `${match.result.total}% compatibility`,
        type: 'success',
        xp: 60,
    });

    checkAchievements({
        achievementContext: match.result.total >= 90 ? `${match.result.total}% compatibility` : '',
    });

    // Flip just this button rather than re-rendering every card.
    const button = resultsHost.querySelector(`[data-action="save"][data-player="${playerId}"]`);
    if (button) {
        button.disabled = true;
        button.classList.remove('btn--primary');
        button.classList.add('btn--ghost');
        button.textContent = 'Saved to squad';
    }

    renderSaved();
    refreshNavigationProgress();
}

async function unsaveTeammate(playerId) {
    const player = PLAYERS.find((candidate) => candidate.id === playerId);
    const confirmed = await confirmDialog({
        title: `Remove ${player?.nickname ?? 'this player'}?`,
        message: 'They are removed from your saved squad. Reputation and XP you already earned are unaffected.',
        confirmLabel: 'Remove',
        danger: true,
    });
    if (!confirmed) return;

    saveSquads(getSquads().filter((entry) => entry.playerId !== playerId));
    renderSaved();

    const button = resultsHost.querySelector(`[data-action="save"][data-player="${playerId}"]`);
    if (button) {
        button.disabled = false;
        button.classList.add('btn--primary');
        button.classList.remove('btn--ghost');
        button.textContent = 'Add to squad';
    }

    toast({ title: 'Removed from your squad.', message: player?.nickname ?? '', type: 'info' });
}

$('#clearSquadBtn').addEventListener('click', async () => {
    const confirmed = await confirmDialog({
        title: 'Clear your whole squad?',
        message: 'Every saved teammate is removed. This does not affect your level, XP or achievements.',
        confirmLabel: 'Clear squad',
        danger: true,
    });
    if (!confirmed) return;
    saveSquads([]);
    renderSaved();
    // Re-render the result cards so their buttons return to "Add to squad".
    if (lastResults.length && lastCriteria) renderResults(lastResults, lastCriteria);
    toast({ title: 'Squad cleared.', type: 'info' });
});

/* ============================================================
   DELEGATION
   ============================================================ */

document.getElementById('main-content').addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;

    const { action, player } = trigger.dataset;
    if (action === 'breakdown') openBreakdown(player);
    if (action === 'save') saveTeammate(player);
    if (action === 'unsave') unsaveTeammate(player);
});

/* ============================================================
   BOOT
   ============================================================ */

render(resultsHost, emptyStateMarkup({
    iconName: 'target',
    title: 'Ready when you are.',
    text: 'Set your filters and run a search. The engine scores every player in the pool against seven weighted factors and shows its work.',
}));

renderSaved();
afterRender(document);
