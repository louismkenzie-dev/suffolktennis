import FeederClubPage from "@/components/FeederClubPage";
import logo from "@/assets/feeder-woodbridge.png";

const ClubWoodbridge = () => (
  <FeederClubPage
    name="Woodbridge Tennis Club"
    tagline="All Year Round Tennis"
    logo={logo}
    externalUrl="https://woodbridgetennis.org"
    address="Woodbridge, Suffolk"
    about={[
      "Woodbridge Tennis Club is a thriving community of tennis enthusiasts with over 400 members of all ages and abilities. Whether you're a seasoned player or a beginner just starting out, you'll find a warm and friendly atmosphere at the club.",
      "The club also offers Pickleball on court six, a fun and fast-paced paddle sport combining elements of tennis, badminton, and table tennis. Social play is a key element of the club, with lots of opportunities to play games in a relaxed atmosphere.",
    ]}
    coaching="The experienced coaching team, with over 50 years of coaching experience between them, develops both adult and junior players of all levels and abilities. Junior coaching offers fun, dynamic sessions from first-timers to performance players, while adult coaching covers everything from mastering the basics to refining advanced techniques."
    facilities={[
      "6 All-Weather Floodlit Courts",
      "Year-Round Play",
      "Pickleball Court",
      "Junior & Adult Coaching Programmes",
      "Social Tennis Sessions",
      "Club Tournaments",
    ]}
    highlights={[
      "Over 400 members of all ages",
      "6 all-weather floodlit courts",
      "50+ years combined coaching experience",
      "Active social and competitive programme",
    ]}
  />
);

export default ClubWoodbridge;
