"use client";

import { SPENDING_ZONES } from "@/lib/spendingZones";
import { TrendingUp, TrendingDown, Minus, DollarSign, Home, Users, Building2, BarChart2, Zap } from "lucide-react";

function fmt(n: number, prefix = "") {
  if (n >= 1000000) return `${prefix}${(n/1000000).toFixed(1)}M`;
  if (n >= 1000)    return `${prefix}${(n/1000).toFixed(0)}k`;
  return `${prefix}${n}`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "accelerating") return <TrendingUp className="w-4 h-4 text-green-400" />;
  if (trend === "declining")    return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-yellow-400" />;
}

export default function ZonesPage() {
  const { county_total, zips } = SPENDING_ZONES;
  const zipList = Object.entries(zips);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" />
          Spending Zones — St. Johns County
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Census ACS 2022 · {county_total.establishments.toLocaleString()} total establishments · {county_total.employees.toLocaleString()} employees
        </p>
      </div>

      {/* County-level KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Businesses",   value: county_total.establishments.toLocaleString(), icon: Building2, color: "text-blue-400"   },
          { label: "Total Employees",    value: county_total.employees.toLocaleString(),       icon: Users,     color: "text-green-400"  },
          { label: "Annual Payroll",     value: `$${fmt(county_total.annual_payroll_thousands * 1000)}`, icon: DollarSign, color: "text-yellow-400" },
          { label: "Avg Pay/Employee",   value: `$${Math.round(county_total.annual_payroll_thousands * 1000 / county_total.employees).toLocaleString()}`, icon: Zap, color: "text-purple-400" },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${kpi.color}`} />
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
            </div>
          );
        })}
      </div>

      {/* Zip zone cards */}
      <div className="grid grid-cols-2 gap-4">
        {zipList.map(([zip, zone]) => (
          <div key={zip} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold">{zip}</h2>
                  <TrendIcon trend={zone.zone_trend} />
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    zone.zone_trend === "accelerating" ? "bg-green-500/15 text-green-400" :
                    zone.zone_trend === "declining"    ? "bg-red-500/15 text-red-400"     :
                    "bg-yellow-500/15 text-yellow-400"
                  }`}>{zone.zone_trend}</span>
                </div>
                <p className="text-sm text-muted-foreground">{zone.name}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary">{zone.zone_score}</p>
                <p className="text-xs text-muted-foreground">Zone Score</p>
              </div>
            </div>

            {/* Score bar */}
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{width:`${zone.zone_score}%`}} />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Population",      value: zone.population.toLocaleString(),           icon: Users     },
                { label: "Median Income",   value: `$${zone.median_household_income.toLocaleString()}`, icon: DollarSign },
                { label: "Median Home",     value: `$${zone.median_home_value.toLocaleString()}`,        icon: Home       },
                { label: "Median Rent",     value: `$${zone.median_gross_rent.toLocaleString()}/mo`,     icon: Building2  },
                { label: "Own vs Rent",     value: `${zone.ownership_rate_pct}% own`,           icon: Home       },
                { label: "Owner Units",     value: zone.owner_occupied_units.toLocaleString(),   icon: Building2  },
              ].map(stat => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="flex items-start gap-2">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-sm font-semibold">{stat.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Intelligence signals */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Zone Signals</p>
              <ul className="space-y-1">
                {zone.signals.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5 shrink-0">›</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Industry breakdown */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold mb-4">St. Johns County — Industry Breakdown</h3>
        <div className="space-y-2">
          {county_total.top_industries.map(ind => {
            const maxEstab = Math.max(...county_total.top_industries.map(i => i.establishments));
            const pct = Math.round(ind.establishments / maxEstab * 100);
            return (
              <div key={ind.naics} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-5">{ind.naics}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-xs">{ind.label}</span>
                    <span className="text-xs text-muted-foreground">{ind.establishments.toLocaleString()} estab · {ind.employees.toLocaleString()} emp</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full" style={{width:`${pct}%`}} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-4">Source: US Census County Business Patterns 2022 · St. Johns County FIPS 12109</p>
      </div>

      <p className="text-xs text-muted-foreground">
        Data: US Census ACS 2022 · County Business Patterns 2022 · Next layers: FL DOR sales tax by zip (PRR), SJC building permits, utility records
      </p>
    </div>
  );
}
