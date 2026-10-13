/**
 * passport.js — controller for the Passaporte Gamer page.
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
    DNA_ATTRIBUTES, RANK_LADDER, getGameById, rankLabel, regionLabel, genreLabel,
} from './data.js';
import { dnaListMarkup, statMarkup, badgeMarkup, gameMarkMarkup } from './cards.js';
import { openModal } from './modal.js';
import { toast } from './notifications.js';
import { refreshNavigationProgress } from './navigation.js';
import {
    $, render, escapeHtml, icon, formatNumber, formatHours, emptyStateMarkup, tipMarkup, bannerArt, colWrap,
} from './ui.js';
import { communitySnapshot } from './community-summary.js';
import { emblemMarkup, tierBadgeMarkup, playerChipMarkup } from './community-ui.js';
import { relationList } from './sessions.js';
import { ROLE_LABELS } from './clans-store.js';
import { userAvatarMarkup, resolveAvatar } from './avatar-service.js';
import { openAvatarPicker } from './avatar-picker.js';
import { attachPointerLight, countUp } from './animations.js';
import {
    validateForm, bindLiveValidation, focusFirstInvalid, required, minLength, maxLength, noHtml, numberRange,
} from './validation.js';

let user = bootApp({
    page: 'passport',
    title: 'Passaporte Gamer',
    subtitle: 'Seu registro de identidade',
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

    const community = communitySnapshot();
    render($('#passportCardHost'), `
        <article class="passport-card is-complete ${bannerGame ? 'has-banner' : ''}" id="passportCard">
            ${bannerGame ? `<span class="passport-card__banner" aria-hidden="true">${bannerArt(bannerGame)}</span>` : ''}
            <div class="passport-card__sheen" aria-hidden="true"></div>

            <header class="passport-card__head">
                <div>
                    <p class="passport-card__brand">RIVALY</p>
                    <p class="passport-card__type">Passaporte Gamer</p>
                </div>
                <p class="passport-card__id numeric">${escapeHtml(user.gamerId)}</p>
            </header>

            <div class="passport-card__identity">
                <span class="passport-card__avatar is-in">${userAvatarMarkup(user, { size: 'lg', alt: `Avatar de ${user.nickname}` })}</span>
                <div>
                    <p class="passport-card__nick is-in">${escapeHtml(user.nickname)}</p>
                    <p class="passport-card__archetype is-in">${escapeHtml(archetype?.name ?? 'DNA não analisado')}</p>
                </div>
                <div class="passport-card__level">
                    <span class="passport-card__level-value numeric">${snapshot.level}</span>
                    <span class="passport-card__level-label">Nível</span>
                </div>
            </div>

            <div class="passport-card__xp">
                <div class="passport-card__xp-head">
                    <span>Nível ${snapshot.level}</span>
                    <span class="numeric">${formatNumber(snapshot.currentLevelXp)} / ${formatNumber(snapshot.nextLevelXp)} XP</span>
                </div>
                <span class="progress progress--thin progress--xp">
                    <span class="progress__fill" data-progress="${snapshot.percent}"></span>
                </span>
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

            ${user.dna ? `
                <div class="passport-card__section">
                    <p class="passport-card__section-title">DNA Gamer</p>
                    ${dnaListMarkup(user.dna.scores)}
                </div>` : ''}

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
                    <span class="passport-card__foot-label">Arena</span>
                    <span class="numeric">${formatNumber(community.arena.rating)}</span>
                </span>
                <span class="passport-card__foot-item">
                    <span class="passport-card__foot-label">Clã</span>
                    <span class="numeric">${community.clan ? `[${escapeHtml(community.clan.tag)}]` : '—'}</span>
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
    const joined = new Date(user.createdAt).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric',
    });

    render($('#passportIdentity'), `
        <div class="card identity">
            <p class="eyebrow">Identidade</p>
            <span class="avatar avatar--xl identity__avatar">${userAvatarMarkup(user, { size: 'xl', alt: `Avatar de ${user.nickname}` })}</span>
            <h2 class="identity__nick">${escapeHtml(user.nickname)}</h2>
            ${archetype ? `<p class="identity__archetype" style="color:${archetype.accent}">${escapeHtml(archetype.name)}</p>` : ''}
            ${user.bio ? `<p class="identity__bio">${escapeHtml(user.bio)}</p>` : ''}

            <dl class="identity__facts">
                <div>
                    <dt>Gamer ID ${tipMarkup('Um identificador visual local, gerado a partir do seu apelido e da data de criação. Não tem função de segurança.')}</dt>
                    <dd class="numeric">${escapeHtml(user.gamerId)}</dd>
                </div>
                <div>
                    <dt>Membro desde</dt>
                    <dd>${escapeHtml(joined)}</dd>
                </div>
                ${user.region ? `<div><dt>Região</dt><dd>${escapeHtml(regionLabel(user.region))}</dd></div>` : ''}
                ${user.age ? `<div><dt>Idade</dt><dd>${escapeHtml(String(user.age))}</dd></div>` : ''}
                ${user.rank && user.rank !== 'Unranked' ? `<div><dt>Rank</dt><dd>${escapeHtml(rankLabel(user.rank))}</dd></div>` : ''}
            </dl>

            <div class="identity__actions">
                <button type="button" class="btn btn-outline-light btn-sm" id="chooseAvatar">
                    ${icon('user', { size: 14 })} Trocar avatar
                </button>
                <button type="button" class="btn btn-ghost btn-sm" id="editFromIdentity">Editar dados</button>
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
        nickname: 'Apelido', avatarSeed: 'Avatar', dna: 'DNA Gamer', platforms: 'Plataformas',
        favoriteGenres: 'Gêneros favoritos', playstyle: 'Estilo de jogo', schedules: 'Disponibilidade',
        roles: 'Funções no squad', languages: 'Idiomas', region: 'Região', bio: 'Bio curta',
    };

    render($('#completionHost'), `
        <div class="card completion">
            <div class="completion__head">
                <div>
                    <p class="completion__title">Conclusão do Passaporte</p>
                    <p class="completion__text">
                        ${completion >= 100
                            ? 'Cadastro completo. Todos os campos usados pelo Motor de Compatibilidade estão preenchidos.'
                            : 'Campos ausentes reduzem a precisão das combinações do motor.'}
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
                <button type="button" class="btn btn-primary btn-sm" data-open-edit>Completar meu Passaporte</button>
            ` : ''}
        </div>
    `);
}

/* ============================================================
   COMUNIDADE
   Tudo o que a Arena, os clãs e as sessões devolvem ao Passaporte.
   ============================================================ */

function renderCommunity() {
    const snap = communitySnapshot();
    const allies = relationList('ally').slice(0, 4);
    const rivals = relationList('rival').slice(0, 4);

    const clanTile = snap.clan
        ? `<article class="card h-100 passport-tile">
                <div class="card-body passport-tile__clan">
                    ${emblemMarkup(snap.clan, 56)}
                    <div>
                        <p class="eyebrow">Clã · ${escapeHtml(ROLE_LABELS[snap.role] ?? 'Membro')}</p>
                        <p class="passport-tile__title"><span class="clan-tag">[${escapeHtml(snap.clan.tag)}]</span> ${escapeHtml(snap.clan.name)}</p>
                        <p class="card-text">Nível ${snap.clanStats.level.level} · ${snap.clan.roster.length} membros</p>
                    </div>
                </div>
           </article>`
        : `<article class="card h-100 passport-tile passport-tile--empty">
                <div class="card-body">
                    <p class="eyebrow">Clã</p>
                    <p class="passport-tile__title">Sem clã por enquanto</p>
                    <a class="btn btn-outline-light btn-sm mt-2" href="clans.html#exploreTitle">Ver clãs compatíveis</a>
                </div>
           </article>`;

    const arenaTile = `
        <article class="card h-100 passport-tile">
            <div class="card-body">
                <p class="eyebrow">Arena</p>
                <p class="passport-tile__value numeric">${formatNumber(snap.arena.rating)}</p>
                <p class="card-text">${tierBadgeMarkup(snap.arena.rating)} ${snap.arena.wins}V ${snap.arena.losses}D · pico ${formatNumber(snap.arena.peak ?? snap.arena.rating)}</p>
            </div>
        </article>`;

    const people = (list, empty) => (list.length
        ? `<div class="squad-chips">${list.map((entry) => playerChipMarkup(entry.player.id)).join('')}</div>`
        : `<p class="card-text">${escapeHtml(empty)}</p>`);

    const alliesTile = `
        <article class="card h-100 passport-tile">
            <div class="card-body">
                <p class="eyebrow">Aliados</p>
                <p class="passport-tile__value numeric" data-ally-count>${snap.relations.allies}</p>
                ${people(allies, 'Marque aliados no pós-partida de uma sessão.')}
            </div>
        </article>`;

    const rivalsTile = `
        <article class="card h-100 passport-tile">
            <div class="card-body">
                <p class="eyebrow">Rivais</p>
                <p class="passport-tile__value numeric" data-rival-count>${snap.relations.rivals}</p>
                ${people(rivals, 'Rival é quem você quer enfrentar de novo.')}
            </div>
        </article>`;

    render($('#passportCommunity'), [clanTile, arenaTile, alliesTile, rivalsTile].map((tile) => colWrap(tile)).join(''));
}

/* ============================================================
   STATS
   ============================================================ */

function renderStats() {
    const snapshot = progressSnapshot();
    const summary = librarySummary();

    render($('#passportStats'), [
        statMarkup({
            label: 'Pontuação Gamer', value: formatNumber(snapshot.gamerScore), icon: 'spark',
            meta: 'Força geral do Passaporte', accent: 'var(--color-primary)',
            tooltip: 'nível × 500 + XP × 0,25 + raridade das conquistas × 250 + jogos × 80 + zerados × 120 + horas × 2 + reputação × 10 + squad × 100.',
            count: snapshot.gamerScore,
        }),
        statMarkup({
            label: 'Nível', value: snapshot.level, icon: 'arrow-up',
            meta: `${formatNumber(snapshot.xp)} XP total`, accent: 'var(--color-primary)',
            count: snapshot.level,
        }),
        statMarkup({
            label: 'Reputação', value: snapshot.reputation, icon: 'shield',
            meta: 'De 100', accent: 'var(--color-accent)',
            tooltip: 'Base 50, mais seu nível, conquistas, jogos zerados, tamanho do squad e o quanto o perfil está completo.',
            count: snapshot.reputation,
        }),
        statMarkup({
            label: 'Biblioteca', value: summary.total, icon: 'library',
            meta: `${formatHours(summary.hours)} · ${summary.completed} zerados`,
            accent: 'var(--color-text-muted)', count: summary.total,
        }),
        statMarkup({
            label: 'Medalhas', value: `${snapshot.achievementsUnlocked}/${snapshot.achievementsTotal}`,
            icon: 'trophy', meta: 'Conquistas', accent: 'var(--color-primary)',
        }),
        statMarkup({
            label: 'Squad', value: snapshot.squadCount, icon: 'users',
            meta: snapshot.squadCount ? 'Parceiros salvos' : 'Nenhum parceiro ainda',
            accent: 'var(--color-text-muted)', count: snapshot.squadCount,
        }),
    ].map((stat) => colWrap(stat)).join(''));
}

/* ============================================================
   DNA
   ============================================================ */

function renderDna() {
    if (!user.dna) {
        render($('#dnaFull'), emptyStateMarkup({
            iconName: 'dna',
            title: 'Seu DNA ainda não foi mapeado.',
            text: 'Dez perguntas definem seis atributos e um arquétipo. As funções sugeridas e a qualidade das combinações dependem desse resultado.',
            action: '<a class="btn btn-primary btn-sm" href="onboarding.html?stage=dna">Descobrir meu arquétipo</a>',
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
                <p class="eyebrow">Atributos ${tipMarkup('Cada atributo é uma soma ponderada das suas dez respostas, normalizada para a faixa de 18 a 98. As mesmas respostas sempre produzem os mesmos valores.')}</p>
                ${dnaListMarkup(user.dna.scores, { large: true })}
            </div>

            <div class="dna-full__summary">
                <p><strong>Mais forte:</strong> ${escapeHtml(strongest?.label ?? '—')} — ${escapeHtml(strongest?.description ?? '')}</p>
                <p><strong>Menor pontuação:</strong> ${escapeHtml(weakest?.label ?? '—')} — ${escapeHtml(weakest?.description ?? '')}</p>
                <p class="dna-full__roles">
                    <strong>Funções sugeridas:</strong>
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
                    <dt>Plataformas</dt>
                    <dd>${tagList((user.platforms ?? []).map((id) => labelOf(PLATFORMS, id)), 'Nenhuma selecionada')}</dd>
                </div>
                <div class="preferences__row">
                    <dt>Gêneros favoritos</dt>
                    <dd>${tagList((user.favoriteGenres ?? []).map(genreLabel), 'Nenhum selecionado')}</dd>
                </div>
                <div class="preferences__row">
                    <dt>Estilo de jogo</dt>
                    <dd>${user.playstyle
                        ? `<span class="tag tag--primary">${escapeHtml(labelOf(PLAYSTYLES, user.playstyle))}</span>`
                        : '<span class="preferences__empty">Não definido</span>'}</dd>
                </div>
                <div class="preferences__row">
                    <dt>Disponibilidade</dt>
                    <dd>${tagList((user.schedules ?? []).map((id) => labelOf(SCHEDULES, id)), 'Não informada')}</dd>
                </div>
                <div class="preferences__row">
                    <dt>Funções no squad</dt>
                    <dd>${tagList((user.roles ?? []).map((id) => labelOf(ROLES, id)), 'Não informadas')}</dd>
                </div>
                <div class="preferences__row">
                    <dt>Idiomas</dt>
                    <dd>${tagList((user.languages ?? []).map((id) => labelOf(LANGUAGES, id)), 'Não informados')}</dd>
                </div>
                <div class="preferences__row">
                    <dt>Chat de voz</dt>
                    <dd><span class="tag ${user.voiceChat ? 'tag--accent' : ''}">
                        ${icon(user.voiceChat ? 'mic' : 'mic-off', { size: 11 })}
                        ${user.voiceChat ? 'Ativado' : 'Somente texto'}
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
            title: 'Sua biblioteca está esperando.',
            text: 'Adicione seu primeiro jogo e o Passaporte começará a descrever o que você realmente joga.',
            action: '<a class="btn btn-primary btn-sm" href="library.html?action=add">Adicionar um jogo</a>',
        }));
        return;
    }

    const maxCount = Math.max(...summary.topGenres.map((genre) => genre.count), 1);

    render($('#librarySnapshot'), `
        <div class="card signature">
            <div class="signature__stats">
                <div><span class="numeric">${summary.total}</span><span>jogos</span></div>
                <div><span class="numeric">${formatHours(summary.hours)}</span><span>registradas</span></div>
                <div><span class="numeric">${summary.completed}</span><span>concluídos</span></div>
                <div><span class="numeric">${summary.averageRating || '—'}</span><span>nota média</span></div>
            </div>

            <p class="eyebrow signature__label">Distribuição por gênero</p>
            <div class="dna-list">
                ${summary.topGenres.map((genre) => `
                    <div class="dna-bar" style="--dna-color:var(--color-primary)">
                        <span class="dna-bar__label">${escapeHtml(genreLabel(genre.genre))}</span>
                        <span class="dna-bar__track">
                            <span class="dna-bar__fill" data-progress="${(genre.count / maxCount) * 100}"></span>
                        </span>
                        <span class="dna-bar__value numeric">${genre.count}</span>
                    </div>
                `).join('')}
            </div>

            <p class="eyebrow signature__label">Plataformas em uso</p>
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
            title: 'Sua estante de medalhas está vazia.',
            text: 'Sua primeira conquista está mais perto do que parece: adicionar um único jogo já desbloqueia uma.',
            action: '<a class="btn btn-outline-light btn-sm" href="achievements.html">Ver todas as conquistas</a>',
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

/** Captura o estado do formulario antes de ceder o modal ao picker. */
function snapshotEditForm(root) {
    const form = root.querySelector('#passportForm');
    if (!form) return null;

    const values = {};
    const checked = [];
    form.querySelectorAll('input, select, textarea').forEach((el) => {
        if (el.type === 'checkbox' || el.type === 'radio') {
            if (el.checked) checked.push(`${el.name}=${el.value}`);
        } else if (el.id) {
            values[el.id] = el.value;
        }
    });
    return { values, checked };
}

/** Devolve ao formulario o que o usuario ja tinha preenchido. */
function restoreEditForm(root, draft) {
    if (!draft) return;
    const form = root.querySelector('#passportForm');
    if (!form) return;

    Object.entries(draft.values).forEach(([id, value]) => {
        const el = form.querySelector(`#${CSS.escape(id)}`);
        if (el) el.value = value;
    });

    const wanted = new Set(draft.checked);
    form.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach((el) => {
        el.checked = wanted.has(`${el.name}=${el.value}`);
    });
}

function openEditDialog(draft = null) {
    // A escolha do avatar so e gravada quando o formulario e salvo, entao
    // fechar no Cancelar nao deixa um avatar novo para tras.
    let pendingAvatar = draft?.avatar ?? null;
    const shownUser = pendingAvatar ? { ...user, avatar: pendingAvatar } : user;

    const body = `
        <div class="edit-avatar">
            <span class="avatar avatar--xl edit-avatar__preview" id="editAvatarPreview">
                ${userAvatarMarkup(shownUser, { size: 'xl', alt: `Avatar de ${user.nickname}` })}
            </span>
            <div class="edit-avatar__body">
                <p class="form-label">Seu avatar</p>
                <p class="settings-row__hint">
                    Gerado pelo DiceBear a partir de uma semente: a mesma semente
                    devolve sempre o mesmo desenho. Você também pode enviar a sua própria imagem.
                </p>
                <button type="button" class="btn btn-outline-light btn-sm" id="editChooseAvatar">
                    Escolher outro avatar
                </button>
            </div>
        </div>

        <form class="stack stack-lg" id="passportForm" novalidate>
            <div class="grid grid--form-2">
                <div class="field">
                    <label class="form-label" for="editNickname">Apelido</label>
                    <input class="form-control" type="text" id="editNickname" value="${escapeHtml(user.nickname)}"
                           maxlength="18" required data-autofocus aria-describedby="editNicknameHelp">
                    <p class="form-text" id="editNicknameHelp">De 3 a 18 caracteres.</p>
                </div>
                <div class="field">
                    <label class="form-label" for="editRank">Seu rank</label>
                    <div>
                        <select class="form-select" id="editRank">
                            ${RANK_LADDER.map((rank) => `<option value="${rank}"${(user.rank ?? 'Unranked') === rank ? ' selected' : ''}>${escapeHtml(rankLabel(rank))}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <div class="grid grid--form-2">
                <div class="field">
                    <label class="form-label" for="editRegion">Região</label>
                    <div>
                        <select class="form-select" id="editRegion">
                            <option value="">Prefiro não dizer</option>
                            ${REGIONS.map((region) => `<option value="${escapeHtml(region)}"${user.region === region ? ' selected' : ''}>${escapeHtml(regionLabel(region))}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="field">
                    <label class="form-label" for="editAge">Idade</label>
                    <input class="form-control" type="number" id="editAge" min="10" max="120" value="${user.age ?? ''}" inputmode="numeric" aria-describedby="editAgeHelp">
                    <p class="form-text" id="editAgeHelp">Opcional, de 10 a 120.</p>
                </div>
            </div>

            <div class="field">
                <label class="form-label" for="editBio">Bio curta</label>
                <textarea class="form-control" id="editBio" maxlength="140" rows="2">${escapeHtml(user.bio ?? '')}</textarea>
            </div>

            <fieldset class="field">
                <legend class="form-label">Plataformas</legend>
                ${chipGroup('platforms', PLATFORMS, user.platforms ?? [])}
            </fieldset>

            <fieldset class="field">
                <legend class="form-label">Gêneros favoritos</legend>
                ${chipGroup('genres', GENRES.map((genre) => ({ id: genre, label: genreLabel(genre) })), user.favoriteGenres ?? [])}
            </fieldset>

            <div class="field">
                <label class="form-label" for="editPlaystyle">Estilo de jogo</label>
                <div>
                    <select class="form-select" id="editPlaystyle">
                        ${PLAYSTYLES.map((style) => `<option value="${style.id}"${user.playstyle === style.id ? ' selected' : ''}>${escapeHtml(style.label)} — ${escapeHtml(style.hint)}</option>`).join('')}
                    </select>
                </div>
            </div>

            <fieldset class="field">
                <legend class="form-label">Disponibilidade</legend>
                ${chipGroup('schedules', SCHEDULES, user.schedules ?? [])}
            </fieldset>

            <fieldset class="field">
                <legend class="form-label">Funções no squad</legend>
                ${chipGroup('roles', ROLES, user.roles ?? [])}
            </fieldset>

            <fieldset class="field">
                <legend class="form-label">Idiomas</legend>
                ${chipGroup('languages', LANGUAGES, user.languages ?? [])}
            </fieldset>

            <div class="field">
                <label class="toggle">
                    <input type="checkbox" id="editVoice"${user.voiceChat ? ' checked' : ''}>
                    <span class="toggle__track" aria-hidden="true"></span>
                    <span>Uso chat de voz</span>
                </label>
            </div>
        </form>
    `;

    const { close, root } = openModal({
        title: 'Editar seu Passaporte',
        subtitle: 'Tudo aqui alimenta o Motor de Compatibilidade.',
        wide: true,
        body,
        footer: `
            <button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>
            <button type="submit" form="passportForm" class="btn btn-primary">Salvar meu Passaporte</button>
        `,
    });

    root.querySelector('#editChooseAvatar').addEventListener('click', () => {
        const pending = snapshotEditForm(root);
        openAvatarPicker(
            { ...user, avatar: pendingAvatar ?? user.avatar },
            (selection) => openEditDialog({ ...pending, avatar: selection }),
            { onCancel: () => openEditDialog({ ...pending, avatar: pendingAvatar }) },
        );
    });

    restoreEditForm(root, draft);

    const editSchema = {
        editNickname: [
            required('Escreva um apelido.'),
            minLength(3, 'O apelido precisa ter pelo menos 3 caracteres.'),
            maxLength(18, 'O apelido pode ter no máximo 18 caracteres.'),
            noHtml(),
        ],
        editAge: [numberRange(10, 120, 'Use uma idade entre 10 e 120, ou deixe em branco.')],
        editBio: [maxLength(140, 'A bio pode ter no máximo 140 caracteres.'), noHtml()],
    };
    bindLiveValidation(root.querySelector('#passportForm'), editSchema);

    root.querySelector('#passportForm').addEventListener('submit', (event) => {
        event.preventDefault();

        const result = validateForm(root.querySelector('#passportForm'), editSchema);
        if (!result.valid) {
            focusFirstInvalid(result);
            return;
        }
        const nickname = result.values.editNickname.trim();

        const checkedValues = (name) =>
            Array.from(root.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);

        const age = Number(root.querySelector('#editAge').value);

        updateUser({
            ...(pendingAvatar ? { avatar: pendingAvatar } : {}),
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
        afterSave('Passaporte atualizado.');
    });
}

function afterSave(message) {
    user = getUser();

    const completion = profileCompletion(user);
    if (completion >= 100) awardOnce('completeProfile', { silent: true });
    else awardXp('updateProfile', { silent: true });

    toast({ title: message, message: `Conclusão do perfil: ${completion}%`, type: 'success' });
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
    renderCommunity();
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

    if (event.target.closest('#chooseAvatar')) {
        openAvatarPicker(user, (selection) => {
            updateUser({ avatar: selection });
            user = getUser();
            renderCard();
            renderIdentity();
            const label = selection.type === 'upload' ? 'Sua imagem foi definida.' : `${selection.style} · ${selection.seed}`;
            toast({ title: 'Avatar atualizado.', message: label, type: 'success' });
        });
    }
});

/* ============================================================
   BOOT
   ============================================================ */

renderAll();

if (new URLSearchParams(window.location.search).get('edit') === '1') {
    openEditDialog();
}
