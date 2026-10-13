/**
 * app.js — shared bootstrap.
 *
 * Three entry points:
 *   bootPublic()  → landing / login / onboarding / 404 (no auth chrome)
 *   bootApp()     → every signed-in page (guard + chrome + motion)
 *   bootHybrid()  → the site map: app chrome when signed in, the public
 *                   navbar when not
 *
 * The chrome itself (navbar, offcanvas, bottom nav, footer) is static
 * Bootstrap markup in each HTML file; see tools/sync-chrome.mjs.
 * Page controllers import one of these, then render their own content.
 */

import { initStorage, getSettings, getUser } from './storage.js';
import { requireAuth, isAuthenticated } from './auth.js';
import { mountNavigation, markPublicNavigation } from './navigation.js';
import { animateProgressBars, initScrollReveal } from './animations.js';
import { applyBrandArt } from './brand.js';
import { initTour } from './tour.js';

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
 * Artwork lifecycle: loading -> loaded | fallback.
 *
 * Every generated game <img> carries `data-fallback`, and usually a
 * `data-fallbacks` list of alternates (built by game-assets.js). On an
 * error this walks that list one entry at a time; when it runs out, the
 * element is removed so the CSS artwork underneath shows through. The
 * user never sees a broken-image icon and the layout never shifts.
 *
 * Both listeners are registered in the CAPTURE phase because `load` and
 * `error` on <img> do not bubble. Two listeners cover every image on the
 * page, including everything rendered later.
 */
function initArtworkFallback() {
    if (document.documentElement.dataset.artFallback === 'on') return;
    document.documentElement.dataset.artFallback = 'on';

    const settle = (img) => img.closest('.is-loading')?.classList.remove('is-loading');

    document.addEventListener('load', (event) => {
        const node = event.target;
        if (node instanceof HTMLImageElement && node.dataset.fallback !== undefined) {
            node.classList.add('is-loaded');
            settle(node);
        }
    }, true);

    document.addEventListener('error', (event) => {
        const node = event.target;
        if (!(node instanceof HTMLImageElement) || node.dataset.fallback === undefined) return;

        const remaining = (node.dataset.fallbacks ?? '').split('|').filter(Boolean);
        if (remaining.length > 0) {
            // Try the next URL in the chain (e.g. library_hero -> header).
            node.dataset.fallbacks = remaining.slice(1).join('|');
            node.src = remaining[0];
            return;
        }

        // Chain exhausted: reveal the Rivaly fallback underneath.
        settle(node);
        node.remove();
    }, true);
}

/** Applies persisted preferences to the document root. */
export function applySettings() {
    const settings = getSettings();
    document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
    document.documentElement.dataset.density = settings.compactDensity ? 'compact' : 'comfortable';

    // The default identity lives on :root, so the attribute is only set for
    // the alternative palettes — an unset theme must fall back to it.
    const theme = settings.theme ?? 'rivaly';
    if (theme === 'rivaly') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;

    // A marca tem uma versão colorida por tema; trocar a paleta sem trocar
    // a arte deixaria um logo amarelo sobre um fundo rosa.
    applyBrandArt(theme);
}

/**
 * Bootstrap tooltips are opt-in: every [data-bs-toggle="tooltip"] on the
 * page (and inside content rendered later) gets one instance.
 */
export function initTooltips(scope = document) {
    if (!window.bootstrap?.Tooltip) return;
    scope.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((node) => {
        window.bootstrap.Tooltip.getOrCreateInstance(node);
    });
}

/** Bootstrap for pages that do not require a session. */
export function bootPublic({ page = '' } = {}) {
    initStorage();
    applySettings();
    initArtworkFallback();
    initScrollReveal();
    if (page) markPublicNavigation(page);
    applyBrandArt(document.documentElement.dataset.theme ?? 'rivaly');
    initTooltips();
    return true;
}

/**
 * The site map is public, but a signed-in visitor should not lose the app
 * navigation on the way there. <html data-auth> switches which chrome is
 * visible (see css/layout.css).
 * @returns {object|null} the user when signed in, null otherwise
 */
export function bootHybrid({ page, title, subtitle = '' }) {
    initStorage();
    applySettings();
    initArtworkFallback();

    const user = isAuthenticated() ? getUser() : null;
    const signedIn = Boolean(user?.onboardingComplete);
    document.documentElement.dataset.auth = signedIn ? 'in' : 'out';

    if (signedIn) {
        mountNavigation({ page, title, subtitle });
        animateProgressBars(document);
    } else {
        markPublicNavigation(page);
    }

    initScrollReveal();
    applyBrandArt(document.documentElement.dataset.theme ?? 'rivaly');
    initTooltips();
    return signedIn ? user : null;
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
    applyBrandArt(document.documentElement.dataset.theme ?? 'rivaly');
    initTooltips();
    initTour();

    return user;
}

/**
 * Small helper for page controllers: run after painting content so
 * bars and reveals pick up freshly inserted nodes.
 */
export function afterRender(scope = document) {
    animateProgressBars(scope);
    initScrollReveal(scope);
    initTooltips(scope);
}
