"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { Phone, RefreshCw, XCircle, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";
const ADMIN_TOKEN = "localintel-migrate-2026";

interface CallTranscript {
  id: string;
  call_sid?: string | null;
  from_number?: string | null;
  to_number?: string | null;
  caller?: string | null;
  duration_seconds?: number | null;
  duration?: number | null;
  status?: string | null;
  transcript?: string | null;
  transcription?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  [key: string]: unknown;
}

interface TranscriptsResponse {
  ok?: boolean;
  transcripts?: CallTranscript[];
  calls?: CallTranscript[];
  results?: CallTranscript[];
  data?: CallTranscript[];
  count?: number;
  total?: number;
}

function formatDuration(secs: number | null | undefined): string {
  if (secs == null || isNaN(secs)) return "—";
  const s = Math.floor(secs);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status || "").toLowerCase();
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    transcribed: { cls: "bg-green-500/15 text-green-400 border-green-500/20", icon: <CheckCircle2 size={11} />, label: "transcribed" },
    completed:   { cls: "bg-green-500/15 text-green-400 border-green-500/20", icon: <CheckCircle2 size={11} />, label: "completed"   },
    pending:     { cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", icon: <Clock size={11} />,      label: "pending"     },
    in_progress: { cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", icon: <Clock size={11} />,      label: "in progress" },
    processing:  { cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", icon: <Clock size={11} />,      label: "processing"  },
    failed:      { cls: "bg-red-500/15 text-red-400 border-red-500/20",          icon: <XCircle size={11} />,    label: "failed"      },
    error:       { cls: "bg-red-500/15 text-red-400 border-red-500/20",          icon: <XCircle size={11} />,    label: "error"       },
    no_audio:    { cls: "bg-amber-500/15 text-amber-400 border-amber-500/20",    icon: <AlertTriangle size={11} />, label: "no audio" },
  };
  const cfg = map[s] ?? { cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20", icon: null, label: status || "—" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

export default function CallTranscriptsPage() {
  const [rows, setRows] = useState<CallTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${RAILWAY}/api/local-intel/call-transcripts?limit=50`, {
        headers: { "x-admin-token": ADMIN_TOKEN },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: TranscriptsResponse = await res.json();
      const list = json.transcripts ?? json.calls ?? json.results ?? json.data ?? [];
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
          <Phone size={22} className="text-primary" />
          <div>
            <h1 className="text-xl font-bold">Call Transcripts</h1>
            <p className="text-xs text-muted-foreground">LocalIntel voice line — inbound call recordings & transcriptions.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-full bg-secondary text-xs text-muted-foreground border border-border">
            {rows.length} call{rows.length !== 1 ? "s" : ""}
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
            No calls yet — call (904) 506-7476 to test
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-8 px-2 py-2.5"></th>
                  {["Time", "Caller", "Duration", "Status", "Transcript"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const id = row.id || row.call_sid || String(i);
                  const isOpen = !!expanded[id];
                  const transcript = row.transcript || row.transcription || "";
                  const truncated = transcript.length > 120 ? transcript.slice(0, 120) + "…" : transcript;
                  const caller = row.caller || row.from_number || "—";
                  const duration = row.duration_seconds ?? row.duration ?? null;
                  const when = row.created_at || row.started_at;
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
                          {when ? new Date(when).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-foreground whitespace-nowrap">{caller}</td>
                        <td className="px-4 py-2.5 font-mono text-foreground whitespace-nowrap">
                          {formatDuration(duration as number | null)}
                        </td>
                        <td className="px-4 py-2.5"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-[420px]">
                          {transcript ? (isOpen ? null : truncated) : <span className="opacity-50">—</span>}
                        </td>
                      </tr>
                      {isOpen && transcript && (
                        <tr className="border-b border-border/50 bg-secondary/10">
                          <td></td>
                          <td colSpan={5} className="px-4 py-3 text-foreground whitespace-pre-wrap text-[13px] leading-relaxed">
                            {transcript}
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
