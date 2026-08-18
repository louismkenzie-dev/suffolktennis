import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Sparkles, Trophy, School, Users, Star, CheckCircle2, ArrowRight, Award, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import RisingStarsSignupDialog, { RisingStarsEvent } from "@/components/RisingStarsSignupDialog";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import davidLloydLogo from "@/assets/david-lloyd-logo.png";
import ipswichSportsLogo from "@/assets/ipswich-sports-logo.png";
import culfordLogo from "@/assets/culford-logo.jpg";
import risingStarsBadge from "@/assets/suffolk-rising-stars-badge.png.asset.json";
import risingStarsCertificate from "@/assets/rising-stars-certificate.jpeg.asset.json";

const funDayHighlights = [
  "Playing tennis",
  "Learning new skills",
  "Making friends",
  "Building confidence",
  "Enjoying competition and teamwork",
  "Creating unforgettable experiences on court",
];

const enrolmentIncludes = [
  "Online registration",
  "Event dates and venues",
  "Age group information",
  "Session timings",
  "What to bring",
  "Coach information",
  "Follow-up opportunities for players",
];

const howPlayersAreIdentified = [
  "Club coaching programmes",
  "School tennis sessions",
  "Local competitions and festivals",
  "Coach recommendations",
  "Suffolk Rising Stars Fun Days",
];

const values = [
  "Try new things",
  "Give their best effort",
  "Learn through challenges",
  "Support others",
  "Believe in themselves",
];

const countyEvents = [
  {
    title: "Summer Rising Stars Festival",
    description:
      "Our main showcase event bringing together players from across Suffolk for a fun and inspiring tennis experience.",
  },
  {
    title: "Winter Rising Stars Event",
    description:
      "A second county-wide opportunity in December so late developers and new players can also be recognised and involved.",
  },
];

const hostVenues = [
  { name: "David Lloyd Ipswich", logo: davidLloydLogo, style: "p-3 bg-white" },
  { name: "Culford", logo: culfordLogo, style: "p-0 bg-[#1a7fbf]" },
  { name: "Ipswich Sports Club", logo: ipswichSportsLogo, style: "p-2 bg-white" },
];

type EventRow = RisingStarsEvent & {
  description: string | null;
  poster_url: string | null;
  sign_up_enabled: boolean;
  cost: string | null;
};

const RisingStars = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [signupFor, setSignupFor] = useState<RisingStarsEvent | null>(null);

  useEffect(() => {
    supabase
      .from("events")
      .select("id, title, description, event_date, location, poster_url, sign_up_enabled, cost, session_slots")
      .eq("event_type", "rising-stars")
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .then(({ data }) => setEvents((data as any) ?? []));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative pt-40 pb-20 bg-suffolk-navy overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-suffolk-navy via-suffolk-navy to-primary/40" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[620px] rounded-full bg-lta-cyan/10 blur-3xl" />
        <div className="container mx-auto px-6 relative">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-lta-cyan/15 text-lta-cyan text-xs font-bold uppercase tracking-widest">
                <Sparkles size={14} /> Suffolk Tennis
              </span>
              <h1 className="font-display text-5xl md:text-6xl font-black text-primary-foreground mt-6">
                Suffolk <span className="text-lta-yellow">Rising Stars</span>
              </h1>
              <p className="text-primary-foreground/90 font-display text-2xl md:text-3xl mt-4">
                Helping Young Players Shine
              </p>
              <p className="text-primary-foreground/80 font-body mt-5 text-lg max-w-2xl leading-relaxed">
                The Suffolk Rising Stars Programme has been created to identify and support enthusiastic young tennis players aged 6–8 from across the county.
              </p>
              <p className="text-primary-foreground/70 font-body mt-4 text-base max-w-2xl leading-relaxed">
                Working closely with clubs, coaches and local schools, Suffolk Tennis is creating more opportunities for children to enjoy the game, build confidence and take the next exciting step in their tennis journey.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center lg:justify-end"
            >
              <div className="relative">
                <div className="absolute inset-4 rounded-full bg-lta-yellow/20 blur-3xl" />
                <img
                  src={risingStarsBadge.url}
                  alt="Suffolk Rising Stars badge featuring Punchy the mascot"
                  className="relative w-72 md:w-80 lg:w-[22rem] object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {events.length > 0 && (
        <section className="py-20 bg-background">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-lta-cyan/10 text-lta-cyan text-xs font-bold uppercase tracking-widest">
                <Calendar size={14} /> Upcoming events
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mt-4">
                Sign up for the next <span className="text-gradient-blue">Rising Stars</span> event
              </h2>
              <p className="text-muted-foreground font-body mt-4 max-w-2xl mx-auto">
                Places are free — just complete the short form and we'll email your confirmation.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {events.map((ev, i) => {
                const d = new Date(ev.event_date);
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="rounded-3xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-[var(--shadow-elevated)] transition-all"
                  >
                    {ev.poster_url && (
                      <div className="aspect-[4/3] bg-suffolk-navy overflow-hidden">
                        <img src={ev.poster_url} alt={ev.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="font-display text-xl font-black text-foreground">{ev.title}</h3>
                      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-lta-cyan" />
                          {d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-lta-cyan" />
                          {d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {ev.location && (
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-lta-cyan" />
                            {ev.location}
                          </div>
                        )}
                        {ev.cost && <div className="text-lta-cyan font-bold text-xs uppercase tracking-widest">{ev.cost}</div>}
                      </div>
                      {ev.description && <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{ev.description}</p>}
                      {ev.sign_up_enabled ? (
                        <Button onClick={() => setSignupFor(ev)} className="w-full mt-5 bg-suffolk-navy text-primary-foreground hover:bg-suffolk-navy/90">
                          Sign up free <ArrowRight size={14} className="ml-1" />
                        </Button>
                      ) : (
                        <Button variant="outline" className="w-full mt-5" disabled>Sign-ups opening soon</Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <RisingStarsSignupDialog open={!!signupFor} onOpenChange={(o) => !o && setSignupFor(null)} event={signupFor} />

      <section className="py-24 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto space-y-20">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-start">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-3xl bg-card border border-border p-8 md:p-10"
              >
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-lta-yellow/15 text-amber-700 text-xs font-bold uppercase tracking-widest">
                  <Star size={14} /> Fun Days
                </span>
                <h2 className="font-display text-3xl md:text-4xl font-black text-foreground mt-5">
                  County-wide events built for enthusiastic young players
                </h2>
                <p className="text-muted-foreground font-body mt-5 leading-relaxed">
                  At the heart of the programme are the Suffolk Rising Stars Fun Days — exciting county-wide events designed to bring together young players who show great enthusiasm, athletic ability, coachability and a love for tennis.
                </p>
                <div className="grid sm:grid-cols-2 gap-3 mt-8">
                  {funDayHighlights.map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3 border border-border">
                      <CheckCircle2 size={16} className="text-lta-cyan shrink-0" />
                      <span className="text-sm font-body text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-3xl bg-suffolk-navy text-primary-foreground p-8 md:p-10"
              >
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-foreground/10 text-lta-yellow text-xs font-bold uppercase tracking-widest">
                  <Calendar size={14} /> Easy Online Enrolment
                </span>
                <p className="font-body text-primary-foreground/85 mt-5 leading-relaxed">
                  Parents will be able to quickly and easily enrol their child into upcoming Suffolk Rising Stars Fun Days directly through the Suffolk Tennis website. Our aim is to make the process simple, welcoming and accessible for families right across Suffolk.
                </p>
                <div className="space-y-3 mt-8">
                  {enrolmentIncludes.map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl bg-primary-foreground/5 px-4 py-3 border border-primary-foreground/10">
                      <ArrowRight size={15} className="text-lta-cyan shrink-0" />
                      <span className="text-sm font-body text-primary-foreground/90">{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <div className="grid lg:grid-cols-2 gap-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-3xl border border-border bg-card p-8 md:p-10"
              >
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-lta-cyan/10 text-lta-cyan text-xs font-bold uppercase tracking-widest">
                  <Trophy size={14} /> How It Works
                </span>
                <p className="text-muted-foreground font-body mt-5 leading-relaxed">
                  Throughout the year, Suffolk Tennis will work alongside local clubs and their linked schools to help identify players who are showing strong potential and a real passion for the game.
                </p>
                <div className="space-y-3 mt-8">
                  {howPlayersAreIdentified.map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 bg-background">
                      <Sparkles size={15} className="text-lta-yellow shrink-0" />
                      <span className="text-sm text-foreground font-body">{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-3xl border border-border bg-card p-8 md:p-10"
              >
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-lta-cyan/10 text-lta-cyan text-xs font-bold uppercase tracking-widest">
                  <Users size={14} /> Weekly County Coaching
                </span>
                <p className="text-muted-foreground font-body mt-5 leading-relaxed">
                  Following the fun days, selected players will be invited to join weekly county coaching sessions delivered at one of our three host venues — giving families a clear and exciting development pathway within Suffolk Tennis.
                </p>
                <div className="grid sm:grid-cols-3 gap-4 mt-8">
                  {hostVenues.map((venue) => (
                    <div key={venue.name} className="rounded-2xl border border-border p-4 text-center bg-background">
                      <div className={`mx-auto w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center ${venue.style}`}>
                        <img src={venue.logo} alt={venue.name} className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="font-display font-bold text-foreground text-sm mt-3">{venue.name}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center max-w-3xl mx-auto mb-10"
              >
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-lta-yellow/15 text-amber-700 text-xs font-bold uppercase tracking-widest">
                  <Calendar size={14} /> Two Major County Events Every Year
                </span>
                <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mt-5">
                  Two flagship <span className="text-gradient-blue">Rising Stars events</span>
                </h2>
              </motion.div>
              <div className="grid md:grid-cols-2 gap-6">
                {countyEvents.map((event, i) => (
                  <motion.div
                    key={event.title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="rounded-3xl border border-border bg-card p-8"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-lta-cyan/10 text-lta-cyan flex items-center justify-center mb-5">
                      <Calendar size={22} />
                    </div>
                    <h3 className="font-display text-2xl font-black text-foreground">{event.title}</h3>
                    <p className="text-muted-foreground font-body mt-4 leading-relaxed">{event.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Certificate Showcase */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-suffolk-navy via-suffolk-navy to-[#0a1f4a] p-8 md:p-14"
            >
              {/* Decorative glows */}
              <div className="pointer-events-none absolute -top-32 -left-20 w-96 h-96 rounded-full bg-lta-cyan/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-32 -right-20 w-[28rem] h-[28rem] rounded-full bg-lta-yellow/15 blur-3xl" />

              {/* Floating sparkles */}
              {[
                { top: "12%", left: "8%", delay: 0, size: 18 },
                { top: "22%", right: "10%", delay: 0.6, size: 14 },
                { bottom: "18%", left: "12%", delay: 1.1, size: 16 },
                { top: "55%", right: "6%", delay: 1.6, size: 20 },
                { bottom: "10%", right: "22%", delay: 0.3, size: 12 },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  className="absolute text-lta-yellow pointer-events-none"
                  style={{ top: s.top, left: s.left, right: s.right, bottom: s.bottom } as React.CSSProperties}
                  animate={{ y: [0, -12, 0], opacity: [0.4, 1, 0.4], rotate: [0, 15, 0] }}
                  transition={{ duration: 3.2, delay: s.delay, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Sparkles size={s.size} />
                </motion.div>
              ))}

              <div className="relative grid lg:grid-cols-[0.85fr_1.15fr] gap-12 items-center">
                <div>
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-lta-yellow/20 text-lta-yellow text-xs font-bold uppercase tracking-widest">
                    <Award size={14} /> Every Player Awarded
                  </span>
                  <h2 className="font-display text-4xl md:text-5xl font-black text-primary-foreground mt-5 leading-tight">
                    A keepsake <span className="text-lta-yellow">certificate</span> for every Rising Star
                  </h2>
                  <p className="text-primary-foreground/80 font-body mt-5 text-lg leading-relaxed">
                    Every child who attends a Suffolk Rising Stars Fun Morning takes home a personalised certificate — a vibrant memento celebrating their effort, courage and love of the game.
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-8">
                    {[
                      "You Tried",
                      "You Learned",
                      "You Shine",
                      "Play. Learn. Laugh. Belong.",
                    ].map((label) => (
                      <div key={label} className="rounded-2xl bg-primary-foreground/5 border border-primary-foreground/10 px-4 py-3 text-sm font-display font-bold text-primary-foreground/90 text-center">
                        {label}
                      </div>
                    ))}
                  </div>
                </div>

                <motion.div
                  className="relative"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  whileHover={{ scale: 1.03, rotate: 0 }}
                  style={{ perspective: 1200 }}
                >
                  <motion.div
                    initial={{ rotate: -3 }}
                    whileHover={{ rotate: 0, scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 120, damping: 14 }}
                    className="relative rounded-2xl overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] ring-1 ring-primary-foreground/10"
                  >
                    {/* Shimmer sweep */}
                    <motion.div
                      className="absolute inset-0 z-10 pointer-events-none"
                      style={{
                        background:
                          "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)",
                      }}
                      animate={{ x: ["-120%", "120%"] }}
                      transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}
                    />
                    <img
                      src={risingStarsCertificate.url}
                      alt="Suffolk Rising Stars Well Done certificate awarded to attendees"
                      className="block w-full h-auto"
                    />
                  </motion.div>

                  {/* Floating badge */}
                  <motion.div
                    className="absolute -top-6 -right-4 md:-top-8 md:-right-6 w-24 h-24 md:w-28 md:h-28 rounded-full bg-lta-yellow text-suffolk-navy flex flex-col items-center justify-center shadow-2xl border-4 border-suffolk-navy"
                    animate={{ rotate: [0, 8, -8, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Star size={22} className="fill-suffolk-navy" />
                    <span className="font-display font-black text-[10px] md:text-xs mt-1 leading-tight text-center">WELL<br/>DONE!</span>
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-3xl bg-suffolk-navy text-primary-foreground p-8 md:p-12"
            >
              <div className="grid lg:grid-cols-[1fr_auto] gap-10 items-center">
                <div>
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-foreground/10 text-lta-yellow text-xs font-bold uppercase tracking-widest">
                    <School size={14} /> More Than Just Tennis
                  </span>
                  <h2 className="font-display text-4xl md:text-5xl font-black mt-5">Because every child deserves the chance to shine.</h2>
                  <p className="text-primary-foreground/80 font-body mt-5 text-lg leading-relaxed max-w-3xl">
                    Using Suffolk Tennis' exciting mascot branding and positive environment, every player will be encouraged to grow on and off court in a setting built around confidence, enjoyment and belonging.
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-8">
                    {values.map((value) => (
                      <div key={value} className="rounded-2xl bg-primary-foreground/5 border border-primary-foreground/10 px-4 py-3 text-sm font-body text-primary-foreground/90">
                        {value}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-center lg:text-right">
                  <p className="font-display text-3xl md:text-4xl font-black text-lta-yellow">Play. Learn. Laugh. Belong.</p>
                  <p className="font-display text-xl text-primary-foreground mt-3">The future of Suffolk Tennis starts here.</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default RisingStars;
