import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type ComboboxProps = {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  ringClass?: string;
  getPrefix?: (option: string) => string | undefined;
};

const Combobox = ({ value, onChange, options, placeholder, ringClass = "focus:ring-amber-400/50", getPrefix }: ComboboxProps) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = value.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  const valuePrefix = getPrefix?.(value);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        {valuePrefix && (
          <span className="absolute inset-y-0 left-3 flex items-center text-base pointer-events-none">
            {valuePrefix}
          </span>
        )}
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={`w-full py-2.5 pr-10 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${ringClass} text-sm ${valuePrefix ? "pl-10" : "pl-4"}`}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground"
          aria-label="Toggle options"
        >
          <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-xl bg-background border border-border shadow-lg">
          {filtered.map((opt) => {
            const prefix = getPrefix?.(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2 ${
                  opt === value ? "bg-muted font-medium" : ""
                }`}
              >
                {prefix && <span className="text-base leading-none">{prefix}</span>}
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Combobox;
