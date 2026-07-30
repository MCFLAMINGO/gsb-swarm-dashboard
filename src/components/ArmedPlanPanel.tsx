"use client";

import { CheckCircle2, Clock, Crosshair, Loader2, ListOrdered } from "lucide-react";
import type { ActivePosition } from "@/lib/deskStore";

export default function ArmedPlanPanel({
  position,
  onExpandTicker,
}: {
  position: ActivePosition;
  onExpandTicker?: () => void;
}) {
  const plan = (position.lastResult as any)?.plan || (position.lastResult as any);
  const steps = plan?.steps || [];
  const waiting = position.status === "waiting_trigger";
  const trigger =
    steps.find((s: any) => s.phase === "wait")?.detail ||
    plan?.events?.find((e: any) => e.event === "waiting_trigger")?.detail ||
    null;
  const message =
    (position.lastResult as any)?.message ||
    (waiting
      ? "No order yet — agent is waiting for the trigger, then will place and manage."
      : "Plan armed. Server worker is monitoring unattended.");

  return (
    <section
      id="armed-plan"
      className="rounded-lg border border-accent/50 bg-accent/10 p-4 md:p-5 space-y-3 scroll-mt-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
            {waiting ? (
              <Clock className="h-5 w-5 text-amber-300" />
            ) : position.status === "completed" || position.status === "folded" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <Crosshair className="h-5 w-5 text-accent" />
            )}
            Execute worked — plan is live on the server
          </h2>
          <p className="text-base text-foreground/90">{position.title}</p>
          <p className="text-sm text-foreground/75">
            Status: <span className="font-semibold">{position.status.replace(/_/g, " ")}</span>
            {position.planId ? ` · plan ${position.planId.slice(0, 8)}` : ""}
            {position.live ? " · LIVE" : " · dry-run"}
          </p>
        </div>
        {onExpandTicker && (
          <button
            type="button"
            onClick={onExpandTicker}
            className="text-sm text-accent hover:underline"
          >
            Expand other concepts
          </button>
        )}
      </div>

      <div className="rounded-md border border-border/60 bg-background/50 px-3 py-3 text-base text-foreground leading-relaxed">
        {waiting ? (
          <>
            <strong>Nothing was bought yet</strong> — that is correct for a trigger plan.
            {trigger ? (
              <>
                {" "}
                Waiting for: <em>{trigger}</em>. When it prints, the agent places, then monitors stop/target/time.
              </>
            ) : (
              <> Waiting for the entry trigger, then place → monitor → close.</>
            )}
          </>
        ) : (
          message
        )}
      </div>

      {steps.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-foreground/60 flex items-center gap-1">
            <ListOrdered className="h-3.5 w-3.5" /> Plan steps
          </div>
          <ol className="space-y-1">
            {steps.map((s: any, i: number) => {
              const active = s.status === "active" || s.status === "reviewed" || s.status === "dry_run_done";
              const done = s.status === "done" || s.status === "dry_run_done";
              return (
                <li
                  key={s.id || i}
                  className={`text-sm rounded border px-2 py-1.5 ${
                    active
                      ? "border-accent/40 bg-accent/10 text-foreground"
                      : done
                        ? "border-emerald-500/30 bg-emerald-500/5 text-foreground/85"
                        : "border-border/40 bg-background/30 text-foreground/70"
                  }`}
                >
                  <span className="font-semibold">
                    {i + 1}. {s.title || s.phase}
                  </span>
                  <span className="text-foreground/60"> · {s.status || "pending"}</span>
                  {s.detail && <div className="text-foreground/70 mt-0.5">{s.detail}</div>}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {position.status === "waiting_trigger" || position.status === "monitoring" ? (
        <p className="text-xs text-foreground/60 flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Server worker ticks every ~30s — you can leave this page.
        </p>
      ) : null}
    </section>
  );
}
