/**
 * sync-chrome.mjs — grava a "moldura" de cada página a partir do SITE_MAP.
 *
 *   node tools/sync-chrome.mjs
 *
 * A navegação da RIVALY é markup Bootstrap de verdade dentro de cada HTML
 * (navbar, offcanvas, barra inferior e rodapé), para que a estrutura fique
 * visível no código-fonte. Escrever esse markup à mão em quinze páginas
 * garantiria que, em algum momento, uma delas ficasse diferente das outras.
 *
 * Este script resolve isso: lê js/site-map.js (a fonte única) e substitui,
 * em cada página, apenas o que estiver entre marcadores como
 *
 *   <!-- chrome:app-nav:start --> ... <!-- chrome:app-nav:end -->
 *
 * Páginas sem um marcador simplesmente não recebem aquele bloco. O script é
 * idempotente: rodar duas vezes produz o mesmo arquivo. Nada disso roda no
 * navegador; em tempo de execução, js/navigation.js só marca a página atual
 * (aria-current) e preenche o que depende do usuário (XP, convites).
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NAV_GROUPS, SITE_PAGES, BOTTOM_NAV_IDS, creditsLine, pageById } from '../js/site-map.js';
import { icon } from '../js/ui.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ============================================================
   BLOCOS
   ============================================================ */

/** A marca (ícone + nome), recuada para ficar dentro do <a> que a envolve. */
const brand = (pad = '    ', sub = 'Rival + Ally') => `
${pad}<span class="brand-mark" aria-hidden="true"><img class="brand-mark__img" data-brand="icon" src="/assets/brand/icon-rivaly.png" alt="" width="32" height="32" decoding="async"></span>
${pad}<span class="brand-name">
${pad}    <span class="brand-name__top">RIVALY</span>
${pad}    <span class="brand-name__sub">${sub}</span>
${pad}</span>`;

function stylesBlock({ absolute }) {
    const p = (path) => (absolute ? `/${path}` : path);
    return [
        'vendor/bootstrap/bootstrap.min.css',
        'css/fonts.css',
        'css/bootstrap-theme.css',
        'css/variables.css',
        'css/reset.css',
        'css/global.css',
        'css/animations.css',
        'css/components.css',
        'css/layout.css',
        'css/community.css',
        'css/pages/avatar.css',
    ].map((href) => `<link rel="stylesheet" href="${p(href)}">`).join('\n');
}

function scriptsBlock({ absolute }) {
    // O aviso de file:// precisa de caminho relativo: sob file:// um caminho
    // absoluto apontaria para a raiz do disco. A 404 nunca é aberta assim.
    const lines = [];
    if (!absolute) lines.push('<script src="js/protocol-check.js"></script>');
    lines.push('<script src="/vendor/bootstrap/bootstrap.bundle.min.js"></script>');
    return lines.join('\n');
}

function appNavBlock() {
    const pad = ' '.repeat(16);
    const groups = NAV_GROUPS.map((group) => `
${pad}<p class="sidebar__group-label" id="navGroup-${group.id}">${group.title}</p>
${pad}<ul class="nav flex-column sidebar__list" aria-labelledby="navGroup-${group.id}">
${group.children.map((page) => `${pad}    <li class="nav-item">
${pad}        <a class="nav-link sidebar__link" href="${page.href}" data-nav-id="${page.id}">
${pad}            ${icon(page.icon, { size: 17, className: 'sidebar__icon' })}
${pad}            <span>${page.title}</span>
${pad}        </a>
${pad}    </li>`).join('\n')}
${pad}</ul>`).join('\n');

    return `<aside class="sidebar-shell" aria-label="Navegação principal">
    <div class="sidebar offcanvas-lg offcanvas-start" tabindex="-1" id="appNav" aria-labelledby="appNavTitle">
        <div class="offcanvas-header sidebar__header">
            <a class="sidebar__brand" href="dashboard.html" aria-label="RIVALY, ir para o Início">${brand('                ')}
            </a>
            <h2 class="visually-hidden" id="appNavTitle">Menu da RIVALY</h2>
            <button type="button" class="btn-close" data-bs-dismiss="offcanvas" data-bs-target="#appNav" aria-label="Fechar menu"></button>
        </div>
        <div class="offcanvas-body sidebar__body">
            <a class="sidebar__brand d-none d-lg-flex" href="dashboard.html" aria-label="RIVALY, ir para o Início">${brand('                ')}
            </a>
            <nav class="sidebar__nav" aria-label="Seções do app">${groups}
            </nav>
            <div class="sidebar__footer" data-mini-passport></div>
        </div>
    </div>
</aside>`;
}

function topbarBlock() {
    return `<header class="topbar navbar" data-topbar>
    <button type="button" class="menu-toggle d-lg-none" data-bs-toggle="offcanvas" data-bs-target="#appNav" aria-controls="appNav" aria-label="Abrir menu">
        ${icon('menu', { size: 17 })}
    </button>
    <div class="topbar__heading">
        <p class="topbar__title" data-topbar-title>RIVALY</p>
        <p class="topbar__subtitle" data-topbar-subtitle></p>
    </div>
    <div class="topbar__actions">
        <div class="topbar__xp d-none d-md-flex" title="Experiência até o próximo nível">
            <span class="level-pill">
                <span class="level-pill__num numeric" data-xp-level>1</span>
                <span class="level-pill__label">Nível</span>
            </span>
            <span class="progress progress--thin progress--xp topbar__xp-bar" role="progressbar" aria-label="Progresso até o próximo nível" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-xp-bar>
                <span class="progress__fill" data-progress="0"></span>
            </span>
            <span class="topbar__xp-text numeric" data-xp-text>0/1.000</span>
        </div>
        <div class="dropdown invites" data-invites>
            <button type="button" class="btn btn-outline-light btn-icon invites__toggle" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false" aria-label="Centro de convites">
                ${icon('bell', { size: 16 })}
                <span class="badge invites__count" data-invites-count hidden>0</span>
            </button>
            <div class="dropdown-menu dropdown-menu-end invites__menu" data-invites-menu>
                <p class="dropdown-header invites__title">Convites e desafios</p>
                <div class="invites__list" data-invites-list></div>
            </div>
        </div>
        <button type="button" class="btn btn-outline-light btn-icon" data-logout aria-label="Sair da conta">
            ${icon('logout', { size: 15 })}
        </button>
    </div>
</header>`;
}

function bottomNavBlock() {
    const items = BOTTOM_NAV_IDS.map(pageById).filter(Boolean).map((page) => `    <a class="bottom-nav__item" href="${page.href}" data-nav-id="${page.id}">
        ${icon(page.icon, { size: 19 })}
        <span>${page.short ?? page.title}</span>
    </a>`).join('\n');

    return `<nav class="bottom-nav d-lg-none" aria-label="Navegação rápida">
${items}
    <button type="button" class="bottom-nav__item" data-bs-toggle="offcanvas" data-bs-target="#appNav" aria-controls="appNav">
        ${icon('grid', { size: 19 })}
        <span>Mais</span>
    </button>
</nav>`;
}

function publicHeaderBlock({ absolute }) {
    const p = (href) => (absolute ? `/${href}` : href);
    return `<nav class="navbar navbar-expand-md site-header public-header" aria-label="Navegação pública">
    <div class="container-fluid site-header__inner">
        <a class="navbar-brand sidebar__brand" href="${p('index.html')}" aria-label="Página inicial da RIVALY">${brand('            ')}
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#publicNav" aria-controls="publicNav" aria-expanded="false" aria-label="Abrir menu">
            ${icon('menu', { size: 18 })}
        </button>
        <div class="collapse navbar-collapse" id="publicNav">
            <ul class="navbar-nav ms-md-4 me-auto">
                <li class="nav-item"><a class="nav-link" href="${p('index.html')}" data-nav-id="home">Início</a></li>
                <li class="nav-item"><a class="nav-link" href="${p('sitemap.html')}" data-nav-id="sitemap">Mapa do site</a></li>
            </ul>
            <div class="d-flex flex-wrap gap-2 py-2 py-md-0">
                <a class="btn btn-outline-light btn-sm" href="${p('login.html?mode=signin')}">Entrar</a>
                <a class="btn btn-primary btn-sm" href="${p('login.html?mode=create')}">Criar meu Passaporte</a>
            </div>
        </div>
    </div>
</nav>`;
}

function footerBlock({ absolute }) {
    const p = (href) => (absolute ? `/${href}` : href);
    const columns = NAV_GROUPS.map((group) => `
            <nav class="col-6 col-md-3 col-lg-2" aria-labelledby="footGroup-${group.id}">
                <p class="site-footer__heading" id="footGroup-${group.id}">${group.title}</p>
                <ul class="list-unstyled site-footer__links">
${group.children.map((page) => `                    <li><a href="${p(page.href)}">${page.title}</a></li>`).join('\n')}
                </ul>
            </nav>`).join('');

    return `<footer class="site-footer">
    <div class="container-fluid site-footer__inner">
        <div class="row g-4">
            <div class="col-12 col-lg-4">
                <img class="site-footer__logo" data-brand="logo" src="/assets/brand/logo-rivaly.png" alt="RIVALY" width="132" height="44" loading="lazy" decoding="async">
                <p class="site-footer__tagline">Find allies. Meet rivals.</p>
                <p class="site-footer__note">Sua identidade gamer em um só lugar. Tudo fica salvo neste navegador.</p>
            </div>${columns}
        </div>
        <div class="site-footer__bottom">
            <p class="site-footer__credits">${creditsLine()} · <a href="${p('sitemap.html')}">Mapa do site</a></p>
            <p class="site-footer__legal">Projeto acadêmico. As artes dos jogos pertencem aos seus detentores.</p>
        </div>
    </div>
</footer>`;
}

const BLOCKS = {
    styles: stylesBlock,
    scripts: scriptsBlock,
    'app-nav': appNavBlock,
    topbar: topbarBlock,
    'bottom-nav': bottomNavBlock,
    'public-header': publicHeaderBlock,
    footer: footerBlock,
};

/* ============================================================
   APLICAÇÃO
   ============================================================ */

function indentLike(block, indent) {
    return block
        .split('\n')
        .map((line) => (line.trim() ? indent + line : line))
        .join('\n');
}

function syncFile(file) {
    const path = resolve(ROOT, file);
    const original = readFileSync(path, 'utf8');
    const absolute = file === '404.html';
    let html = original;

    Object.entries(BLOCKS).forEach(([name, build]) => {
        const pattern = new RegExp(
            `([ \\t]*)<!-- chrome:${name}:start -->[\\s\\S]*?<!-- chrome:${name}:end -->`,
            'g'
        );
        html = html.replace(pattern, (match, indent) => {
            const body = indentLike(build({ absolute }), indent);
            return `${indent}<!-- chrome:${name}:start -->\n${body}\n${indent}<!-- chrome:${name}:end -->`;
        });
    });

    // Bootstrap em modo escuro de verdade: os componentes leem as variáveis
    // do tema a partir deste atributo.
    html = html.replace(/<html lang="pt-BR"([^>]*)>/, (match, attrs) => {
        const clean = attrs.replace(/\s*data-bs-theme="[^"]*"/, '');
        return `<html lang="pt-BR"${clean} data-bs-theme="dark">`;
    });

    if (html !== original) {
        writeFileSync(path, html);
        return true;
    }
    return false;
}

const pages = readdirSync(ROOT).filter((name) => name.endsWith('.html'));
const changed = pages.filter(syncFile);

console.log(`chrome sincronizado a partir do SITE_MAP (${SITE_PAGES.length} páginas no mapa).`);
console.log(changed.length ? `Atualizados: ${changed.join(', ')}` : 'Nenhuma mudança.');
