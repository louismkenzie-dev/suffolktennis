import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Menu, X, ChevronDown, Calendar, Sparkles, Brain } from "lucide-react";
import { Link } from "react-router-dom";
import logoAsset from "@/assets/suffolk-tennis-logo-landscape-v2.png.asset.json";
import davidLloydLogo from "@/assets/david-lloyd-logo.png";
import ipswichSportsLogo from "@/assets/ipswich-sports-logo.png";
import culfordLogo from "@/assets/culford-logo.jpg";
import redBadge from "@/assets/punchy-red-tour.png";
import orangeBadge from "@/assets/punchy-orange-tour.png";
import greenBadge from "@/assets/punchy-green-tour.png";
import yellowBadgeAsset from "@/assets/suffolk-yellow-ball-badge.png.asset.json";
import risingStarsBadge from "@/assets/suffolk-rising-stars-badge.png.asset.json";
import miniMastersLogo from "@/assets/mini-masters-logo.png.asset.json";
import tennisGpLogo from "@/assets/tennis-gp-logo.png.asset.json";

const logo = logoAsset.url;
const yellowBadge = yellowBadgeAsset.url;

const defaultFeederClubs = [
  { name: "East Bergholt TC", path: "/clubs/east-bergholt" },
  { name: "Newmarket TC", path: "/clubs/newmarket" },
  { name: "Stowmarket LTC", path: "/clubs/stowmarket" },
  { name: "Felixstowe LTC", path: "/clubs/felixstowe" },
  { name: "Woodbridge TC", path: "/clubs/woodbridge" },
  { name: "Framlingham College", path: "/clubs/framlingham" },
];

const tourPrograms = [
  { name: "Red Ball", tagline: "8 & Under", badge: redBadge, path: "/programs/red-tour" },
  { name: "Orange Ball", tagline: "9 & Under", badge: orangeBadge, path: "/programs/orange-tour" },
  { name: "Green Ball", tagline: "10 & Under", badge: greenBadge, path: "/programs/green-tour" },
];

const seniorPrograms = [
  { name: "Yellow Ball", tagline: "11 - 18", badge: yellowBadge, path: "/programs/yellow-tour" },
];

const eventLinks = [
  {
    label: "Events & Competitions",
    description: "Tournaments, camps and county events",
    path: "/events",
    icon: Calendar,
  },
  {
    label: "Suffolk Mini Masters",
    description: "10 & Under LTA-sanctioned series across Suffolk",
    path: "/events/mini-masters",
    image: miniMastersLogo.url,
  },
  {
    label: "Suffolk Rising Stars",
    description: "Fun days and county pathway for enthusiastic 6–8 year olds",
    path: "/events/rising-stars",
    image: risingStarsBadge.url,
  },
  {
    label: "Tennis Grand Prix",
    description: "Beginner & improver competition series across Suffolk",
    path: "/events/tennis-gp",
    image: tennisGpLogo.url,
  },
  {
    label: "Workshops",
    description: "Mental performance and off-court development sessions",
    path: "/events/workshops",
    icon: Brain,
  },
];

const links = [
  { label: "Coaches", href: "/#coaches" },
  { label: "Contact", href: "/contact" },
];

const defaultPartnerVenues = [
  {
    name: "David Lloyd Ipswich",
    tagline: "Premium Rackets Facility",
    logo: davidLloydLogo,
    logoStyle: "p-2 bg-white",
    path: "/venues/david-lloyd",
  },
  {
    name: "Ipswich Sports Club",
    tagline: "Premier Racket Sports Hub",
    logo: ipswichSportsLogo,
    logoStyle: "p-1.5 bg-white",
    path: "/venues/ipswich-sports-club",
  },
  {
    name: "Culford Sports & Tennis Centre",
    tagline: "LTA Regional Development Centre",
    logo: culfordLogo,
    logoStyle: "p-0 bg-[#1a7fbf]",
    path: "/venues/culford",
  },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [venueDropdown, setVenueDropdown] = useState(false);
  const [programDropdown, setProgramDropdown] = useState(false);
  const [eventDropdown, setEventDropdown] = useState(false);
  const [mobileVenueOpen, setMobileVenueOpen] = useState(false);
  const [mobileProgramOpen, setMobileProgramOpen] = useState(false);
  const [mobileEventOpen, setMobileEventOpen] = useState(false);
  const [partnerVenues, setPartnerVenues] = useState(defaultPartnerVenues);
  const [feederClubs, setFeederClubs] = useState(defaultFeederClubs);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("venues")
        .select("name, tagline, logo_url, logo_bg_color, slug, venue_type, website_url, display_order")
        .eq("published", true)
        .order("display_order").order("name");
      if (!data || data.length === 0) return;
      const partners = data.filter(v => v.venue_type === "partner").map(v => ({
        name: v.name,
        tagline: v.tagline ?? "",
        logo: v.logo_url ?? "",
        logoStyle: v.logo_bg_color ? `p-1.5` : "p-1.5 bg-white",
        path: v.slug ? `/venues/${v.slug}` : (v.website_url ?? "#"),
      }));
      const feeders = data.filter(v => v.venue_type === "feeder").map(v => ({
        name: v.name,
        path: v.slug ? `/clubs/${v.slug}` : (v.website_url ?? "#"),
      }));
      if (partners.length) setPartnerVenues(partners);
      if (feeders.length) setFeederClubs(feeders);
    })();
  }, []);


  const { scrollY } = useScroll();
  const navHeight = useTransform(scrollY, [0, 120], [104, 80]);
  const logoHeight = useTransform(scrollY, [0, 120], [80, 56]);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 bg-suffolk-navy/95 backdrop-blur-xl border-b border-suffolk-navy"
    >
      <motion.div
        className="container mx-auto px-6 flex items-center justify-between"
        style={{ height: navHeight }}
      >
        <Link to="/" className="flex items-center gap-3">
          <motion.img
            src={logo}
            alt="Suffolk Tennis"
            style={{ height: logoHeight }}
            className="w-auto"
          />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <div
            className="relative"
            onMouseEnter={() => setProgramDropdown(true)}
            onMouseLeave={() => setProgramDropdown(false)}
          >
            <Link to="/programs" className="flex items-center gap-1 text-sm font-medium text-white/80 hover:text-lta-cyan transition-colors">
              Pathway
              <ChevronDown size={14} className={`transition-transform duration-200 ${programDropdown ? "rotate-180" : ""}`} />
            </Link>
            <AnimatePresence>
              {programDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 pt-3"
                >
                  <div className="bg-card border border-border rounded-2xl shadow-[var(--shadow-elevated)] p-5 w-[320px]">
                    <p className="text-xs font-display font-semibold text-lta-cyan uppercase tracking-widest mb-3">
                      10 & Under Pathway
                    </p>
                    <div className="space-y-1">
                      {tourPrograms.map((t) => (
                        <Link
                          key={t.name}
                          to={t.path}
                          className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-white">
                            <img src={t.badge} alt={t.name} className="w-full h-full object-contain" />
                          </div>
                          <div>
                            <p className="text-sm font-display font-bold text-foreground group-hover:text-lta-cyan transition-colors">{t.name}</p>
                            <p className="text-xs text-muted-foreground font-body">{t.tagline}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <p className="text-xs font-display font-semibold text-lta-cyan uppercase tracking-widest mt-5 mb-3">
                      11 - 18 Pathway
                    </p>
                    <div className="space-y-1">
                      {seniorPrograms.map((t) => (
                        <Link
                          key={t.name}
                          to={t.path}
                          className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-white">
                            <img src={t.badge} alt={t.name} className="w-full h-full object-contain" />
                          </div>
                          <div>
                            <p className="text-sm font-display font-bold text-foreground group-hover:text-lta-cyan transition-colors">{t.name}</p>
                            <p className="text-xs text-muted-foreground font-body">{t.tagline}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div
            className="relative"
            onMouseEnter={() => setVenueDropdown(true)}
            onMouseLeave={() => setVenueDropdown(false)}
          >
            <Link to="/venues" className="flex items-center gap-1 text-sm font-medium text-white/80 hover:text-lta-cyan transition-colors">
              Venues
              <ChevronDown size={14} className={`transition-transform duration-200 ${venueDropdown ? "rotate-180" : ""}`} />
            </Link>

            <AnimatePresence>
              {venueDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 pt-3"
                >
                  <div className="bg-card border border-border rounded-2xl shadow-[var(--shadow-elevated)] p-5 w-[380px]">
                    <p className="text-xs font-display font-semibold text-lta-cyan uppercase tracking-widest mb-3">
                      Partner Venues
                    </p>
                    <div className="space-y-1">
                      {partnerVenues.map((v) => (
                        <Link
                          key={v.name}
                          to={v.path}
                          className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent transition-colors group"
                        >
                          <div className={`w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center ${v.logoStyle}`}>
                            <img src={v.logo} alt={v.name} className="w-full h-full object-contain" />
                          </div>
                          <div>
                            <p className="text-sm font-display font-bold text-foreground group-hover:text-lta-cyan transition-colors">{v.name}</p>
                            <p className="text-xs text-muted-foreground font-body">{v.tagline}</p>
                          </div>
                        </Link>
                      ))}
                    </div>

                    <div className="border-t border-border mt-3 pt-3">
                      <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                        Feeder Clubs
                      </p>
                      <div className="grid grid-cols-2 gap-1">
                        {feederClubs.map((c) => (
                          <Link
                            key={c.name}
                            to={c.path}
                            className="text-xs font-body text-foreground hover:text-lta-cyan transition-colors py-1 px-1.5 rounded hover:bg-accent"
                          >
                            {c.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div
            className="relative"
            onMouseEnter={() => setEventDropdown(true)}
            onMouseLeave={() => setEventDropdown(false)}
          >
            <button className="flex items-center gap-1 text-sm font-medium text-white/80 hover:text-lta-cyan transition-colors">
              Events
              <ChevronDown size={14} className={`transition-transform duration-200 ${eventDropdown ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {eventDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 pt-3"
                >
                  <div className="bg-card border border-border rounded-2xl shadow-[var(--shadow-elevated)] p-5 w-[360px]">
                    <p className="text-xs font-display font-semibold text-lta-cyan uppercase tracking-widest mb-3">
                      County Events
                    </p>
                    <div className="space-y-1">
                      {eventLinks.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.label}
                            to={item.path}
                            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent transition-colors group"
                          >
                            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-white">
                              {item.image ? (
                                <img src={item.image} alt={item.label} className="w-full h-full object-contain" />
                              ) : Icon ? (
                                <Icon size={18} className="text-lta-cyan" />
                              ) : null}
                            </div>
                            <div>
                              <p className="text-sm font-display font-bold text-foreground group-hover:text-lta-cyan transition-colors">{item.label}</p>
                              <p className="text-xs text-muted-foreground font-body">{item.description}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {links.map((l) => (
            l.href.startsWith("/#") ? (
              <a
                key={l.label}
                href={l.href}
                className="text-sm font-medium text-white/80 hover:text-lta-cyan transition-colors"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.label}
                to={l.href}
                className="text-sm font-medium text-white/80 hover:text-lta-cyan transition-colors"
              >
                {l.label}
              </Link>
            )
          ))}


          <Link
            to="/auth"
            className="px-5 py-2.5 rounded-lg bg-lta-pink text-white text-sm font-semibold hover:brightness-110 transition-all shadow-[var(--shadow-glow-pink)]"
          >
            Parent Hub
          </Link>
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden text-white">
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden bg-suffolk-navy border-b border-suffolk-navy"
          >
            <div className="px-6 py-4 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Link
                  to="/programs"
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium py-2 text-white/80 hover:text-lta-cyan transition-colors"
                >
                  Pathway
                </Link>
                <button
                  onClick={() => setMobileProgramOpen(!mobileProgramOpen)}
                  aria-label="Toggle programs submenu"
                  className="p-2 text-white/80 hover:text-lta-cyan transition-colors"
                >
                  <ChevronDown size={14} className={`transition-transform duration-200 ${mobileProgramOpen ? "rotate-180" : ""}`} />
                </button>
              </div>
              <AnimatePresence>
                {mobileProgramOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden pl-4"
                  >
                    <p className="text-[10px] font-display font-semibold text-lta-cyan uppercase tracking-widest mt-2 mb-1">
                      10 & Under Pathway
                    </p>
                    {tourPrograms.map((t) => (
                      <Link
                        key={t.name}
                        to={t.path}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 py-2 text-sm text-white/80 hover:text-lta-cyan transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-white">
                          <img src={t.badge} alt={t.name} className="w-full h-full object-contain" />
                        </div>
                        {t.name}
                      </Link>
                    ))}
                    <p className="text-[10px] font-display font-semibold text-lta-cyan uppercase tracking-widest mt-3 mb-1">
                      11 - 18 Pathway
                    </p>
                    {seniorPrograms.map((t) => (
                      <Link
                        key={t.name}
                        to={t.path}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 py-2 text-sm text-white/80 hover:text-lta-cyan transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-white">
                          <img src={t.badge} alt={t.name} className="w-full h-full object-contain" />
                        </div>
                        {t.name}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => setMobileVenueOpen(!mobileVenueOpen)}
                className="flex items-center justify-between text-sm font-medium py-2 text-white/80 hover:text-lta-cyan transition-colors"
              >
                Venues
                <ChevronDown size={14} className={`transition-transform duration-200 ${mobileVenueOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {mobileVenueOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden pl-4"
                  >
                    {partnerVenues.map((v) => (
                      <Link
                        key={v.name}
                        to={v.path}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 py-2 text-sm text-white/80 hover:text-lta-cyan transition-colors"
                      >
                        <div className={`w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center ${v.logoStyle}`}>
                          <img src={v.logo} alt={v.name} className="w-full h-full object-contain" />
                        </div>
                        {v.name}
                      </Link>
                    ))}
                    <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-widest mt-3 mb-1 px-1">Feeder Clubs</p>
                    {feederClubs.map((c) => (
                      <Link
                        key={c.name}
                        to={c.path}
                        onClick={() => setOpen(false)}
                        className="block py-1.5 text-sm text-white/80 hover:text-lta-cyan transition-colors"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => setMobileEventOpen(!mobileEventOpen)}
                className="flex items-center justify-between text-sm font-medium py-2 text-white/80 hover:text-lta-cyan transition-colors"
              >
                Events
                <ChevronDown size={14} className={`transition-transform duration-200 ${mobileEventOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {mobileEventOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden pl-4"
                  >
                    {eventLinks.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.label}
                          to={item.path}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 py-2 text-sm text-white/80 hover:text-lta-cyan transition-colors"
                        >
                          <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-white">
                            {item.image ? (
                              <img src={item.image} alt={item.label} className="w-full h-full object-contain" />
                            ) : Icon ? (
                              <Icon size={14} className="text-lta-cyan" />
                            ) : null}
                          </div>
                          {item.label}
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              {links.map((l) => (
                l.href.startsWith("/#") ? (
                  <a
                    key={l.label}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="text-sm font-medium py-2 text-white/80 hover:text-lta-cyan transition-colors"
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link
                    key={l.label}
                    to={l.href}
                    onClick={() => setOpen(false)}
                    className="text-sm font-medium py-2 text-white/80 hover:text-lta-cyan transition-colors"
                  >
                    {l.label}
                  </Link>
                )
              ))}


              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="mt-4 block w-full text-center px-5 py-3.5 rounded-lg bg-lta-pink text-white text-base font-semibold hover:brightness-110 transition-all shadow-[var(--shadow-glow-pink)]"
              >
                Parent Hub
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
