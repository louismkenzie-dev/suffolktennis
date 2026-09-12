# Performance & Reports showcase video

Builds the 90-second "Performance & Reports" advert for the Suffolk Tennis app
from real app footage: `vite preview` serves the production bundle, Playwright
drives it against fictional sample data with Supabase mocked at the network
layer, and ffmpeg cuts the two deliverables with burned-in captions, narration
and a ducked music bed. The spec is `BRIEF.md`; read it first.

Outputs (both H.264 yuv420p, AAC 192k, 25 fps, `+faststart`):

| File | Size |
|------|------|
| `out/suffolk-performance-reports-16x9.mp4` | 1920 x 1080 |
| `out/suffolk-performance-reports-9x16.mp4` | 1080 x 1920 |

Everything in `out/` and every `audio/*.mp3` is git-ignored.

## Prerequisites

- Node 20+ (the scripts are ES modules).
- The production bundle built at the repo root (`npm run build` there) and
  Playwright's Chromium available (the recorder reuses the repo's
  `node_modules/playwright`).
- `npm install` **in this folder** — it installs `ffmpeg-static`, the only
  dependency here (`assemble.mjs` also honours `FFMPEG_PATH`, then falls back
  to `ffmpeg` on `PATH`). Nothing is added to the root `package.json`.
- Internet access for Google Fonts the first time: the captions fetch one
  Hanken Grotesk TTF into `out/fonts/` and reuse it after that. If the fetch
  fails, captions fall back to Liberation Sans / Arial (never a serif).

## Run the pipeline

```sh
cd marketing/showcase-video
npm install                 # once: ffmpeg-static
node record.mjs             # serves dist/, records out/wide.webm and out/tall.webm
                            # (+ out/<layout>.scenes.json) to the scene boundaries in timing.json
# drop the ElevenLabs files in audio/  (see "Audio" below)
node assemble.mjs           # cuts both mp4s; add --layout wide|tall for one
```

`node assemble.mjs` prints the exact ffmpeg command line it runs, then a
summary of each output (duration, resolution, fps, streams) and exits non-zero
if ffmpeg fails or the result has the wrong size, length or is missing audio.

Useful switches:

| Switch | Effect |
|--------|--------|
| `--layout wide\|tall\|both` | which cut(s) to build (default both) |
| `--preset veryfast` / `--crf 20` | quicker test encodes (defaults `slow` / `18`) |
| `--music-db -14` | music bed gain before ducking |
| `--alignment none` | time captions from `timing.json` even if `audio/alignment.json` exists |
| `--audio-dir <dir>` | read `vo.mp3` / `music.mp3` / `alignment.json` from another folder |
| `--video <webm>` | use another recording (needs `--layout wide` or `tall`) |
| `--dry-run` | print the ffmpeg command and stop |

## Audio

Fetched through the media relay, never by the scripts, and saved as:

- `audio/vo.mp3` — the narration (script lines in `script.json`).
- `audio/alignment.json` — the with-timestamps output, one entry per script
  line: `{ "id": 1, "start_s": 0.8, "end_s": 6.1, "chars": [...], "starts": [...], "ends": [...] }`
  (either a top-level array or `{ "lines": [...] }`).
- `audio/music.mp3` — the 95 s instrumental bed.

`assemble.mjs` copes with any subset:

- no `vo.mp3` → **silent cut** (still a valid mp4; music alone is used if present),
- no `alignment.json` → captions are timed from `timing.json` scene spans,
- both narration and music → the bed is ducked under speech with
  `sidechaincompress` (about 10 dB), fades in over 1.5 s and out over the last
  3 s; the picture fades in from navy and out to navy over the end card.

## Timing: `timing.json` and `retime.mjs`

`timing.json` (`{ "scenes": [{ "id", "start_s", "duration_s" }], "total_s" }`)
is the single source of scene boundaries; `record.mjs` reads it so the footage
can be re-recorded to the real narration without touching code, and
`assemble.mjs` uses `total_s` as the output length.

Once `audio/alignment.json` exists, regenerate it from the voice:

```sh
node retime.mjs             # writes timing.json (use --dry-run to preview, --out for another file)
node record.mjs             # re-record to the new boundaries
node assemble.mjs
```

The rule: each scene starts when its script line starts speaking and lasts
until the next line starts; the last scene is padded to 9 s (or long enough to
finish its line); a 0.4 s lead-in is kept before line 1 — if the narration
file speaks earlier than that, `vo_offset_s` is written and `assemble.mjs`
delays the voice and the captions by it.

## Captions: `captions.mjs`

Generated per layout as `out/wide.ass` / `out/tall.ass` and burned in with the
`ass` filter. One caption per script line (the `caption` field of
`script.json`, which can differ from the spoken `text`), Hanken Grotesk
SemiBold, white on a 60 % navy rounded pill, two lines maximum. In the wide
cut the pill sits along the bottom with a 64 px safe margin, centred on the
text zone left of the phone (x 90-1270 at most) so it never clips the phone
frame on the right third; in the tall cut it is centred on y = 1795, in the
band below the phone (bezel bottom ~1682). The hero title in scene 1 is kept
above both caption bands by `.hero-text` in `stage/stage.css`. If the stage
layout moves, adjust `LAYOUTS` and that rule together.

A line that cannot fit two lines is split into consecutive chunks at sentence
or clause boundaries; each chunk is timed from the alignment's per-character
timestamps by locating its first and last words in the spoken text
("Performance & Reports" matches "Performance and Reports", and
"suffolktennis.online" falls back to a proportional share of the spoken span).
Geometry lives in `LAYOUTS` at the top of `captions.mjs`.

```sh
node captions.mjs                       # both layouts, prints every caption event
node captions.mjs --alignment none      # timing.json timing
node captions.mjs --make-sample         # also writes audio/alignment.sample.json
```

`audio/alignment.sample.json` is a synthetic fixture in the real alignment
shape (characters evenly spaced within each scene), used to exercise the
alignment code path when the real voice is not available:
`node assemble.mjs --alignment audio/alignment.sample.json`.

## Verification

Per BRIEF.md: pull a still at the midpoint of every scene from both cuts and
look at them. For example:

```sh
FF=node_modules/ffmpeg-static/ffmpeg
for t in 4 13.5 23.5 35.5 47.5 56 65 74.5 84.5; do
  $FF -y -loglevel error -ss $t -i out/suffolk-performance-reports-16x9.mp4 -frames:v 1 out/still-wide-$t.png
done
```

Reject fallback fonts (captions print `font ... (FALLBACK)` when that happens),
empty phone frames, spinners, mock error toasts, real names, captions
overlapping the phone, or scenes shorter than their timing (`assemble.mjs`
warns when the recording is shorter than `timing.json`).

## Files

| File | Role |
|------|------|
| `BRIEF.md` | the spec |
| `script.json` | narration lines, captions, duration estimates |
| `timing.json` | scene boundaries (regenerate with `retime.mjs`) |
| `fixtures.mjs` | fictional sample data |
| `mock.mjs` | Supabase network mock + Google Fonts relay for Playwright |
| `smoke.mjs` | screenshot smoke test of the mocked app |
| `record.mjs` | records `out/wide.webm` and `out/tall.webm` |
| `captions.mjs` | ASS captions, font fetch, sample alignment fixture |
| `retime.mjs` | `timing.json` from `audio/alignment.json` |
| `assemble.mjs` | ffmpeg assembly of the two mp4s |
