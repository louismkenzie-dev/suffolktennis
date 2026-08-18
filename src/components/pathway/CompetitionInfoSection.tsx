import { motion } from "framer-motion";
import { Clock, Award } from "lucide-react";

type ScoringFormat = {
  ageGroup: string;
  color: string;
  formats: string;
  grades: string;
};

type Timescale = {
  item: string;
  detail: string;
};

type Props = {
  scoringFormats: ScoringFormat[];
  timescales: Timescale[];
};

const CompetitionInfoSection = ({ scoringFormats, timescales }: Props) => {
  return (
    <div className="space-y-6">
      {/* Scoring Formats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="bg-suffolk-navy px-6 py-5 flex items-center gap-3">
          <Award size={20} className="text-lta-cyan" />
          <div>
            <h3 className="font-display text-xl font-black text-primary-foreground">LTA Approved Scoring Formats</h3>
            <p className="text-primary-foreground/60 text-sm mt-0.5">Competition regulations by age group</p>
          </div>
        </div>
        <div className="divide-y divide-border">
          {scoringFormats.map((format, i) => (
            <div key={i} className="px-6 py-4 flex gap-4">
              <span className={`${format.color} text-white text-xs font-bold px-3 py-1 rounded-full h-fit shrink-0`}>
                {format.ageGroup}
              </span>
              <div>
                <p className="text-sm text-foreground font-body leading-relaxed">{format.formats}</p>
                <p className="text-xs text-muted-foreground mt-1">Grades {format.grades}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Competition Timescales */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="bg-suffolk-navy px-6 py-5 flex items-center gap-3">
          <Clock size={20} className="text-lta-cyan" />
          <div>
            <h3 className="font-display text-xl font-black text-primary-foreground">Planning Your Competition</h3>
            <p className="text-primary-foreground/60 text-sm mt-0.5">Mandatory timescales for all junior competitions</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {timescales.map((ts, i) => (
                <tr key={i} className={`border-b border-border ${i % 2 === 0 ? "bg-card" : "bg-muted/50"}`}>
                  <td className="px-6 py-3 font-display font-bold text-foreground whitespace-nowrap">{ts.item}</td>
                  <td className="px-6 py-3 text-muted-foreground font-body">{ts.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default CompetitionInfoSection;
