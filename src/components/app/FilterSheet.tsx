import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Advanced filters live behind one button so the list gets the screen.
 * Children are the controls; Reset clears them, Apply closes. The parent
 * owns the filter state (controls are the same Selects used on desktop).
 */
export function FilterButton({ onClick, activeCount = 0, className }: { onClick: () => void; activeCount?: number; className?: string }) {
  return (
    <Button type="button" variant="outline" size="icon" onClick={onClick} aria-label="Filters" className={cn("relative shrink-0", className)}>
      <SlidersHorizontal className="h-4 w-4" />
      {activeCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
          {activeCount}
        </span>
      )}
    </Button>
  );
}

export function FilterSheet({ open, onOpenChange, title = "Filters", description, onReset, children }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  description?: string;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4">{children}</div>
        <div className="mt-1 flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onReset}>Reset</Button>
          <Button type="button" className="flex-1" onClick={() => onOpenChange(false)}>Apply</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
