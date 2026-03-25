"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Play, Save, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type { Agent } from "@/types";

function AgentDetailCard({ agent }: { agent: Agent }) {
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
                <p className="text-[10px] text-muted-foreground">Range: $0.002 – $0.25</p>
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
                <Input value={x402} onChange={e => setX402(e.target.value)} placeholder="https://gsb.bank/x402/..." className="h-8 text-xs mono bg-secondary border-border" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-1.5 text-xs h-8" onClick={save}>
                <Save size={12} /> Save Changes
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 hover:border-primary/50 hover:text-primary"
                onClick={() => { simulateJob(agent.id); toast.success(`${agent.shortName}: job simulated · +$${agent.pricePerJob.toFixed(4)} USDC`); }}
                disabled={!agent.enabled}
              >
                <Play size={11} /> Simulate Job
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

export default function AgentsPage() {
  const agents = useStore(s => s.agents);

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
          <span className="text-xl">💰</span>
          <div>
            <div className="font-semibold mb-0.5">GSB Micro-Pricing Strategy</div>
            <p className="text-muted-foreground">Keep per-job prices <strong className="text-foreground">$0.002–$0.25</strong> and subscriptions at <strong className="text-foreground">$2.99/month</strong>. Low friction = more volume = more USDC flowing to your GSB bank. Expand any card below to configure it, then click "ACP Registration Text" to get copy-paste text for <a href="https://app.virtuals.io/acp" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">app.virtuals.io/acp</a>.</p>
          </div>
        </div>

        {agents.map(a => <AgentDetailCard key={a.id} agent={a} />)}
      </main>
    </div>
  );
}
