"use client";

import { Zap, ExternalLink } from "lucide-react";
import { useStore } from "@/store/useStore";

export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const agents = useStore(s => s.agents);
  const activeCount = agents.filter(a => a.enabled && a.status === "active").length;
  const enabledCount = agents.filter(a => a.enabled).length;

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 px-6 py-4 bg-card/90 backdrop-blur border-b border-border">
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-base text-foreground/80 mt-1 leading-snug">{subtitle}</p>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-secondary border border-border">
        <Zap size={14} className="text-yellow-400" />
        <span className="text-foreground/85">{enabledCount} agents</span>
        {activeCount > 0 && (
          <span className="text-primary font-semibold">· {activeCount} active</span>
        )}
      </div>

      <div
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md"
        style={{ background: "hsl(4 85% 44% / 0.15)", border: "1px solid hsl(4 85% 44% / 0.4)", color: "hsl(4 75% 62%)" }}
      >
        <span className="status-dot active" />
        Base
      </div>

      <a
        href="/x402"
        target="_blank"
        rel="noopener noreferrer"
        className="hidden md:flex items-center gap-1 text-sm text-foreground/85 hover:text-foreground transition-colors"
      >
        x402 API <ExternalLink size={12} />
      </a>
    </header>
  );
}
