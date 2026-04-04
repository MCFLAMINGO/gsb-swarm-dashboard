/**
 * GSB Master Context Provider (MCP) Client
 * Fetches env vars and shared state from Railway MCP endpoint.
 * All Vercel agents use this instead of process.env directly.
 *
 * Usage:
 *   import { mcp } from '@/lib/mcp'
 *   const apiKey = await mcp.get('env:X_API_KEY')
 *   const all = await mcp.all()
 */

const MCP_BASE = 'https://gsb-swarm-production.up.railway.app';
const MCP_SECRET = process.env.MCP_SECRET || 'gsb-mcp-2026';

// In-memory cache so we don't hammer Railway on every request
let _cache: Record<string, string | null> = {};
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 60 seconds

async function fetchMCP(): Promise<Record<string, string | null>> {
  if (Date.now() - _cacheTime < CACHE_TTL && Object.keys(_cache).length > 0) {
    return _cache;
  }
  try {
    const res = await fetch(`${MCP_BASE}/api/mcp?secret=${MCP_SECRET}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`MCP fetch failed: ${res.status}`);
    const data = await res.json();
    _cache = data.data || {};
    _cacheTime = Date.now();
    return _cache;
  } catch (e) {
    console.warn('[mcp] Could not reach Railway MCP:', e);
    return _cache; // return stale cache on error
  }
}

export const mcp = {
  /** Get a single key. env:X_API_KEY pulls from Railway env vars. */
  async get(key: string): Promise<string | null> {
    // Check local process.env first for env: keys (in case they're set on Vercel too)
    if (key.startsWith('env:')) {
      const envKey = key.slice(4);
      if (process.env[envKey]) return process.env[envKey]!;
    }
    const store = await fetchMCP();
    return store[key] ?? null;
  },

  /** Get all keys (with env: keys if secret is correct) */
  async all(): Promise<Record<string, string | null>> {
    return fetchMCP();
  },

  /** Set a key on the Railway MCP (persisted) */
  async set(key: string, value: string): Promise<boolean> {
    try {
      const res = await fetch(`${MCP_BASE}/api/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, secret: MCP_SECRET }),
      });
      if (res.ok) {
        _cache[key] = value; // update local cache
        return true;
      }
    } catch (e) {
      console.warn('[mcp] Set failed:', e);
    }
    return false;
  },

  /** Convenience: get X API credentials as an object */
  async xCredentials(): Promise<{
    apiKey: string; apiSecret: string; accessToken: string; accessTokenSecret: string;
  } | null> {
    const [apiKey, apiSecret, accessToken, accessTokenSecret] = await Promise.all([
      this.get('env:X_API_KEY'),
      this.get('env:X_API_SECRET'),
      this.get('env:X_ACCESS_TOKEN'),
      this.get('env:X_ACCESS_TOKEN_SECRET'),
    ]);
    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) return null;
    return { apiKey, apiSecret, accessToken, accessTokenSecret };
  },

  /** Convenience: get Telegram credentials */
  async telegramCredentials(): Promise<{ botToken: string; channelId: string } | null> {
    const [botToken, channelId] = await Promise.all([
      this.get('env:TELEGRAM_BOT_TOKEN'),
      this.get('env:TELEGRAM_CHANNEL_ID'),
    ]);
    if (!botToken || !channelId) return null;
    return { botToken, channelId };
  },

  /** Convenience: get Anthropic API key */
  async anthropicKey(): Promise<string | null> {
    return this.get('env:ANTHROPIC_API_KEY');
  },
};
