import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, Sparkles, ShieldCheck, Home, Heart, Medal, Trophy, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import davidLloydLogo from "@/assets/david-lloyd-logo.png";
import ipswichSportsLogo from "@/assets/ipswich-sports-logo.png";
import culfordLogo from "@/assets/culford-logo.jpg";
import miniMasters8u from "@/assets/mini-masters-8u.png.asset.json";
import miniMasters9u from "@/assets/mini-masters-9u.png.asset.json";
import miniMasters10u from "@/assets/mini-masters-10u.png.asset.json";
import miniMastersLogo from "@/assets/mini-masters-logo.png.asset.json";

type MiniMastersEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  poster_url: string | null;
  cost: string | null;
};

const miniMastersReasons = [
  { icon: Trophy, title: "LTA-Sanctioned", text: "More opportunities to compete in official LTA-sanctioned tournaments." },
  { icon: Home, title: "Less Travel", text: "Quality competition closer to home for Suffolk families." },
  { icon: ShieldCheck, title: "Consistent Quality", text: "Professionally run events with a reliable tournament standard." },
  { icon: Calendar, title: "Indoor Guaranteed", text: "Indoor courts for year-round play and reliable scheduling." },
  { icon: Heart, title: "Fun & Motivating", text: "A positive atmosphere that nurtures a love for competition." },
  { icon: Medal, title: "Player Development", text: "Progressive match play that builds skills, resilience, and ranking experience." },
];

const miniMastersBadges = [
  { label: "8 & Under", ball: "Red Ball", src: miniMasters8u.url, glow: "bg-rose-500" },
  { label: "9 & Under", ball: "Orange Ball", src: miniMasters9u.url, glow: "bg-orange-500" },
  { label: "10 & Under", ball: "Green Ball", src: miniMasters10u.url, glow: "bg-emerald-500" },
];

const miniMastersVenues = [
  { name: "David Lloyd Ipswich", logo: davidLloydLogo, style: "p-3 bg-white" },
  { name: "Ipswich Sports Club", logo: ipswichSportsLogo, style: "p-2 bg-white" },
  { name: "Culford", logo: culfordLogo, style: "p-0 bg-[#1a7fbf]" },
];

const MiniMasters = () => {
  const [events, setEvents] = useState<MiniMastersEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    supabase
      .from("events")
      .select("id, title, description, event_date, location, poster_url, cost")
      .eq("event_type", "mini-masters")
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .then(({ data }) => {
        setEvents((data as any) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-40 pb-20 bg-suffolk-navy overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-suffolk-navy via-suffolk-navy to-primary/40" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-lta-cyan/10 blur-3xl" />
        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto grid md:grid-cols-[auto_1fr] gap-10 items-center">
            <motion.img
              initial={{ opacity: 0, scale: 0.85, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.7 }}
              src={miniMastersLogo.url}
              alt="Suffolk Mini Masters logo"
              className="w-48 md:w-64 mx-auto drop-shadow-[0_15px_35px_rgba(0,0,0,0.4)]"
            />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center md:text-left">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-lta-yellow/15 text-lta-yellow text-xs font-bold uppercase tracking-widest">
                <Sparkles size={14} /> 10 & Under Series
              </span>
              <h1 className="font-display text-5xl md:text-6xl font-black text-primary-foreground mt-5">
                Suffolk <span className="text-lta-yellow">Mini Masters</span>
              </h1>
              <p className="text-primary-foreground/80 font-body mt-5 text-lg">
                A brand-new competition series bringing high-quality, LTA-sanctioned tournaments to Suffolk's 10 & Under players — closer to home, indoors, and built for development.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Intro & Venues */}
      <section className="py-24 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="font-display text-4xl md:text-5xl font-black text-foreground">
                The <span className="text-gradient-blue">Suffolk Mini Masters Series</span>
              </h2>
              <p className="text-muted-foreground font-body mt-5 text-lg max-w-3xl mx-auto">
                Hosted across three leading venues, the series gives young players more chances to compete in high-quality LTA-sanctioned events closer to home.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="grid sm:grid-cols-3 gap-4 mb-16"
            >
              {miniMastersVenues.map((v) => (
                <div key={v.name} className="rounded-2xl border border-border bg-card p-6 text-center hover:shadow-[var(--shadow-elevated)] transition-all">
                  <div className={`mx-auto w-28 h-28 rounded-xl overflow-hidden flex items-center justify-center ${v.style}`}>
                    <img src={v.logo} alt={v.name} className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="mt-4 font-display font-bold text-foreground">{v.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">Mini Masters Host Venue</div>
                </div>
              ))}
            </motion.div>

            <div className="rounded-3xl bg-suffolk-navy text-primary-foreground p-8 md:p-12 mb-12">
              <p className="font-body text-primary-foreground/85 leading-relaxed">
                Too often, families are required to travel long distances to access strong competitive experiences. The Suffolk Mini Masters Series aims to change that by delivering professionally run tournaments right here in Suffolk — helping players build confidence, match experience, and a love for competition within their local tennis community.
              </p>
            </div>

            <h3 className="font-display text-2xl md:text-3xl font-black text-foreground text-center mb-8">
              Why the Mini Masters Series?
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
              {miniMastersReasons.map((r, i) => (
                <motion.div
                  key={r.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  className="group rounded-2xl border border-border bg-card p-6 cursor-default transition-all duration-300 hover:border-lta-cyan/60 hover:shadow-[0_12px_30px_-12px_hsl(var(--lta-cyan)/0.45)] hover:bg-gradient-to-br hover:from-card hover:to-lta-cyan/5"
                >
                  <div className="w-11 h-11 rounded-xl bg-lta-cyan/10 text-lta-cyan flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-lta-cyan group-hover:text-suffolk-navy group-hover:scale-110 group-hover:rotate-6">
                    <r.icon size={20} />
                  </div>
                  <div className="font-display font-bold text-foreground mb-1 transition-colors group-hover:text-lta-cyan">{r.title}</div>
                  <p className="text-sm text-muted-foreground">{r.text}</p>
                </motion.div>
              ))}
            </div>

            {/* Mascot & Series Badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-3xl bg-gradient-to-br from-lta-cyan/10 via-background to-lta-yellow/10 border border-border p-8 md:p-12"
            >
              <div className="text-center max-w-3xl mx-auto mb-10">
                <span className="text-xs font-bold uppercase tracking-widest text-lta-cyan">Meet Punchy</span>
                <h3 className="font-display text-3xl font-black text-foreground mt-2">Suffolk's Mini Masters Mascot</h3>
                <p className="text-muted-foreground font-body mt-3">
                  Say hello to <strong className="text-foreground">Punchy</strong> — the bold new face of the Suffolk Mini Masters Series. Each age group has its own dedicated badge, bringing fun, excitement, and unmistakable identity to every event across the county.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8">
                {miniMastersBadges.map((b, i) => (
                  <motion.div
                    key={b.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    whileHover={{ y: -8, rotate: -2 }}
                    className="flex flex-col items-center group"
                  >
                    <div className="relative">
                      <div className={`absolute inset-0 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity ${b.glow}`} />
                      <img
                        src={b.src}
                        alt={`Suffolk Mini Masters ${b.label} badge featuring Punchy the mascot`}
                        className="relative w-44 h-44 md:w-52 md:h-52 object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.25)] transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="font-display font-black text-foreground text-xl mt-4">{b.label}</div>
                    <div className="text-sm text-muted-foreground">{b.ball}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Upcoming Mini Masters Events */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-lta-cyan uppercase tracking-widest">Fixtures</span>
            <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mt-3">
              Upcoming <span className="text-gradient-blue">Mini Masters</span>
            </h2>
            <p className="text-muted-foreground font-body mt-4 max-w-xl mx-auto">
              All confirmed Mini Masters fixtures across our Suffolk host venues.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-lta-cyan border-t-transparent rounded-full" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-center text-muted-foreground">
              No Mini Masters events scheduled just yet — new fixtures will appear here soon.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {events.map((ev, i) => {
                const d = new Date(ev.event_date);
                const dateLabel = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                const timeLabel = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06 }}
                    className="rounded-3xl overflow-hidden bg-card border border-border hover:shadow-[var(--shadow-elevated)] transition-all"
                  >
                    {ev.poster_url ? (
                      <div className="aspect-[4/3] overflow-hidden bg-muted">
                        <img src={ev.poster_url} alt={ev.title} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-[4/3] overflow-hidden bg-gradient-to-br from-suffolk-navy to-primary flex items-center justify-center">
                        <img src={miniMastersLogo.url} alt="Mini Masters" className="w-2/3 opacity-90" />
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="font-display text-xl font-black text-foreground leading-tight">{ev.title}</h3>
                      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2"><Calendar size={14} className="text-lta-cyan" /> {dateLabel} · {timeLabel}</div>
                        {ev.location && <div className="flex items-center gap-2"><MapPin size={14} className="text-lta-cyan" /> {ev.location}</div>}
                        {ev.cost && <div className="text-primary font-bold text-xs uppercase tracking-widest mt-2">{ev.cost}</div>}
                      </div>
                      {ev.description && <p className="text-sm text-muted-foreground mt-4 line-clamp-3">{ev.description}</p>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="text-center mt-12">
            <Link
              to="/events"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-lta-cyan text-lta-cyan font-display font-bold hover:bg-lta-cyan hover:text-suffolk-navy transition-all"
            >
              View all Suffolk events <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default MiniMasters;
