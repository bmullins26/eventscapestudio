import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type DuplicateMatch = {
  vendor_profile_id: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  matched_on: string[];
};

export function DuplicateMatchDialog({
  open,
  matches,
  onCancel,
  onUseExisting,
  onCreateAnyway,
}: {
  open: boolean;
  matches: DuplicateMatch[];
  onCancel: () => void;
  onUseExisting: (id: string) => void;
  onCreateAnyway: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Possible duplicate vendor</AlertDialogTitle>
          <AlertDialogDescription>
            A vendor with matching details already exists in this organization. Reuse the existing profile so history and documents stay linked, or create a new one anyway.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {matches.map((m) => (
            <div key={m.vendor_profile_id} className="rounded-md border border-border/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{m.business_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[m.email, m.phone, m.website].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Matched on: {m.matched_on.join(", ")}
                  </p>
                </div>
                <Button size="sm" onClick={() => onUseExisting(m.vendor_profile_id)}>Use this</Button>
              </div>
            </div>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onCreateAnyway}>Create new anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
