/**
 * tools/fetch-assets.mjs — DEV TOOL, run once. Not part of the product.
 *
 * Downloads the artwork for every game in the catalogue and writes
 * optimised WebP into assets/. The application never fetches anything at
 * runtime: it loads these local files, exactly like the fonts.
 *
 * Sources, in order of preference per game (declared in js/data.js):
 *   steamAppId  -> Steam CDN library_600x900.jpg + header.jpg
 *   coverUrl    -> Wikipedia box art (console/PC exclusives)
 *   logoUrl     -> Wikimedia Commons wordmark, composited onto the game's
 *                  own procedural gradient (titles with no box art anywhere)
 *
 * Usage:
 *   node tools/fetch-assets.mjs           # skips files that already exist
 *   node tools/fetch-assets.mjs --force   # re-downloads everything
 *
 * Requires Python + Pillow for the resize/composite step.
 */

import { mkdirSync, existsSync, writeFileSync, readFileSync, statSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COVERS = join(ROOT, 'assets', 'covers');
const BANNERS = join(ROOT, 'assets', 'banners');
const TMP = join(ROOT, 'assets', '.tmp');

const FORCE = process.argv.includes('--force');
const UA = 'HappyGameAcademic/1.0 (student project; contact via repository)';

const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';

/* Output geometry. Covers keep the 3:4 the CSS already expects. */
const COVER_W = 360;
const COVER_H = 540;
const BANNER_W = 480;
const BANNER_H = 224;
const QUALITY = 80;

[COVERS, BANNERS, TMP].forEach((dir) => mkdirSync(dir, { recursive: true }));

/* ------------------------------------------------------------------
   Read the catalogue straight from the app so there is no second list
   to keep in sync.
   ------------------------------------------------------------------ */
const { GAMES } = await import(`file://${join(ROOT, 'js', 'data.js')}`);

async function download(url, dest) {
    const response = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 1024) throw new Error(`suspiciously small (${buffer.length}B)`);
    writeFileSync(dest, buffer);
    return buffer.length;
}

/* ------------------------------------------------------------------
   Pillow does the pixel work. Kept as one script invoked per image so a
   single bad file cannot take the whole run down.
   ------------------------------------------------------------------ */
const PY_RESIZE = `
import sys
from PIL import Image
src, dst, w, h, q = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
im = Image.open(src).convert('RGB')
# Cover-fit: fill the box, crop the overflow, never distort.
ratio = max(w / im.width, h / im.height)
im = im.resize((max(1, round(im.width * ratio)), max(1, round(im.height * ratio))), Image.LANCZOS)
left, top = (im.width - w) // 2, (im.height - h) // 2
im.crop((left, top, left + w, top + h)).save(dst, 'WEBP', quality=q, method=6)
`;

const PY_WORDMARK = `
import sys, colorsys
from PIL import Image, ImageDraw
logo, dst, hue, w, h, q = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])

def hsl(hdeg, s, l):
    r, g, b = colorsys.hls_to_rgb((hdeg % 360) / 360.0, l, s)
    return (int(r * 255), int(g * 255), int(b * 255))

# Same two stops the CSS gradient uses, so a composited cover sits next
# to a photographic one without looking like a different system.
top_c = hsl(hue, 0.62, 0.26)
bot_c = hsl(hue + 34, 0.58, 0.12)

base = Image.new('RGB', (w, h), bot_c)
draw = ImageDraw.Draw(base)
for y in range(h):
    t = y / (h - 1)
    draw.line([(0, y), (w, y)],
              fill=tuple(round(top_c[i] + (bot_c[i] - top_c[i]) * t) for i in range(3)))

# Diagonal light sweep, mirroring .cover::before
sweep = Image.new('RGBA', (w * 2, h * 2), (0, 0, 0, 0))
sd = ImageDraw.Draw(sweep)
line_c = hsl(hue, 0.78, 0.62)
sd.polygon([(w * 0.55, 0), (w * 0.75, 0), (w * 0.15, h * 2), (-w * 0.05, h * 2)],
           fill=line_c + (46,))
base = Image.alpha_composite(base.convert('RGBA'), sweep.crop((0, 0, w, h)))

mark = Image.open(logo).convert('RGBA')

# Some official wordmarks ship in a dark variant (Fortnite's is solid
# black), which disappears on a dark gradient. Measure the mean luminance
# of the opaque pixels and lift the mark to near-white when it would be
# unreadable. Colourful marks (Valorant pink, LoL gold) score well above
# the threshold and are left untouched.
px = mark.load()
lums = []
for yy in range(0, mark.height, max(1, mark.height // 120)):
    for xx in range(0, mark.width, max(1, mark.width // 120)):
        r, g, b, a = px[xx, yy]
        if a > 128:
            lums.append((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0)

lum = sum(lums) / len(lums) if lums else 1.0
mean = lum
var = sum((v - mean) ** 2 for v in lums) / len(lums) if lums else 0.0
sd = var ** 0.5
print('luminance %.3f  stdev %.3f' % (lum, sd), file=sys.stderr)

# Flatten to near-white ONLY for a flat, single-colour dark mark
# (Fortnite ships solid black). A textured mark like Minecraft's has a
# high spread, and repainting it would erase the letterforms — so it is
# left alone and its own outline carries the contrast.
if lum < 0.42 and sd < 0.12:
    alpha = mark.getchannel('A')
    mark = Image.new('RGBA', mark.size, (245, 245, 243, 255))
    mark.putalpha(alpha)

target = int(w * 0.74)
scale = target / mark.width
mark = mark.resize((target, max(1, round(mark.height * scale))), Image.LANCZOS)
if mark.height > h * 0.42:
    scale = (h * 0.42) / mark.height
    mark = mark.resize((max(1, round(mark.width * scale)), int(h * 0.42)), Image.LANCZOS)

base.alpha_composite(mark, ((w - mark.width) // 2, (h - mark.height) // 2))
base.convert('RGB').save(dst, 'WEBP', quality=q, method=6)
`;

function python(script, args) {
    for (const exe of ['python', 'python3']) {
        const result = spawnSync(exe, ['-c', script, ...args], { encoding: 'utf-8' });
        if (result.error) continue;
        if (result.status !== 0) throw new Error((result.stderr || '').trim().split('\n').pop());
        return true;
    }
    throw new Error('python not found');
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)}KB`;

/* ------------------------------------------------------------------
   Run
   ------------------------------------------------------------------ */
const report = { covers: 0, banners: 0, skipped: 0, failed: [], bytes: 0 };

for (const game of GAMES) {
    const coverOut = join(COVERS, `${game.id}.webp`);

    if (existsSync(coverOut) && !FORCE) {
        report.skipped += 1;
        report.bytes += statSync(coverOut).size;
    } else {
        try {
            const raw = join(TMP, `${game.id}.src`);

            if (game.steamAppId) {
                await download(`${STEAM_CDN}/${game.steamAppId}/library_600x900.jpg`, raw);
                python(PY_RESIZE, [raw, coverOut, COVER_W, COVER_H, QUALITY]);
            } else if (game.coverUrl) {
                await download(game.coverUrl, raw);
                python(PY_RESIZE, [raw, coverOut, COVER_W, COVER_H, QUALITY]);
            } else if (game.logoUrl) {
                await download(game.logoUrl, raw);
                python(PY_WORDMARK, [raw, coverOut, game.hue, COVER_W, COVER_H, QUALITY]);
            } else {
                throw new Error('no source declared');
            }

            const size = statSync(coverOut).size;
            report.covers += 1;
            report.bytes += size;
            const kind = game.steamAppId ? 'steam' : game.coverUrl ? 'boxart' : 'wordmark';
            console.log(`  cover   ${game.id.padEnd(18)} ${kind.padEnd(9)} ${kb(size)}`);
        } catch (error) {
            report.failed.push(`${game.id} (cover): ${error.message}`);
            console.log(`  FAIL    ${game.id.padEnd(18)} ${error.message}`);
        }
    }

    /* Wide banner — Steam only; used sparingly in the UI. */
    if (!game.steamAppId) continue;
    const bannerOut = join(BANNERS, `${game.id}.webp`);
    if (existsSync(bannerOut) && !FORCE) {
        report.bytes += statSync(bannerOut).size;
        continue;
    }
    try {
        const raw = join(TMP, `${game.id}.banner`);
        await download(`${STEAM_CDN}/${game.steamAppId}/header.jpg`, raw);
        python(PY_RESIZE, [raw, bannerOut, BANNER_W, BANNER_H, QUALITY]);
        const size = statSync(bannerOut).size;
        report.banners += 1;
        report.bytes += size;
        console.log(`  banner  ${game.id.padEnd(18)} ${' '.repeat(9)} ${kb(size)}`);
    } catch (error) {
        report.failed.push(`${game.id} (banner): ${error.message}`);
    }
}

rmSync(TMP, { recursive: true, force: true });

console.log('\n' + '-'.repeat(52));
console.log(`  covers written : ${report.covers}`);
console.log(`  banners written: ${report.banners}`);
console.log(`  skipped        : ${report.skipped}`);
console.log(`  total on disk  : ${(report.bytes / 1024 / 1024).toFixed(2)} MB`);
if (report.failed.length) {
    console.log(`\n  FAILURES (${report.failed.length}) — these fall back to the CSS gradient:`);
    report.failed.forEach((line) => console.log(`    ${line}`));
}
console.log('-'.repeat(52));
