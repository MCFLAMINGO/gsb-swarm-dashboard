"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Bot, Plug, Settings, ChevronLeft, ChevronRight,
  Activity, Swords, Zap, FlaskConical, Globe, Radio,
  TrendingUp, Eye, Search, MapPin, Coins, Brain, Network, Phone, Ban,
  MessageSquare, Cpu, GitBranch, ChevronDown, Crosshair, Briefcase
} from "lucide-react";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  tip: string;
  external?: boolean;
};

const PRIMARY: NavItem[] = [
  { href: "/", label: "Desk", icon: Briefcase, tip: "Trading desk — Elite analyst at the heart" },
  { href: "/elite-deep-dive", label: "Elite Research", icon: Brain, tip: "Full multi-factor dive — thesis, desk voice, contrarian, ROI plan" },
  { href: "/team", label: "Team", icon: Bot, tip: "ACP agents — cook, dispatch, marketplace" },
  { href: "/macro", label: "Macro", icon: Network, tip: "LocalIntel node model + ZIP / market intel feeding the desk" },
  { href: "/execute", label: "Execute", icon: Crosshair, tip: "Robinhood Agentic · Copy · THROW / Tempo" },
];

const LOCALINTEL_OPS: NavItem[] = [
  { href: "/local-intel", label: "Directory", icon: Globe, tip: "LocalIntel home / search shell" },
  { href: "/local-intel/live", label: "Live Feed", icon: Radio, tip: "ZIP coverage & enrichment pipeline" },
  { href: "/local-intel/revenue", label: "Revenue", icon: TrendingUp, tip: "Revenue stats & budget gate" },
  { href: "/local-intel/oracle", label: "Oracle Signals", icon: Eye, tip: "ZIP opportunity / gap signals" },
  { href: "/local-intel/search", label: "Search", icon: Search, tip: "Business search by query + ZIP" },
  { href: "/local-intel/fees", label: "Fee Control", icon: Coins, tip: "RFQ / order fee controls" },
  { href: "/local-intel/rails", label: "Rail Router", icon: GitBranch, tip: "Surge / Tempo / RFQ routing" },
  { href: "/local-intel/zip-intel", label: "ZIP Intel", icon: Brain, tip: "Census / income / permits per ZIP" },
  { href: "/local-intel/ceo", label: "Gov Macro CEO", icon: Cpu, tip: "ZIP assessment from government data" },
  { href: "/local-intel/transcripts", label: "Transcripts", icon: Phone, tip: "Voice line transcripts" },
  { href: "/local-intel/dead-ends", label: "Dead Ends", icon: Ban, tip: "Failed intent queries" },
  { href: "/local-intel/sms-log", label: "SMS Log", icon: MessageSquare, tip: "Inbound SMS routing log" },
  { href: "https://www.thelocalintel.com/admin", label: "Biz Admin", icon: MapPin, tip: "Business admin portal", external: true },
];

const SECONDARY: NavItem[] = [
  { href: "/connections", label: "Connections", icon: Plug, tip: "Robinhood Agentic OAuth + API keys" },
  { href: "/settings", label: "Settings", icon: Settings, tip: "Dashboard preferences" },
  { href: "/overview", label: "Legacy Overview", icon: LayoutDashboard, tip: "Old swarm overview KPIs" },
  { href: "/testing", label: "App Tests", icon: FlaskConical, tip: "Playwright UI test suites" },
];

function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} fill="none" aria-label="GSB Swarm">
      <polygon
        points="20,2 35,10.5 35,29.5 20,38 5,29.5 5,10.5"
        stroke="hsl(4 85% 44%)"
        strokeWidth="2"
        fill="hsl(4 85% 44% / 0.08)"
      />
      <path d="M13 15 A8 8 0 1 1 27 23 H20" stroke="hsl(4 85% 44%)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M20 23 H27 V27" stroke="hsl(4 85% 44%)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const { href, label, icon: Icon, tip, external } = item;
  const active = !external && (pathname === href || (href !== "/" && pathname.startsWith(href)));
  const inner = (
    <span
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all cursor-pointer group relative",
        active
          ? "bg-primary/10 text-primary border border-primary/25"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
      )}
    >
      <Icon size={17} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      {collapsed && (
        <span className="absolute left-full ml-2.5 px-2 py-1 text-xs bg-secondary border border-border rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-lg">
          {label}
        </span>
      )}
    </span>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" title={tip}>{inner}</a>
  ) : (
    <Link href={href} title={tip}>{inner}</Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [opsOpen, setOpsOpen] = useState(
    () => pathname.startsWith("/local-intel")
  );

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-card border-r border-border transition-all duration-300 shrink-0",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-border",
        collapsed && "justify-center px-2"
      )}>
        <Logo size={30} />
        {!collapsed && (
          <div>
            <div className="text-sm font-bold tracking-wide" style={{ color: "hsl(4 85% 44%)" }}>
              GSB Swarm
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Trading Desk</div>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">Core</div>
        )}
        {PRIMARY.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
        ))}

        {!collapsed && (
          <button
            type="button"
            onClick={() => setOpsOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-2 mt-2 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <span>LocalIntel Ops</span>
            <ChevronDown size={12} className={cn("transition-transform", opsOpen && "rotate-180")} />
          </button>
        )}
        {(opsOpen || collapsed) && LOCALINTEL_OPS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
        ))}

        {!collapsed && (
          <div className="px-3 py-1 mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">System</div>
        )}
        {SECONDARY.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
        ))}
      </nav>

      <div className="p-2 border-t border-border space-y-1">
        {!collapsed && (
          <div className="px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">Properties</div>
        )}
        <a href="https://www.bleeding.cash" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          title="bleeding.cash">
          <Activity size={17} className="shrink-0" />
          {!collapsed && <span className="text-xs">bleeding.cash</span>}
        </a>
        <a href="https://www.throw5onit.com" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          title="THROW">
          <Zap size={17} className="shrink-0" style={{ color: "#00e5a0" }} />
          {!collapsed && <span className="text-xs" style={{ color: "#00e5a0" }}>throw5onit.com</span>}
        </a>
        <a href="https://www.raidersofthechain.com" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          title="Raiders of the Chain">
          <Swords size={17} className="shrink-0" />
          {!collapsed && <span className="text-xs">Raiders of the Chain</span>}
        </a>
        <a href="https://localintel-landing-deploy.vercel.app" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          title="The Local Intel">
          <MapPin size={17} className="shrink-0" style={{ color: "#00e5a0" }} />
          {!collapsed && <span className="text-xs" style={{ color: "#00e5a0" }}>thelocalintel.com</span>}
        </a>
        {!collapsed && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-muted-foreground">
            <span className="status-dot active" />
            <span>ACP · Robinhood · Tempo</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
