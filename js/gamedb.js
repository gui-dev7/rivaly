/**
 * gamedb.js — acesso ao LizardByte GameDB.
 *
 * Base publica, sem chave de API e sem backend: tudo sai de `fetch()`
 * direto para os JSONs estaticos do GameDB.
 *
 * Os nomes de campo abaixo NAO foram inventados. Vieram da leitura de um
 * registro real (`/games/119133.json`, Elden Ring), que traz:
 *
 *   name           string
 *   cover          { id, url }   url protocolo-relativo, tamanho t_thumb
 *   platforms      number[]      IDs, resolvidos por /platforms/all.json
 *   release_dates  [{ y, platform, date, release_region }]
 *   genres         [{ id, name }]
 *   summary        string
 *   slug, id, url, rating, screenshots, artworks, ...
 *
 * A busca replica a logica de bucket do proprio GameDB: o termo e reduzido
 * aos seus dois primeiros caracteres alfanumericos, que nomeiam o arquivo
 * de indice. E por isso que a busca e barata — nunca se baixa a base toda.
 */

const BASE = 'https://app.lizardbyte.dev/GameDB';

/* Cache em memoria: a mesma sessao nao repete requisicao. */
const bucketCache = new Map();
const gameCache = new Map();
let platformsPromise = null;

/** Bucket do termo, exatamente como o GameDB calcula. */
export function bucketFor(term) {
    return term.replace(/[^a-z0-9]/gi, '').slice(0, 2).toLowerCase() || '@';
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`GameDB respondeu ${response.status}`);
    return response.json();
}

/** Mapa id -> plataforma. Buscado uma vez por sessao. */
export function getPlatforms() {
    platformsPromise ??= fetchJson(`${BASE}/platforms/all.json`).catch(() => ({}));
    return platformsPromise;
}

/**
 * Busca jogos pelo nome.
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function searchGames(term, { limit = 24 } = {}) {
    const query = term.trim();
    if (query.length < 2) return [];

    const bucket = bucketFor(query);

    if (!bucketCache.has(bucket)) {
        bucketCache.set(bucket, fetchJson(`${BASE}/buckets/${encodeURIComponent(bucket)}.json`).catch(() => ({})));
    }
    const data = await bucketCache.get(bucket);

    const needle = query.toLowerCase();
    const hits = [];
    for (const [id, entry] of Object.entries(data)) {
        const name = entry?.name;
        if (typeof name !== 'string') continue;
        const haystack = name.toLowerCase();
        if (!haystack.includes(needle)) continue;
        // Quem comeca com o termo vem antes; depois, nome mais curto primeiro,
        // que costuma ser a edicao base em vez de um DLC.
        hits.push({ id, name, rank: haystack.startsWith(needle) ? 0 : 1 });
    }

    hits.sort((a, b) => a.rank - b.rank || a.name.length - b.name.length || a.name.localeCompare(b.name));
    return hits.slice(0, limit).map(({ id, name }) => ({ id, name }));
}

/** Registro completo de um jogo. */
export async function getGame(id) {
    if (!gameCache.has(String(id))) {
        gameCache.set(String(id), fetchJson(`${BASE}/games/${id}.json`).catch(() => null));
    }
    return gameCache.get(String(id));
}

/**
 * URL da capa no tamanho pedido.
 *
 * O GameDB entrega `//images.igdb.com/.../t_thumb/<hash>.jpg`. O `t_thumb`
 * tem 90px e fica borrado em card, entao trocamos pelo tamanho desejado —
 * e a URL vem sem protocolo, o que quebraria em `https:`.
 */
export function coverUrl(game, size = 't_cover_big') {
    const raw = game?.cover?.url;
    if (typeof raw !== 'string' || !raw) return null;
    const absolute = raw.startsWith('//') ? `https:${raw}` : raw;
    return absolute.replace('/t_thumb/', `/${size}/`);
}

/** Nomes das plataformas a partir dos IDs numericos do registro. */
export async function platformNames(game) {
    const ids = Array.isArray(game?.platforms) ? game.platforms : [];
    if (ids.length === 0) return [];

    const all = await getPlatforms();
    return ids
        .map((id) => {
            const entry = all?.[String(id)];
            return entry?.abbreviation || entry?.name || null;
        })
        .filter(Boolean);
}

/** Ano de lancamento mais antigo declarado. */
export function releaseYear(game) {
    const dates = Array.isArray(game?.release_dates) ? game.release_dates : [];
    const years = dates.map((d) => d?.y).filter((y) => typeof y === 'number');
    return years.length > 0 ? Math.min(...years) : null;
}

/** Generos como lista de nomes. */
export function genreNames(game) {
    const genres = Array.isArray(game?.genres) ? game.genres : [];
    return genres.map((g) => g?.name).filter(Boolean);
}
