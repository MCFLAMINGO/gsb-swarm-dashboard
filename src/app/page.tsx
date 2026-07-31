"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Brain, Network, Bot, Search, RefreshCw,
  CheckCircle2, AlertTriangle, GitBranch
} from "lucide-react";
import { toast } from "sonner";
import ResearchSessionCard from "@/components/ResearchSessionCard";
import ExecutionIdeaCard from "@/components/ExecutionIdeaCard";
import DeskTickerRail from "@/components/DeskTickerRail";
import AiMacroWatchlist from "@/components/AiMacroWatchlist";
import ArmedPlanPanel from "@/components/ArmedPlanPanel";
import { ConceptOutcomesPanel, RunComparisonCard } from "@/components/DeskOutcomes";
import {
  buildDeskSession,
  type DeskSession,
  type ExecutionIdea,
} from "@/lib/deskIdeas";
import {
  compareRuns,
  emptyStore,
  loadDeskStore,
  markOutcomes,
  outcomesFromSession,
  revisionFromSession,
  saveDeskStore,
  type ActivePosition,
  type DeskStoreV2,
} from "@/lib/deskStore";

const TEAM = [
  { role: "Chief Analyst", name: "Elite / Equity Analyst", href: "/elite-deep-dive", note: "Thesis · desk voice · contrarian · ROI plan" },
  { role: "Token / On-chain", name: "Token Analyst + Alpha", href: "/team", note: "Liquidity, whales, early signals" },
  { role: "Wallet / Flow", name: "Wallet Profiler", href: "/team", note: "Holdings, smart money, DCA" },
  { role: "Macro / Nodes", name: "LocalIntel Node Model", href: "/macro", note: "FRED · ZIP · market intel → desk" },
  { role: "Lead Trader", name: "CEO · Kelly size", href: "/#desk-sessions", note: "Edge ÷ odds · fractional Kelly · Execute cards" },
  { role: "Execution", name: "Robinhood · Copy · THROW", href: "/execute", note: "Review → place · copy · Tempo tape" },
];

export default function DeskHomePage() {
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [store, setStore] = useState<DeskStoreV2>(() => emptyStore());
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rhStatus, setRhStatus] = useState<any>(null);
  const [sources, setSources] = useState<any>(null);
  const [rhHorizon, setRhHorizon] = useState<"day" | "week" | "month" | "year">("week");
  const [rhBusyIdeaId, setRhBusyIdeaId] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadDeskStore();
    setStore(loaded);
    setHydrated(true);
    fetch("/api/elite-analysis", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSources(d.sources || null))
      .catch(() => undefined);
    fetch("/api/robinhood?action=status", { cache: "no-store" })
      .then((r) => r.json())
      .then(setRhStatus)
      .catch(() => setRhStatus({ configured: false }));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDeskStore(store);
  }, [store, hydrated]);

  useEffect(() => {
    if (!pending) return;
    setElapsedSec(0);
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [pending]);

  // Paper-mark all open concepts periodically (executed or not)
  const refreshMarks = useCallback(async () => {
    const open = store.outcomes.filter((o) => !o.resolved);
    if (!open.length) return;
    const symbols = [...new Set(open.map((o) => o.symbol))];
    try {
      const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!data.quotes) return;
      setStore((prev) => ({
        ...prev,
        outcomes: markOutcomes(prev.outcomes, data.quotes),
        positions: prev.positions.map((p) => {
          if (p.status === "completed" || p.status === "folded" || p.status === "expired") return p;
          // Fold completed live plans when their concept resolves or plan done
          return p;
        }),
      }));
    } catch {
      /* ignore */
    }
  }, [store.outcomes]);

  useEffect(() => {
    if (!hydrated) return;
    refreshMarks();
    const iv = window.setInterval(refreshMarks, 120_000);
    return () => window.clearInterval(iv);
  }, [hydrated, refreshMarks]);

  const sessions = store.sessions;
  const active = sessions.find((s) => s.id === store.activeSessionId) || sessions[0] || null;
  const activeSymbol = active?.symbol || null;
  const ui = activeSymbol ? store.tickerUi[activeSymbol] : null;
  const focusPosition = ui?.focus && ui.focus !== "ticker"
    ? store.positions.find((p) => p.id === ui.focus)
    : null;
  const collapsed = Boolean(ui?.collapsed);

  const activeOpenPositions = useMemo(
    () =>
      store.positions.filter(
        (p) =>
          p.symbol === activeSymbol &&
          p.status !== "folded" &&
          p.status !== "completed" &&
          p.status !== "expired"
      ),
    [store.positions, activeSymbol]
  );

  function patchStore(fn: (prev: DeskStoreV2) => DeskStoreV2) {
    setStore((prev) => fn(prev));
  }

  function selectTicker(symbol: string) {
    const session = store.sessions.find((s) => s.symbol === symbol);
    if (!session) return;
    patchStore((prev) => ({
      ...prev,
      activeSessionId: session.id,
      tickerUi: {
        ...prev.tickerUi,
        [symbol]: {
          symbol,
          collapsed: false,
          focus: "ticker",
        },
      },
    }));
    setTimeout(() => {
      document.getElementById("ticker-context")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      document.getElementById("desk-active-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  function selectPosition(positionId: string) {
    const pos = store.positions.find((p) => p.id === positionId);
    if (!pos) return;
    const session = store.sessions.find((s) => s.id === pos.sessionId)
      || store.sessions.find((s) => s.symbol === pos.symbol);
    patchStore((prev) => ({
      ...prev,
      activeSessionId: session?.id || prev.activeSessionId,
      tickerUi: {
        ...prev.tickerUi,
        [pos.symbol]: {
          symbol: pos.symbol,
          collapsed: true,
          focus: positionId,
        },
      },
    }));
    setTimeout(() => {
      document.getElementById("ticker-context")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      document.getElementById("armed-plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  async function runDesk(symbolOverride?: string) {
    const q = (symbolOverride || query).trim().toUpperCase();
    if (!q) {
      setError("Enter a ticker first (e.g. AAPL, TSLA, NBIS)");
      return;
    }
    setQuery(q);
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/elite-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, assetType: "auto", includeSynthesis: true }),
        signal: AbortSignal.timeout(280_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error ||
            (res.status === 504
              ? "Research timed out on the server — try again (often 45–90s)"
              : `HTTP ${res.status}`)
        );
      }
      if (!data.report) throw new Error("No report returned — Railway elite-analysis may have failed");
      const session = buildDeskSession(data.report);
      try {
        const nr = await fetch(`/api/ticker-name?symbol=${encodeURIComponent(session.symbol)}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        const nd = await nr.json().catch(() => ({}));
        if (nd?.name) session.name = String(nd.name);
      } catch {
        /* keep fallback */
      }

      patchStore((prev) => {
        const priorSession = prev.sessions.find((s) => s.symbol === session.symbol);
        const history = [...(prev.historyBySymbol[session.symbol] || [])];
        let lastComparison = prev.lastComparison;
        if (priorSession) {
          const rev = revisionFromSession(priorSession);
          history.unshift(rev);
          lastComparison = compareRuns(rev, session);
        }
        // Keep prior outcomes; add new paper concepts for this run
        const newOutcomes = outcomesFromSession(session);
        const sessions = [session, ...prev.sessions.filter((s) => s.symbol !== session.symbol)].slice(0, 12);
        return {
          ...prev,
          sessions,
          activeSessionId: session.id,
          historyBySymbol: {
            ...prev.historyBySymbol,
            [session.symbol]: history.slice(0, 6),
          },
          outcomes: [...newOutcomes, ...prev.outcomes.filter((o) => o.sessionId !== priorSession?.id)].slice(0, 200),
          tickerUi: {
            ...prev.tickerUi,
            [session.symbol]: { symbol: session.symbol, collapsed: false, focus: "ticker" },
          },
          lastComparison,
        };
      });

      if (data.sources) setSources((prev: any) => ({ ...(prev || {}), ...data.sources }));
      toast.success(`${session.symbol} research ready`, {
        description: `${session.ideas.length} concepts — all paper-monitored to expiry`,
      });
      setTimeout(() => {
        document.getElementById("desk-sessions")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (e) {
      const msg = (e as Error).name === "TimeoutError"
        ? "Research timed out after ~4.5 minutes — try again"
        : (e as Error).message;
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  async function executeIdea(idea: ExecutionIdea, live: boolean, session: DeskSession) {
    const resultKey = `${session.id}:${idea.id}`;
    setRhBusyIdeaId(idea.id);
    try {
      const res = await fetch("/api/ceo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "arm-plan",
          idea: {
            ...idea,
            symbol: session.symbol,
            layman_directive: idea.laymanDirective,
            execution_plan: idea.executionPlan,
            notionalHint: idea.notionalHint,
            schedule: idea.schedule,
            levels: idea.levels,
          },
          report: session.report,
          symbol: session.symbol,
          dryRun: !live,
          confirm: live,
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.plan) {
        throw new Error(data.error || data.message || `HTTP ${res.status}`);
      }

      const positionId = `${session.id}:${idea.id}:pos`;
      const position: ActivePosition = {
        id: positionId,
        symbol: session.symbol,
        sessionId: session.id,
        ideaId: idea.id,
        title: idea.title,
        side: idea.side,
        badge: idea.badge,
        planId: data.plan?.id,
        live,
        status: data.plan?.status === "waiting_trigger" ? "waiting_trigger"
          : data.plan?.status === "completed" ? "completed"
            : "monitoring",
        armedAt: new Date().toISOString(),
        expiresAt: store.outcomes.find((o) => o.id === `${session.id}:${idea.id}`)?.expiresAt || null,
        lastResult: data,
      };

      patchStore((prev) => ({
        ...prev,
        ideaResults: { ...prev.ideaResults, [resultKey]: data },
        positions: [position, ...prev.positions.filter((p) => p.id !== positionId)],
        outcomes: prev.outcomes.map((o) =>
          o.id === `${session.id}:${idea.id}` ? { ...o, executed: true } : o
        ),
        // Collapse research + remaining concepts into ticker; show position button
        tickerUi: {
          ...prev.tickerUi,
          [session.symbol]: {
            symbol: session.symbol,
            collapsed: true,
            focus: positionId,
          },
        },
        activeSessionId: session.id,
      }));

      const waiting = data.plan?.status === "waiting_trigger";
      const triggerDetail =
        data.plan?.steps?.find((s: any) => s.phase === "wait")?.detail ||
        idea.schedule?.trigger ||
        null;
      toast.success(
        waiting ? "Armed — waiting for trigger (no order yet)" : live ? "Live position armed" : "Position armed (dry-run)",
        {
          description: waiting
            ? triggerDetail
              ? `Waiting: ${String(triggerDetail).slice(0, 120)}`
              : "Agent will place only when the trigger prints"
            : data.plan?.id
              ? `Plan ${data.plan.id} · ${data.plan.status} — worker is monitoring`
              : data.message,
          duration: 8000,
        }
      );

      setTimeout(() => {
        document.getElementById("armed-plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);

      const planId = data.plan?.id;
      if (planId && (waiting || data.plan?.status === "monitoring")) {
        const poll = async () => {
          try {
            const tr = await fetch("/api/ceo", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "tick-plan", planId }),
            });
            const td = await tr.json();
            if (!td?.plan) return;
            patchStore((prev) => {
              const status: ActivePosition["status"] =
                td.plan.status === "completed" || td.plan.status === "cancelled"
                  ? "completed"
                  : td.plan.status === "waiting_trigger"
                    ? "waiting_trigger"
                    : "monitoring";
              let positions: ActivePosition[] = prev.positions.map((p) =>
                p.id === positionId
                  ? {
                      ...p,
                      status,
                      lastResult: { ...data, ...td },
                      foldedAt: status === "completed" ? new Date().toISOString() : p.foldedAt,
                    }
                  : p
              );
              let tickerUi = prev.tickerUi;
              if (status === "completed") {
                positions = positions.map((p) =>
                  p.id === positionId
                    ? { ...p, status: "folded" as const, foldedAt: new Date().toISOString() }
                    : p
                );
                tickerUi = {
                  ...prev.tickerUi,
                  [session.symbol]: {
                    symbol: session.symbol,
                    collapsed: true,
                    focus: "ticker",
                  },
                };
                toast.success("Position complete — folded into ticker", {
                  description: "Results kept for the next research run",
                });
              }
              return {
                ...prev,
                ideaResults: { ...prev.ideaResults, [resultKey]: { ...data, ...td } },
                positions,
                tickerUi,
              };
            });
            if (td.actions?.some((a: any) => a.type === "trigger_hit")) {
              toast.success("Trigger hit — placing / reviewing order");
            }
          } catch {
            /* ignore */
          }
        };
        await poll();
        const iv = window.setInterval(poll, 45_000);
        window.setTimeout(() => window.clearInterval(iv), 45 * 60_000);
      }

      const st = await fetch("/api/robinhood?action=status", { cache: "no-store" });
      setRhStatus(await st.json());
    } catch (e) {
      toast.error("Execute failed", { description: (e as Error).message });
      patchStore((prev) => ({
        ...prev,
        ideaResults: { ...prev.ideaResults, [resultKey]: { error: (e as Error).message } },
      }));
    } finally {
      setRhBusyIdeaId(null);
    }
  }

  const showConcepts = active && (!collapsed || ui?.focus === "ticker");
  const focusedIdea = focusPosition && active
    ? active.ideas.find((i) => i.id === focusPosition.ideaId)
    : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 md:p-8 space-y-6 max-w-5xl">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/70">GSB Trading Desk</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Research → concepts → position buttons
          </h1>
          <p className="text-base text-foreground/85 max-w-2xl">
            Run a ticker to see every concept. Execute one and it becomes its own position button under the ticker;
            research collapses back. All concepts paper-monitor to expiry — re-run later to compare and refine.
          </p>
        </header>

        <section className="rounded-lg border border-primary/35 bg-primary/10 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" /> Run research
            </h2>
            <div className="flex items-center gap-3 text-sm text-foreground/80">
              <span className="inline-flex items-center gap-1">
                {sources?.fred ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                FRED
              </span>
              <span className="inline-flex items-center gap-1">
                {sources?.nvidia_nim ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                NIM
              </span>
              <span className="inline-flex items-center gap-1">
                {rhStatus?.configured ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                Robinhood {rhStatus?.live_trading_enabled ? "(LIVE)" : ""}
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-foreground/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runDesk()}
                placeholder="Ticker — AAPL, NBIS, MU, VST…"
                className="w-full rounded-md border border-border bg-secondary pl-11 pr-3 py-3 text-base outline-none focus:border-primary/50"
              />
            </div>
            <button
              onClick={() => runDesk()}
              disabled={pending || !query.trim()}
              className="rounded-md bg-primary text-primary-foreground px-6 py-3 text-base font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {pending ? `Researching… ${elapsedSec}s` : "Run Elite Desk"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-foreground/75 flex items-center gap-2">
              Horizon
              <select
                value={rhHorizon}
                onChange={(e) => setRhHorizon(e.target.value as typeof rhHorizon)}
                className="rounded-md border border-border bg-secondary px-2 py-1.5 text-sm"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
            </label>
          </div>
          {pending && (
            <p className="text-base text-amber-200">
              Still working — usually 45–90 seconds. Keep this tab open.
            </p>
          )}
          {error && <p className="text-base text-red-300">{error}</p>}
        </section>

        {sessions.length > 0 && (
          <div id="desk-sessions" className="scroll-mt-4 space-y-4">
            <DeskTickerRail
              sessions={sessions}
              positions={store.positions}
              tickerUi={store.tickerUi}
              activeSymbol={activeSymbol}
              onSelectTicker={selectTicker}
              onSelectPosition={selectPosition}
            />

            {store.lastComparison && store.lastComparison.symbol === activeSymbol && (
              <RunComparisonCard comparison={store.lastComparison} />
            )}

            {/* Always show armed plan feedback after Execute — even if concepts collapsed */}
            {focusPosition && (
              <ArmedPlanPanel
                position={focusPosition}
                onExpandTicker={() => activeSymbol && selectTicker(activeSymbol)}
              />
            )}
            {!focusPosition && activeOpenPositions[0] && collapsed && (
              <ArmedPlanPanel
                position={activeOpenPositions[0]}
                onExpandTicker={() => activeSymbol && selectTicker(activeSymbol)}
              />
            )}

            <div id="desk-active-panel" className="scroll-mt-4 space-y-4">
            {active && showConcepts && (
              <>
                <ResearchSessionCard
                  key={`${active.id}-expanded`}
                  session={active}
                  defaultOpen
                  onRemove={() => {
                    patchStore((prev) => {
                      const next = prev.sessions.filter((s) => s.id !== active.id);
                      return {
                        ...prev,
                        sessions: next,
                        activeSessionId: next[0]?.id || null,
                      };
                    });
                  }}
                />

                <section className="space-y-3">
                  <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
                    <h2 className="text-xl font-semibold">
                      {active.symbol} concepts
                    </h2>
                    <p className="text-sm text-foreground/75">
                      Showing because you selected the <strong>{active.symbol}</strong> ticker.
                      Execute one → it becomes a position chip; other concepts stay paper-monitored.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {active.ideas.map((idea, idx) => (
                      <ExecutionIdeaCard
                        key={`${active.id}-${idea.id}`}
                        idea={idea}
                        rank={idx + 1}
                        busy={rhBusyIdeaId === idea.id}
                        liveEnabled={Boolean(rhStatus?.live_trading_enabled)}
                        result={store.ideaResults[`${active.id}:${idea.id}`]}
                        onExecute={(idea) => executeIdea(idea, false, active)}
                        onPlaceLive={(idea) => {
                          if (window.confirm(`Place LIVE via Robinhood Agentic?\n${idea.title}`)) {
                            executeIdea(idea, true, active);
                          }
                        }}
                      />
                    ))}
                  </div>
                </section>
              </>
            )}

            {active && collapsed && focusPosition && focusedIdea && (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-semibold">Active position card</h2>
                    <p className="text-sm text-foreground/75">
                      {focusPosition.title} · {focusPosition.status.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
                <ExecutionIdeaCard
                  idea={focusedIdea}
                  rank={1}
                  busy={rhBusyIdeaId === focusedIdea.id}
                  liveEnabled={Boolean(rhStatus?.live_trading_enabled)}
                  result={store.ideaResults[`${active.id}:${focusedIdea.id}`] || focusPosition.lastResult}
                  onExecute={(idea) => executeIdea(idea, false, active)}
                  onPlaceLive={(idea) => {
                    if (window.confirm(`Place LIVE?\n${idea.title}`)) executeIdea(idea, true, active);
                  }}
                />
              </section>
            )}

            {active && collapsed && focusPosition && !focusedIdea && (
              <p className="text-sm text-foreground/70">
                Position is armed (see status above).{" "}
                <button type="button" className="text-accent hover:underline" onClick={() => selectTicker(active.symbol)}>
                  Expand ticker
                </button>{" "}
                to see the full concept card.
              </p>
            )}

            {active && collapsed && !focusPosition && activeOpenPositions.length === 0 && (
              <p className="text-sm text-foreground/70">
                Ticker collapsed.{" "}
                <button type="button" className="text-accent hover:underline" onClick={() => selectTicker(active.symbol)}>
                  Expand research &amp; concepts
                </button>
              </p>
            )}

            {activeSymbol && (
              <ConceptOutcomesPanel outcomes={store.outcomes} symbol={activeSymbol} />
            )}
            </div>
          </div>
        )}

        <AiMacroWatchlist
          onPick={(sym) => {
            setQuery(sym);
            runDesk(sym);
          }}
        />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Bot className="h-4 w-4 text-accent" /> Trading team
            </h2>
            <Link href="/team" className="text-sm text-foreground/75 hover:text-foreground">
              Team console →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {TEAM.map((t) => (
              <Link
                key={t.role}
                href={t.href}
                className="rounded-md border border-border bg-card p-3 hover:border-primary/40 transition-colors space-y-1"
              >
                <div className="text-xs uppercase tracking-wider text-foreground/65">{t.role}</div>
                <div className="text-base font-medium text-foreground">{t.name}</div>
                <div className="text-sm text-foreground/75">{t.note}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Network className="h-4 w-4 text-accent" /> Macro nodes
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/macro" className="rounded-md border border-border bg-secondary px-3 py-2 text-sm">Node map →</Link>
            <Link href="/local-intel/market-intel" className="rounded-md border border-border bg-secondary px-3 py-2 text-sm">Market intel</Link>
            <Link href="/local-intel/zip-intel" className="rounded-md border border-border bg-secondary px-3 py-2 text-sm">ZIP intel</Link>
          </div>
        </section>

        <p className="text-sm text-foreground/70 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5" />
          Desk → concepts → position buttons → paper outcomes → next-run refine
        </p>
      </div>
    </div>
  );
}
