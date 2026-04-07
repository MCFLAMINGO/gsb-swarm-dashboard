'use client'

import { useState, useEffect, useRef } from 'react'
import { Activity, Play, Square, RefreshCw, DollarSign, TrendingUp, TrendingDown, AlertTriangle, Plus, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const RAILWAY = 'https://gsb-swarm-production.up.railway.app'

type TraderStatus = {
  running: boolean
  startedAt: string | null
  budget: number
  cashRemaining: number
  totalPnl: number
  openPositions: number
  closedPositions: number
  targets: Array<{ address: string; win_rate: number; source: string }>
  recentLog: string[]
}

type Position = {
  posId: string
  tokenName: string
  tokenAddress: string
  buyPrice: number
  amountUsd: number
  buyTimestamp: number
  status: string
  exitPrice?: number
  pnlPct?: number
  pnlUsd?: number
  exitReason?: string
  source?: string
}

type TradeSignal = {
  signal: string | null
  token?: string
  source?: string
  receivedAt?: string
  briefSnippet?: string
  message?: string
}

function agentBadgeClass(source?: string): string {
  if (!source) return 'bg-muted/40 border-border text-muted-foreground'
  const s = source.toLowerCase()
  if (s.includes('ceo') || s.includes('alpha')) return 'bg-yellow-950/40 border-yellow-500/40 text-yellow-300'
  if (s.includes('oracle')) return 'bg-purple-950/40 border-purple-500/40 text-purple-300'
  if (s.includes('hunt')) return 'bg-blue-950/40 border-blue-500/40 text-blue-300'
  return 'bg-muted/40 border-border text-muted-foreground'
}

function agentLabel(source?: string): string {
  if (!source) return 'Unknown'
  const s = source.toLowerCase()
  if (s.includes('ceo') || s.includes('alpha')) return 'CEO Alpha'
  if (s.includes('oracle')) return 'Oracle'
  if (s.includes('hunt')) return 'Hunt Mode'
  return source
}

export default function CopyTraderPage() {
  const [status, setStatus] = useState<TraderStatus | null>(null)
  const [tradeSignal, setTradeSignal] = useState<TradeSignal | null>(null)
  const [positions, setPositions] = useState<Record<string, Position>>({})
  const [budget, setBudget] = useState(10)
  const [isLoading, setIsLoading] = useState(false)
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState('')
  const [logExpanded, setLogExpanded] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const signalPollRef = useRef<NodeJS.Timeout | null>(null)

  // Auth
  useEffect(() => {
    const getToken = async () => {
      try {
        const res = await fetch(`${RAILWAY}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: 'Erock1976' })
        })
        const data = await res.json()
        if (data.token) {
          setAuthToken(data.token)
          localStorage.setItem('gsb_op_token', data.token)
        }
      } catch {}
    }
    getToken()
    const tokenRefresh = setInterval(getToken, 20 * 60 * 1000)
    return () => clearInterval(tokenRefresh)
  }, [])

  const fetchStatus = async () => {
    if (!authToken) return
    try {
      const res = await fetch(`${RAILWAY}/api/copy-trader/status`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      const data = await res.json()
      if (!data.error) setStatus(data)
    } catch {}
  }

  const fetchPositions = async () => {
    if (!authToken) return
    try {
      const res = await fetch(`${RAILWAY}/api/copy-trader/positions`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      const data = await res.json()
      if (data.positions) setPositions(data.positions)
    } catch {}
  }

  const fetchTradeSignal = async () => {
    if (!authToken) return
    try {
      const res = await fetch(`${RAILWAY}/api/trade-signal`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      const data = await res.json()
      setTradeSignal(data)
    } catch {}
  }

  // Initial load after auth
  useEffect(() => {
    if (authToken) {
      fetchStatus()
      fetchTradeSignal()
      fetchPositions()
    }
  }, [authToken])

  // Poll status every 5s when running
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (status?.running && authToken) {
      pollRef.current = setInterval(() => {
        fetchStatus()
        fetchPositions()
      }, 5000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [status?.running, authToken])

  // Poll trade signal every 30s
  useEffect(() => {
    if (signalPollRef.current) clearInterval(signalPollRef.current)
    if (authToken) {
      signalPollRef.current = setInterval(fetchTradeSignal, 30000)
    }
    return () => { if (signalPollRef.current) clearInterval(signalPollRef.current) }
  }, [authToken])

  const startTrader = async () => {
    if (!authToken || isLoading) return
    setIsLoading(true)
    setLastAction('starting')
    try {
      const res = await fetch(`${RAILWAY}/api/copy-trader/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget })
      })
      const data = await res.json()
      if (data.ok) {
        setLastAction('started')
        await fetchStatus()
        setTimeout(() => setLastAction(null), 4000)
      } else {
        setLastAction('error: ' + (data.error || 'failed'))
        setTimeout(() => setLastAction(null), 4000)
      }
    } catch {
      setLastAction('error: network')
      setTimeout(() => setLastAction(null), 4000)
    }
    setIsLoading(false)
  }

  const rehuntWallets = async () => {
    if (!authToken || isLoading) return
    setIsLoading(true)
    setLastAction('hunting')
    try {
      const res = await fetch(`${RAILWAY}/api/copy-trader/rehunt`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget })
      })
      const data = await res.json()
      if (data.ok) {
        setLastAction('hunting — scanning 2000 blocks...')
        setTimeout(() => { fetchStatus(); setLastAction(null); }, 4000)
      } else {
        setLastAction('error: ' + (data.error || 'failed'))
        setTimeout(() => setLastAction(null), 4000)
      }
    } catch {
      setLastAction('error: network')
      setTimeout(() => setLastAction(null), 4000)
    }
    setIsLoading(false)
  }

  const stopTrader = async () => {
    if (!authToken || isLoading) return
    setIsLoading(true)
    setLastAction('stopping')
    try {
      await fetch(`${RAILWAY}/api/copy-trader/stop`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      setLastAction('stopped')
      await fetchStatus()
      setTimeout(() => setLastAction(null), 3000)
    } catch {
      setLastAction('error: network')
      setTimeout(() => setLastAction(null), 3000)
    }
    setIsLoading(false)
  }

  const buyToken = async (tokenAddress: string, tokenName: string, usdAmount: number = 2.5) => {
    if (!authToken || isLoading) return
    setIsLoading(true)
    setLastAction(`buying ${tokenName}...`)
    try {
      const res = await fetch(`${RAILWAY}/api/copy-trader/buy-signal`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress, tokenName, usdAmount })
      })
      const data = await res.json()
      if (data.ok) {
        setLastAction(`✅ Buy order sent for ${tokenName}`)
        setTimeout(() => { fetchStatus(); setLastAction(null); }, 4000)
      } else {
        setLastAction(`error: ${data.error || 'failed'}`)
        setTimeout(() => setLastAction(null), 5000)
      }
    } catch {
      setLastAction('error: network')
      setTimeout(() => setLastAction(null), 4000)
    }
    setIsLoading(false)
  }

  const approveUsdc = async () => {
    if (!authToken || isLoading) return
    setIsLoading(true)
    setLastAction('approving USDC...')
    try {
      const res = await fetch(`${RAILWAY}/api/copy-trader/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      const data = await res.json()
      setLastAction(data.ok ? '✅ USDC approved — swaps now instant' : 'error: ' + (data.error || 'failed'))
      setTimeout(() => setLastAction(null), 6000)
    } catch {
      setLastAction('error: network')
      setTimeout(() => setLastAction(null), 4000)
    }
    setIsLoading(false)
  }

  // Derived stats for portfolio summary
  const posArr = Object.values(positions)
  const closedPositions = posArr.filter(p => p.status !== 'open')
  const openPositions = posArr.filter(p => p.status === 'open')
  const profitableClosedCount = closedPositions.filter(p => (p.pnlUsd ?? 0) > 0).length
  const winRate = closedPositions.length > 0
    ? (profitableClosedCount / closedPositions.length) * 100
    : null

  const totalValue = status
    ? status.cashRemaining + openPositions.reduce((sum, p) => sum + p.amountUsd, 0)
    : null
  const totalReturnPct = status && status.budget > 0
    ? (status.totalPnl / status.budget) * 100
    : null

  const pnlColor = (status?.totalPnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
  const hasSignal = tradeSignal?.signal && tradeSignal.signal !== 'NONE' && tradeSignal.signal !== 'none'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-primary" />
          <span className="font-bold text-lg">Copy Trader</span>
          <Badge variant="outline" className={status?.running ? 'text-green-400 border-green-500/50' : ''}>
            {status?.running ? '● RUNNING' : '○ Stopped'}
          </Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={() => { fetchStatus(); fetchTradeSignal(); fetchPositions(); }}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full">

        {/* Portfolio Summary */}
        {status && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Total Value</div>
                <div className="font-mono font-bold text-lg flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  {totalValue !== null ? totalValue.toFixed(2) : status.cashRemaining.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  ${status.cashRemaining.toFixed(2)} cash + {openPositions.length} positions
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Total P&L</div>
                <div className={`font-mono font-bold text-lg flex items-center gap-1 ${pnlColor}`}>
                  {status.totalPnl >= 0
                    ? <TrendingUp className="w-4 h-4" />
                    : <TrendingDown className="w-4 h-4" />}
                  {status.totalPnl >= 0 ? '+' : ''}${status.totalPnl.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {status.openPositions} open · {status.closedPositions} closed
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Total Return</div>
                <div className={`font-mono font-bold text-lg ${totalReturnPct !== null && totalReturnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalReturnPct !== null
                    ? `${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(1)}%`
                    : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  on ${status.budget} budget
                </div>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, (status.cashRemaining / Math.max(status.budget, 1)) * 100))}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
                <div className={`font-mono font-bold text-lg ${winRate !== null && winRate >= 50 ? 'text-green-400' : winRate !== null ? 'text-red-400' : 'text-muted-foreground'}`}>
                  {winRate !== null ? `${winRate.toFixed(0)}%` : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {profitableClosedCount}/{closedPositions.length} closed profitable
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* CEO Alpha Signal — live */}
        <Card className="border border-yellow-500/40 bg-yellow-950/10">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <span>👑</span> CEO Alpha Signal
              <span className="ml-auto text-[10px] text-muted-foreground">Live from GSB CEO ACP Agent</span>
              <button
                onClick={fetchTradeSignal}
                className="text-[10px] text-muted-foreground hover:text-foreground ml-1"
                title="Refresh signal"
              >
                ↻
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {hasSignal ? (
              <div className="rounded-lg bg-yellow-950/20 border border-yellow-500/20 p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-sm text-yellow-300">
                      {tradeSignal!.signal}
                    </div>
                    {tradeSignal!.token && (
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {tradeSignal!.token.length > 20
                          ? `${tradeSignal!.token.slice(0, 8)}...${tradeSignal!.token.slice(-6)}`
                          : tradeSignal!.token}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {tradeSignal!.source && (
                      <div className="text-[10px] text-yellow-400 font-medium">{tradeSignal!.source}</div>
                    )}
                    {tradeSignal!.receivedAt && (
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(tradeSignal!.receivedAt).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
                {tradeSignal!.briefSnippet && (
                  <p className="text-[10px] text-muted-foreground mb-3">{tradeSignal!.briefSnippet}</p>
                )}
                {tradeSignal!.token && (
                  <Button
                    size="sm"
                    className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-xs h-8"
                    disabled={isLoading || !authToken}
                    onClick={() => buyToken(tradeSignal!.token!, tradeSignal!.signal ?? 'TOKEN', budget * 0.25)}
                  >
                    ⚡ Buy Signal — ${(budget * 0.25).toFixed(2)} ({((budget * 0.25 / budget) * 100).toFixed(0)}% of budget)
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-yellow-950/10 border border-yellow-500/10 p-3 text-center">
                <div className="text-xs text-muted-foreground">Waiting for CEO agent signal...</div>
                {tradeSignal?.message && (
                  <div className="text-[10px] text-muted-foreground mt-1">{tradeSignal.message}</div>
                )}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Signals from GSB CEO Agent via ACP. USDC→WETH→token multi-hop swap. High risk — new tokens. Auto-refreshes every 30s.
            </p>
          </CardContent>
        </Card>

        {/* Open Positions */}
        {posArr.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Positions</span>
                <button onClick={fetchPositions} className="text-[10px] text-muted-foreground hover:text-foreground">↻ Refresh</button>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {posArr.sort((a, b) => b.buyTimestamp - a.buyTimestamp).map(pos => {
                const isOpen = pos.status === 'open'
                const posPnlColor = (pos.pnlPct || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                const ageMs = Date.now() - pos.buyTimestamp
                const ageStr = ageMs < 3_600_000
                  ? `${Math.floor(ageMs / 60_000)}m ago`
                  : `${(ageMs / 3_600_000).toFixed(1)}h ago`
                const currentValueEst = isOpen && pos.buyPrice > 0
                  ? pos.amountUsd // without live price feed, show invested amount
                  : undefined
                const unrealizedPct = isOpen && pos.pnlPct !== undefined
                  ? pos.pnlPct * 100
                  : null

                return (
                  <div key={pos.posId} className={`rounded-lg border p-3 ${
                    isOpen ? 'border-blue-500/30 bg-blue-950/10' : 'border-border bg-muted/20'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">{pos.tokenName}</span>
                          {pos.source && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${agentBadgeClass(pos.source)}`}>
                              {agentLabel(pos.source)}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Entry: ${pos.buyPrice?.toFixed(8)} · ${pos.amountUsd.toFixed(2)} invested · {ageStr}
                        </div>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <div className={`text-sm font-bold ${
                          isOpen ? 'text-blue-400' : posPnlColor
                        }`}>
                          {isOpen ? '● OPEN' : (
                            `${(pos.pnlPct || 0) >= 0 ? '+' : ''}${((pos.pnlPct || 0) * 100).toFixed(1)}%`
                          )}
                        </div>
                        {!isOpen && pos.exitReason && (
                          <div className="text-[10px] text-muted-foreground">{pos.exitReason.split(' —')[0]}</div>
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Stop: ${(pos.buyPrice * 0.80).toFixed(8)}</span>
                        <span>Target: ${(pos.buyPrice * 1.50).toFixed(8)}</span>
                        <span>Exit monitor active</span>
                      </div>
                    )}

                    {isOpen && unrealizedPct !== null && (
                      <div className={`mt-1 text-[10px] font-medium ${unrealizedPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        Unrealized: {unrealizedPct >= 0 ? '+' : ''}{unrealizedPct.toFixed(1)}%
                        {currentValueEst !== undefined && ` · ~$${currentValueEst.toFixed(2)} current value`}
                      </div>
                    )}

                    {!isOpen && pos.pnlUsd !== undefined && (
                      <div className={`mt-1 text-[10px] font-medium ${posPnlColor}`}>
                        P&L: {pos.pnlUsd >= 0 ? '+' : ''}${pos.pnlUsd.toFixed(2)}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Controls */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Manual Controls</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            {/* Budget */}
            <div>
              <div className="text-xs text-muted-foreground mb-2">Budget (USDC)</div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="w-8 h-8 p-0"
                  onClick={() => setBudget(b => Math.max(1, b - 5))}>
                  <Minus className="w-3 h-3" />
                </Button>
                <div className="flex-1 text-center font-mono font-bold text-lg">${budget}</div>
                <Button size="sm" variant="outline" className="w-8 h-8 p-0"
                  onClick={() => setBudget(b => b + 5)}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex gap-2 mt-2">
                {[5, 10, 25, 50].map(v => (
                  <Button key={v} size="sm" variant={budget === v ? 'default' : 'outline'}
                    className="flex-1 text-xs h-7"
                    onClick={() => setBudget(v)}>
                    ${v}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Action feedback toast */}
            {lastAction && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium animate-pulse ${
                lastAction.startsWith('error')
                  ? 'bg-red-950/40 border border-red-500/40 text-red-400'
                  : lastAction === 'stopped'
                  ? 'bg-muted border border-border text-muted-foreground'
                  : 'bg-green-950/40 border border-green-500/40 text-green-400'
              }`}>
                {lastAction.startsWith('error') ? '✗' : lastAction === 'stopped' ? '■' : '●'}
                &nbsp;{lastAction.charAt(0).toUpperCase() + lastAction.slice(1)}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <Button
                className={`col-span-1 font-bold transition-all ${
                  status?.running
                    ? 'bg-green-700 text-white cursor-not-allowed opacity-60'
                    : 'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white shadow-lg shadow-green-900/30'
                }`}
                disabled={status?.running || isLoading || !authToken}
                onClick={startTrader}
              >
                {isLoading && lastAction === 'starting'
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Play className="w-4 h-4" />}
                <span className="ml-1.5">{isLoading && lastAction === 'starting' ? 'Starting...' : status?.running ? 'Running' : 'Start'}</span>
              </Button>

              <Button
                variant="outline"
                className="col-span-1 border-blue-500/50 text-blue-400 hover:bg-blue-950/30 hover:border-blue-400 active:bg-blue-950/50 font-bold"
                disabled={isLoading || !authToken}
                onClick={rehuntWallets}
              >
                {isLoading && lastAction?.startsWith('hunt')
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <RefreshCw className="w-4 h-4" />}
                <span className="ml-1.5">{isLoading && lastAction?.startsWith('hunt') ? 'Hunting...' : 'Re-Hunt'}</span>
              </Button>

              <Button
                variant="destructive"
                className="col-span-1 font-bold hover:bg-red-600 active:bg-red-800 disabled:opacity-30"
                disabled={!status?.running || isLoading}
                onClick={stopTrader}
              >
                {isLoading && lastAction === 'stopping'
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Square className="w-4 h-4" />}
                <span className="ml-1.5">{isLoading && lastAction === 'stopping' ? 'Stopping...' : 'Stop'}</span>
              </Button>
            </div>

            {/* One-time approve button */}
            <button
              onClick={approveUsdc}
              disabled={isLoading || !authToken}
              className="w-full text-xs text-muted-foreground hover:text-yellow-400 hover:border-yellow-500/30 border border-transparent rounded py-1.5 transition-colors disabled:opacity-30"
            >
              ⚡ Pre-approve USDC for instant swaps (one-time setup)
            </button>
          </CardContent>
        </Card>

        {/* Target Wallets */}
        {status?.targets && status.targets.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">Watching Wallets</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {status.targets.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                  <span className="font-mono text-muted-foreground">{t.address.slice(0, 14)}...</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] h-4">{t.source}</Badge>
                    <span className="text-green-400 font-medium">{(t.win_rate * 100).toFixed(0)}% WR</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Live Log */}
        {status?.recentLog && status.recentLog.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Live Log</span>
                <button
                  onClick={() => setLogExpanded(!logExpanded)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {logExpanded ? 'Collapse' : 'Expand'}
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="font-mono text-[10px] text-muted-foreground space-y-0.5 max-h-40 overflow-y-auto">
                {(logExpanded ? status.recentLog : status.recentLog.slice(-8)).map((line, i) => (
                  <div key={i} className={line.includes('❌') || line.includes('ERR') ? 'text-red-400' :
                                          line.includes('✅') || line.includes('🚨') ? 'text-green-400' : ''}>
                    {line}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!status && authToken && (
          <div className="text-center text-muted-foreground text-sm py-8">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p>Trader is stopped. Set your budget and hit Start.</p>
          </div>
        )}
      </div>
    </div>
  )
}
