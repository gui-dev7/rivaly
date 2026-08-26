/**
 * passport.js — controller for the Gamer Passport page.
 *
 * Renders the shareable card, the full DNA analysis, the play
 * preferences and the library signature, and owns the edit dialog.
 */

import { bootApp, afterRender, haltModule } from './app.js';
import { getUser } from './storage.js';
import {
    updateUser, archetypeOf, profileCompletion, missingProfileFields,
} from './profile.js';
import { progressSnapshot, getAchievementState, awardXp, awardOnce, checkAchievements } from './gamification.js';
import { librarySummary } from './library-store.js';
import {
    PLATFORMS, GENRES, SCHEDULES, PLAYSTYLES, ROLES, LANGUAGES, REGIONS,
    DNA_ATTRIBUTES, RANK_LADDER, getGameById,
} from './data.js';
import { dnaListMarkup, statMarkup, badgeMarkup, gameMarkMarkup } from './cards.js';
import { openModal } from './modal.js';
import { toast } from './notifications.js';
import { refreshNavigationProgress } from './navigation.js';
import {
    $, render, escapeHtml, icon, avatarSvg, formatNumber, formatHours, hashString,
    emptyStateMarkup, tipMarkup, bannerArt,
} from './ui.js';
import { attachPointerLight, countUp } from './animations.js';

let user = bootApp({
    page: 'passport',
    title: 'Gamer Passport',
    subtitle: 'Your identity record',
});
if (!user) await haltModule();

const labelOf = (collection, id) => collection.find((item) => item.id === id)?.label ?? id;

let detachPointerLight = () => {};

/* ============================================================
   PASSPORT CARD
   ============================================================ */

function renderCard() {
    const snapshot = progressSnapshot();
    const archetype = archetypeOf(user);
    const games = (user.currentGames ?? []).map(getGameById).filter(Boolean).slice(0, 3);

    // Key art strip behind the header. Only Steam titles ship a banner,
    // so fall through the current games until one has it; if none does the
    // card simply renders without it.
    const bannerGame = games.find((game) => game.steamAppId);

    render($('#passportCardHost'), `
        <article class="passport-card is-complete ${bannerGame ? 'has-banner' : ''}" id="passportCard">
            ${bannerGame ? `<span class="passport-card__banner" aria-hidden="true">${bannerArt(bannerGame)}</span>` : ''}
            <div class="passport-card__sheen" aria-hidden="true"></div>

            <header class="passport-card__head">
                <div>
                    <p class="passport-card__brand">RIVALY</p>
                    <p class="passport-card__type">Gamer Passport</p>
                </div>
                <p class="passport-card__id numeric">${escapeHtml(user.gamerId)}</p>
            </header>

            <div class="passport-card__identity">
                <span class="passport-card__avatar is-in">${avatarSvg(user.avatarSeed, { size: 52 })}</span>
                <div>
                    <p class="passport-card__nick is-in">${escapeHtml(user.nickname)}</p>
                    <p class="passport-card__archetype is-in">${escapeHtml(archetype?.name ?? 'DNA not analysed')}</p>
                </div>
                <div class="passport-card__level">
                    <span class="passport-card__level-value numeric">${snapshot.level}</span>
                    <span class="passport-card__level-label">Level</span>
                </div>
            </div>

            <div class="passport-card__xp">
                <div class="passport-card__xp-head">
                    <span>Level ${snapshot.level}</span>
                    <span class="numeric">${formatNumber(snapshot.currentLevelXp)} / ${formatNumber(snapshot.nextLevelXp)} XP</span>
                </div>
                <span class="progress progress--thin progress--xp">
                    <span class="progress__fill" data-progress="${snapshot.percent}"></span>
                </span>
            </div>

            ${games.length ? `
                <div class="passport-card__section">
                    <p class="passport-card__section-title">Currently playing</p>
                    <ul class="passport-card__games">
                        ${games.map((game) => `
                            <li class="passport-card__game">
                                ${gameMarkMarkup(game)}
                                <span class="passport-card__game-title">${escapeHtml(game.title)}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>` : ''}

            ${user.dna ? `
                <div class="passport-card__section">
                    <p class="passport-card__section-title">Gamer DNA</p>
                    ${dnaListMarkup(user.dna.scores)}
                </div>` : ''}

            <footer class="passport-card__foot">
                <span class="passport-card__foot-item">
                    <span class="passport-card__foot-label">Reputation</span>
                    <span class="numeric">${snapshot.reputation}</span>
                </span>
                <span class="passport-card__foot-item">
                    <span class="passport-card__foot-label">Gamer Score</span>
                    <span class="numeric">${formatNumber(snapshot.gamerScore)}</span>
                </span>
                <span class="passport-card__foot-item">
                    <span class="passport-card__foot-label">Badges</span>
                    <span class="numeric">${snapshot.achievementsUnlocked}</span>
                </span>
            </footer>
        </article>
    `);

    detachPointerLight();
    detachPointerLight = attachPointerLight(document.getElementById('passportCard'));
}

/* ============================================================
   IDENTITY SIDE PANEL
   ============================================================ */

function renderIdentity() {
    const archetype = archetypeOf(user);
    const joined = new Date(user.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric',
    });

    render($('#passportIdentity'), `
        <div class="card identity">
            <p class="eyebrow">Identity</p>
            <h2 class="identity__nick">${escapeHtml(user.nickname)}</h2>
            ${archetype ? `<p class="identity__archetype" style="color:${archetype.accent}">${escapeHtml(archetype.name)}</p>` : ''}
            ${user.bio ? `<p class="identity__bio">${escapeHtml(user.bio)}</p>` : ''}

            <dl class="identity__facts">
                <div>
                    <dt>Gamer ID ${tipMarkup('A local visual identifier generated from your nickname and creation date. It carries no security meaning.')}</dt>
                    <dd class="numeric">${escapeHtml(user.gamerId)}</dd>
                </div>
                <div>
                    <dt>Member since</dt>
                    <dd>${escapeHtml(joined)}</dd>
                </div>
                ${user.region ? `<div><dt>Region</dt><dd>${escapeHtml(user.region)}</dd></div>` : ''}
                ${user.age ? `<div><dt>Age</dt><dd>${escapeHtml(String(user.age))}</dd></div>` : ''}
                ${user.rank && user.rank !== 'Unranked' ? `<div><dt>Rank</dt><dd>${escapeHtml(user.rank)}</dd></div>` : ''}
            </dl>

            <div class="identity__actions">
                <button type="button" class="btn btn--secondary btn--sm" id="rerollAvatar">
                    ${icon('spark', { size: 14 })} New avatar
                </button>
                <button type="button" class="btn btn--ghost btn--sm" id="editFromIdentity">Edit details</button>
            </div>
        </div>
    `);
}

/* ============================================================
   COMPLETION
   ============================================================ */

function renderCompletion() {
    const completion = profileCompletion(user);
    const missing = missingProfileFields(user);

    const LABELS = {
        nickname: 'Nickname', avatarSeed: 'Avatar', dna: 'Gamer DNA', platforms: 'Platforms',
        favoriteGenres: 'Favourite genres', playstyle: 'Playstyle', schedules: 'Schedule',
        roles: 'Squad roles', languages: 'Languages', region: 'Region', bio: 'Short bio',
    };

    render($('#completionHost'), `
        <div class="card completion">
            <div class="completion__head">
                <div>
                    <p class="completion__title">Passport completion</p>
                    <p class="completion__text">
                        ${completion >= 100
                            ? 'Fully registered. Every field the Compatibility Engine can use is filled in.'
                            : 'Missing fields reduce how precisely the engine can match you.'}
                    </p>
                </div>
                <span class="completion__value numeric" data-count="${completion}">${completion}%</span>
            </div>
            <span class="progress progress--accent">
                <span class="progress__fill" data-progress="${completion}"></span>
            </span>
            ${missing.length ? `
                <ul class="completion__missing">
                    ${missing.map((field) => `<li class="tag">${escapeHtml(LABELS[field] ?? field)}</li>`).join('')}
                </ul>
                <button type="button" class="btn btn--primary btn--sm" data-open-edit>Complete my passport</button>
            ` : ''}
        </div>
    `);
}

/* ============================================================
   STATS
   ============================================================ */

function renderStats() {
    const snapshot = progressSnapshot();
    const summary = librarySummary();

    render($('#passportStats'), [
        statMarkup({
            label: 'Gamer Score', value: formatNumber(snapshot.gamerScore), icon: 'spark',
            meta: 'Overall passport strength', accent: 'var(--color-primary)',
            tooltip: 'level × 500 + XP × 0.25 + achievement rarity × 250 + games × 80 + completed × 120 + hours × 2 + reputation × 10 + squad × 100.',
            count: snapshot.gamerScore,
        }),
        statMarkup({
            label: 'Level', value: snapshot.level, icon: 'arrow-up',
            meta: `${formatNumber(snapshot.xp)} XP total`, accent: 'var(--color-primary)',
            count: snapshot.level,
        }),
        statMarkup({
            label: 'Reputation', value: snapshot.reputation, icon: 'shield',
            meta: 'Out of 100', accent: 'var(--color-accent)',
            tooltip: 'Base 50, plus your level, achievements, completed games, squad size and profile completion.',
            count: snapshot.reputation,
        }),
        statMarkup({
            label: 'Library', value: summary.total, icon: 'library',
            meta: `${formatHours(summary.hours)} · ${summary.completed} completed`,
            accent: 'var(--color-text-muted)', count: summary.total,
        }),
        statMarkup({
            label: 'Badges', value: `${snapshot.achievementsUnlocked}/${snapshot.achievementsTotal}`,
            icon: 'trophy', meta: 'Achievements', accent: 'var(--color-primary)',
        }),
        statMarkup({
            label: 'Squad', value: snapshot.squadCount, icon: 'users',
            meta: snapshot.squadCount ? 'Saved teammates' : 'No teammates yet',
            accent: 'var(--color-text-muted)', count: snapshot.squadCount,
        }),
    ].join(''));
}

/* ============================================================
   DNA
   ============================================================ */

function renderDna() {
    if (!user.dna) {
        render($('#dnaFull'), emptyStateMarkup({
            iconName: 'dna',
            title: 'Your DNA is unmapped.',
            text: 'Ten questions produce six attributes and one archetype. Everything from suggested roles to your match quality depends on it.',
            action: '<a class="btn btn--primary btn--sm" href="onboarding.html?stage=dna">Run the analysis</a>',
        }));
        $('#redoDna').hidden = true;
        return;
    }

    const archetype = archetypeOf(user);
    const ranked = user.dna.ranked ?? [];
    const strongest = DNA_ATTRIBUTES.find((attribute) => attribute.id === ranked[0]);
    const weakest = DNA_ATTRIBUTES.find((attribute) => attribute.id === ranked[ranked.length - 1]);

    render($('#dnaFull'), `
        <div class="card card--accented dna-full" style="--archetype-accent:${archetype.accent}">
            <div class="dna-full__head">
                <span class="dna-full__glyph">${icon('dna', { size: 26 })}</span>
                <div>
                    <h3 class="dna-full__archetype">${escapeHtml(archetype.name)}</h3>
                    <p class="dna-full__tagline">${escapeHtml(archetype.tagline)}</p>
                </div>
            </div>

            <p class="dna-full__description">${escapeHtml(archetype.description)}</p>

            <ul class="dna-full__traits">
                ${archetype.traits.map((trait) => `<li>${icon('check', { size: 12 })}${escapeHtml(trait)}</li>`).join('')}
            </ul>

            <div class="dna-full__bars">
                <p class="eyebrow">Attributes ${tipMarkup('Each attribute is a weighted sum of your ten answers, normalised to a 18–98 range. The same answers always produce the same values.')}</p>
                ${dnaListMarkup(user.dna.scores, { large: true })}
            </div>

            <div class="dna-full__summary">
                <p><strong>Strongest:</strong> ${escapeHtml(strongest?.label ?? '—')} — ${escapeHtml(strongest?.description ?? '')}</p>
                <p><strong>Lowest:</strong> ${escapeHtml(weakest?.label ?? '—')} — ${escapeHtml(weakest?.description ?? '')}</p>
                <p class="dna-full__roles">
                    <strong>Suggested roles:</strong>
                    ${archetype.roles.map((role) => `<span class="tag tag--primary">${escapeHtml(labelOf(ROLES, role))}</span>`).join('')}
                </p>
            </div>
        </div>
    `);
}

/* ============================================================
   PREFERENCES
   ============================================================ */

function tagList(items, emptyText) {
    if (!items || items.length === 0) {
        return `<span class="preferences__empty">${escapeHtml(emptyText)}</span>`;
    }
    return items.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('');
}

function renderPreferences() {
    render($('#preferences'), `
        <div class="card preferences">
            <dl class="preferences__list">
                <div class="preferences__row">
                    <dt>Platforms</dt>
                    <dd>${tagList((user.platforms ?? []).map((id) => labelOf(PLATFORMS, id)), 'None selected')}</dd>
                </div>
                <div class="preferences__row">
                    <dt>Favourite genres</dt>
                    <dd>${tagList(user.favoriteGenres, 'None selected')}</dd>
                </div>
                <div class="preferences__row">
                    <dt>Playstyle</dt>
                    <dd>${user.playstyle
                        ? `<span class="tag tag--primary">${escapeHtml(labelOf(PLAYSTYLES, user.playstyle))}</span>`
                        : '<span class="preferences__empty">Not set</span>'}</dd>
                </div>
                <div class="preferences__row">
                    <dt>Availability</dt>
                    <dd>${tagList((user.schedules ?? []).map((id) => labelOf(SCHEDULES, id)), 'Not set')}</dd>
                </div>
                <div class="preferences__row">
                    <dt>Squad roles</dt>
                    <dd>${tagList((user.roles ?? []).map((id) => labelOf(ROLES, id)), 'Not set')}</dd>
                </div>
                <div class="preferences__row">
                    <dt>Languages</dt>
                    <dd>${tagList((user.languages ?? []).map((id) => labelOf(LANGUAGES, id)), 'Not set')}</dd>
                </div>
                <div class="preferences__row">
                    <dt>Voice chat</dt>
                    <dd><span class="tag ${user.voiceChat ? 'tag--accent' : ''}">
                        ${icon(user.voiceChat ? 'mic' : 'mic-off', { size: 11 })}
                        ${user.voiceChat ? 'Enabled' : 'Text only'}
                    </span></dd>
                </div>
            </dl>
        </div>
    `);
}

/* ============================================================
   LIBRARY SIGNATURE
   ============================================================ */

function renderLibrarySnapshot() {
    const summary = librarySummary();

    if (summary.total === 0) {
        render($('#librarySnapshot'), emptyStateMarkup({
            iconName: 'library',
            title: 'Your library is waiting.',
            text: 'Add your first game and your Passport starts describing what you actually play.',
            action: '<a class="btn btn--primary btn--sm" href="library.html?action=add">Add a game</a>',
        }));
        return;
    }

    const maxCount = Math.max(...summary.topGenres.map((genre) => genre.count), 1);

    render($('#librarySnapshot'), `
        <div class="card signature">
            <div class="signature__stats">
                <div><span class="numeric">${summary.total}</span><span>games</span></div>
                <div><span class="numeric">${formatHours(summary.hours)}</span><span>tracked</span></div>
                <div><span class="numeric">${summary.completed}</span><span>completed</span></div>
                <div><span class="numeric">${summary.averageRating || '—'}</span><span>avg rating</span></div>
            </div>

            <p class="eyebrow signature__label">Genre distribution</p>
            <div class="dna-list">
                ${summary.topGenres.map((genre) => `
                    <div class="dna-bar" style="--dna-color:var(--color-primary)">
                        <span class="dna-bar__label">${escapeHtml(genre.genre)}</span>
                        <span class="dna-bar__track">
                            <span class="dna-bar__fill" data-progress="${(genre.count / maxCount) * 100}"></span>
                        </span>
                        <span class="dna-bar__value numeric">${genre.count}</span>
                    </div>
                `).join('')}
            </div>

            <p class="eyebrow signature__label">Platforms in use</p>
            <div class="chip-set">
                ${summary.platforms.map((id) => `<span class="tag">${escapeHtml(labelOf(PLATFORMS, id))}</span>`).join('')}
            </div>
        </div>
    `);
}

/* ============================================================
   BADGE CASE
   ============================================================ */

function renderBadges() {
    const unlocked = getAchievementState()
        .filter((achievement) => achievement.unlocked)
        .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
        .slice(0, 6);

    render($('#passportBadges'), unlocked.length
        ? `<div class="grid grid--badges">${unlocked.map(badgeMarkup).join('')}</div>`
        : emptyStateMarkup({
            iconName: 'trophy',
            title: 'Your badge case is empty.',
            text: 'Your first achievement is closer than you think — adding a single game unlocks one.',
            action: '<a class="btn btn--secondary btn--sm" href="achievements.html">See the list</a>',
        })
    );
}

/* ============================================================
   EDIT DIALOG
   ============================================================ */

function chipGroup(name, items, selected) {
    return `<div class="chip-set">${items.map((item) => `
        <label class="chip">
            <input type="checkbox" name="${name}" value="${escapeHtml(item.id)}"${selected.includes(item.id) ? ' checked' : ''}>
            <span>${escapeHtml(item.label)}</span>
        </label>
    `).join('')}</div>`;
}

function openEditDialog() {
    const body = `
        <form class="stack stack-lg" id="passportForm" novalidate>
            <div class="grid grid--form-2">
                <div class="field">
                    <label class="field__label" for="editNickname">Nickname</label>
                    <input class="input" type="text" id="editNickname" value="${escapeHtml(user.nickname)}"
                           minlength="3" maxlength="18" required data-autofocus>
                    <p class="field__error" id="editNicknameError" role="alert"></p>
                </div>
                <div class="field">
                    <label class="field__label" for="editRank">Your rank</label>
                    <div class="select-wrap">
                        <select class="select" id="editRank">
                            ${RANK_LADDER.map((rank) => `<option value="${rank}"${(user.rank ?? 'Unranked') === rank ? ' selected' : ''}>${rank}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <div class="grid grid--form-2">
                <div class="field">
                    <label class="field__label" for="editRegion">Region</label>
                    <div class="select-wrap">
                        <select class="select" id="editRegion">
                            <option value="">Prefer not to say</option>
                            ${REGIONS.map((region) => `<option value="${escapeHtml(region)}"${user.region === region ? ' selected' : ''}>${escapeHtml(region)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="field">
                    <label class="field__label" for="editAge">Age</label>
                    <input class="input" type="number" id="editAge" min="10" max="120" value="${user.age ?? ''}" placeholder="—">
                </div>
            </div>

            <div class="field">
                <label class="field__label" for="editBio">Short bio</label>
                <textarea class="textarea" id="editBio" maxlength="140" rows="2">${escapeHtml(user.bio ?? '')}</textarea>
            </div>

            <fieldset class="field">
                <legend class="field__label">Platforms</legend>
                ${chipGroup('platforms', PLATFORMS, user.platforms ?? [])}
            </fieldset>

            <fieldset class="field">
                <legend class="field__label">Favourite genres</legend>
                ${chipGroup('genres', GENRES.map((genre) => ({ id: genre, label: genre })), user.favoriteGenres ?? [])}
            </fieldset>

            <div class="field">
                <label class="field__label" for="editPlaystyle">Playstyle</label>
                <div class="select-wrap">
                    <select class="select" id="editPlaystyle">
                        ${PLAYSTYLES.map((style) => `<option value="${style.id}"${user.playstyle === style.id ? ' selected' : ''}>${escapeHtml(style.label)} — ${escapeHtml(style.hint)}</option>`).join('')}
                    </select>
                </div>
            </div>

            <fieldset class="field">
                <legend class="field__label">Availability</legend>
                ${chipGroup('schedules', SCHEDULES, user.schedules ?? [])}
            </fieldset>

            <fieldset class="field">
                <legend class="field__label">Squad roles</legend>
                ${chipGroup('roles', ROLES, user.roles ?? [])}
            </fieldset>

            <fieldset class="field">
                <legend class="field__label">Languages</legend>
                ${chipGroup('languages', LANGUAGES, user.languages ?? [])}
            </fieldset>

            <div class="field">
                <label class="toggle">
                    <input type="checkbox" id="editVoice"${user.voiceChat ? ' checked' : ''}>
                    <span class="toggle__track" aria-hidden="true"></span>
                    <span>I use voice chat</span>
                </label>
            </div>
        </form>
    `;

    const { close, root } = openModal({
        title: 'Edit your Passport',
        subtitle: 'Everything here feeds the Compatibility Engine.',
        wide: true,
        body,
        footer: `
            <button type="button" class="btn btn--ghost" data-modal-close>Cancel</button>
            <button type="submit" form="passportForm" class="btn btn--primary">Save passport</button>
        `,
    });

    root.querySelector('#passportForm').addEventListener('submit', (event) => {
        event.preventDefault();

        const nickname = root.querySelector('#editNickname').value.trim();
        if (nickname.length < 3 || nickname.length > 18) {
            root.querySelector('#editNicknameError').textContent = 'Nickname must be 3–18 characters.';
            root.querySelector('#editNickname').focus();
            return;
        }

        const checkedValues = (name) =>
            Array.from(root.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);

        const age = Number(root.querySelector('#editAge').value);

        updateUser({
            nickname,
            rank: root.querySelector('#editRank').value,
            region: root.querySelector('#editRegion').value,
            age: Number.isFinite(age) && age >= 10 && age <= 120 ? age : null,
            bio: root.querySelector('#editBio').value.trim(),
            platforms: checkedValues('platforms'),
            favoriteGenres: checkedValues('genres'),
            playstyle: root.querySelector('#editPlaystyle').value,
            schedules: checkedValues('schedules'),
            roles: checkedValues('roles'),
            languages: checkedValues('languages'),
            voiceChat: root.querySelector('#editVoice').checked,
        });

        close();
        afterSave('Passport updated.');
    });
}

function afterSave(message) {
    user = getUser();

    const completion = profileCompletion(user);
    if (completion >= 100) awardOnce('completeProfile', { silent: true });
    else awardXp('updateProfile', { silent: true });

    toast({ title: message, message: `Profile completion: ${completion}%`, type: 'success' });
    checkAchievements();
    renderAll();
    refreshNavigationProgress();
}

/* ============================================================
   RENDER PIPELINE
   ============================================================ */

function renderAll() {
    renderCard();
    renderIdentity();
    renderCompletion();
    renderStats();
    renderDna();
    renderPreferences();
    renderLibrarySnapshot();
    renderBadges();

    afterRender(document);

    document.querySelectorAll('#main-content [data-count]').forEach((node) => {
        const target = Number(node.dataset.count);
        if (!Number.isFinite(target)) return;
        const suffix = node.textContent.trim().endsWith('%') ? '%' : '';
        countUp(node, target, { duration: 850, suffix });
    });
}

/* ============================================================
   DELEGATION
   ============================================================ */

document.getElementById('main-content').addEventListener('click', (event) => {
    if (event.target.closest('#editPassportBtn, #editFromIdentity, [data-open-edit]')) {
        openEditDialog();
        return;
    }

    if (event.target.closest('#rerollAvatar')) {
        // Deterministic: the seed advances by a stable hash, not by random.
        const nextSeed = `${user.nickname}-${hashString(user.avatarSeed + user.gamerId) % 9973}`;
        updateUser({ avatarSeed: nextSeed });
        user = getUser();
        renderCard();
        renderIdentity();
        toast({ title: 'Avatar regenerated.', message: 'Your card has a new look.', type: 'info' });
    }
});

/* ============================================================
   BOOT
   ============================================================ */

renderAll();

if (new URLSearchParams(window.location.search).get('edit') === '1') {
    openEditDialog();
}
