"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AlertTriangle, RefreshCw, Clock } from "lucide-react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";

interface DeadEnd {
  id: number;
  raw_query: string;
  zip: string | null;
  channel: string;
  detected_intent: string | null;
  reason: string | null;
  created_at: string;
}

function timeAgo(isoStr: string | undefined | null): string {
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

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return fallback;
    return await res.json() as T;
  } catch {
    return fallback;
  }
}

function ChannelBadge({ channel }: { channel: string }) {
  const c = (channel || "").toLowerCase();
  let bg = "hsl(0 0% 14%)";
  let color = "hsl(0 0% 55%)";
  if (c === "sms") {
    bg = "#3b82f618";
    color = "#3b82f6";
  } else if (c === "voice") {
    bg = "#a855f718";
    color = "#a855f7";
  }
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 99, fontSize: 10,
      background: bg, color, fontWeight: 600,
      display: "inline-block", textTransform: "lowercase"
    }}>
      {channel || "—"}
    </span>
  );
}

export default function DeadEndsPage() {
  const [rows, setRows] = useState<DeadEnd[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [error, setError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const counterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    const data = await safeFetch<DeadEnd[] | null>(
      `${RAILWAY}/api/local-intel/dead-ends`,
      null
    );
    if (data === null) {
      setError(true);
      setRows([]);
    } else {
      setError(false);
      setRows(Array.isArray(data) ? data : []);
    }
    setLoading(false);
    setLastUpdated(new Date());
    setSecondsAgo(0);
  }, []);

  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(fetchData, 60_000);
    counterRef.current = setInterval(() => setSecondsAgo(s => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (counterRef.current) clearInterval(counterRef.current);
    };
  }, [fetchData]);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px", background: "hsl(0 0% 4%)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f0ebe3", display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={20} style={{ color: "#00e5a0" }} />
            Intent Dead Ends
          </h1>
          <p style={{ fontSize: 12, color: "hsl(0 0% 45%)", marginTop: 4 }}>
            Queries that failed to convert — gaps in intent · polling every 60s
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
            onClick={fetchData}
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

      {error && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", borderRadius: 8,
          background: "hsl(4 85% 44% / 0.10)", border: "1px solid hsl(4 85% 44% / 0.3)",
          color: "hsl(4 85% 65%)", fontSize: 12
        }}>
          Backend unavailable — showing empty state
        </div>
      )}

      {/* Table */}
      <div style={{
        background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)",
        borderRadius: 12, padding: 20
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 0.6fr 0.6fr 1fr 1.4fr 0.7fr",
          gap: 8, padding: "8px 12px",
          borderBottom: "1px solid hsl(0 0% 14%)", marginBottom: 4
        }}>
          {["Query", "ZIP", "Channel", "Intent", "Reason", "When"].map(c => (
            <span key={c} style={{ fontSize: 10, color: "hsl(0 0% 40%)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {c}
            </span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "hsl(0 0% 40%)" }}>
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "hsl(0 0% 40%)" }}>
            No dead ends logged yet
          </div>
        ) : (
          rows.map((row, i) => {
            const query = row.raw_query || "";
            const truncatedQuery = query.length > 60 ? query.slice(0, 60) + "…" : query;
            return (
              <div key={row.id ?? i} style={{
                display: "grid",
                gridTemplateColumns: "2fr 0.6fr 0.6fr 1fr 1.4fr 0.7fr",
                gap: 8, padding: "8px 12px",
                borderBottom: "1px solid hsl(0 0% 10%)",
                alignItems: "center"
              }}>
                <span
                  style={{ fontSize: 12, color: "#f0ebe3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={query || undefined}
                >
                  {truncatedQuery || "—"}
                </span>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: "#00e5a0" }}>
                  {row.zip || "—"}
                </span>
                <span><ChannelBadge channel={row.channel} /></span>
                <span style={{ fontSize: 11, color: "hsl(0 0% 65%)", fontFamily: "monospace" }}>
                  {row.detected_intent || "—"}
                </span>
                <span style={{ fontSize: 11, color: "hsl(0 0% 60%)" }}>
                  {row.reason || "—"}
                </span>
                <span style={{ fontSize: 10, color: "hsl(0 0% 40%)" }}>
                  {timeAgo(row.created_at)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
