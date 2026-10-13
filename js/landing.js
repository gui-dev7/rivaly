/**
 * landing.js — controller for the marketing page.
 *
 * Renders the three data-driven sections and plays the hero Passport
 * assembly sequence. The demo profile shown in the hero is a fixed,
 * hand-authored example — it is not random and it is not the user's.
 */

import { bootPublic, afterRender } from './app.js';
import { gameMarkMarkup } from './cards.js';
import { icon, escapeHtml, avatarSvg, formatNumber } from './ui.js';
import { DNA_ATTRIBUTES, ROADMAP, getGameById } from './data.js';
import { WEIGHTS } from './compatibility.js';
import { countUp, runSequence, initStickyHeader, prefersReducedMotion, wait } from './animations.js';

bootPublic();

/* ============================================================
   FEATURES
   ============================================================ */

const FEATURES = [
    {
        icon: 'id', title: 'Passaporte Gamer',
        text: 'Apelido, plataformas, arquétipo, nível, medalhas e reputação. Um só registro que evolui sempre que você usa o produto.',
        tag: 'Essencial',
    },
    {
        icon: 'dna', title: 'DNA Gamer',
        text: 'Dez perguntas, seis atributos comportamentais e um arquétipo. As mesmas respostas sempre geram o mesmo resultado.',
        tag: 'Comportamental',
    },
    {
        icon: 'library', title: 'Biblioteca de Jogos',
        text: 'Adicione jogos, avalie e registre horas. Mova títulos entre Jogando, Zerado, Fila, Abandonado e Lista de desejos arrastando ou usando o teclado.',
        tag: 'Acompanhamento',
    },
    {
        icon: 'users', title: 'Buscar Squad',
        text: 'Filtre por jogo, rank, horário, estilo de jogo, função e chat de voz. Acompanhe a análise e o ranqueamento dos jogadores.',
        tag: 'Social',
    },
    {
        icon: 'target', title: 'Motor de Compatibilidade',
        text: 'Sete fatores ponderados, uma nota de 0 a 100 e a conta por trás de cada ponto ganho ou perdido.',
        tag: 'Algoritmo',
    },
    {
        icon: 'trophy', title: 'Progressão',
        text: 'XP por ações reais. Uma curva de níveis progressiva, vinte medalhas em cinco raridades e uma Pontuação Gamer no topo.',
        tag: 'Gamificação',
    },
];

const JOURNEY = [
    { title: 'Crie sua conta', text: 'Cadastro local e acadêmico. Nada sai do seu navegador.', icon: 'user' },
    { title: 'Responda ao teste de DNA', text: 'Dez perguntas sobre como você joga, não sobre o que possui.', icon: 'dna' },
    { title: 'Descubra seu arquétipo', text: 'Seis atributos recebem uma pontuação e definem um entre onze arquétipos.', icon: 'spark' },
    { title: 'Construa e encontre', text: 'Preencha a biblioteca, ganhe XP, desbloqueie medalhas e encontre seu squad.', icon: 'layers' },
];

function renderFeatures() {
    const host = document.getElementById('featureGrid');
    if (!host) return;
    host.innerHTML = FEATURES.map((feature, index) => `
        <article class="feature" data-reveal data-reveal-delay="${index * 70}">
            <span class="feature__icon">${icon(feature.icon, { size: 22 })}</span>
            <div class="feature__body">
                <div class="feature__head">
                    <h3 class="feature__title">${escapeHtml(feature.title)}</h3>
                    <span class="tag">${escapeHtml(feature.tag)}</span>
                </div>
                <p class="feature__text">${escapeHtml(feature.text)}</p>
            </div>
        </article>
    `).join('');
}

function renderJourney() {
    const host = document.getElementById('journeySteps');
    if (!host) return;
    host.innerHTML = JOURNEY.map((step, index) => `
        <li class="journey__step" data-reveal data-reveal-delay="${index * 90}">
            <span class="journey__index numeric">${String(index + 1).padStart(2, '0')}</span>
            <span class="journey__icon">${icon(step.icon, { size: 18 })}</span>
            <h3 class="journey__title">${escapeHtml(step.title)}</h3>
            <p class="journey__text">${escapeHtml(step.text)}</p>
        </li>
    `).join('');
}

function renderWeights() {
    const host = document.getElementById('weightList');
    if (!host) return;

    const labels = {
        game: 'Compatibilidade de jogo',
        rank: 'Proximidade de rank',
        schedule: 'Compatibilidade de horários',
        playstyle: 'Compatibilidade de estilo de jogo',
        role: 'Complementaridade de função',
        communication: 'Comunicação',
        reputation: 'Reputação',
    };

    host.innerHTML = Object.entries(WEIGHTS).map(([key, weight]) => `
        <div class="weights__row">
            <span class="weights__label">${escapeHtml(labels[key] ?? key)}</span>
            <span class="weights__track">
                <span class="weights__fill" data-progress="${(weight / 20) * 100}"></span>
            </span>
            <span class="weights__value numeric">${weight}%</span>
        </div>
    `).join('') + `<p class="weights__total"><span>Total</span><span class="numeric">100%</span></p>`;
}

function renderRoteiro() {
    const host = document.getElementById('roadmapList');
    if (!host) return;
    host.innerHTML = ROADMAP.map((item, index) => `
        <article class="roadmap__item" data-reveal data-reveal-delay="${index * 70}">
            <div class="roadmap__head">
                <h3 class="roadmap__title">${escapeHtml(item.title)}</h3>
                <span class="tag ${item.status === 'next' ? 'tag--primary' : ''}">${item.status === 'next' ? 'Em breve' : 'Em estudo'}</span>
            </div>
            <p class="roadmap__text">${escapeHtml(item.text)}</p>
        </article>
    `).join('');
}

/* ============================================================
   HERO PASSPORT SEQUENCE
   A fixed demo profile assembled step by step, so the visitor sees
   what a finished Passport looks like before creating one.
   ============================================================ */

const DEMO = {
    gamerId: 'HG-4927-XA',
    nickname: 'NOVA_7',
    archetype: 'O Estrategista',
    level: 27,
    avatarSeed: 'nova-7-demo',
    games: ['valorant', 'cs2', 'minecraft'],
    dna: { competitive: 82, social: 78, explorer: 73, strategist: 96, achiever: 78, collector: 41 },
    reputation: 94,
    score: 18420,
    badges: 17,
};

function heroNode(name) {
    return document.querySelector(`[data-hero="${name}"]`);
}

async function playHeroSequence() {
    const card = document.getElementById('heroPassport');
    if (!card) return;

    const gamesHost = heroNode('games');
    const dnaHost = heroNode('dna');

    // Pre-build the DNA rows at zero so the layout never jumps.
    dnaHost.innerHTML = DNA_ATTRIBUTES.map((attribute) => `
        <div class="dna-bar" data-dna="${attribute.id}" style="--dna-color:${attribute.color}">
            <span class="dna-bar__label">${escapeHtml(attribute.label)}</span>
            <span class="dna-bar__track"><span class="dna-bar__fill"></span></span>
            <span class="dna-bar__value numeric">0</span>
        </div>
    `).join('');

    const steps = [
        {
            run: () => {
                heroNode('avatar').innerHTML = avatarSvg(DEMO.avatarSeed, { size: 52 });
                heroNode('avatar').classList.add('is-in');
            },
            wait: 260,
        },
        {
            run: () => {
                heroNode('id').textContent = DEMO.gamerId;
                heroNode('nick').textContent = DEMO.nickname;
                heroNode('nick').classList.add('is-in');
            },
            wait: 220,
        },
        {
            run: () => countUp(heroNode('level'), DEMO.level, { duration: 700 }),
            wait: 120,
        },
        {
            run: () => {
                heroNode('archetype').textContent = DEMO.archetype;
                heroNode('archetype').classList.add('is-in');
            },
            wait: 260,
        },
        {
            run: async () => {
                for (const gameId of DEMO.games) {
                    const game = getGameById(gameId);
                    if (!game) continue;
                    const item = document.createElement('li');
                    item.className = 'passport-card__game';
                    item.innerHTML = `
                        ${gameMarkMarkup(game)}
                        <span class="passport-card__game-title">${escapeHtml(game.title)}</span>
                    `;
                    gamesHost.appendChild(item);
                    // eslint-disable-next-line no-await-in-loop -- staggered reveal
                    await wait(prefersReducedMotion() ? 0 : 140);
                }
            },
            wait: 200,
        },
        {
            run: async () => {
                for (const attribute of DNA_ATTRIBUTES) {
                    const row = dnaHost.querySelector(`[data-dna="${attribute.id}"]`);
                    const value = DEMO.dna[attribute.id];
                    row.querySelector('.dna-bar__fill').style.transform = `scaleX(${value / 100})`;
                    countUp(row.querySelector('.dna-bar__value'), value, { duration: 800 });
                    // eslint-disable-next-line no-await-in-loop -- staggered reveal
                    await wait(prefersReducedMotion() ? 0 : 110);
                }
            },
            wait: 320,
        },
        {
            run: () => {
                countUp(heroNode('reputation'), DEMO.reputation, { duration: 700 });
                countUp(heroNode('score'), DEMO.score, { duration: 1100 });
                countUp(heroNode('badges'), DEMO.badges, { duration: 700 });
                card.classList.add('is-complete');
            },
        },
    ];

    await runSequence(steps);
}

/* ============================================================
   BOOT
   ============================================================ */

renderFeatures();
renderJourney();
renderWeights();
renderRoteiro();
initStickyHeader(document.getElementById('siteHeader'));

// Re-run reveal + bar animation now that the sections exist.
afterRender(document);

playHeroSequence();

/* Smooth in-page navigation without hijacking the URL or the back button. */
document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    // Keep the keyboard focus with the visual position.
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
});

/* ============================================================
   VITRINE DE CAPTURAS

   Alterna entre prints reais do produto. Roda sozinha para quem
   so passa o olho, e para assim que a pessoa assume o controle —
   uma vitrine que continua girando enquanto voce le e irritante.
   ============================================================ */
const showcase = document.getElementById('showcase');

if (showcase) {
    const tabs = [...showcase.querySelectorAll('[data-shot]')];
    const shots = [...showcase.querySelectorAll('[data-shot-img]')];
    const label = showcase.querySelector('[data-shot-label]');

    let index = 0;
    let timer = null;

    const show = (next) => {
        index = (next + tabs.length) % tabs.length;
        const id = tabs[index].dataset.shot;

        tabs.forEach((tab) => {
            const on = tab.dataset.shot === id;
            tab.classList.toggle('is-active', on);
            tab.setAttribute('aria-selected', String(on));
        });
        shots.forEach((img) => img.classList.toggle('is-active', img.dataset.shotImg === id));
        if (label) label.textContent = tabs[index].textContent.trim();
    };

    const stop = () => {
        if (timer) window.clearInterval(timer);
        timer = null;
    };

    const start = () => {
        // Rotacao automatica e movimento: quem pediu menos movimento nao recebe.
        if (prefersReducedMotion() || timer) return;
        timer = window.setInterval(() => show(index + 1), 4500);
    };

    tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => {
            stop();
            show(i);
        });
    });

    showcase.addEventListener('mouseenter', stop);
    showcase.addEventListener('focusin', stop);

    // So gira quando esta visivel: rodar fora da tela gasta CPU a toa.
    if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
            entries.forEach((entry) => (entry.isIntersecting ? start() : stop()));
        }, { threshold: 0.35 }).observe(showcase);
    } else {
        start();
    }
}
