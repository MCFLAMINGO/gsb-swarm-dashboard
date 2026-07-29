"use client";

import Link from "next/link";
import Header from "@/components/layout/Header";
import { Bot, Swords, Gauge, ShoppingBag, Brain } from "lucide-react";

const LINKS = [
  {
    href: "/agents",
    title: "Dispatch agents",
    desc: "Fire ACP / Railway workers — Token, Alpha, Wallet, Equity, Thread Writer.",
    icon: Bot,
  },
  {
    href: "/war-room",
    title: "Cook the swarm",
    desc: "War Room strategy cook — batch the team, synthesize with CEO.",
    icon: Swords,
  },
  {
    href: "/drivers-seat",
    title: "Driver's Seat",
    desc: "Multi-property control room — live agent TV for $GSB surfaces.",
    icon: Gauge,
  },
  {
    href: "/marketplace",
    title: "Hire on Virtuals",
    desc: "ACP marketplace catalogue + hire links (demoted from top-level nav).",
    icon: ShoppingBag,
  },
  {
    href: "/elite-deep-dive",
    title: "Elite research",
    desc: "Chief Analyst full note — desk voice, contrarian, multi-horizon ROI.",
    icon: Brain,
  },
];

export default function TeamPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Trading Team"
        subtitle="ACP agents behind the desk — one roster, not three competing UIs."
      />
      <main className="p-5 max-w-3xl mx-auto space-y-4">
        <p className="text-sm text-muted-foreground">
          War Room, Driver&apos;s Seat, Agents, and Marketplace all drive the same swarm.
          Use this console as the entry — deep pages stay available.
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
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground inline-block">
          ← Back to Desk
        </Link>
      </main>
    </div>
  );
}
