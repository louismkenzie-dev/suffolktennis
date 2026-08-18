// Suffolk Tennis home clubs / lead venues for the child profile.
// Keep this list curated; "Other" lets parents type a custom club.
import davidLloydLogo from "@/assets/david-lloyd-logo.png";
import ipswichSportsLogo from "@/assets/ipswich-sports-logo.png";
import culfordLogo from "@/assets/culford-logo.jpg";
import eastBergholtLogo from "@/assets/feeder-east-bergholt.png";
import felixstoweLogo from "@/assets/feeder-felixstowe.png";
import woodbridgeLogo from "@/assets/feeder-woodbridge.png";

export type HomeClub = { name: string; logo?: string };

export const HOME_CLUB_OPTIONS: HomeClub[] = [
  { name: "David Lloyd Ipswich", logo: davidLloydLogo },
  { name: "Ipswich Sports Club", logo: ipswichSportsLogo },
  { name: "Culford School", logo: culfordLogo },
  { name: "East Bergholt Tennis Club", logo: eastBergholtLogo },
  { name: "Felixstowe Tennis Club", logo: felixstoweLogo },
  { name: "Framlingham Tennis Club" },
  { name: "Newmarket Tennis Club" },
  { name: "Stowmarket Tennis Club" },
  { name: "Woodbridge Tennis Club", logo: woodbridgeLogo },
];

// Backwards compat for callers using string list.
export const HOME_CLUBS = HOME_CLUB_OPTIONS.map((c) => c.name);
export const OTHER_CLUB = "Other";
