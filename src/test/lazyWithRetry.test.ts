import { describe, it, expect } from "vitest";
import { isChunkLoadError } from "../lib/lazyWithRetry";

/**
 * A deploy renames every code-split chunk, so a tab opened before it asks for
 * one that has gone. Each engine words that failure differently, and the SPA
 * rewrite used to turn it into a MIME error rather than a missing file. If this
 * matcher stops recognising any of them, the "Something went wrong" boundary
 * comes back — hence pinning the exact strings.
 */
describe("isChunkLoadError", () => {
  it("matches a failed chunk fetch in every engine", () => {
    const messages = [
      // Chrome / Edge
      "Failed to fetch dynamically imported module: https://suffolktennis.online/assets/Events-BvE4hZaG.js",
      // Firefox
      "error loading dynamically imported module",
      // Safari
      "Importing a module script failed.",
      // What the SPA rewrite produced: index.html served for a .js request
      'Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html".',
    ];
    for (const message of messages) {
      expect(isChunkLoadError(new Error(message)), message).toBe(true);
    }
  });

  it("leaves ordinary application errors alone", () => {
    const messages = [
      "Cannot read properties of undefined (reading 'id')",
      "Network request failed",
      "Invalid invitation link",
      "supabase: JWT expired",
    ];
    for (const message of messages) {
      expect(isChunkLoadError(new Error(message)), message).toBe(false);
    }
  });

  it("copes with non-Error throws", () => {
    expect(isChunkLoadError("Importing a module script failed.")).toBe(true);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});
