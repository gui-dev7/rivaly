/**
 * not-found.js — a página 404.
 *
 * Só ajusta a saída principal: quem tem sessão volta para o próprio
 * Início (dashboard); quem não tem, para a página pública.
 */

import { bootPublic } from './app.js';
import { isAuthenticated } from './auth.js';

bootPublic();

if (isAuthenticated()) {
    const home = document.getElementById('homeLink');
    home.href = '/dashboard.html';
    home.textContent = 'Voltar para o meu Início';
}
