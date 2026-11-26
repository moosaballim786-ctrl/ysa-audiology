"use client";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { sb } from "@/lib/supabase/client";
import type { Staff, StaffRole } from "@/lib/types";
import { callFunction, must } from "@/lib/db";
import { useQuery } from "@/lib/hooks/use-query";
import { useApp } from "@/components/app/app-context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Pill } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Sheet } from "@/components/ui/sheet";
import { ListSkeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/utils";

export function StaffSection() {
  const { staff: me } = useApp();
  const list = useQuery("staff-list", () => must(sb().from("staff").select("*").order("created_at")) as Promise<Staff[]>);
  const [inviting, setInviting] = useState(false);
  const [pw, setPw] = useState(false);

  async function remove(s: Staff) {
    if (!confirm(`Remove ${s.full_name}? They will no longer be able to sign in.`)) return;
    try {
      await callFunction("staff-admin", { action: "remove", user_id: s.id });
      toast.success("Staff member removed");
      void list.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Card>
      <CardHeader
        label="Staff"
        title="Staff accounts"
        action={
          <Button size="sm" onClick={() => setInviting(true)}>
            <UserPlus /> Invite
          </Button>
        }
      />
      <CardBody>
        <p className="mb-4 text-[14px] text-muted">Doctor and receptionist accounts can see and do everything. There is no public sign-up.</p>
        {!list.data ? (
          <ListSkeleton rows={2} />
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border">
            {list.data.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3.5">
                <Avatar name={s.full_name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-heading">{s.full_name}</span>
                    {s.id === me?.id && <Pill tone="teal">You</Pill>}
                  </div>
                  <div className="truncate text-[13px] text-muted">{s.email}</div>
                </div>
                <Pill tone={s.role === "doctor" ? "blue" : "slate"}>{s.role === "doctor" ? "Doctor" : "Receptionist"}</Pill>
                {s.id !== me?.id && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${s.full_name}`} onClick={() => remove(s)}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <Button variant="secondary" className="mt-4" onClick={() => setPw(true)}>
          <KeyRound /> Change my password
        </Button>
      </CardBody>
      <InviteSheet open={inviting} onOpenChange={setInviting} onSaved={list.reload} />
      <PasswordSheet open={pw} onOpenChange={setPw} />
    </Card>
  );
}

function InviteSheet({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("receptionist");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function invite() {
    if (name.trim().length < 2) return toast.error("Enter their name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return toast.error("Enter a valid email");
    if (password.length < 8) return toast.error("Temporary password must be at least 8 characters");
    setBusy(true);
    try {
      await callFunction("staff-admin", { action: "invite", full_name: name.trim(), email: email.trim(), role, password });
      toast.success("Staff account created", { description: `Share the temporary password with ${name.trim().split(" ")[0]} — they can change it in Settings.` });
      setName("");
      setEmail("");
      setPassword("");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Invite staff"
      description="Creates a login with a temporary password."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={invite} loading={busy}>
            Create account
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Full name" htmlFor="iv-name">
          <Input id="iv-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="iv-email">
          <Input id="iv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Role" htmlFor="iv-role" hint="For display only — both roles can do everything.">
          <Select id="iv-role" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
            <option value="receptionist">Receptionist</option>
            <option value="doctor">Doctor</option>
          </Select>
        </Field>
        <Field label="Temporary password" htmlFor="iv-pw" hint="At least 8 characters.">
          <Input id="iv-pw" type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

function PasswordSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (pw.length < 8) return toast.error("Use at least 8 characters");
    setBusy(true);
    const { error } = await sb().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password changed");
    setPw("");
    onOpenChange(false);
  }
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Change my password"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save password
          </Button>
        </>
      }
    >
      <Field label="New password" htmlFor="np-pw" hint="At least 8 characters.">
        <Input id="np-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
    </Sheet>
  );
}
