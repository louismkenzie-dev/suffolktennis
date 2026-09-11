import lockupSrc from "@/assets/suffolk-tennis-logo-landscape-light.png";
import markSrc from "@/assets/suffolk-tennis-mark-light.png";
import { cn } from "@/lib/utils";

/**
 * The partnership lockup for LIGHT surfaces — the signed-in app shells, whose
 * header sits on `bg-background` (white).
 *
 * The brand pack's landscape file is drawn in white ink for navy backgrounds,
 * so on these screens everything but the pink "SUFFOLK" disappeared. These are
 * the navy-ink artwork (see scripts/make-light-logo.py); the white originals
 * stay in use on the navy public site, Auth and Footer.
 *
 * Both files are cropped to their ink, so the height class is the rendered
 * height with no padding to guess at. Intrinsic width/height are set so the
 * browser reserves the right box before the image loads.
 */

/**
 * Full lockup: LTA mark + SUFFOLK + TENNIS PARTNERSHIP. Wide — from `md` up.
 *
 * The lockup stacks three tiers of type against the mark, so it needs more
 * height than a plain wordmark before "PARTNERSHIP" stops being a smudge: 36px
 * is the floor, 40px is comfortable. Both clear the 56px bar with room to
 * breathe; 44px starts to crowd it.
 */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <img
      src={lockupSrc}
      alt=""
      width={1884}
      height={533}
      className={cn("h-9 w-auto lg:h-10", className)}
    />
  );
}

/** LTA mark alone, for the narrow phone header where the lockup can't breathe. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={markSrc}
      alt=""
      width={727}
      height={442}
      className={cn("h-7 w-auto sm:h-8", className)}
    />
  );
}
