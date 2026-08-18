import FeederClubPage from "@/components/FeederClubPage";
import logo from "@/assets/feeder-east-bergholt.png";

const ClubEastBergholt = () => (
  <FeederClubPage
    name="East Bergholt Tennis Club"
    tagline="Award-Winning Community Club"
    logo={logo}
    externalUrl="https://eastbergholttennis.co.uk"
    address="East Bergholt, Suffolk"
    about={[
      "East Bergholt Tennis Club is an award-winning community club committed to making tennis accessible to all. With a friendly and welcoming atmosphere, the club offers something for everyone — whether you're picking up a racket for the first time or an experienced player looking for competitive matches.",
      "Membership benefits include a wide variety of organised tennis sessions, free court booking, use of floodlights, discounted coaching, two free social tennis sessions per week, and a range of social events throughout the year.",
    ]}
    coaching="Head Coach Matthew Watson, an LTA Level 3 coach and recent winner of the LTA Regional Coach of the Year, leads a full coaching programme for both children and adults. The club offers group sessions for all levels, private lessons, and junior holiday camps, ensuring everyone has the chance to improve their game in a supportive environment."
    facilities={[
      "3 Floodlit Hardcourts",
      "Year-Round Play",
      "LTA Coaching Programmes",
      "Junior Holiday Camps",
      "Social Tennis Sessions",
      "Club Events & Tournaments",
    ]}
    highlights={[
      "LTA Regional Coach of the Year winner",
      "Award-winning community club",
      "Welcoming environment for all ages",
      "Strong social tennis programme",
    ]}
  />
);

export default ClubEastBergholt;
