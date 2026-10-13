/**
 * invites.js — a caixa de convites da comunidade simulada.
 *
 * Quatro tipos, um formato só:
 *
 *   clan-invite      recebido: um jogador semeado chama você para o clã dele
 *   arena-challenge  recebido: um rival desafia você na Arena
 *   application      enviado:  sua candidatura a um clã (resposta depois)
 *   outgoing-invite  enviado:  você convidou alguém para o seu clã
 *
 * Estados: pending → accepted | declined | expired.
 *
 * Candidaturas e convites enviados não respondem na hora: ganham um
 * `resolveAt` (intervalo simulado, persistido). A resposta sai na próxima
 * visita ou quando o temporizador do centro de convites passa por ela.
 *
 * Quem decide o que acontece ao aceitar ou ao resolver não é este módulo:
 * clans-store.js e arena-store.js registram handlers por tipo. Assim a
 * caixa não depende de clãs nem da Arena, e não há import circular.
 */

import { getInvites, saveInvites } from './storage.js';
import { currentWeekKey } from './rng.js';

export const INVITE_LABELS = {
    'clan-invite': 'Convite de clã',
    'arena-challenge': 'Desafio da Arena',
    application: 'Candidatura',
    'outgoing-invite': 'Convite enviado',
};

/** Tempo simulado até a resposta de uma candidatura/convite enviado. */
export const RESPONSE_DELAY_MS = 12000;

const handlers = new Map();

/**
 * @param {string} kind
 * @param {{ resolve?: Function, accept?: Function, decline?: Function }} handler
 */
export function registerInviteHandler(kind, handler) {
    handlers.set(kind, { ...(handlers.get(kind) ?? {}), ...handler });
}

/* ============================================================
   LEITURA
   ============================================================ */

export const listInvites = () => getInvites();

export const findInvite = (id) => getInvites().find((invite) => invite.id === id) ?? null;

/** Pendências que pedem uma ação sua (aceitar ou recusar). */
export const actionableInvites = () =>
    getInvites().filter((invite) => invite.status === 'pending' && (invite.kind === 'clan-invite' || invite.kind === 'arena-challenge'));

/** Respostas que chegaram e você ainda não viu. */
export const unseenResponses = () =>
    getInvites().filter((invite) => invite.status !== 'pending'
        && (invite.kind === 'application' || invite.kind === 'outgoing-invite')
        && !invite.seen);

/** Enviados que ainda aguardam resposta. */
export const awaitingResponse = () =>
    getInvites().filter((invite) => invite.status === 'pending'
        && (invite.kind === 'application' || invite.kind === 'outgoing-invite'));

/** O número do badge: o que pede ação + o que chegou e não foi visto. */
export const inboxCount = () => actionableInvites().length + unseenResponses().length;

/* ============================================================
   ESCRITA
   ============================================================ */

function update(id, patch) {
    const invites = getInvites();
    const index = invites.findIndex((invite) => invite.id === id);
    if (index < 0) return null;
    invites[index] = { ...invites[index], ...patch, updatedAt: new Date().toISOString() };
    saveInvites(invites);
    return invites[index];
}

/** Adiciona sem duplicar: ids determinísticos tornam a geração idempotente. */
export function addInvite(invite) {
    const invites = getInvites();
    const existing = invites.find((item) => item.id === invite.id);
    if (existing) return existing;

    const record = {
        status: 'pending',
        seen: false,
        createdAt: new Date().toISOString(),
        week: currentWeekKey(),
        decision: null,
        ...invite,
    };
    saveInvites([record, ...invites]);
    return record;
}

export const markSeen = (id) => update(id, { seen: true });

export function markAllSeen() {
    const invites = getInvites().map((invite) =>
        (invite.status !== 'pending' ? { ...invite, seen: true } : invite));
    saveInvites(invites);
}

/** Convites recebidos expiram no fim da semana em que chegaram. */
export function expireOldInvites(week = currentWeekKey()) {
    let changed = false;
    const invites = getInvites().map((invite) => {
        const received = invite.kind === 'clan-invite' || invite.kind === 'arena-challenge';
        if (received && invite.status === 'pending' && invite.week && invite.week !== week) {
            changed = true;
            return { ...invite, status: 'expired', seen: true };
        }
        return invite;
    });
    if (changed) saveInvites(invites);
    return changed;
}

/**
 * Resolve candidaturas e convites enviados cujo intervalo já passou.
 * @returns {object[]} os convites resolvidos agora (para o aviso na tela)
 */
export function resolveDueInvites(now = Date.now()) {
    const due = getInvites().filter((invite) => invite.status === 'pending'
        && invite.resolveAt
        && new Date(invite.resolveAt).getTime() <= now);

    return due.map((invite) => {
        const handler = handlers.get(invite.kind);
        if (!handler?.resolve) return null;
        const outcome = handler.resolve(invite); // { status, decision }
        if (!outcome) return null;
        return update(invite.id, { status: outcome.status, decision: outcome.decision, seen: false, resolvedAt: new Date().toISOString() });
    }).filter(Boolean);
}

/** Aceita um convite recebido. O handler do tipo aplica o efeito. */
export function acceptInvite(id) {
    const invite = findInvite(id);
    if (!invite || invite.status !== 'pending') {
        return { ok: false, reason: 'Este convite não está mais pendente.' };
    }
    const handler = handlers.get(invite.kind);
    const result = handler?.accept ? handler.accept(invite) : { ok: true };
    if (!result?.ok) return result ?? { ok: false, reason: 'Não foi possível aceitar agora.' };
    if (!result.keepPending) update(id, { status: 'accepted', seen: true });
    return { ...result, invite };
}

export function declineInvite(id) {
    const invite = findInvite(id);
    if (!invite || invite.status !== 'pending') {
        return { ok: false, reason: 'Este convite não está mais pendente.' };
    }
    handlers.get(invite.kind)?.decline?.(invite);
    update(id, { status: 'declined', seen: true });
    return { ok: true, invite };
}

/** Fecha um desafio já jogado (a Arena chama ao registrar a partida). */
export const completeInvite = (id) => update(id, { status: 'accepted', seen: true });
