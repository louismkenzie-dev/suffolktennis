import { lazy, type ComponentType } from "react";

/**
 * `React.lazy` that survives a deploy landing under a live tab.
 *
 * Every route is code-split and Vite content-hashes each chunk, so a deploy
 * renames all of them. A tab opened before the deploy — or one whose service
 * worker still holds the old shell — asks for a chunk name that no longer
 * exists, the dynamic import rejects, and the error reaches AppErrorBoundary
 * as "Something went wrong". Reloading fixes it because the fresh index.html
 * names the new chunks, so this does that reload automatically instead of
 * making the parent do it by hand.
 *
 * The SPA rewrite in vercel.json used to make this worse than a 404: a missing
 * chunk fell through to index.html and came back as 200 text/html, so the
 * browser failed on the MIME type rather than a missing file. That rewrite now
 * excludes /assets, but both shapes are matched below — the old behaviour is
 * still what any already-open tab will hit.
 */

const RELOAD_KEY = "st:chunk-reload-at";
/** Two reloads inside this window means reloading is not the answer. */
const RELOAD_WINDOW_MS = 15_000;

/**
 * A failed chunk fetch, across engines:
 *   Chrome   "Failed to fetch dynamically imported module: …"
 *   Firefox  "error loading dynamically imported module"
 *   Safari   "Importing a module script failed."
 * plus the MIME rejection the HTML-for-JS rewrite produced.
 */
const CHUNK_ERROR = /dynamically imported module|importing a module script failed|module script|mime type/i;

/** Exported for the regression test — this matcher is the fragile part. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return CHUNK_ERROR.test(message);
}

/** sessionStorage throws in some private-browsing modes; never fail on it. */
function readLastReload(): number {
  try {
    return Number(window.sessionStorage.getItem(RELOAD_KEY)) || 0;
  } catch {
    return 0;
  }
}

function markReload(): void {
  try {
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* no storage — the reload still happens, it just isn't rate-limited */
  }
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (!isChunkLoadError(error)) throw error;

      // Already reloaded for this moments ago and still broken — the chunk is
      // genuinely unreachable (offline, say). Let the boundary show rather
      // than spin.
      if (Date.now() - readLastReload() < RELOAD_WINDOW_MS) throw error;

      markReload();
      window.location.reload();

      // Keep Suspense on its fallback while the document tears down; resolving
      // or rejecting here would flash the error boundary on the way out.
      return new Promise<never>(() => {});
    }
  });
}
