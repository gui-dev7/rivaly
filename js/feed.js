/**
 * feed.js — controller do Feed (DOM + eventos).
 *
 * Esta é a tela que mostra o DOM "na mão": cada post e cada comentário
 * é montado com createElement/append/textContent, sem innerHTML para o
 * texto. Os números (caracteres restantes, reações, comentários) mudam
 * na hora, sem recarregar a página. As regras ficam em feed-store.js.
 */

import { bootApp, afterRender, haltModule } from './app.js';
import { REACTIONS, getGameById } from './data.js';
import {
    buildFeed, filterFeed, publishPost, toggleReaction, addComment, postRules, commentRules,
    dailyXpLeft, FEED_TABS, POST_MAX, COMMENT_MAX,
} from './feed-store.js';
import { myClan } from './clans-store.js';
import { ACTIVITY_ICONS } from './activity.js';
import { avatarMarkup, icon, formatRelativeTime, emptyStateMarkup, $ } from './ui.js';
import { userAvatarMarkup } from './avatar-service.js';
import { simulatedBadgeMarkup, relationBadgeMarkup } from './community-ui.js';
import { validateValue, showFieldError, clearFieldError, showFeedback } from './validation.js';
import { toast } from './notifications.js';
import { refreshNavigationProgress } from './navigation.js';

const user = bootApp({
    page: 'feed',
    title: 'Feed',
    subtitle: 'Sua comunidade, em ordem de data',
});
if (!user) await haltModule();

$('[data-sim-badge]').insertAdjacentHTML('beforeend', simulatedBadgeMarkup());

const PAGE_SIZE = 15;
const state = { tab: 'all', visible: PAGE_SIZE, items: [] };

const listHost = $('#feedList');
const moreButton = $('#feedMore');

/* ============================================================
   CONSTRUÇÃO COM A API DO DOM
   ============================================================ */

/** Atalho: cria um elemento com classe e texto opcionais. */
function el(tag, { className = '', text = null, attrs = {} } = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== null) node.textContent = text;
    Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
    return node;
}

function authorChip(author) {
    if (author.isSelf) {
        const self = el('span', { className: 'player-chip player-chip--self' });
        self.insertAdjacentHTML('afterbegin', userAvatarMarkup(user, { size: 'sm' }));
        self.append(el('span', { className: 'player-chip__name', text: `${author.name} (você)` }));
        return self;
    }
    const chip = el('button', {
        className: 'player-chip',
        attrs: { type: 'button', 'aria-label': `Abrir o cartão de ${author.name}` },
    });
    chip.dataset.playerCard = author.id;
    chip.insertAdjacentHTML('afterbegin', avatarMarkup(`${author.name}${author.id}`, { size: 'sm' }));
    chip.append(el('span', { className: 'player-chip__name', text: author.name }));
    return chip;
}

function timeNode(iso) {
    const time = el('time', { className: 'post__time', text: formatRelativeTime(iso), attrs: { datetime: iso } });
    time.title = new Date(iso).toLocaleString('pt-BR');
    return time;
}

function reactionButton(item, reaction) {
    const active = item.myReactions.includes(reaction.id);
    const button = el('button', {
        className: `reaction${active ? ' is-active' : ''}`,
        attrs: { type: 'button', 'aria-pressed': String(active) },
    });
    button.dataset.reaction = reaction.id;
    button.append(
        el('span', { className: 'reaction__label', text: reaction.label }),
        el('span', { className: 'reaction__count numeric', text: String(item.reactions[reaction.id]) }),
    );
    return button;
}

function commentNode(comment) {
    const li = el('li', { className: 'comment' });
    const head = el('div', { className: 'comment__head' });
    head.append(authorChip(comment.author), timeNode(comment.at));
    li.append(head, el('p', { className: 'comment__text', text: comment.text }));
    return li;
}

/** Um post completo, montado peça por peça. */
function buildPostElement(item) {
    const card = el('article', { className: `card post${item.author.isSelf ? ' post--mine' : ''}` });
    card.dataset.post = item.id;

    const body = el('div', { className: 'card-body' });
    const head = el('header', { className: 'post__head' });
    head.append(authorChip(item.author));
    if (item.author.clan) head.append(el('span', { className: 'clan-tag', text: `[${item.author.clan.tag}]` }));
    if (item.relation) head.insertAdjacentHTML('beforeend', relationBadgeMarkup(item.relation));
    head.append(timeNode(item.at));

    const text = el('p', { className: 'card-text post__text', text: item.text });
    body.append(head, text);

    if (item.gameId && getGameById(item.gameId)) {
        body.append(el('p', { className: 'post__game', text: getGameById(item.gameId).title }));
    }

    const reactions = el('div', { className: 'post__reactions', attrs: { role: 'group', 'aria-label': 'Reações' } });
    REACTIONS.forEach((reaction) => reactions.append(reactionButton(item, reaction)));
    body.append(reactions);

    const footer = el('div', { className: 'card-footer post__comments' });
    const panelId = `comments-${item.id}`;
    const toggle = el('button', {
        className: 'btn btn-link btn-sm px-0',
        attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': panelId },
    });
    toggle.dataset.toggleComments = '';
    toggle.append(el('span', { text: 'Comentários ' }), el('span', { className: 'numeric', text: `(${item.comments.length})` }));
    toggle.lastChild.dataset.commentCount = '';

    const panel = el('div', { className: 'post__panel', attrs: { id: panelId } });
    panel.hidden = true;
    const list = el('ul', { className: 'comment-list' });
    item.comments.forEach((comment) => list.append(commentNode(comment)));

    const form = el('form', { className: 'comment-form', attrs: { novalidate: '' } });
    form.dataset.commentForm = item.id;
    const inputId = `comment-${item.id}`;
    const label = el('label', { className: 'visually-hidden', text: 'Escreva um comentário', attrs: { for: inputId } });
    const group = el('div', { className: 'input-group' });
    const input = el('input', {
        className: 'form-control',
        attrs: { id: inputId, type: 'text', autocomplete: 'off', placeholder: `Comente em até ${COMMENT_MAX} caracteres` },
    });
    const submit = el('button', { className: 'btn btn-outline-light', text: 'Comentar', attrs: { type: 'submit' } });
    group.append(input, submit);
    form.append(label, group);
    panel.append(list, form);
    footer.append(toggle, panel);

    card.append(body, footer);
    return card;
}

/** Uma atividade do próprio usuário (biblioteca, Arena, clã...). */
function buildActivityElement(item) {
    const card = el('article', { className: `feed-event feed-event--${item.kind}` });
    const glyph = el('span', { className: 'feed-event__icon', attrs: { 'aria-hidden': 'true' } });
    glyph.insertAdjacentHTML('afterbegin', icon(ACTIVITY_ICONS[item.kind] ?? 'spark', { size: 14 }));
    const bodyNode = el('div', { className: 'feed-event__body' });
    bodyNode.append(el('p', { className: 'feed-event__text', text: item.text }), timeNode(item.at));
    card.append(glyph, bodyNode);
    if (item.meta?.xp) card.append(el('span', { className: 'feed-event__xp numeric', text: `+${item.meta.xp} XP` }));
    return card;
}

/* ============================================================
   ABAS E LISTA
   ============================================================ */

const EMPTY = {
    all: { iconName: 'globe', title: 'O Feed está em silêncio.', text: 'Publique o primeiro post ou jogue uma sessão: tudo aparece aqui.', action: '<a class="btn btn-primary btn-sm" href="#composerTitle">Escrever um post</a>' },
    clanNone: { iconName: 'shield', title: 'Você ainda não está em um clã.', text: 'Os posts e eventos do seu clã aparecem nesta aba. Clãs compatíveis com o seu DNA estão na página Clãs.', action: '<a class="btn btn-primary btn-sm" href="clans.html#exploreTitle">Ver clãs compatíveis</a>' },
    clan: { iconName: 'shield', title: 'Seu clã ainda não postou nesta semana.', text: 'Comece você: um post seu aparece aqui e soma 2 pontos para a meta semanal.', action: '<a class="btn btn-primary btn-sm" href="#composerTitle">Escrever um post</a>' },
    allies: { iconName: 'heart', title: 'Nenhum post de aliados.', text: 'Depois de uma sessão de squad, marque quem você quer de volta como Aliado. Os posts dessas pessoas aparecem aqui.', action: '<a class="btn btn-primary btn-sm" href="squads.html">Jogar uma sessão</a>' },
    rivals: { iconName: 'target', title: 'Nenhum post de rivais.', text: 'Rival aqui é quem você quer enfrentar de novo. Marque rivais no pós-partida e acompanhe o que eles postam.', action: '<a class="btn btn-primary btn-sm" href="squads.html">Jogar uma sessão</a>' },
    arena: { iconName: 'target', title: 'Nenhum evento de Arena ainda.', text: 'Suas partidas e os posts de Arena da comunidade aparecem aqui.', action: '<a class="btn btn-primary btn-sm" href="arena.html">Ir para a Arena</a>' },
};

function renderTabs() {
    const host = $('#feedTabs');
    host.replaceChildren(...FEED_TABS.map((tab) => {
        const li = el('li', { className: 'nav-item', attrs: { role: 'presentation' } });
        const count = filterFeed(state.items, tab.id).length;
        const button = el('button', {
            className: `nav-link${tab.id === state.tab ? ' active' : ''}`,
            attrs: {
                type: 'button',
                role: 'tab',
                id: `feedTab-${tab.id}`,
                'aria-selected': String(tab.id === state.tab),
                'aria-controls': 'feedPanel',
                tabindex: tab.id === state.tab ? '0' : '-1',
            },
        });
        button.dataset.tab = tab.id;
        button.append(el('span', { text: tab.label }), el('span', { className: 'feed-tabs__count numeric', text: ` ${count}` }));
        li.append(button);
        return li;
    }));
    $('#feedPanel').setAttribute('aria-labelledby', `feedTab-${state.tab}`);
}

function renderList() {
    const filtered = filterFeed(state.items, state.tab);

    if (filtered.length === 0) {
        const key = state.tab === 'clan' && !myClan() ? 'clanNone' : state.tab;
        listHost.innerHTML = emptyStateMarkup(EMPTY[key] ?? EMPTY.all);
        moreButton.hidden = true;
        return;
    }

    const nodes = filtered.slice(0, state.visible).map((item) => (item.type === 'post' ? buildPostElement(item) : buildActivityElement(item)));
    listHost.replaceChildren(...nodes);
    moreButton.hidden = filtered.length <= state.visible;
}

function refresh({ keepVisible = false } = {}) {
    state.items = buildFeed();
    if (!keepVisible) state.visible = PAGE_SIZE;
    renderTabs();
    renderList();
    renderXpLeft();
    afterRender(listHost);
}

function renderXpLeft() {
    const left = dailyXpLeft();
    $('#xpLeft').textContent = left > 0
        ? `Posts e reações ainda rendem XP hoje (${left} ${left === 1 ? 'vez' : 'vezes'}).`
        : 'Limite diário de XP do Feed atingido. Publicar continua valendo.';
}

/* ============================================================
   COMPOSER: contador ao vivo + validação inline
   ============================================================ */

const composer = $('#composer');
const textarea = $('#postText');
const counter = $('#postCounter');
const publishBtn = $('#publishBtn');

function updateComposer({ showErrors = false } = {}) {
    const remaining = POST_MAX - textarea.value.length;
    counter.textContent = remaining >= 0 ? `${remaining} restantes` : `${Math.abs(remaining)} acima do limite`;
    counter.classList.toggle('is-short', remaining >= 0 && remaining <= 20);
    counter.classList.toggle('is-over', remaining < 0);

    const errors = validateValue(textarea.value, postRules());
    // O botão só habilita quando o texto é válido.
    publishBtn.disabled = errors.length > 0;

    // Erro de limite ou de "só espaços" aparece enquanto digita; o de vazio,
    // só depois de uma tentativa de publicar.
    const visible = errors.find((message) => showErrors || !message.startsWith('Escreva algo'));
    showFieldError(textarea, textarea.value.length || showErrors ? visible ?? '' : '');
    return errors;
}

textarea.addEventListener('input', () => updateComposer());
textarea.addEventListener('blur', () => {
    if (textarea.value.length) updateComposer({ showErrors: true });
});

// Ctrl/Cmd + Enter publica sem tirar a mão do teclado.
textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        composer.requestSubmit();
    }
});

composer.addEventListener('submit', (event) => {
    event.preventDefault();
    const errors = updateComposer({ showErrors: true });
    if (errors.length) {
        textarea.focus();
        return;
    }

    const result = publishPost(textarea.value);
    if (!result.ok) {
        showFieldError(textarea, result.errors[0]);
        return;
    }

    textarea.value = '';
    updateComposer();
    clearFieldError(textarea);
    showFeedback(composer.querySelector('.card-body'), { type: 'success', message: 'Publicado. Seu post já está no topo do Feed.' });
    toast({ title: 'Post publicado.', message: result.xp ? 'Experiência adicionada ao Passaporte.' : 'Limite diário de XP atingido, mas o post está no ar.', type: 'success', xp: result.xp });

    // O post novo entra no topo sem reconstruir a página.
    state.tab = 'all';
    refresh();
    listHost.querySelector(`[data-post="${CSS.escape(result.post.id)}"]`)?.classList.add('is-new');
    refreshNavigationProgress();
});

/* ============================================================
   DELEGAÇÃO: abas, reações, comentários
   ============================================================ */

$('#feedTabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-tab]');
    if (!button) return;
    state.tab = button.dataset.tab;
    state.visible = PAGE_SIZE;
    renderTabs();
    renderList();
});

$('#feedTabs').addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = FEED_TABS.findIndex((tab) => tab.id === state.tab);
    const next = FEED_TABS[(index + (event.key === 'ArrowRight' ? 1 : -1) + FEED_TABS.length) % FEED_TABS.length];
    state.tab = next.id;
    renderTabs();
    renderList();
    document.getElementById(`feedTab-${next.id}`)?.focus();
});

moreButton.addEventListener('click', () => {
    state.visible += PAGE_SIZE;
    renderList();
});

listHost.addEventListener('click', (event) => {
    const reaction = event.target.closest('[data-reaction]');
    if (reaction) {
        const postId = reaction.closest('[data-post]').dataset.post;
        const result = toggleReaction(postId, reaction.dataset.reaction);
        if (!result.ok) return;
        const count = reaction.querySelector('.reaction__count');
        count.textContent = String(Number(count.textContent) + (result.active ? 1 : -1));
        reaction.classList.toggle('is-active', result.active);
        reaction.setAttribute('aria-pressed', String(result.active));
        // Mantém o estado em memória igual ao do storage, sem reconstruir.
        const item = state.items.find((entry) => entry.id === postId);
        if (item) {
            item.myReactions = result.active ? [...item.myReactions, reaction.dataset.reaction] : item.myReactions.filter((id) => id !== reaction.dataset.reaction);
            item.reactions[reaction.dataset.reaction] = Number(count.textContent);
        }
        if (result.xp) {
            refreshNavigationProgress();
            renderXpLeft();
        }
        return;
    }

    const toggle = event.target.closest('[data-toggle-comments]');
    if (toggle) {
        const panel = document.getElementById(toggle.getAttribute('aria-controls'));
        const open = panel.hidden;
        panel.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        if (open) panel.querySelector('input')?.focus();
    }
});

listHost.addEventListener('keydown', (event) => {
    // Esc fecha os comentários e devolve o foco ao botão.
    if (event.key !== 'Escape') return;
    const panel = event.target.closest('.post__panel');
    if (!panel) return;
    panel.hidden = true;
    const toggle = panel.closest('.post').querySelector('[data-toggle-comments]');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
});

listHost.addEventListener('input', (event) => {
    const input = event.target.closest('.comment-form input');
    if (input?.classList.contains('is-invalid')) {
        showFieldError(input, validateValue(input.value, commentRules())[0] ?? '');
    }
});

listHost.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-comment-form]');
    if (!form) return;
    event.preventDefault();

    const input = form.querySelector('input');
    const errors = validateValue(input.value, commentRules());
    showFieldError(input, errors[0] ?? '');
    if (errors.length) {
        input.focus();
        return;
    }

    const postId = form.dataset.commentForm;
    const result = addComment(postId, input.value);
    if (!result.ok) {
        showFieldError(input, result.errors[0]);
        return;
    }

    // Comentário novo: um <li> criado e anexado, contador atualizado.
    const list = form.parentElement.querySelector('.comment-list');
    list.append(commentNode({ ...result.comment, author: { id: 'self', name: user.nickname, isSelf: true } }));
    const counterNode = form.closest('.post').querySelector('[data-comment-count]');
    counterNode.textContent = `(${list.children.length})`;
    input.value = '';
    clearFieldError(input);
    input.focus();
});

document.addEventListener('rivaly:community-changed', () => refresh({ keepVisible: true }));

/* ============================================================
   BOOT
   ============================================================ */

refresh();
updateComposer();
