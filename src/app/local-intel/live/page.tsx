"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity, MapPin, Building2, Zap, Radio, CheckCircle2,
  AlertCircle, XCircle, Clock, RefreshCw, Database, Globe,
  Wifi, WifiOff
} from "lucide-react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";

// ── Types ────────────────────────────────────────────────────────────────────

interface CoverageStats {
  zips_covered: number;
  businesses_mapped: number;
  avg_confidence: number;
  covered_zips: ZipRow[];
  active_agents: number;
  source_health: SourceHealth[];
}

interface ZipRow {
  zip: string;
  name: string;
  businesses: number;
  confidence: number;
  completedAt: string;
}

interface SourceHealth {
  source: string;
  status: "ok" | "unavailable" | "error";
  last_checked: string;
}

interface EnrichmentEntry {
  business_name: string;
  zip: string;
  confidence: number;
  sources_used: string[];
  enriched_at: string;
}

interface EnrichmentLog {
  enriched_today: number;
  pipeline_status: "idle" | "enriching";
  entries: EnrichmentEntry[];
}

interface BroadcastEntry {
  registry: string;
  status: string;
  timestamp: string;
  zipsCount: number;
}

interface BroadcastLog {
  entries: BroadcastEntry[];
  last_smithery_at?: string;
}

interface ZipQueue {
  active_count: number;
  queued: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SOURCES = [
  "osm_overpass", "yelp_public", "foursquare",
  "nominatim", "own_website", "sjc_arcgis", "fl_sunbiz"
];

function timeAgo(isoStr: string | undefined): string {
  if (!isoStr) return "—";
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDate(isoStr: string | undefined): string {
  if (!isoStr) return "—";
  try {
    return new Date(isoStr).toLocaleString("en-US", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  } catch {
    return isoStr;
  }
}

function confColor(n: number): string {
  if (n >= 90) return "#22c55e";
  if (n >= 70) return "#eab308";
  return "#ef4444";
}

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return fallback;
    return await res.json() as T;
  } catch {
    return fallback;
  }
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ w = "100%", h = 14 }: { w?: string; h?: number }) {
  return (
    <div
      style={{
        width: w, height: h, borderRadius: 4,
        background: "hsl(0 0% 14%)",
        animation: "pulse 1.5s ease-in-out infinite"
      }}
    />
  );
}

// ── Source Status Dot ─────────────────────────────────────────────────────────

function SourceDot({ status }: { status: "ok" | "unavailable" | "error" | undefined }) {
  const colors: Record<string, string> = {
    ok: "#22c55e",
    unavailable: "#eab308",
    error: "#ef4444",
  };
  const color = colors[status ?? "error"] ?? "#3f3f3f";
  return (
    <span
      style={{
        display: "inline-block", width: 8, height: 8,
        borderRadius: "50%", background: color,
        boxShadow: status === "ok" ? `0 0 6px ${color}88` : "none",
        flexShrink: 0
      }}
    />
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, unit, icon: Icon, color = "#00e5a0", loading
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  color?: string;
  loading?: boolean;
}) {
  return (
    <div style={{
      background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)",
      borderRadius: 12, padding: "20px 24px",
      transition: "border-color 220ms"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon size={15} style={{ color }} />
        <span style={{ fontSize: 11, color: "hsl(0 0% 45%)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
      </div>
      {loading ? (
        <Skeleton h={32} w="60%" />
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, transition: "all 300ms" }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: "#f0ebe3", lineHeight: 1 }}>
            {value}
          </span>
          {unit && <span style={{ fontSize: 14, color: "hsl(0 0% 45%)" }}>{unit}</span>}
        </div>
      )}
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, max, color = "#00e5a0", label }: {
  value: number; max: number; color?: string; label?: string
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "hsl(0 0% 55%)" }}>{label}</span>
          <span style={{ fontSize: 12, color, fontWeight: 600 }}>{pct}%</span>
        </div>
      )}
      <div style={{
        height: 6, borderRadius: 99, background: "hsl(0 0% 14%)", overflow: "hidden"
      }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 99,
          background: color, transition: "width 600ms cubic-bezier(.4,0,.2,1)"
        }} />
      </div>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, badge }: {
  icon: React.ElementType; title: string; badge?: React.ReactNode
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <Icon size={17} style={{ color: "hsl(4 85% 44%)" }} />
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#f0ebe3", flex: 1 }}>{title}</h2>
      {badge}
    </div>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)",
      borderRadius: 12, padding: 20, ...style
    }}>
      {children}
    </div>
  );
}

// ── Table helpers ─────────────────────────────────────────────────────────────

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: cols.map(() => "1fr").join(" "),
      gap: 8, padding: "8px 12px",
      borderBottom: "1px solid hsl(0 0% 14%)", marginBottom: 4
    }}>
      {cols.map(c => (
        <span key={c} style={{ fontSize: 10, color: "hsl(0 0% 40%)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {c}
        </span>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LocalIntelLivePage() {
  const [coverage, setCoverage]     = useState<CoverageStats | null>(null);
  const [enrichment, setEnrichment] = useState<EnrichmentLog | null>(null);
  const [broadcast, setBroadcast]   = useState<BroadcastLog | null>(null);
  const [queue, setQueue]           = useState<ZipQueue | null>(null);
  const [loading, setLoading]       = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [errors, setErrors]         = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const counterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    const errs: Record<string, boolean> = {};

    const [cov, enr, bcast, q] = await Promise.all([
      safeFetch<CoverageStats | null>(`${RAILWAY}/api/local-intel/coverage-stats`, null).catch(() => { errs.coverage = true; return null; }),
      safeFetch<EnrichmentLog | null>(`${RAILWAY}/api/local-intel/enrichment-log`, null).catch(() => { errs.enrichment = true; return null; }),
      safeFetch<BroadcastLog | null>(`${RAILWAY}/api/local-intel/broadcast-log`, null).catch(() => { errs.broadcast = true; return null; }),
      safeFetch<ZipQueue | null>(`${RAILWAY}/api/local-intel/zip-queue`, null).catch(() => { errs.queue = true; return null; }),
    ]);

    // Also fetch source log and merge into coverage
    const srcLog = await safeFetch<{ sources: SourceHealth[] } | null>(
      `${RAILWAY}/api/local-intel/source-log`, null
    ).catch(() => null);

    if (cov && srcLog?.sources) {
      cov.source_health = srcLog.sources;
    }

    setCoverage(cov);
    setEnrichment(enr);
    setBroadcast(bcast);
    setQueue(q);
    setErrors(errs);
    setLoading(false);
    setLastUpdated(new Date());
    setSecondsAgo(0);
  }, []);

  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(fetchAll, 30_000);
    counterRef.current = setInterval(() => setSecondsAgo(s => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (counterRef.current) clearInterval(counterRef.current);
    };
  }, [fetchAll]);

  const FL_TOTAL = 983;
  const zipsCount    = coverage?.zips_covered ?? 0;
  const bizCount     = coverage?.businesses_mapped ?? 0;
  const avgConf      = coverage?.avg_confidence ?? 0;
  const activeAgents = coverage?.active_agents ?? queue?.active_count ?? 0;

  const coveredZips: ZipRow[] = coverage?.covered_zips ?? [];
  const sourceHealth: SourceHealth[] = coverage?.source_health ?? [];
  const enrichedToday = enrichment?.enriched_today ?? 0;
  const pipelineStatus = enrichment?.pipeline_status ?? "idle";
  const enrichEntries: EnrichmentEntry[] = enrichment?.entries ?? [];
  const broadcastEntries: BroadcastEntry[] = broadcast?.entries ?? [];
  const lastSmithery = broadcast?.last_smithery_at;

  // Build a source health map for quick lookup
  const sourceMap: Record<string, SourceHealth> = {};
  sourceHealth.forEach(s => { sourceMap[s.source] = s; });

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px", background: "hsl(0 0% 4%)" }}>
      {/* ── Page Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f0ebe3", display: "flex", alignItems: "center", gap: 10 }}>
            <Radio size={20} style={{ color: "#00e5a0" }} />
            Swarm Intelligence — Live Feed
          </h1>
          <p style={{ fontSize: 12, color: "hsl(0 0% 45%)", marginTop: 4 }}>
            Real-time ZIP coverage · enrichment pipeline · agent broadcasts · polling every 30s
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            fontSize: 11, color: "hsl(0 0% 40%)",
            display: "flex", alignItems: "center", gap: 5
          }}>
            <Clock size={11} />
            {lastUpdated ? `Updated ${secondsAgo}s ago` : "Loading…"}
          </span>
          <button
            onClick={fetchAll}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8, fontSize: 12,
              background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 18%)",
              color: "hsl(0 0% 70%)", cursor: "pointer"
            }}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION A — ZIP COVERAGE
          ══════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 8 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
          paddingBottom: 10, borderBottom: "1px solid hsl(0 0% 14%)"
        }}>
          <MapPin size={16} style={{ color: "#00e5a0" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f0ebe3", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            A — ZIP Coverage
          </span>
          {errors.coverage && (
            <span style={{ fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
              <XCircle size={11} /> Backend offline — showing stale data
            </span>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <StatCard label="ZIPs Covered" value={loading ? "—" : zipsCount.toLocaleString()} icon={MapPin} color="#00e5a0" loading={loading} />
        <StatCard label="Businesses Mapped" value={loading ? "—" : bizCount.toLocaleString()} icon={Building2} color="#00e5a0" loading={loading} />
        <StatCard label="Avg Confidence" value={loading ? "—" : `${avgConf.toFixed(1)}`} unit="%" icon={Activity} color="#eab308" loading={loading} />
        <StatCard label="Active Agents" value={loading ? "—" : activeAgents.toLocaleString()} icon={Zap} color="hsl(4 85% 44%)" loading={loading} />
      </div>

      {/* ZIP progress bar */}
      <Panel style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#f0ebe3" }}>Florida ZIP Coverage Progress</span>
          <span style={{ fontSize: 11, color: "hsl(0 0% 40%)", marginLeft: 8 }}>Target: {FL_TOTAL} ZIPs</span>
        </div>
        <ProgressBar
          value={zipsCount} max={FL_TOTAL} color="#00e5a0"
          label={`${zipsCount} / ${FL_TOTAL} ZIPs`}
        />
      </Panel>

      {/* Two-column: Covered ZIPs table + Source Health */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

        {/* Covered ZIPs table */}
        <Panel>
          <SectionHeader icon={MapPin} title="Covered ZIPs (last 20)" />
          <TableHeader cols={["ZIP", "Name", "Biz", "Conf %", "Completed"]} />
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ padding: "10px 12px", borderBottom: "1px solid hsl(0 0% 10%)" }}>
                <Skeleton h={12} />
              </div>
            ))
          ) : coveredZips.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8,
                padding: "10px 12px", borderBottom: "1px solid hsl(0 0% 10%)"
              }}>
                {["—", "—", "—", "—", "—"].map((v, j) => (
                  <span key={j} style={{ fontSize: 12, color: "hsl(0 0% 30%)" }}>{v}</span>
                ))}
              </div>
            ))
          ) : (
            coveredZips
              .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
              .slice(0, 20)
              .map((row) => (
                <div key={row.zip} style={{
                  display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8,
                  padding: "8px 12px", borderBottom: "1px solid hsl(0 0% 10%)",
                  transition: "background 200ms"
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#00e5a0", fontFamily: "monospace" }}>{row.zip}</span>
                  <span style={{ fontSize: 11, color: "hsl(0 0% 65%)" }}>{row.name || "—"}</span>
                  <span style={{ fontSize: 12, color: "#f0ebe3" }}>{row.businesses.toLocaleString()}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: confColor(row.confidence) }}>
                    {row.confidence.toFixed(0)}%
                  </span>
                  <span style={{ fontSize: 10, color: "hsl(0 0% 40%)" }}>{timeAgo(row.completedAt)}</span>
                </div>
              ))
          )}
        </Panel>

        {/* Source Health Grid */}
        <Panel>
          <SectionHeader icon={Globe} title="Source Health" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SOURCES.map(src => {
              const info = sourceMap[src];
              const status = info?.status;
              return (
                <div key={src} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 8,
                  background: "hsl(0 0% 5%)", border: "1px solid hsl(0 0% 12%)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <SourceDot status={status} />
                    <span style={{
                      fontSize: 12, fontFamily: "monospace",
                      color: status === "ok" ? "#f0ebe3" : "hsl(0 0% 50%)"
                    }}>{src}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                    {status ? (
                      <span style={{
                        padding: "2px 8px", borderRadius: 99, fontSize: 10,
                        background: status === "ok" ? "#22c55e18" : status === "unavailable" ? "#eab30818" : "#ef444418",
                        color: status === "ok" ? "#22c55e" : status === "unavailable" ? "#eab308" : "#ef4444",
                        fontWeight: 600
                      }}>{status}</span>
                    ) : (
                      <span style={{ color: "hsl(0 0% 35%)", fontSize: 10 }}>no data</span>
                    )}
                    <span style={{ color: "hsl(0 0% 40%)", fontSize: 10 }}>
                      {info?.last_checked ? timeAgo(info.last_checked) : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION B — ENRICHMENT PIPELINE
          ══════════════════════════════════════════════════════════ */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
        paddingBottom: 10, borderBottom: "1px solid hsl(0 0% 14%)"
      }}>
        <Database size={16} style={{ color: "#00e5a0" }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#f0ebe3", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          B — Enrichment Pipeline
        </span>
        {errors.enrichment && (
          <span style={{ fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
            <XCircle size={11} /> Endpoint unavailable
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, marginBottom: 24 }}>
        {/* Left: counters + pipeline status */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <div style={{ fontSize: 11, color: "hsl(0 0% 45%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Enriched Today
            </div>
            {loading ? <Skeleton h={28} w="60%" /> : (
              <div style={{ fontSize: 28, fontWeight: 700, color: "#f0ebe3", transition: "all 300ms" }}>
                {enrichedToday.toLocaleString()}
              </div>
            )}
          </Panel>
          <Panel>
            <div style={{ fontSize: 11, color: "hsl(0 0% 45%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Pipeline
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: pipelineStatus === "enriching" ? "#22c55e" : "#eab308",
                boxShadow: pipelineStatus === "enriching" ? "0 0 6px #22c55e88" : "none",
                animation: pipelineStatus === "enriching" ? "pulse 1.5s infinite" : "none"
              }} />
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: pipelineStatus === "enriching" ? "#22c55e" : "#eab308"
              }}>
                {loading ? "—" : pipelineStatus}
              </span>
            </div>
          </Panel>
        </div>

        {/* Right: enrichment log table */}
        <Panel>
          <SectionHeader icon={Database} title="Enrichment Log (last 20)" />
          <TableHeader cols={["Business", "ZIP", "Conf", "Sources", "When"]} />
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ padding: "10px 12px", borderBottom: "1px solid hsl(0 0% 10%)" }}>
                <Skeleton h={12} />
              </div>
            ))
          ) : enrichEntries.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "2fr 0.6fr 0.6fr 1.2fr 0.8fr", gap: 8,
                padding: "10px 12px", borderBottom: "1px solid hsl(0 0% 10%)"
              }}>
                {["—", "—", "—", "—", "—"].map((v, j) => (
                  <span key={j} style={{ fontSize: 11, color: "hsl(0 0% 30%)" }}>{v}</span>
                ))}
              </div>
            ))
          ) : (
            enrichEntries.slice(0, 20).map((entry, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "2fr 0.6fr 0.6fr 1.2fr 0.8fr", gap: 8,
                padding: "8px 12px", borderBottom: "1px solid hsl(0 0% 10%)"
              }}>
                <span style={{ fontSize: 12, color: "#f0ebe3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.business_name}
                </span>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#00e5a0" }}>{entry.zip}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: confColor(entry.confidence) }}>
                  {entry.confidence.toFixed(0)}%
                </span>
                <span style={{ fontSize: 10, color: "hsl(0 0% 50%)" }}>
                  {Array.isArray(entry.sources_used) ? entry.sources_used.join(", ") : entry.sources_used || "—"}
                </span>
                <span style={{ fontSize: 10, color: "hsl(0 0% 40%)" }}>{timeAgo(entry.enriched_at)}</span>
              </div>
            ))
          )}
        </Panel>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION C — AGENT BROADCAST LOG
          ══════════════════════════════════════════════════════════ */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
        paddingBottom: 10, borderBottom: "1px solid hsl(0 0% 14%)"
      }}>
        <Wifi size={16} style={{ color: "#00e5a0" }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#f0ebe3", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          C — Agent Broadcast Log
        </span>
        {errors.broadcast && (
          <span style={{ fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
            <XCircle size={11} /> Endpoint unavailable
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, marginBottom: 24 }}>
        <Panel>
          <SectionHeader icon={Radio} title="Broadcast Attempts (last 10)" />
          <TableHeader cols={["Registry", "Status", "ZIPs", "Timestamp"]} />
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ padding: "10px 12px", borderBottom: "1px solid hsl(0 0% 10%)" }}>
                <Skeleton h={12} />
              </div>
            ))
          ) : broadcastEntries.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1.5fr 1fr 0.6fr 1.2fr", gap: 8,
                padding: "10px 12px", borderBottom: "1px solid hsl(0 0% 10%)"
              }}>
                {["—", "—", "—", "—"].map((v, j) => (
                  <span key={j} style={{ fontSize: 11, color: "hsl(0 0% 30%)" }}>{v}</span>
                ))}
              </div>
            ))
          ) : (
            broadcastEntries.slice(0, 10).map((entry, i) => {
              const ok = entry.status === "success" || entry.status === "ok";
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1.5fr 1fr 0.6fr 1.2fr", gap: 8,
                  padding: "8px 12px", borderBottom: "1px solid hsl(0 0% 10%)"
                }}>
                  <span style={{ fontSize: 12, color: "#f0ebe3", fontWeight: 500 }}>{entry.registry}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 7px",
                    borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 4,
                    background: ok ? "#22c55e18" : "#ef444418",
                    color: ok ? "#22c55e" : "#ef4444", width: "fit-content"
                  }}>
                    {ok ? <CheckCircle2 size={9} /> : <AlertCircle size={9} />}
                    {entry.status}
                  </span>
                  <span style={{ fontSize: 12, color: "hsl(0 0% 55%)" }}>
                    {entry.zipsCount ?? "—"}
                  </span>
                  <span style={{ fontSize: 10, color: "hsl(0 0% 40%)" }}>{timeAgo(entry.timestamp)}</span>
                </div>
              );
            })
          )}
        </Panel>

        {/* Smithery banner */}
        <Panel style={{ minWidth: 220, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "hsl(0 0% 5%)", border: "1px solid hsl(0 0% 18%)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <Radio size={22} style={{ color: "#00e5a0" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "hsl(0 0% 40%)", marginBottom: 4 }}>Last announced to Smithery</div>
            <div style={{
              fontSize: 16, fontWeight: 700,
              color: lastSmithery ? "#00e5a0" : "hsl(0 0% 35%)",
              transition: "color 300ms"
            }}>
              {loading ? "—" : lastSmithery ? timeAgo(lastSmithery) : "Never"}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
