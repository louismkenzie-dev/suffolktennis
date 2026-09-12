#!/usr/bin/env node
// assemble.mjs — cuts the final mp4s from the Playwright recordings.
//
//   node assemble.mjs [--layout wide|tall|both] [--video <path>] [--audio-dir <dir>]
//                     [--alignment <path>|none] [--preset slow] [--crf 18]
//                     [--music-db -14] [--duration <s>] [--dry-run] [--verbose]
//
// Inputs (BRIEF.md "Assembly"): out/<layout>.webm (1920x1080 / 1080x1920,
// 25 fps), audio/vo.mp3 + audio/alignment.json + audio/music.mp3 when they
// exist, script.json and timing.json. Captions come from captions.mjs (ASS,
// burned in with the `ass` filter). Without audio/vo.mp3 the cut is silent
// (music alone is still used when present). Music is ducked under the
// narration with sidechaincompress, fades in over 1.5 s and out over the
// last 3 s. Video: libx264 crf 18 preset slow yuv420p 25 fps +faststart;
// audio: aac 192k. Outputs out/suffolk-performance-reports-16x9.mp4 and
// out/suffolk-performance-reports-9x16.mp4.

import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { buildCaptions, HERE, LAYOUTS } from "./captions.mjs";

const OUT = path.join(HERE, "out");
const AUDIO = path.join(HERE, "audio");
const NAVY = "0x0E1D39";
const FPS = 25;
const OUTPUTS = { wide: "suffolk-performance-reports-16x9.mp4", tall: "suffolk-performance-reports-9x16.mp4" };

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
  const which = spawnSync("which", ["ffprobe"], { encoding: "utf8" });
  return which.status === 0 && which.stdout.trim() ? which.stdout.trim() : null;
}

// Media summary: ffprobe when available (ffmpeg-static ships only ffmpeg),
// otherwise parsed from `ffmpeg -i`.
function probe(ffmpeg, file) {
  const ffprobe = findFfprobe(ffmpeg);
  if (ffprobe) {
    const r = spawnSync(ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels,bit_rate", "-of", "json", file], { encoding: "utf8" });
    if (r.status === 0) {
      const j = JSON.parse(r.stdout);
      return {
        tool: "ffprobe",
        duration: Number(j.format?.duration),
        streams: (j.streams ?? []).map((s) => (s.codec_type === "video"
          ? { type: "video", codec: s.codec_name, width: s.width, height: s.height, fps: evalRate(s.r_frame_rate), pix_fmt: s.pix_fmt }
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
    if (s.type === "video") parts.push(`video ${s.codec} ${s.width}x${s.height} ${Number(s.fps).toFixed(2)} fps ${s.pix_fmt ?? ""}`.trim());
    else parts.push(`audio ${s.codec} ${s.sample_rate} Hz ${s.channels}${s.bit_rate ? ` ${Math.round(s.bit_rate / 1000)} kb/s` : ""}`);
  }
  return `${parts.join(" | ")}  (${p.tool})`;
};

// Escape a path for use inside an ffmpeg filter option value.
const filterPath = (p) => p.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/,/g, "\\,").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
const n2 = (n) => Number(n.toFixed(3));

/* ------------------------------------------------------------------ */
/* One layout                                                           */
/* ------------------------------------------------------------------ */
async function assembleLayout(layout, opts, ffmpeg) {
  const geo = LAYOUTS[layout];
  const video = opts.video ?? path.join(OUT, `${layout}.webm`);
  if (!existsSync(video)) throw new Error(`missing ${video} - run "node record.mjs" first`);
  const timing = JSON.parse(readFileSync(path.join(HERE, "timing.json"), "utf8"));
  const audioDir = opts.audioDir ?? AUDIO;
  const vo = path.join(audioDir, "vo.mp3"), music = path.join(audioDir, "music.mp3");
  const hasVo = existsSync(vo), hasMusic = existsSync(music);
  const alignmentPath = opts.alignment === undefined ? path.join(audioDir, "alignment.json") : opts.alignment === "none" ? "none" : path.resolve(opts.alignment);

  console.log(`\n=== ${layout} (${geo.w}x${geo.h}) ===`);
  const src = probe(ffmpeg, video);
  const vs = src.streams.find((s) => s.type === "video");
  if (!vs) throw new Error(`${video} has no video stream`);
  console.log(`[assemble] source ${path.relative(HERE, video)}: ${fmtSummary(src)}`);
  if (vs.width !== geo.w || vs.height !== geo.h) console.warn(`[assemble] WARNING: source is ${vs.width}x${vs.height}, expected ${geo.w}x${geo.h}; it will be scaled`);

  // Duration: the scene timeline when the recording covers it, else the recording.
  const scenesEnd = Math.max(...timing.scenes.map((s) => s.start_s + s.duration_s));
  const target = opts.duration ?? timing.total_s ?? scenesEnd;
  let D = Math.min(src.duration, target);
  if (src.duration + 0.05 < target) console.warn(`[assemble] WARNING: recording is ${src.duration.toFixed(2)} s but the timeline needs ${target.toFixed(2)} s - the last scene(s) will be cut short`);
  for (const s of timing.scenes) if (s.start_s + s.duration_s > D + 0.05) console.warn(`[assemble] WARNING: scene ${s.id} ends at ${(s.start_s + s.duration_s).toFixed(2)} s, beyond the ${D.toFixed(2)} s output`);
  D = n2(D);

  const captions = buildCaptions({ layout, alignmentPath });
  const lastCaptionEnd = Math.max(...captions.events.map((e) => e.end));
  if (lastCaptionEnd > D + 0.05) console.warn(`[assemble] WARNING: captions run to ${lastCaptionEnd.toFixed(2)} s, beyond the ${D} s output`);
  console.log(`[assemble] audio: vo ${hasVo ? "yes" : "no (silent cut)"}, music ${hasMusic ? "yes" : "no"}; captions ${captions.events.length} events, font ${captions.fontFamily}${captions.fontFallback ? " (FALLBACK)" : ""}, timed from ${captions.timingSource}`);

  const inputs = ["-i", video];
  let idx = 1, voIdx = -1, musicIdx = -1;
  if (hasVo) { inputs.push("-i", vo); voIdx = idx++; }
  if (hasMusic) { inputs.push("-i", music); musicIdx = idx++; }

  const voOffset = timing.vo_offset_s ?? 0;
  const fadeOutStart = n2(Math.max(0, D - 1.0));
  const vchain = [
    `[0:v]trim=0:${D},setpts=PTS-STARTPTS`,
    `fps=${FPS}`,
    `scale=${geo.w}:${geo.h}:flags=lanczos`,
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
    achain.push(`[${voIdx}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo${delay > 0 ? `,adelay=${delay}|${delay}` : ""},apad,atrim=0:${D},asetpts=PTS-STARTPTS${hasMusic ? ",asplit=2[vo][sc]" : "[aout]"}`);
  }
  if (hasVo && hasMusic) {
    // Duck the bed under speech: the narration drives the compressor's sidechain.
    achain.push("[mus][sc]sidechaincompress=threshold=0.02:ratio=6:attack=25:release=500:makeup=1:level_sc=1[duck]");
    achain.push("[duck][vo]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95:level=0[aout]");
  } else if (hasMusic) {
    achain.push("[mus]anull[aout]");
  }

  const outFile = path.join(OUT, OUTPUTS[layout]);
  const args = [
    "-hide_banner", "-y", "-nostdin", "-loglevel", opts.verbose ? "verbose" : "warning", "-stats",
    ...inputs,
    "-filter_complex", [vchain, ...achain].join(";"),
    "-map", "[vout]",
    ...(achain.length ? ["-map", "[aout]", "-c:a", "aac", "-b:a", "192k", "-ar", "48000"] : ["-an"]),
    "-c:v", "libx264", "-crf", String(opts.crf), "-preset", opts.preset, "-pix_fmt", "yuv420p", "-r", String(FPS),
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
  const size = (statSync(outFile).size / 1e6).toFixed(1);
  console.log(`[assemble] wrote ${path.relative(HERE, outFile)} (${size} MB, ${secs} s): ${fmtSummary(result)}`);
  const ov = result.streams.find((s) => s.type === "video");
  if (!ov || ov.width !== geo.w || ov.height !== geo.h) throw new Error(`${outFile}: expected ${geo.w}x${geo.h}, got ${ov?.width}x${ov?.height}`);
  if (Math.abs(result.duration - D) > 0.25) throw new Error(`${outFile}: expected ${D} s, got ${result.duration.toFixed(2)} s`);
  if (achain.length && !result.streams.some((s) => s.type === "audio")) throw new Error(`${outFile}: audio stream missing`);
  return { file: outFile, summary: result };
}

/* ------------------------------------------------------------------ */
/* CLI                                                                  */
/* ------------------------------------------------------------------ */
function parseArgs(argv) {
  const o = { layout: "both", video: undefined, alignment: undefined, audioDir: undefined, preset: "slow", crf: 18, musicDb: -14, dryRun: false, verbose: false, duration: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--layout") o.layout = argv[++i];
    else if (a === "--video") o.video = path.resolve(argv[++i]);
    else if (a === "--alignment") o.alignment = argv[++i];
    else if (a === "--audio-dir") o.audioDir = path.resolve(argv[++i]);
    else if (a === "--preset") o.preset = argv[++i];
    else if (a === "--crf") o.crf = Number(argv[++i]);
    else if (a === "--music-db") o.musicDb = Number(argv[++i]);
    else if (a === "--duration") o.duration = Number(argv[++i]);
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--verbose") o.verbose = true;
    else if (a === "-h" || a === "--help") {
      console.log("usage: node assemble.mjs [--layout wide|tall|both] [--video <webm>] [--audio-dir <dir>] [--alignment <json>|none] [--preset slow] [--crf 18] [--music-db -14] [--duration s] [--dry-run] [--verbose]");
      process.exit(0);
    } else throw new Error(`unknown argument ${a}`);
  }
  if (!["wide", "tall", "both"].includes(o.layout)) throw new Error(`--layout must be wide, tall or both (got ${o.layout})`);
  if (o.video && o.layout === "both") throw new Error("--video needs --layout wide or --layout tall");
  return o;
}

const opts = parseArgs(process.argv.slice(2));
const ffmpeg = resolveFfmpeg();
console.log(`[assemble] ffmpeg: ${ffmpeg}`);
const layouts = opts.layout === "both" ? ["wide", "tall"] : [opts.layout];
const results = [];
try {
  for (const layout of layouts) {
    const r = await assembleLayout(layout, opts, ffmpeg);
    if (r) results.push(r);
  }
} catch (e) {
  console.error(`\n[assemble] FAILED: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
if (results.length) {
  console.log("\n=== outputs ===");
  for (const r of results) console.log(`${path.relative(HERE, r.file)}\n  ${fmtSummary(r.summary)}`);
}
