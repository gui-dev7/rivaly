/**
 * auth.js — LOCAL ACADEMIC SIMULATION OF AUTHENTICATION.
 *
 * ┌────────────────────────────────────────────────────────────┐
 * │  THIS IS NOT REAL AUTHENTICATION.                          │
 * │                                                            │
 * │  There is no server, no session token, no transport        │
 * │  security and no account recovery. Everything lives in     │
 * │  this browser's localStorage and can be read or edited by  │
 * │  anyone with DevTools open.                                │
 * │                                                            │
 * │  Passwords are hashed with SHA-256 (Web Crypto) purely so  │
 * │  the plaintext is not sitting in storage — that is a       │
 * │  hygiene measure for a classroom demo, NOT a security      │
 * │  control. A real implementation needs a backend, a proper  │
 * │  KDF (bcrypt/argon2), rate limiting and HTTPS.             │
 * │                                                            │
 * │  Users are told this explicitly on the login screen.       │
 * └────────────────────────────────────────────────────────────┘
 */

import {
    getAccounts, saveAccounts, getSession, saveSession, clearSession,
    getUser, saveUser, resetAll,
} from './storage.js';
import { createUser } from './profile.js';
import { hashString } from './ui.js';

const SALT = 'rivaly::academic-demo';

/** SHA-256 when available (secure context), djb2 otherwise. */
async function hashPassword(password) {
    const input = `${SALT}|${password}`;
    if (window.crypto?.subtle) {
        try {
            const bytes = new TextEncoder().encode(input);
            const digest = await window.crypto.subtle.digest('SHA-256', bytes);
            return Array.from(new Uint8Array(digest))
                .map((byte) => byte.toString(16).padStart(2, '0'))
                .join('');
        } catch {
            /* fall through */
        }
    }
    // Fallback for non-secure contexts. Weaker, and labelled as such.
    return `djb2:${hashString(input).toString(16)}`;
}

const normaliseEmail = (email) => String(email ?? '').trim().toLowerCase();

/* ============================================================
   VALIDATION
   Mirrors the HTML constraints so the same rules apply whether
   the browser or the script validates first.
   ============================================================ */

export const VALIDATION = {
    nickname: { min: 3, max: 18, pattern: /^[a-zA-Z0-9_À-ÿ][a-zA-Z0-9_ À-ÿ-]{1,16}[a-zA-Z0-9_À-ÿ]$/ },
    password: { min: 6, max: 64 },
    email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/ },
};

export function validateNickname(value) {
    const nickname = String(value ?? '').trim();
    if (nickname.length < VALIDATION.nickname.min) return 'O apelido precisa de pelo menos 3 caracteres.';
    if (nickname.length > VALIDATION.nickname.max) return 'O apelido pode ter no máximo 18 caracteres.';
    if (!VALIDATION.nickname.pattern.test(nickname)) return 'Use letras, números, espaços, hífen ou sublinhado. Ex.: Nova_7.';
    return '';
}

export function validateEmail(value) {
    const email = normaliseEmail(value);
    if (!email) return 'Digite um e-mail.';
    if (!VALIDATION.email.pattern.test(email)) return 'Digite um e-mail no formato nome@exemplo.com.';
    return '';
}

export function validatePassword(value) {
    const password = String(value ?? '');
    if (password.length < VALIDATION.password.min) return 'A senha deve ter pelo menos 6 caracteres.';
    if (password.length > VALIDATION.password.max) return 'A senha pode ter no máximo 64 caracteres.';
    return '';
}

/* ============================================================
   ACCOUNTS
   ============================================================ */

export const findAccountByEmail = (email) =>
    getAccounts().find((account) => account.email === normaliseEmail(email)) ?? null;

/**
 * Creates an account AND the passport that belongs to it.
 * @returns {Promise<{ok:boolean, error?:string, account?:object}>}
 */
export async function register({ nickname, email, password }) {
    const nicknameError = validateNickname(nickname);
    if (nicknameError) return { ok: false, field: 'nickname', error: nicknameError };

    const emailError = validateEmail(email);
    if (emailError) return { ok: false, field: 'email', error: emailError };

    const passwordError = validatePassword(password);
    if (passwordError) return { ok: false, field: 'password', error: passwordError };

    if (findAccountByEmail(email)) {
        return { ok: false, field: 'email', error: 'Já existe uma conta com este e-mail neste navegador. Entre por ela ou use outro e-mail.' };
    }

    const account = {
        id: `acc-${Date.now().toString(36)}`,
        nickname: String(nickname).trim(),
        email: normaliseEmail(email),
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
    };

    saveAccounts([...getAccounts(), account]);
    saveUser(createUser({ nickname: account.nickname, email: account.email }));
    saveSession({ accountId: account.id, startedAt: new Date().toISOString() });

    return { ok: true, account };
}

/**
 * @returns {Promise<{ok:boolean, error?:string, account?:object, needsProfileSwitch?:boolean}>}
 */
export async function login({ email, password }) {
    const account = findAccountByEmail(email);
    if (!account) {
        return { ok: false, field: 'email', error: 'Não há conta com este e-mail neste navegador. Confira a grafia ou crie uma conta.' };
    }

    const hash = await hashPassword(password);
    if (hash !== account.passwordHash) {
        return { ok: false, field: 'password', error: 'A senha não confere. Tente de novo.' };
    }

    const storedUser = getUser();

    // V1 keeps one passport in this browser at a time. Signing in as a
    // different account has to replace it, so the caller must confirm.
    if (storedUser && storedUser.email !== account.email) {
        return { ok: true, account, needsProfileSwitch: true };
    }

    if (!storedUser) {
        saveUser(createUser({ nickname: account.nickname, email: account.email }));
    }

    saveSession({ accountId: account.id, startedAt: new Date().toISOString() });
    return { ok: true, account };
}

/** Completes a login that requires replacing the local passport. */
export function switchProfile(account) {
    resetAll({ keepAccounts: true });
    saveUser(createUser({ nickname: account.nickname, email: account.email }));
    saveSession({ accountId: account.id, startedAt: new Date().toISOString() });
}

export function logout() {
    clearSession();
}

/* ============================================================
   SESSION
   ============================================================ */

export function currentAccount() {
    const session = getSession();
    if (!session?.accountId) return null;
    return getAccounts().find((account) => account.id === session.accountId) ?? null;
}

export const isAuthenticated = () => Boolean(currentAccount());

/**
 * Route guard used by every application page.
 * @param {{requireOnboarding?: boolean}} options
 * @returns {boolean} true when the page may continue rendering.
 */
export function requireAuth({ requireOnboarding = true } = {}) {
    if (!isAuthenticated()) {
        window.location.replace('login.html?redirect=' + encodeURIComponent(currentPageName()));
        return false;
    }

    const user = getUser();
    if (!user) {
        window.location.replace('login.html');
        return false;
    }

    if (requireOnboarding && !user.onboardingComplete) {
        window.location.replace('onboarding.html');
        return false;
    }

    return true;
}

/** Guard for login/onboarding: sends signed-in users where they belong. */
export function redirectIfAuthenticated() {
    if (!isAuthenticated()) return false;
    const user = getUser();
    if (user && !user.onboardingComplete) {
        window.location.replace('onboarding.html');
    } else {
        window.location.replace('dashboard.html');
    }
    return true;
}

function currentPageName() {
    const parts = window.location.pathname.split('/');
    return parts[parts.length - 1] || 'dashboard.html';
}
