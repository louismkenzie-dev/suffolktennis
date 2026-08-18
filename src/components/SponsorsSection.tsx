import { motion } from "framer-motion";
import sponsorDunlop from "@/assets/sponsor-dunlop-new.png";
import sponsorSchoolsOut from "@/assets/sponsor-schools-out.png";
import sponsorHaloItsm from "@/assets/sponsor-halo-itsm.png";

const sponsors = [
  { name: "Dunlop", logo: sponsorDunlop, url: "https://www.dunlopsports.com" },
  { name: "School's Out Activities", logo: sponsorSchoolsOut, url: "https://www.schoolsoutactivities.co.uk" },
  { name: "HaloITSM", logo: sponsorHaloItsm, url: "https://haloitsm.com" },
];

const SponsorsSection = () => (
  <section className="py-16 bg-muted/20 border-t border-border">
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-10"
      >
        <h3
          className="text-sm font-semibold tracking-widest uppercase text-muted-foreground mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Proudly Supported By
        </h3>
        <div className="w-12 h-0.5 bg-primary mx-auto" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="flex flex-wrap items-center justify-center gap-12 md:gap-20"
      >
        {sponsors.map((s) => (
          <a
            key={s.name}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300"
          >
            <img
              src={s.logo}
              alt={s.name}
              className="h-12 md:h-16 w-auto object-contain"
            />
          </a>
        ))}
      </motion.div>
    </div>
  </section>
);

export default SponsorsSection;
