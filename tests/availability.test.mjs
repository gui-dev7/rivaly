/**
 * availability.test.mjs — a Agenda da semana como matriz 7 × 5.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    ROWS, COLS, MIN_PLAYER_DAYS, createMatrix, isValidMatrix, sumMatrices, intersect, countFilled,
    bestSlots, matrixFrom, playerAvailability, defaultUserAvailability, toggleCell, squadHeatmap,
} from '../js/domain/availability.js';
import { PLAYERS } from '../js/domain/data.js';

test('createMatrix monta linhas × colunas independentes', () => {
    const m = createMatrix();
    assert.equal(m.length, 7);
    assert.ok(m.every((row) => row.length === 5 && row.every((cell) => cell === 0)));
    m[0][0] = 1;
    assert.equal(m[1][0], 0, 'as linhas não podem ser a mesma referência');
});

test('isValidMatrix recusa forma ou valores errados', () => {
    assert.equal(isValidMatrix(createMatrix()), true);
    assert.equal(isValidMatrix(null), false);
    assert.equal(isValidMatrix(createMatrix(6, 5)), false);
    const bad = createMatrix();
    bad[2][3] = 2;
    assert.equal(isValidMatrix(bad), false);
    assert.equal(isValidMatrix('<script>'), false);
});

test('soma e interseção célula a célula', () => {
    const a = matrixFrom([0, 1], ['evening']);           // seg e ter à noite
    const b = matrixFrom([1, 2], ['evening', 'night']);  // ter e qua, noite e madrugada
    const sum = sumMatrices([a, b]);
    assert.equal(sum[1][2], 2);   // ter · noite: os dois
    assert.equal(sum[0][2], 1);
    assert.equal(sum[2][3], 1);
    const both = intersect(a, b);
    assert.equal(countFilled(both), 1);
    assert.equal(both[1][2], 1);
});

test('bestSlots ordena por valor e desempata pelo mais cedo', () => {
    const heat = createMatrix();
    heat[5][2] = 3;
    heat[1][2] = 3;
    heat[0][0] = 1;
    const best = bestSlots(heat, 2);
    assert.deepEqual(best.map((slot) => [slot.row, slot.col, slot.value]), [[1, 2, 3], [5, 2, 3]]);
    assert.equal(best[0].day.short, 'Ter');
    assert.equal(best[0].period.id, 'evening');
    assert.equal(bestSlots(createMatrix()).length, 0);
});

test('agenda de jogador simulado: determinística, mínimo de dias (do-while) e só nos períodos dele', () => {
    for (const player of PLAYERS) {
        const m = playerAvailability(player);
        assert.deepEqual(m, playerAvailability(player), player.id);
        let days = 0;
        for (let r = 0; r < ROWS; r += 1) if (m[r].some((cell) => cell === 1)) days += 1;
        assert.ok(days >= MIN_PLAYER_DAYS, `${player.id}: ${days} dias`);
        for (let r = 0; r < ROWS; r += 1) {
            for (let c = 0; c < COLS; c += 1) {
                if (m[r][c] === 1) assert.ok(player.schedules.length > 0);
            }
        }
    }
});

test('agenda padrão do usuário e toggle imutável', () => {
    const user = { schedules: ['evening'] };
    const m = defaultUserAvailability(user);
    assert.equal(countFilled(m), 7);
    const t = toggleCell(m, 0, 2);
    assert.equal(t[0][2], 0);
    assert.equal(m[0][2], 1, 'a matriz original não muda');
    assert.equal(toggleCell(m, 9, 9), m, 'fora da matriz não faz nada');
    assert.equal(countFilled(defaultUserAvailability(null)), 0);
});

test('squadHeatmap soma você + jogadores e acha quando todos estão livres', () => {
    const team = PLAYERS.slice(0, 3);
    const everyHour = createMatrix(ROWS, COLS, 1);
    const map = squadHeatmap(everyHour, team);
    assert.equal(map.size, 4);
    const top = map.best[0];
    assert.ok(top.value <= 4 && top.value >= 1);
    for (const slot of map.everyone) assert.equal(slot.value, 4);
    assert.equal(map.commonSlots, map.heat.flat().filter((value) => value === 4).length);
});
