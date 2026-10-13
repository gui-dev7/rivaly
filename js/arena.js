/**
 * arena.js — controller da página Arena (DOM + eventos).
 *
 * As regras (Elo, tiers, temporada, ranking) vivem em arena-store.js;
 * os diálogos de confirmação e resultado, em arena-ui.js. Aqui ficam
 * só a renderização e a ligação dos eventos.
 */

import { bootApp, afterRender, haltModule } from './app.js';
import { ARENA_TIERS, SQUAD_GAMES, getPlayerById, getGameById } from './data.js';
import {
    arenaState, tierProgress, duelOpponents, arenaReadySessions, renderRankingData,
    matchHistory, pendingChallenges, previewClanMatch,
} from './arena-store.js';
import { allClans, myClan } from './clans-store.js';
import { declineInvite } from './invites.js';
import {
    openDuelConfirm, openSquadMatchConfirm, openClanMatchConfirm, openMatchResult,
} from './arena-ui.js';
import {
    simulatedBadgeMarkup, playerChipMarkup, playerAvatarMarkup, tierBadgeMarkup, emblemMarkup,
    relationBadgeMarkup, chanceMeterMarkup,
} from './community-ui.js';
import { scoreLabel } from './sessions.js';
import { toast } from './notifications.js';
import {
    $, render, escapeHtml, icon, formatNumber, formatRelativeTime, emptyStateMarkup, plural, weekLabel,
} from './ui.js';

const user = bootApp({
    page: 'arena',
    title: 'Arena',
    subtitle: 'Rating no estilo Elo · temporada semanal',
});
if (!user) await haltModule();

render($('[data-sim-badge]'), simulatedBadgeMarkup());

const state = {
    duelQuery: '',
    rankingTab: 'players',
    rankingGame: '',
    historyPage: 1,
};

const HISTORY_PAGE_SIZE = 6;
const MODE_LABELS = { duel: 'Duelo', squad: 'Squad', clan: 'Clã vs Clã' };

/* ============================================================
   RESUMO
   ============================================================ */

function renderSummary() {
    const arena = arenaState();
    const progress = tierProgress(arena.rating);
    const winRate = arena.matches ? Math.round((arena.wins / arena.matches) * 100) : 0;

    render($('#arenaSummary'), `
        <div class="col">
            <article class="card h-100 arena-rating">
                <div class="card-body">
                    <p class="card-subtitle eyebrow">Seu rating</p>
                    <p class="arena-rating__value numeric" data-rating-value>${formatNumber(arena.rating)}</p>
                    <p class="arena-rating__tier">${tierBadgeMarkup(arena.rating)}</p>
                    <div class="progress mt-2" role="progressbar" aria-label="Progresso até o próximo tier" aria-valuenow="${Math.round(progress.percent)}" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-bar" style="width:${progress.percent}%"></div>
                    </div>
                    <p class="card-text mt-2">${progress.next
                        ? `Faltam <strong class="numeric">${progress.remaining}</strong> para ${escapeHtml(progress.next.label)}.`
                        : 'Tier máximo. Agora é segurar a Lenda.'}</p>
                </div>
            </article>
        </div>
        <div class="col">
            <article class="card h-100">
                <div class="card-body">
                    <p class="card-subtitle eyebrow">Temporada · ${escapeHtml(weekLabel(arena.season.week))}</p>
                    <p class="arena-rating__value numeric">${arena.season.points} <small>pts</small></p>
                    <p class="card-text">${plural(arena.season.wins, 'vitória')} · ${plural(arena.season.losses, 'derrota')} nesta semana.</p>
                    <p class="card-text form-text">Reinicia na segunda-feira. O rating geral fica.</p>
                </div>
            </article>
        </div>
        <div class="col">
            <article class="card h-100">
                <div class="card-body">
                    <p class="card-subtitle eyebrow">Carreira</p>
                    <p class="arena-rating__value numeric">${arena.wins}<small>V</small> ${arena.losses}<small>D</small></p>
                    <p class="card-text">${plural(arena.matches, 'partida')} · ${winRate}% de vitórias · pico ${formatNumber(arena.peak ?? arena.rating)}.</p>
                    <p class="card-text form-text">${arena.matches < 10 ? `K = 40 até a 10ª partida (faltam ${10 - arena.matches}).` : 'K = 32: o rating já achou o seu nível.'}</p>
                </div>
            </article>
        </div>
    `);
    const label = weekLabel(arena.season.week);
    $('#seasonLabel').textContent = label.charAt(0).toUpperCase() + label.slice(1);
}

/* ============================================================
   DESAFIOS RECEBIDOS
   ============================================================ */

function renderChallenges() {
    const challenges = pendingChallenges();
    if (challenges.length === 0) {
        render($('#challengesHost'), emptyStateMarkup({
            iconName: 'target',
            title: 'Nenhum desafio nesta semana.',
            text: 'Rivais podem desafiar você uma vez por semana. Marque alguém como Rival depois de uma sessão de squad.',
            action: '<a class="btn btn-outline-light btn-sm" href="squads.html">Jogar uma sessão</a>',
        }));
        return;
    }

    render($('#challengesHost'), `<div class="row row-cols-1 row-cols-md-2 g-3">${challenges.map((invite) => {
        const player = getPlayerById(invite.playerId);
        if (!player) return '';
        return `
            <div class="col">
                <article class="card h-100 challenge-card" data-challenge="${escapeHtml(invite.id)}">
                    <div class="card-body">
                        <h3 class="card-title">${playerChipMarkup(player.id, { size: 'md' })}</h3>
                        <p class="card-text">Desafiou você para um duelo. Rating ${formatNumber(invite.rating)} ${tierBadgeMarkup(invite.rating)}</p>
                        <details class="challenge-card__why">
                            <summary>Por que este desafio?</summary>
                            <ul>${(invite.reasons ?? []).map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>
                        </details>
                    </div>
                    <div class="card-footer d-flex gap-2">
                        <button type="button" class="btn btn-primary btn-sm" data-action="accept-challenge" data-player="${escapeHtml(player.id)}" data-invite="${escapeHtml(invite.id)}">Aceitar desafio</button>
                        <button type="button" class="btn btn-ghost btn-sm" data-action="decline-challenge" data-invite="${escapeHtml(invite.id)}">Recusar</button>
                    </div>
                </article>
            </div>`;
    }).join('')}</div>`);
}

/* ============================================================
   DUELO
   ============================================================ */

function renderDuels() {
    const query = state.duelQuery.trim().toLowerCase();
    const opponents = duelOpponents().filter(({ player }) => !query || player.nickname.toLowerCase().includes(query));

    $('#duelCount').textContent = plural(opponents.length, 'adversário');

    if (opponents.length === 0) {
        render($('#duelList'), `<div class="col-12">${emptyStateMarkup({
            iconName: 'search',
            title: `Ninguém chamado “${state.duelQuery}”.`,
            text: 'Confira a grafia ou limpe a busca para ver todos os adversários.',
        })}</div>`);
        return;
    }

    render($('#duelList'), opponents.map(({ player, rating, isRival, isAlly, chance, clan }) => `
        <div class="col">
            <article class="card h-100 duel-card ${isRival ? 'is-rival' : ''}">
                <div class="card-body">
                    <div class="duel-card__head">
                        ${playerAvatarMarkup(player, 'md')}
                        <div class="duel-card__id">
                            <h3 class="card-title">
                                <button type="button" class="link-reset" data-player-card="${escapeHtml(player.id)}">${escapeHtml(player.nickname)}</button>
                                ${clan ? `<span class="clan-tag">[${escapeHtml(clan.tag)}]</span>` : ''}
                            </h3>
                            <p class="card-text">${formatNumber(rating)} ${tierBadgeMarkup(rating)} ${relationBadgeMarkup(isRival ? 'rival' : isAlly ? 'ally' : null)}</p>
                        </div>
                    </div>
                    ${chanceMeterMarkup(chance)}
                </div>
                <div class="card-footer">
                    <button type="button" class="btn ${isRival ? 'btn-primary' : 'btn-outline-light'} btn-sm w-100" data-action="duel" data-player="${escapeHtml(player.id)}">Desafiar ${escapeHtml(player.nickname)}</button>
                </div>
            </article>
        </div>`).join(''));
}

/* ============================================================
   SQUAD
   ============================================================ */

function renderSquadMatches() {
    const sessions = arenaReadySessions();
    if (sessions.length === 0) {
        render($('#squadMatchHost'), emptyStateMarkup({
            iconName: 'users',
            title: 'Nenhum squad pronto para a Arena.',
            text: 'Jogue uma sessão em Squads. Cada sessão pode ir uma vez para a Arena, com o mesmo time.',
            action: '<a class="btn btn-primary btn-sm" href="squads.html">Jogar uma sessão</a>',
        }));
        return;
    }

    render($('#squadMatchHost'), `<div class="row row-cols-1 row-cols-md-2 g-3">${sessions.map((session) => {
        const game = getGameById(session.gameId);
        return `
            <div class="col">
                <article class="card h-100">
                    <div class="card-body">
                        <h3 class="card-title">${escapeHtml(game?.title ?? 'Sessão')} · ${session.won ? 'vitória' : 'derrota'} na sessão</h3>
                        <p class="card-text">${escapeHtml(scoreLabel(session.score))} · ${escapeHtml(formatRelativeTime(session.at))}</p>
                        <div class="squad-chips">${session.teammates.map((id) => playerChipMarkup(id)).join('')}</div>
                    </div>
                    <div class="card-footer">
                        <button type="button" class="btn btn-primary btn-sm w-100" data-action="squad-match" data-session="${escapeHtml(session.id)}">Levar este squad para a Arena</button>
                    </div>
                </article>
            </div>`;
    }).join('')}</div>`);
}

/* ============================================================
   CLÃ VS CLÃ
   ============================================================ */

function renderClanMatches() {
    const mine = myClan();
    if (!mine) {
        render($('#clanMatchHost'), emptyStateMarkup({
            iconName: 'shield',
            title: 'Clã vs Clã precisa de um clã.',
            text: 'Entre em um clã compatível com o seu DNA ou crie o seu. Depois volte aqui para desafiar outro clã.',
            action: '<a class="btn btn-primary btn-sm" href="clans.html#exploreTitle">Ver clãs compatíveis</a>',
        }));
        return;
    }

    const others = allClans().filter((clan) => clan.id !== mine.id);
    render($('#clanMatchHost'), `<div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">${others.map((clan) => {
        const prev = previewClanMatch(clan.id);
        return `
            <div class="col">
                <article class="card h-100 clan-match-card">
                    <div class="card-body">
                        <div class="duel-card__head">
                            ${emblemMarkup(clan, 44)}
                            <div class="duel-card__id">
                                <h3 class="card-title">[${escapeHtml(clan.tag)}] ${escapeHtml(clan.name)}</h3>
                                <p class="card-text">Top 3: ${formatNumber(prev.opponentRating)} · seu clã: ${formatNumber(prev.myRating)}</p>
                            </div>
                        </div>
                        ${chanceMeterMarkup(prev.chance)}
                    </div>
                    <div class="card-footer">
                        <button type="button" class="btn btn-outline-light btn-sm w-100" data-action="clan-match" data-clan="${escapeHtml(clan.id)}">Desafiar [${escapeHtml(clan.tag)}]</button>
                    </div>
                </article>
            </div>`;
    }).join('')}</div>`);
}

/* ============================================================
   RANKING
   ============================================================ */

function renderRanking() {
    const rows = renderRankingData({ tab: state.rankingTab, gameId: state.rankingGame });
    const table = $('#rankingTable');

    if (rows.length === 0) {
        render(table, `<tbody><tr><td>${emptyStateMarkup({
            iconName: 'filter',
            title: 'Ninguém neste filtro.',
            text: 'Nenhum jogador ou clã joga esse título ainda. Escolha outro jogo ou "Todos os jogos".',
        })}</td></tr></tbody>`);
        return;
    }

    if (state.rankingTab === 'clans') {
        render(table, `
            <caption>Clãs ordenados pelos pontos da semana; o rating é a média dos três melhores.</caption>
            <thead><tr>
                <th scope="col">#</th><th scope="col">Clã</th><th scope="col">Membros</th>
                <th scope="col">Rating (top 3)</th><th scope="col">Vitórias</th><th scope="col">Pontos</th>
            </tr></thead>
            <tbody>${rows.map((row) => `
                <tr class="${row.isMine ? 'table-active is-me' : ''}"${row.isMine ? ' aria-current="true"' : ''}>
                    <td class="numeric">${row.position}</td>
                    <td><span class="ranking-clan">${emblemMarkup(row.clan, 28)}<span><strong>[${escapeHtml(row.clan.tag)}]</strong> ${escapeHtml(row.clan.name)}${row.isMine ? ' <span class="badge text-bg-primary">Seu clã</span>' : ''}</span></span></td>
                    <td class="numeric">${row.members}</td>
                    <td class="numeric">${formatNumber(row.rating)}</td>
                    <td class="numeric">${row.wins}</td>
                    <td class="numeric"><strong>${row.points}</strong></td>
                </tr>`).join('')}</tbody>
        `);
        return;
    }

    render(table, `
        <caption>Jogadores ordenados pelos pontos da temporada. Sua linha aparece destacada.</caption>
        <thead><tr>
            <th scope="col">#</th><th scope="col">Jogador</th><th scope="col">Tier</th>
            <th scope="col">Rating</th><th scope="col">V–D</th><th scope="col">Pontos</th>
        </tr></thead>
        <tbody>${rows.map((row) => `
            <tr class="${row.isMe ? 'table-active is-me' : ''}"${row.isMe ? ' aria-current="true"' : ''}>
                <td class="numeric">${row.position}</td>
                <td>${row.isMe
                    ? `<strong>${escapeHtml(row.nickname)}</strong> <span class="badge text-bg-primary">Você</span>`
                    : playerChipMarkup(row.player.id)}
                    ${row.clan ? `<span class="clan-tag">[${escapeHtml(row.clan.tag)}]</span>` : ''}</td>
                <td>${tierBadgeMarkup(row.rating)}</td>
                <td class="numeric">${formatNumber(row.rating)}</td>
                <td class="numeric">${row.wins}–${row.losses}</td>
                <td class="numeric"><strong>${row.points}</strong></td>
            </tr>`).join('')}</tbody>
    `);
}

function setRankingTab(tab) {
    state.rankingTab = tab;
    document.querySelectorAll('[data-ranking-tab]').forEach((button) => {
        const active = button.dataset.rankingTab === tab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
        if (active) $('#rankingPanel').setAttribute('aria-labelledby', button.id);
    });
    renderRanking();
}

/* ============================================================
   HISTÓRICO (paginado)
   ============================================================ */

function renderHistory() {
    const history = matchHistory();
    const pages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
    state.historyPage = Math.min(state.historyPage, pages);
    $('#historyMeta').textContent = history.length ? plural(history.length, 'partida') : '';

    if (history.length === 0) {
        render($('#historyHost'), emptyStateMarkup({
            iconName: 'clock',
            title: 'Nenhuma partida ainda.',
            text: 'Sua primeira partida aparece aqui com a conta completa: chance, sorteio e rating antes e depois.',
            action: '<a class="btn btn-primary btn-sm" href="#playTitle">Escolher um adversário</a>',
        }));
        render($('#historyPages'), '');
        return;
    }

    const start = (state.historyPage - 1) * HISTORY_PAGE_SIZE;
    const slice = history.slice(start, start + HISTORY_PAGE_SIZE);

    render($('#historyHost'), `
        <div class="table-responsive">
            <table class="table align-middle history-table">
                <caption>Página ${state.historyPage} de ${pages}.</caption>
                <thead><tr>
                    <th scope="col">Resultado</th><th scope="col">Modo</th><th scope="col">Adversário</th>
                    <th scope="col">Placar</th><th scope="col">Rating</th><th scope="col">Quando</th><th scope="col"><span class="visually-hidden">Ações</span></th>
                </tr></thead>
                <tbody>${slice.map((match) => `
                    <tr>
                        <td><span class="badge ${match.won ? 'text-bg-primary' : 'result-loss'}">${match.won ? 'Vitória' : 'Derrota'}</span></td>
                        <td>${escapeHtml(MODE_LABELS[match.mode])}</td>
                        <td>${match.opponent.type === 'player'
                            ? playerChipMarkup(match.opponent.id, { avatar: false })
                            : escapeHtml(match.opponent.type === 'clan' ? `[${match.opponent.tag}] ${match.opponent.name}` : match.opponent.name)}</td>
                        <td class="numeric">${escapeHtml(match.score)}</td>
                        <td class="numeric">${match.rating.delta >= 0 ? '+' : ''}${match.rating.delta} → ${formatNumber(match.rating.after)}</td>
                        <td>${escapeHtml(formatRelativeTime(match.at))}</td>
                        <td><button type="button" class="btn btn-link btn-sm" data-action="match-detail" data-match="${escapeHtml(match.id)}">Ver a conta</button></td>
                    </tr>`).join('')}</tbody>
            </table>
        </div>
    `);

    const pageItems = Array.from({ length: pages }, (_, index) => index + 1);
    render($('#historyPages'), pages > 1 ? `
        <li class="page-item ${state.historyPage === 1 ? 'disabled' : ''}">
            <button type="button" class="page-link" data-page="${state.historyPage - 1}" aria-label="Página anterior"${state.historyPage === 1 ? ' disabled' : ''}>${icon('chevron-left', { size: 14 })}</button>
        </li>
        ${pageItems.map((page) => `
            <li class="page-item ${page === state.historyPage ? 'active' : ''}">
                <button type="button" class="page-link" data-page="${page}"${page === state.historyPage ? ' aria-current="page"' : ''}>${page}</button>
            </li>`).join('')}
        <li class="page-item ${state.historyPage === pages ? 'disabled' : ''}">
            <button type="button" class="page-link" data-page="${state.historyPage + 1}" aria-label="Próxima página"${state.historyPage === pages ? ' disabled' : ''}>${icon('chevron-right', { size: 14 })}</button>
        </li>` : '');
}

/* ============================================================
   TIERS (accordion)
   ============================================================ */

function renderTiers() {
    render($('#tiersTable'), `
        <table class="table table-sm">
            <caption>Todo mundo começa em 1.000 (Prata).</caption>
            <thead><tr><th scope="col">Tier</th><th scope="col">A partir de</th></tr></thead>
            <tbody>${ARENA_TIERS.map((tier) => `<tr><td>${tierBadgeMarkup(tier.min)}</td><td class="numeric">${formatNumber(tier.min)}</td></tr>`).join('')}</tbody>
        </table>
    `);
}

/* ============================================================
   FILTRO DE JOGO
   ============================================================ */

render($('#rankingGame'), [
    '<option value="">Todos os jogos</option>',
    ...SQUAD_GAMES.map((game) => `<option value="${escapeHtml(game.id)}">${escapeHtml(game.title)}</option>`),
].join(''));

/* ============================================================
   EVENTOS
   ============================================================ */

function renderAll() {
    renderSummary();
    renderChallenges();
    renderDuels();
    renderSquadMatches();
    renderClanMatches();
    renderRanking();
    renderHistory();
    afterRender(document.getElementById('main-content'));
}

const refresh = () => renderAll();

// Busca em tempo real: cada tecla filtra a lista sem recarregar.
$('#duelSearch').addEventListener('input', (event) => {
    state.duelQuery = event.target.value;
    renderDuels();
});
$('#duelSearchForm').addEventListener('submit', (event) => event.preventDefault());

$('#rankingGame').addEventListener('change', (event) => {
    state.rankingGame = event.target.value;
    renderRanking();
});

$('#rankingTabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-ranking-tab]');
    if (button) setRankingTab(button.dataset.rankingTab);
});

// Setas trocam de aba, como o padrão de tabs do WAI-ARIA.
$('#rankingTabs').addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = state.rankingTab === 'players' ? 'clans' : 'players';
    setRankingTab(next);
    document.querySelector(`[data-ranking-tab="${next}"]`).focus();
});

$('#historyPages').addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    state.historyPage = Number(button.dataset.page);
    renderHistory();
    $('#historyTitle').scrollIntoView({ block: 'start' });
});

// Uma escuta só para todos os botões da página (delegação).
document.getElementById('main-content').addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const { action } = trigger.dataset;

    if (action === 'duel') openDuelConfirm(trigger.dataset.player, { onDone: refresh });
    if (action === 'accept-challenge') openDuelConfirm(trigger.dataset.player, { challengeId: trigger.dataset.invite, onDone: refresh });
    if (action === 'decline-challenge') {
        const result = declineInvite(trigger.dataset.invite);
        if (result.ok) toast({ title: 'Desafio recusado.', message: 'O rival pode tentar de novo na próxima semana.', type: 'info' });
        refresh();
        document.dispatchEvent(new CustomEvent('rivaly:invites-changed'));
    }
    if (action === 'squad-match') openSquadMatchConfirm(trigger.dataset.session, { onDone: refresh });
    if (action === 'clan-match') openClanMatchConfirm(trigger.dataset.clan, { onDone: refresh });
    if (action === 'match-detail') {
        const match = matchHistory().find((item) => item.id === trigger.dataset.match);
        if (match) openMatchResult(match);
    }
});

document.addEventListener('rivaly:community-changed', refresh);

/* ============================================================
   BOOT
   ============================================================ */

renderTiers();
renderAll();

// Atalhos vindos de outras telas: ?duel=p13 ou ?challenge=ch-...
const params = new URLSearchParams(window.location.search);
if (params.get('duel')) openDuelConfirm(params.get('duel'), { onDone: refresh });
if (params.get('challenge')) {
    const invite = pendingChallenges().find((item) => item.id === params.get('challenge'));
    if (invite) openDuelConfirm(invite.playerId, { challengeId: invite.id, onDone: refresh });
}
