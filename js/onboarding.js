/**
 * onboarding.js — the first-run experience.
 *
 * A small stage machine drives six screens:
 *   welcome → setup-1 → setup-2 → setup-3 → dna → analysing → reveal → created
 *
 * It can also be re-entered later at ?stage=dna, which is how a user
 * who skipped setup completes their DNA Gamer from the Dashboard.
 */

import { bootPublic, haltModule } from './app.js';
import { gameMarkMarkup } from './cards.js';
import { requireAuth } from './auth.js';
import { getUser } from './storage.js';
import { updateUser, profileCompletion } from './profile.js';
import {
    PLATFORMS, LANGUAGES, REGIONS, GENRES, SCHEDULES, PLAYSTYLES, ROLES,
    GAMES, DNA_QUESTIONS, DNA_ATTRIBUTES, getGameById,
} from './data.js';
import { buildDnaProfile, getArchetypeById, suggestedRoles } from './gamer-dna.js';
import { awardXp, awardOnce, checkAchievements, progressSnapshot } from './gamification.js';
import { addEntry } from './library-store.js';
import { logActivity } from './activity.js';
import { toastInfo } from './notifications.js';
import { $, escapeHtml, icon, formatNumber } from './ui.js';
import { userAvatarMarkup, resolveAvatar } from './avatar-service.js';
import { openAvatarPicker } from './avatar-picker.js';
import { countUp, runSequence, wait, prefersReducedMotion, attachPointerLight } from './animations.js';

bootPublic();
if (!requireAuth({ requireOnboarding: false })) await haltModule();

const user = getUser();
const params = new URLSearchParams(window.location.search);
const startStage = params.get('stage');

// Finished users only come back here for a specific stage (the DNA).
if (user.onboardingComplete && startStage !== 'dna') {
    window.location.replace('dashboard.html');
    await haltModule();
}

/* ============================================================
   STAGE MACHINE
   ============================================================ */

const STAGE_PROGRESS = {
    welcome: { step: 0, label: 'Boas-vindas' },
    'setup-1': { step: 1, label: 'Passo 1 de 4 · Onde você joga' },
    'setup-2': { step: 1, label: 'Passo 2 de 4 · Como você joga' },
    'setup-3': { step: 2, label: 'Passo 3 de 4 · O que você joga' },
    dna: { step: 3, label: 'Passo 4 de 4 · DNA Gamer' },
    analysing: { step: 4, label: 'Analisando' },
    reveal: { step: 4, label: 'Sua identidade' },
    created: { step: 4, label: 'Concluído' },
};

const stages = new Map(
    Array.from(document.querySelectorAll('[data-stage]')).map((node) => [node.dataset.stage, node])
);

const progressBox = $('#obProgress');
const progressFill = $('#obProgressFill');
const progressLabel = $('#obProgressLabel');

let currentStage = 'welcome';

function goToStage(name) {
    const target = stages.get(name);
    if (!target) return;

    stages.forEach((node, key) => {
        node.hidden = key !== name;
    });

    currentStage = name;

    const meta = STAGE_PROGRESS[name];
    progressBox.hidden = meta.step === 0;
    progressLabel.textContent = meta.label;
    progressFill.style.transform = `scaleX(${meta.step / 4})`;

    target.classList.remove('page-enter');
    void target.offsetWidth;
    target.classList.add('page-enter');

    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    target.querySelector('h1, h2')?.setAttribute('tabindex', '-1');
    target.querySelector('h1, h2')?.focus({ preventScroll: true });
}

document.querySelectorAll('[data-next]').forEach((button) => {
    button.addEventListener('click', () => goToStage(button.dataset.next));
});
document.querySelectorAll('[data-back]').forEach((button) => {
    button.addEventListener('click', () => goToStage(button.dataset.back));
});

/* ============================================================
   STAGE 1 — WELCOME
   ============================================================ */

$('#welcomeName').textContent = user.nickname;

/* ============================================================
   STAGE 2 — PROFILE SETUP
   ============================================================ */

const draft = {
    platforms: [...(user.platforms ?? [])],
    languages: [...(user.languages ?? [])],
    region: user.region ?? '',
    age: user.age ?? null,
    playstyle: user.playstyle ?? '',
    schedules: [...(user.schedules ?? [])],
    roles: [...(user.roles ?? [])],
    voiceChat: user.voiceChat ?? true,
    favoriteGenres: [...(user.favoriteGenres ?? [])],
    currentGames: [...(user.currentGames ?? [])],
    bio: user.bio ?? '',
};

/** Renders a checkbox chip group bound to a draft array. */
function renderChipGroup(host, items, selected, { name }) {
    host.innerHTML = items.map((item) => `
        <label class="chip" title="${escapeHtml(item.hint ?? item.label)}">
            <input type="checkbox" name="${name}" value="${escapeHtml(item.id)}"${selected.includes(item.id) ? ' checked' : ''}>
            <span>${escapeHtml(item.label)}</span>
        </label>
    `).join('');
}

function bindChipGroup(host, targetArray, onChange) {
    host.addEventListener('change', (event) => {
        const input = event.target.closest('input[type="checkbox"]');
        if (!input) return;
        const index = targetArray.indexOf(input.value);
        if (input.checked && index < 0) targetArray.push(input.value);
        if (!input.checked && index >= 0) targetArray.splice(index, 1);
        onChange?.();
    });
}

/* --- Avatar --- */
function renderAvatarStep() {
    const live = getUser();
    const avatar = resolveAvatar(live);
    $('#obAvatar').innerHTML = userAvatarMarkup(live, { size: 'xl', alt: 'Seu avatar' });
    $('#obAvatarMeta').textContent = avatar.type === 'upload'
        ? 'Imagem própria'
        : `${avatar.style} · ${avatar.seed}`;
}

$('#obAvatarBtn').addEventListener('click', () => {
    openAvatarPicker(getUser(), (selection) => {
        updateUser({ avatar: selection });
        renderAvatarStep();
    });
});

/* --- Setup 1 --- */
const platformHost = $('#platformChips');
renderChipGroup(platformHost, PLATFORMS, draft.platforms, { name: 'platform' });
bindChipGroup(platformHost, draft.platforms, () => setError('platformsError', ''));

const languageHost = $('#languageChips');
renderChipGroup(languageHost, LANGUAGES, draft.languages, { name: 'language' });
bindChipGroup(languageHost, draft.languages);

const regionSelect = $('#regionSelect');
regionSelect.insertAdjacentHTML('beforeend', REGIONS.map(
    (region) => `<option value="${escapeHtml(region)}"${draft.region === region ? ' selected' : ''}>${escapeHtml(region)}</option>`
).join(''));

if (draft.age) $('#ageInput').value = draft.age;

function setError(id, message) {
    const node = document.getElementById(id);
    if (node) node.textContent = message;
}

$('#setupForm1').addEventListener('submit', (event) => {
    event.preventDefault();
    if (draft.platforms.length === 0) {
        setError('platformsError', 'Escolha pelo menos uma plataforma.');
        platformHost.querySelector('input')?.focus();
        return;
    }
    draft.region = regionSelect.value;
    const age = Number($('#ageInput').value);
    draft.age = Number.isFinite(age) && age >= 10 && age <= 120 ? age : null;
    goToStage('setup-2');
});

/* --- Setup 2 --- */
const playstyleHost = $('#playstyleOptions');
playstyleHost.innerHTML = PLAYSTYLES.map((style) => `
    <label class="ob-option">
        <input type="radio" name="playstyle" value="${escapeHtml(style.id)}"${draft.playstyle === style.id ? ' checked' : ''}>
        <span class="ob-option__body">
            <span class="ob-option__label">${escapeHtml(style.label)}</span>
            <span class="ob-option__hint">${escapeHtml(style.hint)}</span>
        </span>
        <span class="ob-option__mark" aria-hidden="true"></span>
    </label>
`).join('');

playstyleHost.addEventListener('change', (event) => {
    const input = event.target.closest('input[name="playstyle"]');
    if (!input) return;
    draft.playstyle = input.value;
    setError('playstyleError', '');
});

const scheduleHost = $('#scheduleChips');
renderChipGroup(scheduleHost, SCHEDULES, draft.schedules, { name: 'schedule' });
bindChipGroup(scheduleHost, draft.schedules, () => setError('schedulesError', ''));

const roleHost = $('#roleChips');
renderChipGroup(roleHost, ROLES, draft.roles, { name: 'role' });
bindChipGroup(roleHost, draft.roles, () => setError('rolesError', ''));

$('#voiceToggle').checked = draft.voiceChat;
$('#voiceToggle').addEventListener('change', (event) => {
    draft.voiceChat = event.target.checked;
});

$('#setupForm2').addEventListener('submit', (event) => {
    event.preventDefault();
    let valid = true;

    if (!draft.playstyle) {
        setError('playstyleError', 'Escolha o estilo de jogo que mais combina com você.');
        valid = false;
    }
    if (draft.schedules.length === 0) {
        setError('schedulesError', 'Escolha pelo menos um horário.');
        valid = false;
    }
    if (draft.roles.length === 0) {
        setError('rolesError', 'Escolha pelo menos uma função.');
        valid = false;
    }

    if (!valid) {
        document.querySelector('.field__error:not(:empty)')?.scrollIntoView({ block: 'center' });
        return;
    }
    goToStage('setup-3');
});

/* --- Setup 3 --- */
const genreHost = $('#genreChips');
renderChipGroup(
    genreHost,
    GENRES.map((genre) => ({ id: genre, label: genre })),
    draft.favoriteGenres,
    { name: 'genre' }
);
bindChipGroup(genreHost, draft.favoriteGenres, () => setError('genresError', ''));

const gameHost = $('#currentGameChips');

function renderGameChips(query = '') {
    const needle = query.trim().toLowerCase();
    const matches = GAMES.filter((game) =>
        !needle || game.title.toLowerCase().includes(needle) ||
        game.genre.some((genre) => genre.toLowerCase().includes(needle))
    );

    // Selected games stay visible even when they fall out of the filter.
    const selectedOutside = GAMES.filter(
        (game) => draft.currentGames.includes(game.id) && !matches.includes(game)
    );
    const visible = [...selectedOutside, ...matches].slice(0, 60);

    gameHost.innerHTML = visible.length
        ? visible.map((game) => `
            <label class="chip">
                <input type="checkbox" name="currentGame" value="${escapeHtml(game.id)}"${draft.currentGames.includes(game.id) ? ' checked' : ''}>
                <span>${escapeHtml(game.title)}</span>
            </label>
        `).join('')
        : `<p class="field__hint">Nenhum jogo corresponde a “${escapeHtml(query)}”. Você poderá adicioná-lo mais tarde pela Biblioteca.</p>`;
}

renderGameChips();
bindChipGroup(gameHost, draft.currentGames);

let searchTimer = null;
$('#gameSearch').addEventListener('input', (event) => {
    // Debounced so typing does not rebuild the list on every keystroke.
    window.clearTimeout(searchTimer);
    const value = event.target.value;
    searchTimer = window.setTimeout(() => renderGameChips(value), 140);
});

const bioInput = $('#bioInput');
bioInput.value = draft.bio;
$('#bioCount').textContent = String(draft.bio.length);
bioInput.addEventListener('input', () => {
    draft.bio = bioInput.value;
    $('#bioCount').textContent = String(bioInput.value.length);
});

$('#setupForm3').addEventListener('submit', (event) => {
    event.preventDefault();
    if (draft.favoriteGenres.length === 0) {
        setError('genresError', 'Escolha pelo menos um gênero.');
        genreHost.querySelector('input')?.focus();
        return;
    }
    persistProfileDraft();
    goToStage('dna');
    renderQuestion(0);
});

/** Writes the collected draft onto the passport. */
function persistProfileDraft() {
    updateUser({
        platforms: draft.platforms,
        languages: draft.languages.length ? draft.languages : ['en'],
        region: draft.region,
        age: draft.age,
        playstyle: draft.playstyle || 'balanced',
        schedules: draft.schedules,
        roles: draft.roles,
        voiceChat: draft.voiceChat,
        favoriteGenres: draft.favoriteGenres,
        currentGames: draft.currentGames,
        bio: draft.bio,
    });
}

/* --- Skip --- */
document.querySelector('[data-skip-all]')?.addEventListener('click', () => {
    persistProfileDraft();
    updateUser({ onboardingComplete: true });
    logActivity('passport', 'Pulou a montagem do perfil');
    toastInfo('Montagem pulada', 'Você pode completar seu Passaporte quando quiser pela página Passaporte.');
    window.location.href = 'dashboard.html';
});

/* ============================================================
   STAGE 3 — GAMER DNA
   ============================================================ */

const answers = { ...(user.dna?.answers ?? {}) };
let questionIndex = 0;

const dnaTitle = $('#dnaTitle');
const dnaOptions = $('#dnaOptions');
const dnaCounter = $('#dnaCounter');
const dnaVoltar = $('#dnaVoltar');

function renderQuestion(index) {
    questionIndex = index;
    const question = DNA_QUESTIONS[index];

    dnaCounter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(DNA_QUESTIONS.length).padStart(2, '0')}`;
    dnaTitle.textContent = question.prompt;

    dnaOptions.innerHTML = question.options.map((option, position) => `
        <label class="ob-option ob-option--answer" style="animation-delay:${position * 55}ms">
            <input type="radio" name="${escapeHtml(question.id)}" value="${escapeHtml(option.id)}"${answers[question.id] === option.id ? ' checked' : ''}>
            <span class="ob-option__key numeric">${String.fromCharCode(65 + position)}</span>
            <span class="ob-option__body">
                <span class="ob-option__label">${escapeHtml(option.label)}</span>
            </span>
            <span class="ob-option__mark" aria-hidden="true"></span>
        </label>
    `).join('');

    dnaVoltar.disabled = index === 0;

    // The whole DNA bar reflects progress inside the questionnaire.
    const ratio = (3 + (index / DNA_QUESTIONS.length)) / 4;
    progressFill.style.transform = `scaleX(${ratio})`;
    progressLabel.textContent = `DNA Gamer · ${index + 1} de ${DNA_QUESTIONS.length}`;

    dnaOptions.querySelector('input')?.focus();
}

dnaOptions.addEventListener('change', async (event) => {
    const input = event.target.closest('input[type="radio"]');
    if (!input) return;

    answers[DNA_QUESTIONS[questionIndex].id] = input.value;

    // A short beat so the selection is visible before advancing.
    await wait(prefersReducedMotion() ? 0 : 260);

    if (questionIndex < DNA_QUESTIONS.length - 1) {
        renderQuestion(questionIndex + 1);
    } else {
        startAnalysis();
    }
});

dnaVoltar.addEventListener('click', () => {
    if (questionIndex > 0) renderQuestion(questionIndex - 1);
});

// Number keys 1-4 pick an answer — a small power-user affordance.
document.addEventListener('keydown', (event) => {
    if (currentStage !== 'dna') return;
    const position = Number(event.key);
    if (!Number.isInteger(position) || position < 1 || position > 4) return;
    const input = dnaOptions.querySelectorAll('input')[position - 1];
    if (!input) return;
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
});

/* ============================================================
   STAGE 4 — ANALYSING
   ============================================================ */

const ANALYSIS_LINES = [
    'Lendo suas respostas…',
    'Ponderando sinais comportamentais…',
    'Normalizando os seis atributos…',
    'Cruzando dados com onze arquétipos…',
    'Definindo sua identidade…',
];

let dnaProfile = null;

async function startAnalysis() {
    dnaProfile = buildDnaProfile(answers);
    goToStage('analysing');

    const log = $('#analyseLog');
    log.innerHTML = '';

    await runSequence(
        ANALYSIS_LINES.map((line) => ({
            run: () => {
                const item = document.createElement('li');
                item.className = 'ob-analyse__line';
                item.innerHTML = `<span class="ob-analyse__tick">${icon('check', { size: 12 })}</span>${escapeHtml(line)}`;
                log.appendChild(item);
            },
            wait: 460,
        }))
    );

    await wait(prefersReducedMotion() ? 0 : 300);
    await revealIdentity();
}

/* ============================================================
   STAGE 5 — REVEAL
   ============================================================ */

async function revealIdentity() {
    const archetype = getArchetypeById(dnaProfile.archetypeId);
    goToStage('reveal');

    const barsHost = $('#revealBars');
    barsHost.innerHTML = DNA_ATTRIBUTES.map((attribute) => `
        <div class="dna-bar dna-bar--lg" data-dna="${attribute.id}" style="--dna-color:${attribute.color}">
            <span class="dna-bar__label">${escapeHtml(attribute.label)}</span>
            <span class="dna-bar__track"><span class="dna-bar__fill"></span></span>
            <span class="dna-bar__value numeric">0</span>
        </div>
    `).join('');

    const identity = $('#revealIdentity');
    identity.classList.remove('is-in');

    // Bars grow one after another, strongest attribute last for effect.
    const ordered = [...DNA_ATTRIBUTES].sort(
        (a, b) => dnaProfile.scores[a.id] - dnaProfile.scores[b.id]
    );

    for (const attribute of ordered) {
        const row = barsHost.querySelector(`[data-dna="${attribute.id}"]`);
        const value = dnaProfile.scores[attribute.id];
        row.classList.add('is-active');
        row.querySelector('.dna-bar__fill').style.transform = `scaleX(${value / 100})`;
        countUp(row.querySelector('.dna-bar__value'), value, { duration: 720 });
        // eslint-disable-next-line no-await-in-loop -- sequential by design
        await wait(prefersReducedMotion() ? 0 : 320);
    }

    await wait(prefersReducedMotion() ? 0 : 420);

    $('#revealTitle').textContent = archetype.name;
    $('#revealTagline').textContent = archetype.tagline;
    $('#revealDescription').textContent = archetype.description;
    $('#revealTraits').innerHTML = archetype.traits
        .map((trait) => `<li>${icon('check', { size: 12 })}${escapeHtml(trait)}</li>`)
        .join('');
    identity.style.setProperty('--archetype-accent', archetype.accent);
    identity.classList.add('is-in');
    $('#revealTitle').focus?.();
}

$('#revealContinuar').addEventListener('click', () => {
    finaliseOnboarding();
});

/* ============================================================
   STAGE 6 — PASSPORT CREATED
   ============================================================ */

function finaliseOnboarding() {
    const stored = getUser();
    // Re-entering at ?stage=dna must not pay out the same rewards twice.
    const isFirstRun = !stored.onboardingComplete;
    const isFirstDna = !stored.dna;

    // 1. Persist the DNA and fill in roles if the user left them empty.
    const patch = { dna: dnaProfile, onboardingComplete: true };
    if (!stored.roles || stored.roles.length === 0) {
        patch.roles = suggestedRoles(dnaProfile.scores);
    }
    updateUser(patch);

    // 2. Seed the Library with the games chosen during setup.
    //    addEntry() rejects duplicates, so a re-run adds nothing.
    const addedGames = [];
    draft.currentGames.forEach((gameId) => {
        const result = addEntry({ gameId, status: 'playing' });
        if (result.ok) addedGames.push(getGameById(gameId).title);
    });

    // 3. Award XP. Toasts are suppressed here because this screen
    //    presents the rewards itself.
    if (isFirstDna) {
        awardXp('completeDna', { silent: true });
        logActivity('dna', `Concluiu o DNA Gamer — ${getArchetypeById(dnaProfile.archetypeId).name}`);
    } else {
        logActivity('dna', `Refez o DNA Gamer — ${getArchetypeById(dnaProfile.archetypeId).name}`);
    }

    addedGames.forEach(() => awardXp('addGame', { silent: true }));
    if (addedGames.length) {
        logActivity('library', `Adicionou ${addedGames.length} jogo${addedGames.length > 1 ? 's' : ''} à Biblioteca`);
    }

    if (profileCompletion(getUser()) >= 100) awardOnce('completeProfile', { silent: true });
    else if (isFirstRun) awardXp('updateProfile', { silent: true });

    if (isFirstRun) logActivity('passport', 'Passaporte Gamer criado');
    checkAchievements();

    renderCreated(addedGames);
    goToStage('created');
}

function renderCreated(addedGames) {
    const current = getUser();
    const archetype = getArchetypeById(current.dna.archetypeId);
    const snapshot = progressSnapshot();
    const games = (current.currentGames ?? []).map(getGameById).filter(Boolean).slice(0, 3);

    $('#createdCard').innerHTML = `
        <article class="passport-card" id="createdPassport">
            <div class="passport-card__sheen" aria-hidden="true"></div>
            <header class="passport-card__head">
                <div>
                    <p class="passport-card__brand">RIVALY</p>
                    <p class="passport-card__type">Passaporte Gamer</p>
                </div>
                <p class="passport-card__id numeric">${escapeHtml(current.gamerId)}</p>
            </header>

            <div class="passport-card__identity">
                <span class="passport-card__avatar is-in">${userAvatarMarkup(current, { size: 'lg', alt: `Avatar de ${current.nickname}` })}</span>
                <div>
                    <p class="passport-card__nick is-in">${escapeHtml(current.nickname)}</p>
                    <p class="passport-card__archetype is-in">${escapeHtml(archetype.name)}</p>
                </div>
                <div class="passport-card__level">
                    <span class="passport-card__level-value numeric">${snapshot.level}</span>
                    <span class="passport-card__level-label">Nível</span>
                </div>
            </div>

            ${games.length ? `
                <div class="passport-card__section">
                    <p class="passport-card__section-title">Jogando agora</p>
                    <ul class="passport-card__games">
                        ${games.map((game) => `
                            <li class="passport-card__game">
                                ${gameMarkMarkup(game)}
                                <span class="passport-card__game-title">${escapeHtml(game.title)}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>` : ''}

            <div class="passport-card__section">
                <p class="passport-card__section-title">DNA Gamer</p>
                <div class="dna-list">
                    ${DNA_ATTRIBUTES.map((attribute) => `
                        <div class="dna-bar" style="--dna-color:${attribute.color}">
                            <span class="dna-bar__label">${escapeHtml(attribute.label)}</span>
                            <span class="dna-bar__track">
                                <span class="dna-bar__fill" data-progress="${current.dna.scores[attribute.id]}"></span>
                            </span>
                            <span class="dna-bar__value numeric">${current.dna.scores[attribute.id]}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <footer class="passport-card__foot">
                <span class="passport-card__foot-item">
                    <span class="passport-card__foot-label">Reputação</span>
                    <span class="numeric">${snapshot.reputation}</span>
                </span>
                <span class="passport-card__foot-item">
                    <span class="passport-card__foot-label">Pontuação Gamer</span>
                    <span class="numeric">${formatNumber(snapshot.gamerScore)}</span>
                </span>
                <span class="passport-card__foot-item">
                    <span class="passport-card__foot-label">Medalhas</span>
                    <span class="numeric">${snapshot.achievementsUnlocked}</span>
                </span>
            </footer>
        </article>
    `;

    const rewards = [
        { label: 'Passaporte criado', value: '+100 XP' },
        { label: 'DNA Gamer concluído', value: '+200 XP' },
    ];
    if (addedGames.length) {
        rewards.push({ label: `Jogos adicionados: ${addedGames.length}`, value: `+${addedGames.length * 50} XP` });
    }
    rewards.push({ label: `Conquistas desbloqueadas: ${snapshot.achievementsUnlocked}`, value: `+${snapshot.achievementsUnlocked * 40} XP` });

    $('#createdRewards').innerHTML = rewards.map((reward, index) => `
        <div class="ob-reward" style="animation-delay:${180 + index * 90}ms">
            <span class="ob-reward__label">${escapeHtml(reward.label)}</span>
            <span class="ob-reward__value numeric">${escapeHtml(reward.value)}</span>
        </div>
    `).join('');

    const card = document.getElementById('createdPassport');
    card.classList.add('is-complete');
    attachPointerLight(card);

    // Grow the DNA bars once the card is on screen.
    window.requestAnimationFrame(() => {
        card.querySelectorAll('[data-progress]').forEach((fill, index) => {
            window.setTimeout(() => {
                fill.style.transform = `scaleX(${Number(fill.dataset.progress) / 100})`;
            }, index * 70);
        });
    });
}

/* ============================================================
   ENTRY POINT
   ============================================================ */

if (startStage === 'dna') {
    goToStage('dna');
    renderQuestion(0);
} else {
    renderAvatarStep();
    goToStage('welcome');
}
