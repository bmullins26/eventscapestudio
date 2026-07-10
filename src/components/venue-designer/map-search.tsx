import { useEffect, useRef, useState } from "react";
import { Search, Loader2, MapPin, X } from "lucide-react";
import type L from "leaflet";

type Result = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string];
};

export function MapSearch({
  getMap,
  onPicked,
}: {
  getMap: () => L.Map | null;
  onPicked?: (r: { lat: number; lng: number; label: string }) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim() || q.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&addressdetails=0&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { Accept: "application/json" },
        });
        const json = (await res.json()) as Result[];
        setResults(json);
        setOpen(true);
      } catch (e: any) {
        if (e?.name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  const pick = (r: Result) => {
    const map = getMap();
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    if (map && Number.isFinite(lat) && Number.isFinite(lng)) {
      if (r.boundingbox && r.boundingbox.length === 4) {
        const [s, n, w, e] = r.boundingbox.map(parseFloat);
        map.fitBounds(
          [
            [s, w],
            [n, e],
          ],
          { maxZoom: 19 },
        );
      } else {
        map.setView([lat, lng], 18);
      }
    }
    onPicked?.({ lat, lng, label: r.display_name });
    setOpen(false);
    setQ(r.display_name);
  };

  return (
    <div className="pointer-events-auto absolute left-1/2 top-16 z-[500] w-[min(480px,calc(100vw-2rem))] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/95 px-3 py-1.5 shadow-md backdrop-blur">
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search for an address or place…"
          className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <button
            aria-label="Clear"
            onClick={() => { setQ(""); setResults([]); setOpen(false); }}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="mt-1.5 max-h-80 overflow-auto rounded-2xl border border-border/70 bg-background/98 py-1 shadow-lg backdrop-blur">
          {results.map((r) => (
            <button
              key={r.place_id}
              onClick={() => pick(r)}
              className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 text-center text-[10px] text-muted-foreground/80">
        Search © OpenStreetMap
      </p>
    </div>
  );
}
