"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { MessageSquare, RefreshCw, XCircle, ChevronDown, ChevronRight } from "lucide-react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";
const ADMIN_TOKEN = "localintel-migrate-2026";

interface SmsLogEntry {
  id: string;
  caller?: string | null;
  from_number?: string | null;
  query?: string | null;
  body?: string | null;
  zip?: string | null;
  intent?: string | null;
  intent_path?: string | null;
  resolved_via?: string | null;
  response?: string | null;
  response_preview?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

interface SmsLogResponse {
  ok?: boolean;
  sms_log?: SmsLogEntry[];
  results?: SmsLogEntry[];
  data?: SmsLogEntry[];
  entries?: SmsLogEntry[];
  count?: number;
  total?: number;
}

function ResolvedViaBadge({ via }: { via: string | null | undefined }) {
  const v = (via || "").toLowerCase();
  const map: Record<string, string> = {
    search:      "bg-blue-500/15 text-blue-400 border-blue-500/20",
    rfq:         "bg-purple-500/15 text-purple-400 border-purple-500/20",
    ordering:    "bg-green-500/15 text-green-400 border-green-500/20",
    reservation: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    alias:       "bg-teal-500/15 text-teal-400 border-teal-500/20",
    unmatched:   "bg-red-500/15 text-red-400 border-red-500/20",
  };
  const cls = map[v] ?? "bg-zinc-500/15 text-zinc-400 border-zinc-500/20";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${cls}`}>
      {via || "—"}
    </span>
  );
}

export default function SmsLogPage() {
  const [rows, setRows] = useState<SmsLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${RAILWAY}/api/local-intel/sms-log?limit=100`, {
        headers: { "x-admin-token": ADMIN_TOKEN },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: SmsLogResponse = await res.json();
      const list = json.sms_log ?? json.entries ?? json.results ?? json.data ?? [];
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "unknown error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare size={22} className="text-primary" />
          <div>
            <h1 className="text-xl font-bold">SMS Query Log</h1>
            <p className="text-xs text-muted-foreground">Inbound SMS queries — what was asked, how it routed, what was sent back.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-full bg-secondary text-xs text-muted-foreground border border-border">
            {rows.length} quer{rows.length !== 1 ? "ies" : "y"}
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
            No SMS queries logged yet — send a text to (904) 506-7476
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-8 px-2 py-2.5"></th>
                  {["Time", "Caller", "Query", "ZIP", "Intent", "Resolved Via", "Response Preview"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const id = row.id || String(i);
                  const isOpen = !!expanded[id];
                  const caller = row.caller || row.from_number || "—";
                  const query = row.query || row.body || "";
                  const intent = row.intent || row.intent_path || "";
                  const response = row.response || row.response_preview || "";
                  const truncated = response.length > 80 ? response.slice(0, 80) + "…" : response;
                  return (
                    <Fragment key={id}>
                      <tr
                        onClick={() => toggle(id)}
                        className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                      >
                        <td className="px-2 py-2.5 text-muted-foreground">
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                          {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-foreground whitespace-nowrap">{caller}</td>
                        <td className="px-4 py-2.5 max-w-[220px] truncate text-foreground" title={query}>
                          {query || "—"}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-foreground whitespace-nowrap">{row.zip || "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground max-w-[160px] truncate" title={intent}>
                          {intent || "—"}
                        </td>
                        <td className="px-4 py-2.5"><ResolvedViaBadge via={row.resolved_via} /></td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-[300px]">
                          {response ? (isOpen ? null : truncated) : <span className="opacity-50">—</span>}
                        </td>
                      </tr>
                      {isOpen && response && (
                        <tr className="border-b border-border/50 bg-secondary/10">
                          <td></td>
                          <td colSpan={7} className="px-4 py-3 text-foreground whitespace-pre-wrap text-[13px] leading-relaxed">
                            {response}
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
