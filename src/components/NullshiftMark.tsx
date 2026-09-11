/**
 * Nullshift wordmark.
 *
 * Drawn inline rather than shipped as an image so the two offset bars keep the
 * geometry from Nullshift's own SVG while the wordmark uses a real webfont —
 * an <img src="*.svg"> would not load the face and the text would fall back to
 * whatever the browser had to hand. Everything is sized in `em` so the caller
 * controls the whole lockup with a single font-size.
 *
 * Matched against the current brand artwork: the leading bar is black (not the
 * grey it used to be), the green is the softer brand tone rather than emerald,
 * the wordmark is Archivo at 800 rather than a condensed face, and the ®
 * follows the wordmark. Archivo carries a width axis, so both `wght` and
 * `wdth` are pinned — a stray inherited `font-stretch` would otherwise squeeze
 * the letterforms.
 *
 * The bar takes `currentColor` so the lockup stays legible if the dark palette
 * in index.css is ever switched on; the green is a brand value and stays fixed.
 */
const WORDMARK_FONT = "'Archivo', system-ui, sans-serif";

const NullshiftMark = ({ className = "" }: { className?: string }) => (
  <span className={`inline-flex items-center gap-[0.62em] text-foreground ${className}`}>
    <svg
      viewBox="0 0 21 29"
      className="w-auto shrink-0"
      style={{ height: "1.15em" }}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0" y="0" width="9.4" height="24.9" rx="2.2" fill="currentColor" />
      <rect x="11.5" y="4" width="9.4" height="24.9" rx="2.2" fill="#4CA97C" />
    </svg>
    {/* The ® sits much closer to the wordmark than the wordmark does to the
        bars, so it gets its own gap rather than inheriting the outer one. */}
    <span className="inline-flex items-center gap-[0.28em]">
      <span
        className="leading-none"
        style={{
          fontFamily: WORDMARK_FONT,
          fontWeight: 800,
          fontStretch: "100%",
          fontVariationSettings: "'wght' 800, 'wdth' 100",
        }}
      >
        NULLSHIFT
      </span>
      <span
        className="leading-none"
        style={{
          fontFamily: WORDMARK_FONT,
          fontWeight: 600,
          fontStretch: "100%",
          fontVariationSettings: "'wght' 600, 'wdth' 100",
          fontSize: "0.34em",
        }}
      >
        ®
      </span>
    </span>
  </span>
);

export default NullshiftMark;
