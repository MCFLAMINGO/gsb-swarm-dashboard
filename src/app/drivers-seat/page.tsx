"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Send, Copy, Twitter, Bell, Zap, Bot, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

/* ── Types ─────────────────────────────────────────────────────────────── */

type AgentId = "oracle" | "preacher" | "alert" | "onboarding";

interface AgentDef {
  id: AgentId;
  label: string;
  icon: string;
  color: string;
  dotClass: string;
}

interface ChatMessage {
  role: "user" | "agent";
  agent: AgentId;
  text: string;
  ts: number;
}

interface OutputCard {
  id: string;
  agent: AgentId;
  text: string;
  ts: number;
}

interface JobRecord {
  ts: number;
  agent: AgentId;
  mission: string;
  result: string;
  usdc: number;
}

/* ── Constants ─────────────────────────────────────────────────────────── */

const AGENTS: AgentDef[] = [
  { id: "oracle",     label: "Oracle",     icon: "⚡", color: "hsl(196 60% 50%)",  dotClass: "bg-blue-500" },
  { id: "preacher",   label: "Preacher",   icon: "📢", color: "hsl(32 95% 52%)",   dotClass: "bg-orange-500" },
  { id: "alert",      label: "Alert",      icon: "🔔", color: "hsl(0 80% 50%)",    dotClass: "bg-red-500" },
  { id: "onboarding", label: "Onboarding", icon: "🚀", color: "hsl(145 60% 42%)",  dotClass: "bg-green-500" },
];

const HISTORY_KEY = "gsb_job_history";
const SWARM_STATUS_URL = "https://gsb-swarm-production.up.railway.app/api/resource/swarm_status";

function loadHistory(): JobRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(h: JobRecord[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function DriversSeat() {
  const [selected, setSelected] = useState<AgentId>("oracle");
  const [input, setInput] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [outputs, setOutputs] = useState<OutputCard[]>([]);
  const [history, setHistory] = useState<JobRecord[]>([]);
  const [sending, setSending] = useState(false);
  const [jobsFired, setJobsFired] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => { setHistory(loadHistory()); }, []);

  // Poll swarm status
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(SWARM_STATUS_URL);
        if (res.ok) {
          const data = await res.json();
          if (active) setJobsFired(data.jobs_fired ?? data.jobsFired ?? null);
        }
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => { active = false; clearInterval(id); };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const fire = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { role: "user", agent: selected, text, ts: Date.now() };
    setChat(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dispatch-secret": "gsb-dispatch-2026",
        },
        body: JSON.stringify({ agentId: selected, mission: text }),
      });
      const data = await res.json();

      // The dispatch API returns 202 with jobId — we show acceptance
      const resultText = data.result
        ?? `Job accepted: ${data.jobId ?? "unknown"}\nStatus: ${data.status ?? "accepted"}`;
      const usdc = data.usdcEarned ?? 0;

      const agentMsg: ChatMessage = { role: "agent", agent: selected, text: resultText, ts: Date.now() };
      setChat(prev => [...prev, agentMsg]);

      // Add to output feed
      setOutputs(prev => [
        { id: `out_${Date.now()}`, agent: selected, text: resultText, ts: Date.now() },
        ...prev,
      ]);

      // Save to history
      const record: JobRecord = { ts: Date.now(), agent: selected, mission: text, result: resultText, usdc };
      setHistory(prev => {
        const next = [record, ...prev].slice(0, 20);
        saveHistory(next);
        return next;
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Network error";
      const agentMsg: ChatMessage = { role: "agent", agent: selected, text: `Error: ${errMsg}`, ts: Date.now() };
      setChat(prev => [...prev, agentMsg]);
    } finally {
      setSending(false);
    }
  }, [input, selected, sending]);

  const copyText = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Copied to clipboard");
  };

  const postToX = (t: string) => {
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(t.slice(0, 280))}`, "_blank");
  };

  const sendTelegram = (t: string) => {
    toast.info("Telegram delivery triggered", { description: t.slice(0, 80) + "…" });
  };

  const dismissOutput = (id: string) => {
    setOutputs(prev => prev.filter(o => o.id !== id));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
    toast.success("History cleared");
  };

  const agentDef = AGENTS.find(a => a.id === selected)!;
  const hasXContent = (text: string) =>
    selected === "preacher" || text.includes("#") || text.includes("$GSB");

  return (
    <>
      <Header title="The Driver's Seat" subtitle="Operator console — fire jobs, see output live" />

      <main className="flex-1 overflow-hidden p-4">
        <div className="flex flex-col lg:flex-row gap-4 h-full">

          {/* ── LEFT: Agent Selector ──────────────────────────────── */}
          <div className="w-full lg:w-[240px] shrink-0">
            <Card className="p-3 h-full">
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 px-1">
                Agents
              </h3>
              <div className="space-y-1">
                {AGENTS.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                      selected === a.id
                        ? "bg-primary/10 text-foreground border border-primary/25"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${a.dotClass}`} />
                    <span className="text-base">{a.icon}</span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* ── CENTER: Chat + Output Feed ────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">

            {/* Chat area */}
            <Card className="flex-1 min-h-0 flex flex-col p-4">
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                <Bot size={14} />
                Chat — {agentDef.label}
              </h3>
              <Separator className="mb-3" />

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-[120px]">
                {chat.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    Select an agent and fire a mission.
                  </p>
                )}
                {chat.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary/15 text-foreground border border-primary/20"
                          : "bg-secondary text-foreground border border-border"
                      }`}
                    >
                      {msg.role === "agent" && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                          {AGENTS.find(a => a.id === msg.agent)?.icon} {msg.agent}
                        </span>
                      )}
                      {msg.text}
                      {msg.role === "agent" && hasXContent(msg.text) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7 text-xs border-green-600/40 text-green-400 hover:bg-green-600/10"
                          onClick={() => postToX(msg.text)}
                        >
                          <Twitter size={12} className="mr-1" /> Post to X
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-secondary border border-border rounded-lg px-4 py-2 text-sm text-muted-foreground">
                      <span className="inline-flex gap-1">
                        <span className="animate-bounce">●</span>
                        <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>●</span>
                        <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>●</span>
                      </span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      fire();
                    }
                  }}
                  placeholder="Tell your agent what to do..."
                  className="resize-none min-h-[56px] max-h-[120px] bg-secondary border-border"
                  rows={2}
                />
                <Button
                  onClick={fire}
                  disabled={!input.trim() || sending}
                  className="h-auto px-5 bg-primary hover:bg-primary/80"
                >
                  <Zap size={16} className="mr-1" />
                  Fire
                </Button>
              </div>
            </Card>

            {/* Live output feed */}
            <Card className="max-h-[260px] min-h-[140px] overflow-y-auto p-4">
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                <TrendingUp size={14} />
                Live Output Feed
              </h3>
              <Separator className="mb-3" />
              {outputs.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  No outputs yet. Fire a job above.
                </p>
              ) : (
                <div className="space-y-2">
                  {outputs.map(o => {
                    const a = AGENTS.find(x => x.id === o.agent)!;
                    return (
                      <div key={o.id} className="flex items-start gap-3 p-2 rounded-md bg-secondary/50 border border-border/50">
                        <span className="text-lg shrink-0 mt-0.5">{a.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold" style={{ color: a.color }}>{a.label}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(o.ts).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/80 line-clamp-3 whitespace-pre-wrap">
                            {o.text}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyText(o.text)} title="Copy">
                            <Copy size={12} />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => postToX(o.text)} title="Post to X">
                            <Twitter size={12} />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => sendTelegram(o.text)} title="Send Telegram">
                            <Bell size={12} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => dismissOutput(o.id)}
                            title="Dismiss"
                          >
                            ✕
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* ── RIGHT: Tabs — History + bleeding.cash ──────────── */}
          <div className="w-full lg:w-[300px] shrink-0">
            <Card className="p-3 h-full flex flex-col">
              <Tabs defaultValue="history">
                <TabsList className="w-full">
                  <TabsTrigger value="history" className="flex-1 text-xs">History</TabsTrigger>
                  <TabsTrigger value="bleeding" className="flex-1 text-xs">bleeding.cash</TabsTrigger>
                </TabsList>

                {/* History tab */}
                <TabsContent value="history" className="mt-3 flex-1 min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Last 20 jobs</span>
                    {history.length > 0 && (
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground" onClick={clearHistory}>
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                    {history.length === 0 ? (
                      <p className="text-muted-foreground text-xs text-center py-6">No jobs yet.</p>
                    ) : (
                      history.map((j, i) => (
                        <div key={i} className="p-2 rounded bg-secondary/50 border border-border/50">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs">{AGENTS.find(a => a.id === j.agent)?.icon}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(j.ts).toLocaleTimeString()}
                            </span>
                            {j.usdc > 0 && (
                              <Badge variant="outline" className="ml-auto h-4 text-[9px] border-green-600/40 text-green-400">
                                +${j.usdc.toFixed(4)}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-foreground/70 truncate">{j.mission}</p>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{j.result}</p>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* bleeding.cash tab */}
                <TabsContent value="bleeding" className="mt-3">
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border/50 text-center">
                      <span className="text-2xl">🩸</span>
                      <h4 className="text-sm font-bold mt-2">Restaurant Financial Triage Service</h4>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        AI-powered financial triage for bleeding restaurants
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 h-8 text-xs"
                        onClick={() => window.open("https://bleeding.cash", "_blank")}
                      >
                        Visit bleeding.cash
                      </Button>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded bg-secondary/50 border border-border/50">
                        <span className="text-xs text-muted-foreground">Jobs fired</span>
                        <span className="text-sm font-bold text-foreground">
                          {jobsFired !== null ? jobsFired : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded bg-secondary/50 border border-border/50">
                        <span className="text-xs text-muted-foreground">Est. revenue</span>
                        <span className="text-sm font-bold text-green-400">
                          {jobsFired !== null ? `$${(jobsFired * 0.05).toFixed(2)}` : "—"}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center">
                        Polling swarm status every 30s
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>

        </div>
      </main>
    </>
  );
}
// Driver's Seat deployed Thu Apr  2 15:25:04 UTC 2026
