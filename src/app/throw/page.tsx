import { ExternalLink, Zap, TrendingUp, DollarSign, Users } from "lucide-react";

export default function ThrowPage() {
  const THROW_URL = "https://www.perplexity.ai/computer/a/throw-nzr2VtR3S6q6vTur7FGhlw";
  const X_URL     = "https://x.com/Throw_Bet";

  const stats = [
    { label: "Service Fee",    value: "$0.10",    sub: "per throw",          icon: DollarSign },
    { label: "Bet Increments", value: "$5–$50",   sub: "in $5 steps",        icon: TrendingUp },
    { label: "Chain",          value: "Tempo",    sub: "Stripe + Paradigm",  icon: Zap        },
    { label: "Tokens",         value: "2",        sub: "pathUSD + USDC",     icon: Users      },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00e5a0]/10 border border-[#00e5a0]/30 flex items-center justify-center">
              <Zap size={20} style={{color:"#00e5a0"}} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide">THROW</h1>
              <p className="text-xs text-muted-foreground">Digital cash for real life · Tempo mainnet</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <a href={X_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors">
            <ExternalLink size={13}/> @Throw_Bet
          </a>
          <a href={THROW_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
            style={{background:"#00e5a0", color:"#000"}}>
            <ExternalLink size={13}/> Open App
          </a>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon size={14}/><span className="text-xs uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-2xl font-bold" style={{color:"#00e5a0"}}>{value}</div>
            <div className="text-xs text-muted-foreground">{sub}</div>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* How it works */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">How it works</h2>
          {[
            { step:"1", title:"Load up to $50",     desc:"Fund your in-app wallet with pathUSD or USDC on Tempo." },
            { step:"2", title:"Throw at a friend",   desc:"Flick your phone, dock NFC, or beam sonic — money lands instantly." },
            { step:"3", title:"Open a bet",          desc:"Host sets the terms, players throw money at your phone to join." },
            { step:"4", title:"Settle instantly",    desc:"Host taps WIN or LOSE — escrow distributes to all wallets on-chain." },
          ].map(({step,title,desc}) => (
            <div key={step} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-[#00e5a0]/10 border border-[#00e5a0]/30 flex items-center justify-center text-xs font-bold shrink-0"
                style={{color:"#00e5a0"}}>{step}</div>
              <div>
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Revenue model */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Revenue model</h2>
          {[
            { label:"Service fee",      value:"$0.10/throw",    note:"Deducted before escrow — legal payment processing fee, not rake" },
            { label:"DEX routing",      value:"0.3% swap LP",   note:"Treasury fees route through Tempo DEX AMM — earn LP spread" },
            { label:"Tempo yield",      value:"pathUSD float",  note:"Escrow balances earn native Tempo yield during active bets" },
            { label:"Tempo grant",      value:"$25k–$50k",      note:"Application submitted to partners@tempo.xyz — early ecosystem builder" },
            { label:"Big Throw unlock", value:"$4.99/mo",       note:"Remove $50 cap — future premium tier" },
          ].map(({label,value,note}) => (
            <div key={label} className="flex flex-col gap-0.5 border-b border-border pb-2 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-sm font-bold" style={{color:"#00e5a0"}}>{value}</span>
              </div>
              <span className="text-xs text-muted-foreground">{note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tempo ecosystem */}
      <div className="rounded-xl border border-[#00e5a0]/20 bg-[#00e5a0]/5 p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Zap size={16} style={{color:"#00e5a0"}}/>
          <span className="text-sm font-bold" style={{color:"#00e5a0"}}>Tempo Ecosystem Play</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Tempo launched mainnet March 18, 2026 — 3 weeks ago. THROW is one of the first consumer apps live on chain.
          Backed by Stripe + Paradigm at $5B valuation, Tempo has no token yet. Early on-chain activity
          typically qualifies for ecosystem airdrops. Every throw builds wallet history for both users and the treasury.
        </p>
        <div className="flex gap-2 pt-1">
          <a href="mailto:partners@tempo.xyz"
            className="text-xs px-3 py-1.5 rounded-md border border-[#00e5a0]/30 hover:bg-[#00e5a0]/10 transition-colors"
            style={{color:"#00e5a0"}}>
            partners@tempo.xyz
          </a>
          <a href="https://docs.tempo.xyz" target="_blank" rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors">
            Tempo Docs <ExternalLink size={11} className="inline ml-1"/>
          </a>
        </div>
      </div>

      {/* Embedded app preview */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold">Live App</span>
          <a href={THROW_URL} target="_blank" rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            Open full <ExternalLink size={12}/>
          </a>
        </div>
        <div className="flex items-center justify-center p-8 bg-black/40">
          <iframe
            src={THROW_URL}
            className="w-[375px] h-[667px] rounded-2xl border border-border shadow-2xl"
            title="THROW App"
          />
        </div>
      </div>
    </div>
  );
}
