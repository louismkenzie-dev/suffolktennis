import { Instagram, Facebook, Youtube, Twitter, Mail } from "lucide-react";
import logoAsset from "@/assets/suffolk-tennis-logo-v7.png";
import davidLloydLogo from "@/assets/david-lloyd-logo.png";
import ipswichSportsWhite from "@/assets/ipswich-sports-white.png";
import culfordWhite from "@/assets/culford-white.png";
const logo = logoAsset;

const venueLogos = [
  { src: davidLloydLogo, alt: "David Lloyd Ipswich", invert: true },
  { src: ipswichSportsWhite, alt: "Ipswich Sports Club", invert: false },
  { src: culfordWhite, alt: "Culford Sports & Tennis Centre", invert: false },
];

const socials = [
  { icon: Instagram, label: "Instagram", url: "https://www.instagram.com/suffolktennis", color: "hover:text-pink-400" },
  { icon: Facebook, label: "Facebook", url: "https://www.facebook.com/suffolktennis", color: "hover:text-blue-400" },
  { icon: Twitter, label: "X / Twitter", url: "https://x.com/suffolktennis", color: "hover:text-sky-400" },
  { icon: Youtube, label: "YouTube", url: "https://www.youtube.com/@suffolktennis", color: "hover:text-red-400" },
  { icon: Mail, label: "Email", url: "mailto:enquiries@suffolktennis.online", color: "hover:text-lta-yellow" },
];

const Footer = () => (
  <footer className="relative bg-suffolk-navy border-t border-lta-cyan/10 py-12 overflow-hidden">
    {/* Subtle LTA accent line */}
    <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-lta-cyan via-lta-yellow to-lta-cyan" />

    <div className="container mx-auto px-6 relative z-10">
      {/* Serve Me Socials */}
      <div className="text-center mb-10">
        <h3
          className="font-display text-lg font-bold text-lta-cyan tracking-wide uppercase mb-1"
        >
          🎾 Serve Me Socials
        </h3>
        <p className="text-primary-foreground/40 text-xs font-body mb-5">
          Follow us for the latest results, events & junior tennis updates
        </p>
        <div className="flex items-center justify-center gap-4">
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              className={`group relative p-3 rounded-xl bg-white/5 border border-white/10 text-primary-foreground/50 transition-all duration-300 hover:scale-110 hover:bg-white/10 hover:border-lta-cyan/30 ${s.color}`}
            >
              <s.icon size={20} />
            </a>
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6 flex-wrap justify-center md:justify-start">
          <img src={logo} alt="Suffolk Tennis" className="h-20 w-auto" />
          <div className="hidden md:block h-8 w-px bg-primary-foreground/15" />
          <div className="flex items-center gap-5 flex-wrap justify-center">
            <span className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/40 font-body">
              Lead Venues
            </span>
            {venueLogos.map((v) => (
              <img
                key={v.alt}
                src={v.src}
                alt={v.alt}
                className={`h-10 w-auto opacity-95 hover:opacity-100 transition-opacity ${v.invert ? "brightness-0 invert" : ""}`}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-primary-foreground/50 font-body">
          <a href="#" className="hover:text-lta-cyan transition-colors">Privacy</a>
          <a href="#" className="hover:text-lta-cyan transition-colors">Terms</a>
          <a href="#" className="hover:text-lta-cyan transition-colors">Accessibility</a>
          <a href="#" className="hover:text-lta-cyan transition-colors">Safeguarding</a>
        </div>
      </div>
      <div className="mt-8 pt-6 border-t border-primary-foreground/10 text-center text-xs text-primary-foreground/30 font-body">
        © {new Date().getFullYear()} Suffolk Tennis. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
