/**
 * cards.js — the shared visual blocks.
 *
 * Pure functions that return HTML strings (every value escaped). Game
 * and player cards are Bootstrap cards (.card / .card-body /
 * .card-title / .card-text) dressed in the RIVALY identity.
 */

import {
    icon, escapeHtml, coverArt, avatarMarkup, starsMarkup, platformIcon, gameImageMarkup,
    formatHours, formatRelativeTime, formatNumber,
} from './ui.js';
import {
    LIBRARY_STATUSES, PLATFORMS, ROLES, SCHEDULES, PLAYSTYLES,
    DNA_ATTRIBUTES, LANGUAGES, RARITIES, rankLabel, regionLabel, genreLabel,
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
        <article class="card game-card status-${escapeHtml(entry.status)}" data-entry="${escapeHtml(entry.id)}"${draggable ? ' draggable="true"' : ''}>
            <div class="game-card__cover">
                ${coverArt(game)}
                <span class="game-card__status">${escapeHtml(statusLabel(entry.status))}</span>
                ${draggable ? `<span class="game-card__grip" aria-hidden="true">${icon('drag', { size: 14 })}</span>` : ''}

                <div class="game-card__actions">
                    <button type="button" class="btn btn-secondary btn-icon btn-sm" data-action="edit" data-entry="${escapeHtml(entry.id)}" aria-label="Editar ${escapeHtml(game.title)}">
                        ${icon('edit', { size: 14 })}
                    </button>
                    <button type="button" class="btn btn-secondary btn-icon btn-sm" data-action="remove" data-entry="${escapeHtml(entry.id)}" aria-label="Remover ${escapeHtml(game.title)} da sua biblioteca">
                        ${icon('trash', { size: 14 })}
                    </button>
                </div>
            </div>

            <div class="card-body game-card__body">
                <h3 class="card-title game-card__title">${escapeHtml(game.title)}</h3>
                <p class="card-text game-card__meta">
                    ${icon(platformIcon(entry.platform), { size: 13, className: 'platform-glyph', title: platformLabel(entry.platform) })}
                    <span>${escapeHtml(platformLabel(entry.platform))}</span>
                    <span aria-hidden="true">·</span>
                    <span>${escapeHtml(formatHours(entry.hours))}</span>
                </p>
                <div class="game-card__footer">
                    ${entry.rating ? starsMarkup(entry.rating) : '<span class="game-card__unrated">Sem nota</span>'}
                    <span class="game-card__genre">${escapeHtml(genreLabel(game.genre[0] ?? ''))}</span>
                </div>
            </div>
        </article>
    `;
}

/** Compact row used on the Dashboard "Jogando agora" list. */
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
        style="--cover-a:hsl(${game.hue} 62% 30%);--cover-b:hsl(${hue2} 58% 14%)">${escapeHtml(game.glyph)}${
        gameImageMarkup(game, { type: 'cover' })}</span>`;
}

/* ============================================================
   SQUAD CARD
   ============================================================ */

/**
 * @param {object} player Record from PLAYERS.
 * @param {object} result Output of calculateTotalCompatibility().
 * @param {{saved?:boolean, compact?:boolean, selectable?:boolean, selected?:boolean}} [options]
 */
export function squadCardMarkup(player, result, { saved = false, compact = false, selectable = false, selected = false } = {}) {
    const { total, tier, highlights, deductions } = result;

    const reasons = compact
        ? highlights.slice(0, 2)
        : highlights.slice(0, 5);

    return `
        <article class="card squad-card tier-${escapeHtml(tier.id)}${selected ? ' is-selected' : ''}" data-player="${escapeHtml(player.id)}">
            <div class="card-body squad-card__body">
                <header class="squad-card__head">
                    ${avatarMarkup(player.nickname + player.id, { size: 'lg' })}
                    <div class="squad-card__identity">
                        <h3 class="card-title squad-card__nick">
                            <button type="button" class="link-reset" data-player-card="${escapeHtml(player.id)}">${escapeHtml(player.nickname)}</button>
                        </h3>
                        <p class="card-text squad-card__meta">
                            ${escapeHtml(rankLabel(player.rank))} · ${escapeHtml(labelOf(PLAYSTYLES, player.playstyle))} · ${escapeHtml(regionLabel(player.region))}
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

                ${compact ? '' : `<p class="card-text squad-card__bio">${escapeHtml(player.bio)}</p>`}

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
                            ${player.voiceChat ? 'Voz' : 'Só texto'}
                        </span>
                        ${player.languages.map((language) => `<span class="tag">${escapeHtml(labelOf(LANGUAGES, language))}</span>`).join('')}
                    </div>
                `}
            </div>

            <footer class="card-footer squad-card__foot">
                ${selectable ? `
                    <div class="form-check squad-card__pick">
                        <input class="form-check-input" type="checkbox" id="pick-${escapeHtml(player.id)}" data-pick="${escapeHtml(player.id)}"${selected ? ' checked' : ''}>
                        <label class="form-check-label" for="pick-${escapeHtml(player.id)}">Chamar para a sessão</label>
                    </div>` : ''}
                <div class="squad-card__actions">
                    <button type="button" class="btn btn-outline-light btn-sm" data-action="breakdown" data-player="${escapeHtml(player.id)}">
                        ${icon('info', { size: 14 })} Ver a conta
                    </button>
                    <button type="button" class="btn ${saved ? 'btn-secondary' : 'btn-primary'} btn-sm" data-action="save" data-player="${escapeHtml(player.id)}"${saved ? ' disabled' : ''}>
                        ${saved ? 'Salvo no squad' : 'Salvar parceiro'}
                    </button>
                </div>
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
                <button type="button" class="squad-row__nick link-reset" data-player-card="${escapeHtml(player.id)}">${escapeHtml(player.nickname)}</button>
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
        <article class="medal-card rarity-${escapeHtml(rarity)} ${unlocked ? '' : 'medal-card--locked'}"
                 data-badge="${escapeHtml(achievement.id)}"
                 title="${escapeHtml(unlocked ? achievement.description : achievement.hint)}">
            <span class="medal-card__medal">${icon(unlocked ? achievement.icon : 'lock', { size: 24 })}</span>
            <span class="medal-card__name">${escapeHtml(achievement.name)}</span>
            <span class="medal-card__desc">${escapeHtml(unlocked ? achievement.description : achievement.hint)}</span>
            <span class="medal-card__rarity">${escapeHtml(RARITIES[rarity]?.label ?? rarity)}</span>
            ${unlocked && achievement.unlockedAt
                ? `<span class="medal-card__date">${escapeHtml(formatRelativeTime(achievement.unlockedAt))}</span>`
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
