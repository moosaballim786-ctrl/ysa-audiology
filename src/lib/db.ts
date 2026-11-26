"use client";
import { sb } from "@/lib/supabase/client";

/** Throw Supabase errors so callers can catch + toast them. */
export async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

export const APPT_SELECT =
  "*, patient:patients(id, full_name, phone, whatsapp_consent, is_new_from_booking), reason:appointment_reasons(id, code, label, color, duration_minutes)";

/** Invoke an edge function with the staff session. */
export async function callFunction<T = unknown>(name: string, body: unknown): Promise<T> {
  const { data, error } = await sb().functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const j = await ctx.json();
        if (j?.error) msg = j.error;
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return data as T;
}

/** Ask the send-whatsapp function to send/log a message. Never throws — WhatsApp must not block clinic work. */
export type WaTemplate = "booking_confirmation" | "appointment_reminder" | "recall_reminder" | "birthday_greeting";

export async function sendWhatsApp(body: {
  template?: WaTemplate;
  appointment_id?: string;
  patient_id?: string;
  recall_id?: string;
  /** Retry a previously logged message */
  message_log_id?: string;
}): Promise<{ status: string; error?: string } | null> {
  try {
    return await callFunction("send-whatsapp", body);
  } catch {
    return null;
  }
}
