// The Coach Hub: Venues → Programme → Session → Register. Every /coach/*
// route lands here and the URL decides which page renders; the pages
// themselves live in src/components/coach.
import { useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { EmptyState, SkeletonRows } from "@/components/app";
import { VenuesPage } from "@/components/coach/VenuesPage";
import { ProgrammesPage } from "@/components/coach/ProgrammesPage";
import { SessionsPage } from "@/components/coach/SessionsPage";
import { RegisterPage } from "@/components/coach/RegisterPage";

const CoachHub = () => {
  const { user, loading: authLoading } = useAuth();
  const { canScan, loading: roleLoading } = useIsAdmin();
  const params = useParams<{ venue?: string; eventId?: string; sessionId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  if (authLoading || roleLoading) {
    return (
      <div className="app-shell min-h-screen bg-background">
        <div className="h-14 border-b border-border" />
        <div className="mx-auto max-w-md space-y-3 px-4 py-5"><SkeletonRows rows={4} avatar={false} /></div>
      </div>
    );
  }
  // Signed out: the effect above is already redirecting to /auth.
  if (!user) return null;
  if (!canScan) {
    return (
      <div className="app-shell min-h-screen bg-background">
        <div className="mx-auto max-w-md px-6 py-24">
          <EmptyState icon={Shield} title="Staff access required" description="Only Suffolk Tennis coaches and admins can open the register." action={<Button asChild variant="outline"><Link to="/">Back to site</Link></Button>} />
        </div>
      </div>
    );
  }

  // Session-less event register: /coach/register/event/:eventId
  if (location.pathname.startsWith("/coach/register/event/") && params.eventId) {
    return <RegisterPage key={`event:${params.eventId}`} eventId={params.eventId} />;
  }
  // Session register: /coach/register/:sessionId (event id hint via router state)
  if (params.sessionId) {
    const hint = (location.state as { eventId?: string } | null)?.eventId;
    return <RegisterPage key={`session:${params.sessionId}`} sessionId={params.sessionId} eventId={hint} />;
  }
  if (params.eventId) return <SessionsPage key={params.eventId} eventId={params.eventId} />;
  // React Router hands params back already decoded.
  if (params.venue) return <ProgrammesPage key={params.venue} venue={params.venue} />;
  return <VenuesPage />;
};

export default CoachHub;
