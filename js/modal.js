/**
 * modal.js — o diálogo da RIVALY, agora sobre o bootstrap.Modal.
 *
 * A API pública é a mesma da V1, então nenhum chamador mudou:
 *   openModal({ title, subtitle, body, footer, wide, onMount, onClose })
 *   closeModal()
 *   confirmDialog({ title, message, confirmLabel, cancelLabel, danger })
 *
 * O que mudou por baixo: foco preso no diálogo, Esc, clique no fundo e a
 * trava de rolagem do body agora são do Bootstrap.
 *
 * Por que um único elemento: a RIVALY encadeia diálogos (Editar Passaporte
 * abre a galeria de avatar, que devolve para o Editar). Dois .modal do
 * Bootstrap em transição ao mesmo tempo brigam pelo backdrop e pelo foco;
 * um .modal só, que troca de conteúdo, não tem essa corrida. Se o diálogo
 * já está aberto, o conteúdo é trocado no lugar; se está fechando, o novo
 * conteúdo espera o fim da animação e abre em seguida.
 */

import { escapeHtml } from './ui.js';

let shell = null;        // o elemento .modal (criado uma vez)
let instance = null;     // bootstrap.Modal
let state = 'hidden';    // hidden | showing | shown | hiding
let current = null;      // { token, onClose } do conteúdo ativo
let pendingShow = false; // um openModal chegou durante o "hiding"
let returnFocus = null;  // quem tinha o foco antes de o diálogo abrir
let tokenSeq = 0;

const FIRST_FIELD = '.modal-body input:not([disabled]):not([type="hidden"]), .modal-body select, .modal-body textarea, .modal-body button';

function ensureShell() {
    if (shell && document.body.contains(shell)) return shell;

    shell = document.createElement('div');
    shell.className = 'modal fade rv-modal';
    shell.id = 'rvModal';
    shell.tabIndex = -1;
    shell.setAttribute('aria-labelledby', 'rvModalTitle');
    shell.setAttribute('aria-hidden', 'true');
    shell.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content" data-modal-content></div>
        </div>
    `;
    document.body.appendChild(shell);

    instance = window.bootstrap.Modal.getOrCreateInstance(shell, { backdrop: true, keyboard: true, focus: true });

    shell.addEventListener('show.bs.modal', () => { state = 'showing'; });
    shell.addEventListener('shown.bs.modal', () => {
        state = 'shown';
        focusInitial();
    });

    // Esc, clique no fundo ou o X: o Bootstrap começa a esconder. Se a
    // iniciativa não foi nossa, o conteúdo ativo é avisado aqui.
    shell.addEventListener('hide.bs.modal', (event) => {
        const previous = state;
        state = 'hiding';
        const closing = current;
        current = null;
        closing?.onClose?.();

        // O onClose abriu outro conteúdo (ex.: cancelar a galeria de avatar
        // devolve o formulário do Passaporte): cancela o fechamento e fica.
        if (current !== null) {
            event.preventDefault();
            state = previous === 'showing' ? 'showing' : 'shown';
            pendingShow = false;
            focusInitial();
        }
    });

    shell.addEventListener('hidden.bs.modal', () => {
        state = 'hidden';
        if (pendingShow) {
            pendingShow = false;
            instance.show();
            return;
        }
        shell.querySelector('[data-modal-content]').replaceChildren();
        if (returnFocus instanceof HTMLElement && document.body.contains(returnFocus)) {
            returnFocus.focus();
        }
        returnFocus = null;
    });

    // Qualquer [data-modal-close] fecha, como na V1.
    shell.addEventListener('click', (event) => {
        if (event.target.closest('[data-modal-close]')) {
            event.preventDefault();
            closeModal();
        }
    });

    return shell;
}

function focusInitial() {
    const content = shell.querySelector('[data-modal-content]');
    const target = content.querySelector('[data-autofocus]')
        ?? content.querySelector(FIRST_FIELD)
        ?? content.querySelector('.btn-close');
    target?.focus?.({ preventScroll: true });
}

/**
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.subtitle]
 * @param {string} options.body      HTML do corpo (já escapado pelo chamador).
 * @param {string} [options.footer]  HTML do rodapé.
 * @param {boolean} [options.wide]
 * @param {(context:{close:Function, root:HTMLElement}) => void} [options.onMount]
 * @param {() => void} [options.onClose]
 * @returns {{close: Function, root: HTMLElement}}
 */
export function openModal({ title, subtitle = '', body, footer = '', wide = false, onMount, onClose }) {
    ensureShell();

    // Um conteúdo que é substituído conta como fechado para quem o abriu.
    const replaced = current;
    current = null;
    replaced?.onClose?.();

    const token = ++tokenSeq;
    const dialog = shell.querySelector('.modal-dialog');
    dialog.classList.toggle('modal-lg', wide);

    // Cada conteúdo nasce num .modal-content novo. Os chamadores ligam
    // listeners no `root` (delegação); se o elemento fosse reaproveitado,
    // os listeners de diálogos anteriores continuariam vivos e disparariam
    // de novo, com os dados antigos. Trocando o elemento, eles somem junto.
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.dataset.modalContent = '';
    shell.querySelector('[data-modal-content]').replaceWith(content);

    content.innerHTML = `
        <div class="modal-header">
            <div>
                <h2 class="modal-title" id="rvModalTitle">${escapeHtml(title)}</h2>
                ${subtitle ? `<p class="modal-subtitle">${escapeHtml(subtitle)}</p>` : ''}
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar janela"></button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    `;

    const close = () => {
        if (!current || current.token !== token) return;
        const closing = current;
        current = null;
        closing.onClose?.();
        // Se o onClose abriu outro diálogo, ele assumiu o lugar: não esconder.
        if (current === null) instance.hide();
    };

    current = { token, onClose };

    if (state === 'hidden') {
        returnFocus = document.activeElement;
        instance.show();
    } else if (state === 'hiding') {
        pendingShow = true;
    } else {
        // Já aberto (ou abrindo): o conteúdo foi trocado no lugar.
        focusInitial();
    }

    onMount?.({ close, root: content });
    return { close, root: content };
}

export function closeModal() {
    if (!instance || state === 'hidden' || state === 'hiding') return;
    if (current) {
        const closing = current;
        current = null;
        closing.onClose?.();
        if (current !== null) return;
    }
    instance.hide();
}

/**
 * Diálogo de confirmação. Resolve true ou false.
 * Substitui o window.confirm em todo o produto.
 */
export function confirmDialog({
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    danger = false,
}) {
    return new Promise((resolve) => {
        let settled = false;
        const settle = (value) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };

        const { close, root } = openModal({
            title,
            body: `<p class="text-secondary mb-0">${escapeHtml(message)}</p>`,
            footer: `
                <button type="button" class="btn btn-ghost" data-action="cancel">${escapeHtml(cancelLabel)}</button>
                <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm" data-autofocus>${escapeHtml(confirmLabel)}</button>
            `,
            // Esc, fundo, X ou outro diálogo por cima: tudo conta como "não".
            onClose: () => settle(false),
        });

        root.addEventListener('click', (event) => {
            const action = event.target.closest('[data-action]')?.dataset.action;
            if (action !== 'confirm' && action !== 'cancel') return;
            settle(action === 'confirm');
            close();
        });
    });
}
