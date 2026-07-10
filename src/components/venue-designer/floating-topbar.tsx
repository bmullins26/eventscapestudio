import { ArrowLeft, Undo2, Redo2, Download, Share2, MoreHorizontal } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function FloatingTopbar({
  venueName, saving,
  onUndo, onRedo, onExport, onShare,
  onRename, onPresent, onManageVersions, onPublish,
  onOpenLayers, onOpenObjects, onOpenReferences, onOpenLibrary, onOpenVersions,
  onSaveMapLocation, mapLocationSaved,
}: {
  venueName: string;
  saving?: boolean;
  onUndo: () => void; onRedo: () => void;
  onExport: () => void; onShare: () => void;
  onRename: () => void; onPresent: () => void; onManageVersions: () => void; onPublish: () => void;
  onOpenLayers: () => void; onOpenObjects: () => void; onOpenReferences: () => void;
  onOpenLibrary: () => void; onOpenVersions: () => void;
  onSaveMapLocation: () => void;
  mapLocationSaved: boolean;
}) {
  return (
    <div className="pointer-events-none absolute left-3 right-3 top-3 z-[500] flex items-start justify-between gap-3">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/70 bg-background/95 px-2 py-1.5 shadow-md backdrop-blur">
        <Link to="/studio/venues" className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Back to venues">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 max-w-[240px] truncate px-2 text-sm font-medium">{venueName}</div>
        {saving && <span className="ml-1 text-[10px] text-muted-foreground">Saving…</span>}
      </div>

      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/70 bg-background/95 px-1.5 py-1 shadow-md backdrop-blur">
        <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onUndo} title="Undo (⌘Z)">
          <Undo2 className="h-4 w-4" />
        </button>
        <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onRedo} title="Redo (⌘⇧Z)">
          <Redo2 className="h-4 w-4" />
        </button>
      </div>

      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border/70 bg-background/95 p-1 shadow-md backdrop-blur">
        <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={onExport}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> Export
        </Button>
        <Button size="sm" className="h-8 rounded-full px-3 text-xs" onClick={onShare}>
          <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" title="More">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={onSaveMapLocation}>
              {mapLocationSaved ? "Update map location" : "Save map location…"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenLibrary}>Object library</DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenLayers}>Layers</DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenObjects}>Objects list</DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenReferences}>References & AI import</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onPublish}>Publish version…</DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenVersions}>Manage versions</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRename}>Rename venue…</DropdownMenuItem>
            <DropdownMenuItem onClick={onPresent}>Presentation mode</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
