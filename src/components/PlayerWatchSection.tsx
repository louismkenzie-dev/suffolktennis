import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Award, Star, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import playerAriana from "@/assets/player-ariana.jpeg";
import playerFreddie from "@/assets/player-freddie.jpeg";
import playerWimbledonGirls from "@/assets/player-wimbledon-girls.jpeg";
import playerWimbledonTrophy from "@/assets/player-wimbledon-trophy.jpeg";

type GalleryItem = { url: string; name?: string };

type Player = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  badge: string | null;
  accent: string;
  achievements: string[];
  main_image_url: string | null;
  gallery: GalleryItem[] | null;
};

const fallbackImages = [playerAriana, playerWimbledonGirls, playerWimbledonTrophy, playerFreddie];

const accentClass = (a: string) => {
  switch (a) {
    case "cyan": return "border-l-lta-cyan";
    case "pink": return "border-l-pink-500";
    default: return "border-l-lta-yellow";
  }
};

const PlayerWatchSection = () => {
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("player_watch").select("*")
        .eq("published", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (data) setPlayers(((data as unknown) as Player[]));
    })();
  }, []);

  // Build inspiration strip from main images + gallery items, up to 4
  const stripImages: string[] = (() => {
    const urls: string[] = [];
    for (const p of players) {
      if (p.main_image_url) urls.push(p.main_image_url);
      for (const g of p.gallery ?? []) if (g.url) urls.push(g.url);
      if (urls.length >= 4) break;
    }
    while (urls.length < 4) urls.push(fallbackImages[urls.length]);
    return urls.slice(0, 4);
  })();

  return (
    <section id="player-watch" className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--suffolk-navy))] via-[hsl(220,50%,18%)] to-[hsl(var(--suffolk-navy))]" />
      <div className="absolute inset-0 bg-suffolk-pattern opacity-40" />

      <div className="container mx-auto px-4 relative z-10" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-lta-yellow/10 border border-lta-yellow/20 mb-6">
            <Star className="w-4 h-4 text-lta-yellow" />
            <span className="text-lta-yellow text-sm font-medium tracking-wide uppercase" style={{ fontFamily: "var(--font-display)" }}>
              Celebrating National Success
            </span>
          </div>
          <h2
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Suffolk <span className="text-lta-yellow italic">Player Watch</span>
          </h2>
          <p className="text-lg text-lta-cyan/70 max-w-2xl mx-auto">
            Recognising Suffolk's leading 9U &amp; 10U players competing on the national stage.
          </p>
        </motion.div>

        {/* Inspiration strip */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-16"
        >
          {stripImages.map((img, i) => (
            <div key={i} className="relative rounded-xl overflow-hidden aspect-[4/3] group">
              <img
                src={img}
                alt="Suffolk junior player"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--suffolk-navy))]/60 to-transparent" />
            </div>
          ))}
        </motion.div>

        {/* Player cards */}
        <div className="space-y-8 max-w-4xl mx-auto">
          {players.map((player, i) => {
            const gallery = Array.isArray(player.gallery) ? player.gallery : [];
            const cover = player.main_image_url || gallery[0]?.url || fallbackImages[i % fallbackImages.length];
            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className={`relative rounded-2xl overflow-hidden border-l-4 ${accentClass(player.accent)} bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors`}
              >
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-72 h-64 md:h-auto flex-shrink-0">
                    <img src={cover} alt={player.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 p-6 md:p-8">
                    <h3 className="text-2xl md:text-3xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-display)" }}>
                      {player.name}
                    </h3>
                    {player.subtitle && (
                      <p className="text-lta-yellow font-semibold text-sm mb-4">{player.subtitle}</p>
                    )}
                    {player.achievements.length > 0 && (
                      <ul className="space-y-2 mb-4">
                        {player.achievements.map((a) => (
                          <li key={a} className="flex items-start gap-2 text-lta-cyan/80 text-sm">
                            <Trophy className="w-4 h-4 text-lta-yellow flex-shrink-0 mt-0.5" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    )}
                    {player.description && (
                      <p className="text-lta-cyan/50 text-sm leading-relaxed">{player.description}</p>
                    )}
                    {gallery.length > 0 && (
                      <div className="mt-5 grid grid-cols-4 gap-2">
                        {gallery.slice(0, 4).map((g, idx) => (
                          <div key={idx} className="aspect-square rounded-md overflow-hidden border border-white/10">
                            <img src={g.url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    {player.badge && (
                      <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-lta-yellow/15 border border-lta-yellow/30">
                        <Award className="w-4 h-4 text-lta-yellow" />
                        <span className="text-lta-yellow text-xs font-bold uppercase tracking-wider">{player.badge} Award</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          {players.length === 0 && (
            <p className="text-center text-lta-cyan/60 text-sm">No featured players yet.</p>
          )}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <p className="text-lta-cyan/60 text-lg mb-2" style={{ fontFamily: "var(--font-display)" }}>
            LTA National Performer Recognition
          </p>
          <p className="text-white/80 text-sm max-w-lg mx-auto mb-6">
            From 9U to 10U national level – Suffolk Tennis is building a connected performance pathway.
          </p>
          <a
            href="#programs"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-lta-yellow text-suffolk-navy font-bold hover:brightness-110 transition-all"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Explore the 10U Pathway <ChevronRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default PlayerWatchSection;
