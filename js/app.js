/**
 * app.js — shared bootstrap.
 *
 * Two entry points:
 *   bootPublic()  → landing / login / onboarding (no auth chrome)
 *   bootApp()     → every signed-in page (guard + chrome + motion)
 *
 * Page controllers import one of these, then render their own content.
 */

import { initStorage, getSettings, getUser } from './storage.js';
import { requireAuth } from './auth.js';
import { mountNavigation } from './navigation.js';
import { animateProgressBars, initScrollReveal } from './animations.js';

/**
 * Halts a page controller after a guard has triggered a redirect.
 *
 * `window.location.replace()` does not stop the current script, so the
 * rest of the module would keep running against a missing user and
 * throw. Awaiting a promise that never settles stops evaluation
 * cleanly — no exception, no console noise.
 *
 * Usage:  if (!user) await haltModule();
 */
export const haltModule = () => new Promise(() => {});

/**
 * Artwork fallback.
 *
 * Every generated <img> carries `data-fallback`. If the file is missing or
 * fails to decode, the element is removed so the CSS gradient underneath
 * shows instead — the user never sees a broken-image icon, and the layout
 * does not shift.
 *
 * Registered in the CAPTURE phase because `error` on <img> does not bubble.
 * One listener covers every image on the page, including ones rendered later.
 */
function initArtworkFallback() {
    if (document.documentElement.dataset.artFallback === 'on') return;
    document.documentElement.dataset.artFallback = 'on';

    document.addEventListener(
        'error',
        (event) => {
            const node = event.target;
            if (node instanceof HTMLImageElement && node.dataset.fallback !== undefined) {
                node.remove();
            }
        },
        true
    );
}

/** Applies persisted preferences to the document root. */
export function applySettings() {
    const settings = getSettings();
    document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
    document.documentElement.dataset.density = settings.compactDensity ? 'compact' : 'comfortable';
}

/** Bootstrap for pages that do not require a session. */
export function bootPublic() {
    initStorage();
    applySettings();
    initArtworkFallback();
    initScrollReveal();
    return true;
}

/**
 * Bootstrap for authenticated pages.
 * Returns the user, or null when the guard has already redirected —
 * callers must check and bail out.
 *
 * @param {{page:string, title:string, subtitle?:string, requireOnboarding?:boolean}} options
 */
export function bootApp({ page, title, subtitle = '', requireOnboarding = true }) {
    initStorage();
    applySettings();
    initArtworkFallback();

    if (!requireAuth({ requireOnboarding })) return null;

    const user = getUser();
    mountNavigation({ page, title, subtitle });

    // Chrome progress bars animate on load; page content animates when
    // its own controller has finished rendering.
    animateProgressBars(document);
    initScrollReveal();

    return user;
}

/**
 * Small helper for page controllers: run after painting content so
 * bars and reveals pick up freshly inserted nodes.
 */
export function afterRender(scope = document) {
    animateProgressBars(scope);
    initScrollReveal(scope);
}
