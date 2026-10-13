/**
 * animations.js — motion utilities driven from JavaScript.
 *
 * CSS owns everything it can (transitions, keyframes, stagger delays).
 * This module only exists for the things CSS genuinely cannot do:
 * counting numbers, sequencing a reveal, and observing the viewport.
 *
 * Every function here degrades to an instant, final-state result when
 * the user prefers reduced motion — nothing is ever hidden as a
 * side effect of disabling animation.
 */

/** Reads both the OS preference and the in-app Settings override. */
export function prefersReducedMotion() {
    if (document.documentElement.dataset.motion === 'reduced') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

/* ============================================================
   COUNT UP
   ============================================================ */

/**
 * Animates a number from `from` to `to` inside an element.
 * Uses requestAnimationFrame with an eased curve, and always lands
 * exactly on `to` (no floating point drift on the final frame).
 */
export function countUp(element, to, { from = 0, duration = 1100, format = (value) => Math.round(value).toLocaleString('en-US'), suffix = '' } = {}) {
    if (!element) return Promise.resolve();

    const target = Number(to) || 0;
    const start = Number(from) || 0;

    if (prefersReducedMotion() || duration <= 0) {
        element.textContent = format(target) + suffix;
        return Promise.resolve();
    }

    // Cancel a previous animation on the same element.
    if (element._countFrame) window.cancelAnimationFrame(element._countFrame);

    return new Promise((resolve) => {
        const startedAt = performance.now();

        const step = (now) => {
            const elapsed = now - startedAt;
            const t = Math.min(1, elapsed / duration);
            const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
            element.textContent = format(start + (target - start) * eased) + suffix;

            if (t < 1) {
                element._countFrame = window.requestAnimationFrame(step);
            } else {
                element.textContent = format(target) + suffix;
                element._countFrame = null;
                resolve();
            }
        };

        element._countFrame = window.requestAnimationFrame(step);
    });
}

/* ============================================================
   PROGRESS BARS
   ============================================================ */

/**
 * Grows every `[data-progress]` fill inside `scope` to its value.
 * The double rAF guarantees the browser has painted `scaleX(0)`
 * before the transition to the real value starts.
 */
export function animateProgressBars(scope = document, { delay = 60 } = {}) {
    const fills = Array.from(scope.querySelectorAll('[data-progress]'));
    if (fills.length === 0) return;

    const apply = () => {
        fills.forEach((fill, index) => {
            const value = Math.max(0, Math.min(100, Number(fill.dataset.progress) || 0));
            const run = () => {
                fill.style.transform = `scaleX(${value / 100})`;
            };
            if (prefersReducedMotion()) run();
            else window.setTimeout(run, index * delay);
        });
    };

    window.requestAnimationFrame(() => window.requestAnimationFrame(apply));
}

/* ============================================================
   SCROLL REVEAL
   ============================================================ */

let revealObserver = null;

/**
 * Reveals `[data-reveal]` elements as they enter the viewport.
 * Elements are only hidden once the observer exists, so a page with
 * JavaScript disabled still shows all of its content.
 */
export function initScrollReveal(scope = document) {
    const targets = Array.from(scope.querySelectorAll('[data-reveal]'));
    if (targets.length === 0) return;

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
        targets.forEach((element) => element.classList.add('is-visible'));
        return;
    }

    targets.forEach((element) => element.classList.add('reveal'));

    if (!revealObserver) {
        revealObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    const delay = Number(entry.target.dataset.revealDelay) || 0;
                    window.setTimeout(() => entry.target.classList.add('is-visible'), delay);
                    revealObserver.unobserve(entry.target); // one-shot
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
        );
    }

    targets.forEach((element) => revealObserver.observe(element));
}

/* ============================================================
   SEQUENCES
   ============================================================ */

/**
 * Runs an ordered list of steps with a pause between each.
 * Used by the DNA Gamer reveal and the Buscar Squad scan.
 *
 * @param {Array<{run: Function, wait?: number}>} steps
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function runSequence(steps, { signal } = {}) {
    const scale = prefersReducedMotion() ? 0.12 : 1;

    for (const step of steps) {
        if (signal?.aborted) return false;
        await step.run();
        if (step.wait) await wait(step.wait * scale);
    }
    return true;
}

/* ============================================================
   TYPEWRITER
   ============================================================ */

export async function typewrite(element, text, { speed = 26 } = {}) {
    if (!element) return;
    if (prefersReducedMotion()) {
        element.textContent = text;
        return;
    }
    element.textContent = '';
    for (const character of text) {
        element.textContent += character;
        // eslint-disable-next-line no-await-in-loop -- sequential by design
        await wait(speed);
    }
}

/* ============================================================
   POINTER LIGHTING
   Used by the shareable Passport card. Attaches one listener,
   writes two custom properties, and lets CSS do the rest.
   ============================================================ */

export function attachPointerLight(element) {
    if (!element || window.matchMedia('(hover: none)').matches) return () => {};

    const onMove = (event) => {
        const rect = element.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        element.style.setProperty('--pointer-x', `${x}%`);
        element.style.setProperty('--pointer-y', `${y}%`);
        if (!prefersReducedMotion()) {
            // Deliberately subtle: max ~4deg. A stronger tilt reads as a gimmick.
            element.style.setProperty('--tilt-x', `${((y - 50) / 50) * -3.5}deg`);
            element.style.setProperty('--tilt-y', `${((x - 50) / 50) * 3.5}deg`);
        }
    };

    const onLeave = () => {
        element.style.setProperty('--pointer-x', '50%');
        element.style.setProperty('--pointer-y', '0%');
        element.style.setProperty('--tilt-x', '0deg');
        element.style.setProperty('--tilt-y', '0deg');
    };

    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);

    return () => {
        element.removeEventListener('pointermove', onMove);
        element.removeEventListener('pointerleave', onLeave);
    };
}

/* ============================================================
   HEADER STICKINESS (landing / marketing pages)
   ============================================================ */

export function initStickyHeader(header) {
    if (!header) return;
    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
    document.body.prepend(sentinel);

    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
        ([entry]) => header.classList.toggle('is-stuck', !entry.isIntersecting),
        { threshold: 0 }
    );
    observer.observe(sentinel);
}
