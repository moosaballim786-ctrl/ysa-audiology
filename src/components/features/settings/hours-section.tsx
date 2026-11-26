"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { Reason, ReasonColor, WorkingHours } from "@/lib/types";
import { must } from "@/lib/db";
import { useQuery } from "@/lib/hooks/use-query";
import { useApp } from "@/components/app/app-context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Pill } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { REASON_STYLE, WEEKDAYS } from "@/lib/labels";
import { cn, errorMessage } from "@/lib/utils";

const t5 = (t: string | null) => (t ? t.slice(0, 5) : "");

export function HoursSection() {
  const { settings, refreshMeta } = useApp();
  const hours = useQuery("wh-settings", () => must(sb().from("working_hours").select("*").order("weekday")) as Promise<WorkingHours[]>);
  const reasonsQ = useQuery("reasons-settings", () => must(sb().from("appointment_reasons").select("*").order("sort_order")) as Promise<Reason[]>);
  const [rows, setRows] = useState<WorkingHours[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [booking, setBooking] = useState({ lead: 120, horizon: 90, step: 15 });
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (hours.data) setRows(hours.data.map((h) => ({ ...h, open_time: t5(h.open_time), close_time: t5(h.close_time), lunch_start: t5(h.lunch_start) || null, lunch_end: t5(h.lunch_end) || null })));
  }, [hours.data]);
  useEffect(() => {
    if (reasonsQ.data) setReasons(reasonsQ.data);
  }, [reasonsQ.data]);
  useEffect(() => {
    if (settings) setBooking({ lead: settings.booking_lead_minutes, horizon: settings.booking_horizon_days, step: settings.slot_step_minutes });
  }, [settings]);

  const upd = (wd: number, patch: Partial<WorkingHours>) => setRows((r) => r.map((x) => (x.weekday === wd ? { ...x, ...patch } : x)));

  async function saveHours() {
    for (const r of rows) {
      if (r.is_open && r.close_time <= r.open_time) return toast.error(`${WEEKDAYS[r.weekday - 1]}: closing time must be after opening`);
      if (r.lunch_start && r.lunch_end && r.lunch_end <= r.lunch_start) return toast.error(`${WEEKDAYS[r.weekday - 1]}: lunch end must be after lunch start`);
      if (!!r.lunch_start !== !!r.lunch_end) return toast.error(`${WEEKDAYS[r.weekday - 1]}: set both lunch times or neither`);
    }
    setBusy("hours");
    try {
      const { error } = await sb().from("working_hours").upsert(rows);
      if (error) throw error;
      toast.success("Working hours saved");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function saveReasons() {
    setBusy("reasons");
    try {
      for (const r of reasons) {
        const { error } = await sb()
          .from("appointment_reasons")
          .update({ label: r.label.trim(), duration_minutes: r.duration_minutes, color: r.color, active: r.active })
          .eq("id", r.id);
        if (error) throw error;
      }
      await refreshMeta();
      toast.success("Appointment types saved");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function saveBooking() {
    setBusy("booking");
    try {
      const { error } = await sb()
        .from("practice_settings")
        .update({ booking_lead_minutes: booking.lead, booking_horizon_days: booking.horizon, slot_step_minutes: booking.step })
        .eq("id", 1);
      if (error) throw error;
      await refreshMeta();
      toast.success("Booking rules saved");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (!hours.data || !reasonsQ.data) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader label="Hours" title="Working hours & lunch" />
        <CardBody className="space-y-2">
          {rows.map((r) => (
            <div key={r.weekday} className={cn("rounded-2xl border border-border p-3 sm:p-4", !r.is_open && "bg-bg-alt")}>
              <div className="flex items-center justify-between gap-3">
                <span className="w-28 font-semibold text-heading">{WEEKDAYS[r.weekday - 1]}</span>
                <div className="flex items-center gap-2 text-[13px] text-muted">
                  {r.is_open ? "Open" : "Closed"}
                  <Switch checked={r.is_open} onCheckedChange={(v) => upd(r.weekday, { is_open: v })} aria-label={`${WEEKDAYS[r.weekday - 1]} open`} />
                </div>
              </div>
              {r.is_open && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Field label="Opens">
                    <Input type="time" step={300} value={r.open_time} onChange={(e) => upd(r.weekday, { open_time: e.target.value })} />
                  </Field>
                  <Field label="Closes">
                    <Input type="time" step={300} value={r.close_time} onChange={(e) => upd(r.weekday, { close_time: e.target.value })} />
                  </Field>
                  <Field label="Lunch from" optional>
                    <Input type="time" step={300} value={r.lunch_start ?? ""} onChange={(e) => upd(r.weekday, { lunch_start: e.target.value || null })} />
                  </Field>
                  <Field label="Lunch to" optional>
                    <Input type="time" step={300} value={r.lunch_end ?? ""} onChange={(e) => upd(r.weekday, { lunch_end: e.target.value || null })} />
                  </Field>
                </div>
              )}
            </div>
          ))}
          <div className="pt-2">
            <Button onClick={saveHours} loading={busy === "hours"}>
              Save hours
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader label="Slot lengths" title="Appointment types" />
        <CardBody className="space-y-3">
          <p className="text-[14px] text-muted">The first two are offered on the public booking page. Slot length decides which times are shown.</p>
          {reasons.map((r) => (
            <div key={r.id} className="grid grid-cols-[1fr_96px] gap-2 rounded-2xl border border-border p-3 sm:grid-cols-[1fr_110px_130px_auto] sm:items-end">
              <Field label={r.public_bookable ? "Name (online)" : "Name"}>
                <Input value={r.label} onChange={(e) => setReasons((l) => l.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)))} />
              </Field>
              <Field label="Minutes">
                <Input
                  type="number"
                  min={5}
                  step={5}
                  className="tnum"
                  value={r.duration_minutes}
                  onChange={(e) => setReasons((l) => l.map((x) => (x.id === r.id ? { ...x, duration_minutes: Math.max(5, Number(e.target.value) || 5) } : x)))}
                />
              </Field>
              <Field label="Colour">
                <Select value={r.color} onChange={(e) => setReasons((l) => l.map((x) => (x.id === r.id ? { ...x, color: e.target.value as ReasonColor } : x)))}>
                  {(Object.keys(REASON_STYLE) as ReasonColor[]).map((c) => (
                    <option key={c} value={c}>
                      {c[0].toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex h-11 items-center gap-2 sm:justify-end">
                {r.public_bookable && <Pill tone="teal">Online</Pill>}
                <Switch
                  checked={r.active}
                  onCheckedChange={(v) => setReasons((l) => l.map((x) => (x.id === r.id ? { ...x, active: v } : x)))}
                  aria-label={`${r.label} active`}
                />
              </div>
            </div>
          ))}
          <Button onClick={saveReasons} loading={busy === "reasons"}>
            Save appointment types
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader label="Online booking" title="Booking rules" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Minimum notice (minutes)" hint="How soon someone can book.">
            <Input type="number" min={0} step={15} className="tnum" value={booking.lead} onChange={(e) => setBooking((b) => ({ ...b, lead: Number(e.target.value) || 0 }))} />
          </Field>
          <Field label="Book up to (days ahead)">
            <Input type="number" min={1} max={365} className="tnum" value={booking.horizon} onChange={(e) => setBooking((b) => ({ ...b, horizon: Number(e.target.value) || 1 }))} />
          </Field>
          <Field label="Start times every">
            <Select value={booking.step} onChange={(e) => setBooking((b) => ({ ...b, step: Number(e.target.value) }))}>
              {[5, 10, 15, 20, 30, 60].map((s) => (
                <option key={s} value={s}>
                  {s} minutes
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            <Button onClick={saveBooking} loading={busy === "booking"}>
              Save booking rules
            </Button>
            <Button asChild variant="secondary">
              <Link href="/schedule">
                <Ban /> Block dates & times
              </Link>
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
