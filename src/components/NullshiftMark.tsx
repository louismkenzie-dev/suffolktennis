/**
 * Nullshift wordmark.
 *
 * Drawn inline rather than shipped as an image so the two offset bars keep the
 * geometry from Nullshift's own SVG while the wordmark uses a real webfont —
 * an <img src="*.svg"> would not load Barlow Condensed and the text would fall
 * back to whatever the browser had to hand. Everything is sized in `em` so the
 * caller controls the whole lockup with a single font-size.
 */
const NullshiftMark = ({ className = "" }: { className?: string }) => (
  <span className={`inline-flex items-baseline gap-[0.25em] ${className}`}>
    <svg
      viewBox="0 0 21 29"
      className="w-auto self-center"
      style={{ height: "1.15em" }}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0" y="0" width="9.4" height="24.9" rx="2.2" fill="#4B5563" />
      <rect x="11.5" y="4" width="9.4" height="24.9" rx="2.2" fill="#10B981" />
    </svg>
    <span
      className="font-black leading-none text-foreground"
      style={{ fontFamily: "'Barlow Condensed', 'Archivo', system-ui, sans-serif" }}
    >
      NULLSHIFT
    </span>
  </span>
);

export default NullshiftMark;
