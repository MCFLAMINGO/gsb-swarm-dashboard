"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { useStore } from "@/store/useStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Save, CheckCircle2, Circle, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import type { ApiConnection } from "@/types";

const CATEGORY_META: Record<string, { label: string; color: string; description: string }> = {
  telegram: { label: "Telegram",       color: "bg-blue-500/10 text-blue-400 border-blue-500/25",    description: "Connect your Telegram bot for alerts and notifications from the Alert Manager agent." },
  x:        { label: "X (Twitter)",    color: "bg-sky-500/10 text-sky-400 border-sky-500/25",       description: "X API v2 keys for the Marketing Preacher to post viral threads and $GSB promotions." },
  x402:     { label: "x402 Protocol",  color: "bg-primary/10 text-primary border-primary/25",       description: "x402 payment URL pointing to your GSB tokenized compute bank on Base network." },
  wallet:   { label: "Wallet",         color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25", description: "Base wallet addresses for USDC withdrawals and GSB bank forwarding." },
  acp:      { label: "ACP / Virtuals", color: "bg-purple-500/10 text-purple-400 border-purple-500/25", description: "Virtuals Protocol ACP webhook signing secret and job notification credentials." },
  virtuals: { label: "Virtuals API",   color: "bg-green-500/10 text-green-400 border-green-500/25", description: "Your Virtuals Protocol API key from app.virtuals.io for programmatic access." },
};

function ConnectionField({ conn, onSave }: { conn: ApiConnection & { hasValue: boolean }; onSave: (key: string, value: string) => void }) {
  const [val, setVal] = useState("");
  const [editing, setEditing] = useState(false);

  const type = conn.isSecret && !editing ? "password" : "text";

  return (
    <TooltipProvider>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            {conn.label}
            {conn.hasValue
              ? <CheckCircle2 size={11} className="text-primary" />
              : <Circle size={11} className="text-muted-foreground" />
            }
            <Tooltip>
              <TooltipTrigger><Info size={10} className="text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-[220px] text-xs">{conn.description}</TooltipContent>
            </Tooltip>
          </Label>
          {conn.hasValue && !editing && (
            <Button variant="ghost" size="sm" className="text-[10px] h-5 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(true)}>Update</Button>
          )}
        </div>

        {editing || !conn.hasValue ? (
          <div className="flex gap-2">
            <Input
              value={val}
              onChange={e => setVal(e.target.value)}
              placeholder={conn.placeholder}
              type={type}
              className="h-8 text-xs mono bg-secondary border-border"
              data-testid={`input-${conn.key}`}
            />
            <Button size="sm" className="h-8 px-3 gap-1 text-xs shrink-0"
              disabled={!val.trim()}
              onClick={() => { onSave(conn.key, val); setEditing(false); setVal(""); }}
              data-testid={`btn-save-${conn.key}`}
            >
              <Save size={11} /> Save
            </Button>
            {editing && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs"
                onClick={() => { setEditing(false); setVal(""); }}>✕</Button>
            )}
          </div>
        ) : (
          <div className="h-8 flex items-center px-3 rounded-md bg-secondary border border-border text-xs mono text-muted-foreground">
            {conn.isSecret ? "••••••••" : conn.value}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default function ConnectionsPage() {
  const { connections, updateConnection } = useStore();

  const withFlags = connections.map(c => ({ ...c, hasValue: c.value !== "" }));
  const configured = withFlags.filter(c => c.hasValue).length;

  const grouped = Object.keys(CATEGORY_META).map(cat => ({
    category: cat,
    meta: CATEGORY_META[cat],
    fields: withFlags.filter(c => c.category === cat),
  })).filter(g => g.fields.length > 0);

  const handleSave = (key: string, value: string) => {
    updateConnection(key, value);
    toast.success("Saved", { description: `${key} updated successfully` });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="API Connections"
        subtitle="Paste your keys and endpoints here. Stored in local storage — use env vars for production."
      />
      <main className="p-5 space-y-5 max-w-3xl mx-auto">
        {/* Progress header */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Configure your connections to enable the full swarm. Each section powers a different agent.
          </p>
          <Badge className="bg-primary/10 text-primary border-primary/25 text-xs shrink-0">
            {configured} / {connections.length} configured
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(configured / connections.length) * 100}%`, background: "hsl(4 85% 44%)" }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {configured === connections.length
              ? "All connections configured — swarm is fully armed."
              : `${connections.length - configured} remaining.`}
          </p>
        </div>

        {/* Category sections */}
        {grouped.map(({ category, meta, fields }) => {
          const done = fields.filter(f => f.hasValue).length;
          return (
            <div key={category} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] ${meta.color}`}>{meta.label}</Badge>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{done}/{fields.length}</span>
              </div>
              <div className="p-4 space-y-4">
                {fields.map(conn => (
                  <ConnectionField key={conn.key} conn={conn} onSave={handleSave} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Webhook info */}
        <div className="rounded-lg border p-4 space-y-2"
          style={{ background: "hsl(4 85% 44% / 0.05)", borderColor: "hsl(4 85% 44% / 0.2)" }}>
          <div className="flex items-start gap-2">
            <Info size={14} className="text-primary mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">ACP Webhook URL</p>
              <p className="text-xs text-muted-foreground">
                Once deployed, point your Virtuals ACP job notifications here:
              </p>
              <code className="block bg-secondary rounded px-3 py-2 text-xs mono text-primary">
                https://your-domain.vercel.app/api/webhook
              </code>
              <p className="text-xs text-muted-foreground">
                Each POST auto-tracks USDC and updates your earnings balance.
              </p>
              <a href="https://app.virtuals.io/acp" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Open Virtuals ACP <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
