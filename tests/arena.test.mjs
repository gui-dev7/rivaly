import './setup.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { seedUser } from './helpers.mjs';
import { getArena, saveArena, getSessions, LIMITS } from '../js/storage.js';
import {
    kFactor, expectedScore, calculateWinChance, ratingDeltas, updateRating, tierFor, nextTier, tierProgress,
    arenaState, previewDuel, playDuel, playSquadMatch, previewSquadMatch, previewClanMatch, playClanMatch,
    renderRankingData, matchHistory, START_RATING, SEASON_POINTS,
} from '../js/arena-store.js';
import { playSession } from '../js/sessions.js';
import { createClan } from '../js/clans-store.js';
import { currentWeekKey } from '../js/rng.js';

beforeEach(() => seedUser());

test('fórmulas Elo: expectativa, K e deltas', () => {
    assert.equal(expectedScore(1000, 1000), 0.5);
    assert.ok(Math.abs(expectedScore(1200, 1000) + expectedScore(1000, 1200) - 1) < 1e-12);
    assert.ok(Math.abs(expectedScore(1400, 1000) - 1 / (1 + 10 ** (-400 / 400))) < 1e-12);
    assert.equal(calculateWinChance(1000, 1000), 0.5);

    assert.equal(kFactor(0), 40);
    assert.equal(kFactor(9), 40);
    assert.equal(kFactor(10), 32);

    const deltas = ratingDeltas(1000, 1000, 0);
    assert.deepEqual([deltas.win, deltas.loss], [20, -20]);
    const late = ratingDeltas(1000, 1000, 10);
    assert.deepEqual([late.win, late.loss], [16, -16]);

    assert.equal(updateRating(1000, 1000, 0, true).after, 1020);
    assert.equal(updateRating(1000, 1000, 0, false).after, 980);
});

test('tiers: limites e progresso, terminando em Lenda', () => {
    assert.equal(tierFor(899).id, 'bronze');
    assert.equal(tierFor(900).id, 'silver');
    assert.equal(tierFor(START_RATING).label, 'Prata');
    assert.equal(tierFor(1699).id, 'diamond');
    assert.equal(tierFor(1700).label, 'Lenda');
    assert.equal(nextTier(1700), null);
    assert.equal(tierProgress(1000).remaining, 100);
    assert.equal(tierProgress(1800).percent, 100);
});

test('duelo: prévia mostra a conta e a partida aplica rating, temporada e histórico', () => {
    const prev = previewDuel('p13');
    assert.ok(prev.chance > 0 && prev.chance < 1);
    assert.ok(prev.reasons.some((line) => line.startsWith('Expectativa')));

    const match = playDuel('p13');
    const arena = getArena();
    assert.equal(arena.matches, 1);
    assert.equal(arena.rating, match.rating.after);
    assert.equal(arena.rating - START_RATING, match.won ? prev.winDelta : prev.lossDelta);
    assert.equal(arena.season.points, match.won ? SEASON_POINTS.win : SEASON_POINTS.loss);
    assert.equal(matchHistory()[0].id, match.id);
    assert.ok(match.reasons.some((line) => line.startsWith('Sorteio determinístico')));
});

test('a mesma situação gera o mesmo resultado (determinístico)', () => {
    const first = playDuel('p13');
    seedUser();
    const second = playDuel('p13');
    assert.equal(first.won, second.won);
    assert.equal(first.draw, second.draw);
    assert.deepEqual(first.rating, second.rating);
});

test('virada de semana zera a temporada e mantém o rating', () => {
    saveArena({ ...getArena(), rating: 1234, season: { week: '2000-W01', points: 30, wins: 10, losses: 0 } });
    const state = arenaState();
    assert.equal(state.rating, 1234);
    assert.equal(state.season.week, currentWeekKey());
    assert.equal(state.season.points, 0);
});

test('histórico tem limite de entradas', () => {
    const history = Array.from({ length: LIMITS.arenaHistory + 15 }, (_, i) => ({ id: `m${i}` }));
    saveArena({ ...getArena(), history });
    assert.equal(getArena().history.length, LIMITS.arenaHistory);
    assert.equal(getArena().history[0].id, 'm0', 'os mais recentes ficam');
});

test('partida de squad usa uma sessão uma vez só', () => {
    const outcome = playSession({ gameId: 'valorant', teammateIds: ['p03', 'p22'], mode: 'chosen' });
    assert.ok(outcome.ok);
    const sessionId = outcome.session.id;
    assert.ok(previewSquadMatch(sessionId));
    const match = playSquadMatch(sessionId);
    assert.ok(match);
    assert.equal(getSessions().find((s) => s.id === sessionId).arenaPlayed, true);
    assert.equal(previewSquadMatch(sessionId), null, 'a mesma sessão não volta para a Arena');
    assert.equal(playSquadMatch(sessionId), null);
    assert.equal(getArena().matches, 1);
});

test('Clã vs Clã exige clã e usa a média dos 3 melhores', () => {
    assert.equal(previewClanMatch('gol'), null);
    assert.equal(playClanMatch('gol'), null);
    const created = createClan({ name: 'Time Teste', tag: 'TST', focusGame: 'valorant', playstyle: 'competitive', policy: 'open', motto: '', minRank: 'Unranked' });
    assert.ok(created.ok);
    const prev = previewClanMatch('gol');
    assert.ok(prev);
    assert.ok(prev.reasons.some((line) => line.includes('média dos 3 melhores')));
    assert.ok(playClanMatch('gol'));
});

test('ranking: ordenado por pontos, sua linha marcada, filtro por jogo', () => {
    const rows = renderRankingData({ tab: 'players' });
    assert.ok(rows.some((row) => row.isMe));
    for (let i = 1; i < rows.length; i += 1) {
        assert.ok(rows[i - 1].points > rows[i].points || (rows[i - 1].points === rows[i].points && rows[i - 1].rating >= rows[i].rating));
    }
    assert.deepEqual(rows.map((row) => row.position), rows.map((_, i) => i + 1));

    const rl = renderRankingData({ tab: 'players', gameId: 'rocket-league' });
    assert.ok(rl.every((row) => row.isMe || row.player.games.includes('rocket-league')));
    assert.ok(!rl.some((row) => row.isMe), 'o usuário não joga Rocket League, então fica fora desse filtro');

    const clans = renderRankingData({ tab: 'clans' });
    assert.equal(clans.length, 7);
});
