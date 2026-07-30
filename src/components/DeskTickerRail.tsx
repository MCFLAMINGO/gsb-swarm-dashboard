"use client";

import type { ActivePosition, TickerUiState } from "@/lib/deskStore";
import type { DeskSession } from "@/lib/deskIdeas";
import { sessionTitle } from "@/lib/deskIdeas";

export default function DeskTickerRail({
  sessions,
  positions,
  tickerUi,
  activeSymbol,
  onSelectTicker,
  onSelectPosition,
}: {
  sessions: DeskSession[];
  positions: ActivePosition[];
  tickerUi: Record<string, TickerUiState>;
  activeSymbol: string | null;
  onSelectTicker: (symbol: string) => void;
  onSelectPosition: (positionId: string) => void;
}) {
  const seen = new Set<string>();
  const symbols: string[] = [];
  for (const s of sessions) {
    if (seen.has(s.symbol)) continue;
    seen.add(s.symbol);
    symbols.push(s.symbol);
  }
  for (const p of positions) {
    if (!seen.has(p.symbol)) {
      seen.add(p.symbol);
      symbols.push(p.symbol);
    }
  }

  if (!symbols.length) return null;

  const anyOpen = positions.some(
    (p) => p.status !== "folded" && p.status !== "completed" && p.status !== "expired"
  );

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wider text-foreground/60">
        Tickers · active positions
        {anyOpen ? " · click WAIT/POS to see armed plan" : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {symbols.map((sym) => {
          const session = sessions.find((s) => s.symbol === sym);
          const ui = tickerUi[sym];
          const activePos = positions.filter(
            (p) =>
              p.symbol === sym &&
              p.status !== "folded" &&
              p.status !== "completed" &&
              p.status !== "expired"
          );
          const folded = positions.filter(
            (p) =>
              p.symbol === sym &&
              (p.status === "folded" || p.status === "completed" || p.status === "expired")
          );
          const tickerActive = activeSymbol === sym && (!ui || ui.focus === "ticker");

          return (
            <div key={sym} className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSelectTicker(sym)}
                className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                  tickerActive
                    ? "border-primary/60 bg-primary/20 text-foreground"
                    : "border-border bg-secondary text-foreground/85 hover:border-primary/35"
                }`}
                title={session ? sessionTitle(session) : sym}
              >
                {sym}
                {ui?.collapsed ? " ▸" : ""}
              </button>
              {activePos.map((p) => {
                const focused = ui?.focus === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPosition(p.id)}
                    className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors max-w-[16rem] truncate ${
                      focused
                        ? "border-accent/60 bg-accent/20 text-accent ring-1 ring-accent/40"
                        : p.status === "waiting_trigger"
                          ? "border-amber-500/50 bg-amber-500/15 text-amber-100"
                          : p.side === "long"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                            : p.side === "short"
                              ? "border-red-500/40 bg-red-500/10 text-red-100"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-100"
                    }`}
                    title={`${p.title} · ${p.status}`}
                  >
                    {p.status === "waiting_trigger" ? "WAIT" : "POS"} · {p.badge || p.side} ·{" "}
                    {p.status.replace(/_/g, " ")}
                  </button>
                );
              })}
              {folded.length > 0 && (
                <span className="text-[10px] text-foreground/50 px-1">
                  {folded.length} closed in ticker
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
