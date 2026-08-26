# Asset attribution

Happy Game is an academic project. Real game titles and their artwork are used
as **demonstrative content only**, to show what the product looks like with a
populated library. Nothing here is redistributed commercially.

All files are stored locally so the application makes **zero external network
requests at runtime**. They were downloaded once by `tools/fetch-assets.mjs`.

## Game covers — `assets/covers/` (32 files)

| Source | Count | Notes |
| --- | --- | --- |
| Steam CDN (`library_600x900.jpg`) | 25 | Publisher-supplied store artwork. © the respective publishers. |
| Wikipedia box art | 3 | `zelda-totk`, `gran-turismo`, `wow`. Low-resolution cover scans, used under fair use for identification in an educational context. |
| Composited wordmarks | 4 | `valorant`, `lol`, `fortnite`, `minecraft`. Official wordmarks from Wikimedia Commons (see licence per file below), composited by us onto the game's own generated gradient. The background is original work. |

## Game banners — `assets/banners/` (25 files)

Steam CDN `header.jpg`. © the respective publishers.

## Wordmarks used in the composited covers

| Game | Commons file |
| --- | --- |
| Valorant | `Valorant logo - pink color version.svg` |
| League of Legends | `League of Legends 2019 vector.svg` |
| Fortnite | `Fortnite logo 2.svg` |
| Minecraft | `Minecraft Logo-en.svg` |

Each carries its own licence on Wikimedia Commons; most simple wordmarks are
published there as ineligible for copyright (`PD-textlogo`). Trademarks remain
the property of their owners.

## Original work in this repository

- **Platform glyphs** (PC, PlayStation, Xbox, Switch, Mobile) — drawn by us as
  inline SVG in `js/ui.js`, deliberately *not* the brands' logos.
- **All other icons** — hand-authored inline SVG, same file.
- **Avatars** — generated procedurally from a hash, no source imagery.
- **Cover fallback gradients** — generated from each game's `hue` token.

## Typefaces — `assets/fonts/`

- **Russo One** — SIL Open Font License 1.1
- **Chakra Petch** — SIL Open Font License 1.1

Latin subsets, self-hosted.

## Removing the artwork

The application degrades cleanly without it. Delete `assets/covers/` and
`assets/banners/` and every card falls back to its generated gradient and
monogram — no broken images, no console errors. Run
`node tools/fetch-assets.mjs` to fetch them again.
