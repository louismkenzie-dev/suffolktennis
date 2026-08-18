import { motion } from "framer-motion";
import { ArrowLeft, MapPin, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import venueIpswichSports from "@/assets/venue-ipswich-sports.jpg";
import ipswichSportsLogo from "@/assets/ipswich-sports-logo.png";

const facilities = [
  "3 Indoor Tennis Courts",
  "7 Outdoor Tennis Courts",
  "3 Additional Bubble Courts",
  "Extensive Fitness Suite",
  "Active Junior Programme",
  "Competitive Match Play",
  "Padel Courts",
  "Squash & Racketball Courts",
];

const VenueIpswichSports = () => (
  <>
    <Navbar />
    <main className="pt-20">
      {/* Hero */}
      <section className="relative h-[50vh] min-h-[400px] overflow-hidden">
        <img src={venueIpswichSports} alt="Ipswich Sports Club" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-suffolk-navy/80 via-suffolk-navy/30 to-transparent" />
        <div className="absolute bottom-8 left-0 right-0 container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Link to="/#facilities" className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground text-sm font-body mb-4 transition-colors">
              <ArrowLeft size={16} /> Back to Venues
            </Link>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-white flex items-center justify-center p-1.5 border-2 border-lta-cyan">
                <img src={ipswichSportsLogo} alt="Ipswich Sports Club logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="font-display text-4xl md:text-5xl font-black text-primary-foreground">Ipswich Sports Club</h1>
                <p className="text-lta-cyan font-display font-semibold text-sm uppercase tracking-wider mt-1">Community Rackets & Sports Club</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <h2 className="font-display text-2xl font-black text-foreground mb-4">About the Venue</h2>
                <p className="text-muted-foreground font-body leading-relaxed mb-4">
                  Suffolk's premier independent racket sports and hockey club with over a century of history. Ipswich Sports Club offers an inclusive community with fantastic Tennis, Squash, Padel, Hockey and Gym facilities for competitive and leisurely play.
                </p>
                <p className="text-muted-foreground font-body leading-relaxed">
                  As a key partner in the Suffolk Tennis Performance Programme, Ipswich Sports Club provides extensive outdoor and indoor court facilities that support player development across all age groups and ability levels. The club's rich heritage and community spirit make it a cornerstone of Suffolk tennis.
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <h2 className="font-display text-2xl font-black text-foreground mb-4">Coaching & Programmes</h2>
                <p className="text-muted-foreground font-body leading-relaxed">
                  With an active junior programme and competitive match play opportunities, Ipswich Sports Club caters for players at every stage of their development. The club hosts regular tournaments and provides a pathway from recreational to competitive tennis.
                </p>
              </motion.div>
            </div>

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
                  Henley Road, Ipswich, Suffolk, IP1 3SF
                </p>
                <a
                  href="https://ipswichsportsclub.co.uk"
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

export default VenueIpswichSports;
