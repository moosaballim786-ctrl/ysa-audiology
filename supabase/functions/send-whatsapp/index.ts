// send-whatsapp — staff-only. Sends/logs a WhatsApp message via the Meta Cloud API.
// Body: { template, appointment_id?, patient_id?, recall_id? } | { message_log_id } | { action: "status" } | { action: "test", to }
import { admin, cors, json, requireStaff } from "../_shared/common.ts";
import { sendTest, sendWhatsApp, waConfig } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = admin();
  const staff = await requireStaff(req, db);
  if (!staff) return json({ error: "Staff sign-in required" }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (body.action === "status") {
    const c = waConfig();
    return json({ configured: c.configured, token_set: !!c.token, phone_number_id_set: !!c.phoneId });
  }
  if (body.action === "test") {
    const to = String(body.to ?? "");
    if (!/^\+\d{9,15}$/.test(to)) return json({ error: "Invalid phone number" }, 400);
    return json(await sendTest(db, to));
  }

  const allowed = ["booking_confirmation", "appointment_reminder", "recall_reminder", "birthday_greeting"];
  if (!body.message_log_id && !allowed.includes(String(body.template))) return json({ error: "Unknown template" }, 400);

  const result = await sendWhatsApp(db, {
    template: body.template as never,
    appointment_id: (body.appointment_id as string) ?? null,
    patient_id: (body.patient_id as string) ?? null,
    recall_id: (body.recall_id as string) ?? null,
    message_log_id: (body.message_log_id as string) ?? null,
  });
  return json(result);
});
