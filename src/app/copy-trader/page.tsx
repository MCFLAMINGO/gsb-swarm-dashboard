'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Activity, Play, Square, Zap, TrendingUp, TrendingDown, Circle, DollarSign, Target, Shield } from 'lucide-react'

// ── Config ────────────────────────────────────────────────────────────────
const BACKEND = 'https://gsb-swarm-production.up.railway.app'
const EXECUTOR = 'https://gsb-yield-swarm-production.up.railway.app'  // gsb-yield-swarm Railway URL

// ── Types ─────────────────────────────────────────────────────────────────
type FeedEvent = {
  type: 'buy' | 'sell' | 'price_update' | 'info' | 'warn' | 'error' | 'debug'
  message?: string
  symbol?: string
  address?: string
  entryPrice?: number
  currentPrice?: number
  exitPrice?: number
  pnlPct?: number
  pnlUsd?: number
  amountUsd?: number
  mcap?: number
  volume?: number
  reason?: string
  positionId?: string
  txHash?: string
  ts: string
}

type SniperStatus = {
  running: boolean
  startedAt: string | null
  positionSize: number
  openCount: number
  maxPositions: number
  takeProfit: number
  stopLoss: number
  maxHoldHours: number
  recentLog: FeedEvent[]
  openPositions: OpenPosition[]
}

type OpenPosition = {
  id: string
  tokenName: string
  tokenAddress: string
  entryPrice: number
  amount: number
  openedAt: string
  type: string
}

// ── Helpers ───────────────────────────────────────────────────────────────
const fmt = (n: number, d = 2) => n.toFixed(d)
const fmtPrice = (p: number) => p < 0.0001 ? p.toExponential(3) : p < 1 ? p.toFixed(6) : p.toFixed(4)
const fmtUsd = (n: number) => `$${Math.abs(n).toFixed(2)}`
const fmtK = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : `$${(n/1000).toFixed(0)}k`
const age = (ts: string) => {
  const ms = Date.now() - new Date(ts).getTime()
  if (ms < 60000) return `${Math.floor(ms/1000)}s`
  if (ms < 3600000) return `${Math.floor(ms/60000)}m`
  return `${(ms/3600000).toFixed(1)}h`
}

// ── Trade ticker item ─────────────────────────────────────────────────────
function TickerRow({ ev }: { ev: FeedEvent }) {
  const isBuy  = ev.type === 'buy'
  const isSell = ev.type === 'sell'
  const isUp   = (ev.pnlPct ?? 0) >= 0

  if (ev.type === 'price_update') {
    return (
      <div className="flex items-center gap-2 px-3 py-1 text-[11px] font-mono border-b border-white/5 hover:bg-white/[0.02] transition-colors">
        <Circle className="w-2 h-2 text-blue-500 shrink-0" />
        <span className="text-blue-300 font-medium w-16 shrink-0">{ev.symbol}</span>
        <span className="text-muted-foreground">{fmtPrice(ev.currentPrice ?? 0)}</span>
        <span className={`ml-auto font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? '+' : ''}{fmt((ev.pnlPct ?? 0) * 100, 1)}%
        </span>
        <span className="text-muted-foreground text-[10px] w-8 text-right">{age(ev.ts)}</span>
      </div>
    )
  }

  if (isBuy) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono bg-green-950/20 border-b border-green-500/10 hover:bg-green-950/30 transition-colors">
        <TrendingUp className="w-3 h-3 text-green-400 shrink-0" />
        <span className="text-green-300 font-bold w-16 shrink-0">{ev.symbol}</span>
        <span className="text-green-200">{fmtUsd(ev.amountUsd ?? 0)}</span>
        <span className="text-muted-foreground">@ {fmtPrice(ev.entryPrice ?? 0)}</span>
        {ev.mcap && <span className="text-muted-foreground ml-1">mc {fmtK(ev.mcap)}</span>}
        <span className="text-green-400 ml-auto font-bold text-[10px]">BUY</span>
        <span className="text-muted-foreground text-[10px] w-8 text-right">{age(ev.ts)}</span>
      </div>
    )
  }

  if (isSell) {
    const good = (ev.pnlPct ?? 0) >= 0
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono border-b transition-colors ${
        good ? 'bg-emerald-950/20 border-emerald-500/10 hover:bg-emerald-950/30'
              : 'bg-red-950/20 border-red-500/10 hover:bg-red-950/30'
      }`}>
        <TrendingDown className={`w-3 h-3 shrink-0 ${good ? 'text-emerald-400' : 'text-red-400'}`} />
        <span className={`font-bold w-16 shrink-0 ${good ? 'text-emerald-300' : 'text-red-300'}`}>{ev.symbol}</span>
        <span className={good ? 'text-emerald-200' : 'text-red-200'}>
          {good ? '+' : '-'}{fmtUsd(Math.abs(ev.pnlUsd ?? 0))}
        </span>
        <span className={`font-bold ${good ? 'text-emerald-400' : 'text-red-400'}`}>
          {good ? '+' : ''}{fmt((ev.pnlPct ?? 0) * 100, 1)}%
        </span>
        <span className="text-muted-foreground text-[10px] uppercase">{ev.reason?.replace('_',' ')}</span>
        <span className={`ml-auto font-bold text-[10px] ${good ? 'text-emerald-400' : 'text-red-400'}`}>SELL</span>
        <span className="text-muted-foreground text-[10px] w-8 text-right">{age(ev.ts)}</span>
      </div>
    )
  }

  // info/warn/error log line
  const color = ev.type === 'error' ? 'text-red-400' : ev.type === 'warn' ? 'text-yellow-400' : 'text-muted-foreground'
  return (
    <div className={`flex items-center gap-2 px-3 py-0.5 text-[10px] font-mono border-b border-white/5 ${color}`}>
      <span className="opacity-50 shrink-0">{age(ev.ts)}</span>
      <span className="truncate">{ev.message}</span>
    </div>
  )
}

// ── Position card ─────────────────────────────────────────────────────────
function PositionCard({ pos, livePrice }: { pos: OpenPosition; livePrice?: number }) {
  const pnlPct = livePrice && pos.entryPrice
    ? (livePrice - pos.entryPrice) / pos.entryPrice
    : null
  const pnlUsd = pnlPct !== null ? pos.amount * pnlPct : null
  const good = (pnlPct ?? 0) >= 0
  const ageMs = Date.now() - new Date(pos.openedAt).getTime()
  const pctOfHold = Math.min(100, (ageMs / (3 * 3600000)) * 100)

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${good ? 'border-green-500/20 bg-green-950/10' : 'border-red-500/20 bg-red-950/10'}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-bold text-sm">{pos.tokenName}</div>
          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
            {pos.tokenAddress.slice(0,6)}…{pos.tokenAddress.slice(-4)}
          </div>
        </div>
        <div className="text-right">
          {pnlPct !== null ? (
            <>
              <div className={`font-bold text-sm ${good ? 'text-green-400' : 'text-red-400'}`}>
                {good ? '+' : ''}{fmt(pnlPct * 100, 1)}%
              </div>
              <div className={`text-[11px] ${good ? 'text-green-300' : 'text-red-300'}`}>
                {good ? '+' : '-'}{fmtUsd(Math.abs(pnlUsd ?? 0))}
              </div>
            </>
          ) : (
            <div className="text-blue-400 font-bold text-sm">● OPEN</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
        <div>
          <div className="text-[9px] uppercase mb-0.5">Entry</div>
          <div className="font-mono">{fmtPrice(pos.entryPrice)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase mb-0.5">Size</div>
          <div className="font-mono">{fmtUsd(pos.amount)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase mb-0.5">Age</div>
          <div className="font-mono">{age(pos.openedAt)}</div>
        </div>
      </div>

      {/* Time bar — 3h max hold */}
      <div>
        <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
          <span>Hold time</span>
          <span>3h max</span>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pctOfHold > 80 ? 'bg-red-500' : pctOfHold > 50 ? 'bg-yellow-500' : 'bg-blue-500'}`}
            style={{ width: `${pctOfHold}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function CopyTraderPage() {
  const [status, setStatus] = useState<SniperStatus | null>(null)
  const [feed, setFeed]     = useState<FeedEvent[]>([])
  const [posSize, setPosSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [livePrices, setLivePrices] = useState<Record<string, number>>({})
  const [stats, setStats]   = useState({ totalPnl: 0, wins: 0, losses: 0, buys: 0 })
  const feedRef = useRef<HTMLDivElement>(null)
  const esRef   = useRef<EventSource | null>(null)
  const statsRef = useRef(stats)
  statsRef.current = stats

  // ── Fetch status ──────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${EXECUTOR}/api/sniper/status`)
      if (r.ok) {
        const d = await r.json()
        setStatus(d)
        if (d.positionSize) setPosSize(d.positionSize)
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchStatus()
    const t = setInterval(fetchStatus, 8000)
    return () => clearInterval(t)
  }, [fetchStatus])

  // ── SSE feed ──────────────────────────────────────────────────────────
  useEffect(() => {
    const connect = () => {
      if (esRef.current) esRef.current.close()
      const es = new EventSource(`${EXECUTOR}/api/sniper/feed`)
      esRef.current = es

      es.onmessage = (e) => {
        try {
          const ev: FeedEvent = JSON.parse(e.data)

          setFeed(prev => {
            const next = [ev, ...prev].slice(0, 200)
            return next
          })

          // Live price tracking
          if (ev.type === 'price_update' && ev.address && ev.currentPrice) {
            setLivePrices(p => ({ ...p, [ev.address!]: ev.currentPrice! }))
          }

          // Running P&L stats
          if (ev.type === 'sell' && ev.pnlUsd !== undefined) {
            setStats(s => ({
              totalPnl: s.totalPnl + (ev.pnlUsd ?? 0),
              wins:     s.wins + ((ev.pnlUsd ?? 0) >= 0 ? 1 : 0),
              losses:   s.losses + ((ev.pnlUsd ?? 0) < 0 ? 1 : 0),
              buys:     s.buys,
            }))
          }
          if (ev.type === 'buy') {
            setStats(s => ({ ...s, buys: s.buys + 1 }))
          }
        } catch {}
      }

      es.onerror = () => {
        es.close()
        setTimeout(connect, 5000)
      }
    }

    connect()
    return () => { esRef.current?.close() }
  }, [])

  // Auto-scroll feed to top (newest is top)
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0
  }, [feed.length])

  // ── Controls ──────────────────────────────────────────────────────────
  const startSniper = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${EXECUTOR}/api/sniper/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionSize: posSize }),
      })
      await r.json()
      setTimeout(fetchStatus, 1000)
    } catch {}
    setLoading(false)
  }

  const stopSniper = async () => {
    setLoading(true)
    try {
      await fetch(`${EXECUTOR}/api/sniper/stop`, { method: 'POST' })
      setTimeout(fetchStatus, 1000)
    } catch {}
    setLoading(false)
  }

  const updateSize = async (size: number) => {
    setPosSize(size)
    if (status?.running) {
      try {
        await fetch(`${EXECUTOR}/api/sniper/size`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positionSize: size }),
        })
      } catch {}
    }
  }

  const isRunning   = status?.running ?? false
  const openPos     = status?.openPositions ?? []
  const winRate     = (stats.wins + stats.losses) > 0
    ? (stats.wins / (stats.wins + stats.losses)) * 100 : null
  const pnlPositive = stats.totalPnl >= 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background h-full">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="font-bold text-sm">Solana Sniper</span>
          <div className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
            isRunning
              ? 'bg-green-950/40 border-green-500/40 text-green-400'
              : 'bg-muted/40 border-border text-muted-foreground'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`} />
            {isRunning ? 'LIVE' : 'STOPPED'}
          </div>
          {isRunning && openPos.length > 0 && (
            <span className="text-[11px] text-blue-400">{openPos.length}/{status?.maxPositions} positions</span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <div className="flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-muted-foreground" />
            <span className={pnlPositive ? 'text-green-400' : 'text-red-400'}>
              {pnlPositive ? '+' : ''}{fmtUsd(stats.totalPnl)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Target className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              {winRate !== null ? `${fmt(winRate, 0)}% WR` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">{stats.buys} buys</span>
          </div>
        </div>
      </div>

      {/* ── Main layout: left=ticker, right=controls+positions ─────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* LEFT — Live trade ticker (big screen) */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-border">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Live Trade Feed</span>
            <span className="text-[10px] text-muted-foreground">{feed.length} events</span>
          </div>

          {/* Ticker header */}
          <div className="flex items-center gap-2 px-3 py-1 text-[9px] text-muted-foreground/60 uppercase tracking-wider border-b border-white/5 shrink-0">
            <span className="w-3"></span>
            <span className="w-16">Symbol</span>
            <span>Amount / P&L</span>
            <span className="ml-auto">Change</span>
            <span className="w-8 text-right">Age</span>
          </div>

          {/* Scrolling feed */}
          <div ref={feedRef} className="flex-1 overflow-y-auto font-mono">
            {feed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 gap-2">
                <Activity className="w-8 h-8" />
                <span className="text-xs">{isRunning ? 'Scanning for opportunities...' : 'Start sniper to see live trades'}</span>
              </div>
            ) : (
              feed.map((ev, i) => <TickerRow key={i} ev={ev} />)
            )}
          </div>
        </div>

        {/* RIGHT — Controls + Open positions */}
        <div className="w-72 flex flex-col overflow-hidden shrink-0">

          {/* Controls */}
          <div className="p-3 border-b border-border space-y-3 shrink-0">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Controls</div>

            {/* Position size */}
            <div>
              <div className="text-[10px] text-muted-foreground mb-1.5 flex items-center justify-between">
                <span>Position size</span>
                <span className="font-mono font-bold text-foreground">${posSize}</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[5, 10, 20, 50].map(v => (
                  <button
                    key={v}
                    onClick={() => updateSize(v)}
                    className={`text-[11px] py-1.5 rounded font-mono font-medium transition-colors ${
                      posSize === v
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    ${v}
                  </button>
                ))}
              </div>
            </div>

            {/* Rules display */}
            <div className="rounded-lg bg-muted/20 border border-border p-2 space-y-1 text-[10px] font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Take profit</span>
                <span className="text-green-400">+{((status?.takeProfit ?? 0.5) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stop loss</span>
                <span className="text-red-400">-{((status?.stopLoss ?? 0.2) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max hold</span>
                <span className="text-blue-400">{status?.maxHoldHours ?? 3}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max positions</span>
                <span className="text-muted-foreground">{status?.maxPositions ?? 3}</span>
              </div>
            </div>

            {/* Start / Stop */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={startSniper}
                disabled={isRunning || loading}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all ${
                  isRunning
                    ? 'bg-green-900/30 text-green-600 cursor-not-allowed border border-green-900/50'
                    : 'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white shadow-lg shadow-green-900/20'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                {isRunning ? 'Running' : 'Start'}
              </button>
              <button
                onClick={stopSniper}
                disabled={!isRunning || loading}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all ${
                  !isRunning
                    ? 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed border border-border'
                    : 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white shadow-lg shadow-red-900/20'
                }`}
              >
                <Square className="w-3.5 h-3.5" />
                Stop
              </button>
            </div>

            {/* Sniper info */}
            <div className="text-[9px] text-muted-foreground/50 space-y-0.5">
              <div>Scans Birdeye for tokens &lt;2h old, mcap &lt;$500k</div>
              <div>Volume acceleration filter + liquidity check</div>
              <div>Executes via Jupiter — no API key required</div>
            </div>
          </div>

          {/* Open positions */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-3 py-2 border-b border-border shrink-0">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Open Positions ({openPos.length})
              </div>
            </div>

            <div className="p-3 space-y-2">
              {openPos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground/40 text-xs">
                  <Shield className="w-6 h-6 mx-auto mb-2" />
                  No open positions
                </div>
              ) : (
                openPos.map(pos => (
                  <PositionCard
                    key={pos.id}
                    pos={pos}
                    livePrice={livePrices[pos.tokenAddress]}
                  />
                ))
              )}
            </div>

            {/* Session stats */}
            {(stats.wins + stats.losses) > 0 && (
              <div className="p-3 border-t border-border">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Session</div>
                <div className="grid grid-cols-3 gap-1 text-[10px] text-center font-mono">
                  <div className="rounded bg-muted/20 p-1.5">
                    <div className="text-green-400 font-bold">{stats.wins}</div>
                    <div className="text-muted-foreground text-[9px]">wins</div>
                  </div>
                  <div className="rounded bg-muted/20 p-1.5">
                    <div className="text-red-400 font-bold">{stats.losses}</div>
                    <div className="text-muted-foreground text-[9px]">losses</div>
                  </div>
                  <div className="rounded bg-muted/20 p-1.5">
                    <div className={`font-bold ${pnlPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {pnlPositive ? '+' : ''}{fmtUsd(stats.totalPnl)}
                    </div>
                    <div className="text-muted-foreground text-[9px]">P&L</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
