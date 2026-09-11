// The LTA talent-characteristics framework used by session reports. Names are
// the JSON keys stored in session_reports.ratings, so they never change.
export const LTA_AREAS: Array<{ name: string; descriptor: string }> = [
  { name: "Confident to Attack", descriptor: "Proactive, composed, loose" },
  { name: "Comfortable in Rally", descriptor: "Consistency, repeatable, contact point, tempo" },
  { name: "Chases Every Ball", descriptor: "Defending qualities, determined, adaptable" },
  { name: "Creative in Play", descriptor: "Skillfulness, chopper grip, feel, variety, adaptable" },
  { name: "Athletic Qualities", descriptor: "Agility, balance, coordination, speed" },
  { name: "Reads the Ball", descriptor: "Anticipation, perception, tennis specific movement" },
  { name: "Loves the Game", descriptor: "Inner drive, maximises training opportunity" },
  { name: "Loves to Compete", descriptor: "Competitive, commitment, relish challenge" },
  { name: "Serving", descriptor: "Grip, balance, rhythm, timing, throwing action" },
];

// 1 is best. `tone` maps onto StatusBadge tones; `classes` are the chip colours.
export const LTA_LEVELS: Array<{ value: 1 | 2 | 3 | 4; label: string; tone: "success" | "info" | "warning" | "danger"; classes: string }> = [
  { value: 1, label: "Excelling", tone: "success", classes: "bg-emerald-50 text-emerald-800 border-emerald-300" },
  { value: 2, label: "Consistent", tone: "info", classes: "bg-sky-50 text-sky-800 border-sky-300" },
  { value: 3, label: "Progressing", tone: "warning", classes: "bg-amber-50 text-amber-800 border-amber-300" },
  { value: 4, label: "Next Step Focus", tone: "danger", classes: "bg-red-50 text-red-800 border-red-300" },
];

export type Ratings = Record<string, number>;

export const levelLabel = (n: number | null | undefined): string =>
  LTA_LEVELS.find((l) => l.value === n)?.label ?? "Not rated";

export const isComplete = (ratings: Ratings | null | undefined): boolean =>
  !!ratings && LTA_AREAS.every((a) => [1, 2, 3, 4].includes(ratings[a.name] as number));

/** "Serving up from Progressing to Consistent" — plain, neutral trend copy. */
export function trendSentence(area: string, prev: number | undefined, next: number | undefined): string | null {
  if (!prev || !next || prev === next) return null;
  const better = next < prev; // lower is better on the LTA scale
  return `${area} ${better ? "up" : "down"} from ${levelLabel(prev)} to ${levelLabel(next)}`;
}
