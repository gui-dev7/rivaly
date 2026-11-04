/**
 * availability.js — a Agenda da semana como MATRIZ.
 *
 * Cada pessoa tem uma matriz 7 × 5 de 0 e 1:
 *
 *              Manhã  Tarde  Noite  Madrugada  Alta madr.
 *     Seg   [    0      0      1        1          0     ]
 *     Ter   [    0      0      1        0          0     ]
 *     …
 *     Dom   [    0      1      1        0          0     ]
 *
 * linha = dia da semana, coluna = período (a mesma ordem de SCHEDULES).
 * Somar as matrizes do squad dá o "mapa de calor": quantas pessoas estão
 * livres em cada célula. O melhor horário é a célula com o maior valor.
 *
 * Custo: para m pessoas, somar é O(m × 7 × 5) — laços aninhados, como a
 * soma de matrizes do capítulo de eficiência de algoritmos.
 *
 * Os jogadores simulados não preenchem agenda: os dias deles são
 * sorteados de forma determinística (rng.js) a partir dos períodos que
 * já constam no perfil. Sempre a mesma agenda para o mesmo jogador.
 */

import { SCHEDULES } from './data.js';
import { rngFor } from '../core/rng.js';

export const DAYS = [
    { id: 'mon', short: 'Seg', label: 'Segunda' },
    { id: 'tue', short: 'Ter', label: 'Terça' },
    { id: 'wed', short: 'Qua', label: 'Quarta' },
    { id: 'thu', short: 'Qui', label: 'Quinta' },
    { id: 'fri', short: 'Sex', label: 'Sexta' },
    { id: 'sat', short: 'Sáb', label: 'Sábado' },
    { id: 'sun', short: 'Dom', label: 'Domingo' },
];

export const PERIODS = SCHEDULES;
export const ROWS = DAYS.length;      // 7
export const COLS = PERIODS.length;   // 5

/** Quantos dias, no mínimo, um jogador simulado joga por semana. */
export const MIN_PLAYER_DAYS = 2;

/* ============================================================
   OPERAÇÕES DE MATRIZ (puras)
   ============================================================ */

/** Matriz rows × cols preenchida com `fill`. */
export function createMatrix(rows = ROWS, cols = COLS, fill = 0) {
    const matrix = [];
    for (let r = 0; r < rows; r += 1) {
        const row = [];
        for (let c = 0; c < cols; c += 1) row.push(fill);
        matrix.push(row);
    }
    return matrix;
}

/** Aceita só uma matriz 7 × 5 de 0/1; qualquer outra coisa vira null. */
export function isValidMatrix(matrix) {
    if (!Array.isArray(matrix) || matrix.length !== ROWS) return false;
    for (let r = 0; r < ROWS; r += 1) {
        const row = matrix[r];
        if (!Array.isArray(row) || row.length !== COLS) return false;
        for (let c = 0; c < COLS; c += 1) if (row[c] !== 0 && row[c] !== 1) return false;
    }
    return true;
}

/** Soma célula a célula de várias matrizes do mesmo tamanho. */
export function sumMatrices(matrices) {
    const total = createMatrix(ROWS, COLS, 0);
    for (const matrix of matrices) {
        for (let r = 0; r < ROWS; r += 1) {
            for (let c = 0; c < COLS; c += 1) total[r][c] += matrix[r][c];
        }
    }
    return total;
}

/** Interseção (E lógico) de duas agendas: 1 só onde as duas pessoas estão livres. */
export function intersect(a, b) {
    const result = createMatrix(ROWS, COLS, 0);
    for (let r = 0; r < ROWS; r += 1) {
        for (let c = 0; c < COLS; c += 1) result[r][c] = a[r][c] === 1 && b[r][c] === 1 ? 1 : 0;
    }
    return result;
}

/** Quantas células estão marcadas. */
export function countFilled(matrix) {
    let count = 0;
    for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < matrix[r].length; c += 1) if (matrix[r][c] > 0) count += 1;
    }
    return count;
}

/**
 * As melhores células de um mapa de calor, da maior para a menor.
 * Empate: o dia mais cedo da semana e o período mais cedo vencem.
 */
export function bestSlots(heat, limit = 3) {
    const cells = [];
    for (let r = 0; r < heat.length; r += 1) {
        for (let c = 0; c < heat[r].length; c += 1) {
            if (heat[r][c] > 0) cells.push({ row: r, col: c, value: heat[r][c] });
        }
    }
    cells.sort((x, y) => y.value - x.value || x.row - y.row || x.col - y.col);
    return cells.slice(0, limit).map((cell) => ({ ...cell, day: DAYS[cell.row], period: PERIODS[cell.col] }));
}

/* ============================================================
   AGENDAS
   ============================================================ */

const periodIndex = (id) => PERIODS.findIndex((period) => period.id === id);

/** Matriz com os períodos marcados em todos os dias da lista. */
export function matrixFrom(dayIndexes, periodIds) {
    const matrix = createMatrix();
    const cols = periodIds.map(periodIndex).filter((index) => index >= 0);
    for (const r of dayIndexes) {
        for (const c of cols) matrix[r][c] = 1;
    }
    return matrix;
}

/**
 * Agenda de um jogador simulado. Cada dia entra com 55% de chance;
 * o sorteio se REPETE enquanto der menos de MIN_PLAYER_DAYS dias.
 * É um do-while: o sorteio precisa acontecer pelo menos uma vez antes
 * de saber se ficou bom. Como o gerador é semeado, cada tentativa é
 * diferente, mas o resultado final é sempre o mesmo para o mesmo jogador.
 */
export function playerAvailability(player) {
    const rng = rngFor('availability', player.id);
    let days;
    let attempts = 0;
    do {
        days = [];
        for (let r = 0; r < ROWS; r += 1) if (rng.chance(0.55)) days.push(r);
        attempts += 1;
    } while (days.length < MIN_PLAYER_DAYS && attempts < 20);
    if (days.length < MIN_PLAYER_DAYS) days = [4, 5]; // salvaguarda: sexta e sábado
    return matrixFrom(days, player.schedules ?? []);
}

/** Agenda padrão do usuário: os períodos do Passaporte, todos os dias. */
export function defaultUserAvailability(user) {
    const all = [];
    for (let r = 0; r < ROWS; r += 1) all.push(r);
    return matrixFrom(all, user?.schedules ?? []);
}

/** Inverte uma célula e devolve uma NOVA matriz (a original não muda). */
export function toggleCell(matrix, row, col) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return matrix;
    const copy = matrix.map((line) => [...line]);
    copy[row][col] = copy[row][col] === 1 ? 0 : 1;
    return copy;
}

/**
 * Mapa de calor de um squad: a soma das agendas de todos (você incluso)
 * e o resumo que a tela precisa.
 */
export function squadHeatmap(userMatrix, players) {
    const matrices = [userMatrix, ...players.map(playerAvailability)];
    const heat = sumMatrices(matrices);
    const size = matrices.length;
    const best = bestSlots(heat, 3);
    const everyone = best.filter((slot) => slot.value === size);
    let common = userMatrix;
    for (const player of players) common = intersect(common, playerAvailability(player));
    return { heat, size, best, everyone, commonSlots: countFilled(common) };
}
