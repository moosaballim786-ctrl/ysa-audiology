"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, CircleDollarSign, Landmark } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { PaymentMethod } from "@/lib/types";
import { todayISO } from "@/lib/format";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PatientPicker, type PickedPatient } from "./patient-picker";
import { cn, errorMessage } from "@/lib/utils";
import { useApp } from "@/components/app/app-context";

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote; active: string }[] = [
  { value: "cash", label: "Cash", icon: Banknote, active: "border-sage/40 bg-sage-bg text-sage-text" },
  { value: "eft", label: "EFT", icon: Landmark, active: "border-secondary/30 bg-secondary-soft text-secondary" },
  { value: "unpaid", label: "Unpaid", icon: CircleDollarSign, active: "border-amber/40 bg-amber-bg text-amber-text" },
];

export function MethodPicker({
  value,
  onChange,
  options = METHODS,
}: {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
  options?: typeof METHODS;
}) {
  return (
    <div className={cn("grid gap-2", options.length === 3 ? "grid-cols-3" : "grid-cols-2")} role="radiogroup">
      {options.map((m) => {
        const Icon = m.icon;
        const active = value === m.value;
        return (
          <button
            type="button"
            key={m.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m.value)}
            className={cn(
              "flex h-[68px] flex-col items-center justify-center gap-1 rounded-2xl border text-[14px] font-semibold transition-all active:scale-[0.97]",
              active ? m.active : "border-border bg-card text-text hover:border-[#d5dde5]",
            )}
          >
            <Icon className="size-5" strokeWidth={1.9} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
export const PAID_METHODS = METHODS.filter((m) => m.value !== "unpaid");

export function PaymentSheet({
  open,
  onOpenChange,
  patient,
  appointmentId,
  visitId,
  onSaved,
  title = "Record payment",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patient?: PickedPatient | null;
  appointmentId?: string | null;
  visitId?: string | null;
  onSaved?: () => void;
  title?: string;
}) {
  const { staff } = useApp();
  const [p, setP] = useState<PickedPatient | null>(patient ?? null);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setP(patient ?? null);
      setDate(todayISO());
      setAmount("");
      setMethod("cash");
      setNote("");
    }
  }, [open, patient]);

  async function save() {
    const value = Number(amount.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return toast.error("Enter the amount");
    setBusy(true);
    try {
      let vId = visitId ?? null;
      if (!vId && appointmentId) {
        const { data } = await sb().from("visits").select("id").eq("appointment_id", appointmentId).maybeSingle();
        vId = (data as { id: string } | null)?.id ?? null;
      }
      const { error } = await sb().from("payments").insert({
        patient_id: p?.id ?? null,
        appointment_id: appointmentId ?? null,
        visit_id: vId,
        payment_date: date,
        amount: Math.round(value * 100) / 100,
        method,
        note: note.trim() || null,
        created_by: staff?.id ?? null,
      });
      if (error) throw error;
      toast.success(method === "unpaid" ? "Saved as unpaid" : "Payment recorded");
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
      title={title}
      description="Cash, EFT or Unpaid. Unpaid amounts aren't counted until marked as paid."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button onClick={save} loading={busy}>
            Save payment
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Patient" optional>
          <PatientPicker value={p} onChange={setP} allowNone noneLabel="Quick cash walk-in (no patient)" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (R)" htmlFor="pay-amount">
            <Input
              id="pay-amount"
              inputMode="decimal"
              placeholder="0.00"
              className="tnum text-lg font-semibold"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Date" htmlFor="pay-date">
            <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Method">
          <MethodPicker value={method} onChange={setMethod} />
        </Field>
        <Field label="Note" htmlFor="pay-note" optional>
          <Textarea id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[72px]" />
        </Field>
      </div>
    </Sheet>
  );
}
