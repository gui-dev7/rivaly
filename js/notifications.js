/**
 * notifications.js — the product's own feedback layer.
 *
 * Three surfaces, one module:
 *   toast()              → transient bottom-right messages
 *   showAchievement()    → celebratory unlock overlay
 *   showLevelUp()        → level progression overlay
 *
 * `window.alert` is never used for product feedback.
 * A single live region is created lazily and reused, so repeated
 * notifications never accumulate DOM nodes or listeners.
 */

import { icon, escapeHtml } from './ui.js';
import { getSettings } from './storage.js';

const TOAST_ICONS = {
    success: 'check-circle',
    info: 'info',
    warning: 'alert',
    error: 'x-circle',
    achievement: 'trophy',
};

const DEFAULT_DURATION = 4200;
const MAX_VISIBLE = 4;

let region = null;

function ensureRegion() {
    if (region && document.body.contains(region)) return region;
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'false');
    document.body.appendChild(region);
    return region;
}

function dismiss(node) {
    if (!node || node.dataset.leaving === '1') return;
    node.dataset.leaving = '1';
    node.classList.add('is-leaving');
    const remove = () => node.remove();
    node.addEventListener('animationend', remove, { once: true });
    // Safety net for reduced-motion, where animationend may not fire.
    window.setTimeout(remove, 400);
}

/**
 * @param {object} options
 * @param {string} options.title    Short headline.
 * @param {string} [options.message] Supporting line.
 * @param {'success'|'info'|'warning'|'error'|'achievement'} [options.type]
 * @param {number} [options.xp]     Renders a "+N XP" pill.
 * @param {number} [options.duration]
 */
export function toast({ title, message = '', type = 'info', xp = 0, duration = DEFAULT_DURATION }) {
    if (!getSettings().toastsEnabled) return null;

    const host = ensureRegion();

    // Keep the stack readable: retire the oldest beyond the cap.
    const live = Array.from(host.children).filter((child) => child.dataset.leaving !== '1');
    if (live.length >= MAX_VISIBLE) dismiss(live[0]);

    const node = document.createElement('div');
    node.className = `toast toast--${type}`;
    node.innerHTML = `
        <span class="toast__icon">${icon(TOAST_ICONS[type] ?? 'info', { size: 14 })}</span>
        <div class="toast__body">
            <p class="toast__title">${escapeHtml(title)}</p>
            ${message ? `<p class="toast__message">${escapeHtml(message)}</p>` : ''}
            ${xp ? `<p class="toast__xp">+${xp} XP</p>` : ''}
        </div>
        <button type="button" class="toast__close" aria-label="Dismiss notification">${icon('close', { size: 12 })}</button>
    `;

    node.querySelector('.toast__close').addEventListener('click', () => dismiss(node));

    const timer = window.setTimeout(() => dismiss(node), duration);
    // Pausing on hover keeps long messages readable.
    node.addEventListener('mouseenter', () => window.clearTimeout(timer));
    node.addEventListener('mouseleave', () => window.setTimeout(() => dismiss(node), 1400));

    host.appendChild(node);
    return node;
}

export const toastSuccess = (title, message, xp) => toast({ title, message, xp, type: 'success' });
export const toastInfo = (title, message) => toast({ title, message, type: 'info' });
export const toastWarning = (title, message) => toast({ title, message, type: 'warning' });
export const toastError = (title, message) => toast({ title, message, type: 'error' });

/* ============================================================
   CELEBRATION OVERLAYS
   Only one can be on screen at a time; a queue keeps a burst of
   simultaneous unlocks from overlapping.
   ============================================================ */

const celebrationQueue = [];
let celebrationActive = false;

function playNext() {
    if (celebrationActive || celebrationQueue.length === 0) return;
    const build = celebrationQueue.shift();
    celebrationActive = true;

    const overlay = build();
    document.body.appendChild(overlay);

    const close = () => {
        if (!overlay.isConnected) return;
        overlay.classList.add('is-leaving');
        window.setTimeout(() => {
            overlay.remove();
            celebrationActive = false;
            document.removeEventListener('keydown', onKey);
            playNext();
        }, 260);
    };

    const onKey = (event) => {
        if (event.key === 'Escape') close();
    };

    overlay.querySelector('[data-dismiss]')?.addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) close();
    });
    document.addEventListener('keydown', onKey);
    window.setTimeout(close, 5200);
}

function enqueue(build) {
    celebrationQueue.push(build);
    playNext();
}

/**
 * @param {{name:string, description:string, rarity:string, icon:string}} achievement
 * @param {string} [context] Extra line, e.g. "94% compatibility".
 */
export function showAchievement(achievement, context = '') {
    enqueue(() => {
        const overlay = document.createElement('div');
        overlay.className = 'celebration';
        overlay.innerHTML = `
            <div class="celebration__card celebration__card--achievement rarity-${escapeHtml(achievement.rarity)}" role="alertdialog" aria-label="Achievement unlocked: ${escapeHtml(achievement.name)}">
                <p class="celebration__eyebrow">Achievement Unlocked</p>
                <div class="celebration__medal">${icon(achievement.icon ?? 'trophy', { size: 34 })}</div>
                <p class="celebration__title">${escapeHtml(achievement.name)}</p>
                <p class="celebration__text">${escapeHtml(context || achievement.description)}</p>
                <p class="celebration__rarity">${escapeHtml(achievement.rarity)}</p>
                <button type="button" class="btn btn--secondary btn--sm" data-dismiss>Dismiss</button>
            </div>
        `;
        return overlay;
    });
}

/**
 * @param {number} from Previous level.
 * @param {number} to   New level.
 */
export function showLevelUp(from, to) {
    enqueue(() => {
        const overlay = document.createElement('div');
        overlay.className = 'celebration';
        overlay.innerHTML = `
            <div class="celebration__card celebration__card--level" role="alertdialog" aria-label="Level up. You reached level ${to}">
                <p class="celebration__eyebrow">Level Up</p>
                <div class="celebration__levels">
                    <span class="celebration__level celebration__level--old numeric">${from}</span>
                    <span class="celebration__arrow">${icon('arrow-right', { size: 22 })}</span>
                    <span class="celebration__level celebration__level--new numeric">${to}</span>
                </div>
                <p class="celebration__text">Your Gamer Passport just got heavier.</p>
                <button type="button" class="btn btn--primary btn--sm" data-dismiss>Continue</button>
            </div>
        `;
        return overlay;
    });
}
