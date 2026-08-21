import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Every page except the homepage is code-split: the first paint ships only
// the shell + homepage, and each section loads on demand (then caches via the
// service worker). This is what keeps the mobile app feel snappy.
const VenueDavidLloyd = lazy(() => import("./pages/VenueDavidLloyd"));
const VenueIpswichSports = lazy(() => import("./pages/VenueIpswichSports"));
const VenueCulford = lazy(() => import("./pages/VenueCulford"));
const Venues = lazy(() => import("./pages/Venues"));
const TourRed = lazy(() => import("./pages/TourRed"));
const TourOrange = lazy(() => import("./pages/TourOrange"));
const TourGreen = lazy(() => import("./pages/TourGreen"));
const TourYellow = lazy(() => import("./pages/TourYellow"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ParentHub = lazy(() => import("./pages/ParentHub"));
const AdminHub = lazy(() => import("./pages/AdminHub"));
const ClubEastBergholt = lazy(() => import("./pages/ClubEastBergholt"));
const ClubNewmarket = lazy(() => import("./pages/ClubNewmarket"));
const ClubStowmarket = lazy(() => import("./pages/ClubStowmarket"));
const ClubFelixstowe = lazy(() => import("./pages/ClubFelixstowe"));
const ClubWoodbridge = lazy(() => import("./pages/ClubWoodbridge"));
const ClubFramlingham = lazy(() => import("./pages/ClubFramlingham"));
const Contact = lazy(() => import("./pages/Contact"));
const Events = lazy(() => import("./pages/Events"));
const RisingStars = lazy(() => import("./pages/RisingStars"));
const Programs = lazy(() => import("./pages/Programs"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Workshops = lazy(() => import("./pages/Workshops"));
const BookingPage = lazy(() => import("./pages/BookingPage"));
const BookingReturn = lazy(() => import("./pages/BookingReturn"));
const TicketPage = lazy(() => import("./pages/TicketPage"));
const AdminScan = lazy(() => import("./pages/AdminScan"));
const MiniMasters = lazy(() => import("./pages/MiniMasters"));
const TennisGP = lazy(() => import("./pages/TennisGP"));

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
