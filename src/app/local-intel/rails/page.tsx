"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GitBranch, RefreshCw, XCircle, AlertTriangle, CheckCircle2,
  Zap, DollarSign, TrendingUp, Clock, Shield, Activity,
  Wallet, BarChart2, ArrowRight
} from "lucide-react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";

// ── Types ──────────────────────────────────────────────────────────────────────

interface RailStat {
  rail:      string;
  fee_rail:  string;
  status:    string;
  cnt:       string;
  total_usd: string;
}

interface RailWeights {
  surge: number; tempo: number; base_usdc: number;
  stripe: number; sms: number; rfq: number;
}

interface RailStatsData {
  ok:                     boolean;
  hours:                  number;
  weights:                RailWeights;
  stats:                  RailStat[];
  platform_split_address: string;
  tempo_treasury:         string;
}

interface FeeEvent {
  id:            string;
  event_type:    string;
  business_name: string | null;
  business_id:   string | null;
  amount_usd:    string;
  status:        string;
  wallet:        string | null;
  meta:          Record<string, unknown>;
  created_at:    string;
}

interface AuditLog {
  id:            string;
  run_at:        string;
  total_surge:   number;
  patched:       number;
  already_ok:    number;
  errors:        number;
  split_address: string;
  split_pct:     string;
}

// ── Rail config ────────────────────────────────────────────────────────────────

const RAIL_META: Record<string, { color: string; label: string; desc: string }> = {
  surge:     { color: "#00e5a0", label: "Surge",     desc: "Basalt merchant POS — Base USDC split" },
  tempo:     { color: "#818cf8", label: "Tempo",     desc: "pathUSD micropayments — RFQ platform fees" },
  base_usdc: { color: "#3b82f6", label: "Base USDC", desc: "x402 agent-to-agent queries" },
  stripe:    { color: "#6366f1", label: "Stripe",    desc: "Card-paying businesses — Connect 5% fee" },
  sms:       { color: "#eab308", label: "SMS",       desc: "Twilio phone dispatch — no fee until confirmed" },
  rfq:       { color: "#f97316", label: "RFQ",       desc: "Broadcast fallback — universal last resort" },
};

const FEE_RAIL_META: Record<string, { color: string }> = {
  surge_split:          { color: "#00e5a0" },
  tempo_pathusd:        { color: "#818cf8" },
  base_usdc_x402:       { color: "#3b82f6" },
  stripe_application_fee: { color: "#6366f1" },
  deferred_rfq:         { color: "#f97316" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function RailBadge({ rail }: { rail: string }) {
  const m = RAIL_META[rail] ?? { color: "#888", label: rail, desc: "" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: `${m.color}18`, color: m.color,
      border: `1px solid ${m.color}30`
    }}>
      {m.label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    charged:      "#22c55e",
    failed:       "#ef4444",
    no_wallet:    "#eab308",
    logged_intent:"#818cf8",
    routing_off:  "#6b7280",
    free:         "#3b82f6",
  };
  const c = colors[status] ?? "#6b7280";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: c, fontWeight: 600 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block" }} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ── Weight Slider ──────────────────────────────────────────────────────────────

function WeightSlider({ rail, value, onChange }: {
  rail: string; value: number; onChange: (v: number) => void;
}) {
  const m = RAIL_META[rail] ?? { color: "#888", label: rail };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, display: "inline-block" }} />
          <span style={{ fontSize: 12, color: "#f0ebe3", fontWeight: 600 }}>{m.label}</span>
          <span style={{ fontSize: 10, color: "hsl(0 0% 40%)" }}>{m.desc}</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: m.color, minWidth: 24, textAlign: "right" }}>{value}</span>
      </div>
      <input
        type="range" min={0} max={20} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: m.color }}
      />
    </div>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────────

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)",
      borderRadius: 12, padding: 20, ...style
    }}>
      {children}
    </div>
  );
}

function SectionHead({ icon: Icon, title, sub }: {
  icon: React.ElementType; title: string; sub?: string
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid hsl(0 0% 14%)" }}>
      <Icon size={15} style={{ color: "#00e5a0" }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: "#f0ebe3", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
      {sub && <span style={{ fontSize: 11, color: "hsl(0 0% 40%)", marginLeft: 4 }}>{sub}</span>}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function RailRouterPage() {
  const [railData,  setRailData]  = useState<RailStatsData | null>(null);
  const [feeEvents, setFeeEvents] = useState<FeeEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState<string | null>(null);
  const [hours,     setHours]     = useState(24);
  const [err,       setErr]       = useState<string | null>(null);

  // Weight editor state
  const [weights, setWeights] = useState<RailWeights>({
    surge: 10, tempo: 7, base_usdc: 5, stripe: 3, sms: 2, rfq: 1
  });

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [rs, fe, al] = await Promise.all([
        fetch(`${RAILWAY}/api/local-intel/rail-stats?hours=${hours}`).then(r => r.json()).catch(() => null),
        fetch(`${RAILWAY}/api/local-intel/fee-events?hours=${hours}&limit=100`).then(r => r.json()).catch(() => ({ events: [] })),
        // Audit log from Postgres via admin endpoint
        fetch(`${RAILWAY}/api/local-intel/fee-events?hours=720&limit=5`).then(() => ({ rows: [] })).catch(() => ({ rows: [] })),
      ]);

      if (rs?.ok) {
        setRailData(rs);
        setWeights(rs.weights);
      }
      setFeeEvents(fe?.events ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "load error");
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => { load(); }, [load]);

  // Save weight changes
  const saveWeights = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`${RAILWAY}/api/local-intel/rail-weights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(weights),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSaveMsg(`Saved — runtime weights updated. Set RAIL_WEIGHT_* env vars in Railway to persist across deploys.`);
      await load();
    } catch (e) {
      setSaveMsg(`Error: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const railStats = railData?.stats ?? [];

  // Group by rail → aggregate
  const byRail: Record<string, { cnt: number; total_usd: number; statuses: string[] }> = {};
  for (const row of railStats) {
    if (!byRail[row.rail]) byRail[row.rail] = { cnt: 0, total_usd: 0, statuses: [] };
    byRail[row.rail].cnt       += parseInt(row.cnt, 10);
    byRail[row.rail].total_usd += parseFloat(row.total_usd);
    if (!byRail[row.rail].statuses.includes(row.status)) byRail[row.rail].statuses.push(row.status);
  }
  const railOrder = ["surge","tempo","base_usdc","stripe","sms","rfq"];
  const maxRailCnt = Math.max(...Object.values(byRail).map(r => r.cnt), 1);

  // Error events from fee_events
  const errorEvents  = feeEvents.filter(e => e.status === "failed");
  const noWalletEvts = feeEvents.filter(e => e.status === "no_wallet");
  const totalCharged = feeEvents.filter(e => e.status === "charged").reduce((s, e) => s + parseFloat(e.amount_usd || "0"), 0);

  // Rail events (have rail in meta)
  const railEvents = feeEvents.filter(e => (e.meta as Record<string,unknown>)?.rail);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px", background: "hsl(0 0% 4%)" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f0ebe3", display: "flex", alignItems: "center", gap: 10 }}>
            <GitBranch size={20} style={{ color: "#00e5a0" }} />
            Rail Router
          </h1>
          <p style={{ fontSize: 12, color: "hsl(0 0% 45%)", marginTop: 4 }}>
            OpenRouter-style payment rail selector — live routing stats, weight controls, Surge split audit
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            value={hours}
            onChange={e => setHours(Number(e.target.value))}
            style={{ fontSize: 12, background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 18%)", borderRadius: 8, padding: "6px 10px", color: "hsl(0 0% 70%)" }}
          >
            <option value={1}>1h</option>
            <option value={6}>6h</option>
            <option value={24}>24h</option>
            <option value={72}>3d</option>
            <option value={168}>7d</option>
          </select>
          <button
            onClick={load} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, fontSize: 12, background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 18%)", color: "hsl(0 0% 70%)", cursor: "pointer" }}
          >
            <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </div>

      {err && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "#ef444418", border: "1px solid #ef444430", color: "#ef4444", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <XCircle size={14} /> {err}
        </div>
      )}

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Charged",    value: `$${totalCharged.toFixed(4)}`,  icon: DollarSign,    color: "#00e5a0" },
          { label: "Rail Events",      value: String(railEvents.length),       icon: GitBranch,     color: "#818cf8" },
          { label: "Errors",           value: String(errorEvents.length),      icon: AlertTriangle, color: errorEvents.length > 0 ? "#ef4444" : "#6b7280" },
          { label: "No Wallet (acq.)", value: String(noWalletEvts.length),     icon: Wallet,        color: "#eab308" },
        ].map(k => (
          <Panel key={k.label}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${k.color}18`, border: `1px solid ${k.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <k.icon size={13} style={{ color: k.color }} />
              </div>
              <span style={{ fontSize: 10, color: "hsl(0 0% 45%)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#f0ebe3" }}>{loading ? "—" : k.value}</div>
          </Panel>
        ))}
      </div>

      {/* ── Rail distribution ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

        {/* Distribution bars */}
        <Panel>
          <SectionHead icon={BarChart2} title="Rail Distribution" sub={`last ${hours}h`} />
          {loading ? (
            <div style={{ color: "hsl(0 0% 40%)", fontSize: 12 }}>Loading…</div>
          ) : Object.keys(byRail).length === 0 ? (
            <div style={{ color: "hsl(0 0% 40%)", fontSize: 12, padding: "16px 0" }}>
              No routed events yet — will populate as RFQs confirm.
            </div>
          ) : (
            railOrder.map(rail => {
              const d = byRail[rail];
              if (!d) return null;
              const m = RAIL_META[rail] ?? { color: "#888", label: rail };
              const pct = maxRailCnt > 0 ? Math.min(100, (d.cnt / maxRailCnt) * 100) : 0;
              return (
                <div key={rail} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, display: "inline-block" }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#f0ebe3" }}>{m.label}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <span style={{ fontSize: 11, color: "hsl(0 0% 45%)" }}>{d.cnt} jobs</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: m.color }}>${d.total_usd.toFixed(4)}</span>
                    </div>
                  </div>
                  <div style={{ height: 5, borderRadius: 99, background: "hsl(0 0% 12%)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: m.color, borderRadius: 99 }} />
                  </div>
                </div>
              );
            })
          )}
        </Panel>

        {/* Fee destinations */}
        <Panel>
          <SectionHead icon={Wallet} title="Fee Destinations" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              {
                label: "Surge Split",
                desc:  "Base USDC · 1.5% of order",
                addr:  railData?.platform_split_address ?? process.env.NEXT_PUBLIC_SPLIT_ADDR ?? "0x1447612B…f30fa",
                color: "#00e5a0",
                rail:  "surge",
              },
              {
                label: "Tempo Treasury",
                desc:  "pathUSD · RFQ flat + 1.5%",
                addr:  railData?.tempo_treasury ?? "0x774f484…d32fea",
                color: "#818cf8",
                rail:  "tempo",
              },
            ].map(d => (
              <div key={d.label} style={{ padding: "12px 14px", borderRadius: 10, background: "hsl(0 0% 5%)", border: `1px solid ${d.color}20` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: d.color, marginBottom: 2 }}>{d.label}</div>
                    <div style={{ fontSize: 11, color: "hsl(0 0% 45%)" }}>{d.desc}</div>
                  </div>
                  <RailBadge rail={d.rail} />
                </div>
                <div style={{ fontSize: 10, fontFamily: "monospace", color: "hsl(0 0% 55%)", marginTop: 8, wordBreak: "break-all" }}>
                  {d.addr}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "hsl(0 0% 35%)", marginTop: 4 }}>
              Base USDC x402 agent queries also go to Surge split address.
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Weight controls ── */}
      <Panel style={{ marginBottom: 20 }}>
        <SectionHead icon={Zap} title="Rail Weights" sub="Adjust routing priority — higher = preferred" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
          {(["surge","tempo","base_usdc","stripe","sms","rfq"] as (keyof RailWeights)[]).map(rail => (
            <WeightSlider
              key={rail}
              rail={rail}
              value={weights[rail]}
              onChange={v => setWeights(w => ({ ...w, [rail]: v }))}
            />
          ))}
        </div>
        {saveMsg && (
          <div style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, marginBottom: 12,
            background: saveMsg.startsWith("Error") ? "#ef444418" : "#22c55e18",
            color: saveMsg.startsWith("Error") ? "#ef4444" : "#22c55e",
            border: `1px solid ${saveMsg.startsWith("Error") ? "#ef444430" : "#22c55e30"}`
          }}>
            {saveMsg}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={saveWeights} disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#00e5a0", color: "#000", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? <RefreshCw size={12} /> : <CheckCircle2 size={12} />}
            {saving ? "Saving…" : "Apply Weights"}
          </button>
          <span style={{ fontSize: 11, color: "hsl(0 0% 40%)" }}>
            Runtime only — set <code style={{ background: "hsl(0 0% 12%)", padding: "1px 5px", borderRadius: 4 }}>RAIL_WEIGHT_SURGE</code> etc. in Railway to persist
          </span>
        </div>
      </Panel>

      {/* ── Error + failure surface ── */}
      {errorEvents.length > 0 && (
        <Panel style={{ marginBottom: 20, border: "1px solid #ef444430" }}>
          <SectionHead icon={AlertTriangle} title={`Failed Charges (${errorEvents.length})`} />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}>
                  {["Business","Amount","Rail","Time","Error"].map(h => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "hsl(0 0% 45%)", fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {errorEvents.map(ev => (
                  <tr key={ev.id} style={{ borderBottom: "1px solid hsl(0 0% 10%)" }}>
                    <td style={{ padding: "6px 10px", color: "#f0ebe3" }}>{ev.business_name || ev.business_id?.slice(0, 8) || "—"}</td>
                    <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#ef4444" }}>${parseFloat(ev.amount_usd || "0").toFixed(4)}</td>
                    <td style={{ padding: "6px 10px" }}><RailBadge rail={String((ev.meta as Record<string,unknown>)?.rail ?? "rfq")} /></td>
                    <td style={{ padding: "6px 10px", color: "hsl(0 0% 45%)", fontSize: 11 }}>{ev.created_at ? new Date(ev.created_at).toLocaleTimeString() : "—"}</td>
                    <td style={{ padding: "6px 10px", color: "#ef4444", fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {String((ev.meta as Record<string,unknown>)?.error ?? "charge failed")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* ── High-volume Surge merchants ── */}
      <Panel style={{ marginBottom: 20 }}>
        <SectionHead icon={TrendingUp} title="Top Surge Merchants" sub="by fee volume" />
        {(() => {
          const surgeEvts = feeEvents.filter(e => (e.meta as Record<string,unknown>)?.rail === "surge" && e.status === "charged");
          const byBiz: Record<string, { name: string; cnt: number; total: number }> = {};
          for (const ev of surgeEvts) {
            const id = ev.business_id || "unknown";
            if (!byBiz[id]) byBiz[id] = { name: ev.business_name || id.slice(0,8), cnt: 0, total: 0 };
            byBiz[id].cnt++;
            byBiz[id].total += parseFloat(ev.amount_usd || "0");
          }
          const sorted = Object.entries(byBiz).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
          if (!sorted.length) return (
            <div style={{ fontSize: 12, color: "hsl(0 0% 40%)", padding: "12px 0" }}>
              No Surge-routed charged events yet in this window. Fees accumulate as RFQs confirm on Surge merchants.
            </div>
          );
          const maxTotal = sorted[0]?.[1]?.total ?? 1;
          return sorted.map(([id, d], i) => (
            <div key={id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "hsl(0 0% 40%)" }}>#{i + 1}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#f0ebe3" }}>{d.name}</span>
                  {d.cnt >= 5 && (
                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "#00e5a018", color: "#00e5a0", border: "1px solid #00e5a030", fontWeight: 600 }}>
                      high-volume
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontSize: 11, color: "hsl(0 0% 45%)" }}>{d.cnt} tx</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#00e5a0" }}>${d.total.toFixed(4)}</span>
                </div>
              </div>
              <div style={{ height: 4, borderRadius: 99, background: "hsl(0 0% 12%)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, (d.total / maxTotal) * 100)}%`, background: "#00e5a0", borderRadius: 99 }} />
              </div>
            </div>
          ));
        })()}
      </Panel>

      {/* ── Surge audit log ── */}
      <Panel style={{ marginBottom: 20 }}>
        <SectionHead icon={Shield} title="Surge Split Audit" sub="auto-runs on boot + weekly" />
        <div style={{ fontSize: 12, color: "hsl(0 0% 45%)", marginBottom: 12 }}>
          Ensures all Surge merchants have <code style={{ background: "hsl(0 0% 12%)", padding: "1px 5px", borderRadius: 4 }}>split_address</code> set in their <code style={{ background: "hsl(0 0% 12%)", padding: "1px 5px", borderRadius: 4 }}>pos_config</code>.
          Run <code style={{ background: "hsl(0 0% 12%)", padding: "1px 5px", borderRadius: 4 }}>SELECT * FROM surge_audit_log ORDER BY run_at DESC LIMIT 5</code> to inspect.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { label: "Surge Merchants Found", value: "—",  color: "#818cf8" },
            { label: "Patched This Run",       value: "—",  color: "#00e5a0" },
            { label: "Already Correct",        value: "—",  color: "#22c55e" },
            { label: "Errors",                 value: "—",  color: "#ef4444" },
          ].map(s => (
            <div key={s.label} style={{ padding: "12px", borderRadius: 8, background: "hsl(0 0% 5%)", border: "1px solid hsl(0 0% 12%)" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color, marginBottom: 2 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "hsl(0 0% 40%)" }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: "hsl(0 0% 35%)" }}>
          Split address: <span style={{ fontFamily: "monospace", color: "hsl(0 0% 55%)" }}>{railData?.platform_split_address || "0x1447612B…f30fa"}</span> · 1.5% · Base USDC
        </div>
      </Panel>

      {/* ── Rail event log ── */}
      <Panel>
        <SectionHead icon={Activity} title="Rail Event Log" sub={`last ${hours}h · ${railEvents.length} routed events`} />
        {loading ? (
          <div style={{ color: "hsl(0 0% 40%)", fontSize: 12 }}>Loading…</div>
        ) : !railEvents.length ? (
          <div style={{ color: "hsl(0 0% 40%)", fontSize: 12, padding: "16px 0" }}>
            No routed events yet — rail data populates as RFQs confirm.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}>
                  {["Business","Rail","Fee Rail","Amount","Status","Fee Dest","Time"].map(h => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "hsl(0 0% 45%)", fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {railEvents.slice(0, 50).map(ev => {
                  const meta = ev.meta as Record<string,unknown>;
                  const feeDest = String(meta?.fee_destination ?? "—");
                  return (
                    <tr key={ev.id} style={{ borderBottom: "1px solid hsl(0 0% 10%)" }}>
                      <td style={{ padding: "6px 10px", color: "#f0ebe3", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ev.business_name || ev.business_id?.slice(0, 8) || "—"}
                      </td>
                      <td style={{ padding: "6px 10px" }}><RailBadge rail={String(meta?.rail ?? "rfq")} /></td>
                      <td style={{ padding: "6px 10px" }}>
                        {(() => {
                          const fr = String(meta?.fee_rail ?? "—");
                          const c  = FEE_RAIL_META[fr]?.color ?? "#888";
                          return <span style={{ fontSize: 10, color: c, fontWeight: 600 }}>{fr.replace(/_/g, " ")}</span>;
                        })()}
                      </td>
                      <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#f0ebe3" }}>
                        ${parseFloat(ev.amount_usd || "0").toFixed(4)}
                      </td>
                      <td style={{ padding: "6px 10px" }}><StatusDot status={ev.status} /></td>
                      <td style={{ padding: "6px 10px", fontFamily: "monospace", fontSize: 10, color: "hsl(0 0% 50%)" }}>
                        {feeDest !== "—" ? feeDest.slice(0, 10) + "…" : "—"}
                      </td>
                      <td style={{ padding: "6px 10px", color: "hsl(0 0% 45%)", fontSize: 11, whiteSpace: "nowrap" }}>
                        {ev.created_at ? new Date(ev.created_at).toLocaleTimeString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

    </div>
  );
}
