'use client'

import { useState, useEffect, useRef } from 'react'
import { Activity, Play, Square, RefreshCw, DollarSign, TrendingUp, TrendingDown, Zap, AlertTriangle, Plus, Minus } from 'lucide-react'
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

type OracleSignal = {
  action: 'BUY' | 'HOLD' | 'STANDBY'
  tokens: string[]
  reason: string
  akt?: { price: number; change: number }
  rndr?: { price: number; change: number }
  io?: { price: number; change: number }
}

export default function CopyTraderPage() {
  const [status, setStatus] = useState<TraderStatus | null>(null)
  const [oracleSignal, setOracleSignal] = useState<OracleSignal | null>(null)
  const [budget, setBudget] = useState(10)
  const [isLoading, setIsLoading] = useState(false)
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState('')
  const [logExpanded, setLogExpanded] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

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
        if (data.token) setAuthToken(data.token)
      } catch {}
    }
    getToken()
  }, [])

  // Poll status every 10s when running
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

  // Fetch real compute token prices
  const fetchOracleSignal = async () => {
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=akash-network,render-token,io&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true'
      )
      const data = await res.json()
      const akt = data['akash-network']
      const rndr = data['render-token']
      const io = data['io']

      // Simple signal: if 2+ compute tokens are up → BUY signal
      const upCount = [akt, rndr, io].filter(t => t && Number(t.usd_24h_change) > 0).length
      const bullishTokens = []
      if (akt && Number(akt.usd_24h_change) > 0) bullishTokens.push('AKT')
      if (rndr && Number(rndr.usd_24h_change) > 0) bullishTokens.push('RNDR')
      if (io && Number(io?.usd_24h_change) > 0) bullishTokens.push('IO')

      const action = upCount >= 2 ? 'BUY' : upCount === 0 ? 'STANDBY' : 'HOLD'
      const reason = action === 'BUY'
        ? `${bullishTokens.join(' + ')} showing positive momentum — compute demand rising`
        : action === 'STANDBY'
        ? 'All compute tokens bearish — stand down, preserve capital'
        : 'Mixed signals — hold current positions'

      setOracleSignal({
        action,
        tokens: bullishTokens,
        reason,
        akt: akt ? { price: akt.usd, change: akt.usd_24h_change } : undefined,
        rndr: rndr ? { price: rndr.usd, change: rndr.usd_24h_change } : undefined,
        io: io ? { price: io.usd, change: io.usd_24h_change } : undefined,
      })
    } catch {}
  }

  useEffect(() => {
    if (authToken) {
      fetchStatus()
      fetchOracleSignal()
    }
  }, [authToken])

  useEffect(() => {
    if (status?.running) {
      pollRef.current = setInterval(fetchStatus, 10000)
    } else {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [status?.running, authToken])

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
    } catch (e) {
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

  const signalColor = oracleSignal?.action === 'BUY' ? 'text-green-400' :
                      oracleSignal?.action === 'STANDBY' ? 'text-red-400' : 'text-yellow-400'
  const signalBg = oracleSignal?.action === 'BUY' ? 'border-green-500/30 bg-green-950/20' :
                   oracleSignal?.action === 'STANDBY' ? 'border-red-500/30 bg-red-950/20' : 'border-yellow-500/30 bg-yellow-950/20'

  const pnlColor = (status?.totalPnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'

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
        <Button size="sm" variant="ghost" onClick={() => { fetchStatus(); fetchOracleSignal(); }}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full">

        {/* Oracle Signal */}
        <Card className={`border ${signalBg}`}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Oracle Compute Signal
              <span className={`ml-auto font-bold ${signalColor}`}>
                {oracleSignal?.action ?? '—'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {oracleSignal ? (
              <>
                <p className="text-xs text-muted-foreground mb-3">{oracleSignal.reason}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'AKT', data: oracleSignal.akt },
                    { label: 'RNDR', data: oracleSignal.rndr },
                    { label: 'IO', data: oracleSignal.io },
                  ].map(({ label, data }) => (
                    <div key={label} className="bg-muted/30 rounded p-2 text-center">
                      <div className="text-xs font-bold mb-1">{label}</div>
                      {data ? (
                        <>
                          <div className="text-xs font-mono">${data.price.toFixed(4)}</div>
                          <div className={`text-[10px] ${data.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)}%
                          </div>
                        </>
                      ) : <div className="text-xs text-muted-foreground">N/A</div>}
                    </div>
                  ))}
                </div>
                <button
                  onClick={fetchOracleSignal}
                  className="mt-3 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  ↻ Refresh signal
                </button>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Loading compute signal...</div>
            )}
          </CardContent>
        </Card>

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

            {/* Start / Stop */}
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

            {oracleSignal?.action === 'STANDBY' && (
              <div className="flex items-start gap-2 p-2 rounded bg-red-950/20 border border-red-500/20">
                <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-400">Oracle says STANDBY — compute tokens are bearish. Consider waiting for a better signal.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* P&L Dashboard */}
        {status && (
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Cash Remaining</div>
                <div className="font-mono font-bold text-lg flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  {status.cashRemaining.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  of ${status.budget} budget
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
          </div>
        )}

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
