import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Store, Plus, Search, MoreHorizontal, Mail, UserX, UserCheck, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/studio/vendors")({
  head: () => ({ meta: [{ title: "Vendor Directory · EventScape Studio" }] }),
  component: VendorsPage,
});

type VendorRow = {
  id: string;
  vendor_profile_id: string;
  account_status: "no_account" | "invited" | "registered" | "disabled";
  is_favorite: boolean;
  years_participated: number;
  total_paid: number;
  vendor_profiles: { business_name: string; contact_name: string | null; email: string | null; phone: string | null } | null;
};

const STATUS_TONE: Record<string, string> = {
  no_account: "bg-muted text-muted-foreground",
  invited: "bg-warning/20 text-warning-foreground",
  registered: "bg-success/15 text-success",
  disabled: "bg-destructive/10 text-destructive",
};

function VendorsPage() {
  const { activeOrg } = useAuth();
  const qc = useQueryClient();
  const orgId = activeOrg?.organizationId;
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{
    id?: string;
    business_name: string;
    contact_name: string;
    email: string;
    phone: string;
    website: string;
    business_description: string;
    product_categories: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    insurance_doc_url: string;
    tax_doc_url: string;
    food_license_url: string;
    resale_cert_url: string;
  } | null>(null);
  const emptyEditing = {
    business_name: "", contact_name: "", email: "", phone: "",
    website: "", business_description: "", product_categories: "",
    emergency_contact_name: "", emergency_contact_phone: "",
    insurance_doc_url: "", tax_doc_url: "", food_license_url: "", resale_cert_url: "",
  };

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["vendor-directory", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<VendorRow[]> => {
      const { data, error } = await supabase
        .from("organization_vendors")
        .select("id, vendor_profile_id, account_status, is_favorite, years_participated, total_paid, vendor_profiles(business_name, contact_name, email, phone, website, business_description, product_categories, emergency_contact_name, emergency_contact_phone, insurance_doc_url, tax_doc_url, food_license_url, resale_cert_url)")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as VendorRow[]) ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const p = r.vendor_profiles;
      return [p?.business_name, p?.contact_name, p?.email, p?.phone].filter(Boolean).some((f) => f!.toLowerCase().includes(s));
    });
  }, [rows, search]);

  const saveVendor = async () => {
    if (!editing || !orgId) return;
    if (!editing.business_name.trim()) { toast.error("Business name required"); return; }
    const categories = editing.product_categories.split(",").map((s) => s.trim()).filter(Boolean);
    const profilePayload = {
      business_name: editing.business_name.trim(),
      contact_name: editing.contact_name || null,
      email: editing.email || null,
      phone: editing.phone || null,
      website: editing.website || null,
      business_description: editing.business_description || null,
      product_categories: categories,
      emergency_contact_name: editing.emergency_contact_name || null,
      emergency_contact_phone: editing.emergency_contact_phone || null,
      insurance_doc_url: editing.insurance_doc_url || null,
      tax_doc_url: editing.tax_doc_url || null,
      food_license_url: editing.food_license_url || null,
      resale_cert_url: editing.resale_cert_url || null,
    };
    if (editing.id) {
      const row = rows.find((r) => r.id === editing.id);
      if (!row) return;
      const { error } = await supabase.from("vendor_profiles").update(profilePayload).eq("id", row.vendor_profile_id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data: vp, error: vpErr } = await supabase.from("vendor_profiles").insert({
        ...profilePayload,
        intake_completed_at: new Date().toISOString(),
      }).select("id").single();
      if (vpErr) { toast.error(vpErr.message); return; }
      const { error: ovErr } = await supabase.from("organization_vendors").insert({
        organization_id: orgId,
        vendor_profile_id: vp.id,
        account_status: "no_account",
      });
      if (ovErr) { toast.error(ovErr.message); return; }
    }
    toast.success("Saved");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["vendor-directory", orgId] });
  };

  const invite = async (row: VendorRow) => {
    if (!row.vendor_profiles?.email) { toast.error("Vendor has no email on file. Edit the vendor and add one first."); return; }
    if (!orgId) return;
    const token = crypto.randomUUID();
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { error: iErr } = await supabase.from("vendor_invitations").insert({
      organization_id: orgId,
      vendor_profile_id: row.vendor_profile_id,
      email: row.vendor_profiles.email,
      token,
      code,
      status: "pending",
    });
    if (iErr) { toast.error(iErr.message); return; }
    await supabase.from("organization_vendors").update({ account_status: "invited" }).eq("id", row.id);
    const link = `${window.location.origin}/auth?invite=${token}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success(`Invitation code: ${code} · Link copied`);
    qc.invalidateQueries({ queryKey: ["vendor-directory", orgId] });
  };

  const setStatus = async (row: VendorRow, s: VendorRow["account_status"]) => {
    const { error } = await supabase.from("organization_vendors").update({ account_status: s }).eq("id", row.id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["vendor-directory", orgId] }); }
  };

  const remove = async (row: VendorRow) => {
    if (!confirm(`Remove ${row.vendor_profiles?.business_name}?`)) return;
    const { error } = await supabase.from("organization_vendors").delete().eq("id", row.id);
    if (error) toast.error(error.message);
    else { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["vendor-directory", orgId] }); }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Organization"
        title="Vendor Directory"
        description="Your complete roster of vendors. Portal accounts are optional — you can run applications for every vendor from here."
        actions={<Button onClick={() => setEditing({ ...emptyEditing })}><Plus className="mr-2 h-4 w-4" /> Add vendor</Button>}
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendors…" className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Store}
          title={search ? "No matches" : "No vendors yet"}
          description={search ? "Try another search." : "Add vendors manually, invite them to the portal, or let them submit applications through the public form."}
          action={!search ? <Button onClick={() => setEditing({ ...emptyEditing })}><Plus className="mr-2 h-4 w-4" /> Add vendor</Button> : undefined}
        />
      ) : (
        <div className="card-soft divide-y divide-border/60">
          {filtered.map((r) => (
            <div key={r.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-deep">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{r.vendor_profiles?.business_name ?? "—"}</p>
                  <Badge className={`rounded-full text-[10px] uppercase tracking-wider ${STATUS_TONE[r.account_status]}`}>{r.account_status.replace("_", " ")}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {[r.vendor_profiles?.contact_name, r.vendor_profiles?.email, r.vendor_profiles?.phone].filter(Boolean).join(" · ") || "No contact info"}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    const p: any = r.vendor_profiles ?? {};
                    setEditing({
                      id: r.id,
                      business_name: p.business_name ?? "",
                      contact_name: p.contact_name ?? "",
                      email: p.email ?? "",
                      phone: p.phone ?? "",
                      website: p.website ?? "",
                      business_description: p.business_description ?? "",
                      product_categories: Array.isArray(p.product_categories) ? p.product_categories.join(", ") : "",
                      emergency_contact_name: p.emergency_contact_name ?? "",
                      emergency_contact_phone: p.emergency_contact_phone ?? "",
                      insurance_doc_url: p.insurance_doc_url ?? "",
                      tax_doc_url: p.tax_doc_url ?? "",
                      food_license_url: p.food_license_url ?? "",
                      resale_cert_url: p.resale_cert_url ?? "",
                    });
                  }}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                  {r.account_status === "no_account" && <DropdownMenuItem onClick={() => invite(r)}><Mail className="mr-2 h-4 w-4" /> Invite to Portal</DropdownMenuItem>}
                  {r.account_status === "invited" && <DropdownMenuItem onClick={() => setStatus(r, "no_account")}><UserX className="mr-2 h-4 w-4" /> Revoke invite</DropdownMenuItem>}
                  {r.account_status !== "disabled" ? <DropdownMenuItem onClick={() => setStatus(r, "disabled")}><UserX className="mr-2 h-4 w-4" /> Disable</DropdownMenuItem>
                    : <DropdownMenuItem onClick={() => setStatus(r, "no_account")}><UserCheck className="mr-2 h-4 w-4" /> Enable</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => remove(r)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Remove</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit vendor" : "New vendor"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Business name *</Label><Input value={editing.business_name} onChange={(e) => setEditing({ ...editing, business_name: e.target.value })} autoFocus /></div>
              <div className="space-y-1"><Label>Contact name</Label><Input value={editing.contact_name} onChange={(e) => setEditing({ ...editing, contact_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
                <div className="space-y-1"><Label>Phone</Label><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveVendor}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
