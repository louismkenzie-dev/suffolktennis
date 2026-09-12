#!/usr/bin/env node
// assemble.mjs — cuts the final mp4s from the Playwright recordings.
//
//   node assemble.mjs [--project reports|booking] [--layout wide|tall|both]
//                     [--video <path>] [--audio-dir <dir>]
//                     [--alignment <path>|none] [--preset slow] [--crf 18]
//                     [--music-db -14] [--duration <s>] [--upsample dup|mci]
//                     [--no-check-captions] [--dry-run] [--verbose]
//
// Inputs (BRIEF.md "Assembly"): out/<layout>.webm (1920x1080 / 1080x1920,
// 50 fps), audio/vo.mp3 + audio/alignment.json + audio/music.mp3 when they
// exist, script.json and timing.json. Captions come from captions.mjs (ASS,
// burned in with the `ass` filter). Without audio/vo.mp3 the cut is silent
// (music alone is still used when present). Music is ducked under the
// narration with sidechaincompress, fades in over 1.5 s and out over the
// last 3 s of the end card. Video: libx264 crf 18 preset slow yuv420p 50 fps
// +faststart; audio: aac 192k. Outputs out/suffolk-performance-reports-16x9.mp4
// and out/suffolk-performance-reports-9x16.mp4.
//
// v2 frame rate: the deliverable is ALWAYS 50 fps. A 50 fps recording is
// passed through frame for frame; anything slower is resampled up to 50 and
// the fact is logged loudly (and repeated in the closing summary) because a
// resampled cut is not genuinely smoother than its source -- the fix is to
// re-record at 50 fps, not to re-encode.

import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { buildCaptions, HERE, LAYOUTS } from "./captions.mjs";

const NAVY = "0x0E1D39";
const FPS = 50;          // v2 deliverable frame rate. Never encode below this.
const FPS_SLACK = 0.6;   // a 50000/1001 (49.95) source still counts as native

// Two films share this assembly. "reports" is the shipped 95 s advert, cut
// whole; "booking" is one 101 s recording cut into three standalone clips,
// each with its own captions, its own fade in and out and its own copy of the
// music bed. --project switches the timing file, the script, the audio folder
// and the output folder; nothing else differs.
const PROJECTS = {
  reports: {
    timing: "timing.json", script: "script.json", audio: "audio", out: "out",
    fullFrameLines: [1, 9], chapterScenes: [3, 6],
    outputs: { wide: "suffolk-performance-reports-16x9.mp4", tall: "suffolk-performance-reports-9x16.mp4" },
    layouts: ["wide", "tall"], clips: null,
  },
  booking: {
    timing: "timing-booking.json", script: "script-booking.json", audio: "audio-booking", out: "out-booking",
    // The booking film has its own narration but reuses the reports film's
    // instrumental bed; each clip gets it from the top with its own fades.
    music: "audio/music.mp3",
    // Each clip ends on the end card, which is full-frame; two scenes open on
    // a chapter card the caption slides out from under.
    fullFrameLines: [5, 10, 15], chapterScenes: [4, 7],
    outputs: { place: "suffolk-getting-a-place.mp4", ticket: "suffolk-qr-ticket.mp4", diary: "suffolk-diary.mp4" },
    layouts: ["wide"], clips: true,
  },
};
let PROJECT = PROJECTS.reports;
let OUT = path.join(HERE, PROJECT.out);
let AUDIO = path.join(HERE, PROJECT.audio);
const OUTPUTS = PROJECT.outputs;
const warnings = [];
const loud = (...lines) => {
  const bar = "!".repeat(72);
  console.warn(`\n[assemble] ${bar}`);
  for (const l of lines) console.warn(`[assemble] !! ${l}`);
  console.warn(`[assemble] ${bar}\n`);
  warnings.push(lines[0]);
};

/* ------------------------------------------------------------------ */
/* ffmpeg                                                               */
/* ------------------------------------------------------------------ */
export function resolveFfmpeg() {
  const tried = [];
  const require = createRequire(import.meta.url);
  try {
    const p = require("ffmpeg-static"); // devDependency of this folder (npm install here)
    if (p && existsSync(p)) return p;
    tried.push(`ffmpeg-static -> ${p}`);
  } catch (e) {
    tried.push(`ffmpeg-static (${e.code ?? e.message})`);
  }
  const candidates = [
    process.env.FFMPEG_PATH,
    "/tmp/claude-0/-home-user-suffolktennis/c5bd7322-1f33-58c2-8b7e-d417e6049455/scratchpad/ffm/node_modules/ffmpeg-static/ffmpeg",
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
    tried.push(c);
  }
  const which = spawnSync("which", ["ffmpeg"], { encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  throw new Error(`ffmpeg not found. Run "npm install" in ${HERE} (installs ffmpeg-static) or set FFMPEG_PATH.\nTried: ${tried.join(", ")}`);
}

function findFfprobe(ffmpeg) {
  const sibling = path.join(path.dirname(ffmpeg), "ffprobe");
  if (existsSync(sibling)) return sibling;
  if (process.env.FFPROBE_PATH && existsSync(process.env.FFPROBE_PATH)) return process.env.FFPROBE_PATH;
  const require = createRequire(import.meta.url);
  for (const spec of ["ffprobe-static"]) {
    try {
      const m = require(spec);
      const p = typeof m === "string" ? m : m?.path;
      if (p && existsSync(p)) return p;
    } catch { /* not installed here */ }
  }
  // ffmpeg-static ships no ffprobe; the scratchpad build of this project has one.
  const scratch = "/tmp/claude-0/-home-user-suffolktennis/c5bd7322-1f33-58c2-8b7e-d417e6049455/scratchpad/ffm/node_modules/ffprobe-static/bin/linux/x64/ffprobe";
  if (existsSync(scratch)) return scratch;
  const which = spawnSync("which", ["ffprobe"], { encoding: "utf8" });
  return which.status === 0 && which.stdout.trim() ? which.stdout.trim() : null;
}

// Media summary: ffprobe when available (ffmpeg-static ships only ffmpeg),
// otherwise parsed from `ffmpeg -i`.
function probe(ffmpeg, file) {
  const ffprobe = findFfprobe(ffmpeg);
  if (ffprobe) {
    const r = spawnSync(ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames,pix_fmt,profile,sample_rate,channels,bit_rate", "-of", "json", file], { encoding: "utf8" });
    if (r.status === 0) {
      const j = JSON.parse(r.stdout);
      return {
        tool: "ffprobe",
        duration: Number(j.format?.duration),
        streams: (j.streams ?? []).map((s) => (s.codec_type === "video"
          ? { type: "video", codec: s.codec_name, profile: s.profile, width: s.width, height: s.height, fps: evalRate(s.r_frame_rate), avgFps: evalRate(s.avg_frame_rate), frames: Number(s.nb_frames) || undefined, pix_fmt: s.pix_fmt }
          : { type: s.codec_type, codec: s.codec_name, sample_rate: Number(s.sample_rate), channels: s.channels, bit_rate: Number(s.bit_rate) || undefined })),
      };
    }
  }
  const r = spawnSync(ffmpeg, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const text = r.stderr ?? "";
  const dur = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
  const streams = [];
  for (const line of text.split("\n")) {
    const v = /Stream #\d+:\d+.*?: Video: (\w+).*?, (\w+)[,(].*?(\d{2,5})x(\d{2,5}).*?(\d+(?:\.\d+)?) fps/.exec(line);
    if (v) { streams.push({ type: "video", codec: v[1], width: Number(v[3]), height: Number(v[4]), fps: Number(v[5]), pix_fmt: v[2] }); continue; }
    const a = /Stream #\d+:\d+.*?: Audio: (\w+).*?, (\d+) Hz, ([\w.]+)(?:.*?, (\d+) kb\/s)?/.exec(line);
    if (a) streams.push({ type: "audio", codec: a[1], sample_rate: Number(a[2]), channels: a[3], bit_rate: a[4] ? Number(a[4]) * 1000 : undefined });
  }
  let duration = dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : NaN;
  if (!Number.isFinite(duration)) duration = decodeDuration(ffmpeg, file);
  return { tool: "ffmpeg -i", duration, streams };
}

function evalRate(s) {
  const m = /^(\d+)\/(\d+)$/.exec(s ?? "");
  return m ? Number(m[1]) / Number(m[2]) : Number(s);
}

// Playwright's recordVideo webm files carry no duration in the header; decode
// them once to find out how long they really are.
function decodeDuration(ffmpeg, file) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-nostats", "-v", "info", "-i", file, "-map", "0:v:0", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 64e6 });
  const times = [...(r.stderr ?? "").matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  if (!times.length) throw new Error(`cannot determine duration of ${file}`);
  const t = times[times.length - 1];
  return Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]);
}

const fmtSummary = (p) => {
  const parts = [`duration ${p.duration.toFixed(2)} s`];
  for (const s of p.streams) {
    if (s.type === "video") {
      const fps = `${Number(s.fps).toFixed(2)} fps`;
      const avg = Number.isFinite(s.avgFps) && Math.abs(s.avgFps - s.fps) > 0.01 ? ` (avg ${Number(s.avgFps).toFixed(2)})` : "";
      parts.push(`video ${s.codec} ${s.width}x${s.height} ${fps}${avg} ${s.pix_fmt ?? ""}${s.frames ? ` ${s.frames} frames` : ""}`.trim());
    }
    else parts.push(`audio ${s.codec} ${s.sample_rate} Hz ${s.channels}${s.bit_rate ? ` ${Math.round(s.bit_rate / 1000)} kb/s` : ""}`);
  }
  return `${parts.join(" | ")}  (${p.tool})`;
};

// Escape a path for use inside an ffmpeg filter option value.
const filterPath = (p) => p.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/,/g, "\\,").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
const n2 = (n) => Number(n.toFixed(3));

/* ------------------------------------------------------------------ */
/* Frame rate (v2: smoothness is the top priority)                      */
/* ------------------------------------------------------------------ */
// The deliverable is 50 fps, full stop. Decide how to get there from whatever
// the recorder handed us, and say out loud which of the two happened.
function frameRatePlan(videoStream, label, opts) {
  const src = Number(videoStream.avgFps ?? videoStream.fps);
  const mci = `minterpolate=fps=${FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`;

  if (!Number.isFinite(src) || src <= 0) {
    loud(
      `FRAME RATE: cannot read the frame rate of ${label}.`,
      `Forcing the output to ${FPS} fps anyway. If the source was slower, the cut`,
      `will judder exactly as much as the source did.`,
    );
    return { mode: "unknown", srcFps: null, filter: `fps=${FPS}` };
  }
  if (src >= FPS - FPS_SLACK) {
    console.log(`[assemble] frame rate: source ${src.toFixed(2)} fps -> ${FPS} fps NATIVE (every recorded frame kept, no resampling).`);
    return { mode: "native", srcFps: src, filter: `fps=${FPS}` };
  }

  const how = opts.upsample === "mci"
    ? `motion-interpolated (${mci.split("=")[0]}, mi_mode=mci) - smoother, but it can warp scrolling UI text`
    : "frame-duplicated (fps filter) - artefact-free, but NOT actually smoother than the source";
  loud(
    `FRAME RATE: ${label} is only ${src.toFixed(2)} fps, below the ${FPS} fps deliverable.`,
    `The output is NOT being dropped to ${src.toFixed(2)} fps - it is still encoded at ${FPS} fps,`,
    `RESAMPLED UP: ${how}.`,
    `The client's number one note on v1 was judder. Re-record at ${FPS} fps`,
    `(node record.mjs) so this path is never taken; --upsample mci is a stopgap.`,
  );
  return { mode: opts.upsample === "mci" ? "resampled-mci" : "resampled-dup", srcFps: src, filter: opts.upsample === "mci" ? mci : `fps=${FPS}` };
}

// A container can claim 50 fps while the picture underneath it only moves 30
// times a second, because record.mjs padded out the frames it missed. That is
// exactly the v1 judder, and only the recorder's own report can see it.
function captureRateReport(layout, video, rate) {
  if (path.resolve(video) !== path.join(OUT, `${layout}.webm`)) return null; // a --video from elsewhere
  const file = path.join(OUT, `${layout}.scenes.json`);
  if (!existsSync(file)) return null;
  // record.mjs writes the report after the webm; an older report belongs to a
  // previous take and would raise a false alarm about this one.
  try {
    if (statSync(file).mtimeMs + 1000 < statSync(video).mtimeMs) {
      console.warn(`[assemble] WARNING: ${path.relative(HERE, file)} is older than the recording - skipping the capture-rate check. Re-run "node record.mjs" so the two match.`);
      return null;
    }
  } catch {
    return null; // the recording moved under us; the encode will report it
  }
  let j;
  try { j = JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
  const scenes = (j.scenes ?? []).filter((s) => Number.isFinite(s.captured_fps));
  if (!scenes.length) return null;
  const worst = scenes.reduce((a, b) => (b.captured_fps < a.captured_fps ? b : a));
  const mean = scenes.reduce((n, s) => n + s.captured_fps, 0) / scenes.length;
  console.log(`[assemble] capture rate (${path.relative(HERE, file)}): nominal ${j.fps} fps, mean ${mean.toFixed(1)} fps, worst scene ${worst.id} at ${worst.captured_fps} fps`);
  // record.mjs also measures inter-frame gaps, which catch a stutter that an
  // average frame rate hides: one 60 ms hitch reads as judder even at 50 fps.
  const sm = j.smoothness;
  const p95 = sm?.p95_gap_ms ?? sm?.overall?.p95_gap_ms;
  if (sm) {
    console.log(`[assemble] smoothness: p95 gap ${p95} ms, max ${sm.max_gap_ms ?? sm.overall?.max_gap_ms} ms (${(1000 / FPS).toFixed(0)} ms is one frame), ${sm.repeated_pct ?? "?"}% repeated frames`);
    const budget = (1000 / FPS) * 1.6;
    if (Number.isFinite(p95) && p95 > budget) {
      loud(
        `SMOOTHNESS: the ${layout} recording's p95 inter-frame gap is ${p95} ms, over the ${budget.toFixed(0)} ms budget`,
        `for ${FPS} fps. One frame is ${(1000 / FPS).toFixed(0)} ms, so the slowest 5 % of frames hold for`,
        `${(p95 / (1000 / FPS)).toFixed(1)} frame times and will read as a hitch. Fix it in record.mjs.`,
      );
    }
  }
  // A scene averaging a little under 50 with healthy gaps just had a few slow
  // frames; sustained under-capture is what reads as judder, so the loud box
  // is reserved for that (and for the p95 gap check above).
  if (worst.captured_fps < FPS * 0.75) {
    loud(
      `CAPTURE RATE: scene ${worst.id} of the ${layout} recording was captured at only ${worst.captured_fps} fps`,
      `(mean ${mean.toFixed(1)}, nominal ${j.fps}). Frames were padded out at record time, so the`,
      `container can say ${FPS} fps while the picture still moves like ${Math.round(worst.captured_fps)} fps.`,
      `That is the v1 judder. Fix it in record.mjs - re-encoding here cannot.`,
    );
  } else if (worst.captured_fps < FPS) {
    console.log(`[assemble] (scene ${worst.id} dipped below ${FPS} fps but the gap distribution is within budget, so it should not read as a hitch.)`);
  }
  return { mean, worst: worst.captured_fps, nominal: j.fps, worstScene: worst.id };
}

/* ------------------------------------------------------------------ */
/* One layout                                                           */
/* ------------------------------------------------------------------ */
/**
 * Cut one deliverable. `clip` is the window of the recording it comes from:
 * the whole film for the reports cut ({ start: 0 }), one of the three
 * booking clips otherwise. Everything downstream works in clip seconds.
 */
async function assembleLayout(layout, opts, ffmpeg, clip = null) {
  const geo = LAYOUTS[layout];
  const video = opts.video ?? path.join(OUT, `${layout}.webm`);
  if (!existsSync(video)) throw new Error(`missing ${video} - run "node record.mjs" first`);
  const timing = JSON.parse(readFileSync(path.join(HERE, PROJECT.timing), "utf8"));
  const audioDir = opts.audioDir ?? AUDIO;
  const vo = path.join(audioDir, "vo.mp3");
  const music = opts.audioDir ? path.join(opts.audioDir, "music.mp3")
    : PROJECT.music ? path.join(HERE, PROJECT.music) : path.join(audioDir, "music.mp3");
  const hasVo = existsSync(vo), hasMusic = existsSync(music);
  const alignmentPath = opts.alignment === undefined ? path.join(audioDir, "alignment.json") : opts.alignment === "none" ? "none" : path.resolve(opts.alignment);
  const clipStart = clip ? clip.start_s : 0;
  const name = clip ? `${layout}-${clip.id}` : layout;

  console.log(`\n=== ${clip ? `${clip.id} — ${clip.title} (${clip.start_s}-${clip.end_s}s)` : layout} (${geo.w}x${geo.h}) ===`);
  const src = probe(ffmpeg, video);
  const vs = src.streams.find((s) => s.type === "video");
  if (!vs) throw new Error(`${video} has no video stream`);
  console.log(`[assemble] source ${path.relative(HERE, video)}: ${fmtSummary(src)}`);
  if (vs.width !== geo.w || vs.height !== geo.h) console.warn(`[assemble] WARNING: source is ${vs.width}x${vs.height}, expected ${geo.w}x${geo.h}; it will be scaled`);

  // Duration: the scene timeline when the recording covers it, else the recording.
  const scenesEnd = Math.max(...timing.scenes.map((s) => s.start_s + s.duration_s));
  const target = (clip ? clip.end_s : opts.duration ?? timing.total_s ?? scenesEnd) - clipStart;
  let D = Math.min(src.duration - clipStart, target);
  if (src.duration + 0.05 < clipStart + target) console.warn(`[assemble] WARNING: recording is ${src.duration.toFixed(2)} s but the timeline needs ${(clipStart + target).toFixed(2)} s - the last scene(s) will be cut short`);
  for (const s of timing.scenes) {
    if (clip && (s.clip ?? clip.id) !== clip.id) continue;
    if (s.start_s + s.duration_s - clipStart > D + 0.05) console.warn(`[assemble] WARNING: scene ${s.id} ends at ${(s.start_s + s.duration_s - clipStart).toFixed(2)} s, beyond the ${D.toFixed(2)} s output`);
  }
  D = n2(D);

  const captions = buildCaptions({
    layout, alignmentPath, name, outDir: OUT,
    scriptPath: path.join(HERE, PROJECT.script), timingPath: path.join(HERE, PROJECT.timing),
    fullFrameLines: PROJECT.fullFrameLines, chapterScenes: PROJECT.chapterScenes, strictWordMatch: !!PROJECT.clips,
    window: clip ? { start: clip.start_s, end: clip.end_s } : null,
  });
  const lastCaptionEnd = Math.max(...captions.events.map((e) => e.end));
  if (lastCaptionEnd > D + 0.05) console.warn(`[assemble] WARNING: captions run to ${lastCaptionEnd.toFixed(2)} s, beyond the ${D} s output`);
  console.log(`[assemble] audio: vo ${hasVo ? "yes" : "no (silent cut)"}, music ${hasMusic ? "yes" : "no"}; captions ${captions.events.length} events, font ${captions.fontFamily}${captions.fontFallback ? " (FALLBACK)" : ""}, timed from ${captions.timingSource}`);
  if (captions.fontFallback) loud(`CAPTIONS: Hanken Grotesk could not be fetched; falling back to ${captions.fontFamily}.`);
  const captionCheck = opts.checkCaptions && !opts.dryRun ? checkCaptionOcclusion(ffmpeg, video, layout, captions, clipStart) : null;

  const inputs = ["-i", video];
  let idx = 1, voIdx = -1, musicIdx = -1;
  if (hasVo) { inputs.push("-i", vo); voIdx = idx++; }
  if (hasMusic) { inputs.push("-i", music); musicIdx = idx++; }

  const rate = frameRatePlan(vs, path.relative(HERE, video), opts);
  const capture = captureRateReport(layout, video, rate);

  const voOffset = timing.vo_offset_s ?? 0;
  const fadeOutStart = n2(Math.max(0, D - 1.0));
  const vchain = [
    `[0:v]trim=${n2(clipStart)}:${n2(clipStart + D)},setpts=PTS-STARTPTS`,
    `scale=${geo.w}:${geo.h}:flags=lanczos`,
    rate.filter,
    "setsar=1",
    "format=yuv420p",
    `ass=filename='${filterPath(captions.assPath)}':fontsdir='${filterPath(captions.fontsDir)}'`,
    `fade=t=in:st=0:d=0.4:color=${NAVY}`,
    `fade=t=out:st=${fadeOutStart}:d=1.0:color=${NAVY}`,
    "format=yuv420p[vout]",
  ].join(",");

  const achain = [];
  const musicGain = Math.pow(10, opts.musicDb / 20);
  if (hasMusic) {
    achain.push(`[${musicIdx}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad,atrim=0:${D},asetpts=PTS-STARTPTS,volume=${musicGain.toFixed(4)},afade=t=in:st=0:d=1.5,afade=t=out:st=${n2(Math.max(0, D - 3))}:d=3[mus]`);
  }
  if (hasVo) {
    const delay = Math.round(voOffset * 1000);
    achain.push(`[${voIdx}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo${delay > 0 ? `,adelay=${delay}|${delay}` : ""},apad,atrim=${n2(clipStart)}:${n2(clipStart + D)},asetpts=PTS-STARTPTS${hasMusic ? ",asplit=2[vo][sc]" : "[aout]"}`);
  }
  if (hasVo && hasMusic) {
    // Duck the bed under speech: the narration drives the compressor's sidechain.
    achain.push("[mus][sc]sidechaincompress=threshold=0.02:ratio=6:attack=25:release=500:makeup=1:level_sc=1[duck]");
    achain.push("[duck][vo]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95:level=0[aout]");
  } else if (hasMusic) {
    achain.push("[mus]anull[aout]");
  }

  const outFile = path.join(OUT, PROJECT.outputs[clip ? clip.id : layout]);
  const args = [
    "-hide_banner", "-y", "-nostdin", "-loglevel", opts.verbose ? "verbose" : "warning", "-stats",
    ...inputs,
    "-filter_complex", [vchain, ...achain].join(";"),
    "-map", "[vout]",
    ...(achain.length ? ["-map", "[aout]", "-c:a", "aac", "-b:a", "192k", "-ar", "48000"] : ["-an"]),
    "-c:v", "libx264", "-crf", String(opts.crf), "-preset", opts.preset, "-pix_fmt", "yuv420p",
    "-r", String(FPS), "-fps_mode", "cfr",
    "-movflags", "+faststart", "-t", String(D),
    outFile,
  ];
  console.log(`[assemble] ffmpeg ${args.map((a) => (/[\s;\[\]']/.test(a) ? JSON.stringify(a) : a)).join(" ")}`);
  if (opts.dryRun) return null;

  mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("exit", (code, signal) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${signal ?? `code ${code}`} while writing ${outFile}`))));
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const result = probe(ffmpeg, outFile);
  if (clip) clip.duration_s = D;
  const size = (statSync(outFile).size / 1e6).toFixed(1);
  console.log(`[assemble] wrote ${path.relative(HERE, outFile)} (${size} MB, ${secs} s): ${fmtSummary(result)}`);
  const ov = result.streams.find((s) => s.type === "video");
  if (!ov || ov.width !== geo.w || ov.height !== geo.h) throw new Error(`${outFile}: expected ${geo.w}x${geo.h}, got ${ov?.width}x${ov?.height}`);
  if (Math.abs(result.duration - D) > 0.25) throw new Error(`${outFile}: expected ${D} s, got ${result.duration.toFixed(2)} s`);
  if (achain.length && !result.streams.some((s) => s.type === "audio")) throw new Error(`${outFile}: audio stream missing`);
  // The whole point of v2: never ship below 50 fps, whatever came in.
  const outFps = Number(ov.avgFps ?? ov.fps);
  if (!Number.isFinite(outFps) || Math.abs(outFps - FPS) > FPS_SLACK) {
    throw new Error(`${outFile}: expected ${FPS} fps, got ${Number.isFinite(outFps) ? outFps.toFixed(2) : ov.fps} fps`);
  }
  if (ov.frames && Math.abs(ov.frames - Math.round(D * FPS)) > FPS) {
    console.warn(`[assemble] WARNING: ${ov.frames} frames for ${D} s at ${FPS} fps (expected ~${Math.round(D * FPS)})`);
  }
  console.log(`[assemble] frame rate check: ${outFps.toFixed(2)} fps, ${ov.frames ?? "?"} frames over ${D} s (${rate.mode}).`);
  return { file: outFile, summary: result, rate, capture, captionCheck };
}

/* ------------------------------------------------------------------ */
/* Captions vs the stage: does any pill sit on top of the artwork?      */
/* ------------------------------------------------------------------ */
// Samples the SOURCE recording (no captions burned in yet) inside each pill
// rectangle and reports how much of it is bright. The stage ground is navy
// (#0E1D39, luma ~31) with a soft pink/cyan glow; the phone screen and the
// desktop browser window are near-white. A pill sitting over either shows up
// as a large bright fraction. Scenes 1 (full-frame hero b-roll) and 9 (end
// card) are bright by design, so they are reported but never fail.
const BRIGHT_LUMA = 140;
const OCCLUSION_WARN = 0.06;
// The hero and the end cards are bright by design, so a pill over them is
// reported and never fails.
const brightByDesign = () => new Set(PROJECT.fullFrameLines);

function brightFraction(ffmpeg, video, t, x, y, w, h) {
  const args = [
    "-hide_banner", "-v", "error", "-ss", String(n2(t)), "-i", video, "-frames:v", "1",
    "-vf", `crop=${Math.round(w)}:${Math.round(h)}:${Math.round(x)}:${Math.round(y)},format=gray`,
    "-f", "rawvideo", "-",
  ];
  const r = spawnSync(ffmpeg, args, { encoding: "buffer", maxBuffer: 64e6 });
  const buf = r.stdout;
  if (!buf || !buf.length) return null;
  let bright = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] >= BRIGHT_LUMA) bright++;
  return bright / buf.length;
}

function checkCaptionOcclusion(ffmpeg, video, layout, captions, clipStart = 0) {
  const rows = [];
  let worst = 0, failures = 0;
  for (const ev of captions.events) {
    // Caption times are clip-relative; the recording is not.
    const t = clipStart + (ev.start + ev.end) / 2;
    const f = brightFraction(ffmpeg, video, t, ev.x0, ev.y0, ev.pillW, ev.pillH);
    if (f == null) continue;
    const exempt = brightByDesign().has(ev.id);
    const bad = !exempt && f > OCCLUSION_WARN;
    if (bad) failures++;
    if (!exempt) worst = Math.max(worst, f);
    rows.push(`  ${String(ev.id).padStart(2)}.${ev.chunk} @ ${t.toFixed(1)}s  pill ${ev.pillW}x${ev.pillH} at (${Math.round(ev.x0)},${Math.round(ev.y0)})  bright ${(f * 100).toFixed(1)}%${exempt ? "  (hero/end card - bright by design)" : bad ? "  <-- OVERLAPS STAGE ARTWORK" : ""}`);
  }
  console.log(`[assemble] caption placement vs the ${layout} stage (bright pixels under each pill, before captions are burned in):`);
  for (const r of rows) console.log(r);
  if (failures) {
    loud(
      `CAPTION PLACEMENT: ${failures} ${layout} caption pill(s) sit over the stage artwork`,
      `(the desktop browser window or the phone). Retune LAYOUTS.${layout}.safe in captions.mjs.`,
    );
  } else {
    console.log(`[assemble] caption placement OK: worst non-hero pill is ${(worst * 100).toFixed(1)}% bright (threshold ${(OCCLUSION_WARN * 100).toFixed(0)}%).`);
  }
  return { layout, failures, worst };
}

/* ------------------------------------------------------------------ */
/* --scan-safe-zone: measure the clear band from the recording          */
/* ------------------------------------------------------------------ */
// Answers "how far right can the wide pill go before it touches the desktop
// browser window?" without guessing from stage.css. Samples the stage scenes
// (2-8; 1 and 9 are full-frame by design), builds a column and row brightness
// profile of the caption band, and prints the box that is actually clear.
function scanSafeZone(ffmpeg, video, layout, timing) {
  const geo = LAYOUTS[layout];
  const top = Math.round(geo.safe.top ?? geo.safe.bottom - 220);
  const h = Math.round(geo.safe.bottom - top);
  const grid = new Float64Array(geo.w * h); // bright hits per pixel, over all samples
  const samples = [];
  for (const s of timing.scenes.filter((s) => s.id >= 2 && s.id <= 8)) {
    for (const f of [0.3, 0.55, 0.85]) samples.push(n2(s.start_s + s.duration_s * f));
  }
  let taken = 0;
  for (const t of samples) {
    const r = spawnSync(ffmpeg, ["-hide_banner", "-v", "error", "-ss", String(t), "-i", video, "-frames:v", "1",
      "-vf", `crop=${geo.w}:${h}:0:${top},format=gray`, "-f", "rawvideo", "-"], { encoding: "buffer", maxBuffer: 64e6 });
    const buf = r.stdout;
    if (!buf || buf.length < geo.w * h) continue;
    taken++;
    for (let i = 0; i < geo.w * h; i++) if (buf[i] >= BRIGHT_LUMA) grid[i] += 1;
  }
  if (!taken) { console.warn(`[assemble] scan-safe-zone: could not sample ${video}`); return null; }
  const DIRTY = 0.02;
  // Columns first: how wide is the clear corridor around the caption's centre?
  const mid = Math.round((geo.safe.left + geo.safe.right) / 2);
  const colFrac = (x) => { let n = 0; for (let y = 0; y < h; y++) n += grid[y * geo.w + x]; return n / (taken * h); };
  let right = geo.w;
  for (let x = mid; x < geo.w; x++) if (colFrac(x) > DIRTY) { right = x; break; }
  let left = 0;
  for (let x = mid; x >= 0; x--) if (colFrac(x) > DIRTY) { left = x + 1; break; }
  // Then rows, but only inside that corridor - the phone standing off to the
  // side must not make the whole band look occupied.
  const rowFrac = (y) => { let n = 0; for (let x = left; x < right; x++) n += grid[y * geo.w + x]; return n / (taken * Math.max(1, right - left)); };
  let clearFromY = top;
  for (let y = h - 1; y >= 0; y--) if (rowFrac(y) > DIRTY) { clearFromY = top + y + 1; break; }

  console.log(`\n[assemble] --scan-safe-zone ${layout} (${taken} samples from scenes 2-8, band y ${top}-${geo.safe.bottom}):`);
  console.log(`  clear horizontally: x ${left} .. ${right}   (current LAYOUTS.${layout}.safe: ${geo.safe.left} .. ${geo.safe.right})`);
  console.log(`  stage artwork stops at y ${clearFromY}       (current safe.top: ${geo.safe.top ?? "-"})`);
  const okX = geo.safe.left >= left && geo.safe.right <= right;
  const okY = geo.safe.top == null || geo.safe.top >= clearFromY;
  console.log(`  verdict: ${okX && okY ? "the caption box fits in the clear area" : "RETUNE captions.mjs LAYOUTS." + layout + ".safe"}`);
  if (!okX) console.log(`  suggestion: safe.left ${Math.max(left, 60)}, safe.right ${Math.min(right - 8, geo.w - 60)}`);
  if (!okY) console.log(`  suggestion: safe.top ${clearFromY + 8}`);
  return { layout, left, right, clearFromY, ok: okX && okY };
}

/* ------------------------------------------------------------------ */
/* CLI                                                                  */
/* ------------------------------------------------------------------ */
function parseArgs(argv) {
  const o = { project: "reports", layout: null, video: undefined, alignment: undefined, audioDir: undefined, preset: "slow", crf: 18, musicDb: -14, dryRun: false, verbose: false, duration: undefined, upsample: "dup", checkCaptions: true, scanSafeZone: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") o.project = argv[++i];
    else if (a.startsWith("--project=")) o.project = a.slice(10);
    else if (a === "--layout") o.layout = argv[++i];
    else if (a === "--video") o.video = path.resolve(argv[++i]);
    else if (a === "--alignment") o.alignment = argv[++i];
    else if (a === "--audio-dir") o.audioDir = path.resolve(argv[++i]);
    else if (a === "--preset") o.preset = argv[++i];
    else if (a === "--crf") o.crf = Number(argv[++i]);
    else if (a === "--music-db") o.musicDb = Number(argv[++i]);
    else if (a === "--duration") o.duration = Number(argv[++i]);
    else if (a === "--upsample") o.upsample = argv[++i];
    else if (a === "--scan-safe-zone") o.scanSafeZone = true;
    else if (a === "--check-captions") o.checkCaptions = true;
    else if (a === "--no-check-captions") o.checkCaptions = false;
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--verbose") o.verbose = true;
    else if (a === "-h" || a === "--help") {
      console.log("usage: node assemble.mjs [--layout wide|tall|both] [--video <webm>] [--audio-dir <dir>] [--alignment <json>|none] [--preset slow] [--crf 18] [--music-db -14] [--duration s] [--upsample dup|mci] [--scan-safe-zone] [--no-check-captions] [--dry-run] [--verbose]");
      process.exit(0);
    } else throw new Error(`unknown argument ${a}`);
  }
  if (!PROJECTS[o.project]) throw new Error(`--project must be one of ${Object.keys(PROJECTS).join(", ")} (got ${o.project})`);
  o.layout ??= PROJECTS[o.project].layouts.length === 1 ? PROJECTS[o.project].layouts[0] : "both";
  if (!["wide", "tall", "both"].includes(o.layout)) throw new Error(`--layout must be wide, tall or both (got ${o.layout})`);
  for (const l of o.layout === "both" ? ["wide", "tall"] : [o.layout]) {
    if (!PROJECTS[o.project].layouts.includes(l)) throw new Error(`project ${o.project} has no ${l} layout (it cuts ${PROJECTS[o.project].layouts.join(", ")} only)`);
  }
  if (!["dup", "mci"].includes(o.upsample)) throw new Error(`--upsample must be dup or mci (got ${o.upsample})`);
  if (o.video && o.layout === "both") throw new Error("--video needs --layout wide or --layout tall");
  return o;
}

const opts = parseArgs(process.argv.slice(2));
PROJECT = PROJECTS[opts.project];
OUT = path.join(HERE, PROJECT.out);
AUDIO = path.join(HERE, PROJECT.audio);
const ffmpeg = resolveFfmpeg();
console.log(`[assemble] project ${opts.project}: ${PROJECT.timing} + ${PROJECT.audio}/ -> ${PROJECT.out}/`);
console.log(`[assemble] ffmpeg: ${ffmpeg}`);
const layouts = opts.layout === "both" ? ["wide", "tall"] : [opts.layout];
const results = [];
if (opts.scanSafeZone) {
  const timing = JSON.parse(readFileSync(path.join(HERE, PROJECT.timing), "utf8"));
  for (const layout of layouts) {
    const video = opts.video ?? path.join(OUT, `${layout}.webm`);
    if (!existsSync(video)) { console.warn(`[assemble] scan-safe-zone: missing ${video}`); continue; }
    scanSafeZone(ffmpeg, video, layout, timing);
  }
  process.exit(0);
}
try {
  for (const layout of layouts) {
    // One film, cut whole — or one recording cut into its clips.
    const clips = PROJECT.clips
      ? JSON.parse(readFileSync(path.join(HERE, PROJECT.timing), "utf8")).clips
      : [null];
    for (const clip of clips) {
      const r = await assembleLayout(layout, opts, ffmpeg, clip);
      if (r) results.push({ ...r, clip });
    }
  }
} catch (e) {
  console.error(`\n[assemble] FAILED: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
if (results.length) {
  console.log("\n=== outputs (ffprobe) ===");
  for (const r of results) {
    console.log(`${path.relative(HERE, r.file)}`);
    console.log(`  ${fmtSummary(r.summary)}`);
    const src = r.rate.srcFps == null ? "unknown" : `${r.rate.srcFps.toFixed(2)} fps`;
    console.log(`  frame rate: ${src} source -> ${FPS} fps output (${r.rate.mode})`);
    if (r.capture) console.log(`  capture rate: mean ${r.capture.mean.toFixed(1)} fps, worst ${r.capture.worst} fps (scene ${r.capture.worstScene})`);
    if (r.captionCheck) console.log(`  captions: ${r.captionCheck.failures ? `${r.captionCheck.failures} pill(s) over the stage artwork` : "all clear of the stage artwork"} (worst ${(r.captionCheck.worst * 100).toFixed(1)}% bright)`);
  }
}
if (warnings.length) {
  console.warn(`\n=== ${warnings.length} warning(s) to read before shipping ===`);
  for (const w of warnings) console.warn(`  - ${w}`);
}
