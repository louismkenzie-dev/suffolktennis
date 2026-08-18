import FeederClubPage from "@/components/FeederClubPage";
import logo from "@/assets/feeder-felixstowe.png";

const ClubFelixstowe = () => (
  <FeederClubPage
    name="Felixstowe Lawn Tennis Club"
    tagline="Bringing Tennis Since 1884"
    logo={logo}
    externalUrl="https://felixstowetennis.co.uk"
    address="Felixstowe, Suffolk"
    about={[
      "Established in 1884, Felixstowe Lawn Tennis Club is one of the oldest clubs in the UK. It hosted a GB Davis Cup Tie in 1954. Many past and present professional players have graced their courts including Fred Perry, Tim Henman, Dan Evans and more recently, Emma Raducanu in 2021 — the year she won the US Open.",
      "The club offers fun and competitive tennis for all ages and abilities, with regular club sessions on Tuesday evenings and Sunday mornings. They have men's, ladies and mixed teams in the Suffolk league, a Friday Night League for all ages and abilities, and run an extensive coaching programme for adults and juniors.",
    ]}
    coaching="The club is home to Makeaball Tennis Academy, run by Head Coach Matt Hough. MTA runs a term-time coaching programme for juniors and adults of all ages and abilities, plus private coaching and junior holiday camps during school breaks."
    facilities={[
      "9 Grass Courts (Summer Season)",
      "3 Acrylic Courts (Floodlit)",
      "3 Macadam Courts (Floodlit)",
      "3 Artificial Grass Courts (Floodlit)",
      "Spacious Clubhouse",
      "Year-Round Play on 9 Floodlit Courts",
    ]}
    highlights={[
      "One of the UK's oldest tennis clubs (est. 1884)",
      "Hosted GB Davis Cup Tie in 1954",
      "Emma Raducanu played here in 2021",
      "Home to Makeaball Tennis Academy",
    ]}
  />
);

export default ClubFelixstowe;
