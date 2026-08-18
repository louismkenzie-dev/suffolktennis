import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown } from "lucide-react";

type Props = {
  favourable: string[];
  unfavourable: string[];
};

const ParentalGuidanceSection = ({ favourable, unfavourable }: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid md:grid-cols-2 gap-4"
    >
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="bg-emerald-600 px-6 py-4 flex items-center gap-3">
          <ThumbsUp size={20} className="text-white" />
          <h3 className="font-display font-bold text-white">Favourable Parental Behaviour</h3>
        </div>
        <ul className="p-6 space-y-3">
          {favourable.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm text-muted-foreground font-body leading-relaxed">
              <span className="text-emerald-500 mt-1 shrink-0">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
          <ThumbsDown size={20} className="text-white" />
          <h3 className="font-display font-bold text-white">Unfavourable Parental Behaviour</h3>
        </div>
        <ul className="p-6 space-y-3">
          {unfavourable.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm text-muted-foreground font-body leading-relaxed">
              <span className="text-red-500 mt-1 shrink-0">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
};

export default ParentalGuidanceSection;
