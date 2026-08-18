import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, ExternalLink, Users, Calendar, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface FeederClubPageProps {
  name: string;
  tagline: string;
  logo?: string;
  externalUrl: string;
  address: string;
  about: string[];
  coaching: string;
  facilities: string[];
  highlights?: string[];
}

const FeederClubPage = ({
  name,
  tagline,
  logo,
  externalUrl,
  address,
  about,
  coaching,
  facilities,
  highlights,
}: FeederClubPageProps) => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <>
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-[hsl(var(--suffolk-navy))] via-[hsl(var(--suffolk-navy))]/95 to-primary/20 py-20 overflow-hidden">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-white/20" />
            <div className="absolute bottom-10 right-10 w-60 h-60 rounded-full bg-white/10" />
          </div>
          <div className="container mx-auto px-6 relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <Link
                to="/"
                state={{ scrollTo: "map" }}
                className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm font-body mb-6 transition-colors"
              >
                <ArrowLeft size={16} /> Back to Map
              </Link>
              <div className="flex items-center gap-5">
                {logo && (
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-white flex items-center justify-center p-2 border-2 border-primary shrink-0">
                    <img src={logo} alt={`${name} logo`} className="w-full h-full object-contain" />
                  </div>
                )}
                <div>
                  <h1 className="font-display text-4xl md:text-5xl font-black text-white">{name}</h1>
                  <p className="text-primary font-display font-semibold text-sm uppercase tracking-wider mt-1">{tagline}</p>
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
                  <h2 className="font-display text-2xl font-black text-foreground mb-4">About the Club</h2>
                  {about.map((p, i) => (
                    <p key={i} className="text-muted-foreground font-body leading-relaxed mb-4">{p}</p>
                  ))}
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <h2 className="font-display text-2xl font-black text-foreground mb-4">Coaching & Programmes</h2>
                  <p className="text-muted-foreground font-body leading-relaxed">{coaching}</p>
                </motion.div>

                {highlights && highlights.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                    <h2 className="font-display text-2xl font-black text-foreground mb-4">Club Highlights</h2>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {highlights.map((h) => (
                        <div key={h} className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                          <Trophy size={14} className="text-primary mt-0.5 shrink-0" />
                          <span className="text-sm font-body text-foreground">{h}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
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
                        <MapPin size={14} className="text-primary mt-0.5 shrink-0" />
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
                  <p className="text-sm text-muted-foreground font-body mb-4">{address}</p>
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm hover:brightness-110 transition-all w-full justify-center"
                  >
                    Visit Official Website <ExternalLink size={14} />
                  </a>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="bg-[hsl(var(--suffolk-navy))] rounded-2xl p-6 text-center"
                >
                  <Users size={24} className="text-primary mx-auto mb-3" />
                  <h3 className="font-display font-bold text-white text-sm mb-1">Suffolk Tennis Feeder Club</h3>
                  <p className="text-white/60 text-xs font-body">Part of the Suffolk Tennis Performance Pathway network</p>
                </motion.div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default FeederClubPage;
