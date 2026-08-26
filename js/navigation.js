/**
 * navigation.js — the application chrome.
 *
 * Every signed-in page ships the same landmarks in its HTML
 * (<aside>, <header>, <nav>) so the document outline is correct
 * without JavaScript. This module fills those landmarks with the
 * navigation itself, marks the current page, and wires the mobile
 * drawer. One implementation, six pages, no duplicated markup.
 */

import { icon, escapeHtml, avatarMarkup, formatNumber } from './ui.js';
import { getUser } from './storage.js';
import { levelProgress } from './gamification.js';
import { archetypeName } from './profile.js';
import { logout } from './auth.js';
import { confirmDialog } from './modal.js';

/**
 * `short` is used by the mobile bottom bar, where five labels have to
 * share 390px without truncating.
 */
export const NAV_ITEMS = [
    { id: 'dashboard', label: 'Home', short: 'Home', href: 'dashboard.html', icon: 'home' },
    { id: 'passport', label: 'Passport', short: 'Passport', href: 'passport.html', icon: 'id' },
    { id: 'library', label: 'Library', short: 'Library', href: 'library.html', icon: 'library' },
    { id: 'squads', label: 'Squads', short: 'Squads', href: 'squads.html', icon: 'users' },
    { id: 'achievements', label: 'Achievements', short: 'Badges', href: 'achievements.html', icon: 'trophy' },
    { id: 'settings', label: 'Settings', short: 'Settings', href: 'settings.html', icon: 'settings' },
];

/** Honest placeholders — rendered disabled, never clickable. */
const NAV_SOON = [
    { label: 'Arena', icon: 'target' },
    { label: 'Feed', icon: 'globe' },
    { label: 'Clans', icon: 'shield' },
];

const BOTTOM_ITEMS = ['dashboard', 'passport', 'library', 'squads', 'achievements'];

const brandMarkup = () => `
    <span class="brand-mark">${icon('rivaly', { size: 18 })}</span>
    <span class="brand-name">
        <span class="brand-name__top">RIVALY</span>
        <span class="brand-name__sub">Rival + Ally</span>
    </span>
`;

function sidebarMarkup(currentPage, user, progress) {
    const items = NAV_ITEMS.map((item) => `
        <a class="nav-item" href="${item.href}"${item.id === currentPage ? ' aria-current="page"' : ''}>
            ${icon(item.icon, { size: 17, className: 'nav-item__icon' })}
            <span>${item.label}</span>
        </a>
    `).join('');

    const soon = NAV_SOON.map((item) => `
        <span class="nav-item nav-item--soon" aria-disabled="true">
            ${icon(item.icon, { size: 17, className: 'nav-item__icon' })}
            <span>${item.label}</span>
            <span class="nav-item__badge">Soon</span>
        </span>
    `).join('');

    return `
        <a class="sidebar__brand" href="dashboard.html" aria-label="RIVALY — go to dashboard">
            ${brandMarkup()}
        </a>

        <nav class="sidebar__nav" aria-label="Sections">
            ${items}
            <p class="sidebar__group-label">Coming next</p>
            ${soon}
        </nav>

        <div class="sidebar__footer">
            <a class="mini-passport" href="passport.html">
                <span class="mini-passport__top">
                    ${avatarMarkup(user.avatarSeed, { size: 'sm' })}
                    <span class="mini-passport__name">
                        <span class="mini-passport__nick">${escapeHtml(user.nickname)}</span>
                        <span class="mini-passport__archetype">${escapeHtml(archetypeName(user))}</span>
                    </span>
                </span>
                <span class="mini-passport__xp">
                    <span>LV ${progress.level}</span>
                    <span>${formatNumber(progress.currentLevelXp)} / ${formatNumber(progress.nextLevelXp)}</span>
                </span>
                <span class="progress progress--thin progress--xp">
                    <span class="progress__fill" data-progress="${progress.percent}"></span>
                </span>
            </a>
        </div>
    `;
}

function topbarMarkup({ title, subtitle }, progress) {
    return `
        <button type="button" class="menu-toggle" data-menu-toggle aria-label="Open navigation" aria-expanded="false" aria-controls="sidebar">
            ${icon('menu', { size: 17 })}
        </button>
        <div class="topbar__heading">
            <p class="topbar__title">${escapeHtml(title)}</p>
            ${subtitle ? `<p class="topbar__subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <div class="topbar__actions">
            <div class="topbar__xp" title="Experience toward the next level">
                <span class="level-pill">
                    <span class="level-pill__num numeric">${progress.level}</span>
                    <span class="level-pill__label">Level</span>
                </span>
                <span class="progress progress--thin progress--xp topbar__xp-bar">
                    <span class="progress__fill" data-progress="${progress.percent}"></span>
                </span>
                <span class="topbar__xp-text">${formatNumber(progress.currentLevelXp)}/${formatNumber(progress.nextLevelXp)}</span>
            </div>
            <button type="button" class="btn btn--secondary btn--icon btn--sm" data-logout aria-label="Sign out">
                ${icon('logout', { size: 15 })}
            </button>
        </div>
    `;
}

function bottomNavMarkup(currentPage) {
    return NAV_ITEMS
        .filter((item) => BOTTOM_ITEMS.includes(item.id))
        .map((item) => `
            <a class="bottom-nav__item" href="${item.href}"${item.id === currentPage ? ' aria-current="page"' : ''}
               aria-label="${escapeHtml(item.label)}">
                ${icon(item.icon, { size: 19 })}
                <span>${escapeHtml(item.short)}</span>
            </a>
        `).join('');
}

/* ============================================================
   MOBILE DRAWER
   ============================================================ */

function initDrawer() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.querySelector('[data-menu-toggle]');
    if (!sidebar || !toggle) return;

    let scrim = null;

    const setOpen = (open) => {
        sidebar.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));

        if (open && !scrim) {
            scrim = document.createElement('div');
            scrim.className = 'drawer-scrim';
            scrim.addEventListener('click', () => setOpen(false));
            document.body.appendChild(scrim);
            document.body.classList.add('is-locked');
            sidebar.querySelector('.nav-item')?.focus();
        } else if (!open && scrim) {
            scrim.remove();
            scrim = null;
            document.body.classList.remove('is-locked');
        }
    };

    toggle.addEventListener('click', () => setOpen(!sidebar.classList.contains('is-open')));

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && sidebar.classList.contains('is-open')) {
            setOpen(false);
            toggle.focus();
        }
    });

    // Leaving the mobile breakpoint must not strand an open drawer.
    const breakpoint = window.matchMedia('(min-width: 1081px)');
    breakpoint.addEventListener('change', (event) => {
        if (event.matches) setOpen(false);
    });
}

/* ============================================================
   MOUNT
   ============================================================ */

/**
 * @param {{page: string, title: string, subtitle?: string}} options
 */
export function mountNavigation({ page, title, subtitle = '' }) {
    const user = getUser();
    if (!user) return;

    const progress = levelProgress(user.xp);

    const sidebar = document.querySelector('[data-sidebar]');
    const topbar = document.querySelector('[data-topbar]');
    const bottomNav = document.querySelector('[data-bottom-nav]');

    if (sidebar) sidebar.innerHTML = sidebarMarkup(page, user, progress);
    if (topbar) topbar.innerHTML = topbarMarkup({ title, subtitle }, progress);
    if (bottomNav) bottomNav.innerHTML = bottomNavMarkup(page);

    initDrawer();

    document.querySelector('[data-logout]')?.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
            title: 'Sign out?',
            message: 'Your Passport, Library and achievements stay saved in this browser. You can sign back in at any time.',
            confirmLabel: 'Sign out',
        });
        if (!confirmed) return;
        logout();
        window.location.href = 'index.html';
    });
}

/**
 * Re-renders only the XP indicators after a progression change,
 * so a level-up is reflected immediately without a page reload.
 */
export function refreshNavigationProgress() {
    const user = getUser();
    if (!user) return;
    const progress = levelProgress(user.xp);

    document.querySelectorAll('.level-pill__num').forEach((node) => {
        node.textContent = String(progress.level);
    });
    document.querySelectorAll('.topbar__xp-text').forEach((node) => {
        node.textContent = `${formatNumber(progress.currentLevelXp)}/${formatNumber(progress.nextLevelXp)}`;
    });
    document.querySelectorAll('.mini-passport__xp').forEach((node) => {
        node.innerHTML = `<span>LV ${progress.level}</span><span>${formatNumber(progress.currentLevelXp)} / ${formatNumber(progress.nextLevelXp)}</span>`;
    });
    document.querySelectorAll('.progress--xp .progress__fill').forEach((fill) => {
        fill.dataset.progress = String(progress.percent);
        fill.style.transform = `scaleX(${progress.percent / 100})`;
    });
}
