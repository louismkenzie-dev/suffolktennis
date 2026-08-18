import { motion } from "framer-motion";
import { ArrowLeft, MapPin, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import venueCulford from "@/assets/venue-culford.jpg";
import culfordLogo from "@/assets/culford-logo.jpg";

const facilities = [
  "6 Court Indoor Tennis Centre",
  "7 Outdoor Tennis Courts",
  "Strength & Conditioning Suite",
  "Integrated School Performance Programme",
  "Strong Competition Calendar",
  "Highly Qualified Coaching Team",
  "25m Heated Indoor Pool",
  "Sports Hall & AstroTurf Pitches",
];

const VenueCulford = () => (
  <>
    <Navbar />
    <main className="pt-20">
      {/* Hero */}
      <section className="relative h-[50vh] min-h-[400px] overflow-hidden">
        <img src={venueCulford} alt="Culford Sports & Tennis Centre" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-suffolk-navy/80 via-suffolk-navy/30 to-transparent" />
        <div className="absolute bottom-8 left-0 right-0 container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Link to="/#facilities" className="inline-flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground text-sm font-body mb-4 transition-colors">
              <ArrowLeft size={16} /> Back to Venues
            </Link>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-[#1a7fbf] flex items-center justify-center border-2 border-lta-cyan">
                <img src={culfordLogo} alt="Culford logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="font-display text-4xl md:text-5xl font-black text-primary-foreground">Culford Sports & Tennis Centre</h1>
                <p className="text-lta-cyan font-display font-semibold text-sm uppercase tracking-wider mt-1">LTA Regional Player Development Centre</p>
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
                  An accredited LTA Regional and Local Player Development Programme, Culford is consistently ranked as one of the top tennis schools in the UK. With a coaching team of 10 coaches and 5 S&C coaches, their provision is unrivalled for a school setting.
                </p>
                <p className="text-muted-foreground font-body leading-relaxed">
                  Set in the stunning grounds of Culford School in Bury St Edmunds, the Sports & Tennis Centre offers world-class facilities that combine elite performance training with an integrated school programme. Players benefit from a holistic approach to development, balancing academic excellence with sporting achievement.
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <h2 className="font-display text-2xl font-black text-foreground mb-4">Coaching & Programmes</h2>
                <p className="text-muted-foreground font-body leading-relaxed">
                  Culford's highly qualified coaching team delivers programmes from grassroots to elite level. The integrated school performance programme allows student-athletes to train alongside their studies, with strength and conditioning support and a strong competition calendar throughout the year.
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
                  Culford, Bury St Edmunds, Suffolk, IP28 6TX
                </p>
                <a
                  href="https://www.culford.co.uk/commercial/sports-and-tennis-centre"
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

export default VenueCulford;
