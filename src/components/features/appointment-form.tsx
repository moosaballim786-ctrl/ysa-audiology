"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, MessageCircle } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { AppointmentWithRefs } from "@/lib/types";
import { fmtDate, sastDate, sastTime, sastToUtcISO, todayISO } from "@/lib/format";
import { sendWhatsApp } from "@/lib/db";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PatientPicker, type PickedPatient } from "./patient-picker";
import { useApp } from "@/components/app/app-context";
import { cn, errorMessage } from "@/lib/utils";

/** Add (walk-in / phone booking) or reschedule an appointment. */
export function AppointmentForm({
  open,
  onOpenChange,
  existing,
  defaultDate,
  defaultPatient,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing?: AppointmentWithRefs | null;
  defaultDate?: string;
  defaultPatient?: PickedPatient | null;
  onSaved?: () => void;
}) {
  const { reasons, staff } = useApp();
  const active = useMemo(() => reasons.filter((r) => r.active), [reasons]);
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [reasonId, setReasonId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [slots, setSlots] = useState<string[]>([]);
  const [clash, setClash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reason = active.find((r) => r.id === reasonId);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setPatient(existing.patient ? { id: existing.patient.id, full_name: existing.patient.full_name, phone: existing.patient.phone } : null);
      setReasonId(existing.reason_id);
      setDate(sastDate(existing.starts_at));
      setTime(sastTime(existing.starts_at));
      setDuration(Math.round((new Date(existing.ends_at).getTime() - new Date(existing.starts_at).getTime()) / 60000));
      setNote(existing.staff_note ?? "");
    } else {
      setPatient(defaultPatient ?? null);
      setReasonId(active[0]?.id ?? "");
      setDate(defaultDate ?? todayISO());
      setTime("");
      setDuration(active[0]?.duration_minutes ?? 30);
      setNote("");
    }
    setNotify(true);
  }, [open, existing, defaultDate, defaultPatient, active]);

  useEffect(() => {
    if (reason && !existing) setDuration(reason.duration_minutes);
  }, [reason, existing]);

  // Suggested open slots for that day
  useEffect(() => {
    if (!open || !reason || !date) return;
    let alive = true;
    sb()
      .rpc("get_available_slots", { p_date: date, p_reason_code: reason.code })
      .then(({ data }) => {
        if (alive) setSlots(((data as { slot_label: string }[]) ?? []).map((s) => s.slot_label));
      });
    return () => {
      alive = false;
    };
  }, [open, reason, date]);

  // Clash check
  useEffect(() => {
    if (!open || !date || !/^\d{2}:\d{2}$/.test(time)) {
      setClash(null);
      return;
    }
    const start = sastToUtcISO(date, time);
    const end = new Date(new Date(start).getTime() + duration * 60000).toISOString();
    let q = sb()
      .from("appointments")
      .select("id, starts_at, patient:patients(full_name)")
      .in("status", ["requested", "approved"])
      .lt("starts_at", end)
      .gt("ends_at", start);
    if (existing) q = q.neq("id", existing.id);
    let alive = true;
    q.then(({ data }) => {
      if (!alive) return;
      const first = (data as unknown as { starts_at: string; patient: { full_name: string } | null }[] | null)?.[0];
      setClash(first ? `Overlaps with ${first.patient?.full_name ?? "another booking"} at ${sastTime(first.starts_at)}` : null);
    });
    return () => {
      alive = false;
    };
  }, [open, date, time, duration, existing]);

  async function save() {
    if (!patient) return toast.error("Choose or create a patient");
    if (!reason) return toast.error("Choose a reason");
    if (!/^\d{2}:\d{2}$/.test(time)) return toast.error("Choose a time");
    setBusy(true);
    try {
      const starts_at = sastToUtcISO(date, time);
      const ends_at = new Date(new Date(starts_at).getTime() + duration * 60000).toISOString();
      if (existing) {
        const { error } = await sb()
          .from("appointments")
          .update({
            patient_id: patient.id,
            reason_id: reason.id,
            starts_at,
            ends_at,
            staff_note: note.trim() || null,
            reminder_sent_at: null,
            status: existing.status === "requested" ? "approved" : existing.status,
          })
          .eq("id", existing.id);
        if (error) throw error;
        toast.success("Appointment rescheduled", { description: `${fmtDate(date, "EEE d MMM")} at ${time}` });
        if (notify) void sendWhatsApp({ template: "booking_confirmation", appointment_id: existing.id });
      } else {
        const { data, error } = await sb()
          .from("appointments")
          .insert({
            patient_id: patient.id,
            reason_id: reason.id,
            starts_at,
            ends_at,
            status: "approved",
            source: "staff",
            staff_note: note.trim() || null,
            created_by: staff?.id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        toast.success("Appointment booked", { description: `${patient.full_name} · ${fmtDate(date, "EEE d MMM")} at ${time}` });
        if (notify) void sendWhatsApp({ template: "booking_confirmation", appointment_id: (data as { id: string }).id });
      }
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? "Reschedule appointment" : "Add appointment"}
      description={existing ? undefined : "For walk-ins and phone bookings."}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {existing ? "Save changes" : "Book appointment"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Patient">
          <PatientPicker value={patient} onChange={setPatient} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
          <Field label="Reason" htmlFor="ap-reason">
            <Select id="ap-reason" value={reasonId} onChange={(e) => setReasonId(e.target.value)}>
              {active.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Length (min)" htmlFor="ap-dur">
            <Input
              id="ap-dur"
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Math.max(5, Number(e.target.value) || 5))}
              className="tnum"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="ap-date">
            <Input id="ap-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time" htmlFor="ap-time">
            <Input id="ap-time" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} className="tnum" />
          </Field>
        </div>
        {slots.length > 0 && (
          <div>
            <div className="label-caps mb-2">Open times</div>
            <div className="flex flex-wrap gap-1.5">
              {slots.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setTime(s)}
                  className={cn(
                    "tnum h-9 rounded-xl border px-3 text-[13.5px] font-medium transition",
                    time === s ? "border-primary bg-primary text-white" : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {clash && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-bg px-3.5 py-2.5 text-[13.5px] text-amber-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {clash}
          </div>
        )}
        <Field label="Staff note" htmlFor="ap-note" optional>
          <Textarea id="ap-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[72px]" />
        </Field>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-bg-alt px-4 py-3">
          <span className="flex items-center gap-2.5 text-[14px]">
            <MessageCircle className="size-[18px] text-sage" /> Send WhatsApp confirmation
          </span>
          <Switch checked={notify} onCheckedChange={setNotify} />
        </label>
      </div>
    </Sheet>
  );
}
