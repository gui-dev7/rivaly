/**
 * dashboard.js — the home screen of the application.
 *
 * Reads only; it never mutates progression. Everything shown here is
 * derived from the passport, the library, the activity ledger and the
 * Motor de Compatibilidade.
 */

import { bootApp, afterRender, haltModule } from './app.js';
import { render, escapeHtml, formatNumber, icon, emptyStateMarkup, formatHours } from './ui.js';
import { progressSnapshot, getAchievementState } from './gamification.js';
import { archetypeOf, profileCompletion, missingProfileFields } from './profile.js';
import { listHydrated, librarySummary } from './library-store.js';
import { getRecentActivity } from './activity.js';
import { findMatches } from './compatibility.js';
import { statMarkup, gameRowMarkup, squadRowMarkup, badgeMarkup, activityItemMarkup, dnaListMarkup } from './cards.js';
import { countUp } from './animations.js';
import { getGameById } from './data.js';

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
                    ? 'Dez perguntas definem seus seis atributos e seu arquétipo — o restante da plataforma usa esses dados.'
                    : 'Concluir o Passaporte melhora a qualidade das combinações e desbloqueia a medalha Cadastro Completo.'}</p>
                <div class="nudge__meter">
                    <span class="progress progress--thin">
                        <span class="progress__fill" data-progress="${completion}"></span>
                    </span>
                    <span class="numeric">${completion}%</span>
                </div>
            </div>
            <a class="btn btn--primary btn--sm" href="${needsDna ? 'onboarding.html?stage=dna' : 'passport.html?edit=1'}">
                ${needsDna ? 'Começar o DNA' : 'Completar'}
            </a>
        </aside>
    `);
}

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
].join(''));

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
        action: '<a class="btn btn--primary btn--sm" href="library.html?action=add">Adicionar um jogo</a>',
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
        text: "Vamos encontrar seu time. Adicione um jogo que você está jogando e o motor começa a buscar combinações.",
        action: '<a class="btn btn--primary btn--sm" href="squads.html">Abrir Buscar Squad</a>',
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
            <a class="btn btn--secondary btn--sm btn--block" href="squads.html?game=${encodeURIComponent(preferredGame)}">
                Fazer uma busca completa
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
        text: 'Tudo o que você faz na RIVALY é registrado aqui, localmente, neste navegador.',
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
        action: '<a class="btn btn--primary btn--sm" href="onboarding.html?stage=dna">Fazer a análise</a>',
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
        text: 'Adicione um jogo, complete seu DNA ou faça uma busca de squad — qualquer uma dessas ações desbloqueia algo.',
        action: '<a class="btn btn--secondary btn--sm" href="achievements.html">Ver o que existe</a>',
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
