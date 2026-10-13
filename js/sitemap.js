/**
 * sitemap.js — controller do Mapa do site.
 *
 * Renderiza a árvore a partir do SITE_MAP (a mesma fonte da navegação)
 * e filtra em tempo real: cada tecla no campo de busca roda um filter()
 * no array achatado e redesenha a lista, com contador e estado vazio.
 *
 * A página é pública. Sem sessão, os links para áreas internas levam ao
 * login com retorno (login.html?redirect=...).
 */

import { bootHybrid } from './app.js';
import { SITE_MAP, flattenSiteMap } from './site-map.js';
import { $, escapeHtml, icon, emptyStateMarkup } from './ui.js';

const user = bootHybrid({
    page: 'sitemap',
    title: 'Mapa do site',
    subtitle: 'Todas as páginas da RIVALY',
});
const signedIn = Boolean(user);

const ALL_NODES = flattenSiteMap();

/** Sem sessão, uma página interna passa pelo login e volta para cá. */
function hrefFor(node) {
    if (signedIn || node.auth === false) return node.href;
    return `login.html?mode=signin&redirect=${encodeURIComponent(node.href)}`;
}

function lockNote(node) {
    return !signedIn && node.auth !== false
        ? `<span class="sitemap-lock">${icon('lock', { size: 11 })} entre para abrir</span>`
        : '';
}

/* ============================================================
   ÁRVORE COMPLETA
   ============================================================ */

function treeMarkup() {
    return `<ul class="sitemap-tree">${SITE_MAP.map((group) => `
        <li class="sitemap-group">
            <h3 class="sitemap-group__title">${escapeHtml(group.title)}</h3>
            <p class="sitemap-group__desc">${escapeHtml(group.description)}</p>
            <ul class="sitemap-pages">${group.children.map((page) => `
                <li class="sitemap-page">
                    <a class="sitemap-link" href="${escapeHtml(hrefFor(page))}">
                        ${icon(page.icon ?? 'chevron-right', { size: 16, className: 'sitemap-link__icon' })}
                        <span class="sitemap-link__title">${escapeHtml(page.title)}</span>
                        ${lockNote(page)}
                    </a>
                    <p class="sitemap-page__desc">${escapeHtml(page.description)}</p>
                    ${page.children?.length ? `<ul class="sitemap-sections">${page.children.map((child) => `
                        <li>
                            <a class="sitemap-sub" href="${escapeHtml(hrefFor({ ...child, auth: page.auth }))}">${escapeHtml(child.title)}</a>
                            <span class="sitemap-sub__desc">${escapeHtml(child.description)}</span>
                        </li>`).join('')}</ul>` : ''}
                </li>`).join('')}
            </ul>
        </li>`).join('')}
    </ul>`;
}

/* ============================================================
   RESULTADOS DA BUSCA
   ============================================================ */

const normalize = (text) => String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function search(query) {
    const needle = normalize(query.trim());
    if (!needle) return ALL_NODES;
    return ALL_NODES.filter((node) =>
        [node.title, node.description, node.groupTitle, node.parentTitle].some((field) => normalize(field).includes(needle))
    );
}

function resultsMarkup(results) {
    return `<ul class="sitemap-results">${results.map((node) => `
        <li class="sitemap-result">
            <p class="sitemap-result__path">${escapeHtml(node.groupTitle)}${node.depth === 2 ? ` › ${escapeHtml(node.parentTitle)}` : ''}</p>
            <a class="sitemap-link" href="${escapeHtml(hrefFor(node))}">
                ${icon(node.icon ?? 'chevron-right', { size: 16, className: 'sitemap-link__icon' })}
                <span class="sitemap-link__title">${escapeHtml(node.title)}</span>
                ${lockNote(node)}
            </a>
            <p class="sitemap-page__desc">${escapeHtml(node.description)}</p>
        </li>`).join('')}
    </ul>`;
}

/* ============================================================
   RENDER
   ============================================================ */

const input = $('#sitemapSearch');
const count = $('#sitemapCount');
const tree = $('#sitemapTree');

function render() {
    const query = input.value;
    const pagesTotal = ALL_NODES.filter((node) => node.depth === 1).length;

    if (!query.trim()) {
        tree.innerHTML = treeMarkup();
        count.textContent = `${pagesTotal} páginas e ${ALL_NODES.length - pagesTotal} seções.`;
        return;
    }

    const results = search(query);
    count.textContent = `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'} para “${query.trim()}”.`;
    tree.innerHTML = results.length
        ? resultsMarkup(results)
        : emptyStateMarkup({
            iconName: 'search',
            title: `Nada encontrado para “${query.trim()}”.`,
            text: 'Tente uma tarefa, como "rating", "candidatura" ou "biblioteca", ou limpe a busca para ver a árvore inteira.',
            action: '<button type="button" class="btn btn-outline-light btn-sm" data-clear>Limpar busca</button>',
        });
}

input.addEventListener('input', render);
$('#sitemapSearchForm').addEventListener('submit', (event) => event.preventDefault());
$('#sitemapSearchForm').addEventListener('reset', () => window.setTimeout(() => {
    render();
    input.focus();
}, 0));
tree.addEventListener('click', (event) => {
    if (event.target.closest('[data-clear]')) $('#sitemapSearchForm').reset();
});

// Esc limpa a busca enquanto o campo tem foco. O "search" cobre o X
// nativo do campo de busca, que limpa sem disparar "input".
input.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !input.value) return;
    event.preventDefault();
    input.value = '';
    render();
});
input.addEventListener('search', render);

if (!signedIn) {
    const note = $('#authNote');
    note.hidden = false;
    note.innerHTML = `${icon('info', { size: 13 })} Você está navegando sem entrar. As páginas internas levam ao login e voltam para onde você queria ir.`;
}

render();
