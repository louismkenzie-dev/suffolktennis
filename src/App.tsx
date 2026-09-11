import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Every page except the homepage is code-split: the first paint ships only
// the shell + homepage, and each section loads on demand (then caches via the
// service worker). This is what keeps the mobile app feel snappy.
//
// lazyWithRetry, not lazy: a deploy renames every chunk, so a tab that was
// already open asks for one that has gone and the import rejects. That used to
// surface as the "Something went wrong" boundary; it now reloads itself once.
const VenueDavidLloyd = lazyWithRetry(() => import("./pages/VenueDavidLloyd"));
const VenueIpswichSports = lazyWithRetry(() => import("./pages/VenueIpswichSports"));
const VenueCulford = lazyWithRetry(() => import("./pages/VenueCulford"));
const Venues = lazyWithRetry(() => import("./pages/Venues"));
const TourRed = lazyWithRetry(() => import("./pages/TourRed"));
const TourOrange = lazyWithRetry(() => import("./pages/TourOrange"));
const TourGreen = lazyWithRetry(() => import("./pages/TourGreen"));
const TourYellow = lazyWithRetry(() => import("./pages/TourYellow"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const ParentHub = lazyWithRetry(() => import("./pages/ParentHub"));
const AdminHub = lazyWithRetry(() => import("./pages/AdminHub"));
const ClubEastBergholt = lazyWithRetry(() => import("./pages/ClubEastBergholt"));
const ClubNewmarket = lazyWithRetry(() => import("./pages/ClubNewmarket"));
const ClubStowmarket = lazyWithRetry(() => import("./pages/ClubStowmarket"));
const ClubFelixstowe = lazyWithRetry(() => import("./pages/ClubFelixstowe"));
const ClubWoodbridge = lazyWithRetry(() => import("./pages/ClubWoodbridge"));
const ClubFramlingham = lazyWithRetry(() => import("./pages/ClubFramlingham"));
const Contact = lazyWithRetry(() => import("./pages/Contact"));
const Events = lazyWithRetry(() => import("./pages/Events"));
const RisingStars = lazyWithRetry(() => import("./pages/RisingStars"));
const Programs = lazyWithRetry(() => import("./pages/Programs"));
const Unsubscribe = lazyWithRetry(() => import("./pages/Unsubscribe"));
const Workshops = lazyWithRetry(() => import("./pages/Workshops"));
const BookingPage = lazyWithRetry(() => import("./pages/BookingPage"));
const BookingReturn = lazyWithRetry(() => import("./pages/BookingReturn"));
const TicketPage = lazyWithRetry(() => import("./pages/TicketPage"));
const AdminScan = lazyWithRetry(() => import("./pages/AdminScan"));
const CoachHub = lazyWithRetry(() => import("./pages/CoachHub"));
const CoachJoinPage = lazyWithRetry(() => import("./pages/CoachJoinPage"));
const ReportPage = lazyWithRetry(() => import("./pages/ReportPage"));
const MiniMasters = lazyWithRetry(() => import("./pages/MiniMasters"));
const TennisGP = lazyWithRetry(() => import("./pages/TennisGP"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen bg-suffolk-navy flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-lta-cyan" />
  </div>
);

const App = () => (
  <AppErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/parent-hub" element={<ParentHub />} />
            <Route path="/admin" element={<AdminHub />} />
            <Route path="/admin/scan" element={<AdminScan />} />
            <Route path="/coach" element={<CoachHub />} />
            <Route path="/coach/venue/:venue" element={<CoachHub />} />
            <Route path="/coach/programme/:eventId" element={<CoachHub />} />
            <Route path="/coach/register/:sessionId" element={<CoachHub />} />
            <Route path="/coach/register/event/:eventId" element={<CoachHub />} />
            <Route path="/coach/join/:token" element={<CoachJoinPage />} />
            <Route path="/report/:reportId" element={<ReportPage />} />
            <Route path="/book/:token" element={<BookingPage />} />
            <Route path="/booking/return" element={<BookingReturn />} />
            <Route path="/ticket/:qrToken" element={<TicketPage />} />
            <Route path="/venues" element={<Venues />} />
            <Route path="/venues/david-lloyd" element={<VenueDavidLloyd />} />
            <Route path="/venues/ipswich-sports-club" element={<VenueIpswichSports />} />
            <Route path="/venues/culford" element={<VenueCulford />} />
            <Route path="/clubs/east-bergholt" element={<ClubEastBergholt />} />
            <Route path="/clubs/newmarket" element={<ClubNewmarket />} />
            <Route path="/clubs/stowmarket" element={<ClubStowmarket />} />
            <Route path="/clubs/felixstowe" element={<ClubFelixstowe />} />
            <Route path="/clubs/woodbridge" element={<ClubWoodbridge />} />
            <Route path="/clubs/framlingham" element={<ClubFramlingham />} />
            <Route path="/programs" element={<Programs />} />
            <Route path="/programs/red-tour" element={<TourRed />} />
            <Route path="/programs/orange-tour" element={<TourOrange />} />
            <Route path="/programs/green-tour" element={<TourGreen />} />
            <Route path="/programs/yellow-tour" element={<TourYellow />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/rising-stars" element={<RisingStars />} />
            <Route path="/events/workshops" element={<Workshops />} />
            <Route path="/events/mini-masters" element={<MiniMasters />} />
            <Route path="/events/tennis-gp" element={<TennisGP />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
