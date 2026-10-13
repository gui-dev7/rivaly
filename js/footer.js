/**
 * footer.js — rodape institucional com redes sociais.
 *
 * O rodape e injetado por JS para existir em uma unica fonte: adicionar
 * uma rede ou trocar a logo acontece aqui e vale para todas as paginas.
 *
 * Os enderecos abaixo comecam vazios de proposito. Um link para "#" seria
 * um botao que nao leva a lugar nenhum, entao enquanto o perfil nao existir
 * o item e renderizado como texto inerte, nao como link quebrado.
 * Basta preencher `href` para ele virar um link de verdade.
 */

const SOCIAL = [
    { id: 'instagram', label: 'Instagram', href: '' },
    { id: 'x', label: 'X', href: '' },
    { id: 'discord', label: 'Discord', href: '' },
    { id: 'youtube', label: 'YouTube', href: '' },
    { id: 'tiktok', label: 'TikTok', href: '' },
    { id: 'github', label: 'GitHub', href: '' },
];

/* Glifos proprios, no mesmo estilo do resto do set em ui.js. */
const GLYPHS = {
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/>',
    x: '<path d="M4 4l16 16M20 4L4 20"/>',
    discord: '<path d="M8.5 8.5a12 12 0 0 1 7 0"/><path d="M7 17.5c-1.8-2.6-2.2-6-1.2-9.2A13 13 0 0 1 9 7l.8 1.6"/><path d="M17 17.5c1.8-2.6 2.2-6 1.2-9.2A13 13 0 0 0 15 7l-.8 1.6"/><path d="M7 17.5A11 11 0 0 0 12 19a11 11 0 0 0 5-1.5"/><circle cx="9.5" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="13" r="1.1" fill="currentColor" stroke="none"/>',
    youtube: '<rect x="2.5" y="6" width="19" height="12" rx="3.5"/><path d="M10.5 9.8v4.4l3.8-2.2z" fill="currentColor" stroke="none"/>',
    tiktok: '<path d="M14 4v9.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 4a4.5 4.5 0 0 0 4.5 4.5"/>',
    github: '<path d="M9 19c-4 1.3-4-2.2-5.5-2.7M15 21v-3.4a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.3 1.3a11.3 11.3 0 0 0-6 0C6.2 2.6 5.2 2.9 5.2 2.9a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 3.8 9.3c0 4.6 2.8 5.7 5.5 6a3 3 0 0 0-.8 2.3V21"/>',
};

const iconFor = (id) => `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
         stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        ${GLYPHS[id] ?? ''}
    </svg>`;

function socialItem({ id, label, href }) {
    const body = `${iconFor(id)}<span class="visually-hidden">${label}</span>`;

    return href
        ? `<a class="site-footer__social" href="${href}" target="_blank" rel="noopener noreferrer" title="${label}">${body}</a>`
        : `<span class="site-footer__social site-footer__social--empty" title="${label} — perfil ainda não cadastrado">${body}</span>`;
}

export function footerMarkup() {
    return `
        <div class="site-footer__inner">
            <div class="site-footer__brand">
                <img class="site-footer__logo" data-brand="logo" src="/assets/brand/logo-rivaly.png"
                     alt="RIVALY" width="132" height="44" loading="lazy" decoding="async">
                <p class="site-footer__tagline">Rival + Ally — sua identidade gamer em um só lugar.</p>
            </div>

            <nav class="site-footer__socials" aria-label="Redes sociais">
                ${SOCIAL.map(socialItem).join('')}
            </nav>

            <p class="site-footer__legal">
                &copy; ${new Date().getFullYear()} RIVALY. Projeto acadêmico.
                As artes dos jogos pertencem aos seus respectivos detentores.
            </p>
        </div>
    `;
}

/** Monta o rodape uma unica vez por pagina. */
export function initFooter() {
    if (document.querySelector('.site-footer')) return;

    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = footerMarkup();
    document.body.appendChild(footer);
}
