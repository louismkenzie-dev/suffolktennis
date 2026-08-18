import { Heart, Brain } from "lucide-react";

export const MEDICAL_OPTIONS = [
  "Asthma",
  "Epilepsy",
  "Diabetes (Type 1)",
  "Diabetes (Type 2)",
  "Hay fever",
  "Eczema",
  "Food allergy (e.g. nuts, dairy)",
  "Insect sting allergy",
  "Heart condition",
  "Anaphylaxis (EpiPen)",
  "Migraines",
  "Joint / musculoskeletal injury",
  "Other",
];

export const SEND_OPTIONS = [
  "Autism Spectrum Condition (ASC)",
  "ADHD / ADD",
  "Dyslexia",
  "Dyspraxia",
  "Sensory Processing Difficulty",
  "Anxiety",
  "Hearing impairment",
  "Visual impairment",
  "Speech & language",
  "Social, emotional & mental health (SEMH)",
  "Physical disability",
  "Other",
];

type Props = {
  hasMedical: boolean;
  setHasMedical: (v: boolean) => void;
  medicalConditions: string[];
  setMedicalConditions: (v: string[]) => void;
  medicalDetails: string;
  setMedicalDetails: (v: string) => void;
  hasSend: boolean;
  setHasSend: (v: boolean) => void;
  sendConditions: string[];
  setSendConditions: (v: string[]) => void;
  sendDetails: string;
  setSendDetails: (v: string) => void;
};

const YesNo = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <div className="inline-flex rounded-xl border border-border overflow-hidden">
    <button
      type="button"
      onClick={() => onChange(true)}
      className={`px-5 py-2 text-sm font-display font-bold transition-colors ${
        value ? "bg-lta-cyan text-suffolk-navy" : "bg-background text-muted-foreground hover:bg-muted"
      }`}
    >
      Yes
    </button>
    <button
      type="button"
      onClick={() => onChange(false)}
      className={`px-5 py-2 text-sm font-display font-bold transition-colors border-l border-border ${
        !value ? "bg-lta-cyan text-suffolk-navy" : "bg-background text-muted-foreground hover:bg-muted"
      }`}
    >
      No
    </button>
  </div>
);

const CheckboxGrid = ({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (opt: string) => void;
}) => (
  <div className="grid sm:grid-cols-2 gap-2">
    {options.map((opt) => {
      const checked = selected.includes(opt);
      return (
        <button
          type="button"
          key={opt}
          onClick={() => onToggle(opt)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors ${
            checked
              ? "border-lta-cyan bg-lta-cyan/10 text-foreground"
              : "border-border bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
              checked ? "bg-lta-cyan border-lta-cyan" : "border-border"
            }`}
          >
            {checked && (
              <svg viewBox="0 0 20 20" fill="none" className="w-3 h-3 text-suffolk-navy">
                <path d="M5 10l3 3 7-7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span>{opt}</span>
        </button>
      );
    })}
  </div>
);

const HealthNeedsFields = ({
  hasMedical,
  setHasMedical,
  medicalConditions,
  setMedicalConditions,
  medicalDetails,
  setMedicalDetails,
  hasSend,
  setHasSend,
  sendConditions,
  setSendConditions,
  sendDetails,
  setSendDetails,
}: Props) => {
  const toggle = (list: string[], setList: (v: string[]) => void, opt: string) => {
    setList(list.includes(opt) ? list.filter((o) => o !== opt) : [...list, opt]);
  };

  return (
    <div className="space-y-6">
      {/* Medical Needs */}
      <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm font-display font-bold text-foreground flex items-center gap-2">
            <Heart size={16} className="text-rose-500" /> Does your child have any medical needs?
          </p>
          <YesNo value={hasMedical} onChange={setHasMedical} />
        </div>
        {hasMedical && (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">Tick all that apply</p>
            <CheckboxGrid
              options={MEDICAL_OPTIONS}
              selected={medicalConditions}
              onToggle={(opt) => toggle(medicalConditions, setMedicalConditions, opt)}
            />
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Further details (medication, dosage, emergency action)
              </label>
              <textarea
                value={medicalDetails}
                onChange={(e) => setMedicalDetails(e.target.value)}
                rows={3}
                placeholder="e.g. Salbutamol inhaler — 2 puffs as needed. EpiPen kept in tennis bag."
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-rose-400/50 text-sm resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* SEND / Additional Needs */}
      <div className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm font-display font-bold text-foreground flex items-center gap-2">
            <Brain size={16} className="text-violet-500" /> Does your child have any SEND or additional needs?
          </p>
          <YesNo value={hasSend} onChange={setHasSend} />
        </div>
        {hasSend && (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">Tick all that apply (SEND = Special Educational Needs & Disabilities)</p>
            <CheckboxGrid
              options={SEND_OPTIONS}
              selected={sendConditions}
              onToggle={(opt) => toggle(sendConditions, setSendConditions, opt)}
            />
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                How can coaches best support your child? (triggers, behaviour, communication tips)
              </label>
              <textarea
                value={sendDetails}
                onChange={(e) => setSendDetails(e.target.value)}
                rows={3}
                placeholder="e.g. Prefers clear one-step instructions. Loud noises can be a trigger — gentle warning before whistle helps."
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-400/50 text-sm resize-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthNeedsFields;
