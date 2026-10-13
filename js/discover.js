/**
 * discover.js — busca de jogos na base publica do LizardByte GameDB.
 *
 * O que persiste aqui e deliberadamente minimo: `gameId` mais o que o
 * usuario registrou (status, nota, data). Nome, capa e plataformas
 * continuam vindo do GameDB a cada visita, entao a base externa nunca e
 * duplicada no localStorage — e nunca envelhece dentro do nosso storage.
 */

import { bootApp, afterRender, haltModule } from './app.js';
import { searchGames, getGame, coverUrl, platformNames, releaseYear, genreNames } from './gamedb.js';
import { toCatalogueGame, externalIdFor, isExternalId } from './external-games.js';
import { addEntry, updateEntry, listHydrated, hasGame, listEntries } from './library-store.js';
import { awardXp, checkAchievements } from './gamification.js';
import { logActivity } from './activity.js';
import { toast } from './notifications.js';
import { $, render, escapeHtml, emptyStateMarkup } from './ui.js';

const user = bootApp({
    page: 'discover',
    title: 'Descobrir jogos',
    subtitle: 'Busque na base aberta do GameDB',
});
if (!user) await haltModule();

const results = $('#discoverResults');
const savedList = $('#discoverSaved');
const status = $('#discoverStatus');
const search = $('#discoverSearch');

/* Guardamos o registro cru e as plataformas ja resolvidas do que esta na
   tela, para adicionar a Biblioteca sem uma segunda ida a rede. */
const fetched = new Map();
const platformCache = new Map();

/* ============================================================
   REGISTROS DO USUARIO
   ============================================================ */

/* Os rotulos do Descobrir mapeiam direto nos status reais da Biblioteca:
   o que voce marca aqui vira uma entrada la, nao um registro paralelo. */
const STATUSES = {
    completed: 'Já joguei',
    playing: 'Jogando',
    wishlist: 'Quero jogar',
};

/** Entradas da Biblioteca que vieram do GameDB. */
const loadSaved = () => listHydrated().filter((entry) => isExternalId(entry.gameId));

/**
 * Guarda apenas identificador + interacao. O `name` acompanha somente
 * para que a lista salva consiga se desenhar antes da rede responder;
 * tudo que e exibicao rica vem do GameDB.
 */
function saveInteraction(gamedbId, statusId) {
    const raw = fetched.get(String(gamedbId));
    if (!raw) return;

    const gameId = externalIdFor(gamedbId);
    const existing = listEntries().find((entry) => entry.gameId === gameId);

    if (existing) {
        updateEntry(existing.id, { status: statusId });
        toast({ title: 'Status atualizado', message: `${raw.name} — ${STATUSES[statusId]}`, type: 'info' });
    } else {
        const game = toCatalogueGame(raw, {
            cover: coverUrl(raw, 't_cover_big'),
            platformNames: platformCache.get(String(gamedbId)) ?? [],
            year: releaseYear(raw),
            genres: genreNames(raw),
        });

        const result = addEntry({ gameId, status: statusId, game });
        if (!result.ok) {
            toast({ title: 'Não foi possível adicionar', message: result.reason, type: 'error' });
            return;
        }

        // Mesmas recompensas de um jogo adicionado pela Biblioteca: a
        // origem muda, o que o usuario fez nao.
        awardXp('addGame');
        logActivity('library', `Adicionou ${raw.name} pela busca do GameDB`);
        checkAchievements();
        toast({ title: 'Adicionado à Biblioteca', message: `${raw.name} — ${STATUSES[statusId]}`, type: 'success' });
    }

    renderSaved();
    markOwned();
}

/* ============================================================
   RENDER
   ============================================================ */

function skeletonCards(count = 8) {
    return Array.from({ length: count }, () => `
        <div class="col">
            <article class="card discover-card discover-card--skeleton" aria-hidden="true">
                <div class="discover-card__cover skeleton"></div>
                <div class="card-body discover-card__body">
                    <span class="skeleton skeleton--line"></span>
                    <span class="skeleton skeleton--line skeleton--short"></span>
                </div>
            </article>
        </div>
    `).join('');
}

function cardMarkup(game) {
    const cover = coverUrl(game, 't_cover_big');
    const year = releaseYear(game);
    const initials = (game.name ?? '?').slice(0, 2).toUpperCase();

    // Sem capa na base, o bloco com as iniciais fica no lugar — nunca um
    // <img> quebrado.
    const art = cover
        ? `<img class="discover-card__img" src="${escapeHtml(cover)}" alt=""
                loading="lazy" decoding="async" data-fallback>`
        : '';

    return `
        <div class="col">
        <article class="card discover-card" data-game-id="${escapeHtml(String(game.id))}">
            <div class="discover-card__cover">
                <span class="discover-card__initials" aria-hidden="true">${escapeHtml(initials)}</span>
                ${art}
                <span class="discover-card__owned" data-owned hidden>Na Biblioteca</span>
            </div>
            <div class="card-body discover-card__body">
                <h3 class="card-title discover-card__name">${escapeHtml(game.name ?? 'Sem nome')}</h3>
                <p class="card-text discover-card__meta">
                    ${year ? `<span class="numeric">${year}</span>` : ''}
                    <span class="discover-card__platforms" data-platforms>—</span>
                </p>
                <p class="discover-card__genres">${escapeHtml(genreNames(game).slice(0, 2).join(' · '))}</p>
                <div class="discover-card__actions">
                    ${Object.entries(STATUSES).map(([id, label]) => `
                        <button type="button" class="btn btn-outline-light btn-sm"
                                data-save="${id}">${label}</button>
                    `).join('')}
                </div>
            </div>
        </article>
        </div>
    `;
}

/** As plataformas chegam como IDs; resolvemos depois de pintar o card. */
async function fillPlatforms(game, node) {
    const names = await platformNames(game);
    const slot = node.querySelector('[data-platforms]');
    if (slot) slot.textContent = names.slice(0, 4).join(' · ') || 'Plataforma não informada';
}

/** Destaca nos resultados o que ja esta na Biblioteca. */
function markOwned() {
    document.querySelectorAll('.discover-card[data-game-id]').forEach((card) => {
        const owned = hasGame(externalIdFor(card.dataset.gameId));
        card.classList.toggle('is-owned', owned);
        const flag = card.querySelector('[data-owned]');
        if (flag) flag.hidden = !owned;
    });
}

function renderSaved() {
    const list = loadSaved();

    if (list.length === 0) {
        render(savedList, `<p class="settings-row__hint">Nenhum jogo do GameDB na sua Biblioteca ainda.</p>`);
        return;
    }

    render(savedList, list.map((entry) => `
        <div class="discover-saved__row" data-saved-id="${escapeHtml(entry.id)}">
            <span class="discover-saved__name">${escapeHtml(entry.game.title)}</span>
            <span class="badge">${escapeHtml(STATUSES[entry.status] ?? entry.status)}</span>
            <a class="btn btn-ghost btn-sm" href="library.html">Ver na Biblioteca</a>
        </div>
    `).join(''));
}

/* ============================================================
   BUSCA (com debounce)
   ============================================================ */

let searchToken = 0;

async function runSearch(term) {
    const token = ++searchToken;

    if (term.trim().length < 2) {
        render(results, '');
        status.textContent = 'A base tem mais de 400 mil títulos. Comece digitando.';
        return;
    }

    status.textContent = `Buscando “${term.trim()}”…`;
    render(results, skeletonCards());

    let hits = [];
    try {
        hits = await searchGames(term);
    } catch {
        if (token !== searchToken) return;
        render(results, '');
        status.textContent = 'Não foi possível acessar o GameDB agora. Tente novamente em instantes.';
        return;
    }

    // Uma busca mais recente ja assumiu: descarta este resultado.
    if (token !== searchToken) return;

    if (hits.length === 0) {
        render(results, emptyStateMarkup({
            iconName: 'search',
            title: 'Nenhum jogo encontrado',
            text: `Nada com "${term}" na base do GameDB.`,
        }));
        status.textContent = 'Nenhum resultado.';
        return;
    }

    status.textContent = `Total de resultados para "${term}": ${hits.length}.`;

    const games = await Promise.all(hits.map((hit) => getGame(hit.id)));
    if (token !== searchToken) return;

    const usable = games
        .map((game, index) => game ?? { id: hits[index].id, name: hits[index].name })
        .filter(Boolean);

    usable.forEach((game) => fetched.set(String(game.id), game));
    render(results, usable.map(cardMarkup).join(''));
    markOwned();

    usable.forEach((game) => {
        const node = results.querySelector(`[data-game-id="${CSS.escape(String(game.id))}"]`);
        if (node) fillPlatforms(game, node);
    });

    afterRender(results);
}

let debounceTimer = null;
search.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const term = search.value;
    // Espera o usuario parar de digitar: sem isso cada tecla dispara uma
    // requisicao ao GameDB.
    debounceTimer = setTimeout(() => runSearch(term), 350);
});

/* ============================================================
   INTERACOES
   ============================================================ */

results.addEventListener('click', (event) => {
    const button = event.target.closest('[data-save]');
    if (!button) return;
    saveInteraction(button.closest('[data-game-id]').dataset.gameId, button.dataset.save);
});

renderSaved();
