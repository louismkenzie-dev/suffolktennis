import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  LogOut, User, Newspaper, Calendar, TrendingUp, ChevronRight,
  Trophy, Clock, MapPin, ExternalLink, BookOpen, Users, Shield, Heart, CalendarDays, X, MessageCircle, Menu, ChevronDown
} from "lucide-react";
import MyChildrenSection from "@/components/children/MyChildrenSection";
import RoleViewSwitcher from "@/components/RoleViewSwitcher";
import SportingTimetable from "@/components/timetable/SportingTimetable";
import ParentDetailsSection from "@/components/parent/ParentDetailsSection";
import MyBookingsSection from "@/components/parent/MyBookingsSection";
import { Ticket as TicketIcon } from "lucide-react";
import ProfileCompletionBanner from "@/components/parent/ProfileCompletionBanner";
import logoAsset from "@/assets/suffolk-tennis-logo-landscape-v2.png";
const logo = logoAsset;
import whatsappQr from "@/assets/whatsapp-qr.png";
import PathwayProgressionTable from "@/components/pathway/PathwayProgressionTable";
import TrainingContextSection from "@/components/pathway/TrainingContextSection";
import ParentalGuidanceSection from "@/components/pathway/ParentalGuidanceSection";
import CompetitionInfoSection from "@/components/pathway/CompetitionInfoSection";
import {
  pathwayStages,
  weeklyHours9U10U,
  weeklyHours11U14U,
  trainingContext9U10U,
  trainingContext11U14U,
  scoringFormats,
  competitionTimescales,
  parentalGuidance,
} from "@/components/pathway/PathwayData";

type Profile = {
  first_name: string;
  last_name: string;
  player_name: string | null;
  player_age_group: string | null;
  newsletter_subscribed: boolean;
};

type LtaArticle = {
  title: string;
  summary: string;
  imageUrl: string;
  articleUrl: string;
  category: string;
};

type LtaEvent = {
  title: string;
  date: string;
  endDate?: string;
  location: string;
  category: string;
  grade: string;
  ageGroups?: string[];
  url: string;
};

const ParentHub = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ltaNews, setLtaNews] = useState<LtaArticle[]>([]);
  const [ltaLoading, setLtaLoading] = useState(false);
  const [ltaEvents, setLtaEvents] = useState<LtaEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsFilter, setEventsFilter] = useState<"upcoming" | "past">("upcoming");
  // Deep-linkable tabs: /parent-hub?tab=bookings (used by ticket/confirmation
  // pages to send parents straight back to their bookings).
  type HubTab = "children" | "bookings" | "parent" | "timetable" | "pathway" | "news" | "events";
  const [activeTab, setActiveTab] = useState<HubTab>(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return ["children", "bookings", "parent", "timetable", "pathway", "news", "events"].includes(t ?? "")
      ? (t as HubTab)
      : "children";
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [pathwaySection, setPathwaySection] = useState<"overview" | "9u10u" | "11u14u" | "context" | "competition" | "parents">("overview");
  const [showWhatsApp, setShowWhatsApp] = useState(() => {
    return localStorage.getItem("whatsapp-banner-dismissed") !== "true";
  });

  const dismissWhatsApp = () => {
    setShowWhatsApp(false);
    localStorage.setItem("whatsapp-banner-dismissed", "true");
  };

  const openWhatsAppCommunity = () => {
    window.open("https://chat.whatsapp.com/IwdVWBmbWx4B56WOlIGVZB", "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user]);

  // Fetch LTA news and events from edge functions
  useEffect(() => {
    if (!user) return;
    setLtaLoading(true);
    setEventsLoading(true);

    supabase.functions.invoke('lta-news', { method: 'POST' })
      .then(({ data }) => { if (data?.articles) setLtaNews(data.articles); })
      .finally(() => setLtaLoading(false));

    supabase.functions.invoke('lta-events', { method: 'POST' })
      .then(({ data }) => { if (data?.events) setLtaEvents(data.events); })
      .finally(() => setEventsLoading(false));
  }, [user]);

  // Fetch LTA news from edge function
  useEffect(() => {
    if (!user) return;
    setLtaLoading(true);
    supabase.functions.invoke('lta-news', { method: 'POST' })
      .then(({ data, error }) => {
        if (data?.articles) {
          setLtaNews(data.articles);
        }
        setLtaLoading(false);
      })
      .catch(() => setLtaLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-suffolk-navy flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-lta-cyan border-t-transparent rounded-full" />
      </div>
    );
  }

  const tabs = [
    { id: "children" as const, label: "My Children", icon: Heart },
    { id: "bookings" as const, label: "Bookings & Invitations", icon: TicketIcon },
    { id: "parent" as const, label: "Parent Details", icon: User },
    { id: "timetable" as const, label: "Sporting Timetable", icon: CalendarDays },
    { id: "pathway" as const, label: "LTA Pathway", icon: Trophy },
    { id: "news" as const, label: "News & Updates", icon: Newspaper },
    { id: "events" as const, label: "Upcoming Events", icon: Calendar },
  ];

  const pathwaySections = [
    { id: "overview" as const, label: "Overview", icon: Trophy },
    { id: "9u10u" as const, label: "9U / 10U", icon: BookOpen },
    { id: "11u14u" as const, label: "11U–14U", icon: BookOpen },
    { id: "context" as const, label: "Training Guide", icon: BookOpen },
    { id: "competition" as const, label: "Competitions", icon: Shield },
    { id: "parents" as const, label: "Parent Guide", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-suffolk-navy text-primary-foreground border-b border-primary-foreground/10">
        <div className="container mx-auto px-6 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Suffolk Tennis" className="h-10" />
            <span className="font-display font-bold text-sm hidden sm:block">Parent Hub</span>
          </Link>
          <div className="flex items-center gap-4">
            <RoleViewSwitcher onDark />
            <div className="flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full bg-lta-cyan/20 flex items-center justify-center">
                <User size={16} className="text-lta-cyan" />
              </div>
              <span className="hidden sm:block font-body text-primary-foreground/70">
                {profile?.first_name} {profile?.last_name}
              </span>
            </div>
            <button
              onClick={() => { signOut(); navigate("/"); }}
              className="text-primary-foreground/50 hover:text-primary-foreground transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Welcome Banner */}
      <div className="bg-suffolk-navy text-primary-foreground py-10">
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-display text-3xl md:text-4xl font-black">
              Welcome back, <span className="text-lta-cyan">{profile?.first_name || "Parent"}</span>
            </h1>
            <p className="text-primary-foreground/50 font-body mt-2 max-w-lg">
              {profile?.player_name
                ? `Track ${profile.player_name}'s journey through the LTA Performance Pathway.`
                : "Explore the LTA Performance Pathway and stay up to date with programme news."}
            </p>
          </motion.div>
        </div>
      </div>

      {/* WhatsApp Community Banner */}
      <AnimatePresence>
        {showWhatsApp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#25D366]/10 border-b border-[#25D366]/20"
          >
            <div className="container mx-auto px-6 py-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                    <MessageCircle size={20} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display font-bold text-foreground text-sm">
                      <span className="sm:hidden">Parent WhatsApp</span>
                      <span className="hidden sm:inline">Join the Suffolk Tennis Parent Community</span>
                    </h3>
                    <p className="hidden sm:block text-muted-foreground text-xs font-body">Connect with other parents, get updates, and share your child's tennis journey on WhatsApp.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <button
                    onClick={() => setShowQrModal(true)}
                    className="hidden sm:block w-16 h-16 rounded-lg overflow-hidden border border-border bg-white p-1 cursor-pointer hover:scale-105 transition-transform"
                    title="Click to enlarge QR code"
                  >
                    <img src={whatsappQr} alt="Scan to join WhatsApp community" className="w-full h-full object-contain" />
                  </button>
                  <button
                    type="button"
                    onClick={openWhatsAppCommunity}
                    className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full bg-[#25D366] text-white font-display font-bold text-xs sm:text-sm hover:bg-[#20bd5a] transition-colors whitespace-nowrap"
                  >
                    <MessageCircle size={14} className="sm:hidden" />
                    <MessageCircle size={16} className="hidden sm:block" />
                    <span className="sm:hidden">Join</span>
                    <span className="hidden sm:inline">Join WhatsApp</span>
                  </button>
                  <button
                    onClick={dismissWhatsApp}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    aria-label="Dismiss"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Navigation */}
      <div className="border-b border-border bg-card sticky top-0 z-30">
        <div className="container mx-auto px-6">
          {/* Desktop / tablet: horizontal tabs (mobile uses the bottom app bar) */}
          <div className="flex gap-1 overflow-x-auto max-sm:hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-lta-cyan text-lta-cyan"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>


      {/* Content */}
      <main className="container mx-auto px-6 py-8 max-sm:pb-32">
        <ProfileCompletionBanner
          onGoToParent={() => setActiveTab("parent")}
          onGoToChildren={() => setActiveTab("children")}
        />
        {activeTab === "children" && <MyChildrenSection />}
        {activeTab === "bookings" && <MyBookingsSection />}
        {activeTab === "parent" && <ParentDetailsSection />}
        {activeTab === "timetable" && <SportingTimetable />}

        {activeTab === "pathway" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="mb-6">
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">LTA Player Pathway</h2>
              <p className="text-muted-foreground font-body">
                Our world-class Player Pathway nurtures performance players from 7–18 and up to the world's top singles and doubles players. Click through the sections below for full details.
              </p>
            </div>

            {/* Pathway sub-nav */}
            <div className="flex flex-wrap gap-2 mb-8">
              {pathwaySections.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => setPathwaySection(sec.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    pathwaySection === sec.id
                      ? "bg-suffolk-navy text-primary-foreground shadow-lg"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <sec.icon size={14} />
                  {sec.label}
                </button>
              ))}
            </div>

            {/* Overview */}
            {pathwaySection === "overview" && (
              <div className="space-y-8">
                {/* Video */}
                <div className="rounded-2xl overflow-hidden bg-primary aspect-video max-w-3xl">
                  <iframe
                    src="https://www.youtube.com/embed/RMIjgT2rhcI?rel=0"
                    title="The Player Pathway Journey"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>

                {/* Stage cards */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {pathwayStages.map((stage, i) => (
                    <motion.a
                      key={stage.age}
                      href={stage.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="group relative bg-card border border-border rounded-2xl p-5 hover:shadow-lg transition-all hover:-translate-y-1"
                    >
                      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${stage.color} text-white font-display font-black text-sm mb-3`}>
                        {stage.age}
                      </div>
                      <p className="text-xs text-lta-cyan font-display font-bold mb-1">{stage.stage}</p>
                      <h3 className="font-display font-bold text-foreground mb-1 group-hover:text-lta-cyan transition-colors">
                        {stage.title}
                      </h3>
                      <p className="text-sm text-muted-foreground font-body leading-relaxed">
                        {stage.description}
                      </p>
                      <div className="absolute top-5 right-5 flex items-center gap-1 text-muted-foreground/30 group-hover:text-lta-cyan transition-colors">
                        <ExternalLink size={14} />
                      </div>
                    </motion.a>
                  ))}
                </div>

                {/* Key highlights banner */}
                <div className="bg-suffolk-navy rounded-2xl p-8 text-primary-foreground">
                  <h3 className="font-display text-2xl font-black mb-6">Key Performance Highlights</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                      { num: "1", text: "First time five British men in ATP doubles top 10 rankings — first time in 32 years for ANY nation" },
                      { num: "2", text: "23 British players in Wimbledon main singles draw for 1st time since 1984. Sonay Kartal into 4th round of Grand Slam for 1st time" },
                      { num: "3", text: "Jack Draper broke into the top 5 of the men's world rankings — first to do so since Andy Murray" },
                      { num: "4", text: "Julian Cash & Lloyd Glasspool won seven titles, including their first Grand Slam at Wimbledon" },
                      { num: "5", text: "GB reached the semi-finals of the BJKC in Shenzhen — making it 3 times in the last 4 years" },
                      { num: "6", text: "Francesca Jones the 5th woman in the top 100 this year, 8th since end of 2021" },
                    ].map((item) => (
                      <div key={item.num} className="flex gap-4">
                        <span className="text-3xl font-display font-black text-lta-cyan">{item.num}</span>
                        <p className="text-sm text-primary-foreground/80 font-body leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 9U/10U Detail */}
            {pathwaySection === "9u10u" && (
              <div className="space-y-6">
                <PathwayProgressionTable {...weeklyHours9U10U} />
                <div className="bg-lta-cyan/10 border border-lta-cyan/20 rounded-2xl p-6">
                  <h4 className="font-display font-bold text-foreground mb-2">💡 Important Note</h4>
                  <p className="text-sm text-muted-foreground font-body leading-relaxed">
                    More important than these recommendations is having a credible and accredited coach who is driven to lead on accelerating the player's development, that rest and recovery is factored in, and the player is accessing a thriving developmental training environment where player well-being is at the forefront.
                  </p>
                </div>
              </div>
            )}

            {/* 11U-14U Detail */}
            {pathwaySection === "11u14u" && (
              <div className="space-y-6">
                <PathwayProgressionTable {...weeklyHours11U14U} />
                <div className="bg-lta-cyan/10 border border-lta-cyan/20 rounded-2xl p-6">
                  <h4 className="font-display font-bold text-foreground mb-2">💡 Important Note</h4>
                  <p className="text-sm text-muted-foreground font-body leading-relaxed">
                    More important than these recommendations is having a credible and accredited Performance Coach leading on the player's development, that rest and recovery is factored in, and the player is accessing a thriving developmental training environment where player well-being is at the forefront.
                  </p>
                </div>
              </div>
            )}

            {/* Training Context */}
            {pathwaySection === "context" && (
              <div className="space-y-6">
                <TrainingContextSection title="Training Context — 9U / 10U" items={trainingContext9U10U} />
                <TrainingContextSection title="Training Context — 11U / 12U / 14U" items={trainingContext11U14U} />
              </div>
            )}

            {/* Competition Info */}
            {pathwaySection === "competition" && (
              <CompetitionInfoSection scoringFormats={scoringFormats} timescales={competitionTimescales} />
            )}

            {/* Parental Guidance */}
            {pathwaySection === "parents" && (
              <div className="space-y-6">
                <div className="mb-2">
                  <h3 className="font-display text-xl font-bold text-foreground mb-2">Parental Behaviour Guide</h3>
                  <p className="text-muted-foreground font-body text-sm leading-relaxed">
                    Research shows that parental behaviour has a significant impact on a child's development and experience in competitive sport. Here's guidance from the LTA on how to best support your child.
                  </p>
                </div>
                <ParentalGuidanceSection
                  favourable={parentalGuidance.favourable}
                  unfavourable={parentalGuidance.unfavourable}
                />
                {/* Fair Play */}
                <div className="bg-suffolk-navy rounded-2xl p-8 text-center">
                  <h3 className="font-display text-3xl font-black text-primary-foreground mb-3">
                    Fair Play
                  </h3>
                  <p className="font-display text-xl text-lta-cyan font-bold mb-2">
                    If the ball touches ANY part of the line — it's IN
                  </p>
                  <p className="text-primary-foreground/60 text-sm font-body">
                    Learn more at{" "}
                    <a href="https://www.lta.org.uk/fairplay" target="_blank" rel="noopener noreferrer" className="text-lta-cyan underline">
                      lta.org.uk/fairplay
                    </a>
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "news" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="mb-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">News & Updates</h2>
              <p className="text-muted-foreground font-body">
                Latest news from the LTA — keeping you up to date with British tennis.
              </p>
            </div>

            {ltaLoading ? (
              <div className="text-center py-16 bg-card rounded-2xl border border-border">
                <div className="animate-spin w-8 h-8 border-2 border-lta-cyan border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-muted-foreground font-body">Loading latest LTA news…</p>
              </div>
            ) : ltaNews.length === 0 ? (
              <div className="text-center py-16 bg-card rounded-2xl border border-border">
                <Newspaper size={40} className="mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="font-display text-lg font-bold text-foreground mb-2">No news available</h3>
                <p className="text-muted-foreground font-body">
                  Check back soon for the latest LTA news and updates.
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ltaNews.map((article, i) => (
                  <motion.a
                    key={i}
                    href={article.articleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1"
                  >
                    {article.imageUrl && (
                      <div className="aspect-video overflow-hidden bg-muted">
                        <img
                          src={article.imageUrl}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-lta-cyan/10 text-lta-cyan uppercase">
                          {article.category}
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-foreground text-sm leading-snug mb-2 group-hover:text-lta-cyan transition-colors line-clamp-2">
                        {article.title}
                      </h3>
                      {article.summary && (
                        <p className="text-xs text-muted-foreground font-body leading-relaxed line-clamp-3">
                          {article.summary}
                        </p>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs text-lta-cyan font-medium mt-3">
                        Read on LTA.org.uk
                        <ExternalLink size={12} />
                      </span>
                    </div>
                  </motion.a>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "events" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                  {eventsFilter === "upcoming" ? "Upcoming Events" : "Past Events"}
                </h2>
                <p className="text-muted-foreground font-body">
                  {eventsFilter === "upcoming"
                    ? "Suffolk Tennis competitions, tours, camps and training sessions."
                    : "A look back at recent Suffolk Tennis events."}
                </p>
              </div>
              <div className="inline-flex p-1 rounded-xl bg-muted self-start">
                {(["upcoming", "past"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setEventsFilter(f)}
                    className={`px-4 py-2 rounded-lg text-sm font-display font-bold transition-all ${
                      eventsFilter === f
                        ? "bg-card text-lta-cyan shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f === "upcoming" ? "Upcoming" : "Past"}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const filtered = ltaEvents
                .filter((e) => {
                  const ref = new Date(e.endDate || e.date);
                  ref.setHours(0, 0, 0, 0);
                  return eventsFilter === "upcoming" ? ref >= today : ref < today;
                })
                .sort((a, b) => {
                  const da = new Date(a.date).getTime();
                  const db = new Date(b.date).getTime();
                  return eventsFilter === "upcoming" ? da - db : db - da;
                });

              if (eventsLoading) {
                return (
                  <div className="text-center py-16 bg-card rounded-2xl border border-border">
                    <div className="animate-spin w-8 h-8 border-2 border-lta-cyan border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-muted-foreground font-body">Loading events…</p>
                  </div>
                );
              }
              if (filtered.length === 0) {
                return (
                  <div className="text-center py-16 bg-card rounded-2xl border border-border">
                    <Calendar size={40} className="mx-auto mb-4 text-muted-foreground/30" />
                    <h3 className="font-display text-lg font-bold text-foreground mb-2">
                      {eventsFilter === "upcoming" ? "No upcoming events" : "No past events"}
                    </h3>
                    <p className="text-muted-foreground font-body">
                      {eventsFilter === "upcoming"
                        ? "Check back soon for upcoming Suffolk Tennis events."
                        : "Past events will appear here once they've taken place."}
                    </p>
                  </div>
                );
              }
              return (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((event, i) => (
                    <motion.a
                      key={`${event.title}-${event.date}`}
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`group bg-card border border-border rounded-2xl p-5 hover:shadow-lg transition-all hover:-translate-y-1 ${
                        eventsFilter === "past" ? "opacity-75" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-lta-cyan/10 text-lta-cyan">
                          {event.category}
                        </span>
                        {event.grade && (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                            {event.grade}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display font-bold text-foreground mb-3 leading-snug group-hover:text-lta-cyan transition-colors">
                        {event.title}
                      </h3>
                      <div className="space-y-1.5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="shrink-0" />
                          {new Date(event.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                          {event.endDate && event.endDate !== event.date && (
                            <> – {new Date(event.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={13} className="shrink-0" />
                          {event.location}
                        </div>
                      </div>
                      {event.ageGroups && event.ageGroups.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {event.ageGroups.map((ag) => (
                            <span key={ag} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {ag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 flex items-center gap-1 text-xs text-lta-cyan font-medium">
                        View on LTA <ExternalLink size={12} />
                      </div>
                    </motion.a>
                  ))}
                </div>
              );
            })()}

            <div className="text-center mt-8">
              <a
                href="https://competitions.lta.org.uk/find?DateFilterType=0&StartDate=2026-03-12&EndDate=2027-01-01&LocationFilterType=1&Distance=15&page=1&LocationCode=A090AB1B-D639-4765-92FC-6FE361EEFDB9"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-lta-cyan font-display font-bold hover:underline"
              >
                <Calendar size={16} />
                Browse all Suffolk events on LTA
                <ExternalLink size={14} />
              </a>
            </div>
          </motion.div>
        )}

      </main>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQrModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowQrModal(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-sm w-full text-center relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
              <h3 className="font-display font-bold text-gray-900 text-lg mb-2">Scan to Join</h3>
              <p className="text-gray-500 text-sm font-body mb-4">Scan this QR code to join the Suffolk Tennis Parent WhatsApp Community</p>
              <img src={whatsappQr} alt="WhatsApp QR Code" className="w-64 h-64 mx-auto mb-4" />
              <button
                type="button"
                onClick={openWhatsAppCommunity}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#25D366] text-white font-display font-bold text-sm hover:bg-[#20bd5a] transition-colors"
              >
                <MessageCircle size={16} />
                Or tap to join
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile bottom app bar — native-app navigation on phones. First four
          tabs are one tap; the rest live behind "More" as a bottom sheet. */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border pb-safe">
        <div className="grid grid-cols-5">
          {tabs.slice(0, 4).map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); window.scrollTo({ top: 0 }); }}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                activeTab === tab.id && !mobileMenuOpen ? "text-lta-cyan" : "text-muted-foreground"
              }`}
            >
              <tab.icon size={20} strokeWidth={activeTab === tab.id && !mobileMenuOpen ? 2.4 : 1.8} />
              {{ children: "Children", bookings: "Bookings", parent: "Parent", timetable: "Timetable" }[tab.id] ?? tab.label}
            </button>
          ))}
          <button
            onClick={() => setMobileMenuOpen((o) => !o)}
            className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
              mobileMenuOpen || tabs.slice(4).some((t) => t.id === activeTab) ? "text-lta-cyan" : "text-muted-foreground"
            }`}
            aria-expanded={mobileMenuOpen}
          >
            <Menu size={20} strokeWidth={1.8} />
            More
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="sm:hidden fixed inset-0 z-30 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="absolute bottom-0 inset-x-0 rounded-t-2xl bg-card border-t border-border p-3 pb-24"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-3" />
              {tabs.slice(4).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); window.scrollTo({ top: 0 }); }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-left transition-colors ${
                    activeTab === tab.id ? "bg-lta-cyan/10 text-lta-cyan" : "text-foreground hover:bg-muted"
                  }`}
                >
                  <tab.icon size={18} />
                  {tab.label}
                </button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ParentHub;
