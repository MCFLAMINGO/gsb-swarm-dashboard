"use client";

import { useState } from "react";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import {
  Settings, Bell, Wallet, Shield, RefreshCw, Trash2,
  ChevronDown, Moon, Monitor, Globe, Info, ExternalLink, Code2
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-start gap-3 pb-4 border-b border-border">
        <div className="p-2 rounded-lg" style={{ background: "hsl(4 85% 44% / 0.1)" }}>
          <Icon size={16} style={{ color: "hsl(4 85% 44%)" }} />
        </div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────
function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        )}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-secondary border border-border"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}

// ── Select row ────────────────────────────────────────────────────────────────
function SelectRow({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        )}
      </div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-secondary border border-border rounded-lg px-3 py-1.5 pr-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={12}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="border-t border-border" />;
}

// ── Main settings page ────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { agents, updateAgent } = useStore();

  // Dashboard preferences (local state — UI only, not persisted in store)
  const [notifications, setNotifications] = useState({
    jobAlert:   true,
    errorAlert: true,
    dailyReport: false,
    telegramAlert: true,
  });

  const [display, setDisplay] = useState({
    refreshInterval: "10",
    theme:           "dark",
    language:        "en",
    compactView:     false,
    showUSDC:        true,
    autoWithdraw:    false,
  });

  const [security, setSecurity] = useState({
    confirmWithdraws: true,
    confirmJobSim:    false,
    showPrivateKeys:  false,
  });

  // Reset store (all agents re-seed from defaults)
  const handleResetData = () => {
    if (!confirm("Reset all dashboard data to defaults? This will clear jobs, logs, and earnings.")) return;
    // Force store reset by reloading page (Zustand persist will rehydrate from defaults)
    localStorage.removeItem("gsb-swarm-storage");
    window.location.reload();
  };

  // Toggle all agents
  const handleToggleAllAgents = (enabled: boolean) => {
    agents.forEach((a) => {
      updateAgent(a.id, { enabled, status: enabled ? "idle" : "disabled" });
    });
    toast.success(enabled ? "All agents enabled" : "All agents disabled");
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-6 py-4">
        <div className="flex items-center gap-3">
          <Settings size={18} style={{ color: "hsl(4 85% 44%)" }} />
          <div>
            <h1 className="text-base font-bold">Settings</h1>
            <p className="text-xs text-muted-foreground">
              Dashboard preferences, notifications &amp; data management
            </p>
          </div>
        </div>
      </div>

      <main className="p-6 max-w-2xl space-y-6">

        {/* ── Notifications ─────────────────────────────────────────────────── */}
        <Section
          title="Notifications"
          description="Control which events trigger alerts in the dashboard"
          icon={Bell}
        >
          <ToggleRow
            label="New Job Alert"
            description="Toast notification when a new ACP job arrives"
            checked={notifications.jobAlert}
            onChange={(v) => {
              setNotifications((n) => ({ ...n, jobAlert: v }));
              toast.success(v ? "Job alerts enabled" : "Job alerts disabled");
            }}
          />
          <Divider />
          <ToggleRow
            label="Error Alert"
            description="Alert when an agent enters an error state"
            checked={notifications.errorAlert}
            onChange={(v) => {
              setNotifications((n) => ({ ...n, errorAlert: v }));
              toast.success(v ? "Error alerts enabled" : "Error alerts disabled");
            }}
          />
          <Divider />
          <ToggleRow
            label="Daily Earnings Report"
            description="Summarize earnings each day at midnight UTC"
            checked={notifications.dailyReport}
            onChange={(v) => {
              setNotifications((n) => ({ ...n, dailyReport: v }));
              toast.success(v ? "Daily reports enabled" : "Daily reports disabled");
            }}
          />
          <Divider />
          <ToggleRow
            label="Telegram Alerts"
            description="Forward critical events to your Telegram bot (requires token in API Connections)"
            checked={notifications.telegramAlert}
            onChange={(v) => {
              setNotifications((n) => ({ ...n, telegramAlert: v }));
              toast.success(v ? "Telegram alerts enabled" : "Telegram alerts disabled");
            }}
          />
        </Section>

        {/* ── Display ───────────────────────────────────────────────────────── */}
        <Section
          title="Display"
          description="Customize how the dashboard looks and updates"
          icon={Monitor}
        >
          <SelectRow
            label="Theme"
            description="Interface color theme"
            value={display.theme}
            options={[
              { value: "dark",  label: "Dark (Cyberpunk)" },
              { value: "darker", label: "Void (Pure Black)" },
            ]}
            onChange={(v) => {
              setDisplay((d) => ({ ...d, theme: v }));
              toast.info(`Theme: ${v} (full implementation coming soon)`);
            }}
          />
          <Divider />
          <SelectRow
            label="Auto-Refresh Interval"
            description="How often the jobs table refreshes"
            value={display.refreshInterval}
            options={[
              { value: "5",  label: "5 seconds" },
              { value: "10", label: "10 seconds" },
              { value: "30", label: "30 seconds" },
              { value: "60", label: "1 minute" },
              { value: "0",  label: "Manual only" },
            ]}
            onChange={(v) => {
              setDisplay((d) => ({ ...d, refreshInterval: v }));
              toast.success(`Refresh interval set to ${v === "0" ? "manual" : `${v}s`}`);
            }}
          />
          <Divider />
          <SelectRow
            label="Language"
            description="Dashboard interface language"
            value={display.language}
            options={[
              { value: "en", label: "English" },
              { value: "es", label: "Español (coming soon)" },
              { value: "fr", label: "Français (coming soon)" },
            ]}
            onChange={(v) => setDisplay((d) => ({ ...d, language: v }))}
          />
          <Divider />
          <ToggleRow
            label="Compact View"
            description="Reduce padding for more information density"
            checked={display.compactView}
            onChange={(v) => {
              setDisplay((d) => ({ ...d, compactView: v }));
              toast.info("Compact view toggle (full implementation coming soon)");
            }}
          />
          <Divider />
          <ToggleRow
            label="Show USDC Balances"
            description="Display exact USDC amounts (disable for privacy)"
            checked={display.showUSDC}
            onChange={(v) => setDisplay((d) => ({ ...d, showUSDC: v }))}
          />
        </Section>

        {/* ── Agents ────────────────────────────────────────────────────────── */}
        <Section
          title="Agent Control"
          description="Bulk enable/disable all broker agents at once"
          icon={Globe}
        >
          <div className="flex gap-3">
            <button
              onClick={() => handleToggleAllAgents(true)}
              className="flex-1 py-2 px-4 rounded-lg text-xs font-semibold border transition-colors hover:opacity-90"
              style={{
                background: "hsl(4 85% 44% / 0.15)",
                borderColor: "hsl(4 85% 44% / 0.4)",
                color: "hsl(4 85% 44%)",
              }}
            >
              Enable All Agents
            </button>
            <button
              onClick={() => handleToggleAllAgents(false)}
              className="flex-1 py-2 px-4 rounded-lg text-xs font-semibold border border-border bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            >
              Disable All Agents
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-background"
              >
                <div className="flex items-center gap-3">
                  <span className="text-base">{agent.icon}</span>
                  <div>
                    <div className="text-xs font-medium">{agent.shortName}</div>
                    <div className="text-[10px] text-muted-foreground">{agent.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      agent.status === "active"   ? "bg-green-500" :
                      agent.status === "idle"     ? "bg-yellow-500" :
                      agent.status === "error"    ? "bg-red-500" :
                                                    "bg-gray-500"
                    )}
                  />
                  <span className="text-[10px] text-muted-foreground capitalize">{agent.status}</span>
                  <button
                    role="switch"
                    aria-checked={agent.enabled}
                    onClick={() => {
                      const next = !agent.enabled;
                      updateAgent(agent.id, { enabled: next, status: next ? "idle" : "disabled" });
                      toast.success(`${agent.shortName} ${next ? "enabled" : "disabled"}`);
                    }}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                      agent.enabled ? "bg-primary" : "bg-secondary border border-border"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-3 w-3 rounded-full bg-white shadow transition-transform",
                        agent.enabled ? "translate-x-5" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Security ──────────────────────────────────────────────────────── */}
        <Section
          title="Security"
          description="Confirmation dialogs and sensitive data visibility"
          icon={Shield}
        >
          <ToggleRow
            label="Confirm Withdrawals"
            description="Show confirmation dialog before sending funds"
            checked={security.confirmWithdraws}
            onChange={(v) => setSecurity((s) => ({ ...s, confirmWithdraws: v }))}
          />
          <Divider />
          <ToggleRow
            label="Confirm Job Simulations"
            description="Prompt before running a simulated job"
            checked={security.confirmJobSim}
            onChange={(v) => setSecurity((s) => ({ ...s, confirmJobSim: v }))}
          />
          <Divider />
          <ToggleRow
            label="Show API Keys in Plain Text"
            description="Reveal masked keys in the API Connections page"
            checked={security.showPrivateKeys}
            onChange={(v) => {
              setSecurity((s) => ({ ...s, showPrivateKeys: v }));
              if (v) toast.warning("API keys visible — make sure no one is watching your screen");
            }}
          />
        </Section>

        {/* ── Auto-Withdraw ─────────────────────────────────────────────────── */}
        <Section
          title="Auto-Withdraw"
          description="Automatically sweep USDC earnings to your Base wallet"
          icon={Wallet}
        >
          <ToggleRow
            label="Enable Auto-Withdraw"
            description="When confirmed balance exceeds threshold, sweep to Base wallet automatically"
            checked={display.autoWithdraw}
            onChange={(v) => {
              setDisplay((d) => ({ ...d, autoWithdraw: v }));
              toast.info(v
                ? "Auto-withdraw enabled (configure wallet in API Connections)"
                : "Auto-withdraw disabled"
              );
            }}
          />
          <Divider />
          <div className="flex items-center justify-between py-2 opacity-60 pointer-events-none">
            <div>
              <div className="text-sm font-medium">Threshold</div>
              <div className="text-xs text-muted-foreground">Minimum balance before auto-sweep</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">USDC</span>
              <input
                type="number"
                defaultValue={50}
                disabled
                className="w-20 bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-center"
              />
            </div>
          </div>

          <div className="rounded-lg border p-3 mt-2"
            style={{ background: "hsl(32 95% 52% / 0.05)", borderColor: "hsl(32 95% 52% / 0.2)" }}>
            <div className="flex items-start gap-2">
              <Info size={13} className="text-accent mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Auto-withdraw requires a connected Base wallet address in{" "}
                <span className="text-foreground font-medium">API Connections → Wallet Address</span>.
                Full on-chain integration coming with real ACP backend.
              </p>
            </div>
          </div>
        </Section>

        {/* ── Data Management ───────────────────────────────────────────────── */}
        <Section
          title="Data Management"
          description="Clear or reset dashboard data stored in your browser"
          icon={Trash2}
        >
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-background">
              <RefreshCw size={15} className="text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Reset Dashboard Data</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Clears all jobs, earnings, logs, and API keys from localStorage.
                  Agents will be re-seeded with defaults. This cannot be undone.
                </div>
              </div>
              <button
                onClick={handleResetData}
                className="shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
                style={{
                  borderColor: "hsl(0 80% 50% / 0.4)",
                  color: "hsl(0 80% 50%)",
                  background: "hsl(0 80% 50% / 0.08)",
                }}
              >
                Reset
              </button>
            </div>

            <div className="rounded-lg border p-3"
              style={{ background: "hsl(4 85% 44% / 0.05)", borderColor: "hsl(4 85% 44% / 0.15)" }}>
              <div className="flex items-center gap-2">
                <Info size={12} style={{ color: "hsl(4 85% 44%)" }} className="shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  All data is stored locally in your browser (localStorage) using Zustand persist.
                  No server is required — everything runs client-side until you connect a real ACP backend.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── About ─────────────────────────────────────────────────────────── */}
        <Section
          title="About"
          description="GSB Broker Swarm Management Platform"
          icon={Info}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: "Version",    value: "1.0.0" },
                { label: "Framework",  value: "Next.js 15" },
                { label: "Network",    value: "Base (Mainnet)" },
                { label: "Protocol",   value: "Virtuals ACP" },
                { label: "Token",      value: "$GSB" },
                { label: "x402 Base",  value: "gsb.bank/x402" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center px-3 py-2 rounded-lg bg-secondary">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono text-[11px]">{value}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              <a
                href="https://app.virtuals.io/acp"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Globe size={12} />
                Virtuals ACP
                <ExternalLink size={10} />
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Code2 size={12} />
                GitHub
                <ExternalLink size={10} />
              </a>
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-[11px] text-muted-foreground text-center">
                Built with{" "}
                <a
                  href="https://www.perplexity.ai/computer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Perplexity Computer
                </a>
                {" "}— Next.js + Tailwind + shadcn/ui + Zustand
              </p>
            </div>
          </div>
        </Section>

      </main>
    </div>
  );
}
