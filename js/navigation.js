/**
 * navigation.js — a moldura do app em tempo de execução.
 *
 * Na V2 a navegação é markup Bootstrap dentro de cada página (navbar,
 * offcanvas, barra inferior e rodapé), gravado a partir do SITE_MAP por
 * tools/sync-chrome.mjs. Este módulo não desenha menu nenhum. Ele:
 *
 *   - marca a página atual com aria-current="page";
 *   - escreve o título da página no topo;
 *   - preenche o que depende do usuário: mini passaporte, nível e XP;
 *   - mantém o centro de convites (dropdown com badge numérico);
 *   - liga o botão de sair e a abertura do cartão do jogador.
 *
 * O offcanvas, o dropdown e o modal são do Bootstrap: foco, Esc e clique
 * fora já vêm prontos.
 */

import { icon, escapeHtml, formatNumber, formatRelativeTime } from './ui.js';
import { userAvatarMarkup } from './avatar-service.js';
import { getUser } from './storage.js';
import { levelProgress } from './gamification.js';
import { archetypeName } from './profile.js';
import { logout } from './auth.js';
import { confirmDialog } from './modal.js';
import { toast } from './notifications.js';
import { getPlayerById, CLANS } from './data.js';
import {
    actionableInvites, unseenResponses, awaitingResponse, inboxCount, resolveDueInvites,
    acceptInvite, declineInvite, markSeen, expireOldInvites, INVITE_LABELS,
} from './invites.js';
import { getClan } from './clans-store.js';
import { ensureWeeklyChallenges } from './arena-store.js';

/* ============================================================
   PÁGINA ATUAL
   ============================================================ */

function markCurrent(page) {
    document.querySelectorAll('[data-nav-id]').forEach((link) => {
        if (link.dataset.navId === page) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
        link.classList.toggle('active', link.dataset.navId === page);
    });
}

function fillHeading({ title, subtitle }) {
    const titleNode = document.querySelector('[data-topbar-title]');
    const subtitleNode = document.querySelector('[data-topbar-subtitle]');
    if (titleNode) titleNode.textContent = title;
    if (subtitleNode) {
        subtitleNode.textContent = subtitle;
        subtitleNode.hidden = !subtitle;
    }
}

/* ============================================================
   MINI PASSAPORTE E XP
   ============================================================ */

function miniPassportMarkup(user, progress) {
    return `
        <a class="mini-passport" href="passport.html">
            <span class="mini-passport__top">
                ${userAvatarMarkup(user, { size: 'sm' })}
                <span class="mini-passport__name">
                    <span class="mini-passport__nick">${escapeHtml(user.nickname)}</span>
                    <span class="mini-passport__archetype">${escapeHtml(archetypeName(user))}</span>
                </span>
            </span>
            <span class="mini-passport__xp" data-mini-xp>
                <span>NV ${progress.level}</span>
                <span>${formatNumber(progress.currentLevelXp)} / ${formatNumber(progress.nextLevelXp)}</span>
            </span>
            <span class="progress progress--thin progress--xp">
                <span class="progress__fill" data-progress="${progress.percent}"></span>
            </span>
        </a>
    `;
}

/** Reescreve só os indicadores de XP (sem recarregar a página). */
export function refreshNavigationProgress() {
    const user = getUser();
    if (!user) return;
    const progress = levelProgress(user.xp);

    document.querySelectorAll('[data-xp-level]').forEach((node) => {
        node.textContent = String(progress.level);
    });
    document.querySelectorAll('[data-xp-text]').forEach((node) => {
        node.textContent = `${formatNumber(progress.currentLevelXp)}/${formatNumber(progress.nextLevelXp)}`;
    });
    document.querySelectorAll('[data-xp-bar]').forEach((bar) => {
        bar.setAttribute('aria-valuenow', String(Math.round(progress.percent)));
    });
    document.querySelectorAll('[data-mini-xp]').forEach((node) => {
        node.innerHTML = `<span>NV ${progress.level}</span><span>${formatNumber(progress.currentLevelXp)} / ${formatNumber(progress.nextLevelXp)}</span>`;
    });
    document.querySelectorAll('.progress--xp .progress__fill').forEach((fill) => {
        fill.dataset.progress = String(progress.percent);
        fill.style.transform = `scaleX(${progress.percent / 100})`;
    });
}

/* ============================================================
   CENTRO DE CONVITES
   ============================================================ */

const clanLabel = (clanId) => {
    const clan = getClan(clanId) ?? CLANS.find((item) => item.id === clanId);
    return clan ? `[${clan.tag}] ${clan.name}` : 'um clã';
};

function inviteItemMarkup(invite) {
    const player = invite.playerId ? getPlayerById(invite.playerId) : null;
    const when = formatRelativeTime(invite.resolvedAt ?? invite.createdAt);

    if (invite.kind === 'clan-invite') {
        return `
            <li class="invite" data-invite="${escapeHtml(invite.id)}">
                <p class="invite__kind">${icon('shield', { size: 12 })} ${INVITE_LABELS['clan-invite']}</p>
                <p class="invite__text"><strong>${escapeHtml(player?.nickname ?? 'Um jogador')}</strong> chamou você para o ${escapeHtml(clanLabel(invite.clanId))}.</p>
                <p class="invite__time">${escapeHtml(when)}</p>
                <div class="invite__actions">
                    <button type="button" class="btn btn-primary btn-sm" data-invite-action="accept">Entrar no clã</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-invite-action="decline">Recusar</button>
                    ${invite.decision ? '<button type="button" class="btn btn-link btn-sm" data-invite-action="why">Por quê?</button>' : ''}
                </div>
            </li>`;
    }

    if (invite.kind === 'arena-challenge') {
        return `
            <li class="invite" data-invite="${escapeHtml(invite.id)}">
                <p class="invite__kind">${icon('target', { size: 12 })} ${INVITE_LABELS['arena-challenge']}</p>
                <p class="invite__text"><strong>${escapeHtml(player?.nickname ?? 'Um rival')}</strong> desafiou você para um duelo (rating ${escapeHtml(String(invite.rating ?? ''))}).</p>
                <p class="invite__time">Vale até o fim da semana</p>
                <div class="invite__actions">
                    <button type="button" class="btn btn-primary btn-sm" data-invite-action="accept">Aceitar desafio</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-invite-action="decline">Recusar</button>
                </div>
            </li>`;
    }

    // Respostas: candidatura ou convite enviado.
    const accepted = invite.status === 'accepted';
    const subject = invite.kind === 'application'
        ? `${clanLabel(invite.clanId)} ${accepted ? 'aceitou' : 'recusou'} sua candidatura.`
        : `${player?.nickname ?? 'O jogador'} ${accepted ? 'aceitou' : 'recusou'} o convite para o seu clã.`;

    return `
        <li class="invite invite--response ${accepted ? 'is-accepted' : 'is-declined'}" data-invite="${escapeHtml(invite.id)}">
            <p class="invite__kind">${icon(accepted ? 'check-circle' : 'x-circle', { size: 12 })} ${accepted ? 'Resposta: aceito' : 'Resposta: recusado'}</p>
            <p class="invite__text">${escapeHtml(subject)}</p>
            <p class="invite__time">${escapeHtml(when)}</p>
            <div class="invite__actions">
                <button type="button" class="btn btn-outline-light btn-sm" data-invite-action="why">Ver o motivo</button>
                <button type="button" class="btn btn-ghost btn-sm" data-invite-action="seen">Marcar como visto</button>
            </div>
        </li>`;
}

export function renderInvites() {
    const list = document.querySelector('[data-invites-list]');
    const badge = document.querySelector('[data-invites-count]');
    const toggle = document.querySelector('.invites__toggle');
    if (!list) return;

    const items = [...actionableInvites(), ...unseenResponses()];
    const waiting = awaitingResponse();
    const count = inboxCount();

    if (badge) {
        badge.textContent = String(count);
        badge.hidden = count === 0;
    }
    toggle?.setAttribute('aria-label', count
        ? `Centro de convites: ${count} ${count === 1 ? 'pendente' : 'pendentes'}`
        : 'Centro de convites: nada pendente');

    const waitingLine = waiting.length
        ? `<p class="invites__waiting">${icon('clock', { size: 12 })} ${waiting.length} ${waiting.length === 1 ? 'resposta a caminho' : 'respostas a caminho'}.</p>`
        : '';

    list.innerHTML = items.length
        ? `<ul class="invites__items">${items.map(inviteItemMarkup).join('')}</ul>${waitingLine}`
        : `<div class="invites__empty">
                <p>Nenhum convite agora.</p>
                <p class="invites__hint">Jogue uma sessão em Squads ou marque um rival: convites de clã e desafios da Arena chegam aqui.</p>
                ${waitingLine}
                <a class="btn btn-outline-light btn-sm w-100" href="squads.html">Jogar uma sessão</a>
           </div>`;
}

async function showReasons(invite) {
    const { openDecisionDialog } = await import('./community-ui.js');
    openDecisionDialog(invite);
}

async function handleInviteAction(id, action) {
    if (action === 'accept') {
        const result = acceptInvite(id);
        if (!result.ok) {
            toast({ title: 'Não deu para aceitar', message: result.reason, type: 'warning' });
            renderInvites();
            return;
        }
        if (result.duel) {
            window.bootstrap?.Dropdown.getInstance(document.querySelector('.invites__toggle'))?.hide();
            const { openDuelConfirm } = await import('./arena-ui.js');
            openDuelConfirm(result.duel.playerId, { challengeId: result.duel.challengeId, onDone: renderInvites });
        } else {
            toast({ title: result.message ?? 'Convite aceito.', type: 'success' });
            refreshNavigationProgress();
            document.dispatchEvent(new CustomEvent('rivaly:community-changed'));
        }
    } else if (action === 'decline') {
        const result = declineInvite(id);
        if (result.ok) toast({ title: 'Convite recusado.', message: 'Você pode mudar de ideia no próximo convite.', type: 'info' });
    } else if (action === 'seen') {
        markSeen(id);
    } else if (action === 'why') {
        const invite = [...actionableInvites(), ...unseenResponses()].find((item) => item.id === id);
        if (invite) showReasons(invite);
        markSeen(id);
    }
    renderInvites();
}

/** Resolve o que venceu o prazo e avisa na tela. */
function settleInvites() {
    const resolved = resolveDueInvites();
    resolved.forEach((invite) => {
        const accepted = invite.status === 'accepted';
        toast({
            title: invite.kind === 'application'
                ? `${clanLabel(invite.clanId)} respondeu sua candidatura`
                : `${getPlayerById(invite.playerId)?.nickname ?? 'O jogador'} respondeu seu convite`,
            message: invite.decision?.summary ?? (accepted ? 'Aceito.' : 'Recusado.'),
            type: accepted ? 'success' : 'info',
        });
    });
    if (resolved.length) {
        refreshNavigationProgress();
        document.dispatchEvent(new CustomEvent('rivaly:community-changed'));
    }
    renderInvites();
    return resolved;
}

let inviteTimer = null;

function initInviteCenter() {
    expireOldInvites();
    ensureWeeklyChallenges();
    settleInvites();

    const menu = document.querySelector('[data-invites-menu]');
    menu?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-invite-action]');
        if (!button) return;
        const id = button.closest('[data-invite]')?.dataset.invite;
        if (id) handleInviteAction(id, button.dataset.inviteAction);
    });

    // Enquanto houver resposta a caminho, um temporizador curto confere o prazo.
    window.clearInterval(inviteTimer);
    inviteTimer = window.setInterval(() => {
        if (awaitingResponse().length === 0) return;
        settleInvites();
    }, 3000);

    document.addEventListener('rivaly:invites-changed', renderInvites);
}

/* ============================================================
   CARTÃO DO JOGADOR (mesmo componente em todo o site)
   Qualquer [data-player-card="pXX"] abre o cartão.
   ============================================================ */

function initPlayerCards() {
    if (document.documentElement.dataset.playerCards === 'on') return;
    document.documentElement.dataset.playerCards = 'on';

    document.addEventListener('click', async (event) => {
        const trigger = event.target.closest('[data-player-card]');
        if (!trigger) return;
        event.preventDefault();
        const { openPlayerCard } = await import('./player-card.js');
        openPlayerCard(trigger.dataset.playerCard);
    });
}

/* ============================================================
   MONTAGEM
   ============================================================ */

/**
 * @param {{page: string, title: string, subtitle?: string}} options
 */
export function mountNavigation({ page, title, subtitle = '' }) {
    const user = getUser();
    if (!user) return;

    markCurrent(page);
    fillHeading({ title, subtitle });

    const progress = levelProgress(user.xp);
    const mini = document.querySelector('[data-mini-passport]');
    if (mini) mini.innerHTML = miniPassportMarkup(user, progress);
    refreshNavigationProgress();

    initInviteCenter();
    initPlayerCards();

    // Navegar por um link do menu fecha o offcanvas no celular.
    document.getElementById('appNav')?.addEventListener('click', (event) => {
        if (!event.target.closest('a[href]')) return;
        window.bootstrap?.Offcanvas.getInstance(document.getElementById('appNav'))?.hide();
    });

    document.querySelector('[data-logout]')?.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
            title: 'Sair da conta?',
            message: 'Seu Passaporte, a Biblioteca, as conquistas e a comunidade continuam salvos neste navegador. Você pode entrar de novo quando quiser.',
            confirmLabel: 'Sair da conta',
            cancelLabel: 'Continuar aqui',
        });
        if (!confirmed) return;
        logout();
        window.location.href = 'index.html';
    });
}

/** Para páginas públicas que mostram a navegação pública. */
export function markPublicNavigation(page) {
    markCurrent(page);
}
