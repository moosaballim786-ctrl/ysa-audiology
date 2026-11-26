import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type Template = "booking_confirmation" | "appointment_reminder" | "recall_reminder" | "birthday_greeting";

export interface SendInput {
  template?: Template;
  appointment_id?: string | null;
  patient_id?: string | null;
  recall_id?: string | null;
  message_log_id?: string | null; // retry an existing log row
  notification_id?: string | null; // e.g. birthday notification to annotate
}

export interface SendResult {
  status: "sent" | "failed" | "not_sent";
  error?: string;
  message_log_id?: string;
}

const TZ = "Africa/Johannesburg";
const GRAPH = "https://graph.facebook.com/v21.0";

export function waConfig() {
  const token = Deno.env.get("WHATSAPP_TOKEN") ?? "";
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
  return { token, phoneId, configured: !!token && !!phoneId };
}

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(d);
const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const fmtPlainDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso + "T00:00:00Z"));
const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;
const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

function fill(text: string, params: string[]) {
  return params.reduce((t, p, i) => t.replaceAll(`{{${i + 1}}}`, p), text);
}

/** Send (or log as not sent) one WhatsApp message. Never throws. */
export async function sendWhatsApp(db: SupabaseClient, input: SendInput): Promise<SendResult> {
  let logId = input.message_log_id ?? null;
  let tpl = input.template;
  let appointmentId = input.appointment_id ?? null;
  let patientId = input.patient_id ?? null;
  let recallId = input.recall_id ?? null;

  try {
    if (logId) {
      const { data: log } = await db.from("message_log").select("*").eq("id", logId).maybeSingle();
      if (!log) return { status: "failed", error: "Message not found" };
      tpl = log.template as Template;
      appointmentId = log.appointment_id;
      patientId = log.patient_id;
      recallId = log.recall_id;
    }
    if (!tpl) return { status: "failed", error: "No template given" };

    const { data: settings } = await db.from("practice_settings").select("*").eq("id", 1).single();

    // Resolve patient + parameters
    let params: string[] = [];
    let wording = "";
    if (tpl === "booking_confirmation" || tpl === "appointment_reminder") {
      const { data: a } = await db
        .from("appointments")
        .select("id, starts_at, patient_id, reason:appointment_reasons(label)")
        .eq("id", appointmentId)
        .single();
      if (!a) return { status: "failed", error: "Appointment not found" };
      patientId = a.patient_id;
      const start = new Date(a.starts_at);
      const reasonLabel = (a.reason as unknown as { label: string } | null)?.label ?? "audiology";
      params = ["", lowerFirst(reasonLabel), fmtDate(start), fmtTime(start)];
      wording = tpl === "booking_confirmation" ? settings.msg_booking_confirmation : settings.msg_appointment_reminder;
    } else if (tpl === "recall_reminder") {
      const { data: r } = await db
        .from("patient_recalls")
        .select("id, patient_id, next_due_date, custom_reason, type:recall_types(name, reason_text)")
        .eq("id", recallId)
        .single();
      if (!r) return { status: "failed", error: "Recall not found" };
      patientId = r.patient_id;
      const type = r.type as unknown as { name: string; reason_text: string } | null;
      const reason = r.custom_reason || type?.reason_text || type?.name || "your check-up";
      params = ["", reason, r.next_due_date ? fmtPlainDate(r.next_due_date) : "soon", settings.booking_url ?? ""];
      wording = settings.msg_recall_reminder;
    } else if (tpl === "birthday_greeting") {
      params = [];
      wording = settings.msg_birthday;
    }

    const { data: p } = await db
      .from("patients")
      .select("id, full_name, phone, whatsapp_consent")
      .eq("id", patientId)
      .single();
    if (!p) return { status: "failed", error: "Patient not found" };
    if (params.length) params[0] = firstName(p.full_name);
    const body = fill(wording, params);
    const payload = { template: tpl, params, language: settings.wa_language, use_templates: settings.wa_use_templates };

    // Create or reuse the log row
    if (!logId) {
      const { data: log, error } = await db
        .from("message_log")
        .insert({
          patient_id: p.id,
          appointment_id: appointmentId,
          recall_id: recallId,
          template: tpl,
          to_phone: p.phone,
          payload,
          body,
          status: "queued",
        })
        .select("id")
        .single();
      if (error) throw error;
      logId = log.id;
    } else {
      await db.from("message_log").update({ payload, body, to_phone: p.phone, status: "queued", error: null }).eq("id", logId);
    }

    const finish = async (status: "sent" | "failed" | "not_sent", error: string | null, waId?: string) => {
      const { data: prev } = await db.from("message_log").select("attempts").eq("id", logId).single();
      await db
        .from("message_log")
        .update({
          status,
          error,
          wa_message_id: waId ?? null,
          attempts: (prev?.attempts ?? 0) + (status === "not_sent" ? 0 : 1),
          sent_at: status === "sent" ? new Date().toISOString() : null,
        })
        .eq("id", logId);
      if (input.notification_id && tpl === "birthday_greeting") {
        await db
          .from("notifications")
          .update({
            body: status === "sent" ? "WhatsApp birthday message sent." : `WhatsApp birthday message not sent — ${error ?? "unknown error"}.`,
            message_log_id: logId,
          })
          .eq("id", input.notification_id);
      }
      if (status === "sent") {
        if (tpl === "booking_confirmation" && appointmentId)
          await db.from("appointments").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", appointmentId);
        await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("message_log_id", logId).eq("type", "whatsapp_failed").is("read_at", null);
      }
      if (status === "failed") {
        const labels: Record<string, string> = {
          booking_confirmation: "Booking confirmation",
          appointment_reminder: "Appointment reminder",
          recall_reminder: "Recall reminder",
          birthday_greeting: "Birthday greeting",
        };
        await db.from("notifications").upsert(
          {
            type: "whatsapp_failed",
            title: `WhatsApp failed to send: ${p.full_name}`,
            body: `${labels[tpl!] ?? tpl} — ${error ?? "unknown error"}`,
            patient_id: p.id,
            appointment_id: appointmentId,
            message_log_id: logId,
            dedupe_key: `wa_failed:${logId}`,
            read_at: null,
          },
          { onConflict: "dedupe_key" },
        );
      }
      return { status, error: error ?? undefined, message_log_id: logId! } as SendResult;
    };

    if (!p.whatsapp_consent) return await finish("not_sent", "Patient has not given WhatsApp consent");
    if (!p.phone) return await finish("not_sent", "No mobile number on file");
    const cfg = waConfig();
    if (!cfg.configured) return await finish("not_sent", "WhatsApp not configured");

    const to = p.phone.replace(/^\+/, "");
    const message = settings.wa_use_templates
      ? {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: tpl,
            language: { code: settings.wa_language || "en" },
            ...(params.length ? { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] } : {}),
          },
        }
      : { messaging_product: "whatsapp", to, type: "text", text: { body } };

    const res = await fetch(`${GRAPH}/${cfg.phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = out?.error?.error_user_msg || out?.error?.message || `HTTP ${res.status}`;
      return await finish("failed", String(err).slice(0, 500));
    }
    return await finish("sent", null, out?.messages?.[0]?.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (logId) {
      await db.from("message_log").update({ status: "failed", error: msg.slice(0, 500) }).eq("id", logId);
    }
    return { status: "failed", error: msg, message_log_id: logId ?? undefined };
  }
}

/** Send a one-off test message (hello_world template, or free text when templates are off). */
export async function sendTest(db: SupabaseClient, toE164: string): Promise<SendResult> {
  const { data: settings } = await db.from("practice_settings").select("wa_use_templates").eq("id", 1).single();
  const text = "Test message from Yusuf Suder Audiology. We're hear for you.";
  const { data: log } = await db
    .from("message_log")
    .insert({ template: "test", to_phone: toE164, payload: { test: true }, body: text, status: "queued" })
    .select("id")
    .single();
  const cfg = waConfig();
  if (!cfg.configured) {
    await db.from("message_log").update({ status: "not_sent", error: "WhatsApp not configured" }).eq("id", log!.id);
    return { status: "not_sent", error: "WhatsApp not configured — add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID as Supabase secrets." };
  }
  const to = toE164.replace(/^\+/, "");
  const message = settings?.wa_use_templates
    ? { messaging_product: "whatsapp", to, type: "template", template: { name: "hello_world", language: { code: "en_US" } } }
    : { messaging_product: "whatsapp", to, type: "text", text: { body: text } };
  const res = await fetch(`${GRAPH}/${cfg.phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = String(out?.error?.error_user_msg || out?.error?.message || `HTTP ${res.status}`);
    await db.from("message_log").update({ status: "failed", error: err, attempts: 1 }).eq("id", log!.id);
    return { status: "failed", error: err };
  }
  await db
    .from("message_log")
    .update({ status: "sent", sent_at: new Date().toISOString(), wa_message_id: out?.messages?.[0]?.id ?? null, attempts: 1 })
    .eq("id", log!.id);
  return { status: "sent" };
}
