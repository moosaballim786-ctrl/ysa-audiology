import type { Tone } from "@/components/ui/badge";
import type { AppointmentStatus, EntStatus, MessageStatus, PaymentMethod, ReasonColor } from "@/lib/types";

export const APPT_STATUS: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  requested: { label: "Requested", tone: "amber" },
  approved: { label: "Booked", tone: "teal" },
  declined: { label: "Declined", tone: "coral" },
  completed: { label: "Completed", tone: "sage" },
  no_show: { label: "No-show", tone: "coral" },
  cancelled: { label: "Cancelled", tone: "slate" },
};

/** Display status including the "Arrived" state (approved + arrived_at). */
export function apptDisplay(a: { status: AppointmentStatus; arrived_at: string | null }) {
  if (a.status === "approved" && a.arrived_at) return { label: "Arrived", tone: "blue" as Tone };
  return APPT_STATUS[a.status];
}

export const ENT_STATUS: Record<EntStatus, { label: string; tone: Tone }> = {
  sent: { label: "Sent", tone: "blue" },
  awaiting_feedback: { label: "Awaiting feedback", tone: "amber" },
  returned: { label: "Returned", tone: "sage" },
  closed: { label: "Closed", tone: "slate" },
};

export const MSG_STATUS: Record<MessageStatus, { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "slate" },
  sent: { label: "Sent", tone: "teal" },
  delivered: { label: "Delivered", tone: "sage" },
  failed: { label: "Failed", tone: "coral" },
  not_sent: { label: "Not sent", tone: "amber" },
};

export const PAY_METHOD: Record<PaymentMethod, { label: string; tone: Tone }> = {
  cash: { label: "Cash", tone: "sage" },
  eft: { label: "EFT", tone: "blue" },
  unpaid: { label: "Unpaid", tone: "amber" },
};

export const TEMPLATE_LABEL: Record<string, string> = {
  booking_confirmation: "Booking confirmation",
  appointment_reminder: "Appointment reminder",
  recall_reminder: "Recall reminder",
  birthday_greeting: "Birthday greeting",
  test: "Test message",
};

export const REASON_STYLE: Record<ReasonColor, { bar: string; soft: string; text: string; tone: Tone }> = {
  teal: { bar: "bg-primary", soft: "bg-primary-soft", text: "text-primary-hover", tone: "teal" },
  blue: { bar: "bg-secondary", soft: "bg-secondary-soft", text: "text-secondary", tone: "blue" },
  sage: { bar: "bg-sage", soft: "bg-sage-bg", text: "text-sage-text", tone: "sage" },
  amber: { bar: "bg-amber", soft: "bg-amber-bg", text: "text-amber-text", tone: "amber" },
  slate: { bar: "bg-[#94a3b8]", soft: "bg-[#eef2f5]", text: "text-[#475569]", tone: "slate" },
  coral: { bar: "bg-coral", soft: "bg-coral-bg", text: "text-coral-text", tone: "coral" },
};

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
