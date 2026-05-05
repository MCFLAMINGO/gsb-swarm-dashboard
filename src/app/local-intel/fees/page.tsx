"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign, RefreshCw, ToggleLeft, Wallet, Zap,
  AlertTriangle, CheckCircle2, XCircle, Clock, BarChart2,
  Bot, TrendingUp
} from "lucide-react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeeRates {
  rfq_match_fee:   number;
  order_fee_pct:   number;
  routing_enabled: boolean;
}

interface FeeEvent {
  id:            string;
  event_type:    string;
  business_id:   string | null;
  business_name: string | null;
  rfq_id:        string | null;
  amount_usd:    string;
  status:        string;
  wallet:        string | null;
  meta:          Record<string, unknown>;
  created_at:    string;
}

interface EventStat {
  event_type: string;
  status:     string;
  cnt:        string;
  total_usd:  string;
}

interface FeeSummary {
  hours:           number;
  events:          EventStat[];
  no_wallet_count: number;
  rates:           FeeRates;
}

interface FeeData {
  ok:      boolean;
  events:  FeeEvent[];
  summary: FeeSummary;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    free:        { cls: "bg-blue-500/15 text-blue-400 border-blue-500/20",   icon: <CheckCircle2 size={11} />, label: "free"        },
    routing_off: { cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",   icon: <Clock size={11} />,        label: "routing off" },
    charged:     { cls: "bg-green-500/15 text-green-400 border-green-500/20",icon: <CheckCircle2 size={11} />, label: "charged"     },
    failed:      { cls: "bg-red-500/15 text-red-400 border-red-500/20",      icon: <XCircle size={11} />,      label: "failed"      },
    no_wallet:   { cls: "bg-amber-500/15 text-amber-400 border-amber-500/20",icon: <AlertTriangle size={11} />,label: "no wallet"   },
  };
  const cfg = map[status] ?? { cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20", icon: null, label: status };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ── Event type badge ──────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    rfq_match:      "bg-purple-500/15 text-purple-400",
    rfq_book:       "bg-indigo-500/15 text-indigo-400",
    order_complete: "bg-emerald-500/15 text-emerald-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${map[type] ?? "bg-zinc-500/15 text-zinc-400"}`}>
      {type.replace(/_/g, " ")}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FeeControlPage() {
  const [data,       setData]       = useState<FeeData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [hours,      setHours]      = useState(24);
  const [err,        setErr]        = useState<string | null>(null);
  const [saveMsg,    setSaveMsg]    = useState<string | null>(null);

  // Form state mirrors env vars
  const [rfqFee,    setRfqFee]    = useState("0.0000");
  const [orderFee,  setOrderFee]  = useState("0.0000");
  const [routing,   setRouting]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${RAILWAY}/api/local-intel/fee-events?hours=${hours}&limit=200`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: FeeData = await res.json();
      setData(json);
      if (json.summary?.rates) {
        setRfqFee(json.summary.rates.rfq_match_fee.toFixed(4));
        setOrderFee(json.summary.rates.order_fee_pct.toFixed(4));
        setRouting(json.summary.rates.routing_enabled);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "unknown error");
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => { load(); }, [load]);

  const saveRates = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`${RAILWAY}/api/local-intel/fee-control`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfq_match_fee:   parseFloat(rfqFee)   || 0,
          order_fee_pct:   parseFloat(orderFee) || 0,
          routing_enabled: routing,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSaveMsg(`Saved — RFQ_MATCH_FEE=${json.rates.rfq_match_fee} ORDER_FEE_PCT=${json.rates.order_fee_pct} ROUTING=${json.rates.routing_enabled}`);
      await load();
    } catch (e) {
      setSaveMsg(`Error: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setSaving(false);
    }
  };

  // Aggregate summary
  const totalEvents  = data?.events?.length ?? 0;
  const noWalletCt   = data?.summary?.no_wallet_count ?? 0;
  const totalCharged = data?.events?.filter(e => e.status === "charged").length ?? 0;
  const totalFree    = data?.events?.filter(e => e.status === "free" || e.status === "routing_off").length ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign size={22} className="text-primary" />
          <div>
            <h1 className="text-xl font-bold">Fee Control</h1>
            <p className="text-xs text-muted-foreground">LocalIntel — transaction fees &amp; RFQ match revenue. All $0.00 now to build customer base.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={hours}
            onChange={e => setHours(Number(e.target.value))}
            className="text-xs border border-border bg-background rounded px-2 py-1.5 text-muted-foreground"
          >
            <option value={1}>Last 1h</option>
            <option value={6}>Last 6h</option>
            <option value={24}>Last 24h</option>
            <option value={72}>Last 3d</option>
            <option value={168}>Last 7d</option>
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {err && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <XCircle size={15} /> {err}
        </div>
      )}

      {/* Rate Controls */}
      <div className="bg-card rounded-lg border border-border p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={16} className="text-primary" />
          <h2 className="text-sm font-semibold">Rate Controls</h2>
          <span className="ml-auto text-[10px] text-muted-foreground">Runtime only — set Railway env vars to persist across deploys</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* RFQ Match Fee */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">RFQ_MATCH_FEE (USD flat)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={rfqFee}
                onChange={e => setRfqFee(e.target.value)}
                className="flex-1 text-sm border border-border bg-background rounded px-2 py-1.5 text-foreground"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Charged per confirmed RFQ match. $0.00 = free tier.</p>
          </div>

          {/* Order Fee % */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">ORDER_FEE_PCT (%)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={orderFee}
                onChange={e => setOrderFee(e.target.value)}
                className="flex-1 text-sm border border-border bg-background rounded px-2 py-1.5 text-foreground"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-[11px] text-muted-foreground">% of order value on confirmed payment. $0.00 = free tier.</p>
          </div>

          {/* Routing toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">ROUTING_ENABLED</label>
            <div className="flex items-center gap-3 py-2">
              <button
                onClick={() => setRouting(r => !r)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${routing ? "bg-green-500" : "bg-zinc-600"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${routing ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className={`text-sm font-medium ${routing ? "text-green-400" : "text-zinc-400"}`}>
                {routing ? "LIVE — charging enabled" : "OFF — logging only"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">When off, fees are logged but never charged. Keep off until Tempo debit is wired.</p>
          </div>
        </div>

        {saveMsg && (
          <div className={`p-2 rounded text-xs ${saveMsg.startsWith("Error") ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
            {saveMsg}
          </div>
        )}

        <button
          onClick={saveRates}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {saving ? "Saving…" : "Save Rates"}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Events",     value: totalEvents,  icon: <BarChart2 size={16} />, cls: "text-primary" },
          { label: "No Wallet",        value: noWalletCt,   icon: <Wallet size={16} />,    cls: "text-amber-400", tip: "Acquisition targets — businesses without wallets" },
          { label: "Charged",          value: totalCharged, icon: <DollarSign size={16} />,cls: "text-green-400" },
          { label: "Free / Off",       value: totalFree,    icon: <ToggleLeft size={16} />, cls: "text-blue-400"  },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-lg border border-border p-4 space-y-1" title={s.tip}>
            <div className={`${s.cls}`}>{s.icon}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* No-wallet acquisition callout */}
      {noWalletCt > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">{noWalletCt} confirmed match{noWalletCt !== 1 ? "es" : ""} from businesses without wallets</p>
            <p className="text-xs text-muted-foreground mt-1">
              These are acquisition targets. When businesses onboard a wallet, they enter the fee system.
              Use LocalIntel acquisition-targets endpoint to generate outreach list.
            </p>
          </div>
        </div>
      )}

      {/* Agent bids section */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Bot size={15} className="text-primary" />
          <h2 className="text-sm font-semibold">Agent-to-Agent Protocol</h2>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 border border-zinc-500/20 text-[11px]">
            bid shape: accept · price · eta · message · agent_id
          </span>
        </div>
        <div className="p-4 text-xs text-muted-foreground space-y-2">
          <p>When a business has <code className="bg-secondary px-1 rounded">agent_endpoint</code> set, LocalIntel POSTs a structured RFQ payload directly to that URL and waits up to 8s for a standard bid response.</p>
          <p>Bid shape: <code className="bg-secondary px-1 rounded">{"{ accept: bool, price: number, eta: string, message: string, agent_id: string }"}</code></p>
          <p>Best bid = lowest price among accepting agents. Tie-break by fastest eta. Fallback to SMS/email if no agent_endpoint or no accepting bids.</p>
          <p>All bids logged to <code className="bg-secondary px-1 rounded">rfq_agent_bids</code> table — use <code className="bg-secondary px-1 rounded">GET /api/local-intel/agent-bids/:rfq_id</code> to inspect.</p>
          <p>To register a business agent: set <code className="bg-secondary px-1 rounded">agent_endpoint</code> and optionally <code className="bg-secondary px-1 rounded">agent_key</code> columns on the businesses row.</p>
        </div>
      </div>

      {/* Fee event log */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <TrendingUp size={15} className="text-primary" />
          <h2 className="text-sm font-semibold">Fee Event Log</h2>
          <span className="ml-auto text-xs text-muted-foreground">last {hours}h — {totalEvents} events</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            <RefreshCw size={18} className="animate-spin mx-auto mb-2" />
            Loading…
          </div>
        ) : !data?.events?.length ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No fee events in the last {hours}h — events appear when RFQ matches or bookings are confirmed.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["Type", "Business", "Amount", "Status", "Wallet", "Time"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.events.map(ev => (
                  <tr key={ev.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-2.5"><TypeBadge type={ev.event_type} /></td>
                    <td className="px-4 py-2.5 max-w-[160px] truncate text-foreground">
                      {ev.business_name || ev.business_id?.slice(0, 8) || "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-foreground">
                      ${parseFloat(ev.amount_usd || "0").toFixed(4)}
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge status={ev.status} /></td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">
                      {ev.wallet ? ev.wallet.slice(0, 8) + "…" : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {ev.created_at ? new Date(ev.created_at).toLocaleTimeString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
