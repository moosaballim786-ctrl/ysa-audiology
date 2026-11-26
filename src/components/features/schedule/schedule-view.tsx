"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Ban, CalendarRange, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { sb } from "@/lib/supabase/client";
import type { AppointmentWithRefs, BlockedTime, WorkingHours } from "@/lib/types";
import { APPT_SELECT, must } from "@/lib/db";
import { addDaysISO, fmtDate, fmtTZ, sastDate, sastToUtcISO, todayISO } from "@/lib/format";
import { apptDisplay, REASON_STYLE } from "@/lib/labels";
import { useQuery } from "@/lib/hooks/use-query";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { AppointmentSheet } from "@/components/features/appointment-sheet";
import { AppointmentForm } from "@/components/features/appointment-form";
import { BlockTimeSheet } from "./block-time-sheet";
import { useApp } from "@/components/app/app-context";
import { cn } from "@/lib/utils";

type View = "day" | "week" | "list";

const isoDow = (d: string) => Number(fmtDate(d, "i"));
const weekStart = (d: string) => addDaysISO(d, -(isoDow(d) - 1));
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function ScheduleView() {
  const { reasons } = useApp();
  const [view, setView] = useState<View>("day");
  const [date, setDate] = useState(todayISO());
  const [selected, setSelected] = useState<AppointmentWithRefs | null>(null);
  const [adding, setAdding] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const range = useMemo(() => {
    if (view === "day") return { from: date, to: addDaysISO(date, 1) };
    if (view === "week") {
      const ws = weekStart(date);
      return { from: ws, to: addDaysISO(ws, 7) };
    }
    return { from: todayISO(), to: addDaysISO(todayISO(), 90) };
  }, [view, date]);

  const appts = useQuery(`sched-${range.from}-${range.to}-${view}`, () => {
    let q = sb()
      .from("appointments")
      .select(APPT_SELECT)
      .gte("starts_at", sastToUtcISO(range.from, "00:00"))
      .lt("starts_at", sastToUtcISO(range.to, "00:00"))
      .neq("status", "declined")
      .order("starts_at");
    if (view === "list") q = q.in("status", ["requested", "approved"]);
    return must(q) as Promise<AppointmentWithRefs[]>;
  });
  const blocks = useQuery(`blocks-${range.from}-${range.to}`, () =>
    must(
      sb()
        .from("blocked_times")
        .select("*")
        .lt("starts_at", sastToUtcISO(range.to, "00:00"))
        .gt("ends_at", sastToUtcISO(range.from, "00:00"))
        .order("starts_at"),
    ) as Promise<BlockedTime[]>,
  );
  const hours = useQuery("working-hours", () =>
    must(sb().from("working_hours").select("*").order("weekday")) as Promise<WorkingHours[]>,
  );

  useEffect(() => {
    const ch = sb()
      .channel("schedule-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => void appts.reload())
      .subscribe();
    return () => {
      void sb().removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = () => {
    void appts.reload();
    void blocks.reload();
  };

  function shift(dir: 1 | -1) {
    setDate((d) => addDaysISO(d, view === "week" ? 7 * dir : dir));
  }

  const title =
    view === "day"
      ? date === todayISO()
        ? `Today · ${fmtDate(date, "EEE d MMMM")}`
        : fmtDate(date, "EEEE d MMMM yyyy")
      : view === "week"
        ? `${fmtDate(range.from, "d MMM")} – ${fmtDate(addDaysISO(range.from, 6), "d MMM yyyy")}`
        : "Upcoming · next 90 days";

  const loading = appts.loading && !appts.data;

  return (
    <div>
      <PageHeader
        label="Schedule"
        title="Appointments"
        subtitle="Colour-coded by reason. Tap any appointment to update it."
        action={
          <>
            <Button variant="secondary" onClick={() => setBlocking(true)}>
              <Ban /> Block time
            </Button>
            <Button onClick={() => setAdding(true)}>
              <CalendarPlus /> Add appointment
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "list", label: "List" },
          ]}
          className="w-full sm:w-auto"
        />
        {view !== "list" && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="icon" onClick={() => shift(-1)} aria-label="Previous">
              <ChevronLeft />
            </Button>
            <Button variant="secondary" onClick={() => setDate(todayISO())}>
              Today
            </Button>
            <Button variant="secondary" size="icon" onClick={() => shift(1)} aria-label="Next">
              <ChevronRight />
            </Button>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-11 rounded-xl border border-border bg-card px-3 text-[14px]"
              aria-label="Go to date"
            />
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[18px] font-semibold">{title}</h2>
        <div className="flex flex-wrap gap-1.5">
          {reasons
            .filter((r) => r.active)
            .map((r) => (
              <Pill key={r.id} tone={REASON_STYLE[r.color].tone} dot>
                {r.label}
              </Pill>
            ))}
        </div>
      </div>

      {loading ? (
        <Card className="space-y-3 p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </Card>
      ) : view === "day" ? (
        <DayGrid
          date={date}
          appts={appts.data ?? []}
          blocks={blocks.data ?? []}
          hours={hours.data ?? []}
          onSelect={setSelected}
          onAdd={() => setAdding(true)}
        />
      ) : view === "week" ? (
        <WeekView from={range.from} appts={appts.data ?? []} blocks={blocks.data ?? []} onSelect={setSelected} onPickDay={(d) => { setDate(d); setView("day"); }} />
      ) : (
        <ListView appts={appts.data ?? []} onSelect={setSelected} onAdd={() => setAdding(true)} />
      )}

      {view !== "list" && (blocks.data?.length ?? 0) > 0 && (
        <div className="mt-5 space-y-2">
          <div className="label-caps">Blocked times</div>
          {blocks.data!.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-[14px]">
              <div>
                <span className="font-medium text-heading">
                  {b.all_day
                    ? `${fmtTZ(b.starts_at, "EEE d MMM")}${sastDate(new Date(new Date(b.ends_at).getTime() - 1)) !== sastDate(b.starts_at) ? ` – ${fmtTZ(new Date(new Date(b.ends_at).getTime() - 1), "EEE d MMM")}` : ""} · all day`
                    : `${fmtTZ(b.starts_at, "EEE d MMM HH:mm")} – ${fmtTZ(b.ends_at, "HH:mm")}`}
                </span>
                {b.note && <span className="ml-2 text-muted">{b.note}</span>}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove block"
                onClick={async () => {
                  const { error } = await sb().from("blocked_times").delete().eq("id", b.id);
                  if (error) toast.error(error.message);
                  else {
                    toast.success("Block removed");
                    void blocks.reload();
                  }
                }}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AppointmentSheet appt={selected} onOpenChange={(o) => !o && setSelected(null)} onChanged={reload} />
      <AppointmentForm open={adding} onOpenChange={setAdding} defaultDate={view === "list" ? todayISO() : date} onSaved={reload} />
      <BlockTimeSheet open={blocking} onOpenChange={setBlocking} defaultDate={date} onSaved={reload} />
    </div>
  );
}

/* ───────────── Day: time grid ───────────── */
const PX = 1.5; // px per minute

function DayGrid({
  date,
  appts,
  blocks,
  hours,
  onSelect,
  onAdd,
}: {
  date: string;
  appts: AppointmentWithRefs[];
  blocks: BlockedTime[];
  hours: WorkingHours[];
  onSelect: (a: AppointmentWithRefs) => void;
  onAdd: () => void;
}) {
  const wh = hours.find((h) => h.weekday === isoDow(date));
  const startMin = Math.min(wh?.is_open ? toMin(wh.open_time) : 8 * 60, ...appts.map((a) => toMin(fmtTZ(a.starts_at, "HH:mm")))) ;
  const endMin = Math.max(wh?.is_open ? toMin(wh.close_time) : 17 * 60, ...appts.map((a) => toMin(fmtTZ(a.ends_at, "HH:mm")) || 24 * 60));
  const top = Math.floor(startMin / 60) * 60;
  const bottom = Math.ceil(endMin / 60) * 60;
  const height = (bottom - top) * PX;
  const hourMarks = Array.from({ length: (bottom - top) / 60 + 1 }, (_, i) => top + i * 60);
  const isToday = date === todayISO();
  const nowMin = toMin(fmtTZ(new Date(), "HH:mm"));
  const dayStart = sastToUtcISO(date, "00:00");
  const dayEnd = sastToUtcISO(addDaysISO(date, 1), "00:00");

  const y = (iso: string) => {
    if (iso <= dayStart) return 0;
    if (iso >= dayEnd) return height;
    return Math.max(0, Math.min(height, (toMin(fmtTZ(iso, "HH:mm")) - top) * PX));
  };

  return (
    <Card className="overflow-hidden">
      {!wh?.is_open && (
        <div className="border-b border-border bg-bg-alt px-5 py-2.5 text-[13px] text-muted">The practice is normally closed on this day.</div>
      )}
      <div className="relative flex" style={{ height: height + 24 }}>
        <div className="relative w-16 shrink-0 border-r border-border">
          {hourMarks.map((m) => (
            <div key={m} className="tnum absolute right-3 -translate-y-1/2 text-[11.5px] font-medium text-muted" style={{ top: (m - top) * PX + 12 }}>
              {String(Math.floor(m / 60)).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        <div className="relative flex-1" style={{ marginTop: 12 }}>
          {hourMarks.map((m) => (
            <div key={m} className="absolute inset-x-0 border-t border-border/70" style={{ top: (m - top) * PX }} />
          ))}
          {wh?.is_open && wh.lunch_start && wh.lunch_end && (
            <div
              className="absolute inset-x-0 flex items-center justify-center bg-[repeating-linear-gradient(135deg,#f1f4f7_0,#f1f4f7_6px,#f8fafc_6px,#f8fafc_12px)] text-[11px] font-semibold uppercase tracking-wider text-muted"
              style={{ top: (toMin(wh.lunch_start) - top) * PX, height: (toMin(wh.lunch_end) - toMin(wh.lunch_start)) * PX }}
            >
              Lunch
            </div>
          )}
          {blocks.map((b) => (
            <div
              key={b.id}
              className="absolute inset-x-2 flex items-start rounded-xl border border-coral/25 bg-coral-bg/70 px-3 py-1.5 text-[12px] font-medium text-coral-text"
              style={{ top: y(b.starts_at), height: Math.max(22, y(b.ends_at) - y(b.starts_at)) }}
            >
              Blocked{b.note ? ` · ${b.note}` : ""}
            </div>
          ))}
          {appts.map((a) => {
            const t = y(a.starts_at);
            const h = Math.max(30, y(a.ends_at) - t - 2);
            const style = a.reason ? REASON_STYLE[a.reason.color] : REASON_STYLE.slate;
            const d = apptDisplay(a);
            const faded = ["cancelled", "no_show"].includes(a.status);
            const requested = a.status === "requested";
            return (
              <button
                key={a.id}
                onClick={() => onSelect(a)}
                className={cn(
                  "absolute left-2 right-2 flex overflow-hidden rounded-xl border text-left shadow-[0_1px_2px_rgba(17,24,39,.05)] transition hover:-translate-y-px hover:shadow-soft",
                  style.soft,
                  requested ? "border-dashed border-amber" : "border-transparent",
                  faded && "opacity-50",
                )}
                style={{ top: t, height: h }}
              >
                <span className={cn("w-1 shrink-0", style.bar)} />
                <span className="flex min-w-0 flex-1 items-start justify-between gap-2 px-3 py-1.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-heading">{a.patient?.full_name}</span>
                    {h > 40 && (
                      <span className={cn("block truncate text-[12px]", style.text)}>
                        <span className="tnum">{fmtTZ(a.starts_at, "HH:mm")}–{fmtTZ(a.ends_at, "HH:mm")}</span> · {a.reason?.label}
                      </span>
                    )}
                  </span>
                  <Pill tone={d.tone} className="hidden text-[11px] sm:inline-flex">
                    {d.label}
                  </Pill>
                </span>
              </button>
            );
          })}
          {isToday && nowMin >= top && nowMin <= bottom && (
            <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: (nowMin - top) * PX }}>
              <span className="-ml-1 size-2 rounded-full bg-coral" />
              <span className="h-px flex-1 bg-coral/70" />
            </div>
          )}
        </div>
      </div>
      {appts.length === 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-[14px] text-muted">
          No appointments on this day.
          <Button variant="soft" size="sm" onClick={onAdd}>
            <CalendarPlus /> Add
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ───────────── Week ───────────── */
function WeekView({
  from,
  appts,
  blocks,
  onSelect,
  onPickDay,
}: {
  from: string;
  appts: AppointmentWithRefs[];
  blocks: BlockedTime[];
  onSelect: (a: AppointmentWithRefs) => void;
  onPickDay: (d: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(from, i));
  const today = todayISO();
  return (
    <div className="grid gap-3 md:grid-cols-7 md:gap-2">
      {days.map((d) => {
        const list = appts.filter((a) => sastDate(a.starts_at) === d);
        const blocked = blocks.some((b) => b.starts_at < sastToUtcISO(addDaysISO(d, 1), "00:00") && b.ends_at > sastToUtcISO(d, "00:00"));
        return (
          <Card key={d} className={cn("flex min-h-[120px] flex-col p-3 md:min-h-[320px]", d === today && "ring-2 ring-primary/30")}>
            <button onClick={() => onPickDay(d)} className="mb-2 flex items-baseline justify-between gap-2 text-left">
              <span className="label-caps">{fmtDate(d, "EEE")}</span>
              <span className={cn("tnum font-display text-[18px] font-semibold", d === today ? "text-primary" : "text-heading")}>
                {fmtDate(d, "d")}
              </span>
            </button>
            {blocked && <div className="mb-2 rounded-lg bg-coral-bg px-2 py-1 text-[11px] font-semibold text-coral-text">Blocked time</div>}
            <div className="flex flex-1 flex-col gap-1.5">
              {list.length === 0 && <div className="text-[12px] text-muted md:mt-2">—</div>}
              {list.map((a) => {
                const style = a.reason ? REASON_STYLE[a.reason.color] : REASON_STYLE.slate;
                const faded = ["cancelled", "no_show"].includes(a.status);
                return (
                  <button
                    key={a.id}
                    onClick={() => onSelect(a)}
                    className={cn(
                      "flex overflow-hidden rounded-lg border text-left transition hover:shadow-soft",
                      style.soft,
                      a.status === "requested" ? "border-dashed border-amber" : "border-transparent",
                      faded && "opacity-50",
                    )}
                  >
                    <span className={cn("w-1 shrink-0", style.bar)} />
                    <span className="min-w-0 px-2 py-1.5">
                      <span className="tnum block text-[11.5px] font-semibold text-muted">{fmtTZ(a.starts_at, "HH:mm")}</span>
                      <span className="block truncate text-[12.5px] font-semibold text-heading">{a.patient?.full_name}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ───────────── List ───────────── */
function ListView({ appts, onSelect, onAdd }: { appts: AppointmentWithRefs[]; onSelect: (a: AppointmentWithRefs) => void; onAdd: () => void }) {
  if (appts.length === 0)
    return (
      <EmptyState
        icon={CalendarRange}
        title="No upcoming appointments"
        description="Approved bookings and requests will show here."
        action={
          <Button onClick={onAdd}>
            <CalendarPlus /> Add appointment
          </Button>
        }
      />
    );
  const groups = new Map<string, AppointmentWithRefs[]>();
  appts.forEach((a) => {
    const d = sastDate(a.starts_at);
    groups.set(d, [...(groups.get(d) ?? []), a]);
  });
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([d, list]) => (
        <div key={d}>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="font-display text-[15px] font-semibold text-heading">
              {d === todayISO() ? "Today" : d === addDaysISO(todayISO(), 1) ? "Tomorrow" : fmtDate(d, "EEEE")}
            </span>
            <span className="text-[13px] text-muted">{fmtDate(d, "d MMMM yyyy")}</span>
          </div>
          <Card className="overflow-hidden">
            {list.map((a, i) => {
              const style = a.reason ? REASON_STYLE[a.reason.color] : REASON_STYLE.slate;
              const disp = apptDisplay(a);
              return (
                <button
                  key={a.id}
                  onClick={() => onSelect(a)}
                  className={cn("flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-bg-alt sm:px-5", i > 0 && "border-t border-border")}
                >
                  <span className="tnum w-12 shrink-0 font-display text-[15px] font-semibold text-heading">{fmtTZ(a.starts_at, "HH:mm")}</span>
                  <span className={cn("h-9 w-1 shrink-0 rounded-full", style.bar)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-heading">{a.patient?.full_name}</span>
                    <span className="block truncate text-[13px] text-muted">{a.reason?.label}</span>
                  </span>
                  <Pill tone={disp.tone} dot>
                    {disp.label}
                  </Pill>
                </button>
              );
            })}
          </Card>
        </div>
      ))}
    </div>
  );
}
