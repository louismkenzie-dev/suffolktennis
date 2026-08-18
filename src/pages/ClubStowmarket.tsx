import FeederClubPage from "@/components/FeederClubPage";

const ClubStowmarket = () => (
  <FeederClubPage
    name="Stowmarket Lawn Tennis Club"
    tagline="Tennis for All"
    externalUrl="https://clubspark.lta.org.uk/StowmarketLawnTennisClub"
    address="Stowmarket, Suffolk"
    about={[
      "If you live or work in or around Stowmarket, this is the place to play tennis — and from Summer 2024, Pickleball too. The club caters for all abilities, genders, and ages, with opportunities to learn to play or improve your game through excellent and regular coaching programmes.",
      "The club has a very strong juniors section, catering for pre-school and school children, families, students, and adults of all ages. As of March 2024, the club had 346 members including almost 100 juniors. Some members have been in continuous membership for over half a century, and the club will celebrate its 125th birthday in 2026.",
    ]}
    coaching="The club runs regular coaching programmes for all levels, with a particular focus on nurturing junior talent. From pre-school mini tennis through to competitive junior and adult squads, there's a coaching pathway for every player."
    facilities={[
      "5 Recently Resurfaced Hardcourts",
      "Winter Airdome Over 3 Courts",
      "4 Pickleball Courts",
      "Recently Improved Clubhouse",
      "Ample Parking",
      "All-Year-Round Play",
    ]}
    highlights={[
      "346 members including ~100 juniors",
      "Celebrating 125th birthday in 2026",
      "Recently resurfaced courts & new Airdome",
      "Strong juniors section",
    ]}
  />
);

export default ClubStowmarket;
