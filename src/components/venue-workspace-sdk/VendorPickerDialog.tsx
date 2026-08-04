import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Search, Star, X, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { listOrgVendors, type PickerVendor } from "@/lib/vendor-picker.functions";
import { isDevelopmentMode } from "@/lib/development-access";

type DevVendorDirectoryState = {
  rows: Array<{
    vendor_profile_id: string;
    account_status: string;
    is_favorite: boolean;
    vendor_profiles: {
      business_name: string;
      contact_name: string | null;
      email: string | null;
      phone: string | null;
      product_categories?: string[] | null;
      categories?: string[] | null;
    } | null;
  }>;
};

const DEV_VENDOR_DIRECTORY_PREFIX = "eventscape:vendor-directory:";

function readDevVendorDirectory(organizationId: string): PickerVendor[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(`${DEV_VENDOR_DIRECTORY_PREFIX}${organizationId}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DevVendorDirectoryState;
    return (parsed.rows ?? [])
      .map((row) => {
        const profile = row.vendor_profiles;
        if (!profile) return null;
        const categories = Array.isArray(profile.product_categories) && profile.product_categories.length
          ? profile.product_categories
          : Array.isArray(profile.categories) ? profile.categories : [];
        return {
          vendor_profile_id: row.vendor_profile_id,
          business_name: profile.business_name,
          contact_name: profile.contact_name,
          email: profile.email,
          phone: profile.phone,
          categories,
          is_favorite: !!row.is_favorite,
          account_status: row.account_status ?? "no_account",
          status: "prospect",
        } satisfies PickerVendor;
      })
      .filter((row): row is PickerVendor => row !== null);
  } catch {
    return [];
  }
}

export function VendorPickerDialog({
  open,
  onOpenChange,
  organizationId,
  currentVendorName,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  organizationId: string;
  currentVendorName?: string | null;
  onSelect: (v: PickerVendor) => void;
}) {
  const list = useServerFn(listOrgVendors);
  const q = useQuery({
    queryKey: ["org-vendors", organizationId, isDevelopmentMode() ? "dev" : "prod"],
    queryFn: async () => {
      if (isDevelopmentMode()) return readDevVendorDirectory(organizationId);
      return list({ data: { organizationId } });
    },
    enabled: open && !!organizationId,
  });

  const [term, setTerm] = useState("");
  useEffect(() => { if (!open) setTerm(""); }, [open]);

  const filtered = useMemo(() => {
    const rows = q.data ?? [];
    const t = term.trim().toLowerCase();
    const sorted = [...rows].sort((a, b) =>
      (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0) ||
      a.business_name.localeCompare(b.business_name),
    );
    if (!t) return sorted;
    return sorted.filter((v) =>
      v.business_name.toLowerCase().includes(t) ||
      (v.contact_name ?? "").toLowerCase().includes(t) ||
      (v.email ?? "").toLowerCase().includes(t) ||
      v.categories.some((c) => c.toLowerCase().includes(t)),
    );
  }, [q.data, term]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm">Assign vendor</DialogTitle>
          <DialogDescription className="text-xs">
            Pick a vendor from your organization to reserve this space.
          </DialogDescription>
        </DialogHeader>
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 bg-muted rounded px-2 py-1.5 border border-border">
            <Search size={12} className="text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search vendors, categories, email…"
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
            {term && (
              <button onClick={() => setTerm("")} className="text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[380px] overflow-y-auto border-t border-border">
          {q.isLoading && <div className="p-6 text-center text-xs text-muted-foreground">Loading vendors…</div>}
          {q.isError && <div className="p-6 text-center text-xs text-destructive">Failed to load vendors</div>}
          {!q.isLoading && !q.isError && filtered.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {q.data && q.data.length === 0 ? "No vendors in this organization yet." : "No matches"}
            </div>
          )}
          {filtered.map((v) => {
            const isCurrent = currentVendorName && v.business_name === currentVendorName;
            return (
              <button
                key={v.vendor_profile_id}
                onClick={() => { onSelect(v); onOpenChange(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary border-b border-border/50 text-left"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-[11px] flex items-center justify-center shrink-0 font-medium">
                  {v.business_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground truncate">{v.business_name}</span>
                    {v.is_favorite && <Star size={10} className="text-amber-500 fill-amber-500 shrink-0" />}
                    {isCurrent && <Check size={11} className="text-primary shrink-0" />}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {v.categories.slice(0, 3).join(" · ") || v.contact_name || v.email || "—"}
                  </div>
                </div>
                <span className="text-[9px] uppercase tracking-wide text-muted-foreground shrink-0">
                  {v.account_status.replace("_", " ")}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
