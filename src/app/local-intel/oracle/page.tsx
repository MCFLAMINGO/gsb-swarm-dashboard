"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Zap, TrendingUp, TrendingDown, AlertTriangle, Target,
  Utensils, DollarSign, Home, Building2, RefreshCw,
  Eye, Radio, ChevronRight, Minus, ArrowUpRight,
  BarChart2, Users, Flame
} from "lucide-react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";
const REFRESH_MS = 30_000;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ZipIndexEntry {
  name: string;
  saturation_status: string;       // "undersupplied" | "balanced" | "saturated" | "oversaturated"
  capture_rate_pct: number;
  growth_state: string;            // "growing" | "stable" | "transitioning" | "transient"
  consumer_profile: string;
  top_gap: string | null;          // "budget" | "midrange" | "upscale" | "fine" | null
  computed_at: string;
}

interface OracleIndex {
  generated_at: string;
  zips: Record<string, ZipIndexEntry>;
}

interface OracleDetail {
  zip: string;
  name: string;
  computed_at: string;
  demographics: {
    population: number;
    median_household_income: number;
    median_home_value: number;
    owner_occupied_pct: number;
    consumer_profile: string;
  };
  restaurant_capacity: {
    restaurant_count: number;
    total_businesses: number;
    capture_rate_pct: number;
    saturation_status: string;
    restaurants_market_can_support: number;
    gap_count: number;
    estimated_daily_meal_demand: number;
  };
  market_gaps: {
    top_gap: { tier: string; gap: number; description: string; status: string } | null;
    price_tier_gaps: Array<{
      tier: string;
      gap: number;
      status: string;
      description: string;
      expected_count: number;
      actual_count: number;
    }>;
    school_count: number;
  };
  growth_trajectory: {
    state: string;
    label: string;
    confidence: string;
    school_count: number;
    owner_occupied_pct: number;
    infrastructure_momentum: number;
    active_construction: number;
  };
  top_questions: Array<{
    question: string;
    answer: string;
    signal_strength: string;
    category: string;
  }>;
  oracle_narrative: string;
}

// ── Signal generation ─────────────────────────────────────────────────────────

interface Signal {
  id: string;
  zip: string;
  name: string;
  type: "opportunity" | "saturation" | "growth" | "gap" | "anomaly" | "caution";
  strength: "high" | "medium" | "low";
  headline: string;
  subline: string;
  icon: React.ElementType;
  detail?: OracleDetail;
  loading?: boolean;
}

function buildSignalsFromIndex(index: OracleIndex): Signal[] {
  const signals: Signal[] = [];

  for (const [zip, entry] of Object.entries(index.zips)) {
    // ── Undersupplied market ─────────────────────────────────────────────────
    if (entry.saturation_status === "undersupplied") {
      const gap = Math.max(0, 100 - entry.capture_rate_pct);
      signals.push({
        id: `${zip}-undersupplied`,
        zip,
        name: entry.name || zip,
        type: "opportunity",
        strength: gap > 40 ? "high" : gap > 20 ? "medium" : "low",
        headline: `${entry.name || zip} has room for more restaurants`,
        subline: `Market only ${entry.capture_rate_pct.toFixed(0)}% captured — ${gap.toFixed(0)}% of demand unmet`,
        icon: Utensils,
      });
    }

    // ── Oversaturated market ─────────────────────────────────────────────────
    if (entry.saturation_status === "oversaturated") {
      signals.push({
        id: `${zip}-oversaturated`,
        zip,
        name: entry.name || zip,
        type: "caution",
        strength: "high",
        headline: `${entry.name || zip} — restaurant market oversaturated`,
        subline: `${entry.capture_rate_pct.toFixed(0)}% capture rate: existing supply exceeds demand`,
        icon: AlertTriangle,
      });
    }

    // ── Price tier gap ───────────────────────────────────────────────────────
    if (entry.top_gap) {
      const tierLabel: Record<string, string> = {
        budget: "budget / fast casual",
        midrange: "midrange casual dining",
        upscale: "upscale dining",
        fine: "fine dining",
      };
      signals.push({
        id: `${zip}-gap-${entry.top_gap}`,
        zip,
        name: entry.name || zip,
        type: "gap",
        strength: entry.top_gap === "upscale" || entry.top_gap === "fine" ? "high" : "medium",
        headline: `Price tier gap: ${tierLabel[entry.top_gap] || entry.top_gap} in ${entry.name || zip}`,
        subline: `Income profile demands more ${entry.top_gap} options than currently exist`,
        icon: DollarSign,
      });
    }

    // ── Active growth zones ──────────────────────────────────────────────────
    if (entry.growth_state === "growing") {
      signals.push({
        id: `${zip}-growing`,
        zip,
        name: entry.name || zip,
        type: "growth",
        strength: "high",
        headline: `${entry.name || zip} — active family formation`,
        subline: `High ownership + schools = customer base being built now`,
        icon: TrendingUp,
      });
    }

    // ── Empty nest transition ────────────────────────────────────────────────
    if (entry.growth_state === "transitioning") {
      signals.push({
        id: `${zip}-transitioning`,
        zip,
        name: entry.name || zip,
        type: "anomaly",
        strength: "medium",
        headline: `${entry.name || zip} — empty nest shift`,
        subline: `Aging owner base, high home values, fewer kids: pivot to leisure + health`,
        icon: Home,
      });
    }

    // ── High consumer profile with saturation balance ────────────────────────
    if (
      (entry.consumer_profile === "affluent" || entry.consumer_profile === "luxury") &&
      entry.saturation_status === "balanced"
    ) {
      signals.push({
        id: `${zip}-affluent-balanced`,
        zip,
        name: entry.name || zip,
        type: "opportunity",
        strength: "medium",
        headline: `${entry.name || zip} — high-income balanced market`,
        subline: `${entry.consumer_profile} consumer base, market not yet oversupplied`,
        icon: Target,
      });
    }
  }

  // Sort: high strength first, then by type priority
  const typePriority: Record<string, number> = {
    opportunity: 1, gap: 2, growth: 3, anomaly: 4, saturation: 5, caution: 6,
  };
  const strengthPriority: Record<string, number> = { high: 0, medium: 1, low: 2 };

  return signals.sort((a, b) => {
    const sDiff = strengthPriority[a.strength] - strengthPriority[b.strength];
    if (sDiff !== 0) return sDiff;
    return (typePriority[a.type] || 9) - (typePriority[b.type] || 9);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

const TYPE_COLORS: Record<string, string> = {
  opportunity: "border-emerald-500/40 bg-emerald-500/5",
  gap:         "border-amber-500/40 bg-amber-500/5",
  growth:      "border-blue-500/40 bg-blue-500/5",
  anomaly:     "border-purple-500/40 bg-purple-500/5",
  caution:     "border-red-500/40 bg-red-500/5",
  saturation:  "border-orange-500/40 bg-orange-500/5",
};

const TYPE_BADGE: Record<string, string> = {
  opportunity: "bg-emerald-500/15 text-emerald-400",
  gap:         "bg-amber-500/15 text-amber-400",
  growth:      "bg-blue-500/15 text-blue-400",
  anomaly:     "bg-purple-500/15 text-purple-400",
  caution:     "bg-red-500/15 text-red-400",
  saturation:  "bg-orange-500/15 text-orange-400",
};

const TYPE_ICON_COLOR: Record<string, string> = {
  opportunity: "text-emerald-400",
  gap:         "text-amber-400",
  growth:      "text-blue-400",
  anomaly:     "text-purple-400",
  caution:     "text-red-400",
  saturation:  "text-orange-400",
};

const STRENGTH_DOT: Record<string, string> = {
  high:   "bg-red-400",
  medium: "bg-amber-400",
  low:    "bg-slate-500",
};

// ── Signal Card ───────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  expanded,
  onToggle,
}: {
  signal: Signal;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = signal.icon;
  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all cursor-pointer ${TYPE_COLORS[signal.type]}`}
      onClick={onToggle}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        {/* Strength dot */}
        <div className="mt-1.5 flex-shrink-0">
          <span className={`inline-block w-2 h-2 rounded-full ${STRENGTH_DOT[signal.strength]}`} />
        </div>

        {/* Icon */}
        <div className={`flex-shrink-0 mt-0.5 ${TYPE_ICON_COLOR[signal.type]}`}>
          <Icon size={16} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground leading-tight">
              {signal.headline}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold tracking-wide ${TYPE_BADGE[signal.type]}`}>
              {signal.type}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold tracking-wide ${TYPE_BADGE[signal.type]}`}>
              {signal.strength}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{signal.subline}</p>
        </div>

        {/* ZIP tag + expand */}
        <div className="flex-shrink-0 flex items-center gap-2">
          <span className="text-[10px] bg-muted/40 rounded px-1.5 py-0.5 text-muted-foreground font-mono">
            {signal.zip}
          </span>
          <ChevronRight
            size={14}
            className={`text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border/30 px-4 pb-4 pt-3">
          {signal.loading && (
            <p className="text-xs text-muted-foreground animate-pulse">Loading details…</p>
          )}
          {!signal.loading && signal.detail && (
            <DetailPanel detail={signal.detail} />
          )}
          {!signal.loading && !signal.detail && (
            <p className="text-xs text-muted-foreground">No detail data available yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ detail }: { detail: OracleDetail }) {
  const cap = detail.restaurant_capacity;
  const gaps = detail.market_gaps;
  const growth = detail.growth_trajectory;
  const dem = detail.demographics;

  return (
    <div className="space-y-4">
      {/* Oracle narrative */}
      {detail.oracle_narrative && (
        <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-border pl-3">
          {detail.oracle_narrative}
        </p>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Population" value={dem.population?.toLocaleString() || "—"} />
        <Stat label="Med. Income" value={dem.median_household_income ? `$${(dem.median_household_income / 1000).toFixed(0)}k` : "—"} />
        <Stat label="Restaurants" value={cap.restaurant_count?.toString() || "—"} />
        <Stat label="Can Support" value={cap.restaurants_market_can_support?.toString() || "—"} />
      </div>

      {/* Price tier gaps */}
      {gaps.price_tier_gaps?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Price Tier Gaps</p>
          <div className="space-y-1">
            {gaps.price_tier_gaps.map((g) => (
              <div key={g.tier} className="flex items-center gap-2 text-xs">
                <span className="w-16 font-medium capitalize text-foreground">{g.tier}</span>
                <span className="text-muted-foreground">exp {g.expected_count} / actual {g.actual_count}</span>
                <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  g.status === "undersupplied"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : g.status === "oversupplied"
                    ? "bg-red-500/15 text-red-400"
                    : "bg-muted/40 text-muted-foreground"
                }`}>
                  {g.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top questions */}
      {detail.top_questions?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Key Questions</p>
          <div className="space-y-2">
            {detail.top_questions.slice(0, 3).map((q, i) => (
              <div key={i} className="text-xs">
                <p className="font-medium text-foreground">{q.question}</p>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">{q.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Growth */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Growth: <span className="text-foreground">{growth.label}</span></span>
        <span>·</span>
        <span>Owner-occ: <span className="text-foreground">{growth.owner_occupied_pct}%</span></span>
        <span>·</span>
        <span>Schools: <span className="text-foreground">{growth.school_count}</span></span>
        {growth.infrastructure_momentum > 0 && (
          <>
            <span>·</span>
            <span>Infra: <span className="text-blue-400">{growth.infrastructure_momentum}</span></span>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/20 rounded p-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

const FILTER_TYPES = ["all", "opportunity", "gap", "growth", "anomaly", "caution"] as const;
type FilterType = (typeof FILTER_TYPES)[number];

// ── Main Component ────────────────────────────────────────────────────────────

export default function OracleSignalPage() {
  const [index, setIndex] = useState<OracleIndex | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [detailCache, setDetailCache] = useState<Record<string, OracleDetail>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [lastFetch, setLastFetch] = useState<string>("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchIndex = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`${RAILWAY}/api/local-intel/oracle`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: OracleIndex = await res.json();
      setIndex(data);
      setSignals(buildSignalsFromIndex(data));
      setLastFetch(new Date().toISOString());
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setFetching(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchIndex();
    timerRef.current = setInterval(fetchIndex, REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchIndex]);

  // Expand/collapse signal — lazy-load detail
  const handleToggle = useCallback(async (signal: Signal) => {
    const id = signal.id;
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);

    // Already cached?
    if (detailCache[signal.zip]) return;

    setLoadingDetail(id);
    try {
      const res = await fetch(`${RAILWAY}/api/local-intel/oracle?zip=${signal.zip}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const detail: OracleDetail = await res.json();
      setDetailCache((prev) => ({ ...prev, [signal.zip]: detail }));
    } catch {
      // fail silently — no detail panel
    } finally {
      setLoadingDetail(null);
    }
  }, [expandedId, detailCache]);

  const filtered = filter === "all" ? signals : signals.filter((s) => s.type === filter);

  // Compute summary counts
  const highCount   = signals.filter((s) => s.strength === "high").length;
  const oppCount    = signals.filter((s) => s.type === "opportunity").length;
  const gapCount    = signals.filter((s) => s.type === "gap").length;
  const zipCount    = index ? Object.keys(index.zips).length : 0;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Eye size={18} className="text-primary" />
            <h1 className="text-lg font-semibold">Oracle Signal Layer</h1>
            <span className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide">
              <Radio size={9} className="animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Scanning {zipCount} ZIPs · {signals.length} signals · refreshes every 30s
          </p>
        </div>

        <button
          onClick={fetchIndex}
          disabled={fetching}
          className="p-1.5 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors disabled:opacity-40"
          title="Refresh now"
        >
          <RefreshCw size={14} className={fetching ? "animate-spin text-primary" : "text-muted-foreground"} />
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-2">
        <SummaryChip icon={Flame} label="High signals" value={highCount.toString()} color="text-red-400" />
        <SummaryChip icon={TrendingUp} label="Opportunities" value={oppCount.toString()} color="text-emerald-400" />
        <SummaryChip icon={DollarSign} label="Price gaps" value={gapCount.toString()} color="text-amber-400" />
        <SummaryChip icon={BarChart2} label="ZIPs scanned" value={zipCount.toString()} color="text-blue-400" />
      </div>

      {/* Last updated */}
      {lastFetch && (
        <p className="text-[11px] text-muted-foreground -mt-2">
          Updated {timeAgo(lastFetch)}
          {index?.generated_at && ` · Oracle computed ${timeAgo(index.generated_at)}`}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">
          <AlertTriangle size={14} />
          <span>{error} — oracle worker may still be initializing</span>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_TYPES.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[11px] px-2.5 py-1 rounded-md font-medium capitalize transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
            }`}
          >
            {f === "all" ? `All (${signals.length})` : `${f} (${signals.filter((s) => s.type === f).length})`}
          </button>
        ))}
      </div>

      {/* Signal feed */}
      {filtered.length === 0 && !fetching && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {error
            ? "Oracle is computing — check back in 60s"
            : "No signals for this filter"}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((signal) => (
          <SignalCard
            key={signal.id}
            signal={{
              ...signal,
              detail: detailCache[signal.zip],
              loading: loadingDetail === signal.id,
            }}
            expanded={expandedId === signal.id}
            onToggle={() => handleToggle(signal)}
          />
        ))}
      </div>

      {/* Placeholder when no oracle data yet */}
      {!error && !fetching && signals.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <Zap size={24} className="text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Oracle worker is initializing — signals appear within 60 seconds of first deploy</p>
        </div>
      )}
    </div>
  );
}

function SummaryChip({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-muted/20 rounded-lg p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className={color} />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{label}</span>
      </div>
      <span className="text-xl font-bold text-foreground">{value}</span>
    </div>
  );
}
