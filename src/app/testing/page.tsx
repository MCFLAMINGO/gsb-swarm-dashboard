"use client";

import { useState, useRef, useCallback } from "react";
import { FlaskConical, Play, Zap, CheckCircle2, XCircle, Loader2, Circle, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

const WORKER_URL = "/api/run-app-test";

const APPS = [
  {
    id: "throw",
    name: "THROW",
    url: "https://www.throw5onit.com",
    authType: "wallet-inject",
    color: "hsl(4 85% 44%)",
    desc: "On-chain poker betting app",
  },
  {
    id: "voluntrack",
    name: "VolunTrack",
    url: "https://voluntrack-nexus.lovable.app",
    authType: "e2e-switcher",
    color: "hsl(200 85% 44%)",
    desc: "Volunteer tracking platform",
  },
  {
    id: "passithere",
    name: "PassItHere",
    url: "https://passithere.com",
    authType: "e2e-switcher",
    color: "hsl(140 60% 40%)",
    desc: "Pass-through payment platform",
  },
];

const WORKERS = [
  { id: "W1", label: "Auth",    desc: "Wallet inject / E2E role switcher" },
  { id: "W2", label: "Nav",     desc: "Walks all screens, checks render" },
  { id: "W3", label: "Buttons", desc: "Taps visible buttons, records outcome" },
  { id: "W4", label: "Forms",   desc: "Empty submit + fill validation" },
  { id: "W5", label: "Signals", desc: "MQTT / Supabase network roundtrip" },
];

// ── Types ──────────────────────────────────────────────────────────────────────

type WorkerStatus = "idle" | "running" | "pass" | "fail";
type RunStatus    = "idle" | "running" | "done";

// A single row from W2/W3/W4/W5 — whatever the worker returns
interface ResultRow {
  button?: string;   // W3
  text?:   string;   // W3
  testId?: string;   // W3
  route?:  string;   // W2
  name?:   string;   // W2
  label?:  string;   // W3 config buttons
  ok:      boolean;
  note?:   string;
  error?:  string;
  navigated?:    boolean;
  urlAfter?:     string | null;
  modalOpened?:  boolean;
  errorShown?:   boolean;
  skipped?:      boolean;
  configured?:   boolean;
  // W4
  field?: string;
  expectedError?: string;
  gotError?: boolean;
  // W5
  signal?: string;
  latencyMs?: number;
}

interface TestResult {
  workerId: string;
  status:   WorkerStatus;
  message?: string;
  rows?:    ResultRow[];
}

interface AppRun {
  appId:      string;
  suite:      "quick" | "full";
  runStatus:  RunStatus;
  logs:       string[];
  results:    TestResult[];
  passed:     number;
  failed:     number;
  startedAt?:  number;
  finishedAt?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function workerStatusIcon(s: WorkerStatus) {
  if (s === "running") return <Loader2     className="w-3 h-3 animate-spin text-yellow-400" />;
  if (s === "pass")    return <CheckCircle2 className="w-3 h-3 text-green-400" />;
  if (s === "fail")    return <XCircle      className="w-3 h-3 text-red-400" />;
  return <Circle className="w-3 h-3 text-muted-foreground/40" />;
}

function workerChipColor(s: WorkerStatus) {
  if (s === "running") return "border-yellow-400/50 bg-yellow-400/5 text-yellow-300";
  if (s === "pass")    return "border-green-400/50 bg-green-400/5 text-green-300";
  if (s === "fail")    return "border-red-400/50 bg-red-400/5 text-red-300";
  return "border-border text-muted-foreground";
}

function elapsed(ms?: number) {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function parseSSELine(line: string): { type: string; data: unknown } | null {
  if (!line.startsWith("data: ")) return null;
  try { return JSON.parse(line.slice(6)); } catch { return null; }
}

// Row label: pick the best human-readable identifier from a row
function rowLabel(r: ResultRow): string {
  return r.button || r.label || r.name || r.route || r.field || r.signal || "—";
}

// ── Breakdown table shown when a chip is expanded ──────────────────────────────
function WorkerBreakdown({ rows }: { rows: ResultRow[] }) {
  const failed = rows.filter(r => !r.ok && !r.skipped);
  const passed = rows.filter(r => r.ok);
  const skipped = rows.filter(r => r.skipped);

  return (
    <div className="mt-2 rounded-lg border border-border overflow-hidden text-[10px] font-mono">
      {/* Failed rows first — most important */}
      {failed.length > 0 && (
        <div>
          <div className="px-2 py-1 bg-red-400/10 text-red-400 font-bold border-b border-border">
            ❌ {failed.length} failed
          </div>
          {failed.map((r, i) => (
            <div key={i} className="px-2 py-1.5 border-b border-border/50 bg-red-400/5 space-y-0.5">
              <div className="text-red-300 font-semibold">{rowLabel(r)}</div>
              {r.testId  && <div className="text-muted-foreground">testId: <span className="text-foreground">{r.testId}</span></div>}
              {r.error   && <div className="text-red-400/80">error: {r.error}</div>}
              {r.note    && <div className="text-muted-foreground">note: {r.note}</div>}
              {r.errorShown && <div className="text-red-400/80">error toast visible on page</div>}
              {r.navigated  && r.urlAfter && <div className="text-muted-foreground">landed: {r.urlAfter}</div>}
              {r.expectedError !== undefined && (
                <div className={r.gotError ? "text-green-400" : "text-red-400"}>
                  expected validation error: {r.gotError ? "✅ shown" : "❌ NOT shown"}
                </div>
              )}
              {r.latencyMs !== undefined && <div className="text-muted-foreground">{r.latencyMs}ms</div>}
            </div>
          ))}
        </div>
      )}

      {/* Passed rows — collapsed summary */}
      {passed.length > 0 && (
        <div className="px-2 py-1 text-muted-foreground/50">
          ✅ {passed.length} passed: {passed.map(r => rowLabel(r)).join(", ")}
        </div>
      )}
      {skipped.length > 0 && (
        <div className="px-2 py-1 text-muted-foreground/40">
          ⏭ {skipped.length} skipped
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function TestingPage() {
  const [runs,     setRuns]     = useState<Record<string, AppRun>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}); // "appId-workerId"
  const abortRefs = useRef<Record<string, AbortController>>({});

  const toggleExpanded = (key: string) =>
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const startRun = useCallback(async (appId: string, suite: "quick" | "full") => {
    abortRefs.current[appId]?.abort();
    const ctrl = new AbortController();
    abortRefs.current[appId] = ctrl;

    setRuns(prev => ({
      ...prev,
      [appId]: {
        appId,
        suite,
        runStatus: "running",
        logs: [`▶ Starting ${suite} suite for ${appId}…`],
        results: WORKERS.map(w => ({ workerId: w.id, status: "idle" })),
        passed: 0,
        failed: 0,
        startedAt: Date.now(),
      },
    }));

    try {
      const res = await fetch(WORKER_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ appId, suite }),
        signal:  ctrl.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          const evt = parseSSELine(line);
          if (!evt) continue;

          if (evt.type === "log") {
            // server sends data: as string
            const msg = (evt.data as string) || (evt as Record<string, unknown>).msg as string || "";
            setRuns(prev => {
              const run = prev[appId];
              if (!run) return prev;
              return { ...prev, [appId]: { ...run, logs: [...run.logs, msg] } };
            });

          } else if (evt.type === "worker_start") {
            const d = evt.data as { workerId: string };
            setRuns(prev => {
              const run = prev[appId];
              if (!run) return prev;
              return {
                ...prev,
                [appId]: {
                  ...run,
                  results: run.results.map(r =>
                    r.workerId === d.workerId ? { ...r, status: "running" } : r
                  ),
                },
              };
            });

          } else if (evt.type === "worker_done") {
            const d = evt.data as { workerId: string; passed: boolean; message?: string; rows?: ResultRow[] };
            setRuns(prev => {
              const run = prev[appId];
              if (!run) return prev;
              const results = run.results.map(r =>
                r.workerId === d.workerId
                  ? { ...r, status: d.passed ? ("pass" as WorkerStatus) : ("fail" as WorkerStatus), message: d.message, rows: d.rows }
                  : r
              );
              return {
                ...prev,
                [appId]: {
                  ...run,
                  results,
                  passed: results.filter(r => r.status === "pass").length,
                  failed: results.filter(r => r.status === "fail").length,
                },
              };
            });
            // Auto-expand failed workers so you see the breakdown immediately
            if (!d.passed && d.rows?.length) {
              setExpanded(prev => ({ ...prev, [`${appId}-${d.workerId}`]: true }));
            }

          } else if (evt.type === "done") {
            setRuns(prev => {
              const run = prev[appId];
              if (!run) return prev;
              return { ...prev, [appId]: { ...run, runStatus: "done", finishedAt: Date.now() } };
            });
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setRuns(prev => {
        const run = prev[appId];
        if (!run) return prev;
        return {
          ...prev,
          [appId]: {
            ...run,
            runStatus:  "done",
            finishedAt: Date.now(),
            logs: [...run.logs, `❌ Connection error: ${(err as Error).message}`],
          },
        };
      });
    }
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
          <FlaskConical className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">App Tests</h1>
          <p className="text-sm text-muted-foreground">5-agent Playwright UI testing — live browser automation</p>
        </div>
      </div>

      {/* Worker legend */}
      <div className="flex flex-wrap gap-2">
        {WORKERS.map(w => (
          <div key={w.id} title={w.desc}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-card text-xs text-muted-foreground">
            <span className="font-mono font-bold text-foreground">{w.id}</span>
            <span>{w.label}</span>
          </div>
        ))}
      </div>

      {/* App cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {APPS.map(app => {
          const run       = runs[app.id];
          const isRunning = run?.runStatus === "running";

          return (
            <div key={app.id}
              className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">

              {/* App header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: app.color }} />
                    <span className="font-semibold text-sm">{app.name}</span>
                  </div>
                  <a href={app.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground truncate block mt-0.5">
                    {app.url}
                  </a>
                  <span className="text-[11px] text-muted-foreground/60 font-mono">{app.authType}</span>
                </div>
                {run?.runStatus === "done" && (
                  <div className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    run.failed === 0
                      ? "border-green-400/40 text-green-400 bg-green-400/5"
                      : "border-red-400/40 text-red-400 bg-red-400/5"
                  }`}>
                    {run.failed === 0 ? `${run.passed}/5 PASS` : `${run.failed} FAIL`}
                  </div>
                )}
              </div>

              {/* Worker chips + expandable breakdown */}
              <div className="flex flex-col gap-1">
                <div className="flex gap-1.5 flex-wrap">
                  {WORKERS.map(w => {
                    const res    = run?.results.find(r => r.workerId === w.id);
                    const status: WorkerStatus = res?.status ?? "idle";
                    const expKey = `${app.id}-${w.id}`;
                    const hasRows = (res?.rows?.length ?? 0) > 0;
                    const isOpen  = expanded[expKey];

                    return (
                      <button key={w.id}
                        title={res?.message ?? w.desc}
                        disabled={!hasRows}
                        onClick={() => hasRows && toggleExpanded(expKey)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-mono transition-all
                          ${workerChipColor(status)}
                          ${hasRows ? "cursor-pointer hover:brightness-110" : "cursor-default"}`}>
                        {workerStatusIcon(status)}
                        {w.id}
                        {hasRows && (
                          isOpen
                            ? <ChevronDown  className="w-2.5 h-2.5 ml-0.5 opacity-60" />
                            : <ChevronRight className="w-2.5 h-2.5 ml-0.5 opacity-60" />
                        )}
                      </button>
                    );
                  })}
                  {run?.finishedAt && run.startedAt && (
                    <span className="text-[11px] text-muted-foreground self-center ml-auto">
                      {elapsed(run.finishedAt - run.startedAt)}
                    </span>
                  )}
                </div>

                {/* Per-worker breakdown — renders inline below chips when expanded */}
                {run?.results.map(res => {
                  const expKey = `${app.id}-${res.workerId}`;
                  if (!expanded[expKey] || !res.rows?.length) return null;
                  const wLabel = WORKERS.find(w => w.id === res.workerId)?.label ?? res.workerId;
                  return (
                    <div key={res.workerId} className="mt-1">
                      <div className="text-[10px] font-mono text-muted-foreground mb-1 px-0.5">
                        {res.workerId} · {wLabel} · {res.message}
                      </div>
                      <WorkerBreakdown rows={res.rows} />
                    </div>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => startRun(app.id, "quick")}
                  disabled={isRunning}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isRunning && run.suite === "quick"
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Zap     className="w-3 h-3" />}
                  Quick
                </button>
                <button
                  onClick={() => startRun(app.id, "full")}
                  disabled={isRunning}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-xs font-medium text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isRunning && run.suite === "full"
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Play    className="w-3 h-3" />}
                  Full Suite
                </button>
                {run && (
                  <button
                    onClick={() => { setRuns(prev => { const n = {...prev}; delete n[app.id]; return n; }); setExpanded({}); }}
                    disabled={isRunning}
                    title="Clear results"
                    className="px-2 py-2 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground transition-all disabled:opacity-40"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Log stream */}
              {run && run.logs.length > 0 && (
                <div className="rounded-lg bg-background border border-border p-3 max-h-44 overflow-y-auto">
                  <div className="text-[10px] font-mono space-y-0.5">
                    {run.logs.map((line, i) => {
                      const isError = line.includes("❌") || line.toLowerCase().includes("fail");
                      const isPass  = line.includes("✅") || line.toLowerCase().includes("pass");
                      return (
                        <div key={i} className={
                          isError ? "text-red-400" :
                          isPass  ? "text-green-400" :
                          "text-muted-foreground"
                        }>
                          {line}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-xs text-muted-foreground/50 border-t border-border pt-4">
        Workers run on Railway playwright-worker service · Auto spin-down after 10 min idle ·
        Quick suite: W1+W2 only · Full suite: all 5 workers ·
        Click any chip to expand row-level results
      </div>
    </div>
  );
}
