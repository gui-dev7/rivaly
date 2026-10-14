/**
 * activity.js — the local activity ledger.
 *
 * Every meaningful action the user takes is appended here so the
 * Dashboard and Passport can show a real history instead of a mock.
 * Capped so localStorage never grows without bound.
 */

import { getActivity, saveActivity } from './storage.js';

const MAX_ENTRIES = 60;

// Contador da página: dois registros no mesmo milissegundo (comum quando
// uma ação dispara XP, nível e conquista juntos) não repetem o id.
let sequence = 0;

export const ACTIVITY_ICONS = {
    account: 'user',
    dna: 'dna',
    passport: 'id',
    library: 'controller',
    achievement: 'trophy',
    level: 'arrow-up',
    squad: 'users',
    xp: 'bolt',

    /* V2: comunidade */
    session: 'play',
    relation: 'heart',
    clan: 'shield',
    arena: 'target',
    feed: 'globe',
    invite: 'mail',
};

/**
 * @param {keyof ACTIVITY_ICONS} type
 * @param {string} message  Human-readable, already localised.
 * @param {object} [meta]   Optional payload (xp gained, target id…).
 */
export function logActivity(type, message, meta = {}) {
    const entries = getActivity();
    entries.unshift({
        id: `act-${Date.now().toString(36)}-${(sequence += 1).toString(36)}`,
        type,
        message,
        meta,
        at: new Date().toISOString(),
    });
    saveActivity(entries.slice(0, MAX_ENTRIES));
}

export const getRecentActivity = (limit = 8) => getActivity().slice(0, limit);

export const clearActivity = () => saveActivity([]);
