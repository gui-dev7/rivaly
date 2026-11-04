/**
 * game-assets.js — the single place that knows where game artwork lives.
 *
 * No page controller, card renderer or template builds a Steam URL. They
 * ask for `cover`, `hero`, `header` or `capsule` and this module decides
 * where it comes from.
 *
 * Resolution order, per asset type (not per game):
 *
 *   1. game.customAssets[type]   explicit override always wins
 *   2. Steam CDN                 derived from game.steamId
 *   3. Rivaly fallback           rendered in CSS, never a broken image
 *
 * That order matters: the seven titles that are not on Steam only have
 * custom art, and an explicit override on a Steam game (a hand-picked
 * hero, say) has to beat the derived URL rather than lose to it.
 *
 * Artwork is loaded straight from the CDN by <img src>. There is no
 * fetch(), no Blob conversion, no proxy and no build step.
 */

const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';

/** Every asset type the product can ask for. */
export const ASSET_TYPES = ['cover', 'hero', 'header', 'capsule'];

/**
 * The four Steam files, derived from one app id.
 * @param {number|string} appId
 */
export function getSteamAssets(appId) {
    const base = `${STEAM_CDN}/${appId}`;
    return {
        cover: `${base}/library_600x900.jpg`,
        hero: `${base}/library_hero.jpg`,
        header: `${base}/header.jpg`,
        capsule: `${base}/capsule_616x353.jpg`,
    };
}

/**
 * Ordered alternates to try when the preferred file 404s.
 *
 * Steam does not guarantee every file for every app — `library_hero.jpg`
 * in particular is missing for a fair number of titles — so a horizontal
 * asset degrades through the other horizontal formats before giving up.
 */
const STEAM_ALTERNATES = {
    cover: ['header', 'capsule'],
    hero: ['header', 'capsule'],
    header: ['capsule', 'hero'],
    capsule: ['header', 'hero'],
};

/**
 * Resolves one asset to a single URL.
 * @returns {string|null} null when nothing is available and the caller
 *          should render the Rivaly fallback instead.
 */
export function resolveGameAsset(game, type = 'cover') {
    if (!game) return null;

    const custom = game.customAssets?.[type];
    if (custom) return custom;

    if (game.steamId) return getSteamAssets(game.steamId)[type] ?? null;

    return null;
}

/**
 * The full attempt order for one asset: the preferred URL first, then
 * every sensible alternate. Consumed by the image error handler in
 * app.js, which walks the list before falling back to the CSS artwork.
 *
 * @returns {string[]} may be empty — that is a valid "use the fallback".
 */
export function gameAssetChain(game, type = 'cover') {
    if (!game) return [];

    const chain = [];
    const push = (url) => {
        if (url && !chain.includes(url)) chain.push(url);
    };

    // 1. Explicit override for exactly this type.
    push(game.customAssets?.[type]);

    // 2. Steam, preferred file then its alternates.
    if (game.steamId) {
        const steam = getSteamAssets(game.steamId);
        push(steam[type]);
        (STEAM_ALTERNATES[type] ?? []).forEach((alt) => push(steam[alt]));
    }

    // 3. Any other custom art the game happens to carry.
    ASSET_TYPES.forEach((other) => push(game.customAssets?.[other]));

    return chain;
}

/**
 * All four resolved URLs for a game. Handy for a details screen that
 * wants everything at once.
 */
export function getGameAssets(game) {
    return Object.fromEntries(
        ASSET_TYPES.map((type) => [type, resolveGameAsset(game, type)])
    );
}

export const getGameCover = (game) => resolveGameAsset(game, 'cover');
export const getGameHero = (game) => resolveGameAsset(game, 'hero');
export const getGameHeader = (game) => resolveGameAsset(game, 'header');
export const getGameCapsule = (game) => resolveGameAsset(game, 'capsule');

/**
 * True when a game's artwork comes from the CDN, so callers can decide
 * whether a skeleton is worth showing (local files paint immediately).
 */
export const isRemoteArtwork = (game, type = 'cover') => {
    const url = resolveGameAsset(game, type);
    return typeof url === 'string' && url.startsWith('http');
};

/**
 * Builds the <img> attributes for a game asset, including the fallback
 * chain the global error handler walks. Returns an empty string when
 * there is nothing to load, letting the CSS fallback show through.
 *
 * @param {object} game
 * @param {object} [options]
 * @param {string} [options.type]   cover | hero | header | capsule
 * @param {string} [options.className]
 * @param {string} [options.alt]    '' marks the image decorative
 * @param {boolean} [options.eager] skip lazy loading (above the fold)
 */
export function gameImageAttrs(game, { type = 'cover', alt = '', eager = false } = {}) {
    const chain = gameAssetChain(game, type);
    if (chain.length === 0) return null;

    const [src, ...rest] = chain;
    return {
        src,
        alt,
        loading: eager ? 'eager' : 'lazy',
        decoding: 'async',
        fallbacks: rest,
    };
}
