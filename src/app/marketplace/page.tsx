"use client";

import { useState, useEffect } from "react";
import {
  ExternalLink, Star, Zap, Clock, CheckCircle2, AlertTriangle,
  BarChart3, Globe, Eye, Coins, TrendingDown, FlaskConical, ShieldCheck,
  ArrowRight, RefreshCw, UploadCloud
} from "lucide-react";

const RAILWAY_URL = "https://gsb-swarm-production.up.railway.app";
const VIRTUALS_BROWSE = "https://app.virtuals.io/acp";

// ── ACP agent identities on Virtuals ─────────────────────────────────────────
const AGENTS = [
  {
    id: "token-analyst",
    virtuals_id: "019d756b-0217-7252-8094-7854afde1703",
    name: "GSB Token Analyst",
    tagline: "On-chain token intelligence — price, liquidity, whale tracking",
    icon: BarChart3,
    color: "hsl(38 95% 55%)",
    colorClass: "text-yellow-400",
    borderClass: "border-yellow-400/25",
    bgClass: "bg-yellow-400/5",
    skills: [
      { id: "analyze_token",       name: "Token Analysis",       price: "$0.10", sla: "~30s",  desc: "Price, 24h change, liquidity, volume, market cap, buy/hold/avoid verdict" },
      { id: "track_whale_wallets", name: "Whale Tracker",        price: "$0.15", sla: "~45s",  desc: "Top 10 holders with wallet class (whale/smart money/retail/bot) and last activity" },
      { id: "monitor_liquidity",   name: "Liquidity Monitor",    price: "$0.12", sla: "~30s",  desc: "Pool health, 24h liquidity change, LP distribution, rug risk score" },
      { id: "job_receipt",         name: "Job Receipt",          price: "$0.02", sla: "~5s",   desc: "Verifiable on-chain receipt for any completed analysis job" },
    ],
    chains: ["Base", "Ethereum", "Arbitrum", "Polygon", "BSC", "Avalanche", "Optimism", "Solana"],
    earning: "$0.10–$0.15/job",
  },
  {
    id: "alpha-scanner",
    virtuals_id: "019d755e-dfd0-7b6c-8b4c-21cfbe6fda1c",
    name: "GSB Alpha Scanner",
    tagline: "Early signal detection — trending tokens, new launches, volume spikes",
    icon: Globe,
    color: "hsl(200 85% 55%)",
    colorClass: "text-blue-400",
    borderClass: "border-blue-400/25",
    bgClass: "bg-blue-400/5",
    skills: [
      { id: "scan_trending",          name: "Trending Scan",       price: "$0.10", sla: "~45s",  desc: "Top 5 trending tokens by volume with momentum reasoning" },
      { id: "find_new_launches",      name: "New Launch Finder",   price: "$0.12", sla: "~60s",  desc: "Newly launched tokens in last 24h with strong early signals" },
      { id: "detect_volume_spikes",   name: "Volume Spike Detect", price: "$0.12", sla: "~30s",  desc: "Tokens with unusual volume spikes in the last hour" },
      { id: "watch_deployer_wallets", name: "Deployer Watcher",    price: "$0.20", sla: "~60s",  desc: "Track known deployer wallets — detect when they fund new contracts" },
      { id: "detect_preliquidity",    name: "Pre-Liquidity Scan",  price: "$0.25", sla: "~90s",  desc: "Tokens where liquidity is being staged but pair isn't public yet" },
    ],
    chains: ["Base", "Ethereum", "Arbitrum", "Polygon", "BSC", "Avalanche", "Optimism", "Solana"],
    earning: "$0.10–$0.25/job",
  },
  {
    id: "thread-writer",
    virtuals_id: "019d7565-5b56-778e-8550-66ec4b179a81",
    name: "GSB Thread Writer",
    tagline: "Crypto content agent — threads, reports, market updates",
    icon: Globe,
    color: "hsl(280 70% 60%)",
    colorClass: "text-purple-400",
    borderClass: "border-purple-400/25",
    bgClass: "bg-purple-400/5",
    skills: [
      { id: "write_thread",       name: "Twitter Thread",       price: "$0.10", sla: "~60s",  desc: "Engaging crypto thread about any topic or token" },
      { id: "write_alpha_report", name: "Alpha Report",         price: "$0.15", sla: "~90s",  desc: "Formatted alpha report with on-chain data for any opportunity" },
      { id: "write_market_update",name: "Market Update",        price: "$0.10", sla: "~45s",  desc: "Summarize current market conditions into a shareable post" },
      { id: "token_intel_report", name: "Full Intel Report",    price: "$0.25", sla: "~2min", desc: "Research a token across X and on-chain, then write and post the thread" },
    ],
    chains: ["Any"],
    earning: "$0.10–$0.25/job",
  },
  {
    id: "wallet-profiler",
    virtuals_id: "019d756c-9eba-7600-81ba-f1c78f43277c",
    name: "GSB Wallet Profiler & DCA Engine",
    tagline: "Wallet intelligence + automated DCA buying on Base",
    icon: TrendingDown,
    color: "hsl(160 60% 45%)",
    colorClass: "text-teal-400",
    borderClass: "border-teal-400/25",
    bgClass: "bg-teal-400/5",
    skills: [
      { id: "profile_wallet",        name: "Wallet Profile",      price: "$0.10", sla: "~45s",  desc: "Full tx history, holdings, wallet classification across EVM + Solana" },
      { id: "detect_smart_money",    name: "Smart Money Detect",  price: "$0.20", sla: "~60s",  desc: "Smart money classification based on win rate and PnL" },
      { id: "track_wallet_activity", name: "Activity Tracker",    price: "$0.12", sla: "~30s",  desc: "Recent transactions flagging notable moves" },
      { id: "dca_buy",               name: "DCA Execute",         price: "$0.25", sla: "~2min", desc: "Execute a DCA buy on Base via Uniswap v3 — swap USDC for any token" },
    ],
    chains: ["Base", "Ethereum", "Arbitrum", "Solana"],
    earning: "$0.10–$0.25/job",
  },
  {
    id: "ceo",
    virtuals_id: "019d7568-cd41-7523-9538-e501cc1875cc",
    name: "GSB CEO Agent",
    tagline: "Orchestrator — routes complex multi-step jobs across the whole swarm",
    icon: Zap,
    color: "hsl(4 85% 44%)",
    colorClass: "text-primary",
    borderClass: "border-primary/25",
    bgClass: "bg-primary/5",
    skills: [
      { id: "daily_brief",        name: "Daily Intelligence Brief", price: "$0.50", sla: "~3min", desc: "All 4 workers run in parallel — CEO synthesizes a full morning brief" },
      { id: "token_deep_dive",    name: "Token Deep Dive",          price: "$0.35", sla: "~2min", desc: "Token Analyst + Wallet Profiler in parallel, CEO synthesizes" },
      { id: "social_blast",       name: "Social Blast",             price: "$0.35", sla: "~2min", desc: "Scan alpha → write thread → coordinate X post via CEO" },
      { id: "swarm_task",         name: "Natural Language Task",    price: "$0.35", sla: "~2min", desc: "Describe what you need — CEO routes it to the right agent automatically" },
      { id: "financial_triage",   name: "Restaurant Triage",        price: "$24.95", sla: "~60s", desc: "Bank statements + POS export → burn rate report + vendor + loan letters" },
      { id: "bank_status_report", name: "Bank Status Report",       price: "$0.05", sla: "~5s",  desc: "Instant worker load, jobs served, active clients" },
    ],
    chains: ["Any"],
    earning: "$0.05–$24.95/job",
  },
  {
    id: "throw-watcher",
    virtuals_id: null, // ACP Resource, not agent
    name: "THROW Watcher (Data Feed)",
    tagline: "Live Tempo chain surveillance — pay per query via x402 micropayment",
    icon: Eye,
    color: "hsl(220 70% 60%)",
    colorClass: "text-indigo-400",
    borderClass: "border-indigo-400/25",
    bgClass: "bg-indigo-400/5",
    skills: [
      { id: "transfers",  name: "Transfer Feed",    price: "~$0.001/call", sla: "Instant", desc: "All Tempo chain transfers in real time" },
      { id: "bets",       name: "Bet Signal Feed",  price: "~$0.001/call", sla: "Instant", desc: "THROW poker events — opens, calls, raises, payouts" },
      { id: "wallets",    name: "Wallet Activity",  price: "~$0.002/call", sla: "Instant", desc: "Specific address activity with event history" },
      { id: "patterns",   name: "Pattern Scan",     price: "~$0.005/call", sla: "~5s",    desc: "Volume/frequency anomaly detection across all Tempo activity" },
    ],
    chains: ["Tempo Mainnet"],
    earning: "x402 micropayment per call",
    isResource: true,
  },
  {
    id: "playwright",
    virtuals_id: null, // internal service
    name: "Playwright UI Testing Agents",
    tagline: "5 browser agents that test your app like real users — Playwright-powered",
    icon: FlaskConical,
    color: "hsl(4 85% 44%)",
    colorClass: "text-red-400",
    borderClass: "border-red-400/25",
    bgClass: "bg-red-400/5",
    skills: [
      { id: "W1", name: "Auth Worker",    price: "Per suite", sla: "~30s",  desc: "Wallet inject, E2E role switcher — tests real login flows" },
      { id: "W2", name: "Nav Worker",     price: "Per suite", sla: "~60s",  desc: "Walks all screens, checks that each one renders correctly" },
      { id: "W3", name: "Button Worker",  price: "Per suite", sla: "~90s",  desc: "Taps every visible button, records outcome vs expectation" },
      { id: "W4", name: "Form Worker",    price: "Per suite", sla: "~60s",  desc: "Empty submit validation + fill test on all forms" },
      { id: "W5", name: "Signal Worker",  price: "Per suite", sla: "~45s",  desc: "MQTT roundtrip for THROW, Supabase network checks for others" },
    ],
    chains: ["Any web app"],
    earning: "Per test suite",
    isInternal: true,
  },
];

type SkillStatus = { [key: string]: { status: string; successRate: string; avgMs: number | null; confidenceScore: number } };

export default function MarketplacePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [skillStatuses, setSkillStatuses] = useState<SkillStatus>({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchSkillReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${RAILWAY_URL}/api/skill-report`);
      if (res.ok) {
        const data = await res.json();
        const map: SkillStatus = {};
        for (const s of (data.skills || [])) {
          map[`${s.agentName}::${s.skillId}`] = s;
        }
        setSkillStatuses(map);
      }
    } catch {}
    setLoading(false);
  };

  const syncAcp = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const secret = process.env.NEXT_PUBLIC_OPERATOR_SECRET || "";
      const res = await fetch(`${RAILWAY_URL}/api/acp-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      setSyncResult(
        data.ok
          ? { ok: true,  msg: `Synced in ${data.elapsed}` }
          : { ok: false, msg: data.error || "Sync failed" }
      );
    } catch (e: unknown) {
      setSyncResult({ ok: false, msg: e instanceof Error ? e.message : "Network error" });
    }
    setSyncing(false);
    setTimeout(() => setSyncResult(null), 8000);
  };

  useEffect(() => { fetchSkillReport(); }, []);

  const selectedAgent = AGENTS.find(a => a.id === selected) || null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="border-b border-border px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Agent Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Hire any agent for a one-time job via{" "}
            <a href={VIRTUALS_BROWSE} target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline">Virtuals ACP</a>
            {" "}· Live skill confidence scores from Railway
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncResult && (
            <span className={`text-xs font-medium px-2 py-1 rounded-md ${
              syncResult.ok ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
            }`}>
              {syncResult.ok ? "✓" : "✗"} {syncResult.msg}
            </span>
          )}
          <button onClick={syncAcp} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs text-muted-foreground hover:text-foreground transition-all disabled:opacity-40">
            <UploadCloud className={`w-3 h-3 ${syncing ? "animate-pulse" : ""}`} />
            {syncing ? "Syncing..." : "Sync ACP"}
          </button>
          <button onClick={fetchSkillReport} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs text-muted-foreground hover:text-foreground transition-all disabled:opacity-40">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-120px)]">
        {/* Agent list */}
        <div className="w-72 shrink-0 border-r border-border overflow-y-auto p-3 space-y-2">
          {AGENTS.map(agent => (
            <button key={agent.id} onClick={() => setSelected(agent.id === selected ? null : agent.id)}
              className={`w-full text-left rounded-xl border p-3 transition-all ${
                selected === agent.id
                  ? `${agent.borderClass} ${agent.bgClass}`
                  : "border-border hover:border-border/80 hover:bg-secondary/50"
              }`}>
              <div className="flex items-center gap-2 mb-1">
                <agent.icon className={`w-4 h-4 shrink-0 ${agent.colorClass}`} />
                <span className="text-sm font-semibold leading-tight">{agent.name}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">{agent.tagline}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-mono text-muted-foreground/60">
                  {agent.skills.length} skills
                </span>
                <span className="text-[10px] font-mono" style={{ color: agent.color }}>
                  {agent.earning}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Agent detail panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedAgent ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <Zap className="w-10 h-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Select an agent to see its skills, live confidence scores, and hire link</p>
            </div>
          ) : (
            <div className="max-w-2xl space-y-6">
              {/* Agent header */}
              <div className={`rounded-xl border ${selectedAgent.borderClass} ${selectedAgent.bgClass} p-5`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center border"
                      style={{ borderColor: selectedAgent.color + "40", background: selectedAgent.color + "15" }}>
                      <selectedAgent.icon className={`w-5 h-5 ${selectedAgent.colorClass}`} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold">{selectedAgent.name}</h2>
                      <p className="text-xs text-muted-foreground">{selectedAgent.tagline}</p>
                    </div>
                  </div>
                  {selectedAgent.virtuals_id && (
                    <a
                      href={`https://app.virtuals.io/acp/agent/${selectedAgent.virtuals_id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all shrink-0">
                      Hire via ACP
                      <ArrowRight className="w-3 h-3" />
                    </a>
                  )}
                  {selectedAgent.isInternal && (
                    <a href="/testing"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-secondary text-xs font-semibold hover:bg-secondary/80 transition-all shrink-0">
                      Run Tests
                      <ArrowRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {selectedAgent.chains.map(c => (
                    <span key={c} className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                      {c}
                    </span>
                  ))}
                  {selectedAgent.isResource && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-indigo-400/30 text-indigo-400 bg-indigo-400/5">
                      ACP Resource · x402 micropayment
                    </span>
                  )}
                </div>
              </div>

              {/* Skill cards with live confidence */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Skills</h3>
                {selectedAgent.skills.map(skill => {
                  const key = `${selectedAgent.name}::${skill.id}`;
                  const stat = skillStatuses[key];
                  return (
                    <div key={skill.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold">{skill.name}</span>
                            <span className="text-[10px] font-mono text-muted-foreground/60">#{skill.id}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{skill.desc}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold" style={{ color: selectedAgent.color }}>{skill.price}</div>
                          <div className="flex items-center gap-1 justify-end text-[10px] text-muted-foreground mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {skill.sla}
                          </div>
                        </div>
                      </div>
                      {/* Live confidence from Railway */}
                      {stat ? (
                        <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                          <div className={`flex items-center gap-1 text-[10px] font-mono ${
                            stat.status === "STRONG" ? "text-green-400" :
                            stat.status === "OK"     ? "text-blue-400" :
                            stat.status === "WEAK"   ? "text-yellow-400" : "text-red-400"
                          }`}>
                            {stat.status === "DEGRADED"
                              ? <AlertTriangle className="w-2.5 h-2.5" />
                              : <CheckCircle2 className="w-2.5 h-2.5" />}
                            {stat.status}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {stat.successRate} success
                          </div>
                          {stat.avgMs && (
                            <div className="text-[10px] text-muted-foreground">
                              avg {stat.avgMs}ms
                            </div>
                          )}
                          <div className="flex-1 bg-secondary rounded-full h-1">
                            <div className="h-1 rounded-full transition-all"
                              style={{
                                width: `${Math.round(stat.confidenceScore * 100)}%`,
                                background: stat.confidenceScore >= 0.8 ? "#4ade80" :
                                            stat.confidenceScore >= 0.5 ? "#60a5fa" :
                                            stat.confidenceScore >= 0.3 ? "#facc15" : "#f87171",
                              }} />
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {Math.round(stat.confidenceScore * 100)}%
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 pt-2 border-t border-border/50 text-[10px] text-muted-foreground/40">
                          <Star className="w-2.5 h-2.5" />
                          No job history yet — first to hire gets pioneer rate
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* How to hire instructions */}
              <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">How to Hire</h3>
                {selectedAgent.isInternal ? (
                  <p className="text-xs text-muted-foreground">
                    This agent runs internally. Go to <a href="/testing" className="text-primary hover:underline">App Tests</a> to trigger a test suite for your app.
                  </p>
                ) : selectedAgent.isResource ? (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>This is a data feed, not an ACP agent. Pay per query via x402:</p>
                    <code className="block bg-background border border-border rounded p-2 text-[11px] font-mono">
                      GET {RAILWAY_URL}/api/resource/throw-watcher?endpoint=transfers
                    </code>
                    <p>Or discover it via <code className="text-primary">acp browse "THROW Watcher"</code> once registered.</p>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground space-y-2">
                    <p>Option 1 — Virtuals ACP marketplace (web):</p>
                    <a href={`https://app.virtuals.io/acp/agent/${selectedAgent.virtuals_id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline">
                      <ExternalLink className="w-3 h-3" />
                      app.virtuals.io/acp/agent/{selectedAgent.virtuals_id?.slice(0, 8)}…
                    </a>
                    <p className="pt-1">Option 2 — ACP CLI:</p>
                    <code className="block bg-background border border-border rounded p-2 text-[11px] font-mono whitespace-pre-wrap">
                      {`acp browse "${selectedAgent.name}"\nacp client create-job --provider ${selectedAgent.name} --offering-name "${selectedAgent.skills[0]?.name}"`}
                    </code>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
