import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const CountUp = ({ target, suffix = "" }: {target: number;suffix?: string;}) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 2000;
          const steps = 60;
          const increment = target / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="font-display text-3xl font-black text-[hsl(65_100%_55%)]">
      {count.toLocaleString()}{suffix}
    </div>);

};

const HeroSection = () =>
<section className="relative min-h-screen flex items-center overflow-hidden">
    {/* Video Background */}
    <div className="absolute inset-0">
      <video autoPlay muted loop playsInline className="w-full h-full object-cover">
        <source src="/hero-video.mov" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-r from-suffolk-navy/90 via-suffolk-navy/70 to-suffolk-navy/40" />
    </div>

    {/* pt must clear the fixed navbar (104px tall until the page scrolls). */}
    <div className="container mx-auto px-6 relative z-10 pt-32 pb-10" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.6)' }}>
      <div className="max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <span className="inline-block px-4 py-1.5 rounded-full bg-lta-yellow/20 text-primary-foreground font-semibold mb-6 border border-lta-yellow/40 backdrop-blur-sm text-sm">🎾  Where Aspiring Juniors Play Tennis

        </span>
        </motion.div>

        <motion.h1
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.15 }}
        className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black leading-[1.05] tracking-tight mb-6">
          <span className="text-primary-foreground">Suffolk Tennis</span>
          <br />
          <span className="text-lta-cyan">Performance Pathway</span>
        </motion.h1>

        <motion.p
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="text-lg md:text-xl text-primary-foreground/80 mb-10 max-w-lg leading-relaxed font-body">Discover world-class coaching, exciting tournaments, and a thriving tennis community for players aged 6 - 18 across Suffolk.



      </motion.p>

        <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.45 }}
        className="flex flex-wrap gap-4">
        
          <a href="#programs" className="px-8 py-4 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-base hover:brightness-110 transition-all shadow-[var(--shadow-glow-blue)]">
            Explore Pathway
          </a>
          <a href="#events" className="px-8 py-4 rounded-xl bg-[hsl(65_100%_55%)] text-suffolk-navy font-display font-bold text-base hover:brightness-110 transition-all shadow-[0_8px_30px_-6px_hsl(65_100%_55%/0.45)]">
            Upcoming Events
          </a>
        </motion.div>


        {/* Stats */}
        <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.7 }}
        className="mt-16 grid grid-cols-3 gap-8 max-w-md">
        
          {[
        { target: 50, suffix: "+", label: "Courts" },
        { target: 2000, suffix: "+", label: "Players" },
        { target: 100, suffix: "+", label: "Events/Year" }].
        map((s) =>
        <div key={s.label}>
              <CountUp target={s.target} suffix={s.suffix} />
              <div className="text-sm text-primary-foreground/60 font-body">{s.label}</div>
            </div>
        )}
        </motion.div>
      </div>
    </div>

    {/* Scroll indicator */}
    <motion.div
    animate={{ y: [0, 10, 0] }}
    transition={{ repeat: Infinity, duration: 1.5 }}
    className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
    
      <div className="w-6 h-10 rounded-full border-2 border-lta-cyan/60 flex items-start justify-center pt-2">
        <div className="w-1.5 h-3 rounded-full bg-lta-cyan/80" />
      </div>
    </motion.div>
  </section>;


export default HeroSection;