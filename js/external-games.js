/**
 * external-games.js — catalogo minimo dos jogos vindos do GameDB.
 *
 * A Biblioteca resolve cada entrada pelo `gameId` no catalogo curado de
 * data.js. Jogos descobertos no GameDB nao existem la, entao precisam de um
 * registro proprio — caso contrario a entrada salva apontaria para o nada e
 * o card nao teria titulo nem capa.
 *
 * O que guardamos e deliberadamente raso: apenas o que a Biblioteca precisa
 * para desenhar (titulo, capa, plataformas, ano, generos). Nao e uma copia
 * da base do GameDB, e sim o minimo para a entrada existir offline.
 */

import { KEYS, read, write } from './storage.js';
import { PLATFORMS } from './data.js';

export const EXTERNAL_PREFIX = 'gamedb:';

export const isExternalId = (gameId) => String(gameId ?? '').startsWith(EXTERNAL_PREFIX);
export const externalIdFor = (gamedbId) => `${EXTERNAL_PREFIX}${gamedbId}`;

const load = () => read(KEYS.externalGames, {});

/** Registro do catalogo externo, ou null. */
export function getExternalGame(gameId) {
    return load()[gameId] ?? null;
}

/** Grava (ou atualiza) o registro raso de um jogo externo. */
export function saveExternalGame(game) {
    if (!game?.id) return null;
    const all = load();
    all[game.id] = game;
    write(KEYS.externalGames, all);
    return game;
}

/** Remove o registro quando nenhuma entrada da Biblioteca mais o usa. */
export function pruneExternalGames(usedIds) {
    const all = load();
    const keep = {};
    Object.entries(all).forEach(([id, game]) => {
        if (usedIds.includes(id)) keep[id] = game;
    });
    write(KEYS.externalGames, keep);
}

/* ------------------------------------------------------------
   TRADUCAO GameDB -> formato do catalogo
   ------------------------------------------------------------ */

/** Plataformas do GameDB caem nos cinco baldes que o app entende. */
const PLATFORM_RULES = [
    [/playstation|ps[1-5]\b|psp|ps vita/i, 'playstation'],
    [/xbox/i, 'xbox'],
    [/nintendo|switch|wii|game ?boy|3ds|nes|snes/i, 'switch'],
    [/android|ios|iphone|ipad|mobile/i, 'mobile'],
    [/pc|windows|mac|linux|dos/i, 'pc'],
];

export function mapPlatforms(names = []) {
    const ids = new Set();
    names.forEach((name) => {
        const rule = PLATFORM_RULES.find(([pattern]) => pattern.test(name));
        if (rule) ids.add(rule[1]);
    });
    // Uma entrada sem plataforma nenhuma quebraria o seletor da Biblioteca.
    if (ids.size === 0) ids.add('pc');
    return PLATFORMS.map((p) => p.id).filter((id) => ids.has(id));
}

/** Hue estavel a partir do id, para o fallback de capa combinar sempre. */
function hueFor(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 360;
    return hash;
}

/**
 * Converte um registro do GameDB no formato que a Biblioteca renderiza.
 * @param {object} raw    registro cru do GameDB
 * @param {object} extras { cover, platformNames, year, genres }
 */
export function toCatalogueGame(raw, { cover = null, platformNames = [], year = null, genres = [] } = {}) {
    const id = externalIdFor(raw.id);
    const title = String(raw.name ?? 'Sem título');

    return {
        id,
        title,
        genre: genres.slice(0, 3),
        platform: mapPlatforms(platformNames),
        hue: hueFor(id),
        glyph: title.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '??',
        year: year ?? null,
        competitive: false,
        steamId: null,
        source: 'gamedb',
        gamedbId: String(raw.id),
        customAssets: cover ? { cover } : undefined,
    };
}
