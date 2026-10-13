/**
 * dashboard.js — the home screen of the application.
 *
 * Reads only; it never mutates progression. Everything shown here is
 * derived from the passport, the library, the activity ledger and the
 * Motor de Compatibilidade.
 */

import { bootApp, afterRender, haltModule } from './app.js';
import { render, escapeHtml, formatNumber, icon, emptyStateMarkup, formatHours, colWrap, plural } from './ui.js';
import { progressSnapshot, getAchievementState } from './gamification.js';
import { archetypeOf, profileCompletion, missingProfileFields } from './profile.js';
import { listHydrated, librarySummary } from './library-store.js';
import { getRecentActivity } from './activity.js';
import { findMatches } from './compatibility.js';
import { statMarkup, gameRowMarkup, squadRowMarkup, badgeMarkup, activityItemMarkup, dnaListMarkup } from './cards.js';
import { countUp } from './animations.js';
import { getGameById } from './data.js';
import { communitySnapshot, nextStep } from './community-summary.js';
import { emblemMarkup, tierBadgeMarkup } from './community-ui.js';
import { ROLE_LABELS } from './clans-store.js';

const user = bootApp({
    page: 'dashboard',
    title: 'Início',
    subtitle: 'Seu Passaporte num relance',
});
if (!user) await haltModule();

const snapshot = progressSnapshot();
const summary = librarySummary();
const archetype = archetypeOf(user);

/* ============================================================
   GREETING
   ============================================================ */

function greetingLine() {
    const hour = new Date().getHours();
    if (hour < 6) return 'Sessão até tarde?';
    if (hour < 12) return 'Pronto para jogar?';
    if (hour < 18) return 'O que vamos jogar hoje?';
    return 'Horário nobre. Pronto para jogar?';
}

document.getElementById('greetingTitle').textContent = `Bem-vindo de volta, ${user.nickname}.`;
document.getElementById('greetingSub').textContent = greetingLine();

/* ============================================================
   SETUP NUDGE
   Only shown when the passport is genuinely incomplete.
   ============================================================ */

const completion = profileCompletion(user);
const missing = missingProfileFields(user);

if (completion < 100) {
    const needsDna = missing.includes('dna');
    render(document.getElementById('setupNudge'), `
        <aside class="nudge" role="note">
            <span class="nudge__icon">${icon(needsDna ? 'dna' : 'id', { size: 20 })}</span>
            <div class="nudge__body">
                <p class="nudge__title">${needsDna ? 'Seu DNA Gamer ainda não foi mapeado.' : 'Seu Passaporte está ' + completion + '% completo.'}</p>
                <p class="nudge__text">${needsDna
                    ? 'Dez perguntas definem seus seis atributos e seu arquétipo. O restante da plataforma usa esses dados.'
                    : 'Concluir o Passaporte melhora a qualidade das combinações e desbloqueia a medalha Cadastro Completo.'}</p>
                <div class="nudge__meter">
                    <span class="progress progress--thin">
                        <span class="progress__fill" data-progress="${completion}"></span>
                    </span>
                    <span class="numeric">${completion}%</span>
                </div>
            </div>
            <a class="btn btn-primary btn-sm" href="${needsDna ? 'onboarding.html?stage=dna' : 'passport.html?edit=1'}">
                ${needsDna ? 'Começar o DNA' : 'Completar meu Passaporte'}
            </a>
        </aside>
    `);
}

/* ============================================================
   OVERVIEW
   ============================================================ */

/* ============================================================
   PRÓXIMO PASSO
   Uma ação só: a que mais faz o Passaporte avançar agora.
   ============================================================ */

function renderNextStep() {
    const step = nextStep();
    const cta = step.cta.href
        ? `<a class="btn btn-primary" href="${escapeHtml(step.cta.href)}">${escapeHtml(step.cta.label)}</a>`
        : `<button type="button" class="btn btn-primary" data-dashboard-action="${escapeHtml(step.cta.action)}">${escapeHtml(step.cta.label)}</button>`;
    render(document.getElementById('nextStep'), `
        <article class="card next-step">
            <div class="card-body next-step__body">
                <span class="next-step__icon">${icon(step.icon, { size: 22 })}</span>
                <div class="next-step__copy">
                    <h3 class="card-title next-step__title">${escapeHtml(step.title)}</h3>
                    <p class="card-text">${escapeHtml(step.text)}</p>
                    <p class="next-step__why">${icon('info', { size: 12 })} ${escapeHtml(step.why)}</p>
                </div>
                <div class="next-step__cta">${cta}</div>
            </div>
        </article>
    `);
}

/* ============================================================
   ARENA E CLÃ
   ============================================================ */

function renderCommunity() {
    const snap = communitySnapshot();
    const arenaCard = `
        <article class="card h-100 community-card">
            <div class="card-body">
                <p class="eyebrow">Arena</p>
                <p class="community-card__value numeric">${formatNumber(snap.arena.rating)}</p>
                <p class="card-text">${tierBadgeMarkup(snap.arena.rating)} ${snap.arena.matches
                    ? `${snap.arena.wins}V ${snap.arena.losses}D · ${snap.arena.season.points} pts na temporada`
                    : 'Nenhuma partida ainda'}</p>
                <div class="progress mt-2" role="progressbar" aria-label="Progresso até o próximo tier" aria-valuenow="${Math.round(snap.tierProgress.percent)}" aria-valuemin="0" aria-valuemax="100">
                    <div class="progress-bar" style="width:${snap.tierProgress.percent}%"></div>
                </div>
                <p class="form-text">${snap.tierProgress.next ? `Faltam ${snap.tierProgress.remaining} para ${escapeHtml(snap.tierProgress.next.label)}.` : 'Tier máximo.'}</p>
            </div>
            <div class="card-footer"><a class="btn btn-outline-light btn-sm w-100" href="arena.html#playTitle">${snap.arena.matches ? 'Jogar outra partida' : 'Estrear na Arena'}</a></div>
        </article>`;

    const clanCard = snap.clan
        ? `
        <article class="card h-100 community-card">
            <div class="card-body">
                <div class="community-card__clan">
                    ${emblemMarkup(snap.clan, 44)}
                    <div>
                        <p class="eyebrow">${escapeHtml(ROLE_LABELS[snap.role] ?? 'Membro')}</p>
                        <p class="community-card__clan-name"><span class="clan-tag">[${escapeHtml(snap.clan.tag)}]</span> ${escapeHtml(snap.clan.name)}</p>
                    </div>
                </div>
                <div class="clan-goal mt-2">
                    <div class="clan-goal__head"><span>Meta semanal</span><span class="numeric">${snap.clanStats.weekPoints}/${snap.clanStats.goal}</span></div>
                    <div class="progress" role="progressbar" aria-label="Meta semanal do clã" aria-valuenow="${snap.clanStats.goalPercent}" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-bar" style="width:${snap.clanStats.goalPercent}%"></div>
                    </div>
                </div>
                <p class="form-text">Nível ${snap.clanStats.level.level} · ${plural(snap.clan.roster.length, 'membro')} · ${plural(snap.relations.allies, 'aliado')} · ${plural(snap.relations.rivals, 'rival', 'rivais')}</p>
            </div>
            <div class="card-footer"><a class="btn btn-outline-light btn-sm w-100" href="clans.html#myClanTitle">Ver meu clã</a></div>
        </article>`
        : `
        <article class="card h-100 community-card community-card--empty">
            <div class="card-body">
                <p class="eyebrow">Clã</p>
                <p class="card-title">Você ainda não está em um clã.</p>
                <p class="card-text">Clãs compatíveis com o seu DNA estão na página Clãs, do mais compatível para o menos.</p>
                <p class="form-text">${plural(snap.relations.allies, 'aliado')} · ${plural(snap.relations.rivals, 'rival', 'rivais')} · ${plural(snap.sessions, 'sessão', 'sessões')}</p>
            </div>
            <div class="card-footer"><a class="btn btn-primary btn-sm w-100" href="clans.html#exploreTitle">Ver clãs compatíveis</a></div>
        </article>`;

    render(document.getElementById('communitySummary'), colWrap(arenaCard) + colWrap(clanCard));
}

renderNextStep();
renderCommunity();

document.getElementById('main-content').addEventListener('click', (event) => {
    if (!event.target.closest('[data-dashboard-action="open-invites"]')) return;
    const toggle = document.querySelector('.invites__toggle');
    if (toggle) window.bootstrap?.Dropdown.getOrCreateInstance(toggle).show();
});

document.addEventListener('rivaly:community-changed', () => {
    renderNextStep();
    renderCommunity();
});
document.addEventListener('rivaly:invites-changed', renderNextStep);

/* ============================================================
   OVERVIEW
   ============================================================ */

render(document.getElementById('overviewStats'), [
    statMarkup({
        label: 'Nível',
        value: snapshot.level,
        meta: `${formatNumber(snapshot.remaining)} XP para o nível ${snapshot.level + 1}`,
        icon: 'arrow-up',
        accent: 'var(--color-primary)',
        tooltip: 'Os níveis vêm do XP. Cada nível custa 500 XP a mais que o anterior.',
        count: snapshot.level,
    }),
    statMarkup({
        label: 'Experiência',
        value: formatNumber(snapshot.xp),
        meta: `${Math.round(snapshot.percent)}% deste nível`,
        icon: 'bolt',
        accent: 'var(--color-primary)',
        tooltip: 'O XP vem de ações reais: adicionar jogos, zerá-los, encontrar squads e completar seu Passaporte.',
        count: snapshot.xp,
    }),
    statMarkup({
        label: 'Pontuação Gamer',
        value: formatNumber(snapshot.gamerScore),
        meta: 'Força geral do Passaporte',
        icon: 'spark',
        accent: 'var(--color-primary)',
        tooltip: 'Um número único que combina nível, XP, raridade das conquistas, tamanho da biblioteca, horas jogadas, reputação e atividade de squad.',
        count: snapshot.gamerScore,
    }),
    statMarkup({
        label: 'Reputação',
        value: snapshot.reputation,
        meta: 'Ganha com atividade',
        icon: 'shield',
        accent: 'var(--color-accent)',
        tooltip: 'Começa em 50 e cresce com seu nível, conquistas, jogos zerados, tamanho do squad e o quanto o perfil está completo. Limite de 100.',
        count: snapshot.reputation,
    }),
    statMarkup({
        label: 'Jogos',
        value: snapshot.libraryCount,
        meta: `${formatHours(summary.hours)} registradas`,
        icon: 'controller',
        accent: 'var(--color-text-muted)',
        count: snapshot.libraryCount,
    }),
    statMarkup({
        label: 'Medalhas',
        value: `${snapshot.achievementsUnlocked}/${snapshot.achievementsTotal}`,
        meta: 'Conquistas desbloqueadas',
        icon: 'trophy',
        accent: 'var(--color-primary)',
    }),
].map((stat) => colWrap(stat)).join(''));

/* ============================================================
   CURRENTLY PLAYING
   ============================================================ */

const playing = listHydrated()
    .filter((entry) => entry.status === 'playing')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5);

render(document.getElementById('currentlyPlaying'), playing.length
    ? `<ul class="game-row-list card card--flat">${playing.map(gameRowMarkup).join('')}</ul>`
    : emptyStateMarkup({
        iconName: 'controller',
        title: 'Nenhum jogo em andamento.',
        text: 'Adicione um jogo e marque como Jogando — o Passaporte começa a descrever o que você joga de verdade.',
        action: '<a class="btn btn-primary btn-sm" href="library.html?action=add">Adicionar um jogo</a>',
    })
);

/* ============================================================
   SUGGESTED SQUAD
   The search is derived from the passport itself, so the block is
   personalised without asking the user anything.
   ============================================================ */

const squadHost = document.getElementById('suggestedSquad');
// A Biblioteca agora pode conter titulos do GameDB, mas o pool de jogadores
// demo so conhece o catalogo curado. Sugerir squad para um jogo que ninguem
// da base joga daria um resultado vazio de sentido, entao a sugestao fica
// ancorada no primeiro jogo curado que o usuario esta jogando.
const preferredGame = user.currentGames?.[0]
    ?? summary.playing.map((entry) => entry.gameId).find((id) => getGameById(id))
    ?? null;

if (!preferredGame) {
    render(squadHost, emptyStateMarkup({
        iconName: 'users',
        title: 'Nenhum squad ainda.',
        text: 'Adicione um jogo que você está jogando e o motor começa a buscar quem combina com você.',
        action: '<a class="btn btn-primary btn-sm" href="squads.html">Encontrar meu squad</a>',
    }));
} else {
    const criteria = {
        gameId: preferredGame,
        rank: user.rank ?? 'any',
        schedule: user.schedules?.[0] ?? 'any',
        playstyle: user.playstyle || 'any',
        role: 'any',
        voiceChat: user.voiceChat ?? 'any',
    };

    const matches = findMatches(criteria, user, { limit: 3 });
    const game = getGameById(preferredGame);

    render(squadHost, `
        <div class="card card--flat">
            <p class="suggested__intro">
                Com base no seu Passaporte · <strong>${escapeHtml(game.title)}</strong>
            </p>
            <ul class="squad-row-list">${matches.map(({ player, result }) => squadRowMarkup(player, result)).join('')}</ul>
            <a class="btn btn-outline-light btn-sm w-100" href="squads.html?game=${encodeURIComponent(preferredGame)}">
                Ver todos os compatíveis
            </a>
        </div>
    `);
}

/* ============================================================
   RECENT ACTIVITY
   ============================================================ */

const activity = getRecentActivity(7);

render(document.getElementById('recentActivity'), activity.length
    ? `<ul class="activity-list card card--flat">${activity.map(activityItemMarkup).join('')}</ul>`
    : emptyStateMarkup({
        iconName: 'clock',
        title: 'Nenhuma atividade ainda.',
        text: 'Tudo o que você faz na RIVALY aparece aqui e no Feed, salvo só neste navegador.',
        action: '<a class="btn btn-outline-light btn-sm" href="squads.html">Jogar uma sessão</a>',
    })
);

/* ============================================================
   GAMER DNA
   ============================================================ */

render(document.getElementById('dnaSummary'), user.dna
    ? `
        <div class="card card--accented dna-summary">
            <div class="dna-summary__head">
                <div>
                    <p class="dna-summary__archetype" style="color:${archetype.accent}">${escapeHtml(archetype.name)}</p>
                    <p class="dna-summary__tagline">${escapeHtml(archetype.tagline)}</p>
                </div>
                <span class="dna-summary__glyph" style="color:${archetype.accent}">${icon('dna', { size: 22 })}</span>
            </div>
            ${dnaListMarkup(user.dna.scores)}
            <a class="link dna-summary__link" href="passport.html">Ver a análise completa</a>
        </div>
    `
    : emptyStateMarkup({
        iconName: 'dna',
        title: 'Seu DNA ainda não foi mapeado.',
        text: 'Bastam dez perguntas. O resultado define seu arquétipo, as funções sugeridas e suas combinações.',
        action: '<a class="btn btn-primary btn-sm" href="onboarding.html?stage=dna">Descobrir meu arquétipo</a>',
    })
);

/* ============================================================
   LATEST ACHIEVEMENTS
   ============================================================ */

const unlockedBadges = getAchievementState()
    .filter((achievement) => achievement.unlocked)
    .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
    .slice(0, 4);

render(document.getElementById('latestBadges'), unlockedBadges.length
    ? `<div class="grid grid--badges">${unlockedBadges.map(badgeMarkup).join('')}</div>`
    : emptyStateMarkup({
        iconName: 'trophy',
        title: 'Sua primeira conquista está mais perto do que parece.',
        text: 'Adicione um jogo, complete seu DNA ou jogue uma sessão de squad. Qualquer uma dessas ações desbloqueia algo.',
        action: '<a class="btn btn-outline-light btn-sm" href="achievements.html">Ver todas as conquistas</a>',
    })
);

/* ============================================================
   POST-RENDER
   ============================================================ */

afterRender(document);

// Count the headline numbers up once they are on screen.
document.querySelectorAll('[data-count]').forEach((node) => {
    const target = Number(node.dataset.count);
    if (!Number.isFinite(target)) return;
    const suffix = node.textContent.trim().endsWith('%') ? '%' : '';
    countUp(node, target, { duration: 900, suffix });
});
