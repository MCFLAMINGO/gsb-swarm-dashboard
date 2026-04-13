"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import {
  Activity, Zap, Users, DollarSign, Clock, Hash,
  ExternalLink, RefreshCw, Radio, Send, CheckCircle2,
  AlertCircle, Wifi, WifiOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ThrowEvent {
  from: string;
  to: string;
  fromHandle: string;
  toHandle: string;
  amount: number;
  token: string;
  txHash: string;
  blockNumber: number;
  ts: string;
}

interface WatcherStatus {
  watcherStatus: "active" | "idle" | "error";
  registeredWallets: number;
  throwsToday: number;
  throwsTotal: number;
  volumeToday: number;
  volumeTotal: number;
  lastThrowAt: string | null;
  lastBlockChecked: number;
  lastPollAt: string | null;
  recentThrows: ThrowEvent[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Watcher URL — will be set once deployed to Railway
const WATCHER_BASE = process.env.NEXT_PUBLIC_THROW_WATCHER_URL || "https://throw-watcher-production.up.railway.app";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function timeAgo(ts: string | null) {
  if (!ts) return "never";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000)  return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

function txUrl(hash: string) {
  return `https://explorer.tempo.foundation/tx/${hash}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, colorClass, pulse
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  colorClass?: string;
  pulse?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-widest">{label}</span>
        <Icon size={15} className={cn("opacity-60", colorClass)} />
      </div>
      <div className={cn("text-2xl font-bold tabular-nums flex items-center gap-2", colorClass)}>
        {value}
        {pulse && <span className="status-dot active" />}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ThrowRow({ t, idx }: { t: ThrowEvent; idx: number }) {
  return (
    <div className={cn(
      "grid gap-3 px-4 py-3 text-sm border-b border-border/50 hover:bg-secondary/30 transition-colors",
      "grid-cols-[auto_1fr_1fr_auto_auto_auto]",
      idx === 0 && "bg-primary/5"
    )}>
      {/* Index */}
      <span className="text-[11px] text-muted-foreground tabular-nums w-5 pt-0.5">{idx + 1}</span>
      {/* From */}
      <div className="min-w-0">
        <div className="font-medium truncate">{t.fromHandle}</div>
        <div className="text-[10px] text-muted-foreground font-mono">{shortAddr(t.from)}</div>
      </div>
      {/* To */}
      <div className="min-w-0">
        <div className="font-medium truncate">{t.toHandle}</div>
        <div className="text-[10px] text-muted-foreground font-mono">{shortAddr(t.to)}</div>
      </div>
      {/* Amount */}
      <div className="text-right">
        <span className="font-bold text-green-400">${Number(t.amount).toFixed(2)}</span>
        <div className="text-[10px] text-muted-foreground">{t.token}</div>
      </div>
      {/* Block */}
      <div className="text-right text-[11px] text-muted-foreground tabular-nums hidden md:block">
        #{t.blockNumber?.toLocaleString()}
      </div>
      {/* Tx link */}
      <a
        href={txUrl(t.txHash)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center text-primary hover:opacity-80 transition-opacity"
        title={t.txHash}
      >
        <ExternalLink size={13} />
      </a>
    </div>
  );
}

// ─── Architecture diagram ─────────────────────────────────────────────────────

function ArchDiagram() {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
        Architecture — How THROW Watcher Works
      </div>
      <div className="flex flex-col sm:flex-row items-stretch gap-0">
        {[
          { icon: "📱", label: "THROW PWA", sub: "throw5onit.com", color: "text-orange-400" },
          { arrow: "→", label: "Web Push Subscription", color: "text-muted-foreground text-xs" },
          { icon: "🤖", label: "THROW Watcher", sub: "Railway • Node.js", color: "text-primary" },
          { arrow: "→", label: "eth_getLogs every 10s", color: "text-muted-foreground text-xs" },
          { icon: "⛓️", label: "Tempo Chain", sub: "Chain ID 4217", color: "text-blue-400" },
        ].map((item, i) => (
          "arrow" in item ? (
            <div key={i} className="flex flex-col items-center justify-center px-2 py-1 sm:py-0">
              <span className="text-muted-foreground text-lg">{item.arrow}</span>
              <span className="text-[9px] text-center text-muted-foreground max-w-[80px]">{item.label}</span>
            </div>
          ) : (
            <div key={i} className="flex-1 bg-secondary/40 border border-border rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className={cn("font-semibold text-sm", item.color)}>{item.label}</div>
              <div className="text-[10px] text-muted-foreground">{item.sub}</div>
            </div>
          )
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-muted-foreground">
        <div className="flex gap-2 items-start">
          <CheckCircle2 size={12} className="text-green-400 mt-0.5 shrink-0" />
          <span>One agent watches all wallets — scales to 100K+ users at ~$65/mo Railway spend</span>
        </div>
        <div className="flex gap-2 items-start">
          <CheckCircle2 size={12} className="text-green-400 mt-0.5 shrink-0" />
          <span>Web Push fires even when THROW app is closed — no polling needed on device</span>
        </div>
        <div className="flex gap-2 items-start">
          <CheckCircle2 size={12} className="text-green-400 mt-0.5 shrink-0" />
          <span>Bottleneck is Chainstack RPC tier, not the agent — upgrade RPC to handle more volume</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ThrowWatcherPage() {
  const [status, setStatus]       = useState<WatcherStatus | null>(null);
  const [throws, setThrows]       = useState<ThrowEvent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [online, setOnline]       = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, throwsRes] = await Promise.all([
        fetch(`${WATCHER_BASE}/throw-watcher/status`),
        fetch(`${WATCHER_BASE}/throw-watcher/throws`),
      ]);
      if (!statusRes.ok || !throwsRes.ok) throw new Error(`HTTP ${statusRes.status}`);
      const [s, t] = await Promise.all([statusRes.json(), throwsRes.json()]);
      setStatus(s);
      setThrows(t);
      setLastFetch(new Date());
      setError(null);
      setOnline(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Watcher offline: ${msg}`);
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 15_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const statusColor = {
    active: "text-green-400",
    idle:   "text-yellow-400",
    error:  "text-red-400",
  }[status?.watcherStatus ?? "idle"] ?? "text-muted-foreground";

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="THROW Watcher"
        subtitle="On-chain transfer surveillance — Tempo Chain · Web Push agent"
      />

      <div className="p-6 space-y-6">

        {/* Status bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium",
            online
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          )}>
            {online ? <Wifi size={13} /> : <WifiOff size={13} />}
            {online ? "Watcher Online" : "Watcher Offline"}
          </div>
          <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium border-border bg-secondary/40", statusColor)}>
            <Radio size={13} className={status?.watcherStatus === "active" ? "animate-pulse" : ""} />
            Chain: {status?.watcherStatus ?? "—"}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-secondary/40 text-xs text-muted-foreground">
            <Hash size={12} />
            Block #{status?.lastBlockChecked?.toLocaleString() ?? "—"}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {lastFetch && (
              <span className="text-[11px] text-muted-foreground">
                Updated {timeAgo(lastFetch.toISOString())}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              className="h-7 w-7 p-0"
              title="Refresh"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            <div>
              <div className="font-medium">Cannot reach THROW Watcher</div>
              <div className="text-xs text-red-400/70 mt-0.5">{error}</div>
              <div className="text-xs text-red-400/70 mt-0.5">
                Deploy watcher to Railway first — see{" "}
                <a href="https://github.com/MCFLAMINGO/throw-watcher" target="_blank" rel="noopener noreferrer" className="underline">throw-watcher repo</a>
              </div>
            </div>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Wallets Watching"
            value={status?.registeredWallets ?? "—"}
            sub="registered for push"
            icon={Users}
            colorClass="text-orange-400"
          />
          <StatCard
            label="Throws Today"
            value={status?.throwsToday ?? "—"}
            sub={`$${status?.volumeToday?.toFixed(2) ?? "0.00"} USD volume`}
            icon={Activity}
            colorClass="text-primary"
            pulse={status?.watcherStatus === "active"}
          />
          <StatCard
            label="Total Throws"
            value={status?.throwsTotal ?? "—"}
            sub={`$${status?.volumeTotal?.toFixed(2) ?? "0.00"} USD all-time`}
            icon={DollarSign}
            colorClass="text-green-400"
          />
          <StatCard
            label="Last Throw"
            value={timeAgo(status?.lastThrowAt ?? null)}
            sub={status?.lastThrowAt ? new Date(status.lastThrowAt).toLocaleTimeString() : "no throws yet"}
            icon={Clock}
            colorClass="text-blue-400"
          />
        </div>

        {/* Architecture diagram */}
        <ArchDiagram />

        {/* Throw history table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-primary" />
              <span className="text-sm font-semibold">Live Throw Feed</span>
              {throws.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {throws.length}
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">Tempo Chain · USDC.e + pathUSD</span>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-3 px-4 py-2 bg-secondary/20 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>#</span>
            <span>From</span>
            <span>To</span>
            <span className="text-right">Amount</span>
            <span className="text-right hidden md:block">Block</span>
            <span>Tx</span>
          </div>

          {/* Rows */}
          {loading && !throws.length && (
            <div className="px-4 py-10 text-center text-muted-foreground text-sm">
              <RefreshCw size={20} className="animate-spin mx-auto mb-2 opacity-40" />
              Connecting to watcher…
            </div>
          )}
          {!loading && throws.length === 0 && (
            <div className="px-4 py-10 text-center text-muted-foreground text-sm">
              <Activity size={20} className="mx-auto mb-2 opacity-30" />
              No throws detected yet — waiting for first transaction
            </div>
          )}
          {throws.map((t, i) => (
            <ThrowRow key={t.txHash + i} t={t} idx={i} />
          ))}
        </div>

        {/* Proof of Work section — for Tempo grant */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Send size={14} className="text-primary" />
            <span className="text-sm font-semibold">Proof of Work — Tempo Integration</span>
            <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30 h-4 px-1.5">For Tempo</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
            {[
              {
                label: "Chain",
                value: "Tempo Mainnet (Chain ID 4217)",
                icon: <CheckCircle2 size={12} className="text-green-400" />
              },
              {
                label: "Contracts Watched",
                value: "USDC.e · pathUSD (native stablecoins)",
                icon: <CheckCircle2 size={12} className="text-green-400" />
              },
              {
                label: "RPC Provider",
                value: "Chainstack (Tempo dedicated node)",
                icon: <CheckCircle2 size={12} className="text-green-400" />
              },
              {
                label: "Notification Method",
                value: "Web Push API — works when app is closed",
                icon: <CheckCircle2 size={12} className="text-green-400" />
              },
              {
                label: "App",
                value: "throw5onit.com — PWA, no App Store needed",
                icon: <CheckCircle2 size={12} className="text-green-400" />
              },
              {
                label: "Infrastructure",
                value: "Railway (watcher) + Vercel (dashboard + PWA)",
                icon: <CheckCircle2 size={12} className="text-green-400" />
              },
            ].map(({ label, value, icon }) => (
              <div key={label} className="flex items-start gap-2 p-3 bg-secondary/30 rounded-lg border border-border/50">
                <div className="mt-0.5 shrink-0">{icon}</div>
                <div>
                  <div className="text-muted-foreground">{label}</div>
                  <div className="font-medium text-foreground">{value}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground pt-1 border-t border-border">
            THROW is a social payments app built natively on Tempo. Every payment is a real on-chain transfer
            of USDC.e or pathUSD — no custodial intermediary. This watcher is part of the GSB Swarm agent network.
          </div>
        </div>

      </div>
    </div>
  );
}
