import { Link } from "@tanstack/react-router";
import {
  Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem,
  MenubarSeparator, MenubarSub, MenubarSubTrigger, MenubarSubContent, MenubarShortcut,
} from "@/components/ui/menubar";
import { ChevronLeft } from "lucide-react";
import { LIBRARY_CATEGORIES, catalogByCategory } from "./object-catalog";

export type MenuBarProps = {
  venueName: string;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onLock: () => void;
  onHide: () => void;
  onRename: () => void;
  onSaveAsAsset: () => void;
  onSelectAll: () => void;

  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onZoom100: () => void;
  onToggleGrid: () => void;
  onToggleRulers: () => void;
  onToggleSnap: () => void;
  onToggleMinimap: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleDrawer: () => void;
  onPresent: () => void;

  onAlign: (dir: "left" | "center" | "right" | "top" | "middle" | "bottom") => void;
  onDistribute: (axis: "h" | "v") => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onFlip: (axis: "h" | "v") => void;

  onInsertType: (type: string) => void;
  onInsertReference: () => void;
  onOpenLibrary: () => void;

  onAiTrace: () => void;
  onAiGenerateBooths: () => void;
  onAiAsk: () => void;

  onPublishVersion: () => void;
  onManageVersions: () => void;

  gridOn: boolean;
  rulersOn: boolean;
  snapOn: boolean;
  minimapOn: boolean;
};

export function MenuBar(p: MenuBarProps) {
  const byCat = catalogByCategory();
  return (
    <div className="flex items-center gap-2 border-b bg-card px-2 py-1">
      <Link to="/studio/venues" className="ml-1 mr-1 inline-flex h-8 items-center rounded px-2 text-xs hover:bg-muted">
        <ChevronLeft className="mr-1 h-4 w-4" /> Venues
      </Link>
      <Menubar className="h-8 border-0 bg-transparent p-0">
        <MenubarMenu>
          <MenubarTrigger className="text-xs">Menu</MenubarTrigger>
          <MenubarContent>
            <MenubarItem asChild><Link to="/studio/venues">Back to Venues</Link></MenubarItem>
            <MenubarItem disabled>Duplicate venue</MenubarItem>
            <MenubarSeparator />
            <MenubarItem disabled>Import…</MenubarItem>
            <MenubarSub>
              <MenubarSubTrigger>Export</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem disabled>PNG</MenubarItem>
                <MenubarItem disabled>PDF</MenubarItem>
                <MenubarItem disabled>SVG</MenubarItem>
                <MenubarItem disabled>JSON</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
            <MenubarItem disabled>Print…</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">Venue</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={p.onRename}>Rename</MenubarItem>
            <MenubarItem disabled>Canvas size…</MenubarItem>
            <MenubarItem disabled>Units…</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={p.onInsertReference}>Add reference image…</MenubarItem>
            <MenubarItem disabled>Reference alignment…</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={p.onPublishVersion}>Snapshot / publish version</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">Edit</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={p.onUndo}>Undo <MenubarShortcut>⌘Z</MenubarShortcut></MenubarItem>
            <MenubarItem onClick={p.onRedo}>Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut></MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={p.onDuplicate}>Duplicate <MenubarShortcut>⌘D</MenubarShortcut></MenubarItem>
            <MenubarItem onClick={p.onDelete}>Delete <MenubarShortcut>⌫</MenubarShortcut></MenubarItem>
            <MenubarItem onClick={p.onSelectAll}>Select all <MenubarShortcut>⌘A</MenubarShortcut></MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={p.onGroup}>Group <MenubarShortcut>⌘G</MenubarShortcut></MenubarItem>
            <MenubarItem onClick={p.onUngroup}>Ungroup <MenubarShortcut>⇧⌘G</MenubarShortcut></MenubarItem>
            <MenubarItem onClick={p.onLock}>Lock / Unlock</MenubarItem>
            <MenubarItem onClick={p.onHide}>Hide / Show</MenubarItem>
            <MenubarItem onClick={p.onRename}>Rename</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={p.onSaveAsAsset}>Save as asset…</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">View</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={p.onZoomIn}>Zoom in</MenubarItem>
            <MenubarItem onClick={p.onZoomOut}>Zoom out</MenubarItem>
            <MenubarItem onClick={p.onZoomFit}>Fit</MenubarItem>
            <MenubarItem onClick={p.onZoom100}>100%</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={p.onToggleGrid}>{p.gridOn ? "Hide" : "Show"} grid</MenubarItem>
            <MenubarItem onClick={p.onToggleRulers}>{p.rulersOn ? "Hide" : "Show"} rulers</MenubarItem>
            <MenubarItem onClick={p.onToggleSnap}>{p.snapOn ? "Disable" : "Enable"} smart snap</MenubarItem>
            <MenubarItem onClick={p.onToggleMinimap}>{p.minimapOn ? "Hide" : "Show"} minimap</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={p.onToggleLeft}>Toggle left panel</MenubarItem>
            <MenubarItem onClick={p.onToggleRight}>Toggle right panel</MenubarItem>
            <MenubarItem onClick={p.onToggleDrawer}>Toggle bottom drawer</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={p.onPresent}>Presentation mode <MenubarShortcut>F5</MenubarShortcut></MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">Insert</MenubarTrigger>
          <MenubarContent className="max-h-[70vh] overflow-auto">
            {LIBRARY_CATEGORIES.filter((c) => (byCat[c]?.length ?? 0) > 0).map((cat) => (
              <MenubarSub key={cat}>
                <MenubarSubTrigger>{cat}</MenubarSubTrigger>
                <MenubarSubContent className="max-h-[60vh] overflow-auto">
                  {byCat[cat].map((o) => (
                    <MenubarItem key={o.type} onClick={() => p.onInsertType(o.type)}>{o.label}</MenubarItem>
                  ))}
                </MenubarSubContent>
              </MenubarSub>
            ))}
            <MenubarSeparator />
            <MenubarItem onClick={p.onInsertReference}>Reference image / PDF…</MenubarItem>
            <MenubarItem onClick={p.onOpenLibrary}>From org library…</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">Arrange</MenubarTrigger>
          <MenubarContent>
            <MenubarSub>
              <MenubarSubTrigger>Align</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem onClick={() => p.onAlign("left")}>Left</MenubarItem>
                <MenubarItem onClick={() => p.onAlign("center")}>Center</MenubarItem>
                <MenubarItem onClick={() => p.onAlign("right")}>Right</MenubarItem>
                <MenubarSeparator />
                <MenubarItem onClick={() => p.onAlign("top")}>Top</MenubarItem>
                <MenubarItem onClick={() => p.onAlign("middle")}>Middle</MenubarItem>
                <MenubarItem onClick={() => p.onAlign("bottom")}>Bottom</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
            <MenubarSub>
              <MenubarSubTrigger>Distribute</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem onClick={() => p.onDistribute("h")}>Horizontally</MenubarItem>
                <MenubarItem onClick={() => p.onDistribute("v")}>Vertically</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
            <MenubarSeparator />
            <MenubarItem onClick={p.onBringForward}>Bring forward</MenubarItem>
            <MenubarItem onClick={p.onSendBackward}>Send backward</MenubarItem>
            <MenubarItem onClick={p.onBringToFront}>Bring to front</MenubarItem>
            <MenubarItem onClick={p.onSendToBack}>Send to back</MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => p.onFlip("h")}>Flip horizontal</MenubarItem>
            <MenubarItem onClick={() => p.onFlip("v")}>Flip vertical</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">AI</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={p.onAiTrace}>Trace reference drawing</MenubarItem>
            <MenubarItem onClick={p.onAiGenerateBooths}>Generate booth grid…</MenubarItem>
            <MenubarItem onClick={p.onAiAsk}>Ask AI…</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">Publish</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={p.onPublishVersion}>Publish version <MenubarShortcut>⌘S</MenubarShortcut></MenubarItem>
            <MenubarItem onClick={p.onManageVersions}>Manage versions…</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      <div className="mx-2 h-5 w-px bg-border" />
      <div className="truncate text-xs font-medium text-muted-foreground">{p.venueName}</div>
    </div>
  );
}
