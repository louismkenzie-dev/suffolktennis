import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation, Car, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { SUFFOLK_CLUBS, type SuffolkClub } from "@/data/suffolkClubs";
import { toast } from "sonner";

type Result = SuffolkClub & {
  distance_meters: number | null;
  duration_seconds: number | null;
  reachable: boolean;
};

const fmtMiles = (m: number | null) => m == null ? "—" : `${(m / 1609.344).toFixed(1)} mi`;
const fmtDuration = (s: number | null) => {
  if (s == null) return "—";
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return `${h}h ${m}m`;
};

export default function NearestClubs({ postcode }: { postcode: string | null }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [origin, setOrigin] = useState<{ formatted: string; postcode: string } | null>(null);

  const lookup = async () => {
    if (!postcode || postcode.trim().length < 5) {
      toast.error("Enter your home postcode first");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("nearest-clubs", {
        body: { postcode, clubs: SUFFOLK_CLUBS },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data.results);
      setOrigin(data.origin);
    } catch (e) {
      toast.error((e as Error).message || "Could not look up nearest clubs");
    } finally {
      setLoading(false);
    }
  };

  const lead = (results ?? []).filter((r) => r.type === "lead");
  const feeder = (results ?? []).filter((r) => r.type === "feeder");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Navigation className="w-4 h-4 text-lta-cyan" />
          Your nearest Suffolk Tennis clubs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Uses your home postcode to estimate driving distance and time to our Lead Venues and Feeder Clubs.
        </p>
        <Button
          onClick={lookup}
          disabled={loading || !postcode}
          className="bg-lta-cyan hover:bg-lta-cyan/90 text-suffolk-navy"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MapPin className="w-4 h-4 mr-2" />}
          {results ? "Refresh distances" : "Find nearest clubs"}
        </Button>

        {origin && (
          <p className="text-xs text-muted-foreground">
            From <span className="font-medium text-foreground">{origin.postcode}</span>
          </p>
        )}

        {results && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <Section title="Lead Venues / Performance Hubs" rows={lead} highlight />
            <Section title="Feeder Clubs" rows={feeder} />
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, rows, highlight }: { title: string; rows: Result[]; highlight?: boolean }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
        {highlight && <Star className="w-3.5 h-3.5 text-lta-yellow" />}
        {title}
      </h4>
      <div className="divide-y rounded-lg border bg-card">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between p-3 gap-4">
            <div className="min-w-0">
              <p className="font-medium truncate">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.postcode}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="gap-1">
                <Navigation className="w-3 h-3" />
                {fmtMiles(r.distance_meters)}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Car className="w-3 h-3" />
                {fmtDuration(r.duration_seconds)}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
