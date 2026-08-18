import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy } from "lucide-react";

import punchyWimbledon from "@/assets/punchy-wimbledon.jpeg";
import punchyUSOpen from "@/assets/punchy-us-open.jpeg";
import punchyRolandGarros from "@/assets/punchy-roland-garros.jpeg";
import punchyAustralianOpen from "@/assets/punchy-australian-open.jpeg";

const grandSlams = [
  { img: punchyAustralianOpen, name: "Australian Open" },
  { img: punchyRolandGarros, name: "Roland-Garros" },
  { img: punchyWimbledon, name: "Wimbledon" },
  { img: punchyUSOpen, name: "US Open" },
];

const GrandSlamSlider = () => {
  const [currentSlam, setCurrentSlam] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlam((prev) => (prev + 1) % grandSlams.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-16 bg-[hsl(var(--suffolk-navy))]">
      <div className="container mx-auto px-6">
        <div className="rounded-3xl overflow-hidden bg-[hsl(var(--suffolk-navy))] border border-white/10 flex flex-col md:flex-row max-w-4xl mx-auto">
          {/* Image */}
          <div className="relative w-full md:w-1/2 min-h-[20rem] md:min-h-[24rem]">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentSlam}
                src={grandSlams[currentSlam].img}
                alt={`Punchy at ${grandSlams[currentSlam].name}`}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0 w-full h-full object-contain"
              />
            </AnimatePresence>
          </div>

          {/* Caption & dots */}
          <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-10">
            <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full mb-4">
              <Trophy size={14} className="text-[hsl(var(--suffolk-gold))]" />
              <span className="text-white/70 text-xs font-bold uppercase tracking-wider">Grand Slam Tour</span>
            </div>
            <h3 className="font-display text-xl md:text-2xl font-black text-white mb-2 text-center">
              Punchy Visits the 4 Grand Slams 🎾
            </h3>
            <AnimatePresence mode="wait">
              <motion.p
                key={currentSlam}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="text-white/70 font-display font-bold text-lg mb-6"
              >
                {grandSlams[currentSlam].name}
              </motion.p>
            </AnimatePresence>
            <div className="flex gap-2">
              {grandSlams.map((slam, i) => (
                <button
                  key={slam.name}
                  onClick={() => setCurrentSlam(i)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    i === currentSlam
                      ? "w-8 bg-[hsl(var(--suffolk-gold))]"
                      : "w-2.5 bg-white/30 hover:bg-white/50"
                  }`}
                  aria-label={`View ${slam.name}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GrandSlamSlider;
