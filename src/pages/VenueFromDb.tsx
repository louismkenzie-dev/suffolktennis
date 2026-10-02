// /clubs/:slug and /venues/:slug for any club or venue added in Admin →
// Website → Venues. The hand-built pages (Framlingham, Culford, …) keep their
// own routes, which React Router ranks above these; everything else is drawn
// from the venues row so a new club works the moment it is published.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import FeederClubPage from "@/components/FeederClubPage";
import NotFound from "@/pages/NotFound";

type Venue = {
  name: string; tagline: string | null; logo_url: string | null; website_url: string | null;
  address: string | null; location: string | null; intro: string | null; detail: string | null;
  highlights: { label: string }[] | null; venue_type: "partner" | "feeder";
};

const VenueFromDb = () => {
  const { slug } = useParams();
  const [venue, setVenue] = useState<Venue | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    supabase.from("venues")
      .select("name, tagline, logo_url, website_url, address, location, intro, detail, highlights, venue_type")
      .eq("slug", slug ?? "").eq("published", true).maybeSingle()
      .then(({ data }) => { if (live) setVenue((data as unknown as Venue) ?? null); });
    return () => { live = false; };
  }, [slug]);

  useEffect(() => { if (venue) document.title = `${venue.name} — Suffolk Tennis`; }, [venue]);

  if (venue === undefined) return <div className="min-h-screen bg-background" />;
  if (venue === null) return <NotFound />;

  const partner = venue.venue_type === "partner";
  return (
    <FeederClubPage
      name={venue.name}
      tagline={venue.tagline || (partner ? "Partner Venue" : "Feeder Club")}
      logo={venue.logo_url || undefined}
      externalUrl={venue.website_url || undefined}
      address={venue.address || venue.location || undefined}
      about={[venue.intro, venue.detail].filter((p): p is string => !!p?.trim())}
      highlights={(venue.highlights ?? []).map((h) => h.label).filter(Boolean)}
      partner={partner}
    />
  );
};

export default VenueFromDb;
