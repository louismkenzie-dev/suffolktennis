// Suffolk Tennis lead venues and feeder clubs with approx coordinates.
// Coordinates are public-knowledge venue locations used purely for nearest-club distance lookup.
export type SuffolkClub = {
  name: string;
  type: "lead" | "feeder";
  lat: number;
  lng: number;
  postcode: string;
  slug?: string;
};

export const SUFFOLK_CLUBS: SuffolkClub[] = [
  // Lead Venues / Performance Hubs
  { name: "David Lloyd Ipswich", type: "lead", lat: 52.0656, lng: 1.1690, postcode: "IP3 9SJ" },
  { name: "Ipswich Sports Club", type: "lead", lat: 52.0610, lng: 1.1480, postcode: "IP4 2HF" },
  { name: "Culford School", type: "lead", lat: 52.2861, lng: 0.6890, postcode: "IP28 6TX" },
  // Feeder Clubs
  { name: "East Bergholt Tennis Club", type: "feeder", lat: 51.9700, lng: 1.0190, postcode: "CO7 6TJ", slug: "east-bergholt" },
  { name: "Felixstowe Tennis Club", type: "feeder", lat: 51.9650, lng: 1.3490, postcode: "IP11 7HE", slug: "felixstowe" },
  { name: "Framlingham Tennis Club", type: "feeder", lat: 52.2230, lng: 1.3430, postcode: "IP13 9EE", slug: "framlingham" },
  { name: "Newmarket Tennis Club", type: "feeder", lat: 52.2440, lng: 0.4030, postcode: "CB8 8EA", slug: "newmarket" },
  { name: "Stowmarket Tennis Club", type: "feeder", lat: 52.1880, lng: 0.9970, postcode: "IP14 1JL", slug: "stowmarket" },
  { name: "Woodbridge Tennis Club", type: "feeder", lat: 52.0930, lng: 1.3210, postcode: "IP12 4AU", slug: "woodbridge" },
];
