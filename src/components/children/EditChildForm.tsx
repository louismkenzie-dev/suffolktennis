import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { X, Upload, Star, Zap, Trophy, ExternalLink, Hand, CreditCard, RefreshCw } from "lucide-react";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import Combobox from "./Combobox";
import HealthNeedsFields from "./HealthNeedsFields";
import { getPlayerFlag } from "./playerCountries";
import ClubAndCoachSection from "./ClubAndCoachSection";
import { HOME_CLUBS, OTHER_CLUB } from "./homeClubs";

type Child = {
  id: string;
  name: string;
  date_of_birth: string | null;
  description: string | null;
  medical_needs: string | null;
  photo_url: string | null;
  favorite_player?: string | null;
  favorite_shot?: string | null;
  county_rank?: number | null;
  national_rank?: number | null;
  handedness?: string | null;
  gender?: string | null;
  btm_number?: string | null;
  home_club?: string | null;
  current_coach?: string | null;
};

type EditChildFormProps = {
  child: Child;
  onSaved: () => void;
  onCancel: () => void;
};

const EditChildForm = ({ child, onSaved, onCancel }: EditChildFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(child.name);
  const [dob, setDob] = useState(child.date_of_birth || "");
  const [description, setDescription] = useState(child.description || "");
  const [medicalNeeds, setMedicalNeeds] = useState(child.medical_needs || "");
  const c = child as any;
  const [hasMedical, setHasMedical] = useState<boolean>(!!c.has_medical_needs);
  const [medicalConditions, setMedicalConditions] = useState<string[]>(c.medical_conditions || []);
  const [medicalDetails, setMedicalDetails] = useState<string>(c.medical_details || child.medical_needs || "");
  const [hasSend, setHasSend] = useState<boolean>(!!c.has_send_needs);
  const [sendConditions, setSendConditions] = useState<string[]>(c.send_conditions || []);
  const [sendDetails, setSendDetails] = useState<string>(c.send_details || "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const existingPhotoUrl = useSignedUrl("child-photos", child.photo_url);
  const photoPreview = localPreview ?? existingPhotoUrl;
  const [favoritePlayer, setFavoritePlayer] = useState(child.favorite_player || "");
  const [favoriteShot, setFavoriteShot] = useState(child.favorite_shot || "");
  const [countyRank, setCountyRank] = useState(child.county_rank?.toString() || "");
  const [nationalRank, setNationalRank] = useState(child.national_rank?.toString() || "");
  const [handedness, setHandedness] = useState<string>(child.handedness || "");
  const [gender, setGender] = useState<string>((child as any).gender || "");
  const [btmNumber, setBtmNumber] = useState(child.btm_number || "");

  const existingClub = child.home_club || "";
  const initialClubIsKnown = !existingClub || HOME_CLUBS.includes(existingClub);
  const [homeClubSelection, setHomeClubSelection] = useState(
    initialClubIsKnown ? existingClub : OTHER_CLUB
  );
  const [customClub, setCustomClub] = useState(initialClubIsKnown ? "" : existingClub);
  const [currentCoach, setCurrentCoach] = useState(child.current_coach || "");

  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const computeAgeGroup = (dobStr: string): string | null => {
    if (!dobStr) return null;
    const d = new Date(dobStr);
    if (isNaN(d.getTime())) return null;
    const year = new Date().getFullYear();
    const ageOnJan1 = year - d.getFullYear() - (d.getMonth() === 0 && d.getDate() > 1 ? 1 : 0);
    if (ageOnJan1 <= 7) return "8U";
    if (ageOnJan1 <= 8) return "9U";
    if (ageOnJan1 <= 9) return "10U";
    if (ageOnJan1 <= 10) return "11U";
    if (ageOnJan1 <= 11) return "12U";
    if (ageOnJan1 <= 13) return "14U";
    if (ageOnJan1 <= 15) return "16U";
    if (ageOnJan1 <= 17) return "18U";
    return null;
  };

  const syncFromLTA = async () => {
    const ageGroup = computeAgeGroup(dob);
    if (!ageGroup || ageGroup === "8U") {
      toast({ title: "Not eligible", description: "LTA rankings start at 9U.", variant: "destructive" });
      return;
    }
    const btm = btmNumber.replace(/\D/g, "");
    if (!name.trim() && !btm) {
      toast({ title: "Name or BTM required", description: "Enter the child's name or British Tennis Membership number first.", variant: "destructive" });
      return;
    }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("lta-rankings", {
        body: { name, btmNumber: btm, ageGroup, gender, dateOfBirth: dob || null, county: "Suffolk" },
      });
      if (error) throw error;
      if (!data?.success) {
        toast({
          title: "Could not auto-match",
          description: data?.message || "Open the LTA rankings page to check manually.",
          variant: "destructive",
        });
        return;
      }
      setCountyRank(data.countyRank ? String(data.countyRank) : "");
      setNationalRank(data.nationalRank ? String(data.nationalRank) : "");
      const parts = [
        `Matched ${data.matchedName}`,
        data.matchedCategory ? `(${data.matchedCategory})` : "",
        `National #${data.nationalRank ?? "—"}`,
        `County #${data.countyRank ?? "—"}`,
      ].filter(Boolean).join(" · ");
      toast({ title: "Rankings filled", description: `${parts}. Save to keep these.` });
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message || String(e), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const FAMOUS_PLAYERS = [
    // ATP — current top men
    "Jannik Sinner", "Carlos Alcaraz", "Alexander Zverev", "Taylor Fritz",
    "Novak Djokovic", "Daniil Medvedev", "Casper Ruud", "Andrey Rublev",
    "Holger Rune", "Alex de Minaur", "Grigor Dimitrov", "Stefanos Tsitsipas",
    "Tommy Paul", "Ben Shelton", "Frances Tiafoe", "Hubert Hurkacz",
    "Felix Auger-Aliassime", "Karen Khachanov", "Lorenzo Musetti", "Ugo Humbert",
    "Sebastian Korda", "Arthur Fils", "Jakub Mensik", "Joao Fonseca",
    "Tomas Machac", "Alejandro Davidovich Fokina", "Francisco Cerundolo",
    "Alex Michelsen", "Learner Tien", "Jiri Lehecka", "Flavio Cobolli",
    // British men
    "Jack Draper", "Cameron Norrie", "Dan Evans", "Jacob Fearnley",
    "Billy Harris", "Liam Broady", "Paul Jubb",
    // British doubles men
    "Neal Skupski", "Joe Salisbury", "Henry Patten", "Julian Cash", "Lloyd Glasspool",
    // ATP Legends
    "Rafael Nadal", "Roger Federer", "Andy Murray", "Stan Wawrinka",
    "Pete Sampras", "Andre Agassi", "Boris Becker", "John McEnroe",
    "Bjorn Borg", "Ivan Lendl", "Stefan Edberg", "Jimmy Connors",
    "Tim Henman", "Greg Rusedski", "Fred Perry", "Marat Safin",
    "Lleyton Hewitt", "Juan Martin del Potro", "Goran Ivanisevic", "Pat Rafter",

    // WTA — current top women
    "Aryna Sabalenka", "Iga Świątek", "Coco Gauff", "Jessica Pegula",
    "Jasmine Paolini", "Madison Keys", "Mirra Andreeva", "Qinwen Zheng",
    "Elena Rybakina", "Emma Navarro", "Paula Badosa", "Daria Kasatkina",
    "Diana Shnaider", "Barbora Krejcikova", "Anna Kalinskaya", "Beatriz Haddad Maia",
    "Donna Vekic", "Karolina Muchova", "Marta Kostyuk", "Liudmila Samsonova",
    "Elina Svitolina", "Ekaterina Alexandrova", "Veronika Kudermetova",
    "Magdalena Frech", "Yulia Putintseva", "Leylah Fernandez", "Amanda Anisimova",
    "Victoria Mboko", "Iva Jovic", "Linda Noskova",
    // British women
    "Emma Raducanu", "Katie Boulter", "Sonay Kartal", "Francesca Jones",
    "Harriet Dart", "Jodie Burrage", "Heather Watson", "Fran Jones",
    // WTA Legends
    "Serena Williams", "Venus Williams", "Maria Sharapova", "Naomi Osaka",
    "Simona Halep", "Ash Barty", "Angelique Kerber", "Caroline Wozniacki",
    "Victoria Azarenka", "Petra Kvitova", "Garbine Muguruza", "Li Na",
    "Justine Henin", "Kim Clijsters", "Martina Hingis", "Lindsay Davenport",
    "Jennifer Capriati", "Martina Navratilova", "Chris Evert", "Steffi Graf",
    "Billie Jean King", "Monica Seles", "Margaret Court", "Virginia Wade",
    "Sue Barker", "Jo Durie",

    // Wheelchair
    "Alfie Hewett", "Gordon Reid", "Lucy Shuker", "Andy Lapthorne",
    "Gustavo Fernandez", "Tokito Oda", "Shingo Kunieda", "Diede de Groot",
    "Aniek van Koot", "Jiske Griffioen",
  ];

  const TENNIS_SHOTS = [
    // Groundstrokes
    "Forehand", "Backhand", "Two-handed Backhand", "One-handed Backhand",
    "Inside-out Forehand", "Inside-in Forehand", "Running Forehand",
    // Serves
    "Serve", "Flat Serve", "Slice Serve", "Kick Serve", "Topspin Serve",
    "Second Serve", "Ace",
    // Net play
    "Volley", "Forehand Volley", "Backhand Volley", "Half Volley",
    "Drop Volley", "Swinging Volley", "Stop Volley",
    // Specialty / touch shots
    "Drop Shot", "Lob", "Topspin Lob", "Slice", "Backhand Slice",
    "Approach Shot", "Passing Shot", "Cross-court Winner", "Down-the-line Winner",
    // Overhead / power
    "Smash", "Overhead", "Jump Smash",
    // Trick shots
    "Tweener", "Behind-the-back", "SABR (Sneak Attack by Roger)",
    // Returns
    "Return of Serve", "Chip & Charge", "Block Return",
  ];


  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setLocalPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    // Photos are mandatory — prompt existing profiles without one to add it.
    if (!photoFile && !child.photo_url) {
      toast({
        title: "Photo required",
        description: "Please add a photo of your child — coaches use it to identify players at sessions.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);

    try {
      let photoUrl = child.photo_url;

      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("child-photos")
          .upload(path, photoFile);
        if (uploadErr) throw uploadErr;
        photoUrl = path;
      }

      const { error } = await supabase.from("children").update({
        name: name.trim(),
        date_of_birth: dob || null,
        description: description.trim() || null,
        medical_needs: medicalNeeds.trim() || null,
        has_medical_needs: hasMedical,
        medical_conditions: hasMedical ? medicalConditions : [],
        medical_details: hasMedical ? (medicalDetails.trim() || null) : null,
        has_send_needs: hasSend,
        send_conditions: hasSend ? sendConditions : [],
        send_details: hasSend ? (sendDetails.trim() || null) : null,
        photo_url: photoUrl,
        favorite_player: favoritePlayer.trim() || null,
        favorite_shot: favoriteShot.trim() || null,
        county_rank: countyRank ? parseInt(countyRank) : null,
        national_rank: nationalRank ? parseInt(nationalRank) : null,
        handedness: handedness || null,
        gender: gender || null,
        btm_number: btmNumber.trim() || null,
        home_club: homeClubSelection === OTHER_CLUB
          ? (customClub.trim() || null)
          : (homeClubSelection || null),
        current_coach: currentCoach.trim() || null,
      } as any).eq("id", child.id);

      if (error) throw error;
      toast({ title: "Updated", description: `${name}'s details have been updated.` });
      onSaved();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-bold text-foreground">Edit {child.name}</h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="cursor-pointer group">
            <div className="w-20 h-20 rounded-full bg-muted border-2 border-dashed border-border group-hover:border-lta-cyan transition-colors flex items-center justify-center overflow-hidden">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Upload size={24} className="text-muted-foreground group-hover:text-lta-cyan transition-colors" />
              )}
            </div>
            <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </label>
          <div>
            <p className="text-sm font-medium text-foreground">Player Photo *</p>
            <p className="text-xs text-muted-foreground">Required — coaches use it to identify players at sessions.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Full Name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-lta-cyan/50 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Date of Birth</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-lta-cyan/50 text-sm"
            />
          </div>
        </div>

        {/* Auto-calculated age & age group */}
        {dob && (() => {
          const birth = new Date(dob);
          const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          const now = new Date();
          const jan1 = new Date(now.getFullYear(), 0, 1);
          const ageOnJan1 = jan1.getFullYear() - birth.getFullYear() -
            (jan1 < new Date(jan1.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
          let ageGroup = "Senior";
          if (ageOnJan1 <= 7) ageGroup = "8U";
          else if (ageOnJan1 <= 8) ageGroup = "9U";
          else if (ageOnJan1 <= 9) ageGroup = "10U";
          else if (ageOnJan1 <= 10) ageGroup = "11U";
          else if (ageOnJan1 <= 11) ageGroup = "12U";
          else if (ageOnJan1 <= 13) ageGroup = "14U";
          else if (ageOnJan1 <= 15) ageGroup = "16U";
          else if (ageOnJan1 <= 17) ageGroup = "18U";
          return (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-lta-cyan/5 border border-lta-cyan/20">
              <span className="text-sm text-foreground font-medium">Age: <strong>{age}</strong></span>
              <span className="text-muted-foreground">·</span>
              <span className="px-3 py-1 rounded-full bg-lta-cyan/10 text-lta-cyan text-xs font-display font-bold">
                {ageGroup} Programme
              </span>
              <span className="text-xs text-muted-foreground ml-auto">(Based on age at 1st Jan)</span>
            </div>
          );
        })()}

        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">About / Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-lta-cyan/50 text-sm resize-none"
          />
        </div>

        {/* Gender */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Gender</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "boy", label: "Boy" },
              { value: "girl", label: "Girl" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGender(opt.value)}
                className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  gender === opt.value
                    ? "bg-lta-cyan text-suffolk-navy border-lta-cyan shadow-sm"
                    : "bg-muted border-border text-foreground hover:border-lta-cyan/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Used to look up the correct LTA ranking list.</p>
        </div>

        {/* Handedness */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <Hand size={14} className="text-lta-cyan" /> Playing Hand
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "left", label: "Left-handed" },
              { value: "right", label: "Right-handed" },
              { value: "both", label: "Both / Ambidextrous" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setHandedness(opt.value)}
                className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  handedness === opt.value
                    ? "bg-lta-cyan text-suffolk-navy border-lta-cyan shadow-sm"
                    : "bg-muted border-border text-foreground hover:border-lta-cyan/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* BTM Number */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
            <CreditCard size={14} className="text-lta-cyan" /> British Tennis Membership Number
          </label>
          <input
            value={btmNumber}
            onChange={(e) => setBtmNumber(e.target.value)}
            placeholder="e.g. 12345678"
            className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-lta-cyan/50 text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">You can find this on the LTA website under your child's profile.</p>
        </div>

        <ClubAndCoachSection
          homeClub={homeClubSelection}
          customClub={customClub}
          currentCoach={currentCoach}
          onHomeClubChange={setHomeClubSelection}
          onCustomClubChange={setCustomClub}
          onCurrentCoachChange={setCurrentCoach}
        />


        <div className="bg-gradient-to-r from-amber-500/5 via-lta-cyan/5 to-violet-500/5 border border-amber-500/20 rounded-2xl p-5 space-y-4">
          <p className="text-sm font-display font-bold text-foreground flex items-center gap-2">
            <Star size={16} className="text-amber-400" /> Player Favourites
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                <Star size={12} className="text-amber-400" /> Favourite Player
              </label>
              <Combobox
                value={favoritePlayer}
                onChange={setFavoritePlayer}
                options={FAMOUS_PLAYERS}
                placeholder="Who's your tennis hero?"
                ringClass="focus:ring-amber-400/50"
                getPrefix={getPlayerFlag}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                <Zap size={12} className="text-violet-400" /> Favourite Shot
              </label>
              <Combobox
                value={favoriteShot}
                onChange={setFavoriteShot}
                options={TENNIS_SHOTS}
                placeholder="What's your best shot?"
                ringClass="focus:ring-violet-400/50"
              />
            </div>
          </div>
        </div>

        {/* Rankings */}
        <div className="bg-gradient-to-r from-lta-cyan/5 via-amber-500/5 to-lta-cyan/5 border border-lta-cyan/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-display font-bold text-foreground flex items-center gap-2">
              <Trophy size={16} className="text-amber-400" /> Rankings
            </p>
            <button
              type="button"
              onClick={syncFromLTA}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lta-cyan text-suffolk-navy text-xs font-bold hover:bg-lta-cyan/90 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync from LTA"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            County and national rankings begin at <strong className="text-foreground">9U</strong>. Players in the 8U programme won't yet have an official ranking. You can find your child's current ranking on the{" "}
            <a
              href="https://competitions.lta.org.uk/ranking/ranking.aspx?id=50752"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lta-cyan font-medium hover:underline inline-flex items-center gap-0.5"
            >
              LTA Rankings page <ExternalLink size={10} />
            </a>
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                <Trophy size={12} className="text-amber-400" /> County Rank
              </label>
              <input
                type="number"
                min="1"
                value={countyRank}
                onChange={(e) => setCountyRank(e.target.value)}
                placeholder="e.g. 3"
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/50 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block flex items-center gap-1.5">
                <Trophy size={12} className="text-lta-cyan" /> National Rank
              </label>
              <input
                type="number"
                min="1"
                value={nationalRank}
                onChange={(e) => setNationalRank(e.target.value)}
                placeholder="e.g. 42"
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-lta-cyan/50 text-sm"
              />
            </div>
          </div>
        </div>
        <HealthNeedsFields
          hasMedical={hasMedical}
          setHasMedical={setHasMedical}
          medicalConditions={medicalConditions}
          setMedicalConditions={setMedicalConditions}
          medicalDetails={medicalDetails}
          setMedicalDetails={setMedicalDetails}
          hasSend={hasSend}
          setHasSend={setHasSend}
          sendConditions={sendConditions}
          setSendConditions={setSendConditions}
          sendDetails={sendDetails}
          setSendDetails={setSendDetails}
        />

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-lta-cyan text-suffolk-navy font-display font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl bg-muted text-muted-foreground font-display font-bold text-sm hover:bg-muted/80 transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default EditChildForm;
