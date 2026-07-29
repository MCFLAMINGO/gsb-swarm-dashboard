"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { Crosshair, Activity, Zap, Brain, Link2 } from "lucide-react";
import { toast } from "sonner";

export default function ExecutePage() {
  const [rhStatus, setRhStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [pasteToken, setPasteToken] = useState("");
  const [pasteRefresh, setPasteRefresh] = useState("");

  async function refresh() {
    try {
      const res = await fetch("/api/robinhood?action=status", { cache: "no-store" });
      setRhStatus(await res.json());
    } catch (e) {
      setRhStatus({ configured: false, error: (e as Error).message });
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function connect() {
    setBusy(true);
    try {
      const res = await fetch("/api/robinhood?action=connect", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.authorize_url) throw new Error("No authorize_url from Swarm");
      toast.message("Redirecting to Robinhood — tap Allow for GSB Swarm");
      // Same-tab — avoids popup blockers that look like a failed connect
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
        subtitle="One rail: Robinhood Agentic → Copy strategies → THROW / Tempo tape."
      />
      <main className="p-5 max-w-3xl mx-auto space-y-4">
        <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-emerald-400" /> Robinhood Agentic
            </h2>
            <span className={`text-[11px] ${connected ? "text-emerald-300" : "text-amber-300"}`}>
              {connected ? "Connected" : "Not connected"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            MCP <code className="text-[10px]">https://agent.robinhood.com/mcp/trading</code> ·
            trades hit your funded Agentic account only. Live place needs Railway{" "}
            <code className="text-[10px]">ROBINHOOD_LIVE_TRADING=1</code>.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="rounded border border-border bg-card/70 px-2 py-1.5">
              <div className="text-[10px] text-muted-foreground">Live</div>
              <div>{rhStatus?.live_trading_enabled ? "ON" : "off"}</div>
            </div>
            <div className="rounded border border-border bg-card/70 px-2 py-1.5">
              <div className="text-[10px] text-muted-foreground">Max notional</div>
              <div>${rhStatus?.max_notional_usd ?? 250}</div>
            </div>
            <div className="rounded border border-border bg-card/70 px-2 py-1.5">
              <div className="text-[10px] text-muted-foreground">Default size</div>
              <div>${rhStatus?.default_notional_usd ?? 50}</div>
            </div>
            <div className="rounded border border-border bg-card/70 px-2 py-1.5">
              <div className="text-[10px] text-muted-foreground">Token source</div>
              <div>{rhStatus?.token_source || "none"}</div>
            </div>
          </div>

          {!connected && (
            <div className="rounded-md border border-amber-500/35 bg-amber-500/10 p-3 space-y-2">
              <div className="text-xs font-medium text-amber-200">
                Robinhood “Uh oh” after Allow? Use the Mac localhost bridge
              </div>
              <p className="text-[11px] text-muted-foreground">
                Custom HTTPS redirects (Railway / this Connect button) often fail on Robinhood’s side.
                Official clients use localhost — run this once on your Mac, then the Desk uses Railway only
                (no Cursor chat tokens).
              </p>
              <pre className="text-[11px] mono rounded border border-border bg-background/80 px-2 py-2 overflow-x-auto whitespace-pre-wrap">
{`cd gsb-swarm
node scripts/robinhood-connect-local.js`}
              </pre>
              <p className="text-[11px] text-muted-foreground">
                Browser opens → tap Allow → script imports tokens to Swarm. Then hit Refresh below.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={async () => {
                await refresh();
                toast.success(connected ? "Still connected" : "Status refreshed");
              }}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-3 py-1.5 text-xs"
            >
              Refresh status
            </button>
            <Link
              href="/elite-deep-dive"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs"
            >
              <Brain className="h-3 w-3" /> Review from Elite plan →
            </Link>
            <Link
              href="/connections"
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground"
            >
              Connections
            </Link>
            <button
              disabled={busy}
              onClick={connect}
              title="Often fails with Robinhood Uh oh — prefer localhost bridge"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground disabled:opacity-50"
            >
              <Link2 className="h-3 w-3" />
              Legacy HTTPS connect
            </button>
          </div>

          {!connected && (
            <div className="rounded-md border border-border bg-card/60 p-3 space-y-2">
              <div className="text-xs font-medium text-foreground">Fallback: paste Swarm tokens</div>
              <p className="text-[11px] text-muted-foreground">
                If the localhost script already printed tokens, paste the access token here to import
                into Railway (does not use Cursor chat tokens afterward).
              </p>
              <input
                value={pasteToken}
                onChange={(e) => setPasteToken(e.target.value)}
                placeholder="access_token"
                className="w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-xs mono"
              />
              <input
                value={pasteRefresh}
                onChange={(e) => setPasteRefresh(e.target.value)}
                placeholder="refresh_token (optional)"
                className="w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-xs mono"
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
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Import to Swarm
              </button>
            </div>
          )}
        </section>

        <Link
          href="/copy-trader"
          className="rounded-lg border border-border bg-card p-4 flex gap-3 hover:border-primary/40 transition-colors block"
        >
          <Activity className="h-4 w-4 text-accent mt-0.5" />
          <div>
            <div className="text-sm font-medium">Copy Trader</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Yield / signal copy strategies — fold into this rail (backend consolidation still open).
            </p>
          </div>
        </Link>

        <Link
          href="/throw"
          className="rounded-lg border border-border bg-card p-4 flex gap-3 hover:border-primary/40 transition-colors block"
        >
          <Zap className="h-4 w-4 mt-0.5" style={{ color: "#00e5a0" }} />
          <div>
            <div className="text-sm font-medium">THROW / Tempo</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              On-chain tape + Tempo rails — ops strip under Execute, not a peer product.
            </p>
          </div>
        </Link>

        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground inline-block">
          ← Back to Desk
        </Link>
      </main>
    </div>
  );
}
