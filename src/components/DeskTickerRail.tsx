"use client";

import { ChevronDown, ChevronRight, Crosshair } from "lucide-react";
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

  const activeSession = sessions.find((s) => s.symbol === activeSymbol) || null;
  const activeUi = activeSymbol ? tickerUi[activeSymbol] : null;
  const activePos = activeSymbol
    ? positions.filter(
        (p) =>
          p.symbol === activeSymbol &&
          p.status !== "folded" &&
          p.status !== "completed" &&
          p.status !== "expired"
      )
    : [];
  const viewingPosition =
    activeUi?.focus && activeUi.focus !== "ticker"
      ? positions.find((p) => p.id === activeUi.focus)
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">
            Your tickers
          </p>
          <p className="text-sm text-foreground/70 mt-0.5">
            Click a ticker to open research &amp; concepts. Position chips stay beside it after Execute.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {symbols.map((sym) => {
          const session = sessions.find((s) => s.symbol === sym);
          const ui = tickerUi[sym];
          const openPos = positions.filter(
            (p) =>
              p.symbol === sym &&
              p.status !== "folded" &&
              p.status !== "completed" &&
              p.status !== "expired"
          );
          const isSelected = activeSymbol === sym;
          const tickerFocused = isSelected && (!ui || ui.focus === "ticker");
          const isCollapsed = Boolean(ui?.collapsed);
          const name =
            session && session.name && session.name !== sym ? session.name : null;

          return (
            <div
              key={sym}
              className={`flex flex-wrap items-stretch gap-1.5 rounded-lg p-1.5 transition-colors ${
                isSelected ? "bg-primary/10 ring-1 ring-primary/35" : "bg-transparent"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectTicker(sym)}
                aria-pressed={tickerFocused}
                className={`min-w-[7.5rem] rounded-md border px-3.5 py-2.5 text-left transition-all ${
                  tickerFocused
                    ? "border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]"
                    : isSelected
                      ? "border-primary/50 bg-primary/20 text-foreground"
                      : "border-border bg-secondary text-foreground/90 hover:border-primary/45 hover:bg-secondary/80"
                }`}
                title={session ? sessionTitle(session) : sym}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-bold tracking-wide">{sym}</span>
                  {tickerFocused ? (
                    <ChevronDown className="h-4 w-4 opacity-90" />
                  ) : (
                    <ChevronRight className="h-4 w-4 opacity-70" />
                  )}
                </div>
                {name && (
                  <div
                    className={`text-xs mt-0.5 truncate max-w-[9rem] ${
                      tickerFocused ? "text-primary-foreground/85" : "text-foreground/60"
                    }`}
                  >
                    {name}
                  </div>
                )}
                <div
                  className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${
                    tickerFocused
                      ? "text-primary-foreground/90"
                      : isSelected
                        ? "text-primary"
                        : "text-foreground/45"
                  }`}
                >
                  {tickerFocused ? "Open now" : isCollapsed ? "Collapsed" : "Click to open"}
                </div>
              </button>

              {openPos.map((p) => {
                const focused = ui?.focus === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPosition(p.id)}
                    aria-pressed={focused}
                    className={`rounded-md border px-3 py-2.5 text-left transition-all max-w-[11rem] ${
                      focused
                        ? "border-accent bg-accent text-accent-foreground shadow-md scale-[1.02]"
                        : p.status === "waiting_trigger"
                          ? "border-amber-500/55 bg-amber-500/15 text-amber-50 hover:bg-amber-500/25"
                          : p.side === "long"
                            ? "border-emerald-500/45 bg-emerald-500/12 text-emerald-50 hover:bg-emerald-500/20"
                            : p.side === "short"
                              ? "border-red-500/45 bg-red-500/12 text-red-50 hover:bg-red-500/20"
                              : "border-amber-500/45 bg-amber-500/12 text-amber-50"
                    }`}
                    title={`${p.title} · ${p.status}`}
                  >
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider opacity-90">
                      <Crosshair className="h-3 w-3" />
                      {p.status === "waiting_trigger" ? "Waiting" : "Position"}
                    </div>
                    <div className="text-sm font-semibold truncate mt-0.5">
                      {p.badge || p.side}
                    </div>
                    <div className="text-[10px] opacity-80 truncate">
                      {p.status.replace(/_/g, " ")}
                      {focused ? " · viewing" : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Selected ticker context strip — hard to miss */}
      {activeSymbol && (
        <div
          id="ticker-context"
          className="rounded-lg border-2 border-primary/45 bg-primary/15 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              {viewingPosition ? "Viewing position" : "Viewing ticker"}
            </div>
            <div className="text-xl font-bold text-foreground truncate">
              {activeSymbol}
              {activeSession?.name && activeSession.name !== activeSymbol
                ? ` — ${activeSession.name}`
                : ""}
            </div>
            <p className="text-sm text-foreground/80 mt-0.5">
              {viewingPosition ? (
                <>
                  {viewingPosition.title} ·{" "}
                  <span className="font-semibold">{viewingPosition.status.replace(/_/g, " ")}</span>
                  {" · "}
                  <button
                    type="button"
                    className="text-primary font-semibold underline underline-offset-2"
                    onClick={() => onSelectTicker(activeSymbol)}
                  >
                    Back to full ticker
                  </button>
                </>
              ) : (
                <>
                  {activeSession
                    ? `${activeSession.ideas.length} concept${activeSession.ideas.length === 1 ? "" : "s"} · research pack open below`
                    : "Selected"}
                  {activePos.length > 0
                    ? ` · ${activePos.length} active position${activePos.length === 1 ? "" : "s"}`
                    : ""}
                </>
              )}
            </p>
          </div>
          {!viewingPosition && (
            <div className="text-sm font-semibold text-primary shrink-0 rounded-md border border-primary/40 bg-background/40 px-3 py-2">
              ↓ Research &amp; concepts
            </div>
          )}
        </div>
      )}
    </div>
  );
}
