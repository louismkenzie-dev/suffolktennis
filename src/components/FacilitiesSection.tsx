import { motion } from "framer-motion";
import { MapPin, ExternalLink, Building2, Trees, Dumbbell } from "lucide-react";
import { Link } from "react-router-dom";
import venueDavidLloyd from "@/assets/venue-david-lloyd.jpg";
import venueIpswichSports from "@/assets/venue-ipswich-sports.jpg";
import venueCulford from "@/assets/venue-culford.jpg";
import culfordLogo from "@/assets/culford-logo.jpg";
import davidLloydLogo from "@/assets/david-lloyd-logo.png";
import ipswichSportsLogo from "@/assets/ipswich-sports-logo.png";

const hubs = [
  {
    name: "David Lloyd Ipswich",
    tagline: "Premium Rackets Facility",
    description:
      "With first-class racquet facilities and expert coaches, David Lloyd Ipswich offers a thriving community for players of every level. From beginner courses to competitive leagues and junior programmes for ages 3–18.",
    image: venueDavidLloyd,
    url: "https://www.davidlloyd.co.uk/clubs/ipswich/club-facilities/tennis/",
    path: "/venues/david-lloyd",
    facilities: [
      "6 Indoor Tennis Courts",
      "Extensive Fitness Suite",
      "3 Outdoor Court",
      "Progressive Junior Tennis Star Programme",
      "Expert LTA Coaching Team",
      "Competitive Opportunities",
    ],
    icon: Building2,
    accent: "lta-cyan",
    logo: davidLloydLogo,
  },
  {
    name: "Ipswich Sports Club",
    tagline: "Community Rackets & Sports Club",
    description:
      "Suffolk's premier independent racket sports and hockey club with over a century of history. An inclusive community with fantastic Tennis, Squash, Padel, Hockey and Gym facilities for competitive and leisurely play.",
    image: venueIpswichSports,
    url: "https://ipswichsportsclub.co.uk",
    path: "/venues/ipswich-sports-club",
    facilities: [
      "3 Indoor Tennis Courts",
      "7 Outdoor Tennis Courts",
      "3 additional Bubble Courts",
      "Extensive Fitness Suite",
      "Active Junior Programme",
      "Competitive Match Play",
    ],
    icon: Dumbbell,
    accent: "lta-cyan",
    logo: ipswichSportsLogo,
    logoStyle: "p-1.5",
  },
  {
    name: "Culford Sports & Tennis Centre",
    tagline: "LTA Regional Player Development Centre",
    description:
      "An accredited LTA Regional and Local Player Development Programme, consistently ranked as one of the top tennis schools in the UK. A coaching team of 10 coaches and 5 S&C coaches — unrivalled for a school.",
    image: venueCulford,
    url: "https://www.culford.co.uk/commercial/sports-and-tennis-centre",
    path: "/venues/culford",
    facilities: [
      "6 Court Indoor Tennis Centre",
      "7 Outdoor Tennis Courts",
      "Strength & Conditioning Suite",
      "Integrated School Performance Programme",
      "Strong Competition Calendar",
      "Highly Qualified Coaching Team",
    ],
    icon: Trees,
    accent: "lta-cyan",
    logo: culfordLogo,
    logoStyle: "p-0 bg-[#1a7fbf]",
  },
];

const FacilitiesSection = () => (
  <section id="facilities" className="py-24 bg-background">
    <div className="container mx-auto px-6">
      {/* Header */}
      <div className="text-center mb-6">
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-sm font-semibold text-lta-cyan uppercase tracking-widest"
        >
          County Performance Hubs
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display text-4xl md:text-5xl font-black text-foreground mt-3"
        >
          Our <span className="text-gradient-blue">Partner Venues</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-muted-foreground max-w-2xl mx-auto mt-4 text-lg font-body"
        >
          Three outstanding facilities powering Suffolk's tennis pathway — from grassroots to national competition.
        </motion.p>
      </div>

      {/* Hub Cards */}
      <div className="space-y-16 mt-14">
        {hubs.map((hub, i) => {
          const Icon = hub.icon;
          const isReversed = i % 2 !== 0;

          return (
            <motion.div
              key={hub.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className={`grid lg:grid-cols-2 gap-8 items-center ${isReversed ? "lg:direction-rtl" : ""}`}
            >
              {/* Image */}
              <div className={`${isReversed ? "lg:order-2" : ""}`}>
                <div className="relative rounded-2xl overflow-hidden group">
                  <img
                    src={hub.image}
                    alt={hub.name}
                    className="w-full aspect-[16/10] object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-suffolk-navy/60 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg bg-${hub.accent} flex items-center justify-center`}>
                      <Icon size={16} className="text-suffolk-navy" />
                    </div>
                    <span className="text-primary-foreground font-display font-bold text-sm tracking-wide">
                      Performance Hub
                    </span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className={`${isReversed ? "lg:order-1" : ""}`}>
              <div className="flex items-center gap-4 mb-1">
                  {hub.logo && (
                    <div className={`w-14 h-14 rounded-full overflow-hidden border-2 border-lta-cyan shrink-0 bg-white flex items-center justify-center ${hub.logoStyle || 'p-2'}`}>
                      <img src={hub.logo} alt={`${hub.name} logo`} className="w-full h-full object-contain" />
                    </div>
                  )}
                  <h3 className="font-display text-2xl md:text-3xl font-black text-foreground">
                    {hub.name}
                  </h3>
                </div>
                <p className={`text-${hub.accent} font-display font-semibold text-sm uppercase tracking-wider mb-4`}>
                  {hub.tagline}
                </p>
                <p className="text-muted-foreground font-body leading-relaxed mb-6">
                  {hub.description}
                </p>

                {/* Facilities grid */}
                <div className="grid grid-cols-2 gap-2.5 mb-6">
                  {hub.facilities.map((f) => (
                    <div
                      key={f}
                      className="flex items-start gap-2 text-sm font-body"
                    >
                      <MapPin size={14} className="text-lta-cyan mt-0.5 shrink-0" />
                      <span className="text-foreground">{f}</span>
                    </div>
                  ))}
                </div>

                <Link
                  to={hub.path}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-sm hover:brightness-110 transition-all"
                >
                  Visit Venue <ExternalLink size={14} />
                </Link>
                
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);

export default FacilitiesSection;
