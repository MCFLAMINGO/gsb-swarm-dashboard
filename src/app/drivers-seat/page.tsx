'use client'

import { useState, useEffect, useRef } from 'react'
import { Gauge, Send, Zap, Copy, Share2, Bell, TrendingUp, ExternalLink, Activity, DollarSign, Bot, RefreshCw, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

/* ── Agent Result Card ───────────────────────────────────────────────── */

function AgentResultCard({ agent, content, timestamp }: { agent: string; content: string; timestamp: string }) {
  // Detect content type and render accordingly
  const isThread    = content.includes('1/') || (content.includes('1.') && content.includes('\n') && content.length > 200)
  const isJSON      = content.trim().startsWith('{')
  void content.match(/^[-•*]/m) // hasBullets — used by formatText below
  void content.match(/^#{1,3} /m)  // hasHeaders — used by formatText below

  let parsed: Record<string, unknown> | null = null
  if (isJSON) {
    try { parsed = JSON.parse(content) } catch { /* not json */ }
  }

  const agentColors: Record<string, string> = {
    preacher:   'border-blue-500/30 bg-blue-950/20',
    oracle:     'border-purple-500/30 bg-purple-950/20',
    alert:      'border-yellow-500/30 bg-yellow-950/20',
    onboarding: 'border-green-500/30 bg-green-950/20',
  }
  const agentIcons: Record<string, string> = {
    preacher: '🧵', oracle: '📊', alert: '🚨', onboarding: '🚀',
  }

  const colorClass = agentColors[agent] || 'border-border bg-muted/20'
  const icon = agentIcons[agent] || '🤖'

  // Format markdown-ish text
  const formatText = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={i} className="h-2" />
        // Bold **text**
        const formatted = trimmed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        // Bullet points
        if (/^[-•*]\s/.test(trimmed)) {
          return <div key={i} className="flex gap-2 text-sm"><span className="text-primary mt-0.5">•</span><span dangerouslySetInnerHTML={{ __html: formatted.replace(/^[-•*]\s/, '') }} /></div>
        }
        // Numbered
        if (/^\d+[./]\s/.test(trimmed)) {
          const num = trimmed.match(/^(\d+)/)?.[1]
          const rest = trimmed.replace(/^\d+[./]\s/, '')
          return <div key={i} className="flex gap-2 text-sm"><span className="text-primary font-bold w-4 shrink-0">{num}.</span><span dangerouslySetInnerHTML={{ __html: rest }} /></div>
        }
        // Tweet-style lines (1/ 2/ etc)
        if (/^\d+\//.test(trimmed)) {
          return <div key={i} className="text-sm border-l-2 border-blue-500/50 pl-3 py-1">{trimmed}</div>
        }
        // Headers
        if (/^#{1,3}\s/.test(trimmed)) {
          return <div key={i} className="font-bold text-sm mt-2" dangerouslySetInnerHTML={{ __html: formatted.replace(/^#+\s/, '') }} />
        }
        return <div key={i} className="text-sm" dangerouslySetInnerHTML={{ __html: formatted }} />
      })
  }

  return (
    <div className={`w-full max-w-[90%] rounded-xl border px-4 py-3 ${colorClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{agent}</span>
          {isThread && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">Thread</span>}
          {parsed && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full">Structured Data</span>}
        </div>
        <span className="text-[10px] text-muted-foreground">{timestamp}</span>
      </div>

      {/* Content */}
      {parsed ? (
        // JSON/structured data — render as key-value grid
        <div className="space-y-1.5">
          {Object.entries(parsed).slice(0, 12).map(([k, v]) => (
            <div key={k} className="grid grid-cols-5 gap-2 text-xs">
              <span className="col-span-2 text-muted-foreground font-medium capitalize">{k.replace(/_/g, ' ')}</span>
              <span className="col-span-3 text-foreground font-mono truncate">
                {typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v)}
              </span>
            </div>
          ))}
          {Object.keys(parsed).length > 12 && (
            <div className="text-xs text-muted-foreground">+{Object.keys(parsed).length - 12} more fields</div>
          )}
        </div>
      ) : (
        // Text content — formatted
        <div className="space-y-0.5 leading-relaxed">
          {formatText(content)}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex gap-2 mt-3 pt-2 border-t border-border/30">
        <button
          onClick={() => navigator.clipboard.writeText(content)}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted/50"
        >
          Copy
        </button>
        {content.length > 0 && (
          <span className="text-[10px] text-muted-foreground self-center">{content.length} chars</span>
        )}
      </div>
    </div>
  )
}

/* ── Quick-fire presets ──────────────────────────────────────────────── */

const QUICK_COMMANDS = [
  { label: '🧵 Post $GSB thread', icon: Share2, cmd: 'Write and post a viral thread about $GSB agent swarm earning USDC on Virtuals Protocol. Make it compelling for crypto Twitter.', agent: 'preacher' },
  { label: '📊 Swarm status', icon: Activity, cmd: 'Give me a full status report on the GSB swarm — agents online, jobs completed, and earnings summary.', agent: 'oracle' },
  { label: '🚨 Send Telegram alert', icon: Bell, cmd: 'Send a Telegram alert with current $GSB swarm status and any notable activity in the past hour.', agent: 'alert' },
  { label: '💊 Market bleeding.cash', icon: DollarSign, cmd: 'Write a promotional thread about bleeding.cash — AI financial triage for restaurants at $24.95. Target struggling restaurant owners on Twitter.', agent: 'preacher' },
  { label: '📈 Token analysis', icon: TrendingUp, cmd: 'Analyze $GSB token — current price action, volume, and what smart money is doing. Give a recommendation.', agent: 'oracle' },
]

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function DriversSeat() {
  const [activeProperty, setActiveProperty] = useState<'gsb' | 'bleeding'>('gsb')
  const [selectedAgent, setSelectedAgent] = useState('preacher')
  const [command, setCommand] = useState('')
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user'|'agent', content: string, agent?: string, timestamp: string}>>([])
  const [outputFeed, setOutputFeed] = useState<Array<{id: string, agent: string, content: string, timestamp: string, canPost: boolean}>>([])
  const [activityLog, setActivityLog] = useState<Array<{time: string, property: string, agent: string, command: string, result: string}>>([])
  const [swarmStatus, setSwarmStatus] = useState<{status: string, agents: number, jobsFired: number} | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  /* ── Data fetching ─────────────────────────────────────────────────── */

  useEffect(() => {
    const fetchSwarm = async () => {
      try {
        const res = await fetch('https://gsb-swarm-production.up.railway.app/api/resource/swarm_status')
        const data = await res.json()
        setSwarmStatus({
          status: data.status || 'ONLINE',
          agents: data.agents?.length || 4,
          jobsFired: data.jobsFired || 0
        })
      } catch { /* swarm may be offline */ }
    }
    fetchSwarm()
    const interval = setInterval(fetchSwarm, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('gsb_drivers_seat_log')
    if (saved) setActivityLog(JSON.parse(saved))
  }, [])

  /* ── Fire command ──────────────────────────────────────────────────── */

  const fireCommand = async (cmd?: string) => {
    const mission = cmd || command
    if (!mission.trim() || isLoading) return

    setIsLoading(true)
    const timestamp = new Date().toLocaleTimeString()
    setChatHistory(prev => [...prev, { role: 'user', content: mission, timestamp }])
    setCommand('')

    try {
      // Step 1 — dispatch and get jobId
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dispatch-secret': 'gsb-dispatch-2026' },
        body: JSON.stringify({ agentId: selectedAgent, mission })
      })
      const data = await res.json()
      if (data.error) {
        throw new Error(data.error)
      }

      // Result comes back directly — synchronous dispatch
      let result = data.result || 'No response from agent.'
      if (!result) result = 'No response from agent.'

      // Step 3 — render result
      const ts = new Date().toLocaleTimeString()
      setChatHistory(prev => [...prev, { role: 'agent', content: result, agent: selectedAgent, timestamp: ts }])
      setOutputFeed(prev => [{ id: Date.now().toString(), agent: selectedAgent, content: result, timestamp: ts, canPost: selectedAgent === 'preacher' }, ...prev.slice(0, 9)])

      const logEntry = { time: timestamp, property: activeProperty === 'gsb' ? '$GSB' : 'bleeding.cash', agent: selectedAgent, command: mission.slice(0, 60), result: result.slice(0, 100) }
      setActivityLog(prev => {
        const updated = [logEntry, ...prev.slice(0, 29)]
        localStorage.setItem('gsb_drivers_seat_log', JSON.stringify(updated))
        return updated
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setChatHistory(prev => [...prev, { role: 'agent', content: `Error: ${msg}`, agent: selectedAgent, timestamp: new Date().toLocaleTimeString() }])
    } finally {
      setIsLoading(false)
      // Scroll to bottom when result arrives
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  /* ── JSX ────────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Gauge className="w-5 h-5 text-primary" />
          <span className="font-bold text-lg">The Driver&apos;s Seat</span>
          <Badge variant="outline" className="text-xs">
            {swarmStatus?.status === 'ONLINE' ? '● LIVE' : '○ Offline'}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={activeProperty === 'gsb' ? 'default' : 'outline'} onClick={() => setActiveProperty('gsb')}>
            🤖 $GSB Swarm
          </Button>
          <Button size="sm" variant={activeProperty === 'bleeding' ? 'default' : 'outline'} onClick={() => setActiveProperty('bleeding')}>
            💊 bleeding.cash
          </Button>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden gap-0">

        {/* LEFT — Property panels */}
        <div className="w-56 flex-shrink-0 border-r border-border p-3 flex flex-col gap-3 overflow-y-auto">
          {/* GSB Card */}
          <Card className="border-red-900/30 bg-red-950/10">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold">🤖 GSB Swarm</span>
                <span className="text-xs text-green-400">● {swarmStatus?.status || 'LIVE'}</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>{swarmStatus?.agents || 4} agents online</div>
                <div>Jobs: {swarmStatus?.jobsFired || 0}</div>
              </div>
              <Button size="sm" variant="ghost" className="w-full mt-2 text-xs h-7" onClick={() => window.open('https://gsb-swarm-production.up.railway.app', '_blank')}>
                Open Dashboard <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          {/* bleeding.cash Card */}
          <Card className="border-amber-900/30 bg-amber-950/10">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold">💊 bleeding.cash</span>
                <span className="text-xs text-green-400">● LIVE</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Triage service</div>
                <div>$24.95 per job</div>
              </div>
              <Button size="sm" variant="ghost" className="w-full mt-2 text-xs h-7" onClick={() => window.open('https://www.bleeding.cash', '_blank')}>
                Visit Site <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Separator />
          <div className="text-xs text-muted-foreground font-medium">Quick Fire</div>
          {QUICK_COMMANDS.map((qc) => (
            <Button key={qc.label} size="sm" variant="ghost" className="w-full justify-start text-xs h-8 px-2"
              onClick={() => { setSelectedAgent(qc.agent); fireCommand(qc.cmd) }}>
              <span className="truncate">{qc.label}</span>
            </Button>
          ))}
        </div>

        {/* CENTER — Command center */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat */}
          <div className="flex-1 overflow-y-auto p-4" style={{scrollBehavior:'smooth'}}>
            {chatHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 py-20">
                <Gauge className="w-10 h-10 opacity-20" />
                <p>Select an agent and fire a command</p>
                <p className="text-xs opacity-50">Use the quick commands on the left or type your own</p>
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'user' ? (
                  <div className="max-w-[70%] rounded-lg px-3 py-2 text-sm bg-primary text-primary-foreground">
                    {msg.content}
                  </div>
                ) : (
                  <AgentResultCard agent={msg.agent || ''} content={msg.content} timestamp={msg.timestamp} />
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start mb-3 w-full max-w-[90%]">
                <div className="w-full rounded-xl border border-border bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{animationDelay:'0ms'}} />
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{animationDelay:'150ms'}} />
                      <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{animationDelay:'300ms'}} />
                    </div>
                    <span className="text-xs text-muted-foreground animate-pulse">Agent working — polling for result...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex gap-2 mb-2">
              <Select value={selectedAgent} onValueChange={(v) => { if (v) setSelectedAgent(v) }}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oracle">📊 Oracle</SelectItem>
                  <SelectItem value="preacher">🧵 Preacher</SelectItem>
                  <SelectItem value="alert">🚨 Alert</SelectItem>
                  <SelectItem value="onboarding">🚀 Onboarding</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground self-center">← select agent then command</span>
            </div>
            <div className="flex gap-2">
              <Textarea
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Tell your agent what to do..."
                className="min-h-[60px] max-h-[120px] text-sm resize-none"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fireCommand() }}}
              />
              <Button onClick={() => fireCommand()} disabled={isLoading || !command.trim()} className="self-end h-10 px-4">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT — Activity + quick actions */}
        <div className="w-72 flex-shrink-0 border-l border-border flex flex-col overflow-hidden">
          <Tabs defaultValue="activity" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-3 mt-3 grid w-full grid-cols-2">
              <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
              <TabsTrigger value="feed" className="text-xs">Output Feed</TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="flex-1 overflow-hidden flex flex-col px-3 pb-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-medium text-muted-foreground">Last 30 actions</span>
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setActivityLog([]); localStorage.removeItem('gsb_drivers_seat_log') }}>Clear</Button>
              </div>
              <ScrollArea className="flex-1">
                {activityLog.length === 0 && <p className="text-xs text-muted-foreground p-2">No activity yet</p>}
                {activityLog.map((entry, i) => (
                  <div key={i} className="border-b border-border/50 py-2 px-1">
                    <div className="flex items-center gap-1 mb-1">
                      <Badge variant="outline" className="text-xs h-4 px-1">{entry.property}</Badge>
                      <span className="text-xs text-muted-foreground">{entry.time}</span>
                    </div>
                    <div className="text-xs font-medium truncate">{entry.command}</div>
                    <div className="text-xs text-muted-foreground truncate">{entry.result}</div>
                  </div>
                ))}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="feed" className="flex-1 overflow-hidden flex flex-col px-3 pb-3">
              <div className="py-2">
                <span className="text-xs font-medium text-muted-foreground">Live output this session</span>
              </div>
              <ScrollArea className="flex-1">
                {outputFeed.length === 0 && <p className="text-xs text-muted-foreground p-2">No output yet — fire a command</p>}
                {outputFeed.map((item) => (
                  <Card key={item.id} className="mb-2">
                    <CardContent className="p-2">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs h-4 px-1">{item.agent}</Badge>
                        <span className="text-xs text-muted-foreground">{item.timestamp}</span>
                      </div>
                      <p className="text-xs line-clamp-3">{item.content}</p>
                      <div className="flex gap-1 mt-2">
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => navigator.clipboard.writeText(item.content)}>
                          <Copy className="w-3 h-3 mr-1" /> Copy
                        </Button>
                        {item.canPost && (
                          <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-blue-400">
                            <Share2 className="w-3 h-3 mr-1" /> Post
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
