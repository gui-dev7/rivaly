/**
 * cards.js — the shared visual blocks.
 *
 * Pure functions that return HTML strings. Every one of these maps to
 * a future React component (GameCard, SquadCard, AchievementCard,
 * ActivityItem, DnaList), which is why they take data and return
 * markup rather than touching the DOM.
 */

import {
    icon, escapeHtml, coverArt, avatarMarkup, starsMarkup, platformIcon,
    formatHours, formatRelativeTime, formatNumber,
} from './ui.js';
import {
    LIBRARY_STATUSES, PLATFORMS, ROLES, SCHEDULES, PLAYSTYLES,
    DNA_ATTRIBUTES, LANGUAGES,
} from './data.js';
import { ACTIVITY_ICONS } from './activity.js';

const labelOf = (collection, id) => collection.find((item) => item.id === id)?.label ?? id;

const statusLabel = (id) => labelOf(LIBRARY_STATUSES, id);
const platformLabel = (id) => labelOf(PLATFORMS, id);

/* ============================================================
   GAME CARD
   ============================================================ */

/**
 * @param {object} entry  A hydrated library entry (entry + entry.game).
 * @param {{draggable?:boolean}} [options]
 */
export function gameCardMarkup(entry, { draggable = false } = {}) {
    const { game } = entry;
    return `
        <article class="game-card status-${escapeHtml(entry.status)}" data-entry="${escapeHtml(entry.id)}"${draggable ? ' draggable="true"' : ''}>
            <div class="game-card__cover">
                ${coverArt(game)}
                <span class="game-card__status">${escapeHtml(statusLabel(entry.status))}</span>
                ${draggable ? `<span class="game-card__grip" aria-hidden="true">${icon('drag', { size: 14 })}</span>` : ''}

                <div class="game-card__actions">
                    <button type="button" class="btn btn--secondary btn--icon btn--sm" data-action="edit" data-entry="${escapeHtml(entry.id)}" aria-label="Edit ${escapeHtml(game.title)}">
                        ${icon('edit', { size: 14 })}
                    </button>
                    <button type="button" class="btn btn--secondary btn--icon btn--sm" data-action="remove" data-entry="${escapeHtml(entry.id)}" aria-label="Remove ${escapeHtml(game.title)} from your library">
                        ${icon('trash', { size: 14 })}
                    </button>
                </div>
            </div>

            <div class="game-card__body">
                <h3 class="game-card__title">${escapeHtml(game.title)}</h3>
                <p class="game-card__meta">
                    ${icon(platformIcon(entry.platform), { size: 13, className: 'platform-glyph', title: platformLabel(entry.platform) })}
                    <span>${escapeHtml(platformLabel(entry.platform))}</span>
                    <span aria-hidden="true">·</span>
                    <span>${escapeHtml(formatHours(entry.hours))}</span>
                </p>
                <div class="game-card__footer">
                    ${entry.rating ? starsMarkup(entry.rating) : '<span class="game-card__unrated">Not rated</span>'}
                    <span class="game-card__genre">${escapeHtml(game.genre[0])}</span>
                </div>
            </div>
        </article>
    `;
}

/** Compact row used on the Dashboard "Currently playing" list. */
export function gameRowMarkup(entry) {
    const { game } = entry;
    return `
        <li class="game-row">
            <span class="game-row__cover">${coverArt(game)}</span>
            <span class="game-row__body">
                <span class="game-row__title">${escapeHtml(game.title)}</span>
                <span class="game-row__meta">
                    ${icon(platformIcon(entry.platform), { size: 12, className: 'platform-glyph', title: platformLabel(entry.platform) })}
                    ${escapeHtml(platformLabel(entry.platform))} · ${escapeHtml(formatHours(entry.hours))}
                </span>
            </span>
            ${entry.rating ? starsMarkup(entry.rating) : ''}
        </li>
    `;
}

/**
 * The 26px game tile used inside the Passport card's "currently playing"
 * list. Previously copy-pasted inline in landing.js, onboarding.js and
 * passport.js; this is the single definition.
 *
 * The monogram + gradient remain underneath the thumbnail as the fallback.
 */
export function gameMarkMarkup(game) {
    const hue2 = (game.hue + 34) % 360;
    return `<span class="passport-card__game-mark"
        style="--cover-a:hsl(${game.hue} 62% 30%);--cover-b:hsl(${hue2} 58% 14%)">${escapeHtml(game.glyph)}<img
        src="assets/covers/${encodeURIComponent(game.id)}.webp" alt="" decoding="async" loading="lazy" data-fallback></span>`;
}

/* ============================================================
   SQUAD CARD
   ============================================================ */

/**
 * @param {object} player Record from PLAYERS.
 * @param {object} result Output of calculateTotalCompatibility().
 * @param {{saved?:boolean, compact?:boolean}} [options]
 */
export function squadCardMarkup(player, result, { saved = false, compact = false } = {}) {
    const { total, tier, highlights, deductions } = result;

    const reasons = compact
        ? highlights.slice(0, 2)
        : highlights.slice(0, 5);

    return `
        <article class="squad-card tier-${escapeHtml(tier.id)}" data-player="${escapeHtml(player.id)}">
            <header class="squad-card__head">
                ${avatarMarkup(player.nickname + player.id, { size: 'lg' })}
                <div class="squad-card__identity">
                    <h3 class="squad-card__nick">${escapeHtml(player.nickname)}</h3>
                    <p class="squad-card__meta">
                        ${escapeHtml(player.rank)} · ${escapeHtml(labelOf(PLAYSTYLES, player.playstyle))} · ${escapeHtml(player.region)}
                    </p>
                </div>
                <div class="squad-card__score">
                    <span class="squad-card__percent numeric" data-count="${total}">${total}%</span>
                    <span class="squad-card__tier">${escapeHtml(tier.label)}</span>
                </div>
            </header>

            <div class="squad-card__meter">
                <span class="squad-card__meter-fill" data-progress="${total}"></span>
            </div>

            ${compact ? '' : `<p class="squad-card__bio">${escapeHtml(player.bio)}</p>`}

            <ul class="squad-card__reasons">
                ${reasons.map((part) => `
                    <li class="squad-card__reason is-positive">
                        ${icon('check', { size: 12 })}
                        <span>${escapeHtml(part.reason)}</span>
                    </li>
                `).join('')}
                ${compact ? '' : deductions.slice(0, 3).map((part) => `
                    <li class="squad-card__reason is-negative">
                        ${icon('minus', { size: 12 })}
                        <span>${escapeHtml(part.reason)}</span>
                        <span class="squad-card__cost numeric">−${part.lost}</span>
                    </li>
                `).join('')}
            </ul>

            ${compact ? '' : `
                <div class="squad-card__tags">
                    ${player.roles.map((role) => `<span class="tag tag--primary">${escapeHtml(labelOf(ROLES, role))}</span>`).join('')}
                    ${player.schedules.map((slot) => `<span class="tag">${escapeHtml(labelOf(SCHEDULES, slot))}</span>`).join('')}
                    <span class="tag ${player.voiceChat ? 'tag--accent' : ''}">
                        ${icon(player.voiceChat ? 'mic' : 'mic-off', { size: 11 })}
                        ${player.voiceChat ? 'Voice' : 'Text only'}
                    </span>
                    ${player.languages.map((language) => `<span class="tag">${escapeHtml(labelOf(LANGUAGES, language))}</span>`).join('')}
                </div>
            `}

            <footer class="squad-card__foot">
                <button type="button" class="btn btn--secondary btn--sm" data-action="breakdown" data-player="${escapeHtml(player.id)}">
                    ${icon('info', { size: 14 })} Breakdown
                </button>
                <button type="button" class="btn ${saved ? 'btn--ghost' : 'btn--primary'} btn--sm" data-action="save" data-player="${escapeHtml(player.id)}"${saved ? ' disabled' : ''}>
                    ${saved ? 'Saved to squad' : 'Add to squad'}
                </button>
            </footer>
        </article>
    `;
}

/** Minimal teammate row for the Dashboard suggestion block. */
export function squadRowMarkup(player, result) {
    return `
        <li class="squad-row tier-${escapeHtml(result.tier.id)}">
            ${avatarMarkup(player.nickname + player.id, { size: 'sm' })}
            <span class="squad-row__body">
                <span class="squad-row__nick">${escapeHtml(player.nickname)}</span>
                <span class="squad-row__meta">${escapeHtml(result.highlights[0]?.reason ?? player.bio)}</span>
            </span>
            <span class="squad-row__score numeric">${result.total}%</span>
        </li>
    `;
}

/* ============================================================
   ACHIEVEMENT CARD
   ============================================================ */

export function badgeMarkup(achievement) {
    const { unlocked, rarity } = achievement;
    return `
        <article class="badge rarity-${escapeHtml(rarity)} ${unlocked ? '' : 'badge--locked'}"
                 data-badge="${escapeHtml(achievement.id)}"
                 title="${escapeHtml(unlocked ? achievement.description : achievement.hint)}">
            <span class="badge__medal">${icon(unlocked ? achievement.icon : 'lock', { size: 24 })}</span>
            <span class="badge__name">${escapeHtml(achievement.name)}</span>
            <span class="badge__desc">${escapeHtml(unlocked ? achievement.description : achievement.hint)}</span>
            <span class="badge__rarity">${escapeHtml(rarity)}</span>
            ${unlocked && achievement.unlockedAt
                ? `<span class="badge__date">${escapeHtml(formatRelativeTime(achievement.unlockedAt))}</span>`
                : ''}
        </article>
    `;
}

/* ============================================================
   ACTIVITY
   ============================================================ */

export function activityItemMarkup(entry) {
    return `
        <li class="activity-item">
            <span class="activity-item__icon activity-item__icon--${escapeHtml(entry.type)}">
                ${icon(ACTIVITY_ICONS[entry.type] ?? 'spark', { size: 14 })}
            </span>
            <span class="activity-item__body">
                <span class="activity-item__text">${escapeHtml(entry.message)}</span>
                <span class="activity-item__time">${escapeHtml(formatRelativeTime(entry.at))}</span>
            </span>
            ${entry.meta?.xp ? `<span class="activity-item__xp numeric">+${formatNumber(entry.meta.xp)}</span>` : ''}
        </li>
    `;
}

/* ============================================================
   DNA LIST
   ============================================================ */

export function dnaListMarkup(scores, { large = false, animate = true } = {}) {
    return `<div class="dna-list">${DNA_ATTRIBUTES.map((attribute) => {
        const value = scores?.[attribute.id] ?? 0;
        return `
            <div class="dna-bar ${large ? 'dna-bar--lg' : ''}" style="--dna-color:${attribute.color}">
                <span class="dna-bar__label">${escapeHtml(attribute.label)}</span>
                <span class="dna-bar__track">
                    <span class="dna-bar__fill"${animate ? ` data-progress="${value}"` : ` style="transform:scaleX(${value / 100})"`}></span>
                </span>
                <span class="dna-bar__value numeric">${value}</span>
            </div>
        `;
    }).join('')}</div>`;
}

/* ============================================================
   STAT TILE
   ============================================================ */

/**
 * @param {{label:string, value:string|number, meta?:string, icon?:string,
 *          tooltip?:string, accent?:string, count?:number}} options
 */
export function statMarkup({ label, value, meta = '', icon: iconName = 'spark', tooltip = '', accent = 'var(--color-primary)', count = null }) {
    return `
        <article class="stat" style="--stat-icon:${accent};--stat-glow:${accent}22">
            <p class="stat__label">
                ${icon(iconName, { size: 13, className: 'stat__icon' })}
                ${escapeHtml(label)}
                ${tooltip ? `<button type="button" class="tip" data-tooltip="${escapeHtml(tooltip)}" aria-label="${escapeHtml(tooltip)}">?</button>` : ''}
            </p>
            <p class="stat__value numeric"${count !== null ? ` data-count="${count}"` : ''}>${escapeHtml(String(value))}</p>
            ${meta ? `<p class="stat__meta">${escapeHtml(meta)}</p>` : ''}
        </article>
    `;
}
