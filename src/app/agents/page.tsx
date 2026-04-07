"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Play, Save, ChevronDown, ChevronUp, Copy, Check, Send, Loader2, Radio } from "lucide-react";
import { toast } from "sonner";
import type { Agent } from "@/types";
import { fetchAgentStatus } from "@/lib/railway";

// ── Types for live feed ─────────────────────────────────────────────────────
interface LiveJob {
  jobId: string;
  agentId: string;
  mission: string;
  status: string;
  result?: string;
  usdcEarned?: number;
  createdAt: string;
  completedAt?: string;
}

// ── Agent Detail Card (existing) ────────────────────────────────────────────
function AgentDetailCard({ agent, onDispatch }: { agent: Agent; onDispatch: (agentId: string) => void }) {
  const { updateAgent, simulateJob } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [price, setPrice] = useState(String(agent.pricePerJob));
  const [subPrice, setSubPrice] = useState(String(agent.subscriptionPrice));
  const [acpUrl, setAcpUrl] = useState(agent.acpJobUrl);
  const [x402, setX402] = useState(agent.x402Endpoint);
  const [copied, setCopied] = useState(false);

  const regText = `Name: ${agent.name}
Category: ${agent.acpCategory}
Description: ${agent.acpDescription}
Capabilities: ${agent.acpCapabilities.join(", ")}
ACP Job URL: ${acpUrl || "https://your-domain.com/api/webhook"}
Payment: $${agent.pricePerJob} USDC per job (x402 via ${agent.x402Endpoint})`;

  const copyReg = () => {
    navigator.clipboard?.writeText(regText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const save = () => {
    updateAgent(agent.id, {
      pricePerJob: parseFloat(price) || agent.pricePerJob,
      subscriptionPrice: parseFloat(subPrice) || agent.subscriptionPrice,
      acpJobUrl: acpUrl,
      x402Endpoint: x402,
    });
    toast.success(`${agent.shortName} settings saved`);
  };

  return (
    <TooltipProvider>
      <div className="agent-card rounded-lg border border-border bg-card">
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <span className="text-2xl">{agent.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">{agent.name}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{agent.role}</div>
          </div>
          {/* Enable toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{agent.enabled ? "Active" : "Off"}</span>
            <Switch
              checked={agent.enabled}
              onCheckedChange={v => updateAgent(agent.id, { enabled: v, status: v ? "idle" : "disabled" })}
              data-testid={`toggle-${agent.id}`}
            />
          </div>
          {/* Stats */}
          <div className="hidden sm:flex gap-3 text-center">
            <div>
              <div className="text-[10px] text-muted-foreground">Jobs</div>
              <div className="text-sm font-bold tabular">{agent.jobsCompleted}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Earned</div>
              <div className="text-sm font-bold tabular text-primary">${agent.totalEarned.toFixed(4)}</div>
            </div>
          </div>
          <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Expanded settings */}
        {expanded && (
          <div className="p-4 space-y-5">
            <p className="text-xs text-muted-foreground">{agent.description}</p>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Per-Job Price (USDC)</Label>
                <Input value={price} onChange={e => setPrice(e.target.value)} type="number" min="0.002" max="0.25" step="0.001" className="h-8 text-sm tabular bg-secondary border-border" data-testid={`input-price-${agent.id}`} />
                <p className="text-[10px] text-muted-foreground">Range: $0.002 - $0.25</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subscription/mo (USDC)</Label>
                <Input value={subPrice} onChange={e => setSubPrice(e.target.value)} type="number" min="0.99" max="9.99" step="0.01" className="h-8 text-sm tabular bg-secondary border-border" data-testid={`input-sub-${agent.id}`} />
                <p className="text-[10px] text-muted-foreground">Standard: $2.99/mo</p>
              </div>
            </div>

            {/* Endpoints */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">ACP Job URL (Virtuals)</Label>
                <Input value={acpUrl} onChange={e => setAcpUrl(e.target.value)} placeholder="https://app.virtuals.io/acp/..." className="h-8 text-xs mono bg-secondary border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">x402 Endpoint</Label>
                <Input value={x402} onChange={e => setX402(e.target.value)} placeholder="https://gsb-swarm-dashboard.vercel.app/x402/..." className="h-8 text-xs mono bg-secondary border-border" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-1.5 text-xs h-8" onClick={save}>
                <Save size={12} /> Save Changes
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 hover:border-primary/50 hover:text-primary"
                onClick={() => { simulateJob(agent.id); toast.success(`${agent.shortName}: job dispatched`); }}
                disabled={!agent.enabled}
              >
                <Play size={11} /> Simulate Job
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 hover:border-orange-400/50 hover:text-orange-400"
                onClick={() => onDispatch(agent.id)}
                disabled={!agent.enabled}
              >
                <Send size={11} /> Dispatch
              </Button>
            </div>

            {/* ACP Registration text */}
            <div className="rounded-md border border-border bg-secondary/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">ACP Registration Text</span>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2" onClick={copyReg}>
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
              <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap leading-relaxed mono">{regText}</pre>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ── Dispatch Modal ──────────────────────────────────────────────────────────
function DispatchModal({
  agentId,
  open,
  onOpenChange,
}: {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mission, setMission] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const agentNames: Record<string, string> = {
    oracle: "GSB Compute Oracle",
    preacher: "GSB Marketing Preacher",
    onboarding: "GSB Onboarding Broker",
    alert: "GSB Alert Manager",
    token_analyst: "Token Analyst",
    wallet_profiler: "Wallet Profiler",
    alpha_scanner: "Alpha Scanner",
    thread_writer: "Thread Writer",
    ceo: "GSB CEO",
  };

  const dispatch = async () => {
    if (!mission.trim()) return;
    setLoading(true);
    setResult(null);
    setJobId(null);

    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, mission: mission.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setResult(`Error: ${data.error}`);
        setLoading(false);
        return;
      }

      setJobId(data.jobId);
      toast.success(`Job dispatched: ${data.jobId}`);

      // Poll for result
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const jobRes = await fetch(`/api/jobs/${data.jobId}`);
          const job = await jobRes.json();
          if (job.status === "completed" || job.status === "failed") {
            clearInterval(poll);
            setResult(job.result || "No result returned");
            setLoading(false);
          } else if (attempts > 60) {
            clearInterval(poll);
            setResult("Timeout — job is still running. Check /api/jobs/" + data.jobId);
            setLoading(false);
          }
        } catch {
          // Keep polling
        }
      }, 1000);
    } catch (err) {
      setResult(`Network error: ${err instanceof Error ? err.message : "Unknown"}`);
      setLoading(false);
    }
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setMission("");
      setResult(null);
      setJobId(null);
      setLoading(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dispatch Mission</DialogTitle>
          <DialogDescription>
            Send a real mission to <strong>{agentNames[agentId] || agentId}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Mission</Label>
            <Textarea
              value={mission}
              onChange={e => setMission(e.target.value)}
              placeholder={
                agentId === "oracle" ? "Get a compute quote for running GPT-4 inference on Base..." :
                agentId === "preacher" ? "Write a viral X thread about $GSB hitting new ATH..." :
                agentId === "onboarding" ? "Write a cold email to a DeFi protocol founder about GSB..." :
                agentId === "alert" ? "Generate a $GSB price alert for Telegram and X..." :
                agentId === "token_analyst" ? "Analyze token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 on Base (USDC)..." :
                agentId === "wallet_profiler" ? "Profile wallet 0x6dA1A9793Ebe96975c240501A633ab8B3c83D14A on Base..." :
                agentId === "alpha_scanner" ? "Scan Base chain for alpha signals — new launches, whale moves..." :
                agentId === "thread_writer" ? "Write a thread about $GSB tokenized agents on Virtuals Protocol..." :
                "Enter a mission for this agent..."
              }
              className="text-sm bg-secondary border-border"
              rows={3}
              disabled={loading}
            />
          </div>

          {jobId && (
            <p className="text-[10px] text-muted-foreground font-mono">Job ID: {jobId}</p>
          )}

          {result && (
            <div className="rounded-md border border-border bg-secondary/40 p-3 max-h-64 overflow-y-auto">
              <pre className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{result}</pre>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={dispatch}
            disabled={loading || !mission.trim()}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {loading ? "Running..." : "Dispatch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Time ago helper ─────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Live Feed ───────────────────────────────────────────────────────────────
function LiveFeed() {
  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [loading, setLoading] = useState(true);

  const agentIcons: Record<string, string> = {
    oracle: "\u26A1",
    preacher: "\uD83D\uDCE2",
    onboarding: "\uD83D\uDE80",
    alert: "\uD83D\uDD14",
    token_analyst: "\uD83D\uDD2C",
    wallet_profiler: "\uD83D\uDC5B",
    alpha_scanner: "\uD83D\uDD0D",
    thread_writer: "\u270D\uFE0F",
    ceo: "\uD83D\uDC54",
  };

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/webhook/jobs");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const agentNames: Record<string, string> = {
    oracle: "Oracle",
    preacher: "Preacher",
    onboarding: "Onboarding",
    alert: "Alert",
    token_analyst: "Token Analyst",
    wallet_profiler: "Wallet Profiler",
    alpha_scanner: "Alpha Scanner",
    thread_writer: "Thread Writer",
    ceo: "CEO",
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Radio size={14} className="text-primary animate-pulse" />
          <span className="text-sm font-bold">Live Feed</span>
        </div>
        <p className="text-xs text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-primary" />
          <span className="text-sm font-bold">Live Feed</span>
          <span className="text-[10px] text-muted-foreground">Auto-refreshes every 30s</span>
        </div>
        <span className="text-[10px] text-muted-foreground tabular">{jobs.length} jobs</span>
      </div>

      {jobs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No jobs yet. Dispatch a mission to see it here.
        </p>
      ) : (
        <div className="space-y-1.5">
          {jobs.slice(0, 10).map(job => (
            <div key={job.jobId} className="flex items-start gap-2 p-2 rounded-md bg-secondary/30 hover:bg-secondary/50 transition-colors">
              <span className="text-sm mt-0.5">
                {agentIcons[job.agentId] || "\u2753"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{agentNames[job.agentId] || job.agentId}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    job.status === "completed" ? "bg-green-500/10 text-green-400" :
                    job.status === "failed" ? "bg-red-500/10 text-red-400" :
                    "bg-yellow-500/10 text-yellow-400"
                  }`}>
                    {job.status}
                  </span>
                  {job.usdcEarned != null && job.usdcEarned > 0 && (
                    <span className="text-[10px] text-primary font-semibold tabular">
                      +${job.usdcEarned.toFixed(4)}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {timeAgo(job.completedAt || job.createdAt)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {job.mission.slice(0, 60)}{job.mission.length > 60 ? "..." : ""}
                </p>
                {job.result && (
                  <p className="text-[10px] text-foreground/70 truncate mt-0.5">
                    {job.result.slice(0, 100)}{job.result.length > 100 ? "..." : ""}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const agents = useStore(s => s.agents);
  const updateAgent = useStore(s => s.updateAgent);
  const [dispatchAgent, setDispatchAgent] = useState<string | null>(null);

  // Pull live Railway job counts every 60s and reflect in agent cards
  useEffect(() => {
    const RAILWAY_ID_MAP: Record<string, string> = {
      token_analysis: "token_analyst",
      wallet_profile: "wallet_profiler",
      alpha_signals: "alpha_scanner",
      thread: "thread_writer",
    };

    const sync = async () => {
      const status = await fetchAgentStatus().catch(() => null);
      if (!status) return;
      status.workers.forEach(w => {
        const agentId = RAILWAY_ID_MAP[w.id];
        if (!agentId) return;
        updateAgent(agentId, {
          jobsCompleted: w.jobsCompleted,
          status: (w.status === "working" ? "active" : "idle") as "active" | "idle",
          lastActiveAt: w.lastJobAt || new Date().toISOString(),
        });
      });
    };

    sync();
    const interval = setInterval(sync, 60_000);
    return () => clearInterval(interval);
  }, [updateAgent]);

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Agents"
        subtitle="Configure, enable/disable, and test each broker agent"
      />
      <main className="p-5 space-y-4 max-w-4xl mx-auto">
        {/* Pricing reference */}
        <div className="rounded-md border px-4 py-3 text-xs flex items-start gap-3"
          style={{ background: "hsl(4 85% 44% / 0.06)", borderColor: "hsl(4 85% 44% / 0.2)", color: "hsl(30 15% 88%)" }}>
          <span className="text-xl">&#x1F4B0;</span>
          <div>
            <div className="font-semibold mb-0.5">GSB Micro-Pricing Strategy</div>
            <p className="text-muted-foreground">Keep per-job prices <strong className="text-foreground">$0.002-$0.25</strong> and subscriptions at <strong className="text-foreground">$2.99/month</strong>. Low friction = more volume = more USDC flowing to your GSB bank. Expand any card below to configure it, then click &quot;ACP Registration Text&quot; to get copy-paste text for <a href="https://app.virtuals.io/acp" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">app.virtuals.io/acp</a>.</p>
          </div>
        </div>

        {agents.map(a => (
          <AgentDetailCard key={a.id} agent={a} onDispatch={setDispatchAgent} />
        ))}

        {/* Live Feed */}
        <LiveFeed />

        {/* Dispatch Modal */}
        {dispatchAgent && (
          <DispatchModal
            agentId={dispatchAgent}
            open={!!dispatchAgent}
            onOpenChange={(open) => { if (!open) setDispatchAgent(null); }}
          />
        )}
      </main>
    </div>
  );
}
