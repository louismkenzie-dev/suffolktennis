import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { MapPin, ArrowRight, Building2, Dumbbell, Trees, Trophy, Users, Sparkles, Globe, Mail, Phone } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SuffolkMapSection from "@/components/SuffolkMapSection";
import { supabase } from "@/integrations/supabase/client";
import venueDavidLloyd from "@/assets/venue-david-lloyd.jpg";
import venueIpswichSports from "@/assets/venue-ipswich-sports.jpg";
import venueCulford from "@/assets/venue-culford.jpg";
import davidLloydLogo from "@/assets/david-lloyd-logo.png";
import ipswichSportsLogo from "@/assets/ipswich-sports-logo.png";
import culfordLogo from "@/assets/culford-logo.jpg";

type VenueItem = {
  name: string;
  tagline: string;
  location: string;
  image: string;
  logo: string;
  logoStyle: string;
  path: string;
  intro: string;
  detail: string;
  highlights: { label: string }[];
  website_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
};
type FeederItem = { name: string; path: string; website_url?: string | null };

const defaultPartnerVenues: VenueItem[] = [
  {
    name: "David Lloyd Ipswich",
    tagline: "Premium Rackets Facility",
    location: "Ipswich, Suffolk",
    image: venueDavidLloyd,
    logo: davidLloydLogo,
    logoStyle: "p-2 bg-white",
    path: "/venues/david-lloyd",
    intro:
      "A flagship rackets destination with world-class indoor and outdoor courts, a thriving junior programme and a modern fitness offering.",
    highlights: [
      { label: "6 Indoor Courts" },
      { label: "3 Outdoor Courts" },
      { label: "Junior Tennis Star Programme (3–18)" },
      { label: "Extensive Fitness Suite & Spa" },
    ],
    detail:
      "The Ipswich club offers full year-round tennis with expert LTA coaches, structured group programmes from Red Ball through to Yellow Ball performance.",
  },
  {
    name: "Ipswich Sports Club",
    tagline: "Community Rackets & Sports Hub",
    location: "Ipswich, Suffolk",
    image: venueIpswichSports,
    logo: ipswichSportsLogo,
    logoStyle: "p-1.5 bg-white",
    path: "/venues/ipswich-sports-club",
    intro:
      "Over a century of history and one of the most respected independent racket sports clubs in the East.",
    highlights: [
      { label: "3 Indoor + 7 Outdoor Courts" },
      { label: "3 Additional Bubble Courts" },
      { label: "Active Junior Programme" },
      { label: "Squash, Padel & Hockey On-Site" },
    ],
    detail:
      "A brilliant home for players who want variety and community. Junior pathway sessions run alongside adult coaching.",
  },
  {
    name: "Culford Sports & Tennis Centre",
    tagline: "LTA Regional Player Development Centre",
    location: "Bury St Edmunds, Suffolk",
    image: venueCulford,
    logo: culfordLogo,
    logoStyle: "p-0 bg-[#1a7fbf]",
    path: "/venues/culford",
    intro:
      "An accredited LTA Regional Player Development Centre and one of the top tennis schools in the UK.",
    highlights: [
      { label: "6 Court Indoor Centre" },
      { label: "7 Outdoor Tennis Courts" },
      { label: "Integrated School Performance Programme" },
      { label: "Strength & Conditioning Suite" },
    ],
    detail:
      "Home of Suffolk's regional performance programme. Culford combines elite coaching, sports science and a proven competition calendar.",
  },
];

const defaultFeederClubs: FeederItem[] = [
  { name: "East Bergholt Tennis Club", path: "/clubs/east-bergholt" },
  { name: "Newmarket Tennis Club", path: "/clubs/newmarket" },
  { name: "Stowmarket LTC", path: "/clubs/stowmarket" },
  { name: "Felixstowe LTC", path: "/clubs/felixstowe" },
  { name: "Woodbridge Tennis Club", path: "/clubs/woodbridge" },
  { name: "Framlingham College", path: "/clubs/framlingham" },
];

const Venues = () => {
  const [partnerVenues, setPartnerVenues] = useState<VenueItem[]>(defaultPartnerVenues);
  const [feederClubs, setFeederClubs] = useState<FeederItem[]>(defaultFeederClubs);

  useEffect(() => {
    window.scrollTo(0, 0);
    (async () => {
      const { data } = await supabase
        .from("venues").select("*")
        .eq("published", true)
        .order("display_order").order("name");
      if (!data || data.length === 0) return;
      const partners = data.filter(v => v.venue_type === "partner").map((v): VenueItem => ({
        name: v.name,
        tagline: v.tagline ?? "",
        location: v.location ?? "",
        image: v.image_url ?? "",
        logo: v.logo_url ?? "",
        logoStyle: v.logo_bg_color ? `p-1.5` : "p-1.5 bg-white",
        path: v.slug ? `/venues/${v.slug}` : "#",
        intro: v.intro ?? "",
        detail: v.detail ?? "",
        highlights: (Array.isArray(v.highlights) ? (v.highlights as { label: string }[]) : []),
        website_url: v.website_url,
        contact_email: v.contact_email,
        contact_phone: v.contact_phone,
      }));
      const feeders = data.filter(v => v.venue_type === "feeder").map((v): FeederItem => ({
        name: v.name,
        path: v.slug ? `/clubs/${v.slug}` : (v.website_url ?? "#"),
        website_url: v.website_url,
      }));
      if (partners.length) setPartnerVenues(partners);
      if (feeders.length) setFeederClubs(feeders);
    })();
  }, []);

  return (
    <>
      <Navbar />
      <main className="pt-40 pb-24 bg-background">
        <div className="container mx-auto px-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <span className="text-sm font-semibold text-lta-cyan uppercase tracking-widest">
              County Performance Hubs
            </span>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-black text-foreground mt-3">
              Our <span className="text-gradient-blue">Partner Venues</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto mt-5 text-lg font-body">
              Three outstanding performance hubs and a network of feeder clubs — powering Suffolk's tennis pathway from
              first swing to national competition.
            </p>
          </motion.div>

          {/* Partner Venue Cards */}
          <div className="space-y-20">
            {partnerVenues.map((v, i) => {
              const isReversed = i % 2 !== 0;
              return (
                <motion.div
                  key={v.name}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="grid lg:grid-cols-2 gap-10 items-center"
                >
                  {/* Image */}
                  <div className={`${isReversed ? "lg:order-2" : ""}`}>
                    <div className="relative rounded-3xl overflow-hidden group shadow-[var(--shadow-elevated)]">
                      <img
                        src={v.image}
                        alt={v.name}
                        loading="lazy"
                        className="w-full aspect-[16/10] object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-suffolk-navy/70 via-transparent to-transparent" />
                      <div className="absolute bottom-4 left-4 flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-lta-cyan flex items-center justify-center">
                          <Building2 size={18} className="text-suffolk-navy" />
                        </div>
                        <span className="text-primary-foreground font-display font-bold text-sm tracking-wide">
                          Performance Hub
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className={`${isReversed ? "lg:order-1" : ""}`}>
                    <div className="flex items-center gap-4 mb-2">
                      <div
                        className={`w-16 h-16 rounded-full overflow-hidden border-2 border-lta-cyan shrink-0 flex items-center justify-center ${v.logoStyle}`}
                      >
                        <img src={v.logo} alt={`${v.name} logo`} className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <h2 className="font-display text-2xl md:text-3xl font-black text-foreground leading-tight">
                          {v.name}
                        </h2>
                        <p className="text-lta-cyan font-display font-semibold text-xs uppercase tracking-wider mt-1">
                          {v.tagline}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-4">
                      <MapPin size={12} /> {v.location}
                    </p>

                    <p className="text-foreground font-body leading-relaxed mb-5">{v.intro}</p>

                    <div className="grid sm:grid-cols-2 gap-3 mb-5">
                      {v.highlights.map((h) => (
                        <div
                          key={h.label}
                          className="flex items-start gap-2.5 rounded-xl bg-card border border-border px-3 py-2.5 shadow-[var(--shadow-card)]"
                        >
                          <Sparkles size={16} className="text-lta-cyan mt-0.5 shrink-0" />
                          <span className="text-sm text-foreground font-body">{h.label}</span>
                        </div>
                      ))}
                    </div>

                    <p className="text-muted-foreground font-body text-sm leading-relaxed mb-4">{v.detail}</p>

                    {(v.website_url || v.contact_email || v.contact_phone) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-5">
                        {v.website_url && (
                          <a href={v.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-lta-cyan">
                            <Globe size={12} /> Website
                          </a>
                        )}
                        {v.contact_email && (
                          <a href={`mailto:${v.contact_email}`} className="inline-flex items-center gap-1 hover:text-lta-cyan">
                            <Mail size={12} /> {v.contact_email}
                          </a>
                        )}
                        {v.contact_phone && (
                          <a href={`tel:${v.contact_phone}`} className="inline-flex items-center gap-1 hover:text-lta-cyan">
                            <Phone size={12} /> {v.contact_phone}
                          </a>
                        )}
                      </div>
                    )}

                    {v.path && v.path !== "#" ? (
                      <Link
                        to={v.path}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-sm hover:brightness-110 transition-all"
                      >
                        Explore {v.name.split(" ")[0]} <ArrowRight size={14} />
                      </Link>
                    ) : v.website_url ? (
                      <a
                        href={v.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-sm hover:brightness-110 transition-all"
                      >
                        Visit website <ArrowRight size={14} />
                      </a>
                    ) : null}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Feeder Clubs */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-24 rounded-3xl bg-suffolk-navy p-10 md:p-14"
          >
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-sm font-semibold text-lta-cyan uppercase tracking-widest">
                Community Network
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-black text-primary-foreground mt-3">
                Feeder Clubs Across Suffolk
              </h2>
              <p className="text-primary-foreground/70 mt-4 font-body">
                Local clubs delivering fantastic grassroots tennis and feeding players into the county pathway.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {feederClubs.map((c) => {
                const isExternal = c.path.startsWith("http");
                const cls = "group flex items-center justify-between gap-3 rounded-2xl bg-white/5 border border-white/10 hover:border-lta-cyan/60 hover:bg-white/10 px-5 py-4 transition-all";
                const inner = (
                  <>
                    <span className="font-display font-bold text-primary-foreground text-sm">{c.name}</span>
                    <ArrowRight size={16} className="text-lta-cyan transition-transform group-hover:translate-x-1" />
                  </>
                );
                return isExternal
                  ? <a key={c.name} href={c.path} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
                  : <Link key={c.name} to={c.path} className={cls}>{inner}</Link>;
              })}
            </div>
          </motion.div>
        </div>
      </main>
      <SuffolkMapSection />
      <Footer />
    </>
  );
};

export default Venues;
