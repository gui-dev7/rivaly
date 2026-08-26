/**
 * gamer-dna.js — the behavioural profiling engine.
 *
 * Fully deterministic: the same set of answers always produces the
 * same six attribute values and the same archetype. There is no
 * `Math.random()` anywhere in this file, by design.
 *
 * Pipeline
 *   answers  →  raw weighted sums per attribute
 *            →  normalised against the maximum reachable sum
 *            →  mapped onto a 18–98 display range
 *            →  archetype resolved from the ranked vector
 */

import { DNA_QUESTIONS, DNA_ATTRIBUTES, ARCHETYPES } from './data.js';

/** Display floor/ceiling. A profile is never "0% social" — it is just lower. */
const SCORE_FLOOR = 18;
const SCORE_RANGE = 80;

const ATTRIBUTE_IDS = DNA_ATTRIBUTES.map((attribute) => attribute.id);

/**
 * Tie-break order. When two attributes land on the same score, the one
 * earlier in this list wins — which keeps archetype resolution stable
 * instead of depending on object key order.
 */
const TIE_BREAK_ORDER = ['strategist', 'competitive', 'social', 'explorer', 'achiever', 'collector'];

/**
 * The best score each attribute could possibly reach, given the
 * questionnaire. Computed once from the data, so adding a question
 * never requires touching this file.
 */
const MAX_POSSIBLE = (() => {
    const totals = Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, 0]));
    DNA_QUESTIONS.forEach((question) => {
        ATTRIBUTE_IDS.forEach((id) => {
            const best = Math.max(...question.options.map((option) => option.weights[id] ?? 0));
            totals[id] += best;
        });
    });
    return totals;
})();

/**
 * @param {Record<string,string>} answers Map of questionId → optionId.
 * @returns {Record<string,number>} Attribute id → 0-100 score.
 */
export function calculateDnaScores(answers) {
    const raw = Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, 0]));

    DNA_QUESTIONS.forEach((question) => {
        const chosenId = answers[question.id];
        const option = question.options.find((candidate) => candidate.id === chosenId);
        if (!option) return;
        Object.entries(option.weights).forEach(([attribute, weight]) => {
            if (attribute in raw) raw[attribute] += weight;
        });
    });

    const scores = {};
    ATTRIBUTE_IDS.forEach((id) => {
        const ceiling = MAX_POSSIBLE[id] || 1;
        const ratio = Math.min(1, raw[id] / ceiling);
        scores[id] = Math.round(SCORE_FLOOR + SCORE_RANGE * ratio);
    });

    return scores;
}

/** Attributes sorted strongest → weakest, with deterministic tie-breaking. */
export function rankAttributes(scores) {
    return [...ATTRIBUTE_IDS].sort((a, b) => {
        const diff = (scores[b] ?? 0) - (scores[a] ?? 0);
        if (diff !== 0) return diff;
        return TIE_BREAK_ORDER.indexOf(a) - TIE_BREAK_ORDER.indexOf(b);
    });
}

/**
 * Resolves the archetype.
 *
 * Rule: combination archetypes (primary + secondary) are checked first,
 * because "strategist who also competes" is more descriptive than
 * "strategist". Only if no combination matches does a single-axis
 * archetype apply. ARCHETYPES is ordered accordingly in data.js.
 */
export function resolveArchetype(scores) {
    const [first, second] = rankAttributes(scores);

    const combination = ARCHETYPES.find(
        (archetype) => archetype.secondary && archetype.primary === first && archetype.secondary === second
    );
    if (combination) return combination;

    const single = ARCHETYPES.find(
        (archetype) => !archetype.secondary && archetype.primary === first
    );

    // Every attribute has a single-axis archetype, so this fallback is
    // defensive only — it can never be reached with the shipped dataset.
    return single ?? ARCHETYPES[ARCHETYPES.length - 1];
}

/**
 * Full DNA object stored on the user's passport.
 * @returns {{scores:object, archetypeId:string, dominant:string, ranked:string[], answers:object, computedAt:string}}
 */
export function buildDnaProfile(answers) {
    const scores = calculateDnaScores(answers);
    const ranked = rankAttributes(scores);
    const archetype = resolveArchetype(scores);

    return {
        scores,
        ranked,
        archetypeId: archetype.id,
        dominant: ranked[0],
        answers: { ...answers },
        computedAt: new Date().toISOString(),
    };
}

export const getArchetypeById = (id) =>
    ARCHETYPES.find((archetype) => archetype.id === id) ?? null;

export const getAttributeById = (id) =>
    DNA_ATTRIBUTES.find((attribute) => attribute.id === id) ?? null;

/**
 * A single 0-100 summary of how "intense" a profile is.
 * Used by the Gamer Score, never for compatibility.
 */
export function dnaIntensity(scores) {
    if (!scores) return 0;
    const values = ATTRIBUTE_IDS.map((id) => scores[id] ?? 0);
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/**
 * Derives suggested squad roles from the DNA vector, used to pre-fill
 * the Passport when the user has not chosen roles manually.
 */
export function suggestedRoles(scores) {
    const archetype = resolveArchetype(scores);
    return archetype.roles ?? ['flex'];
}

/**
 * Compares two DNA vectors and returns 0-100 similarity.
 * Simulated players do not carry a full DNA profile, so this is used
 * only between real profiles (e.g. future clan features). Exposed here
 * because it belongs to the DNA domain, not to the match engine.
 */
export function dnaSimilarity(a, b) {
    if (!a || !b) return 0;
    const distance = ATTRIBUTE_IDS.reduce(
        (sum, id) => sum + Math.abs((a[id] ?? 0) - (b[id] ?? 0)),
        0
    );
    const maxDistance = ATTRIBUTE_IDS.length * SCORE_RANGE;
    return Math.round(100 * (1 - distance / maxDistance));
}
