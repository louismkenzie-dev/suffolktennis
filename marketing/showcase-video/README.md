# Performance & Reports showcase video

Builds the 95-second "Performance & Reports" advert for the Suffolk Tennis app
from real app footage: `vite preview` serves the production bundle, Playwright
drives it against fictional sample data with Supabase mocked at the network
layer, and ffmpeg cuts the two deliverables with burned-in captions, narration
and a ducked music bed. The spec is `BRIEF.md`; read it first.

Outputs (both H.264 yuv420p, AAC 192k, **50 fps**, `+faststart`, 95 s):

| File | Size |
|------|------|
| `out/suffolk-performance-reports-16x9.mp4` | 1920 x 1080 |
| `out/suffolk-performance-reports-9x16.mp4` | 1080 x 1920 |

Everything in `out/` and every `audio/*.mp3` is git-ignored.

## v2

Three changes from the approved v1 cut, and nothing else:

1. **50 fps end to end.** v1 was 25 fps and read as juddery. `record.mjs`
   captures at 50 fps and `assemble.mjs` encodes at 50 fps — see
   "Frame rate" below, which explains what happens when the two disagree.
2. **A desktop browser window in the 16:9 cut**, alongside the phone. The
   captions moved left to stay clear of it (see "Captions").
3. **A longer scene 8** (14 s, was 9 s) for the joined-up-coaching line. The
   whole cut is 95 s, was 90 s. Narration, `audio/alignment.json`,
   `script.json` and `timing.json` are regenerated upstream; nothing in the
   assembly hard-codes a length, it all follows `timing.json`.

## Frame rate

The deliverable is **always 50 fps**. `assemble.mjs` reads the frame rate of
the recording it is given and reports which of two things happened:

| Source | What you get | Log |
|--------|--------------|-----|
| 50 fps (or 50000/1001) | `50 fps NATIVE` — every recorded frame kept | one line |
| anything slower | still a 50 fps file, **resampled up** | a boxed `!!` warning, repeated in the closing summary |

A resampled cut is *not* genuinely smoother than its source: `--upsample dup`
(the default) duplicates frames, which is artefact-free but no smoother, and
`--upsample mci` motion-interpolates with `minterpolate`, which is smoother
but can warp scrolling UI text and encodes at roughly 1/35 of real time (about
an hour a cut). Both are stopgaps — if you see that warning,
the fix is to re-record at 50 fps, not to re-encode. The build fails outright
if the finished mp4 is not 50 fps.

## Prerequisites

- Node 20+ (the scripts are ES modules).
- The production bundle built at the repo root (`npm run build` there) and
  Playwright's Chromium available (the recorder reuses the repo's
  `node_modules/playwright` and its registered browser; if that build is not
  installed it picks any `chromium-*` build in the same browsers folder, and
  `PW_CHROME=/path/to/chrome` overrides both).
- An otherwise **idle machine** while `node record.mjs` runs: the screencast
  rate is load-sensitive, and every frame Chromium fails to deliver becomes a
  repeated frame in the cut. Do not run the assembly, tests or another
  recording at the same time.
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
| `--upsample dup\|mci` | how to reach 50 fps from a slower source (default `dup`) |
| `--scan-safe-zone` | measure the clear caption band from the recording and stop |
| `--no-check-captions` | skip the per-pill occlusion check (it costs ~20 s a cut) |
| `--dry-run` | print the ffmpeg command and stop |

## Audio

Fetched through the media relay, never by the scripts, and saved as:

- `audio/vo.mp3` — the narration (script lines in `script.json`).
- `audio/alignment.json` — the with-timestamps output, one entry per script
  line: `{ "id": 1, "start_s": 0.8, "end_s": 6.1, "chars": [...], "starts": [...], "ends": [...] }`
  (either a top-level array or `{ "lines": [...] }`).
- `audio/music.mp3` — the 95 s instrumental bed (exactly the 95 s cut length;
  it is padded and trimmed to `timing.json`'s `total_s`, so a shorter bed
  would end in silence rather than break the build).

`assemble.mjs` copes with any subset:

- no `vo.mp3` → **silent cut** (still a valid mp4; music alone is used if present),
- no `alignment.json` → captions are timed from `timing.json` scene spans,
- both narration and music → the bed is ducked under speech with
  `sidechaincompress` (about 10 dB), fades in over 1.5 s and out over the last
  3 s — at 95 s that is 92 → 95 s, inside the scene 9 end card (84 → 95 s);
  the picture fades in from navy and out to navy over the end card.

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
until the next line starts; the last scene is padded to `--last` seconds (9 by
default, or long enough to finish its line) — the shipped v2 `timing.json`
gives scene 9 eleven seconds, ending the cut at 95 s; a 0.4 s lead-in is kept
before line 1 — if the narration file speaks earlier than that, `vo_offset_s`
is written and `assemble.mjs` delays the voice and the captions by it.

## Captions: `captions.mjs`

Generated per layout as `out/wide.ass` / `out/tall.ass` and burned in with the
`ass` filter. One caption per script line (the `caption` field of
`script.json`, which can differ from the spoken `text`), Hanken Grotesk
SemiBold, white on a 60 % navy rounded pill, **two lines maximum**.

Every pill is centred in, and bounds-checked against, its layout's `safe` box
in `LAYOUTS` at the top of `captions.mjs` — one place to retune when the stage
moves, and the build **fails** rather than shipping a caption that escapes it:

| Layout | Safe box | Why |
|--------|----------|-----|
| wide | `safe` x 90-1280, y 836-1016 | the app scenes (2-8). v2 puts a desktop browser window on the right, with the phone over its lower-right corner; the desk reaches y 824 at most and the phone never comes left of x ~1523, so the pill sits under one and beside the other |
| wide | `full` x 72-1848 | the full-frame scenes — the hero (1) and the end card (9) have nothing on the right, so their captions are centred on the frame. A caption that opens under a chapter card (3, 6) starts centred and slides left as the card lifts |
| tall | `safe` x 60-1020, centred on y 1795 | the band below the phone (bezel bottom ~1682, frame bottom 1920); a two-line pill spans 1727-1863 |
| tall | `end` x 60-1020, centred on y 1400 | the scene 9 caption clears the mascot, which stands in the usual band on the end card |

The hero title in scene 1 is kept above both caption bands by `.hero-text` in
`stage/stage.css`. If the stage layout moves, adjust `LAYOUTS` and that rule
together — `node assemble.mjs --scan-safe-zone` measures the clear band from
the recording itself (column and row brightness profile over scenes 2-8) and
prints the numbers to use, so this is never a guess.

A line that cannot fit two lines is split into consecutive chunks at sentence
or clause boundaries; each chunk is timed from the alignment's per-character
timestamps by locating its first and last words in the spoken text
("Performance & Reports" matches "Performance and Reports", and
"suffolktennis.online" falls back to a proportional share of the spoken span).
Product names and the web address are glued with no-break spaces so they never
split across lines or chunks. The v2 scene 8 line is the longest in the script
and splits into two chunks in the wide cut and four in the narrower tall one,
all two lines or fewer.

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

`assemble.mjs` checks four things on its own, every build:

- **Frame rate** — the finished mp4 must be 50 fps or the build fails, and a
  source below 50 fps produces a boxed warning naming the resampling used.
- **Capture rate** — a container can claim 50 fps while the picture only moves
  30 times a second, because the recorder padded out frames it missed. That is
  what v1 actually looked like, so `assemble.mjs` also reads the per-scene
  `captured_fps` in `out/<layout>.scenes.json` and warns loudly when the worst
  scene came in below 45 fps. Only `record.mjs` can fix that one.
- **Caption placement** — before the captions are burned in, it samples the
  *source* recording inside each pill rectangle and reports how much of it is
  bright. The stage ground is navy (luma ~31); the phone screen and the
  desktop browser window are near-white, so a pill over either reads well
  above the 6 % threshold and is called out by scene and chunk. Scenes 1
  (full-frame hero) and 9 (end card) are bright by design and only reported.
  `--no-check-captions` skips it; `--scan-safe-zone` measures the clear band
  and prints the `LAYOUTS.<layout>.safe` numbers to use.
- **Size, length and audio** — as before.

Then do it by eye, per BRIEF.md: pull a still at the midpoint of every scene
from both cuts and look at them. Scene midpoints for the 95 s v2 timeline:

```sh
FF=node_modules/ffmpeg-static/ffmpeg
for t in 4 13.5 23.5 35.5 47.5 56 65 77 89.5; do
  $FF -y -loglevel error -ss $t -i out/suffolk-performance-reports-16x9.mp4 -frames:v 1 out/still-wide-$t.png
done
```

Scene 8 is the long one (70 → 84 s), so also look deep inside it — around
72, 76 and 80 s — where the three caption chunks of the joined-up-coaching
line follow each other.

Also pull the four layer switches (8.0-8.8 s, 19.3-21.0 s, 52.3-54.0 s and
84.0-84.9 s at ~0.25 s steps): the hero -> stage and stage -> end card cuts
dip through navy (`stage.js dip()`), and the chapter cards are solid navy
whose copy starts only once the card is opaque, so no frame should ever show
two sets of type through each other, a blank white phone or the app's
spinner. The phone's clock is frozen by the recorder (status bar 13:58 on the
coach scenes, 14:12 on the parent scenes; the register reads "Ended 1.58pm"),
so both cuts agree with each other and with the 12-2pm session. Scene 1 is
rendered offline frame by frame, so its b-roll must have no repeated frames.

Reject fallback fonts (captions print `font ... (FALLBACK)` when that happens,
and `assemble.mjs` raises a boxed warning), empty phone frames, spinners, mock
error toasts, real names, captions overlapping the phone or the desktop
window, or scenes shorter than their timing (`assemble.mjs` warns when the
recording is shorter than `timing.json`).

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
| `smoke-booking.mjs` | screenshot smoke test of the booking film's pages |
| `drivers-booking.mjs` | the booking film's scene choreography |
| `script-booking.json` / `timing-booking.json` | the booking film's narration and scene boundaries |

## Second project: the booking film (`--project booking`)

Three short 16:9 clips for the October coach forum, cut from **one** 101 s
recording and sharing this pipeline unchanged — same stage, same recorder,
same captions, same music bed:

| File | Scenes | Length |
|------|--------|--------|
| `out-booking/suffolk-getting-a-place.mp4` | 1-5 | 37.4 s |
| `out-booking/suffolk-qr-ticket.mp4` | 6-10 | 32.6 s |
| `out-booking/suffolk-diary.mp4` | 11-15 | 31.0 s |

```sh
node record.mjs --project booking          # -> out-booking/wide.webm (16:9 only)
node assemble.mjs --project booking        # -> the three mp4s
node smoke-booking.mjs                     # every page the clips show, screenshotted
```

`--project` switches four things and nothing else: the timing file
(`timing-booking.json`, whose `clips` array is where the three cuts come
from), the audio folder (`audio-booking/`), the output folder
(`out-booking/`) and the scene drivers (`drivers-booking.mjs`). With no
`--project` both scripts behave exactly as they did for the reports film —
same `timing.json`, same `audio/`, same `out/`, same `drivers()` in
`record.mjs`, same captions (the stricter alignment word match that the
booking captions need is opt-in, so the approved reports timings are
untouched).

The booking world is `installBookingFixtures()` in `fixtures.mjs`: a
fictional county administrator (**Nina Hollis**) for the ledger, an
invitation for Alfie Barker that has **not** been booked yet, a second
Suffolk programme he is already on, an unpaid place (**Freya Dunn**) for the
rejected scan, and Alfie's own weekly diary. Nothing in it runs unless
`--project booking` is used, so the reports fixtures are untouched. Alfie's
place is created on screen in scene 3 by the mocked `create-booking-checkout`,
which is why the ledger in scene 4 has a new row and bigger totals.

No Stripe page is ever shown: the mock settles the place the way the payment
webhook does in production and the film ends the scene on the app's own
"Booking confirmed" panel. Headless Chromium has no camera, so the scanner
scenes use the app's own manual code-entry path (`/admin/scan`), and the
register beside it refetches (it polls every 5 s; the driver nudges it with a
`visibilitychange`) so the row flips to Arrived on screen.
