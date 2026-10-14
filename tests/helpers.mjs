/**
 * helpers.mjs — um Passaporte pronto para os testes.
 */

import { resetStorage } from './setup.mjs';
import { initStorage, saveUser, saveSession, getUser } from '../js/storage.js';
import { createUser } from '../js/profile.js';

/**
 * Limpa o armazenamento e grava um Passaporte completo, parecido com o de
 * quem terminou o onboarding. Campos podem ser trocados por `overrides`.
 */
export function seedUser(overrides = {}) {
    resetStorage();
    initStorage();
    const user = createUser({ nickname: 'Teste', email: 'teste@exemplo.com' });
    Object.assign(user, {
        // Fixo: o gamerId entra nas sementes do motor, e com a data de
        // criação no meio os resultados mudariam a cada execução.
        gamerId: 'RV-TEST-0001',
        onboardingComplete: true,
        rank: 'Diamond',
        region: 'South America',
        playstyle: 'competitive',
        schedules: ['night', 'evening'],
        roles: ['support'],
        languages: ['pt', 'en'],
        platforms: ['pc'],
        favoriteGenres: ['FPS'],
        currentGames: ['valorant', 'cs2'],
        voiceChat: true,
        bio: 'Suporte que joga à noite.',
        ...overrides,
    });
    saveUser(user);
    saveSession({ accountId: 'acc-test', startedAt: new Date().toISOString() });
    return getUser();
}
