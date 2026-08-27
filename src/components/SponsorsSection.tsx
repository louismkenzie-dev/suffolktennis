import { motion } from "framer-motion";
import sponsorSchoolsOut from "@/assets/sponsor-schools-out.png";
import sponsorHalo from "@/assets/sponsor-halo.png";
import NullshiftMark from "./NullshiftMark";

const sponsors = [
  { name: "School's Out Activities", logo: sponsorSchoolsOut, url: "https://www.schoolsoutactivities.co.uk" },
  { name: "Halo", logo: sponsorHalo, url: "https://haloitsm.com" },
];

const linkClasses =
  "grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300";

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
          <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className={linkClasses}>
            <img src={s.logo} alt={s.name} className="h-12 md:h-16 w-auto object-contain" />
          </a>
        ))}

        {/* Not a sponsor — the build credit, shown in the same row at the same weight */}
        <a
          href="https://nullshift.co.uk"
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkClasses} flex flex-col items-center gap-2`}
        >
          <NullshiftMark className="text-[2rem] md:text-[2.6rem]" />
          <span className="text-[10px] md:text-xs font-body text-muted-foreground tracking-wide">
            Website designed by Nullshift
          </span>
        </a>
      </motion.div>
    </div>
  </section>
);

export default SponsorsSection;
