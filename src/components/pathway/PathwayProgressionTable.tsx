import { motion } from "framer-motion";

type TableData = {
  headers: string[];
  rows: string[][];
};

type Props = {
  title: string;
  subtitle: string;
  tennis: TableData;
  athletic: TableData;
  matches: TableData;
};

const DataTable = ({ title, data, footnote }: { title: string; data: TableData; footnote?: string }) => (
  <div className="mb-6">
    <h4 className="font-display font-bold text-foreground text-sm uppercase tracking-wider mb-3">{title}</h4>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-suffolk-navy text-primary-foreground">
            {data.headers.map((h, i) => (
              <th key={i} className={`px-4 py-2.5 font-display font-bold ${i === 0 ? "text-left" : "text-center"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr
              key={ri}
              className={`border-b border-border ${
                ri === data.rows.length - 1 ? "bg-lta-cyan/10 font-bold" : ri % 2 === 0 ? "bg-card" : "bg-muted/50"
              }`}
            >
              {row.map((cell, ci) => (
                <td key={ci} className={`px-4 py-2.5 ${ci === 0 ? "text-left font-medium text-foreground" : "text-center text-muted-foreground"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {footnote && <p className="text-xs text-muted-foreground mt-2 italic">{footnote}</p>}
  </div>
);

const PathwayProgressionTable = ({ title, subtitle, tennis, athletic, matches }: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden"
    >
      <div className="bg-suffolk-navy px-6 py-5">
        <h3 className="font-display text-xl font-black text-primary-foreground">{title}</h3>
        <p className="text-lta-cyan font-display font-bold text-sm mt-1">{subtitle}</p>
      </div>
      <div className="p-6">
        <p className="text-muted-foreground font-body text-sm mb-6 leading-relaxed">
          Putting together an optimal weekly training and termly competition schedule that balances the right amount of quality with the volume required to develop for the future is important. This guidance should be bespoke to the individual player.
        </p>
        <DataTable title="Total Tennis Hours (Weekly)" data={tennis} footnote="Term time when there is no official competition. **If no matches/tournament at the weekend, scheduling in practice matches would be appropriate." />
        <DataTable title="Athletic Development (Weekly)" data={athletic} footnote="In addition to pre-tennis warm-ups." />
        <DataTable title="Matches (Yearly)" data={matches} />
      </div>
    </motion.div>
  );
};

export default PathwayProgressionTable;
