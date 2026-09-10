import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsPhone } from "./useBreakpoint";

/**
 * Admin "editor + list" screens. Desktop keeps the two-column composition:
 * the form on one side, the records on the other. On a phone the list comes
 * first — that is what an admin opens the page for — and the form appears as
 * a bottom sheet when they tap New or a record. The form is rendered in
 * exactly one place at a time, so its (controlled) state is never duplicated.
 */
export function FormListLayout({ formTitle, formActions, form, list, formOpen, onFormOpenChange, formRef, wide = false }: {
  formTitle: React.ReactNode;
  /** Small actions next to the form title (e.g. "New"). */
  formActions?: React.ReactNode;
  form: React.ReactNode;
  list: React.ReactNode;
  formOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
  formRef?: React.RefObject<HTMLDivElement>;
  /** Give the list two thirds of the width on desktop. */
  wide?: boolean;
}) {
  const phone = useIsPhone();
  if (phone) {
    return (
      <>
        {list}
        <Dialog open={formOpen} onOpenChange={onFormOpenChange}>
          <DialogContent className="gap-3">
            <DialogHeader>
              <DialogTitle>{formTitle}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">{form}</div>
          </DialogContent>
        </Dialog>
      </>
    );
  }
  return (
    <div className={wide ? "grid gap-6 lg:grid-cols-3" : "grid gap-6 lg:grid-cols-2"}>
      <Card ref={formRef} className={wide ? "lg:col-span-1 self-start" : "self-start"}>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{formTitle}</CardTitle>
          {formActions}
        </CardHeader>
        <CardContent className="space-y-4">{form}</CardContent>
      </Card>
      <div className={wide ? "lg:col-span-2 space-y-6" : "space-y-6"}>{list}</div>
    </div>
  );
}
