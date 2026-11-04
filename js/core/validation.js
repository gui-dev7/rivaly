/**
 * validation.js — validação de formulário sem alert().
 *
 * Duas camadas, separadas de propósito:
 *
 *   1. REGRAS (funções puras). Cada regra é uma fábrica que devolve
 *      `(valor) => mensagem | ''`. Um campo recebe um ARRAY de regras e
 *      `validateValue()` devolve a LISTA de erros (vazia = válido).
 *      Nada aqui toca o DOM, então as mesmas regras servem para o
 *      formulário e para o domínio (ex.: createClan revalida o que chega).
 *
 *   2. FEEDBACK (DOM). `validateForm()` aplica um esquema
 *      { idDoCampo: [regras] } num <form>, marca cada campo com as
 *      classes do Bootstrap (is-invalid / is-valid), aria-invalid e
 *      aria-describedby, escreve a mensagem no .invalid-feedback e
 *      devolve o primeiro campo inválido para receber o foco.
 *
 * As mensagens dizem o que houve e como resolver, sem culpar ninguém.
 */

/* ============================================================
   1. REGRAS
   ============================================================ */

const text = (value) => String(value ?? '').trim();

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Campo obrigatório. Aceita arrays (grupos de checkbox). */
export const required = (message = 'Preencha este campo para continuar.') => (value) => {
    if (Array.isArray(value)) return value.length > 0 ? '' : message;
    return text(value) ? '' : message;
};

export const minLength = (min, message) => (value) => {
    const length = text(value).length;
    if (length === 0) return ''; // "vazio" é assunto do required
    return length >= min ? '' : (message ?? `Use pelo menos ${min} caracteres. Agora são ${length}.`);
};

export const maxLength = (max, message) => (value) => {
    const length = text(value).length;
    return length <= max ? '' : (message ?? `Use no máximo ${max} caracteres. Agora são ${length}.`);
};

export const pattern = (regex, message) => (value) => {
    const clean = text(value);
    if (!clean) return '';
    return regex.test(clean) ? '' : message;
};

export const email = (message = 'Digite um e-mail no formato nome@exemplo.com.') => pattern(EMAIL_PATTERN, message);

/** Igual a outro valor (ex.: confirmação de senha). */
export const matches = (getOther, message = 'Os dois campos precisam ser iguais.') => (value) =>
    String(value ?? '') === String(getOther() ?? '') ? '' : message;

/** Não pode repetir nenhum valor da lista (comparação normalizada). */
export const unique = (getExisting, message, normalize = (value) => text(value).toUpperCase()) => (value) => {
    const clean = normalize(value);
    if (!clean) return '';
    return getExisting().map(normalize).includes(clean) ? message : '';
};

/** Texto puro: nada de tags HTML. */
export const noHtml = (message = 'Use só texto: os sinais < e > não são aceitos.') => (value) =>
    /[<>]/.test(String(value ?? '')) ? message : '';

/** Não pode ser só espaços (diferente de vazio: o usuário digitou algo). */
export const notBlank = (message = 'Escreva algo além de espaços.') => (value) => {
    const raw = String(value ?? '');
    return raw.length > 0 && raw.trim().length === 0 ? message : '';
};

/** Número dentro de um intervalo (campos opcionais vazios passam). */
export const numberRange = (min, max, message) => (value) => {
    if (text(value) === '') return '';
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max
        ? ''
        : (message ?? `Use um número entre ${min} e ${max}.`);
};

/** Um dos valores permitidos (selects). */
export const oneOf = (allowed, message = 'Escolha uma das opções da lista.') => (value) =>
    allowed.includes(value) ? '' : message;

/**
 * Aplica um array de regras a um valor.
 * @returns {string[]} lista de erros; vazia quando o valor é válido
 */
export function validateValue(value, rules = []) {
    return rules.map((rule) => rule(value)).filter(Boolean);
}

/**
 * Valida um objeto inteiro contra um esquema, sem DOM.
 * @returns {{valid:boolean, errors:Record<string,string[]>}}
 */
export function validateData(data, schema) {
    const errors = {};
    Object.entries(schema).forEach(([field, rules]) => {
        const list = validateValue(data[field], rules);
        if (list.length) errors[field] = list;
    });
    return { valid: Object.keys(errors).length === 0, errors };
}

/** Limpa um texto livre para gravar: trim e espaços internos colapsados. */
export const sanitizeText = (value, max = 280) =>
    String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/* ============================================================
   2. FEEDBACK NO DOM
   ============================================================ */

function feedbackFor(input) {
    const id = `${input.id}Feedback`;
    let node = document.getElementById(id);
    if (!node) {
        node = document.createElement('div');
        node.id = id;
        node.className = 'invalid-feedback';
        // Dentro de um input-group o feedback fica depois do grupo inteiro.
        const anchor = input.closest('.input-group') ?? input;
        anchor.insertAdjacentElement('afterend', node);
    }
    return node;
}

function describe(input, id, on) {
    const ids = new Set((input.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
    if (on) ids.add(id); else ids.delete(id);
    if (ids.size) input.setAttribute('aria-describedby', [...ids].join(' '));
    else input.removeAttribute('aria-describedby');
}

/** Mostra (ou limpa, com mensagem vazia) o erro de um campo. */
export function showFieldError(input, message) {
    if (!input) return;
    const node = feedbackFor(input);
    const invalid = Boolean(message);
    node.textContent = message;
    node.classList.toggle('d-block', invalid);
    input.classList.toggle('is-invalid', invalid);
    input.setAttribute('aria-invalid', String(invalid));
    describe(input, node.id, invalid);
}

export const clearFieldError = (input) => showFieldError(input, '');

/** Marca um campo como válido (borda de sucesso) depois de corrigido. */
export function markFieldValid(input, valid = true) {
    if (!input) return;
    input.classList.toggle('is-valid', valid);
}

function valueOf(form, id) {
    const field = form.querySelector(`#${CSS.escape(id)}`);
    if (!field) return undefined;
    // Grupo de opções: o "campo" é um container com data-group.
    // data-group="radio" devolve um valor; qualquer outro, a lista marcada.
    if (field.dataset.group !== undefined) {
        const checked = Array.from(field.querySelectorAll('input:checked')).map((input) => input.value);
        return field.dataset.group === 'radio' ? (checked[0] ?? '') : checked;
    }
    return field.value;
}

/**
 * Valida um formulário inteiro.
 * @param {HTMLFormElement} form
 * @param {Record<string, Function[]>} schema  { idDoCampo: [regras] }
 * @returns {{valid:boolean, errors:Record<string,string[]>, firstInvalid:HTMLElement|null, values:Record<string,any>}}
 */
export function validateForm(form, schema) {
    const errors = {};
    const values = {};
    let firstInvalid = null;

    Object.entries(schema).forEach(([id, rules]) => {
        const field = form.querySelector(`#${CSS.escape(id)}`);
        const value = valueOf(form, id);
        values[id] = value;
        const list = validateValue(value, rules);
        if (list.length) {
            errors[id] = list;
            firstInvalid ??= field;
        }
        showFieldError(field, list[0] ?? '');
        markFieldValid(field, list.length === 0 && String(value ?? '').length > 0 && field?.dataset.group === undefined);
    });

    return { valid: Object.keys(errors).length === 0, errors, firstInvalid, values };
}

/**
 * Validação ao vivo: ao sair do campo (blur) e, depois do primeiro erro,
 * também enquanto a pessoa digita, para o aviso sumir no momento em que
 * o problema foi resolvido.
 */
export function bindLiveValidation(form, schema) {
    Object.entries(schema).forEach(([id, rules]) => {
        const field = form.querySelector(`#${CSS.escape(id)}`);
        if (!field) return;

        const check = () => {
            const list = validateValue(valueOf(form, id), rules);
            showFieldError(field, list[0] ?? '');
            markFieldValid(field, list.length === 0 && String(valueOf(form, id) ?? '').length > 0 && field.dataset.group === undefined);
        };

        const event = field.dataset.group !== undefined || field.tagName === 'SELECT' ? 'change' : 'blur';
        field.addEventListener(event, check);
        field.addEventListener('input', () => {
            if (field.classList.contains('is-invalid')) check();
        });
    });
}

/**
 * Mensagem de status do formulário inteiro (sucesso ou erro geral),
 * anunciada por leitores de tela. Usa um nó [data-form-status] dentro
 * do form, criado se não existir.
 */
export function showFeedback(form, { type = 'success', message = '' } = {}) {
    if (!form) return;
    let node = form.querySelector('[data-form-status]');
    if (!node) {
        node = document.createElement('p');
        node.dataset.formStatus = '';
        node.setAttribute('role', 'status');
        node.setAttribute('aria-live', 'polite');
        form.appendChild(node);
    }
    node.className = `form-status form-status--${type}`;
    node.textContent = message;
    node.hidden = !message;
}

/** Leva o foco ao primeiro campo inválido, rolando até ele. */
export function focusFirstInvalid(result) {
    const target = result?.firstInvalid;
    if (!target) return;
    const focusable = target.matches('input, select, textarea, button')
        ? target
        : target.querySelector('input, select, textarea, button');
    focusable?.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'center', behavior: 'auto' });
}
