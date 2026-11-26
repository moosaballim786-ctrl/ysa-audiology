"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { sb } from "@/lib/supabase/client";
import { addDaysISO, sastToUtcISO, todayISO } from "@/lib/format";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/components/app/app-context";
import { errorMessage } from "@/lib/utils";

/** Block out leave, holidays or part of a day so it can't be booked online. */
export function BlockTimeSheet({
  open,
  onOpenChange,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultDate?: string;
  onSaved?: () => void;
}) {
  const { staff } = useApp();
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState("08:30");
  const [end, setEnd] = useState("13:00");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      const d = defaultDate ?? todayISO();
      setFrom(d);
      setTo(d);
      setAllDay(true);
      setNote("");
    }
  }, [open, defaultDate]);

  async function save() {
    if (to < from) return toast.error("The end date is before the start date");
    if (!allDay && end <= start) return toast.error("The end time must be after the start time");
    setBusy(true);
    try {
      const starts_at = sastToUtcISO(from, allDay ? "00:00" : start);
      const ends_at = allDay ? sastToUtcISO(addDaysISO(to, 1), "00:00") : sastToUtcISO(to, end);
      const { error } = await sb()
        .from("blocked_times")
        .insert({ starts_at, ends_at, all_day: allDay, note: note.trim() || null, created_by: staff?.id ?? null });
      if (error) throw error;
      toast.success("Time blocked", { description: "Online booking won't offer these times." });
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
      title="Block out time"
      description="Leave, holidays, training — these times won't be offered online."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Block time
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" htmlFor="bt-from">
            <Input id="bt-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} />
          </Field>
          <Field label="To" htmlFor="bt-to">
            <Input id="bt-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center justify-between rounded-2xl border border-border bg-bg-alt px-4 py-3 text-[14px]">
          All day
          <Switch checked={allDay} onCheckedChange={setAllDay} />
        </label>
        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start time" htmlFor="bt-s">
              <Input id="bt-s" type="time" step={300} value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="End time" htmlFor="bt-e">
              <Input id="bt-e" type="time" step={300} value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
        )}
        <Field label="Note" htmlFor="bt-n" optional>
          <Input id="bt-n" placeholder="e.g. Annual leave" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
