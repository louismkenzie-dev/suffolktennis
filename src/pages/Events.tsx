import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, Clock, ExternalLink, Tag, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import miniMastersLogo from "@/assets/mini-masters-logo.png";

type LtaEvent = {
  title: string;
  date: string;
  endDate?: string;
  location: string;
  category: string;
  grade: string;
  ageGroups?: string[];
  url: string;
};

const categoryColors: Record<string, string> = {
  "Junior Tournament": "bg-primary/10 text-primary",
  "Junior Tour": "bg-lta-cyan/10 text-lta-cyan",
  "Camp": "bg-emerald-500/10 text-emerald-600",
  "County Championship": "bg-amber-500/10 text-amber-600",
  "Festival": "bg-purple-500/10 text-purple-600",
  "Championship": "bg-rose-500/10 text-rose-600",
  "Tour Finals": "bg-lta-yellow/10 text-amber-700",
  "LTA Youth Matchplay": "bg-indigo-500/10 text-indigo-600",
  "Play Your Way to Wimbledon": "bg-emerald-500/10 text-emerald-600",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return { day: String(d.getDate()), month: d.toLocaleString("en-GB", { month: "short" }) };
}

function formatDateRange(start: string, end?: string) {
  const s = new Date(start);
  if (!end || start === end) {
    return s.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }
  const e = new Date(end);
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${s.toLocaleString("en-GB", { month: "short" })}`;
  }
  return `${s.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}


const Events = () => {
  const [events, setEvents] = useState<LtaEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    supabase.functions.invoke("lta-events", { method: "POST" })
      .then(({ data }) => {
        if (data?.events) {
          const now = new Date();
          const upcoming = (data.events as LtaEvent[])
            .filter((e) => new Date(e.date) >= now)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          setEvents(upcoming);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-40 pb-20 bg-suffolk-navy overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-suffolk-navy via-suffolk-navy to-primary/40" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-lta-cyan/10 blur-3xl" />
        <div className="container mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-lta-cyan/15 text-lta-cyan text-xs font-bold uppercase tracking-widest">
              <Calendar size={14} /> Suffolk Tennis
            </span>
            <h1 className="font-display text-5xl md:text-6xl font-black text-primary-foreground mt-6">
              Events & <span className="text-lta-yellow">Competitions</span>
            </h1>
            <p className="text-primary-foreground/80 font-body mt-5 text-lg max-w-2xl mx-auto">
              Every upcoming Suffolk Tennis tournament, tour, camp and county event in one place.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mini Masters Teaser */}
      <section className="py-16 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto rounded-3xl overflow-hidden bg-suffolk-navy text-primary-foreground border border-suffolk-navy grid md:grid-cols-[auto_1fr] items-center gap-8 p-8 md:p-10"
          >
            <img
              src={miniMastersLogo}
              alt="Suffolk Mini Masters logo"
              className="w-40 md:w-48 mx-auto drop-shadow-[0_10px_25px_rgba(0,0,0,0.4)]"
            />
            <div className="text-center md:text-left">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lta-yellow/15 text-lta-yellow text-[11px] font-bold uppercase tracking-widest">
                New series · 10 & Under
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-black mt-3">
                Suffolk <span className="text-lta-yellow">Mini Masters</span>
              </h2>
              <p className="text-primary-foreground/80 mt-3 max-w-xl">
                LTA-sanctioned tournaments hosted across three Suffolk venues — closer to home, indoors, and built for development.
              </p>
              <Link
                to="/events/mini-masters"
                className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold hover:brightness-110 transition-all"
              >
                Explore Mini Masters <ArrowRight size={16} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>


      {/* All upcoming events */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-lta-cyan uppercase tracking-widest">What's On</span>
            <h2 className="font-display text-4xl md:text-5xl font-black text-foreground mt-3">
              All Upcoming <span className="text-gradient-blue">Events</span>
            </h2>
            <p className="text-muted-foreground font-body mt-4 max-w-xl mx-auto">
              The full Suffolk Tennis calendar — tournaments, tours, camps and county events.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-lta-cyan border-t-transparent rounded-full" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-center text-muted-foreground">No upcoming events found right now — check back soon.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {events.map((e, i) => {
                const { day, month } = formatDate(e.date);
                const colorClass = categoryColors[e.category] || "bg-muted text-muted-foreground";
                const isFeatured = e.category === "County Championship" || e.grade === "Grade 3";
                return (
                  <motion.a
                    key={`${e.title}-${e.date}-${i}`}
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: Math.min(i, 8) * 0.04 }}
                    className={`group rounded-2xl border border-border p-6 hover:shadow-[var(--shadow-elevated)] transition-all ${
                      isFeatured ? "bg-suffolk-navy text-primary-foreground border-suffolk-navy" : "bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`text-center px-3 py-2 rounded-xl ${isFeatured ? "bg-lta-cyan/15" : "bg-lta-cyan/10"}`}>
                        <div className={`font-display text-xl font-black ${isFeatured ? "text-lta-yellow" : "text-primary"}`}>{day}</div>
                        <div className={`text-xs font-semibold ${isFeatured ? "text-lta-cyan/70" : "text-primary/70"}`}>{month}</div>
                      </div>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${isFeatured ? "bg-lta-yellow/15 text-lta-yellow" : colorClass}`}>
                        {e.category}
                      </span>
                    </div>
                    <h3 className={`font-display font-bold text-lg mb-2 leading-snug ${isFeatured ? "" : "text-foreground"}`}>{e.title}</h3>
                    {e.grade && (
                      <div className={`flex items-center gap-1 text-xs font-medium mb-3 ${isFeatured ? "text-lta-cyan" : "text-primary"}`}>
                        <Tag size={12} />
                        {e.grade}
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className={`flex items-center gap-2 text-sm ${isFeatured ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        <MapPin size={14} className="shrink-0" />
                        {e.location}
                      </div>
                      <div className={`flex items-center gap-2 text-sm ${isFeatured ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        <Clock size={14} className="shrink-0" />
                        {formatDateRange(e.date, e.endDate)}
                      </div>
                    </div>
                    {e.ageGroups && e.ageGroups.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {e.ageGroups.map((ag) => (
                          <span key={ag} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isFeatured ? "bg-primary-foreground/10 text-primary-foreground/80" : "bg-muted text-muted-foreground"}`}>
                            {ag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className={`mt-5 flex items-center gap-1 text-sm font-semibold group-hover:gap-2 transition-all ${isFeatured ? "text-lta-cyan" : "text-primary"}`}>
                      View Details <ExternalLink size={14} />
                    </div>
                  </motion.a>
                );
              })}
            </div>
          )}

          <div className="text-center mt-12">
            <a
              href="https://competitions.lta.org.uk/find?DateFilterType=0&StartDate=2026-03-13&EndDate=2026-12-31&LocationFilterType=1&Distance=15&page=1&LocationCode=A090AB1B-D639-4765-92FC-6FE361EEFDB9&AgeGroupIDList%5B0%5D=8&AgeGroupIDList%5B1%5D=9&AgeGroupIDList%5B2%5D=10&AgeGroupIDList%5B3%5D=11&AgeGroupIDList%5B4%5D=12&AgeGroupIDList%5B5%5D=14&AgeGroupIDList%5B6%5D=16&AgeGroupIDList%5B7%5D=18"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-lta-cyan text-lta-cyan font-display font-bold hover:bg-lta-cyan hover:text-suffolk-navy transition-all"
            >
              <Calendar size={18} />
              View Full Calendar on LTA
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Events;
