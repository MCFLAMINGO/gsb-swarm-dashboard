"use client";

import { useState, useEffect, useRef, useCallback, FormEvent } from "react";
import {
  Zap, TrendingUp, TrendingDown, AlertTriangle, Target,
  Utensils, DollarSign, Home, Building2, RefreshCw,
  Eye, Radio, ChevronRight, Minus, ArrowUpRight,
  BarChart2, Users, Flame, Search, SendHorizontal,
  Heart, ShoppingBag, Wrench, MapPin, Activity
} from "lucide-react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";
const REFRESH_MS = 30_000;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ZipIndexEntry {
  name: string;
  saturation_status: string;
  capture_rate_pct: number;
  growth_state: string;
  consumer_profile: string;
  top_gap: string | null;
  computed_at: string;
  trend_capture?: string;
  trend_streak?: number;
  trend_biz_delta?: number;
  trend_cycles?: number;
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
    wfh_pct?: number;
    affluence_pct?: number;
    retiree_index?: number;
    total_households?: number;
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
  vertical_gaps?: Array<{
    vertical: string;
    prompt: string;
    zip: string;
    tool: string;
    industry: string;
    score: number;
    needs?: string;
  }>;
  data_sources?: {
    has_acs?: boolean;
    has_bedrock?: boolean;
    has_census_layer?: boolean;
    vertical_gap_count?: number;
  };
  economic_layer?: {
    employment_density: number;
    total_employees: number;
    total_establishments: number;
    dominant_sector: string | null;
    sector_gaps: Array<{
      naics: string;
      label: string;
      signal: string;
      confidence: string;
    }>;
  } | null;
}

// ── Signal generation ─────────────────────────────────────────────────────────

interface Signal {
  id: string;
  zip: string;
  name: string;
  type: "opportunity" | "saturation" | "growth" | "gap" | "anomaly" | "caution" | "bedrock" | "demographic";
  strength: "high" | "medium" | "low";
  headline: string;
  subline: string;
  icon: React.ElementType;
  detail?: OracleDetail;
  loading?: boolean;
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

    // ── Undersupplied restaurant market ──────────────────────────────────────
    if (entry.saturation_status === "undersupplied") {
      const gap = Math.max(0, 100 - entry.capture_rate_pct);
      const streak = entry.trend_streak || 1;
      const strength = gap > 40 || streak >= 3 ? "high" : gap > 20 || streak >= 2 ? "medium" : "low";
      signals.push({
        id: `${zip}-undersupplied`,
        zip, name: entry.name || zip,
        type: "opportunity", strength,
        headline: `${entry.name || zip} — room for more restaurants`,
        subline: `Market only ${entry.capture_rate_pct.toFixed(0)}% captured · ${gap.toFixed(0)}% demand unmet${streak >= 2 ? ` · ${streak} cycles confirmed` : ""}`,
        icon: Utensils, ...trendFields,
      });
    }

    // ── Oversaturated restaurant market ──────────────────────────────────────
    if (entry.saturation_status === "oversaturated") {
      const streak = entry.trend_streak || 1;
      // Only flag as high if VERY oversaturated (>200%) — reduces noise
      const strength = entry.capture_rate_pct > 300 ? "high" : streak >= 5 ? "medium" : "low";
      signals.push({
        id: `${zip}-oversaturated`,
        zip, name: entry.name || zip,
        type: "caution", strength,
        headline: `${entry.name || zip} — restaurant market oversaturated`,
        subline: `${entry.capture_rate_pct.toFixed(0)}% capture rate · supply exceeds demand${streak >= 3 ? ` · ${streak} consecutive cycles` : ""}`,
        icon: AlertTriangle, ...trendFields,
      });
    }

    // ── Price tier gap ────────────────────────────────────────────────────────
    if (entry.top_gap && entry.saturation_status !== "oversaturated") {
      const tierLabel: Record<string, string> = {
        budget: "budget / fast casual",
        midrange: "midrange casual dining",
        upscale: "upscale dining",
        fine: "fine dining",
      };
      signals.push({
        id: `${zip}-gap-${entry.top_gap}`,
        zip, name: entry.name || zip,
        type: "gap",
        strength: entry.top_gap === "upscale" || entry.top_gap === "fine" ? "high" : "medium",
        headline: `Price gap: ${tierLabel[entry.top_gap] || entry.top_gap} in ${entry.name || zip}`,
        subline: `Income profile demands more ${entry.top_gap} options · gap persists ${entry.trend_streak || 1} cycles`,
        icon: DollarSign, ...trendFields,
      });
    }

    // ── Active growth zone ────────────────────────────────────────────────────
    if (entry.growth_state === "growing") {
      const bizDelta = entry.trend_biz_delta || 0;
      signals.push({
        id: `${zip}-growing`,
        zip, name: entry.name || zip,
        type: "growth", strength: "high",
        headline: `${entry.name || zip} — active family formation`,
        subline: `High ownership + schools = customer base building now${bizDelta > 0 ? ` · +${bizDelta} businesses this cycle` : ""}`,
        icon: TrendingUp, ...trendFields,
      });
    }

    // ── Empty nest / transition ───────────────────────────────────────────────
    if (entry.growth_state === "transitioning") {
      signals.push({
        id: `${zip}-transitioning`,
        zip, name: entry.name || zip,
        type: "anomaly", strength: "medium",
        headline: `${entry.name || zip} — empty nest shift`,
        subline: `Aging owner base, high home values, fewer kids · pivot to leisure + health`,
        icon: Home, ...trendFields,
      });
    }

    // ── Affluent balanced market (investment opportunity) ─────────────────────
    if (
      (entry.consumer_profile === "affluent_established" || entry.consumer_profile === "affluent_family" || entry.consumer_profile === "luxury") &&
      (entry.saturation_status === "balanced" || entry.saturation_status === "room_for_niche")
    ) {
      signals.push({
        id: `${zip}-affluent-balanced`,
        zip, name: entry.name || zip,
        type: "opportunity", strength: "medium",
        headline: `${entry.name || zip} — high-income balanced market`,
        subline: `${entry.consumer_profile.replace(/_/g, " ")} profile · market not yet oversupplied`,
        icon: Target, ...trendFields,
      });
    }

    // ── Healthcare opportunity: affluent + retiree ZIP with room to grow ──────
    if (
      entry.consumer_profile?.includes("affluent") ||
      entry.consumer_profile === "retiree_belt"
    ) {
      signals.push({
        id: `${zip}-healthcare-signal`,
        zip, name: entry.name || zip,
        type: "opportunity", strength: entry.consumer_profile === "retiree_belt" ? "high" : "medium",
        headline: `${entry.name || zip} — healthcare demand signal`,
        subline: entry.consumer_profile === "retiree_belt"
          ? `Retiree-heavy ZIP · strong demand for senior care, urgent care, specialty services`
          : `Affluent ZIP · demand for concierge medicine, dental, optometry, wellness`,
        icon: Heart, ...trendFields,
      });
    }
  }

  // Sort: high strength first, then type priority, deduplicate by id
  const typePriority: Record<string, number> = {
    opportunity: 1, growth: 2, gap: 3, bedrock: 4, demographic: 5, anomaly: 6, saturation: 7, caution: 8,
  };
  const strengthPriority: Record<string, number> = { high: 0, medium: 1, low: 2 };

  return signals
    .sort((a, b) => {
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
  opportunity:  "border-emerald-500/40 bg-emerald-500/5",
  gap:          "border-amber-500/40 bg-amber-500/5",
  growth:       "border-blue-500/40 bg-blue-500/5",
  anomaly:      "border-purple-500/40 bg-purple-500/5",
  caution:      "border-red-500/40 bg-red-500/5",
  saturation:   "border-orange-500/40 bg-orange-500/5",
  bedrock:      "border-sky-500/40 bg-sky-500/5",
  demographic:  "border-violet-500/40 bg-violet-500/5",
};

const TYPE_BADGE: Record<string, string> = {
  opportunity:  "bg-emerald-500/15 text-emerald-400",
  gap:          "bg-amber-500/15 text-amber-400",
  growth:       "bg-blue-500/15 text-blue-400",
  anomaly:      "bg-purple-500/15 text-purple-400",
  caution:      "bg-red-500/15 text-red-400",
  saturation:   "bg-orange-500/15 text-orange-400",
  bedrock:      "bg-sky-500/15 text-sky-400",
  demographic:  "bg-violet-500/15 text-violet-400",
};

const TYPE_ICON_COLOR: Record<string, string> = {
  opportunity:  "text-emerald-400",
  gap:          "text-amber-400",
  growth:       "text-blue-400",
  anomaly:      "text-purple-400",
  caution:      "text-red-400",
  saturation:   "text-orange-400",
  bedrock:      "text-sky-400",
  demographic:  "text-violet-400",
};

const STRENGTH_DOT: Record<string, string> = {
  high:   "bg-red-400",
  medium: "bg-amber-400",
  low:    "bg-slate-500",
};

// ── Signal Card ───────────────────────────────────────────────────────────────

function SignalCard({ signal, expanded, onToggle }: {
  signal: Signal; expanded: boolean; onToggle: () => void;
}) {
  const Icon = signal.icon;
  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all cursor-pointer ${TYPE_COLORS[signal.type]}`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="mt-1.5 flex-shrink-0">
          <span className={`inline-block w-2 h-2 rounded-full ${STRENGTH_DOT[signal.strength]}`} />
        </div>
        <div className={`flex-shrink-0 mt-0.5 ${TYPE_ICON_COLOR[signal.type]}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground leading-tight">{signal.headline}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold tracking-wide ${TYPE_BADGE[signal.type]}`}>
              {signal.type}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold tracking-wide ${TYPE_BADGE[signal.type]}`}>
              {signal.strength}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{signal.subline}</p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {signal.trend_capture === "up"   && <ArrowUpRight size={12} className="text-emerald-400" />}
          {signal.trend_capture === "down" && <TrendingDown size={12} className="text-red-400" />}
          {signal.trend_capture === "flat" && <Minus size={12} className="text-muted-foreground" />}
          {(signal.trend_streak ?? 0) >= 3 && (
            <span className="text-[9px] bg-primary/15 text-primary rounded px-1 py-0.5 font-bold">
              {signal.trend_streak}x
            </span>
          )}
          <span className="text-[10px] bg-muted/40 rounded px-1.5 py-0.5 text-muted-foreground font-mono">
            {signal.zip}
          </span>
          <ChevronRight size={14} className={`text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/30 px-4 pb-4 pt-3">
          {signal.loading && <p className="text-xs text-muted-foreground animate-pulse">Loading details…</p>}
          {!signal.loading && signal.detail && <DetailPanel detail={signal.detail} />}
          {!signal.loading && !signal.detail && <p className="text-xs text-muted-foreground">No detail data available yet.</p>}
        </div>
      )}
    </div>
  );
}

// ── Detail Panel — shows ALL data layers ──────────────────────────────────────

function DetailPanel({ detail }: { detail: OracleDetail }) {
  const cap    = detail.restaurant_capacity;
  const gaps   = detail.market_gaps;
  const growth = detail.growth_trajectory;
  const dem    = detail.demographics;
  const econ   = detail.economic_layer;
  const vGaps  = detail.vertical_gaps || [];

  // Group vertical gaps by vertical
  const gapsByVertical: Record<string, typeof vGaps> = {};
  for (const g of vGaps) {
    if (!gapsByVertical[g.vertical]) gapsByVertical[g.vertical] = [];
    gapsByVertical[g.vertical].push(g);
  }

  return (
    <div className="space-y-4">
      {/* Oracle narrative */}
      {detail.oracle_narrative && (
        <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-border pl-3">
          {detail.oracle_narrative}
        </p>
      )}

      {/* Demographics grid — all ACS fields */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Demographics</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Population"   value={dem.population?.toLocaleString() || "—"} />
          <Stat label="Med. Income"  value={dem.median_household_income ? `$${(dem.median_household_income/1000).toFixed(0)}k` : "—"} />
          <Stat label="Home Value"   value={dem.median_home_value ? `$${(dem.median_home_value/1000).toFixed(0)}k` : "—"} />
          <Stat label="Owner-occ"    value={dem.owner_occupied_pct ? `${dem.owner_occupied_pct}%` : "—"} />
          {dem.wfh_pct != null && dem.wfh_pct > 0 && <Stat label="WFH%" value={`${dem.wfh_pct}%`} />}
          {dem.affluence_pct != null && dem.affluence_pct > 0 && <Stat label="$100k+ HH" value={`${dem.affluence_pct}%`} />}
          {dem.retiree_index != null && dem.retiree_index > 0 && <Stat label="65+ Pop" value={`${dem.retiree_index}%`} />}
          {dem.total_households != null && dem.total_households > 0 && <Stat label="Households" value={dem.total_households.toLocaleString()} />}
        </div>
      </div>

      {/* Restaurant capacity */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Restaurant Market</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Restaurants"  value={cap.restaurant_count?.toString() || "—"} />
          <Stat label="Can Support"  value={cap.restaurants_market_can_support?.toString() || "—"} />
          <Stat label="Capture Rate" value={`${cap.capture_rate_pct?.toFixed(0)}%`} />
          <Stat label="Total Biz"    value={cap.total_businesses?.toString() || "—"} />
        </div>
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
                  g.status === "undersupplied" ? "bg-emerald-500/15 text-emerald-400"
                  : g.status === "oversupplied" ? "bg-red-500/15 text-red-400"
                  : "bg-muted/40 text-muted-foreground"
                }`}>{g.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Economic layer — sector gaps from ZBP/CBP */}
      {econ && econ.sector_gaps?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Sector Gaps (NAICS)</p>
          <div className="space-y-1.5">
            {econ.sector_gaps.slice(0, 5).map((g, i) => (
              <div key={i} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{g.naics}</span>
                  <span className="font-medium text-foreground">{g.label}</span>
                  <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    g.confidence === 'ESTIMATED' ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-muted/40 text-muted-foreground'
                  }`}>{g.confidence}</span>
                </div>
                {g.signal && <p className="text-muted-foreground mt-0.5 leading-relaxed pl-10">{g.signal}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vertical data gaps — what agents are asking that we can't answer */}
      {Object.keys(gapsByVertical).length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
            Agent Query Gaps ({vGaps.length} open)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(gapsByVertical).map(([vertical, items]) => {
              const icons: Record<string, React.ElementType> = {
                restaurant: Utensils, healthcare: Heart, retail: ShoppingBag,
                construction: Wrench, realtor: Home,
              };
              const Icon = icons[vertical] || Activity;
              return (
                <div key={vertical} className="flex items-center gap-1 bg-muted/20 rounded px-2 py-1">
                  <Icon size={10} className="text-muted-foreground" />
                  <span className="text-[10px] capitalize text-muted-foreground">{vertical}</span>
                  <span className="text-[10px] font-bold text-foreground">{items.length}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Agents are asking questions this ZIP can&apos;t yet answer — data gaps to fill.
          </p>
        </div>
      )}

      {/* Infrastructure / growth */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <span>Growth: <span className="text-foreground">{growth.label}</span></span>
        <span>·</span>
        <span>Schools: <span className="text-foreground">{growth.school_count}</span></span>
        {growth.infrastructure_momentum > 0 && (
          <>
            <span>·</span>
            <span>Infra momentum: <span className="text-sky-400 font-semibold">{growth.infrastructure_momentum}/100</span></span>
          </>
        )}
        {growth.active_construction > 0 && (
          <>
            <span>·</span>
            <span>Active construction: <span className="text-emerald-400">{growth.active_construction}</span></span>
          </>
        )}
      </div>

      {/* Top pre-formed questions */}
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

      {/* Trend strip */}
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
          <span className="text-muted-foreground">{detail.trend.saturation_streak} cycles same status</span>
        </div>
      )}

      {/* Data sources */}
      {detail.data_sources && (
        <div className="flex flex-wrap gap-1.5 border-t border-border/20 pt-3">
          <span className="text-[10px] text-muted-foreground">Data:</span>
          {detail.data_sources.has_acs      && <Badge label="ACS" color="emerald" />}
          {detail.data_sources.has_bedrock  && <Badge label="Bedrock" color="sky" />}
          {detail.data_sources.has_census_layer && <Badge label="ZBP/CBP" color="blue" />}
          {(detail.data_sources.vertical_gap_count ?? 0) > 0 && (
            <Badge label={`${detail.data_sources.vertical_gap_count} agent gaps`} color="amber" />
          )}
        </div>
      )}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500/15 text-emerald-400",
    sky:     "bg-sky-500/15 text-sky-400",
    blue:    "bg-blue-500/15 text-blue-400",
    amber:   "bg-amber-500/15 text-amber-400",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[color] || "bg-muted/30 text-muted-foreground"}`}>
      {label}
    </span>
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
  const [index,        setIndex]        = useState<OracleIndex | null>(null);
  const [signals,      setSignals]      = useState<Signal[]>([]);
  const [detailCache,  setDetailCache]  = useState<Record<string, OracleDetail>>({});
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [loadingDetail,setLoadingDetail]= useState<string | null>(null);
  const [filter,       setFilter]       = useState<FilterType>("all");
  const [lastFetch,    setLastFetch]    = useState<string>("");
  const [fetching,     setFetching]     = useState(false);
  const [error,        setError]        = useState<string | null>(null);
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
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchIndex();
    timerRef.current = setInterval(fetchIndex, REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchIndex]);

  const handleToggle = useCallback(async (signal: Signal) => {
    const id = signal.id;
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (detailCache[signal.zip]) return;
    setLoadingDetail(id);
    try {
      const res = await fetch(`${RAILWAY}/api/local-intel/oracle?zip=${signal.zip}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const detail: OracleDetail = await res.json();
      setDetailCache((prev) => ({ ...prev, [signal.zip]: detail }));
    } catch { /* silent */ } finally {
      setLoadingDetail(null);
    }
  }, [expandedId, detailCache]);

  const filtered = filter === "all" ? signals : signals.filter((s) => s.type === filter);

  const highCount  = signals.filter((s) => s.strength === "high").length;
  const oppCount   = signals.filter((s) => s.type === "opportunity").length;
  const gapCount   = signals.filter((s) => s.type === "gap").length;
  const zipCount   = index ? Object.keys(index.zips).length : 0;

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
        >
          <RefreshCw size={14} className={fetching ? "animate-spin text-primary" : "text-muted-foreground"} />
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-2">
        <SummaryChip icon={Flame}     label="High signals"  value={highCount.toString()}  color="text-red-400" />
        <SummaryChip icon={TrendingUp} label="Opportunities" value={oppCount.toString()}   color="text-emerald-400" />
        <SummaryChip icon={DollarSign} label="Price gaps"    value={gapCount.toString()}   color="text-amber-400" />
        <SummaryChip icon={BarChart2}  label="ZIPs scanned"  value={zipCount.toString()}   color="text-blue-400" />
      </div>

      {lastFetch && (
        <p className="text-[11px] text-muted-foreground -mt-2">
          Updated {timeAgo(lastFetch)}
          {index?.generated_at && ` · Oracle computed ${timeAgo(index.generated_at)}`}
        </p>
      )}

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

      {filtered.length === 0 && !fetching && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {error ? "Oracle is computing — check back in 60s" : "No signals for this filter"}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((signal) => (
          <SignalCard
            key={signal.id}
            signal={{ ...signal, detail: detailCache[signal.zip], loading: loadingDetail === signal.id }}
            expanded={expandedId === signal.id}
            onToggle={() => handleToggle(signal)}
          />
        ))}
      </div>

      <ZipAsk />

      {!error && !fetching && signals.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <Zap size={24} className="text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Oracle worker initializing — signals appear within 60s of first deploy</p>
        </div>
      )}
    </div>
  );
}

// ── ZIP Ask ───────────────────────────────────────────────────────────────────

const SUGGESTED = [
  "What restaurant categories are missing in 32082?",
  "Investment signals for 32081",
  "Healthcare provider gaps in 32082",
  "Construction activity in Ponte Vedra Beach",
  "Retail saturation near A1A 32082",
];

interface AskSource { tool: string; layer: string; zip: string; }
interface AskResult {
  question: string;
  zip: string;
  zip_label: string;
  intent: string;
  tools_used: string[];
  answer: string;
  confidence: number;
  data_points: number;
  sources: AskSource[];
  ts: string;
}

const INTENT_COLORS: Record<string, string> = {
  demographics:       "text-blue-400 bg-blue-400/10",
  market_opportunity: "text-emerald-400 bg-emerald-400/10",
  construction:       "text-orange-400 bg-orange-400/10",
  investment_signal:  "text-yellow-400 bg-yellow-400/10",
  corridor:           "text-purple-400 bg-purple-400/10",
  recent_changes:     "text-pink-400 bg-pink-400/10",
  healthcare:         "text-cyan-400 bg-cyan-400/10",
  food_beverage:      "text-red-400 bg-red-400/10",
  retail:             "text-indigo-400 bg-indigo-400/10",
  nearby:             "text-teal-400 bg-teal-400/10",
  general:            "text-muted-foreground bg-muted/30",
};

function ZipAsk() {
  const [query,   setQuery]   = useState("");
  const [zip,     setZip]     = useState("32082");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<AskResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const run = useCallback(async (q: string, z: string) => {
    if (!q.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${RAILWAY}/api/local-intel/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "tools/call",
          params: { name: "local_intel_ask", arguments: { question: q, zip: z } },
        }),
      });
      const data = await res.json();
      const text = data?.result?.content?.[0]?.text;
      if (!text) throw new Error(data?.error?.message || "No result");
      setResult(JSON.parse(text));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Query failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: FormEvent) => { e.preventDefault(); run(query, zip); };

  return (
    <div className="border border-border/30 rounded-xl p-4 bg-muted/10 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Search size={14} className="text-primary" />
        <span className="text-sm font-semibold">Ask LocalIntel</span>
        <span className="text-[10px] text-muted-foreground">· plain-English query, synthesized answer</span>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={zip} onChange={(e) => setZip(e.target.value)}
          placeholder="ZIP"
          className="w-20 bg-muted/30 border border-border/40 rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          maxLength={5}
        />
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="What restaurant categories are missing here?"
          className="flex-1 bg-muted/30 border border-border/40 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button type="submit" disabled={loading || !query.trim()}
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 disabled:opacity-40 hover:opacity-90 transition-opacity">
          <SendHorizontal size={13} />
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTED.map((s) => (
          <button key={s}
            onClick={() => {
              const parts = s.match(/(\d{5})/);
              if (parts) setZip(parts[1]);
              const cleaned = s.replace(/\s*\d{5}\s*/g, " ").trim();
              setQuery(cleaned);
              run(cleaned, parts?.[1] ?? zip);
            }}
            className="text-[10px] bg-muted/30 hover:bg-muted/60 text-muted-foreground rounded px-2 py-0.5 transition-colors">
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
          Routing query across data layers…
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${INTENT_COLORS[result.intent] ?? INTENT_COLORS.general}`}>
              {result.intent.replace(/_/g, " ")}
            </span>
            <span className="text-[10px] text-muted-foreground">{result.zip_label}</span>
            <span className="ml-auto text-[10px] font-mono text-muted-foreground">
              {result.confidence}% · {result.data_points} pts
            </span>
          </div>
          <div className="bg-muted/20 rounded-lg px-3 py-2.5">
            {result.answer.split("\n").map((line, i) => (
              <p key={i} className={`text-xs ${line.startsWith("  •") || line.startsWith("•") ? "text-muted-foreground pl-2" : "text-foreground font-medium"} leading-relaxed`}>
                {line || <>&nbsp;</>}
              </p>
            ))}
          </div>
          {result.sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] text-muted-foreground">Sources:</span>
              {result.sources.map((s, i) => (
                <span key={i} className="text-[10px] bg-muted/30 text-muted-foreground rounded px-1.5 py-0.5">
                  {s.tool.replace("local_intel_", "")}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryChip({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string;
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
