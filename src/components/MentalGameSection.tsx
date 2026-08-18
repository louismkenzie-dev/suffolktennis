import { motion } from "framer-motion";
import { Brain, Sparkles, Shield, Target } from "lucide-react";
import presleyPsychology from "@/assets/presley-psychology.jpeg";

const pillars = [
  { icon: Brain, title: "Mental Resilience", desc: "Building confidence and composure under match-day pressure." },
  { icon: Shield, title: "Emotional Control", desc: "Learning to manage frustration, nerves, and self-doubt on court." },
  { icon: Target, title: "Focus & Concentration", desc: "Developing match awareness and point-by-point mental discipline." },
  { icon: Sparkles, title: "Growth Mindset", desc: "Turning setbacks into stepping stones through positive self-talk." },
];

const MentalGameSection = () => (
  <section id="mental-game" className="relative py-24 overflow-hidden bg-muted/30">
    <div className="container mx-auto px-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-primary text-sm font-medium tracking-wide uppercase" style={{ fontFamily: "var(--font-display)" }}>
            Suffolk Presents
          </span>
        </div>
        <h2
          className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The <span className="text-primary italic">Mental Game</span>
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Tennis is as much a mental battle as a physical one. Suffolk Tennis is investing in sport psychology to give our juniors the edge.
        </p>
      </motion.div>

      {/* Content grid */}
      <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
        {/* Photo */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="relative"
        >
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-border">
            <img
              src={presleyPsychology}
              alt="Presley Dee with Callum from Liquid Sports Psychology at a Suffolk Tennis session"
              className="w-full h-auto object-cover"
            />
          </div>
          <div className="absolute -bottom-4 left-6 right-6 bg-card border border-border rounded-xl p-4 shadow-lg">
            <p className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
              Presley Dee with Callum – Liquid Sports Psychology
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Suffolk Tennis Psychology Workshop, 2026
            </p>
          </div>
        </motion.div>

        {/* Text & pillars */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <p className="text-muted-foreground leading-relaxed">
            At Suffolk Tennis, we believe the strongest players aren't just the ones who hit the hardest — they're the ones who think the clearest. That's why we've partnered with{" "}
            <span className="font-semibold text-foreground">Liquid Sports Psychology</span> to deliver dedicated mental performance sessions for our county juniors.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            From managing nerves in tie-breaks to bouncing back after a tough loss, our players are learning skills that go far beyond the court. These sessions help young athletes build the inner confidence and resilience they need to compete at their best — and enjoy the journey.
          </p>

          <a
            href="https://www.liquidsportspsychology.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Visit Liquid Sports Psychology →
          </a>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            {pillars.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border hover:shadow-md transition-shadow"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <p.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground text-sm" style={{ fontFamily: "var(--font-display)" }}>
                    {p.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

export default MentalGameSection;
