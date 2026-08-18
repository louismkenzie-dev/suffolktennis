import { motion } from "framer-motion";
import { TrendingUp, Target, Users, ArrowRight, ExternalLink } from "lucide-react";
import suffolkTennisLogo from "@/assets/suffolk-tennis-official-logo.png.asset.json";


const milestones = [
  { icon: Users, label: "Identify", color: "text-lta-cyan", bg: "bg-lta-cyan/10", ring: "ring-lta-cyan/30" },
  { icon: TrendingUp, label: "Develop", color: "text-suffolk-blue", bg: "bg-suffolk-blue/10", ring: "ring-suffolk-blue/30" },
  { icon: Target, label: "Inspire", color: "text-suffolk-navy", bg: "bg-suffolk-navy/10", ring: "ring-suffolk-navy/30" },
];

const PathwayIntroSection = () => {
  return (
    <section className="relative py-24 bg-background overflow-hidden">
      {/* Subtle pathway line decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute left-1/2 -translate-x-1/2 top-0 h-full w-[2px] opacity-10" viewBox="0 0 2 100" preserveAspectRatio="none">
          <line x1="1" y1="0" x2="1" y2="100" stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="4 4" />
        </svg>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
        >
          <span className="inline-block text-sm font-bold uppercase tracking-[0.2em] text-primary mb-4">
            Welcome to the Suffolk Tennis Partnership
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mb-6 leading-tight">
            Suffolk Tennis{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-lta-cyan via-suffolk-blue to-suffolk-navy">
              Partnership
            </span>
          </h2>
          <p className="text-muted-foreground font-body text-lg leading-relaxed mb-4">
            We bring together <span className="text-foreground font-semibold">Ipswich Sports Club</span>, <span className="text-foreground font-semibold">Culford School</span>, <span className="text-foreground font-semibold">David Lloyd Ipswich</span> and a growing network of county feeder clubs — united by one vision: to identify, develop and inspire Suffolk's best players.
          </p>
          <p className="text-muted-foreground font-body text-lg leading-relaxed mb-6">
            In official partnership with <span className="text-foreground font-semibold">Suffolk Tennis</span>, we proudly deliver the county performance programme on their behalf — offering a clear pathway from first steps through to county, regional and national competition.
          </p>

          {/* Suffolk Tennis affiliation card */}
          <motion.a
            href="https://clubspark.lta.org.uk/Suffolk-LTA/"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-4 shadow-[var(--shadow-elevated)] hover:border-primary/50 transition-all mb-8"
            whileHover={{ y: -2 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 bg-white flex items-center justify-center">
              <img src={suffolkTennisLogo.url} alt="Suffolk Tennis" className="w-full h-full object-contain" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">Official Partner</p>
              <p className="font-display font-bold text-foreground text-base flex items-center gap-1.5">
                Suffolk Tennis
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </p>
              <p className="text-xs text-muted-foreground font-body">Visit the official Suffolk Tennis website</p>
            </div>
          </motion.a>

          <p className="text-primary font-display text-lg font-bold tracking-wide">
            Developing Suffolk's best. Inspiring the next.
          </p>

        </motion.div>

        {/* Animated pathway visualisation */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-0 max-w-3xl mx-auto">
          {milestones.map((m, i) => (
            <div key={m.label} className="flex items-center">
              <motion.div
                className="flex flex-col items-center gap-3"
                initial={{ opacity: 0, scale: 0.7 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.2 }}
              >
                <motion.div
                  className={`w-20 h-20 md:w-24 md:h-24 rounded-full ${m.bg} ring-2 ${m.ring} flex items-center justify-center`}
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <m.icon className={`w-8 h-8 md:w-10 md:h-10 ${m.color}`} />
                </motion.div>
                <span className={`text-sm font-bold font-display ${m.color}`}>{m.label}</span>
              </motion.div>

              {/* Connector arrow between milestones */}
              {i < milestones.length - 1 && (
                <motion.div
                  className="hidden md:flex items-center mx-6"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.2 + 0.3 }}
                >
                  <div className="w-16 h-[2px] bg-gradient-to-r from-muted-foreground/30 to-muted-foreground/10" />
                  <ArrowRight className="w-5 h-5 text-muted-foreground/40 -ml-1" />
                </motion.div>
              )}
            </div>
          ))}
        </div>

        {/* Animated stepping-stones bar */}
        <motion.div
          className="mt-14 max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <div className="relative h-3 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-lta-cyan via-suffolk-blue to-suffolk-navy"
              initial={{ width: "0%" }}
              whileInView={{ width: "100%" }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, delay: 0.8, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs font-semibold text-muted-foreground">
            <span>8U</span>
            <span>9U</span>
            <span>10U</span>
            <span>11U</span>
            <span>12U</span>
            <span>14U</span>
            <span>16U</span>
            <span>18U</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PathwayIntroSection;
