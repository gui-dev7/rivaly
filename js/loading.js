/**
 * RIVALY — intro sequence for the landing page.
 *
 * The wordmark is the progress bar. A hard-edged yellow level rises
 * inside the letterforms; at 100% the V and the Y are physically
 * transformed into the >< brand symbol.
 *
 * Vanilla ES modules only. No framework, no animation library, no CDN.
 */

/* ============================================================
   GEOMETRY
   These mirror the SVG paths in index.html. Keeping them here as
   plain numbers means the choreography never has to call
   getBBox() mid-animation (which forces layout).
   ============================================================ */

const VIEW = { height: 132, centerX: 251.5, centerY: 50 };

/** Bounding centres, in SVG user units. */
const CENTER = {
    R: { x: 35, y: 50 },
    I: { x: 109.5, y: 50 },
    A: { x: 282, y: 50 },
    L: { x: 377, y: 50 },
    V: { x: 183, y: 50 },   // both limbs together: 68 wide x 100 deep
    Y: { x: 470, y: 30 },   // the two arms only:   66 wide x  60 deep
    YSTEM: { x: 470.5, y: 79 },
};

/*
   Both chevrons must land on the same 60-deep x 42-tall box, but they
   come from differently proportioned letters (the V is deep and narrow,
   the Y's arms are wide and shallow). Scaling each axis independently
   reconciles them; the numbers below are that reconciliation, not
   arbitrary tuning:

     V  rotated -90 : depth = 100 * scy -> 0.60 ,  height = 68 * scx -> 0.618
     Y  rotated  90 : depth =  60 * scy -> 1.00 ,  height = 66 * scx -> 0.636
*/
const CHEVRON = {
    depth: 76,   // final chevron length, in user units
    height: 52,  // final chevron opening
    V: { scx: 0.765, scy: 0.760 },   // 68*scx = 52 ,  100*scy = 76
    Y: { scx: 0.788, scy: 1.267 },   // 66*scx = 52 ,   60*scy = 76
};

/*
   Half the depth would make the two points touch exactly. The brand mark
   keeps a thin dark notch between them, so back off by a few units —
   without it the pair reads as a solid bowtie instead of >< .
*/
const NOTCH = 4;
const GAP_CLOSED = CHEVRON.depth / 2 + NOTCH;
const GAP_OPEN = 72;

const TIMING = {
    total: 3400,        // simulated load, 3-4s as specified
    holdAtFull: 380,    // pause on a completely yellow wordmark
    exitLetters: 520,   // R I A L leaving
    morph: 900,         // V -> >   and   Y -> <
    converge: 460,      // the two chevrons closing in
    impact: 200,
    holdSymbol: 520,
    brandIn: 460,
    toApp: 520,
};

/* ============================================================
   DOM
   ============================================================ */

const loader = document.getElementById('loader');
const mark = document.getElementById('mark');
const levelRect = document.getElementById('levelRect');
const pctValue = document.getElementById('pctValue');
const pctBlock = document.getElementById('loaderPct');
const brand = document.getElementById('loaderBrand');
const spark = document.getElementById('markSpark');
const pageRoot = document.querySelector('[data-app-root]');

const morph = {
    R: document.getElementById('pieceR'),
    I: document.getElementById('pieceI'),
    A: document.getElementById('pieceA'),
    L: document.getElementById('pieceL'),
    V: document.getElementById('chevronV'),
    Y: document.getElementById('chevronY'),
    YSTEM: document.getElementById('yStem'),
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Session behaviour: full show once, short version afterwards. */
const SESSION_KEY = 'rivaly:intro-seen';
const SKIP_LONG_INTRO = true; // flip to false to always play the full sequence

/* ============================================================
   HELPERS
   ============================================================ */

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/** Writes the shared transform contract onto one group. */
function setPiece(el, { tx = 0, ty = 0, rot = 0, scx = 1, scy = 1, op = 1, dur, delay = 0, origin }) {
    if (!el) return;
    if (origin) {
        el.style.setProperty('--ox', origin.x);
        el.style.setProperty('--oy', origin.y);
    }
    el.style.setProperty('--tx', tx);
    el.style.setProperty('--ty', ty);
    el.style.setProperty('--rot', `${rot}deg`);
    el.style.setProperty('--scx', scx);
    el.style.setProperty('--scy', scy);
    el.style.setProperty('--op', op);
    if (dur !== undefined) el.style.setProperty('--dur', `${dur}ms`);
    el.style.setProperty('--delay', `${delay}ms`);
}

/* ============================================================
   PROGRESS
   ============================================================ */

const milestonesFired = new Set();

/** Moves the level. 0 = fully below the letters, 100 = fully covering. */
function updateFill(value) {
    // Translate the clip rect up from below the baseline. One transform
    // on one element — no per-frame layout, no width/height writes.
    const shift = VIEW.height * (1 - value / 100);
    levelRect.setAttribute('transform', `translate(0 ${shift.toFixed(2)})`);
    mark.style.setProperty('--progress', value);
}

function updatePercentage(value) {
    const rounded = Math.round(value);
    // 00, 07, 64, 100 — always at least two digits.
    pctValue.textContent = rounded < 100 ? String(rounded).padStart(2, '0') : '100';
    loader.setAttribute('aria-valuenow', String(rounded));
}

/** Discrete, restrained reactions at specific thresholds. */
function handleMilestone(value) {
    if (value >= 50 && !milestonesFired.has(50)) {
        milestonesFired.add(50);
        if (!reduceMotion) {
            mark.classList.add('is-pulse');
            window.setTimeout(() => mark.classList.remove('is-pulse'), 500);
        }
    }
    if (value >= 75 && !milestonesFired.has(75)) {
        milestonesFired.add(75);
        mark.classList.add('is-hot');
    }
}

/**
 * The single public entry point.
 * @param {number} value 0-100
 */
export function setLoadingProgress(value) {
    const next = clamp(Number(value) || 0, 0, 100);
    updateFill(next);
    updatePercentage(next);
    handleMilestone(next);
    return next;
}

/* ============================================================
   SIMULATED LOAD
   Deliberately uneven: bursts, plateaus, and a slow last stretch.
   ============================================================ */

/** Keyframes of [fractionOfTotalTime, progress]. */
const LOAD_CURVE = [
    [0.00, 0], [0.06, 4], [0.12, 8], [0.19, 15], [0.26, 21],
    [0.33, 29], [0.40, 41], [0.47, 48], [0.55, 57], [0.62, 65],
    [0.69, 72], [0.76, 80], [0.83, 87], [0.90, 92], [0.95, 96],
    [0.98, 98], [1.00, 100],
];

function progressAt(t) {
    for (let i = 1; i < LOAD_CURVE.length; i += 1) {
        const [t1, p1] = LOAD_CURVE[i];
        if (t <= t1) {
            const [t0, p0] = LOAD_CURVE[i - 1];
            const span = t1 - t0 || 1;
            return p0 + (p1 - p0) * ((t - t0) / span);
        }
    }
    return 100;
}

function simulateLoading(duration = TIMING.total) {
    return new Promise((resolve) => {
        const started = performance.now();

        const frame = (now) => {
            const t = clamp((now - started) / duration, 0, 1);
            setLoadingProgress(progressAt(t));
            if (t < 1) {
                window.requestAnimationFrame(frame);
            } else {
                setLoadingProgress(100);
                resolve();
            }
        };

        window.requestAnimationFrame(frame);
    });
}

/* ============================================================
   MORPH
   V -> >   and   Y -> <
   ============================================================ */

/** Seeds every group at its resting position so the first transition
 *  animates from the wordmark, not from a default state. */
function primeMorph() {
    Object.entries(CENTER).forEach(([key, origin]) => {
        setPiece(morph[key], { origin, dur: 0 });
    });
    // Force the browser to accept the seeded state before we change it.
    void mark.getBoundingClientRect();
}

/** R I A L leave: fade, drift down, spread outward from the centre. */
function exitLetters() {
    const drift = [
        ['R', -26], ['I', -14], ['A', 14], ['L', 26],
    ];
    drift.forEach(([key, dx], index) => {
        setPiece(morph[key], {
            origin: CENTER[key],
            tx: dx,
            ty: 16,
            scx: 0.94, scy: 0.94,
            op: 0,
            dur: TIMING.exitLetters,
            delay: index * 40,
        });
    });
}

/**
 * The V rotates a quarter turn counter-clockwise: its two limbs, which
 * met at a downward point, now meet at a rightward point. That is a `>`.
 * The Y does the mirror: its two arms met at an upward point, so a
 * clockwise quarter turn makes a `<`. Nothing is swapped out.
 */
function morphLogo() {
    // Stem of the Y retracts into the join and fades.
    setPiece(morph.YSTEM, {
        origin: CENTER.YSTEM,
        ty: -18,
        scx: 0.2, scy: 0.2,
        op: 0,
        dur: 420,
    });

    placeChevrons(GAP_OPEN, TIMING.morph, 90);
}

/** Positions both chevrons at a given distance from the mark centre. */
function placeChevrons(gap, dur, delay = 0) {
    // V -> >  (point faces right, sits left of centre)
    setPiece(morph.V, {
        origin: CENTER.V,
        tx: VIEW.centerX - gap - CENTER.V.x,
        ty: VIEW.centerY - CENTER.V.y,
        rot: -90,
        scx: CHEVRON.V.scx,
        scy: CHEVRON.V.scy,
        dur,
        delay,
    });

    // Y -> <  (point faces left, sits right of centre)
    setPiece(morph.Y, {
        origin: CENTER.Y,
        tx: VIEW.centerX + gap - CENTER.Y.x,
        ty: VIEW.centerY - CENTER.Y.y,
        rot: 90,
        scx: CHEVRON.Y.scx,
        scy: CHEVRON.Y.scy,
        dur,
        delay,
    });
}

/** The last few units of the gap close, so the two chevrons touch. */
function convergeChevrons() {
    placeChevrons(GAP_CLOSED, TIMING.converge);
}

/** Accountct: a tight overshoot plus one short horizontal rule. */
function playImpact() {
    if (reduceMotion) return;

    mark.animate(
        [
            { transform: 'scale(1)' },
            { transform: 'scale(1.03)', offset: 0.4 },
            { transform: 'scale(1)' },
        ],
        { duration: TIMING.impact, easing: 'cubic-bezier(0.2,0.9,0.3,1)' }
    );

    spark.animate(
        [
            { width: '0px', x: '251.5px', opacity: 0.9 },
            { width: '150px', x: '176.5px', opacity: 0.55, offset: 0.5 },
            { width: '210px', x: '146.5px', opacity: 0 },
        ],
        { duration: 340, easing: 'cubic-bezier(0.2,0.9,0.3,1)' }
    );
}

/* ============================================================
   FINALE
   ============================================================ */

function showFinalBrand() {
    pctBlock.classList.add('is-done');
    brand.classList.add('is-in');
    brand.removeAttribute('aria-hidden');
}

async function transitionToApp() {
    // The page is already rendered underneath the opaque loader, so this
    // is a reveal, not a mount: fade the cover out and let the content
    // settle into place.
    loader.classList.add('is-leaving');
    pageRoot?.classList.remove('is-pending');
    pageRoot?.classList.add('is-revealed');

    await wait(TIMING.toApp);
    loader.remove();
}

/* ============================================================
   SEQUENCE
   ============================================================ */

async function completeLoading() {
    await wait(TIMING.holdAtFull);

    if (reduceMotion) {
        // No choreography: state the result and move on.
        showFinalBrand();
        await wait(600);
        await transitionToApp();
        return;
    }

    mark.classList.add('is-morphing');
    primeMorph();

    exitLetters();
    morphLogo();
    await wait(TIMING.morph + 120);

    convergeChevrons();
    await wait(TIMING.converge);

    playImpact();
    await wait(TIMING.impact + 80);

    showFinalBrand();
    await wait(TIMING.holdSymbol + TIMING.brandIn);

    await transitionToApp();
}

/** Short version for repeat navigations in the same session. */
async function runShortIntro() {
    await simulateLoading(900);
    await wait(160);
    showFinalBrand();
    await wait(320);
    await transitionToApp();
}

function initLoading() {
    if (!loader || !mark) return;

    // The markup ships with the loader hidden so a JS failure leaves the
    // page usable. From here on this module owns the reveal.
    loader.hidden = false;
    pageRoot?.classList.add('is-pending');

    setLoadingProgress(0);
    primeMorph();

    // ?autoplay=0 holds the screen at 0% so the sequence can be driven by
    // hand from the console (or by an automated visual check) with
    // setLoadingProgress(). Nothing else in the page depends on it.
    if (new URLSearchParams(window.location.search).get('autoplay') === '0') {
        return;
    }

    const seen = SKIP_LONG_INTRO && window.sessionStorage?.getItem(SESSION_KEY) === '1';

    const run = seen
        ? runShortIntro()
        : simulateLoading().then(completeLoading);

    run.then(() => {
        try {
            window.sessionStorage?.setItem(SESSION_KEY, '1');
        } catch {
            /* Private mode: the intro simply plays again. Not worth failing over. */
        }
    });
}

/* ============================================================
   BOOT
   ============================================================ */

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoading, { once: true });
} else {
    initLoading();
}

/* Exposed for manual testing:  setLoadingProgress(50)  */
window.setLoadingProgress = setLoadingProgress;

/* Lets the landing offer a "replay intro" control without importing this
   module twice. */
window.replayRivalyIntro = () => {
    try {
        window.sessionStorage?.removeItem(SESSION_KEY);
    } catch { /* ignore */ }
    window.location.reload();
};
