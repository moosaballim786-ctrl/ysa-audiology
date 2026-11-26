"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { sb } from "@/lib/supabase/client";
import type { Patient } from "@/lib/types";
import { toE164 } from "@/lib/format";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { errorMessage } from "@/lib/utils";

/** Create or edit a patient's details. */
export function NewPatientSheet({
  open,
  onOpenChange,
  existing,
  onCreated,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing?: Patient | null;
  onCreated?: (id: string) => void;
  onSaved?: () => void;
}) {
  const [f, setF] = useState({
    full_name: "",
    phone: "",
    email: "",
    file_number: "",
    date_of_birth: "",
    address: "",
    notes: "",
    whatsapp_consent: false,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  useEffect(() => {
    if (!open) return;
    setF({
      full_name: existing?.full_name ?? "",
      phone: existing?.phone ? "0" + existing.phone.slice(3) : "",
      email: existing?.email ?? "",
      file_number: existing?.file_number ?? "",
      date_of_birth: existing?.date_of_birth ?? "",
      address: existing?.address ?? "",
      notes: existing?.notes ?? "",
      whatsapp_consent: existing?.whatsapp_consent ?? false,
    });
  }, [open, existing]);

  async function save() {
    if (f.full_name.trim().length < 2) return toast.error("Enter the patient's full name");
    const phone = f.phone.trim() ? toE164(f.phone) : null;
    if (f.phone.trim() && !phone) return toast.error("That mobile number doesn't look right");
    setBusy(true);
    try {
      const row = {
        full_name: f.full_name.trim(),
        phone,
        email: f.email.trim() || null,
        file_number: f.file_number.trim() || null,
        date_of_birth: f.date_of_birth || null,
        address: f.address.trim() || null,
        notes: f.notes.trim() || null,
        whatsapp_consent: f.whatsapp_consent,
        whatsapp_consent_at:
          f.whatsapp_consent && !(existing?.whatsapp_consent) ? new Date().toISOString() : f.whatsapp_consent ? existing?.whatsapp_consent_at ?? new Date().toISOString() : null,
        ...(existing ? { is_new_from_booking: false } : {}),
      };
      if (existing) {
        const { error } = await sb().from("patients").update(row).eq("id", existing.id);
        if (error) throw error;
        toast.success("Patient details saved");
        onSaved?.();
      } else {
        if (phone) {
          const { data: dup } = await sb().from("patients").select("id, full_name").eq("phone", phone).maybeSingle();
          if (dup && !confirm(`${(dup as { full_name: string }).full_name} already has this number. Create another patient anyway?`)) {
            setBusy(false);
            return;
          }
        }
        const { data, error } = await sb().from("patients").insert(row).select("id").single();
        if (error) throw error;
        toast.success("Patient added");
        onCreated?.((data as { id: string }).id);
      }
      onOpenChange(false);
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
      title={existing ? "Edit details" : "New patient"}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {existing ? "Save details" : "Add patient"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="pt-name" className="sm:col-span-2">
          <Input id="pt-name" value={f.full_name} onChange={set("full_name")} autoFocus={!existing} />
        </Field>
        <Field label="Mobile" htmlFor="pt-phone" optional>
          <Input id="pt-phone" type="tel" inputMode="tel" placeholder="082 123 4567" value={f.phone} onChange={set("phone")} />
        </Field>
        <Field label="Email" htmlFor="pt-email" optional>
          <Input id="pt-email" type="email" value={f.email} onChange={set("email")} />
        </Field>
        <Field label="Date of birth" htmlFor="pt-dob" optional hint="Used for birthday messages.">
          <Input id="pt-dob" type="date" value={f.date_of_birth} onChange={set("date_of_birth")} />
        </Field>
        <Field label="ID / file number" htmlFor="pt-file" optional>
          <Input id="pt-file" value={f.file_number} onChange={set("file_number")} />
        </Field>
        <Field label="Address" htmlFor="pt-addr" optional className="sm:col-span-2">
          <Input id="pt-addr" value={f.address} onChange={set("address")} />
        </Field>
        <Field label="Notes" htmlFor="pt-notes" optional className="sm:col-span-2">
          <Textarea id="pt-notes" value={f.notes} onChange={set("notes")} />
        </Field>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-bg-alt px-4 py-3 sm:col-span-2">
          <span>
            <span className="block text-[14px] font-medium text-heading">WhatsApp consent</span>
            <span className="block text-[12.5px] text-muted">Patient agreed to receive appointment messages on WhatsApp.</span>
          </span>
          <Switch checked={f.whatsapp_consent} onCheckedChange={(v) => setF((s) => ({ ...s, whatsapp_consent: v }))} />
        </label>
      </div>
    </Sheet>
  );
}
