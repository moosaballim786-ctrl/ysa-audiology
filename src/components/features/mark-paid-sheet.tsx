"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { sb } from "@/lib/supabase/client";
import type { Payment, PaymentMethod } from "@/lib/types";
import { money, todayISO } from "@/lib/format";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { MethodPicker, PAID_METHODS } from "./payment-sheet";
import { errorMessage } from "@/lib/utils";

export function MarkPaidSheet({
  payment,
  onOpenChange,
  onSaved,
}: {
  payment: (Payment & { patient?: { full_name: string } | null }) | null;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (payment) {
      setMethod("cash");
      setDate(todayISO());
    }
  }, [payment]);

  async function save() {
    if (!payment) return;
    setBusy(true);
    try {
      const { error } = await sb().from("payments").update({ method, received_on: date }).eq("id", payment.id);
      if (error) throw error;
      toast.success("Marked as paid", { description: `${money(payment.amount)} · ${method === "cash" ? "Cash" : "EFT"}` });
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
      open={!!payment}
      onOpenChange={onOpenChange}
      title="Mark as paid"
      description={payment ? `${payment.patient?.full_name ?? "Walk-in"} · ${money(payment.amount)}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="sage" onClick={save} loading={busy}>
            Mark as paid
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Paid by">
          <MethodPicker value={method} onChange={setMethod} options={PAID_METHODS} />
        </Field>
        <Field label="Date paid" htmlFor="mp-date">
          <Input id="mp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
