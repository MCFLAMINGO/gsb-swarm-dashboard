"use client";

import { useState, useRef, useEffect } from "react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Business {
  name: string;
  category: string;
  address?: string;
  phone?: string;
  website?: string;
  hours?: string;
  confidence: number;
  zip?: string;
  distance_miles?: number;
  possibly_closed?: boolean;
  staleness?: { tier: string; grade: string; age_days: number | null; freshness_warning: string | null };
}

interface OracleData {
  zip: string;
  name: string;
  oracle_narrative: string;
  restaurant_capacity: {
    restaurant_count: number;
    capture_rate_pct: number;
    saturation_status: string;
    gap_count: number;
    tier_breakdown: Record<string, number>;
  };
  market_gaps: {
    price_tier_gaps: Array<{ tier: string; gap: number; status: string; description: string; actual_count: number; expected_count: number }>;
    top_gap: { tier: string; description: string; gap: number };
  };
  growth_trajectory: { state: string; label: string; confidence: string };
  top_questions: Array<{ question: string; answer: string; signal_strength: string; category: string }>;
  demographics: { population: number; median_household_income: number; median_home_value: number };
  trend?: { cycles: number; capture_rate: string; saturation_streak: number };
}

// ── Intent detection ──────────────────────────────────────────────────────────

const ORACLE_TRIGGERS = [
  /room for (a|another)/i,
  /should i open/i,
  /is there (a )?gap/i,
  /market.*saturat/i,
  /saturat/i,
  /upscale|fine dining|casual dining/i,
  /price.*gap|gap.*price/i,
  /growing|empty nest|trajectory/i,
  /opportunity/i,
  /restaurant.*32\d{3}/i,
  /32\d{3}.*restaurant/i,
  /dining.*32\d{3}/i,
  /what.*missing/i,
  /how many restaurant/i,
  /demand|supply/i,
];

function detectOracleIntent(q: string): { triggered: boolean; zip: string | null } {
  const zipMatch = q.match(/\b(32081|32082)\b/);
  const zip = zipMatch ? zipMatch[1] : null;
  const triggered = ORACLE_TRIGGERS.some(r => r.test(q));
  // Also trigger if query is about restaurants + has a ZIP
  const restaurantZip = zip && /restaurant|dining|food|eat|cafe|bar/i.test(q);
  return { triggered: triggered || !!restaurantZip, zip };
}

// ── Query parser ──────────────────────────────────────────────────────────────

// Strip search noise so backend gets clean terms
// e.g. "restaurants in Nocatee" → "restaurant"
// e.g. "dentists near Ponte Vedra" → "dentist"
const STOP_WORDS = new Set(['best','top','good','great','closest','nearby','around','here','places','spots','shops','open','now','today','local','find','show','get','near','the','and','for','in','at','of','a','an']);

function cleanQueryTerm(term: string): string {
  const QUERY_ALIASES: Record<string, string> = {
    'restaurants': 'restaurant', 'dining': 'restaurant', 'food': 'restaurant',
    'eats': 'restaurant', 'eateries': 'restaurant', 'eatery': 'restaurant',
    'cafes': 'cafe', 'coffee': 'cafe', 'coffee shops': 'cafe',
    'bars': 'bar', 'pubs': 'bar', 'pub': 'bar', 'fast food': 'fast_food',
    'dentists': 'dentist', 'doctors': 'clinic', 'doctor': 'clinic', 'clinics': 'clinic', 'medical': 'clinic',
    'vet': 'veterinary', 'vets': 'veterinary',
    'gym': 'fitness_centre', 'gyms': 'fitness_centre', 'fitness': 'fitness_centre',
    'grocery': 'supermarket', 'groceries': 'supermarket',
    'gas': 'fuel', 'gas station': 'fuel', 'gas stations': 'fuel',
    'pharmacy': 'chemist', 'pharmacies': 'chemist', 'drug store': 'chemist',
    'salons': 'hairdresser', 'salon': 'hairdresser', 'hair': 'hairdresser', 'beauty': 'hairdresser',
    'banks': 'bank', 'atms': 'atm',
    'realtors': 'estate_agent', 'realtor': 'estate_agent', 'real estate': 'estate_agent',
    'lawyers': 'legal', 'attorney': 'legal', 'attorneys': 'legal',
    'hotels': 'hotel', 'motels': 'hotel',
    'pizza': 'restaurant', 'sushi': 'restaurant', 'tacos': 'restaurant',
  };
  // Strip stop words from multi-word terms before alias lookup
  const t = term.toLowerCase().trim()
    .split(/\s+/).filter(w => !STOP_WORDS.has(w)).join(' ');
  if (!t) return term.toLowerCase().trim();
  if (QUERY_ALIASES[t]) return QUERY_ALIASES[t];
  // Simple de-plural (min length 5 to avoid clobbering short words like 'pub')
  if (t.endsWith('s') && t.length >= 5) {
    const singular = t.slice(0, -1);
    if (QUERY_ALIASES[singular]) return QUERY_ALIASES[singular];
    return singular;
  }
  return t;
}

function parseQuery(q: string): { tool: string; params: Record<string, string | number> } {
  const s = q.toLowerCase().trim();

  // Extract any 5-digit ZIP from the query
  const zipMatch = s.match(/\b(\d{5})\b/);
  const zip = zipMatch ? zipMatch[1] : null;

  const nearbyMatch = s.match(/(?:near(?:by|est)?|closest|around)\s+(.+)|(.+)\s+near(?:by)?/);
  if (nearbyMatch) {
    const cat = cleanQueryTerm((nearbyMatch[1] || nearbyMatch[2] || "").trim());
    return { tool: "local_intel_nearby", params: { lat: 30.1893, lon: -81.3815, radius_miles: 2, category: cat, limit: 10 } };
  }

  // "X in ZIPCODE" or "X in city name"
  const catZipMatch = s.match(/(?:all\s+)?([\w\s]+?)\s+in\s+(?:(\d{5})|nocatee|ponte vedra|st\.?\s*johns?|st\.?\s*augustine|jacksonville|tampa|orlando)/);
  if (catZipMatch) {
    const rawTerm = catZipMatch[1].trim();
    const term = cleanQueryTerm(rawTerm);
    // Resolve city name to ZIP if no numeric ZIP found
    const cityToZip: Record<string, string> = {
      'nocatee': '32081', 'ponte vedra': '32082', 'ponte vedra beach': '32082',
      'st johns': '32092', 'saint johns': '32092', 'st augustine': '32084',
      'saint augustine': '32084',
    };
    const cityMatch = s.match(/in\s+([a-z\s.]+?)(?:\s*$|\s+\d)/);
    const cityKey = cityMatch ? cityMatch[1].trim().replace(/\.$/, '') : '';
    const resolvedZip = zip || cityToZip[cityKey] || null;
    const params: Record<string, string | number> = { query: term, limit: 20 };
    if (resolvedZip) params.zip = resolvedZip;
    return { tool: "local_intel_search", params };
  }

  // Bare category query with a ZIP somewhere in the string
  if (zip) {
    const withoutZip = s.replace(/\b\d{5}\b/, '').trim();
    const term = cleanQueryTerm(withoutZip || s);
    return { tool: "local_intel_search", params: { query: term, zip, limit: 20 } };
  }

  // Default: pass cleaned query, no ZIP filter (search all)
  const term = cleanQueryTerm(s);
  return { tool: "local_intel_search", params: { query: term, limit: 20 } };
}

// ── MCP call ──────────────────────────────────────────────────────────────────

async function callMCP(tool: string, args: Record<string, unknown>) {
  const res = await fetch(`${RAILWAY}/api/local-intel/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: args } }),
  });
  const json = await res.json();
  const raw = json.result ?? json;
  try {
    if (raw?.content?.[0]?.text) return JSON.parse(raw.content[0].text);
  } catch { /* fall through */ }
  return raw;
}

// ── Signal strength color ─────────────────────────────────────────────────────

function signalColor(s: string) {
  if (s === "strong") return "#137333";
  if (s === "moderate") return "#e37400";
  return "#5f6368";
}

// ── Staleness badge ───────────────────────────────────────────────────────────

function FreshnessBadge({ tier }: { tier?: string }) {
  if (!tier || tier === "FRESH") return null;
  const colors: Record<string, { bg: string; text: string }> = {
    WARM:  { bg: "#fef9c3", text: "#854d0e" },
    STALE: { bg: "#ffedd5", text: "#9a3412" },
    COLD:  { bg: "#fee2e2", text: "#991b1b" },
  };
  const c = colors[tier] ?? { bg: "#f3f4f6", text: "#374151" };
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 99, background: c.bg, color: c.text }}>
      {tier}
    </span>
  );
}

// ── Suggestions ───────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "restaurants in Nocatee",
  "dentists in Ponte Vedra Beach",
  "coffee shops 32081",
  "gyms in 32082",
  "Publix",
  "Is there room for another restaurant in 32082?",
];

// ── Oracle Answer Card ────────────────────────────────────────────────────────

function OracleCard({ oracle, query }: { oracle: OracleData; query: string }) {
  const [expanded, setExpanded] = useState(false);
  const rc = oracle.restaurant_capacity;
  const tg = oracle.growth_trajectory;
  const topGap = oracle.market_gaps?.top_gap;

  // Pick the most relevant question based on query
  const q = query.toLowerCase();
  let featuredQ = oracle.top_questions?.[0];
  if (/gap|missing|upscale|price|what/.test(q)) {
    featuredQ = oracle.top_questions?.find(tq => tq.category === "category_gap") ?? featuredQ;
  } else if (/room|another|open|should/.test(q)) {
    featuredQ = oracle.top_questions?.find(tq => tq.category === "restaurant_gap") ?? featuredQ;
  } else if (/grow|trend|empty|stable/.test(q)) {
    featuredQ = oracle.top_questions?.find(tq => tq.category === "growth_trajectory") ?? featuredQ;
  }

  return (
    <div style={{
      border: "1px solid #1a73e8",
      borderRadius: 12,
      padding: "20px 24px",
      marginBottom: 20,
      background: "#f8fbff",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: "#1a73e8", fontWeight: 600, letterSpacing: "0.03em" }}>
          LOCALINTEL ORACLE · {oracle.name} ({oracle.zip})
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {oracle.trend && oracle.trend.cycles >= 2 && (
            <span style={{ fontSize: 11, color: "#5f6368" }}>
              {oracle.trend.capture_rate === "up" ? "↑" : oracle.trend.capture_rate === "down" ? "↓" : "→"} {oracle.trend.cycles} cycles
            </span>
          )}
          <span style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 99,
            background: rc.saturation_status === "undersupplied" ? "#dcfce7" : "#fee2e2",
            color: rc.saturation_status === "undersupplied" ? "#166534" : "#991b1b",
            fontWeight: 600,
          }}>
            {rc.saturation_status === "undersupplied" ? "GAP EXISTS" : "SATURATED"}
          </span>
        </div>
      </div>

      {/* Featured answer */}
      {featuredQ && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: "#5f6368", marginBottom: 4 }}>{featuredQ.question}</div>
          <div style={{ fontSize: 17, color: "#202124", fontWeight: 500, lineHeight: 1.4 }}>
            {featuredQ.answer}
          </div>
        </div>
      )}

      {/* Key stats row */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#5f6368" }}>
          <span style={{ fontWeight: 600, color: "#202124" }}>{rc.restaurant_count}</span> restaurants
        </div>
        <div style={{ fontSize: 12, color: "#5f6368" }}>
          <span style={{ fontWeight: 600, color: "#202124" }}>{rc.capture_rate_pct}%</span> demand captured
        </div>
        <div style={{ fontSize: 12, color: "#5f6368" }}>
          <span style={{ fontWeight: 600, color: rc.gap_count > 0 ? "#137333" : "#5f6368" }}>
            {rc.gap_count > 0 ? `+${rc.gap_count}` : "0"}
          </span> more the market can support
        </div>
        <div style={{ fontSize: 12, color: "#5f6368" }}>
          <span style={{ fontWeight: 600, color: "#202124" }}>{tg.label}</span>
        </div>
        {topGap && (
          <div style={{ fontSize: 12, color: "#5f6368" }}>
            Top gap: <span style={{ fontWeight: 600, color: "#1a73e8" }}>{topGap.description}</span>
          </div>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ fontSize: 12, color: "#1a73e8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        {expanded ? "▲ Less detail" : "▼ Full oracle report"}
      </button>

      {expanded && (
        <div style={{ marginTop: 14, borderTop: "1px solid #e8eaed", paddingTop: 14 }}>
          {/* Narrative */}
          <div style={{ fontSize: 13, color: "#202124", lineHeight: 1.6, marginBottom: 14 }}>
            {oracle.oracle_narrative}
          </div>

          {/* Price tier gaps */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#5f6368", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Price Tier Analysis
            </div>
            {oracle.market_gaps.price_tier_gaps.map((tier, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ width: 70, fontSize: 12, color: "#202124", fontWeight: 500, textTransform: "capitalize" }}>{tier.tier}</div>
                <div style={{ flex: 1, height: 6, borderRadius: 99, background: "#e8eaed", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    background: tier.actual_count === 0 ? "#d93025" : tier.gap > 0 ? "#f9ab00" : "#137333",
                    width: `${Math.min(100, (tier.actual_count / Math.max(tier.expected_count, 1)) * 100)}%`,
                  }} />
                </div>
                <div style={{ fontSize: 11, color: "#5f6368", whiteSpace: "nowrap" }}>
                  {tier.actual_count}/{tier.expected_count} · {tier.description}
                </div>
              </div>
            ))}
          </div>

          {/* All 3 questions */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#5f6368", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Oracle Q&A
            </div>
            {oracle.top_questions.map((tq, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "#5f6368", marginBottom: 2 }}>{tq.question}</div>
                <div style={{ fontSize: 13, color: "#202124", lineHeight: 1.5 }}
                  dangerouslySetInnerHTML={{ __html: tq.answer }} />
                <div style={{ fontSize: 10, color: signalColor(tq.signal_strength), marginTop: 2, fontWeight: 600 }}>
                  {tq.signal_strength.toUpperCase()} SIGNAL
                </div>
              </div>
            ))}
          </div>

          {/* Demo + income */}
          <div style={{ fontSize: 12, color: "#70757a", marginTop: 10, paddingTop: 10, borderTop: "1px solid #e8eaed" }}>
            Pop. {oracle.demographics.population.toLocaleString()} ·
            Median HHI ${oracle.demographics.median_household_income.toLocaleString()} ·
            Median home ${oracle.demographics.median_home_value.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LocalIntelSearchPage() {
  const [query, setQuery]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [results, setResults]   = useState<Business[] | null>(null);
  const [oracle, setOracle]     = useState<OracleData | null>(null);
  const [total, setTotal]       = useState(0);
  const [error, setError]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setResults(null);
    setOracle(null);
    setError(null);

    try {
      const { triggered, zip } = detectOracleIntent(q);
      const { tool, params } = parseQuery(q);

      // Run search + oracle in parallel when oracle is triggered
      const searchPromise = callMCP(tool, params as Record<string, unknown>);
      const oraclePromise = triggered
        ? callMCP("local_intel_oracle", { zip: zip ?? "32082" })
        : Promise.resolve(null);

      const [searchData, oracleData] = await Promise.all([searchPromise, oraclePromise]);

      setResults(searchData.results ?? []);
      setTotal(searchData.total ?? searchData.results?.length ?? 0);
      if (oracleData && !oracleData.error) setOracle(oracleData);

    } catch {
      setError("Could not reach LocalIntel. Check Railway backend.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "arial, sans-serif", color: "#202124" }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #e8eaed", padding: "12px 24px", display: "flex", alignItems: "center", gap: 24 }}>
        <span style={{ fontSize: 22, fontWeight: 400, color: "#5f6368", letterSpacing: "-0.5px" }}>
          Local<span style={{ color: "#1a73e8", fontWeight: 700 }}>Intel</span>
        </span>
        <span style={{ fontSize: 12, color: "#80868b", borderLeft: "1px solid #e8eaed", paddingLeft: 16 }}>
          St. Johns County · Ponte Vedra Beach · Nocatee
        </span>
      </div>

      {/* Search area */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: results !== null ? "24px 24px 16px" : "80px 24px 0",
        transition: "padding 300ms",
      }}>
        {results === null && (
          <div style={{ fontSize: 42, fontWeight: 400, color: "#5f6368", marginBottom: 28, letterSpacing: "-1px" }}>
            Local<span style={{ color: "#1a73e8", fontWeight: 700 }}>Intel</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 620 }}>
          <div style={{
            display: "flex", alignItems: "center",
            border: "1px solid #dfe1e5", borderRadius: 24,
            padding: "10px 16px",
            boxShadow: "0 1px 6px rgba(32,33,36,.28)",
            background: "#fff", gap: 10,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ask anything — 'room for a restaurant in 32082?' or 'dentist near Ponte Vedra'"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 15, color: "#202124", background: "transparent" }}
            />
            {query && (
              <button type="button"
                onClick={() => { setQuery(""); setResults(null); setOracle(null); inputRef.current?.focus(); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#9aa0a6" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
            {loading && (
              <div style={{ width: 18, height: 18, border: "2px solid #e8eaed", borderTopColor: "#1a73e8", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            )}
          </div>

          {results === null && !loading && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 20 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} type="button"
                  onClick={() => { setQuery(s); runSearch(s); }}
                  style={{
                    padding: "6px 14px", borderRadius: 99,
                    border: "1px solid #dfe1e5", background: "#fff",
                    fontSize: 13, color: "#202124", cursor: "pointer",
                  }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* Results */}
      {error && (
        <div style={{ maxWidth: 620, margin: "24px auto", padding: "0 24px", fontSize: 14, color: "#d93025" }}>
          {error}
        </div>
      )}

      {results !== null && !loading && (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 48px" }}>

          {/* Oracle card — shown when intent detected */}
          {oracle && <OracleCard oracle={oracle} query={query} />}

          {/* Result count */}
          {results.length > 0 && (
            <div style={{ fontSize: 13, color: "#70757a", marginBottom: 12 }}>
              {oracle ? "Related businesses — " : ""}About {total.toLocaleString()} result{total !== 1 ? "s" : ""}
            </div>
          )}

          {/* Business list */}
          {results.map((biz, i) => (
            <div key={i} style={{ padding: "16px 0", borderBottom: i < results.length - 1 ? "1px solid #e8eaed" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                {biz.website ? (
                  <a href={biz.website} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 18, color: "#1558d6", textDecoration: "none", fontWeight: 400 }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}>
                    {biz.name}
                  </a>
                ) : (
                  <span style={{ fontSize: 18, color: "#202124", fontWeight: 400 }}>{biz.name}</span>
                )}
                <FreshnessBadge tier={biz.staleness?.tier} />
              </div>
              <div style={{ fontSize: 13, color: "#006621", marginBottom: 4 }}>
                {biz.category}
                {biz.address && ` · ${biz.address}`}
                {biz.zip && ` · ${biz.zip}`}
                {biz.distance_miles != null && ` · ${biz.distance_miles.toFixed(1)}mi`}
              </div>
              <div style={{ fontSize: 14, color: "#4d5156", display: "flex", flexWrap: "wrap", gap: 14 }}>
                {biz.phone && <span>{biz.phone}</span>}
                {biz.hours && <span>{biz.hours}</span>}
                {biz.possibly_closed && <span style={{ color: "#e37400" }}>⚠ May be closed</span>}
              </div>
            </div>
          ))}

          {results.length === 0 && !oracle && (
            <div style={{ fontSize: 14, color: "#5f6368", padding: "20px 0" }}>
              No businesses matched that query in the current LocalIntel dataset.
            </div>
          )}

          {results.length === 0 && oracle && (
            <div style={{ fontSize: 14, color: "#5f6368", padding: "12px 0" }}>
              No individual business listings matched — oracle data above is based on full ZIP dataset.
            </div>
          )}

          <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #e8eaed", fontSize: 12, color: "#9aa0a6" }}>
            LocalIntel · {oracle ? "Oracle + " : ""}Live dataset · St. Johns County FL
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
  );
}
