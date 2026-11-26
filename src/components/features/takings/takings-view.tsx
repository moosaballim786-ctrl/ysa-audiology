"use client";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Download, Minus, Plus, Receipt, Wallet } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { Payment } from "@/lib/types";
import { must } from "@/lib/db";
import { addDaysISO, fmtDate, money, moneyShort, todayISO } from "@/lib/format";
import { PAY_METHOD } from "@/lib/labels";
import { useQuery } from "@/lib/hooks/use-query";
import { PageHeader, SectionLabel } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/badge";
import { CountUp } from "@/components/ui/count-up";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";
import { PaymentSheet } from "@/components/features/payment-sheet";
import { MarkPaidSheet } from "@/components/features/mark-paid-sheet";
import { cn } from "@/lib/utils";

type Period = "day" | "week" | "month" | "year";
type PayRow = Payment & { patient: { id: string; full_name: string } | null };

const isoDow = (d: string) => Number(fmtDate(d, "i"));
const monthStart = (d: string) => d.slice(0, 7) + "-01";
const addMonths = (d: string, n: number) => {
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
};

function periodRange(p: Period, anchor: string): { start: string; end: string } {
  if (p === "day") return { start: anchor, end: addDaysISO(anchor, 1) };
  if (p === "week") {
    const s = addDaysISO(anchor, -(isoDow(anchor) - 1));
    return { start: s, end: addDaysISO(s, 7) };
  }
  if (p === "month") {
    const s = monthStart(anchor);
    return { start: s, end: addMonths(s, 1) };
  }
  const s = anchor.slice(0, 4) + "-01-01";
  return { start: s, end: `${Number(anchor.slice(0, 4)) + 1}-01-01` };
}
function shiftAnchor(p: Period, a: string, dir: number) {
  if (p === "day") return addDaysISO(a, dir);
  if (p === "week") return addDaysISO(a, 7 * dir);
  if (p === "month") return addMonths(monthStart(a), dir);
  return `${Number(a.slice(0, 4)) + dir}-01-01`;
}

export function TakingsView() {
  const [period, setPeriod] = useState<Period>("day");
  const [anchor, setAnchor] = useState(todayISO());
  const [adding, setAdding] = useState(false);
  const [marking, setMarking] = useState<PayRow | null>(null);

  const cur = periodRange(period, anchor);
  const prev = periodRange(period, shiftAnchor(period, anchor, -1));
  // For "day" the chart shows the surrounding week
  const chartRange = period === "day" ? periodRange("week", anchor) : cur;
  const fetchFrom = [prev.start, chartRange.start].sort()[0];
  const fetchTo = [cur.end, chartRange.end].sort()[1];

  const received = useQuery(`recv-${fetchFrom}-${fetchTo}`, () =>
    must(
      sb()
        .from("payments")
        .select("*, patient:patients(id, full_name)")
        .gte("received_on", fetchFrom)
        .lt("received_on", fetchTo)
        .order("received_on", { ascending: false })
        .order("created_at", { ascending: false }),
    ) as Promise<PayRow[]>,
  );
  const unpaid = useQuery("unpaid-all", () =>
    must(
      sb().from("payments").select("*, patient:patients(id, full_name)").eq("method", "unpaid").order("payment_date", { ascending: false }),
    ) as Promise<PayRow[]>,
  );

  const reload = () => {
    void received.reload();
    void unpaid.reload();
  };

  const stats = useMemo(() => {
    const rows = received.data ?? [];
    const inCur = rows.filter((r) => r.received_on! >= cur.start && r.received_on! < cur.end);
    const inPrev = rows.filter((r) => r.received_on! >= prev.start && r.received_on! < prev.end);
    const sum = (l: PayRow[]) => l.reduce((s, r) => s + Number(r.amount), 0);
    const total = sum(inCur);
    const prevTotal = sum(inPrev);
    const outstanding = (unpaid.data ?? []).filter((r) => r.payment_date >= cur.start && r.payment_date < cur.end);
    return {
      list: inCur,
      total,
      cash: sum(inCur.filter((r) => r.method === "cash")),
      eft: sum(inCur.filter((r) => r.method === "eft")),
      count: inCur.length,
      unpaid: sum(outstanding),
      unpaidCount: outstanding.length,
      change: prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : total > 0 ? null : 0,
    };
  }, [received.data, unpaid.data, cur.start, cur.end, prev.start, prev.end]);

  const chart = useMemo(() => {
    const rows = received.data ?? [];
    if (period === "year") {
      return Array.from({ length: 12 }, (_, i) => {
        const m = `${cur.start.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`;
        const l = rows.filter((r) => r.received_on!.startsWith(m));
        return {
          label: fmtDate(m + "-01", "MMM"),
          cash: l.filter((r) => r.method === "cash").reduce((s, r) => s + Number(r.amount), 0),
          eft: l.filter((r) => r.method === "eft").reduce((s, r) => s + Number(r.amount), 0),
          active: false,
        };
      });
    }
    const days: string[] = [];
    for (let d = chartRange.start; d < chartRange.end; d = addDaysISO(d, 1)) days.push(d);
    return days.map((d) => {
      const l = rows.filter((r) => r.received_on === d);
      return {
        label: period === "month" ? fmtDate(d, "d") : fmtDate(d, "EEE"),
        cash: l.filter((r) => r.method === "cash").reduce((s, r) => s + Number(r.amount), 0),
        eft: l.filter((r) => r.method === "eft").reduce((s, r) => s + Number(r.amount), 0),
        active: period === "day" && d === anchor,
      };
    });
  }, [received.data, period, cur.start, chartRange.start, chartRange.end, anchor]);

  const label =
    period === "day"
      ? anchor === todayISO()
        ? `Today · ${fmtDate(anchor, "d MMMM yyyy")}`
        : fmtDate(anchor, "EEEE d MMMM yyyy")
      : period === "week"
        ? `${fmtDate(cur.start, "d MMM")} – ${fmtDate(addDaysISO(cur.end, -1), "d MMM yyyy")}`
        : period === "month"
          ? fmtDate(cur.start, "MMMM yyyy")
          : cur.start.slice(0, 4);
  const prevLabel = { day: "yesterday", week: "last week", month: "last month", year: "last year" }[period];

  function exportCsv() {
    const rows = stats.list;
    const unpaidRows = (unpaid.data ?? []).filter((r) => r.payment_date >= cur.start && r.payment_date < cur.end);
    const all = [...rows, ...unpaidRows];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ["Visit date", "Received on", "Patient", "Method", "Amount (ZAR)", "Was unpaid", "Note"].join(","),
      ...all.map((r) =>
        [r.payment_date, r.received_on ?? "", r.patient?.full_name ?? "Walk-in", PAY_METHOD[r.method].label, Number(r.amount).toFixed(2), r.was_unpaid ? "Yes" : "No", r.note ?? ""]
          .map(esc)
          .join(","),
      ),
      "",
      [esc("Total received"), "", "", "", stats.total.toFixed(2)].join(","),
      [esc("Cash"), "", "", "", stats.cash.toFixed(2)].join(","),
      [esc("EFT"), "", "", "", stats.eft.toFixed(2)].join(","),
      [esc("Unpaid outstanding"), "", "", "", stats.unpaid.toFixed(2)].join(","),
    ];
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ysa-takings-${period}-${cur.start}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const loading = received.loading && !received.data;

  return (
    <div>
      <PageHeader
        label="Takings"
        title="Takings"
        subtitle="Cash and EFT received. Unpaid amounts count once they're marked as paid."
        action={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={loading}>
              <Download /> Export CSV
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus /> Record payment
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={period}
          onChange={(p) => {
            setPeriod(p);
            setAnchor(todayISO());
          }}
          options={[
            { value: "day", label: "Daily" },
            { value: "week", label: "Weekly" },
            { value: "month", label: "Monthly" },
            { value: "year", label: "Yearly" },
          ]}
          className="w-full sm:w-auto"
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" onClick={() => setAnchor((a) => shiftAnchor(period, a, -1))} aria-label="Previous period">
            <ChevronLeft />
          </Button>
          <div className="min-w-[180px] text-center font-display text-[15px] font-semibold text-heading">{label}</div>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setAnchor((a) => shiftAnchor(period, a, 1))}
            disabled={cur.end > todayISO()}
            aria-label="Next period"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      {/* Hero total */}
      <Card className="overflow-hidden">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.1fr_1.4fr]">
          <div>
            <div className="label-caps">Total received</div>
            {loading ? (
              <Skeleton className="mt-3 h-11 w-48" />
            ) : (
              <div className="mt-2 font-display text-[40px] font-bold leading-none tracking-tight text-heading sm:text-[46px]">
                <CountUp value={stats.total} format={money} />
              </div>
            )}
            <div className="mt-3">
              <ChangeBadge change={stats.change} label={prevLabel} />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <MiniStat label="Cash" value={stats.cash} dot="bg-sage" />
              <MiniStat label="EFT" value={stats.eft} dot="bg-secondary" />
              <MiniStat label="Unpaid outstanding" value={stats.unpaid} dot="bg-amber" tone={stats.unpaid > 0 ? "text-amber-text" : undefined} />
              <div className="rounded-2xl bg-bg-alt px-4 py-3">
                <div className="text-[12.5px] text-muted">Payments</div>
                <div className="tnum mt-0.5 font-display text-[18px] font-semibold text-heading">{stats.count}</div>
              </div>
            </div>
          </div>
          <div className="h-[240px] min-w-0 sm:h-[280px]">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap={period === "month" ? 2 : "22%"}>
                  <CartesianGrid vertical={false} stroke="#E4E9EF" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11.5 }} interval={period === "month" ? 2 : 0} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11.5 }} tickFormatter={(v) => moneyShort(v).replace("R", "R ")} width={64} />
                  <Tooltip
                    cursor={{ fill: "#E7F3F5", radius: 8 }}
                    contentStyle={{ borderRadius: 14, border: "1px solid #E4E9EF", boxShadow: "0 8px 30px -12px rgba(30,41,59,.25)", fontSize: 13 }}
                    formatter={(v, n) => [money(Number(v)), n === "cash" ? "Cash" : "EFT"]}
                  />
                  <Bar dataKey="cash" stackId="a" fill="#4E9A78" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="eft" stackId="a" fill="#2A7F8F" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </Card>

      {/* Unpaid */}
      <SectionLabel action={<span className="tnum text-[13px] font-semibold text-amber-text">{money((unpaid.data ?? []).reduce((s, r) => s + Number(r.amount), 0))} total</span>}>
        Unpaid
      </SectionLabel>
      {unpaid.loading && !unpaid.data ? (
        <ListSkeleton rows={2} />
      ) : !(unpaid.data ?? []).length ? (
        <EmptyState icon={Wallet} title="Nothing unpaid" description="Payments saved as Unpaid appear here until they're settled." />
      ) : (
        <Card className="divide-y divide-border">
          {unpaid.data!.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-heading">{r.patient?.full_name ?? "Walk-in"}</div>
                <div className="text-[13px] text-muted">
                  {fmtDate(r.payment_date)}
                  {r.note && ` · ${r.note}`}
                </div>
              </div>
              <div className="tnum font-display text-[16px] font-semibold text-amber-text">{money(r.amount)}</div>
              <Button variant="sage" size="sm" onClick={() => setMarking(r)}>
                Mark as paid
              </Button>
            </div>
          ))}
        </Card>
      )}

      {/* Payments in period */}
      <SectionLabel>Payments received</SectionLabel>
      {loading ? (
        <ListSkeleton rows={3} />
      ) : stats.list.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No payments in this period"
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus /> Record payment
            </Button>
          }
        />
      ) : (
        <Card className="divide-y divide-border">
          {stats.list.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-heading">{r.patient?.full_name ?? "Walk-in"}</div>
                <div className="text-[13px] text-muted">
                  {fmtDate(r.received_on, "EEE d MMM")}
                  {r.was_unpaid && ` · was unpaid (${fmtDate(r.payment_date, "d MMM")})`}
                  {r.note && ` · ${r.note}`}
                </div>
              </div>
              <Pill tone={PAY_METHOD[r.method].tone}>{PAY_METHOD[r.method].label}</Pill>
              <div className="tnum w-24 text-right font-display text-[15px] font-semibold text-heading">{money(r.amount)}</div>
            </div>
          ))}
        </Card>
      )}

      <PaymentSheet open={adding} onOpenChange={setAdding} onSaved={reload} />
      <MarkPaidSheet payment={marking} onOpenChange={(o) => !o && setMarking(null)} onSaved={reload} />
    </div>
  );
}

function MiniStat({ label, value, dot, tone }: { label: string; value: number; dot: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-bg-alt px-4 py-3">
      <div className="flex items-center gap-1.5 text-[12.5px] text-muted">
        <span className={cn("size-2 rounded-full", dot)} /> {label}
      </div>
      <div className={cn("tnum mt-0.5 font-display text-[18px] font-semibold text-heading", tone)}>{money(value)}</div>
    </div>
  );
}

function ChangeBadge({ change, label }: { change: number | null; label: string }) {
  if (change === null) return <Pill tone="sage">New vs {label}</Pill>;
  if (Math.abs(change) < 0.05)
    return (
      <Pill tone="slate">
        <Minus className="size-3" /> Same as {label}
      </Pill>
    );
  const up = change > 0;
  return (
    <Pill tone={up ? "sage" : "coral"}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      <span className="tnum">{Math.abs(change).toFixed(1)}%</span> vs {label}
    </Pill>
  );
}
