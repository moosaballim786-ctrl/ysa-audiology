"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Check, Clock, MessageCircle, Phone, Sparkles, X } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { AppointmentWithRefs } from "@/lib/types";
import { fmtTZ, prettyPhone, sastDate, sastToUtcISO } from "@/lib/format";
import { sendWhatsApp } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { REASON_STYLE } from "@/lib/labels";
import { errorMessage } from "@/lib/utils";

export function BookingRequestCard({ appt, onChanged }: { appt: AppointmentWithRefs; onChanged?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [sDate, setSDate] = useState(sastDate(appt.starts_at));
  const [sTime, setSTime] = useState("");
  const style = appt.reason ? REASON_STYLE[appt.reason.color] : REASON_STYLE.slate;
  const durationMs = new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime();

  async function approve(at?: string) {
    setBusy("approve");
    try {
      const patch: Record<string, unknown> = { status: "approved", suggested_starts_at: null };
      if (at) {
        patch.starts_at = at;
        patch.ends_at = new Date(new Date(at).getTime() + durationMs).toISOString();
      }
      const { error } = await sb().from("appointments").update(patch).eq("id", appt.id);
      if (error) throw error;
      await sb().from("notifications").update({ read_at: new Date().toISOString() }).eq("appointment_id", appt.id).is("read_at", null);
      const res = await sendWhatsApp({ template: "booking_confirmation", appointment_id: appt.id });
      if (res?.status === "sent") toast.success("Approved — WhatsApp confirmation sent");
      else if (res?.status === "not_sent") toast.success("Approved", { description: res.error ?? "WhatsApp not sent" });
      else if (res?.status === "failed") toast.warning("Approved, but WhatsApp failed to send", { description: "You can retry from Notifications." });
      else toast.success("Approved");
      onChanged?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function decline() {
    setBusy("decline");
    try {
      const { error } = await sb()
        .from("appointments")
        .update({ status: "declined", decline_reason: declineReason.trim() || null })
        .eq("id", appt.id);
      if (error) throw error;
      await sb().from("notifications").update({ read_at: new Date().toISOString() }).eq("appointment_id", appt.id).is("read_at", null);
      toast.success("Request declined");
      setDeclineOpen(false);
      onChanged?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function suggest() {
    if (!/^\d{2}:\d{2}$/.test(sTime)) return toast.error("Pick a time to suggest");
    const at = sastToUtcISO(sDate, sTime);
    setBusy("suggest");
    try {
      const { error } = await sb().from("appointments").update({ suggested_starts_at: at }).eq("id", appt.id);
      if (error) throw error;
      const first = appt.patient?.full_name.split(" ")[0] ?? "";
      const text = `Hi ${first}, thank you for your booking request at Yusuf Suder Audiology. Unfortunately ${fmtTZ(appt.starts_at, "EEEE d MMMM 'at' HH:mm")} isn't available. Would ${fmtTZ(at, "EEEE d MMMM 'at' HH:mm")} suit you instead? We're hear for you.`;
      const phone = appt.patient?.phone?.replace("+", "");
      if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      toast.success("Suggestion saved", { description: "When the patient agrees, tap “Approve suggested time”." });
      setSuggestOpen(false);
      onChanged?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}>
      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Avatar name={appt.patient?.full_name} className="size-11" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/patients/${appt.patient_id}`} className="truncate font-display text-[16px] font-semibold text-heading hover:underline">
                {appt.patient?.full_name}
              </Link>
              {appt.patient?.is_new_from_booking && (
                <Pill tone="blue">
                  <Sparkles className="size-3" /> New
                </Pill>
              )}
            </div>
            {appt.patient?.phone && (
              <a href={`tel:${appt.patient.phone}`} className="tnum mt-0.5 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-secondary">
                <Phone className="size-3.5" /> {prettyPhone(appt.patient.phone)}
              </a>
            )}
          </div>
          <Pill tone="amber" dot>
            Awaiting
          </Pill>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-bg-alt px-3.5 py-3 text-[14px]">
          <span className="inline-flex items-center gap-2 font-semibold text-heading">
            <Clock className="size-4 text-primary" />
            <span className="tnum">{fmtTZ(appt.starts_at, "EEE d MMM · HH:mm")}</span>
          </span>
          <Pill tone={style.tone}>{appt.reason?.label}</Pill>
        </div>
        {appt.patient_note && <p className="mt-3 text-[14px] leading-relaxed text-text">“{appt.patient_note}”</p>}
        {appt.suggested_starts_at && (
          <div className="mt-3 rounded-xl border border-secondary/20 bg-secondary-soft px-3.5 py-2.5 text-[13.5px] text-secondary">
            Suggested: <span className="tnum font-semibold">{fmtTZ(appt.suggested_starts_at, "EEE d MMM · HH:mm")}</span>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {appt.suggested_starts_at ? (
            <Button variant="sage" onClick={() => approve(appt.suggested_starts_at!)} loading={busy === "approve"} className="col-span-2">
              <Check /> Approve suggested time
            </Button>
          ) : (
            <Button variant="sage" onClick={() => approve()} loading={busy === "approve"}>
              <Check /> Approve
            </Button>
          )}
          <Button variant="coral" onClick={() => setDeclineOpen(true)}>
            <X /> Decline
          </Button>
          <Button variant="secondary" onClick={() => setSuggestOpen(true)} className={appt.suggested_starts_at ? "" : "col-span-2"}>
            <MessageCircle /> Suggest another time
          </Button>
          {appt.suggested_starts_at && (
            <Button variant="ghost" onClick={() => approve()} loading={busy === "approve-orig"}>
              Approve original
            </Button>
          )}
        </div>
      </Card>

      <Sheet
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        title="Decline request"
        description={`${appt.patient?.full_name} · ${fmtTZ(appt.starts_at, "EEE d MMM HH:mm")}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeclineOpen(false)}>
              Back
            </Button>
            <Button variant="destructive" onClick={decline} loading={busy === "decline"}>
              Decline request
            </Button>
          </>
        }
      >
        <Field label="Reason" htmlFor="dec-r" optional hint="For your records only.">
          <Textarea id="dec-r" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
        </Field>
      </Sheet>

      <Sheet
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        title="Suggest another time"
        description="Opens WhatsApp with a ready-to-send message. Approve once the patient agrees."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSuggestOpen(false)}>
              Back
            </Button>
            <Button onClick={suggest} loading={busy === "suggest"}>
              <MessageCircle /> Suggest on WhatsApp
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="sg-d">
            <Input id="sg-d" type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} />
          </Field>
          <Field label="Time" htmlFor="sg-t">
            <Input id="sg-t" type="time" step={300} value={sTime} onChange={(e) => setSTime(e.target.value)} />
          </Field>
        </div>
      </Sheet>
    </motion.div>
  );
}
