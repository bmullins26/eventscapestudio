import { useMemo, useState } from "react";
import { Lock, Unlock, Eye, EyeOff, ChevronUp, ChevronDown } from "lucide-react";
import type { AnyElement } from "./types";
import type { DesignerActions } from "./store";
import { describe } from "./factory";
import { cn } from "@/lib/utils";

export function ObjectExplorer({
  elements, selection, actions,
}: {
  elements: AnyElement[]; selection: string[]; actions: DesignerActions;
}) {
  // Show top of z-order first, matching how they render (last = front → show first)
  const items = useMemo(() => [...elements].reverse(), [elements]);
  const [query, setQuery] = useState("");
  const filtered = items.filter((e) => describe(e).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      <div className="border-b border-border px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Objects</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="mt-1.5 h-7 w-full rounded border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">No objects yet.</div>
        )}
        {filtered.map((el) => {
          const active = selection.includes(el.id);
          return (
            <div
              key={el.id}
              className={cn(
                "flex items-center gap-1 border-b border-border/50 px-2 py-1.5 text-xs",
                active && "bg-primary/10",
              )}
            >
              <button
                className="min-w-0 flex-1 truncate text-left hover:text-primary"
                onClick={() => actions.select([el.id])}
                title={describe(el)}
              >
                <span className="text-[10px] uppercase text-muted-foreground mr-1.5">{el.kind}</span>
                {describe(el)}
              </button>
              <IconBtn title="Move forward" onClick={() => actions.reorder(el.id, 1)}><ChevronUp className="h-3 w-3" /></IconBtn>
              <IconBtn title="Move backward" onClick={() => actions.reorder(el.id, -1)}><ChevronDown className="h-3 w-3" /></IconBtn>
              <IconBtn title={el.hidden ? "Show" : "Hide"} onClick={() => actions.update(el.id, { hidden: !el.hidden })}>
                {el.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </IconBtn>
              <IconBtn title={el.locked ? "Unlock" : "Lock"} onClick={() => actions.update(el.id, { locked: !el.locked })}>
                {el.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              </IconBtn>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground">
      {children}
    </button>
  );
}
