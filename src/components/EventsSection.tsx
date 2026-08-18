import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, Clock, ArrowRight, ExternalLink, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "short" });
  return { day: String(day), month };
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


const EventsSection = () => {
  const [events, setEvents] = useState<LtaEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.functions.invoke('lta-events', { method: 'POST' })
      .then(({ data }) => {
        if (data?.events) {
          // Only show upcoming events (next 6)
          const now = new Date();
          const upcoming = data.events
            .filter((e: LtaEvent) => new Date(e.date) >= now)
            .slice(0, 6);
          setEvents(upcoming);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <section id="events" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-sm font-semibold text-lta-cyan uppercase tracking-widest"
          >
            What's On
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-4xl md:text-5xl font-black text-foreground mt-3"
          >
            Tournament <span className="text-gradient-blue">Watch</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-muted-foreground font-body mt-4 max-w-xl mx-auto"
          >
            Suffolk key regional competitions to put in your diary this season.
          </motion.p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-lta-cyan border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {events.map((e, i) => {
              const { day, month } = formatDate(e.date);
              const colorClass = categoryColors[e.category] || "bg-muted text-muted-foreground";
              const isFeatured = e.category === "County Championship" || e.grade === "Grade 3";

              return (
                <motion.a
                  key={`${e.title}-${e.date}`}
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className={`group rounded-2xl border border-border p-6 hover:shadow-[var(--shadow-elevated)] transition-all ${
                    isFeatured ? "bg-suffolk-navy text-primary-foreground border-suffolk-navy" : "bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`text-center px-3 py-2 rounded-xl ${isFeatured ? "bg-lta-cyan/15" : "bg-lta-cyan/10"}`}>
                      <div className={`font-display text-xl font-black ${isFeatured ? "text-lta-yellow" : "text-primary"}`}>
                        {day}
                      </div>
                      <div className={`text-xs font-semibold ${isFeatured ? "text-lta-cyan/70" : "text-primary/70"}`}>
                        {month}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      isFeatured ? "bg-lta-yellow/15 text-lta-yellow" : colorClass
                    }`}>
                      {e.category}
                    </span>
                  </div>

                  <h3 className={`font-display font-bold text-lg mb-2 leading-snug ${isFeatured ? "" : "text-foreground"}`}>
                    {e.title}
                  </h3>

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
                        <span
                          key={ag}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isFeatured ? "bg-primary-foreground/10 text-primary-foreground/80" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {ag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className={`mt-5 flex items-center gap-1 text-sm font-semibold group-hover:gap-2 transition-all ${
                    isFeatured ? "text-lta-cyan" : "text-primary"
                  }`}>
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
  );
};

export default EventsSection;
