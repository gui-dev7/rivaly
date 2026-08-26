/**
 * ui.js — shared presentation helpers.
 *
 * Deliberately small. This is not a rendering framework: it is a set of
 * pure functions that return strings or DOM nodes. Pages own their own
 * markup; this module only removes duplication.
 *
 * It is also the reason the project ships with zero image assets —
 * avatars and cover art are generated deterministically from a seed,
 * so there is nothing to 404.
 */

/* ============================================================
   DOM
   ============================================================ */

export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

/**
 * Escapes text before it is interpolated into a template literal.
 * Every value that originates from the user passes through here.
 */
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Replaces the children of `container` in a single reflow.
 * `html` may be a string or an array of strings.
 */
export function render(container, html) {
    if (!container) return;
    container.innerHTML = Array.isArray(html) ? html.join('') : html;
}

/** Builds a detached fragment from an array of HTML strings. */
export function fragmentFrom(htmlList) {
    const template = document.createElement('template');
    template.innerHTML = htmlList.join('');
    return template.content;
}

/* ============================================================
   FORMATTERS
   ============================================================ */

export const formatNumber = (value) => Number(value ?? 0).toLocaleString('en-US');

export function formatHours(hours) {
    const value = Number(hours) || 0;
    if (value < 1 && value > 0) return `${Math.round(value * 60)}m`;
    return `${Math.round(value).toLocaleString('en-US')}h`;
}

export function formatRelativeTime(isoString) {
    const then = new Date(isoString).getTime();
    if (Number.isNaN(then)) return '';
    const seconds = Math.round((Date.now() - then) / 1000);

    if (seconds < 45) return 'just now';
    if (seconds < 90) return 'a minute ago';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(then).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/** Deterministic 32-bit hash (djb2). Used for every generated visual. */
export function hashString(input) {
    let hash = 5381;
    const text = String(input ?? '');
    for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

export const initialsOf = (name) =>
    String(name ?? '?')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0] ?? '')
        .join('')
        .toUpperCase() || '?';

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* ============================================================
   ICONS
   A hand-authored inline SVG set. No icon font, no CDN.
   All icons share a 24×24 box and inherit `currentColor`.
   ============================================================ */

const ICON_PATHS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9.5"/>',
    id: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><circle cx="8.5" cy="11" r="2.5"/><path d="M4.5 17c.6-1.8 2.1-2.8 4-2.8s3.4 1 4 2.8"/><path d="M15 9.5h4M15 12.5h4M15 15.5h2.5"/>',
    library: '<rect x="3" y="4" width="5" height="16" rx="1.2"/><rect x="10" y="4" width="5" height="16" rx="1.2"/><path d="m17.4 5.7 3.2 14"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.7-3.2 3-5 6-5s5.3 1.8 6 5"/><path d="M16 5.3a3.2 3.2 0 0 1 0 5.9"/><path d="M18 15.4c2 .7 3.3 2.3 3.8 4.6"/>',
    trophy: '<path d="M7 4h10v6a5 5 0 0 1-10 0z"/><path d="M7 6H4.5v1.5A3.5 3.5 0 0 0 8 11"/><path d="M17 6h2.5v1.5A3.5 3.5 0 0 1 16 11"/><path d="M12 15v3"/><path d="M8.5 21h7l-.8-3h-5.4z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.5 7.5l2 1.2M17.5 15.3l2 1.2M4.5 16.5l2-1.2M17.5 8.7l2-1.2"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="m4.5 12.5 5 5 10-11"/>',
    star: '<path d="m12 3.6 2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 17.4l-5.3 2.9 1.1-6.1L3.4 10l6-.8z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="m14.5 5.5 4 4"/>',
    trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.8h5V7"/><path d="M6.5 7v12a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V7"/><path d="M10.5 11v6M13.5 11v6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4.5 4.5"/>',
    'chevron-right': '<path d="m9 5 7 7-7 7"/>',
    'chevron-left': '<path d="m15 5-7 7 7 7"/>',
    'chevron-down': '<path d="m5 9 7 7 7-7"/>',
    'arrow-right': '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
    'arrow-up': '<path d="M12 20V5"/><path d="m6 11 6-6 6 6"/>',
    spark: '<path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.4l-1.9-5.6L4.5 10.9 10.1 9z"/><path d="M18.5 16.5 19.4 19l2.6.9-2.6.9-.9 2.5"/>',
    dna: '<path d="M7 3c0 5 10 5 10 10S7 18 7 21"/><path d="M17 3c0 5-10 5-10 10s10 5 10 8"/><path d="M8.5 7.5h7M8.5 16.5h7M10 11h4"/>',
    controller: '<path d="M7.5 8h9a5 5 0 0 1 4.9 4.1l.5 3.1A2.8 2.8 0 0 1 19.2 18c-1 0-1.9-.5-2.4-1.4L16 15.2H8l-.8 1.4A2.8 2.8 0 0 1 4.8 18a2.8 2.8 0 0 1-2.7-2.8l.5-3.1A5 5 0 0 1 7.5 8z"/><path d="M7 11v2.5M5.8 12.2h2.5"/><circle cx="16" cy="11.6" r=".9"/><circle cx="17.9" cy="13.4" r=".9"/>',
    shield: '<path d="M12 3 5 5.8v5.4c0 4.3 2.9 8.2 7 9.6 4.1-1.4 7-5.3 7-9.6V5.8z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    gem: '<path d="m12 3.5 7 5-7 12-7-12z"/><path d="M5 8.5h14M9.5 8.5 12 20.5l2.5-12L12 3.5z"/>',
    crown: '<path d="M4 8.5 7.5 13 12 5.5 16.5 13 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/>',
    flag: '<path d="M5.5 21V3.5"/><path d="M5.5 4.5h11l-1.8 3.5 1.8 3.5h-11z"/>',
    medal: '<circle cx="12" cy="15" r="5.5"/><path d="m8.5 10-3-7M15.5 10l3-7"/><path d="m12 12.8 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
    infinity: '<path d="M7 9c-2 0-3.5 1.3-3.5 3S5 15 7 15c3.5 0 4.5-6 8-6 2 0 3.5 1.3 3.5 3s-1.5 3-3.5 3c-3.5 0-4.5-6-8-6z"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    stack: '<path d="m12 3 8.5 4.5L12 12 3.5 7.5z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>',
    bell: '<path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10z"/><path d="M10.2 19a2 2 0 0 0 3.6 0"/>',
    logout: '<path d="M14.5 16.5V19a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 19V5a1.5 1.5 0 0 1 1.5-1.5H13A1.5 1.5 0 0 1 14.5 5v2.5"/><path d="M9.5 12H21"/><path d="m17.5 8.5 3.5 3.5-3.5 3.5"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.9" r=".9" fill="currentColor" stroke="none"/>',
    alert: '<path d="M12 4.5 21 19.5H3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',
    'x-circle': '<circle cx="12" cy="12" r="8.5"/><path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6"/>',
    'check-circle': '<circle cx="12" cy="12" r="8.5"/><path d="m8.2 12.3 2.6 2.6 5-5.4"/>',
    play: '<path d="M8 5.5 18.5 12 8 18.5z"/>',
    zap: '<path d="M13.5 3 5.5 13.5H12l-1.5 7.5 8-10.5H12z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.2 2.4 3.4 5.4 3.4 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.4-5.4-3.4-8.5S9.8 5.9 12 3.5z"/>',
    mic: '<rect x="9.5" y="3" width="5" height="10" rx="2.5"/><path d="M6 11.5a6 6 0 0 0 12 0"/><path d="M12 17.5V21"/>',
    'mic-off': '<path d="M9.5 5.5A2.5 2.5 0 0 1 14.5 5.5v3.2"/><path d="M14.5 12.2a2.5 2.5 0 0 1-5-1.7"/><path d="M6 11.5a6 6 0 0 0 9 5.2"/><path d="M4 4l16 16"/><path d="M12 17.5V21"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17"/><path d="M8 3v4M16 3v4"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.5 3.5-5.5 7-5.5s6.2 2 7 5.5"/>',
    drag: '<circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
    filter: '<path d="M3.5 5.5h17l-6.5 7.5V19l-4 1.5v-7.5z"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5.2-5.2 2 2-5.2z"/>',
    layers: '<path d="M12 3.5 20 8l-8 4.5L4 8z"/><path d="m4 12.5 8 4.5 8-4.5"/>',
    bolt: '<path d="M13.5 3 5.5 13.5H12l-1.5 7.5 8-10.5H12z"/>',
    /* The RIVALY mark: two chevrons meeting. Rival + Ally. */
    rivaly: '<path d="M3.5 3.5 11 12l-7.5 8.5V15L6 12 3.5 9z" fill="currentColor" stroke="none"/><path d="M20.5 3.5 13 12l7.5 8.5V15L18 12l2.5-3z" fill="currentColor" stroke="none"/>',
    lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M4 4l16 16"/><path d="M9.5 9.7a3 3 0 0 0 4.2 4.2"/><path d="M6.5 6.8C4 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1"/><path d="M18.4 15.4c1.9-1.6 3.1-3.4 3.1-3.4S18 5.5 12 5.5c-.7 0-1.4.1-2 .3"/>',

    /* --- Platform glyphs ---
       Drawn here rather than downloaded: the icon set is already
       hand-authored in this style, and original glyphs avoid shipping
       trademarked brand logos in an academic repository. */
    'platform-pc': '<rect x="2.5" y="4.5" width="19" height="12" rx="1.6"/><path d="M8 20h8"/><path d="M12 16.5V20"/>',
    'platform-playstation': '<path d="M10 3.6v13.9l4.3 1.4V8.4c0-.9-.5-1.5-1.4-1.8L10 3.6z"/><path d="M4.5 16.6c-1.4.5-1.9 1.2-1.4 1.8.7.7 2.6.9 4.5.4l1.1-.3"/><path d="M15.7 15.9l3.5-1.1c1.5-.5 1.9-1.2 1.3-1.8-.7-.6-2.4-.8-4.1-.4"/>',
    'platform-xbox': '<circle cx="12" cy="12" r="8.5"/><path d="M6.4 5.9c2.2 1 4.1 2.6 5.6 4.4 1.5-1.8 3.4-3.4 5.6-4.4"/><path d="M4.6 17.6c1.1-3 3.2-5.6 5.4-7.6"/><path d="M19.4 17.6c-1.1-3-3.2-5.6-5.4-7.6"/>',
    'platform-switch': '<rect x="3" y="3.5" width="7.5" height="17" rx="2.4"/><rect x="13.5" y="3.5" width="7.5" height="17" rx="2.4"/><circle cx="6.75" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="17.25" cy="15" r="1.1" fill="currentColor" stroke="none"/>',
    'platform-mobile': '<rect x="6.5" y="2.5" width="11" height="19" rx="2.2"/><path d="M10.5 5.5h3"/><path d="M11 18.5h2"/>',
};

/** Maps a platform id from data.js onto its glyph. */
export const platformIcon = (platformId) => `platform-${platformId}`;

/**
 * Returns an inline SVG string.
 * Icons are decorative by default; pass a `title` to expose one to AT.
 */
export function icon(name, { size = 20, className = '', title = '' } = {}) {
    const path = ICON_PATHS[name] ?? ICON_PATHS.info;
    const a11y = title
        ? `role="img" aria-label="${escapeHtml(title)}"`
        : 'aria-hidden="true" focusable="false"';
    return `<svg class="${escapeHtml(className)}" ${a11y} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

/* ============================================================
   PROCEDURAL AVATAR
   A deterministic geometric identicon. Same seed → same face,
   forever, on every device, with no network request.
   ============================================================ */

const AVATAR_SHAPES = ['circle', 'diamond', 'blade', 'ring', 'chevron', 'hexagon'];

export function avatarSvg(seed, { size = 64 } = {}) {
    const hash = hashString(seed || 'rivaly');
    const hueA = hash % 360;
    const hueB = (hueA + 40 + (hash % 70)) % 360;
    const shape = AVATAR_SHAPES[hash % AVATAR_SHAPES.length];
    const rotation = (hash % 4) * 90;
    const gradientId = `av-${hash.toString(36)}`;

    const shapes = {
        circle: '<circle cx="32" cy="32" r="15"/>',
        diamond: '<path d="M32 15 49 32 32 49 15 32z"/>',
        blade: '<path d="M18 46 46 18v16a12 12 0 0 1-12 12z"/>',
        ring: '<path d="M32 16a16 16 0 1 0 0 32 16 16 0 0 0 0-32zm0 9a7 7 0 1 1 0 14 7 7 0 0 1 0-14z"/>',
        chevron: '<path d="M18 20h10l14 12-14 12H18l14-12z"/>',
        hexagon: '<path d="M32 15 47 23.5v17L32 49l-15-8.5v-17z"/>',
    };

    return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" focusable="false">
        <defs>
            <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="hsl(${hueA} 72% 58%)"/>
                <stop offset="100%" stop-color="hsl(${hueB} 68% 42%)"/>
            </linearGradient>
        </defs>
        <rect width="64" height="64" fill="hsl(${hueA} 34% 13%)"/>
        <g fill="url(#${gradientId})" transform="rotate(${rotation} 32 32)">${shapes[shape]}</g>
        <rect width="64" height="64" fill="none" stroke="hsl(${hueA} 60% 60% / 0.28)" stroke-width="2"/>
    </svg>`;
}

/** Convenience wrapper: a full `.avatar` element. */
export function avatarMarkup(seed, { size = 'md', ring = false, className = '' } = {}) {
    const sizeClass = size === 'md' ? '' : `avatar--${size}`;
    const px = { sm: 32, md: 40, lg: 56, xl: 88, '2xl': 120 }[size] ?? 40;
    return `<span class="avatar ${sizeClass} ${ring ? 'avatar--ring' : ''} ${escapeHtml(className)}">${avatarSvg(seed, { size: px })}</span>`;
}

/* ============================================================
   PROCEDURAL COVER ART
   Each game gets a stable, distinct cover built from its hue,
   a diagonal light sweep and its two-letter monogram.
   ============================================================ */

export function coverArt(game, { className = '', eager = false } = {}) {
    const hue = game?.hue ?? hashString(game?.title) % 360;
    const glyph = escapeHtml(game?.glyph ?? initialsOf(game?.title));
    const hue2 = (hue + 34) % 360;

    // The gradient + monogram stay underneath as the fallback layer. If the
    // artwork is missing or fails to decode, app.js strips the <img> and this
    // is what shows — no broken-image icon, no visible 404.
    const art = game?.id
        ? `<img class="cover__img" src="/assets/covers/${encodeURIComponent(game.id)}.webp"
                alt="" decoding="async" ${eager ? '' : 'loading="lazy"'} data-fallback>`
        : '';

    return `<span class="cover ${escapeHtml(className)}" style="--cover-a: hsl(${hue} 62% 26%); --cover-b: hsl(${hue2} 58% 12%); --cover-line: hsl(${hue} 78% 62% / 0.34);" aria-hidden="true">
        <span class="cover__glyph">${glyph}</span>
        ${art}
    </span>`;
}

/**
 * Wide key-art banner. Only the Steam-sourced titles have one, so callers
 * must tolerate an empty string.
 */
export function bannerArt(game, { className = '' } = {}) {
    if (!game?.steamAppId) return '';
    return `<img class="banner-art ${escapeHtml(className)}"
        src="/assets/banners/${encodeURIComponent(game.id)}.webp"
        alt="" decoding="async" loading="lazy" data-fallback>`;
}

/* ============================================================
   SMALL SHARED FRAGMENTS
   ============================================================ */

export function progressMarkup({ value = 0, variant = '', label = '' } = {}) {
    const pct = clamp(value, 0, 100);
    return `<div class="progress ${variant}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"${label ? ` aria-label="${escapeHtml(label)}"` : ''}>
        <div class="progress__fill" data-progress="${pct}"></div>
    </div>`;
}

export function emptyStateMarkup({ iconName = 'spark', title, text, action = '' }) {
    return `<div class="empty">
        <span class="empty__glyph">${icon(iconName, { size: 24 })}</span>
        <p class="empty__title">${escapeHtml(title)}</p>
        <p class="empty__text">${escapeHtml(text)}</p>
        ${action ? `<div class="empty__action">${action}</div>` : ''}
    </div>`;
}

export function tipMarkup(text, { end = false } = {}) {
    return `<button type="button" class="tip ${end ? 'tip--end' : ''}" data-tooltip="${escapeHtml(text)}" aria-label="${escapeHtml(text)}">?</button>`;
}

/** Star rating display (read-only). */
export function starsMarkup(rating) {
    const value = clamp(Math.round(Number(rating) || 0), 0, 5);
    return `<span class="stars" aria-label="${value} out of 5">${
        Array.from({ length: 5 }, (_, index) =>
            `<span class="stars__item ${index < value ? 'is-on' : ''}">${icon('star', { size: 12 })}</span>`
        ).join('')
    }</span>`;
}
