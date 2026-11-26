// Row types mirroring the Supabase schema (see /supabase/migrations).

export type AppointmentStatus = "requested" | "approved" | "declined" | "completed" | "no_show" | "cancelled";
export type PaymentMethod = "cash" | "eft" | "unpaid";
export type EntStatus = "sent" | "awaiting_feedback" | "returned" | "closed";
export type MessageStatus = "queued" | "sent" | "delivered" | "failed" | "not_sent";
export type NotificationType =
  | "booking_request"
  | "birthday"
  | "recall_due"
  | "recall_overdue"
  | "ent_followup_due"
  | "whatsapp_failed"
  | "system";
export type ScanKind = "front" | "back" | "audiogram";
export type StaffRole = "doctor" | "receptionist";
export type ReasonColor = "teal" | "blue" | "sage" | "amber" | "slate" | "coral";

export interface Staff {
  id: string;
  full_name: string;
  role: StaffRole;
  email: string | null;
  active: boolean;
  created_at: string;
}

export interface PracticeSettings {
  id: number;
  practice_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  website_url: string | null;
  booking_url: string | null;
  booking_lead_minutes: number;
  booking_horizon_days: number;
  slot_step_minutes: number;
  wa_use_templates: boolean;
  wa_language: string;
  msg_booking_confirmation: string;
  msg_appointment_reminder: string;
  msg_recall_reminder: string;
  msg_birthday: string;
  updated_at: string;
}

export interface WorkingHours {
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  lunch_start: string | null;
  lunch_end: string | null;
}

export interface Reason {
  id: string;
  code: string;
  label: string;
  duration_minutes: number;
  color: ReasonColor;
  public_bookable: boolean;
  active: boolean;
  sort_order: number;
}

export interface BlockedTime {
  id: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  note: string | null;
  created_at: string;
}

export interface Patient {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  file_number: string | null;
  date_of_birth: string | null;
  address: string | null;
  notes: string | null;
  whatsapp_consent: boolean;
  whatsapp_consent_at: string | null;
  source: "staff" | "online_booking";
  is_new_from_booking: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientOverview extends Patient {
  last_visit_date: string | null;
  next_due_date: string | null;
  has_open_ent: boolean;
  ever_sent_to_ent: boolean;
  birth_month: number | null;
}

export interface Appointment {
  id: string;
  patient_id: string;
  reason_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: "staff" | "online";
  arrived_at: string | null;
  completed_at: string | null;
  patient_note: string | null;
  staff_note: string | null;
  decline_reason: string | null;
  suggested_starts_at: string | null;
  confirmation_sent_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
}

export interface AppointmentWithRefs extends Appointment {
  patient: Pick<Patient, "id" | "full_name" | "phone" | "whatsapp_consent" | "is_new_from_booking"> | null;
  reason: Pick<Reason, "id" | "code" | "label" | "color" | "duration_minutes"> | null;
}

export interface Visit {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  visit_date: string;
  reason_id: string | null;
  reason_label: string | null;
  notes: string | null;
  ai_notes: string | null;
  ai_extracted_at: string | null;
  created_at: string;
}

export interface VisitScan {
  id: string;
  visit_id: string;
  patient_id: string;
  kind: ScanKind;
  storage_path: string;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  ai_status: "none" | "pending" | "done" | "failed";
  ai_text: string | null;
  created_at: string;
}

export interface RecallType {
  id: string;
  name: string;
  default_interval_months: number | null;
  reason_text: string;
  trigger_reason_codes: string[];
  is_custom: boolean;
  active: boolean;
  sort_order: number;
}

export interface PatientRecall {
  id: string;
  patient_id: string;
  recall_type_id: string;
  interval_months: number | null;
  custom_reason: string | null;
  last_visit_date: string | null;
  next_due_date: string | null;
  due_manually_set: boolean;
  active: boolean;
  notes: string | null;
  reminder_sent_at: string | null;
  reminder_due_date: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  patient_id: string | null;
  appointment_id: string | null;
  visit_id: string | null;
  payment_date: string;
  amount: number;
  method: PaymentMethod;
  received_on: string | null;
  was_unpaid: boolean;
  note: string | null;
  created_at: string;
}

export interface EntReferral {
  id: string;
  patient_id: string;
  date_sent: string;
  ent_name: string;
  reason: string | null;
  follow_up_date: string | null;
  status: EntStatus;
  notes: string | null;
  returned_on: string | null;
  created_at: string;
}

export interface MessageLog {
  id: string;
  patient_id: string | null;
  appointment_id: string | null;
  recall_id: string | null;
  template: string;
  to_phone: string | null;
  payload: Record<string, unknown>;
  body: string | null;
  status: MessageStatus;
  error: string | null;
  wa_message_id: string | null;
  attempts: number;
  sent_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  patient_id: string | null;
  appointment_id: string | null;
  ent_referral_id: string | null;
  recall_id: string | null;
  message_log_id: string | null;
  read_at: string | null;
  created_at: string;
}
