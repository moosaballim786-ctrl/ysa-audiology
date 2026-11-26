"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { Reason, RecallType } from "@/lib/types";
import { must } from "@/lib/db";
import { useQuery } from "@/lib/hooks/use-query";
import { useApp } from "@/components/app/app-context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Pill } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { ListSkeleton } from "@/components/ui/skeleton";
import { cn, errorMessage } from "@/lib/utils";

export function RecallTypesSection() {
  const { reasons } = useApp();
  const types = useQuery("recall-types-settings", () => must(sb().from("recall_types").select("*").order("sort_order")) as Promise<RecallType[]>);
  const [editing, setEditing] = useState<RecallType | "new" | null>(null);

  return (
    <Card>
      <CardHeader
        label="Recalls"
        title="Recall plan types"
        action={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> Add
          </Button>
        }
      />
      <CardBody>
        <p className="mb-4 text-[14px] text-muted">
          Each plan has a default interval and the reason text used in the WhatsApp recall reminder. Staff can override the interval per patient.
        </p>
        {!types.data ? (
          <ListSkeleton rows={3} />
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border">
            {types.data.map((t) => (
              <button key={t.id} onClick={() => setEditing(t)} className={cn("flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-bg-alt", !t.active && "opacity-55")}>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-heading">{t.name}</div>
                  <div className="truncate text-[13px] text-muted">{t.reason_text || "Staff write the reason per patient"}</div>
                </div>
                <Pill tone={t.active ? "teal" : "slate"}>{t.default_interval_months ? `${t.default_interval_months} months` : "Custom"}</Pill>
              </button>
            ))}
          </div>
        )}
      </CardBody>
      <TypeSheet existing={editing === "new" ? null : editing} open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} reasons={reasons} onSaved={types.reload} />
    </Card>
  );
}

function TypeSheet({
  existing,
  open,
  onOpenChange,
  reasons,
  onSaved,
}: {
  existing: RecallType | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reasons: Reason[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [months, setMonths] = useState("");
  const [text, setText] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);

  if (open && !lastOpen) {
    setLastOpen(true);
    setName(existing?.name ?? "");
    setMonths(existing?.default_interval_months ? String(existing.default_interval_months) : "");
    setText(existing?.reason_text ?? "");
    setCodes(existing?.trigger_reason_codes ?? []);
    setActive(existing?.active ?? true);
  }
  if (!open && lastOpen) setLastOpen(false);

  async function save() {
    if (!name.trim()) return toast.error("Give the plan a name");
    const m = months ? Number(months) : null;
    if (m !== null && (!Number.isInteger(m) || m < 1 || m > 240)) return toast.error("Interval must be 1–240 months");
    setBusy(true);
    try {
      const row = { name: name.trim(), default_interval_months: m, reason_text: text.trim(), trigger_reason_codes: codes, active, is_custom: m === null };
      const { error } = existing ? await sb().from("recall_types").update(row).eq("id", existing.id) : await sb().from("recall_types").insert({ ...row, sort_order: 50 });
      if (error) throw error;
      toast.success("Recall plan type saved");
      onOpenChange(false);
      onSaved();
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
      title={existing ? "Edit recall plan type" : "New recall plan type"}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="rt-name">
          <Input id="rt-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Default interval (months)" htmlFor="rt-m" optional hint="Leave blank for a custom plan where staff set the interval.">
          <Input id="rt-m" type="number" min={1} max={240} className="tnum" value={months} onChange={(e) => setMonths(e.target.value)} />
        </Field>
        <Field label="Reason text used in messages" htmlFor="rt-text" hint="“Hi Sarah, you're due for … on 12 March.”">
          <Textarea id="rt-text" value={text} onChange={(e) => setText(e.target.value)} className="min-h-[72px]" placeholder="your annual hearing test" />
        </Field>
        <Field label="Counts from visits of type" hint="The next due date is the last visit of these types plus the interval. None selected = any visit.">
          <div className="flex flex-wrap gap-2">
            {reasons.map((r) => {
              const on = codes.includes(r.code);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setCodes((c) => (on ? c.filter((x) => x !== r.code) : [...c, r.code]))}
                  className={cn("h-9 rounded-full border px-3.5 text-[13px] font-medium", on ? "border-primary/30 bg-primary-soft text-primary-hover" : "border-border bg-card")}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </Field>
        <label className="flex items-center justify-between rounded-2xl border border-border bg-bg-alt px-4 py-3 text-[14px]">
          Available for new patients
          <Switch checked={active} onCheckedChange={setActive} />
        </label>
      </div>
    </Sheet>
  );
}
