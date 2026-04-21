"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  MapPin, Download, RefreshCw, Filter, TrendingUp,
  Store, Building2, Utensils, Heart, Landmark, Zap,
  Search, ChevronDown, BarChart2, Globe, PlusCircle, Loader2
} from "lucide-react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Business {
  name: string;
  category: string;
  zip?: string;
  lat?: number;
  lon?: number;
  address?: string;
  phone?: string;
  website?: string;
  hours?: string;
  confidence: number;
  sources?: string[];
  possibly_closed?: boolean;
  staleness?: { tier: string; grade: string; age_days: number | null; freshness_warning: string | null };
}

const CATEGORY_GROUPS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  food:       { label: "Food & Drink",    icon: Utensils,  color: "text-orange-400" },
  retail:     { label: "Retail",          icon: Store,     color: "text-blue-400"   },
  health:     { label: "Health",          icon: Heart,     color: "text-red-400"    },
  services:   { label: "Services",        icon: Zap,       color: "text-yellow-400" },
  civic:      { label: "Civic & Faith",   icon: Landmark,  color: "text-purple-400" },
  finance:    { label: "Finance",         icon: Building2, color: "text-green-400"  },
  other:      { label: "Other",           icon: MapPin,    color: "text-muted-foreground" },
};

const CAT_MAP: Record<string, string> = {
  restaurant: "food", fast_food: "food", cafe: "food", bar: "food", pub: "food",
  ice_cream: "food", food_court: "food", alcohol: "food",
  supermarket: "retail", convenience: "retail", clothes: "retail", shoes: "retail",
  electronics: "retail", hardware: "retail", furniture: "retail", books: "retail",
  hairdresser: "retail", beauty: "retail", chemist: "retail", nutrition_supplements: "retail",
  mobile_phone: "retail", copyshop: "retail", dry_cleaning: "retail", laundry: "retail",
  pet: "retail", florist: "retail", sports: "retail",
  dentist: "health", clinic: "health", hospital: "health", doctor: "health",
  optician: "health", veterinary: "health", pharmacy: "health",
  fitness_centre: "health", gym: "health", sports_centre: "health", swimming_pool: "health",
  water_park: "health", yoga: "health",
  bank: "finance", atm: "finance", estate_agent: "finance", insurance: "finance",
  financial: "finance", accountant: "finance",
  school: "civic", college: "civic", university: "civic", kindergarten: "civic",
  library: "civic", place_of_worship: "civic", church: "civic", mosque: "civic",
  synagogue: "civic", social_centre: "civic", community_centre: "civic",
  post_office: "civic", police: "civic", fire_station: "civic", government: "civic",
  fuel: "services", car_wash: "services", car_repair: "services",
  hotel: "services", motel: "services", office: "services",
  slipway: "other",
};

function getGroup(cat: string): string {
  return CAT_MAP[cat] || "other";
}

function getConfidenceBadge(score: number) {
  if (score >= 90) return { label: "HIGH",   cls: "bg-green-500/15 text-green-400"  };
  if (score >= 70) return { label: "MED",    cls: "bg-yellow-500/15 text-yellow-400"};
  return               { label: "LOW",    cls: "bg-red-500/15 text-red-400"      };
}

// ── Live MCP fetch ─────────────────────────────────────────────────────────────

async function fetchLive(query: string, zip: string, group: string, limit = 30): Promise<{ results: Business[]; total: number }> {
  const args: Record<string, string | number> = { limit };
  if (query.trim()) args.query = query.trim();
  if (zip !== "All") args.zip = zip;
  // group filter applied client-side after fetch

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "local_intel_search", arguments: args },
  };

  const res = await fetch(`${RAILWAY}/api/local-intel/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const raw = json.result ?? json;
  let data: { results?: Business[]; total?: number; returned?: number };
  try {
    if (raw?.content?.[0]?.text) data = JSON.parse(raw.content[0].text);
    else data = raw;
  } catch { data = { results: [], total: 0 }; }

  return { results: data.results ?? [], total: data.total ?? data.results?.length ?? 0 };
}

// ── Stats fetch ───────────────────────────────────────────────────────────────

async function fetchStats(): Promise<{ total: number; zip81: number; zip82: number; groupCounts: Record<string,number> }> {
  try {
    const res = await fetch(`${RAILWAY}/api/local-intel/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "local_intel_stats", arguments: {} } }),
    });
    const json = await res.json();
    const raw = json.result ?? json;
    let data: Record<string, unknown>;
    try { data = raw?.content?.[0]?.text ? JSON.parse(raw.content[0].text) : raw; }
    catch { data = {}; }
    // stats endpoint returns total, by_zip, by_group
    const total = (data.total as number) ?? 0;
    const byZip = (data.by_zip as Record<string,number>) ?? {};
    const byGroup = (data.by_group as Record<string,number>) ?? {};
    return {
      total,
      zip81: byZip["32081"] ?? 0,
      zip82: byZip["32082"] ?? 0,
      groupCounts: byGroup,
    };
  } catch {
    return { total: 0, zip81: 0, zip82: 0, groupCounts: {} };
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LocalIntelPage() {
  const [search, setSearch]       = useState("");
  const [zip, setZip]             = useState("All");
  const [group, setGroup]         = useState("All");
  const [sortBy, setSortBy]       = useState<"confidence"|"name"|"category">("confidence");
  const [selected, setSelected]   = useState<Business | null>(null);
  const [results, setResults]     = useState<Business[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const [stats, setStats]         = useState({ total: 0, zip81: 0, zip82: 0, groupCounts: {} as Record<string,number> });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load stats on mount
  useEffect(() => {
    fetchStats().then(s => setStats(s));
    // Initial load: show all
    doSearch("", "All", "All");
  }, []);

  const doSearch = useCallback(async (q: string, z: string, g: string) => {
    setLoading(true);
    try {
      const { results: raw, total: t } = await fetchLive(q, z, g, 50);
      // Apply group filter client-side
      const filtered = g !== "All" ? raw.filter(b => getGroup(b.category) === g) : raw;
      // Sort
      const sorted = [...filtered].sort((a, b) => {
        if (sortBy === "confidence") return b.confidence - a.confidence;
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return a.category.localeCompare(b.category);
      });
      setResults(sorted);
      setTotal(t);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  // Debounced search on input change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(search, zip, group);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, zip, group, doSearch]);

  function downloadCSV() {
    const headers = ["name","category","zip","lat","lon","address","phone","website","hours","confidence"];
    const rows = results.map(b =>
      headers.map(h => {
        const v = (b as unknown as Record<string,unknown>)[h];
        if (Array.isArray(v)) return v.join("|");
        return String(v ?? "").replace(/,/g,"");
      }).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `local-intel-${Date.now()}.csv`;
    a.click();
  }

  function downloadGeoJSON() {
    const geojson = {
      type: "FeatureCollection",
      metadata: { generated: new Date().toISOString(), source: "MCFL LocalIntel", total: results.filter(b => b.lat && b.lon).length },
      features: results.filter(b => b.lat && b.lon).map(b => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [b.lon, b.lat] },
        properties: { ...b },
      })),
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `local-intel-${Date.now()}.geojson`;
    a.click();
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="border-b border-border px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Local Intelligence — 32082 / 32081
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.total > 0 ? `${stats.total.toLocaleString()} businesses` : "Loading…"} · Live Railway dataset · Ponte Vedra Beach + Nocatee
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadGeoJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs text-muted-foreground hover:text-foreground transition-all">
            <Download className="w-3 h-3" /> GeoJSON
          </button>
          <button onClick={downloadCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs text-muted-foreground hover:text-foreground transition-all">
            <Download className="w-3 h-3" /> CSV
          </button>
          <Link href="/local-intel/claim"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all">
            <PlusCircle className="w-3 h-3" /> Claim Business
          </Link>
        </div>
      </div>

      <div className="flex h-[calc(100vh-120px)]">
        {/* Left: stats + filters */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4 space-y-4">
          {/* Zone cards */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Zones</p>
            <div className="space-y-2">
              {[
                { zip: "32082", label: "Ponte Vedra Beach", count: stats.zip82 },
                { zip: "32081", label: "Nocatee",           count: stats.zip81 },
              ].map(z => (
                <button key={z.zip}
                  onClick={() => setZip(zip === z.zip ? "All" : z.zip)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    zip === z.zip ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/30 hover:border-border/80"
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{z.zip}</span>
                    <span className="text-lg font-bold">{z.count > 0 ? z.count : "—"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{z.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Category groups */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Category</p>
            <div className="space-y-1">
              <button onClick={() => setGroup("All")}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between ${
                  group === "All" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
                <span>All categories</span>
                <span className="font-bold">{stats.total || "—"}</span>
              </button>
              {Object.entries(CATEGORY_GROUPS).map(([key, cfg]) => {
                const Icon = cfg.icon;
                const count = stats.groupCounts[key] || 0;
                return (
                  <button key={key} onClick={() => setGroup(group === key ? "All" : key)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between gap-2 ${
                      group === key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    <span className="flex items-center gap-1.5">
                      <Icon className={`w-3 h-3 ${cfg.color}`} />
                      {cfg.label}
                    </span>
                    <span className="font-bold">{count > 0 ? count : "—"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Data sources */}
          <div className="rounded-xl border border-border bg-secondary/20 p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Data Sources</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">OpenStreetMap</span><span className="text-green-400">✓ Live</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">YellowPages</span><span className="text-green-400">✓ Live</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">SJC Chamber</span><span className="text-green-400">✓ Live</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">BBB Directory</span><span className="text-green-400">✓ Live</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">FL Sunbiz</span><span className="text-yellow-400">⏳ Active</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">SJC BTR</span><span className="text-green-400">✓ Live</span></div>
            </div>
          </div>
        </div>

        {/* Center: business list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search + sort bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search 1,300+ businesses live…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary rounded-lg border border-border focus:outline-none focus:border-primary/40"
              />
              {loading && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground animate-spin" />
              )}
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs bg-secondary border border-border rounded-lg px-2 py-1.5 text-muted-foreground focus:outline-none">
              <option value="confidence">Sort: Confidence</option>
              <option value="name">Sort: Name A-Z</option>
              <option value="category">Sort: Category</option>
            </select>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {loading ? "…" : `${results.length} shown`}
              {total > results.length ? ` of ${total.toLocaleString()}` : ""}
            </span>
          </div>

          {/* Business rows */}
          <div className="flex-1 overflow-y-auto">
            {!loading && results.length === 0 && (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                No businesses matched "{search}" in the live dataset.
              </div>
            )}
            {results.map((b, i) => {
              const badge = getConfidenceBadge(b.confidence);
              const grp = CATEGORY_GROUPS[getGroup(b.category)];
              const Icon = grp?.icon || MapPin;
              const isSelected = selected?.name === b.name && selected?.lat === b.lat;

              return (
                <button key={i}
                  onClick={() => setSelected(isSelected ? null : b)}
                  className={`w-full text-left px-4 py-3 border-b border-border/50 transition-all hover:bg-secondary/30 ${
                    isSelected ? "bg-secondary/50" : ""
                  }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${grp?.color || "text-muted-foreground"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{b.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {b.category.replace(/_/g," ")} · {b.zip || "zip untagged"}
                        </p>
                        {b.address && <p className="text-xs text-muted-foreground/70 truncate">{b.address}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {b.staleness?.tier && b.staleness.tier !== "FRESH" && (
                        <span className="text-xs text-muted-foreground/50">{b.staleness.tier}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: detail panel */}
        {selected && (
          <div className="w-72 shrink-0 border-l border-border overflow-y-auto p-4 space-y-4">
            <div>
              <h2 className="text-base font-bold">{selected.name}</h2>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{selected.category.replace(/_/g," ")}</p>
            </div>

            <div className="space-y-2 text-xs">
              {selected.address && (
                <div>
                  <p className="text-muted-foreground font-medium mb-0.5">Address</p>
                  <p>{selected.address}{selected.zip ? `, ${selected.zip}` : ""}</p>
                </div>
              )}
              {selected.phone && (
                <div>
                  <p className="text-muted-foreground font-medium mb-0.5">Phone</p>
                  <a href={`tel:${selected.phone}`} className="text-primary hover:underline">{selected.phone}</a>
                </div>
              )}
              {selected.website && (
                <div>
                  <p className="text-muted-foreground font-medium mb-0.5">Website</p>
                  <a href={selected.website} target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:underline truncate block">{selected.website}</a>
                </div>
              )}
              {selected.hours && (
                <div>
                  <p className="text-muted-foreground font-medium mb-0.5">Hours</p>
                  <p className="text-xs leading-relaxed">{selected.hours}</p>
                </div>
              )}
              {selected.lat && selected.lon && (
                <div>
                  <p className="text-muted-foreground font-medium mb-0.5">Coordinates</p>
                  <p className="font-mono">{selected.lat}, {selected.lon}</p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Intelligence Score</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all"
                    style={{width:`${selected.confidence}%`}} />
                </div>
                <span className="text-xs font-bold">{selected.confidence}/100</span>
              </div>
              {selected.sources && (
                <p className="text-xs text-muted-foreground">Sources: {selected.sources.join(", ")}</p>
              )}
              {selected.staleness?.freshness_warning && (
                <p className="text-xs text-yellow-500">{selected.staleness.freshness_warning}</p>
              )}
            </div>

            {selected.lat && selected.lon && (
              <a
                href={`https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lon}&zoom=17`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-border bg-secondary text-xs text-muted-foreground hover:text-foreground transition-all">
                <MapPin className="w-3 h-3" /> View on OSM
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
