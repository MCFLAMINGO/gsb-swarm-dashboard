"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import {
  Activity, Zap, Users, DollarSign, Clock, Hash,
  ExternalLink, RefreshCw, Radio, Send, CheckCircle2,
  AlertCircle, Wifi, WifiOff, Plus, Pencil, Trash2,
  ChevronLeft, ChevronRight, Megaphone, Eye,
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

interface Campaign {
  id: string;
  advertiser: string;
  budget: number;
  cpm: number;
  copy: string;
  imageUrl: string;
  target: string;
  startDate: string;
  endDate: string;
  status: string;
  impressions: number;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WATCHER_BASE = process.env.NEXT_PUBLIC_THROW_WATCHER_URL || "https://throw-watcher-production.up.railway.app";
const PAGE_SIZE = 8;

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
      <span className="text-[11px] text-muted-foreground tabular-nums w-5 pt-0.5">{idx + 1}</span>
      <div className="min-w-0">
        <div className="font-medium truncate">{t.fromHandle}</div>
        <div className="text-[10px] text-muted-foreground font-mono">{shortAddr(t.from)}</div>
      </div>
      <div className="min-w-0">
        <div className="font-medium truncate">{t.toHandle}</div>
        <div className="text-[10px] text-muted-foreground font-mono">{shortAddr(t.to)}</div>
      </div>
      <div className="text-right">
        <span className="font-bold text-green-400">${Number(t.amount).toFixed(2)}</span>
        <div className="text-[10px] text-muted-foreground">{t.token}</div>
      </div>
      <div className="text-right text-[11px] text-muted-foreground tabular-nums hidden md:block">
        #{t.blockNumber?.toLocaleString()}
      </div>
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

// ─── Sponsors tab ─────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  advertiser: "", budget: "", cpm: "", copy: "",
  imageUrl: "", target: "all", startDate: "", endDate: "", status: "active",
};

function SponsorsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [form, setForm]           = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [editId, setEditId]       = useState<string | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${WATCHER_BASE}/throw-watcher/campaigns`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setCampaigns(await r.json());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(c: Campaign) {
    setForm({
      advertiser: c.advertiser, budget: String(c.budget), cpm: String(c.cpm),
      copy: c.copy, imageUrl: c.imageUrl, target: c.target,
      startDate: c.startDate, endDate: c.endDate, status: c.status,
    });
    setEditId(c.id);
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      const url  = editId
        ? `${WATCHER_BASE}/throw-watcher/campaigns/${editId}`
        : `${WATCHER_BASE}/throw-watcher/campaigns`;
      const method = editId ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setShowForm(false);
      setEditId(null);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this sponsor?")) return;
    await fetch(`${WATCHER_BASE}/throw-watcher/campaigns/${id}`, { method: "DELETE" });
    await load();
  }

  async function pushLive(c: Campaign) {
    setPushStatus(`Pushing ${c.advertiser}…`);
    try {
      // Build the MQTT-style sponsor payload and push via watcher broadcast
      const sponsor = {
        id:       c.id,
        name:     c.advertiser,
        logoUrl:  c.imageUrl,
        tagline:  c.copy,
        url:      "",
        isVenue:  false,
        venueId:  null,
      };
      // Push MQTT retained message via a dedicated endpoint (falls back to broadcast)
      const r = await fetch(`${WATCHER_BASE}/throw-watcher/sponsor-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sponsor, sponsors: [sponsor] }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setPushStatus(`✓ ${c.advertiser} pushed live`);
    } catch (e: unknown) {
      setPushStatus(`✗ ${e instanceof Error ? e.message : String(e)}`);
    }
    setTimeout(() => setPushStatus(null), 4000);
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone size={14} className="text-primary" />
          <span className="text-sm font-semibold">Sponsors & Campaigns</span>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{campaigns.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {pushStatus && (
            <span className="text-[11px] text-muted-foreground">{pushStatus}</span>
          )}
          <Button size="sm" variant="ghost" onClick={load} className="h-7 w-7 p-0">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={openNew} className="h-7 gap-1 text-xs">
            <Plus size={12} /> Add Sponsor
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="text-sm font-semibold">{editId ? "Edit Sponsor" : "New Sponsor"}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: "advertiser", label: "Advertiser Name", placeholder: "Aqua Grill" },
              { key: "imageUrl",   label: "Logo URL",         placeholder: "https://…/logo.png" },
              { key: "copy",       label: "Tagline / Copy",   placeholder: "Fresh coastal cuisine…" },
              { key: "budget",     label: "Budget ($)",       placeholder: "500" },
              { key: "cpm",        label: "CPM ($)",          placeholder: "2.50" },
              { key: "startDate",  label: "Start Date",       placeholder: "2026-04-01" },
              { key: "endDate",    label: "End Date",         placeholder: "2026-04-30" },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-[11px] text-muted-foreground">{label}</label>
                <input
                  value={form[key as keyof typeof EMPTY_FORM]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="ended">Ended</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : editId ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      )}

      {/* Campaign cards */}
      {loading && campaigns.length === 0 && (
        <div className="py-10 text-center text-muted-foreground text-sm">
          <RefreshCw size={18} className="animate-spin mx-auto mb-2 opacity-40" />
          Loading campaigns…
        </div>
      )}
      {!loading && campaigns.length === 0 && !showForm && (
        <div className="py-10 text-center text-muted-foreground text-sm">
          <Megaphone size={20} className="mx-auto mb-2 opacity-30" />
          No sponsors yet — add Aqua Grill, McFlamingo, and others
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {campaigns.map(c => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {c.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" onError={e => (e.currentTarget.style.display = "none")} />
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{c.advertiser}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{c.copy}</div>
                </div>
              </div>
              <Badge
                className={cn(
                  "text-[10px] h-4 px-1.5 shrink-0",
                  c.status === "active"
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {c.status}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="bg-secondary/40 rounded-lg p-2 text-center">
                <div className="text-muted-foreground">Budget</div>
                <div className="font-semibold">${c.budget}</div>
              </div>
              <div className="bg-secondary/40 rounded-lg p-2 text-center">
                <div className="text-muted-foreground">CPM</div>
                <div className="font-semibold">${c.cpm}</div>
              </div>
              <div className="bg-secondary/40 rounded-lg p-2 text-center">
                <div className="text-muted-foreground flex items-center justify-center gap-1"><Eye size={10} /> Impr.</div>
                <div className="font-semibold">{c.impressions}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1 flex-1"
                onClick={() => pushLive(c)}
                disabled={c.status !== "active"}
              >
                <Send size={11} /> Push Live
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(c)}>
                <Pencil size={12} />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => del(c.id)}>
                <Trash2 size={12} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "feed" | "sponsors" | "proof";

export default function ThrowWatcherPage() {
  const [status, setStatus]       = useState<WatcherStatus | null>(null);
  const [throws, setThrows]       = useState<ThrowEvent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [online, setOnline]       = useState(true);
  const [throwOnly, setThrowOnly] = useState(false);
  const [tab, setTab]             = useState<Tab>("feed");
  const [page, setPage]           = useState(0);

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

  const registeredAddrs = new Set(
    (status as WatcherStatus & { registeredAddresses?: string[] })?.registeredAddresses?.map((a: string) => a.toLowerCase()) ?? []
  );

  const filteredThrows = throwOnly
    ? throws.filter(t =>
        registeredAddrs.has(t.from.toLowerCase()) ||
        registeredAddrs.has(t.to.toLowerCase())
      )
    : throws;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredThrows.length / PAGE_SIZE));
  const pagedThrows = filteredThrows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filter changes
  useEffect(() => setPage(0), [throwOnly]);

  const statusColor = {
    active: "text-green-400",
    idle:   "text-yellow-400",
    error:  "text-red-400",
  }[status?.watcherStatus ?? "idle"] ?? "text-muted-foreground";

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "feed",     label: "Live Feed",   icon: Zap },
    { id: "sponsors", label: "Sponsors",    icon: Megaphone },
    { id: "proof",    label: "Proof of Work", icon: CheckCircle2 },
  ];

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

        {/* Architecture diagram — always visible */}
        <ArchDiagram />

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon size={13} />
              {t.label}
              {t.id === "sponsors" && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">MQTT</Badge>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Live Feed ── */}
        {tab === "feed" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-primary" />
                <span className="text-sm font-semibold">Live Throw Feed</span>
                {filteredThrows.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {filteredThrows.length}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setThrowOnly(v => !v)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                    throwOnly
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", throwOnly ? "bg-primary" : "bg-muted-foreground")} />
                  {throwOnly ? "THROW only" : "All Tempo"}
                </button>
                <span className="text-[11px] text-muted-foreground">USDC.e + pathUSD</span>
              </div>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-3 px-4 py-2 bg-secondary/20 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>#</span><span>From</span><span>To</span>
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
            {!loading && filteredThrows.length === 0 && (
              <div className="px-4 py-10 text-center text-muted-foreground text-sm">
                <Activity size={20} className="mx-auto mb-2 opacity-30" />
                {throwOnly
                  ? "No THROW app transactions yet — register a wallet to see yours here"
                  : "No throws detected yet — waiting for first transaction"}
              </div>
            )}
            {pagedThrows.map((t, i) => (
              <ThrowRow key={t.txHash + i} t={t} idx={page * PAGE_SIZE + i} />
            ))}

            {/* Pagination */}
            {filteredThrows.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-[11px] text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredThrows.length)} of {filteredThrows.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost" size="sm" className="h-7 w-7 p-0"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft size={13} />
                  </Button>
                  <span className="text-[11px] text-muted-foreground px-1">{page + 1} / {totalPages}</span>
                  <Button
                    variant="ghost" size="sm" className="h-7 w-7 p-0"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight size={13} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Sponsors ── */}
        {tab === "sponsors" && (
          <div className="bg-card border border-border rounded-xl p-5">
            <SponsorsTab />
          </div>
        )}

        {/* ── Tab: Proof of Work ── */}
        {tab === "proof" && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Send size={14} className="text-primary" />
              <span className="text-sm font-semibold">Proof of Work — Tempo Integration</span>
              <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30 h-4 px-1.5">For Tempo</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
              {[
                { label: "Chain",                value: "Tempo Mainnet (Chain ID 4217)" },
                { label: "Contracts Watched",    value: "USDC.e · pathUSD (native stablecoins)" },
                { label: "RPC Provider",         value: "Chainstack (Tempo dedicated node)" },
                { label: "Notification Method",  value: "Web Push API — works when app is closed" },
                { label: "App",                  value: "throw5onit.com — PWA, no App Store needed" },
                { label: "Infrastructure",       value: "Railway (watcher) + Vercel (dashboard + PWA)" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-2 p-3 bg-secondary/30 rounded-lg border border-border/50">
                  <CheckCircle2 size={12} className="text-green-400 mt-0.5 shrink-0" />
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
        )}

      </div>
    </div>
  );
}
