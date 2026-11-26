"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { Bell, CalendarCheck2, CalendarPlus, CheckCircle2, Inbox, Hourglass, Wallet } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { AppointmentWithRefs } from "@/lib/types";
import { APPT_SELECT, must } from "@/lib/db";
import { addDaysISO, fmtTZ, greetingDate, money, sastToUtcISO, todayISO } from "@/lib/format";
import { apptDisplay, REASON_STYLE } from "@/lib/labels";
import { useQuery } from "@/lib/hooks/use-query";
import { useApp } from "@/components/app/app-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { CountUp } from "@/components/ui/count-up";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";
import { SectionLabel } from "@/components/ui/page-header";
import { BookingRequestCard } from "@/components/features/booking-request-card";
import { AppointmentSheet } from "@/components/features/appointment-sheet";
import { AppointmentForm } from "@/components/features/appointment-form";
import { cn } from "@/lib/utils";

export function HomeView() {
  const { unread, refreshCounts } = useApp();
  const today = todayISO();
  const [selected, setSelected] = useState<AppointmentWithRefs | null>(null);
  const [adding, setAdding] = useState(false);

  const requests = useQuery("requests", () =>
    must(
      sb().from("appointments").select(APPT_SELECT).eq("status", "requested").order("starts_at"),
    ) as Promise<AppointmentWithRefs[]>,
  );
  const todays = useQuery(`today-${today}`, () =>
    must(
      sb()
        .from("appointments")
        .select(APPT_SELECT)
        .gte("starts_at", sastToUtcISO(today, "00:00"))
        .lt("starts_at", sastToUtcISO(addDaysISO(today, 1), "00:00"))
        .in("status", ["approved", "completed", "no_show", "cancelled"])
        .order("starts_at"),
    ) as Promise<AppointmentWithRefs[]>,
  );
  const takings = useQuery(`takings-${today}`, async () => {
    const rows = (await must(sb().from("payments").select("amount").eq("received_on", today))) as { amount: number }[];
    return rows.reduce((s, r) => s + Number(r.amount), 0);
  });

  const reloadAll = useCallback(() => {
    void requests.reload();
    void todays.reload();
    void takings.reload();
    void refreshCounts();
  }, [requests, todays, takings, refreshCounts]);

  // Live updates when a booking arrives from /book or another device changes something
  useEffect(() => {
    const ch = sb()
      .channel("home-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        void requests.reload();
        void todays.reload();
      })
      .subscribe();
    return () => {
      void sb().removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useMemo(() => todays.data ?? [], [todays.data]);
  const seen = list.filter((a) => a.status === "completed").length;
  const remaining = list.filter((a) => a.status === "approved").length;
  const nowISO = new Date().toISOString();

  return (
    <div>
      {/* Greeting */}
      <section className="mb-8">
        <h1 className="text-[30px] font-bold leading-[1.12] sm:text-[38px]">Asalamualaykum Doctor Yusuf</h1>
        <p className="mt-2 text-[15px] font-medium text-text">{greetingDate()}</p>
        <p className="mt-1 text-[13px] text-muted">We&rsquo;re hear for you</p>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={CheckCircle2} label="Patients seen today" tone="sage" loading={todays.loading && !todays.data}>
          <CountUp value={seen} />
        </Stat>
        <Stat icon={Hourglass} label="Remaining today" tone="teal" loading={todays.loading && !todays.data}>
          <CountUp value={remaining} />
        </Stat>
        <Stat icon={Wallet} label="Today's takings" tone="blue" loading={takings.loading && takings.data === undefined} href="/takings">
          <CountUp value={takings.data ?? 0} format={money} />
        </Stat>
        <Stat icon={Bell} label="Unread notifications" tone="coral" href="/notifications">
          <CountUp value={unread} />
        </Stat>
      </section>

      {/* Booking requests */}
      <SectionLabel
        action={
          (requests.data?.length ?? 0) > 0 && (
            <span className="tnum text-[13px] font-semibold text-amber-text">{requests.data!.length} waiting</span>
          )
        }
      >
        Booking requests awaiting approval
      </SectionLabel>
      {requests.loading && !requests.data ? (
        <ListSkeleton rows={2} />
      ) : requests.data && requests.data.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {requests.data.map((a) => (
              <BookingRequestCard key={a.id} appt={a} onChanged={reloadAll} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <EmptyState
          icon={Inbox}
          title="No requests waiting"
          description="New online bookings from the practice website appear here for approval."
        />
      )}

      {/* Today's schedule */}
      <SectionLabel
        action={
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <CalendarPlus /> Add
          </Button>
        }
      >
        Today&rsquo;s schedule
      </SectionLabel>
      {todays.loading && !todays.data ? (
        <ListSkeleton rows={3} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={CalendarCheck2}
          title="Nothing booked for today"
          description="Add a walk-in or phone booking to get started."
          action={
            <Button onClick={() => setAdding(true)}>
              <CalendarPlus /> Add appointment
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ol className="relative">
            {list.map((a, i) => {
              const d = apptDisplay(a);
              const style = a.reason ? REASON_STYLE[a.reason.color] : REASON_STYLE.slate;
              const isNow = a.status === "approved" && a.starts_at <= nowISO && a.ends_at > nowISO;
              const dim = ["cancelled", "no_show"].includes(a.status);
              return (
                <li key={a.id}>
                  <button
                    onClick={() => setSelected(a)}
                    className={cn(
                      "group flex w-full items-stretch gap-4 px-4 py-3.5 text-left transition hover:bg-bg-alt sm:px-5",
                      i > 0 && "border-t border-border",
                      dim && "opacity-60",
                    )}
                  >
                    <div className="w-14 shrink-0 pt-0.5 text-right">
                      <div className="tnum font-display text-[15px] font-semibold text-heading">{fmtTZ(a.starts_at, "HH:mm")}</div>
                      <div className="tnum text-[12px] text-muted">{fmtTZ(a.ends_at, "HH:mm")}</div>
                    </div>
                    <div className={cn("w-1 shrink-0 rounded-full", style.bar, isNow && "animate-pulse")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold text-heading">{a.patient?.full_name}</span>
                        {isNow && <Pill tone="teal">Now</Pill>}
                      </div>
                      <div className="truncate text-[13.5px] text-muted">{a.reason?.label}</div>
                    </div>
                    <div className="flex items-center">
                      <Pill tone={d.tone} dot>
                        {d.label}
                      </Pill>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <AppointmentSheet appt={selected} onOpenChange={(o) => !o && setSelected(null)} onChanged={reloadAll} />
      <AppointmentForm open={adding} onOpenChange={setAdding} onSaved={reloadAll} />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  tone,
  children,
  loading,
  href,
}: {
  icon: typeof Bell;
  label: string;
  tone: "sage" | "teal" | "blue" | "coral";
  children: React.ReactNode;
  loading?: boolean;
  href?: string;
}) {
  const tones = {
    sage: "bg-sage-bg text-sage-text",
    teal: "bg-primary-soft text-primary-hover",
    blue: "bg-secondary-soft text-secondary",
    coral: "bg-coral-bg text-coral-text",
  };
  const body = (
    <Card className={cn("h-full p-4 transition-all sm:p-5", href && "hover:-translate-y-0.5 hover:shadow-lift")}>
      <div className={cn("mb-4 flex size-9 items-center justify-center rounded-xl", tones[tone])}>
        <Icon className="size-[18px]" strokeWidth={2} />
      </div>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <div className="font-display text-[24px] font-bold leading-none text-heading sm:text-[28px]">{children}</div>
      )}
      <div className="mt-2 text-[13px] text-muted">{label}</div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
