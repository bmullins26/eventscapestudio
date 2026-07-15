import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Upload } from "lucide-react";
import { fetchSatelliteBackground } from "@/lib/venue-designer.functions";
import { uploadReferenceBackground } from "./background";
import type { BackgroundLayer } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  venueId: string;
  organizationId: string;
  onBackground: (bg: BackgroundLayer) => void;
}

export function AddBackgroundDialog({ open, onOpenChange, venueId, organizationId, onBackground }: Props) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fetchSat = useServerFn(fetchSatelliteBackground);

  const loadFromAddress = async () => {
    if (!address.trim()) return;
    setLoading(true);
    try {
      const res = await fetchSat({ data: { venueId, address: address.trim() } });
      const w = res.widthFeet;
      const h = res.heightFeet;
      onBackground({
        kind: "google-satellite",
        url: "",
        x: -w / 2,
        y: -h / 2,
        w, h,
        rotation: 0,
        opacity: 1,
        locked: true,
        calibrated: true,
        attribution: "Imagery ©Google",
        meta: res.meta,
      });
      toast.success("Satellite imagery loaded");
      setAddress("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load satellite imagery");
    } finally {
      setLoading(false);
    }
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (!organizationId) { toast.error("Organization not resolved yet."); return; }
    setUploading(true);
    const t = toast.loading("Uploading reference…");
    try {
      const bg = await uploadReferenceBackground({ organizationId, venueId, file });
      onBackground(bg);
      toast.success("Reference added. Use Calibrate to set the true scale.", { id: t });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed", { id: t });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add background</DialogTitle>
          <DialogDescription>
            Set the ground plane for your layout using a satellite map or your own image / PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4 text-primary" /> Satellite from address
            </div>
            <Label htmlFor="vd-address" className="text-xs text-muted-foreground">Address or place</Label>
            <Input
              id="vd-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Springfield"
              onKeyDown={(e) => { if (e.key === "Enter") loadFromAddress(); }}
            />
            <Button size="sm" onClick={loadFromAddress} disabled={loading || !address.trim()} className="w-full">
              {loading ? "Loading…" : "Load imagery"}
            </Button>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Upload className="h-4 w-4 text-primary" /> Upload image or PDF
            </div>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WEBP, or PDF (first page). You'll calibrate scale after upload.
            </p>
            <Input
              type="file"
              accept="image/*,application/pdf"
              disabled={uploading}
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
