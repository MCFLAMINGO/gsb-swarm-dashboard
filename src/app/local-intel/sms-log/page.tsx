"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageSquare, RefreshCw, Clock } from "lucide-react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";

interface SmsLogEntry {
  id: number;
  from_number: string;
  body: string;
  zip: string | null;
  detected_intent: string | null;
  response_sent: string | null;
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

export default function SmsLogPage() {
  const [rows, setRows] = useState<SmsLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [error, setError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const counterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    const data = await safeFetch<SmsLogEntry[] | null>(
      `${RAILWAY}/api/local-intel/sms-log`,
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
    timerRef.current = setInterval(fetchData, 30_000);
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
            <MessageSquare size={20} style={{ color: "#00e5a0" }} />
            SMS Query Log
          </h1>
          <p style={{ fontSize: 12, color: "hsl(0 0% 45%)", marginTop: 4 }}>
            Inbound SMS queries — what was asked, how it routed, what was sent back · polling every 30s
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
          gridTemplateColumns: "1.2fr 0.6fr 1.8fr 1fr 2fr 0.7fr",
          gap: 8, padding: "8px 12px",
          borderBottom: "1px solid hsl(0 0% 14%)", marginBottom: 4
        }}>
          {["From", "ZIP", "Query", "Intent", "Response", "When"].map(c => (
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
            No SMS queries logged yet
          </div>
        ) : (
          rows.map((row, i) => {
            const query = row.body || "";
            const truncatedQuery = query.length > 60 ? query.slice(0, 60) + "…" : query;
            const response = row.response_sent || "";
            const truncatedResp = response.length > 80 ? response.slice(0, 80) + "…" : response;
            return (
              <div key={row.id ?? i} style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 0.6fr 1.8fr 1fr 2fr 0.7fr",
                gap: 8, padding: "8px 12px",
                borderBottom: "1px solid hsl(0 0% 10%)",
                alignItems: "center"
              }}>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: "#f0ebe3" }}>
                  {row.from_number || "—"}
                </span>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: "#00e5a0" }}>
                  {row.zip || "—"}
                </span>
                <span
                  style={{ fontSize: 12, color: "#f0ebe3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={query || undefined}
                >
                  {truncatedQuery || "—"}
                </span>
                <span style={{ fontSize: 11, color: "hsl(0 0% 65%)", fontFamily: "monospace" }}>
                  {row.detected_intent || "—"}
                </span>
                <span
                  style={{ fontSize: 11, color: "hsl(0 0% 60%)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={response || undefined}
                >
                  {truncatedResp || "—"}
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
