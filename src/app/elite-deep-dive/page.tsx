"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import {
  Brain, Search, RefreshCw, AlertTriangle, CheckCircle2,
  TrendingUp, Newspaper, Users, Building2, LineChart, Globe2, GitBranch
} from "lucide-react";

type AssetType = "auto" | "equity" | "crypto";

interface Sources {
  nvidia_nim?: boolean;
  fred?: boolean;
  x_twitter?: boolean;
  sec_edgar?: boolean;
  yahoo_charts?: boolean;
  reddit_public?: boolean;
  google_news?: boolean;
  dexscreener?: boolean;
}

export default function EliteDeepDivePage() {
  const [query, setQuery] = useState("NVDA");
  const [assetType, setAssetType] = useState<AssetType>("auto");
  const [sources, setSources] = useState<Sources | null>(null);
  const [sourceNote, setSourceNote] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [rhStatus, setRhStatus] = useState<any>(null);
  const [rhHorizon, setRhHorizon] = useState<"day" | "week" | "month" | "year">("week");
  const [rhNotional, setRhNotional] = useState("50");
  const [rhBusy, setRhBusy] = useState(false);
  const [rhResult, setRhResult] = useState<any>(null);
  const [rhError, setRhError] = useState<string | null>(null);

  async function loadSources() {
    try {
      const res = await fetch("/api/elite-analysis", { cache: "no-store" });
      const data = await res.json();
      setSources(data.sources || null);
      setSourceNote(data.note || data.error || null);
    } catch (e) {
      setSourceNote((e as Error).message);
    }
  }

  async function loadRhStatus() {
    try {
      const res = await fetch("/api/robinhood?action=status", { cache: "no-store" });
      setRhStatus(await res.json());
    } catch (e) {
      setRhStatus({ configured: false, error: (e as Error).message });
    }
  }

  useEffect(() => {
    loadSources();
    loadRhStatus();
  }, []);

  async function connectRobinhood() {
    setRhError(null);
    setRhBusy(true);
    try {
      const res = await fetch("/api/robinhood?action=connect", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.authorize_url) {
        throw new Error("No authorize_url returned — deploy gsb-swarm Robinhood routes first");
      }
      window.location.assign(data.authorize_url);
    } catch (e) {
      setRhError((e as Error).message);
    } finally {
      setRhBusy(false);
    }
  }

  async function executeOnRobinhood(live: boolean) {
    if (!report?.resolved_symbol && !query.trim()) return;
    setRhError(null);
    setRhResult(null);
    setRhBusy(true);
    try {
      const res = await fetch("/api/robinhood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: report?.resolved_symbol || query.trim(),
          trade_plan: report?.trade_plan || undefined,
          horizon: rhHorizon,
          notionalUsd: Number(rhNotional) || 50,
          dryRun: !live,
          confirm: live,
          orderType: "market",
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.order && !data.order_preview) {
        throw new Error(data.error || data.message || `HTTP ${res.status}`);
      }
      setRhResult(data);
      await loadRhStatus();
    } catch (e) {
      setRhError((e as Error).message);
    } finally {
      setRhBusy(false);
    }
  }

  function run() {
    const q = query.trim();
    if (!q) return;
    setError(null);
    setReport(null);
    setDurationMs(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/elite-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, assetType, includeSynthesis: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setReport(data.report);
        setDurationMs(data.duration_ms ?? null);
        if (data.sources) setSources((prev) => ({ ...(prev || {}), ...data.sources }));
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  const verdict = report?.verdict?.verdict || report?.gsb_verdict || null;
  const verdictColor =
    String(verdict).includes("BUY") ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : String(verdict).includes("AVOID") || String(verdict).includes("RISKY") ? "text-red-400 border-red-500/30 bg-red-500/10"
        : "text-amber-300 border-amber-500/30 bg-amber-500/10";

  return (
    <div className="min-h-screen p-6 md:p-8 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md border border-primary/30 bg-primary/10 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Elite Research</h1>
            <p className="text-sm text-muted-foreground">
              Chief Analyst for the Trading Desk — technicals, micro/macro, online intel, desk voice, contrarian, multi-horizon ROI.
            </p>
          </div>
        </div>
      </header>

      {/* Source readiness — keys live on Railway gsb-swarm */}
      <section className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-foreground">Enrichment keys (Railway gsb-swarm)</h2>
          <button
            onClick={loadSources}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { key: "nvidia_nim", label: "NVIDIA_API_KEY (memo)" },
            { key: "fred", label: "FRED_API_KEY (macro)" },
            { key: "x_twitter", label: "X_BEARER_TOKEN" },
            { key: "sec_edgar", label: "SEC EDGAR" },
            { key: "yahoo_charts", label: "Yahoo charts" },
            { key: "reddit_public", label: "Reddit" },
            { key: "google_news", label: "News / Substack signals" },
            { key: "dexscreener", label: "DexScreener" },
          ].map(({ key, label }) => {
            const on = sources ? Boolean((sources as any)[key]) : null;
            return (
              <div key={key} className="rounded-md border border-border bg-secondary/40 px-3 py-2 flex items-center gap-2">
                {on === null ? (
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                ) : on ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                )}
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            );
          })}
        </div>
        {sourceNote && <p className="text-[11px] text-muted-foreground">{sourceNote}</p>}
      </section>

      {/* Query form */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="grid md:grid-cols-[1fr_160px_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Ticker / company / token</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                placeholder="NVDA, AAPL, $VIRTUAL, 0x..."
                className="w-full rounded-md border border-border bg-secondary pl-9 pr-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Asset type</label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as AssetType)}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2.5 text-sm text-foreground"
            >
              <option value="auto">Auto</option>
              <option value="equity">Equity</option>
              <option value="crypto">Crypto</option>
            </select>
          </div>
          <button
            onClick={run}
            disabled={pending || !query.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {pending ? "Researching…" : "Run Elite Dive"}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Front-end: <span className="text-foreground/80">gsb-swarm-dashboard</span> (Vercel) → Railway{" "}
          <span className="text-foreground/80">gsb-swarm</span> elite engine. Keys stay on Railway.
        </p>
      </section>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Analysis failed</div>
            <div className="text-red-300/80 text-xs mt-1">{error}</div>
            <div className="text-[11px] mt-2 text-red-200/60">
              If this 404s, merge/deploy the gsb-swarm elite PR so Railway exposes /api/elite-analysis.
            </div>
          </div>
        </div>
      )}

      {report && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${verdictColor}`}>
              {verdict || "NO VERDICT"}
            </div>
            <div className="text-sm text-muted-foreground">
              {report.resolved_symbol || report.query} · {report.asset_type || assetType}
              {durationMs != null && ` · ${(durationMs / 1000).toFixed(1)}s`}
            </div>
          </div>

          {report.analyst_memo && (
            <section className="rounded-lg border border-border bg-card p-4 space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2"><Newspaper className="h-4 w-4 text-accent" /> Institutional note</h3>
              <p className="text-[11px] text-muted-foreground">Goldman / BlackRock rigor + deeper alt-data layer</p>
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{report.analyst_memo}</p>
            </section>
          )}

          {report.trade_plan?.summary_table && (
            <section className="rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-accent" /> Trade plan — target ROI
                </h3>
                <div className="text-xs text-muted-foreground">
                  Bias <span className="text-foreground font-medium">{report.trade_plan.bias}</span>
                  {report.trade_plan.mark_price != null && <> · Mark {fmt(report.trade_plan.mark_price)}</>}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(["day", "week", "month", "year"] as const).map((h) => {
                  const plan = report.trade_plan.horizons?.[h];
                  if (!plan) return null;
                  return (
                    <div key={h} className="rounded-md border border-border bg-card/80 p-3 space-y-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{plan.label}</div>
                      <div className="text-xs font-medium text-foreground">{plan.action}</div>
                      <div className="text-lg font-semibold text-accent">
                        {plan.target_roi_pct > 0 ? "+" : ""}{plan.target_roi_pct}%
                      </div>
                      <div className="text-[11px] text-muted-foreground">target ROI</div>
                      <div className="pt-1 space-y-1 border-t border-border/60">
                        <Kv label="Stop" value={fmtPct(plan.stop_loss_pct)} />
                        <Kv label="R:R" value={plan.risk_reward != null ? `${plan.risk_reward}x` : null} />
                        <Kv label="Target px" value={fmt(plan.target_price)} />
                        <Kv label="Stop px" value={fmt(plan.stop_price)} />
                        <Kv label="Conf" value={plan.confidence != null ? `${Math.round(plan.confidence * 100)}%` : null} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {report.trade_plan.execution && (
                <p className="text-[11px] text-muted-foreground">
                  {report.trade_plan.execution.entry_style} · {report.trade_plan.execution.take_profit_rule} · Max book risk{" "}
                  {report.trade_plan.execution.max_book_risk_pct}%
                </p>
              )}

              {/* Contrarian play — always illustrated */}
              {(report.trade_plan.contrarian_play || report.institutional?.contrarian_play) && (
                <ContrarianPlayPanel
                  play={report.trade_plan.contrarian_play || report.institutional.contrarian_play}
                  fmt={fmt}
                  fmtPct={fmtPct}
                />
              )}

              {/* Robinhood Agentic execution */}
              <div className="rounded-md border border-border bg-card/70 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-sm font-medium text-foreground">Robinhood Agentic</div>
                    <div className="text-[11px] text-muted-foreground">
                      MCP https://agent.robinhood.com/mcp/trading · sandbox account only
                    </div>
                  </div>
                  <div className="text-[11px]">
                    {rhStatus?.configured ? (
                      <span className="text-emerald-400">Connected</span>
                    ) : (
                      <span className="text-amber-400">Not connected</span>
                    )}
                    {rhStatus?.live_trading_enabled ? (
                      <span className="text-red-400 ml-2">LIVE ON</span>
                    ) : (
                      <span className="text-muted-foreground ml-2">live off</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Horizon</label>
                    <select
                      value={rhHorizon}
                      onChange={(e) => setRhHorizon(e.target.value as typeof rhHorizon)}
                      className="w-full rounded-md border border-border bg-secondary px-2 py-2 text-xs"
                    >
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                      <option value="month">Month</option>
                      <option value="year">Year</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Notional USD</label>
                    <input
                      value={rhNotional}
                      onChange={(e) => setRhNotional(e.target.value)}
                      className="w-full rounded-md border border-border bg-secondary px-2 py-2 text-xs"
                    />
                  </div>
                  <Link
                    href="/execute"
                    className="rounded-md border border-border bg-secondary px-3 py-2 text-xs hover:bg-secondary/80 text-center"
                  >
                    Connect via Execute →
                  </Link>
                  <button
                    disabled={rhBusy || report.trade_plan?.bias === "NEUTRAL"}
                    onClick={() => executeOnRobinhood(false)}
                    className="rounded-md border border-accent/40 bg-accent/10 text-accent px-3 py-2 text-xs font-medium hover:bg-accent/20 disabled:opacity-50"
                  >
                    {rhBusy ? "Working…" : "Review order"}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground">
                    Review uses <code>review_equity_order</code>. Live place needs Railway{" "}
                    <code>ROBINHOOD_LIVE_TRADING=1</code> + confirm.
                  </p>
                  <button
                    disabled={rhBusy || !rhStatus?.live_trading_enabled || report.trade_plan?.bias === "NEUTRAL"}
                    onClick={() => {
                      if (window.confirm(`Place LIVE Robinhood buy for ${report.resolved_symbol} ($${rhNotional})?`)) {
                        executeOnRobinhood(true);
                      }
                    }}
                    className="rounded-md border border-red-500/40 bg-red-500/10 text-red-300 px-3 py-1.5 text-[11px] disabled:opacity-40"
                  >
                    Place live
                  </button>
                </div>
                {rhError && <p className="text-xs text-red-400">{rhError}</p>}
                {rhResult && (
                  <pre className="text-[10px] text-foreground/80 whitespace-pre-wrap max-h-48 overflow-auto rounded border border-border bg-secondary/40 p-2">
                    {JSON.stringify({
                      mode: rhResult.mode,
                      message: rhResult.message,
                      order: rhResult.order || rhResult.order_preview,
                      meta: rhResult.meta,
                      review: rhResult.review?.parsed || rhResult.review?.text || rhResult.review,
                      placed: rhResult.placed?.parsed || rhResult.placed?.text || rhResult.placed,
                    }, null, 2)}
                  </pre>
                )}
              </div>
            </section>
          )}

          {report.institutional && (
            <div className="grid md:grid-cols-2 gap-4">
              <Panel icon={<Building2 className="h-4 w-4" />} title="Investment thesis">
                <p className="text-xs text-foreground/90 leading-relaxed">{report.institutional.investment_thesis}</p>
                <div className="pt-2 space-y-1">
                  <div className="text-[10px] uppercase text-muted-foreground">Catalysts up</div>
                  {(report.institutional.catalysts_up || []).slice(0, 4).map((c: string, i: number) => (
                    <div key={i} className="text-xs text-emerald-400/90">• {c}</div>
                  ))}
                  <div className="text-[10px] uppercase text-muted-foreground pt-1">Catalysts down</div>
                  {(report.institutional.catalysts_down || []).slice(0, 4).map((c: string, i: number) => (
                    <div key={i} className="text-xs text-red-400/90">• {c}</div>
                  ))}
                </div>
              </Panel>
              <Panel icon={<Globe2 className="h-4 w-4" />} title="Scenarios (12m)">
                {(["bull", "base", "bear"] as const).map((k) => {
                  const s = report.institutional.scenarios?.[k];
                  if (!s) return null;
                  return (
                    <div key={k} className="rounded-md border border-border/60 px-2 py-1.5 mb-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-foreground">{s.label}</span>
                        <span className="text-accent">{s.implied_12m_roi_pct > 0 ? "+" : ""}{s.implied_12m_roi_pct}% · {s.probability_pct}%</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{s.narrative}</p>
                    </div>
                  );
                })}
                <Kv label="Sleeve" value={report.institutional.portfolio_fit?.suggested_sleeve_pct != null ? `${report.institutional.portfolio_fit.suggested_sleeve_pct}%` : null} />
                <Kv label="Role" value={report.institutional.portfolio_fit?.role} />
              </Panel>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <Panel icon={<LineChart className="h-4 w-4" />} title="Technicals">
              <Kv label="Price" value={fmt(report.technicals?.price)} />
              <Kv label="Trend" value={report.technicals?.trend} />
              <Kv label="Change" value={fmtPct(report.technicals?.change_1d_pct ?? report.technicals?.change_24h_pct)} />
              <Kv label="Liquidity" value={fmt(report.technicals?.liquidity_usd)} />
            </Panel>

            <Panel icon={<Building2 className="h-4 w-4" />} title="Fundamentals">
              <Kv label="Company" value={report.fundamentals_micro?.sec?.company_name} />
              <Kv label="CIK" value={report.fundamentals_micro?.sec?.cik} />
              <Kv label="Sector" value={report.industry?.sector || report.fundamentals_micro?.yahoo?.sector} />
              <Kv label="Industry" value={report.industry?.industry || report.fundamentals_micro?.yahoo?.industry} />
              <Kv label="Macro regime" value={report.fundamentals_macro?.regime} />
            </Panel>

            <Panel icon={<Users className="h-4 w-4" />} title="Online / employee intel">
              <Kv label="Reddit" value={`${report.online_intel?.reddit?.count ?? 0} posts · ${report.online_intel?.reddit?.sentiment?.label || "n/a"}`} />
              <Kv label="News" value={`${report.online_intel?.news?.count ?? 0} items · ${report.online_intel?.news?.sentiment?.label || "n/a"}`} />
              <Kv label="Journals/Substack" value={String(report.online_intel?.journals_employees?.journals_and_substacks?.length ?? 0)} />
              <Kv label="Employee signals" value={String(report.online_intel?.journals_employees?.employee_social_and_complaint_signals?.length ?? 0)} />
            </Panel>

            <Panel icon={<Building2 className="h-4 w-4" />} title="Desk voice (public BR / JPM / GS)">
              <Kv label="Mentions" value={String(report.online_intel?.desk_voice?.count ?? 0)} />
              <Kv label="Mid-level hits" value={String(report.online_intel?.desk_voice?.midlevel_hits ?? 0)} />
              <Kv label="Tone" value={report.online_intel?.desk_voice?.sentiment?.label || "n/a"} />
              {(report.online_intel?.desk_voice?.by_firm || []).map((f: any) => (
                <Kv
                  key={f.firm}
                  label={f.firm}
                  value={`${f.mentions} · ${f.sentiment?.label || "n/a"}`}
                />
              ))}
              <p className="text-[10px] text-muted-foreground pt-1">
                Public news / transcripts / Substack / Reddit / X only — no LinkedIn scrape.
              </p>
              {(report.online_intel?.desk_voice?.voices || [])
                .filter((v: any) => v.midlevel_signal)
                .slice(0, 4)
                .map((v: any, i: number) => (
                  <a
                    key={i}
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[11px] text-accent hover:underline truncate"
                    title={v.title}
                  >
                    [{v.firm}] {v.title}
                  </a>
                ))}
            </Panel>

            <Panel icon={<TrendingUp className="h-4 w-4" />} title="Performance & industry">
              <Kv label="1y return" value={fmtPct(report.past_performance?.return_1y_pct)} />
              <Kv label="3y return" value={fmtPct(report.past_performance?.return_3y_pct)} />
              <Kv label="Max drawdown" value={fmtPct(report.past_performance?.max_drawdown_pct)} />
              <Kv label="Sector ETF" value={report.industry?.sector_etf} />
              <Kv label="Adjacent" value={(report.industry?.adjacent_industries || []).slice(0, 4).join(", ")} />
            </Panel>
          </div>

          {(report.verdict?.reasons || []).length > 0 && (
            <section className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2"><Globe2 className="h-4 w-4 text-accent" /> Verdict reasons</h3>
              <ul className="space-y-1">
                {report.verdict.reasons.map((r: string, i: number) => (
                  <li key={i} className="text-sm text-muted-foreground">• {r}</li>
                ))}
              </ul>
            </section>
          )}

          <details className="rounded-lg border border-border bg-secondary/30 p-4">
            <summary className="text-xs text-muted-foreground cursor-pointer">Raw structured report</summary>
            <pre className="mt-3 text-[11px] text-foreground/80 whitespace-pre-wrap overflow-x-auto max-h-[420px]">
              {JSON.stringify(report, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

function ContrarianPlayPanel({
  play,
  fmt,
  fmtPct,
}: {
  play: any;
  fmt: (n: unknown) => string | null;
  fmtPct: (n: unknown) => string | null;
}) {
  const setup = play?.setup || {};
  const ill = play?.illustration || {};
  const bars: any[] = ill.bars || [];
  const maxAbs = Math.max(
    1,
    ...bars.flatMap((b) => [Math.abs(b.target_pct || 0), Math.abs(b.stop_pct || 0)])
  );

  return (
    <div className="rounded-md border border-amber-500/35 bg-amber-500/5 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-medium text-foreground flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-amber-400" />
            Contrarian play
            <span className="text-[10px] uppercase tracking-wider text-amber-400/90 font-normal">
              always illustrated
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Fade primary <span className="text-foreground">{play.vs_primary_bias}</span>
            {" → "}
            <span className="text-foreground font-medium">{play.action}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-amber-300">
            {setup.target_roi_pct > 0 ? "+" : ""}
            {setup.target_roi_pct}%
          </div>
          <div className="text-[10px] text-muted-foreground">week fade target ROI</div>
        </div>
      </div>

      <p className="text-xs text-foreground/90 leading-relaxed">{play.thesis}</p>

      {/* Dual ROI path illustration */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {ill.caption || "Primary vs contrarian path"}
        </div>
        {bars.map((b) => {
          const tPct = Number(b.target_pct) || 0;
          const sPct = Number(b.stop_pct) || 0;
          const tW = `${Math.max(8, (Math.abs(tPct) / maxAbs) * 100)}%`;
          const sW = `${Math.max(8, (Math.abs(sPct) / maxAbs) * 100)}%`;
          const isContra = b.side === "contrarian";
          const targetTone =
            b.color_hint === "long"
              ? "bg-emerald-500/70"
              : b.color_hint === "short"
                ? "bg-red-500/70"
                : "bg-muted-foreground/50";
          return (
            <div key={b.side} className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className={isContra ? "text-amber-300 font-medium" : "text-foreground/80"}>
                  {isContra ? "Contrarian" : "Primary"} · {b.label}
                </span>
                <span className="text-muted-foreground">
                  tgt {fmtPct(tPct)} · stop {fmtPct(sPct)}
                </span>
              </div>
              <div className="relative h-6 rounded bg-secondary/60 overflow-hidden">
                <div className="absolute inset-y-0 left-1/2 w-px bg-border z-10" />
                <div
                  className={`absolute top-1 h-2 rounded-sm ${targetTone}`}
                  style={{
                    left: tPct >= 0 ? "50%" : `calc(50% - ${tW})`,
                    width: tW,
                  }}
                  title={`Target ${fmtPct(tPct)}`}
                />
                <div
                  className="absolute bottom-1 h-2 rounded-sm bg-muted-foreground/35"
                  style={{
                    left: sPct >= 0 ? "50%" : `calc(50% - ${sW})`,
                    width: sW,
                  }}
                  title={`Stop ${fmtPct(sPct)}`}
                />
              </div>
            </div>
          );
        })}
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>← downside</span>
          <span>Mark {fmt(ill.mark_price) || "—"}</span>
          <span>upside →</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="text-[10px] uppercase text-muted-foreground">Why crowded may be wrong</div>
          {(play.why_crowded_may_be_wrong || []).slice(0, 4).map((x: string, i: number) => (
            <div key={i} className="text-[11px] text-foreground/85">• {x}</div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Kv label="Trigger" value={setup.entry_trigger} />
          <Kv label="Entry" value={fmt(setup.entry_price)} />
          <Kv label="Target px" value={fmt(setup.target_price)} />
          <Kv label="Stop px" value={fmt(setup.stop_price)} />
          <Kv label="R:R" value={setup.risk_reward != null ? `${setup.risk_reward}x` : null} />
          <Kv label="Conf" value={setup.confidence != null ? `${Math.round(setup.confidence * 100)}%` : null} />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {play.invalidation} · {play.sizing_note}
      </p>
    </div>
  );
}

function Panel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-2">
      <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
        <span className="text-accent">{icon}</span> {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Kv({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right truncate max-w-[65%]">{value == null || value === "" ? "—" : String(value)}</span>
    </div>
  );
}

function fmt(n: unknown) {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return n < 2 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

function fmtPct(n: unknown) {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}
