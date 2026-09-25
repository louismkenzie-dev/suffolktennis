// "Programme Lead" section for a pathway page (Red, Orange and Green Ball).
//
// The coach's photo, qualification, experience, quote and bio come from the
// same `coaches` row the home page's Meet the Team cards read, so when a coach
// edits their profile in the admin every page that shows them follows. The
// bundled fallback is only there so the section still renders if that read
// fails; the heading (e.g. "10U County Lead Coach") is set per page because it
// is the role on that pathway, which can differ from the coach's general title.
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, Quote, Star, Target, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ollieImg from "@/assets/coach-ollie.png";

type Accent = "red" | "orange" | "green";

// Written out in full so Tailwind can see every class at build time.
const ACCENTS: Record<Accent, { pill: string; pillText: string; icon: string; title: string; quoteIcon: string }> = {
  red: { pill: "bg-red-50", pillText: "text-red-600", icon: "text-red-500", title: "text-red-600", quoteIcon: "text-red-400/20" },
  orange: { pill: "bg-orange-50", pillText: "text-orange-600", icon: "text-orange-500", title: "text-orange-600", quoteIcon: "text-orange-400/20" },
  green: { pill: "bg-green-50", pillText: "text-green-700", icon: "text-green-600", title: "text-green-700", quoteIcon: "text-green-400/20" },
};

export type LeadProfile = {
  name: string;
  photo: string;
  qualification: string;
  experience: string;
  quote: string;
  bio: string;
};

export function ProgrammeLead({ fallback, title, focus, accent }: {
  /** Shown until (or if) the live profile loads; matched to it by name. */
  fallback: LeadProfile;
  /** The role on this pathway, e.g. "10U County Lead Coach". */
  title: string;
  /** Short line for the pill under the name, e.g. "Red, Orange & Green Ball". */
  focus: string;
  accent: Accent;
}) {
  const [lead, setLead] = useState<LeadProfile>(fallback);
  const a = ACCENTS[accent];

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("coaches")
      .select("name, photo_url, qualification, experience, quote, bio")
      .eq("published", true)
      .eq("name", fallback.name)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setLead({
          name: data.name,
          photo: data.photo_url || fallback.photo,
          qualification: data.qualification || fallback.qualification,
          experience: data.experience || fallback.experience,
          quote: data.quote || fallback.quote,
          bio: data.bio || fallback.bio,
        });
      });
    return () => { cancelled = true; };
  }, [fallback]);

  const paragraphs = lead.bio.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const quote = lead.quote.trim().replace(/^["“]|["”]$/g, "");

  return (
    <section className="py-20 bg-background border-t border-border/30">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className={`inline-flex items-center gap-2 ${a.pill} px-4 py-1.5 rounded-full mb-6 mx-auto w-fit`}
        >
          <Users size={14} className={a.icon} />
          <span className={`text-sm font-semibold ${a.pillText} uppercase tracking-widest`}>Programme Lead</span>
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
                <img src={lead.photo} alt={lead.name} className="w-full h-full object-cover object-top" />
                <div className="absolute inset-0 bg-gradient-to-t from-suffolk-navy/60 to-transparent" />
                {lead.qualification && (
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
                      <Star size={11} /> {lead.qualification}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="flex-1 text-center md:text-left"
            >
              <h2 className="font-display text-3xl md:text-4xl font-black text-foreground mb-1">{lead.name}</h2>
              <p className={`${a.title} font-semibold text-lg mb-4`}>{title}</p>
              <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-6">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  <Target size={14} className={a.icon} /> {focus}
                </span>
                {lead.experience && (
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    <Award size={14} className={a.icon} /> {lead.experience} experience
                  </span>
                )}
              </div>
              {quote && (
                <div className="relative bg-accent/50 rounded-2xl p-6 mb-6">
                  <Quote size={32} className={`${a.quoteIcon} absolute top-4 left-4`} />
                  <p className="font-body text-foreground italic pl-8 leading-relaxed">"{quote}"</p>
                </div>
              )}
              <div className="space-y-4">
                {paragraphs.map((p, i) => (
                  <p key={i} className="text-muted-foreground font-body leading-relaxed">{p}</p>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Ollie's bundled profile — used only if the live one can't be read. A
 *  module-level constant, so the effect above runs once rather than on every
 *  render. */
export const OLLIE_FALLBACK: LeadProfile = {
  name: "Ollie Sutton",
  photo: ollieImg,
  qualification: "LTA Level 4",
  experience: "25 years",
  quote: "Every child who picks up a racket has the potential to fall in love with tennis. My job is to light that spark and keep it burning.",
  bio: "Ollie has been at the heart of Suffolk tennis for over two decades. Starting as a junior player himself in the county, he transitioned into coaching with a deep passion for developing players of all ages and abilities. Over his 25 year career, Ollie has coached hundreds of juniors through the pathway — many going on to represent Suffolk at county level and beyond.",
};
