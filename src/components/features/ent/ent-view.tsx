"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowDownUp, CalendarClock, ChevronRight, Ear, Plus, Stethoscope } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { EntReferral, EntStatus } from "@/lib/types";
import { must } from "@/lib/db";
import { daysUntil, fmtDate, todayISO } from "@/lib/format";
import { ENT_STATUS } from "@/lib/labels";
import { useQuery } from "@/lib/hooks/use-query";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Chips } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EntSheet } from "@/components/features/ent-sheet";
import type { PickedPatient } from "@/components/features/patient-picker";
import { cn } from "@/lib/utils";

type Row = EntReferral & { patient: PickedPatient | null };
type Filter = "all" | "awaiting" | "followup" | "returned";

const NEXT: Partial<Record<EntStatus, EntStatus>> = { sent: "awaiting_feedback", awaiting_feedback: "returned", returned: "closed" };

export function EntView() {
  const [filter, setFilter] = useState<Filter>("all");
  const [desc, setDesc] = useState(true);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const today = todayISO();

  const refs = useQuery("ent-all", () =>
    must(sb().from("ent_referrals").select("*, patient:patients(id, full_name, phone)").order("date_sent", { ascending: false })) as Promise<Row[]>,
  );

  const isFollowUpDue = (r: Row) => !!r.follow_up_date && r.follow_up_date <= today && (r.status === "sent" || r.status === "awaiting_feedback");

  const counts = useMemo(() => {
    const d = refs.data ?? [];
    return {
      awaiting: d.filter((r) => r.status === "sent" || r.status === "awaiting_feedback").length,
      followup: d.filter(isFollowUpDue).length,
      returned: d.filter((r) => r.status === "returned").length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refs.data, today]);

  const list = useMemo(() => {
    let d = refs.data ?? [];
    if (filter === "awaiting") d = d.filter((r) => r.status === "sent" || r.status === "awaiting_feedback");
    if (filter === "followup") d = d.filter(isFollowUpDue);
    if (filter === "returned") d = d.filter((r) => r.status === "returned");
    return [...d].sort((a, b) => (desc ? (a.date_sent < b.date_sent ? 1 : -1) : a.date_sent > b.date_sent ? 1 : -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refs.data, filter, desc, today]);

  async function advance(r: Row) {
    const next = NEXT[r.status];
    if (!next) return;
    const { error } = await sb()
      .from("ent_referrals")
      .update({ status: next, ...(next === "returned" ? { returned_on: today } : {}) })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(`Marked as ${ENT_STATUS[next].label.toLowerCase()}`);
    void refs.reload();
  }

  return (
    <div>
      <PageHeader
        label="ENT Patients"
        title="Sent to ENT"
        subtitle="Patients referred to an ear, nose and throat specialist who may need to come back."
      />
      <Button size="xl" className="mb-6 w-full sm:w-auto" onClick={() => setEditing("new")}>
        <Plus /> Add patient sent to ENT
      </Button>

      <div className="mb-5 flex items-center justify-between gap-3">
        <Chips
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "awaiting", label: "Awaiting", count: counts.awaiting },
            { value: "followup", label: "Follow-up due", count: counts.followup },
            { value: "returned", label: "Returned", count: counts.returned },
          ]}
        />
        <Button variant="ghost" size="sm" onClick={() => setDesc((d) => !d)} className="shrink-0">
          <ArrowDownUp /> {desc ? "Newest" : "Oldest"}
        </Button>
      </div>

      {refs.loading && !refs.data ? (
        <ListSkeleton rows={4} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Ear}
          title={filter === "all" ? "No ENT referrals yet" : "Nothing here"}
          description={filter === "all" ? "Add a patient when you refer them to an ENT so you can track their return." : "Try another filter."}
          action={
            filter === "all" && (
              <Button onClick={() => setEditing("new")}>
                <Plus /> Add patient sent to ENT
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((r) => {
            const st = ENT_STATUS[r.status];
            const due = isFollowUpDue(r);
            const next = NEXT[r.status];
            return (
              <Card key={r.id} className={cn("p-4 transition hover:shadow-lift sm:p-5", due && "ring-1 ring-coral/30")}>
                <div className="flex items-start gap-3">
                  <Avatar name={r.patient?.full_name} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/patients/${r.patient_id}?tab=ent`} className="block truncate font-display text-[16px] font-semibold text-heading hover:underline">
                      {r.patient?.full_name}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[13.5px] text-muted">
                      <Stethoscope className="size-3.5" /> {r.ent_name}
                    </div>
                  </div>
                  <Pill tone={st.tone} dot>
                    {st.label}
                  </Pill>
                </div>
                {r.reason && <p className="mt-3 line-clamp-2 text-[14px] text-text">{r.reason}</p>}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                  <span className="text-muted">Sent {fmtDate(r.date_sent)}</span>
                  {r.follow_up_date && (
                    <span className={cn("inline-flex items-center gap-1", due ? "font-semibold text-coral-text" : "text-muted")}>
                      <CalendarClock className="size-3.5" />
                      Follow-up {fmtDate(r.follow_up_date)}
                      {due ? " · due" : daysUntil(r.follow_up_date) <= 7 && r.status !== "returned" && r.status !== "closed" ? ` · in ${daysUntil(r.follow_up_date)}d` : ""}
                    </span>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  {next && (
                    <Button variant="soft" size="sm" onClick={() => advance(r)}>
                      Mark {ENT_STATUS[next].label.toLowerCase()}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setEditing(r)} className="ml-auto">
                    Details <ChevronRight />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <EntSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        existing={editing === "new" ? null : editing}
        onSaved={refs.reload}
      />
    </div>
  );
}
