/**
 * rng.js — o acaso da comunidade simulada, sem acaso de verdade.
 *
 * Todo comportamento dos jogadores semeados (aceitar um convite, ganhar
 * uma partida, postar no Feed) sai daqui. Nenhum módulo de domínio usa
 * Math.random(): cada sorteio nasce de uma semente montada com
 *
 *     id do usuário  +  id da entidade  +  semana ISO  (+ um contador)
 *
 * Consequências, todas deliberadas:
 *   - o mesmo cenário sempre gera o mesmo resultado (dá para auditar);
 *   - a comunidade muda de uma semana para a outra (a semana entra na semente);
 *   - repetir uma ação na mesma semana não "rerola" o resultado, a menos
 *     que o contador (ex.: nº da partida) tenha avançado.
 */

/* ============================================================
   SEMENTE
   ============================================================ */

/**
 * Hash de 32 bits (FNV-1a) das partes, unidas por "|".
 * @param {...(string|number)} parts
 * @returns {number} inteiro sem sinal
 */
export function seedFrom(...parts) {
    const text = parts.map((part) => String(part ?? '')).join('|');
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/* ============================================================
   GERADOR
   mulberry32: 32 bits de estado, período 2^32, rápido e bem
   distribuído para simulação (não para criptografia).
   ============================================================ */

export function mulberry32(seed) {
    let state = seed >>> 0;
    return function next() {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Atalho: um gerador já semeado, com helpers.
 * @param {...(string|number)} parts
 */
export function rngFor(...parts) {
    const next = mulberry32(seedFrom(...parts));
    return {
        next,
        /** Inteiro em [min, max]. */
        int: (min, max) => min + Math.floor(next() * (max - min + 1)),
        /** true com probabilidade p. */
        chance: (p) => next() < p,
        /** Um item da lista. */
        pick: (list) => list[Math.floor(next() * list.length)],
        /** Cópia embaralhada (Fisher–Yates). */
        shuffle: (list) => {
            const copy = [...list];
            for (let i = copy.length - 1; i > 0; i -= 1) {
                const j = Math.floor(next() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        },
        /**
         * Sorteio ponderado sem reposição: `count` itens, cada um com
         * chance proporcional a weight(item).
         */
        weightedSample: (list, weight, count) => {
            const pool = list.map((item) => ({ item, w: Math.max(0.0001, weight(item)) }));
            const out = [];
            while (out.length < count && pool.length > 0) {
                const total = pool.reduce((sum, entry) => sum + entry.w, 0);
                let roll = next() * total;
                const index = pool.findIndex((entry) => {
                    roll -= entry.w;
                    return roll <= 0;
                });
                const [chosen] = pool.splice(index < 0 ? pool.length - 1 : index, 1);
                out.push(chosen.item);
            }
            return out;
        },
    };
}

/* ============================================================
   SEMANA ISO (ISO 8601)
   A semana começa na segunda-feira; a semana 1 é a que contém a
   primeira quinta-feira do ano. É ela que define a temporada da
   Arena e o "humor" da comunidade.
   ============================================================ */

export function isoWeek(date = new Date()) {
    const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const weekday = day.getUTCDay() || 7;            // segunda = 1 ... domingo = 7
    day.setUTCDate(day.getUTCDate() + 4 - weekday);  // quinta-feira da mesma semana
    const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
    const year = day.getUTCFullYear();
    return { year, week, key: `${year}-W${String(week).padStart(2, '0')}` };
}

/** Chave da semana atual, ex.: "2026-W42". */
export const currentWeekKey = () => isoWeek().key;

/** Segunda-feira 00:00 (horário local) da semana atual. */
export function weekStart(date = new Date()) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const weekday = start.getDay() || 7;
    start.setDate(start.getDate() - (weekday - 1));
    return start;
}

/** Segunda-feira da semana anterior (para o Feed não começar vazio). */
export function previousWeek(date = new Date()) {
    const start = weekStart(date);
    start.setDate(start.getDate() - 7);
    return { start, key: isoWeek(start).key };
}

/**
 * Instante determinístico dentro de uma semana, para datar eventos
 * simulados. Quem consome filtra o que ainda está no futuro: assim os
 * posts da semana "vão aparecendo" conforme os dias passam, sempre nos
 * mesmos horários.
 */
export function momentInWeek(rng, start = weekStart()) {
    const offset = Math.floor(rng.next() * 7 * 86400000);
    return new Date(start.getTime() + offset).toISOString();
}
