/**
 * activity.js — the local activity ledger.
 *
 * Every meaningful action the user takes is appended here so the
 * Dashboard and Passport can show a real history instead of a mock.
 * Capped so localStorage never grows without bound.
 */

import { getActivity, saveActivity } from './storage.js';

const MAX_ENTRIES = 60;

export const ACTIVITY_ICONS = {
    account: 'user',
    dna: 'dna',
    passport: 'id',
    library: 'controller',
    achievement: 'trophy',
    level: 'arrow-up',
    squad: 'users',
    xp: 'bolt',
};

/**
 * @param {keyof ACTIVITY_ICONS} type
 * @param {string} message  Human-readable, already localised.
 * @param {object} [meta]   Optional payload (xp gained, target id…).
 */
export function logActivity(type, message, meta = {}) {
    const entries = getActivity();
    entries.unshift({
        id: `act-${Date.now()}-${entries.length}`,
        type,
        message,
        meta,
        at: new Date().toISOString(),
    });
    saveActivity(entries.slice(0, MAX_ENTRIES));
}

export const getRecentActivity = (limit = 8) => getActivity().slice(0, limit);

export const clearActivity = () => saveActivity([]);
