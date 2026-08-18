import { motion } from "framer-motion";
import { ArrowLeft, MapPin, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import venueDavidLloyd from "@/assets/venue-david-lloyd.jpg";
import davidLloydLogo from "@/assets/david-lloyd-logo.png";

const facilities = [
  "6 Indoor Tennis Courts",
  "3 Outdoor Courts",
  "Extensive Fitness Suite",
  "Progressive Junior Tennis Star Programme",
  "Expert LTA Coaching Team",
  "Competitive Opportunities",
  "Group & Private Coaching",
  "Social Tennis Events",
];

const VenueDavidLloyd = () => (
  <>
    <Navbar />
    <main className="pt-20">
      {/* Hero */}
      <section className="relative h-[50vh] min-h-[400px] overflow-hidden">
        <img src={venueDavidLloyd} alt="David Lloyd Ipswich" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-suffolk-navy/80 via-suffolk-navy/30 to-transparent" />
        <div className="absolute bottom-8 left-0 right-0 container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Link to="/#facilities" className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground text-sm font-body mb-4 transition-colors">
              <ArrowLeft size={16} /> Back to Venues
            </Link>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-white flex items-center justify-center p-2 border-2 border-lta-cyan">
                <img src={davidLloydLogo} alt="David Lloyd logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="font-display text-4xl md:text-5xl font-black text-primary-foreground">David Lloyd Ipswich</h1>
                <p className="text-lta-cyan font-display font-semibold text-sm uppercase tracking-wider mt-1">Premium Rackets Facility</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <h2 className="font-display text-2xl font-black text-foreground mb-4">About the Venue</h2>
                <p className="text-muted-foreground font-body leading-relaxed mb-4">
                  With first-class racquet facilities and expert coaches, David Lloyd Ipswich offers a thriving community for players of every level. From beginner courses to competitive leagues and junior programmes for ages 3–18, the club provides an outstanding environment for tennis development.
                </p>
                <p className="text-muted-foreground font-body leading-relaxed">
                  As one of the three Suffolk Tennis Performance Programme partner venues, David Lloyd Ipswich plays a crucial role in developing the next generation of tennis talent in the county. The club's indoor facilities ensure year-round training regardless of weather conditions.
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <h2 className="font-display text-2xl font-black text-foreground mb-4">Coaching & Programmes</h2>
                <p className="text-muted-foreground font-body leading-relaxed mb-4">
                  The David Lloyd coaching team delivers progressive programmes designed to nurture players from their first steps on court through to competitive match play. The Junior Tennis Star Programme provides a structured pathway for young players to develop their skills and compete at county and national level.
                </p>
              </motion.div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-card rounded-2xl p-6 border border-border"
              >
                <h3 className="font-display font-bold text-foreground mb-4">Facilities</h3>
                <div className="space-y-3">
                  {facilities.map((f) => (
                    <div key={f} className="flex items-start gap-2 text-sm font-body">
                      <MapPin size={14} className="text-lta-cyan mt-0.5 shrink-0" />
                      <span className="text-foreground">{f}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-card rounded-2xl p-6 border border-border"
              >
                <h3 className="font-display font-bold text-foreground mb-3">Location</h3>
                <p className="text-sm text-muted-foreground font-body mb-4">
                  Ransomes Europark, Ipswich, Suffolk, IP3 9QG
                </p>
                <a
                  href="https://www.davidlloyd.co.uk/clubs/ipswich/club-facilities/tennis/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-sm hover:brightness-110 transition-all w-full justify-center"
                >
                  Visit Website <ExternalLink size={14} />
                </a>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </main>
    <Footer />
  </>
);

export default VenueDavidLloyd;
