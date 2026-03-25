"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { useStore } from "@/store/useStore";
import { useSummary } from "@/hooks/useSummary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DollarSign, TrendingUp, Clock, ArrowDownToLine, Building2, Wallet, Info
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell
} from "recharts";

const AGENT_ICONS: Record<string, string> = {
  oracle: "⚡", preacher: "📢", onboarding: "🚀", alert: "🔔",
};
const CHART_COLORS = ["hsl(4,85%,44%)", "hsl(32,95%,52%)", "hsl(45,95%,55%)", "hsl(145,60%,42%)"];

function WithdrawDialog({
  open, onClose, dest,
}: {
  open: boolean; onClose: () => void; dest: "wallet" | "gsb_bank";
}) {
  const { withdraw } = useStore();
  const summary = useSummary();
  const available = summary.confirmedBalance;
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState(available.toFixed(4));

  const handleWithdraw = () => {
    const amt = parseFloat(amount);
    if (!address.trim()) { toast.error("Enter a wallet address"); return; }
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (amt > available) { toast.error("Amount exceeds available balance"); return; }
    withdraw(address.trim(), amt, dest);
    toast.success(`Withdrawal initiated: $${amt.toFixed(4)} USDC`, {
      description: `→ ${dest === "gsb_bank" ? "GSB Tokenized Bank" : "Your Wallet"}`,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>{dest === "gsb_bank" ? "Forward to GSB Bank" : "Withdraw to Wallet"}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {dest === "gsb_bank"
              ? "Send USDC directly to your Agent Gas Bible tokenized bank address on Base."
              : "Withdraw available USDC to your personal Base wallet."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs">{dest === "gsb_bank" ? "GSB Bank Address (Base)" : "Your Wallet Address (Base)"}</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="0x..." className="mono text-sm bg-secondary border-border" data-testid="input-withdraw-address" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Amount (USDC)</Label>
            <div className="flex gap-2">
              <Input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0.001" max={available} step="0.0001" className="tabular text-sm bg-secondary border-border" data-testid="input-withdraw-amount" />
              <Button variant="outline" size="sm" className="text-xs shrink-0" onClick={() => setAmount(available.toFixed(4))}>Max</Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Available: <span className="text-primary font-semibold">${available.toFixed(4)} USDC</span></p>
          </div>
          <Button className="w-full gap-2" onClick={handleWithdraw} data-testid="btn-confirm-withdraw">
            <ArrowDownToLine size={14} /> Confirm Withdrawal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EarningsPage() {
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawDest, setWithdrawDest] = useState<"wallet" | "gsb_bank">("wallet");
  const { jobs, withdrawals } = useStore();
  const summary = useSummary();

  // Chart data by agent
  const byAgent = Object.entries(
    jobs
      .filter(j => j.status === "confirmed")
      .reduce((acc, j) => { acc[j.agentId] = (acc[j.agentId] || 0) + j.usdcAmount; return acc; }, {} as Record<string, number>)
  ).map(([id, total]) => ({ name: `${AGENT_ICONS[id] || "🤖"} ${id}`, total }));

  const kpis = [
    { label: "Total Earned",   value: `$${summary.totalEarned.toFixed(4)}`,   sub: "all time",            icon: TrendingUp,       color: "text-primary" },
    { label: "Available",      value: `$${summary.confirmedBalance.toFixed(4)}`, sub: "ready to withdraw",icon: DollarSign,       color: "text-green-400" },
    { label: "Pending",        value: `$${summary.pendingAmount.toFixed(4)}`,  sub: "awaiting confirm",    icon: Clock,            color: "text-yellow-400" },
    { label: "Withdrawn",      value: `$${summary.withdrawnAmount.toFixed(4)}`, sub: "sent out",          icon: ArrowDownToLine,  color: "text-blue-400" },
  ];

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto">
        <Header title="Earnings & Payouts" subtitle="Real-time USDC earned from ACP jobs. Withdraw to wallet or GSB bank." />
        <main className="p-5 space-y-6 max-w-5xl mx-auto">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
                  <Icon size={13} className={color} />
                </div>
                <div className={`text-xl font-bold tabular ${color}`}>{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
              </div>
            ))}
          </div>

          {/* Withdraw panel */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">Withdraw USDC</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Available: <span className="text-primary font-semibold">${summary.confirmedBalance.toFixed(4)} USDC</span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Tooltip>
                <TooltipTrigger>
                  <div className="w-full">
                    <Button
                      variant="outline"
                      className="w-full h-auto py-4 flex-col gap-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5"
                      disabled={summary.confirmedBalance <= 0}
                      onClick={() => { setWithdrawDest("wallet"); setWithdrawOpen(true); }}
                      data-testid="btn-withdraw-wallet"
                    >
                      <Wallet size={20} className="text-primary" />
                      <div className="text-sm font-semibold">My Base Wallet</div>
                      <div className="text-xs text-muted-foreground">Withdraw to personal address</div>
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Send USDC to your personal Base wallet</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger>
                  <div className="w-full">
                    <Button
                      variant="outline"
                      className="w-full h-auto py-4 flex-col gap-2 border-dashed border-border hover:border-yellow-500/50 hover:bg-yellow-500/5"
                      disabled={summary.confirmedBalance <= 0}
                      onClick={() => { setWithdrawDest("gsb_bank"); setWithdrawOpen(true); }}
                      data-testid="btn-withdraw-gsb"
                    >
                      <Building2 size={20} className="text-yellow-400" />
                      <div className="text-sm font-semibold">GSB Tokenized Bank</div>
                      <div className="text-xs text-muted-foreground">Auto-forward to bank address</div>
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Forward all USDC to your Agent Gas Bible tokenized bank — earns yield inside the GSB protocol</TooltipContent>
              </Tooltip>
            </div>
            {summary.confirmedBalance <= 0 && (
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                <Info size={11} /> No confirmed balance yet. Simulate jobs on the Overview or Agents page.
              </p>
            )}
          </div>

          {/* Earnings chart */}
          {byAgent.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Earnings by Agent</h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={byAgent} barSize={36}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(0 0% 45%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 45%)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <RTooltip
                    contentStyle={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)", borderRadius: 6, fontSize: 11 }}
                    formatter={(v) => [`$${typeof v === 'number' ? v.toFixed(4) : v} USDC`, 'Earned']}
                  />
                  <Bar dataKey="total" radius={[4,4,0,0]}>
                    {byAgent.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabs: Jobs / Withdrawals */}
          <Tabs defaultValue="jobs">
            <TabsList className="bg-secondary border border-border">
              <TabsTrigger value="jobs">ACP Jobs ({jobs.length})</TabsTrigger>
              <TabsTrigger value="withdrawals">Withdrawals ({withdrawals.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="jobs" className="mt-3">
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40">
                        {["Time","Agent","Job Ref","Type","USDC","Status"].map(h => (
                          <th key={h} className={`px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider ${h === "USDC" ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {jobs.map(job => (
                        <tr key={job.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </td>
                          <td className="px-4 py-2.5 text-xs">{AGENT_ICONS[job.agentId] || "🤖"} {job.agentName}</td>
                          <td className="px-4 py-2.5 mono text-xs text-muted-foreground">{job.jobRef}</td>
                          <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{job.type}</Badge></td>
                          <td className="px-4 py-2.5 text-right tabular text-primary font-semibold">${job.usdcAmount.toFixed(4)}</td>
                          <td className="px-4 py-2.5">
                            <Badge className={`text-[10px] ${
                              job.status === "confirmed" ? "bg-primary/10 text-primary border-primary/25" :
                              job.status === "pending"   ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/25" :
                              job.status === "withdrawn" ? "bg-blue-500/10 text-blue-400 border-blue-500/25" :
                              "bg-destructive/10 text-destructive"}`}>{job.status}</Badge>
                          </td>
                        </tr>
                      ))}
                      {jobs.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No jobs yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="withdrawals" className="mt-3">
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40">
                        {["Time","Destination","Address","USDC","Status"].map(h => (
                          <th key={h} className={`px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider ${h === "USDC" ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {withdrawals.map(w => (
                        <tr key={w.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(w.createdAt), { addSuffix: true })}
                          </td>
                          <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px] capitalize">{w.destination.replace("_"," ")}</Badge></td>
                          <td className="px-4 py-2.5 mono text-xs text-muted-foreground max-w-[160px] truncate">{w.toAddress}</td>
                          <td className="px-4 py-2.5 text-right tabular text-primary font-semibold">${w.usdcAmount.toFixed(4)}</td>
                          <td className="px-4 py-2.5"><Badge className={`text-[10px] ${w.status === "sent" ? "bg-primary/10 text-primary border-primary/25" : "bg-yellow-500/10 text-yellow-400"}`}>{w.status}</Badge></td>
                        </tr>
                      ))}
                      {withdrawals.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No withdrawals yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <WithdrawDialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} dest={withdrawDest} />
    </TooltipProvider>
  );
}
