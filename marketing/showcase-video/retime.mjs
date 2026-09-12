#!/usr/bin/env node
// retime.mjs — regenerates timing.json from audio/alignment.json once the
// real narration exists, so record.mjs can re-record the footage to the
// voice's timing without touching code.
//
//   node retime.mjs [--alignment audio/alignment.json] [--out timing.json]
//                   [--lead 0.4] [--last 9] [--dry-run]
//
// Each scene starts when its script line starts speaking and lasts until the
// next line starts. The timeline keeps a 0.4 s lead-in before line 1: if the
// narration file starts speaking earlier than that, the voice is delayed by
// `vo_offset_s` (assemble.mjs applies it to the audio and the captions).
// The last scene is padded to 9 s (or long enough to finish the line).

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAlignment } from "./captions.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function retime({ alignmentPath = path.join(HERE, "audio", "alignment.json"), lead = 0.4, lastScene = 9 } = {}) {
  const alignment = loadAlignment(alignmentPath);
  if (!alignment) throw new Error(`${alignmentPath} is missing or has no lines`);
  const lines = [...alignment.lines].sort((a, b) => a.id - b.id);
  const r2 = (n) => Math.round(n * 100) / 100;
  const voOffset = r2(Math.max(0, lead - lines[0].start_s));
  const starts = lines.map((l, i) => (i === 0 ? 0 : r2(l.start_s + voOffset)));
  const scenes = lines.map((l, i) => {
    const start = starts[i];
    const next = starts[i + 1];
    const duration = next != null ? r2(next - start) : r2(Math.max(lastScene, l.end_s + voOffset - start + 1.0));
    return { id: l.id, start_s: start, duration_s: duration };
  });
  const last = scenes[scenes.length - 1];
  return {
    source: "narration",
    generated_by: `retime.mjs from ${path.relative(HERE, alignmentPath)}`,
    total_s: r2(last.start_s + last.duration_s),
    vo_offset_s: voOffset,
    scenes,
  };
}

function parseArgs(argv) {
  const o = { alignment: path.join(HERE, "audio", "alignment.json"), out: path.join(HERE, "timing.json"), lead: 0.4, last: 9, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--alignment") o.alignment = path.resolve(argv[++i]);
    else if (a === "--out") o.out = path.resolve(argv[++i]);
    else if (a === "--lead") o.lead = Number(argv[++i]);
    else if (a === "--last") o.last = Number(argv[++i]);
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "-h" || a === "--help") { console.log("usage: node retime.mjs [--alignment <json>] [--out timing.json] [--lead 0.4] [--last 9] [--dry-run]"); process.exit(0); }
    else throw new Error(`unknown argument ${a}`);
  }
  return o;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const o = parseArgs(process.argv.slice(2));
  const timing = retime({ alignmentPath: o.alignment, lead: o.lead, lastScene: o.last });
  const json = `${JSON.stringify(timing, null, 2)}\n`;
  if (o.dryRun) process.stdout.write(json);
  else {
    writeFileSync(o.out, json);
    console.log(`[retime] wrote ${path.relative(process.cwd(), o.out)}: ${timing.scenes.length} scenes, total ${timing.total_s} s, vo offset ${timing.vo_offset_s} s`);
    for (const s of timing.scenes) console.log(`  scene ${s.id}: ${s.start_s.toFixed(2)} s for ${s.duration_s.toFixed(2)} s`);
  }
}
