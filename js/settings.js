/**
 * settings.js — controller for the Settings page.
 *
 * Preferences, storage transparency, data export and the demo reset.
 * Every switch here has a real effect; nothing is decorative.
 */

import { bootApp, applySettings, haltModule } from './app.js';
import {
    KEYS, getSettings, saveSettings, resetAll, read, isPersistent,
} from './storage.js';
import { clearActivity } from './activity.js';
import { currentAccount, logout } from './auth.js';
import { confirmDialog } from './modal.js';
import { toast } from './notifications.js';
import { progressSnapshot } from './gamification.js';
import { $, render, escapeHtml, avatarMarkup, formatNumber } from './ui.js';

const user = bootApp({
    page: 'settings',
    title: 'Settings',
    subtitle: 'Preferences and local data',
});
if (!user) await haltModule();

/* ============================================================
   ACCOUNT
   ============================================================ */

const account = currentAccount();
const snapshot = progressSnapshot();

render($('#accountInfo'), `
    <div class="settings-account__row">
        ${avatarMarkup(user.avatarSeed, { size: 'lg' })}
        <div>
            <p class="settings-account__nick">${escapeHtml(user.nickname)}</p>
            <p class="settings-account__meta">${escapeHtml(account?.email ?? user.email)}</p>
            <p class="settings-account__meta numeric">${escapeHtml(user.gamerId)} · Level ${snapshot.level} · ${formatNumber(snapshot.xp)} XP</p>
        </div>
    </div>
`);

$('#signOutBtn').addEventListener('click', async () => {
    const confirmed = await confirmDialog({
        title: 'Sign out?',
        message: 'Your data stays in this browser. You can sign back in with the same email at any time.',
        confirmLabel: 'Sign out',
    });
    if (!confirmed) return;
    logout();
    window.location.href = 'index.html';
});

/* ============================================================
   PREFERENCES
   ============================================================ */

const settings = getSettings();

const toggles = [
    { id: 'reducedMotionToggle', key: 'reducedMotion', label: 'Reduce motion' },
    { id: 'toastsToggle', key: 'toastsEnabled', label: 'Toast notifications' },
    { id: 'densityToggle', key: 'compactDensity', label: 'Compact density' },
];

toggles.forEach(({ id, key, label }) => {
    const input = document.getElementById(id);
    input.checked = Boolean(settings[key]);

    input.addEventListener('change', () => {
        saveSettings({ [key]: input.checked });
        applySettings();

        // The toasts switch has to confirm itself before it takes effect.
        if (key === 'toastsEnabled' && !input.checked) {
            toast({ title: 'Toasts disabled', message: 'You can re-enable them here at any time.', type: 'info' });
        } else {
            toast({
                title: `${label} ${input.checked ? 'enabled' : 'disabled'}`,
                type: 'info',
            });
        }
    });
});

/* ============================================================
   STORAGE TRANSPARENCY
   ============================================================ */

const STORAGE_LABELS = {
    version: 'Schema version',
    accounts: 'Accounts (sign-in simulation)',
    session: 'Active session',
    user: 'Gamer Passport',
    library: 'Game Library',
    achievements: 'Unlocked achievements',
    activity: 'Activity ledger',
    squads: 'Saved squad',
    settings: 'Interface preferences',
};

function describe(value) {
    if (value === null || value === undefined) return 'empty';
    if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
    if (typeof value === 'object') return `${Object.keys(value).length} field${Object.keys(value).length === 1 ? '' : 's'}`;
    return String(value);
}

function sizeOf(key) {
    // Accessing localStorage can throw outright in restricted contexts.
    let raw = null;
    try {
        raw = window.localStorage.getItem(key);
    } catch {
        return '—';
    }
    if (!raw) return '0 B';
    const bytes = new Blob([raw]).size;
    return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}

function renderStorage() {
    const rows = Object.entries(KEYS).map(([name, key]) => {
        const value = read(key, null);
        return `
            <div class="storage-row">
                <code class="storage-row__key">${escapeHtml(key)}</code>
                <span class="storage-row__label">${escapeHtml(STORAGE_LABELS[name] ?? name)}</span>
                <span class="storage-row__value">${escapeHtml(describe(value))}</span>
                <span class="storage-row__size numeric">${escapeHtml(sizeOf(key))}</span>
            </div>
        `;
    }).join('');

    render($('#storageTable'), `
        <div class="storage-row storage-row--head">
            <span>Key</span><span>Contents</span><span>Value</span><span>Size</span>
        </div>
        ${rows}
        ${isPersistent()
            ? ''
            : '<p class="storage-warning">Local storage is unavailable in this browser context. The app is running from memory and nothing will survive a refresh.</p>'}
    `);
}

renderStorage();

/* ============================================================
   EXPORT
   ============================================================ */

$('#exportBtn').addEventListener('click', () => {
    const payload = Object.fromEntries(
        Object.entries(KEYS)
            .filter(([name]) => name !== 'accounts' && name !== 'session') // never export credentials
            .map(([name, key]) => [name, read(key, null)])
    );

    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...payload }, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `rivaly-${user.nickname.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast({
        title: 'Data exported.',
        message: 'Your passport, library, achievements and activity — account credentials excluded.',
        type: 'success',
    });
});

/* ============================================================
   CLEAR ACTIVITY
   ============================================================ */

$('#clearActivityBtn').addEventListener('click', async () => {
    const confirmed = await confirmDialog({
        title: 'Clear the activity history?',
        message: 'Only the activity ledger is removed. Your Passport, Library, XP and achievements are untouched.',
        confirmLabel: 'Clear history',
        danger: true,
    });
    if (!confirmed) return;

    clearActivity();
    renderStorage();
    toast({ title: 'Activity history cleared.', type: 'info' });
});

/* ============================================================
   RESET
   ============================================================ */

$('#resetBtn').addEventListener('click', async () => {
    const confirmed = await confirmDialog({
        title: 'Reset all demo data?',
        message: 'Your Passport, Gamer DNA, Library, achievements, activity and saved squad are permanently deleted from this browser. Your sign-in account is kept.',
        confirmLabel: 'Reset everything',
        cancelLabel: 'Keep my data',
        danger: true,
    });
    if (!confirmed) return;

    resetAll({ keepAccounts: true });
    window.location.href = 'login.html?mode=signin';
});

/* ============================================================
   ABOUT
   ============================================================ */

const ABOUT = [
    ['Version', 'V1 — Vanilla'],
    ['Stack', 'HTML5 · CSS3 · JavaScript (ES Modules)'],
    ['Runtime dependencies', 'None'],
    ['Image assets', 'None — avatars and covers are generated'],
    ['Persistence', 'localStorage (namespaced)'],
    ['Backend', 'None'],
    ['Next version', 'React + Tailwind CSS'],
];

render($('#aboutList'), ABOUT.map(([term, value]) => `
    <div class="about-list__row">
        <dt>${escapeHtml(term)}</dt>
        <dd>${escapeHtml(value)}</dd>
    </div>
`).join(''));
