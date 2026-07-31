"use client";

import type { ConceptOutcome, RunComparison } from "@/lib/deskStore";

export function RunComparisonCard({ comparison }: { comparison: RunComparison }) {
  return (
    <section className="rounded-lg border border-sky-500/35 bg-sky-500/10 p-4 space-y-2">
      <h3 className="text-base font-semibold text-foreground">
        vs prior {comparison.symbol} run
      </h3>
      <p className="text-sm text-foreground/85">{comparison.note}</p>
      <p className="text-xs text-foreground/60">
        Prior {new Date(comparison.prior.analyzedAt).toLocaleString()} · refining plays from what changed
      </p>
      <div className="grid sm:grid-cols-2 gap-2 pt-1">
        {comparison.convictionDelta
          .filter((d) => d.delta != null)
          .slice(0, 8)
          .map((d) => (
            <div
              key={d.ideaKind}
              className="rounded border border-border/50 bg-background/40 px-2 py-1.5 text-sm"
            >
              <span className="font-medium">{d.ideaKind}</span>
              <span className="text-foreground/70">
                {" "}
                {d.priorPct}% → {d.currentPct}%{" "}
                <span className={Number(d.delta) >= 0 ? "text-emerald-300" : "text-red-300"}>
                  ({Number(d.delta) >= 0 ? "+" : ""}
                  {d.delta})
                </span>
              </span>
            </div>
          ))}
      </div>
    </section>
  );
}

export function ConceptOutcomesPanel({
  outcomes,
  symbol,
}: {
  outcomes: ConceptOutcome[];
  symbol: string;
}) {
  const rows = outcomes
    .filter((o) => o.symbol === symbol)
    .sort((a, b) => Date.parse(b.runAt) - Date.parse(a.runAt));
  if (!rows.length) return null;

  const open = rows.filter((o) => !o.resolved);
  const done = rows.filter((o) => o.resolved);

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div>
        <h3 className="text-base font-semibold">Concept monitor · {symbol}</h3>
        <p className="text-sm text-foreground/75">
          Every idea is paper-tracked to expiry — executed or not. Results persist for the next run.
        </p>
      </div>
      {open.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-foreground/55">
            Open to expiry ({open.length})
          </div>
          {open.map((o) => (
            <div
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm rounded border border-border/50 bg-background/40 px-2 py-1.5"
            >
              <span className="font-medium truncate max-w-[60%]">
                {o.title}
                {o.executed ? " · LIVE" : " · paper"}
              </span>
              <span className="text-foreground/70 tabular-nums">
                {o.pnlPct != null ? `${o.pnlPct > 0 ? "+" : ""}${o.pnlPct}%` : "—"}
                {" · "}
                exp {o.expiresAt.slice(0, 10)}
              </span>
            </div>
          ))}
        </div>
      )}
      {done.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-foreground/55">
            Resolved ({done.length})
          </div>
          {done.slice(0, 12).map((o) => (
            <div
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm rounded border border-border/40 bg-secondary/30 px-2 py-1.5"
            >
              <span className="truncate max-w-[55%]">{o.title}</span>
              <span
                className={
                  o.resolved?.result === "win"
                    ? "text-emerald-300"
                    : o.resolved?.result === "loss" || o.resolved?.result === "stopped"
                      ? "text-red-300"
                      : "text-foreground/70"
                }
              >
                {o.resolved?.result}
                {o.pnlPct != null ? ` · ${o.pnlPct > 0 ? "+" : ""}${o.pnlPct}%` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
