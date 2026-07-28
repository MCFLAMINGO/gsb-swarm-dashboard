"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  Brain, Search, RefreshCw, AlertTriangle, CheckCircle2,
  TrendingUp, Newspaper, Users, Building2, LineChart, Globe2
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

  useEffect(() => {
    loadSources();
  }, []);

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
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Elite Deep Dive</h1>
            <p className="text-sm text-muted-foreground">
              Multi-factor research from Railway gsb-swarm — technicals, micro/macro fundamentals, online intel, industry & adjacent.
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
              <h3 className="text-sm font-medium flex items-center gap-2"><Newspaper className="h-4 w-4 text-accent" /> Analyst memo</h3>
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{report.analyst_memo}</p>
            </section>
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
