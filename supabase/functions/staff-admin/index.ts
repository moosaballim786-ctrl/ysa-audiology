// staff-admin — staff accounts (no public sign-up).
// { action: "bootstrap", full_name, email, password }  → only works while there are NO staff yet (first-run setup)
// { action: "invite", full_name, email, role, password } → staff only
// { action: "remove", user_id }                          → staff only
import { admin, cors, json, requireStaff } from "../_shared/common.ts";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = admin();
  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (body.action === "bootstrap") {
    const { count } = await db.from("staff").select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) return json({ error: "The practice is already set up. Sign in instead." }, 403);
    return await createStaff(db, { ...body, role: "doctor" });
  }

  const me = await requireStaff(req, db);
  if (!me) return json({ error: "Staff sign-in required" }, 401);

  if (body.action === "invite") return await createStaff(db, body);

  if (body.action === "remove") {
    if (!body.user_id) return json({ error: "user_id required" }, 400);
    if (body.user_id === me.id) return json({ error: "You can't remove yourself." }, 400);
    const { error } = await db.auth.admin.deleteUser(body.user_id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }
  return json({ error: "Unknown action" }, 400);
});

// deno-lint-ignore no-explicit-any
async function createStaff(db: any, b: Record<string, string>) {
  const full_name = (b.full_name ?? "").trim();
  const email = (b.email ?? "").trim().toLowerCase();
  const password = b.password ?? "";
  const role = b.role === "doctor" ? "doctor" : "receptionist";
  if (full_name.length < 2) return json({ error: "Enter a name" }, 400);
  if (!EMAIL.test(email)) return json({ error: "Enter a valid email" }, 400);
  if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });
  if (error) return json({ error: error.message.includes("already") ? "An account with this email already exists." : error.message }, 400);
  const { error: e2 } = await db.from("staff").insert({ id: data.user.id, full_name, email, role });
  if (e2) {
    await db.auth.admin.deleteUser(data.user.id);
    return json({ error: e2.message }, 400);
  }
  return json({ ok: true, user_id: data.user.id });
}
