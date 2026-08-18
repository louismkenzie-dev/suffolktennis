import { motion } from "framer-motion";
import { Trophy, Users, Calendar, Sparkles, Heart, ShieldCheck, ArrowRight, ExternalLink, Award, Target } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import tennisGpLogo from "@/assets/tennis-gp-logo.png";

const reasons = [
  { icon: Users, title: "Social & Friendly", text: "A safe, welcoming environment built for enjoyment as much as competition." },
  { icon: Sparkles, title: "Confidence Builder", text: "Perfect for players stepping outside internal club competitions for the first time." },
  { icon: Calendar, title: "Same Weekend, Monthly", text: "Events scheduled the same weekend each month — easy to plan around." },
  { icon: Target, title: "Level-Matched Play", text: "D1 and D2 divisions so players compete against similar-ability opponents." },
  { icon: Heart, title: "No Pressure", text: "Play as many or as few events as you like — regular play just keeps you sharp." },
  { icon: Award, title: "LTA Award-Winning", text: "Named LTA National 'Competition of the Year' in its inaugural season." },
];

const ageGroups = [
  { label: "Red Ball", age: "8U", color: "from-rose-500 to-red-600" },
  { label: "Orange Ball", age: "9U", color: "from-orange-500 to-amber-600" },
  { label: "Green Ball", age: "10U", color: "from-emerald-500 to-green-600" },
  { label: "Yellow", age: "12U", color: "from-lta-yellow to-amber-500" },
  { label: "Yellow", age: "14U", color: "from-lta-cyan to-cyan-600" },
  { label: "Yellow", age: "17U", color: "from-suffolk-navy to-blue-800" },
];

const TennisGP = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-40 pb-20 bg-gradient-to-br from-suffolk-navy via-[#0f2a5a] to-suffolk-navy overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-96 h-96 bg-lta-cyan rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-lta-yellow rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto text-center"
          >
            <motion.img
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring" }}
              src={tennisGpLogo}
              alt="Tennis Grand Prix logo"
              className="w-32 h-32 md:w-40 md:h-40 mx-auto rounded-2xl shadow-2xl"
            />
            <span className="inline-flex items-center gap-2 mt-8 px-4 py-1.5 rounded-full bg-lta-yellow/15 text-lta-yellow text-xs font-bold uppercase tracking-widest">
              <Trophy size={14} /> Partner Competition Series
            </span>
            <h1 className="font-display text-5xl md:text-6xl font-black text-primary-foreground mt-5">
              Tennis <span className="text-lta-yellow">Grand Prix</span>
            </h1>
            <p className="text-primary-foreground/80 font-body mt-5 text-lg max-w-2xl mx-auto">
              The best beginner & improver competition series in the region — giving Suffolk juniors a social, friendly place to start their competitive journey.
            </p>
            <a
              href="https://www.tennisgp.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold hover:brightness-110 transition-all"
            >
              Visit tennisgp.uk <ExternalLink size={16} />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-lta-cyan">Discover</span>
            <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mt-3">
              Our <span className="text-gradient-blue">Story</span>
            </h2>
            <div className="mt-6 space-y-4 text-muted-foreground font-body leading-relaxed">
              <p>
                Born from an idea in 2020 during lockdown, the Tennis Grand Prix was created to give a growing number of beginner and improver players the chance to compete against similar-ability opponents in a safe, social environment.
              </p>
              <p>
                In its inaugural year, the series was named <strong className="text-foreground">LTA County, Regional and National 'Competition of the Year'</strong> — and has grown year on year to over <strong className="text-foreground">420 competitors across 6 age groups</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="font-display text-4xl md:text-5xl font-black text-foreground">
                How It <span className="text-gradient-blue">Works</span>
              </h2>
              <p className="text-muted-foreground font-body mt-4 max-w-2xl mx-auto">
                Qualification events run February–July, culminating in a finals day held in August for all categories of player.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { n: "01", t: "Two Divisions", d: "Players are placed in D1 or D2 based on their home coach's ability & experience judgement — matched-level competition every event." },
                { n: "02", t: "Matches Guaranteed", d: "From Orange (9U) through 16U, players get a minimum of 3 singles and 1 doubles per event, earning points towards finals qualification." },
                { n: "03", t: "Finals Day", d: "The top 16 players from each category are invited to a single-day finals event — 2024 saw nearly 300 attendees and 80 competitors." },
              ].map((s, i) => (
                <motion.div
                  key={s.n}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-2xl border border-border bg-card p-6 hover:shadow-[var(--shadow-elevated)] transition-all"
                >
                  <div className="font-display text-4xl font-black text-lta-cyan/30">{s.n}</div>
                  <div className="font-display font-black text-foreground text-xl mt-2">{s.t}</div>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{s.d}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Age groups */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs font-bold uppercase tracking-widest text-lta-cyan">2026 Calendar</span>
              <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mt-3">
                Six <span className="text-gradient-blue">Age Groups</span>
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {ageGroups.map((g, i) => (
                <motion.div
                  key={g.age}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -6 }}
                  className={`rounded-2xl bg-gradient-to-br ${g.color} p-6 text-center text-white shadow-lg`}
                >
                  <div className="font-display text-3xl font-black">{g.age}</div>
                  <div className="text-xs font-semibold uppercase tracking-widest mt-1 opacity-90">{g.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Reasons */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-display text-4xl md:text-5xl font-black text-foreground text-center mb-14">
              Reasons To <span className="text-gradient-blue">Get Involved</span>
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {reasons.map((r, i) => (
                <motion.div
                  key={r.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -6 }}
                  className="group rounded-2xl border border-border bg-card p-6 transition-all hover:border-lta-cyan/60 hover:shadow-[0_12px_30px_-12px_hsl(var(--lta-cyan)/0.45)]"
                >
                  <div className="w-11 h-11 rounded-xl bg-lta-cyan/10 text-lta-cyan flex items-center justify-center mb-4 transition-all group-hover:bg-lta-cyan group-hover:text-suffolk-navy group-hover:scale-110">
                    <r.icon size={20} />
                  </div>
                  <div className="font-display font-bold text-foreground mb-1">{r.title}</div>
                  <p className="text-sm text-muted-foreground">{r.text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TGP Teams */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto rounded-3xl bg-suffolk-navy text-primary-foreground p-8 md:p-12">
            <div className="flex items-center gap-2 text-lta-yellow font-bold text-xs uppercase tracking-widest">
              <Users size={14} /> TGP Teams
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-black mt-3">Compete With Friends</h2>
            <p className="text-primary-foreground/80 mt-4 leading-relaxed">
              TGP Teams offers a Davis Cup/United Cup style team format — 3 players per team playing both singles and doubles rubbers. Teams can be Girls, Boys or Mixed, across four age categories: 10U (Green Ball), 13U, 16U and 18U. Events are hosted at Framlingham College across Easter, a Wimbledon-themed weekend, and late summer.
            </p>
            <p className="text-lta-cyan font-bold mt-4">Ask your coach about entering a team.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-6 text-center">
          <ShieldCheck size={40} className="text-lta-cyan mx-auto mb-4" />
          <h2 className="font-display text-3xl md:text-4xl font-black text-foreground">
            Ready to enter?
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Head to the official Tennis Grand Prix website for the full 2026 calendar, entry details and event bookings.
          </p>
          <a
            href="https://www.tennisgp.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-suffolk-navy text-primary-foreground font-display font-bold hover:bg-suffolk-navy/90 transition-all"
          >
            Enter at tennisgp.uk <ArrowRight size={16} />
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default TennisGP;
