/**
 * avatar-service.js — the single place that knows where an avatar comes from.
 *
 * The rest of the product never asks "is this a DiceBear avatar or an
 * upload?". It calls `resolveAvatar(user)` and gets one shape back:
 *
 *   { type: 'dicebear', style, seed, src }
 *   { type: 'upload',   src }
 *   { type: 'initials', label }        <- rendered in CSS, never an <img>
 *
 * Nothing but a style + seed is persisted for DiceBear avatars, so the
 * URL is rebuilt on demand and localStorage stays tiny.
 */

import { escapeHtml, hashString, initialsOf } from './ui.js';

const DICEBEAR_API = 'https://api.dicebear.com/10.x';

/** Styles the product offers, grouped the way the picker shows them. */
export const AVATAR_CATEGORIES = [
    { id: 'all', label: 'Todos', styles: null },
    { id: 'pixel', label: 'Pixel', styles: ['pixel-art'] },
    { id: 'characters', label: 'Personagens', styles: ['adventurer'] },
    { id: 'bots', label: 'Robôs', styles: ['bottts'] },
    { id: 'minimal', label: 'Minimalistas', styles: ['lorelei'] },
];

/** style id -> the category it belongs to. */
export const STYLE_CATEGORY = {
    'pixel-art': 'pixel',
    adventurer: 'characters',
    bottts: 'bots',
    lorelei: 'minimal',
};

export const AVATAR_STYLES = Object.keys(STYLE_CATEGORY);

/**
 * The one function that builds a DiceBear URL. Everything else in the
 * project goes through it.
 *
 * @param {string} style e.g. 'pixel-art'
 * @param {string} seed  same seed always yields the same avatar
 */
export function getDiceBearAvatar(style, seed) {
    const safeStyle = AVATAR_STYLES.includes(style) ? style : AVATAR_STYLES[0];
    return `${DICEBEAR_API}/${safeStyle}/svg?seed=${encodeURIComponent(seed)}`;
}

/* ============================================================
   THE UNIFIED MODEL
   ============================================================ */

/**
 * Every user gets a stable avatar even if they never pick one: the
 * nickname is the seed, so `gui-dev7` always produces the same face.
 */
export function defaultAvatarFor(nickname) {
    const seed = String(nickname || 'rival').trim().toLowerCase();
    // Spread default styles across users rather than giving everyone pixel-art.
    const style = AVATAR_STYLES[hashString(seed) % AVATAR_STYLES.length];
    return { type: 'dicebear', style, seed };
}

/**
 * Normalises whatever is stored on the passport into the unified shape.
 * Accepts the legacy `avatarSeed` string so existing profiles keep their
 * avatar instead of silently resetting.
 */
export function resolveAvatar(user) {
    const stored = user?.avatar;

    if (stored?.type === 'upload' && stored.src) {
        return { type: 'upload', src: stored.src };
    }

    if (stored?.type === 'dicebear' && stored.seed) {
        return {
            type: 'dicebear',
            style: stored.style,
            seed: stored.seed,
            src: getDiceBearAvatar(stored.style, stored.seed),
        };
    }

    // Legacy profiles stored a bare seed string for the procedural avatar.
    const legacySeed = user?.avatarSeed;
    const fallback = defaultAvatarFor(legacySeed || user?.nickname);
    return { ...fallback, src: getDiceBearAvatar(fallback.style, fallback.seed) };
}

/** What to persist. Never the SVG itself. */
export function serialiseAvatar(avatar) {
    if (avatar?.type === 'upload') return { type: 'upload', src: avatar.src };
    return { type: 'dicebear', style: avatar.style, seed: avatar.seed };
}

/* ============================================================
   MARKUP
   ============================================================ */

/**
 * Initials plate. This is the fallback that shows when a DiceBear
 * request fails or the user is offline — never a broken image icon.
 */
export function initialsMarkup(label) {
    const initials = initialsOf(label || 'Rival');
    const hue = hashString(String(label || 'rival'));
    return `<span class="avatar__initials" style="--tilt:${hue % 12 - 6}deg">${escapeHtml(initials)}</span>`;
}

const SIZE_PX = { sm: 32, md: 40, lg: 56, xl: 88, '2xl': 120 };

/**
 * Renders a user's avatar. The initials plate sits underneath; the image
 * is layered on top and removed by the global error handler if it fails,
 * so the plate becomes the avatar.
 *
 * @param {object} user
 * @param {{size?:string, ring?:boolean, className?:string, alt?:string, eager?:boolean}} options
 */
export function userAvatarMarkup(user, { size = 'md', ring = false, className = '', alt = '', eager = false } = {}) {
    const avatar = resolveAvatar(user);
    const label = user?.nickname ?? 'Rival';
    const px = SIZE_PX[size] ?? 40;
    const sizeClass = size === 'md' ? '' : `avatar--${size}`;

    return `<span class="avatar ${sizeClass} ${ring ? 'avatar--ring' : ''} ${escapeHtml(className)}"${alt ? '' : ' aria-hidden="true"'}>
        ${initialsMarkup(label)}
        <img class="avatar__img" src="${escapeHtml(avatar.src)}"
             alt="${escapeHtml(alt)}" width="${px}" height="${px}"
             ${eager ? '' : 'loading="lazy"'} decoding="async" data-fallback>
    </span>`;
}

/**
 * Same, for a raw {style, seed} pair — used by the picker grid, where
 * there is no user object yet.
 */
export function avatarOptionMarkup({ style, seed }, { alt = '' } = {}) {
    return `<img class="avatar__img" src="${escapeHtml(getDiceBearAvatar(style, seed))}"
        alt="${escapeHtml(alt)}" width="72" height="72"
        loading="lazy" decoding="async" data-fallback>`;
}
