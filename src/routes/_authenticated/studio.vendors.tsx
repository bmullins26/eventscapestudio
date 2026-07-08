import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Store, Plus, Search, MoreHorizontal, Mail, UserX, UserCheck, Trash2, Pencil, Sparkles, Upload, X, FileText, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { scanVendorIntake } from "@/lib/studio.functions";
import { createVendor, updateVendor } from "@/lib/vendors.functions";
import { useAuth } from "@/lib/auth-context";
import { DuplicateMatchDialog, type DuplicateMatch } from "@/components/vendors/DuplicateMatchDialog";
import { useVendorDraft } from "@/components/vendors/useVendorDraft";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/studio/vendors")({
  head: () => ({ meta: [{ title: "Vendor Directory · EventScape Studio" }] }),
  component: VendorsPage,
});

type SocialLinks = { facebook?: string | null; instagram?: string | null; tiktok?: string | null };

type VendorRow = {
  id: string;
  vendor_profile_id: string;
  account_status: "no_account" | "invited" | "registered" | "disabled";
  is_favorite: boolean;
  years_participated: number;
  total_paid: number;
  vendor_profiles: {
    business_name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    business_description: string | null;
    product_categories: string[] | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    insurance_doc_url: string | null;
    tax_doc_url: string | null;
    food_license_url: string | null;
    resale_cert_url: string | null;
    business_photos: string[] | null;
    social_links: SocialLinks | null;
  } | null;
};

const STATUS_TONE: Record<string, string> = {
  no_account: "bg-muted text-muted-foreground",
  invited: "bg-warning/20 text-warning-foreground",
  registered: "bg-success/15 text-success",
  disabled: "bg-destructive/10 text-destructive",
};

type EditState = {
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
  business_photos: string[];
  social_facebook: string;
  social_instagram: string;
  social_tiktok: string;
};

const emptyEditing: EditState = {
  business_name: "", contact_name: "", email: "", phone: "",
  website: "", business_description: "", product_categories: "",
  emergency_contact_name: "", emergency_contact_phone: "",
  insurance_doc_url: "", tax_doc_url: "", food_license_url: "", resale_cert_url: "",
  business_photos: [],
  social_facebook: "", social_instagram: "", social_tiktok: "",
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function VendorsPage() {
  const { activeOrg } = useAuth();
  const qc = useQueryClient();
  const orgId = activeOrg?.organizationId;
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanBanner, setScanBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const scan = useServerFn(scanVendorIntake);
  const createVendorFn = useServerFn(createVendor);
  const updateVendorFn = useServerFn(updateVendor);
  const draft = useVendorDraft<EditState>(orgId, editing, setEditing);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["vendor-directory", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<VendorRow[]> => {
      const { data, error } = await supabase
        .from("organization_vendors")
        .select("id, vendor_profile_id, account_status, is_favorite, years_participated, total_paid, vendor_profiles(business_name, contact_name, email, phone, website, business_description, product_categories, emergency_contact_name, emergency_contact_phone, insurance_doc_url, tax_doc_url, food_license_url, resale_cert_url, business_photos, social_links)")
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

  const buildProfilePayload = (e: EditState) => ({
    business_name: e.business_name.trim(),
    contact_name: e.contact_name || null,
    email: e.email || null,
    phone: e.phone || null,
    website: e.website || null,
    business_description: e.business_description || null,
    product_categories: e.product_categories.split(",").map((s) => s.trim()).filter(Boolean),
    emergency_contact_name: e.emergency_contact_name || null,
    emergency_contact_phone: e.emergency_contact_phone || null,
    insurance_doc_url: e.insurance_doc_url || null,
    tax_doc_url: e.tax_doc_url || null,
    food_license_url: e.food_license_url || null,
    resale_cert_url: e.resale_cert_url || null,
    business_photos: e.business_photos,
    social_links: {
      facebook: e.social_facebook || null,
      instagram: e.social_instagram || null,
      tiktok: e.social_tiktok || null,
    },
  });

  const persistSave = async (opts: { allowDuplicate?: boolean; matchedProfileId?: string } = {}) => {
    if (!editing || !orgId) return;
    if (!editing.business_name.trim()) { toast.error("Business name required"); return; }
    setSaving(true);
    try {
      const profile = buildProfilePayload(editing);
      if (editing.id) {
        const row = rows.find((r) => r.id === editing.id);
        if (!row) return;
        await updateVendorFn({ data: { organizationId: orgId, vendorProfileId: row.vendor_profile_id, profile } });
      } else {
        const result = await createVendorFn({
          data: {
            organizationId: orgId,
            profile,
            link: { account_status: "no_account", is_favorite: false },
            allowDuplicate: opts.allowDuplicate ?? false,
            matchedProfileId: opts.matchedProfileId ?? null,
          },
        });
        if (result.status === "duplicates") {
          setDuplicates(result.matches);
          return;
        }
        if (result.status === "linked") toast.success("Linked existing vendor to this organization");
      }
      toast.success("Saved");
      setEditing(null);
      setScanBanner(null);
      setDuplicates(null);
      draft.clear();
      qc.invalidateQueries({ queryKey: ["vendor-directory", orgId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveVendor = () => persistSave();


  const startScan = async (file: File) => {
    if (!orgId) return;
    setScanning(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const ext = file.name.split(".").pop() ?? "bin";
      const uid = crypto.randomUUID();
      const path = `vendor-intake/${orgId}/${uid}.${ext}`;
      // Upload source file for reference (best-effort, don't block on failure)
      await supabase.storage.from("application-uploads").upload(path, file, { contentType: file.type, upsert: false }).catch(() => {});
      const extracted = await scan({ data: { fileDataUrl: dataUrl } });
      setEditing({
        ...emptyEditing,
        business_name: extracted.business_name ?? "",
        contact_name: extracted.contact_name ?? "",
        email: extracted.email ?? "",
        phone: extracted.phone ?? "",
        website: extracted.website ?? "",
        business_description: extracted.business_description ?? "",
        product_categories: (extracted.product_categories ?? []).join(", "),
        emergency_contact_name: extracted.emergency_contact_name ?? "",
        emergency_contact_phone: extracted.emergency_contact_phone ?? "",
        social_facebook: extracted.social_links?.facebook ?? "",
        social_instagram: extracted.social_links?.instagram ?? "",
        social_tiktok: extracted.social_links?.tiktok ?? "",
      });
      setScanBanner(file.name);
      toast.success("Extracted — review before saving");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
      if (scanInputRef.current) scanInputRef.current.value = "";
    }
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

  const openBlank = () => { setScanBanner(null); setEditing({ ...emptyEditing }); };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Organization"
        title="Vendor Directory"
        description="Your complete roster of vendors. Portal accounts are optional — you can run applications for every vendor from here."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => scanInputRef.current?.click()} disabled={scanning}>
              {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              Scan intake form
            </Button>
            <Button onClick={openBlank}><Plus className="mr-2 h-4 w-4" /> Add vendor</Button>
            <input
              ref={scanInputRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && startScan(e.target.files[0])}
            />
          </div>
        }
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
          description={search ? "Try another search." : "Add vendors manually, scan a paper intake form, invite them to the portal, or let them submit applications online."}
          action={!search ? <Button onClick={openBlank}><Plus className="mr-2 h-4 w-4" /> Add vendor</Button> : undefined}
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
                    const p = r.vendor_profiles;
                    if (!p) return;
                    const sl = (p.social_links ?? {}) as SocialLinks;
                    setScanBanner(null);
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
                      business_photos: Array.isArray(p.business_photos) ? p.business_photos : [],
                      social_facebook: sl.facebook ?? "",
                      social_instagram: sl.instagram ?? "",
                      social_tiktok: sl.tiktok ?? "",
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

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setScanBanner(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit vendor" : "New vendor"}</DialogTitle>
            <p className="text-xs text-muted-foreground">Organization Vendor Intake — permanent profile shared across every event.</p>
          </DialogHeader>
          {scanBanner && (
            <div className="rounded-lg border border-primary/30 bg-primary-soft/40 px-3 py-2 text-xs text-primary-deep flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Reviewing AI extraction from <span className="font-medium">{scanBanner}</span>. Edit anything that looks off before saving.
            </div>
          )}
          {editing && orgId && (
            <div className="space-y-5 py-2">
              <section className="space-y-3">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Business</h3>
                <div className="space-y-1"><Label>Business name *</Label><Input value={editing.business_name} onChange={(e) => setEditing({ ...editing, business_name: e.target.value })} autoFocus /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label>Contact name</Label><Input value={editing.contact_name} onChange={(e) => setEditing({ ...editing, contact_name: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Email</Label><Input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
                </div>
                <div className="space-y-1"><Label>Phone</Label><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
                <div className="space-y-1"><Label>Business description</Label><Textarea rows={3} value={editing.business_description} onChange={(e) => setEditing({ ...editing, business_description: e.target.value })} /></div>
                <div className="space-y-1"><Label>Product categories (comma separated)</Label><Input placeholder="Handmade, Food, Art" value={editing.product_categories} onChange={(e) => setEditing({ ...editing, product_categories: e.target.value })} /></div>
              </section>

              <section className="space-y-3 border-t border-border/60 pt-4">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Links</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label>Website</Label><Input placeholder="https://" value={editing.website} onChange={(e) => setEditing({ ...editing, website: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Facebook</Label><Input value={editing.social_facebook} onChange={(e) => setEditing({ ...editing, social_facebook: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Instagram</Label><Input value={editing.social_instagram} onChange={(e) => setEditing({ ...editing, social_instagram: e.target.value })} /></div>
                  <div className="space-y-1"><Label>TikTok</Label><Input value={editing.social_tiktok} onChange={(e) => setEditing({ ...editing, social_tiktok: e.target.value })} /></div>
                </div>
              </section>

              <section className="space-y-3 border-t border-border/60 pt-4">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Documents</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <DocUploadField label="Insurance" orgId={orgId} value={editing.insurance_doc_url} onChange={(v) => setEditing({ ...editing, insurance_doc_url: v })} />
                  <DocUploadField label="Tax document" orgId={orgId} value={editing.tax_doc_url} onChange={(v) => setEditing({ ...editing, tax_doc_url: v })} />
                  <DocUploadField label="Food license" orgId={orgId} value={editing.food_license_url} onChange={(v) => setEditing({ ...editing, food_license_url: v })} />
                  <DocUploadField label="Resale certificate" orgId={orgId} value={editing.resale_cert_url} onChange={(v) => setEditing({ ...editing, resale_cert_url: v })} />
                </div>
              </section>

              <section className="space-y-3 border-t border-border/60 pt-4">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Business photos</h3>
                <PhotoGrid orgId={orgId} photos={editing.business_photos} onChange={(v) => setEditing({ ...editing, business_photos: v })} />
              </section>

              <section className="space-y-3 border-t border-border/60 pt-4">
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Emergency contact</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label>Name</Label><Input value={editing.emergency_contact_name} onChange={(e) => setEditing({ ...editing, emergency_contact_name: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Phone</Label><Input value={editing.emergency_contact_phone} onChange={(e) => setEditing({ ...editing, emergency_contact_phone: e.target.value })} /></div>
                </div>
              </section>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditing(null); setScanBanner(null); }}>Cancel</Button>
            <Button onClick={saveVendor}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocUploadField({ label, orgId, value, onChange }: { label: string; orgId: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const filename = value ? value.split("/").pop() ?? value : "";

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `vendor-intake/${orgId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("application-uploads").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      onChange(path);
      toast.success(`${label} uploaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  const openSigned = async () => {
    if (!value) return;
    const { data, error } = await supabase.storage.from("application-uploads").createSignedUrl(value, 3600);
    if (error || !data) { toast.error("Could not open file"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <button type="button" onClick={openSigned} className="min-w-0 flex-1 truncate text-left text-xs hover:underline">{filename}</button>
          <Button type="button" variant="ghost" size="sm" onClick={() => ref.current?.click()} disabled={busy}>Replace</Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange("")} aria-label="Remove"><X className="h-4 w-4" /></Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-full justify-start" onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Upload {label.toLowerCase()}
        </Button>
      )}
      <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
    </div>
  );
}

function PhotoGrid({ orgId, photos, onChange }: { orgId: string; photos: string[]; onChange: (v: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const MAX = 8;

  const upload = async (files: FileList) => {
    setBusy(true);
    try {
      const remaining = MAX - photos.length;
      const toUpload = Array.from(files).slice(0, remaining);
      const uploaded: string[] = [];
      for (const file of toUpload) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `vendor-intake/${orgId}/photos/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("application-uploads").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        uploaded.push(path);
      }
      onChange([...photos, ...uploaded]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos.map((p) => (
          <PhotoTile key={p} path={p} onRemove={() => onChange(photos.filter((x) => x !== p))} />
        ))}
        {photos.length < MAX && (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={busy}
            className="aspect-square rounded-md border border-dashed border-border flex flex-col items-center justify-center text-xs text-muted-foreground hover:bg-muted/40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mb-1" />Add photo</>}
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">Up to {MAX} photos. {photos.length}/{MAX} used.</p>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && upload(e.target.files)} />
    </div>
  );
}

function PhotoTile({ path, onRemove }: { path: string; onRemove: () => void }) {
  const { data: url } = useQuery({
    queryKey: ["vendor-photo-url", path],
    queryFn: async () => {
      const { data } = await supabase.storage.from("application-uploads").createSignedUrl(path, 3600);
      return data?.signedUrl ?? "";
    },
    staleTime: 50 * 60 * 1000,
  });
  return (
    <div className="relative aspect-square overflow-hidden rounded-md border border-border/60 bg-muted">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse bg-muted" />}
      <button type="button" onClick={onRemove} aria-label="Remove photo" className="absolute top-1 right-1 rounded-full bg-background/90 p-0.5 shadow hover:bg-background">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
