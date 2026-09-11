import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  User, Newspaper, Calendar, Trophy, Clock, MapPin, ExternalLink, BookOpen, Users, Shield, CalendarDays, X, MessageCircle,
  Ticket as TicketIcon, UsersRound, QrCode,
} from "lucide-react";
import MyChildrenSection from "@/components/children/MyChildrenSection";
import SportingTimetable from "@/components/timetable/SportingTimetable";
import ParentDetailsSection from "@/components/parent/ParentDetailsSection";
import MyBookingsSection from "@/components/parent/MyBookingsSection";
import ProfileCompletionBanner from "@/components/parent/ProfileCompletionBanner";
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
import { AppShell, type NavItem, PageHeader, Chip, ChipRow, SegmentedControl, EmptyState, SkeletonCards } from "@/components/app";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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

type HubTab = "children" | "bookings" | "parent" | "timetable" | "pathway" | "news" | "events";
const TAB_IDS: HubTab[] = ["children", "bookings", "parent", "timetable", "pathway", "news", "events"];

const NAV: NavItem[] = [
  { id: "children", label: "My Children", short: "Children", icon: UsersRound },
  { id: "bookings", label: "Bookings & Invitations", short: "Bookings", icon: TicketIcon },
  { id: "timetable", label: "Sporting Timetable", short: "Timetable", icon: CalendarDays },
  { id: "pathway", label: "LTA Pathway", short: "Pathway", icon: Trophy },
  { id: "news", label: "News & Updates", icon: Newspaper },
  { id: "events", label: "Upcoming Events", icon: Calendar },
  { id: "parent", label: "Parent Details", icon: User },
];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
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
  const [activeTab, setActiveTab] = useState<HubTab>(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return TAB_IDS.includes(t as HubTab) ? (t as HubTab) : "children";
  });
  const [showQrModal, setShowQrModal] = useState(false);
  const [pathwaySection, setPathwaySection] = useState<"overview" | "9u10u" | "11u14u" | "context" | "competition" | "parents">("overview");
  const [showWhatsApp, setShowWhatsApp] = useState(() => {
    try { return localStorage.getItem("whatsapp-banner-dismissed") !== "true"; } catch { return true; }
  });

  const dismissWhatsApp = () => {
    setShowWhatsApp(false);
    try { localStorage.setItem("whatsapp-banner-dismissed", "true"); } catch { /* private mode */ }
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
      .catch(() => { /* the section shows an empty state */ })
      .finally(() => setLtaLoading(false));

    supabase.functions.invoke('lta-events', { method: 'POST' })
      .then(({ data }) => { if (data?.events) setLtaEvents(data.events); })
      .catch(() => { /* the section shows an empty state */ })
      .finally(() => setEventsLoading(false));
  }, [user]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") !== activeTab) {
      url.searchParams.set("tab", activeTab);
      window.history.replaceState(null, "", url.toString());
    }
  }, [activeTab]);

  if (loading) {
    return (
      <div className="app-shell min-h-screen bg-background">
        <div className="h-14 border-b border-border" />
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6"><SkeletonCards count={2} /></div>
      </div>
    );
  }

  const pathwaySections = [
    { id: "overview" as const, label: "Overview", icon: Trophy },
    { id: "9u10u" as const, label: "9U / 10U", icon: BookOpen },
    { id: "11u14u" as const, label: "11U–14U", icon: BookOpen },
    { id: "context" as const, label: "Training Guide", icon: BookOpen },
    { id: "competition" as const, label: "Competitions", icon: Shield },
    { id: "parents" as const, label: "Parent Guide", icon: Users },
  ];

  const current = NAV.find((n) => n.id === activeTab);
  const firstName = profile?.first_name || "";

  return (
    <AppShell
      role="parent"
      title={current?.short ?? current?.label ?? "Parent Hub"}
      nav={NAV}
      primary={["children", "bookings", "timetable", "pathway"]}
      active={activeTab}
      onNavigate={(id) => setActiveTab(id as HubTab)}
      userName={profile ? `${profile.first_name} ${profile.last_name}`.trim() : null}
      userEmail={user?.email}
      onSignOut={async () => { await signOut(); navigate("/"); }}
      topActions={undefined}
    >
      {activeTab === "children" && (
        <PageHeader
          eyebrow={firstName ? `${greeting()}, ${firstName}` : greeting()}
          title="My Children"
          description={profile?.player_name
            ? `Track ${profile.player_name}'s journey through the LTA Performance Pathway.`
            : "Your children's profiles, reports and progress in one place."}
        />
      )}

      <ProfileCompletionBanner
        onGoToParent={() => setActiveTab("parent")}
        onGoToChildren={() => setActiveTab("children")}
      />

      {activeTab === "children" && (
        <>
          <AnimatePresence initial={false}>
            {showWhatsApp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-5 overflow-hidden md:mb-7"
              >
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 text-[#1da851]">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <button type="button" onClick={openWhatsAppCommunity} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[15px] font-medium text-foreground">Parent WhatsApp community</p>
                    <p className="truncate text-[13px] text-muted-foreground">Updates and chat with other Suffolk Tennis parents</p>
                  </button>
                  <Button size="sm" variant="tonal" className="hidden sm:inline-flex" onClick={() => setShowQrModal(true)}>
                    <QrCode className="h-4 w-4" /> QR
                  </Button>
                  <Button size="sm" onClick={openWhatsAppCommunity} className="bg-[#1da851] hover:bg-[#188f45]">Join</Button>
                  <button type="button" onClick={dismissWhatsApp} aria-label="Dismiss" className="hit-area -mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <MyChildrenSection />
        </>
      )}
      {activeTab === "bookings" && <MyBookingsSection />}
      {activeTab === "parent" && <ParentDetailsSection />}
      {activeTab === "timetable" && <SportingTimetable />}

      {activeTab === "pathway" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <PageHeader
            title="LTA Player Pathway"
            hideTitleOnPhone
            description="A world-class pathway from 7 to 18 and beyond. Choose a section below."
          />

          <ChipRow className="mb-6">
            {pathwaySections.map((sec) => (
              <Chip key={sec.id} active={pathwaySection === sec.id} onClick={() => setPathwaySection(sec.id)} icon={sec.icon}>{sec.label}</Chip>
            ))}
          </ChipRow>

          {pathwaySection === "overview" && (
            <div className="space-y-8">
              <div className="aspect-video max-w-3xl overflow-hidden rounded-2xl bg-muted">
                <iframe
                  src="https://www.youtube.com/embed/RMIjgT2rhcI?rel=0"
                  title="The Player Pathway Journey"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {pathwayStages.map((stage, i) => (
                  <motion.a
                    key={stage.age}
                    href={stage.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.2 }}
                    className="group press relative rounded-2xl border border-border bg-card p-5 shadow-card transition-colors hover:bg-muted/40"
                  >
                    <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${stage.color} font-display text-sm font-semibold text-white`}>
                      {stage.age}
                    </div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{stage.stage}</p>
                    <h3 className="mb-1 font-display font-semibold text-foreground">{stage.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{stage.description}</p>
                    <ExternalLink size={14} className="absolute right-5 top-5 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                  </motion.a>
                ))}
              </div>

              <div className="rounded-2xl bg-suffolk-navy p-6 text-primary-foreground md:p-8">
                <h3 className="mb-5 font-display text-xl font-semibold md:text-2xl">Key performance highlights</h3>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { num: "1", text: "First time five British men in ATP doubles top 10 rankings — first time in 32 years for ANY nation" },
                    { num: "2", text: "23 British players in Wimbledon main singles draw for 1st time since 1984. Sonay Kartal into 4th round of Grand Slam for 1st time" },
                    { num: "3", text: "Jack Draper broke into the top 5 of the men's world rankings — first to do so since Andy Murray" },
                    { num: "4", text: "Julian Cash & Lloyd Glasspool won seven titles, including their first Grand Slam at Wimbledon" },
                    { num: "5", text: "GB reached the semi-finals of the BJKC in Shenzhen — making it 3 times in the last 4 years" },
                    { num: "6", text: "Francesca Jones the 5th woman in the top 100 this year, 8th since end of 2021" },
                  ].map((item) => (
                    <div key={item.num} className="flex gap-4">
                      <span className="font-display text-3xl font-semibold text-lta-cyan tabular">{item.num}</span>
                      <p className="text-sm leading-relaxed text-primary-foreground/80">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {pathwaySection === "9u10u" && (
            <div className="space-y-6">
              <PathwayProgressionTable {...weeklyHours9U10U} />
              <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
                <h4 className="mb-1 font-display font-semibold text-foreground">Important note</h4>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  More important than these recommendations is having a credible and accredited coach who is driven to lead on accelerating the player's development, that rest and recovery is factored in, and the player is accessing a thriving developmental training environment where player well-being is at the forefront.
                </p>
              </div>
            </div>
          )}

          {pathwaySection === "11u14u" && (
            <div className="space-y-6">
              <PathwayProgressionTable {...weeklyHours11U14U} />
              <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
                <h4 className="mb-1 font-display font-semibold text-foreground">Important note</h4>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  More important than these recommendations is having a credible and accredited Performance Coach leading on the player's development, that rest and recovery is factored in, and the player is accessing a thriving developmental training environment where player well-being is at the forefront.
                </p>
              </div>
            </div>
          )}

          {pathwaySection === "context" && (
            <div className="space-y-6">
              <TrainingContextSection title="Training Context — 9U / 10U" items={trainingContext9U10U} />
              <TrainingContextSection title="Training Context — 11U / 12U / 14U" items={trainingContext11U14U} />
            </div>
          )}

          {pathwaySection === "competition" && (
            <CompetitionInfoSection scoringFormats={scoringFormats} timescales={competitionTimescales} />
          )}

          {pathwaySection === "parents" && (
            <div className="space-y-6">
              <div>
                <h3 className="mb-1 font-display text-lg font-semibold text-foreground">Parental behaviour guide</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Research shows that parental behaviour has a significant impact on a child's development and experience in competitive sport. Here's guidance from the LTA on how to best support your child.
                </p>
              </div>
              <ParentalGuidanceSection
                favourable={parentalGuidance.favourable}
                unfavourable={parentalGuidance.unfavourable}
              />
              <div className="rounded-2xl bg-suffolk-navy p-6 text-center md:p-8">
                <h3 className="mb-2 font-display text-2xl font-semibold text-primary-foreground">Fair Play</h3>
                <p className="mb-2 font-display text-lg font-semibold text-lta-cyan">If the ball touches ANY part of the line — it's IN</p>
                <p className="text-sm text-primary-foreground/60">
                  Learn more at{" "}
                  <a href="https://www.lta.org.uk/fairplay" target="_blank" rel="noopener noreferrer" className="text-lta-cyan underline">lta.org.uk/fairplay</a>
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === "news" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <PageHeader title="News & Updates" hideTitleOnPhone description="The latest from the LTA, keeping you up to date with British tennis." />
          {ltaLoading ? (
            <SkeletonCards count={3} />
          ) : ltaNews.length === 0 ? (
            <EmptyState icon={Newspaper} title="No news right now" description="Check back soon for the latest LTA news and updates." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ltaNews.map((article, i) => (
                <motion.a
                  key={i}
                  href={article.articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  className="group press overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-colors hover:bg-muted/30"
                >
                  {article.imageUrl && (
                    <div className="aspect-video overflow-hidden bg-muted">
                      <img src={article.imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
                    </div>
                  )}
                  <div className="p-4 md:p-5">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{article.category}</p>
                    <h3 className="mb-1.5 font-display text-[15px] font-semibold leading-snug text-foreground line-clamp-2">{article.title}</h3>
                    {article.summary && <p className="text-[13px] leading-relaxed text-muted-foreground line-clamp-3">{article.summary}</p>}
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">Read on LTA.org.uk <ExternalLink size={12} /></span>
                  </div>
                </motion.a>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {activeTab === "events" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <PageHeader
            title={eventsFilter === "upcoming" ? "Upcoming Events" : "Past Events"}
            hideTitleOnPhone
            description={eventsFilter === "upcoming" ? "Suffolk Tennis competitions, tours, camps and training sessions." : "A look back at recent Suffolk Tennis events."}
            actions={
              <SegmentedControl
                value={eventsFilter}
                onChange={(v) => setEventsFilter(v as typeof eventsFilter)}
                options={[{ value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }]}
                className="w-full md:w-56"
              />
            }
          />

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
                const dbb = new Date(b.date).getTime();
                return eventsFilter === "upcoming" ? da - dbb : dbb - da;
              });

            if (eventsLoading) return <SkeletonCards count={3} />;
            if (filtered.length === 0) {
              return (
                <EmptyState
                  icon={Calendar}
                  title={eventsFilter === "upcoming" ? "No upcoming events" : "No past events"}
                  description={eventsFilter === "upcoming" ? "Check back soon for upcoming Suffolk Tennis events." : "Past events will appear here once they've taken place."}
                />
              );
            }
            return (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((event, i) => (
                  <motion.a
                    key={`${event.title}-${event.date}`}
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    className={`group press rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:bg-muted/30 md:p-5 ${eventsFilter === "past" ? "opacity-75" : ""}`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{event.category}</span>
                      {event.grade && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{event.grade}</span>}
                    </div>
                    <h3 className="mb-3 font-display text-[15px] font-semibold leading-snug text-foreground">{event.title}</h3>
                    <div className="space-y-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="shrink-0" />
                        {new Date(event.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                        {event.endDate && event.endDate !== event.date && (
                          <> – {new Date(event.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</>
                        )}
                      </div>
                      <div className="flex items-center gap-2"><MapPin size={14} className="shrink-0" />{event.location}</div>
                    </div>
                    {event.ageGroups && event.ageGroups.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {event.ageGroups.map((ag) => (
                          <span key={ag} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{ag}</span>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary">View on LTA <ExternalLink size={12} /></div>
                  </motion.a>
                ))}
              </div>
            );
          })()}

          <div className="mt-8 text-center">
            <a
              href="https://competitions.lta.org.uk/find?DateFilterType=0&StartDate=2026-03-12&EndDate=2027-01-01&LocationFilterType=1&Distance=15&page=1&LocationCode=A090AB1B-D639-4765-92FC-6FE361EEFDB9"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Calendar size={16} /> Browse all Suffolk events on LTA <ExternalLink size={14} />
            </a>
          </div>
        </motion.div>
      )}

      {/* WhatsApp QR (desktop) */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="text-center md:max-w-sm">
          <DialogHeader className="items-center text-center">
            <DialogTitle>Scan to join</DialogTitle>
            <DialogDescription>Scan this code to join the Suffolk Tennis Parent WhatsApp community.</DialogDescription>
          </DialogHeader>
          <img src={whatsappQr} alt="WhatsApp QR code" className="mx-auto h-56 w-56" />
          <Button onClick={openWhatsAppCommunity} className="bg-[#1da851] hover:bg-[#188f45]"><MessageCircle className="h-4 w-4" /> Or tap to join</Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default ParentHub;
