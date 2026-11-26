"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Cake,
  CalendarPlus,
  Ear,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  ScanLine,
  Sparkles,
  Wallet,
  FileText,
  CircleCheck,
  CircleSlash,
  RotateCw,
} from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { EntReferral, MessageLog, Patient, PatientOverview, Payment } from "@/lib/types";
import { must, sendWhatsApp } from "@/lib/db";
import { daysUntil, fmtDate, fmtTZ, money, prettyPhone } from "@/lib/format";
import { ENT_STATUS, MSG_STATUS, PAY_METHOD, TEMPLATE_LABEL } from "@/lib/labels";
import { useQuery } from "@/lib/hooks/use-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Chips } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";
import { NewPatientSheet } from "./new-patient-sheet";
import { RecallPlan, dueTone } from "./recall-plan";
import { VisitsTimeline } from "./visits-timeline";
import { AppointmentForm } from "@/components/features/appointment-form";
import { PaymentSheet } from "@/components/features/payment-sheet";
import { MarkPaidSheet } from "@/components/features/mark-paid-sheet";
import { EntSheet } from "@/components/features/ent-sheet";
import { cn } from "@/lib/utils";

type Tab = "details" | "recall" | "visits" | "payments" | "ent" | "messages";

export function PatientProfile() {
  const { id } = useParams<{ id: string }>();
  const initialTab = (useSearchParams().get("tab") as Tab) || "visits";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [editing, setEditing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [paying, setPaying] = useState(false);

  const patient = useQuery(`patient-${id}`, () =>
    must(sb().from("patient_overview").select("*").eq("id", id).single()) as Promise<PatientOverview>,
  );
  const p = patient.data;

  if (patient.error) {
    return (
      <EmptyState
        icon={FileText}
        title="Patient not found"
        description="This patient may have been removed."
        action={
          <Button asChild variant="secondary">
            <Link href="/patients">Back to patients</Link>
          </Button>
        }
      />
    );
  }

  const due = p?.next_due_date ? dueTone(p.next_due_date) : null;
  const picked = p ? { id: p.id, full_name: p.full_name, phone: p.phone } : null;

  return (
    <div>
      <Link href="/patients" className="mb-4 inline-flex h-10 items-center gap-2 text-[14px] font-medium text-muted hover:text-heading">
        <ArrowLeft className="size-4" /> Patients
      </Link>

      {/* Header card */}
      <Card className="overflow-hidden">
        <div className="bg-[linear-gradient(135deg,#e7f3f5_0%,#eaf1f8_100%)] px-5 pb-5 pt-6 sm:px-7">
          {!p ? (
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Avatar name={p.full_name} className="size-16 bg-card text-[20px] text-primary-hover shadow-soft" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[26px] font-bold leading-tight sm:text-[30px]">{p.full_name}</h1>
                  {p.is_new_from_booking && (
                    <Pill tone="blue">
                      <Sparkles className="size-3" /> New — from online booking
                    </Pill>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-text">
                  {p.phone && (
                    <a href={`tel:${p.phone}`} className="tnum inline-flex items-center gap-1.5 hover:text-secondary">
                      <Phone className="size-4 text-muted" /> {prettyPhone(p.phone)}
                    </a>
                  )}
                  {p.date_of_birth && (
                    <span className="inline-flex items-center gap-1.5">
                      <Cake className="size-4 text-muted" /> {fmtDate(p.date_of_birth, "d MMMM yyyy")}
                    </span>
                  )}
                  <span className={cn("inline-flex items-center gap-1.5", p.whatsapp_consent ? "text-sage-text" : "text-muted")}>
                    <MessageCircle className="size-4" /> {p.whatsapp_consent ? "WhatsApp consent" : "No WhatsApp consent"}
                  </span>
                </div>
              </div>
            </div>
          )}
          {p && (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-card/80 px-4 py-3 shadow-[0_1px_2px_rgba(17,24,39,.04)]">
                <div className="label-caps">Last visit</div>
                <div className="mt-1 font-display text-[17px] font-semibold text-heading">{fmtDate(p.last_visit_date)}</div>
              </div>
              <div className="rounded-2xl bg-card/80 px-4 py-3 shadow-[0_1px_2px_rgba(17,24,39,.04)]">
                <div className="label-caps">Next due</div>
                <div className={cn("mt-1 font-display text-[17px] font-semibold", due?.tone === "coral" ? "text-coral-text" : due?.tone === "amber" ? "text-amber-text" : "text-heading")}>
                  {fmtDate(p.next_due_date)}
                </div>
                {due && p.next_due_date && daysUntil(p.next_due_date) <= 30 && <div className="text-[12px] font-medium text-muted">{due.label}</div>}
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-border p-3 sm:grid-cols-4 sm:p-4">
          <Button variant="soft" onClick={() => setBooking(true)} disabled={!p}>
            <CalendarPlus /> Book
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/scan?patient=${id}`}>
              <ScanLine /> Scan
            </Link>
          </Button>
          <Button variant="secondary" onClick={() => setPaying(true)} disabled={!p}>
            <Wallet /> Payment
          </Button>
          <Button variant="secondary" onClick={() => setEditing(true)} disabled={!p}>
            <Pencil /> Edit
          </Button>
        </div>
      </Card>

      <Chips
        className="my-5"
        value={tab}
        onChange={setTab}
        options={[
          { value: "visits", label: "Visits" },
          { value: "recall", label: "Recall plan" },
          { value: "details", label: "Details" },
          { value: "payments", label: "Payments" },
          { value: "ent", label: "ENT referrals" },
          { value: "messages", label: "Messages" },
        ]}
      />

      {tab === "details" && p && <DetailsTab p={p} onEdit={() => setEditing(true)} />}
      {tab === "recall" && <RecallPlan patientId={id} onChanged={patient.reload} />}
      {tab === "visits" && <VisitsTimeline patientId={id} onChanged={patient.reload} />}
      {tab === "payments" && <PaymentsTab patientId={id} onAdd={() => setPaying(true)} key={`pay-${paying}`} />}
      {tab === "ent" && picked && <EntTab patient={picked} />}
      {tab === "messages" && <MessagesTab patientId={id} />}

      <NewPatientSheet open={editing} onOpenChange={setEditing} existing={p as Patient | undefined} onSaved={patient.reload} />
      <AppointmentForm open={booking} onOpenChange={setBooking} defaultPatient={picked} />
      <PaymentSheet open={paying} onOpenChange={setPaying} patient={picked} />
    </div>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <Icon className="mt-0.5 size-[18px] shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <div className="label-caps">{label}</div>
        <div className="mt-0.5 break-words text-[14.5px] text-heading">{children || <span className="text-muted">—</span>}</div>
      </div>
    </div>
  );
}

function DetailsTab({ p, onEdit }: { p: PatientOverview; onEdit: () => void }) {
  return (
    <Card className="divide-y divide-border">
      <Row icon={Phone} label="Mobile">
        {p.phone && <span className="tnum">{prettyPhone(p.phone)}</span>}
      </Row>
      <Row icon={Mail} label="Email">
        {p.email}
      </Row>
      <Row icon={FileText} label="ID / file number">
        {p.file_number}
      </Row>
      <Row icon={Cake} label="Birthday">
        {p.date_of_birth && fmtDate(p.date_of_birth, "d MMMM yyyy")}
      </Row>
      <Row icon={MapPin} label="Address">
        {p.address}
      </Row>
      <Row icon={MessageCircle} label="WhatsApp consent">
        {p.whatsapp_consent ? (
          <span className="text-sage-text">
            Yes{p.whatsapp_consent_at && ` — given ${fmtTZ(p.whatsapp_consent_at, "d MMMM yyyy")}`}
          </span>
        ) : (
          <span className="text-muted">No</span>
        )}
      </Row>
      <Row icon={FileText} label="Notes">
        {p.notes && <span className="whitespace-pre-wrap">{p.notes}</span>}
      </Row>
      <div className="p-4">
        <Button variant="secondary" className="w-full" onClick={onEdit}>
          <Pencil /> Edit details
        </Button>
      </div>
    </Card>
  );
}

function PaymentsTab({ patientId, onAdd }: { patientId: string; onAdd: () => void }) {
  const [marking, setMarking] = useState<Payment | null>(null);
  const pays = useQuery(`pays-${patientId}`, () =>
    must(sb().from("payments").select("*").eq("patient_id", patientId).order("payment_date", { ascending: false })) as Promise<Payment[]>,
  );
  const total = (pays.data ?? []).filter((x) => x.method !== "unpaid").reduce((s, x) => s + Number(x.amount), 0);
  const owing = (pays.data ?? []).filter((x) => x.method === "unpaid").reduce((s, x) => s + Number(x.amount), 0);
  if (pays.loading && !pays.data) return <ListSkeleton rows={2} />;
  if (!pays.data?.length)
    return (
      <EmptyState
        icon={Wallet}
        title="No payments yet"
        action={
          <Button onClick={onAdd}>
            <Plus /> Record payment
          </Button>
        }
      />
    );
  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="label-caps">Total paid</div>
          <div className="tnum mt-1 font-display text-[20px] font-bold text-heading">{money(total)}</div>
        </Card>
        <Card className="p-4">
          <div className="label-caps">Outstanding</div>
          <div className={cn("tnum mt-1 font-display text-[20px] font-bold", owing ? "text-amber-text" : "text-heading")}>{money(owing)}</div>
        </Card>
      </div>
      <Card className="divide-y divide-border">
        {pays.data.map((x) => (
          <div key={x.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="tnum font-semibold text-heading">{money(x.amount)}</div>
              <div className="text-[13px] text-muted">
                {fmtDate(x.payment_date)}
                {x.was_unpaid && x.received_on && ` · paid ${fmtDate(x.received_on, "d MMM")}`}
                {x.note && ` · ${x.note}`}
              </div>
            </div>
            <Pill tone={PAY_METHOD[x.method].tone}>{PAY_METHOD[x.method].label}</Pill>
            {x.method === "unpaid" && (
              <Button size="sm" variant="sage" onClick={() => setMarking(x)}>
                Mark as paid
              </Button>
            )}
          </div>
        ))}
      </Card>
      <MarkPaidSheet payment={marking} onOpenChange={(o) => !o && setMarking(null)} onSaved={pays.reload} />
    </div>
  );
}

function EntTab({ patient }: { patient: { id: string; full_name: string; phone: string | null } }) {
  const [editing, setEditing] = useState<EntReferral | "new" | null>(null);
  const refs = useQuery(`ent-${patient.id}`, () =>
    must(sb().from("ent_referrals").select("*").eq("patient_id", patient.id).order("date_sent", { ascending: false })) as Promise<EntReferral[]>,
  );
  return (
    <div>
      {refs.loading && !refs.data ? (
        <ListSkeleton rows={2} />
      ) : !refs.data?.length ? (
        <EmptyState
          icon={Ear}
          title="Not referred to an ENT"
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus /> Add ENT referral
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {refs.data.map((r) => (
            <Card key={r.id} className="cursor-pointer p-4 transition hover:shadow-lift sm:p-5" onClick={() => setEditing(r)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-[16px] font-semibold text-heading">{r.ent_name}</div>
                  <div className="text-[13.5px] text-muted">Sent {fmtDate(r.date_sent)}{r.follow_up_date && ` · follow-up ${fmtDate(r.follow_up_date)}`}</div>
                </div>
                <Pill tone={ENT_STATUS[r.status].tone} dot>
                  {ENT_STATUS[r.status].label}
                </Pill>
              </div>
              {r.reason && <p className="mt-2 text-[14px] text-text">{r.reason}</p>}
            </Card>
          ))}
          <Button variant="soft" className="w-full" onClick={() => setEditing("new")}>
            <Plus /> Add ENT referral
          </Button>
        </div>
      )}
      <EntSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        existing={editing === "new" || !editing ? null : { ...editing, patient }}
        patient={patient}
        onSaved={refs.reload}
      />
    </div>
  );
}

function MessagesTab({ patientId }: { patientId: string }) {
  const msgs = useQuery(`msgs-${patientId}`, () =>
    must(sb().from("message_log").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(100)) as Promise<MessageLog[]>,
  );
  const [retrying, setRetrying] = useState<string | null>(null);

  async function retry(m: MessageLog) {
    setRetrying(m.id);
    const res = await sendWhatsApp({ message_log_id: m.id });
    setRetrying(null);
    if (res?.status === "sent") toast.success("Message sent");
    else toast.error("Not sent", { description: res?.error ?? "Please check WhatsApp settings" });
    void msgs.reload();
  }

  if (msgs.loading && !msgs.data) return <ListSkeleton rows={3} />;
  if (!msgs.data?.length) return <EmptyState icon={MessageCircle} title="No WhatsApp messages yet" description="Confirmations, reminders, recalls and birthday messages are logged here." />;
  return (
    <Card className="divide-y divide-border">
      {msgs.data.map((m) => {
        const st = MSG_STATUS[m.status];
        const Icon = m.status === "sent" || m.status === "delivered" ? CircleCheck : CircleSlash;
        return (
          <div key={m.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
            <Icon className={cn("mt-0.5 size-[18px] shrink-0", m.status === "failed" ? "text-coral" : m.status === "not_sent" ? "text-amber" : "text-sage")} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-heading">{TEMPLATE_LABEL[m.template] ?? m.template}</span>
                <Pill tone={st.tone}>{st.label}</Pill>
              </div>
              <div className="text-[13px] text-muted">{fmtTZ(m.created_at, "d MMM yyyy, HH:mm")}</div>
              {m.body && <p className="mt-1.5 text-[13.5px] leading-relaxed text-text">{m.body}</p>}
              {m.error && <p className="mt-1 text-[12.5px] text-coral-text">{m.error}</p>}
            </div>
            {(m.status === "failed" || m.status === "not_sent") && (
              <Button variant="ghost" size="sm" onClick={() => retry(m)} loading={retrying === m.id}>
                <RotateCw /> Retry
              </Button>
            )}
          </div>
        );
      })}
    </Card>
  );
}
