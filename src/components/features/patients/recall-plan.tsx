"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BellRing, CalendarClock, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { PatientRecall, RecallType } from "@/lib/types";
import { must } from "@/lib/db";
import { daysUntil, fmtDate } from "@/lib/format";
import { useQuery } from "@/lib/hooks/use-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { cn, errorMessage } from "@/lib/utils";

export function dueTone(date: string | null) {
  if (!date) return { tone: "slate" as const, label: "No date" };
  const d = daysUntil(date);
  if (d < 0) return { tone: "coral" as const, label: `Overdue · ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"}` };
  if (d <= 7) return { tone: "amber" as const, label: d === 0 ? "Due today" : `Due in ${d} day${d === 1 ? "" : "s"}` };
  if (d <= 30) return { tone: "amber" as const, label: `Due in ${d} days` };
  return { tone: "sage" as const, label: "On track" };
}

export function RecallPlan({ patientId, onChanged }: { patientId: string; onChanged?: () => void }) {
  const [editing, setEditing] = useState<PatientRecall | "new" | null>(null);
  const types = useQuery("recall-types", () =>
    must(sb().from("recall_types").select("*").order("sort_order")) as Promise<RecallType[]>,
  );
  const recalls = useQuery(`recalls-${patientId}`, () =>
    must(sb().from("patient_recalls").select("*").eq("patient_id", patientId).order("next_due_date")) as Promise<PatientRecall[]>,
  );
  const typeById = useMemo(() => new Map((types.data ?? []).map((t) => [t.id, t])), [types.data]);

  const reload = () => {
    void recalls.reload();
    onChanged?.();
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[14px] text-muted">A patient can have more than one recall. The next due date is the last relevant visit plus the interval.</p>
      </div>
      {recalls.loading && !recalls.data ? (
        <ListSkeleton rows={2} />
      ) : (recalls.data ?? []).length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="No recall plan yet"
          description="Add a recall so the patient is reminded on WhatsApp 7 days before they're due."
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus /> Add recall
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {recalls.data!.map((r) => {
            const t = typeById.get(r.recall_type_id);
            const interval = r.interval_months ?? t?.default_interval_months;
            const due = dueTone(r.next_due_date);
            return (
              <Card key={r.id} className={cn("p-4 sm:p-5", !r.active && "opacity-60")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-[16px] font-semibold text-heading">{t?.name ?? "Recall"}</div>
                    <div className="mt-0.5 text-[13.5px] text-muted">
                      {r.custom_reason || t?.reason_text}
                      {interval ? ` · every ${interval} month${interval === 1 ? "" : "s"}` : ""}
                      {r.interval_months && t?.default_interval_months && r.interval_months !== t.default_interval_months && " (custom)"}
                    </div>
                  </div>
                  {r.active ? <Pill tone={due.tone} dot>{due.label}</Pill> : <Pill tone="slate">Paused</Pill>}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-bg-alt p-3 text-[13.5px] sm:grid-cols-3">
                  <div>
                    <div className="label-caps">Last relevant visit</div>
                    <div className="mt-0.5 font-medium text-heading">{fmtDate(r.last_visit_date)}</div>
                  </div>
                  <div>
                    <div className="label-caps">Next due</div>
                    <div className="mt-0.5 font-medium text-heading">
                      {fmtDate(r.next_due_date)}
                      {r.due_manually_set && <span className="ml-1 text-[12px] font-normal text-muted">(set manually)</span>}
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <div className="label-caps">Reminder</div>
                    <div className="mt-0.5 font-medium text-heading">
                      {r.reminder_sent_at && r.reminder_due_date === r.next_due_date ? `Sent ${fmtDate(r.reminder_sent_at.slice(0, 10), "d MMM")}` : "7 days before"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
                    <SlidersHorizontal /> Adjust plan
                  </Button>
                </div>
              </Card>
            );
          })}
          <Button variant="soft" className="w-full" onClick={() => setEditing("new")}>
            <Plus /> Add another recall
          </Button>
        </div>
      )}
      <RecallSheet
        patientId={patientId}
        types={types.data ?? []}
        existing={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={reload}
      />
    </div>
  );
}

function RecallSheet({
  patientId,
  types,
  existing,
  open,
  onOpenChange,
  onSaved,
}: {
  patientId: string;
  types: RecallType[];
  existing: PatientRecall | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const activeTypes = types.filter((t) => t.active || t.id === existing?.recall_type_id);
  const [typeId, setTypeId] = useState("");
  const [intervalM, setIntervalM] = useState("");
  const [reason, setReason] = useState("");
  const [manual, setManual] = useState(false);
  const [due, setDue] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const type = types.find((t) => t.id === typeId);

  useEffect(() => {
    if (!open) return;
    setTypeId(existing?.recall_type_id ?? activeTypes[0]?.id ?? "");
    setIntervalM(existing?.interval_months ? String(existing.interval_months) : "");
    setReason(existing?.custom_reason ?? "");
    setManual(existing?.due_manually_set ?? false);
    setDue(existing?.next_due_date ?? "");
    setActive(existing?.active ?? true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing]);

  async function save() {
    if (!type) return toast.error("Choose a recall plan");
    const months = intervalM ? Number(intervalM) : null;
    if (months !== null && (!Number.isInteger(months) || months < 1 || months > 240)) return toast.error("Interval must be 1–240 months");
    if (type.is_custom && !months && !manual) return toast.error("Custom plans need an interval or a manual due date");
    if (type.is_custom && !reason.trim()) return toast.error("Write the reason for this custom recall");
    if (manual && !due) return toast.error("Choose the next due date");
    setBusy(true);
    try {
      const row = {
        patient_id: patientId,
        recall_type_id: type.id,
        interval_months: months,
        custom_reason: reason.trim() || null,
        due_manually_set: manual,
        next_due_date: manual ? due : null,
        active,
      };
      const { error } = existing
        ? await sb().from("patient_recalls").update(row).eq("id", existing.id)
        : await sb().from("patient_recalls").insert(row);
      if (error) throw error;
      toast.success(existing ? "Recall plan updated" : "Recall added");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing || !confirm("Remove this recall from the patient?")) return;
    const { error } = await sb().from("patient_recalls").delete().eq("id", existing.id);
    if (error) return toast.error(error.message);
    toast.success("Recall removed");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? "Adjust recall plan" : "Add recall"}
      footer={
        <>
          {existing && (
            <Button variant="ghost" className="text-crimson hover:bg-coral-bg sm:mr-auto" onClick={remove}>
              Remove
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save plan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Recall plan" htmlFor="rc-type">
          <Select id="rc-type" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {activeTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.default_interval_months ? ` — ${t.default_interval_months} months` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Interval for this patient (months)"
          htmlFor="rc-int"
          optional={!type?.is_custom}
          hint={type?.default_interval_months ? `Leave blank to use the default of ${type.default_interval_months} months.` : undefined}
        >
          <Input id="rc-int" type="number" min={1} max={240} inputMode="numeric" value={intervalM} onChange={(e) => setIntervalM(e.target.value)} className="tnum" />
        </Field>
        <Field label="Reason used in the WhatsApp message" htmlFor="rc-reason" optional={!type?.is_custom} hint={type?.reason_text ? `Default: “${type.reason_text}”` : undefined}>
          <Textarea id="rc-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[64px]" />
        </Field>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-bg-alt px-4 py-3">
          <span className="flex items-center gap-2.5 text-[14px]">
            <CalendarClock className="size-[18px] text-muted" /> Set the next due date manually
          </span>
          <Switch checked={manual} onCheckedChange={setManual} />
        </label>
        {manual ? (
          <Field label="Next due date" htmlFor="rc-due">
            <Input id="rc-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        ) : (
          existing?.due_manually_set && (
            <p className="flex items-center gap-2 text-[13px] text-muted">
              <RotateCcw className="size-3.5" /> The due date will be recalculated from the last visit.
            </p>
          )
        )}
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-bg-alt px-4 py-3 text-[14px]">
          Active (send reminders)
          <Switch checked={active} onCheckedChange={setActive} />
        </label>
      </div>
    </Sheet>
  );
}
