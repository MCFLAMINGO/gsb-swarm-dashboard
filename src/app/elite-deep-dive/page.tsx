"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  const [query, setQuery] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("auto");
  const [sources, setSources] = useState<Sources | null>(null);
  const [sourceNote, setSourceNote] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
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

  useEffect(() => {
    if (!pending) return;
    setElapsedSec(0);
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [pending]);

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

  async function run() {
    const q = query.trim().toUpperCase();
    if (!q) {
      setError("Enter a ticker first (e.g. AAPL, TSLA, META)");
      return;
    }
    setError(null);
    setReport(null);
    setDurationMs(null);
    setPending(true);
    try {
      const res = await fetch("/api/elite-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, assetType, includeSynthesis: true }),
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
      setReport(data.report);
      setDurationMs(data.duration_ms ?? null);
      if (data.sources) setSources((prev) => ({ ...(prev || {}), ...data.sources }));
      setTimeout(() => {
        document.getElementById("elite-summation")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
            <p className="text-base text-foreground/80">
              Summation → thesis → positions laid out → multi-horizon ROI. Supporting research below.
            </p>
          </div>
        </div>
      </header>

      {/* Query form first — summation appears after Run */}
      <section className="rounded-lg border border-primary/35 bg-primary/10 p-5 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Run research (summation + positions appear below)</h2>
        <div className="grid md:grid-cols-[1fr_160px_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-sm text-foreground/70">Ticker / company / token</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-foreground/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                placeholder="Type any ticker — AAPL, TSLA, META…"
                className="w-full rounded-md border border-border bg-secondary pl-11 pr-3 py-3 text-base text-foreground outline-none focus:border-primary/50"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-foreground/70">Asset type</label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as AssetType)}
              className="w-full rounded-md border border-border bg-secondary px-3 py-3 text-base text-foreground"
            >
              <option value="auto">Auto</option>
              <option value="equity">Equity</option>
              <option value="crypto">Crypto</option>
            </select>
          </div>
          <button
            onClick={run}
            disabled={pending || !query.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {pending ? `Researching… ${elapsedSec}s` : "Run Elite Dive"}
          </button>
        </div>
        {pending && (
          <p className="text-base text-amber-200">
            Still working — usually 45–90 seconds. Keep this tab open. Results scroll into view when ready.
          </p>
        )}
        {!report && !pending && !error && (
          <p className="text-base text-foreground/80">
            Enter a ticker and run — summation, thesis, positions, and execute appear below when finished.
          </p>
        )}
      </section>

      <details className="rounded-lg border border-border bg-card/60 p-4">
        <summary className="text-base font-medium text-foreground cursor-pointer">
          Enrichment keys (Railway) — optional check
        </summary>
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={loadSources}
            className="text-sm text-foreground/70 hover:text-foreground inline-flex items-center gap-1"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
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
                <span className="text-sm text-foreground/80">{label}</span>
              </div>
            );
          })}
        </div>
        {sourceNote && <p className="text-sm text-foreground/70 mt-2">{sourceNote}</p>}
      </details>

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

      {report && (() => {
        const week = report.trade_plan?.horizons?.week;
        const contra = report.trade_plan?.contrarian_play || report.institutional?.contrarian_play;
        const sleeve = report.institutional?.portfolio_fit?.suggested_sleeve_pct;
        const conviction = report.verdict?.conviction ?? report.institutional?.conviction_0_to_1;
        return (
        <div className="space-y-6 max-w-5xl">
          {/* 1. Verdict strip */}
          <div className="flex flex-wrap items-center gap-3">
            <div className={`rounded-md border px-4 py-2 text-lg font-bold ${verdictColor}`}>
              {verdict || "NO VERDICT"}
            </div>
            <div className="text-base text-foreground/85">
              <span className="font-semibold text-foreground">{report.resolved_symbol || report.query}</span>
              {" · "}{report.asset_type || assetType}
              {report.trade_plan?.bias && <> · Bias <span className="font-semibold">{report.trade_plan.bias}</span></>}
              {conviction != null && <> · Conviction {Math.round(Number(conviction) * 100)}%</>}
              {durationMs != null && <> · {(durationMs / 1000).toFixed(1)}s</>}
            </div>
          </div>

          {/* 2. Summation */}
          <section id="elite-summation" className="rounded-lg border border-primary/35 bg-primary/5 p-5 md:p-6 space-y-3 scroll-mt-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground">
              <Newspaper className="h-5 w-5 text-accent" /> Research summation
            </h2>
            <p className="text-sm text-foreground/70">
              Full analyst note — what the desk concludes after mining tape, filings, macro, and online intel.
            </p>
            <div className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
              {report.analyst_memo || report.institutional?.investment_thesis || "No memo returned."}
            </div>
          </section>

          {/* 3. Thesis / thinking */}
          <section className="rounded-lg border border-border bg-card p-5 md:p-6 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" /> Thesis — why we think this
            </h2>
            <p className="text-base leading-relaxed text-foreground">
              {report.institutional?.investment_thesis || "Thesis not available."}
            </p>
            {report.institutional?.valuation?.commentary && (
              <p className="text-base text-foreground/90 leading-relaxed border-l-2 border-accent/50 pl-3">
                {report.institutional.valuation.commentary}
              </p>
            )}
            {(report.verdict?.reasons || []).length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold uppercase tracking-wider text-foreground/70">Thinking chain</div>
                <ul className="space-y-2">
                  {report.verdict.reasons.map((r: string, i: number) => (
                    <li key={i} className="text-base text-foreground/90 flex gap-2">
                      <span className="text-accent font-bold shrink-0">{i + 1}.</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-emerald-300">Catalysts up</div>
                {(report.institutional?.catalysts_up || []).length
                  ? (report.institutional.catalysts_up as string[]).slice(0, 6).map((c, i) => (
                      <div key={i} className="text-base text-foreground/90">• {c}</div>
                    ))
                  : <div className="text-base text-foreground/60">None flagged</div>}
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold text-red-300">Catalysts down</div>
                {(report.institutional?.catalysts_down || []).length
                  ? (report.institutional.catalysts_down as string[]).slice(0, 6).map((c, i) => (
                      <div key={i} className="text-base text-foreground/90">• {c}</div>
                    ))
                  : <div className="text-base text-foreground/60">None flagged</div>}
              </div>
            </div>
            {report.institutional?.portfolio_fit && (
              <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 text-base">
                <span className="font-semibold">Book role:</span>{" "}
                {report.institutional.portfolio_fit.role}
                {sleeve != null && <> · <span className="font-semibold">Suggested sleeve</span> {sleeve}% of liquid risk book</>}
                {report.institutional.portfolio_fit.notes && (
                  <p className="text-sm text-foreground/75 mt-1">{report.institutional.portfolio_fit.notes}</p>
                )}
              </div>
            )}
          </section>

          {/* 4. Positions laid out */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" /> Positions laid out
            </h2>
            <p className="text-base text-foreground/80 -mt-2">
              Primary desk book vs always-on contrarian fade. Entry · target · stop · size.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <PositionCard
                title="Primary position"
                badge={week?.action || report.trade_plan?.bias || "—"}
                tone="primary"
                thesis={week?.thesis}
                rows={[
                  ["Symbol", report.resolved_symbol],
                  ["Direction", week?.direction || report.trade_plan?.bias],
                  ["Horizon", week?.label || "1 week"],
                  ["Mark / entry", fmt(week?.entry_price ?? report.trade_plan?.mark_price)],
                  ["Target", fmt(week?.target_price)],
                  ["Stop", fmt(week?.stop_price)],
                  ["Target ROI", fmtPct(week?.target_roi_pct)],
                  ["Stop loss", fmtPct(week?.stop_loss_pct)],
                  ["R:R", week?.risk_reward != null ? `${week.risk_reward}x` : null],
                  ["Confidence", week?.confidence != null ? `${Math.round(week.confidence * 100)}%` : null],
                  ["Sleeve", sleeve != null ? `${sleeve}% of book` : null],
                  ["Invalidation", week?.invalidation],
                ]}
              />
              <PositionCard
                title="Contrarian position"
                badge={contra?.action || "FADE"}
                tone="contra"
                thesis={contra?.thesis}
                rows={[
                  ["Vs primary", contra?.vs_primary_bias],
                  ["Direction", contra?.setup?.direction || (String(contra?.action || "").includes("LONG") ? "long" : "short")],
                  ["Horizon", "1 week fade"],
                  ["Trigger", contra?.setup?.entry_trigger],
                  ["Entry", fmt(contra?.setup?.entry_price)],
                  ["Target", fmt(contra?.setup?.target_price)],
                  ["Stop", fmt(contra?.setup?.stop_price)],
                  ["Target ROI", fmtPct(contra?.setup?.target_roi_pct)],
                  ["Stop loss", fmtPct(contra?.setup?.stop_loss_pct)],
                  ["R:R", contra?.setup?.risk_reward != null ? `${contra.setup.risk_reward}x` : null],
                  ["Confidence", contra?.setup?.confidence != null ? `${Math.round(contra.setup.confidence * 100)}%` : null],
                  ["Sizing", contra?.sizing_note],
                  ["Invalidation", contra?.invalidation],
                ]}
              />
            </div>
            {contra && (
              <ContrarianPlayPanel play={contra} fmt={fmt} fmtPct={fmtPct} />
            )}
          </section>

          {/* 5. Multi-horizon ROI grid */}
          {report.trade_plan?.horizons && (
            <section className="rounded-lg border border-accent/30 bg-accent/5 p-5 space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent" /> Multi-horizon targets
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(["day", "week", "month", "year"] as const).map((h) => {
                  const plan = report.trade_plan.horizons?.[h];
                  if (!plan) return null;
                  return (
                    <div key={h} className="rounded-md border border-border bg-card p-4 space-y-2">
                      <div className="text-sm font-semibold uppercase tracking-wider text-foreground/70">{plan.label}</div>
                      <div className="text-base font-medium text-foreground">{plan.action}</div>
                      <div className="text-2xl font-bold text-accent">
                        {plan.target_roi_pct > 0 ? "+" : ""}{plan.target_roi_pct}%
                      </div>
                      <div className="text-sm text-foreground/70">target ROI</div>
                      <div className="pt-2 space-y-1.5 border-t border-border">
                        <Kv label="Stop" value={fmtPct(plan.stop_loss_pct)} />
                        <Kv label="R:R" value={plan.risk_reward != null ? `${plan.risk_reward}x` : null} />
                        <Kv label="Target px" value={fmt(plan.target_price)} />
                        <Kv label="Stop px" value={fmt(plan.stop_price)} />
                        <Kv label="Conf" value={plan.confidence != null ? `${Math.round(plan.confidence * 100)}%` : null} />
                      </div>
                      {plan.thesis && (
                        <p className="text-sm text-foreground/80 leading-snug pt-1">{plan.thesis}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              {report.trade_plan.execution && (
                <p className="text-base text-foreground/85">
                  {report.trade_plan.execution.entry_style} · {report.trade_plan.execution.take_profit_rule} · Max book risk{" "}
                  {report.trade_plan.execution.max_book_risk_pct}%
                </p>
              )}
            </section>
          )}

          {/* 6. Scenarios */}
          {report.institutional?.scenarios && (
            <section className="rounded-lg border border-border bg-card p-5 space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Globe2 className="h-5 w-5 text-accent" /> 12-month scenarios
              </h2>
              <div className="grid md:grid-cols-3 gap-3">
                {(["bull", "base", "bear"] as const).map((k) => {
                  const s = report.institutional.scenarios?.[k];
                  if (!s) return null;
                  return (
                    <div key={k} className="rounded-md border border-border bg-secondary/30 px-4 py-3 space-y-1">
                      <div className="flex justify-between text-base font-semibold">
                        <span>{s.label}</span>
                        <span className="text-accent">
                          {s.implied_12m_roi_pct > 0 ? "+" : ""}{s.implied_12m_roi_pct}% · {s.probability_pct}%
                        </span>
                      </div>
                      <p className="text-sm text-foreground/85 leading-relaxed">{s.narrative}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 7. Robinhood execute */}
          {report.trade_plan && (
            <section className="rounded-lg border border-emerald-500/35 bg-emerald-500/5 p-5 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Execute on Robinhood Agentic</h2>
                  <p className="text-sm text-foreground/75">Uses the primary position plan for the selected horizon.</p>
                </div>
                <div className="text-base flex items-center gap-2 flex-wrap">
                  {rhStatus?.configured ? (
                    <span className="text-emerald-300 font-semibold">Connected</span>
                  ) : (
                    <button
                      type="button"
                      disabled={rhBusy}
                      onClick={connectRobinhood}
                      className="text-amber-300 font-semibold underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      Connect Robinhood
                    </button>
                  )}
                  {rhStatus?.live_trading_enabled ? (
                    <span className="text-red-300 font-semibold">LIVE ON</span>
                  ) : (
                    <span className="text-foreground/70">live off</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-sm text-foreground/70">Horizon</label>
                  <select
                    value={rhHorizon}
                    onChange={(e) => setRhHorizon(e.target.value as typeof rhHorizon)}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2.5 text-base"
                  >
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                    <option value="year">Year</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-foreground/70">Notional USD</label>
                  <input
                    value={rhNotional}
                    onChange={(e) => setRhNotional(e.target.value)}
                    className="w-full rounded-md border border-border bg-secondary px-3 py-2.5 text-base"
                  />
                </div>
                <button
                  disabled={rhBusy || report.trade_plan?.bias === "NEUTRAL"}
                  onClick={() => executeOnRobinhood(false)}
                  className="rounded-md border border-accent/40 bg-accent/10 text-accent px-4 py-2.5 text-base font-semibold hover:bg-accent/20 disabled:opacity-50"
                >
                  {rhBusy ? "Working…" : "Review order"}
                </button>
                <button
                  disabled={rhBusy || !rhStatus?.live_trading_enabled || report.trade_plan?.bias === "NEUTRAL"}
                  onClick={() => {
                    if (window.confirm(`Place LIVE Robinhood buy for ${report.resolved_symbol} ($${rhNotional})?`)) {
                      executeOnRobinhood(true);
                    }
                  }}
                  className="rounded-md border border-red-500/40 bg-red-500/10 text-red-300 px-4 py-2.5 text-base font-semibold disabled:opacity-40"
                >
                  Place live
                </button>
              </div>
              {rhError && <p className="text-base text-red-300">{rhError}</p>}
              {rhResult && (
                <pre className="text-sm text-foreground/90 whitespace-pre-wrap max-h-56 overflow-auto rounded border border-border bg-secondary/40 p-3">
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
            </section>
          )}

          {/* 8. Supporting research */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Supporting research</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Panel icon={<LineChart className="h-4 w-4" />} title="Technicals">
                <Kv label="Price" value={fmt(report.technicals?.price)} />
                <Kv label="Trend" value={report.technicals?.trend} />
                <Kv label="Change" value={fmtPct(report.technicals?.change_1d_pct ?? report.technicals?.change_24h_pct)} />
                <Kv label="Liquidity" value={fmt(report.technicals?.liquidity_usd)} />
              </Panel>
              <Panel icon={<Building2 className="h-4 w-4" />} title="Fundamentals">
                <Kv label="Company" value={report.fundamentals_micro?.sec?.company_name} />
                <Kv label="Sector" value={report.industry?.sector || report.fundamentals_micro?.yahoo?.sector} />
                <Kv label="Industry" value={report.industry?.industry || report.fundamentals_micro?.yahoo?.industry} />
                <Kv label="Macro regime" value={report.fundamentals_macro?.regime} />
                <Kv label="Trailing PE" value={report.institutional?.valuation?.trailing_pe != null ? String(report.institutional.valuation.trailing_pe) : null} />
              </Panel>
              <Panel icon={<Users className="h-4 w-4" />} title="Online / employee intel">
                <Kv label="Reddit" value={`${report.online_intel?.reddit?.count ?? 0} · ${report.online_intel?.reddit?.sentiment?.label || "n/a"}`} />
                <Kv label="News" value={`${report.online_intel?.news?.count ?? 0} · ${report.online_intel?.news?.sentiment?.label || "n/a"}`} />
                <Kv label="X / Twitter" value={`${report.online_intel?.x_twitter?.count ?? 0} · ${report.online_intel?.x_twitter?.sentiment?.label || "n/a"}`} />
                <Kv label="Employee signals" value={String(report.online_intel?.journals_employees?.employee_social_and_complaint_signals?.length ?? 0)} />
              </Panel>
              <Panel icon={<Building2 className="h-4 w-4" />} title="Desk voice (public BR / JPM / GS)">
                <Kv label="Mentions" value={String(report.online_intel?.desk_voice?.count ?? 0)} />
                <Kv label="Mid-level hits" value={String(report.online_intel?.desk_voice?.midlevel_hits ?? 0)} />
                <Kv label="Tone" value={report.online_intel?.desk_voice?.sentiment?.label || "n/a"} />
                {(report.online_intel?.desk_voice?.voices || [])
                  .filter((v: any) => v.midlevel_signal)
                  .slice(0, 4)
                  .map((v: any, i: number) => (
                    <a key={i} href={v.url} target="_blank" rel="noopener noreferrer"
                      className="block text-sm text-accent hover:underline truncate" title={v.title}>
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
              {(report.institutional?.risk_matrix || []).length > 0 && (
                <Panel icon={<AlertTriangle className="h-4 w-4" />} title="Risk matrix">
                  {(report.institutional.risk_matrix as any[]).slice(0, 5).map((r, i) => (
                    <div key={i} className="text-sm border-b border-border/50 pb-1.5 mb-1.5 last:border-0">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-foreground">{r.risk}</span>
                        <span className="text-amber-300">{r.severity}</span>
                      </div>
                      <p className="text-foreground/75 mt-0.5">{r.mitigation}</p>
                    </div>
                  ))}
                </Panel>
              )}
            </div>
          </section>

          <details className="rounded-lg border border-border bg-secondary/30 p-4">
            <summary className="text-base text-foreground/80 cursor-pointer font-medium">Raw structured report</summary>
            <pre className="mt-3 text-sm text-foreground/85 whitespace-pre-wrap overflow-x-auto max-h-[420px]">
              {JSON.stringify(report, null, 2)}
            </pre>
          </details>
        </div>
        );
      })()}
    </div>
  );
}

function PositionCard({
  title,
  badge,
  tone,
  thesis,
  rows,
}: {
  title: string;
  badge: string;
  tone: "primary" | "contra";
  thesis?: string;
  rows: [string, string | number | null | undefined][];
}) {
  const shell =
    tone === "primary"
      ? "border-emerald-500/40 bg-emerald-500/10"
      : "border-amber-500/40 bg-amber-500/10";
  const badgeCls =
    tone === "primary"
      ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/40"
      : "bg-amber-500/20 text-amber-100 border-amber-500/40";
  return (
    <div className={`rounded-lg border ${shell} p-5 space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <span className={`text-sm font-bold px-2.5 py-1 rounded-md border ${badgeCls}`}>{badge}</span>
      </div>
      {thesis && <p className="text-base text-foreground/90 leading-relaxed">{thesis}</p>}
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 text-base border-b border-border/40 pb-1.5 last:border-0">
            <span className="text-foreground/70 shrink-0">{label}</span>
            <span className="text-foreground font-medium text-right break-words max-w-[60%]">
              {value == null || value === "" ? "—" : String(value)}
            </span>
          </div>
        ))}
      </div>
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
      <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
        <span className="text-accent">{icon}</span> {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Kv({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-foreground/70">{label}</span>
      <span className="text-foreground font-medium text-right truncate max-w-[65%]">{value == null || value === "" ? "—" : String(value)}</span>
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
