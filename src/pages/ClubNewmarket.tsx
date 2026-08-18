import FeederClubPage from "@/components/FeederClubPage";

const ClubNewmarket = () => (
  <FeederClubPage
    name="Newmarket Tennis Club"
    tagline="Community Tennis Since 1948"
    externalUrl="https://clubspark.lta.org.uk/newmarkettennisclub"
    address="Newmarket, Suffolk"
    about={[
      "Founded in 1948, Newmarket Tennis Club has grown into a not-for-profit, volunteer-run community hub. Their mission is to promote good sportsmanship, inspire community spirit, and provide outstanding tennis opportunities for everyone.",
      "The club continually invests in programmes and facilities to ensure every visit is enjoyable, rewarding, and memorable. Whether you're completely new to tennis or returning for your hundredth match, you'll always receive a warm welcome.",
    ]}
    coaching="The club runs coaching programmes for all ages and abilities, from Mini Red through to adult improvers and competitive squads. Junior programmes follow the LTA pathway, giving young players the perfect foundation to develop their skills and love of the game."
    facilities={[
      "3 Floodlit Macadam Courts",
      "3 ITF-Rated Synthetic Clay Courts",
      "Winter Air Hall (The Bubble) — Oct to Apr",
      "Indoor Tennis Throughout Winter",
      "Professional Court Colour Scheme",
      "One of Few Regional Indoor Play Clubs",
    ]}
    highlights={[
      "7 premium courts for year-round play",
      "Winter Air Hall for indoor tennis",
      "ITF Grade 1 rated clay courts",
      "Volunteer-run community hub since 1948",
    ]}
  />
);

export default ClubNewmarket;
