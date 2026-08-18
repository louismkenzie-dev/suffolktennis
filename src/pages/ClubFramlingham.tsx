import FeederClubPage from "@/components/FeederClubPage";

const ClubFramlingham = () => (
  <FeederClubPage
    name="Framlingham College"
    tagline="Sports Centre & Tennis Programme"
    externalUrl="https://www.framlinghamcollege.co.uk/sports-centre/"
    address="Framlingham College, Framlingham, Suffolk, IP13 9EY"
    about={[
      "Framlingham College Sports Centre is located within the grounds of the Senior School campus and offers a range of classes, fitness facilities and activities for people of all ages and ability. The centre is accessible by members drawn from the school and wider community.",
      "As part of the Suffolk Tennis Performance Pathway network, Framlingham College provides tennis coaching and facilities that contribute to the development of junior players in the north-east Suffolk area.",
    ]}
    coaching="The sports centre runs tennis coaching sessions as part of a broader programme of sports activities. With access to quality facilities and experienced coaching staff, players of all ages can develop their game in a supportive and well-equipped environment."
    facilities={[
      "Indoor Sports Centre",
      "Tennis Courts",
      "Fitness Suite",
      "Swimming Pool",
      "Open 7 Days a Week",
      "Community Membership Available",
    ]}
    highlights={[
      "Part of Framlingham College campus",
      "Open to the wider community",
      "Multi-sport facility with tennis focus",
      "North-east Suffolk pathway hub",
    ]}
  />
);

export default ClubFramlingham;
