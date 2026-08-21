import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import NewsSection from "@/components/NewsSection";
import PathwayIntroSection from "@/components/PathwayIntroSection";
import ProgramsSection from "@/components/ProgramsSection";
import EventsSection from "@/components/EventsSection";
import FeaturedEventsBanner from "@/components/FeaturedEventsBanner";
import BritishPlayerWatch from "@/components/BritishPlayerWatch";
import CoachesSection from "@/components/CoachesSection";

import PlayerWatchSection from "@/components/PlayerWatchSection";
import FacilitiesSection from "@/components/FacilitiesSection";
import { lazy, Suspense } from "react";

// The interactive map (MapLibre ~1MB) sits below the fold — loading it lazily
// keeps the homepage's first paint light, especially on mobile.
const SuffolkMapSection = lazy(() => import("@/components/SuffolkMapSection"));
import ContactSection from "@/components/ContactSection";
import SponsorsSection from "@/components/SponsorsSection";
import Footer from "@/components/Footer";

const Index = () => {
  const location = useLocation();

  useEffect(() => {
    const scrollTarget = (location.state as any)?.scrollTo;
    if (scrollTarget) {
      setTimeout(() => {
        document.getElementById(scrollTarget)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      // Clear the state so it doesn't re-scroll on re-renders
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  return (
  <>
    <Navbar />
    <HeroSection />
    <PathwayIntroSection />
    <ProgramsSection />
    <NewsSection />
    <FeaturedEventsBanner />
    <EventsSection />
    <PlayerWatchSection />
    <BritishPlayerWatch />
    <CoachesSection />
    
    <FacilitiesSection />
    <Suspense fallback={<div className="min-h-[400px]" />}>
      <SuffolkMapSection />
    </Suspense>
    <ContactSection />
    <SponsorsSection />
    <Footer />
  </>
  );
};
export default Index;

