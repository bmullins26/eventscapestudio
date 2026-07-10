import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** A collapsible left rail used for the object library and other panels. */
export function SideSheet({
  open, onClose, title, width = 288, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className={cn(
        "pointer-events-auto absolute left-3 top-20 bottom-20 z-[500]",
        "flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-xl backdrop-blur"
      )}
      style={{ width }}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
