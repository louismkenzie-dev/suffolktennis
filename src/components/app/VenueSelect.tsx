import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type VenueOption = { name: string; venue_type: "partner" | "feeder" };
const OTHER = "__other__";

let cache: VenueOption[] | null = null;

/**
 * Venue picker fed by the Venues tab: partner venues first, then feeder
 * clubs, with an "Other venue" escape hatch that reveals a text field. The
 * value is the plain venue name, so everything downstream (sessions, maps,
 * emails) keeps working with free text.
 */
export function VenueSelect({ value, onChange, placeholder = "Choose a venue", id }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [venues, setVenues] = useState<VenueOption[]>(cache ?? []);
  const [other, setOther] = useState(false);

  useEffect(() => {
    if (cache) return;
    (supabase as any).from("venues").select("name, venue_type, published, display_order")
      .order("venue_type", { ascending: false }).order("display_order")
      .then(({ data, error }: { data: Array<VenueOption & { published: boolean }> | null; error: unknown }) => {
        // A failed or empty load must not be remembered for the rest of the
        // session: it left the picker offering nothing but "Other venue…"
        // until the page was reloaded, which read as the venues being gone.
        const list = (data ?? []).filter((v) => v.published).map(({ name, venue_type }) => ({ name, venue_type }));
        if (!error && list.length > 0) cache = list;
        setVenues(list);
      });
  }, []);

  const known = venues.some((v) => v.name === value);
  const showOther = other || (!!value && venues.length > 0 && !known);
  const partners = venues.filter((v) => v.venue_type === "partner");
  const feeders = venues.filter((v) => v.venue_type === "feeder");

  return (
    <div className="space-y-2">
      <Select
        value={showOther ? OTHER : value || undefined}
        onValueChange={(v) => {
          if (v === OTHER) { setOther(true); if (known) onChange(""); return; }
          setOther(false);
          onChange(v);
        }}
      >
        <SelectTrigger id={id}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {partners.length > 0 && (
            <SelectGroup>
              <SelectLabel>Partner venues</SelectLabel>
              {partners.map((v) => <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>)}
            </SelectGroup>
          )}
          {feeders.length > 0 && (
            <SelectGroup>
              <SelectLabel>Feeder clubs</SelectLabel>
              {feeders.map((v) => <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>)}
            </SelectGroup>
          )}
          <SelectItem value={OTHER}>Other venue…</SelectItem>
        </SelectContent>
      </Select>
      {showOther && (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Type the venue name" autoFocus={other} />
      )}
    </div>
  );
}
