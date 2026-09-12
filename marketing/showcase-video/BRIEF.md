# Suffolk Tennis — "Performance & Reports" showcase video

A 90-second, advert-grade video for parents and coaches showing how coaches
write a session performance report for each player and how parents view the
reports and trends in the app. Voiced by ElevenLabs (British male narrator),
scored with an ElevenLabs Music instrumental bed, cut with ffmpeg from real
app footage recorded with Playwright against fictional sample data.

Deliverables: `out/suffolk-performance-reports-16x9.mp4` (1920×1080) and
`out/suffolk-performance-reports-9x16.mp4` (1080×1920). H.264 yuv420p, AAC,
25 fps, burned-in captions.

## Hard rules
- Fictional people only. Coach **Sam Reid**. Players **Alfie Barker, Maya
  Chen, Theo Nkemelu, Isla Fraser** (all 12U). Parent **Hannah Barker**
  (Alfie's mum). No real children, parents or coaches anywhere.
- No secrets in any file. Audio is fetched through the media relay (see
  below) and saved under `audio/`; never write keys or guard tokens to disk.
- The app footage is the real app (`vite preview` on 127.0.0.1:4173 serving
  the current `dist/`) with Supabase mocked at the network layer, the same
  technique as the QA harness in the scratchpad `mock.mjs`.
- Everything must be reproducible with `node record.mjs` then
  `node assemble.mjs` from this folder. No manual steps.

## Brand
Navy `#0E1D39`, soft navy `#16294B`, pink `#E0298E`, cyan `#00ACE6`, ink
`#1F2937`, muted `#64748B`. Display type Archivo (uppercase, weight 700,
`font-stretch: 112%`), body Hanken Grotesk. Lockup for dark backgrounds:
`public/email/logo.png` (LTA Suffolk Tennis Partnership). Mascot (Punchy):
`public/email/mascot.png`. Hero b-roll: `public/hero-video.mov` (9.56 s,
1920×1080, 25 fps, no audio). Strapline: **One County. One Programme. One
Pathway.** Web address: **suffolktennis.online**.

If Google Fonts cannot be reached from the build environment, self-host:
the app's font files are whatever `src/index.css` imports; fall back to
Arial Black / Arial with `letter-spacing` tuned so titles still read as bold
sports-brand type. Never ship a frame in Times New Roman.

## The script (narration, ~200 words, ~88 s at a warm, unhurried pace)

| # | Scene | Narration |
|---|-------|-----------|
| 1 | Open | Every County Training session is a step on the pathway. Now, every step is recorded. |
| 2 | Intro | Introducing Performance and Reports in the Suffolk Tennis app: one place where coaches capture how each player is developing, and parents watch it grow. |
| 3 | Coach: register | For coaches, it starts at the register. Open today's session and every player on the programme is right there. |
| 4 | Coach: rating | Tap a player and rate the nine LTA areas, from Confident to Attack to Loves to Compete, with a single tap each. Add a short comment. Last session's ratings sit right beside today's. |
| 5 | Coach: end session | When the session ends, every completed report goes to parents automatically. No paperwork. No chasing. |
| 6 | Parent: arrival | For parents, the report lands in your inbox and in your Parent Hub, under your child's name. |
| 7 | Parent: report | Open Performance and Reports to see the latest rating on all nine areas, your coach's comment, and how it compares with last time. |
| 8 | Parent: trends | Session by session, the trend lines show exactly where your child is excelling, and what they are working on next. |
| 9 | Close | One County. One Programme. One Pathway. Suffolk Tennis. Sign in at suffolktennis dot online. |

`script.json` holds these lines with `id`, `text`, `caption` (the caption
may differ from the spoken text: "suffolktennis.online" is shown, "suffolk
tennis dot online" is spoken) and `estimate_s` (a duration estimate used
until the real voice timing exists).

## Shot list

Wide layout (16:9): navy stage with a subtle diagonal pink/cyan light sweep,
a phone device frame (390×844 CSS px, rendered at 2×) on the right third,
and a text zone on the left for kickers and titles. Tall layout (9:16): the
phone centred, text above it. Same scenes, same timings, one recording per
layout.

| # | Duration (est.) | On screen |
|---|-----------------|-----------|
| 1 | 7 s | `hero-video.mov` full frame under a navy gradient, pink kicker "SUFFOLK TENNIS", title "PERFORMANCE & REPORTS" reveals word by word. |
| 2 | 9 s | Stage. Phone slides in showing the Parent Hub with Alfie's child card. Left text: "One app." / "Coaches capture it." / "Parents follow it." |
| 3 | 10 s | Chapter card "FOR COACHES" (1.5 s), then phone: Coach Hub → Culford → Suffolk 12U County Training → today's session register, four players, three marked arrived. |
| 4 | 15 s | Tap Alfie → report sheet. Tap ratings across the nine areas (a natural mix: mostly Consistent, two Excelling, one Progressing), previous ratings visible beside them, type the comment "Big step forward on the forehand today. Keep chasing the wide balls." Save. |
| 5 | 8 s | End session → dialog → confirm → "Reports sent" state. |
| 6 | 8 s | Chapter card "FOR PARENTS" (1.5 s), then phone: Parent Hub → My children → Alfie → the "Performance & Reports" button. |
| 7 | 14 s | Performance & Reports: the latest report opens, radar chart draws, the nine area rows with "up from Progressing to Consistent" notes, Sam Reid's comment. |
| 8 | 10 s | Progress over time: the trend grid across five reports, slow scroll. |
| 9 | 9 s | End card: lockup, strapline in pink/white/pink, suffolktennis.online, mascot bottom-right. Music resolves, fade to navy. |

Scene boundaries are driven by `timing.json` (`{ "scenes": [{ "id": 1,
"start_s": 0, "duration_s": 7 }, ...] }`). `record.mjs` reads it so the
footage can be re-recorded to the real narration timing once the voice
exists, without touching code.

## Sample data (fixtures.mjs)
- Programme: **Suffolk 12U County Training**, Culford Sports & Tennis
  Centre, Saturdays 12:00–14:00, 11 sessions from 19 Sep 2026; today's
  session is the sixth. Coach Sam Reid assigned.
- Bookings: the four players above, all paid; Alfie's parent is Hannah
  Barker (the signed-in parent for scenes 2, 6, 7, 8).
- Alfie has five completed, sent reports (sessions one to five) with a
  believable upward trend: Serving 4→3→3→2→2, Confident to Attack 3→3→2→2→2,
  Loves to Compete 1 throughout, the rest drifting from 3 to 2. Each has a
  short, specific coach comment. Today's report (scene 4) starts empty.
- Attendance today: Alfie, Maya, Theo arrived (scan), Isla unmarked.
- Nine areas and levels come from `src/lib/lta.ts`; ratings keys are the
  area names exactly.

## Audio (fetched by me through the media relay, not by the agents)
- `audio/vo.mp3` narration and `audio/alignment.json` (character
  timestamps from the with-timestamps endpoint, one entry per script line:
  `{ "id": 1, "start_s": 0.0, "end_s": 6.8, "chars": [...], "starts": [...],
  "ends": [...] }`).
- `audio/music.mp3` 95 s instrumental bed.
- Until they exist, `assemble.mjs` must run silent (no audio inputs) and
  still produce valid mp4s so the picture can be checked.

## Assembly (assemble.mjs, ffmpeg-static)
- Inputs: `out/wide.webm`, `out/tall.webm`, `audio/*` when present,
  `script.json`, `timing.json`.
- Captions: one caption per script line, shown for the line's spoken span
  (from alignment when present, from timing.json otherwise), bottom-centre
  in the wide cut and below the phone in the tall cut, Hanken Grotesk or
  fallback, white on a 60% navy pill, 2-line max. Generated as an ASS file
  and burned in with the `ass` filter.
- Music ducked under narration (sidechaincompress or a volume envelope from
  the alignment spans), 1.5 s fade in, 3 s fade out at the end card.
- Video: libx264, crf 18, preset slow, yuv420p, 25 fps, +faststart. Audio:
  aac 192k.

## Verification standard
Extract stills at the midpoint of every scene from both cuts and look at
them. Reject: fallback serif fonts, empty phone frames, spinners, mock
error toasts, real names, the wrong child, captions overlapping the phone,
the hero clip letterboxed, or any scene shorter than its timing.
