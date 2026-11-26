"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Cake, ChevronRight, Search, UserPlus, Users } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { PatientOverview } from "@/lib/types";
import { must } from "@/lib/db";
import { daysUntil, fmtDate, prettyPhone, todayISO } from "@/lib/format";
import { useQuery } from "@/lib/hooks/use-query";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Chips } from "@/components/ui/segmented";
import { Pill } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { NewPatientSheet } from "./new-patient-sheet";
import { cn } from "@/lib/utils";

type Filter = "all" | "due" | "overdue" | "birthday" | "ent";

export function PatientList() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>((params.get("filter") as Filter) || "all");
  const [adding, setAdding] = useState(false);
  const today = todayISO();
  const thisMonth = Number(today.slice(5, 7));

  const all = useQuery("patients-all", () =>
    must(sb().from("patient_overview").select("*").order("full_name")) as Promise<PatientOverview[]>,
  );

  useEffect(() => {
    const f = params.get("filter") as Filter | null;
    if (f) setFilter(f);
  }, [params]);

  const counts = useMemo(() => {
    const d = all.data ?? [];
    return {
      due: d.filter((p) => p.next_due_date && daysUntil(p.next_due_date) >= 0 && daysUntil(p.next_due_date) <= 30).length,
      overdue: d.filter((p) => p.next_due_date && daysUntil(p.next_due_date) < 0).length,
      birthday: d.filter((p) => p.birth_month === thisMonth).length,
      ent: d.filter((p) => p.ever_sent_to_ent).length,
    };
  }, [all.data, thisMonth]);

  const list = useMemo(() => {
    let d = all.data ?? [];
    if (filter === "due") d = d.filter((p) => p.next_due_date && daysUntil(p.next_due_date) >= 0 && daysUntil(p.next_due_date) <= 30);
    if (filter === "overdue") d = d.filter((p) => p.next_due_date && daysUntil(p.next_due_date) < 0);
    if (filter === "birthday")
      d = d.filter((p) => p.birth_month === thisMonth).sort((a, b) => (a.date_of_birth!.slice(8) > b.date_of_birth!.slice(8) ? 1 : -1));
    if (filter === "ent") d = d.filter((p) => p.ever_sent_to_ent);
    if (filter === "due" || filter === "overdue") d = [...d].sort((a, b) => (a.next_due_date! > b.next_due_date! ? 1 : -1));
    const term = q.trim().toLowerCase();
    if (term) {
      const digits = term.replace(/\D/g, "").replace(/^0/, "");
      d = d.filter(
        (p) =>
          p.full_name.toLowerCase().includes(term) ||
          (digits.length >= 3 && (p.phone ?? "").includes(digits)) ||
          (p.file_number ?? "").toLowerCase().includes(term),
      );
    }
    return d;
  }, [all.data, filter, q, thisMonth]);

  return (
    <div>
      <PageHeader
        label="Patient History"
        title="Patients"
        subtitle={all.data ? `${all.data.length} patients` : "Every patient, their visits, recalls and scans."}
        action={
          <Button onClick={() => setAdding(true)}>
            <UserPlus /> New patient
          </Button>
        }
      />
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone or file number"
          className="h-[52px] rounded-2xl pl-12 text-[16px] shadow-soft"
          aria-label="Search patients"
          autoFocus
        />
      </div>
      <Chips
        className="mb-5"
        value={filter}
        onChange={(f) => {
          setFilter(f);
          router.replace(f === "all" ? "/patients" : `/patients?filter=${f}`, { scroll: false });
        }}
        options={[
          { value: "all", label: "All" },
          { value: "due", label: "Recall due soon", count: counts.due },
          { value: "overdue", label: "Overdue", count: counts.overdue },
          { value: "birthday", label: "Birthday this month", count: counts.birthday },
          { value: "ent", label: "Sent to ENT", count: counts.ent },
        ]}
      />

      {all.loading && !all.data ? (
        <ListSkeleton rows={6} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q || filter !== "all" ? "No matching patients" : "No patients yet"}
          description={q || filter !== "all" ? "Try a different search or filter." : "Patients appear here when you add them or when they book online."}
          action={
            <Button onClick={() => setAdding(true)}>
              <UserPlus /> Add patient
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {list.map((p, i) => {
              const due = p.next_due_date ? daysUntil(p.next_due_date) : null;
              return (
                <li key={p.id}>
                  <Link
                    href={`/patients/${p.id}`}
                    className={cn("flex items-center gap-3 px-4 py-3.5 transition hover:bg-bg-alt sm:px-5", i > 0 && "border-t border-border")}
                  >
                    <Avatar name={p.full_name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold text-heading">{p.full_name}</span>
                        {p.is_new_from_booking && <Pill tone="blue">New · online</Pill>}
                      </div>
                      <div className="tnum truncate text-[13px] text-muted">
                        {prettyPhone(p.phone)}
                        {p.last_visit_date && <> · Last visit {fmtDate(p.last_visit_date, "d MMM yyyy")}</>}
                      </div>
                    </div>
                    <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                      {p.birth_month === thisMonth && (
                        <Pill tone="sage">
                          <Cake className="size-3" /> {fmtDate(p.date_of_birth, "d MMM")}
                        </Pill>
                      )}
                      {p.has_open_ent && <Pill tone="blue">ENT</Pill>}
                      {due !== null && due < 0 && <Pill tone="coral">Overdue</Pill>}
                      {due !== null && due >= 0 && due <= 30 && <Pill tone="amber">Due {fmtDate(p.next_due_date, "d MMM")}</Pill>}
                    </div>
                    {due !== null && due < 0 && <span className="size-2 rounded-full bg-coral sm:hidden" />}
                    {due !== null && due >= 0 && due <= 30 && <span className="size-2 rounded-full bg-amber sm:hidden" />}
                    <ChevronRight className="size-4 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <NewPatientSheet open={adding} onOpenChange={setAdding} onCreated={(id) => router.push(`/patients/${id}`)} />
    </div>
  );
}
