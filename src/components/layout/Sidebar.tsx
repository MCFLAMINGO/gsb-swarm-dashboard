"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Bot, DollarSign, Plug, Settings, ChevronLeft, ChevronRight
} from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "/",            label: "Swarm Overview", icon: LayoutDashboard, tip: "Live status of all 4 broker agents" },
  { href: "/agents",      label: "Agents",         icon: Bot,             tip: "Individual agent config & simulate" },
  { href: "/earnings",    label: "Earnings",       icon: DollarSign,      tip: "USDC earned, payouts, withdraw" },
  { href: "/connections", label: "API Connections",icon: Plug,            tip: "Telegram, X, x402, wallet keys" },
  { href: "/settings",    label: "Settings",       icon: Settings,        tip: "Dashboard & agent preferences" },
];

// Inline GSB logo SVG
function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" aria-label="GSB Swarm">
      {/* Hexagon */}
      <polygon
        points="20,2 35,10.5 35,29.5 20,38 5,29.5 5,10.5"
        stroke="hsl(4 85% 44%)"
        strokeWidth="2"
        fill="hsl(4 85% 44% / 0.08)"
      />
      {/* G arc */}
      <path d="M13 15 A8 8 0 1 1 27 23 H20" stroke="hsl(4 85% 44%)" strokeWidth="2.2" strokeLinecap="round" />
      {/* G crossbar */}
      <path d="M20 23 H27 V27" stroke="hsl(4 85% 44%)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-card border-r border-border transition-all duration-300 shrink-0",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      {/* Brand */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-border",
        collapsed && "justify-center px-2"
      )}>
        <Logo size={30} />
        {!collapsed && (
          <div>
            <div className="text-sm font-bold tracking-wide text-glow-red" style={{ color: "hsl(4 85% 44%)" }}>
              GSB Swarm
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Broker Control</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, tip }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} title={tip}>
              <span className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all cursor-pointer group relative",
                active
                  ? "bg-primary/10 text-primary border border-primary/25"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
              )}>
                <Icon size={17} className="shrink-0" />
                {!collapsed && <span>{label}</span>}
                {/* Tooltip when collapsed */}
                {collapsed && (
                  <span className="absolute left-full ml-2.5 px-2 py-1 text-xs bg-secondary border border-border rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-lg">
                    {label}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-border space-y-1">
        {/* Base network badge */}
        {!collapsed && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-muted-foreground">
            <span className="status-dot active" />
            <span>Base Network · x402</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
