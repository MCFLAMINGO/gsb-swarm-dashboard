"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Crosshair,
  Loader2,
  Play,
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

  const sideTone =
    idea.side === "long"
      ? "border-emerald-500/40 bg-emerald-500/10"
      : idea.side === "short"
        ? "border-red-500/40 bg-red-500/10"
        : idea.side === "income"
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-border bg-card";

  const canExecute = idea.executeMode !== "review_only" || idea.actionable;
  const executeDisabled = busy || (idea.executeMode === "review_only" && !idea.actionable);

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
          </div>
          <p className="text-sm text-foreground/75">{idea.subtitle}</p>
          <div className="flex flex-wrap gap-3 text-xs text-foreground/65 pt-0.5">
            <span>
              Conviction <span className="font-semibold text-foreground">{idea.convictionPct}%</span>
            </span>
            <span className="capitalize">{idea.side}</span>
            {idea.notionalHint != null && <span>~${idea.notionalHint}</span>}
            {!idea.actionable && idea.executeMode === "review_only" && (
              <span className="text-amber-200">Concept / staged</span>
            )}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-border/60 px-4 pb-4 space-y-3">
          <div className="pt-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Full concept
            </div>
            <p className="text-base text-foreground/90 leading-relaxed">{idea.concept}</p>
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

          {idea.asymmetry && (
            <p className="text-sm text-foreground/80">
              <span className="font-semibold">Asymmetry:</span>{" "}
              {(idea.asymmetry as any).why_asymmetric ||
                (idea.asymmetry as any).payoff ||
                (idea.asymmetry as any).style ||
                "—"}
            </p>
          )}

          {idea.schedule && (
            <p className="text-sm text-amber-100/90 flex items-center gap-1.5">
              <Crosshair className="h-3.5 w-3.5" />
              {(idea.schedule as any).due_label ||
                (idea.schedule as any).due_friday ||
                (idea.schedule as any).expiration ||
                "See schedule"}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={executeDisabled}
              onClick={() => onExecute(idea)}
              className="inline-flex items-center gap-2 rounded-md border border-accent/50 bg-accent/15 text-accent px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {busy ? "Working…" : idea.executeMode === "review_only" && !idea.actionable ? "Not executable" : "Execute agent"}
            </button>
            {onPlaceLive && idea.actionable && idea.executeMode !== "review_only" && (
              <button
                type="button"
                disabled={busy || !liveEnabled}
                onClick={() => onPlaceLive(idea)}
                className="inline-flex items-center gap-2 rounded-md border border-red-500/50 bg-red-500/15 text-red-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
              >
                Place live
              </button>
            )}
            {!canExecute && (
              <span className="text-xs text-foreground/60 self-center">
                Staged idea — no MCP place path yet
              </span>
            )}
            {idea.executeMode === "review_only" && idea.side === "short" && (
              <span className="text-xs text-amber-200/90 self-center">
                Equity short not bridged — use a put card when available
              </span>
            )}
          </div>

          {result && (
            <pre className="text-xs text-foreground/85 whitespace-pre-wrap max-h-40 overflow-auto rounded border border-border bg-background/60 p-2">
              {JSON.stringify(
                {
                  mode: result.mode,
                  message: result.message,
                  error: result.error,
                  order: result.order || result.order_preview,
                  review: result.review?.parsed || result.review?.text || result.review,
                  placed: result.placed?.parsed || result.placed?.text || result.placed,
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
