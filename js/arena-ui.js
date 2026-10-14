/**
 * arena-ui.js — confirmar e mostrar uma partida da Arena.
 *
 * Mesmo fluxo para os três modos (Duelo, Squad, Clã vs Clã) e para os
 * três lugares que começam uma partida (página da Arena, cartão do
 * jogador, desafio recebido):
 *
 *   1. prévia: chance de vitória (expectativa Elo) e quanto o rating
 *      sobe ou cai em cada cenário;
 *   2. partida: preenchimento reto curto (respeita movimento reduzido);
 *   3. resultado: placar, rating antes e depois e a conta completa.
 */

import { escapeHtml, icon, formatNumber } from './ui.js';
import { openModal } from './modal.js';
import {
    previewDuel, previewSquadMatch, previewClanMatch, playDuel, playSquadMatch, playClanMatch, tierFor, SEASON_POINTS,
} from './arena-store.js';
import { myClan } from './clans-store.js';
import { chanceMeterMarkup, reasonsListMarkup, tierBadgeMarkup } from './community-ui.js';
import { refreshNavigationProgress } from './navigation.js';
import { toast } from './notifications.js';
import { prefersReducedMotion, wait } from './animations.js';

const MODE_LABELS = { duel: 'Duelo', squad: 'Squad', clan: 'Clã vs Clã' };

function sidesMarkup(prev) {
    const opponentName = prev.opponent.type === 'clan'
        ? `[${prev.opponent.tag}] ${prev.opponent.name}`
        : prev.opponent.name;
    const mineLabel = prev.mode === 'duel' ? 'Você' : prev.mode === 'squad' ? 'Seu squad' : 'Seu clã';
    return `
        <div class="versus">
            <div class="versus__side">
                <p class="versus__label">${escapeHtml(mineLabel)}</p>
                <p class="versus__rating numeric">${formatNumber(prev.myRating)}</p>
                ${tierBadgeMarkup(prev.myRating)}
            </div>
            <span class="versus__mark" aria-hidden="true">${icon('rivaly', { size: 26 })}</span>
            <div class="versus__side versus__side--right">
                <p class="versus__label">${escapeHtml(opponentName)}</p>
                <p class="versus__rating numeric">${formatNumber(prev.opponentRating)}</p>
                ${tierBadgeMarkup(prev.opponentRating)}
            </div>
        </div>`;
}

function scenariosMarkup(prev) {
    const win = prev.userRating + prev.winDelta;
    const loss = prev.userRating + prev.lossDelta;
    return `
        <table class="table table-sm scenarios">
            <caption>Seu rating hoje: ${formatNumber(prev.userRating)} (${escapeHtml(tierFor(prev.userRating).label)})</caption>
            <thead><tr><th scope="col">Cenário</th><th scope="col">Rating</th><th scope="col">Fica em</th></tr></thead>
            <tbody>
                <tr class="scenarios__win"><th scope="row">Vitória</th><td class="numeric">+${prev.winDelta}</td><td class="numeric">${formatNumber(win)} · ${escapeHtml(tierFor(win).label)}</td></tr>
                <tr class="scenarios__loss"><th scope="row">Derrota</th><td class="numeric">${prev.lossDelta}</td><td class="numeric">${formatNumber(loss)} · ${escapeHtml(tierFor(loss).label)}</td></tr>
            </tbody>
        </table>`;
}

function mathCollapse(id, reasons, label = 'Ver a conta') {
    return `
        <button class="btn btn-link btn-sm px-0" type="button" data-bs-toggle="collapse" data-bs-target="#${id}" aria-expanded="false" aria-controls="${id}">
            ${icon('chevron-down', { size: 12 })} ${escapeHtml(label)}
        </button>
        <div class="collapse" id="${id}">${reasonsListMarkup(reasons)}</div>`;
}

/**
 * @param {object} prev     saída de previewDuel/previewSquadMatch/previewClanMatch
 * @param {() => object} play  executa a partida e devolve o registro
 * @param {{ onDone?: Function, confirmLabel?: string }} [options]
 */
export function openMatchConfirm(prev, play, { onDone, confirmLabel = 'Confirmar partida' } = {}) {
    if (!prev) return;
    const title = prev.mode === 'duel'
        ? `Duelo contra ${prev.opponent.name}`
        : prev.mode === 'clan' ? `Clã vs Clã: [${prev.opponent.tag}]` : 'Partida de squad na Arena';

    const { root } = openModal({
        title,
        subtitle: 'Confira a chance e o que está em jogo antes de confirmar.',
        body: `
            ${sidesMarkup(prev)}
            ${chanceMeterMarkup(prev.chance)}
            ${scenariosMarkup(prev)}
            ${mathCollapse('matchMath', prev.reasons)}
            <div class="match-loading" data-match-loading hidden>
                <p class="match-loading__label">Partida em andamento…</p>
                <div class="straight-fill" aria-hidden="true"><span></span></div>
            </div>
        `,
        footer: `
            <button type="button" class="btn btn-ghost" data-modal-close>Agora não</button>
            <button type="button" class="btn btn-primary" data-confirm-match data-autofocus>${escapeHtml(confirmLabel)}</button>
        `,
    });

    root.querySelector('[data-confirm-match]').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        button.classList.add('is-loading');
        root.querySelector('[data-match-loading]').hidden = false;
        await wait(prefersReducedMotion() ? 0 : 900);
        const match = play();
        refreshNavigationProgress();
        openMatchResult(match, { onDone });
        document.dispatchEvent(new CustomEvent('rivaly:community-changed'));
        document.dispatchEvent(new CustomEvent('rivaly:invites-changed'));
    });
}

export function openMatchResult(match, { onDone } = {}) {
    if (!match) return;
    const after = match.rating.after;
    const tierBefore = tierFor(match.rating.before);
    const tierAfter = tierFor(after);
    const opponent = match.opponent.type === 'clan' ? `[${match.opponent.tag}] ${match.opponent.name}` : match.opponent.name;

    openModal({
        title: match.won ? 'Vitória' : 'Derrota',
        subtitle: `${MODE_LABELS[match.mode]} contra ${opponent} · placar ${match.score}`,
        body: `
            <div class="match-result ${match.won ? 'is-win' : 'is-loss'}">
                <p class="match-result__delta numeric">${match.rating.delta >= 0 ? '+' : ''}${match.rating.delta}</p>
                <p class="match-result__line">Rating ${formatNumber(match.rating.before)} → <strong class="numeric">${formatNumber(after)}</strong></p>
                ${tierAfter.id !== tierBefore.id
                    ? `<p class="match-result__tier">${match.won ? 'Subiu' : 'Caiu'} para o tier ${tierBadgeMarkup(after)}</p>`
                    : `<p class="match-result__tier">Tier atual: ${tierBadgeMarkup(after)}</p>`}
                <p class="match-result__copy">${match.won
                    ? `Boa. A vitória vale XP e ${SEASON_POINTS.win} pontos de temporada${myClan() ? ', e soma para a meta do seu clã' : ''}.`
                    : `Faz parte. A partida ainda conta XP e ${SEASON_POINTS.loss} ponto de temporada.${match.mode === 'duel' ? ' Quer revanche? O adversário continua aqui.' : ''}`}</p>
            </div>
            ${mathCollapse('resultMath', match.reasons, 'Ver a conta do resultado')}
        `,
        footer: `
            <a class="btn btn-ghost" href="arena.html#historyTitle">Ver histórico</a>
            <button type="button" class="btn btn-primary" data-modal-close data-autofocus>Continuar</button>
        `,
        onClose: () => onDone?.(match),
    });
}

/* --- Atalhos usados pelo resto do site --- */

export function openDuelConfirm(playerId, { challengeId = null, onDone } = {}) {
    openMatchConfirm(previewDuel(playerId), () => playDuel(playerId, { challengeId }), {
        onDone,
        confirmLabel: challengeId ? 'Aceitar desafio' : 'Desafiar agora',
    });
}

export function openSquadMatchConfirm(sessionId, { onDone } = {}) {
    const prev = previewSquadMatch(sessionId);
    if (!prev) {
        toast({
            title: 'Este squad já jogou na Arena.',
            message: 'Cada sessão vai uma vez para a Arena. Jogue outra sessão em Squads para levar um time novo.',
            type: 'info',
        });
        return false;
    }
    openMatchConfirm(prev, () => playSquadMatch(sessionId), { onDone, confirmLabel: 'Levar squad para a Arena' });
    return true;
}

export function openClanMatchConfirm(clanId, { onDone } = {}) {
    openMatchConfirm(previewClanMatch(clanId), () => playClanMatch(clanId), { onDone, confirmLabel: 'Desafiar clã' });
}
