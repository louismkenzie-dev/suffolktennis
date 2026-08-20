import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MapPin, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import RisingStarsSignupDialog, { RisingStarsEvent } from "@/components/RisingStarsSignupDialog";

type FeaturedEvent = RisingStarsEvent & {
  description: string | null;
  event_type: string;
  poster_url: string | null;
  sign_up_enabled: boolean;
  cost: string | null;
};

const FeaturedEventsBanner = () => {
  const [events, setEvents] = useState<FeaturedEvent[]>([]);
  const [signupFor, setSignupFor] = useState<RisingStarsEvent | null>(null);

  useEffect(() => {
    supabase
      .from("events")
      .select("id, title, description, event_date, location, event_type, poster_url, sign_up_enabled, cost, session_slots")
      .eq("featured", true)
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .limit(3)
      .then(({ data }) => setEvents((data as any) ?? []));
  }, []);

  if (!events.length) return null;

  return (
    <section className="py-16 bg-gradient-to-b from-suffolk-navy via-suffolk-navy to-[#0a1f4a]">
      <div className="container mx-auto px-6">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-lta-yellow/15 text-lta-yellow text-xs font-bold uppercase tracking-widest">
            <Sparkles size={14} /> Featured events
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-black text-primary-foreground mt-4">
            Coming up <span className="text-lta-yellow">from Suffolk Tennis</span>
          </h2>
        </div>

        <div className={`grid gap-6 max-w-5xl mx-auto ${events.length === 1 ? "" : events.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"}`}>
          {events.map((ev, i) => {
            const d = new Date(ev.event_date);
            const dateLabel = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
            const timeLabel = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
            const isRising = ev.event_type === "rising-stars";
            return (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-3xl overflow-hidden bg-primary-foreground/5 border border-primary-foreground/10 backdrop-blur"
              >
                {ev.poster_url && (
                  <div className="aspect-[4/3] overflow-hidden bg-black">
                    <img src={ev.poster_url} alt={ev.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-6">
                  {isRising && (
                    <span className="inline-block px-3 py-1 rounded-full bg-lta-yellow text-suffolk-navy text-[10px] font-black uppercase tracking-widest mb-3">
                      Rising Stars
                    </span>
                  )}
                  <h3 className="font-display text-2xl font-black text-primary-foreground leading-tight">{ev.title}</h3>
                  <div className="mt-3 space-y-1.5 text-sm text-primary-foreground/80">
                    <div className="flex items-center gap-2"><Calendar size={14} className="text-lta-cyan" /> {dateLabel} · {timeLabel}</div>
                    {ev.location && <div className="flex items-center gap-2"><MapPin size={14} className="text-lta-cyan" /> {ev.location}</div>}
                    {ev.cost && <div className="text-lta-yellow font-bold text-xs uppercase tracking-widest mt-2">{ev.cost}</div>}
                  </div>
                  {ev.description && <p className="text-primary-foreground/70 text-sm mt-4 line-clamp-3">{ev.description}</p>}
                  {/* Rising Stars events without signup get a working detail link;
                      other non-signup events get no button — the card already
                      shows everything and the old white button led nowhere. */}
                  {(ev.sign_up_enabled || isRising) && (
                    <div className="mt-5 flex gap-2">
                      {ev.sign_up_enabled ? (
                        <Button onClick={() => setSignupFor(ev)} className="flex-1 bg-lta-cyan text-suffolk-navy hover:bg-lta-cyan/90 font-bold">
                          Sign up free
                        </Button>
                      ) : (
                        <Button asChild variant="outline" className="flex-1 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                          <Link to="/events/rising-stars">Learn more <ArrowRight size={14} className="ml-1" /></Link>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <RisingStarsSignupDialog open={!!signupFor} onOpenChange={(o) => !o && setSignupFor(null)} event={signupFor} />
    </section>
  );
};

export default FeaturedEventsBanner;
