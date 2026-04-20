"use client";

import { useState, useMemo } from "react";
import { LOCAL_INTEL_DATA } from "@/lib/localIntelData";
import {
  MapPin, Download, RefreshCw, Filter, TrendingUp,
  Store, Building2, Utensils, Heart, Landmark, Zap,
  Search, ChevronDown, BarChart2, Globe
} from "lucide-react";

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

const ZIP_OPTIONS = ["All", "32082", "32081"];
const GROUP_OPTIONS = ["All", ...Object.keys(CATEGORY_GROUPS)];

export default function LocalIntelPage() {
  const [search, setSearch]     = useState("");
  const [zip, setZip]           = useState("All");
  const [group, setGroup]       = useState("All");
  const [sortBy, setSortBy]     = useState<"confidence"|"name"|"category">("confidence");
  const [selected, setSelected] = useState<(typeof LOCAL_INTEL_DATA)[0] | null>(null);

  const filtered = useMemo(() => {
    return LOCAL_INTEL_DATA
      .filter(b => {
        if (zip !== "All" && b.zip !== zip) return false;
        if (group !== "All" && getGroup(b.category) !== group) return false;
        if (search && !b.name.toLowerCase().includes(search.toLowerCase()) &&
            !b.category.toLowerCase().includes(search.toLowerCase()) &&
            !b.address.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "confidence") return b.confidence - a.confidence;
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return a.category.localeCompare(b.category);
      });
  }, [search, zip, group, sortBy]);

  // Zone summary stats
  const stats82 = LOCAL_INTEL_DATA.filter(b => b.zip === "32082");
  const stats81 = LOCAL_INTEL_DATA.filter(b => b.zip === "32081");
  const groupCounts = Object.fromEntries(
    Object.keys(CATEGORY_GROUPS).map(g => [g, LOCAL_INTEL_DATA.filter(b => getGroup(b.category) === g).length])
  );

  function downloadCSV() {
    const headers = ["name","category","zip","lat","lon","address","phone","website","hours","confidence","sources"];
    const rows = filtered.map(b =>
      headers.map(h => {
        const v = (b as Record<string,unknown>)[h];
        if (Array.isArray(v)) return v.join("|");
        return String(v ?? "").replace(/,/g,"");
      }).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `local-intel-32081-32082-${Date.now()}.csv`;
    a.click();
  }

  function downloadGeoJSON() {
    const geojson = {
      type: "FeatureCollection",
      metadata: {
        generated: new Date().toISOString(),
        source: "MCFL Local Intelligence Network",
        zips: ["32081","32082"],
        totalFeatures: filtered.filter(b => b.lat && b.lon).length,
      },
      features: filtered
        .filter(b => b.lat && b.lon)
        .map(b => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [b.lon, b.lat] },
          properties: { ...b },
        })),
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `local-intel-32081-32082.geojson`;
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
            {LOCAL_INTEL_DATA.length} businesses · OSM + public records · Ponte Vedra Beach + Nocatee
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
        </div>
      </div>

      <div className="flex h-[calc(100vh-120px)]">
        {/* Left: stats + filters */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4 space-y-4">
          {/* Zone cards */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Zones</p>
            <div className="space-y-2">
              {[{zip:"32082",label:"Ponte Vedra Beach",data:stats82},{zip:"32081",label:"Nocatee",data:stats81}].map(z => (
                <button key={z.zip}
                  onClick={() => setZip(zip === z.zip ? "All" : z.zip)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    zip === z.zip ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/30 hover:border-border/80"
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{z.zip}</span>
                    <span className="text-lg font-bold">{z.data.length}</span>
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
                <span className="font-bold">{LOCAL_INTEL_DATA.length}</span>
              </button>
              {Object.entries(CATEGORY_GROUPS).map(([key, cfg]) => {
                const Icon = cfg.icon;
                const count = groupCounts[key] || 0;
                return (
                  <button key={key} onClick={() => setGroup(group === key ? "All" : key)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between gap-2 ${
                      group === key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    <span className="flex items-center gap-1.5">
                      <Icon className={`w-3 h-3 ${cfg.color}`} />
                      {cfg.label}
                    </span>
                    <span className="font-bold">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Data freshness */}
          <div className="rounded-xl border border-border bg-secondary/20 p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Data Sources</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">OpenStreetMap</span><span className="text-green-400">✓ Live</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">FL Sunbiz</span><span className="text-yellow-400">⏳ Pending</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">SJC Property Appraiser</span><span className="text-yellow-400">⏳ Pending</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Utility Records</span><span className="text-muted-foreground">PRR needed</span></div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Last sync: today</p>
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
                placeholder="Search businesses..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary rounded-lg border border-border focus:outline-none focus:border-primary/40"
              />
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs bg-secondary border border-border rounded-lg px-2 py-1.5 text-muted-foreground focus:outline-none">
              <option value="confidence">Sort: Confidence</option>
              <option value="name">Sort: Name A-Z</option>
              <option value="category">Sort: Category</option>
            </select>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{filtered.length} shown</span>
          </div>

          {/* Business rows */}
          <div className="flex-1 overflow-y-auto">
            {filtered.map((b, i) => {
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
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
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
              <p className="text-xs text-muted-foreground">Sources: {selected.sources.join(", ")}</p>
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
