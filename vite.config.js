import { resolve } from 'node:path';

/**
 * Vite is a DEV TOOL ONLY.
 *
 * The application itself stays exactly what the brief asked for:
 * HTML5 + CSS3 + vanilla ES Modules, zero runtime dependencies.
 * Nothing here is imported by the product, no bundling step is
 * required to run it, and `python -m http.server` still serves the
 * same files identically.
 *
 * Vite is here purely for the developer experience: LAN access,
 * instant reload and correct MIME types.
 */
export default {
    // Multi-page: every .html is a real page, so a missing file must
    // 404 instead of silently falling back to index.html.
    appType: 'mpa',

    server: {
        host: true,        // bind 0.0.0.0 -> reachable from the LAN
        port: 5173,
        strictPort: false,
        open: false,
    },

    preview: {
        host: true,
        port: 4173,
    },

    // Each screen is a real entry point. Keeping the complete list here makes
    // direct links work in production instead of shipping index.html alone.
    build: {
        rollupOptions: {
            input: {
                home: resolve('index.html'),
                login: resolve('login.html'),
                onboarding: resolve('onboarding.html'),
                dashboard: resolve('dashboard.html'),
                library: resolve('library.html'),
                passport: resolve('passport.html'),
                achievements: resolve('achievements.html'),
                squads: resolve('squads.html'),
                settings: resolve('settings.html'),
            },
        },
    },
};
