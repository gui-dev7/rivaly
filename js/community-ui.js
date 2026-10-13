/**
 * community-ui.js — blocos visuais da comunidade, iguais em todo o site.
 *
 * Funções puras que devolvem HTML (sempre com escapeHtml) e um diálogo
 * para explicar uma decisão da comunidade simulada. Nenhuma regra de
 * negócio aqui: elas vivem nos *-store.js e em community.js.
 */

import { icon, escapeHtml, avatarMarkup, formatNumber } from './ui.js';
import { getPlayerById, RELATION_TYPES, getGameById } from './data.js';
import { emblemSvg, ROLE_LABELS, getClan } from './clans-store.js';
import { tierFor } from './arena-store.js';
import { openModal } from './modal.js';

/* ============================================================
   SELO "COMUNIDADE SIMULADA"
   Honestidade de produto: está em toda tela da comunidade.
   ============================================================ */

export const SIMULATED_EXPLANATION = 'Os outros jogadores são perfis semeados, não pessoas reais. Aceites, recusas, posts e partidas saem de um motor determinístico que sempre mostra o motivo de cada decisão. Nada sai deste navegador.';

export function simulatedBadgeMarkup() {
    return `<button type="button" class="sim-badge" data-bs-toggle="tooltip" data-bs-placement="bottom"
        data-bs-title="${escapeHtml(SIMULATED_EXPLANATION)}" aria-label="Comunidade simulada. ${escapeHtml(SIMULATED_EXPLANATION)}">
        ${icon('info', { size: 13 })}<span>Comunidade simulada</span>
    </button>`;
}

/* ============================================================
   JOGADOR
   ============================================================ */

export const playerAvatarMarkup = (player, size = 'md') =>
    avatarMarkup(`${player.nickname}${player.id}`, { size });

/** Nome clicável que abre o cartão do jogador. */
export function playerChipMarkup(playerId, { avatar = true, size = 'sm', label = null } = {}) {
    const player = getPlayerById(playerId);
    if (!player) return '';
    return `<button type="button" class="player-chip" data-player-card="${escapeHtml(player.id)}"
        aria-label="Abrir o cartão de ${escapeHtml(player.nickname)}">
        ${avatar ? playerAvatarMarkup(player, size) : ''}
        <span class="player-chip__name">${escapeHtml(label ?? player.nickname)}</span>
    </button>`;
}

export function relationBadgeMarkup(type) {
    if (!type || type === 'neutral') return '';
    return `<span class="badge relation-badge relation-badge--${escapeHtml(type)}">${escapeHtml(RELATION_TYPES[type]?.label ?? type)}</span>`;
}

/* ============================================================
   CLÃ
   ============================================================ */

export function emblemMarkup(clan, size = 48) {
    if (!clan) return '';
    return `<span class="emblem-wrap" style="--emblem-size:${size}px">${emblemSvg(clan.tag, { size, title: `Emblema do clã ${clan.name}` })}</span>`;
}

export const clanTagMarkup = (clan) => (clan ? `<span class="clan-tag">[${escapeHtml(clan.tag)}]</span>` : '');

export const roleLabel = (role) => ROLE_LABELS[role] ?? role;

export function focusGamesText(clan) {
    return clan.focusGames.map((id) => getGameById(id)?.title ?? id).join(', ');
}

/* ============================================================
   ARENA
   ============================================================ */

export function tierBadgeMarkup(rating) {
    const tier = tierFor(rating);
    return `<span class="badge tier-badge tier-badge--${escapeHtml(tier.id)}">${escapeHtml(tier.label)}</span>`;
}

/** Medidor de chance de vitória (componente progress do Bootstrap). */
export function chanceMeterMarkup(chance, { label = 'Chance de vitória' } = {}) {
    const pct = Math.round(chance * 1000) / 10;
    return `<div class="chance">
        <div class="chance__head"><span>${escapeHtml(label)}</span><strong class="numeric">${pct.toLocaleString('pt-BR')}%</strong></div>
        <div class="progress" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar" style="width:${pct}%"></div>
        </div>
    </div>`;
}

export const ratingMarkup = (rating) => `<span class="numeric">${formatNumber(rating)}</span>`;

/* ============================================================
   MOTIVOS DE UMA DECISÃO
   Aceita strings ou { ok, text, points }.
   ============================================================ */

export function reasonsListMarkup(reasons = []) {
    if (!reasons.length) return '';
    return `<ul class="reasons">${reasons.map((reason) => {
        const item = typeof reason === 'string' ? { text: reason } : reason;
        const state = item.ok === true ? 'is-ok' : item.ok === false ? 'is-no' : '';
        const glyph = item.ok === true ? 'check' : item.ok === false ? 'minus' : 'info';
        return `<li class="reasons__item ${state}">
            ${icon(glyph, { size: 12 })}
            <span>${escapeHtml(item.text)}</span>
            ${typeof item.points === 'number' ? `<span class="reasons__points numeric">${item.points >= 0 ? '+' : ''}${item.points}</span>` : ''}
        </li>`;
    }).join('')}</ul>`;
}

/** Diálogo "Por quê?": a conta completa de uma decisão da comunidade. */
export function openDecisionDialog(invite) {
    const decision = invite.decision ?? {};
    const clan = invite.clanId ? getClan(invite.clanId) : null;
    const player = invite.playerId ? getPlayerById(invite.playerId) : null;

    const title = {
        application: clan ? `Resposta do [${clan.tag}]` : 'Resposta da candidatura',
        'outgoing-invite': player ? `Resposta de ${player.nickname}` : 'Resposta do convite',
        'clan-invite': player ? `Por que ${player.nickname} convidou você` : 'Por que você foi convidado',
    }[invite.kind] ?? 'Como a comunidade decidiu';

    openModal({
        title,
        subtitle: 'Decisão da comunidade simulada, com a conta inteira.',
        body: `
            ${decision.summary ? `<p class="decision__summary">${escapeHtml(decision.summary)}</p>` : ''}
            ${reasonsListMarkup(decision.reasons ?? [])}
            <p class="decision__note">${icon('info', { size: 12 })} ${escapeHtml(SIMULATED_EXPLANATION)}</p>
        `,
        footer: '<button type="button" class="btn btn-primary" data-modal-close data-autofocus>Entendi</button>',
    });
}
