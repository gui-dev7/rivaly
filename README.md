# RIVALY — V1 (Vanilla)

> **Rival + Ally.** Your game. Your identity. Your squad.
> A gamified web platform built around a single idea: a product that understands
> *who the player is*, and uses that identity to personalise everything else.

---

## Overview

RIVALY is a digital ecosystem for gamers. Its centre is the **Gamer Passport** —
a living record that holds a player's nickname, avatar, platforms, games, behavioural
profile, level, reputation and badges. Every other feature in the product either
*reads* the Passport or *enriches* it.

This repository is **V1**, an academic build deliberately restricted to
**HTML5, CSS3 and vanilla JavaScript**. No framework, no CSS library, no runtime
dependency and no backend.

## Objective

Demonstrate command of the web platform's fundamentals — the DOM, native Web APIs,
CSS Grid/Flexbox, custom properties, animations and `localStorage` — by building a
product that *feels* like a real application rather than a website about games.

A future **V2** will remodel the same product using **React + Tailwind CSS**. The
architecture here was chosen to make that migration a translation, not a rewrite.

---

## Technologies

```text
HTML5              semantic markup, native form validation, Drag & Drop API
CSS3               custom properties, Grid, Flexbox, animations, clip-path, backdrop-filter
Vanilla JavaScript ES2022 modules, classes-free functional composition, Web APIs
LocalStorage       namespaced persistence layer
```

**Zero runtime dependencies and zero external requests.** No CDN, no analytics, no
font host, no image host. Everything the app needs is a local file.

- **Icons** — hand-authored inline SVG (`js/ui.js`), including the platform glyphs.
- **Avatars** — generated procedurally from a deterministic hash. No source imagery.
- **Typefaces** — Anton + Chakra Petch, self-hosted as 45 KB of latin-subset
  `.woff2`. A Google Fonts `<link>` would have added an external dependency and
  broken offline rendering.
- **Game artwork** — 32 covers and 25 banners, fetched once by
  `tools/fetch-assets.mjs` and stored as WebP (~1.2 MB total). See
  [Game artwork](#game-artwork) below.

---

## Running locally

The project uses **native ES Modules**, which browsers refuse to load over `file://`
for security reasons. Serve the folder over HTTP with any static server:

```bash
# Windows: just double-click
start.bat

# macOS / Linux
./start.sh

# or by hand
python -m http.server 5500     # Python, zero setup
npx serve .                    # Node

# VS Code
Right-click index.html → "Open with Live Server"
```

Then open <http://localhost:5500>.

### Vite (optional, for LAN access)

```bash
npm install     # once
npm run host    # serves on 0.0.0.0:5173
```

Vite prints a `Network:` URL you can open from a phone or another machine on the
same Wi-Fi.

**Vite is a dev tool only.** It is a `devDependency`; the application imports nothing
from it, needs no build step, and `python -m http.server` serves the identical files.
The zero-runtime-dependency guarantee is unaffected.

On Windows the firewall blocks inbound 5173 by default. To allow it (once, from an
**elevated** PowerShell):

```powershell
New-NetFirewallRule -DisplayName "Vite dev 5173" -Direction Inbound `
  -Protocol TCP -LocalPort 5173 -Action Allow -Profile Any
```

`-Profile Any` matters: on a corporate/domain Wi-Fi the active profile is `Domain`,
not `Private`, so a Private-only rule silently does nothing. Check yours with
`Get-NetConnectionProfile`.

On a managed corporate network the access point may also enforce client isolation,
which blocks device-to-device traffic regardless of the firewall. If the phone still
cannot reach the URL after opening the port, that is the cause — a phone hotspot
shared with the laptop is the quickest way around it.

### Signing in

There is no server, so any account you create is stored locally and works immediately.

**Fastest path — the demo account.** On the login screen, click
**"Enter with a demo account"**. It builds a finished Passport (DNA resolved, 14 games,
a saved squad, the badges those actions unlock) and drops you on the dashboard. Use it
to evaluate the product without walking the onboarding each time.

**Your own account.** Click *Create passport*, fill in any nickname, any email and a
password of 6+ characters, then answer the ten DNA questions. Nothing is validated
against a server, and nothing leaves the browser.

```text
Demo credentials, if you prefer the normal form:
  email     demo@happygame.local
  password  demo1234
```

Signed-in state lives in `localStorage`. To start over, use
**Settings → Reset demo data**, or the demo button again.

Opening `index.html` directly still works in the sense that it will not fail
silently — a banner explains the problem and shows the command above.

---

## Features

| Area | What it does |
| --- | --- |
| **Landing page** | Animated Gamer Passport that assembles itself, feature tour, the real engine weights, honest roadmap |
| **Auth (simulated)** | Local sign-up / sign-in, live validation, password visibility toggle, one-click demo account, explicit academic-demo disclaimer |
| **Onboarding** | Six-stage guided journey: welcome → profile (3 steps) → Gamer DNA → analysis → archetype reveal → Passport created |
| **Gamer DNA** | 10 questions → 6 weighted attributes → 1 of 11 archetypes, fully deterministic |
| **Gamer Passport** | Shareable card with pointer lighting, identity block, completion meter, full DNA analysis, preferences, library signature, badge case |
| **Game Library** | Full CRUD, 5 statuses, real cover artwork, native drag & drop between statuses, search, sort, ratings, hours, per-platform tracking |
| **Squad Finder** | Six-filter search, staged scanning sequence, ranked results, transparent per-factor breakdown, saved squad |
| **Compatibility Engine** | 7 weighted factors, 0–100 score, explains both earned and lost points |
| **Gamification** | XP for real actions, scaling level curve, level-up celebration, 20 achievements across 5 rarities, Gamer Score, reputation |
| **Notifications** | Custom toast system (5 types) plus achievement and level-up overlays. `alert()` is never used |
| **Settings** | Reduced motion, toast toggle, compact density, storage transparency table, JSON export, demo reset |

---

## Folder structure

```text
rivaly/
│
├── index.html              Landing page
├── login.html              Sign in / create account
├── onboarding.html         Welcome → profile → DNA → reveal → passport
├── dashboard.html          Post-login home
├── passport.html           The Gamer Passport
├── library.html            Game Library
├── squads.html             Squad Finder + Compatibility Engine
├── achievements.html       Badge collection
├── settings.html           Preferences and local data
│
├── start.bat / start.sh    One-click local server
│
├── tools/
│   └── fetch-assets.mjs    DEV ONLY — downloads + optimises the game artwork
│
├── public/assets/
│   ├── covers/             32 game covers, WebP 360x540 (~700 KB)
│   └── banners/            25 wide key-art banners, WebP 480x224 (~550 KB)
│
├── assets/
│   ├── fonts/              Anton + Chakra Petch (latin subset, 45 KB)
│   └── ATTRIBUTION.md      Where every asset came from, and its licence
│
├── css/
│   ├── fonts.css           @font-face declarations
│   ├── loading.css         Intro loader (layered over the landing)
│   ├── reset.css           Minimal reset + reduced-motion handling
│   ├── variables.css       ALL design tokens (the only file with raw colours)
│   ├── global.css          Base typography, ambient field, focus, scrollbar
│   ├── layout.css          App shell, sidebar, topbar, bottom nav, grids, breakpoints
│   ├── components.css      Every reusable component
│   ├── animations.css      Keyframes, stagger, reveal, skeletons
│   │
│   └── pages/
│       ├── landing.css
│       ├── login.css
│       ├── onboarding.css
│       ├── dashboard.css
│       ├── passport.css
│       ├── library.css
│       ├── squads.css
│       ├── achievements.css
│       └── settings.css
│
└── js/
    ├── app.js              Shared bootstrap (bootPublic / bootApp / afterRender)
    ├── storage.js          The ONLY module that touches localStorage
    ├── auth.js             Simulated authentication + route guards
    ├── data.js             Entire dataset: games, players, questions, archetypes, badges, XP rules
    ├── profile.js          Passport shape, Gamer ID, completion
    ├── gamer-dna.js        DNA scoring + archetype resolution
    ├── gamification.js     XP, levels, achievements, reputation, Gamer Score
    ├── compatibility.js    The Compatibility Engine
    ├── library-store.js    Library CRUD (pure data layer)
    ├── activity.js         Local activity ledger
    ├── navigation.js       Sidebar / topbar / bottom nav + mobile drawer
    ├── notifications.js    Toasts + celebration overlays
    ├── modal.js            One accessible dialog implementation
    ├── animations.js       countUp, sequences, IntersectionObserver, pointer light
    ├── ui.js               DOM helpers, formatters, icons, procedural avatars & covers
    ├── cards.js            Shared markup blocks (future React components)
    ├── demo.js             One-click demo profile (uses the real CRUD + achievement engine)
    ├── loading.js          Intro sequence: the wordmark fills, then V+Y become ><
    │
    └── landing.js · login.js · onboarding.js · dashboard.js · library.js
        squads.js · passport.js · achievements.js · settings.js      ← page controllers
```

Two modules go beyond the original brief, for good reason:

- **`library-store.js`** separates library *data operations* from the library *page*,
  so onboarding can seed the library without importing DOM code.
- **`cards.js`** holds the markup blocks shared by four pages, which is exactly the
  set that becomes React components in V2.

---

## Design system

### Identity: black + yellow

One accent colour on true black. The palette is deliberately narrow because a dark
interface with three or four decorative hues is exactly what reads as a stock template.

```css
--rgb-primary: 255, 212, 0;   /* #FFD400 — rivaly yellow */
--rgb-ink:       5,   5, 5;   /* #050505 — the black everything sits on */
--rgb-bone:    245, 245, 242; /* #F5F5F2 — the light neutral */
```

Every brand colour in the project resolves from those three lines. Transparency is
written as `rgba(var(--rgb-primary), 0.14)` rather than a literal, so rebranding the
entire product means editing three declarations in `variables.css` and nothing else.

Colour is rationed by rule:

| Colour | Reserved for |
| --- | --- |
| Yellow | Brand, primary actions, XP, level, ratings, archetype, legendary rarity |
| Bone / white | Text and high-emphasis neutrals |
| Green | Affirmative only — a passed check, "Playing", an excellent match |
| Orange / red | Warning and danger only |
| Six DNA hues | Categorical data encoding, so six bars stay tellable apart without a legend |

Contrast against the background: body text 19.4:1, secondary 11.8:1, muted 6.1:1,
yellow on black 13.3:1. All comfortably past WCAG AA.

### Typography

**Anton** for display (h1, h2, stat values, level numbers, match percentages) and
**Chakra Petch** 400–700 for everything readable. The pairing is the display face of the RIVALY brand — chosen because a system-font stack is one of the
strongest tells of a generic build, and this pair reads esports rather than SaaS.

### Form language

- Radius tightened from 14–20px to **2–8px**. Soft corners were the single biggest
  reason the first pass looked like a template.
- Gradients removed from buttons, cards, tiles and bars. Flat blocks, hard edges,
  and a border doing the separating.
- Drop-glows removed. On black, an edge reads; a glow smudges.
- Motion shortened (260ms → 200ms normal) so the interface reads as a tool.
- The ambient background is one restrained yellow wash plus a technical grid, not the
  three-colour radial haze that ships with every dark theme.

---

## Game artwork

The 32 catalogue titles ship with real cover art, plus wide key-art banners for
the 25 available on Steam. `tools/fetch-assets.mjs` collects them once:

```bash
node tools/fetch-assets.mjs           # skips what already exists
node tools/fetch-assets.mjs --force   # re-fetch everything
```

| Source | Titles | What it gives |
| --- | --- | --- |
| Steam CDN | 25 | `library_600x900.jpg` covers + `header.jpg` banners |
| Wikipedia | 3 | Box art for the console/PC exclusives (Zelda TOTK, GT7, WoW) |
| Composited | 4 | Valorant, LoL, Fortnite, Minecraft have no box art anywhere, so their official wordmark is composited onto the game's own generated gradient |

Everything is resized and re-encoded to WebP with Pillow — 360×540 covers,
480×224 banners, ~1.2 MB in total. The script is a **dev tool**: the application
imports nothing from it and never fetches at runtime.

### The fallback still works

The procedural gradient was not thrown away — it moved underneath. Each cover
renders as an `<img>` layered over the gradient and monogram, and every generated
image carries `data-fallback`. A capture-phase `error` listener in `js/app.js`
removes any image that fails, revealing the gradient.

Delete `public/assets/covers/` entirely and the product still renders correctly: no
broken-image icons, no layout shift, no console errors. This is covered by a
test that hides a file and asserts the gradient takes over.

Provenance and licensing for every file: [`assets/ATTRIBUTION.md`](assets/ATTRIBUTION.md).

---

### Intro sequence

The landing opens with the wordmark acting as its own progress indicator.
Three SVG layers: a yellow outline, the same geometry filled and clipped, and
the pieces that morph. The level is **one `<rect>` translated vertically**
inside a `clipPath`, so the top edge is always a straight horizontal line and
the yellow stays exactly inside the letters.

At 100% the letters transform rather than swap:

- the `V` rotates −90°, so its two limbs meet pointing right — a `>`
- the `Y` rotates +90°, its arms become a `<` and its stem retracts
- `R I A L` fade and drift out
- the two chevrons converge into the `><` brand mark

The letters are hand-drawn paths, not font glyphs — a glyph cannot be split
into limbs. `CHEVRON` in `js/loading.js` documents the per-axis scale that
makes two differently proportioned letters land on the same chevron.

Plays once per session (`sessionStorage`); repeat navigations get a short
version. The loader ships with `hidden` in the markup and only JavaScript
turns it on, so a script failure leaves the landing perfectly usable.

---

## Gamer DNA

### How it works

The questionnaire asks **10 questions**, each with 4 options. Every option carries a
weight vector across the six attributes:

```javascript
{ id: 'a', label: 'Winning', weights: { competitive: 5, achiever: 2 } }
```

Scoring is a three-step pure function (`js/gamer-dna.js`):

1. **Sum** — add the weight vectors of every chosen option.
2. **Normalise** — divide each attribute by the maximum it could possibly have
   reached given the questionnaire. That ceiling is computed *from the data itself*,
   so adding a question never requires touching the algorithm.
3. **Map** — project the 0–1 ratio onto a **18–98** display range.

```text
score = round(18 + 80 × (raw / maxPossible))
```

The floor exists because a profile is never "0% social" — it is simply lower than the
others. The result is six values:

```text
COMPETITIVE   59
SOCIAL        31
EXPLORER      22
STRATEGIST    90
ACHIEVER      55
COLLECTOR     29
```

### Archetypes

Eleven archetypes, resolved **deterministically** — never randomly.

The attributes are ranked strongest → weakest, with a fixed tie-break order
(`strategist → competitive → social → explorer → achiever → collector`) so equal
scores can never produce a different answer on a different run.

Combination archetypes (primary **and** secondary) are tested first, because
"a strategist who also competes" describes someone better than "a strategist":

| Archetype | Rule |
| --- | --- |
| The Tactician | strategist + competitive |
| The Captain | social + strategist |
| The Gladiator | competitive + social |
| The Archivist | collector + explorer |
| The Pioneer | explorer + achiever |
| The Strategist | strategist |
| The Champion | competitive |
| The Explorer | explorer |
| The Collector | collector |
| The Socializer | social |
| The Completionist | achiever |

**Verified:** all 11 archetypes are reachable, and 4,000 sampled answer combinations
all resolve without a single failure. Identical answers always produce identical
scores and an identical archetype.

---

## Compatibility Engine

A real algorithm in `js/compatibility.js`. Seven independent scoring functions, each
returning `0–100` plus a human-readable reason, combined by weight:

```text
calculateGameCompatibility()            20%
calculateRankCompatibility()            15%
calculateScheduleCompatibility()        15%
calculatePlaystyleCompatibility()       15%
calculateRoleCompatibility()            15%
calculateCommunicationCompatibility()   10%
calculateReputationScore()              10%
────────────────────────────────────────────
calculateTotalCompatibility()          100%
```

### The formula

```text
total = Σ ( factorScore / 100 × factorWeight )
```

### How each factor scores

**Game (20%)** — plays the same title `100`; two shared genres `62`;
one shared genre `48`; nothing in common `15`.

**Rank (15%)** — distance on a universal 8-tier ladder
(Unranked → Bronze → Silver → Gold → Platinum → Diamond → Master → Elite):

```text
distance   0    1    2    3    4    5+
score    100   85   62   38   20     8
```

**Schedule (15%)** — `SCHEDULES` is ordered (morning → late night), so index distance
is a genuine measure of overlap. A player with several slots is scored on their best:

```text
distance   0    1    2    3    4+
score    100   72   42   20    10
```

**Playstyle (15%)** — `PLAYSTYLES` runs casual → balanced → competitive → hardcore:

```text
distance   0    1    2    3
score    100   74   44   18
```

**Role (15%)** — squads want *gaps filled*, not roles duplicated:

```text
complementary role   100   (e.g. a Leader for your Support)
different role        74
same role as you      52
```

**Communication (10%)** — voice preference is the base, language overlap multiplies it:

```text
both want voice          100
both prefer text          88
you want voice, they don't 25
no shared language        × 0.6
```

**Reputation (10%)** — the player's authored reputation, used directly.

### Tiers

```text
90–100   EXCELLENT MATCH
75–89    GREAT MATCH
60–74    GOOD MATCH
<60      LOW COMPATIBILITY
```

### Transparency

Every result shows what it earned **and what it lost**. The breakdown dialog prints
the arithmetic for each factor:

```text
Rank      15%
Same rank (Diamond)
100 / 100 × 15 = 15 pts
```

### Validation

Manually verified against the simulated pool. For the search
*Rocket League · Diamond · Night · Competitive · Voice required*, with a Support-role
Passport:

| Player | Score | Why |
| --- | --- | --- |
| **Matheus** | **99%** | Same game, same rank, same schedule, same playstyle, complementary role, voice, reputation 94 |
| **Hugo** | **50%** | Genre overlap only, 4 tiers below, morning player, no voice |
| **Lulu** | **38%** | Different games, unranked, morning, casual, no voice, no shared language |

Across all 832 player × game combinations the engine produces finite, in-range scores
spanning **38%–99%**, and repeating any search returns a byte-identical ranking.

---

## XP and Levels

### XP rules

| Action | XP |
| --- | --- |
| Create Passport | +100 |
| Complete Gamer DNA | +200 |
| Complete profile (once) | +200 |
| Squad search | +150 |
| High compatibility match (90%+) | +120 |
| Complete a game | +75 |
| Save a teammate | +60 |
| Add a game | +50 |
| Unlock an achievement | +40 |
| Update Passport | +25 |
| Rate a game | +15 |
| Update a library entry | +10 |
| Log playtime (per 10h) | +5 |

Milestone rewards use `awardOnce()`, which stamps a flag on the Passport so a
re-reached milestone can never pay out twice.

### Level curve

XP required to advance **from** level *L* **to** *L+1*:

```text
step(L) = 1000 + (L − 1) × 500

L1 → L2 = 1,000 XP
L2 → L3 = 1,500 XP
L3 → L4 = 2,000 XP
```

Cumulative XP required to **reach** level *L*:

```text
total(L) = (L − 1) × (250L + 500)
```

The inverse is solved **analytically** rather than by looping, so any XP value
resolves in constant time:

```text
L = floor( ( −250 + √(62500 + 1000 × (500 + xp)) ) / 500 )
```

Verified exact for levels 1–60, including the boundary XP value of every level.

### Reputation

Earned through activity — never assigned randomly:

```text
reputation = clamp(
    50
  + level              × 2
  + achievements       × 1.5
  + completedGames     × 0.8
  + savedTeammates     × 1
  + profileCompletion  × 0.12
, 0, 100)
```

### Gamer Score

One headline number summarising the whole Passport:

```text
gamerScore = level            × 500
           + xp               × 0.25
           + rarityPoints     × 250
           + libraryCount     × 80
           + completedGames   × 120
           + hoursPlayed      × 2
           + reputation       × 10
           + savedTeammates   × 100
```

`rarityPoints` weights each unlocked badge by tier
(common 1 · uncommon 2 · rare 4 · epic 7 · legendary 12), so a rare badge is worth
more than four common ones.

### Achievements

20 badges across 5 rarities. Each rule lives in `data.js` **next to its copy**, so a
badge can never drift out of sync with what unlocks it:

```javascript
{
    id: 'perfect-match', name: 'Perfect Match', rarity: 'epic',
    description: 'Found a teammate above 90% compatibility.',
    hint: 'Reach a 90%+ compatibility result.',
    check: (ctx) => ctx.bestMatch >= 90,
}
```

Unlocking a badge grants XP, which can trigger a level-up, which can satisfy a
*different* badge. A bounded 4-pass loop with a re-entrancy guard resolves that
cascade without infinite recursion.

---

## LocalStorage structure

All persistence goes through `js/storage.js`. **No other module touches
`localStorage` directly.** Every key is namespaced:

```text
rivaly:version         schema version (for future migrations)
rivaly:accounts        simulated accounts  [{ id, nickname, email, passwordHash, createdAt }]
rivaly:session         { accountId, startedAt }
rivaly:user            the Gamer Passport
rivaly:library         [{ id, gameId, status, platform, hours, rating, note, addedAt, updatedAt }]
rivaly:achievements    [{ id, unlockedAt, context }]
rivaly:activity        [{ id, type, message, meta, at }]  (capped at 60 entries)
rivaly:squads          [{ playerId, compatibility, tier, gameId, savedAt }]
rivaly:settings        { reducedMotion, toastsEnabled, compactDensity }
```

The layer is defensive by design:

- Corrupted or unparseable values are dropped instead of throwing.
- Private Mode (where `setItem` throws) degrades to an in-memory store — the app keeps
  working, and Settings tells the user persistence is unavailable.
- Existing data is never overwritten on refresh; demo content is only seeded when the
  user explicitly asks for it.
- **Reset Demo Data** requires confirmation and preserves the sign-in account.

Settings includes a **storage transparency table** showing every key, its contents and
its byte size — useful for defending the architecture in a review.

---

## Architecture

### Principles

- **One responsibility per module.** `storage.js` owns persistence; `gamification.js`
  owns progression; pages own only their own DOM.
- **Data operations are DOM-free.** `library-store.js`, `compatibility.js` and
  `gamer-dna.js` are pure and were unit-tested outside the browser.
- **No mini-React.** Rendering is template literals + `innerHTML` with escaped user
  input, plus event delegation. No virtual DOM, no reactive state, no component class.
- **Event delegation everywhere.** Grids re-render freely without leaking listeners.
- **Tokens, not values.** `variables.css` is the only file containing raw colours.

### Component mapping for V2

Each block below is already isolated and becomes a React component almost verbatim:

| V1 (`js/cards.js`, `components.css`) | V2 |
| --- | --- |
| `gameCardMarkup()` / `.game-card` | `<GameCard />` |
| `squadCardMarkup()` / `.squad-card` | `<SquadCard />` |
| `badgeMarkup()` / `.badge` | `<AchievementCard />` |
| `statMarkup()` / `.stat` | `<StatTile />` |
| `dnaListMarkup()` / `.dna-bar` | `<DnaBar />` |
| `activityItemMarkup()` / `.activity-item` | `<ActivityItem />` |
| `progressMarkup()` / `.progress` | `<XPBar />` |
| `notifications.js` / `.toast` | `<Toast />` + provider |
| `modal.js` / `.modal` | `<Modal />` |
| `navigation.js` / `.sidebar` | `<Sidebar />` / `<Navbar />` |
| `.passport-card` | `<PassportCard />` |

---

## Animations

Only `transform`, `opacity`, `filter` and `clip-path` are animated. Progress bars use
`transform: scaleX()` rather than `width`, so nothing triggers layout.

Implemented, in rough order of importance:

1. **Gamer DNA reveal** — attributes grow weakest-first, numbers count up with
   `requestAnimationFrame`, then the archetype bursts in
2. **XP progression** — bars grow, counters tick
3. **Level up** — full-screen overlay, `27 → 28`, glow and scale
4. **Achievement unlock** — rarity-tinted overlay with a pulsing ring
5. **Squad scanning** — staged log where each line names a factor the engine
   actually evaluates, in evaluation order
6. **Compatibility reveal** — cards enter in sequence, percentages count up
7. **Page transitions** — a discreet fade-up on every main region
8. **Dashboard stagger** — grid children enter in sequence via CSS delays
9. **Card interactions** — `translateY(-4px)`, border highlight, cover zoom,
   pointer-tracked lighting on the Passport card (max 3.5° tilt — deliberately subtle)
10. **Skeletons and contextual loaders** — never a bare "Loading…"

Supporting: hero Passport assembly, scroll reveal via `IntersectionObserver`, shimmer,
scan sweep, typewriter, shake on invalid input, ambient drift.

---

## Accessibility

- **Semantic HTML** — `<main>`, `<aside>`, `<nav>`, `<header>`, `<section>`,
  `<fieldset>`/`<legend>`, one `<h1>` per page
- **Skip link** on every page
- **`:focus-visible`** ring applied globally — keyboard users see it, pointer users don't
- **Keyboard navigation** — arrow keys on tab lists (WAI-ARIA pattern), number keys
  1–4 answer DNA questions, `Esc` closes modals and the mobile drawer
- **Focus management** — modals trap focus, restore it on close, and lock body scroll
- **ARIA** — `aria-current="page"`, `aria-selected`, `aria-invalid`, `aria-live`
  regions for toasts and result areas, `aria-label` on every icon-only control
- **Labels** — every form control is labelled; verified programmatically
- **Reduced motion** — both `@media (prefers-reduced-motion: reduce)` *and* a manual
  Settings override. Animation is neutralised, but content is never left hidden
- **Contrast** — body text and muted text meet WCAG AA on the dark surface
- **Touch** — nothing important is hover-only; card actions stay visible on touch
  devices, and drag & drop always has a button-based equivalent
- **Honest affordances** — unavailable features render as disabled "Soon" items,
  never as dead buttons

---

## Quality verification

The build was verified with three automated suites plus a visual pass.

**1. Engine tests** (`node`, outside the browser) — 30 checks:
level curve exactness and inverse for levels 1–60, DNA determinism, all 11 archetypes
reachable across 4,000 sampled answer sets, weights summing to exactly 100,
compatibility ordering, 832 player × game combinations in range, achievement rules
firing correctly on empty and maxed profiles, dataset integrity.

**2. Reference audit** — every `href`/`src` resolves, every ES import resolves, every
named import matches a real export, every element id looked up by a controller exists
in its page, zero framework usage, zero external network requests, no
`alert`/`confirm`/`prompt`, no leftover `console` statements.

**3. End-to-end journey** (headless Chrome via DevTools Protocol) — **103 checks**:
the complete flow from landing → account → onboarding → DNA → reveal → Passport →
library CRUD → squad search → breakdown → save → achievements → persistence across
reload → settings → sign-out, plus accessibility spot checks and horizontal-overflow
checks on 8 pages at 390×844.

```text
Checks: 103   Passed: 103   Failed: 0
Console: clean — no errors, no warnings, no failed requests.
```

---

## Limitations of this version

Stated plainly, because a first version that pretends to be finished is worse than one
that is honest:

1. **Authentication is simulated.** There is no server, no session token, no transport
   security and no account recovery. Passwords are SHA-256 hashed (via Web Crypto)
   purely so plaintext isn't sitting in storage — that is hygiene, **not** a security
   control. A real implementation needs a backend, a proper KDF (bcrypt/argon2), rate
   limiting and HTTPS.
2. **One Passport per browser.** Signing in with a different account asks for
   confirmation and replaces the local Passport. Multi-profile storage is a V2 concern.
3. **Players are simulated.** The 26-player pool is authored demo content. Matching is
   real; the people are not.
4. **Games are a local catalogue.** 32 titles in `data.js`, used as demonstrative
   content. No external API.
5. **Data is device-local.** Clearing site data erases everything. Settings offers a
   JSON export (credentials excluded).
6. **Drag & drop is pointer-only.** The HTML Drag and Drop API has no keyboard
   equivalent, so every status change is also available through the edit dialog. On
   touch devices the hint text changes to point at the button path.
7. **Light theme is prepared, not exposed.** The token layer is theme-aware and a
   complete `[data-theme="light"]` block exists, but V1 ships dark-only by product
   decision — so there is no half-working toggle in the UI.
8. **Arena, Social Feed, Clans, Contextual AI and platform sync are not implemented.**
   They appear only in the landing-page roadmap and as disabled "Soon" sidebar items.
9. **A local server is required** (ES Modules + CORS).

---

## Future migration — V2 (React + Tailwind CSS)

The V1 architecture was chosen to make this a translation:

| V1 | V2 |
| --- | --- |
| `css/variables.css` tokens | `tailwind.config.js` theme (names already match Tailwind's scale) |
| `cards.js` markup functions | React components (mapping table above) |
| `storage.js` | Same module, or a persistence hook / TanStack Query adapter |
| `compatibility.js`, `gamer-dna.js`, `gamification.js` | **Unchanged.** Pure, DOM-free, already unit-tested |
| `navigation.js` | React Router + `<Sidebar />` |
| Page controllers | Route components |
| `modal.js`, `notifications.js` | Context providers |
| Template literals + `innerHTML` | JSX |
| CSS Grid/Flex utilities | Tailwind utilities |

The three modules that carry the actual product logic — the Compatibility Engine, the
Gamer DNA engine and the gamification system — have **no DOM dependency at all** and
move to V2 untouched.

---

## Credits

Built as an academic exercise. Game titles and player profiles are demonstrative
content only.

**V1 — Vanilla.** No React. No Tailwind. No backend.
Only HTML, CSS and JavaScript.
