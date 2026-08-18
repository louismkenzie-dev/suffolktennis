import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

type ContextItem = {
  title: string;
  content: string;
};

type Props = {
  title: string;
  items: ContextItem[];
};

const TrainingContextSection = ({ title, items }: Props) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden"
    >
      <div className="bg-suffolk-navy px-6 py-5">
        <h3 className="font-display text-xl font-black text-primary-foreground">{title}</h3>
        <p className="text-primary-foreground/60 text-sm mt-1">Key guidance for parents and coaches</p>
      </div>
      <div className="divide-y divide-border">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            className="w-full text-left px-6 py-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-foreground text-sm">{item.title}</span>
              <ChevronDown
                size={16}
                className={`text-muted-foreground transition-transform ${expandedIndex === i ? "rotate-180" : ""}`}
              />
            </div>
            {expandedIndex === i && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="text-sm text-muted-foreground font-body mt-3 leading-relaxed"
              >
                {item.content}
              </motion.p>
            )}
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export default TrainingContextSection;
