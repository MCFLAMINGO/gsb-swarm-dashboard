"use client";

import { useState, useEffect, useRef } from "react";
import {
  Brain, MapPin, TrendingUp, DollarSign, Building2,
  BarChart2, Zap, ChevronDown, Loader2, Code2, Send,
  AlertCircle, CheckCircle2, Minus
} from "lucide-react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";

// ── All 41 ZIPs ───────────────────────────────────────────────────────────────
const ALL_ZIPS = [
  { zip: "32081", name: "Nocatee",                  county: "St. Johns"  },
  { zip: "32082", name: "Ponte Vedra Beach",         county: "St. Johns"  },
  { zip: "32092", name: "World Golf Village",        county: "St. Johns"  },
  { zip: "32084", name: "St. Augustine",             county: "St. Johns"  },
  { zip: "32086", name: "St. Augustine South",       county: "St. Johns"  },
  { zip: "32095", name: "Palm Valley",               county: "St. Johns"  },
  { zip: "32080", name: "St. Augustine Beach",       county: "St. Johns"  },
  { zip: "32259", name: "Fruit Cove / Saint Johns",  county: "St. Johns"  },
  { zip: "32250", name: "Jacksonville Beach",        county: "Duval"      },
  { zip: "32266", name: "Neptune Beach",             county: "Duval"      },
  { zip: "32258", name: "Bartram Park",              county: "Duval"      },
  { zip: "32226", name: "North Jacksonville",        county: "Duval"      },
  { zip: "32256", name: "Baymeadows / Tinseltown",   county: "Duval"      },
  { zip: "32257", name: "Mandarin South",            county: "Duval"      },
  { zip: "32224", name: "Jacksonville Intracoastal", county: "Duval"      },
  { zip: "32225", name: "Jacksonville Arlington",    county: "Duval"      },
  { zip: "32246", name: "Jacksonville Regency",      county: "Duval"      },
  { zip: "32233", name: "Atlantic Beach",            county: "Duval"      },
  { zip: "32211", name: "Jacksonville East",         county: "Duval"      },
  { zip: "32216", name: "Southside Blvd",            county: "Duval"      },
  { zip: "32217", name: "San Jose",                  county: "Duval"      },
  { zip: "32207", name: "Jacksonville Southbank",    county: "Duval"      },
  { zip: "32223", name: "Mandarin",                  county: "Duval"      },
  { zip: "32206", name: "Jacksonville North",        county: "Duval"      },
  { zip: "32205", name: "Avondale / Riverside",      county: "Duval"      },
  { zip: "32210", name: "Wesconnett",                county: "Duval"      },
  { zip: "32218", name: "Jacksonville Northwest",    county: "Duval"      },
  { zip: "32244", name: "Jacksonville Westside",     county: "Duval"      },
  { zip: "32003", name: "Fleming Island",            county: "Clay"       },
  { zip: "32065", name: "Orange Park / Oakleaf",     county: "Clay"       },
  { zip: "32073", name: "Orange Park",               county: "Clay"       },
  { zip: "32043", name: "Green Cove Springs",        county: "Clay"       },
  { zip: "32034", name: "Fernandina Beach",          county: "Nassau"     },
  { zip: "32097", name: "Yulee",                     county: "Nassau"     },
  { zip: "32168", name: "New Smyrna Beach",          county: "Volusia"    },
  { zip: "32174", name: "Ormond Beach",              county: "Volusia"    },
  { zip: "32117", name: "Daytona Beach North",       county: "Volusia"    },
  { zip: "32118", name: "Daytona Beach",             county: "Volusia"    },
  { zip: "32136", name: "Flagler Beach",             county: "Flagler"    },
  { zip: "32137", name: "Palm Coast",                county: "Flagler"    },
  { zip: "32177", name: "Palatka",                   county: "Putnam"     },
  { zip: "32608", name: "Gainesville West",          county: "Alachua"    },
  { zip: "32601", name: "Gainesville",               county: "Alachua"    },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface CensusPayload {
  zip: string;
  county_industry_breakdown: Array<{
    naics: string;
    label: string;
    establishments: number;
    employees: number;
    payroll_k: number;
    county_emp_share_pct: number;
    oracle_vertical: string | null;
  }>;
  permit_signals_6mo: {
    commercial: number;
    residential: number;
    total: number;
    fetched_at?: string;
  } | null;
  income: {
    irs_agi_median: number | null;
    irs_returns: number | null;
    irs_wage_share: number | null;
  };
  pdb: {
    college_pct: number | null;
    poverty_pct: number | null;
    new_units_added: number | null;
    vacancy_pct_tract: number | null;
  } | null;
  confidence: string;
}

interface ZipIntel {
  population?: number;
  total_businesses?: number;
  market_opportunity_score?: number;
  consumer_profile?: string;
  growth_state?: string;
  dominant_sector?: string;
  business_density?: number;
}

interface QueryMessage {
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function incomeTier(agi: number | null): { label: string; color: string } {
  if (!agi) return { label: "Unknown", color: "text-muted-foreground" };
  if (agi >= 200_000) return { label: "Ultra-Affluent", color: "text-purple-400" };
  if (agi >= 125_000) return { label: "Affluent",       color: "text-green-400"  };
  if (agi >= 75_000)  return { label: "Upper-Mid",      color: "text-blue-400"   };
  if (agi >= 45_000)  return { label: "Middle",         color: "text-yellow-400" };
  return                     { label: "Working",        color: "text-orange-400" };
}

function confidenceBadge(tier: string) {
  if (tier === "VERIFIED")  return "bg-green-500/15 text-green-400";
  if (tier === "ESTIMATED") return "bg-blue-500/15 text-blue-400";
  if (tier === "PROXY")     return "bg-yellow-500/15 text-yellow-400";
  return "bg-red-500/15 text-red-400";
}

function growthIcon(state?: string) {
  if (!state) return <Minus className="w-4 h-4 text-muted-foreground" />;
  if (state === "accelerating") return <TrendingUp className="w-4 h-4 text-green-400" />;
  if (state === "declining")    return <TrendingUp className="w-4 h-4 text-red-400 rotate-180" />;
  return <Minus className="w-4 h-4 text-yellow-400" />;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ZipIntelPage() {
  const [selectedZip, setSelectedZip] = useState("32082");
  const [census, setCensus]           = useState<CensusPayload | null>(null);
  const [zipIntel, setZipIntel]       = useState<ZipIntel | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [showRaw, setShowRaw]         = useState(false);
  const [messages, setMessages]       = useState<QueryMessage[]>([]);
  const [queryInput, setQueryInput]   = useState("");
  const [querying, setQuerying]       = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const zipMeta = ALL_ZIPS.find(z => z.zip === selectedZip);

  // Load data when ZIP changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCensus(null);
    setZipIntel(null);

    Promise.all([
      fetch(`${RAILWAY}/api/local-intel/census?zip=${selectedZip}`).then(r => r.json()),
      fetch(`${RAILWAY}/api/local-intel/zip?zip=${selectedZip}`).then(r => r.json()).catch(() => null),
    ]).then(([c, z]) => {
      if (cancelled) return;
      if (c?.error) { setError(c.error); }
      else { setCensus(c); }
      setZipIntel(z || null);
    }).catch(e => {
      if (!cancelled) setError(e.message);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [selectedZip]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function submitQuery() {
    const q = queryInput.trim();
    if (!q || querying) return;
    setQueryInput("");

    const userMsg: QueryMessage = { role: "user", content: q };
    const loadingMsg: QueryMessage = { role: "assistant", content: "", loading: true };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setQuerying(true);

    try {
      const res = await fetch(`${RAILWAY}/api/local-intel/zip-intel-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip: selectedZip, question: q }),
      });
      const json = await res.json();
      const answer = json.answer || json.error || "No response.";
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: "assistant", content: answer },
      ]);
    } catch (e: any) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: "assistant", content: `Error: ${e.message}` },
      ]);
    } finally {
      setQuerying(false);
    }
  }

  const income      = census?.income;
  const tier        = incomeTier(income?.irs_agi_median ?? null);
  const topSectors  = census?.county_industry_breakdown?.slice(0, 8) ?? [];
  const permits     = census?.permit_signals_6mo;
  const pop         = zipIntel?.population ?? 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            ZIP Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Hive signal layer — census, permits, income, LLM query
          </p>
        </div>

        {/* ZIP selector */}
        <div className="relative">
          <select
            value={selectedZip}
            onChange={e => setSelectedZip(e.target.value)}
            className="appearance-none pl-4 pr-8 py-2 rounded-xl border border-border bg-card text-sm font-semibold focus:outline-none focus:border-primary/40 cursor-pointer"
          >
            {["St. Johns","Duval","Clay","Nassau","Volusia","Flagler","Putnam","Alachua"].map(county => (
              <optgroup key={county} label={county}>
                {ALL_ZIPS.filter(z => z.county === county).map(z => (
                  <option key={z.zip} value={z.zip}>{z.zip} — {z.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* ── Loading / Error ── */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading {selectedZip} data…
        </div>
      )}
      {error && !loading && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {census && !loading && (
        <>
          {/* ── KPI bar ── */}
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                label: "Income Tier",
                value: tier.label,
                sub: income?.irs_agi_median ? `$${fmtNum(income.irs_agi_median)} median AGI` : "No IRS data",
                icon: DollarSign,
                color: tier.color,
              },
              {
                label: "Tax Filers",
                value: income?.irs_returns ? fmtNum(income.irs_returns) : "—",
                sub: "Household proxy",
                icon: Building2,
                color: "text-blue-400",
              },
              {
                label: "Wage Share",
                value: income?.irs_wage_share ? `${income.irs_wage_share}%` : "—",
                sub: "of total income from wages",
                icon: BarChart2,
                color: "text-yellow-400",
              },
              {
                label: "Data Confidence",
                value: census.confidence,
                sub: `${zipMeta?.county ?? ""} county`,
                icon: CheckCircle2,
                color: census.confidence === "VERIFIED" ? "text-green-400" : census.confidence === "ESTIMATED" ? "text-blue-400" : "text-yellow-400",
              },
            ].map(kpi => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${kpi.color}`} />
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  </div>
                  <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
                </div>
              );
            })}
          </div>

          {/* ── Three panels ── */}
          <div className="grid grid-cols-3 gap-4">

            {/* Panel 1 — Industry Density */}
            <div className="col-span-2 rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Industry Density — {zipMeta?.county} County
                </h2>
                {pop > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Pop: {fmtNum(pop)} · {fmtNum(zipIntel?.total_businesses ?? 0)} businesses indexed
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {topSectors.length === 0 && (
                  <p className="text-xs text-muted-foreground">No county industry data available.</p>
                )}
                {topSectors.map(s => {
                  const estabPer1k = pop > 0 ? ((s.establishments / pop) * 1000).toFixed(1) : null;
                  // Rough benchmark: >5 per 1k = dense, 2-5 = balanced, <2 = underserved
                  const density = estabPer1k
                    ? parseFloat(estabPer1k) > 5 ? { label: "DENSE",       color: "text-green-400",  bg: "bg-green-500/10"  }
                    : parseFloat(estabPer1k) > 2 ? { label: "BALANCED",    color: "text-blue-400",   bg: "bg-blue-500/10"   }
                    :                              { label: "UNDERSERVED",  color: "text-orange-400", bg: "bg-orange-500/10" }
                    : null;

                  // Bar width based on county emp share
                  const barW = Math.min(100, Math.round(s.county_emp_share_pct * 5));

                  return (
                    <div key={s.naics} className="flex items-center gap-3">
                      <div className="w-40 shrink-0">
                        <p className="text-xs font-medium truncate">{s.label}</p>
                        <p className="text-xs text-muted-foreground">{s.establishments.toLocaleString()} estab</p>
                      </div>
                      <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/40 rounded-full transition-all"
                          style={{ width: `${barW}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {s.county_emp_share_pct}%
                      </span>
                      {density && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${density.bg} ${density.color} w-24 text-center`}>
                          {estabPer1k}/1k {density.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Panel 2 — Growth Signals */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                Growth Signals
              </h2>

              {/* Permits */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Permits (6mo)</p>
                {permits ? (
                  <div className="space-y-1.5">
                    {[
                      { label: "Commercial", value: permits.commercial, color: "text-blue-400" },
                      { label: "Residential", value: permits.residential, color: "text-green-400" },
                      { label: "Total", value: permits.total, color: "text-primary" },
                    ].map(p => (
                      <div key={p.label} className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">{p.label}</span>
                        <span className={`text-sm font-bold ${p.color}`}>{p.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No permit data (SJC ZIPs only)</p>
                )}
              </div>

              {/* PDB signals */}
              {census.pdb && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Census PDB</p>
                  <div className="space-y-1.5">
                    {[
                      { label: "New units added", value: census.pdb.new_units_added != null ? fmtNum(census.pdb.new_units_added) : "—" },
                      { label: "College attainment", value: census.pdb.college_pct != null ? `${census.pdb.college_pct}%` : "—" },
                      { label: "Poverty rate", value: census.pdb.poverty_pct != null ? `${census.pdb.poverty_pct}%` : "—" },
                      { label: "Vacancy rate", value: census.pdb.vacancy_pct_tract != null ? `${census.pdb.vacancy_pct_tract}%` : "—" },
                    ].map(p => (
                      <div key={p.label} className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">{p.label}</span>
                        <span className="text-xs font-bold">{p.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ZIP intel growth state */}
              {zipIntel?.growth_state && (
                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  {growthIcon(zipIntel.growth_state)}
                  <div>
                    <p className="text-xs font-semibold capitalize">{zipIntel.growth_state}</p>
                    <p className="text-xs text-muted-foreground">{zipIntel.consumer_profile ?? "—"}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── LLM Query Box ── */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
              <Brain className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold">Hive Query</h2>
              <span className="text-xs text-muted-foreground ml-1">
                Ask anything about {selectedZip} — grounded in Postgres, synthesized by AI
              </span>
              <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded ${confidenceBadge(census.confidence)}`}>
                {census.confidence}
              </span>
            </div>

            {/* Chat thread */}
            <div className="h-64 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Try asking:</p>
                  {[
                    `Is ${selectedZip} underserved in healthcare?`,
                    `What's the income profile of ${selectedZip}?`,
                    `Where are construction signals strongest?`,
                    `Is this a good market for fine dining?`,
                  ].map(q => (
                    <button key={q}
                      onClick={() => { setQueryInput(q); }}
                      className="block text-xs text-left text-primary/70 hover:text-primary transition-colors">
                      → {q}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] text-xs rounded-xl px-3 py-2 leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}>
                    {m.loading
                      ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Analyzing…</span>
                      : m.content
                    }
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
              <input
                type="text"
                value={queryInput}
                onChange={e => setQueryInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitQuery(); }}
                placeholder={`Ask about ${selectedZip} — ${zipMeta?.name ?? ""}…`}
                className="flex-1 text-xs bg-secondary rounded-lg border border-border px-3 py-2 focus:outline-none focus:border-primary/40"
              />
              <button
                onClick={submitQuery}
                disabled={!queryInput.trim() || querying}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40 transition-all hover:bg-primary/90"
              >
                {querying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Ask
              </button>
            </div>
          </div>

          {/* ── Raw JSON toggle ── */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => setShowRaw(r => !r)}
              className="w-full flex items-center gap-2 px-5 py-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Code2 className="w-4 h-4" />
              {showRaw ? "Hide" : "Show"} raw Postgres payload
            </button>
            {showRaw && (
              <pre className="px-5 pb-5 text-[10px] text-muted-foreground overflow-x-auto leading-relaxed max-h-96 overflow-y-auto">
                {JSON.stringify({ census, zipIntel }, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}
