"use client";

import { Zap, ExternalLink } from "lucide-react";
import { useStore } from "@/store/useStore";

export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const agents = useStore(s => s.agents);
  const activeCount = agents.filter(a => a.enabled && a.status === "active").length;
  const enabledCount = agents.filter(a => a.enabled).length;

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 px-6 py-3.5 bg-card/80 backdrop-blur border-b border-border">
      <div className="flex-1">
        <h1 className="text-base font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      {/* Live agents badge */}
      <div className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-secondary border border-border">
        <Zap size={11} className="text-yellow-400" />
        <span className="text-muted-foreground">{enabledCount} agents</span>
        {activeCount > 0 && (
          <span className="text-primary font-semibold">· {activeCount} active</span>
        )}
      </div>

      {/* Network badge */}
      <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
        style={{ background: "hsl(4 85% 44% / 0.1)", border: "1px solid hsl(4 85% 44% / 0.25)", color: "hsl(4 85% 44%)" }}>
        <span className="status-dot active" />
        Base
      </div>

      {/* x402 link */}
      <a
        href="https://gsb.bank/x402"
        target="_blank"
        rel="noopener noreferrer"
        className="hidden md:flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        x402 Bank <ExternalLink size={10} />
      </a>
    </header>
  );
}
