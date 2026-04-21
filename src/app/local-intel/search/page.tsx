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
  distance_miles?: number;
  possibly_closed?: boolean;
  staleness?: { tier: string; grade: string; age_days: number | null; freshness_warning: string | null };
}

interface SearchResult {
  total: number;
  returned: number;
  results: Business[];
  data_freshness?: { grade: string; freshness_warning: string | null };
}

// ── Intent parser ─────────────────────────────────────────────────────────────
// Maps natural language to MCP tool + params without an LLM

function parseQuery(q: string): { tool: string; params: Record<string, string | number> } {
  const s = q.toLowerCase().trim();

  // Phone lookup: "phone number for X" / "call X"
  const phoneMatch = s.match(/(?:phone|number|call|contact)\s+(?:for|of)?\s*(.+)/);
  if (phoneMatch) {
    return { tool: "local_intel_search", params: { query: phoneMatch[1].trim(), limit: 5 } };
  }

  // Hours: "hours for X" / "is X open"
  const hoursMatch = s.match(/(?:hours?|open|close|closing)\s+(?:for|of)?\s*(.+)/);
  if (hoursMatch) {
    return { tool: "local_intel_search", params: { query: hoursMatch[1].trim(), limit: 5 } };
  }

  // Nearby: "near me" / "closest X" / "X near"
  const nearbyMatch = s.match(/(?:near(?:by|est)?|closest|around)\s+(.+)|(.+)\s+near(?:by)?/);
  if (nearbyMatch) {
    const cat = (nearbyMatch[1] || nearbyMatch[2] || "").trim();
    return {
      tool: "local_intel_nearby",
      params: { lat: 30.1893, lon: -81.3815, radius_miles: 2, category: cat, limit: 10 },
    };
  }

  // Category searches: "all restaurants in 32082"
  const catZipMatch = s.match(/(?:all\s+)?(\w+)\s+in\s+(\d{5})/);
  if (catZipMatch) {
    return {
      tool: "local_intel_search",
      params: { zip: catZipMatch[2], query: catZipMatch[1], limit: 20 },
    };
  }

  // ZIP context: "what's in 32082" / "show me 32081"
  const zipMatch = s.match(/\b(3\d{4})\b/);
  if (zipMatch && (s.includes("what") || s.includes("show") || s.includes("in") || s.includes("around"))) {
    return { tool: "local_intel_search", params: { zip: zipMatch[1], limit: 20 } };
  }

  // Default: keyword search
  return { tool: "local_intel_search", params: { query: q, limit: 10 } };
}

// ── Format answer ─────────────────────────────────────────────────────────────

function formatAnswer(query: string, biz: Business): string {
  const s = query.toLowerCase();
  if (s.includes("phone") || s.includes("number") || s.includes("call") || s.includes("contact")) {
    return biz.phone ? `${biz.phone}` : "No phone number on record.";
  }
  if (s.includes("hour") || s.includes("open") || s.includes("close")) {
    return biz.hours ? `${biz.hours}` : "Hours not on record.";
  }
  if (s.includes("website") || s.includes("url") || s.includes("web") || s.includes("online")) {
    return biz.website ? `${biz.website}` : "No website on record.";
  }
  if (s.includes("address") || s.includes("where") || s.includes("located")) {
    return biz.address ? `${biz.address}` : "Address not on record.";
  }
  return biz.address || biz.phone || biz.hours || "Found — see details below.";
}

// ── Suggestion chips ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "phone number for Aqua Bar and Grill",
  "restaurants in 32082",
  "dentist near Ponte Vedra",
  "hours for Publix Nocatee",
  "what's in 32081",
  "banks near me",
];

// ── Staleness badge ───────────────────────────────────────────────────────────

function FreshnessBadge({ tier }: { tier?: string }) {
  if (!tier) return null;
  const colors: Record<string, { bg: string; text: string }> = {
    FRESH: { bg: "#dcfce7", text: "#166534" },
    WARM:  { bg: "#fef9c3", text: "#854d0e" },
    STALE: { bg: "#ffedd5", text: "#9a3412" },
    COLD:  { bg: "#fee2e2", text: "#991b1b" },
  };
  const c = colors[tier] ?? { bg: "#f3f4f6", text: "#374151" };
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 99,
      background: c.bg, color: c.text, letterSpacing: "0.04em",
    }}>
      {tier}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LocalIntelSearchPage() {
  const [query, setQuery]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [results, setResults]     = useState<Business[] | null>(null);
  const [answer, setAnswer]       = useState<string | null>(null);
  const [topMatch, setTopMatch]   = useState<Business | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [freshness, setFreshness] = useState<{ grade: string; freshness_warning: string | null } | null>(null);
  const [total, setTotal]         = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setResults(null);
    setAnswer(null);
    setTopMatch(null);
    setError(null);
    setFreshness(null);

    try {
      const { tool, params } = parseQuery(q);
      const body = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: tool, arguments: params },
      };
      const res = await fetch(`${RAILWAY}/api/local-intel/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      // MCP wraps tool output in result.content[0].text (JSON string) — unwrap it
      const raw = json.result ?? json;
      const data: SearchResult = (() => {
        try {
          if (raw?.content?.[0]?.text) return JSON.parse(raw.content[0].text);
        } catch { /* fall through */ }
        return raw;
      })();

      if (data.results && data.results.length > 0) {
        setResults(data.results);
        setTotal(data.total ?? data.results.length);
        setTopMatch(data.results[0]);
        setAnswer(formatAnswer(q, data.results[0]));
        setFreshness(data.data_freshness ?? null);
      } else {
        setResults([]);
        setAnswer("No results found in the LocalIntel dataset for that query.");
      }
    } catch (e) {
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
    <div style={{
      minHeight: "100vh",
      background: "#fff",
      fontFamily: "arial, sans-serif",
      color: "#202124",
    }}>

      {/* ── Header ── */}
      <div style={{
        borderBottom: "1px solid #e8eaed",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        gap: 24,
      }}>
        <span style={{ fontSize: 22, fontWeight: 400, color: "#5f6368", letterSpacing: "-0.5px" }}>
          Local<span style={{ color: "#1a73e8", fontWeight: 700 }}>Intel</span>
        </span>
        <span style={{ fontSize: 12, color: "#80868b", borderLeft: "1px solid #e8eaed", paddingLeft: 16 }}>
          St. Johns County · Ponte Vedra Beach · Nocatee
        </span>
      </div>

      {/* ── Search area ── */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: results ? "24px 24px 16px" : "80px 24px 0",
        transition: "padding 300ms",
      }}>
        {!results && (
          <div style={{ fontSize: 42, fontWeight: 400, color: "#5f6368", marginBottom: 28, letterSpacing: "-1px" }}>
            Local<span style={{ color: "#1a73e8", fontWeight: 700 }}>Intel</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 600 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            border: "1px solid #dfe1e5",
            borderRadius: 24,
            padding: "10px 16px",
            boxShadow: "0 1px 6px rgba(32,33,36,.28)",
            background: "#fff",
            gap: 10,
          }}>
            {/* Search icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ask anything about local businesses…"
              style={{
                flex: 1, border: "none", outline: "none",
                fontSize: 16, color: "#202124", background: "transparent",
              }}
            />
            {query && (
              <button type="button" onClick={() => { setQuery(""); setResults(null); setAnswer(null); inputRef.current?.focus(); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#9aa0a6" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
            {loading && (
              <div style={{
                width: 18, height: 18, border: "2px solid #e8eaed",
                borderTopColor: "#1a73e8", borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }} />
            )}
          </div>

          {/* Suggestion chips — only on empty state */}
          {!results && !loading && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 20 }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setQuery(s); runSearch(s); }}
                  style={{
                    padding: "6px 14px", borderRadius: 99,
                    border: "1px solid #dfe1e5", background: "#fff",
                    fontSize: 13, color: "#202124", cursor: "pointer",
                    transition: "box-shadow 150ms",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(32,33,36,.2)")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* ── Results ── */}
      {error && (
        <div style={{ maxWidth: 600, margin: "24px auto", padding: "0 24px", fontSize: 14, color: "#d93025" }}>
          {error}
        </div>
      )}

      {results && !loading && (
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 48px" }}>

          {/* ── Top answer card ── */}
          {topMatch && answer && (
            <div style={{
              border: "1px solid #e8eaed",
              borderRadius: 12,
              padding: "20px 24px",
              marginBottom: 20,
              boxShadow: "0 1px 3px rgba(32,33,36,.1)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#1a73e8", fontWeight: 500 }}>LocalIntel · Best match</span>
                <FreshnessBadge tier={topMatch.staleness?.tier} />
              </div>
              <div style={{ fontSize: 22, color: "#202124", fontWeight: 400, marginBottom: 2 }}>
                {answer}
              </div>
              <div style={{ fontSize: 14, color: "#5f6368", marginBottom: 12 }}>
                {topMatch.name} · {topMatch.category}
                {topMatch.address && ` · ${topMatch.address}`}
              </div>

              {/* Detail pills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {topMatch.phone && (
                  <a href={`tel:${topMatch.phone}`} style={{
                    fontSize: 13, padding: "4px 12px", borderRadius: 99,
                    border: "1px solid #dfe1e5", color: "#1a73e8",
                    textDecoration: "none", display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.1a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.48h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 10a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    {topMatch.phone}
                  </a>
                )}
                {topMatch.hours && (
                  <span style={{
                    fontSize: 13, padding: "4px 12px", borderRadius: 99,
                    border: "1px solid #dfe1e5", color: "#202124",
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                    </svg>
                    {topMatch.hours}
                  </span>
                )}
                {topMatch.website && (
                  <a href={topMatch.website} target="_blank" rel="noopener noreferrer" style={{
                    fontSize: 13, padding: "4px 12px", borderRadius: 99,
                    border: "1px solid #dfe1e5", color: "#1a73e8",
                    textDecoration: "none", display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                    Website
                  </a>
                )}
                {topMatch.possibly_closed && (
                  <span style={{
                    fontSize: 13, padding: "4px 12px", borderRadius: 99,
                    border: "1px solid #fde68a", color: "#92400e", background: "#fffbeb",
                  }}>
                    ⚠ May be closed — verify before visiting
                  </span>
                )}
              </div>

              {/* Confidence bar */}
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 3, borderRadius: 99, background: "#f1f3f4", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 99, background: "#1a73e8",
                    width: `${topMatch.confidence}%`,
                  }} />
                </div>
                <span style={{ fontSize: 11, color: "#9aa0a6", whiteSpace: "nowrap" }}>
                  {topMatch.confidence}% confidence
                  {topMatch.staleness?.age_days != null ? ` · ${topMatch.staleness.age_days}d old` : ""}
                </span>
              </div>
            </div>
          )}

          {/* ── Result count + freshness ── */}
          <div style={{
            fontSize: 13, color: "#70757a", marginBottom: 12,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>
              About {total.toLocaleString()} result{total !== 1 ? "s" : ""}
            </span>
            {freshness && (
              <span style={{ fontSize: 12, color: freshness.grade === "A" ? "#137333" : "#e37400" }}>
                Data freshness: {freshness.grade}
                {freshness.freshness_warning ? ` · ${freshness.freshness_warning}` : ""}
              </span>
            )}
          </div>

          {/* ── Result list ── */}
          {results.map((biz, i) => (
            <div key={i} style={{
              padding: "16px 0",
              borderBottom: i < results.length - 1 ? "1px solid #e8eaed" : "none",
            }}>
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
                {biz.distance_miles != null && ` · ${biz.distance_miles.toFixed(1)}mi`}
              </div>
              <div style={{ fontSize: 14, color: "#4d5156", display: "flex", flexWrap: "wrap", gap: 14 }}>
                {biz.phone && <span>{biz.phone}</span>}
                {biz.hours && <span>{biz.hours}</span>}
                {biz.possibly_closed && (
                  <span style={{ color: "#e37400" }}>⚠ May be closed</span>
                )}
              </div>
            </div>
          ))}

          {results.length === 0 && (
            <div style={{ fontSize: 14, color: "#5f6368", padding: "20px 0" }}>
              No businesses matched that query in the current LocalIntel dataset.
            </div>
          )}

          {/* ── Footer attribution ── */}
          <div style={{
            marginTop: 32, paddingTop: 16, borderTop: "1px solid #e8eaed",
            fontSize: 12, color: "#9aa0a6",
          }}>
            LocalIntel · Agent-native business intelligence · St. Johns County FL ·{" "}
            <a href="https://gsb-swarm-production.up.railway.app/api/local-intel/mcp/manifest"
              target="_blank" rel="noopener noreferrer"
              style={{ color: "#1a73e8", textDecoration: "none" }}>
              MCP manifest
            </a>
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
