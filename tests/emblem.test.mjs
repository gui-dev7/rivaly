import './setup.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { seedUser } from './helpers.mjs';
import {
    createClan, myClan, setClanEmblem, emblemSvg, defaultEmblem, resolveEmblem, leaveClan,
    EMBLEM_SHAPES, EMBLEM_PATTERNS, EMBLEM_PALETTES,
} from '../js/clans-store.js';
import { CLANS } from '../js/data.js';
import { saveClanMembership } from '../js/storage.js';

const base = { name: 'Time Teste', tag: 'TST', focusGame: 'valorant', playstyle: 'competitive', policy: 'open', motto: '', minRank: 'Unranked' };

beforeEach(() => seedUser());

test('há vários formatos, padrões e cores para escolher', () => {
    assert.ok(Object.keys(EMBLEM_SHAPES).length >= 8);
    assert.ok(Object.keys(EMBLEM_PATTERNS).length >= 6);
    assert.ok(Object.keys(EMBLEM_PALETTES).length >= 3);
});

test('sem escolha, o emblema sai da tag e é sempre o mesmo', () => {
    assert.deepEqual(defaultEmblem('RVLY'), defaultEmblem('rvly'));
    const resolved = resolveEmblem('RVLY', { shape: 'inexistente', pattern: 'cross' });
    assert.equal(resolved.shape, defaultEmblem('RVLY').shape, 'formato inválido volta ao padrão');
    assert.equal(resolved.pattern, 'cross');
});

test('o SVG usa a escolha, escapa a tag e não repete ids', () => {
    const svg = emblemSvg('<b>', { emblem: { shape: 'kite', pattern: 'cross', palette: 'inverse' } });
    assert.ok(svg.includes('emblem--inverse'));
    assert.ok(svg.includes(EMBLEM_SHAPES.kite.path));
    assert.ok(!svg.includes('<b>'));
    const ids = [emblemSvg('AB'), emblemSvg('AB')].map((s) => /clipPath id="([^"]+)"/.exec(s)[1]);
    assert.notEqual(ids[0], ids[1]);
});

test('criar clã guarda o emblema escolhido', () => {
    const emblem = { shape: 'crest', pattern: 'chevron', palette: 'steel' };
    const result = createClan({ ...base, emblem });
    assert.ok(result.ok);
    assert.deepEqual(myClan().emblem, emblem);
});

test('criar clã sem escolha usa o emblema da tag; escolha inválida é recusada', () => {
    assert.ok(createClan(base).ok);
    assert.deepEqual(myClan().emblem, defaultEmblem('TST'));
    leaveClan();
    const bad = createClan({ ...base, tag: 'BAD', emblem: { shape: 'circulo', pattern: 'plain', palette: 'classic' } });
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.emblemShape);
});

test('o líder troca o emblema; quem não lidera não troca', () => {
    createClan(base);
    const next = { shape: 'octagon', pattern: 'quarters', palette: 'bone' };
    assert.ok(setClanEmblem(next).ok);
    assert.deepEqual(myClan().emblem, next);
    assert.equal(setClanEmblem({ ...next, palette: 'roxo' }).ok, false, 'só as cores da marca');

    leaveClan();
    saveClanMembership({ clanId: 'bloco', role: 'member', via: 'invite' });
    const denied = setClanEmblem(next);
    assert.equal(denied.ok, false);
    assert.match(denied.reason, /líder/);
});

test('cada clã semeado tem um emblema válido', () => {
    for (const clan of CLANS) {
        assert.ok(EMBLEM_SHAPES[clan.emblem.shape], clan.id);
        assert.ok(EMBLEM_PATTERNS[clan.emblem.pattern], clan.id);
        assert.ok(EMBLEM_PALETTES[clan.emblem.palette], clan.id);
    }
});
