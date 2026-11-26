"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, BellOff, BellRing, Cake, CalendarClock, CheckCheck, Inbox, RotateCw, Stethoscope } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { AppointmentWithRefs, Notification, NotificationType } from "@/lib/types";
import { APPT_SELECT, must, sendWhatsApp } from "@/lib/db";
import { fmtTZ } from "@/lib/format";
import { useQuery } from "@/lib/hooks/use-query";
import { useApp } from "@/components/app/app-context";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chips } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Sheet } from "@/components/ui/sheet";
import { BookingRequestCard } from "@/components/features/booking-request-card";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread" | "booking" | "birthday" | "recall" | "ent" | "failed";

const META: Record<NotificationType, { icon: typeof Inbox; cls: string }> = {
  booking_request: { icon: Inbox, cls: "bg-amber-bg text-amber-text" },
  birthday: { icon: Cake, cls: "bg-sage-bg text-sage-text" },
  recall_due: { icon: BellRing, cls: "bg-primary-soft text-primary-hover" },
  recall_overdue: { icon: CalendarClock, cls: "bg-coral-bg text-coral-text" },
  ent_followup_due: { icon: Stethoscope, cls: "bg-secondary-soft text-secondary" },
  whatsapp_failed: { icon: AlertTriangle, cls: "bg-coral-bg text-coral-text" },
  system: { icon: BellRing, cls: "bg-[#eef2f5] text-[#475569]" },
};

const FILTER_TYPES: Record<Exclude<Filter, "all" | "unread">, NotificationType[]> = {
  booking: ["booking_request"],
  birthday: ["birthday"],
  recall: ["recall_due", "recall_overdue"],
  ent: ["ent_followup_due"],
  failed: ["whatsapp_failed"],
};

export function NotificationsView() {
  const router = useRouter();
  const { refreshCounts } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const [booking, setBooking] = useState<AppointmentWithRefs | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const feed = useQuery("notifications", () =>
    must(sb().from("notifications").select("*").order("created_at", { ascending: false }).limit(300)) as Promise<Notification[]>,
  );

  useEffect(() => {
    const ch = sb()
      .channel("notif-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => void feed.reload())
      .subscribe();
    return () => {
      void sb().removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useMemo(() => {
    const d = feed.data ?? [];
    if (filter === "all") return d;
    if (filter === "unread") return d.filter((n) => !n.read_at);
    return d.filter((n) => FILTER_TYPES[filter].includes(n.type));
  }, [feed.data, filter]);

  const unreadCount = (feed.data ?? []).filter((n) => !n.read_at).length;
  const countOf = (f: Exclude<Filter, "all" | "unread">) => (feed.data ?? []).filter((n) => !n.read_at && FILTER_TYPES[f].includes(n.type)).length;

  async function markRead(ids: string[]) {
    if (!ids.length) return;
    const now = new Date().toISOString();
    feed.setData((d) => d?.map((n) => (ids.includes(n.id) ? { ...n, read_at: n.read_at ?? now } : n)));
    await sb().from("notifications").update({ read_at: now }).in("id", ids).is("read_at", null);
    void refreshCounts();
  }

  async function open(n: Notification) {
    void markRead([n.id]);
    if (n.type === "booking_request" && n.appointment_id) {
      const { data } = await sb().from("appointments").select(APPT_SELECT).eq("id", n.appointment_id).maybeSingle();
      const a = data as AppointmentWithRefs | null;
      if (a?.status === "requested") return setBooking(a);
      if (a) return router.push(`/patients/${a.patient_id}`);
    }
    if (!n.patient_id) return;
    const tab = n.type === "recall_due" || n.type === "recall_overdue" ? "recall" : n.type === "ent_followup_due" ? "ent" : n.type === "whatsapp_failed" ? "messages" : n.type === "birthday" ? "details" : "visits";
    router.push(`/patients/${n.patient_id}?tab=${tab}`);
  }

  async function retry(n: Notification) {
    if (!n.message_log_id) return;
    setRetrying(n.id);
    const res = await sendWhatsApp({ message_log_id: n.message_log_id });
    setRetrying(null);
    if (res?.status === "sent") {
      toast.success("Message sent");
      void markRead([n.id]);
    } else toast.error("Still not sent", { description: res?.error ?? "Check WhatsApp settings" });
    void feed.reload();
  }

  return (
    <div>
      <PageHeader
        label="Notifications"
        title="Notifications"
        subtitle={unreadCount ? `${unreadCount} unread` : "You're all caught up."}
        action={
          <Button
            variant="secondary"
            disabled={!unreadCount}
            onClick={async () => {
              await markRead((feed.data ?? []).filter((n) => !n.read_at).map((n) => n.id));
              toast.success("All marked as read");
            }}
          >
            <CheckCheck /> Mark all read
          </Button>
        }
      />
      <Chips
        className="mb-5"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All" },
          { value: "unread", label: "Unread", count: unreadCount },
          { value: "booking", label: "Booking requests", count: countOf("booking") },
          { value: "birthday", label: "Birthdays", count: countOf("birthday") },
          { value: "recall", label: "Recalls", count: countOf("recall") },
          { value: "ent", label: "ENT follow-ups", count: countOf("ent") },
          { value: "failed", label: "WhatsApp failed", count: countOf("failed") },
        ]}
      />
      {feed.loading && !feed.data ? (
        <ListSkeleton rows={5} />
      ) : list.length === 0 ? (
        <EmptyState icon={BellOff} title="No notifications" description="Booking requests, birthdays, recalls and ENT follow-ups appear here." />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            <AnimatePresence initial={false}>
              {list.map((n, i) => {
                const meta = META[n.type];
                const Icon = meta.icon;
                return (
                  <motion.li key={n.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn(i > 0 && "border-t border-border")}>
                    <div className={cn("flex items-start gap-3 px-4 py-4 transition sm:px-5", !n.read_at && "bg-primary-soft/35")}>
                      <button onClick={() => open(n)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", meta.cls)}>
                          <Icon className="size-[19px]" strokeWidth={1.9} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-[14.5px] leading-snug text-heading", !n.read_at ? "font-semibold" : "font-medium")}>{n.title}</span>
                          {n.body && <span className="mt-0.5 block text-[13.5px] leading-snug text-muted">{n.body}</span>}
                          <span className="mt-1 block text-[12px] text-muted" title={fmtTZ(n.created_at, "d MMM yyyy HH:mm")}>
                            {formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}
                          </span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        {n.type === "whatsapp_failed" && n.message_log_id && (
                          <Button variant="coral" size="sm" onClick={() => retry(n)} loading={retrying === n.id}>
                            <RotateCw /> Retry
                          </Button>
                        )}
                        {!n.read_at && <span className="mt-1.5 size-2.5 rounded-full bg-coral" aria-label="Unread" />}
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </Card>
      )}
      <Sheet open={!!booking} onOpenChange={(o) => !o && setBooking(null)} title="Booking request">
        {booking && (
          <BookingRequestCard
            appt={booking}
            onChanged={() => {
              setBooking(null);
              void feed.reload();
              void refreshCounts();
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
