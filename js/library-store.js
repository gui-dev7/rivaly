/**
 * library-store.js — CRUD for the Biblioteca de Jogos.
 *
 * Pure data layer: no DOM, no toasts, no XP. The page controller
 * (library.js) and the onboarding flow both build on top of it, which
 * keeps a single definition of what a library entry is.
 *
 * An entry:
 *   { id, gameId, status, platform, hours, rating, note, addedAt, updatedAt }
 */

import { getLibrary, saveLibrary } from './storage.js';
import { getGameById, LIBRARY_STATUSES } from './data.js';
import { getExternalGame, saveExternalGame, isExternalId, pruneExternalGames } from './external-games.js';

const VALID_STATUSES = LIBRARY_STATUSES.map((status) => status.id);

const clampHours = (value) => Math.max(0, Math.min(99999, Math.round(Number(value) || 0)));
const clampRating = (value) => Math.max(0, Math.min(5, Math.round(Number(value) || 0)));

export const listEntries = () => getLibrary();

export const findEntry = (entryId) =>
    getLibrary().find((entry) => entry.id === entryId) ?? null;

export const hasGame = (gameId) =>
    getLibrary().some((entry) => entry.gameId === gameId);

/**
 * Resolve um gameId no catalogo curado ou no catalogo externo (GameDB).
 * Sem isto, uma entrada vinda do Descobrir nao teria titulo nem capa.
 */
export function resolveGame(gameId) {
    return getGameById(gameId) ?? (isExternalId(gameId) ? getExternalGame(gameId) : null);
}

/** Joins an entry with its catalogue record for rendering. */
export function hydrate(entry) {
    return { ...entry, game: resolveGame(entry.gameId) };
}

export const listHydrated = () => getLibrary().map(hydrate).filter((entry) => entry.game);

/**
 * @returns {{ok:boolean, entry?:object, reason?:string}}
 */
export function addEntry({ gameId, status = 'backlog', platform, hours = 0, rating = 0, note = '', game: external = null }) {
    // Um jogo do Descobrir chega com o proprio registro: guardamos antes de
    // resolver, senao a entrada apontaria para um catalogo que nao o conhece.
    if (external && isExternalId(gameId)) saveExternalGame(external);

    const game = resolveGame(gameId);
    if (!game) return { ok: false, reason: 'Jogo desconhecido.' };
    if (hasGame(gameId)) return { ok: false, reason: `${game.title} já está na sua Biblioteca.` };

    const entry = {
        id: `lib-${Date.now().toString(36)}-${Math.abs(gameId.length * 31 + getLibrary().length)}`,
        gameId,
        status: VALID_STATUSES.includes(status) ? status : 'backlog',
        platform: game.platform.includes(platform) ? platform : game.platform[0],
        hours: clampHours(hours),
        rating: clampRating(rating),
        note: String(note ?? '').slice(0, 200),
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    saveLibrary([entry, ...getLibrary()]);
    return { ok: true, entry };
}

/**
 * @returns {{ok:boolean, entry?:object, statusChanged?:boolean}}
 */
export function updateEntry(entryId, patch) {
    const entries = getLibrary();
    const index = entries.findIndex((entry) => entry.id === entryId);
    if (index < 0) return { ok: false };

    const current = entries[index];
    const next = {
        ...current,
        ...patch,
        status: VALID_STATUSES.includes(patch.status ?? current.status)
            ? (patch.status ?? current.status)
            : current.status,
        hours: patch.hours === undefined ? current.hours : clampHours(patch.hours),
        rating: patch.rating === undefined ? current.rating : clampRating(patch.rating),
        note: patch.note === undefined ? current.note : String(patch.note).slice(0, 200),
        updatedAt: new Date().toISOString(),
    };

    entries[index] = next;
    saveLibrary(entries);

    return {
        ok: true,
        entry: next,
        statusChanged: next.status !== current.status,
        ratingChanged: next.rating !== current.rating && next.rating > 0,
        hoursAdded: Math.max(0, next.hours - current.hours),
    };
}

export function removeEntry(entryId) {
    const entries = getLibrary();
    const target = entries.find((entry) => entry.id === entryId);
    if (!target) return { ok: false };
    saveLibrary(entries.filter((entry) => entry.id !== entryId));

    // Sem isto o catalogo externo acumularia registros de jogos que a
    // Biblioteca nao referencia mais.
    pruneExternalGames(getLibrary().filter((e) => isExternalId(e.gameId)).map((e) => e.gameId));

    return { ok: true, entry: target };
}

/* ------------------------------------------------------------------
   AGGREGATES
   ------------------------------------------------------------------ */

export function statusCounts() {
    const entries = getLibrary();
    const counts = Object.fromEntries(VALID_STATUSES.map((status) => [status, 0]));
    entries.forEach((entry) => {
        if (counts[entry.status] !== undefined) counts[entry.status] += 1;
    });
    return { ...counts, all: entries.length };
}

export function librarySummary() {
    const entries = listHydrated();
    const hours = entries.reduce((sum, entry) => sum + entry.hours, 0);
    const rated = entries.filter((entry) => entry.rating > 0);
    const averageRating = rated.length
        ? Math.round((rated.reduce((sum, entry) => sum + entry.rating, 0) / rated.length) * 10) / 10
        : 0;

    const genreTally = new Map();
    entries.forEach((entry) => {
        entry.game.genre.forEach((genre) => {
            genreTally.set(genre, (genreTally.get(genre) ?? 0) + 1);
        });
    });

    const topGenres = [...genreTally.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 4)
        .map(([genre, count]) => ({ genre, count }));

    return {
        total: entries.length,
        hours,
        averageRating,
        topGenres,
        platforms: [...new Set(entries.map((entry) => entry.platform))],
        playing: entries.filter((entry) => entry.status === 'playing'),
        completed: entries.filter((entry) => entry.status === 'completed').length,
    };
}
