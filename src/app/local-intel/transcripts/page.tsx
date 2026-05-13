"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Phone, RefreshCw, Clock } from "lucide-react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";

interface CallTranscript {
  call_sid: string;
  caller_id: string | null;
  recording_url: string | null;
  transcription_text: string | null;
  duration_sec: number | null;
  zip: string | null;
  channel: string;
  status: string;
  created_at: string;
  updated_at: string;
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

function StatusPill({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  let bg = "hsl(0 0% 14%)";
  let color = "hsl(0 0% 55%)";
  if (s === "pending") {
    bg = "#eab30818";
    color = "#eab308";
  } else if (s === "transcribed") {
    bg = "#22c55e18";
    color = "#22c55e";
  }
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 99, fontSize: 10,
      background: bg, color, fontWeight: 600,
      display: "inline-block", textTransform: "lowercase"
    }}>
      {status || "—"}
    </span>
  );
}

export default function CallTranscriptsPage() {
  const [rows, setRows] = useState<CallTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [error, setError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const counterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    const data = await safeFetch<CallTranscript[] | null>(
      `${RAILWAY}/api/local-intel/call-transcripts`,
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
            <Phone size={20} style={{ color: "#00e5a0" }} />
            Call Transcripts
          </h1>
          <p style={{ fontSize: 12, color: "hsl(0 0% 45%)", marginTop: 4 }}>
            LocalIntel voice line — inbound call recordings & transcriptions · polling every 30s
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
          gridTemplateColumns: "1.2fr 0.6fr 0.6fr 0.8fr 1.4fr 2fr",
          gap: 8, padding: "8px 12px",
          borderBottom: "1px solid hsl(0 0% 14%)", marginBottom: 4
        }}>
          {["Caller", "ZIP", "Duration", "Status", "Recording", "Transcript"].map(c => (
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
            No calls yet
          </div>
        ) : (
          rows.map((row, i) => {
            const transcript = row.transcription_text || "";
            const truncated = transcript.length > 80 ? transcript.slice(0, 80) + "…" : transcript;
            return (
              <div key={row.call_sid || i} style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 0.6fr 0.6fr 0.8fr 1.4fr 2fr",
                gap: 8, padding: "8px 12px",
                borderBottom: "1px solid hsl(0 0% 10%)",
                alignItems: "center"
              }}>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: "#f0ebe3" }}>
                  {row.caller_id || "—"}
                </span>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: "#00e5a0" }}>
                  {row.zip || "—"}
                </span>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: "#f0ebe3" }}>
                  {row.duration_sec ? `${row.duration_sec}s` : "—"}
                </span>
                <span><StatusPill status={row.status} /></span>
                <span>
                  {row.recording_url ? (
                    <audio controls style={{ height: 28, maxWidth: 200 }} src={row.recording_url} />
                  ) : (
                    <span style={{ fontSize: 12, color: "hsl(0 0% 40%)" }}>—</span>
                  )}
                </span>
                <span
                  style={{ fontSize: 11, color: "hsl(0 0% 65%)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={transcript || undefined}
                >
                  {truncated || "—"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
