"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Crosshair,
  Loader2,
  Play,
  ListOrdered,
} from "lucide-react";
import type { ExecutionIdea } from "@/lib/deskIdeas";

export default function ExecutionIdeaCard({
  idea,
  rank,
  busy,
  liveEnabled,
  onExecute,
  onPlaceLive,
  result,
}: {
  idea: ExecutionIdea;
  rank: number;
  busy?: boolean;
  liveEnabled?: boolean;
  onExecute: (idea: ExecutionIdea) => void;
  onPlaceLive?: (idea: ExecutionIdea) => void;
  result?: any;
}) {
  const [open, setOpen] = useState(rank === 1);
  const steps = idea.executionPlan?.steps || [];

  const sideTone =
    idea.side === "long"
      ? "border-emerald-500/40 bg-emerald-500/10"
      : idea.side === "short"
        ? "border-red-500/40 bg-red-500/10"
        : idea.side === "income"
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-border bg-card";

  return (
    <article className={`rounded-lg border ${sideTone} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-background/20 transition-colors"
      >
        <span className="mt-0.5 text-foreground/60">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-foreground/50 tabular-nums">#{rank}</span>
            <h3 className="text-base font-semibold text-foreground">{idea.title}</h3>
            {idea.badge && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-border bg-secondary">
                {idea.badge}
              </span>
            )}
            {steps.length > 0 && (
              <span className="text-[10px] font-semibold text-sky-200/90 border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 rounded">
                {steps.length}-step plan
              </span>
            )}
          </div>
          <p className="text-sm text-foreground/75">{idea.subtitle}</p>
          <div className="flex flex-wrap gap-3 text-xs text-foreground/65 pt-0.5">
            <span>
              Conviction <span className="font-semibold text-foreground">{idea.convictionPct}%</span>
            </span>
            <span className="capitalize">{idea.side}</span>
            {idea.notionalHint != null && <span>~${idea.notionalHint}</span>}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-border/60 px-4 pb-4 space-y-3">
          <div className="pt-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Full concept
            </div>
            <p className="text-base text-foreground/90 leading-relaxed whitespace-pre-wrap">{idea.concept}</p>
            {idea.method && (
              <p className="text-sm text-foreground/80">
                <span className="font-semibold">Method:</span> {idea.method}
              </p>
            )}
            {idea.requires && (
              <p className="text-sm text-amber-200">Requires: {idea.requires}</p>
            )}
            {idea.instruction && (
              <p className="text-sm mono text-foreground border border-border bg-background/50 rounded px-3 py-2 leading-relaxed">
                {idea.instruction}
              </p>
            )}
          </div>

          {idea.levels && Object.keys(idea.levels).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              {Object.entries(idea.levels).map(([k, v]) => (
                <div key={k} className="rounded border border-border/60 bg-secondary/40 px-2 py-1.5">
                  <div className="text-foreground/60 text-xs uppercase">{k.replace(/_/g, " ")}</div>
                  <div className="font-medium text-foreground">
                    {v == null || v === "" ? "—" : String(v)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {steps.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-foreground/60 flex items-center gap-1.5">
                <ListOrdered className="h-3.5 w-3.5" /> Agent steps (Execute covers all)
              </div>
              <ol className="space-y-1.5">
                {steps.map((s, i) => (
                  <li
                    key={s.id || i}
                    className="text-sm text-foreground/85 rounded border border-border/50 bg-background/40 px-3 py-2"
                  >
                    <span className="font-semibold text-foreground">
                      {i + 1}. {s.title || s.phase || s.id}
                    </span>
                    {s.detail && <p className="text-foreground/75 mt-0.5">{s.detail}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {idea.schedule && (
            <p className="text-sm text-amber-100/90 flex items-center gap-1.5">
              <Crosshair className="h-3.5 w-3.5" />
              {(idea.schedule as any).trigger
                ? `Trigger: ${(idea.schedule as any).trigger}`
                : (idea.schedule as any).due_label ||
                  (idea.schedule as any).due_friday ||
                  (idea.schedule as any).expiration ||
                  "See schedule"}
            </p>
          )}

          {(idea.laymanDirective || idea.executionPlan) && (
            <div className="rounded-md border border-sky-500/35 bg-sky-500/10 px-3 py-3 space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-sky-200">
                Layman&apos;s directive
              </div>
              <p className="text-base text-foreground leading-relaxed">
                {idea.laymanDirective ||
                  "In plain English: Execute arms this idea’s full plan — wait/open, watch levels, add only on a planned pullback, and close at stop, target, or time."}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => onExecute(idea)}
              className="inline-flex items-center gap-2 rounded-md border border-accent/50 bg-accent/15 text-accent px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {busy
                ? "Working…"
                : idea.executionPlan?.wait_for_trigger || (idea.schedule as any)?.trigger
                  ? "Execute (wait for trigger)"
                  : "Execute agent"}
            </button>
            {onPlaceLive && (
              <button
                type="button"
                disabled={busy || !liveEnabled}
                onClick={() => onPlaceLive(idea)}
                className="inline-flex items-center gap-2 rounded-md border border-red-500/50 bg-red-500/15 text-red-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
              >
                Place live (full plan)
              </button>
            )}
            <span className="text-xs text-foreground/60 self-center">
              {idea.executionPlan?.wait_for_trigger || (idea.schedule as any)?.trigger
                ? "Wait → place → monitor → add → close"
                : "Open/wait · monitor · add · close"}
            </span>
          </div>

          {result && (
            <pre className="text-xs text-foreground/85 whitespace-pre-wrap max-h-48 overflow-auto rounded border border-border bg-background/60 p-2">
              {JSON.stringify(
                {
                  mode: result.mode,
                  message: result.message,
                  error: result.error,
                  plan_id: result.plan?.id,
                  plan_status: result.plan?.status,
                  steps: result.plan?.steps?.map((s: any) => ({
                    id: s.id,
                    status: s.status,
                    title: s.title,
                  })),
                  actions: result.actions,
                  order: result.order || result.order_preview,
                  review: result.review?.parsed || result.review?.text || result.review,
                },
                null,
                2
              )}
            </pre>
          )}
        </div>
      )}
    </article>
  );
}
