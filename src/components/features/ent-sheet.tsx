"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { sb } from "@/lib/supabase/client";
import type { EntReferral, EntStatus } from "@/lib/types";
import { todayISO } from "@/lib/format";
import { ENT_STATUS } from "@/lib/labels";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PatientPicker, type PickedPatient } from "./patient-picker";
import { useApp } from "@/components/app/app-context";
import { cn, errorMessage } from "@/lib/utils";

export function EntSheet({
  open,
  onOpenChange,
  existing,
  patient,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing?: (EntReferral & { patient?: PickedPatient | null }) | null;
  patient?: PickedPatient | null;
  onSaved?: () => void;
}) {
  const { staff } = useApp();
  const [p, setP] = useState<PickedPatient | null>(null);
  const [dateSent, setDateSent] = useState(todayISO());
  const [entName, setEntName] = useState("");
  const [reason, setReason] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [status, setStatus] = useState<EntStatus>("sent");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setP(existing?.patient ?? patient ?? null);
    setDateSent(existing?.date_sent ?? todayISO());
    setEntName(existing?.ent_name ?? "");
    setReason(existing?.reason ?? "");
    setFollowUp(existing?.follow_up_date ?? "");
    setStatus(existing?.status ?? "sent");
    setNotes(existing?.notes ?? "");
    sb()
      .from("ent_referrals")
      .select("ent_name")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setNames([...new Set(((data as { ent_name: string }[]) ?? []).map((d) => d.ent_name))]));
  }, [open, existing, patient]);

  async function save() {
    if (!p) return toast.error("Choose or create the patient");
    if (!entName.trim()) return toast.error("Enter the ENT doctor or practice");
    setBusy(true);
    try {
      const row = {
        patient_id: p.id,
        date_sent: dateSent,
        ent_name: entName.trim(),
        reason: reason.trim() || null,
        follow_up_date: followUp || null,
        status,
        notes: notes.trim() || null,
        returned_on: status === "returned" ? existing?.returned_on ?? todayISO() : existing?.returned_on ?? null,
      };
      const { error } = existing
        ? await sb().from("ent_referrals").update(row).eq("id", existing.id)
        : await sb().from("ent_referrals").insert({ ...row, created_by: staff?.id ?? null });
      if (error) throw error;
      toast.success(existing ? "Referral updated" : "ENT referral added");
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
      title={existing ? "ENT referral" : "Add patient sent to ENT"}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {existing ? "Save" : "Add referral"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Patient">
          <PatientPicker value={p} onChange={setP} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date sent" htmlFor="ent-date">
            <Input id="ent-date" type="date" value={dateSent} onChange={(e) => setDateSent(e.target.value)} />
          </Field>
          <Field label="Follow-up / expected return" htmlFor="ent-fu" optional hint="You'll get a notification on this date.">
            <Input id="ent-fu" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
          </Field>
          <Field label="ENT doctor / practice" htmlFor="ent-name" className="sm:col-span-2">
            <Input id="ent-name" list="ent-names" value={entName} onChange={(e) => setEntName(e.target.value)} placeholder="e.g. Dr Patel, Netcare Parklands" />
            <datalist id="ent-names">
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>
          <Field label="Reason for referral" htmlFor="ent-reason" className="sm:col-span-2">
            <Textarea id="ent-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[72px]" />
          </Field>
        </div>
        <Field label="Status">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(ENT_STATUS) as EntStatus[]).map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  "h-11 rounded-xl border text-[13.5px] font-semibold transition",
                  status === s ? "border-primary bg-primary-soft text-primary-hover" : "border-border bg-card text-text hover:border-[#d5dde5]",
                )}
              >
                {ENT_STATUS[s].label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Notes" htmlFor="ent-notes" optional>
          <Textarea id="ent-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[72px]" />
        </Field>
      </div>
    </Sheet>
  );
}
