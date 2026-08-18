import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Trophy, Target, TrendingUp, BarChart3, MapPin, Award, Flame, Swords, Users, Quote } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

import yellowBadgeAsset from "@/assets/suffolk-yellow-ball-badge.png.asset.json";
const yellowBadge = yellowBadgeAsset.url;
import chrisImg from "@/assets/coach-chris.png.asset.json";
import redBadgeAsset from "@/assets/punchy-red-ball-v2.png.asset.json";
const redBadge = redBadgeAsset.url;
import orangeBadgeAsset from "@/assets/punchy-orange-ball-v2.png.asset.json";
const orangeBadge = orangeBadgeAsset.url;
import greenBadgeAsset from "@/assets/punchy-green-ball.png.asset.json";
const greenBadge = greenBadgeAsset.url;

const TourYellow = () => {
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return (
  <>
    <Navbar />
    <main className="pt-20">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-suffolk-navy via-yellow-500 to-yellow-300 py-20 overflow-hidden">
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
              <img src={yellowBadge} alt="Suffolk Tennis Yellow Ball Badge" className="w-48 h-48 md:w-64 md:h-64 object-contain drop-shadow-2xl" />
              <div>
                <span className="text-white/80 text-sm font-bold uppercase tracking-widest">Suffolk Tennis 11 – 18 Pathway</span>
                <h1 className="font-display text-5xl md:text-6xl font-black text-white mt-2 mb-4">Yellow Ball</h1>
                <p className="text-white/90 text-xl font-body max-w-xl">The performance stage for players aged <strong>11 – 18</strong>. Full yellow balls, full court, and the bridge to adult Suffolk Tennis.</p>
                <div className="flex flex-wrap gap-3 mt-6">
                  <span className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm font-semibold">
                    <Star size={14} /> Ages 11 – 18
                  </span>
                  <span className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm font-semibold">
                    <Trophy size={14} /> County, Regional & National
                  </span>
                  <span className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm font-semibold">
                    <BarChart3 size={14} /> LTA Rankings
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What is the Yellow Ball */}
      <section className="py-20 bg-suffolk-cream">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="font-display text-3xl md:text-4xl font-black text-foreground mb-6 text-center">
                What is the <span className="text-yellow-500">Yellow Ball Pathway?</span>
              </h2>
              <p className="text-muted-foreground font-body text-lg leading-relaxed mb-6">
                The Yellow Ball Pathway is Suffolk Tennis's performance programme for players aged <strong>11 to 18</strong>.
                It is where junior players transition from mini tennis to the full adult format — standard yellow balls, full-size
                courts, and a serious focus on competition, conditioning, and long-term development.
              </p>
              <p className="text-muted-foreground font-body leading-relaxed mb-6">
                Players at this stage are training with intent. Sessions combine technical refinement, tactical work, physical
                conditioning, and mental performance to prepare athletes for LTA-rated tournaments, county selection, regional
                competition, and the demands of senior tennis.
              </p>
              <p className="text-muted-foreground font-body leading-relaxed">
                For many, the Yellow Ball years are the launchpad — from local competition to national rankings, university
                tennis, and ultimately into the adult Suffolk Tennis community as players, coaches, and ambassadors of the game.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Lead Coach */}
      <section className="py-20 bg-background border-t border-border/30">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-yellow-50 px-4 py-1.5 rounded-full mb-6 mx-auto w-fit"
          >
            <Users size={14} className="text-yellow-500" />
            <span className="text-sm font-semibold text-yellow-600 uppercase tracking-widest">Programme Lead</span>
          </motion.div>
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="shrink-0"
              >
                <div className="relative w-64 h-72 md:w-72 md:h-80 rounded-3xl overflow-hidden shadow-[var(--shadow-elevated)]">
                  <img
                    src={chrisImg.url}
                    alt="Chris Daynes"
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-suffolk-navy/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
                      <Star size={11} /> LTA Level 4
                    </span>
                  </div>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="flex-1 text-center md:text-left"
              >
                <h2 className="font-display text-3xl md:text-4xl font-black text-foreground mb-1">Chris Daynes</h2>
                <p className="text-yellow-500 font-semibold text-lg mb-4">11 – 18 Pathway Lead</p>
                <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-6">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    <Target size={14} className="text-yellow-500" /> 11–18 Pathway & Programme Administration
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    <Award size={14} className="text-yellow-500" /> 20 Years Experience
                  </span>
                </div>
                <div className="relative bg-accent/50 rounded-2xl p-6 mb-6">
                  <Quote size={32} className="text-yellow-400/20 absolute top-4 left-4" />
                  <p className="font-body text-foreground italic pl-8 leading-relaxed">
                    "Tennis isn't just a sport — it's a community. Whether you're 8 or 80, there's a place for you on court."
                  </p>
                </div>
                <p className="text-muted-foreground font-body leading-relaxed mb-4">
                  Chris leads the 11–18 age group pathway, bringing 20 years of coaching experience and a gift for connecting with teenage players. His structured approach to development helps players navigate the crucial transition years, building both their game and their character.
                </p>
                <p className="text-muted-foreground font-body leading-relaxed">
                  Chris believes that the teenage years are critical for long-term player retention. His sessions balance competitive intensity with enjoyment, ensuring players stay motivated through the challenging transition from junior to senior tennis.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="font-display text-3xl md:text-4xl font-black text-foreground text-center mb-12">
            What the <span className="text-yellow-500">Pathway Delivers</span>
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Flame, title: "Performance Coaching", desc: "Small-group and individual sessions with LTA-accredited coaches focused on technical mastery, weapon development, and high-level shot tolerance." },
              { icon: Swords, title: "Competitive Match Play", desc: "Structured match-play environments — singles, doubles, tie-breaks, and pressure scenarios that build the competitive instincts needed at county and national level." },
              { icon: Trophy, title: "LTA Tournaments", desc: "Players compete in Grade rated and national tour events, building rankings and gaining the tournament experience required to progress on the LTA pathway." },
              { icon: TrendingUp, title: "Strength & Conditioning", desc: "Age-appropriate physical development covering speed, agility, mobility, and injury prevention — building the durable athletes adult tennis demands." },
              { icon: Award, title: "County & Regional Squads", desc: "Top performers are selected for Suffolk County squads and East Region camps, training alongside the best players in the area and beyond." },
              { icon: BarChart3, title: "Individual Player Plans", desc: "Every player has a personalised development plan with measurable goals, regular reviews, and a clear roadmap into adult tennis or university scholarships." },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative rounded-2xl bg-card p-8 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] border-t-4 border-yellow-400 cursor-pointer overflow-hidden"
              >
                {/* Animated yellow glow on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-200/0 via-yellow-100/0 to-yellow-300/0 group-hover:from-yellow-200/40 group-hover:via-yellow-100/20 group-hover:to-yellow-300/30 transition-all duration-500 pointer-events-none" />
                {/* Animated sweep line */}
                <div className="absolute -top-px left-0 h-[3px] w-0 bg-gradient-to-r from-yellow-300 to-yellow-500 group-hover:w-full transition-all duration-700 ease-out" />
                <motion.div
                  whileHover={{ rotate: [0, -10, 10, -6, 0], scale: 1.1 }}
                  transition={{ duration: 0.6 }}
                  className="relative w-12 h-12 rounded-xl bg-yellow-50 group-hover:bg-yellow-50 flex items-center justify-center mb-4 transition-colors"
                >
                  <item.icon size={24} className="text-yellow-500 group-hover:text-yellow-600 transition-colors" />
                </motion.div>
                <h3 className="relative font-display text-lg font-bold text-foreground group-hover:text-yellow-600 mb-2 transition-colors">{item.title}</h3>
                <p className="relative text-sm text-muted-foreground font-body leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Progression to Adult Tennis */}
      <section className="py-20 bg-gradient-to-br from-suffolk-navy to-suffolk-navy/90">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block text-sm font-bold uppercase tracking-[0.2em] text-lta-cyan mb-4">The Next Chapter</span>
              <h2 className="font-display text-3xl md:text-4xl font-black text-white mb-6">
                Progression Into <span className="text-yellow-400">Adult Suffolk Tennis</span>
              </h2>
              <p className="text-white/80 font-body text-lg leading-relaxed mb-6">
                The Yellow Ball Pathway is not the end of a journey — it is the beginning of a lifetime in the game. As players
                move through their teenage years, the programme is designed to transition them seamlessly into the adult Suffolk
                Tennis community.
              </p>
              <p className="text-white/70 font-body leading-relaxed mb-10">
                Whether that means representing Suffolk in senior county competition, playing on a university scholarship,
                coaching the next generation of juniors, or simply enjoying tennis as a lifelong pursuit, every Yellow Ball
                player leaves with the skills, network, and confidence to stay in the game for good.
              </p>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              {[
                { title: "Senior County Tennis", desc: "Progress into Suffolk's adult county teams, competing in inter-county events year-round." },
                { title: "University & College", desc: "Strong players are supported with applications to BUCS programmes and US college tennis pathways." },
                { title: "Coaching & Officiating", desc: "Routes into LTA coaching qualifications and officiating for those who want to give back to the sport." },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -6, scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-yellow-400/50 p-6 cursor-pointer overflow-hidden transition-colors"
                >
                  {/* Glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/0 to-lta-cyan/0 group-hover:from-yellow-400/10 group-hover:to-lta-cyan/10 transition-all duration-500 pointer-events-none" />
                  {/* Sweep line */}
                  <div className="absolute -top-px left-0 h-[2px] w-0 bg-gradient-to-r from-yellow-400 to-lta-cyan group-hover:w-full transition-all duration-700 ease-out" />
                  <h3 className="relative font-display text-lg font-bold text-yellow-400 mb-2 group-hover:translate-x-1 transition-transform">{item.title}</h3>
                  <p className="relative text-sm text-white/70 group-hover:text-white/90 font-body leading-relaxed transition-colors">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Where to Play */}
      <section className="py-20 bg-suffolk-cream">
        <div className="container mx-auto px-6 text-center">
          <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="font-display text-3xl md:text-4xl font-black text-foreground mb-4">
            Where to <span className="text-yellow-500">Train</span>
          </motion.h2>
          <p className="text-muted-foreground font-body text-lg mb-10 max-w-2xl mx-auto">
            Yellow Ball performance sessions run at our lead venues across Suffolk — the heart of the county's high-performance tennis.
          </p>
          <h3 className="font-display text-lg font-bold text-foreground mb-4">Lead Venues</h3>
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {[
              { name: "David Lloyd Ipswich", path: "/venues/david-lloyd" },
              { name: "Ipswich Sports Club", path: "/venues/ipswich-sports-club" },
              { name: "Culford Sports & Tennis Centre", path: "/venues/culford" },
            ].map((v) => (
              <Link
                key={v.name}
                to={v.path}
                className="inline-flex items-center gap-2 bg-card px-6 py-3 rounded-xl shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all hover:-translate-y-1 font-display font-bold text-foreground hover:text-yellow-500"
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
              { name: "Stowmarket LTC", path: "/clubs/stowmarket" },
              { name: "Felixstowe LTC", path: "/clubs/felixstowe" },
              { name: "Woodbridge TC", path: "/clubs/woodbridge" },
              { name: "Framlingham College", path: "/clubs/framlingham" },
            ].map((c) => (
              <Link
                key={c.name}
                to={c.path}
                className="inline-flex items-center gap-2 bg-card/70 px-5 py-2.5 rounded-xl shadow-sm hover:shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 font-body text-sm font-semibold text-muted-foreground hover:text-yellow-500"
              >
                <MapPin size={14} /> {c.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-yellow-400 to-yellow-300">
        <div className="container mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-black text-suffolk-navy mb-4">Ready to Step Up?</h2>
          <p className="text-suffolk-navy/80 font-body text-lg mb-8 max-w-xl mx-auto">
            Sign up to the Suffolk Tennis Parent Hub to track progress, access coaching reports, and stay connected to the performance pathway.
          </p>
          <Link to="/auth" className="inline-flex items-center gap-2 bg-suffolk-navy text-white px-8 py-3 rounded-xl font-display font-bold hover:bg-suffolk-navy/90 transition-colors">
            Sign Up to Parent Hub
          </Link>
        </div>
      </section>

      {/* Explore Other Programs */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-black text-foreground mb-4">Explore the Full Pathway</h2>
          <p className="text-muted-foreground font-body text-lg mb-10 max-w-2xl mx-auto">
            Discover the full Suffolk Tennis pathway — from Red, Orange, and Green at 10 & Under, all the way to Yellow Ball performance tennis.
          </p>
          <div className="flex flex-wrap justify-center gap-8">
            <Link to="/programs/red-tour" className="group flex flex-col items-center gap-4 p-6 rounded-2xl bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all hover:-translate-y-1 max-w-xs">
              <img src={redBadge} alt="Red Ball" className="w-32 h-32 object-contain" />
              <h3 className="font-display text-xl font-bold text-foreground group-hover:text-red-500 transition-colors">Red Ball</h3>
              <p className="text-sm text-muted-foreground font-body">Ages 8 & Under · Where it all begins</p>
            </Link>
            <Link to="/programs/orange-tour" className="group flex flex-col items-center gap-4 p-6 rounded-2xl bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all hover:-translate-y-1 max-w-xs">
              <img src={orangeBadge} alt="Orange Ball" className="w-32 h-32 object-contain" />
              <h3 className="font-display text-xl font-bold text-foreground group-hover:text-orange-500 transition-colors">Orange Ball</h3>
              <p className="text-sm text-muted-foreground font-body">Ages 8-9 · Developing match play</p>
            </Link>
            <Link to="/programs/green-tour" className="group flex flex-col items-center gap-4 p-6 rounded-2xl bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all hover:-translate-y-1 max-w-xs">
              <img src={greenBadge} alt="Green Ball" className="w-32 h-32 object-contain" />
              <h3 className="font-display text-xl font-bold text-foreground group-hover:text-green-600 transition-colors">Green Ball</h3>
              <p className="text-sm text-muted-foreground font-body">Ages 9-10 · Building competitive skills</p>
            </Link>
          </div>
        </div>
      </section>
    </main>
    <Footer />
  </>
  );
};

export default TourYellow;
