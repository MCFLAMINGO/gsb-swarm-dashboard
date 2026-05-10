"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, DollarSign, ArrowLeftRight, Building2, Map,
  HardHat, Wifi, Briefcase, Brain, Sparkles,
  ChevronDown, ChevronUp, RefreshCw, CheckCircle2,
  Clock, AlertCircle, Loader2, Code2, X
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const RAILWAY = "https://gsb-swarm-production.up.railway.app";
const ADMIN_TOKEN = "localintel-migrate-2026";
const ZIP = "32082";

// ── Types ──────────────────────────────────────────────────────────────────────

type NodeStatus = "live" | "pending" | "building";

interface NodeDef {
  id: string;
  title: string;
  org: string;
  icon: React.ElementType;
  color: string;       // tailwind color name, e.g. "blue"
  colorHex: string;    // hex for inline accent usage
  vintage: string;
  questions: string[];
  signals: string[];
  demoEndpoint: string;
  demoMethod?: "GET" | "POST";
  demoHeaders?: Record<string, string>;
  status?: NodeStatus; // computed from live data
}

// ── Node Definitions ───────────────────────────────────────────────────────────

const NODES: NodeDef[] = [
  {
    id: "acs",
    title: "ACS Demographics",
    org: "Census Bureau",
    icon: Users,
    color: "blue",
    colorHex: "#3b82f6",
    vintage: "Census ACS 5-year estimates, updated annually",
    questions: [
      "What is the median income in this ZIP?",
      "What % of households own their home?",
      "What % work from home?",
      "What is the age breakdown?",
      "How many households?",
    ],
    signals: [
      "acs_population", "acs_median_hhi", "acs_owner_occ_pct",
      "acs_college_pct", "acs_poverty_pct", "acs_vacancy_pct",
    ],
    demoEndpoint: `${RAILWAY}/api/local-intel/zip-signals/${ZIP}`,
    demoHeaders: { "x-admin-token": ADMIN_TOKEN },
  },
  {
    id: "irs_income",
    title: "IRS Income (SOI)",
    org: "IRS Statistics of Income",
    icon: DollarSign,
    color: "green",
    colorHex: "#22c55e",
    vintage: "IRS SOI county-level, annual",
    questions: [
      "What is the true median AGI in this ZIP?",
      "What share of income is from wages vs investment?",
      "How many tax returns filed?",
    ],
    signals: ["irs_agi_median", "irs_returns", "irs_wage_share"],
    demoEndpoint: `${RAILWAY}/api/local-intel/zip-signals/${ZIP}`,
    demoHeaders: { "x-admin-token": ADMIN_TOKEN },
  },
  {
    id: "irs_migration",
    title: "IRS Migration Flow",
    org: "IRS SOI Migration",
    icon: ArrowLeftRight,
    color: "teal",
    colorHex: "#14b8a6",
    vintage: "IRS SOI county-to-county migration 2021–2022",
    questions: [
      "Is this ZIP gaining or losing residents?",
      "Where are people moving from / to?",
      "How much income is migrating in / out?",
      "What is the net migration AGI?",
    ],
    signals: [
      "irs_mig_net_returns", "irs_mig_net_agi",
      "irs_mig_top_origin", "irs_mig_top_dest",
    ],
    demoEndpoint: `${RAILWAY}/api/local-intel/zip-signals/${ZIP}`,
    demoHeaders: { "x-admin-token": ADMIN_TOKEN },
  },
  {
    id: "zbp",
    title: "Census Business Patterns",
    org: "ZBP / CBP",
    icon: Building2,
    color: "purple",
    colorHex: "#a855f7",
    vintage: "Census ZIP Business Patterns + County Business Patterns",
    questions: [
      "How many businesses are in this ZIP?",
      "What sectors dominate?",
      "How many employees?",
      "What is total payroll?",
    ],
    signals: [
      "zbp_total_establishments", "cbp_total_establishments",
      "cbp_dominant_sector",
    ],
    demoEndpoint: `${RAILWAY}/api/local-intel/zip-signals/${ZIP}`,
    demoHeaders: { "x-admin-token": ADMIN_TOKEN },
  },
  {
    id: "osm",
    title: "OpenStreetMap (OSM)",
    org: "Overpass API",
    icon: Map,
    color: "orange",
    colorHex: "#f97316",
    vintage: "OpenStreetMap via Overpass, refreshed weekly",
    questions: [
      "How many businesses have a phone number listed?",
      "What % have hours posted?",
      "How many food / retail / healthcare businesses?",
      "What is the OSM business density?",
    ],
    signals: [
      "osm_biz_count", "osm_food_count", "osm_retail_count",
      "osm_with_phone_pct", "osm_with_hours_pct",
    ],
    demoEndpoint: `${RAILWAY}/api/local-intel/zip-signals/${ZIP}`,
    demoHeaders: { "x-admin-token": ADMIN_TOKEN },
  },
  {
    id: "bps",
    title: "Building Permits (BPS)",
    org: "Census Bureau",
    icon: HardHat,
    color: "yellow",
    colorHex: "#eab308",
    vintage: "Census Building Permits Survey, 67 FL counties",
    questions: [
      "How much new construction is happening?",
      "Is residential or commercial building dominant?",
      "What is the permit velocity trend?",
      "How many new housing units approved?",
    ],
    signals: [
      "bps_total_units_annual", "bps_res_1unit_annual",
      "bps_res_multifam_annual", "bps_commercial_mo",
    ],
    demoEndpoint: `${RAILWAY}/api/local-intel/zip-signals/${ZIP}`,
    demoHeaders: { "x-admin-token": ADMIN_TOKEN },
  },
  {
    id: "fcc",
    title: "FCC Broadband (BDC)",
    org: "FCC",
    icon: Wifi,
    color: "indigo",
    colorHex: "#6366f1",
    vintage: "FCC BDC API, semiannual vintage (June + December)",
    questions: [
      "What % of locations have 25/3 Mbps broadband?",
      "Is fiber available?",
      "How many providers compete here?",
      "Is this ZIP BEAD-eligible (unserved)?",
      "What % have gigabit access?",
    ],
    signals: [
      "fcc_pct_25_3", "fcc_pct_100_20", "fcc_provider_count",
      "fcc_fiber_available", "fcc_bead_unserved_pct",
    ],
    demoEndpoint: `${RAILWAY}/api/local-intel/zip-signals/${ZIP}`,
    demoHeaders: { "x-admin-token": ADMIN_TOKEN },
  },
  {
    id: "sunbiz",
    title: "Sunbiz Entity Registry",
    org: "Florida DOS",
    icon: Briefcase,
    color: "pink",
    colorHex: "#ec4899",
    vintage: "Florida Division of Corporations, refreshed monthly",
    questions: [
      "How many active businesses are registered in this ZIP?",
      "How many new businesses formed in the last 12 months?",
      "What is the dissolution rate?",
      "Is business formation accelerating or slowing?",
    ],
    signals: [
      "sunbiz_active_entities", "sunbiz_new_12mo",
      "sunbiz_dissolved_12mo", "sunbiz_net_12mo",
    ],
    demoEndpoint: `${RAILWAY}/api/local-intel/zip-signals/${ZIP}`,
    demoHeaders: { "x-admin-token": ADMIN_TOKEN },
  },
  {
    id: "world_model",
    title: "World Model Score",
    org: "LocalIntel",
    icon: Brain,
    color: "red",
    colorHex: "#ef4444",
    vintage: "LocalIntel world model — computed from all above signals",
    questions: [
      "What is this ZIP's growth score vs peer ZIPs?",
      "What is the opportunity score?",
      "What market maturity stage is this ZIP?",
      "What does the 12-month forecast say?",
      "Are there any statistical anomalies?",
    ],
    signals: [
      "sig_growth_score", "sig_opportunity_score",
      "sig_market_maturity", "sig_peer_cohort",
    ],
    demoEndpoint: `${RAILWAY}/api/local-intel/zip-signals/${ZIP}`,
    demoHeaders: { "x-admin-token": ADMIN_TOKEN },
    status: "building", // always building — world model
  },
  {
    id: "mcp_oracle",
    title: "MCP Oracle",
    org: "LocalIntel API",
    icon: Sparkles,
    color: "amber",
    colorHex: "#f59e0b",
    vintage: "LocalIntel composite analysis layer",
    questions: [
      "What are the top business gaps in this ZIP?",
      "What is the restaurant saturation level?",
      "What consumer profile describes this ZIP?",
      "What would you recommend building here?",
    ],
    signals: [],
    demoEndpoint: `${RAILWAY}/api/local-intel/oracle?zip=${ZIP}`,
    demoHeaders: { "x-admin-token": ADMIN_TOKEN },
  },
];

// ── Color Maps ─────────────────────────────────────────────────────────────────

const COLOR_BG: Record<string, string> = {
  blue:   "rgba(59,130,246,0.08)",
  green:  "rgba(34,197,94,0.08)",
  teal:   "rgba(20,184,166,0.08)",
  purple: "rgba(168,85,247,0.08)",
  orange: "rgba(249,115,22,0.08)",
  yellow: "rgba(234,179,8,0.08)",
  indigo: "rgba(99,102,241,0.08)",
  pink:   "rgba(236,72,153,0.08)",
  red:    "rgba(239,68,68,0.08)",
  amber:  "rgba(245,158,11,0.08)",
};

const COLOR_BORDER: Record<string, string> = {
  blue:   "rgba(59,130,246,0.25)",
  green:  "rgba(34,197,94,0.25)",
  teal:   "rgba(20,184,166,0.25)",
  purple: "rgba(168,85,247,0.25)",
  orange: "rgba(249,115,22,0.25)",
  yellow: "rgba(234,179,8,0.25)",
  indigo: "rgba(99,102,241,0.25)",
  pink:   "rgba(236,72,153,0.25)",
  red:    "rgba(239,68,68,0.25)",
  amber:  "rgba(245,158,11,0.25)",
};

// ── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: NodeStatus }) {
  if (status === "live") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
        padding: "3px 9px", borderRadius: 99,
        background: "rgba(34,197,94,0.15)", color: "#22c55e",
        border: "1px solid rgba(34,197,94,0.3)",
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%", background: "#22c55e",
          boxShadow: "0 0 6px #22c55e88",
          animation: "pulse 2s ease-in-out infinite"
        }} />
        LIVE
      </span>
    );
  }
  if (status === "building") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
        padding: "3px 9px", borderRadius: 99,
        background: "rgba(59,130,246,0.15)", color: "#60a5fa",
        border: "1px solid rgba(59,130,246,0.3)",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#60a5fa" }} />
        BUILDING
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
      padding: "3px 9px", borderRadius: 99,
      background: "rgba(234,179,8,0.12)", color: "#eab308",
      border: "1px solid rgba(234,179,8,0.25)",
    }}>
      <Clock size={9} />
      PENDING
    </span>
  );
}

// ── Signal Chip ────────────────────────────────────────────────────────────────

function SignalChip({ signal, live }: { signal: string; live: boolean }) {
  return (
    <span style={{
      fontSize: 10, fontFamily: "monospace",
      padding: "2px 7px", borderRadius: 5,
      background: live ? "rgba(34,197,94,0.1)" : "hsl(0 0% 10%)",
      color: live ? "#4ade80" : "hsl(0 0% 45%)",
      border: `1px solid ${live ? "rgba(34,197,94,0.25)" : "hsl(0 0% 16%)"}`,
      whiteSpace: "nowrap" as const,
    }}>
      {signal}
    </span>
  );
}

// ── Q-tag ─────────────────────────────────────────────────────────────────────

function QTag({ text }: { text: string }) {
  return (
    <span style={{
      display: "inline-block",
      fontSize: 11, lineHeight: 1.4,
      padding: "3px 9px", borderRadius: 6,
      background: "hsl(0 0% 9%)",
      color: "hsl(0 0% 62%)",
      border: "1px solid hsl(0 0% 15%)",
    }}>
      {text}
    </span>
  );
}

// ── Demo Panel ────────────────────────────────────────────────────────────────

interface DemoState {
  loading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  error: string | null;
}

function DemoPanel({
  node,
  onClose,
}: {
  node: NodeDef;
  onClose: () => void;
}) {
  const [state, setState] = useState<DemoState>({ loading: true, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, data: null, error: null });

    const run = async () => {
      try {
        const res = await fetch(node.demoEndpoint, {
          headers: { ...(node.demoHeaders ?? {}) },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setState({ loading: false, data: json, error: null });
      } catch (e: unknown) {
        if (!cancelled) setState({ loading: false, data: null, error: e instanceof Error ? e.message : "Fetch failed" });
      }
    };

    run();
    return () => { cancelled = true; };
  }, [node.demoEndpoint, node.demoHeaders]);

  return (
    <div style={{
      marginTop: 12,
      borderRadius: 8,
      border: "1px solid hsl(0 0% 16%)",
      background: "hsl(0 0% 5%)",
      overflow: "hidden",
    }}>
      {/* Demo header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px",
        borderBottom: "1px solid hsl(0 0% 12%)",
        background: "hsl(0 0% 6%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Code2 size={12} style={{ color: "hsl(0 0% 45%)" }} />
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "hsl(0 0% 50%)" }}>
            GET {node.demoEndpoint.replace(RAILWAY, "")}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "hsl(0 0% 40%)", padding: 4, borderRadius: 4,
            display: "flex", alignItems: "center",
          }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Demo body */}
      <div style={{ padding: "10px 12px", maxHeight: 260, overflowY: "auto" }}>
        {state.loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", color: "hsl(0 0% 45%)" }}>
            <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 12 }}>Fetching live data…</span>
          </div>
        )}
        {state.error && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#f87171", fontSize: 12 }}>
            <AlertCircle size={13} />
            {state.error}
          </div>
        )}
        {state.data && !state.loading && (
          <pre style={{
            fontSize: 10, fontFamily: "monospace", color: "#86efac",
            lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all",
            margin: 0,
          }}>
            {JSON.stringify(state.data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

// ── Node Card ─────────────────────────────────────────────────────────────────

function NodeCard({
  node,
  liveSignals,
}: {
  node: NodeDef;
  liveSignals: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  // Determine status
  const status: NodeStatus = (() => {
    if (node.status === "building") return "building";
    if (node.signals.length === 0) return "pending"; // MCP Oracle has no tracked signals
    const hasAny = node.signals.some((s) => liveSignals.has(s));
    return hasAny ? "live" : "pending";
  })();

  const liveCount = node.signals.filter((s) => liveSignals.has(s)).length;
  const Icon = node.icon;

  return (
    <div style={{
      background: COLOR_BG[node.color],
      border: `1px solid ${COLOR_BORDER[node.color]}`,
      borderRadius: 12,
      overflow: "hidden",
      transition: "box-shadow 200ms",
    }}>
      {/* Card header */}
      <div style={{ padding: "16px 18px" }}>
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: `${node.colorHex}18`,
              border: `1px solid ${node.colorHex}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon size={17} style={{ color: node.colorHex }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ebe3", lineHeight: 1.2 }}>
                {node.title}
              </div>
              <div style={{ fontSize: 11, color: "hsl(0 0% 45%)", marginTop: 2 }}>
                {node.org}
              </div>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Vintage */}
        <div style={{
          fontSize: 10, color: "hsl(0 0% 40%)",
          marginBottom: 12,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <Clock size={9} style={{ flexShrink: 0 }} />
          {node.vintage}
        </div>

        {/* Questions */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
          {node.questions.slice(0, 4).map((q) => (
            <QTag key={q} text={q} />
          ))}
        </div>

        {/* Signal chips */}
        {node.signals.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
            {node.signals.map((s) => (
              <SignalChip key={s} signal={s} live={liveSignals.has(s)} />
            ))}
          </div>
        )}

        {/* MCP Oracle — no fixed signals, shows endpoints */}
        {node.signals.length === 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "hsl(0 0% 40%)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Answers via
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {["/api/local-intel/oracle", "/api/local-intel/nl-query"].map((ep) => (
                <span key={ep} style={{
                  fontSize: 10, fontFamily: "monospace",
                  padding: "2px 7px", borderRadius: 5,
                  background: "hsl(0 0% 9%)", color: "hsl(0 0% 55%)",
                  border: "1px solid hsl(0 0% 16%)",
                }}>
                  {ep}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Live signal count (if any signals defined) */}
        {node.signals.length > 0 && status !== "building" && (
          <div style={{
            fontSize: 11, color: "hsl(0 0% 40%)", marginBottom: 10,
            display: "flex", alignItems: "center", gap: 4,
          }}>
            {status === "live" ? (
              <CheckCircle2 size={11} style={{ color: "#22c55e" }} />
            ) : (
              <AlertCircle size={11} style={{ color: "#eab308" }} />
            )}
            {liveCount} / {node.signals.length} signals populated for ZIP {ZIP}
          </div>
        )}

        {/* Action row */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { setShowDemo((v) => !v); setExpanded(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 600,
              padding: "5px 11px", borderRadius: 6,
              background: showDemo ? `${node.colorHex}20` : "hsl(0 0% 9%)",
              border: `1px solid ${showDemo ? node.colorHex + "40" : "hsl(0 0% 16%)"}`,
              color: showDemo ? node.colorHex : "hsl(0 0% 60%)",
              cursor: "pointer", transition: "all 160ms",
            }}
          >
            <Code2 size={11} />
            Demo
          </button>
          {node.questions.length > 4 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 11, color: "hsl(0 0% 50%)",
                padding: "5px 8px", borderRadius: 6,
                background: "none", border: "1px solid hsl(0 0% 16%)",
                cursor: "pointer",
              }}
            >
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {expanded ? "Less" : `+${node.questions.length - 4} more`}
            </button>
          )}
        </div>
      </div>

      {/* Expanded questions */}
      {expanded && node.questions.length > 4 && (
        <div style={{
          borderTop: "1px solid hsl(0 0% 12%)",
          padding: "10px 18px 14px",
          display: "flex", flexWrap: "wrap", gap: 5,
        }}>
          {node.questions.slice(4).map((q) => (
            <QTag key={q} text={q} />
          ))}
        </div>
      )}

      {/* Demo panel */}
      {showDemo && (
        <div style={{ borderTop: "1px solid hsl(0 0% 12%)", padding: "0 18px 14px" }}>
          <DemoPanel node={node} onClose={() => setShowDemo(false)} />
        </div>
      )}
    </div>
  );
}

// ── Completeness Header Strip ─────────────────────────────────────────────────

function CompletenessStrip({
  nodesLive,
  signalsPopulated,
  totalSignals,
  loading,
}: {
  nodesLive: number;
  signalsPopulated: number;
  totalSignals: number;
  loading: boolean;
}) {
  const pct = totalSignals > 0 ? Math.round((signalsPopulated / totalSignals) * 100) : 0;
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
      padding: "12px 18px",
      background: "hsl(0 0% 6%)",
      border: "1px solid hsl(0 0% 13%)",
      borderRadius: 10,
      marginBottom: 28,
    }}>
      {/* Chip: nodes live */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "5px 12px", borderRadius: 8,
        background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)",
      }}>
        <CheckCircle2 size={13} style={{ color: "#22c55e" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#f0ebe3" }}>
          {loading ? "—" : nodesLive}
          <span style={{ fontWeight: 400, color: "hsl(0 0% 45%)" }}> / 10 nodes live</span>
        </span>
      </div>

      {/* Chip: signals */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "5px 12px", borderRadius: 8,
        background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 15%)",
      }}>
        <AlertCircle size={13} style={{ color: "#60a5fa" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#f0ebe3" }}>
          {loading ? "—" : signalsPopulated}
          <span style={{ fontWeight: 400, color: "hsl(0 0% 45%)" }}>
            {" "}/ {totalSignals} signals populated for ZIP {ZIP}
          </span>
        </span>
      </div>

      {/* Completeness bar */}
      {!loading && (
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: 10, color: "hsl(0 0% 40%)", marginBottom: 4,
          }}>
            <span>Data completeness</span>
            <span style={{ color: pct > 50 ? "#22c55e" : "#eab308", fontWeight: 600 }}>{pct}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 99, background: "hsl(0 0% 12%)", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${pct}%`, borderRadius: 99,
              background: pct > 50 ? "#22c55e" : "#eab308",
              transition: "width 600ms cubic-bezier(.4,0,.2,1)",
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function LocalIntelNodesPage() {
  const [liveSignals, setLiveSignals] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSignals = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch(`${RAILWAY}/api/local-intel/zip-signals/${ZIP}`, {
        headers: { "x-admin-token": ADMIN_TOKEN },
        cache: "no-store",
      });
      if (!res.ok) {
        setLiveSignals(new Set());
        return;
      }
      const data = await res.json();

      // data might be { error: "..." } if no signals yet
      if (data?.error) {
        setLiveSignals(new Set());
        return;
      }

      // data is expected to be an object of signal_key -> value
      // collect any key that has a non-null, non-undefined value
      const populated = new Set<string>();
      const flat = (obj: Record<string, unknown>, prefix = "") => {
        for (const [k, v] of Object.entries(obj)) {
          const key = prefix ? `${prefix}_${k}` : k;
          if (v !== null && v !== undefined && v !== "") {
            populated.add(key);
            // also try bare key
            populated.add(k);
          }
          if (v && typeof v === "object" && !Array.isArray(v)) {
            flat(v as Record<string, unknown>, prefix);
          }
        }
      };
      flat(data);
      setLiveSignals(populated);
    } catch {
      setLiveSignals(new Set());
    } finally {
      setLoading(false);
      setLastFetch(new Date());
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  // Compute completeness stats
  const allSignals = NODES.flatMap((n) => n.signals);
  const totalSignals = allSignals.length;
  const signalsPopulated = allSignals.filter((s) => liveSignals.has(s)).length;
  const nodesLive = NODES.filter((n) => {
    if (n.status === "building") return false;
    if (n.signals.length === 0) return false;
    return n.signals.some((s) => liveSignals.has(s));
  }).length;

  return (
    <div style={{
      flex: 1, overflowY: "auto",
      padding: "28px 28px 48px",
      background: "hsl(0 0% 4%)",
      minHeight: "100%",
    }}>
      {/* ── Page Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              {/* Small inline logo mark */}
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Brain size={17} style={{ color: "#ef4444" }} />
              </div>
              <h1 style={{
                fontSize: 20, fontWeight: 700, color: "#f0ebe3",
                letterSpacing: "-0.01em",
              }}>
                LocalIntel Intelligence Nodes
              </h1>
            </div>
            <p style={{ fontSize: 13, color: "hsl(0 0% 45%)", maxWidth: 580, lineHeight: 1.5 }}>
              Every data asset — what it knows, what questions it answers, what signals it writes.
              Status shown for ZIP <span style={{ fontFamily: "monospace", color: "hsl(0 0% 65%)", fontWeight: 600 }}>{ZIP}</span>.
            </p>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => fetchSignals(true)}
            disabled={refreshing || loading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, fontWeight: 500,
              padding: "7px 14px", borderRadius: 8,
              background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 17%)",
              color: "hsl(0 0% 60%)", cursor: "pointer",
              opacity: refreshing || loading ? 0.5 : 1,
              transition: "all 160ms",
            }}
          >
            <RefreshCw size={12} style={{
              animation: refreshing || loading ? "spin 1s linear infinite" : "none"
            }} />
            {lastFetch
              ? `Refreshed ${Math.round((Date.now() - lastFetch.getTime()) / 1000)}s ago`
              : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Completeness Strip ── */}
      <CompletenessStrip
        nodesLive={nodesLive}
        signalsPopulated={signalsPopulated}
        totalSignals={totalSignals}
        loading={loading}
      />

      {/* ── Node Grid ── */}
      <div className="nodes-grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
      }}>
        {NODES.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            liveSignals={liveSignals}
          />
        ))}
      </div>

      {/* ── Responsive overrides + keyframes ── */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }

        /* Responsive grid */
        @media (max-width: 1024px) {
          .nodes-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .nodes-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
