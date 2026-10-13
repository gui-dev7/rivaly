/**
 * player-card.js — o cartão do jogador (modal), igual em todo o site.
 *
 * Qualquer elemento com data-player-card="pXX" abre este cartão (a
 * delegação está em navigation.js). Ele mostra quem é o jogador, quanto
 * combina com você (com a conta), clã, rating de Arena e as ações que
 * fazem sentido para a relação de vocês:
 *
 *   Salvar parceiro · Desafiar na Arena · Convidar para o meu clã ·
 *   Pedir para entrar no clã dele
 */

import { escapeHtml, icon, formatNumber } from './ui.js';
import { openModal } from './modal.js';
import { toast } from './notifications.js';
import {
    getPlayerById, getGameById, PLAYSTYLES, ROLES, LANGUAGES, rankLabel, regionLabel,
} from './data.js';
import { getUser } from './storage.js';
import { compatibilityWith, seededRating } from './community.js';
import { clanOfPlayer, myClan, canManage, inviteToClan } from './clans-store.js';
import { relationOf } from './sessions.js';
import { isSavedPartner, savePartner } from './partners.js';
import {
    playerAvatarMarkup, emblemMarkup, roleLabel, tierBadgeMarkup, relationBadgeMarkup,
    reasonsListMarkup, simulatedBadgeMarkup,
} from './community-ui.js';
import { refreshNavigationProgress } from './navigation.js';
import { initTooltips } from './app.js';

const labelOf = (collection, id) => collection.find((item) => item.id === id)?.label ?? id;

/** O jogo que serve de base para a compatibilidade: um que os dois jogam. */
function sharedGame(player, user) {
    const mine = new Set(user?.currentGames ?? []);
    return player.games.find((id) => mine.has(id)) ?? player.games[0];
}

function actionsMarkup(player, clan) {
    const actions = [];
    const mine = myClan();

    actions.push(isSavedPartner(player.id)
        ? `<button type="button" class="btn btn-secondary" disabled>${icon('check', { size: 14 })} Salvo no squad</button>`
        : `<button type="button" class="btn btn-outline-light" data-card-action="save">Salvar parceiro</button>`);

    actions.push(`<button type="button" class="btn btn-outline-light" data-card-action="duel">${icon('target', { size: 14 })} Desafiar na Arena</button>`);

    if (mine && canManage() && !clan) {
        actions.push(`<button type="button" class="btn btn-primary" data-card-action="invite">Convidar para o [${escapeHtml(mine.tag)}]</button>`);
    }
    if (clan && !mine && clan.policy !== 'invite') {
        actions.push(clan.policy === 'open'
            ? `<button type="button" class="btn btn-primary" data-card-action="join" data-clan="${escapeHtml(clan.id)}">Entrar no [${escapeHtml(clan.tag)}]</button>`
            : `<button type="button" class="btn btn-primary" data-card-action="apply" data-clan="${escapeHtml(clan.id)}">Pedir para entrar no [${escapeHtml(clan.tag)}]</button>`);
    }
    return actions.join('');
}

export function openPlayerCard(playerId) {
    const player = getPlayerById(playerId);
    if (!player) return;

    const user = getUser();
    const gameId = sharedGame(player, user);
    const compat = compatibilityWith(player, user, gameId);
    const rating = seededRating(player);
    const clan = clanOfPlayer(player.id);
    const clanRole = clan?.roster.find((entry) => entry.id === player.id)?.role;
    const relation = relationOf(player.id);

    const factorRows = compat.breakdown.map((part) => `
        <li class="mini-breakdown__row ${part.positive ? 'is-positive' : ''}">
            <span class="mini-breakdown__label">${escapeHtml(part.label)}</span>
            <span class="mini-breakdown__reason">${escapeHtml(part.reason)}</span>
            <span class="mini-breakdown__pts numeric">${part.earned}/${part.weight}</span>
        </li>`).join('');

    const { root, close } = openModal({
        title: player.nickname,
        subtitle: `${rankLabel(player.rank)} · ${labelOf(PLAYSTYLES, player.playstyle)} · ${regionLabel(player.region)}`,
        wide: true,
        body: `
            <div class="player-card">
                <div class="player-card__head">
                    ${playerAvatarMarkup(player, 'xl')}
                    <div class="player-card__identity">
                        <p class="player-card__bio">${escapeHtml(player.bio)}</p>
                        <div class="player-card__tags">
                            ${relationBadgeMarkup(relation)}
                            ${player.roles.map((role) => `<span class="tag tag--primary">${escapeHtml(labelOf(ROLES, role))}</span>`).join('')}
                            ${player.languages.map((id) => `<span class="tag">${escapeHtml(labelOf(LANGUAGES, id))}</span>`).join('')}
                            <span class="tag">${icon(player.voiceChat ? 'mic' : 'mic-off', { size: 11 })} ${player.voiceChat ? 'Usa voz' : 'Só texto'}</span>
                        </div>
                        <p class="player-card__games">${player.games.map((id) => escapeHtml(getGameById(id)?.title ?? id)).join(' · ')}</p>
                    </div>
                </div>

                <div class="row row-cols-1 row-cols-sm-3 g-2">
                    <div class="col">
                        <div class="mini-stat">
                            <span class="mini-stat__label">Compatibilidade</span>
                            <span class="mini-stat__value numeric">${compat.total}%</span>
                            <span class="mini-stat__meta">${escapeHtml(compat.tier.label)} · ${escapeHtml(getGameById(gameId)?.title ?? '')}</span>
                        </div>
                    </div>
                    <div class="col">
                        <div class="mini-stat">
                            <span class="mini-stat__label">Rating de Arena</span>
                            <span class="mini-stat__value numeric">${formatNumber(rating.rating)}</span>
                            <span class="mini-stat__meta">${tierBadgeMarkup(rating.rating)}</span>
                        </div>
                    </div>
                    <div class="col">
                        <div class="mini-stat mini-stat--clan">
                            <span class="mini-stat__label">Clã</span>
                            ${clan
                                ? `<span class="mini-stat__clan">${emblemMarkup(clan, 32)}<span><strong>[${escapeHtml(clan.tag)}]</strong> ${escapeHtml(clan.name)}<br><small>${escapeHtml(roleLabel(clanRole))}</small></span></span>`
                                : '<span class="mini-stat__value mini-stat__value--muted">Sem clã</span><span class="mini-stat__meta">Pode ser recrutado</span>'}
                        </div>
                    </div>
                </div>

                <div class="player-card__math">
                    <button class="btn btn-link btn-sm px-0" type="button" data-bs-toggle="collapse" data-bs-target="#cardCompat" aria-expanded="false" aria-controls="cardCompat">
                        ${icon('chevron-down', { size: 12 })} Ver a conta da compatibilidade
                    </button>
                    <div class="collapse" id="cardCompat">
                        <ul class="mini-breakdown">${factorRows}</ul>
                        <p class="mini-breakdown__total numeric">${compat.breakdown.map((part) => part.earned).join(' + ')} = ${compat.total}%</p>
                    </div>
                    <button class="btn btn-link btn-sm px-0" type="button" data-bs-toggle="collapse" data-bs-target="#cardRating" aria-expanded="false" aria-controls="cardRating">
                        ${icon('chevron-down', { size: 12 })} Ver a conta do rating
                    </button>
                    <div class="collapse" id="cardRating">
                        ${reasonsListMarkup(rating.breakdown.map((item) => ({ text: item.label, points: item.value })))}
                        <p class="mini-breakdown__total numeric">Total: ${formatNumber(rating.rating)}</p>
                    </div>
                </div>
                <p class="player-card__sim">${simulatedBadgeMarkup()}</p>
            </div>
        `,
        footer: actionsMarkup(player, clan),
    });

    initTooltips(root);

    root.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-card-action]');
        if (!button) return;
        const action = button.dataset.cardAction;

        if (action === 'save') {
            const result = savePartner(player.id, compat, gameId);
            if (result.ok) {
                toast({ title: `${player.nickname} salvo no seu squad.`, message: `${compat.total}% de compatibilidade`, type: 'success', xp: 60 });
                // Só este botão muda de estado; o resto do cartão fica como está.
                button.disabled = true;
                button.classList.replace('btn-outline-light', 'btn-secondary');
                button.textContent = 'Salvo no squad';
                refreshNavigationProgress();
                document.dispatchEvent(new CustomEvent('rivaly:community-changed'));
            } else {
                toast({ title: 'Nada mudou', message: result.reason, type: 'info' });
            }
        }

        if (action === 'duel') {
            const { openDuelConfirm } = await import('./arena-ui.js');
            openDuelConfirm(player.id, { onDone: () => document.dispatchEvent(new CustomEvent('rivaly:community-changed')) });
        }

        if (action === 'invite') {
            const result = inviteToClan(player.id);
            if (result.ok) {
                close();
                toast({ title: `Convite enviado para ${player.nickname}`, message: 'A resposta, com o motivo, chega no centro de convites.', type: 'success' });
                document.dispatchEvent(new CustomEvent('rivaly:invites-changed'));
            } else {
                toast({ title: 'Convite não enviado', message: result.reason, type: 'warning' });
            }
        }

        if (action === 'join' || action === 'apply') {
            const { runClanAction } = await import('./clan-ui.js');
            runClanAction(action, button.dataset.clan);
        }
    });
}
