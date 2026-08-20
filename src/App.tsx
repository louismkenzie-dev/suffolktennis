import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import VenueDavidLloyd from "./pages/VenueDavidLloyd";
import VenueIpswichSports from "./pages/VenueIpswichSports";
import VenueCulford from "./pages/VenueCulford";
import Venues from "./pages/Venues";
import TourRed from "./pages/TourRed";
import TourOrange from "./pages/TourOrange";
import TourGreen from "./pages/TourGreen";
import TourYellow from "./pages/TourYellow";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import ParentHub from "./pages/ParentHub";
import AdminHub from "./pages/AdminHub";
import ClubEastBergholt from "./pages/ClubEastBergholt";
import ClubNewmarket from "./pages/ClubNewmarket";
import ClubStowmarket from "./pages/ClubStowmarket";
import ClubFelixstowe from "./pages/ClubFelixstowe";
import ClubWoodbridge from "./pages/ClubWoodbridge";
import ClubFramlingham from "./pages/ClubFramlingham";
import Contact from "./pages/Contact";
import Events from "./pages/Events";
import RisingStars from "./pages/RisingStars";
import Programs from "./pages/Programs";
import Unsubscribe from "./pages/Unsubscribe";
import Workshops from "./pages/Workshops";
import BookingPage from "./pages/BookingPage";
import BookingReturn from "./pages/BookingReturn";
import TicketPage from "./pages/TicketPage";
import AdminScan from "./pages/AdminScan";
import MiniMasters from "./pages/MiniMasters";
import TennisGP from "./pages/TennisGP";

const queryClient = new QueryClient();

const App = () => (
  <AppErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
