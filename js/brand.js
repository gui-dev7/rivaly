/**
 * brand.js — arte da marca que acompanha o tema.
 *
 * Cada tema tem sua propria versao colorida do icone e do logo. Em vez de
 * espalhar o caminho da imagem por varios arquivos, tudo passa por aqui:
 * qualquer elemento marcado com `data-brand="icon"` ou `data-brand="logo"`
 * recebe o arquivo do tema atual, e o favicon acompanha junto.
 *
 * Os ids de tema sao os mesmos usados em css/variables.css e nas
 * configuracoes — se um tema novo entrar la, basta soltar os PNGs em
 * public/assets/brand/ seguindo o padrao `icon-<tema>.png` / `logo-<tema>.png`.
 */

const BASE = '/assets/brand';

export const BRAND_THEMES = ['rivaly', 'marrom-rosa', 'azul-verde', 'preto-vermelho'];

/** Caminho da arte para um tema, com queda para a identidade padrao. */
export function brandArt(kind, theme = 'rivaly') {
    const safe = BRAND_THEMES.includes(theme) ? theme : 'rivaly';
    return `${BASE}/${kind}-${safe}.png`;
}

/**
 * Troca toda a arte da marca ja presente na pagina.
 * Idempotente: pode ser chamada a cada troca de tema.
 */
export function applyBrandArt(theme = 'rivaly') {
    const icon = brandArt('icon', theme);
    const logo = brandArt('logo', theme);

    document.querySelectorAll('[data-brand="icon"]').forEach((node) => {
        if (node.getAttribute('src') !== icon) node.src = icon;
    });

    document.querySelectorAll('[data-brand="logo"]').forEach((node) => {
        if (node.getAttribute('src') !== logo) node.src = logo;
    });

    // A aba do navegador tambem faz parte da identidade.
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.type = 'image/png';
    if (link.getAttribute('href') !== icon) link.href = icon;
}
