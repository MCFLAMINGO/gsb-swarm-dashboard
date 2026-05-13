"use client";

import { useState, useCallback, useEffect } from "react";
import {
  BrainCircuit, Cpu, Users, DollarSign, TrendingUp, Briefcase,
  BarChart2, Navigation, Building2, HardHat, Wifi, Home,
  MessageSquare, Ban, Send, Clock, Globe, Activity
} from "lucide-react";

const RAILWAY   = "https://gsb-swarm-production.up.railway.app";
const ADMIN_HDR = { "x-admin-token": "localintel-migrate-2026" };
const TARGET_ZIPS = ["32082", "32081", "32250", "32266", "32233", "32259", "32034"];

// ── Types ─────────────────────────────────────────────────────────────────────

interface IntentRow  { detected_intent: string; count: number; }
interface CategoryRow { category: string; count: number; }

interface Demographics {
  population?: string; households?: string; median_hhi?: string;
  median_age?: number; owner_occupied?: string; college_pct?: string;
  poverty_pct?: string; vacancy_pct?: string; avg_commute_min?: number; vintage?: string;
}
interface Income {
  median_agi?: string; returns_filed?: string; wage_share?: string;
  per_capita_income?: string; income_growth_1yr?: string; vs_fl_avg?: string; bea_vintage?: string;
}
interface Migration {
  net_returns?: string; net_agi_k?: string; in_returns?: string; out_returns?: string;
  top_origin?: string; top_dest?: string; vintage?: string;
}
interface Labor {
  unemployment_rate?: string; labor_force?: string; employed?: string; unemployment_yoy?: string;
  qwi_employment?: string; avg_monthly_earn?: string; turnover_rate?: string;
  qcew_employment?: string; avg_weekly_wages?: string; establishments?: string;
  emp_yoy?: string; wage_yoy?: string;
}
interface Sectors {
  msa?: string; total_nonfarm_k?: string; total_yoy?: string; dominant_sector?: string;
  investment_score?: number; investment_tier?: string; ai_displacement_risk?: number;
  healthcare_k?: string; healthcare_yoy?: string; professional_k?: string; professional_yoy?: string;
  leisure_k?: string; leisure_yoy?: string; construction_k?: string; construction_yoy?: string;
  retail_k?: string; retail_yoy?: string; growth_leader?: string; vintage?: string;
}
interface Jobs {
  jobs_located_here?: string; workers_living_here?: string; net_flow?: string;
  retail_jobs?: string; food_jobs?: string; top_inflow_zip?: string; top_outflow_zip?: string;
}
interface BusinessActivity {
  total_businesses?: number; top_categories?: CategoryRow[];
  zbp_establishments?: string; cbp_dominant_sector?: string;
  sunbiz_active?: string; sunbiz_new_12mo?: string; sunbiz_net_12mo?: string;
  osm_mapped?: string; osm_food?: string; osm_with_phone?: string;
}
interface Construction {
  units_annual?: string; single_family_annual?: string; multifam_annual?: string;
  units_latest_month?: string; period?: string;
}
interface Broadband {
  has_25_3_mbps?: boolean; has_gigabit?: boolean; fiber_available?: boolean;
  provider_count?: number; pct_25_3?: string; bead_unserved_pct?: string;
}
interface Property {
  parcel_count?: number; avg_beds?: number; avg_baths?: number; avg_sqft?: string;
  avg_assessed?: string; min_assessed?: string; max_assessed?: string; avg_year_built?: string;
}
interface WorldModel {
  growth_score?: number; opportunity_score?: number; risk_score?: number;
  market_maturity?: string; income_tier?: string; peer_cohort?: string;
  biz_density_per_1k?: number; job_capture_ratio?: number;
}
interface Demand { top_sms_intents?: IntentRow[]; unmet_demand?: IntentRow[]; }

interface CeoAssessment {
  zip: string; query_context: string | null; assessed_at: string;
  populated_sections: string[];
  ceo_summary: string;
  demographics?:      Demographics;
  income?:            Income;
  migration?:         Migration;
  labor?:             Labor;
  sectors?:           Sectors;
  jobs?:              Jobs;
  business_activity?: BusinessActivity;
  construction?:      Construction;
  broadband?:         Broadband;
  property?:          Property;
  world_model?:       WorldModel;
  demand?:            Demand;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function safeFetch<T>(url: string, headers: Record<string,string>, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store", headers });
    if (!res.ok) return fallback;
    return await res.json() as T;
  } catch { return fallback; }
}

function fmtDate(iso: string | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }); }
  catch { return iso; }
}

// ── Design primitives ─────────────────────────────────────────────────────────

const C = { green:"#00e5a0", bg:"hsl(0 0% 4%)", card:"hsl(0 0% 7%)", border:"hsl(0 0% 14%)",
            dim:"hsl(0 0% 45%)", mid:"hsl(0 0% 55%)", text:"#f0ebe3",
            red:"hsl(4 85% 65%)", redbg:"hsl(4 85% 44% / 0.12)", redborder:"hsl(4 85% 44% / 0.35)",
            amber:"hsl(38 95% 60%)", amberbg:"hsl(38 95% 50% / 0.10)", amberborder:"hsl(38 95% 50% / 0.30)" };

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:20, ...style }}>{children}</div>;
}

function SectionHeader({ icon: Icon, title, color=C.green, right }: {
  icon: React.ElementType; title: string; color?: string; right?: React.ReactNode;
}) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
      <Icon size={15} style={{ color }} />
      <span style={{ fontSize:12, fontWeight:700, color:C.text, textTransform:"uppercase", letterSpacing:"0.07em", flex:1 }}>{title}</span>
      {right}
    </div>
  );
}

function KV({ label, value, mono=false, color }: { label:string; value:string|number|undefined|null; mono?:boolean; color?:string }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"5px 0", borderBottom:`1px solid ${C.border}` }}>
      <span style={{ fontSize:12, color:C.dim }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:600, color: color ?? C.text, fontFamily: mono ? "monospace" : undefined }}>{String(value)}</span>
    </div>
  );
}

function StatTile({ label, value, color }: { label:string; value:string|number; color?:string }) {
  return (
    <div style={{ background:"hsl(0 0% 5%)", border:`1px solid hsl(0 0% 12%)`, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
      <div style={{ fontSize:9, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:700, color: color ?? C.text }}>{String(value)}</div>
    </div>
  );
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? C.green : score >= 40 ? C.amber : C.red;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <div style={{ width:52, height:52, borderRadius:"50%", border:`3px solid ${color}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:16, fontWeight:800, color, fontFamily:"monospace" }}>
        {score}
      </div>
      <span style={{ fontSize:10, color:C.dim, textAlign:"center", lineHeight:1.3 }}>{label}</span>
    </div>
  );
}

function Pill({ text, color=C.green, bg }: { text:string; color?:string; bg?:string }) {
  return (
    <span style={{ padding:"4px 10px", borderRadius:99, fontSize:11, fontWeight:500,
                   background: bg ?? `${color}1a`, border:`1px solid ${color}4d`, color }}>
      {text}
    </span>
  );
}

function Skeleton({ w="100%", h=14 }: { w?:string; h?:number }) {
  return <div style={{ width:w, height:h, borderRadius:4, background:"hsl(0 0% 14%)", animation:"pulse 1.5s ease-in-out infinite" }} />;
}

// ── Section panels ────────────────────────────────────────────────────────────

function DemographicsPanel({ d }: { d: Demographics }) {
  return (
    <Panel>
      <SectionHeader icon={Users} title="Demographics" color={C.green}
        right={d.vintage && <span style={{ fontSize:10, color:C.dim }}>ACS {d.vintage}</span>} />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 24px" }}>
        <KV label="Population"      value={d.population} />
        <KV label="Households"      value={d.households} />
        <KV label="Median HHI"      value={d.median_hhi} color={C.green} />
        <KV label="Median Age"      value={d.median_age} />
        <KV label="Owner Occupied"  value={d.owner_occupied} />
        <KV label="College +"       value={d.college_pct} />
        <KV label="Poverty Rate"    value={d.poverty_pct} />
        <KV label="Vacancy Rate"    value={d.vacancy_pct} />
        <KV label="Avg Commute"     value={d.avg_commute_min != null ? `${d.avg_commute_min} min` : null} />
      </div>
    </Panel>
  );
}

function IncomePanel({ d }: { d: Income }) {
  return (
    <Panel>
      <SectionHeader icon={DollarSign} title="Income" color={C.green}
        right={d.bea_vintage && <span style={{ fontSize:10, color:C.dim }}>BEA {d.bea_vintage}</span>} />
      <KV label="Per Capita Income"   value={d.per_capita_income} color={C.green} />
      <KV label="vs FL Average"       value={d.vs_fl_avg} />
      <KV label="Income Growth (1yr)" value={d.income_growth_1yr} color={d.income_growth_1yr?.startsWith("+") ? C.green : C.red} />
      <KV label="Median AGI (IRS)"    value={d.median_agi} />
      <KV label="Returns Filed"       value={d.returns_filed} />
      <KV label="Wage Share of AGI"   value={d.wage_share} />
    </Panel>
  );
}

function MigrationPanel({ d }: { d: Migration }) {
  const netNum = Number(d.net_returns?.replace(/,/g, "") || 0);
  const gaining = netNum >= 0;
  return (
    <Panel>
      <SectionHeader icon={Navigation} title="Migration" color={C.amber}
        right={d.vintage && <span style={{ fontSize:10, color:C.dim }}>IRS {d.vintage}</span>} />
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <Pill text={gaining ? `▲ NET INFLOW +${d.net_returns}` : `▼ NET OUTFLOW ${d.net_returns}`}
              color={gaining ? C.green : C.red} />
      </div>
      <KV label="Net AGI (thousands)" value={d.net_agi_k} color={gaining ? C.green : C.red} mono />
      <KV label="Inbound Returns"     value={d.in_returns} />
      <KV label="Outbound Returns"    value={d.out_returns} />
      <KV label="Top Origin"          value={d.top_origin} />
      <KV label="Top Destination"     value={d.top_dest} />
    </Panel>
  );
}

function LaborPanel({ d }: { d: Labor }) {
  return (
    <Panel>
      <SectionHeader icon={Briefcase} title="Labor Market" color={C.green} />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 24px" }}>
        <KV label="Unemployment"      value={d.unemployment_rate} />
        <KV label="Unemp. YoY"        value={d.unemployment_yoy} />
        <KV label="Labor Force"       value={d.labor_force} />
        <KV label="Employed (FRED)"   value={d.employed} />
        <KV label="QCEW Employment"   value={d.qcew_employment} />
        <KV label="Establishments"    value={d.establishments} />
        <KV label="Avg Weekly Wages"  value={d.avg_weekly_wages} color={C.green} />
        <KV label="Avg Monthly Earn"  value={d.avg_monthly_earn} color={C.green} />
        <KV label="Emp. Growth YoY"   value={d.emp_yoy} color={d.emp_yoy?.startsWith("+") ? C.green : C.red} />
        <KV label="Wage Growth YoY"   value={d.wage_yoy} color={d.wage_yoy?.startsWith("+") ? C.green : C.red} />
        <KV label="QWI Employment"    value={d.qwi_employment} />
        <KV label="Turnover Rate"     value={d.turnover_rate} />
      </div>
    </Panel>
  );
}

function SectorsPanel({ d }: { d: Sectors }) {
  const sectorRows = [
    { label:"Healthcare",   emp:d.healthcare_k,   yoy:d.healthcare_yoy },
    { label:"Professional", emp:d.professional_k, yoy:d.professional_yoy },
    { label:"Leisure/Hosp",emp:d.leisure_k,      yoy:d.leisure_yoy },
    { label:"Construction", emp:d.construction_k, yoy:d.construction_yoy },
    { label:"Retail",       emp:d.retail_k,       yoy:d.retail_yoy },
  ].filter(r => r.emp);
  return (
    <Panel>
      <SectionHeader icon={BarChart2} title="Sector Employment" color={C.green}
        right={<>
          {d.investment_tier && <Pill text={d.investment_tier} color={C.amber} />}
          {d.vintage && <span style={{ fontSize:10, color:C.dim, marginLeft:6 }}>CES {d.vintage}</span>}
        </>} />
      <div style={{ marginBottom:12 }}>
        <KV label="MSA" value={d.msa} />
        <KV label="Total Nonfarm (k)" value={d.total_nonfarm_k} color={C.green} />
        <KV label="Nonfarm YoY"       value={d.total_yoy} color={d.total_yoy?.startsWith("+") ? C.green : C.red} />
        <KV label="Dominant Sector"   value={d.dominant_sector} />
        <KV label="Growth Leader"     value={d.growth_leader} />
      </div>
      {sectorRows.length > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>By Sector (k jobs)</div>
          {sectorRows.map(r => (
            <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:12, color:C.mid }}>{r.label}</span>
              <span style={{ fontSize:12, fontFamily:"monospace", color:C.text }}>
                {r.emp} {r.yoy && <span style={{ color: r.yoy.startsWith("+") ? C.green : C.red, marginLeft:6 }}>{r.yoy}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
      {(d.investment_score != null || d.ai_displacement_risk != null) && (
        <div style={{ display:"flex", justifyContent:"space-around", paddingTop:12, borderTop:`1px solid ${C.border}` }}>
          {d.investment_score != null && <ScoreBadge score={d.investment_score} label="Investment Score" />}
          {d.ai_displacement_risk != null && <ScoreBadge score={d.ai_displacement_risk} label="AI Risk" />}
        </div>
      )}
    </Panel>
  );
}

function JobsPanel({ d }: { d: Jobs }) {
  const net = Number(d.net_flow?.replace(/,/g,"") || 0);
  const importer = net >= 0;
  return (
    <Panel>
      <SectionHeader icon={TrendingUp} title="Jobs Geography" color={C.green} />
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <Pill text={importer ? "JOB IMPORTER" : "BEDROOM COMMUNITY"} color={importer ? C.green : C.amber} />
      </div>
      <KV label="Jobs Located Here"     value={d.jobs_located_here} color={C.green} />
      <KV label="Workers Living Here"   value={d.workers_living_here} />
      <KV label="Net Flow"              value={d.net_flow ? `${net >= 0 ? "+" : ""}${d.net_flow}` : null}
           color={importer ? C.green : C.amber} />
      <KV label="Retail Jobs"           value={d.retail_jobs} />
      <KV label="Food Jobs"             value={d.food_jobs} />
      <KV label="Top Inflow ZIP"        value={d.top_inflow_zip} mono />
      <KV label="Top Outflow ZIP"       value={d.top_outflow_zip} mono />
    </Panel>
  );
}

function BusinessPanel({ d }: { d: BusinessActivity }) {
  const cats = d.top_categories ?? [];
  const maxC = cats.length ? Math.max(...cats.map(c => c.count)) : 1;
  return (
    <Panel>
      <SectionHeader icon={Building2} title="Business Activity" color={C.green} />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 24px", marginBottom:12 }}>
        <KV label="Total Businesses"   value={d.total_businesses} color={C.green} />
        <KV label="ZBP Establishments" value={d.zbp_establishments} />
        <KV label="SunBiz Active"      value={d.sunbiz_active} />
        <KV label="SunBiz New (12mo)"  value={d.sunbiz_new_12mo} color={C.green} />
        <KV label="SunBiz Net (12mo)"  value={d.sunbiz_net_12mo} />
        <KV label="OSM Mapped"         value={d.osm_mapped} />
        <KV label="OSM Food Biz"       value={d.osm_food} />
        <KV label="OSM w/ Phone"       value={d.osm_with_phone} />
      </div>
      {cats.length > 0 && (
        <>
          <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Top Categories</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {cats.slice(0,8).map((row, i) => {
              const pct = Math.max(2, Math.round((row.count / maxC) * 100));
              return (
                <div key={row.category || i}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ fontSize:11, color:C.text, textTransform:"capitalize" }}>{row.category}</span>
                    <span style={{ fontSize:11, fontWeight:600, color:C.green, fontFamily:"monospace" }}>{row.count}</span>
                  </div>
                  <div style={{ height:6, borderRadius:99, background:C.border, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${pct}%`, borderRadius:99, background:C.green, transition:"width 600ms" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}

function ConstructionPanel({ d }: { d: Construction }) {
  return (
    <Panel>
      <SectionHeader icon={HardHat} title="Construction Permits" color={C.amber}
        right={d.period && <span style={{ fontSize:10, color:C.dim }}>BPS {d.period}</span>} />
      <KV label="Annual Units Permitted"  value={d.units_annual} color={C.green} />
      <KV label="Single Family (annual)"  value={d.single_family_annual} />
      <KV label="Multifamily (annual)"    value={d.multifam_annual} />
      <KV label="Latest Month Units"      value={d.units_latest_month} />
    </Panel>
  );
}

function BroadbandPanel({ d }: { d: Broadband }) {
  return (
    <Panel>
      <SectionHeader icon={Wifi} title="Broadband" color={C.green} />
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
        {d.fiber_available === true  && <Pill text="Fiber Available" color={C.green} />}
        {d.has_gigabit === true      && <Pill text="Gigabit" color={C.green} />}
        {d.has_25_3_mbps === true    && <Pill text="25/3 Mbps" color={C.mid} />}
        {d.has_25_3_mbps === false   && <Pill text="No 25/3 Mbps" color={C.red} />}
      </div>
      <KV label="% Coverage 25/3"     value={d.pct_25_3} />
      <KV label="Provider Count"      value={d.provider_count} />
      <KV label="BEAD Unserved"       value={d.bead_unserved_pct} />
    </Panel>
  );
}

function PropertyPanel({ d }: { d: Property }) {
  return (
    <Panel>
      <SectionHeader icon={Home} title="Property Market" color={C.green} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:12 }}>
        {d.avg_beds     != null && <StatTile label="Avg Beds"   value={d.avg_beds.toFixed(1)} />}
        {d.avg_baths    != null && <StatTile label="Avg Baths"  value={d.avg_baths.toFixed(1)} />}
        {d.avg_sqft              && <StatTile label="Avg Sqft"   value={d.avg_sqft} />}
        {d.avg_year_built        && <StatTile label="Avg Built"  value={d.avg_year_built} />}
      </div>
      <KV label="Parcels"        value={d.parcel_count?.toLocaleString()} color={C.green} />
      <KV label="Avg Assessed"   value={d.avg_assessed} color={C.green} />
      <KV label="Min Assessed"   value={d.min_assessed} />
      <KV label="Max Assessed"   value={d.max_assessed} />
    </Panel>
  );
}

function WorldModelPanel({ d }: { d: WorldModel }) {
  return (
    <Panel>
      <SectionHeader icon={Globe} title="World Model Scores" color={C.green} />
      {(d.growth_score != null || d.opportunity_score != null || d.risk_score != null) && (
        <div style={{ display:"flex", justifyContent:"space-around", marginBottom:16, paddingBottom:16, borderBottom:`1px solid ${C.border}` }}>
          {d.growth_score      != null && <ScoreBadge score={d.growth_score}      label="Growth" />}
          {d.opportunity_score != null && <ScoreBadge score={d.opportunity_score} label="Opportunity" />}
          {d.risk_score        != null && <ScoreBadge score={d.risk_score}        label="Risk" />}
        </div>
      )}
      <KV label="Market Maturity"      value={d.market_maturity} />
      <KV label="Income Tier"          value={d.income_tier} />
      <KV label="Peer Cohort"          value={d.peer_cohort} />
      <KV label="Biz Density /1k"      value={d.biz_density_per_1k} />
      <KV label="Job Capture Ratio"    value={d.job_capture_ratio} />
    </Panel>
  );
}

function DemandPanel({ d }: { d: Demand }) {
  const intents = d.top_sms_intents ?? [];
  const unmet   = d.unmet_demand ?? [];
  return (
    <Panel>
      <SectionHeader icon={Activity} title="Live Demand Signals" color={C.green} />
      {intents.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6, display:"flex", alignItems:"center", gap:4 }}>
            <MessageSquare size={10} /> What People Are Asking
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {intents.map((r, i) => (
              <span key={i} style={{ padding:"5px 10px", borderRadius:99, fontSize:11, fontWeight:500,
                                      background:`${C.green}1a`, border:`1px solid ${C.green}4d`, color:C.green,
                                      display:"inline-flex", alignItems:"center", gap:5 }}>
                {r.detected_intent}
                <span style={{ fontFamily:"monospace", fontSize:10, color:C.text, opacity:0.7 }}>{r.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {unmet.length > 0 && (
        <div>
          <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6, display:"flex", alignItems:"center", gap:4 }}>
            <Ban size={10} /> Unmet Demand (Dead Ends)
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {unmet.map((r, i) => (
              <span key={i} style={{ padding:"5px 10px", borderRadius:99, fontSize:11, fontWeight:500,
                                      background:C.redbg, border:`1px solid ${C.redborder}`, color:C.red,
                                      display:"inline-flex", alignItems:"center", gap:5 }}>
                {r.detected_intent}
                <span style={{ fontFamily:"monospace", fontSize:10, color:C.text, opacity:0.7 }}>{r.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {intents.length === 0 && unmet.length === 0 && (
        <span style={{ fontSize:12, color:C.dim }}>No demand signal data yet</span>
      )}
    </Panel>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CeoIntelPage() {
  const [zip,     setZip]     = useState("32082");
  const [query,   setQuery]   = useState("");
  const [data,    setData]    = useState<CeoAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(false);

  const fetchAssessment = useCallback(async (z: string, q: string) => {
    setLoading(true); setError(false);
    const params = new URLSearchParams({ zip: z });
    if (q.trim()) params.set("q", q.trim());
    const result = await safeFetch<CeoAssessment | null>(
      `${RAILWAY}/api/local-intel/ceo-assess?${params}`, ADMIN_HDR, null
    );
    if (!result?.zip) { setError(true); setData(null); }
    else               { setData(result); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAssessment(zip, ""); }, [zip, fetchAssessment]);

  const handleAsk = () => fetchAssessment(zip, query);
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") handleAsk(); };

  const d = data;

  return (
    <div style={{ flex:1, overflowY:"auto", padding:24, background:C.bg }}>

      {/* ── Header ── */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700, color:C.text, display:"flex", alignItems:"center", gap:10, margin:0 }}>
          <BrainCircuit size={20} style={{ color:C.green }} />
          CEO Intelligence
        </h1>
        <p style={{ fontSize:12, color:C.dim, marginTop:4, marginBottom:0 }}>
          ZIP-level market briefs — 17 government data nodes, zero hallucination
        </p>
      </div>

      {/* ── ZIP pills ── */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
        {TARGET_ZIPS.map(z => {
          const sel = z === zip;
          return (
            <button key={z} onClick={() => setZip(z)} style={{
              padding:"8px 16px", borderRadius:99, fontSize:13,
              fontFamily:"monospace", fontWeight:600, cursor:"pointer",
              background: sel ? `${C.green}14` : C.card,
              border: `1px solid ${sel ? C.green : C.border}`,
              color:  sel ? C.green : C.dim, transition:"all 200ms"
            }}>{z}</button>
          );
        })}
      </div>

      {/* ── CEO> prompt bar ── */}
      <Panel style={{ marginBottom:20, padding:"8px 12px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color:C.green,
                          padding:"6px 10px", background:`${C.green}14`, borderRadius:6,
                          border:`1px solid ${C.green}40` }}>CEO&gt;</span>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKey}
                 placeholder="context for this brief — e.g. 'restaurant site selection', 'real estate entry', 'competitive landscape'..."
                 style={{ flex:1, background:"transparent", border:"none", outline:"none",
                           color:C.text, fontSize:14, padding:"8px 4px" }} />
          <button onClick={handleAsk} disabled={loading} style={{
            display:"flex", alignItems:"center", gap:6,
            padding:"8px 18px", borderRadius:8, fontSize:13, fontWeight:600,
            background: loading ? "hsl(0 0% 10%)" : `${C.green}1a`,
            border: `1px solid ${loading ? "hsl(0 0% 18%)" : C.green}`,
            color: loading ? C.dim : C.green, cursor: loading ? "default" : "pointer", transition:"all 200ms"
          }}>
            <Send size={13} />{loading ? "Assessing…" : "Assess"}
          </button>
        </div>
      </Panel>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <Panel><Skeleton h={20} w="50%" /><div style={{ marginTop:12 }}><Skeleton h={14} /></div><div style={{ marginTop:8 }}><Skeleton h={14} w="80%" /></div></Panel>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <Panel><Skeleton h={160} /></Panel><Panel><Skeleton h={160} /></Panel>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <Panel style={{ textAlign:"center", padding:40 }}>
          <span style={{ fontSize:13, color:C.dim }}>No assessment available for ZIP {zip}</span>
        </Panel>
      )}

      {/* ── Results ── */}
      {!loading && !error && d && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* Executive Summary */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.green}`,
                         borderRadius:12, padding:"24px 28px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <Cpu size={15} style={{ color:C.green }} />
              <span style={{ fontSize:11, color:C.green, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>
                Executive Summary · ZIP {d.zip}
              </span>
              {d.populated_sections?.length > 0 && (
                <span style={{ marginLeft:"auto", fontSize:10, color:C.dim }}>
                  {d.populated_sections.length} section{d.populated_sections.length !== 1 ? "s" : ""} populated
                </span>
              )}
            </div>
            <p style={{ fontSize:16, lineHeight:1.6, color:C.text, fontStyle:"italic",
                         margin:0, fontFamily:"Georgia, serif" }}>
              &ldquo;{d.ceo_summary || "No summary available."}&rdquo;
            </p>
            <div style={{ fontSize:11, color:C.dim, marginTop:14, display:"flex", alignItems:"center", gap:6 }}>
              <Clock size={11} />
              Assessed {fmtDate(d.assessed_at)}
              {d.query_context && (<><span style={{ margin:"0 4px" }}>·</span>
                <span style={{ fontFamily:"monospace", color:C.mid }}>query: {d.query_context}</span></>)}
            </div>
            {/* Populated section pills */}
            {d.populated_sections?.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:12 }}>
                {d.populated_sections.map(s => (
                  <span key={s} style={{ padding:"2px 8px", borderRadius:99, fontSize:10,
                                          background:`${C.green}12`, border:`1px solid ${C.green}30`,
                                          color:C.green, fontFamily:"monospace" }}>{s}</span>
                ))}
              </div>
            )}
          </div>

          {/* World Model — full width if present */}
          {d.world_model && <WorldModelPanel d={d.world_model} />}

          {/* Two-column grid for main data sections */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {d.demographics && <DemographicsPanel d={d.demographics} />}
            {d.income        && <IncomePanel       d={d.income} />}
            {d.migration     && <MigrationPanel    d={d.migration} />}
            {d.labor         && <LaborPanel        d={d.labor} />}
            {d.sectors       && <SectorsPanel      d={d.sectors} />}
            {d.jobs          && <JobsPanel         d={d.jobs} />}
          </div>

          {/* Business activity — full width (has bar chart) */}
          {d.business_activity && <BusinessPanel d={d.business_activity} />}

          {/* Two-column grid for remaining sections */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {d.property      && <PropertyPanel      d={d.property} />}
            {d.construction  && <ConstructionPanel  d={d.construction} />}
            {d.broadband     && <BroadbandPanel     d={d.broadband} />}
          </div>

          {/* Demand — full width */}
          {d.demand && <DemandPanel d={d.demand} />}

        </div>
      )}
    </div>
  );
}
