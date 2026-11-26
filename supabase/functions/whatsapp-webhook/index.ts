// whatsapp-webhook — Meta delivery status callbacks (sent → delivered / failed).
// GET: verification handshake using WHATSAPP_VERIFY_TOKEN.
// POST: verified with X-Hub-Signature-256 when WHATSAPP_APP_SECRET is set.
import { admin, json } from "../_shared/common.ts";

async function validSignature(raw: string, header: string | null) {
  const secret = Deno.env.get("WHATSAPP_APP_SECRET");
  if (!secret) return true;
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === header.slice(7);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const ok = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    return ok ? new Response(url.searchParams.get("hub.challenge") ?? "") : new Response("Forbidden", { status: 403 });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("x-hub-signature-256")))) return new Response("Bad signature", { status: 401 });

  const db = admin();
  try {
    const body = JSON.parse(raw);
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const s of change.value?.statuses ?? []) {
          const map: Record<string, string> = { sent: "sent", delivered: "delivered", read: "delivered", failed: "failed" };
          const status = map[s.status];
          if (!status || !s.id) continue;
          const patch: Record<string, unknown> = { status };
          if (status === "failed") patch.error = s.errors?.[0]?.title ?? "Delivery failed";
          const { data: log } = await db.from("message_log").update(patch).eq("wa_message_id", s.id).select("id, patient_id, template").maybeSingle();
          if (log && status === "failed") {
            const { data: p } = await db.from("patients").select("full_name").eq("id", log.patient_id).maybeSingle();
            await db.from("notifications").upsert(
              {
                type: "whatsapp_failed",
                title: `WhatsApp failed to deliver: ${p?.full_name ?? "patient"}`,
                body: String(patch.error),
                patient_id: log.patient_id,
                message_log_id: log.id,
                dedupe_key: `wa_failed:${log.id}`,
                read_at: null,
              },
              { onConflict: "dedupe_key" },
            );
          }
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
  return new Response("ok");
});
