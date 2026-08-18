import { Building2, UserRound, MoreHorizontal } from "lucide-react";
import { HOME_CLUB_OPTIONS, OTHER_CLUB } from "./homeClubs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Props = {
  homeClub: string;
  customClub: string;
  currentCoach: string;
  onHomeClubChange: (v: string) => void;
  onCustomClubChange: (v: string) => void;
  onCurrentCoachChange: (v: string) => void;
};

const ClubLogo = ({ src, name }: { src?: string; name: string }) => (
  <div className="w-7 h-7 rounded-md bg-white border border-border flex items-center justify-center shrink-0 overflow-hidden">
    {src ? (
      <img src={src} alt={`${name} logo`} className="w-full h-full object-contain p-0.5" />
    ) : (
      <Building2 size={14} className="text-lta-cyan" />
    )}
  </div>
);

const ClubAndCoachSection = ({
  homeClub,
  customClub,
  currentCoach,
  onHomeClubChange,
  onCustomClubChange,
  onCurrentCoachChange,
}: Props) => {
  const isOther = homeClub === OTHER_CLUB;

  return (
    <div className="bg-lta-cyan/5 border border-lta-cyan/20 rounded-2xl p-5 space-y-4">
      <p className="text-sm font-display font-bold text-foreground flex items-center gap-2">
        <Building2 size={16} className="text-lta-cyan" /> Club &amp; Coach
      </p>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
          <Building2 size={12} className="text-lta-cyan" /> Home tennis club
        </label>
        <Select value={homeClub || undefined} onValueChange={onHomeClubChange}>
          <SelectTrigger className="w-full bg-muted border-border rounded-xl h-11 text-sm">
            <SelectValue placeholder="Select your child's home club…" />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {HOME_CLUB_OPTIONS.map((c) => (
              <SelectItem key={c.name} value={c.name} className="py-2">
                <div className="flex items-center gap-2.5">
                  <ClubLogo src={c.logo} name={c.name} />
                  <span className="font-medium">{c.name}</span>
                </div>
              </SelectItem>
            ))}
            <SelectItem value={OTHER_CLUB} className="py-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-muted border border-dashed border-border flex items-center justify-center shrink-0">
                  <MoreHorizontal size={14} className="text-muted-foreground" />
                </div>
                <span className="font-medium">Other (type below)</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        {isOther && (
          <input
            value={customClub}
            onChange={(e) => onCustomClubChange(e.target.value)}
            placeholder="Type your club name"
            className="mt-2 w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-lta-cyan/50 text-sm"
          />
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
          <UserRound size={12} className="text-lta-cyan" /> Current coach
        </label>
        <input
          value={currentCoach}
          onChange={(e) => onCurrentCoachChange(e.target.value)}
          placeholder="Coach's full name"
          className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-lta-cyan/50 text-sm"
        />
      </div>
    </div>
  );
};

export default ClubAndCoachSection;
