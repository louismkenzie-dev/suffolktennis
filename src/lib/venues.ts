// Known Suffolk Tennis venues with coordinates, used to put a map on booking
// details when an event's free-text location matches one. Coordinates are
// [lng, lat] (MapLibre order), matching SuffolkMapSection's markers.

export interface KnownVenue {
  name: string;
  coords: [number, number];
  /** Lower-cased substrings that identify this venue in free-text locations. */
  aliases: string[];
}

export const KNOWN_VENUES: KnownVenue[] = [
  { name: "David Lloyd Ipswich", coords: [1.1879, 52.0638], aliases: ["david lloyd"] },
  { name: "Ipswich Sports Club", coords: [1.1635, 52.0565], aliases: ["ipswich sports"] },
  { name: "Culford Sports & Tennis Centre", coords: [0.7342, 52.3108], aliases: ["culford"] },
  { name: "East Bergholt Tennis Club", coords: [1.0485, 51.9725], aliases: ["east bergholt"] },
  { name: "Newmarket Tennis Club", coords: [0.405, 52.244], aliases: ["newmarket"] },
  { name: "Stowmarket Lawn Tennis Club", coords: [1.0, 52.189], aliases: ["stowmarket"] },
  { name: "Felixstowe Lawn Tennis Club", coords: [1.351, 51.963], aliases: ["felixstowe"] },
  { name: "Woodbridge Tennis Club", coords: [1.268, 52.094], aliases: ["woodbridge"] },
  { name: "Framlingham College", coords: [1.287, 52.222], aliases: ["framlingham"] },
];

export function findVenueByLocation(location: string | null | undefined): KnownVenue | null {
  if (!location) return null;
  const haystack = location.toLowerCase();
  return KNOWN_VENUES.find((v) => v.aliases.some((a) => haystack.includes(a))) ?? null;
}

export function googleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}
