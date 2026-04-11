'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Activity, Play, Square, Zap, TrendingUp, TrendingDown, DollarSign, Target, Shield, RefreshCw, Wallet, BarChart2 } from 'lucide-react'

const EXECUTOR = 'https://gsb-yield-swarm-production.up.railway.app'

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
  amountUsd?: number
  mcap?: number
  reason?: string
  positionId?: string
  txHash?: string
  strategy?: string
  walletSource?: string
  exchange?: string
  rate?: number
  ts: string
}

type StrategyStatus = {
  running: boolean
  positionSize?: number
  openCount: number
  recentLog: FeedEvent[]
  openPositions: OpenPosition[]
  takeProfit?: number
  stopLoss?: number
  maxHoldHours?: number
  mirrorRatio?: number
  minRate?: number
  volMultiplier?: number
  volAccelMin?: number
}

type AllStrategies = {
  sniper: StrategyStatus
  momentum_swing: StrategyStatus
  trend_rider: StrategyStatus
  wallet_copy: StrategyStatus
  funding_arb: StrategyStatus
}

type OpenPosition = {
  id: string
  tokenName: string
  tokenAddress: string
  entryPrice: number
  amount: number
  openedAt: string
  type: string
  note?: string
}

// ── Strategy metadata ─────────────────────────────────────────────────────
const STRATEGIES = [
  {
    id: 'sniper',
    label: 'Micro Sniper',
    icon: Zap,
    color: 'text-yellow-400',
    border: 'border-yellow-400/30',
    bg: 'bg-yellow-400/5',
    glow: 'shadow-yellow-400/20',
    desc: 'New tokens <6h, <$2M mcap, momentum entry',
    tp: '50%', sl: '20%', hold: '3h',
    defaultSize: 10,
  },
  {
    id: 'momentum_swing',
    label: 'Momentum Swing',
    icon: TrendingUp,
    color: 'text-blue-400',
    border: 'border-blue-400/30',
    bg: 'bg-blue-400/5',
    glow: 'shadow-blue-400/20',
    desc: 'SOL/BTC/ETH — h1 green + vol spike entry',
    tp: '8%', sl: '4%', hold: '6h',
    defaultSize: 15,
  },
  {
    id: 'funding_arb',
    label: 'Funding Arb',
    icon: Shield,
    color: 'text-green-400',
    border: 'border-green-400/30',
    bg: 'bg-green-400/5',
    glow: 'shadow-green-400/20',
    desc: 'Delta-neutral yield — Tempo pathUSD + Hyperliquid',
    tp: '—', sl: '—', hold: '72h max',
    defaultSize: 10,
  },
  {
    id: 'trend_rider',
    label: 'Trend Rider',
    icon: BarChart2,
    color: 'text-purple-400',
    border: 'border-purple-400/30',
    bg: 'bg-purple-400/5',
    glow: 'shadow-purple-400/20',
    desc: 'Boosted tokens 6-48h old, 3x vol acceleration',
    tp: '30%', sl: '15%', hold: '6h',
    defaultSize: 10,
  },
  {
    id: 'wallet_copy',
    label: 'Wallet Copy',
    icon: Wallet,
    color: 'text-orange-400',
    border: 'border-orange-400/30',
    bg: 'bg-orange-400/5',
    glow: 'shadow-orange-400/20',
    desc: 'Mirror alpha wallet buys at 20% ratio',
    tp: '40%', sl: '20%', hold: '3h',
    defaultSize: 20,
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────
const fmtPrice = (p: number) => p < 0.0001 ? p.toExponential(3) : p < 1 ? p.toFixed(6) : p.toFixed(4)
const fmtK = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : `$${(n/1000).toFixed(0)}k`
const ageStr = (ts: string) => {
  const ms = Date.now() - new Date(ts).getTime()
  if (ms < 60000) return `${Math.floor(ms/1000)}s`
  if (ms < 3600000) return `${Math.floor(ms/60000)}m`
  return `${(ms/3600000).toFixed(1)}h`
}

const eventColor = (type: string) => {
  if (type === 'buy')   return 'text-green-400'
  if (type === 'sell')  return 'text-red-400'
  if (type === 'error') return 'text-red-500'
  if (type === 'warn')  return 'text-yellow-400'
  if (type === 'debug') return 'text-gray-600'
  return 'text-gray-400'
}

const eventIcon = (type: string) => {
  if (type === 'buy')  return '▲'
  if (type === 'sell') return '▼'
  if (type === 'error' || type === 'warn') return '⚠'
  return '·'
}

// ── Strategy Card ─────────────────────────────────────────────────────────
function StrategyCard({
  meta,
  status,
  onStart,
  onStop,
  onSize,
  loading,
}: {
  meta: typeof STRATEGIES[0]
  status: StrategyStatus | null
  onStart: (size: number) => void
  onStop: () => void
  onSize: (size: number) => void
  loading: boolean
}) {
  const [size, setSize] = useState(meta.defaultSize)
  const Icon = meta.icon
  const running = status?.running ?? false

  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} p-4 flex flex-col gap-3 shadow-lg ${running ? meta.glow : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${meta.color}`} />
          <span className={`font-bold text-sm ${meta.color}`}>{meta.label}</span>
          <span className={`w-2 h-2 rounded-full ${running ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
        </div>
        <span className="text-xs text-gray-500">{status?.openCount ?? 0} open</span>
      </div>

      {/* Desc */}
      <p className="text-xs text-gray-500 leading-relaxed">{meta.desc}</p>

      {/* Stats row */}
      <div className="flex gap-3 text-xs text-gray-500">
        <span>TP <span className="text-green-400">{meta.tp}</span></span>
        <span>SL <span className="text-red-400">{meta.sl}</span></span>
        <span>Max <span className="text-gray-300">{meta.hold}</span></span>
      </div>

      {/* Size buttons */}
      <div className="flex gap-1 flex-wrap">
        {[5, 10, 15, 20, 50].map(s => (
          <button
            key={s}
            onClick={() => { setSize(s); if (running) onSize(s); }}
            className={`px-2 py-0.5 rounded text-xs font-mono transition-all ${
              size === s
                ? `${meta.color} border ${meta.border} bg-white/5`
                : 'text-gray-600 border border-gray-800 hover:border-gray-600'
            }`}
          >${s}</button>
        ))}
      </div>

      {/* Open positions */}
      {status?.openPositions && status.openPositions.length > 0 && (
        <div className="space-y-1">
          {status.openPositions.map(pos => (
            <div key={pos.id} className="flex items-center justify-between text-xs bg-black/30 rounded px-2 py-1">
              <span className={`font-mono font-bold ${meta.color}`}>{pos.tokenName}</span>
              <span className="text-gray-400">${pos.amount.toFixed(0)}</span>
              <span className="text-gray-500">{ageStr(pos.openedAt)}</span>
              <span className="text-gray-600 text-[10px]" title={pos.tokenAddress}>
                {pos.tokenAddress?.slice(0, 6)}...
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Start/Stop */}
      <button
        onClick={() => running ? onStop() : onStart(size)}
        disabled={loading}
        className={`w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
          running
            ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
            : `${meta.bg} ${meta.color} border ${meta.border} hover:bg-white/10`
        } disabled:opacity-50`}
      >
        {loading ? (
          <RefreshCw className="w-3 h-3 animate-spin" />
        ) : running ? (
          <><Square className="w-3 h-3" /> Stop</>
        ) : (
          <><Play className="w-3 h-3" /> Start ${size}</>
        )}
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function CopyTraderPage() {
  const [strategies, setStrategies] = useState<AllStrategies | null>(null)
  const [feed, setFeed] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const feedRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch all strategy statuses ──────────────────────────────────────
  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch(`${EXECUTOR}/api/strategies`)
      if (res.ok) setStrategies(await res.json())
    } catch { /* silent */ }
  }, [])

  // ── SSE feed ──────────────────────────────────────────────────────────
  const connectFeed = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    const es = new EventSource(`${EXECUTOR}/api/strategies/feed`)
    es.onmessage = (e) => {
      try {
        const event: FeedEvent = JSON.parse(e.data)
        setFeed(prev => [event, ...prev].slice(0, 300))
        if (event.type === 'buy' || event.type === 'sell') fetchStatuses()
      } catch { /* ignore */ }
    }
    es.onerror = () => { es.close(); setTimeout(connectFeed, 5000); }
    esRef.current = es
  }, [fetchStatuses])

  useEffect(() => {
    fetchStatuses()
    connectFeed()
    pollRef.current = setInterval(fetchStatuses, 10000)
    return () => {
      if (esRef.current) esRef.current.close()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchStatuses, connectFeed])

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0
  }, [feed])

  // ── Actions ───────────────────────────────────────────────────────────
  const startStrategy = async (id: string, size: number) => {
    setLoading(l => ({ ...l, [id]: true }))
    try {
      await fetch(`${EXECUTOR}/api/strategies/${id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionSize: size }),
      })
      setTimeout(fetchStatuses, 1000)
    } finally {
      setLoading(l => ({ ...l, [id]: false }))
    }
  }

  const stopStrategy = async (id: string) => {
    setLoading(l => ({ ...l, [id]: true }))
    try {
      await fetch(`${EXECUTOR}/api/strategies/${id}/stop`, { method: 'POST' })
      setTimeout(fetchStatuses, 1000)
    } finally {
      setLoading(l => ({ ...l, [id]: false }))
    }
  }

  const sizeStrategy = async (id: string, size: number) => {
    await fetch(`${EXECUTOR}/api/strategies/${id}/size`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionSize: size }),
    })
  }

  // ── Derived stats ─────────────────────────────────────────────────────
  const totalOpen = strategies
    ? Object.values(strategies).reduce((s, v) => s + (v.openCount || 0), 0)
    : 0
  const activeCount = strategies
    ? Object.values(strategies).filter(v => v.running).length
    : 0

  const filteredFeed = activeFilter === 'all'
    ? feed
    : feed.filter(e => e.strategy === activeFilter || (!e.strategy && activeFilter === 'sniper'))

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Top bar */}
      <div className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-green-400" />
          <span className="text-white font-bold text-sm tracking-widest uppercase">GSB Trading Engine</span>
          <span className="text-gray-600 text-xs">5 Strategies</span>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <DollarSign className="w-3 h-3 text-green-400" />
            <span className="text-gray-400">{totalOpen} positions open</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-3 h-3 text-yellow-400" />
            <span className="text-gray-400">{activeCount}/5 active</span>
          </div>
          <div className={`flex items-center gap-1 ${activeCount > 0 ? 'text-green-400' : 'text-gray-600'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${activeCount > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-700'}`} />
            {activeCount > 0 ? 'LIVE' : 'IDLE'}
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-53px)]">
        {/* Left — Live feed */}
        <div className="w-[42%] border-r border-gray-800 flex flex-col">
          {/* Feed header + filters */}
          <div className="border-b border-gray-800 px-4 py-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 mr-1">FILTER:</span>
            {['all', ...STRATEGIES.map(s => s.id)].map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                  activeFilter === f
                    ? 'bg-white/10 text-white'
                    : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                {f === 'all' ? 'ALL' : STRATEGIES.find(s => s.id === f)?.label || f}
              </button>
            ))}
          </div>

          {/* Feed scroll */}
          <div ref={feedRef} className="flex-1 overflow-y-auto">
            {filteredFeed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-700">
                <Activity className="w-8 h-8 mb-3 opacity-30" />
                <p className="text-sm">Waiting for events...</p>
                <p className="text-xs mt-1 opacity-60">Start a strategy to see live trades</p>
              </div>
            ) : (
              filteredFeed.map((e, i) => (
                <div
                  key={i}
                  className={`border-b border-gray-900 px-4 py-2 hover:bg-white/[0.02] transition-colors ${
                    e.type === 'buy' ? 'border-l-2 border-l-green-500/40' :
                    e.type === 'sell' ? 'border-l-2 border-l-red-500/40' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`text-sm leading-none mt-0.5 ${eventColor(e.type)}`}>
                      {eventIcon(e.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      {e.type === 'buy' && e.symbol && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-green-400 font-bold text-sm">${e.symbol}</span>
                          {e.amountUsd && <span className="text-white text-xs">${e.amountUsd.toFixed(2)}</span>}
                          {e.entryPrice && <span className="text-gray-500 text-xs">@ {fmtPrice(e.entryPrice)}</span>}
                          {e.mcap && <span className="text-gray-600 text-xs">{fmtK(e.mcap)} mc</span>}
                          {e.walletSource && <span className="text-orange-400/70 text-xs">👁 {e.walletSource}</span>}
                          {e.strategy && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              STRATEGIES.find(s => s.id === e.strategy)?.color || 'text-gray-500'
                            } bg-white/5`}>
                              {STRATEGIES.find(s => s.id === e.strategy)?.label || e.strategy}
                            </span>
                          )}
                        </div>
                      )}
                      {e.type === 'sell' && e.symbol && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-red-400 font-bold text-sm">${e.symbol}</span>
                          {e.exitPrice && <span className="text-gray-400 text-xs">exit {fmtPrice(e.exitPrice)}</span>}
                          {e.reason && (
                            <span className={`text-xs ${
                              e.reason === 'take_profit' ? 'text-green-400' :
                              e.reason === 'stop_loss' ? 'text-red-400' : 'text-gray-500'
                            }`}>
                              {e.reason === 'take_profit' ? '✓TP' : e.reason === 'stop_loss' ? '✗SL' : e.reason}
                            </span>
                          )}
                        </div>
                      )}
                      {(e.type === 'info' || e.type === 'warn' || e.type === 'error') && e.message && (
                        <p className={`text-xs leading-relaxed ${eventColor(e.type)}`}>
                          {e.message}
                        </p>
                      )}
                    </div>
                    <span className="text-gray-700 text-[10px] tabular-nums shrink-0">
                      {new Date(e.ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right — Strategy cards */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-4xl">
            {STRATEGIES.map(meta => (
              <StrategyCard
                key={meta.id}
                meta={meta}
                status={strategies ? strategies[meta.id as keyof AllStrategies] : null}
                onStart={(size) => startStrategy(meta.id, size)}
                onStop={() => stopStrategy(meta.id)}
                onSize={(size) => sizeStrategy(meta.id, size)}
                loading={!!loading[meta.id]}
              />
            ))}
          </div>

          {/* All positions summary */}
          {totalOpen > 0 && strategies && (
            <div className="mt-4 max-w-4xl">
              <div className="border border-gray-800 rounded-xl p-4">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <TrendingDown className="w-3 h-3" /> All Open Positions ({totalOpen})
                </h3>
                <div className="space-y-1">
                  {Object.entries(strategies).flatMap(([key, s]) =>
                    (s.openPositions || []).map(pos => {
                      const meta = STRATEGIES.find(m => m.id === key)
                      return (
                        <div key={pos.id} className="flex items-center gap-3 text-xs bg-black/30 rounded px-3 py-2">
                          <span className={`font-bold w-24 truncate ${meta?.color || 'text-gray-400'}`}>{pos.tokenName}</span>
                          <span className="text-gray-400">${pos.amount.toFixed(0)}</span>
                          <span className="text-gray-600">@ {fmtPrice(pos.entryPrice)}</span>
                          <span className="text-gray-600">{ageStr(pos.openedAt)} ago</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${meta?.color || 'text-gray-500'} bg-white/5 ml-auto`}>
                            {meta?.label || key}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
