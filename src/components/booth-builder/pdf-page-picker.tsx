import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { loadPdf, renderPdfPageToDataUrl } from "@/lib/pdf-render";

export type PdfPagePickerResult = { pageNumber: number } | null;

export function PdfPagePicker({
  file,
  open,
  onClose,
  onPick,
}: {
  file: File | null;
  open: boolean;
  onClose: () => void;
  onPick: (pageNumber: number) => void;
}) {
  const [pages, setPages] = useState<{ index: number; dataUrl: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number>(1);

  useEffect(() => {
    let cancelled = false;
    if (!open || !file) return;
    setLoading(true);
    setPages([]);
    setSelected(1);
    (async () => {
      try {
        const pdf = await loadPdf(file);
        const total = pdf.numPages;
        // Auto-pick if single page
        if (total === 1) {
          onPick(1);
          return;
        }
        const results: { index: number; dataUrl: string }[] = [];
        for (let i = 1; i <= Math.min(total, 24); i++) {
          if (cancelled) return;
          const dataUrl = await renderPdfPageToDataUrl(pdf, i, 0.35);
          results.push({ index: i, dataUrl });
          if (!cancelled) setPages([...results]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a page</DialogTitle>
          <DialogDescription>
            This PDF has multiple pages. Pick the one that shows the venue map — it becomes the reference layer.
          </DialogDescription>
        </DialogHeader>
        {loading && pages.length === 0 ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Rendering pages…
          </div>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-auto sm:grid-cols-3">
            {pages.map((p) => (
              <button
                key={p.index}
                onClick={() => setSelected(p.index)}
                className={`rounded-md border-2 p-2 text-left transition ${
                  selected === p.index ? "border-primary" : "border-border/60 hover:border-border"
                }`}
              >
                <img src={p.dataUrl} alt={`Page ${p.index}`} className="mb-2 w-full rounded bg-white object-contain" />
                <p className="text-xs font-medium">Page {p.index}</p>
              </button>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={loading && pages.length === 0} onClick={() => onPick(selected)}>Use page {selected}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
