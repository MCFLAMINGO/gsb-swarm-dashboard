"use client";

import { useState, useCallback, useEffect } from "react";
import {
  BrainCircuit, Cpu, Building2, MessageSquare, Ban, Home, Send, Clock
} from "lucide-react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";
const TARGET_ZIPS = ["32082", "32081", "32250", "32266", "32233", "32259", "32034"];

// ── Types ────────────────────────────────────────────────────────────────────

interface DensityRow {
  category: string;
  count: number;
}

interface IntentRow {
  detected_intent: string;
  count: number;
}

interface PropertySnapshot {
  avg_beds: number;
  avg_baths: number;
  avg_assessed: number;
  parcel_count: number;
}

interface CeoAssessment {
  zip: string;
  query_context: string;
  assessed_at: string;
  business_density: DensityRow[];
  total_businesses: number;
  property_snapshot: PropertySnapshot;
  demand_signals: {
    top_sms_intents: IntentRow[];
    unmet_demand: IntentRow[];
  };
  ceo_summary: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return fallback;
    return await res.json() as T;
  } catch {
    return fallback;
  }
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

function fmtMoney(n: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
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

function SectionHeader({ icon: Icon, title, color = "#00e5a0" }: {
  icon: React.ElementType; title: string; color?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <Icon size={17} style={{ color }} />
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#f0ebe3", flex: 1 }}>{title}</h2>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CeoIntelPage() {
  const [zip, setZip] = useState("32082");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<CeoAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchAssessment = useCallback(async (selectedZip: string, q: string) => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ zip: selectedZip });
    if (q.trim()) params.set("q", q.trim());
    const url = `${RAILWAY}/api/local-intel/ceo-assess?${params.toString()}`;
    const result = await safeFetch<CeoAssessment | null>(url, null);
    if (!result || !result.zip) {
      setError(true);
      setData(null);
    } else {
      setData(result);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAssessment(zip, "");
  }, [zip, fetchAssessment]);

  const handleAsk = () => {
    fetchAssessment(zip, query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAsk();
  };

  const maxDensity = data?.business_density?.length
    ? Math.max(...data.business_density.map(d => d.count))
    : 1;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px", background: "hsl(0 0% 4%)" }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f0ebe3", display: "flex", alignItems: "center", gap: 10 }}>
          <BrainCircuit size={20} style={{ color: "#00e5a0" }} />
          CEO Intelligence
        </h1>
        <p style={{ fontSize: 12, color: "hsl(0 0% 45%)", marginTop: 4 }}>
          ZIP-level business intelligence — powered by government data, zero hallucination
        </p>
      </div>

      {/* ── ZIP selector pills ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {TARGET_ZIPS.map(z => {
          const selected = z === zip;
          return (
            <button
              key={z}
              onClick={() => setZip(z)}
              style={{
                padding: "8px 16px",
                borderRadius: 99,
                fontSize: 13,
                fontFamily: "monospace",
                fontWeight: 600,
                cursor: "pointer",
                background: selected ? "rgba(0,229,160,0.08)" : "hsl(0 0% 7%)",
                border: `1px solid ${selected ? "#00e5a0" : "hsl(0 0% 14%)"}`,
                color: selected ? "#00e5a0" : "hsl(0 0% 55%)",
                transition: "all 200ms"
              }}
            >
              {z}
            </button>
          );
        })}
      </div>

      {/* ── CEO> prompt bar ── */}
      <Panel style={{ marginBottom: 24, padding: "8px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 13, fontWeight: 700, fontFamily: "monospace",
            color: "#00e5a0", padding: "6px 10px",
            background: "rgba(0,229,160,0.08)", borderRadius: 6,
            border: "1px solid rgba(0,229,160,0.25)"
          }}>
            CEO&gt;
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ask about any business, address, or market trend..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#f0ebe3",
              fontSize: 14,
              padding: "8px 4px"
            }}
          />
          <button
            onClick={handleAsk}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: loading ? "hsl(0 0% 10%)" : "rgba(0,229,160,0.10)",
              border: `1px solid ${loading ? "hsl(0 0% 18%)" : "#00e5a0"}`,
              color: loading ? "hsl(0 0% 40%)" : "#00e5a0",
              cursor: loading ? "default" : "pointer",
              transition: "all 200ms"
            }}
          >
            <Send size={13} />
            {loading ? "Asking…" : "Ask"}
          </button>
        </div>
      </Panel>

      {/* ── Loading skeletons ── */}
      {loading && (
        <>
          <Panel style={{ marginBottom: 16 }}>
            <Skeleton h={18} w="40%" />
            <div style={{ marginTop: 12 }}><Skeleton h={14} /></div>
            <div style={{ marginTop: 8 }}><Skeleton h={14} w="80%" /></div>
          </Panel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Panel><Skeleton h={140} /></Panel>
            <Panel><Skeleton h={140} /></Panel>
          </div>
        </>
      )}

      {/* ── Error state ── */}
      {!loading && error && (
        <Panel style={{ textAlign: "center", padding: 40 }}>
          <span style={{ fontSize: 13, color: "hsl(0 0% 45%)" }}>
            No assessment available for this ZIP
          </span>
        </Panel>
      )}

      {/* ── Results ── */}
      {!loading && !error && data && (
        <>
          {/* Panel 1 — CEO Summary */}
          <div style={{
            background: "hsl(0 0% 7%)",
            border: "1px solid hsl(0 0% 14%)",
            borderLeft: "3px solid #00e5a0",
            borderRadius: 12,
            padding: "24px 28px",
            marginBottom: 16
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 12
            }}>
              <Cpu size={15} style={{ color: "#00e5a0" }} />
              <span style={{
                fontSize: 11, color: "#00e5a0", textTransform: "uppercase",
                letterSpacing: "0.08em", fontWeight: 700
              }}>
                Executive Summary · ZIP {data.zip}
              </span>
            </div>
            <p style={{
              fontSize: 17,
              lineHeight: 1.55,
              color: "#f0ebe3",
              fontStyle: "italic",
              margin: 0,
              fontFamily: "Georgia, serif"
            }}>
              &ldquo;{data.ceo_summary}&rdquo;
            </p>
            <div style={{
              fontSize: 11, color: "hsl(0 0% 40%)", marginTop: 14,
              display: "flex", alignItems: "center", gap: 6
            }}>
              <Clock size={11} />
              Assessed {fmtDate(data.assessed_at)}
              {data.query_context && (
                <>
                  <span style={{ margin: "0 4px" }}>·</span>
                  <span style={{ fontFamily: "monospace", color: "hsl(0 0% 55%)" }}>
                    query: {data.query_context}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Panel 2 + 3 — side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {/* Business Density */}
            <Panel>
              <SectionHeader icon={Building2} title="Business Density" color="#00e5a0" />
              {data.business_density.length === 0 ? (
                <span style={{ fontSize: 12, color: "hsl(0 0% 40%)" }}>No business data</span>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.business_density.map((row) => {
                    const pct = Math.max(2, Math.round((row.count / maxDensity) * 100));
                    return (
                      <div key={row.category}>
                        <div style={{
                          display: "flex", justifyContent: "space-between",
                          marginBottom: 4
                        }}>
                          <span style={{ fontSize: 12, color: "#f0ebe3", textTransform: "capitalize" }}>
                            {row.category}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#00e5a0", fontFamily: "monospace" }}>
                            {row.count.toLocaleString()}
                          </span>
                        </div>
                        <div style={{
                          height: 8, borderRadius: 99,
                          background: "hsl(0 0% 14%)", overflow: "hidden"
                        }}>
                          <div style={{
                            height: "100%", width: `${pct}%`, borderRadius: 99,
                            background: "#00e5a0",
                            transition: "width 600ms cubic-bezier(.4,0,.2,1)"
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{
                marginTop: 16, paddingTop: 12,
                borderTop: "1px solid hsl(0 0% 14%)",
                display: "flex", justifyContent: "space-between"
              }}>
                <span style={{ fontSize: 11, color: "hsl(0 0% 45%)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Total Businesses
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#f0ebe3" }}>
                  {data.total_businesses.toLocaleString()}
                </span>
              </div>
            </Panel>

            {/* Demand Signals */}
            <Panel>
              <SectionHeader icon={MessageSquare} title="Demand Signals" color="#00e5a0" />

              {/* Top intents */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 11, color: "hsl(0 0% 55%)",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  marginBottom: 8, display: "flex", alignItems: "center", gap: 6
                }}>
                  <MessageSquare size={11} />
                  What People Are Asking
                </div>
                {data.demand_signals.top_sms_intents.length === 0 ? (
                  <span style={{ fontSize: 11, color: "hsl(0 0% 35%)" }}>No intent data</span>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {data.demand_signals.top_sms_intents.map((row, i) => (
                      <span key={i} style={{
                        padding: "5px 10px", borderRadius: 99, fontSize: 11,
                        background: "rgba(0,229,160,0.10)",
                        border: "1px solid rgba(0,229,160,0.30)",
                        color: "#00e5a0", fontWeight: 500,
                        display: "inline-flex", alignItems: "center", gap: 5
                      }}>
                        {row.detected_intent}
                        <span style={{
                          fontFamily: "monospace", fontSize: 10,
                          color: "#f0ebe3", opacity: 0.7
                        }}>
                          {row.count}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Unmet demand */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 11, color: "hsl(0 0% 55%)",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  marginBottom: 8, display: "flex", alignItems: "center", gap: 6
                }}>
                  <Ban size={11} />
                  Unmet Demand (Dead Ends)
                </div>
                {data.demand_signals.unmet_demand.length === 0 ? (
                  <span style={{ fontSize: 11, color: "hsl(0 0% 35%)" }}>No dead-end data</span>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {data.demand_signals.unmet_demand.map((row, i) => (
                      <span key={i} style={{
                        padding: "5px 10px", borderRadius: 99, fontSize: 11,
                        background: "hsl(4 85% 44% / 0.12)",
                        border: "1px solid hsl(4 85% 44% / 0.35)",
                        color: "hsl(4 85% 65%)", fontWeight: 500,
                        display: "inline-flex", alignItems: "center", gap: 5
                      }}>
                        {row.detected_intent}
                        <span style={{
                          fontFamily: "monospace", fontSize: 10,
                          color: "#f0ebe3", opacity: 0.7
                        }}>
                          {row.count}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Property snapshot stat tiles */}
              <div style={{
                paddingTop: 12,
                borderTop: "1px solid hsl(0 0% 14%)"
              }}>
                <div style={{
                  fontSize: 11, color: "hsl(0 0% 55%)",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  marginBottom: 8, display: "flex", alignItems: "center", gap: 6
                }}>
                  <Home size={11} />
                  Property Snapshot
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  <StatTile label="Avg Beds" value={data.property_snapshot.avg_beds?.toFixed(1) ?? "—"} />
                  <StatTile label="Avg Baths" value={data.property_snapshot.avg_baths?.toFixed(1) ?? "—"} />
                  <StatTile label="Avg Value" value={fmtMoney(data.property_snapshot.avg_assessed)} />
                  <StatTile label="Parcels" value={(data.property_snapshot.parcel_count ?? 0).toLocaleString()} />
                </div>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: "hsl(0 0% 5%)", border: "1px solid hsl(0 0% 12%)",
      borderRadius: 8, padding: "8px 10px", textAlign: "center"
    }}>
      <div style={{
        fontSize: 9, color: "hsl(0 0% 45%)", textTransform: "uppercase",
        letterSpacing: "0.06em", marginBottom: 3
      }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ebe3" }}>
        {value}
      </div>
    </div>
  );
}
