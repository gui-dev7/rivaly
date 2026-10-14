/**
 * library.js — controller for the Biblioteca de Jogos page.
 *
 * Owns: filtering, sorting, the add/edit dialog, removal, native
 * drag-and-drop between statuses, and the XP/achievement side effects
 * of every mutation. Data operations live in library-store.js.
 */

import { bootApp, afterRender, haltModule } from './app.js';
import {
    listHydrated, addEntry, updateEntry, removeEntry, findEntry,
    statusCounts, librarySummary, hasGame, resolveGame,
} from './library-store.js';
import { GAMES, LIBRARY_STATUSES, PLATFORMS, getGameById, genreLabel } from './data.js';
import { searchGames, getGame, coverUrl, platformNames, releaseYear, genreNames } from './gamedb.js';
import { toCatalogueGame } from './external-games.js';
import { awardXp, checkAchievements } from './gamification.js';
import { logActivity } from './activity.js';
import { toast, toastInfo } from './notifications.js';
import { openModal, confirmDialog } from './modal.js';
import {
    validateForm, bindLiveValidation, focusFirstInvalid, showFieldError, maxLength, noHtml, numberRange,
} from './validation.js';
import { refreshNavigationProgress } from './navigation.js';
import { gameCardMarkup, statMarkup } from './cards.js';
import {
    $, render, escapeHtml, icon, emptyStateMarkup, formatHours, coverArt, colWrap,
} from './ui.js';
import { prefersReducedMotion } from './animations.js';

const user = bootApp({
    page: 'library',
    title: 'Biblioteca de Jogos',
    subtitle: 'Tudo o que você joga, em um só registro',
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
            label: 'Total de jogos', value: summary.total, icon: 'library',
            meta: summary.platforms.length ? `${summary.platforms.length} plataforma${summary.platforms.length > 1 ? 's' : ''}` : 'Nenhuma ainda',
            accent: 'var(--color-primary)',
        }),
        statMarkup({
            label: 'Horas registradas', value: formatHours(summary.hours), icon: 'clock',
            meta: summary.total ? `${Math.round(summary.hours / Math.max(1, summary.total))} h de média` : '—',
            accent: 'var(--color-text-muted)',
        }),
        statMarkup({
            label: 'Concluídos', value: summary.completed, icon: 'check-circle',
            meta: summary.total ? `${Math.round((summary.completed / summary.total) * 100)}% da sua biblioteca` : '—',
            accent: 'var(--color-accent)',
        }),
        statMarkup({
            label: 'Nota média', value: summary.averageRating || '—', icon: 'star',
            meta: summary.topGenres[0] ? `Gênero principal: ${genreLabel(summary.topGenres[0].genre)}` : 'Avalie um jogo para começar',
            accent: 'var(--color-primary)',
        }),
    ].map((stat) => colWrap(stat)).join(''));
}

/* ============================================================
   TABS
   ============================================================ */

function renderTabs() {
    const counts = statusCounts();
    const tabs = [{ id: 'all', label: 'Todos' }, ...LIBRARY_STATUSES];

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
            entry.game.genre.some((genre) => genre.toLowerCase().includes(needle) || genreLabel(genre).toLowerCase().includes(needle))
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
                title: 'Sua biblioteca está esperando.',
                text: 'Adicione seu primeiro jogo e comece a montar seu Passaporte Gamer. Gêneros, plataformas e horas ajudam a definir sua identidade.',
                action: '<button type="button" class="btn btn-primary btn-sm" data-action="add">Adicionar meu primeiro jogo</button>',
            })
            : emptyStateMarkup({
                iconName: 'search',
                title: 'Nenhum jogo nesta visualização.',
                text: view.query
                    ? `Nenhum jogo da sua biblioteca corresponde a “${view.query}”.`
                    : 'Nenhum jogo tem este status ainda. Arraste um card até esta aba ou edite uma entrada para movê-la.',
                action: '<button type="button" class="btn btn-outline-light btn-sm" data-action="clear-filters">Limpar filtros</button>',
            })
        );
        return;
    }

    render(gridHost, `<div class="row row-cols-2 row-cols-md-3 row-cols-xl-4 g-3 stagger">${
        entries.map((entry) => colWrap(gameCardMarkup(entry, { draggable: true }))).join('')
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
    return `<div class="rating-input" role="radiogroup" aria-label="Avaliação">
        ${[5, 4, 3, 2, 1].map((value) => `
            <input type="radio" name="rating" id="rating-${value}" value="${value}"${Number(selected) === value ? ' checked' : ''}>
            <label for="rating-${value}" title="${value} estrela${value > 1 ? 's' : ''}">
                ${icon('star', { size: 18, title: `${value} estrela${value > 1 ? 's' : ''}` })}
            </label>
        `).join('')}
    </div>`;
}

function openGameDialog(entryId = null) {
    const existing = entryId ? findEntry(entryId) : null;
    const existingGame = existing ? resolveGame(existing.gameId) : null;

    const available = GAMES
        .filter((game) => !hasGame(game.id) || game.id === existing?.gameId)
        .sort((a, b) => a.title.localeCompare(b.title));

    if (!existing && available.length === 0) {
        toastInfo('Catálogo completo', 'Todos os jogos do catálogo demo já estão na sua biblioteca.');
        return;
    }

    const body = `
        <form class="stack stack-md" id="gameForm" novalidate>
            ${existing
                ? `<div class="game-dialog__head">
                        <span class="game-dialog__cover">${coverArt(existingGame)}</span>
                        <div>
                            <p class="game-dialog__title">${escapeHtml(existingGame.title)}</p>
                            <p class="game-dialog__meta">${escapeHtml(existingGame.genre.map(genreLabel).join(' · '))}</p>
                        </div>
                   </div>`
                : `<div>
                        <label class="form-label" for="gameSearch">Jogo</label>
                        <div class="input-group">
                            <span class="input-group-text" aria-hidden="true">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                            </span>
                            <input class="form-control" type="search" id="gameSearch" autocomplete="off"
                                   placeholder="Ex.: Hades" data-autofocus
                                   aria-describedby="gameSearchHint">
                        </div>
                        <p class="form-text" id="gameSearchHint">
                            Digite duas letras ou mais. A busca cobre o catálogo da RIVALY e a base
                            aberta do GameDB: qualquer jogo pode entrar na sua Biblioteca.
                        </p>
                        <div class="game-picker" id="gameResults" role="listbox" aria-label="Resultados da busca"></div>
                        <input type="hidden" id="gameSelect">
                   </div>`}

            <div class="row g-3">
                <div class="col-12 col-sm-6">
                    <label class="form-label" for="statusSelect">Status</label>
                    <select class="form-select" id="statusSelect">${statusOptions(existing?.status ?? 'playing')}</select>
                </div>

                <div class="col-12 col-sm-6">
                    <label class="form-label" for="platformSelect">Plataforma</label>
                    <select class="form-select" id="platformSelect">
                        ${existing
                            ? platformOptions(existingGame, existing.platform)
                            : platformOptions(available[0], null)}
                    </select>
                </div>

                <div class="col-12 col-sm-6">
                    <label class="form-label" for="hoursInput">Horas jogadas</label>
                    <input class="form-control" type="number" id="hoursInput" min="0" max="99999" step="1"
                           inputmode="numeric" value="${existing?.hours ?? 0}" aria-describedby="hoursHelp">
                    <p class="form-text" id="hoursHelp">De 0 a 99.999.</p>
                </div>

                <div class="col-12 col-sm-6">
                    <span class="form-label d-block">Sua nota</span>
                    ${ratingInput(existing?.rating ?? 0)}
                </div>

                <div class="col-12">
                    <label class="form-label" for="noteInput">Observação <span class="text-muted">(opcional)</span></label>
                    <input class="form-control" type="text" id="noteInput" maxlength="200"
                           placeholder="Ex.: esperando a atualização do modo cooperativo" value="${escapeHtml(existing?.note ?? '')}">
                </div>
            </div>
        </form>
    `;

    const { close, root } = openModal({
        title: existing ? 'Editar entrada da biblioteca' : 'Adicionar um jogo',
        subtitle: existing ? 'Atualize o status, as horas e a avaliação.' : 'Busque qualquer jogo e escolha o status.',
        body,
        footer: `
            <button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>
            <button type="submit" form="gameForm" class="btn btn-primary">${existing ? 'Salvar alterações' : 'Adicionar à Biblioteca'}</button>
        `,
    });

    const gameSelect = root.querySelector('#gameSelect');

    /* --------------------------------------------------------
       BUSCA DE JOGO

       Duas fontes na mesma lista: o catalogo curado responde na hora e
       tem arte propria; o GameDB cobre o resto do mundo. Guardamos o
       registro do escolhido para que um jogo externo chegue completo ao
       `addEntry` — sem isso a entrada apontaria para um catalogo que nao
       o conhece.
       -------------------------------------------------------- */
    const results = root.querySelector('#gameResults');

    if (results) {
        let escolhido = null;      // registro pronto para a Biblioteca
        let token = 0;
        let debounce = null;

        const linha = (id, titulo, meta, capa, externo) => `
            <button type="button" class="game-picker__item" role="option" aria-selected="false"
                    data-pick="${escapeHtml(id)}" data-externo="${externo ? '1' : ''}">
                <span class="game-picker__art">${capa
                    ? `<img src="${escapeHtml(capa)}" alt="" loading="lazy" decoding="async" data-fallback>`
                    : `<span class="game-picker__initials">${escapeHtml(titulo.slice(0, 2).toUpperCase())}</span>`}</span>
                <span class="game-picker__body">
                    <span class="game-picker__name">${escapeHtml(titulo)}</span>
                    <span class="game-picker__meta">${escapeHtml(meta)}</span>
                </span>
            </button>`;

        const marcar = (id, registro) => {
            if (!registro) return;
            escolhido = registro;
            gameSelect.value = id;

            // Com o jogo escolhido a lista recolhe: mantê-la aberta empurra
            // status, plataforma e nota para fora da tela no celular.
            render(results, `
                <div class="game-picker__chosen">
                    <span class="game-picker__art">${registro.customAssets?.cover
                        ? `<img src="${escapeHtml(registro.customAssets.cover)}" alt="" decoding="async" data-fallback>`
                        : `<span class="game-picker__initials">${escapeHtml(registro.title.slice(0, 2).toUpperCase())}</span>`}</span>
                    <span class="game-picker__body">
                        <span class="game-picker__name">${escapeHtml(registro.title)}</span>
                        <span class="game-picker__meta">${escapeHtml([registro.year, registro.genre?.[0]].filter(Boolean).join(' · '))}</span>
                    </span>
                    <button type="button" class="btn btn-ghost btn-sm" data-trocar>Trocar jogo</button>
                </div>
            `);

            // A lista de plataformas segue o jogo escolhido.
            root.querySelector('#platformSelect').innerHTML = platformOptions(registro, null);
        };

        const buscar = async (termo) => {
            const meu = ++token;
            const query = termo.trim();

            if (query.length < 2) {
                render(results, '');
                return;
            }

            // 1. Catalogo curado: instantaneo, e o que ja esta na Biblioteca fica de fora.
            const locais = available.filter((g) => g.title.toLowerCase().includes(query.toLowerCase()));
            render(results, [
                ...locais.map((g) => linha(g.id, g.title, `${genreLabel(g.genre[0])} · ${g.year}`, null, false)),
                `<p class="game-picker__status">Buscando no GameDB…</p>`,
            ].join(''));

            let achados = [];
            try {
                achados = await searchGames(query, { limit: 12 });
            } catch {
                if (meu !== token) return;
                render(results, [
                    ...locais.map((g) => linha(g.id, g.title, `${genreLabel(g.genre[0])} · ${g.year}`, null, false)),
                    `<p class="game-picker__status">Não foi possível falar com o GameDB agora.</p>`,
                ].join(''));
                return;
            }
            if (meu !== token) return;

            const registros = (await Promise.all(achados.map((h) => getGame(h.id)))).filter(Boolean);
            if (meu !== token) return;

            const externos = await Promise.all(registros.map(async (raw) => {
                const nomes = await platformNames(raw);
                return toCatalogueGame(raw, {
                    cover: coverUrl(raw, 't_cover_big'),
                    platformNames: nomes,
                    year: releaseYear(raw),
                    genres: genreNames(raw),
                });
            }));
            if (meu !== token) return;

            // Um titulo ja presente na Biblioteca nao pode ser adicionado de novo.
            const disponiveis = externos.filter((g) => !hasGame(g.id));

            render(results, [
                ...locais.map((g) => linha(g.id, g.title, `${genreLabel(g.genre[0])} · ${g.year}`, null, false)),
                ...disponiveis.map((g) => linha(
                    g.id, g.title,
                    [g.year, g.genre[0]].filter(Boolean).join(' · ') || 'GameDB',
                    g.customAssets?.cover ?? null, true,
                )),
                (locais.length + disponiveis.length) === 0
                    ? `<p class="game-picker__status">Nenhum jogo encontrado para "${escapeHtml(query)}".</p>`
                    : '',
            ].join(''));

            // Guarda os registros externos para o clique nao ter de refazer a busca.
            results._externos = new Map(disponiveis.map((g) => [g.id, g]));
        };

        root.querySelector('#gameSearch').addEventListener('input', (event) => {
            clearTimeout(debounce);
            const termo = event.target.value;
            debounce = setTimeout(() => buscar(termo), 350);
        });

        results.addEventListener('click', (event) => {
            if (event.target.closest('[data-trocar]')) {
                escolhido = null;
                gameSelect.value = '';
                const campo = root.querySelector('#gameSearch');
                campo.focus();
                buscar(campo.value);
                return;
            }

            const botao = event.target.closest('[data-pick]');
            if (!botao) return;
            const id = botao.dataset.pick;
            marcar(id, botao.dataset.externo ? results._externos?.get(id) : getGameById(id));
        });

        // O submit precisa enxergar o registro escolhido.
        root._escolhido = () => escolhido;
    }

    const formSchema = {
        hoursInput: [numberRange(0, 99999, 'Use um número de horas entre 0 e 99.999.')],
        noteInput: [maxLength(200, 'A observação pode ter no máximo 200 caracteres.'), noHtml()],
    };
    bindLiveValidation(root.querySelector('#gameForm'), formSchema);

    root.querySelector('#gameForm').addEventListener('submit', (event) => {
        event.preventDefault();

        const check = validateForm(root.querySelector('#gameForm'), formSchema);
        if (!existing && !gameSelect.value) {
            showFieldError(root.querySelector('#gameSearch'), 'Busque e escolha um jogo na lista antes de adicionar.');
            root.querySelector('#gameSearch').focus();
            return;
        }
        if (!check.valid) {
            focusFirstInvalid(check);
            return;
        }

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
            applyAdd(gameSelect.value, payload, root._escolhido?.() ?? null);
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

function applyAdd(gameId, payload, registro = null) {
    // Jogo do GameDB chega com o proprio registro de catalogo.
    const result = addEntry({ gameId, ...payload, game: registro });
    if (!result.ok) {
        toast({ title: 'Não foi possível adicionar o jogo', message: result.reason, type: 'warning' });
        return;
    }

    const game = resolveGame(gameId);
    logActivity('library', `Adicionou ${game.title} à Biblioteca`, { xp: 50 });
    awardXp('addGame', { detail: `${game.title} adicionado`, silent: true });
    toast({ title: 'Jogo adicionado.', message: game.title, type: 'success', xp: 50 });

    if (payload.rating > 0) awardXp('rateGame', { silent: true });
    if (payload.status === 'completed') awardXp('completeGame', { silent: true });

    checkAchievements();
    refreshAll();
}

function applyUpdate(entryId, payload) {
    const result = updateEntry(entryId, payload);
    if (!result.ok) return;

    const game = resolveGame(result.entry.gameId);
    let xp = 0;

    if (result.statusChanged && result.entry.status === 'completed') {
        awardXp('completeGame', { silent: true });
        xp += 75;
        logActivity('library', `Zerou ${game.title}`, { xp: 75 });
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

    toast({ title: 'Entrada atualizada.', message: `${game.title} · ${LIBRARY_STATUSES.find((status) => status.id === result.entry.status)?.label ?? result.entry.status}`, type: 'success', xp });
    checkAchievements();
    refreshAll();
}

async function applyRemove(entryId) {
    const entry = findEntry(entryId);
    if (!entry) return;
    const game = resolveGame(entry.gameId);

    const confirmed = await confirmDialog({
        title: `Remover ${game.title} da Biblioteca?`,
        message: 'A entrada sai da sua Biblioteca. O XP que você já ganhou continua no Passaporte.',
        confirmLabel: 'Remover da Biblioteca',
        cancelLabel: 'Manter o jogo',
        danger: true,
    });
    if (!confirmed) return;

    removeEntry(entryId);
    logActivity('library', `Removeu ${game.title} da Biblioteca`);
    toast({ title: 'Removido da Biblioteca.', message: game.title, type: 'info' });
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
    $('#libraryHint').textContent = 'Dica: use o botão de edição do cartão para alterar o status, as horas ou a avaliação.';
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
