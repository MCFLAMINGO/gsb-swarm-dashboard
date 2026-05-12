"use client";

import { useState, useEffect, useCallback } from "react";
import { Ban, RefreshCw, XCircle } from "lucide-react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";
const ADMIN_TOKEN = "localintel-migrate-2026";

const FAIL_REASONS = [
  "all",
  "no_intent",
  "no_results",
  "no_wallet",
  "rfq_fail",
  "reservation_fail",
  "unknown",
] as const;
type FailReason = typeof FAIL_REASONS[number];

interface DeadEnd {
  id: string;
  query?: string | null;
  zip?: string | null;
  channel?: string | null;
  fail_reason?: string | null;
  intent_path?: string | null;
  intent?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

interface DeadEndsResponse {
  ok?: boolean;
  dead_ends?: DeadEnd[];
  results?: DeadEnd[];
  data?: DeadEnd[];
  count?: number;
  total?: number;
}

function ChannelBadge({ channel }: { channel: string | null | undefined }) {
  const c = (channel || "").toLowerCase();
  const map: Record<string, string> = {
    web:    "bg-blue-500/15 text-blue-400 border-blue-500/20",
    twilio: "bg-purple-500/15 text-purple-400 border-purple-500/20",
    voice:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    sms:    "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
    api:    "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  };
  const cls = map[c] ?? "bg-zinc-500/15 text-zinc-400 border-zinc-500/20";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${cls}`}>
      {channel || "—"}
    </span>
  );
}

function ReasonBadge({ reason }: { reason: string | null | undefined }) {
  const r = (reason || "").toLowerCase();
  // Severity coloring
  const map: Record<string, string> = {
    no_intent:        "bg-amber-500/15 text-amber-400 border-amber-500/20",
    no_results:       "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    no_wallet:        "bg-orange-500/15 text-orange-400 border-orange-500/20",
    rfq_fail:         "bg-red-500/15 text-red-400 border-red-500/20",
    reservation_fail: "bg-red-500/15 text-red-400 border-red-500/20",
    unknown:          "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  };
  const cls = map[r] ?? "bg-zinc-500/15 text-zinc-400 border-zinc-500/20";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${cls}`}>
      {reason || "—"}
    </span>
  );
}

export default function DeadEndsPage() {
  const [rows, setRows] = useState<DeadEnd[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<FailReason>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({ limit: "100" });
      if (filter !== "all") qs.set("reason", filter);
      const res = await fetch(`${RAILWAY}/api/local-intel/dead-ends?${qs.toString()}`, {
        headers: { "x-admin-token": ADMIN_TOKEN },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DeadEndsResponse = await res.json();
      const list = json.dead_ends ?? json.results ?? json.data ?? [];
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "unknown error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Ban size={22} className="text-primary" />
          <div>
            <h1 className="text-xl font-bold">Intent Dead Ends</h1>
            <p className="text-xs text-muted-foreground">Queries that failed to convert — gaps in intent, results, or downstream actions.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as FailReason)}
            className="text-xs border border-border bg-background rounded px-2 py-1.5 text-muted-foreground"
          >
            {FAIL_REASONS.map(r => (
              <option key={r} value={r}>{r === "all" ? "All reasons" : r}</option>
            ))}
          </select>
          <span className="px-2 py-1 rounded-full bg-secondary text-xs text-muted-foreground border border-border">
            {rows.length} entr{rows.length !== 1 ? "ies" : "y"}
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {err && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <XCircle size={15} /> {err}
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            <RefreshCw size={18} className="animate-spin mx-auto mb-2" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No dead ends logged yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["Time", "Query", "ZIP", "Channel", "Fail Reason", "Intent Path"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const id = row.id || String(i);
                  const intentPath = row.intent_path || row.intent || "";
                  return (
                    <tr key={id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                        {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-2.5 max-w-[260px] truncate text-foreground" title={row.query ?? ""}>
                        {row.query || "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-foreground whitespace-nowrap">{row.zip || "—"}</td>
                      <td className="px-4 py-2.5"><ChannelBadge channel={row.channel} /></td>
                      <td className="px-4 py-2.5"><ReasonBadge reason={row.fail_reason} /></td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground max-w-[220px] truncate" title={intentPath}>
                        {intentPath || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
