import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Heart, Users, Trophy, Target, Smile, Clock, MapPin } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GrandSlamSlider from "@/components/GrandSlamSlider";
import redBadgeAsset from "@/assets/punchy-red-ball-v2.png";
import orangeBadgeAsset from "@/assets/punchy-orange-ball-v2.png";
import greenBadgeAsset from "@/assets/punchy-green-ball.png";
import yellowBadgeAsset from "@/assets/suffolk-yellow-ball-badge.png";
const orangeBadge = orangeBadgeAsset;
const greenBadge = greenBadgeAsset;
const yellowBadge = yellowBadgeAsset;
import redCharacter from "@/assets/punchy-red-character.png";

const redBadge = redBadgeAsset;

const TourRed = () => {
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return (
  <>
    <Navbar />
    <main className="pt-20">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-red-600 via-red-500 to-red-700 py-20 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-white/20" />
          <div className="absolute bottom-10 right-10 w-60 h-60 rounded-full bg-white/10" />
        </div>
        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <button onClick={() => navigate('/programs')} className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm font-body mb-6 transition-colors">
              <ArrowLeft size={16} /> Back to Programs
            </button>
            <div className="flex flex-col md:flex-row items-center gap-10">
              <img src={redBadge} alt="Suffolk Tennis Red Ball Badge" className="w-48 h-48 md:w-64 md:h-64 object-contain drop-shadow-2xl" />
              <div>
                <span className="text-white/80 text-sm font-bold uppercase tracking-widest">Suffolk Tennis 10 & Under Pathway</span>
                <h1 className="font-display text-5xl md:text-6xl font-black text-white mt-2 mb-4">Red Ball</h1>
                <p className="text-white/90 text-xl font-body max-w-xl">The perfect starting point for young players aged <strong>8 & Under</strong>. Where every tennis journey begins!</p>
                <div className="flex flex-wrap gap-3 mt-6">
                  <span className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm font-semibold">
                    <Star size={14} /> Ages 8 & Under
                  </span>
                  <span className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm font-semibold">
                    <Target size={14} /> Mini Red Courts
                  </span>
                  <span className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm font-semibold">
                    <Heart size={14} /> Fun First
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What is the Red Ball */}
      <section className="py-20 bg-suffolk-cream">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <h2 className="font-display text-3xl md:text-4xl font-black text-foreground mb-6">
                What is the <span className="text-red-500">Red Ball?</span>
              </h2>
              <p className="text-muted-foreground font-body text-lg leading-relaxed mb-6">
                The Red Ball is the first stage of our 10 & Under pathway. Using <strong>red foam balls</strong> on smaller mini courts, 
                it's designed to help young children develop basic tennis skills in a fun, supportive, and age-appropriate environment.
              </p>
              <p className="text-muted-foreground font-body leading-relaxed mb-6">
                Players are introduced to tennis through games-based activities that build coordination, movement, and a natural love for 
                hitting the ball. There's no pressure — just fun, friends, and the first steps of a lifelong tennis journey.
              </p>
              <p className="text-muted-foreground font-body leading-relaxed">
                Led by our LTA Level 4+ certified coaches, every session is carefully structured to ensure children feel confident, 
                challenged, and excited to come back for more.
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <img src={redCharacter} alt="Punchy Red Ball character" className="w-full rounded-3xl shadow-[var(--shadow-elevated)]" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="font-display text-3xl md:text-4xl font-black text-foreground text-center mb-12">
            What Your Child Will <span className="text-red-500">Experience</span>
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Smile, title: "Fun-First Approach", desc: "Every session is built around games and play. Children learn tennis without realising it — building skills through enjoyment and natural exploration." },
              { icon: Target, title: "Foam Balls & Mini Courts", desc: "Red foam balls are softer, slower, and bounce lower — perfect for small hands and developing technique. Mini courts mean more rallies, more touches, more fun." },
              { icon: Users, title: "Social Skills & Teamwork", desc: "Children play with friends, learn to take turns, celebrate each other's successes, and develop the social skills that team-based sport provides." },
              { icon: Trophy, title: "First Competitions", desc: "Fun, low-pressure mini tournaments introduce the concept of scoring and competition. Every child gets to experience the thrill of match play." },
              { icon: Heart, title: "Confidence Building", desc: "Our coaches specialise in positive reinforcement. Every child leaves the court feeling proud of what they've achieved, building confidence for life." },
              { icon: Clock, title: "Age-Appropriate Sessions", desc: "Sessions are structured for short attention spans — high energy, varied activities, and just the right length to keep children engaged and wanting more." },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative rounded-2xl bg-card p-8 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] border-t-4 border-red-500 cursor-pointer overflow-hidden"
              >
                {/* Animated red glow on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-red-200/0 via-red-100/0 to-red-300/0 group-hover:from-red-200/40 group-hover:via-red-100/20 group-hover:to-red-300/30 transition-all duration-500 pointer-events-none" />
                {/* Animated sweep line */}
                <div className="absolute -top-px left-0 h-[3px] w-0 bg-gradient-to-r from-red-400 to-red-600 group-hover:w-full transition-all duration-700 ease-out" />
                <motion.div
                  whileHover={{ rotate: [0, -10, 10, -6, 0], scale: 1.1 }}
                  transition={{ duration: 0.6 }}
                  className="relative w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mb-4 transition-colors"
                >
                  <item.icon size={24} className="text-red-500 group-hover:text-red-600 transition-colors" />
                </motion.div>
                <h3 className="relative font-display text-lg font-bold text-foreground group-hover:text-red-600 mb-2 transition-colors">{item.title}</h3>
                <p className="relative text-sm text-muted-foreground font-body leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Where to Play */}
      <section className="py-20 bg-suffolk-cream">
        <div className="container mx-auto px-6 text-center">
          <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="font-display text-3xl md:text-4xl font-black text-foreground mb-4">
            Where to <span className="text-red-500">Play</span>
          </motion.h2>
          <p className="text-muted-foreground font-body text-lg mb-10 max-w-2xl mx-auto">
            Red Ball sessions run at our partner venues across Suffolk. Find a venue near you and start your child's tennis journey.
          </p>
          <h3 className="font-display text-lg font-bold text-foreground mb-4">Main Venues</h3>
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {[
              { name: "David Lloyd Ipswich", path: "/venues/david-lloyd" },
              { name: "Ipswich Sports Club", path: "/venues/ipswich-sports-club" },
              { name: "Culford Sports & Tennis Centre", path: "/venues/culford" },
            ].map((v) => (
              <Link
                key={v.name}
                to={v.path}
                className="inline-flex items-center gap-2 bg-card px-6 py-3 rounded-xl shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all hover:-translate-y-1 font-display font-bold text-foreground hover:text-red-500"
              >
                <MapPin size={16} /> {v.name}
              </Link>
            ))}
          </div>
          <h3 className="font-display text-lg font-bold text-foreground mb-4">Feeder Clubs</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { name: "East Bergholt TC", path: "/clubs/east-bergholt" },
              { name: "Newmarket TC", path: "/clubs/newmarket" },
              { name: "Stowmarket TC", path: "/clubs/stowmarket" },
              { name: "Felixstowe LTC", path: "/clubs/felixstowe" },
              { name: "Woodbridge TC", path: "/clubs/woodbridge" },
              { name: "Framlingham College", path: "/clubs/framlingham" },
            ].map((c) => (
              <Link
                key={c.name}
                to={c.path}
                className="inline-flex items-center gap-2 bg-card/70 px-5 py-2.5 rounded-xl shadow-sm hover:shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 font-body text-sm font-semibold text-muted-foreground hover:text-red-500"
              >
                <MapPin size={14} /> {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <GrandSlamSlider />

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-red-600 to-red-500">
        <div className="container mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-black text-white mb-4">Ready to Start?</h2>
          <p className="text-white/90 font-body text-lg mb-8 max-w-xl mx-auto">
            Sign up to the Suffolk Tennis Parent Hub to track your child's progress, access coaching reports, and stay connected with their tennis journey!
          </p>
          <Link to="/auth" className="inline-flex items-center gap-2 bg-white text-red-600 px-8 py-3 rounded-xl font-display font-bold hover:bg-red-50 transition-colors">
            Sign Up to Parent Hub
          </Link>
        </div>
      </section>

      {/* Explore Other Programs */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-black text-foreground mb-4">Explore the Full Pathway</h2>
          <p className="text-muted-foreground font-body text-lg mb-10 max-w-2xl mx-auto">
            As your child grows, they can progress through the Suffolk Tennis pathway — from Red, Orange and Green at 10 & Under, all the way to Yellow Ball performance tennis.
          </p>
          <div className="flex flex-wrap justify-center gap-8">
            <Link to="/programs/orange-tour" className="group flex flex-col items-center gap-4 p-6 rounded-2xl bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all hover:-translate-y-1 max-w-xs">
              <img src={orangeBadge} alt="Orange Ball" className="w-32 h-32 object-contain" />
              <h3 className="font-display text-xl font-bold text-foreground group-hover:text-orange-500 transition-colors">Orange Ball</h3>
              <p className="text-sm text-muted-foreground font-body">Ages 8-9 · The next step in the pathway</p>
            </Link>
            <Link to="/programs/green-tour" className="group flex flex-col items-center gap-4 p-6 rounded-2xl bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all hover:-translate-y-1 max-w-xs">
              <img src={greenBadge} alt="Green Ball" className="w-32 h-32 object-contain" />
              <h3 className="font-display text-xl font-bold text-foreground group-hover:text-green-600 transition-colors">Green Ball</h3>
              <p className="text-sm text-muted-foreground font-body">Ages 9-10 · Building competitive skills</p>
            </Link>
            <Link to="/programs/yellow-tour" className="group flex flex-col items-center gap-4 p-6 rounded-2xl bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all hover:-translate-y-1 max-w-xs">
              <img src={yellowBadge} alt="Yellow Ball" className="w-[7rem] h-[7rem] object-contain" />
              <h3 className="font-display text-xl font-bold text-foreground group-hover:text-yellow-600 transition-colors">Yellow Ball</h3>
              <p className="text-sm text-muted-foreground font-body">Ages 11-18 · Performance pathway</p>
            </Link>
          </div>
        </div>
      </section>
    </main>
    <Footer />
  </>
  );
};

export default TourRed;
