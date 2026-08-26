/**
 * modal.js — one accessible dialog implementation, used everywhere.
 *
 * Handles: focus capture, focus restoration, Tab trapping, Escape to
 * close, backdrop click, body scroll lock, and cleanup of every
 * listener it adds. Only one modal can be open at a time.
 */

import { icon, escapeHtml } from './ui.js';

const FOCUSABLE = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

let active = null;

/**
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.subtitle]
 * @param {string} options.body      HTML string for the dialog body.
 * @param {string} [options.footer]  HTML string for the footer.
 * @param {boolean} [options.wide]
 * @param {(context:{close:Function, root:HTMLElement}) => void} [options.onMount]
 * @returns {{close: Function, root: HTMLElement}}
 */
export function openModal({ title, subtitle = '', body, footer = '', wide = false, onMount }) {
    closeModal();

    const previouslyFocused = document.activeElement;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
        <div class="modal ${wide ? 'modal--wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <header class="modal__header">
                <div>
                    <h2 class="modal__title" id="modal-title">${escapeHtml(title)}</h2>
                    ${subtitle ? `<p class="modal__subtitle">${escapeHtml(subtitle)}</p>` : ''}
                </div>
                <button type="button" class="modal__close" data-modal-close aria-label="Close dialog">${icon('close', { size: 15 })}</button>
            </header>
            <div class="modal__body">${body}</div>
            ${footer ? `<footer class="modal__footer">${footer}</footer>` : ''}
        </div>
    `;

    const dialog = backdrop.querySelector('.modal');

    const close = () => {
        if (active?.backdrop !== backdrop) return;

        // Release the slot immediately. The removal is animated, so a
        // modal opened during that 160ms window must not be clobbered
        // when this one's timeout finally fires.
        active = null;
        document.removeEventListener('keydown', onKeyDown, true);
        backdrop.classList.add('is-leaving');

        window.setTimeout(() => {
            backdrop.remove();
            // Only give the page back its scroll and focus if no other
            // dialog took over in the meantime.
            if (!document.querySelector('.modal-backdrop')) {
                document.body.classList.remove('is-locked');
                if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
            }
        }, 160);
    };

    function onKeyDown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
            return;
        }
        if (event.key !== 'Tab') return;

        const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE))
            .filter((element) => element.offsetParent !== null || element === document.activeElement);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) close();
        if (event.target.closest('[data-modal-close]')) close();
    });

    document.addEventListener('keydown', onKeyDown, true);
    document.body.classList.add('is-locked');
    document.body.appendChild(backdrop);

    active = { backdrop, close };

    // Focus the first meaningful control, not the close button when a
    // better candidate exists.
    const target = dialog.querySelector('[data-autofocus]')
        ?? dialog.querySelector('.modal__body input:not([disabled]):not([type="hidden"]), .modal__body select, .modal__body textarea, .modal__body button')
        ?? dialog.querySelector(FOCUSABLE);
    (target ?? dialog).focus?.();

    onMount?.({ close, root: dialog });

    return { close, root: dialog };
}

export function closeModal() {
    active?.close();
}

/**
 * Confirmation dialog. Resolves to true/false.
 * Replaces `window.confirm` everywhere in the product.
 */
export function confirmDialog({
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
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
            body: `<p class="text-secondary">${escapeHtml(message)}</p>`,
            footer: `
                <button type="button" class="btn btn--ghost" data-action="cancel">${escapeHtml(cancelLabel)}</button>
                <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-action="confirm" data-autofocus>${escapeHtml(confirmLabel)}</button>
            `,
        });

        root.addEventListener('click', (event) => {
            const action = event.target.closest('[data-action]')?.dataset.action;
            if (!action) return;
            settle(action === 'confirm');
            close();
        });

        // Escape / backdrop / close button all resolve false.
        const observer = new MutationObserver(() => {
            if (!document.body.contains(root)) {
                observer.disconnect();
                settle(false);
            }
        });
        observer.observe(document.body, { childList: true });
    });
}
