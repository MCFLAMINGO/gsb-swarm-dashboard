"use client";

import Link from "next/link";
import Header from "@/components/layout/Header";
import { Network, Brain, TrendingUp, Eye, Cpu } from "lucide-react";

const LINKS = [
  {
    href: "/local-intel/nodes",
    title: "Node Map",
    desc: "Intelligence nodes — the tech graph that produces macro / ZIP signals for the desk.",
    icon: Network,
  },
  {
    href: "/local-intel/zip-intel",
    title: "ZIP Intel",
    desc: "Census, income, permits — hive intelligence per ZIP.",
    icon: Brain,
  },
  {
    href: "/local-intel/market-intel",
    title: "Market Intel",
    desc: "FL-concentrated equity signals scored against LocalIntel data.",
    icon: TrendingUp,
  },
  {
    href: "/local-intel/oracle",
    title: "Oracle Signals",
    desc: "ZIP opportunity / gap / growth anomalies (gov-data oracle — not Compute Oracle).",
    icon: Eye,
  },
  {
    href: "/local-intel/ceo",
    title: "Gov Macro CEO",
    desc: "ZIP-level business assessment from government data (renamed from LocalIntel CEO).",
    icon: Cpu,
  },
];

export default function MacroPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Macro Nodes"
        subtitle="LocalIntel node model feeds Elite — macro factory, not a side quest."
      />
      <main className="p-5 max-w-3xl mx-auto space-y-4">
        <p className="text-sm text-muted-foreground">
          FRED / BLS / ACS / ZIP signals land here, then price into the Elite desk loop.
          Ops pages (fees, SMS, transcripts) live under LocalIntel Ops in the sidebar.
        </p>
        <div className="grid gap-3">
          {LINKS.map(({ href, title, desc, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border border-border bg-card p-4 flex gap-3 hover:border-primary/40 transition-colors"
            >
              <div className="h-9 w-9 rounded-md border border-border bg-secondary flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-accent" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">{title}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
        <Link href="/elite-deep-dive" className="text-xs text-primary hover:underline inline-block">
          Run Elite with this macro context →
        </Link>
      </main>
    </div>
  );
}
