import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { seedFrom, mulberry32, rngFor, isoWeek, weekStart } from '../js/rng.js';
import {
    required, minLength, maxLength, pattern, email, matches, unique, noHtml, notBlank, numberRange, oneOf,
    validateValue, validateData, sanitizeText,
} from '../js/validation.js';

/* ---------------- rng.js ---------------- */

test('seedFrom é determinístico e distingue as partes', () => {
    assert.equal(seedFrom('a', 'b', 1), seedFrom('a', 'b', 1));
    assert.notEqual(seedFrom('a', 'b'), seedFrom('ab'));
    assert.ok(Number.isInteger(seedFrom('x')) && seedFrom('x') >= 0);
});

test('mulberry32 repete a sequência e fica em [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 500; i += 1) {
        const value = a();
        assert.equal(value, b());
        assert.ok(value >= 0 && value < 1);
    }
});

test('rngFor: int dentro dos limites, shuffle é permutação, amostra sem repetir', () => {
    const rng = rngFor('teste', 'w1');
    for (let i = 0; i < 200; i += 1) {
        const n = rng.int(-6, 6);
        assert.ok(n >= -6 && n <= 6 && Number.isInteger(n));
    }
    const list = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = rng.shuffle(list);
    assert.deepEqual([...shuffled].sort((x, y) => x - y), list);
    assert.deepEqual(list, [1, 2, 3, 4, 5, 6, 7, 8], 'shuffle não altera a lista original');

    const sample = rng.weightedSample(list, (n) => n, 3);
    assert.equal(sample.length, 3);
    assert.equal(new Set(sample).size, 3);
});

test('isoWeek segue a ISO 8601 nas viradas de ano', () => {
    assert.equal(isoWeek(new Date(2026, 0, 1)).key, '2026-W01');
    assert.equal(isoWeek(new Date(2024, 11, 30)).key, '2025-W01');
    assert.equal(isoWeek(new Date(2021, 0, 3)).key, '2020-W53');
    assert.equal(isoWeek(new Date(2026, 9, 13)).key, '2026-W42');
});

test('weekStart é a segunda-feira 00:00', () => {
    const start = weekStart(new Date(2026, 9, 15, 18, 30)); // quinta
    assert.equal(start.getDay(), 1);
    assert.equal(start.getHours(), 0);
    assert.equal(start.getDate(), 12);
});

/* ---------------- validation.js ---------------- */

test('regras devolvem a mensagem ou string vazia', () => {
    assert.equal(required('obrigatório')('  '), 'obrigatório');
    assert.equal(required('obrigatório')(['a']), '');
    assert.equal(required('obrigatório')([]), 'obrigatório');
    assert.equal(minLength(3, 'curto')('ab'), 'curto');
    assert.equal(minLength(3, 'curto')(''), '', 'vazio é assunto do required');
    assert.equal(maxLength(4, 'longo')('abcde'), 'longo');
    assert.equal(pattern(/^[A-Z]+$/, 'só A-Z')('abc'), 'só A-Z');
    assert.equal(email()('nome@exemplo.com'), '');
    assert.notEqual(email()('nome@exemplo'), '');
    assert.equal(matches(() => '123456', 'diferente')('123456'), '');
    assert.equal(matches(() => '123456', 'diferente')('12345'), 'diferente');
    assert.equal(unique(() => ['NOX', 'GOL'], 'repetida')('nox'), 'repetida');
    assert.equal(unique(() => ['NOX'], 'repetida')('RVLY'), '');
    assert.notEqual(noHtml()('<b>oi</b>'), '');
    assert.equal(noHtml()('oi'), '');
    assert.notEqual(notBlank()('   '), '');
    assert.equal(notBlank()(''), '');
    assert.notEqual(numberRange(10, 120)('8'), '');
    assert.equal(numberRange(10, 120)(''), '');
    assert.equal(oneOf(['a', 'b'])('a'), '');
    assert.notEqual(oneOf(['a', 'b'])('c'), '');
});

test('validateValue devolve a LISTA de erros; validateData valida o objeto', () => {
    const rules = [required('vazio'), minLength(3, 'curto'), noHtml('sem html')];
    assert.deepEqual(validateValue('', rules), ['vazio']);
    assert.deepEqual(validateValue('<a', rules), ['curto', 'sem html']);
    assert.deepEqual(validateValue('texto', rules), []);

    const result = validateData({ nome: 'ab', tag: 'RVLY' }, { nome: [minLength(3, 'curto')], tag: [maxLength(4, 'longa')] });
    assert.equal(result.valid, false);
    assert.deepEqual(result.errors, { nome: ['curto'] });
});

test('sanitizeText tira controles, junta espaços e corta no limite', () => {
    assert.equal(sanitizeText('  oi \n\t  mundo  '), 'oi mundo');
    assert.equal(sanitizeText('a'.repeat(300), 280).length, 280);
    assert.equal(sanitizeText(null), '');
});
