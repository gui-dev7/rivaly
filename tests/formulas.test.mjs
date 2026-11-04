/**
 * formulas.test.mjs — a matemática da RIVALY (funções de 1º e 2º grau,
 * Bhaskara, vértice, Elo e soma ponderada).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    linear, quadratic, bhaskara, vertex, weightedSum,
    xpStepForLevel, totalXpForLevel, levelFromXp,
    clanXpForLevel, clanLevelFromXp,
    kFactor, expectedScore, ratingDelta, seasonPoints,
    balanceBonus, BALANCE_BONUS_MAX, BALANCE_PARABOLA,
} from '../js/domain/formulas.js';

test('1º grau: linear(a, b) devolve f(x) = ax + b', () => {
    const f = linear(500, 500);
    assert.equal(f(0), 500);
    assert.equal(f(1), 1000);
    assert.equal(f(3), 2000);
    // taxa de variação constante: f(x+1) − f(x) = a
    for (let x = 1; x < 20; x += 1) assert.equal(f(x + 1) - f(x), 500);
});

test('2º grau: Bhaskara encontra as raízes e o vértice da parábola', () => {
    // x² − 5x + 6 = 0 → 2 e 3
    assert.deepEqual(bhaskara(1, -5, 6), { delta: 1, roots: [2, 3] });
    // x² + 2x + 1 = 0 → raiz dupla −1
    assert.deepEqual(bhaskara(1, 2, 1), { delta: 0, roots: [-1] });
    // sem raiz real
    assert.equal(bhaskara(1, 0, 1).roots.length, 0);
    assert.throws(() => bhaskara(0, 1, 1), RangeError);

    const v = vertex(-1, 4, 0); // −x² + 4x → máximo em (2, 4)
    assert.deepEqual(v, { x: 2, y: 4, kind: 'máximo' });
    assert.equal(quadratic(-1, 4, 0)(2), 4);
});

test('XP: o acumulado (2º grau) é a soma dos passos (1º grau)', () => {
    for (let level = 1; level <= 60; level += 1) {
        let sum = 0;
        for (let l = 1; l < level; l += 1) sum += xpStepForLevel(l);
        assert.equal(totalXpForLevel(level), sum, `nível ${level}`);
    }
    assert.equal(xpStepForLevel(1), 1000);
    assert.equal(totalXpForLevel(4), 4500);
});

test('XP: levelFromXp (Bhaskara) concorda com a busca por laço em todo o intervalo', () => {
    // Referência ingênua: sobe nível por nível enquanto houver XP (while).
    const byLoop = (xp) => {
        let level = 1;
        while (totalXpForLevel(level + 1) <= xp) level += 1;
        return level;
    };
    for (let xp = 0; xp <= 60000; xp += 37) assert.equal(levelFromXp(xp), byLoop(xp), `xp ${xp}`);
    // fronteiras exatas
    assert.equal(levelFromXp(999), 1);
    assert.equal(levelFromXp(1000), 2);
    assert.equal(levelFromXp(-50), 1);
    assert.equal(levelFromXp('abc'), 1);
});

test('Clã: xp(N) = 120(N − 1)² e o inverso por raiz quadrada', () => {
    assert.equal(clanXpForLevel(1), 0);
    assert.equal(clanXpForLevel(3), 480);
    for (let n = 1; n <= 30; n += 1) {
        assert.equal(clanLevelFromXp(clanXpForLevel(n)), n);
        assert.equal(clanLevelFromXp(clanXpForLevel(n + 1) - 1), n);
    }
});

test('Elo: expectativa simétrica, K e variação linear no resultado', () => {
    assert.equal(expectedScore(1000, 1000), 0.5);
    const e = expectedScore(1200, 1000);
    assert.ok(Math.abs(e + expectedScore(1000, 1200) - 1) < 1e-12);
    assert.equal(kFactor(0), 40);
    assert.equal(kFactor(9), 40);
    assert.equal(kFactor(10), 32);
    // ΔR = K(S − E): com E = 0,5 e K = 32, vitória +16, derrota −16
    assert.equal(ratingDelta(32, 0.5, 1), 16);
    assert.equal(ratingDelta(32, 0.5, 0), -16);
    assert.equal(seasonPoints(4, 2), 14);
});

test('Bônus de equilíbrio: parábola com máximo em 50% e zero nas pontas', () => {
    const { a, b, c } = BALANCE_PARABOLA;
    const top = vertex(a, b, c);
    assert.equal(top.x, 0.5);
    assert.equal(top.y, BALANCE_BONUS_MAX);
    assert.equal(balanceBonus(0.5), BALANCE_BONUS_MAX);
    assert.equal(balanceBonus(0), 0);
    assert.equal(balanceBonus(1), 0);
    // simetria: B(p) = B(1 − p)
    for (let i = 0; i <= 100; i += 1) assert.equal(balanceBonus(i / 100), balanceBonus(1 - i / 100));
    // valores fora de 0–1 são limitados
    assert.equal(balanceBonus(2), 0);
    assert.equal(balanceBonus(-1), 0);
});

test('Soma ponderada: os 7 pesos da compatibilidade fecham 100', () => {
    const weights = [20, 15, 15, 15, 15, 10, 10];
    assert.equal(weightedSum(weights, [1, 1, 1, 1, 1, 1, 1]), 100);
    assert.equal(weightedSum(weights, [0, 0, 0, 0, 0, 0, 0]), 0);
    assert.equal(weightedSum(weights, [1, 0.5, 0, 1, 0, 1, 0]), 20 + 7.5 + 15 + 10);
    assert.throws(() => weightedSum([1, 2], [1]), RangeError);
});
