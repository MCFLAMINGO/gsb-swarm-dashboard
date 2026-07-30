"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Brain, Network, Bot, Search, RefreshCw,
  CheckCircle2, AlertTriangle, GitBranch
} from "lucide-react";
import { toast } from "sonner";
import ResearchSessionCard from "@/components/ResearchSessionCard";
import ExecutionIdeaCard from "@/components/ExecutionIdeaCard";
import {
  buildDeskSession,
  type DeskSession,
  type ExecutionIdea,
} from "@/lib/deskIdeas";

const TEAM = [
  { role: "Chief Analyst", name: "Elite / Equity Analyst", href: "/elite-deep-dive", note: "Thesis · desk voice · contrarian · ROI plan" },
  { role: "Token / On-chain", name: "Token Analyst + Alpha", href: "/team", note: "Liquidity, whales, early signals" },
  { role: "Wallet / Flow", name: "Wallet Profiler", href: "/team", note: "Holdings, smart money, DCA" },
  { role: "Macro / Nodes", name: "LocalIntel Node Model", href: "/macro", note: "FRED · ZIP · market intel → desk" },
  { role: "Lead Trader", name: "CEO · Kelly size", href: "/#desk-sessions", note: "Edge ÷ odds · fractional Kelly · Execute cards" },
  { role: "Execution", name: "Robinhood · Copy · THROW", href: "/execute", note: "Review → place · copy · Tempo tape" },
];

const STORAGE_KEY = "gsb-desk-sessions-v1";

export default function DeskHomePage() {
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [sessions, setSessions] = useState<DeskSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rhStatus, setRhStatus] = useState<any>(null);
  const [sources, setSources] = useState<any>(null);
  const [rhHorizon, setRhHorizon] = useState<"day" | "week" | "month" | "year">("week");
  const [rhBusyIdeaId, setRhBusyIdeaId] = useState<string | null>(null);
  const [ideaResults, setIdeaResults] = useState<Record<string, any>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DeskSession[];
        if (Array.isArray(parsed) && parsed.length) {
          setSessions(parsed.slice(0, 8));
          setActiveId(parsed[0]?.id || null);
        }
      }
    } catch {
      /* ignore */
    }
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 8)));
    } catch {
      /* ignore */
    }
  }, [sessions]);

  useEffect(() => {
    if (!pending) return;
    setElapsedSec(0);
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [pending]);

  const active = sessions.find((s) => s.id === activeId) || sessions[0] || null;

  async function runDesk() {
    const q = query.trim().toUpperCase();
    if (!q) {
      setError("Enter a ticker first (e.g. AAPL, TSLA, META)");
      return;
    }
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
      // Best-effort friendly name (AAPL → Apple) for the collapsible card title
      try {
        const nr = await fetch(`/api/ticker-name?symbol=${encodeURIComponent(session.symbol)}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        const nd = await nr.json().catch(() => ({}));
        if (nd?.name) session.name = String(nd.name);
      } catch {
        /* keep industry/symbol fallback */
      }
      setSessions((prev) => {
        const withoutDup = prev.filter((s) => s.symbol !== session.symbol);
        return [session, ...withoutDup].slice(0, 8);
      });
      setActiveId(session.id);
      if (data.sources) setSources((prev: any) => ({ ...(prev || {}), ...data.sources }));
      toast.success(`${session.symbol} research ready`, {
        description: `${session.ideas.length} execution ideas ranked by conviction`,
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
    const report = session.report;
    const resultKey = `${session.id}:${idea.id}`;
    setRhBusyIdeaId(idea.id);
    try {
      // Multistep Execute: arm wait/open → monitor → add → close
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
          report,
          symbol: session.symbol,
          dryRun: !live,
          confirm: live,
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.plan) {
        throw new Error(data.error || data.message || `HTTP ${res.status}`);
      }
      setIdeaResults((prev) => ({ ...prev, [resultKey]: data }));
      const waiting = data.plan?.status === "waiting_trigger";
      toast.success(
        waiting
          ? "Waiting for trigger — no order yet"
          : live
            ? "Live plan armed"
            : "Agent plan armed (dry-run)",
        {
          description: waiting
            ? data.plan?.steps?.find((s: any) => s.phase === "wait")?.detail ||
              "Agent will place only when the trigger prints"
            : data.plan?.id
              ? `Plan ${data.plan.id} · ${data.plan.status}`
              : data.message,
        }
      );

      // Keep ticking while waiting / monitoring so trigger→place runs
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
            if (td?.plan) {
              setIdeaResults((prev) => ({
                ...prev,
                [resultKey]: { ...data, ...td, plan: td.plan, actions: td.actions },
              }));
              if (td.actions?.some((a: any) => a.type === "trigger_hit")) {
                toast.success("Trigger hit — placing / reviewing order");
              }
            }
          } catch {
            /* ignore poll errors */
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
      setIdeaResults((prev) => ({
        ...prev,
        [resultKey]: { error: (e as Error).message },
      }));
    } finally {
      setRhBusyIdeaId(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 md:p-8 space-y-6 max-w-5xl">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/70">GSB Trading Desk</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Research → ranked ideas → execute
          </h1>
          <p className="text-base text-foreground/85 max-w-2xl">
            Run a ticker. Research stays in a collapsible card. Investment ideas become execution
            cards — highest conviction first, including shorts — expand for the full concept, then Execute.
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
                placeholder="Type any ticker — AAPL, TSLA, META…"
                className="w-full rounded-md border border-border bg-secondary pl-11 pr-3 py-3 text-base outline-none focus:border-primary/50"
              />
            </div>
            <button
              onClick={runDesk}
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
              Still working — usually 45–90 seconds. Keep this tab open. Cards appear below when done.
            </p>
          )}
          {error && <p className="text-base text-red-300">{error}</p>}
          {!sessions.length && !pending && !error && (
            <p className="text-base text-foreground/75">
              Enter a ticker and run. Finished research stays here as collapsible cards with ranked execution ideas.
            </p>
          )}
        </section>

        {sessions.length > 0 && (
          <div id="desk-sessions" className="scroll-mt-4 space-y-6">
            {sessions.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveId(s.id)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      (active?.id === s.id)
                        ? "border-primary/50 bg-primary/15 text-foreground"
                        : "border-border bg-secondary text-foreground/80 hover:border-primary/30"
                    }`}
                  >
                    {s.symbol}
                    {s.name && s.name !== s.symbol ? ` · ${s.name}` : ""}
                  </button>
                ))}
              </div>
            )}

            {active && (
              <>
                <ResearchSessionCard
                  session={active}
                  defaultOpen
                  onRemove={() => {
                    setSessions((prev) => {
                      const next = prev.filter((s) => s.id !== active.id);
                      setActiveId(next[0]?.id || null);
                      return next;
                    });
                  }}
                />

                <section className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-semibold">Execution ideas</h2>
                      <p className="text-sm text-foreground/75">
                        Highest conviction → lowest. Includes long, income overlays, hedges, and short/contrarian.
                        Click a card for the full concept, then Execute agent.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {active.ideas.map((idea, idx) => (
                      <ExecutionIdeaCard
                        key={`${active.id}-${idea.id}`}
                        idea={idea}
                        rank={idx + 1}
                        busy={rhBusyIdeaId === idea.id}
                        liveEnabled={Boolean(rhStatus?.live_trading_enabled)}
                        result={ideaResults[`${active.id}:${idea.id}`]}
                        onExecute={(idea) => executeIdea(idea, false, active)}
                        onPlaceLive={(idea) => {
                          const label = `${idea.title} (${idea.side})`;
                          if (window.confirm(`Place LIVE via Robinhood Agentic?\n${label}`)) {
                            executeIdea(idea, true, active);
                          }
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-foreground/70">
                    Execute arms the full multistep plan on the server worker (wait/open → monitor → add → close).
                    You can walk away — the agent follows through. Place live needs Robinhood live trading on.
                    <Link href="/execute" className="text-accent ml-1 hover:underline">Execute rail →</Link>
                  </p>
                </section>
              </>
            )}
          </div>
        )}

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
          Desk → Railway elite-analysis → ranked execution cards → Robinhood Agentic
        </p>
      </div>
    </div>
  );
}
