"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import type { DeskSession } from "@/lib/deskIdeas";
import { sessionTitle } from "@/lib/deskIdeas";

export default function ResearchSessionCard({
  session,
  defaultOpen = true,
  onRemove,
}: {
  session: DeskSession;
  defaultOpen?: boolean;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const report = session.report;
  const week = report?.trade_plan?.horizons?.week;
  const verdict = session.verdict || report?.verdict?.verdict;
  const verdictTone = String(verdict).includes("BUY")
    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
    : String(verdict).includes("AVOID") || String(verdict).includes("RISKY")
      ? "border-red-500/40 bg-red-500/15 text-red-200"
      : "border-amber-500/40 bg-amber-500/15 text-amber-100";

  return (
    <section className="rounded-lg border border-primary/35 bg-card overflow-hidden">
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-start gap-3 p-4 md:p-5 text-left hover:bg-secondary/30 transition-colors"
        >
          <span className="mt-1 text-foreground/70">
            {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </span>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground truncate">
                {sessionTitle(session)}
              </h2>
              {verdict && (
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded border ${verdictTone}`}>
                  {verdict}
                </span>
              )}
              {session.bias && (
                <span className="text-xs font-semibold px-2 py-1 rounded border border-border bg-secondary">
                  {session.bias}
                </span>
              )}
            </div>
            <p className="text-sm text-foreground/75">
              Research pack · {session.ideas.length} execution idea{session.ideas.length === 1 ? "" : "s"}
              {week?.target_roi_pct != null && (
                <> · Week target {week.target_roi_pct > 0 ? "+" : ""}{week.target_roi_pct}%</>
              )}
              {" · "}
              {new Date(session.analyzedAt).toLocaleString()}
            </p>
          </div>
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-foreground/60 hover:text-red-300 px-3 py-4 shrink-0"
          >
            Dismiss
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-border px-4 md:px-5 pb-5 space-y-4">
          <div className="pt-4 space-y-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent" /> Research summation
            </h3>
            <div className="text-base leading-relaxed text-foreground whitespace-pre-wrap max-h-[280px] overflow-y-auto rounded-md border border-border bg-secondary/30 p-4">
              {report?.analyst_memo || report?.institutional?.investment_thesis || "No memo returned."}
            </div>
          </div>

          {report?.institutional?.investment_thesis && (
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Thesis</h3>
              <p className="text-base text-foreground/90 leading-relaxed">
                {report.institutional.investment_thesis}
              </p>
              {(report.verdict?.reasons || []).length > 0 && (
                <ol className="list-decimal pl-5 space-y-1">
                  {(report.verdict.reasons as string[]).map((r, i) => (
                    <li key={i} className="text-sm text-foreground/85">{r}</li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {report?.ceo_trade_book && (
            <div className="rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-sm text-foreground/85">
              <span className="font-semibold">CEO Kelly:</span>{" "}
              {report.ceo_trade_book.action} · $
              {report.ceo_trade_book.kelly?.recommended_notional_usd ?? "—"} stake
              {report.ceo_trade_book.kelly?.p_adjusted != null && (
                <> · p̂ {report.ceo_trade_book.kelly.p_adjusted}</>
              )}
            </div>
          )}

          <Link
            href="/elite-deep-dive"
            className="inline-block text-sm text-accent hover:underline font-medium"
          >
            Open full Elite Research →
          </Link>
        </div>
      )}
    </section>
  );
}
