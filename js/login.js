/**
 * login.js — controller for the authentication screen.
 *
 * Handles tab switching, live validation, submission and the
 * profile-switch confirmation. All credential logic lives in auth.js.
 */

import { bootPublic, haltModule } from './app.js';
import {
    register, login, switchProfile, redirectIfAuthenticated, VALIDATION,
} from './auth.js';
import { awardXp, checkAchievements } from './gamification.js';
import { logActivity } from './activity.js';
import { toastSuccess } from './notifications.js';
import { confirmDialog } from './modal.js';
import { icon, $ } from './ui.js';
import {
    validateForm, bindLiveValidation, focusFirstInvalid, showFieldError, showFeedback,
    required, email, minLength, maxLength, pattern,
} from './validation.js';

bootPublic({ page: 'login' });

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
    signin: { title: 'Bem-vindo de volta', subtitle: 'Volte para o seu Passaporte Gamer.' },
    create: { title: 'Crie seu Passaporte', subtitle: 'Três campos e a parte interessante começa.' },
};

/* ============================================================
   RETORNO SEGURO
   O ?redirect= só aceita uma página desta própria RIVALY
   (ex.: arena.html#rankingTitle). Qualquer outra coisa, inclusive um
   endereço externo, cai no Início.
   ============================================================ */
const SAFE_REDIRECT = /^[a-z0-9-]+\.html(?:[?#][^\s]*)?$/i;

function safeRedirect(value) {
    const target = String(value ?? '').trim();
    return SAFE_REDIRECT.test(target) && !target.startsWith('login.html') ? target : 'dashboard.html';
}

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
        button.setAttribute('aria-label', shown ? 'Ocultar senha' : 'Mostrar senha');
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
   VALIDAÇÃO
   Regras puras de validation.js; o feedback aparece embaixo de cada
   campo (invalid-feedback), ao sair do campo e ao enviar.
   ============================================================ */

const SIGNIN_SCHEMA = {
    signinEmail: [required('Digite o e-mail da sua conta.'), email()],
    signinPassword: [required('Digite a sua senha.')],
};

const CREATE_SCHEMA = {
    createNickname: [
        required('Escolha um apelido.'),
        minLength(VALIDATION.nickname.min, 'O apelido precisa ter pelo menos 3 caracteres.'),
        maxLength(VALIDATION.nickname.max, 'O apelido pode ter no máximo 18 caracteres.'),
        pattern(VALIDATION.nickname.pattern, 'Use letras, números, espaços, hífen ou sublinhado. Ex.: Nova_7.'),
    ],
    createEmail: [required('Digite um e-mail para a conta.'), email()],
    createPassword: [
        required('Crie uma senha de demonstração.'),
        minLength(VALIDATION.password.min, 'A senha precisa ter pelo menos 6 caracteres.'),
        maxLength(VALIDATION.password.max, 'A senha pode ter no máximo 64 caracteres.'),
    ],
};

bindLiveValidation(panels.signin, SIGNIN_SCHEMA);
bindLiveValidation(panels.create, CREATE_SCHEMA);

/** Mostra o erro que veio do auth.js no campo certo, com um tremor curto. */
function fieldError(inputId, message) {
    const input = document.getElementById(inputId);
    showFieldError(input, message);
    if (message && input) {
        input.classList.remove('anim-shake');
        void input.offsetWidth; // reinicia a animação
        input.classList.add('anim-shake');
    }
}

function withLoading(button, isLoading) {
    button.classList.toggle('is-loading', isLoading);
    button.disabled = isLoading;
}

/* ============================================================
   SIGN IN
   ============================================================ */

panels.signin.addEventListener('submit', async (event) => {
    event.preventDefault();

    const check = validateForm(panels.signin, SIGNIN_SCHEMA);
    if (!check.valid) {
        focusFirstInvalid(check);
        return;
    }

    const emailValue = $('#signinEmail').value;
    const password = $('#signinPassword').value;
    const submit = $('#signinSubmit');

    withLoading(submit, true);
    const result = await login({ email: emailValue, password });
    withLoading(submit, false);

    if (!result.ok) {
        const fieldId = result.field === 'password' ? 'signinPassword' : 'signinEmail';
        fieldError(fieldId, result.error);
        document.getElementById(fieldId).focus();
        return;
    }

    if (result.needsProfileSwitch) {
        const confirmed = await confirmDialog({
            title: 'Substituir o Passaporte local?',
            message: `Este navegador guarda o Passaporte de outra conta. A RIVALY mantém um Passaporte por navegador, então entrar como ${result.account.nickname} apaga a Biblioteca, as conquistas, a atividade e a comunidade que estão aqui.`,
            confirmLabel: 'Substituir e continuar',
            cancelLabel: 'Manter o Passaporte atual',
            danger: true,
        });
        if (!confirmed) return;
        switchProfile(result.account);
        window.location.href = 'onboarding.html';
        return;
    }

    showFeedback(panels.signin, { type: 'success', message: `Tudo certo, ${result.account.nickname}. Abrindo o seu Passaporte…` });
    toastSuccess('Login realizado', `Bem-vindo de volta, ${result.account.nickname}.`);
    logActivity('account', 'Entrou na conta');
    window.location.href = safeRedirect(params.get('redirect'));
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
        title: 'Carregar o Passaporte demo?',
        message: 'Isto substitui o Passaporte, a Biblioteca, as conquistas e a comunidade guardados neste navegador por um perfil demo completo.',
        confirmLabel: 'Carregar a conta demo',
        cancelLabel: 'Agora não',
    });
    if (!confirmed) return;

    withLoading(button, true);
    const { seedDemoAccount } = await import('./demo.js');
    const { nickname } = seedDemoAccount();

    toastSuccess('Passaporte demo pronto', `Você entrou como ${nickname}.`);

    // O tour comeca ja no Inicio: startTour() cuida do redirecionamento.
    const { startTour } = await import('./tour.js');
    startTour();
});

/* ============================================================
   CREATE
   ============================================================ */

panels.create.addEventListener('submit', async (event) => {
    event.preventDefault();

    const check = validateForm(panels.create, CREATE_SCHEMA);
    if (!check.valid) {
        showFeedback(panels.create, { type: 'error', message: 'Revise os campos marcados. Cada um diz o que ajustar.' });
        focusFirstInvalid(check);
        return;
    }

    const nickname = $('#createNickname').value;
    const emailValue = $('#createEmail').value;
    const password = $('#createPassword').value;
    const submit = $('#createSubmit');

    withLoading(submit, true);
    const result = await register({ nickname, email: emailValue, password });

    if (!result.ok) {
        withLoading(submit, false);
        const fieldId = `create${result.field.charAt(0).toUpperCase()}${result.field.slice(1)}`;
        fieldError(fieldId, result.error);
        document.getElementById(fieldId)?.focus();
        return;
    }

    showFeedback(panels.create, { type: 'success', message: 'Passaporte criado. Agora, alguns detalhes sobre como você joga.' });

    // First XP of the journey, awarded silently — the onboarding
    // welcome screen presents it as part of the experience instead.
    awardXp('createPassport', { silent: true });
    logActivity('account', 'Criou um Passaporte Gamer');
    checkAchievements();

    window.location.href = 'onboarding.html';
});
