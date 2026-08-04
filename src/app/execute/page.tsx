"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import PlayByPlayRail from "@/components/PlayByPlayRail";
import { Crosshair, Activity, Zap, Brain, Link2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function ExecutePage() {
  const [rhStatus, setRhStatus] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pasteToken, setPasteToken] = useState("");
  const [pasteRefresh, setPasteRefresh] = useState("");
  const [testSymbol, setTestSymbol] = useState("F");
  const [testNotional, setTestNotional] = useState("10");
  const [reviewResult, setReviewResult] = useState<any>(null);

  async function refresh(opts?: { manual?: boolean }) {
    const manual = Boolean(opts?.manual);
    if (manual) setRefreshing(true);
    try {
      const res = await fetch("/api/robinhood?action=status", { cache: "no-store" });
      const next = await res.json();
      setRhStatus(next);
      let bp: string | null = null;
      if (next?.configured) {
        const p = await fetch("/api/robinhood?action=portfolio", { cache: "no-store" });
        if (p.ok) {
          const body = await p.json();
          setPortfolio(body);
          bp =
            body?.portfolio?.parsed?.data?.buying_power?.buying_power ||
            body?.portfolio?.parsed?.data?.cash ||
            null;
        }
      } else {
        setPortfolio(null);
      }
      if (manual) {
        const acct = next?.account_number
          ? `••${String(next.account_number).slice(-4)}`
          : null;
        toast.success(next?.configured ? "Robinhood status updated" : "Status refreshed", {
          description: [
            next?.configured ? (acct ? `Account ${acct}` : "Connected") : "Not connected",
            next?.live_trading_enabled ? "live ON" : "live off",
            bp ? `BP $${bp}` : null,
            new Date().toLocaleTimeString(),
          ]
            .filter(Boolean)
            .join(" · "),
        });
      }
    } catch (e) {
      setRhStatus({ configured: false, error: (e as Error).message });
      if (manual) toast.error("Refresh failed", { description: (e as Error).message });
    } finally {
      if (manual) setRefreshing(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function testDryRunReview() {
    setBusy(true);
    setReviewResult(null);
    try {
      const res = await fetch("/api/robinhood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: testSymbol.trim().toUpperCase(),
          dryRun: true,
          confirm: false,
          notionalUsd: Number(testNotional) || 10,
          orderType: "market",
          trade_plan: { bias: "LONG" },
        }),
      });
      const data = await res.json();
      setReviewResult(data);
      if (data.ok) toast.success("Robinhood review OK (dry-run)");
      else toast.error("Review failed", { description: data.message || data.error });
    } catch (e) {
      toast.error("Review failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    setBusy(true);
    try {
      const res = await fetch("/api/robinhood?action=connect", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.authorize_url) throw new Error("No authorize_url from Swarm");
      toast.message("Redirecting to Robinhood — tap Allow for GSB Swarm");
      window.location.assign(data.authorize_url);
    } catch (e) {
      setBusy(false);
      toast.error("Connect failed", { description: (e as Error).message });
    }
  }

  const connected = Boolean(rhStatus?.configured);

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Execute"
        subtitle="Robinhood Agentic → Copy strategies → THROW / Tempo tape."
      />
      <main className="p-6 md:p-8 max-w-5xl space-y-5">
        <section className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl font-semibold flex items-center gap-2.5 text-foreground">
              <Crosshair className="h-6 w-6 text-emerald-400" /> Robinhood Agentic
            </h2>
            <span
              className={`text-base font-semibold px-3 py-1 rounded-md border ${
                connected
                  ? "text-emerald-200 bg-emerald-500/20 border-emerald-500/40"
                  : "text-amber-200 bg-amber-500/20 border-amber-500/40"
              }`}
            >
              {connected ? "Connected" : "Not connected"}
            </span>
          </div>

          <p className="text-base leading-relaxed text-foreground/90">
            Trades hit your funded Agentic account only. Live place needs Railway{" "}
            <code className="text-sm text-accent">ROBINHOOD_LIVE_TRADING=1</code>.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Live", value: rhStatus?.live_trading_enabled ? "ON" : "off" },
              { label: "Max notional", value: `$${rhStatus?.max_notional_usd ?? 250}` },
              { label: "Default size", value: `$${rhStatus?.default_notional_usd ?? 50}` },
              { label: "Token source", value: rhStatus?.token_source || "none" },
              {
                label: "Account",
                value: rhStatus?.account_number
                  ? `••${String(rhStatus.account_number).slice(-4)}`
                  : "—",
              },
            ].map((cell) => (
              <div
                key={cell.label}
                className="rounded-md border border-border bg-card px-3 py-3"
              >
                <div className="text-sm text-foreground/70 mb-1">{cell.label}</div>
                <div className="text-lg font-semibold text-foreground">{cell.value}</div>
              </div>
            ))}
          </div>

          {connected && portfolio && (
            <div className="rounded-md border border-border bg-card px-4 py-3 text-base text-foreground/90">
              Agentic buying power:{" "}
              <span className="font-semibold text-foreground">
                $
                {portfolio?.portfolio?.parsed?.data?.buying_power?.buying_power
                  || portfolio?.portfolio?.parsed?.data?.cash
                  || portfolio?.parsed?.data?.buying_power?.buying_power
                  || "—"}
              </span>
              {" · "}
              Lab Execute here first, then ship to{" "}
              <a
                href="https://industry-desk.vercel.app/desk?book=ai"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                Industry Desk
              </a>
              {" "}(product). Bare RH holds are not a strategy — use{" "}
              <span className="text-foreground font-medium">Protect live</span> on Live positions
              (stop ~1.5% + trail, no new buy) or{" "}
              <Link href="/elite-deep-dive" className="text-accent hover:underline">Elite</Link>
              .
            </div>
          )}

          {!connected && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/15 p-4 space-y-2">
              <div className="text-base font-semibold text-amber-100">
                Prefer Mac localhost bridge (avoids Robinhood “Uh oh”)
              </div>
              <p className="text-base text-foreground/85 leading-relaxed">
                On your Mac, in gsb-swarm:
              </p>
              <pre className="text-sm mono rounded border border-border bg-background px-3 py-3 overflow-x-auto whitespace-pre-wrap text-foreground">
{`node scripts/robinhood-connect-local.js`}
              </pre>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={refreshing || busy}
              onClick={() => refresh({ manual: true })}
              className="inline-flex items-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-500/15 text-emerald-200 px-4 py-2.5 text-base font-medium disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {refreshing ? "Refreshing…" : "Refresh status"}
            </button>
            <a
              href="https://industry-desk.vercel.app/desk?book=ai"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 text-accent px-4 py-2.5 text-base font-medium hover:bg-accent/20"
            >
              <Crosshair className="h-4 w-4" /> Industry Desk (product) →
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-base font-medium text-foreground hover:border-primary/50"
            >
              Lab Desk →
            </Link>
            <Link
              href="/elite-deep-dive"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-base font-medium text-foreground hover:border-primary/50"
            >
              <Brain className="h-4 w-4" /> Review from Elite plan →
            </Link>
            <Link
              href="/connections"
              className="rounded-md border border-border bg-card px-4 py-2.5 text-base font-medium text-foreground/90 hover:border-primary/50"
            >
              Connections
            </Link>
            <button
              type="button"
              disabled={busy || refreshing}
              onClick={connect}
              title="Often fails with Robinhood Uh oh — prefer localhost bridge"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-4 py-2.5 text-sm text-foreground/80 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {busy
                ? "Opening Robinhood…"
                : connected
                  ? "Reconnect (HTTPS)"
                  : "Legacy HTTPS connect"}
            </button>
          </div>

          {connected && (
            <div className="rounded-md border border-border bg-card p-4 space-y-3">
              <div className="text-base font-semibold text-foreground">Talk to Robinhood (dry-run review)</div>
              <p className="text-base text-foreground/85 leading-relaxed">
                Hits Agentic <code className="text-sm">review_equity_order</code> — does not place.
              </p>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-sm text-foreground/70">Symbol</label>
                  <input
                    value={testSymbol}
                    onChange={(e) => setTestSymbol(e.target.value)}
                    className="w-28 rounded-md border border-border bg-secondary px-3 py-2.5 text-base mono uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-foreground/70">Notional $</label>
                  <input
                    value={testNotional}
                    onChange={(e) => setTestNotional(e.target.value)}
                    className="w-28 rounded-md border border-border bg-secondary px-3 py-2.5 text-base mono"
                  />
                </div>
                <button
                  disabled={busy || !testSymbol.trim()}
                  onClick={testDryRunReview}
                  className="rounded-md border border-emerald-500/50 bg-emerald-500/15 text-emerald-200 px-4 py-2.5 text-base font-medium disabled:opacity-50"
                >
                  {busy ? "Reviewing…" : "Test review"}
                </button>
              </div>
              {reviewResult && (
                <pre className="text-sm text-foreground/85 whitespace-pre-wrap max-h-56 overflow-auto rounded border border-border bg-secondary/40 p-3">
                  {JSON.stringify(
                    {
                      ok: reviewResult.ok,
                      mode: reviewResult.mode,
                      error: reviewResult.error,
                      message: reviewResult.message,
                      order: reviewResult.order || reviewResult.order_shaped,
                      shape: reviewResult.meta?.shape,
                      review: reviewResult.review?.parsed || reviewResult.review?.text || reviewResult.review,
                    },
                    null,
                    2
                  )}
                </pre>
              )}
            </div>
          )}

          {!connected && (
            <div className="rounded-md border border-border bg-card p-4 space-y-3">
              <div className="text-base font-semibold text-foreground">Fallback: paste tokens</div>
              <p className="text-base text-foreground/85 leading-relaxed">
                Paste an access token from the localhost script if import did not finish.
              </p>
              <input
                value={pasteToken}
                onChange={(e) => setPasteToken(e.target.value)}
                placeholder="access_token"
                className="w-full rounded-md border border-border bg-secondary px-3 py-2.5 text-base mono text-foreground"
              />
              <input
                value={pasteRefresh}
                onChange={(e) => setPasteRefresh(e.target.value)}
                placeholder="refresh_token (optional)"
                className="w-full rounded-md border border-border bg-secondary px-3 py-2.5 text-base mono text-foreground"
              />
              <button
                disabled={busy || !pasteToken.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await fetch("/api/robinhood", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "import-tokens",
                        access_token: pasteToken.trim(),
                        refresh_token: pasteRefresh.trim() || undefined,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                    toast.success("Tokens imported to Swarm");
                    setPasteToken("");
                    setPasteRefresh("");
                    await refresh();
                  } catch (e) {
                    toast.error("Import failed", { description: (e as Error).message });
                  } finally {
                    setBusy(false);
                  }
                }}
                className="rounded-md border border-border bg-secondary px-4 py-2.5 text-base font-medium disabled:opacity-50"
              >
                Import to Swarm
              </button>
            </div>
          )}
        </section>

        <PlayByPlayRail />

        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/copy-trader"
            className="rounded-lg border border-border bg-card p-5 flex gap-4 hover:border-primary/50 transition-colors"
          >
            <Activity className="h-6 w-6 text-accent shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-lg font-semibold text-foreground">Copy Trader</div>
              <p className="text-base text-foreground/85 mt-1 leading-relaxed">
                Yield / signal copy strategies on this same execute rail.
              </p>
            </div>
          </Link>

          <Link
            href="/throw"
            className="rounded-lg border border-border bg-card p-5 flex gap-4 hover:border-primary/50 transition-colors"
          >
            <Zap className="h-6 w-6 shrink-0 mt-0.5" style={{ color: "#00e5a0" }} />
            <div className="min-w-0">
              <div className="text-lg font-semibold text-foreground">THROW / Tempo</div>
              <p className="text-base text-foreground/85 mt-1 leading-relaxed">
                On-chain tape and Tempo rails under Execute.
              </p>
            </div>
          </Link>
        </div>

        <Link
          href="/"
          className="inline-block text-base font-medium text-foreground/90 hover:text-foreground underline-offset-4 hover:underline"
        >
          ← Back to Desk
        </Link>
      </main>
    </div>
  );
}
