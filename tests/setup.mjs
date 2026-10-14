/**
 * setup.mjs — ambiente mínimo para testar o domínio no Node.
 *
 * Os módulos de regra (storage, stores, community, rng, validation...) não
 * dependem de tela, mas alguns efeitos colaterais avisam a interface (toast,
 * celebração de conquista). Aqui ficam:
 *   - um localStorage/sessionStorage em memória (o storage.js segue sendo a
 *     única porta para eles);
 *   - um "DOM" de mentira, só o bastante para os avisos não quebrarem;
 *   - temporizadores com unref(), para o processo terminar sem esperar as
 *     animações de 5 segundos das celebrações.
 *
 * Importe este arquivo ANTES de qualquer módulo de js/.
 */

const memory = (store = new Map()) => ({
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (index) => [...store.keys()][index] ?? null,
});

const noop = () => {};

function fakeElement() {
    const element = {
        dataset: {},
        style: {},
        children: [],
        classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
        setAttribute: noop,
        removeAttribute: noop,
        getAttribute: () => null,
        addEventListener: noop,
        removeEventListener: noop,
        appendChild: (child) => child,
        append: noop,
        remove: noop,
        focus: noop,
        insertAdjacentHTML: noop,
        querySelector: () => fakeElement(),
        querySelectorAll: () => [],
        contains: () => true,
        isConnected: false,
        set innerHTML(_) { /* ignorado */ },
        get innerHTML() { return ''; },
        textContent: '',
    };
    return element;
}

const unrefTimer = (fn, ms) => {
    const timer = setTimeout(fn, ms);
    timer.unref?.();
    return timer;
};

globalThis.window = {
    localStorage: memory(),
    sessionStorage: memory(),
    setTimeout: unrefTimer,
    clearTimeout,
    setInterval: (fn, ms) => { const t = setInterval(fn, ms); t.unref?.(); return t; },
    clearInterval,
    matchMedia: () => ({ matches: false, addEventListener: noop }),
    requestAnimationFrame: (fn) => unrefTimer(fn, 0),
    crypto: globalThis.crypto,
};

globalThis.document = {
    documentElement: { dataset: {} },
    body: { contains: () => true, appendChild: (child) => child, classList: { add: noop, remove: noop } },
    createElement: fakeElement,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: noop,
};

/** Apaga tudo entre um teste e outro. */
export function resetStorage() {
    globalThis.window.localStorage.clear();
    globalThis.window.sessionStorage.clear();
}
