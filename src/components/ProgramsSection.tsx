import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

import punchyMascot from "@/assets/punchy-mascot.png.asset.json";

import redTourBadgeAsset from "@/assets/punchy-red-ball-v2.png.asset.json";
import orangeTourBadgeAsset from "@/assets/punchy-orange-ball-v2.png.asset.json";
const orangeTourBadge = orangeTourBadgeAsset.url;
import greenTourBadgeAsset from "@/assets/punchy-green-ball.png.asset.json";
const greenTourBadge = greenTourBadgeAsset.url;
import yellowTourBadgeAsset from "@/assets/suffolk-yellow-ball-badge.png.asset.json";
const yellowTourBadge = yellowTourBadgeAsset.url;

const redTourBadge = redTourBadgeAsset.url;

const tours = [
  {
    badge: redTourBadge,
    title: "Red Ball",
    ages: "8 & Under",
    color: "border-red-500",
    bgColor: "bg-red-50",
    path: "/programs/red-tour",
    desc: "The perfect starting point! Using red foam balls on a smaller court, young players develop coordination, basic stroke technique, and a love for the game in a fun, supportive environment.",
    features: ["Foam balls on mini courts", "Rally & match-play games", "Focus on fun & movement"],
  },
  {
    badge: orangeTourBadge,
    title: "Orange Ball",
    ages: "9 & Under",
    color: "border-orange-500",
    bgColor: "bg-orange-50",
    path: "/programs/orange-tour",
    desc: "Players progress to orange balls on a ¾-size court. Sessions build on rally consistency, introduce tactical play, and prepare players for competitive match formats.",
    features: ["Orange balls on ¾ court", "Tactical awareness", "Competition introduction"],
  },
  {
    badge: greenTourBadge,
    title: "Green Ball",
    ages: "10 & Under",
    color: "border-green-600",
    bgColor: "bg-green-50",
    path: "/programs/green-tour",
    desc: "The bridge to full-court tennis. Green balls transition players to standard play with emphasis on shot selection, serving technique, and competitive match experience.",
    features: ["Green balls on full court", "Advanced shot development", "Match-play & rankings"],
  },
  {
    badge: yellowTourBadge,
    title: "Yellow Ball",
    ages: "11 – 18",
    color: "border-yellow-400",
    bgColor: "bg-yellow-50",
    path: "/programs/yellow-tour",
    desc: "Full-court tennis with the standard yellow ball. Players develop performance-level skills, competitive match play, county and national pathway opportunities through to 18U.",
    features: ["Yellow balls on full court", "Performance & competition", "County & national pathway"],
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.5 },
  }),
};

const ProgramsSection = () => {
  return (
  <section id="programs" className="py-24 bg-suffolk-cream">
    <div className="container mx-auto px-6">
      {/* Programs Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center max-w-3xl mx-auto mb-12"
      >
        <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-r from-lta-cyan via-primary to-suffolk-navy bg-clip-text text-transparent inline-flex items-center gap-3">
          <Sparkles className="text-lta-cyan" size={36} /> Junior Tennis Pathway
        </h2>
        
        <p className="text-muted-foreground font-body mt-4 text-lg">
          Structured age-group pathways designed to make tennis fun, welcoming and rewarding for every young player in Suffolk.
        </p>
        <Link
          to="/programs"
          className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-full bg-suffolk-navy text-white font-display font-bold shadow-[var(--shadow-card)] hover:bg-primary hover:shadow-[var(--shadow-elevated)] transition-all group"
        >
          Learn More
          <span className="inline-block transition-transform group-hover:translate-x-1.5">→</span>
        </Link>
      </motion.div>

      {/* Four Tour Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {tours.map((tour, i) => (
          <Link to={tour.path} key={tour.title} className="block group [perspective:1200px]">
            <motion.div
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={cardVariants}
              whileHover={{ y: -10, rotateX: 4, rotateY: -4, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className={`relative rounded-3xl bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] overflow-hidden border-t-4 ${tour.color} h-full [transform-style:preserve-3d]`}
            >
              <div className={`relative flex justify-center p-8 md:p-10 ${tour.bgColor} overflow-hidden`}>
                {/* Shimmer sweep on hover */}
                <div className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                {/* Floating accent dots */}
                <motion.span
                  aria-hidden
                  className="absolute top-4 right-4 w-3 h-3 rounded-full bg-suffolk-yellow/70 opacity-0 group-hover:opacity-100"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.span
                  aria-hidden
                  className="absolute bottom-6 left-6 w-2 h-2 rounded-full bg-suffolk-yellow/60 opacity-0 group-hover:opacity-100"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                />
                <motion.img
                  src={tour.badge}
                  alt={`Suffolk Tennis ${tour.title} Badge`}
                  className="relative w-56 h-56 md:w-64 md:h-64 object-contain drop-shadow-xl"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
                  whileHover={{ rotate: [0, -6, 6, -4, 4, 0], scale: 1.08, transition: { duration: 0.6 } }}
                />
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-xl font-bold text-foreground">{tour.title}</h3>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full transition-transform group-hover:scale-110">
                    {tour.ages}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground font-body mb-4">{tour.desc}</p>
                <ul className="space-y-2">
                  {tour.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm font-body text-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-primary font-bold mt-4 inline-flex items-center gap-1">
                  Learn more
                  <span className="inline-block transition-transform group-hover:translate-x-1.5">→</span>
                </p>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Meet Punchy Header */}
      <div className="max-w-6xl mx-auto mt-24">
        <div className="grid lg:grid-cols-[1fr_0.85fr] gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-5xl md:text-6xl font-black text-foreground leading-tight">
              MEET <span className="text-gradient-blue">PUNCHY!</span>
            </h2>
            <p className="text-primary font-display text-xl md:text-2xl font-bold mt-3 uppercase tracking-wide">
              The Suffolk Tennis 10U Mascot
            </p>
            <p className="text-muted-foreground font-body text-lg mt-5 leading-relaxed">
              Punchy is here to inspire the next generation of Suffolk tennis players.
            </p>
            <p className="text-muted-foreground font-body mt-4 leading-relaxed">
              His mission is to help young players:
            </p>

            <ul className="grid sm:grid-cols-2 gap-3 mt-6">
              {[
                { emoji: "🎾", label: "Love the game" },
                { emoji: "💪", label: "Grow in confidence" },
                { emoji: "🌟", label: "Develop great habits" },
                { emoji: "🤝", label: "Make new friends" },
                { emoji: "🏅", label: "Dream big" },
              ].map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-3 rounded-2xl bg-card border border-border px-4 py-3 shadow-[var(--shadow-card)]"
                >
                  <span className="text-xl">{item.emoji}</span>
                  <span className="text-foreground font-body text-sm font-medium">{item.label}</span>
                </li>
              ))}
            </ul>

            <p className="text-muted-foreground font-body mt-6 leading-relaxed">
              Whether you’re picking up a racket for the very first time or competing for Suffolk, Punchy will be there to encourage, support and celebrate every step of your tennis journey.
            </p>

            <div className="mt-8 rounded-2xl bg-primary/5 border border-primary/10 p-6">
              <p className="text-primary font-display text-sm font-bold uppercase tracking-widest">Punchy’s Motto</p>
              <p className="font-display text-2xl md:text-3xl font-black text-foreground mt-2">
                “Play Hard. Smile Big. Never Stop Learning!”
              </p>
              <p className="text-muted-foreground font-body mt-3 text-sm">
                Every Suffolk champion was once a beginner.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: -4 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 2 }}
            viewport={{ once: true }}
            className="flex justify-center lg:justify-end"
          >
            <motion.div
              whileHover={{ y: -12, rotate: -2, scale: 1.04 }}
              whileTap={{ y: -8, rotate: -1, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 220, damping: 16 }}
              className="relative w-72 md:w-80 lg:w-96 cursor-pointer"
            >
              {/* Tape strip */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-28 h-8 bg-white/80 rounded-sm backdrop-blur-sm shadow-sm z-10 rotate-1" />
              {/* Sticky note */}
              <div className="relative rounded-sm bg-amber-100 p-4 pb-6 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
                <motion.div
                  animate={{ y: [0, -6, 0], rotate: [0, 1, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <img
                    src={punchyMascot.url}
                    alt="Punchy, the Suffolk Tennis 10U mascot"
                    className="w-full h-auto object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.2)]"
                  />
                </motion.div>
              </div>
              {/* Soft glow */}
              <div className="absolute -inset-6 bg-primary/10 blur-3xl -z-10 rounded-full" />
            </motion.div>
          </motion.div>
        </div>
      </div>

    </div>
  </section>
  );
};

export default ProgramsSection;