/**
 * login.js — controller for the authentication screen.
 *
 * Handles tab switching, live validation, submission and the
 * profile-switch confirmation. All credential logic lives in auth.js.
 */

import { bootPublic, haltModule } from './app.js';
import {
    register, login, switchProfile, redirectIfAuthenticated,
    validateNickname, validateEmail, validatePassword,
} from './auth.js';
import { awardXp, checkAchievements } from './gamification.js';
import { logActivity } from './activity.js';
import { toastError, toastSuccess } from './notifications.js';
import { confirmDialog } from './modal.js';
import { icon, $ } from './ui.js';

bootPublic();

// A signed-in visitor never sees this page.
if (redirectIfAuthenticated()) await haltModule();

/* ============================================================
   TABS
   ============================================================ */

const tabs = Array.from(document.querySelectorAll('[data-tab]'));
const panels = {
    signin: $('#panelSignin'),
    create: $('#panelCreate'),
};
const titleNode = $('#authFormTitle');
const subtitleNode = $('#authSubtitle');

const COPY = {
    signin: { title: 'Welcome back', subtitle: 'Sign back into your Gamer Passport.' },
    create: { title: 'Create your Passport', subtitle: 'Three fields, then the interesting part begins.' },
};

function activateTab(mode, { focus = false } = {}) {
    const target = mode === 'create' ? 'create' : 'signin';

    tabs.forEach((tab) => {
        const selected = tab.dataset.tab === target;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
    });

    Object.entries(panels).forEach(([key, panel]) => {
        panel.hidden = key !== target;
        if (key === target) panel.classList.add('anim-fade-up');
    });

    titleNode.textContent = COPY[target].title;
    subtitleNode.textContent = COPY[target].subtitle;
    document.title = `${COPY[target].title} — RIVALY`;

    if (focus) {
        panels[target].querySelector('input')?.focus();
    }
}

tabs.forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab, { focus: true }));
});

// Arrow-key navigation between tabs, per the WAI-ARIA tabs pattern.
document.querySelector('[role="tablist"]').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    tabs[nextIndex].focus();
    activateTab(tabs[nextIndex].dataset.tab);
});

document.querySelectorAll('[data-goto-tab]').forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.gotoTab, { focus: true }));
});

// Deep link: login.html?mode=create
const params = new URLSearchParams(window.location.search);
activateTab(params.get('mode') === 'create' ? 'create' : 'signin');

/* ============================================================
   PASSWORD VISIBILITY
   ============================================================ */

document.querySelectorAll('[data-reveal-password]').forEach((button) => {
    const input = document.getElementById(button.dataset.revealPassword);
    const paint = () => {
        const shown = input.type === 'text';
        button.innerHTML = icon(shown ? 'eye-off' : 'eye', { size: 16 });
        button.setAttribute('aria-label', shown ? 'Hide password' : 'Show password');
        button.setAttribute('aria-pressed', String(shown));
    };
    paint();
    button.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
        paint();
        input.focus();
    });
});

/* ============================================================
   VALIDATION
   ============================================================ */

function setFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    const errorNode = document.getElementById(`${inputId}Error`);
    if (!input || !errorNode) return;

    errorNode.textContent = message;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');

    if (message) {
        input.classList.remove('anim-shake');
        void input.offsetWidth; // restart the animation
        input.classList.add('anim-shake');
    }
}

function clearErrorsOnInput(inputId) {
    const input = document.getElementById(inputId);
    input?.addEventListener('input', () => setFieldError(inputId, ''));
}

['signinEmail', 'signinPassword', 'createNickname', 'createEmail', 'createPassword']
    .forEach(clearErrorsOnInput);

function withLoading(button, isLoading) {
    button.classList.toggle('is-loading', isLoading);
    button.disabled = isLoading;
}

/* ============================================================
   SIGN IN
   ============================================================ */

panels.signin.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = $('#signinEmail').value;
    const password = $('#signinPassword').value;
    const submit = $('#signinSubmit');

    const emailError = validateEmail(email);
    if (emailError) {
        setFieldError('signinEmail', emailError);
        $('#signinEmail').focus();
        return;
    }
    if (!password) {
        setFieldError('signinPassword', 'Password is required.');
        $('#signinPassword').focus();
        return;
    }

    withLoading(submit, true);
    const result = await login({ email, password });
    withLoading(submit, false);

    if (!result.ok) {
        setFieldError(result.field === 'password' ? 'signinPassword' : 'signinEmail', result.error);
        toastError('Could not sign in', result.error);
        return;
    }

    if (result.needsProfileSwitch) {
        const confirmed = await confirmDialog({
            title: 'Replace the local Passport?',
            message: `This browser currently holds a Passport for a different account. Version 1 keeps one Passport per browser, so signing in as ${result.account.nickname} will clear the existing Library, achievements and activity.`,
            confirmLabel: 'Replace and continue',
            cancelLabel: 'Cancel',
            danger: true,
        });
        if (!confirmed) return;
        switchProfile(result.account);
        window.location.href = 'onboarding.html';
        return;
    }

    toastSuccess('Signed in', `Welcome back, ${result.account.nickname}.`);
    logActivity('account', 'Signed in');
    window.location.href = params.get('redirect') || 'dashboard.html';
});

/* ============================================================
   DEMO ACCOUNT
   A shortcut for evaluating the product without walking the
   onboarding each time. It seeds real state and lets the real
   achievement engine decide what unlocks.
   ============================================================ */

$('#demoLoginBtn').addEventListener('click', async (event) => {
    const button = event.currentTarget;

    const confirmed = await confirmDialog({
        title: 'Load the demo Passport?',
        message: 'This replaces any Passport, library and achievements currently stored in this browser with a finished demo profile.',
        confirmLabel: 'Load demo',
        cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    withLoading(button, true);
    const { seedDemoAccount } = await import('./demo.js');
    const { nickname } = seedDemoAccount();

    toastSuccess('Demo Passport ready', `Signed in as ${nickname}.`);
    window.location.href = 'dashboard.html';
});

/* ============================================================
   CREATE
   ============================================================ */

panels.create.addEventListener('submit', async (event) => {
    event.preventDefault();

    const nickname = $('#createNickname').value;
    const email = $('#createEmail').value;
    const password = $('#createPassword').value;
    const submit = $('#createSubmit');

    const checks = [
        ['createNickname', validateNickname(nickname)],
        ['createEmail', validateEmail(email)],
        ['createPassword', validatePassword(password)],
    ];

    const firstError = checks.find(([, message]) => message);
    checks.forEach(([field, message]) => setFieldError(field, message));

    if (firstError) {
        document.getElementById(firstError[0]).focus();
        return;
    }

    withLoading(submit, true);
    const result = await register({ nickname, email, password });

    if (!result.ok) {
        withLoading(submit, false);
        setFieldError(`create${result.field.charAt(0).toUpperCase()}${result.field.slice(1)}`, result.error);
        toastError('Could not create the account', result.error);
        return;
    }

    // First XP of the journey, awarded silently — the onboarding
    // welcome screen presents it as part of the experience instead.
    awardXp('createPassport', { silent: true });
    logActivity('account', 'Created a Gamer Passport');
    checkAchievements();

    window.location.href = 'onboarding.html';
});
