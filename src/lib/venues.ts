// Known Suffolk Tennis venues with coordinates, used to put a map on booking
// details when an event's free-text location matches one. Coordinates are
// [lng, lat] (MapLibre order), matching SuffolkMapSection's markers.

export interface KnownVenue {
  name: string;
  coords: [number, number];
  /** Lower-cased substrings that identify this venue in free-text locations. */
  aliases: string[];
}

// Geocoded from OpenStreetMap (Nominatim), 21 Aug 2026.
export const KNOWN_VENUES: KnownVenue[] = [
  { name: "David Lloyd Ipswich", coords: [1.2135, 52.0273], aliases: ["david lloyd"] }, // The Havens, Ravenswood IP3 9SJ
  { name: "Ipswich Sports Club", coords: [1.1535, 52.0731], aliases: ["ipswich sports"] }, // Henley Road IP1 4NJ
  { name: "Culford Sports & Tennis Centre", coords: [0.6866, 52.3018], aliases: ["culford"] }, // Culford School IP28 6TX
  { name: "East Bergholt Tennis Club", coords: [1.0255, 51.9701], aliases: ["east bergholt"] }, // Gandish Road CO7 6TP
  { name: "Newmarket Tennis Club", coords: [0.3927, 52.2411], aliases: ["newmarket"] }, // Hamilton Road, Studlands Park
  { name: "Stowmarket Lawn Tennis Club", coords: [0.9744, 52.1962], aliases: ["stowmarket"] }, // Chilton Fields
  { name: "Felixstowe Lawn Tennis Club", coords: [1.3593, 51.9642], aliases: ["felixstowe"] }, // Bath Road IP11 7JN
  { name: "Woodbridge Tennis Club", coords: [1.3144, 52.0883], aliases: ["woodbridge"] }, // The Avenue
  { name: "Framlingham College", coords: [1.3396, 52.2277], aliases: ["framlingham"] }, // College Road
];

export function findVenueByLocation(location: string | null | undefined): KnownVenue | null {
  if (!location) return null;
  const haystack = location.toLowerCase();
  return KNOWN_VENUES.find((v) => v.aliases.some((a) => haystack.includes(a))) ?? null;
}

export function googleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}
