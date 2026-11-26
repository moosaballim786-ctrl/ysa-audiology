"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Clock,
  DoorOpen,
  MessageSquareText,
  Phone,
  UserRound,
  XCircle,
} from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { AppointmentStatus, AppointmentWithRefs } from "@/lib/types";
import { fmtTZ, prettyPhone } from "@/lib/format";
import { apptDisplay, REASON_STYLE } from "@/lib/labels";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { AppointmentForm } from "./appointment-form";
import { PaymentSheet } from "./payment-sheet";
import { BookingRequestCard } from "./booking-request-card";
import { errorMessage } from "@/lib/utils";

/** Tap an appointment → status actions, reschedule, open patient. */
export function AppointmentSheet({
  appt,
  onOpenChange,
  onChanged,
}: {
  appt: AppointmentWithRefs | null;
  onOpenChange: (o: boolean) => void;
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState(false);
  const [payFor, setPayFor] = useState<AppointmentWithRefs | null>(null);

  async function setStatus(a: AppointmentWithRefs, status: AppointmentStatus | "arrived") {
    setBusy(status);
    try {
      const patch =
        status === "arrived"
          ? { arrived_at: new Date().toISOString(), status: "approved" as const }
          : { status, ...(status === "approved" ? { arrived_at: null } : {}) };
      const { error } = await sb().from("appointments").update(patch).eq("id", a.id);
      if (error) throw error;
      const label = { arrived: "Marked as arrived", completed: "Completed — visit added to history", no_show: "Marked as no-show", cancelled: "Appointment cancelled", approved: "Status reset to booked" } as Record<string, string>;
      toast.success(label[status] ?? "Updated");
      onChanged?.();
      if (status === "completed") {
        onOpenChange(false);
        setPayFor(a);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const a = appt;
  const disp = a ? apptDisplay(a) : null;
  const style = a?.reason ? REASON_STYLE[a.reason.color] : REASON_STYLE.slate;
  const closed = a && ["completed", "cancelled", "declined", "no_show"].includes(a.status);

  return (
    <>
      <Sheet open={!!a && !reschedule} onOpenChange={onOpenChange} title={a?.patient?.full_name ?? "Appointment"}>
        {a && disp && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-bg-alt p-4">
              <div className="flex items-center justify-between gap-3">
                <Pill tone={style.tone} dot>
                  {a.reason?.label}
                </Pill>
                <Pill tone={disp.tone}>{disp.label}</Pill>
              </div>
              <div className="mt-4 flex items-center gap-3 text-heading">
                <Clock className="size-[18px] text-muted" />
                <div>
                  <div className="font-display text-[17px] font-semibold">{fmtTZ(a.starts_at, "EEEE d MMMM")}</div>
                  <div className="tnum text-[14px] text-muted">
                    {fmtTZ(a.starts_at, "HH:mm")} – {fmtTZ(a.ends_at, "HH:mm")}
                  </div>
                </div>
              </div>
              {a.patient?.phone && (
                <a href={`tel:${a.patient.phone}`} className="mt-3 flex items-center gap-3 text-[14px] text-secondary">
                  <Phone className="size-[18px] text-muted" /> <span className="tnum">{prettyPhone(a.patient.phone)}</span>
                </a>
              )}
              {(a.patient_note || a.staff_note) && (
                <div className="mt-3 flex gap-3 text-[14px] text-text">
                  <MessageSquareText className="mt-0.5 size-[18px] shrink-0 text-muted" />
                  <div className="space-y-1">
                    {a.patient_note && <p>“{a.patient_note}”</p>}
                    {a.staff_note && <p className="text-muted">{a.staff_note}</p>}
                  </div>
                </div>
              )}
            </div>

            {a.status === "requested" && (
              <BookingRequestCard
                appt={a}
                onChanged={() => {
                  onChanged?.();
                  onOpenChange(false);
                }}
              />
            )}
            {!closed && a.status !== "requested" && (
              <div className="grid grid-cols-2 gap-2">
                {!a.arrived_at && a.status === "approved" && (
                  <Button variant="soft" size="lg" onClick={() => setStatus(a, "arrived")} loading={busy === "arrived"}>
                    <DoorOpen /> Arrived
                  </Button>
                )}
                <Button variant="sage" size="lg" onClick={() => setStatus(a, "completed")} loading={busy === "completed"}>
                  <CheckCircle2 /> Completed
                </Button>
                <Button variant="coral" size="lg" onClick={() => setStatus(a, "no_show")} loading={busy === "no_show"}>
                  <CircleSlash /> No-show
                </Button>
                <Button variant="secondary" size="lg" onClick={() => setReschedule(true)}>
                  <CalendarClock /> Reschedule
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="text-crimson hover:bg-coral-bg"
                  onClick={() => {
                    if (confirm("Cancel this appointment?")) void setStatus(a, "cancelled");
                  }}
                  loading={busy === "cancelled"}
                >
                  <XCircle /> Cancel
                </Button>
              </div>
            )}
            {closed && a.status !== "completed" && (
              <Button variant="secondary" className="w-full" onClick={() => setStatus(a, "approved")} loading={busy === "approved"}>
                Undo — set back to booked
              </Button>
            )}
            {a.status === "completed" && (
              <Button variant="soft" className="w-full" onClick={() => { onOpenChange(false); setPayFor(a); }}>
                Record payment
              </Button>
            )}
            <Button asChild variant="secondary" className="w-full">
              <Link href={`/patients/${a.patient_id}`}>
                <UserRound /> Open patient
              </Link>
            </Button>
          </div>
        )}
      </Sheet>
      <AppointmentForm
        open={reschedule}
        onOpenChange={(o) => {
          setReschedule(o);
          if (!o) onOpenChange(false);
        }}
        existing={a}
        onSaved={onChanged}
      />
      <PaymentSheet
        open={!!payFor}
        onOpenChange={(o) => !o && setPayFor(null)}
        patient={payFor?.patient ? { id: payFor.patient.id, full_name: payFor.patient.full_name, phone: payFor.patient.phone } : null}
        appointmentId={payFor?.id}
        title="Record payment for this visit"
        onSaved={onChanged}
      />
    </>
  );
}
