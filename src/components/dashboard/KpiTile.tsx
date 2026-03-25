"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  colorClass?: string;
  glowClass?: string;
  trend?: "up" | "down" | "flat";
}

export default function KpiTile({ label, value, sub, icon: Icon, colorClass = "text-primary", glowClass }: Props) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-lg border border-border bg-card p-4 scanlines",
      glowClass
    )}>
      {/* Subtle corner accent */}
      <div className="absolute top-0 right-0 w-16 h-16 opacity-[0.04]"
        style={{ background: `radial-gradient(circle at top right, ${colorClass.includes("yellow") ? "#facc15" : colorClass.includes("orange") ? "#f28c28" : colorClass.includes("green") ? "#4ade80" : "#cd1f1f"}, transparent)` }} />

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground uppercase tracking-widest">{label}</span>
        <Icon size={14} className={colorClass} />
      </div>
      <div className={cn("text-xl font-bold tabular tracking-tight", colorClass)}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}
