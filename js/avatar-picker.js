/**
 * avatar-picker.js — the character-select screen.
 *
 * Built on the project's existing modal (js/modal.js) and toast
 * (js/notifications.js); it does not introduce a second dialog system.
 *
 * Two sources share one dialog:
 *   AVATARS        the DiceBear library, filtered and searchable
 *   UPLOAD YOUR OWN  a local file, downscaled before it is stored
 */

import { openModal } from './modal.js';
import { toast } from './notifications.js';
import { $, escapeHtml, icon } from './ui.js';
import { AVATAR_LIBRARY, GENERATED_PREFIX } from './avatar-data.js';
import {
    AVATAR_CATEGORIES, AVATAR_STYLES, STYLE_CATEGORY,
    getDiceBearAvatar, resolveAvatar, initialsMarkup,
} from './avatar-service.js';
import { readImageFile, UPLOAD_LIMITS } from './avatar-upload.js';

const PAGE_SIZE = 40;
const GENERATE_BATCH = 16;

/**
 * Opens the picker.
 * @param {object} user     current passport (for the starting selection)
 * @param {(avatar:object) => void} onConfirm  receives the unified avatar
 */
export function openAvatarPicker(user, onConfirm, { onCancel } = {}) {
    /* ---------- state ---------- */
    const current = resolveAvatar(user);
    const state = {
        tab: current.type === 'upload' ? 'upload' : 'library',
        category: 'all',
        query: '',
        visible: PAGE_SIZE,
        // Runtime-generated options live alongside the shipped library.
        pool: [...AVATAR_LIBRARY],
        selection: current.type === 'upload'
            ? { type: 'upload', src: current.src }
            : { type: 'dicebear', style: current.style, seed: current.seed },
        upload: current.type === 'upload' ? { src: current.src } : null,
    };

    const nickname = user?.nickname ?? 'Rival';

    /* ---------- markup ---------- */
    const body = `
        <div class="picker">
            <div class="picker__tabs" role="tablist" aria-label="Origem do avatar">
                <button type="button" class="picker__tab" role="tab" data-tab="library">Biblioteca</button>
                <button type="button" class="picker__tab" role="tab" data-tab="upload">Enviar imagem</button>
            </div>

            <section class="picker__panel" data-panel="library">
                <div class="picker__controls">
                    <div class="segmented" id="pickerCats" role="tablist" aria-label="Categoria do avatar"></div>
                    <div class="input-group picker__search">
                        <span class="input-group__icon" aria-hidden="true">${icon('search', { size: 15 })}</span>
                        <input class="input" type="search" id="pickerSearch"
                               placeholder="Buscar avatares…" aria-label="Buscar avatares">
                    </div>
                </div>

                <div class="picker__grid" id="pickerGrid" role="listbox"
                     aria-label="Biblioteca de avatares" tabindex="0"></div>

                <div class="picker__actions">
                    <button type="button" class="btn btn-ghost btn-sm" id="pickerMore">Mostrar mais avatares</button>
                    <button type="button" class="btn btn-outline-light btn-sm" id="pickerGenerate">
                        ${icon('spark', { size: 14 })} Gerar novos
                    </button>
                </div>
                <p class="picker__count" id="pickerCount" aria-live="polite"></p>
            </section>

            <section class="picker__panel" data-panel="upload" hidden>
                <div class="upload" id="uploadZone">
                    <input type="file" id="uploadInput" class="visually-hidden"
                           accept="image/jpeg,image/png,image/webp">
                    <label class="upload__drop" for="uploadInput">
                        <span class="upload__glyph">${icon('user', { size: 26 })}</span>
                        <span class="upload__title">Escolher uma imagem</span>
                        <span class="upload__hint">JPEG, PNG ou WebP · até ${UPLOAD_LIMITS.maxMB} MB</span>
                    </label>
                    <p class="field__error" id="uploadError" role="alert"></p>
                    <p class="upload__note">
                        A imagem é redimensionada para ${UPLOAD_LIMITS.size}×${UPLOAD_LIMITS.size} e armazenada
                        somente neste navegador. Ela nunca sai do seu dispositivo.
                    </p>
                </div>
            </section>

            <aside class="picker__preview">
                <p class="eyebrow">Avatar atual</p>
                <span class="avatar avatar--2xl avatar--ring" id="pickerPreview"></span>
                <p class="picker__preview-name">${escapeHtml(nickname)}</p>
                <p class="picker__preview-meta" id="pickerMeta"></p>
            </aside>
        </div>
    `;

    // Quem abre o picker de dentro de outro dialogo precisa saber que o
    // usuario desistiu, para remontar o que estava na tela.
    let confirmed = false;

    const { close, root } = openModal({
        title: 'Escolha seu avatar',
        subtitle: 'Escolha na biblioteca ou envie a sua própria imagem.',
        wide: true,
        body,
        footer: `
            <button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>
            <button type="button" class="btn btn-primary" id="pickerConfirm">Usar este avatar</button>
        `,
        onClose: () => { if (!confirmed) onCancel?.(); },
    });

    const grid = $('#pickerGrid', root);
    const cats = $('#pickerCats', root);
    const preview = $('#pickerPreview', root);
    const meta = $('#pickerMeta', root);
    const countLine = $('#pickerCount', root);
    const moreBtn = $('#pickerMore', root);

    /* ---------- derived ---------- */
    const matches = () => {
        const needle = state.query.trim().toLowerCase();
        return state.pool.filter((item) => {
            if (state.category !== 'all' && item.category !== state.category) return false;
            if (!needle) return true;
            return `${item.id} ${item.seed} ${item.style} ${item.category}`
                .toLowerCase()
                .includes(needle);
        });
    };

    const isSelected = (item) =>
        state.selection.type === 'dicebear'
        && state.selection.seed === item.seed
        && state.selection.style === item.style;

    /* ---------- render ---------- */
    function renderCategories() {
        cats.innerHTML = AVATAR_CATEGORIES.map((c) => `
            <button type="button" class="segmented__item" role="tab" data-cat="${c.id}"
                    aria-selected="${state.category === c.id}">${escapeHtml(c.label)}</button>
        `).join('');
    }

    function optionMarkup(item) {
        const selected = isSelected(item);
        return `<button type="button" class="picker__option${selected ? ' is-selected' : ''}"
                role="option" aria-selected="${selected}"
                data-seed="${escapeHtml(item.seed)}" data-style="${escapeHtml(item.style)}"
                aria-label="Avatar ${escapeHtml(item.seed)}, estilo ${escapeHtml(item.style)}">
            ${initialsMarkup(item.seed)}
            <img class="avatar__img" src="${escapeHtml(getDiceBearAvatar(item.style, item.seed))}"
                 alt="" width="72" height="72" loading="lazy" decoding="async" data-fallback>
        </button>`;
    }

    function renderGrid({ append = false } = {}) {
        const all = matches();
        const slice = all.slice(0, state.visible);

        if (append) {
            // Batch the inserts so a "load more" is one reflow, not forty.
            const fragment = document.createElement('template');
            fragment.innerHTML = slice.slice(grid.children.length).map(optionMarkup).join('');
            grid.appendChild(fragment.content);
        } else {
            grid.innerHTML = slice.length
                ? slice.map(optionMarkup).join('')
                : `<p class="picker__empty">Nenhum avatar corresponde a “${escapeHtml(state.query)}”.</p>`;
        }

        moreBtn.hidden = slice.length >= all.length;
        countLine.textContent = `${slice.length} de ${all.length} avatares`;
    }

    function renderPreview() {
        const sel = state.selection;
        if (sel.type === 'upload') {
            preview.innerHTML = `${initialsMarkup(nickname)}<img class="avatar__img" src="${escapeHtml(sel.src)}" alt="" data-fallback>`;
            meta.textContent = 'Imagem enviada';
            return;
        }
        preview.innerHTML = `${initialsMarkup(sel.seed)}<img class="avatar__img" src="${escapeHtml(getDiceBearAvatar(sel.style, sel.seed))}" alt="" data-fallback>`;
        meta.textContent = `${sel.style} · ${sel.seed}`;
    }

    function setTab(tab) {
        state.tab = tab;
        root.querySelectorAll('[data-tab]').forEach((b) => {
            b.setAttribute('aria-selected', String(b.dataset.tab === tab));
        });
        root.querySelectorAll('[data-panel]').forEach((p) => {
            p.hidden = p.dataset.panel !== tab;
        });
    }

    /* ---------- events ---------- */
    root.addEventListener('click', async (event) => {
        const tab = event.target.closest('[data-tab]');
        if (tab) { setTab(tab.dataset.tab); return; }

        const cat = event.target.closest('[data-cat]');
        if (cat) {
            state.category = cat.dataset.cat;
            state.visible = PAGE_SIZE;
            renderCategories();
            renderGrid();
            return;
        }

        const option = event.target.closest('.picker__option');
        if (option) {
            state.selection = { type: 'dicebear', style: option.dataset.style, seed: option.dataset.seed };
            grid.querySelectorAll('.picker__option').forEach((el) => {
                const on = el === option;
                el.classList.toggle('is-selected', on);
                el.setAttribute('aria-selected', String(on));
            });
            renderPreview();
            return;
        }

        if (event.target.closest('#pickerMore')) {
            state.visible += PAGE_SIZE;
            renderGrid({ append: true });
            return;
        }

        if (event.target.closest('#pickerGenerate')) {
            generateMore();
            return;
        }

        if (event.target.closest('#pickerConfirm')) {
            confirmed = true;
            onConfirm?.(state.selection);
            close();
        }
    });

    // Keyboard: the grid is a listbox, so arrows move and Enter/Space picks.
    grid.addEventListener('keydown', (event) => {
        const options = Array.from(grid.querySelectorAll('.picker__option'));
        if (options.length === 0) return;
        const index = options.indexOf(document.activeElement);

        if (event.key === 'Enter' || event.key === ' ') {
            if (index >= 0) { event.preventDefault(); options[index].click(); }
            return;
        }
        const perRow = Math.max(1, Math.round(grid.clientWidth / (options[0].offsetWidth || 84)));
        const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: perRow, ArrowUp: -perRow }[event.key];
        if (!delta) return;
        event.preventDefault();
        const next = Math.min(options.length - 1, Math.max(0, (index < 0 ? 0 : index) + delta));
        options[next].focus();
    });

    let searchTimer = null;
    $('#pickerSearch', root).addEventListener('input', (event) => {
        const value = event.target.value;
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => {
            state.query = value;
            state.visible = PAGE_SIZE;
            renderGrid();
        }, 140);
    });

    /** New seeds, appended without disturbing the current selection. */
    function generateMore() {
        const existing = new Set(state.pool.map((a) => `${a.style}|${a.seed}`));
        const styles = state.category === 'all'
            ? AVATAR_STYLES
            : AVATAR_STYLES.filter((s) => STYLE_CATEGORY[s] === state.category);

        let added = 0;
        let guard = 0;
        while (added < GENERATE_BATCH && guard < GENERATE_BATCH * 6) {
            guard += 1;
            const style = styles[added % styles.length];
            const seed = `${GENERATED_PREFIX}-${newSeedToken()}`;
            const key = `${style}|${seed}`;
            if (existing.has(key)) continue;
            existing.add(key);
            state.pool.push({
                id: `avatar-gen-${state.pool.length + 1}`,
                seed,
                style,
                category: STYLE_CATEGORY[style],
            });
            added += 1;
        }

        // Show the new batch straight away.
        state.visible = Math.max(state.visible, matches().length);
        renderGrid();
        toast({ title: `${added} novos avatares`, message: 'Novas opções foram geradas.', type: 'info' });
    }

    /* ---------- upload ---------- */
    const uploadInput = $('#uploadInput', root);
    const uploadError = $('#uploadError', root);
    const uploadZone = $('#uploadZone', root);

    function renderUpload() {
        const existing = root.querySelector('.upload__preview');
        existing?.remove();
        if (!state.upload) return;

        uploadZone.insertAdjacentHTML('beforeend', `
            <div class="upload__preview">
                <span class="avatar avatar--xl">
                    <img class="avatar__img" src="${escapeHtml(state.upload.src)}" alt="Seu avatar enviado">
                </span>
                <div class="upload__preview-actions">
                    <button type="button" class="btn btn-ghost btn-sm" data-upload-remove>Remover imagem</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-tab="library">Voltar para a biblioteca</button>
                </div>
            </div>
        `);
    }

    uploadInput.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        uploadError.textContent = '';

        const result = await readImageFile(file);
        if (!result.ok) {
            uploadError.textContent = result.error;
            uploadInput.value = '';
            return;
        }

        state.upload = { src: result.src };
        state.selection = { type: 'upload', src: result.src };
        renderUpload();
        renderPreview();
    });

    root.addEventListener('click', (event) => {
        if (!event.target.closest('[data-upload-remove]')) return;
        state.upload = null;
        uploadInput.value = '';
        renderUpload();
        // Fall back to whatever the library selection was.
        const first = matches()[0];
        if (first) state.selection = { type: 'dicebear', style: first.style, seed: first.seed };
        renderPreview();
        renderGrid();
    });

    /* ---------- boot ---------- */
    renderCategories();
    renderGrid();
    renderPreview();
    renderUpload();
    setTab(state.tab);
}

/**
 * Semente nova para o DiceBear. Não é regra de negócio nem precisa ser
 * reproduzível, mas também não usa Math.random(): crypto está disponível
 * até fora de contexto seguro (getRandomValues).
 */
function newSeedToken() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID().slice(0, 8);
    const bytes = new Uint8Array(5);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 8);
}
