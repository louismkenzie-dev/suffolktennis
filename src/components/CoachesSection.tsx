import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Award, X, Quote, Clock, Target, GraduationCap, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ollieImg from "@/assets/coach-ollie.png";
import dannyImg from "@/assets/coach-danny.png";
import chrisImg from "@/assets/coach-chris.png";
import jamesImg from "@/assets/coach-james.jpeg";

type CoachCard = {
  name: string;
  role: string;
  experience: string;
  qualification: string;
  specialty: string;
  photo: string;
  quote: string;
  bio: string;
  achievements: string[];
  philosophy: string;
};

const defaultCoaches: CoachCard[] = [
  {
    name: "James Yates",
    role: "Strategic Lead",
    experience: "25 years",
    qualification: "LTA Level 5",
    specialty: "Performance Strategy & Coach Development",
    photo: jamesImg,
    quote: "\"Excellence in coaching comes from constantly raising standards — for ourselves and for every player we work with.\"",
    bio: "James is an LTA Level 5 Performance Coach — the highest coaching qualification available — bringing elite-level strategic oversight to Suffolk Tennis. As Strategic Lead & Quality Assurance, he ensures coaching standards across the programme remain at the highest level, driving continuous improvement in player development and coach education.",
    achievements: [
      "LTA Level 5 — highest coaching qualification",
      "Strategic Lead for Suffolk Tennis programme",
      "Quality Assurance across all coaching venues",
      "Specialist in performance coaching and coach development",
    ],
    philosophy: "James believes that a world-class player development programme starts with world-class coaching standards. His focus on quality assurance ensures every session, every coach, and every pathway delivers excellence.",
  },
  {
    name: "Ollie Sutton",
    role: "10U Performance Lead",
    experience: "25 years",
    qualification: "LTA Level 4",
    specialty: "10U Pathway Lead & Programme Administration",
    photo: ollieImg,
    quote: "\"Every child who picks up a racket has the potential to fall in love with tennis. My job is to light that spark and keep it burning.\"",
    bio: "Ollie has been at the heart of Suffolk tennis for over two decades. Starting as a junior player himself in the county, he transitioned into coaching with a deep passion for developing players of all ages and abilities. Over his 25 year career, Ollie has coached hundreds of juniors through the pathway — many going on to represent Suffolk at county level and beyond.",
    achievements: [
      "25 years developing tennis talent across Suffolk",
      "Coached multiple county-level junior players",
      "Instrumental in building the 10&U pathway programme",
      "Known for inclusive, confidence-building coaching style",
    ],
    philosophy: "Ollie believes that tennis should be accessible and enjoyable for everyone. His coaching philosophy centres on building confidence through encouragement, developing solid fundamentals, and ensuring every session ends with a smile.",
  },
  {
    name: "Danny Wyatt",
    role: "RPDC Lead",
    experience: "15 years",
    qualification: "LTA Level 4",
    specialty: "10U Pathway & Performance Coaching",
    photo: dannyImg,
    quote: "\"The 10&Under pathway is where champions are made — it's about building the right habits, mindset, and love for competition from the very start.\"",
    bio: "Danny is an LTA Level 4 Performance Coach who leads the 10&Under pathway programme and serves as Assistant Head Coach at Culford RPDC. His expertise in early-stage player development ensures young athletes build strong technical foundations while maintaining a passion for the game.",
    achievements: [
      "LTA Level 4 Performance Coach qualification",
      "10U Pathway Lead for Suffolk Tennis",
      "Assistant Head Coach at Culford RPDC",
      "Specialist in early-stage competitive development",
    ],
    philosophy: "Danny believes in creating a challenging yet supportive environment where young players can develop their skills, compete with confidence, and build the habits that will carry them through their tennis journey.",
  },
  {
    name: "Chris Daynes",
    role: "11 - 18 yrs Lead",
    experience: "20 years",
    qualification: "LTA Level 4",
    specialty: "11-18 Pathway & Programme Administration",
    photo: chrisImg,
    quote: "\"Tennis isn't just a sport — it's a community. Whether you're 8 or 80, there's a place for you on court.\"",
    bio: "Chris leads the 11-18 age group pathway, bringing 20 years of coaching experience and a gift for connecting with teenage players. His structured approach to development helps players navigate the crucial transition years, building both their game and their character.",
    achievements: [
      "20 years of dedicated coaching experience",
      "11-18 Pathway Lead for Suffolk Tennis",
      "Programme Administrator ensuring smooth operations",
      "Specialist in adolescent player development",
    ],
    philosophy: "Chris believes that the teenage years are critical for long-term player retention. His sessions balance competitive intensity with enjoyment, ensuring players stay motivated through the challenging transition from junior to senior tennis.",
  },
];

const CoachesSection = () => {
  const [selected, setSelected] = useState<number | null>(null);
  const [coaches, setCoaches] = useState<CoachCard[]>(defaultCoaches);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("coaches")
        .select("name, role, experience, qualification, specialty, photo_url, quote, bio, philosophy, achievements")
        .eq("published", true)
        .order("display_order")
        .order("name");
      if (data && data.length > 0) {
        setCoaches(data.map(c => ({
          name: c.name,
          role: c.role ?? "",
          experience: c.experience ?? "",
          qualification: c.qualification ?? "",
          specialty: c.specialty ?? "",
          photo: c.photo_url ?? "",
          quote: c.quote ?? "",
          bio: c.bio ?? "",
          philosophy: c.philosophy ?? "",
          achievements: Array.isArray(c.achievements) ? (c.achievements as string[]) : [],
        })));
      }
    })();
  }, []);

  return (
    <section id="coaches" className="py-24 bg-suffolk-cream">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-primary/10 px-4 py-1.5 rounded-full mb-4"
          >
            <Users size={14} className="text-primary" />
            <span className="text-sm font-semibold text-primary uppercase tracking-widest">Meet The Team</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-4xl md:text-5xl font-black text-foreground mb-4"
          >
            Expert <span className="text-gradient-blue">Coaches</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-lg font-body"
          >
            Our LTA-certified coaching team brings decades of experience, passion for the game, 
            and a track record of developing county and national-level players.
          </motion.p>
        </div>

        {/* Coach Cards Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {coaches.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setSelected(i)}
              className="group cursor-pointer rounded-3xl bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all hover:-translate-y-1 overflow-hidden border border-transparent hover:border-primary/20 flex flex-row h-80"
            >
              {/* Left: Full-height Photo */}
              <div className="relative w-2/5 shrink-0 overflow-hidden">
                <img
                  src={c.photo}
                  alt={c.name}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[hsl(var(--suffolk-navy))]/10" />
                <div className="absolute top-4 left-4">
                  <span className="flex items-center gap-1 text-xs font-bold text-white bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
                    <Star size={11} /> {c.qualification}
                  </span>
                </div>
              </div>

              {/* Right: Text Content */}
              <div className="flex flex-col justify-center p-6 flex-1 min-w-0">
                <h3 className="font-display text-xl font-black text-foreground">{c.name}</h3>
                <p className="text-[hsl(var(--lta-cyan))] font-semibold text-sm mb-3">{c.role}</p>
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Clock size={12} className="text-primary" /> {c.experience}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Target size={12} className="text-primary" /> {c.specialty}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground font-body italic leading-relaxed line-clamp-3 mb-3">
                  {c.quote}
                </p>
                <p className="text-sm text-muted-foreground font-body line-clamp-2">{c.philosophy.slice(0, 120)}...</p>
                <span className="text-xs text-primary font-bold mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  Full profile →
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* LTA Accredited Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-3 bg-card rounded-2xl px-8 py-4 shadow-[var(--shadow-card)]">
            <Award size={24} className="text-primary" />
            <div className="text-left">
              <p className="font-display font-bold text-foreground text-sm">LTA Accredited Programme</p>
              <p className="text-xs text-muted-foreground">All coaches hold LTA Level 4+ qualifications</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Full Profile Modal */}
      <AnimatePresence>
        {selected !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              {(() => {
                const c = coaches[selected];
                return (
                  <>
                    <div className="relative bg-gradient-to-br from-suffolk-navy to-primary p-8 rounded-t-3xl">
                      <button
                        onClick={() => setSelected(null)}
                        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
                      >
                        <X size={24} />
                      </button>
                      <div className="flex items-center gap-6">
                        <img src={c.photo} alt={c.name} className="w-24 h-24 rounded-2xl object-cover border-2 border-white/20" />
                        <div>
                          <h3 className="font-display text-2xl font-black text-white">{c.name}</h3>
                          <p className="text-white/80 font-semibold">{c.role}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="flex items-center gap-1 text-xs font-semibold text-white bg-white/20 px-3 py-1 rounded-full">
                              <Star size={12} /> {c.qualification}
                            </span>
                            <span className="flex items-center gap-1 text-xs font-semibold text-white bg-white/20 px-3 py-1 rounded-full">
                              <Clock size={12} /> {c.experience}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 space-y-8">
                      <div className="relative bg-accent/50 rounded-2xl p-6">
                        <Quote size={32} className="text-primary/20 absolute top-4 left-4" />
                        <p className="font-body text-foreground italic pl-8 text-lg leading-relaxed">{c.quote}</p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <GraduationCap size={18} className="text-primary" />
                          <h4 className="font-display font-bold text-foreground">Background</h4>
                        </div>
                        <p className="font-body text-muted-foreground leading-relaxed">{c.bio}</p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Award size={18} className="text-primary" />
                          <h4 className="font-display font-bold text-foreground">Key Achievements</h4>
                        </div>
                        <ul className="space-y-2">
                          {c.achievements.map((a) => (
                            <li key={a} className="flex items-start gap-3 font-body text-muted-foreground">
                              <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Target size={18} className="text-primary" />
                          <h4 className="font-display font-bold text-foreground">Coaching Philosophy</h4>
                        </div>
                        <p className="font-body text-muted-foreground leading-relaxed">{c.philosophy}</p>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default CoachesSection;
