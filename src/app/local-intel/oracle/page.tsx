"use client";

import { useState, useEffect, useRef, useCallback, FormEvent } from "react";
import {
  Zap, TrendingUp, TrendingDown, AlertTriangle, Target,
  Utensils, DollarSign, Home, Building2, RefreshCw,
  Eye, Radio, ChevronRight, Minus, ArrowUpRight,
  BarChart2, Users, Flame, Search, SendHorizontal
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
  // trend fields (populated after 2+ cycles)
  trend_capture?: string;          // "up" | "down" | "flat" | "new"
  trend_streak?: number;           // consecutive cycles in same saturation state
  trend_biz_delta?: number;        // net new businesses since last cycle
  trend_cycles?: number;           // total cycles computed
}

interface OracleIndex {
  generated_at: string;
  zips: Record<string, ZipIndexEntry>;
}

interface OracleDetail {
  zip: string;
  name: string;
  computed_at: string;
  trend?: {
    cycles: number;
    capture_rate: string;
    capture_delta: number;
    growth_state: string;
    saturation_streak: number;
    biz_delta: number;
    restaurant_delta: number;
    infra_delta: number;
  } | null;
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
  // trend
  trend_capture?: string;
  trend_streak?: number;
  trend_biz_delta?: number;
  trend_cycles?: number;
}

function buildSignalsFromIndex(index: OracleIndex): Signal[] {
  const signals: Signal[] = [];

  for (const [zip, entry] of Object.entries(index.zips)) {
    const trendFields = {
      trend_capture:   entry.trend_capture,
      trend_streak:    entry.trend_streak,
      trend_biz_delta: entry.trend_biz_delta,
      trend_cycles:    entry.trend_cycles,
    };

    // ── Undersupplied market ─────────────────────────────────────────────────
    if (entry.saturation_status === "undersupplied") {
      const gap = Math.max(0, 100 - entry.capture_rate_pct);
      // Conviction boost: streak makes it stronger
      const streak = entry.trend_streak || 1;
      const strength = gap > 40 || streak >= 3 ? "high" : gap > 20 || streak >= 2 ? "medium" : "low";
      signals.push({
        id: `${zip}-undersupplied`,
        zip,
        name: entry.name || zip,
        type: "opportunity",
        strength,
        headline: `${entry.name || zip} has room for more restaurants`,
        subline: `Market only ${entry.capture_rate_pct.toFixed(0)}% captured — ${gap.toFixed(0)}% of demand unmet${streak >= 2 ? ` · ${streak} cycles confirmed` : ""}`,
        icon: Utensils,
        ...trendFields,
      });
    }

    // ── Oversaturated market ─────────────────────────────────────────────────
    if (entry.saturation_status === "oversaturated") {
      const streak = entry.trend_streak || 1;
      signals.push({
        id: `${zip}-oversaturated`,
        zip,
        name: entry.name || zip,
        type: "caution",
        strength: streak >= 3 ? "high" : "medium",
        headline: `${entry.name || zip} — restaurant market oversaturated`,
        subline: `${entry.capture_rate_pct.toFixed(0)}% capture rate: supply exceeds demand${streak >= 2 ? ` · ${streak} consecutive cycles` : ""}`,
        icon: AlertTriangle,
        ...trendFields,
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
      const gapStreak = entry.trend_streak || 1;
      signals.push({
        id: `${zip}-gap-${entry.top_gap}`,
        zip,
        name: entry.name || zip,
        type: "gap",
        strength: entry.top_gap === "upscale" || entry.top_gap === "fine" ? "high" : "medium",
        headline: `Price tier gap: ${tierLabel[entry.top_gap] || entry.top_gap} in ${entry.name || zip}`,
        subline: `Income profile demands more ${entry.top_gap} options${gapStreak >= 2 ? ` · gap persists ${gapStreak} cycles` : ""}`,
        icon: DollarSign,
        ...trendFields,
      });
    }

    // ── Active growth zones ──────────────────────────────────────────────────
    if (entry.growth_state === "growing") {
      const bizDelta = entry.trend_biz_delta || 0;
      signals.push({
        id: `${zip}-growing`,
        zip,
        name: entry.name || zip,
        type: "growth",
        strength: "high",
        headline: `${entry.name || zip} — active family formation`,
        subline: `High ownership + schools = customer base building now${bizDelta > 0 ? ` · +${bizDelta} businesses this cycle` : ""}`,
        icon: TrendingUp,
        ...trendFields,
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
        ...trendFields,
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
        ...trendFields,
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

        {/* Trend + ZIP tag + expand */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {/* Trend direction arrow */}
          {signal.trend_capture === "up" && (
            <ArrowUpRight size={12} className="text-emerald-400" />
          )}
          {signal.trend_capture === "down" && (
            <TrendingDown size={12} className="text-red-400" />
          )}
          {signal.trend_capture === "flat" && (
            <Minus size={12} className="text-muted-foreground" />
          )}
          {/* Streak badge — only show if 3+ cycles for conviction */}
          {(signal.trend_streak ?? 0) >= 3 && (
            <span className="text-[9px] bg-primary/15 text-primary rounded px-1 py-0.5 font-bold" title={`${signal.trend_streak} cycles confirmed`}>
              {signal.trend_streak}x
            </span>
          )}
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
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
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

      {/* Trend strip — shows once we have history */}
      {detail.trend && detail.trend.cycles >= 2 && (
        <div className="flex flex-wrap items-center gap-3 text-xs border-t border-border/20 pt-3">
          <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Trend ({detail.trend.cycles} cycles)</span>
          <span className={detail.trend.capture_rate === "up" ? "text-emerald-400" : detail.trend.capture_rate === "down" ? "text-red-400" : "text-muted-foreground"}>
            Capture {detail.trend.capture_rate === "up" ? "↑" : detail.trend.capture_rate === "down" ? "↓" : "→"} {detail.trend.capture_delta > 0 ? "+" : ""}{detail.trend.capture_delta?.toFixed(1)}%
          </span>
          <span>·</span>
          <span className={detail.trend.biz_delta > 0 ? "text-emerald-400" : detail.trend.biz_delta < 0 ? "text-red-400" : "text-muted-foreground"}>
            Businesses {detail.trend.biz_delta > 0 ? "+" : ""}{detail.trend.biz_delta}
          </span>
          <span>·</span>
          <span className={detail.trend.restaurant_delta > 0 ? "text-emerald-400" : detail.trend.restaurant_delta < 0 ? "text-red-400" : "text-muted-foreground"}>
            Restaurants {detail.trend.restaurant_delta > 0 ? "+" : ""}{detail.trend.restaurant_delta}
          </span>
          <span>·</span>
          <span className="text-muted-foreground">
            {detail.trend.saturation_streak} cycles same status
          </span>
        </div>
      )}
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
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto overflow-y-auto">
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

      {/* ZIP Ask */}
      <ZipAsk />

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

// ── ZIP Ask ─────────────────────────────────────────────────────────────────

const SUGGESTED = [
  "housing starts 32082",
  "major construction projects 32082",
  "new developments 32081",
  "building permits 32082",
  "commercial real estate 32082",
];

function ZipAsk() {
  const [query, setQuery]     = useState("");
  const [zip, setZip]         = useState("32082");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{name:string;category:string;address:string;phone?:string;website?:string}> | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const run = useCallback(async (q: string, z: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(`${RAILWAY}/api/local-intel/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "tools/call",
          params: { name: "local_intel_search", arguments: { query: q, zip: z, limit: 10 } },
        }),
      });
      const data = await res.json();
      const text = data?.result?.content?.[0]?.text;
      if (!text) throw new Error("No result");
      const parsed = JSON.parse(text);
      setResults(parsed.results || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(query, zip);
  };

  return (
    <div className="border border-border/30 rounded-xl p-4 bg-muted/10 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Search size={14} className="text-primary" />
        <span className="text-sm font-semibold">Ask LocalIntel</span>
        <span className="text-[10px] text-muted-foreground">· search businesses &amp; signals by ZIP</span>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          placeholder="ZIP"
          className="w-20 bg-muted/30 border border-border/40 rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          maxLength={5}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="housing starts, construction projects, dentist…"
          className="flex-1 bg-muted/30 border border-border/40 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          <SendHorizontal size={13} />
        </button>
      </form>

      {/* Suggested prompts */}
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTED.map((s) => (
          <button
            key={s}
            onClick={() => {
              const parts = s.match(/(\d{5})/);
              if (parts) setZip(parts[1]);
              setQuery(s.replace(/\s*\d{5}\s*/, " ").trim());
              run(s.replace(/\s*\d{5}\s*/, " ").trim(), parts?.[1] ?? zip);
            }}
            className="text-[10px] bg-muted/30 hover:bg-muted/60 text-muted-foreground rounded px-2 py-0.5 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading && <p className="text-xs text-muted-foreground animate-pulse">Searching…</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {results !== null && (
        <div className="space-y-1.5">
          {results.length === 0 ? (
            <p className="text-xs text-muted-foreground">No matches in {zip} — try a broader query or different ZIP.</p>
          ) : (
            results.map((b, i) => (
              <div key={i} className="bg-muted/20 rounded-lg px-3 py-2 flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{b.name}</span>
                  <span className="text-[10px] text-muted-foreground capitalize">{b.category}</span>
                </div>
                {b.address && <p className="text-[10px] text-muted-foreground">{b.address}</p>}
                <div className="flex gap-3">
                  {b.phone && <span className="text-[10px] text-primary">{b.phone}</span>}
                  {b.website && (
                    <a href={b.website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline truncate max-w-[200px]">
                      {b.website.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
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
