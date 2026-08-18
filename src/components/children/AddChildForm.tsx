import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Upload, User, Hand, CreditCard } from "lucide-react";
import HealthNeedsFields from "./HealthNeedsFields";
import ClubAndCoachSection from "./ClubAndCoachSection";
import { HOME_CLUBS, OTHER_CLUB } from "./homeClubs";

type AddChildFormProps = {
  onChildAdded: () => void;
  onCancel: () => void;
};

const AddChildForm = ({ onChildAdded, onCancel }: AddChildFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [description, setDescription] = useState("");
  const [medicalNeeds, setMedicalNeeds] = useState("");
  const [hasMedical, setHasMedical] = useState(false);
  const [medicalConditions, setMedicalConditions] = useState<string[]>([]);
  const [medicalDetails, setMedicalDetails] = useState("");
  const [hasSend, setHasSend] = useState(false);
  const [sendConditions, setSendConditions] = useState<string[]>([]);
  const [sendDetails, setSendDetails] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [handedness, setHandedness] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [btmNumber, setBtmNumber] = useState("");
  const [homeClubSelection, setHomeClubSelection] = useState("");
  const [customClub, setCustomClub] = useState("");
  const [currentCoach, setCurrentCoach] = useState("");
  const [saving, setSaving] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSaving(true);

    try {
      let photoUrl: string | null = null;

      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("child-photos")
          .upload(path, photoFile);
        if (uploadErr) throw uploadErr;
        photoUrl = path;
      }

      const { error } = await supabase.from("children").insert({
        parent_user_id: user.id,
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
        handedness: handedness || null,
        gender: gender || null,
        btm_number: btmNumber.trim() || null,
        home_club: homeClubSelection === OTHER_CLUB
          ? (customClub.trim() || null)
          : (homeClubSelection || null),
        current_coach: currentCoach.trim() || null,
      } as any);

      if (error) throw error;
      toast({ title: "Child added", description: `${name} has been added successfully.` });
      onChildAdded();
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
        <h3 className="font-display text-lg font-bold text-foreground">Add a Child</h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photo upload */}
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
            <p className="text-sm font-medium text-foreground">Player Photo</p>
            <p className="text-xs text-muted-foreground">Click to upload (optional)</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Full Name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Freddie Sutton"
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

        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">About / Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Plays right-handed, loves competing in tournaments..."
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
            {saving ? "Saving..." : "Add Child"}
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

export default AddChildForm;
