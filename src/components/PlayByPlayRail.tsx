"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type PlanStep = {
  id?: string;
  phase?: string;
  title?: string;
  status?: string;
  detail?: string;
};

type PlanEvent = {
  at?: string;
  event?: string;
  detail?: string;
};

type PlanLevels = {
  entry?: number | null;
  stop?: number | null;
  target?: number | null;
  stretch?: number | null;
};

type ArmedPlan = {
  id: string;
  symbol?: string;
  side?: string;
  status?: string;
  live?: boolean;
  dry_run?: boolean;
  last_mark?: number | null;
  levels?: PlanLevels;
  filled_notional?: number | null;
  open_filled?: boolean;
  open_submitted?: boolean;
  open_when?: string | null;
  earliest_open_at?: number | null;
  order_state?: string | null;
  filled_qty?: number | null;
  steps?: Array<PlanStep & {
    result?: {
      placed?: {
        parsed?: {
          data?: {
            order?: {
              state?: string;
              cumulative_quantity?: string | number;
            };
          };
        };
      };
    };
  }>;
  events?: PlanEvent[];
  updated_at?: string;
  strategy?: string;
};

function fillTruth(plan: ArmedPlan): { kind: "dry" | "filled" | "submitted_unfilled" | "unknown"; label: string } {
  const open = plan.steps?.find((s) => s.phase === "open");
  if (!plan.live || plan.dry_run || open?.status === "dry_run_done") {
    return { kind: "dry", label: "Dry-run · not placed" };
  }
  const order = open?.result?.placed?.parsed?.data?.order;
  const state = String(plan.order_state || order?.state || "").toLowerCase() || null;
  const cum = Number(plan.filled_qty ?? order?.cumulative_quantity ?? 0);
  if (cum > 0 || state === "filled" || state === "partially_filled") {
    return {
      kind: "filled",
      label: plan.filled_notional != null ? `Filled ~$${plan.filled_notional}` : "Filled in Robinhood",
    };
  }
  if (state === "queued" || state === "unconfirmed" || state === "confirmed" || open?.status === "done") {
    return {
      kind: "submitted_unfilled",
      label: `Submitted · ${state || "queued"} · not filled (no position)`,
    };
  }
  if (plan.open_filled && plan.filled_notional != null) {
    return { kind: "unknown", label: `Marked ~$${plan.filled_notional} (verify in RH)` };
  }
  return { kind: "unknown", label: "No fill yet" };
}

const PHASES = ["wait", "open", "monitor", "add", "close"] as const;

function num(n: unknown): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function fmtPx(n: number | null | undefined) {
  if (n == null) return "—";
  return n >= 100 ? n.toFixed(2) : n.toFixed(3);
}

function fmtPct(n: number | null) {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function pnlPct(side: string | undefined, entry: number | null, mark: number | null) {
  if (entry == null || mark == null || entry === 0) return null;
  const long = !side || side === "long" || side === "hedge";
  return long ? ((mark - entry) / entry) * 100 : ((entry - mark) / entry) * 100;
}

/** 0 = at stop, 100 = at target (side-aware). */
function progressToTarget(
  side: string | undefined,
  entry: number | null,
  stop: number | null,
  target: number | null,
  mark: number | null
) {
  if (mark == null || stop == null || target == null || stop === target) return null;
  const short = side === "short";
  const lo = short ? target : stop;
  const hi = short ? stop : target;
  const span = hi - lo;
  if (!span) return null;
  const raw = short ? ((hi - mark) / span) * 100 : ((mark - lo) / span) * 100;
  return Math.max(0, Math.min(100, raw));
}

function entryMarkerPct(
  side: string | undefined,
  entry: number | null,
  stop: number | null,
  target: number | null
) {
  if (entry == null || stop == null || target == null || stop === target) return 50;
  const short = side === "short";
  const lo = short ? target : stop;
  const hi = short ? stop : target;
  const span = hi - lo;
  if (!span) return 50;
  const raw = short ? ((hi - entry) / span) * 100 : ((entry - lo) / span) * 100;
  return Math.max(0, Math.min(100, raw));
}

function phaseIndex(steps: PlanStep[] | undefined, status?: string) {
  const active = steps?.find((s) => s.status === "active" || s.status === "reviewed");
  if (active?.phase) {
    const i = PHASES.indexOf(active.phase as (typeof PHASES)[number]);
    if (i >= 0) return i;
  }
  if (status === "waiting_trigger") return 0;
  if (status === "monitoring") return 2;
  if (status === "completed" || status === "cancelled") return 4;
  return 1;
}

function PlayCard({
  plan,
  busyPhase,
  onPhase,
}: {
  plan: ArmedPlan;
  busyPhase: string | null;
  onPhase: (planId: string, phase: string) => void;
}) {
  const levels = plan.levels || {};
  const entry = num(levels.entry) ?? num(plan.last_mark);
  const stop = num(levels.stop);
  const target = num(levels.target);
  const mark = num(plan.last_mark);
  const pnl = pnlPct(plan.side, entry, mark);
  const progress = progressToTarget(plan.side, entry, stop, target, mark);
  const entryPct = entryMarkerPct(plan.side, entry, stop, target);
  const activePhase = phaseIndex(plan.steps, plan.status);
  const latest = [...(plan.events || [])].reverse().find((e) => e.event && e.event !== "tick")
    || [...(plan.events || [])].slice(-1)[0]
    || null;
  const lastTick = [...(plan.events || [])].reverse().find((e) => e.event === "tick" || e.event === "tick_wait");
  const live = Boolean(plan.live);
  const monitoring = plan.status === "monitoring" || plan.status === "waiting_trigger";
  const fill = fillTruth(plan);
  const hasPosition = fill.kind === "filled";
  const doneOrCancelled = plan.status === "completed" || plan.status === "cancelled";
  const waitingSession =
    plan.status === "waiting_trigger" &&
    (plan.open_when === "next_rth" ||
      Boolean(plan.earliest_open_at && Date.now() < plan.earliest_open_at));
  const openAtLabel =
    plan.earliest_open_at != null
      ? new Date(plan.earliest_open_at).toLocaleString("en-US", {
          timeZone: "America/New_York",
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        })
      : null;

  const pnlTone =
    !hasPosition && fill.kind !== "dry"
      ? "text-foreground/70"
      : pnl == null
        ? "text-foreground/70"
        : pnl >= 0
          ? "text-emerald-300"
          : "text-red-300";

  const toStop =
    mark != null && stop != null && entry != null
      ? Math.abs(((mark - stop) / (entry || mark)) * 100)
      : null;
  const toTarget =
    mark != null && target != null && entry != null
      ? Math.abs(((target - mark) / (entry || mark)) * 100)
      : null;

  return (
    <article className="rounded-lg border border-border bg-card/80 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">{plan.symbol || "—"}</h3>
            <span className="text-xs uppercase tracking-wide rounded border border-border px-1.5 py-0.5">
              {plan.side || "long"}
            </span>
            <span
              className={`text-xs rounded px-1.5 py-0.5 border ${
                live
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200"
                  : "bg-amber-500/15 border-amber-500/35 text-amber-100"
              }`}
            >
              {live ? "LIVE" : "DRY-RUN"}
            </span>
            {waitingSession ? (
              <span className="text-xs rounded px-1.5 py-0.5 border border-sky-500/40 bg-sky-500/15 text-sky-100">
                Armed · opens {openAtLabel || "next RTH"}
              </span>
            ) : (
              <span className="text-xs text-foreground/60">{plan.status?.replace(/_/g, " ")}</span>
            )}
          </div>
          <p className="text-sm text-foreground/70 mt-1">
            Mark <span className="font-mono text-foreground">{fmtPx(mark)}</span>
            {" · "}Entry <span className="font-mono">{fmtPx(entry)}</span>
            {" · "}Stop <span className="font-mono">{fmtPx(stop)}</span>
            {" · "}Target <span className="font-mono">{fmtPx(target)}</span>
          </p>
          <p
            className={`text-xs mt-1 font-medium ${
              fill.kind === "submitted_unfilled" ? "text-red-300" : "text-foreground/65"
            }`}
          >
            {fill.label}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-semibold tabular-nums ${pnlTone}`}>
            {hasPosition || fill.kind === "dry" ? fmtPct(pnl) : "—"}
          </div>
          <div className="text-xs text-foreground/60">
            {fill.kind === "filled"
              ? "Position P&L vs entry"
              : fill.kind === "dry"
                ? "Paper mark"
                : "No position yet"}
          </div>
        </div>
      </div>

      {/* Stop → Target rail with live mark */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] uppercase tracking-wider text-foreground/50">
          <span>Stop {fmtPx(stop)}</span>
          <span className={pnlTone}>
            {pnl != null && pnl >= 0 ? "In profit / toward target" : "Toward stop"}
          </span>
          <span>Target {fmtPx(target)}</span>
        </div>
        <div className="relative h-3 rounded-full bg-secondary overflow-hidden border border-border/60">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500/35 via-amber-400/25 to-emerald-500/40"
            style={{ width: "100%" }}
          />
          {/* entry marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground/50"
            style={{ left: `${entryPct}%` }}
            title={`Entry ${fmtPx(entry)}`}
          />
          {/* mark thumb */}
          {progress != null && (
            <div
              className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 ${
                live ? "border-emerald-300 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]" : "border-amber-200 bg-amber-300"
              } ${monitoring ? "animate-pulse" : ""}`}
              style={{ left: `${progress}%` }}
              title={`Mark ${fmtPx(mark)}`}
            />
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-foreground/65">
          {toStop != null && <span>{toStop.toFixed(2)}% to stop</span>}
          {toTarget != null && <span>{toTarget.toFixed(2)}% to target</span>}
          {lastTick?.detail && (
            <span className="text-foreground/80">
              Last tick: <span className="font-medium">{lastTick.detail}</span>
            </span>
          )}
        </div>
      </div>

      {/* Phase strip — actionable */}
      <ol className="grid grid-cols-5 gap-1">
        {PHASES.map((phase, i) => {
          const step = plan.steps?.find((s) => s.phase === phase);
          const done = step?.status === "done" || step?.status === "dry_run_done";
          const active = i === activePhase;
          const skipped = !step && phase === "wait";
          const busy = busyPhase === `${plan.id}:${phase}`;
          return (
            <li key={phase}>
              <button
                type="button"
                disabled={doneOrCancelled || busy}
                title={
                  phase === "open" && !hasPosition
                    ? "Retry / force open (short = long put on Agentic)"
                    : phase === "close" && !hasPosition
                      ? "No fill — cancels this armed plan"
                      : `Run ${phase} now`
                }
                onClick={() => onPhase(plan.id, phase)}
                className={`w-full rounded-md border px-1.5 py-1.5 text-center text-[11px] capitalize transition-colors hover:border-accent/60 disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? "border-accent/50 bg-accent/15 text-foreground font-semibold"
                    : done
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100/90"
                      : skipped
                        ? "border-border/30 bg-background/20 text-foreground/35"
                        : "border-border/40 bg-background/30 text-foreground/55"
                } ${busy ? "animate-pulse" : ""}`}
              >
                {busy ? "…" : phase}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="text-[11px] text-foreground/55">
        Tap a phase to act — wait/monitor ticks; open retries fill; add sizes in; close exits (or cancels if no fill).
      </p>

      {latest && (
        <p className="text-xs text-foreground/70">
          Play-by-play:{" "}
          <span className="text-foreground/90 font-medium">{latest.event}</span>
          {latest.detail ? ` — ${latest.detail}` : ""}
          {latest.at ? (
            <span className="text-foreground/50"> · {new Date(latest.at).toLocaleTimeString()}</span>
          ) : null}
        </p>
      )}
    </article>
  );
}

export default function PlayByPlayRail() {
  const [plans, setPlans] = useState<ArmedPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [busyPhase, setBusyPhase] = useState<string | null>(null);

  const load = useCallback(async (opts?: { manual?: boolean }) => {
    const manual = Boolean(opts?.manual);
    if (manual) setRefreshing(true);
    try {
      const res = await fetch("/api/ceo", { cache: "no-store" });
      const text = await res.text();
      if (!text.trim()) throw new Error(`Empty plans response (${res.status})`);
      const data = JSON.parse(text) as { plans?: ArmedPlan[]; error?: string };
      if (data.error) throw new Error(data.error);
      const next = data.plans || [];
      setPlans(next);
      setError(null);
      const at = new Date().toISOString();
      setUpdatedAt(at);
      if (manual) {
        const open = next.filter((p) => p.status !== "completed" && p.status !== "cancelled");
        toast.success("Play-by-play updated", {
          description: `${open.length} open plan${open.length === 1 ? "" : "s"} · ${new Date(at).toLocaleTimeString()}`,
        });
      }
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      if (manual) {
        toast.error("Play-by-play refresh failed", { description: msg });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = window.setInterval(() => load(), 10_000);
    return () => window.clearInterval(iv);
  }, [load]);

  const handlePhase = useCallback(
    async (planId: string, phase: string) => {
      const key = `${planId}:${phase}`;
      setBusyPhase(key);
      try {
        const res = await fetch("/api/ceo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "tick-plan", planId, phase }),
        });
        const text = await res.text();
        if (!text.trim()) throw new Error(`Empty tick response (${res.status})`);
        const out = JSON.parse(text) as {
          ok?: boolean;
          error?: string;
          detail?: string;
          actions?: Array<{ type?: string; result?: string }>;
          plan?: ArmedPlan;
        };
        if (out.error) throw new Error(out.error);
        if (out.plan) {
          setPlans((prev) => prev.map((p) => (p.id === planId ? (out.plan as ArmedPlan) : p)));
        } else {
          await load();
        }
        const action = out.actions?.[0]?.type || phase;
        const detail = out.detail || out.actions?.[0]?.result || out.plan?.status || "ok";
        if (action === "cancelled_no_fill" || action === "cancelled_unsupported_no_fill") {
          toast.message("Plan cancelled", { description: String(detail) });
        } else if (String(detail).includes("EQUITY_SHORT") || String(detail).includes("UNSUPPORTED")) {
          toast.error(`${phase} blocked`, { description: String(detail) });
        } else {
          toast.success(`${phase} · ${action}`, { description: String(detail).slice(0, 160) });
        }
      } catch (e) {
        toast.error(`${phase} failed`, { description: (e as Error).message });
      } finally {
        setBusyPhase(null);
      }
    },
    [load]
  );

  const active = useMemo(() => {
    const open = plans.filter(
      (p) => p.status !== "completed" && p.status !== "cancelled"
    );
    open.sort((a, b) => {
      const al = a.live ? 1 : 0;
      const bl = b.live ? 1 : 0;
      if (al !== bl) return bl - al;
      return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
    });
    return open;
  }, [plans]);

  const spinning = loading || refreshing;

  return (
    <section className="rounded-lg border border-sky-500/35 bg-sky-500/10 p-5 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2.5 text-foreground">
            <Activity className="h-6 w-6 text-sky-300" />
            Play-by-play
          </h2>
          <p className="text-sm text-foreground/80 mt-1 max-w-2xl">
            Real-time status for dry-runs and live Agentic plans — mark vs stop/target, phase, and
            desk-armed plans only (dry-run ≠ RH fill). Real Agentic holdings show in Industry Desk
            “Your Robinhood book.” Desk Refresh = fiduciary cards + FINRA/SEC alt-data. Sync with product.
          </p>
        </div>
        <button
          type="button"
          disabled={spinning}
          onClick={() => load({ manual: true })}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground/85 hover:border-primary/50 disabled:opacity-50"
        >
          {spinning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {refreshing ? "Refreshing…" : "Refresh open book"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-300">Could not load open book — {error}</p>
      )}

      {!error && active.length === 0 && !loading && (
        <p className="text-sm text-foreground/70">
          No open plans. Arm a Preview or Approve live from Desk / Elite — this rail will light up.
        </p>
      )}

      <div className="space-y-3">
        {active.map((p) => (
          <PlayCard key={p.id} plan={p} busyPhase={busyPhase} onPhase={handlePhase} />
        ))}
      </div>

      {updatedAt && (
        <p className="text-xs text-foreground/50 flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin opacity-70" />
          Polling every 10s · last sync {new Date(updatedAt).toLocaleTimeString()} · worker ticks ~30s
        </p>
      )}
    </section>
  );
}
