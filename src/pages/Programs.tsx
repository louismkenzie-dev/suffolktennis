import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Trophy, CalendarDays, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import redBadge from "@/assets/punchy-red-tour.png";
import orangeBadge from "@/assets/punchy-orange-tour.png";
import greenBadge from "@/assets/punchy-green-tour.png";
import yellowBadgeAsset from "@/assets/suffolk-yellow-ball-badge.png.asset.json";

const yellowBadge = yellowBadgeAsset.url;

const programs = [
  {
    name: "Red Ball",
    tagline: "8 & Under",
    badge: redBadge,
    path: "/programs/red-tour",
    frequency: "Weekly County Training",
    accent: "from-rose-500/20 to-rose-500/0",
    ring: "ring-rose-500/40",
    description:
      "The foundation stage of the pathway. Identified Red Ball players are invited to weekly county training, developing technique, coordination and a love of the game.",
  },
  {
    name: "Orange Ball",
    tagline: "9 & Under",
    badge: orangeBadge,
    path: "/programs/orange-tour",
    frequency: "Weekly County Training",
    accent: "from-orange-500/20 to-orange-500/0",
    ring: "ring-orange-500/40",
    description:
      "Building on Red Ball fundamentals, Orange Ball players progress to a larger court with weekly county sessions focused on tactics, movement and match play.",
  },
  {
    name: "Green Ball",
    tagline: "10 & Under",
    badge: greenBadge,
    path: "/programs/green-tour",
    frequency: "Monthly County Training",
    accent: "from-emerald-500/20 to-emerald-500/0",
    ring: "ring-emerald-500/40",
    description:
      "Green Ball county players transition towards full-court tennis with monthly county training that sharpens performance, strategy and competitive edge.",
  },
  {
    name: "Yellow Ball",
    tagline: "11 – 18",
    badge: yellowBadge,
    path: "/programs/yellow-tour",
    frequency: "Monthly County Training",
    accent: "from-lta-yellow/25 to-lta-yellow/0",
    ring: "ring-lta-yellow/50",
    description:
      "The performance stage of the pathway. Yellow Ball county players train monthly to compete with confidence at county, regional and national level.",
  },
];

const Programs = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-40 pb-24">
        {/* Hero */}
        <section className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
          >
            <p className="text-sm font-display font-semibold text-lta-cyan uppercase tracking-[0.3em] mb-4">
              Junior Tennis Pathway
            </p>
            <h1 className="font-display text-4xl md:text-6xl font-black text-foreground mb-6">
              Our Programmes
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground font-body leading-relaxed">
              The Suffolk Junior Tennis Pathway is the county's premier player development
              programme, bringing together Suffolk's most talented young players in a
              high-performance environment. Through exceptional coaching, purposeful training
              and a culture of excellence, we develop players to compete with confidence at
              county, regional and national level.
            </p>
          </motion.div>

          {/* Pathway snapshot */}
          <div className="grid md:grid-cols-2 gap-4 mt-12 max-w-4xl mx-auto">
            <div className="rounded-2xl border border-border bg-card p-6 flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-lta-cyan/10 text-lta-cyan flex items-center justify-center shrink-0">
                <CalendarDays size={22} />
              </div>
              <div>
                <p className="font-display font-bold text-foreground">Weekly County Training</p>
                <p className="text-sm text-muted-foreground font-body mt-1">
                  Identified 8U Red Ball & 9U Orange Ball players are invited to weekly county
                  training sessions.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-lta-yellow/20 text-amber-700 flex items-center justify-center shrink-0">
                <Trophy size={22} />
              </div>
              <div>
                <p className="font-display font-bold text-foreground">Monthly County Training</p>
                <p className="text-sm text-muted-foreground font-body mt-1">
                  10U Green Ball & 11–18 Yellow Ball county players are invited to monthly
                  county training sessions.
                </p>
              </div>
            </div>
          </div>

          <p className="max-w-3xl mx-auto text-center text-muted-foreground font-body mt-10">
            A clear, progressive pathway ensures every player receives the coaching, challenge
            and support needed to reach their full potential.
          </p>
        </section>

        {/* Programme cards */}
        <section className="container mx-auto px-6 mt-20">
          <div className="flex items-center justify-center gap-3 mb-10">
            <div className="h-px w-12 bg-border" />
            <p className="text-xs font-display font-semibold text-lta-cyan uppercase tracking-[0.3em]">
              The Four Stages
            </p>
            <div className="h-px w-12 bg-border" />
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {programs.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <Link
                  to={p.path}
                  className={`group relative block rounded-3xl border border-border bg-card p-7 overflow-hidden hover:ring-2 ${p.ring} transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${p.accent} opacity-0 group-hover:opacity-100 transition-opacity`}
                  />
                  <div className="relative flex items-start gap-5">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center bg-white">
                      <img src={p.badge} alt={p.name} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-display font-semibold uppercase tracking-widest text-lta-cyan">
                        {p.tagline}
                      </p>
                      <h3 className="font-display text-2xl font-black text-foreground mt-1">
                        {p.name}
                      </h3>
                      <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-accent text-xs font-body text-foreground">
                        <Users size={12} />
                        {p.frequency}
                      </div>
                    </div>
                  </div>
                  <p className="relative text-sm text-muted-foreground font-body mt-5 leading-relaxed">
                    {p.description}
                  </p>
                  <div className="relative flex items-center gap-2 mt-5 text-sm font-display font-semibold text-lta-cyan">
                    Explore {p.name}
                    <ArrowRight
                      size={16}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Programs;
