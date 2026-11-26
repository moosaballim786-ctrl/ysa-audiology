"use client";
import { useEffect, useState } from "react";
import { Check, Plus, Search, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { sb } from "@/lib/supabase/client";
import type { Patient } from "@/lib/types";
import { prettyPhone, toE164 } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { cn, errorMessage } from "@/lib/utils";

export type PickedPatient = Pick<Patient, "id" | "full_name" | "phone">;

/** Search an existing patient by name/phone, or create one inline. */
export function PatientPicker({
  value,
  onChange,
  allowNone,
  noneLabel = "No patient (walk-in)",
}: {
  value: PickedPatient | null;
  onChange: (p: PickedPatient | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (value) return;
    const term = q.trim();
    const t = setTimeout(async () => {
      setLoading(true);
      let query = sb().from("patients").select("id, full_name, phone").order("full_name").limit(8);
      if (term) {
        const digits = term.replace(/\D/g, "");
        const phoneTerm = digits.length >= 3 ? (digits.startsWith("0") ? digits.slice(1) : digits) : null;
        query = phoneTerm
          ? query.or(`full_name.ilike.%${term.replace(/[%,()]/g, "")}%,phone.ilike.%${phoneTerm}%`)
          : query.ilike("full_name", `%${term.replace(/[%,()]/g, "")}%`);
      } else {
        query = query.order("updated_at", { ascending: false });
      }
      const { data } = await query;
      setResults((data as PickedPatient[]) ?? []);
      setLoading(false);
    }, 180);
    return () => clearTimeout(t);
  }, [q, value]);

  async function create() {
    const phone = newPhone.trim() ? toE164(newPhone) : null;
    if (newName.trim().length < 2) return toast.error("Enter the patient's full name");
    if (newPhone.trim() && !phone) return toast.error("That mobile number doesn't look right");
    setBusy(true);
    try {
      if (phone) {
        const { data: existing } = await sb().from("patients").select("id, full_name, phone").eq("phone", phone).maybeSingle();
        if (existing) {
          onChange(existing as PickedPatient);
          toast.message("Existing patient found with that number", { description: (existing as PickedPatient).full_name });
          setCreating(false);
          return;
        }
      }
      const { data, error } = await sb()
        .from("patients")
        .insert({ full_name: newName.trim(), phone })
        .select("id, full_name, phone")
        .single();
      if (error) throw error;
      onChange(data as PickedPatient);
      toast.success("Patient created");
      setCreating(false);
      setNewName("");
      setNewPhone("");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary-soft/60 p-3">
        <Avatar name={value.full_name} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-heading">{value.full_name}</div>
          <div className="tnum text-[13px] text-muted">{prettyPhone(value.phone)}</div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => onChange(null)} aria-label="Change patient">
          <X />
        </Button>
      </div>
    );
  }

  if (creating) {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-bg-alt p-4">
        <div className="label-caps">New patient</div>
        <Field label="Full name" htmlFor="np-name">
          <Input id="np-name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
        </Field>
        <Field label="Mobile number" htmlFor="np-phone" optional>
          <Input id="np-phone" inputMode="tel" placeholder="082 123 4567" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCreating(false)} className="flex-1">
            Back
          </Button>
          <Button onClick={create} loading={busy} className="flex-1">
            <Check /> Create
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or phone"
          className="pl-10"
          aria-label="Search patients"
        />
      </div>
      <div className="max-h-64 overflow-y-auto rounded-2xl border border-border bg-card">
        {allowNone && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left text-[14px] text-muted hover:bg-bg-alt"
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-[#eef2f5]">
              <UserRound className="size-[18px]" />
            </div>
            {noneLabel}
          </button>
        )}
        {loading && results.length === 0 && <div className="px-4 py-3 text-sm text-muted">Searching…</div>}
        {!loading && results.length === 0 && <div className="px-4 py-3 text-sm text-muted">No patients found.</div>}
        {results.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p)}
            className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-bg-alt")}
          >
            <Avatar name={p.full_name} />
            <div className="min-w-0">
              <div className="truncate text-[14.5px] font-medium text-heading">{p.full_name}</div>
              <div className="tnum text-[13px] text-muted">{prettyPhone(p.phone)}</div>
            </div>
          </button>
        ))}
      </div>
      <Button
        variant="soft"
        className="w-full"
        onClick={() => {
          setCreating(true);
          if (q.trim() && !/\d{3}/.test(q)) setNewName(q.trim());
          else if (q.trim()) setNewPhone(q.trim());
        }}
      >
        <Plus /> New patient
      </Button>
    </div>
  );
}
